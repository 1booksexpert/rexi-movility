(function () {
  var $ = function (s) { return document.querySelector(s); };
  var cobertura = [], CAT = { rubros: [], ciudades: [] }, MAX_SV = 16, MAX_COB = 14;
  try { CAT = JSON.parse(document.getElementById("catalogo").textContent); } catch (e) {}
  var COB_BASE = ["Centro y Zona Dorada", "Zona Conurbada", "Parques Industriales", "Puentes Internacionales"];
  var COB_SUG = ["Centro", "Zona conurbada", "Parques industriales", "Puentes internacionales", "Aeropuerto", "Zona de hospitales", "Zona turística", "Universidades", "Central de autobuses", "Zona residencial", "Foráneos"];
  var BOTON = { local: "Pedir taxi", puentes: "Cotizar cruce", aeropuertos: "Cotizar viaje", medico: "Reservar traslado", paqueteria: "Enviar paquete", empresas: "Consultar convenio", cfdi: "Pedir con factura", hora: "Reservar chofer", eventos: "Cotizar evento", adultos: "Pedir apoyo", escolar: "Cotizar traslado" };
  var clave = "", D = null, filtro = "todos", q = "", editando = null, editF = null, editP = null, tToast = 0;
  try { clave = sessionStorage.getItem("rexi-admin") || ""; } catch (e) {}
  var SITIO = location.origin;
  var CAMPOS = ["nombre", "telefono", "id", "titulo", "zona", "ciudad", "placa", "unidad", "flota", "plan", "pago", "referido", "fechaAlta"];
  var PLAN = { tarjeta: "Tarjeta", pro: "Chofer Pro", flota: "Flota" };
  function el(t, a, kids) {
    var n = document.createElement(t);
    for (var k in (a || {})) { if (k === "text") n.textContent = a[k]; else if (k === "onclick") n.onclick = a[k]; else n.setAttribute(k, a[k]); }
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function toast(msg, error) {
    var t = $("#toast"); t.textContent = ""; t.className = error ? "error" : "";
    t.appendChild(el("span", { text: msg })); t.appendChild(el("button", { text: "Cerrar", onclick: function () { t.hidden = true; } }));
    t.hidden = false; clearTimeout(tToast); tToast = setTimeout(function () { t.hidden = true; }, error ? 9000 : 6000);
  }
  function api(ruta, cuerpo) {
    return fetch("/api/admin/" + ruta, { method: cuerpo ? "POST" : "GET", headers: { "x-admin": clave, "content-type": "application/json" }, body: cuerpo ? JSON.stringify(cuerpo) : undefined })
      .then(function (r) { return r.json().catch(function () { return { error: "Respuesta no válida del servidor." }; }).then(function (j) { if (!r.ok) throw new Error(j.error || "Error " + r.status); return j; }); });
  }
  var PUB = "Publicado en GitHub. El sitio se actualiza solo en 1 o 2 minutos.";
  function slug(s) { return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
  function tel(c) { var d = String(c.telefono || "").replace(/\D/g, "").slice(-10); return d.length === 10 ? d.slice(0, 3) + " " + d.slice(3, 6) + " " + d.slice(6) : d; }
  function iniciales(n) { var p = n.trim().split(/\s+/); return ((p[0] || "?")[0] + (p.length > 1 ? p[1][0] : "")).toUpperCase(); }
  function tono(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
  function copiar(t, msg) { try { navigator.clipboard.writeText(t).then(function () { toast(msg); }); } catch (e) { prompt("Copia el texto:", t); } }
  function sinPin(c) { return c.activo !== false && D.conPin.indexOf(c.id) < 0; }

  function cargar() {
    return api("datos").then(function (d) { D = d; $("#login").hidden = true; $("#app").hidden = false; try { sessionStorage.setItem("rexi-admin", clave); } catch (e) {} pintar(); });
  }
  function pintar() { pintarResumen(); pintarC(); pintarF(); pintarP(); }

  function pintarResumen() {
    var n = D.choferes, act = n.filter(function (c) { return c.activo !== false; }).length;
    var items = [["todos", n.length, "Todos"], ["activos", act, "Activos"], ["off", n.length - act, "Desactivados"], ["sinpin", n.filter(sinPin).length, "Sin PIN"]];
    var r = $("#resumen"); r.textContent = "";
    items.forEach(function (i) {
      r.appendChild(el("button", { "aria-pressed": String(filtro === i[0]), onclick: function () { filtro = i[0]; pintarResumen(); pintarC(); } }, [el("b", { text: String(i[1]) }), el("span", { text: i[2] })]));
    });
  }

  function visibles() {
    var t = q.toLowerCase().replace(/\s+/g, " ").trim(), d = t.replace(/\D/g, "");
    return D.choferes.filter(function (c) {
      if (filtro === "activos" && c.activo === false) return false;
      if (filtro === "off" && c.activo !== false) return false;
      if (filtro === "sinpin" && !sinPin(c)) return false;
      if (!t) return true;
      return (c.nombre || "").toLowerCase().indexOf(t) >= 0 || (c.placa || "").toLowerCase().indexOf(t) >= 0 || (d.length > 2 && String(c.telefono).indexOf(d) >= 0);
    });
  }

  function pintarC() {
    var ul = $("#lista-c"); ul.textContent = "";
    var lista = visibles();
    lista.forEach(function (c) {
      var off = c.activo === false;
      var flota = (D.flotas.filter(function (f) { return f.id === c.flota; })[0] || {}).nombre;
      var sw = el("label", { "class": "sw" }, [el("input", { type: "checkbox", role: "switch", "aria-label": "Activo: " + c.nombre }), el("i"), el("span", { text: off ? "Desactivado" : "Activo" })]);
      sw.firstChild.checked = !off;
      sw.firstChild.onchange = function (e) { estado(c, e.target.checked, e.target); };
      var tags = [];
      if (c.placa) tags.push(el("span", { "class": "placa", text: c.placa }));
      if (c.plan) tags.push(el("span", { "class": "chip", text: (PLAN[c.plan] || c.plan) + (c.pago === "anual" ? " anual" : "") }));
      if (sinPin(c)) tags.push(el("button", { "class": "sinpin", text: "Sin PIN: generar", onclick: function () { pin(c, true); } }));
      var menu = el("div", { "class": "menu" }, [
        el("button", { text: "Generar PIN nuevo", onclick: function () { pin(c); } }),
        el("button", { text: "Copiar enlace de la tarjeta", onclick: function () { copiar(SITIO + "/t/" + c.id + "/", "Enlace de la tarjeta copiado."); } }),
        el("button", { text: "Copiar enlace del panel", onclick: function () { copiar(SITIO + "/chofer/" + c.id + "/", "Enlace del panel copiado."); } }),
        el("button", { "class": "peligro", text: "Borrar chofer", onclick: function () { borrar(c); } })
      ]);
      ul.appendChild(el("li", { "class": "chofer" + (off ? " off" : "") }, [
        el("div", { "class": "avatar", style: "--h:" + tono(c.id), "aria-hidden": "true", text: iniciales(c.nombre) }),
        el("div", {}, [el("h3", { text: c.nombre }), el("div", { "class": "sub", text: tel(c) + " · " + (flota || "Independiente") })]),
        sw,
        el("div", { "class": "tags" }, tags),
        el("div", { "class": "acc" }, [
          el("button", { text: "Editar", onclick: function () { abrirC(c); } }),
          el("details", { "class": "mas" }, [el("summary", { "aria-label": "Más acciones de " + c.nombre, text: "⋯" }), menu])
        ])
      ]));
    });
    if (!lista.length) {
      var hay = D.choferes.length > 0;
      ul.appendChild(el("li", { "class": "vacio" }, [
        el("p", { text: hay ? "Ningún chofer coincide con la búsqueda o el filtro." : "Todavía no hay choferes. Agrega al primero para generar su tarjeta." }),
        hay ? el("button", { text: "Quitar filtros", onclick: function () { filtro = "todos"; q = ""; $("#buscar").value = ""; pintarResumen(); pintarC(); } }) : el("button", { "class": "btn-main", text: "Nuevo chofer", onclick: function () { abrirC(null); } })
      ]));
    }
  }
  function pintarF() {
    var ul = $("#lista-f"); ul.textContent = "";
    D.flotas.forEach(function (f) {
      var n = D.choferes.filter(function (c) { return c.flota === f.id; }).length;
      ul.appendChild(el("li", { "class": "chofer" }, [
        el("div", { "class": "avatar", style: "--h:" + tono(f.id), "aria-hidden": "true", text: iniciales(f.nombre) }),
        el("div", {}, [el("h3", { text: f.nombre }), el("div", { "class": "sub", text: n + (n === 1 ? " chofer" : " choferes") + " · Dueño: " + (f.whatsappDueno || "usa el WhatsApp general") })]),
        el("span"),
        el("div", { "class": "acc" }, [
          el("button", { text: "Editar", onclick: function () { abrirF(f); } }),
          el("button", { "class": "peligro", text: "Borrar", onclick: function () { borrarF(f); } })
        ])
      ]));
    });
    if (!D.flotas.length) ul.appendChild(el("li", { "class": "vacio" }, [el("p", { text: "No hay flotas. Los choferes sin flota son independientes y usan el WhatsApp general." })]));
  }

  // ---- Acciones
  function estado(c, activar, caja) {
    if (!activar && !confirm("¿Desactivar a " + c.nombre + "?\nSu tarjeta mostrará un aviso, saldrá del directorio y su PIN dejará de funcionar.")) { caja.checked = true; return; }
    caja.disabled = true;
    api("chofer/estado", { id: c.id, activo: activar }).then(function (r) {
      D.choferes = r.choferes; if (!activar) D.conPin = D.conPin.filter(function (x) { return x !== c.id; });
      pintar(); toast(activar ? c.nombre + " está activo. Genera un PIN nuevo para que pueda iniciar viajes. " : c.nombre + " quedó desactivado. " + PUB);
    }).catch(function (e) { toast(e.message, true); pintar(); });
  }
  function borrar(c) {
    if (!confirm("¿Borrar a " + c.nombre + " definitivamente?\nSu tarjeta y su QR dejarán de existir. Para ocultarlo sin perder sus datos, usa el interruptor Activo.")) return;
    api("chofer/borrar", { id: c.id }).then(function (r) { D.choferes = r.choferes; D.conPin = D.conPin.filter(function (x) { return x !== c.id; }); pintar(); toast(c.nombre + " se borró. " + PUB); })
      .catch(function (e) { toast(e.message, true); });
  }
  function pin(c, directo) {
    if (!directo && !confirm("¿Generar un PIN nuevo para " + c.nombre + "? El anterior dejará de servir.")) return;
    api("pin", { id: c.id }).then(function (r) { if (D.conPin.indexOf(c.id) < 0) D.conPin.push(c.id); pintar(); mostrarPin(c, r.pin); }).catch(function (e) { toast(e.message, true); });
  }
  function mostrarPin(c, p) {
    $("#pin-quien").textContent = c.nombre; $("#pin-val").textContent = p;
    var d = String(c.telefono || "").replace(/\D/g, "").slice(-10);
    var txt = "Hola " + c.nombre.split(" ")[0] + ", tu PIN de REXI es " + p + ". Tu panel: " + SITIO + "/chofer/" + c.id + "/";
    var wa = $("#pin-wa"); wa.hidden = d.length !== 10; wa.href = "https://wa.me/52" + d + "?text=" + encodeURIComponent(txt);
    $("#dlg-pin").showModal();
  }
  $("#pin-ok").onclick = function () { $("#pin-val").textContent = ""; $("#pin-wa").href = "#"; $("#dlg-pin").close(); };
  $("#pin-copiar").onclick = function () { copiar($("#pin-val").textContent, "PIN copiado."); };

  // ---- Formulario de chofer
  function filaSv(s) {
    function mover(d) { var n = d < 0 ? row.previousElementSibling : row.nextElementSibling; if (!n) return; if (d < 0) n.before(row); else n.after(row); pintarSv(); }
    var row = el("div", { "class": "sv" }, [
      el("div", { "class": "sv-cab" }, [
        el("b", { "class": "sv-t", text: s.nombre || "Servicio nuevo" }),
        el("div", { "class": "fila-btn" }, [
          el("button", { type: "button", "class": "ghost", "aria-label": "Subir servicio", text: "↑", onclick: function () { mover(-1); } }),
          el("button", { type: "button", "class": "ghost", "aria-label": "Bajar servicio", text: "↓", onclick: function () { mover(1); } }),
          el("button", { type: "button", "class": "peligro ghost", text: "Quitar", onclick: function () { row.remove(); pintarSv(); } })
        ])
      ]),
      el("div", { "class": "grid" }, [
        el("label", { text: "Icono" }, [el("input", { "data-k": "icono", maxlength: "8", value: s.icono || "🚖" })]),
        el("label", { text: "Nombre del servicio" }, [el("input", { "data-k": "nombre", maxlength: "60", value: s.nombre || "" })])
      ]),
      el("label", { text: "Descripción en la tarjeta" }, [el("input", { "data-k": "descripcion", maxlength: "160", value: s.descripcion || "" })]),
      el("label", { text: "Mensaje de WhatsApp" }, [el("input", { "data-k": "mensaje", maxlength: "200", value: s.mensaje || "" })]),
      el("label", { text: "Texto del botón" }, [el("input", { "data-k": "boton", maxlength: "24", value: s.boton || "", placeholder: "Pedir por WhatsApp" })])
    ]);
    row.dataset.color = s.color || "";
    row.querySelector('[data-k="nombre"]').addEventListener("input", function (e) { row.querySelector(".sv-t").textContent = e.target.value || "Servicio nuevo"; });
    return row;
  }
  function pintarSv() {
    var n = $("#servicios").children.length;
    $("#sv-vacio").hidden = n > 0; $("#sv-cuenta").textContent = n + " de " + MAX_SV;
  }
  function agregarSv(s) {
    if ($("#servicios").children.length >= MAX_SV) { toast("Máximo " + MAX_SV + " servicios por tarjeta.", true); return false; }
    $("#servicios").appendChild(filaSv(s)); pintarSv(); return true;
  }
  function nombresSv() { return [].map.call($("#servicios").querySelectorAll('[data-k="nombre"]'), function (i) { return i.value.trim().toLowerCase(); }); }

  // ---- Zonas de cobertura
  function pintarCob() {
    var c = $("#cob-chips"); c.textContent = "";
    cobertura.forEach(function (z, i) { c.appendChild(el("button", { type: "button", "class": "chip-on", "aria-label": "Quitar " + z, text: z + " ✕", onclick: function () { cobertura.splice(i, 1); pintarCob(); } })); });
    if (!cobertura.length) c.appendChild(el("span", { "class": "ayuda", text: "Sin zonas: la sección no se muestra en la tarjeta." }));
    var ciudad = ciudadSel(), sug = COB_SUG.concat(ciudad ? [ciudad.corto] : []).concat(COB_BASE);
    var lo = cobertura.map(function (x) { return x.toLowerCase(); }), vistos = {};
    var sg = $("#cob-sug"); sg.textContent = "";
    sug.forEach(function (z) { var k = z.toLowerCase(); if (lo.indexOf(k) >= 0 || vistos[k]) return; vistos[k] = 1; sg.appendChild(el("button", { type: "button", text: "+ " + z, onclick: function () { addCob(z); } })); });
  }
  function addCob(z) {
    z = (z || "").trim(); if (!z) return;
    if (cobertura.some(function (x) { return x.toLowerCase() === z.toLowerCase(); })) return;
    if (cobertura.length >= MAX_COB) { toast("Máximo " + MAX_COB + " zonas.", true); return; }
    cobertura.push(z.slice(0, 40)); pintarCob();
  }
  function ciudadSel() { var id = $("#form-c").ciudad.value; return CAT.ciudades.filter(function (c) { return c.id === id; })[0] || null; }

  // ---- Catálogo
  function rellenar(t, ciudad, lugares) { return t.replace(/\{ciudad\}/g, ciudad ? ciudad.corto : "tu ciudad").replace(/\{lugares\}/g, lugares || "").replace(/\s+/g, " ").replace(/\.\./g, ".").trim(); }
  function lista(l) { var a = l.slice(0, 4); var t = a.length > 1 ? a.slice(0, -1).join(", ") + " y " + a[a.length - 1] : a[0] || ""; return t + (l.length > 4 ? " y más" : "") + "."; }
  function itemsCat(ciudad) {
    var out = [];
    CAT.rubros.forEach(function (r) {
      var lug = ciudad && ciudad.lugares[r.id] || [];
      var boton = BOTON[r.id] || "Cotizar por WhatsApp";
      if (r.categoria && !lug.length) return;
      out.push({ grupo: r.categoria ? "En " + ciudad.corto : "Servicios generales", s: { nombre: r.nombre, icono: r.icono, descripcion: rellenar(r.plantilla, ciudad, lista(lug)), mensaje: rellenar(r.mensaje, ciudad), boton: boton }, lugares: lug.map(function (l) { return { nombre: l, icono: r.icono, descripcion: r.nombre, mensaje: "Hola, necesito un traslado a " + l + ".", boton: "Cotizar viaje" }; }) });
    });
    return out;
  }
  var catSel = [];
  function pintarCat() {
    var ciudad = CAT.ciudades.filter(function (c) { return c.id === $("#cat-ciudad").value; })[0] || null;
    var q = $("#cat-buscar").value.toLowerCase().trim(), ya = nombresSv(), box = $("#cat-lista"), ultimo = "";
    box.textContent = ""; catSel = [];
    function fila(s, extra) {
      var dup = ya.indexOf(s.nombre.toLowerCase()) >= 0, cb = el("input", { type: "checkbox" });
      cb.disabled = dup; cb.onchange = function () { var i = catSel.indexOf(s); if (cb.checked && i < 0) catSel.push(s); if (!cb.checked && i >= 0) catSel.splice(i, 1); $("#cat-cuenta").textContent = catSel.length ? catSel.length + " seleccionados" : ""; };
      return el("label", { "class": "cat-item" + (dup ? " ya" : "") }, [cb, el("span", { text: s.nombre + (dup ? " (ya está)" : "") }), el("small", { text: extra || s.descripcion })]);
    }
    itemsCat(ciudad).forEach(function (it) {
      var hit = !q || it.s.nombre.toLowerCase().indexOf(q) >= 0 || it.s.descripcion.toLowerCase().indexOf(q) >= 0;
      var lug = it.lugares.filter(function (l) { return !q || hit || l.nombre.toLowerCase().indexOf(q) >= 0; });
      if (!hit && !lug.length) return;
      if (it.grupo !== ultimo) { ultimo = it.grupo; box.appendChild(el("div", { "class": "cat-grupo", text: it.grupo })); }
      if (hit) box.appendChild(fila(it.s));
      if (lug.length) {
        var d = el("details", { "class": "lug" }, [el("summary", { text: "Lugares específicos (" + lug.length + ")" })]);
        if (q) d.open = true;
        lug.forEach(function (l) { d.appendChild(fila(l, "Servicio individual")); });
        box.appendChild(d);
      }
    });
    if (!box.children.length) box.appendChild(el("p", { "class": "ayuda", text: "Sin resultados. Prueba otra palabra o crea un servicio propio." }));
    $("#cat-cuenta").textContent = "";
  }
  function abrirCat() {
    var sel = $("#cat-ciudad"); sel.textContent = ""; sel.appendChild(el("option", { value: "", text: "Solo servicios generales" }));
    CAT.ciudades.forEach(function (c) { sel.appendChild(el("option", { value: c.id, text: c.corto + ", " + c.estado })); });
    sel.value = $("#form-c").ciudad.value || ""; $("#cat-buscar").value = ""; pintarCat(); $("#dlg-cat").showModal();
  }
  $("#del-cat").onclick = abrirCat;
  $("#cat-ciudad").onchange = pintarCat; $("#cat-buscar").addEventListener("input", pintarCat);
  $("#cerrar-cat").onclick = function () { $("#dlg-cat").close(); };
  $("#cat-ok").onclick = function () {
    var n = 0; catSel.forEach(function (s) { if (agregarSv(s)) n++; });
    $("#dlg-cat").close(); if (n) toast(n + (n === 1 ? " servicio agregado" : " servicios agregados") + ". Revisa los textos y pulsa Guardar.");
  };

  function abrirC(c) {
    editando = c; var f = $("#form-c"); f.reset(); $("#err-c").hidden = true;
    $("#dlg-c-t").textContent = c ? "Editar a " + c.nombre : "Nuevo chofer";
    $("#guardar-c").textContent = c ? "Guardar cambios" : "Crear chofer y generar PIN";
    var sel = f.flota; sel.textContent = ""; sel.appendChild(el("option", { value: "", text: "Independiente (sin flota)" }));
    D.flotas.forEach(function (x) { sel.appendChild(el("option", { value: x.id, text: x.nombre })); });
    var cs = f.ciudad; cs.textContent = ""; cs.appendChild(el("option", { value: "", text: "Sin ciudad (solo servicios generales)" }));
    CAT.ciudades.forEach(function (x) { cs.appendChild(el("option", { value: x.id, text: x.corto + ", " + x.estado })); });
    var v = c || { fechaAlta: new Date().toISOString().slice(0, 10), servicios: [] };
    CAMPOS.forEach(function (k) { f[k].value = v[k] || ""; });
    f.id.readOnly = !!c; urlId();
    $("#servicios").textContent = ""; (v.servicios || []).forEach(function (s) { $("#servicios").appendChild(filaSv(s)); }); pintarSv();
    cobertura = c ? (Array.isArray(c.cobertura) ? c.cobertura.slice() : COB_BASE.slice()) : []; pintarCob();
    $("#dlg-c").showModal();
  }
  function urlId() { $("#id-url").textContent = "Su tarjeta: " + SITIO + "/t/" + ($("#form-c").id.value || "…") + "/"; }
  $("#nuevo-c").onclick = function () { abrirC(null); };
  $("#mas-sv").onclick = function () { agregarSv({}); };
  $("#cob-add").onclick = function () { addCob($("#cob-nuevo").value); $("#cob-nuevo").value = ""; $("#cob-nuevo").focus(); };
  $("#cob-nuevo").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); $("#cob-add").click(); } });
  $("#form-c").ciudad.addEventListener("change", pintarCob);
  $("#cancel-c").onclick = $("#cerrar-c").onclick = function () { $("#dlg-c").close(); };
  $("#form-c").nombre.addEventListener("input", function (e) { if (!editando) { $("#form-c").id.value = slug(e.target.value); urlId(); } });
  $("#form-c").id.addEventListener("input", urlId);
  $("#form-c").addEventListener("submit", function (ev) {
    ev.preventDefault(); var f = ev.target, o = {};
    CAMPOS.forEach(function (k) { o[k] = f[k].value; });
    o.servicios = [].map.call($("#servicios").children, function (d) {
      var s = {}; [].forEach.call(d.querySelectorAll("[data-k]"), function (i) { s[i.dataset.k] = i.value; }); if (d.dataset.color) s.color = d.dataset.color; return s;
    });
    o.cobertura = cobertura.slice();
    var b = $("#guardar-c"), txt = b.textContent; b.disabled = true; b.textContent = "Guardando…";
    api("chofer", { nuevo: !editando, id: o.id, chofer: o }).then(function (r) {
      D.choferes = r.choferes; $("#dlg-c").close();
      if (r.pin) D.conPin.push(o.id);
      pintar();
      if (r.pin) mostrarPin({ nombre: o.nombre, telefono: o.telefono, id: o.id }, r.pin);
      toast((editando ? "Cambios guardados. " : o.nombre + " se agregó. ") + PUB);
    }).catch(function (e) { var p = $("#err-c"); p.textContent = e.message; p.hidden = false; p.scrollIntoView({ block: "nearest" }); })
      .then(function () { b.disabled = false; b.textContent = txt; });
  });

  // ---- Flotas
  function abrirF(f) {
    editF = f; var form = $("#form-f"); form.reset(); $("#err-f").hidden = true;
    ["nombre", "id", "whatsappDueno"].forEach(function (k) { form[k].value = f ? f[k] || "" : ""; });
    form.id.readOnly = !!f; $("#dlg-f").showModal();
  }
  $("#nueva-f").onclick = function () { abrirF(null); };
  $("#cancel-f").onclick = $("#cerrar-f").onclick = function () { $("#dlg-f").close(); };
  $("#form-f").nombre.addEventListener("input", function (e) { if (!editF) $("#form-f").id.value = slug(e.target.value); });
  $("#form-f").addEventListener("submit", function (ev) {
    ev.preventDefault(); var f = ev.target;
    api("flota", { flota: { id: f.id.value, nombre: f.nombre.value, whatsappDueno: f.whatsappDueno.value } })
      .then(function (r) { D.flotas = r.flotas; $("#dlg-f").close(); pintar(); toast("Flota guardada. " + PUB); })
      .catch(function (e) { var p = $("#err-f"); p.textContent = e.message; p.hidden = false; });
  });
  function borrarF(f) {
    if (!confirm("¿Borrar la flota " + f.nombre + "?")) return;
    api("flota/borrar", { id: f.id }).then(function (r) { D.flotas = r.flotas; pintar(); toast("Flota borrada. " + PUB); }).catch(function (e) { toast(e.message, true); });
  }

  // ---- Entrada, pestañas y búsqueda
  // ---- Paquetes de venta (los precios viven en src/data/planes.json)
  function pesos(n) { return "$" + Number(n || 0).toLocaleString("es-MX"); }
  function pintarP() {
    var P = D.planes || { oferta: {}, paquetes: [] };
    var o = P.oferta || {};
    $("#oferta-p").textContent = "Oferta: " + (o.titulo || "sin título") + " | " + (o.activa ? "activa" : "apagada") + " | cupo " + (o.cupo || 0) + (o.hasta ? " | hasta " + o.hasta : " | sin límite");
    var ul = $("#lista-p"); ul.textContent = "";
    (P.paquetes || []).forEach(function (p) {
      ul.appendChild(el("li", { "class": "chofer" }, [
        el("div", { "class": "avatar", style: "--h:" + tono(p.id), "aria-hidden": "true", text: (p.nombre || "?")[0] }),
        el("div", {}, [
          el("h3", { text: p.nombre + (p.destacado ? " · " + (p.etiqueta || "destacado") : "") }),
          el("div", { "class": "sub", text: pesos(p.precioMensual) + (p.porChofer ? " por chofer" : "") + " · alta " + pesos(p.altaLanzamiento) + " · anual " + pesos(p.anual) }),
        ]),
        el("span"),
        el("div", { "class": "acc" }, [el("button", { text: "Editar", onclick: function () { abrirP(p); } })]),
      ]));
    });
    if (!(P.paquetes || []).length) ul.appendChild(el("li", { "class": "vacio" }, [el("p", { text: "El Worker todavía no entrega los paquetes. Falta desplegar api/." })]));
  }

  function abrirP(p) {
    editP = p; var f = $("#form-p"); f.reset(); $("#err-p").hidden = true;
    f.nombre.value = p.nombre || ""; f.etiqueta.value = p.etiqueta || ""; f.resumen.value = p.resumen || "";
    ["precioMensual", "alta", "altaLanzamiento", "anual", "renovacion"].forEach(function (k) { f[k].value = p[k]; });
    f.anualPct.value = p.anualPct == null ? "" : p.anualPct;
    f.porChofer.checked = !!p.porChofer; f.destacado.checked = !!p.destacado;
    f.caracteristicas.value = (p.caracteristicas || []).join("\n");
    $("#dlg-p").showModal();
  }
  $("#cancel-p").onclick = function () { $("#dlg-p").close(); };
  $("#form-p").addEventListener("submit", function (ev) {
    ev.preventDefault(); var f = ev.target; var b = f.querySelector("[type=submit]");
    var p = {
      id: editP.id, nombre: f.nombre.value.trim(), etiqueta: f.etiqueta.value.trim(), resumen: f.resumen.value.trim(),
      precioMensual: Number(f.precioMensual.value), alta: Number(f.alta.value), altaLanzamiento: Number(f.altaLanzamiento.value),
      anual: Number(f.anual.value), renovacion: Number(f.renovacion.value),
      anualPct: f.anualPct.value === "" ? null : Number(f.anualPct.value),
      porChofer: f.porChofer.checked, destacado: f.destacado.checked,
      caracteristicas: f.caracteristicas.value.split("\n").map(function (x) { return x.trim(); }).filter(Boolean),
    };
    var nuevo = JSON.parse(JSON.stringify(D.planes || { oferta: {}, paquetes: [] }));
    nuevo.paquetes = nuevo.paquetes.map(function (x) { return x.id === p.id ? p : x; });
    b.disabled = true;
    api("planes", nuevo).then(function (r) { D.planes = r.planes; $("#dlg-p").close(); pintarP(); toast("Paquete guardado. " + PUB); })
      .catch(function (e) { var q = $("#err-p"); q.textContent = e.message; q.hidden = false; })
      .then(function () { b.disabled = false; });
  });

  function abrirOf() {
    var o = (D.planes && D.planes.oferta) || {}; var f = $("#form-of"); f.reset(); $("#err-of").hidden = true;
    f.titulo.value = o.titulo || ""; f.nota.value = o.nota || ""; f.activa.checked = !!o.activa;
    f.cupo.value = o.cupo == null ? 0 : o.cupo; f.hasta.value = o.hasta || "";
    $("#dlg-of").showModal();
  }
  $("#editar-of").onclick = abrirOf;
  $("#cancel-of").onclick = function () { $("#dlg-of").close(); };
  $("#form-of").addEventListener("submit", function (ev) {
    ev.preventDefault(); var f = ev.target; var b = f.querySelector("[type=submit]");
    var nuevo = JSON.parse(JSON.stringify(D.planes || { oferta: {}, paquetes: [] }));
    nuevo.oferta = { titulo: f.titulo.value.trim(), activa: f.activa.checked, cupo: Number(f.cupo.value), hasta: f.hasta.value.trim(), nota: f.nota.value.trim() };
    b.disabled = true;
    api("planes", nuevo).then(function (r) { D.planes = r.planes; $("#dlg-of").close(); pintarP(); toast("Oferta guardada. " + PUB); })
      .catch(function (e) { var q = $("#err-of"); q.textContent = e.message; q.hidden = false; })
      .then(function () { b.disabled = false; });
  });

  $("#login").addEventListener("submit", function (e) {
    e.preventDefault(); clave = $("#clave").value; $("#err-login").hidden = true;
    cargar().catch(function (er) { clave = ""; var p = $("#err-login"); p.textContent = er.message; p.hidden = false; });
  });
  $("#salir").onclick = function () { try { sessionStorage.removeItem("rexi-admin"); } catch (e) {} location.reload(); };
  function tab(id) {
    ["c", "f", "p"].forEach(function (k) {
      $("#sec-" + k).hidden = k !== id;
      $("#tab-" + k).setAttribute("aria-selected", String(k === id));
    });
  }
  $("#tab-c").onclick = function () { tab("c"); }; $("#tab-f").onclick = function () { tab("f"); }; $("#tab-p").onclick = function () { tab("p"); };
  $("#buscar").addEventListener("input", function (e) { q = e.target.value; pintarC(); });
  document.addEventListener("click", function (e) { [].forEach.call(document.querySelectorAll("details.mas[open]"), function (d) { if (!d.contains(e.target)) d.open = false; }); });
  if (clave) cargar().catch(function () { clave = ""; });
})();
