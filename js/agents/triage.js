/* =================================================================
   TRIAGE AGENT — severity assessment + transparent priority scoring
   ================================================================= */
/* ---------- Priority scoring: transparent, rule-based ---------- */
function scoreParts(c){
  return [
    [`Severity (${SEV_NAMES[c.severity]||"—"}, system-assessed) × 12`, (c.severity||1) * 12],
    [`People affected (${c.people}, capped at 60) × 0.5`, Math.min(c.people||1, 60) * 0.5],
    [`Water depth (${DEPTH_NAMES[c.depth||0]}) × 5`, (c.depth||0) * 5],
    [`Type weight (${TYPE_META[c.type]?.label}) × 0.6`, (TYPE_META[c.type]?.w ?? 10) * 0.6],
    [`Zone hazard risk (${Z[c.zone]?.name} ${Z[c.zone]?.risk}/100) × 0.12`, (Z[c.zone]?.risk ?? 50) * 0.12],
  ];
}
function priorityScore(c){ return Math.min(100, Math.round(scoreParts(c).reduce((s,p)=>s+p[1],0))); }
function priorityLabel(s){ return s>=75?"CRITICAL": s>=55?"HIGH": s>=35?"MEDIUM":"LOW"; }
function priorityClass(s){ return s>=75?"pr-critical": s>=55?"pr-high": s>=35?"pr-medium":"pr-low"; }

function assessSeverity(d){
  /* heat stroke is a life-threatening medical emergency by definition (no water-depth signal) */
  if(d.type==="heatstroke") return 4;
  const base = {rescue:3, medical:3, dehydration:2, flood:2, power:2, watershort:1, tree:1, waterlogging:1, relief:1}[d.type] ?? 1;
  const heatCrowd = (d.type==="dehydration" || d.type==="watershort") && d.people>=5 ? 1 : 0;
  return Math.max(1, Math.min(4, base + (d.depth>=3?1:0) + (d.people>=10?1:0) + heatCrowd));
}
