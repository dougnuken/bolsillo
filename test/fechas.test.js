import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hoyISO, esISOValida, sumarDiasISO, diferenciaDias,
  fechaMedia, fechaLarga, fechaCorta, etiquetaFecha,
} from '../js/fechas.js';
import { atajosFecha } from '../js/views/fecha-sheet.js';

/* ---------------- hoyISO ---------------- */

test('hoyISO: usa el reloj LOCAL, no UTC (Colombia UTC-5 de noche)', () => {
  // 19 jul 2026, 19:00 hora local → sigue siendo el 19 aunque en UTC ya sea el 20.
  const local = new Date(2026, 6, 19, 19, 0, 0); // meses base 0: 6 = julio
  assert.equal(hoyISO(local), '2026-07-19');
});

test('hoyISO: rellena mes y día a dos dígitos', () => {
  assert.equal(hoyISO(new Date(2026, 0, 3, 8, 0, 0)), '2026-01-03');
});

test('hoyISO: fecha inválida lanza en vez de devolver basura', () => {
  assert.throws(() => hoyISO(new Date('no-es-fecha')), /inválida/);
});

/* ---------------- esISOValida ---------------- */

test('esISOValida: acepta YYYY-MM-DD y prefijos con hora', () => {
  assert.equal(esISOValida('2026-07-19'), true);
  assert.equal(esISOValida('2026-07-19T10:00:00'), true);
});

test('esISOValida: rechaza vacío, undefined y basura (nunca lanza)', () => {
  assert.equal(esISOValida(''), false);
  assert.equal(esISOValida(undefined), false);
  assert.equal(esISOValida('ayer'), false);
});

/* ---------------- sumarDiasISO ---------------- */

test('sumarDiasISO: resta días cruzando el fin de mes', () => {
  assert.equal(sumarDiasISO('2026-08-01', -1), '2026-07-31');
  assert.equal(sumarDiasISO('2026-08-01', -2), '2026-07-30');
});

test('sumarDiasISO: suma días cruzando el fin de año', () => {
  assert.equal(sumarDiasISO('2026-12-31', 1), '2027-01-01');
});

test('sumarDiasISO: cero días es identidad', () => {
  assert.equal(sumarDiasISO('2026-07-19', 0), '2026-07-19');
});

test('sumarDiasISO: días no enteros lanzan', () => {
  assert.throws(() => sumarDiasISO('2026-07-19', 1.5), /entero/);
});

test('sumarDiasISO: ISO inválida lanza', () => {
  assert.throws(() => sumarDiasISO('mañana', -1), /Fecha inválida/);
});

/* ---------------- diferenciaDias ---------------- */

test('diferenciaDias: cuenta días completos b - a', () => {
  assert.equal(diferenciaDias('2026-07-19', '2026-07-21'), 2);
  assert.equal(diferenciaDias('2026-07-21', '2026-07-19'), -2);
  assert.equal(diferenciaDias('2026-07-19', '2026-07-19'), 0);
});

/* ---------------- etiquetaFecha ---------------- */

test('etiquetaFecha: nombra Hoy/Ayer/Antier relativo al hoy dado', () => {
  const hoy = '2026-07-19';
  assert.equal(etiquetaFecha('2026-07-19', hoy), 'Hoy');
  assert.equal(etiquetaFecha('2026-07-18', hoy), 'Ayer');
  assert.equal(etiquetaFecha('2026-07-17', hoy), 'Antier');
});

test('etiquetaFecha: más atrás cae a fecha corta', () => {
  assert.equal(etiquetaFecha('2026-07-15', '2026-07-19'), fechaCorta('2026-07-15'));
  assert.match(etiquetaFecha('2026-07-15', '2026-07-19'), /15.*jul/);
});

test('etiquetaFecha: ISO inválida devuelve guion, no rompe', () => {
  assert.equal(etiquetaFecha('basura', '2026-07-19'), '—');
});

/* ---------------- formateo ---------------- */

test('fechaCorta: día + mes abreviado sin punto final', () => {
  // El ICU de es-CO intercala "de" (p. ej. "19 de jul"); lo que importa es
  // que no quede el punto de la abreviatura del mes.
  const corta = fechaCorta('2026-07-19');
  assert.match(corta, /^19 .*jul$/);
  assert.equal(corta.includes('.'), false);
});

test('fechaMedia: día + mes largo', () => {
  assert.equal(fechaMedia('2026-07-19'), '19 de julio');
});

test('fechaLarga: incluye día de la semana y año', () => {
  const larga = fechaLarga('2026-07-19');
  assert.match(larga, /19 de julio de 2026/);
  assert.match(larga, /domingo/); // 19 jul 2026 es domingo
});

/* ---------------- atajosFecha (fecha-sheet, puro) ---------------- */

test('atajosFecha: devuelve Hoy/Ayer/Antier congelados', () => {
  const [hoy, ayer, antier] = atajosFecha('2026-07-19');
  assert.deepEqual(
    { iso: hoy.iso, titulo: hoy.titulo },
    { iso: '2026-07-19', titulo: 'Hoy' },
  );
  assert.equal(ayer.iso, '2026-07-18');
  assert.equal(ayer.titulo, 'Ayer');
  assert.equal(antier.iso, '2026-07-17');
  assert.equal(antier.titulo, 'Antier');
  assert.equal(Object.isFrozen(hoy), true);
});
