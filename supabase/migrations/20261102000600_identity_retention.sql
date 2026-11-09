-- =============================================================================
-- ChambeaYA! - Migration 0006: identity document retention and audit (D3)
--
-- STATUS: DRAFT - NOT APPLIED. Requires 0004 and 0005. Additive and
-- non-destructive: it only adds columns, a table, triggers and functions.
--
-- Retention policy (approved 2026-11-02):
--   * verified  -> identity images deleted 30 days after the review.
--   * rejected  -> deleted 60 days after the last activity (review or upload)
--                  if the worker does not resubmit.
--   * never submitted (unverified) -> deleted 30 days after the last upload.
--   * pending   -> never deleted while under review.
--   * orphan files in the private buckets (no table row, e.g. deleted
--     accounts or interrupted uploads) -> deleted after 24 hours.
-- After deletion only a minimal audit trail remains (who / when / result /
-- reviewer note). No images and no storage paths are kept in the audit.
--
-- Files can only be removed through the Storage API (Supabase blocks direct
-- DELETE on storage.objects), so the actual purge is done by the Edge Function
-- supabase/functions/purge-identity-documents, which calls the two
-- service_role-only functions below.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Review metadata on worker_profiles (readable by the owner through the
--    existing owner-only SELECT policy; NOT writable by users: no grant).
-- ---------------------------------------------------------------------------
alter table public.worker_profiles
  add column verification_submitted_at timestamptz,
  add column verification_reviewed_at  timestamptz,
  -- Reviewer note (e.g. rejection reason). Shown only to the owner.
  add column verification_note         text;

alter table public.worker_profiles
  add constraint worker_profiles_verification_note_length
    check (verification_note is null or char_length(verification_note) <= 500);

comment on column public.worker_profiles.verification_note is 'Reviewer note / rejection reason. Set by reviewers (service_role). Visible only to the owner.';

-- ---------------------------------------------------------------------------
-- 2. Audit trail without images
-- ---------------------------------------------------------------------------
create type public.identity_verification_event as enum ('submitted', 'approved', 'rejected', 'reset', 'purged');

create table public.identity_verification_events (
  id         bigint generated always as identity primary key,
  worker_id  uuid not null references public.worker_profiles (id) on delete cascade,
  event      public.identity_verification_event not null,
  note       text,
  created_at timestamptz not null default now(),

  constraint identity_verification_events_note_length check (note is null or char_length(note) <= 500)
);

comment on table public.identity_verification_events is 'Minimal audit of identity reviews. Never stores images or storage paths.';

create index identity_verification_events_worker_idx on public.identity_verification_events (worker_id, created_at desc);

alter table public.identity_verification_events enable row level security;
revoke all on public.identity_verification_events from anon, authenticated;
grant select on public.identity_verification_events to authenticated;

create policy "identity_verification_events: owner can read"
  on public.identity_verification_events for select
  to authenticated
  using ((select auth.uid()) = worker_id);

-- ---------------------------------------------------------------------------
-- 3. Track every verification_status change (RPC submit or reviewer in the
--    Dashboard). Runs after protect_worker_profile_fields (alphabetical
--    trigger order), so users still cannot change the status directly.
-- ---------------------------------------------------------------------------
create or replace function public.track_verification_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.identity_verification_event;
begin
  if new.verification_status is not distinct from old.verification_status then
    return new;
  end if;

  case new.verification_status
    when 'pending' then
      v_event := 'submitted';
      new.verification_submitted_at := now();
      new.verification_reviewed_at := null;
      new.verification_note := null;
    when 'verified' then
      v_event := 'approved';
      new.verification_reviewed_at := now();
    when 'rejected' then
      v_event := 'rejected';
      new.verification_reviewed_at := now();
    else
      v_event := 'reset';
      new.verification_submitted_at := null;
      new.verification_reviewed_at := null;
  end case;

  insert into public.identity_verification_events (worker_id, event, note)
  values (new.id, v_event, case when v_event in ('approved', 'rejected') then new.verification_note end);

  return new;
end;
$$;

revoke execute on function public.track_verification_status() from public, anon, authenticated;

create trigger worker_profiles_track_verification
  before update of verification_status on public.worker_profiles
  for each row execute function public.track_verification_status();

-- ---------------------------------------------------------------------------
-- 4. Purge helpers (service_role ONLY; used by the Edge Function)
-- ---------------------------------------------------------------------------

-- Files that must be deleted now, according to the retention policy.
create or replace function public.storage_objects_due_for_purge()
returns table (bucket_id text, object_name text, reason text)
language sql
stable
security definer
set search_path = ''
as $$
  with activity as (
    select w.id as worker_id,
           w.verification_status,
           w.verification_reviewed_at,
           max(d.created_at) as last_upload_at
      from public.worker_profiles w
      join public.identity_documents d on d.worker_id = w.id
     group by w.id
  ),
  expired_workers as (
    select a.worker_id,
           case a.verification_status
             when 'verified' then 'verified_30d'
             when 'rejected' then 'rejected_60d'
             else 'not_submitted_30d'
           end as reason
      from activity a
     where (a.verification_status = 'verified'
              and a.verification_reviewed_at < now() - interval '30 days')
        or (a.verification_status = 'rejected'
              and greatest(coalesce(a.verification_reviewed_at, a.last_upload_at), a.last_upload_at) < now() - interval '60 days')
        or (a.verification_status = 'unverified'
              and a.last_upload_at < now() - interval '30 days')
  )
  -- Identity images of expired requests.
  select 'identity-documents'::text, d.storage_path, e.reason
    from expired_workers e
    join public.identity_documents d on d.worker_id = e.worker_id
  union all
  -- Orphan identity files (deleted accounts, replaced or interrupted uploads).
  select o.bucket_id, o.name, 'orphan_24h'
    from storage.objects o
   where o.bucket_id = 'identity-documents'
     and o.created_at < now() - interval '24 hours'
     and not exists (select 1 from public.identity_documents d where d.storage_path = o.name)
  union all
  -- Orphan certificate files.
  select o.bucket_id, o.name, 'orphan_24h'
    from storage.objects o
   where o.bucket_id = 'worker-certificates'
     and o.created_at < now() - interval '24 hours'
     and not exists (select 1 from public.worker_certificates c where c.storage_path = o.name);
$$;

revoke execute on function public.storage_objects_due_for_purge() from public, anon, authenticated;
grant execute on function public.storage_objects_due_for_purge() to service_role;

-- Removes the table rows of files that were ALREADY deleted from Storage and
-- records one 'purged' event per affected worker. Rows whose file still exists
-- are left untouched (the Storage removal failed and will be retried).
create or replace function public.finalize_storage_purge(p_bucket text, p_paths text[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
begin
  if p_bucket = 'identity-documents' then
    with removed as (
      delete from public.identity_documents d
       where d.storage_path = any (p_paths)
         and not exists (
           select 1 from storage.objects o where o.bucket_id = p_bucket and o.name = d.storage_path
         )
      returning d.worker_id
    ),
    logged as (
      insert into public.identity_verification_events (worker_id, event)
      select distinct r.worker_id, 'purged'::public.identity_verification_event from removed r
      returning 1
    )
    select count(*) into v_count from removed;
  elsif p_bucket = 'worker-certificates' then
    with removed as (
      delete from public.worker_certificates c
       where c.storage_path = any (p_paths)
         and not exists (
           select 1 from storage.objects o where o.bucket_id = p_bucket and o.name = c.storage_path
         )
      returning 1
    )
    select count(*) into v_count from removed;
  else
    raise exception 'unsupported_bucket' using errcode = '22023';
  end if;

  return v_count;
end;
$$;

revoke execute on function public.finalize_storage_purge(text, text[]) from public, anon, authenticated;
grant execute on function public.finalize_storage_purge(text, text[]) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Daily schedule (OPTIONAL - run separately AFTER enabling pg_cron and
--    pg_net, deploying the Edge Function and storing the secret in Vault).
--    Left commented on purpose: it needs explicit authorization.
-- ---------------------------------------------------------------------------
-- select vault.create_secret('<PURGE_CRON_SECRET>', 'purge_cron_secret');
-- select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--
-- select cron.schedule(
--   'purge-identity-documents-daily',
--   '30 7 * * *',  -- 03:30 Bolivia (UTC-4)
--   $cron$
--     select net.http_post(
--       url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
--                  || '/functions/v1/purge-identity-documents',
--       headers := jsonb_build_object(
--                    'Content-Type', 'application/json',
--                    'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'purge_cron_secret')
--                  ),
--       body    := '{}'::jsonb
--     );
--   $cron$
-- );
