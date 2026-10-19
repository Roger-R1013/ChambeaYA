-- =============================================================================
-- ChambeaYA! - Migration 0001: core schema
-- Profiles (clients/workers), professional worker profiles and categories.
-- Security (RLS, grants, RPCs) lives in migration 0002.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Controlled value sets
-- ---------------------------------------------------------------------------
create type public.account_type as enum ('client', 'worker');

-- Review state of a worker's identity. Never writable by end users.
create type public.verification_status as enum ('unverified', 'pending', 'verified', 'rejected');

-- available = can take jobs now, busy = temporarily occupied, offline = not available.
-- Values match the existing frontend type `WorkerAvailability`.
create type public.availability_status as enum ('available', 'busy', 'offline');

-- ---------------------------------------------------------------------------
-- Shared trigger: keeps updated_at current
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user (private data, owner-only access)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  first_name   text not null,
  last_name    text not null default '',
  full_name    text generated always as (btrim(first_name || ' ' || last_name)) stored,
  phone        text,
  avatar_url   text,
  -- NULL only for accounts that have not chosen a type yet (e.g. created without metadata).
  account_type public.account_type,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint profiles_first_name_length check (char_length(btrim(first_name)) between 1 and 60),
  constraint profiles_last_name_length  check (char_length(last_name) <= 60),
  -- Bolivian mobile: 8 digits starting with 6 or 7, optional 591 prefix (same rule as the frontend).
  constraint profiles_phone_format      check (phone is null or phone ~ '^(\+?591)?[67][0-9]{7}$'),
  constraint profiles_avatar_url_length check (avatar_url is null or char_length(avatar_url) <= 2048)
);

comment on table public.profiles is 'Private account profile. Readable/editable only by its owner (see RLS).';
comment on column public.profiles.account_type is 'Set once at sign-up; immutable from the client.';

create index profiles_account_type_idx on public.profiles (account_type);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- worker_profiles: professional data, only for account_type = 'worker'
-- ---------------------------------------------------------------------------
create table public.worker_profiles (
  id                  uuid primary key references public.profiles (id) on delete cascade,
  profession          text,
  description         text,
  experience_years    smallint,
  service_radius_km   smallint not null default 10,
  verification_status public.verification_status not null default 'unverified',
  availability_status public.availability_status not null default 'offline',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint worker_profiles_profession_length  check (profession is null or char_length(btrim(profession)) between 2 and 80),
  constraint worker_profiles_description_length check (description is null or char_length(btrim(description)) between 30 and 1000),
  constraint worker_profiles_experience_range   check (experience_years is null or experience_years between 0 and 60),
  constraint worker_profiles_radius_range       check (service_radius_km between 1 and 50)
);

comment on table public.worker_profiles is 'Professional profile of a worker. verification_status is controlled by the review process only.';

create index worker_profiles_directory_idx on public.worker_profiles (availability_status, verification_status);

create trigger worker_profiles_set_updated_at
  before update on public.worker_profiles
  for each row execute function public.set_updated_at();

-- A worker profile may only exist for a profile whose account_type is 'worker'.
create or replace function public.ensure_worker_account()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p where p.id = new.id and p.account_type = 'worker'
  ) then
    raise exception 'worker_profiles requires a profile with account_type = worker'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger worker_profiles_ensure_worker_account
  before insert on public.worker_profiles
  for each row execute function public.ensure_worker_account();

-- ---------------------------------------------------------------------------
-- categories: catalogue of trades/professions (reference data)
-- ---------------------------------------------------------------------------
create table public.categories (
  id          text primary key,
  name        text not null unique,
  description text not null default '',
  sort_order  smallint not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),

  constraint categories_id_format   check (id ~ '^[a-z][a-z0-9_-]{1,39}$'),
  constraint categories_name_length check (char_length(btrim(name)) between 2 and 60)
);

comment on table public.categories is 'Public catalogue of service categories. Managed by administrators only.';

-- ---------------------------------------------------------------------------
-- worker_categories: N:M between workers and categories
-- ---------------------------------------------------------------------------
create table public.worker_categories (
  worker_id   uuid not null references public.worker_profiles (id) on delete cascade,
  category_id text not null references public.categories (id) on update cascade on delete restrict,
  created_at  timestamptz not null default now(),
  primary key (worker_id, category_id)
);

create index worker_categories_category_id_idx on public.worker_categories (category_id);

-- Max 5 categories per worker (enforced in the database, not only in React).
create or replace function public.enforce_worker_category_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.worker_categories wc where wc.worker_id = new.worker_id) >= 5 then
    raise exception 'category_limit_reached' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger worker_categories_enforce_limit
  before insert on public.worker_categories
  for each row execute function public.enforce_worker_category_limit();

-- ---------------------------------------------------------------------------
-- Profile bootstrap on sign-up
-- Reads the sign-up metadata ONCE. Metadata is user-controlled, so every value
-- is sanitised and only 'client' / 'worker' are accepted as account types.
-- After creation, profiles.account_type (not user metadata) is authoritative.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta    jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_first text  := left(btrim(coalesce(meta ->> 'first_name', '')), 60);
  v_last  text  := left(btrim(coalesce(meta ->> 'last_name', '')), 60);
  v_phone text  := regexp_replace(coalesce(meta ->> 'phone', ''), '[\s-]', '', 'g');
  v_type  public.account_type;
begin
  if v_first = '' then
    v_first := left(split_part(coalesce(new.email, ''), '@', 1), 60);
  end if;
  if v_first = '' then
    v_first := 'Usuario';
  end if;

  if v_phone !~ '^(\+?591)?[67][0-9]{7}$' then
    v_phone := null;
  end if;

  if (meta ->> 'account_type') in ('client', 'worker') then
    v_type := (meta ->> 'account_type')::public.account_type;
  end if;

  insert into public.profiles (id, first_name, last_name, phone, account_type)
  values (new.id, v_first, v_last, v_phone, v_type);

  if v_type = 'worker' then
    insert into public.worker_profiles (id) values (new.id);
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
