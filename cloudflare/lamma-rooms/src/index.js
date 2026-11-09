import { startCardGame, publicCardGame, applyCardMove } from "./card-games.js";
import { DurableObject } from "cloudflare:workers";
const ORIGINS=new Set(["https://yoursmartsite-com.github.io","http://localhost:8000","http://127.0.0.1:8000"]);
const cors=r=>{const o=r.headers.get("Origin")||"";return {"Access-Control-Allow-Origin":ORIGINS.has(o)?o:"https://yoursmartsite-com.github.io","Access-Control-Allow-Methods":"GET,POST,DELETE,OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization","Access-Control-Max-Age":"86400","Vary":"Origin"}};
const out=(d,s=200,h={})=>Response.json(d,{status:s,headers:h});
const roomView=state=>{const safe={...state};delete safe.gameState;delete safe.sessions;return safe};
const tokenOk=(state,uid,req)=>!state.sessions||state.sessions[uid]===req.headers.get("X-Room-Token");
const uidOk=v=>typeof v==="string"&&/^[A-Za-z0-9_-]{3,128}$/.test(v);
const nameOk=v=>typeof v==="string"&&v.trim().length>0&&v.trim().length<=24;
const games=["none","xo","guess","rps","connect4","words","quiz","estimation","basra","uno","tarneeb","hokm","konkan"];

export class Room extends DurableObject{
 async fetch(req){
  const u=new URL(req.url),h=cors(req);if(req.method==="OPTIONS")return new Response(null,{status:204,headers:h});
  if(u.pathname==="/discover"){
   let dir=await this.ctx.storage.get("directory")||{};
   if(req.method==="GET")return out({ok:true,rooms:Object.values(dir).filter(x=>Date.now()-x.updatedAt<86400000).sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,40)},200,h);
   if(req.method==="POST"){const b=await req.json();if(!/^\d{6}$/.test(b.code)||!uidOk(b.host))return out({ok:false,error:"INVALID_DIRECTORY_ENTRY"},400,h);dir[b.code]={code:b.code,title:String(b.title||"قعدة لَمّة").slice(0,35),topic:String(b.topic||"").slice(0,90),host:b.host,count:1,updatedAt:Date.now()};await this.ctx.storage.put("directory",dir);return out({ok:true},200,h)}
   if(req.method==="DELETE"){delete dir[u.searchParams.get("code")];await this.ctx.storage.put("directory",dir);return out({ok:true},200,h)}
  }
  if(u.pathname.endsWith("/voice")&&req.headers.get("Upgrade")==="websocket"){
   const id=u.searchParams.get("uid")||"",room=u.pathname.split("/").filter(Boolean)[1];if(!uidOk(id))return out({ok:false,error:"INVALID_PLAYER"},400,h);
   const pair=new WebSocketPair(),client=pair[0],server=pair[1];this.ctx.acceptWebSocket(server,[room]);server.serializeAttachment({room,uid:id});
   for(const peer of this.ctx.getWebSockets(room)){const a=peer.deserializeAttachment();if(a?.uid){server.send(JSON.stringify({type:"peer",uid:a.uid}));try{peer.send(JSON.stringify({type:"peer",uid:id}))}catch{}}}
   return new Response(null,{status:101,webSocket:client});
  }
  const parts=u.pathname.split("/").filter(Boolean),roomCode=parts[1],action=parts[2]||"",target=parts[3];let state=await this.ctx.storage.get("room");
  try{
   if(req.method==="POST"&&!action){if(state)return out({ok:false,error:"ROOM_EXISTS"},409,h);const b=await req.json();if(!uidOk(b.uid)||!nameOk(b.name))return out({ok:false,error:"INVALID_ROOM_DATA"},400,h);
    const sessionToken=crypto.randomUUID()+crypto.randomUUID();state={code:roomCode,sessions:{[b.uid]:sessionToken},title:String(b.title||"قعدة لَمّة").slice(0,35),topic:String(b.topic||"").slice(0,90),visibility:b.visibility==="public"?"public":"private",game:games.includes(b.game)?b.game:"none",maxPlayers:Math.max(2,Math.min(4,Number(b.maxPlayers)||4)),host:b.uid,createdAt:Date.now(),updatedAt:Date.now(),players:{[b.uid]:{uid:b.uid,name:b.name.trim(),avatar:String(b.avatar||"🍓").slice(0,1000),hand:false,joinedAt:Date.now()}},chat:[]};
    await this.ctx.storage.put("room",state);return out({ok:true,room:roomView(state),sessionToken},201,h)}
   if(!state)return out({ok:false,error:"ROOM_NOT_FOUND"},404,h);
   if(req.method==="GET"&&action==="game"){const uid=u.searchParams.get("uid")||"";if(!tokenOk(state,uid,req))return out({ok:false,error:"INVALID_ROOM_SESSION"},403,h);if(!state.players[uid])return out({ok:false,error:"PLAYER_NOT_IN_ROOM"},403,h);return out({ok:true,game:publicCardGame(state,uid)},200,h)}
   if(req.method==="POST"&&action==="start"){const b=await req.json();if(state.gameState)return out({ok:false,error:"GAME_ALREADY_STARTED"},409,h);if(!tokenOk(state,b.uid,req))return out({ok:false,error:"INVALID_ROOM_SESSION"},403,h);if(b.uid!==state.host)return out({ok:false,error:"HOST_ONLY"},403,h);if(!["estimation","basra","uno","tarneeb","hokm","konkan"].includes(state.game))return out({ok:false,error:"NOT_CARD_GAME"},400,h);try{startCardGame(state,state.game);await this.ctx.storage.put("room",state);return out({ok:true,game:publicCardGame(state,b.uid)},200,h)}catch(e){return out({ok:false,error:e.message},409,h)}}
   if(req.method==="POST"&&action==="move"){const b=await req.json();try{if(!tokenOk(state,b.uid,req))return out({ok:false,error:"INVALID_ROOM_SESSION"},403,h);if(!state.players[b.uid])return out({ok:false,error:"PLAYER_NOT_IN_ROOM"},403,h);applyCardMove(state,b.uid,b);state.updatedAt=Date.now();await this.ctx.storage.put("room",state);return out({ok:true,game:publicCardGame(state,b.uid)},200,h)}catch(e){return out({ok:false,error:e.message},409,h)}}
   if(req.method==="GET"&&!action){return out({ok:true,room:roomView(state)},200,h)}
   if(req.method==="POST"&&action==="join"){const b=await req.json();if(!uidOk(b.uid)||!nameOk(b.name))return out({ok:false,error:"INVALID_PLAYER"},400,h);if(state.players[b.uid]&&!tokenOk(state,b.uid,req))return out({ok:false,error:"INVALID_ROOM_SESSION"},403,h);if(b.game&&state.game!==b.game)return out({ok:false,error:"WRONG_GAME"},409,h);if(state.gameState&&!state.players[b.uid])return out({ok:false,error:"GAME_ALREADY_STARTED"},409,h);if(!state.players[b.uid]&&Object.keys(state.players).length>=(state.maxPlayers||4))return out({ok:false,error:"ROOM_FULL"},409,h);const sessionToken=state.sessions?.[b.uid]||crypto.randomUUID()+crypto.randomUUID();state.sessions||={};state.sessions[b.uid]=sessionToken;state.players[b.uid]={uid:b.uid,name:b.name.trim(),avatar:String(b.avatar||"🍓").slice(0,1000),hand:false,joinedAt:state.players[b.uid]?.joinedAt||Date.now()};state.updatedAt=Date.now();await this.ctx.storage.put("room",state);return out({ok:true,room:roomView(state),sessionToken},200,h)}
   if(req.method==="POST"&&action==="ready"){const b=await req.json();if(state.gameState)return out({ok:false,error:"GAME_ALREADY_STARTED"},409,h);if(!tokenOk(state,b.uid,req))return out({ok:false,error:"INVALID_ROOM_SESSION"},403,h);if(!state.players[b.uid]||typeof b.ready!=="boolean")return out({ok:false,error:"PLAYER_NOT_IN_ROOM"},400,h);state.players[b.uid].ready=b.ready;state.updatedAt=Date.now();await this.ctx.storage.put("room",state);return out({ok:true,room:roomView(state)},200,h)}
   if(req.method==="POST"&&action==="hand"){const b=await req.json();if(!tokenOk(state,b.uid,req))return out({ok:false,error:"INVALID_ROOM_SESSION"},403,h);if(!state.players[b.uid]||typeof b.hand!=="boolean")return out({ok:false,error:"PLAYER_NOT_IN_ROOM"},400,h);state.players[b.uid].hand=b.hand;state.updatedAt=Date.now();await this.ctx.storage.put("room",state);return out({ok:true},200,h)}
   if(req.method==="POST"&&action==="game"){const b=await req.json();if(state.gameState)return out({ok:false,error:"GAME_ALREADY_STARTED"},409,h);if(!tokenOk(state,b.uid,req))return out({ok:false,error:"INVALID_ROOM_SESSION"},403,h);if(!state.players[b.uid]||!games.includes(b.game)||b.game==="none")return out({ok:false,error:"INVALID_GAME_SELECTION"},400,h);state.game=b.game;state.gameUpdatedBy=state.players[b.uid].name;state.updatedAt=Date.now();await this.ctx.storage.put("room",state);return out({ok:true},200,h)}
   if(req.method==="POST"&&action==="chat"){const b=await req.json();if(!tokenOk(state,b.uid,req))return out({ok:false,error:"INVALID_ROOM_SESSION"},403,h);if(!state.players[b.uid]||typeof b.text!=="string"||!b.text.trim()||b.text.length>300)return out({ok:false,error:"INVALID_CHAT_MESSAGE"},400,h);state.chat.push({uid:b.uid,name:state.players[b.uid].name,text:b.text.trim(),at:Date.now()});state.chat=state.chat.slice(-100);state.updatedAt=Date.now();await this.ctx.storage.put("room",state);return out({ok:true},200,h)}
   if(req.method==="DELETE"&&action==="players"&&target){if(!tokenOk(state,target,req))return out({ok:false,error:"INVALID_ROOM_SESSION"},403,h);delete state.players[target];delete state.sessions?.[target];if(state.host===target)state.host=Object.keys(state.players)[0]||null;if(!Object.keys(state.players).length){await this.ctx.storage.delete("room");return out({ok:true,deleted:true},200,h)}state.updatedAt=Date.now();await this.ctx.storage.put("room",state);return out({ok:true},200,h)}
   return out({ok:false,error:"NOT_FOUND"},404,h)
  }catch(e){return out({ok:false,error:"SERVER_ERROR",message:e.message},500,h)}
 }
 async webSocketMessage(ws,message){const a=ws.deserializeAttachment()||{};let d;try{d=JSON.parse(message)}catch{return}if(!["offer","answer","ice","left"].includes(d.type)||typeof d.to!=="string"||d.to.length>128)return;const msg=JSON.stringify({...d,from:a.uid});for(const p of this.ctx.getWebSockets(a.room)){if(p.deserializeAttachment()?.uid===d.to)try{p.send(msg)}catch{}}}
 async webSocketClose(ws){const a=ws.deserializeAttachment()||{},m=JSON.stringify({type:"left",from:a.uid});for(const p of this.ctx.getWebSockets(a.room))try{p.send(m)}catch{}}
 async webSocketError(ws){try{ws.close(1011,"voice signaling error")}catch{}}
}

let firebaseKeys=null,firebaseKeysUntil=0;
const b64url=s=>Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
async function verifyFirebaseToken(request){
 const auth=request.headers.get("Authorization")||"",token=auth.startsWith("Bearer ")?auth.slice(7):"";
 const p=token.split(".");if(p.length!==3)throw new Error("AUTH_REQUIRED");
 const header=JSON.parse(new TextDecoder().decode(b64url(p[0]))),claims=JSON.parse(new TextDecoder().decode(b64url(p[1])));
 if(header.alg!=="RS256"||!header.kid)throw new Error("INVALID_TOKEN");
 if(!firebaseKeys||Date.now()>firebaseKeysUntil){
  const r=await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
  if(!r.ok)throw new Error("AUTH_KEYS_UNAVAILABLE");
  firebaseKeys=(await r.json()).keys||[];firebaseKeysUntil=Date.now()+3600000;
 }
 const jwk=firebaseKeys.find(k=>k.kid===header.kid);if(!jwk)throw new Error("INVALID_TOKEN");
 const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
 const valid=await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,b64url(p[2]),new TextEncoder().encode(p[0]+"."+p[1]));
 const now=Math.floor(Date.now()/1000);
 if(!valid||claims.iss!=="https://securetoken.google.com/play-with-friends-com"||claims.aud!=="play-with-friends-com"||!claims.sub||!claims.exp||claims.exp<=now||!claims.iat||claims.iat>now+60)throw new Error("INVALID_TOKEN");
 return claims;
}
async function cloudinarySignature(params,secret){
 const raw=Object.keys(params).sort().map(k=>k+"="+params[k]).join("&")+secret;
 const digest=await crypto.subtle.digest("SHA-1",new TextEncoder().encode(raw));
 return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
}

export default{async fetch(req,env){
 const url=new URL(req.url);
 if(url.pathname==="/media/upload"&&req.method==="POST"){
  const h=cors(req);
  try{
   if(!env.CLOUDINARY_API_SECRET)return out({ok:false,error:"CLOUDINARY_SECRET_MISSING"},500,h);
   const claims=await verifyFirebaseToken(req);
   const length=Number(req.headers.get("Content-Length")||0);
   if(length>11*1024*1024)return out({ok:false,error:"FILE_TOO_LARGE",message:"الحد الأقصى للصورة 10 ميجابايت"},413,h);
   const form=await req.formData(),file=form.get("file");
   if(!file||typeof file==="string"||!file.type?.startsWith("image/"))return out({ok:false,error:"IMAGE_REQUIRED"},400,h);
   if(file.size>10*1024*1024)return out({ok:false,error:"FILE_TOO_LARGE",message:"الحد الأقصى للصورة 10 ميجابايت"},413,h);
   const allowed=["image/jpeg","image/png","image/webp","image/gif"];
   if(!allowed.includes(file.type))return out({ok:false,error:"UNSUPPORTED_IMAGE",message:"الصيغ المدعومة JPG وPNG وWEBP وGIF"},415,h);
   const timestamp=Math.floor(Date.now()/1000),folder="lamma/profiles/"+claims.sub,public_id=crypto.randomUUID();
   const params={folder,overwrite:"false",public_id,timestamp:String(timestamp)};
   const signature=await cloudinarySignature(params,env.CLOUDINARY_API_SECRET);
   const upload=new FormData();upload.set("file",file,file.name||"profile-image");upload.set("api_key","557134562778449");upload.set("timestamp",String(timestamp));upload.set("folder",folder);upload.set("public_id",public_id);upload.set("overwrite","false");upload.set("signature",signature);
   const response=await fetch("https://api.cloudinary.com/v1_1/g21wbsl1/image/upload",{method:"POST",body:upload});
   const data=await response.json();
   if(!response.ok)return out({ok:false,error:"CLOUDINARY_UPLOAD_FAILED",message:data.error?.message||"فشل رفع الصورة"},502,h);
   return out({ok:true,url:data.secure_url,publicId:data.public_id,width:data.width,height:data.height,bytes:data.bytes},200,h);
  }catch(e){const status=e.message==="AUTH_REQUIRED"||e.message==="INVALID_TOKEN"?401:500;return out({ok:false,error:e.message||"UPLOAD_FAILED"},status,h)}
 }
const u=new URL(req.url),h=cors(req);if(req.method==="OPTIONS")return new Response(null,{status:204,headers:h});if(u.pathname==="/"||u.pathname==="/health")return out({ok:true,service:"lamma-rooms-worker",version:3},200,h);if(u.pathname==="/discover")return env.ROOMS.get(env.ROOMS.idFromName("__directory__")).fetch(req);const m=u.pathname.match(/^\/rooms\/([A-Za-z0-9_-]{3,32})(?:\/.*)?$/);if(!m)return out({ok:false,error:"ROOM_CODE_REQUIRED"},400,h);return env.ROOMS.get(env.ROOMS.idFromName(m[1])).fetch(req)}};
