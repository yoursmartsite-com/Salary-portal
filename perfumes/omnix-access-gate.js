import {auth,onAuthStateChanged} from "./firebase.js";

const API="https://omnix-api.fibrahem865.workers.dev";
const PORTAL="../portal/";

async function verifyOmnixAccess(user){
  const token=await user.getIdToken(true);
  const response=await fetch(API+"/api/access?programId=zein-rahaf-store",{
    method:"GET",
    headers:{Authorization:"Bearer "+token},
    cache:"no-store"
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.error||"تعذر الاتصال بنظام OMNIX.");
  return data;
}

let accessCheckBusy=false,accessLocked=false;
async function enforceStoreAccess(user){
  if(accessCheckBusy||accessLocked||!user)return;
  accessCheckBusy=true;
  try{
    const access=await verifyOmnixAccess(user);
    if(!access.allowed){
      accessLocked=true;
      document.body.style.visibility="hidden";
      location.replace(PORTAL+"?reason="+encodeURIComponent(access.reason||"program_disabled"));
      return;
    }
    document.body.style.visibility="visible";
  }catch(error){
    console.error("OMNIX access verification failed:",error);
    if(document.body.style.visibility==="hidden"){
      const message=document.createElement("div");
      message.dir="rtl";
      message.style.cssText="position:fixed;inset:0;z-index:99999;display:grid;place-content:center;text-align:center;padding:24px;background:#171614;color:#e6c875;font:16px Arial;line-height:2";
      message.textContent="تعذر التحقق من صلاحية الدخول عبر OMNIX. تأكد من الاتصال وحاول مرة أخرى.";
      if(!document.getElementById("omnixAccessError")){message.id="omnixAccessError";document.body.appendChild(message);}
    }
  }finally{accessCheckBusy=false;}
}
onAuthStateChanged(auth,async user=>{
  document.body.style.visibility="hidden";
  if(!user){location.replace("./login-preview.html");return;}
  await enforceStoreAccess(user);
},error=>{
  console.error("Firebase session check failed:",error);
  location.replace("./login-preview.html");
});
// Recheck active sessions so disabling the program also locks pages already open.
setInterval(()=>{if(auth.currentUser)enforceStoreAccess(auth.currentUser);},10000);
window.addEventListener("focus",()=>{if(auth.currentUser)enforceStoreAccess(auth.currentUser);});
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&auth.currentUser)enforceStoreAccess(auth.currentUser);});
