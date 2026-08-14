/* ============================================================
   olbo · test/diferidos.test.js
   Lógica pura de diferidos: cascada, aislar, abono simulado, interés y
   la comparación mes-a-mes. Fixtures FICTICIOS (datos demo, no reales).
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizarDiferido, ordenarPorCascada, totalDiferido, simularAbono,
  interesMensual, compararCortes, crearCorte, validarCorte, resumenDeudaTexto,
  agruparUltimosCortes, construirBriefDeuda,
  SCHEMA_CORTE, slug,
} from '../js/diferidos.js';

/* Diferidos DEMO (valores ficticios) de un corte de ejemplo. */
const A = { clave: 'compra-a', descripcion: 'TIENDA*DEMO', compte: '000001', fecha: '2026-07-09', saldoCapital: 400000, plazo: 6, cuotasPendientes: 6, tasaEA: 28.02 };
const B = { clave: 'compra-b', descripcion: 'ALMACEN*DEMO', compte: '000002', fecha: '2026-07-24', saldoCapital: 2000000, plazo: 36, cuotasPendientes: 36, tasaEA: 28.02 };
const AV0 = { clave: 'avance-1', descripcion: 'AVANCE DEMO', compte: '000003', fecha: '2026-07-26', saldoCapital: 0, plazo: 48, cuotasPendientes: 48, tasaEA: 28.63 };
const AV1 = { clave: 'avance-2', descripcion: 'AVANCE DEMO', compte: '000004', fecha: '2026-07-30', saldoCapital: 150000, plazo: 48, cuotasPendientes: 47, tasaEA: 28.63 };
const DIFERIDOS = [B, AV1, A, AV0]; // desordenados a propósito
const TOTAL = 2550000; // 400000 + 2000000 + 0 + 150000

/* ---------------- normalizarDiferido ---------------- */

test('normalizarDiferido: congela, deriva clave y nunca deja saldo negativo', () => {
  const d = normalizarDiferido({ descripcion: 'TIENDA*DEMO', saldoCapital: -5, tasaEA: 28.02 });
  assert.ok(Object.isFrozen(d));
  assert.equal(d.clave, 'tienda-demo');    // clave derivada del texto
  assert.equal(d.saldoCapital, 0);         // negativo → 0
  assert.equal(d.tasaEA, 28.02);
});

test('normalizarDiferido: tolerante con basura', () => {
  const d = normalizarDiferido(null);
  assert.equal(d.saldoCapital, 0);
  assert.equal(d.plazo, null);
  assert.equal(d.cuotasPendientes, null);
});

/* ---------------- ordenarPorCascada ---------------- */

test('ordenarPorCascada: ordena por fecha (más antigua primero) y numera', () => {
  const c = ordenarPorCascada(DIFERIDOS);
  assert.deepEqual(c.map((d) => d.clave), ['compra-a', 'compra-b', 'avance-1', 'avance-2']);
  assert.deepEqual(c.map((d) => d.orden), [1, 2, 3, 4]);
});

test('ordenarPorCascada: SOLO la primera compra es aislable (la cabeza con saldo)', () => {
  const c = ordenarPorCascada(DIFERIDOS);
  const por = Object.fromEntries(c.map((d) => [d.clave, d.aislable]));
  assert.equal(por['compra-a'], true);        // cabeza de la fila
  assert.equal(por['compra-b'], false);       // compra-a (con saldo) va antes
  assert.equal(por['avance-2'], false);       // detrás de compra-b
});

/* ---------------- totalDiferido ---------------- */

test('totalDiferido: suma exacta = pago total − pago a plazos', () => {
  assert.equal(totalDiferido(DIFERIDOS), TOTAL);
});

/* ---------------- simularAbono ---------------- */

test('simularAbono: un abono exacto CIERRA la cabeza y no toca a nadie más', () => {
  const r = simularAbono(DIFERIDOS, 400000);
  const cab = r.aplicaciones.find((a) => a.clave === 'compra-a');
  assert.equal(cab.cerrado, true);
  assert.equal(cab.saldoDespues, 0);
  assert.equal(r.sobrante, 0);
  assert.equal(r.aplicaciones.find((a) => a.clave === 'compra-b').aplicado, 0);
});

test('simularAbono: pagar de más → el sobrante cae a la siguiente (indeseado)', () => {
  const r = simularAbono(DIFERIDOS, 400000 + 100000);
  assert.equal(r.aplicaciones.find((a) => a.clave === 'compra-a').cerrado, true);
  assert.equal(r.aplicaciones.find((a) => a.clave === 'compra-b').aplicado, 100000);
});

/* ---------------- interesMensual ---------------- */

test('interesMensual: 0 si saldo o tasa es 0; positivo si hay deuda', () => {
  assert.equal(interesMensual(0, 28.02), 0);
  assert.equal(interesMensual(2000000, 0), 0);
  assert.ok(interesMensual(2000000, 28.02) > 0);
});

/* ---------------- compararCortes (mes-a-mes) ---------------- */

test('compararCortes: cabeza cerrada + resto solo avanza cuota = "aplicó a la cabeza primero"', () => {
  const mes1 = { moneda: 'COP', diferidos: DIFERIDOS };
  const mes2 = {
    moneda: 'COP',
    diferidos: [
      // la cabeza (compra-a) YA NO aparece (se pagó)
      { ...B, cuotasPendientes: 35, saldoCapital: 1950000 },   // avanzó 1 cuota
      { ...AV1, cuotasPendientes: 46, saldoCapital: 148000 },  // avanzó 1 cuota
    ],
  };
  const cmp = compararCortes(mes1, mes2);
  assert.equal(cmp.cerrados.map((x) => x.clave).includes('compra-a'), true);
  assert.equal(cmp.normales.map((x) => x.clave).includes('compra-b'), true);
  assert.ok(/Cerraste:/i.test(cmp.resumenTexto));
});

test('compararCortes: detecta abono extra a un diferido y diferidos nuevos', () => {
  const antes = { moneda: 'COP', diferidos: [B] };
  const despues = {
    moneda: 'COP',
    diferidos: [
      { ...B, cuotasPendientes: 30, saldoCapital: 1400000 }, // saltó 6 cuotas → abono
      { clave: 'nuevo', descripcion: 'COMERCIO*NUEVO', compte: '000009', fecha: '2026-08-05', saldoCapital: 900000, plazo: 12, cuotasPendientes: 12, tasaEA: 28.63 },
    ],
  };
  const cmp = compararCortes(antes, despues);
  assert.equal(cmp.conAbono.map((x) => x.clave).includes('compra-b'), true);
  assert.equal(cmp.nuevos.map((x) => x.clave).includes('nuevo'), true);
});

/* ---------------- crearCorte / validarCorte ---------------- */

test('crearCorte: congela, valida, deriva cuentaClave e id, y calcula el total', () => {
  const corte = crearCorte({
    entidad: 'Banco Demo',
    producto: 'Tarjeta Demo',
    moneda: 'COP',
    corte: '2026-07-31',
    fechaLimitePago: '2026-08-18',
    diferidos: DIFERIDOS,
  }, { now: new Date('2026-08-14T10:00:00Z') });

  assert.ok(Object.isFrozen(corte));
  assert.equal(corte.schema, SCHEMA_CORTE);
  assert.equal(corte.cuentaClave, slug('Banco Demo-Tarjeta Demo-COP'));
  assert.equal(corte.id, corte.cuentaClave + '-2026-07');
  assert.equal(corte.totalDiferido, TOTAL);
  assert.equal(corte.creadoEn, corte.actualizadoEn);
});

test('crearCorte: respeta un id explícito', () => {
  const corte = crearCorte({
    id: 'demo-2026-07-COP',
    entidad: 'Banco Demo', producto: 'Tarjeta Demo',
    moneda: 'COP', corte: '2026-07-31', diferidos: [A],
  });
  assert.equal(corte.id, 'demo-2026-07-COP');
});

test('crearCorte: fail-fast si faltan obligatorios', () => {
  assert.throws(() => crearCorte({ entidad: '', producto: '', moneda: '', corte: 'ayer' }), /Corte inválido/);
});

test('validarCorte: reporta cada campo que falta', () => {
  const v = validarCorte({ entidad: '', producto: 'x', corte: 'no', moneda: '', diferidos: 'nope' });
  assert.equal(v.ok, false);
  assert.ok(v.errores.length >= 3);
});

/* ---------------- resumenDeudaTexto ---------------- */

test('resumenDeudaTexto: nombra la cascada, qué se aísla y el total', () => {
  const corte = crearCorte({
    entidad: 'Banco Demo', producto: 'Tarjeta Demo',
    moneda: 'COP', corte: '2026-07-31', fechaLimitePago: '2026-08-18',
    resumen: { pagoTotal: 3000000, pagoAPlazos: 450000 },
    diferidos: DIFERIDOS,
  });
  const t = resumenDeudaTexto(corte);
  assert.ok(/cascada/i.test(t));
  assert.ok(/TIENDA\*DEMO/i.test(t));        // la primera compra
  assert.ok(/SE PUEDE AISLAR/.test(t));      // la cabeza
  assert.ok(/NO se puede aislar/.test(t));   // el resto
  assert.ok(/Total diferido/i.test(t));
  assert.ok(/Fecha límite de pago: 2026-08-18/.test(t));
});

test('resumenDeudaTexto: cadena vacía si no hay diferidos', () => {
  assert.equal(resumenDeudaTexto({ diferidos: [] }), '');
});

/* ---------------- agruparUltimosCortes / construirBriefDeuda ---------------- */

const CORTE_1 = crearCorte({
  entidad: 'Banco Demo', producto: 'Tarjeta Demo',
  moneda: 'COP', corte: '2026-07-31', diferidos: DIFERIDOS,
});
const CORTE_2 = crearCorte({
  entidad: 'Banco Demo', producto: 'Tarjeta Demo',
  moneda: 'COP', corte: '2026-08-31',
  diferidos: [ // la cabeza ya no aparece; la segunda avanzó una cuota
    { ...B, cuotasPendientes: 35, saldoCapital: 1950000 },
    { ...AV1, cuotasPendientes: 46, saldoCapital: 148000 },
  ],
});

test('agruparUltimosCortes: agrupa por cuentaClave y separa último/anterior', () => {
  const g = agruparUltimosCortes([CORTE_1, CORTE_2]);
  assert.equal(g.size, 1);
  const { ultimo, anterior } = [...g.values()][0];
  assert.equal(ultimo.corte, '2026-08-31'); // el más reciente
  assert.equal(anterior.corte, '2026-07-31');
});

test('construirBriefDeuda: incluye el estado del último corte y los cambios vs el anterior', () => {
  const brief = construirBriefDeuda([CORTE_1, CORTE_2]);
  assert.ok(/DEUDA DIFERIDA/i.test(brief));
  assert.ok(/CAMBIOS vs el corte anterior/i.test(brief));
  assert.ok(/Cerraste:/i.test(brief));  // aplicó a la cabeza de la cascada
});

test('construirBriefDeuda: sin cortes → cadena vacía', () => {
  assert.equal(construirBriefDeuda([]), '');
});
