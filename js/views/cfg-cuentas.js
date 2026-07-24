/* ============================================================
   Bolsillo · views/cfg-cuentas.js
   CRUD de config.cuentas + ficha por cuenta: tipo (débito/crédito),
   cuenta por defecto y, para tarjetas de crédito, el ciclo
   (día de corte, día límite de pago, tasa %) con un resumen del ciclo.

   Al borrar una cuenta EN USO se advierte con el conteo real de
   movimientos: la cuenta desaparece de la lista pero los
   movimientos NUNCA se tocan (siguen mostrando su cuenta).
   ============================================================ */

import { getConfig, saveConfig, getAll } from '../db.js';
import { confirmar } from '../overlay.js';
import { toast } from '../toast.js';
import { esc } from '../html.js';
import { formatCOP } from '../money.js';
import { resumenTarjeta } from '../budget.js';
import {
  hojaNav, cabecera, bindCabecera, vacioCfg, botonAgregar, leerDia, IC,
} from './cfg-sheet.js';

const CHEV =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>';

/** Formatea 'YYYY-MM-DD' como '5 ago'. */
function fmtFecha(iso) {
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' }).format(new Date(iso + 'T00:00:00'));
}

/** Tarjeta-resumen del ciclo (solo si hay día de corte). */
function resumenCicloHTML(r) {
  if (!r) return '';
  const pago = r.pagoISO
    ? `Se paga el ${fmtFecha(r.pagoISO)}${r.diasParaPago != null ? ` · en ${r.diasParaPago} día${r.diasParaPago !== 1 ? 's' : ''}` : ''}`
    : 'Agrega el día límite de pago';
  const cuotas = r.cuotasActivas > 0
    ? `<p class="tj-res__cuotas">${r.cuotasActivas} compra${r.cuotasActivas > 1 ? 's' : ''} a cuotas · ${esc(formatCOP(r.cuotasMensual))}/mes</p>`
    : '';
  return `
    <div class="tj-res">
      <p class="tj-res__lbl">Este ciclo llevas</p>
      <p class="tj-res__monto num">${esc(formatCOP(r.acumulado))}</p>
      <p class="tj-res__meta">Corta el ${fmtFecha(r.corteISO)} · en ${r.diasParaCorte} día${r.diasParaCorte !== 1 ? 's' : ''}<br/>${pago}</p>
      ${cuotas}
    </div>`;
}

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
  const metaDe = (nombre) => (meta[nombre] && typeof meta[nombre] === 'object' ? meta[nombre] : {});
  const avisar = () => { if (typeof onSaved === 'function') onSaved(); };

  return hojaNav((api) => {
    let agregando = false;

    /* ---- lista de cuentas ---- */
    function pantalla() {
      const filas = cuentas.length
        ? cuentas.map((c) => {
          const n = usos(c);
          const cred = esCredito(c);
          const def = c === ctaDefault;
          const usoTxt = n === 0 ? 'sin movimientos' : `${n} movimiento${n > 1 ? 's' : ''}`;
          const metaTxt = `${cred ? 'Crédito' : 'Débito'}${def ? ' · por defecto' : ''} · ${usoTxt}`;
          return `
            <button type="button" class="cfg-row cfg-row--tap" data-act="detalle" data-nombre="${esc(c)}">
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

        panel.querySelectorAll('[data-act="detalle"]').forEach((b) => {
          b.addEventListener('click', () => detalle(b.dataset.nombre));
        });

        async function agregar() {
          const nombre = (panel.querySelector('#cta-nueva').value || '').trim();
          if (!nombre) { agregando = false; pantalla(); return; }
          if (cuentas.some((c) => c.toLowerCase() === nombre.toLowerCase())) {
            toast('Esa cuenta ya existe');
            return;
          }
          try {
            await saveConfig({ cuentas: [...cuentas, nombre] });
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

    /* ---- ficha de una cuenta (tipo, default, ciclo de tarjeta) ---- */
    function detalle(nombre) {
      const cred = esCredito(nombre);
      const def = nombre === ctaDefault;
      const m = metaDe(nombre);
      const corte = Number.isInteger(m.corte) ? m.corte : '';
      const limite = Number.isInteger(m.limite) ? m.limite : '';
      const tasa = (m.tasa != null && m.tasa !== '') ? m.tasa : '';

      let resumen = '';
      if (cred && Number.isInteger(m.corte)) {
        resumen = resumenCicloHTML(resumenTarjeta({
          movimientos, cuenta: nombre, corteDia: m.corte,
          limiteDia: Number.isInteger(m.limite) ? m.limite : undefined, hoy: new Date(),
        }));
      }

      const ciclo = cred ? `
        <p class="cfg-subhead">Ciclo de la tarjeta</p>
        <div class="cfg-form">
          <div class="field field--split cfg-field">
            <label class="field__col">
              <span class="field__label">Día de corte</span>
              <input class="field__input" id="tj-corte" type="number" min="1" max="31" inputmode="numeric" placeholder="Ej. 5" value="${esc(corte)}" />
            </label>
            <label class="field__col">
              <span class="field__label">Día límite de pago</span>
              <input class="field__input" id="tj-limite" type="number" min="1" max="31" inputmode="numeric" placeholder="Ej. 25" value="${esc(limite)}" />
            </label>
          </div>
          <label class="field cfg-field">
            <span class="field__label">Tasa mensual (%)</span>
            <input class="field__input" id="tj-tasa" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Ej. 2.1" value="${esc(tasa)}" />
          </label>
        </div>
        <button type="button" class="btn btn--primary btn--block cfg-cta" data-act="guardar-ciclo">Guardar ciclo</button>
        ${resumen}` : '';

      const html = `
        ${cabecera(nombre, { sub: 'Ficha de la cuenta', atras: true })}
        <div class="cfg-list">
          <div class="cfg-row cfg-row--static">
            <span class="cfg-row__body">
              <span class="cfg-row__title">Tarjeta de crédito</span>
              <span class="cfg-row__meta">${cred ? 'Pregunta cuotas y tiene ciclo de pago' : 'Débito / efectivo: sale al instante'}</span>
            </span>
            <span class="switch${cred ? ' is-on' : ''}" role="switch" aria-checked="${cred}" tabindex="0" data-act="toggle-tipo"><span class="switch__dot"></span></span>
          </div>
          <div class="cfg-row cfg-row--static">
            <span class="cfg-row__body">
              <span class="cfg-row__title">Cuenta por defecto</span>
              <span class="cfg-row__meta">${def ? 'Se elige sola al registrar' : 'Actívala para que salga por defecto'}</span>
            </span>
            <span class="switch${def ? ' is-on' : ''}" role="switch" aria-checked="${def}" tabindex="0" data-act="toggle-default"><span class="switch__dot"></span></span>
          </div>
        </div>
        ${ciclo}
        <button type="button" class="btn btn--danger btn--block cfg-danger" data-act="borrar">Eliminar cuenta</button>`;

      api.pintar(html, (panel) => {
        bindCabecera(panel, { atras: () => pantalla(), cerrar: () => api.cerrar() });

        const guardarMeta = async (parcial) => {
          await saveConfig({ cuentasMeta: { [nombre]: { ...metaDe(nombre), ...parcial } } });
          await recargar();
          avisar();
          detalle(nombre);
        };

        panel.querySelector('[data-act="toggle-tipo"]')?.addEventListener('click', () => {
          guardarMeta({ tipo: cred ? 'debito' : 'credito' });
        });

        panel.querySelector('[data-act="toggle-default"]')?.addEventListener('click', async () => {
          await saveConfig({ cuentaDefault: def ? null : nombre });
          await recargar();
          avisar();
          detalle(nombre);
        });

        panel.querySelector('[data-act="guardar-ciclo"]')?.addEventListener('click', async () => {
          const corteV = leerDia(panel, '#tj-corte');
          const limiteV = leerDia(panel, '#tj-limite');
          const tasaEl = panel.querySelector('#tj-tasa');
          const tasaV = tasaEl && tasaEl.value.trim() !== '' ? Number(tasaEl.value) : null;
          const nuevo = { ...metaDe(nombre), tipo: 'credito' };
          if (corteV != null) nuevo.corte = corteV; else delete nuevo.corte;
          if (limiteV != null) nuevo.limite = limiteV; else delete nuevo.limite;
          if (tasaV != null && Number.isFinite(tasaV) && tasaV >= 0) nuevo.tasa = tasaV; else delete nuevo.tasa;
          try {
            await saveConfig({ cuentasMeta: { [nombre]: nuevo } });
            await recargar();
            avisar();
            toast('Ciclo guardado');
            detalle(nombre);
          } catch (err) {
            toast('No se pudo guardar: ' + err.message, { icono: false });
          }
        });

        panel.querySelector('[data-act="borrar"]')?.addEventListener('click', () => borrar(nombre));
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
