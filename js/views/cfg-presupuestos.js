/* ============================================================
   Bolsillo · views/cfg-presupuestos.js
   Presupuesto mensual OPCIONAL por categoría → config.presupuestos.
   budget.js ya los usa para colorear el desglose de "En qué se va".
   ============================================================ */

import { getConfig, saveConfig } from '../db.js';
import { catalogo } from '../categories.js';
import { parseCOP, formatCOP } from '../money.js';
import { toast } from '../toast.js';
import { esc } from '../html.js';
import { hojaNav, cabecera, bindCabecera, notaCfg } from './cfg-sheet.js';

/**
 * Abre la hoja de presupuestos por categoría.
 * @param {{onSaved?: () => void}} [opts]
 */
export async function abrirPresupuestos({ onSaved } = {}) {
  let config = null;
  try {
    config = await getConfig();
  } catch (err) {
    console.warn('[Bolsillo] no se pudieron leer los presupuestos:', err);
    toast('No se pudieron cargar los presupuestos');
    return;
  }

  const actuales = config.presupuestos || {};

  return hojaNav((api) => {
    const filas = catalogo().map((c) => {
      const v = actuales[c.id];
      return `
        <label class="cfg-presu">
          <span class="cfg-presu__ic ${esc(c.cls)}">${c.icon}</span>
          <span class="cfg-presu__label">${esc(c.label)}</span>
          <input class="field__input cfg-presu__input" type="text" inputmode="numeric" autocomplete="off"
            data-cat="${esc(c.id)}" placeholder="Sin tope"
            value="${esc(Number.isInteger(v) && v > 0 ? formatCOP(v).replace('$', '') : '')}" />
        </label>`;
    }).join('');

    const html = `
      ${cabecera('Presupuestos por categoría')}
      ${notaCfg('Opcional. Si le pones tope a una categoría, Bolsillo te avisa cuando te acercas. Déjalo vacío para no ponerle límite.')}
      <div class="cfg-presu-list">${filas}</div>
      <button type="button" class="btn btn--primary btn--block btn--save" data-act="guardar">Guardar presupuestos</button>`;

    api.pintar(html, (panel) => {
      bindCabecera(panel, { cerrar: () => api.cerrar() });

      panel.querySelector('[data-act="guardar"]').addEventListener('click', async () => {
        // Mapa NUEVO: solo entran los topes válidos (>0); el resto se omite.
        const presupuestos = {};
        let invalido = null;
        panel.querySelectorAll('[data-cat]').forEach((input) => {
          const bruto = (input.value || '').trim();
          if (bruto === '') return;
          const monto = parseCOP(bruto);
          if (!Number.isInteger(monto) || monto <= 0) { invalido = invalido || input; return; }
          presupuestos[input.dataset.cat] = monto;
        });

        if (invalido) {
          toast('Revisa el monto marcado: no se entiende');
          invalido.focus();
          return;
        }

        try {
          await saveConfig({ presupuestos });
          toast('Presupuestos guardados');
          if (typeof onSaved === 'function') onSaved();
          api.cerrar(true);
        } catch (err) {
          toast('No se pudo guardar: ' + err.message, { icono: false });
        }
      });
    });
  });
}
