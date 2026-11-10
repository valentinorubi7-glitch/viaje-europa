// Itinerario: lista de ciudades y detalle de cada una, día por día.
import * as store from '../store.js';
import { sortCities, dateRange, fmtFecha, diffDays, localToday, mapsDir, addDays } from '../logic.js';
import { h, raw, esc, icon, formSheet, openSheet, toast } from '../ui.js';
import { eventsOn, eventRow, wireEvents, today, detailSheet, hasFiles } from '../common.js';
import { coverUrl } from './hoy.js';

export function renderList(root) {
  const cs = sortCities(store.list('ciudades'));
  const hoy = today() || localToday();
  root.innerHTML = h`<header class="top"><p class="kicker">${cs.length} ciudades</p><h1 class="city-h">Plan</h1></header>
    <ul class="cities">${cs.map((c, i) => raw(`<li class="city ${c.llegada <= hoy && hoy < c.salida ? 'now' : ''}" data-id="${c.id}">
      <a class="city-a" href="#/plan/${c.id}"><span class="city-n">${i + 1}</span><span class="city-t"><b>${esc(c.nombre)}</b><small>${esc(fmtFecha(c.llegada))} → ${esc(fmtFecha(c.salida))} · ${diffDays(c.llegada, c.salida)} noche${diffDays(c.llegada, c.salida) === 1 ? '' : 's'}</small></span>${icon('chev').s}</a>
      <span class="ord"><button aria-label="Subir" data-m="-1" ${i === 0 ? 'disabled' : ''}>${icon('up').s}</button><button aria-label="Bajar" data-m="1" ${i === cs.length - 1 ? 'disabled' : ''}>${icon('down').s}</button></span></li>`))}</ul>
    ${cs.length ? '' : raw('<p class="empty">Todavía no hay ciudades.</p>')}
    <button class="btn btn-p btn-block" id="add">${icon('plus').s}Agregar ciudad</button>
    <p class="hint">Si cambiás las fechas de una ciudad, los días, la cuenta regresiva y “Hoy” se ajustan solos.</p>`.toString();
  root.querySelector('#add').onclick = () => formSheet('ciudades', {}, { defaults: { orden: cs.length + 1, llegada: cs.at(-1)?.salida || '', moneda: 'EUR' } });
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-m]'); if (!b) return;
    const id = b.closest('[data-id]').dataset.id; const i = cs.findIndex((c) => c.id === id);
    // Reordenar = intercambiar los bloques de fechas, respetando cuántas noches dura cada ciudad
    const j = i + +b.dataset.m; if (j < 0 || j >= cs.length) return;
    const nuevo = [...cs]; [nuevo[i], nuevo[j]] = [nuevo[j], nuevo[i]];
    let cur = cs[0].llegada;
    for (const [k, c] of nuevo.entries()) { const n = diffDays(c.llegada, c.salida); await store.save('ciudades', { ...c, llegada: cur, salida: addDays(cur, n), orden: k + 1 }); cur = addDays(cur, n); }
    toast('Cambió el orden. Revisá los alojamientos y traslados de esas ciudades: sus fechas no se mueven solas.');
  });
}

export async function renderCity(root, id) {
  const c = store.get('ciudades', id);
  if (!c) { root.innerHTML = '<p class="empty">Esa ciudad ya no existe. <a href="#/plan">Volver</a></p>'; return; }
  const hoy = today() || localToday();
  const cs = sortCities(store.list('ciudades'));
  const bg = await coverUrl(c.id);
  const lodges = store.list('alojamientos').filter((a) => a.ciudadId === id);
  const days = dateRange(c.llegada, c.salida);
  const sinDia = store.list('actividades').filter((a) => a.ciudadId === id && !a.fecha).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  const ents = store.list('entradas').filter((e) => e.ciudadId === id && !e.fecha);
  const noches = diffDays(c.llegada, c.salida);

  root.innerHTML = h`<a class="back" href="#/plan">${icon('back').s}Plan</a>
    <header class="top top-city"><p class="kicker">Ciudad ${cs.findIndex((x) => x.id === id) + 1} de ${cs.length}</p><h1 class="city-h">${c.nombre}</h1><p class="sub">${fmtFecha(c.llegada)} → ${fmtFecha(c.salida)} · ${noches} noche${noches === 1 ? '' : 's'}${c.pais ? ' · ' + c.pais : ''}</p>
    <button class="btn btn-s btn-sm" id="edit">Editar ciudad</button></header>
    <div class="hero hero-s2 ${bg ? '' : 'hero-grad'}" ${bg ? raw(`style="background-image:url('${bg}')"`) : ''} role="img" aria-label="Portada de ${esc(c.nombre)}"></div>
    <h3 class="sec">Alojamiento</h3>
    ${lodges.length ? lodges.map((a) => raw(`<article class="card" data-col="alojamientos" data-id="${a.id}"><h4>${esc(a.nombre)}</h4><p class="addr">${esc(a.direccion)}</p>
      <dl class="kv"><div><dt>Check-in</dt><dd>${esc(fmtFecha(a.checkIn.slice(0, 10)))} · ${esc(a.checkIn.slice(11, 16))}</dd></div><div><dt>Check-out</dt><dd>${esc(fmtFecha(a.checkOut.slice(0, 10)))} · ${esc(a.checkOut.slice(11, 16))}</dd></div>${a.confirmacion ? `<div><dt>Confirmación</dt><dd>${esc(a.confirmacion)}</dd></div>` : ''}${a.codigoAcceso ? `<div><dt>Código de acceso</dt><dd>${esc(a.codigoAcceso)}</dd></div>` : ''}</dl>
      <div class="btns"><a class="btn btn-p" target="_blank" rel="noopener" href="${esc(mapsDir(a.direccion))}">${icon('pin').s}Cómo llegar</a><button class="btn btn-s" data-act="open">Detalle</button></div></article>`)) : raw('<p class="empty">Sin alojamiento cargado.</p>')}
    <button class="btn btn-s btn-block" id="add-aloj">${icon('plus').s}Agregar alojamiento</button>
    <h3 class="sec">Días</h3>
    <ol class="days">${days.map((d, i) => { const ev = eventsOn(d).filter((e) => !(e.col === 'alojamientos' && false)); return raw(`<li class="day ${d === hoy ? 'now' : ''}"><div class="day-h"><b>${esc(fmtFecha(d))}</b><span>${d === c.llegada ? 'Llegada' : d === c.salida ? 'Salida' : 'Día ' + (i + 1)}${d === hoy ? ' · hoy' : ''}</span></div><ul class="tasks cmp">${ev.length ? ev.map((e) => eventRow(e).s).join('') : '<li class="empty sm">Sin plan</li>'}</ul><button class="btn btn-s btn-sm" data-add="${d}">${icon('plus').s}Agregar al día</button></li>`); })}</ol>
    <h3 class="sec">Sin día asignado</h3>
    <ul class="tasks">${sinDia.map((a) => eventRow({ col: 'actividades', doc: a, hora: '' }))}${ents.map((e) => eventRow({ col: 'entradas', doc: e, hora: '' }))}${sinDia.length + ents.length ? '' : raw('<li class="empty sm">Nada pendiente de asignar.</li>')}</ul>
    <button class="btn btn-s btn-block" id="add-act">${icon('plus').s}Agregar actividad</button>
    ${c.barrio ? raw(`<p class="tip">${icon('pin').s}<span><b>Barrio recomendado:</b> ${esc(c.barrio)}</span></p>`) : ''}
    ${c.nota ? raw(`<p class="tip"><span>${esc(c.nota)}</span></p>`) : ''}`.toString();

  wireEvents(root);
  root.querySelector('#edit').onclick = () => formSheet('ciudades', c);
  root.querySelector('#add-aloj').onclick = () => formSheet('alojamientos', {}, { defaults: { ciudadId: id, checkIn: `${c.llegada}T15:00`, checkOut: `${c.salida}T10:00` } });
  root.querySelector('#add-act').onclick = () => formSheet('actividades', {}, { defaults: { ciudadId: id, orden: sinDia.length + 1 } });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-add]');
    if (b) addToDay(id, b.dataset.add);
    const a = e.target.closest('article[data-col]');
    if (a && e.target.closest('[data-act=open]')) detailSheet('alojamientos', store.get('alojamientos', a.dataset.id));
  });
}

function addToDay(ciudadId, fecha) {
  const el = document.createElement('div');
  el.innerHTML = `<div class="list"><button class="row" data-k="actividades">${icon('pin').s}<span><b>Actividad</b><small>Visita, comida, paseo…</small></span></button><button class="row" data-k="entradas">${icon('ticket').s}<span><b>Entrada o reserva</b><small>Museo, show, restaurante</small></span></button><button class="row" data-k="transportes">${icon('train').s}<span><b>Transporte</b><small>Tren, vuelo, traslado</small></span></button></div>`;
  const sh = openSheet(el, { titulo: `Agregar al ${fmtFecha(fecha)}` });
  el.addEventListener('click', (e) => {
    const k = e.target.closest('[data-k]')?.dataset.k; if (!k) return;
    sh.close();
    const dflt = { actividades: { ciudadId, fecha }, entradas: { ciudadId, fecha, estado: 'Falta sacar', prioridad: 2 }, transportes: { salida: `${fecha}T09:00`, estado: 'Reservado', tipo: 'Tren' } }[k];
    setTimeout(() => formSheet(k, {}, { defaults: dflt }), 150);
  });
}
