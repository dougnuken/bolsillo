import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCOP, formatCOP, formatMovimiento, formatearMontoEnVivo, borrarDigitoAtras, MAX_DIGITOS_MONTO,
} from '../js/money.js';

/* ---------------- parseCOP ---------------- */

test('parseCOP: el punto es separador de miles', () => {
  // Arrange / Act / Assert
  assert.equal(parseCOP('15.000'), 15000);
  assert.equal(parseCOP('1.250.000'), 1250000);
});

test('parseCOP: entero plano sin separadores', () => {
  assert.equal(parseCOP('15000'), 15000);
});

test('parseCOP: tolera símbolo de peso y espacios', () => {
  assert.equal(parseCOP('$ 15.000'), 15000);
  assert.equal(parseCOP('$15.000'), 15000);
  assert.equal(parseCOP('  15000  '), 15000);
});

test('parseCOP: sufijo k/K equivale a mil', () => {
  assert.equal(parseCOP('15k'), 15000);
  assert.equal(parseCOP('15K'), 15000);
  assert.equal(parseCOP('$15k'), 15000);
});

test('parseCOP: coma es fracción en sufijo k', () => {
  assert.equal(parseCOP('1,5k'), 1500);
});

test('parseCOP: palabra "mil"', () => {
  assert.equal(parseCOP('50 mil'), 50000);
  assert.equal(parseCOP('50mil'), 50000);
});

test('parseCOP: millón / millones / m', () => {
  assert.equal(parseCOP('1 millón'), 1000000);
  assert.equal(parseCOP('1 millon'), 1000000);
  assert.equal(parseCOP('2 millones'), 2000000);
  assert.equal(parseCOP('1m'), 1000000);
  assert.equal(parseCOP('1,5m'), 1500000);
});

test('parseCOP: número directo se redondea a entero', () => {
  assert.equal(parseCOP(15000), 15000);
  assert.equal(parseCOP(15000.4), 15000);
});

test('parseCOP: entrada inválida o vacía devuelve null (nunca 0)', () => {
  assert.equal(parseCOP(''), null);
  assert.equal(parseCOP('   '), null);
  assert.equal(parseCOP('abc'), null);
  assert.equal(parseCOP('$'), null);
  assert.equal(parseCOP('mil'), null);
  assert.equal(parseCOP(null), null);
  assert.equal(parseCOP(undefined), null);
  assert.equal(parseCOP(NaN), null);
  assert.equal(parseCOP({}), null);
});

/* ---------------- formatCOP ---------------- */

test('formatCOP: formato es-CO con punto de miles', () => {
  assert.equal(formatCOP(15000), '$15.000');
  assert.equal(formatCOP(1250000), '$1.250.000');
  assert.equal(formatCOP(0), '$0');
});

test('formatCOP: con signo antepone + o −', () => {
  assert.equal(formatCOP(15000, { signo: true }), '+$15.000');
  assert.equal(formatCOP(-15000, { signo: true }), '−$15.000');
});

test('formatCOP: negativos siempre muestran − aunque no se pida signo', () => {
  assert.equal(formatCOP(-15000), '−$15.000');
});

test('formatCOP: modo compacto para cards', () => {
  assert.equal(formatCOP(15000, { compacto: true }), '$15 K');
  assert.equal(formatCOP(1200000, { compacto: true }), '$1,2 M');
  assert.equal(formatCOP(500, { compacto: true }), '$500');
});

test('formatCOP: entrada no numérica devuelve cadena vacía', () => {
  assert.equal(formatCOP(null), '');
  assert.equal(formatCOP(undefined), '');
  assert.equal(formatCOP(NaN), '');
});

/* ---------------- formatMovimiento (signo por tipo) ---------------- */

test('formatMovimiento: gasto sale con − aunque el monto se guarde positivo', () => {
  assert.equal(formatMovimiento(50000, 'gasto'), '−$50.000');
});

test('formatMovimiento: ingreso sale con + verde (positivo)', () => {
  assert.equal(formatMovimiento(50000, 'ingreso'), '+$50.000');
});

test('formatMovimiento: pago también sale negativo (sale de la cuenta)', () => {
  assert.equal(formatMovimiento(120000, 'pago'), '−$120.000');
});

test('formatMovimiento: usa el valor absoluto (nunca doble signo)', () => {
  assert.equal(formatMovimiento(-50000, 'gasto'), '−$50.000');
  assert.equal(formatMovimiento(-50000, 'ingreso'), '+$50.000');
});

test('formatMovimiento: tipo desconocido se trata como salida (−)', () => {
  assert.equal(formatMovimiento(9000, 'loquesea'), '−$9.000');
});

test('formatMovimiento: entrada no numérica devuelve cadena vacía', () => {
  assert.equal(formatMovimiento(null, 'gasto'), '');
  assert.equal(formatMovimiento(undefined, 'ingreso'), '');
  assert.equal(formatMovimiento(NaN, 'gasto'), '');
});

/* ---------------- máscara en vivo: formatearMontoEnVivo ---------------- */

test('formatearMontoEnVivo: agrupa por miles mientras se teclea', () => {
  // Lo que reportó Doug: escribir 17000000 debe verse 17.000.000.
  const pasos = ['1', '17', '170', '1700', '17000', '170000', '1700000', '17000000'];
  const esperado = ['1', '17', '170', '1.700', '17.000', '170.000', '1.700.000', '17.000.000'];
  pasos.forEach((crudo, i) => {
    assert.equal(formatearMontoEnVivo(crudo, crudo.length).texto, esperado[i]);
  });
});

test('formatearMontoEnVivo: el cursor queda al final al teclear de corrido', () => {
  // "1.700" tras escribir el 4.º dígito: el cursor va al final (índice 5).
  assert.deepEqual(formatearMontoEnVivo('1700', 4), { texto: '1.700', caret: 5 });
});

test('formatearMontoEnVivo: editar EN MEDIO no manda el cursor al final', () => {
  // "17.000.000" con el cursor tras el "7" (índice 2); se teclea un 5 => "175.000.000".
  // Antes del 5 hay 3 dígitos, así que el cursor debe quedar tras el 3.er dígito.
  const r = formatearMontoEnVivo('175.000.000', 3);
  assert.equal(r.texto, '175.000.000');
  assert.equal(r.caret, 3); // "175|.000.000"
  assert.equal(r.texto.slice(0, r.caret), '175');
});

test('formatearMontoEnVivo: recolocar cuenta DÍGITOS, no caracteres', () => {
  // "1.000" + un 2 al inicio => "21.000"; el cursor va tras 1 dígito.
  const r = formatearMontoEnVivo('21.000', 1);
  assert.deepEqual(r, { texto: '21.000', caret: 1 });
  // Un separador nuevo empujó el texto, pero el cursor sigue tras el mismo dígito.
  assert.equal(r.texto[r.caret - 1], '2');
});

test('formatearMontoEnVivo: pegar un valor lo formatea', () => {
  assert.equal(formatearMontoEnVivo('$ 17.000.000', null).texto, '17.000.000');
  assert.equal(formatearMontoEnVivo('17000000', null).texto, '17.000.000');
  assert.equal(formatearMontoEnVivo('1 700 000', null).texto, '1.700.000');
});

test('formatearMontoEnVivo: descarta lo que no sea dígito', () => {
  assert.equal(formatearMontoEnVivo('abc', 3).texto, '');
  assert.equal(formatearMontoEnVivo('12a3', 4).texto, '123');
  assert.equal(formatearMontoEnVivo('-500', 4).texto, '500'); // no hay montos negativos
});

test('formatearMontoEnVivo: entrada vacía deja el campo vacío y el cursor en 0', () => {
  assert.deepEqual(formatearMontoEnVivo('', 0), { texto: '', caret: 0 });
  assert.deepEqual(formatearMontoEnVivo(null), { texto: '', caret: 0 });
  assert.deepEqual(formatearMontoEnVivo(undefined), { texto: '', caret: 0 });
});

test('formatearMontoEnVivo: quita ceros a la izquierda pero respeta el 0 solo', () => {
  assert.equal(formatearMontoEnVivo('017', 3).texto, '17');
  assert.equal(formatearMontoEnVivo('0', 1).texto, '0');
  assert.equal(formatearMontoEnVivo('000', 3).texto, '0');
});

test('formatearMontoEnVivo: tope de dígitos para no aceptar absurdos', () => {
  const largo = '9'.repeat(MAX_DIGITOS_MONTO + 5);
  const r = formatearMontoEnVivo(largo, largo.length);
  assert.equal(r.texto.replace(/\D/g, '').length, MAX_DIGITOS_MONTO);
});

test('formatearMontoEnVivo: el caret fuera de rango no rompe', () => {
  assert.equal(formatearMontoEnVivo('1700', 999).caret, 5);
  assert.equal(formatearMontoEnVivo('1700', -5).caret, 0);
});

test('formatearMontoEnVivo: lo formateado sigue siendo parseable a entero COP', () => {
  const { texto } = formatearMontoEnVivo('17000000', 8);
  assert.equal(parseCOP(texto), 17000000);
  assert.ok(Number.isInteger(parseCOP(texto)));
});

/* ---------------- máscara en vivo: borrarDigitoAtras ---------------- */

test('borrarDigitoAtras: sobre un separador borra el DÍGITO anterior', () => {
  // "1.700" con el cursor tras el punto (índice 2): debe irse el 1, no el punto.
  assert.deepEqual(borrarDigitoAtras('1.700', 2), { texto: '700', caret: 0 });
});

test('borrarDigitoAtras: un solo toque basta (no se traba en el punto)', () => {
  // Retrocesos seguidos desde el final de "17.000.000".
  let estado = { texto: '17.000.000', caret: 10 };
  const vistos = [];
  for (let i = 0; i < 4; i++) {
    estado = borrarDigitoAtras(estado.texto, estado.caret);
    vistos.push(estado.texto);
  }
  assert.deepEqual(vistos, ['1.700.000', '170.000', '17.000', '1.700']);
});

test('borrarDigitoAtras: borra el dígito correcto en medio del número', () => {
  // "175.000.000" con el cursor tras el 5 (índice 3) => se va el 5.
  assert.deepEqual(borrarDigitoAtras('175.000.000', 3), { texto: '17.000.000', caret: 2 });
});

test('borrarDigitoAtras: al inicio no hay nada que borrar', () => {
  assert.deepEqual(borrarDigitoAtras('1.700', 0), { texto: '1.700', caret: 0 });
});

test('borrarDigitoAtras: borrar el último dígito deja el campo vacío', () => {
  assert.deepEqual(borrarDigitoAtras('7', 1), { texto: '', caret: 0 });
});
