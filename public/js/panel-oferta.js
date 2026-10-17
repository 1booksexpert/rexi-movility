// Panel del chofer: activar/desactivar los servicios, tipos, modalidades y zonas que le asignó el administrador.
// Lo apagado se guarda en la nube (/api/chofer/<id>/pausa) y la tarjeta pública deja de mostrarlo.
(function () {
  var box = document.getElementById("oferta");
  if (!box) return;
  var id = box.getAttribute("data-id");
  var msg = document.getElementById("oferta-msg");
  var cajas = Array.prototype.slice.call(box.querySelectorAll("fieldset input[type=checkbox]"));
  var url = "/api/chofer/" + id + "/pausa";
  var clave = function (c) { return c.closest("fieldset").getAttribute("data-clave"); };

  // Estado actual: marcado = activo, desmarcado = pausado.
  fetch(url, { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (p) {
    if (!p) return;
    cajas.forEach(function (c) { c.checked = (p[clave(c)] || []).indexOf(c.value) === -1; });
  }).catch(function () {});

  document.getElementById("oferta-guardar").addEventListener("click", function () {
    var pin = document.getElementById("oferta-pin").value;
    if (!pin) { msg.textContent = "Escribe tu PIN para guardar."; return; }
    var pausa = { servicios: [], tipos: [], modalidades: [], zonas: [] };
    cajas.forEach(function (c) { if (!c.checked) pausa[clave(c)].push(c.value); });
    var btn = this; btn.disabled = true; msg.textContent = "Guardando…";
    fetch(url, { method: "POST", headers: { "x-pin": pin, "content-type": "application/json" }, body: JSON.stringify(pausa) })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (r.ok) { msg.textContent = "Listo. Tu tarjeta ya refleja los cambios (puede tardar hasta un minuto)."; document.getElementById("oferta-pin").value = ""; }
          else if (r.status === 401) msg.textContent = "PIN incorrecto.";
          else if (r.status === 429) msg.textContent = "Demasiados intentos. Espera " + Math.ceil((j.reintentar_en_s || 900) / 60) + " min.";
          else msg.textContent = "No se pudo guardar (" + (j.error || r.status) + ").";
        });
      })
      .catch(function () { msg.textContent = "Sin conexión. Intenta de nuevo."; })
      .then(function () { btn.disabled = false; });
  });
})();
