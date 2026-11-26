import {auth,onAuthStateChanged} from "./firebase.js";
import {firebaseConfig} from "./firebase.js";
const API="https://omnix-api.fibrahem865.workers.dev";
let nativeListenersReady=false;
async function saveToken(token,platform){
  const user=auth.currentUser;if(!user)throw new Error("سجّل الدخول أولًا");
  const idToken=await user.getIdToken(true);
  const response=await fetch(API+"/api/push/register",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+idToken},body:JSON.stringify({token,platform})});
  const result=await response.json().catch(()=>({}));
  if(!response.ok||!result.ok)throw new Error(result.error||"تعذر تسجيل جهاز الإشعارات");
  return result;
}
export async function registerStorePush(){
  if(!auth.currentUser)throw new Error("سجّل الدخول أولًا لتفعيل الإشعارات");
  const cap=window.Capacitor,plugins=cap?.Plugins||{};
  const native=!!(cap?.isNativePlatform?.()||cap?.getPlatform?.()==="android");
  if(native&&plugins.PushNotifications){
    const push=plugins.PushNotifications;
    let permission=await push.checkPermissions();
    if(permission.receive!=="granted")permission=await push.requestPermissions();
    if(permission.receive!=="granted")throw new Error("لم تسمح بتفعيل إشعارات التطبيق");
    if(!nativeListenersReady){
      nativeListenersReady=true;
      await push.addListener("registration",async token=>{try{await saveToken(token.value,"android");window.dispatchEvent(new CustomEvent("zr:push-ready"));}catch(e){console.error("Push token registration:",e);}});
      await push.addListener("registrationError",e=>console.error("Android push registration error:",e));
      await push.addListener("pushNotificationActionPerformed",()=>{location.href="https://yoursmartsite-com.github.io/Salary-portal/perfumes/orders.html";});
    }
    await push.register();
    return {ok:true,platform:"android",message:"تم طلب تسجيل إشعارات التطبيق"};
  }
  if(!("Notification"in window)||!("serviceWorker"in navigator))throw new Error("هذا المتصفح لا يدعم إشعارات الويب");
  const permission=await Notification.requestPermission();
  if(permission!=="granted")throw new Error("لم تسمح بإظهار الإشعارات");
  const [{initializeApp,getApps},{getMessaging,getToken}]=await Promise.all([
    import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging.js")
  ]);
  const app=getApps().length?getApps()[0]:initializeApp(firebaseConfig);
  const messaging=getMessaging(app);
  const sw=await navigator.serviceWorker.register("./firebase-messaging-sw.js");
  const token=await getToken(messaging,{vapidKey:"BKC339ovRSMI_suUPwF6zWQbTLVzWHaYOrybTHF5H_COcI-DwLofwDHTVE5sT1ok2BijB0labNIZ3Wiqv52Fk2I",serviceWorkerRegistration:sw});
  if(!token)throw new Error("لم يتم إنشاء رمز إشعارات لهذا الجهاز");
  await saveToken(token,"web");
  return {ok:true,platform:"web",message:"تم تفعيل إشعارات هذا الجهاز"};
}
onAuthStateChanged(auth,async user=>{
  if(!user||!("Notification"in window)||Notification.permission!=="granted")return;
  try{await registerStorePush();}catch(e){console.warn("Automatic push registration:",e);}
});
