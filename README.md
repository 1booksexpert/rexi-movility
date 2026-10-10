# REXI Movilidad: tarjeta digital para varios choferes

Sitio en Astro (estático) + una API pequeña en Cloudflare para el viaje en tiempo real.

```
src/
  data/choferes.json       <- los choferes (aquí se agregan)
  data/negocio.json        <- marca, WhatsApp del dueño, crédito del desarrollador
  pages/index.astro        <- directorio de choferes + "ver mi viaje"
  pages/t/[id].astro       <- tarjeta de cada chofer (/t/ivan-rivera/)
  pages/chofer/[id]/       <- panel del chofer, con PIN (/chofer/ivan-rivera/)
  pages/viaje.astro        <- seguimiento en vivo para el pasajero (/viaje/?t=CODIGO)
  layouts/ components/ lib/ styles/
public/js/                 <- lógica del panel y del seguimiento (mapa Leaflet + OpenStreetMap)
functions/api/[[path]].js  <- Pages Function: manda /api/* a la API
api/                       <- Worker "rexi-api": viajes en vivo (Durable Objects) + PINs (KV)
scripts/chofer.mjs         <- alta, cambio de PIN y baja de choferes
```

## Cómo funciona

1. El pasajero abre la tarjeta del chofer (`/t/ivan-rivera/`) y toca **Enviar mi ubicación** o un servicio. Se abre WhatsApp con el mensaje y su ubicación.
2. El chofer entra a su panel (`/chofer/ivan-rivera/`), pone su PIN y **Inicia viaje**. Su teléfono comparte el GPS cada 4 s.
3. El panel genera un enlace (`/viaje/?t=...`). El chofer lo manda por WhatsApp al pasajero, y opcionalmente al dueño.
4. El pasajero ve la unidad en el mapa. Si quiere, comparte su ubicación solo con el chofer (el chofer ve un botón "Navegar hacia el pasajero").
5. Al terminar el viaje, la ubicación se borra. Si el chofer olvida terminarlo, se borra sola a las 6 horas.

## Probar en tu computadora

```bash
npm install
npm run api:install          # una vez
npm run api:dev              # terminal 1: API en http://127.0.0.1:8787
npm run chofer -- pin ivan-rivera --local   # imprime un PIN y lo guarda en el KV local
npm run dev                  # terminal 2: sitio en http://localhost:4321
```

Abre `/chofer/ivan-rivera/` en el celular (misma red Wi-Fi) o en la computadora. El GPS del navegador requiere HTTPS, salvo en `localhost`.

## Publicar en Cloudflare (una sola vez)

**1. API**
```bash
cd api
npm install
npx wrangler login
npx wrangler deploy                       # crea el Worker "rexi-api" (el KV "rexi-pins" ya está creado y puesto en wrangler.toml)
```

**2. Sitio (Cloudflare Pages, igual que ahora)**
Tu proyecto `rexi-movilidad` en Pages ya se despliega desde GitHub. Solo falta unirlo a la API:
Pages > rexi-movilidad > Settings > Functions > **Service bindings** > agrega `API` → `rexi-api` (producción y vista previa).
Si prefieres no usar el binding, define la variable de entorno `API_URL = https://rexi-api.<tu-subdominio>.workers.dev`.

**3. Registrar a cada chofer** (ver abajo) y hacer `git push`.

> Nota 1: en GitHub había un archivo llamado `.astro` (más `settings.json` y `types.d.ts` sueltos en la raíz). Astro necesita una **carpeta** `.astro/`, así que ese archivo hacía fallar el build con `ENOTDIR`. Los quité.
>
> Nota 2: tu `package-lock.json` apuntaba al espejo `registry.npmmirror.com`. Lo cambié a `registry.npmjs.org` para que Cloudflare pueda instalar sin problemas.

## Agregar, cambiar o dar de baja choferes

```bash
npm run chofer -- nuevo "Nombre Apellido" 8991234567 --aplicar
npm run chofer -- pin   nombre-apellido --aplicar      # PIN nuevo si lo olvidó
npm run chofer -- baja  nombre-apellido --aplicar
```

- `nuevo` crea la tarjeta en `choferes.json`, genera un PIN de 6 dígitos y lo registra (guardado como hash, nunca en el repositorio). **El PIN se muestra una sola vez.** Entrégaselo al chofer.
- Sin `--aplicar` solo imprime el comando de wrangler para que lo ejecutes tú.
- Después: `git add -A && git commit -m "Alta de chofer" && git push`. En un minuto aparece su tarjeta.
- Logo propio opcional: `public/logos/<id>.png`. Si no existe se usa `rexi.png`.
- Placa y unidad: el chofer las captura en su panel (se recuerdan en su teléfono). También puedes fijarlas en `choferes.json`.
- Seguridad: 5 PIN incorrectos bloquean ese chofer 15 minutos.

## Vendedores, planes y comisiones

```bash
npm run chofer -- nuevo "Nombre Apellido" 8991234567 --plan pro --ref V01 [--pago anual] --aplicar
npm run chofer -- ref nombre-apellido V01      # asignar o cambiar vendedor
npm run reporte                                # mes actual
npm run reporte -- 2026-11 --no-pagaron nombre-apellido
```

- `referido` (código del vendedor), `plan` (`tarjeta`, `pro`, `flota`) y `fechaAlta` se guardan en `choferes.json`. **No se publican en el sitio** (`datos.ts` no los copia).
- Precios, porcentajes y datos de los vendedores viven en `private/tarifas.json`, que está en `.gitignore`: no se sube a GitHub. Respáldalo aparte.
- Pago mensual: 30% del alta una sola vez + 15% de la mensualidad durante 12 meses, solo si el chofer pagó.
- Pago anual (`--pago anual`): 25% de lo cobrado una sola vez (15% en Flota). Se cobra todo junto y a los 12 meses se renueva.

## Tarjeta física (para imprimir)

En el panel del chofer (`/chofer/<id>/`), el botón **Crear mi tarjeta física** abre `/chofer/<id>/tarjeta-fisica/`. Es solo para el chofer: la tarjeta pública del pasajero no lo muestra. Ahí se genera, en el propio teléfono y a 300 DPI:

- **Frente y reverso individuales** (9 × 5 cm con 3 mm de sangrado): lo que pide una imprenta.
- **Hoja carta de frentes y de reversos** (10 tarjetas con marcas de corte): para imprimir en casa u oficina.
- Frente: foto del chofer (si existe), logotipo REXI, nombre, título y teléfono. Reverso: servicios más comunes y QR de la tarjeta.
- Foto: guarda `public/fotos/<id>.jpg` (o `.png`/`.webp`, cuadrada, 600 px o más) y aparece sola. También se puede elegir una foto en la propia página; no se sube a ningún servidor.
- El logo `public/logos/rexi.png` mide solo 150×200 px y se nota algo suave al imprimir. Con una versión de 600 px de alto o más (o SVG) la tarjeta queda nítida.

## Accesibilidad

Botón **Accesibilidad** (arriba a la derecha en todas las páginas): texto normal, grande y muy grande; colores normales o alto contraste. Se recuerda en el teléfono y respeta `prefers-contrast: more`. Los textos cumplen contraste AA (4.5:1). Con texto grande la tarjeta deja de girar y muestra frente y reverso uno debajo del otro.
Pendiente: modo viajero para adultos mayores y personas ciegas (aviso por voz, botón único de pedir taxi). Se cuelga del mismo mecanismo (`data-modo` en `<html>`).

## Pendientes tuyos

- `src/data/negocio.json` → `whatsappDueno` (formato `521899XXXXXXX`). Con él aparece "Pedir por WhatsApp" en el inicio y "Al dueño" en el panel del chofer.
- Revisa los textos de los servicios en `choferes.json` (descripciones y mensajes).
- Si cambias de dominio, actualiza `site` en `astro.config.mjs` y `sitio` en `negocio.json` (el QR y el vCard usan esa URL).

## Costo y límites (qué sí y qué no conviene)

| Función | Estado | Costo |
|---|---|---|
| Tarjeta, directorio, QR, vCard, WhatsApp con ubicación | Incluido | $0 |
| Viaje en vivo (mapa, chofer, placa, ETA estimado) | Incluido | $0 hasta unos 30 viajes de media hora al día; luego Workers Paid (~$5 USD/mes) |
| Ubicación del pasajero visible solo para el chofer | Incluido | $0 |
| Enlace para compartir con la familia, botón 911 | Incluido | $0 |
| Mapa | OpenStreetMap, gratis para uso ligero. Con mucho tráfico conviene un proveedor de mapas con plan gratuito (MapTiler, Stadia) | $0 al inicio |
| Tiempo de llegada con tráfico real | No incluido: exige Google Maps u otro servicio de rutas de paga. El ETA actual es una estimación en línea recta | Google: de paga por uso |
| GPS con el teléfono bloqueado | No es posible desde el navegador: se pausa. Requiere una app nativa (Android/iOS), costosa de mantener | Alto |
| Mensajes automáticos de WhatsApp (sin que el chofer toque nada) | No incluido: exige la API oficial de WhatsApp Business, con costo por conversación | De paga |
| Mapa de toda la flota para el dueño | Fase 2. Se puede agregar con otro Durable Object | $0 al inicio |

Cálculo del límite gratuito: cada consulta pasa por la Pages Function, el Worker y el Durable Object (el Worker y la Function comparten el límite de 100,000 solicitudes diarias; el Durable Object tiene otro de 100,000). Un viaje de 30 minutos con un chofer y dos personas siguiéndolo hace unas 1,650 consultas. Confírmalo en tu panel de Cloudflare cuando empieces.

## Privacidad

- La posición de cada viaje vive en un Durable Object y se borra al terminar (30 min después) o a las 6 horas.
- El código del viaje (10 caracteres) es el "permiso" para verlo: quien tenga el enlace puede ver el viaje. Por eso se comparte solo por WhatsApp.
- La ubicación del pasajero solo la recibe el chofer, y solo si el pasajero lo pide.
- Las páginas `/chofer/*` y `/viaje/*` no se indexan en buscadores y no envían la URL completa a terceros (mapas).
