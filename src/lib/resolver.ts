// Calcula lo que un chofer ofrece HOY:
//   asignado por el administrador  −  pausado por el chofer
// y solo si el elemento (catálogo o ciudad) y la propia ciudad están activos.

export interface Item { id: string; nombre: string; activo: boolean; [k: string]: any }
export interface Catalogo { tipos: Item[]; modalidades: Item[]; servicios: Item[] }
export interface Ciudad { id: string; nombre: string; estado: string; activo: boolean; servicios: Item[]; zonas: Item[] }
export interface Lista { servicios: string[]; tipos: string[]; modalidades: string[]; zonas: string[] }

export const listaVacia = (): Lista => ({ servicios: [], tipos: [], modalidades: [], zonas: [] });

export function normalizarLista(x: any): Lista {
  const v = listaVacia();
  for (const k of Object.keys(v) as (keyof Lista)[]) v[k] = Array.isArray(x?.[k]) ? x[k].map(String) : [];
  return v;
}

function efectivos(fuente: Item[], asignados: string[], pausados: string[]): Item[] {
  return fuente.filter((i) => i.activo !== false && asignados.includes(i.id) && !pausados.includes(i.id));
}

export function resolverOferta(c: { ciudadId?: string; asignado?: any; pausado?: any }, cat: Catalogo, ciudades: Ciudad[]) {
  const ciudad = ciudades.find((x) => x.id === c.ciudadId) || null;
  const ciudadActiva = !!ciudad && ciudad.activo !== false;
  const a = normalizarLista(c.asignado);
  const p = normalizarLista(c.pausado);
  const fuenteServicios = [...cat.servicios, ...(ciudad?.servicios ?? [])];
  return {
    ciudad,
    servicios: efectivos(fuenteServicios, a.servicios, p.servicios),
    tipos: efectivos(cat.tipos, a.tipos, p.tipos),
    modalidades: efectivos(cat.modalidades, a.modalidades, p.modalidades),
    zonas: ciudadActiva ? efectivos(ciudad!.zonas, a.zonas, p.zonas) : [],
  };
}

// Para el endpoint que guarda lo que el chofer enciende/apaga:
// solo se aceptan ids que el administrador ya le asignó.
export function validarPausado(nuevo: any, asignado: any): Lista {
  const n = normalizarLista(nuevo), a = normalizarLista(asignado);
  const f = (p: string[], ok: string[]) => p.filter((id) => ok.includes(id));
  return { servicios: f(n.servicios, a.servicios), tipos: f(n.tipos, a.tipos), modalidades: f(n.modalidades, a.modalidades), zonas: f(n.zonas, a.zonas) };
}
