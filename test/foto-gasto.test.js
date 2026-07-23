/* Tests de foto-gasto.js — funciones puras + analizarRecibo con fetch inyectado. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  construirPeticion, extraerTexto, parsearRespuesta, analizarRecibo,
  ANTHROPIC_MESSAGES_URL, MODELO_FOTO_DEFAULT,
} from '../js/foto-gasto.js';

const CATS = [
  { id: 'mercado', label: 'Supermercado' },
  { id: 'transporte', label: 'Auto' },
  { id: 'otros', label: 'Otros' },
];

test('construirPeticion arma el cuerpo con imagen + texto y modelo', () => {
  const body = construirPeticion({ base64: 'AAAA', mediaType: 'image/jpeg', categorias: CATS });
  assert.equal(body.model, MODELO_FOTO_DEFAULT);
  assert.equal(body.messages[0].role, 'user');
  const [img, txt] = body.messages[0].content;
  assert.equal(img.type, 'image');
  assert.equal(img.source.media_type, 'image/jpeg');
  assert.equal(img.source.data, 'AAAA');
  assert.equal(txt.type, 'text');
  assert.match(txt.text, /mercado \(Supermercado\)/);
});

test('construirPeticion respeta el modelo elegido', () => {
  const body = construirPeticion({ base64: 'x', mediaType: 'image/png', modelo: 'claude-x', categorias: CATS });
  assert.equal(body.model, 'claude-x');
});

test('extraerTexto junta bloques de texto y tolera formas raras', () => {
  assert.equal(extraerTexto({ content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] }), 'a\nb');
  assert.equal(extraerTexto({ content: [{ type: 'tool_use' }] }), '');
  assert.equal(extraerTexto(null), '');
  assert.equal(extraerTexto({}), '');
});

test('parsearRespuesta lee JSON limpio', () => {
  const r = parsearRespuesta('{"monto":84000,"comercio":"Frutería","categoria":"mercado"}', ['mercado', 'otros']);
  assert.deepEqual(r, { monto: 84000, comercio: 'Frutería', categoriaId: 'mercado' });
});

test('parsearRespuesta extrae el JSON aunque venga envuelto en prosa', () => {
  const r = parsearRespuesta('Claro, aquí está:\n{"monto": 12000, "comercio":"Taxi", "categoria":"transporte"} listo', ['transporte']);
  assert.equal(r.monto, 12000);
  assert.equal(r.categoriaId, 'transporte');
});

test('parsearRespuesta normaliza monto en string con puntos/símbolos', () => {
  const r = parsearRespuesta('{"monto":"$120.000","comercio":"","categoria":"otros"}', ['otros']);
  assert.equal(r.monto, 120000);
});

test('parsearRespuesta descarta categoría inválida → ""', () => {
  const r = parsearRespuesta('{"monto":5000,"comercio":"X","categoria":"inexistente"}', ['mercado']);
  assert.equal(r.categoriaId, '');
});

test('parsearRespuesta con monto no positivo o ausente → null', () => {
  assert.equal(parsearRespuesta('{"monto":0,"categoria":"otros"}', ['otros']).monto, null);
  assert.equal(parsearRespuesta('{"monto":null,"categoria":"otros"}', ['otros']).monto, null);
  assert.equal(parsearRespuesta('{"comercio":"X"}', ['otros']).monto, null);
});

test('parsearRespuesta con basura no lanza y devuelve vacíos', () => {
  assert.deepEqual(parsearRespuesta('no soy json', ['otros']), { monto: null, comercio: '', categoriaId: '' });
  assert.deepEqual(parsearRespuesta('', ['otros']), { monto: null, comercio: '', categoriaId: '' });
  assert.deepEqual(parsearRespuesta(null, ['otros']), { monto: null, comercio: '', categoriaId: '' });
});

test('analizarRecibo sin clave → sin-clave (no hace red)', async () => {
  let llamado = false;
  const r = await analizarRecibo(
    { base64: 'x', mediaType: 'image/jpeg', apiKey: '', categorias: CATS },
    { fetchImpl: async () => { llamado = true; return {}; } },
  );
  assert.equal(r.estado, 'sin-clave');
  assert.equal(llamado, false);
});

test('analizarRecibo camino feliz: manda la clave en header y devuelve datos', async () => {
  let capturado = null;
  const fetchImpl = async (url, opts) => {
    capturado = { url, opts };
    return {
      ok: true, status: 200,
      json: async () => ({ content: [{ type: 'text', text: '{"monto":84000,"comercio":"Frutería","categoria":"mercado"}' }] }),
    };
  };
  const r = await analizarRecibo(
    { base64: 'AAAA', mediaType: 'image/jpeg', apiKey: 'sk-ant-secreta', categorias: CATS },
    { fetchImpl },
  );
  assert.equal(r.estado, 'ok');
  assert.equal(r.monto, 84000);
  assert.equal(r.categoriaId, 'mercado');
  assert.equal(capturado.url, ANTHROPIC_MESSAGES_URL);
  assert.equal(capturado.opts.headers['x-api-key'], 'sk-ant-secreta');
  // la clave NUNCA debe ir en la URL
  assert.ok(!capturado.url.includes('sk-ant-secreta'));
});

test('analizarRecibo 401 → invalida (mensaje sin la clave)', async () => {
  const r = await analizarRecibo(
    { base64: 'x', mediaType: 'image/jpeg', apiKey: 'sk-secreta', categorias: CATS },
    { fetchImpl: async () => ({ ok: false, status: 401 }) },
  );
  assert.equal(r.estado, 'invalida');
  assert.ok(!r.mensaje.includes('sk-secreta'));
});

test('analizarRecibo con fallo de red → red', async () => {
  const r = await analizarRecibo(
    { base64: 'x', mediaType: 'image/jpeg', apiKey: 'k', categorias: CATS },
    { fetchImpl: async () => { throw new Error('boom'); } },
  );
  assert.equal(r.estado, 'red');
});
