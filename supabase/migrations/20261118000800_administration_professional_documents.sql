-- ChambeaYA! - 0008: professional evidence and manual administration.
-- Apply after 0001-0007. Administrator membership is assigned separately by
-- the project owner. Existing certificates and private objects are retained.
begin;

create type public.professional_document_kind as enum (
  'technical_certificate', 'training_certificate', 'employment_statement',
  'employer_recommendation', 'company_employment_certificate'
);

-- NULL represents documents created before the type was collected.
alter table public.worker_certificates add column document_kind public.professional_document_kind;
grant insert (document_kind) on public.worker_certificates to authenticated;

create table public.administrators (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_at timestamptz not null default now()
);
alter table public.administrators enable row level security;
revoke all on public.administrators from public, anon, authenticated, service_role;

create function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.administrators a where a.user_id = auth.uid());
$$;

create function public.require_admin()
returns uuid
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

-- The audit survives withdrawal of a certificate. It stores no private path.
create table public.professional_document_reviews (
  document_id uuid primary key,
  worker_id uuid not null,
  document_title text not null,
  document_kind public.professional_document_kind,
  reviewer_id uuid not null,
  outcome public.verification_status not null check (outcome in ('verified', 'rejected')),
  note text check (note is null or char_length(note) between 1 and 500),
  reviewed_at timestamptz not null default now(),
  check (outcome <> 'rejected' or note is not null)
);
alter table public.professional_document_reviews enable row level security;
revoke all on public.professional_document_reviews from public, anon, authenticated, service_role;

create index worker_certificates_review_queue_idx
  on public.worker_certificates (review_status, created_at, id);
create index professional_document_reviews_date_idx
  on public.professional_document_reviews (reviewed_at desc, document_id desc);
create index worker_profiles_pending_identity_idx
  on public.worker_profiles (verification_submitted_at, id) where verification_status = 'pending';

-- The application unlinks a document before deleting its object. Keep
-- referenced objects immutable for review; the existing purge uses service_role.
alter policy "worker-certificates: owner can delete own files"
  on storage.objects using (
    bucket_id = 'worker-certificates'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not exists (select 1 from public.worker_certificates c where c.storage_path = objects.name)
  );

alter policy "identity-documents: worker can delete while editable"
  on storage.objects using (
    bucket_id = 'identity-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.identity_documents_editable()
    and not exists (select 1 from public.identity_documents d where d.storage_path = objects.name)
  );

-- Keep the 0006 owner-visible audit and give each submission its own ID.
alter table public.worker_profiles add column verification_request_id uuid not null default gen_random_uuid();
alter table public.identity_verification_events add column reviewer_id uuid;

create or replace function public.track_verification_status()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_event public.identity_verification_event;
begin
  if new.verification_status is not distinct from old.verification_status then return new; end if;

  case new.verification_status
    when 'pending' then
      v_event := 'submitted';
      new.verification_request_id := gen_random_uuid();
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

  insert into public.identity_verification_events (worker_id, event, note, reviewer_id)
  values (
    new.id, v_event,
    case when v_event in ('approved', 'rejected') then new.verification_note end,
    case when v_event in ('approved', 'rejected') and public.is_admin() then auth.uid() end
  );
  return new;
end;
$$;

-- Identity pointer mutations and submission serialize on the worker row.
create function public.lock_editable_identity_document()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_owner uuid;
  v_status public.verification_status;
begin
  v_owner := case when tg_op = 'DELETE' then old.worker_id else new.worker_id end;
  if current_user = 'authenticated' and v_owner = auth.uid() then
    select w.verification_status into v_status
      from public.worker_profiles w where w.id = v_owner for update;
    if v_status is null or v_status not in ('unverified', 'rejected') then
      raise exception 'verification_not_editable' using errcode = 'P0001';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger identity_documents_lock_editable
  before insert or delete on public.identity_documents
  for each row execute function public.lock_editable_identity_document();

create function public.identity_review_files_count(p_worker_id uuid)
returns integer
language sql stable
set search_path = ''
as $$
  select count(*)::integer
    from public.identity_documents d
    join storage.objects o on o.bucket_id = 'identity-documents' and o.name = d.storage_path
   where d.worker_id = p_worker_id;
$$;

create or replace function public.submit_identity_verification()
returns public.verification_status
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_status public.verification_status;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;

  select w.verification_status into v_status from public.worker_profiles w where w.id = v_uid for update;
  if not found then raise exception 'worker_profile_not_found' using errcode = 'P0002'; end if;
  if v_status not in ('unverified', 'rejected') then
    raise exception 'verification_not_editable' using errcode = 'P0001';
  end if;
  if public.identity_review_files_count(v_uid) <> 3 then
    raise exception 'identity_documents_incomplete' using errcode = '22023';
  end if;

  update public.worker_profiles set verification_status = 'pending' where id = v_uid;
  return 'pending';
end;
$$;

create function public.admin_dashboard()
returns table (
  workers bigint, clients bigint, identity_pending bigint,
  documents_pending bigint, documents_approved bigint, documents_rejected bigint
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return query
  select (select count(*) from public.profiles p where p.account_type = 'worker'),
         (select count(*) from public.profiles p where p.account_type = 'client'),
         (select count(*) from public.worker_profiles w where w.verification_status = 'pending'),
         count(*) filter (where c.review_status in ('unverified', 'pending')),
         count(*) filter (where c.review_status = 'verified'),
         count(*) filter (where c.review_status = 'rejected')
    from public.worker_certificates c;
end;
$$;

create function public.admin_documents(p_history boolean default false, p_offset integer default 0)
returns table (
  id uuid, worker_id uuid, worker_name text, title text, document_kind public.professional_document_kind,
  issuer text, issued_on date, created_at timestamptz, review_status public.verification_status,
  reviewed_at timestamptz, reviewer_id uuid, reviewer_name text, note text, file_available boolean
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  if not p_history then
    return query
    select c.id, c.worker_id, p.full_name, c.title, c.document_kind, c.issuer, c.issued_on, c.created_at,
           c.review_status, null::timestamptz, null::uuid, null::text, null::text,
           exists (select 1 from storage.objects o where o.bucket_id = 'worker-certificates' and o.name = c.storage_path)
      from public.worker_certificates c join public.profiles p on p.id = c.worker_id
     where c.review_status in ('unverified', 'pending')
     order by c.created_at, c.id
     limit 26 offset greatest(p_offset, 0);
    return;
  end if;

  return query
  select h.id, h.worker_id, p.full_name, h.title, h.document_kind, h.issuer, h.issued_on, h.created_at,
         h.review_status, h.reviewed_at, h.reviewer_id, r.full_name, h.note,
         exists (select 1 from storage.objects o where o.bucket_id = 'worker-certificates' and o.name = h.storage_path)
    from (
      select a.document_id as id, a.worker_id, a.document_title as title, a.document_kind,
             c.issuer, c.issued_on, c.created_at, a.outcome as review_status, a.reviewed_at, a.reviewer_id,
             a.note, c.storage_path
        from public.professional_document_reviews a
        left join public.worker_certificates c on c.id = a.document_id
      union all
      select c.id, c.worker_id, c.title, c.document_kind, c.issuer, c.issued_on, c.created_at, c.review_status,
             null, null, null, c.storage_path
        from public.worker_certificates c
       where c.review_status in ('verified', 'rejected')
         and not exists (select 1 from public.professional_document_reviews a where a.document_id = c.id)
    ) h
    left join public.profiles p on p.id = h.worker_id
    left join public.profiles r on r.id = h.reviewer_id
   order by h.reviewed_at desc nulls last, h.created_at desc nulls last, h.id desc
   limit 26 offset greatest(p_offset, 0);
end;
$$;

create function public.admin_identity_queue(p_offset integer default 0)
returns table (
  worker_id uuid, worker_name text, request_id uuid, submitted_at timestamptz,
  available_files text[]
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return query
  select w.id, p.full_name, w.verification_request_id, w.verification_submitted_at,
         array(select d.kind::text from public.identity_documents d
                 join storage.objects o on o.bucket_id = 'identity-documents' and o.name = d.storage_path
                where d.worker_id = w.id order by d.kind)
    from public.worker_profiles w join public.profiles p on p.id = w.id
   where w.verification_status = 'pending'
   order by w.verification_submitted_at nulls first, w.id
   limit 26 offset greatest(p_offset, 0);
end;
$$;

create function public.admin_workers(p_offset integer default 0)
returns table (
  id uuid, name text, profession text, experience_years smallint, specialties text[],
  verification_status public.verification_status, documents_pending bigint,
  documents_approved bigint, documents_rejected bigint
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return query
  select w.id, p.full_name, w.profession, w.experience_years,
         array(select c.name from public.worker_categories wc join public.categories c on c.id = wc.category_id
                where wc.worker_id = w.id order by c.sort_order, c.name),
         w.verification_status, docs.pending, docs.approved, docs.rejected
    from public.worker_profiles w join public.profiles p on p.id = w.id
    cross join lateral (
      select count(*) filter (where c.review_status in ('unverified', 'pending')) as pending,
             count(*) filter (where c.review_status = 'verified') as approved,
             count(*) filter (where c.review_status = 'rejected') as rejected
        from public.worker_certificates c where c.worker_id = w.id
    ) docs
   order by p.full_name, w.id
   limit 26 offset greatest(p_offset, 0);
end;
$$;

create function public.admin_review_document(p_document_id uuid, p_approve boolean, p_note text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_reviewer uuid := public.require_admin();
  v_document public.worker_certificates%rowtype;
  v_note text := nullif(btrim(p_note, E' \t\r\n'), '');
  v_outcome public.verification_status;
begin
  if p_approve is null or (not p_approve and v_note is null) or char_length(v_note) > 500 then
    raise exception 'invalid_review_note' using errcode = '22023';
  end if;
  select c.* into v_document from public.worker_certificates c where c.id = p_document_id for update;
  if not found or v_document.review_status not in ('unverified', 'pending') then
    raise exception 'review_not_pending' using errcode = 'P0002';
  end if;
  if v_reviewer = v_document.worker_id then raise exception 'review_self_forbidden' using errcode = '42501'; end if;
  if p_approve and not exists (
    select 1 from storage.objects o where o.bucket_id = 'worker-certificates' and o.name = v_document.storage_path
  ) then
    raise exception 'review_file_unavailable' using errcode = '22023';
  end if;

  v_outcome := case when p_approve then 'verified' else 'rejected' end;
  update public.worker_certificates set review_status = v_outcome where id = v_document.id;
  insert into public.professional_document_reviews (document_id, worker_id, document_title, document_kind, reviewer_id, outcome, note)
  values (v_document.id, v_document.worker_id, v_document.title, v_document.document_kind, v_reviewer, v_outcome, v_note);
end;
$$;

create function public.admin_review_identity(p_worker_id uuid, p_request_id uuid, p_approve boolean, p_note text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_reviewer uuid := public.require_admin();
  v_note text := nullif(btrim(p_note, E' \t\r\n'), '');
  v_outcome public.verification_status;
begin
  if v_reviewer = p_worker_id then raise exception 'review_self_forbidden' using errcode = '42501'; end if;
  if p_approve is null or v_note is null or char_length(v_note) > 500 then
    raise exception 'invalid_review_note' using errcode = '22023';
  end if;
  perform 1 from public.worker_profiles w
   where w.id = p_worker_id and w.verification_status = 'pending' and w.verification_request_id = p_request_id
   for update;
  if not found then raise exception 'review_not_pending' using errcode = 'P0002'; end if;
  if p_approve and public.identity_review_files_count(p_worker_id) <> 3 then
    raise exception 'identity_review_incomplete' using errcode = '22023';
  end if;
  v_outcome := case when p_approve then 'verified' else 'rejected' end;
  update public.worker_profiles set verification_status = v_outcome, verification_note = v_note where id = p_worker_id;
end;
$$;

-- Only the Edge Function can resolve private paths, after validating the
-- user's token with Auth. Identity files are accessible only for a pending
-- request with the exact request ID shown to the reviewer.
create function public.admin_review_file(
  p_reviewer uuid, p_document_id uuid default null, p_worker_id uuid default null,
  p_request_id uuid default null, p_kind public.identity_document_kind default null
)
returns table (bucket_id text, object_name text)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.administrators a where a.user_id = p_reviewer) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if p_document_id is not null and p_worker_id is null and p_request_id is null and p_kind is null then
    return query
    select o.bucket_id, o.name from public.worker_certificates c
      join storage.objects o on o.bucket_id = 'worker-certificates' and o.name = c.storage_path
     where c.id = p_document_id;
  elsif p_document_id is null and p_worker_id is not null and p_request_id is not null and p_kind is not null then
    return query
    select o.bucket_id, o.name from public.worker_profiles w
      join public.identity_documents d on d.worker_id = w.id and d.kind = p_kind
      join storage.objects o on o.bucket_id = 'identity-documents' and o.name = d.storage_path
     where w.id = p_worker_id and w.verification_status = 'pending' and w.verification_request_id = p_request_id;
  end if;
end;
$$;

revoke execute on function public.require_admin(), public.lock_editable_identity_document(),
  public.identity_review_files_count(uuid) from public, anon, authenticated, service_role;
revoke execute on function public.is_admin(), public.admin_dashboard(), public.admin_documents(boolean, integer),
  public.admin_identity_queue(integer), public.admin_workers(integer), public.admin_review_document(uuid, boolean, text),
  public.admin_review_identity(uuid, uuid, boolean, text) from public, anon, authenticated, service_role;
grant execute on function public.is_admin(), public.admin_dashboard(), public.admin_documents(boolean, integer),
  public.admin_identity_queue(integer), public.admin_workers(integer), public.admin_review_document(uuid, boolean, text),
  public.admin_review_identity(uuid, uuid, boolean, text) to authenticated;
revoke execute on function public.admin_review_file(uuid, uuid, uuid, uuid, public.identity_document_kind)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_review_file(uuid, uuid, uuid, uuid, public.identity_document_kind) to service_role;

commit;
