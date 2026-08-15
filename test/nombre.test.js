/* ============================================================
   olbo · test/nombre.test.js
   Normalización del nombre del usuario. Lo que se escriba aquí termina en el
   saludo de Hoy y en las iniciales del avatar, así que tiene que salir limpio
   pase lo que pase. Nombres FICTICIOS.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarNombre, NOMBRE_MAX } from '../js/views/cfg-nombre.js';

test('recorta espacios de las puntas', () => {
  assert.equal(normalizarNombre('   Ana   '), 'Ana');
});

test('colapsa espacios repetidos del medio', () => {
  assert.equal(normalizarNombre('Ana    Maria'), 'Ana Maria');
  assert.equal(normalizarNombre('Ana\t\nMaria'), 'Ana Maria');
});

test('un nombre normal pasa intacto', () => {
  assert.equal(normalizarNombre('Ana María Restrepo'), 'Ana María Restrepo');
});

test('aplica el tope de largo', () => {
  const largo = 'a'.repeat(NOMBRE_MAX + 25);
  assert.equal(normalizarNombre(largo).length, NOMBRE_MAX);
});

test('el tope se aplica DESPUÉS de limpiar, no antes', () => {
  // Si recortara primero, los espacios del inicio se comerían caracteres útiles.
  const conBasura = '    ' + 'b'.repeat(NOMBRE_MAX);
  assert.equal(normalizarNombre(conBasura), 'b'.repeat(NOMBRE_MAX));
});

test('vacío y basura devuelven cadena vacía, nunca null', () => {
  for (const v of [null, undefined, '', '   ', '\n\t']) {
    assert.equal(normalizarNombre(v), '', `falló con ${JSON.stringify(v)}`);
  }
});

test('nunca lanza, sea cual sea la entrada', () => {
  for (const v of [0, 42, true, [], {}, NaN]) {
    assert.equal(typeof normalizarNombre(v), 'string');
  }
});

test('NOMBRE_MAX coincide con el maxlength del input del onboarding', () => {
  // El onboarding declara maxlength="40"; si alguien cambia uno solo, la app
  // aceptaría por un lado lo que recorta por el otro.
  assert.equal(NOMBRE_MAX, 40);
});
