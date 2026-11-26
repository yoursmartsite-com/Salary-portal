const corsHeaders = (origin) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Vary": "Origin"
});

let cachedToken = null;
let cachedTokenExpiry = 0;

function b64url(input) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function pemToBytes(pem) {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const raw = atob(body);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
async function googleAccessToken(env) {
  if (cachedToken && Date.now() < cachedTokenExpiry - 60000) return cachedToken;
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({alg:"RS256",typ:"JWT"}));
  const claim = b64url(JSON.stringify({
    iss:sa.client_email,
    scope:"https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email",
    aud:"https://oauth2.googleapis.com/token",
    iat:now,exp:now+3600
  }));
  const unsigned = head + "." + claim;
  const key = await crypto.subtle.importKey("pkcs8",pemToBytes(sa.private_key),{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,new TextEncoder().encode(unsigned));
  const assertion = unsigned + "." + b64url(new Uint8Array(sig));
  const response = await fetch("https://oauth2.googleapis.com/token",{
    method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion})
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || data.error || "تعذر الحصول على صلاحية Firebase الإدارية");
  cachedToken=data.access_token;cachedTokenExpiry=Date.now()+Number(data.expires_in||3600)*1000;
  return cachedToken;
}
async function verifySignedInUser(request,env) {
  const header=request.headers.get("Authorization")||"";
  const idToken=header.startsWith("Bearer ")?header.slice(7):"";
  if(!idToken) throw new Error("يلزم تسجيل الدخول");
  const response=await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key="+encodeURIComponent(env.FIREBASE_API_KEY),{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({idToken})
  });
  const data=await response.json(),user=data.users?.[0];
  if(!response.ok||!user||user.disabled) throw new Error("جلسة المستخدم غير صالحة أو الحساب موقوف");
  return user;
}
async function verifyOwner(request,env) {
  const header=request.headers.get("Authorization")||"";
  const idToken=header.startsWith("Bearer ")?header.slice(7):"";
  if(!idToken) throw new Error("يلزم تسجيل دخول المالك");
  const response=await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key="+encodeURIComponent(env.FIREBASE_API_KEY),{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({idToken})
  });
  const data=await response.json();
  const user=data.users?.[0];
  if(!response.ok||!user||user.localId!==env.OWNER_UID||(user.email||"").toLowerCase()!==(env.OWNER_EMAIL||"").toLowerCase()||user.disabled)
    throw new Error("غير مصرح: حساب المالك فقط");
  return user;
}
async function adminFetch(env,path,method="GET",body) {
  const token=await googleAccessToken(env);
  const response=await fetch("https://identitytoolkit.googleapis.com/v1/projects/"+env.FIREBASE_PROJECT_ID+path,{
    method,headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},
    body:body===undefined?undefined:JSON.stringify(body)
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.error?.message||"فشلت عملية Firebase Authentication");
  return data;
}
async function db(env,path,method="GET",body) {
  const token=await googleAccessToken(env);
  const base=env.FIREBASE_DATABASE_URL.replace(/\/$/,"");
  const response=await fetch(base+"/"+path.replace(/^\//,"")+".json",{
    method,headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},
    body:body===undefined?undefined:JSON.stringify(body)
  });
  const data=await response.json().catch(()=>null);
  if(!response.ok) throw new Error(data?.error||"فشلت عملية قاعدة البيانات");
  return data;
}
const json=(data,status=200,origin="")=>new Response(JSON.stringify(data),{status,headers:{...corsHeaders(origin),"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
function safeError(error){return error?.message||"حدث خطأ غير متوقع";}
async function route(request,env) {
  const url=new URL(request.url),path=url.pathname.replace(/\/+$/,"")||"/";
  const origin=request.headers.get("Origin")||"";
  if(request.method==="OPTIONS") return new Response(null,{status:204,headers:corsHeaders(origin)});
  // Public, non-sensitive health check: allow opening the Worker URL directly in a browser.
  if(path==="/health"&&request.method==="GET") return json({ok:true,service:"OMNIX API",version:"1.0.0"},200,origin);
  if(origin!==env.ALLOWED_ORIGIN) return json({error:"Origin not allowed"},403,origin);
  if(path==="/api/access"&&request.method==="GET"){
    const user=await verifySignedInUser(request,env);
    if(user.localId===env.OWNER_UID)return json({ok:true,allowed:true,owner:true},200,origin);
    const [assignment,subscription,allNotifications,allReleases]=await Promise.all([
      db(env,"omnix/customerPrograms/"+user.localId),db(env,"omnix/subscriptions/"+user.localId),db(env,"omnix/notifications"),db(env,"omnix/releases")
    ]);
    const now=Date.now(),expiresAt=Number(subscription?.expiresAt||0),programMismatch=!!subscription?.programId&&subscription.programId!==assignment?.programId;
    const allowed=!!assignment&&subscription?.status==="active"&&expiresAt>now&&!programMismatch;
    const reason=!assignment?"not_assigned":!subscription?"no_subscription":subscription.status!=="active"?"subscription_inactive":expiresAt<=now?"expired":programMismatch?"program_mismatch":"";
    const notifications=Object.entries(allNotifications||{}).filter(([,n])=>n.target==="all"||(n.target==="program"&&n.programId===assignment?.programId)||(n.target==="customer"&&n.customerUid===user.localId)).map(([id,n])=>({id,title:String(n.title||"إشعار"),message:String(n.message||""),createdAt:Number(n.createdAt||0)})).sort((a,b)=>b.createdAt-a.createdAt).slice(0,30);
    const safeSubscription=subscription?{status:subscription.status,days:subscription.days,startAt:subscription.startAt,expiresAt:subscription.expiresAt,programId:subscription.programId}:null;
    const release=Object.values(allReleases||{}).filter(r=>r.programId===assignment?.programId).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))[0]||null;
    const safeRelease=release?{version:String(release.version||""),url:String(release.url||""),notes:String(release.notes||""),forceUpdate:release.forceUpdate===true,createdAt:Number(release.createdAt||0)}:null;
    return json({ok:true,allowed,reason,program:assignment||null,subscription:safeSubscription,notifications,release:safeRelease},200,origin);
  }
  await verifyOwner(request,env);
  const managerCollection="/omnix/programAdmins/zein-rahaf-store";
  if(path==="/api/program-admins"&&request.method==="GET"){
    const programId=url.searchParams.get("programId")||"zein-rahaf-store";
    if(programId!=="zein-rahaf-store") return json({error:"البرنامج غير مدعوم"},400,origin);
    const managers=await db(env,managerCollection)||{};
    return json({ok:true,programId,managers},200,origin);
  }
  if(path==="/api/program-admins"&&request.method==="POST"){
    const body=await request.json(),email=String(body.email||"").trim().toLowerCase();
    const programId=String(body.programId||"");
    if(programId!=="zein-rahaf-store"||!/^\S+@\S+\.\S+$/.test(email)) return json({error:"اختر برنامج عطور زين ورهف واكتب بريدًا صحيحًا"},400,origin);
    const lookup=await adminFetch(env,"/accounts:lookup","POST",{email:[email]});
    const account=lookup.users?.find(u=>(u.email||"").toLowerCase()===email&&!u.disabled);
    if(!account) return json({error:"البريد غير موجود في Firebase Authentication أو الحساب معطل"},404,origin);
    let claims={};
    try{claims=account.customAttributes?JSON.parse(account.customAttributes):{};}catch(_){}
    claims.zeinRahafStoreAdmin=true;
    await adminFetch(env,"/accounts:update","POST",{localId:account.localId,customAttributes:JSON.stringify(claims)});
    const record={uid:account.localId,email,name:account.displayName||email,programId,programName:"عطور زين ورهف",role:"manager",active:true,updatedAt:Date.now(),updatedBy:env.OWNER_UID};
    await db(env,managerCollection+"/"+account.localId,"PUT",record);
    return json({ok:true,manager:record,refreshTokenRequired:true},200,origin);
  }
  const managerMatch=path.match(/^\/api\/program-admins\/([^/]+)$/);
  if(managerMatch&&request.method==="DELETE"){
    const uid=decodeURIComponent(managerMatch[1]);
    const record=await db(env,managerCollection+"/"+uid);
    if(!record) return json({error:"المدير غير موجود"},404,origin);
    const lookup=await adminFetch(env,"/accounts:lookup","POST",{localId:[uid]});
    const account=lookup.users?.[0];
    if(account){
      let claims={};
      try{claims=account.customAttributes?JSON.parse(account.customAttributes):{};}catch(_){}
      delete claims.zeinRahafStoreAdmin;
      await adminFetch(env,"/accounts:update","POST",{localId:uid,customAttributes:JSON.stringify(claims)});
    }
    await db(env,managerCollection+"/"+uid,"DELETE");
    return json({ok:true,uid,revoked:true},200,origin);
  }
  // Owner-managed program directory stored separately from the public source catalog.
  if(path==="/api/programs"&&request.method==="GET"){
    const programs=await db(env,"omnix/programs")||{};
    return json({ok:true,programs},200,origin);
  }
  if(path==="/api/programs"&&request.method==="POST"){
    const body=await request.json(),id=String(body.id||"").trim().toLowerCase();
    const name=String(body.name||"").trim(),urlValue=String(body.url||"").trim();
    if(!/^[a-z0-9][a-z0-9-]{1,49}$/.test(id)||!name||name.length>100||!/^https:\/\//i.test(urlValue))
      return json({error:"أدخل معرفًا إنجليزيًا صحيحًا واسم البرنامج ورابط HTTPS"},400,origin);
    const exists=await db(env,"omnix/programs/"+id);
    if(exists)return json({error:"معرف البرنامج مستخدم بالفعل"},409,origin);
    const record={id,name,url:urlValue,kind:String(body.kind||"برنامج").slice(0,100),description:String(body.description||"").slice(0,1000),active:body.active!==false,createdAt:Date.now(),updatedAt:Date.now(),updatedBy:env.OWNER_UID};
    await db(env,"omnix/programs/"+id,"PUT",record);
    return json({ok:true,program:record},201,origin);
  }
  const programMatch=path.match(/^\/api\/programs\/([a-z0-9-]+)$/);
  if(programMatch&&request.method==="PATCH"){
    const id=programMatch[1],body=await request.json(),old=await db(env,"omnix/programs/"+id);
    if(!old)return json({error:"البرنامج غير موجود"},404,origin);
    const next={...old};
    if(body.name!==undefined)next.name=String(body.name).trim().slice(0,100);
    if(body.url!==undefined){const value=String(body.url).trim();if(!/^https:\/\//i.test(value))return json({error:"رابط HTTPS مطلوب"},400,origin);next.url=value;}
    if(body.kind!==undefined)next.kind=String(body.kind).slice(0,100);
    if(body.description!==undefined)next.description=String(body.description).slice(0,1000);
    if(typeof body.active==="boolean")next.active=body.active;
    if(!next.name)return json({error:"اسم البرنامج مطلوب"},400,origin);
    next.updatedAt=Date.now();next.updatedBy=env.OWNER_UID;
    await db(env,"omnix/programs/"+id,"PUT",next);
    return json({ok:true,program:next},200,origin);
  }
  if(programMatch&&request.method==="DELETE"){
    const id=programMatch[1],old=await db(env,"omnix/programs/"+id);
    if(!old)return json({error:"البرنامج غير موجود"},404,origin);
    await db(env,"omnix/programs/"+id,"DELETE");
    return json({ok:true,id},200,origin);
  }
  if(path==="/api/bootstrap"&&request.method==="GET"){
    const [users,customerPrograms,subscriptions,notifications,releases,settings,programs]=await Promise.all([
      db(env,"users"),db(env,"omnix/customerPrograms"),db(env,"omnix/subscriptions"),
      db(env,"omnix/notifications"),db(env,"omnix/releases"),db(env,"omnix/settings"),db(env,"omnix/programs")
    ]);
    return json({users:users||{},customerPrograms:customerPrograms||{},subscriptions:subscriptions||{},notifications:notifications||{},releases:releases||{},settings:settings||{},programs:programs||{}},200,origin);
  }
  if(path==="/api/customers"&&request.method==="POST"){
    const body=await request.json(),email=String(body.email||"").trim().toLowerCase(),password=String(body.password||""),name=String(body.name||"").trim();
    if(!/^\S+@\S+\.\S+$/.test(email)||password.length<8||!name) return json({error:"أدخل اسمًا وبريدًا صحيحًا وكلمة مرور 8 أحرف على الأقل"},400,origin);
    const createResponse=await fetch("https://identitytoolkit.googleapis.com/v1/accounts:signUp?key="+encodeURIComponent(env.FIREBASE_API_KEY),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password,displayName:name,returnSecureToken:true})});
    const created=await createResponse.json();
    if(!createResponse.ok) throw new Error(created.error?.message||"تعذر إنشاء حساب Firebase");
    const uid=created.localId,now=Date.now();
    const profile={uid,email,name,phone:String(body.phone||""),createdAt:now,createdBy:env.OWNER_UID};
    const program=body.program||{};
    try{
      await db(env,"users/"+uid,"PUT",profile);
      if(program.id) await db(env,"omnix/customerPrograms/"+uid,"PUT",{programId:program.id,programName:program.name||"",url:program.url||"",updatedAt:now,createdBy:env.OWNER_UID});
    }catch(error){
      try{await adminFetch(env,"/accounts:delete","POST",{localId:uid});}catch(_){}
      throw error;
    }
    return json({ok:true,uid,email,name},201,origin);
  }
  const customerMatch=path.match(/^\/api\/customers\/([^/]+)$/);
  if(customerMatch){
    const uid=decodeURIComponent(customerMatch[1]);
    if(request.method==="PATCH"){
      const body=await request.json(),update={localId:uid};
      if(typeof body.disabled==="boolean") update.disabled=body.disabled;
      if(body.email) update.email=String(body.email).trim().toLowerCase();
      if(body.displayName) update.displayName=String(body.displayName).trim();
      if(body.password){if(String(body.password).length<8)return json({error:"كلمة المرور 8 أحرف على الأقل"},400,origin);update.password=String(body.password);}
      if(typeof body.disabled==="boolean") update.disableUser=body.disabled;
      delete update.disabled;
      const account=await adminFetch(env,"/accounts:update","POST",update);
      if(body.profile) await db(env,"users/"+uid,"PATCH",body.profile);
      return json({ok:true,uid,disabled:account.disabled===true},200,origin);
    }
    if(request.method==="DELETE"){
      await adminFetch(env,"/accounts:delete","POST",{localId:uid});
      await db(env,"users/"+uid,"DELETE");
      await db(env,"omnix/customerPrograms/"+uid,"DELETE");
      await db(env,"omnix/subscriptions/"+uid,"DELETE");
      return json({ok:true,uid},200,origin);
    }
  }
  const subscriptionMatch=path.match(/^\/api\/subscriptions\/([^/]+)$/);
  if(subscriptionMatch&&(request.method==="PUT"||request.method==="PATCH")){
    const uid=decodeURIComponent(subscriptionMatch[1]),body=await request.json(),now=Date.now();
    const old=await db(env,"omnix/subscriptions/"+uid)||{};
    const days=Number(body.days??old.days??30);
    const status=String(body.status??old.status??"active");
    if(!Number.isInteger(days)||days<1||days>3650)return json({error:"مدة الاشتراك من يوم واحد إلى 10 سنوات"},400,origin);
    if(!["active","paused","cancelled"].includes(status))return json({error:"حالة الاشتراك غير صحيحة"},400,origin);
    const startAt=Number(body.startAt||old.startAt||now);
    if(!Number.isFinite(startAt)||startAt>now+86400000)return json({error:"تاريخ بداية الاشتراك غير صحيح"},400,origin);
    const record={...old,uid,days,startAt,expiresAt:startAt+days*86400000,status,programId:String(body.programId??old.programId??""),notes:String(body.notes??old.notes??"").slice(0,1000),updatedAt:now,updatedBy:env.OWNER_UID};
    await db(env,"omnix/subscriptions/"+uid,"PUT",record);
    return json({ok:true,subscription:record},200,origin);
  }
  if(path==="/api/notifications"&&request.method==="POST"){
    const body=await request.json(),message=String(body.message||"").trim();
    if(!message||message.length>1000)return json({error:"اكتب إشعارًا من 1 إلى 1000 حرف"},400,origin);
    const record={title:String(body.title||"إشعار OMNIX").slice(0,100),message,target:body.target||"all",programId:body.programId||null,customerUid:body.customerUid||null,createdAt:Date.now(),createdBy:env.OWNER_UID};
    const result=await db(env,"omnix/notifications","POST",record);
    return json({ok:true,id:result.name,notification:record},201,origin);
  }
  if(path==="/api/releases"&&request.method==="POST"){
    const body=await request.json(),version=String(body.version||"").trim(),urlValue=String(body.url||"").trim();
    if(!version||!/^https:\/\//i.test(urlValue))return json({error:"رقم الإصدار ورابط HTTPS مطلوبان"},400,origin);
    const record={programId:String(body.programId||""),programName:String(body.programName||""),version,notes:String(body.notes||"").slice(0,3000),url:urlValue,forceUpdate:body.forceUpdate===true,createdAt:Date.now(),createdBy:env.OWNER_UID};
    const result=await db(env,"omnix/releases","POST",record);
    return json({ok:true,id:result.name,release:record},201,origin);
  }
  const releaseMatch=path.match(/^\/api\/releases\/([^/]+)$/);
  if(releaseMatch&&request.method==="DELETE"){
    const id=decodeURIComponent(releaseMatch[1]);
    const existing=await db(env,"omnix/releases/"+id);
    if(!existing)return json({error:"الإصدار غير موجود"},404,origin);
    await db(env,"omnix/releases/"+id,"DELETE");
    return json({ok:true,id},200,origin);
  }
  if(path==="/api/settings"&&request.method==="PUT"){
    const body=await request.json();
    const record={...body,updatedAt:Date.now(),updatedBy:env.OWNER_UID};
    await db(env,"omnix/settings","PUT",record);
    return json({ok:true,settings:record},200,origin);
  }
  return json({error:"المسار غير موجود"},404,origin);
}
export default {
  async fetch(request,env){
    try{return await route(request,env);}
    catch(error){const origin=request.headers.get("Origin")||"";return json({error:safeError(error)},400,origin===env.ALLOWED_ORIGIN?origin:"");}
  }
};