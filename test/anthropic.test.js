import test from 'node:test';
import assert from 'node:assert/strict';
import {
  enmascararClave,
  extraerModelos,
  verificarClave,
  ANTHROPIC_MODELS_URL,
  ANTHROPIC_VERSION,
} from '../js/anthropic.js';

/* Clave de MENTIRA solo para probar el enmascarado y las rutas de error.
   No es ni pretende ser una credencial real. */
const CLAVE_FALSA = 'sk-ant-invalida-000';

/* ---- enmascararClave (PURA) ---- */

test('enmascararClave: nunca devuelve la clave completa', () => {
  const m = enmascararClave(CLAVE_FALSA);
  assert.equal(m.includes(CLAVE_FALSA), false);
  assert.equal(m, 'sk-ant-…-000');
});

test('enmascararClave: deja ver solo los últimos 4', () => {
  assert.equal(enmascararClave('abcdefghijklmnop').endsWith('mnop'), true);
  assert.equal(enmascararClave('abcdefghijklmnop').includes('defghijkl'), false);
});

test('enmascararClave: claves cortas se ocultan casi por completo', () => {
  assert.equal(enmascararClave('12345678'), '…5678');
});

test('enmascararClave: entradas inválidas devuelven cadena vacía', () => {
  assert.equal(enmascararClave(''), '');
  assert.equal(enmascararClave('   '), '');
  assert.equal(enmascararClave(null), '');
  assert.equal(enmascararClave(undefined), '');
  assert.equal(enmascararClave(12345), '');
});

/* ---- extraerModelos (PURA) ---- */

test('extraerModelos: mapea id y display_name', () => {
  const ms = extraerModelos({ data: [{ id: 'claude-x', display_name: 'Claude X' }] });
  assert.deepEqual(ms, [{ id: 'claude-x', nombre: 'Claude X' }]);
});

test('extraerModelos: sin display_name usa el id', () => {
  assert.equal(extraerModelos({ data: [{ id: 'claude-y' }] })[0].nombre, 'claude-y');
});

test('extraerModelos: cuerpos inesperados devuelven []', () => {
  assert.deepEqual(extraerModelos(null), []);
  assert.deepEqual(extraerModelos({}), []);
  assert.deepEqual(extraerModelos({ data: 'nope' }), []);
  assert.deepEqual(extraerModelos({ data: [{ sinId: 1 }, { id: '  ' }] }), []);
});

/* ---- verificarClave (con fetch inyectado) ---- */

test('verificarClave: clave vacía no hace ninguna petición', async () => {
  let llamado = false;
  const r = await verificarClave('   ', { fetchImpl: async () => { llamado = true; } });
  assert.equal(r.estado, 'vacia');
  assert.equal(llamado, false);
});

test('verificarClave: manda la clave en el header x-api-key y NUNCA en la URL', async () => {
  let urlVista = '';
  let headersVistos = null;
  await verificarClave(CLAVE_FALSA, {
    fetchImpl: async (url, opts) => {
      urlVista = url;
      headersVistos = opts.headers;
      return { ok: true, status: 200, json: async () => ({ data: [] }) };
    },
  });
  assert.equal(urlVista, ANTHROPIC_MODELS_URL);
  assert.equal(urlVista.includes(CLAVE_FALSA), false); // la clave jamás en la URL
  assert.equal(headersVistos['x-api-key'], CLAVE_FALSA);
  assert.equal(headersVistos['anthropic-version'], ANTHROPIC_VERSION);
  assert.equal(headersVistos['anthropic-dangerous-direct-browser-access'], 'true');
});

test('verificarClave: 401 → clave inválida', async () => {
  const r = await verificarClave(CLAVE_FALSA, {
    fetchImpl: async () => ({ ok: false, status: 401 }),
  });
  assert.equal(r.estado, 'invalida');
  assert.match(r.mensaje, /inválida/i);
});

test('verificarClave: 403 también cuenta como clave inválida', async () => {
  const r = await verificarClave(CLAVE_FALSA, { fetchImpl: async () => ({ ok: false, status: 403 }) });
  assert.equal(r.estado, 'invalida');
});

test('verificarClave: fallo de red se distingue de clave inválida', async () => {
  const r = await verificarClave(CLAVE_FALSA, {
    fetchImpl: async () => { throw new TypeError('Failed to fetch'); },
  });
  assert.equal(r.estado, 'red');
  assert.match(r.mensaje, /conexión/i);
});

test('verificarClave: otro HTTP de error se reporta con su código', async () => {
  const r = await verificarClave(CLAVE_FALSA, { fetchImpl: async () => ({ ok: false, status: 500 }) });
  assert.equal(r.estado, 'error');
  assert.match(r.mensaje, /500/);
});

test('verificarClave: 200 devuelve los modelos reales del endpoint', async () => {
  const r = await verificarClave(CLAVE_FALSA, {
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ id: 'claude-a', display_name: 'Claude A' }, { id: 'claude-b' }] }),
    }),
  });
  assert.equal(r.estado, 'ok');
  assert.equal(r.modelos.length, 2);
  assert.equal(r.modelos[0].nombre, 'Claude A');
});

test('verificarClave: 200 con cuerpo ilegible no crashea', async () => {
  const r = await verificarClave(CLAVE_FALSA, {
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => { throw new Error('bad json'); } }),
  });
  assert.equal(r.estado, 'error');
});

test('verificarClave: ningún mensaje de retorno filtra la clave', async () => {
  const casos = [
    async () => ({ ok: false, status: 401 }),
    async () => ({ ok: false, status: 500 }),
    async () => { throw new Error('boom'); },
  ];
  for (const fetchImpl of casos) {
    const r = await verificarClave(CLAVE_FALSA, { fetchImpl });
    assert.equal(r.mensaje.includes(CLAVE_FALSA), false);
  }
});
