/* =================================================================
   FIELD AGENTS — simulated vehicle GPS, crew lifecycle, field updates
   ================================================================= */
/* ---------- simulated vehicle GPS ----------
   A dispatched vehicle drives from its base to the incident at a steady speed,
   computed from the dispatch time, so every screen (admin map, citizen map,
   citizen tracker) shows the same position. 1 map unit ≈ 30 m. */
const KM_PER_UNIT = 0.03;
const SPEED_UNITS_PER_S = {boat:2.5, truck:4, car:5, ambulance:5, logistics:4};
function vehicleTrack(c, now){
  const f = c && c.agent && FLEET.find(x=>x.id===c.agent); if(!f) return null;
  const from = Z[f.home], to = Z[c.zone]; if(!from || !to) return null;
  const dist = Math.hypot(to.x-from.x, to.y-from.y);
  const travelMs = Math.max(20000, dist / (SPEED_UNITS_PER_S[f.kind]||4) * 1000);
  const start = c.t?.dispatched || c.ts;
  const onScene = c.status==="In Progress" || c.status==="Resolved";
  const p = onScene ? 1 : Math.max(0, Math.min(1, ((now||Date.now()) - start) / travelMs));
  return {fleet:f, from, to, p, x: from.x + (to.x-from.x)*p, y: from.y + (to.y-from.y)*p,
    kmLeft: dist*(1-p)*KM_PER_UNIT, kmTotal: dist*KM_PER_UNIT, msLeft: travelMs*(1-p), arrived: p>=1, onScene};
}
function fmtEta(ms){ const s = Math.round(ms/1000); return s<60? `${s} s` : `${Math.floor(s/60)} min ${String(s%60).padStart(2,"0")} s`; }
function trackText(c){
  const tr = vehicleTrack(c); if(!tr) return "";
  if(tr.onScene) return `${tr.fleet.icon} ${tr.fleet.name} is at ${tr.to.name}; the crew is on scene.`;
  if(tr.arrived) return `${tr.fleet.icon} ${tr.fleet.name} has reached ${tr.to.name}; the crew is getting into position.`;
  return `${tr.fleet.icon} ${tr.fleet.name} is ${tr.kmLeft.toFixed(1)} km away, arriving in about ${fmtEta(tr.msLeft)}.`;
}

/* agent targets follow assignments */
function crewReportText(c){
  return ({rescue:`${c.people} people evacuated to a relief camp`, flood:"Residents moved to upper floors; pumping started",
    waterlogging:"Road cleared and reopened", medical:"Patient transferred to hospital",
    power:"Supply isolated; electricity board notified", tree:"Debris cleared; road reopened",
    relief:`Supplies delivered to ${c.people} people`})[c.type] || "Task completed";
}
function advanceOne(id, byOfficer){
  const c = getC(id); if(!c) return false;
  if(c.status==="In Progress" && !c.crewDone){
    c.crewDone = true; c.crewReport = crewReportText(c);
    log(byOfficer? `${currentAdmin} (relayed from ${c.agent} crew)` : `${c.agent} crew (simulated)`, "Crew reports task complete", id, c.crewReport + " · awaiting officer closure");
    notify(c, `The rescue crew reports your request at ${Z[c.zone].name} is complete. The command center will confirm shortly.`, "📋");
    if(byOfficer) commit();
    return true;
  }
  const next = {"Dispatched":"Accepted","Accepted":"In Progress"}[c.status]; if(!next) return false;
  const prev = c.status; c.status = next; c.t = c.t||{};
  c.t[next==="Accepted"?"accepted":"inprogress"] = Date.now();
  log(byOfficer? `${currentAdmin} (relayed from ${c.agent} crew)` : `${c.agent} crew (simulated)`, next==="Accepted"? "Crew accepted task" : "Crew on scene", id, "");
  notifyStatusChange(c, prev);
  if(byOfficer) commit();
  return true;
}
function releaseVehicle(id){
  const c = getC(id); if(!c) return;
  log(currentAdmin, "Vehicle released", id, `${c.agent} freed; incident back to pending`);
  c.agent = null; c.status = "Pending"; c.crewDone = false; commit();
}
function advanceField(manual){
  const ids = complaints.filter(c=>c.status==="Dispatched"||c.status==="Accepted"||(c.status==="In Progress"&&!c.crewDone)).map(c=>c.id);
  let n = 0; ids.forEach(id=>{ if(advanceOne(id, false)) n++; });
  if(n){ saveState(); refreshAll(); }
  if(manual) toast(n? `${n} field crew update(s) simulated.` : "No crews are currently en route.");
}
