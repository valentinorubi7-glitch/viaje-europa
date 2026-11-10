// Pantalla "Hoy": qué toca ahora, cuenta regresiva y pendientes.
import * as store from '../store.js';
import { tripRange, tripState, cityOn, localToday, localHM, fmtFecha, fmtFechaLarga, diffDays, dayOf, timeOf, addDays, sortCities, mapsDir, mapsUrl } from '../logic.js';
import { h, raw, esc, icon, $, openSheet, fileUrl, formSheet } from '../ui.js';
import { eventsOn, eventRow, wireEvents, cityName, today, lodgingFor, detailSheet, openFiles, hasFiles, titleOf, evTitle, subOf, mapTarget } from '../common.js';
import { weatherFor } from '../weather.js';

export async function coverUrl(cityId) {
  const fotos = store.list('fotos').filter((f) => (f.archivos || []).length);
  const f = (cityId && fotos.find((x) => x.ciudadId === cityId && x.portada)) || fotos.find((x) => x.id === store.config().fondoFoto);
  return f ? fileUrl(f.archivos[0].id) : null;
}

const urgencia = (e, hoy) => {
  const c = store.get('ciudades', e.ciudadId);
  const ref = e.fecha || c?.llegada;
  return ref ? diffDays(hoy, ref) : 999;
};

export function pendientes(hoy) {
  const ent = store.list('entradas').filter((e) => e.estado !== 'Comprada' && !e.hecha)
    .map((e) => ({ col: 'entradas', doc: e, prio: Number(e.prioridad) || 2, dias: urgencia(e, hoy) }));
  const tr = store.list('transportes').filter((t) => t.estado === 'Falta sacar')
    .map((t) => ({ col: 'transportes', doc: t, prio: 1, dias: diffDays(hoy, dayOf(t.salida) || hoy) }));
  return [...tr, ...ent].sort((a, b) => a.prio - b.prio || a.dias - b.dias);
}

function pendRow(p, hoy) {
  const d = p.doc;
  const urgent = p.prio === 1;
  const c = cityName(d.ciudadId) || (p.col === 'transportes' ? 'Transporte' : '');
  return h`<li class="n ${urgent ? 'warn' : ''}" data-col="${p.col}" data-id="${d.id}"><button class="n-b" data-act="open"><b>${p.col === 'transportes' ? `Sacar ${d.tipo.toLowerCase()} ${d.origen} → ${d.destino}` : d.lugar}</b><small>${[c, d.fecha && fmtFecha(d.fecha), d.estado === 'Gratis, hay que reservar' ? 'gratis, reservar' : '', p.dias < 999 && p.dias >= 0 ? `faltan ${p.dias} días` : ''].filter(Boolean).join(' · ')}</small></button>${urgent ? raw('<span class="pill pill-w">Sacar ya</span>') : ''}</li>`;
}

export async function render(root) {
  const real = localToday();
  const hoy = today() || real;
  const ciudades = store.list('ciudades'), transportes = store.list('transportes');
  const rango = tripRange({ ciudades, transportes });
  const est = tripState(rango, hoy);
  const pend = pendientes(hoy);
  const yo = await store.meta.get('yo', '');
  let html = '';

  if (est.fase === 'antes') {
    const bgFondo = await coverUrl(null);
    const prox = transportes.filter((t) => t.salida).sort((a, b) => a.salida.localeCompare(b.salida))[0];
    const val = store.list('checklist').filter((c) => c.grupo === 'Valijas');
    html = h`<header class="top"><p class="kicker">${fmtFechaLarga(hoy)}</p><h1 class="city-h">Falta${est.dias === 1 ? '' : 'n'} ${est.dias} día${est.dias === 1 ? '' : 's'}</h1><p class="sub">Salen el ${fmtFecha(rango.inicio)} · ${ciudades.length} ciudades · hasta el ${fmtFecha(rango.fin)}</p></header>
      ${prox ? raw(`<div class="hero ${bgFondo ? 'hero-foto' : 'hero-grad'}" ${bgFondo ? `style="background-image:url('${bgFondo}')"` : ''} data-col="transportes" data-id="${prox.id}"><div class="hero-in"><p class="kicker">Primer traslado</p><h2>${esc(prox.origen)} → ${esc(prox.destino)}</h2><p class="hero-s">${esc(fmtFecha(dayOf(prox.salida)))} · ${esc(timeOf(prox.salida))} · ${esc(prox.numero || prox.tipo)}</p><div class="btns"><button class="btn btn-p" data-act="open">Ver detalle</button>${hasFiles(prox) ? '<button class="btn btn-s" data-act="files">Abrir ticket</button>' : ''}</div></div></div>`) : ''}
      <h3 class="sec">Pendientes ${raw(`<span class="count">${pend.length}</span>`)}</h3>
      <ul class="next">${pend.length ? pend.slice(0, 8).map((p) => pendRow(p, hoy)) : raw('<li class="empty">Todo sacado. ¡Qué orden!</li>')}</ul>
      ${pend.length > 8 ? raw('<a class="more" href="#/mas/entradas">Ver todas las entradas</a>') : ''}
      <h3 class="sec">Para ir armando</h3>
      <div class="quick"><a class="q" href="#/mas/checklist">${icon('list').s}<span>Valijas ${val.filter((v) => v.hecho).length}/${val.length}</span></a><a class="q" href="#/plan">${icon('cal').s}<span>Itinerario</span></a><a class="q" href="#/mas/docs">${icon('lock').s}<span>Documentos</span></a></div>`;
  } else if (est.fase === 'despues') {
    html = h`<header class="top"><p class="kicker">${fmtFechaLarga(hoy)}</p><h1 class="city-h">¡Volvieron!</h1><p class="sub">El viaje terminó el ${fmtFecha(rango.fin)}.</p></header>
      <div class="quick"><a class="q" href="#/mas/resumen">${icon('star').s}<span>Resumen del viaje</span></a><a class="q" href="#/mas/fotos">${icon('camera').s}<span>Fotos</span></a><a class="q" href="#/gastos">${icon('coin').s}<span>Gastos</span></a></div>`;
  } else if (est.fase === 'durante') {
    const city = cityOn(ciudades, hoy);
    const ev = eventsOn(hoy);
    const ahora = hoy === real ? localHM() : '00:00';
    const sig = ev.find((e) => (e.col === 'actividades' || e.col === 'entradas') ? !e.doc.hecha && (!e.hora || e.hora >= ahora) : e.hora >= ahora) || ev.find((e) => !e.doc.hecha);
    const lodge = city && lodgingFor(city.id, hoy);
    const bg = await coverUrl(city?.id);
    const sinDia = city ? store.list('actividades').filter((a) => a.ciudadId === city.id && !a.fecha && !a.hecha) : [];
    const prox = [];
    for (let i = 1; i <= 3; i++) { const d = addDays(hoy, i); eventsOn(d).filter((e) => e.col === 'transportes' || e.col === 'entradas').forEach((e) => prox.push({ ...e, d })); }
    const heroT = sig ? evTitle(sig) : 'Nada más por hoy';
    html = h`<header class="top"><p class="kicker">${fmtFecha(hoy)} · Día ${est.dia} de ${est.total}</p><h1 class="city-h">${city?.nombre || 'En viaje'}</h1><p class="sub" id="wx">&nbsp;</p></header>
      <div class="hero ${bg ? '' : 'hero-grad'}" ${bg ? raw(`style="background-image:linear-gradient(to top,rgba(20,40,32,.85),rgba(20,40,32,.1)),url('${bg}')"`) : ''} data-col="${sig?.col || ''}" data-id="${sig?.doc.id || ''}"><div class="hero-in"><p class="kicker">${sig ? `${sig.hora ? 'Ahora · ' + sig.hora : 'Para hoy'}` : 'Hoy'}</p><h2>${heroT}</h2>${sig ? raw(`<p class="hero-s">${esc(subOf(sig.col, sig.doc))}</p>`) : ''}<div class="btns">${raw(sig && hasFiles(sig.doc) ? '<button class="btn btn-p" data-act="files">' + icon('ticket').s + 'Abrir ticket</button>' : sig ? '<button class="btn btn-p" data-act="open">Ver detalle</button>' : '')}${raw(sig && mapTarget(sig.col, sig.doc) ? `<a class="btn btn-s" target="_blank" rel="noopener" href="${esc(mapsUrl(mapTarget(sig.col, sig.doc)))}">${icon('pin').s}Cómo llegar</a>` : '')}</div></div></div>
      <div class="quick" role="group" aria-label="Accesos rápidos">
        <button class="q" id="q-hotel" ${lodge ? '' : 'disabled'}>${icon('bed').s}<span>Hotel</span></button>
        <button class="q" id="q-tix">${icon('ticket').s}<span>Tickets</span></button>
        <button class="q q-sos" id="q-sos">${icon('sos').s}<span>Emergencia</span></button>
      </div>
      ${pend.filter((p) => p.prio === 1).length ? raw(`<a class="alert" href="#/mas/entradas">${icon('sos').s}<span><b>${pend.filter((p) => p.prio === 1).length} ${pend.filter((p) => p.prio === 1).length === 1 ? 'cosa' : 'cosas'} para sacar ya</b> (se agotan rápido). Tocá para verlas.</span></a>`) : ''}
      <h3 class="sec">Plan de hoy</h3>
      <ul class="tasks" id="plan-hoy">${ev.length ? ev.map((e) => eventRow(e)) : raw('<li class="empty">No hay nada cargado para hoy.</li>')}</ul>
      ${sinDia.length ? raw(`<h3 class="sec">Ideas de ${esc(city.nombre)} sin día</h3><ul class="tasks">${sinDia.slice(0, 5).map((a) => `<li class="task" data-col="actividades" data-id="${a.id}"><button class="task-t" data-act="open"><b>${esc(a.titulo)}</b><small>${esc(a.categoria || 'Sin día asignado')}</small></button><button class="btn btn-s btn-sm" data-act="hoy">Hoy</button></li>`).join('')}</ul>`) : ''}
      ${prox.length ? raw(`<h3 class="sec">Lo que viene</h3><ul class="next">${prox.map((e) => `<li class="n" data-col="${e.col}" data-id="${e.doc.id}"><button class="n-b" data-act="open"><b>${esc(evTitle(e))}</b><small>${esc(fmtFecha(e.d))} ${esc(e.hora)} · ${esc(subOf(e.col, e.doc))}</small></button><span class="pill">${diffDays(hoy, e.d) === 1 ? 'Mañana' : 'En ' + diffDays(hoy, e.d) + ' días'}</span></li>`).join('')}</ul>`) : ''}`;
  } else html = h`<div class="soon"><b>Sin datos todavía</b></div>`;

  root.innerHTML = html.toString();
  wireEvents(root);
  root.addEventListener('click', async (e) => {
    const box = e.target.closest('[data-col]');
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!box?.dataset.id) return;
    const d = store.get(box.dataset.col, box.dataset.id);
    if (!d) return;
    if (act === 'files') openFiles(d, titleOf(box.dataset.col, d));
    else if (act === 'hoy') await store.save('actividades', { ...d, fecha: hoy });
  });

  if (est.fase === 'durante') {
    const city = cityOn(ciudades, hoy);
    $('#q-hotel', root)?.addEventListener('click', () => { const l = city && lodgingFor(city.id, hoy); if (l) detailSheet('alojamientos', l); });
    $('#q-tix', root)?.addEventListener('click', () => ticketsSheet(hoy));
    $('#q-sos', root)?.addEventListener('click', sosSheet);
    weatherFor(city, hoy).then((w) => { const el = $('#wx', root); if (el) el.textContent = w ? `${w.ic} ${w.max}° / ${w.min}° · ${w.txt}${w.viejo ? ' (guardado)' : ''}` : ''; });
  }
}

function ticketsSheet(hoy) {
  const items = [
    ...store.list('transportes').filter((t) => hasFiles(t) && dayOf(t.salida) >= hoy).map((d) => ({ col: 'transportes', d, f: d.salida })),
    ...store.list('entradas').filter((e) => hasFiles(e) && (e.fecha || '9') >= hoy).map((d) => ({ col: 'entradas', d, f: d.fecha || '9' })),
  ].sort((a, b) => a.f.localeCompare(b.f)).slice(0, 8);
  const el = document.createElement('div');
  el.innerHTML = items.length ? `<div class="list">${items.map((x, i) => `<button class="row" data-i="${i}">${icon('ticket').s}<span><b>${esc(titleOf(x.col, x.d))}</b><small>${esc(fmtFecha(dayOf(x.f)))} ${esc(timeOf(x.f))}</small></span></button>`).join('')}</div>` : '<p class="empty">No hay tickets cargados para los próximos días.</p>';
  openSheet(el, { titulo: 'Tickets próximos' });
  el.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) openFiles(items[+b.dataset.i].d, titleOf(items[+b.dataset.i].col, items[+b.dataset.i].d)); });
}

function sosSheet() {
  const em = store.list('info').filter((i) => i.grupo === 'Emergencias');
  const el = document.createElement('div');
  el.innerHTML = `<p class="sos-big"><a href="tel:112">${icon('phone').s}Llamar al 112</a></p><p class="sub">Número único de emergencias en la Unión Europea. En Reino Unido: 999 o 112.</p>${em.map((i) => `<div class="card"><h4>${esc(i.titulo)}</h4><p>${esc(i.texto)}</p></div>`).join('')}`;
  openSheet(el, { titulo: 'Emergencia' });
}
