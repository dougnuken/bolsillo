/* olbo · test/foto-perfil.test.js — partes PURAS de la foto de perfil. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { recorteCuadrado, validarArchivo, LADO_FOTO, MAX_ARCHIVO } from '../js/foto-perfil.js';

test('recorteCuadrado: horizontal recorta a los lados y centra', () => {
  assert.deepEqual(recorteCuadrado(400, 200), { sx: 100, sy: 0, lado: 200 });
});

test('recorteCuadrado: vertical recorta arriba/abajo y centra', () => {
  assert.deepEqual(recorteCuadrado(200, 500), { sx: 0, sy: 150, lado: 200 });
});

test('recorteCuadrado: cuadrada no recorta; medidas inválidas → null', () => {
  assert.deepEqual(recorteCuadrado(300, 300), { sx: 0, sy: 0, lado: 300 });
  assert.equal(recorteCuadrado(0, 100), null);
  assert.equal(recorteCuadrado(-5, 5), null);
});

test('validarArchivo: acepta imágenes y rechaza lo que no lo es', () => {
  assert.equal(validarArchivo({ type: 'image/jpeg', size: 1000 }).ok, true);
  assert.equal(validarArchivo({ type: 'application/pdf', size: 1000 }).ok, false);
  assert.equal(validarArchivo(null).ok, false);
});

test('validarArchivo: rechaza imágenes demasiado pesadas', () => {
  const r = validarArchivo({ type: 'image/png', size: MAX_ARCHIVO + 1 });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /pesada/i);
});

test('el lado final es 256px (nítido en @3x sobre un avatar de 56px)', () => {
  assert.equal(LADO_FOTO, 256);
});
