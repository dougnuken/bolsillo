/* ============================================================
   Bolsillo · views/asesor.js
   Chat "voz de conciencia" (superficie a demanda de D). Arma el
   contexto financiero real y le pregunta a Claude con voz cruda.
   El cerebro (contexto + persona + llamada) vive en conciencia.js.
   ============================================================ */

import { getAll, getConfig } from '../db.js';
import { calcularEstado, historialAhorro, gastoCategoriasComparado } from '../budget.js';
import { categoriaPorId } from '../categories.js';
import { construirContexto, aconsejar } from '../conciencia.js';
import { esc } from '../html.js';

const ORB =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>';
const SEND =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l16-8-6 16-2.5-6.5L4 12Z"/></svg>';

const SUGERENCIAS = [
  '¿Cuánto puedo gastar hoy sin cagarla?',
  '¿Me alcanza para pagar los créditos este mes?',
  'Dime la verdad de mi mes',
];

/* Reúne la realidad económica actual → texto de contexto para el agente. */
async function armarContexto() {
  const [movimientos, ingresos, recurrentes, creditos, config] = await Promise.all([
    getAll('movimientos'), getAll('ingresos'), getAll('recurrentes'), getAll('creditos'), getConfig(),
  ]);
  const empleo = ingresos.find((i) => i && i.fuente === 'empleo') || null;
  const salario = empleo ? empleo.monto : 0;
  const hoy = new Date();
  const estado = calcularEstado({ ingresoEmpleo: salario, movimientos, recurrentes, creditos, hoy, config });
  const hist = historialAhorro({ movimientos, ingresoEmpleo: salario, creditos, hoy, meses: 1 });
  const mesAct = hist[hist.length - 1] || {};
  const catComp = gastoCategoriasComparado({ movimientos, hoy, top: 5 });

  const facts = {
    salario,
    plataDelMes: estado.plataDelMes,
    saldoDisponible: estado.saldoDisponible,
    gastadoTotal: estado.gastadoTotal,
    fijosDelMes: estado.fijosDelMes,
    cuotasCredito: mesAct.cuotasCredito,
    netoMes: mesAct.neto,
    etiquetaSemaforo: estado.etiqueta,
    topCategorias: (catComp.filas || []).map((f) => ({ label: categoriaPorId(f.categoriaId).label, total: f.actual })),
    creditos: (creditos || []).filter((c) => c && c.activo).map((c) => ({
      entidad: c.entidad, producto: c.producto, cuotaMensual: c.cuotaMensual, saldo: c.saldo, tasaEA: c.tasaEA,
    })),
  };
  return {
    contexto: construirContexto(facts),
    nombre: (config && config.nombre) || '',
    apiKey: (config && config.apiKey) || '',
  };
}

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
      <header class="view-greet asesor-greet">
        <div class="asesor-orb-big">${ORB}</div>
        <div>
          <p class="view-greet__eyebrow">Tu conciencia financiera</p>
          <h1 class="view-greet__title">Asesor</h1>
        </div>
      </header>
      <p class="asesor-intro">Sin filtro. Te digo la verdad cruda de tus números — para que reacciones, no para que te sientas bien.</p>
      <div class="chat-scroll" id="chat-scroll">
        <div class="chat-suggest" id="chat-suggest">${chips}</div>
      </div>
      <form class="chat-bar" id="chat-form">
        <input type="text" class="chat-input" id="chat-input" placeholder="Pregúntale a tu conciencia…" autocomplete="off" enterkeyhint="send" aria-label="Escribe tu pregunta" />
        <button type="submit" class="chat-send" id="chat-send" aria-label="Enviar">${SEND}</button>
      </form>`;
  },

  mount(root) {
    const scroll = root.querySelector('#chat-scroll');
    const suggest = root.querySelector('#chat-suggest');
    const form = root.querySelector('#chat-form');
    const input = root.querySelector('#chat-input');
    const historial = [];   // {rol, texto}
    let ctx = null;         // {contexto, nombre, apiKey}
    let ocupado = false;

    armarContexto().then((c) => { ctx = c; }).catch(() => { ctx = null; });

    const irAlFondo = () => { scroll.scrollTop = scroll.scrollHeight; };

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
