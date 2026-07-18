/* ============================================================
   Bolsillo · views/cfg-creditos.js
   CRUD de créditos (solo los DATOS). La vista de estrategias de
   pago (avalancha / bola de nieve) es T8.

   La tasa se captura como EA (%) y se muestra la MV derivada con
   tasaEAaMV() en vivo, que es como la cobra el banco cada mes.
   ============================================================ */

import { getAll, put, del } from '../db.js';
import { crearCredito, actualizar, tasaEAaMV } from '../model.js';
import { parseCOP, formatCOP } from '../money.js';
import { confirmar } from '../overlay.js';
import { toast } from '../toast.js';
import { esc } from '../html.js';
import {
  hojaNav, cabecera, bindCabecera, filaCfg, vacioCfg,
  botonAgregar, leerDia,
} from './cfg-sheet.js';

const TIPOS = ['Tarjeta de crédito', 'Libre inversión', 'Vehículo', 'Hipotecario', 'Libranza', 'Otro'];

/** Formatea una tasa a 2 decimales con coma (es-CO). PURA. */
function fmtTasa(n) {
  return Number.isFinite(n) ? n.toFixed(2).replace('.', ',') : '0,00';
}

/**
 * Abre la hoja de créditos.
 * @param {{onSaved?: () => void}} [opts]
 */
export async function abrirCreditos({ onSaved } = {}) {
  let creditos = [];

  async function recargar() {
    creditos = await getAll('creditos');
  }

  try {
    await recargar();
  } catch (err) {
    console.warn('[Bolsillo] no se pudieron leer los créditos:', err);
    toast('No se pudieron cargar tus créditos');
    return;
  }

  const avisar = () => { if (typeof onSaved === 'function') onSaved(); };

  return hojaNav((api) => {
    /* ---- lista ---- */
    function pantallaLista() {
      const filas = creditos.length
        ? creditos.map((c) => filaCfg({
          id: c.id,
          titulo: c.entidad,
          meta: `${c.tipo || 'Crédito'} · cuota ${formatCOP(c.cuotaMensual)} · día ${c.diaPago}`,
          valor: formatCOP(c.saldo),
          accion: 'editar',
        })).join('')
        : vacioCfg('Aún no registras créditos.');

      const totalSaldo = creditos.reduce((s, c) => s + (c.saldo || 0), 0);
      const totalCuota = creditos.reduce((s, c) => s + (c.cuotaMensual || 0), 0);

      const html = `
        ${cabecera('Créditos', {
    sub: creditos.length
      ? `Saldo total <strong class="num">${esc(formatCOP(totalSaldo))}</strong> · cuotas <strong class="num">${esc(formatCOP(totalCuota))}</strong>/mes`
      : 'Registra tus deudas para verlas en un solo lugar.',
  })}
        <div class="cfg-list">${filas}</div>
        ${botonAgregar('Agregar crédito')}`;

      api.pintar(html, (panel) => {
        bindCabecera(panel, { cerrar: () => api.cerrar() });
        panel.querySelectorAll('[data-act="editar"]').forEach((b) => {
          b.addEventListener('click', () => {
            const c = creditos.find((x) => x.id === b.dataset.id);
            if (c) pantallaForm(c);
          });
        });
        panel.querySelector('[data-act="nuevo"]').addEventListener('click', () => pantallaForm(null));
      });
    }

    /* ---- formulario ---- */
    function pantallaForm(cre) {
      const esNuevo = !cre;
      const tipos = TIPOS.map((t) => `
        <option value="${esc(t)}"${cre && cre.tipo === t ? ' selected' : ''}>${esc(t)}</option>`).join('');
      const eaInicial = cre ? cre.tasaEA : 0;

      const html = `
        ${cabecera(esNuevo ? 'Nuevo crédito' : 'Editar crédito', { atras: true })}
        <form class="sueldo-form" id="cre-form" novalidate>
          <label class="field">
            <span class="field__label">Entidad</span>
            <input class="field__input" id="cre-entidad" type="text" autocomplete="off"
              placeholder="Bancolombia" value="${esc(cre ? cre.entidad : '')}" />
          </label>
          <label class="field">
            <span class="field__label">Tipo</span>
            <select class="field__input field__select" id="cre-tipo">${tipos}</select>
          </label>
          <div class="field field--split">
            <label class="field__col">
              <span class="field__label">Saldo actual</span>
              <input class="field__input" id="cre-saldo" type="text" inputmode="numeric" autocomplete="off"
                placeholder="8.000.000" value="${esc(cre ? formatCOP(cre.saldo).replace('$', '') : '')}" />
            </label>
            <label class="field__col">
              <span class="field__label">Cuota mensual</span>
              <input class="field__input" id="cre-cuota" type="text" inputmode="numeric" autocomplete="off"
                placeholder="450.000" value="${esc(cre ? formatCOP(cre.cuotaMensual).replace('$', '') : '')}" />
            </label>
          </div>
          <div class="field field--split">
            <label class="field__col">
              <span class="field__label">Tasa E.A. (%)</span>
              <input class="field__input" id="cre-tasa" type="number" min="0" max="100" step="0.01"
                inputmode="decimal" placeholder="26.5" value="${esc(cre ? cre.tasaEA : '')}" />
            </label>
            <label class="field__col">
              <span class="field__label">Día de pago</span>
              <input class="field__input" id="cre-dia" type="number" min="1" max="31" inputmode="numeric"
                placeholder="15" value="${esc(cre ? cre.diaPago : '')}" />
            </label>
          </div>
          <p class="cfg-tasa">Mensual vencida equivalente: <strong class="num" id="cre-mv">${esc(fmtTasa(tasaEAaMV(eaInicial)))}%</strong></p>

          <button type="submit" class="btn btn--primary btn--block btn--save">Guardar</button>
          ${esNuevo ? '' : '<button type="button" class="btn btn--danger btn--block cfg-danger" data-act="borrar">Eliminar crédito</button>'}
        </form>`;

      api.pintar(html, (panel) => {
        bindCabecera(panel, { atras: pantallaLista, cerrar: () => api.cerrar() });

        // MV derivada en vivo mientras se escribe la EA
        const inputTasa = panel.querySelector('#cre-tasa');
        const salidaMV = panel.querySelector('#cre-mv');
        inputTasa.addEventListener('input', () => {
          const ea = parseFloat(inputTasa.value);
          salidaMV.textContent = fmtTasa(tasaEAaMV(Number.isFinite(ea) ? ea : 0)) + '%';
        });

        panel.querySelector('#cre-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const entidad = panel.querySelector('#cre-entidad').value.trim();
          if (!entidad) { toast('Escribe la entidad'); panel.querySelector('#cre-entidad').focus(); return; }

          const saldo = parseCOP(panel.querySelector('#cre-saldo').value);
          if (!Number.isInteger(saldo) || saldo < 0) { toast('Escribe un saldo válido'); panel.querySelector('#cre-saldo').focus(); return; }

          const cuota = parseCOP(panel.querySelector('#cre-cuota').value);
          if (!Number.isInteger(cuota) || cuota < 0) { toast('Escribe una cuota válida'); panel.querySelector('#cre-cuota').focus(); return; }

          const dia = leerDia(panel, '#cre-dia');
          if (dia == null) { toast('El día de pago debe estar entre 1 y 31'); panel.querySelector('#cre-dia').focus(); return; }

          const ea = parseFloat(inputTasa.value);
          if (!Number.isFinite(ea) || ea < 0) { toast('Escribe una tasa E.A. válida'); inputTasa.focus(); return; }

          const campos = {
            entidad,
            tipo: panel.querySelector('#cre-tipo').value,
            saldo,
            cuotaMensual: cuota,
            tasaEA: ea,
            tasaMV: tasaEAaMV(ea),
            diaPago: dia,
          };

          try {
            const guardado = esNuevo ? crearCredito(campos) : actualizar(cre, campos);
            await put('creditos', guardado);
            await recargar();
            toast(esNuevo ? 'Crédito agregado' : 'Crédito actualizado');
            avisar();
            pantallaLista();
          } catch (err) {
            toast('No se pudo guardar: ' + err.message, { icono: false, ms: 3200 });
          }
        });

        const borrar = panel.querySelector('[data-act="borrar"]');
        if (borrar) borrar.addEventListener('click', async () => {
          const ok = await confirmar({
            title: '¿Eliminar este crédito?',
            text: `${cre.entidad} · saldo ${formatCOP(cre.saldo)}.`,
            okText: 'Eliminar', danger: true,
          });
          if (!ok) return;
          try {
            await del('creditos', cre.id);
            await recargar();
            toast('Crédito eliminado');
            avisar();
            pantallaLista();
          } catch (err) {
            toast('No se pudo eliminar: ' + err.message, { icono: false });
          }
        });

        requestAnimationFrame(() => panel.querySelector('#cre-entidad').focus());
      });
    }

    pantallaLista();
  });
}
