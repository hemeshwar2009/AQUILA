/* =================================================================
   SAFE-ROUTE AGENT — Dijkstra over the live danger-weighted road graph
   ================================================================= */
/* ---------- safe-route guidance (Dijkstra over the digital-twin road graph) ---------- */
const ZEDGES = [
  ["royapuram","washermanpet"],["washermanpet","egmore"],["egmore","nungambakkam"],["nungambakkam","tnagar"],
  ["tnagar","saidapet"],["saidapet","guindy"],["guindy","velachery"],["velachery","pallikaranai"],
  ["velachery","madipakkam"],["madipakkam","chromepet"],["guindy","chromepet"],["chromepet","tambaram"],
  ["tambaram","mudichur"],["guindy","adyar"],["adyar","mylapore"],["mylapore","egmore"],
  ["adyar","thiruvanmiyur"],["thiruvanmiyur","perungudi"],["perungudi","sholinganallur"],["velachery","perungudi"],
  ["egmore","annanagar"],["annanagar","koyambedu"],["annanagar","ambattur"],["ambattur","avadi"],
  ["ambattur","koyambedu"],["koyambedu","porur"],["porur","guindy"],["pallikaranai","sholinganallur"],
  ["mylapore","thiruvanmiyur"],["nungambakkam","koyambedu"],
];
function zoneDanger(zid){
  const z = Z[zid]; let d = z.risk;
  complaints.forEach(c=>{ if(c.zone===zid && c.status!=="Resolved"){ d += (c.severity>=4?35 : c.severity>=3?18 : 8); } });
  d += alertBoost(zid);   /* Alert Watch agent: active IMD alerts make a zone riskier to cross */
  return d;
}
function safeRoute(fromId){
  const danger = {}; ZONES.forEach(z=>danger[z.id]=zoneDanger(z.id));
  const run = (blockDangerous)=>{
    const blocked = id => blockDangerous && id!==fromId && danger[id]>=85;
    const adj = {}; ZONES.forEach(z=>adj[z.id]=[]);
    ZEDGES.forEach(([a,b])=>{
      const px = Math.hypot(Z[a].x-Z[b].x, Z[a].y-Z[b].y);
      if(!blocked(b)) adj[a].push([b, px*(1+danger[b]/50)]);
      if(!blocked(a)) adj[b].push([a, px*(1+danger[a]/50)]);
    });
    const dist = {}, prev = {}, seen = {};
    ZONES.forEach(z=>dist[z.id]=Infinity); dist[fromId]=0;
    for(let i=0;i<ZONES.length;i++){
      let u=null, bd=Infinity;
      for(const id in dist) if(!seen[id] && dist[id]<bd){bd=dist[id]; u=id;}
      if(u===null) break; seen[u]=true;
      adj[u].forEach(([v,w])=>{ if(dist[u]+w<dist[v]){ dist[v]=dist[u]+w; prev[v]=u; } });
    }
    const targets = ZONES.filter(z=>z.id!==fromId && danger[z.id]<60 && dist[z.id]<Infinity)
      .sort((a,b)=>(dist[a.id]+danger[a.id]*4)-(dist[b.id]+danger[b.id]*4));
    return targets.length ? {dist, prev, dest: targets[0].id} : null;
  };
  /* first try routes that stay out of the most dangerous zones entirely; only
     if that leaves no way out, allow them with a heavy penalty */
  const r = run(true) || run(false);
  if(!r) return null;
  const {prev, dest} = r;
  const path = [dest]; let cur = dest;
  while(prev[cur]!==undefined){ cur = prev[cur]; path.unshift(cur); }
  let km = 0; for(let i=1;i<path.length;i++) km += Math.hypot(Z[path[i]].x-Z[path[i-1]].x, Z[path[i]].y-Z[path[i-1]].y) * KM_PER_UNIT;
  const avoid = ZONES.filter(z=>danger[z.id]>=85).map(z=>z.name);
  return {path, dest, km, avoid, danger};
}
function initRouteBar(){
  const sel = document.getElementById("routeFrom");
  if(sel && !sel.options.length) sel.innerHTML = ZONES.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(z=>`<option value="${z.id}">${z.name}</option>`).join("");
}
function openRoutePanel(){ initRouteBar(); const rb = document.getElementById("routeBar"); if(rb) rb.scrollIntoView({behavior:"smooth", block:"center"}); }
function routeUseGps(){
  if(!navigator.geolocation){ toast("Location is not supported in this browser.", true); return; }
  navigator.geolocation.getCurrentPosition(p=>{
    const nz = nearestZone(p.coords.latitude, p.coords.longitude);
    document.getElementById("routeFrom").value = nz.zone;
    toast(`Detected: ${Z[nz.zone].name}`); findSafeRouteUI();
  }, ()=>toast("Could not get a location — choose your zone.", true), {enableHighAccuracy:true, timeout:10000});
}
function findSafeRouteUI(){
  initRouteBar();
  const from = document.getElementById("routeFrom").value;
  const r = safeRoute(from);
  const out = document.getElementById("routeOut");
  if(!r){ out.className="route-out show"; out.innerHTML = "No safe route found from here — move to the highest floor and report your situation."; return; }
  drawRouteOnMap(r.path);
  document.getElementById("routeClearBtn").style.display = "";
  const steps = r.path.map((id,i)=> i===0 ? `<b>${Z[id].name}</b> (you)` : (i===r.path.length-1 ? `<b>${Z[id].name}</b> 🏁 safer zone` : Z[id].name)).join(" → ");
  out.className = "route-out show";
  out.innerHTML = `🧭 <b>Safest route (${r1(r.km)} km):</b> ${steps}<br>` +
    (r.avoid.length ? `<span class="rt-avoid">⚠ <b>Avoid right now:</b> ${r.avoid.join(", ")} — highest flood danger.</span><br>` : "") +
    `<span style="color:var(--muted)">Guidance from the city model and live reports — streets can change fast; never walk into moving or waist-deep water.</span>`;
}
function drawRouteOnMap(path){
  const wrap = document.getElementById("citizenMapWrap"); const svg = wrap && wrap.querySelector("svg"); if(!svg) return;
  let g = svg.querySelector(".saferoute");
  if(!g){ g = document.createElementNS(svg.namespaceURI,"g"); g.setAttribute("class","saferoute");
    const inc = svg.querySelector(".incidents"); svg.insertBefore(g, inc); }
  const pts = path.map(id=>`${Z[id].x},${Z[id].y}`).join(" ");
  g.innerHTML = `
    <polyline points="${pts}" fill="none" stroke="#071827" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/>
    <polyline points="${pts}" fill="none" stroke="#2ee6a0" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="12 14" class="route-line"/>
    <circle cx="${Z[path[0]].x}" cy="${Z[path[0]].y}" r="9" fill="#2ee6a0" opacity=".9"/>
    <text x="${Z[path[0]].x}" y="${Z[path[0]].y-14}" text-anchor="middle" style="font-size:12px; font-weight:700; fill:#2ee6a0;">YOU</text>
    <text x="${Z[path.at(-1)].x}" y="${Z[path.at(-1)].y-14}" text-anchor="middle" style="font-size:13px;">🏁</text>`;
}
function clearRoute(){
  const wrap = document.getElementById("citizenMapWrap"); const g = wrap && wrap.querySelector(".saferoute"); if(g) g.innerHTML="";
  document.getElementById("routeOut").className = "route-out";
  document.getElementById("routeClearBtn").style.display = "none";
}
