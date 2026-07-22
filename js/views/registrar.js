/* ============================================================
   Bolsillo · Registrar (bottom-sheet del FAB)
   Piloto: Teclado numérico propio + Texto libre. Foto/PDF ocultos
   hasta que estén listos (se re-muestran reañadiendo sus botones).
   La fecha se elige con una hoja inferior (fecha-sheet), no con el
   input de calendario nativo suelto.
   Guarda con crearMovimiento/actualizar, valida, toast, borrador
   autosave (localStorage, debounce) y modo edición.
   Sin estilos inline (CSP style-src 'self').
   ============================================================ */

import { get, put, getConfig, saveConfig, getAll } from '../db.js';
import {
  crearMovimiento, actualizar, validarMovimiento, derivarEsHormiga,
} from '../model.js';
import { formatCOP } from '../money.js';
import { catalogoVisible, categoriaPorId } from '../categories.js';
import { parseTextoLibre } from '../categorize.js';
import { toast } from '../toast.js';
import { hoyISO, etiquetaFecha, esISOValida } from '../fechas.js';
import { abrirFecha } from './fecha-sheet.js';

const DRAFT_KEY = 'bolsillo:draft:registrar';
const MAX_DIGITOS = 12;

/* ---- iconos ---- */
const IC = {
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18 9 12l6-6"/></svg>',
  del: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 5H8l-5 7 5 7h13a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1Z"/><path d="m13 9 4 6M17 9l-4 6"/></svg>',
  keyboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/></svg>',
  text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5h14M5 10h14M5 15h9"/></svg>',
  photo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8a2 2 0 0 1 2-2h1.5l1-2h5l1 2H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><circle cx="12" cy="13" r="3.2"/></svg>',
  pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/></svg>',
  bang: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v5"/><circle cx="12" cy="16.5" r="1" fill="currentColor" stroke="none"/></svg>',
  chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
};

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (m) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]
));

/* ---- estado ---- */
function fresh() {
  return {
    screen: 'metodos', modo: 'teclado', tipo: 'gasto', editId: null,
    montoStr: '', categoriaId: '', ingresoId: '', cuenta: '', fecha: hoyISO(),
    comercio: '', esFijo: false, notas: '', fuente: 'manual',
    detalles: false, keypad: true, agregandoCuenta: false,
  };
}
let STATE = fresh();
let cfg = null;
let draftPend = null;
let fuentes = []; // fuentes de ingreso de negocio (para el modo Ingreso)

let sheetRef = null, openRef = null, closeRef = null, onSavedRef = null;

const montoActual = () => (parseInt(STATE.montoStr || '0', 10) || 0);
const cuentas = () => (cfg && Array.isArray(cfg.cuentas) ? cfg.cuentas : []);
const esIngreso = () => STATE.tipo === 'ingreso';

/** Carga las fuentes de negocio (para elegir a cuál se abona un ingreso). */
async function cargarFuentes() {
  try {
    const todos = await getAll('ingresos');
    fuentes = todos.filter((i) => i && i.fuente !== 'empleo');
  } catch { fuentes = []; }
}
const fuenteActual = () => fuentes.find((f) => f.id === STATE.ingresoId) || null;
const nombreFuente = (f) => (f && f.nombre && f.nombre.trim() ? f.nombre.trim() : 'Negocio');

/* ---- borrador ---- */
function hasContent() {
  return montoActual() > 0 || !!STATE.categoriaId || !!STATE.comercio.trim();
}
function saveDraft() {
  if (STATE.editId || esIngreso()) return; // el borrador es solo para gastos
  if (!hasContent()) { clearDraft(); return; }
  const d = {
    modo: STATE.modo, montoStr: STATE.montoStr, categoriaId: STATE.categoriaId,
    cuenta: STATE.cuenta, fecha: STATE.fecha, comercio: STATE.comercio,
    esFijo: STATE.esFijo, notas: STATE.notas,
  };
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* cuota llena: ignorar */ }
}
let saveTimer = null;
function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveDraft, 500); }
function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch { /* noop */ } }
function loadDraft() {
  try { const r = localStorage.getItem(DRAFT_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}
window.addEventListener('beforeunload', () => { if (!STATE.editId && hasContent()) saveDraft(); });

/* ============================================================
   Render de pantallas
   ============================================================ */
function cabecera(titulo, conBack) {
  return `
    <div class="sheet__grip" aria-hidden="true"></div>
    ${conBack ? `<button class="icon-btn sheet__back" data-act="back" type="button" aria-label="Volver">${IC.back}</button>` : ''}
    <button class="icon-btn sheet__close" data-act="close" type="button" aria-label="Cerrar">${IC.close}</button>
    <h2 class="sheet__title">${esc(titulo)}</h2>`;
}

/* Segmented Gasto/Ingreso: elección clara arriba del sheet. */
function segmentedHTML() {
  const on = (t) => (STATE.tipo === t ? ' is-on' : '');
  return `
    <div class="seg" role="tablist" aria-label="Tipo de movimiento">
      <button type="button" class="seg__opt${on('gasto')}" role="tab" aria-selected="${STATE.tipo === 'gasto'}" data-tipo="gasto">Gasto</button>
      <button type="button" class="seg__opt seg__opt--in${on('ingreso')}" role="tab" aria-selected="${STATE.tipo === 'ingreso'}" data-tipo="ingreso">Ingreso</button>
    </div>`;
}

function renderMetodos() {
  const draftBar = draftPend ? `
    <div class="draft-bar" role="status">
      <span class="draft-bar__ic">${IC.bang}</span>
      <div class="draft-bar__body">
        <p class="draft-bar__title">Tienes un registro sin terminar</p>
        <p class="draft-bar__text">${draftPend.montoStr ? formatCOP(parseInt(draftPend.montoStr, 10) || 0) : 'Borrador'}${draftPend.categoriaId ? ' · ' + esc(categoriaPorId(draftPend.categoriaId).label) : ''}</p>
      </div>
      <div class="draft-bar__actions">
        <button type="button" class="btn btn--primary btn--sm" data-act="draft-resume">Retomar</button>
        <button type="button" class="btn btn--ghost btn--sm" data-act="draft-discard">Descartar</button>
      </div>
    </div>` : '';

  return `
    ${cabecera('Registrar', false)}
    ${segmentedHTML()}
    <p class="sheet__sub">¿Cómo quieres capturar tu gasto?</p>
    ${draftBar}
    <div class="capture-grid">
      <button class="capture-opt" type="button" data-metodo="teclado">
        <span class="capture-opt__icon">${IC.keyboard}</span>
        <span class="capture-opt__name">Teclado</span>
        <span class="capture-opt__desc">Escribe el monto a mano</span>
      </button>
      <button class="capture-opt" type="button" data-metodo="texto">
        <span class="capture-opt__icon">${IC.text}</span>
        <span class="capture-opt__name">Texto libre</span>
        <span class="capture-opt__desc">"Pagué 50k de mercado"</span>
      </button>
      <!-- Foto y PDF ocultos en el piloto (aún placeholders). Para re-mostrar:
           reañade sus botones .capture-opt.is-soon con IC.photo / IC.pdf. -->
    </div>`;
}

function keypadHTML() {
  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'del'];
  return `<div class="keypad">${teclas.map((t) => {
    if (t === 'del') return `<button type="button" class="keypad__key keypad__key--del" data-key="del" aria-label="Borrar">${IC.del}</button>`;
    return `<button type="button" class="keypad__key" data-key="${t}">${t}</button>`;
  }).join('')}</div>`;
}

function chipsCategoria() {
  return `<div class="cat-grid" role="listbox" aria-label="Categoría">${
    catalogoVisible().map((c) => `
      <button type="button" class="cat-chip ${c.cls}${STATE.categoriaId === c.id ? ' is-sel' : ''}"
        role="option" aria-selected="${STATE.categoriaId === c.id}" data-cat="${c.id}">
        <span class="cat-chip__ic">${c.icon}</span>
        <span class="cat-chip__label">${esc(c.label)}</span>
      </button>`).join('')
  }</div>`;
}

function cuentaSelector() {
  const opts = cuentas().map((c) => `
    <button type="button" class="acct-chip${STATE.cuenta === c ? ' is-sel' : ''}" data-cuenta="${esc(c)}">${esc(c)}</button>`).join('');
  const nueva = STATE.agregandoCuenta
    ? `<div class="acct-new">
         <input type="text" class="field__input" id="reg-nueva-cuenta" placeholder="Nombre de la cuenta" autocomplete="off" />
         <button type="button" class="btn btn--primary btn--sm" data-act="cuenta-add">Agregar</button>
       </div>`
    : `<button type="button" class="acct-chip acct-chip--add" data-act="cuenta-new">${IC.plus}<span>Nueva</span></button>`;
  return `<div class="acct-row">${opts}${nueva}</div>`;
}

/* Selector de fuente de negocio (modo Ingreso). Sin fuentes → aviso + atajo. */
function fuenteSelector() {
  if (!fuentes.length) {
    return `
      <div class="acct-empty">
        <p class="acct-empty__txt">Aún no tienes negocios. Créalos en <strong>Ajustes → Ingresos de negocios</strong> para registrar lo que entra.</p>
      </div>`;
  }
  const opts = fuentes.map((f) => `
    <button type="button" class="acct-chip${STATE.ingresoId === f.id ? ' is-sel' : ''}" data-fuente="${esc(f.id)}">${esc(nombreFuente(f))}</button>`).join('');
  return `<div class="acct-row">${opts}</div>`;
}

/* Campo "Detalle" prominente (el sub libre de el usuario: uniformes, gasolina,
   dieta huevos…). Persiste en el campo `comercio` del movimiento por
   retrocompat; solo cambia la etiqueta de cara al usuario. Solo en gastos. */
function detalleHTML() {
  if (esIngreso()) return '';
  return `
    <label class="field reg-detalle">
      <span class="field__label field__label--section">Detalle · ¿en qué?</span>
      <input type="text" class="field__input" id="reg-detalle" value="${esc(STATE.comercio)}"
        placeholder="uniformes, gasolina, dieta…" autocomplete="off" inputmode="text" />
      <span class="reg-detalle__hint">Opcional. Ayuda a recordar en qué se fue.</span>
    </label>`;
}

function detallesHTML() {
  const ingreso = esIngreso();
  const resumen = ' · cuenta, fecha…';
  return `
    <button type="button" class="detalles-toggle${STATE.detalles ? ' is-open' : ''}" data-act="detalles">
      <span>Detalles${!STATE.detalles ? resumen : ''}</span>
      <span class="detalles-toggle__chev">${IC.chev}</span>
    </button>
    ${STATE.detalles ? `
    <div class="detalles">
      <div class="field">
        <span class="field__label">Cuenta${ingreso ? ' donde entró' : ''}</span>
        ${cuentaSelector()}
      </div>
      <div class="field">
        <span class="field__label">Fecha</span>
        <button type="button" class="date-trigger" data-act="fecha" aria-label="Elegir fecha del movimiento">
          <span class="date-trigger__val" id="reg-fecha-val">${esc(etiquetaFecha(STATE.fecha))}</span>
          <span class="date-trigger__ic">${IC.cal}</span>
        </button>
      </div>
      ${ingreso ? '' : `
      <label class="field toggle-row">
        <span class="field__label">Gasto fijo (no cuenta como hormiga)</span>
        <span class="switch${STATE.esFijo ? ' is-on' : ''}" role="switch" aria-checked="${STATE.esFijo}" tabindex="0" data-act="fijo"><span class="switch__dot"></span></span>
      </label>`}
      <label class="field">
        <span class="field__label">Notas</span>
        <textarea class="field__input field__textarea" id="reg-notas" rows="2" placeholder="Opcional">${esc(STATE.notas)}</textarea>
      </label>
    </div>` : ''}`;
}

function renderForm() {
  const monto = montoActual();
  const ingreso = esIngreso();
  const puedeGuardar = monto > 0 && (ingreso ? !!STATE.ingresoId : !!STATE.categoriaId);

  // El segmented se muestra al crear; al editar se conserva el tipo del movimiento.
  const seg = STATE.editId ? '' : segmentedHTML();

  const textInput = (!ingreso && STATE.modo === 'texto') ? `
    <div class="free-text">
      <input type="text" class="field__input free-text__input" id="reg-texto"
        placeholder="Pagué 15.000 en taxi" autocomplete="off" inputmode="text" />
      <p class="free-text__hint">Escribe en lenguaje natural y lo interpretamos.</p>
    </div>` : '';

  const titulo = STATE.editId
    ? (ingreso ? 'Editar ingreso' : 'Editar movimiento')
    : (ingreso ? 'Nuevo ingreso' : 'Nuevo gasto');

  const seccion = ingreso
    ? `<p class="field__label field__label--section">¿De qué negocio?</p>${fuenteSelector()}`
    : `<p class="field__label field__label--section">Categoría</p>${chipsCategoria()}`;

  const guardarTxt = STATE.editId ? 'Guardar cambios' : (ingreso ? 'Guardar ingreso' : 'Guardar gasto');

  return `
    ${cabecera(titulo, true)}
    ${seg}
    ${textInput}
    <button type="button" class="amt amt--${ingreso ? 'in' : 'out'}${STATE.keypad ? ' is-active' : ''}" data-act="amt-toggle" aria-label="Monto">
      <span class="amt__cur">${ingreso ? '+$' : '$'}</span>
      <span class="amt__value num" id="reg-amt">${monto ? formatCOP(monto).replace('$', '') : '0'}</span>
    </button>
    ${STATE.keypad ? keypadHTML() : ''}
    ${seccion}
    ${detalleHTML()}
    ${detallesHTML()}
    <button type="button" class="btn btn--primary btn--block btn--save" data-act="guardar" ${puedeGuardar ? '' : 'disabled'}>
      ${guardarTxt}
    </button>`;
}

/* ============================================================
   Paint + binds
   ============================================================ */
function paint() {
  if (!sheetRef) return;
  sheetRef.scrollTop = 0;
  sheetRef.innerHTML = STATE.screen === 'form' ? renderForm() : renderMetodos();
  bind();
  if (STATE.screen === 'form' && STATE.modo === 'texto') {
    const ti = sheetRef.querySelector('#reg-texto');
    if (ti) setTimeout(() => ti.focus(), 60);
  }
}

/* actualizaciones puntuales sin repintar (preservan foco/caret) */
function puedeGuardarAhora() {
  return montoActual() > 0 && (esIngreso() ? !!STATE.ingresoId : !!STATE.categoriaId);
}
function syncMonto() {
  const amt = sheetRef.querySelector('#reg-amt');
  if (amt) { const m = montoActual(); amt.textContent = m ? formatCOP(m).replace('$', '') : '0'; }
  const save = sheetRef.querySelector('[data-act="guardar"]');
  if (save) save.disabled = !puedeGuardarAhora();
}
function syncCategoria() {
  sheetRef.querySelectorAll('.cat-chip').forEach((ch) => {
    const sel = ch.dataset.cat === STATE.categoriaId;
    ch.classList.toggle('is-sel', sel);
    ch.setAttribute('aria-selected', String(sel));
  });
  syncMonto();
}
/* Cambia de tipo (gasto/ingreso). Conserva el monto tecleado. */
function cambiarTipo(t) {
  if (t === STATE.tipo && STATE.screen === 'form') return;
  STATE.tipo = t;
  if (STATE.screen === 'metodos') {
    if (t === 'ingreso') {
      STATE.screen = 'form';
      STATE.keypad = true;
      if (!STATE.cuenta) STATE.cuenta = cuentas()[0] || '';
      if (!STATE.ingresoId && fuentes.length === 1) STATE.ingresoId = fuentes[0].id;
    }
  } else if (t === 'ingreso' && !STATE.ingresoId && fuentes.length === 1) {
    STATE.ingresoId = fuentes[0].id;
  }
  paint();
}
/* Actualiza solo la etiqueta del disparador de fecha (sin repintar:
   conserva scroll y foco tras cerrar la hoja). */
function syncFecha() {
  const val = sheetRef.querySelector('#reg-fecha-val');
  if (val) val.textContent = etiquetaFecha(STATE.fecha);
}

function bind() {
  sheetRef.querySelectorAll('[data-act]').forEach((el) => {
    const act = el.dataset.act;
    if (act === 'close') el.addEventListener('click', cerrar);
    else if (act === 'back') el.addEventListener('click', () => { STATE.screen = 'metodos'; STATE.tipo = 'gasto'; draftPend = null; paint(); });
    else if (act === 'draft-resume') el.addEventListener('click', retomarDraft);
    else if (act === 'draft-discard') el.addEventListener('click', () => { clearDraft(); draftPend = null; paint(); });
    else if (act === 'amt-toggle') el.addEventListener('click', () => { STATE.keypad = !STATE.keypad; paint(); });
    else if (act === 'detalles') el.addEventListener('click', () => { STATE.detalles = !STATE.detalles; paint(); });
    else if (act === 'guardar') el.addEventListener('click', guardar);
    else if (act === 'fecha') el.addEventListener('click', elegirFecha);
    else if (act === 'cuenta-new') el.addEventListener('click', () => { STATE.agregandoCuenta = true; STATE.detalles = true; paint(); const i = sheetRef.querySelector('#reg-nueva-cuenta'); if (i) i.focus(); });
    else if (act === 'cuenta-add') el.addEventListener('click', agregarCuenta);
    else if (act === 'fijo') {
      const toggle = () => { STATE.esFijo = !STATE.esFijo; scheduleSave(); paint(); };
      el.addEventListener('click', toggle);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    }
  });

  // segmented Gasto/Ingreso
  sheetRef.querySelectorAll('[data-tipo]').forEach((b) => {
    b.addEventListener('click', () => cambiarTipo(b.dataset.tipo));
  });

  // métodos
  sheetRef.querySelectorAll('[data-metodo]').forEach((b) => {
    b.addEventListener('click', () => {
      STATE.modo = b.dataset.metodo;
      STATE.tipo = 'gasto';
      STATE.screen = 'form';
      STATE.keypad = STATE.modo === 'teclado';
      if (!STATE.cuenta) STATE.cuenta = cuentas()[0] || '';
      paint();
    });
  });

  // fuente de ingreso (modo Ingreso)
  sheetRef.querySelectorAll('[data-fuente]').forEach((b) => {
    b.addEventListener('click', () => {
      STATE.ingresoId = STATE.ingresoId === b.dataset.fuente ? '' : b.dataset.fuente;
      sheetRef.querySelectorAll('[data-fuente]').forEach((x) => {
        x.classList.toggle('is-sel', x.dataset.fuente === STATE.ingresoId);
      });
      syncMonto();
    });
  });

  // teclado numérico
  sheetRef.querySelectorAll('[data-key]').forEach((k) => {
    k.addEventListener('click', () => {
      const key = k.dataset.key;
      if (key === 'del') STATE.montoStr = STATE.montoStr.slice(0, -1);
      else if (STATE.montoStr.length < MAX_DIGITOS) {
        const next = (STATE.montoStr + key).replace(/^0+(?=\d)/, '');
        STATE.montoStr = next.slice(0, MAX_DIGITOS);
      }
      syncMonto();
      scheduleSave();
    });
  });

  // categorías
  sheetRef.querySelectorAll('.cat-chip').forEach((ch) => {
    ch.addEventListener('click', () => {
      STATE.categoriaId = STATE.categoriaId === ch.dataset.cat ? '' : ch.dataset.cat;
      syncCategoria();
      scheduleSave();
    });
  });

  // cuentas
  sheetRef.querySelectorAll('[data-cuenta]').forEach((b) => {
    b.addEventListener('click', () => { STATE.cuenta = b.dataset.cuenta; paint(); });
  });

  // inputs de texto (sin repintar)
  const texto = sheetRef.querySelector('#reg-texto');
  if (texto) texto.addEventListener('input', () => interpretarTexto(texto.value));

  const detalle = sheetRef.querySelector('#reg-detalle');
  if (detalle) detalle.addEventListener('input', () => { STATE.comercio = detalle.value; scheduleSave(); });

  const notas = sheetRef.querySelector('#reg-notas');
  if (notas) notas.addEventListener('input', () => { STATE.notas = notas.value; scheduleSave(); });

  const nuevaCuenta = sheetRef.querySelector('#reg-nueva-cuenta');
  if (nuevaCuenta) nuevaCuenta.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); agregarCuenta(); } });
}

/* interpreta el texto libre y sincroniza el formulario en vivo */
function interpretarTexto(valor) {
  const { monto, categoriaId, comercio } = parseTextoLibre(valor, cfg || {});
  STATE.montoStr = monto ? String(monto) : '';
  if (categoriaId) STATE.categoriaId = categoriaId;
  STATE.comercio = comercio || '';
  syncCategoria();
  const ci = sheetRef.querySelector('#reg-detalle');
  if (ci) ci.value = STATE.comercio;
  scheduleSave();
}

/* Abre la hoja inferior de fecha (Hoy/Ayer/Antier + nativo). Guarda la
   fecha REAL elegida; si se cierra sin elegir, no toca nada. */
async function elegirFecha() {
  const iso = await abrirFecha({ fecha: STATE.fecha });
  if (!esISOValida(iso)) return; // cerró sin elegir
  STATE.fecha = iso;
  syncFecha();
  scheduleSave();
}

function retomarDraft() {
  if (!draftPend) return;
  STATE = { ...fresh(), ...draftPend, screen: 'form', editId: null };
  STATE.keypad = STATE.modo !== 'texto';
  if (!STATE.cuenta) STATE.cuenta = cuentas()[0] || '';
  draftPend = null;
  paint();
}

async function agregarCuenta() {
  const input = sheetRef.querySelector('#reg-nueva-cuenta');
  const nombre = input ? input.value.trim() : '';
  if (!nombre) { STATE.agregandoCuenta = false; paint(); return; }
  if (cuentas().includes(nombre)) { STATE.cuenta = nombre; STATE.agregandoCuenta = false; paint(); return; }
  try {
    cfg = await saveConfig({ cuentas: [...cuentas(), nombre] });
    STATE.cuenta = nombre;
    STATE.agregandoCuenta = false;
    paint();
    toast('Cuenta agregada');
  } catch (err) {
    toast('No se pudo agregar la cuenta: ' + err.message, { icono: false });
  }
}

async function guardar() {
  const monto = montoActual();
  if (monto <= 0) return;
  const ingreso = esIngreso();
  if (ingreso && !STATE.ingresoId) { toast('Elige de qué negocio entró', { icono: false }); return; }
  if (!ingreso && !STATE.categoriaId) return;
  const cuenta = STATE.cuenta || cuentas()[0] || '';
  if (!cuenta) { toast('Agrega una cuenta primero', { icono: false }); return; }

  try {
    if (STATE.editId) {
      const orig = await get('movimientos', STATE.editId);
      if (!orig) throw new Error('no se encontró el movimiento');
      const cambios = ingreso
        ? {
          monto, cuenta, fecha: STATE.fecha, notas: STATE.notas.trim(),
          ingresoId: STATE.ingresoId, comercio: nombreFuente(fuenteActual()),
          esHormiga: false,
        }
        : (() => {
          const c = {
            monto, categoria: STATE.categoriaId, cuenta,
            fecha: STATE.fecha, comercio: STATE.comercio.trim(),
            esFijo: STATE.esFijo, notas: STATE.notas.trim(),
          };
          return { ...c, esHormiga: derivarEsHormiga({ ...orig, ...c }, cfg || undefined) };
        })();
      const actualizado = actualizar(orig, cambios);
      const v = validarMovimiento(actualizado);
      if (!v.ok) throw new Error(v.errores.join(' '));
      await put('movimientos', actualizado);
      toast('Cambios guardados');
    } else if (ingreso) {
      const mov = crearMovimiento({
        monto, tipo: 'ingreso', cuenta, fecha: STATE.fecha, fuente: 'manual',
        ingresoId: STATE.ingresoId, comercio: nombreFuente(fuenteActual()),
        notas: STATE.notas.trim(),
      }, { config: cfg || undefined });
      await put('movimientos', mov);
      toast('Ingreso registrado');
    } else {
      const mov = crearMovimiento({
        monto, tipo: 'gasto', categoria: STATE.categoriaId, comercio: STATE.comercio.trim(),
        cuenta, fecha: STATE.fecha, fuente: STATE.fuente, esFijo: STATE.esFijo, notas: STATE.notas.trim(),
      }, { config: cfg || undefined });
      await put('movimientos', mov);
      toast('Guardado');
    }
    clearDraft();
    STATE = fresh();
    if (closeRef) closeRef();
    if (typeof onSavedRef === 'function') onSavedRef();
  } catch (err) {
    toast('No se pudo guardar: ' + err.message, { icono: false, ms: 3200 });
  }
}

/* ============================================================
   API pública
   ============================================================ */
async function abrir(mov = null) {
  try { cfg = await getConfig(); } catch { cfg = null; }
  await cargarFuentes();
  if (mov) {
    const esIn = mov.tipo === 'ingreso';
    STATE = {
      ...fresh(), screen: 'form', modo: 'teclado', tipo: esIn ? 'ingreso' : 'gasto', editId: mov.id,
      montoStr: mov.monto ? String(mov.monto) : '',
      categoriaId: mov.categoria || '', ingresoId: mov.ingresoId || '',
      cuenta: mov.cuenta || (cuentas()[0] || ''),
      fecha: (mov.fecha || hoyISO()).slice(0, 10), comercio: mov.comercio || '',
      esFijo: !!mov.esFijo, notas: mov.notas || '', fuente: mov.fuente || 'manual',
      detalles: true, keypad: true, agregandoCuenta: false,
    };
    draftPend = null;
  } else {
    STATE = fresh();
    STATE.cuenta = cuentas()[0] || '';
    draftPend = loadDraft();
  }
  if (openRef) openRef();
  paint();
}

function cerrar() {
  if (!STATE.editId && hasContent()) saveDraft();
  if (closeRef) closeRef();
}

export default {
  label: 'Registrar',
  render() { return renderMetodos(); },
  mount(sheet, { open, close, onSaved } = {}) {
    sheetRef = sheet;
    openRef = open;
    closeRef = close;
    onSavedRef = onSaved;
    getConfig().then((c) => { cfg = c; }).catch(() => { cfg = null; });
    cargarFuentes();
    bind();
  },
  abrir,
  cerrar,
};
