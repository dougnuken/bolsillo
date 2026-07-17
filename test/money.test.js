import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCOP, formatCOP } from '../js/money.js';

/* ---------------- parseCOP ---------------- */

test('parseCOP: el punto es separador de miles', () => {
  // Arrange / Act / Assert
  assert.equal(parseCOP('15.000'), 15000);
  assert.equal(parseCOP('1.250.000'), 1250000);
});

test('parseCOP: entero plano sin separadores', () => {
  assert.equal(parseCOP('15000'), 15000);
});

test('parseCOP: tolera símbolo de peso y espacios', () => {
  assert.equal(parseCOP('$ 15.000'), 15000);
  assert.equal(parseCOP('$15.000'), 15000);
  assert.equal(parseCOP('  15000  '), 15000);
});

test('parseCOP: sufijo k/K equivale a mil', () => {
  assert.equal(parseCOP('15k'), 15000);
  assert.equal(parseCOP('15K'), 15000);
  assert.equal(parseCOP('$15k'), 15000);
});

test('parseCOP: coma es fracción en sufijo k', () => {
  assert.equal(parseCOP('1,5k'), 1500);
});

test('parseCOP: palabra "mil"', () => {
  assert.equal(parseCOP('50 mil'), 50000);
  assert.equal(parseCOP('50mil'), 50000);
});

test('parseCOP: millón / millones / m', () => {
  assert.equal(parseCOP('1 millón'), 1000000);
  assert.equal(parseCOP('1 millon'), 1000000);
  assert.equal(parseCOP('2 millones'), 2000000);
  assert.equal(parseCOP('1m'), 1000000);
  assert.equal(parseCOP('1,5m'), 1500000);
});

test('parseCOP: número directo se redondea a entero', () => {
  assert.equal(parseCOP(15000), 15000);
  assert.equal(parseCOP(15000.4), 15000);
});

test('parseCOP: entrada inválida o vacía devuelve null (nunca 0)', () => {
  assert.equal(parseCOP(''), null);
  assert.equal(parseCOP('   '), null);
  assert.equal(parseCOP('abc'), null);
  assert.equal(parseCOP('$'), null);
  assert.equal(parseCOP('mil'), null);
  assert.equal(parseCOP(null), null);
  assert.equal(parseCOP(undefined), null);
  assert.equal(parseCOP(NaN), null);
  assert.equal(parseCOP({}), null);
});

/* ---------------- formatCOP ---------------- */

test('formatCOP: formato es-CO con punto de miles', () => {
  assert.equal(formatCOP(15000), '$15.000');
  assert.equal(formatCOP(1250000), '$1.250.000');
  assert.equal(formatCOP(0), '$0');
});

test('formatCOP: con signo antepone + o −', () => {
  assert.equal(formatCOP(15000, { signo: true }), '+$15.000');
  assert.equal(formatCOP(-15000, { signo: true }), '−$15.000');
});

test('formatCOP: negativos siempre muestran − aunque no se pida signo', () => {
  assert.equal(formatCOP(-15000), '−$15.000');
});

test('formatCOP: modo compacto para cards', () => {
  assert.equal(formatCOP(15000, { compacto: true }), '$15 K');
  assert.equal(formatCOP(1200000, { compacto: true }), '$1,2 M');
  assert.equal(formatCOP(500, { compacto: true }), '$500');
});

test('formatCOP: entrada no numérica devuelve cadena vacía', () => {
  assert.equal(formatCOP(null), '');
  assert.equal(formatCOP(undefined), '');
  assert.equal(formatCOP(NaN), '');
});
