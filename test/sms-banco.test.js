import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSMS, parseVarios, montoAnglo, fechaCompacta, fechaBarras,
  horaCompacta, horaDosPuntos, limpiarComercio, claveDedup, smsDelHash, BANCO_OCCIDENTE,
} from '../js/sms-banco.js';

/* SMS de EJEMPLO (formato Banco de Occidente; comercios, montos y tarjeta FICTICIOS). */
const A = {           // remitente 87810
  uno: 'Banco Occidente informa que realizo Compra por  50,000.00 en TIENDA UNO 51Bcon la T Credencial #0000, a las 202536del 20260730. Linea de servicio',
  dos: 'Banco Occidente informa que realizo Compra por  12,000.00 en TIENDA DOS VIRTcon la T Credencial #0000, a las 90602del 20260731. Linea de se',
  tresA: 'Banco Occidente informa que realizo Compra por  300,000.00 en SERVICIO DEMO COOcon la T Credencial #0000, a las 140545del 20260731. Linea de',
  tresB: 'Banco Occidente informa que realizo Compra por  300,000.00 en SERVICIO DEMO COOcon la T Credencial #0000, a las 141423del 20260731. Linea de',
  cuatro: 'Banco Occidente informa que realizo Compra por  20,000.00 en TIENDA TRES 2con la T Credencial #0000, a las 190032del 20260731. Linea de se',
};
const B = {           // remitente 85722
  cinco: 'Ud realizo una compra en GIMNASIO DEMO  por $100.000.T. Credencial *0000, 2026/04/01, 18:12. Bco. Occidente Linea de Servicio (601)3902058',
  seis: 'Ud realizo una compra en TIENDA CUATRO S14698   por $110.000.T. Credencial *0000, 2026/06/20, 10:27. Bco. Occidente Linea de Servicio (601)3902058',
  siete: 'Ud realizo una compra en TIENDA CINCO JARD por $30.000.T. Credencial *0000, 2026/07/31, 19:14. Bco. Occidente Linea de Servicio (601)3902058',
};

/* ---------- el peligro nº1: los dos formatos de número ---------- */

test('montoAnglo lee la coma como MILES (50,000.00 son cincuenta mil)', () => {
  assert.equal(montoAnglo('50,000.00'), 50000);
  assert.equal(montoAnglo('300,000.00'), 300000);
  assert.equal(montoAnglo('1,234,567.89'), 1234568);
  assert.equal(montoAnglo('900.00'), 900);
});

test('montoAnglo rechaza basura sin lanzar', () => {
  for (const v of ['', '  ', 'abc', null, undefined, 12, '1..2', '1,2,']) {
    assert.equal(montoAnglo(v), null);
  }
});

test('los dos formatos del MISMO banco dan el monto correcto cada uno', () => {
  // Es la trampa que hacía inservible un parser único: parseCOP leería
  // "50,000.00" como 50 pesos.
  assert.equal(parseSMS(A.uno).monto, 50000);
  assert.equal(parseSMS(B.cinco).monto, 100000);
});

/* ---------- plantilla 87810 ---------- */

test('87810: extrae monto, comercio pegado, tarjeta, fecha y hora', () => {
  const r = parseSMS(A.uno);
  assert.equal(r.banco, BANCO_OCCIDENTE);
  assert.equal(r.plantilla, 'occidente-87810');
  assert.equal(r.tipo, 'compra');
  assert.equal(r.monto, 50000);
  assert.equal(r.comercio, 'TIENDA UNO 51B');   // "51Bcon la T Credencial" → corta bien
  assert.equal(r.tarjeta, '0000');
  assert.equal(r.fecha, '2026-07-30');
  assert.equal(r.hora, '20:25');
});

test('87810: la hora SIN cero a la izquierda no se lee al revés (90602 = 09:06)', () => {
  const r = parseSMS(A.dos);
  assert.equal(r.hora, '09:06');
  assert.equal(r.fecha, '2026-07-31');
  assert.equal(r.comercio, 'TIENDA DOS VIRT');
  assert.equal(r.monto, 12000);
});

test('87810: un comercio que termina en dígito no se come la tarjeta', () => {
  const r = parseSMS(A.cuatro);
  assert.equal(r.comercio, 'TIENDA TRES 2');
  assert.equal(r.tarjeta, '0000');
  assert.equal(r.monto, 20000);
  assert.equal(r.hora, '19:00');
});

test('87810: aguanta el SMS TRUNCADO por el operador (sin fecha ni hora)', () => {
  const cortado = 'Banco Occidente informa que realizo Compra por  10,000.00 en TIENDA TRES 2con la T Credencial #0000, a las';
  const r = parseSMS(cortado);
  assert.equal(r.monto, 10000);
  assert.equal(r.comercio, 'TIENDA TRES 2');
  assert.equal(r.fecha, null);
  assert.equal(r.hora, null);
  assert.equal(r.dedupKey, null);   // sin fecha no hay clave: no se finge
});

test('87810: el salto de línea de la burbuja no rompe el patrón', () => {
  const conSaltos = A.uno.replace(/ /g, (s, i) => (i % 17 === 0 ? '\n' : s));
  const r = parseSMS(conSaltos);
  assert.equal(r.monto, 50000);
  assert.equal(r.comercio, 'TIENDA UNO 51B');
});

/* ---------- plantilla 85722 ---------- */

test('85722: extrae comercio antes del monto y el punto como MILES', () => {
  const r = parseSMS(B.cinco);
  assert.equal(r.plantilla, 'occidente-85722');
  assert.equal(r.monto, 100000);
  assert.equal(r.comercio, 'GIMNASIO DEMO');
  assert.equal(r.tarjeta, '0000');
  assert.equal(r.fecha, '2026-04-01');
  assert.equal(r.hora, '18:12');
});

test('85722: los espacios de sobra antes de "por" no ensucian el comercio', () => {
  const r = parseSMS(B.seis);
  assert.equal(r.comercio, 'TIENDA CUATRO S14698');
  assert.equal(r.monto, 110000);
  assert.equal(r.hora, '10:27');
});

test('85722: el "." que separa el monto de "T. Credencial" no se cuenta como decimal', () => {
  const r = parseSMS(B.siete);
  assert.equal(r.monto, 30000);          // "$30.000.T." → 30 mil, no 30
  assert.equal(r.comercio, 'TIENDA CINCO JARD');
  assert.equal(r.fecha, '2026-07-31');
});

/* ---------- deduplicación ---------- */

test('dos cargos IGUALES el mismo día a distinta hora son movimientos distintos', () => {
  // $300.000 en SERVICIO DEMO a las 14:05:45 y a las 14:14:23.
  const r1 = parseSMS(A.tresA);
  const r2 = parseSMS(A.tresB);
  assert.equal(r1.monto, 300000);
  assert.equal(r2.monto, 300000);
  assert.equal(r1.comercio, r2.comercio);
  assert.equal(r1.fecha, r2.fecha);
  assert.notEqual(r1.dedupKey, r2.dedupKey);   // con precisión de DÍA se habrían fusionado
  assert.equal(r1.hora, '14:05');
  assert.equal(r2.hora, '14:14');
});

test('el MISMO SMS dos veces da la MISMA clave (eso sí es duplicado)', () => {
  assert.equal(parseSMS(A.uno).dedupKey, parseSMS(A.uno).dedupKey);
});

test('claveDedup no inventa clave sin fecha ni monto', () => {
  assert.equal(claveDedup({ tarjeta: '0000', hora: '10:00', monto: 100 }), null);
  assert.equal(claveDedup({ tarjeta: '0000', fecha: '2026-07-31', hora: '10:00' }), null);
  assert.equal(claveDedup({}), null);
});

/* ---------- lo que NO se debe registrar ---------- */

test('un texto que no es notificación de compra devuelve null (no adivina)', () => {
  for (const t of [
    '', '   ', null, undefined, 42,
    'Hola, ¿cómo vas?',
    'Tu codigo de verificacion es 483920',
    'Banco Occidente informa que su clave fue actualizada',
    'Ud realizo una compra en TIENDA',                       // sin monto
    'Banco Occidente informa que realizo Compra por  0.00 en X con la T Credencial #0000',
  ]) {
    assert.equal(parseSMS(t), null, `no debería parsear: ${t}`);
  }
});

/* ---------- pegar varios de una ---------- */

test('parseVarios separa un pegote de burbujas y respeta el orden', () => {
  const pegote = [A.uno, B.cinco, A.cuatro].join('\n\n');
  const r = parseVarios(pegote);
  assert.equal(r.length, 3);
  assert.deepEqual(r.map((x) => x.comercio), ['TIENDA UNO 51B', 'GIMNASIO DEMO', 'TIENDA TRES 2']);
});

test('parseVarios descarta el repetido pero conserva los dos cargos gemelos', () => {
  const pegote = [A.tresA, A.tresB, A.tresA].join('\n');
  const r = parseVarios(pegote);
  assert.equal(r.length, 2);                 // el tercero es copia exacta del primero
  assert.deepEqual(r.map((x) => x.hora), ['14:05', '14:14']);
});

test('parseVarios con basura de por medio solo devuelve lo que entendió', () => {
  const r = parseVarios(`bla bla\n${A.uno}\nmensaje del vecino\n${B.siete}`);
  assert.equal(r.length, 2);
});

/* ---------- utilidades ---------- */

test('fechas y horas: formatos válidos e inválidos', () => {
  assert.equal(fechaCompacta('20260730'), '2026-07-30');
  assert.equal(fechaCompacta('20261330'), null);   // mes 13
  assert.equal(fechaCompacta('2026073'), null);
  assert.equal(fechaBarras('2026/04/01'), '2026-04-01');
  assert.equal(fechaBarras('2026/4/1'), '2026-04-01');
  assert.equal(fechaBarras('01/04/2026'), null);
  assert.equal(horaCompacta('202536'), '20:25');
  assert.equal(horaCompacta('90602'), '09:06');
  assert.equal(horaCompacta('996060'), null);
  assert.equal(horaDosPuntos('18:12'), '18:12');
  assert.equal(horaDosPuntos('8:12'), '08:12');
  assert.equal(horaDosPuntos('31:12'), null);
});

test('limpiarComercio colapsa espacios y quita basura de los bordes', () => {
  assert.equal(limpiarComercio('  TIENDA   CUATRO  S14698  '), 'TIENDA CUATRO S14698');
  assert.equal(limpiarComercio('*TIENDA UNO,'), 'TIENDA UNO');
  assert.equal(limpiarComercio(null), '');
  assert.equal(limpiarComercio('X'.repeat(90)).length, 60);
});

/* ---------- deep link del Atajo de iOS ---------- */

test('smsDelHash saca el SMS del deep link y aguanta hashes raros', () => {
  const sms = A.uno;
  const hash = '#/registrar?sms=' + encodeURIComponent(sms);
  assert.equal(smsDelHash(hash), sms);
  assert.equal(smsDelHash('#/hoy'), '');
  assert.equal(smsDelHash('#/registrar'), '');
  assert.equal(smsDelHash('#/perfil?sms=hola'), '');   // solo la ruta registrar
  assert.equal(smsDelHash(''), '');
  assert.equal(smsDelHash(null), '');
});
