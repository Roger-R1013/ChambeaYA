-- =============================================================================
-- ChambeaYA! - Migration 0005: certificates and identity documents (PRIVATE)
--
-- STATUS: DRAFT - NOT APPLIED. Contains security decisions that need explicit
-- approval (see "DECISIONS" below). Additive and non-destructive.
--
-- Principles:
--   * Private buckets only: no public URLs for certificates or identity
--     documents. Files are read with short-lived signed URLs by the owner, or
--     by reviewers through service_role / the Supabase Dashboard.
--   * Nothing in Base64 inside tables: tables store only the storage path.
--   * A worker can NEVER set verification_status to 'verified' or 'rejected'.
--     The only transition a worker can trigger is unverified/rejected ->
--     pending, and only after uploading the three required images.
--   * No automatic identity check is performed or claimed. Face match,
--     liveness and document validation require a specialised provider.
--
-- DECISIONS (APPROVED 2026-11-02):
--   D1. Reviewers = service_role / Dashboard only (no in-app reviewer role yet).
--   D2. submit_identity_verification() lets a worker move unverified/rejected
--       -> pending, only if the three images exist in the table AND in Storage.
--       Direct UPDATE of the column stays forbidden.
--   D3. Retention and secure deletion: see migration 0006 + Edge Function
--       purge-identity-documents.
--
-- SECURITY FIXES (review 2026-11-02):
--   H2. identity_documents_editable() takes no argument (no probing of other users).
--   H3. The submit RPC checks that the files really exist in Storage.
--   H4. Rows can only point to an existing object in the matching bucket.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Private buckets
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('worker-certificates', 'worker-certificates', false, 5242880,
     array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
  ('identity-documents',  'identity-documents',  false, 5242880,
     array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Certificates / licences
-- ---------------------------------------------------------------------------
create table public.worker_certificates (
  id            uuid primary key default gen_random_uuid(),
  worker_id     uuid not null default auth.uid() references public.worker_profiles (id) on delete cascade,
  title         text not null,
  issuer        text,
  issued_on     date,
  storage_path  text not null unique,
  review_status public.verification_status not null default 'pending',
  created_at    timestamptz not null default now(),

  constraint worker_certificates_title_length  check (char_length(btrim(title)) between 3 and 120),
  constraint worker_certificates_issuer_length check (issuer is null or char_length(btrim(issuer)) <= 120),
  constraint worker_certificates_issued_past   check (issued_on is null or issued_on <= current_date),
  constraint worker_certificates_path_owner    check (split_part(storage_path, '/', 1) = worker_id::text)
);

comment on table public.worker_certificates is 'Worker certificates/licences. Files live in the PRIVATE bucket worker-certificates. review_status is set by reviewers only.';

create index worker_certificates_worker_idx on public.worker_certificates (worker_id);

alter table public.worker_certificates enable row level security;
revoke all on public.worker_certificates from anon, authenticated;
grant select, delete on public.worker_certificates to authenticated;
-- review_status / id / created_at are NOT insertable by users.
grant insert (worker_id, title, issuer, issued_on, storage_path) on public.worker_certificates to authenticated;

create policy "worker_certificates: owner can read"
  on public.worker_certificates for select
  to authenticated
  using ((select auth.uid()) = worker_id);

create policy "worker_certificates: owner can add"
  on public.worker_certificates for insert
  to authenticated
  with check (
    (select auth.uid()) = worker_id
    -- H4: the file must already exist in the certificates bucket (own folder via Storage RLS).
    and exists (
      select 1 from storage.objects o
       where o.bucket_id = 'worker-certificates' and o.name = storage_path
    )
  );

create policy "worker_certificates: owner can remove"
  on public.worker_certificates for delete
  to authenticated
  using ((select auth.uid()) = worker_id);

-- Max 10 certificates per worker (database-enforced).
create or replace function public.enforce_worker_certificate_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.worker_certificates c where c.worker_id = new.worker_id) >= 10 then
    raise exception 'certificate_limit_reached' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger worker_certificates_enforce_limit
  before insert on public.worker_certificates
  for each row execute function public.enforce_worker_certificate_limit();

-- Storage policies: owner-only, own folder (<uid>/...). No anon access at all.
create policy "worker-certificates: owner can read own files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'worker-certificates' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "worker-certificates: worker can upload to own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'worker-certificates'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.worker_profiles w where w.id = (select auth.uid()))
  );

create policy "worker-certificates: owner can delete own files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'worker-certificates' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- 3. Identity documents (ID front, ID back, selfie)
-- ---------------------------------------------------------------------------
create type public.identity_document_kind as enum ('id_front', 'id_back', 'selfie');

create table public.identity_documents (
  worker_id    uuid not null default auth.uid() references public.worker_profiles (id) on delete cascade,
  kind         public.identity_document_kind not null,
  storage_path text not null unique,
  created_at   timestamptz not null default now(),
  primary key (worker_id, kind),

  constraint identity_documents_path_owner check (split_part(storage_path, '/', 1) = worker_id::text)
);

comment on table public.identity_documents is 'Pointers to PRIVATE identity images (bucket identity-documents). Never public, never Base64.';

alter table public.identity_documents enable row level security;
revoke all on public.identity_documents from anon, authenticated;
grant select, delete on public.identity_documents to authenticated;
grant insert (worker_id, kind, storage_path) on public.identity_documents to authenticated;

-- Helper: documents are editable only while the CALLER is not under review/verified.
-- H2: no parameter, always auth.uid(), so it cannot be used to probe other users.
create or replace function public.identity_documents_editable()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.worker_profiles w
     where w.id = (select auth.uid()) and w.verification_status in ('unverified', 'rejected')
  );
$$;

revoke execute on function public.identity_documents_editable() from public, anon;
grant execute on function public.identity_documents_editable() to authenticated;

create policy "identity_documents: owner can read"
  on public.identity_documents for select
  to authenticated
  using ((select auth.uid()) = worker_id);

create policy "identity_documents: owner can add while editable"
  on public.identity_documents for insert
  to authenticated
  with check (
    (select auth.uid()) = worker_id
    and public.identity_documents_editable()
    -- H4: the file must already exist in the identity bucket.
    and exists (
      select 1 from storage.objects o
       where o.bucket_id = 'identity-documents' and o.name = storage_path
    )
  );

create policy "identity_documents: owner can remove while editable"
  on public.identity_documents for delete
  to authenticated
  using ((select auth.uid()) = worker_id and public.identity_documents_editable());

-- Storage policies for the private bucket.
create policy "identity-documents: owner can read own files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'identity-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "identity-documents: worker can upload while editable"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'identity-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.identity_documents_editable()
  );

create policy "identity-documents: worker can delete while editable"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'identity-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.identity_documents_editable()
  );

-- ---------------------------------------------------------------------------
-- 4. RPC: submit for MANUAL review (decision D2). Never sets 'verified'.
-- ---------------------------------------------------------------------------
create or replace function public.submit_identity_verification()
returns public.verification_status
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

  -- H3: the three kinds must exist in the table AND the files in Storage.
  if (
    select count(distinct d.kind)
      from public.identity_documents d
      join storage.objects o on o.bucket_id = 'identity-documents' and o.name = d.storage_path
     where d.worker_id = v_uid
  ) < 3 then
    raise exception 'identity_documents_incomplete' using errcode = '22023';
  end if;

  update public.worker_profiles
     set verification_status = 'pending'
   where id = v_uid
     and verification_status in ('unverified', 'rejected');

  if not found then
    if exists (select 1 from public.worker_profiles where id = v_uid) then
      raise exception 'verification_not_editable' using errcode = 'P0001';
    end if;
    raise exception 'worker_profile_not_found' using errcode = 'P0002';
  end if;

  return 'pending';
end;
$$;

revoke execute on function public.submit_identity_verification() from public, anon;
grant execute on function public.submit_identity_verification() to authenticated;
