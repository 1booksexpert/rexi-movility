import type { APIRoute } from 'astro';
import { choferes, negocio } from '../../../lib/datos';

export function getStaticPaths() {
  return choferes.map((c) => ({ params: { id: c.id }, props: { chofer: c } }));
}

export const GET: APIRoute = ({ props }) => {
  const { chofer } = props as { chofer: (typeof choferes)[number] };
  const body = {
    name: `${negocio.marca} · Panel de ${chofer.nombre}`,
    short_name: 'REXI Chofer',
    start_url: `/chofer/${chofer.id}/`,
    scope: `/chofer/${chofer.id}/`,
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#0f172a',
    lang: 'es-MX',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/manifest+json' } });
};
