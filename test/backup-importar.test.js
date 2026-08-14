/* ============================================================
   Bolsillo · test/backup-importar.test.js
   Blindaje de la ruta de IMPORTACIÓN de respaldos.

   El `db` falso usa el crearConfig REAL en saveConfig (igual que
   db.js): así el test ejercita la semántica de REEMPLAZO que
   destruía cuentas y categorías propias, en vez de simularla.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { serializar, importar, exportar, fusionarConfig } from '../js/backup.js';
import { crearConfig } from '../js/model.js';
import { construirCatalogo } from '../js/categories.js';
import { respaldoVencido } from '../js/views/cfg-respaldo.js';

const CLAVE_LOCAL = 'sk-ant-LOCAL-DEL-USUARIO';
const CLAVE_ATACANTE = 'sk-ant-ATACANTE';

/** db falso en memoria con la MISMA semántica de merge que db.js. */
function dbFalso({ config = {}, stores = {} } = {}) {
  const estado = {
    config: crearConfig(config),
    stores: { movimientos: [], recurrentes: [], creditos: [], ingresos: [], ...stores },
  };
  return {
    estado,
    async getAll(store) { return (estado.stores[store] || []).slice(); },
    async getConfig() { return estado.config; },
    async saveConfig(partial = {}) {
      estado.config = crearConfig({ ...estado.config, ...partial }); // db.js:151-156
      return estado.config;
    },
    async bulkPut(store, arr) {
      estado.stores[store] = [...(estado.stores[store] || []), ...arr];
      return arr.length;
    },
  };
}

/** Respaldo generado por la app (serializar ya quita los campos solo-locales). */
function respaldoCon(config, datos = {}) {
  return serializar({ movimientos: [], recurrentes: [], creditos: [], ingresos: [], ...datos, config });
}

/**
 * Respaldo CRUDO, armado a mano sin pasar por `serializar`.
 * Imprescindible para probar la apiKey: si se usara `serializar` el archivo
 * saldría ya sin clave y el test pasaría aunque el import no filtrara nada.
 */
function respaldoCrudo(config, datos = {}) {
  return {
    formato: 'bolsillo-backup',
    version: 1,
    exportadoEn: '2026-03-01T00:00:00.000Z',
    datos: { movimientos: [], recurrentes: [], creditos: [], ingresos: [], ...datos, config },
  };
}

/* ============================================================
   1) La clave de API es inmune a lo que traiga el archivo
   ============================================================ */

test('importar: la apiKey del archivo NO sustituye la clave local', async () => {
  // Arrange: archivo que SÍ trae una clave ajena (editado a mano o de terceros).
  const db = dbFalso({ config: { apiKey: CLAVE_LOCAL, cuentas: ['Efectivo'] } });
  const backup = respaldoCrudo({ id: 'config', apiKey: CLAVE_ATACANTE, tema: 'light' });

  // Act
  await importar(db, backup);

  // Assert
  assert.equal(db.estado.config.apiKey, CLAVE_LOCAL, 'la clave local debe sobrevivir intacta');
  assert.notEqual(db.estado.config.apiKey, CLAVE_ATACANTE);
});

test('importar: si no había clave local, el archivo tampoco puede crearla', async () => {
  // Arrange
  const db = dbFalso({ config: { cuentas: ['Efectivo'] } }); // apiKey: null por defecto
  const backup = respaldoCrudo({ id: 'config', apiKey: CLAVE_ATACANTE });

  // Act
  await importar(db, backup);

  // Assert
  assert.equal(db.estado.config.apiKey, null, 'una clave ajena nunca debe quedar instalada');
});

test('importar: el mismo archivo como string JSON tampoco cuela la clave', async () => {
  // Arrange
  const db = dbFalso({ config: { apiKey: CLAVE_LOCAL } });
  const crudo = JSON.stringify(respaldoCrudo({ id: 'config', apiKey: CLAVE_ATACANTE }));

  // Act
  await importar(db, crudo);

  // Assert
  assert.equal(db.estado.config.apiKey, CLAVE_LOCAL);
});

/* ============================================================
   2) No hay pérdida de catálogos del usuario
   ============================================================ */

test('importar: un respaldo viejo NO borra cuentas ni categorías propias nuevas', async () => {
  // Arrange: hoy el usuario tiene Davivienda y la categoría propia "Mascota".
  const db = dbFalso({
    config: {
      cuentas: ['Efectivo', 'Nequi', 'Davivienda'],
      categoriasPersonalizadas: [{ id: 'usr-mascota', label: 'Mascota' }],
    },
  });
  // El respaldo es de antes de crearlas.
  const backup = respaldoCon({
    id: 'config',
    cuentas: ['Efectivo', 'Nequi'],
    categoriasPersonalizadas: [],
  });

  // Act
  await importar(db, backup);

  // Assert
  const cfg = db.estado.config;
  assert.deepEqual(cfg.cuentas, ['Efectivo', 'Nequi', 'Davivienda'], 'Davivienda debe seguir viva');
  assert.equal(cfg.categoriasPersonalizadas.length, 1);
  assert.equal(cfg.categoriasPersonalizadas[0].id, 'usr-mascota');

  // Y la consecuencia real: los movimientos con esa categoría siguen etiquetados.
  const cat = construirCatalogo(cfg).find((c) => c.id === 'usr-mascota');
  assert.ok(cat, 'la categoría propia debe seguir en el catálogo');
  assert.equal(cat.label, 'Mascota');
});

test('importar: un presupuesto de una categoría solo local no se pierde', async () => {
  // Arrange
  const db = dbFalso({
    config: {
      categoriasPersonalizadas: [{ id: 'usr-mascota', label: 'Mascota' }],
      presupuestos: { 'usr-mascota': 120000 },
    },
  });
  const backup = respaldoCon({ id: 'config', presupuestos: { mercado: 800000 } });

  // Act
  await importar(db, backup);

  // Assert: coherente con la fusión de categorías (no queda huérfano ni se borra).
  assert.equal(db.estado.config.presupuestos['usr-mascota'], 120000);
  assert.equal(db.estado.config.presupuestos.mercado, 800000);
});

/* ============================================================
   3) Fusión sin duplicados
   ============================================================ */

test('importar: cuentas y categorías que ya existen no se duplican', async () => {
  // Arrange
  const db = dbFalso({
    config: {
      cuentas: ['Efectivo', 'Nequi'],
      categoriasPersonalizadas: [{ id: 'usr-mascota', label: 'Mascota' }],
    },
  });
  const backup = respaldoCon({
    id: 'config',
    cuentas: ['Nequi', 'Efectivo', 'Bancolombia'],
    categoriasPersonalizadas: [
      { id: 'usr-mascota', label: 'Mascota (viejo)' },
      { id: 'usr-viajes', label: 'Viajes' },
    ],
  });

  // Act
  await importar(db, backup);

  // Assert
  const cfg = db.estado.config;
  assert.deepEqual(cfg.cuentas, ['Efectivo', 'Nequi', 'Bancolombia'], 'sin repetidos, locales primero');
  assert.equal(cfg.categoriasPersonalizadas.length, 2);
  assert.equal(cfg.categoriasPersonalizadas[0].label, 'Mascota', 'gana la definición local');
  assert.ok(cfg.categoriasPersonalizadas.some((c) => c.id === 'usr-viajes'));
});

test('fusionarCuentas: ignora diferencias de tildes, caso y espacios', () => {
  // Arrange + Act
  const cfg = fusionarConfig(
    { cuentas: ['Efectivo', 'Davivienda'] },
    { cuentas: ['  efectivo ', 'DAVIVIÉNDA', 'Nu'] },
  );

  // Assert
  assert.deepEqual(cfg.cuentas, ['Efectivo', 'Davivienda', 'Nu']);
});

test('fusionarConfig: descarta entradas basura sin romperse', () => {
  // Arrange + Act
  const cfg = fusionarConfig(
    { cuentas: ['Efectivo'], categoriasPersonalizadas: [{ id: 'usr-a', label: 'A' }] },
    { cuentas: [null, '   ', 42, 'Nequi'], categoriasPersonalizadas: [null, { label: 'sin id' }, 'x'] },
  );

  // Assert
  assert.deepEqual(cfg.cuentas, ['Efectivo', 'Nequi']);
  assert.equal(cfg.categoriasPersonalizadas.length, 1);
  assert.equal(cfg.categoriasPersonalizadas[0].id, 'usr-a');
});

/* ============================================================
   4) La fecha del respaldo es la de ESE export
   ============================================================ */

test('exportar: el JSON lleva la fecha de ESE respaldo, no la anterior', async () => {
  // Arrange
  const db = dbFalso({ config: { fechaUltimoBackup: '2026-01-01T00:00:00.000Z' } });
  const ahora = new Date('2026-05-10T12:00:00.000Z');

  // Act
  const { backup } = await exportar(db, { now: ahora });

  // Assert
  assert.equal(backup.exportadoEn, '2026-05-10T12:00:00.000Z');
  assert.equal(backup.datos.config.fechaUltimoBackup, backup.exportadoEn, 'la fecha viaja dentro del archivo');
  assert.equal(db.estado.config.fechaUltimoBackup, backup.exportadoEn, 'y también queda local');
});

test('roundtrip export→borrar→importar: la fecha no retrocede ni queda nula', async () => {
  // Arrange: exportamos desde un dispositivo con datos.
  const origen = dbFalso({ config: { fechaUltimoBackup: '2026-01-01T00:00:00.000Z', cuentas: ['Efectivo'] } });
  const ahora = new Date('2026-05-10T12:00:00.000Z');
  const { json } = await exportar(origen, { now: ahora });

  // Act: "borrar todo" = config limpia, y restauramos.
  const limpio = dbFalso();
  assert.equal(limpio.estado.config.fechaUltimoBackup, null, 'precondición: arranca sin respaldo');
  await importar(limpio, json);

  // Assert
  assert.equal(limpio.estado.config.fechaUltimoBackup, '2026-05-10T12:00:00.000Z');
  assert.equal(
    respaldoVencido(limpio.estado.config.fechaUltimoBackup, new Date('2026-05-12T12:00:00.000Z')),
    false,
    'restaurar no debe volver a decir "nunca has respaldado"',
  );
  assert.equal(
    respaldoVencido(limpio.estado.config.fechaUltimoBackup, new Date('2026-05-25T12:00:00.000Z')),
    true,
    'y el aviso de >7 días sigue funcionando',
  );
});

/* ============================================================
   5) Los movimientos siguen sumándose (no se rompió lo que servía)
   ============================================================ */

test('importar: los movimientos del archivo se agregan y se reporta el resumen', async () => {
  // Arrange
  const db = dbFalso({ config: { cuentas: ['Efectivo'] } });
  const backup = respaldoCon(
    { id: 'config', cuentas: ['Efectivo'] },
    { movimientos: [{ id: 'm1', monto: 15000 }, { id: 'm2', monto: 30000 }] },
  );

  // Act
  const { importados } = await importar(db, backup);

  // Assert
  assert.equal(importados.movimientos, 2);
  assert.equal(importados.config, 1);
  assert.equal(db.estado.stores.movimientos.length, 2);
});
