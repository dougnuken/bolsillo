/* ============================================================
   Bolsillo · views/cfg-ingresos.js
   Fuentes de ingreso de NEGOCIO (cantidad y nombre libres):
   un negocio, otro negocio, el arriendo de un inmueble…

   Cada fuente puede tener:
    · nombre libre (obligatorio),
    · monto esperado (OPCIONAL, solo referencia: los negocios varían),
    · un crédito que cubre (OPCIONAL): sirve para ver de un vistazo si el
      negocio se paga solo o si el sueldo tapa el hueco.

   Lo que mueve el semáforo NO es el esperado sino lo RECIBIDO: cada ingreso
   se registra desde el botón + cuando entra la plata. El sueldo de empleado
   es aparte (es la base del semáforo) y vive en "Sueldo de empleado".
   ============================================================ */

import { getAll, put, del } from '../db.js';
import { crearIngreso, actualizar } from '../model.js';
import { parseCOP, formatCOP } from '../money.js';
import { confirmar } from '../overlay.js';
import { toast } from '../toast.js';
import { esc } from '../html.js';
import {
  hojaNav, cabecera, bindCabecera, filaCfg, vacioCfg, notaCfg,
  botonAgregar, leerMonto, leerDia,
} from './cfg-sheet.js';

const nombreDe = (ing) => (ing && ing.nombre && ing.nombre.trim() ? ing.nombre.trim() : 'Negocio');

/** Retrocompat: nombre legible de un crédito (producto o `tipo` viejo). */
function etiquetaCredito(c) {
  const producto = c && c.producto && c.producto.trim()
    ? c.producto.trim()
    : (c && c.tipo && c.tipo.trim() ? c.tipo.trim() : 'Crédito');
  const entidad = c && c.entidad ? c.entidad.trim() : '';
  return entidad ? `${entidad} · ${producto}` : producto;
}

/**
 * Abre la hoja de fuentes de ingreso de negocios.
 * @param {{onSaved?: () => void}} [opts]
 */
export async function abrirNegocios({ onSaved } = {}) {
  let negocios = [];
  let creditos = [];

  async function recargar() {
    const [ingresos, creds] = await Promise.all([getAll('ingresos'), getAll('creditos')]);
    negocios = ingresos.filter((i) => i && i.fuente !== 'empleo');
    creditos = creds || [];
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
        ? negocios.map((n) => {
          const cred = n.creditoId ? creditos.find((c) => c.id === n.creditoId) : null;
          const partes = [`Día ${n.diaDelMes}`];
          if (cred) partes.push(`cubre ${etiquetaCredito(cred)}`);
          return filaCfg({
            id: n.id,
            titulo: nombreDe(n),
            meta: partes.join(' · '),
            valor: n.montoEsperado != null ? formatCOP(n.montoEsperado) : 'Sin esperado',
            accion: 'editar',
          });
        }).join('')
        : vacioCfg('Aún no registras negocios. Agrega tus negocios, un arriendo u otros ingresos…');

      const html = `
        ${cabecera('Ingresos de negocios')}
        ${notaCfg('El sueldo es la base del semáforo; estos negocios <strong>varían</strong>. Lo que cuenta es lo que <strong>recibes</strong> (regístralo con el botón + cuando entre la plata). El monto esperado es solo referencia.')}
        <div class="cfg-list">${filas}</div>
        ${botonAgregar('Agregar negocio')}`;

      api.pintar(html, (panel) => {
        bindCabecera(panel, { cerrar: () => api.cerrar() });
        panel.querySelectorAll('[data-act="editar"]').forEach((b) => {
          b.addEventListener('click', () => {
            const ing = negocios.find((n) => n.id === b.dataset.id);
            if (ing) pantallaForm(ing);
          });
        });
        const add = panel.querySelector('[data-act="nuevo"]');
        if (add) add.addEventListener('click', () => pantallaForm(null));
      });
    }

    /* ---- formulario ---- */
    function pantallaForm(ing) {
      const esNuevo = !ing;
      const opcionesCredito = [
        `<option value="">Ninguno</option>`,
        ...creditos.map((c) => `<option value="${esc(c.id)}"${ing && ing.creditoId === c.id ? ' selected' : ''}>${esc(etiquetaCredito(c))}</option>`),
      ].join('');

      const html = `
        ${cabecera(esNuevo ? 'Nuevo negocio' : 'Editar negocio', { atras: true })}
        <form class="sueldo-form" id="neg-form" novalidate>
          <label class="field">
            <span class="field__label">Nombre del negocio</span>
            <input class="field__input" id="neg-nombre" type="text" autocomplete="off"
              placeholder="Ej. mi negocio" value="${esc(ing ? ing.nombre || '' : '')}" />
          </label>

          <label class="field">
            <span class="field__label">Crédito que cubre (opcional)</span>
            <select class="field__input field__select" id="neg-credito">${opcionesCredito}</select>
            <span class="sueldo-hint">${creditos.length ? 'Vincúlalo a un crédito para ver si el negocio lo cubre solo.' : 'Registra un crédito en Ajustes para poder vincularlo.'}</span>
          </label>

          <label class="field">
            <span class="field__label">Monto esperado (opcional)</span>
            <input class="field__input" id="neg-monto" type="text" data-monto inputmode="numeric" autocomplete="off"
              placeholder="1.500.000" value="${esc(ing && ing.montoEsperado != null ? formatCOP(ing.montoEsperado).replace('$', '') : '')}" />
            <span class="sueldo-hint">Solo referencia: varía mes a mes. Lo real es lo que registras que entró.</span>
          </label>

          <label class="field">
            <span class="field__label">Día que suele entrar</span>
            <input class="field__input" id="neg-dia" type="number" min="1" max="31" inputmode="numeric"
              placeholder="Ej. 15" value="${esc(ing ? ing.diaDelMes : '')}" />
          </label>

          <button type="submit" class="btn btn--primary btn--block btn--save">Guardar</button>
          ${esNuevo ? '' : '<button type="button" class="btn btn--danger btn--block cfg-danger" data-act="borrar">Eliminar este negocio</button>'}
        </form>`;

      api.pintar(html, (panel) => {
        bindCabecera(panel, { atras: pantallaLista, cerrar: () => api.cerrar() });

        panel.querySelector('#neg-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const nombre = panel.querySelector('#neg-nombre').value.trim();
          if (!nombre) { toast('Escribe un nombre'); panel.querySelector('#neg-nombre').focus(); return; }
          const dia = leerDia(panel, '#neg-dia');
          if (dia == null) { toast('El día debe estar entre 1 y 31'); panel.querySelector('#neg-dia').focus(); return; }
          // Monto esperado es OPCIONAL: vacío = null; escrito debe ser válido.
          const brutoMonto = panel.querySelector('#neg-monto').value.trim();
          let montoEsperado = null;
          if (brutoMonto !== '') {
            montoEsperado = leerMonto(panel, '#neg-monto', parseCOP);
            if (montoEsperado == null) { toast('Ese monto esperado no se entiende'); panel.querySelector('#neg-monto').focus(); return; }
          }
          const creditoId = panel.querySelector('#neg-credito').value || null;

          try {
            const guardado = ing
              ? actualizar(ing, { nombre, diaDelMes: dia, montoEsperado, creditoId })
              : crearIngreso({ fuente: 'negocio', nombre, diaDelMes: dia, montoEsperado, creditoId });
            await put('ingresos', guardado);
            await recargar();
            toast(esNuevo ? 'Negocio agregado' : 'Negocio actualizado');
            if (typeof onSaved === 'function') onSaved();
            pantallaLista();
          } catch (err) {
            toast('No se pudo guardar: ' + err.message, { icono: false, ms: 3200 });
          }
        });

        const borrar = panel.querySelector('[data-act="borrar"]');
        if (borrar) borrar.addEventListener('click', async () => {
          const ok = await confirmar({
            title: '¿Eliminar este negocio?',
            text: `${nombreDe(ing)}. No borra los ingresos ya registrados.`,
            okText: 'Eliminar', danger: true,
          });
          if (!ok) return;
          try {
            await del('ingresos', ing.id);
            await recargar();
            toast('Negocio eliminado');
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
