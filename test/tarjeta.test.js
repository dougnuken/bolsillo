/* ============================================================
   Bolsillo · test/tarjeta.test.js
   Ciclo de la tarjeta de crédito (resumenTarjeta): próximo corte,
   fecha de pago, acumulado del ciclo (contado en ventana + cuota del
   mes) y cuotas activas. AAA, "hoy" siempre inyectado.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { resumenTarjeta } from '../js/budget.js';
import { crearMovimiento } from '../js/model.js';

function cargo(fecha, monto, over = {}) {
  return crearMovimiento({ fecha, monto, tipo: 'gasto', cuenta: 'Platino BDO', categoria: 'ocio', ...over });
}

test('sin día de corte válido → null', () => {
  assert.equal(resumenTarjeta({ movimientos: [], cuenta: 'Platino BDO', hoy: '2026-07-10' }), null);
});

test('próximo corte: si ya pasó el corte del mes, es el mes siguiente', () => {
  const r = resumenTarjeta({ movimientos: [], cuenta: 'Platino BDO', corteDia: 5, limiteDia: 25, hoy: '2026-07-10' });
  assert.equal(r.corteISO, '2026-08-05');
  assert.equal(r.pagoISO, '2026-08-25');
});

test('próximo corte: si aún no pasó, es este mes', () => {
  const r = resumenTarjeta({ movimientos: [], cuenta: 'Platino BDO', corteDia: 5, limiteDia: 25, hoy: '2026-07-03' });
  assert.equal(r.corteISO, '2026-07-05');
  assert.equal(r.pagoISO, '2026-07-25');
});

test('acumulado: contado dentro de la ventana del ciclo cuenta; fuera no', () => {
  // hoy 07-10, corte 5 → ciclo (2026-07-05, 2026-08-05]
  const movs = [
    cargo('2026-07-08', 100_000),  // dentro → cuenta
    cargo('2026-07-03', 50_000),   // antes del corte 07-05 (ciclo anterior) → no
    crearMovimiento({ fecha: '2026-07-08', monto: 99_000, tipo: 'gasto', cuenta: 'Efectivo', categoria: 'ocio' }), // otra cuenta
  ];
  const r = resumenTarjeta({ movimientos: movs, cuenta: 'Platino BDO', corteDia: 5, limiteDia: 25, hoy: '2026-07-10' });
  assert.equal(r.acumulado, 100_000);
});

test('acumulado: una compra a cuotas aporta su cuota, no el total', () => {
  const movs = [cargo('2026-07-08', 600_000, { cuotas: 6 })]; // 100.000/mes
  const r = resumenTarjeta({ movimientos: movs, cuenta: 'Platino BDO', corteDia: 5, limiteDia: 25, hoy: '2026-07-10' });
  assert.equal(r.acumulado, 100_000);
  assert.equal(r.cuotasActivas, 1);
  assert.equal(r.cuotasMensual, 100_000);
});

test('pago: si el límite es menor que el corte, cae el mes siguiente', () => {
  const r = resumenTarjeta({ movimientos: [], cuenta: 'Platino BDO', corteDia: 25, limiteDia: 10, hoy: '2026-07-10' });
  assert.equal(r.corteISO, '2026-07-25'); // hoy 10 < corte 25 → este mes
  assert.equal(r.pagoISO, '2026-08-10');  // límite 10 < corte 25 → mes siguiente
});

test('días para corte y para pago', () => {
  const r = resumenTarjeta({ movimientos: [], cuenta: 'Platino BDO', corteDia: 5, limiteDia: 25, hoy: '2026-07-10' });
  assert.equal(r.diasParaCorte, 26); // 07-10 → 08-05
  assert.equal(r.diasParaPago, 46);  // 07-10 → 08-25
});

test('sin límite de pago: pagoISO y diasParaPago quedan en null', () => {
  const r = resumenTarjeta({ movimientos: [], cuenta: 'Platino BDO', corteDia: 5, hoy: '2026-07-10' });
  assert.equal(r.pagoISO, null);
  assert.equal(r.diasParaPago, null);
});

test('clamp de día: corte 31 en un mes de 30 cae en el 30', () => {
  const r = resumenTarjeta({ movimientos: [], cuenta: 'Platino BDO', corteDia: 31, hoy: '2026-06-15' });
  assert.equal(r.corteISO, '2026-06-30');
});
