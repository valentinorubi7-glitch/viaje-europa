// Clima de Open-Meteo (gratis, sin clave). Se guarda lo último que se bajó para verlo sin internet.
import * as store from './store.js';

const COD = (c) => (c === 0 ? ['☀️', 'Despejado'] : c <= 2 ? ['⛅', 'Algo nublado'] : c === 3 ? ['☁️', 'Nublado'] : c <= 48 ? ['🌫️', 'Niebla'] : c <= 57 ? ['🌦️', 'Llovizna'] : c <= 67 ? ['🌧️', 'Lluvia'] : c <= 77 ? ['❄️', 'Nieve'] : c <= 82 ? ['🌧️', 'Chubascos'] : c <= 86 ? ['🌨️', 'Nevada'] : ['⛈️', 'Tormenta']);

export async function weatherFor(city, date) {
  if (!city?.lat || !city?.lon) return null;
  const key = `clima:${city.id}`;
  let cache = await store.meta.get(key, null);
  const fresh = cache && Date.now() - cache.t < 3 * 3600e3;
  if (!fresh && navigator.onLine) {
    try {
      const u = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=16`;
      const j = await (await fetch(u)).json();
      if (j.daily) { cache = { t: Date.now(), daily: j.daily }; await store.meta.set(key, cache); }
    } catch { /* sin internet: se usa lo guardado */ }
  }
  const i = cache?.daily?.time?.indexOf(date) ?? -1;
  if (i < 0) return null;
  const [ic, txt] = COD(cache.daily.weathercode[i]);
  return { ic, txt, max: Math.round(cache.daily.temperature_2m_max[i]), min: Math.round(cache.daily.temperature_2m_min[i]), viejo: !fresh };
}
