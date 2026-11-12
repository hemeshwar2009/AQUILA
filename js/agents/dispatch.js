/* =================================================================
   DISPATCH AGENT — rule-based vehicle matching, officer-approved dispatch
   ================================================================= */
/* ---------- vehicle matching (rule-based) ---------- */
function busyMap(exceptC){
  const m = {};
  complaints.forEach(x=>{ if(x.agent && x.status!=="Resolved" && x!==exceptC) m[x.agent] = x.id; });
  return m;
}
function needsBoat(c){ return c.depth>=3 || (c.type==="rescue" && c.depth>=2); }
function prefOrder(c){
  if(needsBoat(c)) return ["boat","truck","ambulance","car","logistics"];
  if(c.type==="medical" || c.type==="heatstroke") return ["ambulance","car","truck","boat","logistics"];
  if(c.type==="dehydration") return ["ambulance","car","logistics","truck","boat"];
  if(c.type==="relief" || c.type==="watershort") return ["logistics","truck","car","boat","ambulance"];
  return ["truck","car","boat","logistics","ambulance"];
}
function recReason(c){
  if(needsBoat(c)) return "Water waist-deep or more → boat preferred";
  if(c.type==="heatstroke") return "Heat stroke → ambulance with cooling + ORS preferred";
  if(c.type==="medical") return "Medical emergency → ambulance preferred";
  if(c.type==="dehydration") return "Dehydration cases → ambulance or car with ORS preferred";
  if(c.type==="watershort") return "Water shortage → logistics (tanker/cans) preferred";
  if(c.type==="relief") return "Relief supplies → logistics vehicle preferred";
  return "Road-accessible incident → truck or car preferred";
}

/* ---------- volunteer matching (skill + home zone) ---------- */
function volSkillsFor(c){
  return ({heatstroke:["medic"], dehydration:["medic","driver"], medical:["medic"],
    rescue:["swimmer","medic"], flood:["swimmer","driver"], power:["electrician"],
    watershort:["driver","cook"], relief:["cook","driver"], tree:["driver"], waterlogging:["driver"]})[c.type] || ["driver"];
}
/* up to 2 free volunteers, skill match first, same home zone breaks ties */
function pickVols(c){
  const busy = volBusyMap(), need = volSkillsFor(c);
  const fit = v => (need.some(s=>v.skills.includes(s)) ? 2 : 0) + (v.zone===c.zone ? 1 : 0);
  return VOLUNTEERS.filter(v=>!busy[v.id] && fit(v)>0).sort((a,b)=>fit(b)-fit(a)).slice(0,2);
}
/* supplies the vehicle carries for this incident type */
function supplyPlan(c){
  const take = {};
  const kind = FLEET.find(f=>f.id===c.agent)?.kind;
  if(kind==="logistics"){ take.foodkits = Math.min(40, 2*(c.people||1)+10); take.water = 500; take.blankets = 20; }
  if(kind==="ambulance"){ take.medkits = 3; take.ors = 20; }
  if(c.type==="watershort") take.water = (take.water||0) + Math.min(2000, 25*(c.people||1));
  if(c.type==="dehydration" || c.type==="heatstroke") take.ors = (take.ors||0) + 20;
  if(c.type==="relief") take.foodkits = (take.foodkits||0) + Math.min(60, 2*(c.people||1));
  return take;
}
/* returns a free vehicle or null if the whole fleet is busy */
function pickAgent(c){
  const busy = busyMap(c);
  for(const k of prefOrder(c)){ const f = FLEET.find(f=>f.kind===k && !busy[f.id]); if(f) return f.id; }
  return null;
}

function getC(id){ return complaints.find(x=>x.id===id); }
function commit(){ saveState(); refreshAll(); renderModal(); }
function approveDispatch(id){
  const c = getC(id); if(!c || c.status!=="Pending") return;
  const sel = document.getElementById("agentSel"); const a = sel? sel.value : pickAgent(c);
  const busy = busyMap(c);
  if(c.dupOf){ toast("Resolve the duplicate flag first.", true); return; }
  if(!a){ toast("No vehicle selected.", true); return; }
  if(busy[a]){ toast(`${a} is already on ${busy[a]}. Choose a free vehicle.`, true); return; }
  const rec = pickAgent(c), prev = c.status;
  c.agent = a; c.status = "Dispatched"; c.t = c.t||{}; c.t.dispatched = Date.now(); c.approvedBy = currentAdmin;
  log(currentAdmin, "Approved & dispatched", id, `${a} · priority ${c.score}` + (a!==rec && rec? ` · officer chose ${a} over recommended ${rec}`:""));
  /* volunteer team rides along (skill + zone matched) */
  const vs = pickVols(c);
  if(vs.length){
    volAssign[c.id] = vs.map(v=>v.id); saveVols();
    log(currentAdmin, "Volunteers assigned", id, vs.map(v=>`${v.name} (${v.skills.map(s=>VOL_SKILLS[s]).join(", ")})`).join(" · "));
  }
  /* relief supplies loaded onto the vehicle */
  const used = useSupplies(supplyPlan(c));
  if(used.length) log("System", "Supplies allocated", id, used.join(", "));
  notifyStatusChange(c, prev); commit();
  toast(`${a} dispatched to ${id}${vs.length? ` with ${vs.length} volunteer${vs.length>1?"s":""}`:""}.`);
}
