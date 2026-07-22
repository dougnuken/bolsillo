/* ============================================================
   Bolsillo · Vista Movimientos
   Lista agrupada por día + filtros combinables (categoría, cuenta,
   fuente, solo hormiga) + editar / borrar / recategorizar (aprende).
   Sin estilos inline (CSP style-src 'self').
   ============================================================ */

import { getAll, del, put, getConfig, saveConfig } from '../db.js';
import { actualizar, derivarEsHormiga } from '../model.js';
import { formatCOP } from '../money.js';
import { catalogoVisible, categoriaPorId } from '../categories.js';
import { aprender } from '../categorize.js';
import { confirmar, menu } from '../overlay.js';
import { toast } from '../toast.js';
import registrar from './registrar.js';

const ART =
  '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="10" width="34" height="28" rx="4"/><path d="M7 18h34"/><path d="M13 26h9"/><path d="M13 32h6"/><circle cx="33" cy="29" r="4"/></svg>';
const ICON_PLUS =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
const ICON_MORE =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></svg>';
const ICON_EDIT =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-6"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>';
const ICON_TAG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.2"/></svg>';
const ICON_TRASH =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/></svg>';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (m) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]
));
const hoyISO = () => new Date().toISOString().slice(0, 10);
function ayerISO() { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); }

const FUENTE_LABEL = { manual: 'Manual', recurrente: 'Fijo', foto: 'Foto', pdf: 'PDF' };

/* estado de filtros a nivel de sesión */
const filtros = { categoria: '', cuenta: '', fuente: '', soloHormiga: false };

function etiquetaDia(iso) {
  if (iso === hoyISO()) return 'Hoy';
  if (iso === ayerISO()) return 'Ayer';
  const f = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
    .format(new Date(iso + 'T12:00:00'));
  return f.charAt(0).toUpperCase() + f.slice(1);
}

function aplicarFiltros(movs) {
  return movs.filter((m) => {
    if (filtros.categoria && m.categoria !== filtros.categoria) return false;
    if (filtros.cuenta && m.cuenta !== filtros.cuenta) return false;
    if (filtros.fuente && m.fuente !== filtros.fuente) return false;
    if (filtros.soloHormiga && !m.esHormiga) return false;
    return true;
  });
}

function ordenar(movs) {
  return [...movs].sort((a, b) => {
    const fa = (a.fecha || '').slice(0, 10), fb = (b.fecha || '').slice(0, 10);
    if (fa !== fb) return fa < fb ? 1 : -1;
    return (b.creadoEn || '') < (a.creadoEn || '') ? -1 : 1;
  });
}

/* ---- chips de filtro (solo dimensiones presentes en los datos) ---- */
function chipsFiltro(movs) {
  const catsUsadas = [...new Set(movs.map((m) => m.categoria).filter(Boolean))];
  const cuentasUsadas = [...new Set(movs.map((m) => m.cuenta).filter(Boolean))];
  const fuentesUsadas = [...new Set(movs.map((m) => m.fuente).filter(Boolean))];

  const chip = (dim, val, label, extraCls = '', sel = false) =>
    `<button type="button" class="mfilter${extraCls}${sel ? ' is-sel' : ''}" data-dim="${dim}" data-val="${esc(val)}">${label}</button>`;

  const grupoCat = catsUsadas.map((id) => {
    const c = categoriaPorId(id);
    return chip('categoria', id, `<span class="mfilter__dot ${c.cls}"></span>${esc(c.label)}`, '', filtros.categoria === id);
  }).join('');
  const grupoCuenta = cuentasUsadas.map((c) => chip('cuenta', c, esc(c), '', filtros.cuenta === c)).join('');
  const grupoFuente = fuentesUsadas.map((f) => chip('fuente', f, esc(FUENTE_LABEL[f] || f), '', filtros.fuente === f)).join('');

  const sep = '<span class="mfilter-sep" aria-hidden="true"></span>';
  return `
    <div class="mov-filters" role="group" aria-label="Filtros">
      ${chip('hormiga', '1', 'Hormiga', ' mfilter--hormiga', filtros.soloHormiga)}
      ${grupoCat ? sep + grupoCat : ''}
      ${grupoCuenta ? sep + grupoCuenta : ''}
      ${grupoFuente ? sep + grupoFuente : ''}
    </div>`;
}

function filaMov(m) {
  const c = categoriaPorId(m.categoria);
  const detalle = m.comercio && m.comercio.trim() ? m.comercio.trim() : '';
  // El detalle manda como título; la categoría acompaña en la meta. Sin
  // detalle, el título ES la categoría (captura rápida sin sub).
  const titulo = detalle || c.label;
  const metas = detalle ? [esc(c.label), esc(m.cuenta)] : [esc(m.cuenta)];
  const badge = FUENTE_LABEL[m.fuente] && m.fuente !== 'manual'
    ? `<span class="src-badge">${esc(FUENTE_LABEL[m.fuente])}</span>` : '';
  const hormiga = m.esHormiga ? '<span class="hormiga-dot" title="Gasto hormiga"></span>' : '';
  const signo = m.tipo === 'ingreso';
  return `
    <div class="mov-row" data-id="${esc(m.id)}">
      <button type="button" class="mov-row__main" data-act="edit" data-id="${esc(m.id)}">
        <span class="mov-row__icon ${c.cls}">${c.icon}</span>
        <span class="mov-row__body">
          <span class="mov-row__title">${esc(titulo)}${hormiga}</span>
          <span class="mov-row__meta">${metas.join(' · ')} ${badge}</span>
        </span>
        <span class="mov-row__amount num${signo ? ' is-in' : ''}">${formatCOP(m.monto, { signo })}</span>
      </button>
      <button type="button" class="mov-row__more icon-btn" data-act="more" data-id="${esc(m.id)}" aria-label="Acciones">${ICON_MORE}</button>
    </div>`;
}

function listaHTML(movs) {
  const grupos = new Map();
  for (const m of movs) {
    const dia = (m.fecha || '').slice(0, 10);
    if (!grupos.has(dia)) grupos.set(dia, []);
    grupos.get(dia).push(m);
  }
  let out = '';
  for (const [dia, items] of grupos) {
    const total = items.reduce((s, x) => s + (x.tipo === 'ingreso' ? 0 : x.monto), 0);
    out += `
      <div class="mov-day">
        <div class="mov-day__head">
          <span class="mov-day__label">${esc(etiquetaDia(dia))}</span>
          <span class="mov-day__total num">${formatCOP(total)}</span>
        </div>
        <div class="mov-day__list">${items.map(filaMov).join('')}</div>
      </div>`;
  }
  return out;
}

export default {
  label: 'Movimientos',

  render() {
    return `
      <header class="view-greet">
        <p class="view-greet__eyebrow">Historial</p>
        <h1 class="view-greet__title">Movimientos</h1>
      </header>
      <div id="mov-root" aria-busy="true"></div>`;
  },

  mount(root) {
    const cont = root.querySelector('#mov-root');
    let todos = [];

    async function recargar() {
      let cfg = null;
      try {
        [todos, cfg] = await Promise.all([getAll('movimientos'), getConfig()]);
      } catch (err) {
        cont.innerHTML = `<p class="mov-error">No se pudo cargar el historial: ${esc(err.message)}</p>`;
        return;
      }
      pintar(cfg);
    }

    function pintar(cfg) {
      cont.removeAttribute('aria-busy');
      if (!todos.length) {
        cont.innerHTML = `
          <div class="empty">
            <div class="empty__art">${ART}</div>
            <h2 class="empty__title">Aún no hay movimientos</h2>
            <p class="empty__text">Registra tu primer gasto y aquí verás todo tu historial, ordenado y filtrable.</p>
            <button class="btn btn--primary" id="mov-add" type="button">${ICON_PLUS} Registrar movimiento</button>
          </div>`;
        const add = cont.querySelector('#mov-add');
        if (add) add.addEventListener('click', () => registrar.abrir());
        return;
      }
      const orden = ordenar(todos);
      const filtrados = aplicarFiltros(orden);
      cont.innerHTML = `
        ${chipsFiltro(orden)}
        ${filtrados.length
          ? `<div class="mov-list">${listaHTML(filtrados)}</div>`
          : `<div class="mov-nores"><p>Ningún movimiento coincide con los filtros.</p><button type="button" class="btn btn--ghost btn--sm" id="mov-clear">Limpiar filtros</button></div>`}`;
      wire(cfg);
    }

    function wire(cfg) {
      cont.querySelectorAll('.mfilter').forEach((b) => {
        b.addEventListener('click', () => {
          const { dim, val } = b.dataset;
          if (dim === 'hormiga') filtros.soloHormiga = !filtros.soloHormiga;
          else filtros[dim] = filtros[dim] === val ? '' : val;
          pintar(cfg);
        });
      });
      const clear = cont.querySelector('#mov-clear');
      if (clear) clear.addEventListener('click', () => {
        filtros.categoria = ''; filtros.cuenta = ''; filtros.fuente = ''; filtros.soloHormiga = false;
        pintar(cfg);
      });
      cont.querySelectorAll('[data-act="edit"]').forEach((b) => {
        b.addEventListener('click', async () => {
          const m = todos.find((x) => x.id === b.dataset.id);
          if (m) registrar.abrir(m);
        });
      });
      cont.querySelectorAll('[data-act="more"]').forEach((b) => {
        b.addEventListener('click', () => abrirAcciones(b.dataset.id, cfg));
      });
    }

    async function abrirAcciones(id, cfg) {
      const m = todos.find((x) => x.id === id);
      if (!m) return;
      const elegido = await menu({
        title: m.comercio || categoriaPorId(m.categoria).label,
        items: [
          { value: 'edit', label: 'Editar', icon: ICON_EDIT },
          { value: 'recat', label: 'Cambiar categoría', icon: ICON_TAG },
          { value: 'del', label: 'Borrar', icon: ICON_TRASH, danger: true },
        ],
      });
      if (elegido === 'edit') registrar.abrir(m);
      else if (elegido === 'recat') recategorizar(m, cfg);
      else if (elegido === 'del') borrar(m);
    }

    async function borrar(m) {
      const ok = await confirmar({
        title: '¿Borrar este movimiento?',
        text: `${m.comercio || categoriaPorId(m.categoria).label} · ${formatCOP(m.monto)}. Esta acción no se puede deshacer.`,
        okText: 'Borrar', danger: true,
      });
      if (!ok) return;
      try {
        await del('movimientos', m.id);
        toast('Movimiento borrado');
        await recargar();
      } catch (err) {
        toast('No se pudo borrar: ' + err.message, { icono: false });
      }
    }

    async function recategorizar(m, cfg) {
      const elegido = await menu({
        title: 'Cambiar categoría',
        items: catalogoVisible().map((c) => ({ value: c.id, label: c.label, icon: c.icon })),
      });
      if (!elegido || elegido === m.categoria) return;
      try {
        const esHormiga = derivarEsHormiga({ ...m, categoria: elegido }, cfg || undefined);
        const actualizado = actualizar(m, { categoria: elegido, esHormiga });
        await put('movimientos', actualizado);
        // la app aprende de la corrección
        if (m.comercio && m.comercio.trim()) {
          await aprender(m.comercio, elegido, { getConfig, saveConfig });
        }
        toast('Categoría actualizada');
        await recargar();
      } catch (err) {
        toast('No se pudo recategorizar: ' + err.message, { icono: false });
      }
    }

    recargar();
  },
};
