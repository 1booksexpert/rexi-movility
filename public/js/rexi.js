// Utilidades compartidas por /chofer/[id] y /viaje (mapa, distancias, llamadas a la API).
window.U = (function () {
  var TAXI_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16v-5l2-5h10l2 5v5M3 16h18M7 19v-3M17 19v-3" stroke="#0f172a" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function hav(a, b) { // metros entre {lat,lng} y {lat,lng}
    var R = 6371000, r = Math.PI / 180;
    var dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    var x = Math.pow(Math.sin(dLat / 2), 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.pow(Math.sin(dLng / 2), 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  function km(m) { return m < 1000 ? Math.round(m / 10) * 10 + " m" : (m / 1000).toFixed(1) + " km"; }
  // Estimación gruesa: línea recta x 1.35 a 25 km/h de promedio urbano.
  function etaMin(m) { return Math.max(1, Math.round((m * 1.35) / (25000 / 60))); }
  function ago(ms) {
    var s = Math.max(0, Math.round(ms / 1000));
    if (s < 5) return "ahora";
    if (s < 60) return "hace " + s + " s";
    return "hace " + Math.round(s / 60) + " min";
  }

  function mapa(el, centro) {
    var m = L.map(el, { zoomControl: false }).setView(centro, 14);
    L.control.zoom({ position: "topright" }).addTo(m);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(m);
    return m;
  }
  function marcador(m, tipo, pos) {
    var html = tipo === "taxi" ? '<div class="mk-taxi">' + TAXI_SVG + "</div>" : '<div class="mk-yo"></div>';
    var s = tipo === "taxi" ? 40 : 18;
    return L.marker(pos, { icon: L.divIcon({ className: "", html: html, iconSize: [s, s], iconAnchor: [s / 2, s / 2] }), keyboard: false }).addTo(m);
  }
  // Mueve el marcador con una animación corta para que no "salte".
  function mover(mk, a, ms) {
    var from = mk.getLatLng(), t0 = performance.now(); ms = ms || 1200;
    if (mk._raf) cancelAnimationFrame(mk._raf);
    (function paso(t) {
      var k = Math.min(1, (t - t0) / ms), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      mk.setLatLng([from.lat + (a[0] - from.lat) * e, from.lng + (a[1] - from.lng) * e]);
      if (k < 1) mk._raf = requestAnimationFrame(paso);
    })(t0);
  }
  function api(path, opts) {
    return fetch(path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, j: j }; });
    });
  }
  function datos() {
    var e = document.getElementById("datos");
    try { return JSON.parse(e.textContent); } catch (x) { return {}; }
  }
  return { hav: hav, km: km, etaMin: etaMin, ago: ago, mapa: mapa, marcador: marcador, mover: mover, api: api, datos: datos };
})();
