/* ============================================================
   Bolsillo · money-input.js
   Cablea un <input> de dinero para que se enmascare por miles
   MIENTRAS se escribe (17000000 → 17.000.000).

   Único lugar del proyecto que hace esto: los formularios solo
   marcan el campo con `data-monto` y llaman a bindMontosVivos().
   El formateo es de money.js; aquí solo va el DOM.

   Lo que se GUARDA sigue siendo entero COP vía parseCOP: esta
   capa es presentación.
   ============================================================ */

import { formatearMontoEnVivo, borrarDigitoAtras } from './money.js';

const MARCA = 'montoVivoOn'; // data-monto-vivo-on: evita cablear dos veces

/** Escribe texto + cursor en el input. Solo toca el valor si cambió. */
function aplicar(input, { texto, caret }) {
  if (input.value !== texto) input.value = texto;
  try {
    input.setSelectionRange(caret, caret);
  } catch (err) {
    // Algunos tipos de input no exponen selección: el formato ya quedó puesto.
    console.debug('[Bolsillo] sin selección en campo de monto:', err.message);
  }
}

/**
 * Cablea un campo de monto. Idempotente.
 * @param {HTMLInputElement} input
 * @returns {HTMLInputElement|null}
 */
export function bindMontoVivo(input) {
  if (!input || input.dataset[MARCA] === 'si') return input || null;
  input.dataset[MARCA] = 'si';

  // Teclado numérico en iOS; el tamaño ≥16px lo pone .field__input (--fs-input).
  input.setAttribute('inputmode', 'numeric');
  input.setAttribute('autocomplete', 'off');

  // Valor precargado (viene de formatCOP, pero puede traer basura de un respaldo).
  if (input.value) aplicar(input, formatearMontoEnVivo(input.value, null));

  // Retroceso sobre un separador: borra el DÍGITO anterior, no el punto.
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Backspace') return;
    const { selectionStart: ini, selectionEnd: fin, value } = input;
    if (ini == null || ini !== fin || ini === 0) return; // hay selección o está al inicio
    if (value[ini - 1] >= '0' && value[ini - 1] <= '9') return; // ya es dígito: nativo
    e.preventDefault();
    aplicar(input, borrarDigitoAtras(value, ini));
  });

  // Tecleo, pegado, cortado y autocompletado pasan todos por aquí.
  input.addEventListener('input', () => {
    aplicar(input, formatearMontoEnVivo(input.value, input.selectionStart));
  });

  return input;
}

/**
 * Cablea todos los `input[data-monto]` que haya dentro de `raiz`.
 * @param {ParentNode} raiz
 * @returns {number} cuántos campos quedaron cableados
 */
export function bindMontosVivos(raiz) {
  if (!raiz || typeof raiz.querySelectorAll !== 'function') return 0;
  const campos = raiz.querySelectorAll('input[data-monto]');
  campos.forEach(bindMontoVivo);
  return campos.length;
}
