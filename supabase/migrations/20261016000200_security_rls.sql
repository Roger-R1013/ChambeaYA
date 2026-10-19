-- =============================================================================
-- ChambeaYA! - Migration 0002: security
-- Row Level Security, column-level privileges, protected fields and RPCs.
--
-- Model:
--   * anon           -> can only read the public category catalogue.
--   * authenticated  -> reads/edits ONLY its own rows; restricted columns.
--   * service_role / SQL editor (postgres) -> administrative review process.
-- There is no "admin" account_type: users cannot grant themselves privileges.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enable RLS on every table exposed through the Data API
-- ---------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.worker_profiles   enable row level security;
alter table public.categories        enable row level security;
alter table public.worker_categories enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Privileges (least privilege). Supabase grants ALL to anon/authenticated
--    by default; we revoke and grant only what each role needs.
-- ---------------------------------------------------------------------------
revoke all on public.profiles          from anon, authenticated;
revoke all on public.worker_profiles   from anon, authenticated;
revoke all on public.categories        from anon, authenticated;
revoke all on public.worker_categories from anon, authenticated;

-- profiles: no INSERT (created by trigger), no DELETE (account deletion is an admin flow).
-- Editable columns only. account_type, avatar_url, id and timestamps are NOT editable.
grant select on public.profiles to authenticated;
grant update (first_name, last_name, phone) on public.profiles to authenticated;

-- worker_profiles: verification_status is NOT editable by users.
grant select on public.worker_profiles to authenticated;
grant update (profession, description, experience_years, service_radius_km, availability_status)
  on public.worker_profiles to authenticated;

grant select on public.categories to anon, authenticated;

grant select, insert, delete on public.worker_categories to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Policies
--    (select auth.uid()) is wrapped so Postgres evaluates it once per query.
-- ---------------------------------------------------------------------------

-- profiles ------------------------------------------------------------------
create policy "profiles: owner can read"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles: owner can update"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- worker_profiles -----------------------------------------------------------
create policy "worker_profiles: owner can read"
  on public.worker_profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "worker_profiles: owner can update"
  on public.worker_profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- categories ----------------------------------------------------------------
create policy "categories: anyone can read active"
  on public.categories for select
  to anon, authenticated
  using (is_active);

-- worker_categories ---------------------------------------------------------
create policy "worker_categories: owner can read"
  on public.worker_categories for select
  to authenticated
  using ((select auth.uid()) = worker_id);

create policy "worker_categories: owner can add active categories"
  on public.worker_categories for insert
  to authenticated
  with check (
    (select auth.uid()) = worker_id
    and exists (select 1 from public.categories c where c.id = category_id and c.is_active)
  );

create policy "worker_categories: owner can remove"
  on public.worker_categories for delete
  to authenticated
  using ((select auth.uid()) = worker_id);

-- ---------------------------------------------------------------------------
-- 4. Defence in depth: protected fields cannot change through the Data API
--    even if a future migration grants broader column privileges by mistake.
--    SECURITY DEFINER functions run as their owner, so they are not affected.
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.id is distinct from old.id then
      raise exception 'id cannot be changed' using errcode = '42501';
    end if;
    if new.account_type is distinct from old.account_type then
      raise exception 'account_type cannot be changed' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_fields
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

create or replace function public.protect_worker_profile_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.id is distinct from old.id then
      raise exception 'id cannot be changed' using errcode = '42501';
    end if;
    if new.verification_status is distinct from old.verification_status then
      raise exception 'verification_status is managed by the review process' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger worker_profiles_protect_fields
  before update on public.worker_profiles
  for each row execute function public.protect_worker_profile_fields();

-- ---------------------------------------------------------------------------
-- 5. RPC: choose account type ONCE (only while it is still NULL)
-- ---------------------------------------------------------------------------
create or replace function public.set_account_type(p_account_type public.account_type)
returns public.account_type
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  update public.profiles
     set account_type = p_account_type
   where id = v_uid
     and account_type is null;

  if not found then
    if exists (select 1 from public.profiles where id = v_uid) then
      raise exception 'account_type_already_set' using errcode = 'P0001';
    end if;
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;

  if p_account_type = 'worker' then
    insert into public.worker_profiles (id) values (v_uid)
    on conflict (id) do nothing;
  end if;

  return p_account_type;
end;
$$;

revoke execute on function public.set_account_type(public.account_type) from public, anon;
grant execute on function public.set_account_type(public.account_type) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. RPC: replace the caller's categories atomically (SECURITY INVOKER -> RLS applies)
-- ---------------------------------------------------------------------------
create or replace function public.set_worker_categories(p_category_ids text[])
returns setof text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ids text[];
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select coalesce(array_agg(distinct x), '{}')
    into v_ids
    from unnest(coalesce(p_category_ids, '{}')) as x;

  if cardinality(v_ids) < 1 or cardinality(v_ids) > 5 then
    raise exception 'invalid_category_count' using errcode = '22023';
  end if;

  if not exists (select 1 from public.worker_profiles where id = v_uid) then
    raise exception 'worker_profile_not_found' using errcode = 'P0002';
  end if;

  delete from public.worker_categories
   where worker_id = v_uid
     and category_id <> all (v_ids);

  insert into public.worker_categories (worker_id, category_id)
  select v_uid, c from unnest(v_ids) as c
  on conflict do nothing;

  return query
    select wc.category_id from public.worker_categories wc
     where wc.worker_id = v_uid
     order by wc.category_id;
end;
$$;

revoke execute on function public.set_worker_categories(text[]) from public, anon;
grant execute on function public.set_worker_categories(text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. RPC: public worker directory (safe columns only)
--    profiles stays owner-only; this function exposes exactly the data needed
--    to find and evaluate a service. No phone, no email, no timestamps.
--    Only complete, non-rejected worker profiles are listed.
-- ---------------------------------------------------------------------------
create or replace function public.get_public_workers(p_category_id text default null)
returns table (
  id                  uuid,
  first_name          text,
  last_name           text,
  avatar_url          text,
  profession          text,
  description         text,
  experience_years    smallint,
  service_radius_km   smallint,
  verification_status public.verification_status,
  availability_status public.availability_status,
  category_ids        text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.first_name, p.last_name, p.avatar_url,
         w.profession, w.description, w.experience_years, w.service_radius_km,
         w.verification_status, w.availability_status,
         array_agg(wc.category_id order by wc.category_id) as category_ids
    from public.worker_profiles w
    join public.profiles p on p.id = w.id and p.account_type = 'worker'
    join public.worker_categories wc on wc.worker_id = w.id
   where w.profession is not null
     and w.description is not null
     and w.experience_years is not null
     and w.verification_status <> 'rejected'
   group by p.id, w.id
  having p_category_id is null or bool_or(wc.category_id = p_category_id)
   order by min(case w.availability_status when 'available' then 0 when 'busy' then 1 else 2 end), p.first_name;
$$;

revoke execute on function public.get_public_workers(text) from public, anon;
grant execute on function public.get_public_workers(text) to authenticated;
