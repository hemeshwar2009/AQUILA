/* =================================================================
   SAHAYAK AGENT — AI survival assistant (offline protocols + optional AI)
   ================================================================= */
/* ---------- AI configuration (key lives only in this browser) ---------- */
let AI = {provider:"gemini", key:""};
try{ AI = {...AI, ...(JSON.parse(localStorage.getItem("aquila_ai")||"{}"))}; }catch(e){}
function aiOn(){ return !!AI.key; }
function aiPillUpdate(){
  const p = document.getElementById("aiPill"); if(!p) return;
  p.textContent = aiOn() ? "AI ONLINE" : "OFFLINE GUIDE";
  p.className = "ai-pill " + (aiOn() ? "on" : "off");
}
function chatSettings(){ document.getElementById("chatSet").classList.toggle("open");
  document.getElementById("aiProv").value = AI.provider; document.getElementById("aiKey").value = AI.key; }
function aiSave(){
  AI = {provider:document.getElementById("aiProv").value, key:document.getElementById("aiKey").value.trim()};
  try{ localStorage.setItem("aquila_ai", JSON.stringify(AI)); }catch(e){}
  document.getElementById("chatSet").classList.remove("open"); aiPillUpdate();
  botSay(aiOn() ? "AI mode is on. Ask me anything — I will answer in your language." : "Key removed. I am back to the built-in survival guide.");
}
function aiClear(){ document.getElementById("aiKey").value=""; aiSave(); }

async function aiChat(history, sys){
  const h = history.slice(-8);
  if(AI.provider==="gemini"){
    let lastErr = null;
    for(const model of ["gemini-3-flash-preview","gemini-3.5-flash-lite","gemini-flash-latest"]){
      try{
        const ac = new AbortController(); const tm = setTimeout(()=>ac.abort(), 20000);
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(AI.key)}`,{
          method:"POST", headers:{"Content-Type":"application/json"}, signal:ac.signal,
          body:JSON.stringify({system_instruction:{parts:[{text:sys}]},
            contents:h.map(m=>({role:m.role==="assistant"?"model":"user", parts:[{text:m.content}]}))})});
        clearTimeout(tm);
        if(r.status===404 || r.status===429 || r.status===503){ lastErr = new Error("Gemini "+r.status+" ("+model+")"); continue; }
        if(!r.ok) throw new Error("Gemini "+r.status);
        const j = await r.json();
        const out = j.candidates?.[0]?.content?.parts?.map(p=>p.text).join("");
        if(out) return out;
        lastErr = new Error("Gemini: empty reply ("+model+")");
      }catch(e){ if(e.name==="AbortError"){ lastErr = new Error("Gemini timeout ("+model+")"); continue; } throw e; }
    }
    throw lastErr || new Error("Gemini: no model available");
  }
  if(AI.provider==="openai"){
    const r = await fetch("https://api.openai.com/v1/chat/completions",{
      method:"POST", headers:{"Content-Type":"application/json","Authorization":"Bearer "+AI.key},
      body:JSON.stringify({model:"gpt-4o-mini", max_tokens:400, messages:[{role:"system",content:sys},...h]})});
    if(!r.ok) throw new Error("OpenAI "+r.status);
    const j = await r.json(); return j.choices?.[0]?.message?.content || "…";
  }
  const r = await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST", headers:{"Content-Type":"application/json","x-api-key":AI.key,
      "anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
    body:JSON.stringify({model:"claude-haiku-4-5", max_tokens:400, system:sys, messages:h})});
  if(!r.ok) throw new Error("Claude "+r.status);
  const j = await r.json(); return j.content?.map(b=>b.text||"").join("") || "…";
}

/* ---------- built-in survival protocols (work with no key, no internet) ---------- */
const PROTO = [
 {k:/trap|stuck|rising|inside|first floor|roof|terrace|மாட்டி|வீட்டில்|தண்ணீர் ஏற|फंस|छत|पानी बढ़/i, t:{
  en:"You are trapped with water rising — do this now:\n1. Move everyone UP — highest floor or roof. Take phone, torch, drinking water.\n2. Switch OFF the electric mains before water reaches plugs.\n3. Do NOT enter water that is moving or above knee height.\n4. Wave a bright cloth from the roof; at night flash your phone torch in bursts of 3.\n5. Save battery: lower screen brightness, close other apps.\n6. If water keeps rising, call 112 and say your report ID.",
  ta:"தண்ணீர் உயர்கிறது — உடனே இதை செய்யுங்கள்:\n1. எல்லோரையும் மேல்தளம் / மொட்டை மாடிக்கு அழைத்துச் செல்லுங்கள். போன், டார்ச், குடிநீர் எடுத்துக்கொள்ளுங்கள்.\n2. மின் மெயின் சுவிட்சை அணைக்கவும்.\n3. முழங்காலுக்கு மேல் அல்லது ஓடும் தண்ணீரில் இறங்க வேண்டாம்.\n4. மாடியில் இருந்து பிரகாசமான துணியை அசைக்கவும்; இரவில் டார்ச்சை 3 முறை ஒளிரச் செய்யவும்.\n5. பேட்டரியை சேமிக்கவும்.\n6. தண்ணீர் தொடர்ந்து உயர்ந்தால் 112 அழைக்கவும்.",
  hi:"पानी बढ़ रहा है — तुरंत यह करें:\n1. सबको ऊपरी मंज़िल/छत पर ले जाएँ। फोन, टॉर्च, पीने का पानी साथ लें.\n2. बिजली का मेन स्विच बंद करें.\n3. घुटने से ऊपर या बहते पानी में न उतरें.\n4. छत से चमकीला कपड़ा हिलाएँ; रात में टॉर्च 3 बार चमकाएँ.\n5. बैटरी बचाएँ.\n6. पानी बढ़ता रहे तो 112 पर कॉल करें."}},
 {k:/drown|swept|current|மூழ்க|அடித்துச் செல்|डूब|बह गया/i, t:{
  en:"Someone in the water:\n1. Do NOT jump in after them — most rescuer deaths happen this way.\n2. REACH with a pole/sari/rope, or THROW anything that floats (empty can, football, plastic drum).\n3. Tell them: float on your back, feet pointing downstream.\n4. Once out: if not breathing, start chest compressions — hard and fast, center of chest, 100–120/min — and call 108.",
  ta:"தண்ணீரில் ஒருவர்:\n1. நீங்கள் குதிக்க வேண்டாம் — மீட்பவர்களே அதிகம் உயிரிழக்கிறார்கள்.\n2. கம்பு/சேலை/கயிறு நீட்டுங்கள், அல்லது மிதக்கும் பொருளை எறியுங்கள்.\n3. “மல்லாந்து மிதக்கவும், கால்கள் நீரோட்ட திசையில்” என்று சொல்லுங்கள்.\n4. வெளியே வந்ததும் மூச்சு இல்லை என்றால் மார்பு அழுத்தம் (நிமிடத்திற்கு 100–120) செய்து 108 அழைக்கவும்.",
  hi:"कोई पानी में है:\n1. खुद न कूदें — ज़्यादातर मौतें बचाने वालों की होती हैं.\n2. डंडा/साड़ी/रस्सी बढ़ाएँ या कोई तैरने वाली चीज़ फेंकें.\n3. कहें: पीठ के बल तैरो, पैर धारा की दिशा में.\n4. बाहर आने पर साँस न हो तो छाती दबाएँ (100–120/मिनट) और 108 बुलाएँ."}},
 {k:/electri|shock|wire|current leak|மின்சார|கம்பி|बिजली|तार|करंट/i, t:{
  en:"Electrical danger in flood water:\n1. Stay at least 10 steps away from fallen wires or sparking poles — flood water carries current.\n2. NEVER touch a person who is being shocked. First switch off the mains or push them away with DRY wood/plastic.\n3. If anyone feels tingling in the water, everyone must leave that water immediately, moving away in the opposite direction.\n4. Report it — fallen wires kill rescuers too. Call 112 and 1913.",
  ta:"மின்சார ஆபத்து:\n1. விழுந்த கம்பிகளில் இருந்து குறைந்தது 10 அடி தள்ளி இருங்கள் — வெள்ள நீரில் மின்சாரம் பரவும்.\n2. ஷாக் அடிபடும் நபரை நேரடியாக தொட வேண்டாம். மெயின் சுவிட்சை அணைக்கவும் அல்லது உலர்ந்த மரம்/பிளாஸ்டிக்கால் தள்ளவும்.\n3. தண்ணீரில் மின்னல் உணர்வு தெரிந்தால் உடனே எதிர் திசையில் வெளியேறுங்கள்.\n4. 112 மற்றும் 1913-ஐ அழைக்கவும்.",
  hi:"बिजली का खतरा:\n1. गिरे तारों से कम से कम 10 कदम दूर रहें — बाढ़ के पानी में करंट फैलता है.\n2. करंट लगे व्यक्ति को सीधे न छुएँ। पहले मेन बंद करें या सूखी लकड़ी/प्लास्टिक से हटाएँ.\n3. पानी में झनझनाहट लगे तो तुरंत उल्टी दिशा में निकलें.\n4. 112 और 1913 पर सूचना दें."}},
 {k:/bleed|injur|hurt|wound|broken|fracture|unconscious|faint|காயம்|ரத்தம்|மயக்கம்|खून|घायल|बेहोश|चोट/i, t:{
  en:"Injury first aid:\n1. Bleeding: press directly on the wound with the cleanest cloth you have, keep pressing 10 minutes without peeking. Raise the limb.\n2. Unconscious but breathing: lay them on their SIDE, chin up, so the airway stays clear.\n3. Not breathing: chest compressions, center of chest, 100–120 per minute, don't stop until help arrives.\n4. Suspected broken bone: don't move the limb; tie it to a stick/rolled newspaper.\n5. Call 108 for an ambulance. Tell me what you see and I can guide you further.",
  ta:"காயத்திற்கு முதலுதவி:\n1. ரத்தம்: சுத்தமான துணியால் காயத்தின் மேல் 10 நிமிடம் விடாமல் அழுத்தவும். கை/காலை உயர்த்தவும்.\n2. மயக்கம் ஆனால் மூச்சு உள்ளது: பக்கவாட்டில் படுக்கவைத்து தாடையை உயர்த்தவும்.\n3. மூச்சு இல்லை: மார்பின் நடுவில் நிமிடத்திற்கு 100–120 முறை அழுத்தவும்.\n4. எலும்பு முறிவு: அசைக்காமல் குச்சியுடன் கட்டவும்.\n5. 108 அழைக்கவும்.",
  hi:"चोट की प्राथमिक चिकित्सा:\n1. खून बहे: साफ कपड़े से घाव पर 10 मिनट लगातार दबाव डालें। अंग ऊपर उठाएँ.\n2. बेहोश पर साँस चल रही है: करवट पर लिटाएँ, ठुड्डी ऊपर.\n3. साँस नहीं: छाती के बीच 100–120/मिनट दबाएँ.\n4. हड्डी टूटी लगे: हिलाएँ नहीं, लकड़ी से बाँधें.\n5. 108 पर एम्बुलेंस बुलाएँ."}},
 {k:/pregnan|labou?r|baby|delivery|கர்ப்பிணி|பிரசவ|गर्भवती|प्रसव/i, t:{
  en:"Pregnant woman in labour:\n1. Call 108 NOW and say \"labour, flood area\" — they prioritise this.\n2. Move her to the driest, warmest spot. Clean cloth under her, water to drink.\n3. Time the contractions. If less than 3 minutes apart, birth may be close.\n4. If the baby comes before help: do NOT pull. Dry the baby firmly with cloth, place skin-to-skin on mother's chest, cover both, do NOT cut the cord.\n5. Keep me open — I will talk you through each step.",
  ta:"பிரசவ வலி:\n1. உடனே 108 அழைத்து “பிரசவம், வெள்ள பகுதி” என்று சொல்லுங்கள்.\n2. உலர்ந்த சூடான இடத்திற்கு மாற்றுங்கள். சுத்தமான துணி விரிக்கவும்.\n3. வலியின் இடைவெளியை கணக்கிடுங்கள் — 3 நிமிடத்திற்கும் குறைவு என்றால் பிரசவம் நெருக்கம்.\n4. குழந்தை வந்துவிட்டால்: இழுக்க வேண்டாம். துணியால் நன்றாக துடைத்து தாயின் மார்போடு சேர்த்து போர்த்தவும். தொப்புள் கொடியை வெட்ட வேண்டாம்.\n5. நான் ஒவ்வொரு படியிலும் உதவுகிறேன்.",
  hi:"प्रसव पीड़ा:\n1. तुरंत 108 पर कॉल करें — \"प्रसव, बाढ़ क्षेत्र\" बताएँ.\n2. सूखी गर्म जगह ले जाएँ, साफ कपड़ा बिछाएँ.\n3. दर्द का अंतराल नापें — 3 मिनट से कम तो प्रसव नज़दीक है.\n4. बच्चा आ जाए: खींचे नहीं। कपड़े से पोंछकर माँ की छाती से लगाएँ, दोनों को ढकें, नाल न काटें.\n5. मैं हर कदम पर साथ हूँ."}},
 {k:/snake|bite|பாம்பு|கடி|साँप|सांप|काटा/i, t:{
  en:"Snake bite (common in flood water):\n1. Keep the person STILL and calm — movement spreads venom. Carry them, don't let them walk.\n2. Remove rings/watches near the bite before swelling starts.\n3. Keep the bitten limb below heart level, loosely splinted.\n4. Do NOT cut, suck, tie tightly, or apply ice/herbs.\n5. Go to a hospital — all Chennai government hospitals stock anti-venom. Call 108.",
  ta:"பாம்பு கடி:\n1. நபரை அசையாமல் அமைதியாக வைத்திருங்கள் — நடக்கவிடாமல் தூக்கிச் செல்லுங்கள்.\n2. வீக்கம் வருமுன் மோதிரம்/கடிகாரம் கழற்றவும்.\n3. கடிபட்ட பகுதியை இதயத்தை விட தாழ்வாக வைக்கவும்.\n4. வெட்டுதல், உறிஞ்சுதல், இறுக்கி கட்டுதல், பச்சிலை வேண்டாம்.\n5. அரசு மருத்துவமனைக்கு செல்லுங்கள் — 108 அழைக்கவும்.",
  hi:"साँप का काटना:\n1. व्यक्ति को स्थिर और शांत रखें — चलने न दें, उठाकर ले जाएँ.\n2. सूजन से पहले अंगूठी/घड़ी उतारें.\n3. काटा अंग दिल से नीचे रखें.\n4. काटें नहीं, चूसें नहीं, कसकर न बाँधें, बर्फ/जड़ी-बूटी नहीं.\n5. सरकारी अस्पताल जाएँ — 108 बुलाएँ."}},
 {k:/water.*(drink|safe)|drink.*water|food|hungry|குடிநீர்|சாப்பாடு|பசி|पीने|खाना|भूख/i, t:{
  en:"Safe water and food during floods:\n1. Drink only boiled (1 full minute) or bottled water. If you can't boil: 4 drops of household bleach per litre, wait 30 minutes.\n2. Rainwater caught in a clean cloth/vessel is safer than flood water.\n3. Throw away any food touched by flood water — even packaged food with damaged wrapping.\n4. Eat from sealed packets; feed children and elders first, small portions.\n5. Relief supplies can be requested with a report — type 'Food / Relief supplies'.",
  ta:"பாதுகாப்பான நீர் & உணவு:\n1. கொதிக்க வைத்த (1 நிமிடம்) அல்லது பாட்டில் நீர் மட்டும் குடிக்கவும். கொதிக்க முடியாவிட்டால்: 1 லிட்டருக்கு 4 சொட்டு ப்ளீச், 30 நிமிடம் காத்திருக்கவும்.\n2. சுத்தமான துணியில் பிடித்த மழைநீர் வெள்ள நீரை விட பாதுகாப்பானது.\n3. வெள்ள நீர் பட்ட உணவை தூக்கி எறியுங்கள்.\n4. மூடிய பாக்கெட்டுகளில் இருந்து சாப்பிடுங்கள்; குழந்தைகள், முதியவர்களுக்கு முதலில்.\n5. நிவாரணப் பொருட்களுக்கு ‘Relief supplies’ என புகார் அளிக்கலாம்.",
  hi:"सुरक्षित पानी और भोजन:\n1. सिर्फ उबला (1 मिनट) या बोतलबंद पानी पिएँ। उबाल न सकें तो: 1 लीटर में 4 बूँद ब्लीच, 30 मिनट रुकें.\n2. साफ कपड़े में पकड़ा बारिश का पानी बाढ़ के पानी से सुरक्षित है.\n3. बाढ़ के पानी से छुआ खाना फेंक दें.\n4. बंद पैकेट से खाएँ; बच्चों-बुज़ुर्गों को पहले.\n5. राहत सामग्री के लिए 'Relief supplies' रिपोर्ट करें."}},
 {k:/car|vehicle|bike|scooter|கார்|வண்டி|கார|गाड़ी|कार|बाइक/i, t:{
  en:"Vehicle in flood water:\n1. If water is above half the tyre — ABANDON the vehicle and walk to high ground. Cars float and flip in 60 cm of water.\n2. If the engine stalls in water, do NOT restart it.\n3. Trapped inside with water outside: open windows FIRST (power windows fail), climb out onto the roof.\n4. Never drive around barricades — the road under the water may be washed away.",
  ta:"வெள்ளத்தில் வாகனம்:\n1. டயரின் பாதிக்கு மேல் தண்ணீர் இருந்தால் — வாகனத்தை விட்டு உயரமான இடத்திற்கு நடந்து செல்லுங்கள். 60 செ.மீ தண்ணீரில் கார் மிதக்கும்.\n2. இன்ஜின் நின்றுவிட்டால் மீண்டும் ஸ்டார்ட் செய்ய வேண்டாம்.\n3. உள்ளே மாட்டிக்கொண்டால்: முதலில் ஜன்னல்களைத் திறங்கள், கூரை மீது ஏறுங்கள்.\n4. தடுப்புகளை சுற்றி ஓட்ட வேண்டாம் — சாலை அடியில் அரிக்கப்பட்டிருக்கலாம்.",
  hi:"बाढ़ में वाहन:\n1. टायर के आधे से ऊपर पानी — गाड़ी छोड़कर ऊँची जगह पैदल जाएँ। 60 सेमी पानी में कार तैरने लगती है.\n2. इंजन बंद हो जाए तो दोबारा स्टार्ट न करें.\n3. अंदर फँसे हों: पहले खिड़कियाँ खोलें, छत पर चढ़ें.\n4. बैरिकेड के आसपास से न निकलें — नीचे सड़क बह चुकी हो सकती है."}},
 {k:/evacuat|leave|shelter|relief camp|வெளியேற|முகாம்|निकल|शिविर|कैंप/i, t:{
  en:"Evacuating safely:\n1. Use the Safe Route finder on the Live City Map — it avoids the highest-risk zones.\n2. Carry: documents in a plastic bag, medicines, phone + charger + power bank, torch, water, whistle.\n3. Turn off gas cylinder valve and electric mains before leaving. Lock up.\n4. Walk where the water is stillest; use a stick to test depth ahead of every step.\n5. Keep children on your upstream side and hold hands in a chain.",
  ta:"பாதுகாப்பாக வெளியேறுதல்:\n1. Live City Map-இல் உள்ள Safe Route வழிகாட்டியை பயன்படுத்துங்கள்.\n2. எடுத்துச் செல்ல: ஆவணங்கள் (பிளாஸ்டிக் பையில்), மருந்துகள், போன் + சார்ஜர், டார்ச், தண்ணீர், விசில்.\n3. கிளம்புமுன் கேஸ் வால்வு, மின் மெயின் அணைக்கவும்.\n4. அமைதியான தண்ணீரில் நடக்கவும்; ஒவ்வொரு அடிக்கும் முன் குச்சியால் ஆழம் பார்க்கவும்.\n5. குழந்தைகளின் கையை பிடித்து சங்கிலியாக நடக்கவும்.",
  hi:"सुरक्षित निकासी:\n1. Live City Map पर Safe Route खोजें — यह सबसे खतरनाक क्षेत्रों से बचाता है.\n2. साथ लें: दस्तावेज़ (प्लास्टिक बैग में), दवाइयाँ, फोन+चार्जर, टॉर्च, पानी, सीटी.\n3. निकलने से पहले गैस वाल्व और बिजली मेन बंद करें.\n4. शांत पानी में चलें; हर कदम से पहले डंडे से गहराई जाँचें.\n5. बच्चों का हाथ पकड़कर कतार में चलें."}},
 /* ---------- heatwave protocols ---------- */
 {k:/heat ?stroke|collapsed|fainted|unconscious|sun ?stroke|வெப்பத்தில்|மயங்கி|மயக்கம்|लू लग|बेहोश|गर्मी से गिर/i, t:{
  en:"Possible HEAT STROKE — act in the next 10 minutes:\n1. Move them to shade or the coolest room NOW. Call 108.\n2. Remove extra clothing. Lay them down, legs slightly raised.\n3. Cool aggressively: wet their whole body with water, fan hard; put wet cloths on neck, armpits and groin.\n4. If they are awake and can swallow, give small sips of water or ORS. NOTHING by mouth if unconscious.\n5. If they faint, vomit or stop sweating with hot dry skin — that is life-threatening, say 'heat stroke' to the 108 operator.",
  ta:"வெப்பத் தாக்கம் (HEAT STROKE) — அடுத்த 10 நிமிடங்களில்:\n1. உடனே நிழலுக்கு / குளிர்ந்த அறைக்கு மாற்றுங்கள். 108 அழைக்கவும்.\n2. கூடுதல் ஆடைகளை அகற்றி, கால்களை சற்று உயர்த்தி படுக்கவைக்கவும்.\n3. உடல் முழுவதும் தண்ணீர் தெளித்து விசிறி வீசுங்கள்; கழுத்து, அக்குள், இடுப்பில் ஈரத் துணி வைக்கவும்.\n4. சுயநினைவு இருந்தால் சிறு மிடறு தண்ணீர் / ORS கொடுங்கள். மயக்கத்தில் வாய்வழி எதுவும் கொடுக்க வேண்டாம்.\n5. வியர்வை நின்று தோல் சூடாக உலர்ந்தால் — உயிர் ஆபத்து; 108-இல் 'heat stroke' என்று சொல்லுங்கள்.",
  hi:"संभावित हीट स्ट्रोक — अगले 10 मिनट में:\n1. तुरंत छाया/सबसे ठंडे कमरे में ले जाएँ। 108 बुलाएँ.\n2. अतिरिक्त कपड़े हटाएँ, लिटाएँ, पैर थोड़े ऊँचे.\n3. पूरे शरीर पर पानी डालें, तेज़ पंखा करें; गर्दन, बगल और जाँघ पर गीला कपड़ा रखें.\n4. होश में हों तो छोटे घूँट पानी/ORS दें। बेहोश को मुँह से कुछ न दें.\n5. पसीना बंद, त्वचा गर्म-सूखी — जानलेवा है; 108 पर 'heat stroke' कहें."}},
 {k:/dehydrat|exhaust|dizzy|cramp|thirst|heat ?wave|very hot|தாகம்|சோர்வு|தலைசுற்று|வெப்ப அலை|प्यास|थकान|चक्कर|गर्मी|लू से/i, t:{
  en:"Heat exhaustion / dehydration:\n1. Stop all activity; rest in shade or a cool room.\n2. Drink ORS if you have it (1 sachet in 1 L clean water), else water with a pinch of salt + sugar. Small sips, continuously.\n3. Loosen clothes; wet cloth on head and neck.\n4. Avoid going out 12–4 pm; if you must, cover your head and carry water.\n5. Watch the elderly, infants and outdoor workers hourly. If confusion, fainting or no urine for 8 hours — call 108.",
  ta:"வெப்பச் சோர்வு / நீர்ச்சத்து இழப்பு:\n1. எல்லா வேலையையும் நிறுத்தி நிழலில் ஓய்வெடுங்கள்.\n2. ORS இருந்தால் குடியுங்கள் (1 பாக்கெட் + 1 லிட்டர் சுத்த தண்ணீர்); இல்லையெனில் உப்பு + சர்க்கரை கலந்த தண்ணீர். சிறு மிடறுகளாக தொடர்ந்து.\n3. ஆடைகளை தளர்த்தி, தலை-கழுத்தில் ஈரத் துணி வைக்கவும்.\n4. மதியம் 12–4 வெளியே செல்ல வேண்டாம்; சென்றால் தலையை மூடி தண்ணீர் எடுத்துச் செல்லுங்கள்.\n5. முதியவர்கள், குழந்தைகளை மணிக்கொருமுறை கவனிக்கவும். மயக்கம் / 8 மணி நேரம் சிறுநீர் இல்லை என்றால் 108.",
  hi:"गर्मी से थकान / पानी की कमी:\n1. सारा काम रोककर छाया/ठंडे कमरे में आराम करें.\n2. ORS पिएँ (1 पाउच + 1 लीटर साफ पानी), न हो तो नमक-चीनी का घोल। छोटे घूँट, लगातार.\n3. कपड़े ढीले करें; सिर-गर्दन पर गीला कपड़ा.\n4. दोपहर 12–4 बाहर न निकलें; निकलना पड़े तो सिर ढकें, पानी साथ रखें.\n5. बुज़ुर्गों-बच्चों को हर घंटे देखें। बेहोशी या 8 घंटे पेशाब न आए तो 108."}},
 {k:/no (drinking )?water|water (shortage|scarcity|finished|over)|tanker|தண்ணீர் இல்லை|குடிநீர்|பற்றாக்குறை|पानी नहीं|पानी खत्म|टैंकर/i, t:{
  en:"Drinking water shortage:\n1. Report it here with your zone — the command center routes water tankers by need.\n2. Ration what you have: drinking first, cooking second; postpone washing.\n3. Never drink untreated well/tank water during a crisis: boil 1 minute, or use chlorine tablets, or filter + 30 min in direct sun in a clear bottle.\n4. One earthen pot in shade keeps water cool without power.\n5. Share location of sealed-can shops with neighbours; queue in shade, send one person per family.",
  ta:"குடிநீர் பற்றாக்குறை:\n1. உங்கள் பகுதியுடன் இங்கே புகார் செய்யுங்கள் — தேவை அடிப்படையில் தண்ணீர் லாரிகள் அனுப்பப்படும்.\n2. இருப்பதை சிக்கனமாக: முதலில் குடிக்க, பிறகு சமைக்க; துவைப்பதை தள்ளிப்போடுங்கள்.\n3. சுத்திகரிக்காத கிணறு/தொட்டி தண்ணீரை குடிக்க வேண்டாம்: 1 நிமிடம் கொதிக்கவைக்கவும் அல்லது குளோரின் மாத்திரை பயன்படுத்தவும்.\n4. நிழலில் மண் பானை வைத்தால் மின்சாரம் இல்லாமல் தண்ணீர் குளிர்ச்சியாக இருக்கும்.\n5. கடை இருப்பிடங்களை அக்கம்பக்கத்தாருடன் பகிருங்கள்; நிழலில் வரிசையில் நிற்கவும்.",
  hi:"पीने के पानी की कमी:\n1. अपने क्षेत्र के साथ यहाँ रिपोर्ट करें — ज़रूरत के हिसाब से टैंकर भेजे जाते हैं.\n2. जो है उसे बाँटें: पहले पीना, फिर खाना बनाना; धुलाई टालें.\n3. बिना उपचार कुएँ/टंकी का पानी न पिएँ: 1 मिनट उबालें या क्लोरीन गोली डालें.\n4. छाया में मिट्टी का घड़ा बिना बिजली पानी ठंडा रखता है.\n5. दुकानों की जानकारी पड़ोसियों से साझा करें; छाया में कतार लगाएँ."}},
];
const PROTO_DEFAULT = {
 en:"I am here with you. Tell me what is happening — for example:\n• \"water is rising in my house\"\n• \"someone fell in the water\"\n• \"wire fell in the water\"\n• \"someone is injured / pregnant / bitten\"\n\nMeanwhile: stay out of moving water, switch off the mains if water is entering, and keep your phone charged. If life is in danger call 112 now.",
 ta:"நான் உங்களுடன் இருக்கிறேன். என்ன நடக்கிறது என்று சொல்லுங்கள் — உதாரணமாக:\n• \"வீட்டில் தண்ணீர் ஏறுகிறது\"\n• \"ஒருவர் தண்ணீரில் விழுந்துவிட்டார்\"\n• \"கம்பி தண்ணீரில் விழுந்தது\"\n• \"காயம் / கர்ப்பிணி / பாம்பு கடி\"\n\nஅதுவரை: ஓடும் தண்ணீரில் இறங்க வேண்டாம், மின் மெயின் அணைக்கவும், போனை சார்ஜில் வைத்திருங்கள். உயிருக்கு ஆபத்து என்றால் 112.",
 hi:"मैं आपके साथ हूँ। बताइए क्या हो रहा है — जैसे:\n• \"घर में पानी बढ़ रहा है\"\n• \"कोई पानी में गिर गया\"\n• \"तार पानी में गिरा है\"\n• \"कोई घायल / गर्भवती / साँप ने काटा\"\n\nतब तक: बहते पानी में न उतरें, पानी घुसे तो मेन बंद करें, फोन चार्ज रखें। जान खतरे में हो तो 112."};
function protoLang(){ const l = voiceLang().slice(0,2); return l==="ta"?"ta" : l==="hi"?"hi" : "en"; }
function protoReply(text){
  const hit = PROTO.find(p=>p.k.test(text));
  const L = protoLang();
  return hit ? (hit.t[L] || hit.t.en) : (PROTO_DEFAULT[L] || PROTO_DEFAULT.en);
}

/* ---------- chatbot UI ---------- */
let chatHist = [], ttsOn = false, chatBooted = false;
function chatToggle(){ const p = document.getElementById("chatPanel"); p.classList.toggle("open"); if(p.classList.contains("open")) chatBoot(); else speechSynthesis.cancel(); }
function chatOpen(){ document.getElementById("chatPanel").classList.add("open"); chatBoot(); }
function chatBoot(){
  aiPillUpdate();
  if(chatBooted) return; chatBooted = true;
  const chips = [["🌊 Water is rising","water is rising in my house"],["🆘 Someone fell in water","someone fell in the water and is drowning"],
    ["⚡ Wire in the water","an electric wire fell into the water"],["🩸 Someone is injured","someone is injured and bleeding"],
    ["🤰 Labour pain","a pregnant woman is in labour"],["🚗 Car stuck in water","my car is stuck in flood water"],
    ["🥵 Heat stroke","someone collapsed in the heat and is not responding"],["☀️ Heatwave safety","it is very hot, how do we stay safe in this heatwave"]];
  document.getElementById("chatChips").innerHTML = chips.map(([l,q])=>`<button class="chat-chip" onclick="chatAsk(${JSON.stringify(q).replace(/"/g,"&quot;")})">${l}</button>`).join("");
  const mine = complaints.filter(c=>c.source==="citizen" && (!c.owner || c.owner===currentUser) && c.status!=="Resolved");
  const active = mine.find(c=>c.agent && (c.status==="Dispatched"||c.status==="Accepted"));
  let hello = "Vanakkam 🙏 I am Aquila Sahayak. I help you stay safe until the rescue team reaches you.";
  if(active){ const tk = vehicleTrack(active, Date.now());
    if(tk && !tk.arrived) hello += `\n\nYour rescue vehicle ${active.agent} is on the way — about ${r1(tk.kmLeft)} km from you (${fmtEta(tk.msLeft)}). Stay where rescuers can see you.`; }
  hello += "\n\nAsk me anything, tap a button below, or press 🎙 and speak in your language.";
  botSay(hello);
}
function chatAsk(q){ document.getElementById("chatIn").value = q; chatSend(); }
function addMsg(cls, text){
  const m = document.getElementById("chatMsgs");
  const d = document.createElement("div"); d.className = "cm "+cls; d.textContent = text;
  m.appendChild(d); m.scrollTop = m.scrollHeight; return d;
}
function botSay(text){ text = String(text).replace(/\*\*(.+?)\*\*/g,"$1").replace(/^#+\s*/gm,""); addMsg("bot", text); chatHist.push({role:"assistant", content:text}); if(ttsOn) speak(text); }
async function chatSend(){
  const inp = document.getElementById("chatIn"); const q = inp.value.trim(); if(!q) return;
  voiceStop(); inp.value = "";
  addMsg("user", q); chatHist.push({role:"user", content:q});
  if(!aiOn()){ botSay(protoReply(q)); return; }
  const t = addMsg("bot typing", "thinking…");
  try{
    const mine = complaints.filter(c=>c.source==="citizen" && (!c.owner||c.owner===currentUser) && c.status!=="Resolved");
    const active = mine.find(c=>c.agent && c.status!=="Pending");
    let ctx = "";
    if(active){ const tk = vehicleTrack(active, Date.now());
      ctx = ` The user has an active report ${active.id} (${TYPE_META[active.type]?.label} in ${Z[active.zone]?.name}); rescue vehicle ${active.agent} is ${tk&&!tk.arrived? "about "+r1(tk.kmLeft)+" km away, ETA "+fmtEta(tk.msLeft) : "at their location"}.`; }
    const sys = "You are Aquila Sahayak, an all-hazard (flood and heatwave) emergency survival assistant for citizens in Chennai, India, used while they wait for rescue. Always answer in the same language the user wrote or spoke in. Give short, numbered, immediately actionable survival steps (max ~120 words), the most life-critical action first. Never give false reassurance; if the situation sounds life-threatening, tell them to call 112 (or 108 for ambulance). You are not a doctor; keep first aid to standard guidance. Plain text only — no markdown, no asterisks." + ctx;
    const a = await aiChat(chatHist, sys);
    t.remove(); botSay(a);
  }catch(e){
    t.remove();
    botSay("(AI is unreachable — using the built-in guide.)\n\n" + protoReply(q));
  }
}
function ttsToggle(){ ttsOn = !ttsOn; document.getElementById("ttsBtn").classList.toggle("on", ttsOn);
  if(!ttsOn) speechSynthesis.cancel(); else speak(protoLang()==="ta" ? "குரல் இயக்கப்பட்டது" : protoLang()==="hi" ? "आवाज़ चालू" : "Voice on"); }
function speak(text){
  try{
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[•✔⚠🔔🙏🌊🆘⚡🩸🤰🚗]/g,"").slice(0,1200));
    u.lang = voiceLang(); u.rate = 0.95;
    const vs = speechSynthesis.getVoices();
    u.voice = vs.find(v=>v.lang===u.lang) || vs.find(v=>v.lang.startsWith(u.lang.slice(0,2))) || null;
    speechSynthesis.speak(u);
  }catch(e){}
}
