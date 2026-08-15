/* ============================================================
   olbo · test/consumos.test.js

   Los CONSUMOS del extracto: qué se compró en el ciclo de esa tarjeta.
   Son SOLO LECTURA. Un crédito ya pesa en el mes por su cuota, así que si
   estos consumos entraran al gasto se contaría dos veces la misma plata y el
   semáforo quedaría inservible. Casi todo lo que se prueba aquí es esa
   frontera.
   Comercios y montos FICTICIOS.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarExtracto } from '../js/extracto-pdf.js';
import { crearCorte, resumenConsumos, briefProducto, MAX_CONSUMOS } from '../js/diferidos.js';
import { corteDesdeExtracto } from '../js/ingesta-corte.js';

const FICHA = { entidad: 'Banco Demo', producto: 'Tarjeta Uno' };
const lectura = (extra = {}) => normalizarExtracto({
  encontrado: true, corteISO: '2026-08-15', limiteISO: '2026-09-03', ...extra,
});

test('el lector los expone como "consumos", no como "movimientos"', () => {
  // El nombre distinto es la barrera: hace difícil meterlos por error en el
  // store `movimientos`, que sí entra al cálculo del mes.
  const r = lectura({ movimientos: [{ descripcion: 'TIENDA DEMO', monto: 90000, fecha: '2026-08-02' }] });

  assert.equal(r.consumos.length, 1);
  assert.equal(r.movimientos, undefined);
});

test('descarta consumos sin descripción y sanea el resto', () => {
  const r = lectura({
    movimientos: [
      { descripcion: '  MERCADO DEMO  ', monto: 120000, fecha: '2026-08-03' },
      { descripcion: '', monto: 50000 },
      { monto: 50000 },
      'basura',
      null,
    ],
  });

  assert.equal(r.consumos.length, 1);
  assert.equal(r.consumos[0].descripcion, 'MERCADO DEMO');
  assert.equal(r.consumos[0].monto, 120000);
});

test('un consumo sin monto legible se conserva con monto null', () => {
  // Vale más saber que existe la compra que descartarla por no leer la cifra.
  const r = lectura({ movimientos: [{ descripcion: 'COMERCIO DEMO' }] });

  assert.equal(r.consumos.length, 1);
  assert.equal(r.consumos[0].monto, null);
});

test('el corte los guarda y quedan congelados', () => {
  const corte = crearCorte({
    ...FICHA, moneda: 'COP', corte: '2026-08-15',
    diferidos: [], consumos: [{ descripcion: 'TIENDA DEMO', monto: 90000, fecha: '2026-08-02' }],
  });

  assert.equal(corte.consumos.length, 1);
  assert.throws(() => { corte.consumos.push({}); }, TypeError);
});

test('el corte tapa la lista: un extracto enorme no infla el contexto', () => {
  const muchos = Array.from({ length: MAX_CONSUMOS + 50 }, (_, i) => ({ descripcion: `COMERCIO ${i}`, monto: 1000 }));
  const corte = crearCorte({ ...FICHA, moneda: 'COP', corte: '2026-08-15', diferidos: [], consumos: muchos });

  assert.equal(corte.consumos.length, MAX_CONSUMOS);
});

test('un extracto SIN diferidos pero con consumos ya no se descarta', () => {
  // Antes se exigían diferidos, así que un extracto de puras compras de
  // contado se perdía entero.
  const r = lectura({ movimientos: [{ descripcion: 'TIENDA DEMO', monto: 90000 }] });
  const ing = corteDesdeExtracto({ ...r, estado: 'ok' }, FICHA);

  assert.equal(ing.ok, true);
  assert.equal(ing.corte.consumos.length, 1);
  assert.deepEqual(ing.corte.diferidos, []);
});

test('un extracto sin diferidos NI consumos sí se descarta', () => {
  const r = lectura();
  const ing = corteDesdeExtracto({ ...r, estado: 'ok' }, FICHA);

  assert.equal(ing.ok, false);
  assert.equal(ing.motivo, 'sin-diferidos');
});

test('resumenConsumos suma y saca los mayores', () => {
  const r = resumenConsumos([
    { descripcion: 'A', monto: 10000 },
    { descripcion: 'B', monto: 500000 },
    { descripcion: 'C', monto: 90000 },
    { descripcion: 'D', monto: null },
  ], 2);

  assert.equal(r.cuantos, 3);
  assert.equal(r.total, 600000);
  assert.deepEqual(r.mayores.map((m) => m.descripcion), ['B', 'C']);
});

test('resumenConsumos aguanta basura', () => {
  for (const v of [undefined, null, 'texto', 42, [null, {}]]) {
    const r = resumenConsumos(v);
    assert.equal(r.cuantos, 0);
    assert.equal(r.total, 0);
  }
});

test('el brief ADVIERTE que no se sumen al gasto del mes', () => {
  // La advertencia tiene que viajar en el texto, no solo estar en el código:
  // es lo único que impide que la conciencia los cuente dos veces.
  const corte = crearCorte({
    ...FICHA, moneda: 'COP', corte: '2026-08-15',
    diferidos: [],
    consumos: [{ descripcion: 'TIENDA DEMO', monto: 90000, fecha: '2026-08-02' }],
  });
  const brief = briefProducto(corte, null);

  assert.match(brief, /EN QUÉ SE FUE ESTE CICLO/);
  assert.match(brief, /NO se suman al gasto del mes/);
  assert.match(brief, /TIENDA DEMO/);
});

test('sin consumos, el brief no menciona el bloque', () => {
  const corte = crearCorte({ ...FICHA, moneda: 'COP', corte: '2026-08-15', diferidos: [], consumos: [] });

  assert.equal(briefProducto(corte, null).includes('EN QUÉ SE FUE'), false);
});
