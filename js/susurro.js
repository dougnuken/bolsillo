/* ============================================================
   Bolsillo · susurro.js
   El "susurro por movimiento": tras registrar un GASTO, el agente
   suelta UNA frase cruda sobre ese gasto a la luz de tus números.
   Reusa el cerebro (conciencia.js) y el contexto (agente-datos.js).
   Silencioso si no hay clave (no molesta en cada guardado).
   ============================================================ */

import { aconsejar } from './conciencia.js';
import { armarContexto } from './agente-datos.js';
import { categoriaPorId } from './categories.js';
import { hapticSusurro } from './haptics.js';

const SPARK =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2.5l1.7 4.6a4 4 0 0 0 2.4 2.4l4.6 1.7-4.6 1.7a4 4 0 0 0-2.4 2.4L13 20.5l-1.7-4.6a4 4 0 0 0-2.4-2.4L4.3 11.8l4.6-1.7a4 4 0 0 0 2.4-2.4L13 2.5Z"/></svg>';

let actual = null;
let timer = null;

/**
 * Susurra sobre un gasto recién guardado. No-op si no es gasto, no hay monto,
 * o no hay clave configurada. No lanza nunca (falla en silencio).
 * @param {object} mov  movimiento recién creado
 */
export async function susurrar(mov) {
  if (!mov || mov.tipo !== 'gasto' || !(mov.monto > 0)) return;
  let ctx;
  try { ctx = await armarContexto(); } catch { return; }
  if (!ctx || !ctx.apiKey) return; // sin clave: susurro silencioso

  let r;
  try {
    r = await aconsejar({
      contexto: ctx.contexto,
      nombre: ctx.nombre,
      modo: 'susurro',
      movimiento: {
        monto: mov.monto,
        comercio: mov.comercio,
        categoriaLabel: categoriaPorId(mov.categoria).label,
      },
      apiKey: ctx.apiKey,
    });
  } catch { return; }
  if (!r || r.estado !== 'ok' || !r.texto) return;
  mostrar(r.texto);
}

function mostrar(texto) {
  cerrar();
  const el = document.createElement('div');
  el.className = 'susurro';
  el.setAttribute('role', 'status');
  el.innerHTML =
    `<span class="susurro__spark">${SPARK}</span>` +
    '<span class="susurro__txt"></span>' +
    '<button type="button" class="susurro__x" aria-label="Descartar">&times;</button>';
  el.querySelector('.susurro__txt').textContent = texto;

  // Tap en la tarjeta → abre el chat para seguir. Tap en la × → solo cierra.
  el.addEventListener('click', (e) => {
    if (e.target.closest('.susurro__x')) { cerrar(); return; }
    cerrar();
    location.hash = '#/asesor';
  });

  document.body.appendChild(el);   // la animación de entrada (susurroIn) corre sola
  actual = el;
  hapticSusurro();                 // buzz sutil (Android; no-op en iOS)
  timer = setTimeout(cerrar, 7000);
}

function cerrar() {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!actual) return;
  const el = actual;
  actual = null;
  el.classList.add('is-leaving');  // dispara la animación de salida (susurroOut)
  const quitar = () => el.remove();
  el.addEventListener('animationend', quitar, { once: true });
  setTimeout(quitar, 500);
}
