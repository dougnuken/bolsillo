/* ============================================================
   Bolsillo · html.js
   Utilidades mínimas de plantillas. PURAS, sin DOM.
   ============================================================ */

const MAPA = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapa texto para interpolar en HTML. Nunca lanza. */
export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (m) => MAPA[m]);
}
