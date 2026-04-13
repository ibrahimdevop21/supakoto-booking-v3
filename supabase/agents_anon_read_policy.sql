-- Run in Supabase → SQL Editor (once).
-- Lets the login page load active agent names using the anon key (no service secret in .env).
-- Safe scope: only rows where is_active = true, and only columns exposed by PostgREST still apply.

alter table public.agents enable row level security;

drop policy if exists "agents_select_active_anon_login" on public.agents;

create policy "agents_select_active_anon_login"
  on public.agents
  for select
  to anon
  using (is_active = true);
