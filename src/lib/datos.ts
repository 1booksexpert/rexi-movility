// Lee choferes.json y negocio.json y rellena lo que falte, para que
// agregar un chofer nuevo solo requiera lo mínimo (id, nombre, teléfono).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import choferesRaw from '../data/choferes.json';
import negocio from '../data/negocio.json';

export interface Servicio {
  nombre: string;
  icono: string;
  color: string;
  descripcion: string;
  mensaje: string;
}
export interface Chofer {
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
  return {
    id: c.id,
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
      mascotas: 'Hola, necesito un traslado con mi mascota.',
      ...(c.mensajes || {}),
    },
    urlTarjeta: `${sitioBase()}/t/${c.id}/`,
  };
});

// Datos públicos que necesita la página de seguimiento (sin PIN, sin nada privado).
export const directorioPublico = Object.fromEntries(
  choferes.map((c) => [c.id, { nombre: c.nombre, telefono: c.telefono }])
);
