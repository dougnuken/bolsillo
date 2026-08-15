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
  // Basta con que traiga diferidos O consumos. Antes se exigían diferidos, así
  // que un extracto de puras compras de contado se descartaba entero y con él
  // se perdían los consumos del ciclo.
  const hayDiferidos = Array.isArray(r.diferidos) && r.diferidos.length > 0;
  const hayConsumos = Array.isArray(r.consumos) && r.consumos.length > 0;
  if (!hayDiferidos && !hayConsumos) return { ok: false, motivo: 'sin-diferidos' };

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
    diferidos: hayDiferidos ? r.diferidos : [],
    // Solo lectura: alimentan el "en qué se te fue" de la conciencia y NO
    // entran al cálculo del mes (para eso están los movimientos de la app).
    consumos: hayConsumos ? r.consumos : [],
  }, { now });

  return { ok: true, corte };
}
