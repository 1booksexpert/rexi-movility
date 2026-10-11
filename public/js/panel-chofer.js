// Panel del chofer: inicia un viaje, comparte su GPS y envía el enlace de seguimiento.
(function () {
  var D = U.datos();
  var $ = function (s) { return document.querySelector(s); };
  var LS = function (k, v) {
    try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {}
    return null;
  };
  var KEY = "rexi_" + D.id;
  var viaje = null, watch = null, ultima = null, envio = null, sondeo = null, wake = null, map = null, taxi = null, pax = null, encuadre = false, ajustado = false;

  ["placa", "unidad"].forEach(function (k) { $("#" + k).value = LS(KEY + "_" + k) || D[k] || ""; });
  try { viaje = JSON.parse(LS(KEY + "_viaje") || "null"); } catch (e) {}
  if (D.whatsappDueno) $("#wa-dueno").hidden = false;

  function pinta(ok, titulo, detalle) {
    $("#luz").className = "luz " + (ok === true ? "ok" : ok === false ? "mal" : "");
    $("#estado").textContent = titulo; $("#detalle").textContent = detalle || "";
  }
  function enlaceViaje() { return location.origin + "/viaje/?t=" + viaje.id; }
  function mensaje() {
    return "Hola, soy " + D.nombre + " de " + D.marca + ". Sigue mi llegada en tiempo real aquí: " + enlaceViaje() + "\nPlacas: " + $("#placa").value + ".";
  }
  function enlaces() {
    var cel = $("#cel").value.replace(/\D/g, "");
    if (cel.length === 10) cel = "52" + cel; else if (cel.length < 10) cel = "";
    $("#wa-pax").href = "https://wa.me/" + cel + "?text=" + encodeURIComponent(mensaje());
    if (D.whatsappDueno) $("#wa-dueno").href = "https://wa.me/" + D.whatsappDueno + "?text=" + encodeURIComponent("Viaje en curso de " + D.nombre + " (" + $("#placa").value + "): " + enlaceViaje());
    $("#enlace").textContent = enlaceViaje();
  }
  $("#cel").addEventListener("input", enlaces);
  $("#copiar").addEventListener("click", function () {
    var b = this;
    (navigator.clipboard ? navigator.clipboard.writeText(enlaceViaje()) : Promise.reject()).then(
      function () { b.textContent = "Enlace copiado"; },
      function () { b.textContent = "Mantén presionado el enlace para copiarlo"; });
  });

  function pantallaActiva() {
<<<<<<< HEAD
    $("#inicio").hidden = true; $("#activo").hidden = false;
=======
    $("#inicio").hidden = true; $("#herramientas").hidden = true; $("#activo").hidden = false;
>>>>>>> 183a5c0cc8c6a4256b186c5139295ecc004e4fee
    if (!map) map = U.mapa("mapa", D.centro);
    setTimeout(function () { map.invalidateSize(); }, 200);
    enlaces();
    arrancarGPS();
    sondeo = setInterval(consultarPasajero, 6000);
    envio = setInterval(enviar, 4000);
    pedirPantalla();
  }

  function arrancarGPS() {
    if (watch !== null) return;
    pinta(null, "Buscando señal GPS…");
    watch = navigator.geolocation.watchPosition(function (p) {
      ultima = { lat: p.coords.latitude, lng: p.coords.longitude, spd: p.coords.speed == null ? null : Math.max(0, p.coords.speed * 3.6), hdg: p.coords.heading, acc: p.coords.accuracy };
      var pos = [ultima.lat, ultima.lng];
      if (!taxi) taxi = U.marcador(map, "taxi", pos); else U.mover(taxi, pos);
      if (!encuadre) { map.setView(pos, 16); encuadre = true; }
    }, function (e) {
      pinta(false, "Sin GPS", e.code === 1 ? "Activa el permiso de ubicación para este sitio." : "No se puede leer la ubicación. Sal a cielo abierto.");
    }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
  }

  function enviar() {
    if (!ultima || !viaje) return;
    U.api("/api/trips/" + viaje.id + "/loc", { method: "POST", headers: { "x-token": viaje.token }, body: JSON.stringify(ultima), keepalive: true }).then(function (r) {
      if (r.status === 410 || r.status === 404 || r.status === 403) return cerrar("El viaje ya no está activo.");
      if (!r.ok) throw new Error("http");
      pinta(true, "Compartiendo en vivo", "Precisión GPS ~" + Math.round(ultima.acc) + " m · enviado " + new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }).catch(function () { pinta(false, "Sin conexión", "Reintentando cada 4 segundos. El pasajero ve tu última posición."); });
  }

  function consultarPasajero() {
    if (!viaje) return;
    U.api("/api/trips/" + viaje.id, { headers: { "x-token": viaje.token } }).then(function (r) {
      if (!r.ok || !r.j.pax) return;
      var p = r.j.pax;
      if (!pax) pax = U.marcador(map, "yo", [p.lat, p.lng]); else pax.setLatLng([p.lat, p.lng]);
      var a = $("#ir-pax"); a.hidden = false;
      a.href = "https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=" + p.lat + "," + p.lng;
      a.textContent = ultima ? "Navegar hacia el pasajero (a " + U.km(U.hav(ultima, p)) + ")" : "Navegar hacia el pasajero";
      if (!ajustado && ultima) { ajustado = true; map.fitBounds([[ultima.lat, ultima.lng], [p.lat, p.lng]], { padding: [40, 40] }); }
    });
  }

  function pedirPantalla() {
    if (!("wakeLock" in navigator)) return;
    navigator.wakeLock.request("screen").then(function (l) { wake = l; }, function () {});
  }
  document.addEventListener("visibilitychange", function () { if (!document.hidden && viaje) pedirPantalla(); });

  function cerrar(txt) {
    if (watch !== null) navigator.geolocation.clearWatch(watch);
    watch = null; clearInterval(envio); clearInterval(sondeo);
    if (wake) { try { wake.release(); } catch (e) {} }
    LS(KEY + "_viaje", null); viaje = null; ultima = null; taxi = null; pax = null; encuadre = false; ajustado = false;
    if (map) { map.remove(); map = null; }
<<<<<<< HEAD
    $("#activo").hidden = true; $("#inicio").hidden = false;
=======
    $("#activo").hidden = true; $("#inicio").hidden = false; $("#herramientas").hidden = false;
>>>>>>> 183a5c0cc8c6a4256b186c5139295ecc004e4fee
    $("#ir-pax").hidden = true;
    $("#msg-inicio").textContent = txt || "";
  }

  $("#terminar").addEventListener("click", function () {
    if (!confirm("¿Terminar el viaje? El pasajero dejará de ver tu ubicación.")) return;
    var v = viaje;
    U.api("/api/trips/" + v.id + "/end", { method: "POST", headers: { "x-token": v.token } }).then(function () { cerrar("Viaje terminado."); }, function () { cerrar("Viaje terminado."); });
  });

  $("#inicio").addEventListener("submit", function (e) {
    e.preventDefault();
    var msg = $("#msg-inicio");
    ["placa", "unidad"].forEach(function (k) { LS(KEY + "_" + k, $("#" + k).value); });
    if (!navigator.geolocation) { msg.textContent = "Este navegador no permite compartir ubicación."; return; }
    msg.textContent = "Pidiendo permiso de ubicación…";
    navigator.geolocation.getCurrentPosition(function () {
      msg.textContent = "Creando viaje…";
      U.api("/api/trips", { method: "POST", headers: { "x-pin": $("#pin").value }, body: JSON.stringify({ chofer: D.id, nombre: D.nombre, placa: $("#placa").value, unidad: $("#unidad").value }) }).then(function (r) {
        if (r.status === 401) { msg.textContent = "PIN incorrecto."; return; }
        if (r.status === 429) { msg.textContent = "Demasiados intentos. Espera " + Math.ceil((r.j.reintentar_en_s || 900) / 60) + " min o pide un PIN nuevo al dueño."; return; }
        if (r.status === 503) { msg.textContent = "El servicio de viaje en vivo aún no está configurado."; return; }
        if (!r.ok) { msg.textContent = "No se pudo crear el viaje (" + (r.j.error || r.status) + ")."; return; }
        viaje = { id: r.j.id, token: r.j.token }; LS(KEY + "_viaje", JSON.stringify(viaje));
        $("#pin").value = ""; msg.textContent = ""; pantallaActiva();
      }).catch(function () { msg.textContent = "Sin conexión. Intenta de nuevo."; });
    }, function () { msg.textContent = "Necesitamos el permiso de ubicación para iniciar."; }, { enableHighAccuracy: true, timeout: 15000 });
  });

  // Reanuda si se recargó la página con un viaje en curso.
  if (viaje && viaje.id) {
    U.api("/api/trips/" + viaje.id).then(function (r) {
      if (r.ok && r.j.status === "active") pantallaActiva(); else cerrar("");
    }, function () { pantallaActiva(); });
  }
})();
