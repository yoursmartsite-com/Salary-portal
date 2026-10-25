const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");

initializeApp();

const REWARDS = [1, 2, 3, 5, 7, 10, 20];
const TIME_ZONE = "Africa/Cairo";

function cairoDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
function previousDateKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return cairoDateKey(new Date(Date.UTC(y, m - 1, d, 12) - 86400000));
}

exports.claimDailyReward = onCall({ region: "europe-west1", enforceAppCheck: false }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "سجّل دخولك الأول.");
  const uid = request.auth.uid;
  const today = cairoDateKey();
  const ref = getDatabase().ref(`wallets/${uid}`);
  let outcome = null;

  await ref.transaction(current => {
    const wallet = current && typeof current === "object" ? current : { balance: 0 };
    const balance = Number(wallet.balance);
    if (!Number.isFinite(balance) || balance < 0) return;
    if (wallet.dailyRewardDate === today) {
      outcome = { alreadyClaimed: true, balance, day: wallet.dailyRewardStreak || 0, reward: 0 };
      return;
    }
    const yesterday = previousDateKey(today);
    const oldStreak = Number(wallet.dailyRewardStreak) || 0;
    const day = wallet.dailyRewardDate === yesterday ? (oldStreak >= 7 ? 1 : oldStreak + 1) : 1;
    const reward = REWARDS[day - 1];
    outcome = { alreadyClaimed: false, balance: balance + reward, day, reward };
    return {
      ...wallet,
      balance: balance + reward,
      dailyRewardDate: today,
      dailyRewardStreak: day,
      dailyRewardUpdatedAt: Date.now()
    };
  }, undefined, false);

  if (!outcome) {
    const snap = await ref.get();
    const wallet = snap.val() || {};
    if (wallet.dailyRewardDate === today) {
      outcome = { alreadyClaimed: true, balance: Number(wallet.balance) || 0, day: Number(wallet.dailyRewardStreak) || 0, reward: 0 };
    } else {
      throw new HttpsError("failed-precondition", "تعذر تحديث المحفظة. حاول مرة أخرى.");
    }
  }
  return { ...outcome, date: today };
});


// Aviator virtual-coin game: shared server round and per-user single bet.
// Wallet mutations happen only in these callable functions, never in the browser.
const AVIATOR_REGION = "europe-west1";
const ROUND_MS = 12000;
const GROWTH = 0.12;
function crashPointFor(roundId) {
  // Deterministic per round; server-owned and stable for every player.
  let h = 2166136261;
  for (const c of String(roundId)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  const n = (h >>> 0) / 4294967296;
  return Math.max(1.05, Math.floor((1.05 + n * 4.95) * 100) / 100);
}
function aviatorCrashTime(round) {
  const crashAt = Number(round.crashAt) || 1.05;
  const secondsToCrash = Math.pow(Math.max(0, (crashAt - 1) / GROWTH), 1 / 1.22);
  return Math.min(Number(round.endsAt), Number(round.startsAt) + secondsToCrash * 1000);
}
async function ensureAviatorRound() {
  const ref = getDatabase().ref("aviator/currentRound");
  const now = Date.now();
  await ref.transaction(r => {
    if (r) {
      const crashTime = aviatorCrashTime(r);
      // Keep the same shared round briefly after the crash, then rotate it.
      if (now < crashTime + 2500) return;
    }
    const id = String(now);
    return { id, startsAt: now, endsAt: now + ROUND_MS, crashAt: crashPointFor(id), status: "running" };
  });
  const snap = await ref.get();
  return snap.val();
}
exports.aviatorGetState = onCall({ region: AVIATOR_REGION }, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "سجّل دخولك الأول.");
  const round = await ensureAviatorRound();
  const db = getDatabase();
  const [betSnap, walletSnap] = await Promise.all([
    db.ref(`aviator/bets/${round.id}/${request.auth.uid}`).get(),
    db.ref(`wallets/${request.auth.uid}`).get()
  ]);
  const bet = betSnap.val();
  const wallet = walletSnap.val();
  const balance = Number(wallet && wallet.balance);
  const now = Date.now();
  const elapsed = Math.max(0, now - Number(round.startsAt || now)) / 1000;
  const liveMultiplier = Math.max(1, Math.floor((1 + Math.pow(elapsed, 1.22) * GROWTH) * 100) / 100);
  const crashed = now >= round.endsAt || liveMultiplier >= Number(round.crashAt);
  return { roundId: round.id, startsAt: round.startsAt, endsAt: round.endsAt,
    status: crashed ? "crashed" : "running",
    multiplier: crashed ? Number(round.crashAt) : liveMultiplier,
    balance: Number.isSafeInteger(balance) && balance >= 0 ? balance : 0,
    bet: bet || null };
});
exports.aviatorPlaceBet = onCall({ region: AVIATOR_REGION }, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "سجّل دخولك الأول.");
  const stake = Number(request.data && request.data.stake);
  if (!Number.isSafeInteger(stake) || stake < 1 || stake > 10000) throw new HttpsError("invalid-argument", "قيمة الرهان من 1 إلى 10000.");
  const round = await ensureAviatorRound();
  const now = Date.now();
  if (now >= aviatorCrashTime(round)) throw new HttpsError("failed-precondition", "الجولة انتهت؛ استنى الجولة الجديدة.");
  const uid = request.auth.uid;
  const betRef = getDatabase().ref(`aviator/bets/${round.id}/${uid}`);
  const walletRef = getDatabase().ref(`wallets/${uid}`);
  let result = null;
  // Transaction on bet record prevents duplicate bets on refresh/retries.
  await betRef.transaction(current => {
    if (current) { result = { error: "already" }; return; }
    return { stake, status: "active", placedAt: now, roundId: round.id };
  });
  if (result && result.error) throw new HttpsError("already-exists", "إنت داخل الجولة دي بالفعل.");
  let deducted = false;
  await walletRef.transaction(w => {
    if (!w || !Number.isSafeInteger(Number(w.balance)) || Number(w.balance) < stake) return;
    deducted = true;
    return { ...w, balance: Number(w.balance) - stake };
  });
  if (!deducted) {
    await betRef.remove();
    throw new HttpsError("failed-precondition", "رصيد عملات لَمّة مش كفاية.");
  }
  return { ok: true, balance: (await walletRef.get()).child("balance").val(), roundId: round.id };
});
exports.aviatorCashout = onCall({ region: AVIATOR_REGION }, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "سجّل دخولك الأول.");
  const roundId = String(request.data && request.data.roundId || "");
  if (!/^\d{10,}$/.test(roundId)) throw new HttpsError("invalid-argument", "رقم الجولة غير صحيح.");
  const db = getDatabase();
  const roundSnap = await db.ref("aviator/currentRound").get();
  const round = roundSnap.val();
  if (!round || round.id !== roundId) throw new HttpsError("failed-precondition", "الجولة دي خلصت.");
  const now = Date.now();
  const elapsed = Math.max(0, now - Number(round.startsAt)) / 1000;
  const currentMultiplier = Math.max(1, Math.floor((1 + Math.pow(elapsed, 1.22) * GROWTH) * 100) / 100);
  if (now >= round.endsAt || currentMultiplier >= Number(round.crashAt)) {
    // Mark the bet lost once; no wallet refund after the crash.
    await db.ref(`aviator/bets/${roundId}/${request.auth.uid}`).transaction(b => {
      if (!b || b.status !== "active") return;
      return { ...b, status: "lost", lostAt: now };
    });
    throw new HttpsError("failed-precondition", "الطيارة وقعت قبل السحب.");
  }
  const uid = request.auth.uid;
  const betRef = db.ref(`aviator/bets/${roundId}/${uid}`);
  let betData = null;
  let cashed = false;
  await betRef.transaction(b => {
    if (!b || b.status !== "active") return;
    const payout = Math.floor(Number(b.stake) * currentMultiplier);
    betData = { payout, stake: Number(b.stake), multiplier: currentMultiplier };
    cashed = true;
    return { ...b, status: "cashed", payout, multiplier: currentMultiplier, cashedAt: now };
  });
  if (!cashed) throw new HttpsError("already-exists", "مفيش رهان نشط للسحب أو تم السحب بالفعل.");
  const walletRef = db.ref(`wallets/${uid}`);
  await walletRef.transaction(w => {
    if (!w) return;
    return { ...w, balance: (Number(w.balance) || 0) + betData.payout };
  });
  return { ok: true, ...betData, balance: (await walletRef.get()).child("balance").val() };
});
