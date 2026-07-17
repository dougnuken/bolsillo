/* Vista HOY — gauge semáforo + estado vacío diseñado.
   Placeholder visual: sin lógica de datos (llega en T2). */

const ICON_WALLET =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5A2.5 2.5 0 0 1 5.5 6H18a2 2 0 0 1 2 2v1"/><path d="M3 8.5V17a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2"/><path d="M21 11h-4a2 2 0 0 0 0 4h4a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1Z"/></svg>';
const ICON_ARROW_DOWN =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="m6 13 6 6 6-6"/></svg>';
const ICON_ARROW_UP =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="m6 11 6-6 6 6"/></svg>';

export default {
  label: 'Hoy',

  render() {
    return `
      <header class="view-greet">
        <p class="view-greet__eyebrow">Tu bolsillo</p>
        <h1 class="view-greet__title">Hoy</h1>
      </header>

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
          ${ICON_WALLET}
          Configurar mi sueldo
        </button>
      </section>

      <div class="stat-row">
        <div class="card stat">
          <span class="stat__label">${ICON_ARROW_DOWN} Disponible hoy</span>
          <span class="stat__value stat__value--empty num">—</span>
        </div>
        <div class="card stat">
          <span class="stat__label">${ICON_ARROW_UP} Gastado</span>
          <span class="stat__value stat__value--empty num">—</span>
        </div>
      </div>
    `;
  },

  mount(root) {
    const cta = root.querySelector('#cta-sueldo');
    if (cta) {
      cta.addEventListener('click', () => {
        // en T1 lleva a Ajustes, donde vivirá la configuración de sueldo
        location.hash = '#/ajustes';
      });
    }
  },
};
