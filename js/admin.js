/* =================================================================
   COMMAND CENTER — KPIs, queue, register, review panel, analytics, officers
   ================================================================= */
/* =================================================================
   ADMIN DASHBOARD
   ================================================================= */
const pl = (n,w)=> `${n} ${w}${n===1?"":"s"}`;
function median(a){ if(!a.length) return null; const s=a.slice().sort((x,y)=>x-y), m=s.length>>1; return s.length%2? s[m] : (s[m-1]+s[m])/2; }
function fmtDur(ms){ if(ms==null) return "—"; const s = ms/1000; return s<90? Math.round(s)+" s" : r1(s/60)+" min"; }
function sessionTimes(){
  const live = complaints.filter(c=>c.source!=="seed" && c.t?.dispatched);
  return {n: live.length, med: median(live.map(c=>c.t.dispatched - c.ts))};
}
function renderKPIs(){
  const act = complaints.filter(c=>c.status!=="Resolved");
  const pend = act.filter(c=>c.status==="Pending");
  const crit = act.filter(c=>c.score>=75);
  const resolved = complaints.filter(c=>c.status==="Resolved").length;
  const busy = Object.keys(busyMap()).length;
  const people = act.reduce((s,c)=>s+(c.people||0),0);
  const st = sessionTimes();
  const k = (label,val,sub,dot)=>`<div class="kpi"><div class="k-label">${label}</div><div class="k-val">${val}</div><div class="k-sub">${dot?`<span class="kdot" style="background:${dot}"></span>`:""}${sub}</div></div>`;
  document.getElementById("kpiRow").innerHTML =
    k("Awaiting approval", pend.length, `${pend.filter(c=>c.score>=75).length} critical · ${pl(pend.filter(c=>c.dupOf).length,"possible duplicate")}`, "#fab219") +
    k("Active incidents", act.length, `${complaints.length} reports total`) +
    k("Critical priority", crit.length, "score ≥ 75", "#d03b3b") +
    k("People affected", people, "in active incidents") +
    k("Vehicles deployed", `${busy}/${FLEET.length}`, "one task per vehicle", "#3987e5") +
    k("Report → dispatch", fmtDur(st.med), st.n? `median · n=${st.n} this session` : "median · after first approval", "#9085e9") +
    k("Resolved", resolved, `${complaints.filter(c=>c.crewDone && c.status!=="Resolved").length} awaiting officer closure`, "#0ca30c");
}

const stClass = s=>({"Pending":"st-pending","Dispatched":"st-dispatched","Accepted":"st-accepted","In Progress":"st-inprogress","Resolved":"st-resolved"})[s];
function prBadge(c){
  return `<span class="pr-badge ${priorityClass(c.score)}">${priorityLabel(c.score)} ${c.score}</span>` +
    (c.override? `<span class="ovr" title="AI score ${c.aiScore}, overridden: ${esc(c.override.reason)}">✎ AI ${c.aiScore}</span>`:"") +
    (c.dupOf && c.status!=="Resolved"? `<span class="flag" title="Same zone and type within ${DUP_WINDOW_MIN} min">⚑ dup? ${esc(c.dupOf)}</span>`:"");
}
function renderRegister(){
  const fs = document.getElementById("filterStatus").value;
  const fz = document.getElementById("filterZone").value;
  const ft = document.getElementById("filterText").value.toLowerCase();
  const rows = complaints
    .filter(c=> (!fs || c.status===fs) && (!fz || c.zone===fz) &&
      (!ft || (c.name+" "+c.desc+" "+c.id).toLowerCase().includes(ft)))
    .slice().sort((a,b)=> (a.status==="Resolved") - (b.status==="Resolved") || (b.status==="Pending") - (a.status==="Pending") || b.score - a.score);
  document.getElementById("registerBody").innerHTML = rows.map(c=>`
    <tr>
      <td class="mono"><b>${esc(c.id)}</b></td>
      <td class="mono" style="color:var(--muted)">${hhmm(c.ts)}</td>
      <td><b>${esc(c.name)}</b><br><span style="color:var(--muted); font-size:11.5px;">${esc(c.phone)}</span></td>
      <td>${Z[c.zone]?.name||esc(c.zone)}</td>
      <td title="${esc(c.desc)}">${TYPE_META[c.type].icon} ${TYPE_META[c.type].label}</td>
      <td class="mono">${c.people}</td>
      <td>${prBadge(c)}</td>
      <td><span class="badge-st ${stClass(c.status)}">${c.status}</span></td>
      <td>${c.agent? agentDisplay(c.agent).split(" (")[0] : '<span style="color:var(--muted)">—</span>'}</td>
      <td><button class="btn sm ${c.status==="Pending"?"":"ghost"}" onclick="openIncident('${esc(c.id)}')">${c.status==="Pending"?"Review":"Open"}</button></td>
    </tr>`).join("") || `<tr><td colspan="10" style="text-align:center; color:var(--muted); padding:24px;">No complaints match the filters.</td></tr>`;
}

function renderFleet(){
  const busy = busyMap();
  const stateTxt = {"Dispatched":"EN ROUTE","Accepted":"ACCEPTED","In Progress":"ON SCENE"};
  document.getElementById("fleetList").innerHTML = FLEET.map(f=>{
    const t = busy[f.id] && complaints.find(c=>c.id===busy[f.id]);
    return `<div class="agent-row ${t?"clickrow":""}" ${t?`onclick="openIncident('${t.id}')"`:""}>
      <div class="agent-ic">${f.icon}</div>
      <div><div class="a-name">${f.name}</div>
      <div class="a-sub">${t? `→ ${Z[t.zone].name} · ${t.id}` : `Standby · ${Z[f.home].name}`}</div></div>
      <span class="a-state ${t?"a-busy":"a-free"}">${t? (t.crewDone? "DONE · CLOSE" : stateTxt[t.status]||"ON TASK") : "AVAILABLE"}</span>
    </div>`;
  }).join("");
}
function renderQueue(){
  const act = c=> c.status==="Pending" || c.crewDone ? 1 : 0;
  const q = complaints.filter(c=>c.status!=="Resolved").slice().sort((a,b)=> act(b)-act(a) || effScore(b)-effScore(a) || b.score-a.score).slice(0,60);
  document.getElementById("priorityQueue").innerHTML = q.map((c,i)=>{
    const rec = c.status==="Pending"? pickAgent(c) : null;
    return `<div class="agent-row clickrow" onclick="openIncident('${c.id}')">
      <div class="agent-ic" style="font-size:13px; font-weight:800; color:var(--muted);">#${i+1}</div>
      <div><div class="a-name">${TYPE_META[c.type].icon} ${Z[c.zone].name} · ${c.people} ppl${c.dupOf?' <span class="flag">⚑ dup?</span>':""}</div>
      <div class="a-sub">${c.id} · ${c.status==="Pending"? `<b style="color:var(--warn)">Needs approval</b> · rec. ${rec? agentDisplay(rec).split(" (")[0] : "no vehicle free"}` : c.crewDone? `<b style="color:#4cc94c">Crew done · ready to close</b> · ${c.agent}` : c.status+(c.agent? " · "+c.agent:"")}</div></div>
      <span style="margin-left:auto; display:flex; align-items:center; gap:6px;">${alertChip(c)}<span class="pr-badge ${priorityClass(c.score)}">${c.score}</span></span>
    </div>`;
  }).join("") || `<div style="color:var(--muted); font-size:13px;">All incidents resolved. 🎉</div>`;
}

/* ---------- Incident review panel (human-in-the-loop) ---------- */
let openId = null, overrideOpen = false, agentChoice = {};
function openIncident(id){ openId = id; overrideOpen = false; renderModal(); document.getElementById("modalBg").classList.add("open"); }
function closeIncident(){ openId = null; overrideOpen = false; document.getElementById("modalBg").classList.remove("open"); }
document.addEventListener("keydown", e=>{ if(e.key==="Escape" && openId) closeIncident(); });
function modalBusy(){
  const m = document.getElementById("modal");
  if(overrideOpen) return true;
  const a = document.activeElement;
  if(m.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return true;
  return [...m.querySelectorAll("input[type=text],textarea")].some(el=>el.value.trim());
}
function renderModal(){
  if(!openId) return;
  const c = complaints.find(x=>x.id===openId); if(!c){ closeIncident(); return; }
  const parts = scoreParts(c), raw = parts.reduce((s,p)=>s+p[1],0);
  const busy = busyMap(c);
  const rec = pickAgent(c);
  const choice = agentChoice[c.id] && !busy[agentChoice[c.id]] ? agentChoice[c.id] : rec;
  const events = auditLog.filter(e=>e.cid===c.id);
  const dup = c.dupOf && complaints.find(x=>x.id===c.dupOf);
  let html = `
  <div class="m-head">
    <h3>${TYPE_META[c.type].icon} ${esc(c.id)} · ${TYPE_META[c.type].label} — ${Z[c.zone].name}</h3>
    <span class="badge-st ${stClass(c.status)}">${c.status}</span>
    <button class="m-x" onclick="closeIncident()" title="Close (Esc)">✕</button>
  </div>
  <div class="m-body">
    <div class="m-sec">
      <h4>Report</h4>
      <div class="m-facts">
        <div><span>Reporter</span>${esc(c.name)}<br><span style="text-transform:none">${esc(c.phone)}</span></div>
        <div><span>Reported</span>${hhmm(c.ts)}</div>
        <div><span>People</span>${c.people}</div>
        <div><span>Water / severity</span>${DEPTH_NAMES[c.depth||0]} · ${SEV_NAMES[c.severity]}</div>
      </div>
      <div class="m-desc">${linkGps(esc(c.desc))}</div>
    </div>`;

  if(c.dupOf && c.status!=="Resolved"){
    html += `<div class="warnbox">⚑ <b>Possible duplicate</b> of <a href="#" onclick="openIncident('${esc(c.dupOf)}');return false;" style="color:#6db3ff">${esc(c.dupOf)}</a>
      ${dup? ` (${TYPE_META[dup.type].label}, ${Z[dup.zone].name}, reported ${Math.round(Math.abs(c.ts-dup.ts)/60000)} min apart, status ${dup.status}${dup.agent? ", "+dup.agent:""})`:""}.
      The system never merges reports automatically.
      <div class="m-actions">
        <button class="btn sm" onclick="linkDuplicate('${c.id}')">Link as duplicate &amp; close</button>
        <button class="btn ghost sm" onclick="dismissDuplicate('${c.id}')">Not a duplicate</button>
      </div></div>`;
  }

  html += `<div class="m-sec">
      <h4>Priority</h4>
      <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
        <span class="pr-badge ${priorityClass(c.score)}" style="font-size:14px; padding:6px 12px;">${priorityLabel(c.score)} · ${c.score}</span>
        ${c.override? `<span style="font-size:12.5px; color:var(--ink2)">AI score <b>${c.aiScore}</b> overridden by <b>${esc(c.override.by)}</b> at ${hhmm(c.override.ts)}: “${esc(c.override.reason)}”</span>` : `<span style="font-size:12.5px; color:var(--muted)">Rule-based AI score (not yet overridden)</span>`}
      </div>
      <table class="bd" style="margin-top:10px;">
        ${parts.map(p=>`<tr><td>${esc(p[0])}</td><td>${r1(p[1])}</td></tr>`).join("")}
        <tr class="tot"><td>AI score${raw>100?" (capped at 100)":""}</td><td>${c.aiScore}</td></tr>
        ${alertBoost(c.zone)? `<tr><td>⚠ Alert Watch agent: active IMD alert covers ${Z[c.zone].name} (queue ranking only)</td><td>+${alertBoost(c.zone)}</td></tr>`:""}
      </table>`;
  if(c.status!=="Resolved"){
    html += overrideOpen ? `
      <div class="m-actions">
        <label style="margin:0">New score</label><input type="number" id="ovrVal" min="0" max="100" value="${c.score}" style="width:90px">
        <input type="text" id="ovrReason" placeholder="Reason (required), e.g. caller confirmed infant on site" style="flex:1; min-width:240px">
        <button class="btn sm" onclick="applyOverride('${c.id}')">Apply override</button>
        <button class="btn ghost sm" onclick="overrideOpen=false; renderModal()">Cancel</button>
      </div>` : `
      <div class="m-actions">
        <button class="btn ghost sm" onclick="overrideOpen=true; renderModal(); document.getElementById('ovrVal').focus()">✎ Override priority</button>
        ${c.override? `<button class="btn ghost sm" onclick="revertOverride('${c.id}')">↺ Revert to AI score</button>`:""}
      </div>`;
  }
  html += `</div>`;

  { /* volunteer team: proposed while pending, assigned after dispatch */
    const avols = (volAssign[c.id]||[]).map(id=>VOLUNTEERS.find(v=>v.id===id)).filter(Boolean);
    const pvols = c.status==="Pending" ? pickVols(c) : [];
    const vrow = v => `<span class="vol-chip" title="Home zone: ${Z[v.zone]?.name}">${esc(v.name)} · ${v.skills.map(s=>VOL_SKILLS[s]).join(", ")}</span>`;
    if(avols.length || pvols.length){
      html += `<div class="m-sec"><h4>Volunteer team</h4>
        <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
          ${(avols.length? avols : pvols).map(vrow).join("")}
          <span style="font-size:12px; color:var(--muted)">${avols.length? "Assigned with the vehicle" : "Will be assigned on dispatch (skill + nearest home zone)"}</span>
        </div></div>`;
    }
  }

  if(c.status==="Pending"){
    html += `<div class="m-sec">
      <h4>Dispatch decision</h4>
      <div style="font-size:13px;">${rec? `Recommended: <b>${agentDisplay(rec)}</b> <span style="color:var(--muted)">· ${recReason(c)}</span>` :
        `<span style="color:var(--warn)"><b>No vehicle is free.</b> Every vehicle is on an active task. Keep this pending, or close a finished task to free one.</span>`}</div>
      <div class="m-actions">
        <select id="agentSel" onchange="agentChoice['${c.id}']=this.value">
          ${FLEET.map(f=>`<option value="${f.id}" ${busy[f.id]?"disabled":""} ${f.id===choice?"selected":""}>${f.icon} ${f.id}${busy[f.id]? " · busy on "+busy[f.id] : f.id===rec? " · recommended":""}</option>`).join("")}
        </select>
        <button class="btn" ${rec && !c.dupOf?"":"disabled style='opacity:.5'"} onclick="approveDispatch('${c.id}')">✔ Approve &amp; dispatch</button>
      </div>
      <div class="hint">${c.dupOf? "Resolve the duplicate flag above first (one click if it is a separate emergency)." : "The system only recommends. Nothing is dispatched until an officer approves."}</div>
    </div>`;
  } else if(c.status!=="Resolved"){
    const next = c.status==="Dispatched"? ["Accepted","📡 Record crew acceptance"] : c.status==="Accepted"? ["In Progress","🛟 Mark crew on scene"] : !c.crewDone? ["","📝 Record crew completion report"] : null;
    html += `<div class="m-sec">
      <h4>Field operation</h4>
      <div style="font-size:13px;">Assigned: <b>${agentDisplay(c.agent)}</b>${c.approvedBy? ` · approved by ${esc(c.approvedBy)}`:""}</div>
      ${c.crewDone? `<div class="okbox" style="margin-top:10px;">📋 <b>Crew report:</b> ${esc(c.crewReport)}. Confirm the outcome below to close and free the vehicle.</div>`:""}
      <div class="m-actions">
        ${next? `<button class="btn ghost sm" onclick="advanceOne('${c.id}', true)">${next[1]}</button>`:""}
        <button class="btn ghost sm" onclick="releaseVehicle('${c.id}')">↩ Release vehicle &amp; return to pending</button>
      </div>
      <div class="m-actions">
        <input type="text" id="outcomeTxt" placeholder="Outcome (required to close), e.g. 6 people evacuated to relief camp" value="${c.crewDone? esc(c.crewReport):""}" style="flex:1; min-width:280px">
        <button class="btn sm" style="background:#199e70" onclick="resolveIncident('${c.id}')">✅ Close incident</button>
      </div>
    </div>`;
  } else {
    html += `<div class="okbox"><b>Closed.</b> ${esc(c.outcome||"Resolved")}${c.closedBy? ` · by ${esc(c.closedBy)}`:""}${c.t?.resolved? ` at ${hhmm(c.t.resolved)}`:""}</div>`;
  }

  html += `<div class="m-sec">
      <h4>Timeline (from audit log)</h4>
      <div class="tl">${events.length? events.map(e=>`<div><span class="tl-t">${hhmmss(e.ts)}</span><span><b>${esc(e.action)}</b> · ${esc(e.actor)}${e.detail? " · "+esc(e.detail):""}</span></div>`).join("")
        : `<div><span style="color:var(--muted)">Seeded incident: no recorded events yet.</span></div>`}</div>
    </div>
  </div>`;
  document.getElementById("modal").innerHTML = html;
}

/* ---------- officer actions ---------- */
function applyOverride(id){
  const c = getC(id); if(!c) return;
  const v = Math.round(+document.getElementById("ovrVal").value);
  const reason = document.getElementById("ovrReason").value.trim();
  if(!(v>=0 && v<=100)){ toast("Score must be between 0 and 100.", true); return; }
  if(reason.length<5){ toast("Please give a reason for the override.", true); return; }
  if(v===c.score){ toast("That is already the current score.", true); return; }
  const from = c.score;
  c.score = v; c.override = {by:currentAdmin, ts:Date.now(), reason, from};
  overrideOpen = false;
  log(currentAdmin, "Priority override", id, `${from} → ${v} (AI ${c.aiScore}) · reason: ${reason}`);
  commit(); toast(`${id} priority set to ${v}.`);
}
function revertOverride(id){
  const c = getC(id); if(!c) return;
  log(currentAdmin, "Override reverted", id, `${c.score} → AI ${c.aiScore}`);
  c.score = c.aiScore; delete c.override; commit();
}
function linkDuplicate(id){
  const c = getC(id); if(!c) return;
  c.status = "Resolved"; c.outcome = `Linked as duplicate of ${c.dupOf}`; c.closedBy = currentAdmin; c.t = c.t||{}; c.t.resolved = Date.now(); c.dupResolved = "linked";
  log(currentAdmin, "Linked as duplicate", id, `of ${c.dupOf}; closed without dispatch`);
  notify(c, `Your report was linked to ${c.dupOf}, an incident at the same location that a rescue team is already handling.`, "🔗");
  commit(); toast(`${id} linked to ${c.dupOf}.`);
}
function dismissDuplicate(id){
  const c = getC(id); if(!c) return;
  log(currentAdmin, "Duplicate flag dismissed", id, `not a duplicate of ${c.dupOf}`);
  c.dupResolved = "dismissed"; c.dupOf = null; commit();
}
function resolveIncident(id){
  const c = getC(id); if(!c) return;
  const out = (document.getElementById("outcomeTxt")?.value||"").trim();
  if(out.length<4){ toast("Enter an outcome before closing the incident.", true); return; }
  const prev = c.status;
  c.status = "Resolved"; c.outcome = out; c.closedBy = currentAdmin; c.t = c.t||{}; c.t.resolved = Date.now();
  log(currentAdmin, "Incident closed", id, `${c.agent||"no vehicle"} released · outcome: ${out}`);
  notifyStatusChange(c, prev); commit(); toast(`${id} closed.`);
}

/* ---------- audit tab ---------- */
function renderAudit(){
  const b = document.getElementById("auditBody"); if(!b) return;
  b.innerHTML = auditLog.slice().reverse().map(e=>`<tr>
    <td class="mono" style="color:var(--muted)">${hhmmss(e.ts)}</td>
    <td>${esc(e.actor)}</td><td><b>${esc(e.action)}</b></td>
    <td class="mono">${e.cid && e.cid!=="—"? `<a href="#" style="color:#6db3ff" onclick="openIncident('${esc(e.cid)}');return false;">${esc(e.cid)}</a>`:"—"}</td>
    <td style="color:var(--ink2)">${esc(e.detail)}</td></tr>`).join("") ||
    `<tr><td colspan="5" style="text-align:center; color:var(--muted); padding:24px;">No events yet.</td></tr>`;
}
function exportAudit(){
  const q = v=>`"${String(v??"").replace(/"/g,'""')}"`;
  const csv = ["time,actor,action,incident,detail", ...auditLog.map(e=>[new Date(e.ts).toISOString(), e.actor, e.action, e.cid, e.detail].map(q).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download = "aquila_audit_log.csv"; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
}

/* ---------- simulation controls ---------- */
const SCENARIO = [
  ["velachery","rescue",4,8,4,"Family stranded on first floor near Velachery lake, water still rising."],
  ["pallikaranai","flood",3,10,3,"Marsh overflow entering houses on 200 Feet Road."],
  ["perungudi","flood",3,6,3,"Water entering ground-floor homes near Perungudi lake."],
  ["tambaram","flood",3,15,2,"Knee-deep water across Tambaram West, families moving upstairs."],
  ["mudichur","rescue",4,5,4,"Elderly couple trapped, cannot climb to terrace."],
  ["madipakkam","relief",2,30,1,"30 families in Ram Nagar need drinking water and food."],
  ["velachery","rescue",4,8,4,"Same building near Velachery lake, neighbour calling for family stuck on first floor."],
  ["sholinganallur","waterlogging",2,4,2,"OMR service road blocked, vehicles stranded."],
  ["saidapet","medical",4,1,2,"Pregnant woman in labour needs hospital transfer."],
  ["chromepet","tree",2,3,0,"Large tree fell on a parked car on GST Road."],
  ["adyar","flood",3,6,3,"Adyar river water entering Kotturpuram homes."],
  ["guindy","power",3,12,1,"Live wire fallen into standing water near Guindy junction."],
  ["tnagar","waterlogging",1,2,1,"Usman Road subway waterlogged."],
  ["porur","flood",2,5,2,"Porur lake overflow reaching nearby streets."],
  ["pallikaranai","flood",3,9,3,"Water entering homes on 200 Feet Road, caller says neighbours already reported."],
  ["thiruvanmiyur","relief",2,25,1,"Relief camp at school needs food packets for 25 people."],
  ["tambaram","rescue",4,3,3,"Three people trapped in a ground-floor house in Mudichur Road."],
  ["egmore","medical",3,1,1,"Diabetic patient needs insulin, roads waterlogged."],
];
const SCENARIO_HEAT = [
  ["tnagar","heatstroke",4,1,0,"Street vendor collapsed near Pondy Bazaar, conscious but not responding properly."],
  ["egmore","dehydration",2,3,0,"Three construction workers dizzy and cramping on a site, no shade or water."],
  ["washermanpet","watershort",2,40,0,"Street taps dry since morning, 40 families need drinking water."],
  ["royapuram","heatstroke",4,1,0,"Elderly woman fainted inside a tin-roof house, skin hot and dry."],
  ["tnagar","dehydration",2,6,0,"Six schoolchildren exhausted after sports event, two vomiting."],
  ["koyambedu","watershort",2,25,0,"Market porters have no drinking water point, several feeling faint."],
  ["ambattur","heatstroke",4,1,0,"Factory worker collapsed on shift, not sweating despite the heat."],
  ["egmore","watershort",1,15,0,"Apartment block tanker did not arrive, 15 families short of water."],
  ["guindy","dehydration",2,4,0,"Traffic constables feeling faint at the junction, requesting ORS."],
  ["washermanpet","relief",2,30,0,"Cooling centre at the school needs water cans and ORS for 30 people."],
  ["tnagar","power",2,50,0,"Transformer tripped — no fans or coolers in the block during peak heat."],
  ["adyar","heatstroke",4,1,0,"Delivery rider collapsed near the signal, bystanders moved him to shade."],
];
const SC_NAMES = ["Priya R","Mohan K","Asha V","Ravi S","Nirmala D","Senthil P","Kavya M","Balaji T","Hema L","Imran A","Deepa J","Gokul R","Revathi S","Aravind N","Bhavani K","Manoj P","Sangeetha V","Farhan M"];
let scenarioTimer = null;
function runScenario(kind){
  if(scenarioTimer) return;
  kind = kind==="heat" ? "heat" : "flood";
  const list = kind==="heat" ? SCENARIO_HEAT : SCENARIO;
  const label = kind==="heat" ? "2024-style heatwave scenario" : "Michaung-style cloudburst scenario";
  const btns = ["scenarioBtn","scenarioBtnH"].map(id=>document.getElementById(id)).filter(Boolean);
  const st = document.getElementById("simStatus");
  let i = 0; btns.forEach(b=>{ b.disabled = true; b.style.opacity = .6; });
  log(currentAdmin||"System", "Scenario started", "—", `${label}, ${list.length} scripted reports`);
  scenarioTimer = setInterval(()=>{
    const [zone,type,severity,people,depth,desc] = list[i];
    addReport({zone,type,severity,people,depth,desc, name:SC_NAMES[i%SC_NAMES.length], phone:"9"+String(800000000+i*7919).slice(0,9)}, "scenario");
    i++; st.textContent = `Scenario running: ${i}/${list.length} reports received`;
    refreshAll();
    if(i>=list.length){
      clearInterval(scenarioTimer); scenarioTimer = null; btns.forEach(b=>{ b.disabled = false; b.style.opacity = 1; });
      st.textContent = `Scenario complete: ${list.length} reports. Review the AI Priority Queue and approve dispatches.`;
      log(currentAdmin||"System", "Scenario finished", "—", `${list.length} reports received`);
      toast("Scenario complete. Review and approve the queue.");
    }
  }, 1500);
}

/* ---------- volunteers page ---------- */
function renderVolunteers(){
  const host = document.getElementById("volList"); if(!host) return;
  const busy = volBusyMap();
  host.innerHTML = VOLUNTEERS.map(v=>{
    const cid = busy[v.id]; const c = cid && complaints.find(x=>x.id===cid);
    return `<div class="agent-row ${c?"clickrow":""}" ${c?`onclick="openIncident('${c.id}')"`:""}>
      <div class="agent-ic">🙋</div>
      <div><div class="a-name">${esc(v.name)} <span style="font-weight:500; color:var(--muted); font-size:12px;">· ${Z[v.zone]?.name}</span></div>
      <div class="a-sub">${v.skills.map(s=>VOL_SKILLS[s]).join(" · ")}${c? ` → ${c.id} (${Z[c.zone].name})`:""}</div></div>
      <span class="a-state ${c?"a-busy":"a-free"}">${c? "ON TASK" : "AVAILABLE"}</span>
    </div>`;
  }).join("");
  const sum = document.getElementById("volSummary");
  if(sum){ const n = Object.keys(busy).length; sum.textContent = `${VOLUNTEERS.length} registered · ${VOLUNTEERS.length-n} available · ${n} on task · matched by skill + nearest home zone, assigned with the vehicle on dispatch`; }
}

/* ---------- relief supply inventory ---------- */
function renderSupplies(){
  const host = document.getElementById("invList"); if(!host) return;
  host.innerHTML = SUPPLY_DEF.map(([k,label,max])=>{
    const v = supplies[k] ?? max, pct = Math.max(0, Math.min(100, Math.round(v/max*100)));
    return `<div class="inv-row"><span class="inv-label">${label}</span>
      <div class="inv-bar"><i style="width:${pct}%;${pct<20?"background:var(--danger,#e5484d);":""}"></i></div>
      <span class="inv-num ${pct<20?"low":""}">${v.toLocaleString("en-IN")}${pct<20?" ⚠":""}</span></div>`;
  }).join("");
}
setInterval(()=>{ const t = document.getElementById("autoAdvance"); if(t && t.checked) advanceField(false); }, 10000);

/* ---------- SVG bar charts (dataviz spec: thin marks, rounded data-end, hairline grid) ---------- */
function barChartH(hostId, data, color, unit){
  const host = document.getElementById(hostId); if(!host) return;
  const W=560, rowH=30, padL=130, padR=64, H=data.length*rowH+16;
  const max = Math.max(...data.map(d=>d.v), 1);
  let s = `<svg viewBox="0 0 ${W} ${H}" style="width:100%; height:auto;">`;
  [0.25,0.5,0.75,1].forEach(f=>{
    const x = padL + (W-padL-padR)*f;
    s += `<line x1="${x}" y1="6" x2="${x}" y2="${H-8}" stroke="#163652" stroke-width="1"/>`;
  });
  data.forEach((d,i)=>{
    const y = 10+i*rowH, w = Math.max(3,(W-padL-padR)*(d.v/max));
    s += `<text x="${padL-10}" y="${y+12}" text-anchor="end" font-size="11.5" fill="#c3c2b7">${d.label}</text>`;
    s += `<path d="M${padL},${y} h${Math.max(0,w-4)} a4,4 0 0 1 4,4 v8 a4,4 0 0 1 -4,4 h-${Math.max(0,w-4)} z" fill="${d.color||color}" class="bar-mark" data-tip="${d.label}: ${d.v}${unit||""}"/>`;
    s += `<text x="${padL+w+8}" y="${y+12}" font-size="11.5" fill="#f0efec" font-weight="700" class="mono">${d.v}${unit||""}</text>`;
  });
  s += `</svg>`;
  host.innerHTML = s;
  attachBarTips(host);
}
function lineChart(hostId, data, color){
  const host = document.getElementById(hostId); if(!host) return;
  const W=1100, H=240, padL=44, padR=16, padT=14, padB=30;
  const max = Math.max(...data.map(d=>d.v), 4);
  const x = i => padL + (W-padL-padR) * (i/(data.length-1));
  const y = v => padT + (H-padT-padB) * (1 - v/max);
  let s = `<svg viewBox="0 0 ${W} ${H}" style="width:100%; height:auto;">`;
  const steps = 4;
  for(let g=0; g<=steps; g++){
    const vy = y(max*g/steps);
    s += `<line x1="${padL}" y1="${vy}" x2="${W-padR}" y2="${vy}" stroke="#163652" stroke-width="1"/>`;
    s += `<text x="${padL-8}" y="${vy+4}" text-anchor="end" font-size="10.5" fill="#898781" class="mono">${Math.round(max*g/steps)}</text>`;
  }
  const pts = data.map((d,i)=>[x(i), y(d.v)]);
  s += `<path d="M${pts.map(p=>p.join(",")).join(" L ")}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`;
  s += `<path d="M${pts.map(p=>p.join(",")).join(" L ")} L ${x(data.length-1)},${H-padB} L ${padL},${H-padB} Z" fill="${color}" opacity="0.08"/>`;
  data.forEach((d,i)=>{
    s += `<circle cx="${x(i)}" cy="${y(d.v)}" r="4" fill="${color}" stroke="#0a1a2b" stroke-width="2" class="bar-mark" data-tip="${d.label}: ${d.v} reports"/>`;
    if(i%2===0) s += `<text x="${x(i)}" y="${H-10}" text-anchor="middle" font-size="10.5" fill="#898781">${d.label}</text>`;
  });
  s += `</svg>`;
  host.innerHTML = s;
  attachBarTips(host);
}
function attachBarTips(host){
  let tip = host.parentElement.querySelector(".chart-tip");
  if(!tip){ tip = document.createElement("div"); tip.className="chart-tip"; host.parentElement.appendChild(tip); }
  host.querySelectorAll(".bar-mark").forEach(el=>{
    el.addEventListener("mousemove", ev=>{
      const r = host.parentElement.getBoundingClientRect();
      tip.style.display="block"; tip.textContent = el.dataset.tip;
      tip.style.left = Math.min(ev.clientX - r.left + 12, r.width-160)+"px";
      tip.style.top = (ev.clientY - r.top - 34)+"px";
    });
    el.addEventListener("mouseleave", ()=> tip.style.display="none");
  });
}

function renderAnalytics(){
  // by zone
  const zc = {};
  complaints.forEach(c=>{ zc[c.zone]=(zc[c.zone]||0)+1; });
  const zoneData = Object.entries(zc).map(([z,v])=>({label:Z[z]?.name||z, v}))
    .sort((a,b)=>b.v-a.v).slice(0,10);
  barChartH("chartZone", zoneData, "#3987e5");
  // by type
  const tc = {};
  complaints.forEach(c=>{ tc[c.type]=(tc[c.type]||0)+1; });
  const typeData = Object.entries(tc).map(([t,v])=>({label:TYPE_META[t].label, v})).sort((a,b)=>b.v-a.v);
  barChartH("chartType", typeData, "#199e70");
  // timeline (12 hourly buckets)
  const now = Date.now(), buckets = Array.from({length:12},(_,i)=>({label:new Date(now-(11-i)*3600e3).toLocaleTimeString("en-IN",{hour:"2-digit",hour12:true}), v:0}));
  complaints.forEach(c=>{
    const age = Math.floor((now - c.ts)/3600e3);
    if(age>=0 && age<12) buckets[11-age].v++;
  });
  lineChart("chartTimeline", buckets, "#3987e5");
}

function renderHistory(){
  document.getElementById("dsGrid").innerHTML = DISASTERS.map(d=>`
    <div class="ds-card" style="border-left-color:${d.col};">
      <div class="ds-yr">${d.yr}</div><h4>${d.name}</h4>
      <p>${d.desc}</p>
      <div class="ds-stats">${d.stats.map(([b,s])=>`<div><b>${b}</b><span>${s}</span></div>`).join("")}</div>
    </div>`).join("");
  barChartH("chartRain",
    DISASTERS.filter(d=>d.rain>0).map(d=>({label:d.name.replace("Cyclone ",""), v:d.rain, color:d.col})),
    "#3987e5", " mm");
  barChartH("chartRisk",
    ZONES.slice().sort((a,b)=>b.risk-a.risk).slice(0,10).map(z=>({label:z.name, v:z.risk,
      color: z.risk>=85? "#d03b3b" : z.risk>=70? "#ec835a" : "#c98500"})),
    "#ec835a");
}

/* sidebar navigation: one page per item */
function showPage(scope, page){
  document.querySelectorAll(`.sn-item[data-scope="${scope}"]`).forEach(x=>x.classList.toggle("active", x.dataset.page===page));
  const cls = scope==="admin"? ".apage" : ".cpage", pre = scope==="admin"? "tab-" : "cp-";
  document.querySelectorAll(cls).forEach(p=>p.classList.add("hidden"));
  document.getElementById(pre+page).classList.remove("hidden");
  if(scope==="admin" && page==="officers" && SB_ON) sbLoadOfficers();
  window.scrollTo({top:0, behavior:"smooth"});
}
function renderNavBadges(){
  const set = (id, v, warn)=>{ const e = document.getElementById("sb-"+id); if(!e) return; e.textContent = v; e.classList.toggle("warn", !!warn); e.style.display = (v===""||v===0)? "none":""; };
  const pend = complaints.filter(c=>c.status==="Pending").length + complaints.filter(c=>c.crewDone && c.status!=="Resolved").length;
  set("queue", pend, pend>0);
  set("fleet", `${Object.keys(busyMap()).length}/${FLEET.length}`);
  set("register", complaints.length);
  set("audit", auditLog.length);
  set("officers", SB_ON? sbOfficers.filter(o=>o.accepted_at && !o.disabled).length || "" : Object.keys(ADMIN_ACCOUNTS).length + Object.keys(officers.accounts).length);
  set("mine", complaints.filter(c=>c.source==="citizen" && (!c.owner || c.owner===currentUser) && c.status!=="Resolved").length);
}

/* ---------- refresh everything ---------- */
function refreshAll(){
  setTicker(); renderKPIs(); renderRegister(); renderFleet(); renderQueue(); renderAudit(); renderNavBadges();
  renderAnalytics(); renderHistory(); renderCitizen(); renderIncidents(); updateAgentTargets(); renderNotifs(); renderOfficers();
  renderAlertWatch(); renderVolunteers(); renderSupplies(); renderBroadcastsAdmin(); renderBroadcastsCitizen();
  if(openId && !modalBusy()) renderModal();
}

/* ---------- rain ---------- */
(function(){
  const host = document.getElementById("stars"); if(!host) return;
  let h = "";
  for(let i=0;i<45;i++){
    h += `<i style="left:${(Math.random()*104-2).toFixed(2)}%;height:${(40+Math.random()*70).toFixed(0)}px;--o:${(0.08+Math.random()*0.18).toFixed(2)};animation-duration:${(0.7+Math.random()*0.9).toFixed(2)}s;animation-delay:-${(Math.random()*2).toFixed(2)}s"></i>`;
  }
  host.innerHTML = h;
})();

/* ---------- AQUILA logo: frosted-glass "A" with a wave crossbar ---------- */
const A_PATH = "M100,10 L190,190 L146,190 L128,152 Q114,143 100,152 Q86,161 72,152 L54,190 L10,190 Z M100,68 L121,116 Q110,108 100,116 Q90,124 79,116 Z";
function logoSVG(uid, size){
  return `<svg viewBox="-8 -8 216 216" width="${size}" height="${size}" class="aq-logo" aria-label="AQUILA logo">
    <defs>
      <linearGradient id="${uid}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8cc4ff"/><stop offset=".45" stop-color="#2f7bf0"/><stop offset="1" stop-color="#22c9b8"/></linearGradient>
      <linearGradient id="${uid}d" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1d56b8"/><stop offset="1" stop-color="#0d8f8a"/></linearGradient>
      <linearGradient id="${uid}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset=".42" stop-color="#fff" stop-opacity=".14"/><stop offset=".62" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <linearGradient id="${uid}e" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".5" stop-color="#cdeeff" stop-opacity=".25"/><stop offset="1" stop-color="#b9fff2" stop-opacity=".8"/></linearGradient>
      <clipPath id="${uid}c"><path d="${A_PATH}" fill-rule="evenodd" clip-rule="evenodd"/></clipPath>
    </defs>
    <path d="${A_PATH}" fill="url(#${uid}d)" fill-rule="evenodd" opacity=".55" transform="translate(4 7)"/>
    <path d="${A_PATH}" fill="url(#${uid}b)" fill-rule="evenodd" opacity=".93"/>
    <g clip-path="url(#${uid}c)">
      <path d="${A_PATH}" fill="url(#${uid}s)" fill-rule="evenodd"/>
      <ellipse cx="70" cy="58" rx="70" ry="22" fill="#fff" opacity=".16" transform="rotate(-58 70 58)"/>
      <path d="M128,152 Q114,143 100,152 Q86,161 72,152" fill="none" stroke="#e8fbff" stroke-width="3" opacity=".7"/>
      <circle cx="62" cy="128" r="1.6" fill="#fff" opacity=".9"/><circle cx="74" cy="104" r="1" fill="#fff" opacity=".8"/>
      <circle cx="150" cy="168" r="1.4" fill="#fff" opacity=".8"/><circle cx="138" cy="150" r=".9" fill="#fff" opacity=".7"/>
      <circle cx="96" cy="40" r="1.1" fill="#fff" opacity=".85"/>
    </g>
    <path d="${A_PATH}" fill="none" stroke="url(#${uid}e)" stroke-width="2.6" stroke-linejoin="round" fill-rule="evenodd"/>
  </svg>`;
}
(function(){
  const n = document.getElementById("navLogo"); if(n) n.innerHTML = logoSVG("nl", 46);
  document.querySelectorAll(".topbar .brand").forEach((b,i)=> b.insertAdjacentHTML("afterbegin", logoSVG("tb"+i, 34)));
})();
