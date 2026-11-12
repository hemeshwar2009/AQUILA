-- Aquila: incident data on Supabase (complaints, citizen notifications, audit log)
-- Run AFTER schema.sql, in the Supabase dashboard → SQL Editor.
-- (Already applied to project sieruxnpbvwwsbhlclqk as migrations
--  aquila_incident_data, aquila_fix_search_paths, aquila_public_incidents_dispatch_time.)
--
-- Security model
--   * Only active admins (private.is_active_admin()) can read or update the tables.
--   * Citizens never touch the tables. They have no login; each browser keeps a
--     random private token, and the server functions below only return reports
--     whose stored sha256(token) matches. Citizens never receive priority scores.
--   * Severity and priority are computed on the server, so a citizen can't inflate them.
--   * The audit log is append-only; time and signed-in user are stamped by the server.

-- ---------- lookup data (private, used for validation and scoring) ----------
create table if not exists private.zones (id text primary key, name text not null, risk int not null);
insert into private.zones (id, name, risk) values
 ('royapuram','Royapuram',62),('washermanpet','Washermanpet',58),('annanagar','Anna Nagar',45),('ambattur','Ambattur',55),
 ('avadi','Avadi',48),('koyambedu','Koyambedu',50),('egmore','Egmore',52),('nungambakkam','Nungambakkam',47),
 ('tnagar','T. Nagar',66),('mylapore','Mylapore',54),('saidapet','Saidapet',74),('adyar','Adyar',70),
 ('guindy','Guindy',60),('porur','Porur',63),('velachery','Velachery',92),('pallikaranai','Pallikaranai',88),
 ('madipakkam','Madipakkam',78),('tambaram','Tambaram',80),('chromepet','Chromepet',72),('mudichur','Mudichur',90),
 ('thiruvanmiyur','Thiruvanmiyur',56),('sholinganallur','Sholinganallur',76),('perungudi','Perungudi',82)
on conflict (id) do update set name = excluded.name, risk = excluded.risk;

create table if not exists private.types (id text primary key, label text not null, weight int not null);
insert into private.types (id, label, weight) values
 ('flood','Flooding',22),('rescue','Rescue needed',30),('waterlogging','Waterlogging',12),('medical','Medical',28),
 ('power','Power hazard',16),('tree','Tree / structure',14),('relief','Relief supplies',10)
on conflict (id) do update set label = excluded.label, weight = excluded.weight;

-- same rules as index.html (assessSeverity / priorityScore)
create or replace function private.assess_severity(p_type text, p_depth int, p_people int)
returns int language sql immutable set search_path = public as $$
  select greatest(1, least(4,
    (case p_type when 'rescue' then 3 when 'medical' then 3 when 'flood' then 2 when 'power' then 2 else 1 end)
    + (case when p_depth >= 3 then 1 else 0 end) + (case when p_people >= 10 then 1 else 0 end)));
$$;
create or replace function private.priority_score(p_sev int, p_people int, p_depth int, p_type text, p_zone text)
returns int language sql stable set search_path = private, public as $$
  select least(100, round(
      p_sev * 12 + least(p_people, 60) * 0.5 + p_depth * 5
    + coalesce((select weight from private.types where id = p_type), 10) * 0.6
    + coalesce((select risk from private.zones where id = p_zone), 50) * 0.12))::int;
$$;

-- ---------- complaints ----------
create sequence if not exists public.complaint_seq start 1014;
create table if not exists public.complaints (
  id          text primary key default ('AQ-' || nextval('public.complaint_seq')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  zone        text not null references private.zones(id),
  type        text not null references private.types(id),
  severity    smallint not null check (severity between 1 and 4),
  people      int not null check (people between 1 and 500),
  depth       smallint not null check (depth between 0 and 4),
  name        text not null check (char_length(name) between 1 and 80),
  phone       text not null check (phone ~ '^[6-9][0-9]{9}$'),
  description text not null default '—' check (char_length(description) <= 1000),
  status      text not null default 'Pending' check (status in ('Pending','Dispatched','Accepted','In Progress','Resolved')),
  agent       text check (agent is null or agent ~ '^[A-Z]+-[0-9]{2}$'),
  source      text not null check (source in ('seed','citizen','scenario')),
  score       int not null check (score between 0 and 100),
  ai_score    int not null,
  dup_of      text,
  owner_hash  text,                                  -- sha256 of the reporter's private browser token
  extra       jsonb not null default '{}'::jsonb      -- timeline, override, crew report, outcome …
);
alter sequence public.complaint_seq owned by public.complaints.id;
create index if not exists complaints_owner_idx on public.complaints (owner_hash);
create index if not exists complaints_created_idx on public.complaints (created_at desc);

create or replace function private.touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists complaints_touch on public.complaints;
create trigger complaints_touch before update on public.complaints
  for each row execute function private.touch_updated_at();

-- ---------- citizen notifications ----------
create table if not exists public.notifications (
  id           bigint generated always as identity primary key,
  complaint_id text not null references public.complaints(id) on delete cascade,
  created_at   timestamptz not null default now(),
  msg          text not null check (char_length(msg) <= 500),
  icon         text not null default '🔔' check (char_length(icon) <= 8),
  read         boolean not null default false
);
create index if not exists notifications_complaint_idx on public.notifications (complaint_id);

-- ---------- audit log (append-only) ----------
create table if not exists public.audit_log (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  actor         text not null check (char_length(actor) <= 120),
  action        text not null check (char_length(action) <= 80),
  complaint_id  text,
  detail        text not null default '' check (char_length(detail) <= 1000),
  actor_user_id uuid
);
create index if not exists audit_created_idx on public.audit_log (created_at desc);
create or replace function private.audit_stamp() returns trigger language plpgsql set search_path = public as $$
begin new.created_at := now(); new.actor_user_id := auth.uid(); return new; end $$;
drop trigger if exists audit_stamp on public.audit_log;
create trigger audit_stamp before insert on public.audit_log
  for each row execute function private.audit_stamp();

-- ---------- row-level security ----------
alter table public.complaints    enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log     enable row level security;

revoke all on public.complaints, public.notifications, public.audit_log from anon, authenticated;
revoke all on sequence public.complaint_seq from anon, authenticated;

grant select on public.complaints to authenticated;
grant update (status, agent, score, dup_of, extra) on public.complaints to authenticated;
drop policy if exists "complaints: admins read" on public.complaints;
drop policy if exists "complaints: admins update" on public.complaints;
create policy "complaints: admins read"   on public.complaints for select to authenticated using (private.is_active_admin());
create policy "complaints: admins update" on public.complaints for update to authenticated
  using (private.is_active_admin()) with check (private.is_active_admin());

grant select on public.notifications to authenticated;
grant insert (complaint_id, msg, icon) on public.notifications to authenticated;
drop policy if exists "notifications: admins read" on public.notifications;
drop policy if exists "notifications: admins insert" on public.notifications;
create policy "notifications: admins read"   on public.notifications for select to authenticated using (private.is_active_admin());
create policy "notifications: admins insert" on public.notifications for insert to authenticated with check (private.is_active_admin());

grant select on public.audit_log to authenticated;
grant insert (actor, action, complaint_id, detail) on public.audit_log to authenticated;
drop policy if exists "audit: admins read" on public.audit_log;
drop policy if exists "audit: admins insert" on public.audit_log;
create policy "audit: admins read"   on public.audit_log for select to authenticated using (private.is_active_admin());
create policy "audit: admins insert" on public.audit_log for insert to authenticated with check (private.is_active_admin());

-- ---------- server functions for citizens ----------
create or replace function public.submit_report(
  p_zone text, p_type text, p_people int, p_depth int,
  p_name text, p_phone text, p_desc text, p_token text, p_source text default 'citizen')
returns json language plpgsql security definer set search_path = public, private as $$
declare
  v_admin boolean := private.is_active_admin();
  v_source text; v_hash text; v_sev int; v_score int; v_dup text; v_id text;
  v_zone text; v_label text; v_name text := trim(coalesce(p_name, ''));
begin
  v_source := case when v_admin and p_source in ('citizen','scenario') then p_source else 'citizen' end;
  if v_source = 'citizen' then
    if p_token is null or char_length(p_token) not between 32 and 128 then
      raise exception 'This device could not be identified. Reload the page and try again.';
    end if;
    v_hash := encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
    if (select count(*) from complaints where owner_hash = v_hash and created_at > now() - interval '10 minutes') >= 5 then
      raise exception 'Too many reports from this device in a short time. If this is urgent, call 112.';
    end if;
  end if;
  select name into v_zone from zones where id = p_zone;
  if v_zone is null then raise exception 'Please choose a valid area.'; end if;
  select label into v_label from types where id = p_type;
  if v_label is null then raise exception 'Please choose a valid emergency type.'; end if;
  if p_people is null or p_people not between 1 and 500 then raise exception 'People affected must be between 1 and 500.'; end if;
  if p_depth is null or p_depth not between 0 and 4 then raise exception 'Please choose a valid water depth.'; end if;
  if char_length(v_name) not between 1 and 80 then raise exception 'Please enter the reporter name.'; end if;
  if coalesce(trim(p_phone), '') !~ '^[6-9][0-9]{9}$' then raise exception 'Please enter a valid 10-digit Indian mobile number.'; end if;

  v_sev := assess_severity(p_type, p_depth, p_people);
  v_score := priority_score(v_sev, p_people, p_depth, p_type, p_zone);
  select id into v_dup from complaints
   where zone = p_zone and type = p_type and status <> 'Resolved' and dup_of is null
     and created_at >= now() - interval '30 minutes'
   order by created_at desc limit 1;

  insert into complaints (zone, type, severity, people, depth, name, phone, description, source, score, ai_score, dup_of, owner_hash)
  values (p_zone, p_type, v_sev, p_people, p_depth, v_name, trim(p_phone),
          left(coalesce(nullif(trim(p_desc), ''), '—'), 1000), v_source, v_score, v_score, v_dup, v_hash)
  returning id into v_id;

  insert into audit_log (actor, action, complaint_id, detail)
  values (case when v_source = 'citizen' then left('Citizen: ' || v_name, 120) else 'Citizen (scenario)' end,
          'Report received', v_id,
          format('%s, %s, %s people · AI priority %s', v_label, v_zone, p_people, v_score)
          || coalesce(' · flagged possible duplicate of ' || v_dup, ''));
  if v_source = 'citizen' then
    insert into notifications (complaint_id, msg, icon)
    values (v_id, format('Report %s received by the Aquila command center; an officer is reviewing it.', v_id), '📨');
  end if;
  return json_build_object('id', v_id);
end $$;

create or replace function public.citizen_reports(p_token text)
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
           'id', id, 'created_at', created_at, 'zone', zone, 'type', type, 'people', people, 'depth', depth,
           'status', status, 'agent', agent, 'outcome', extra->>'outcome', 't', coalesce(extra->'t', '{}'::jsonb))
         order by created_at desc), '[]'::json)
    from complaints
   where char_length(coalesce(p_token, '')) between 32 and 128
     and owner_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
$$;

create or replace function public.citizen_notifications(p_token text)
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
           'id', n.id, 'complaint_id', n.complaint_id, 'created_at', n.created_at, 'msg', n.msg, 'icon', n.icon, 'read', n.read)
         order by n.created_at desc), '[]'::json)
    from (select n.* from notifications n join complaints c on c.id = n.complaint_id
           where char_length(coalesce(p_token, '')) between 32 and 128
             and c.owner_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
           order by n.created_at desc limit 80) n;
$$;

create or replace function public.citizen_mark_read(p_token text)
returns void language sql security definer set search_path = public as $$
  update notifications set read = true
   where not read and complaint_id in (
     select id from complaints
      where char_length(coalesce(p_token, '')) between 32 and 128
        and owner_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex'));
$$;

-- public city map: active incidents, no personal details, no scores (only a critical flag)
create or replace function public.public_incidents()
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
           'id', id, 'created_at', created_at, 'zone', zone, 'type', type, 'people', people, 'depth', depth,
           'status', status, 'agent', agent, 'critical', score >= 75,
           't', jsonb_strip_nulls(jsonb_build_object('dispatched', extra->'t'->'dispatched')))
         order by created_at desc), '[]'::json)
    from complaints where status <> 'Resolved';
$$;

-- ---------- demo seed + admin-only reset ----------
create or replace function private.seed_demo()
returns void language plpgsql set search_path = public, private as $$
declare r record; v_ts timestamptz; v_score int; v_t jsonb; v_extra jsonb; v_ms bigint;
begin
  for r in select * from (values
    (1,  0.3, 'velachery','rescue',4,6,4,'Karthik S','9840011223','Family of 6 trapped on first floor near Vijayanagar bus stand, water chest-deep and rising.','In Progress','BOAT-02'),
    (2,  0.6, 'mudichur','rescue',4,12,3,'Lakshmi V','9884455667','12 residents on terrace of apartment near Mudichur lake breach. Two elderly, one infant.','Dispatched','BOAT-01'),
    (3,  1.1, 'pallikaranai','flood',3,4,3,'Arun Prakash','9790334455','Ground floor flooded on Velachery–Tambaram Main Road, marsh overflow entering homes.','Dispatched','TRUCK-01'),
    (4,  1.8, 'saidapet','medical',4,1,2,'Fathima B','9003221144','Dialysis patient needs urgent hospital transfer, street waterlogged near Saidapet bridge.','In Progress','MED-01'),
    (5,  2.4, 'tambaram','flood',3,8,2,'Suresh Kumar','9445099887','Knee-deep water in Tambaram West, requesting sandbags and pump support.','Pending',null),
    (6,  3.0, 'adyar','waterlogging',2,3,2,'Divya N','9841776655','L.B. Road junction impassable, two-wheelers stranded.','Resolved','CAR-01'),
    (7,  3.9, 'tnagar','power',3,20,1,'Rajesh M','9566012378','Transformer sparking near Pondy Bazaar, water pooling under it.','Dispatched','CAR-02'),
    (8,  5.1, 'perungudi','flood',3,5,3,'Meena R','9962334411','OMR service lane flooded, office basement taking in water.','Pending',null),
    (9,  6.4, 'porur','tree',2,2,0,'Vignesh T','9176554433','Large tree fallen across Mount–Poonamallee Road after gusts.','Resolved','TRUCK-02'),
    (10, 7.5, 'annanagar','waterlogging',1,2,1,'Shalini K','9380445566','2nd Avenue underpass waterlogged, slow traffic.','Resolved','CAR-01'),
    (11, 8.8, 'sholinganallur','flood',2,4,2,'Ibrahim S','9004789012','ECR link road flooded near lake, water entering shops.','Pending',null),
    (12, 10.2,'madipakkam','relief',2,15,1,'Geetha P','9841990011','Drinking water and food needed for 15 families in Ram Nagar.','Pending',null),
    (13, 0.1, 'velachery','rescue',4,6,4,'Anand K','9841122334','Neighbours trapped on first floor near Vijayanagar bus stand, water very high.','Pending',null)
  ) as s(i, h, zone, type, sev, people, depth, name, phone, descr, status, agent)
  loop
    v_ts := now() - make_interval(secs => (r.h * 3600)::double precision);
    v_ms := (extract(epoch from v_ts) * 1000)::bigint;
    v_score := priority_score(r.sev, r.people, r.depth, r.type, r.zone);
    v_t := case when r.status <> 'Pending' then jsonb_build_object('dispatched', v_ms + 6*60000) else '{}'::jsonb end;
    v_extra := jsonb_build_object('t', v_t);
    if r.status = 'Resolved' then
      v_extra := jsonb_build_object('t', v_t || jsonb_build_object('resolved', v_ms + 50*60000), 'outcome', 'Cleared by crew (seed data)');
    end if;
    insert into complaints (id, created_at, zone, type, severity, people, depth, name, phone, description, status, agent, source, score, ai_score, dup_of, extra)
    values ('AQ-' || (1000 + r.i), v_ts, r.zone, r.type, r.sev, r.people, r.depth, r.name, r.phone, r.descr, r.status, r.agent,
            'seed', v_score, v_score, case when r.i = 13 then 'AQ-1001' end, v_extra);
  end loop;
  perform setval('public.complaint_seq', 1013);
end $$;

create or replace function public.reset_demo()
returns void language plpgsql security definer set search_path = public, private as $$
begin
  if not private.is_active_admin() then raise exception 'Only admins can reset demo data.'; end if;
  delete from complaints where true;    -- notifications cascade; the audit log is kept
  perform private.seed_demo();
  insert into audit_log (actor, action, complaint_id, detail)
  select name, 'Demo data reset', null, '13 seeded incidents restored (simulated data)' from admins where user_id = auth.uid();
end $$;

revoke all on function private.seed_demo() from public, anon, authenticated;
revoke all on function public.submit_report(text,text,int,int,text,text,text,text,text) from public;
revoke all on function public.citizen_reports(text) from public;
revoke all on function public.citizen_notifications(text) from public;
revoke all on function public.citizen_mark_read(text) from public;
revoke all on function public.public_incidents() from public;
revoke all on function public.reset_demo() from public, anon;
grant execute on function public.submit_report(text,text,int,int,text,text,text,text,text) to anon, authenticated;
grant execute on function public.citizen_reports(text) to anon, authenticated;
grant execute on function public.citizen_notifications(text) to anon, authenticated;
grant execute on function public.citizen_mark_read(text) to anon, authenticated;
grant execute on function public.public_incidents() to anon, authenticated;
grant execute on function public.reset_demo() to authenticated;

-- live updates for the command center
alter publication supabase_realtime add table public.complaints, public.audit_log;

-- initial demo data (run once)
select private.seed_demo();
insert into public.audit_log (actor, action, complaint_id, detail)
values ('System', 'Demo data loaded', null, '13 seeded incidents (simulated data)');
