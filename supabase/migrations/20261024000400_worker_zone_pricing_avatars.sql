-- =============================================================================
-- ChambeaYA! - Migration 0004: worker zone, pricing and public profile photo
--
-- STATUS: DRAFT - NOT APPLIED. Review before running it in the SQL Editor.
-- Additive and non-destructive: no table, column, row or policy is removed.
--
--   1. service_zones   -> reference catalogue of work zones in Santa Cruz.
--                          Workers pick a ZONE, never an exact address.
--   2. worker_profiles -> service_zone_id, pricing_mode, base_rate_bob.
--   3. Storage bucket "avatars" (PUBLIC images only, never documents) and
--      owner-only write policies (folder = auth.uid()).
--   4. profiles.avatar_url becomes editable ONLY with a URL that points to an
--      object the user owns in the "avatars" bucket.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Work zones (reference data, managed by administrators)
-- ---------------------------------------------------------------------------
create table public.service_zones (
  id         text primary key,
  name       text not null unique,
  sort_order smallint not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),

  constraint service_zones_id_format   check (id ~ '^[a-z][a-z0-9_]{1,39}$'),
  constraint service_zones_name_length check (char_length(btrim(name)) between 2 and 60)
);

comment on table public.service_zones is 'Public catalogue of work zones (Santa Cruz). Workers choose a zone, never an exact address.';

alter table public.service_zones enable row level security;
revoke all on public.service_zones from anon, authenticated;
grant select on public.service_zones to anon, authenticated;

create policy "service_zones: anyone can read active"
  on public.service_zones for select
  to anon, authenticated
  using (is_active);

-- Initial list: PLEASE REVIEW names/coverage before applying (idempotent).
insert into public.service_zones (id, name, sort_order) values
  ('centro',                'Centro (casco viejo)', 10),
  ('equipetrol',            'Equipetrol',           20),
  ('norte',                 'Zona Norte',           30),
  ('noreste',               'Zona Noreste',         40),
  ('noroeste',              'Zona Noroeste',        50),
  ('este',                  'Zona Este',            60),
  ('sureste',               'Zona Sureste',         70),
  ('sur',                   'Zona Sur',             80),
  ('suroeste',              'Zona Suroeste',        90),
  ('oeste',                 'Zona Oeste',          100),
  ('plan_tres_mil',         'Plan Tres Mil',       110),
  ('villa_primero_de_mayo', 'Villa 1ro de Mayo',   120),
  ('pampa_de_la_isla',      'Pampa de la Isla',    130),
  ('urubo',                 'Urubó',               140),
  ('warnes',                'Warnes',              150),
  ('la_guardia',            'La Guardia',          160),
  ('cotoca',                'Cotoca',              170)
on conflict (id) do update
  set name = excluded.name,
      sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- 2. Professional details on worker_profiles
-- ---------------------------------------------------------------------------
-- per_hour = tarifa por hora, per_job = precio por trabajo, quote = a cotizar.
create type public.pricing_mode as enum ('per_hour', 'per_job', 'quote');

alter table public.worker_profiles
  add column service_zone_id text references public.service_zones (id) on update cascade on delete restrict,
  add column pricing_mode    public.pricing_mode,
  -- Optional reference rate ("desde"), in bolivianos. Not used with 'quote'.
  add column base_rate_bob   numeric(10, 2);

alter table public.worker_profiles
  add constraint worker_profiles_base_rate_range
    check (base_rate_bob is null or base_rate_bob between 1 and 100000),
  add constraint worker_profiles_rate_requires_priced_mode
    check (base_rate_bob is null or pricing_mode in ('per_hour', 'per_job'));

create index worker_profiles_service_zone_idx on public.worker_profiles (service_zone_id);

-- Same least-privilege model as 0002: only these new columns become editable.
grant update (service_zone_id, pricing_mode, base_rate_bob) on public.worker_profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Storage: public profile photos
--    Path convention: avatars/<auth.uid()>/<file>. Public read via public URL
--    (bucket is public); writes restricted to the owner's own folder.
--    5 MB max, images only. NEVER store identity documents here.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "avatars: owner can read own folder"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars: owner can upload to own folder"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars: owner can replace own files"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars: owner can delete own files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- 4. profiles.avatar_url: editable, but only pointing to the caller's own file
--    in the public "avatars" bucket (no arbitrary external URLs, no Base64).
--    Replaces protect_profile_fields() keeping ALL previous checks.
-- ---------------------------------------------------------------------------
grant update (avatar_url) on public.profiles to authenticated;

create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_object text;
begin
  if current_user in ('anon', 'authenticated') then
    if new.id is distinct from old.id then
      raise exception 'id cannot be changed' using errcode = '42501';
    end if;
    if new.account_type is distinct from old.account_type then
      raise exception 'account_type cannot be changed' using errcode = '42501';
    end if;

    if new.avatar_url is distinct from old.avatar_url and new.avatar_url is not null then
      -- Expected: https://<project-ref>.supabase.co/storage/v1/object/public/avatars/<uid>/<file>
      -- The host is pinned to Supabase (H1): external domains could track viewers.
      -- If a custom domain is configured later, add it to this pattern.
      v_object := substring(new.avatar_url from '^https://[a-z0-9]{20}\.supabase\.co/storage/v1/object/public/avatars/([^?#]+)$');
      if v_object is null
         or split_part(v_object, '/', 1) <> old.id::text
         or not exists (
           select 1 from storage.objects o
            where o.bucket_id = 'avatars' and o.name = v_object
         ) then
        raise exception 'invalid_avatar_url' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;
