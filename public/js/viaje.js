// Seguimiento del viaje para el pasajero (y para quien reciba el enlace).
(function () {
  var D = U.datos();
  var $ = function (s) { return document.querySelector(s); };
  var id = (new URLSearchParams(location.search).get("t") || "").toLowerCase();
  var ultimo = null, yoPos = null, siguiendo = true, parado = false, timer = null, fallos = 0;
  var map = null, taxi = null, yo = null, watch = null, envio = null, ultimaPos = null;

  function pill(txt, cls) { var p = $("#pill"); p.textContent = txt; p.className = "pill " + (cls || ""); }
  function parar() {
    parado = true; clearTimeout(timer); clearInterval(envio);
    if (watch !== null) navigator.geolocation.clearWatch(watch);
  }
  function fin(titulo, texto) {
    pill("Terminado", "fin");
    $("#vista-viaje").hidden = true; $("#vista-fin").hidden = false;
    if (titulo) $("#fin-titulo").textContent = titulo;
    if (texto) $("#fin-texto").textContent = texto;
    parar();
  }

  if (!/^[2-9a-hj-km-np-z]{10}$/.test(id)) { fin("Enlace incompleto", "Pide de nuevo el enlace a tu chofer."); return; }

  map = U.mapa("mapa", D.centro);
  map.on("dragstart", function () { siguiendo = false; });
  $("#centrar").addEventListener("click", function () {
    siguiendo = true;
    if (taxi) map.setView(taxi.getLatLng(), Math.max(map.getZoom(), 16));
  });

  function texto(j) {
    if (!ultimo) return;
    var edad = j.now - ultimo.ts; // ambos con el reloj del servidor
    var rancia = edad > 30000;
    pill(rancia ? "Sin señal" : "En vivo", rancia ? "aviso" : "vivo");
    var l = "Última señal " + U.ago(edad) + (rancia ? ". Si no regresa pronto, llama al chofer." : "");
    var e = $("#eta");
    if (yoPos) {
      var m = U.hav({ lat: ultimo.lat, lng: ultimo.lng }, yoPos);
      e.innerHTML = "<b></b><small></small>";
      e.firstChild.textContent = m < 60 ? "Tu chofer está aquí" : "A " + U.km(m) + " de ti, llega en ~" + U.etaMin(m) + " min";
      e.lastChild.textContent = l + " La hora de llegada es un estimado.";
    } else {
      e.innerHTML = "<b>Tu chofer está en camino</b><small></small>";
      e.lastChild.textContent = l;
    }
  }

  function pintar(j) {
    $("#chofer").textContent = j.nombre || "Tu chofer";
    $("#unidad").textContent = j.unidad || "";
    if (j.placa) { $("#placa").textContent = j.placa; $("#placa").hidden = false; }
    var c = D.directorio[j.choferId];
    $("#llamar").href = c ? "tel:+52" + c.telefono : "#";
    $("#llamar").hidden = !c;
    if (!j.loc) { pill("Esperando", "aviso"); $("#eta").textContent = "El chofer aún no comparte su ubicación."; return; }
    var pos = [j.loc.lat, j.loc.lng];
    if (!taxi) { taxi = U.marcador(map, "taxi", pos); map.setView(pos, 16); }
    else { U.mover(taxi, pos); if (siguiendo) map.panTo(pos, { animate: true, duration: 1 }); }
    ultimo = j.loc;
    texto(j);
  }

  function pedir() {
    if (parado) return;
    U.api("/api/trips/" + id).then(function (r) {
      if (r.status === 404) return fin("Este viaje ya no está disponible", "El enlace caducó o el código no es correcto. Pide uno nuevo a tu chofer.");
      if (!r.ok) throw new Error("http");
      fallos = 0;
      if (r.j.status === "ended") return fin();
      pintar(r.j);
      timer = setTimeout(pedir, document.hidden ? 12000 : 4000);
    }).catch(function () {
      fallos++; pill("Sin conexión", "aviso");
      timer = setTimeout(pedir, Math.min(15000, 3000 * fallos));
    });
  }
  document.addEventListener("visibilitychange", function () { if (!document.hidden && !parado) { clearTimeout(timer); pedir(); } });
  pedir();

  /* Compartir mi ubicación con el chofer: opcional, solo si el pasajero lo decide. */
  $("#compartir-yo").addEventListener("click", function () {
    var b = this;
    if (watch !== null) {
      navigator.geolocation.clearWatch(watch); clearInterval(envio); watch = null;
      b.textContent = "Compartir mi ubicación con el chofer";
      if (yo) { map.removeLayer(yo); yo = null; }
      yoPos = null; return;
    }
    if (!navigator.geolocation) { b.textContent = "Tu teléfono no permite compartir ubicación"; return; }
    b.textContent = "Buscando tu ubicación…";
    watch = navigator.geolocation.watchPosition(function (p) {
      ultimaPos = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy };
      yoPos = ultimaPos;
      if (!yo) yo = U.marcador(map, "yo", [yoPos.lat, yoPos.lng]); else yo.setLatLng([yoPos.lat, yoPos.lng]);
      b.textContent = "Dejar de compartir mi ubicación";
    }, function () {
      b.textContent = "No pudimos leer tu ubicación. Revisa el permiso";
      watch = null;
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
    var enviar = function () { if (ultimaPos) U.api("/api/trips/" + id + "/passenger", { method: "POST", body: JSON.stringify(ultimaPos) }); };
    envio = setInterval(enviar, 8000); setTimeout(enviar, 1500);
  });

  $("#compartir-viaje").addEventListener("click", function () {
    var d = { title: "Sigue mi viaje en taxi", text: "Sigue mi viaje en tiempo real:", url: location.href };
    if (navigator.share) navigator.share(d).catch(function () {});
    else if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(function () { $("#compartir-viaje").textContent = "Enlace copiado"; });
  });
})();
