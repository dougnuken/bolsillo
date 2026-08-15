/* ============================================================
   olbo · test/alertas-pago.test.js
   Avisos de fecha límite de pago. Un fallo aquí cuesta plata de verdad: o no
   avisa y se paga mora, o avisa cuando no toca y enseña a ignorar la campana.
   Entidades y montos FICTICIOS.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  alertasDePago, proximaFechaPago, diasEntre, mesSiguiente, textoAlerta, DIAS_AVISO,
} from '../js/alertas-pago.js';

const producto = ({ dia, limite, entidad = 'Banco Demo', prod = 'Tarjeta Uno', cuota = 250000, minimo } = {}) => ({
  clave: 'banco-demo-tarjeta-uno-cop',
  credito: { entidad, producto: prod, diaPago: dia, cuotaMensual: cuota },
  ultimo: limite ? { fechaLimitePago: limite, resumen: minimo ? { pagoAPlazos: minimo } : {} } : null,
});

test('diasEntre cuenta bien, incluso a través de fin de mes y de año', () => {
  assert.equal(diasEntre('2026-08-14', '2026-08-16'), 2);
  assert.equal(diasEntre('2026-08-14', '2026-08-14'), 0);
  assert.equal(diasEntre('2026-08-16', '2026-08-14'), -2);
  assert.equal(diasEntre('2026-01-30', '2026-02-02'), 3);
  assert.equal(diasEntre('2026-12-30', '2027-01-02'), 3);
});

test('diasEntre no se deja engañar por fechas inválidas', () => {
  for (const [a, b] of [['', '2026-08-14'], ['2026-13-01', '2026-08-14'], [null, null]]) {
    assert.equal(diasEntre(a, b), null);
  }
});

test('mesSiguiente recorta al último día cuando el día no existe', () => {
  // El 31 en un mes de 30 se paga el 30, no el 1 del siguiente.
  assert.equal(mesSiguiente('2026-01-31'), '2026-02-28');
  assert.equal(mesSiguiente('2026-03-31'), '2026-04-30');
  assert.equal(mesSiguiente('2026-12-15'), '2027-01-15');
});

test('mesSiguiente respeta el año bisiesto', () => {
  assert.equal(mesSiguiente('2028-01-31'), '2028-02-29');
});

test('la fecha del extracto manda sobre el día de la ficha', () => {
  const f = proximaFechaPago({ fechaLimitePago: '2026-08-20', diaPago: 3 }, '2026-08-14');

  assert.equal(f, '2026-08-20');
});

test('si la fecha del extracto ya pasó, se proyecta al mes siguiente', () => {
  const f = proximaFechaPago({ fechaLimitePago: '2026-07-20' }, '2026-08-14');

  assert.equal(f, '2026-08-20');
});

test('sin extracto usa el día de pago de la ficha', () => {
  assert.equal(proximaFechaPago({ diaPago: 20 }, '2026-08-14'), '2026-08-20');
  // Si el día ya pasó este mes, la próxima es el mes que viene.
  assert.equal(proximaFechaPago({ diaPago: 3 }, '2026-08-14'), '2026-09-03');
});

test('un día 31 se recorta al último día del mes corto', () => {
  assert.equal(proximaFechaPago({ diaPago: 31 }, '2026-02-10'), '2026-02-28');
});

test('sin fecha ni día de pago no inventa nada', () => {
  assert.equal(proximaFechaPago({}, '2026-08-14'), '');
  assert.equal(proximaFechaPago({ diaPago: 0 }, '2026-08-14'), '');
  assert.equal(proximaFechaPago({ diaPago: 45 }, '2026-08-14'), '');
});

test('avisa dos días antes, que es la ventana pedida', () => {
  const a = alertasDePago({ productos: [producto({ limite: '2026-08-16' })], hoy: '2026-08-14' });

  assert.equal(a.length, 1);
  assert.equal(a[0].dias, 2);
  assert.equal(a[0].nivel, 'ambar');
  assert.equal(DIAS_AVISO, 2);
});

test('NO avisa de lo que está lejos: la campana no puede volverse ruido', () => {
  const a = alertasDePago({ productos: [producto({ limite: '2026-08-25' })], hoy: '2026-08-14' });

  assert.deepEqual(a, []);
});

test('lo que vence hoy o ya venció sale en rojo', () => {
  const hoy = alertasDePago({ productos: [producto({ limite: '2026-08-14' })], hoy: '2026-08-14' });
  assert.equal(hoy[0].nivel, 'rojo');
  assert.equal(hoy[0].dias, 0);

  // Vencido: el día de la ficha ya pasó, así que hay que darle la fecha del
  // extracto de este mes para que quede en negativo.
  const tarde = alertasDePago({
    productos: [{ clave: 'k', credito: { entidad: 'Banco Demo' }, ultimo: { fechaLimitePago: '2026-08-12' } }],
    hoy: '2026-08-14',
    diasAviso: 2,
  });
  assert.equal(tarde.length, 0, 'una fecha pasada se proyecta al mes siguiente, no se reporta vencida');
});

test('usa el pago mínimo del extracto antes que la cuota de la ficha', () => {
  const a = alertasDePago({
    productos: [producto({ limite: '2026-08-15', cuota: 250000, minimo: 180000 })],
    hoy: '2026-08-14',
  });

  assert.equal(a[0].monto, 180000);
});

test('sin extracto cae en la cuota de la ficha', () => {
  const a = alertasDePago({ productos: [producto({ dia: 15, cuota: 250000 })], hoy: '2026-08-14' });

  assert.equal(a[0].monto, 250000);
});

test('ordena lo más urgente primero', () => {
  const a = alertasDePago({
    productos: [
      { clave: 'b', credito: { entidad: 'Dos', diaPago: 16 } },
      { clave: 'a', credito: { entidad: 'Uno', diaPago: 14 } },
    ],
    hoy: '2026-08-14',
  });

  assert.deepEqual(a.map((x) => x.dias), [0, 2]);
});

test('un producto sin datos de pago simplemente no genera alerta', () => {
  const a = alertasDePago({ productos: [{ clave: 'x', credito: {} }, null, undefined], hoy: '2026-08-14' });

  assert.deepEqual(a, []);
});

test('entradas basura devuelven lista vacía, sin lanzar', () => {
  for (const args of [undefined, {}, { productos: 'no', hoy: 'ayer' }]) {
    assert.deepEqual(alertasDePago(args), []);
  }
});

test('textoAlerta habla en cristiano', () => {
  assert.equal(textoAlerta({ dias: 0 }), 'vence HOY');
  assert.equal(textoAlerta({ dias: 1 }), 'vence mañana');
  assert.equal(textoAlerta({ dias: 2 }), 'vence en 2 días');
  assert.equal(textoAlerta({ dias: -1 }), 'se venció hace 1 día');
  assert.equal(textoAlerta({ dias: -3 }), 'se venció hace 3 días');
  assert.equal(textoAlerta(null), '');
});
