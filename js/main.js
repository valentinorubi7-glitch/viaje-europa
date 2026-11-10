// Arranque de la app: base local, navegación por pestañas y pantallas.
import * as store from './store.js';
import * as sync from './sync.js';
import { h, raw, esc, icon, $, openSheet, toast, closeSheets } from './ui.js';
import * as hoy from './screens/hoy.js';
import * as plan from './screens/plan.js';
import * as listas from './screens/listas.js';
import * as gastos from './screens/gastos.js';
import * as mas from './screens/mas.js';
import * as docs from './screens/docs.js';

window.APP_VERSION = '1.0';
const app = $('#app');

const TABS = [['home', 'Hoy', '#/hoy'], ['cal', 'Plan', '#/plan'], ['train', 'Viaje', '#/viaje'], ['coin', 'Gastos', '#/gastos'], ['more', 'Más', '#/mas']];
$('#nav').innerHTML = TABS.map(([i, l, hr]) => `<a class="nav-i" href="${hr}" data-t="${hr.split('/')[1]}">${icon(i).s}<span>${l}</span></a>`).join('');

const ROUTES = [
  [/^#\/hoy$/, (r) => hoy.render(r)],
  [/^#\/plan$/, (r) => plan.renderList(r)],
  [/^#\/plan\/(.+)$/, (r, m) => plan.renderCity(r, m[1])],
  [/^#\/viaje$/, (r) => listas.renderTransportes(r)],
  [/^#\/gastos$/, (r) => gastos.renderGastos(r)],
  [/^#\/mas$/, (r) => mas.renderMenu(r)],
  [/^#\/mas\/alojamientos$/, (r) => listas.renderAlojamientos(r)],
  [/^#\/mas\/entradas$/, (r) => listas.renderEntradas(r)],
  [/^#\/mas\/docs$/, (r) => docs.render(r)],
  [/^#\/mas\/fotos$/, (r) => mas.renderFotos(r)],
  [/^#\/mas\/checklist$/, (r) => listas.renderChecklist(r)],
  [/^#\/mas\/info$/, (r) => listas.renderInfo(r)],
  [/^#\/mas\/mapa$/, (r) => mas.renderMapa(r)],
  [/^#\/mas\/resumen$/, (r) => mas.renderResumen(r)],
  [/^#\/mas\/ajustes$/, (r) => mas.renderAjustes(r)],
];

let lastHash = '';
let rendering = false, again = false;
async function show() {
  if (rendering) { again = true; return; }
  rendering = true;
  try {
    const hash = location.hash || '#/hoy';
    if (!store.hasData() && !hash.startsWith('#/mas/ajustes')) return welcome();
    const main = document.createElement('main');
    const hit = ROUTES.map(([re, fn]) => [re.exec(hash), fn]).find(([m]) => m);
    if (hit) await hit[1](main, hit[0]); else { location.replace('#/hoy'); return; }
    const same = hash === lastHash;
    const y = same ? window.scrollY : 0;
    app.replaceChildren(main);
    window.scrollTo(0, y);
    lastHash = hash;
    const seg = hash.split('/')[1];
    document.querySelectorAll('.nav-i').forEach((a) => (a.dataset.t === seg ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    document.title = `Viaje Europa`;
  } catch (e) {
    console.error(e);
    app.innerHTML = `<main><header class="top"><h1 class="city-h">Ups</h1></header><p class="err">Algo falló al mostrar esta pantalla: ${esc(e.message)}</p><p><a class="btn btn-s" href="#/hoy">Ir a Hoy</a></p></main>`;
  } finally {
    rendering = false;
    if (again) { again = false; show(); }
  }
}

function welcome() {
  app.innerHTML = h`<main class="welcome"><p class="kicker">Viaje por Europa</p><h1 class="city-h">Bienvenidos</h1>
    <p class="sub">Todavía no hay datos en este celular. Elegí cómo empezar:</p>
    <label class="btn btn-p btn-block">Importar datos del viaje (archivo)<input id="w-imp" type="file" accept=".json,application/json" hidden></label>
    <a class="btn btn-s btn-block" href="#/mas/ajustes">Conectar con el Sheet</a>
    <button class="btn btn-s btn-block" id="w-vacio">Empezar vacío</button>
    <p class="hint">Si Vicky ya cargó todo y subió los datos al Sheet, elegí “Conectar con el Sheet” e ingresá el link y la clave.</p></main>`.toString();
  $('#w-imp').onchange = async (e) => {
    try { const n = await store.importAll(JSON.parse(await e.target.files[0].text())); toast(`Se cargaron ${n} datos`); await askWho(); show(); }
    catch (err) { toast(`No se pudo importar: ${err.message}`); }
  };
  $('#w-vacio').onclick = async () => { await store.saveConfig({}); await store.save('ciudades', { id: 'c-1', nombre: 'Mi primera ciudad', llegada: '2026-12-31', salida: '2027-01-03', orden: 1, moneda: 'EUR' }); show(); };
}

async function askWho() {
  if (await store.meta.get('yo', '')) return;
  const ps = store.config().personas;
  await new Promise((res) => {
    const el = document.createElement('div');
    el.innerHTML = `<p class="conf-t">Así sabemos quién paga y quién es quién en los gastos.</p><div class="chips">${ps.map((p) => `<button type="button" data-p="${esc(p)}">${esc(p)}</button>`).join('')}</div>`;
    const sh = openSheet(el, { titulo: '¿Quién sos?', onClose: res });
    el.onclick = async (e) => { const p = e.target.closest('[data-p]')?.dataset.p; if (p) { await store.meta.set('yo', p); sh.close(); } };
  });
}

function wireSync() {
  const chip = $('#sync');
  const paint = (s) => {
    chip.dataset.s = s.estado;
    chip.textContent = { listo: 'Al día', sincronizando: 'Sincronizando', 'sin-conexion': 'Sin internet', error: 'Revisar', 'sin-config': '' }[s.estado] || '';
    chip.title = s.msg || '';
  };
  sync.onState(paint);
  chip.onclick = () => (sync.state.estado === 'error' ? toast(sync.state.msg || 'Error de sincronización') : (location.hash = '#/mas/ajustes'));
  paint(sync.state);
}

async function boot() {
  await store.init();
  // En el celular de prueba o en tu compu: si al lado de la app hay un datos-iniciales.json, se carga una sola vez
  if (!store.hasData() && !(await store.meta.get('seedProbado', false)) && !location.search.includes('sinseed')) {
    try {
      const r = await fetch('datos-iniciales.json', { cache: 'no-store' });
      if (r.ok) { await store.importAll(await r.json(), { marcarCambios: true }); }
    } catch { /* en el hosting público este archivo no existe, y está bien */ }
    await store.meta.set('seedProbado', true);
  }
  // Link de conexión: #/conectar=<datos en base64>. Se usa una sola vez y se borra de la barra de direcciones.
  const m = /^#\/conectar=([\w-]+)$/.exec(location.hash);
  if (m) {
    try {
      const c = JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/')))));
      if (c.u && c.k) await sync.saveConf({ url: c.u, clave: c.k });
      toast('Conectado con el Sheet');
    } catch { toast('El link de conexión no es válido'); }
    history.replaceState(null, '', location.pathname + location.search + '#/hoy');
  }
  store.subscribe(() => show());
  window.addEventListener('app-rerender', () => show());
  window.addEventListener('hashchange', () => { closeSheets(); document.querySelectorAll('.viewer').forEach((v) => v.remove()); document.body.classList.remove('lock'); show(); });
  document.addEventListener('docs-locked', () => location.hash.includes('/docs') && show());
  wireSync();
  sync.start();
  await show();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => reg.installing?.addEventListener('statechange', function () { if (this.state === 'installed' && navigator.serviceWorker.controller) toast('Hay una versión nueva. Cerrá y abrí la app para usarla.'); }));
    }).catch(() => {});
  }
  if (store.hasData()) askWho();
}
boot();
