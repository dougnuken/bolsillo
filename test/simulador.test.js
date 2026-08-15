/* ============================================================
   olbo · test/simulador.test.js
   Simulación de compra a cuotas. Lo que se prueba aquí termina en boca de la
   conciencia dándole cifras a alguien que va a decidir si se endeuda, así que
   las invariantes de cuadre importan más que ningún caso bonito.
   Montos FICTICIOS.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cuotaFija, simularCompra, compararPlazos, costoDeEstirar,
  tasaMensualDecimal, PLAZOS_SUGERIDOS, MAX_CUOTAS,
} from '../js/simulador.js';

/* Caso guía: el ejemplo que originó el módulo. */
const PS5 = { capital: 4000000, tasaEA: 28, cuotas: 24 };

test('la tabla cuadra: los abonos a capital suman EXACTAMENTE el capital', () => {
  const s = simularCompra(PS5);
  const sumaCapital = s.tabla.reduce((a, f) => a + f.capital, 0);

  assert.equal(sumaCapital, s.capital);
});

test('el saldo cierra en cero en la última cuota', () => {
  const s = simularCompra(PS5);

  assert.equal(s.tabla[s.tabla.length - 1].saldo, 0);
});

test('total pagado = capital + intereses, sin descuadre de redondeo', () => {
  const s = simularCompra(PS5);
  const sumaCuotas = s.tabla.reduce((a, f) => a + f.cuota, 0);
  const sumaIntereses = s.tabla.reduce((a, f) => a + f.interes, 0);

  assert.equal(s.totalPagado, s.capital + s.totalIntereses);
  assert.equal(s.totalPagado, sumaCuotas);
  assert.equal(s.totalIntereses, sumaIntereses);
});

test('la tabla trae una fila por cuota', () => {
  const s = simularCompra(PS5);

  assert.equal(s.tabla.length, 24);
  assert.deepEqual(s.tabla.map((f) => f.mes), Array.from({ length: 24 }, (_, i) => i + 1));
});

test('a cuotas, se termina pagando más que el precio', () => {
  const s = simularCompra(PS5);

  assert.ok(s.totalIntereses > 0, 'con tasa > 0 tiene que haber intereses');
  assert.ok(s.totalPagado > s.capital);
  assert.ok(s.sobrecosto > 0);
});

test('el interés cae mes a mes y el abono a capital sube', () => {
  // La invariante del sistema francés, y el dato que hay que poder mostrar:
  // la cuota no cambia pero su reparto sí. (Ojo: a 24 meses la primera cuota
  // NO es mayoritariamente interés —eso pasa en plazos largos tipo hipoteca—,
  // así que no se afirma aquí.)
  const s = simularCompra(PS5);

  for (let i = 1; i < s.tabla.length; i += 1) {
    assert.ok(s.tabla[i].interes <= s.tabla[i - 1].interes, `el interés subió en el mes ${i + 1}`);
    assert.ok(s.tabla[i].capital >= s.tabla[i - 1].capital, `el capital bajó en el mes ${i + 1}`);
  }
  assert.ok(s.tabla[0].interes > s.tabla[s.tabla.length - 1].interes);
  assert.ok(s.tabla[0].capital < s.tabla[s.tabla.length - 1].capital);
});

test('en plazos largos SÍ se invierte: la primera cuota es casi toda interés', () => {
  // A 48 meses el cuadro cambia por completo, y es el argumento más fuerte
  // contra estirar el plazo.
  const s = simularCompra({ capital: 4000000, tasaEA: 28, cuotas: 48 });
  const primera = s.tabla[0];

  assert.ok(primera.interes > primera.capital * 0.9,
    `interés ${primera.interes} vs capital ${primera.capital}`);
});

test('estirar el plazo baja la cuota pero encarece el total', () => {
  const doce = simularCompra({ ...PS5, cuotas: 12 });
  const veinticuatro = simularCompra({ ...PS5, cuotas: 24 });

  assert.ok(veinticuatro.cuotaMensual < doce.cuotaMensual);
  assert.ok(veinticuatro.totalIntereses > doce.totalIntereses);
});

test('sin tasa no hay intereses y la cuota es el capital repartido', () => {
  const s = simularCompra({ capital: 1200000, tasaEA: 0, cuotas: 12 });

  assert.equal(s.totalIntereses, 0);
  assert.equal(s.cuotaMensual, 100000);
  assert.equal(s.totalPagado, 1200000);
});

test('a una sola cuota se paga el capital más un mes de interés', () => {
  const s = simularCompra({ capital: 1000000, tasaEA: 28, cuotas: 1 });
  const unMes = Math.round(1000000 * tasaMensualDecimal(28));

  assert.equal(s.tabla.length, 1);
  assert.equal(s.totalIntereses, unMes);
  assert.equal(s.totalPagado, 1000000 + unMes);
});

test('la tasa mensual sale de la efectiva anual, no de dividir entre 12', () => {
  // 28% EA no es 2,333% mensual: es la raíz doceava. Confundirlo infla la cifra.
  const mv = tasaMensualDecimal(28);

  assert.ok(mv > 0.02 && mv < 0.021, `mensual fuera de rango: ${mv}`);
  assert.ok(Math.abs(Math.pow(1 + mv, 12) - 1.28) < 1e-9);
});

test('entradas inválidas devuelven una simulación vacía, sin lanzar', () => {
  for (const malo of [
    undefined, {}, { capital: 0, tasaEA: 28, cuotas: 24 },
    { capital: 4000000, tasaEA: 28, cuotas: 0 },
    { capital: -5000, tasaEA: 28, cuotas: 12 },
    { capital: 'mucha plata', tasaEA: 'cara', cuotas: 'varias' },
  ]) {
    const s = simularCompra(malo);
    assert.equal(s.totalPagado, 0);
    assert.equal(s.tabla.length, 0);
  }
});

test('el plazo se topa en MAX_CUOTAS', () => {
  const s = simularCompra({ capital: 4000000, tasaEA: 28, cuotas: 999 });

  assert.equal(s.cuotas, MAX_CUOTAS);
  assert.equal(s.tabla.length, MAX_CUOTAS);
});

test('cuotaFija coincide con la cuota de la simulación', () => {
  assert.equal(cuotaFija(PS5.capital, PS5.tasaEA, PS5.cuotas), simularCompra(PS5).cuotaMensual);
});

test('compararPlazos ordena de menor a mayor y encarece con el plazo', () => {
  const ops = compararPlazos({ capital: 4000000, tasaEA: 28 });

  assert.equal(ops.length, PLAZOS_SUGERIDOS.length);
  for (let i = 1; i < ops.length; i += 1) {
    assert.ok(ops[i].cuotas > ops[i - 1].cuotas, 'plazos desordenados');
    assert.ok(ops[i].cuotaMensual < ops[i - 1].cuotaMensual, 'la cuota debería bajar');
    assert.ok(ops[i].totalIntereses > ops[i - 1].totalIntereses, 'el interés debería subir');
  }
});

test('compararPlazos acepta una lista propia y descarta lo inválido', () => {
  const ops = compararPlazos({ capital: 2000000, tasaEA: 24, plazos: [6, 0, 12, -3, 999] });

  assert.deepEqual(ops.map((o) => o.cuotas), [6, 12]);
});

test('costoDeEstirar cuantifica el alivio y lo que cuesta', () => {
  const c = costoDeEstirar({ capital: 4000000, tasaEA: 28, de: 12, a: 24 });

  assert.ok(c.alivioMensual > 0, 'la cuota debe bajar al estirar');
  assert.ok(c.costoExtra > 0, 'y debe costar más en total');
  assert.equal(c.totalLargo - c.totalCorto, c.costoExtra);
});

test('costoDeEstirar devuelve null si algún plazo no es simulable', () => {
  assert.equal(costoDeEstirar({ capital: 0, tasaEA: 28, de: 12, a: 24 }), null);
  assert.equal(costoDeEstirar({ capital: 4000000, tasaEA: 28, de: 12, a: 0 }), null);
});

test('el resultado es inmutable: nadie puede alterar una simulación ya entregada', () => {
  const s = simularCompra(PS5);

  assert.throws(() => { s.totalPagado = 1; }, TypeError);
  assert.throws(() => { s.tabla.push({}); }, TypeError);
});
