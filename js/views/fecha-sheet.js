/* ============================================================
   Bolsillo · views/fecha-sheet.js
   Selector de fecha como HOJA INFERIOR (reusa overlay.hoja()).

   Por qué no un calendario: capturando un gasto, la fecha casi
   siempre es hoy, ayer o antier. Un mes entero de celdas de 30px
   obliga a apuntar con precisión para lo que en el 95% de los casos
   es un solo toque. Los tres atajos van primero y grandes; el
   calendario NATIVO de iOS queda de salida para el caso raro.

   Devuelve una promesa con el ISO elegido, o undefined si se cerró
   sin elegir (nunca inventa una fecha).
   ============================================================ */

import { hoja } from '../overlay.js';
import { esc } from '../html.js';
import { hoyISO, sumarDiasISO, fechaMedia, fechaLarga, fechaCorta, esISOValida } from '../fechas.js';

const IC = {
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
};

/** Los tres atajos, calculados desde el "hoy" que se inyecte. PURA. */
export function atajosFecha(hoy = hoyISO()) {
  return Object.freeze([
    Object.freeze({ iso: hoy, titulo: 'Hoy' }),
    Object.freeze({ iso: sumarDiasISO(hoy, -1), titulo: 'Ayer' }),
    Object.freeze({ iso: sumarDiasISO(hoy, -2), titulo: 'Antier' }),
  ]);
}

/**
 * Abre la hoja de fecha.
 * @param {{fecha?: string, hoy?: string, max?: string}} [opts]
 * @returns {Promise<string|undefined>} ISO elegido o undefined
 */
export function abrirFecha({ fecha, hoy = hoyISO(), max = hoyISO() } = {}) {
  const actual = esISOValida(fecha) ? String(fecha).slice(0, 10) : hoy;
  const atajos = atajosFecha(hoy);

  const filas = atajos.map((a) => `
    <button type="button" class="ov-item date-opt${a.iso === actual ? ' is-sel' : ''}" data-iso="${esc(a.iso)}">
      <span class="ov-item__label date-opt__title">${esc(a.titulo)}</span>
      <span class="date-opt__sub">${esc(fechaMedia(a.iso))}</span>
      <span class="date-opt__check">${IC.check}</span>
    </button>`).join('');

  // El <input type="date"> va transparente ENCIMA de la fila: al tocarla se
  // abre la rueda nativa de iOS sin que un botón intermedio se coma el gesto.
  const otra = `
    <label class="ov-item date-otra" for="ov-fecha-otra">
      <span class="ov-item__ic">${IC.cal}</span>
      <span class="ov-item__label">Elegir otra fecha</span>
      <span class="date-otra__val num">${esc(fechaCorta(actual))}</span>
      <input type="date" class="date-otra__input" id="ov-fecha-otra"
        value="${esc(actual)}" max="${esc(max)}" aria-label="Elegir otra fecha" />
    </label>`;

  const html = `
    <div class="ov-grip" aria-hidden="true"></div>
    <button type="button" class="icon-btn ov-close" data-ov="close" aria-label="Cerrar">${IC.close}</button>
    <h3 class="ov-title ov-title--menu">¿Cuándo fue?</h3>
    <div class="ov-list">${filas}</div>
    <div class="date-sep" aria-hidden="true"></div>
    ${otra}
    <p class="date-actual">${esc(fechaLarga(actual))}</p>`;

  return hoja(html, (panel, cerrar) => {
    panel.querySelector('[data-ov="close"]').addEventListener('click', () => cerrar(undefined));

    panel.querySelectorAll('[data-iso]').forEach((b) => {
      b.addEventListener('click', () => cerrar(b.dataset.iso));
    });

    const input = panel.querySelector('#ov-fecha-otra');
    input.addEventListener('change', () => {
      // Cancelar la rueda nativa deja el campo vacío: eso NO es una elección.
      if (esISOValida(input.value)) cerrar(input.value);
    });
  });
}
