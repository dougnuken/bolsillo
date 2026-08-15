/* ============================================================
   olbo · test/backup-cobertura.test.js

   El respaldo tenía la lista de stores escrita a mano en TRES sitios
   (serializar, exportar, importar) y se desincronizó: `prestamos` y `cortes`
   existían en la base pero no se exportaban, así que restaurar perdía "me
   deben", "debo" y los extractos sin avisar de nada.

   El primer test es el que importa: si alguien añade un store a la base y se
   olvida del respaldo, esto falla en vez de perder datos en producción.
   Datos FICTICIOS.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { STORES } from '../js/db.js';
import {
  STORES_RESPALDO, STORES_APARTE, serializar, exportar, importar,
} from '../js/backup.js';

test('el respaldo cubre TODOS los stores de la base', () => {
  const cubiertos = new Set([...STORES_RESPALDO, ...STORES_APARTE]);
  const olvidados = STORES.filter((s) => !cubiertos.has(s));

  assert.deepEqual(olvidados, [],
    `estos stores no se respaldan: ${olvidados.join(', ')}. Añádelos a STORES_RESPALDO `
    + '(o a STORES_APARTE si llevan tratamiento propio, como config).');
});

test('prestamos y cortes están explícitamente en el respaldo', () => {
  // Los dos que faltaban. Nombrados a propósito para que borrarlos duela.
  assert.ok(STORES_RESPALDO.includes('prestamos'), 'me deben / debo');
  assert.ok(STORES_RESPALDO.includes('cortes'), 'los extractos');
});

test('serializar mete todos los stores, incluso vacíos', () => {
  const b = serializar({ movimientos: [{ id: 'm1' }] });

  for (const s of STORES_RESPALDO) {
    assert.ok(Array.isArray(b.datos[s]), `falta el store "${s}" en el payload`);
  }
});

test('serializar conserva prestamos y cortes con su contenido', () => {
  const b = serializar({
    prestamos: [{ id: 'p1', persona: 'Un conocido', monto: 500000 }],
    cortes: [{ id: 'c1', cuentaClave: 'banco-demo-cop', corte: '2026-08-15' }],
  });

  assert.equal(b.datos.prestamos.length, 1);
  assert.equal(b.datos.cortes[0].corte, '2026-08-15');
});

/* db falso: guarda lo que le pongan y devuelve lo que le pidan. */
function dbFalso(inicial = {}) {
  const almacen = { ...inicial };
  return {
    almacen,
    getAll: async (s) => almacen[s] || [],
    getConfig: async () => almacen.config || { id: 'config' },
    saveConfig: async (c) => { almacen.config = { ...(almacen.config || {}), ...c }; },
    bulkPut: async (s, arr) => { almacen[s] = [...(almacen[s] || []), ...arr]; },
  };
}

test('exportar LEE prestamos y cortes de la base', async () => {
  const db = dbFalso({
    movimientos: [{ id: 'm1' }],
    prestamos: [{ id: 'p1', monto: 500000 }],
    cortes: [{ id: 'c1', corte: '2026-08-15' }],
  });

  const { backup } = await exportar(db, { now: new Date('2026-08-15T12:00:00Z') });

  assert.equal(backup.datos.prestamos.length, 1);
  assert.equal(backup.datos.cortes.length, 1);
});

test('exportar no se cae si un store todavía no existe en una base vieja', async () => {
  const db = {
    getAll: async (s) => { if (s === 'cortes') throw new Error('store inexistente'); return []; },
    getConfig: async () => ({ id: 'config' }),
    saveConfig: async () => {},
  };

  const { backup } = await exportar(db, { now: new Date('2026-08-15T12:00:00Z') });

  assert.deepEqual(backup.datos.cortes, []);
  assert.ok(Array.isArray(backup.datos.movimientos));
});

test('importar RESTAURA prestamos y cortes', async () => {
  const db = dbFalso();
  const backup = serializar({
    prestamos: [{ id: 'p1', monto: 500000 }],
    cortes: [{ id: 'c1', corte: '2026-08-15' }],
  });

  const { importados } = await importar(db, JSON.stringify(backup));

  assert.equal(importados.prestamos, 1);
  assert.equal(importados.cortes, 1);
  assert.equal(db.almacen.prestamos.length, 1);
  assert.equal(db.almacen.cortes[0].corte, '2026-08-15');
});

test('ida y vuelta: lo que entra en la base sale igual del respaldo', async () => {
  const origen = dbFalso({
    movimientos: [{ id: 'm1' }],
    prestamos: [{ id: 'p1', monto: 500000 }, { id: 'p2', monto: 200000 }],
    cortes: [{ id: 'c1', corte: '2026-08-15' }],
  });
  const { json } = await exportar(origen, { now: new Date('2026-08-15T12:00:00Z') });

  const destino = dbFalso();
  await importar(destino, json);

  assert.equal(destino.almacen.prestamos.length, 2);
  assert.equal(destino.almacen.cortes.length, 1);
  assert.equal(destino.almacen.movimientos.length, 1);
});

test('un respaldo VIEJO (sin los stores nuevos) sigue importándose', async () => {
  // Los archivos que ya tenga el usuario no llevan prestamos ni cortes; deben
  // seguir siendo válidos y no reventar la importación.
  const db = dbFalso();
  const viejo = {
    formato: 'bolsillo-backup',
    version: 1,
    exportadoEn: '2026-07-01T00:00:00.000Z',
    datos: { movimientos: [{ id: 'm1' }], recurrentes: [], creditos: [], ingresos: [], config: null },
  };

  const { importados } = await importar(db, JSON.stringify(viejo));

  assert.equal(importados.movimientos, 1);
  assert.equal(importados.prestamos, 0);
  assert.equal(importados.cortes, 0);
});
