/* =================================================================
   CORE — config, Chennai zones & roads, fleet, datasets, state, helpers
   ================================================================= */
/* =================================================================
   AQUILA DEMO — single-file prototype
   ================================================================= */

/* ---------- Chennai zones (stylized map coordinates, 1000x780 viewBox) ---------- */
const ZONES = [
  {id:"royapuram",  name:"Royapuram",       x:690, y:120, risk:62},
  {id:"washermanpet",name:"Washermanpet",   x:620, y:140, risk:58},
  {id:"annanagar",  name:"Anna Nagar",      x:430, y:230, risk:45},
  {id:"ambattur",   name:"Ambattur",        x:270, y:190, risk:55},
  {id:"avadi",      name:"Avadi",           x:140, y:160, risk:48},
  {id:"koyambedu",  name:"Koyambedu",       x:360, y:300, risk:50},
  {id:"egmore",     name:"Egmore",          x:580, y:250, risk:52},
  {id:"nungambakkam",name:"Nungambakkam",   x:560, y:320, risk:47},
  {id:"tnagar",     name:"T. Nagar",        x:520, y:390, risk:66},
  {id:"mylapore",   name:"Mylapore",        x:680, y:370, risk:54},
  {id:"saidapet",   name:"Saidapet",        x:540, y:450, risk:74},
  {id:"adyar",      name:"Adyar",           x:660, y:470, risk:70},
  {id:"guindy",     name:"Guindy",          x:520, y:510, risk:60},
  {id:"porur",      name:"Porur",           x:300, y:400, risk:63},
  {id:"velachery",  name:"Velachery",       x:560, y:580, risk:92},
  {id:"pallikaranai",name:"Pallikaranai",   x:590, y:650, risk:88},
  {id:"madipakkam", name:"Madipakkam",      x:500, y:630, risk:78},
  {id:"tambaram",   name:"Tambaram",        x:330, y:690, risk:80},
  {id:"chromepet",  name:"Chromepet",       x:400, y:640, risk:72},
  {id:"mudichur",   name:"Mudichur",        x:250, y:720, risk:90},
  {id:"thiruvanmiyur",name:"Thiruvanmiyur", x:690, y:540, risk:56},
  {id:"sholinganallur",name:"Sholinganallur",x:660, y:690, risk:76},
  {id:"perungudi",  name:"Perungudi",       x:640, y:600, risk:82},
];
const Z = Object.fromEntries(ZONES.map(z=>[z.id,z]));

/* ---------- Roads of the stylized digital twin (polyline waypoints) ---------- */
const ROADS = {
  annaSalai:   [[640,180],[600,240],[565,310],[530,385],[535,445],[520,510]],            // Mount Road → Guindy
  gst:         [[520,510],[460,580],[400,640],[330,690],[250,720]],                      // GST Rd → Tambaram → Mudichur
  omr:         [[660,470],[655,540],[640,600],[660,690]],                                 // OMR (IT corridor)
  ecr:         [[700,400],[720,470],[730,560],[740,680]],                                 // East Coast Road
  innerRing:   [[270,190],[360,300],[300,400],[380,480],[460,580]],                      // Inner ring west
  phRoad:      [[600,240],[500,250],[430,230],[270,190],[140,160]],                      // Poonamallee High Rd
  northLink:   [[690,120],[620,140],[640,180]],
  velLink:     [[520,510],[560,580],[590,650]],
  adyarLink:   [[520,510],[590,490],[660,470],[690,540]],
  porurLink:   [[360,300],[430,230]],
  madLink:     [[460,580],[500,630],[560,580]],
};
const ROADLIST = Object.values(ROADS);

/* ---------- Historical disaster dataset ---------- */
const DISASTERS = [
  {yr:"DEC 2004", name:"Indian Ocean Tsunami", col:"#9085e9",
   desc:"Waves struck Marina Beach and the coastal belt from Royapuram to Thiruvanmiyur; Chennai's fishing settlements were worst hit.",
   stats:[["~206","deaths (Chennai)"],["~2.1 m","max wave run-up"],["Coastal","zones affected"]], rain:0},
  {yr:"NOV–DEC 2015", name:"South India Floods", col:"#3987e5",
   desc:"Record northeast-monsoon rain and the Chembarambakkam reservoir release flooded the Adyar basin. Velachery, Mudichur, Tambaram, Saidapet and Kotturpuram were submerged for days.",
   stats:[["1,049 mm","Nov rainfall"],["290+","deaths (TN)"],["~₹20k cr","est. losses"]], rain:494},
  {yr:"DEC 2016", name:"Cyclone Vardah", col:"#199e70",
   desc:"Made landfall near Chennai with winds around 120–130 km/h; roughly 100,000 trees were downed and power lines collapsed citywide.",
   stats:[["~130 km/h","peak winds"],["18","deaths (TN)"],["~1 lakh","trees down"]], rain:120},
  {yr:"JUN 2019", name:"Water Crisis — Day Zero", col:"#c98500",
   desc:"All four principal reservoirs ran nearly dry; the city depended on tankers and trains. Reinforced the city's dual flood–drought vulnerability.",
   stats:[["4/4","reservoirs near-dry"],["~10 M L","daily rail supply"],["200+ days","low-supply period"]], rain:0},
  {yr:"DEC 2022", name:"Cyclone Mandous", col:"#d55181",
   desc:"Landfall near Mamallapuram; heavy coastal damage, waterlogging in southern suburbs and hundreds of trees uprooted.",
   stats:[["~85 km/h","peak winds"],["400+","trees down"],["4","deaths (TN)"]], rain:115},
  {yr:"DEC 2023", name:"Cyclone Michaung", col:"#d95926",
   desc:"Dumped 400+ mm of rain in ~24 hours over south Chennai. Velachery, Pallikaranai, Perungudi and Tambaram flooded severely; lakes breached.",
   stats:[["~440 mm","rain in 24 h"],["17+","deaths (Chennai)"],["11 M","people affected"]], rain:440},
];

/* ---------- Rescue vehicle fleet ---------- */
const FLEET = [
  {id:"BOAT-01", kind:"boat",  icon:"🚤", name:"Boat Agent 01", home:"adyar"},
  {id:"BOAT-02", kind:"boat",  icon:"🚤", name:"Boat Agent 02", home:"velachery"},
  {id:"TRUCK-01",kind:"truck", icon:"🚚", name:"Truck Agent 01", home:"guindy"},
  {id:"TRUCK-02",kind:"truck", icon:"🚚", name:"Truck Agent 02", home:"ambattur"},
  {id:"CAR-01",  kind:"car",   icon:"🚗", name:"Car Agent 01",  home:"egmore"},
  {id:"CAR-02",  kind:"car",   icon:"🚗", name:"Car Agent 02",  home:"tambaram"},
  {id:"MED-01",  kind:"ambulance", icon:"🚑", name:"Medical Agent 01", home:"tnagar"},
  {id:"LOG-01",  kind:"logistics", icon:"📦", name:"Logistics Agent 01", home:"koyambedu"},
];

const TYPE_META = {
  /* flood / rain */
  flood:{label:"Flooding", icon:"🌊", w:22, hazard:"flood"}, rescue:{label:"Rescue needed", icon:"🚨", w:30, hazard:"flood"},
  waterlogging:{label:"Waterlogging", icon:"💧", w:12, hazard:"flood"},
  /* heatwave */
  heatstroke:{label:"Heat stroke / collapse", icon:"🥵", w:30, hazard:"heat"},
  dehydration:{label:"Dehydration / exhaustion", icon:"🌡️", w:22, hazard:"heat"},
  watershort:{label:"Drinking water shortage", icon:"🚱", w:16, hazard:"heat"},
  /* any hazard */
  medical:{label:"Medical", icon:"🏥", w:28, hazard:"any"},
  power:{label:"Power hazard", icon:"⚡", w:16, hazard:"any"}, tree:{label:"Tree / structure", icon:"🌳", w:14, hazard:"any"},
  relief:{label:"Relief supplies", icon:"🍚", w:10, hazard:"any"},
};
/* ---------- Volunteer roster (demo data; assignments live in this browser) ---------- */
const VOL_SKILLS = {medic:"🩺 First aid", swimmer:"🏊 Swimmer", driver:"🛵 Rider/driver", electrician:"⚡ Electrician", cook:"🍲 Cook", counselor:"💬 Counselor"};
const VOLUNTEERS = [
  {id:"V-01", name:"Anand R",     skills:["swimmer","driver"],    zone:"velachery"},
  {id:"V-02", name:"Keerthana S", skills:["medic"],               zone:"velachery"},
  {id:"V-03", name:"Mohammed F",  skills:["driver","cook"],       zone:"tambaram"},
  {id:"V-04", name:"Priyanka V",  skills:["medic","counselor"],   zone:"tnagar"},
  {id:"V-05", name:"Senthil K",   skills:["electrician"],         zone:"guindy"},
  {id:"V-06", name:"Divya M",     skills:["cook","driver"],       zone:"koyambedu"},
  {id:"V-07", name:"Ravi T",      skills:["swimmer"],             zone:"adyar"},
  {id:"V-08", name:"Fathima N",   skills:["medic"],               zone:"egmore"},
  {id:"V-09", name:"Gokul P",     skills:["driver","electrician"],zone:"perungudi"},
  {id:"V-10", name:"Lakshmi D",   skills:["cook","counselor"],    zone:"mudichur"},
  {id:"V-11", name:"Arjun B",     skills:["swimmer","medic"],     zone:"pallikaranai"},
  {id:"V-12", name:"Meena J",     skills:["driver"],              zone:"chromepet"},
];
let volAssign = {};   // complaintId -> [volunteerId]
function loadVols(){ try{ volAssign = JSON.parse(localStorage.getItem("aquila_vols_v1")||"{}"); }catch(e){ volAssign = {}; } }
function saveVols(){ try{ localStorage.setItem("aquila_vols_v1", JSON.stringify(volAssign)); }catch(e){} }
function volBusyMap(){
  const m = {};
  for(const [cid, ids] of Object.entries(volAssign)){
    const c = complaints.find(x=>x.id===cid);
    if(c && c.status!=="Resolved") ids.forEach(v=>m[v]=cid);
  }
  return m;
}

/* ---------- Relief supply inventory (demo data; levels live in this browser) ---------- */
const SUPPLY_DEF = [
  ["foodkits","🍚 Food kits", 800], ["water","🚰 Drinking water (L)", 20000],
  ["ors","🧂 ORS sachets", 1500], ["medkits","🩹 Medical kits", 220], ["blankets","🧣 Blankets", 600],
];
let supplies = {};
function loadSupplies(){
  try{ supplies = JSON.parse(localStorage.getItem("aquila_supplies_v1")||"null") || {}; }catch(e){ supplies = {}; }
  SUPPLY_DEF.forEach(([k,,max])=>{ if(typeof supplies[k] !== "number") supplies[k] = max; });
}
function saveSupplies(){ try{ localStorage.setItem("aquila_supplies_v1", JSON.stringify(supplies)); }catch(e){} }
function useSupplies(take){
  const used = [];
  for(const [k,v] of Object.entries(take)){
    if(!v) continue;
    supplies[k] = Math.max(0, (supplies[k]||0) - v);
    const def = SUPPLY_DEF.find(d=>d[0]===k); used.push(`${v} ${def? def[1].replace(/^[^ ]+ /,"") : k}`);
  }
  saveSupplies(); return used;
}

const STATUSES = ["Pending","Dispatched","Accepted","In Progress","Resolved"];
const SEV_NAMES = ["","Low","Moderate","High","Life-threatening"];
const DEPTH_NAMES = ["None","Ankle deep","Knee deep","Waist deep","Chest deep +"];
const DUP_WINDOW_MIN = 30;

/* escape anything a user typed before it goes into HTML */
function esc(s){ return String(s ?? "").replace(/[&<>"']/g, ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[ch]); }
const r1 = v => Math.round(v*10)/10;
const hhmm = t => new Date(t).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});
const hhmmss = t => new Date(t).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",second:"2-digit"});

/* ---------- Seed complaints ---------- */
function seedComplaints(){
  const now = Date.now(), H = 3600e3;
  const mk=(i,t,zone,type,sev,people,depth,name,phone,desc,status,agent)=>{
    const c={id:"AQ-"+String(1000+i), ts:now-t, zone, type, severity:sev, people, depth, name, phone, desc, status, agent:agent||null, source:"seed", t:{}};
    c.score = c.aiScore = priorityScore(c);
    if(status!=="Pending") c.t.dispatched = c.ts + 6*60e3;
    if(status==="Resolved"){ c.t.resolved = c.ts + 50*60e3; c.outcome = "Cleared by crew (seed data)"; }
    return c;
  };
  const list = [
    mk(1, 0.3*H,"velachery","rescue",4,6,4,"Karthik S","9840011223","Family of 6 trapped on first floor near Vijayanagar bus stand, water chest-deep and rising.","In Progress","BOAT-02"),
    mk(2, 0.6*H,"mudichur","rescue",4,12,3,"Lakshmi V","9884455667","12 residents on terrace of apartment near Mudichur lake breach. Two elderly, one infant.","Dispatched","BOAT-01"),
    mk(3, 1.1*H,"pallikaranai","flood",3,4,3,"Arun Prakash","9790334455","Ground floor flooded on Velachery–Tambaram Main Road, marsh overflow entering homes.","Dispatched","TRUCK-01"),
    mk(4, 1.8*H,"saidapet","medical",4,1,2,"Fathima B","9003221144","Dialysis patient needs urgent hospital transfer, street waterlogged near Saidapet bridge.","In Progress","MED-01"),
    mk(5, 2.4*H,"tambaram","flood",3,8,2,"Suresh Kumar","9445099887","Knee-deep water in Tambaram West, requesting sandbags and pump support.","Pending",null),
    mk(6, 3.0*H,"adyar","waterlogging",2,3,2,"Divya N","9841776655","L.B. Road junction impassable, two-wheelers stranded.","Resolved","CAR-01"),
    mk(7, 3.9*H,"tnagar","power",3,20,1,"Rajesh M","9566012378","Transformer sparking near Pondy Bazaar, water pooling under it.","Dispatched","CAR-02"),
    mk(8, 5.1*H,"perungudi","flood",3,5,3,"Meena R","9962334411","OMR service lane flooded, office basement taking in water.","Pending",null),
    mk(9, 6.4*H,"porur","tree",2,2,0,"Vignesh T","9176554433","Large tree fallen across Mount–Poonamallee Road after gusts.","Resolved","TRUCK-02"),
    mk(10,7.5*H,"annanagar","waterlogging",1,2,1,"Shalini K","9380445566","2nd Avenue underpass waterlogged, slow traffic.","Resolved","CAR-01"),
    mk(11,8.8*H,"sholinganallur","flood",2,4,2,"Ibrahim S","9004789012","ECR link road flooded near lake, water entering shops.","Pending",null),
    mk(12,10.2*H,"madipakkam","relief",2,15,1,"Geetha P","9841990011","Drinking water and food needed for 15 families in Ram Nagar.","Pending",null),
    mk(13, 0.1*H,"velachery","rescue",4,6,4,"Anand K","9841122334","Neighbours trapped on first floor near Vijayanagar bus stand, water very high.","Pending",null),
  ];
  list.forEach(c=>{ if(c.status==="Pending") c.dupOf = findDup(c, list); });
  return list;
}

/* ---------- State (localStorage with graceful fallback) ---------- */
const KEY_C = "aquila_complaints_v2", KEY_N = "aquila_notifs_v2", KEY_A = "aquila_audit_v2";
let complaints = [];
let auditLog = [];
function loadState(){
  if(SB_ON){ return; }   // data comes from Supabase after sign-in / when the citizen portal opens
  try{
    const raw = localStorage.getItem(KEY_C);
    if(raw){ complaints = JSON.parse(raw); if(Array.isArray(complaints) && complaints.length) return; }
  }catch(e){}
  complaints = seedComplaints();
  auditLog = [{ts:Date.now(), actor:"System", action:"Demo data loaded", cid:"—", detail:"13 seeded incidents (simulated data)"}];
  saveState(); saveAudit();
}
function saveState(){ if(SB_ON) return sbPushChanges(); try{ localStorage.setItem(KEY_C, JSON.stringify(complaints)); }catch(e){} }
function loadAudit(){ if(SB_ON) return; try{ const r = localStorage.getItem(KEY_A); if(r) auditLog = JSON.parse(r); }catch(e){} }
function saveAudit(){ if(SB_ON) return; try{ localStorage.setItem(KEY_A, JSON.stringify(auditLog)); }catch(e){} }
function log(actor, action, cid, detail){
  auditLog.push({ts:Date.now(), actor, action, cid, detail:detail||""});
  if(auditLog.length>800) auditLog.splice(0, auditLog.length-800);
  if(SB_ON) return sbLog(actor, action, cid, detail);
  saveAudit();
}
function resetDemo(){
  if(SB_ON) return sbResetDemo();
  try{ [KEY_C,KEY_N,KEY_A,"aquila_vols_v1","aquila_supplies_v1","aquila_broadcasts_v1"].forEach(k=>localStorage.removeItem(k)); }catch(e){}
  complaints = []; auditLog = []; notifications = []; volAssign = {}; broadcasts = [];
  loadSupplies(); loadState(); saveNotifs(); closeIncident(); refreshAll(); toast("Demo data reset.");
}
function nextId(){ return "AQ-" + (Math.max(1000, ...complaints.map(c=>+String(c.id).slice(3)||0)) + 1); }

/* possible duplicate: same zone and type, still open, within 30 minutes */
function findDup(c, pool){
  const d = (pool||complaints).find(x=> x!==c && x.id!==c.id && x.status!=="Resolved" && !x.dupOf &&
    x.zone===c.zone && x.type===c.type && Math.abs(c.ts - x.ts) <= DUP_WINDOW_MIN*60e3);
  return d? d.id : null;
}

let currentUser = null;
let currentAdmin = null;

/* ---------- Citizen notifications ---------- */
let notifications = [];
function loadNotifs(){
  if(SB_ON){ notifications = []; return; }
  try{ const r = localStorage.getItem(KEY_N); notifications = r? JSON.parse(r):[]; }
  catch(e){ notifications = []; }
}
function saveNotifs(){ if(SB_ON) return sbMarkRead(); try{ localStorage.setItem(KEY_N, JSON.stringify(notifications)); }catch(e){} }

function agentDisplay(id){ const f = FLEET.find(f=>f.id===id); return f? `${f.icon} ${f.name} (${f.id})` : id; }

/* creates a notification tied to a complaint; shown to the citizen who filed it */
function notify(c, msg, icon){
  if(c.source!=="citizen") return;
  if(SB_ON) return sbNotify(c, msg, icon);
  notifications.unshift({ id:"N"+Date.now().toString(36)+Math.random().toString(36).slice(2,6),
    ts:Date.now(), complaintId:c.id, owner:c.owner||null, source:c.source, msg, icon:icon||"🔔", read:false });
  if(notifications.length>80) notifications.length = 80;
  saveNotifs(); renderNotifs();
  if(document.getElementById("citizenShell").classList.contains("active") && notifVisible(notifications[0]))
    toast((icon||"🔔")+" "+msg);
}
function notifVisible(n){
  if(n.source!=="citizen") return false;
  return !n.owner || n.owner===currentUser;
}
function myNotifs(){ return notifications.filter(notifVisible); }

function renderNotifs(){
  const list = myNotifs();
  const unread = list.filter(n=>!n.read).length;
  const badge = document.getElementById("nbadge");
  badge.textContent = unread>9? "9+" : unread;
  badge.classList.toggle("hidden", unread===0);
  const fmt = t=>{
    const m = Math.round((Date.now()-t)/60000);
    return m<1? "just now" : m<60? m+" min ago" : hhmm(t);
  };
  document.getElementById("notifList").innerHTML = list.length? list.map(n=>`
    <div class="notif-item ${n.read?"":"unread"}">
      <span class="n-ic">${n.icon}</span>
      <div>${esc(n.msg)}<div class="n-time">${esc(n.complaintId)} · ${fmt(n.ts)}</div></div>
    </div>`).join("") : `<div class="notif-empty">No notifications yet.<br>You'll be alerted here when the command center approves and dispatches a vehicle.</div>`;
}
function toggleNotifs(ev){
  ev.stopPropagation();
  const p = document.getElementById("notifPanel");
  const opening = !p.classList.contains("open");
  p.classList.toggle("open", opening);
  if(opening){ myNotifs().forEach(n=>n.read=true); saveNotifs(); setTimeout(renderNotifs, 400); }
}
function markAllRead(){ myNotifs().forEach(n=>n.read=true); saveNotifs(); renderNotifs(); }
document.addEventListener("click", e=>{
  const p = document.getElementById("notifPanel");
  if(p.classList.contains("open") && !p.contains(e.target)) p.classList.remove("open");
});

/* status-change notification messages for the citizen */
function notifyStatusChange(c, prev){
  if(prev===c.status) return;
  const zn = Z[c.zone].name;
  const tr = vehicleTrack(c);
  if(c.status==="Dispatched" && c.agent)
    notify(c, `Approved by the command center. ${agentDisplay(c.agent)} has been dispatched from ${tr? tr.from.name : "its base"} to ${zn}` +
      (tr? `, about ${tr.kmLeft.toFixed(1)} km away, arriving in about ${fmtEta(tr.msLeft)}` : "") + `. Track it live under My Reports.`, "🚨");
  else if(c.status==="Accepted")
    notify(c, `The ${c.agent||"rescue"} crew has accepted your request and is on the way to ${zn}` +
      (tr && !tr.arrived? ` (${tr.kmLeft.toFixed(1)} km away)` : "") + `.`, "📡");
  else if(c.status==="In Progress")
    notify(c, `Rescue crew has reached ${zn}. Operation in progress.`, "🛟");
  else if(c.status==="Resolved")
    notify(c, `Your report at ${zn} has been closed: ${c.outcome||"resolved"}. Stay safe!`, "✅");
}

/* cross-tab live sync: open Citizen in one tab, Admin in another */
window.addEventListener("storage", e=>{
  if(e.key===KEY_O){ loadOfficers(); enforceAdminAccess(); refreshAll(); return; }
  if(!SB_ON && [KEY_C,KEY_N,KEY_A].includes(e.key)){
    const before = myNotifs().filter(n=>!n.read).length;
    loadState(); loadNotifs(); loadAudit(); refreshAll();
    const fresh = myNotifs().filter(n=>!n.read);
    if(document.getElementById("citizenShell").classList.contains("active") && fresh.length>before && fresh[0])
      toast(fresh[0].icon+" "+fresh[0].msg);
  }
});

/* ---------- Routing between views ---------- */
function show(view){
  document.getElementById("landing").style.display = view==="landing" ? "flex":"none";
  document.getElementById("citizenShell").classList.toggle("active", view==="citizen");
  document.getElementById("adminShell").classList.toggle("active", view==="admin");
  window.scrollTo(0,0);
}
function toggleAdminLogin(){
  const p = document.getElementById("adminPop"); p.classList.toggle("open");
  if(p.classList.contains("open")) setTimeout(()=>document.getElementById("adminEmail").focus(), 50);
}
function enterCitizen(){
  currentUser = "Guest Citizen";
  document.getElementById("fName").value = "";
  if(SB_ON){ complaints = []; notifications = []; sbSeenNotifs = null; }
  show("citizen"); showPage("citizen","report"); refreshAll();
  if(SB_ON) sbCitizenRefresh();
}
/* admin accounts: only a SHA-256 of "email:password" is stored (client-side demo, not real auth) */
const ADMIN_ACCOUNTS = {
  "admin@aquila.demo": {name:"Duty Officer (admin@aquila.demo)", hash:"6e6b3b2dec8a4b73e72ac1ee0775bffcc23cb6efc668faa3ebf589bc594e8e43"},
};
async function sha256Hex(s){
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
