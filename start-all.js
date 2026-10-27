'use strict';
/**
 * Arranca TODO en un solo servicio de Railway:
 *   1) tu bot del Elo (el de siempre)
 *   2) la página web + su API  (elo-web/elo-api/server.js)  -> usa el PORT que da Railway
 *   3) el bot de la web (elo-web/web-bot), solo si pusiste WEB_BOT_TOKEN
 * Va en la RAÍZ del repositorio del bot. En Railway: Settings > Deploy > Custom Start Command:  node start-all.js
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const WEB = path.join(ROOT, 'elo-web');
const log = (...a) => console.log('[start-all]', ...a);

// --- dónde se guardan los datos (todo debe vivir dentro del Volume) ---
// El bot guarda su db.json en <repo>/data (fijo en src/database.js). Ahí se monta el Volume.
if (!process.env.BOT_DB_PATH) process.env.BOT_DB_PATH = path.join(ROOT, 'data', 'db.json');
if (process.env.BOT_DB_PATH && path.isAbsolute(process.env.BOT_DB_PATH)) {
  const dir = path.dirname(process.env.BOT_DB_PATH);
  if (!process.env.WEB_DATA_DIR) process.env.WEB_DATA_DIR = path.join(dir, 'web');
}
if (process.env.WEB_DATA_DIR) {
  fs.mkdirSync(process.env.WEB_DATA_DIR, { recursive: true });
  if (!process.env.SITE_FILE) process.env.SITE_FILE = path.join(process.env.WEB_DATA_DIR, 'site.json'); // lo usa el bot de la web
  log('Datos de la web en', process.env.WEB_DATA_DIR);
} else log('AVISO: sin BOT_DB_PATH/WEB_DATA_DIR los clips y archivos subidos se borran en cada despliegue.');
if (process.env.API_PORT) log('AVISO: borra la variable API_PORT; Railway usa PORT.');

// --- SEMILLA: copia la carpeta /seed al Volume SOLO si el archivo todavía no existe ---
// seed/db.json -> data/db.json   |   seed/web/* -> data/web/*   (nunca pisa lo que ya hay)
try {
  const SEED = path.join(ROOT, 'seed');
  if (fs.existsSync(SEED)) {
    const DATA = path.dirname(process.env.BOT_DB_PATH);
    fs.mkdirSync(DATA, { recursive: true });
    fs.cpSync(SEED, DATA, { recursive: true, force: false, errorOnExist: false });
    log('Semilla copiada al Volume (solo lo que faltaba) ->', DATA);
  }
} catch (e) { log('No pude copiar la semilla:', e.message); }

// --- comando del bot (el que ya usabas) ---
function botCommand() {
  if (process.env.BOT_CMD) return process.env.BOT_CMD;
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    const start = pkg.scripts && pkg.scripts.start;
    if (start && !/start-all/.test(start)) return 'npm start';
    if (pkg.main && pkg.main !== 'start-all.js') return `node ${pkg.main}`;
  } catch { /* sin package.json */ }
  return 'node index.js';
}

const children = new Map();
function run(name, cmd, cwd, { critical = false } = {}) {
  const child = spawn(cmd, { cwd, shell: true, stdio: 'inherit', env: process.env });
  children.set(name, child);
  log(`${name} encendido: ${cmd}`);
  child.on('exit', (code, sig) => {
    children.delete(name);
    log(`${name} se detuvo (código ${code ?? sig})`);
    if (stopping) return;
    if (critical) { log('El bot se cayó: reinicio todo para que Railway lo levante limpio.'); stop(1); return; }
    setTimeout(() => { if (!stopping) run(name, cmd, cwd); }, 5000); // la web y su bot se reintentan solos
  });
}

let stopping = false;
function stop(code = 0) {
  if (stopping) return; stopping = true;
  for (const c of children.values()) { try { c.kill('SIGTERM'); } catch { /* ya cerrado */ } }
  setTimeout(() => process.exit(code), 1500);
}
process.on('SIGTERM', () => stop(0));
process.on('SIGINT', () => stop(0));

const SOLO_WEB = process.env.SOLO_WEB === '1'; // 1 = NO prender el bot del Elo (ya corre en otra cuenta)
if (!SOLO_WEB) run('bot', botCommand(), ROOT, { critical: true });
else log('SOLO_WEB=1: el bot del Elo NO se enciende aquí (solo página + bot de la página).');

// Si el bot del Elo vive en otro servicio, trae su db.json cada 20 s desde DB_SYNC_URL
if (SOLO_WEB && process.env.DB_SYNC_URL) {
  const dest = process.env.BOT_DB_PATH;
  const sync = async () => {
    try {
      const r = await fetch(process.env.DB_SYNC_URL, { headers: { 'X-Export-Key': process.env.EXPORT_KEY || '' }, signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const txt = await r.text(); JSON.parse(txt); // solo guarda si es un JSON válido
      const tmp = dest + '.tmp'; fs.writeFileSync(tmp, txt); fs.renameSync(tmp, dest);
    } catch (e) { log('Sync db.json falló (sigo con la última copia):', e.message); }
  };
  sync(); setInterval(sync, 20000).unref();
  log('Sincronizando db.json desde', process.env.DB_SYNC_URL);
}
if (fs.existsSync(path.join(WEB, 'elo-api', 'server.js'))) run('web', 'node elo-api/server.js', WEB);
else log('No encontré la carpeta elo-web: solo corre el bot.');
if (process.env.WEB_BOT_TOKEN) {
  const WB = path.join(WEB, 'web-bot');
  if (fs.existsSync(WB) && !fs.existsSync(path.join(WB, 'node_modules'))) { // hosts sin Build Command: instala aquí
    log('Instalando dependencias de web-bot (solo la primera vez)...');
    try { require('child_process').execSync('npm install --omit=dev --no-audit --no-fund', { cwd: WB, stdio: 'inherit' }); }
    catch (e) { log('AVISO: no pude instalar web-bot:', e.message); }
  }
  if (fs.existsSync(path.join(WB, 'node_modules'))) run('web-bot', 'node src/index.js', WB);
}
