-- Aquila: admin accounts on Supabase
-- Run once in the Supabase dashboard → SQL Editor → New query → paste → Run.
-- (Already applied to project sieruxnpbvwwsbhlclqk as migrations
--  "aquila_admins" + "aquila_admins_private_helper".)
-- Passwords are handled entirely by Supabase Auth; this table only says
-- which auth users are command-center admins.

create table if not exists public.admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  name        text not null,
  disabled    boolean not null default false,
  created_by  text,
  created_at  timestamptz not null default now(),
  accepted_at timestamptz            -- set when the invited officer chooses a password
);

alter table public.admins enable row level security;

-- Helper used by the policies. It lives in a private schema so it is not
-- callable through the public REST API.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_active_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where user_id = auth.uid() and not disabled and accepted_at is not null
  );
$$;
revoke all on function private.is_active_admin() from public, anon;
grant execute on function private.is_active_admin() to authenticated;

-- An invited officer calls this after setting their password. It can only
-- touch the caller's own row (intentionally exposed; Supabase's linter warns
-- about it, which is expected).
create or replace function public.mark_invite_accepted(p_name text default null)
returns void
language sql security definer set search_path = public
as $$
  update public.admins
     set accepted_at = coalesce(accepted_at, now()),
         name = coalesce(nullif(trim(p_name), ''), name)
   where user_id = auth.uid();
$$;
revoke all on function public.mark_invite_accepted(text) from public, anon;
grant execute on function public.mark_invite_accepted(text) to authenticated;

-- Policies: everyone can read their own row; active admins can read all rows
-- and disable/rename/remove other admins (never themselves). Inserts happen
-- only through the invite-officer Edge Function (service role).
drop policy if exists "admins: read own row"    on public.admins;
drop policy if exists "admins: admins read all" on public.admins;
drop policy if exists "admins: admins update"   on public.admins;
drop policy if exists "admins: admins delete"   on public.admins;

create policy "admins: read own row" on public.admins
  for select to authenticated using (user_id = auth.uid());

create policy "admins: admins read all" on public.admins
  for select to authenticated using (private.is_active_admin());

create policy "admins: admins update" on public.admins
  for update to authenticated
  using (private.is_active_admin() and user_id <> auth.uid())
  with check (private.is_active_admin() and user_id <> auth.uid());

create policy "admins: admins delete" on public.admins
  for delete to authenticated
  using (private.is_active_admin() and user_id <> auth.uid());

-- no access at all for signed-out visitors; signed-in admins may only
-- change these columns of other admins
revoke all on public.admins from anon;
revoke insert, update on public.admins from authenticated;
grant update (disabled, name) on public.admins to authenticated;

-- ---------------------------------------------------------------------------
-- FIRST ADMIN (run after creating the user in Authentication → Users → Add user,
-- with "Auto Confirm User" ticked). Replace the email and name, then run:
--
-- insert into public.admins (user_id, email, name, created_by, accepted_at)
-- select id, lower(email), 'Duty Officer', 'bootstrap', now()
--   from auth.users where lower(email) = 'admin@aquila.demo'
-- on conflict (user_id) do nothing;
-- ---------------------------------------------------------------------------
