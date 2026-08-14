/* ============================================================
   olbo · test/ingesta-corte.test.js
   Puente lector → corte: mapea el resultado del lector a un snapshot
   guardable, o dice el motivo por el que no se puede. Datos DEMO (ficticios).
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { corteDesdeExtracto } from '../js/ingesta-corte.js';

const LECTURA_OK = {
  estado: 'ok',
  corteISO: '2026-07-31',
  limiteISO: '2026-08-18',
  total: 3000000,
  saldo: 3000000,
  pagoAPlazos: 450000,
  pagoMinimo: 90000,
  intereses: 50000,
  diferidos: [
    { descripcion: 'TIENDA*DEMO', compte: '000001', fecha: '2026-07-09', plazo: 6, cuotasPendientes: 6, saldoCapital: 400000, tasaEA: 28.02 },
    { descripcion: 'ALMACEN*DEMO', compte: '000002', fecha: '2026-07-24', plazo: 36, cuotasPendientes: 36, saldoCapital: 2000000, tasaEA: 28.02 },
  ],
};
const FICHA = { entidad: 'Banco Demo', producto: 'Tarjeta Demo' };

test('corteDesdeExtracto: arma un corte válido a partir de la lectura + la ficha', () => {
  const { ok, corte } = corteDesdeExtracto(LECTURA_OK, FICHA, { now: new Date('2026-08-14T10:00:00Z') });
  assert.equal(ok, true);
  assert.equal(corte.entidad, 'Banco Demo');
  assert.equal(corte.moneda, 'COP');
  assert.equal(corte.corte, '2026-07-31');
  assert.equal(corte.fechaLimitePago, '2026-08-18');
  assert.equal(corte.diferidos.length, 2);
  assert.equal(corte.resumen.pagoAPlazos, 450000);
  assert.equal(corte.totalDiferido, 400000 + 2000000);
});

test('corteDesdeExtracto: sin fecha de corte → no se puede (motivo accionable)', () => {
  const r = corteDesdeExtracto({ ...LECTURA_OK, corteISO: null }, FICHA);
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'sin-fecha-corte');
});

test('corteDesdeExtracto: sin diferidos → no se guarda un corte vacío', () => {
  const r = corteDesdeExtracto({ ...LECTURA_OK, diferidos: [] }, FICHA);
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'sin-diferidos');
});

test('corteDesdeExtracto: sin ficha (entidad/producto) → sin-ficha', () => {
  const r = corteDesdeExtracto(LECTURA_OK, { entidad: '', producto: '' });
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'sin-ficha');
});

test('corteDesdeExtracto: lectura no ok → motivo lectura', () => {
  assert.equal(corteDesdeExtracto({ estado: 'error' }, FICHA).motivo, 'lectura');
});
