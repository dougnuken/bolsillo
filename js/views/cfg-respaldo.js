/* ============================================================
   Bolsillo · views/cfg-respaldo.js
   Exportar / importar el respaldo + borrar todos los datos.

   El respaldo NUNCA incluye la clave de Anthropic: `serializar` la
   excluye al exportar e `importar` la filtra al entrar, así que un
   archivo ajeno no puede sustituir la clave de este dispositivo.
   ============================================================ */

import * as db from '../db.js';
import { exportar, importar } from '../backup.js';
import { confirmar } from '../overlay.js';
import { toast } from '../toast.js';
import { esc } from '../html.js';
import { aplicarPersonalizacion } from '../categories.js';
import { hojaNav, cabecera, bindCabecera, notaCfg } from './cfg-sheet.js';

const DIAS_AVISO = 7;
const MS_DIA = 24 * 60 * 60 * 1000;

/** Días transcurridos desde el último respaldo, o null si nunca. PURA. */
export function diasDesde(fechaISO, ahora = new Date()) {
  if (typeof fechaISO !== 'string' || fechaISO.trim() === '') return null;
  const t = Date.parse(fechaISO);
  if (!Number.isFinite(t)) return null;
  return Math.floor((ahora.getTime() - t) / MS_DIA);
}

/** ¿Toca recordarle al usuario que respalde? PURA. */
export function respaldoVencido(fechaISO, ahora = new Date()) {
  const d = diasDesde(fechaISO, ahora);
  return d == null || d > DIAS_AVISO;
}

function textoUltimo(fechaISO) {
  const d = diasDesde(fechaISO);
  if (d == null) return 'Nunca has hecho un respaldo.';
  if (d === 0) return 'Último respaldo: hoy.';
  if (d === 1) return 'Último respaldo: ayer.';
  return `Último respaldo: hace ${d} días.`;
}

/**
 * Abre la hoja de respaldo.
 * @param {{onSaved?: () => void}} [opts]
 */
export async function abrirRespaldo({ onSaved } = {}) {
  let config = null;
  try {
    config = await db.getConfig();
  } catch (err) {
    console.warn('[Bolsillo] no se pudo leer la config de respaldo:', err);
    toast('No se pudo abrir el respaldo');
    return;
  }

  const avisar = () => { if (typeof onSaved === 'function') onSaved(); };

  return hojaNav((api) => {
    function pantalla(resumen) {
      const vencido = respaldoVencido(config.fechaUltimoBackup);
      const aviso = vencido
        ? notaCfg(`${esc(textoUltimo(config.fechaUltimoBackup))} Te recomendamos exportar al menos una vez por semana.`, { tipo: 'warn' })
        : notaCfg(esc(textoUltimo(config.fechaUltimoBackup)), { tipo: 'ok' });

      const resumenHTML = resumen
        ? notaCfg(`Importado: <strong class="num">${resumen.movimientos}</strong> movimientos, <strong class="num">${resumen.recurrentes}</strong> gastos fijos, <strong class="num">${resumen.creditos}</strong> créditos, <strong class="num">${resumen.ingresos}</strong> ingresos${resumen.config ? ' y tu configuración' : ''}.`, { tipo: 'ok' })
        : '';

      const html = `
        ${cabecera('Respaldo', { sub: 'Un archivo JSON con todo lo tuyo, para guardarlo donde quieras.' })}
        ${aviso}
        ${resumenHTML}
        <button type="button" class="btn btn--primary btn--block cfg-cta" data-act="exportar">Exportar mis datos</button>
        <button type="button" class="btn btn--ghost btn--block cfg-cta" data-act="importar">Importar un respaldo</button>
        <input type="file" id="resp-file" class="cfg-file" accept="application/json,.json" />
        ${notaCfg('El respaldo <strong>no incluye</strong> tu clave de Anthropic: esa vive solo en este dispositivo.')}
        <div class="cfg-sep"></div>
        <button type="button" class="btn btn--danger btn--block cfg-cta" data-act="borrar-todo">Borrar todos mis datos</button>`;

      api.pintar(html, (panel) => {
        bindCabecera(panel, { cerrar: () => api.cerrar() });

        panel.querySelector('[data-act="exportar"]').addEventListener('click', async () => {
          try {
            const { entrega, nombre } = await exportar(db);
            config = await db.getConfig(); // trae la fechaUltimoBackup nueva
            if (entrega.via === 'cancelado') toast('Exportación cancelada');
            else toast(`Respaldo listo: ${nombre}`);
            avisar();
            pantalla();
          } catch (err) {
            toast('No se pudo exportar: ' + err.message, { icono: false, ms: 3600 });
          }
        });

        const file = panel.querySelector('#resp-file');
        panel.querySelector('[data-act="importar"]').addEventListener('click', () => file.click());

        // La confirmación va DESPUÉS de elegir el archivo: así el click que
        // abre el selector sigue siendo un gesto directo del usuario (Safari
        // bloquea file.click() si se dispara tras esperar un diálogo).
        file.addEventListener('change', async () => {
          const f = file.files && file.files[0];
          if (!f) return;
          try {
            const ok = await confirmar({
              title: '¿Importar este respaldo?',
              text: 'Se suman movimientos, gastos fijos, créditos e ingresos. Tus cuentas, '
                + 'categorías y presupuestos se fusionan: nada de lo que ya tienes se borra. '
                + 'Tu clave de Anthropic no se toca.',
              okText: 'Importar',
            });
            if (!ok) return;

            const texto = await f.text();
            const { importados } = await importar(db, texto);
            config = await db.getConfig();
            // El catálogo activo es un cache de módulo: sin esto, las
            // categorías propias restauradas se verían como "Otros" hasta
            // recargar la app y parecería que la importación falló.
            aplicarPersonalizacion(config);
            toast('Respaldo importado');
            avisar();
            pantalla(importados);
          } catch (err) {
            toast('No se pudo importar: ' + err.message, { icono: false, ms: 4000 });
          } finally {
            file.value = ''; // permite reimportar el mismo archivo
          }
        });

        panel.querySelector('[data-act="borrar-todo"]').addEventListener('click', borrarTodo);
      });
    }

    /* ---- borrado con confirmación de DOS pasos ---- */
    async function borrarTodo() {
      const paso1 = await confirmar({
        title: '¿Borrar todos tus datos?',
        text: 'Se eliminan movimientos, gastos fijos, créditos, ingresos y ajustes de este dispositivo. No se puede deshacer.',
        okText: 'Continuar', danger: true,
      });
      if (!paso1) return;

      const html = `
        ${cabecera('Confirmar borrado', { atras: true })}
        ${notaCfg('Esto es definitivo. Si aún no has exportado un respaldo, vuelve atrás y hazlo primero.', { tipo: 'err' })}
        <label class="field">
          <span class="field__label">Escribe BORRAR para confirmar</span>
          <input class="field__input" id="del-confirm" type="text" autocomplete="off"
            autocapitalize="characters" placeholder="BORRAR" />
        </label>
        <button type="button" class="btn btn--danger btn--block cfg-cta" data-act="definitivo" disabled>Borrar todo definitivamente</button>`;

      api.pintar(html, (panel) => {
        bindCabecera(panel, { atras: () => pantalla(), cerrar: () => api.cerrar() });

        const input = panel.querySelector('#del-confirm');
        const boton = panel.querySelector('[data-act="definitivo"]');
        input.addEventListener('input', () => {
          boton.disabled = input.value.trim().toUpperCase() !== 'BORRAR';
        });

        boton.addEventListener('click', async () => {
          if (input.value.trim().toUpperCase() !== 'BORRAR') return;
          try {
            await db.borrarTodo();
            toast('Todos tus datos fueron borrados');
            api.cerrar(true);
            avisar();
          } catch (err) {
            toast('No se pudo borrar: ' + err.message, { icono: false, ms: 3600 });
          }
        });

        requestAnimationFrame(() => input.focus());
      });
    }

    pantalla();
  });
}
