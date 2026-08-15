/* ============================================================
   olbo · vtabs.js — tabs de vista (subrayado + indicador deslizante)
   Un solo patrón de pestañas para toda la app: Hoy (Dashboard/Analytics) y
   la cartera (Mis productos/Me deben/Debo). Antes eran dos componentes
   distintos y las píldoras de la cartera competían con el botón de volver,
   que también es una píldora.
   ============================================================ */

import { esc } from './html.js';

const SEL_BARRA = '.vtabs';
const SEL_BTN = '.vtabs__btn';
const SEL_IND = '.vtabs__ind';

/* tabs = [[id, etiqueta], ...] · activo = id de la pestaña encendida.
   attr = atributo de datos con el que la vista engancha sus listeners. */
export function vtabsHTML(tabs, activo, { attr = 'data-vtab', label = '' } = {}) {
  const botones = tabs.map(([id, texto]) => {
    const on = id === activo;
    return `<button type="button" class="vtabs__btn${on ? ' is-on' : ''}" role="tab"`
      + ` aria-selected="${on}" ${attr}="${esc(id)}">${esc(texto)}</button>`;
  }).join('');
  const aria = label ? ` aria-label="${esc(label)}"` : '';
  return `<div class="vtabs" role="tablist"${aria}>${botones}`
    + `<span class="vtabs__ind" aria-hidden="true"></span></div>`;
}

/* Coloca (y desliza) el subrayado bajo la pestaña activa.
   - animar: false lo planta sin transición (primer pintado).
   - desde: id de la pestaña anterior. Sirve cuando la vista re-renderiza el
     HTML completo al cambiar de tab: el indicador nace en la posición vieja y
     se desliza a la nueva, igual que si el DOM hubiera sobrevivido. */
export function colocarIndicador(root, { animar = true, desde = null, attr = 'data-vtab' } = {}) {
  const barra = root && root.querySelector(SEL_BARRA);
  if (!barra) return;
  const ind = barra.querySelector(SEL_IND);
  const on = barra.querySelector(`${SEL_BTN}.is-on`);
  if (!ind || !on) return;

  const mover = (el, conAnimacion) => {
    if (!conAnimacion) ind.style.transition = 'none';
    ind.style.width = `${el.offsetWidth}px`;
    ind.style.transform = `translateX(${el.offsetLeft}px)`;
    if (!conAnimacion) { void ind.offsetWidth; ind.style.transition = ''; }
  };

  const previo = desde ? barra.querySelector(`[${attr}="${desde}"]`) : null;
  if (previo && previo !== on) {
    mover(previo, false);
    requestAnimationFrame(() => mover(on, true));
    return;
  }
  mover(on, animar);
}

/* Sincroniza clases y aria cuando la vista conserva el DOM de las pestañas. */
export function marcarActiva(root, activo, attr = 'data-vtab') {
  if (!root) return;
  root.querySelectorAll(`[${attr}]`).forEach((b) => {
    const on = b.getAttribute(attr) === activo;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-selected', String(on));
  });
}
