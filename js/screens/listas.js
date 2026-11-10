// Listas de Transportes, Alojamientos, Entradas, Valijas/Pendientes e Info útil.
import * as store from '../store.js';
import { sortCities, fmtFecha, dayOf, timeOf, localToday, diffDays } from '../logic.js';
import { h, raw, esc, icon, formSheet, mover, borrarConDeshacer, saveFile, toast } from '../ui.js';
import { linkParaSacar } from '../links.js';
import { cityName, detailSheet, hasFiles, openFiles, subOf, titleOf, today } from '../common.js';
import { pendientes } from './hoy.js';

const fab = (txt = 'Agregar') => raw(`<button class="btn btn-p btn-block" id="add">${icon('plus').s}${txt}</button>`);

function bindList(root, col, onAdd) {
  root.querySelector('#add')?.addEventListener('click', onAdd);
  root.addEventListener('click', (e) => {
    const li = e.target.closest('[data-id]'); if (!li) return;
    const d = store.get(col, li.dataset.id); if (!d) return;
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'files') openFiles(d, titleOf(col, d));
    else if (act === 'open') detailSheet(col, d);
    else if (act === 'del') borrarConDeshacer(col, d);
  });
}

const rowHtml = (col, d, extra = '') => raw(`<li class="n" data-id="${d.id}"><button class="n-b" data-act="open"><b>${esc(titleOf(col, d))}</b><small>${esc(subOf(col, d))}${extra}</small></button>${hasFiles(d) ? `<button class="mini" data-act="files" aria-label="Abrir ticket">${icon('ticket').s}</button>` : ''}</li>`);

// --- Transportes ---
export function renderTransportes(root) {
  const hoy = today() || localToday();
  const ts = store.list('transportes').sort((a, b) => (a.salida || '').localeCompare(b.salida || ''));
  const grupos = [];
  ts.forEach((t) => { const d = dayOf(t.salida); const g = grupos.at(-1); if (g && g.d === d) g.items.push(t); else grupos.push({ d, items: [t] }); });
  root.innerHTML = h`<header class="top"><p class="kicker">${ts.length} traslados · ${ts.filter((t) => t.estado === 'Falta sacar').length} sin sacar</p><h1 class="city-h">Viaje</h1></header>
    ${grupos.map((g) => raw(`<h3 class="sec day-sec ${g.d < hoy ? 'past' : ''}">${esc(g.d ? fmtFecha(g.d) : 'Sin fecha')}</h3><ul class="next">${g.items.map((t) => rowHtml('transportes', t, t.estado === 'Falta sacar' ? ' · ⚠ falta sacar' : t.reserva ? ` · Reserva ${esc(t.reserva)}` : '').s).join('')}</ul>`))}
    ${ts.length ? '' : raw('<p class="empty">Todavía no hay transportes.</p>')}${fab('Agregar transporte')}`.toString();
  bindList(root, 'transportes', () => formSheet('transportes', {}, { defaults: { estado: 'Reservado', tipo: 'Tren' } }));
}

// --- Alojamientos ---
export function renderAlojamientos(root) {
  const as = store.list('alojamientos').sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  root.innerHTML = h`<a class="back" href="#/mas">${icon('back').s}Más</a><header class="top"><p class="kicker">${as.length} lugares</p><h1 class="city-h">Alojamientos</h1></header>
    <ul class="next">${as.map((a) => rowHtml('alojamientos', a, ` · ${cityName(a.ciudadId)} · ${fmtFecha(dayOf(a.checkIn))} → ${fmtFecha(dayOf(a.checkOut))}`))}</ul>
    ${as.length ? '' : raw('<p class="empty">Todavía no hay alojamientos.</p>')}${fab('Agregar alojamiento')}`.toString();
  bindList(root, 'alojamientos', () => formSheet('alojamientos', {}, { defaults: {} }));
}

// --- Entradas y reservas ---
export function renderEntradas(root) {
  const hoy = today() || localToday();
  const pend = pendientes(hoy).filter((p) => p.col === 'entradas');
  const ok = store.list('entradas').filter((e) => e.estado === 'Comprada').sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
  root.innerHTML = h`<a class="back" href="#/mas">${icon('back').s}Más</a><header class="top"><p class="kicker">${pend.length} por sacar · ${ok.length} compradas</p><h1 class="city-h">Entradas</h1></header>
    <h3 class="sec">Por sacar <span class="hint-i">primero las que se agotan</span></h3>
    <ul class="next">${pend.map((p) => raw(`<li class="n stack ${p.prio === 1 ? 'warn' : ''}" data-id="${p.doc.id}"><button class="n-b" data-act="open"><b>${esc(p.doc.lugar)}</b><small>${esc([cityName(p.doc.ciudadId), p.doc.estado === 'Gratis, hay que reservar' ? 'gratis, reservar' : ''].filter(Boolean).join(' · '))}</small></button><div class="acts"><a class="btn btn-p btn-sm" data-act="sacar" target="_blank" rel="noopener" href="${esc(p.doc.link || linkParaSacar(p.doc.lugar, cityName(p.doc.ciudadId)).url)}">Sacar entrada</a><button class="btn btn-s btn-sm" data-act="buy">Ya la saqué</button><button class="mini" data-act="del" aria-label="Borrar">${icon('trash').s}</button></div></li>`))}${pend.length ? '' : raw('<li class="empty">No falta sacar nada.</li>')}</ul>
    <h3 class="sec">Compradas</h3>
    <ul class="next">${ok.map((e) => raw(`<li class="n" data-id="${e.id}"><button class="n-b" data-act="open"><b>${esc(e.lugar)}</b><small>${esc([fmtFecha(e.fecha), e.hora, cityName(e.ciudadId)].filter(Boolean).join(' · '))}</small></button>${hasFiles(e) ? `<button class="mini" data-act="files" aria-label="Abrir ticket">${icon('ticket').s}</button>` : ''}<button class="mini" data-act="del" aria-label="Borrar">${icon('trash').s}</button></li>`))}${ok.length ? '' : raw('<li class="empty">Todavía no hay entradas compradas.</li>')}</ul>
    <label class="btn btn-p btn-block">${icon('doc').s}Cargar ticket (PDF o foto)<input id="tk" type="file" accept="application/pdf,image/*" hidden></label>
    <p class="hint">Elegí el PDF o la captura del ticket: la app lee la fecha, la hora y el lugar y te los deja para revisar.</p>
    ${fab('Agregar entrada o reserva a mano')}`.toString();
  bindList(root, 'entradas', () => formSheet('entradas', {}, { defaults: { estado: 'Falta sacar', prioridad: 2 } }));
  root.querySelector('#tk').onchange = async (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    toast('Leyendo el ticket… (la primera vez puede tardar)');
    const ref = await saveFile(f);
    let r = null;
    try { r = await (await import('../lector.js')).leerTicket(f); } catch (err) { toast(err.message); }
    const m = r?.match;
    const extra = r ? [r.precio && `Precio del ticket: ${r.precio.monto} ${r.precio.moneda}`, r.codigos?.length && `Códigos: ${r.codigos.join(', ')}`].filter(Boolean).join('\n') : '';
    const nota = (m?.nota ? m.nota + '\n' : '') + extra;
    if (m) formSheet('entradas', { ...m, estado: 'Comprada', fecha: r.fecha || m.fecha, hora: r.hora || m.hora, archivos: [...(m.archivos || []), ref], nota: nota.trim() }, { titulo: 'Revisá lo que leí', onSaved: () => toast('Entrada cargada') });
    else formSheet('entradas', {}, { titulo: 'Revisá lo que leí', defaults: { lugar: r?.lugar || '', ciudadId: r?.ciudadId || '', fecha: r?.fecha || '', hora: r?.hora || '', estado: 'Comprada', prioridad: 2, archivos: [ref], nota: extra } });
    if (r && !r.fecha && !r.hora) toast('No encontré fecha ni hora: completalas a mano');
  };
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-act=buy]')) {
      const d = store.get('entradas', e.target.closest('[data-id]').dataset.id);
      if (d.link) window.open(d.link, '_blank', 'noopener');
      formSheet('entradas', { ...d, estado: 'Comprada' }, { titulo: 'Cargá la fecha y el ticket' });
    }
  });
}

// --- Valijas y pendientes ---
export function renderChecklist(root) {
  const all = store.list('checklist').sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  const grp = (g) => all.filter((c) => c.grupo === g);
  const block = (g) => { const it = grp(g); return raw(`<h3 class="sec">${g} <span class="count">${it.filter((c) => c.hecho).length}/${it.length}</span></h3><ul class="tasks">${it.map((c, i) => `<li class="task ${c.hecho ? 'is-done' : ''}" data-id="${c.id}"><button class="chk" role="checkbox" aria-checked="${!!c.hecho}" aria-label="Marcar" data-act="chk">${icon('check').s}</button><button class="task-t" data-act="edit"><b>${esc(c.texto)}</b>${c.nota ? `<small>${esc(c.nota)}</small>` : ''}</button><span class="ord"><button aria-label="Subir" data-m="-1" ${i === 0 ? 'disabled' : ''}>${icon('up').s}</button><button aria-label="Bajar" data-m="1" ${i === it.length - 1 ? 'disabled' : ''}>${icon('down').s}</button></span></li>`).join('')}${it.length ? '' : '<li class="empty sm">Vacío</li>'}</ul>`); };
  root.innerHTML = h`<a class="back" href="#/mas">${icon('back').s}Más</a><header class="top"><p class="kicker">Antes de salir</p><h1 class="city-h">Pendientes y valijas</h1></header>${block('Pendientes')}${block('Valijas')}${fab('Agregar')}`.toString();
  root.querySelector('#add').onclick = () => formSheet('checklist', {}, { defaults: { grupo: 'Pendientes', orden: all.length + 1 } });
  root.addEventListener('click', async (e) => {
    const li = e.target.closest('[data-id]'); if (!li) return;
    const d = store.get('checklist', li.dataset.id); if (!d) return;
    const a = e.target.closest('[data-act]')?.dataset.act, m = e.target.closest('[data-m]')?.dataset.m;
    if (a === 'chk') await store.save('checklist', { ...d, hecho: !d.hecho });
    else if (a === 'edit') formSheet('checklist', d);
    else if (m) { const it = grp(d.grupo); await mover('checklist', it, it.findIndex((x) => x.id === d.id), +m); }
  });
}

// --- Info útil ---
export function renderInfo(root) {
  const items = store.list('info').sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  const grupos = [...new Set(items.map((i) => i.grupo))];
  root.innerHTML = h`<a class="back" href="#/mas">${icon('back').s}Más</a><header class="top"><p class="kicker">Para tener a mano</p><h1 class="city-h">Info útil</h1></header>
    <p class="hint">Es orientativo: verificá los datos antes de viajar y editá lo que haga falta.</p>
    ${grupos.map((g) => raw(`<h3 class="sec">${esc(g)}</h3>${items.filter((i) => i.grupo === g).map((i) => `<details class="acc" data-id="${i.id}"><summary>${esc(i.titulo)}${i.ciudadId ? ` <small>${esc(cityName(i.ciudadId))}</small>` : ''}</summary><div class="acc-b">${esc(i.texto).replace(/\n/g, '<br>')}<div><button class="btn btn-s btn-sm" data-act="edit">Editar</button></div></div></details>`).join('')}`))}
    ${fab('Agregar dato')}`.toString();
  root.querySelector('#add').onclick = () => formSheet('info', {}, { defaults: { grupo: 'Otro', orden: items.length + 1 } });
  root.addEventListener('click', (e) => { if (e.target.closest('[data-act=edit]')) formSheet('info', store.get('info', e.target.closest('[data-id]').dataset.id)); });
}
