// Cosas que comparten varias pantallas: agenda del día, títulos, detalle de un ítem.
import * as store from './store.js';
import { SCHEMA } from './schema.js';
import { dayOf, timeOf, fmtFecha, mapsDir, mapsUrl, sortCities, checkinInfo, enTexto } from './logic.js';
import { h, raw, esc, icon, openSheet, viewFile, formSheet, $, toast } from './ui.js';

export const cityName = (id) => store.get('ciudades', id)?.nombre || '';
export const today = () => new URLSearchParams(location.search).get('hoy') || undefined;

export function titleOf(col, d) {
  switch (col) {
    case 'transportes': return `${d.origen} → ${d.destino}`;
    case 'alojamientos': return d.nombre;
    case 'entradas': return d.lugar;
    case 'actividades': return d.titulo;
    case 'ciudades': return d.nombre;
    case 'checklist': return d.texto;
    case 'info': return d.titulo;
    case 'gastos': return d.descripcion;
    default: return d.titulo || d.nombre || '';
  }
}
export const ICON = { transportes: 'train', alojamientos: 'bed', entradas: 'ticket', actividades: 'pin' };

export function subOf(col, d) {
  if (col === 'transportes') {
    const hh = timeOf(d.salida) && timeOf(d.llegada) ? `${timeOf(d.salida)} → ${timeOf(d.llegada)}` : timeOf(d.salida);
    return [d.tipo, d.numero, hh, d.asientos && `Asientos ${d.asientos}`].filter(Boolean).join(' · ');
  }
  if (col === 'alojamientos') return [d.direccion, d.confirmacion && `Conf. ${d.confirmacion}`].filter(Boolean).join(' · ');
  if (col === 'entradas') return [d.estado, d.hora].filter(Boolean).join(' · ');
  if (col === 'actividades') return [d.categoria, d.nota].filter(Boolean).join(' · ');
  return '';
}

export function mapTarget(col, d) {
  if (col === 'alojamientos') return d.direccion;
  if (col === 'transportes') return d.origen;
  if (col === 'entradas') return `${d.lugar} ${cityName(d.ciudadId)}`;
  if (col === 'actividades') return d.link || `${d.titulo} ${cityName(d.ciudadId)}`;
  return '';
}

// Todo lo que pasa un día: traslados, check-in/out, entradas y actividades, ordenado por hora
export function eventsOn(date) {
  const ev = [];
  const add = (col, doc, hora, extra = {}) => ev.push({ col, doc, hora: hora || '', ...extra });
  for (const t of store.list('transportes')) {
    if (dayOf(t.salida) === date) add('transportes', t, timeOf(t.salida));
    else if (dayOf(t.llegada) === date) add('transportes', t, timeOf(t.llegada), { llega: true });
  }
  for (const a of store.list('alojamientos')) {
    if (dayOf(a.checkIn) === date) add('alojamientos', a, timeOf(a.checkIn), { tag: 'Check-in' });
    if (dayOf(a.checkOut) === date) add('alojamientos', a, timeOf(a.checkOut), { tag: 'Check-out' });
  }
  for (const e of store.list('entradas')) if (e.fecha === date) add('entradas', e, e.hora);
  for (const a of store.list('actividades')) if (a.fecha === date) add('actividades', a, a.hora);
  return ev.sort((a, b) => (a.hora || '99:99').localeCompare(b.hora || '99:99'));
}

export function evTitle(e) {
  const d = e.doc;
  if (e.col === 'transportes') return `${e.llega ? 'Llegada: ' : ''}${d.tipo === 'Vuelo' ? '✈' : ''} ${d.origen} → ${d.destino}`.trim();
  if (e.col === 'alojamientos') return `${e.tag} · ${d.nombre}`;
  return titleOf(e.col, d);
}

export const hasFiles = (d) => (d.archivos || []).length > 0;
export function openFiles(d, titulo = 'Archivos') {
  const fs = d.archivos || [];
  if (fs.length === 1) return viewFile(fs[0]);
  const sh = openSheet(h`<div class="list">${fs.map((f, i) => raw(`<button class="row" data-i="${i}">${icon('doc').s}<span>${esc(f.name)}</span></button>`))}</div>`, { titulo });
  sh.el.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) viewFile(fs[+b.dataset.i]); });
}

// Pantalla de detalle de cualquier ítem (con ticket, mapa, llamar y editar)
export function detailSheet(col, d) {
  const sch = SCHEMA[col];
  const rows = sch.fields.filter((f) => !f.hide && f.t !== 'files' && d[f.k] !== '' && d[f.k] !== undefined && d[f.k] !== false && f.l)
    .map((f) => {
      let v = d[f.k];
      if (f.t === 'city') v = cityName(v);
      else if (f.t === 'bool') v = 'Sí';
      else if (f.t === 'date') v = fmtFecha(v);
      else if (f.t === 'datetime') v = `${fmtFecha(dayOf(v))} ${timeOf(v)}`;
      else if (f.t === 'select') { const o = (f.opts || []).find((x) => typeof x === 'object' && String(x.v) === String(v)); if (o) v = o.l; }
      if (v === '') return '';
      return `<div><dt>${esc(f.l)}</dt><dd>${f.t === 'phone' ? `<a href="tel:${esc(v)}">${esc(v)}</a>` : f.t === 'url' ? `<a href="${esc(v)}" target="_blank" rel="noopener">Abrir link</a>` : esc(v)}</dd></div>`;
    }).join('');
  const target = mapTarget(col, d);
  const ci = col === 'transportes' ? checkinInfo(d) : null;
  const ciTxt = ci ? (d.checkinHecho ? '✅ Check-in hecho' : ci.estado === 'abierto' ? '🟢 El check-in está ABIERTO' : ci.estado === 'pronto' ? `⏳ El check-in abre en ${enTexto(ci.falta)}` : 'El vuelo ya salió') : '';
  const el = document.createElement('div');
  el.innerHTML = `${ci ? `<p class="ci-txt">${esc(ciTxt)}</p>` : ''}<dl class="kv big">${rows}</dl>
    <div class="btns wrap">
      ${ci && d.checkinUrl ? `<a class="btn btn-p" target="_blank" rel="noopener" href="${esc(d.checkinUrl)}">Hacer check-in online</a>` : ''}
      ${ci && (d.checkinDatos || d.reserva) ? '<button class="btn btn-s" data-a="copy">Copiar datos del check-in</button>' : ''}
      ${hasFiles(d) ? `<button class="btn btn-p" data-a="files">${icon('ticket').s}Abrir ticket / archivos</button>` : ''}
      ${target ? `<a class="btn btn-s" target="_blank" rel="noopener" href="${esc(col === 'alojamientos' ? mapsDir(target) : mapsUrl(target))}">${icon('pin').s}Cómo llegar</a>` : ''}
      ${d.telefono ? `<a class="btn btn-s" href="tel:${esc(d.telefono)}">${icon('phone').s}Llamar</a>` : ''}
      <button class="btn btn-s" data-a="edit">Editar</button>
    </div>`;
  const sh = openSheet(el, { titulo: titleOf(col, d) });
  el.addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'files') openFiles(d, titleOf(col, d));
    if (a === 'copy') navigator.clipboard?.writeText(d.checkinDatos || d.reserva || '').then(() => toast('Datos copiados'), () => toast('No se pudo copiar'));
    if (a === 'edit') { sh.close(); setTimeout(() => formSheet(col, d), 120); }
  });
  return sh;
}

// Fila de agenda (un evento del día)
export function eventRow(e, { check = true } = {}) {
  const d = e.doc;
  const canCheck = check && (e.col === 'actividades' || e.col === 'entradas');
  const done = canCheck && d.hecha;
  return h`<li class="task ${done ? 'is-done' : ''}" data-col="${e.col}" data-id="${d.id}">
    ${canCheck ? raw(`<button class="chk" role="checkbox" aria-checked="${!!d.hecha}" aria-label="Marcar como hecho" data-act="chk">${icon('check').s}</button>`) : raw(`<span class="ev-ic" aria-hidden="true">${icon(ICON[e.col] || 'pin').s}</span>`)}
    <button class="task-t" data-act="open"><b>${evTitle(e)}</b><small>${[subOf(e.col, d), e.col === 'transportes' && hasFiles(d) ? '🎫 ticket' : ''].filter(Boolean).join(' · ')}</small></button>
    ${e.hora ? raw(`<time class="task-h">${esc(e.hora)}</time>`) : ''}
  </li>`;
}

// Un solo manejador de toques para listas de eventos
export function wireEvents(root) {
  root.addEventListener('click', async (e) => {
    const li = e.target.closest('[data-col]');
    if (!li) return;
    const col = li.dataset.col, d = store.get(col, li.dataset.id);
    if (!d) return;
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'chk') await store.save(col, { ...d, hecha: !d.hecha });
    else if (act === 'open') detailSheet(col, d);
  });
}

export const nextCity = (hoy) => sortCities(store.list('ciudades')).find((c) => c.llegada > hoy);
export const lodgingFor = (ciudadId, hoy) => {
  const ls = store.list('alojamientos').filter((a) => a.ciudadId === ciudadId).sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  return ls.find((a) => dayOf(a.checkIn) <= hoy && hoy <= dayOf(a.checkOut)) || ls[0];
};
export { $ };

// Tarjetas "Check-in de vuelos": las usa Hoy antes y durante el viaje
export function checkinHtml(ahora = Date.now()) {
  const vs = store.list('transportes').map((t) => ({ t, ci: checkinInfo(t, ahora) })).filter((x) => x.ci && x.ci.estado !== 'pasado' && !x.t.checkinHecho).sort((a, b) => a.ci.salida - b.ci.salida);
  if (!vs.length) return '';
  const p2 = (n) => String(n).padStart(2, '0');
  const fh = (ms) => { const d = new Date(ms); return `${fmtFecha(`${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`)} ${p2(d.getHours())}:${p2(d.getMinutes())}`; };
  const card = ({ t, ci }) => `<li class="n ci ${ci.estado === 'abierto' ? 'warn' : ''}" data-col="transportes" data-id="${esc(t.id)}"><div class="ci-b"><b>${esc(t.origen)} → ${esc(t.destino)}</b><small>${esc(t.numero || '')} · sale ${esc(fh(ci.salida))}</small><small class="${ci.estado === 'abierto' ? 'ci-on' : ''}">${ci.estado === 'abierto' ? '🟢 Abierto ahora: hacelo ya' : `Abre ${esc(fh(ci.abre))} · en ${esc(enTexto(ci.falta))}`}</small>${t.checkinUrl ? `<div class="btns"><a class="btn btn-p btn-sm" target="_blank" rel="noopener" href="${esc(t.checkinUrl)}">Ir al check-in</a><button class="btn btn-s btn-sm" data-act="ci-copy">Copiar datos</button><button class="btn btn-s btn-sm" data-act="ci-done">Ya lo hice</button></div>` : '<div class="btns"><button class="btn btn-s btn-sm" data-act="open">Cargar el link</button></div>'}</div></li>`;
  return `<h3 class="sec">Check-in de vuelos</h3><ul class="next">${vs.slice(0, 4).map(card).join('')}</ul>`;
}
