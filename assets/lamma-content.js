// Dynamic admin-controlled visibility and placement for homepage game cards.
import { firebaseConfig } from "./firebase-config.js";
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";
const app=getApps().length?getApps()[0]:initializeApp(firebaseConfig),db=getDatabase(app);
const slug=v=>encodeURIComponent(String(v||"").trim().toLowerCase()).replace(/\\./g,"%2E");
onValue(ref(db,"siteContent/games"),snap=>{
 const settings=snap.val()||{},targets={single:document.querySelector("#single .games"),online:document.querySelector("#online .games"),cards:document.querySelector("#cards .games")};
 document.querySelectorAll("a.game-link").forEach(card=>{
  const id=slug(card.dataset.name||card.querySelector(".game-info b")?.textContent||"");
  const cfg=settings[id];if(!cfg)return;
  card.hidden=!!cfg.hidden;
  const target=targets[cfg.category];if(target&&card.parentElement!==target)target.appendChild(card);
 });
});
