-- =============================================================================
-- ChambeaYA! - RLS / privileges verification (reproducible)
--
-- HOW TO RUN: Supabase Dashboard > SQL Editor > paste this file > Run.
-- Requires migrations 0001-0003 applied.
--
-- What it does:
--   1. Creates 3 TEMPORARY test users (emails rls-*@test.chambeaya.invalid).
--   2. Impersonates the `anon` and `authenticated` roles exactly like the
--      Data API does (role + request.jwt.claims) and runs allowed/forbidden ops.
--   3. Deletes the test users (cascade removes their profiles).
--   4. Returns a table: every row must have passed = true.
--
-- Only rows belonging to the rls-*@test.chambeaya.invalid test accounts are
-- created/deleted. No real data is touched.
-- =============================================================================

-- Clean leftovers of a previous interrupted run (test accounts only).
delete from auth.users where email like 'rls-%@test.chambeaya.invalid';

drop table if exists pg_temp._rls_results;
drop table if exists pg_temp._rls_users;
create temp table _rls_results (n serial, check_name text, passed boolean, detail text);
create temp table _rls_users (label text primary key, id uuid not null default gen_random_uuid());

insert into _rls_users (label) values ('client'), ('worker'), ('attacker');

insert into auth.users (id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
select u.id, 'authenticated', 'authenticated', 'rls-' || u.label || '@test.chambeaya.invalid',
       case u.label
         when 'client' then '{"first_name":"Cliente","last_name":"Prueba","phone":"71234567","account_type":"client"}'
         when 'worker' then '{"first_name":"Trabajador","last_name":"Prueba","phone":"76543210","account_type":"worker"}'
         else '{"first_name":"Atacante","account_type":"admin"}'
       end::jsonb,
       '{}'::jsonb, now(), now()
  from _rls_users u;

-- Impersonation helper: NULL -> anon, otherwise authenticated user with that id.
create or replace function pg_temp.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  if p_uid is null then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    perform set_config('role', 'anon', true);
  else
    perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
  end if;
end;
$$;

-- p_expect: 'denied' (error OR 0 rows) | 'one' (exactly 1 row) | 'some' (>= 1 row)
create or replace function pg_temp.expect(p_name text, p_uid uuid, p_sql text, p_expect text)
returns void language plpgsql as $$
declare
  v_rows   bigint;
  v_passed boolean;
  v_detail text;
begin
  perform pg_temp.act_as(p_uid);
  begin
    execute p_sql;
    get diagnostics v_rows = row_count;
    v_detail := v_rows || ' fila(s)';
    v_passed := case p_expect
                  when 'denied' then v_rows = 0
                  when 'one'    then v_rows = 1
                  when 'some'   then v_rows >= 1
                end;
  exception when others then
    v_detail := sqlstate || ': ' || sqlerrm;
    v_passed := p_expect = 'denied';
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  insert into _rls_results (check_name, passed, detail) values (p_name, v_passed, v_detail);
end;
$$;

do $$
declare
  c uuid := (select id from _rls_users where label = 'client');
  w uuid := (select id from _rls_users where label = 'worker');
  x uuid := (select id from _rls_users where label = 'attacker');
begin
  -- Sign-up trigger -------------------------------------------------------
  insert into _rls_results (check_name, passed, detail) values
    ('Trigger: perfil de cliente creado', exists (select 1 from public.profiles where id = c and account_type = 'client'), ''),
    ('Trigger: perfil de trabajador + worker_profile', exists (select 1 from public.worker_profiles where id = w), ''),
    ('Trigger: rol "admin" en metadata se ignora', exists (select 1 from public.profiles where id = x and account_type is null), ''),
    ('Trigger: trabajador nace "unverified"', exists (select 1 from public.worker_profiles where id = w and verification_status = 'unverified'), '');

  -- Anonymous -------------------------------------------------------------
  perform pg_temp.expect('anon NO lee profiles', null, 'select * from public.profiles', 'denied');
  perform pg_temp.expect('anon NO lee worker_profiles', null, 'select * from public.worker_profiles', 'denied');
  perform pg_temp.expect('anon NO lee worker_categories', null, 'select * from public.worker_categories', 'denied');
  perform pg_temp.expect('anon SI lee categorias', null, 'select * from public.categories', 'some');
  perform pg_temp.expect('anon NO usa directorio publico', null, 'select * from public.get_public_workers()', 'denied');
  perform pg_temp.expect('anon NO llama set_account_type', null, $q$select public.set_account_type('worker')$q$, 'denied');

  -- Client ----------------------------------------------------------------
  perform pg_temp.expect('cliente lee solo su perfil', c, 'select * from public.profiles', 'one');
  perform pg_temp.expect('cliente NO lee perfil ajeno', c, format('select * from public.profiles where id = %L', w), 'denied');
  perform pg_temp.expect('cliente edita su nombre/telefono', c, format($q$update public.profiles set first_name = 'Cliente2', phone = '70000000' where id = %L$q$, c), 'one');
  perform pg_temp.expect('cliente NO cambia su account_type', c, format($q$update public.profiles set account_type = 'worker' where id = %L$q$, c), 'denied');
  perform pg_temp.expect('cliente NO edita avatar_url arbitrario', c, format($q$update public.profiles set avatar_url = 'https://x' where id = %L$q$, c), 'denied');
  perform pg_temp.expect('cliente NO edita perfil ajeno', c, format($q$update public.profiles set first_name = 'Hack' where id = %L$q$, w), 'denied');
  perform pg_temp.expect('cliente NO inserta perfiles', c, format($q$insert into public.profiles (id, first_name) values (%L, 'X')$q$, gen_random_uuid()), 'denied');
  perform pg_temp.expect('cliente NO borra su perfil', c, format('delete from public.profiles where id = %L', c), 'denied');
  perform pg_temp.expect('cliente NO se crea worker_profile', c, format('insert into public.worker_profiles (id) values (%L)', c), 'denied');
  perform pg_temp.expect('cliente NO lee worker_profiles ajenos', c, 'select * from public.worker_profiles', 'denied');
  perform pg_temp.expect('cliente NO edita worker_profile ajeno', c, format($q$update public.worker_profiles set profession = 'Hack' where id = %L$q$, w), 'denied');
  perform pg_temp.expect('cliente NO asigna categorias ajenas', c, format($q$insert into public.worker_categories (worker_id, category_id) values (%L, 'plumbing')$q$, w), 'denied');
  perform pg_temp.expect('cliente NO re-elige rol (set_account_type)', c, $q$select public.set_account_type('worker')$q$, 'denied');
  perform pg_temp.expect('cliente NO usa set_worker_categories', c, $q$select public.set_worker_categories(array['plumbing'])$q$, 'denied');
  perform pg_temp.expect('cliente NO inserta categorias', c, $q$insert into public.categories (id, name) values ('hack', 'Hack')$q$, 'denied');

  -- Worker ----------------------------------------------------------------
  perform pg_temp.expect('trabajador edita su perfil profesional', w, format(
    $q$update public.worker_profiles set profession = 'Plomero', description = 'Reparación de fugas, instalación de sanitarios y cañerías.', experience_years = 5, availability_status = 'available' where id = %L$q$, w), 'one');
  perform pg_temp.expect('trabajador NO se auto-verifica', w, format($q$update public.worker_profiles set verification_status = 'verified' where id = %L$q$, w), 'denied');
  perform pg_temp.expect('trabajador NO pasa a "pending" por su cuenta', w, format($q$update public.worker_profiles set verification_status = 'pending' where id = %L$q$, w), 'denied');
  perform pg_temp.expect('trabajador NO cambia su account_type', w, format($q$update public.profiles set account_type = 'client' where id = %L$q$, w), 'denied');
  perform pg_temp.expect('trabajador asigna sus categorias', w, $q$select public.set_worker_categories(array['plumbing', 'electricity'])$q$, 'some');
  perform pg_temp.expect('trabajador NO supera 5 categorias', w, $q$select public.set_worker_categories(array['plumbing','electricity','technology','cleaning','mechanics','construction'])$q$, 'denied');
  perform pg_temp.expect('trabajador NO usa categoria inexistente', w, $q$select public.set_worker_categories(array['inexistente'])$q$, 'denied');
  perform pg_temp.expect('trabajador NO asigna categorias a otro', w, format($q$insert into public.worker_categories (worker_id, category_id) values (%L, 'plumbing')$q$, c), 'denied');
  perform pg_temp.expect('trabajador lee solo su worker_profile', w, 'select * from public.worker_profiles', 'one');

  -- Attacker (no account type yet) ---------------------------------------
  perform pg_temp.expect('NO existe rol admin (set_account_type admin)', x, $q$select public.set_account_type('admin')$q$, 'denied');
  perform pg_temp.expect('usuario sin rol elige rol una vez', x, $q$select public.set_account_type('client')$q$, 'one');
  perform pg_temp.expect('usuario NO elige rol por segunda vez', x, $q$select public.set_account_type('worker')$q$, 'denied');

  -- Public directory ------------------------------------------------------
  perform pg_temp.expect('directorio muestra trabajador completo', c, format('select 1 from public.get_public_workers() where id = %L', w), 'one');
  perform pg_temp.expect('directorio NO muestra clientes', c, format('select 1 from public.get_public_workers() where id = %L', c), 'denied');
  perform pg_temp.expect('directorio filtra por categoria', c, format($q$select 1 from public.get_public_workers('plumbing') where id = %L$q$, w), 'one');
end;
$$;

-- Directory never exposes private columns (phone/email). proargnames includes the TABLE output columns.
insert into _rls_results (check_name, passed, detail)
select 'directorio sin columnas privadas',
       not exists (
         select 1 from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'get_public_workers'
            and p.proargnames && array['phone', 'email']
       ),
       '';

-- RLS enabled on every app table.
insert into _rls_results (check_name, passed, detail)
select 'RLS activo en ' || c.relname, c.relrowsecurity, ''
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r'
   and c.relname in ('profiles', 'worker_profiles', 'categories', 'worker_categories');

-- Cleanup test accounts (cascade removes profiles / worker data).
delete from auth.users where id in (select id from _rls_users);

select n, passed, check_name, detail from _rls_results order by n;
