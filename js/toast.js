/* ============================================================
   Bolsillo · toast.js
   Aviso efímero, no bloqueante. Un solo nodo reutilizado.
   Sin estilos inline (CSP style-src 'self'): todo por clases.
   ============================================================ */

import { hapticOk, hapticError } from './haptics.js';

let nodo = null;
let timer = null;
let salida = null;

/* Debe cubrir la transición de .toast.is-leaving (--dur = 240ms). Se le da un
   respiro para que la clase no se retire a mitad del movimiento. */
const DUR_SALIDA = 320;

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
 * @param {{icono?:boolean, ms?:number, tipo?:'ok'|'error'|'info'}} [opts]
 *   tipo por defecto: 'ok' (verde) si hay ícono; 'info' (neutro) si no.
 */
export function toast(mensaje, { icono = true, ms = 2200, tipo } = {}) {
  const t = tipo || (icono ? 'ok' : 'info');
  const el = asegurarNodo();
  el.className = 'toast toast--' + t;   // resetea variante e is-leaving
  clearTimeout(salida);                 // un aviso nuevo cancela la salida del anterior
  el.innerHTML = (icono ? `<span class="toast__ic">${ICON_OK}</span>` : '') +
    `<span class="toast__msg"></span>`;
  el.querySelector('.toast__msg').textContent = mensaje;

  // reinicia animación
  void el.offsetWidth;
  el.classList.add('is-show');
  // El aviso ocupa el sitio del dock: la bandera hace que el bloque inferior
  // (barra + FAB) baje para dejárselo. Ver body.has-toast en components.css.
  document.body.classList.add('has-toast');

  (t === 'error' ? hapticError : hapticOk)();

  clearTimeout(timer);
  timer = setTimeout(() => {
    // La barra vuelve a su sitio y el toast sale hacia ARRIBA, como empujado
    // por ella. Las dos cosas arrancan en el mismo frame: es un solo gesto.
    document.body.classList.remove('has-toast');
    el.classList.remove('is-show');
    el.classList.add('is-leaving');
    clearTimeout(salida);
    salida = setTimeout(() => el.classList.remove('is-leaving'), DUR_SALIDA);
  }, ms);
}
