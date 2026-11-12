/* =================================================================
   VOICE + GPS — multilingual speech input, exact-location capture
   ================================================================= */
/* =================================================================
   CITIZEN SAFETY SUITE — voice input, GPS, AI assistant, safe routes
   ================================================================= */

/* ---------- real-world coordinates for each zone (approx. locality centers) ---------- */
const GEO = {
  royapuram:[13.113,80.294], washermanpet:[13.117,80.282], annanagar:[13.085,80.210],
  ambattur:[13.114,80.148], avadi:[13.115,80.102], koyambedu:[13.070,80.194],
  egmore:[13.073,80.261], nungambakkam:[13.060,80.242], tnagar:[13.040,80.234],
  mylapore:[13.034,80.270], saidapet:[13.021,80.223], adyar:[13.006,80.257],
  guindy:[13.007,80.221], porur:[13.038,80.156], velachery:[12.976,80.221],
  pallikaranai:[12.949,80.218], madipakkam:[12.962,80.199], tambaram:[12.925,80.127],
  chromepet:[12.951,80.141], mudichur:[12.911,80.067], thiruvanmiyur:[12.983,80.259],
  sholinganallur:[12.901,80.228], perungudi:[12.966,80.246],
};
function havKm(a,b){
  const R=6371, dLa=(b[0]-a[0])*Math.PI/180, dLo=(b[1]-a[1])*Math.PI/180;
  const h=Math.sin(dLa/2)**2 + Math.cos(a[0]*Math.PI/180)*Math.cos(b[0]*Math.PI/180)*Math.sin(dLo/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}
function nearestZone(lat,lng){
  let best=null, bd=1e9;
  for(const [id,g] of Object.entries(GEO)){ const d=havKm([lat,lng],g); if(d<bd){bd=d; best=id;} }
  return {zone:best, km:bd};
}

/* ---------- GPS location for the report ---------- */
let gpsPos = null;
function useMyLocation(){
  const st = document.getElementById("gpsStatus");
  if(!navigator.geolocation){ st.textContent="Location is not supported in this browser."; return; }
  st.textContent = "Locating…";
  navigator.geolocation.getCurrentPosition(p=>{
    gpsPos = {lat:+p.coords.latitude.toFixed(5), lng:+p.coords.longitude.toFixed(5), acc:Math.round(p.coords.accuracy)};
    const nz = nearestZone(gpsPos.lat, gpsPos.lng);
    if(nz.km < 40){ document.getElementById("fZone").value = nz.zone; }
    st.textContent = `✔ Location captured ±${gpsPos.acc} m · nearest zone: ${Z[nz.zone].name}`;
    toast("Location attached. The rescue team will see your exact spot.");
  }, e=>{
    gpsPos = null;
    st.textContent = e.code===1 ? "Permission denied — choose your zone from the list instead." : "Could not get a location — choose your zone instead.";
  }, {enableHighAccuracy:true, timeout:12000, maximumAge:30000});
}
function descWithGps(desc){
  if(!gpsPos) return desc;
  const tag = `[GPS: ${gpsPos.lat},${gpsPos.lng} ±${gpsPos.acc}m]`;
  return (desc && desc!=="—" ? desc+" " : "") + tag;
}
/* turn a [GPS: …] tag in a description into a Google Maps link (officer view) */
function linkGps(escapedDesc){
  return escapedDesc.replace(/\[GPS: (-?\d+\.\d+),(-?\d+\.\d+)[^\]]*\]/g,
    (m,la,lo)=>`<a href="https://www.google.com/maps?q=${la},${lo}" target="_blank" rel="noopener" style="color:#6db3ff">${m} 🗺 open map</a>`);
}

/* ---------- voice input (Web Speech API) ---------- */
const VOICE_LANGS = [
  ["ta-IN","தமிழ் Tamil"],["hi-IN","हिन्दी Hindi"],["en-IN","English (India)"],
  ["te-IN","తెలుగు Telugu"],["ml-IN","മലയാളം Malayalam"],["kn-IN","ಕನ್ನಡ Kannada"],
  ["bn-IN","বাংলা Bengali"],["mr-IN","मराठी Marathi"],["gu-IN","ગુજરાતી Gujarati"],
  ["pa-IN","ਪੰਜਾਬੀ Punjabi"],["ur-IN","اردو Urdu"],["or-IN","ଓଡ଼ିଆ Odia"],
];
let recog = null, recTarget = null;
function voiceLang(){ try{ return localStorage.getItem("aquila_lang") || "ta-IN"; }catch(e){ return "ta-IN"; } }
function voiceLangChanged(){
  const v = document.getElementById("voiceLang").value;
  try{ localStorage.setItem("aquila_lang", v); }catch(e){}
}
function initVoiceLangs(){
  const sel = document.getElementById("voiceLang");
  if(sel){ sel.innerHTML = VOICE_LANGS.map(([c,n])=>`<option value="${c}">${n}</option>`).join(""); sel.value = voiceLang(); }
}
function speechSupported(){ return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }
function voiceToggle(target){ recog && recTarget===target ? voiceStop() : voiceStart(target); }
function voiceStart(target){
  if(!speechSupported()){ toast("Voice input needs Chrome or Edge. Please type instead.", true); return; }
  voiceStop();
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recog = new SR(); recTarget = target;
  recog.lang = voiceLang(); recog.interimResults = true; recog.continuous = true;
  const box = target==="chat" ? document.getElementById("chatIn") : document.getElementById("fDesc");
  const base = box.value ? box.value.replace(/\s+$/,"")+" " : "";
  recog.onresult = ev=>{
    let fin="", inter="";
    for(let i=0;i<ev.results.length;i++){ const r=ev.results[i]; if(r.isFinal) fin += r[0].transcript+" "; else inter += r[0].transcript; }
    box.value = (base + fin + inter).slice(0, 900);
  };
  recog.onerror = e=>{
    if(e.error==="not-allowed") toast("Microphone permission was denied.", true);
    else if(e.error==="no-speech"){} else if(e.error==="network") toast("Voice recognition needs an internet connection.", true);
    voiceStop();
  };
  recog.onend = ()=>{ if(recog){ micUI(null); recog=null; recTarget=null; } };
  try{ recog.start(); micUI(target); }catch(e){ recog=null; recTarget=null; }
}
function voiceStop(){ if(recog){ const r=recog; recog=null; recTarget=null; try{r.stop();}catch(e){} } micUI(null); }
function micUI(active){
  const f = document.getElementById("micForm"), c = document.getElementById("micChat"), t = document.getElementById("micFormTxt");
  if(f){ f.classList.toggle("rec", active==="form"); if(t) t.textContent = active==="form" ? "Listening… tap to stop" : "Speak instead of typing"; }
  if(c) c.classList.toggle("rec", active==="chat");
}
