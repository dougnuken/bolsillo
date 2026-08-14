/* ============================================================
   Bolsillo · pdf-render.js
   Envoltorio de pdf.js (autohospedado en js/vendor/pdfjs/) para leer
   EXTRACTOS bancarios en PDF, que en Colombia suelen venir CIFRADOS
   (contraseña = la cédula del titular). La API de Claude no abre PDFs
   cifrados, así que aquí:
     1) abrimos/desciframos el PDF en el teléfono (con la clave si hace falta),
     2) rendimos las primeras páginas a imagen JPEG,
   y esas imágenes se mandan a Claude por visión (extracto-pdf.js).

   La contraseña se usa SOLO localmente para abrir el PDF: nunca se guarda
   ni se envía a ningún servidor. pdf.js se carga de forma DIFERIDA (~1.4 MB
   de worker) solo cuando el usuario lee un extracto.
   ============================================================ */

let _pdfjs = null;

/** Carga pdf.js una sola vez y configura el worker autohospedado. */
async function cargarPdfjs() {
  if (_pdfjs) return _pdfjs;
  const mod = await import('./vendor/pdfjs/pdf.min.mjs');
  mod.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
  _pdfjs = mod;
  return mod;
}

/* Códigos de PasswordException de pdf.js (PasswordResponses). */
export const PDF_NEED_PASSWORD = 1;
export const PDF_INCORRECT_PASSWORD = 2;

/** ¿el error es porque el PDF pide contraseña? */
export function esErrorClave(err) {
  return !!(err && err.name === 'PasswordException');
}
/** ¿la contraseña dada fue incorrecta (vs. faltante)? */
export function claveIncorrecta(err) {
  return esErrorClave(err) && err.code === PDF_INCORRECT_PASSWORD;
}

/**
 * Abre un PDF. Si está cifrado y `password` falta o es incorrecta, la promesa
 * RECHAZA con un error `.name === 'PasswordException'` y `.code`.
 * @param {ArrayBuffer|Uint8Array} bytes
 * @param {string} [password]
 * @returns {Promise<any>} pdfDoc de pdf.js
 */
export async function abrirPDF(bytes, password) {
  const pdfjs = await cargarPdfjs();
  // pdf.js consume/“detacha” el buffer → copiamos para poder reintentar con otra clave.
  const src = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const data = src.slice();
  const params = { data };
  if (password) params.password = password;
  return pdfjs.getDocument(params).promise;
}

/**
 * Rinde hasta `maxPag` páginas a JPEG base64 (sin el prefijo `data:`), escaladas
 * para que el lado mayor no pase de `maxLado` px (óptimo de visión de Claude).
 * @returns {Promise<Array<{base64:string, mediaType:string}>>}
 */
export async function paginasAImagenes(pdfDoc, { maxPag = 2, maxLado = 1568, calidad = 0.82 } = {}) {
  const total = Math.min(pdfDoc.numPages || 1, maxPag);
  const imgs = [];
  for (let i = 1; i <= total; i++) {
    const page = await pdfDoc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const escala = Math.max(0.1, Math.min(maxLado / base.width, maxLado / base.height, 2.5));
    const viewport = page.getViewport({ scale: escala });

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    // Los PDFs suelen ser transparentes → JPEG necesita fondo blanco.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL('image/jpeg', calidad);
    const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl || '');
    if (m) imgs.push({ mediaType: m[1], base64: m[2] });

    // liberar memoria (importante en iOS)
    canvas.width = 0;
    canvas.height = 0;
    if (typeof page.cleanup === 'function') page.cleanup();
  }
  return imgs;
}
