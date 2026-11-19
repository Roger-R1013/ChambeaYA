-- Apply after 0011. Renew a live session independently of its latest GPS fix.
begin;

-- A prior application may already have installed the heartbeat. Keep it only
-- when its contract and implementation match, including the authorization guard.
do $migration$
declare
  v_existing_oid oid := pg_catalog.to_regprocedure('public.heartbeat_service_journey(uuid,uuid)');
  v_body constant text := $heartbeat$
declare
  v_request public.service_requests%rowtype := public.lock_service_journey_request(p_request_id, true);
  v_journey public.service_journeys%rowtype;
  v_now timestamptz;
begin
  -- Use the same locks as start and publish, including across a worker's requests.
  perform 1 from public.worker_profiles w where w.id = v_request.worker_id for update;
  v_now := clock_timestamp();

  select j.* into v_journey
    from public.service_journeys j join public.service_journey_fix f using (request_id)
   where j.request_id = p_request_id and f.session_id = p_session_id
     and j.status = 'en_route' and j.lease_until > v_now;
  if not found then raise exception 'journey_ended' using errcode = 'P0001'; end if;

  if v_journey.updated_at <= v_now - interval '15 seconds' then
    update public.service_journeys
       set lease_until = v_now + interval '65 seconds', updated_at = v_now
     where request_id = p_request_id;
  end if;
end;
$heartbeat$;
begin
  if v_existing_oid is null then
    execute pg_catalog.format($ddl$
      create function public.heartbeat_service_journey(p_request_id uuid, p_session_id uuid)
      returns void
      language plpgsql security definer
      set search_path = ''
      as %L
    $ddl$, v_body);
  elsif not exists (
    select 1
      from pg_catalog.pg_proc p
      join pg_catalog.pg_language l on l.oid = p.prolang
     where p.oid = v_existing_oid
       and p.prokind = 'f'
       and p.prorettype = 'pg_catalog.void'::pg_catalog.regtype
       and not p.proretset
       and p.proargnames = array['p_request_id', 'p_session_id']
       and p.proargmodes is null
       and p.pronargdefaults = 0
       and l.lanname = 'plpgsql'
       and p.prosecdef
       and not p.proisstrict
       and p.provolatile = 'v'
       and p.proconfig = array['search_path=""']
       and btrim(replace(p.prosrc, chr(13), ''), E' \n\t') =
           btrim(replace(v_body, chr(13), ''), E' \n\t')
  ) then
    raise exception '0012: public.heartbeat_service_journey(uuid,uuid) exists with a different definition'
      using hint = 'Inspect pg_get_functiondef and verify the return type, named arguments and worker/session authorization before changing the existing function.';
  end if;
end;
$migration$;

revoke execute on function public.heartbeat_service_journey(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.heartbeat_service_journey(uuid, uuid) to authenticated;

create or replace function public.get_service_journey(p_request_id uuid)
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
    'position', case when j.status = 'en_route' and j.lease_until > statement_timestamp() and f.captured_at is not null
      then jsonb_build_object('lat', f.lat, 'lng', f.lng, 'accuracy', f.accuracy) end
  )
  from public.service_requests r
  left join public.service_request_addresses a on a.request_id = r.id
  left join public.service_journeys j on j.request_id = r.id
  left join public.service_journey_fix f on f.request_id = r.id
  where r.id = p_request_id and r.status = 'accepted' and auth.uid() in (r.client_id, r.worker_id);
$$;

commit;
