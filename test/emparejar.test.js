/* ============================================================
   olbo · test/emparejar.test.js
   Unir cada producto de la cartera con su último extracto. Si esto falla, la
   conciencia recibe dos listas sueltas y no puede razonar "sobre ESTE
   producto", que es justo lo que se le pide.
   Entidades y productos FICTICIOS.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { claveDeCredito, emparejarProductos, slug } from '../js/diferidos.js';

const CREDITO = { id: 'c1', entidad: 'Banco Demo', producto: 'Tarjeta Uno', cuotaMensual: 250000 };
const OTRO = { id: 'c2', entidad: 'Banco Demo', producto: 'Tarjeta Dos', cuotaMensual: 90000 };

/* Los cortes solo necesitan cuentaClave y corte para agruparse. */
const corte = (clave, fecha) => ({ cuentaClave: clave, corte: fecha, diferidos: [] });

test('la clave de un crédito coincide con la que deriva un corte', () => {
  // crearCorte usa slug(entidad-producto-moneda); reconstruirla igual es lo que
  // permite emparejar sin heurísticas de nombres.
  assert.equal(claveDeCredito(CREDITO), slug('Banco Demo-Tarjeta Uno-COP'));
});

test('respeta la cuentaClave explícita si el crédito ya la trae', () => {
  assert.equal(claveDeCredito({ ...CREDITO, cuentaClave: 'clave-fijada' }), 'clave-fijada');
});

test('no revienta con un crédito vacío o basura', () => {
  for (const v of [undefined, null, {}, 'texto', 42]) {
    assert.equal(typeof claveDeCredito(v), 'string');
  }
});

test('empareja el producto con su corte más reciente y guarda el anterior', () => {
  const clave = claveDeCredito(CREDITO);
  const productos = emparejarProductos([CREDITO], [
    corte(clave, '2026-06-15'),
    corte(clave, '2026-08-15'),
    corte(clave, '2026-07-15'),
  ]);

  assert.equal(productos.length, 1);
  assert.equal(productos[0].credito, CREDITO);
  assert.equal(productos[0].ultimo.corte, '2026-08-15');
  assert.equal(productos[0].anterior.corte, '2026-07-15');
});

test('un producto sin extracto aparece igual, con ultimo en null', () => {
  // No se puede omitir: la conciencia tiene que saber que existe la deuda
  // aunque todavía no se le haya subido el extracto.
  const productos = emparejarProductos([CREDITO], []);

  assert.equal(productos.length, 1);
  assert.equal(productos[0].credito, CREDITO);
  assert.equal(productos[0].ultimo, null);
  assert.equal(productos[0].anterior, null);
});

test('un extracto sin ficha de producto NO se pierde', () => {
  // Subir el extracto antes de crear el producto es un orden legítimo.
  const productos = emparejarProductos([], [corte('banco-suelto-cop', '2026-08-01')]);

  assert.equal(productos.length, 1);
  assert.equal(productos[0].credito, null);
  assert.equal(productos[0].clave, 'banco-suelto-cop');
  assert.equal(productos[0].ultimo.corte, '2026-08-01');
});

test('cada producto se queda con SU extracto, sin cruzarse', () => {
  const c1 = claveDeCredito(CREDITO);
  const c2 = claveDeCredito(OTRO);
  const productos = emparejarProductos([CREDITO, OTRO], [
    corte(c2, '2026-08-10'),
    corte(c1, '2026-08-11'),
  ]);

  const uno = productos.find((p) => p.credito === CREDITO);
  const dos = productos.find((p) => p.credito === OTRO);
  assert.equal(uno.ultimo.corte, '2026-08-11');
  assert.equal(dos.ultimo.corte, '2026-08-10');
});

test('los con ficha van primero y los huérfanos al final', () => {
  const productos = emparejarProductos([CREDITO], [
    corte(claveDeCredito(CREDITO), '2026-08-11'),
    corte('otro-banco-cop', '2026-08-09'),
  ]);

  assert.equal(productos.length, 2);
  assert.ok(productos[0].credito, 'el primero debería tener ficha');
  assert.equal(productos[1].credito, null, 'el huérfano va al final');
});

test('entradas basura devuelven una lista vacía, sin lanzar', () => {
  for (const [cr, co] of [[undefined, undefined], [null, null], ['a', 'b'], [{}, {}]]) {
    assert.deepEqual(emparejarProductos(cr, co), []);
  }
});

test('el resultado es inmutable', () => {
  const productos = emparejarProductos([CREDITO], []);

  assert.throws(() => { productos.push({}); }, TypeError);
  assert.throws(() => { productos[0].credito = null; }, TypeError);
});
