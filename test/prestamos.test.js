import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  crearPrestamo,
  validarPrestamo,
  agregarAbono,
  saldoPendiente,
  totalAbonado,
  estaLiquidado,
  fraccionAbonada,
  totalPorCobrar,
  resumenPrestamos,
} from '../js/prestamos.js';

const NOW = new Date('2026-07-31T12:00:00Z');

test('crearPrestamo: normaliza y congela; saldo = monto sin abonos', () => {
  const p = crearPrestamo({ persona: '  Marley ', concepto: ' Prepagada ', monto: 400000 }, { now: NOW });
  assert.equal(p.persona, 'Marley');
  assert.equal(p.concepto, 'Prepagada');
  assert.equal(p.monto, 400000);
  assert.equal(p.fecha, '2026-07-31');
  assert.deepEqual(p.abonos, []);
  assert.ok(Object.isFrozen(p));
  assert.equal(saldoPendiente(p), 400000);
  assert.equal(estaLiquidado(p), false);
});

test('crearPrestamo: sin persona lanza', () => {
  assert.throws(() => crearPrestamo({ persona: '', monto: 100 }), /nombre|prestaste/i);
});

test('crearPrestamo: monto no positivo lanza', () => {
  assert.throws(() => crearPrestamo({ persona: 'Ana', monto: 0 }), /monto/i);
  assert.throws(() => crearPrestamo({ persona: 'Ana', monto: -5 }), /monto/i);
});

test('validarPrestamo: acumula ambos errores', () => {
  const r = validarPrestamo({ persona: '', monto: 0 });
  assert.equal(r.ok, false);
  assert.equal(r.errores.length, 2);
});

test('agregarAbono: baja el saldo y suma abonado', () => {
  let p = crearPrestamo({ persona: 'Marley', monto: 400000 }, { now: NOW });
  p = agregarAbono(p, { monto: 200000 }, { now: NOW });
  assert.equal(totalAbonado(p), 200000);
  assert.equal(saldoPendiente(p), 200000);
  assert.equal(estaLiquidado(p), false);
  assert.equal(p.abonos.length, 1);
  assert.ok(Object.isFrozen(p));
});

test('agregarAbono: recorta al saldo (no deja negativo) y liquida', () => {
  let p = crearPrestamo({ persona: 'Marley', monto: 400000 }, { now: NOW });
  p = agregarAbono(p, { monto: 200000 }, { now: NOW });
  p = agregarAbono(p, { monto: 999999 }, { now: NOW }); // paga de más
  assert.equal(saldoPendiente(p), 0);
  assert.equal(totalAbonado(p), 400000); // el segundo abono se recortó a 200000
  assert.equal(p.abonos[1].monto, 200000);
  assert.equal(estaLiquidado(p), true);
});

test('agregarAbono: sobre préstamo saldado lanza', () => {
  let p = crearPrestamo({ persona: 'Ana', monto: 100000 }, { now: NOW });
  p = agregarAbono(p, { monto: 100000 }, { now: NOW });
  assert.throws(() => agregarAbono(p, { monto: 1 }, { now: NOW }), /saldad/i);
});

test('agregarAbono: monto inválido lanza', () => {
  const p = crearPrestamo({ persona: 'Ana', monto: 100000 }, { now: NOW });
  assert.throws(() => agregarAbono(p, { monto: 0 }, { now: NOW }), /abono/i);
});

test('fraccionAbonada: 0, media y 1', () => {
  let p = crearPrestamo({ persona: 'Ana', monto: 400000 }, { now: NOW });
  assert.equal(fraccionAbonada(p), 0);
  p = agregarAbono(p, { monto: 200000 }, { now: NOW });
  assert.equal(fraccionAbonada(p), 0.5);
  p = agregarAbono(p, { monto: 200000 }, { now: NOW });
  assert.equal(fraccionAbonada(p), 1);
});

test('totalPorCobrar y resumenPrestamos separan activos de saldados', () => {
  const a = crearPrestamo({ persona: 'Marley', monto: 400000 }, { now: NOW });
  let b = crearPrestamo({ persona: 'Ana', monto: 100000 }, { now: NOW });
  b = agregarAbono(b, { monto: 100000 }, { now: NOW }); // saldado
  const c = agregarAbono(crearPrestamo({ persona: 'Leo', monto: 300000 }, { now: NOW }), { monto: 100000 }, { now: NOW }); // debe 200000
  const lista = [a, b, c];
  assert.equal(totalPorCobrar(lista), 400000 + 200000);
  const r = resumenPrestamos(lista);
  assert.equal(r.activos.length, 2);
  assert.equal(r.saldados.length, 1);
  assert.equal(r.totalPorCobrar, 600000);
  // activos ordenados por mayor saldo: Marley (400k) antes que Leo (200k)
  assert.equal(r.activos[0].persona, 'Marley');
  assert.equal(r.activos[1].persona, 'Leo');
});

test('rehidratar desde datos guardados preserva id y abonos válidos', () => {
  const p = crearPrestamo({
    id: 'pre-fijo', persona: 'Marley', monto: 400000,
    abonos: [{ monto: 150000, fecha: '2026-08-01' }, { monto: 0, fecha: 'x' }], // el 2º es basura
    creadoEn: '2026-07-31T00:00:00.000Z',
  }, { now: NOW });
  assert.equal(p.id, 'pre-fijo');
  assert.equal(p.abonos.length, 1); // el abono inválido se descartó
  assert.equal(saldoPendiente(p), 250000);
  assert.equal(p.creadoEn, '2026-07-31T00:00:00.000Z');
});
