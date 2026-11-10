// Gastos: se paga en cualquier moneda, se convierte UNA sola vez a dólares y ese valor no cambia más.
import * as store from '../store.js';
import { balance, totalesPor, sumUsd, fmtNum, fmtUsd, parseNum, usdOf, fmtFecha, localToday, cityOn, round2 } from '../logic.js';
import { h, raw, esc, icon, openSheet, confirmar, toast, $, $$ } from '../ui.js';
import { cityName, today } from '../common.js';
import { MONEDAS_DEF } from '../schema.js';

let vista = 'lista';

// --- Tipos de cambio: último conocido guardado en este celular ---
export async function tasas(forzar = false) {
  const guardado = await store.meta.get('tc', { rates: {}, t: 0 });
  const cfg = store.config();
  const quiero = cfg.monedas.map((m) => m.cod).filter((c) => c !== 'USD');
  const viejo = Date.now() - guardado.t > 6 * 3600e3;
  if ((forzar || viejo) && navigator.onLine && quiero.length) {
    for (const base of ['https://api.frankfurter.dev/v1/latest', 'https://api.frankfurter.app/latest']) {
      try {
        const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 4000);
        const j = await (await fetch(`${base}?base=USD&symbols=${quiero.join(',')}`, { signal: ctrl.signal })).json(); clearTimeout(to);
        const rates = {};
        for (const [k, v] of Object.entries(j.rates || {})) if (v) rates[k] = 1 / v; // viene "unidades por 1 USD"; guardamos USD por 1 unidad
        if (Object.keys(rates).length) { const g = { rates: { ...guardado.rates, ...rates }, t: Date.now(), fecha: j.date }; await store.meta.set('tc', g); return { ...g, fuente: 'online' }; }
      } catch { /* probamos la otra dirección */ }
    }
  }
  return { ...guardado, fuente: guardado.t ? 'guardado' : 'aprox' };
}
const tcDe = (cod, g) => (cod === 'USD' ? 1 : g.rates?.[cod] || store.config().monedas.find((m) => m.cod === cod)?.tc || MONEDAS_DEF.find((m) => m.cod === cod)?.tc || 1);

export async function renderGastos(root) {
  const cfg = store.config();
  const todos = store.list('gastos').sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || b.updated - a.updated);
  const antes = todos.filter((g) => g.origen === 'sheet');
  const viaje = todos.filter((g) => g.origen !== 'sheet');
  const bal = balance(viaje, cfg.personas);
  const yo = await store.meta.get('yo', cfg.personas[0]);
  const row = (g) => raw(`<li class="g" data-id="${g.id}"><button class="g-b" data-act="edit"><b>${esc(g.descripcion || g.categoria)}</b><span class="usd">${esc(fmtUsd(g.usd))}</span><small>${esc([fmtFecha(g.fecha), g.categoria, g.pagoPor && `pagó ${g.pagoPor}`, cityName(g.ciudadId)].filter(Boolean).join(' · '))}</small><small class="orig">${g.moneda && g.moneda !== 'USD' ? `${esc(fmtNum(g.monto))} ${esc(g.moneda)} · 1 = ${esc(fmtNum(g.tc, 4))}` : ''}</small></button></li>`);
  const grupo = (items, k) => {
    const t = totalesPor(items, k);
    return Object.entries(t).sort((a, b) => b[1].usd - a[1].usd).map(([n, v]) => `<div class="rowv"><span>${esc(k === 'moneda' ? `${n} · ${fmtNum(v.orig)} ${n}` : n)}<small>${v.n} gasto${v.n === 1 ? '' : 's'}</small></span><b>${esc(fmtUsd(v.usd))}</b></div>`).join('') || '<p class="empty">Sin datos todavía.</p>';
  };
  let cuerpo;
  if (vista === 'lista') cuerpo = h`<ul class="gl">${viaje.length ? viaje.map(row) : raw('<li class="empty">Todavía no cargaron gastos del viaje. Tocá “Agregar gasto”.</li>')}</ul>
    ${antes.length ? raw(`<details class="acc"><summary>Antes del viaje (${antes.length}) · ${esc(fmtUsd(sumUsd(antes)))}</summary><ul class="gl">${antes.map((g) => row(g).s).join('')}</ul></details>`) : ''}`;
  else if (vista === 'moneda') cuerpo = raw(`<div class="vg">${grupo(todos, 'moneda')}</div><p class="hint">Cada gasto se convirtió una sola vez a dólares, el día que se cargó.</p>`);
  else if (vista === 'cat') cuerpo = raw(`<div class="vg">${grupo(todos, 'categoria')}</div>`);
  else cuerpo = raw(`<div class="vg">${grupo(todos, (g) => cityName(g.ciudadId))}</div>`);

  root.innerHTML = h`<header class="top"><p class="kicker">Todo en dólares</p><h1 class="city-h">Gastos</h1></header>
    <div class="card tot"><p class="kicker">Total del viaje</p><p class="big">${fmtUsd(sumUsd(todos))}</p><p class="addr">${fmtUsd(sumUsd(viaje))} durante el viaje · ${fmtUsd(sumUsd(antes))} antes (pasajes, alojamientos, entradas)</p></div>
    <div class="card bal" aria-live="polite"><p class="kicker">Entre ustedes (gastos del viaje)</p>${bal.monto ? raw(`<p>${esc(bal.deudor)} le debe a ${esc(bal.acreedor)}</p><b>${esc(fmtUsd(bal.monto))}</b>`) : raw('<p>Están a mano</p>')}<p class="hint">Los gastos de antes del viaje se saldan en Tricount.</p></div>
    <div class="seg" role="group" aria-label="Ver por">${[['lista', 'Lista'], ['moneda', 'Moneda'], ['cat', 'Categoría'], ['ciudad', 'Ciudad']].map(([k, l]) => raw(`<button class="seg-b" aria-pressed="${vista === k}" data-v="${k}">${l}</button>`))}</div>
    ${cuerpo}
    <button class="fab" id="add" aria-label="Agregar gasto">${icon('plus').s}<span>Agregar gasto</span></button>`.toString();

  $('#add', root).onclick = () => gastoForm(null, yo);
  root.addEventListener('click', (e) => {
    const v = e.target.closest('[data-v]'); if (v) { vista = v.dataset.v; window.dispatchEvent(new Event('app-rerender')); return; }
    const g = e.target.closest('[data-act=edit]'); if (g) gastoForm(store.get('gastos', g.closest('[data-id]').dataset.id), yo);
  });
}

async function gastoForm(g, yo) {
  const cfg = store.config();
  const hoy = today() || localToday();
  const ciudadHoy = cityOn(store.list('ciudades'), hoy);
  const last = await store.meta.get('ultimoGasto', {});
  let tcInfo = await tasas();
  const st = {
    moneda: g?.moneda || last.moneda || ciudadHoy?.moneda || 'EUR',
    pagoPor: g?.pagoPor || last.pagoPor || yo,
    categoria: g?.categoria || last.categoria || cfg.categoriasGasto[0],
    pct: g ? (g.pctPagador ?? 50) : 50,
    tcManual: !!g,
  };
  if (!cfg.monedas.some((m) => m.cod === st.moneda)) st.moneda = 'USD';
  const el = document.createElement('form'); el.className = 'form gasto'; el.noValidate = true;
  const chip = (items, sel, k) => items.map((v) => `<button type="button" aria-pressed="${String(v.v) === String(sel)}" data-k="${k}" data-v="${esc(v.v)}">${esc(v.l)}</button>`).join('');
  el.innerHTML = `
    <label class="f f-big"><span>Monto</span><input id="g-m" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${g ? esc(String(g.monto).replace('.', ',')) : ''}"></label>
    <div class="f"><span>Moneda en que pagaste</span><div class="chips" id="c-mon">${chip(cfg.monedas.map((m) => ({ v: m.cod, l: m.cod })), st.moneda, 'moneda')}<button type="button" data-k="nuevaMoneda" class="chip-add">＋ otra</button></div></div>
    <div id="tc-box"><label class="f"><span>Tipo de cambio <em>(1 <b id="tc-c"></b> = ? USD)</em></span><input id="g-tc" inputmode="decimal" autocomplete="off"></label><p class="hint" id="tc-n"></p></div>
    <p class="eq" aria-live="polite">Equivale a <b id="g-u">USD 0,00</b><small>Este valor en dólares queda fijo, aunque el cambio varíe después.</small></p>
    <div class="f"><span>Pagó</span><div class="chips" id="c-pag">${chip(cfg.personas.map((p) => ({ v: p, l: p })), st.pagoPor, 'pagoPor')}</div></div>
    <div class="f"><span>Categoría</span><div class="chips" id="c-cat">${chip(cfg.categoriasGasto.map((c) => ({ v: c, l: c })), st.categoria, 'categoria')}<button type="button" data-k="nuevaCat" class="chip-add">＋ nueva</button></div></div>
    <div class="f"><span>Cómo se divide</span><div class="chips" id="c-div">${chip([{ v: 50, l: '50 / 50' }, { v: 100, l: 'Solo de quien pagó' }, { v: 0, l: 'Todo del otro' }], [50, 100, 0].includes(Number(st.pct)) ? st.pct : '', 'pct')}<label class="pct">Otro %<input id="g-pct" inputmode="numeric" value="${[50, 100, 0].includes(Number(st.pct)) ? '' : st.pct}" aria-label="Porcentaje que le corresponde a quien pagó"></label></div></div>
    <label class="f"><span>Descripción (opcional)</span><input id="g-d" autocomplete="off" placeholder="Ej: cena en Montmartre" value="${g ? esc(g.descripcion) : ''}"></label>
    <details class="adv"><summary>Fecha, ciudad y nota</summary>
      <label class="f"><span>Fecha</span><input id="g-f" type="date" value="${esc(g?.fecha || hoy)}"></label>
      <label class="f"><span>Ciudad</span><select id="g-ci"><option value="">—</option>${store.list('ciudades').map((c) => `<option value="${esc(c.id)}" ${(g ? g.ciudadId : ciudadHoy?.id) === c.id ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></label>
      <label class="f f-bool"><input id="g-bal" type="checkbox" ${g ? (g.enBalance ? 'checked' : '') : 'checked'}><span>Cuenta para el balance entre nosotros</span></label>
      <label class="f"><span>Nota</span><textarea id="g-n" rows="2">${g ? esc(g.nota || '') : ''}</textarea></label></details>
    <p class="err" id="g-err" hidden role="alert"></p>
    <div class="btns"><button type="button" class="btn btn-s" data-k="x">Cancelar</button><button type="submit" class="btn btn-p">Guardar</button></div>
    ${g ? '<button type="button" class="btn btn-d btn-block" data-k="del">Borrar gasto</button>' : ''}`;
  const sh = openSheet(el, { titulo: g ? 'Editar gasto' : 'Nuevo gasto' });
  const q = (s) => el.querySelector(s);
  const refresh = () => {
    const usd = st.moneda === 'USD';
    q('#tc-box').hidden = usd;
    q('#tc-c').textContent = st.moneda;
    if (usd) q('#g-tc').value = '1';
    const tc = parseNum(q('#g-tc').value);
    q('#g-u').textContent = fmtUsd(usdOf(parseNum(q('#g-m').value), tc || 0));
    q('#tc-n').textContent = st.tcManual ? 'Valor puesto a mano.' : tcInfo.fuente === 'online' ? `Actualizado${tcInfo.fecha ? ' (' + tcInfo.fecha + ')' : ''}.` : tcInfo.fuente === 'guardado' ? (navigator.onLine ? 'Último tipo de cambio guardado. Podés editarlo.' : 'Sin internet: último tipo de cambio conocido. Podés editarlo.') : 'Valor aproximado (todavía no se bajó el real). Editalo si sabés el real.';
  };
  const putTc = () => { if (!st.tcManual) q('#g-tc').value = String(Number(tcDe(st.moneda, tcInfo).toPrecision(5))).replace('.', ','); };
  if (g) q('#g-tc').value = String(g.tc).replace('.', ','); else putTc();
  refresh();
  tasas().then((t) => { tcInfo = t; if (!st.tcManual) { putTc(); } refresh(); });
  q('#g-m').addEventListener('input', refresh);
  q('#g-tc').addEventListener('input', () => { st.tcManual = true; refresh(); });
  q('#g-pct').addEventListener('input', () => { st.pct = parseNum(q('#g-pct').value); $$('#c-div [data-k=pct]', el).forEach((b) => b.setAttribute('aria-pressed', 'false')); });
  setTimeout(() => q('#g-m').focus({ preventScroll: true }), 320);
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-k]'); if (!b) return;
    const k = b.dataset.k;
    if (k === 'x') return sh.close();
    if (k === 'del') { if (await confirmar('¿Borrar este gasto?')) { await store.remove('gastos', g.id); sh.close(); toast('Gasto borrado', { l: 'Deshacer', fn: () => store.restore('gastos', g.id) }); } return; }
    if (k === 'nuevaMoneda') { const cod = prompt('Código de la moneda (ej: PLN, CHF):')?.trim().toUpperCase(); if (!cod || !/^[A-Z]{3}$/.test(cod)) return; const nom = prompt('Nombre (ej: Zloty polaco):') || cod; await store.saveConfig({ monedas: [...cfg.monedas, { cod, nombre: nom, tc: 1 }] }); sh.close(); toast(`Se agregó ${cod}. Volvé a tocar “Agregar gasto”.`); await tasas(true); return; }
    if (k === 'nuevaCat') { const c = prompt('Nombre de la categoría:')?.trim(); if (!c) return; await store.saveConfig({ categoriasGasto: [...cfg.categoriasGasto, c] }); sh.close(); toast('Categoría agregada. Volvé a tocar “Agregar gasto”.'); return; }
    const v = b.dataset.v; const grp = b.parentElement;
    $$('[data-k]', grp).forEach((x) => x.setAttribute('aria-pressed', x === b));
    if (k === 'moneda') { st.moneda = v; st.tcManual = false; putTc(); refresh(); }
    if (k === 'pagoPor') st.pagoPor = v;
    if (k === 'categoria') st.categoria = v;
    if (k === 'pct') { st.pct = Number(v); q('#g-pct').value = ''; }
  });
  el.addEventListener('submit', async (e) => {
    e.preventDefault();
    const monto = parseNum(q('#g-m').value), tc = st.moneda === 'USD' ? 1 : parseNum(q('#g-tc').value);
    const err = q('#g-err');
    if (!(monto > 0)) { err.hidden = false; err.textContent = 'Poné el monto'; q('#g-m').focus(); return; }
    if (!(tc > 0)) { err.hidden = false; err.textContent = 'Falta el tipo de cambio'; q('#g-tc').focus(); return; }
    const pct = Number(st.pct);
    if (!(pct >= 0 && pct <= 100)) { err.hidden = false; err.textContent = 'El porcentaje va de 0 a 100'; return; }
    await store.save('gastos', {
      ...(g || {}), id: g?.id, fecha: q('#g-f').value || hoy, descripcion: q('#g-d').value.trim() || st.categoria, categoria: st.categoria,
      moneda: st.moneda, monto, tc, usd: usdOf(monto, tc), pagoPor: st.pagoPor, pctPagador: pct,
      ciudadId: q('#g-ci').value, enBalance: q('#g-bal').checked, origen: g?.origen || 'viaje', nota: q('#g-n').value.trim(),
    });
    await store.meta.set('ultimoGasto', { moneda: st.moneda, pagoPor: st.pagoPor, categoria: st.categoria });
    sh.close();
    toast('Gasto guardado');
  });
}
