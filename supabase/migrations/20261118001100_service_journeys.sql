-- ChambeaYA! - 0011: private service destinations and leased GPS tracking.
-- Apply after 0010. Only journey metadata is published to Realtime.
begin;

alter table public.service_request_addresses
  add column destination_lat double precision,
  add column destination_lng double precision,
  add constraint service_destination_valid check (
    (destination_lat is null and destination_lng is null) or
    (destination_lat is not null and destination_lng is not null
      and destination_lat between -18.3 and -17.2 and destination_lng between -63.7 and -62.7)
  );

create type public.service_journey_status as enum ('waiting', 'en_route', 'paused', 'arrived', 'cancelled');

create table public.service_journeys (
  request_id uuid primary key references public.service_requests (id) on delete cascade,
  worker_id uuid not null,
  status public.service_journey_status not null default 'waiting',
  started_at timestamptz,
  ended_at timestamptz,
  last_fix_at timestamptz,
  lease_until timestamptz,
  updated_at timestamptz not null default now(),
  constraint service_journey_lease check ((status = 'en_route') = (lease_until is not null))
);

create index service_journeys_expiry_idx on public.service_journeys (lease_until) where status = 'en_route';
create index service_journeys_worker_lease_idx on public.service_journeys (worker_id, lease_until) where status = 'en_route';

-- Only the current session and its latest fix. No API privileges or publication.
create table public.service_journey_fix (
  request_id uuid primary key references public.service_journeys (request_id) on delete cascade,
  session_id uuid not null,
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  accuracy double precision check (accuracy between 0 and 100),
  captured_at timestamptz,
  received_at timestamptz
);

alter table public.service_journeys enable row level security;
alter table public.service_journey_fix enable row level security;
revoke all on public.service_journeys, public.service_journey_fix from public, anon, authenticated, service_role;
grant select on public.service_journeys to authenticated;

create policy "service_journeys: participants read metadata" on public.service_journeys
  for select to authenticated using (
    exists (select 1 from public.service_requests r where r.id = service_journeys.request_id
      and (select auth.uid()) in (r.client_id, r.worker_id))
  );

alter policy "service_request_addresses: client or hired worker" on public.service_request_addresses using (
  exists (
    select 1 from public.service_requests r where r.id = service_request_addresses.request_id
      and (r.client_id = (select auth.uid()) or
        (r.worker_id = (select auth.uid()) and r.status = 'accepted' and not exists (
          select 1 from public.service_journeys j where j.request_id = r.id and j.status = 'cancelled'
        )))
  )
);

-- Keep the 0010 response shape and expose only the journey status as an extra
-- field. Address and offer reads are still subject to caller RLS.
create or replace function public.get_service_request(p_request_id uuid)
returns jsonb
language sql stable
set search_path = ''
as $$
  select to_jsonb(r) || jsonb_build_object(
    'offers', coalesce((select jsonb_agg(o order by o.revision desc)
                         from public.service_request_offers o where o.request_id = r.id), '[]'::jsonb),
    'location', (select jsonb_build_object('address', a.address, 'reference', a.reference)
                  from public.service_request_addresses a where a.request_id = r.id),
    'journey_status', j.status
  )
  from public.service_requests r left join public.service_journeys j on j.request_id = r.id
  where r.id = p_request_id;
$$;

-- Each mutation locks the parent first. This serializes GPS, consent and termination.
create function public.lock_service_journey_request(p_request_id uuid, p_as_worker boolean)
returns public.service_requests
language plpgsql
set search_path = ''
as $$
declare
  v_request public.service_requests%rowtype;
begin
  select r.* into v_request from public.service_requests r
    where r.id = p_request_id and r.status = 'accepted'
      and auth.uid() = case when p_as_worker then r.worker_id else r.client_id end
    for update;
  if not found then raise exception 'journey_unavailable' using errcode = '42501'; end if;
  return v_request;
end;
$$;

create function public.get_service_journey(p_request_id uuid)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'worker_id', r.worker_id, 'worker_name', r.worker_name, 'category_name', r.category_name,
    'status', case when j.status = 'en_route' and j.lease_until <= statement_timestamp() then 'paused'::public.service_journey_status
                   else coalesce(j.status, 'waiting'::public.service_journey_status) end,
    'started_at', j.started_at, 'last_fix_at', j.last_fix_at, 'lease_until', j.lease_until,
    'server_time', statement_timestamp(),
    'destination', case when a.request_id is not null and (j.status is distinct from 'cancelled' or r.client_id = auth.uid())
      then jsonb_build_object('lat', a.destination_lat, 'lng', a.destination_lng, 'address', a.address, 'reference', a.reference) end,
    'position', case when j.status = 'en_route' and j.lease_until > statement_timestamp()
      and j.last_fix_at > statement_timestamp() - interval '45 seconds'
      then jsonb_build_object('lat', f.lat, 'lng', f.lng, 'accuracy', f.accuracy) end
  )
  from public.service_requests r
  left join public.service_request_addresses a on a.request_id = r.id
  left join public.service_journeys j on j.request_id = r.id
  left join public.service_journey_fix f on f.request_id = r.id
  where r.id = p_request_id and r.status = 'accepted' and auth.uid() in (r.client_id, r.worker_id);
$$;

create function public.set_service_destination(p_request_id uuid, p_lat double precision, p_lng double precision, p_reference text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_request public.service_requests%rowtype := public.lock_service_journey_request(p_request_id, false);
  v_reference text := nullif(btrim(p_reference, E' \t\r\n'), '');
begin
  if p_lat is null or p_lng is null or p_lat not between -18.3 and -17.2
     or p_lng not between -63.7 and -62.7 or char_length(v_reference) > 300 then
    raise exception 'journey_invalid_destination' using errcode = '22023';
  end if;
  if exists (select 1 from public.service_journeys where request_id = p_request_id and status <> 'waiting') then
    raise exception 'journey_destination_locked' using errcode = 'P0001';
  end if;
  update public.service_request_addresses set destination_lat = p_lat, destination_lng = p_lng,
    reference = v_reference where request_id = p_request_id;
  if not found then raise exception 'journey_unavailable' using errcode = 'P0002'; end if;
  insert into public.service_journeys (request_id, worker_id) values (p_request_id, v_request.worker_id)
    on conflict (request_id) do update set updated_at = clock_timestamp();
end;
$$;

create function public.start_service_journey(p_request_id uuid, p_session_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_request public.service_requests%rowtype := public.lock_service_journey_request(p_request_id, true);
  v_journey public.service_journeys%rowtype;
  v_now timestamptz;
begin
  -- One live trip per worker, including across different accepted requests.
  perform 1 from public.worker_profiles w where w.id = v_request.worker_id for update;
  v_now := clock_timestamp();
  if p_session_id is null then raise exception 'journey_unavailable' using errcode = '22023'; end if;
  if not exists (select 1 from public.service_request_addresses where request_id = p_request_id and destination_lat is not null) then
    raise exception 'journey_destination_required' using errcode = '22023';
  end if;
  select j.* into v_journey from public.service_journeys j where j.request_id = p_request_id;
  if v_journey.status in ('arrived', 'cancelled') then raise exception 'journey_ended' using errcode = 'P0001'; end if;
  if v_journey.status = 'en_route' and v_journey.lease_until > v_now then
    if exists (select 1 from public.service_journey_fix where request_id = p_request_id and session_id = p_session_id) then return; end if;
    raise exception 'journey_session_active' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.service_journeys j where j.worker_id = v_request.worker_id
             and j.request_id <> p_request_id and j.status = 'en_route' and j.lease_until > v_now) then
    raise exception 'journey_session_active' using errcode = 'P0001';
  end if;

  insert into public.service_journeys (request_id, worker_id, status, started_at, lease_until, updated_at)
    values (p_request_id, v_request.worker_id, 'en_route', v_now, v_now + interval '65 seconds', v_now)
    on conflict (request_id) do update set status = 'en_route', started_at = coalesce(service_journeys.started_at, excluded.started_at),
      ended_at = null, last_fix_at = null, lease_until = excluded.lease_until, updated_at = excluded.updated_at;
  insert into public.service_journey_fix (request_id, session_id) values (p_request_id, p_session_id)
    on conflict (request_id) do update set session_id = excluded.session_id, lat = null, lng = null,
      accuracy = null, captured_at = null, received_at = null;
end;
$$;

create function public.publish_service_position(
  p_request_id uuid, p_session_id uuid, p_lat double precision, p_lng double precision,
  p_accuracy double precision, p_captured_at timestamptz
)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  v_now timestamptz;
  v_fix public.service_journey_fix%rowtype;
begin
  perform public.lock_service_journey_request(p_request_id, true);
  perform 1 from public.worker_profiles w where w.id = auth.uid() for update;
  v_now := clock_timestamp();
  if p_lat is null or p_lng is null or p_accuracy is null or p_captured_at is null
     or p_lat not between -90 and 90 or p_lng not between -180 and 180 or p_accuracy not between 0 and 100
     or p_captured_at not between v_now - interval '45 seconds' and v_now + interval '5 seconds' then
    return false;
  end if;
  select f.* into v_fix from public.service_journey_fix f join public.service_journeys j using (request_id)
   where f.request_id = p_request_id and f.session_id = p_session_id and j.status = 'en_route' and j.lease_until > v_now;
  if not found then raise exception 'journey_ended' using errcode = 'P0001'; end if;
  if p_captured_at <= v_fix.captured_at or v_fix.received_at > v_now - interval '6 seconds' then return false; end if;

  update public.service_journey_fix set lat = p_lat, lng = p_lng, accuracy = p_accuracy,
    captured_at = p_captured_at, received_at = v_now where request_id = p_request_id;
  update public.service_journeys set last_fix_at = least(v_now, p_captured_at), updated_at = v_now,
    lease_until = v_now + interval '65 seconds' where request_id = p_request_id;
  return true;
end;
$$;

create function public.finish_service_journey(p_request_id uuid, p_action text, p_session_id uuid default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_request public.service_requests%rowtype := public.lock_service_journey_request(p_request_id, true);
  v_journey public.service_journeys%rowtype;
  v_next public.service_journey_status;
  v_now timestamptz := clock_timestamp();
begin
  if p_action is null or p_action not in ('pause', 'arrive', 'cancel') then
    raise exception 'journey_unavailable' using errcode = '22023';
  end if;
  select j.* into v_journey from public.service_journeys j where j.request_id = p_request_id;
  if v_journey.status in ('arrived', 'cancelled') then raise exception 'journey_ended' using errcode = 'P0001'; end if;
  if p_session_id is not null and not exists (
    select 1 from public.service_journey_fix where request_id = p_request_id and session_id = p_session_id
  ) then raise exception 'journey_ended' using errcode = 'P0001'; end if;
  if p_action <> 'cancel' and v_journey.started_at is null then raise exception 'journey_unavailable' using errcode = 'P0001'; end if;

  v_next := case p_action when 'arrive' then 'arrived' when 'cancel' then 'cancelled' else 'paused' end;
  insert into public.service_journeys (request_id, worker_id, status, ended_at, updated_at)
    values (p_request_id, v_request.worker_id, v_next, v_now, v_now)
    on conflict (request_id) do update set status = excluded.status, lease_until = null,
      ended_at = excluded.ended_at, updated_at = excluded.updated_at;
  delete from public.service_journey_fix where request_id = p_request_id;
end;
$$;

create function public.close_journey_on_request_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if old.status = 'accepted' and new.status <> 'accepted' then
    update public.service_journeys set status = 'cancelled', lease_until = null,
      ended_at = clock_timestamp(), updated_at = clock_timestamp()
      where request_id = new.id and status <> 'arrived';
    delete from public.service_journey_fix where request_id = new.id;
  end if;
  return new;
end;
$$;

create trigger service_requests_close_journey after update of status on public.service_requests
  for each row execute function public.close_journey_on_request_change();

-- Schedule from project Cron (owner) every minute. Expired coordinates already
-- become inaccessible through the API even when the scheduled job is absent.
create function public.purge_inactive_service_journeys()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_count integer := 0;
begin
  for v_id in (
    select r.id from public.service_requests r join public.service_journeys j on j.request_id = r.id
     where j.status = 'en_route' and j.lease_until <= clock_timestamp()
     order by j.lease_until limit 500 for update of r skip locked
  ) loop
    update public.service_journeys set status = 'paused', ended_at = clock_timestamp(),
      updated_at = clock_timestamp(), lease_until = null
      where request_id = v_id and status = 'en_route' and lease_until <= clock_timestamp();
    if found then
      delete from public.service_journey_fix where request_id = v_id;
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.lock_service_journey_request(uuid, boolean),
  public.close_journey_on_request_change(), public.purge_inactive_service_journeys()
  from public, anon, authenticated, service_role;

revoke execute on function public.get_service_journey(uuid), public.set_service_destination(uuid, double precision, double precision, text),
  public.start_service_journey(uuid, uuid), public.publish_service_position(uuid, uuid, double precision, double precision, double precision, timestamptz),
  public.finish_service_journey(uuid, text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_service_journey(uuid), public.set_service_destination(uuid, double precision, double precision, text),
  public.start_service_journey(uuid, uuid), public.publish_service_position(uuid, uuid, double precision, double precision, double precision, timestamptz),
  public.finish_service_journey(uuid, text, uuid) to authenticated;

create policy "journey participants can join private channel" on realtime.messages
  for select to authenticated using (
    extension = 'broadcast' and exists (
      select 1 from public.service_requests r where ('service-journey:' || r.id::text) = (select realtime.topic())
      and (select auth.uid()) in (r.client_id, r.worker_id)
    )
  );

alter publication supabase_realtime add table public.service_journeys;

commit;
