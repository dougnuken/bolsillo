/* ============================================================
   Bolsillo · vincular-chip.js
   Chip de reconciliación: tras registrar un gasto manual que parece
   ser el pago de un fijo pendiente, ofrece VINCULARLO con un toque.
   Un solo nodo a la vez. Sin estilos inline (CSP style-src 'self').
   ============================================================ */

import { hapticOk } from './haptics.js';

let actual = null;
let timer = null;

const IC_LINK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12h6"/><path d="M9.5 8H8a4 4 0 0 0 0 8h1.5"/><path d="M14.5 8H16a4 4 0 0 1 0 8h-1.5"/></svg>';

/**
 * Muestra el chip. NO se auto-cierra: persiste hasta que el usuario le da
 * Vincular o lo descarta con la ×. (Si se te escapa, también puedes vincular
 * después desde Movimientos → tocar el gasto → "Vincular a …".)
 * @param {{nombre:string, onVincular?:Function, onDescartar?:Function}} opts
 */
export function mostrarVinculo({ nombre, onVincular, onDescartar } = {}) {
  cerrar();
  const el = document.createElement('div');
  el.className = 'vinculo-chip';
  el.setAttribute('role', 'status');
  el.innerHTML =
    `<span class="vinculo-chip__ic" aria-hidden="true">${IC_LINK}</span>` +
    '<p class="vinculo-chip__txt">¿Este es tu pago de <strong></strong>?</p>' +
    '<button type="button" class="vinculo-chip__act">Vincular</button>' +
    '<button type="button" class="vinculo-chip__x" aria-label="Descartar">&times;</button>';
  el.querySelector('strong').textContent = nombre || 'tu fijo';

  el.querySelector('.vinculo-chip__act').addEventListener('click', () => {
    cerrar();
    try { if (onVincular) onVincular(); } catch { /* noop */ }
  });
  el.querySelector('.vinculo-chip__x').addEventListener('click', () => {
    cerrar();
    try { if (onDescartar) onDescartar(); } catch { /* noop */ }
  });

  document.body.appendChild(el);
  actual = el;
  hapticOk();
}

function cerrar() {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!actual) return;
  const el = actual;
  actual = null;
  el.classList.add('is-leaving');
  const quitar = () => el.remove();
  el.addEventListener('animationend', quitar, { once: true });
  setTimeout(quitar, 500);
}
