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
import productos from './views/productos.js';      // cartera (no es tab: se llega desde la card de Hoy, #/productos)
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
import { calcularEstado, resumenPersonas, alertasPresupuesto, TOPES_PERSONA_DEFAULT, VIGILADOS_DEFAULT } from './budget.js';
import { parseCOP, formatCOP } from './money.js';
import { alertasDePago, textoAlerta } from './alertas-pago.js';
import { emparejarProductos } from './diferidos.js';
import { hoyISO, fechaCorta } from './fechas.js';
import { bindMontosVivos } from './money-input.js';
import { hoja, menu } from './overlay.js';
import { iniciarViewport } from './viewport.js';
import { smsDelHash } from './sms-banco.js';
import { esc } from './html.js';
import { agruparNotificaciones, resumenNotificaciones, tituloTramo, AHORA, PRONTO } from './notificaciones.js';

const CUENTAS_SEMILLA = ['Efectivo', 'Nequi', 'Bancolombia'];

const ROUTES = {
  hoy: dashboard,
  personas,
  movimientos,
  perfil,
  asesor,     // no es tab: se llega por el orbe del header de Hoy (#/asesor).
  productos,  // no es tab: se llega por la card "Mis productos" de Hoy (#/productos).
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
  const raw = (location.hash || '').replace(/^#\/?/, '').split('?')[0].trim();
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
  // Título compacto del header (aparece al condensar en scroll). Una vista
  // puede dar el suyo propio: Hoy muestra el saludo en vez de "Hoy", que es lo
  // que estaba justo encima antes de colapsarse.
  if (headerTitleEl) {
    const vista = ROUTES[routeId];
    const propio = typeof vista.tituloHeader === 'function' ? vista.tituloHeader() : '';
    headerTitleEl.textContent = propio || vista.label || routeId;
  }

  if (replace) {
    history.replaceState(null, '', '#/' + routeId);
  }
  document.title = 'Bolsillo · ' + (ROUTES[routeId].label || routeId);
  refrescarBadge(); // el badge vive en el header global Y en la campana del hero de Hoy
  // Tras el layout de la vista recién montada: antes los rects son los de la
  // vista anterior, o cero.
  viajesMedidos = false;
  requestAnimationFrame(medirViajesHeader);
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
  /* El mismo progreso, con curva. --header-p va crudo porque sigue el dedo y
     ahí mandar una curva sería mentirle al scroll; pero las OPACIDADES con
     progreso lineal se sienten planas: el header aparece a ritmo constante en
     vez de asentarse. Este ease-out (1-(1-q)²) hace que se materialice pronto
     y luego afine, que es como se lee un objeto que llega a su sitio.
     Se calcula una vez aquí y no en cada regla: así todas las piezas comparten
     exactamente el mismo ritmo, que es lo que las hace ir a una. */
  const e = 1 - (1 - q) * (1 - q);
  document.body.style.setProperty('--header-e', String(Math.round(e * 100) / 100));
  // Bandera binaria además del progreso: la opacidad se puede interpolar, pero
  // `pointer-events` no. Sin esto, los botones del header colapsado siguen
  // capturando toques mientras están invisibles, encima de los del hero.
  // Umbral en la mitad de la rampa: por encima el header ya se lee como puesto.
  // Más alto arriesga dejar botones visibles pero inertes si el scroll se queda
  // corto; más bajo los activa cuando todavía se ven fantasma sobre el hero.
  document.body.classList.toggle('header-fijo', q >= 0.5);
}
/* En Hoy, las acciones del hero no se apagan donde están: VIAJAN hasta el sitio
   que ocupan en el header colapsado, y ahí las releva el botón que ya estaba
   debajo. El orbe llega al orbe; buscar y la campana convergen en el botón de
   más, que es justo donde se pliegan.

   Solo se mide el desplazamiento lateral: el vertical ya lo pone el scroll —el
   hero sube mientras el header se queda—, así que animarlo también sería
   duplicar un movimiento que la página hace sola. */
const VIAJES_HEADER = Object.freeze([
  ['#hoy-asesor', '#hdr-orbe'],
  ['#hoy-search', '#hdr-mas'],
  ['#hoy-bell', '#hdr-mas'],
]);

/* Se pone en false al cambiar de ruta y en true cuando la medida es buena. Al
   navegar, el rAF puede llegar antes de que el hero exista —el splash del cold
   start entra justo ahí— y entonces no hay rects que medir; sin este reintento
   el viaje se quedaba en cero para toda la sesión. */
let viajesMedidos = false;

function medirViajesHeader() {
  if (document.body.dataset.route !== 'hoy') return;
  let alguno = false;
  for (const [origenSel, destinoSel] of VIAJES_HEADER) {
    const origen = document.querySelector(origenSel);
    const destino = document.querySelector(destinoSel);
    if (!origen || !destino) continue;
    const o = origen.getBoundingClientRect();
    const d = destino.getBoundingClientRect();
    if (!o.width || !d.width) continue;
    // El origen puede estar A MEDIO VIAJE cuando se remide (un resize con la
    // página ya scrolleada), así que se le descuenta lo que lleva andado. Se
    // calcula en vez de borrar la variable para medir: si se borra y la medida
    // aborta después, el botón se queda sin viaje y ya nadie lo repone.
    const andado = (parseFloat(origen.style.getPropertyValue('--viaje-x')) || 0)
      * (parseFloat(getComputedStyle(document.body).getPropertyValue('--header-p')) || 0);
    // De centro a centro: los dos botones no tienen por qué medir lo mismo.
    const dx = (d.left + d.width / 2) - (o.left - andado + o.width / 2);
    origen.style.setProperty('--viaje-x', Math.round(dx) + 'px');
    alguno = true;
  }
  viajesMedidos = alguno;
}

function onStageScroll(e) {
  const el = e.target;
  if (!el || !el.classList || !el.classList.contains('view')) return;
  const top = el.scrollTop;
  // Red de seguridad: si la medida del arranque no cuajó, se toma aquí —el
  // primer scroll es lo antes que el viaje se puede llegar a ver.
  if (!viajesMedidos) medirViajesHeader();
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

  // Header colapsado de Hoy: el orbe se queda a la vista y el resto se pliega.
  const orbe = document.getElementById('hdr-orbe');
  if (orbe) orbe.addEventListener('click', () => { location.hash = '#/asesor'; });

  const mas = document.getElementById('hdr-mas');
  if (mas) {
    mas.addEventListener('click', async () => {
      // El badge vive en este botón cuando la campana está plegada: se anuncia
      // en la propia opción para que el aviso no se pierda dentro del menú.
      const badge = mas.querySelector('.notif-badge');
      const pendientes = badge && !badge.hidden ? ` (${badge.textContent})` : '';
      const elegido = await menu({
        title: 'Más acciones',
        // Los mismos iconos que llevaban los botones antes de plegarse aquí:
        // es lo que deja reconocer que son ellos y no dos opciones nuevas.
        items: [
          { value: 'buscar', label: 'Buscar movimientos', icon: ICON_LUPA },
          { value: 'notif', label: `Notificaciones${pendientes}`, icon: ICON_CAMPANA },
        ],
      });
      if (elegido === 'buscar') location.hash = '#/movimientos';
      else if (elegido === 'notif') abrirNotificaciones();
    });
  }
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
  let fabLongFired = false; // el último gesto del + fue un long-press (→ voz)

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
  const elegirTipo = (tipo) => {
    cerrarAbanico();
    // Gasto: apertura síncrona en el ÚLTIMO método usado (agilidad). Ingreso:
    // directo al formulario de ingreso.
    if (tipo === 'gasto') registrar.abrirGasto();
    else registrar.abrir(null, tipo);
  };

  fab.addEventListener('click', () => {
    if (fabLongFired) { fabLongFired = false; return; } // fue long-press → ya abrió voz
    radialOpen ? cerrarAbanico() : abrirAbanico();
  });
  if (bGasto) bGasto.addEventListener('click', () => elegirTipo('gasto'));
  if (bIngreso) bIngreso.addEventListener('click', () => elegirTipo('ingreso'));
  if (veil) veil.addEventListener('click', cerrarAbanico);

  // Long-press del + → VOZ directa (atajo de agilidad). Se dispara en pointerup
  // (dentro del gesto → iOS permite el micrófono) y suprime el click para no
  // abrir el abanico. Un toque corto sigue abriendo el abanico.
  const LONGPRESS_MS = 450;
  let pressAt = 0, pressX = 0, pressY = 0, pressMoved = false;
  fab.addEventListener('pointerdown', (e) => {
    pressAt = e.timeStamp; pressX = e.clientX; pressY = e.clientY; pressMoved = false; fabLongFired = false;
  });
  fab.addEventListener('pointermove', (e) => {
    if (Math.hypot(e.clientX - pressX, e.clientY - pressY) > 12) pressMoved = true;
  });
  fab.addEventListener('pointerup', (e) => {
    const held = e.timeStamp - pressAt;
    if (pressAt && !pressMoved && !radialOpen && held >= LONGPRESS_MS) {
      fabLongFired = true;       // el click que sigue se ignora
      registrar.dictarRapido();  // abre y arranca el micrófono en este gesto
    }
    pressAt = 0;
  });

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

  // El catálogo de categorías refleja los renombres y las categorías propias.
  const personalizado = (cfg.categoriasPersonalizadas || []).length > 0
    || Object.keys(cfg.categoriasRenombradas || {}).length > 0;
  aplicarPersonalizacion(cfg);
  if (personalizado) refreshActive(currentRoute); // repinta con las etiquetas

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

/* Los del menú de "más acciones" son COPIA EXACTA de los botones que se pliegan
   ahí —la lupa del hero de Hoy y la campana del header—: si el icono no es el
   mismo, la opción no se lee como el botón que desapareció sino como otra cosa. */
const ICON_LUPA =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>';
const ICON_CAMPANA =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8.5a6 6 0 0 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14.5 18 8.5"/><path d="M13.7 20a2 2 0 0 1-3.4 0"/></svg>';

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

/**
 * Categorías que se pasaron de su tope o están cerca.
 * Se configuraban y se pintaban de color en la vista, pero nunca avisaban.
 */
async function recolectarPresupuestos() {
  try {
    const [movs, ingresos, recs, creds, cfg] = await Promise.all([
      getAll('movimientos'), getAll('ingresos'), getAll('recurrentes'), getAll('creditos'), getConfig(),
    ]);
    const empleo = (ingresos || []).find((i) => i && i.fuente === 'empleo') || null;
    const estado = calcularEstado({
      ingresoEmpleo: empleo ? empleo.monto : null,
      movimientos: movs, recurrentes: recs, creditos: creds, hoy: new Date(), config: cfg,
    });
    return alertasPresupuesto(estado.porCategoria);
  } catch (err) {
    console.warn('[olbo] no se pudieron leer los presupuestos:', err);
    return [];
  }
}

/**
 * Pagos que vencen dentro de la ventana de aviso (o ya vencidos).
 * Blindado igual que las otras alertas: si falla la lectura, el resto del
 * centro de notificaciones sigue funcionando.
 */
async function recolectarPagos() {
  try {
    const [creditos, cortes] = await Promise.all([
      getAll('creditos'),
      getAll('cortes').catch(() => []),
    ]);
    const activos = (creditos || []).filter((c) => c && c.activo !== false);
    return alertasDePago({ productos: emparejarProductos(activos, cortes), hoy: hoyISO() });
  } catch (err) {
    console.warn('[olbo] no se pudieron leer los pagos próximos:', err);
    return [];
  }
}

/** Actualiza el badge: pendientes fijos + alertas de personas + pagos. */
async function refrescarBadge() {
  const badges = document.querySelectorAll('.notif-badge');
  if (!badges.length) return;
  const [alertas, pagos, topes] = await Promise.all([
    recolectarAlertas(), recolectarPagos(), recolectarPresupuestos(),
  ]);
  const total = pendientesFijos.length + alertas.length + pagos.length + topes.length;
  badges.forEach((badge) => {
    if (total > 0) { badge.textContent = String(total); badge.hidden = false; }
    else { badge.hidden = true; }
  });
}

/** Centro de notificaciones (hoja): lo urgente arriba, la tarea al final. */
async function abrirNotificaciones() {
  const [alertas, pagos, topes] = await Promise.all([
    recolectarAlertas(), recolectarPagos(), recolectarPresupuestos(),
  ]);
  const pend = pendientesFijos;
  const g = agruparNotificaciones({ pagos, topes, personas: alertas });

  /* Cada fuente sabe decir lo suyo, pero todas caben en la misma fila: qué es,
     qué pasa, y la cifra. Que un pago y un tope se lean igual es el punto — lo
     que los ordena es la urgencia, no de qué familia vienen. */
  const detalleDe = (n) => {
    if (n.fuente === 'pago') {
      return { titulo: n.titulo, detalle: `${textoAlerta(n)} · ${fechaCorta(n.fecha)}`, dato: n.monto != null ? formatCOP(n.monto) : '' };
    }
    if (n.fuente === 'tope') {
      const cat = categoriaPorId(n.categoriaId);
      const pct = Math.round(n.pctTope * 100);
      return n.excedido > 0
        ? { titulo: cat.label, detalle: `te pasaste del tope de ${formatCOP(n.presupuesto)} · vas en ${pct}%`, dato: `+${formatCOP(n.excedido)}` }
        : { titulo: cat.label, detalle: `llevas el ${pct}% del tope de ${formatCOP(n.presupuesto)}`, dato: '' };
    }
    const tope = Math.round(n.topeFrac * 100);
    const va = Math.round(n.pctIngreso * 100);
    return {
      titulo: n.titulo,
      detalle: n.nivel === 'rojo' ? `pasaste tu tope del ${tope}% de tus ingresos` : `cerca del tope del ${tope}% de tus ingresos`,
      dato: `${va}%`,
    };
  };

  const filaHTML = (n) => {
    const d = detalleDe(n);
    return `
      <div class="notif-fila notif-fila--${esc(n.nivel)}">
        <div class="notif-fila__txt">
          <p class="notif-fila__titulo">${esc(d.titulo)}</p>
          <p class="notif-fila__detalle">${esc(d.detalle)}</p>
        </div>
        ${d.dato ? `<span class="notif-fila__dato num">${esc(d.dato)}</span>` : ''}
      </div>`;
  };

  const tramoHTML = (lista, tramo) => (lista.length ? `
    <section class="notif-tramo">
      <p class="notif-tramo__label notif-tramo__label--${tramo === AHORA ? 'rojo' : 'ambar'}">${esc(tituloTramo(tramo))}</p>
      ${lista.map(filaHTML).join('')}
    </section>` : '');

  /* Los fijos por registrar van aparte y al final: no son un aviso sino una
     tarea, la única con botón. Arriba competirían con lo que sí cuesta plata. */
  const tareaHTML = pend.length ? `
    <section class="notif-tarea">
      <p class="notif-tarea__titulo">Te falta registrar ${pend.length} gasto${pend.length > 1 ? 's' : ''} fijo${pend.length > 1 ? 's' : ''}</p>
      <p class="notif-tarea__sub">Del mes en curso. Sin ellos, tu balance se ve mejor de lo que está.</p>
      <button type="button" class="btn btn--primary btn--block" data-n="reg">Registrarlos ahora</button>
    </section>` : '';

  const vacio = !g.hayAlgo && pend.length === 0;
  const html = `
    <div class="ov-grip" aria-hidden="true"></div>
    <button type="button" class="icon-btn ov-close" data-n="close" aria-label="Cerrar">${ICON_X}</button>
    <h3 class="ov-title ov-title--menu">Notificaciones</h3>
    <p class="notif-resumen${vacio ? ' notif-resumen--ok' : ''}">${esc(resumenNotificaciones({ ahora: g.ahora, pronto: g.pronto, pendientes: pend.length }))}</p>
    ${vacio ? '<p class="ov-text">Sin pendientes ni alertas por ahora.</p>' : ''}
    ${tramoHTML(g.ahora, AHORA)}
    ${tramoHTML(g.pronto, PRONTO)}
    ${tareaHTML}`;

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
  // ANTES de montar nada: publica --vp-deficit y las banderas de <html> para
  // que el dock nazca ya en su sitio (medirlo después provocaría un salto).
  iniciarViewport();
  initTabbar();
  initHeader();
  initSheet();

  // Scroll dentro de las vistas → colapsa/expande la barra (captura, no burbujea).
  stage.addEventListener('scroll', onStageScroll, { passive: true, capture: true });

  window.addEventListener('hashchange', () => navigate(routeFromHash()));

  // El viaje de las acciones del hero se mide en px, así que cambia con el
  // ancho: rotar el teléfono o abrir el teclado lo invalida.
  window.addEventListener('resize', () => {
    requestAnimationFrame(medirViajesHeader);
  }, { passive: true });

  // Al vincular un gasto con su fijo desde Movimientos, recalculamos pendientes
  // (así el recordatorio de la campana se apaga sin recargar la app).
  window.addEventListener('bolsillo:recurrentes-cambiaron', () => {
    correrRecurrentes().catch((err) => console.warn('[Bolsillo] recurrentes:', err));
  });

  // Deep link del Atajo de iOS: #/registrar?sms=<texto codificado>. iOS no deja
  // que ninguna web lea Mensajes, así que el Atajo trae el SMS por la URL.
  // Se LEE y se LIMPIA el hash ya (para que un refresco no lo repita), pero la
  // hoja se abre al final: durante el arranque hay repintados de ruta que la
  // cerrarían, y además así `cfg` ya está cargada y puede acertar cuenta y
  // categoría.
  const smsInicial = smsDelHash(location.hash);
  if (smsInicial) history.replaceState(null, '', location.pathname + location.search + '#/hoy');

  const start = routeFromHash();
  navigate(start, { replace: true });

  registerSW();

  // datos (async, no bloquea el primer render)
  initData()
    .catch((err) => console.warn('[Bolsillo] initData falló:', err))
    .finally(() => { if (smsInicial) registrar.abrirDesdeSMS(smsInicial); });
}

boot();
