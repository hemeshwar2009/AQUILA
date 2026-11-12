-- ALL-HAZARD UPGRADE (run after schema.sql + data.sql)
-- Adds heatwave emergency types, heat-aware severity, and the area-broadcasts table.
-- Already applied to the team's live project; kept here so a fresh setup can reproduce it.

-- 1. heatwave emergency types (server-side whitelist + weights)
insert into private.types (id, label, weight) values
  ('heatstroke','Heat stroke / collapse',30),
  ('dehydration','Dehydration / exhaustion',22),
  ('watershort','Drinking water shortage',16)
on conflict (id) do update set label = excluded.label, weight = excluded.weight;

-- 2. heat-aware severity (matches the client's triage agent)
create or replace function private.assess_severity(p_type text, p_depth integer, p_people integer)
returns integer language sql immutable set search_path to 'public'
as $$
  select case when p_type = 'heatstroke' then 4 else greatest(1, least(4,
    (case p_type when 'rescue' then 3 when 'medical' then 3
                 when 'flood' then 2 when 'power' then 2 when 'dehydration' then 2 else 1 end)
    + (case when p_depth >= 3 then 1 else 0 end)
    + (case when p_people >= 10 then 1 else 0 end)
    + (case when p_type in ('dehydration','watershort') and p_people >= 5 then 1 else 0 end))) end;
$$;

-- 3. area broadcasts: officers write, everyone reads, realtime fan-out
create table if not exists public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  zone text,
  tpl text not null default 'custom',
  texts jsonb not null,
  by text not null default 'Officer',
  ts timestamptz not null default now(),
  constraint broadcasts_texts_size check (pg_column_size(texts) < 6000),
  constraint broadcasts_by_len check (char_length(by) <= 120),
  constraint broadcasts_tpl_len check (char_length(tpl) <= 40)
);
alter table public.broadcasts enable row level security;
drop policy if exists "broadcasts are public information" on public.broadcasts;
create policy "broadcasts are public information" on public.broadcasts
  for select to anon, authenticated using (true);
drop policy if exists "only active admins send broadcasts" on public.broadcasts;
create policy "only active admins send broadcasts" on public.broadcasts
  for insert to authenticated with check (private.is_active_admin());

do $$ begin
  alter publication supabase_realtime add table public.broadcasts;
exception when duplicate_object then null; end $$;
