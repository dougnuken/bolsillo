/* Bottom-sheet REGISTRAR — 4 métodos de captura (solo visual en T1). */

const ICON_CLOSE =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg>';
const ICON_SPARK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4Z"/></svg>';

const METHODS = [
  {
    key: 'teclado',
    name: 'Teclado',
    desc: 'Escribe el monto a mano',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/></svg>',
  },
  {
    key: 'texto',
    name: 'Texto libre',
    desc: '"Pagué 50k de mercado"',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5h14M5 10h14M5 15h9"/></svg>',
  },
  {
    key: 'foto',
    name: 'Foto',
    desc: 'Recibo o factura',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8a2 2 0 0 1 2-2h1.5l1-2h5l1 2H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><circle cx="12" cy="13" r="3.2"/></svg>',
  },
  {
    key: 'pdf',
    name: 'PDF',
    desc: 'Extracto o comprobante',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/><path d="M9 14h6M9 17h4"/></svg>',
  },
];

export default {
  render() {
    const cards = METHODS.map(
      (m) => `<button class="capture-opt" type="button" data-method="${m.key}">
        <span class="capture-opt__icon">${m.icon}</span>
        <span class="capture-opt__name">${m.name}</span>
        <span class="capture-opt__desc">${m.desc}</span>
      </button>`,
    ).join('');

    return `
      <div class="sheet__grip" aria-hidden="true"></div>
      <button class="icon-btn sheet__close" id="sheet-close" type="button" aria-label="Cerrar">${ICON_CLOSE}</button>
      <h2 class="sheet__title">Registrar</h2>
      <p class="sheet__sub">Elige cómo quieres capturar tu movimiento</p>
      <div class="capture-grid">${cards}</div>
      <p class="soon-note">${ICON_SPARK} La captura se activa en la próxima versión</p>
    `;
  },

  mount(sheetEl, { close } = {}) {
    sheetEl.querySelectorAll('.capture-opt').forEach((btn) => {
      btn.addEventListener('click', () => {
        // T1: solo visual — cierra el sheet con feedback
        if (typeof close === 'function') close();
      });
    });
  },
};
