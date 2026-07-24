/* ============================================================
   Bolsillo · extracto-pdf.js
   Lee el EXTRACTO (PDF) de una tarjeta de crédito con Claude y devuelve
   { corte, limite, tasa, total, banco } para PRELLENAR la ficha del
   ciclo (el usuario siempre revisa y confirma antes de guardar).

   Gemelo de voz-gasto.js / foto-gasto.js: mismo patrón de red y de manejo
   de errores, cambiando la ENTRADA (un PDF como bloque `document`) y el
   CONTRATO de salida (una herramienta tool_use forzada).

   SEGURIDAD (igual que anthropic.js / foto-gasto.js):
   - La clave viaja SOLO en el header `x-api-key`. Nunca en URL, query,
     cuerpo serializado ni logs.
   - Los mensajes de error son literales fijos: NO interpolan la clave.
   - `construirPeticionExtracto` y `normalizarExtracto` son PURAS (Node).
   - `analizarExtracto` recibe `fetchImpl` por inyección.

   Reutiliza las constantes de red y `extraerToolUse` (cero duplicación),
   `parseCOP` (money.js) para el total y `tasaEAaMV` (model.js) para pasar
   una tasa Efectiva Anual a Mensual Vencida cuando el banco solo da la EA.
   ============================================================ */

import { ANTHROPIC_MESSAGES_URL, ANTHROPIC_VERSION } from './foto-gasto.js';
import { extraerToolUse } from './voz-gasto.js';
import { parseCOP } from './money.js';
import { tasaEAaMV } from './model.js';

/* Los extractos son PDFs "densos": Sonnet lee tablas y encabezados mejor.
   El usuario puede sobreescribirlo en config.modelos.extractos. */
export const MODELO_EXTRACTO_DEFAULT = 'claude-sonnet-5';

/* Herramienta que el modelo DEBE llamar (tool_choice forzado). */
export const TOOL_EXTRACTO = Object.freeze({
  name: 'registrar_extracto',
  description:
    'Registra los datos del ciclo de una tarjeta de crédito leídos de su extracto/estado de cuenta.',
  input_schema: {
    type: 'object',
    properties: {
      corte: {
        type: ['integer', 'null'],
        description: 'Día del mes de la FECHA DE CORTE / facturación (1 a 31). null si no aparece.',
      },
      limite: {
        type: ['integer', 'null'],
        description: 'Día del mes de la FECHA LÍMITE / máxima de pago (1 a 31). null si no aparece.',
      },
      tasa: {
        type: ['number', 'null'],
        description: 'Tasa de interés de la tarjeta en porcentaje (solo el número, ej. 2.1 o 26.5). null si no aparece.',
      },
      esAnual: {
        type: 'boolean',
        description: 'true si la tasa reportada es Efectiva Anual (E.A.); false si es mensual (M.V.).',
      },
      total: {
        type: ['integer', 'null'],
        description: 'Pago total / total a pagar del extracto, en pesos COP enteros (sin puntos ni símbolos). null si no aparece.',
      },
      banco: {
        type: 'string',
        description: 'Nombre del banco o emisor de la tarjeta si aparece, o cadena vacía.',
      },
      encontrado: {
        type: 'boolean',
        description: 'true si el documento es de verdad un extracto de tarjeta y pudiste leer al menos el corte o el límite de pago.',
      },
    },
    required: ['encontrado'],
  },
});

/* Instrucciones del sistema (compartidas por el camino documento y el de
   imágenes: "el documento" cubre ambas entradas). */
export const SISTEMA_EXTRACTO = [
  'Eres un lector de extractos (estados de cuenta) de tarjetas de crédito de Colombia.',
  'Lee el documento y llama SIEMPRE a la herramienta registrar_extracto con lo que encuentres.',
  'FECHA DE CORTE (o "fecha de facturación"): devuelve solo el DÍA del mes (1 a 31) en "corte".',
  'FECHA LÍMITE DE PAGO (o "fecha máxima/límite de pago", "paga hasta"): devuelve solo el DÍA (1 a 31) en "limite".',
  'TASA de interés: devuelve el número en "tasa". Si el extracto la reporta como Efectiva Anual (E.A.) pon esAnual=true; si es mensual (M.V.) pon esAnual=false.',
  'TOTAL: el "pago total" o "total a pagar" del período, entero en pesos COP.',
  'No inventes datos que no estén en el documento: lo que no encuentres va como null (o cadena vacía en "banco").',
  'Si el documento NO es un extracto de tarjeta, pon encontrado=false.',
].join('\n');

const TEXTO_INSTRUCCION = 'Extrae el ciclo de esta tarjeta con la herramienta.';

function cuerpoBase(modelo, content) {
  return {
    model: modelo || MODELO_EXTRACTO_DEFAULT,
    max_tokens: 500,
    system: SISTEMA_EXTRACTO,
    tools: [TOOL_EXTRACTO],
    tool_choice: { type: 'tool', name: TOOL_EXTRACTO.name },
    messages: [{ role: 'user', content }],
  };
}

/**
 * Construye el cuerpo de /v1/messages para leer un extracto como PDF crudo
 * (bloque `document`). PURA. Solo sirve para PDFs SIN cifrar.
 * @param {{base64:string, mediaType?:string, modelo?:string}} p
 */
export function construirPeticionExtracto({ base64, mediaType = 'application/pdf', modelo }) {
  return cuerpoBase(modelo, [
    { type: 'document', source: { type: 'base64', media_type: mediaType, data: base64 } },
    { type: 'text', text: TEXTO_INSTRUCCION },
  ]);
}

/**
 * Construye el cuerpo con IMÁGENES (páginas del PDF ya rendidas y descifradas
 * por pdf.js). PURA. Es el camino real: soporta extractos protegidos con clave.
 * @param {{imagenes:Array<{base64:string, mediaType?:string}>, modelo?:string}} p
 */
export function construirPeticionExtractoImagenes({ imagenes = [], modelo }) {
  const content = imagenes.map((im) => ({
    type: 'image',
    source: { type: 'base64', media_type: (im && im.mediaType) || 'image/jpeg', data: im && im.base64 },
  }));
  content.push({ type: 'text', text: TEXTO_INSTRUCCION });
  return cuerpoBase(modelo, content);
}

/** Día del mes válido (1..31) o null. PURA. */
function diaValido(v) {
  const n = typeof v === 'number' ? v : (typeof v === 'string' ? parseInt(v, 10) : NaN);
  return Number.isInteger(n) && n >= 1 && n <= 31 ? n : null;
}

/**
 * Normaliza el `input` de la herramienta a { corte, limite, tasa, total,
 * banco, encontrado }. PURA y tolerante: nunca lanza. Convierte tasa E.A.→
 * mensual cuando esAnual=true.
 */
export function normalizarExtracto(input) {
  const obj = input && typeof input === 'object' ? input : {};

  const corte = diaValido(obj.corte);
  const limite = diaValido(obj.limite);

  let tasa = null;
  const tRaw = typeof obj.tasa === 'number' ? obj.tasa
    : (typeof obj.tasa === 'string' ? parseFloat(obj.tasa.replace(',', '.')) : NaN);
  if (Number.isFinite(tRaw) && tRaw > 0 && tRaw < 100) {
    const mensual = obj.esAnual === true ? tasaEAaMV(tRaw) : tRaw;
    tasa = Math.round(mensual * 100) / 100; // 2 decimales
  }

  let total = null;
  if (typeof obj.total === 'number' && Number.isFinite(obj.total)) total = Math.round(obj.total);
  else if (typeof obj.total === 'string') { const p = parseCOP(obj.total); if (Number.isInteger(p)) total = p; }
  if (total != null && total <= 0) total = null;

  const banco = typeof obj.banco === 'string' ? obj.banco.trim().slice(0, 40) : '';
  const encontrado = obj.encontrado === true;

  return { corte, limite, tasa, total, banco, encontrado };
}

/**
 * Envía un cuerpo ya armado a /v1/messages y normaliza la respuesta a los
 * estados públicos. IMPURA (red). PRIVADA: la comparten los caminos documento
 * e imágenes. La clave viaja SOLO en x-api-key.
 */
async function enviarExtracto(body, key, doFetch) {
  let res;
  try {
    res = await doFetch(ANTHROPIC_MESSAGES_URL, {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch {
    return { estado: 'red', mensaje: 'No se pudo leer el extracto: revisa tu conexión e intenta de nuevo.' };
  }

  if (res.status === 401 || res.status === 403) {
    return { estado: 'invalida', mensaje: 'Clave inválida. Revísala en Perfil.' };
  }
  if (!res.ok) {
    return { estado: 'error', mensaje: `No se pudo leer el extracto (HTTP ${res.status}).` };
  }

  let cuerpo;
  try { cuerpo = await res.json(); } catch { return { estado: 'error', mensaje: 'La respuesta no se pudo leer.' }; }

  const input = extraerToolUse(cuerpo);
  if (!input) return { estado: 'error', mensaje: 'No entendí el extracto. Ingrésalo a mano.' };

  const datos = normalizarExtracto(input);
  if (!datos.encontrado && datos.corte == null && datos.limite == null) {
    return { estado: 'sin-datos', mensaje: 'No parece un extracto de tarjeta. Ingresa el ciclo a mano.' };
  }
  return { estado: 'ok', ...datos };
}

/**
 * Lee un extracto enviando el PDF crudo (bloque `document`). Solo sirve para
 * PDFs SIN cifrar. IMPURA (red). `fetchImpl` inyectable.
 *
 * @param {{base64:string, mediaType?:string, apiKey:string, modelo?:string}} p
 * @param {{fetchImpl?: typeof fetch}} [opts]
 * @returns {Promise<{estado:'ok'|'sin-clave'|'sin-datos'|'invalida'|'red'|'error', mensaje?:string, corte?, limite?, tasa?, total?, banco?, encontrado?}>}
 */
export async function analizarExtracto({ base64, mediaType, apiKey, modelo }, { fetchImpl } = {}) {
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (key === '') {
    return { estado: 'sin-clave', mensaje: 'Configura tu clave de Anthropic en Perfil → Clave de Anthropic.' };
  }
  if (typeof base64 !== 'string' || base64 === '') {
    return { estado: 'error', mensaje: 'No se pudo leer el PDF.' };
  }
  const doFetch = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!doFetch) return { estado: 'error', mensaje: 'Este entorno no puede hacer peticiones de red.' };

  return enviarExtracto(construirPeticionExtracto({ base64, mediaType, modelo }), key, doFetch);
}

/**
 * Lee un extracto a partir de IMÁGENES (páginas del PDF ya descifradas y
 * rendidas por pdf.js). Este es el camino real de la app: soporta extractos
 * protegidos con contraseña. IMPURA (red). `fetchImpl` inyectable.
 *
 * @param {{imagenes:Array<{base64:string, mediaType?:string}>, apiKey:string, modelo?:string}} p
 * @param {{fetchImpl?: typeof fetch}} [opts]
 * @returns {Promise<{estado:'ok'|'sin-clave'|'sin-datos'|'invalida'|'red'|'error', mensaje?:string, corte?, limite?, tasa?, total?, banco?, encontrado?}>}
 */
export async function analizarExtractoImagenes({ imagenes, apiKey, modelo }, { fetchImpl } = {}) {
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (key === '') {
    return { estado: 'sin-clave', mensaje: 'Configura tu clave de Anthropic en Perfil → Clave de Anthropic.' };
  }
  if (!Array.isArray(imagenes) || imagenes.length === 0) {
    return { estado: 'error', mensaje: 'No se pudo leer el PDF.' };
  }
  const doFetch = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!doFetch) return { estado: 'error', mensaje: 'Este entorno no puede hacer peticiones de red.' };

  return enviarExtracto(construirPeticionExtractoImagenes({ imagenes, modelo }), key, doFetch);
}
