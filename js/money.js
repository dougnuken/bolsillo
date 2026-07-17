/* ============================================================
   Bolsillo · money.js
   Dinero en pesos colombianos (COP) como ENTEROS SIEMPRE.
   Nunca floats: en COP corriente no se usan centavos.
   Funciones puras, sin estado. No toca el DOM ni datos externos.
   ============================================================ */

const MULT_MIL = 1_000;
const MULT_MILLON = 1_000_000;
const MENOS = '−'; // signo menos tipográfico (−), no guion

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
