import test from 'node:test';
import assert from 'node:assert/strict';
import { materializarMes } from '../js/recurring.js';
import { crearRecurrente, crearMovimiento } from '../js/model.js';

/* Un `now` bien pasado para que las fechas del mes ya hayan "llegado". */
const NOW_MAR = new Date('2026-03-15T12:00:00Z');

function recu(over = {}) {
  return crearRecurrente({
    nombre: 'Arriendo',
    monto: 1200000,
    diaDelMes: 5,
    categoria: 'vivienda',
    cuenta: 'Bancolombia',
    modo: 'auto',
    ...over,
  });
}

test('materializa un recurrente auto cuya fecha ya pasó', () => {
  const { auto, porConfirmar } = materializarMes([recu()], [], 2026, 3, NOW_MAR);
  assert.equal(auto.length, 1);
  assert.equal(porConfirmar.length, 0);
  assert.equal(auto[0].fuente, 'recurrente');
  assert.equal(auto[0].fecha, '2026-03-05');
  assert.equal(auto[0].esFijo, true);
  assert.equal(auto[0].esHormiga, false); // un fijo nunca es hormiga
});

test('idempotencia: no duplica si ya existe el movimiento del mes', () => {
  const rec = recu();
  const existente = crearMovimiento({
    fecha: '2026-03-10', monto: 1200000, cuenta: 'Bancolombia',
    fuente: 'recurrente', esFijo: true, recurrenteId: rec.id,
  });
  const { auto } = materializarMes([rec], [existente], 2026, 3, NOW_MAR);
  assert.equal(auto.length, 0);
});

test('idempotencia: correr dos veces seguidas no crea de más', () => {
  const rec = recu();
  const primera = materializarMes([rec], [], 2026, 3, NOW_MAR);
  assert.equal(primera.auto.length, 1);
  // simula que ya se persistió lo de la primera corrida
  const segunda = materializarMes([rec], primera.auto, 2026, 3, NOW_MAR);
  assert.equal(segunda.auto.length, 0);
});

test('excepción {saltar:true} no materializa ese mes', () => {
  const rec = recu({ excepciones: { '2026-03': { saltar: true } } });
  const { auto, porConfirmar } = materializarMes([rec], [], 2026, 3, NOW_MAR);
  assert.equal(auto.length, 0);
  assert.equal(porConfirmar.length, 0);
});

test('excepción {monto:X} usa ese monto en vez del base', () => {
  const rec = recu({ monto: 1200000, excepciones: { '2026-03': { monto: 950000 } } });
  const { auto } = materializarMes([rec], [], 2026, 3, NOW_MAR);
  assert.equal(auto.length, 1);
  assert.equal(auto[0].monto, 950000);
});

test('clamp de diaDelMes: 31 en febrero cae en el último día', () => {
  const rec = recu({ diaDelMes: 31 });
  const now = new Date('2026-02-28T12:00:00Z');
  const { auto } = materializarMes([rec], [], 2026, 2, now);
  assert.equal(auto.length, 1);
  assert.equal(auto[0].fecha, '2026-02-28'); // 2026 no es bisiesto
});

test('modo auto vs confirmar: se separan en dos listas', () => {
  const recAuto = recu({ nombre: 'Netflix', modo: 'auto' });
  const recConf = recu({ nombre: 'Gimnasio', modo: 'confirmar' });
  const { auto, porConfirmar } = materializarMes([recAuto, recConf], [], 2026, 3, NOW_MAR);
  assert.equal(auto.length, 1);
  assert.equal(porConfirmar.length, 1);
  assert.equal(auto[0].comercio, 'Netflix');
  assert.equal(porConfirmar[0].comercio, 'Gimnasio');
});

test('no materializa si la fecha del mes aún no llega', () => {
  const rec = recu({ diaDelMes: 25 });
  const { auto } = materializarMes([rec], [], 2026, 3, NOW_MAR); // 25 > 15
  assert.equal(auto.length, 0);
});

test('no materializa recurrentes inactivos', () => {
  const rec = recu({ activo: false });
  const { auto, porConfirmar } = materializarMes([rec], [], 2026, 3, NOW_MAR);
  assert.equal(auto.length, 0);
  assert.equal(porConfirmar.length, 0);
});

/* ---------------- VALOR VARIABLE: siempre pide monto ---------------- */

function recVar(over = {}) {
  return crearRecurrente({
    nombre: 'Luz', esVariable: true, monto: null, montoEstimado: 300000,
    diaDelMes: 5, categoria: 'servicios', cuenta: 'Bancolombia', modo: 'auto', ...over,
  });
}

test('variable: SIEMPRE va a porConfirmar como solicitud (nunca a auto, aunque modo=auto)', () => {
  const rec = recVar();
  const { auto, porConfirmar } = materializarMes([rec], [], 2026, 3, NOW_MAR);
  assert.equal(auto.length, 0); // no se materializa solo, aunque su modo sea 'auto'
  assert.equal(porConfirmar.length, 1);
  const sol = porConfirmar[0];
  assert.equal(sol.pediMonto, true); // marca que la UI debe pedir el monto
  assert.equal(sol.recurrenteId, rec.id); // vínculo al recurrente que la originó
  assert.equal(sol.montoEstimado, 300000); // sugerencia
  assert.equal(sol.comercio, 'Luz');
  assert.equal(sol.esFijo, true);
  assert.equal(sol.fuente, 'recurrente');
  assert.equal(sol.fecha, '2026-03-05');
  assert.equal(sol.monto, undefined); // no inventa un monto
});

test('variable sin estimado: la solicitud lleva montoEstimado null', () => {
  const { porConfirmar } = materializarMes([recVar({ montoEstimado: null })], [], 2026, 3, NOW_MAR);
  assert.equal(porConfirmar.length, 1);
  assert.equal(porConfirmar[0].montoEstimado, null);
});

test('variable: idempotente, si ya hay movimiento del mes NO vuelve a pedir', () => {
  const rec = recVar();
  const yaReal = crearMovimiento({
    fecha: '2026-03-05', monto: 275000, cuenta: 'Bancolombia',
    fuente: 'recurrente', esFijo: true, recurrenteId: rec.id,
  });
  const { auto, porConfirmar } = materializarMes([rec], [yaReal], 2026, 3, NOW_MAR);
  assert.equal(auto.length, 0);
  assert.equal(porConfirmar.length, 0); // ya registrado este mes
});

test('variable: no pide antes de que llegue su día del mes', () => {
  const rec = recVar({ diaDelMes: 25 }); // hoy es día 15
  const { porConfirmar } = materializarMes([rec], [], 2026, 3, NOW_MAR);
  assert.equal(porConfirmar.length, 0);
});

test('variable + exacto conviven: cada uno en su carril', () => {
  const variable = recVar({ nombre: 'Agua' });
  const exacto = recu({ nombre: 'Arriendo', modo: 'auto' });
  const { auto, porConfirmar } = materializarMes([variable, exacto], [], 2026, 3, NOW_MAR);
  assert.equal(auto.length, 1); // el exacto auto se materializa
  assert.equal(auto[0].comercio, 'Arriendo');
  assert.equal(porConfirmar.length, 1); // el variable pide monto
  assert.equal(porConfirmar[0].pediMonto, true);
  assert.equal(porConfirmar[0].comercio, 'Agua');
});
