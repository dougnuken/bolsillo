/* ============================================================
   Bolsillo · views/cfg-cuentas.js
   CRUD de config.cuentas (Efectivo, Nequi, Bancolombia, Platino BDO…)
   + tipo por cuenta (débito/crédito) y cuenta por defecto al registrar.

   Al borrar una cuenta EN USO se advierte con el conteo real de
   movimientos: la cuenta desaparece de la lista pero los
   movimientos NUNCA se tocan (siguen mostrando su cuenta).
   ============================================================ */

import { getConfig, saveConfig, getAll } from '../db.js';
import { confirmar, menu } from '../overlay.js';
import { toast } from '../toast.js';
import { esc } from '../html.js';
import {
  hojaNav, cabecera, bindCabecera, vacioCfg, botonAgregar, IC,
} from './cfg-sheet.js';

const CHEV =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>';
const IC_CARD =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 14.5h4"/></svg>';
const IC_STAR =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3.5 2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 17.9 6.7 20.6l1-5.8-4.2-4.1 5.9-.9L12 3.5Z"/></svg>';

/**
 * Abre la hoja de cuentas.
 * @param {{onSaved?: () => void}} [opts]
 */
export async function abrirCuentas({ onSaved } = {}) {
  let cuentas = [];
  let movimientos = [];
  let meta = {};
  let ctaDefault = null;

  async function recargar() {
    const [cfg, movs] = await Promise.all([getConfig(), getAll('movimientos')]);
    cuentas = Array.isArray(cfg.cuentas) ? cfg.cuentas.slice() : [];
    meta = (cfg.cuentasMeta && typeof cfg.cuentasMeta === 'object') ? cfg.cuentasMeta : {};
    ctaDefault = cfg.cuentaDefault || null;
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
  const esCredito = (nombre) => !!(meta[nombre] && meta[nombre].tipo === 'credito');
  const avisar = () => { if (typeof onSaved === 'function') onSaved(); };

  return hojaNav((api) => {
    let agregando = false;

    function pantalla() {
      const filas = cuentas.length
        ? cuentas.map((c) => {
          const n = usos(c);
          const cred = esCredito(c);
          const def = c === ctaDefault;
          const usoTxt = n === 0 ? 'sin movimientos' : `${n} movimiento${n > 1 ? 's' : ''}`;
          const metaTxt = `${cred ? 'Crédito' : 'Débito'}${def ? ' · por defecto' : ''} · ${usoTxt}`;
          return `
            <button type="button" class="cfg-row cfg-row--tap" data-act="acciones" data-nombre="${esc(c)}">
              <span class="cfg-row__body">
                <span class="cfg-row__title">${esc(c)}${def ? ' <span class="cfg-tag">Default</span>' : ''}</span>
                <span class="cfg-row__meta">${metaTxt}</span>
              </span>
              <span class="cfg-row__chev" aria-hidden="true">${CHEV}</span>
            </button>`;
        }).join('')
        : vacioCfg('No tienes cuentas. Agrega al menos una para registrar gastos.');

      const alta = agregando
        ? `<div class="cfg-inline">
             <input type="text" class="field__input" id="cta-nueva" placeholder="Nombre de la cuenta" autocomplete="off" />
             <button type="button" class="btn btn--primary btn--sm" data-act="confirmar">Agregar</button>
           </div>`
        : botonAgregar('Agregar cuenta');

      const html = `
        ${cabecera('Cuentas', { sub: 'Dónde tienes tu plata: efectivo, billeteras y tarjetas.' })}
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

        panel.querySelectorAll('[data-act="acciones"]').forEach((b) => {
          b.addEventListener('click', () => acciones(b.dataset.nombre));
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

    /* Menú por cuenta: cambiar tipo, poner por defecto o eliminar. */
    async function acciones(nombre) {
      const cred = esCredito(nombre);
      const def = nombre === ctaDefault;
      const items = [
        { value: 'tipo', label: cred ? 'Marcar como débito' : 'Marcar como crédito', icon: IC_CARD },
      ];
      if (!def) items.push({ value: 'default', label: 'Poner por defecto', icon: IC_STAR });
      items.push({ value: 'borrar', label: 'Eliminar cuenta', danger: true, icon: IC.trash });

      const elegido = await menu({ title: nombre, items });
      if (!elegido) return;
      try {
        if (elegido === 'tipo') {
          await saveConfig({ cuentasMeta: { [nombre]: { tipo: cred ? 'debito' : 'credito' } } });
          await recargar(); avisar(); pantalla();
          toast(cred ? 'Ahora es débito' : 'Ahora es crédito');
        } else if (elegido === 'default') {
          await saveConfig({ cuentaDefault: nombre });
          await recargar(); avisar(); pantalla();
          toast('Cuenta por defecto actualizada');
        } else if (elegido === 'borrar') {
          await borrar(nombre);
        }
      } catch (err) {
        toast('No se pudo aplicar: ' + err.message, { icono: false });
      }
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
        // Si era la cuenta por defecto, se limpia para que caiga en la primera.
        const cambios = { cuentas: cuentas.filter((c) => c !== nombre) };
        if (nombre === ctaDefault) cambios.cuentaDefault = null;
        await saveConfig(cambios);
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
