/* ============================================================
   olbo · test/presupuestos.test.js
   Avisos de tope por categoría. El tope se configuraba y se pintaba de color en
   la vista, pero nadie avisaba: había que entrar a mirarlo. Un tope del que no
   te enteras no sirve para nada, que es justo para lo que se pone.
   Montos FICTICIOS.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { alertasPresupuesto } from '../js/budget.js';

const fila = (categoriaId, total, presupuesto, color) => ({ categoriaId, total, presupuesto, color });

test('avisa de lo pasado y de lo que está cerca', () => {
  const a = alertasPresupuesto([
    fila('mercado', 520000, 400000, 'rojo'),
    fila('ocio', 180000, 200000, 'ambar'),
  ]);

  assert.equal(a.length, 2);
  assert.equal(a.map((x) => x.categoriaId).includes('mercado'), true);
});

test('el verde NO es una notificación', () => {
  // Ir bien dentro del tope no es algo que deba sonar.
  const a = alertasPresupuesto([fila('mercado', 100000, 400000, 'verde')]);

  assert.deepEqual(a, []);
});

test('una categoría sin tope no genera aviso', () => {
  const a = alertasPresupuesto([
    { categoriaId: 'mercado', total: 900000 },
    fila('ocio', 900000, 0, 'rojo'),
  ]);

  assert.deepEqual(a, []);
});

test('calcula cuánto se pasó, no solo que se pasó', () => {
  const [m] = alertasPresupuesto([fila('mercado', 520000, 400000, 'rojo')]);

  assert.equal(m.excedido, 120000);
  assert.equal(Math.round(m.pctTope * 100), 130);
});

test('en ámbar el excedido es 0, porque todavía no se ha pasado', () => {
  const [o] = alertasPresupuesto([fila('ocio', 180000, 200000, 'ambar')]);

  assert.equal(o.excedido, 0);
  assert.equal(Math.round(o.pctTope * 100), 90);
});

test('ordena lo más pasado primero', () => {
  const a = alertasPresupuesto([
    fila('ocio', 180000, 200000, 'ambar'),
    fila('mercado', 800000, 400000, 'rojo'),
    fila('transporte', 420000, 400000, 'rojo'),
  ]);

  assert.deepEqual(a.map((x) => x.categoriaId), ['mercado', 'transporte', 'ocio']);
});

test('entradas basura devuelven lista vacía, sin lanzar', () => {
  for (const v of [undefined, null, 'texto', 42, [null, {}, 'x']]) {
    assert.deepEqual(alertasPresupuesto(v), []);
  }
});

test('el resultado es inmutable', () => {
  const a = alertasPresupuesto([fila('mercado', 520000, 400000, 'rojo')]);

  assert.throws(() => { a.push({}); }, TypeError);
  assert.throws(() => { a[0].total = 1; }, TypeError);
});
