/* ============================================================
   Bolsillo · test/cuotas.test.js
   Modelo A de cuotas: una compra a N cuotas pesa monto/N en cada uno
   de los N meses desde la compra (porcionEnMes) y así se refleja en
   calcularEstado y resumenPersonas. AAA, "hoy" siempre inyectado.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  porcionEnMes, calcularEstado, resumenPersonas, TOPES_PERSONA_DEFAULT,
} from '../js/budget.js';
import { crearMovimiento } from '../js/model.js';

function gasto(fecha, monto, over = {}) {
  return crearMovimiento({ fecha, monto, tipo: 'gasto', cuenta: 'Platino BDO', categoria: 'ocio', ...over });
}

/* ---- porcionEnMes ---- */

test('compra normal: monto completo en su mes, 0 en otros', () => {
  const m = gasto('2026-07-10', 90_000);
  assert.equal(porcionEnMes(m, 2026, 7), 90_000);
  assert.equal(porcionEnMes(m, 2026, 8), 0);
  assert.equal(porcionEnMes(m, 2026, 6), 0);
});

test('compra a 3 cuotas: monto/3 en los 3 meses desde la compra', () => {
  const m = gasto('2026-07-10', 90_000, { cuotas: 3 });
  assert.equal(porcionEnMes(m, 2026, 7), 30_000);
  assert.equal(porcionEnMes(m, 2026, 8), 30_000);
  assert.equal(porcionEnMes(m, 2026, 9), 30_000);
  assert.equal(porcionEnMes(m, 2026, 10), 0); // ya terminó
  assert.equal(porcionEnMes(m, 2026, 6), 0);  // antes de la compra
});

test('cuotas cruzan el fin de año', () => {
  const m = gasto('2026-12-15', 90_000, { cuotas: 3 });
  assert.equal(porcionEnMes(m, 2026, 12), 30_000);
  assert.equal(porcionEnMes(m, 2027, 1), 30_000);
  assert.equal(porcionEnMes(m, 2027, 2), 30_000);
  assert.equal(porcionEnMes(m, 2027, 3), 0);
});

/* ---- calcularEstado ---- */

const base = { ingresoEmpleo: 3_000_000, recurrentes: [], creditos: [] };

test('una compra a cuotas de este mes pesa solo su cuota en el ritmo', () => {
  const movs = [gasto('2026-07-15', 600_000, { cuotas: 6 })]; // 100.000/mes
  const est = calcularEstado({ ...base, movimientos: movs, hoy: '2026-07-15' });
  assert.equal(est.variableGastado, 100_000);
});

test('una cuota de un mes anterior sigue pesando este mes', () => {
  const movs = [gasto('2026-05-10', 600_000, { cuotas: 6 })]; // mayo..octubre
  const est = calcularEstado({ ...base, movimientos: movs, hoy: '2026-07-15' }); // julio = offset 2
  assert.equal(est.variableGastado, 100_000);
});

test('fuera de la ventana de cuotas no pesa nada', () => {
  const movs = [gasto('2026-01-10', 600_000, { cuotas: 6 })]; // enero..junio
  const est = calcularEstado({ ...base, movimientos: movs, hoy: '2026-07-15' }); // julio: ya pasó
  assert.equal(est.variableGastado, 0);
});

test('normal + cuota suman su porción del mes', () => {
  const movs = [gasto('2026-07-05', 50_000), gasto('2026-07-15', 600_000, { cuotas: 6 })];
  const est = calcularEstado({ ...base, movimientos: movs, hoy: '2026-07-20' });
  assert.equal(est.variableGastado, 150_000); // 50.000 + 100.000
});

test('porCategoria reparte la cuota (no el total)', () => {
  const movs = [gasto('2026-07-15', 600_000, { cuotas: 6, categoria: 'ocio' })];
  const est = calcularEstado({ ...base, movimientos: movs, hoy: '2026-07-15' });
  const ocio = est.porCategoria.find((c) => c.categoriaId === 'ocio');
  assert.equal(ocio.total, 100_000);
});

/* ---- resumenPersonas ---- */

test('el gasto por persona también reparte la cuota', () => {
  const movs = [crearMovimiento({ fecha: '2026-07-15', monto: 600_000, tipo: 'gasto', cuenta: 'Platino BDO', categoria: 'persona1', cuotas: 6 })];
  const vig = [{ id: 'persona1', label: 'Antonella' }];
  const res = resumenPersonas({ movimientos: movs, vigilados: vig, netoDelMes: 3_000_000, topes: TOPES_PERSONA_DEFAULT, hoy: '2026-07-15' });
  assert.equal(res[0].gastado, 100_000); // no 600.000
});

/* ---- crearMovimiento ---- */

test('crearMovimiento guarda cuotas y default 1', () => {
  assert.equal(gasto('2026-07-10', 10_000, { cuotas: 6 }).cuotas, 6);
  assert.equal(gasto('2026-07-10', 10_000).cuotas, 1);
  assert.equal(gasto('2026-07-10', 10_000, { cuotas: 0 }).cuotas, 1);   // inválido → 1
  assert.equal(gasto('2026-07-10', 10_000, { cuotas: 1.5 }).cuotas, 1); // no entero → 1
});
