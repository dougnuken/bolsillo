/* ============================================================
   Bolsillo · views/dashboard.js  (vista HOY, funcional)
   Lee db → corre calcularEstado → pinta el semáforo del mes.
   El anillo se llena según el RITMO (no el bruto): gastar 90% el
   día 28 va bien; 80% el día 10 es alerta. Marca de "avance" para
   ver si vas por delante o por detrás del calendario.
   Anima solo el llenado (stroke-dashoffset) y ancho de barras;
   honra prefers-reduced-motion. Sin config → estado vacío + CTA.
   ============================================================ */

import { getAll, getConfig } from '../db.js';
import { calcularEstado, resumenNegocios, historialAhorro } from '../budget.js';
import { formatCOP } from '../money.js';
import { hoyISO } from '../fechas.js';
import { categoriaPorId } from '../categories.js';
import { abrirSueldo } from './sueldo-sheet.js';

const R = 42;
const CIRC = 2 * Math.PI * R; // circunferencia del aro
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const ICON_WALLET =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5A2.5 2.5 0 0 1 5.5 6H18a2 2 0 0 1 2 2v1"/><path d="M3 8.5V17a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2"/><path d="M21 11h-4a2 2 0 0 0 0 4h4a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1Z"/></svg>';
const ICON_DOWN =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="m6 13 6 6 6-6"/></svg>';
const ICON_UP =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="m6 11 6-6 6 6"/></svg>';
const ICON_PIN =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21v-4l7-7"/><path d="m14 4 6 6-4 1-3 3-3-3 3-3 1-4Z"/></svg>';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (m) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]
  ));
}

function pct(frac) {
  if (frac == null || !Number.isFinite(frac)) return '—';
  return Math.round(frac * 100) + '%';
}

/** Atenúa el símbolo $ (y el signo) para la jerarquía tipo fintech: el "$"
 *  va en gris y algo más pequeño, la cifra manda. "—" pasa igual. */
function conDivisa(str) {
  const s = String(str == null ? '' : str);
  const m = s.match(/^([−+-]?)\s*\$(.*)$/);
  if (m) return `<span class="cifra-cur">${m[1]}$</span>${esc(m[2])}`;
  return esc(s);
}

/* ---- Saludo + card de balance + tabs ---- */
const TABS = [['dashboard', 'Dashboard'], ['analytics', 'Analytics']];

const ICON_TREND_UP =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17 9.5 10.5l4 4L21 7"/><path d="M15 7h6v6"/></svg>';
const ICON_TREND_DOWN =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7 9.5 13.5l4-4L21 17"/><path d="M15 17h6v-6"/></svg>';
const ICON_ARROW_UR =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>';
const ICON_SEARCH =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>';

/* Métrica del día: neto de HOY (ingresos − gastos del día). Verde si entró
   plata, rojo si se gastó, neutro si no hubo movimientos. */
function metricaHoy(movimientos, hoy) {
  const hISO = hoyISO(hoy);
  let gasto = 0, ingreso = 0;
  for (const m of (movimientos || [])) {
    if (!m || m.fecha !== hISO) continue;
    if (m.tipo === 'ingreso') ingreso += m.monto || 0;
    else if (m.tipo === 'gasto') gasto += m.monto || 0;
  }
  return { gasto, ingreso, neto: ingreso - gasto };
}
function deltaClaseHoy(m) {
  if (!m || (!m.gasto && !m.ingreso)) return 'bcard__delta--flat';
  return m.neto >= 0 ? 'bcard__delta--up' : 'bcard__delta--down';
}
function deltaInnerHoy(m) {
  if (!m || (!m.gasto && !m.ingreso)) return 'Sin movimientos hoy';
  const up = m.neto >= 0;
  const signo = up ? '+' : '−';
  return `${up ? ICON_TREND_UP : ICON_TREND_DOWN}<span class="num">${signo}${esc(formatCOP(Math.abs(m.neto)))}</span><span class="bcard__delta-lbl">hoy</span>`;
}

/** Iniciales para el avatar: "Ana Pérez" → "AP". Vacío → ''. */
function iniciales(nombre) {
  const partes = String(nombre || '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '';
  const a = partes[0][0] || '';
  const b = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (a + b).toUpperCase();
}
let tabActivo = 'dashboard';

/* Último saldo pintado en "Tu dinero". Vive a nivel de módulo (no en el DOM)
   para sobrevivir al re-render de la vista al guardar un movimiento: así podemos
   animar el rodillo DESDE el valor anterior HASTA el nuevo (tipo cuentakilómetros
   de casino) en vez de saltar seco. null = aún no hay saldo (sin sueldo). */
let saldoMostrado = null;

/* Rueda el número de "Tu dinero" de `desde` a `hasta` (~0.8s, ease-out), pintando
   cada frame formateado. Anima SOLO texto + un transform/tint sutil vía clase (se
   honra prefers-reduced-motion en el llamador). El tinte marca la dirección
   (rojo baja / verde sube) y se desvanece al soltar la clase. */
function animarSaldo(el, desde, hasta, dur = 820) {
  const baja = hasta < desde;
  el.classList.add('is-rolling', baja ? 'is-rolling--down' : 'is-rolling--up');
  let t0 = null;
  const paso = (now) => {
    if (t0 == null) t0 = now;
    const t = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - t, 3);           // ease-out cúbico
    const val = Math.round(desde + (hasta - desde) * e);
    el.innerHTML = conDivisa(formatCOP(val));
    if (t < 1) { requestAnimationFrame(paso); return; }
    el.innerHTML = conDivisa(formatCOP(hasta));  // asegura el valor exacto final
    el.classList.remove('is-rolling', 'is-rolling--down', 'is-rolling--up');
  };
  requestAnimationFrame(paso);
}

const ICON_BELL =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8.5a6 6 0 0 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14.5 18 8.5"></path><path d="M13.7 20a2 2 0 0 1-3.4 0"></path></svg>';

function saludoInfo() {
  const h = new Date().getHours();
  if (h < 12) return { txt: 'Buenos días,', emoji: '👋' };
  if (h < 19) return { txt: 'Buenas tardes,', emoji: '👋' };
  return { txt: 'Buenas noches,', emoji: '👋' };
}

function greetHTML(nombre) {
  const s = saludoInfo();
  const nom = String(nombre || '').trim();
  return `
    <header class="hoy-greet">
      <div class="hoy-greet__txt">
        <p class="hoy-greet__hi">${s.txt}</p>
        <p class="hoy-greet__name" id="hoy-name">${nom ? esc(nom) + ' ' : ''}${s.emoji}</p>
      </div>
      <div class="hoy-greet__actions">
        <button type="button" class="icon-btn icon-btn--notif" id="hoy-search" aria-label="Buscar movimientos">
          ${ICON_SEARCH}
        </button>
        <button type="button" class="icon-btn icon-btn--notif hoy-greet__bell" id="hoy-bell" aria-label="Notificaciones">
          ${ICON_BELL}<span class="notif-badge" hidden>0</span>
        </button>
      </div>
    </header>`;
}

function balanceCardHTML(saldo) {
  // Semilla del render: si ya conocemos el saldo (re-render tras un movimiento),
  // lo pintamos de una para que NO haya parpadeo a "—" y el rodillo arranque
  // desde el número visible. Se muestra cualquier valor finito (incluido 0 o
  // negativo: "sin dinero disponible" / "te pasaste" son estados reales).
  const bal = (saldo != null && Number.isFinite(saldo)) ? conDivisa(formatCOP(saldo)) : '—';
  return `
    <section class="bcard">
      <div class="bcard__top">
        <span class="bcard__lbl">Tu dinero</span>
        <span class="bcard__arrow" aria-hidden="true">${ICON_ARROW_UR}</span>
      </div>
      <p class="bcard__amt num" id="hoy-balance">${bal}</p>
      <p class="bcard__delta bcard__delta--flat" id="hoy-daydelta">Sin movimientos hoy</p>
    </section>`;
}

/* Tabs sutiles dentro del sheet, con indicador deslizante (se anima al cambiar). */
function tabsHTML() {
  const tabs = TABS.map(([id, label]) =>
    `<button type="button" class="hoy-tab${tabActivo === id ? ' is-on' : ''}" role="tab" data-hoy-tab="${id}">${label}</button>`).join('');
  return `<div class="hoy-tabs" role="tablist" aria-label="Secciones de Hoy">${tabs}<span class="hoy-tabs__ind" aria-hidden="true"></span></div>`;
}

/* Coloca (y desliza) el indicador bajo la pestaña activa. */
function colocarIndicador(root, animar) {
  const tabs = root.querySelector('.hoy-tabs');
  if (!tabs) return;
  const ind = tabs.querySelector('.hoy-tabs__ind');
  const on = tabs.querySelector('.hoy-tab.is-on');
  if (!ind || !on) return;
  if (!animar) ind.style.transition = 'none';
  ind.style.width = on.offsetWidth + 'px';
  ind.style.transform = `translateX(${on.offsetLeft}px)`;
  if (!animar) { void ind.offsetWidth; ind.style.transition = ''; }
}

/* Lista de gastos fijos (pestaña Recurrentes). */
function recurrentesHTML(recs) {
  const lista = Array.isArray(recs) ? recs.slice().sort((a, b) => (a.diaDelMes || 0) - (b.diaDelMes || 0)) : [];
  if (!lista.length) {
    return '<div class="hoy-empty">Aún no tienes gastos fijos. Créalos en Perfil → Gastos fijos.</div>';
  }
  const filas = lista.map((r) => {
    const val = r.esVariable
      ? (Number.isInteger(r.montoEstimado) && r.montoEstimado > 0
        ? `<span class="rec-item__val num">~${esc(formatCOP(r.montoEstimado))}</span>`
        : '<span class="rec-item__val rec-item__val--var">variable</span>')
      : `<span class="rec-item__val num">${esc(formatCOP(r.monto))}</span>`;
    const dia = Number.isInteger(r.diaDelMes) ? `día ${r.diaDelMes}` : '';
    return `
      <div class="rec-item">
        <span class="rec-item__bd">
          <span class="rec-item__name">${esc(r.nombre || 'Fijo')}</span>
          ${dia ? `<span class="rec-item__meta">${dia}</span>` : ''}
        </span>
        ${val}
      </div>`;
  }).join('');
  return `<div class="card rec-list">${filas}</div>`;
}

/* ---- estado vacío (sin sueldo configurado) ---- */
function sinConfigHTML() {
  return `
    <section class="card gauge-card" aria-labelledby="gauge-hint">
      <div class="gauge" role="img" aria-label="Balance del mes sin configurar">
        <svg class="gauge__svg" viewBox="0 0 100 100" aria-hidden="true">
          <circle class="gauge__track" cx="50" cy="50" r="42"></circle>
          <circle class="gauge__arc" cx="50" cy="50" r="42"></circle>
        </svg>
        <div class="gauge__center">
          <span class="gauge__hint" id="gauge-hint">Balance del mes</span>
          <span class="gauge__value gauge__value--muted num">—</span>
          <span class="gauge__caption">Configura tu sueldo para empezar</span>
        </div>
      </div>
      <div class="legend" aria-hidden="true">
        <span class="legend__item"><span class="legend__dot legend__dot--verde"></span>Vas bien</span>
        <span class="legend__item"><span class="legend__dot legend__dot--ambar"></span>Cuidado</span>
        <span class="legend__item"><span class="legend__dot legend__dot--rojo"></span>Alerta</span>
      </div>
      <button class="btn btn--primary btn--block" id="cta-sueldo" type="button">
        ${ICON_WALLET} Configurar mi sueldo
      </button>
    </section>`;
}

/* ---- anillo + estado (configurado) ---- */
function gaugeCardHTML(e) {
  const projClase = e.color === 'verde' ? '' : ` gauge-proj--${e.color}`;
  return `
    <section class="card gauge-card">
      <div class="gauge gauge--${e.color}" role="img"
        aria-label="Llevas ${pct(e.porcentajeIngreso)} de tu sueldo gastado. Estado: ${esc(e.etiqueta)}.">
        <svg class="gauge__svg" viewBox="0 0 100 100" aria-hidden="true">
          <circle class="gauge__track" cx="50" cy="50" r="42"></circle>
          <circle class="gauge__arc gauge__arc--fill" cx="50" cy="50" r="42"></circle>
          <circle class="gauge__tick" cx="50" cy="8" r="3"></circle>
        </svg>
        <div class="gauge__center">
          <span class="gauge__hint">Del sueldo</span>
          <span class="gauge__value gauge__value--pct num">${pct(e.porcentajeIngreso)}</span>
          <span class="gauge__caption">${esc(e.mensaje)}</span>
        </div>
      </div>

      <span class="pill pill--${e.color} gauge-state"><span class="pill__dot"></span>${esc(e.etiqueta)}</span>

      <p class="gauge-proj${projClase}">
        Vas a cerrar el mes en <strong class="num">${formatCOP(e.proyeccionTotal)}</strong>
      </p>
    </section>`;
}

function statRowHTML(e) {
  const disp = e.disponibleRestante;
  const dispClase = disp != null && disp < 0 ? ' stat__value--neg' : '';
  return `
    <div class="stat-row">
      <div class="card stat">
        <span class="stat__label">${ICON_DOWN} Disponible</span>
        <span class="stat__value${dispClase} num">${conDivisa(formatCOP(disp))}</span>
        <span class="stat__sub num">${formatCOP(e.disponiblePorDia)} por día</span>
      </div>
      <div class="card stat">
        <span class="stat__label">${ICON_UP} Gastado</span>
        <span class="stat__value num">${conDivisa(formatCOP(e.variableGastado))}</span>
        <span class="stat__sub">variable este mes</span>
      </div>
    </div>`;
}

function fijosCardHTML(e) {
  const hint = e.fijosCreditos > 0
    ? `Incluye <span class="num">${formatCOP(e.fijosCreditos)}</span> de créditos`
    : 'No entran al ritmo variable';
  return `
    <div class="card fijos-card">
      <div>
        <span class="fijos-card__label">Fijos del mes</span>
        <span class="fijos-card__hint">${hint}</span>
      </div>
      <span class="fijos-card__val num">${formatCOP(e.fijosDelMes)}</span>
    </div>`;
}

/* ---- "Tus negocios": ¿cubren sus créditos o los tapa el sueldo? ---- */
function negociosHTML(negocios) {
  if (!negocios.length) return '';
  const filas = negocios.map((n) => {
    const recibido = `<span class="negocio__in num">${formatCOP(n.recibido, { signo: true })}</span>`;
    const esperado = n.esperado != null
      ? `<span class="negocio__esp">esperado <span class="num">${formatCOP(n.esperado)}</span></span>` : '';

    let cobertura = '';
    if (n.cuota != null) {
      const p = Math.max(0, Math.min(100, Math.round((n.cobertura || 0) * 100)));
      cobertura = `
        <div class="negocio__cov">
          <div class="negocio__cov-head">
            <span class="negocio__cred">${esc(n.creditoLabel)}</span>
            <span class="pill pill--${n.color} negocio__pct"><span class="pill__dot"></span>${p}%</span>
          </div>
          <span class="negocio__track"><span class="negocio__fill negocio__fill--${n.color}" data-w="${p}"></span></span>
          <span class="negocio__cov-sub"><span class="num">${formatCOP(n.recibido)}</span> de <span class="num">${formatCOP(n.cuota)}</span> de cuota</span>
        </div>`;
    } else {
      cobertura = '<span class="negocio__nocred">Sin crédito vinculado</span>';
    }

    return `
      <div class="card negocio">
        <div class="negocio__top">
          <span class="negocio__name">${esc(n.nombre)}</span>
          ${recibido}
        </div>
        ${esperado}
        ${cobertura}
      </div>`;
  }).join('');

  return `
    <div class="negocios">
      <div class="section-head"><span class="section-head__title">Tus negocios</span></div>
      <div class="negocio-list">${filas}</div>
    </div>`;
}

function categoriasHTML(e) {
  if (!e.porCategoria.length) return '';
  const top = e.porCategoria.slice(0, 5);
  const maxTotal = top[0].total || 1;
  const filas = top.map((c) => {
    const cat = categoriaPorId(c.categoriaId);
    const w = Math.max(4, Math.round((c.total / maxTotal) * 100));
    // c.pct = parte de esta categoría dentro del gasto VARIABLE del mes.
    return `
      <div class="catbar ${cat.cls}">
        <span class="catbar__ic">${cat.icon}</span>
        <div class="catbar__body">
          <span class="catbar__label">${esc(cat.label)}</span>
          <span class="catbar__track"><span class="catbar__fill" data-w="${w}"></span></span>
        </div>
        <span class="catbar__fig">
          <span class="catbar__amt num">${formatCOP(c.total)}</span>
          <span class="catbar__pct num">${pct(c.pct)}</span>
        </span>
      </div>`;
  }).join('');
  // Proyección del gasto VARIABLE a fin de mes (complementa la total del anillo).
  const proj = e.proyeccionVariable > 0
    ? `<p class="cat-break__proj">A este ritmo cerrarás el mes con <strong class="num">${formatCOP(e.proyeccionVariable)}</strong> en gastos variables</p>`
    : '';
  return `
    <div class="cat-break">
      <div class="section-head"><span class="section-head__title">En qué se va</span></div>
      ${proj}
      <div class="catbar-list">${filas}</div>
      ${hormigaHTML(e)}
    </div>`;
}

function hormigaHTML(e) {
  if (!e.totalHormiga || !e.hormigaCount) return '';
  const n = e.hormigaCount;
  const compras = `${n} compra${n !== 1 ? 's' : ''} pequeña${n !== 1 ? 's' : ''}`;
  const share = e.variableGastado > 0 ? e.totalHormiga / e.variableGastado : null;
  // Insight: cuántas compras "hormiga", su proyección al cierre y qué parte del variable.
  const partes = [];
  if (e.proyeccionHormiga > 0) partes.push(`a este ritmo <strong class="num">${formatCOP(e.proyeccionHormiga)}</strong> al mes`);
  if (share != null) partes.push(`${pct(share)} de tu variable`);
  const sub = partes.length ? `<span class="hormiga-note__sub">${partes.join(' · ')}</span>` : '';
  return `
    <div class="hormiga-note">
      <span class="hormiga-note__ic">${categoriaPorId('hormiga').icon}</span>
      <span class="hormiga-note__bd">
        <span class="hormiga-note__txt">Gasto hormiga · ${compras}</span>
        ${sub}
      </span>
      <span class="hormiga-note__val num">${formatCOP(e.totalHormiga)}</span>
    </div>`;
}

/* Monto compacto para las etiquetas del barchart ($2,3M / $450k / −$300k). */
function fmtCompacto(n) {
  const a = Math.abs(Math.round(n));
  const s = n < 0 ? '−' : '';
  if (a >= 1_000_000) { const v = a / 1_000_000; return `${s}$${v >= 10 ? Math.round(v) : v.toFixed(1).replace('.', ',')}M`; }
  if (a >= 1_000) return `${s}$${Math.round(a / 1_000)}k`;
  return `${s}$${a}`;
}

/* Barchart de AHORRO mes a mes (diverge desde una línea cero: arriba = ahorraste,
   abajo = gastaste de más). Barras neutras; el mes actual en acento. SVG (los
   atributos de geometría no son inline-style → OK con el CSP). */
function ahorroCardHTML(hist) {
  const datos = (hist || []).filter((d) => d.tieneDatos);
  if (datos.length < 2) return '';

  // padTop/padBot dejan aire para las etiquetas de valor (arriba de barras
  // positivas, abajo de negativas) sin que se corten en el viewBox.
  const W = 340, H = 158, padX = 8, padTop = 20, padBot = 20;
  const chartH = H - padTop - padBot;
  const maxPos = Math.max(0, ...datos.map((d) => d.ahorro));
  const maxNeg = Math.max(0, ...datos.map((d) => -d.ahorro));
  const range = (maxPos + maxNeg) || 1;
  const yZero = padTop + (maxPos / range) * chartH;
  const n = datos.length;
  const slot = (W - 2 * padX) / n;
  const barW = Math.min(slot * 0.56, 44);

  const bars = datos.map((d, i) => {
    const cx = padX + slot * i + slot / 2;
    const x = cx - barW / 2;
    const h = Math.max(2, (Math.abs(d.ahorro) / range) * chartH);
    const y = d.ahorro >= 0 ? yZero - h : yZero;
    const barCls = 'ahorro__bar' + (d.esActual ? ' ahorro__bar--now' : '');
    const valCls = 'ahorro__val' + (d.esActual ? ' ahorro__val--now' : '');
    const vy = d.ahorro >= 0 ? y - 5 : y + h + 12;
    return `<rect class="${barCls}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="4"></rect>`
      + `<text class="${valCls}" x="${cx.toFixed(1)}" y="${vy.toFixed(1)}" text-anchor="middle">${esc(fmtCompacto(d.ahorro))}</text>`;
  }).join('');
  const zero = `<line class="ahorro__zeroline" x1="${padX}" y1="${yZero.toFixed(1)}" x2="${W - padX}" y2="${yZero.toFixed(1)}"></line>`;
  const labels = datos.map((d) =>
    `<span class="ahorro__lbl${d.esActual ? ' is-now' : ''}">${esc(d.label)}</span>`).join('');

  const actual = datos[datos.length - 1];
  const prom = Math.round(datos.reduce((s, d) => s + d.ahorro, 0) / datos.length);
  const insight = `Este mes ${actual.ahorro >= 0 ? 'ahorras' : 'gastas de más'} <strong>${esc(fmtCompacto(actual.ahorro))}</strong> · promedio ${esc(fmtCompacto(prom))}`;

  return `
    <div class="ahorro">
      <div class="section-head"><span class="section-head__title">Tu ahorro mes a mes</span></div>
      <p class="ahorro__insight">${insight}</p>
      <svg class="ahorro__svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ahorro por mes">
        ${zero}${bars}
      </svg>
      <div class="ahorro__labels">${labels}</div>
    </div>`;
}

/* Contenido de cada pestaña del Hoy. */
function panelHTML(tab, e, negocios, historial, recs) {
  if (tab === 'analytics') return gaugeCardHTML(e) + ahorroCardHTML(historial);
  // dashboard: disponible/gastado + fijos + negocios + en qué se va (+ hormiga)
  return statRowHTML(e) + fijosCardHTML(e) + negociosHTML(negocios) + categoriasHTML(e);
}

/* ---- animaciones (solo transform/opacity/stroke-dashoffset/width) ---- */
function animarAnillo(body, e) {
  const arc = body.querySelector('.gauge__arc--fill');
  if (arc) {
    let fill;
    if (e.fijosSuperanIngreso) fill = 1;
    else if (e.ritmo == null) fill = 0;
    else fill = Math.max(0, Math.min(1, e.ritmo)); // clamp visual a 1
    const target = String(CIRC * (1 - fill));
    arc.style.strokeDasharray = String(CIRC);
    if (prefersReduced) {
      arc.style.strokeDashoffset = target;
    } else {
      arc.style.strokeDashoffset = String(CIRC); // arranca vacío
      void arc.getBoundingClientRect();           // fuerza reflow
      requestAnimationFrame(() => { arc.style.strokeDashoffset = target; });
    }
  }

  // marca de avance: dónde "deberías ir" según el día del mes.
  const tick = body.querySelector('.gauge__tick');
  if (tick && Number.isFinite(e.avance)) {
    const ang = e.avance * 2 * Math.PI; // 0 = arriba (svg rotado -90)
    tick.setAttribute('cx', String(50 + R * Math.cos(ang)));
    tick.setAttribute('cy', String(50 + R * Math.sin(ang)));
  }
}

function aplicarBarras(body) {
  body.querySelectorAll('.catbar__fill, .negocio__fill').forEach((fill) => {
    const w = fill.dataset.w || '0';
    if (prefersReduced) { fill.style.width = w + '%'; return; }
    requestAnimationFrame(() => { fill.style.width = w + '%'; });
  });
}

/* ---- carga + pintado (async, tolerante a cambios de ruta) ---- */

/* Pinta el contenido de la pestaña activa en el sheet (sin recargar datos). */
function mostrarPanel(root, tab, datos, animar) {
  tabActivo = tab;
  root.querySelectorAll('[data-hoy-tab]').forEach((b) => b.classList.toggle('is-on', b.dataset.hoyTab === tab));
  colocarIndicador(root, animar);
  const body = root.querySelector('#hoy-body');
  if (!body) return;
  if (!datos.estado.configurado) {
    body.innerHTML = sinConfigHTML();
    const cta = body.querySelector('#cta-sueldo');
    if (cta) cta.addEventListener('click', () => abrirSueldo({ onSaved: () => pintar(root) }));
    return;
  }
  body.innerHTML = panelHTML(tab, datos.estado, datos.negocios, datos.historial, datos.recs);
  if (tab === 'analytics') animarAnillo(body, datos.estado);
  aplicarBarras(body);
  const sc = root.closest('.view') || root;
  if (sc) sc.scrollTop = 0; // al cambiar de pestaña, vuelve arriba
}

async function pintar(root) {
  const body = root.querySelector('#hoy-body');
  if (!body) return;

  let estado;
  let negocios = [];
  let historial = [];
  let recs = [];
  let salario = 0;
  let nombre = '';
  let metricaDia = null;
  try {
    const [ingresos, movimientos, recurrentes, creditos, config] = await Promise.all([
      getAll('ingresos'), getAll('movimientos'), getAll('recurrentes'), getAll('creditos'), getConfig(),
    ]);
    const empleo = ingresos.find((i) => i && i.fuente === 'empleo');
    const fuentes = ingresos.filter((i) => i && i.fuente !== 'empleo');
    const hoy = new Date();
    salario = empleo ? empleo.monto : 0;
    nombre = (config && config.nombre) ? config.nombre : '';
    estado = calcularEstado({ ingresoEmpleo: salario, movimientos, recurrentes, creditos, hoy, config });
    negocios = resumenNegocios({ fuentes, movimientos, creditos, hoy });
    historial = historialAhorro({ movimientos, ingresoEmpleo: salario, hoy, meses: 6 });
    recs = recurrentes || [];
    metricaDia = metricaHoy(movimientos, hoy);
  } catch (err) {
    console.warn('[Bolsillo] no se pudo calcular el estado de Hoy:', err);
    body.innerHTML = '<p class="hoy-error">No se pudieron cargar tus datos. Reintenta.</p>';
    return;
  }

  if (!root.isConnected) return; // el usuario ya cambió de vista

  // "Tu dinero" = saldoDisponible: la plata que ENTRÓ este mes (sueldo + ingresos)
  // menos TODO lo que llevas gastado. Arranca en el total (el sueldo completo) y
  // baja con cada gasto, sube con cada ingreso — por eso rueda. No pre-descuenta
  // los fijos presupuestados: el descuento se ve suceder sobre el monto total.
  const balEl = root.querySelector('#hoy-balance');
  if (balEl) {
    const saldoActual = (estado && estado.configurado && Number.isFinite(estado.saldoDisponible))
      ? estado.saldoDisponible : null;
    if (saldoActual == null) {
      balEl.innerHTML = '—';
    } else if (saldoMostrado != null && saldoMostrado !== saldoActual && !prefersReduced) {
      animarSaldo(balEl, saldoMostrado, saldoActual); // rueda desde el valor previo
    } else {
      balEl.innerHTML = conDivisa(formatCOP(saldoActual)); // primer pintado o sin motion
    }
    saldoMostrado = saldoActual;
  }

  // Métrica del día bajo el balance (neto de hoy: verde entra / rojo se gasta).
  const deltaEl = root.querySelector('#hoy-daydelta');
  if (deltaEl) {
    deltaEl.className = 'bcard__delta ' + deltaClaseHoy(metricaDia);
    deltaEl.innerHTML = deltaInnerHoy(metricaDia);
  }

  // Personalización: nombre real (del onboarding) en saludo + iniciales del avatar.
  const nom = String(nombre || '').trim();
  const nameEl = root.querySelector('#hoy-name');
  if (nameEl) nameEl.textContent = (nom ? nom + ' ' : '') + saludoInfo().emoji;

  const datos = { estado, negocios, historial, recs };
  root.querySelectorAll('[data-hoy-tab]').forEach((b) => {
    b.addEventListener('click', () => mostrarPanel(root, b.dataset.hoyTab, datos, true));
  });
  mostrarPanel(root, tabActivo, datos, false);
}

export default {
  label: 'Hoy',

  render() {
    return `
      ${greetHTML('')}
      ${balanceCardHTML(saldoMostrado)}
      ${tabsHTML()}
      <div class="hoy-body" id="hoy-body"><div class="hoy-skeleton" aria-hidden="true"></div></div>`;
  },

  mount(root) {
    const bell = root.querySelector('#hoy-bell');
    if (bell) bell.addEventListener('click', () => document.dispatchEvent(new CustomEvent('bolsillo:notif')));
    const search = root.querySelector('#hoy-search');
    if (search) search.addEventListener('click', () => {
      try { sessionStorage.setItem('bolsillo:openSearch', '1'); } catch { /* noop */ }
      location.hash = '#/movimientos';
    });
    pintar(root); // async, no bloquea el primer render
  },
};
