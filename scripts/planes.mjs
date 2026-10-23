#!/usr/bin/env node
// Paquetes de venta de REXI. La verdad vive en src/data/planes.json (público).
//
//   npm run planes                                  ver paquetes y oferta
//   npm run planes -- set pro precioMensual 279     cambiar un campo
//   npm run planes -- set tarjeta altaLanzamiento 325
//   npm run planes -- destacar pro                  marcar "el más pedido"
//   npm run planes -- oferta activa false           apagar la oferta de lanzamiento
//   npm run planes -- oferta cupo 20
//   npm run planes -- oferta hasta 2026-12-31
//   npm run planes -- caracteristica pro add "Texto nuevo"
//   npm run planes -- caracteristica pro del 2
//   npm run planes -- publicar                      git add + commit + push
//
// Numéricos: precioMensual, alta, altaLanzamiento, anual, renovacion, anualPct
// Texto:     nombre, resumen, etiqueta
// Booleanos: porChofer, destacado
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ARCHIVO = join(RAIZ, 'src', 'data', 'planes.json');
const args = process.argv.slice(2);

const leer = () => JSON.parse(readFileSync(ARCHIVO, 'utf8'));
const guardar = (d) => writeFileSync(ARCHIVO, JSON.stringify(d, null, 2) + '\n', 'utf8');
const pesos = (n) => '$' + Number(n).toLocaleString('es-MX');
const num = (v) => Number(String(v).replace(/[$,\s]/g, ''));

const NUMERICOS = ['precioMensual', 'alta', 'altaLanzamiento', 'anual', 'renovacion', 'anualPct'];
const TEXTOS = ['nombre', 'resumen', 'etiqueta'];
const BOOLEANOS = ['porChofer', 'destacado'];

function fallo(msg) {
  console.error(msg);
  process.exit(1);
}

function buscar(id) {
  const d = leer();
  const p = d.paquetes.find((x) => x.id === id);
  if (!p) fallo('No existe el paquete "' + id + '". Hay: ' + d.paquetes.map((x) => x.id).join(', '));
  return { d, p };
}

function listar() {
  const d = leer();
  const o = d.oferta;
  console.log('\nPAQUETES DE VENTA — ' + d.paquetes.length + ' paquetes\n');
  console.log('Oferta: ' + o.titulo + ' | ' + (o.activa ? 'ACTIVA' : 'apagada') + ' | cupo ' + o.cupo + ' | hasta ' + (o.hasta || 'sin límite') + '\n');
  for (const p of d.paquetes) {
    const marca = p.destacado ? '  [' + (p.etiqueta || 'destacado') + ']' : '';
    console.log(p.id.padEnd(9) + ' ' + p.nombre + marca);
    console.log('  mensual ' + pesos(p.precioMensual) + (p.porChofer ? ' por chofer' : '') + ' | alta ' + pesos(p.alta) + ' (lanzamiento ' + pesos(p.altaLanzamiento) + ')');
    console.log('  anual ' + pesos(p.anual) + ' | renovación ' + pesos(p.renovacion) + (p.anualPct != null ? ' | comisión anual ' + p.anualPct + '%' : ''));
    console.log('  ' + p.caracteristicas.length + ' características\n');
  }
}

function set(id, campo, valor) {
  const { d, p } = buscar(id);
  if (NUMERICOS.includes(campo)) {
    if (campo === 'anualPct' && (valor === 'null' || valor === '')) p[campo] = null;
    else {
      const n = num(valor);
      if (!Number.isFinite(n) || n < 0) fallo('Valor numérico inválido para ' + campo + ': ' + valor);
      if (campo === 'anualPct' && n > 100) fallo('anualPct debe estar entre 0 y 100.');
      p[campo] = n;
    }
  } else if (TEXTOS.includes(campo)) {
    p[campo] = String(valor ?? '');
  } else if (BOOLEANOS.includes(campo)) {
    if (!['true', 'false'].includes(String(valor))) fallo('Use true o false para ' + campo + '.');
    p[campo] = String(valor) === 'true';
  } else {
    fallo('Campo desconocido: ' + campo + '. Válidos: ' + NUMERICOS.concat(TEXTOS, BOOLEANOS).join(', '));
  }
  guardar(d);
  console.log(id + '.' + campo + ' = ' + JSON.stringify(p[campo]));
}

function destacar(id) {
  const { d } = buscar(id);
  for (const p of d.paquetes) p.destacado = p.id === id;
  guardar(d);
  console.log('Paquete destacado: ' + id + ' (los demás quedan sin destacar).');
}

function oferta(campo, valor) {
  const d = leer();
  if (campo === 'activa') {
    if (!['true', 'false'].includes(String(valor))) fallo('Use true o false.');
    d.oferta.activa = String(valor) === 'true';
  } else if (campo === 'cupo') {
    const n = num(valor);
    if (!Number.isFinite(n) || n < 0) fallo('Cupo inválido.');
    d.oferta.cupo = n;
  } else if (campo === 'hasta') {
    if (valor && !/^\d{4}-\d{2}-\d{2}$/.test(valor)) fallo('Use AAAA-MM-DD (o "" para sin límite).');
    d.oferta.hasta = valor || '';
  } else if (campo === 'titulo' || campo === 'nota') {
    d.oferta[campo] = String(valor ?? '');
  } else {
    fallo('Campos de oferta: activa, cupo, hasta, titulo, nota.');
  }
  guardar(d);
  console.log('oferta.' + campo + ' = ' + JSON.stringify(d.oferta[campo]));
}

function caracteristica(id, accion, valor) {
  const { d, p } = buscar(id);
  if (accion === 'add') {
    if (!valor) fallo('Falta el texto de la característica.');
    p.caracteristicas.push(String(valor));
  } else if (accion === 'del') {
    const i = Number(valor) - 1;
    if (!Number.isInteger(i) || i < 0 || i >= p.caracteristicas.length) fallo('Número de característica inválido (ver en la lista).');
    console.log('Eliminada: ' + p.caracteristicas.splice(i, 1)[0]);
  } else {
    fallo('Acciones: add "texto" | del <número>.');
  }
  guardar(d);
  console.log(id + ': ' + p.caracteristicas.length + ' características.');
}

function publicar() {
  const pasos = [
    ['add', ['src/data/planes.json']],
    ['commit', ['-m', 'Paquetes: actualizar precios y oferta']],
    ['push'],
  ];
  for (const [cmd, extra] of pasos) {
    const r = spawnSync('git', [cmd].concat(extra), { cwd: RAIZ, stdio: 'inherit', shell: process.platform === 'win32' });
    if (r.status !== 0) fallo('git ' + cmd + ' falló. Revisa el mensaje de arriba.');
  }
  console.log('\nPublicado. Cloudflare Pages reconstruye el sitio en 1-2 minutos.');
}

const [cmd, ...resto] = args;
switch (cmd) {
  case undefined:
  case 'listar':
    listar();
    break;
  case 'set':
    if (resto.length < 3) fallo('Uso: npm run planes -- set <paquete> <campo> <valor>');
    set(resto[0], resto[1], resto.slice(2).join(' '));
    break;
  case 'destacar':
    if (!resto[0]) fallo('Uso: npm run planes -- destacar <paquete>');
    destacar(resto[0]);
    break;
  case 'oferta':
    if (resto.length < 2) fallo('Uso: npm run planes -- oferta <activa|cupo|hasta|titulo|nota> <valor>');
    oferta(resto[0], resto.slice(1).join(' '));
    break;
  case 'caracteristica':
    if (resto.length < 2) fallo('Uso: npm run planes -- caracteristica <paquete> <add|del> <texto|número>');
    caracteristica(resto[0], resto[1], resto.slice(2).join(' '));
    break;
  case 'publicar':
    publicar();
    break;
  default:
    fallo('Comando desconocido: ' + cmd + '. Usa: listar, set, destacar, oferta, caracteristica, publicar.');
}