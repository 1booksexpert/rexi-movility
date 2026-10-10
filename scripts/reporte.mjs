#!/usr/bin/env node
// Reporte mensual de cobros y comisiones por vendedor.
//
//   npm run reporte                         -> mes actual
//   npm run reporte -- 2026-11              -> mes indicado (AAAA-MM)
//   npm run reporte -- 2026-11 --no-pagaron ivan-rivera,juan-perez
//
// Reglas (cámbialas en private/tarifas.json, que NO se sube a GitHub):
//  - El mes del alta se cobra el alta (la primera mensualidad va incluida).
//  - Después, mensualidad cada mes. Al vendedor: 30% del alta una sola vez
//    y 15% de la mensualidad durante 12 meses. Si el chofer no pagó, no hay comisión.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PRIV = join(RAIZ, 'private', 'tarifas.json');
const defecto = {
  planes: {
    tarjeta: { alta: 650, mensualidad: 119 },
    pro: { alta: 1200, mensualidad: 249 },
    flota: { alta: 700, mensualidad: 175 },
  },
  comision: { altaPct: 30, mensualPct: 15, mesesRecurrente: 12 },
  vendedores: { /* "V01": { "nombre": "Nombre del vendedor", "telefono": "55..." } */ },
};
const cfg = existsSync(PRIV) ? { ...defecto, ...JSON.parse(readFileSync(PRIV, 'utf8')) } : defecto;
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
  const cobro = dif === 0 ? plan.alta : plan.mensualidad;
  let comision = 0;
  if (c.referido && pago) {
    if (dif === 0) comision = plan.alta * cfg.comision.altaPct / 100;
    else if (dif <= cfg.comision.mesesRecurrente) comision = plan.mensualidad * cfg.comision.mensualPct / 100;
  }
  filas.push({ id: c.id, plan: c.plan || 'pro', ref: c.referido || '-', concepto: dif === 0 ? 'alta' : 'mensualidad', cobro: pago ? cobro : 0, esperado: cobro, pago, comision });
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
