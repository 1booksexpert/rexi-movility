// Lee choferes.json y negocio.json y rellena lo que falte, para que
// agregar un chofer nuevo solo requiera lo mínimo (id, nombre, teléfono).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import choferesRaw from '../data/choferes.json';
import negocio from '../data/negocio.json';
import flotasRaw from '../data/flotas.json';

export interface Servicio {
  nombre: string;
  icono: string;
  color: string;
  descripcion: string;
  mensaje: string;
}
export interface Flota {
  id: string;
  nombre: string;
  whatsappDueno: string; // WhatsApp del dueño de la flota (521899XXXXXXX)
}
export interface Chofer {
  flota: string; // id de la flota o '' si es chofer independiente
  flotaNombre: string;
  whatsappDueno: string; // el de su flota; si no tiene, el general de negocio.json

  id: string;
  nombre: string;
  telefono: string;
  telefonoFormateado: string;
  titulo: string;
  zona: string;
  placa: string;
  unidad: string;
  servicios: Servicio[];
  logo: string; // ruta pública, siempre existe
  foto: string; // foto del chofer (public/fotos/<id>.jpg|png|webp) o '' si no hay
  mensajes: Record<string, string> & { general: string };
  urlTarjeta: string;
}

const COLORES = ['blue', 'purple', 'teal', 'orange', 'slate'];
export { negocio };

export const flotas: Flota[] = (flotasRaw as any[]).map((f) => ({
  id: String(f.id),
  nombre: f.nombre || f.id,
  whatsappDueno: String(f.whatsappDueno || '').replace(/\D/g, ''),
}));

function formatoTel(t: string): string {
  const d = t.replace(/\D/g, '');
  return d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : t;
}

function logoPublico(logo?: string): string {
  if (logo && existsSync(join(process.cwd(), 'public', 'logos', logo))) return `/logos/${logo}`;
  return '/logos/rexi.png';
}

function fotoPublica(id: string): string {
  for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
    if (existsSync(join(process.cwd(), 'public', 'fotos', `${id}.${ext}`))) return `/fotos/${id}.${ext}`;
  }
  return '';
}

export function sitioBase(): string {
  return negocio.sitio.replace(/\/$/, '');
}

export const choferes: Chofer[] = (choferesRaw as any[]).map((c) => {
  const telefono = String(c.telefono).replace(/\D/g, '').slice(-10);
  const flota = flotas.find((f) => f.id === (c.flota || ''));
  return {
    id: c.id,
    flota: flota ? flota.id : '',
    flotaNombre: flota ? flota.nombre : '',
    whatsappDueno: (flota && flota.whatsappDueno) || String(negocio.whatsappDueno || ''),
    nombre: c.nombre,
    telefono,
    telefonoFormateado: c.telefonoFormateado || formatoTel(telefono),
    titulo: c.titulo || 'Chofer',
    zona: c.zona || negocio.ciudad,
    placa: c.placa || '',
    unidad: c.unidad || '',
    servicios: (c.servicios || []).map((s: any, i: number) => ({
      nombre: s.nombre,
      icono: s.icono || '🚖',
      color: s.color || COLORES[i % COLORES.length],
      descripcion: s.descripcion || '',
      mensaje: s.mensaje || `Hola, me interesa el servicio: ${s.nombre}.`,
    })),
    logo: logoPublico(c.logo),
    foto: fotoPublica(c.id),
    mensajes: {
      general: 'Hola, necesito un servicio de transporte.',
      local: 'Hola, necesito un traslado local o a un puente internacional.',
      aeropuerto: 'Hola, quiero cotizar un traslado al aeropuerto o un viaje a Monterrey.',
      medico: 'Hola, necesito un traslado para una consulta médica.',
      paqueteria: 'Hola, necesito enviar un sobre o paquete urgente.',
      corporativo: 'Hola, quiero información de un convenio para mi empresa.',
      ...(c.mensajes || {}),
    },
    urlTarjeta: `${sitioBase()}/t/${c.id}/`,
  };
});

// Datos públicos que necesita la página de seguimiento (sin PIN, sin nada privado).
export const directorioPublico = Object.fromEntries(
  choferes.map((c) => [c.id, { nombre: c.nombre, telefono: c.telefono }])
);

// Validación al construir el sitio: si editas choferes.json o flotas.json a mano y algo está mal,
// el error sale aquí, en español y diciendo qué corregir (en vez de una página rota).
(function validar() {
  const errores: string[] = [];
  const ids = new Set<string>();
  const telefonos = new Map<string, string>();
  (choferesRaw as any[]).forEach((c, i) => {
    const etiqueta = c.id ? `"${c.id}"` : `el chofer número ${i + 1}`;
    if (!c.id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.id)) errores.push(`${etiqueta}: el "id" debe ir en minúsculas, sin acentos ni espacios (ej. "juan-perez").`);
    if (ids.has(c.id)) errores.push(`${etiqueta}: el id está repetido.`);
    ids.add(c.id);
    if (!c.nombre) errores.push(`${etiqueta}: falta el "nombre".`);
    const tel = String(c.telefono || '').replace(/\D/g, '').slice(-10);
    if (tel.length !== 10) errores.push(`${etiqueta}: el "telefono" debe tener 10 dígitos.`);
    else if (telefonos.has(tel)) console.warn(`[REXI] Aviso: ${etiqueta} comparte teléfono (${tel}) con "${telefonos.get(tel)}". ¿Es un error de captura?`);
    telefonos.set(tel, c.id);
    if (c.flota && !flotas.some((f) => f.id === c.flota)) errores.push(`${etiqueta}: la flota "${c.flota}" no existe en src/data/flotas.json.`);
    if (!Array.isArray(c.servicios) || c.servicios.length === 0) errores.push(`${etiqueta}: necesita al menos un servicio.`);
  });
  const fid = new Set<string>();
  flotas.forEach((f) => { if (fid.has(f.id)) errores.push(`flota "${f.id}": id repetido.`); fid.add(f.id); });
  if (errores.length) throw new Error('\n\nREXI: hay errores en los datos de choferes/flotas:\n - ' + errores.join('\n - ') + '\n');
})();
