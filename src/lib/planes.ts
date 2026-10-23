// Paquetes de venta de REXI (una sola fuente de verdad).
//
// Los precios y las características viven en src/data/planes.json, que SÍ se publica
// (los precios ya son públicos en el sitio). Las comisiones y los vendedores siguen
// en private/tarifas.json, que NO se sube a GitHub. Ver scripts/reporte.mjs.
//
// "Oferta de lanzamiento": mientras esté activa y no haya pasado la fecha límite,
// se usa el alta de lanzamiento (a la mitad) y se muestra el ahorro del pago anual.
import planesRaw from '../data/planes.json';

export interface Paquete {
  id: string;
  nombre: string;
  resumen: string; // una línea bajo el nombre
  etiqueta: string; // cinta sobre la tarjeta, ej. "El más pedido" ('' = ninguna)
  destacado: boolean; // resalta la tarjeta
  precioMensual: number; // mensualidad normal, o por chofer en Flota
  alta: number; // alta a precio normal
  altaLanzamiento: number; // alta con la oferta de lanzamiento
  anual: number; // pago anual todo incluido (sin alta)
  renovacion: number; // precio al renovar el año (10 mensualidades)
  porChofer: boolean; // true = el precio es por chofer (Flota)
  anualPct: number | null; // % de comisión anual propia del plan (null = la general)
  caracteristicas: string[];
}

export interface Oferta {
  titulo: string;
  activa: boolean;
  cupo: number; // "primeros N choferes"
  hasta: string; // fecha límite AAAA-MM-DD ('' = sin límite)
  nota: string; // nota al pie del bloque de precios
}

export const oferta = planesRaw.oferta as Oferta;
export const paquetes = planesRaw.paquetes as Paquete[];

export function paquete(id: string): Paquete | null {
  return paquetes.find((p) => p.id === id) || null;
}

// ¿La oferta sigue vigente? Activa y sin pasarse de la fecha límite.
export function ofertaActiva(hoy = new Date().toISOString().slice(0, 10)): boolean {
  if (!oferta.activa) return false;
  return !oferta.hasta || hoy <= oferta.hasta;
}

// Alta que se cobra hoy (la de lanzamiento si la oferta está vigente).
export function altaEfectiva(p: Paquete): number {
  return ofertaActiva() ? p.altaLanzamiento : p.alta;
}

// Lo que sale "al mes" pagando el año completo.
// Se redondea hacia abajo en el .5 exacto (990/12 = 82.5 -> $82), como en el volante original.
export function equivalenteMensual(p: Paquete): number {
  return Math.ceil(p.anual / 12 - 0.5);
}

// Ahorro del primer año contra el precio normal (alta + 12 mensualidades − anual).
export function ahorro(p: Paquete): number {
  return p.alta + p.precioMensual * 12 - p.anual;
}

export function peso(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-MX');
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// "2026-12-31" -> "31 de diciembre". Devuelve el texto tal cual si no es una fecha válida.
export function fechaLarga(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return iso || '';
  const mes = MESES[Number(m[2]) - 1] || '';
  return `${Number(m[3])} de ${mes}`;
}
