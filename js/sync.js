// Sincronización con el Google Sheet a través del puente (Apps Script).
// Regla: gana el último cambio, fila por fila. Sin internet, todo queda en el celular y se envía al volver.
import * as store from './store.js';
import { COLS, SCHEMA } from './schema.js';

export const state = { estado: 'sin-config', ultima: 0, msg: '', cambios: 0 };
const listeners = new Set();
export const onState = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const set = (patch) => { Object.assign(state, patch); listeners.forEach((f) => f(state)); };

let conf = null;
let running = false;
let again = false;

export async function loadConfig() {
  conf = await store.meta.get('puente', null);
  state.ultima = await store.meta.get('ultimaSync', 0);
  set({ estado: conf?.url && conf?.clave ? (navigator.onLine ? 'listo' : 'sin-conexion') : 'sin-config' });
  return conf;
}
export const getConf = () => conf;
export async function saveConf(c) { conf = c; await store.meta.set('puente', c); await loadConfig(); }

async function call(body) {
  const r = await fetch(conf.url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // evita el "preflight" de CORS con Apps Script
    body: JSON.stringify({ ...body, clave: conf.clave }),
    redirect: 'follow',
  });
  if (!r.ok) throw new Error(`El puente respondió ${r.status}`);
  let j;
  try { j = await r.json(); } catch { throw new Error('El puente no devolvió datos válidos (revisá el link)'); }
  if (!j.ok) throw new Error(j.error || 'El puente rechazó el pedido');
  return j;
}

const fileRefs = (doc, col) => SCHEMA[col].fields.filter((f) => f.t === 'files').flatMap((f) => doc[f.k] || []);

export async function syncNow() {
  if (!conf?.url || !conf?.clave) return;
  if (!navigator.onLine) return set({ estado: 'sin-conexion' });
  if (running) { again = true; return; }
  running = true;
  set({ estado: 'sincronizando', msg: '' });
  let nuevos = 0;
  try {
    // 1) Enviar lo que cambié acá
    const dirty = store.dirtyDocs();
    if (dirty.length) {
      const rows = {};
      dirty.forEach((d) => (rows[d.col] = rows[d.col] || []).push(store.stripLocal(d)));
      await call({ action: 'push', rows });
      for (const d of dirty) await store.markClean(d.col, d.id, d.updated);
    }
    // 2) Traer lo nuevo
    const since = await store.meta.get('desde', 0);
    const j = await call({ action: 'pull', since });
    for (const col of COLS) for (const raw of j.rows?.[col] || []) if (await store.applyRemote(col, raw)) nuevos++;
    await store.meta.set('desde', Math.max(0, (j.now || Date.now()) - 5 * 60 * 1000));
    // 3) Archivos: subir los míos, bajar los que faltan
    await syncFiles();
    const ultima = Date.now();
    await store.meta.set('ultimaSync', ultima);
    set({ estado: 'listo', ultima, msg: nuevos ? `Se actualizaron ${nuevos} datos` : '' });
  } catch (e) {
    set({ estado: navigator.onLine ? 'error' : 'sin-conexion', msg: e.message });
  } finally {
    running = false;
    if (again) { again = false; setTimeout(syncNow, 500); }
  }
}

async function syncFiles() {
  for (const f of await store.files.all()) {
    if (f.sync === false || f.uploaded) continue;
    try {
      const dataB64 = (await store.blobToDataUrl(f.blob)).split(',')[1];
      await call({ action: 'putFile', id: f.id, name: f.name, type: f.type, dataB64 });
      await store.files.put({ ...f, uploaded: true });
    } catch (e) { if (/grande|límite/i.test(e.message)) await store.files.put({ ...f, uploaded: true }); else throw e; }
  }
  const refs = new Set();
  for (const col of COLS) for (const d of store.list(col)) fileRefs(d, col).forEach((r) => refs.add(r.id));
  for (const id of refs) {
    if (await store.files.get(id)) continue;
    try {
      const j = await call({ action: 'getFile', id });
      const blob = await (await fetch(`data:${j.type || 'application/octet-stream'};base64,${j.dataB64}`)).blob();
      await store.files.put({ id, name: j.name, type: j.type, blob, sync: true, uploaded: true });
    } catch { /* ese archivo todavía no está en Drive: se reintenta la próxima */ }
  }
}

let timer;
export function start() {
  loadConfig().then(() => syncNow());
  window.addEventListener('online', () => syncNow());
  window.addEventListener('offline', () => state.estado !== 'sin-config' && set({ estado: 'sin-conexion' }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncNow(); });
  store.subscribe(() => { clearTimeout(timer); timer = setTimeout(() => store.dirtyDocs().length && syncNow(), 1500); });
  setInterval(() => !document.hidden && syncNow(), 3 * 60 * 1000);
}
