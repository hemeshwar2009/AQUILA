/* =================================================================
   BOOT — landing counters + startup sequence
   ================================================================= */
/* ---------- landing stat counters ---------- */
function animateCounters(){
  document.querySelectorAll(".hstat b[data-count]").forEach(el=>{
    const end = +el.dataset.count, t0 = performance.now();
    const step = t=>{ const p = Math.min(1,(t-t0)/1200); el.textContent = Math.round(end*(1-Math.pow(1-p,3))); if(p<1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}

/* ---------- boot ---------- */
loadAudit();
loadVols();
loadSupplies();
loadState();
loadNotifs();
loadOfficers();
loadBroadcasts();
initBroadcastUI();
initCitizenForm();
document.getElementById("filterZone").innerHTML = `<option value="">All zones</option>` +
  ZONES.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(z=>`<option value="${z.id}">${z.name}</option>`).join("");
buildMap("citizenMapWrap", false);
buildMap("adminMapWrap", true);
refreshAll();
initVoiceLangs();
initRouteBar();
aiPillUpdate();
animateCounters();
show("landing");
checkInviteLink();
