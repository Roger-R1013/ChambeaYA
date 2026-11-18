begin;

-- Preferences for optional product notices. Auth and security-critical
-- messages from Supabase Auth are independent of these settings.
create table public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  service_requests boolean not null default false,
  job_updates boolean not null default false,
  identity_reviews boolean not null default false,
  document_reviews boolean not null default false,
  security_notices boolean not null default true
);

alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from public, anon, authenticated;
grant select on public.notification_preferences to authenticated;
grant insert (user_id, service_requests, job_updates, identity_reviews, document_reviews, security_notices)
  on public.notification_preferences to authenticated;
-- PostgREST upsert includes the conflict key in the UPDATE. WITH CHECK
-- requires that it remain the authenticated user's own ID.
grant update (user_id, service_requests, job_updates, identity_reviews, document_reviews, security_notices)
  on public.notification_preferences to authenticated;

create policy "notification_preferences: owner can read"
  on public.notification_preferences for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "notification_preferences: owner can insert"
  on public.notification_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "notification_preferences: owner can update"
  on public.notification_preferences for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

commit;
