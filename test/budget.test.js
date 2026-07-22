/* ============================================================
   Bolsillo · test/budget.test.js
   Matriz EXHAUSTIVA del motor del semáforo (calcularEstado).
   Node test runner, AAA, nombres en español. Todo debe quedar verde.
   El "hoy" siempre se inyecta como ISO para no depender del reloj.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularEstado, diasEnMes, resumenNegocios } from '../js/budget.js';
import { crearMovimiento, crearRecurrente, crearCredito, crearIngreso } from '../js/model.js';

/* ---- factories de apoyo ---- */
function gasto(fecha, monto, over = {}) {
  return crearMovimiento({ fecha, monto, tipo: 'gasto', cuenta: 'Efectivo', ...over });
}
function fijo(fecha, monto, over = {}) {
  return crearMovimiento({ fecha, monto, tipo: 'gasto', cuenta: 'Efectivo', esFijo: true, ...over });
}
function ingresoMov(fecha, monto, over = {}) {
  return crearMovimiento({ fecha, monto, tipo: 'ingreso', cuenta: 'Nequi', ...over });
}
function recurrente(over = {}) {
  return crearRecurrente({
    nombre: 'Arriendo', monto: 1_200_000, diaDelMes: 5,
    categoria: 'vivienda', cuenta: 'Bancolombia', modo: 'confirmar', ...over,
  });
}
function credito(over = {}) {
  return crearCredito({ entidad: 'AV Villas', producto: 'Libre inversión', cuotaMensual: 850_000, ...over });
}
const cerca = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

/* ============================================================
   diasEnMes (helper puro)
   ============================================================ */
test('diasEnMes: marzo 31, abril 30, febrero 2026 (no bisiesto) 28', () => {
  assert.equal(diasEnMes('2026-03-15'), 31);
  assert.equal(diasEnMes('2026-04-10'), 30);
  assert.equal(diasEnMes('2026-02-10'), 28);
  assert.equal(diasEnMes('2024-02-10'), 29); // bisiesto de control
});

/* ============================================================
   sin-config
   ============================================================ */
test('sin-config: ingreso 0 devuelve color sin-config sin NaN', () => {
  // Arrange
  const movs = [gasto('2026-04-05', 50_000)];
  // Act
  const e = calcularEstado({ ingresoEmpleo: 0, movimientos: movs, recurrentes: [], hoy: '2026-04-10' });
  // Assert
  assert.equal(e.color, 'sin-config');
  assert.equal(e.configurado, false);
  assert.equal(e.ritmo, null);
  assert.equal(e.razon, null);
  assert.equal(e.porcentajeIngreso, null);
  assert.equal(e.baseVariable, null);
  assert.ok(!Number.isNaN(e.avance) && !Number.isNaN(e.variableGastado));
});

test('sin-config: ingreso null también cae en sin-config', () => {
  const e = calcularEstado({ ingresoEmpleo: null, movimientos: [], recurrentes: [], hoy: '2026-04-10' });
  assert.equal(e.color, 'sin-config');
  assert.equal(e.ingresoEmpleo, 0);
});

/* ============================================================
   día 1 con arriendo fijo → los fijos NO son gasto variable
   ============================================================ */
test('día 1 con arriendo fijo: no es rojo, los fijos no cuentan como variable', () => {
  // Arrange: sueldo 3.000.000, arriendo fijo 1.200.000, cero gasto variable, día 1
  const movs = [fijo('2026-03-01', 1_200_000, { categoria: 'vivienda' })];
  // Act
  const e = calcularEstado({ ingresoEmpleo: 3_000_000, movimientos: movs, recurrentes: [], hoy: '2026-03-01' });
  // Assert
  assert.equal(e.variableGastado, 0);
  assert.equal(e.fijosDelMes, 1_200_000);
  assert.equal(e.baseVariable, 1_800_000);
  assert.equal(e.ritmo, 0);
  assert.notEqual(e.color, 'rojo');
  assert.equal(e.color, 'verde');
});

/* ============================================================
   Ejemplo de Doug → rojo por ritmo
   ============================================================ */
test('ejemplo Doug: 80% del sueldo el día 10 de 30 → ROJO por ritmo', () => {
  // Arrange
  const movs = [gasto('2026-04-05', 2_400_000, { categoria: 'ocio' })];
  // Act
  const e = calcularEstado({ ingresoEmpleo: 3_000_000, movimientos: movs, recurrentes: [], hoy: '2026-04-10' });
  // Assert
  assert.equal(e.diasMes, 30);
  assert.ok(cerca(e.avance, 10 / 30));
  assert.ok(cerca(e.ritmo, 0.8));
  assert.ok(cerca(e.razon, 2.4), `razon=${e.razon}`);
  assert.ok(e.razon > 1.25);
  assert.equal(e.color, 'rojo');
});

/* ============================================================
   Día 28 en buen camino → NO rojo (el fix clave)
   ============================================================ */
test('día 28 de 30 con 90% gastado pero al ritmo → VERDE, explícitamente NO rojo', () => {
  // Arrange: 2.700.000 de 3.000.000 (90%) pero ya es día 28
  const movs = [gasto('2026-04-27', 2_700_000, { categoria: 'mercado' })];
  // Act
  const e = calcularEstado({ ingresoEmpleo: 3_000_000, movimientos: movs, recurrentes: [], hoy: '2026-04-28' });
  // Assert
  assert.ok(cerca(e.avance, 28 / 30));
  assert.ok(cerca(e.ritmo, 0.9));
  assert.ok(e.razon <= 1.0, `razon=${e.razon} debería ser <= 1`);
  assert.notEqual(e.color, 'rojo'); // el punto del fix
  assert.equal(e.color, 'verde');
});

/* ============================================================
   Banda ámbar (1.0 < razon <= amarillo)
   ============================================================ */
test('banda ámbar: razon ~1.1 → ambar', () => {
  // Arrange: día 15 de 30 (avance 0.5), 1.650.000/3.000.000 → ritmo 0.55, razon 1.1
  const movs = [gasto('2026-04-14', 1_650_000, { categoria: 'restaurantes' })];
  // Act
  const e = calcularEstado({ ingresoEmpleo: 3_000_000, movimientos: movs, recurrentes: [], hoy: '2026-04-15' });
  // Assert
  assert.ok(e.razon > 1.0 && e.razon <= 1.25, `razon=${e.razon}`);
  assert.equal(e.color, 'ambar');
});

/* ============================================================
   ritmo >= 1.0 → rojo por tope absoluto
   ============================================================ */
test('ritmo >= 1.0 en día temprano → ROJO por tope absoluto', () => {
  // Arrange: gastó toda la bolsa variable el día 5
  const movs = [gasto('2026-04-04', 2_000_000, { categoria: 'ocio' })];
  // Act
  const e = calcularEstado({ ingresoEmpleo: 2_000_000, movimientos: movs, recurrentes: [], hoy: '2026-04-05' });
  // Assert
  assert.ok(e.ritmo >= 1.0);
  assert.equal(e.color, 'rojo');
});

test('tope absoluto aísla el OR: día 30, razon=1.0 pero ritmo=1.0 → ROJO', () => {
  // Arrange: al último día, razon=1.0 (que por sí solo sería verde) pero ritmo=1.0
  const movs = [gasto('2026-04-29', 2_000_000, { categoria: 'ocio' })];
  // Act
  const e = calcularEstado({ ingresoEmpleo: 2_000_000, movimientos: movs, recurrentes: [], hoy: '2026-04-30' });
  // Assert
  assert.ok(cerca(e.avance, 1.0));
  assert.ok(cerca(e.razon, 1.0));
  assert.ok(cerca(e.ritmo, 1.0));
  assert.equal(e.color, 'rojo'); // sin el OR ritmo>=1 sería verde
});

/* ============================================================
   gasto > ingreso → rojo y disponible negativo
   ============================================================ */
test('gasto variable > base → ROJO y disponibleRestante negativo', () => {
  // Arrange
  const movs = [gasto('2026-04-06', 2_500_000, { categoria: 'ocio' })];
  // Act
  const e = calcularEstado({ ingresoEmpleo: 2_000_000, movimientos: movs, recurrentes: [], hoy: '2026-04-10' });
  // Assert
  assert.equal(e.baseVariable, 2_000_000);
  assert.equal(e.disponibleRestante, -500_000);
  assert.ok(e.disponiblePorDia < 0);
  assert.equal(e.color, 'rojo');
});

/* ============================================================
   febrero (28 días)
   ============================================================ */
test('febrero 2026: diasMes 28 y día 28 → avance 1 y 1 día restante', () => {
  // Arrange
  const movs = [gasto('2026-02-10', 1_000_000, { categoria: 'mercado' })];
  // Act
  const e = calcularEstado({ ingresoEmpleo: 3_000_000, movimientos: movs, recurrentes: [], hoy: '2026-02-28' });
  // Assert
  assert.equal(e.diasMes, 28);
  assert.equal(e.dia, 28);
  assert.equal(e.diasRestantes, 1);
  assert.ok(cerca(e.avance, 1.0));
});

/* ============================================================
   fijos >= ingreso → baseVariable <= 0 → rojo + fijosSuperanIngreso
   ============================================================ */
test('fijos igualan/superan el sueldo → ROJO con flag fijosSuperanIngreso y sin NaN', () => {
  // Arrange
  const movs = [fijo('2026-04-02', 2_000_000, { categoria: 'vivienda' })];
  // Act
  const e = calcularEstado({ ingresoEmpleo: 2_000_000, movimientos: movs, recurrentes: [], hoy: '2026-04-10' });
  // Assert
  assert.equal(e.baseVariable, 0);
  assert.equal(e.color, 'rojo');
  assert.equal(e.fijosSuperanIngreso, true);
  assert.equal(e.ritmo, null);
  assert.ok(!Number.isNaN(e.disponiblePorDia));
});

/* ============================================================
   fijos: NO doble conteo (recurrente ya materializado)
   ============================================================ */
test('fijos sin doble conteo: recurrente materializado + mismo recurrente en lista → cuenta una vez', () => {
  // Arrange
  const rec = recurrente({ monto: 1_200_000 });
  const movMaterializado = fijo('2026-04-05', 1_200_000, { recurrenteId: rec.id, categoria: 'vivienda' });
  // Act
  const e = calcularEstado({
    ingresoEmpleo: 3_000_000, movimientos: [movMaterializado], recurrentes: [rec], hoy: '2026-04-10',
  });
  // Assert
  assert.equal(e.fijosDelMes, 1_200_000); // NO 2.400.000
});

/* ============================================================
   recurrente pendiente (día aún no llega) SÍ compromete
   ============================================================ */
test('recurrente pendiente cuyo día aún no llega → SÍ suma a fijosDelMes (compromiso del mes)', () => {
  // Arrange: recurrente día 25, hoy día 10, sin movimiento este mes
  const rec = recurrente({ monto: 800_000, diaDelMes: 25, activo: true });
  // Act
  const e = calcularEstado({ ingresoEmpleo: 3_000_000, movimientos: [], recurrentes: [rec], hoy: '2026-04-10' });
  // Assert
  assert.equal(e.fijosDelMes, 800_000);
  assert.equal(e.baseVariable, 2_200_000);
});

test('recurrente con excepción saltar no compromete el mes', () => {
  // Arrange
  const rec = recurrente({ monto: 800_000, diaDelMes: 25, excepciones: { '2026-04': { saltar: true } } });
  // Act
  const e = calcularEstado({ ingresoEmpleo: 3_000_000, movimientos: [], recurrentes: [rec], hoy: '2026-04-10' });
  // Assert
  assert.equal(e.fijosDelMes, 0);
});

test('recurrente con excepción monto usa ese monto en el compromiso', () => {
  // Arrange
  const rec = recurrente({ monto: 800_000, diaDelMes: 25, excepciones: { '2026-04': { monto: 500_000 } } });
  // Act
  const e = calcularEstado({ ingresoEmpleo: 3_000_000, movimientos: [], recurrentes: [rec], hoy: '2026-04-10' });
  // Assert
  assert.equal(e.fijosDelMes, 500_000);
});

/* ============================================================
   umbral configurable mueve la frontera ámbar/rojo
   ============================================================ */
test('umbral configurable: razon ~1.3 es rojo con 1.25 pero ámbar con 1.5', () => {
  // Arrange: día 15 de 30 (avance 0.5), 1.950.000/3.000.000 → ritmo 0.65, razon 1.3
  const movs = [gasto('2026-04-14', 1_950_000, { categoria: 'ocio' })];
  const comun = { ingresoEmpleo: 3_000_000, movimientos: movs, recurrentes: [], hoy: '2026-04-15' };
  // Act
  const estricto = calcularEstado({ ...comun, config: { umbralesSemaforo: { amarillo: 1.25 } } });
  const laxo = calcularEstado({ ...comun, config: { umbralesSemaforo: { amarillo: 1.5 } } });
  // Assert
  assert.ok(cerca(estricto.razon, 1.3), `razon=${estricto.razon}`);
  assert.equal(estricto.color, 'rojo');
  assert.equal(laxo.color, 'ambar');
});

/* ============================================================
   porCategoria + totalHormiga + proyección (retornos informativos)
   ============================================================ */
test('porCategoria: agrupa gasto variable por categoría, ordenado desc con pct', () => {
  // Arrange
  const movs = [
    gasto('2026-04-03', 300_000, { categoria: 'mercado' }),
    gasto('2026-04-04', 100_000, { categoria: 'mercado' }),
    gasto('2026-04-05', 600_000, { categoria: 'ocio' }),
  ];
  // Act
  const e = calcularEstado({ ingresoEmpleo: 3_000_000, movimientos: movs, recurrentes: [], hoy: '2026-04-10' });
  // Assert
  assert.equal(e.variableGastado, 1_000_000);
  assert.equal(e.porCategoria[0].categoriaId, 'ocio');
  assert.equal(e.porCategoria[0].total, 600_000);
  assert.ok(cerca(e.porCategoria[0].pct, 0.6));
  assert.equal(e.porCategoria[1].categoriaId, 'mercado');
  assert.equal(e.porCategoria[1].total, 400_000);
});

test('porCategoria: incluye presupuesto y su color cuando existe en config', () => {
  // Arrange
  const movs = [gasto('2026-04-03', 300_000, { categoria: 'mercado' })];
  const config = { presupuestos: { mercado: 200_000 } };
  // Act
  const e = calcularEstado({ ingresoEmpleo: 3_000_000, movimientos: movs, recurrentes: [], hoy: '2026-04-10', config });
  // Assert
  const mercado = e.porCategoria.find((c) => c.categoriaId === 'mercado');
  assert.equal(mercado.presupuesto, 200_000);
  assert.equal(mercado.color, 'rojo'); // 300k > 200k
});

test('totalHormiga: suma solo los gastos hormiga del mes', () => {
  // Arrange: dos gastos chicos (<20.000 umbral default) + uno grande
  const movs = [
    gasto('2026-04-03', 8_000, { categoria: 'hormiga' }),
    gasto('2026-04-04', 12_000, { categoria: 'restaurantes' }),
    gasto('2026-04-05', 500_000, { categoria: 'ocio' }),
  ];
  // Act
  const e = calcularEstado({ ingresoEmpleo: 3_000_000, movimientos: movs, recurrentes: [], hoy: '2026-04-10' });
  // Assert
  assert.equal(e.totalHormiga, 20_000); // 8.000 + 12.000
});

test('proyección: variableGastado / avance, más los fijos', () => {
  // Arrange: 500.000 el día 10 de 30 → proyección variable 1.500.000
  const movs = [gasto('2026-04-05', 500_000, { categoria: 'ocio' }), fijo('2026-04-01', 1_000_000)];
  // Act
  const e = calcularEstado({ ingresoEmpleo: 3_000_000, movimientos: movs, recurrentes: [], hoy: '2026-04-10' });
  // Assert
  assert.equal(e.proyeccionVariable, 1_500_000);
  assert.equal(e.proyeccionTotal, 2_500_000); // 1.500.000 + 1.000.000 fijos
});

/* ============================================================
   filtro de mes: no mezcla movimientos de otros meses
   ============================================================ */
test('no mezcla meses: gasto de marzo no cuenta en el semáforo de abril', () => {
  // Arrange
  const movs = [
    gasto('2026-03-28', 900_000, { categoria: 'ocio' }), // mes anterior
    gasto('2026-04-05', 300_000, { categoria: 'ocio' }),
  ];
  // Act
  const e = calcularEstado({ ingresoEmpleo: 3_000_000, movimientos: movs, recurrentes: [], hoy: '2026-04-10' });
  // Assert
  assert.equal(e.variableGastado, 300_000);
});

test('ingresos, pagos y transferencias no cuentan como gasto variable', () => {
  // Arrange
  const movs = [
    gasto('2026-04-03', 200_000, { categoria: 'mercado' }),
    crearMovimiento({ fecha: '2026-04-04', monto: 500_000, tipo: 'ingreso', cuenta: 'Nequi' }),
    crearMovimiento({ fecha: '2026-04-05', monto: 300_000, tipo: 'pago_credito', cuenta: 'Bancolombia' }),
    crearMovimiento({ fecha: '2026-04-06', monto: 150_000, tipo: 'transferencia', cuenta: 'Efectivo' }),
  ];
  // Act
  const e = calcularEstado({ ingresoEmpleo: 3_000_000, movimientos: movs, recurrentes: [], hoy: '2026-04-10' });
  // Assert
  assert.equal(e.variableGastado, 200_000);
});

/* ============================================================
   LA MATEMÁTICA DEL DINERO DE DOUG
   El semáforo cuenta la REALIDAD: las cuotas de crédito pesan en fijos y
   solo la plata de negocios REGISTRADA como recibida suma a la bolsa.
   ============================================================ */

test('créditos sin ingresos de negocio: las cuotas pesan COMPLETAS en fijos', () => {
  // Arrange: sueldo 17M, dos créditos AV Villas (850k + 320k), nada más.
  const creditos = [
    credito({ producto: 'Libre inversión', cuotaMensual: 850_000 }),
    credito({ producto: 'Tarjeta Visa', cuotaMensual: 320_000 }),
  ];
  // Act
  const e = calcularEstado({ ingresoEmpleo: 17_000_000, movimientos: [], recurrentes: [], creditos, hoy: '2026-04-05' });
  // Assert
  assert.equal(e.fijosDelMes, 1_170_000);
  assert.equal(e.fijosCreditos, 1_170_000);
  assert.equal(e.plataDelMes, 17_000_000);
  assert.equal(e.baseVariable, 15_830_000); // 17M − 1.17M
});

test('las cuotas de crédito bajan el Disponible frente a ignorarlas (bug original)', () => {
  // Arrange
  const creditos = [credito({ cuotaMensual: 850_000 }), credito({ producto: 'Visa', cuotaMensual: 320_000 })];
  const comun = { ingresoEmpleo: 17_000_000, movimientos: [], recurrentes: [], hoy: '2026-04-05' };
  // Act
  const conCreditos = calcularEstado({ ...comun, creditos });
  const sinCreditos = calcularEstado({ ...comun, creditos: [] });
  // Assert: exactamente 1.170.000 menos de bolsa por incluir las cuotas.
  assert.equal(sinCreditos.baseVariable - conCreditos.baseVariable, 1_170_000);
});

test('cobertura parcial: el negocio trae menos que la cuota → el faltante reduce la bolsa', () => {
  // Arrange: crédito cuota 850k; el negocio solo trajo 500k este mes.
  const c = credito({ cuotaMensual: 850_000 });
  const movs = [ingresoMov('2026-04-04', 500_000)];
  // Act
  const e = calcularEstado({ ingresoEmpleo: 3_000_000, movimientos: movs, recurrentes: [], creditos: [c], hoy: '2026-04-10' });
  // Assert
  assert.equal(e.ingresosRecibidos, 500_000);
  assert.equal(e.fijosDelMes, 850_000);
  assert.equal(e.plataDelMes, 3_500_000); // 3M + 500k recibido
  assert.equal(e.baseVariable, 2_650_000); // 3.5M − 850k
  // El faltante (350k) sale de la bolsa vs. no tener crédito ni ingreso (3M).
  const baseline = calcularEstado({ ingresoEmpleo: 3_000_000, movimientos: [], recurrentes: [], creditos: [], hoy: '2026-04-10' });
  assert.equal(baseline.baseVariable - e.baseVariable, 350_000);
});

test('cobertura EXACTA: entra justo la cuota → baseVariable NO cambia vs. sin crédito ni ingreso', () => {
  // Arrange: crédito cuota 850k; el negocio trajo exactamente 850k.
  const c = credito({ cuotaMensual: 850_000 });
  const movs = [ingresoMov('2026-04-04', 850_000)];
  // Act
  const conAmbos = calcularEstado({ ingresoEmpleo: 3_000_000, movimientos: movs, recurrentes: [], creditos: [c], hoy: '2026-04-10' });
  const baseline = calcularEstado({ ingresoEmpleo: 3_000_000, movimientos: [], recurrentes: [], creditos: [], hoy: '2026-04-10' });
  // Assert: la plata entra y sale, la bolsa no se mueve.
  assert.equal(conAmbos.baseVariable, baseline.baseVariable);
  assert.equal(conAmbos.baseVariable, 3_000_000);
});

test('excedente: el negocio trae MÁS que la cuota → el excedente SÍ suma a la bolsa', () => {
  // Arrange: crédito cuota 850k; el negocio trajo 1.000.000.
  const c = credito({ cuotaMensual: 850_000 });
  const movs = [ingresoMov('2026-04-04', 1_000_000)];
  // Act
  const e = calcularEstado({ ingresoEmpleo: 3_000_000, movimientos: movs, recurrentes: [], creditos: [c], hoy: '2026-04-10' });
  const baseline = calcularEstado({ ingresoEmpleo: 3_000_000, movimientos: [], recurrentes: [], creditos: [], hoy: '2026-04-10' });
  // Assert: +150.000 de bolsa (1.000.000 − 850.000 de cuota).
  assert.equal(e.baseVariable, 3_150_000);
  assert.equal(e.baseVariable - baseline.baseVariable, 150_000);
});

test('sin doble conteo: pago_credito ligado al crédito NO se cuenta también como cuota abstracta', () => {
  // Arrange: crédito cuota 850k + un pago_credito de 850k con creditoId este mes.
  const c = credito({ cuotaMensual: 850_000 });
  const pago = crearMovimiento({ fecha: '2026-04-05', monto: 850_000, tipo: 'pago_credito', cuenta: 'Bancolombia', creditoId: c.id });
  // Act
  const e = calcularEstado({ ingresoEmpleo: 3_000_000, movimientos: [pago], recurrentes: [], creditos: [c], hoy: '2026-04-10' });
  // Assert: 850k UNA vez, no 1.700.000.
  assert.equal(e.fijosDelMes, 850_000);
  assert.equal(e.fijosCreditos, 850_000);
});

test('sin doble conteo: gasto esFijo con creditoId ya cuenta como fijo (no se suma la cuota)', () => {
  // Arrange: crédito cuota 850k + un gasto fijo de 850k con creditoId.
  const c = credito({ cuotaMensual: 850_000 });
  const movFijo = fijo('2026-04-05', 850_000, { categoria: 'creditos', creditoId: c.id });
  // Act
  const e = calcularEstado({ ingresoEmpleo: 3_000_000, movimientos: [movFijo], recurrentes: [], creditos: [c], hoy: '2026-04-10' });
  // Assert: 850k UNA vez.
  assert.equal(e.fijosDelMes, 850_000);
});

test('crédito INACTIVO no pesa en los fijos', () => {
  // Arrange
  const c = credito({ cuotaMensual: 850_000, activo: false });
  // Act
  const e = calcularEstado({ ingresoEmpleo: 3_000_000, movimientos: [], recurrentes: [], creditos: [c], hoy: '2026-04-10' });
  // Assert
  assert.equal(e.fijosDelMes, 0);
  assert.equal(e.fijosCreditos, 0);
  assert.equal(e.baseVariable, 3_000_000);
});

test('crédito sin cuota (0) no rompe ni suma', () => {
  // Arrange
  const c = credito({ cuotaMensual: 0 });
  // Act
  const e = calcularEstado({ ingresoEmpleo: 3_000_000, movimientos: [], recurrentes: [], creditos: [c], hoy: '2026-04-10' });
  // Assert
  assert.equal(e.fijosDelMes, 0);
  assert.ok(!Number.isNaN(e.baseVariable));
});

test('el ingreso de negocio de OTRO mes no infla la plata del mes actual', () => {
  // Arrange
  const movs = [ingresoMov('2026-03-28', 900_000), ingresoMov('2026-04-04', 300_000)];
  // Act
  const e = calcularEstado({ ingresoEmpleo: 3_000_000, movimientos: movs, recurrentes: [], creditos: [], hoy: '2026-04-10' });
  // Assert
  assert.equal(e.ingresosRecibidos, 300_000);
  assert.equal(e.plataDelMes, 3_300_000);
});

/* ============================================================
   resumenNegocios: ¿los negocios cubren sus créditos?
   ============================================================ */

test('resumenNegocios: cobertura, color y crédito vinculado por fuente', () => {
  // Arrange: dos negocios, uno cubre su cuota justo (verde), otro va corto (rojo).
  const cTierra = credito({ entidad: 'AV Villas', producto: 'Libre inversión', cuotaMensual: 850_000 });
  const cDC = credito({ entidad: 'Bancolombia', producto: 'Tarjeta', cuotaMensual: 320_000 });
  const fTierra = crearIngreso({ fuente: 'negocio', nombre: 'Tierra Querida', diaDelMes: 15, creditoId: cTierra.id });
  const fDC = crearIngreso({ fuente: 'negocio', nombre: 'DC Medical', diaDelMes: 20, creditoId: cDC.id, montoEsperado: 400_000 });
  const movs = [
    ingresoMov('2026-04-05', 850_000, { ingresoId: fTierra.id }),
    ingresoMov('2026-04-06', 100_000, { ingresoId: fDC.id }),
  ];
  // Act
  const filas = resumenNegocios({ fuentes: [fTierra, fDC], movimientos: movs, creditos: [cTierra, cDC], hoy: '2026-04-10' });
  // Assert
  const tierra = filas.find((f) => f.nombre === 'Tierra Querida');
  assert.equal(tierra.recibido, 850_000);
  assert.equal(tierra.cuota, 850_000);
  assert.ok(cerca(tierra.cobertura, 1));
  assert.equal(tierra.color, 'verde');
  assert.equal(tierra.creditoLabel, 'AV Villas · Libre inversión');

  const dc = filas.find((f) => f.nombre === 'DC Medical');
  assert.equal(dc.recibido, 100_000);
  assert.equal(dc.esperado, 400_000);
  assert.ok(cerca(dc.cobertura, 100_000 / 320_000));
  assert.equal(dc.color, 'rojo'); // 0,31 < 0,6
});

test('resumenNegocios: negocio sin crédito vinculado → sin cobertura, sin romper', () => {
  // Arrange
  const f = crearIngreso({ fuente: 'negocio', nombre: 'Arriendo apto', diaDelMes: 1 });
  const movs = [ingresoMov('2026-04-03', 700_000, { ingresoId: f.id })];
  // Act
  const [fila] = resumenNegocios({ fuentes: [f], movimientos: movs, creditos: [], hoy: '2026-04-10' });
  // Assert
  assert.equal(fila.recibido, 700_000);
  assert.equal(fila.cuota, null);
  assert.equal(fila.cobertura, null);
  assert.equal(fila.color, null);
  assert.equal(fila.creditoLabel, null);
});

test('resumenNegocios: sin fuentes de negocio devuelve lista vacía', () => {
  assert.deepEqual(resumenNegocios({ fuentes: [], movimientos: [], creditos: [], hoy: '2026-04-10' }), []);
});
