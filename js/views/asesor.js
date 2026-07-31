/* ============================================================
   Bolsillo · views/asesor.js
   "Cuarto de conciencia": chat a pantalla completa con la voz cruda.
   Al entrar, la app oculta navbar + header (body[data-route=asesor]),
   así que esto es un espacio íntimo solo con el agente. El cerebro
   (contexto + persona + llamada) vive en conciencia.js.
   ============================================================ */

import { aconsejar } from '../conciencia.js';
import { armarContexto } from '../agente-datos.js';
import { esc } from '../html.js';

/* Spark de IA (dos destellos: uno grande, uno chico). */
const SPARK =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2.5l1.7 4.6a4 4 0 0 0 2.4 2.4l4.6 1.7-4.6 1.7a4 4 0 0 0-2.4 2.4L13 20.5l-1.7-4.6a4 4 0 0 0-2.4-2.4L4.3 11.8l4.6-1.7a4 4 0 0 0 2.4-2.4L13 2.5Z"/><path d="M5.5 3.2l.6 1.6a2 2 0 0 0 1.1 1.1l1.6.6-1.6.6a2 2 0 0 0-1.1 1.1l-.6 1.6-.6-1.6A2 2 0 0 0 3.8 8.1l-1.6-.6 1.6-.6a2 2 0 0 0 1.1-1.1l.6-1.6Z"/></svg>';
const ICON_BACK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>';
const SEND =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12l16-8-6 16-2.5-6.5L4 12Z"/></svg>';

const SUGERENCIAS = [
  '¿Cuánto puedo gastar hoy sin cagarla?',
  '¿Me alcanza para pagar los créditos este mes?',
  'Dime la verdad de mi mes',
];

function burbujaHTML(rol, texto) {
  return `<div class="chat-msg chat-msg--${rol === 'assistant' ? 'ia' : 'yo'}">${esc(texto)}</div>`;
}

export default {
  label: 'Asesor',

  render() {
    const chips = SUGERENCIAS.map(
      (q) => `<button class="chat-chip" type="button" data-q="${esc(q)}">${esc(q)}</button>`,
    ).join('');
    return `
      <section class="asesor-room">
        <header class="asesor-top">
          <button type="button" class="asesor-back" id="asesor-back" aria-label="Volver">${ICON_BACK}</button>
          <span class="asesor-top__title"><span class="asesor-top__spark">${SPARK}</span>Tu conciencia</span>
          <span class="asesor-top__pad" aria-hidden="true"></span>
        </header>
        <div class="chat-scroll" id="chat-scroll">
          <div class="asesor-hello">
            <div class="asesor-orb-big">${SPARK}</div>
            <p class="asesor-intro">Sin filtro. Te digo la verdad cruda de tus números — para que reacciones, no para que te sientas bien.</p>
          </div>
          <div class="chat-suggest" id="chat-suggest">${chips}</div>
        </div>
        <form class="chat-bar" id="chat-form">
          <input type="text" class="chat-input" id="chat-input" placeholder="Escríbele a tu conciencia…" autocomplete="off" enterkeyhint="send" aria-label="Escribe tu pregunta" />
          <button type="submit" class="chat-send" id="chat-send" aria-label="Enviar">${SEND}</button>
        </form>
      </section>`;
  },

  mount(root) {
    const scroll = root.querySelector('#chat-scroll');
    const suggest = root.querySelector('#chat-suggest');
    const form = root.querySelector('#chat-form');
    const input = root.querySelector('#chat-input');
    const back = root.querySelector('#asesor-back');
    const historial = [];   // {rol, texto}
    let ctx = null;         // {contexto, nombre, apiKey}
    let ocupado = false;

    if (back) back.addEventListener('click', () => { location.hash = '#/hoy'; });

    armarContexto().then((c) => { ctx = c; }).catch(() => { ctx = null; });

    // Baja al fondo. Síncrono (leer scrollHeight fuerza el layout) para que
    // funcione aunque rAF esté throttled; + un rAF de respaldo por si el layout
    // asienta después (fuentes, wrap). El scroller es .chat-scroll, no la vista.
    const irAlFondo = () => {
      scroll.scrollTop = scroll.scrollHeight;
      requestAnimationFrame(() => { scroll.scrollTop = scroll.scrollHeight; });
    };

    function agregar(rol, texto) {
      if (suggest && !suggest.hidden) suggest.hidden = true;
      scroll.insertAdjacentHTML('beforeend', burbujaHTML(rol, texto));
      irAlFondo();
    }

    async function preguntar(texto) {
      const q = String(texto || '').trim();
      if (!q || ocupado) return;
      ocupado = true;
      input.value = '';
      agregar('user', q);

      // burbuja "pensando…"
      const pensando = document.createElement('div');
      pensando.className = 'chat-msg chat-msg--ia chat-msg--wait';
      pensando.innerHTML = '<span></span><span></span><span></span>';
      scroll.appendChild(pensando);
      irAlFondo();

      if (!ctx) { try { ctx = await armarContexto(); } catch { ctx = null; } }

      let r;
      try {
        r = await aconsejar({
          contexto: ctx ? ctx.contexto : '',
          nombre: ctx ? ctx.nombre : '',
          modo: 'chat',
          pregunta: q,
          historialChat: historial.slice(-8),
          apiKey: ctx ? ctx.apiKey : '',
        });
      } catch {
        r = { estado: 'error', mensaje: 'Algo falló. Intenta de nuevo.' };
      }
      pensando.remove();

      if (r.estado === 'ok') {
        historial.push({ rol: 'user', texto: q }, { rol: 'assistant', texto: r.texto });
        agregar('assistant', r.texto);
      } else if (r.estado === 'sin-clave') {
        agregar('assistant', 'Necesito tu clave de Anthropic para hablarte con datos. Actívala en Perfil → Conexión con IA.');
      } else {
        agregar('assistant', r.mensaje || 'No pude responder. Intenta de nuevo.');
      }
      ocupado = false;
      input.focus();
    }

    if (suggest) {
      suggest.querySelectorAll('[data-q]').forEach((b) => {
        b.addEventListener('click', () => preguntar(b.dataset.q));
      });
    }
    if (form) form.addEventListener('submit', (e) => { e.preventDefault(); preguntar(input.value); });
  },
};
