
import { firebaseConfig, firebaseReady } from "./firebase-config.js";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const state = {
  name: localStorage.getItem("arcade_name") || "",
  uid: localStorage.getItem("arcade_uid") || crypto.randomUUID(),
  game: null,
  roomId: null,
  room: null,
  unsubRoom: null,
  unsubChat: null,
  db: null,
  auth: null,
  dbApi: null,
  firebase: false,
  localTurn: "X",
  localBoard: Array(9).fill(""),
  guessTarget: Math.floor(Math.random() * 20) + 1,
  guesses: 0,
  localRpsChoice: null,
  localRpsScore: { me: 0, opponent: 0 }
};

localStorage.setItem("arcade_uid", state.uid);

function toast(message) {
  const el = $("#toast");
  if (!el) {
    alert(message);
    return;
  }
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 2600);
}

function safeText(value = "") {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}

function renderName() {
  if ($("#playerName")) {
    $("#playerName").textContent = state.name || "Player";
  }
  if ($("#avatar")) {
    $("#avatar").textContent =
      (state.name || "P").trim().charAt(0).toUpperCase();
  }
}

function openModal(id) {
  $("#" + id)?.classList.add("open");
}

function closeModal(id) {
  $("#" + id)?.classList.remove("open");
}

function setupGameModal(local) {
  $("#gameModal")?.classList.add("open");

  const titles = {
    xo: "إكس أو",
    rps: "حجر ورقة مقص",
    guess: "تخمين الرقم"
  };

  if ($("#gameTitle")) $("#gameTitle").textContent = titles[state.game] || "لعبة";
  if ($("#roomCode")) {
    $("#roomCode").textContent =
      local ? "تجريبي" : (state.roomId || "").slice(-6).toUpperCase();
  }
  if ($("#roomStatus")) {
    $("#roomStatus").textContent = local
      ? "وضع تجريبي على نفس الجهاز"
      : "تم إنشاء الغرفة";
  }
  if ($("#demoNote")) {
    $("#demoNote").textContent = local
      ? "الوضع التجريبي: العب من نفس الجهاز."
      : "أنت متصل بالغرفة أونلاين.";
  }
  if ($("#chatMessages")) {
    $("#chatMessages").innerHTML =
      '<p class="empty-notice">رسائل الغرفة هتظهر هنا.</p>';
  }

  drawGame();
}

async function initFirebase() {
  if (!firebaseReady) {
    setDemoStatus();
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
    state.dbApi = dbMod;

    const credential = await authMod.signInAnonymously(state.auth);
    state.uid = credential.user.uid;
    localStorage.setItem("arcade_uid", state.uid);
    state.firebase = true;

    if ($("#connectionLabel")) {
      $("#connectionLabel").textContent = "متصل أونلاين";
    }
    if ($("#firebaseStatus")) {
      $("#firebaseStatus").textContent = "متصل";
    }
    if ($("#lobbyHint")) {
      $("#lobbyHint").textContent =
        "اختار لعبة لإنشاء غرفة، أو ادخل غرفة من القائمة.";
    }

    subscribeRooms();
    subscribePresence();
  } catch (err) {
    console.error("Firebase error:", err);
    state.firebase = false;
    setDemoStatus();
    toast("تعذر الاتصال أونلاين. تقدر تجرب الألعاب محليًا.");
  }
}

function setDemoStatus() {
  if ($("#connectionLabel")) {
    $("#connectionLabel").textContent = "وضع تجريبي";
  }
  if ($("#firebaseStatus")) {
    $("#firebaseStatus").textContent = "وضع تجريبي";
  }
  if ($("#lobbyHint")) {
    $("#lobbyHint").textContent =
      "اختار أي لعبة لتجربتها على نفس الجهاز.";
  }
}

function subscribeRooms() {
  if (!state.firebase || !state.dbApi) return;

  const { ref, onValue, query, orderByChild, limitToLast } = state.dbApi;
  const roomsQuery = query(
    ref(state.db, "rooms"),
    orderByChild("updatedAt"),
    limitToLast(30)
  );

  onValue(roomsQuery, (snap) => {
    const rooms = [];

    snap.forEach((child) => {
      const room = child.val();
      if (
        room &&
        room.status !== "closed" &&
        Date.now() - (room.updatedAt || 0) < 36000000
      ) {
        rooms.push({ id: child.key, ...room });
      }
    });

    rooms.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    if ($("#onlineCount")) {
      $("#onlineCount").textContent = `${rooms.length} غرفة نشطة`;
    }
    renderRooms(rooms);
  }, (err) => {
    console.error("Room list error:", err);
  });
}

function renderRooms(rooms) {
  const root = $("#roomsList");
  if (!root) return;

  if (!rooms.length) {
    root.innerHTML =
      '<p class="empty-notice">مفيش غرف نشطة دلوقتي. اختار لعبة وأنشئ أول غرفة!</p>';
    return;
  }

  const icons = { xo: "❌", rps: "✊", guess: "🔢" };
  const titles = {
    xo: "إكس أو",
    rps: "حجر ورقة مقص",
    guess: "تخمين الرقم"
  };

  root.innerHTML = rooms.map((room) => `
    <div class="room-item">
      <span class="room-emoji">${icons[room.game] || "🎮"}</span>
      <div>
        <strong>${safeText(room.title || titles[room.game] || "غرفة لعب")}</strong>
        <small>${safeText(room.hostName || "لاعب")} • ${safeText(Object.keys(room.players || {}).length || room.playersCount || 1)} / ${{xo:2,rps:4,guess:4}[room.game] || 4} لاعب</small>
      </div>
      <button data-join="${safeText(room.id)}">دخول</button>
    </div>
  `).join("");

  $$("[data-join]").forEach((button) => {
    button.addEventListener("click", () => joinRoom(button.dataset.join));
  });
}

async function createRoom(game) {
  if (!state.name) {
    openModal("nameModal");
    toast("اكتب اسمك الأول");
    return;
  }

  if (!["xo", "rps", "guess"].includes(game)) {
    toast("اللعبة دي مش موجودة.");
    return;
  }

  state.game = game;
  state.localBoard = Array(9).fill("");
  state.localTurn = "X";
  state.guessTarget = Math.floor(Math.random() * 20) + 1;
  state.guesses = 0;
  state.localRpsChoice = null;
  state.localRpsScore = { me: 0, opponent: 0 };

  // الوضع التجريبي يفتح اللعبة من غير الحاجة إلى Firebase.
  if (!state.firebase) {
    state.roomId = "LOCAL";
    state.room = {
      game,
      hostUid: state.uid,
      hostName: state.name,
      players: {
        [state.uid]: { name: state.name, joinedAt: Date.now() }
      },
      state: game === "xo"
        ? { board: Array(9).fill(""), turn: "X", winner: "" }
        : game === "rps"
          ? { choices: {}, scores: {} }
          : { guesses: [], winner: "" }
    };

    setupGameModal(true);
    return;
  }

  try {
    const { ref, push, set } = state.dbApi;
    const newRef = push(ref(state.db, "rooms"));
    state.roomId = newRef.key;

    const initialState = game === "xo"
      ? { board: Array(9).fill(""), turn: state.uid, winner: "", moves: 0 }
      : game === "rps"
        ? { round: 1, choices: {}, scores: {} }
        : {
            target: Math.floor(Math.random() * 20) + 1,
            guesses: [],
            winner: ""
          };

    const room = {
      game,
      title: ({ xo: "إكس أو", rps: "حجر ورقة مقص", guess: "تخمين الرقم" })[game],
      hostUid: state.uid,
      hostName: state.name,
      status: "open",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      players: {
        [state.uid]: { name: state.name, joinedAt: Date.now() }
      },
      state: initialState,
      playersCount: 1
    };

    await set(newRef, room);
    state.room = room;
    setupGameModal(false);
    watchRoom();
  } catch (err) {
    console.error("Create room error:", err);
    toast("تعذر إنشاء الغرفة. راجع قواعد Firebase.");
  }
}

async function joinRoom(id) {
  if (!state.name) {
    openModal("nameModal");
    toast("اكتب اسمك الأول");
    return;
  }

  if (!state.firebase) {
    toast("دخول الغرف أونلاين يحتاج اتصال Firebase.");
    return;
  }

  try {
    const { ref, get, update } = state.dbApi;
    const roomRef = ref(state.db, `rooms/${id}`);
    const snap = await get(roomRef);

    if (!snap.exists()) {
      toast("الغرفة مش موجودة.");
      return;
    }

    const room = snap.val();
    const players = room.players || {};
    const alreadyJoined = Boolean(players[state.uid]);

    const maxPlayers = ({ xo: 2, rps: 4, guess: 4 })[room.game] || 4;
    if (Object.keys(players).length >= maxPlayers && !alreadyJoined) {
      toast("الغرفة دي مكتملة.");
      return;
    }

    await update(ref(state.db, `rooms/${id}/players/${state.uid}`), {
      name: state.name,
      joinedAt: Date.now()
    });

    state.game = room.game;
    state.roomId = id;
    state.room = room;
    setupGameModal(false);
    watchRoom();
  } catch (err) {
    console.error("Join room error:", err);
    toast("تعذر دخول الغرفة. راجع قواعد Firebase.");
  }
}

async function joinByCode() {
  const input = $("#joinCodeInput");
  const code = (input?.value || "").trim();
  if (!code) { toast("اكتب كود الغرفة الأول."); return; }
  if (!state.firebase) { toast("الدخول بالكود يحتاج اتصال أونلاين."); return; }
  const { ref, get } = state.dbApi;
  try {
    const snap = await get(ref(state.db, "rooms"));
    if (!snap.exists()) { toast("مفيش غرف متاحة."); return; }
    let found = null;
    snap.forEach(child => {
      if (child.key === code || child.key.slice(-6).toUpperCase() === code.toUpperCase()) found = child.key;
    });
    if (!found) { toast("الكود مش صحيح أو الغرفة مش موجودة."); return; }
    await joinRoom(found);
    if (input) input.value = "";
  } catch (err) { console.error(err); toast("تعذر البحث عن الغرفة."); }
}

function subscribePresence() {
  if (!state.firebase || !state.dbApi) return;
  const { ref, onValue, set, onDisconnect, remove } = state.dbApi;
  const me = ref(state.db, `presence/${state.uid}`);
  set(me, { uid: state.uid, name: state.name || "لاعب", online: true, at: Date.now() }).catch(console.error);
  onDisconnect(me).remove().catch(console.error);
  onValue(ref(state.db, "presence"), snap => {
    const users = [];
    snap.forEach(child => {
      const u = child.val();
      if (child.key !== state.uid && u?.online && true) users.push({ ...u, uid: child.key });
    });
    const root = $("#onlinePlayersList");
    if (!root) return;
    root.innerHTML = users.length ? users.map(u => `
      <div class="room-item"><span class="room-emoji">🟢</span><div><strong>${safeText(u.name || "لاعب")}</strong><small>متصل الآن</small></div><button data-invite="${safeText(u.uid)}">دعوة</button></div>
    `).join("") : '<p class="empty-notice">مفيش أصحاب متصلين دلوقتي.</p>';
    $("[data-invite]").forEach(btn => btn.addEventListener("click", () => sendInvite(btn.dataset.invite)));
  });
  onValue(ref(state.db, `invites/${state.uid}`), snap => {
    const invite = snap.val();
    if (!invite || !invite.roomId || invite.status !== "pending") return;
    if ($("#inviteNotice")) {
      $("#inviteNotice").innerHTML = `<div class="invite-box"><span>🎮 ${safeText(invite.fromName || "لاعب")} بيدعوك للعب ${safeText(invite.gameTitle || "لعبة")}</span><div><button id="acceptInvite">قبول</button><button id="rejectInvite">رفض</button></div></div>`;
      $("#acceptInvite")?.addEventListener("click", async () => { await remove(ref(state.db, `invites/${state.uid}`)); joinRoom(invite.roomId); });
      $("#rejectInvite")?.addEventListener("click", async () => { await remove(ref(state.db, `invites/${state.uid}`)); $("#inviteNotice").innerHTML = ""; });
    }
  });
}

async async function sendInvite(targetUid) {
  if (!state.firebase) { toast("الدعوات تحتاج اتصال أونلاين."); return; }
  if (!state.roomId || !state.room) { toast("افتح غرفة الأول وبعدين ابعت الدعوة."); return; }
  const titles = { xo: "إكس أو", rps: "حجر ورقة مقص", guess: "تخمين الرقم" };
  try {
    const { ref, set } = state.dbApi;
    await set(ref(state.db, `invites/${targetUid}`), {
      fromUid: state.uid, fromName: state.name, roomId: state.roomId,
      gameTitle: titles[state.game] || "لعبة", status: "pending", at: Date.now()
    });
    toast("اتبعثت الدعوة!");
  } catch (err) { console.error(err); toast("تعذر إرسال الدعوة."); }
}

function watchRoom() {
  if (!state.firebase || !state.roomId) return;

  const { ref, onValue, onDisconnect } = state.dbApi;

  if (typeof state.unsubRoom === "function") state.unsubRoom();

  state.unsubRoom = onValue(
    ref(state.db, `rooms/${state.roomId}`),
    (snap) => {
      if (!snap.exists()) {
        toast("الغرفة اتقفلت.");
        closeModal("gameModal");
        return;
      }

      state.room = { id: state.roomId, ...snap.val() };

      const players = Object.values(state.room.players || {});
      if ($("#roomStatus")) {
        $("#roomStatus").textContent =
          players.map((player) => player.name).join(" • ") ||
          "في انتظار اللاعبين";
      }
      if ($("#demoNote")) {
        $("#demoNote").textContent = "أنت متصل بالغرفة أونلاين.";
      }

      drawGame();
    },
    (err) => console.error("Watch room error:", err)
  );

  onDisconnect(
    ref(state.db, `rooms/${state.roomId}/players/${state.uid}`)
  ).remove().catch(console.error);

  if (typeof state.unsubChat === "function") state.unsubChat();

  state.unsubChat = onValue(
    ref(state.db, `rooms/${state.roomId}/chat`),
    (snap) => {
      const messages = [];
      snap.forEach((child) => messages.push(child.val()));

      if (!$("#chatMessages")) return;

      $("#chatMessages").innerHTML = messages.slice(-40).map((message) => `
        <div class="chat-line">
          <b>${safeText(message.name || "لاعب")}:</b>
          ${safeText(message.text || "")}
        </div>
      `).join("") || '<p class="empty-notice">مفيش رسائل لسه.</p>';

      $("#chatMessages").scrollTop = $("#chatMessages").scrollHeight;
    }
  );
}

function currentPlayerEntries() {
  return Object.entries(state.room?.players || {});
}

function drawGame() {
  if (!state.room) return;

  if (state.game === "xo") drawXO();
  if (state.game === "rps") drawRPS();
  if (state.game === "guess") drawGuess();
}

function winnerFor(board) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }

  return board.every(Boolean) ? "draw" : "";
}

function drawXO() {
  const room = state.room;
  const gameState = room.state || {};
  const board = gameState.board || Array(9).fill("");
  const entries = currentPlayerEntries();
  const local = !state.firebase;

  const myMark = local
    ? state.localTurn
    : (entries.findIndex(([uid]) => uid === state.uid) === 0 ? "X" : "O");

  const players = entries.map(([, player]) => player.name);
  const winner = gameState.winner || "";

  let status;

  if (winner) {
    status = winner === "draw"
      ? "تعادل!"
      : `الفائز: ${winner === "X" ? safeText(players[0] || "X") : safeText(players[1] || "O")}`;
  } else if (!local && entries.length < 2) {
    status = "مستنيين لاعب تاني يدخل...";
  } else {
    status = local
      ? `دور اللاعب ${state.localTurn}`
      : (gameState.turn === state.uid ? "دورك!" : "مستني دورك");
  }

  $("#gameContent").innerHTML = `
    <p class="game-message">
      ${status}<br>
      <small>${safeText(players[0] || "اللاعب الأول")} (X) ضد
      ${safeText(players[1] || (local ? "اللاعب الثاني" : "اللاعب الثاني"))} (O)</small>
    </p>
    <div class="xo-grid">
      ${board.map((value, index) => `
        <button class="xo-cell ${value === "O" ? "o" : ""}"
          data-cell="${index}"
          ${(value || winner || (!local && (entries.length < 2 || gameState.turn !== state.uid))) ? "disabled" : ""}>
          ${safeText(value)}
        </button>
      `).join("")}
    </div>
    ${winner ? '<button class="secondary-btn" id="restartGame">العب جولة جديدة</button>' : ""}
  `;

  $$("[data-cell]").forEach((button) => {
    button.addEventListener("click", () => playXO(Number(button.dataset.cell), myMark));
  });

  $("#restartGame")?.addEventListener("click", restartXO);
}

async function playXO(index) {
  if (!state.firebase) {
    if (state.localBoard[index] || winnerFor(state.localBoard)) return;

    state.localBoard[index] = state.localTurn;
    const winner = winnerFor(state.localBoard);
    state.localTurn = state.localTurn === "X" ? "O" : "X";

    state.room.state = {
      board: [...state.localBoard],
      turn: state.localTurn,
      winner
    };

    drawXO();
    return;
  }

  try {
    const { ref, runTransaction } = state.dbApi;

    await runTransaction(ref(state.db, `rooms/${state.roomId}/state`), (s) => {
      if (!s || s.winner || s.turn !== state.uid || s.board?.[index]) {
        return;
      }

      const entries = currentPlayerEntries();
      const mark = entries.findIndex(([uid]) => uid === state.uid) === 0 ? "X" : "O";
      const board = [...(s.board || Array(9).fill(""))];

      board[index] = mark;

      const winner = winnerFor(board);
      const opponent = entries.find(([uid]) => uid !== state.uid)?.[0];

      return {
        ...s,
        board,
        winner,
        turn: winner ? s.turn : (opponent || state.uid),
        moves: (s.moves || 0) + 1
      };
    });
  } catch (err) {
    console.error(err);
    toast("تعذر تسجيل الحركة.");
  }
}

async function restartXO() {
  if (!state.firebase) {
    state.localBoard = Array(9).fill("");
    state.localTurn = "X";
    state.room.state = {
      board: [...state.localBoard],
      turn: "X",
      winner: ""
    };
    drawXO();
    return;
  }

  if (state.room.hostUid !== state.uid) {
    toast("صاحب الغرفة بس يقدر يبدأ جولة جديدة.");
    return;
  }

  const { ref, update } = state.dbApi;
  const entries = currentPlayerEntries();

  await update(ref(state.db, `rooms/${state.roomId}/state`), {
    board: Array(9).fill(""),
    turn: entries[0]?.[0] || state.uid,
    winner: "",
    moves: 0
  });
}

function drawRPS() {
  const gameState = state.room.state || {};
  const choices = gameState.choices || {};
  const scores = state.firebase ? (gameState.scores || {}) : state.localRpsScore;
  const entries = currentPlayerEntries();
  const mine = choices[state.uid];
  const allChosen = entries.length >= 2 && entries.every(([uid]) => choices[uid]);
  const labels = { rock: "حجر", paper: "ورقة", scissors: "مقص" };
  const scoreText = entries.map(([uid, player]) => `${safeText(player.name || "لاعب")}: ${scores[uid] ?? (uid === state.uid ? scores.me : 0) ?? 0}`).join(" • ");

  $("#gameContent").innerHTML = `
    <p class="game-message">
      ${state.firebase
        ? (entries.length < 2 ? "مستنيين لاعبين يدخلوا..." : allChosen ? "الجولة خلصت!" : mine ? "اختيارك اتسجل، مستني باقي اللاعبين..." : "اختار حجر أو ورقة أو مقص")}
        : (state.localRpsChoice ? "اضغط الجولة التالية للعب مرة أخرى." : "اختار حركتك والخصم هيلعب تلقائيًا.")}
    </p>
    <div class="choice-row">
      ${[["rock", "✊", "حجر"], ["paper", "✋", "ورقة"], ["scissors", "✌️", "مقص"]]
        .map(([value, emoji, label]) => `
          <button class="choice-btn" data-rps="${value}" aria-label="${label}"
            ${(state.firebase && (entries.length < 2 || mine)) || (!state.firebase && state.localRpsChoice) ? "disabled" : ""}>
            ${emoji}
          </button>`).join("")}
    </div>
    <div class="score-row"><span class="score-chip">${scoreText || "النقاط هتظهر هنا"}</span></div>
    ${state.firebase && allChosen ? `
      <div class="game-message">${entries.map(([uid, player]) => `${safeText(player.name || "لاعب")}: ${labels[choices[uid]] || "—"}`).join(" • ")}</div>
      ${state.room.hostUid === state.uid ? '<button class="secondary-btn" id="nextRps">الجولة التالية</button>' : '<p class="game-message">مستني صاحب الغرفة يبدأ الجولة التالية.</p>'}
    ` : ""}
    ${!state.firebase && state.localRpsChoice ? `
      <p class="game-message">${safeText(state.localRpsResult || "")}</p>
      <button class="secondary-btn" id="nextRps">الجولة التالية</button>` : ""}
  `;
  $$("[data-rps]").forEach(button => button.addEventListener("click", () => playRPS(button.dataset.rps)));
  $("#nextRps")?.addEventListener("click", nextRPS);
}

async function playRPS(choice) {
  if (!["rock", "paper", "scissors"].includes(choice)) return;
  if (!state.firebase) {
    const options = ["rock", "paper", "scissors"];
    const opponent = options[Math.floor(Math.random() * options.length)];
    state.localRpsChoice = choice;
    if (choice === opponent) state.localRpsResult = `تعادل! أنت والخصم اخترتم ${choice}.`;
    else if (({ rock: "scissors", paper: "rock", scissors: "paper" })[choice] === opponent) {
      state.localRpsScore.me++;
      state.localRpsResult = "كسبت الجولة! 🎉";
    } else {
      state.localRpsScore.opponent++;
      state.localRpsResult = "الخصم كسب الجولة. جرّب تاني!";
    }
    drawRPS();
    return;
  }
  try {
    const { ref, runTransaction, get, update } = state.dbApi;
    await runTransaction(ref(state.db, `rooms/${state.roomId}/state/choices`), choices => {
      choices = choices || {};
      if (choices[state.uid]) return;
      choices[state.uid] = choice;
      return choices;
    });
    const snap = await get(ref(state.db, `rooms/${state.roomId}/state`));
    const gameState = snap.val() || {};
    const entries = currentPlayerEntries();
    if (entries.length >= 2 && entries.every(([uid]) => gameState.choices?.[uid])) {
      const scores = { ...(gameState.scores || {}) };
      const beats = { rock: "scissors", paper: "rock", scissors: "paper" };
      for (const [uid, picked] of entries) {
        let points = 0;
        for (const [otherUid, otherPick] of entries) {
          if (uid !== otherUid && beats[picked] === otherPick) points++;
        }
        if (points) scores[uid] = (scores[uid] || 0) + points;
      }
      await update(ref(state.db, `rooms/${state.roomId}/state`), { scores });
    }
  } catch (err) {
    console.error(err);
    toast("تعذر تسجيل الاختيار.");
  }
}

async async function nextRPS() {
  if (!state.firebase) {
    state.localRpsChoice = null;
    state.localRpsResult = "";
    drawRPS();
    return;
  }

  try {
    const { ref, update, remove, get } = state.dbApi;

    if (state.room.hostUid !== state.uid) { toast("صاحب الغرفة بس يبدأ الجولة التالية."); return; }
    await remove(ref(state.db, `rooms/${state.roomId}/state/choices`));

    const snap = await get(ref(state.db, `rooms/${state.roomId}/state/round`));
    await update(ref(state.db, `rooms/${state.roomId}/state`), {
      round: (snap.val() || 1) + 1
    });
  } catch (err) {
    console.error(err);
    toast("تعذر بدء الجولة التالية.");
  }
}

function drawGuess() {
  const gameState = state.room.state || {};
  const guesses = gameState.guesses || [];
  const last = guesses.slice(-5).reverse();

  $("#gameContent").innerHTML = `
    <p class="game-message">خمن رقم من 1 لـ 20. أول لاعب يوصل للرقم يكسب!</p>
    <div class="guess-number">?</div>

    ${gameState.winner ? "" : `
      <form id="guessForm" class="guess-form">
        <input id="guessInput" type="number" min="1" max="20"
          placeholder="رقم من 1 لـ 20" required>
        <button type="submit">خمن</button>
      </form>
    `}

    <div class="game-message" id="guessResult">
      ${gameState.winner
        ? `الفائز: ${safeText(gameState.winnerName || "لاعب")}`
        : last.map((g) => `${safeText(g.name)}: ${safeText(g.hint)}`).join(" • ") || "ابدأ أول محاولة!"}
    </div>

    ${gameState.winner ? '<button class="secondary-btn" id="newGuess">جولة جديدة</button>' : ""}
  `;

  $("#guessForm")?.addEventListener("submit", submitGuess);
  $("#newGuess")?.addEventListener("click", resetGuess);
}

async function submitGuess(event) {
  event.preventDefault();

  const input = $("#guessInput");
  const number = Number(input?.value);

  if (!Number.isInteger(number) || number < 1 || number > 20) {
    toast("اكتب رقم صحيح من 1 لـ 20");
    return;
  }

  if (!state.firebase) {
    state.guesses++;

    const hint = number === state.guessTarget
      ? "صح! كسبت 🎉"
      : number < state.guessTarget
        ? "الرقم أكبر من كده"
        : "الرقم أصغر من كده";

    const result = $("#guessResult");
    if (result) result.textContent = hint;

    if (number === state.guessTarget) {
      state.room.state.winner = state.name;
      state.room.state.winnerName = state.name;
      drawGuess();
    }

    return;
  }

  try {
    const { ref, runTransaction } = state.dbApi;

    await runTransaction(ref(state.db, `rooms/${state.roomId}/state`), (s) => {
      if (!s || s.winner) return;

      const hint = number === s.target
        ? "صح!"
        : number < s.target
          ? "أكبر من كده"
          : "أصغر من كده";

      const guesses = [
        ...(s.guesses || []),
        {
          uid: state.uid,
          name: state.name,
          n: number,
          hint,
          at: Date.now()
        }
      ];

      return {
        ...s,
        guesses,
        winner: number === s.target ? state.uid : "",
        winnerName: number === s.target ? state.name : ""
      };
    });
  } catch (err) {
    console.error(err);
    toast("تعذر تسجيل التخمين.");
  }
}

async function resetGuess() {
  if (!state.firebase) {
    state.guesses = 0;
    state.guessTarget = Math.floor(Math.random() * 20) + 1;
    state.room.state = { guesses: [], winner: "", winnerName: "" };
    drawGuess();
    return;
  }

  if (state.room.hostUid !== state.uid) {
    toast("صاحب الغرفة بس يقدر يبدأ جولة جديدة.");
    return;
  }

  try {
    const { ref, update } = state.dbApi;
    await update(ref(state.db, `rooms/${state.roomId}/state`), {
      target: Math.floor(Math.random() * 20) + 1,
      guesses: [],
      winner: "",
      winnerName: ""
    });
  } catch (err) {
    console.error(err);
    toast("تعذر بدء جولة جديدة.");
  }
}

async function sendChat(message) {
  const text = String(message || "").trim();
  if (!text) return;

  if (!state.firebase) {
    const root = $("#chatMessages");
    if (root) {
      root.innerHTML += `
        <div class="chat-line">
          <b>${safeText(state.name)}:</b> ${safeText(text)}
        </div>
      `;
      root.scrollTop = root.scrollHeight;
    }
    return;
  }

  if (!state.roomId) {
    toast("افتح غرفة الأول.");
    return;
  }

  try {
    const { ref, push, set } = state.dbApi;
    const messageRef = push(ref(state.db, `rooms/${state.roomId}/chat`));

    await set(messageRef, {
      name: state.name,
      uid: state.uid,
      text,
      at: Date.now()
    });
  } catch (err) {
    console.error(err);
    toast("تعذر إرسال الرسالة.");
  }
}

function leaveRoom() {
  if (typeof state.unsubRoom === "function") state.unsubRoom();
  if (typeof state.unsubChat === "function") state.unsubChat();

  state.unsubRoom = null;
  state.unsubChat = null;
  state.roomId = null;
  state.room = null;
  state.game = null;

  closeModal("gameModal");
}

$("#nameForm")?.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = ($("#nameInput")?.value || "").trim().slice(0, 18);
  if (!name) {
    toast("اكتب اسمك الأول.");
    return;
  }

  state.name = name;
  localStorage.setItem("arcade_name", name);
  renderName();
  if (state.firebase && state.dbApi) state.dbApi.set(state.dbApi.ref(state.db, `presence/${state.uid}`), { uid: state.uid, name, online: true, at: Date.now() }).catch(console.error);
  closeModal("nameModal");
});

$("#editNameBtn")?.addEventListener("click", () => {
  if ($("#nameInput")) $("#nameInput").value = state.name;
  openModal("nameModal");
});

$$("[data-close]").forEach((button) => {
  button.addEventListener("click", () => closeModal(button.dataset.close));
});

$$(".modal-backdrop").forEach((modal) => {
  modal.addEventListener("click", (event) => {
    if (event.target !== modal) return;

    if (modal.id === "gameModal") {
      leaveRoom();
    } else {
      closeModal(modal.id);
    }
  });
});

$$("[data-game]").forEach((button) => {
  button.addEventListener("click", () => createRoom(button.dataset.game));
});

$("#chatForm")?.addEventListener("submit", (event) => {
  event.preventDefault();

  const input = $("#chatInput");
  if (!input) return;

  sendChat(input.value);
  input.value = "";
});

$("#copyRoomBtn")?.addEventListener("click", async () => {
  if (!state.roomId) return;

  try {
    await navigator.clipboard.writeText(state.roomId);
    toast("تم نسخ كود الغرفة.");
  } catch {
    toast("كود الغرفة: " + state.roomId);
  }
});

$("#joinCodeBtn")?.addEventListener("click", joinByCode);
$("#joinCodeInput")?.addEventListener("keydown", e => { if (e.key === "Enter") joinByCode(); });

$("#refreshRooms")?.addEventListener("click", () => {
  toast(state.firebase
    ? "قائمة الغرف بتتحدث تلقائيًا."
    : "الوضع التجريبي شغال. الغرف الأونلاين تحتاج Firebase.");
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && $("#gameModal")?.classList.contains("open")) {
    leaveRoom();
  }
});

renderName();

if (!state.name) {
  if ($("#nameInput")) $("#nameInput").value = "";
  openModal("nameModal");
}

initFirebase();
