/* ============================================================
   Bolsillo · test/personas.test.js
   Motor del guardarraíl de gasto por persona/categoría vigilada.
   Node test runner, AAA, nombres en español. "hoy" siempre inyectado.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resumenPersonas,
  TOPES_PERSONA_DEFAULT,
  AVISO_PUNTOS_DEFAULT,
  VIGILADOS_DEFAULT,
} from '../js/budget.js';
import { crearMovimiento } from '../js/model.js';

const HOY = '2026-07-15';
const NETO = 3_000_000; // ingreso neto del mes

function gasto(monto, categoria, over = {}) {
  return crearMovimiento({ fecha: HOY, monto, tipo: 'gasto', cuenta: 'Efectivo', categoria, ...over });
}
const VIGILADOS = [
  { id: 'persona1', label: 'Antonella' },
  { id: 'persona2', label: 'Marley' },
  { id: 'persona3', label: 'Madre' },
  { id: 'yo', label: 'Yo' },
  { id: 'ocio', label: 'Ocio' },
];

function fila(res, id) {
  return res.find((f) => f.id === id);
}

test('suma el gasto del mes por categoría (fijo + variable)', () => {
  // Arrange
  const movs = [
    gasto(200_000, 'persona1'),
    gasto(100_000, 'persona1', { esFijo: true }), // fijo también cuenta
    gasto(500_000, 'persona2'),
  ];
  // Act
  const res = resumenPersonas({ movimientos: movs, vigilados: VIGILADOS, netoDelMes: NETO, hoy: HOY });
  // Assert
  assert.equal(fila(res, 'persona1').gastado, 300_000);
  assert.equal(fila(res, 'persona2').gastado, 500_000);
  assert.equal(fila(res, 'persona3').gastado, 0);
});

test('calcula pctIngreso como fracción del neto', () => {
  const movs = [gasto(450_000, 'persona1')]; // 15% de 3.000.000
  const res = resumenPersonas({ movimientos: movs, vigilados: VIGILADOS, netoDelMes: NETO, hoy: HOY });
  assert.equal(fila(res, 'persona1').pctIngreso, 0.15);
});

test('verde cuando está lejos del tope', () => {
  const movs = [gasto(150_000, 'persona2')]; // 5% vs tope 10%
  const res = resumenPersonas({ movimientos: movs, vigilados: VIGILADOS, netoDelMes: NETO, hoy: HOY });
  assert.equal(fila(res, 'persona2').color, 'verde');
});

test('ámbar dentro de la banda de aviso (2 puntos antes del tope)', () => {
  // persona2 (Marley) tope 10% → ámbar desde 8%. 8.5% = 255.000
  const movs = [gasto(255_000, 'persona2')];
  const res = resumenPersonas({ movimientos: movs, vigilados: VIGILADOS, netoDelMes: NETO, hoy: HOY });
  const f = fila(res, 'persona2');
  assert.equal(f.color, 'ambar');
  assert.ok(f.faltanPuntos > 0 && f.faltanPuntos < AVISO_PUNTOS_DEFAULT);
});

test('rojo al alcanzar o pasar el tope', () => {
  // persona2 tope 10% → 10% exacto = 300.000 ⇒ rojo
  const movs = [gasto(300_000, 'persona2')];
  const res = resumenPersonas({ movimientos: movs, vigilados: VIGILADOS, netoDelMes: NETO, hoy: HOY });
  const f = fila(res, 'persona2');
  assert.equal(f.color, 'rojo');
  assert.ok(f.faltanPuntos <= 0);
});

test('respeta los topes por defecto por id (Antonella 15%, Marley 10%)', () => {
  // 12% de gasto: Antonella (tope 15%) sigue verde/ámbar; Marley (tope 10%) rojo
  const movs = [gasto(360_000, 'persona1'), gasto(360_000, 'persona2')]; // 12% cada uno
  const res = resumenPersonas({ movimientos: movs, vigilados: VIGILADOS, netoDelMes: NETO, hoy: HOY });
  assert.notEqual(fila(res, 'persona1').color, 'rojo'); // 12% < 15%
  assert.equal(fila(res, 'persona2').color, 'rojo');    // 12% > 10%
});

test('overrides de topes ganan sobre los defaults', () => {
  const movs = [gasto(300_000, 'persona1')]; // 10%
  const topes = { ...TOPES_PERSONA_DEFAULT, persona1: 0.08 }; // baja el tope a 8%
  const res = resumenPersonas({ movimientos: movs, vigilados: VIGILADOS, netoDelMes: NETO, topes, hoy: HOY });
  assert.equal(fila(res, 'persona1').color, 'rojo'); // 10% > 8%
});

test('ignora otros meses, ingresos y transferencias', () => {
  const movs = [
    gasto(500_000, 'persona1', { fecha: '2026-06-30' }), // mes anterior
    crearMovimiento({ fecha: HOY, monto: 999_999, tipo: 'ingreso', cuenta: 'Nequi', categoria: 'persona1' }),
    gasto(100_000, 'persona1'),
  ];
  const res = resumenPersonas({ movimientos: movs, vigilados: VIGILADOS, netoDelMes: NETO, hoy: HOY });
  assert.equal(fila(res, 'persona1').gastado, 100_000);
});

test('sin neto (>0) no revienta: pctIngreso 0 y color verde', () => {
  const movs = [gasto(500_000, 'persona1')];
  const res = resumenPersonas({ movimientos: movs, vigilados: VIGILADOS, netoDelMes: 0, hoy: HOY });
  const f = fila(res, 'persona1');
  assert.equal(f.pctIngreso, 0);
  assert.equal(f.color, 'verde');
  assert.equal(f.gastado, 500_000);
});

test('ordena por gasto descendente', () => {
  const movs = [gasto(100_000, 'persona1'), gasto(400_000, 'persona2'), gasto(250_000, 'yo')];
  const res = resumenPersonas({ movimientos: movs, vigilados: VIGILADOS, netoDelMes: NETO, hoy: HOY });
  assert.deepEqual(res.map((f) => f.id).slice(0, 3), ['persona2', 'yo', 'persona1']);
});

test('topeMonto refleja el tope en pesos del neto', () => {
  const res = resumenPersonas({ movimientos: [], vigilados: VIGILADOS, netoDelMes: NETO, hoy: HOY });
  assert.equal(fila(res, 'persona1').topeMonto, 450_000); // 15% de 3.000.000
  assert.equal(fila(res, 'persona2').topeMonto, 300_000); // 10%
});

test('VIGILADOS_DEFAULT trae las 4 personas + ocio', () => {
  assert.deepEqual([...VIGILADOS_DEFAULT], ['persona1', 'persona2', 'persona3', 'yo', 'ocio']);
});

test('devuelve estructura inmutable (congelada)', () => {
  const res = resumenPersonas({ movimientos: [gasto(100_000, 'yo')], vigilados: VIGILADOS, netoDelMes: NETO, hoy: HOY });
  assert.ok(Object.isFrozen(res));
  assert.ok(Object.isFrozen(res[0]));
});
