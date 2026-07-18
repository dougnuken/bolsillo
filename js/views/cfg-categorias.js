/* ============================================================
   Bolsillo · views/cfg-categorias.js
   Renombrar categorías canónicas y crear categorías propias.

   REGLA DURA: los ids NUNCA cambian (los movimientos guardan
   `categoriaId`). Renombrar solo escribe config.categoriasRenombradas;
   las propias viven en config.categoriasPersonalizadas.
   El catálogo efectivo lo arma categories.js (construirCatalogo).
   ============================================================ */

import { getConfig, saveConfig, getAll } from '../db.js';
import {
  CATEGORIAS, catalogo, aplicarPersonalizacion, idPersonalizada,
} from '../categories.js';
import { confirmar } from '../overlay.js';
import { toast } from '../toast.js';
import { esc } from '../html.js';
import {
  hojaNav, cabecera, bindCabecera, notaCfg, botonAgregar, IC,
} from './cfg-sheet.js';

const ID_CANONICOS = new Set(CATEGORIAS.map((c) => c.id));

/**
 * Abre la hoja de categorías.
 * @param {{onSaved?: () => void}} [opts]
 */
export async function abrirCategorias({ onSaved } = {}) {
  let config = null;
  let movimientos = [];

  async function recargar() {
    const [cfg, movs] = await Promise.all([getConfig(), getAll('movimientos')]);
    config = cfg;
    movimientos = movs;
    aplicarPersonalizacion(cfg); // el catálogo activo refleja lo guardado
  }

  try {
    await recargar();
  } catch (err) {
    console.warn('[Bolsillo] no se pudieron leer las categorías:', err);
    toast('No se pudieron cargar las categorías');
    return;
  }

  const usos = (id) => movimientos.filter((m) => m && m.categoria === id).length;
  const avisar = () => { if (typeof onSaved === 'function') onSaved(); };

  return hojaNav((api) => {
    let agregando = false;

    /* ---- lista ---- */
    function pantallaLista() {
      const filas = catalogo().map((c) => {
        const n = usos(c.id);
        const renombrada = !c.propia && config.categoriasRenombradas && config.categoriasRenombradas[c.id];
        const metas = [];
        if (c.propia) metas.push('Propia');
        else if (renombrada) metas.push('Renombrada');
        metas.push(n === 0 ? 'sin uso' : `${n} movimiento${n > 1 ? 's' : ''}`);
        return `
          <button type="button" class="cfg-row" data-act="editar" data-id="${esc(c.id)}">
            <span class="cfg-row__ic ${esc(c.cls)}">${c.icon}</span>
            <span class="cfg-row__body">
              <span class="cfg-row__title">${esc(c.label)}</span>
              <span class="cfg-row__meta">${esc(metas.join(' · '))}</span>
            </span>
            <span class="cfg-row__chev">${IC.chev}</span>
          </button>`;
      }).join('');

      const alta = agregando
        ? `<div class="cfg-inline">
             <input type="text" class="field__input" id="cat-nueva" placeholder="Nombre de la categoría" autocomplete="off" />
             <button type="button" class="btn btn--primary btn--sm" data-act="confirmar">Crear</button>
           </div>`
        : botonAgregar('Crear categoría propia');

      const html = `
        ${cabecera('Categorías')}
        ${notaCfg('Puedes renombrar las que trae Bolsillo o crear las tuyas. Al renombrar, tus movimientos anteriores conservan su historia.')}
        <div class="cfg-list">${filas}</div>
        ${alta}`;

      api.pintar(html, (panel) => {
        bindCabecera(panel, { cerrar: () => api.cerrar() });

        panel.querySelectorAll('[data-act="editar"]').forEach((b) => {
          b.addEventListener('click', () => {
            const cat = catalogo().find((c) => c.id === b.dataset.id);
            if (cat) pantallaEditar(cat);
          });
        });

        const add = panel.querySelector('[data-act="nuevo"]');
        if (add) add.addEventListener('click', () => { agregando = true; pantallaLista(); });

        const conf = panel.querySelector('[data-act="confirmar"]');
        if (conf) conf.addEventListener('click', crear);

        const input = panel.querySelector('#cat-nueva');
        if (input) {
          input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); crear(); } });
          requestAnimationFrame(() => input.focus());
        }

        async function crear() {
          const nombre = (panel.querySelector('#cat-nueva').value || '').trim();
          if (!nombre) { agregando = false; pantallaLista(); return; }
          if (catalogo().some((c) => c.label.toLowerCase() === nombre.toLowerCase())) {
            toast('Ya existe una categoría con ese nombre');
            return;
          }
          const propias = Array.isArray(config.categoriasPersonalizadas) ? config.categoriasPersonalizadas : [];
          const id = idPersonalizada(nombre, catalogo().map((c) => c.id));
          try {
            await saveConfig({ categoriasPersonalizadas: [...propias, { id, label: nombre }] });
            await recargar();
            agregando = false;
            toast('Categoría creada');
            avisar();
            pantallaLista();
          } catch (err) {
            toast('No se pudo crear: ' + err.message, { icono: false });
          }
        }
      });
    }

    /* ---- editar (renombrar / eliminar si es propia) ---- */
    function pantallaEditar(cat) {
      const esCanonica = ID_CANONICOS.has(cat.id);
      const original = esCanonica ? CATEGORIAS.find((c) => c.id === cat.id).label : null;
      const n = usos(cat.id);

      const html = `
        ${cabecera('Editar categoría', { atras: true })}
        <form class="sueldo-form" id="cat-form" novalidate>
          <label class="field">
            <span class="field__label">Nombre</span>
            <input class="field__input" id="cat-label" type="text" autocomplete="off" value="${esc(cat.label)}" />
            <span class="sueldo-hint">${esCanonica
    ? `Nombre original: ${esc(original)}. El identificador interno no cambia, así que tus ${n} movimiento${n === 1 ? '' : 's'} siguen intactos.`
    : 'Categoría propia. Puedes renombrarla o eliminarla.'}</span>
          </label>
          <button type="submit" class="btn btn--primary btn--block btn--save">Guardar nombre</button>
          ${esCanonica && cat.label !== original
    ? '<button type="button" class="btn btn--ghost btn--block cfg-danger" data-act="restaurar">Restaurar nombre original</button>'
    : ''}
          ${!esCanonica
    ? '<button type="button" class="btn btn--danger btn--block cfg-danger" data-act="borrar">Eliminar categoría</button>'
    : ''}
        </form>`;

      api.pintar(html, (panel) => {
        bindCabecera(panel, { atras: pantallaLista, cerrar: () => api.cerrar() });

        panel.querySelector('#cat-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const nombre = panel.querySelector('#cat-label').value.trim();
          if (!nombre) { toast('El nombre no puede quedar vacío'); return; }
          if (catalogo().some((c) => c.id !== cat.id && c.label.toLowerCase() === nombre.toLowerCase())) {
            toast('Ya existe una categoría con ese nombre');
            return;
          }
          try {
            if (esCanonica) {
              const renombradas = { ...(config.categoriasRenombradas || {}) };
              if (nombre === original) delete renombradas[cat.id];
              else renombradas[cat.id] = nombre;
              await saveConfig({ categoriasRenombradas: renombradas });
            } else {
              const propias = (config.categoriasPersonalizadas || [])
                .map((p) => (p.id === cat.id ? { ...p, label: nombre } : p));
              await saveConfig({ categoriasPersonalizadas: propias });
            }
            await recargar();
            toast('Categoría actualizada');
            avisar();
            pantallaLista();
          } catch (err) {
            toast('No se pudo guardar: ' + err.message, { icono: false });
          }
        });

        const restaurar = panel.querySelector('[data-act="restaurar"]');
        if (restaurar) restaurar.addEventListener('click', async () => {
          try {
            const renombradas = { ...(config.categoriasRenombradas || {}) };
            delete renombradas[cat.id];
            await saveConfig({ categoriasRenombradas: renombradas });
            await recargar();
            toast('Nombre restaurado');
            avisar();
            pantallaLista();
          } catch (err) {
            toast('No se pudo restaurar: ' + err.message, { icono: false });
          }
        });

        const borrar = panel.querySelector('[data-act="borrar"]');
        if (borrar) borrar.addEventListener('click', async () => {
          const ok = await confirmar({
            title: `¿Eliminar "${cat.label}"?`,
            text: n > 0
              ? `Hay ${n} movimiento${n > 1 ? 's' : ''} con esta categoría. No se borrarán, pero pasarán a mostrarse como "Otros".`
              : 'Dejará de aparecer al registrar gastos.',
            okText: 'Eliminar', danger: true,
          });
          if (!ok) return;
          try {
            const propias = (config.categoriasPersonalizadas || []).filter((p) => p.id !== cat.id);
            await saveConfig({ categoriasPersonalizadas: propias });
            await recargar();
            toast('Categoría eliminada');
            avisar();
            pantallaLista();
          } catch (err) {
            toast('No se pudo eliminar: ' + err.message, { icono: false });
          }
        });

        requestAnimationFrame(() => panel.querySelector('#cat-label').focus());
      });
    }

    pantallaLista();
  });
}
