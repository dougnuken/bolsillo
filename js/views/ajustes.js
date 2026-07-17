/* Vista AJUSTES — estructura de configuración (placeholders T1). */

const CHEVRON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>';

const APP_VERSION = '0.1.0';

const ICONS = {
  sueldo:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M9.5 10.2a2.4 2.4 0 0 1 2.5-1.7c1.3 0 2.3.8 2.3 1.9 0 2.4-4.8 1.4-4.8 3.8 0 1.1 1 1.9 2.3 1.9a2.4 2.4 0 0 0 2.5-1.7"/></svg>',
  moneda:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3.5 9h17M3.5 15h17M12 3c2.3 2.4 3.5 5.6 3.5 9s-1.2 6.6-3.5 9c-2.3-2.4-3.5-5.6-3.5-9s1.2-6.6 3.5-9Z"/></svg>',
  alertas:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 6-2.5 7-2.5 7h17S18 14 18 8Z"/><path d="M10.5 19a2 2 0 0 0 3 0"/></svg>',
  respaldo:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v11m0 0 4-4m-4 4-4-4"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>',
  apariencia:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12.5A8 8 0 1 1 11.5 4a6 6 0 0 0 8.5 8.5Z"/></svg>',
  privacidad:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.4-3 8-7 10-4-2-7-5.6-7-10V6l7-3Z"/><path d="m9 12 2 2 4-4"/></svg>',
  acerca:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
};

function row(icon, title, sub) {
  return `<button class="settings-row" type="button">
    <span class="settings-row__icon">${icon}</span>
    <span class="settings-row__body">
      <span class="settings-row__title">${title}</span>
      ${sub ? `<span class="settings-row__sub">${sub}</span>` : ''}
    </span>
    <span class="settings-row__chev">${CHEVRON}</span>
  </button>`;
}

export default {
  label: 'Ajustes',

  render() {
    return `
      <header class="view-greet">
        <p class="view-greet__eyebrow">Preferencias</p>
        <h1 class="view-greet__title">Ajustes</h1>
      </header>

      <section class="settings-group">
        <p class="settings-group__label">Mi dinero</p>
        <div class="settings-list">
          ${row(ICONS.sueldo, 'Mi sueldo', 'Aún sin configurar')}
          ${row(ICONS.moneda, 'Moneda', 'Peso colombiano (COP)')}
          ${row(ICONS.alertas, 'Alertas y recordatorios', 'Fechas de pago y límites')}
        </div>
      </section>

      <section class="settings-group">
        <p class="settings-group__label">Datos</p>
        <div class="settings-list">
          ${row(ICONS.respaldo, 'Respaldo y exportación', 'Exporta o importa tu información')}
          ${row(ICONS.privacidad, 'Privacidad', 'Tus datos viven solo en este dispositivo')}
        </div>
      </section>

      <section class="settings-group">
        <p class="settings-group__label">App</p>
        <div class="settings-list">
          ${row(ICONS.apariencia, 'Apariencia', 'Oscuro')}
          ${row(ICONS.acerca, 'Acerca de Bolsillo', null)}
        </div>
      </section>

      <p class="app-foot">
        Bolsillo · <span class="app-foot__ver num">v${APP_VERSION}</span><br />
        Local-first · tus datos no salen de tu iPhone
      </p>
    `;
  },
};
