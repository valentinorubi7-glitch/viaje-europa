// Base de datos local del celular (IndexedDB) + lista de cambios pendientes de enviar.
import { COLS, SCHEMA, MONEDAS_DEF, CATEGORIAS_DEF, PERSONAS_DEF } from './schema.js';
import { coerce, shouldApply, uid } from './logic.js';

let db;
const data = Object.fromEntries(COLS.map((c) => [c, new Map()]));
const subs = new Set();

function open() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('viaje-europa', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('docs', { keyPath: 'k' });
      d.createObjectStore('files', { keyPath: 'id' });
      d.createObjectStore('meta', { keyPath: 'k' });
      d.createObjectStore('secure', { keyPath: 'id' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
const wrap = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
const st = (name, mode = 'readonly') => db.transaction(name, mode).objectStore(name);
export const idb = {
  get: (s, k) => wrap(st(s).get(k)),
  put: (s, v) => wrap(st(s, 'readwrite').put(v)),
  del: (s, k) => wrap(st(s, 'readwrite').delete(k)),
  all: (s) => wrap(st(s).getAll()),
  clear: (s) => wrap(st(s, 'readwrite').clear()),
};

export async function init() {
  db = await open();
  for (const d of await idb.all('docs')) if (data[d.col]) data[d.col].set(d.id, d);
  try { await navigator.storage?.persist?.(); } catch { /* sin permiso: no pasa nada */ }
}

export const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };
let pending = null;
const notify = () => { // junta varios cambios seguidos en un solo redibujado
  if (pending) return;
  pending = Promise.resolve().then(() => { pending = null; subs.forEach((f) => f()); });
};

export const list = (col, { deleted = false } = {}) => [...data[col].values()].filter((d) => deleted || !d.deleted);
export const get = (col, id) => { const d = data[col].get(id); return d && !d.deleted ? d : undefined; };
export const hasData = () => COLS.some((c) => c !== 'config' && data[c].size > 0);

export async function save(col, doc) {
  const prev = data[col].get(doc.id);
  const d = { ...(prev || {}), ...doc, id: doc.id || uid(col.slice(0, 2)), col, k: '', updated: Date.now(), deleted: false, _dirty: 1 };
  d.k = `${col}:${d.id}`;
  data[col].set(d.id, d);
  await idb.put('docs', d);
  notify();
  return d;
}
export async function remove(col, id) {
  const prev = data[col].get(id);
  if (!prev) return;
  const d = { ...prev, deleted: true, updated: Date.now(), _dirty: 1 };
  data[col].set(id, d);
  await idb.put('docs', d);
  notify();
}
export async function restore(col, id) {
  const prev = data[col].get(id);
  if (prev) await save(col, { ...prev, deleted: false });
}

// Lo que llega del Sheet: gana el más nuevo
export async function applyRemote(col, raw) {
  if (!data[col]) return false;
  const doc = coerce(SCHEMA[col].fields, raw);
  const local = data[col].get(doc.id);
  if (local?._dirty && Number(local.updated) >= Number(doc.updated)) return false;
  if (!shouldApply(local, doc)) return false;
  const d = { ...doc, col, k: `${col}:${doc.id}`, _dirty: 0 };
  data[col].set(d.id, d);
  await idb.put('docs', d);
  notify();
  return true;
}
export const dirtyDocs = () => COLS.flatMap((c) => [...data[c].values()].filter((d) => d._dirty));
export async function markClean(col, id, updated) {
  const d = data[col].get(id);
  if (d && d.updated === updated) { d._dirty = 0; await idb.put('docs', d); }
}
export async function markAllDirty() {
  for (const c of COLS) for (const d of data[c].values()) { d._dirty = 1; await idb.put('docs', d); }
}
export const stripLocal = (d) => {
  const o = {};
  for (const [k, v] of Object.entries(d)) if (!k.startsWith('_') && k !== 'k' && k !== 'col') o[k] = v;
  return o;
};

// --- Ajustes compartidos (monedas, categorías, personas) ---
export function config() {
  const c = data.config.get('config') || {};
  return {
    personas: c.personas?.length ? c.personas : PERSONAS_DEF,
    monedas: c.monedas?.length ? c.monedas : MONEDAS_DEF,
    categoriasGasto: c.categoriasGasto?.length ? c.categoriasGasto : CATEGORIAS_DEF,
    fondoFoto: c.fondoFoto || '',
    tc: c.tc || {},
  };
}
export const saveConfig = (patch) => save('config', { ...(data.config.get('config') || {}), ...config(), ...patch, id: 'config' });

// --- Ajustes de este celular (no se comparten) ---
export const meta = {
  get: async (k, def) => (await idb.get('meta', k))?.v ?? def,
  set: (k, v) => idb.put('meta', { k, v }),
};

// --- Archivos (tickets, fotos): se guardan en el celular ---
export const files = {
  put: (rec) => idb.put('files', rec), // {id,name,type,blob,sync,uploaded}
  get: (id) => idb.get('files', id),
  del: (id) => idb.del('files', id),
  all: () => idb.all('files'),
};

// --- Respaldo completo ---
export async function exportAll({ conArchivos = true } = {}) {
  const out = { app: 'viaje-europa', version: 1, exportado: new Date().toISOString(), docs: {}, files: {} };
  for (const c of COLS) out.docs[c] = [...data[c].values()].map(stripLocal);
  if (conArchivos) {
    for (const f of await files.all()) {
      if (f.sync === false) continue;
      out.files[f.id] = { name: f.name, type: f.type, sync: f.sync !== false, dataUrl: await blobToDataUrl(f.blob) };
    }
  }
  return out;
}
export async function importAll(json, { marcarCambios = true } = {}) {
  if (json?.app !== 'viaje-europa') throw new Error('Este archivo no es un respaldo de la app');
  let n = 0;
  for (const [id, f] of Object.entries(json.files || {})) {
    await files.put({ id, name: f.name, type: f.type, blob: await (await fetch(f.dataUrl)).blob(), sync: f.sync !== false, uploaded: false });
  }
  for (const [col, docs] of Object.entries(json.docs || {})) {
    if (!data[col]) continue;
    for (const raw of docs) {
      const doc = coerce(SCHEMA[col].fields, raw);
      const d = { ...doc, col, k: `${col}:${doc.id}`, updated: marcarCambios ? Date.now() : doc.updated, _dirty: marcarCambios ? 1 : 0 };
      data[col].set(d.id, d);
      await idb.put('docs', d);
      n++;
    }
  }
  notify();
  return n;
}
export async function wipeAll() {
  for (const s of ['docs', 'files', 'meta', 'secure']) await idb.clear(s);
  COLS.forEach((c) => data[c].clear());
  notify();
}

export function blobToDataUrl(blob) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
}
