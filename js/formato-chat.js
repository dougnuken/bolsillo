/* ============================================================
   olbo · formato-chat.js — la respuesta de la conciencia, legible

   El chat escapaba el texto entero y lo metía en un div. Como el modelo
   responde con markdown por costumbre, en pantalla salían los asteriscos
   crudos y los encabezados con almohadillas: por eso se leía desordenado.

   Aquí se convierte un SUBCONJUNTO mínimo de markdown a HTML. Mínimo a
   propósito: cuanto menos se interprete, menos superficie hay que asegurar, y
   con `white-space: pre-wrap` en la burbuja los saltos y la sangría ya
   funcionan solos.

   SEGURIDAD: se escapa TODO primero y solo después se insertan las etiquetas
   sobre el texto ya escapado. El modelo nunca puede inyectar HTML, ni aunque
   lo intente a propósito o se lo pidan desde un extracto manipulado.

   PURO y testeable.
   ============================================================ */

import { esc } from './html.js';

/* Negrita: **así**. Se aplica sobre texto YA escapado, así que el contenido
   no puede traer etiquetas. Sin anidar y sin cruzar saltos de línea. */
const NEGRITA = /\*\*([^*\n]+)\*\*/g;
/* Cursiva con _guion bajo_. Los asteriscos simples se dejan quietos: aparecen
   en nombres de comercio de los extractos (TIENDA*DEMO) y romperían el texto. */
const CURSIVA = /(^|[\s(])_([^_\n]+)_(?=[\s.,;:!?)]|$)/g;
/* Encabezados markdown: no se renderizan como títulos —desentonan en una
   burbuja de chat— sino como una línea en negrita. */
const ENCABEZADO = /^\s{0,3}#{1,6}\s+(.*)$/;
/* Viñetas: -, * o • al empezar la línea. Se unifican en · , que es la que ya
   usa el resto de la app. */
const VINETA = /^(\s*)[-*•]\s+(?=\S)/;

/**
 * Convierte la respuesta del modelo en HTML seguro para la burbuja.
 * @param {string} texto
 * @returns {string} HTML
 */
export function renderRespuesta(texto) {
  const crudo = typeof texto === 'string' ? texto : '';
  if (!crudo.trim()) return '';

  return crudo
    .split('\n')
    .map((linea) => {
      const enc = linea.match(ENCABEZADO);
      // El encabezado se escapa aparte porque su contenido va dentro del <strong>.
      if (enc) return `<strong>${marcar(esc(enc[1]))}</strong>`;
      const conVineta = linea.replace(VINETA, '$1· ');
      return marcar(esc(conVineta));
    })
    .join('\n');
}

/** Aplica el marcado inline sobre texto YA escapado. PURA. */
function marcar(escapado) {
  return escapado
    .replace(NEGRITA, '<strong>$1</strong>')
    .replace(CURSIVA, '$1<em>$2</em>');
}

/**
 * Texto plano de una respuesta, para lo que no debe llevar marcado (el eco de
 * un mensaje, un aria-label, el historial que se reenvía al modelo). PURA.
 */
export function soloTexto(texto) {
  const crudo = typeof texto === 'string' ? texto : '';
  return crudo
    .split('\n')
    .map((l) => l.replace(ENCABEZADO, '$1').replace(VINETA, '$1· ').replace(/\*\*/g, ''))
    .join('\n');
}
