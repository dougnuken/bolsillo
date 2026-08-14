/* ============================================================
   Bolsillo · pdf-picker.js
   Selección + descifrado de PDF (compartido por los flujos que leen
   extractos: cuentas y créditos). El picker abre en iOS Safari solo si
   input.click() corre SÍNCRONO dentro del gesto → quien llame NO debe
   hacer await antes de invocar elegirArchivoPDF().
   ============================================================ */

import { abrirPDF, esErrorClave, claveIncorrecta } from './pdf-render.js';
import { hoja } from './overlay.js';

const ICON_X =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg>';

export const MAX_PDF_BYTES = 15 * 1024 * 1024; // 15 MB
export const CANCELADO = Symbol('cancelado');

/** Abre el file picker, lee un PDF y devuelve {bytes:ArrayBuffer} | {error} |
    null (cancelado). SÍNCRONO hasta input.click() (requisito de iOS Safari). */
export function elegirArchivoPDF() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
    input.style.display = 'none';
    const limpiar = () => { input.remove(); };
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) { limpiar(); resolve(null); return; }
      if (file.size > MAX_PDF_BYTES) { limpiar(); resolve({ error: 'El PDF es muy grande (máx 15 MB).' }); return; }
      const reader = new FileReader();
      reader.onload = () => { limpiar(); resolve({ bytes: reader.result }); }; // ArrayBuffer
      reader.onerror = () => { limpiar(); resolve({ error: 'No se pudo leer el PDF.' }); };
      reader.readAsArrayBuffer(file);
    }, { once: true });
    document.body.appendChild(input);
    input.click();
  });
}

/** Pide la contraseña del PDF (bottom-sheet). Devuelve la clave o null. La clave
    se usa SOLO local (pdf.js): nunca se guarda ni se envía. */
function pedirClavePDF(reintento) {
  const html = `
    <div class="ov-grip" aria-hidden="true"></div>
    <button type="button" class="icon-btn ov-close" data-c="cancel" aria-label="Cerrar">${ICON_X}</button>
    <h3 class="ov-title ov-title--menu">Extracto protegido</h3>
    <p class="ov-text">${reintento
      ? 'Contraseña incorrecta. Inténtalo de nuevo.'
      : 'Este PDF tiene contraseña. En los bancos suele ser tu número de cédula (sin puntos).'}</p>
    <label class="field">
      <span class="field__label">Contraseña del PDF</span>
      <input class="field__input" id="pdf-clave" type="text" inputmode="numeric" autocomplete="off"
        autocapitalize="off" spellcheck="false" placeholder="Ej. tu cédula" />
    </label>
    <p class="cfg-hint">Se usa solo en tu teléfono para abrir el PDF: no se guarda ni se envía a ningún lado.</p>
    <div class="ov-actions">
      <button type="button" class="btn btn--ghost btn--block" data-c="cancel2">Cancelar</button>
      <button type="button" class="btn btn--primary btn--block" data-c="ok">Leer</button>
    </div>`;
  return hoja(html, (panel, cerrar) => {
    const input = panel.querySelector('#pdf-clave');
    requestAnimationFrame(() => input && input.focus());
    const ok = () => cerrar((input.value || '').trim() || null);
    panel.querySelector('[data-c="ok"]').addEventListener('click', ok);
    panel.querySelector('[data-c="cancel"]').addEventListener('click', () => cerrar(null));
    panel.querySelector('[data-c="cancel2"]').addEventListener('click', () => cerrar(null));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ok(); } });
  });
}

/** Abre el PDF descifrándolo si hace falta (pide la clave en bucle). Lanza
    CANCELADO si el usuario cancela, o el error original si no es de contraseña. */
export async function abrirConClave(bytes) {
  try { return await abrirPDF(bytes); }            // 1er intento sin clave
  catch (e) { if (!esErrorClave(e)) throw e; }     // no está cifrado → error real
  let reintento = false;
  for (;;) {
    const clave = await pedirClavePDF(reintento);
    if (clave == null) throw CANCELADO;            // canceló
    try { return await abrirPDF(bytes, clave); }
    catch (e) {
      if (claveIncorrecta(e)) { reintento = true; continue; }
      throw e;
    }
  }
}
