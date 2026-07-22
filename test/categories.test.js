import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORIAS,
  construirCatalogo,
  idPersonalizada,
  aplicarPersonalizacion,
  catalogo,
  catalogoVisible,
  categoriaPorId,
  iconoDe,
} from '../js/categories.js';

const TOTAL = CATEGORIAS.length; // 18 por defecto (14 ids preservados + 4 personas)

/* ---- defaults NEUTROS ---- */

test('CATEGORIAS: los defaults son neutros y arrancan por las personas', () => {
  assert.equal(TOTAL, 18);
  assert.equal(CATEGORIAS[0].id, 'persona1');
  assert.equal(CATEGORIAS[0].label, 'Persona 1');
  assert.equal(CATEGORIAS[3].id, 'yo');
  assert.equal(CATEGORIAS[3].label, 'Yo');
  // ningún label por defecto contiene referencias personales
  const labels = CATEGORIAS.map((c) => c.label.toLowerCase()).join(' ');
  assert.equal(/hija|madre|mam[aá]|novia|esposa/.test(labels), false);
});

test('CATEGORIAS: preserva los ids viejos para no orfanar movimientos', () => {
  const ids = new Set(CATEGORIAS.map((c) => c.id));
  for (const viejo of ['vivienda', 'servicios', 'mercado', 'transporte', 'colegio',
    'seguros', 'salud', 'creditos', 'comisiones', 'ocio', 'restaurantes', 'hormiga',
    'negocios', 'otros']) {
    assert.equal(ids.has(viejo), true, `falta el id preservado "${viejo}"`);
  }
});

/* ---- construirCatalogo (PURA) ---- */

test('construirCatalogo: sin personalización devuelve los defaults intactos', () => {
  const cat = construirCatalogo({});
  assert.equal(cat.length, TOTAL);
  assert.equal(cat[0].id, 'persona1');
  assert.equal(cat[0].label, 'Persona 1');
});

test('construirCatalogo: sin argumentos no lanza', () => {
  assert.equal(construirCatalogo().length, TOTAL);
});

test('construirCatalogo: un renombre cambia la etiqueta pero NO el id', () => {
  const cat = construirCatalogo({ categoriasRenombradas: { colegio: 'Educación niña' } });
  const c = cat.find((x) => x.id === 'colegio');
  assert.equal(c.label, 'Educación niña');
  assert.equal(c.id, 'colegio'); // id estable: los movimientos lo guardan
  assert.equal(cat.length, TOTAL);
});

test('construirCatalogo: el renombre no muta los defaults', () => {
  construirCatalogo({ categoriasRenombradas: { colegio: 'Otra cosa' } });
  assert.equal(CATEGORIAS.find((c) => c.id === 'colegio').label, 'Colegio');
});

test('construirCatalogo: un renombre vacío o no-texto se ignora', () => {
  const cat = construirCatalogo({ categoriasRenombradas: { colegio: '   ', ocio: 42 } });
  assert.equal(cat.find((c) => c.id === 'colegio').label, 'Colegio');
  assert.equal(cat.find((c) => c.id === 'ocio').label, 'Ocio');
});

test('construirCatalogo: agrega categorías propias al final con tint neutro', () => {
  const cat = construirCatalogo({
    categoriasPersonalizadas: [{ id: 'usr-mascota', label: 'Mascota' }],
  });
  assert.equal(cat.length, TOTAL + 1);
  const propia = cat[cat.length - 1];
  assert.equal(propia.id, 'usr-mascota');
  assert.equal(propia.label, 'Mascota');
  assert.equal(propia.cls, 'cat--otros');
  assert.equal(propia.propia, true);
  assert.ok(propia.icon.startsWith('<svg'));
});

test('construirCatalogo: propia con ícono y tint propios los respeta', () => {
  const cat = construirCatalogo({
    categoriasPersonalizadas: [{ id: 'usr-pareja', label: 'Pareja', icono: 'corazon', tint: 'salud' }],
  });
  const propia = cat.find((c) => c.id === 'usr-pareja');
  assert.equal(propia.cls, 'cat--salud');
  assert.equal(propia.icono, 'corazon');
  assert.equal(propia.icon, iconoDe('corazon'));
});

test('construirCatalogo: ignora propias sin id, sin label o duplicadas', () => {
  const cat = construirCatalogo({
    categoriasPersonalizadas: [
      { id: '', label: 'Sin id' },
      { id: 'usr-x', label: '   ' },
      { id: 'ocio', label: 'Choca con default' },
      { id: 'usr-ok', label: 'Válida' },
      { id: 'usr-ok', label: 'Repetida' },
      null,
    ],
  });
  assert.equal(cat.length, TOTAL + 1);
  assert.equal(cat[cat.length - 1].id, 'usr-ok');
  assert.equal(cat[cat.length - 1].label, 'Válida');
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

/* ---- estilo (ícono/tint) por categoría ---- */

test('categoriasEstilo: cambia ícono y tint de una categoría por defecto sin tocar el id', () => {
  const cat = construirCatalogo({
    categoriasEstilo: { persona1: { icono: 'corazon', tint: 'salud' } },
  });
  const p = cat.find((c) => c.id === 'persona1');
  assert.equal(p.id, 'persona1');
  assert.equal(p.icono, 'corazon');
  assert.equal(p.cls, 'cat--salud');
});

/* ---- ocultar (sin orfanar) ---- */

test('categoriasOcultas: marca la categoría como oculta pero sigue en el catálogo', () => {
  const cat = construirCatalogo({ categoriasOcultas: ['negocios'] });
  const n = cat.find((c) => c.id === 'negocios');
  assert.equal(n.oculta, true);
  // sigue presente para poder resolver movimientos viejos
  assert.equal(cat.length, TOTAL);
});

/* ---- orden personalizado ---- */

test('categoriasOrden: reordena y deja al final los ids no listados (estable)', () => {
  const cat = construirCatalogo({ categoriasOrden: ['otros', 'yo'] });
  assert.equal(cat[0].id, 'otros');
  assert.equal(cat[1].id, 'yo');
  assert.equal(cat.length, TOTAL);
  // el resto conserva su orden relativo original
  assert.equal(cat[2].id, 'persona1');
});

/* ---- idPersonalizada (PURA) ---- */

test('idPersonalizada: slug con prefijo usr- y sin tildes', () => {
  assert.equal(idPersonalizada('Mascota'), 'usr-mascota');
  assert.equal(idPersonalizada('Educación Niña'), 'usr-educacion-nina');
});

test('idPersonalizada: nunca choca con un id por defecto', () => {
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

test('aplicarPersonalizacion: catalogo(), catalogoVisible() y categoriaPorId() la respetan', () => {
  aplicarPersonalizacion({
    categoriasRenombradas: { mercado: 'Súper de la esquina' },
    categoriasPersonalizadas: [{ id: 'usr-mascota', label: 'Mascota' }],
    categoriasOcultas: ['comisiones'],
  });
  assert.equal(catalogo().length, TOTAL + 1);
  assert.equal(categoriaPorId('mercado').label, 'Súper de la esquina');
  assert.equal(categoriaPorId('usr-mascota').label, 'Mascota');
  // ocultas se excluyen del visible pero siguen resolviendo
  assert.equal(catalogoVisible().some((c) => c.id === 'comisiones'), false);
  assert.equal(categoriaPorId('comisiones').id, 'comisiones');

  // volver al estado por defecto no deja residuos
  aplicarPersonalizacion({});
  assert.equal(catalogo().length, TOTAL);
  assert.equal(catalogoVisible().length, TOTAL);
  assert.equal(categoriaPorId('mercado').label, 'Supermercado');
});

/* ---- RETROCOMPAT: ids viejos de los movimientos de Doug ---- */

test('retrocompat: un id viejo genérico resuelve a su categoría (no a Otros)', () => {
  aplicarPersonalizacion({});
  // 'mercado' es un id que Doug ya tiene en movimientos: debe resolver bien.
  const c = categoriaPorId('mercado');
  assert.equal(c.id, 'mercado');
  assert.equal(c.label, 'Supermercado');
  assert.notEqual(c.id, 'otros');
});

test('retrocompat: un id desconocido cae con gracia en Otros', () => {
  aplicarPersonalizacion({});
  assert.equal(categoriaPorId('no-existe-2019').id, 'otros');
});
