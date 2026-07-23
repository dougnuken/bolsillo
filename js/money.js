/* ============================================================
   Bolsillo · money.js
   Dinero en pesos colombianos (COP) como ENTEROS SIEMPRE.
   Nunca floats: en COP corriente no se usan centavos.
   Funciones puras, sin estado. No toca el DOM ni datos externos.
   ============================================================ */

const MULT_MIL = 1_000;
const MULT_MILLON = 1_000_000;
const MENOS = '−'; // signo menos tipográfico (−), no guion

/** Tope de dígitos de un campo de monto (mismo que el teclado de Registrar). */
export const MAX_DIGITOS_MONTO = 12;

// Formateadores reutilizables (es-CO: punto de miles, coma decimal).
const nfGrupo = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const nfCompacto = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });

/**
 * Convierte lo que escribe un humano colombiano a un ENTERO de pesos.
 *
 * Reglas:
 *  - El punto es separador de MILES, nunca decimal ("15.000" = 15000).
 *  - La coma sólo es fracción cuando acompaña un sufijo k/mil/m ("1,5k" = 1500).
 *  - Sufijos: k/mil = ×1.000; m/millón/millones = ×1.000.000.
 *  - Tolera "$", espacios sueltos y mayúsculas.
 *  - Entrada inválida o vacía => null (nunca 0, nunca throw).
 *
 * @param {string|number} input
 * @returns {number|null} entero de pesos, o null si no se pudo interpretar
 */
export function parseCOP(input) {
  if (input == null) return null;
  if (typeof input === 'number') {
    return Number.isFinite(input) ? Math.round(input) : null;
  }
  if (typeof input !== 'string') return null;

  let s = input.trim().toLowerCase();
  if (s === '') return null;
  s = s.replace(/\$/g, ' ').trim(); // quita símbolo de moneda
  if (s === '') return null;

  // Detecta sufijo multiplicador. Orden importa: "millón" antes que "mil".
  let mult = 1;
  let m;
  if ((m = s.match(/^(.+?)\s*mill(?:o|ó)n(?:es)?\s*$/))) { mult = MULT_MILLON; s = m[1]; }
  else if ((m = s.match(/^(.+?)\s*m\s*$/)))              { mult = MULT_MILLON; s = m[1]; }
  else if ((m = s.match(/^(.+?)\s*mil\s*$/)))            { mult = MULT_MIL;    s = m[1]; }
  else if ((m = s.match(/^(.+?)\s*k\s*$/)))              { mult = MULT_MIL;    s = m[1]; }

  s = s.replace(/\s+/g, ''); // sin espacios internos
  if (s === '') return null;

  let valor;
  if (mult > 1) {
    // Modo sufijo: la coma es decimal; los puntos son miles.
    const numStr = s.includes(',')
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/\./g, '');
    if (!/^-?\d+(\.\d+)?$/.test(numStr)) return null;
    valor = parseFloat(numStr) * mult;
  } else {
    // Modo normal: los puntos son miles (fuera). Coma tolerada como decimal raro.
    const numStr = s.replace(/\./g, '').replace(',', '.');
    if (!/^-?\d+(\.\d+)?$/.test(numStr)) return null;
    valor = parseFloat(numStr);
  }

  if (!Number.isFinite(valor)) return null;
  return Math.round(valor);
}

/**
 * Formatea un entero de pesos a texto es-CO.
 *  - Base: 15000 => "$15.000".
 *  - signo:true => antepone "+" (positivos) o "−" (negativos).
 *  - compacto:true => "$15 K" / "$1,2 M" para cards.
 * Nunca lanza: entrada no numérica => "".
 *
 * @param {number} n entero de pesos
 * @param {{signo?:boolean, compacto?:boolean}} [opts]
 * @returns {string}
 */
export function formatCOP(n, { signo = false, compacto = false } = {}) {
  if (n == null || !Number.isFinite(n)) return '';
  const abs = Math.abs(n);
  const signStr = n < 0 ? MENOS : (signo ? '+' : '');

  if (compacto) {
    let val = abs;
    let unidad = '';
    if (abs >= MULT_MILLON) { val = abs / MULT_MILLON; unidad = 'M'; }
    else if (abs >= MULT_MIL) { val = abs / MULT_MIL; unidad = 'K'; }
    const num = (unidad ? nfCompacto : nfGrupo).format(val);
    return signStr + '$' + num + (unidad ? ' ' + unidad : '');
  }

  return signStr + '$' + nfGrupo.format(abs);
}

/**
 * Formatea el monto de un MOVIMIENTO con su signo según el tipo:
 *  - 'ingreso'            → positivo con '+'  ("+$50.000")
 *  - cualquier otro       → negativo con '−'  ("−$50.000")
 *    (gasto, pago: ambos salen de la cuenta).
 * El monto se guarda en positivo: aquí se toma su valor absoluto y se le
 * asigna el signo por tipo. PURA. Entrada no numérica => "".
 *
 * @param {number} monto entero de pesos (se usa |monto|)
 * @param {string} tipo  'ingreso' | 'gasto' | 'pago' | …
 * @returns {string}
 */
export function formatMovimiento(monto, tipo) {
  if (monto == null || !Number.isFinite(monto)) return '';
  const abs = Math.abs(monto);
  const firmado = tipo === 'ingreso' ? abs : -abs;
  return formatCOP(firmado, { signo: true });
}

/* ============================================================
   Máscara de miles EN VIVO (mientras se escribe)
   Núcleo PURO: no toca el DOM. El cableado del input vive en
   money-input.js. Todo el formateo se delega en formatCOP: aquí
   solo se decide QUÉ dígitos van y DÓNDE queda el cursor.
   ============================================================ */

/** Cuenta cuántos dígitos hay en texto[0, corte). PURA. */
function digitosAntesDe(texto, corte) {
  let n = 0;
  for (let i = 0; i < corte; i++) if (texto[i] >= '0' && texto[i] <= '9') n++;
  return n;
}

/** Índice del texto justo DESPUÉS del dígito n.º `n` (1-based). PURA. */
function posicionTrasDigitos(texto, n) {
  if (n <= 0) return 0;
  let vistos = 0;
  for (let i = 0; i < texto.length; i++) {
    if (texto[i] >= '0' && texto[i] <= '9') {
      vistos++;
      if (vistos === n) return i + 1;
    }
  }
  return texto.length;
}

/**
 * Arma el texto formateado a partir de dígitos sueltos y recoloca el cursor
 * tras la misma CANTIDAD DE DÍGITOS que tenía antes (no tras el mismo índice:
 * los separadores se mueven al reformatear).
 */
function componerMonto(bruto, digitosAntes) {
  const soloDigitos = String(bruto).replace(/\D/g, '');

  // Ceros a la izquierda: "017" => "17" (pero "0" solo se queda como "0").
  const sinCeros = soloDigitos.replace(/^0+(?=\d)/, '');
  const cerosQuitados = soloDigitos.length - sinCeros.length;

  const digitos = sinCeros.slice(0, MAX_DIGITOS_MONTO);
  if (digitos === '') return { texto: '', caret: 0 };

  let antes = digitosAntes - Math.min(cerosQuitados, digitosAntes);
  antes = Math.min(Math.max(antes, 0), digitos.length);

  const texto = formatCOP(parseInt(digitos, 10)).replace('$', '');
  return { texto, caret: posicionTrasDigitos(texto, antes) };
}

/** Normaliza el caret recibido contra la longitud real del texto. */
function caretSeguro(texto, caret) {
  if (caret == null || !Number.isFinite(caret)) return texto.length;
  return Math.min(Math.max(Math.trunc(caret), 0), texto.length);
}

/**
 * Formatea lo que hay en un campo de monto mientras se escribe.
 * Sirve igual para tecleo, pegado y autocompletado: se queda con los
 * dígitos, los agrupa por miles y devuelve dónde debe quedar el cursor.
 *
 * @param {string} texto valor crudo del campo
 * @param {number|null} [caret] posición del cursor (null = al final)
 * @returns {{texto:string, caret:number}}
 */
export function formatearMontoEnVivo(texto, caret = null) {
  const t = String(texto ?? '');
  return componerMonto(t, digitosAntesDe(t, caretSeguro(t, caret)));
}

/**
 * Borrado hacia atrás en el dominio de los DÍGITOS: si el cursor está
 * justo después de un separador, borra el dígito anterior (no el punto).
 * Así no se necesitan dos toques de retroceso.
 *
 * @param {string} texto valor crudo del campo
 * @param {number|null} [caret] posición del cursor (null = al final)
 * @returns {{texto:string, caret:number}}
 */
export function borrarDigitoAtras(texto, caret = null) {
  const t = String(texto ?? '');
  const antes = digitosAntesDe(t, caretSeguro(t, caret));
  const digitos = t.replace(/\D/g, '');
  if (antes === 0) return componerMonto(digitos, 0); // nada que borrar a la izquierda
  return componerMonto(digitos.slice(0, antes - 1) + digitos.slice(antes), antes - 1);
}
