(function () {
  var $ = function (s) { return document.querySelector(s); };
  var clave = "", D = null, filtro = "todos", q = "", editando = null, editF = null, tToast = 0;
  try { clave = sessionStorage.getItem("rexi-admin") || ""; } catch (e) {}
  var SITIO = location.origin;
  var CAMPOS = ["nombre", "telefono", "id", "titulo", "zona", "placa", "unidad", "flota", "plan", "pago", "referido", "fechaAlta"];
  var PLAN = { tarjeta: "Tarjeta", pro: "Chofer Pro", flota: "Flota" };
  var SV_BASE = [
    { nombre: "Puentes y Local", icono: "🚖", descripcion: "Traslados dentro de la ciudad y a los puentes internacionales.", mensaje: "Hola, necesito un traslado local o a un puente internacional." },
    { nombre: "Aeropuerto", icono: "✈️", descripcion: "Salida programada al aeropuerto.", mensaje: "Hola, quiero cotizar un traslado al aeropuerto." },
    { nombre: "Turismo Médico", icono: "🏥", descripcion: "Traslado puntual a clínicas y hospitales, con espera y regreso.", mensaje: "Hola, necesito un traslado para una consulta médica." },
    { nombre: "Paquetería Urgente", icono: "📦", descripcion: "Sobres, documentos y paquetes pequeños el mismo día.", mensaje: "Hola, necesito enviar un sobre o paquete urgente." },
    { nombre: "Facturación CFDI", icono: "🧾", descripcion: "Servicio con factura para empresas y viajes de trabajo.", mensaje: "Hola, necesito el servicio con factura (CFDI)." }
  ];

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
  function pintar() { pintarResumen(); pintarC(); pintarF(); }

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
    var d = el("div", { "class": "sv" }, [
      el("div", { "class": "grid" }, [
        el("label", { text: "Icono" }, [el("input", { "data-k": "icono", maxlength: "8", value: s.icono || "🚖" })]),
        el("label", { text: "Nombre del servicio" }, [el("input", { "data-k": "nombre", maxlength: "40", value: s.nombre || "" })])
      ]),
      el("label", { text: "Descripción" }, [el("input", { "data-k": "descripcion", maxlength: "160", value: s.descripcion || "" })]),
      el("label", { text: "Mensaje de WhatsApp" }, [el("input", { "data-k": "mensaje", maxlength: "200", value: s.mensaje || "" })]),
      el("button", { type: "button", "class": "peligro", text: "Quitar servicio", onclick: function () { d.remove(); } })
    ]);
    d.dataset.color = s.color || "";
    return d;
  }
  function abrirC(c) {
    editando = c; var f = $("#form-c"); f.reset(); $("#err-c").hidden = true;
    $("#dlg-c-t").textContent = c ? "Editar a " + c.nombre : "Nuevo chofer";
    $("#guardar-c").textContent = c ? "Guardar cambios" : "Crear chofer y generar PIN";
    var sel = f.flota; sel.textContent = ""; sel.appendChild(el("option", { value: "", text: "Independiente (sin flota)" }));
    D.flotas.forEach(function (x) { sel.appendChild(el("option", { value: x.id, text: x.nombre })); });
    var v = c || { fechaAlta: new Date().toISOString().slice(0, 10), servicios: SV_BASE };
    CAMPOS.forEach(function (k) { f[k].value = v[k] || ""; });
    f.id.readOnly = !!c; urlId();
    $("#servicios").textContent = ""; (v.servicios || []).forEach(function (s) { $("#servicios").appendChild(filaSv(s)); });
    $("#dlg-c").showModal();
  }
  function urlId() { $("#id-url").textContent = "Su tarjeta: " + SITIO + "/t/" + ($("#form-c").id.value || "…") + "/"; }
  $("#nuevo-c").onclick = function () { abrirC(null); };
  $("#mas-sv").onclick = function () { $("#servicios").appendChild(filaSv({})); };
  $("#cancel-c").onclick = $("#cerrar-c").onclick = function () { $("#dlg-c").close(); };
  $("#form-c").nombre.addEventListener("input", function (e) { if (!editando) { $("#form-c").id.value = slug(e.target.value); urlId(); } });
  $("#form-c").id.addEventListener("input", urlId);
  $("#form-c").addEventListener("submit", function (ev) {
    ev.preventDefault(); var f = ev.target, o = {};
    CAMPOS.forEach(function (k) { o[k] = f[k].value; });
    o.servicios = [].map.call($("#servicios").children, function (d) {
      var s = {}; [].forEach.call(d.querySelectorAll("[data-k]"), function (i) { s[i.dataset.k] = i.value; }); if (d.dataset.color) s.color = d.dataset.color; return s;
    });
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
  $("#login").addEventListener("submit", function (e) {
    e.preventDefault(); clave = $("#clave").value; $("#err-login").hidden = true;
    cargar().catch(function (er) { clave = ""; var p = $("#err-login"); p.textContent = er.message; p.hidden = false; });
  });
  $("#salir").onclick = function () { try { sessionStorage.removeItem("rexi-admin"); } catch (e) {} location.reload(); };
  function tab(c) { $("#sec-c").hidden = !c; $("#sec-f").hidden = c; $("#tab-c").setAttribute("aria-selected", c); $("#tab-f").setAttribute("aria-selected", !c); }
  $("#tab-c").onclick = function () { tab(true); }; $("#tab-f").onclick = function () { tab(false); };
  $("#buscar").addEventListener("input", function (e) { q = e.target.value; pintarC(); });
  document.addEventListener("click", function (e) { [].forEach.call(document.querySelectorAll("details.mas[open]"), function (d) { if (!d.contains(e.target)) d.open = false; }); });
  if (clave) cargar().catch(function () { clave = ""; });
})();
