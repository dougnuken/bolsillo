/* ============================================================
   Bolsillo · views/asesor.js
   "Cuarto de conciencia": chat a pantalla completa con la voz cruda.
   Al entrar, la app oculta navbar + header (body[data-route=asesor]),
   así que esto es un espacio íntimo solo con el agente. El cerebro
   (contexto + persona + llamada) vive en conciencia.js.

   ADJUNTOS (núcleo de la vista): un PDF se descifra en el teléfono
   (pdf.js), se rinde a imágenes y viaja con la pregunta. Tres reglas que
   se ganaron a golpes:
     1) el documento queda PEGADO a la conversación — las repreguntas lo
        siguen viendo (antes se perdía en el primer turno),
     2) al adjuntarlo, la conciencia PREGUNTA de cuál crédito es: sin eso
        aconseja a ciegas sobre una deuda que ya tiene registrada,
     3) si el documento es de un crédito, ofrece actualizar esa ficha con
        lo que diga el extracto (saldo / tasa / día de pago).
   ============================================================ */

import { aconsejar, MAX_PAGINAS_CHAT } from '../conciencia.js';
import { renderRespuesta } from '../formato-chat.js';
import { armarContexto } from '../agente-datos.js';
import { elegirArchivoPDF, abrirConClave, CANCELADO } from '../pdf-picker.js';
import { paginasAImagenes } from '../pdf-render.js';
import { analizarExtractoImagenes } from '../extracto-pdf.js';
import { corteDesdeExtracto } from '../ingesta-corte.js';
import { put } from '../db.js';
import { actualizar, tasaEAaMV } from '../model.js';
import { formatCOP } from '../money.js';
import { confirmar } from '../overlay.js';
import { toast } from '../toast.js';
import { esc } from '../html.js';

/* Spark de IA (dos destellos: uno grande, uno chico). */
const SPARK =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2.5l1.7 4.6a4 4 0 0 0 2.4 2.4l4.6 1.7-4.6 1.7a4 4 0 0 0-2.4 2.4L13 20.5l-1.7-4.6a4 4 0 0 0-2.4-2.4L4.3 11.8l4.6-1.7a4 4 0 0 0 2.4-2.4L13 2.5Z"/><path d="M5.5 3.2l.6 1.6a2 2 0 0 0 1.1 1.1l1.6.6-1.6.6a2 2 0 0 0-1.1 1.1l-.6 1.6-.6-1.6A2 2 0 0 0 3.8 8.1l-1.6-.6 1.6-.6a2 2 0 0 0 1.1-1.1l.6-1.6Z"/></svg>';
const ICON_BACK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>';
const SEND =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12l16-8-6 16-2.5-6.5L4 12Z"/></svg>';
const CLIP =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5 12.5 20a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L10 16.9a1.6 1.6 0 0 1-2.3-2.3l7.8-7.8"/></svg>';

const SUGERENCIAS = [
  '¿Cuánto puedo gastar hoy sin cagarla?',
  '¿Me alcanza para pagar los créditos este mes?',
  'Dime la verdad de mi mes',
];

const NINGUNO = '__ninguno__';

function burbujaHTML(rol, texto) {
  const esIA = rol === 'assistant';
  // Solo la respuesta de la conciencia pasa por el marcado: lo que escribe el
  // usuario se muestra tal cual lo escribió, sin interpretarle nada.
  const cuerpo = esIA ? renderRespuesta(texto) : esc(texto);
  return `<div class="chat-msg chat-msg--${esIA ? 'ia' : 'yo'}">${cuerpo}</div>`;
}

/** Nombre corto de un crédito para chips y etiquetas. PURA. */
function nombreCredito(c) {
  if (!c) return '';
  const producto = (c.producto || c.tipo || '').trim();
  return [(c.entidad || '').trim(), producto].filter(Boolean).join(' · ') || 'Crédito';
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
          <button type="button" class="btn btn--ghost btn--head btn--back" id="asesor-back">${ICON_BACK}<span>Hoy</span></button>
          <span class="asesor-top__title"><span class="asesor-top__spark">${SPARK}</span>Tu conciencia</span>
          <span class="btn btn--ghost btn--head btn--back asesor-top__pad" aria-hidden="true">${ICON_BACK}<span>Hoy</span></span>
        </header>
        <div class="chat-scroll" id="chat-scroll">
          <div class="asesor-hello">
            <div class="asesor-orb-big">${SPARK}</div>
            <p class="asesor-intro">Sin filtro. Te digo la verdad cruda de tus números — para que reacciones, no para que te sientas bien.</p>
          </div>
          <div class="chat-suggest" id="chat-suggest">${chips}</div>
        </div>
        <form class="chat-bar" id="chat-form">
          <div class="chat-adjunto" id="chat-adjunto" hidden>
            <span class="chat-adjunto__ic">${CLIP}</span>
            <span class="chat-adjunto__name" id="chat-adjunto-name"></span>
            <button type="button" class="chat-adjunto__x" id="chat-adjunto-x" aria-label="Quitar adjunto">&times;</button>
          </div>
          <div class="chat-bar__row">
            <button type="button" class="chat-attach" id="chat-attach" aria-label="Adjuntar un PDF (extracto)">${CLIP}</button>
            <input type="text" class="chat-input" id="chat-input" placeholder="Escríbele a tu conciencia…" autocomplete="off" enterkeyhint="send" aria-label="Escribe tu pregunta" />
            <button type="submit" class="chat-send" id="chat-send" aria-label="Enviar">${SEND}</button>
          </div>
        </form>
      </section>`;
  },

  mount(root) {
    const scroll = root.querySelector('#chat-scroll');
    const suggest = root.querySelector('#chat-suggest');
    const form = root.querySelector('#chat-form');
    const input = root.querySelector('#chat-input');
    const back = root.querySelector('#asesor-back');
    const historial = [];   // {rol, texto, imagenes?, credito?, sinCredito?}
    let ctx = null;         // {contexto, nombre, apiKey, modelo, creditos…}
    let ocupado = false;

    if (back) back.addEventListener('click', () => { location.hash = '#/hoy'; });

    const cargarCtx = () => armarContexto().then((c) => { ctx = c; return c; }).catch(() => { ctx = null; return null; });
    cargarCtx();

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
      return scroll.lastElementChild;
    }

    /* ---------- adjunto: un PDF (extracto) → imágenes que el agente lee ---------- */
    const attachBtn = root.querySelector('#chat-attach');
    const adjEl = root.querySelector('#chat-adjunto');
    const adjName = root.querySelector('#chat-adjunto-name');
    const adjX = root.querySelector('#chat-adjunto-x');
    // { imagenes, nombre, paginas, credito:(obj|null), sinCredito:boolean }
    let adjunto = null;
    let bloqueVinculo = null;   // la pregunta "¿de cuál crédito es?" en curso

    const etiquetaAdjunto = () => {
      if (!adjunto) return '';
      const partes = [adjunto.nombre, `${adjunto.paginas} ${adjunto.paginas === 1 ? 'pág.' : 'págs.'}`];
      if (adjunto.credito) partes.push(nombreCredito(adjunto.credito));
      else if (adjunto.sinCredito) partes.push('sin crédito');
      return partes.join(' · ');
    };
    const pintarAdjunto = (textoDirecto) => {
      if (adjName) adjName.textContent = textoDirecto != null ? textoDirecto : etiquetaAdjunto();
      if (adjEl) adjEl.hidden = false;
    };
    const limpiarAdjunto = () => {
      adjunto = null;
      if (adjEl) adjEl.hidden = true;
      if (adjName) adjName.textContent = '';
      if (bloqueVinculo) { bloqueVinculo.remove(); bloqueVinculo = null; }
    };
    if (adjX) adjX.addEventListener('click', limpiarAdjunto);

    /* La conciencia pregunta —en el chat, no en un modal— de cuál crédito es el
       documento. Sin esto el consejo sale desconectado de la deuda real. */
    function preguntarPorCredito() {
      const creditos = (ctx && Array.isArray(ctx.creditos) ? ctx.creditos : []);
      if (!creditos.length) return;   // nada que vincular: no se molesta al usuario

      const chips = creditos.map((c) => `
        <button class="chat-chip" type="button" data-credito="${esc(c.id)}">${esc(nombreCredito(c))}</button>`).join('')
        + `<button class="chat-chip" type="button" data-credito="${NINGUNO}">No es de ninguno</button>`;

      const wrap = document.createElement('div');
      wrap.className = 'chat-ask';
      wrap.innerHTML =
        '<div class="chat-msg chat-msg--ia">Antes de leerlo: ¿este documento es de alguno de tus créditos? '
        + 'Dímelo y cuadro lo que dice el extracto con lo que tengo guardado.</div>'
        + `<div class="chat-ask__chips">${chips}</div>`;
      scroll.appendChild(wrap);
      bloqueVinculo = wrap;
      if (suggest && !suggest.hidden) suggest.hidden = true;
      irAlFondo();

      wrap.querySelectorAll('[data-credito]').forEach((b) => {
        b.addEventListener('click', () => {
          if (!adjunto) { wrap.remove(); bloqueVinculo = null; return; }
          const id = b.dataset.credito;
          if (id === NINGUNO) {
            adjunto.credito = null;
            adjunto.sinCredito = true;
          } else {
            adjunto.credito = creditos.find((c) => c.id === id) || null;
            adjunto.sinCredito = false;
          }
          wrap.querySelector('.chat-ask__chips').remove();
          const eco = document.createElement('div');
          eco.className = 'chat-msg chat-msg--yo';
          eco.textContent = adjunto.credito ? `Es de ${nombreCredito(adjunto.credito)}` : 'No es de ninguno';
          wrap.appendChild(eco);
          bloqueVinculo = null;
          pintarAdjunto();
          irAlFondo();
          input.focus();
        });
      });
    }

    if (attachBtn) attachBtn.addEventListener('click', async () => {
      if (ocupado) return;
      const picked = await elegirArchivoPDF();          // SÍNCRONO hasta el picker (iOS)
      if (!picked) return;
      if (picked.error) { toast(picked.error, { icono: false }); return; }
      if (bloqueVinculo) { bloqueVinculo.remove(); bloqueVinculo = null; }
      pintarAdjunto('Leyendo PDF…');
      let pdfDoc;
      try { pdfDoc = await abrirConClave(picked.bytes); }
      catch (e) { limpiarAdjunto(); if (e !== CANCELADO) toast('No se pudo abrir el PDF', { icono: false }); return; }
      let imagenes = [];
      try { imagenes = await paginasAImagenes(pdfDoc, { maxPag: MAX_PAGINAS_CHAT }); }
      catch { limpiarAdjunto(); toast('No se pudo procesar el PDF', { icono: false }); return; }
      if (!imagenes.length) { limpiarAdjunto(); toast('El PDF no tiene páginas legibles', { icono: false }); return; }

      adjunto = { imagenes, nombre: 'Documento', paginas: imagenes.length, credito: null, sinCredito: false };
      pintarAdjunto();
      if (!ctx) await cargarCtx();
      preguntarPorCredito();
      input.focus();
    });

    /* ---------- actualizar el crédito con lo que diga el extracto ---------- */
    async function actualizarCreditoDesde(credito, imagenes, boton) {
      if (!ctx || !ctx.apiKey) { toast('Necesitas tu clave de Anthropic', { icono: false }); return; }
      const original = boton.textContent;
      boton.disabled = true;
      boton.textContent = 'Leyendo el extracto…';

      const r = await analizarExtractoImagenes({
        imagenes, apiKey: ctx.apiKey, modelo: ctx.modeloExtractos || undefined,
      });
      boton.disabled = false;
      boton.textContent = original;

      if (r.estado !== 'ok') { toast(r.mensaje || 'No pude leer el extracto', { icono: false, ms: 3200 }); return; }

      // Además de actualizar la ficha: guarda el CORTE (diferidos) para el
      // seguimiento mes a mes. Best-effort: si el extracto no trae diferidos o
      // fecha de corte, no estorba la actualización del crédito.
      try {
        const ing = corteDesdeExtracto(r, { entidad: credito.entidad, producto: credito.producto || credito.tipo });
        if (ing.ok) {
          await put('cortes', ing.corte);
          agregar('assistant', `Guardé el corte de ${ing.corte.corte} con ${ing.corte.diferidos.length} diferidos. Ya te puedo seguir la deuda mes a mes: pregúntame “¿cómo va mi deuda?” cuando quieras.`);
        }
      } catch (e) { /* la ingesta del corte no debe tumbar la actualización de la ficha */ }

      const campos = {};
      const cambios = [];
      if (r.saldo != null && r.saldo !== credito.saldo) {
        campos.saldo = r.saldo;
        cambios.push(`Saldo: ${credito.saldo != null ? formatCOP(credito.saldo) : '—'} → ${formatCOP(r.saldo)}`);
      }
      if (r.tasaAnual != null && r.tasaAnual !== credito.tasaEA) {
        campos.tasaEA = r.tasaAnual;
        campos.tasaMV = tasaEAaMV(r.tasaAnual);
        cambios.push(`Tasa: ${credito.tasaEA != null ? credito.tasaEA + '% EA' : '—'} → ${r.tasaAnual}% EA`);
      }
      if (r.limite != null && r.limite !== credito.diaPago) {
        campos.diaPago = r.limite;
        cambios.push(`Día de pago: ${credito.diaPago != null ? credito.diaPago : '—'} → ${r.limite}`);
      }
      if (!cambios.length) { toast('El extracto no cambia nada de ese crédito'); return; }

      const ok = await confirmar({
        title: `Actualizar ${nombreCredito(credito)}`,
        text: cambios.join(' · '),
        okText: 'Actualizar',
      });
      if (!ok) return;

      try {
        const guardado = actualizar(credito, campos);
        await put('creditos', guardado);
        await cargarCtx();                       // el contexto del chat queda al día
        Object.assign(credito, campos);          // el chip refleja lo guardado
        toast('Crédito actualizado');
        agregar('assistant', `Listo: actualicé ${nombreCredito(credito)} con el extracto. ${cambios.join(' · ')}`);
      } catch (err) {
        toast('No se pudo guardar: ' + err.message, { icono: false, ms: 3200 });
      }
    }

    function ofrecerActualizar(credito, imagenes) {
      const wrap = document.createElement('div');
      wrap.className = 'chat-ask';
      wrap.innerHTML = `<div class="chat-ask__chips"><button class="chat-chip" type="button">Actualizar ${esc(nombreCredito(credito))} con este extracto</button></div>`;
      scroll.appendChild(wrap);
      irAlFondo();
      const boton = wrap.querySelector('button');
      boton.addEventListener('click', () => actualizarCreditoDesde(credito, imagenes, boton));
    }

    /* ---------- enviar ---------- */
    async function preguntar(texto) {
      const q = String(texto || '').trim();
      if ((!q && !adjunto) || ocupado) return;
      ocupado = true;
      input.value = '';
      const doc = adjunto;
      limpiarAdjunto();
      agregar('user', (q || 'Te adjunté un documento.') + (doc ? '  📎' : ''));

      // burbuja "pensando…"
      const pensando = document.createElement('div');
      pensando.className = 'chat-msg chat-msg--ia chat-msg--wait';
      pensando.innerHTML = '<span></span><span></span><span></span>';
      scroll.appendChild(pensando);
      irAlFondo();

      if (!ctx) await cargarCtx();

      let r;
      try {
        r = await aconsejar({
          contexto: ctx ? ctx.contexto : '',
          nombre: ctx ? ctx.nombre : '',
          modo: 'chat',
          pregunta: q,
          imagenes: doc ? doc.imagenes : null,
          creditoVinculado: doc ? doc.credito : null,
          sinCredito: doc ? doc.sinCredito : false,
          historialChat: historial.slice(-8),
          apiKey: ctx ? ctx.apiKey : '',
          modelo: ctx ? ctx.modelo : '',
        });
      } catch {
        r = { estado: 'error', mensaje: 'Algo falló. Intenta de nuevo.' };
      }
      pensando.remove();

      if (r.estado === 'ok') {
        historial.push(
          {
            rol: 'user',
            texto: q || '(documento adjunto)',
            imagenes: doc ? doc.imagenes : null,
            credito: doc ? doc.credito : null,
            sinCredito: doc ? doc.sinCredito : false,
          },
          { rol: 'assistant', texto: r.texto },
        );
        agregar('assistant', r.texto);
        if (doc && doc.credito) ofrecerActualizar(doc.credito, doc.imagenes);
      } else {
        agregar('assistant', r.estado === 'sin-clave'
          ? 'Necesito tu clave de Anthropic para hablarte con datos. Actívala en Perfil → Clave de Anthropic.'
          : (r.mensaje || 'No pude responder. Intenta de nuevo.'));
        // Falló: el adjunto vuelve al campo. Volver a escoger y descifrar un PDF
        // de 6 páginas por un error de red sería un castigo inmerecido.
        if (doc) { adjunto = doc; pintarAdjunto(); }
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
