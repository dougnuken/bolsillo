/* ============================================================
   Bolsillo · views/cfg-pantalla.js
   "Pantalla": mide la geometría real del dispositivo y la muestra sin
   adivinar. Es un INSTRUMENTO, no un panel de ajustes.

   POR QUÉ EXISTE ESTA HOJA
   El dock quedaba flotando lejos del borde inferior en la PWA instalada.
   Sobre una captura nativa de iPhone 16 Pro Max (1320×2868 px = 440×956 pt)
   se midió que la última fila pintada por la página está a 62 pt del borde,
   y que 62 pt es exactamente env(safe-area-inset-top) de ese equipo: iOS le
   da a la página un viewport de `pantalla − inset superior` pero anclado
   arriba, así que el hueco cae abajo. Ese hueco NO se puede direccionar con
   CSS: por eso doce rondas de ajustes al padding nunca cerraron.

   v61 — SE QUITÓ EL INTERRUPTOR "pegar la barra al borde físico". Su premisa
   era que quizá iOS sí pintaba ahí; la respuesta resultó ser no, y encenderlo
   dejaba el dock con 2 px visibles y el + partido. Vivía en localStorage, o
   sea sobrevivía a las actualizaciones, y con el déficit ya cubierto se
   dibujaba deshabilitado: se veía apagado mientras seguía encendido. Un
   ajuste que solo puede romper y que además miente sobre su estado no es un
   ajuste. Lo que queda son las medidas y las dos reglas de prueba.
   ============================================================ */

import { aplicarViewport, medirSafeAreas } from '../viewport.js';
import { esc } from '../html.js';
import { hojaNav, cabecera, bindCabecera, notaCfg } from './cfg-sheet.js';

const pt = (n) => `${Math.round(n)} pt`;

/** Fila de dato: etiqueta a la izquierda, número tabular a la derecha. PURA. */
function dato(etq, valor, { alerta = false } = {}) {
  return `
    <div class="vp-dato${alerta ? ' vp-dato--alerta' : ''}">
      <span class="vp-dato__k">${esc(etq)}</span>
      <span class="vp-dato__v num">${esc(valor)}</span>
    </div>`;
}

/**
 * Diagnóstico legible del estado del viewport. PURA: recibe la medición ya
 * hecha para poder probarse en Node.
 * @param {{standalone:boolean, deficit:number}} m
 * @returns {{titulo:string, texto:string, tipo:'ok'|'warn'|'err'}}
 */
export function veredicto({ standalone, deficit, ganancia = 0, restante = deficit } = {}) {
  if (!standalone) {
    return {
      titulo: 'Estás en el navegador',
      tipo: 'warn',
      texto: 'Lo que sobra abajo es la barra de Safari, no un problema de la app. '
        + 'Para medir de verdad, abre Bolsillo desde el ícono de la pantalla de inicio.',
    };
  }
  if (deficit <= 0) {
    return {
      titulo: 'El viewport llega al borde',
      tipo: 'ok',
      texto: 'iOS le está dando a la página toda la pantalla. La barra ya se apoya lo más abajo posible.',
    };
  }
  return {
    titulo: `iOS te está quitando ${pt(deficit)}`,
    tipo: 'warn',
    texto: `La página termina ${pt(deficit)} antes del borde físico y ahí abajo queda una franja `
      + 'negra que la app no puede pintar. No es un ajuste pendiente: es el marco que iOS le da a '
      + 'la ventana, y desde la web no hay forma de entrar ahí. Lo que sí está garantizado es que '
      + 'la barra y el + quedan dentro de lo visible.',
  };
}

/**
 * Abre la hoja de Pantalla.
 * @param {{onSaved?: () => void}} [opts]
 */
export function abrirPantalla({ onSaved } = {}) {
  return hojaNav((api) => {
    function pantalla() {
      const m = aplicarViewport();
      const safe = medirSafeAreas();
      const v = veredicto(m);
      // v60: el déficit REAL, no lo que quedaba tras una "recuperación" que
      // nunca ocurrió. De esto dependen las reglas de prueba de abajo.
      const hayDeficit = m.deficit > 0;

      const html = `
        ${cabecera('Pantalla', { sub: 'Cuánta pantalla le da iOS a la app — medido en este equipo.' })}
        ${notaCfg(`<strong>${esc(v.titulo)}.</strong> ${esc(v.texto)}`, { tipo: v.tipo })}

        <p class="field__label field__label--section">Medidas</p>
        <div class="vp-datos">
          ${dato('Pantalla del equipo', `${Math.round(m.anchoPantalla)} × ${Math.round(m.alturaPantalla)}`)}
          ${dato('Viewport de la página', `${Math.round(m.anchoPagina)} × ${Math.round(m.alturaPagina)}`)}
          ${dato('Viewport grande (lvh)', m.lvh ? `${Math.round(m.anchoPagina)} × ${Math.round(m.lvh)}` : 'no soportado')}
          ${dato('Franja fuera del viewport', pt(m.deficit), { alerta: hayDeficit })}
          ${dato('Safe area · arriba', pt(safe.top))}
          ${dato('Safe area · abajo', pt(safe.bottom))}
          ${dato('Modo', m.standalone ? 'Instalada' : 'Navegador')}
        </div>

        ${hayDeficit ? `
          <div class="cfg-sep"></div>
          <p class="cfg-hint">Esa franja está <strong>fuera</strong> de lo que iOS le deja pintar a la
            app: no se puede recuperar desde la web. Se intentó dos veces —bajando la barra con un
            margen negativo (v58) y estirando la app al viewport grande (v59)— y las dos veces el
            resultado fue el dock y el + cortados, porque mover algo a una zona que no se compone es
            lo mismo que esconderlo. Desde la v72 la barra se ancla al viewport de verdad y queda
            siempre en cuadro; la franja sigue ahí, en negro, y así se queda.</p>` : ''}

        ${hayDeficit ? `
          <div class="cfg-sep"></div>
          <p class="field__label field__label--section">Reglas de prueba</p>
          <p class="cfg-hint">Mientras esta hoja esté abierta se dibujan dos líneas al fondo de la
            pantalla: la <strong>coral</strong> marca dónde termina el viewport y la
            <strong>azul</strong> dónde está el borde físico. Si ves las dos, la franja sí se puede
            usar. Si solo ves la coral, iOS la está recortando.</p>` : ''}`;

      api.pintar(html, (panel) => {
        bindCabecera(panel, { cerrar: () => { limpiarReglas(); api.cerrar(); } });


        if (hayDeficit) pintarReglas(); else limpiarReglas();
      });
    }

    pantalla();
  });
}

/* --- reglas de prueba: dos líneas fijas al fondo del viewport --- */
function pintarReglas() {
  limpiarReglas();
  const wrap = document.createElement('div');
  wrap.className = 'vp-reglas';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.innerHTML = '<span class="vp-regla vp-regla--vp"></span><span class="vp-regla vp-regla--fisico"></span>';
  document.body.appendChild(wrap);
}
function limpiarReglas() {
  const v = document.querySelector('.vp-reglas');
  if (v) v.remove();
}
