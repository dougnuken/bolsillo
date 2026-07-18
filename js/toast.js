/* ============================================================
   Bolsillo · toast.js
   Aviso efímero, no bloqueante. Un solo nodo reutilizado.
   Sin estilos inline (CSP style-src 'self'): todo por clases.
   ============================================================ */

let nodo = null;
let timer = null;

const ICON_OK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7"/></svg>';

function asegurarNodo() {
  if (nodo) return nodo;
  nodo = document.createElement('div');
  nodo.className = 'toast';
  nodo.setAttribute('role', 'status');
  nodo.setAttribute('aria-live', 'polite');
  document.body.appendChild(nodo);
  return nodo;
}

/**
 * Muestra un toast.
 * @param {string} mensaje
 * @param {{icono?:boolean, ms?:number}} [opts]
 */
export function toast(mensaje, { icono = true, ms = 2200 } = {}) {
  const el = asegurarNodo();
  el.innerHTML = (icono ? `<span class="toast__ic">${ICON_OK}</span>` : '') +
    `<span class="toast__msg"></span>`;
  el.querySelector('.toast__msg').textContent = mensaje;

  // reinicia animación
  el.classList.remove('is-show');
  void el.offsetWidth;
  el.classList.add('is-show');

  clearTimeout(timer);
  timer = setTimeout(() => el.classList.remove('is-show'), ms);
}
