/* ============================================================
   olbo · test/cuota-extracto.test.js

   La cuota que sale del extracto. Subir el extracto es EXACTAMENTE el gesto
   con el que se corrige una cuota escrita a mano que quedó mal, y ese campo
   pesa en los fijos del mes y en el semáforo: si no se actualiza, la app
   entera queda mintiendo hasta que alguien lo note.
   Montos FICTICIOS.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { cuotaDesdeExtracto, normalizarExtracto } from '../js/extracto-pdf.js';

test('usa el pago a plazos: es lo mínimo para no entrar en mora', () => {
  assert.equal(cuotaDesdeExtracto({ pagoAPlazos: 180000, pagoMinimo: 250000 }), 180000);
});

test('cae en el pago mínimo si el extracto solo trae ese', () => {
  assert.equal(cuotaDesdeExtracto({ pagoMinimo: 250000 }), 250000);
});

test('sin ninguno de los dos devuelve null, no cero', () => {
  // null = "el extracto no lo dice" y deja la ficha como está. Un 0 borraría
  // la cuota y la sacaría de los fijos del mes.
  assert.equal(cuotaDesdeExtracto({}), null);
  assert.equal(cuotaDesdeExtracto({ pagoAPlazos: null, pagoMinimo: null }), null);
});

test('ignora valores que no son un monto entero positivo', () => {
  for (const v of [0, -5000, 1.5, '180000', NaN, Infinity]) {
    assert.equal(cuotaDesdeExtracto({ pagoAPlazos: v }), null, `aceptó ${String(v)}`);
  }
});

test('no revienta con basura', () => {
  for (const v of [undefined, null, 'texto', 42, []]) {
    assert.equal(cuotaDesdeExtracto(v), null);
  }
});

test('encadena con normalizarExtracto: del JSON crudo sale la cuota', () => {
  // Recorrido real: lo que devuelve el modelo → normalización → cuota.
  const r = normalizarExtracto({
    encontrado: true,
    saldo: 12000000,
    pagoAPlazos: '180.000',
    limite: 15,
  });

  assert.equal(r.pagoAPlazos, 180000);
  assert.equal(cuotaDesdeExtracto(r), 180000);
});

test('una cuota de la ficha muy alta se corrige con la del extracto', () => {
  // El caso que originó el arreglo: la ficha tenía una cuota escrita a mano
  // muy por encima de lo real y subir el extracto no la tocaba.
  const fichaMal = 5000000;
  const r = normalizarExtracto({ encontrado: true, pagoAPlazos: 180000 });
  const cuota = cuotaDesdeExtracto(r);

  assert.notEqual(cuota, fichaMal);
  assert.equal(cuota, 180000);
});
