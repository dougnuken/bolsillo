import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularDeficit, calcularGananciaLvh, DEFICIT_MAX, DEFICIT_MIN } from '../js/viewport.js';
import { veredicto } from '../js/views/cfg-pantalla.js';

/* El caso real medido sobre una captura nativa de iPhone 16 Pro Max
   (1320×2868 px = 440×956 pt): la página termina 62 pt antes del borde. */
const IPHONE_16_PRO_MAX = { standalone: true, alturaPantalla: 956, alturaPagina: 894 };

test('calcularDeficit: el caso de iPhone 16 Pro Max da los 62 pt medidos', () => {
  assert.equal(calcularDeficit(IPHONE_16_PRO_MAX), 62);
});

test('calcularDeficit: si el viewport llega al borde, no hay nada que corregir', () => {
  assert.equal(calcularDeficit({ standalone: true, alturaPantalla: 956, alturaPagina: 956 }), 0);
});

test('calcularDeficit: en NAVEGADOR siempre 0 (lo que sobra es la barra de Safari)', () => {
  // 956 - 796 = 160 pt de chrome de Safari. Moverse por ahí metería el dock
  // debajo de la toolbar: justo el error que arrastraban las versiones viejas.
  assert.equal(calcularDeficit({ standalone: false, alturaPantalla: 956, alturaPagina: 796 }), 0);
});

test('calcularDeficit: ignora diferencias de ruido (< 8 pt)', () => {
  assert.equal(calcularDeficit({ standalone: true, alturaPantalla: 956, alturaPagina: 951 }), 0);
  assert.equal(calcularDeficit({ standalone: true, alturaPantalla: 956, alturaPagina: 956 - DEFICIT_MIN }), DEFICIT_MIN);
});

test('calcularDeficit: por encima del techo de cordura no toca nada', () => {
  const enorme = { standalone: true, alturaPantalla: 956, alturaPagina: 956 - DEFICIT_MAX - 1 };
  assert.equal(calcularDeficit(enorme), 0);
  assert.equal(calcularDeficit({ standalone: true, alturaPantalla: 956, alturaPagina: 956 - DEFICIT_MAX }), DEFICIT_MAX);
});

test('calcularDeficit: nunca devuelve negativo ni NaN con basura', () => {
  for (const m of [
    undefined, {}, { standalone: true },
    { standalone: true, alturaPantalla: 0, alturaPagina: 0 },
    { standalone: true, alturaPantalla: NaN, alturaPagina: 894 },
    { standalone: true, alturaPantalla: 894, alturaPagina: 956 }, // página MAYOR que pantalla
    { standalone: true, alturaPantalla: '956', alturaPagina: 'x' },
  ]) {
    const d = calcularDeficit(m);
    assert.equal(Number.isFinite(d), true);
    assert.equal(d >= 0, true);
  }
});

test('calcularGananciaLvh: si lvh es el viewport grande, recupera la banda entera', () => {
  // El caso que sospechamos en la PWA de Doug: innerHeight = viewport pequeño
  // (como si hubiera toolbar), lvh = la pantalla completa.
  assert.equal(calcularGananciaLvh({ alturaPagina: 894, lvh: 956 }), 62);
});

test('calcularGananciaLvh: si lvh vale lo mismo, no hay nada que estirar', () => {
  assert.equal(calcularGananciaLvh({ alturaPagina: 894, lvh: 894 }), 0);
});

test('calcularGananciaLvh: sin soporte de lvh (0) no rompe ni inventa', () => {
  assert.equal(calcularGananciaLvh({ alturaPagina: 894, lvh: 0 }), 0);
  assert.equal(calcularGananciaLvh({}), 0);
  assert.equal(calcularGananciaLvh({ alturaPagina: 894, lvh: NaN }), 0);
});

test('calcularGananciaLvh: respeta el mismo piso y techo de cordura', () => {
  assert.equal(calcularGananciaLvh({ alturaPagina: 894, lvh: 894 + DEFICIT_MIN - 1 }), 0);
  assert.equal(calcularGananciaLvh({ alturaPagina: 894, lvh: 894 + DEFICIT_MAX + 1 }), 0);
});

test('veredicto: si lvh recupera todo, lo canta como resuelto', () => {
  const v = veredicto({ standalone: true, deficit: 62, ganancia: 62, restante: 0 });
  assert.equal(v.tipo, 'ok');
  assert.match(v.titulo, /Recuperados los 62 pt/);
  assert.match(v.texto, /viewport grande/);
});

test('veredicto: si lvh recupera solo una parte, dice cuánto falta', () => {
  const v = veredicto({ standalone: true, deficit: 62, ganancia: 40, restante: 22 });
  assert.equal(v.tipo, 'warn');
  assert.match(v.titulo, /40 pt de 62 pt/);
  assert.match(v.texto, /22 pt/);
});

test('veredicto: en navegador explica que lo que sobra es Safari, no la app', () => {
  const v = veredicto({ standalone: false, deficit: 0 });
  assert.equal(v.tipo, 'warn');
  assert.match(v.texto, /Safari/);
  assert.match(v.texto, /pantalla de inicio/);
});

test('veredicto: sin déficit confirma que la barra ya está lo más abajo posible', () => {
  const v = veredicto({ standalone: true, deficit: 0 });
  assert.equal(v.tipo, 'ok');
  assert.match(v.titulo, /llega al borde/);
});

test('veredicto: con déficit dice cuántos pt se pierden y qué hacer', () => {
  const v = veredicto({ standalone: true, deficit: 62 });
  assert.equal(v.tipo, 'err');
  assert.match(v.titulo, /62 pt/);
  assert.match(v.texto, /interruptor/);
});
