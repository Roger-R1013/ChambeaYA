-- =============================================================================
-- ChambeaYA! - Migration 0007: worker availability location + geographic search
--
-- STATUS: DRAFT - NOT APPLIED. Requires 0001-0006. Additive and non-destructive.
--
-- Design decisions:
--   * NO exact location is ever stored. A BEFORE trigger snaps every point to a
--     ~550 m grid (0.005 deg) before it is written, whatever the client sends.
--     The worker's home cannot be recovered from the database.
--   * Public results return the grid cell plus a fixed per-worker offset
--     (< 220 m) so markers in the same cell do not overlap. Distances are
--     computed from that public point, so changing the search origin cannot be
--     used to triangulate anything more precise.
--   * Locations are only accepted inside the Santa Cruz metropolitan area.
--   * The location table is owner-only (RLS). Clients only see workers through
--     two SECURITY DEFINER functions that return a fixed set of public columns.
--   * Search is reserved for CLIENT accounts (enforced in the database).
--   * No PostGIS: with a bounding-box prefilter on an index and a Haversine
--     distance this is efficient for the expected volume (thousands of
--     workers in one city). Migrating to PostGIS later only changes this file's
--     functions, not the client API.
--   * This is NOT live tracking (Phase 6): the worker shares a coarse point
--     only when they decide to, and can remove it at any time.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Worker availability location (coarse, owner-managed)
-- ---------------------------------------------------------------------------
create type public.location_source as enum ('device', 'manual');

create table public.worker_locations (
  worker_id  uuid primary key default auth.uid() references public.worker_profiles (id) on delete cascade,
  lat        numeric(8, 5) not null,
  lng        numeric(8, 5) not null,
  source     public.location_source not null,
  updated_at timestamptz not null default now(),

  -- Santa Cruz de la Sierra metropolitan area (incl. Warnes, Cotoca, La Guardia, Urubo).
  constraint worker_locations_service_area check (lat between -18.30 and -17.20 and lng between -63.70 and -62.70)
);

comment on table public.worker_locations is 'Coarse (~550 m grid) location a worker chooses to share to appear in searches. Never exact. Owner-only.';

create index worker_locations_lat_lng_idx on public.worker_locations (lat, lng);

-- Snap to the grid on every write: the exact point never reaches the table.
create or replace function public.coarsen_worker_location()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.lat := round(new.lat / 0.005) * 0.005;
  new.lng := round(new.lng / 0.005) * 0.005;
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.coarsen_worker_location() from public, anon, authenticated;

create trigger worker_locations_coarsen
  before insert or update on public.worker_locations
  for each row execute function public.coarsen_worker_location();

alter table public.worker_locations enable row level security;
revoke all on public.worker_locations from anon, authenticated;
grant select, delete on public.worker_locations to authenticated;
grant insert (worker_id, lat, lng, source) on public.worker_locations to authenticated;
-- worker_id is included only so PostgREST upserts work; RLS (with check
-- auth.uid() = worker_id) prevents writing a row for anybody else.
grant update (worker_id, lat, lng, source) on public.worker_locations to authenticated;

create policy "worker_locations: owner can read"
  on public.worker_locations for select
  to authenticated
  using ((select auth.uid()) = worker_id);

create policy "worker_locations: owner can add"
  on public.worker_locations for insert
  to authenticated
  with check ((select auth.uid()) = worker_id);

create policy "worker_locations: owner can update"
  on public.worker_locations for update
  to authenticated
  using ((select auth.uid()) = worker_id)
  with check ((select auth.uid()) = worker_id);

create policy "worker_locations: owner can remove"
  on public.worker_locations for delete
  to authenticated
  using ((select auth.uid()) = worker_id);

-- ---------------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------------
-- Lowercase + strip Spanish accents so "plomeria" matches "PlomerÃ­a".
create or replace function public.search_normalize(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select translate(lower(coalesce(p_text, '')), 'Ã¡Ã Ã¤Ã¢Ã©Ã¨Ã«ÃªÃ­Ã¬Ã¯Ã®Ã³Ã²Ã¶Ã´ÃºÃ¹Ã¼Ã»Ã±Ã§', 'aaaaeeeeiiiioooouuuunc');
$$;

-- Public point = grid cell + fixed per-worker offset (max +/- 0.002 deg).
create or replace function public.public_worker_point(p_worker uuid, p_lat numeric, p_lng numeric, out lat double precision, out lng double precision)
language sql
immutable
set search_path = ''
as $$
  select round((p_lat::double precision + (get_byte(decode(md5(p_worker::text), 'hex'), 0) / 255.0 - 0.5) * 0.004)::numeric, 5)::double precision,
         round((p_lng::double precision + (get_byte(decode(md5(p_worker::text), 'hex'), 1) / 255.0 - 0.5) * 0.004)::numeric, 5)::double precision;
$$;

-- Great-circle distance in km.
create or replace function public.haversine_km(p_lat1 double precision, p_lng1 double precision, p_lat2 double precision, p_lng2 double precision)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select 2 * 6371 * asin(sqrt(
    power(sin(radians(p_lat2 - p_lat1) / 2), 2)
    + cos(radians(p_lat1)) * cos(radians(p_lat2)) * power(sin(radians(p_lng2 - p_lng1) / 2), 2)
  ));
$$;

revoke execute on function public.public_worker_point(uuid, numeric, numeric) from public, anon;
revoke execute on function public.haversine_km(double precision, double precision, double precision, double precision) from public, anon;
revoke execute on function public.search_normalize(text) from public, anon;
grant execute on function public.search_normalize(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. search_workers(): available workers near the client (CLIENTS ONLY)
--    Returns only public columns. Last name is reduced to its initial.
-- ---------------------------------------------------------------------------
create or replace function public.search_workers(
  p_query       text default null,
  p_category_id text default null,
  p_lat         double precision default null,
  p_lng         double precision default null,
  p_radius_km   double precision default 15,
  p_limit       integer default 50,
  -- false = only 'available'; true = also 'busy'. 'offline' is never returned.
  p_include_busy boolean default false
)
returns table (
  id                  uuid,
  first_name          text,
  last_initial        text,
  avatar_url          text,
  profession          text,
  experience_years    smallint,
  availability_status public.availability_status,
  is_verified         boolean,
  category_ids        text[],
  pricing_mode        public.pricing_mode,
  base_rate_bob       numeric,
  zone_name           text,
  approx_lat          double precision,
  approx_lng          double precision,
  distance_km         double precision
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := auth.uid();
  v_has_origin boolean := p_lat is not null and p_lng is not null;
  v_radius     double precision := least(greatest(coalesce(p_radius_km, 15), 1), 50);
  v_limit      integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_query      text := nullif(btrim(left(public.search_normalize(p_query), 60)), '');
  v_pattern    text;
  v_dlat       double precision;
  v_dlng       double precision;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_uid and p.account_type = 'client') then
    raise exception 'client_only' using errcode = '42501';
  end if;
  if v_has_origin and (p_lat not between -90 and 90 or p_lng not between -180 and 180) then
    raise exception 'invalid_location' using errcode = '22023';
  end if;

  if v_query is not null then
    -- Escape LIKE wildcards typed by the user.
    v_pattern := '%' || replace(replace(replace(v_query, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;
  if v_has_origin then
    v_dlat := v_radius / 111.0;
    v_dlng := v_radius / (111.0 * greatest(cos(radians(p_lat)), 0.01));
  end if;

  return query
  select r.id, r.first_name, r.last_initial, r.avatar_url, r.profession, r.experience_years,
         r.availability_status, r.is_verified, r.category_ids, r.pricing_mode, r.base_rate_bob,
         r.zone_name, r.approx_lat, r.approx_lng, r.distance_km
    from (
      select w.id,
             p.first_name,
             nullif(left(btrim(p.last_name), 1), '') || '.' as last_initial,
             p.avatar_url,
             w.profession,
             w.description,
             w.experience_years,
             w.availability_status,
             (w.verification_status = 'verified') as is_verified,
             cats.ids as category_ids,
             cats.search_text,
             w.pricing_mode,
             w.base_rate_bob,
             w.service_radius_km,
             z.name as zone_name,
             pt.lat as approx_lat,
             pt.lng as approx_lng,
             case when v_has_origin
                  then round(public.haversine_km(p_lat, p_lng, pt.lat, pt.lng)::numeric, 1)::double precision
             end as distance_km
        from public.worker_profiles w
        join public.profiles p on p.id = w.id and p.account_type = 'worker'
        join public.worker_locations l on l.worker_id = w.id
        left join public.service_zones z on z.id = w.service_zone_id
        cross join lateral public.public_worker_point(w.id, l.lat, l.lng) pt
        cross join lateral (
          select array_agg(wc.category_id order by wc.category_id) as ids,
                 string_agg(public.search_normalize(c.name), ' ') as search_text
            from public.worker_categories wc
            join public.categories c on c.id = wc.category_id and c.is_active
           where wc.worker_id = w.id
        ) cats
       where (w.availability_status = 'available'
              or (coalesce(p_include_busy, false) and w.availability_status = 'busy'))
         and w.verification_status <> 'rejected'
         and w.profession is not null
         and w.description is not null
         and w.experience_years is not null
         and cats.ids is not null
         and (p_category_id is null or p_category_id = any (cats.ids))
         -- Index-friendly bounding box before the exact distance.
         and (not v_has_origin
              or (l.lat between p_lat - v_dlat - 0.01 and p_lat + v_dlat + 0.01
                  and l.lng between p_lng - v_dlng - 0.01 and p_lng + v_dlng + 0.01))
    ) r
   where (v_pattern is null
          or public.search_normalize(r.profession) like v_pattern
          or public.search_normalize(r.description) like v_pattern
          or r.search_text like v_pattern)
     -- Within the client's search radius AND the worker's own service radius.
     and (not v_has_origin or (r.distance_km <= v_radius and r.distance_km <= r.service_radius_km + 0.5))
   order by case when v_has_origin then r.distance_km end asc nulls last,
            r.is_verified desc,
            r.first_name
   limit v_limit;
end;
$$;

revoke execute on function public.search_workers(text, text, double precision, double precision, double precision, integer, boolean) from public, anon;
grant execute on function public.search_workers(text, text, double precision, double precision, double precision, integer, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. get_public_worker(): public profile of ONE worker.
--    Clients can open any complete, non-rejected worker; a worker can preview
--    only their own public profile. The point/distance are returned only while
--    the worker is available and sharing a location.
-- ---------------------------------------------------------------------------
create or replace function public.get_public_worker(
  p_worker_id uuid,
  p_lat       double precision default null,
  p_lng       double precision default null
)
returns table (
  id                  uuid,
  first_name          text,
  last_initial        text,
  avatar_url          text,
  profession          text,
  description         text,
  experience_years    smallint,
  service_radius_km   smallint,
  availability_status public.availability_status,
  is_verified         boolean,
  category_ids        text[],
  pricing_mode        public.pricing_mode,
  base_rate_bob       numeric,
  zone_name           text,
  approx_lat          double precision,
  approx_lng          double precision,
  distance_km         double precision
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if v_uid <> p_worker_id
     and not exists (select 1 from public.profiles p where p.id = v_uid and p.account_type = 'client') then
    raise exception 'client_only' using errcode = '42501';
  end if;

  return query
  select w.id,
         p.first_name,
         nullif(left(btrim(p.last_name), 1), '') || '.',
         p.avatar_url,
         w.profession,
         w.description,
         w.experience_years,
         w.service_radius_km,
         w.availability_status,
         (w.verification_status = 'verified'),
         coalesce((select array_agg(wc.category_id order by wc.category_id)
                     from public.worker_categories wc
                     join public.categories c on c.id = wc.category_id and c.is_active
                    where wc.worker_id = w.id), '{}'),
         w.pricing_mode,
         w.base_rate_bob,
         z.name,
         case when shown.visible then pt.lat end,
         case when shown.visible then pt.lng end,
         case when shown.visible and p_lat is not null and p_lng is not null
              then round(public.haversine_km(p_lat, p_lng, pt.lat, pt.lng)::numeric, 1)::double precision
         end
    from public.worker_profiles w
    join public.profiles p on p.id = w.id and p.account_type = 'worker'
    left join public.service_zones z on z.id = w.service_zone_id
    left join public.worker_locations l on l.worker_id = w.id
    left join lateral public.public_worker_point(w.id, l.lat, l.lng) pt on l.worker_id is not null
    cross join lateral (select (l.worker_id is not null and w.availability_status in ('available', 'busy')) as visible) shown
   where w.id = p_worker_id
     and w.verification_status <> 'rejected'
     and w.profession is not null
     and w.description is not null
     and w.experience_years is not null;
end;
$$;

revoke execute on function public.get_public_worker(uuid, double precision, double precision) from public, anon;
grant execute on function public.get_public_worker(uuid, double precision, double precision) to authenticated;

