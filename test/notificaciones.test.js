/* ============================================================
   olbo · test/notificaciones.test.js
   El centro de notificaciones ordena por urgencia real, no por familia.
   Entidades y montos FICTICIOS.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  agruparNotificaciones,
  resumenNotificaciones,
  tituloTramo,
  AHORA,
  PRONTO,
} from '../js/notificaciones.js';

const pago = ({ clave = 'p1', titulo = 'Banco Demo · Tarjeta', dias = 1, monto = 100000 } = {}) =>
  ({ clave, titulo, dias, fecha: '2026-08-16', monto, nivel: dias <= 0 ? 'rojo' : 'ambar' });

const tope = ({ categoriaId = 'mercado', excedido = 0, pctTope = 0.9, presupuesto = 500000 } = {}) =>
  ({ categoriaId, excedido, pctTope, presupuesto, total: presupuesto * pctTope, color: excedido > 0 ? 'rojo' : 'ambar' });

const persona = ({ id = 'persona1', label = 'Persona 1', color = 'ambar' } = {}) =>
  ({ id, label, color, topeFrac: 0.15, pctIngreso: 0.14 });

test('un tope YA excedido sube al mismo tramo que un pago vencido', () => {
  // Este es el bug que el rediseño arregla: antes el tope vivía en su propio
  // bloque, debajo, por ser de otra familia — aunque ya hubiera costado plata.
  const g = agruparNotificaciones({
    pagos: [pago({ dias: 2 })],
    topes: [tope({ excedido: 300000 })],
  });

  assert.equal(g.ahora.length, 1);
  assert.equal(g.ahora[0].fuente, 'tope');
  assert.equal(g.pronto.length, 1);
  assert.equal(g.pronto[0].fuente, 'pago');
});

test('vencido y vence-hoy son AHORA; dentro de la ventana es PRONTO', () => {
  const g = agruparNotificaciones({
    pagos: [pago({ clave: 'v', dias: -3 }), pago({ clave: 'h', dias: 0 }), pago({ clave: 'f', dias: 2 })],
  });

  assert.deepEqual(g.ahora.map((n) => n.id), ['pago:v', 'pago:h']);
  assert.deepEqual(g.pronto.map((n) => n.id), ['pago:f']);
});

test('dentro del tramo manda la plata en juego', () => {
  const g = agruparNotificaciones({
    pagos: [pago({ clave: 'chico', dias: 0, monto: 50000 }), pago({ clave: 'grande', dias: 0, monto: 9000000 })],
    topes: [tope({ categoriaId: 'ocio', excedido: 400000 })],
  });

  assert.deepEqual(g.ahora.map((n) => n.id), ['pago:grande', 'tope:ocio', 'pago:chico']);
});

test('lo que no tiene monto va al final de su tramo, no arriba', () => {
  // Sin cifra no se puede afirmar que sea lo más grave; colarlo primero sería
  // inventarle una urgencia que nadie midió.
  const g = agruparNotificaciones({
    pagos: [pago({ clave: 'sinmonto', dias: 0, monto: null }), pago({ clave: 'conmonto', dias: 0, monto: 10000 })],
  });

  assert.deepEqual(g.ahora.map((n) => n.id), ['pago:conmonto', 'pago:sinmonto']);
});

test('el peso de un tope es lo EXCEDIDO, no lo gastado', () => {
  // Un tope de 10M gastado al 101% se pasó por 100k: molesta menos que un pago
  // vencido de 2M. Si pesara el total, se colaría arriba siempre.
  const g = agruparNotificaciones({
    topes: [tope({ categoriaId: 'grande', presupuesto: 10000000, pctTope: 1.01, excedido: 100000 })],
    pagos: [pago({ clave: 'p', dias: 0, monto: 2000000 })],
  });

  assert.deepEqual(g.ahora.map((n) => n.id), ['pago:p', 'tope:grande']);
});

test('una persona en rojo es AHORA y en ámbar es PRONTO', () => {
  const g = agruparNotificaciones({
    personas: [persona({ id: 'a', color: 'rojo' }), persona({ id: 'b', color: 'ambar' })],
  });

  assert.deepEqual(g.ahora.map((n) => n.id), ['persona:a']);
  assert.deepEqual(g.pronto.map((n) => n.id), ['persona:b']);
});

test('el nivel de color se deriva del tramo, no de cada fuente', () => {
  // Una sola regla de color: si está en AHORA es rojo. Antes cada fuente traía
  // el suyo y podía haber un ítem ámbar arriba de uno rojo.
  const g = agruparNotificaciones({
    pagos: [pago({ dias: 0 })],
    topes: [tope({ excedido: 1 })],
    personas: [persona({ color: 'rojo' })],
  });

  assert.ok(g.ahora.every((n) => n.nivel === 'rojo'));
  assert.equal(g.ahora.length, 3);
});

test('el total cuenta todo, sin importar el tramo', () => {
  const g = agruparNotificaciones({
    pagos: [pago({ dias: 0 }), pago({ clave: 'x', dias: 2 })],
    topes: [tope({ excedido: 5 })],
  });

  assert.equal(g.total, 3);
  assert.equal(g.hayAlgo, true);
});

test('el resumen habla de lo urgente primero y baja el tono si no lo hay', () => {
  assert.equal(resumenNotificaciones({}), 'Todo al día.');
  assert.equal(
    resumenNotificaciones({ ahora: [1] }),
    '1 cosa necesita tu atención hoy.',
  );
  assert.equal(
    resumenNotificaciones({ ahora: [1, 2, 3], pronto: [4] }),
    '3 cosas necesitan tu atención hoy.',
  );
  assert.equal(
    resumenNotificaciones({ pronto: [1, 2] }),
    'Nada urgente. 2 cosas por atender esta semana.',
  );
  // Los pendientes solos no son urgencia, pero tampoco son "todo al día".
  assert.equal(
    resumenNotificaciones({ pendientes: 1 }),
    'Nada urgente. Te falta registrar 1 gasto fijo.',
  );
});

test('los pendientes por registrar NO entran en los tramos', () => {
  // Son una tarea con su propio botón, no una alerta. Si entraran, cada tramo
  // tendría que cargar acciones distintas.
  const g = agruparNotificaciones({ pagos: [], topes: [], personas: [] });

  assert.equal(g.hayAlgo, false);
  assert.equal(g.total, 0);
});

test('las etiquetas de tramo dicen qué se espera de quien lee', () => {
  assert.equal(tituloTramo(AHORA), 'Necesita atención');
  assert.equal(tituloTramo(PRONTO), 'Esta semana');
  assert.equal(tituloTramo('otro'), '');
});

test('entradas basura no lanzan', () => {
  for (const args of [undefined, {}, { pagos: 'no', topes: null, personas: 7 }]) {
    const g = agruparNotificaciones(args);
    assert.deepEqual(g.ahora, []);
    assert.deepEqual(g.pronto, []);
    assert.equal(g.hayAlgo, false);
  }
  assert.equal(resumenNotificaciones(undefined), 'Todo al día.');
});

test('el resultado es inmutable', () => {
  const g = agruparNotificaciones({ pagos: [pago({ dias: 0 })] });

  assert.throws(() => { g.ahora.push({}); }, TypeError);
  assert.throws(() => { g.ahora[0].titulo = 'otro'; }, TypeError);
});
