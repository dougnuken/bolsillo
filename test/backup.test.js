import test from 'node:test';
import assert from 'node:assert/strict';
import { serializar, deserializar, FORMATO, VERSION_BACKUP } from '../js/backup.js';

const SECRETO = 'sk-ant-NO-DEBE-SALIR-DEL-DISPOSITIVO';

const datos = {
  movimientos: [{ id: 'a', monto: 15000, tipo: 'gasto', cuenta: 'Nequi' }],
  recurrentes: [],
  creditos: [],
  ingresos: [{ id: 'i', fuente: 'empleo', monto: 2000000, diaDelMes: 30 }],
  config: { id: 'config', umbralHormiga: 20000, apiKey: SECRETO, tema: 'dark' },
};

test('serializar: header correcto (formato y versión)', () => {
  const b = serializar(datos);
  assert.equal(b.formato, FORMATO);
  assert.equal(b.version, VERSION_BACKUP);
  assert.ok(b.exportadoEn);
});

test('serializar: EXCLUYE apiKey (ni la clave ni el valor)', () => {
  const b = serializar(datos);
  assert.ok(!('apiKey' in b.datos.config), 'la clave apiKey no debe estar presente');
  assert.ok(!JSON.stringify(b).includes(SECRETO), 'el valor secreto no debe aparecer en el JSON');
});

test('serializar: no incluye adjuntos por defecto', () => {
  const b = serializar({ ...datos, adjuntos: [{ id: 'x' }] });
  assert.equal(b.datos.adjuntos, undefined);
});

test('roundtrip: deserializar(serializar(x)).datos ≈ x sin apiKey', () => {
  const b = serializar(datos);
  const r = deserializar(b);
  assert.equal(r.ok, true);
  assert.deepEqual(r.datos.movimientos, datos.movimientos);
  assert.deepEqual(r.datos.ingresos, datos.ingresos);
  const { apiKey, ...configSinKey } = datos.config;
  assert.deepEqual(r.datos.config, configSinKey);
});

test('deserializar: header inválido devuelve ok:false', () => {
  assert.equal(deserializar({ formato: 'otro', version: 1, datos: {} }).ok, false);
  assert.equal(deserializar({ formato: FORMATO, version: 99, datos: {} }).ok, false);
  assert.equal(deserializar({ formato: FORMATO, version: VERSION_BACKUP }).ok, false); // sin datos
  assert.equal(deserializar('no-es-json{{{').ok, false);
  assert.equal(deserializar(null).ok, false);
});

test('deserializar: acepta string JSON válido', () => {
  const b = serializar(datos);
  const r = deserializar(JSON.stringify(b));
  assert.equal(r.ok, true);
  assert.deepEqual(r.datos.movimientos, datos.movimientos);
});
