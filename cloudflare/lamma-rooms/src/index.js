import { DurableObject } from "cloudflare:workers";

export class Room extends DurableObject {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "lamma-room", roomId: this.ctx.id.toString() });
    }
    return Response.json({ ok: true, message: "Lamma room is ready" });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "/health") {
      return Response.json({ ok: true, service: "lamma-rooms-worker" });
    }

    const roomCode = url.pathname.split("/").filter(Boolean)[1];
    if (!roomCode) {
      return new Response("Room code is required. Use /rooms/<code>", { status: 400 });
    }

    const id = env.ROOMS.idFromName(roomCode);
    const stub = env.ROOMS.get(id);
    return stub.fetch(request);
  },
};
