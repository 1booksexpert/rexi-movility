#!/usr/bin/env node
// Reporte mensual de cobros y comisiones por vendedor.
//
//   npm run reporte                         -> mes actual
//   npm run reporte -- 2026-11              -> mes indicado (AAAA-MM)
//   npm run reporte -- 2026-11 --no-pagaron ivan-rivera,juan-perez
//
// Reglas (cámbialas en private/tarifas.json, que NO se sube a GitHub):
//  - Pago mensual: el mes del alta se cobra el alta (la primera mensualidad va incluida).
//  - Pago anual (campo "pago": "anual" en choferes.json): se cobra todo junto el mes del alta;
//    al vendedor 25% (15% en Flota) de lo cobrado, una sola vez; a los 12 meses se cobra la renovación, sin comisión.
//  - Después, mensualidad cada mes. Al vendedor: 30% del alta una sola vez
//    y 15% de la mensualidad durante 12 meses. Si el chofer no pagó, no hay comisión.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PRIV = join(RAIZ, 'private', 'tarifas.json');
const defecto = {
  planes: {
    // altaLanzamiento: alta en la oferta de lanzamiento (mensual). anual: pago anual de lanzamiento, todo incluido.
    // renovacion: precio al renovar el año (10 mensualidades).
    tarjeta: { alta: 650, altaLanzamiento: 325, mensualidad: 119, anual: 990, renovacion: 1190 },
    pro: { alta: 1200, altaLanzamiento: 600, mensualidad: 249, anual: 1990, renovacion: 2490 },
    flota: { alta: 700, altaLanzamiento: 350, mensualidad: 175, anual: 1490, renovacion: 1750, anualPct: 15 },
  },
  comision: { altaPct: 30, mensualPct: 15, mesesRecurrente: 12, anualPct: 25 },
  vendedores: { /* "V01": { "nombre": "Nombre del vendedor", "telefono": "55..." } */ },
};
// Los precios viven en src/data/planes.json (unica fuente de verdad, la misma del sitio
// y del editor). private/tarifas.json puede seguir sobrescribiendo y guarda las comisiones.
const PLANES_JSON = join(RAIZ, 'src', 'data', 'planes.json');
const privado = existsSync(PRIV) ? JSON.parse(readFileSync(PRIV, 'utf8')) : {};
const desdeJSON = existsSync(PLANES_JSON)
  ? Object.fromEntries(
      JSON.parse(readFileSync(PLANES_JSON, 'utf8')).paquetes.map((p) => [
        p.id,
        { alta: p.alta, altaLanzamiento: p.altaLanzamiento, mensualidad: p.precioMensual, anual: p.anual, renovacion: p.renovacion, anualPct: p.anualPct ?? undefined },
      ]),
    )
  : {};
const cfg = { ...defecto, ...privado, planes: { ...defecto.planes, ...desdeJSON, ...(privado.planes || {}) } };
const choferes = JSON.parse(readFileSync(join(RAIZ, 'src', 'data', 'choferes.json'), 'utf8'));

const args = process.argv.slice(2);
const mes = args.find((a) => /^\d{4}-\d{2}$/.test(a)) || new Date().toISOString().slice(0, 7);
const i = args.indexOf('--no-pagaron');
const impagos = new Set(i >= 0 ? (args[i + 1] || '').split(',').filter(Boolean) : []);
const idx = (m) => { const [y, mo] = m.split('-').map(Number); return y * 12 + mo; };
const peso = (n) => '$' + Math.round(n).toLocaleString('es-MX');

const filas = [];
for (const c of choferes) {
  const plan = cfg.planes[c.plan || 'pro'];
  if (!plan || !c.fechaAlta) continue;
  const dif = idx(mes) - idx(c.fechaAlta.slice(0, 7));
  if (dif < 0) continue; // todavía no existía
  const pago = !impagos.has(c.id);
  const anual = c.pago === 'anual';
  let cobro = dif === 0 ? (plan.altaLanzamiento ?? plan.alta) : plan.mensualidad;
  let concepto = dif === 0 ? 'alta' : 'mensualidad';
  let comision = 0;
  if (anual) {
    if (dif === 0) { cobro = plan.anual; concepto = 'anual'; }
    else if (dif === 12) { cobro = plan.renovacion; concepto = 'renovación'; }
    else continue; // año ya pagado
    if (c.referido && pago && dif === 0) comision = cobro * (plan.anualPct ?? cfg.comision.anualPct) / 100;
  } else if (c.referido && pago) {
    if (dif === 0) comision = (plan.altaLanzamiento ?? plan.alta) * cfg.comision.altaPct / 100;
    else if (dif <= cfg.comision.mesesRecurrente) comision = plan.mensualidad * cfg.comision.mensualPct / 100;
  }
  filas.push({ id: c.id, plan: c.plan || 'pro', ref: c.referido || '-', concepto, cobro: pago ? cobro : 0, esperado: cobro, pago, comision });
}

console.log(`\nReporte ${mes}\n`);
for (const f of filas) console.log(`${f.id.padEnd(24)} ${f.plan.padEnd(8)} ${f.ref.padEnd(5)} ${f.concepto.padEnd(11)} ${f.pago ? peso(f.cobro).padStart(8) : 'SIN PAGO'.padStart(8)}  comisión ${peso(f.comision)}`);
const total = filas.reduce((s, f) => s + f.cobro, 0);
const esperado = filas.reduce((s, f) => s + f.esperado, 0);
const porVend = {};
for (const f of filas) if (f.comision) porVend[f.ref] = (porVend[f.ref] || 0) + f.comision;
console.log(`\nCobrado: ${peso(total)} de ${peso(esperado)} esperado`);
console.log('Comisiones por pagar:');
const claves = Object.keys(porVend);
if (!claves.length) console.log('  (ninguna)');
for (const k of claves) console.log(`  ${k} ${(cfg.vendedores[k]?.nombre || '(sin nombre en private/tarifas.json)').padEnd(24)} ${peso(porVend[k])}`);
const totCom = claves.reduce((s, k) => s + porVend[k], 0);
console.log(`\nUtilidad antes de gastos: ${peso(total - totCom)} (cobrado - comisiones)\n`);
