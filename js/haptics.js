/* ============================================================
   Bolsillo · haptics.js
   Vibración sutil para feedback de avisos. OJO: la Vibration API
   (navigator.vibrate) funciona en Android; iOS Safari / PWA NO la
   soporta, así que en iPhone es un no-op silencioso. Feature-detected
   y envuelto en try/catch: nunca lanza ni molesta donde no existe.
   ============================================================ */

/** @param {number|number[]} patron  ms, o patrón [vibra, pausa, vibra, …] */
export function vibrar(patron) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(patron);
    }
  } catch { /* noop */ }
}

/* Presets semánticos. */
export const hapticOk = () => vibrar(16);
export const hapticError = () => vibrar([14, 50, 14]);
export const hapticSusurro = () => vibrar([10, 30, 10]);
