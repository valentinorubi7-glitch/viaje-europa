// Menú "Más", fotos, mapa, resumen final y ajustes (respaldo, Sheet, monedas).
import * as store from '../store.js';
import * as sync from '../sync.js';
import { COLS, SCHEMA } from '../schema.js';
import { fmtUsd, fmtFecha, sumUsd, totalesPor, tripRange, tripState, localToday, toCSV, parseCSV, uid, mapsUrl, diffDays, sortCities } from '../logic.js';
import { h, raw, esc, icon, openSheet, confirmar, toast, $, $$, saveFile, fileUrl, viewFile, formSheet, cityOptions } from '../ui.js';
import { cityName, today } from '../common.js';
import { tasas } from './gastos.js';

const rerender = () => window.dispatchEvent(new Event('app-rerender'));

const aplicarTema = (t) => {
  try { t === 'auto' ? localStorage.removeItem('tema') : localStorage.setItem('tema', t); } catch { /* sin almacenamiento: no pasa nada */ }
  if (t === 'auto') delete document.documentElement.dataset.tema; else document.documentElement.dataset.tema = t;
  const oscuro = t === 'oscuro' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name=theme-color]').forEach((m) => m.setAttribute('content', oscuro ? '#121C18' : '#F6EFE2'));
};
export function renderMenu(root) {
  const it = [['bed', 'Alojamientos', '#/mas/alojamientos'], ['ticket', 'Entradas y reservas', '#/mas/entradas'], ['lock', 'Documentos', '#/mas/docs'], ['camera', 'Fotos y recuerdos', '#/mas/fotos'], ['list', 'Valijas y pendientes', '#/mas/checklist'], ['info', 'Info útil', '#/mas/info'], ['pin', 'Mapa de lugares', '#/mas/mapa'], ['star', 'Resumen del viaje', '#/mas/resumen'], ['gear', 'Ajustes y respaldo', '#/mas/ajustes']];
  root.innerHTML = h`<header class="top"><p class="kicker">Todo lo demás</p><h1 class="city-h">Más</h1></header><p class="kicker" style="margin-top:16px">Apariencia</p><div class="tema" role="group" aria-label="Tema">${['auto', 'claro', 'oscuro'].map((t) => raw(`<button type="button" data-tema="${t}" aria-pressed="${(localStorage.getItem('tema') || 'auto') === t}">${{ auto: 'Automático', claro: '☀️ Claro', oscuro: '🌙 Oscuro' }[t]}</button>`))}</div><div class="menu">${it.map(([i, l, hr]) => raw(`<a class="m-i" href="${hr}">${icon(i).s}<span>${esc(l)}</span>${icon('chev').s}</a>`))}</div>`.toString();
  root.querySelectorAll('[data-tema]').forEach((b) => b.addEventListener('click', () => { aplicarTema(b.dataset.tema); root.querySelectorAll('[data-tema]').forEach((x) => x.setAttribute('aria-pressed', x === b)); }));
}

// --- Fotos ---
export async function renderFotos(root) {
  const fotos = store.list('fotos').filter((f) => (f.archivos || []).length).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  const cfg = store.config();
  root.innerHTML = h`<a class="back" href="#/mas">${icon('back').s}Más</a><header class="top"><p class="kicker">${fotos.length} foto${fotos.length === 1 ? '' : 's'}</p><h1 class="city-h">Fotos</h1></header>
    <label class="btn btn-p btn-block">${icon('plus').s}Agregar fotos<input id="up" type="file" accept="image/*" multiple hidden></label>
    <div class="grid" id="grid">${fotos.map((f) => raw(`<button class="ph" data-id="${f.id}" aria-label="Foto ${esc(f.nota || '')}"><img alt="" data-f="${f.archivos[0].id}">${f.portada ? '<i>Portada</i>' : ''}${cfg.fondoFoto === f.id ? '<i class="b">Fondo</i>' : ''}</button>`))}</div>
    ${fotos.length ? '' : raw('<p class="empty">Todavía no hay fotos. Las que agregues pueden ser la portada de cada ciudad o el fondo del inicio.</p>')}`.toString();
  for (const img of $$('img[data-f]', root)) fileUrl(img.dataset.f).then((u) => u && (img.src = u));
  $('#up', root).onchange = async (e) => {
    const hoy = today() || localToday();
    const ciudad = sortCities(store.list('ciudades')).find((c) => c.llegada <= hoy && hoy <= c.salida);
    for (const f of e.target.files) { const ref = await saveFile(f); await store.save('fotos', { archivos: [ref], ciudadId: ciudad?.id || '', fecha: hoy, nota: '', portada: false }); }
    toast('Fotos agregadas');
  };
  root.onclick = (e) => {
    const b = e.target.closest('.ph'); if (!b) return;
    const f = store.get('fotos', b.dataset.id);
    const el = document.createElement('div');
    el.innerHTML = `<button class="btn btn-p btn-block" data-a="ver">Ver grande</button><button class="btn btn-s btn-block" data-a="portada">${f.portada ? 'Quitar de portada' : `Usar de portada${f.ciudadId ? ' de ' + esc(cityName(f.ciudadId)) : ''}`}</button><button class="btn btn-s btn-block" data-a="fondo">${cfg.fondoFoto === f.id ? 'Quitar de fondo del inicio' : 'Usar de fondo del inicio'}</button><button class="btn btn-s btn-block" data-a="edit">Cambiar ciudad / descripción</button><button class="btn btn-d btn-block" data-a="del">Borrar</button>`;
    const sh = openSheet(el, { titulo: f.nota || 'Foto' });
    el.onclick = async (ev) => {
      const a = ev.target.closest('[data-a]')?.dataset.a; if (!a) return;
      if (a === 'ver') viewFile(f.archivos[0]);
      if (a === 'portada') { if (!f.portada && f.ciudadId) for (const o of store.list('fotos').filter((x) => x.ciudadId === f.ciudadId && x.portada)) await store.save('fotos', { ...o, portada: false }); await store.save('fotos', { ...f, portada: !f.portada }); sh.close(); }
      if (a === 'fondo') { await store.saveConfig({ fondoFoto: cfg.fondoFoto === f.id ? '' : f.id }); sh.close(); }
      if (a === 'edit') { sh.close(); setTimeout(() => formSheet('fotos', f), 150); }
      if (a === 'del' && await confirmar('¿Borrar esta foto?')) { await store.remove('fotos', f.id); sh.close(); }
    };
  };
}

// --- Mapa: lista de lugares con link a Google Maps (anda con los links aunque no haya mapa dentro de la app) ---
export function renderMapa(root) {
  const cs = sortCities(store.list('ciudades'));
  root.innerHTML = h`<a class="back" href="#/mas">${icon('back').s}Más</a><header class="top"><p class="kicker">Se abren en Google Maps</p><h1 class="city-h">Mapa</h1></header>
    ${cs.map((c) => raw(`<h3 class="sec">${esc(c.nombre)}</h3><div class="list"><a class="row" target="_blank" rel="noopener" href="${esc(mapsUrl(c.nombre + ' ' + (c.pais || '')))}">${icon('pin').s}<span><b>${esc(c.nombre)}</b><small>Ver ciudad</small></span></a>${store.list('alojamientos').filter((a) => a.ciudadId === c.id).map((a) => `<a class="row" target="_blank" rel="noopener" href="${esc(mapsUrl(a.direccion))}">${icon('bed').s}<span><b>${esc(a.nombre)}</b><small>${esc(a.direccion)}</small></span></a>`).join('')}${store.list('entradas').filter((e) => e.ciudadId === c.id).map((e) => `<a class="row" target="_blank" rel="noopener" href="${esc(mapsUrl(e.lugar + ' ' + c.nombre))}">${icon('ticket').s}<span><b>${esc(e.lugar)}</b><small>${esc(e.estado)}</small></span></a>`).join('')}${store.list('actividades').filter((a) => a.ciudadId === c.id).map((a) => `<a class="row" target="_blank" rel="noopener" href="${esc(a.link || mapsUrl(a.titulo + ' ' + c.nombre))}">${icon('pin').s}<span><b>${esc(a.titulo)}</b><small>${esc(a.categoria || 'Actividad')}</small></span></a>`).join('')}</div>`))}`.toString();
}

// --- Resumen del viaje ---
export function renderResumen(root) {
  const gs = store.list('gastos'), cs = sortCities(store.list('ciudades'));
  const r = tripRange({ ciudades: cs, transportes: store.list('transportes') });
  const hechas = store.list('actividades').filter((a) => a.hecha).length + store.list('entradas').filter((a) => a.hecha).length;
  const porCat = Object.entries(totalesPor(gs, 'categoria')).sort((a, b) => b[1].usd - a[1].usd);
  const porCiu = Object.entries(totalesPor(gs, (g) => cityName(g.ciudadId))).sort((a, b) => b[1].usd - a[1].usd);
  const fotos = store.list('fotos').length;
  root.innerHTML = h`<a class="back" href="#/mas">${icon('back').s}Más</a><header class="top"><p class="kicker">${r ? `${fmtFecha(r.inicio)} → ${fmtFecha(r.fin)}` : ''}</p><h1 class="city-h">Resumen</h1></header>
    <div class="stats"><div><b>${r ? diffDays(r.inicio, r.fin) + 1 : 0}</b><span>días</span></div><div><b>${cs.length}</b><span>ciudades</span></div><div><b>${store.list('transportes').length}</b><span>traslados</span></div><div><b>${hechas}</b><span>visitas hechas</span></div><div><b>${fotos}</b><span>fotos</span></div></div>
    <div class="card tot"><p class="kicker">Gastamos en total</p><p class="big">${fmtUsd(sumUsd(gs))}</p><p class="addr">${fmtUsd(sumUsd(gs) / 2)} por persona (si todo fue 50/50)</p></div>
    <h3 class="sec">Por categoría</h3>${raw(porCat.map(([n, v]) => `<div class="rowv"><span>${esc(n)}</span><b>${esc(fmtUsd(v.usd))}</b></div>`).join('') || '<p class="empty">Sin gastos</p>')}
    <h3 class="sec">Por ciudad</h3>${raw(porCiu.map(([n, v]) => `<div class="rowv"><span>${esc(n)}</span><b>${esc(fmtUsd(v.usd))}</b></div>`).join(''))}`.toString();
}

// --- Ajustes ---
const download = (name, content, type) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], { type })); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); };

export async function renderAjustes(root) {
  const cfg = store.config();
  const yo = await store.meta.get('yo', '');
  const c = sync.getConf() || {};
  const s = sync.state;
  const est = { 'sin-config': 'Sin conectar', listo: 'Conectado', sincronizando: 'Sincronizando…', 'sin-conexion': 'Sin internet (los cambios se guardan y se envían solos)', error: 'Error' }[s.estado];
  root.innerHTML = h`<a class="back" href="#/mas">${icon('back').s}Más</a><header class="top"><p class="kicker">Este celular</p><h1 class="city-h">Ajustes</h1></header>
    <h3 class="sec">¿Quién sos?</h3><div class="chips" id="yo">${cfg.personas.map((p) => raw(`<button type="button" aria-pressed="${p === yo}" data-p="${esc(p)}">${esc(p)}</button>`))}</div>
    <h3 class="sec">Conexión con el Sheet</h3>
    <div class="card"><p><b>${est}</b>${s.ultima ? raw(`<br><small>Última vez: ${esc(new Date(s.ultima).toLocaleString('es-AR'))}</small>`) : ''}${s.msg ? raw(`<br><small class="err-t">${esc(s.msg)}</small>`) : ''}</p>
    <label class="f"><span>Link del puente (termina en /exec)</span><input id="s-url" value="${esc(c.url || '')}" autocomplete="off" inputmode="url"></label>
    <label class="f"><span>Clave secreta</span><input id="s-key" type="password" value="${esc(c.clave || '')}" autocomplete="off"></label>
    <div class="btns wrap"><button class="btn btn-p" id="s-save">Guardar y sincronizar</button><button class="btn btn-s" id="s-now">Sincronizar ahora</button></div>
    <button class="btn btn-s btn-block" id="s-up">Subir todo lo de este celular al Sheet</button></div>
    <h3 class="sec">Monedas y categorías</h3><div class="card"><p>Monedas: <b>${esc(cfg.monedas.map((m) => m.cod).join(', '))}</b></p><p>Categorías: <b>${esc(cfg.categoriasGasto.join(', '))}</b></p>
    <div class="btns wrap"><button class="btn btn-s" id="m-add">Agregar moneda</button><button class="btn btn-s" id="m-cat">Agregar categoría</button><button class="btn btn-s" id="m-tc">Actualizar tipos de cambio</button></div></div>
    <h3 class="sec">Lector de tickets</h3><div class="card"><p class="hint" style="margin-top:0">Para que la app lea PDF y fotos de entradas SIN internet, bajá el lector una vez (≈ 19 MB, mejor con wifi). Si no, se baja solo la primera vez que lo uses con internet.</p><button class="btn btn-s btn-block" id="lec-dl">Descargar lector para usar sin internet</button></div>
    <h3 class="sec">Respaldo</h3><div class="card"><p class="hint">Guardá una copia antes de salir de viaje. Incluye tickets y fotos, pero <b>no</b> los documentos con PIN.</p>
    <div class="btns wrap"><button class="btn btn-p" id="b-json">Exportar todo (JSON)</button><label class="btn btn-s">Importar respaldo<input id="b-imp" type="file" accept=".json,application/json" hidden></label></div>
    <div class="f"><span>Para Excel (CSV)</span><div class="chips">${COLS.filter((k) => k !== 'config').map((k) => raw(`<button type="button" data-csv="${k}">${esc(SCHEMA[k].label)}</button>`))}</div></div>
    <label class="btn btn-s btn-block">Importar CSV a una sección<input id="b-csv" type="file" accept=".csv,text/csv" hidden></label></div>
    <h3 class="sec">Zona de peligro</h3><button class="btn btn-d btn-block" id="wipe">Borrar todos los datos de este celular</button>
    <p class="hint">Versión de la app: ${esc(window.APP_VERSION || '1.0')}</p>`.toString();

  $$('#yo [data-p]', root).forEach((b) => b.onclick = async () => { await store.meta.set('yo', b.dataset.p); toast(`Hola, ${b.dataset.p}`); rerender(); });
  $('#s-save', root).onclick = async () => { await sync.saveConf({ url: $('#s-url', root).value.trim(), clave: $('#s-key', root).value.trim() }); sync.syncNow(); toast('Guardado. Sincronizando…'); };
  $('#s-now', root).onclick = () => sync.syncNow();
  $('#s-up', root).onclick = async () => { if (await confirmar('Se van a enviar todos los datos y archivos de este celular al Sheet y a Drive (pisan lo que haya). ¿Seguir?', { si: 'Sí, subir', peligro: false })) { await store.markAllDirty(); await sync.syncNow(); } };
  $('#m-add', root).onclick = async () => { const cod = prompt('Código de 3 letras (ej: PLN, CHF):')?.trim().toUpperCase(); if (!/^[A-Z]{3}$/.test(cod || '')) return; await store.saveConfig({ monedas: [...cfg.monedas, { cod, nombre: prompt('Nombre:') || cod, tc: 1 }] }); await tasas(true); rerender(); };
  $('#m-cat', root).onclick = async () => { const n = prompt('Nombre de la categoría:')?.trim(); if (n) { await store.saveConfig({ categoriasGasto: [...cfg.categoriasGasto, n] }); rerender(); } };
  $('#lec-dl', root).onclick = async (e) => { const b = e.currentTarget; b.disabled = true; try { await (await import('../lector.js')).descargarLector((i, n) => { b.textContent = `Descargando… ${i}/${n}`; }); b.textContent = 'Listo: el lector ya está en este celular'; } catch { b.disabled = false; b.textContent = 'No se pudo (¿sin internet?). Reintentar'; } };
  $('#m-tc', root).onclick = async () => { const t = await tasas(true); toast(t.fuente === 'online' ? 'Tipos de cambio actualizados' : 'No hay internet: se usa el último conocido'); };
  $('#b-json', root).onclick = async () => { const j = await store.exportAll(); download(`viaje-europa-respaldo-${localToday()}.json`, JSON.stringify(j), 'application/json'); toast('Respaldo descargado'); };
  $('#b-imp', root).onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { const n = await store.importAll(JSON.parse(await f.text())); toast(`Se importaron ${n} datos`); sync.syncNow(); rerender(); } catch (err) { toast(`No se pudo importar: ${err.message}`); } };
  $$('[data-csv]', root).forEach((b) => b.onclick = () => { const col = b.dataset.csv; const cols = ['id', ...SCHEMA[col].fields.map((f) => f.k)]; download(`${col}.csv`, toCSV(store.list(col), cols), 'text/csv'); });
  $('#b-csv', root).onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const rows = parseCSV(await f.text());
    const col = prompt(`¿A qué sección va? Escribí una de: ${COLS.filter((k) => k !== 'config').join(', ')}`)?.trim();
    if (!col || !SCHEMA[col]) return toast('Sección no válida');
    for (const r of rows) {
      const d = { id: r.id || uid(col.slice(0, 2)) };
      for (const fl of SCHEMA[col].fields) if (r[fl.k] !== undefined) d[fl.k] = fl.t === 'number' ? (r[fl.k] === '' ? '' : Number(r[fl.k])) : fl.t === 'bool' ? /^(true|1|si|sí)$/i.test(r[fl.k]) : fl.t === 'files' ? (r[fl.k] ? JSON.parse(r[fl.k]) : []) : r[fl.k];
      await store.save(col, d);
    }
    toast(`Se importaron ${rows.length} filas a ${SCHEMA[col].label}`);
  };
  $('#wipe', root).onclick = async () => { if (await confirmar('Esto borra TODO de este celular (datos, archivos y documentos con PIN). Lo que ya esté en el Sheet no se toca. ¿Seguro?', { si: 'Sí, borrar todo' })) { await store.wipeAll(); location.hash = '#/'; location.reload(); } };
}
