const CATALOG = {
  dice_gold: { name: "النرد الذهبي", price: 30, type: "dice" },
  piece_crystal: { name: "قطع كريستال", price: 50, type: "piece" },
  piece_fire: { name: "قطع نار", price: 50, type: "piece" },
  piece_lightning: { name: "قطع برق", price: 50, type: "piece" },
  piece_gold: { name: "قطع ذهبية", price: 50, type: "piece" },
  piece_neon: { name: "قطع نيون", price: 50, type: "piece" },
  board_gold: { name: "لوحة ذهبية", price: 100, type: "board" },
  board_space: { name: "لوحة فضائية", price: 100, type: "board" },
  board_ice: { name: "لوحة جليدية", price: 100, type: "board" },
  board_royal: { name: "لوحة ملكية", price: 100, type: "board" },
  profile_frame: { name: "إطار صورة شخصية", price: 40, type: "frame" },
  victory_effect: { name: "مؤثر فوز", price: 60, type: "effect" },
  move_lightning: { name: "مسار البرق", price: 100, type: "movementEffect" },
  move_fire: { name: "مسار اللهب", price: 150, type: "movementEffect" },
  move_ghost: { name: "مسار الشبح", price: 80, type: "movementEffect" },
  move_gold: { name: "مسار الذهب", price: 120, type: "movementEffect" },
  move_ice: { name: "مسار الجليد", price: 100, type: "movementEffect" },
  move_rainbow: { name: "مسار قوس قزح", price: 200, type: "movementEffect" }
};

const API_KEY = "AIzaSyArJNDKNNTs2oFGFWV58_1UKY3GmE06ghk";
const encoder = new TextEncoder();

function b64url(input) {
  const bytes = typeof input === "string" ? encoder.encode(input) : input;
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function pemToBytes(pem) {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const binary = atob(body);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
async function serviceToken(env) {
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3500
  }));
  const unsigned = header + "." + claim;
  const key = await crypto.subtle.importKey(
    "pkcs8", pemToBytes(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(unsigned));
  const assertion = unsigned + "." + b64url(new Uint8Array(signature));
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error("تعذر الاتصال بخدمة Firebase.");
  return data.access_token;
}
async function verifyPlayer(request) {
  const auth = request.headers.get("authorization") || "";
  const idToken = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!idToken) throw new Error("سجل دخولك الأول.");
  const response = await fetch(
    "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + API_KEY,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken })
    }
  );
  const data = await response.json();
  const user = data.users && data.users[0];
  if (!response.ok || !user || user.disabled) throw new Error("جلسة الدخول انتهت. سجل دخولك من جديد.");
  return user.localId;
}
function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "authorization,content-type",
      "vary": "Origin",
      "cache-control": "no-store"
    }
  });
}
function dbUrl(env, path) {
  const base = String(env.FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
  return base + "/" + path.replace(/^\//, "") + ".json";
}
async function readNode(url, token) {
  const r = await fetch(url, { headers: { authorization: "Bearer " + token, "X-Firebase-ETag": "true" } });
  if (!r.ok) throw new Error("تعذر قراءة بيانات المحفظة.");
  return { value: await r.json(), etag: r.headers.get("ETag") };
}
async function conditionalPut(url, token, etag, value) {
  return fetch(url, {
    method: "PUT",
    headers: {
      authorization: "Bearer " + token,
      "content-type": "application/json",
      "if-match": etag
    },
    body: JSON.stringify(value)
  });
}
async function debitOnce(env, token, uid, requestId, itemId, item) {
  const url = dbUrl(env, "wallets/" + encodeURIComponent(uid));
  for (let attempt = 0; attempt < 6; attempt++) {
    const current = await readNode(url, token);
    const wallet = current.value || { balance: 0 };
    wallet.storeReceipts = wallet.storeReceipts || {};
    const old = wallet.storeReceipts[requestId];
    if (old) {
      if (old.itemId !== itemId) throw new Error("رقم العملية مستخدم لشراء مختلف.");
      return old;
    }
    const balance = Number(wallet.balance || 0);
    if (!Number.isSafeInteger(balance) || balance < item.price) throw new Error("رصيد LC غير كافٍ.");
    const receipt = {
      itemId, itemName: item.name, price: item.price,
      status: "charged", at: Date.now()
    };
    wallet.balance = balance - item.price;
    wallet.storeReceipts[requestId] = receipt;
    const put = await conditionalPut(url, token, current.etag, wallet);
    if (put.status === 412) continue;
    if (!put.ok) throw new Error("تعذر خصم الرصيد؛ لم يتم تأكيد الشراء.");
    return receipt;
  }
  throw new Error("المحفظة مشغولة. حاول مرة تانية بنفس الطلب.");
}
async function deliverOnce(env, token, uid, requestId, itemId, item) {
  const url = dbUrl(env, "inventory/" + encodeURIComponent(uid));
  for (let attempt = 0; attempt < 6; attempt++) {
    const current = await readNode(url, token);
    const inventory = current.value || {};
    inventory.items = inventory.items || {};
    inventory.deliveryIds = inventory.deliveryIds || {};
    if (inventory.deliveryIds[requestId]) return;
    const owned = inventory.items[itemId] || { quantity: 0 };
    inventory.items[itemId] = {
      name: item.name,
      type: item.type,
      quantity: Number(owned.quantity || 0) + 1,
      updatedAt: Date.now()
    };
    inventory.deliveryIds[requestId] = true;
    const put = await conditionalPut(url, token, current.etag, inventory);
    if (put.status === 412) continue;
    if (!put.ok) throw new Error("تم حجز الشراء، والتسليم هيكتمل تلقائيًا عند إعادة المحاولة.");
    return;
  }
  throw new Error("المخزون مشغول. أعد المحاولة بنفس رقم الطلب.");
}
async function markDelivered(env, token, uid, requestId) {
  const url = dbUrl(env, "wallets/" + encodeURIComponent(uid));
  for (let attempt = 0; attempt < 6; attempt++) {
    const current = await readNode(url, token);
    const wallet = current.value || {};
    wallet.storeReceipts = wallet.storeReceipts || {};
    const receipt = wallet.storeReceipts[requestId];
    if (!receipt) throw new Error("إيصال الشراء غير موجود.");
    if (receipt.status === "delivered") return;
    receipt.status = "delivered";
    receipt.deliveredAt = Date.now();
    const put = await conditionalPut(url, token, current.etag, wallet);
    if (put.status === 412) continue;
    if (!put.ok) throw new Error("المشتريات اتسجلت، حدّث الطلب لمزامنة الإيصال.");
    return;
  }
  throw new Error("تعذر تحديث إيصال الشراء.");
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = origin === "https://yoursmartsite-com.github.io";
    if (request.method === "OPTIONS") {
      if (!allowed) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: {
        "access-control-allow-origin": origin,
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "access-control-allow-headers": "authorization,content-type",
        "access-control-max-age": "86400",
        "vary": "Origin"
      }});
    }
    if (!allowed) return new Response("Forbidden", { status: 403 });
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/catalog") return json({ items: CATALOG }, 200, origin);
    if (request.method !== "POST" || url.pathname !== "/purchase") return json({ error: "Not found" }, 404, origin);
    try {
      const uid = await verifyPlayer(request);
      const body = await request.json();
      const itemId = String(body.itemId || "");
      const requestId = String(body.requestId || "");
      const item = CATALOG[itemId];
      if (!item || !/^[A-Za-z0-9_-]{16,80}$/.test(requestId)) {
        return json({ error: "طلب شراء غير صالح." }, 400, origin);
      }
      const token = await serviceToken(env);
      const receipt = await debitOnce(env, token, uid, requestId, itemId, item);
      await deliverOnce(env, token, uid, requestId, itemId, item);
      await markDelivered(env, token, uid, requestId);
      const wallet = await readNode(dbUrl(env, "wallets/" + encodeURIComponent(uid)), token);
      return json({
        ok: true, itemId, itemName: item.name, price: item.price,
        balance: Number(wallet.value?.balance || 0),
        status: "delivered"
      }, 200, origin);
    } catch (error) {
      const message = String(error.message || "حصل خطأ غير متوقع.");
      const status = message.includes("رصيد") ? 402 :
        message.includes("سجل دخول") || message.includes("جلسة") ? 401 : 400;
      return json({ error: message }, status, origin);
    }
  }
};