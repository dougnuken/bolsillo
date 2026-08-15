/* ============================================================
   olbo · test/interes-prestamo.test.js
   Cuánto rinde un préstamo con interés pactado. Sin esta cifra, el "5%" del
   formulario es un número abstracto: nadie sabe si son mil pesos o cien mil.
   Montos FICTICIOS.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { interesEstimado } from '../js/prestamos.js';

test('el caso del formulario: un millón al 5% E.A.', () => {
  const i = interesEstimado(1000000, 5);

  assert.equal(i.anual, 50000);
  // 5% E.A. NO es 5/12 mensual: es la raíz doceava, ~0,407%.
  assert.equal(i.mensual, 4074);
});

test('el anual es exactamente el porcentaje del monto', () => {
  assert.equal(interesEstimado(2000000, 12).anual, 240000);
  assert.equal(interesEstimado(750000, 8).anual, 60000);
});

test('doce meses compuestos dan el anual, no doce veces el mensual', () => {
  // La comprobación de que la conversión E.A.→mensual es la correcta.
  const monto = 1000000;
  const i = interesEstimado(monto, 5);
  const compuesto = Math.round(monto * (Math.pow(1 + i.mensual / monto, 12) - 1));

  // Margen de unos pesos, no exacto: `mensual` ya viene redondeado a pesos
  // enteros y componerlo doce veces arrastra ese redondeo. Lo que se comprueba
  // es que la conversión sea compuesta, no que cuadre al peso.
  assert.ok(Math.abs(compuesto - i.anual) <= 10, `compuesto ${compuesto} vs anual ${i.anual}`);
  // Y al revés de lo que parece: el mensual por 12 se queda CORTO frente al
  // anual (48.888 vs 50.000 en este caso), porque la mensual equivalente es
  // menor que anual/12 justamente por componer. Sumar doce meses no es la
  // forma de llegar al anual.
  assert.ok(i.mensual * 12 < i.anual, `${i.mensual}×12 debería quedarse corto frente a ${i.anual}`);
});

test('sin tasa o sin monto no se inventa nada', () => {
  assert.equal(interesEstimado(1000000, null), null);
  assert.equal(interesEstimado(1000000, 0), null);
  assert.equal(interesEstimado(0, 5), null);
  assert.equal(interesEstimado(null, 5), null);
});

test('tasas o montos negativos no producen un rendimiento', () => {
  assert.equal(interesEstimado(1000000, -5), null);
  assert.equal(interesEstimado(-1000000, 5), null);
});

test('no revienta con basura', () => {
  for (const [m, t] of [['mucho', 'poco'], [undefined, undefined], [NaN, NaN], [{}, []]]) {
    assert.equal(interesEstimado(m, t), null);
  }
});

test('el resultado es inmutable', () => {
  const i = interesEstimado(1000000, 5);
  assert.throws(() => { i.anual = 1; }, TypeError);
});
