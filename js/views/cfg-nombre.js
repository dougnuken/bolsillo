/* ============================================================
   olbo · views/cfg-nombre.js
   Poner o cambiar tu nombre. Es lo que aparece en el saludo de Hoy
   ("Hola, X 👋") y lo que alimenta las iniciales del avatar de Perfil.

   Existe porque el nombre solo se capturaba en el PASO 1 del onboarding:
   quien lo saltó tenía que rehacer los cinco pasos (nombre → sueldo →
   cuentas → fijos → listo) solo para escribir una palabra, y quien ya lo
   tenía puesto no tenía forma de corregirlo — el encabezado de Perfil
   dejaba de ser pulsable en cuanto había nombre.
   ============================================================ */

import { getConfig, saveConfig } from '../db.js';
import { toast } from '../toast.js';
import { esc } from '../html.js';
import { hojaNav, cabecera, bindCabecera } from './cfg-sheet.js';

/** Mismo tope que el input del onboarding, para que no se contradigan. */
export const NOMBRE_MAX = 40;

/**
 * Normaliza lo que se escribe: colapsa espacios repetidos, recorta las puntas
 * y aplica el tope. PURA (testeable en Node).
 * @param {unknown} valor
 * @returns {string}
 */
export function normalizarNombre(valor) {
  return String(valor == null ? '' : valor)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NOMBRE_MAX);
}

/**
 * Abre la hoja del nombre.
 * @param {{onSaved?: () => void}} [opts]
 */
export async function abrirNombre({ onSaved } = {}) {
  let config = null;
  try {
    config = await getConfig();
  } catch (err) {
    console.warn('[olbo] no se pudo leer el nombre:', err);
    toast('No se pudo abrir la configuración');
    return;
  }

  const actual = normalizarNombre(config && config.nombre);

  return hojaNav((api) => {
    const html = `
      ${cabecera('Tu nombre', { sub: 'Es lo primero que ves al abrir la app.' })}

      <label class="field">
        <span class="field__label">Nombre</span>
        <input class="field__input" id="cfg-nombre" type="text" autocomplete="given-name"
          autocapitalize="words" spellcheck="false" maxlength="${NOMBRE_MAX}"
          placeholder="Escribe tu nombre" value="${esc(actual)}" />
        <span class="sueldo-hint">Aparece en el saludo de Hoy y en las iniciales de tu avatar. Se queda en este dispositivo. Si lo dejas vacío, la app simplemente saluda sin nombrarte.</span>
      </label>

      <button type="button" class="btn btn--primary btn--block btn--save" data-act="guardar">Guardar</button>`;

    api.pintar(html, (panel) => {
      bindCabecera(panel, { cerrar: () => api.cerrar() });

      const input = panel.querySelector('#cfg-nombre');

      const guardar = async () => {
        const nombre = normalizarNombre(input.value);
        // Vacío es una opción legítima: borra el nombre y el saludo vuelve a
        // "Hola 👋". No es un error, así que no se bloquea.
        try {
          await saveConfig({ nombre });
          toast(nombre ? `Listo, ${nombre}` : 'Nombre borrado');
          if (typeof onSaved === 'function') onSaved();
          api.cerrar(true);
        } catch (err) {
          toast('No se pudo guardar: ' + err.message, { icono: false });
        }
      };

      panel.querySelector('[data-act="guardar"]').addEventListener('click', guardar);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); guardar(); }
      });
      input.focus();
      // El cursor al final, no seleccionando todo: se entra a corregir, no a
      // reemplazar de cero.
      input.setSelectionRange(input.value.length, input.value.length);
    });
  });
}
