/* ============================================================
   Bolsillo · recurring.js
   Materialización de gastos fijos (recurrentes) → movimientos.
   FUNCIÓN PURA e IDEMPOTENTE: no toca db ni DOM (testeable en Node).
   El enganche runtime (leer db, bulkPut) vive en app.js.
   ============================================================ */

import { crearMovimiento } from './model.js';

const pad2 = (n) => String(n).padStart(2, '0');

/** Último día del mes (mes es 1-based). Ej: (2026,2) → 28. */
function ultimoDiaDelMes(anio, mes) {
  return new Date(anio, mes, 0).getDate();
}

/** Fecha ISO YYYY-MM-DD del recurrente en ese mes, con clamp de día. */
function fechaEnMes(rec, anio, mes) {
  const dia = Math.min(rec.diaDelMes, ultimoDiaDelMes(anio, mes));
  return `${anio}-${pad2(mes)}-${pad2(dia)}`;
}

/** Prefijo YYYY-MM del mes objetivo. */
function prefijoMes(anio, mes) {
  return `${anio}-${pad2(mes)}`;
}

/** ¿Ya existe un movimiento de este recurrente para este mes? (idempotencia) */
function yaMaterializado(movimientos, recId, prefijo) {
  return movimientos.some(
    (m) => m && m.recurrenteId === recId && typeof m.fecha === 'string' && m.fecha.startsWith(prefijo),
  );
}

/**
 * Calcula los NUEVOS movimientos a crear para (anio, mes).
 * Idempotente: nunca duplica lo ya materializado.
 *
 * Reglas:
 *  - Solo recurrentes activo:true.
 *  - Solo si la fecha del recurrente en el mes YA llegó (fecha <= hoy).
 *  - diaDelMes > días del mes → se usa el último día (clamp).
 *  - excepciones["YYYY-MM"] = {saltar:true} → no se materializa.
 *  - excepciones["YYYY-MM"] = {monto:X}    → se usa X en vez del base.
 *  - modo 'auto' → lista `auto` (crear directo).
 *  - modo 'confirmar' → lista `porConfirmar` (la UI decide).
 *
 * @param {object[]} recurrentes
 * @param {object[]} movimientosExistentes
 * @param {number} anio
 * @param {number} mes  1-based (1=enero)
 * @param {Date} [now]  inyectable para pruebas deterministas
 * @param {object} [config]  para derivar esHormiga (los fijos nunca lo son)
 * @returns {{auto: object[], porConfirmar: object[]}}
 */
export function materializarMes(recurrentes, movimientosExistentes, anio, mes, now = new Date(), config) {
  const auto = [];
  const porConfirmar = [];
  if (!Array.isArray(recurrentes) || !Array.isArray(movimientosExistentes)) {
    return { auto, porConfirmar };
  }

  const prefijo = prefijoMes(anio, mes);
  const hoyISO = now.toISOString().slice(0, 10);

  for (const rec of recurrentes) {
    if (!rec || rec.activo !== true) continue;

    const clave = prefijo; // llave de excepción "YYYY-MM"
    const excepcion = rec.excepciones && rec.excepciones[clave];
    if (excepcion && excepcion.saltar === true) continue;

    const fecha = fechaEnMes(rec, anio, mes);
    // Aún no llega la fecha del recurrente en este mes → no materializar.
    if (fecha > hoyISO) continue;

    // Ya existe → idempotencia.
    if (yaMaterializado(movimientosExistentes, rec.id, prefijo)) continue;

    const monto = excepcion && Number.isInteger(excepcion.monto) ? excepcion.monto : rec.monto;

    const mov = crearMovimiento(
      {
        fecha,
        monto,
        tipo: 'gasto',
        categoria: rec.categoria || '',
        comercio: rec.nombre || '',
        cuenta: rec.cuenta,
        fuente: 'recurrente',
        esFijo: true, // un gasto fijo nunca es hormiga
        recurrenteId: rec.id,
      },
      { now, config },
    );

    (rec.modo === 'auto' ? auto : porConfirmar).push(mov);
  }

  return { auto, porConfirmar };
}
