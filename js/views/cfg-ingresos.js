/* ============================================================
   Bolsillo · views/cfg-ingresos.js
   Ingresos de NEGOCIOS (negocio1 / negocio2).

   REGLA DE NEGOCIO: estos ingresos NO entran a la base del semáforo.
   La base es SOLO el sueldo de empleado (ver budget.js). Aquí se
   declara explícitamente en la UI para que no haya sorpresas.
   ============================================================ */

import { getAll, put, del } from '../db.js';
import { crearIngreso, actualizar, FUENTES_INGRESO } from '../model.js';
import { parseCOP, formatCOP } from '../money.js';
import { confirmar } from '../overlay.js';
import { toast } from '../toast.js';
import { esc } from '../html.js';
import {
  hojaNav, cabecera, bindCabecera, filaCfg, vacioCfg, notaCfg,
  botonAgregar, leerMonto, leerDia,
} from './cfg-sheet.js';

const SLOTS = FUENTES_INGRESO.filter((f) => f !== 'empleo'); // ['negocio1','negocio2']
const ETIQUETA_SLOT = { negocio1: 'Negocio 1', negocio2: 'Negocio 2' };

const nombreDe = (ing) => (ing && ing.nombre ? ing.nombre : ETIQUETA_SLOT[ing.fuente] || 'Negocio');

/**
 * Abre la hoja de ingresos de negocios.
 * @param {{onSaved?: () => void}} [opts]
 */
export async function abrirNegocios({ onSaved } = {}) {
  let negocios = [];

  async function recargar() {
    const todos = await getAll('ingresos');
    negocios = todos.filter((i) => i && i.fuente !== 'empleo');
  }

  try {
    await recargar();
  } catch (err) {
    console.warn('[Bolsillo] no se pudieron leer los ingresos:', err);
    toast('No se pudieron cargar tus ingresos');
    return;
  }

  return hojaNav((api) => {
    /* ---- lista ---- */
    function pantallaLista() {
      const filas = negocios.length
        ? negocios.map((n) => filaCfg({
          id: n.id,
          titulo: nombreDe(n),
          meta: `Día ${n.diaDelMes} de cada mes`,
          valor: formatCOP(n.monto),
          accion: 'editar',
        })).join('')
        : vacioCfg('Aún no registras ingresos de negocios.');

      const libres = SLOTS.filter((s) => !negocios.some((n) => n.fuente === s));

      const html = `
        ${cabecera('Ingresos de negocios')}
        ${notaCfg('Estos ingresos <strong>no</strong> entran a la base del semáforo: el semáforo se calcula solo sobre tu sueldo de empleado. Aquí quedan registrados para tu control.')}
        <div class="cfg-list">${filas}</div>
        ${libres.length ? botonAgregar('Agregar ingreso de negocio') : notaCfg('Ya tienes los dos negocios configurados.', { tipo: 'info' })}`;

      api.pintar(html, (panel) => {
        bindCabecera(panel, { cerrar: () => api.cerrar() });
        panel.querySelectorAll('[data-act="editar"]').forEach((b) => {
          b.addEventListener('click', () => {
            const ing = negocios.find((n) => n.id === b.dataset.id);
            if (ing) pantallaForm(ing);
          });
        });
        const add = panel.querySelector('[data-act="nuevo"]');
        if (add) add.addEventListener('click', () => pantallaForm(null, libres[0]));
      });
    }

    /* ---- formulario ---- */
    function pantallaForm(ing, slotSugerido) {
      const esNuevo = !ing;
      const slot = ing ? ing.fuente : slotSugerido;

      const html = `
        ${cabecera(esNuevo ? 'Nuevo ingreso de negocio' : 'Editar ingreso', { atras: true })}
        <form class="sueldo-form" id="neg-form" novalidate>
          <label class="field">
            <span class="field__label">Nombre del negocio</span>
            <input class="field__input" id="neg-nombre" type="text" autocomplete="off"
              placeholder="${esc(ETIQUETA_SLOT[slot] || 'Negocio')}" value="${esc(ing ? ing.nombre || '' : '')}" />
          </label>
          <label class="field">
            <span class="field__label">Ingreso mensual</span>
            <input class="field__input" id="neg-monto" type="text" inputmode="numeric" autocomplete="off"
              placeholder="1.500.000" value="${esc(ing ? formatCOP(ing.monto).replace('$', '') : '')}" />
          </label>
          <label class="field">
            <span class="field__label">Día que suele entrar</span>
            <input class="field__input" id="neg-dia" type="number" min="1" max="31" inputmode="numeric"
              placeholder="Ej. 15" value="${esc(ing ? ing.diaDelMes : '')}" />
          </label>
          <button type="submit" class="btn btn--primary btn--block btn--save">Guardar</button>
          ${esNuevo ? '' : '<button type="button" class="btn btn--danger btn--block cfg-danger" data-act="borrar">Eliminar este ingreso</button>'}
        </form>`;

      api.pintar(html, (panel) => {
        bindCabecera(panel, { atras: pantallaLista, cerrar: () => api.cerrar() });

        panel.querySelector('#neg-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const monto = leerMonto(panel, '#neg-monto', parseCOP);
          if (monto == null) { toast('Escribe un monto válido'); panel.querySelector('#neg-monto').focus(); return; }
          const dia = leerDia(panel, '#neg-dia');
          if (dia == null) { toast('El día debe estar entre 1 y 31'); panel.querySelector('#neg-dia').focus(); return; }
          const nombre = panel.querySelector('#neg-nombre').value.trim();

          try {
            const datos = { fuente: slot, monto, diaDelMes: dia, nombre, id: ing ? ing.id : undefined };
            const guardado = ing
              ? actualizar(ing, { monto, diaDelMes: dia, nombre })
              : crearIngreso(datos);
            await put('ingresos', guardado);
            await recargar();
            toast(esNuevo ? 'Ingreso agregado' : 'Ingreso actualizado');
            if (typeof onSaved === 'function') onSaved();
            pantallaLista();
          } catch (err) {
            toast('No se pudo guardar: ' + err.message, { icono: false, ms: 3200 });
          }
        });

        const borrar = panel.querySelector('[data-act="borrar"]');
        if (borrar) borrar.addEventListener('click', async () => {
          const ok = await confirmar({
            title: '¿Eliminar este ingreso?',
            text: `${nombreDe(ing)} · ${formatCOP(ing.monto)}.`,
            okText: 'Eliminar', danger: true,
          });
          if (!ok) return;
          try {
            await del('ingresos', ing.id);
            await recargar();
            toast('Ingreso eliminado');
            if (typeof onSaved === 'function') onSaved();
            pantallaLista();
          } catch (err) {
            toast('No se pudo eliminar: ' + err.message, { icono: false });
          }
        });

        requestAnimationFrame(() => panel.querySelector('#neg-nombre').focus());
      });
    }

    pantallaLista();
  });
}
