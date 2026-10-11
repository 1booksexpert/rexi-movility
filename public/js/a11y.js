// Botón y panel de accesibilidad. Guarda la elección en el teléfono (localStorage, con respaldo si no hay).
(function () {
  var KEY = 'rexi-a11y';
  var raiz = document.documentElement;
  var estado = { t: raiz.getAttribute('data-texto') || '', c: raiz.getAttribute('data-contraste') || '' };

  function guardar() { try { localStorage.setItem(KEY, JSON.stringify(estado)); } catch (e) {} }
  function aplicar() {
    if (estado.t) raiz.setAttribute('data-texto', estado.t); else raiz.removeAttribute('data-texto');
    if (estado.c) raiz.setAttribute('data-contraste', estado.c); else raiz.removeAttribute('data-contraste');
    document.querySelectorAll('[data-a11y-t]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-a11y-t') === estado.t)); });
    document.querySelectorAll('[data-a11y-c]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-a11y-c') === estado.c)); });
  }

  function iniciar() {
    var btn = document.getElementById('a11yBtn');
    var panel = document.getElementById('a11yPanel');
    var live = document.getElementById('a11yLive');
    if (!btn || !panel) return;

    function abrir(v) {
      panel.hidden = !v; btn.setAttribute('aria-expanded', String(v));
      if (v) { var p = panel.querySelector('[aria-pressed="true"]') || panel.querySelector('button'); if (p) p.focus(); }
      else btn.focus();
    }
    function avisar(m) { if (live) { live.textContent = ''; setTimeout(function () { live.textContent = m; }, 50); } }

    btn.addEventListener('click', function () { abrir(panel.hidden); });
    document.getElementById('a11yCerrar').addEventListener('click', function () { abrir(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) abrir(false); });

    panel.querySelectorAll('[data-a11y-t]').forEach(function (b) {
      b.addEventListener('click', function () { estado.t = b.getAttribute('data-a11y-t'); aplicar(); guardar(); avisar('Texto: ' + b.textContent.trim()); });
    });
    panel.querySelectorAll('[data-a11y-c]').forEach(function (b) {
      b.addEventListener('click', function () { estado.c = b.getAttribute('data-a11y-c'); aplicar(); guardar(); avisar('Colores: ' + b.textContent.trim()); });
    });
    document.getElementById('a11yReset').addEventListener('click', function () {
      estado = { t: '', c: '' }; aplicar(); guardar(); avisar('Ajustes restablecidos');
    });
    aplicar();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
