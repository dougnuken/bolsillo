/* ============================================================
   Bolsillo · Vista Movimientos
   Lista agrupada por día + filtros combinables (categoría, cuenta,
   fuente, solo hormiga) + editar / borrar / recategorizar (aprende).
   Sin estilos inline (CSP style-src 'self').
   ============================================================ */

import { getAll, del, put, getConfig, saveConfig } from '../db.js';
import { actualizar, derivarEsHormiga } from '../model.js';
import { formatCOP, formatMovimiento } from '../money.js';
import { catalogoVisible, categoriaPorId } from '../categories.js';
import { aprender } from '../categorize.js';
import { hoyISO, sumarDiasISO } from '../fechas.js';
import { confirmar, menu } from '../overlay.js';
import { toast } from '../toast.js';
import { sugerirFijo } from '../reconciliacion.js';
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
const ICON_LINK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12h6"/><path d="M9.5 8H8a4 4 0 0 0 0 8h1.5"/><path d="M14.5 8H16a4 4 0 0 1 0 8h-1.5"/></svg>';
const ICON_SEARCH =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>';
const ICON_X =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (m) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]
));

const FUENTE_LABEL = { manual: 'Manual', recurrente: 'Fijo', foto: 'Foto', pdf: 'PDF' };
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/* "2026-07" → "Julio" (o "Julio 2026" si es de otro año que el actual). */
function etiquetaMes(ym) {
  const [a, m] = String(ym).split('-');
  const idx = parseInt(m, 10) - 1;
  const nombre = MESES[idx] ? MESES[idx][0].toUpperCase() + MESES[idx].slice(1) : ym;
  const anioActual = new Date().getFullYear();
  return Number(a) === anioActual ? nombre : `${nombre} ${a}`;
}

/* estado de filtros a nivel de sesión */
const filtros = { categoria: '', cuenta: '', fuente: '', soloHormiga: false, q: '', mes: '' };

/* Coincidencia de búsqueda libre: concepto, categoría, cuenta, fuente o monto.
   Sin acentos; el monto matchea por dígitos ("15000", "15.000" o "$15.000"). */
function coincide(m, q) {
  const qn = String(q).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  if (!qn) return true;
  const c = categoriaPorId(m.categoria);
  const texto = [m.comercio, c.label, m.cuenta, FUENTE_LABEL[m.fuente] || m.fuente]
    .filter(Boolean).join(' ')
    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (texto.includes(qn)) return true;
  const qd = qn.replace(/\D/g, '');
  return !!qd && String(m.monto).includes(qd);
}

/* Empty state de la lista según el motivo (búsqueda vs filtros). */
function sinResultadosHTML() {
  if (filtros.q) {
    return `
      <div class="empty">
        <div class="empty__art">${ICON_SEARCH}</div>
        <h2 class="empty__title">Sin resultados</h2>
        <p class="empty__text">No encontramos nada para «${esc(filtros.q)}». Prueba con otro concepto, categoría o monto.</p>
        <button type="button" class="btn btn--ghost btn--sm" id="mov-clear">Limpiar búsqueda</button>
      </div>`;
  }
  return `<div class="mov-nores"><p>Ningún movimiento coincide con los filtros.</p><button type="button" class="btn btn--ghost btn--sm" id="mov-clear">Limpiar filtros</button></div>`;
}

function etiquetaDia(iso) {
  if (iso === hoyISO()) return 'Hoy';
  if (iso === sumarDiasISO(hoyISO(), -1)) return 'Ayer';
  const f = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
    .format(new Date(iso + 'T12:00:00'));
  return f.charAt(0).toUpperCase() + f.slice(1);
}

function aplicarFiltros(movs) {
  return movs.filter((m) => {
    if (filtros.mes && (m.fecha || '').slice(0, 7) !== filtros.mes) return false;
    if (filtros.categoria && m.categoria !== filtros.categoria) return false;
    if (filtros.cuenta && m.cuenta !== filtros.cuenta) return false;
    if (filtros.fuente && m.fuente !== filtros.fuente) return false;
    if (filtros.soloHormiga && !m.esHormiga) return false;
    if (filtros.q && !coincide(m, filtros.q)) return false;
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
  const mesesUsados = [...new Set(movs.map((m) => (m.fecha || '').slice(0, 7)).filter(Boolean))].sort().reverse();
  const catsUsadas = [...new Set(movs.map((m) => m.categoria).filter(Boolean))];
  const cuentasUsadas = [...new Set(movs.map((m) => m.cuenta).filter(Boolean))];
  const fuentesUsadas = [...new Set(movs.map((m) => m.fuente).filter(Boolean))];

  const chip = (dim, val, label, extraCls = '', sel = false) =>
    `<button type="button" class="mfilter${extraCls}${sel ? ' is-sel' : ''}" data-dim="${dim}" data-val="${esc(val)}">${label}</button>`;

  // Salto directo a un mes (Julio, Agosto…). Solo si hay más de un mes con datos.
  const grupoMes = mesesUsados.length > 1
    ? mesesUsados.map((ym) => chip('mes', ym, esc(etiquetaMes(ym)), ' mfilter--mes', filtros.mes === ym)).join('')
    : '';
  const grupoCat = catsUsadas.map((id) => {
    const c = categoriaPorId(id);
    return chip('categoria', id, `<span class="mfilter__dot ${c.cls}"></span>${esc(c.label)}`, '', filtros.categoria === id);
  }).join('');
  const grupoCuenta = cuentasUsadas.map((c) => chip('cuenta', c, esc(c), '', filtros.cuenta === c)).join('');
  const grupoFuente = fuentesUsadas.map((f) => chip('fuente', f, esc(FUENTE_LABEL[f] || f), '', filtros.fuente === f)).join('');

  const sep = '<span class="mfilter-sep" aria-hidden="true"></span>';
  return `
    <div class="mov-filters" role="group" aria-label="Filtros">
      ${grupoMes ? grupoMes + sep : ''}
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
  // Ingreso: +$ verde. Gasto y pago: −$ (salen de la cuenta).
  const esIn = m.tipo === 'ingreso';
  return `
    <div class="mov-row" data-id="${esc(m.id)}">
      <div class="mov-row__main">
        <span class="mov-row__icon ${c.cls}">${c.icon}</span>
        <span class="mov-row__body">
          <span class="mov-row__title">${esc(titulo)}${hormiga}</span>
          <span class="mov-row__meta">${metas.join(' · ')} ${badge}</span>
        </span>
        <span class="mov-row__amount num${esIn ? ' is-in' : ''}">${formatMovimiento(m.monto, m.tipo)}</span>
      </div>
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
  // Total de GASTOS por mes (para el encabezado). Los ingresos no restan.
  const totalMes = {};
  for (const m of movs) {
    const ym = (m.fecha || '').slice(0, 7);
    totalMes[ym] = (totalMes[ym] || 0) + (m.tipo === 'ingreso' ? 0 : m.monto);
  }
  let out = '';
  let mesActual = null;
  for (const [dia, items] of grupos) {
    const ym = dia.slice(0, 7);
    // Encabezado de mes al cambiar de mes: separa julio de agosto sin filtrar.
    if (ym !== mesActual) {
      mesActual = ym;
      out += `
        <div class="mov-month">
          <span class="mov-month__label">${esc(etiquetaMes(ym))}</span>
          <span class="mov-month__total num">${formatCOP(totalMes[ym] || 0)}</span>
        </div>`;
    }
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
      <div class="mov-search" hidden>
        <span class="mov-search__ic" aria-hidden="true">${ICON_SEARCH}</span>
        <input type="text" class="mov-search__input" id="mov-q" placeholder="Buscar concepto, monto, categoría…" autocomplete="off" enterkeyhint="search" aria-label="Buscar movimientos" />
        <button type="button" class="mov-search__clear" id="mov-q-clear" aria-label="Limpiar búsqueda" hidden>${ICON_X}</button>
      </div>
      <div id="mov-root" aria-busy="true"></div>`;
  },

  mount(root) {
    const cont = root.querySelector('#mov-root');
    const searchBar = root.querySelector('.mov-search');
    const input = root.querySelector('#mov-q');
    const clearBtn = root.querySelector('#mov-q-clear');
    let todos = [];
    let cfgActual = null;
    let debeEnfocar = false;
    try {
      if (sessionStorage.getItem('bolsillo:openSearch')) {
        sessionStorage.removeItem('bolsillo:openSearch');
        debeEnfocar = true;
      }
    } catch { /* sessionStorage no disponible */ }

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
      cfgActual = cfg;
      cont.removeAttribute('aria-busy');
      if (!todos.length) {
        if (searchBar) searchBar.hidden = true;
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
      if (searchBar) searchBar.hidden = false;
      if (debeEnfocar && input) { debeEnfocar = false; setTimeout(() => input.focus(), 50); }
      const orden = ordenar(todos);
      const filtrados = aplicarFiltros(orden);
      cont.innerHTML = `
        ${chipsFiltro(orden)}
        ${filtrados.length
          ? `<div class="mov-list">${listaHTML(filtrados)}</div>`
          : sinResultadosHTML()}`;
      wire(cfg);
    }

    function resetFiltros() {
      filtros.categoria = ''; filtros.cuenta = ''; filtros.fuente = ''; filtros.soloHormiga = false; filtros.q = ''; filtros.mes = '';
      if (input) input.value = '';
      if (clearBtn) clearBtn.hidden = true;
    }

    // Búsqueda: input persistente (fuera de #mov-root para no perder el foco al filtrar).
    if (input) {
      input.value = filtros.q;
      if (clearBtn) clearBtn.hidden = !filtros.q;
      input.addEventListener('input', () => {
        filtros.q = input.value;
        if (clearBtn) clearBtn.hidden = !input.value;
        pintar(cfgActual);
      });
    }
    if (clearBtn) clearBtn.addEventListener('click', () => {
      filtros.q = '';
      if (input) { input.value = ''; input.focus(); }
      clearBtn.hidden = true;
      pintar(cfgActual);
    });

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
        resetFiltros();
        pintar(cfg);
      });
      // La fila NO abre edición al tocarla (evita ediciones accidentales al
      // deslizar). Editar solo desde los 3 puntos → Editar.
      cont.querySelectorAll('[data-act="more"]').forEach((b) => {
        b.addEventListener('click', () => abrirAcciones(b.dataset.id, cfg));
      });
    }

    async function abrirAcciones(id, cfg) {
      const m = todos.find((x) => x.id === id);
      if (!m) return;
      // ¿este gasto (sin vincular) parece el pago de un fijo pendiente? → ofrecer
      // vincularlo aquí también, por si se escapó el chip al registrarlo.
      let fijoSug = null;
      if (m.tipo === 'gasto' && !m.recurrenteId) {
        try {
          const recs = await getAll('recurrentes');
          fijoSug = sugerirFijo({ gasto: m, recurrentes: recs, movimientos: todos, hoy: new Date() });
        } catch { /* si falla, seguimos sin la opción */ }
      }
      const items = [];
      if (fijoSug) items.push({ value: 'vincular', label: `Vincular a ${fijoSug.nombre}`, icon: ICON_LINK });
      items.push(
        { value: 'edit', label: 'Editar', icon: ICON_EDIT },
        { value: 'recat', label: 'Cambiar categoría', icon: ICON_TAG },
        { value: 'del', label: 'Borrar', icon: ICON_TRASH, danger: true },
      );
      const elegido = await menu({ title: m.comercio || categoriaPorId(m.categoria).label, items });
      if (elegido === 'vincular') vincularFijo(m, fijoSug);
      else if (elegido === 'edit') registrar.abrir(m);
      else if (elegido === 'recat') recategorizar(m, cfg);
      else if (elegido === 'del') borrar(m);
    }

    async function vincularFijo(m, fijo) {
      if (!fijo) return;
      try {
        // queda como EL pago del fijo: enlazado y fijo (nunca hormiga).
        const actualizado = actualizar(m, { recurrenteId: fijo.id, esFijo: true, esHormiga: false });
        await put('movimientos', actualizado);
        toast('Vinculado a ' + fijo.nombre);
        // avisa a app.js para recalcular pendientes → el recordatorio se apaga.
        window.dispatchEvent(new CustomEvent('bolsillo:recurrentes-cambiaron'));
        await recargar();
      } catch (err) {
        toast('No se pudo vincular: ' + err.message, { icono: false });
      }
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
