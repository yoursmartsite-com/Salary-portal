(()=>{'use strict';
const ENDPOINT='wss://lamma-rooms.fibrahem865.workers.dev/rooms/';
const ICE={iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun.cloudflare.com:3478'}]};
let socket=null,room='',uid='',stream=null,active=false,muted=false,peers=new Map(),ui=null;
const $=id=>ui?.querySelector('#'+id);
function mount(){
 if(ui)return ui;
 ui=document.createElement('section');ui.id='lammaVoiceWidget';ui.innerHTML='<div class="lv-head"><b>🎙️ صوت الغرفة</b><span id="lvState">غير متصل</span></div><div class="lv-actions"><button type="button" id="lvMic">تشغيل المايك</button><label><input type="checkbox" id="lvMute"> كتم أصوات اللاعبين</label></div><div class="lv-foot">الصوت مباشر داخل الغرفة</div>';
 const style=document.createElement('style');style.textContent='#lammaVoiceWidget{position:fixed;z-index:9999;left:12px;bottom:12px;width:min(310px,calc(100vw - 24px));padding:11px 12px;border:1px solid #75d9c855;border-radius:15px;background:linear-gradient(145deg,#13243aF5,#081525F5);box-shadow:0 12px 35px #0008;color:#f5f8ff;font:700 12px Cairo,system-ui,sans-serif;direction:rtl}#lammaVoiceWidget .lv-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px}#lammaVoiceWidget .lv-head b{font-size:14px}#lammaVoiceWidget #lvState{color:#a9c6dc;font-size:10px}#lammaVoiceWidget .lv-actions{display:flex;align-items:center;gap:9px;flex-wrap:wrap}#lammaVoiceWidget button{border:1px solid #68d8b577;border-radius:10px;padding:8px 12px;background:linear-gradient(135deg,#168b72,#17638d);color:white;font:800 12px Cairo,system-ui,sans-serif;cursor:pointer}#lammaVoiceWidget button[aria-pressed=true]{background:linear-gradient(135deg,#a94350,#7e263d)}#lammaVoiceWidget label{display:flex;align-items:center;gap:5px;color:#c5d5e9;font-size:11px}#lammaVoiceWidget input{accent-color:#4de0ae}#lammaVoiceWidget .lv-foot{margin-top:7px;color:#8fa8c6;font-size:10px}#lammaVoiceWidget.lv-error{border-color:#e77b7b}';
 document.head.appendChild(style);document.body.appendChild(ui);
 $('#lvMic').addEventListener('click',toggleMic);$('#lvMute').addEventListener('change',e=>{muted=e.target.checked;for(const p of peers.values())if(p.audio)p.audio.muted=muted});
 return ui;
}
function status(t,bad=false){if(!ui)return;$('#lvState').textContent=t;ui.classList.toggle('lv-error',bad)}
function send(data){if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify(data))}
function peer(id){
 if(peers.has(id))return peers.get(id);
 const pc=new RTCPeerConnection(ICE),entry={pc,audio:null,makingOffer:false,ignoreOffer:false,settingAnswer:false,polite:uid.localeCompare(id)>0,iceQueue:[]};peers.set(id,entry);
 if(stream)stream.getTracks().forEach(t=>pc.addTrack(t,stream));
 pc.onicecandidate=e=>{if(e.candidate)send({type:'ice',to:id,candidate:e.candidate})};
 pc.ontrack=e=>{let a=entry.audio;if(!a){a=document.createElement('audio');a.autoplay=true;a.playsInline=true;a.muted=muted;a.dataset.peer=id;document.body.appendChild(a);entry.audio=a}a.srcObject=e.streams[0]||new MediaStream([e.track]);a.play().catch(()=>status('اضغط مرة لتفعيل صوت اللاعبين'))};
 pc.onnegotiationneeded=async()=>{try{entry.makingOffer=true;await pc.setLocalDescription();send({type:'offer',to:id,sdp:pc.localDescription})}catch(e){status('تعذر تجهيز اتصال صوتي',true)}finally{entry.makingOffer=false}};
 pc.onconnectionstatechange=()=>{if(pc.connectionState==='failed')status('الاتصال الصوتي تعثر؛ الشبكة قد تحتاج TURN',true);else if(pc.connectionState==='connected')status(active?'المايك شغال':'الصوت متصل · المايك مغلق')};
 pc.onicecandidateerror=()=>status('الشبكة منعت مسار صوت مباشر؛ قد نحتاج TURN',true);
 return entry;
}
async function onSignal(m){
 if(m.type==='peer'){peer(m.uid);return}
 if(m.type==='left'){drop(m.from);return}
 const id=m.from;if(!id)return;const entry=peer(id),pc=entry.pc;
 try{
  if(m.type==='offer'){
   const ready=!entry.makingOffer&&(pc.signalingState==='stable'||entry.settingAnswer),collision=!ready;
   entry.ignoreOffer=!entry.polite&&collision;if(entry.ignoreOffer)return;
   if(collision)await pc.setLocalDescription({type:'rollback'});
   await pc.setRemoteDescription(m.sdp);
   while(entry.iceQueue.length)await pc.addIceCandidate(entry.iceQueue.shift());
   await pc.setLocalDescription();send({type:'answer',to:id,sdp:pc.localDescription});
  }else if(m.type==='answer'){
   entry.settingAnswer=true;await pc.setRemoteDescription(m.sdp);entry.settingAnswer=false;
   while(entry.iceQueue.length)await pc.addIceCandidate(entry.iceQueue.shift());
  }else if(m.type==='ice'&&m.candidate){
   if(pc.remoteDescription)await pc.addIceCandidate(m.candidate);else entry.iceQueue.push(m.candidate);
  }
 }catch(e){entry.settingAnswer=false;if(!entry.ignoreOffer)status('تعذر ربط صوت أحد اللاعبين',true)}
}
function drop(id){const e=peers.get(id);if(!e)return;e.pc.close();e.audio?.remove();peers.delete(id)}
async function join(roomCode,playerUid){
 if(!roomCode||!playerUid)return false;
 if(socket||room)leave();
 room=String(roomCode);uid=String(playerUid);mount();status('جاري الاتصال بالغرفة…');
 try{
  socket=new WebSocket(ENDPOINT+encodeURIComponent(room)+'/voice?uid='+encodeURIComponent(uid));
  socket.onopen=()=>status('متصل · شغّل المايك للمشاركة');
  socket.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch{return}onSignal(m)};
  socket.onerror=()=>status('خدمة الصوت غير متاحة حاليًا',true);
  socket.onclose=()=>{if(room)status('انقطع اتصال الصوت',true)};
  return true;
 }catch(e){status('فشل فتح قناة الصوت',true);return false}
}
async function toggleMic(){
 if(!room){status('ادخل غرفة أونلاين أولًا',true);return}
 if(!stream){
  try{if(!navigator.mediaDevices?.getUserMedia)throw new Error('المتصفح لا يدعم الميكروفون أو الصفحة ليست HTTPS');stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});for(const e of peers.values())stream.getTracks().forEach(t=>e.pc.addTrack(t,stream))}
  catch(e){status('اسمح بالميكروفون من المتصفح: '+e.message,true);return}
 }
 active=!active;stream.getAudioTracks().forEach(t=>t.enabled=active);
 $('#lvMic').textContent=active?'كتم المايك':'تشغيل المايك';$('#lvMic').setAttribute('aria-pressed',String(active));
 status(active?'المايك شغال · أنت مسموع':'المايك مكتوم · تقدر تسمع اللاعبين');
}
function leave(){
 if(socket){try{socket.close()}catch{}socket=null}
 for(const id of [...peers.keys()])drop(id);
 stream?.getTracks().forEach(t=>t.stop());stream=null;active=false;room='';uid='';
 if(ui){ui.remove();ui=null}
}
window.LammaVoice={join,leave,isActive:()=>active};
window.addEventListener('pagehide',()=>{if(room)leave()});
})();