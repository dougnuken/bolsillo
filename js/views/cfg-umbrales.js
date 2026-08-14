/* ============================================================
   Bolsillo · views/cfg-umbrales.js
   Umbral de gasto hormiga + sensibilidad del semáforo.
   Los dos con su explicación en cristiano: son los dos números
   que cambian cómo se siente la app.
   ============================================================ */

import { getConfig, saveConfig } from '../db.js';
import { parseCOP, formatCOP } from '../money.js';
import { UMBRAL_HORMIGA_DEFAULT } from '../model.js';
import { UMBRAL_AMARILLO_DEFAULT } from '../budget.js';
import { toast } from '../toast.js';
import { esc } from '../html.js';
import { hojaNav, cabecera, bindCabecera, notaCfg } from './cfg-sheet.js';

/**
 * Abre la hoja de umbrales.
 * @param {{onSaved?: () => void}} [opts]
 */
export async function abrirUmbrales({ onSaved } = {}) {
  let config = null;
  try {
    config = await getConfig();
  } catch (err) {
    console.warn('[Bolsillo] no se pudieron leer los umbrales:', err);
    toast('No se pudo abrir la configuración');
    return;
  }

  const hormiga = Number.isInteger(config.umbralHormiga) ? config.umbralHormiga : UMBRAL_HORMIGA_DEFAULT;
  const amarillo = (config.umbralesSemaforo && config.umbralesSemaforo.amarillo) || UMBRAL_AMARILLO_DEFAULT;

  return hojaNav((api) => {
    const html = `
      ${cabecera('Umbrales', { sub: 'Los dos números que definen cómo te avisa Bolsillo.' })}

      <label class="field">
        <span class="field__label">Gasto hormiga</span>
        <input class="field__input" id="umb-hormiga" type="text" data-monto inputmode="numeric" autocomplete="off"
          placeholder="20.000" value="${esc(formatCOP(hormiga).replace('$', ''))}" />
        <span class="sueldo-hint">Todo gasto variable por debajo de este monto se marca como “hormiga”. Son los pequeños que no duelen uno a uno, pero sumados sí. Por defecto ${esc(formatCOP(UMBRAL_HORMIGA_DEFAULT))}.</span>
      </label>

      <label class="field">
        <span class="field__label">Sensibilidad de alerta</span>
        <input class="field__input" id="umb-amarillo" type="number" min="1.05" max="2" step="0.05"
          inputmode="decimal" placeholder="1.25" value="${esc(amarillo)}" />
        <span class="sueldo-hint">Qué tan rápido pasa de ámbar a rojo comparando tu ritmo de gasto con el día del mes. Más bajo = más estricto. Por defecto ${esc(UMBRAL_AMARILLO_DEFAULT)}.</span>
      </label>

      ${notaCfg('El semáforo no mira cuánto llevas gastado en bruto, sino tu <strong>ritmo</strong>: gastar el 90% el día 28 va bien; el 80% el día 10 es alerta.')}

      <button type="button" class="btn btn--primary btn--block btn--save" data-act="guardar">Guardar umbrales</button>`;

    api.pintar(html, (panel) => {
      bindCabecera(panel, { cerrar: () => api.cerrar() });

      panel.querySelector('[data-act="guardar"]').addEventListener('click', async () => {
        const nuevoHormiga = parseCOP(panel.querySelector('#umb-hormiga').value);
        if (!Number.isInteger(nuevoHormiga) || nuevoHormiga < 0) {
          toast('Escribe un umbral de hormiga válido');
          panel.querySelector('#umb-hormiga').focus();
          return;
        }
        const nuevoAmarillo = parseFloat(panel.querySelector('#umb-amarillo').value);
        if (!Number.isFinite(nuevoAmarillo) || nuevoAmarillo <= 1) {
          toast('La sensibilidad debe ser mayor a 1');
          panel.querySelector('#umb-amarillo').focus();
          return;
        }
        try {
          await saveConfig({
            umbralHormiga: nuevoHormiga,
            umbralesSemaforo: { amarillo: nuevoAmarillo },
          });
          toast('Umbrales guardados');
          if (typeof onSaved === 'function') onSaved();
          api.cerrar(true);
        } catch (err) {
          toast('No se pudo guardar: ' + err.message, { icono: false });
        }
      });
    });
  });
}
