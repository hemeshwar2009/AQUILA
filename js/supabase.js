/* =================================================================
   SUPABASE BACKEND — auth, incident data, officers (demo mode when keys empty)
   ================================================================= */
/* =================================================================
   SUPABASE ADMIN AUTH
   Fill in your project's URL and anon (public) key to switch admin sign-in
   to Supabase. Leave them empty to use the built-in demo login above.
   The anon key is meant to be public; NEVER put the service_role key here.
   ================================================================= */
const SUPABASE_URL = "https://sieruxnpbvwwsbhlclqk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpZXJ1eG5wYnZ3d3NiaGxjbHFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ0NDg0NDAsImV4cCI6MjExMDAyNDQ0MH0.yH7--KUHOZ7eiy-mQhyWKeWE_DMnXHlht-G2Txpyx_M";
const SB_ON = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
// read the invite/recovery result from the URL before the Supabase client consumes it
const SB_LINK = (()=>{ const h = new URLSearchParams(location.hash.slice(1)); return {type:h.get("type"), error:h.get("error_description")}; })();
let sb = null, sbOfficers = [], currentAdminId = null;
const sbReady = !SB_ON ? Promise.resolve(null) : new Promise((resolve)=>{
  const s = document.createElement("script");
  s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";
  s.onload = ()=>{ sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {auth:{persistSession:true, detectSessionInUrl:true, flowType:"implicit"}}); resolve(sb); };
  s.onerror = ()=>{ toast("Could not reach the sign-in service. Check your connection.", true); resolve(null); };
  document.head.appendChild(s);
});
async function sbEnterAdmin(email, password){
  const client = await sbReady; if(!client) return;
  const {data, error} = await client.auth.signInWithPassword({email, password});
  if(error || !data?.user){ toast("Incorrect email or password.", true); return; }
  const {data:row} = await client.from("admins").select("name, disabled, accepted_at").eq("user_id", data.user.id).maybeSingle();
  if(!row || row.disabled || !row.accepted_at){
    await client.auth.signOut({scope:"local"});
    toast(row?.disabled? "This account has been disabled. Contact an admin." : "This account doesn't have admin access.", true); return;
  }
  return {name:row.name, id:data.user.id};
}
async function sbLoadOfficers(){
  if(!sb || !currentAdminId) return;
  const {data, error} = await sb.from("admins").select("*").order("created_at");
  if(!error){ sbOfficers = data||[]; renderOfficers(); renderNavBadges(); }
}
async function sbInviteOfficer(name, email){
  const {data, error} = await sb.functions.invoke("invite-officer", {body:{name, email, redirectTo: location.origin + location.pathname}});
  if(error){
    let msg = "Could not send the invite.";
    try{ msg = (await error.context.json()).error || msg; }catch(e){}
    toast(msg, true); return false;
  }
  return !!data?.ok;
}
async function sbSetDisabled(id, disabled){
  const o = sbOfficers.find(x=>x.user_id===id); if(!o) return;
  const {error} = await sb.from("admins").update({disabled}).eq("user_id", id);
  if(error){ toast("Could not update that officer.", true); return; }
  log(currentAdmin, disabled? "Officer disabled" : "Officer re-enabled", "—", `${o.name} <${o.email}>`);
  toast(`${o.name} ${disabled? "disabled":"re-enabled"}.`); sbLoadOfficers();
}
async function sbRemove(id){
  const o = sbOfficers.find(x=>x.user_id===id); if(!o) return;
  const pending = !o.accepted_at;
  if(!confirm(pending? `Revoke the invite for ${o.name} (${o.email})?` : `Remove admin access for ${o.name} (${o.email})? They would need a new invite.`)) return;
  const {error} = await sb.from("admins").delete().eq("user_id", id);
  if(error){ toast("Could not remove that officer.", true); return; }
  log(currentAdmin, pending? "Invite revoked" : "Officer removed", "—", `${o.name} <${o.email}>`);
  toast(pending? "Invite revoked." : `${o.name} removed.`); sbLoadOfficers();
}
/* the invite email link brings the officer back here signed in; they choose a password */
async function sbCheckInviteLink(){
  if(SB_LINK.error){ toast("This invite link is invalid or has expired. Ask an admin for a new one.", true); clearInviteParam(); return; }
  if(SB_LINK.type!=="invite" && SB_LINK.type!=="recovery") return;
  const client = await sbReady; if(!client) return;
  const {data:{session}} = await client.auth.getSession();
  if(!session){ toast("This invite link is invalid or has expired.", true); clearInviteParam(); return; }
  const u = session.user, isInvite = SB_LINK.type==="invite";
  document.getElementById("inviteBody").innerHTML = `
    <div style="font-size:13px; color:var(--ink2);">${isInvite? "You've been invited to the Aquila command center. Choose a password to finish setting up." : "Choose a new password for your admin account."}</div>
    <div><label>Email</label><input value="${esc(u.email)}" readonly style="opacity:.75"></div>
    ${isInvite? `<div><label>Full name</label><input id="accName" value="${esc(u.user_metadata?.name||"")}" maxlength="40"></div>` : ""}
    <div><label>Choose a password</label><input id="accPass" type="password" autocomplete="new-password" placeholder="At least 8 characters, with a letter and a number"></div>
    <div><label>Confirm password</label><input id="accPass2" type="password" autocomplete="new-password" onkeydown="if(event.key==='Enter')acceptInvite()"></div>
    <button class="btn" style="justify-content:center;" onclick="acceptInvite()">${isInvite? "Create my account" : "Save new password"}</button>`;
  pendingInvite = "supabase";
  document.getElementById("inviteBg").classList.add("open");
  setTimeout(()=>document.getElementById("accPass").focus(), 50);
}
async function sbAcceptInvite(){
  const nameEl = document.getElementById("accName"), name = nameEl? nameEl.value.trim() : null;
  const p1 = document.getElementById("accPass").value, p2 = document.getElementById("accPass2").value;
  if(nameEl && name.length<2){ toast("Enter your full name.", true); return; }
  if(p1.length<8 || !/[A-Za-z]/.test(p1) || !/\d/.test(p1)){ toast("Password needs at least 8 characters, including a letter and a number.", true); return; }
  if(p1!==p2){ toast("The passwords don't match.", true); return; }
  const {data:{user}, error} = await sb.auth.updateUser({password:p1});
  if(error || !user){ toast(error?.message || "Could not save your password.", true); return; }
  const {error:rpcErr} = await sb.rpc("mark_invite_accepted", {p_name: name});
  if(rpcErr){ toast("Password saved, but your admin access couldn't be confirmed. Contact an admin.", true); }
  else log(name || user.email, SB_LINK.type==="invite"? "Officer account created" : "Password reset", "—", user.email);
  await sb.auth.signOut({scope:"local"});
  closeInviteAccept();
  document.getElementById("adminEmail").value = user.email;
  document.getElementById("adminPop").classList.add("open");
  setTimeout(()=>document.getElementById("adminPass").focus(), 50);
  toast("Password saved. Sign in to continue.");
}
/* =================================================================
   SUPABASE INCIDENT DATA
   Admins read/update the tables directly (row-level security allows only
   active admins). Citizens never touch the tables: they go through server
   functions with a private random token kept in this browser.
   ================================================================= */
const KEY_TOKEN = "aquila_citizen_token";
let citizenToken = null, sbSynced = {}, sbChannel = null, sbReloadTimer = null, sbSeenNotifs = null;
function getCitizenToken(){
  if(citizenToken) return citizenToken;
  try{ citizenToken = localStorage.getItem(KEY_TOKEN); }catch(e){}
  if(!citizenToken || citizenToken.length < 32){
    citizenToken = randomHex(24);
    try{ localStorage.setItem(KEY_TOKEN, citizenToken); }catch(e){}
  }
  return citizenToken;
}
const msOf = v => v ? Date.parse(v) : Date.now();
function sbFromRow(r){
  const x = r.extra || {};
  return {id:r.id, ts:msOf(r.created_at), zone:r.zone, type:r.type, severity:r.severity, people:r.people, depth:r.depth,
    name:r.name, phone:r.phone, desc:r.description, status:r.status, agent:r.agent, source:r.source,
    score:r.score, aiScore:r.ai_score, dupOf:r.dup_of, owner:null,
    t:x.t||{}, override:x.override, approvedBy:x.approvedBy, closedBy:x.closedBy, outcome:x.outcome,
    crewDone:x.crewDone, crewReport:x.crewReport, dupResolved:x.dupResolved};
}
function sbToRow(c){
  return {status:c.status, agent:c.agent||null, score:c.score, dup_of:c.dupOf||null,
    extra:{t:c.t||{}, override:c.override, approvedBy:c.approvedBy, closedBy:c.closedBy, outcome:c.outcome,
      crewDone:c.crewDone, crewReport:c.crewReport, dupResolved:c.dupResolved}};
}
const sbErr = (what, error)=>{ console.warn(what, error); toast(`${what} failed: ${error?.message || "network error"}`, true); };

/* ---- admin side ---- */
async function sbLoadAdminData(){
  if(!sb || !currentAdminId) return;
  const [c, a] = await Promise.all([
    sb.from("complaints").select("*").order("created_at", {ascending:false}),
    sb.from("audit_log").select("created_at, actor, action, complaint_id, detail").order("created_at", {ascending:false}).limit(800),
  ]);
  if(!currentAdminId) return;                       // signed out while loading
  if(c.error) return sbErr("Loading incidents", c.error);
  complaints = c.data.map(sbFromRow);
  sbSynced = Object.fromEntries(complaints.map(x=>[x.id, JSON.stringify(sbToRow(x))]));
  if(!a.error) auditLog = a.data.reverse().map(e=>({ts:msOf(e.created_at), actor:e.actor, action:e.action, cid:e.complaint_id||"—", detail:e.detail}));
  refreshAll();
}
/* push every complaint whose saved fields changed since the last sync */
function sbPushChanges(){
  if(!sb || !currentAdminId) return;
  complaints.forEach(c=>{
    const row = sbToRow(c), s = JSON.stringify(row);
    if(sbSynced[c.id] === s) return;
    sbSynced[c.id] = s;
    sb.from("complaints").update(row).eq("id", c.id).then(({error})=>{ if(error){ delete sbSynced[c.id]; sbErr(`Saving ${c.id}`, error); } });
  });
}
function sbLog(actor, action, cid, detail){
  if(!sb || !currentAdminId) return Promise.resolve();
  return sb.from("audit_log").insert({actor:String(actor).slice(0,120), action:String(action).slice(0,80),
    complaint_id: cid && cid!=="—" ? cid : null, detail:String(detail||"").slice(0,1000)})
    .then(({error})=>{ if(error) console.warn("audit log", error); });
}
function sbNotify(c, msg, icon){
  if(!sb || !currentAdminId) return;
  sb.from("notifications").insert({complaint_id:c.id, msg:msg.slice(0,500), icon:icon||"🔔"})
    .then(({error})=>{ if(error) console.warn("notification", error); });
}
function sbSubscribe(){
  if(!sb || sbChannel) return;
  const reload = ()=>{ clearTimeout(sbReloadTimer); sbReloadTimer = setTimeout(sbLoadAdminData, 400); };
  sbChannel = sb.channel("aquila-admin")
    .on("postgres_changes", {event:"*", schema:"public", table:"complaints"}, reload)
    .on("postgres_changes", {event:"INSERT", schema:"public", table:"audit_log"}, reload)
    .subscribe();
}
function sbUnsubscribe(){ if(sb && sbChannel){ sb.removeChannel(sbChannel); } sbChannel = null; }
async function sbSubmitScenario(fields){
  const {error} = await sb.rpc("submit_report", {p_zone:fields.zone, p_type:fields.type, p_people:fields.people, p_depth:fields.depth,
    p_name:fields.name, p_phone:fields.phone, p_desc:fields.desc, p_token:null, p_source:"scenario"});
  if(error) sbErr("Adding scenario report", error);
}
async function sbResetDemo(){
  if(!confirm("Reset ALL incidents in the shared database to the 13 demo incidents? Every officer will see this. The audit log is kept.")) return;
  const {error} = await sb.rpc("reset_demo");
  if(error) return sbErr("Reset", error);
  closeIncident(); await sbLoadAdminData(); toast("Demo data reset.");
}

/* ---- citizen side ---- */
async function sbCitizenRefresh(){
  const client = await sbReady; if(!client || !document.getElementById("citizenShell").classList.contains("active")) return;
  const tok = getCitizenToken();
  const [pub, mine, notes] = await Promise.all([
    client.rpc("public_incidents"), client.rpc("citizen_reports", {p_token:tok}), client.rpc("citizen_notifications", {p_token:tok})]);
  if(pub.error || mine.error){ return sbErr("Loading reports", pub.error || mine.error); }
  const base = r=>({id:r.id, ts:msOf(r.created_at), zone:r.zone, type:r.type, people:r.people, depth:r.depth||0,
    status:r.status, agent:r.agent, t:r.t||{}, outcome:r.outcome});
  const byId = {};
  (pub.data||[]).forEach(r=>{ byId[r.id] = {...base(r), source:"public", score:r.critical? 80 : 0}; });
  (mine.data||[]).forEach(r=>{ byId[r.id] = {...(byId[r.id]||{score:0}), ...base(r), source:"citizen", owner:null}; });
  complaints = Object.values(byId).sort((a,b)=>b.ts-a.ts);
  if(!notes.error){
    notifications = (notes.data||[]).map(n=>({id:"S"+n.id, ts:msOf(n.created_at), complaintId:n.complaint_id, owner:null, source:"citizen", msg:n.msg, icon:n.icon, read:n.read}));
    const fresh = notifications.filter(n=>!n.read && sbSeenNotifs && !sbSeenNotifs.has(n.id));
    sbSeenNotifs = new Set(notifications.map(n=>n.id));
    if(fresh[0]) toast(fresh[0].icon+" "+fresh[0].msg);
  }
  refreshAll();
}
async function sbCitizenSubmit(fields){
  const client = await sbReady; if(!client) return null;
  const {data, error} = await client.rpc("submit_report", {p_zone:fields.zone, p_type:fields.type, p_people:fields.people, p_depth:fields.depth,
    p_name:fields.name, p_phone:fields.phone, p_desc:fields.desc, p_token:getCitizenToken(), p_source:"citizen"});
  if(error){ toast(error.message || "Could not submit the report. Please try again or call 112.", true); return null; }
  return data?.id || null;
}
function sbMarkRead(){ if(sb) sb.rpc("citizen_mark_read", {p_token:getCitizenToken()}).then(()=>{}); }
/* citizens poll for updates every 8 s while their portal is open */
setInterval(()=>{ if(SB_ON && document.getElementById("citizenShell").classList.contains("active")) sbCitizenRefresh(); }, 8000);

/* signed-in officers are re-checked every 30 s, so disabling someone signs them out */
setInterval(async ()=>{
  if(!SB_ON || !sb || !currentAdminId) return;
  const {data:row, error} = await sb.from("admins").select("disabled, accepted_at").eq("user_id", currentAdminId).maybeSingle();
  if(!error && (!row || row.disabled)){ logout(); toast("Your admin access was removed or disabled.", true); }
}, 30000);

/* ---------- officer accounts created by invite (stored in this browser; demo only) ---------- */
const KEY_O = "aquila_officers_v1";
const INVITE_HOURS = 48;
let officers = {accounts:{}, invites:{}};
let currentAdminEmail = null;
function loadOfficers(){
  try{ const r = localStorage.getItem(KEY_O); if(r){ const o = JSON.parse(r); officers = {accounts:o.accounts||{}, invites:o.invites||{}}; } }catch(e){}
  const now = Date.now();
  Object.entries(officers.invites).forEach(([t,i])=>{ if(i.expires < now) delete officers.invites[t]; });
}
function saveOfficers(){ try{ localStorage.setItem(KEY_O, JSON.stringify(officers)); }catch(e){} }
function randomHex(bytes){ return [...crypto.getRandomValues(new Uint8Array(bytes))].map(b=>b.toString(16).padStart(2,"0")).join(""); }
const officerHash = (salt, email, pw)=> sha256Hex(salt+":"+email+":"+pw);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function emailTaken(email){ return !!ADMIN_ACCOUNTS[email] || !!officers.accounts[email]; }
function inviteLink(token){ return location.origin + location.pathname + "?invite=" + token; }

let inviting = false;
async function inviteOfficer(){
  const name = document.getElementById("invName").value.trim();
  const email = document.getElementById("invEmail").value.trim().toLowerCase();
  if(name.length<2){ toast("Enter the officer's full name.", true); return; }
  if(!EMAIL_RE.test(email)){ toast("Enter a valid email address.", true); return; }
  if(SB_ON){
    if(inviting) return; inviting = true;
    try{
      if(!(await sbInviteOfficer(name, email))) return;
      log(currentAdmin, "Officer invited", "—", `${name} <${email}> · invite email sent by Supabase`);
      document.getElementById("invName").value = ""; document.getElementById("invEmail").value = "";
      const box = document.getElementById("invResult"); box.classList.remove("hidden");
      box.innerHTML = `✅ Invite email sent to <b>${esc(name)}</b> (${esc(email)}). They'll get a link to choose their own password.`;
      sbLoadOfficers(); refreshAll();
    } finally { inviting = false; }
    return;
  }
  if(emailTaken(email)){ toast("That email already has an admin account.", true); return; }
  Object.entries(officers.invites).forEach(([t,i])=>{ if(i.email===email) delete officers.invites[t]; }); // newest invite wins
  const token = randomHex(16);
  officers.invites[token] = {email, name, invitedBy:currentAdmin, ts:Date.now(), expires:Date.now()+INVITE_HOURS*3600e3};
  saveOfficers();
  log(currentAdmin, "Officer invited", "—", `${name} <${email}> · link valid ${INVITE_HOURS} h`);
  document.getElementById("invName").value = ""; document.getElementById("invEmail").value = "";
  const box = document.getElementById("invResult");
  box.classList.remove("hidden");
  box.innerHTML = `✅ Invite created for <b>${esc(name)}</b> (${esc(email)}). Send them this one-time link (valid ${INVITE_HOURS} hours):
    <div class="m-actions"><input type="text" readonly value="${esc(inviteLink(token))}" style="flex:1; min-width:240px;" onclick="this.select()">
    <button class="btn sm" onclick="copyInvite('${token}')">Copy link</button></div>`;
  refreshAll();
}
async function copyInvite(token){
  const link = inviteLink(token);
  try{ await navigator.clipboard.writeText(link); toast("Invite link copied."); }
  catch(e){ prompt("Copy this invite link:", link); }
}
function revokeInvite(token){
  const i = officers.invites[token]; if(!i) return;
  delete officers.invites[token]; saveOfficers();
  log(currentAdmin, "Invite revoked", "—", `${i.name} <${i.email}>`);
  refreshAll(); toast("Invite revoked.");
}
function setOfficerDisabled(email, disabled){
  const a = officers.accounts[email]; if(!a) return;
  if(email===currentAdminEmail){ toast("You can't disable your own account.", true); return; }
  a.disabled = disabled; saveOfficers();
  log(currentAdmin, disabled? "Officer disabled" : "Officer re-enabled", "—", `${a.name} <${email}>`);
  refreshAll(); toast(`${a.name} ${disabled? "disabled":"re-enabled"}.`);
}
function removeOfficer(email){
  const a = officers.accounts[email]; if(!a) return;
  if(email===currentAdminEmail){ toast("You can't remove your own account.", true); return; }
  if(!confirm(`Remove admin access for ${a.name} (${email})? This cannot be undone; they would need a new invite.`)) return;
  delete officers.accounts[email]; saveOfficers();
  log(currentAdmin, "Officer removed", "—", `${a.name} <${email}>`);
  refreshAll(); toast(`${a.name} removed.`);
}
function renderOfficers(){
  const body = document.getElementById("officersBody"); if(!body) return;
  const ago = t=>{ const h = (Date.now()-t)/3600e3; return h<1? "just now" : h<24? Math.round(h)+" h ago" : new Date(t).toLocaleDateString("en-IN"); };
  const you = e=> e===currentAdminEmail? ` <span class="flag" style="color:#4ad2a0; border-color:rgba(25,158,112,.4); background:rgba(25,158,112,.12);">you</span>` : "";
  const note = document.getElementById("officersNote");
  if(SB_ON){
    if(note) note.innerHTML = `<b>Supabase:</b> passwords are checked by Supabase Auth and never stored in this page. Invited officers get an email with a one-time link to choose their password. Disabled officers are signed out within 30 seconds.`;
    body.innerHTML = sbOfficers.map(o=>{
      const st = o.disabled? ["st-pending","Disabled"] : o.accepted_at? ["st-accepted","Active"] : ["st-dispatched","Invite sent"];
      const self = o.user_id===currentAdminId;
      return `<tr>
        <td><b>${esc(o.name)}</b>${self? you(currentAdminEmail):""}</td><td>${esc(o.email)}</td>
        <td><span class="badge-st ${st[0]}">${st[1]}</span></td>
        <td style="color:var(--muted)">${ago(new Date(o.created_at).getTime())} · by ${esc(o.created_by||"—")}</td>
        <td style="white-space:nowrap;">${self? "" : (o.accepted_at? `
          <button class="btn ghost sm" onclick="sbSetDisabled('${esc(o.user_id)}', ${!o.disabled})">${o.disabled? "Enable":"Disable"}</button>` : "") + `
          <button class="btn ghost sm" onclick="sbRemove('${esc(o.user_id)}')">${o.accepted_at? "Remove":"Revoke"}</button>`}</td></tr>`;
    }).join("") || `<tr><td colspan="5" style="text-align:center; color:var(--muted); padding:20px;">Loading officers…</td></tr>`;
    return;
  }
  const rows = [];
  Object.entries(ADMIN_ACCOUNTS).forEach(([email,a])=> rows.push(`<tr>
    <td><b>${esc(a.name)}</b>${you(email)}</td><td>${esc(email)}</td>
    <td><span class="badge-st st-resolved">Built-in</span></td><td style="color:var(--muted)">Set in code</td>
    <td style="color:var(--muted); font-size:12px;">Change in index.html</td></tr>`));
  Object.entries(officers.accounts).forEach(([email,a])=> rows.push(`<tr>
    <td><b>${esc(a.name)}</b>${you(email)}</td><td>${esc(email)}</td>
    <td><span class="badge-st ${a.disabled? "st-pending":"st-accepted"}">${a.disabled? "Disabled":"Active"}</span></td>
    <td style="color:var(--muted)">${ago(a.createdTs)} · by ${esc(a.createdBy||"—")}</td>
    <td style="white-space:nowrap;">${email===currentAdminEmail? "" : `
      <button class="btn ghost sm" onclick="setOfficerDisabled('${esc(email)}', ${!a.disabled})">${a.disabled? "Enable":"Disable"}</button>
      <button class="btn ghost sm" onclick="removeOfficer('${esc(email)}')">Remove</button>`}</td></tr>`));
  Object.entries(officers.invites).forEach(([t,i])=> rows.push(`<tr>
    <td><b>${esc(i.name)}</b></td><td>${esc(i.email)}</td>
    <td><span class="badge-st st-dispatched">Invite pending</span></td>
    <td style="color:var(--muted)">expires in ${Math.max(1, Math.round((i.expires-Date.now())/3600e3))} h · by ${esc(i.invitedBy||"—")}</td>
    <td style="white-space:nowrap;"><button class="btn ghost sm" onclick="copyInvite('${t}')">Copy link</button>
      <button class="btn ghost sm" onclick="revokeInvite('${t}')">Revoke</button></td></tr>`));
  body.innerHTML = rows.join("");
}

/* accepting an invite: the officer opens ?invite=<token> and sets their own password */
let pendingInvite = null;
function checkInviteLink(){
  if(SB_ON) return sbCheckInviteLink();
  const token = new URLSearchParams(location.search).get("invite"); if(!token) return;
  const inv = officers.invites[token];
  if(!inv || inv.expires < Date.now() || emailTaken(inv.email)){
    clearInviteParam(); toast("This invite link is invalid, already used, or has expired.", true); return;
  }
  pendingInvite = token;
  document.getElementById("inviteBody").innerHTML = `
    <div style="font-size:13px; color:var(--ink2);">You were invited by <b>${esc(inv.invitedBy||"an admin")}</b> to join the Aquila command center.</div>
    <div><label>Email</label><input value="${esc(inv.email)}" readonly style="opacity:.75"></div>
    <div><label>Full name</label><input id="accName" value="${esc(inv.name)}" maxlength="40"></div>
    <div><label>Choose a password</label><input id="accPass" type="password" autocomplete="new-password" placeholder="At least 8 characters, with a letter and a number"></div>
    <div><label>Confirm password</label><input id="accPass2" type="password" autocomplete="new-password" onkeydown="if(event.key==='Enter')acceptInvite()"></div>
    <button class="btn" style="justify-content:center;" onclick="acceptInvite()">Create my account</button>`;
  document.getElementById("inviteBg").classList.add("open");
  setTimeout(()=>document.getElementById("accPass").focus(), 50);
}
function clearInviteParam(){ history.replaceState(null, "", location.pathname); }
function closeInviteAccept(){ if(pendingInvite==="supabase" && sb) sb.auth.signOut({scope:"local"}); pendingInvite = null; document.getElementById("inviteBg").classList.remove("open"); clearInviteParam(); }
async function acceptInvite(){
  if(pendingInvite==="supabase") return sbAcceptInvite();
  loadOfficers();
  const inv = pendingInvite && officers.invites[pendingInvite];
  if(!inv || emailTaken(inv.email)){ closeInviteAccept(); toast("This invite is no longer valid.", true); return; }
  const name = document.getElementById("accName").value.trim();
  const p1 = document.getElementById("accPass").value, p2 = document.getElementById("accPass2").value;
  if(name.length<2){ toast("Enter your full name.", true); return; }
  if(p1.length<8 || !/[A-Za-z]/.test(p1) || !/\d/.test(p1)){ toast("Password needs at least 8 characters, including a letter and a number.", true); return; }
  if(p1!==p2){ toast("The passwords don't match.", true); return; }
  const salt = randomHex(16);
  officers.accounts[inv.email] = {name, salt, hash: await officerHash(salt, inv.email, p1), createdBy:inv.invitedBy, createdTs:Date.now(), disabled:false};
  delete officers.invites[pendingInvite]; saveOfficers();
  log(name, "Officer account created", "—", `${inv.email} · invited by ${inv.invitedBy||"—"}`);
  closeInviteAccept();
  document.getElementById("adminEmail").value = inv.email;
  document.getElementById("adminPop").classList.add("open");
  setTimeout(()=>document.getElementById("adminPass").focus(), 50);
  toast("Account created. Sign in with your new password.");
}

/* a disabled or removed officer is signed out straight away */
function enforceAdminAccess(){
  if(SB_ON || !currentAdmin || !currentAdminEmail || ADMIN_ACCOUNTS[currentAdminEmail]) return;
  const a = officers.accounts[currentAdminEmail];
  if(!a || a.disabled){ currentAdmin = null; logout(); toast("Your admin access was removed or disabled.", true); }
}

async function enterAdmin(){
  const email = document.getElementById("adminEmail").value.trim().toLowerCase();
  const p = document.getElementById("adminPass").value;
  if(SB_ON){
    if(!email || !p){ toast("Enter your email and password.", true); return; }
    const who = await sbEnterAdmin(email, p); if(!who) return;
    currentAdmin = who.name; currentAdminEmail = email; currentAdminId = who.id;
    document.getElementById("adminPass").value = "";
    document.getElementById("adminWho").textContent = "👤 " + currentAdmin;
    complaints = []; auditLog = []; notifications = [];
    log(currentAdmin, "Signed in", "—", "Command center (Supabase)");
    show("admin"); showPage("admin","map"); refreshAll(); sbLoadOfficers();
    await sbLoadAdminData(); sbSubscribe();
    return;
  }
  loadOfficers();
  const builtin = ADMIN_ACCOUNTS[email], officer = officers.accounts[email];
  let acct = null;
  try{
    if(builtin && (await sha256Hex(email+":"+p)) === builtin.hash) acct = builtin;
    else if(officer && (await officerHash(officer.salt, email, p)) === officer.hash) acct = officer;
  }catch(e){ toast("Sign-in needs a secure page (https or localhost).", true); return; }
  if(!acct){ toast("Incorrect email or password.", true); return; }
  if(acct.disabled){ toast("This account has been disabled. Contact an admin.", true); return; }
  currentAdmin = acct.name; currentAdminEmail = email;
  document.getElementById("adminPass").value = "";
  document.getElementById("adminWho").textContent = "👤 " + currentAdmin;
  log(currentAdmin, "Signed in", "—", "Command center");
  show("admin"); showPage("admin","map"); refreshAll();
}
function logout(){
  document.getElementById("adminPop").classList.remove("open");
  if(currentAdmin && document.getElementById("adminShell").classList.contains("active")) log(currentAdmin, "Signed out", "—", "");
  if(SB_ON){
    sbUnsubscribe();
    if(sb && currentAdminId) sb.auth.signOut({scope:"local"});
    complaints = []; auditLog = []; notifications = []; sbSynced = {};   // never leave incident data in memory after sign-out
  }
  currentUser=null; currentAdmin=null; currentAdminEmail=null; currentAdminId=null; sbOfficers=[]; document.getElementById("adminPass").value=""; closeIncident(); show("landing");
  const r = document.getElementById("invResult"); if(r){ r.classList.add("hidden"); r.innerHTML = ""; }
}

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg, err){
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.toggle("err", !!err); t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(()=>t.classList.remove("show"), 2800);
}

/* ---------- Ticker ---------- */
function setTicker(){
  const active = complaints.filter(c=>c.status!=="Resolved");
  const crit = active.filter(c=>c.score>=75).length;
  const bc = (typeof broadcasts!=="undefined" && broadcasts[0]) ? `📢 ${bcastText(broadcasts[0])} · ` : "";
  const alerts = (typeof activeAlerts==="function") ? activeAlerts().map(a=>a.text).join(" · ") : "IMD: Heavy rain forecast over Chennai";
  const msg = `${bc}${alerts} · ${active.length} active incidents · ${crit} critical · Chembarambakkam level 92% — controlled release in progress · Helpline 112 / 1913`;
  document.querySelectorAll("[data-tickertext]").forEach(el=>el.textContent = msg);
  const tl = document.getElementById("telem");
  if(tl) tl.textContent = `Sim feed · ${active.length} incidents · ${FLEET.length} vehicles · ${ZONES.length} zones`;
}

/* ---------- Clock ---------- */
setInterval(()=>{
  const s = new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:true});
  document.querySelectorAll("[data-clock]").forEach(el=>el.textContent = s + " IST");
}, 1000);
