// Piezas de pantalla reutilizables: HTML seguro, hojas inferiores, formularios, archivos, avisos.
import * as store from './store.js';
import { SCHEMA } from './schema.js';
import { uid, sortCities } from './logic.js';
import { linkParaSacar } from './links.js';

// --- HTML seguro: todo lo que viene de datos pasa por esc() ---
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Raw(s);
const ICON_RE = new RegExp('^<svg class="ic [^"<>]*" aria-hidden="true"><use href="#i-[a-z]+"/></svg>$');
export const h = (strs, ...vals) =>
  new Raw(strs.reduce((a, s, i) => {
    let v = vals[i - 1];
    if (Array.isArray(v)) v = v.map((x) => (x instanceof Raw ? x.s : esc(x))).join('');
    else if (v instanceof Raw) v = v.s;
    else if (typeof v === 'string' && ICON_RE.test(v)) { /* íconos propios: markup fijo y seguro */ }
    else v = esc(v ?? '');
    return a + v + s;
  }));
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export const icon = (n, c = '') => raw(`<svg class="ic ${c}" aria-hidden="true"><use href="#i-${n}"/></svg>`);

// --- Avisos ---
let toastT;
export function toast(msg, accion) {
  const t = $('#toast');
  t.innerHTML = '';
  const s = document.createElement('span'); s.textContent = msg; t.append(s);
  if (accion) { const b = document.createElement('button'); b.textContent = accion.l; b.onclick = () => { accion.fn(); t.classList.remove('on'); }; t.append(b); }
  t.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('on'), accion ? 6000 : 2600);
}

// --- Hoja inferior ---
const stack = [];
export function openSheet(content, { titulo = '', onClose, full = false } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="shade"></div><div class="sheet ${full ? 'full' : ''}" role="dialog" aria-modal="true" aria-label="${esc(titulo)}"><div class="grab" aria-hidden="true"></div>${titulo ? `<h2>${esc(titulo)}</h2>` : ''}<div class="sheet-body"></div></div>`;
  const body = $('.sheet-body', wrap);
  if (content instanceof Node) body.append(content); else body.innerHTML = content.toString();
  document.body.append(wrap);
  document.body.classList.add('lock');
  requestAnimationFrame(() => wrap.classList.add('on'));
  const api = {
    el: body,
    close() {
      if (!wrap.isConnected) return;
      wrap.classList.remove('on');
      setTimeout(() => { wrap.remove(); if (!stack.length) document.body.classList.remove('lock'); }, 280);
      stack.splice(stack.indexOf(api), 1);
      onClose?.();
    },
  };
  $('.shade', wrap).addEventListener('click', () => api.close());
  stack.push(api);
  return api;
}
export const closeSheets = () => [...stack].forEach((s) => s.close());
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && stack.length) stack[stack.length - 1].close(); });

export function confirmar(texto, { si = 'Sí, borrar', no = 'Cancelar', peligro = true } = {}) {
  return new Promise((res) => {
    const el = document.createElement('div');
    el.innerHTML = `<p class="conf-t">${esc(texto)}</p><div class="btns"><button class="btn btn-s" data-r="0">${esc(no)}</button><button class="btn ${peligro ? 'btn-d' : 'btn-p'}" data-r="1">${esc(si)}</button></div>`;
    let r = false;
    const sh = openSheet(el, { onClose: () => res(r) });
    el.addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (b) { r = b.dataset.r === '1'; sh.close(); } });
  });
}

// --- Archivos ---
const urls = new Map();
export async function fileUrl(id) {
  if (urls.has(id)) return urls.get(id);
  const f = await store.files.get(id);
  if (!f) return null;
  const u = URL.createObjectURL(f.blob);
  urls.set(id, u);
  return u;
}
export async function shrinkImage(file, max = 2000, q = 0.86) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (k === 1 && file.size < 1.5e6) return file;
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', q));
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch { return file; }
}
export async function saveFile(file, { sync = true } = {}) {
  const f = await shrinkImage(file);
  const id = uid('f');
  await store.files.put({ id, name: file.name, type: f.type || 'application/octet-stream', blob: f, sync, uploaded: false });
  return { id, name: file.name, type: f.type, size: f.size };
}

export async function viewFile(ref) {
  const u = await fileUrl(ref.id);
  if (!u) return toast('Este archivo todavía no está en este celular. Conectate a internet para bajarlo.');
  const isImg = (ref.type || '').startsWith('image/');
  if (!isImg) { window.open(u, '_blank'); return; }
  const el = document.createElement('div');
  el.className = 'viewer';
  el.innerHTML = `<button class="viewer-x" aria-label="Cerrar">✕</button><img alt="${esc(ref.name)}" src="${u}">`;
  const close = () => { el.remove(); document.body.classList.remove('lock'); };
  el.addEventListener('click', close);
  document.body.append(el); document.body.classList.add('lock');
}

// Campo "archivos" dentro de un formulario
function filesField(initial, sync = true, onAdded = null) {
  let refs = [...(initial || [])];
  const box = document.createElement('div');
  box.className = 'files';
  const draw = () => {
    box.innerHTML = '';
    refs.forEach((r, i) => {
      const row = document.createElement('div'); row.className = 'file-row';
      const b = document.createElement('button'); b.type = 'button'; b.className = 'file-n'; b.textContent = `📎 ${r.name}`; b.onclick = () => viewFile(r);
      const x = document.createElement('button'); x.type = 'button'; x.className = 'file-x'; x.textContent = 'Quitar'; x.onclick = () => { refs.splice(i, 1); draw(); };
      row.append(b, x); box.append(row);
    });
    const add = document.createElement('label'); add.className = 'btn btn-s file-add';
    add.innerHTML = `${icon('plus')}<span>Agregar PDF o foto</span><input type="file" multiple accept="image/*,application/pdf" hidden>`;
    $('input', add).onchange = async (e) => {
      const nuevos = [...e.target.files];
      for (const f of nuevos) refs.push(await saveFile(f, { sync }));
      draw();
      onAdded?.(nuevos);
    };
    box.append(add);
  };
  draw();
  box.getValue = () => refs;
  return box;
}

// --- Formularios generados desde el esquema ---
export function cityOptions() {
  return sortCities(store.list('ciudades')).map((c) => ({ v: c.id, l: c.nombre }));
}
const optsOf = (f) => (f.opts || []).map((o) => (typeof o === 'object' ? o : { v: o, l: o || '—' }));

export function formSheet(col, doc = {}, { defaults = {}, onSaved, titulo } = {}) {
  const sch = SCHEMA[col];
  const isNew = !doc.id;
  const val = { ...defaults, ...doc };
  const form = document.createElement('form');
  form.className = 'form'; form.noValidate = true;
  const inputs = {};
  const cond = [];
  let adv = null;
  for (const f of sch.fields) {
    if (f.hide) continue;
    const wrap = document.createElement(f.t === 'files' ? 'div' : 'label'); wrap.className = 'f';
    const v = val[f.k] ?? '';
    let el;
    if (f.t === 'long') { el = document.createElement('textarea'); el.rows = 3; el.value = v; }
    else if (f.t === 'bool') {
      wrap.className = 'f f-bool'; el = document.createElement('input'); el.type = 'checkbox'; el.checked = !!v;
    } else if (f.t === 'select' || f.t === 'city') {
      el = document.createElement('select');
      const os = f.t === 'city' ? [{ v: '', l: f.opt ? '— ninguna —' : 'Elegí una ciudad' }, ...cityOptions()] : optsOf(f);
      os.forEach((o) => { const op = document.createElement('option'); op.value = o.v; op.textContent = o.l; el.append(op); });
      el.value = String(v ?? (os[0]?.v ?? ''));
      if (f.t === 'select' && !os.some((o) => String(o.v) === String(v)) && !v) el.value = String(os[0]?.v ?? '');
    } else if (f.t === 'files') {
      el = filesField(val[f.k], true, col === 'entradas' ? (fs) => leerEnForm(fs) : null);
    } else {
      el = document.createElement('input');
      el.type = { date: 'date', time: 'time', datetime: 'datetime-local', number: 'text', phone: 'tel', url: 'url' }[f.t] || 'text';
      if (f.t === 'number') el.inputMode = 'decimal';
      if (f.ph) el.placeholder = f.ph;
      el.value = v;
      el.autocomplete = 'off';
    }
    if (f.t !== 'files') { el.name = f.k; el.id = `ff-${f.k}`; }
    inputs[f.k] = el;
    if (f.t === 'bool') wrap.append(el, Object.assign(document.createElement('span'), { textContent: f.l }));
    else { const s = document.createElement('span'); s.textContent = f.l + (f.req ? ' *' : ''); wrap.append(s, el); }
    if (col === 'entradas' && f.k === 'link') {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-s btn-sm'; b.textContent = 'Buscar dónde sacarla'; b.style.marginTop = '8px';
      b.onclick = () => {
        const lugar = inputs.lugar.value.trim();
        if (!lugar) { toast('Primero escribí el nombre del lugar'); return; }
        const ciudad = store.get('ciudades', inputs.ciudadId.value)?.nombre || '';
        const r = linkParaSacar(lugar, ciudad);
        if (r.directo) { inputs.link.value = r.url; toast(r.nota ? `Link oficial puesto. ${r.nota}` : 'Link oficial puesto'); }
        else { window.open(r.url, '_blank', 'noopener'); toast('Se abrió una búsqueda: copiá el link de la web oficial y pegalo acá'); }
      };
      wrap.append(b);
    }
    if (f.solo) cond.push({ wrap, solo: f.solo });
    if (f.adv) { if (!adv) { adv = document.createElement('details'); adv.className = 'adv'; adv.innerHTML = '<summary>Más datos</summary>'; form.append(adv); } adv.append(wrap); }
    else form.append(wrap);
  }
  if (cond.length && inputs.tipo) { const upd = () => cond.forEach((c) => { c.wrap.hidden = inputs.tipo.value !== c.solo; }); inputs.tipo.addEventListener('change', upd); upd(); }
  const err = document.createElement('p'); err.className = 'err'; err.hidden = true; err.setAttribute('role', 'alert');
  const btns = document.createElement('div'); btns.className = 'btns';
  btns.innerHTML = `<button type="button" class="btn btn-s" data-a="x">Cancelar</button><button type="submit" class="btn btn-p">Guardar</button>`;
  form.append(err, btns);
  if (!isNew) {
    const d = document.createElement('button'); d.type = 'button'; d.className = 'btn btn-d btn-block'; d.textContent = `Borrar ${sch.one || 'esto'}`; d.dataset.a = 'del';
    form.append(d);
  }
  async function leerEnForm(files) {
    let note = form.querySelector('.lec');
    if (!note) { note = document.createElement('p'); note.className = 'hint lec'; note.setAttribute('role', 'status'); form.querySelector('.files')?.after(note); }
    note.textContent = 'Leyendo el ticket… (la primera vez puede tardar un poco)';
    try {
      const { leerTicket } = await import('./lector.js');
      const r = await leerTicket(files[0]);
      const poner = (k, v) => { if (v && inputs[k] && !inputs[k].value) inputs[k].value = v; };
      poner('fecha', r.fecha); poner('hora', r.hora); poner('lugar', r.lugar); poner('ciudadId', r.ciudadId);
      if (inputs.estado && inputs.estado.value !== 'Comprada') inputs.estado.value = 'Comprada';
      const extra = [r.precio && `Precio del ticket: ${r.precio.monto} ${r.precio.moneda}`, r.codigos.length && `Códigos: ${r.codigos.join(', ')}`].filter(Boolean).join('\n');
      if (extra && inputs.nota && !inputs.nota.value.includes(extra)) inputs.nota.value = (inputs.nota.value ? inputs.nota.value + '\n' : '') + extra;
      note.textContent = r.fecha || r.hora
        ? `Leí el ticket (${r.via === 'pdf' ? 'PDF' : 'foto'}): ${[r.fecha && 'día ' + r.fecha, r.hora && 'hora ' + r.hora].filter(Boolean).join(', ')}. Revisá que esté bien antes de guardar.`
        : r.leyoAlgo ? 'Pude leer el ticket pero no encontré fecha ni hora: completalas a mano.' : 'No pude leer texto en este archivo: completá los datos a mano.';
    } catch (e) { note.textContent = e.message; }
  }
  const sh = openSheet(form, { titulo: titulo || (isNew ? `Nuevo: ${sch.one}` : `Editar ${sch.one}`) });
  form.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'x') sh.close();
    if (a === 'del' && await confirmar(`¿Borrar ${sch.one}? Se puede deshacer unos segundos.`)) {
      await store.remove(col, doc.id); sh.close();
      toast(`Se borró ${sch.one}`, { l: 'Deshacer', fn: () => store.restore(col, doc.id) });
    }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const out = { ...doc };
    for (const f of sch.fields) {
      if (f.hide) continue;
      const el = inputs[f.k];
      if (f.t === 'bool') out[f.k] = el.checked;
      else if (f.t === 'files') out[f.k] = el.getValue();
      else if (f.t === 'number') out[f.k] = el.value.trim() === '' ? '' : Number(el.value.replace(',', '.'));
      else if (f.t === 'select' && optsOf(f).some((o) => typeof o.v === 'number')) out[f.k] = Number(el.value);
      else out[f.k] = el.value.trim();
      if (f.req && (out[f.k] === '' || out[f.k] === undefined)) {
        err.hidden = false; err.textContent = `Falta completar: ${f.l}`; el.focus?.(); return;
      }
      if (f.t === 'number' && out[f.k] !== '' && !Number.isFinite(out[f.k])) { err.hidden = false; err.textContent = `${f.l}: poné solo un número`; return; }
    }
    if (col === 'ciudades' && out.salida < out.llegada) { err.hidden = false; err.textContent = 'La salida no puede ser antes de la llegada'; return; }
    const saved = await store.save(col, out);
    sh.close();
    onSaved?.(saved);
  });
  setTimeout(() => (isNew ? form.querySelector('input,select,textarea')?.focus({ preventScroll: true }) : 0), 320);
  return sh;
}

// Botones de ordenar (subir / bajar) para listas con campo "orden"
export async function mover(col, items, i, dir) {
  const j = i + dir;
  if (j < 0 || j >= items.length) return;
  const a = items[i], b = items[j];
  const oa = a.orden ?? i, ob = b.orden ?? j;
  await store.save(col, { ...a, orden: ob === oa ? ob + dir : ob });
  await store.save(col, { ...b, orden: oa });
}

// Borrar con confirmación y "Deshacer" (sirve para cualquier sección)
export async function borrarConDeshacer(col, d) {
  const nombre = d.lugar || d.titulo || d.nombre || d.texto || d.descripcion || (d.origen && `${d.origen} → ${d.destino}`) || SCHEMA[col].one;
  if (!(await confirmar(`¿Borrar "${nombre}"? Se puede deshacer unos segundos.`))) return false;
  await store.remove(col, d.id);
  toast('Borrado', { l: 'Deshacer', fn: () => store.restore(col, d.id) });
  return true;
}
