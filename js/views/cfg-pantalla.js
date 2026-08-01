/* ============================================================
   Bolsillo · views/cfg-pantalla.js
   "Pantalla": mide la geometría real del dispositivo y deja pegar la
   barra al borde FÍSICO cuando iOS no le da a la página toda la pantalla.

   POR QUÉ EXISTE ESTA HOJA
   El dock quedaba flotando lejos del borde inferior en la PWA instalada.
   Sobre una captura nativa de iPhone 16 Pro Max (1320×2868 px = 440×956 pt)
   se midió que la última fila pintada por la página está a 62 pt del borde,
   y que 62 pt es exactamente env(safe-area-inset-top) de ese equipo: iOS le
   da a la página un viewport de `pantalla − inset superior` pero anclado
   arriba, así que el hueco cae abajo. Ese hueco NO se puede direccionar con
   CSS: por eso doce rondas de ajustes al padding nunca cerraron.

   Aquí se ve el número en el propio teléfono —sin adivinar— y se puede
   empujar el chrome flotante hacia esa banda. El interruptor existe porque
   queda una incógnita que solo el dispositivo responde: si iOS RECORTA lo
   que se pinta fuera del viewport, la barra se vería a medias. Si pasa eso,
   se apaga aquí mismo y todo vuelve como estaba.
   ============================================================ */

import {
  aplicarViewport, medirSafeAreas, bordeFisicoActivo, setBordeFisico,
} from '../viewport.js';
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
export function veredicto({ standalone, deficit } = {}) {
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
    tipo: 'err',
    texto: `La página termina ${pt(deficit)} antes del borde físico y ahí abajo queda una franja `
      + 'que la app no puede pintar. Enciende el interruptor para empujar la barra hacia esa franja.',
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
      const activo = bordeFisicoActivo();
      const hayDeficit = m.deficit > 0;

      const html = `
        ${cabecera('Pantalla', { sub: 'Cuánta pantalla le da iOS a la app — medido en este equipo.' })}
        ${notaCfg(`<strong>${esc(v.titulo)}.</strong> ${esc(v.texto)}`, { tipo: v.tipo })}

        <p class="field__label field__label--section">Medidas</p>
        <div class="vp-datos">
          ${dato('Pantalla del equipo', `${Math.round(m.anchoPantalla)} × ${Math.round(m.alturaPantalla)}`)}
          ${dato('Viewport de la página', `${Math.round(m.anchoPagina)} × ${Math.round(m.alturaPagina)}`)}
          ${dato('Franja que no alcanzamos', pt(m.deficit), { alerta: hayDeficit })}
          ${dato('Safe area · arriba', pt(safe.top))}
          ${dato('Safe area · abajo', pt(safe.bottom))}
          ${dato('Modo', m.standalone ? 'Instalada' : 'Navegador')}
        </div>

        <div class="cfg-sep"></div>
        <label class="field toggle-row">
          <span class="field__label">Pegar la barra al borde físico</span>
          <span class="switch${activo ? ' is-on' : ''}" role="switch" aria-checked="${activo}"
            tabindex="0" data-act="borde"${hayDeficit ? '' : ' aria-disabled="true"'}><span class="switch__dot"></span></span>
        </label>
        <p class="cfg-hint">${hayDeficit
    ? 'Baja la barra y el botón + los ' + esc(pt(m.deficit)) + ' que iOS nos quita. '
      + 'Míralos mientras lo enciendes: si la barra se ve cortada por abajo, apágalo y queda como estaba.'
    : 'No hace falta: no hay franja muerta que recuperar en este equipo.'}</p>

        ${hayDeficit ? `
          <div class="cfg-sep"></div>
          <p class="field__label field__label--section">Reglas de prueba</p>
          <p class="cfg-hint">Mientras esta hoja esté abierta se dibujan dos líneas al fondo de la
            pantalla: la <strong>coral</strong> marca dónde termina el viewport y la
            <strong>azul</strong> dónde está el borde físico. Si ves las dos, la franja sí se puede
            usar. Si solo ves la coral, iOS la está recortando.</p>` : ''}`;

      api.pintar(html, (panel) => {
        bindCabecera(panel, { cerrar: () => { limpiarReglas(); api.cerrar(); } });

        const sw = panel.querySelector('[data-act="borde"]');
        const alternar = () => {
          if (!hayDeficit) return;
          const ahora = setBordeFisico(!bordeFisicoActivo());
          sw.classList.toggle('is-on', ahora);
          sw.setAttribute('aria-checked', String(ahora));
          if (typeof onSaved === 'function') onSaved();
        };
        sw.addEventListener('click', alternar);
        sw.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alternar(); }
        });

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
