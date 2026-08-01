/* ============================================================
   Bolsillo · app.js
   Bootstrap: navegación por hash entre vistas, FAB/sheet,
   siembra de cuentas, materialización de recurrentes y SW.
   ============================================================ */

import dashboard from './views/dashboard.js';
import personas from './views/personas.js';
import movimientos from './views/movimientos.js';
import perfil from './views/perfil.js';
import registrar from './views/registrar.js';
import asesor from './views/asesor.js';           // chat "voz de conciencia" (se llega desde el orbe de Hoy)
import { susurrar } from './susurro.js';           // susurro cruado tras registrar un gasto
import { sugerirFijo } from './reconciliacion.js'; // ¿el gasto manual es el pago de un fijo pendiente?
import { mostrarVinculo } from './vincular-chip.js';
import { toast } from './toast.js';
// Ocultas en el piloto (se re-agregan a ROUTES + tab bar cuando estén listas):
// import creditos from './views/creditos.js';  // CRUD real vive en Perfil → Créditos
import { abrirOnboarding, debeMostrarse } from './views/onboarding.js';
import { openDB, getConfig, saveConfig, getAll, get, put, bulkPut } from './db.js';
import { materializarMes } from './recurring.js';
import { migrarIngresos, ingresoNecesitaMigracion, crearMovimiento, actualizar } from './model.js';
import { aplicarPersonalizacion, categoriaPorId } from './categories.js';
import { calcularEstado, resumenPersonas, TOPES_PERSONA_DEFAULT, VIGILADOS_DEFAULT } from './budget.js';
import { parseCOP, formatCOP } from './money.js';
import { bindMontosVivos } from './money-input.js';
import { hoja } from './overlay.js';
import { esc } from './html.js';

const CUENTAS_SEMILLA = ['Efectivo', 'Nequi', 'Bancolombia'];

const ROUTES = {
  hoy: dashboard,
  personas,
  movimientos,
  perfil,
  asesor,   // no es tab: se llega por el orbe del header de Hoy (#/asesor).
  // creditos: oculta en el piloto. Sin entrada aquí, su hash cae a DEFAULT_ROUTE.
};

const DEFAULT_ROUTE = 'hoy';
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const stage = document.getElementById('view-stage');
const tabbar = document.getElementById('tabbar');
const headerTitleEl = document.getElementById('header-title');

let currentRoute = null;

/* ---- routing ---- */
function routeFromHash() {
  const raw = (location.hash || '').replace(/^#\/?/, '').trim();
  return ROUTES[raw] ? raw : DEFAULT_ROUTE;
}

function buildView(routeId) {
  const mod = ROUTES[routeId];
  const el = document.createElement('section');
  el.className = 'view';
  el.dataset.route = routeId;
  el.setAttribute('role', 'tabpanel');
  el.setAttribute('aria-label', mod.label || routeId);

  const inner = document.createElement('div');
  inner.className = 'view-inner';
  inner.innerHTML = mod.render();
  el.appendChild(inner);

  if (typeof mod.mount === 'function') mod.mount(inner);
  return el;
}

function navigate(routeId, { replace = false } = {}) {
  if (routeId === currentRoute) return;

  const incoming = buildView(routeId);
  const outgoing = stage.querySelector('.view.is-active');

  // entra desde abajo
  incoming.classList.add('is-entering');
  stage.appendChild(incoming);

  // reflow para asegurar la transición
  void incoming.offsetWidth;

  incoming.classList.remove('is-entering');
  incoming.classList.add('is-active');
  incoming.scrollTop = 0;
  resetNav();

  if (outgoing) {
    outgoing.classList.remove('is-active');
    outgoing.classList.add('is-leaving');
    const cleanup = () => outgoing.remove();
    if (prefersReduced) {
      cleanup();
    } else {
      outgoing.addEventListener('transitionend', cleanup, { once: true });
      // salvaguarda por si no dispara transitionend
      setTimeout(cleanup, 500);
    }
  }

  currentRoute = routeId;
  syncTabbar(routeId);
  // marca la ruta en <body> (Hoy oculta el header global y va full-bleed)
  document.body.dataset.route = routeId;
  // título compacto del header (aparece al condensar en scroll)
  if (headerTitleEl) headerTitleEl.textContent = ROUTES[routeId].label || routeId;

  if (replace) {
    history.replaceState(null, '', '#/' + routeId);
  }
  document.title = 'Bolsillo · ' + (ROUTES[routeId].label || routeId);
  refrescarBadge(); // el badge vive en el header global Y en la campana del hero de Hoy
}

function syncTabbar(routeId) {
  tabbar.querySelectorAll('.tab').forEach((tab) => {
    const active = tab.dataset.route === routeId;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-current', active ? 'page' : 'false');
  });
}

/* Re-renderiza en sitio la vista activa (tras guardar/borrar/materializar). */
function refreshActive(routeId) {
  if (currentRoute !== routeId) return;
  const view = stage.querySelector('.view.is-active');
  const inner = view && view.querySelector('.view-inner');
  const mod = ROUTES[routeId];
  if (!inner || !mod) return;
  inner.innerHTML = mod.render();
  if (typeof mod.mount === 'function') mod.mount(inner);
}

/* ---- tab bar ---- */
function initTabbar() {
  tabbar.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      location.hash = '#/' + tab.dataset.route;
    });
  });
}

/* ---- nav colapsable al hacer scroll: al bajar se resume (sin labels, más
   angosta) para dejar más espacio; al subir vuelve a expandirse ---- */
let navLastTop = 0;
let navMin = false;
let headerP = -1;
const HEADER_RAMP = 64; // px de scroll para esmerilar el header del todo
function setNavMin(on) {
  if (on === navMin) return;
  navMin = on;
  document.body.classList.toggle('nav-min', on);
}
/* header: el frost + el título compacto APARECEN de forma gradual, ligados al
   scroll (0 en el tope → 1 tras HEADER_RAMP px). Suave, sin el salto binario. */
function setHeaderProgress(top) {
  const q = Math.round(Math.max(0, Math.min(1, top / HEADER_RAMP)) * 100) / 100;
  if (q === headerP) return;
  headerP = q;
  document.body.style.setProperty('--header-p', String(q));
}
function onStageScroll(e) {
  const el = e.target;
  if (!el || !el.classList || !el.classList.contains('view')) return;
  const top = el.scrollTop;
  setHeaderProgress(top);                            // header: aparece gradual con el scroll
  if (top < 48) setNavMin(false);                   // cerca del tope: expandida
  else if (top - navLastTop > 6) setNavMin(true);    // bajando: resumida
  else if (navLastTop - top > 6) setNavMin(false);   // subiendo: expandida
  navLastTop = top;
}
function resetNav() { navLastTop = 0; setNavMin(false); setHeaderProgress(0); }

/* ---- header: la campana abre el centro de notificaciones ---- */
function initHeader() {
  const bell = document.getElementById('open-notif');
  if (bell) bell.addEventListener('click', () => { abrirNotificaciones(); });
  // la campana del hero de Hoy (otra vista) pide abrir el centro por evento
  document.addEventListener('bolsillo:notif', () => { abrirNotificaciones(); });
}

/* ---- bottom sheet: Registrar ---- */
function initSheet() {
  const scrim = document.getElementById('scrim');
  const sheet = document.getElementById('sheet');
  const fab = document.getElementById('fab');

  sheet.innerHTML = registrar.render();

  const open = () => {
    scrim.classList.add('is-open');
    sheet.classList.add('is-open');
    document.body.dataset.sheet = 'open';
  };
  const close = () => {
    scrim.classList.remove('is-open');
    sheet.classList.remove('is-open');
    delete document.body.dataset.sheet;
  };

  registrar.mount(sheet, { open, close, onSaved: (mov) => {
    refreshActive(currentRoute);
    refrescarBadge();
    susurrar(mov);
    if (mov && mov.recurrenteId) {
      // ya se guardó vinculado a un fijo (la app lo reconoció) → recalcula
      // pendientes para apagar el recordatorio; el chip no hace falta.
      correrRecurrentes().catch((err) => console.warn('[Bolsillo] recurrentes:', err));
    } else {
      ofrecerVinculacion(mov);
    }
  } });

  // --- Abanico del FAB: + gira a X y nacen dos burbujas (gasto/ingreso) ---
  const veil = document.getElementById('fab-veil');
  const bGasto = document.getElementById('fab-gasto');
  const bIngreso = document.getElementById('fab-ingreso');
  let radialOpen = false;

  const abrirAbanico = () => {
    radialOpen = true;
    document.body.dataset.fab = 'open';
    fab.setAttribute('aria-expanded', 'true');
    fab.setAttribute('aria-label', 'Cerrar');
    [bGasto, bIngreso].forEach((b) => b && b.setAttribute('aria-hidden', 'false'));
  };
  const cerrarAbanico = () => {
    if (!radialOpen) return;
    radialOpen = false;
    delete document.body.dataset.fab;
    fab.setAttribute('aria-expanded', 'false');
    fab.setAttribute('aria-label', 'Registrar movimiento');
    [bGasto, bIngreso].forEach((b) => b && b.setAttribute('aria-hidden', 'true'));
  };
  const elegirTipo = (tipo) => { cerrarAbanico(); registrar.abrir(null, tipo); };

  fab.addEventListener('click', () => (radialOpen ? cerrarAbanico() : abrirAbanico()));
  if (bGasto) bGasto.addEventListener('click', () => elegirTipo('gasto'));
  if (bIngreso) bIngreso.addEventListener('click', () => elegirTipo('ingreso'));
  if (veil) veil.addEventListener('click', cerrarAbanico);

  scrim.addEventListener('click', () => registrar.cerrar());
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (radialOpen) { cerrarAbanico(); return; }
    if (sheet.classList.contains('is-open')) registrar.cerrar();
  });
}

/* ---- datos: siembra de cuentas + materialización de recurrentes ---- */
async function initData() {
  await openDB();
  let cfg = await getConfig();
  if (!Array.isArray(cfg.cuentas) || cfg.cuentas.length === 0) {
    cfg = await saveConfig({ cuentas: CUENTAS_SEMILLA });
  }

  // Migración retrocompatible de fuentes de ingreso (negocio1/negocio2 → negocio
  // con nombre legible). Idempotente: solo escribe si hay slots viejos.
  await migrarIngresosSiHace();

  // Limpieza one-shot de la siembra vieja de nombres de personas. Builds previos
  // ESCRIBÍAN Antonella/Marley/Madre en categoriasRenombradas; ya no se siembran,
  // pero quedaron guardados en los dispositivos que abrieron esas versiones.
  const renAntes = JSON.stringify(cfg.categoriasRenombradas || {});
  cfg = await limpiarSiembraPersonal(cfg);
  const limpiezaCambio = JSON.stringify(cfg.categoriasRenombradas || {}) !== renAntes;

  // El catálogo de categorías refleja los renombres y las categorías propias.
  const personalizado = (cfg.categoriasPersonalizadas || []).length > 0
    || Object.keys(cfg.categoriasRenombradas || {}).length > 0;
  aplicarPersonalizacion(cfg);
  if (personalizado || limpiezaCambio) refreshActive(currentRoute); // repinta con las etiquetas ya limpias

  // (Sin siembra de datos personales. Las personas quedan como "Persona 1/2/3"
  // hasta que el usuario las renombre, y no se precarga ninguna cuenta/tarjeta:
  // cada quien arma su Bolsillo desde cero. Las únicas cuentas por defecto son
  // las genéricas de CUENTAS_SEMILLA arriba, editables en el onboarding.)

  // Primer arranque: guía de inicio antes que nada.
  const ingresos = await getAll('ingresos');
  if (debeMostrarse(cfg, ingresos)) {
    abrirOnboarding({
      onDone: () => {
        refreshActive('hoy');
        correrRecurrentes().catch((err) => console.warn('[Bolsillo] recurrentes:', err));
      },
    });
    return; // no materializamos por debajo de la guía
  }

  await correrRecurrentes();
}

/* Migra solo las fuentes viejas (idempotente): no reescribe empleo ni las ya
   nuevas, así una recarga no vuelve a tocar los datos reales de el usuario. */
async function migrarIngresosSiHace() {
  try {
    const ingresos = await getAll('ingresos');
    const pendientes = ingresos.filter(ingresoNecesitaMigracion);
    if (!pendientes.length) return;
    const migrados = migrarIngresos(pendientes);
    await bulkPut('ingresos', migrados);
    console.info(`[Bolsillo] migradas ${migrados.length} fuente(s) de ingreso a la forma nueva.`);
    // La vista de Hoy pudo pintarse antes de migrar: repíntala con los datos nuevos.
    refreshActive(currentRoute);
  } catch (err) {
    console.warn('[Bolsillo] no se pudo migrar ingresos:', err);
  }
}

async function correrRecurrentes() {
  const now = new Date();
  const [recs, movs, cfg] = await Promise.all([
    getAll('recurrentes'), getAll('movimientos'), getConfig(),
  ]);
  const { auto, porConfirmar } = materializarMes(recs, movs, now.getFullYear(), now.getMonth() + 1, now, cfg);
  if (auto.length) {
    await bulkPut('movimientos', auto);
    refreshActive('movimientos');
  }
  // Sin popup automático: los pendientes viven en la campana (no molesta al arrancar).
  pendientesFijos = porConfirmar;
  await refrescarBadge();
}

/* Tras guardar un GASTO manual, ofrece vincularlo con el fijo pendiente que
   parezca corresponderle (Sura, arriendo, etc.). Vincular = ponerle el
   recurrenteId → el recordatorio se apaga y deja de contarse doble. No-op si no
   hay match claro; nunca molesta si el gasto ya está vinculado o es ingreso. */
async function ofrecerVinculacion(mov) {
  if (!mov || mov.tipo !== 'gasto' || mov.recurrenteId) return;
  let recs;
  let movs;
  try {
    [recs, movs] = await Promise.all([getAll('recurrentes'), getAll('movimientos')]);
  } catch { return; }
  const fijo = sugerirFijo({ gasto: mov, recurrentes: recs, movimientos: movs, hoy: new Date() });
  if (!fijo) return;
  mostrarVinculo({
    nombre: fijo.nombre,
    onVincular: async () => {
      try {
        const orig = await get('movimientos', mov.id);
        if (!orig) return;
        // Queda como EL pago del fijo: se le enlaza y pasa a fijo (nunca hormiga).
        const upd = actualizar(orig, { recurrenteId: fijo.id, esFijo: true, esHormiga: false });
        await put('movimientos', upd);
        toast('Vinculado a ' + fijo.nombre);
        await correrRecurrentes();   // recomputa pendientes → el recordatorio se apaga
        refreshActive(currentRoute); // repinta Hoy (saldo/fijos/variable al día)
      } catch {
        toast('No se pudo vincular', { icono: false });
      }
    },
  });
}

/* ---- notificaciones (campana) ---- */
let pendientesFijos = []; // gastos fijos por registrar este mes

/* Señal de "cancelar TODO el flujo" (X / tap-fuera / Escape), distinta de
   "Omitir" (saltar solo este), para pedirMontoVariable. */
const CANCELAR = Symbol('cancelar');

const ICON_X =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg>';

/** Limpia UNA sola vez los nombres de persona que sembraban los builds viejos
 *  (Antonella/Marley/Madre), para que vuelvan a "Persona 1/2/3" sin borrar los
 *  renombres propios del usuario. Solo elimina la entrada si su valor ACTUAL
 *  sigue siendo EXACTO el sembrado (un renombre a otra cosa no se toca), y se
 *  marca hecha con un flag para no re-correr: si luego el usuario nombra a
 *  alguien "Madre" a propósito, ya no se borra. */
async function limpiarSiembraPersonal(cfg) {
  if (cfg && cfg.siembraPersonalLimpiada === true) return cfg;
  const SEMBRADOS = { persona1: 'Antonella', persona2: 'Marley', persona3: 'Madre' };
  const ren = { ...((cfg && cfg.categoriasRenombradas) || {}) };
  for (const [id, val] of Object.entries(SEMBRADOS)) {
    if (ren[id] === val) delete ren[id];
  }
  return saveConfig({ categoriasRenombradas: ren, siembraPersonalLimpiada: true });
}

/** Alertas de gasto por persona/categoría (ámbar o rojo) del mes actual. */
async function recolectarAlertas() {
  try {
    const [movs, ingresos, recs, creds, cfg] = await Promise.all([
      getAll('movimientos'), getAll('ingresos'), getAll('recurrentes'), getAll('creditos'), getConfig(),
    ]);
    const empleo = ingresos.find((i) => i && i.fuente === 'empleo') || null;
    const hoy = new Date();
    const estado = calcularEstado({
      ingresoEmpleo: empleo ? empleo.monto : null,
      movimientos: movs, recurrentes: recs, creditos: creds, hoy, config: cfg,
    });
    if (!estado.configurado) return [];
    const vigilados = VIGILADOS_DEFAULT.map((id) => ({ id, label: categoriaPorId(id).label }));
    const topes = { ...TOPES_PERSONA_DEFAULT, ...(cfg.topesPersona || {}) };
    const filas = resumenPersonas({ movimientos: movs, vigilados, netoDelMes: estado.plataDelMes, topes, hoy });
    return filas.filter((f) => f.color === 'ambar' || f.color === 'rojo');
  } catch (err) {
    console.warn('[Bolsillo] no se pudieron leer alertas:', err);
    return [];
  }
}

/** Actualiza el badge de la campana: pendientes fijos + alertas de personas. */
async function refrescarBadge() {
  const badges = document.querySelectorAll('.notif-badge');
  if (!badges.length) return;
  const alertas = await recolectarAlertas();
  const total = pendientesFijos.length + alertas.length;
  badges.forEach((badge) => {
    if (total > 0) { badge.textContent = String(total); badge.hidden = false; }
    else { badge.hidden = true; }
  });
}

/** Centro de notificaciones (hoja): pendientes por registrar + alertas. */
async function abrirNotificaciones() {
  const alertas = await recolectarAlertas();
  const pend = pendientesFijos;
  const vacio = pend.length === 0 && alertas.length === 0;

  const alertaItem = (a) => {
    const cls = a.color === 'rojo' ? 'rojo' : 'ambar';
    const topePct = Math.round(a.topeFrac * 100);
    const vaPct = Math.round(a.pctIngreso * 100);
    const msg = a.color === 'rojo'
      ? `<strong>${esc(a.label)}</strong>: pasaste tu tope del ${topePct}% (vas en ${vaPct}%)`
      : `<strong>${esc(a.label)}</strong>: cerca del tope del ${topePct}% (vas en ${vaPct}%)`;
    return `<div class="notif-item notif-item--${cls}"><span class="notif-item__dot"></span><p>${msg}</p></div>`;
  };

  const pendBloque = pend.length ? `
    <div class="notif-group">
      <p class="notif-group__label">Por registrar</p>
      <div class="notif-item notif-item--ambar"><span class="notif-item__dot"></span>
        <p>Tienes <strong>${pend.length}</strong> gasto${pend.length > 1 ? 's' : ''} fijo${pend.length > 1 ? 's' : ''} por registrar este mes.</p></div>
      <button type="button" class="btn btn--primary btn--block" data-n="reg">Registrarlos ahora</button>
    </div>` : '';

  const alertaBloque = alertas.length ? `
    <div class="notif-group">
      <p class="notif-group__label">Alertas de personas</p>
      ${alertas.map(alertaItem).join('')}
    </div>` : '';

  const html = `
    <div class="ov-grip" aria-hidden="true"></div>
    <button type="button" class="icon-btn ov-close" data-n="close" aria-label="Cerrar">${ICON_X}</button>
    <h3 class="ov-title ov-title--menu">Notificaciones</h3>
    ${vacio ? '<p class="ov-text">Todo al día. Sin pendientes ni alertas por ahora.</p>' : ''}
    ${pendBloque}
    ${alertaBloque}`;

  hoja(html, (panel, cerrar) => {
    const reg = panel.querySelector('[data-n="reg"]');
    if (reg) reg.addEventListener('click', async () => {
      cerrar();
      const tanda = pendientesFijos;
      pendientesFijos = [];
      await confirmarPendientes(tanda);
      await refrescarBadge();
    });
    panel.querySelector('[data-n="close"]').addEventListener('click', () => cerrar());
  });
}

/**
 * Confirma la tanda pendiente del mes:
 *  - EXACTOS (movimientos ya armados) → se guardan directo.
 *  - VALOR VARIABLE (solicitudes con pediMonto:true) → se pregunta el valor real
 *    de este mes (pre-llenado con el estimado) y recién ahí se crea el movimiento.
 */
async function confirmarPendientes(pendientes) {
  const directos = pendientes.filter((p) => p.pediMonto !== true);
  const variables = pendientes.filter((p) => p.pediMonto === true);
  try {
    if (directos.length) await bulkPut('movimientos', directos);
    for (let i = 0; i < variables.length; i++) {
      const sol = variables[i];
      const monto = await pedirMontoVariable(sol);
      // X / tap-fuera / Escape → corta TODO el resto; los que faltan vuelven a
      // quedar pendientes (no obligamos a Omitir uno por uno).
      if (monto === CANCELAR || monto === undefined) {
        pendientesFijos = variables.slice(i);
        break;
      }
      if (!Number.isInteger(monto) || monto <= 0) continue; // "Omitir": salta solo este
      const mov = crearMovimiento({
        fecha: sol.fecha, monto, tipo: 'gasto',
        categoria: sol.categoria || '', comercio: sol.comercio || '',
        cuenta: sol.cuenta, fuente: 'recurrente', esFijo: true,
        recurrenteId: sol.recurrenteId,
      });
      await bulkPut('movimientos', [mov]);
    }
    refreshActive('movimientos');
    refreshActive('hoy');
  } catch (err) {
    console.warn('[Bolsillo] confirmar recurrentes:', err);
  }
}

/**
 * Mini-hoja "¿Cuánto fue [nombre] este mes?" para un fijo de valor variable.
 * Resuelve el entero de pesos tecleado, o null si el usuario lo omite.
 */
function pedirMontoVariable(sol) {
  const nombre = sol.comercio || 'este gasto fijo';
  const sugerido = Number.isInteger(sol.montoEstimado) && sol.montoEstimado > 0
    ? formatCOP(sol.montoEstimado).replace('$', '') : '';
  const html = `
    <div class="ov-grip" aria-hidden="true"></div>
    <button type="button" class="icon-btn ov-close" data-ov="cancel" aria-label="Cerrar">${ICON_X}</button>
    <h3 class="ov-title ov-title--menu">¿Cuánto fue ${esc(nombre)} este mes?</h3>
    <p class="ov-text">Escribe el valor real de este mes. Puedes omitirlo si aún no lo sabes.</p>
    <label class="field">
      <span class="field__label">Monto de este mes</span>
      <input class="field__input" id="rec-var-monto" type="text" data-monto inputmode="numeric"
        autocomplete="off" placeholder="${sugerido ? '' : 'Ej. 120.000'}" value="${esc(sugerido)}" />
    </label>
    <div class="ov-actions">
      <button type="button" class="btn btn--ghost btn--block" data-ov="skip">Omitir</button>
      <button type="button" class="btn btn--primary btn--block" data-ov="save">Guardar</button>
    </div>`;
  return hoja(html, (panel, cerrar) => {
    bindMontosVivos(panel);
    const input = panel.querySelector('#rec-var-monto');
    requestAnimationFrame(() => input && input.focus());
    const guardar = () => {
      const v = parseCOP(input.value);
      cerrar(Number.isInteger(v) && v > 0 ? v : null);
    };
    panel.querySelector('[data-ov="save"]').addEventListener('click', guardar);
    panel.querySelector('[data-ov="skip"]').addEventListener('click', () => cerrar(null));
    panel.querySelector('[data-ov="cancel"]').addEventListener('click', () => cerrar(CANCELAR));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); guardar(); } });
  });
}

/* ---- Service Worker (ruta relativa, funciona bajo subpath) ---- */
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(
      (reg) => console.info('[Bolsillo] SW registrado, scope:', reg.scope),
      (err) => console.warn('[Bolsillo] SW no registrado:', err),
    );
  });
}

/* ---- init ---- */
function boot() {
  initTabbar();
  initHeader();
  initSheet();

  // Scroll dentro de las vistas → colapsa/expande la barra (captura, no burbujea).
  stage.addEventListener('scroll', onStageScroll, { passive: true, capture: true });

  window.addEventListener('hashchange', () => navigate(routeFromHash()));

  // Al vincular un gasto con su fijo desde Movimientos, recalculamos pendientes
  // (así el recordatorio de la campana se apaga sin recargar la app).
  window.addEventListener('bolsillo:recurrentes-cambiaron', () => {
    correrRecurrentes().catch((err) => console.warn('[Bolsillo] recurrentes:', err));
  });

  const start = routeFromHash();
  navigate(start, { replace: true });

  registerSW();

  // datos (async, no bloquea el primer render)
  initData().catch((err) => console.warn('[Bolsillo] initData falló:', err));
}

boot();
