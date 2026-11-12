# Aquila — Chennai Disaster Response Coordinator (Demo)

Team Clovers · Code 9EB24C · Multi-Agent Disaster Response Coordinator

A working prototype dashboard: citizen complaint portal + admin command center,
with a live animated 2D Chennai city map, AI rescue-priority scoring, rescue-agent
fleet simulation, citizen notifications, and historical Chennai disaster datasets.

## How to run (VS Code)

1. Open this folder in VS Code (File → Open Folder).
2. Install the **Live Server** extension (by Ritwick Dey) if you don't have it.
3. Right-click `index.html` → **Open with Live Server**.
4. The app opens at http://127.0.0.1:5500

No build step, no dependencies — everything is in the single `index.html`.

### Alternative (no VS Code extension)
```
python -m http.server 8000
```
then open http://localhost:8000

## Demo logins
- **Citizen Portal** — enter any name.
- **Admin Command Center** — sign in with the admin email and password. They are
  kept in `admin-credentials.local.md` (gitignored, not in the repo); ask the team for them.

## Admin accounts

Admin sign-in has two modes, chosen by two settings near the top of the admin
code in `index.html` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`):

- **Demo mode** (both empty, the default): the built-in admin above, plus
  officers invited from **Officers** in the admin sidebar. Invited accounts and
  invite links live in this browser only, so open an invite link in the same browser.
- **Supabase mode** (both filled in): passwords are checked by Supabase Auth,
  the built-in demo admin is switched off, and invited officers get a real email.

### Setting up Supabase

1. Create a project at supabase.com. From **Project Settings → API**, copy the
   **Project URL** and the **anon public** key into `SUPABASE_URL` and
   `SUPABASE_ANON_KEY` in `index.html`. The anon key is designed to be public.
   **Never** put the `service_role` key in `index.html`.
2. **SQL Editor →** run [`supabase/schema.sql`](supabase/schema.sql) (admin accounts),
   then [`supabase/data.sql`](supabase/data.sql) (complaints, citizen notifications,
   audit log, server functions and the 13 demo incidents).
3. **Authentication → Sign In / Providers → Email:** turn **off** "Allow new users to sign up",
   so nobody can register themselves. Officers join only by invite.
4. **Authentication → URL Configuration:** set **Site URL** to where the app is
   hosted and add the same URL (and `http://localhost:8000` for testing) under
   **Redirect URLs**, so invite links come back to the app.
5. **Edge Functions →** deploy [`supabase/functions/invite-officer/index.ts`](supabase/functions/invite-officer/index.ts)
   as a function named `invite-officer`. It checks that the caller is an active
   admin, then sends Supabase's invite email. It uses the service-role key that
   Supabase provides to functions automatically, so the key stays on the server.
6. **First admin:** Authentication → Users → **Add user** (tick "Auto Confirm
   User"), then run the "FIRST ADMIN" snippet at the bottom of `schema.sql` with
   that email.

**How it works:** an admin opens **Officers**, enters a name and email, and
Supabase emails the officer a one-time link. The link opens the app signed in,
asks them to choose a password (min. 8 characters, a letter and a number), and
marks the account active. Admins can disable, re-enable or remove other officers
(never themselves), and a disabled officer is signed out within 30 seconds.

**Where the data lives in Supabase mode:** complaints, citizen notifications and
the audit log are stored in Supabase and shared by every officer and citizen.
- Only signed-in, active admins can read or change the tables (row-level security).
  The Command Center updates live when anything changes.
- Citizens have no login. Each browser gets a random private reporter token;
  reports go through server functions that validate the input, work out severity
  and priority on the server, and only ever return that browser's own reports,
  never priority scores. The public city map shows active incidents without
  names, phone numbers or scores. Max 5 reports per device per 10 minutes.
- The audit log is append-only: the server stamps the time and signed-in user,
  and nobody can edit or delete entries. "Reset demo data" restores the 13 demo
  incidents for everyone but keeps the audit log.

**Citizen notifications and vehicle tracking:** citizens are notified when their
report is received and when a vehicle is dispatched (with its base, distance and
estimated arrival), and at each later step. Under **My Reports** a live tracker
shows the vehicle's distance and arrival time, and the citizen map highlights
"Your rescue vehicle". Vehicle positions are simulated from the dispatch time
(no real GPS yet), so every screen shows the same position.

## Suggested demo flow
1. Open the Citizen portal in one browser tab and the Admin center in a second tab.
2. As a citizen, file: "Rescue needed, chest-deep water, 6 people, Velachery".
3. Citizens never pick or see a severity: the system assesses it from type,
   water depth and people affected, and only the officer sees the priority.
4. In the Admin tab: it tops the Priority Queue; assign a boat agent in the
   Complaints Register and watch the agent drive to the zone on the live map.
5. Back in the Citizen tab: the 🔔 bell shows "Vehicle dispatched!" in real time.
6. Admin → set status to In Progress / Resolved → citizen gets notified at each step.

## Notes
- Data persists in the browser (localStorage). Use "Reset demo data" in the
  Complaints Register tab to restore the 12 seeded incidents.
- Historical disaster figures (2004 Tsunami, 2015 Floods, Vardah, 2019 Water
  Crisis, Mandous, Michaung) are approximate, compiled from public reporting
  for demo calibration.

## Security notes — read before adding a backend

This prototype runs entirely in the browser with no server, so all data already
belongs to whoever opens the page. The items below are **safe as a demo** and
become **real vulnerabilities the moment a shared backend exists**, because each
one trusts the client.

- **The demo admin login is not authentication.** Only a SHA-256 hash of
  `email:password` is stored in `index.html` (`ADMIN_ACCOUNTS`), but the hash can
  be brute-forced offline and the check is client-side only —
  calling `show("admin")` from devtools skips it. In Supabase mode this no longer
  matters: passwords are checked by Supabase, and the incident data itself is
  protected by row-level security on the server, so opening the admin screens
  without signing in shows no data.

- **Citizen tokens are per browser.** Clearing site data or switching devices
  loses access to "My Reports" (the reports themselves stay with the command
  center). Anyone holding a citizen's token can see that citizen's reports.

- **Ownership filtering (demo mode only).** In demo mode citizens see only their
  own reports because the browser filters on `owner`. In Supabase mode this is
  enforced on the server.

- **Escape anything a reporter typed.** Reporter-supplied `name`, `phone` and
  `desc` are untrusted. Use the `esc()` helper for every such value interpolated
  into `innerHTML`; a name like `<img src=x onerror=...>` otherwise executes in
  the admin's session. This bug was present and has been fixed — keep new render
  code consistent with it.

Already handled: phone is validated to 10 digits, the people count is coerced to
a number, zone/type/depth come from fixed `<select>` options, and severity is computed
by the system rather than entered by the user. In demo mode the app makes no
network calls besides Google Fonts; in Supabase mode it also loads supabase-js
from jsDelivr and talks to your Supabase project. It uses no `eval`,
`document.write` or similar sinks.
