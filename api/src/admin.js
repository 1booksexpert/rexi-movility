// Editor en línea de choferes y flotas (/api/admin/*).
// Los datos viven en GitHub (src/data/choferes.json y flotas.json): cada cambio es un commit,
// Cloudflare Pages reconstruye el sitio solo (~1-2 min) y queda historial para deshacer.
// Los PIN viven en KV (nunca en GitHub). Secretos del Worker:
//   ADMIN_PASSWORD  contraseña del editor
//   GITHUB_TOKEN    token fine-grained con permiso Contents: Read and write sobre el repo
// Variable opcional: GITHUB_REPO (por defecto 1booksexpert/rexi-movility), GITHUB_BRANCH (main).

const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const PLANES = ["", "tarjeta", "pro", "flota"];
const PAGOS = ["", "mensual", "anual"];
const CAMPOS = ["nombre", "telefono", "titulo", "zona", "placa", "unidad", "plan", "pago", "referido", "flota", "fechaAlta"];

class Err extends Error {
  constructor(mensaje, status = 400) { super(mensaje); this.status = status; }
}

const dec = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, "")), (c) => c.charCodeAt(0)));
const enc = (s) => {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

async function motivo(r, info) {
  let t = "";
  try { t = await r.text(); } catch {}
  let m = t;
  try { m = JSON.parse(t).message || t; } catch {}
  return `${String(m || r.statusText || "sin detalle").slice(0, 200)} [${info}]`;
}

function gh(env) {
  const repo = env.GITHUB_REPO || "1booksexpert/rexi-movility";
  const rama = env.GITHUB_BRANCH || "main";
  if (!env.GITHUB_TOKEN) throw new Err("Falta el secreto GITHUB_TOKEN en el Worker.", 503);
  const h = {
    authorization: `Bearer ${String(env.GITHUB_TOKEN).trim()}`,
    accept: "application/vnd.github+json",
    "user-agent": "rexi-admin",
    "x-github-api-version": "2022-11-28",
  };
  const tk = String(env.GITHUB_TOKEN).trim();
  const info = `token de ${tk.length} caracteres que empieza con "${tk.slice(0, 4)}", repo ${repo.trim()}, rama ${rama}`;
  const base = `https://api.github.com/repos/${repo.trim()}/contents/`;
  return {
    async leer(ruta) {
      const r = await fetch(`${base}${ruta}?ref=${rama}`, { headers: h });
      if (!r.ok) throw new Err(`No pude leer ${ruta} de GitHub (${r.status}): ${await motivo(r, info)}`, 502);
      const j = await r.json();
      return { datos: JSON.parse(dec(j.content)), sha: j.sha };
    },
    async guardar(ruta, datos, sha, mensaje) {
      const r = await fetch(base + ruta, {
        method: "PUT",
        headers: { ...h, "content-type": "application/json" },
        body: JSON.stringify({ message: mensaje, content: enc(JSON.stringify(datos, null, 2) + "\n"), sha, branch: rama }),
      });
      if (r.status === 409 || r.status === 422) throw new Err("conflicto", 409);
      if (!r.ok) throw new Err(`GitHub rechazó el cambio (${r.status}): ${await motivo(r, info)}`, 502);
    },
  };
}

// Lee, aplica el cambio, valida TODO y guarda. Reintenta una vez si alguien guardó al mismo tiempo.
async function modificar(env, ruta, mensaje, cambio, validar) {
  const g = gh(env);
  for (let i = 0; i < 2; i++) {
    const { datos, sha } = await g.leer(ruta);
    const nuevo = cambio(datos);
    validar(nuevo);
    try { await g.guardar(ruta, nuevo, sha, mensaje); return nuevo; }
    catch (e) { if (!(e instanceof Err) || e.message !== "conflicto" || i) throw e.message === "conflicto" ? new Err("Se guardó otro cambio al mismo tiempo. Intenta de nuevo.", 409) : e; }
  }
}

const limpio = (v, n) => String(v ?? "").replace(/[<>]/g, "").trim().slice(0, n);
const tel10 = (v) => String(v ?? "").replace(/\D/g, "").slice(-10);

function validarChoferes(lista, flotas) {
  const ids = new Set();
  lista.forEach((c) => {
    const e = `"${c.id}"`;
    if (!ID_RE.test(c.id || "")) throw new Err(`${e}: el id debe ir en minúsculas, sin acentos ni espacios.`);
    if (ids.has(c.id)) throw new Err(`${e}: el id ya existe.`);
    ids.add(c.id);
    if (!c.nombre) throw new Err(`${e}: falta el nombre.`);
    if (String(c.telefono || "").replace(/\D/g, "").slice(-10).length !== 10) throw new Err(`${e}: el teléfono debe tener 10 dígitos.`);
    if (c.flota && !flotas.some((f) => f.id === c.flota)) throw new Err(`${e}: la flota "${c.flota}" no existe.`);
    if (!Array.isArray(c.servicios) || !c.servicios.length) throw new Err(`${e}: necesita al menos un servicio.`);
  });
}

function limpiarServicios(arr) {
  if (!Array.isArray(arr)) return null;
  return arr.slice(0, 12).map((s) => {
    const nombre = limpio(s.nombre, 40);
    if (!nombre) throw new Err("Cada servicio necesita nombre.");
    const o = { nombre, icono: limpio(s.icono, 8) || "🚖", color: limpio(s.color, 10) || undefined, descripcion: limpio(s.descripcion, 160), mensaje: limpio(s.mensaje, 200) };
    if (!o.color) delete o.color;
    if (!o.mensaje) delete o.mensaje;
    return o;
  });
}

function normalizarChofer(b, previo) {
  const c = { ...(previo || {}) };
  for (const k of CAMPOS) if (k in b) c[k] = limpio(b[k], k === "unidad" ? 40 : 60);
  c.id = previo ? previo.id : limpio(b.id, 40).toLowerCase();
  c.telefono = tel10(b.telefono ?? c.telefono);
  delete c.telefonoFormateado;
  if (!PLANES.includes(c.plan || "")) throw new Err("Plan no válido.");
  if (!PAGOS.includes(c.pago || "")) throw new Err("Forma de pago no válida.");
  if (c.fechaAlta && !/^\d{4}-\d{2}-\d{2}$/.test(c.fechaAlta)) throw new Err("La fecha de alta debe ser AAAA-MM-DD.");
  if (!c.pago) delete c.pago;
  const sv = limpiarServicios(b.servicios);
  if (sv) c.servicios = sv;
  if (!c.servicios) c.servicios = [];
  return c;
}

async function generarPin(env, id) {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  const pin = String(n).padStart(6, "0");
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${id}:${pin}`));
  await env.PINS.put(`pin:${id}`, [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join(""));
  return pin;
}

export async function admin(req, env, { json, igual }) {
  const url = new URL(req.url);
  const ruta = url.pathname.replace(/^\/api\/admin\/?/, "");
  try {
    if (!env.ADMIN_PASSWORD) throw new Err("Falta el secreto ADMIN_PASSWORD en el Worker.", 503);
    const guard = env.GUARD.get(env.GUARD.idFromName("__admin"));
    const estado = await (await guard.fetch("https://do/check")).json();
    if (estado.bloqueado) return json({ error: `Demasiados intentos. Espera ${Math.ceil(estado.segundos / 60)} min.` }, 429);
    if (!igual(req.headers.get("x-admin") || "", env.ADMIN_PASSWORD)) {
      await guard.fetch("https://do/fail", { method: "POST" });
      return json({ error: "Contraseña incorrecta." }, 401);
    }
    await guard.fetch("https://do/ok", { method: "POST" });

    if (ruta === "datos" && req.method === "GET") {
      const g = gh(env);
      const [c, f, k] = await Promise.all([g.leer("src/data/choferes.json"), g.leer("src/data/flotas.json"), env.PINS.list({ prefix: "pin:" })]);
      return json({ choferes: c.datos, flotas: f.datos, conPin: k.keys.map((x) => x.name.slice(4)) });
    }
    if (req.method !== "POST") throw new Err("Método no permitido.", 405);
    const raw = await req.text();
    if (raw.length > 20000) throw new Err("Datos demasiado grandes.", 413);
    const b = JSON.parse(raw || "{}");
    const id = limpio(b.id ?? b.chofer?.id, 40).toLowerCase();
    const F = "src/data/flotas.json", C = "src/data/choferes.json";
    const flotasActuales = async () => (await gh(env).leer(F)).datos;

    if (ruta === "chofer") {
      const flotas = await flotasActuales();
      const nuevo = !!b.nuevo;
      const out = await modificar(env, C, `Editor: ${nuevo ? "alta" : "cambios"} de ${id}`, (lista) => {
        const i = lista.findIndex((x) => x.id === id);
        if (nuevo && i >= 0) throw new Err("Ya existe un chofer con ese id.");
        if (!nuevo && i < 0) throw new Err("Ese chofer ya no existe.");
        const c = normalizarChofer(b.chofer || {}, nuevo ? null : lista[i]);
        if (nuevo) { c.fechaAlta = c.fechaAlta || new Date().toISOString().slice(0, 10); lista.push(c); } else lista[i] = c;
        return lista;
      }, (l) => validarChoferes(l, flotas));
      const resp = { ok: true, choferes: out };
      if (nuevo) resp.pin = await generarPin(env, id);
      return json(resp);
    }
    if (ruta === "chofer/estado") {
      const flotas = await flotasActuales();
      const activo = !!b.activo;
      const out = await modificar(env, C, `Editor: ${activo ? "activar" : "desactivar"} ${id}`, (lista) => {
        const c = lista.find((x) => x.id === id);
        if (!c) throw new Err("Ese chofer ya no existe.");
        if (activo) delete c.activo; else c.activo = false;
        return lista;
      }, (l) => validarChoferes(l, flotas));
      if (!activo) await env.PINS.delete(`pin:${id}`); // desactivado = ya no puede iniciar viajes
      return json({ ok: true, choferes: out });
    }
    if (ruta === "chofer/borrar") {
      const flotas = await flotasActuales();
      const out = await modificar(env, C, `Editor: borrar ${id}`, (lista) => {
        if (!lista.some((x) => x.id === id)) throw new Err("Ese chofer ya no existe.");
        return lista.filter((x) => x.id !== id);
      }, (l) => validarChoferes(l, flotas));
      await env.PINS.delete(`pin:${id}`);
      return json({ ok: true, choferes: out });
    }
    if (ruta === "pin") {
      const { datos } = await gh(env).leer(C);
      if (!datos.some((x) => x.id === id)) throw new Err("Ese chofer no existe.");
      return json({ ok: true, pin: await generarPin(env, id) });
    }
    if (ruta === "flota") {
      const f = b.flota || {};
      const fid = limpio(f.id, 40).toLowerCase();
      const out = await modificar(env, F, `Editor: flota ${fid}`, (lista) => {
        if (!ID_RE.test(fid)) throw new Err("El id de la flota debe ir en minúsculas, sin acentos ni espacios.");
        const nombre = limpio(f.nombre, 60);
        if (!nombre) throw new Err("Falta el nombre de la flota.");
        const wa = String(f.whatsappDueno || "").replace(/\D/g, "");
        if (wa && (wa.length < 10 || wa.length > 13)) throw new Err("El WhatsApp del dueño debe llevar lada (10 a 13 dígitos).");
        const o = { id: fid, nombre, whatsappDueno: wa };
        const i = lista.findIndex((x) => x.id === fid);
        if (i >= 0) lista[i] = { ...lista[i], ...o }; else lista.push(o);
        return lista;
      }, () => {});
      return json({ ok: true, flotas: out });
    }
    if (ruta === "flota/borrar") {
      const { datos } = await gh(env).leer(C);
      const usan = datos.filter((x) => x.flota === id).map((x) => x.nombre);
      if (usan.length) throw new Err(`No se puede borrar: la usan ${usan.join(", ")}. Cámbialos de flota primero.`);
      const out = await modificar(env, F, `Editor: borrar flota ${id}`, (l) => l.filter((x) => x.id !== id), () => {});
      return json({ ok: true, flotas: out });
    }
    throw new Err("Ruta no encontrada.", 404);
  } catch (e) {
    if (e instanceof Err) return json({ error: e.message }, e.status);
    return json({ error: "Error inesperado: " + (e.message || e) }, 500);
  }
}
