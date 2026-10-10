// Genera la tarjeta física (frente y reverso) con canvas, a 300 DPI.
// Medidas: tarjeta 9 x 5 cm; para imprenta se agregan 3 mm de sangrado por lado.
(function () {
  var cfg = JSON.parse(document.getElementById('cfgTarjeta').textContent);
  var DPI = 300, mm = function (v) { return Math.round(v * DPI / 25.4); };
  var W = mm(90), H = mm(50), B = mm(3);            // tarjeta y sangrado en px (1063 x 591, 35)
  var AMARILLO = '#ffc72c', NARANJA = '#b45309', TINTA = '#0f172a', GRIS = '#334155';
  var FUENTE = 'Inter, "Segoe UI", system-ui, sans-serif';
  var EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

  var img = { logo: null, foto: null, qr: null };

  function cargar(src) {
    return new Promise(function (ok) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { ok(null); }; i.src = src; });
  }
  function qrImagen() {
    var m = cfg.qrSvg.match(/viewBox="0 0 (\d+) (\d+)"/); var n = m ? +m[1] : 33;
    var lado = n * Math.floor(340 / n);               // múltiplo entero de módulos = bordes nítidos
    var svg = cfg.qrSvg.replace('<svg ', '<svg width="' + lado + '" height="' + lado + '" ');
    return cargar('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)).then(function (i) { return { i: i, lado: lado }; });
  }

  function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : (c.moveTo(x + r, y), c.arcTo(x + w, y, x + w, y + h, r), c.arcTo(x + w, y + h, x, y + h, r), c.arcTo(x, y + h, x, y, r), c.arcTo(x, y, x + w, y, r), c.closePath()); }
  function ajustar(c, texto, peso, tam, ancho, familia) {
    do { c.font = peso + ' ' + tam + 'px ' + (familia || FUENTE); tam -= 2; } while (c.measureText(texto).width > ancho && tam > 20);
    return tam + 2;
  }

  // ---- FRENTE (x0,y0 = esquina de la tarjeta ya recortada) ----
  function frente(c, x0, y0, sangre) {
    var b = sangre ? B : 0;
    c.fillStyle = '#fff'; c.fillRect(x0 - b, y0 - b, W + 2 * b, H + 2 * b);
    c.fillStyle = AMARILLO; c.fillRect(x0 - b, y0 + H - 28, W + 2 * b, 28 + b);          // franja inferior

    var conFoto = !!img.foto, rx = x0 + 380, rw = W - 380 - 47, top;
    if (conFoto) {
      var cx = x0 + 190, cy = y0 + 232, r = 128;
      c.save(); c.beginPath(); c.arc(cx, cy, r + 12, 0, 6.2832); c.fillStyle = AMARILLO; c.fill();
      c.beginPath(); c.arc(cx, cy, r, 0, 6.2832); c.clip();
      var s = Math.max(2 * r / img.foto.width, 2 * r / img.foto.height), dw = img.foto.width * s, dh = img.foto.height * s;
      c.drawImage(img.foto, cx - dw / 2, cy - dh / 2, dw, dh); c.restore();
      if (img.logo) { var lh = 118, lw = lh * img.logo.width / img.logo.height; c.drawImage(img.logo, x0 + W - 47 - lw, y0 + 38, lw, lh); }
      top = 205;
    } else {
      if (img.logo) { var h2 = 300, w2 = h2 * img.logo.width / img.logo.height; c.drawImage(img.logo, x0 + 190 - w2 / 2, y0 + 110, w2, h2); }
      top = 120;
    }

    var palabras = cfg.nombre.trim().split(/\s+/), nombre = palabras[0], resto = palabras.slice(1), lineas = [];
    if (resto.length <= 2) lineas = resto; else { var mitad = Math.ceil(resto.length / 2); lineas = [resto.slice(0, mitad).join(' '), resto.slice(mitad).join(' ')]; }
    c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.fillStyle = TINTA;
    var t = ajustar(c, nombre, 800, 88, rw); var y = y0 + top + t * 0.85; c.fillText(nombre, rx, y);
    c.fillStyle = GRIS;
    lineas.forEach(function (l) { var t2 = ajustar(c, l, 600, 44, rw); y += t2 + 12; c.fillText(l, rx, y); });
    y += 58; c.fillStyle = NARANJA;
    var tt = ajustar(c, cfg.titulo.toUpperCase(), 800, 31, rw); c.fillText(cfg.titulo.toUpperCase(), rx, y);

    var py = Math.min(y + 34, y0 + H - 28 - 30 - 96);
    c.fillStyle = AMARILLO; rr(c, rx, py, rw, 96, 48); c.fill();
    c.fillStyle = '#000'; c.textAlign = 'center'; c.textBaseline = 'middle';
    ajustar(c, cfg.telefono, 800, 64, rw - 60); c.fillText(cfg.telefono, rx + rw / 2, py + 50);
    c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  }

  // ---- REVERSO ----
  function reverso(c, x0, y0, sangre) {
    var b = sangre ? B : 0;
    c.fillStyle = '#fff'; c.fillRect(x0 - b, y0 - b, W + 2 * b, H + 2 * b);
    c.fillStyle = AMARILLO; c.fillRect(x0 - b, y0 - b, 14 + b, H + 2 * b);                 // franja izquierda

    c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.fillStyle = TINTA;
    c.font = '800 46px ' + FUENTE; c.fillText('Servicios', x0 + 60, y0 + 100);
    cfg.servicios.forEach(function (s, i) {
      var y = y0 + 175 + i * 70;
      c.font = '40px ' + EMOJI; c.fillText(s.icono || '🚖', x0 + 60, y);
      var t = ajustar(c, s.nombre, 600, 36, 400); c.fillStyle = TINTA; c.fillText(s.nombre, x0 + 125, y - 2);
    });

    if (img.qr && img.qr.i) {
      var q = img.qr.lado, pad = 22, bx = x0 + 600 + (416 - q - 2 * pad) / 2, by = y0 + 50;
      c.fillStyle = '#fff'; c.strokeStyle = '#cbd5e1'; c.lineWidth = 3; rr(c, bx, by, q + 2 * pad, q + 2 * pad, 18); c.fill(); c.stroke();
      c.imageSmoothingEnabled = false; c.drawImage(img.qr.i, bx + pad, by + pad, q, q); c.imageSmoothingEnabled = true;
    }
    c.fillStyle = TINTA; c.textAlign = 'center';
    c.font = '800 27px ' + FUENTE;
    c.fillText('ESCANEA PARA GUARDAR', x0 + 808, y0 + 478); c.fillText('ESTA TARJETA', x0 + 808, y0 + 512);
    c.textAlign = 'left';
  }

  function lienzo(w, h) { var cv = document.createElement('canvas'); cv.width = w; cv.height = h; var c = cv.getContext('2d'); c.imageSmoothingQuality = 'high'; return { cv: cv, c: c }; }
  function individual(lado) { var l = lienzo(W + 2 * B, H + 2 * B); (lado === 'frente' ? frente : reverso)(l.c, B, B, true); return l.cv; }

  function hoja(lado) {
    var PW = mm(215.9), PH = mm(279.4), l = lienzo(PW, PH), c = l.c;
    c.fillStyle = '#fff'; c.fillRect(0, 0, PW, PH);
    var mx = Math.round((PW - 2 * W) / 2), my = Math.round((PH - 5 * H) / 2);
    for (var f = 0; f < 5; f++) for (var k = 0; k < 2; k++) (lado === 'frente' ? frente : reverso)(c, mx + k * W, my + f * H, false);
    c.strokeStyle = '#000'; c.lineWidth = 2; c.beginPath();                               // marcas de corte en los márgenes
    for (var i = 0; i <= 2; i++) { var x = mx + i * W; c.moveTo(x, my - 45); c.lineTo(x, my - 10); c.moveTo(x, my + 5 * H + 10); c.lineTo(x, my + 5 * H + 45); }
    for (var j = 0; j <= 5; j++) { var y = my + j * H; c.moveTo(mx - 45, y); c.lineTo(mx - 10, y); c.moveTo(mx + 2 * W + 10, y); c.lineTo(mx + 2 * W + 45, y); }
    c.stroke();
    return l.cv;
  }

  // ---- Vista previa ----
  var cvF = document.getElementById('cvFrente'), cvR = document.getElementById('cvReverso');
  function previa() {
    [[cvF, frente], [cvR, reverso]].forEach(function (p) {
      p[0].width = W; p[0].height = H; var c = p[0].getContext('2d'); c.imageSmoothingQuality = 'high'; c.clearRect(0, 0, W, H); p[1](c, 0, 0, false);
    });
  }

  function bajar(canvas, nombre) {
    canvas.toBlob(function (blob) {
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    }, 'image/png');
  }
  var est = document.getElementById('estadoDescarga');
  document.querySelectorAll('[data-bajar]').forEach(function (b) {
    b.addEventListener('click', function () {
      var q = b.getAttribute('data-bajar'), base = 'rexi-' + cfg.id + '-';
      if (q === 'frente' || q === 'reverso') bajar(individual(q), base + q + '-9x5cm-sangrado-300dpi.png');
      else bajar(hoja(q === 'hoja-frentes' ? 'frente' : 'reverso'), base + q + '-carta.png');
      if (est) est.textContent = 'Descargando ' + b.textContent.toLowerCase() + '…';
    });
  });

  // ---- Foto local (no se sube a ningún servidor) ----
  var inp = document.getElementById('fotoArchivo'), quitar = document.getElementById('quitarFoto'), fe = document.getElementById('fotoEstado');
  var fotoGuardada = cfg.foto;
  inp.addEventListener('change', function () {
    var f = inp.files && inp.files[0]; if (!f) return;
    var url = URL.createObjectURL(f);
    cargar(url).then(function (i) { if (i) { img.foto = i; quitar.hidden = false; fe.textContent = 'Foto agregada solo para esta tarjeta. Si quieres que quede guardada, pásala a Victor para incluirla.'; previa(); } });
  });
  quitar.addEventListener('click', function () { img.foto = null; quitar.hidden = true; inp.value = ''; fe.textContent = 'Foto quitada.'; previa(); });

  var listo = (document.fonts && document.fonts.load) ? Promise.all([document.fonts.load('800 80px Inter'), document.fonts.load('600 40px Inter')]).catch(function () {}) : Promise.resolve();
  Promise.all([cargar(cfg.logo), cfg.foto ? cargar(cfg.foto) : Promise.resolve(null), qrImagen(), listo]).then(function (r) {
    img.logo = r[0]; img.foto = r[1]; img.qr = r[2]; previa();
  });
})();
