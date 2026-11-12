/* =================================================================
   CITIZEN PORTAL — report form, my reports, notifications
   ================================================================= */
/* =================================================================
   CITIZEN DASHBOARD
   ================================================================= */
function initCitizenForm(){
  const zoneSel = document.getElementById("fZone");
  zoneSel.innerHTML = ZONES.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(z=>`<option value="${z.id}">${z.name}</option>`).join("");
}
/* severity is assessed by the system, never chosen by the citizen */
function draftComplaint(){
  const d = {
    zone: document.getElementById("fZone").value,
    type: document.getElementById("fType").value,
    people: Math.min(500, Math.max(1, +document.getElementById("fPeople").value || 1)),
    depth: +document.getElementById("fDepth").value || 0,
  };
  d.severity = assessSeverity(d);
  return d;
}
function addReport(fields, source, owner){
  if(SB_ON){ sbSubmitScenario(fields); return null; }   // scored and stored by the server
  const c = {...fields, id:nextId(), ts:Date.now(), status:"Pending", agent:null, source, owner:owner||null, t:{}};
  c.score = c.aiScore = priorityScore(c);
  c.dupOf = findDup(c);
  complaints.unshift(c); saveState();
  log(source==="citizen"? `Citizen: ${c.name}` : "Citizen (scenario)", "Report received", c.id,
      `${TYPE_META[c.type].label}, ${Z[c.zone].name}, ${c.people} people · AI priority ${c.score}` + (c.dupOf? ` · flagged possible duplicate of ${c.dupOf}`:""));
  return c;
}
let submitting = false;
function submitComplaint(){
  const name = document.getElementById("fName").value.trim();
  const phone = document.getElementById("fPhone").value.trim();
  if(!name){ toast("Please enter the reporter name.", true); return; }
  if(!/^[6-9]\d{9}$/.test(phone)){ toast("Please enter a valid 10-digit Indian mobile number.", true); return; }
  if(currentUser==="Guest Citizen") currentUser = name;
  voiceStop();
  const descVal = descWithGps(document.getElementById("fDesc").value.trim() || "—");
  if(SB_ON){
    if(submitting) return; submitting = true;
    const fields = {...draftComplaint(), name, phone, desc: descVal};
    sbCitizenSubmit(fields).then(async id=>{
      submitting = false; if(!id) return;
      gpsPos = null; const gs = document.getElementById("gpsStatus"); if(gs) gs.textContent = "";
      toast(`Report ${id} submitted. An officer is reviewing it.`);
      document.getElementById("fDesc").value=""; document.getElementById("fPhone").value="";
      showPage("citizen","mine"); await sbCitizenRefresh();
    });
    return;
  }
  const c = addReport({...draftComplaint(), name, phone, desc: descVal}, "citizen", currentUser);
  gpsPos = null; { const gs = document.getElementById("gpsStatus"); if(gs) gs.textContent = ""; }
  toast(`Report ${c.id} submitted. An officer is reviewing it.`);
  document.getElementById("fDesc").value=""; document.getElementById("fPhone").value="";
  showPage("citizen","mine");
  notify(c, `Report ${c.id} received by the Aquila command center; an officer is reviewing it.`, "📨");
  refreshAll();
}

function renderCitizen(){
  const mine = complaints.filter(c=>c.source==="citizen" && (!c.owner || c.owner===currentUser));
  document.getElementById("myCount").textContent = mine.length? `${mine.length} report(s) filed in this session.` : "No reports yet. Submit one on the left.";
  const stepIdx = s=> ({"Pending":0,"Dispatched":1,"Accepted":2,"In Progress":3,"Resolved":4})[s] ?? 0;
  document.getElementById("myComplaints").innerHTML = mine.map(c=>`
    <div class="c-complaint">
      <div class="c-top">
        <h4>${TYPE_META[c.type].icon} ${TYPE_META[c.type].label} — ${Z[c.zone].name}</h4>
        <span class="badge-st ${stClass(c.status)}">${c.status}</span>
      </div>
      <div class="c-meta">${esc(c.id)} · ${hhmm(c.ts)} · ${c.people} people${c.agent? " · Vehicle "+esc(c.agent):""}</div>
      <div class="steps">
        ${["Reported","Dispatched","Crew accepted","In progress","Resolved"].map((s,i)=>`<div class="step ${i<=stepIdx(c.status)?"done":""}">${s}</div>`).join("")}
      </div>
      <div class="c-meta" style="margin-top:8px;">${
        c.status==="Pending" ? "⏳ Awaiting command-center review" :
        c.status==="Resolved" ? "✅ " + esc(c.outcome||"Resolved") :
        "Last update " + hhmm(Math.max(c.t?.dispatched||0, c.t?.accepted||0, c.t?.inprogress||0, c.ts))}</div>
      ${c.agent && c.status!=="Pending" && c.status!=="Resolved" ? `
      <div class="tracker">
        <div class="tr-head"><span class="tr-live"></span>Live vehicle tracking <span style="color:var(--muted); font-weight:500;">· simulated GPS</span></div>
        <div class="tr-text" data-track="${esc(c.id)}">${esc(trackText(c))}</div>
        <div class="tr-bar"><i data-trackbar="${esc(c.id)}" style="width:${Math.round((vehicleTrack(c)?.p||0)*100)}%"></i></div>
        <div class="tr-ends"><span>${esc(vehicleTrack(c)?.from.name||"")} base</span><span>${esc(Z[c.zone].name)}</span></div>
        <button class="btn ghost sm" style="margin-top:8px;" onclick="showPage('citizen','cmap')">🗺️ See it on the live map</button>
      </div>` : ""}
    </div>`).join("");
}
/* keep the citizen's tracker text and progress bar moving every second */
setInterval(()=>{
  if(!document.getElementById("citizenShell").classList.contains("active")) return;
  document.querySelectorAll("[data-track]").forEach(el=>{
    const c = complaints.find(x=>x.id===el.dataset.track); if(!c) return;
    el.textContent = trackText(c);
    const bar = document.querySelector(`[data-trackbar="${CSS.escape(c.id)}"]`);
    if(bar) bar.style.width = Math.round((vehicleTrack(c)?.p||0)*100) + "%";
  });
}, 1000);
