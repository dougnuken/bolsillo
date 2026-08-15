/* ============================================================
   Bolsillo · test/extracto.test.js
   Lectura del extracto (PDF) de tarjeta con IA. Partes PURAS +
   analizarExtracto con fetchImpl inyectado (sin red real). La clave
   solo viaja en x-api-key; los estados espejan a foto/voz-gasto.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  construirPeticionExtracto, construirPeticionExtractoImagenes,
  normalizarExtracto, analizarExtracto, analizarExtractoImagenes,
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

/* ---- construirPeticionExtractoImagenes (camino real: PDF descifrado) ---- */

test('arma el body con IMÁGENES + tool_use forzado', () => {
  const body = construirPeticionExtractoImagenes({
    imagenes: [{ base64: 'AAA', mediaType: 'image/jpeg' }, { base64: 'BBB' }],
  });
  assert.equal(body.model, MODELO_EXTRACTO_DEFAULT);
  assert.equal(body.tool_choice.name, TOOL_EXTRACTO.name);
  const imgs = body.messages[0].content.filter((b) => b.type === 'image');
  assert.equal(imgs.length, 2);
  assert.equal(imgs[0].source.media_type, 'image/jpeg');
  assert.equal(imgs[0].source.data, 'AAA');
  assert.equal(imgs[1].source.media_type, 'image/jpeg'); // default
  assert.ok(body.messages[0].content.some((b) => b.type === 'text'));
});

/* ---- normalizarExtracto ---- */

test('acepta corte/límite válidos (1..31) y descarta inválidos', () => {
  assert.deepEqual(
    normalizarExtracto({ corte: 5, limite: 25, encontrado: true }),
    {
      corte: 5, limite: 25, tasa: null, tasaAnual: null, total: null, saldo: null, banco: '', encontrado: true,
      corteISO: null, limiteISO: null, pagoAPlazos: null, pagoMinimo: null, intereses: null, diferidos: [], consumos: [],
    },
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

test('saldo: deuda total (número o COP), descarta <= 0', () => {
  assert.equal(normalizarExtracto({ saldo: 1794096, encontrado: true }).saldo, 1794096);
  assert.equal(normalizarExtracto({ saldo: '$1.794.096', encontrado: true }).saldo, 1794096);
  assert.equal(normalizarExtracto({ saldo: 0, encontrado: true }).saldo, null);
  assert.equal(normalizarExtracto({ encontrado: true }).saldo, null);
});

test('tasaAnual: solo cuando el extracto la reporta E.A.', () => {
  assert.equal(normalizarExtracto({ tasa: 26.5, esAnual: true, encontrado: true }).tasaAnual, 26.5);
  assert.equal(normalizarExtracto({ tasa: 2.1, esAnual: false, encontrado: true }).tasaAnual, null); // mensual → no adivina la anual
});

test('tolerante: input basura no lanza y devuelve vacíos', () => {
  const r = normalizarExtracto(null);
  assert.deepEqual(r, {
    corte: null, limite: null, tasa: null, tasaAnual: null, total: null, saldo: null, banco: '', encontrado: false,
    corteISO: null, limiteISO: null, pagoAPlazos: null, pagoMinimo: null, intereses: null, diferidos: [], consumos: [],
  });
});

test('diferidos: extrae y normaliza las líneas con descripción, ignora las vacías', () => {
  const r = normalizarExtracto({
    encontrado: true,
    diferidos: [
      { descripcion: 'TIENDA*DEMO', compte: '000001', fecha: '2026-07-09', plazo: 6, cuotasPendientes: 6, saldoCapital: 400000, tasaEA: 28.02 },
      { descripcion: '', saldoCapital: 999 },   // sin descripción → se ignora
      { saldoCapital: 100 },                     // sin descripción → se ignora
    ],
  });
  assert.equal(r.diferidos.length, 1);
  assert.equal(r.diferidos[0].clave, 'tienda-demo');   // clave estable derivada del comercio
  assert.equal(r.diferidos[0].saldoCapital, 400000);
  assert.equal(r.diferidos[0].cuotasPendientes, 6);
});

test('pagos y fechas ISO: se normalizan; texto COP o número; fecha válida', () => {
  const r = normalizarExtracto({
    encontrado: true,
    corteISO: '2026-07-31', limiteISO: '2026-08-18',
    pagoAPlazos: '$450.000', pagoMinimo: 90000, intereses: 50000,
  });
  assert.equal(r.corteISO, '2026-07-31');
  assert.equal(r.limiteISO, '2026-08-18');
  assert.equal(r.pagoAPlazos, 450000);
  assert.equal(r.pagoMinimo, 90000);
  assert.equal(r.intereses, 50000);
});

test('fechas ISO basura → null; diferidos ausente → []', () => {
  const r = normalizarExtracto({ encontrado: true, corteISO: '31/07/2026' });
  assert.equal(r.corteISO, null);
  assert.deepEqual(r.diferidos, []);
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

/* ---- analizarExtractoImagenes (fetch inyectado) ---- */

test('imágenes sin clave → sin-clave (no toca la red)', async () => {
  let llamado = false;
  const r = await analizarExtractoImagenes(
    { imagenes: [{ base64: 'AAA' }], apiKey: '' },
    { fetchImpl: async () => { llamado = true; return {}; } },
  );
  assert.equal(r.estado, 'sin-clave');
  assert.equal(llamado, false);
});

test('imágenes vacías → error (no toca la red)', async () => {
  let llamado = false;
  const r = await analizarExtractoImagenes(
    { imagenes: [], apiKey: 'k' },
    { fetchImpl: async () => { llamado = true; return {}; } },
  );
  assert.equal(r.estado, 'error');
  assert.equal(llamado, false);
});

test('imágenes camino feliz: manda la clave en x-api-key y normaliza', async () => {
  let headersVistos = null;
  const fetchImpl = async (url, opts) => {
    headersVistos = opts.headers;
    return { status: 200, ok: true, json: async () => ({ content: [{ type: 'tool_use', input: { corte: 8, limite: 28, encontrado: true } }] }) };
  };
  const r = await analizarExtractoImagenes({ imagenes: [{ base64: 'AAA' }], apiKey: 'sk-secreta' }, { fetchImpl });
  assert.equal(r.estado, 'ok');
  assert.equal(r.corte, 8);
  assert.equal(r.limite, 28);
  assert.equal(headersVistos['x-api-key'], 'sk-secreta');
});
