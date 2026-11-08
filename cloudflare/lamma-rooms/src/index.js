import { DurableObject } from "cloudflare:workers";

const ALLOWED_ORIGINS = new Set([
  "https://yoursmartsite-com.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000"
]);

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://yoursmartsite-com.github.io",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers });
}

function validUid(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{3,128}$/.test(value);
}

function validName(value) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 24;
}

export class Room extends DurableObject {
  async fetch(request) {
    const url = new URL(request.url);
    const headers = corsHeaders(request);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (url.pathname.endsWith("/voice") && request.headers.get("Upgrade") === "websocket") {
      const uid = url.searchParams.get("uid") || "";
      if (!validUid(uid)) return json({ ok:false, error:"INVALID_PLAYER" }, 400, headers);
      const roomCode = url.pathname.split("/").filter(Boolean)[1];
      const existing = this.ctx.getWebSockets(roomCode);
      const pair = new WebSocketPair();
      const client = pair[0], server = pair[1];
      this.ctx.acceptWebSocket(server, [roomCode]);
      server.serializeAttachment({ roomCode, uid });
      for (const peer of existing) {
        const data = peer.deserializeAttachment();
        if (data?.uid) {
          server.send(JSON.stringify({ type:"peer", uid:data.uid }));
          try { peer.send(JSON.stringify({ type:"peer", uid })); } catch {}
        }
      }
      return new Response(null, { status: 101, webSocket: client });
    }

    let state = await this.ctx.storage.get("room");
    const path = url.pathname.split("/").filter(Boolean).slice(2);
    const action = path[0] || "";

    try {
      if (request.method === "POST" && !action) {
        if (state) return json({ ok: false, error: "ROOM_EXISTS" }, 409, headers);
        const body = await request.json();
        if (!validUid(body.uid) || !validName(body.name) || typeof body.game !== "string" || !["none","xo","guess","rps","connect4","words","quiz","estimation","basra","uno","tarneeb","hokm","konkan"].includes(body.game)) {
          return json({ ok: false, error: "INVALID_ROOM_DATA" }, 400, headers);
        }
        state = {
          code: url.pathname.split("/").filter(Boolean)[1],
          game: "estimation",
          gameType: body.game === "estimation" ? "cards" : "lobby",
          maxPlayers: body.game === "estimation" ? 4 : Math.max(2, Math.min(8, Number(body.maxPlayers) || 8)),
          status: "waiting",
          host: body.uid,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          players: {
            [body.uid]: { uid: body.uid, name: body.name.trim(), avatar: "🍓", ready: false, joinedAt: Date.now() }
          },
          chat: []
        };
        await this.ctx.storage.put("room", state);
        return json({ ok: true, room: state }, 201, headers);
      }

      if (!state) return json({ ok: false, error: "ROOM_NOT_FOUND" }, 404, headers);

      if (request.method === "GET" && !action) {
        return json({ ok: true, room: state }, 200, headers);
      }

      if (request.method === "POST" && action === "join") {
        const body = await request.json();
        if (!validUid(body.uid) || !validName(body.name)) return json({ ok: false, error: "INVALID_PLAYER" }, 400, headers);
        const current = state.players[body.uid];
        if (!current && Object.keys(state.players).length >= (Number(state.maxPlayers) || 4)) return json({ ok: false, error: "ROOM_FULL" }, 409, headers);
        state.players[body.uid] = {
          uid: body.uid, name: body.name.trim(),
          avatar: typeof body.avatar === "string" ? body.avatar.slice(0, 100) : "🍓",
          ready: current ? !!current.ready : false,
          joinedAt: current?.joinedAt || Date.now()
        };
        state.updatedAt = Date.now();
        await this.ctx.storage.put("room", state);
        return json({ ok: true, room: state }, 200, headers);
      }

      if (request.method === "POST" && action === "ready") {
        const body = await request.json();
        if (!validUid(body.uid) || typeof body.ready !== "boolean" || !state.players[body.uid]) {
          return json({ ok: false, error: "PLAYER_NOT_IN_ROOM" }, 400, headers);
        }
        state.players[body.uid].ready = body.ready;
        state.updatedAt = Date.now();
        await this.ctx.storage.put("room", state);
        return json({ ok: true, room: state }, 200, headers);
      }

      if (request.method === "POST" && action === "game") {
        const body = await request.json();
        const allowedGames = ["none","xo","guess","rps","connect4","words","quiz","estimation","basra","uno","tarneeb","hokm","konkan"];
        if (!validUid(body.uid) || !state.players[body.uid] || !allowedGames.includes(body.game)) {
          return json({ ok: false, error: "INVALID_GAME_SELECTION" }, 400, headers);
        }
        state.game = body.game;
        state.gameUpdatedBy = state.players[body.uid].name;
        state.updatedAt = Date.now();
        await this.ctx.storage.put("room", state);
        return json({ ok: true, room: state }, 200, headers);
      }

      if (request.method === "POST" && action === "chat") {
        const body = await request.json();
        if (!validUid(body.uid) || typeof body.text !== "string" || !body.text.trim() || body.text.length > 250 || !state.players[body.uid]) {
          return json({ ok: false, error: "INVALID_CHAT_MESSAGE" }, 400, headers);
        }
        state.chat.push({ uid: body.uid, name: state.players[body.uid].name, text: body.text.trim(), at: Date.now() });
        state.chat = state.chat.slice(-60);
        state.updatedAt = Date.now();
        await this.ctx.storage.put("room", state);
        return json({ ok: true, room: state }, 200, headers);
      }

      if (request.method === "DELETE" && action === "players" && path[1]) {
        const uid = path[1];
        if (!validUid(uid)) return json({ ok: false, error: "INVALID_PLAYER" }, 400, headers);
        delete state.players[uid];
        if (state.host === uid) state.host = Object.keys(state.players)[0] || null;
        if (!Object.keys(state.players).length) {
          await this.ctx.storage.delete("room");
          return json({ ok: true, deleted: true }, 200, headers);
        }
        state.updatedAt = Date.now();
        await this.ctx.storage.put("room", state);
        return json({ ok: true, room: state }, 200, headers);
      }

      return json({ ok: false, error: "NOT_FOUND" }, 404, headers);
    } catch (error) {
      return json({ ok: false, error: "SERVER_ERROR", message: error.message }, 500, headers);
    }
  }

  async webSocketMessage(ws, message) {
    const attachment = ws.deserializeAttachment() || {};
    let data;
    try { data = JSON.parse(message); } catch { return; }
    const allowed = new Set(["offer","answer","ice","left"]);
    if (!allowed.has(data.type) || typeof data.to !== "string" || data.to.length > 128) return;
    const payload = { ...data, from: attachment.uid };
    const text = JSON.stringify(payload);
    for (const peer of this.ctx.getWebSockets(attachment.roomCode)) {
      const target = peer.deserializeAttachment();
      if (target?.uid === data.to) {
        try { peer.send(text); } catch {}
      }
    }
  }

  async webSocketClose(ws) {
    const attachment = ws.deserializeAttachment() || {};
    const payload = JSON.stringify({ type:"left", from:attachment.uid });
    for (const peer of this.ctx.getWebSockets(attachment.roomCode)) {
      try { peer.send(payload); } catch {}
    }
  }

  async webSocketError(ws) {
    try { ws.close(1011, "voice signaling error"); } catch {}
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = corsHeaders(request);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (url.pathname === "/" || url.pathname === "/health") {
      return json({ ok: true, service: "lamma-rooms-worker", version: 2 }, 200, headers);
    }
    const match = url.pathname.match(/^\/rooms\/([A-Za-z0-9_-]{3,32})(?:\/.*)?$/);
    if (!match) return json({ ok: false, error: "ROOM_CODE_REQUIRED" }, 400, headers);
    const id = env.ROOMS.idFromName(match[1]);
    return env.ROOMS.get(id).fetch(request);
  }
};
