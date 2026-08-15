/* ============================================================
   olbo · test/agenda-pagos.test.js
   La vista compacta de la cartera: qué se paga y cuándo, lo más urgente
   primero. Entidades y montos FICTICIOS.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { agendaDePagos, totalAgenda, cuandoTexto, DIAS_ATENCION } from '../js/agenda-pagos.js';

const HOY = '2026-08-15';
const prod = ({ clave = 'k', entidad = 'Banco Demo', producto = 'Tarjeta Uno', dia, limite, cuota, minimo } = {}) => ({
  clave,
  credito: { id: clave, entidad, producto, diaPago: dia, cuotaMensual: cuota },
  ultimo: limite ? { fechaLimitePago: limite, resumen: minimo ? { pagoAPlazos: minimo } : {} } : null,
});

test('ordena por vencimiento, no por nombre', () => {
  const a = agendaDePagos({
    hoy: HOY,
    productos: [
      prod({ clave: 'lejos', limite: '2026-08-28' }),
      prod({ clave: 'hoy', limite: '2026-08-15' }),
      prod({ clave: 'pronto', limite: '2026-08-18' }),
    ],
  });

  assert.deepEqual(a.map((f) => f.clave), ['hoy', 'pronto', 'lejos']);
});

test('marca la urgencia con color: hoy o vencido en rojo, ≤2 días ámbar', () => {
  const a = agendaDePagos({
    hoy: HOY,
    productos: [
      prod({ clave: 'hoy', limite: '2026-08-15' }),
      prod({ clave: 'dosdias', limite: '2026-08-17' }),
      prod({ clave: 'lejos', limite: '2026-08-28' }),
    ],
  });

  assert.equal(a.find((f) => f.clave === 'hoy').nivel, 'rojo');
  assert.equal(a.find((f) => f.clave === 'dosdias').nivel, 'ambar');
  assert.equal(a.find((f) => f.clave === 'lejos').nivel, 'neutro');
});

test('un producto SIN fecha no se esconde: va al final', () => {
  // Esconderlo por faltarle un dato es peor que mostrarlo incompleto: deja de
  // existir para quien mira la pantalla.
  const a = agendaDePagos({
    hoy: HOY,
    productos: [prod({ clave: 'sinfecha' }), prod({ clave: 'confecha', limite: '2026-08-20' })],
  });

  assert.deepEqual(a.map((f) => f.clave), ['confecha', 'sinfecha']);
  assert.equal(a[1].cuando, 'sin fecha de pago');
  assert.equal(a[1].nivel, 'neutro');
});

test('el monto es el mínimo del extracto antes que la cuota de la ficha', () => {
  const [f] = agendaDePagos({ hoy: HOY, productos: [prod({ limite: '2026-08-20', cuota: 900000, minimo: 180000 })] });

  assert.equal(f.monto, 180000);
});

test('sin extracto usa la cuota de la ficha', () => {
  const [f] = agendaDePagos({ hoy: HOY, productos: [prod({ dia: 20, cuota: 900000 })] });

  assert.equal(f.monto, 900000);
});

test('sin cuota ni mínimo el monto es null, no cero', () => {
  // null = "no se sabe"; un 0 diría que no hay que pagar nada.
  const [f] = agendaDePagos({ hoy: HOY, productos: [prod({ dia: 20 })] });

  assert.equal(f.monto, null);
});

test('cuandoTexto habla claro y cambia a fecha cuando está lejos', () => {
  assert.equal(cuandoTexto(-2), 'vencido hace 2 días');
  assert.equal(cuandoTexto(-1), 'vencido hace 1 día');
  assert.equal(cuandoTexto(0), 'vence hoy');
  assert.equal(cuandoTexto(1), 'vence mañana');
  assert.equal(cuandoTexto(3), 'en 3 días');
  assert.equal(cuandoTexto(DIAS_ATENCION), `en ${DIAS_ATENCION} días`);
  // Más allá de la ventana, la cuenta de días deja de decir algo: mejor la fecha.
  assert.equal(cuandoTexto(20, '2026-09-04'), 'el 4 sep');
});

test('totalAgenda suma solo lo que tiene monto', () => {
  const a = agendaDePagos({
    hoy: HOY,
    productos: [
      prod({ clave: 'a', limite: '2026-08-20', cuota: 100000 }),
      prod({ clave: 'b', limite: '2026-08-22', cuota: 250000 }),
      prod({ clave: 'c', dia: 25 }),
    ],
  });

  assert.equal(totalAgenda(a), 350000);
});

test('entradas basura no lanzan', () => {
  for (const args of [undefined, {}, { productos: 'no', hoy: 'ayer' }]) {
    assert.deepEqual(agendaDePagos(args), []);
  }
  assert.equal(totalAgenda(undefined), 0);
  assert.equal(cuandoTexto(undefined), '');
});

test('el resultado es inmutable', () => {
  const a = agendaDePagos({ hoy: HOY, productos: [prod({ limite: '2026-08-20' })] });

  assert.throws(() => { a.push({}); }, TypeError);
  assert.throws(() => { a[0].monto = 1; }, TypeError);
});
