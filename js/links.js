// Dónde sacar cada entrada: links oficiales conocidos y, si no hay, una búsqueda lista para tocar.
// Los links de SITIOS se revisaron en las páginas oficiales; si alguno cambia, se corrige acá o en la entrada.

export const SITIOS = [
  { claves: ['sky garden'], url: 'https://skygarden.london/', nota: 'Gratis: hay que reservar online con anticipación.' },
  { claves: ['anne frank'], url: 'https://www.annefrank.org/en/museum/tickets/', nota: 'Se venden online por adelantado y se agotan.' },
  { claves: ['rijksmuseum'], url: 'https://www.rijksmuseum.nl/en/tickets', nota: '' },
  { claves: ['windsor'], url: 'https://www.rct.uk/visit/windsor-castle', nota: '' },
  { claves: ['tower of london'], url: 'https://www.hrp.org.uk/tower-of-london/visit/tickets-and-prices/', nota: '' },
  { claves: ['british museum'], url: 'https://www.britishmuseum.org/visit', nota: 'Entrada gratis; algunas exposiciones se pagan.' },
  { claves: ['reichstag', 'bundestag'], url: 'https://www.bundestag.de/en/visittheBundestag/dome', nota: 'Gratis: hay que registrarse online antes.' },
  { claves: ['sachsenhausen'], url: 'https://www.sachsenhausen-sbg.de/en/educational-programs/guided-tours/', nota: 'La visita al memorial es gratis. Los tours públicos se anotan en el lugar (no se reservan antes); la web de reservas es para grupos.' },
  { claves: ['prague castle', 'castillo de praga'], url: 'https://www.hrad.cz/en/prague-castle-for-visitors/tickets', nota: '' },
  { claves: ['schonbrunn', 'schönbrunn'], url: 'https://www.schoenbrunn.at/en/', nota: '' },
  { claves: ['belvedere'], url: 'https://www.belvedere.at/en', nota: '' },
  { claves: ['kunsthistorisches'], url: 'https://www.khm.at/en', nota: '' },
  { claves: ['szechenyi', 'széchenyi'], url: 'https://www.szechenyifurdo.hu/', nota: '' },
  { claves: ['pescadores', 'fisherman'], url: 'https://fishermansbastion.com/', nota: '' },
  { claves: ['palacio real', 'royal palace'], url: 'https://tickets.patrimonionacional.es/en/tickets/palacio-real-de-madrid', nota: '' },
  { claves: ['louvre'], url: 'https://www.louvre.fr/en/visit/hours-admission', nota: '' },
  { claves: ['versalles', 'versailles'], url: 'https://www.chateauversailles.fr/en/plan-your-visit', nota: '' },
  { claves: ['hortus'], url: 'https://hortus-botanicus.nl/en/', nota: '' },
];

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const googleBuscar = (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;

// Devuelve { url, directo, nota }: directo=true si es un link oficial conocido; si no, una búsqueda
export function linkParaSacar(lugar, ciudad = '') {
  const n = norm(lugar);
  const hit = SITIOS.find((s) => s.claves.some((k) => n.includes(norm(k))));
  if (hit) return { url: hit.url, directo: true, nota: hit.nota };
  const limpio = String(lugar || '').replace(/[^\p{L}\p{N} '’.-]+/gu, ' ').replace(/\s+/g, ' ').trim();
  return { url: googleBuscar(`${limpio} ${ciudad} entradas oficiales comprar`), directo: false, nota: '' };
}
