(()=>{'use strict';
let ctx=null,modal=null,busy=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function dbCall(kind,path,value){
 const d=ctx.db;
 if(ctx.modular){
  const r=ctx.modular.ref(d,path);
  if(kind==='get')return ctx.modular.get(r);
  if(kind==='set')return ctx.modular.set(r,value);
  if(kind==='update')return ctx.modular.update(r,value);
  if(kind==='push')return ctx.modular.push(r);
 }
 const r=d.ref(path);
 if(kind==='get')return r.get?r.get():r.once('value');
 if(kind==='set')return r.set(value);
 if(kind==='update')return r.update(value);
 if(kind==='push')return r.push();
}
function ensureModal(){
 if(modal)return modal;
 const style=document.createElement('style');style.textContent='#lammaPlayerAction{position:fixed;inset:0;z-index:99999;background:#030712b8;display:none;align-items:center;justify-content:center;padding:18px;font-family:Cairo,system-ui,sans-serif}#lammaPlayerAction .lpa-card{width:min(340px,100%);border:1px solid #52658a;border-radius:20px;padding:20px;background:linear-gradient(145deg,#17243c,#0b1222);color:#f5f7ff;box-shadow:0 24px 80px #000b;text-align:center}#lammaPlayerAction .lpa-name{font-size:19px;font-weight:900;margin:5px 0 15px}#lammaPlayerAction .lpa-btn{display:block;width:100%;border:0;border-radius:12px;padding:12px;margin-top:9px;background:linear-gradient(110deg,#8058e9,#287fbd);color:white;font:800 14px Cairo,system-ui;cursor:pointer}#lammaPlayerAction .lpa-btn.secondary{background:#26364f;border:1px solid #425574}#lammaPlayerAction .lpa-btn:disabled{opacity:.5}#lammaPlayerAction .lpa-note{font-size:12px;color:#a9bad4;min-height:20px;margin-top:8px} [data-lamma-player]{cursor:pointer} [data-lamma-player]:focus{outline:2px solid #66e4e8;outline-offset:3px}';
 document.head.append(style);modal=document.createElement('div');modal.id='lammaPlayerAction';modal.innerHTML='<div class="lpa-card" role="dialog" aria-modal="true" aria-label="خيارات اللاعب"><div style="font-size:30px">👤</div><div class="lpa-name"></div><div class="lpa-note"></div><div class="lpa-actions"></div><button class="lpa-btn secondary" data-lpa-close>إغلاق</button></div>';document.body.append(modal);
 modal.addEventListener('click',e=>{if(e.target===modal||e.target.closest('[data-lpa-close]'))close()});
 modal.querySelector('[data-lpa-close]').addEventListener('click',close);
 return modal;
}
function close(){if(modal)modal.style.display='none';busy=false}
function note(t){modal.querySelector('.lpa-note').textContent=t}
function button(label,fn,secondary=false){const b=document.createElement('button');b.className='lpa-btn'+(secondary?' secondary':'');b.textContent=label;b.onclick=fn;modal.querySelector('.lpa-actions').append(b);return b}
async function open(target,name,bot){
 if(!ctx||!ctx.uid||!ctx.db)return;
 if(!target||target===ctx.uid||bot||String(target).startsWith('bot_'))return;
 ensureModal();modal.dataset.target=target;modal.querySelector('.lpa-name').textContent=name||'لاعب';modal.querySelector('.lpa-actions').innerHTML='';note('جاري فحص حالة الصداقة…');modal.style.display='flex';
 try{
  const [friend,outgoing,incoming]=await Promise.all([
   dbCall('get','friends/'+ctx.uid+'/'+target),
   dbCall('get','friendRequests/'+target+'/'+ctx.uid),
   dbCall('get','friendRequests/'+ctx.uid+'/'+target)
  ]);
  const f=friend.val?friend.val():friend;
  const o=outgoing.val?outgoing.val():outgoing;
  const i=incoming.val?incoming.val():incoming;
  if(f){note('أنتم أصدقاء بالفعل 💜');return}
  if(o&&o.status==='pending'){note('طلب الصداقة اتبعت بالفعل، مستني موافقته.');return}
  if(i&&i.status==='pending'){note('اللاعب بعتلك طلب صداقة بالفعل.');button('قبول طلب الصداقة',()=>accept(target,i));return}
  note('اضغط لإرسال طلب صداقة للاعب.');button('➕ إضافة صديق',()=>send(target,name));
 }catch(e){note('تعذر فحص حالة الصداقة: '+(e.message||e))}
}
async function send(target,targetName){
 if(busy)return;busy=true;const actions=modal.querySelector('.lpa-actions');actions.querySelectorAll('button').forEach(b=>b.disabled=true);note('جاري إرسال طلب الصداقة…');
 try{
  const oldSnap=await dbCall('get','friendRequests/'+target+'/'+ctx.uid),old=oldSnap.val?oldSnap.val():oldSnap;
  if(old&&old.status!=='rejected'){note(old.status==='pending'?'طلب الصداقة موجود بالفعل.':'لا يمكن إرسال الطلب حاليًا.');return}
  const profileSnap=await dbCall('get','profiles/'+ctx.uid),profile=profileSnap.val?profileSnap.val():profileSnap;
  const senderName=(profile&&(profile.displayName||profile.name))||ctx.getName?.()||'لاعب';
  await dbCall('set','friendRequests/'+target+'/'+ctx.uid,{fromUid:ctx.uid,fromName:senderName,toUid:target,status:'pending',at:Date.now(),source:'game'});
  const n=dbCall('push','notifications/'+target),key=n.key||n._key;
  if(key)await dbCall('set','notifications/'+target+'/'+key,{type:'friend_request',title:'طلب صداقة جديد',body:senderName+' بعتلك طلب صداقة من داخل لعبة.',fromUid:ctx.uid,fromName:senderName,at:Date.now(),read:false});
  note('تم إرسال طلب الصداقة بنجاح 💜');actions.innerHTML='';
 }catch(e){note('فشل إرسال الطلب: '+(e.message||e));actions.querySelectorAll('button').forEach(b=>b.disabled=false)}
 finally{busy=false}
}
async function accept(target,incoming){
 if(busy)return;busy=true;note('جاري قبول طلب الصداقة…');
 try{
  const name=(incoming&&incoming.fromName)||modal.querySelector('.lpa-name').textContent||'لاعب',mine=ctx.getName?.()||'لاعب';
  await dbCall('update','friendRequests/'+ctx.uid+'/'+target,{status:'accepted',acceptedAt:Date.now()});
  await dbCall('set','friends/'+ctx.uid+'/'+target,{uid:target,name,since:Date.now()});
  await dbCall('set','friends/'+target+'/'+ctx.uid,{uid:ctx.uid,name:mine,since:Date.now()});
  const n=dbCall('push','notifications/'+target),key=n.key||n._key;
  if(key)await dbCall('set','notifications/'+target+'/'+key,{type:'friend_accepted',title:'تم قبول طلب الصداقة',body:mine+' قبل طلب صداقتك.',fromUid:ctx.uid,fromName:mine,at:Date.now(),read:false});
  note('بقيتوا أصدقاء على لَمّة 💜');modal.querySelector('.lpa-actions').innerHTML='';
 }catch(e){note('تعذر قبول الطلب: '+(e.message||e))}
 finally{busy=false}
}
function init(options){
 ctx=options||null;if(!ctx||!ctx.db||!ctx.uid)return false;
 const activate=e=>{const el=e.target.closest('[data-lamma-player]');if(!el)return;if(e.type==='keydown'&&e.key!=='Enter'&&e.key!==' ')return;if(e.type==='keydown')e.preventDefault();e.stopPropagation();open(el.dataset.lammaPlayer,el.dataset.playerName||el.getAttribute('aria-label')||'لاعب',el.dataset.playerBot==='true')};document.addEventListener('click',activate);document.addEventListener('keydown',activate);
 return true;
}
window.LammaPlayerActions={init,open};
})();