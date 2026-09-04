/* ============================================================
   olbo · test/meses.test.js
   Navegación por los meses ya registrados. Fechas y montos FICTICIOS.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mesesConDatos, etiquetaMes, etiquetaMesCorta, finDeMes,
  mesVecino, mesPorDefecto, esClaveMes,
} from '../js/meses.js';

const mov = (fecha, monto = 1000) => ({ fecha, monto, tipo: 'gasto' });

test('lista los meses con datos, del más reciente al más viejo', () => {
  const l = mesesConDatos({ movimientos: [mov('2026-07-03'), mov('2026-08-31'), mov('2026-07-28')] });

  assert.deepEqual(l, ['2026-08', '2026-07']);
});

test('no inventa meses vacíos entre medias', () => {
  // Un rango de calendario metería mayo, junio y julio; abrir un mes en blanco
  // no dice nada y en una app que se llena poco a poco serían la mayoría.
  const l = mesesConDatos({ movimientos: [mov('2026-04-10'), mov('2026-08-02')] });

  assert.deepEqual(l, ['2026-08', '2026-04']);
});

test('ignora fechas basura sin lanzar', () => {
  const l = mesesConDatos({ movimientos: [mov('ayer'), mov(''), { monto: 5 }, null, mov('2026-08-01')] });

  assert.deepEqual(l, ['2026-08']);
});

test('entradas basura devuelven lista vacía', () => {
  for (const args of [undefined, {}, { movimientos: 'no' }]) {
    assert.deepEqual(mesesConDatos(args), []);
  }
});

test('finDeMes cae en el ÚLTIMO día, no en el primero', () => {
  // budget.js reparte cuotas según el mes en curso: parado en el día 1 se vería
  // el mes recién empezado en vez del mes completo que se quiere revisar.
  const d = finDeMes('2026-08');

  assert.equal(d.getMonth(), 7);      // agosto
  assert.equal(d.getDate(), 31);
});

test('finDeMes acierta en meses cortos y en bisiesto', () => {
  assert.equal(finDeMes('2026-04').getDate(), 30);
  assert.equal(finDeMes('2026-02').getDate(), 28);
  assert.equal(finDeMes('2024-02').getDate(), 29);
});

test('finDeMes rechaza claves inválidas', () => {
  for (const v of ['2026-13', '2026-00', 'agosto', '', null, '2026-8']) {
    assert.equal(finDeMes(v), null);
  }
});

test('mesVecino se salta los huecos en vez de caer en un mes vacío', () => {
  const l = ['2026-08', '2026-04'];   // no hubo nada entre mayo y julio

  assert.equal(mesVecino(l, '2026-08', -1), '2026-04');
  assert.equal(mesVecino(l, '2026-04', +1), '2026-08');
});

test('mesVecino devuelve null en los extremos', () => {
  const l = ['2026-08', '2026-07'];

  assert.equal(mesVecino(l, '2026-08', +1), null);   // no hay nada más reciente
  assert.equal(mesVecino(l, '2026-07', -1), null);   // ni más viejo
  assert.equal(mesVecino(l, '2026-01', -1), null);   // mes que no está en la lista
});

test('el mes por defecto es el más reciente CON datos, no el de hoy', () => {
  // Si abres la app en septiembre y solo registraste hasta agosto, lo útil es
  // ver agosto — no un septiembre en blanco.
  const m = mesPorDefecto({
    movimientos: [mov('2026-08-15')],
    hoy: new Date(2026, 8, 3),
  });

  assert.equal(m, '2026-08');
});

test('sin movimientos, el mes por defecto es el de hoy', () => {
  assert.equal(mesPorDefecto({ movimientos: [], hoy: new Date(2026, 8, 3) }), '2026-09');
});

test('las etiquetas se leen en cristiano', () => {
  assert.equal(etiquetaMes('2026-08'), 'Agosto 2026');
  assert.equal(etiquetaMes('2026-01'), 'Enero 2026');
  assert.equal(etiquetaMes('basura'), '');
  assert.equal(etiquetaMesCorta('2026-08'), 'ago');
  assert.equal(etiquetaMesCorta('2026-12'), 'dic');
});

test('esClaveMes solo acepta YYYY-MM válido', () => {
  assert.equal(esClaveMes('2026-08'), true);
  for (const v of ['2026-13', '2026-00', '2026-8', '2026/08', '', null, 26]) {
    assert.equal(esClaveMes(v), false);
  }
});
