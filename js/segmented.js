/* ============================================================
   olbo · segmented.js — control segmentado (estilo iOS)
   Track claro con una pastilla deslizante debajo de la opción activa. El CSS
   del componente (.seg / .seg__thumb / .seg__opt) ya existía para el selector
   Gasto·Ingreso de Registrar, pero su lógica vivía acoplada al STATE de esa
   hoja. Aquí queda la parte reutilizable, sin dependencias de ninguna vista.
   ============================================================ */

import { esc } from './html.js';

const SEL_SEG = '.seg';
const SEL_OPT = '.seg__opt';
const SEL_THUMB = '.seg__thumb';

/* opciones = [[id, etiqueta], ...] · activo = id de la encendida.
   attr = atributo de datos con el que la vista engancha sus clics. */
export function segHTML(opciones, activo, { attr = 'data-seg', label = '' } = {}) {
  const botones = opciones.map(([id, texto]) => {
    const on = id === activo;
    return `<button type="button" class="seg__opt${on ? ' is-on' : ''}" role="tab"`
      + ` aria-selected="${on}" ${attr}="${esc(id)}">${esc(texto)}</button>`;
  }).join('');
  const aria = label ? ` aria-label="${esc(label)}"` : '';
  const cols = opciones.length === 3 ? ' seg--3' : '';
  return `<div class="seg${cols}" role="tablist"${aria}>`
    + `<span class="seg__thumb" aria-hidden="true"></span>${botones}</div>`;
}

/* Coloca (y desliza) la pastilla bajo la opción activa.
   - animar: false la planta sin transición (primer pintado).
   - desde: id de la opción anterior. Para vistas que re-renderizan su HTML al
     cambiar de segmento: la pastilla nace donde estaba y se desliza, en vez de
     aparecer de golpe en el destino. */
export function colocarThumb(root, { animar = true, desde = null, attr = 'data-seg' } = {}) {
  const seg = root && root.querySelector(SEL_SEG);
  if (!seg) return;
  const thumb = seg.querySelector(SEL_THUMB);
  const on = seg.querySelector(`${SEL_OPT}.is-on`);
  if (!thumb || !on) return;

  const mover = (el, conAnimacion) => {
    if (!conAnimacion) thumb.style.transition = 'none';
    thumb.style.width = `${el.offsetWidth}px`;
    thumb.style.transform = `translateX(${el.offsetLeft}px)`;
    if (!conAnimacion) { void thumb.offsetWidth; thumb.style.transition = ''; }
  };

  const previo = desde ? seg.querySelector(`[${attr}="${desde}"]`) : null;
  if (previo && previo !== on && previo.offsetWidth > 0) {
    mover(previo, false);
    requestAnimationFrame(() => mover(on, true));
    return;
  }
  mover(on, animar);
}

/* Sincroniza clases y aria cuando la vista conserva el DOM del control. */
export function marcarActiva(root, activo, attr = 'data-seg') {
  if (!root) return;
  root.querySelectorAll(`[${attr}]`).forEach((b) => {
    const on = b.getAttribute(attr) === activo;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-selected', String(on));
  });
}
