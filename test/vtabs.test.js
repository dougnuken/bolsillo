/* ============================================================
   olbo · test/vtabs.test.js
   Marcado de las tabs de vista (subrayado + indicador). Es el mismo
   componente en Hoy y en la cartera, así que el HTML que genera tiene que
   ser idéntico salvo el atributo con el que cada vista engancha sus clics.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { vtabsHTML } from '../js/vtabs.js';

const TABS = [['productos', 'Mis productos'], ['me-deben', 'Me deben'], ['debo', 'Debo']];

test('marca la pestaña activa con is-on y aria-selected', () => {
  const html = vtabsHTML(TABS, 'me-deben');

  assert.match(html, /class="vtabs__btn is-on"[^>]*aria-selected="true"[^>]*>Me deben</);
  assert.equal(html.match(/is-on/g).length, 1);
  assert.equal(html.match(/aria-selected="false"/g).length, 2);
});

test('sin pestaña activa ninguna queda encendida', () => {
  const html = vtabsHTML(TABS, 'inexistente');

  assert.equal(html.includes('is-on'), false);
  assert.equal(html.match(/aria-selected="false"/g).length, 3);
});

test('usa el atributo de datos que le pasa la vista', () => {
  const cartera = vtabsHTML(TABS, 'productos', { attr: 'data-tab' });
  const hoy = vtabsHTML([['dashboard', 'Dashboard']], 'dashboard', { attr: 'data-hoy-tab' });

  assert.match(cartera, /data-tab="productos"/);
  assert.equal(cartera.includes('data-hoy-tab'), false);
  assert.match(hoy, /data-hoy-tab="dashboard"/);
});

test('incluye el indicador deslizante, oculto para lectores de pantalla', () => {
  const html = vtabsHTML(TABS, 'debo');

  assert.match(html, /<span class="vtabs__ind" aria-hidden="true"><\/span>/);
  assert.equal(html.match(/vtabs__ind/g).length, 1);
});

test('la barra es un tablist y sus botones son tabs', () => {
  const html = vtabsHTML(TABS, 'debo');

  assert.match(html, /<div class="vtabs" role="tablist"/);
  assert.equal(html.match(/role="tab"/g).length, 3);
});

test('el aria-label es opcional', () => {
  assert.equal(vtabsHTML(TABS, 'debo').includes('aria-label'), false);
  assert.match(vtabsHTML(TABS, 'debo', { label: 'Secciones' }), /aria-label="Secciones"/);
});

test('escapa etiquetas e ids para no romper el marcado', () => {
  const html = vtabsHTML([['a"b', '<script>x</script>']], 'a"b', { attr: 'data-tab' });

  assert.equal(html.includes('<script>'), false);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /data-tab="a&quot;b"/);
});

test('los tres tabs de la cartera salen en orden', () => {
  const html = vtabsHTML(TABS, 'productos', { attr: 'data-tab' });
  const etiquetas = [...html.matchAll(/>([^<]+)<\/button>/g)].map((m) => m[1]);

  assert.deepEqual(etiquetas, ['Mis productos', 'Me deben', 'Debo']);
});
