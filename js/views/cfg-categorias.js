/* ============================================================
   Bolsillo · views/cfg-categorias.js
   Gestión de categorías centrada en las que el usuario define:
   crear, renombrar, elegir ícono y color, reordenar, ocultar y
   eliminar. Todo ADITIVO sobre config; los ids NUNCA cambian, así
   los movimientos ya registrados siguen resolviendo.

   Config tocada:
    · categoriasRenombradas  {id: 'Nombre'}      (defaults)
    · categoriasPersonalizadas [{id, label}]     (propias)
    · categoriasEstilo       {id: {icono, tint}} (ícono/color)
    · categoriasOcultas      [id]                (fuera del registro)
    · categoriasOrden        [id]                (orden del catálogo)
   ============================================================ */

import { getConfig, saveConfig, getAll } from '../db.js';
import {
  CATEGORIAS, catalogo, aplicarPersonalizacion, idPersonalizada,
  ICONOS_PICKER, TINTS_PICKER, iconoDe,
} from '../categories.js';
import { confirmar } from '../overlay.js';
import { toast } from '../toast.js';
import { esc } from '../html.js';
import {
  hojaNav, cabecera, bindCabecera, notaCfg, botonAgregar, IC,
} from './cfg-sheet.js';

const DEF_POR_ID = new Map(CATEGORIAS.map((c) => [c.id, c]));
const IDS_DEFAULT = new Set(CATEGORIAS.map((c) => c.id));

/* Íconos locales de la lista (subir/bajar/ojo). */
const ICL = {
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 15 6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4l16 16"/><path d="M9.9 5.2A9.5 9.5 0 0 1 12 5c6.4 0 10 7 10 7a16 16 0 0 1-3 3.6"/><path d="M6.5 7.6A15.6 15.6 0 0 0 2 12s3.6 7 10 7a9.3 9.3 0 0 0 4.2-1"/></svg>',
};

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
  const estiloActual = () => ({ ...(config.categoriasEstilo || {}) });

  /* Mueve un id una posición dentro del orden efectivo y persiste. */
  async function reordenar(id, dir) {
    const orden = catalogo().map((c) => c.id);
    const i = orden.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= orden.length) return;
    const nuevo = orden.slice();
    [nuevo[i], nuevo[j]] = [nuevo[j], nuevo[i]];
    try {
      await saveConfig({ categoriasOrden: nuevo });
      await recargar();
      avisar();
    } catch (err) {
      toast('No se pudo reordenar: ' + err.message, { icono: false });
    }
  }

  return hojaNav((api) => {
    let agregando = false;

    /* ---- lista ---- */
    function pantallaLista() {
      const cats = catalogo();
      const filas = cats.map((c, idx) => {
        const n = usos(c.id);
        const renombrada = !c.propia && config.categoriasRenombradas && config.categoriasRenombradas[c.id];
        const metas = [];
        if (c.propia) metas.push('Propia');
        else if (renombrada) metas.push('Renombrada');
        if (c.oculta) metas.push('Oculta');
        metas.push(n === 0 ? 'sin uso' : `${n} movimiento${n > 1 ? 's' : ''}`);
        const arriba = idx === 0 ? ' is-disabled' : '';
        const abajo = idx === cats.length - 1 ? ' is-disabled' : '';
        return `
          <div class="cat-item${c.oculta ? ' is-oculta' : ''}">
            <button type="button" class="cfg-row cat-item__row" data-act="editar" data-id="${esc(c.id)}">
              <span class="cfg-row__ic ${esc(c.cls)}">${c.icon}</span>
              <span class="cfg-row__body">
                <span class="cfg-row__title">${esc(c.label)}</span>
                <span class="cfg-row__meta">${esc(metas.join(' · '))}</span>
              </span>
              <span class="cfg-row__chev">${IC.chev}</span>
            </button>
            <span class="cat-item__ord">
              <button type="button" class="cat-ord-btn${arriba}" data-act="subir" data-id="${esc(c.id)}" aria-label="Subir ${esc(c.label)}"${idx === 0 ? ' disabled' : ''}>${ICL.up}</button>
              <button type="button" class="cat-ord-btn${abajo}" data-act="bajar" data-id="${esc(c.id)}" aria-label="Bajar ${esc(c.label)}"${idx === cats.length - 1 ? ' disabled' : ''}>${ICL.down}</button>
            </span>
          </div>`;
      }).join('');

      const alta = agregando
        ? `<div class="cfg-inline">
             <input type="text" class="field__input" id="cat-nueva" placeholder="Nombre de la categoría" autocomplete="off" />
             <button type="button" class="btn btn--primary btn--sm" data-act="confirmar">Crear</button>
           </div>`
        : botonAgregar('Crear categoría propia');

      const html = `
        ${cabecera('Categorías')}
        ${notaCfg('Renombra las que trae Bolsillo o crea las tuyas (personas, propósitos…). Cambia su ícono y color, reordénalas u ocúltalas. Al renombrar, tus movimientos anteriores conservan su historia.')}
        <div class="cfg-list cat-list">${filas}</div>
        ${alta}`;

      api.pintar(html, (panel) => {
        bindCabecera(panel, { cerrar: () => api.cerrar() });

        panel.querySelectorAll('[data-act="editar"]').forEach((b) => {
          b.addEventListener('click', () => {
            const cat = catalogo().find((c) => c.id === b.dataset.id);
            if (cat) pantallaEditar(cat);
          });
        });
        panel.querySelectorAll('[data-act="subir"]').forEach((b) => {
          b.addEventListener('click', () => reordenar(b.dataset.id, -1).then(pantallaLista));
        });
        panel.querySelectorAll('[data-act="bajar"]').forEach((b) => {
          b.addEventListener('click', () => reordenar(b.dataset.id, 1).then(pantallaLista));
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
            // Las nuevas nacen como categoría-persona (lo más común para Doug);
            // el ícono y color se afinan al tocarla.
            await saveConfig({
              categoriasPersonalizadas: [...propias, { id, label: nombre }],
              categoriasEstilo: { ...estiloActual(), [id]: { icono: 'persona', tint: 'persona1' } },
            });
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

    /* ---- editar (nombre + ícono + color + ocultar/eliminar) ---- */
    function pantallaEditar(cat) {
      const esDefault = IDS_DEFAULT.has(cat.id);
      const def = DEF_POR_ID.get(cat.id);
      const original = esDefault ? def.label : null;
      const n = usos(cat.id);
      // estado local del editor (no persiste hasta Guardar). `nombre` se
      // conserva entre repintados al elegir ícono/color, para no perderlo.
      const sel = { icono: cat.icono, tint: cat.tint };
      let nombre = cat.label;

      function render() {
        const iconos = ICONOS_PICKER.map((ic) => `
          <button type="button" class="cat-ico-opt${ic.key === sel.icono ? ' is-sel' : ''}" data-ico="${esc(ic.key)}"
            role="option" aria-selected="${ic.key === sel.icono}" aria-label="Ícono ${esc(ic.key)}">${ic.svg}</button>`).join('');
        const tints = TINTS_PICKER.map((t) => `
          <button type="button" class="cat-tint-opt cat--${esc(t)}${t === sel.tint ? ' is-sel' : ''}" data-tint="${esc(t)}"
            role="option" aria-selected="${t === sel.tint}" aria-label="Color ${esc(t)}"><span class="cat-tint-opt__dot"></span></button>`).join('');

        const oculta = (config.categoriasOcultas || []).includes(cat.id);
        const cambiada = esDefault && (nombre !== original || sel.icono !== def.icono || sel.tint !== def.tint);

        const html = `
          ${cabecera('Editar categoría', { atras: true })}
          <form class="sueldo-form" id="cat-form" novalidate>
            <label class="field">
              <span class="field__label">Nombre</span>
              <input class="field__input" id="cat-label" type="text" autocomplete="off" value="${esc(nombre)}" />
              <span class="sueldo-hint">${esDefault
    ? `El identificador interno no cambia, así que tus ${n} movimiento${n === 1 ? '' : 's'} siguen intactos.`
    : 'Categoría propia. Puedes renombrarla, cambiar su estilo o eliminarla.'}</span>
            </label>

            <div class="field">
              <span class="field__label">Ícono</span>
              <div class="cat-icons cat--${esc(sel.tint)}" role="listbox" aria-label="Ícono">${iconos}</div>
            </div>

            <div class="field">
              <span class="field__label">Color</span>
              <div class="cat-tints" role="listbox" aria-label="Color">${tints}</div>
            </div>

            <div class="cat-preview">
              <span class="cfg-row__ic cat--${esc(sel.tint)}">${iconoDe(sel.icono)}</span>
              <span class="cat-preview__name" id="cat-preview-name">${esc(nombre)}</span>
            </div>

            <button type="submit" class="btn btn--primary btn--block btn--save">Guardar</button>
            ${esDefault
    ? `<button type="button" class="btn btn--ghost btn--block cfg-cta" data-act="ocultar">${oculta ? ICL.eye : ICL.eyeOff}<span>${oculta ? 'Mostrar al registrar' : 'Ocultar del registro'}</span></button>`
    : ''}
            ${cambiada
    ? '<button type="button" class="btn btn--ghost btn--block cfg-danger" data-act="restaurar">Restaurar por defecto</button>'
    : ''}
            ${!esDefault
    ? '<button type="button" class="btn btn--danger btn--block cfg-danger" data-act="borrar">Eliminar categoría</button>'
    : ''}
          </form>`;

        api.pintar(html, (panel) => {
          bindCabecera(panel, { atras: pantallaLista, cerrar: () => api.cerrar() });

          // preview de nombre en vivo
          const label = panel.querySelector('#cat-label');
          const prevName = panel.querySelector('#cat-preview-name');
          if (label) label.addEventListener('input', () => {
            nombre = label.value;                       // conserva el nombre entre repintados
            if (prevName) prevName.textContent = label.value || '—';
          });

          panel.querySelectorAll('[data-ico]').forEach((b) => {
            b.addEventListener('click', () => { sel.icono = b.dataset.ico; render(); });
          });
          panel.querySelectorAll('[data-tint]').forEach((b) => {
            b.addEventListener('click', () => { sel.tint = b.dataset.tint; render(); });
          });

          panel.querySelector('#cat-form').addEventListener('submit', (e) => { e.preventDefault(); guardar(panel); });

          const oc = panel.querySelector('[data-act="ocultar"]');
          if (oc) oc.addEventListener('click', ocultar);
          const restaurar = panel.querySelector('[data-act="restaurar"]');
          if (restaurar) restaurar.addEventListener('click', restaurarDefault);
          const borrar = panel.querySelector('[data-act="borrar"]');
          if (borrar) borrar.addEventListener('click', eliminar);

          requestAnimationFrame(() => { if (label) label.focus(); });
        });
      }

      async function guardar(panel) {
        const campo = panel.querySelector('#cat-label');
        const limpio = (campo ? campo.value : '').trim();
        if (!limpio) { toast('El nombre no puede quedar vacío'); return; }
        if (catalogo().some((c) => c.id !== cat.id && c.label.toLowerCase() === limpio.toLowerCase())) {
          toast('Ya existe una categoría con ese nombre');
          return;
        }
        try {
          const cambios = {};
          const estilo = estiloActual();
          if (esDefault) {
            // nombre → renombradas (o quitar si vuelve al original)
            const renombradas = { ...(config.categoriasRenombradas || {}) };
            if (limpio === original) delete renombradas[cat.id]; else renombradas[cat.id] = limpio;
            cambios.categoriasRenombradas = renombradas;
            // estilo → solo si difiere del default (si no, se limpia)
            if (sel.icono === def.icono && sel.tint === def.tint) delete estilo[cat.id];
            else estilo[cat.id] = { icono: sel.icono, tint: sel.tint };
          } else {
            const propias = (config.categoriasPersonalizadas || [])
              .map((p) => (p.id === cat.id ? { ...p, label: limpio } : p));
            cambios.categoriasPersonalizadas = propias;
            estilo[cat.id] = { icono: sel.icono, tint: sel.tint };
          }
          cambios.categoriasEstilo = estilo;
          await saveConfig(cambios);
          await recargar();
          toast('Categoría actualizada');
          avisar();
          pantallaLista();
        } catch (err) {
          toast('No se pudo guardar: ' + err.message, { icono: false });
        }
      }

      async function ocultar() {
        try {
          const set = new Set(config.categoriasOcultas || []);
          if (set.has(cat.id)) set.delete(cat.id); else set.add(cat.id);
          await saveConfig({ categoriasOcultas: [...set] });
          await recargar();
          toast(set.has(cat.id) ? 'Oculta del registro' : 'Vuelve al registro');
          avisar();
          const nueva = catalogo().find((c) => c.id === cat.id);
          if (nueva) pantallaEditar(nueva); else pantallaLista();
        } catch (err) {
          toast('No se pudo ocultar: ' + err.message, { icono: false });
        }
      }

      async function restaurarDefault() {
        try {
          const renombradas = { ...(config.categoriasRenombradas || {}) };
          delete renombradas[cat.id];
          const estilo = estiloActual();
          delete estilo[cat.id];
          await saveConfig({ categoriasRenombradas: renombradas, categoriasEstilo: estilo });
          await recargar();
          toast('Restaurada por defecto');
          avisar();
          pantallaLista();
        } catch (err) {
          toast('No se pudo restaurar: ' + err.message, { icono: false });
        }
      }

      async function eliminar() {
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
          const estilo = estiloActual();
          delete estilo[cat.id];
          await saveConfig({ categoriasPersonalizadas: propias, categoriasEstilo: estilo });
          await recargar();
          toast('Categoría eliminada');
          avisar();
          pantallaLista();
        } catch (err) {
          toast('No se pudo eliminar: ' + err.message, { icono: false });
        }
      }

      render();
    }

    pantallaLista();
  });
}
