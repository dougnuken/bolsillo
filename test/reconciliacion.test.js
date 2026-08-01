/* ============================================================
   Bolsillo · test/reconciliacion.test.js
   Matching gasto manual ↔ fijo pendiente (sugerirFijo + helpers).
   Node test runner, AAA, nombres en español.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { sugerirFijo, nombreParecido, montoCercano } from '../js/reconciliacion.js';

/* ---- factories ---- */
function fijo(over = {}) {
  return {
    id: 'r1', nombre: 'Sura madre', categoria: 'salud',
    esVariable: false, monto: 120_000, activo: true, ...over,
  };
}
function gasto(over = {}) {
  return {
    tipo: 'gasto', comercio: 'Sura madre', categoria: 'salud',
    monto: 120_000, recurrenteId: null, fecha: '2026-07-20', ...over,
  };
}
const HOY = new Date(2026, 6, 20); // 20 jul 2026 (local)

/* ============================================================
   nombreParecido
   ============================================================ */
test('nombreParecido: iguales, contiene, acentos y tokens', () => {
  assert.equal(nombreParecido('Sura madre', 'Sura madre'), true);
  assert.equal(nombreParecido('Sura', 'Sura madre'), true);          // contiene
  assert.equal(nombreParecido('Nómina', 'nomina'), true);            // sin acento
  assert.equal(nombreParecido('Arriendo apto', 'apto arriendo'), true); // tokens
  assert.equal(nombreParecido('Netflix', 'Spotify'), false);
  assert.equal(nombreParecido('', 'Sura'), false);
});

test('nombreParecido: no empareja por subcadenas cortas (<3)', () => {
  assert.equal(nombreParecido('a', 'apto'), false);
});

/* ============================================================
   montoCercano
   ============================================================ */
test('montoCercano: dentro de ±20% en fijos exactos; variables no aplican', () => {
  assert.equal(montoCercano({ monto: 105_000 }, { esVariable: false, monto: 100_000 }), true);  // +5%
  assert.equal(montoCercano({ monto: 130_000 }, { esVariable: false, monto: 100_000 }), false); // +30%
  assert.equal(montoCercano({ monto: 100_000 }, { esVariable: true, monto: null }), false);      // variable
});

/* ============================================================
   sugerirFijo
   ============================================================ */
test('sugiere el fijo cuando el nombre coincide', () => {
  const r = sugerirFijo({ gasto: gasto(), recurrentes: [fijo()], movimientos: [], hoy: HOY });
  assert.equal(r?.id, 'r1');
});

test('sugiere por categoría + monto aunque el nombre difiera', () => {
  const g = gasto({ comercio: 'EPS del mes' }); // nombre distinto
  const r = sugerirFijo({ gasto: g, recurrentes: [fijo()], movimientos: [], hoy: HOY });
  assert.equal(r?.id, 'r1'); // salud + 120k ≈ 120k
});

test('NO sugiere si el fijo ya fue vinculado este mes', () => {
  const yaPagado = { ...gasto(), id: 'm9', recurrenteId: 'r1', fecha: '2026-07-05' };
  const r = sugerirFijo({ gasto: gasto(), recurrentes: [fijo()], movimientos: [yaPagado], hoy: HOY });
  assert.equal(r, null);
});

test('un pago del mes ANTERIOR no cuenta como vinculado este mes', () => {
  const mesPasado = { ...gasto(), id: 'm8', recurrenteId: 'r1', fecha: '2026-06-05' };
  const r = sugerirFijo({ gasto: gasto(), recurrentes: [fijo()], movimientos: [mesPasado], hoy: HOY });
  assert.equal(r?.id, 'r1'); // junio no apaga julio
});

test('NO sugiere para un ingreso', () => {
  const r = sugerirFijo({ gasto: gasto({ tipo: 'ingreso' }), recurrentes: [fijo()], movimientos: [], hoy: HOY });
  assert.equal(r, null);
});

test('NO sugiere si el gasto ya está vinculado (recurrenteId)', () => {
  const r = sugerirFijo({ gasto: gasto({ recurrenteId: 'r1' }), recurrentes: [fijo()], movimientos: [], hoy: HOY });
  assert.equal(r, null);
});

test('NO sugiere fijos inactivos', () => {
  const r = sugerirFijo({ gasto: gasto(), recurrentes: [fijo({ activo: false })], movimientos: [], hoy: HOY });
  assert.equal(r, null);
});

test('NO sugiere cuando nada cuadra (otra categoría, otro nombre, otro monto)', () => {
  const g = gasto({ comercio: 'Cine', categoria: 'ocio', monto: 25_000 });
  const r = sugerirFijo({ gasto: g, recurrentes: [fijo()], movimientos: [], hoy: HOY });
  assert.equal(r, null);
});

test('entre varios candidatos, gana el de mayor puntaje (nombre + cat + monto)', () => {
  const soloCat = fijo({ id: 'r2', nombre: 'Otra cosa', categoria: 'salud', monto: 121_000 }); // cat+monto = 4
  const exacto = fijo({ id: 'r1', nombre: 'Sura madre' });                                     // nombre+cat+monto = 7
  const r = sugerirFijo({ gasto: gasto(), recurrentes: [soloCat, exacto], movimientos: [], hoy: HOY });
  assert.equal(r?.id, 'r1');
});

test('fijo VARIABLE se sugiere por nombre aunque no haya monto', () => {
  const variable = fijo({ esVariable: true, monto: null });
  const r = sugerirFijo({ gasto: gasto({ monto: 999_999 }), recurrentes: [variable], movimientos: [], hoy: HOY });
  assert.equal(r?.id, 'r1');
});
