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

onAuthStateChanged(auth,async user=>{
  document.body.style.visibility="hidden";
  if(!user){
    location.replace("./login-preview.html");
    return;
  }
  try{
    const access=await verifyOmnixAccess(user);
    if(!access.allowed){
      location.replace(PORTAL);
      return;
    }
    document.body.style.visibility="visible";
  }catch(error){
    console.error("OMNIX access verification failed:",error);
    const message=document.createElement("div");
    message.dir="rtl";
    message.style.cssText="position:fixed;inset:0;z-index:99999;display:grid;place-content:center;text-align:center;padding:24px;background:#171614;color:#e6c875;font:16px Arial;line-height:2";
    message.textContent="تعذر التحقق من صلاحية الدخول عبر OMNIX. تأكد من الاتصال وحاول مرة أخرى.";
    document.body.appendChild(message);
  }
},error=>{
  console.error("Firebase session check failed:",error);
  location.replace("./login-preview.html");
});
