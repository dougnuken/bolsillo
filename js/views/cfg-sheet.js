/* ============================================================
   Bolsillo · views/cfg-sheet.js
   Andamiaje compartido de las sub-hojas de Ajustes.

   Regla: NUNCA apilar sheets (doble scrim). Una sola hoja de
   overlay.js que se REPINTA por dentro (lista ↔ formulario).
   ============================================================ */

import { hoja } from '../overlay.js';
import { esc } from '../html.js';

export const IC = {
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18 9 12l6-6"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7"/></svg>',
  bang: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v5"/><circle cx="12" cy="16.5" r="1" fill="currentColor" stroke="none"/></svg>',
};

/**
 * Abre una hoja con repintado interno.
 * @param {(api:{pintar:(html:string, bind?:(panel:HTMLElement)=>void)=>void,
 *               cerrar:(v?:any)=>void}) => void} inicio
 * @returns {Promise<any>} el valor con que se cerró la hoja
 */
export function hojaNav(inicio) {
  return hoja('', (panel, cerrar) => {
    const api = {
      cerrar,
      pintar(html, bind) {
        panel.innerHTML = html;
        panel.scrollTop = 0;
        if (typeof bind === 'function') bind(panel);
      },
    };
    inicio(api);
  });
}

/**
 * Cabecera estándar de sub-hoja. `sub` admite markup (va sin escapar):
 * escápalo en el llamante si viene de datos del usuario.
 */
export function cabecera(titulo, { sub = '', atras = false } = {}) {
  return `
    <div class="ov-grip" aria-hidden="true"></div>
    ${atras ? `<button type="button" class="icon-btn cfg-back" data-cfg="atras" aria-label="Volver">${IC.back}</button>` : ''}
    <button type="button" class="icon-btn ov-close" data-cfg="cerrar" aria-label="Cerrar">${IC.close}</button>
    <h3 class="ov-title cfg-title${atras ? ' cfg-title--back' : ''}">${esc(titulo)}</h3>
    ${sub ? `<p class="sueldo-hint cfg-sub">${sub}</p>` : ''}`;
}

/** Cablea los botones cerrar/atrás de la cabecera. */
export function bindCabecera(panel, { atras, cerrar } = {}) {
  const bCerrar = panel.querySelector('[data-cfg="cerrar"]');
  if (bCerrar && typeof cerrar === 'function') bCerrar.addEventListener('click', () => cerrar());
  const bAtras = panel.querySelector('[data-cfg="atras"]');
  if (bAtras && typeof atras === 'function') bAtras.addEventListener('click', () => atras());
}

/** Fila de lista pulsable dentro de una sub-hoja. */
export function filaCfg({ id, titulo, meta = '', valor = '', accion = 'abrir' }) {
  return `
    <button type="button" class="cfg-row" data-act="${esc(accion)}" data-id="${esc(id)}">
      <span class="cfg-row__body">
        <span class="cfg-row__title">${esc(titulo)}</span>
        ${meta ? `<span class="cfg-row__meta">${esc(meta)}</span>` : ''}
      </span>
      ${valor ? `<span class="cfg-row__val num">${esc(valor)}</span>` : ''}
      <span class="cfg-row__chev">${IC.chev}</span>
    </button>`;
}

/** Estado vacío compacto de una sub-hoja. */
export function vacioCfg(texto) {
  return `<p class="cfg-empty">${esc(texto)}</p>`;
}

/**
 * Nota de ayuda / advertencia. `tipo`: 'info' | 'warn' | 'ok' | 'err'.
 * Admite markup (no escapa): úsalo solo con texto propio.
 */
export function notaCfg(html, { tipo = 'info' } = {}) {
  const ic = tipo === 'ok' ? IC.check : (tipo === 'info' ? '' : IC.bang);
  return `<p class="cfg-note cfg-note--${esc(tipo)}">${ic ? `<span class="cfg-note__ic">${ic}</span>` : ''}<span>${html}</span></p>`;
}

/** Botón de "agregar" a ancho completo. */
export function botonAgregar(texto, accion = 'nuevo') {
  return `<button type="button" class="cfg-add" data-act="${esc(accion)}">${IC.plus}<span>${esc(texto)}</span></button>`;
}

/** Lee un input de monto y devuelve entero de pesos o null. */
export function leerMonto(panel, sel, parseCOP) {
  const el = panel.querySelector(sel);
  if (!el) return null;
  const v = parseCOP(el.value);
  return Number.isInteger(v) && v > 0 ? v : null;
}

/** Lee un día del mes (1..31) o null. */
export function leerDia(panel, sel) {
  const el = panel.querySelector(sel);
  if (!el) return null;
  const n = parseInt(el.value, 10);
  return Number.isInteger(n) && n >= 1 && n <= 31 ? n : null;
}

/** Prefijo 'YYYY-MM' del mes de `fecha` (para excepciones de recurrentes). */
export function mesActual(fecha = new Date()) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Nombre legible del mes ('julio de 2026') para textos de excepción. */
export function mesLegible(fecha = new Date()) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  return new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(d);
}
