import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizar,
  adivinarCategoria,
  parseTextoLibre,
  extraerMonto,
  extraerComercio,
} from '../js/categorize.js';

/* ---------------- normalización ---------------- */

test('normalizar: minúsculas, sin tildes, espacios colapsados', () => {
  assert.equal(normalizar('  Pagué  el  ÉXITO  '), 'pague el exito');
  assert.equal(normalizar('Almuérzo Café'), 'almuerzo cafe');
});

/* ---------------- diccionario base ---------------- */

test('adivinarCategoria: transporte', () => {
  assert.equal(adivinarCategoria('taxi hasta la casa').categoriaId, 'transporte');
  assert.equal(adivinarCategoria('eché gasolina en Terpel').categoriaId, 'transporte');
  assert.equal(adivinarCategoria('pagué un uber').categoriaId, 'transporte');
});

test('adivinarCategoria: mercado', () => {
  assert.equal(adivinarCategoria('compré en el Éxito').categoriaId, 'mercado');
  assert.equal(adivinarCategoria('mercado del D1').categoriaId, 'mercado');
  assert.equal(adivinarCategoria('fui a Carulla').categoriaId, 'mercado');
});

test('adivinarCategoria: servicios públicos', () => {
  assert.equal(adivinarCategoria('pago factura EPM').categoriaId, 'servicios');
  assert.equal(adivinarCategoria('recibo de internet Claro').categoriaId, 'servicios');
  assert.equal(adivinarCategoria('el agua del acueducto').categoriaId, 'servicios');
});

test('adivinarCategoria: sin match cae en Otros', () => {
  assert.equal(adivinarCategoria('cosa rara zzz').categoriaId, 'otros');
});

/* ---------------- overrides aprendidos ---------------- */

test('override aprendido gana sobre el diccionario', () => {
  // "cafe" normalmente es restaurantes; enseñamos que "cafe wifi" es negocios
  const config = { categoriasAprendidas: { 'cafe wifi': 'negocios' } };
  assert.equal(adivinarCategoria('cafe wifi', config).categoriaId, 'negocios');
});

test('override por palabra individual también gana', () => {
  const config = { categoriasAprendidas: { taxi: 'negocios' } };
  assert.equal(adivinarCategoria('taxi al cliente', config).categoriaId, 'negocios');
});

/* ---------------- extracción de monto ---------------- */

test('extraerMonto: distintos formatos colombianos', () => {
  assert.equal(extraerMonto('taxi 15000'), 15000);
  assert.equal(extraerMonto('taxi 15.000'), 15000);
  assert.equal(extraerMonto('pagué 50k de mercado'), 50000);
  assert.equal(extraerMonto('1,5 millones de arriendo'), 1500000);
  assert.equal(extraerMonto('sin numero'), null);
});

test('extraerComercio: se queda con el nombre, sin ruido ni monto', () => {
  assert.equal(extraerComercio(normalizar('pagué 15.000 en taxi')), 'taxi');
});

/* ---------------- parseTextoLibre (integración pura) ---------------- */

test('parseTextoLibre: "taxi 15000" → 15000 + transporte + taxi', () => {
  assert.deepEqual(parseTextoLibre('taxi 15000'), {
    monto: 15000,
    categoriaId: 'transporte',
    comercio: 'taxi',
  });
});

test('parseTextoLibre: frase con verbo y preposición', () => {
  const r = parseTextoLibre('Pagué 50k de mercado');
  assert.equal(r.monto, 50000);
  assert.equal(r.categoriaId, 'mercado');
});
