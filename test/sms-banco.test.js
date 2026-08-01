import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSMS, parseVarios, montoAnglo, fechaCompacta, fechaBarras,
  horaCompacta, horaDosPuntos, limpiarComercio, claveDedup, smsDelHash, BANCO_OCCIDENTE,
} from '../js/sms-banco.js';

/* SMS REALES del hilo de Doug (tarjeta enmascarada por el propio banco). */
const A = {           // remitente 87810
  tama: 'Banco Occidente informa que realizo Compra por  65,450.00 en TAMA PLAZA 51Bcon la T Credencial #7938, a las 202536del 20260730. Linea de servicio',
  farmatodo: 'Banco Occidente informa que realizo Compra por  15,900.00 en FARMATODO CANALES VIRTcon la T Credencial #7938, a las 90602del 20260731. Linea de se',
  medicina1: 'Banco Occidente informa que realizo Compra por  319,000.00 en MEDICINA PREPAGADA COOcon la T Credencial #7938, a las 140545del 20260731. Linea de',
  medicina2: 'Banco Occidente informa que realizo Compra por  319,000.00 en MEDICINA PREPAGADA COOcon la T Credencial #7938, a las 141423del 20260731. Linea de',
  drogueria: 'Banco Occidente informa que realizo Compra por  19,000.00 en DROGUERIA PRISFARMA 2con la T Credencial #7938, a las 190032del 20260731. Linea de se',
};
const B = {           // remitente 85722
  smartfit: 'Ud realizo una compra en SMART FIT LA HACIENDA  por $109.989.T. Credencial *7938, 2026/04/01, 18:12. Bco. Occidente Linea de Servicio (601)3902058',
  sporty: 'Ud realizo una compra en SPORTY CITY SAS14698   por $114.900.T. Credencial *7938, 2026/06/20, 10:27. Bco. Occidente Linea de Servicio (601)3902058',
  panquesudo: 'Ud realizo una compra en PANQUESUDO CIUDAD JARD por $31.000.T. Credencial *7938, 2026/07/31, 19:14. Bco. Occidente Linea de Servicio (601)3902058',
};

/* ---------- el peligro nº1: los dos formatos de número ---------- */

test('montoAnglo lee la coma como MILES (65,450.00 son sesenta y cinco mil)', () => {
  assert.equal(montoAnglo('65,450.00'), 65450);
  assert.equal(montoAnglo('319,000.00'), 319000);
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
  // "65,450.00" como 65 pesos.
  assert.equal(parseSMS(A.tama).monto, 65450);
  assert.equal(parseSMS(B.smartfit).monto, 109989);
});

/* ---------- plantilla 87810 ---------- */

test('87810: extrae monto, comercio pegado, tarjeta, fecha y hora', () => {
  const r = parseSMS(A.tama);
  assert.equal(r.banco, BANCO_OCCIDENTE);
  assert.equal(r.plantilla, 'occidente-87810');
  assert.equal(r.tipo, 'compra');
  assert.equal(r.monto, 65450);
  assert.equal(r.comercio, 'TAMA PLAZA 51B');   // "51Bcon la T Credencial" → corta bien
  assert.equal(r.tarjeta, '7938');
  assert.equal(r.fecha, '2026-07-30');
  assert.equal(r.hora, '20:25');
});

test('87810: la hora SIN cero a la izquierda no se lee al revés (90602 = 09:06)', () => {
  const r = parseSMS(A.farmatodo);
  assert.equal(r.hora, '09:06');
  assert.equal(r.fecha, '2026-07-31');
  assert.equal(r.comercio, 'FARMATODO CANALES VIRT');
  assert.equal(r.monto, 15900);
});

test('87810: un comercio que termina en dígito no se come la tarjeta', () => {
  const r = parseSMS(A.drogueria);
  assert.equal(r.comercio, 'DROGUERIA PRISFARMA 2');
  assert.equal(r.tarjeta, '7938');
  assert.equal(r.monto, 19000);
  assert.equal(r.hora, '19:00');
});

test('87810: aguanta el SMS TRUNCADO por el operador (sin fecha ni hora)', () => {
  const cortado = 'Banco Occidente informa que realizo Compra por  11,900.00 en DROGUERIA PRISFARMA 2con la T Credencial #7938, a las';
  const r = parseSMS(cortado);
  assert.equal(r.monto, 11900);
  assert.equal(r.comercio, 'DROGUERIA PRISFARMA 2');
  assert.equal(r.fecha, null);
  assert.equal(r.hora, null);
  assert.equal(r.dedupKey, null);   // sin fecha no hay clave: no se finge
});

test('87810: el salto de línea de la burbuja no rompe el patrón', () => {
  const conSaltos = A.tama.replace(/ /g, (s, i) => (i % 17 === 0 ? '\n' : s));
  const r = parseSMS(conSaltos);
  assert.equal(r.monto, 65450);
  assert.equal(r.comercio, 'TAMA PLAZA 51B');
});

/* ---------- plantilla 85722 ---------- */

test('85722: extrae comercio antes del monto y el punto como MILES', () => {
  const r = parseSMS(B.smartfit);
  assert.equal(r.plantilla, 'occidente-85722');
  assert.equal(r.monto, 109989);
  assert.equal(r.comercio, 'SMART FIT LA HACIENDA');
  assert.equal(r.tarjeta, '7938');
  assert.equal(r.fecha, '2026-04-01');
  assert.equal(r.hora, '18:12');
});

test('85722: los espacios de sobra antes de "por" no ensucian el comercio', () => {
  const r = parseSMS(B.sporty);
  assert.equal(r.comercio, 'SPORTY CITY SAS14698');
  assert.equal(r.monto, 114900);
  assert.equal(r.hora, '10:27');
});

test('85722: el "." que separa el monto de "T. Credencial" no se cuenta como decimal', () => {
  const r = parseSMS(B.panquesudo);
  assert.equal(r.monto, 31000);          // "$31.000.T." → 31 mil, no 31
  assert.equal(r.comercio, 'PANQUESUDO CIUDAD JARD');
  assert.equal(r.fecha, '2026-07-31');
});

/* ---------- deduplicación ---------- */

test('dos cargos IGUALES el mismo día a distinta hora son movimientos distintos', () => {
  // Caso real: $319.000 en MEDICINA PREPAGADA a las 14:05:45 y a las 14:14:23.
  const r1 = parseSMS(A.medicina1);
  const r2 = parseSMS(A.medicina2);
  assert.equal(r1.monto, 319000);
  assert.equal(r2.monto, 319000);
  assert.equal(r1.comercio, r2.comercio);
  assert.equal(r1.fecha, r2.fecha);
  assert.notEqual(r1.dedupKey, r2.dedupKey);   // con precisión de DÍA se habrían fusionado
  assert.equal(r1.hora, '14:05');
  assert.equal(r2.hora, '14:14');
});

test('el MISMO SMS dos veces da la MISMA clave (eso sí es duplicado)', () => {
  assert.equal(parseSMS(A.tama).dedupKey, parseSMS(A.tama).dedupKey);
});

test('claveDedup no inventa clave sin fecha ni monto', () => {
  assert.equal(claveDedup({ tarjeta: '7938', hora: '10:00', monto: 100 }), null);
  assert.equal(claveDedup({ tarjeta: '7938', fecha: '2026-07-31', hora: '10:00' }), null);
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
    'Banco Occidente informa que realizo Compra por  0.00 en X con la T Credencial #7938',
  ]) {
    assert.equal(parseSMS(t), null, `no debería parsear: ${t}`);
  }
});

/* ---------- pegar varios de una ---------- */

test('parseVarios separa un pegote de burbujas y respeta el orden', () => {
  const pegote = [A.tama, B.smartfit, A.drogueria].join('\n\n');
  const r = parseVarios(pegote);
  assert.equal(r.length, 3);
  assert.deepEqual(r.map((x) => x.comercio), ['TAMA PLAZA 51B', 'SMART FIT LA HACIENDA', 'DROGUERIA PRISFARMA 2']);
});

test('parseVarios descarta el repetido pero conserva los dos cargos gemelos', () => {
  const pegote = [A.medicina1, A.medicina2, A.medicina1].join('\n');
  const r = parseVarios(pegote);
  assert.equal(r.length, 2);                 // el tercero es copia exacta del primero
  assert.deepEqual(r.map((x) => x.hora), ['14:05', '14:14']);
});

test('parseVarios con basura de por medio solo devuelve lo que entendió', () => {
  const r = parseVarios(`bla bla\n${A.tama}\nmensaje del vecino\n${B.panquesudo}`);
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
  assert.equal(limpiarComercio('  SPORTY   CITY  SAS14698  '), 'SPORTY CITY SAS14698');
  assert.equal(limpiarComercio('*TAMA PLAZA,'), 'TAMA PLAZA');
  assert.equal(limpiarComercio(null), '');
  assert.equal(limpiarComercio('X'.repeat(90)).length, 60);
});

/* ---------- deep link del Atajo de iOS ---------- */

test('smsDelHash saca el SMS del deep link y aguanta hashes raros', () => {
  const sms = A.tama;
  const hash = '#/registrar?sms=' + encodeURIComponent(sms);
  assert.equal(smsDelHash(hash), sms);
  assert.equal(smsDelHash('#/hoy'), '');
  assert.equal(smsDelHash('#/registrar'), '');
  assert.equal(smsDelHash('#/perfil?sms=hola'), '');   // solo la ruta registrar
  assert.equal(smsDelHash(''), '');
  assert.equal(smsDelHash(null), '');
});
