/* Vista ASESOR — placeholder de chat con IA (sin conexión en T1). */

const ORB =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2"/><circle cx="12" cy="12" r="4.5"/></svg>';
const SPARK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4Z"/></svg>';
const SEND =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l16-8-6 16-2.5-6.5L4 12Z"/></svg>';

const SUGERENCIAS = [
  '¿Cuánto puedo gastar hoy?',
  '¿Cómo voy con mis gastos este mes?',
  '¿Me alcanza para pagar el crédito?',
];

export default {
  label: 'Asesor',

  render() {
    const chips = SUGERENCIAS.map(
      (q) => `<button class="chip" type="button" disabled aria-disabled="true">
        ${SPARK}<span class="chip__q">${q}</span>
      </button>`,
    ).join('');

    return `
      <header class="view-greet">
        <p class="view-greet__eyebrow">Inteligencia</p>
        <h1 class="view-greet__title">Asesor</h1>
      </header>

      <div class="advisor-hero">
        <div class="advisor-orb">${ORB}</div>
        <h2 class="empty__title">Tu asesor financiero</h2>
        <p class="empty__text">Pregúntale en lenguaje natural sobre tu dinero. Se activará cuando registres tus primeros movimientos.</p>
      </div>

      <div class="suggest-chips" aria-label="Preguntas sugeridas">
        ${chips}
      </div>

      <div class="composer" aria-hidden="true">
        <input type="text" placeholder="Pregúntale a tu asesor…" disabled />
        <span class="composer__send">${SEND}</span>
      </div>

      <p class="soon-note">Disponible pronto</p>
    `;
  },
};
