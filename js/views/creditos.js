/* Vista CRÉDITOS — estado vacío diseñado (sin datos en T1). */

const ART =
  '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="12" width="36" height="24" rx="4"/><path d="M6 19h36"/><path d="M12 29h8"/><path d="M30 29h6"/></svg>';
const ICON_PLUS =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';

export default {
  label: 'Créditos',

  render() {
    return `
      <header class="view-greet">
        <p class="view-greet__eyebrow">Deudas y cuotas</p>
        <h1 class="view-greet__title">Créditos</h1>
      </header>

      <div class="empty">
        <div class="empty__art">${ART}</div>
        <h2 class="empty__title">Sin créditos registrados</h2>
        <p class="empty__text">Agrega tus créditos, tarjetas o cuotas y Bolsillo te avisará antes de cada fecha de pago.</p>
        <button class="btn btn--primary" id="cred-add" type="button">
          ${ICON_PLUS}
          Agregar crédito
        </button>
      </div>
    `;
  },

  mount(root) {
    const add = root.querySelector('#cred-add');
    if (add) {
      add.addEventListener('click', () => {
        const fab = document.getElementById('fab');
        if (fab) fab.click();
      });
    }
  },
};
