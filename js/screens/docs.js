// Documentos sensibles (pasaportes, seguro): solo en este celular, cifrados y con PIN.
// Nunca se envían al Sheet ni a Drive y no entran en el respaldo normal.
import * as store from '../store.js';
import { uid } from '../logic.js';
import { h, raw, esc, icon, openSheet, confirmar, toast, $, shrinkImage } from '../ui.js';

const enc = new TextEncoder(), dec = new TextDecoder();
let key = null, lockT;

async function deriveKey(pin, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function seal(k, buf) { const iv = crypto.getRandomValues(new Uint8Array(12)); return { iv, ct: await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, buf) }; }
const unseal = (k, { iv, ct }) => crypto.subtle.decrypt({ name: 'AES-GCM', iv }, k, ct);
const sealJson = (k, o) => seal(k, enc.encode(JSON.stringify(o)));
const unsealJson = async (k, s) => JSON.parse(dec.decode(await unseal(k, s)));

const rerender = () => window.dispatchEvent(new Event('app-rerender'));
export const isLocked = () => !key;
export function lock() { key = null; }
const bump = () => { clearTimeout(lockT); lockT = setTimeout(() => { key = null; document.dispatchEvent(new Event('docs-locked')); }, 2 * 60 * 1000); };
document.addEventListener('visibilitychange', () => { if (document.hidden) key = null; });

export async function setPin(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const k = await deriveKey(pin, salt);
  await store.idb.put('secure', { id: 'pin', salt, check: await seal(k, enc.encode('ok')) });
  key = k; bump();
}
export async function tryPin(pin) {
  const r = await store.idb.get('secure', 'pin');
  if (!r) return false;
  const k = await deriveKey(pin, r.salt);
  try { if (dec.decode(await unseal(k, r.check)) === 'ok') { key = k; bump(); return true; } } catch { /* PIN equivocado */ }
  return false;
}
export const hasPin = async () => !!(await store.idb.get('secure', 'pin'));

export async function listDocs() {
  const all = (await store.idb.all('secure')).filter((r) => r.id !== 'pin');
  const out = [];
  for (const r of all) { try { out.push({ id: r.id, ...(await unsealJson(key, r.meta)), _r: r }); } catch { /* registro de otro PIN */ } }
  return out.sort((a, b) => a.nombre.localeCompare(b.nombre));
}
async function saveDoc(existing, meta, newFiles) {
  const blobs = existing ? [...existing._r.blobs] : [];
  const files = existing ? [...existing.files] : [];
  for (const f of newFiles) {
    const sm = await shrinkImage(f);
    blobs.push(await seal(key, await sm.arrayBuffer()));
    files.push({ name: f.name, type: sm.type || f.type, size: sm.size });
  }
  const m = { ...meta, files };
  await store.idb.put('secure', { id: existing?.id || uid('d'), meta: await sealJson(key, m), blobs });
}
async function openDocFile(d, i) {
  const buf = await unseal(key, d._r.blobs[i]);
  const f = d.files[i];
  const u = URL.createObjectURL(new Blob([buf], { type: f.type }));
  if ((f.type || '').startsWith('image/')) {
    const el = document.createElement('div'); el.className = 'viewer';
    el.innerHTML = `<button class="viewer-x" aria-label="Cerrar">✕</button><img alt="${esc(f.name)}" src="${u}">`;
    el.onclick = () => { el.remove(); URL.revokeObjectURL(u); document.body.classList.remove('lock'); };
    document.body.append(el); document.body.classList.add('lock');
  } else window.open(u, '_blank');
}

export async function render(root) {
  const pin = await hasPin();
  const head = `<a class="back" href="#/mas">${icon('back').s}Más</a><header class="top"><p class="kicker">Solo en este celular</p><h1 class="city-h">Documentos</h1></header>`;
  if (!key) {
    root.innerHTML = `${head}<form class="card pin-card" id="pin-f" novalidate><h4>${pin ? 'Ingresá tu PIN' : 'Creá un PIN para proteger tus documentos'}</h4>
      <p class="hint">${pin ? '' : 'Los documentos se guardan cifrados y solo en este celular. No van al Sheet, ni a Drive, ni al respaldo. Si olvidás el PIN no hay forma de recuperarlos. Usá 6 números o más.'}</p>
      <label class="f"><span>PIN</span><input id="pin" type="password" inputmode="numeric" autocomplete="off" minlength="4" maxlength="12"></label>
      ${pin ? '' : '<label class="f"><span>Repetí el PIN</span><input id="pin2" type="password" inputmode="numeric" autocomplete="off" maxlength="12"></label>'}
      <p class="err" id="pin-e" hidden role="alert"></p><button class="btn btn-p btn-block">${pin ? 'Abrir' : 'Crear PIN'}</button></form>`;
    $('#pin-f', root).addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = $('#pin').value.trim(), er = $('#pin-e');
      er.hidden = false;
      if (!/^\d{4,12}$/.test(v)) { er.textContent = 'El PIN son entre 4 y 12 números'; return; }
      if (pin) { if (!(await tryPin(v))) { er.textContent = 'PIN incorrecto'; $('#pin').value = ''; return; } }
      else { if (v !== $('#pin2').value.trim()) { er.textContent = 'Los dos PIN no coinciden'; return; } await setPin(v); }
      rerender();
    });
    return;
  }
  bump();
  const docs = await listDocs();
  root.innerHTML = h`${raw(head)}
    <ul class="next">${docs.length ? docs.map((d) => raw(`<li class="n" data-id="${d.id}"><button class="n-b" data-act="open"><b>${esc(d.nombre)}</b><small>${esc(d.tipo)} · ${d.files.length} archivo${d.files.length === 1 ? '' : 's'}${d.nota ? ' · ' + esc(d.nota) : ''}</small></button></li>`)) : raw('<li class="empty">Todavía no cargaste documentos. Agregá pasaportes, seguro de viaje, vouchers…</li>')}</ul>
    <button class="btn btn-p btn-block" id="add">${icon('plus').s}Agregar documento</button>
    <button class="btn btn-s btn-block" id="lock">${icon('lock').s}Bloquear ahora</button>
    <p class="hint">Cada uno carga los suyos en su celular. Se bloquea solo a los 2 minutos o al salir de la app.</p>`.toString();
  $('#lock', root).onclick = () => { lock(); rerender(); };
  $('#add', root).onclick = () => docForm(null, root);
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act=open]'); if (!b) return;
    const d = docs.find((x) => x.id === b.closest('[data-id]').dataset.id);
    const el = document.createElement('div');
    el.innerHTML = `<div class="list">${d.files.map((f, i) => `<button class="row" data-i="${i}">${icon('doc').s}<span>${esc(f.name)}</span></button>`).join('') || '<p class="empty">Sin archivos</p>'}</div><div class="btns"><button class="btn btn-s" data-a="edit">Editar</button></div>`;
    const sh = openSheet(el, { titulo: d.nombre });
    el.addEventListener('click', (ev) => {
      const i = ev.target.closest('[data-i]')?.dataset.i;
      if (i !== undefined) openDocFile(d, +i);
      if (ev.target.closest('[data-a=edit]')) { sh.close(); setTimeout(() => docForm(d, root), 150); }
    });
  });
}

function docForm(d, root) {
  const el = document.createElement('form'); el.className = 'form'; el.noValidate = true;
  el.innerHTML = `<label class="f"><span>Nombre *</span><input id="d-n" value="${esc(d?.nombre || '')}" placeholder="Ej: Pasaporte de Valentino"></label>
    <label class="f"><span>Tipo</span><select id="d-t">${['Pasaporte', 'Seguro', 'Voucher', 'Otro'].map((t) => `<option ${d?.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    <label class="f"><span>Nota (queda cifrada)</span><textarea id="d-o" rows="2">${esc(d?.nota || '')}</textarea></label>
    <label class="btn btn-s file-add">${icon('plus').s}<span id="d-fl">Agregar PDF o foto</span><input id="d-f" type="file" multiple accept="image/*,application/pdf" hidden></label>
    ${d?.files?.length ? `<p class="hint">Ya tiene ${d.files.length} archivo(s). Los nuevos se suman.</p>` : ''}
    <p class="err" id="d-e" hidden role="alert"></p>
    <div class="btns"><button type="button" class="btn btn-s" data-a="x">Cancelar</button><button class="btn btn-p">Guardar</button></div>
    ${d ? '<button type="button" class="btn btn-d btn-block" data-a="del">Borrar documento</button>' : ''}`;
  const sh = openSheet(el, { titulo: d ? 'Editar documento' : 'Nuevo documento' });
  $('#d-f', el).onchange = (e) => { $('#d-fl', el).textContent = `${e.target.files.length} archivo(s) elegido(s)`; };
  el.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'x') sh.close();
    if (a === 'del' && await confirmar('¿Borrar este documento de este celular? No se puede deshacer.')) { await store.idb.del('secure', d.id); sh.close(); rerender(); }
  });
  el.addEventListener('submit', async (e) => {
    e.preventDefault();
    const n = $('#d-n', el).value.trim();
    if (!n) { const er = $('#d-e', el); er.hidden = false; er.textContent = 'Falta el nombre'; return; }
    await saveDoc(d, { nombre: n, tipo: $('#d-t', el).value, nota: $('#d-o', el).value.trim() }, [...$('#d-f', el).files]);
    sh.close(); toast('Documento guardado y cifrado'); rerender();
  });
}
