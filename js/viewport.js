/* ============================================================
   Bolsillo · viewport.js
   Mide la geometría REAL de la pantalla y la compara con el viewport
   que iOS le entrega a la página, porque en la PWA instalada NO siempre
   coinciden.

   EL BUG QUE ORIGINA ESTE ARCHIVO (medido sobre una captura nativa de
   iPhone 16 Pro Max, 1320×2868 px = 440×956 pt):
     · el contenido llega al píxel 0 arriba (viewport-fit=cover funciona),
     · pero la última fila que pinta la página está a 62 pt del borde
       inferior FÍSICO: de ahí para abajo hay una losa perfectamente plana
       de #0B0B0D — el background-color de <html> propagado al canvas.
     · 62 pt es EXACTAMENTE env(safe-area-inset-top) de ese equipo. O sea:
       el viewport de maquetación mide `pantalla − inset superior` pero va
       anclado ARRIBA, así que el hueco cae abajo.
     · encima, env(safe-area-inset-bottom) sigue reportando ~34 pt, que el
       dock volvía a sumar. 62 + 34 = 96 pt muertos (10% de la pantalla).

   Por eso doce versiones de retoques CSS no cerraron nunca: 62 de esos
   96 pt viven FUERA de lo que el CSS puede direccionar. Aquí se mide el
   déficit en tiempo real y se expone como `--vp-deficit` + banderas en
   <html>, para que los tokens decidan con un dato y no con una suposición.

   `calcularDeficit` es PURA (testeable en Node). El resto toca el DOM.
   ============================================================ */

/* Techo de cordura: por encima de esto el número no es "banda muerta" sino
   otra cosa (rotación a medias, Split View, un navegador de escritorio) y
   preferimos no tocar nada antes que mover el dock a ciegas. */
export const DEFICIT_MAX = 140;
/* Por debajo de esto es ruido de redondeo, no una banda. */
export const DEFICIT_MIN = 8;

/* Preferencia de pantalla: vive en localStorage —y no en la config de
   IndexedDB como todo lo demás— porque hay que leerla SÍNCRONA antes del
   primer pintado; si llegara async, el dock daría un salto visible en cada
   arranque. No es un dato del usuario: es un ajuste de este dispositivo. */
export const CLAVE_BORDE = 'bolsillo:borde-fisico';

/**
 * Cuánto de la banda muerta recupera la unidad `lvh`. PURA.
 *
 * LA PISTA QUE FALTABA. Doug notó que el hueco de la PWA es EXACTAMENTE del
 * alto de la barra de Safari: iOS le está dando a la app instalada el viewport
 * PEQUEÑO, como si hubiera una toolbar que retraer. Y para eso existe una
 * unidad: `lvh` (large viewport height) = la altura con todo el chrome
 * retraíble oculto. `dvh` —lo único que se probó antes, y de ahí la nota de
 * base.css— vale lo mismo que `svh` mientras la toolbar cuente como visible,
 * así que medía los mismos 894 y parecía confirmar que no había nada que
 * recuperar. `lvh` es la que puede valer 956.
 *
 * @param {{alturaPagina:number, lvh:number}} m
 * @returns {number} pt que el shell puede estirarse usando 100lvh
 */
export function calcularGananciaLvh({ alturaPagina, lvh } = {}) {
  const pagina = Number(alturaPagina);
  const grande = Number(lvh);
  if (!Number.isFinite(pagina) || !Number.isFinite(grande)) return 0;
  if (pagina <= 0 || grande <= 0) return 0;
  const g = Math.round(grande - pagina);
  if (g < DEFICIT_MIN || g > DEFICIT_MAX) return 0;
  return g;
}

/**
 * Cuánto le falta al viewport de la página para llegar al borde físico. PURA.
 * @param {{alturaPagina:number, alturaPantalla:number, standalone:boolean}} m
 * @returns {number} pt de banda muerta (0 = el viewport sí llega al borde)
 */
export function calcularDeficit({ alturaPagina, alturaPantalla, standalone } = {}) {
  // En navegador la diferencia es la barra de herramientas, no una banda
  // muerta: moverse por ella metería el dock DEBAJO del chrome de Safari.
  if (!standalone) return 0;
  const pagina = Number(alturaPagina);
  const pantalla = Number(alturaPantalla);
  if (!Number.isFinite(pagina) || !Number.isFinite(pantalla)) return 0;
  if (pagina <= 0 || pantalla <= 0) return 0;
  const d = Math.round(pantalla - pagina);
  if (d < DEFICIT_MIN || d > DEFICIT_MAX) return 0;
  return d;
}

/** ¿La app corre instalada (no en una pestaña)? */
export function esInstalada() {
  const mm = typeof window.matchMedia === 'function' ? window.matchMedia('(display-mode: standalone)') : null;
  return (mm && mm.matches === true) || window.navigator.standalone === true;
}

/** Mide 100lvh con una sonda invisible (no hay API para leerlo). IMPURA. */
export function medirLvh() {
  if (!(window.CSS && CSS.supports && CSS.supports('height', '100lvh'))) return 0;
  const sonda = document.createElement('div');
  // cssText (CSSOM), NO setAttribute('style'): el CSP de index.html declara
  // style-src 'self' sin 'unsafe-inline', así que el ATRIBUTO style se bloquea
  // y la sonda medía 0. Por CSSOM sí pasa.
  sonda.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:100lvh;visibility:hidden;pointer-events:none';
  document.body.appendChild(sonda);
  const alto = Math.round(sonda.getBoundingClientRect().height);
  sonda.remove();
  return alto;
}

/** Lee la geometría cruda del entorno. IMPURA. */
export function leerEntorno() {
  const vv = window.visualViewport;
  return {
    standalone: esInstalada(),
    alturaPagina: window.innerHeight,
    lvh: medirLvh(),
    anchoPagina: window.innerWidth,
    alturaPantalla: window.screen ? window.screen.height : 0,
    anchoPantalla: window.screen ? window.screen.width : 0,
    alturaVisual: vv ? Math.round(vv.height) : null,
    alturaCliente: document.documentElement.clientHeight,
    dpr: window.devicePixelRatio || 1,
  };
}

/**
 * Valores RESUELTOS de env(safe-area-inset-*). No hay API para leerlos, así
 * que se miden con una sonda invisible que los usa como padding. IMPURA.
 */
export function medirSafeAreas() {
  const sonda = document.createElement('div');
  // Igual que en medirLvh: por CSSOM, nunca por el atributo style (el CSP lo
  // bloquea y los cuatro insets salían 0 — se vio en la propia hoja).
  sonda.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;'
    + 'padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);'
    + 'padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right);';
  document.body.appendChild(sonda);
  const cs = getComputedStyle(sonda);
  const n = (v) => Math.round(parseFloat(v) || 0);
  const r = { top: n(cs.paddingTop), bottom: n(cs.paddingBottom), left: n(cs.paddingLeft), right: n(cs.paddingRight) };
  sonda.remove();
  return r;
}

/** ¿Está activado el modo "pegar el dock al borde físico"? SÍNCRONA. */
export function bordeFisicoActivo() {
  try { return localStorage.getItem(CLAVE_BORDE) === '1'; } catch { return false; }
}

/** Enciende/apaga el modo y repinta. Devuelve el estado aplicado. */
export function setBordeFisico(activo) {
  try { localStorage.setItem(CLAVE_BORDE, activo ? '1' : '0'); } catch { /* modo privado: se queda en memoria */ }
  aplicarViewport();
  return bordeFisicoActivo();
}

/**
 * Mide y publica el resultado en <html>: `--vp-deficit`, `data-vp-corto`
 * (hay banda muerta) y `data-vp-borde` (el usuario pidió pegarse al borde).
 * Los tokens leen esas banderas; ningún componente mide por su cuenta.
 * @returns {object} la medición completa (la usa el diagnóstico de Perfil)
 */
export function aplicarViewport() {
  const env = leerEntorno();
  const deficit = calcularDeficit(env);
  // `lvh` solo se usa cuando hay banda muerta que justifique estirarse: en un
  // navegador normal la diferencia lvh/innerHeight es la toolbar de verdad y
  // crecer hasta ahí metería el shell DEBAJO del chrome de Safari.
  const ganancia = deficit > 0 ? Math.min(calcularGananciaLvh(env), deficit) : 0;
  const restante = Math.max(0, deficit - ganancia);

  const raiz = document.documentElement;
  raiz.style.setProperty('--vp-deficit', restante + 'px');
  raiz.style.setProperty('--vp-piso', ganancia + 'px');
  raiz.dataset.vpLvh = ganancia > 0 ? '1' : '0';
  raiz.dataset.vpCorto = deficit > 0 ? '1' : '0';
  raiz.dataset.vpBorde = restante > 0 && bordeFisicoActivo() ? '1' : '0';
  return { ...env, deficit, ganancia, restante, bordeFisico: bordeFisicoActivo() };
}

/** Arranca la medición y la mantiene al día. Llamar UNA vez, al bootear. */
export function iniciarViewport() {
  aplicarViewport();
  const remedir = () => aplicarViewport();
  window.addEventListener('resize', remedir);
  window.addEventListener('orientationchange', remedir);
  // iOS ajusta el viewport DESPUÉS del primer layout en la app instalada:
  // una segunda pasada tras el load evita quedarse con la medida temprana.
  window.addEventListener('load', () => setTimeout(remedir, 200));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', remedir);
}
