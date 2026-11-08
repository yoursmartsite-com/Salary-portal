import { DurableObject } from "cloudflare:workers";
const ORIGINS=new Set(["https://yoursmartsite-com.github.io","http://localhost:8000","http://127.0.0.1:8000"]);
const cors=r=>{const o=r.headers.get("Origin")||"";return {"Access-Control-Allow-Origin":ORIGINS.has(o)?o:"https://yoursmartsite-com.github.io","Access-Control-Allow-Methods":"GET,POST,DELETE,OPTIONS","Access-Control-Allow-Headers":"Content-Type","Access-Control-Max-Age":"86400","Vary":"Origin"}};
const out=(d,s=200,h={})=>Response.json(d,{status:s,headers:h});
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
    state={code:roomCode,title:String(b.title||"قعدة لَمّة").slice(0,35),topic:String(b.topic||"").slice(0,90),visibility:b.visibility==="public"?"public":"private",game:"none",maxPlayers:Math.max(2,Math.min(30,Number(b.maxPlayers)||20)),host:b.uid,createdAt:Date.now(),updatedAt:Date.now(),players:{[b.uid]:{uid:b.uid,name:b.name.trim(),avatar:String(b.avatar||"🍓").slice(0,100),hand:false,joinedAt:Date.now()}},chat:[]};
    await this.ctx.storage.put("room",state);return out({ok:true,room:state},201,h)}
   if(!state)return out({ok:false,error:"ROOM_NOT_FOUND"},404,h);
   if(req.method==="GET"&&!action)return out({ok:true,room:state},200,h);
   if(req.method==="POST"&&action==="join"){const b=await req.json();if(!uidOk(b.uid)||!nameOk(b.name))return out({ok:false,error:"INVALID_PLAYER"},400,h);if(!state.players[b.uid]&&Object.keys(state.players).length>=state.maxPlayers)return out({ok:false,error:"ROOM_FULL"},409,h);state.players[b.uid]={uid:b.uid,name:b.name.trim(),avatar:String(b.avatar||"🍓").slice(0,100),hand:false,joinedAt:state.players[b.uid]?.joinedAt||Date.now()};state.updatedAt=Date.now();await this.ctx.storage.put("room",state);return out({ok:true,room:state},200,h)}
   if(req.method==="POST"&&action==="hand"){const b=await req.json();if(!state.players[b.uid]||typeof b.hand!=="boolean")return out({ok:false,error:"PLAYER_NOT_IN_ROOM"},400,h);state.players[b.uid].hand=b.hand;state.updatedAt=Date.now();await this.ctx.storage.put("room",state);return out({ok:true},200,h)}
   if(req.method==="POST"&&action==="game"){const b=await req.json();if(!state.players[b.uid]||!games.includes(b.game)||b.game==="none")return out({ok:false,error:"INVALID_GAME_SELECTION"},400,h);state.game=b.game;state.gameUpdatedBy=state.players[b.uid].name;state.updatedAt=Date.now();await this.ctx.storage.put("room",state);return out({ok:true},200,h)}
   if(req.method==="POST"&&action==="chat"){const b=await req.json();if(!state.players[b.uid]||typeof b.text!=="string"||!b.text.trim()||b.text.length>300)return out({ok:false,error:"INVALID_CHAT_MESSAGE"},400,h);state.chat.push({uid:b.uid,name:state.players[b.uid].name,text:b.text.trim(),at:Date.now()});state.chat=state.chat.slice(-100);state.updatedAt=Date.now();await this.ctx.storage.put("room",state);return out({ok:true},200,h)}
   if(req.method==="DELETE"&&action==="players"&&target){delete state.players[target];if(state.host===target)state.host=Object.keys(state.players)[0]||null;if(!Object.keys(state.players).length){await this.ctx.storage.delete("room");return out({ok:true,deleted:true},200,h)}state.updatedAt=Date.now();await this.ctx.storage.put("room",state);return out({ok:true},200,h)}
   return out({ok:false,error:"NOT_FOUND"},404,h)
  }catch(e){return out({ok:false,error:"SERVER_ERROR",message:e.message},500,h)}
 }
 async webSocketMessage(ws,message){const a=ws.deserializeAttachment()||{};let d;try{d=JSON.parse(message)}catch{return}if(!["offer","answer","ice","left"].includes(d.type)||typeof d.to!=="string"||d.to.length>128)return;const msg=JSON.stringify({...d,from:a.uid});for(const p of this.ctx.getWebSockets(a.room)){if(p.deserializeAttachment()?.uid===d.to)try{p.send(msg)}catch{}}}
 async webSocketClose(ws){const a=ws.deserializeAttachment()||{},m=JSON.stringify({type:"left",from:a.uid});for(const p of this.ctx.getWebSockets(a.room))try{p.send(m)}catch{}}
 async webSocketError(ws){try{ws.close(1011,"voice signaling error")}catch{}}
}
export default{async fetch(req,env){const u=new URL(req.url),h=cors(req);if(req.method==="OPTIONS")return new Response(null,{status:204,headers:h});if(u.pathname==="/"||u.pathname==="/health")return out({ok:true,service:"lamma-rooms-worker",version:3},200,h);if(u.pathname==="/discover")return env.ROOMS.get(env.ROOMS.idFromName("__directory__")).fetch(req);const m=u.pathname.match(/^\/rooms\/([A-Za-z0-9_-]{3,32})(?:\/.*)?$/);if(!m)return out({ok:false,error:"ROOM_CODE_REQUIRED"},400,h);return env.ROOMS.get(env.ROOMS.idFromName(m[1])).fetch(req)}};
