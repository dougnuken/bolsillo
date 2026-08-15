/* ============================================================
   Bolsillo · prestamos.js
   Dominio de PRÉSTAMOS: dinero que TÚ prestaste y alguien te debe
   (cuentas por cobrar). PURO y testeable — cero IndexedDB, cero DOM.

   Modelo mental (definido con el usuario):
   · El préstamo NO descuenta "Tu dinero": el desembolso ya se registra
     como gasto aparte. Aquí solo se lleva el SALDO que te deben.
   · Cada ABONO (pago recibido) baja ese saldo. En la capa de vista, el
     abono además crea un movimiento tipo:'ingreso' para que "Tu dinero"
     suba — pero eso vive en la vista, no aquí.
   ============================================================ */

import { tasaEAaMV } from './model.js';

const entero = (v) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : NaN;
};
const esTexto = (v) => typeof v === 'string' && v.trim() !== '';
const nowISO = (now) => (now instanceof Date ? now : new Date()).toISOString();
const hoyISO = (now) => nowISO(now).slice(0, 10);
const nuevoId = () => 'pre-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);

/** Normaliza un abono suelto {monto, fecha}. Descarta los inválidos (→ null). */
function sanearAbono(a, now) {
  if (!a || typeof a !== 'object') return null;
  const monto = entero(a.monto);
  if (!Number.isInteger(monto) || monto <= 0) return null;
  const fecha = esTexto(a.fecha) ? a.fecha.trim() : hoyISO(now);
  return Object.freeze({ monto, fecha });
}

/**
 * Crea (o rehidrata) un préstamo inmutable y validado.
 * @param {object} datos {persona, concepto, monto, fecha?, abonos?, id?, creadoEn?}
 * @param {{now?: Date}} [opts]
 * @returns {Readonly<object>}
 * @throws {Error} si falta persona o el monto no es válido (fail-fast).
 */
export function crearPrestamo(datos = {}, { now = new Date() } = {}) {
  // Tasa opcional (% E.A.) para préstamos con interés. null = sin interés.
  const tasaCruda = datos.tasaEA == null || datos.tasaEA === '' ? null : Number(datos.tasaEA);
  const base = {
    persona: typeof datos.persona === 'string' ? datos.persona.trim() : '',
    concepto: typeof datos.concepto === 'string' ? datos.concepto.trim() : '',
    monto: entero(datos.monto),
    fecha: esTexto(datos.fecha) ? datos.fecha.trim() : hoyISO(now),
    // Dirección de la deuda. RETROCOMPAT: sin el campo = 'me-deben' (lo de antes).
    direccion: datos.direccion === 'debo' ? 'debo' : 'me-deben',
    tasaEA: Number.isFinite(tasaCruda) && tasaCruda >= 0 ? tasaCruda : null,
    abonos: Array.isArray(datos.abonos)
      ? datos.abonos.map((a) => sanearAbono(a, now)).filter(Boolean)
      : [],
  };
  const v = validarPrestamo(base);
  if (!v.ok) throw new Error('Préstamo inválido: ' + v.errores.join(' '));
  const ts = nowISO(now);
  return Object.freeze({
    id: datos.id ?? nuevoId(),
    ...base,
    abonos: Object.freeze(base.abonos),
    creadoEn: esTexto(datos.creadoEn) ? datos.creadoEn : ts,
    actualizadoEn: ts,
  });
}

export function validarPrestamo(obj = {}) {
  const errores = [];
  if (!obj || typeof obj !== 'object') return { ok: false, errores: ['El préstamo no es un objeto.'] };
  if (!esTexto(obj.persona)) errores.push('¿Con quién es? El nombre es obligatorio.');
  if (!Number.isInteger(obj.monto) || obj.monto <= 0) errores.push('El monto debe ser un entero de pesos mayor a 0.');
  if (obj.direccion != null && obj.direccion !== 'me-deben' && obj.direccion !== 'debo') errores.push('La dirección debe ser me-deben o debo.');
  if (obj.tasaEA != null && (!Number.isFinite(obj.tasaEA) || obj.tasaEA < 0)) errores.push('La tasa debe ser un número ≥ 0, o quedar vacía.');
  return errores.length ? { ok: false, errores } : { ok: true, value: obj };
}

/** Suma de todos los abonos recibidos. */
export function totalAbonado(prestamo) {
  const abonos = prestamo && Array.isArray(prestamo.abonos) ? prestamo.abonos : [];
  return abonos.reduce((s, a) => s + (Number.isInteger(a && a.monto) ? a.monto : 0), 0);
}

/** Lo que TODAVÍA te deben (nunca negativo). */
export function saldoPendiente(prestamo) {
  const monto = prestamo && Number.isInteger(prestamo.monto) ? prestamo.monto : 0;
  return Math.max(0, monto - totalAbonado(prestamo));
}

/** true si ya te pagaron todo. */
export function estaLiquidado(prestamo) {
  return saldoPendiente(prestamo) <= 0;
}

/** Fracción abonada [0..1] para la barra de progreso. */
export function fraccionAbonada(prestamo) {
  const monto = prestamo && Number.isInteger(prestamo.monto) ? prestamo.monto : 0;
  if (monto <= 0) return 0;
  return Math.max(0, Math.min(1, totalAbonado(prestamo) / monto));
}

/**
 * Registra un abono. Lo APLICADO se recorta al saldo (no sobrepasa la deuda).
 * @returns {Readonly<object>} el préstamo con el abono agregado.
 * @throws {Error} si el abono no es válido o el préstamo ya está saldado.
 */
export function agregarAbono(prestamo, datosAbono = {}, { now = new Date() } = {}) {
  const monto = entero(datosAbono.monto);
  if (!Number.isInteger(monto) || monto <= 0) throw new Error('El abono debe ser un entero de pesos mayor a 0.');
  const saldo = saldoPendiente(prestamo);
  if (saldo <= 0) throw new Error('Este préstamo ya está saldado.');
  const aplicado = Math.min(monto, saldo); // nunca deja el saldo en negativo
  const abono = Object.freeze({ monto: aplicado, fecha: esTexto(datosAbono.fecha) ? datosAbono.fecha.trim() : hoyISO(now) });
  const abonos = Array.isArray(prestamo.abonos) ? prestamo.abonos : [];
  return Object.freeze({
    ...prestamo,
    abonos: Object.freeze([...abonos, abono]),
    actualizadoEn: nowISO(now),
  });
}

/** Total por cobrar de una lista (suma de saldos pendientes). */
/**
 * Cuánto rinde un préstamo con interés. PURA.
 *
 * La tasa se pacta como % E.A., así que el interés en pesos depende del PLAZO,
 * y un préstamo entre personas no lo tiene: se paga cuando se pueda. Por eso no
 * se inventa un plazo — se dan las dos referencias que sí son ciertas y dejan
 * dimensionar el favor: lo que rinde al mes y lo que rinde en un año.
 *
 * @returns {{mensual:number, anual:number}|null} null si falta monto o tasa
 */
export function interesEstimado(monto, tasaEA) {
  const m = Number(monto);
  const t = Number(tasaEA);
  if (!Number.isFinite(m) || m <= 0) return null;
  if (!Number.isFinite(t) || t <= 0) return null;
  return Object.freeze({
    mensual: Math.round(m * (tasaEAaMV(t) / 100)),
    anual: Math.round(m * (t / 100)),
  });
}

export function totalPorCobrar(prestamos) {
  return (Array.isArray(prestamos) ? prestamos : []).reduce((s, p) => s + saldoPendiente(p), 0);
}

/** ¿Es dinero que YO debo? (retrocompat: sin campo = me deben). PURA. */
export function esDeuda(p) {
  return !!p && p.direccion === 'debo';
}

/** Filtra por dirección: 'me-deben' (default) o 'debo'. PURA. */
export function porDireccion(prestamos, direccion = 'me-deben') {
  const lista = Array.isArray(prestamos) ? prestamos.filter(Boolean) : [];
  return direccion === 'debo' ? lista.filter(esDeuda) : lista.filter((p) => !esDeuda(p));
}

/** Separa activos (con saldo) de saldados y da el total por cobrar. */
export function resumenPrestamos(prestamos) {
  const lista = Array.isArray(prestamos) ? prestamos.filter(Boolean) : [];
  const activos = lista.filter((p) => !estaLiquidado(p));
  const saldados = lista.filter((p) => estaLiquidado(p));
  // activos primero por mayor saldo; saldados por más reciente.
  activos.sort((a, b) => saldoPendiente(b) - saldoPendiente(a));
  return { activos, saldados, totalPorCobrar: totalPorCobrar(activos) };
}
