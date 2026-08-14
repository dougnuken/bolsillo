/* ============================================================
   olbo · ingesta-corte.js
   Puente entre el LECTOR de extractos (extracto-pdf.js) y el snapshot de
   CORTE (diferidos.js). Toma el resultado normalizado del lector + la ficha
   del crédito al que el usuario asoció el documento y arma un corte listo
   para guardar en el store `cortes`.

   PURA (salvo `now`, inyectable) → testeable en Node. No toca DB ni red.
   ============================================================ */

import { crearCorte } from './diferidos.js';

/**
 * Construye un corte a partir del resultado del lector. Devuelve
 * `{ ok:true, corte }` o `{ ok:false, motivo }` con un motivo accionable.
 *
 * @param {object} r         resultado de analizarExtractoImagenes (estado 'ok')
 * @param {{entidad:string, producto:string, moneda?:string}} ficha
 * @param {{now?:Date}} [opts]
 */
export function corteDesdeExtracto(r, ficha = {}, { now } = {}) {
  if (!r || r.estado !== 'ok') return { ok: false, motivo: 'lectura' };
  if (!r.corteISO) return { ok: false, motivo: 'sin-fecha-corte' };
  if (!Array.isArray(r.diferidos) || r.diferidos.length === 0) return { ok: false, motivo: 'sin-diferidos' };

  const entidad = typeof ficha.entidad === 'string' ? ficha.entidad.trim() : '';
  const producto = typeof ficha.producto === 'string' ? ficha.producto.trim() : '';
  const moneda = typeof ficha.moneda === 'string' && ficha.moneda.trim() ? ficha.moneda.trim() : 'COP';
  if (!entidad || !producto) return { ok: false, motivo: 'sin-ficha' };

  const corte = crearCorte({
    entidad,
    producto,
    moneda,
    corte: r.corteISO,
    fechaLimitePago: r.limiteISO || '',
    resumen: {
      pagoTotal: r.total ?? null,
      saldo: r.saldo ?? null,
      pagoAPlazos: r.pagoAPlazos ?? null,
      pagoMinimo: r.pagoMinimo ?? null,
      intereses: r.intereses ?? null,
    },
    diferidos: r.diferidos,
  }, { now });

  return { ok: true, corte };
}
