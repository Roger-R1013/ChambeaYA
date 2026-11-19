-- ChambeaYA! - 0010: requests, offers and agreements. Apply after 0009.
begin;

create type public.service_request_status as enum ('pending', 'negotiating', 'accepted', 'rejected', 'cancelled');

create table public.service_requests (
  id uuid primary key,
  client_id uuid not null references public.profiles (id) on delete cascade,
  worker_id uuid not null references public.worker_profiles (id) on delete cascade,
  category_id text not null references public.categories (id) on update cascade,
  client_name text not null,
  worker_name text not null,
  category_name text not null,
  description text not null check (char_length(btrim(description)) between 1 and 1500),
  requested_date date not null check (isfinite(requested_date)),
  requested_time time(0) not null check (requested_time < time '24:00'),
  status public.service_request_status not null default 'pending',
  revision integer not null default 1 check (revision >= 1),
  current_offer_id uuid,
  agreed_amount_bob numeric(12, 2) check (agreed_amount_bob > 0 and agreed_amount_bob < 'NaN'::numeric),
  agreed_at timestamptz,
  decision_note text check (char_length(decision_note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (client_id <> worker_id),
  check ((status = 'accepted') = (agreed_amount_bob is not null)),
  check ((status = 'accepted') = (agreed_at is not null)),
  check (status not in ('accepted', 'negotiating') or current_offer_id is not null)
);

create table public.service_request_offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests (id) on delete cascade,
  offered_by uuid not null references public.profiles (id),
  revision integer not null check (revision >= 1),
  amount_bob numeric(12, 2) not null check (amount_bob > 0 and amount_bob < 'NaN'::numeric),
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  unique (request_id, revision),
  unique (request_id, id)
);

alter table public.service_requests add constraint service_requests_current_offer
  foreign key (id, current_offer_id) references public.service_request_offers (request_id, id);

create table public.service_request_addresses (
  request_id uuid primary key references public.service_requests (id) on delete cascade,
  address text not null check (char_length(btrim(address)) between 1 and 300),
  reference text check (char_length(reference) <= 300)
);

create index service_requests_client_activity_idx on public.service_requests (client_id, created_at desc, id desc);
create index service_requests_worker_activity_idx on public.service_requests (worker_id, created_at desc, id desc);
create index service_requests_category_idx on public.service_requests (category_id);

alter table public.service_requests enable row level security;
alter table public.service_request_offers enable row level security;
alter table public.service_request_addresses enable row level security;
revoke all on public.service_requests, public.service_request_offers, public.service_request_addresses from public, anon, authenticated;
grant select on public.service_requests, public.service_request_offers, public.service_request_addresses to authenticated;

create policy "service_requests: participants can read" on public.service_requests
  for select to authenticated using ((select auth.uid()) in (client_id, worker_id));

create policy "service_request_offers: participants can read" on public.service_request_offers
  for select to authenticated using (
    exists (select 1 from public.service_requests r where r.id = service_request_offers.request_id
             and (select auth.uid()) in (r.client_id, r.worker_id))
  );

create policy "service_request_addresses: client or hired worker" on public.service_request_addresses
  for select to authenticated using (
    exists (select 1 from public.service_requests r where r.id = service_request_addresses.request_id
             and (r.client_id = (select auth.uid())
               or (r.worker_id = (select auth.uid()) and r.status = 'accepted')))
  );

-- SECURITY INVOKER: all three reads go through participant RLS and share a snapshot.
create function public.get_service_request(p_request_id uuid)
returns jsonb
language sql stable
set search_path = ''
as $$
  select to_jsonb(r) || jsonb_build_object(
    'offers', coalesce((select jsonb_agg(o order by o.revision desc)
                         from public.service_request_offers o where o.request_id = r.id), '[]'::jsonb),
    'location', (select to_jsonb(a) - 'request_id'
                   from public.service_request_addresses a where a.request_id = r.id)
  )
  from public.service_requests r where r.id = p_request_id;
$$;

create function public.create_service_request(
  p_request_id uuid, p_worker_id uuid, p_category_id text, p_description text,
  p_requested_date date, p_requested_time time, p_address text, p_reference text, p_budget_bob numeric
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_client uuid := auth.uid();
  v_client_name text;
  v_worker_name text;
  v_category_name text;
  v_offer_id uuid;
  v_time time(0) := p_requested_time;
  v_description text := btrim(p_description, E' \r\n\t');
  v_address text := btrim(p_address, E' \r\n\t');
  v_reference text := nullif(btrim(p_reference, E' \r\n\t'), '');
begin
  select concat_ws(' ', p.first_name, nullif(left(btrim(p.last_name), 1), '') || '.')
    into v_client_name from public.profiles p where p.id = v_client and p.account_type = 'client';
  if not found then raise exception 'client_only' using errcode = '42501'; end if;
  if p_request_id is null or p_worker_id is null or p_worker_id = v_client then
    raise exception 'service_request_invalid_worker' using errcode = '22023';
  end if;

  -- A client-generated UUID stays stable if a successful response is lost.
  if exists (select 1 from public.service_requests r where r.id = p_request_id
                and r.client_id = v_client and r.worker_id = p_worker_id) then
    return p_request_id;
  end if;

  if v_description is null or char_length(v_description) not between 1 and 1500
     or v_address is null or char_length(v_address) not between 1 and 300
     or char_length(v_reference) > 300 then
    raise exception 'service_request_invalid_details' using errcode = '22023';
  end if;
  if p_requested_date is null or not isfinite(p_requested_date)
     or p_requested_date > date '9999-12-31' or v_time is null or v_time >= time '24:00' then
    raise exception 'service_request_invalid_schedule' using errcode = '22023';
  end if;
  if p_requested_date + v_time <= (clock_timestamp() at time zone 'America/La_Paz') then
    raise exception 'service_request_invalid_schedule' using errcode = '22023';
  end if;
  if p_budget_bob is not null and
     (p_budget_bob not between 0.01 and 9999999999.99 or p_budget_bob <> trunc(p_budget_bob, 2)) then
    raise exception 'service_request_invalid_price' using errcode = '22023';
  end if;

  select concat_ws(' ', p.first_name, nullif(left(btrim(p.last_name), 1), '') || '.')
    into v_worker_name
    from public.worker_profiles w join public.profiles p on p.id = w.id
   where w.id = p_worker_id and p.account_type = 'worker'
     and w.availability_status = 'available' and w.verification_status <> 'rejected'
     and w.profession is not null and w.description is not null and w.experience_years is not null
   for share of w;
  if not found then raise exception 'service_request_worker_unavailable' using errcode = 'P0001'; end if;

  select c.name into v_category_name
    from public.worker_categories wc join public.categories c on c.id = wc.category_id
   where wc.worker_id = p_worker_id and c.id = p_category_id and c.is_active
   for share of wc, c;
  if not found then raise exception 'service_request_invalid_category' using errcode = '22023'; end if;

  insert into public.service_requests (
    id, client_id, worker_id, category_id, client_name, worker_name, category_name, description, requested_date, requested_time
  ) values (
    p_request_id, v_client, p_worker_id, p_category_id, v_client_name, v_worker_name, v_category_name,
    v_description, p_requested_date, v_time
  ) on conflict (id) do nothing;
  if not found then
    if exists (select 1 from public.service_requests r where r.id = p_request_id
                  and r.client_id = v_client and r.worker_id = p_worker_id) then
      return p_request_id;
    end if;
    raise exception 'service_request_unavailable' using errcode = 'P0002';
  end if;

  insert into public.service_request_addresses (request_id, address, reference)
  values (p_request_id, v_address, v_reference);
  if p_budget_bob is not null then
    insert into public.service_request_offers (request_id, offered_by, revision, amount_bob)
    values (p_request_id, v_client, 1, p_budget_bob)
    returning id into v_offer_id;
    update public.service_requests set current_offer_id = v_offer_id where id = p_request_id;
  end if;
  return p_request_id;
end;
$$;

create function public.respond_service_request(
  p_request_id uuid, p_expected_revision integer, p_action text,
  p_offer_id uuid, p_amount_bob numeric, p_note text
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_request public.service_requests%rowtype;
  v_offer public.service_request_offers%rowtype;
  v_next public.service_request_status;
  v_active_offer_id uuid;
  v_note text := nullif(btrim(p_note, E' \r\n\t'), '');
begin
  select r.* into v_request from public.service_requests r
   where r.id = p_request_id and v_uid in (r.client_id, r.worker_id) for update;
  if not found then raise exception 'service_request_unavailable' using errcode = '42501'; end if;
  if v_request.revision is distinct from p_expected_revision
     or v_request.current_offer_id is distinct from p_offer_id
     or v_request.status not in ('pending', 'negotiating') then
    raise exception 'service_request_changed' using errcode = 'P0001';
  end if;
  if char_length(v_note) > 300 then
    raise exception 'service_request_invalid_note' using errcode = '22023';
  end if;

  v_active_offer_id := v_request.current_offer_id;
  if v_active_offer_id is not null then
    select o.* into v_offer from public.service_request_offers o
     where o.id = v_active_offer_id and o.request_id = v_request.id;
  end if;

  case p_action
    when 'offer' then
      if v_uid <> v_request.worker_id then raise exception 'service_request_action_denied' using errcode = '42501'; end if;
      if p_amount_bob is null or p_amount_bob not between 0.01 and 9999999999.99
         or p_amount_bob <> trunc(p_amount_bob, 2) then
        raise exception 'service_request_invalid_price' using errcode = '22023';
      end if;
      insert into public.service_request_offers (request_id, offered_by, revision, amount_bob, note)
      values (v_request.id, v_uid, v_request.revision + 1, p_amount_bob, v_note)
      returning id into v_active_offer_id;
      v_next := 'negotiating';
    when 'accept' then
      if v_offer.id is null or v_offer.offered_by = v_uid then
        raise exception 'service_request_action_denied' using errcode = '42501';
      end if;
      v_next := 'accepted';
    when 'reject' then
      if v_uid = v_request.client_id and v_offer.offered_by is distinct from v_request.worker_id then
        raise exception 'service_request_action_denied' using errcode = '42501';
      end if;
      v_next := 'rejected';
    when 'cancel' then
      if v_uid <> v_request.client_id then raise exception 'service_request_action_denied' using errcode = '42501'; end if;
      v_next := 'cancelled';
    else
      raise exception 'service_request_action_denied' using errcode = '22023';
  end case;

  update public.service_requests
     set status = v_next,
         current_offer_id = v_active_offer_id,
         agreed_amount_bob = case when v_next = 'accepted' then v_offer.amount_bob end,
         agreed_at = case when v_next = 'accepted' then now() end,
         decision_note = case when v_next = 'rejected' then v_note end,
         revision = v_request.revision + 1,
         updated_at = now()
   where id = v_request.id;
end;
$$;

revoke execute on function public.get_service_request(uuid),
  public.create_service_request(uuid, uuid, text, text, date, time, text, text, numeric),
  public.respond_service_request(uuid, integer, text, uuid, numeric, text)
  from public, anon, authenticated;
grant execute on function public.get_service_request(uuid),
  public.create_service_request(uuid, uuid, text, text, date, time, text, text, numeric),
  public.respond_service_request(uuid, integer, text, uuid, numeric, text) to authenticated;

commit;
