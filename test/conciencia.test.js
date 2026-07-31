import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  construirContexto,
  construirPeticion,
  extraerTexto,
  aconsejar,
  SISTEMA,
} from '../js/conciencia.js';

const FACTS = {
  salario: 17_656_569,
  plataDelMes: 17_656_569,
  saldoDisponible: 9_568_142,
  gastadoTotal: 8_088_427,
  fijosDelMes: 6_650_908,
  cuotasCredito: 8_452_531,
  netoMes: 1_115_611,
  etiquetaSemaforo: 'Vas bien',
  topCategorias: [
    { label: 'Mercado', total: 2_342_780 },
    { label: 'Hogar', total: 1_532_990 },
  ],
  creditos: [
    { entidad: 'Riverside', cuotaMensual: 3_473_840 },
    { entidad: 'Addi', cuotaMensual: 349_177, saldo: 1_794_096 },
  ],
};

test('construirContexto: incluye las cifras clave formateadas en COP', () => {
  const ctx = construirContexto(FACTS);
  assert.match(ctx, /Sueldo base mensual: \$17\.656\.569/);
  assert.match(ctx, /Cuotas de crédito al mes.*\$8\.452\.531/);
  assert.match(ctx, /Flujo REAL del mes.*\$1\.115\.611/);
  assert.match(ctx, /Mercado: \$2\.342\.780/);
  assert.match(ctx, /Riverside.*cuota \$3\.473\.840/);
  assert.match(ctx, /Addi.*saldo \$1\.794\.096/);
});

test('construirContexto: omite lo que no viene (no imprime NaN ni undefined)', () => {
  const ctx = construirContexto({ salario: 3_000_000 });
  assert.match(ctx, /Sueldo base mensual: \$3\.000\.000/);
  assert.doesNotMatch(ctx, /NaN|undefined|\$0/);
});

test('construirPeticion (chat): system lleva persona + contexto; incluye la pregunta', () => {
  const body = construirPeticion({ contexto: 'CTX', nombre: 'Doug', modo: 'chat', pregunta: '¿Me alcanza?' });
  assert.ok(body.system.startsWith('Eres la conciencia financiera de Doug'));
  assert.match(body.system, /CTX$/);
  assert.equal(body.messages.at(-1).role, 'user');
  assert.equal(body.messages.at(-1).content, '¿Me alcanza?');
  assert.equal(body.max_tokens, 500);
});

test('construirPeticion (chat): arrastra el historial en orden', () => {
  const body = construirPeticion({
    contexto: 'CTX', modo: 'chat', pregunta: 'y ahora?',
    historialChat: [{ rol: 'user', texto: 'hola' }, { rol: 'assistant', texto: 'qué hubo' }],
  });
  assert.deepEqual(body.messages.map((m) => m.role), ['user', 'assistant', 'user']);
  assert.equal(body.messages[0].content, 'hola');
});

test('construirPeticion (susurro): una sola frase pedida, tokens cortos, menciona el gasto', () => {
  const body = construirPeticion({
    contexto: 'CTX', modo: 'susurro',
    movimiento: { monto: 65_450, comercio: 'Sushi', categoriaLabel: 'Restaurantes' },
  });
  assert.equal(body.max_tokens, 80);
  assert.equal(body.messages.length, 1);
  assert.match(body.messages[0].content, /\$65\.450/);
  assert.match(body.messages[0].content, /Sushi · Restaurantes/);
});

test('extraerTexto: junta bloques de texto e ignora el resto', () => {
  const cuerpo = { content: [{ type: 'text', text: 'Ese ' }, { type: 'tool_use' }, { type: 'text', text: 'sushi no cabía.' }] };
  assert.equal(extraerTexto(cuerpo), 'Ese \nsushi no cabía.');
});

test('SISTEMA es crudo pero con propósito (no humillar) y sin groserías', () => {
  assert.match(SISTEMA, /CRUDA/);
  assert.match(SISTEMA, /no para humillarlo/);
  assert.match(SISTEMA, /sin groserías/);
});

test('aconsejar: sin clave → estado sin-clave, no toca la red', async () => {
  let llamado = false;
  const r = await aconsejar({ contexto: 'x', apiKey: '  ' }, { fetchImpl: () => { llamado = true; } });
  assert.equal(r.estado, 'sin-clave');
  assert.equal(llamado, false);
});

test('aconsejar: camino feliz manda la clave en header y devuelve el texto', async () => {
  let capturado = null;
  const fakeFetch = async (url, opts) => {
    capturado = { url, opts };
    return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: 'Estás quebrado, ubícate.' }] }) };
  };
  const r = await aconsejar({ contexto: 'CTX', nombre: 'Doug', modo: 'chat', pregunta: 'y?', apiKey: 'sk-test' }, { fetchImpl: fakeFetch });
  assert.equal(r.estado, 'ok');
  assert.equal(r.texto, 'Estás quebrado, ubícate.');
  assert.equal(capturado.opts.headers['x-api-key'], 'sk-test');
  assert.doesNotMatch(capturado.opts.body, /sk-test/); // la clave NO va en el cuerpo
});

test('aconsejar: 401 → invalida; el mensaje no filtra la clave', async () => {
  const fakeFetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
  const r = await aconsejar({ contexto: 'x', apiKey: 'sk-secreta', modo: 'chat', pregunta: 'q' }, { fetchImpl: fakeFetch });
  assert.equal(r.estado, 'invalida');
  assert.doesNotMatch(r.mensaje, /sk-secreta/);
});

test('aconsejar: fallo de red → estado red', async () => {
  const fakeFetch = async () => { throw new Error('boom'); };
  const r = await aconsejar({ contexto: 'x', apiKey: 'sk', modo: 'chat', pregunta: 'q' }, { fetchImpl: fakeFetch });
  assert.equal(r.estado, 'red');
});
