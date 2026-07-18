/* ============================================================
   Bolsillo · views/cfg-api.js
   Clave de Anthropic + elección de modelos.

   SEGURIDAD (reglas duras):
   - La clave se guarda SOLO en config.apiKey (este dispositivo).
   - En pantalla siempre va ENMASCARADA (prefijo + últimos 4).
   - NUNCA se escribe en console.log, ni en la URL, ni en el hash,
     ni en localStorage, ni en el respaldo (backup.js la excluye).
   - Los `catch` de aquí no vuelcan el error crudo a consola para no
     arrastrar la petición (y con ella la clave) a los logs.
   ============================================================ */

import { getConfig, saveConfig } from '../db.js';
import { verificarClave, enmascararClave } from '../anthropic.js';
import { confirmar } from '../overlay.js';
import { toast } from '../toast.js';
import { esc } from '../html.js';
import { hojaNav, cabecera, bindCabecera, notaCfg } from './cfg-sheet.js';

const USOS = [
  { campo: 'vision', label: 'Fotos de recibos', hint: 'Lee el monto y el comercio de una foto.' },
  { campo: 'extractos', label: 'Extractos en PDF', hint: 'Extrae los movimientos de un extracto bancario.' },
];

/**
 * Abre la hoja de la clave de Anthropic.
 * @param {{onSaved?: () => void}} [opts]
 */
export async function abrirApiKey({ onSaved } = {}) {
  let config = null;
  try {
    config = await getConfig();
  } catch (err) {
    console.warn('[Bolsillo] no se pudo leer la configuración de la API.');
    toast('No se pudo abrir la configuración');
    return;
  }

  const avisar = () => { if (typeof onSaved === 'function') onSaved(); };

  return hojaNav((api) => {
    // Modelos disponibles según la última verificación exitosa (en memoria,
    // no se persisten: se vuelven a pedir cuando hace falta).
    let modelosDisponibles = [];

    function selectorModelos() {
      if (!config.apiKey) return '';
      const opciones = (campo) => {
        const actual = (config.modelos && config.modelos[campo]) || '';
        if (!modelosDisponibles.length) {
          return `<option value="${esc(actual)}" selected>${esc(actual || 'Sin definir')}</option>`;
        }
        const hay = modelosDisponibles.some((m) => m.id === actual);
        return (hay ? '' : `<option value="${esc(actual)}" selected>${esc(actual)} (guardado)</option>`)
          + modelosDisponibles.map((m) => `
            <option value="${esc(m.id)}"${m.id === actual ? ' selected' : ''}>${esc(m.nombre)}</option>`).join('');
      };

      return `
        <div class="cfg-sep"></div>
        <p class="field__label field__label--section">Modelos</p>
        ${modelosDisponibles.length
    ? ''
    : notaCfg('Verifica la clave para traer la lista de modelos disponibles en tu cuenta.')}
        ${USOS.map((u) => `
          <label class="field">
            <span class="field__label">${esc(u.label)}</span>
            <select class="field__input field__select" id="mod-${esc(u.campo)}">${opciones(u.campo)}</select>
            <span class="sueldo-hint">${esc(u.hint)}</span>
          </label>`).join('')}
        <button type="button" class="btn btn--ghost btn--block cfg-cta" data-act="guardar-modelos">Guardar modelos</button>`;
    }

    function pantalla(estado) {
      const tieneClave = typeof config.apiKey === 'string' && config.apiKey.trim() !== '';

      const bloqueClave = tieneClave
        ? `<div class="cfg-key">
             <span class="cfg-key__label">Clave guardada</span>
             <span class="cfg-key__mask num">${esc(enmascararClave(config.apiKey))}</span>
           </div>
           <button type="button" class="btn btn--ghost btn--block cfg-cta" data-act="verificar">Verificar de nuevo</button>
           <button type="button" class="btn btn--danger btn--block cfg-cta" data-act="eliminar">Eliminar clave</button>`
        : `<label class="field">
             <span class="field__label">Clave de Anthropic</span>
             <input class="field__input" id="api-key" type="password" autocomplete="off" autocapitalize="none"
               autocorrect="off" spellcheck="false" placeholder="sk-ant-..." />
           </label>
           <button type="button" class="btn btn--primary btn--block cfg-cta" data-act="guardar">Verificar y guardar</button>`;

      const mensaje = estado
        ? notaCfg(esc(estado.mensaje), { tipo: estado.tipo })
        : '';

      const html = `
        ${cabecera('Clave de Anthropic', { sub: 'Necesaria para leer recibos por foto y extractos en PDF.' })}
        ${notaCfg('Tu clave vive <strong>solo en este dispositivo</strong>. Nunca sale en los respaldos ni se envía a ningún otro servidor: se usa directo contra la API de Anthropic.')}
        ${bloqueClave}
        ${mensaje}
        ${selectorModelos()}`;

      api.pintar(html, (panel) => {
        bindCabecera(panel, { cerrar: () => api.cerrar() });

        const guardar = panel.querySelector('[data-act="guardar"]');
        if (guardar) guardar.addEventListener('click', () => verificarYGuardar(panel, guardar));

        const verificar = panel.querySelector('[data-act="verificar"]');
        if (verificar) verificar.addEventListener('click', () => reverificar(verificar));

        const eliminar = panel.querySelector('[data-act="eliminar"]');
        if (eliminar) eliminar.addEventListener('click', borrarClave);

        const guardarModelos = panel.querySelector('[data-act="guardar-modelos"]');
        if (guardarModelos) guardarModelos.addEventListener('click', async () => {
          const modelos = {};
          for (const u of USOS) {
            const sel = panel.querySelector('#mod-' + u.campo);
            if (sel && sel.value) modelos[u.campo] = sel.value;
          }
          try {
            config = await saveConfig({ modelos });
            toast('Modelos guardados');
            avisar();
          } catch {
            toast('No se pudieron guardar los modelos', { icono: false });
          }
        });

        const input = panel.querySelector('#api-key');
        if (input) {
          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); verificarYGuardar(panel, guardar); }
          });
          requestAnimationFrame(() => input.focus());
        }
      });
    }

    /* ---- acciones ---- */
    async function verificarYGuardar(panel, boton) {
      const input = panel.querySelector('#api-key');
      const clave = input ? input.value.trim() : '';
      if (clave === '') { toast('Pega tu clave primero'); if (input) input.focus(); return; }

      boton.disabled = true;
      boton.textContent = 'Verificando…';

      const r = await verificarClave(clave);

      if (r.estado !== 'ok') {
        boton.disabled = false;
        boton.textContent = 'Verificar y guardar';
        // La clave NO se guarda si no verificó.
        pintarConError(r);
        return;
      }

      try {
        modelosDisponibles = r.modelos || [];
        config = await saveConfig({ apiKey: clave });
        toast('Clave verificada y guardada');
        avisar();
        pantalla({ mensaje: 'Clave verificada. Ya puedes elegir los modelos.', tipo: 'ok' });
      } catch {
        boton.disabled = false;
        boton.textContent = 'Verificar y guardar';
        toast('No se pudo guardar la clave', { icono: false });
      }
    }

    /* Repinta conservando el mensaje de error (sin volver a mostrar la clave). */
    function pintarConError(r) {
      const tipo = r.estado === 'invalida' ? 'err' : 'warn';
      pantalla({ mensaje: r.mensaje, tipo });
    }

    async function reverificar(boton) {
      boton.disabled = true;
      boton.textContent = 'Verificando…';
      const r = await verificarClave(config.apiKey);
      if (r.estado === 'ok') {
        modelosDisponibles = r.modelos || [];
        pantalla({ mensaje: 'Clave verificada. Modelos actualizados.', tipo: 'ok' });
      } else {
        pintarConError(r);
      }
    }

    async function borrarClave() {
      const ok = await confirmar({
        title: '¿Eliminar la clave?',
        text: 'Bolsillo dejará de poder leer fotos de recibos y extractos hasta que pegues otra.',
        okText: 'Eliminar', danger: true,
      });
      if (!ok) return;
      try {
        modelosDisponibles = [];
        config = await saveConfig({ apiKey: null });
        toast('Clave eliminada');
        avisar();
        pantalla();
      } catch {
        toast('No se pudo eliminar la clave', { icono: false });
      }
    }

    pantalla();
  });
}
