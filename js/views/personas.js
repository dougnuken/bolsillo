/* ============================================================
   Bolsillo · views/personas.js
   Dashboard de gasto por persona/categoría vigilada contra su tope
   (% del ingreso neto del mes). Semáforo + alertas + bonus dinámico
   (el gasto NO fijo #1 del mes). Solo lectura; el motor vive en budget.js.
   ============================================================ */

import { getAll, getConfig } from '../db.js';
import {
  calcularEstado,
  resumenPersonas,
  TOPES_PERSONA_DEFAULT,
  VIGILADOS_DEFAULT,
} from '../budget.js';
import { categoriaPorId } from '../categories.js';
import { formatCOP } from '../money.js';
import { esc } from '../html.js';

/* Ids que son "personas" (el resto de VIGILADOS_DEFAULT son categorías). */
const IDS_PERSONA = new Set(['persona1', 'persona2', 'persona3', 'yo']);

const ETIQUETA = { verde: 'Vas bien', ambar: 'Cuidado', rojo: 'Alerta' };
const pct = (frac) => Math.round((Number.isFinite(frac) ? frac : 0) * 100);

/** Una tarjeta por vigilado (persona o categoría). */
function tarjeta(fila) {
  const cat = categoriaPorId(fila.id);
  const topePct = pct(fila.topeFrac);
  const vaPct = pct(fila.pctIngreso);
  const relleno = Math.max(0, Math.min(1, fila.avanceTope)) * 100;
  const faltanMonto = fila.topeMonto != null ? Math.max(0, fila.topeMonto - fila.gastado) : null;
  const faltanPts = fila.faltanPuntos != null ? Math.max(0, Math.round(fila.faltanPuntos * 100)) : null;

  let foot;
  if (fila.color === 'rojo') {
    foot = `Pasaste tu tope del <strong>${topePct}%</strong> · llevas ${esc(formatCOP(fila.gastado))} (${vaPct}% del ingreso)`;
  } else if (fila.color === 'ambar') {
    foot = `Estás a <strong>${faltanPts || 1}%</strong> del tope del ${topePct}%` +
      (faltanMonto != null ? ` · te quedan ${esc(formatCOP(faltanMonto))}` : '');
  } else if (fila.topeFrac > 0) {
    foot = `Vas en ${vaPct}% de tu ingreso · tope ${topePct}%` +
      (faltanMonto != null ? ` · margen ${esc(formatCOP(faltanMonto))}` : '');
  } else {
    foot = `Llevas ${esc(formatCOP(fila.gastado))} este mes`;
  }

  return `
    <article class="persona-card persona-card--${fila.color}">
      <div class="persona-card__top">
        <span class="persona-card__avatar ${cat.cls}">${cat.icon}</span>
        <div class="persona-card__id">
          <p class="persona-card__name">${esc(fila.label)}</p>
          <p class="persona-card__amt num">${esc(formatCOP(fila.gastado))}</p>
        </div>
        <span class="pill pill--${fila.color}"><span class="pill__dot"></span>${ETIQUETA[fila.color]}</span>
      </div>
      <div class="persona-card__track"><span class="persona-card__fill" data-fill="${relleno}"></span></div>
      <p class="persona-card__foot">${foot}</p>
    </article>`;
}

/** Bonus: el gasto NO fijo (variable) #1 del mes. */
function bonusHTML(estado) {
  const top = Array.isArray(estado.porCategoria) ? estado.porCategoria[0] : null;
  if (!top || !(top.total > 0)) return '';
  const cat = categoriaPorId(top.categoriaId);
  const share = pct(top.pct);
  return `
    <section class="bonus-card">
      <p class="bonus-card__kicker">En lo que más se te va este mes</p>
      <div class="bonus-card__row">
        <span class="bonus-card__ic ${cat.cls}">${cat.icon}</span>
        <div class="bonus-card__body">
          <p class="bonus-card__name">${esc(cat.label)}</p>
          <p class="bonus-card__sub">${share}% de tu gasto variable</p>
        </div>
        <p class="bonus-card__amt num">${esc(formatCOP(top.total))}</p>
      </div>
      <p class="bonus-card__note">Gasto <strong>no fijo</strong>: lo que se puede recortar sin tocar tus obligaciones.</p>
    </section>`;
}

function sinSueldoHTML() {
  return `
    <section class="empty">
      <span class="empty__art">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 5.2a3 3 0 0 1 0 5.6"/></svg>
      </span>
      <h2 class="empty__title">Configura tu sueldo</h2>
      <p class="empty__text">Los topes por persona se miden como % de tu ingreso neto. Ve a <strong>Perfil → Sueldo</strong> para empezar.</p>
      <button type="button" class="btn btn--primary" data-act="ir-sueldo">Ir a Perfil</button>
    </section>`;
}

export default {
  label: 'Personas',

  render() {
    return `
      <header class="view-greet">
        <p class="view-greet__eyebrow">Tu gente</p>
        <h1 class="view-greet__title">Personas</h1>
      </header>
      <div id="personas-body"><div class="hoy-skeleton" aria-hidden="true"></div></div>`;
  },

  mount(root) {
    const body = root.querySelector('#personas-body');
    if (!body) return;

    async function pintar() {
      let movs = [], ingresos = [], recs = [], creds = [], config = null;
      try {
        [movs, ingresos, recs, creds, config] = await Promise.all([
          getAll('movimientos'), getAll('ingresos'), getAll('recurrentes'), getAll('creditos'), getConfig(),
        ]);
      } catch (err) {
        console.warn('[Bolsillo] no se pudo cargar Personas:', err);
        body.innerHTML = '<p class="hoy-error">No se pudieron cargar tus personas. Reintenta.</p>';
        return;
      }
      if (!root.isConnected) return;

      const empleo = ingresos.find((i) => i && i.fuente === 'empleo') || null;
      const hoy = new Date();
      const estado = calcularEstado({
        ingresoEmpleo: empleo ? empleo.monto : null,
        movimientos: movs, recurrentes: recs, creditos: creds, hoy, config,
      });

      if (!estado.configurado) {
        body.innerHTML = sinSueldoHTML();
        const ir = body.querySelector('[data-act="ir-sueldo"]');
        if (ir) ir.addEventListener('click', () => { location.hash = '#/perfil'; });
        return;
      }

      const vigilados = VIGILADOS_DEFAULT.map((id) => ({ id, label: categoriaPorId(id).label }));
      const topes = { ...TOPES_PERSONA_DEFAULT, ...(config.topesPersona || {}) };
      const filas = resumenPersonas({
        movimientos: movs, vigilados, netoDelMes: estado.plataDelMes, topes, hoy,
      });

      const personas = filas.filter((f) => IDS_PERSONA.has(f.id));
      const categorias = filas.filter((f) => !IDS_PERSONA.has(f.id));

      body.innerHTML = `
        <p class="personas-intro">Cuánto llevas en cada quien este mes, medido contra un tope sano de tu ingreso neto (${esc(formatCOP(estado.plataDelMes))}).</p>
        <section class="personas-grid">
          ${personas.map(tarjeta).join('')}
        </section>
        ${categorias.length ? `
          <p class="settings-group__label personas-sub">Categorías vigiladas</p>
          <section class="personas-grid">${categorias.map(tarjeta).join('')}</section>` : ''}
        ${bonusHTML(estado)}`;

      // Ancho de las barras por JS (CSP style-src 'self' bloquea style= inline).
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      body.querySelectorAll('.persona-card__fill').forEach((f) => {
        const w = Math.max(0, Math.min(100, Number(f.dataset.fill) || 0));
        if (reduce) f.style.width = w + '%';
        else requestAnimationFrame(() => { f.style.width = w + '%'; });
      });
    }

    pintar();
  },
};
