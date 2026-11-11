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
- **Admin Command Center** — passcode: `aquila2026`

## Suggested demo flow
1. Open the Citizen portal in one browser tab and the Admin center in a second tab.
2. As a citizen, file: "Rescue needed, chest-deep water, 6 people, Velachery".
3. Watch the AI priority preview score it CRITICAL before you submit.
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
