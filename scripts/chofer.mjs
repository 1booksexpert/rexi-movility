#!/usr/bin/env node
// Alta, cambio de PIN y baja de choferes.
//
//   npm run chofer -- nuevo "Nombre Apellido" 8991234567 [--ciudad reynosa --servicios a,b --tipos x --modalidades m --zonas z] [--titulo "Movilidad Ejecutiva"] [--plan pro] [--pago anual] [--ref V01] [--flota id] [--id otro-id] [--aplicar]
//   npm run chofer -- flota-nueva "Nombre de la flota" 5218991234567 [--id taxis-norte]
//   npm run chofer -- validar
//   npm run chofer -- ciudad-nueva "Monterrey" "Nuevo León"
//   npm run chofer -- zona-nueva <ciudad-id> "Nombre de la zona"
//   npm run chofer -- servicio-ciudad <ciudad-id> "Nombre" [--icono 🛫] [--descripcion "..."] [--mensaje "..."]
//   npm run chofer -- ciudad <chofer-id> <ciudad-id>                 (ciudad donde trabaja el chofer)
//   npm run chofer -- asignar <chofer-id> <servicios|tipos|modalidades|zonas> <id> [<id> ...]   (o "todos")
//   npm run chofer -- quitar  <chofer-id> <servicios|tipos|modalidades|zonas> <id> [<id> ...]
//   npm run chofer -- activar|desactivar <catalogo|ciudad-id> <clave> <id>   (interruptor general de un elemento)
//   npm run chofer -- listar [chofer-id]                             (ids disponibles / lo asignado a un chofer)
//   npm run chofer -- ref   <id> <codigo-vendedor>      (asigna o cambia el vendedor que lo colocó)
//   npm run chofer -- pin   <id> [--aplicar]
//   npm run chofer -- baja  <id> [--aplicar]
//
// Sin --aplicar solo imprime el comando de wrangler para que lo revises y lo ejecutes tú.
// Con --aplicar lo ejecuta (necesitas haber hecho `npm install` dentro de /api e iniciar sesión: npx wrangler login).
// Con --local usa el KV local de `wrangler dev` (para pruebas).
import { createHash, randomInt } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ARCHIVO = join(RAIZ, 'src', 'data', 'choferes.json');
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--') && !a.includes('=')));
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const pos = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && !flags.has(args[i - 1])));
const [cmd, a1, a2] = pos;
const ARCHIVO_FLOTAS = join(RAIZ, 'src', 'data', 'flotas.json');
const leerFlotas = () => JSON.parse(readFileSync(ARCHIVO_FLOTAS, 'utf8'));
const ARCHIVO_CATALOGO = join(RAIZ, 'src', 'data', 'catalogo.json');
const ARCHIVO_CIUDADES = join(RAIZ, 'src', 'data', 'ciudades.json');
const leerCatalogo = () => JSON.parse(readFileSync(ARCHIVO_CATALOGO, 'utf8'));
const leerCiudades = () => JSON.parse(readFileSync(ARCHIVO_CIUDADES, 'utf8'));
const guardarJson = (f, d) => writeFileSync(f, JSON.stringify(d, null, 2) + '\n');
const TIPOS_LISTA = ['servicios', 'tipos', 'modalidades', 'zonas'];
const csv = (s) => (s ? String(s).split(',').map((x) => x.trim()).filter(Boolean) : []);
// Elementos que se pueden asignar según la clave: lo común del catálogo + lo propio de la ciudad.
function fuenteIds(clave, ciudadId) {
  const cat = leerCatalogo(); const ciu = leerCiudades().find((x) => x.id === ciudadId);
  if (clave === 'servicios') return [...cat.servicios, ...((ciu && ciu.servicios) || [])];
  if (clave === 'zonas') return (ciu && ciu.zonas) || [];
  return cat[clave] || [];
}

const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const hashPin = (id, pin) => createHash('sha256').update(`${id}:${pin}`).digest('hex');
const nuevoPin = () => String(randomInt(0, 1_000_000)).padStart(6, '0');
const leer = () => JSON.parse(readFileSync(ARCHIVO, 'utf8'));
const guardar = (d) => writeFileSync(ARCHIVO, JSON.stringify(d, null, 2) + '\n');
const fmt = (t) => `${t.slice(0, 3)} ${t.slice(3, 6)} ${t.slice(6)}`;

function kv(accion, id, valor, prefijo = 'pin') {
  const alcance = flags.has('--local') ? '--local' : '--remote';
  const argv = ['wrangler', 'kv', 'key', accion, `${prefijo}:${id}`];
  if (valor) argv.push(valor);
  argv.push('--binding', 'PINS', alcance);
  const texto = `cd api && npx ${argv.map((x) => (x.includes(' ') ? `"${x}"` : x)).join(' ')}`;
  if (!flags.has('--aplicar') && !flags.has('--local')) {
    console.log('\nEjecuta este comando para que el PIN funcione:\n\n  ' + texto + '\n');
    return;
  }
  const r = spawnSync('npx', argv, { cwd: join(RAIZ, 'api'), stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) { console.error('\nwrangler falló. Comando para repetirlo a mano:\n  ' + texto); process.exit(1); }
}

if (cmd === 'nuevo') {
  const nombre = a1; const tel = (a2 || '').replace(/\D/g, '').slice(-10);
  if (!nombre || tel.length !== 10) { console.error('Uso: npm run chofer -- nuevo "Nombre Apellido" 8991234567'); process.exit(1); }
  const id = opt('id') ? slug(opt('id')) : slug(nombre);
  const lista = leer();
  const flotaId = opt('flota') || '';
  if (flotaId && !leerFlotas().some((f) => f.id === flotaId)) { console.error(`La flota "${flotaId}" no existe. Créala primero: npm run chofer -- flota-nueva "Nombre" 5218991234567`); process.exit(1); }
  const repetido = lista.find((c) => String(c.telefono).replace(/\D/g, '').slice(-10) === tel);
  if (repetido && !flags.has('--tel-repetido')) { console.error(`El teléfono ${tel} ya es de "${repetido.id}". Si es correcto, agrega --tel-repetido.`); process.exit(1); }
  if (lista.some((c) => c.id === id)) { console.error(`Ya existe un chofer con id "${id}". Si es otra persona con el mismo nombre, usa --id (ej. --id ${id}-2).`); process.exit(1); }
  // Con --ciudad el administrador asigna lo que se acordó con el chofer: --servicios a,b --tipos x,y --modalidades m --zonas z
  const ciudadId = opt('ciudad') || '';
  let nuevoModelo = null;
  if (ciudadId) {
    const ciu = leerCiudades().find((x) => x.id === ciudadId);
    if (!ciu) { console.error(`No existe la ciudad "${ciudadId}". Mira las ciudades con: npm run chofer -- listar`); process.exit(1); }
    const asignado = { servicios: csv(opt('servicios')), tipos: csv(opt('tipos')), modalidades: csv(opt('modalidades')), zonas: csv(opt('zonas')) };
    if (!asignado.servicios.length) { console.error('Con --ciudad indica al menos un servicio: --servicios local-puentes,aeropuertos (ids con: npm run chofer -- listar)'); process.exit(1); }
    for (const k of TIPOS_LISTA) {
      const faltan = asignado[k].filter((x) => !fuenteIds(k, ciudadId).some((i) => i.id === x));
      if (faltan.length) { console.error(`No existen en ${k}: ${faltan.join(', ')}. Mira los ids con: npm run chofer -- listar`); process.exit(1); }
    }
    nuevoModelo = { ciudadId, zona: `${ciu.nombre}, ${ciu.estado}`, asignado };
  }
  lista.push({
    id, nombre, telefono: tel, telefonoFormateado: fmt(tel),
    titulo: opt('titulo') || 'Movilidad Ejecutiva', zona: nuevoModelo ? nuevoModelo.zona : 'Reynosa, Tamaulipas', placa: '', unidad: '',
    ...(nuevoModelo ? { ciudadId: nuevoModelo.ciudadId, asignado: nuevoModelo.asignado } : { servicios: JSON.parse(JSON.stringify(lista[0]?.servicios || [])) }),
    logo: `${id}.png`,
    flota: flotaId,
    referido: opt('ref') || '',
    plan: opt('plan') || 'pro',
    pago: opt('pago') === 'anual' ? 'anual' : 'mensual',
    fechaAlta: new Date().toISOString().slice(0, 10),
    mensajes: { general: 'Hola, me interesa tu servicio de movilidad ejecutiva.' },
  });
  guardar(lista);
  const pin = nuevoPin();
  console.log(`\nChofer agregado: ${nombre} (${id})`);
  console.log(`  Plan: ${opt('plan') || 'pro'}   Vendedor: ${opt('ref') || '(ninguno)'}`);
  console.log(`  Tarjeta:  /t/${id}/`);
  console.log(`  Panel:    /chofer/${id}/`);
  console.log(`  PIN:      ${pin}   <- entrégaselo al chofer; no se vuelve a mostrar`);
  console.log(`  Logo (opcional): public/logos/${id}.png  (si no existe se usa rexi.png)`);
  kv('put', id, hashPin(id, pin));
  console.log('Después: git add -A && git commit -m "Alta de chofer ' + nombre + '" && git push');
} else if (cmd === 'flota-nueva') {
  const nombre = a1; const wa = (a2 || '').replace(/\D/g, '');
  if (!nombre) { console.error('Uso: npm run chofer -- flota-nueva "Nombre de la flota" 5218991234567'); process.exit(1); }
  if (wa && wa.length < 12) { console.error('El WhatsApp del dueño va con lada de país: 521 + 10 dígitos (ej. 5218991234567).'); process.exit(1); }
  const id = opt('id') ? slug(opt('id')) : slug(nombre);
  const lista = leerFlotas();
  if (lista.some((f) => f.id === id)) { console.error(`Ya existe la flota "${id}".`); process.exit(1); }
  lista.push({ id, nombre, whatsappDueno: wa });
  writeFileSync(ARCHIVO_FLOTAS, JSON.stringify(lista, null, 2) + '\n');
  console.log(`\nFlota agregada: ${nombre} (${id}). Para asignarle choferes: npm run chofer -- nuevo "Nombre" 8991234567 --flota ${id} --aplicar`);
} else if (cmd === 'validar') {
  const r = spawnSync('npm', ['run', 'build'], { cwd: RAIZ, stdio: 'inherit', shell: process.platform === 'win32' });
  process.exit(r.status || 0);
} else if (cmd === 'ref') {
  if (!a1 || !a2) { console.error('Uso: npm run chofer -- ref <id> <codigo-vendedor>'); process.exit(1); }
  const lista = leer(); const c = lista.find((x) => x.id === a1);
  if (!c) { console.error(`No existe el chofer "${a1}" en choferes.json.`); process.exit(1); }
  c.referido = a2; guardar(lista);
  console.log(`\n${a1} ahora está asignado al vendedor ${a2}.`);
} else if (cmd === 'pin') {
  if (!a1) { console.error('Uso: npm run chofer -- pin <id>'); process.exit(1); }
  if (!leer().some((c) => c.id === a1)) { console.error(`No existe el chofer "${a1}" en choferes.json.`); process.exit(1); }
  const pin = nuevoPin();
  console.log(`\nNuevo PIN para ${a1}: ${pin}   <- no se vuelve a mostrar`);
  kv('put', a1, hashPin(a1, pin));
} else if (cmd === 'baja') {
  if (!a1) { console.error('Uso: npm run chofer -- baja <id>'); process.exit(1); }
  const lista = leer();
  if (!lista.some((c) => c.id === a1)) { console.error(`No existe el chofer "${a1}" en choferes.json.`); process.exit(1); }
  guardar(lista.filter((c) => c.id !== a1));
  console.log(`\nChofer ${a1} quitado de choferes.json (su tarjeta desaparece en el próximo despliegue).`);
  kv('delete', a1);
  kv('delete', a1, undefined, 'pausa');
} else if (cmd === 'ciudad-nueva') {
  const nombre = a1; const estado = a2;
  if (!nombre || !estado) { console.error('Uso: npm run chofer -- ciudad-nueva "Monterrey" "Nuevo León" [--id monterrey]'); process.exit(1); }
  const id = opt('id') ? slug(opt('id')) : slug(nombre);
  const lista = leerCiudades();
  if (lista.some((c) => c.id === id)) { console.error(`Ya existe la ciudad "${id}".`); process.exit(1); }
  lista.push({ id, nombre, estado, activo: true, servicios: [], zonas: [] });
  guardarJson(ARCHIVO_CIUDADES, lista);
  console.log(`\nCiudad agregada: ${nombre}, ${estado} (${id}). Agrégale zonas: npm run chofer -- zona-nueva ${id} "Centro"`);
} else if (cmd === 'zona-nueva') {
  const ciudadId = a1; const nombre = a2;
  if (!ciudadId || !nombre) { console.error('Uso: npm run chofer -- zona-nueva <ciudad-id> "Nombre de la zona" [--id otro-id]'); process.exit(1); }
  const lista = leerCiudades(); const ciu = lista.find((c) => c.id === ciudadId);
  if (!ciu) { console.error(`No existe la ciudad "${ciudadId}". Mira las ciudades con: npm run chofer -- listar`); process.exit(1); }
  const id = opt('id') ? slug(opt('id')) : `${ciudadId}-${slug(nombre)}`;
  if (ciu.zonas.some((z) => z.id === id)) { console.error(`Ya existe la zona "${id}".`); process.exit(1); }
  ciu.zonas.push({ id, nombre, activo: true });
  guardarJson(ARCHIVO_CIUDADES, lista);
  console.log(`\nZona agregada a ${ciu.nombre}: ${nombre} (${id}).`);
} else if (cmd === 'servicio-ciudad') {
  const ciudadId = a1; const nombre = a2;
  if (!ciudadId || !nombre) { console.error('Uso: npm run chofer -- servicio-ciudad <ciudad-id> "Nombre" [--icono 🛫] [--descripcion "..."] [--mensaje "..."] [--color blue]'); process.exit(1); }
  const lista = leerCiudades(); const ciu = lista.find((c) => c.id === ciudadId);
  if (!ciu) { console.error(`No existe la ciudad "${ciudadId}".`); process.exit(1); }
  const id = opt('id') ? slug(opt('id')) : `${ciudadId}-${slug(nombre)}`;
  if (ciu.servicios.some((s) => s.id === id)) { console.error(`Ya existe el servicio "${id}".`); process.exit(1); }
  ciu.servicios.push({
    id, icono: opt('icono') || '🚖', color: opt('color') || 'blue', nombre,
    descripcion: opt('descripcion') || '', mensaje: opt('mensaje') || `Hola, me interesa el servicio: ${nombre}.`, activo: true,
  });
  guardarJson(ARCHIVO_CIUDADES, lista);
  console.log(`\nServicio propio de ${ciu.nombre} agregado: ${nombre} (${id}).`);
} else if (cmd === 'ciudad') {
  const choferId = a1; const ciudadId = a2;
  if (!choferId || !ciudadId) { console.error('Uso: npm run chofer -- ciudad <chofer-id> <ciudad-id>'); process.exit(1); }
  const lista = leer(); const c = lista.find((x) => x.id === choferId);
  if (!c) { console.error(`No existe el chofer "${choferId}".`); process.exit(1); }
  const ciu = leerCiudades().find((x) => x.id === ciudadId);
  if (!ciu) { console.error(`No existe la ciudad "${ciudadId}". Mira las ciudades con: npm run chofer -- listar`); process.exit(1); }
  const cat = leerCatalogo();
  const previo = c.asignado || { servicios: [], tipos: [], modalidades: [], zonas: [] };
  const cambia = c.ciudadId && c.ciudadId !== ciudadId;
  // Si cambia de ciudad se quitan las zonas y los servicios propios de la ciudad anterior; lo común se conserva.
  c.asignado = {
    servicios: cambia ? previo.servicios.filter((id) => cat.servicios.some((s) => s.id === id)) : previo.servicios,
    tipos: previo.tipos, modalidades: previo.modalidades,
    zonas: cambia ? [] : previo.zonas,
  };
  c.ciudadId = ciudadId; c.zona = `${ciu.nombre}, ${ciu.estado}`;
  guardar(lista);
  console.log(`\n${choferId} ahora trabaja en ${ciu.nombre}, ${ciu.estado}.`);
  if (!c.asignado.servicios.length) console.log(`Asígnale servicios: npm run chofer -- asignar ${choferId} servicios local-puentes aeropuertos   (ids con: npm run chofer -- listar)`);
  if (cambia) console.log('Se quitaron sus zonas y servicios de la ciudad anterior. Asígnale las nuevas zonas con: asignar <id> zonas ...');
} else if (cmd === 'asignar' || cmd === 'quitar') {
  const choferId = a1; const clave = a2; const ids = pos.slice(3);
  if (!choferId || !TIPOS_LISTA.includes(clave) || !ids.length) { console.error(`Uso: npm run chofer -- ${cmd} <chofer-id> <${TIPOS_LISTA.join('|')}> <id> [<id> ...]${cmd === 'asignar' ? '   (o "todos")' : ''}`); process.exit(1); }
  const lista = leer(); const c = lista.find((x) => x.id === choferId);
  if (!c) { console.error(`No existe el chofer "${choferId}".`); process.exit(1); }
  if (!c.ciudadId) { console.error(`"${choferId}" aún no tiene ciudad. Primero: npm run chofer -- ciudad ${choferId} <ciudad-id>`); process.exit(1); }
  c.asignado = c.asignado || { servicios: [], tipos: [], modalidades: [], zonas: [] };
  c.asignado[clave] = c.asignado[clave] || [];
  let objetivo = ids;
  if (cmd === 'asignar' && ids.length === 1 && ids[0] === 'todos') objetivo = fuenteIds(clave, c.ciudadId).filter((x) => x.activo !== false).map((x) => x.id);
  const faltan = objetivo.filter((id) => !fuenteIds(clave, c.ciudadId).some((x) => x.id === id));
  if (cmd === 'asignar' && faltan.length) { console.error(`No existen en ${clave}: ${faltan.join(', ')}. Mira los ids con: npm run chofer -- listar`); process.exit(1); }
  if (cmd === 'asignar') c.asignado[clave] = [...new Set([...c.asignado[clave], ...objetivo])];
  else c.asignado[clave] = c.asignado[clave].filter((id) => !objetivo.includes(id));
  guardar(lista);
  console.log(`\n${choferId} → ${clave}: ${c.asignado[clave].join(', ') || '(ninguno)'}`);
} else if (cmd === 'activar' || cmd === 'desactivar') {
  // npm run chofer -- desactivar catalogo tipos hospedaje      |      npm run chofer -- desactivar reynosa zonas reynosa-centro
  const donde = a1; const clave = a2; const id = pos[3];
  if (!donde || !clave || !id) { console.error(`Uso: npm run chofer -- ${cmd} <catalogo|ciudad-id> <clave> <id>   (catalogo: tipos|modalidades|servicios; ciudad: servicios|zonas)`); process.exit(1); }
  const valor = cmd === 'activar';
  let item;
  if (donde === 'catalogo') {
    const cat = leerCatalogo(); item = (cat[clave] || []).find((x) => x.id === id);
    if (item) { item.activo = valor; guardarJson(ARCHIVO_CATALOGO, cat); }
  } else {
    const ciudades = leerCiudades(); const ciu = ciudades.find((x) => x.id === donde);
    if (!ciu) { console.error(`No existe la ciudad "${donde}".`); process.exit(1); }
    item = (ciu[clave] || []).find((x) => x.id === id);
    if (item) { item.activo = valor; guardarJson(ARCHIVO_CIUDADES, ciudades); }
  }
  if (!item) { console.error(`No encontré "${id}" en ${donde}/${clave}. Mira los ids con: npm run chofer -- listar`); process.exit(1); }
  console.log(`\n${item.nombre} (${id}) ahora está ${valor ? 'ACTIVO' : 'INACTIVO'} en ${donde}. Se aplica en el próximo despliegue.`);
} else if (cmd === 'listar') {
  const cat = leerCatalogo(); const ciudades = leerCiudades();
  const fila = (x) => `    ${x.activo === false ? '✗' : '✓'} ${x.id.padEnd(28)} ${x.nombre}`;
  if (a1) {
    const c = leer().find((x) => x.id === a1);
    if (!c) { console.error(`No existe el chofer "${a1}".`); process.exit(1); }
    console.log(`\n${c.nombre} (${c.id}) — ciudad: ${c.ciudadId || '(sin ciudad: formato anterior)'}`);
    for (const k of TIPOS_LISTA) console.log(`  ${k}: ${((c.asignado || {})[k] || []).join(', ') || '—'}`);
    console.log('\n(Lo que el chofer pausó en su panel se guarda en la nube y no aparece aquí.)');
  } else {
    console.log('\nCATÁLOGO COMÚN');
    for (const k of ['servicios', 'tipos', 'modalidades']) { console.log(`  ${k}:`); cat[k].forEach((x) => console.log(fila(x))); }
    ciudades.forEach((ciu) => {
      console.log(`\nCIUDAD ${ciu.id} — ${ciu.nombre}, ${ciu.estado} ${ciu.activo === false ? '(INACTIVA)' : ''}`);
      console.log('  servicios propios:'); ciu.servicios.forEach((x) => console.log(fila(x)));
      console.log('  zonas:'); ciu.zonas.forEach((x) => console.log(fila(x)));
    });
  }
} else {
  console.log('Comandos: nuevo | pin | baja | ref | flota-nueva | validar | ciudad-nueva | zona-nueva | servicio-ciudad | ciudad | asignar | quitar | activar | desactivar | listar. Mira el encabezado de scripts/chofer.mjs.');
  process.exit(cmd ? 1 : 0);
}
