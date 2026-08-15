/* ============================================================
   olbo · simulador.js — ¿cuánto me cuesta REALMENTE comprar a cuotas?

   Responde la pregunta que originó este módulo: "compro algo de $4.000.000 y
   lo pongo a 24 cuotas — ¿cuánto pago al mes, cuánto de eso es interés y
   cuánto termino pagando en total?".

   Sistema FRANCÉS (cuota fija), que es como liquidan las tarjetas y los
   créditos de consumo en Colombia: la cuota no cambia, pero al principio casi
   todo es interés y solo al final se come el capital. Por eso la tabla mes a
   mes importa tanto como el total: es donde se ve que las primeras cuotas
   apenas bajan la deuda.

   TODO ES PURO Y TESTEABLE. Nada de DOM, nada de DB.
   ============================================================ */

import { tasaEAaMV } from './model.js';

/** Plazos que se ofrecen al comparar, de menor a mayor. */
export const PLAZOS_SUGERIDOS = Object.freeze([1, 3, 6, 12, 18, 24, 36, 48]);

/** Tope de cuotas que aceptamos simular (más allá no lo ofrece ningún banco). */
export const MAX_CUOTAS = 120;

const num = (v, def = 0) => (Number.isFinite(Number(v)) ? Number(v) : def);
const entero = (v) => Math.round(num(v, 0));

/** Tasa mensual en DECIMAL a partir de la efectiva anual en porcentaje. PURA. */
export function tasaMensualDecimal(tasaEA) {
  const ea = num(tasaEA, 0);
  if (ea <= 0) return 0;
  return tasaEAaMV(ea) / 100;
}

/**
 * FACTOR de cuota: cuota = capital × factor. PURA.
 *
 * Existe para que la conciencia pueda simular cualquier monto sin ejecutar
 * código: se le entregan los factores ya calculados de su tasa real y solo
 * tiene que multiplicar. Un modelo de lenguaje multiplica bien; elevar
 * (1+i) a la −24 de cabeza, no. Así las cifras que dice son exactas.
 */
export function factorCuota(tasaEA, cuotas) {
  const n = entero(cuotas);
  if (n < 1) return 0;
  const i = tasaMensualDecimal(tasaEA);
  if (i <= 0) return 1 / n;
  return i / (1 - Math.pow(1 + i, -n));
}

/**
 * Cuota fija del sistema francés, en pesos enteros. PURA.
 * Con tasa 0 es un simple reparto del capital.
 * @param {number} capital
 * @param {number} tasaEA  efectiva anual, en %
 * @param {number} cuotas  número de meses
 * @returns {number} cuota mensual redondeada
 */
export function cuotaFija(capital, tasaEA, cuotas) {
  const k = num(capital, 0);
  const n = entero(cuotas);
  if (k <= 0 || n < 1) return 0;
  return Math.round(k * factorCuota(tasaEA, n));
}

/**
 * Tabla de factores para los plazos típicos, lista para meter en el brief. PURA.
 * @returns {Array<{cuotas:number, factor:number, porCadaMillon:number}>}
 */
export function tablaFactores(tasaEA, plazos = PLAZOS_SUGERIDOS) {
  const lista = Array.isArray(plazos) && plazos.length ? plazos : PLAZOS_SUGERIDOS;
  return Object.freeze(lista
    .map((n) => entero(n))
    .filter((n) => n >= 1 && n <= MAX_CUOTAS)
    .sort((a, b) => a - b)
    .map((n) => {
      const factor = factorCuota(tasaEA, n);
      return Object.freeze({
        cuotas: n,
        factor,
        // Ancla legible: lo que se paga al mes por cada millón financiado.
        porCadaMillon: Math.round(1000000 * factor),
      });
    }));
}

/**
 * Simula la compra completa.
 *
 * La última cuota se AJUSTA para que el saldo cierre en cero exacto: con pesos
 * enteros, arrastrar el redondeo de la cuota durante 24 meses deja un descuadre
 * de varios miles, y un simulador que no cuadra no sirve para decidir.
 *
 * @param {{capital:number, tasaEA:number, cuotas:number}} datos
 * @returns {{
 *   capital:number, tasaEA:number, cuotas:number, tasaMensual:number,
 *   cuotaMensual:number, ultimaCuota:number,
 *   totalPagado:number, totalIntereses:number, sobrecosto:number,
 *   tabla:Array<{mes:number, cuota:number, interes:number, capital:number, saldo:number}>
 * }}
 */
export function simularCompra({ capital, tasaEA, cuotas } = {}) {
  const k = Math.max(0, entero(capital));
  const n = Math.min(MAX_CUOTAS, Math.max(0, entero(cuotas)));
  const ea = Math.max(0, num(tasaEA, 0));
  const i = tasaMensualDecimal(ea);

  const vacio = Object.freeze({
    capital: k, tasaEA: ea, cuotas: n, tasaMensual: i,
    cuotaMensual: 0, ultimaCuota: 0,
    totalPagado: 0, totalIntereses: 0, sobrecosto: 0,
    tabla: Object.freeze([]),
  });
  if (k <= 0 || n < 1) return vacio;

  const cuota = cuotaFija(k, ea, n);
  const tabla = [];
  let saldo = k;
  let totalPagado = 0;
  let totalIntereses = 0;

  for (let mes = 1; mes <= n; mes += 1) {
    const interes = Math.round(saldo * i);
    const esUltima = mes === n;
    // En la última se paga lo que quede: capital pendiente + su interés.
    const pago = esUltima ? saldo + interes : Math.min(cuota, saldo + interes);
    const aCapital = pago - interes;
    saldo = Math.max(0, saldo - aCapital);
    totalPagado += pago;
    totalIntereses += interes;
    tabla.push(Object.freeze({ mes, cuota: pago, interes, capital: aCapital, saldo }));
    if (saldo <= 0 && !esUltima) break;   // se saldó antes (tasa 0 con redondeo)
  }

  return Object.freeze({
    capital: k,
    tasaEA: ea,
    cuotas: n,
    tasaMensual: i,
    cuotaMensual: cuota,
    ultimaCuota: tabla.length ? tabla[tabla.length - 1].cuota : 0,
    totalPagado,
    totalIntereses,
    /* Cuánto MÁS pagas por no comprarlo de contado, en % del precio. Es el
       número que de verdad abre los ojos: "24 cuotas = 31% más caro". */
    sobrecosto: k > 0 ? (totalIntereses / k) * 100 : 0,
    tabla: Object.freeze(tabla),
  });
}

/**
 * Compara la misma compra a varios plazos. PURA.
 * Ordena de menor a mayor plazo y marca cuál es el más barato en intereses
 * (siempre el más corto) para que la comparación se lea sola.
 * @param {{capital:number, tasaEA:number, plazos?:number[]}} datos
 */
export function compararPlazos({ capital, tasaEA, plazos } = {}) {
  const lista = Array.isArray(plazos) && plazos.length ? plazos : PLAZOS_SUGERIDOS;
  const opciones = lista
    .map((n) => entero(n))
    .filter((n) => n >= 1 && n <= MAX_CUOTAS)
    .sort((a, b) => a - b)
    .map((n) => {
      const s = simularCompra({ capital, tasaEA, cuotas: n });
      return Object.freeze({
        cuotas: n,
        cuotaMensual: s.cuotaMensual,
        totalPagado: s.totalPagado,
        totalIntereses: s.totalIntereses,
        sobrecosto: s.sobrecosto,
      });
    })
    .filter((o) => o.cuotaMensual > 0);

  return Object.freeze(opciones);
}

/**
 * Cuánto cuesta ESTIRAR el plazo: la diferencia entre dos opciones. PURA.
 * Sirve para la frase que de verdad importa —"pasar de 12 a 24 cuotas te baja
 * la cuota $X al mes, pero te cuesta $Y más en total"—, que es la decisión
 * real que toma alguien parado frente al datáfono.
 */
export function costoDeEstirar({ capital, tasaEA, de, a } = {}) {
  const corto = simularCompra({ capital, tasaEA, cuotas: de });
  const largo = simularCompra({ capital, tasaEA, cuotas: a });
  if (!corto.cuotaMensual || !largo.cuotaMensual) return null;
  return Object.freeze({
    de: corto.cuotas,
    a: largo.cuotas,
    alivioMensual: corto.cuotaMensual - largo.cuotaMensual,
    costoExtra: largo.totalIntereses - corto.totalIntereses,
    totalCorto: corto.totalPagado,
    totalLargo: largo.totalPagado,
  });
}
