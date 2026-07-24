/* ============================================================
   Bolsillo · test/extracto.test.js
   Lectura del extracto (PDF) de tarjeta con IA. Partes PURAS +
   analizarExtracto con fetchImpl inyectado (sin red real). La clave
   solo viaja en x-api-key; los estados espejan a foto/voz-gasto.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  construirPeticionExtracto, normalizarExtracto, analizarExtracto,
  TOOL_EXTRACTO, MODELO_EXTRACTO_DEFAULT,
} from '../js/extracto-pdf.js';
import { tasaEAaMV } from '../js/model.js';

/* ---- construirPeticionExtracto ---- */

test('arma el body con document PDF + tool_use forzado', () => {
  const body = construirPeticionExtracto({ base64: 'QUJD', mediaType: 'application/pdf' });
  assert.equal(body.model, MODELO_EXTRACTO_DEFAULT);
  assert.equal(body.tool_choice.name, TOOL_EXTRACTO.name);
  assert.deepEqual(body.tools, [TOOL_EXTRACTO]);
  const doc = body.messages[0].content.find((b) => b.type === 'document');
  assert.ok(doc, 'debe haber un bloque document');
  assert.equal(doc.source.media_type, 'application/pdf');
  assert.equal(doc.source.data, 'QUJD');
});

test('respeta el modelo pasado', () => {
  const body = construirPeticionExtracto({ base64: 'x', modelo: 'claude-otro' });
  assert.equal(body.model, 'claude-otro');
});

/* ---- normalizarExtracto ---- */

test('acepta corte/límite válidos (1..31) y descarta inválidos', () => {
  assert.deepEqual(
    normalizarExtracto({ corte: 5, limite: 25, encontrado: true }),
    { corte: 5, limite: 25, tasa: null, total: null, banco: '', encontrado: true },
  );
  const r = normalizarExtracto({ corte: 0, limite: 40, encontrado: true });
  assert.equal(r.corte, null);
  assert.equal(r.limite, null);
});

test('tasa mensual pasa directo; tasa anual se convierte a M.V.', () => {
  assert.equal(normalizarExtracto({ tasa: 2.1, esAnual: false, encontrado: true }).tasa, 2.1);
  const esperado = Math.round(tasaEAaMV(26.5) * 100) / 100;
  assert.equal(normalizarExtracto({ tasa: 26.5, esAnual: true, encontrado: true }).tasa, esperado);
});

test('total: acepta número o texto COP; descarta <= 0', () => {
  assert.equal(normalizarExtracto({ total: 1200000, encontrado: true }).total, 1200000);
  assert.equal(normalizarExtracto({ total: '$1.200.000', encontrado: true }).total, 1200000);
  assert.equal(normalizarExtracto({ total: 0, encontrado: true }).total, null);
});

test('tolerante: input basura no lanza y devuelve vacíos', () => {
  const r = normalizarExtracto(null);
  assert.deepEqual(r, { corte: null, limite: null, tasa: null, total: null, banco: '', encontrado: false });
});

/* ---- analizarExtracto (fetch inyectado) ---- */

function fetchOk(input) {
  return async () => ({ status: 200, ok: true, json: async () => ({ content: [{ type: 'tool_use', input }] }) });
}

test('sin clave → estado sin-clave (no toca la red)', async () => {
  let llamado = false;
  const r = await analizarExtracto(
    { base64: 'x', apiKey: '  ' },
    { fetchImpl: async () => { llamado = true; return {}; } },
  );
  assert.equal(r.estado, 'sin-clave');
  assert.equal(llamado, false);
});

test('camino feliz: manda la clave en x-api-key y normaliza la salida', async () => {
  let headersVistos = null;
  const fetchImpl = async (url, opts) => {
    headersVistos = opts.headers;
    return { status: 200, ok: true, json: async () => ({ content: [{ type: 'tool_use', input: { corte: 5, limite: 25, tasa: 2.1, esAnual: false, total: 900000, banco: 'BDO', encontrado: true } }] }) };
  };
  const r = await analizarExtracto({ base64: 'QUJD', apiKey: 'sk-secreta', modelo: 'm' }, { fetchImpl });
  assert.equal(r.estado, 'ok');
  assert.equal(r.corte, 5);
  assert.equal(r.limite, 25);
  assert.equal(r.tasa, 2.1);
  assert.equal(r.total, 900000);
  assert.equal(r.banco, 'BDO');
  assert.equal(headersVistos['x-api-key'], 'sk-secreta');
});

test('401 → clave inválida', async () => {
  const r = await analizarExtracto({ base64: 'x', apiKey: 'k' }, { fetchImpl: async () => ({ status: 401, ok: false }) });
  assert.equal(r.estado, 'invalida');
});

test('fallo de red → estado red (mensaje sin la clave)', async () => {
  const r = await analizarExtracto({ base64: 'x', apiKey: 'sk-secreta' }, { fetchImpl: async () => { throw new Error('down'); } });
  assert.equal(r.estado, 'red');
  assert.ok(!/sk-secreta/.test(r.mensaje));
});

test('documento que no es extracto → sin-datos', async () => {
  const r = await analizarExtracto({ base64: 'x', apiKey: 'k' }, { fetchImpl: fetchOk({ encontrado: false }) });
  assert.equal(r.estado, 'sin-datos');
});

test('sin bloque tool_use → error', async () => {
  const r = await analizarExtracto({ base64: 'x', apiKey: 'k' }, { fetchImpl: async () => ({ status: 200, ok: true, json: async () => ({ content: [{ type: 'text', text: 'hola' }] }) }) });
  assert.equal(r.estado, 'error');
});
