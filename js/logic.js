// Lógica pura (sin pantalla ni base de datos): fechas, plata, orden, mezcla de cambios.
// Se usa en la app y en los tests.

const MS = 864e5;
export const pad = (n) => String(n).padStart(2, '0');

// --- Fechas ('YYYY-MM-DD' como texto, sin líos de zona horaria) ---
export const parseD = (s) => {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
export const fmtD = (ms) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
export const addDays = (s, n) => fmtD(parseD(s) + n * MS);
export const diffDays = (a, b) => Math.round((parseD(b) - parseD(a)) / MS);
export const localToday = (now = new Date()) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
export const localHM = (now = new Date()) => `${pad(now.getHours())}:${pad(now.getMinutes())}`;
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const dow = (s) => DIAS[new Date(parseD(s)).getUTCDay()];
export const fmtFecha = (s, conDia = true) => {
  if (!s) return '';
  const d = new Date(parseD(s));
  return `${conDia ? dow(s) + ' ' : ''}${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`;
};
export const fmtFechaLarga = (s) => `${fmtFecha(s)} ${new Date(parseD(s)).getUTCFullYear()}`;
export const dayOf = (dt) => (dt || '').slice(0, 10);
export const timeOf = (dt) => (dt && dt.length > 10 ? dt.slice(11, 16) : '');
export const dateRange = (from, to) => {
  const out = [];
  for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
};

// --- Viaje: rango, ciudad actual, día N ---
export function tripRange({ ciudades = [], transportes = [] }) {
  const ds = [];
  ciudades.forEach((c) => { if (c.llegada) ds.push(c.llegada); if (c.salida) ds.push(c.salida); });
  transportes.forEach((t) => { if (t.salida) ds.push(dayOf(t.salida)); if (t.llegada) ds.push(dayOf(t.llegada)); });
  if (!ds.length) return null;
  ds.sort();
  return { inicio: ds[0], fin: ds[ds.length - 1] };
}

export const sortCities = (ciudades) =>
  [...ciudades].sort((a, b) => (a.llegada || '').localeCompare(b.llegada || '') || (a.orden ?? 0) - (b.orden ?? 0));

export function cityOn(ciudades, date) {
  const cs = sortCities(ciudades).filter((c) => c.llegada && c.salida);
  if (!cs.length) return null;
  const hit = cs.find((c) => c.llegada <= date && date < c.salida);
  if (hit) return hit;
  const last = cs[cs.length - 1];
  if (date === last.salida) return last;
  return null;
}

export function tripState(rango, hoy) {
  if (!rango) return { fase: 'sin-datos' };
  if (hoy < rango.inicio) return { fase: 'antes', dias: diffDays(hoy, rango.inicio) };
  if (hoy > rango.fin) return { fase: 'despues' };
  return { fase: 'durante', dia: diffDays(rango.inicio, hoy) + 1, total: diffDays(rango.inicio, rango.fin) + 1 };
}

// --- Plata ---
export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export const usdOf = (monto, tc) => round2(Number(monto) * Number(tc));

// Número escrito a mano ("1.234,50" o "1234.5") → número
export function parseNum(s) {
  if (typeof s === 'number') return s;
  let t = String(s ?? '').trim().replace(/\s/g, '');
  if (!t) return 0;
  const lc = t.lastIndexOf(','), ld = t.lastIndexOf('.');
  if (lc > -1 && ld > -1) t = lc > ld ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  else if (lc > -1) t = t.replace(',', '.');
  else if (ld > -1 && /^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}
export const fmtNum = (n, d = 2) => Number(n).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmtUsd = (n) => `USD ${fmtNum(n)}`;

// neto > 0: personas[1] le debe a personas[0]. Solo gastos marcados "enBalance".
export function balance(gastos, personas) {
  let neto = 0;
  for (const g of gastos) {
    if (g.deleted || !g.enBalance) continue;
    const pct = g.pctPagador === undefined || g.pctPagador === '' || g.pctPagador === null ? 50 : Number(g.pctPagador);
    const parteOtro = (Number(g.usd) * (100 - pct)) / 100;
    if (g.pagoPor === personas[0]) neto += parteOtro;
    else if (g.pagoPor === personas[1]) neto -= parteOtro;
  }
  neto = round2(neto);
  if (neto === 0) return { deudor: null, acreedor: null, monto: 0 };
  return neto > 0
    ? { deudor: personas[1], acreedor: personas[0], monto: neto }
    : { deudor: personas[0], acreedor: personas[1], monto: -neto };
}

export function totalesPor(gastos, clave) {
  const out = {};
  for (const g of gastos) {
    if (g.deleted) continue;
    const k = (typeof clave === 'function' ? clave(g) : g[clave]) || 'Sin asignar';
    out[k] = out[k] || { usd: 0, orig: 0, n: 0 };
    out[k].usd = round2(out[k].usd + Number(g.usd));
    out[k].orig = round2(out[k].orig + Number(g.monto));
    out[k].n++;
  }
  return out;
}
export const sumUsd = (gastos) => round2(gastos.filter((g) => !g.deleted).reduce((a, g) => a + Number(g.usd || 0), 0));

// --- Mezcla de cambios entre celulares: gana el último cambio, fila por fila ---
export const shouldApply = (local, remote) => !local || Number(remote.updated) > Number(local.updated);

// Convierte los textos que vuelven del Sheet a su tipo real según el esquema
export function coerce(fields, doc) {
  const out = { ...doc };
  for (const f of fields) {
    const v = out[f.k];
    if (v === undefined || v === null) continue;
    if (f.t === 'number') out[f.k] = v === '' ? '' : Number(v);
    else if (f.t === 'select' && (f.opts || []).some((o) => typeof o === 'object' && typeof o.v === 'number')) out[f.k] = v === '' ? '' : Number(v);
    else if (f.t === 'bool') out[f.k] = v === true || v === 'true' || v === 'TRUE' || v === 1 || v === '1';
    else if (f.t === 'files' || f.t === 'json') {
      if (typeof v === 'string') { try { out[f.k] = v ? JSON.parse(v) : []; } catch { out[f.k] = []; } }
    } else if (typeof v !== 'string') out[f.k] = String(v);
  }
  out.updated = Number(out.updated) || 0;
  out.deleted = out.deleted === true || out.deleted === 'true' || out.deleted === 'TRUE' || out.deleted === 1;
  return out;
}

// --- CSV simple (para abrir en Excel) ---
export function toCSV(rows, cols) {
  const q = (v) => {
    const s = v === undefined || v === null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => q(r[c])).join(','))].join('\r\n');
}
export function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const rows = [];
  let row = [], cur = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
    } else cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); if (row.some((x) => x !== '')) rows.push(row); }
  if (!rows.length) return [];
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), r[i] ?? ''])));
}

export const uid = (p = 'x') => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
export const mapsUrl = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
export const mapsDir = (q) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;

// --- Check-in online de vuelos: cuándo abre y cuánto falta ---
export function checkinInfo(t, ahora = Date.now()) {
  if (!t || t.tipo !== 'Vuelo' || !t.salida || t.salida.length < 16) return null;
  if (t.salida.slice(11, 16) === '00:00') return null; // 00:00 = todavía no se sabe la hora
  const horas = Number(t.checkinHoras) || 24;
  const salida = new Date(t.salida).getTime(); // hora local del celular (aproximada si cambian de huso horario)
  const abre = salida - horas * 3600e3;
  const estado = ahora >= salida ? 'pasado' : ahora >= abre ? 'abierto' : 'pronto';
  return { abre, salida, horas, estado, falta: abre - ahora };
}
export function enTexto(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mi = m % 60;
  if (d) return `${d} día${d === 1 ? '' : 's'}${h ? ` y ${h} h` : ''}`;
  if (h) return `${h} h${mi ? ` ${mi} min` : ''}`;
  return `${mi} min`;
}
