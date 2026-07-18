/* ============================================================
   Bolsillo · views/cfg-cuentas.js
   CRUD de config.cuentas (Efectivo, Nequi, Bancolombia…).

   Al borrar una cuenta EN USO se advierte con el conteo real de
   movimientos: la cuenta desaparece de la lista pero los
   movimientos NUNCA se tocan (siguen mostrando su cuenta).
   ============================================================ */

import { getConfig, saveConfig, getAll } from '../db.js';
import { confirmar } from '../overlay.js';
import { toast } from '../toast.js';
import { esc } from '../html.js';
import {
  hojaNav, cabecera, bindCabecera, vacioCfg, botonAgregar, IC,
} from './cfg-sheet.js';

/**
 * Abre la hoja de cuentas.
 * @param {{onSaved?: () => void}} [opts]
 */
export async function abrirCuentas({ onSaved } = {}) {
  let cuentas = [];
  let movimientos = [];

  async function recargar() {
    const [cfg, movs] = await Promise.all([getConfig(), getAll('movimientos')]);
    cuentas = Array.isArray(cfg.cuentas) ? cfg.cuentas.slice() : [];
    movimientos = movs;
  }

  try {
    await recargar();
  } catch (err) {
    console.warn('[Bolsillo] no se pudieron leer las cuentas:', err);
    toast('No se pudieron cargar tus cuentas');
    return;
  }

  const usos = (nombre) => movimientos.filter((m) => m && m.cuenta === nombre).length;
  const avisar = () => { if (typeof onSaved === 'function') onSaved(); };

  return hojaNav((api) => {
    let agregando = false;

    function pantalla() {
      const filas = cuentas.length
        ? cuentas.map((c) => {
          const n = usos(c);
          return `
            <div class="cfg-row cfg-row--static">
              <span class="cfg-row__body">
                <span class="cfg-row__title">${esc(c)}</span>
                <span class="cfg-row__meta">${n === 0 ? 'Sin movimientos' : `${n} movimiento${n > 1 ? 's' : ''}`}</span>
              </span>
              <button type="button" class="icon-btn cfg-row__del" data-act="borrar" data-nombre="${esc(c)}"
                aria-label="Eliminar ${esc(c)}">${IC.trash}</button>
            </div>`;
        }).join('')
        : vacioCfg('No tienes cuentas. Agrega al menos una para registrar gastos.');

      const alta = agregando
        ? `<div class="cfg-inline">
             <input type="text" class="field__input" id="cta-nueva" placeholder="Nombre de la cuenta" autocomplete="off" />
             <button type="button" class="btn btn--primary btn--sm" data-act="confirmar">Agregar</button>
           </div>`
        : botonAgregar('Agregar cuenta');

      const html = `
        ${cabecera('Cuentas', { sub: 'Dónde tienes tu plata: efectivo, billeteras y bancos.' })}
        <div class="cfg-list">${filas}</div>
        ${alta}`;

      api.pintar(html, (panel) => {
        bindCabecera(panel, { cerrar: () => api.cerrar() });

        const add = panel.querySelector('[data-act="nuevo"]');
        if (add) add.addEventListener('click', () => { agregando = true; pantalla(); });

        const confirmarAlta = panel.querySelector('[data-act="confirmar"]');
        if (confirmarAlta) confirmarAlta.addEventListener('click', agregar);

        const input = panel.querySelector('#cta-nueva');
        if (input) {
          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); agregar(); }
          });
          requestAnimationFrame(() => input.focus());
        }

        panel.querySelectorAll('[data-act="borrar"]').forEach((b) => {
          b.addEventListener('click', () => borrar(b.dataset.nombre));
        });

        async function agregar() {
          const nombre = (panel.querySelector('#cta-nueva').value || '').trim();
          if (!nombre) { agregando = false; pantalla(); return; }
          if (cuentas.some((c) => c.toLowerCase() === nombre.toLowerCase())) {
            toast('Esa cuenta ya existe');
            return;
          }
          try {
            await saveConfig({ cuentas: [...cuentas, nombre] }); // arreglo nuevo, sin mutar
            await recargar();
            agregando = false;
            toast('Cuenta agregada');
            avisar();
            pantalla();
          } catch (err) {
            toast('No se pudo agregar: ' + err.message, { icono: false });
          }
        }
      });
    }

    async function borrar(nombre) {
      const n = usos(nombre);
      const ok = await confirmar({
        title: `¿Eliminar "${nombre}"?`,
        text: n > 0
          ? `Hay ${n} movimiento${n > 1 ? 's' : ''} registrado${n > 1 ? 's' : ''} con esta cuenta. No se borrarán: solo dejará de aparecer al registrar.`
          : 'Dejará de aparecer al registrar gastos.',
        okText: 'Eliminar', danger: true,
      });
      if (!ok) return;
      try {
        await saveConfig({ cuentas: cuentas.filter((c) => c !== nombre) });
        await recargar();
        toast('Cuenta eliminada');
        avisar();
        pantalla();
      } catch (err) {
        toast('No se pudo eliminar: ' + err.message, { icono: false });
      }
    }

    pantalla();
  });
}
