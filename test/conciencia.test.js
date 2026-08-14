import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  construirContexto,
  construirPeticion,
  describirCredito,
  extraerTexto,
  diagnosticar,
  motivoVacio,
  mensajeApiError,
  aconsejar,
  SISTEMA,
  MAX_TOKENS,
  MODELO_CONCIENCIA_DEFAULT,
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

const IMG = (b) => ({ base64: b, mediaType: 'image/jpeg' });

/* Respuesta 200 de /v1/messages, moldeable. */
const ok200 = (cuerpo) => ({ ok: true, status: 200, json: async () => cuerpo });
const err = (status, cuerpo = {}) => ({ ok: false, status, json: async () => cuerpo });

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

test('construirContexto: anexa el brief de deuda diferida cuando viene', () => {
  const ctx = construirContexto({
    salario: 3_000_000,
    deudaDiferidos: 'DEUDA DIFERIDA — Banco Demo:\n  · 1. TIENDA*DEMO · saldo $400.000 · SE PUEDE AISLAR',
  });
  assert.match(ctx, /DEUDA DIFERIDA/);
  assert.match(ctx, /TIENDA/);
});

test('construirContexto: sin deuda diferida, no aparece el encabezado', () => {
  const ctx = construirContexto({ salario: 3_000_000 });
  assert.doesNotMatch(ctx, /DEUDA DIFERIDA/);
});

test('describirCredito: dice explícitamente qué falta por registrar', () => {
  const d = describirCredito({ entidad: 'Bancolombia', producto: 'Tarjeta', cuotaMensual: 350_000 });
  assert.match(d, /Bancolombia · Tarjeta/);
  assert.match(d, /cuota registrada \$350\.000/);
  assert.match(d, /saldo SIN registrar/);
  assert.match(d, /tasa SIN registrar/);
  assert.match(d, /día de pago SIN registrar/);
});

test('construirPeticion (chat): system lleva persona + contexto; incluye la pregunta', () => {
  const body = construirPeticion({ contexto: 'CTX', nombre: 'Doug', modo: 'chat', pregunta: '¿Me alcanza?' });
  assert.ok(body.system.startsWith('Eres la conciencia financiera de Doug'));
  assert.match(body.system, /CTX$/);
  assert.equal(body.messages.at(-1).role, 'user');
  assert.equal(body.messages.at(-1).content, '¿Me alcanza?');
  assert.equal(body.model, MODELO_CONCIENCIA_DEFAULT);
  assert.equal(body.max_tokens, MAX_TOKENS.chat);
});

test('construirPeticion: el modelo se puede sobreescribir desde la config', () => {
  const body = construirPeticion({ contexto: 'CTX', modo: 'chat', pregunta: 'q', modelo: 'claude-opus-5' });
  assert.equal(body.model, 'claude-opus-5');
});

test('construirPeticion: los techos son holgados (nadie se queda sin espacio para escribir)', () => {
  // Un techo corto es la causa raíz de "la respuesta llegó vacía".
  assert.ok(MAX_TOKENS.chat >= 1000);
  assert.ok(MAX_TOKENS.documento > MAX_TOKENS.chat);
  assert.ok(MAX_TOKENS.reintento > MAX_TOKENS.documento);
  assert.ok(MAX_TOKENS.susurro >= 200);
});

test('construirPeticion: por defecto NO manda thinking; el reintento sí lo apaga', () => {
  const normal = construirPeticion({ contexto: 'CTX', modo: 'chat', pregunta: 'q' });
  assert.equal('thinking' in normal, false);
  const reintento = construirPeticion({ contexto: 'CTX', modo: 'chat', pregunta: 'q', sinPensar: true, maxTokens: 4000 });
  assert.deepEqual(reintento.thinking, { type: 'disabled' });
  assert.equal(reintento.max_tokens, 4000);
});

test('construirPeticion (chat): arrastra el historial en orden', () => {
  const body = construirPeticion({
    contexto: 'CTX', modo: 'chat', pregunta: 'y ahora?',
    historialChat: [{ rol: 'user', texto: 'hola' }, { rol: 'assistant', texto: 'qué hubo' }],
  });
  assert.deepEqual(body.messages.map((m) => m.role), ['user', 'assistant', 'user']);
  assert.equal(body.messages[0].content, 'hola');
});

test('construirPeticion: un turno del historial sin texto no manda contenido vacío', () => {
  const body = construirPeticion({
    contexto: 'CTX', modo: 'chat', pregunta: 'q',
    historialChat: [{ rol: 'user', texto: '' }, { rol: 'assistant', texto: 'ajá' }],
  });
  for (const m of body.messages) {
    if (typeof m.content === 'string') assert.notEqual(m.content.trim(), '');
  }
});

test('construirPeticion (chat con adjunto): el mensaje lleva imágenes + texto', () => {
  const body = construirPeticion({
    contexto: 'CTX', modo: 'chat', pregunta: '¿qué ves acá?',
    imagenes: [IMG('AAA'), { base64: 'BBB' }],
  });
  const ultimo = body.messages.at(-1);
  assert.equal(Array.isArray(ultimo.content), true);
  assert.equal(ultimo.content.filter((b) => b.type === 'image').length, 2);
  assert.equal(ultimo.content.at(-1).type, 'text');
  assert.equal(ultimo.content.at(-1).text, '¿qué ves acá?');
  assert.equal(body.max_tokens, MAX_TOKENS.documento);
});

test('construirPeticion (chat con adjunto sin texto): usa una pregunta por defecto', () => {
  const body = construirPeticion({ contexto: 'CTX', modo: 'chat', imagenes: [IMG('AAA')] });
  const t = body.messages.at(-1).content.at(-1).text;
  assert.match(t, /extracto|documento/i);
});

test('construirPeticion (adjunto): el system ordena LEER el documento y decir qué es', () => {
  const body = construirPeticion({ contexto: 'CTX', modo: 'chat', pregunta: 'q', imagenes: [IMG('A'), IMG('B')] });
  assert.match(body.system, /DOCUMENTO ADJUNTO \(2 páginas\)/);
  assert.match(body.system, /LÉELAS de verdad/);
  assert.match(body.system, /QUÉ es el documento/);
});

test('construirPeticion (adjunto de un crédito): nombra el crédito y pide comparar', () => {
  const body = construirPeticion({
    contexto: 'CTX', modo: 'chat', pregunta: 'q', imagenes: [IMG('A')],
    creditoVinculado: { entidad: 'Bancolombia', producto: 'Tarjeta', cuotaMensual: 350_000, saldo: 4_000_000 },
  });
  assert.match(body.system, /ESTE DOCUMENTO ES DEL CRÉDITO: Bancolombia · Tarjeta/);
  assert.match(body.system, /saldo registrado \$4\.000\.000/);
  assert.match(body.system, /CANTA las diferencias/);
});

test('construirPeticion (adjunto sin crédito): no lo cuelga de ninguna deuda', () => {
  const body = construirPeticion({ contexto: 'CTX', modo: 'chat', pregunta: 'q', imagenes: [IMG('A')], sinCredito: true });
  assert.match(body.system, /NO corresponde a ninguno de sus créditos/);
  assert.doesNotMatch(body.system, /PREGÚNTALE/);
});

test('construirPeticion (adjunto sin responder de cuál crédito es): el agente debe preguntarlo', () => {
  const body = construirPeticion({ contexto: 'CTX', modo: 'chat', pregunta: 'q', imagenes: [IMG('A')] });
  assert.match(body.system, /PREGÚNTALE al final de cuál de sus créditos es/);
});

test('construirPeticion: el documento del historial sigue a la vista en la repregunta', () => {
  const body = construirPeticion({
    contexto: 'CTX', modo: 'chat', pregunta: '¿y la tasa?',
    historialChat: [
      { rol: 'user', texto: 'mira esto', imagenes: [IMG('PAG1'), IMG('PAG2')], credito: { entidad: 'Davivienda', producto: 'Libre inversión' } },
      { rol: 'assistant', texto: 'ese saldo te ahoga' },
    ],
  });
  const primero = body.messages[0];
  assert.equal(Array.isArray(primero.content), true);
  assert.equal(primero.content.filter((b) => b.type === 'image').length, 2);
  // Y el system sigue sabiendo que hay documento, y de qué crédito es.
  assert.match(body.system, /DOCUMENTO ADJUNTO \(2 páginas\)/);
  assert.match(body.system, /Davivienda · Libre inversión/);
  assert.equal(body.max_tokens, MAX_TOKENS.documento);
});

test('construirPeticion: si este turno trae documento, el del historial NO se reenvía', () => {
  const body = construirPeticion({
    contexto: 'CTX', modo: 'chat', pregunta: 'ahora este',
    imagenes: [IMG('NUEVA')],
    historialChat: [
      { rol: 'user', texto: 'el viejo', imagenes: [IMG('VIEJA')] },
      { rol: 'assistant', texto: 'ok' },
    ],
  });
  const imagenes = body.messages.flatMap((m) => (Array.isArray(m.content) ? m.content : [])).filter((b) => b.type === 'image');
  assert.equal(imagenes.length, 1);
  assert.equal(imagenes[0].source.data, 'NUEVA');
});

test('construirPeticion: solo se reenvía el documento MÁS RECIENTE del historial', () => {
  const body = construirPeticion({
    contexto: 'CTX', modo: 'chat', pregunta: 'q',
    historialChat: [
      { rol: 'user', texto: 'doc 1', imagenes: [IMG('UNO')] },
      { rol: 'assistant', texto: 'ok' },
      { rol: 'user', texto: 'doc 2', imagenes: [IMG('DOS')] },
      { rol: 'assistant', texto: 'ok' },
    ],
  });
  const imagenes = body.messages.flatMap((m) => (Array.isArray(m.content) ? m.content : [])).filter((b) => b.type === 'image');
  assert.equal(imagenes.length, 1);
  assert.equal(imagenes[0].source.data, 'DOS');
});

test('construirPeticion (susurro): una sola frase pedida, menciona el gasto', () => {
  const body = construirPeticion({
    contexto: 'CTX', modo: 'susurro',
    movimiento: { monto: 65_450, comercio: 'Sushi', categoriaLabel: 'Restaurantes' },
  });
  assert.equal(body.max_tokens, MAX_TOKENS.susurro);
  assert.equal(body.messages.length, 1);
  assert.match(body.messages[0].content, /\$65\.450/);
  assert.match(body.messages[0].content, /Sushi · Restaurantes/);
});

test('extraerTexto: junta bloques de texto e ignora el resto', () => {
  const cuerpo = { content: [{ type: 'text', text: 'Ese ' }, { type: 'tool_use' }, { type: 'text', text: 'sushi no cabía.' }] };
  assert.equal(extraerTexto(cuerpo), 'Ese \nsushi no cabía.');
});

test('diagnosticar: distingue "pensó y no escribió" de "no trajo nada"', () => {
  const pensando = diagnosticar({ content: [{ type: 'thinking', thinking: '…' }], stop_reason: 'max_tokens' });
  assert.equal(pensando.texto, '');
  assert.equal(pensando.pensando, true);
  assert.equal(pensando.stopReason, 'max_tokens');

  const vacio = diagnosticar({ content: [], stop_reason: 'end_turn' });
  assert.equal(vacio.pensando, false);
  assert.deepEqual(vacio.tipos, []);
});

test('motivoVacio: el techo agotado se explica y se ofrece cambiar de modelo', () => {
  assert.match(motivoVacio({ stopReason: 'max_tokens' }), /sin espacio/i);
  assert.match(motivoVacio({ stopReason: 'max_tokens' }), /Modelos/);
  assert.match(motivoVacio({ pensando: true }), /razonando/);
  assert.match(motivoVacio({ stopReason: 'refusal' }), /se negó/);
  assert.match(motivoVacio({}), /sin texto/);
});

test('mensajeApiError: usa el mensaje real del API y aguanta basura', () => {
  assert.equal(mensajeApiError({ error: { message: 'max_tokens: 500 > 200' } }, 400), 'max_tokens: 500 > 200');
  assert.match(mensajeApiError(null, 500), /HTTP 500/);
  assert.match(mensajeApiError({ error: 'nope' }, 400), /HTTP 400/);
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
    return ok200({ content: [{ type: 'text', text: 'Estás quebrado, ubícate.' }] });
  };
  const r = await aconsejar({ contexto: 'CTX', nombre: 'Doug', modo: 'chat', pregunta: 'y?', apiKey: 'sk-test' }, { fetchImpl: fakeFetch });
  assert.equal(r.estado, 'ok');
  assert.equal(r.texto, 'Estás quebrado, ubícate.');
  assert.equal(capturado.opts.headers['x-api-key'], 'sk-test');
  assert.doesNotMatch(capturado.opts.body, /sk-test/); // la clave NO va en el cuerpo
});

test('aconsejar: 200 sin texto → reintenta con más techo y sin razonar, y responde', async () => {
  const cuerpos = [];
  const fakeFetch = async (url, opts) => {
    cuerpos.push(JSON.parse(opts.body));
    return cuerpos.length === 1
      ? ok200({ content: [{ type: 'thinking', thinking: '…' }], stop_reason: 'max_tokens' })
      : ok200({ content: [{ type: 'text', text: 'Ahora sí: te sobran $200.000.' }] });
  };
  const r = await aconsejar({ contexto: 'CTX', modo: 'chat', pregunta: 'q', apiKey: 'sk' }, { fetchImpl: fakeFetch });
  assert.equal(r.estado, 'ok');
  assert.equal(r.texto, 'Ahora sí: te sobran $200.000.');
  assert.equal(cuerpos.length, 2);
  assert.equal(cuerpos[1].max_tokens, MAX_TOKENS.reintento);
  assert.deepEqual(cuerpos[1].thinking, { type: 'disabled' });
});

test('aconsejar: si el reintento también llega sin texto, explica el motivo (no "vacía" a secas)', async () => {
  let llamadas = 0;
  const fakeFetch = async () => { llamadas++; return ok200({ content: [], stop_reason: 'max_tokens' }); };
  const r = await aconsejar({ contexto: 'CTX', modo: 'chat', pregunta: 'q', apiKey: 'sk' }, { fetchImpl: fakeFetch });
  assert.equal(llamadas, 2);            // se intenta dos veces, no más
  assert.equal(r.estado, 'error');
  assert.match(r.mensaje, /sin espacio/i);
  assert.doesNotMatch(r.mensaje, /llegó vacía/);
});

test('aconsejar: 404 → dice qué modelo falta y dónde cambiarlo', async () => {
  const fakeFetch = async () => err(404, { error: { message: 'model not found' } });
  const r = await aconsejar(
    { contexto: 'x', modo: 'chat', pregunta: 'q', apiKey: 'sk', modelo: 'claude-inexistente' },
    { fetchImpl: fakeFetch },
  );
  assert.equal(r.estado, 'error');
  assert.match(r.mensaje, /claude-inexistente/);
  assert.match(r.mensaje, /Modelos/);
});

test('aconsejar: 400 → el mensaje trae el motivo REAL del API', async () => {
  const fakeFetch = async () => err(400, { error: { type: 'invalid_request_error', message: 'messages.0: image exceeds 5 MB' } });
  const r = await aconsejar({ contexto: 'x', modo: 'chat', pregunta: 'q', apiKey: 'sk' }, { fetchImpl: fakeFetch });
  assert.equal(r.estado, 'error');
  assert.match(r.mensaje, /image exceeds 5 MB/);
});

test('aconsejar: 529 (saturado) → espera y reintenta una sola vez', async () => {
  let llamadas = 0;
  const esperas = [];
  const fakeFetch = async () => {
    llamadas++;
    return llamadas === 1 ? err(529, { error: { message: 'Overloaded' } }) : ok200({ content: [{ type: 'text', text: 'listo' }] });
  };
  const r = await aconsejar(
    { contexto: 'x', modo: 'chat', pregunta: 'q', apiKey: 'sk' },
    { fetchImpl: fakeFetch, esperar: async (ms) => { esperas.push(ms); } },
  );
  assert.equal(r.estado, 'ok');
  assert.equal(llamadas, 2);
  assert.equal(esperas.length, 1);
});

test('aconsejar: un 400 corriente NO se reintenta', async () => {
  let llamadas = 0;
  const fakeFetch = async () => { llamadas++; return err(400, { error: { message: 'bad' } }); };
  await aconsejar({ contexto: 'x', modo: 'chat', pregunta: 'q', apiKey: 'sk' }, { fetchImpl: fakeFetch });
  assert.equal(llamadas, 1);
});

test('aconsejar: 401 → invalida; el mensaje no filtra la clave', async () => {
  const fakeFetch = async () => err(401, {});
  const r = await aconsejar({ contexto: 'x', apiKey: 'sk-secreta', modo: 'chat', pregunta: 'q' }, { fetchImpl: fakeFetch });
  assert.equal(r.estado, 'invalida');
  assert.doesNotMatch(r.mensaje, /sk-secreta/);
});

test('aconsejar: aunque el API devolviera la clave en su texto, no sale a pantalla', async () => {
  const clave = 'sk-ant-clave-larga-de-prueba';
  const fakeFetch = async () => ok200({ content: [{ type: 'text', text: `tu clave ${clave} está mal` }] });
  const r = await aconsejar({ contexto: 'x', apiKey: clave, modo: 'chat', pregunta: 'q' }, { fetchImpl: fakeFetch });
  assert.doesNotMatch(r.texto, /sk-ant-clave-larga/);
});

test('aconsejar: fallo de red → estado red', async () => {
  const fakeFetch = async () => { throw new Error('boom'); };
  const r = await aconsejar({ contexto: 'x', apiKey: 'sk', modo: 'chat', pregunta: 'q' }, { fetchImpl: fakeFetch });
  assert.equal(r.estado, 'red');
});

test('SISTEMA es crudo pero con propósito (no humillar) y sin groserías', () => {
  assert.match(SISTEMA, /CRUDA/);
  assert.match(SISTEMA, /no para humillarlo/);
  assert.match(SISTEMA, /sin groserías/);
});
