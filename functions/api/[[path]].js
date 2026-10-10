// Pages Function: hace que /api/* del sitio llegue a la API (Worker "rexi-api").
// Así el navegador siempre habla con el mismo dominio y no hace falta configurar CORS.
//
// Configuración (una de las dos, en Cloudflare Pages > Settings > Functions):
//   - Service binding:        API  ->  rexi-api            (recomendado)
//   - o Variable de entorno:  API_URL = https://rexi-api.<tu-subdominio>.workers.dev
export async function onRequest({ request, env }) {
  if (env.API) return env.API.fetch(request);
  if (env.API_URL) {
    const u = new URL(request.url);
    return fetch(new Request(env.API_URL.replace(/\/$/, "") + u.pathname + u.search, request));
  }
  return new Response(JSON.stringify({ error: "api_no_configurada" }), {
    status: 503,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
