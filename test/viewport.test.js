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

// v61 — se retiraron los casos "lvh recuperó N pt". Estirar el shell a 100lvh
// nunca recuperó nada: solo empujaba el chrome fuera del área que iOS compone.
// Que `ganancia` valga lo que valga, el veredicto NO puede prometer terreno
// ganado, porque el déficit es del marco nativo y sigue ahí.
test('veredicto: aunque lvh ofrezca ganancia, no promete haber recuperado nada', () => {
  const v = veredicto({ standalone: true, deficit: 62, ganancia: 62, restante: 0 });
  assert.equal(v.tipo, 'warn');
  assert.doesNotMatch(v.titulo, /Recuperad/i);
  assert.doesNotMatch(v.texto, /interruptor/i);
  assert.match(v.texto, /62 pt/);
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

test('veredicto: con déficit dice cuántos pt se pierden y que no son recuperables', () => {
  const v = veredicto({ standalone: true, deficit: 62 });
  assert.equal(v.tipo, 'warn');
  assert.match(v.titulo, /62 pt/);
  // No debe mandar al usuario a tocar un interruptor que ya no existe.
  assert.doesNotMatch(v.texto, /interruptor/i);
  assert.match(v.texto, /no hay forma/i);
});

// v68 — Android: la diferencia con screen.height es la barra de navegación del
// sistema, no una banda muerta. Tratarla como déficit ponía --dock-gap en 0 y
// metía el dock DEBAJO de los controles Atrás/Inicio/Recientes. Verificado en
// dispositivo: en Android el viewport sí llega al borde, no hay nada que ganar.
test('calcularDeficit: en Android instalada NO hay déficit que compensar', () => {
  assert.equal(calcularDeficit({ alturaPagina: 894, alturaPantalla: 956, standalone: true, ios: false }), 0);
});

test('calcularDeficit: en iOS instalada sí lo mide', () => {
  assert.equal(calcularDeficit({ alturaPagina: 894, alturaPantalla: 956, standalone: true, ios: true }), 62);
});
