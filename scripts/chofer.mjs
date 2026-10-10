#!/usr/bin/env node
// Alta, cambio de PIN y baja de choferes.
//
//   npm run chofer -- nuevo "Nombre Apellido" 8991234567 [--titulo "Movilidad Ejecutiva"] [--plan pro] [--ref V01] [--aplicar]
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

const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const hashPin = (id, pin) => createHash('sha256').update(`${id}:${pin}`).digest('hex');
const nuevoPin = () => String(randomInt(0, 1_000_000)).padStart(6, '0');
const leer = () => JSON.parse(readFileSync(ARCHIVO, 'utf8'));
const guardar = (d) => writeFileSync(ARCHIVO, JSON.stringify(d, null, 2) + '\n');
const fmt = (t) => `${t.slice(0, 3)} ${t.slice(3, 6)} ${t.slice(6)}`;

function kv(accion, id, valor) {
  const alcance = flags.has('--local') ? '--local' : '--remote';
  const argv = ['wrangler', 'kv', 'key', accion, `pin:${id}`];
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
  const id = slug(nombre);
  const lista = leer();
  if (lista.some((c) => c.id === id)) { console.error(`Ya existe un chofer con id "${id}".`); process.exit(1); }
  lista.push({
    id, nombre, telefono: tel, telefonoFormateado: fmt(tel),
    titulo: opt('titulo') || 'Movilidad Ejecutiva', zona: 'Reynosa, Tamaulipas', placa: '', unidad: '',
    servicios: JSON.parse(JSON.stringify(lista[0]?.servicios || [])),
    logo: `${id}.png`,
    referido: opt('ref') || '',
    plan: opt('plan') || 'pro',
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
} else {
  console.log('Comandos: nuevo | pin | baja | ref. Mira el encabezado de scripts/chofer.mjs.');
  process.exit(cmd ? 1 : 0);
}
