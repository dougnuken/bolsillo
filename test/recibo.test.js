/* ============================================================
   olbo · test/recibo.test.js
   Lectura del RECIBO de servicios públicos (energía, agua, gas,
   internet) con IA. Partes PURAS + analizarReciboImagenes con
   fetchImpl inyectado (sin red real).

   Es una lectura DISTINTA a la del extracto de crédito: lo que se saca
   de un recibo es con qué referencia se paga, cuánto y hasta cuándo.
   Comparten la red y los estados, no el contrato.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  construirPeticionReciboImagenes, construirPeticionExtractoImagenes,
  normalizarRecibo, analizarReciboImagenes,
  TOOL_RECIBO, TOOL_EXTRACTO, SISTEMA_RECIBO, MODELO_EXTRACTO_DEFAULT,
} from '../js/extracto-pdf.js';
import { MAX_REFERENCIA_PAGO } from '../js/model.js';

/* ---- construirPeticionReciboImagenes ---- */

test('arma el body con IMÁGENES + la herramienta del recibo forzada', () => {
  const body = construirPeticionReciboImagenes({
    imagenes: [{ base64: 'AAA', mediaType: 'image/png' }, { base64: 'BBB' }],
  });

  assert.equal(body.model, MODELO_EXTRACTO_DEFAULT);
  assert.equal(body.tool_choice.name, TOOL_RECIBO.name);
  assert.deepEqual(body.tools, [TOOL_RECIBO]);
  assert.equal(body.system, SISTEMA_RECIBO);
  const imgs = body.messages[0].content.filter((b) => b.type === 'image');
  assert.equal(imgs.length, 2);
  assert.equal(imgs[0].source.media_type, 'image/png');
  assert.equal(imgs[1].source.media_type, 'image/jpeg'); // default
  assert.ok(body.messages[0].content.some((b) => b.type === 'text'));
});

test('respeta el modelo pasado', () => {
  const body = construirPeticionReciboImagenes({ imagenes: [{ base64: 'x' }], modelo: 'claude-otro' });
  assert.equal(body.model, 'claude-otro');
});

test('recibo y extracto NO comparten herramienta ni sistema', () => {
  // El prompt del extracto empieza diciendo "eres un lector de extractos de
  // CRÉDITOS": mandarle una factura de la luz devolvería encontrado=false.
  const recibo = construirPeticionReciboImagenes({ imagenes: [{ base64: 'x' }] });
  const extracto = construirPeticionExtractoImagenes({ imagenes: [{ base64: 'x' }] });

  assert.notEqual(recibo.tool_choice.name, extracto.tool_choice.name);
  assert.notEqual(recibo.system, extracto.system);
  assert.equal(extracto.tool_choice.name, TOOL_EXTRACTO.name);
});

test('la referencia se pide como TEXTO: 20+ dígitos no caben en un número JSON', () => {
  // Un dígito cambiado por redondeo es un pago que el banco rechaza.
  const tipos = TOOL_RECIBO.input_schema.properties.referenciaPago.type;
  assert.ok(tipos.includes('string'));
  assert.ok(!tipos.includes('integer') && !tipos.includes('number'));
});

/* ---- normalizarRecibo ---- */

test('lee las tres cosas del recibo: referencia, valor y fecha límite', () => {
  assert.deepEqual(
    normalizarRecibo({
      proveedor: '  Air-e  ',
      referenciaPago: '4900 1234-5678',
      valor: 187_450,
      limite: 12,
      limiteISO: '2026-09-12',
      encontrado: true,
    }),
    {
      proveedor: 'Air-e',
      referenciaPago: '490012345678',
      valor: 187450,
      limite: 12,
      limiteISO: '2026-09-12',
      encontrado: true,
    },
  );
});

test('el día sale de la fecha completa cuando el modelo solo devuelve la ISO', () => {
  // Los recibos imprimen "Pague hasta 12/09/2026", no un día suelto: si el día
  // no se derivara, el formulario se quedaría sin qué poner en `diaPago`.
  const r = normalizarRecibo({ limiteISO: '2026-09-12', encontrado: true });

  assert.equal(r.limite, 12);
  assert.equal(r.limiteISO, '2026-09-12');
});

test('un día explícito manda sobre la fecha ISO', () => {
  const r = normalizarRecibo({ limite: 5, limiteISO: '2026-09-12', encontrado: true });
  assert.equal(r.limite, 5);
});

test('descarta lo que no sirve: día fuera de rango, valor <= 0, fecha basura', () => {
  const r = normalizarRecibo({ limite: 40, limiteISO: 'el martes', valor: 0, encontrado: true });

  assert.equal(r.limite, null);
  assert.equal(r.limiteISO, null);
  assert.equal(r.valor, null);
});

test('el valor acepta número o texto en pesos', () => {
  assert.equal(normalizarRecibo({ valor: '$ 187.450' }).valor, 187450);
  assert.equal(normalizarRecibo({ valor: 187450.4 }).valor, 187450);
});

test('la referencia se limpia igual que al teclearla y se corta al máximo', () => {
  assert.equal(normalizarRecibo({ referenciaPago: 'REF: 4900-1234' }).referenciaPago, '49001234');
  assert.equal(normalizarRecibo({ referenciaPago: 'sin dígitos' }).referenciaPago, null);
  assert.equal(normalizarRecibo({ referenciaPago: '9'.repeat(45) }).referenciaPago.length, MAX_REFERENCIA_PAGO);
});

test('tolerante: input basura no lanza y devuelve vacíos', () => {
  for (const basura of [null, undefined, 'texto', 42, []]) {
    const r = normalizarRecibo(basura);
    assert.equal(r.proveedor, '');
    assert.equal(r.referenciaPago, null);
    assert.equal(r.valor, null);
    assert.equal(r.limite, null);
    assert.equal(r.encontrado, false);
  }
});

/* ---- analizarReciboImagenes (fetch inyectado) ---- */

function fetchOk(input) {
  return async () => ({ status: 200, ok: true, json: async () => ({ content: [{ type: 'tool_use', input }] }) });
}

test('sin clave → sin-clave (no toca la red)', async () => {
  let llamado = false;
  const r = await analizarReciboImagenes(
    { imagenes: [{ base64: 'AAA' }], apiKey: '  ' },
    { fetchImpl: async () => { llamado = true; return {}; } },
  );

  assert.equal(r.estado, 'sin-clave');
  assert.equal(llamado, false);
});

test('sin imágenes → error (no toca la red)', async () => {
  let llamado = false;
  const r = await analizarReciboImagenes(
    { imagenes: [], apiKey: 'k' },
    { fetchImpl: async () => { llamado = true; return {}; } },
  );

  assert.equal(r.estado, 'error');
  assert.equal(llamado, false);
});

test('camino feliz: la clave viaja SOLO en x-api-key y la salida sale normalizada', async () => {
  let vistos = null;
  let cuerpo = null;
  let urlVista = null;
  const fetchImpl = async (url, opts) => {
    urlVista = url;
    vistos = opts.headers;
    cuerpo = opts.body;
    return { status: 200, ok: true, json: async () => ({
      content: [{ type: 'tool_use', input: { proveedor: 'Triple A', referenciaPago: '4900 1234', valor: 62_300, limiteISO: '2026-09-08', encontrado: true } }],
    }) };
  };

  const r = await analizarReciboImagenes({ imagenes: [{ base64: 'AAA' }], apiKey: 'sk-secreta' }, { fetchImpl });

  assert.equal(r.estado, 'ok');
  assert.equal(r.proveedor, 'Triple A');
  assert.equal(r.referenciaPago, '49001234');
  assert.equal(r.valor, 62300);
  assert.equal(r.limite, 8);
  assert.equal(vistos['x-api-key'], 'sk-secreta');
  assert.ok(!/sk-secreta/.test(cuerpo), 'la clave no puede ir en el cuerpo');
  assert.ok(!/sk-secreta/.test(urlVista), 'la clave no puede ir en la URL');
});

test('401 → clave inválida', async () => {
  const r = await analizarReciboImagenes(
    { imagenes: [{ base64: 'x' }], apiKey: 'k' },
    { fetchImpl: async () => ({ status: 401, ok: false }) },
  );
  assert.equal(r.estado, 'invalida');
});

test('fallo de red → estado red, y el mensaje no lleva la clave', async () => {
  const r = await analizarReciboImagenes(
    { imagenes: [{ base64: 'x' }], apiKey: 'sk-secreta' },
    { fetchImpl: async () => { throw new Error('down'); } },
  );

  assert.equal(r.estado, 'red');
  assert.ok(!/sk-secreta/.test(r.mensaje));
});

test('un documento que no es recibo → sin-datos', async () => {
  const r = await analizarReciboImagenes(
    { imagenes: [{ base64: 'x' }], apiKey: 'k' },
    { fetchImpl: fetchOk({ encontrado: false }) },
  );
  assert.equal(r.estado, 'sin-datos');
});

test('encontrado=false pero con datos legibles NO es "sin-datos"', async () => {
  // Mismo criterio que el extracto: "sin-datos" se reserva para cuando no hubo
  // NADA que leer. Que el modelo dude de si el papel es un recibo no borra el
  // valor y la referencia que ya extrajo; quién decide qué hacer con eso es la
  // vista, no la capa de red.
  const r = await analizarReciboImagenes(
    { imagenes: [{ base64: 'x' }], apiKey: 'k' },
    { fetchImpl: fetchOk({ encontrado: false, valor: 90_000, referenciaPago: '123' }) },
  );

  assert.equal(r.estado, 'ok');
  assert.equal(r.encontrado, false);
  assert.equal(r.valor, 90000);
});

test('sin bloque tool_use → error', async () => {
  const r = await analizarReciboImagenes(
    { imagenes: [{ base64: 'x' }], apiKey: 'k' },
    { fetchImpl: async () => ({ status: 200, ok: true, json: async () => ({ content: [{ type: 'text', text: 'hola' }] }) }) },
  );
  assert.equal(r.estado, 'error');
});
