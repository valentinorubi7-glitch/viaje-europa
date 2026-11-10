// Lee el texto de un PDF (sin internet) o de una foto (OCR en el propio celular, sin mandar nada afuera).
// Las librerías están guardadas dentro de la app (carpeta vendor/) y se cargan solo cuando hacen falta.
import * as store from './store.js';
import { analizarTicket } from './ticket.js';
import { tripRange, localToday } from './logic.js';

const base = new URL('../vendor/', import.meta.url);
let pdfjs = null;
let ocr = null;

async function cargarPdf() {
  if (!pdfjs) {
    pdfjs = await import(new URL('pdf.min.mjs', base).href);
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.mjs', base).href;
  }
  return pdfjs;
}

async function textoPdf(file) {
  const lib = await cargarPdf();
  const doc = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
  let t = '';
  for (let i = 1; i <= Math.min(doc.numPages, 3); i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    for (const it of c.items) t += it.str + (it.hasEOL ? '\n' : ' ');
    t += '\n';
  }
  return { texto: t, doc };
}

async function lectorOcr() {
  if (!ocr) {
    const mod = await import(new URL('tesseract.esm.min.js', base).href);
    const { createWorker } = mod.default || mod;
    ocr = await createWorker('spa+eng', 1, {
      workerPath: new URL('worker.min.js', base).href,
      corePath: base.href.replace(/\/$/, ''),
      langPath: new URL('lang', base).href,
      gzip: true,
    });
  }
  return ocr;
}

async function paginaComoImagen(doc) {
  const page = await doc.getPage(1);
  const vp = page.getViewport({ scale: 2 });
  const c = document.createElement('canvas');
  c.width = vp.width; c.height = vp.height;
  await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
  return new Promise((r) => c.toBlob(r, 'image/png'));
}

// Las capturas chicas se agrandan (y las enormes se achican) para que el lector acierte más
async function prepararImagen(file) {
  try {
    const bmp = await createImageBitmap(file);
    const lado = Math.max(bmp.width, bmp.height);
    const k = lado < 1800 ? Math.min(3, 2400 / lado) : lado > 3200 ? 2800 / lado : 1;
    if (Math.abs(k - 1) < 0.05) return file;
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.filter = 'grayscale(1) contrast(1.25)';
    g.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((r) => c.toBlob(r, 'image/png'));
  } catch { return file; }
}

// Devuelve { texto, via } o lanza un error con un mensaje en castellano
export async function leerArchivo(file) {
  const esPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
  try {
    if (esPdf) {
      const { texto, doc } = await textoPdf(file);
      if (texto.replace(/\s/g, '').length >= 30) return { texto, via: 'pdf' };
      const w = await lectorOcr(); // PDF escaneado: sin texto, se lee como imagen
      return { texto: (await w.recognize(await paginaComoImagen(doc))).data.text, via: 'ocr' };
    }
    if (!(file.type || '').startsWith('image/')) throw new Error('tipo');
    const w = await lectorOcr();
    return { texto: (await w.recognize(await prepararImagen(file))).data.text, via: 'ocr' };
  } catch (e) {
    ocr = null;
    throw new Error(e.message === 'tipo' ? 'Este tipo de archivo no se puede leer (solo PDF y fotos).' : 'No pude abrir el lector. Si es la primera vez, hace falta internet para bajarlo una vez.');
  }
}

// Lee el archivo y propone los datos de la entrada, usando lo que ya está cargado en la app
export async function leerTicket(file) {
  const { texto, via } = await leerArchivo(file);
  const rango = tripRange({ ciudades: store.list('ciudades'), transportes: store.list('transportes') });
  const r = analizarTicket(texto, { hoy: localToday(), rango, ciudades: store.list('ciudades'), entradas: store.list('entradas') });
  return { ...r, via, texto };
}

// Descarga el lector para usarlo sin internet (≈ 19 MB, una sola vez)
export async function descargarLector(onProgreso) {
  const archivos = ['pdf.min.mjs', 'pdf.worker.min.mjs', 'tesseract.esm.min.js', 'worker.min.js', 'tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js', 'lang/spa.traineddata.gz', 'lang/eng.traineddata.gz'];
  let i = 0;
  for (const a of archivos) {
    await (await fetch(new URL(a, base).href)).arrayBuffer();
    onProgreso?.(++i, archivos.length);
  }
}
