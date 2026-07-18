import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORIAS,
  construirCatalogo,
  idPersonalizada,
  aplicarPersonalizacion,
  catalogo,
  categoriaPorId,
} from '../js/categories.js';

/* ---- construirCatalogo (PURA) ---- */

test('construirCatalogo: sin personalización devuelve las 14 canónicas intactas', () => {
  const cat = construirCatalogo({});
  assert.equal(cat.length, 14);
  assert.equal(cat[0].id, 'vivienda');
  assert.equal(cat[0].label, 'Vivienda / Arriendo');
});

test('construirCatalogo: sin argumentos no lanza', () => {
  assert.equal(construirCatalogo().length, 14);
});

test('construirCatalogo: un renombre cambia la etiqueta pero NO el id', () => {
  const cat = construirCatalogo({ categoriasRenombradas: { colegio: 'Universidad Sofía' } });
  const c = cat.find((x) => x.id === 'colegio');
  assert.equal(c.label, 'Universidad Sofía');
  assert.equal(c.id, 'colegio'); // id estable: los movimientos lo guardan
  assert.equal(cat.length, 14);
});

test('construirCatalogo: el renombre no muta el catálogo canónico', () => {
  construirCatalogo({ categoriasRenombradas: { colegio: 'Otra cosa' } });
  assert.equal(CATEGORIAS.find((c) => c.id === 'colegio').label, 'Colegio hija');
});

test('construirCatalogo: un renombre vacío o no-texto se ignora', () => {
  const cat = construirCatalogo({ categoriasRenombradas: { colegio: '   ', ocio: 42 } });
  assert.equal(cat.find((c) => c.id === 'colegio').label, 'Colegio hija');
  assert.equal(cat.find((c) => c.id === 'ocio').label, 'Ocio');
});

test('construirCatalogo: agrega categorías propias al final con tint neutro', () => {
  const cat = construirCatalogo({
    categoriasPersonalizadas: [{ id: 'usr-mascota', label: 'Mascota' }],
  });
  assert.equal(cat.length, 15);
  const propia = cat[14];
  assert.equal(propia.id, 'usr-mascota');
  assert.equal(propia.label, 'Mascota');
  assert.equal(propia.cls, 'cat--otros');
  assert.equal(propia.propia, true);
  assert.ok(propia.icon.startsWith('<svg'));
});

test('construirCatalogo: ignora propias sin id, sin label o duplicadas', () => {
  const cat = construirCatalogo({
    categoriasPersonalizadas: [
      { id: '', label: 'Sin id' },
      { id: 'usr-x', label: '   ' },
      { id: 'ocio', label: 'Choca con canónica' },
      { id: 'usr-ok', label: 'Válida' },
      { id: 'usr-ok', label: 'Repetida' },
      null,
    ],
  });
  assert.equal(cat.length, 15);
  assert.equal(cat[14].id, 'usr-ok');
  assert.equal(cat[14].label, 'Válida');
});

test('construirCatalogo: renombres y propias conviven', () => {
  const cat = construirCatalogo({
    categoriasRenombradas: { ocio: 'Diversión' },
    categoriasPersonalizadas: [{ id: 'usr-mascota', label: 'Mascota' }],
  });
  assert.equal(cat.find((c) => c.id === 'ocio').label, 'Diversión');
  assert.equal(cat.find((c) => c.id === 'usr-mascota').label, 'Mascota');
});

test('construirCatalogo: devuelve un arreglo congelado', () => {
  const cat = construirCatalogo({});
  assert.equal(Object.isFrozen(cat), true);
  assert.equal(Object.isFrozen(cat[0]), true);
});

/* ---- idPersonalizada (PURA) ---- */

test('idPersonalizada: slug con prefijo usr- y sin tildes', () => {
  assert.equal(idPersonalizada('Mascota'), 'usr-mascota');
  assert.equal(idPersonalizada('Educación Niña'), 'usr-educacion-nina');
});

test('idPersonalizada: nunca choca con un id canónico', () => {
  assert.equal(idPersonalizada('ocio').startsWith('usr-'), true);
});

test('idPersonalizada: resuelve colisiones con sufijo numérico', () => {
  assert.equal(idPersonalizada('Mascota', ['usr-mascota']), 'usr-mascota-2');
  assert.equal(idPersonalizada('Mascota', ['usr-mascota', 'usr-mascota-2']), 'usr-mascota-3');
});

test('idPersonalizada: nombre vacío o solo símbolos cae en usr-categoria', () => {
  assert.equal(idPersonalizada(''), 'usr-categoria');
  assert.equal(idPersonalizada('***'), 'usr-categoria');
  assert.equal(idPersonalizada(null), 'usr-categoria');
});

/* ---- catálogo activo ---- */

test('aplicarPersonalizacion: catalogo() y categoriaPorId() la respetan', () => {
  aplicarPersonalizacion({
    categoriasRenombradas: { mercado: 'Súper' },
    categoriasPersonalizadas: [{ id: 'usr-mascota', label: 'Mascota' }],
  });
  assert.equal(catalogo().length, 15);
  assert.equal(categoriaPorId('mercado').label, 'Súper');
  assert.equal(categoriaPorId('usr-mascota').label, 'Mascota');

  // volver al estado canónico no deja residuos
  aplicarPersonalizacion({});
  assert.equal(catalogo().length, 14);
  assert.equal(categoriaPorId('mercado').label, 'Mercado');
});

test('categoriaPorId: id desconocido cae en Otros', () => {
  aplicarPersonalizacion({});
  assert.equal(categoriaPorId('no-existe').id, 'otros');
});
