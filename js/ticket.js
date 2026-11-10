// Lee el TEXTO de un ticket (ya extraído del PDF o de la foto) y propone fecha, hora, lugar, precio y códigos.
// Es lógica pura (sin pantalla): se prueba con tests. Nunca inventa: lo que no encuentra queda vacío.

const sinAcentos = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const MESES = {
  ene: 1, enero: 1, jan: 1, janv: 1, janvier: 1, january: 1, januar: 1, jann: 1,
  feb: 2, febr: 2, fev: 2, fevr: 2, fevrier: 2, february: 2, februar: 2, febrero: 2,
  mar: 3, mars: 3, march: 3, marz: 3, maerz: 3, marzo: 3,
  abr: 4, abril: 4, apr: 4, april: 4, avr: 4, avril: 4,
  may: 5, mayo: 5, mai: 5,
  jun: 6, junio: 6, june: 6, juin: 6, juni: 6,
  jul: 7, julio: 7, july: 7, juil: 7, juillet: 7, juli: 7,
  ago: 8, agosto: 8, aug: 8, august: 8, aout: 8,
  sep: 9, sept: 9, septiembre: 9, setiembre: 9, september: 9, septembre: 9,
  oct: 10, octubre: 10, october: 10, octobre: 10, oktober: 10,
  nov: 11, noviembre: 11, november: 11, novembre: 11,
  dic: 12, diciembre: 12, dec: 12, december: 12, decembre: 12, dez: 12, dezember: 12,
};
const MES_RE = Object.keys(MESES).sort((a, b) => b.length - a.length).join('|');

const COMPRA = /(compra|purchase|achat|vente|emis|issued|emitid|bestell|pedido|order date|date of issue|facturac|invoice|ausgestellt|impres|printed|transaction)/;
const EVENTO = /(valable|valid|valido|visita|visit|fecha|date|datum|entrada|admission|horaire|time|hora|arrival|llegada|salida|departure|fecha de visita|tag|jour)/;

const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const valida = (y, m, d) => y >= 2020 && y <= 2040 && m >= 1 && m <= 12 && d >= 1 && d <= 31;

function fechas(n, hoy) {
  const out = [];
  const push = (y, m, d, idx, sinAnio) => {
    if (sinAnio) { // sin año: la próxima vez que ocurre esa fecha
      const [hy] = hoy.split('-').map(Number);
      y = iso(hy, m, d) >= hoy ? hy : hy + 1;
    }
    if (valida(y, m, d)) out.push({ iso: iso(y, m, d), idx });
  };
  let m;
  const A = /\b(20\d{2})-(\d{2})-(\d{2})\b/g;
  while ((m = A.exec(n))) push(+m[1], +m[2], +m[3], m.index);
  const B = /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4}|\d{2})\b/g;
  while ((m = B.exec(n))) push(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1], m.index);
  const C = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th|o)?\\s*(?:de\\s+|\\.\\s*)?(${MES_RE})\\b\\.?,?\\s*(?:de\\s+)?(\\d{4})?`, 'g');
  while ((m = C.exec(n))) push(m[3] ? +m[3] : 0, MESES[m[2]], +m[1], m.index, !m[3]);
  const D = new RegExp(`\\b(${MES_RE})\\b\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, 'g');
  while ((m = D.exec(n))) push(+m[3], MESES[m[1]], +m[2], m.index);
  return out;
}

function mejorFecha(n, ctx) {
  const { hoy, rango } = ctx;
  const cands = fechas(n, hoy);
  let best = null;
  for (const c of cands) {
    const antes = n.slice(Math.max(0, c.idx - 70), c.idx);
    let sc = 0;
    if (COMPRA.test(antes)) sc -= 6;
    if (EVENTO.test(antes)) sc += 3;
    if (rango && c.iso >= rango.inicio && c.iso <= rango.fin) sc += 2;
    if (c.iso >= hoy) sc += 1;
    sc -= c.idx / 100000; // desempate: la que aparece primero
    if (!best || sc > best.sc) best = { ...c, sc };
  }
  return best && best.sc > -3 ? best : null;
}

function mejorHora(n, fecha) {
  const re = /\b([01]?\d|2[0-3])\s*[:h]\s*([0-5]\d)\b(?:\s*(am|pm))?/g;
  let m, best = null;
  while ((m = re.exec(n))) {
    const fin = m.index + m[0].length;
    const antes = n.slice(Math.max(0, m.index - 50), m.index);
    const despues = n.slice(fin, fin + 14);
    if (/^[.\/\-]\d/.test(despues) || /\d[.\/\-]\s*$/.test(antes)) continue;          // parte de una fecha
    if (/^\s*(?:-|–|—|a|to|bis|hasta)\s*\d{1,2}\s*[:h]\s*\d{2}/.test(despues)) continue; // horario de apertura "9:00 - 18:00"
    if (/\d{1,2}\s*[:h]\s*\d{2}\s*(?:-|–|—|a|to|bis|hasta)\s*$/.test(antes)) continue;
    let h = +m[1];
    if (m[3] === 'pm' && h < 12) h += 12;
    if (m[3] === 'am' && h === 12) h = 0;
    let sc = 0;
    if (COMPRA.test(antes)) sc -= 6;
    if (/(hora|time|horaire|uhr|entrada|admission|salida|departure|meeting|rendez|entry|cita)/.test(antes)) sc += 3;
    if (fecha && Math.abs(m.index - fecha.idx) < 90) sc += 2;
    if (h === 0 && m[2] === '00') sc -= 2;
    sc -= m.index / 100000;
    if (!best || sc > best.sc) best = { hora: `${pad(h)}:${m[2]}`, sc };
  }
  return best && best.sc > -3 ? best.hora : '';
}

function precio(original) {
  const sim = { '€': 'EUR', '£': 'GBP', $: 'USD', 'us$': 'USD' };
  let m = /(\d{1,4}(?:[.,]\d{2}))\s*(€|eur|usd|us\$|\$|£|gbp|czk|huf)(?![a-z])/i.exec(original);
  if (m) return { monto: m[1].replace(',', '.'), moneda: sim[m[2].toLowerCase()] || m[2].toUpperCase() };
  m = /(€|£|\$|eur|usd|gbp)\s*(\d{1,4}(?:[.,]\d{2}))/i.exec(original);
  if (m) return { monto: m[2].replace(',', '.'), moneda: sim[m[1].toLowerCase()] || m[1].toUpperCase() };
  return null;
}

function codigos(original) {
  const re = /(?:ref(?:erence)?|reserva|booking|confirmation|confirmaci[oó]n|c[oó]digo|code|order|pedido|commande|ticket|billet|n[uú]mero|vente|transaction)(?:\s+(?:reference|number|code|no\.?|nr\.?|n[uú]mero|de reserva))?\s*[:#.\-]?\s*([A-Z0-9][A-Z0-9\-]{5,19})/gi;
  const out = [];
  let m;
  while ((m = re.exec(original))) if (/\d/.test(m[1]) && !out.includes(m[1])) out.push(m[1]);
  return out.slice(0, 3);
}

// Palabras que, si aparecen en el ticket, indican de qué lugar es (con variantes en otros idiomas)
const ALIAS = {
  versalles: ['versailles'], parlamento: ['parliament', 'parlament', 'orszaghaz'], pescadores: ['fisherman', 'halaszbastya'],
  crucero: ['cruise', 'cruceros', 'hajo'], danubio: ['danube', 'duna'], termas: ['thermal', 'furdo', 'bath', 'baths'],
  schonbrunn: ['schoenbrunn', 'schonbrunn'], szechenyi: ['szechenyi'], castillo: ['castle', 'chateau', 'hrad'],
  museo: ['museum', 'musee', 'muzeum'], palacio: ['palace', 'palais', 'palast'], torre: ['tower'],
};
const GENERICAS = new Set(['palace', 'palacio', 'castle', 'castillo', 'museum', 'museo', 'house', 'tower', 'torre', 'garden', 'bastion', 'bastión', 'de', 'del', 'the', 'of', 'por', 'entrada', 'termas']);

export function buscarEntrada(n, entradas) {
  let best = null;
  for (const e of entradas) {
    const palabras = sinAcentos(e.lugar).replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length >= 4);
    if (!palabras.length) continue;
    let aciertos = 0, distintivas = 0;
    for (const w of palabras) {
      const variantes = [w, ...(ALIAS[w] || [])];
      const hit = variantes.some((v) => new RegExp(`\\b${v}`).test(n));
      if (hit) { aciertos++; if (!GENERICAS.has(w)) distintivas++; }
    }
    if (!distintivas) continue; // acertar solo "museum" o "palace" no alcanza
    const sc = distintivas * 2 + aciertos + (e.estado !== 'Comprada' ? 1 : 0);
    if (!best || sc > best.sc) best = { e, sc };
  }
  return best?.e || null;
}

function lineaTitulo(original) {
  const bad = /(ticket|billet|entrada|vente|www\.|http|@|tel|fax|valid|valable|condiciones|conditions|total|montant|importe|price|precio|adulto|adult|nombre|name|date|hora|time|horaire|acheteur|comprador|order|pedido|n[°ºo] )/i;
  const lines = original.split(/\n+/).map((l) => l.replace(/\s+/g, ' ').trim()).filter((l) => l.length >= 5 && l.length <= 60);
  return lines.slice(0, 14).find((l) => !bad.test(l) && /[a-záéíóúñ]{4}/i.test(l) && !/^\d/.test(l)) || '';
}

export function analizarTicket(texto, ctx = {}) {
  const original = String(texto || '');
  const n = sinAcentos(original);
  const hoy = ctx.hoy || new Date().toISOString().slice(0, 10);
  const f = mejorFecha(n, { hoy, rango: ctx.rango });
  const hora = mejorHora(n, f);
  const match = buscarEntrada(n, ctx.entradas || []);
  const ciudad = f && (ctx.ciudades || []).find((c) => c.llegada <= f.iso && f.iso <= c.salida);
  return {
    fecha: f ? f.iso : '',
    hora,
    precio: precio(original),
    codigos: codigos(original),
    match,
    lugar: match ? match.lugar : lineaTitulo(original),
    ciudadId: match?.ciudadId || ciudad?.id || '',
    leyoAlgo: original.trim().length > 15,
  };
}
