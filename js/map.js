/* =================================================================
   LIVE 2D CITY MAP — SVG digital twin, animation loop
   ================================================================= */
/* =================================================================
   LIVE 2D CITY MAP (SVG digital twin, animated)
   ================================================================= */
const MAPS = [];  // {svg, agentsLayer, incidentLayer, wrap, tip, agents:[...] }

function roadPath(pts){ return "M" + pts.map(p=>p.join(",")).join(" L "); }

function buildMap(wrapId, interactive){
  const wrap = document.getElementById(wrapId);
  const W=1000, H=780;
  const svg = document.createElementNS("http://www.w3.org/2000/svg","svg");
  svg.setAttribute("viewBox",`0 0 ${W} ${H}`);
  svg.innerHTML = `
  <defs>
    <linearGradient id="seaG_${wrapId}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#0b5a9c"/><stop offset="1" stop-color="#073c70"/>
    </linearGradient>
    <radialGradient id="cityGlow_${wrapId}" cx="0.5" cy="0.4" r="0.8">
      <stop offset="0" stop-color="#0e2840"/><stop offset="1" stop-color="#071827"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#cityGlow_${wrapId})"/>
  <!-- Bay of Bengal -->
  <path d="M760,0 C740,120 750,260 735,380 C722,500 748,640 735,780 L1000,780 L1000,0 Z" fill="url(#seaG_${wrapId})"/>
  <g class="waves"></g>
  <!-- shoreline -->
  <path d="M760,0 C740,120 750,260 735,380 C722,500 748,640 735,780" fill="none" stroke="#7fd6ff" stroke-width="2" opacity="0.6"/>
  <!-- Marina beach strip -->
  <path d="M742,180 C736,250 738,320 730,390 L718,388 C726,318 724,248 730,180 Z" fill="#8a7a55" opacity="0.5"/>
  <!-- Pallikaranai marsh -->
  <ellipse cx="588" cy="660" rx="52" ry="34" fill="#17424d" opacity="0.65"/>
  <ellipse cx="588" cy="660" rx="52" ry="34" fill="none" stroke="#1e6a74" stroke-width="1.5" opacity="0.7" stroke-dasharray="4 4"/>
  <!-- Rivers -->
  <path d="M60,260 C220,255 380,275 480,260 C580,246 640,255 742,230" fill="none" stroke="#2a86d8" stroke-width="7" stroke-linecap="round" opacity="0.9"/>
  <path d="M120,470 C260,500 400,480 520,470 C610,462 650,470 724,452" fill="none" stroke="#2a86d8" stroke-width="8" stroke-linecap="round" opacity="0.9"/>
  <path d="M735,170 C720,300 726,440 722,600 C720,660 728,720 726,778" fill="none" stroke="#1a4568" stroke-width="4" opacity="0.8" stroke-dasharray="1 0"/>
  <text x="300" y="248" class="water-label">COOUM RIVER</text>
  <text x="300" y="505" class="water-label">ADYAR RIVER</text>
  <text x="860" y="390" class="water-label" style="font-size:16px; letter-spacing:4px;" transform="rotate(90 860 390)">BAY OF BENGAL</text>
  <text x="590" y="662" class="water-label" style="font-size:10px; text-anchor:middle;">PALLIKARANAI MARSH</text>
  <g class="roads"></g>
  <g class="traffic"></g>
  <g class="zones"></g>
  <g class="floods"></g>
  <g class="incidents"></g>
  <g class="agents"></g>
  <g class="rain" opacity="0.5"></g>
  `;
  // animated waves on the sea
  const waves = svg.querySelector(".waves");
  for(let i=0;i<6;i++){
    const p = document.createElementNS(svg.namespaceURI,"path");
    const y = 80 + i*120;
    p.setAttribute("d",`M${780+((i%3)*30)},${y} q 20,-8 40,0 q 20,8 40,0 q 20,-8 40,0`);
    p.setAttribute("fill","none"); p.setAttribute("stroke","#5fb8ea"); p.setAttribute("stroke-width","2"); p.setAttribute("opacity","0.5");
    const an = document.createElementNS(svg.namespaceURI,"animateTransform");
    an.setAttribute("attributeName","transform"); an.setAttribute("type","translate");
    an.setAttribute("values","0,0; 14,4; 0,0"); an.setAttribute("dur",(4+i*0.7)+"s"); an.setAttribute("repeatCount","indefinite");
    p.appendChild(an); waves.appendChild(p);
  }
  // roads
  const roadsG = svg.querySelector(".roads");
  ROADLIST.forEach(pts=>{
    const outline = document.createElementNS(svg.namespaceURI,"path");
    outline.setAttribute("d", roadPath(pts)); outline.setAttribute("fill","none");
    outline.setAttribute("stroke","#163652"); outline.setAttribute("stroke-width","9"); outline.setAttribute("stroke-linecap","round"); outline.setAttribute("stroke-linejoin","round");
    roadsG.appendChild(outline);
    const dash = document.createElementNS(svg.namespaceURI,"path");
    dash.setAttribute("d", roadPath(pts)); dash.setAttribute("fill","none");
    dash.setAttribute("stroke","#4c95c6"); dash.setAttribute("stroke-width","1.4"); dash.setAttribute("stroke-dasharray","8 10");
    roadsG.appendChild(dash);
  });
  // zone dots + labels
  const zonesG = svg.querySelector(".zones");
  ZONES.forEach(z=>{
    const g = document.createElementNS(svg.namespaceURI,"g");
    const c = document.createElementNS(svg.namespaceURI,"circle");
    c.setAttribute("cx",z.x); c.setAttribute("cy",z.y); c.setAttribute("r","4.5");
    c.setAttribute("fill", z.risk>=75? "#ec835a" : z.risk>=55? "#c98500" : "#6aa9d4");
    c.setAttribute("stroke","#0d1117"); c.setAttribute("stroke-width","1.5");
    const t = document.createElementNS(svg.namespaceURI,"text");
    t.setAttribute("x",z.x+8); t.setAttribute("y",z.y+4); t.setAttribute("class","zone-label"); t.textContent = z.name;
    g.appendChild(c); g.appendChild(t); zonesG.appendChild(g);
  });
  // rain streaks
  const rainG = svg.querySelector(".rain");
  for(let i=0;i<26;i++){
    const l = document.createElementNS(svg.namespaceURI,"line");
    const x = Math.random()*720, y = Math.random()*760;
    l.setAttribute("x1",x); l.setAttribute("y1",y); l.setAttribute("x2",x-5); l.setAttribute("y2",y+16);
    l.setAttribute("stroke","#3b5f87"); l.setAttribute("stroke-width","1.4"); l.setAttribute("opacity","0.55"); l.setAttribute("stroke-linecap","round");
    const an = document.createElementNS(svg.namespaceURI,"animateTransform");
    an.setAttribute("attributeName","transform"); an.setAttribute("type","translate");
    an.setAttribute("values","0,-30; 0,60"); an.setAttribute("dur",(0.9+Math.random()*0.9)+"s"); an.setAttribute("repeatCount","indefinite");
    l.appendChild(an); rainG.appendChild(l);
  }
  wrap.appendChild(svg);

  // tooltip + legend
  const tip = document.createElement("div"); tip.className="map-tip"; wrap.appendChild(tip);
  const legend = document.createElement("div"); legend.className="map-legend";
  legend.innerHTML = (interactive? `
    <span><span class="kdot" style="background:#d03b3b;"></span>Critical incident</span>
    <span><span class="kdot" style="background:#ec835a;"></span>High</span>
    <span><span class="kdot" style="background:#fab219;"></span>Medium</span>` : `
    <span><span class="kdot" style="background:#fab219;"></span>Active report</span>`) + `
    <span>🚤🚚🚗🚑📦 Rescue vehicles (moving)</span>
    <span><span class="kdot" style="background:#1c4d79;"></span>Rivers / marsh</span>
    <span><span class="kdot" style="background:#ec835a;"></span><span class="kdot" style="background:#c98500; margin-left:-3px;"></span> Zone flood risk</span>`;
  wrap.appendChild(legend);

  const m = {svg, wrap, tip, interactive,
    incidentsG: svg.querySelector(".incidents"),
    floodsG: svg.querySelector(".floods"),
    agentsG: svg.querySelector(".agents"),
    trafficG: svg.querySelector(".traffic")};
  // ambient traffic dots
  m.traffic = [];
  for(let i=0;i<10;i++){
    const road = ROADLIST[i % ROADLIST.length];
    const dot = document.createElementNS(svg.namespaceURI,"circle");
    dot.setAttribute("r","2.6"); dot.setAttribute("fill", i%2? "#e8c15a":"#9fb6d8"); dot.setAttribute("opacity","0.85");
    m.trafficG.appendChild(dot);
    m.traffic.push({el:dot, road, t:Math.random(), speed:(0.00006+Math.random()*0.00008)*(i%2?1:-1)});
  }
  // rescue agents
  m.agents = FLEET.map((f,i)=>{
    const g = document.createElementNS(svg.namespaceURI,"g");
    const halo = document.createElementNS(svg.namespaceURI,"circle");
    halo.setAttribute("r","11"); halo.setAttribute("fill","rgba(57,135,229,0.18)"); halo.setAttribute("stroke","rgba(57,135,229,0.5)"); halo.setAttribute("stroke-width","1");
    const txt = document.createElementNS(svg.namespaceURI,"text");
    txt.setAttribute("text-anchor","middle"); txt.setAttribute("dominant-baseline","central"); txt.setAttribute("font-size","13"); txt.textContent = f.icon;
    g.appendChild(halo); g.appendChild(txt);
    m.agentsG.appendChild(g);
    const home = Z[f.home];
    return {fleet:f, el:g, x:home.x, y:home.y, tx:home.x, ty:home.y, ox:0, oy:0, settle:1, phase:Math.random()*6.28};
  });
  MAPS.push(m);
  return m;
}

/* incident markers re-render */
function renderIncidents(){
  MAPS.forEach(m=>{
    m.incidentsG.innerHTML = ""; m.floodsG.innerHTML = "";
    const active = complaints.filter(c=>c.status!=="Resolved");
    // flood pools under flood-type incidents
    active.filter(c=>["flood","rescue","waterlogging"].includes(c.type) && c.depth>=2).forEach(c=>{
      const z = Z[c.zone]; if(!z) return;
      const e = document.createElementNS(m.svg.namespaceURI,"ellipse");
      e.setAttribute("cx",z.x); e.setAttribute("cy",z.y+3); e.setAttribute("rx",14+c.depth*5); e.setAttribute("ry",7+c.depth*2.4);
      e.setAttribute("fill","#1a4a78"); e.setAttribute("opacity","0.5");
      const an = document.createElementNS(m.svg.namespaceURI,"animate");
      an.setAttribute("attributeName","opacity"); an.setAttribute("values","0.35;0.6;0.35"); an.setAttribute("dur","3s"); an.setAttribute("repeatCount","indefinite");
      e.appendChild(an); m.floodsG.appendChild(e);
    });
    active.forEach(c=>{
      const z = Z[c.zone]; if(!z) return;
      const col = !m.interactive? "#fab219" : c.score>=75? "#d03b3b" : c.score>=55? "#ec835a" : "#fab219";
      const g = document.createElementNS(m.svg.namespaceURI,"g");
      g.style.cursor = m.interactive? "pointer":"default";
      const pulse = document.createElementNS(m.svg.namespaceURI,"circle");
      pulse.setAttribute("cx",z.x); pulse.setAttribute("cy",z.y); pulse.setAttribute("r","7"); pulse.setAttribute("fill","none");
      pulse.setAttribute("stroke",col); pulse.setAttribute("stroke-width","2");
      const a1 = document.createElementNS(m.svg.namespaceURI,"animate");
      a1.setAttribute("attributeName","r"); a1.setAttribute("values","6;20"); a1.setAttribute("dur","1.8s"); a1.setAttribute("repeatCount","indefinite");
      const a2 = document.createElementNS(m.svg.namespaceURI,"animate");
      a2.setAttribute("attributeName","opacity"); a2.setAttribute("values","0.9;0"); a2.setAttribute("dur","1.8s"); a2.setAttribute("repeatCount","indefinite");
      pulse.appendChild(a1); pulse.appendChild(a2);
      const core = document.createElementNS(m.svg.namespaceURI,"circle");
      core.setAttribute("cx",z.x); core.setAttribute("cy",z.y); core.setAttribute("r","5.5"); core.setAttribute("fill",col);
      core.setAttribute("stroke","#0d1117"); core.setAttribute("stroke-width","1.5");
      g.appendChild(pulse); g.appendChild(core);
      const showTip = (ev)=>{
        const r = m.wrap.getBoundingClientRect();
        m.tip.style.display="block";
        m.tip.innerHTML = `<b>${c.id}</b>${m.interactive? ` · <span style="color:${col}; font-weight:700;">${priorityLabel(c.score)} ${c.score}</span>`:""}<br>
          ${TYPE_META[c.type].icon} ${TYPE_META[c.type].label} — ${Z[c.zone].name}<br>
          <span style="color:var(--muted)">${c.people} people · ${c.status}${c.agent? " · "+c.agent:""}</span>`;
        let lx = ev.clientX - r.left + 14, ly = ev.clientY - r.top + 10;
        if(lx > r.width-250) lx -= 270; if(ly > r.height-90) ly -= 100;
        m.tip.style.left = lx+"px"; m.tip.style.top = ly+"px";
      };
      g.addEventListener("mousemove", showTip);
      g.addEventListener("mouseleave", ()=> m.tip.style.display="none");
      if(m.interactive) g.addEventListener("click", ()=>{ m.tip.style.display="none"; openIncident(c.id); });
      m.incidentsG.appendChild(g);
    });
  });
}

/* nearest point on a road path for traffic */
function pointOnRoad(road, t){
  t = ((t % 1) + 1) % 1;
  const segs = road.length - 1;
  const ft = t * segs, i = Math.min(Math.floor(ft), segs-1), lt = ft - i;
  const [x1,y1] = road[i], [x2,y2] = road[i+1];
  return [x1+(x2-x1)*lt, y1+(y2-y1)*lt];
}

function updateAgentTargets(){
  const assigned = {};
  complaints.filter(c=>c.agent && c.status!=="Resolved").forEach(c=>{ if(!assigned[c.agent]) assigned[c.agent]=c; });
  MAPS.forEach(m=>{
    // vehicles sharing a destination are spread around it so they don't stack
    const groups = {};
    m.agents.forEach(a=>{
      const task = assigned[a.fleet.id];
      a._dest = task ? Z[task.zone] : Z[a.fleet.home];
      (groups[a._dest.id] = groups[a._dest.id] || []).push(a);
    });
    Object.values(groups).forEach(g=>g.forEach((a,i)=>{
      const ang = (i / g.length) * Math.PI * 2 - Math.PI/2, rad = g.length>1 ? 16 : 0;
      a.ox = Math.cos(ang)*rad; a.oy = Math.sin(ang)*rad;
    }));
    m.agents.forEach(a=>{
      const task = assigned[a.fleet.id];
      const dest = a._dest;
      a.tx = dest.x; a.ty = dest.y;
      a.busy = !!task;
      a.track = task && (task.status==="Dispatched" || task.status==="Accepted") ? task : null;   // en route: follow simulated GPS
      // on the citizen map, highlight the vehicle coming to this citizen's own report
      a.mine = !m.interactive && !!task && task.source==="citizen";
      const halo = a.el.firstChild;
      halo.setAttribute("r", a.mine? "15" : "11");
      halo.setAttribute("fill", a.mine? "rgba(25,190,130,0.25)" : task? "rgba(208,59,59,0.18)":"rgba(57,135,229,0.15)");
      halo.setAttribute("stroke", a.mine? "#3fe0a5" : task? "rgba(208,59,59,0.6)":"rgba(57,135,229,0.45)");
      halo.setAttribute("stroke-width", a.mine? "2.5" : "1");
      if(!a.label){
        a.label = document.createElementNS(m.svg.namespaceURI, "text");
        a.label.setAttribute("y", "-20"); a.label.setAttribute("text-anchor", "middle"); a.label.setAttribute("class", "mine-label");
        a.label.textContent = "Your rescue vehicle"; a.el.appendChild(a.label);
      }
      a.label.style.display = a.mine? "" : "none";
    });
  });
}

/* animation loop */
let lastT = performance.now();
function animate(now){
  const dt = Math.min(now - lastT, 60); lastT = now;
  MAPS.forEach(m=>{
    if(!m.wrap.offsetParent) return; // skip hidden maps
    m.traffic.forEach(tr=>{
      tr.t += tr.speed * dt * 8;
      const [x,y] = pointOnRoad(tr.road, tr.t);
      tr.el.setAttribute("cx",x); tr.el.setAttribute("cy",y);
    });
    const nowMs = Date.now();
    m.agents.forEach(a=>{
      if(a.track){ const tr = vehicleTrack(a.track, nowMs); if(tr){ a.tx = tr.x; a.ty = tr.y; } }
      // base position glides to the target; never overshoots
      const gx = a.tx + a.ox, gy = a.ty + a.oy;
      const dx = gx - a.x, dy = gy - a.y;
      const dist = Math.hypot(dx,dy);
      const step = Math.min(dist, 0.045 * dt);   // px per ms
      if(dist > 0.01){ a.x += dx/dist * step; a.y += dy/dist * step; }
      // a gentle idle bob fades in once parked, so arriving is smooth (no snap)
      const parked = dist < 1 ? 1 : 0;
      a.settle += (parked - a.settle) * Math.min(1, dt*0.004);
      a.phase += dt*0.0015;
      const bx = Math.cos(a.phase)*2.2*a.settle, by = Math.sin(a.phase*1.3)*1.6*a.settle;
      a.el.setAttribute("transform",`translate(${(a.x+bx).toFixed(2)},${(a.y+by).toFixed(2)})`);
    });
  });
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
