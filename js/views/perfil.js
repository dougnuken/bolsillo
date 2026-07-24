/* ============================================================
   Bolsillo · views/perfil.js
   Perfil + hub de configuración. Avatar arriba, luego Seguridad,
   Mi dinero, Datos y App. Cada fila abre su sub-hoja (cfg-*.js) y
   se repinta al volver, así los subtítulos siempre dicen la verdad.
   (Reemplaza la antigua vista Ajustes; se llega desde la pestaña Perfil.)
   ============================================================ */

import { getAll, getConfig } from '../db.js';
import { formatCOP } from '../money.js';
import { catalogo } from '../categories.js';
import { enmascararClave } from '../anthropic.js';
import { esc } from '../html.js';

import { abrirSueldo } from './sueldo-sheet.js';
import { abrirNegocios } from './cfg-ingresos.js';
import { abrirRecurrentes } from './cfg-recurrentes.js';
import { abrirCreditos } from './cfg-creditos.js';
import { abrirPresupuestos } from './cfg-presupuestos.js';
import { abrirCuentas } from './cfg-cuentas.js';
import { abrirCategorias } from './cfg-categorias.js';
import { abrirRespaldo, respaldoVencido } from './cfg-respaldo.js';
import { abrirApiKey } from './cfg-api.js';
import { abrirUmbrales } from './cfg-umbrales.js';
import { abrirOnboarding } from './onboarding.js';

const APP_VERSION = '0.6.0';

const CHEVRON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>';

const ICONS = {
  contrasena: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="9.5" rx="2.2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15.2" r="1.1"/></svg>',
  faceid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M9 10v1M15 10v1M12 9.5v3l-1 1"/><path d="M9.5 15a3.5 3.5 0 0 0 5 0"/></svg>',
  sueldo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M9.5 10.2a2.4 2.4 0 0 1 2.5-1.7c1.3 0 2.3.8 2.3 1.9 0 2.4-4.8 1.4-4.8 3.8 0 1.1 1 1.9 2.3 1.9a2.4 2.4 0 0 0 2.5-1.7"/></svg>',
  negocios: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/></svg>',
  fijos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="m9 15 2 2 4-4"/></svg>',
  creditos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/><path d="M7 14.5h4"/></svg>',
  presupuestos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 9 9h-9V3Z"/><path d="M14.5 2.5A7.5 7.5 0 0 1 21.5 9.5h-7v-7Z"/></svg>',
  cuentas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5A2.5 2.5 0 0 1 5.5 6H18a2 2 0 0 1 2 2v1"/><path d="M3 8.5V17a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2"/><path d="M21 11h-4a2 2 0 0 0 0 4h4a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1Z"/></svg>',
  categorias: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.2"/></svg>',
  respaldo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v11m0 0 4-4m-4 4-4-4"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>',
  api: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3M15.5 12v2"/></svg>',
  umbrales: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 6h14M5 12h14M5 18h14"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="8" cy="18" r="2"/></svg>',
  tour: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.4 3.2c-.7.4-1 .9-1 1.7"/><circle cx="12" cy="17.4" r="0.9" fill="currentColor" stroke="none"/></svg>',
  privacidad: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.4-3 8-7 10-4-2-7-5.6-7-10V6l7-3Z"/><path d="m9 12 2 2 4-4"/></svg>',
};

/** Fila de ajustes navegable. `sub` va escapado; `alerta` la marca en ámbar. */
function row(icon, title, sub, accion, { alerta = false } = {}) {
  return `<button class="settings-row${alerta ? ' settings-row--alerta' : ''}" type="button" data-act="${esc(accion)}">
    <span class="settings-row__icon">${icon}</span>
    <span class="settings-row__body">
      <span class="settings-row__title">${esc(title)}</span>
      ${sub ? `<span class="settings-row__sub">${esc(sub)}</span>` : ''}
    </span>
    <span class="settings-row__chev">${CHEVRON}</span>
  </button>`;
}

/** Fila deshabilitada con pill "Pronto" (funciones aún no disponibles). */
function rowSoon(icon, title, sub) {
  return `<div class="settings-row settings-row--soon" aria-disabled="true">
    <span class="settings-row__icon">${icon}</span>
    <span class="settings-row__body">
      <span class="settings-row__title">${esc(title)}</span>
      ${sub ? `<span class="settings-row__sub">${esc(sub)}</span>` : ''}
    </span>
    <span class="settings-row__soon">Pronto</span>
  </div>`;
}

/* ---- subtítulos vivos ---- */
function subSueldo(empleo) {
  if (!empleo) return 'Aún sin configurar · el semáforo lo necesita';
  return `${formatCOP(empleo.monto)} · día ${empleo.diaDelMes}`;
}
function subNegocios(negocios) {
  if (!negocios.length) return 'Ninguno registrado';
  const conEsperado = negocios.filter((n) => Number.isInteger(n.montoEsperado));
  const total = conEsperado.reduce((s, n) => s + n.montoEsperado, 0);
  const base = `${negocios.length} negocio${negocios.length > 1 ? 's' : ''}`;
  return conEsperado.length ? `${base} · esperado ${formatCOP(total)}/mes` : base;
}
function subFijos(recs) {
  const activos = recs.filter((r) => r.activo);
  if (!activos.length) return 'Arriendo, colegio, seguros…';
  const total = activos.reduce((s, r) => s + r.monto, 0);
  return `${activos.length} activo${activos.length > 1 ? 's' : ''} · ${formatCOP(total)}/mes`;
}
function subCreditos(creds) {
  if (!creds.length) return 'Ninguno registrado';
  const cuota = creds.reduce((s, c) => s + (Number.isInteger(c.cuotaMensual) ? c.cuotaMensual : 0), 0);
  return `${creds.length} crédito${creds.length > 1 ? 's' : ''} · cuota ${formatCOP(cuota)}/mes`;
}
function subPresupuestos(config) {
  const n = Object.keys(config.presupuestos || {}).length;
  return n ? `${n} categoría${n > 1 ? 's' : ''} con tope` : 'Ninguno definido';
}
function subCuentas(config) {
  const c = config.cuentas || [];
  return c.length ? c.join(' · ') : 'Ninguna cuenta';
}
function subCategorias(config) {
  const propias = (config.categoriasPersonalizadas || []).length;
  const renombradas = Object.keys(config.categoriasRenombradas || {}).length;
  const partes = [`${catalogo().length} en total`];
  if (propias) partes.push(`${propias} propia${propias > 1 ? 's' : ''}`);
  if (renombradas) partes.push(`${renombradas} renombrada${renombradas > 1 ? 's' : ''}`);
  return partes.join(' · ');
}
function subRespaldo(config) {
  if (!config.fechaUltimoBackup) return 'Nunca has respaldado';
  return 'Último: ' + new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' })
    .format(new Date(config.fechaUltimoBackup));
}
function subApi(config) {
  return config.apiKey ? `Configurada · ${enmascararClave(config.apiKey)}` : 'Sin configurar · foto y PDF inactivos';
}
function subUmbrales(config) {
  return `Hormiga bajo ${formatCOP(config.umbralHormiga)}`;
}

export default {
  label: 'Perfil',

  render() {
    return `
      <header class="perfil-head">
        <span class="perfil-head__avatar" aria-hidden="true">D</span>
        <div class="perfil-head__id">
          <p class="perfil-head__name">Doug</p>
          <p class="perfil-head__sub">Tu perfil y ajustes</p>
        </div>
      </header>
      <div id="cfg-body"><div class="hoy-skeleton" aria-hidden="true"></div></div>`;
  },

  mount(root) {
    const body = root.querySelector('#cfg-body');
    if (!body) return;

    async function pintar() {
      let ingresos = [], recs = [], creds = [], config = null;
      try {
        [ingresos, recs, creds, config] = await Promise.all([
          getAll('ingresos'), getAll('recurrentes'), getAll('creditos'), getConfig(),
        ]);
      } catch (err) {
        console.warn('[Bolsillo] no se pudo cargar Perfil:', err);
        body.innerHTML = '<p class="hoy-error">No se pudo cargar tu perfil. Reintenta.</p>';
        return;
      }
      if (!root.isConnected) return; // el usuario ya cambió de vista

      const empleo = ingresos.find((i) => i && i.fuente === 'empleo') || null;
      const negocios = ingresos.filter((i) => i && i.fuente !== 'empleo');
      const backupVencido = respaldoVencido(config.fechaUltimoBackup);

      body.innerHTML = `
        <section class="settings-group">
          <p class="settings-group__label">Seguridad</p>
          <div class="settings-list">
            ${rowSoon(ICONS.contrasena, 'Contraseña', 'Protege la app con un código')}
            ${rowSoon(ICONS.faceid, 'Bloqueo con Face ID', 'Abre con tu cara al entrar')}
          </div>
        </section>

        <section class="settings-group">
          <p class="settings-group__label">Mi dinero</p>
          <div class="settings-list">
            ${row(ICONS.sueldo, 'Sueldo de empleado', subSueldo(empleo), 'sueldo', { alerta: !empleo })}
            ${row(ICONS.negocios, 'Ingresos de negocios', subNegocios(negocios), 'negocios')}
            ${row(ICONS.fijos, 'Gastos fijos', subFijos(recs), 'recurrentes')}
            ${row(ICONS.creditos, 'Créditos', subCreditos(creds), 'creditos')}
            ${row(ICONS.presupuestos, 'Presupuestos por categoría', subPresupuestos(config), 'presupuestos')}
          </div>
        </section>

        <section class="settings-group">
          <p class="settings-group__label">Datos</p>
          <div class="settings-list">
            ${row(ICONS.cuentas, 'Cuentas', subCuentas(config), 'cuentas')}
            ${row(ICONS.categorias, 'Categorías', subCategorias(config), 'categorias')}
            ${row(ICONS.respaldo, 'Respaldo', subRespaldo(config), 'respaldo', { alerta: backupVencido })}
          </div>
        </section>

        <section class="settings-group">
          <p class="settings-group__label">App</p>
          <div class="settings-list">
            ${row(ICONS.api, 'Clave de Anthropic', subApi(config), 'api')}
            ${row(ICONS.umbrales, 'Umbrales', subUmbrales(config), 'umbrales')}
            ${row(ICONS.tour, 'Ver la guía de inicio', 'Repite la configuración paso a paso', 'onboarding')}
            ${row(ICONS.privacidad, 'Privacidad', 'Tus datos viven solo en este dispositivo', 'privacidad')}
          </div>
        </section>

        <p class="app-foot">
          Bolsillo · <span class="app-foot__ver num">v${APP_VERSION}</span><br />
          Local-first · tus datos no salen de tu iPhone
        </p>`;

      wire();
    }

    function wire() {
      const acciones = {
        sueldo: abrirSueldo,
        negocios: abrirNegocios,
        recurrentes: abrirRecurrentes,
        creditos: abrirCreditos,
        presupuestos: abrirPresupuestos,
        cuentas: abrirCuentas,
        categorias: abrirCategorias,
        respaldo: abrirRespaldo,
        api: abrirApiKey,
        umbrales: abrirUmbrales,
        onboarding: () => abrirOnboarding({ forzado: true, onDone: pintar }),
        privacidad: abrirPrivacidad,
      };

      body.querySelectorAll('[data-act]').forEach((b) => {
        const fn = acciones[b.dataset.act];
        if (!fn) return;
        b.addEventListener('click', async () => {
          await fn({ onSaved: pintar });
          pintar(); // al cerrar la hoja, los subtítulos se refrescan
        });
      });
    }

    pintar();
  },
};

/* ---- privacidad: informativo, sin estado ---- */
async function abrirPrivacidad() {
  const { hojaNav, cabecera, bindCabecera, notaCfg } = await import('./cfg-sheet.js');
  hojaNav((api) => {
    const html = `
      ${cabecera('Privacidad', { sub: 'Cómo trata Bolsillo tu información.' })}
      ${notaCfg('Todo lo que registras se guarda en <strong>este dispositivo</strong> (IndexedDB del navegador). No hay servidor, no hay cuenta, no hay analítica.')}
      ${notaCfg('El respaldo lo generas tú, cuando tú quieras, y decides dónde queda.')}
      ${notaCfg('La clave de Anthropic se usa solo para hablar directo con la API cuando lees una foto o un PDF. Nunca sale en los respaldos.')}
      ${notaCfg('Si borras la app o los datos del sitio, tu información se va con ellos: por eso conviene exportar de vez en cuando.', { tipo: 'warn' })}
      <button type="button" class="btn btn--primary btn--block cfg-cta" data-act="ok">Entendido</button>`;
    api.pintar(html, (panel) => {
      bindCabecera(panel, { cerrar: () => api.cerrar() });
      panel.querySelector('[data-act="ok"]').addEventListener('click', () => api.cerrar());
    });
  });
}
