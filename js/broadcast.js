/* =================================================================
   AREA BROADCASTS — officers send zone-wise updates in the local
   language; citizens see them on the ticker and the Safety Advisory
   (Supabase mode shares them live across devices; demo mode is per-browser)
   ================================================================= */
let broadcasts = [];   // newest first: {id, zone|"", tpl, texts:{en,ta,hi}, ts, by}

const BCAST_TPL = {
  flood_evac: {label:"🌊 Flood — move to shelter", t:{
    en: (z,p)=>`${z}: Water is rising. Move to higher ground now. Relief shelter open at ${p? `the ${p}` : "your nearest"} Corporation school. Do not walk through moving water.`,
    ta: (z,p)=>`${z}: தண்ணீர் உயர்கிறது. உடனே உயரமான இடத்திற்கு செல்லுங்கள். ${p || "அருகிலுள்ள"} மாநகராட்சி பள்ளியில் நிவாரண முகாம் திறக்கப்பட்டுள்ளது. ஓடும் தண்ணீரில் நடக்க வேண்டாம்.`,
    hi: (z,p)=>`${z}: पानी बढ़ रहा है। तुरंत ऊँची जगह जाएँ। ${p || "नज़दीकी"} निगम स्कूल में राहत शिविर खुला है। बहते पानी में न चलें.`}},
  heat_adv: {label:"☀️ Heatwave advisory", t:{
    en: (z,p)=>`${z}: Severe heat until 5 pm. Stay indoors 12–4, drink water every hour, check on the elderly. Cooling centre open at ${p? `the ${p}` : "your nearest"} community hall.`,
    ta: (z,p)=>`${z}: மாலை 5 வரை கடும் வெப்பம். மதியம் 12–4 வெளியே வர வேண்டாம், மணிக்கொருமுறை தண்ணீர் குடியுங்கள், முதியவர்களை கவனியுங்கள். ${p || "அருகிலுள்ள"} சமுதாய கூடத்தில் குளிர்சாதன மையம் உள்ளது.`,
    hi: (z,p)=>`${z}: शाम 5 बजे तक भीषण गर्मी। 12–4 घर के अंदर रहें, हर घंटे पानी पिएँ, बुज़ुर्गों का ध्यान रखें। ${p || "नज़दीकी"} सामुदायिक भवन में कूलिंग सेंटर खुला है.`}},
  water_dist: {label:"🚰 Water tanker timing", t:{
    en: z=>`${z}: Water tanker will reach the main bus stop at 4 pm today. One pot per family; please queue in the shade.`,
    ta: z=>`${z}: இன்று மாலை 4 மணிக்கு முக்கிய பேருந்து நிறுத்தத்திற்கு தண்ணீர் லாரி வரும். குடும்பத்திற்கு ஒரு குடம்; நிழலில் வரிசையில் நிற்கவும்.`,
    hi: z=>`${z}: आज शाम 4 बजे मुख्य बस स्टॉप पर पानी का टैंकर पहुँचेगा। प्रति परिवार एक घड़ा; छाया में कतार लगाएँ.`}},
};

function bcastTexts(tpl, zoneId, custom){
  const name = zoneId ? (Z[zoneId]?.name || zoneId) : "";
  const zn = L => name || {en:"All Chennai zones", ta:"சென்னை அனைத்து மண்டலங்கள்", hi:"चेन्नई के सभी ज़ोन"}[L];
  if(tpl === "custom"){ const c = (custom||"").trim(); return {en:`${zn("en")}: ${c}`, ta:`${zn("ta")}: ${c}`, hi:`${zn("hi")}: ${c}`}; }
  const T = BCAST_TPL[tpl]; if(!T) return null;
  /* name is empty for an all-zones broadcast: there is no single venue to point people to */
  return {en:T.t.en(zn("en"), name), ta:T.t.ta(zn("ta"), name), hi:T.t.hi(zn("hi"), name)};
}
function bcastText(b){ const L = typeof protoLang==="function" ? protoLang() : "en"; return (b.texts && (b.texts[L] || b.texts.en)) || ""; }

/* ---------- storage: Supabase table when available, else this browser ---------- */
const bcRow = r => ({id:r.id, zone:r.zone||"", tpl:r.tpl, texts:r.texts, ts:+new Date(r.ts), by:r.by});
async function loadBroadcasts(){
  if(!SB_ON){
    try{ broadcasts = JSON.parse(localStorage.getItem("aquila_broadcasts_v1")||"[]"); }catch(e){ broadcasts = []; }
    return;
  }
  /* Supabase mode: the shared table is the only source; wait for the client to finish loading */
  const client = await sbReady; if(!client) return;
  const {data, error} = await client.from("broadcasts").select("*").order("ts",{ascending:false}).limit(20);
  if(!error && data){ broadcasts = data.map(bcRow); paintBroadcasts(); }
  try{
    client.channel("bcast").on("postgres_changes",{event:"INSERT",schema:"public",table:"broadcasts"},(p)=>{
      const b = bcRow(p.new);
      if(broadcasts.some(x=>x.id===b.id)) return;
      broadcasts.unshift(b); paintBroadcasts();
      toast("📢 " + bcastText(b).slice(0,80) + "…");
    }).subscribe();
  }catch(e){}
}
function saveBroadcastsLocal(){ try{ localStorage.setItem("aquila_broadcasts_v1", JSON.stringify(broadcasts.slice(0,20))); }catch(e){} }

async function sendBroadcast(){
  const zone = document.getElementById("bcZone").value;
  const tpl  = document.getElementById("bcTpl").value;
  const custom = document.getElementById("bcCustom").value;
  if(tpl==="custom" && !custom.trim()){ toast("Type the custom message first.", true); return; }
  const texts = bcastTexts(tpl, zone, custom); if(!texts) return;
  const b = {id:"BC-"+Date.now().toString(36), zone, tpl, texts, ts:Date.now(), by:currentAdmin||"Officer"};
  if(SB_ON){
    const client = await sbReady; if(!client){ toast("Broadcast service unreachable.", true); return; }
    const {data, error} = await client.from("broadcasts").insert({zone:zone||null, tpl, texts, by:b.by}).select().single();
    if(error){ toast("Broadcast failed: "+error.message, true); return; }
    /* show it here at once; the realtime echo is de-duplicated by id */
    if(data && !broadcasts.some(x=>x.id===data.id)) broadcasts.unshift(bcRow(data));
  }else{
    broadcasts.unshift(b); saveBroadcastsLocal();
  }
  log(currentAdmin||"Officer", "Area broadcast sent", zone? (Z[zone]?.name||zone) : "All zones", texts.en.slice(0,120));
  paintBroadcasts();
  toast(`📢 Broadcast sent to ${zone? Z[zone].name : "all zones"} in 3 languages.`);
}

/* ---------- admin page ---------- */
function bcPreview(){
  const zone = document.getElementById("bcZone")?.value ?? "";
  const tpl  = document.getElementById("bcTpl")?.value ?? "flood_evac";
  const custom = document.getElementById("bcCustom")?.value ?? "";
  document.getElementById("bcCustom").style.display = tpl==="custom" ? "" : "none";
  const t = bcastTexts(tpl, zone, custom || "…");
  const host = document.getElementById("bcPreview");
  if(host && t) host.innerHTML = ["en","ta","hi"].map(L=>`<div class="bc-prev"><span class="bc-lang">${L.toUpperCase()}</span>${esc(t[L])}</div>`).join("");
}
function initBroadcastUI(){
  const zs = document.getElementById("bcZone");
  if(zs) zs.innerHTML = `<option value="">📢 All zones</option>` + ZONES.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(z=>`<option value="${z.id}">${z.name}</option>`).join("");
  const ts = document.getElementById("bcTpl");
  if(ts) ts.innerHTML = Object.entries(BCAST_TPL).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join("") + `<option value="custom">✏️ Custom message</option>`;
  bcPreview();
}
function renderBroadcastsAdmin(){
  const host = document.getElementById("bcSent"); if(!host) return;
  host.innerHTML = broadcasts.slice(0,12).map(b=>`
    <div class="bc-row"><span class="bc-zone">${b.zone? esc(Z[b.zone]?.name||b.zone) : "All zones"}</span>
      <div>${esc(b.texts.en)}<div class="aw-sub">${hhmm(b.ts)} · ${esc(b.by||"")} · sent in English, Tamil, Hindi</div></div>
    </div>`).join("") || `<div style="color:var(--muted); font-size:13px;">No broadcasts sent yet.</div>`;
}

/* ---------- citizen surfaces: Safety Advisory panel (+ ticker via setTicker) ---------- */
function renderBroadcastsCitizen(){
  const host = document.getElementById("czBroadcasts"); if(!host) return;
  host.innerHTML = broadcasts.length
    ? broadcasts.slice(0,5).map(b=>`
        <div class="bc-row"><span class="bc-zone">${b.zone? esc(Z[b.zone]?.name||b.zone) : "All Chennai"}</span>
          <div>${esc(bcastText(b))}<div class="aw-sub">${hhmm(b.ts)} · Command Center</div></div>
        </div>`).join("")
    : `<div style="color:var(--muted); font-size:13px;">No area updates yet. Official zone-wise instructions will appear here in your language.</div>`;
}
function paintBroadcasts(){ renderBroadcastsAdmin(); renderBroadcastsCitizen(); if(typeof setTicker==="function") setTicker(); }
