/* Vista MOVIMIENTOS — estado vacío diseñado (sin datos en T1). */

const ART =
  '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="10" width="34" height="28" rx="4"/><path d="M7 18h34"/><path d="M13 26h9"/><path d="M13 32h6"/><circle cx="33" cy="29" r="4"/></svg>';
const ICON_PLUS =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';

export default {
  label: 'Movimientos',

  render() {
    return `
      <header class="view-greet">
        <p class="view-greet__eyebrow">Historial</p>
        <h1 class="view-greet__title">Movimientos</h1>
      </header>

      <div class="empty">
        <div class="empty__art">${ART}</div>
        <h2 class="empty__title">Aún no hay movimientos</h2>
        <p class="empty__text">Registra tu primer ingreso o gasto y aquí verás todo tu historial, ordenado y buscable.</p>
        <button class="btn btn--primary" id="mov-add" type="button">
          ${ICON_PLUS}
          Registrar movimiento
        </button>
      </div>
    `;
  },

  mount(root) {
    const add = root.querySelector('#mov-add');
    if (add) {
      add.addEventListener('click', () => {
        const fab = document.getElementById('fab');
        if (fab) fab.click();
      });
    }
  },
};
