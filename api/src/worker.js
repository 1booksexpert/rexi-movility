// REXI Movilidad: API de viaje en tiempo real para varios choferes.
//
//  - KV "PINS": una llave por chofer ("pin:<id-chofer>") con el hash de su PIN.
//    Dar de alta/baja/cambiar PIN de un chofer = escribir/borrar su llave (ver scripts/chofer.mjs).
//  - Durable Object "Trip": un viaje activo. Guarda la última posición del chofer
//    y, solo para el chofer, la del pasajero. Se borra solo (6 h, o 30 min tras terminar).
//  - Durable Object "Guard": bloquea 15 min tras 5 PIN incorrectos de un mismo chofer.
import { DurableObject } from "cloudflare:workers";
import { admin } from "./admin.js";

const HORAS_MAX = 6;
const MIN_TRAS_FIN = 30;
const INTENTOS = 5;
const BLOQUEO_MIN = 15;

const json = (o, s = 200) =>
  new Response(JSON.stringify(o), {
    status: s,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const ALFABETO = "23456789abcdefghjkmnpqrstuvwxyz";
const rid = (n) =>
  [...crypto.getRandomValues(new Uint8Array(n))].map((x) => ALFABETO[x % ALFABETO.length]).join("");

function igual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
async function sha256(txt) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export const hashPin = (choferId, pin) => sha256(`${choferId}:${pin}`);

const num = (v, min, max) => (typeof v === "number" && isFinite(v) && v >= min && v <= max ? v : null);
const txt = (v, n) => (typeof v === "string" ? v.replace(/[<>]/g, "").trim().slice(0, n) : "");
const ID_CHOFER = /^[a-z0-9][a-z0-9-]{1,39}$/;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/admin/")) return admin(req, env, { json, igual });
    const m = url.pathname.match(/^\/api\/trips(?:\/([2-9a-hj-km-np-z]{10}))?(?:\/(loc|end|passenger))?$/);
    if (!m) return json({ error: "not_found" }, 404);
    const [, id, op] = m;

    const raw = req.method === "POST" ? await req.text() : "";
    if (raw.length > 2048) return json({ error: "too_large" }, 413);

    // Crear viaje: solo un chofer dado de alta, con su PIN.
    if (!id) {
      if (req.method !== "POST") return json({ error: "method" }, 405);
      let b = {};
      try { b = JSON.parse(raw || "{}"); } catch {}
      const choferId = txt(b.chofer, 40).toLowerCase();
      const pin = String(req.headers.get("x-pin") || "");
      if (!ID_CHOFER.test(choferId) || !pin) return json({ error: "pin" }, 401);

      const guard = env.GUARD.get(env.GUARD.idFromName(choferId));
      const estado = await (await guard.fetch("https://do/check")).json();
      if (estado.bloqueado) return json({ error: "bloqueado", reintentar_en_s: estado.segundos }, 429);

      const guardado = await env.PINS.get(`pin:${choferId}`);
      const ok = guardado && igual(await hashPin(choferId, pin), guardado);
      if (!ok) {
        await guard.fetch("https://do/fail", { method: "POST" });
        return json({ error: "pin" }, 401);
      }
      await guard.fetch("https://do/ok", { method: "POST" });

      const tripId = rid(10);
      const token = rid(24);
      const stub = env.TRIPS.get(env.TRIPS.idFromName(tripId));
      await stub.fetch("https://do/init", {
        method: "POST",
        body: JSON.stringify({
          token, choferId,
          nombre: txt(b.nombre, 40), placa: txt(b.placa, 14), unidad: txt(b.unidad, 40),
        }),
      });
      return json({ id: tripId, token });
    }

    const stub = env.TRIPS.get(env.TRIPS.idFromName(id));
    const accion = op || "get";
    const okMethod = accion === "get" ? req.method === "GET" : req.method === "POST";
    if (!okMethod) return json({ error: "method" }, 405);
    return stub.fetch("https://do/" + accion, {
      method: req.method,
      headers: { "x-token": req.headers.get("x-token") || "" },
      body: req.method === "POST" ? raw : undefined,
    });
  },
};

export class Trip extends DurableObject {
  async fetch(req) {
    const op = new URL(req.url).pathname.slice(1);
    let body = {};
    if (req.method === "POST") {
      try { body = JSON.parse((await req.text()) || "{}"); } catch {}
    }
    let t = await this.ctx.storage.get("t");

    if (op === "init") {
      if (t) return json({ error: "exists" }, 409);
      t = { token: body.token, choferId: body.choferId, nombre: body.nombre, placa: body.placa, unidad: body.unidad, status: "active", loc: null, pax: null, paxTs: 0 };
      await this.ctx.storage.put("t", t);
      await this.ctx.storage.setAlarm(Date.now() + HORAS_MAX * 3600e3);
      return json({ ok: true });
    }

    if (!t) return json({ error: "not_found" }, 404);
    const esChofer = igual(req.headers.get("x-token") || "", t.token);

    if (op === "get") {
      const out = {
        status: t.status, choferId: t.choferId, nombre: t.nombre, placa: t.placa, unidad: t.unidad,
        loc: t.status === "active" ? t.loc : null, now: Date.now(),
      };
      if (esChofer) out.pax = t.pax; // la ubicación del pasajero solo la ve el chofer
      return json(out);
    }

    if (op === "loc") {
      if (!esChofer) return json({ error: "token" }, 403);
      if (t.status !== "active") return json({ error: "ended" }, 410);
      const lat = num(body.lat, -90, 90), lng = num(body.lng, -180, 180);
      if (lat === null || lng === null) return json({ error: "datos" }, 400);
      t.loc = { lat, lng, spd: num(body.spd, 0, 400), hdg: num(body.hdg, 0, 360), acc: num(body.acc, 0, 100000), ts: Date.now() };
      await this.ctx.storage.put("t", t);
      return json({ ok: true });
    }

    if (op === "passenger") {
      if (t.status !== "active") return json({ error: "ended" }, 410);
      if (Date.now() - t.paxTs < 2000) return json({ ok: true, skipped: true });
      const lat = num(body.lat, -90, 90), lng = num(body.lng, -180, 180);
      if (lat === null || lng === null) return json({ error: "datos" }, 400);
      t.pax = { lat, lng, acc: num(body.acc, 0, 100000), ts: Date.now() };
      t.paxTs = Date.now();
      await this.ctx.storage.put("t", t);
      return json({ ok: true });
    }

    if (op === "end") {
      if (!esChofer) return json({ error: "token" }, 403);
      t.status = "ended";
      t.loc = null;
      t.pax = null;
      await this.ctx.storage.put("t", t);
      await this.ctx.storage.setAlarm(Date.now() + MIN_TRAS_FIN * 60e3);
      return json({ ok: true });
    }

    return json({ error: "not_found" }, 404);
  }

  async alarm() {
    await this.ctx.storage.deleteAll();
  }
}

export class Guard extends DurableObject {
  async fetch(req) {
    const op = new URL(req.url).pathname.slice(1);
    const g = (await this.ctx.storage.get("g")) || { fallos: 0, hasta: 0 };
    const ahora = Date.now();
    if (op === "check") {
      const bloqueado = g.hasta > ahora;
      return json({ bloqueado, segundos: bloqueado ? Math.ceil((g.hasta - ahora) / 1000) : 0 });
    }
    if (op === "fail") {
      g.fallos += 1;
      if (g.fallos >= INTENTOS) { g.hasta = ahora + BLOQUEO_MIN * 60e3; g.fallos = 0; }
      await this.ctx.storage.put("g", g);
      await this.ctx.storage.setAlarm(ahora + BLOQUEO_MIN * 60e3 + 1000);
      return json({ ok: true });
    }
    if (op === "ok") {
      await this.ctx.storage.deleteAll();
      return json({ ok: true });
    }
    return json({ error: "not_found" }, 404);
  }
  async alarm() {
    const g = await this.ctx.storage.get("g");
    if (!g || g.hasta <= Date.now()) await this.ctx.storage.deleteAll();
  }
}
