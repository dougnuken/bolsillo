/* ============================================================
   Bolsillo · app.js
   Bootstrap: navegación por hash entre vistas, FAB/sheet y
   registro del Service Worker. Sin lógica de datos (llega en T2).
   ============================================================ */

import dashboard from './views/dashboard.js';
import movimientos from './views/movimientos.js';
import creditos from './views/creditos.js';
import asesor from './views/asesor.js';
import ajustes from './views/ajustes.js';
import registrar from './views/registrar.js';

const ROUTES = {
  hoy: dashboard,
  movimientos,
  creditos,
  asesor,
  ajustes,
};

const DEFAULT_ROUTE = 'hoy';
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const stage = document.getElementById('view-stage');
const tabbar = document.getElementById('tabbar');

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

  if (replace) {
    history.replaceState(null, '', '#/' + routeId);
  }
  document.title = 'Bolsillo · ' + (ROUTES[routeId].label || routeId);
}

function syncTabbar(routeId) {
  tabbar.querySelectorAll('.tab').forEach((tab) => {
    const active = tab.dataset.route === routeId;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-current', active ? 'page' : 'false');
  });
}

/* ---- tab bar ---- */
function initTabbar() {
  tabbar.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      location.hash = '#/' + tab.dataset.route;
    });
  });
}

/* ---- header: acceso a Ajustes ---- */
function initHeader() {
  const settingsBtn = document.getElementById('open-ajustes');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      location.hash = '#/ajustes';
    });
  }
}

/* ---- bottom sheet: Registrar (placeholder) ---- */
function initSheet() {
  const scrim = document.getElementById('scrim');
  const sheet = document.getElementById('sheet');
  const fab = document.getElementById('fab');
  const closeEls = [scrim, document.getElementById('sheet-close')].filter(Boolean);

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

  fab.addEventListener('click', open);
  closeEls.forEach((el) => el.addEventListener('click', close));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sheet.classList.contains('is-open')) close();
  });

  if (typeof registrar.mount === 'function') registrar.mount(sheet, { close });
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

  window.addEventListener('hashchange', () => navigate(routeFromHash()));

  const start = routeFromHash();
  navigate(start, { replace: true });

  registerSW();
}

boot();
