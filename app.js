import { firebaseConfig, firebaseReady } from "./firebase-config.js";

const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
const state = {
  name: localStorage.getItem("arcade_name") || "",
  uid: localStorage.getItem("arcade_uid") || crypto.randomUUID(),
  game: null, roomId: null, room: null, unsubRoom: null, unsubChat: null,
  db: null, auth: null, firebase: false, localTurn: "X", localBoard: Array(9).fill(""),
  rpsScore: {me:0,opponent:0}, guessTarget: Math.floor(Math.random()*20)+1, guesses: 0
};
localStorage.setItem("arcade_uid", state.uid);

function toast(message) {
  const el = $("#toast"); el.textContent = message; el.classList.add("show");
  clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 2600);
}
function safeText(v="") {
  return String(v).replace(/[&<>"']/g, c => ({"&":"&","<":"<",">":">",'"':""","'":"'"}[c]));
}
function renderName() {
  $("#playerName").textContent = state.name || "Player";
  $("#avatar").textContent = (state.name || "P").trim().charAt(0).toUpperCase();
}
function openModal(id) { $("#"+id).classList.add("open"); }
function closeModal(id) { $("#"+id).classList.remove("open"); }
function newRoomCode() { return Math.random().toString(36).slice(2,7).toUpperCase(); }

async function initFirebase() {
  if (!firebaseReady) {
    $("#connectionLabel").textContent = "وضع تجريبي";
    $("#firebaseStatus").textContent = "الإعداد مطلوب";
    $("#lobbyHint").textContent = "أضف بيانات Firebase في firebase-config.js لتفعيل الغرف العامة أونلاين.";
    return;
  }
  try {
    const [appMod, dbMod, authMod] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js")
    ]);
    const app = appMod.initializeApp(firebaseConfig);
    state.db = dbMod.getDatabase(app);
    state.auth = authMod.getAuth(app);
    const credential = await authMod.signInAnonymously(state.auth);
    state.uid = credential.user.uid;
    localStorage.setItem("arcade_uid", state.uid);
    state.firebase = true;
    state.dbApi = dbMod;
    $("#connectionLabel").textContent = "متصل أونلاين";
    $("#firebaseStatus").textContent = "متصل";
    $("#firebaseStatus").style.color = "#9bf0c9";
    $("#firebaseStatus").style.background = "#14342b";
    $("#lobbyHint").textContent = "اختار لعبة عشان تنشئ غرفة عامة، أو ادخل غرفة متاحة من القائمة.";
    $("#onlineCount").textContent = "متصل أونلاين";
    subscribeRooms();
  } catch (err) {
    console.error(err);
    $("#firebaseStatus").textContent = "تعذر الاتصال";
    $("#lobbyHint").textContent = "راجع إعدادات Firebase وفعّل Anonymous Authentication وقواعد قاعدة البيانات.";
    toast("تعذر الاتصال بـ Firebase. راجع الإعدادات.");
  }
}

function subscribeRooms() {
  if (!state.firebase) return;
  const { ref, onValue, query, orderByChild, limitToLast } = state.dbApi;
  const roomsRef = query(ref(state.db, "rooms"), orderByChild("updatedAt"), limitToLast(30));
  onValue(roomsRef, snap => {
    const rooms = [];
    snap.forEach(child => {
      const r = child.val();
      if (r && r.status !== "closed" && Date.now() - (r.updatedAt || 0) < 3600000*10) rooms.push({id:child.key,...r});
    });
    rooms.sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
    $("#onlineCount").textContent = `${rooms.length} غرفة نشطة`;
    renderRooms(rooms);
  }, err => console.warn(err));
}

function renderRooms(rooms) {
  const root = $("#roomsList");
  if (!rooms.length) { 
    root.innerHTML = '<p class="empty-notice">مفيش غرف نشطة دلوقتي. اختار لعبة وأنشئ أول غرفة!</p>'; 
    return; 
  }
  const icons = {xo:"❌",rps:"✊",guess:"🔢"};
  const titles = {xo:"إكس أو",rps:"حجر ورقة مقص",guess:"تخمين الرقم"};
  root.innerHTML = rooms.map(r => `
    <div class="room-item">
      <span class="room-emoji">${icons[r.game]||"🎮"}</span>
      <div>
        <strong>${safeText(r.title||titles[r.game]||"غرفة لعب")}</strong>
        <small>${safeText(r.hostName||"لاعب")} • ${safeText(r.playersCount||1)} لاعب • ${safeText(r.id)}</small>
      </div>
      <button data-join="${safeText(r.id)}">دخول</button>
    </div>
  `).join("");
  $$("[data-join]").forEach(b => b.addEventListener("click", () => joinRoom(b.dataset.join)));
}

async function createRoom(game) {
  if (!state.name) { openModal("nameModal"); toast("اكتب اسمك الأول"); return; }
  state.game = game;
  if (!state.firebase) {
    state.roomId = "LOCAL";
    state.room = {game, hostName:state.name, players:{[state.uid]:{name:state.name,joinedAt:Date.now()}}, state:{}};
    setupGameModal(true); return;
  }
  try {
    const {ref,push,set} = state.dbApi;
    const roomsRef = ref(state.db,"rooms");
    const newRef = push(roomsRef);
    state.roomId = newRef.key;
    const initialState = game === "xo" ? {board:Array(9).fill(""),turn:state.uid,winner:"",moves:0} :
      game === "rps" ? {round:1,choices:{},scores:{}} :
      {target:Math.floor(Math.random()*20)+1,guesses:[],winner:""};
    const room = {
      game,
      title:({xo:"إكس أو",rps:"حجر ورقة مقص",guess:"تخمين الرقم"})[game],
      hostUid:state.uid,
      hostName:state.name,
      status:"open",
      createdAt:Date.now(),
      updatedAt:Date.now(),
      players:{[state.uid]:{name:state.name,joinedAt:Date.now()}},
      state:initialState,
      playersCount:1
    };
    await set(newRef,room);
    state.room = room;
    setupGameModal(false);
    watchRoom();
  } catch(err) { console.error(err); toast("مش قادر أنشئ الغرفة. راجع قواعد Firebase."); }
}

async function joinRoom(id) {
  if (!state.name) { openModal("nameModal"); toast("اكتب اسمك الأول"); return; }
  if (!state.firebase) { toast("فعّل Firebase الأول عشان تدخل غرف أونلاين."); return; }
  try {
    const {ref,get,update,runTransaction} = state.dbApi;
    const roomRef = ref(state.db, `rooms/${id}`);
    const snap = await get(roomRef);
    if (!snap.exists()) return toast("الغرفة مش موجودة.");
    const room = snap.val();
    if ((room.game === "xo" || room.game === "rps") && Object.keys(room.players||{}).length >= 2 && !room.players[state.uid]) 
      return toast("الغرفة دي مكتملة.");
    
    await update(ref(state.db, `rooms/${id}/players/${state.uid}`), {name:state.name, joinedAt:Date.now()});
    await runTransaction(ref(state.db, `rooms/${id}/playersCount`), v => (v||0)+1);
    state.game = room.game; state.roomId = id; state.room = room;
    setupGameModal(false); watchRoom();
  } catch(err) { console.error(err); toast("تعذر دخول الغرفة."); }
}

function watchRoom() {
  if (!state.firebase) return;
  const {ref,onValue,onDisconnect} = state.dbApi;
  if (state.unsubRoom) state.unsubRoom();
  state.unsubRoom = onValue(ref(state.db, `rooms/${state.roomId}`), snap => {
    if (!snap.exists()) { toast("الغرفة اتقفلت."); closeModal("gameModal"); return; }
    state.room = {id:state.roomId,...snap.val()};
    const players = Object.values(state.room.players||{});
    $("#roomStatus").textContent = players.map(p=>p.name).join(" • ") || "في انتظار اللاعبين";
    $("#demoNote").textContent = "أنت متصل بالغرفة أونلاين.";
    drawGame();
  });
  onDisconnect(ref(state.db, `rooms/${state.roomId}/players/${state.uid}`)).remove().catch(()=>{});
  
  if (state.unsubChat) state.unsubChat();
  state.unsubChat = onValue(ref(state.db, `rooms/${state.roomId}/chat`), snap => {
    const msgs=[]; snap.forEach(c=>msgs.push(c.val()));
    $("#chatMessages").innerHTML = msgs.slice(-40).map(m=>`
      <div class="chat-line"><b>${safeText(m.name||"لاعب")}:</b> ${safeText(m.text||"")}</div>
    `).join("") || '<p class="empty-notice">مفيش رسائل لسه.</p>';
    $("#chatMessages").scrollTop = $("#chatMessages").scrollHeight;
  });
}

function setupGameModal(local) {
  $("#gameModal").classList.add("open");
  $("#gameTitle").textContent = ({xo:"إكس أو",rps:"حجر ورقة مقص",guess:"تخمين الرقم"})[state.game];
  $("#roomCode").textContent = local ? "تجريبي" : state.roomId.slice(-6).toUpperCase();
  $("#roomStatus").textContent = local ? "وضع تجريبي على نفس الجهاز" : "تم إنشاء الغرفة";
  $("#demoNote").textContent = local ? "الوضع التجريبي لا يزامن بين أجهزة مختلفة. فعّل Firebase للعب أونلاين." : "أنت متصل بالغرفة أونلاين.";
  $("#chatMessages").innerHTML = '<p class="empty-notice">رسائل الغرفة هتظهر هنا.</p>';
  drawGame();
}

function drawGame() {
  if (!state.room) return;
  if (state.game==="xo") drawXO();
  if (state.game==="rps") drawRPS();
  if (state.game==="guess") drawGuess();
}

function currentPlayerEntries() { return Object.entries(state.room?.players||{}); }

function drawXO() {
  const room=state.room, s=room.state||{}, board=s.board||Array(9).fill("");
  const entries=currentPlayerEntries();
  const myMark=entries.findIndex(([uid])=>uid===state.uid)===0?"X":"O";
  const players=entries.map(([,p])=>p.name);
  let status = s.winner ? (s.winner==="draw"?"تعادل!":`الفائز: ${safeText(players[s.winner==="X"?0:1]||s.winner)}`) :
    (entries.length<2?"مستنيين لاعب تاني يدخل...":(s.turn===state.uid?"دورك!":"مستني دورك"));
  
  $("#gameContent").innerHTML = `
    <p class="game-message">${status} <br><small>${safeText(players[0]||"X")} (X) ضد ${safeText(players[1]||"O")} (O)</small></p>
    <div class="xo-grid">${board.map((v,i)=>`<button class="xo-cell ${v==="O"?"o":""}" data-cell="${i}" ${v\vert{}\vert{}s.winner\vert{}\vert{}entries.length<2\vert{}\vert{}s.turn!==state.uid?"disabled":""}>${v}</button>`).join("")}</div>
    ${s.winner?'<button class="secondary-btn" id="restartGame">العب جولة جديدة</button>':""}
  `;
  $$("[data-cell]").forEach(b=>b.addEventListener("click",()=>playXO(Number(b.dataset.cell),myMark)));
  $("#restartGame")?.addEventListener("click",restartXO);
}

function winnerFor(board) {
  const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for(const line of lines){const [a,b,c]=line;if(board[a]&&board[a]===board[b]&&board[a]===board[c])return board[a];}
  return board.every(Boolean)?"draw":"";
}

async function playXO(i,mark) {
  if(!state.firebase){
    if(state.localBoard[i])return;
    state.localBoard[i]=state.localTurn;
    const w=winnerFor(state.localBoard);
    state.room.state={board:[...state.localBoard],turn:state.localTurn==="X"?"O":"X",winner:w};
    state.localTurn=state.localTurn==="X"?"O":"X";
    drawXO();
    return;
  }
  const {ref,runTransaction}=state.dbApi;
  await runTransaction(ref(state.db, `rooms/${state.roomId}/state`), s => {
    if(!s||s.winner||s.turn!==state.uid||s.board[i])return;
    const board=[...(s.board||Array(9).fill(""))]; 
    const mark=currentPlayerEntries().findIndex(([uid])=>uid===state.uid)===0?"X":"O";
    board[i]=mark;
    const winner=winnerFor(board);
    return {...s,board,winner,turn:s.turn,moves:(s.moves||0)+1,nextUid:currentPlayerEntries().find(([uid])=>uid!==state.uid)?.[0]||state.uid};
  }).then(async result => {
    if(result.committed){
      const s=result.snapshot.val();
      if(!s.winner){
        const next=s.nextUid;
        await (await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js")).update(ref(state.db, `rooms/${state.roomId}/state`),{turn:next});
      }
    }
  });
}

async function restartXO() {
  if(!state.firebase){state.localBoard=Array(9).fill("");state.localTurn="X";state.room.state={board:state.localBoard,turn:"X",winner:""};drawXO();return;}
  if(state.room.hostUid!==state.uid)return toast("صاحب الغرفة بس يقدر يبدأ جولة جديدة.");
  const {ref,update}=state.dbApi;
  const entries=currentPlayerEntries();
  await update(ref(state.db, `rooms/${state.roomId}/state`),{board:Array(9).fill(""),turn:entries[0]?.[0]||state.uid,winner:"",moves:0});
}

function drawRPS() {
  const s=state.room.state||{}, choices=s.choices||{}, scores=s.scores||{};
  const my=choices[state.uid]; const entries=currentPlayerEntries();
  const opponent=entries.find(([id])=>id!==state.uid);
  const oppChoice=opponent&&choices[opponent[0]];
  
  $("#gameContent").innerHTML = `
    <p class="game-message">${entries.length<2?"مستنيين لاعب تاني يدخل...":my?(oppChoice?"الجولة خلصت!":"اختيارك اتسجل، مستني صاحبك..."):"اختار حجر أو ورقة أو مقص"}</p>
    <div class="choice-row">${[["rock","✊","حجر"],["paper","✋","ورقة"],["scissors","✌️","مقص"]].map(([v,e,t])=>`<button class="choice-btn" data-rps="${v}" aria-label="${t}" ${entries.length<2\vert{}\vert{}my?"disabled":""}>${e}</button>`).join("")}</div>
    <div class="score-row"><span class="score-chip">أنت: ${scores[state.uid]||0}</span><span class="score-chip">الخصم: ${opponent?(scores[opponent[0]]||0):0}</span></div>
    ${my&&oppChoice?`<p class="game-message">اختيارك ${({rock:"حجر",paper:"ورقة",scissors:"مقص"})[my]} — اختيار الخصم ${({rock:"حجر",paper:"ورقة",scissors:"مقص"})[oppChoice]}<br><button class="secondary-btn" id="nextRps">الجولة التالية</button></p>`:""}
  `;
  $$("[data-rps]").forEach(b=>b.addEventListener("click",()=>playRPS(b.dataset.rps)));
  $("#nextRps")?.addEventListener("click",nextRPS);
}

async function playRPS(choice) {
  if(!state.firebase){toast("حجر ورقة مقص في الوضع التجريبي: اختار حركة وشوف واجهة اللعبة.");return;}
  const {ref,runTransaction}=state.dbApi;
  await runTransaction(ref(state.db, `rooms/${state.roomId}/state/choices`), choices => {
    choices=choices||{}; if(choices[state.uid])return; choices[state.uid]=choice; return choices;
  });
  const snap=await state.dbApi.get(ref(state.db, `rooms/${state.roomId}/state`));
  const s=snap.val(), entries=currentPlayerEntries();
  if(entries.length>=2&&entries.every(([id])=>s.choices?.[id])){
    const [a,b]=entries.map(([id])=>s.choices[id]); let winner=null;
    if(a!==b)winner=({rock:"scissors",paper:"rock",scissors:"paper"})[a]===b?entries[0][0]:entries[1][0];
    const scores={...(s.scores||{})}; if(winner)scores[winner]=(scores[winner]||0)+1;
    await state.dbApi.update(ref(state.db, `rooms/${state.roomId}/state`),{scores});
  }
}

async function nextRPS() {
  if(!state.firebase)return;
  const {ref,update,remove}=state.dbApi;
  await remove(ref(state.db, `rooms/${state.roomId}/state/choices`));
  const snap=await state.dbApi.get(ref(state.db, `rooms/${state.roomId}/state/round`));
  await update(ref(state.db, `rooms/${state.roomId}/state`),{round:(snap.val()||1)+1});
}

function drawGuess() {
  const s=state.room.state||{}, guesses=s.guesses||[];
  const last=guesses.slice(-5).reverse();
  
  $("#gameContent").innerHTML = `
    <p class="game-message">خمن رقم من 1 لـ 20. أول لاعب يوصل للرقم يكسب!</p>
    <div class="guess-number">?</div>
    <form id="guessForm" class="guess-form"><input id="guessInput" type="number" min="1" max="20" placeholder="رقم من 1 لـ 20" required><button>خمن</button></form>
    <div class="game-message">${s.winner?`الفائز: ${safeText(s.winnerName||"لاعب")}`:last.map(g=>`${safeText(g.name)}:${safeText(g.hint)}`).join(" • ")||"ابدأ أول محاولة!"}</div>
    ${s.winner?'<button class="secondary-btn" id="newGuess">جولة جديدة</button>':""}
  `;
  $("#guessForm")?.addEventListener("submit",submitGuess);
  $("#newGuess")?.addEventListener("click",resetGuess);
}

async function submitGuess(e) {
  e.preventDefault(); const n=Number($("#guessInput").value); if(n<1||n>20)return toast("اكتب رقم من 1 لـ 20");
  if(!state.firebase){
    state.guesses++;
    let hint=n===state.guessTarget?"صح! كسبت 🎉":n<state.guessTarget?"أكبر من كده":"أصغر من كده";
    $("#gameContent").querySelector(".game-message").textContent=hint;
    return;
  }
  const {ref,runTransaction}=state.dbApi;
  await runTransaction(ref(state.db, `rooms/${state.roomId}/state`), s => {
    if(!s||s.winner)return;
    const hint=n===s.target?"صح!":n<s.target?"أكبر من كده":"أصغر من كده";
    const guesses=[...(s.guesses||[]),{uid:state.uid,name:state.name,n,hint,at:Date.now()}];
    return {...s,guesses,winner:n===s.target?state.uid:"",winnerName:n===s.target?state.name:""};
  });
}

async function resetGuess() {
  if(!state.firebase){state.guesses=0;state.guessTarget=Math.floor(Math.random()*20)+1;state.room.state={target:state.guessTarget,guesses:[],winner:""};drawGuess();return;}
  if(state.room.hostUid!==state.uid)return toast("صاحب الغرفة بس يقدر يبدأ جولة جديدة.");
  const {ref,update}=state.dbApi;
  await update(ref(state.db, `rooms/${state.roomId}/state`),{target:Math.floor(Math.random()*20)+1,guesses:[],winner:"",winnerName:""});
}

async function sendChat(text) {
  if(!text.trim())return;
  if(!state.firebase){
    const root=$("#chatMessages");
    root.innerHTML+=`<div class="chat-line"><b>${safeText(state.name)}:</b> ${safeText(text)}</div>`;
    root.scrollTop=root.scrollHeight;
    return;
  }
  try {
    const {ref,push,set}=state.dbApi;
    const r=push(ref(state.db, `rooms/${state.roomId}/chat`));
    await set(r,{name:state.name,uid:state.uid,text:text.trim(),at:Date.now()});
  } catch(e){toast("تعذر إرسال الرسالة.");}
}

function leaveRoom() {
  if(state.unsubRoom){state.unsubRoom();state.unsubRoom=null;}
  if(state.unsubChat){state.unsubChat();state.unsubChat=null;}
  state.roomId=null;state.room=null;state.game=null;closeModal("gameModal");
}

$("#nameForm").addEventListener("submit",e=>{e.preventDefault();const name=$("#nameInput").value.trim().slice(0,18);if(!name)return;state.name=name;localStorage.setItem("arcade_name",name);renderName();closeModal("nameModal");});
$("#editNameBtn").addEventListener("click",()=>{$("#nameInput").value=state.name;openModal("nameModal");});  $$("[data-close]").forEach(b=>b.addEventListener("click",()=>closeModal(b.dataset.close)));
$$(".modal-backdrop").forEach(m=>m.addEventListener("click",e=>{if(e.target===m){if(m.id==="gameModal")leaveRoom();else closeModal(m.id);}})); $$
("[data-game]").forEach(b=>b.addEventListener("click",()=>createRoom(b.dataset.game)));
$("#chatForm").addEventListener("submit",e=>{e.preventDefault();const input=$("#chatInput");sendChat(input.value);input.value="";});
$("#copyRoomBtn").addEventListener("click",async()=>{const code=state.roomId;if(!code)return;try{await navigator.clipboard.writeText(code);toast("تم نسخ كود الغرفة");}catch{toast("كود الغرفة: "+code);}});
$("#refreshRooms").addEventListener("click",()=>state.firebase?toast("قائمة الغرف بتتحدث تلقائيًا."):toast("فعّل Firebase عشان تظهر الغرف العامة."));
window.addEventListener("keydown",e=>{if(e.key==="Escape"&&$("#gameModal").classList.contains("open"))leaveRoom();});

renderName();
if(!state.name){$("#nameInput").value="";openModal("nameModal");}
initFirebase();
