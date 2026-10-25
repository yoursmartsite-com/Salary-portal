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
