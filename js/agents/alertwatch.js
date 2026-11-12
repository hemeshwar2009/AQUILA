/* =================================================================
   ALERT WATCH AGENT — watches official alerts (simulated IMD feed)
   and re-weights zone risk, queue ranking and safe routes in real time
   ================================================================= */
/* Simulated feed: in production this would poll IMD/CAP alert APIs. */
const ALERT_FEED = [
  {id:"IMD-R1", hazard:"flood", level:"RED",    boost:15, zones:["velachery","pallikaranai","madipakkam","perungudi"],
   text:"IMD RED: extremely heavy rain next 24 h — south Chennai lake belt"},
  {id:"IMD-O1", hazard:"flood", level:"ORANGE", boost:8,  zones:["tambaram","mudichur","chromepet"],
   text:"IMD ORANGE: Adyar basin rising — Tambaram–Mudichur belt"},
  {id:"IMD-H1", hazard:"heat",  level:"ORANGE", boost:8,  zones:["tnagar","egmore","washermanpet","royapuram"],
   text:"IMD HEAT ORANGE: feels-like 43 °C until 5 pm — core city zones"},
];
function activeAlerts(){ return ALERT_FEED; }

/* extra urgency the agent adds to a zone, from every alert that covers it */
function alertBoost(zid){
  return activeAlerts().reduce((s,a)=> s + (a.zones.includes(zid) ? a.boost : 0), 0);
}
/* effective priority used for queue ORDERING (base score stays untouched + auditable) */
function effScore(c){ return Math.min(100, (c.score||0) + alertBoost(c.zone)); }
function alertChip(c){
  const b = alertBoost(c.zone);
  return b ? `<span class="al-chip" title="Alert Watch agent: an active IMD alert covers ${Z[c.zone]?.name} — ranking boosted by +${b}">⚠ +${b} IMD</span>` : "";
}

/* dashboard panel listing what the agent is acting on */
function renderAlertWatch(){
  const host = document.getElementById("alertWatch"); if(!host) return;
  host.innerHTML = activeAlerts().map(a=>`
    <div class="aw-row ${a.level==="RED" ? "aw-red" : "aw-orange"}">
      <span class="aw-ic">${a.hazard==="heat" ? "☀️" : "🌧️"}</span>
      <div><b>${esc(a.text)}</b>
        <div class="aw-sub">${a.zones.map(z=>Z[z]?.name||z).join(" · ")} → queue ranking +${a.boost}, safe routes re-weighted</div>
      </div>
      <span class="aw-lvl">${a.level}</span>
    </div>`).join("");
}
