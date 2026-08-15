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
import { tasaEAaMV, limpiarReferenciaPago, MAX_PROVEEDOR } from './model.js';
import { normalizarDiferido } from './diferidos.js';

/* Los extractos son PDFs "densos": Sonnet lee tablas y encabezados mejor.
   El usuario puede sobreescribirlo en config.modelos.extractos. */
export const MODELO_EXTRACTO_DEFAULT = 'claude-sonnet-5';

/* Herramienta que el modelo DEBE llamar (tool_choice forzado). */
export const TOOL_EXTRACTO = Object.freeze({
  name: 'registrar_extracto',
  description:
    'Registra los datos de un crédito (tarjeta o préstamo) leídos de su extracto/estado de cuenta.',
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
      saldo: {
        type: ['integer', 'null'],
        description: 'Deuda TOTAL / saldo actual / capital adeudado / cupo utilizado (lo que se DEBE en total, no solo la cuota del mes), en pesos COP enteros. null si no aparece.',
      },
      banco: {
        type: 'string',
        description: 'Nombre del banco o emisor de la tarjeta si aparece, o cadena vacía.',
      },
      corteISO: {
        type: ['string', 'null'],
        description: 'FECHA DE CORTE completa en formato YYYY-MM-DD. null si no aparece.',
      },
      limiteISO: {
        type: ['string', 'null'],
        description: 'FECHA LÍMITE DE PAGO completa en formato YYYY-MM-DD. null si no aparece.',
      },
      pagoAPlazos: {
        type: ['integer', 'null'],
        description: 'PAGO A PLAZOS / pago mínimo para estar al día del periodo, entero COP. null si no aparece.',
      },
      pagoMinimo: {
        type: ['integer', 'null'],
        description: 'PAGO MÍNIMO ALTERNO, si el extracto lo trae aparte, entero COP. null si no aparece.',
      },
      intereses: {
        type: ['integer', 'null'],
        description: 'Intereses corrientes cobrados en el ciclo, entero COP. null si no aparece.',
      },
      diferidos: {
        type: 'array',
        description:
          'Compras DIFERIDAS/a cuotas que siguen con saldo pendiente: las filas con SALDO DIFERIDO > 0 o con PLAZO mayor a 1. NO incluyas pagos, abonos, "GRACIAS POR SU PAGO" ni compras de contado (1 cuota).',
        items: {
          type: 'object',
          properties: {
            descripcion: { type: 'string', description: 'Nombre del comercio/transacción tal cual (ej. AMAZON.COM, ALMACEN XYZ).' },
            compte: { type: 'string', description: 'Número de comprobante si aparece, o cadena vacía.' },
            fecha: { type: ['string', 'null'], description: 'Fecha de la transacción YYYY-MM-DD (usa el año del corte). null si no se ve.' },
            plazo: { type: ['integer', 'null'], description: 'Plazo total en cuotas (ej. 6, 36, 48).' },
            cuotasPendientes: { type: ['integer', 'null'], description: 'Cuotas pendientes por pagar.' },
            saldoCapital: { type: ['number', 'null'], description: 'SALDO DIFERIDO / saldo a capital pendiente de esa compra, entero COP (puede ser 0).' },
            tasaEA: { type: ['number', 'null'], description: 'Tasa % de esa compra si aparece (asume E.A.).' },
          },
          required: ['descripcion'],
        },
      },
      movimientos: {
        type: 'array',
        description:
          'CONSUMOS del ciclo: cada compra/cargo del periodo, incluidas las de UNA sola cuota (contado) que NO entran en "diferidos". '
          + 'NO incluyas pagos ni abonos ("GRACIAS POR SU PAGO", "PAGO PSE", "ABONO"): esos bajan la deuda, no son gasto. '
          + 'Sirven solo para ver en qué se fue la plata de esta tarjeta; no se registran como movimientos de la app.',
        items: {
          type: 'object',
          properties: {
            descripcion: { type: 'string', description: 'Nombre del comercio tal cual aparece.' },
            fecha: { type: ['string', 'null'], description: 'Fecha de la transacción YYYY-MM-DD (usa el año del corte). null si no se ve.' },
            monto: { type: ['number', 'null'], description: 'Valor del consumo, entero COP y positivo.' },
          },
          required: ['descripcion'],
        },
      },
      encontrado: {
        type: 'boolean',
        description: 'true si el documento es un extracto de crédito (tarjeta o préstamo) y pudiste leer al menos el saldo, la cuota o una fecha.',
      },
    },
    required: ['encontrado'],
  },
});

/* Instrucciones del sistema (compartidas por el camino documento y el de
   imágenes: "el documento" cubre ambas entradas). */
export const SISTEMA_EXTRACTO = [
  'Eres un lector de extractos (estados de cuenta) de CRÉDITOS de Colombia: tarjetas de crédito,',
  'créditos de libre inversión, hipotecarios/de vivienda, de vehículo, libranzas y similares.',
  'Lee el documento y llama SIEMPRE a la herramienta registrar_extracto con lo que encuentres.',
  'FECHA DE CORTE (o "fecha de facturación"): devuelve solo el DÍA del mes (1 a 31) en "corte".',
  'FECHA LÍMITE DE PAGO (o "fecha máxima/límite de pago", "paga hasta"): devuelve solo el DÍA (1 a 31) en "limite".',
  'TASA de interés: devuelve el número en "tasa". Si el extracto la reporta como Efectiva Anual (E.A.) pon esAnual=true; si es mensual (M.V.) pon esAnual=false.',
  'TOTAL: el "pago total" o "total a pagar" del período, entero en pesos COP.',
  'SALDO: la DEUDA TOTAL / saldo actual / capital adeudado / cupo utilizado (lo que se debe en TOTAL, no la cuota del mes), entero en pesos COP.',
  'FECHA DE PAGO: si es un préstamo (no tarjeta) puede no haber "corte"; usa el DÍA de la cuota/pago en "limite".',
  'FECHAS COMPLETAS: además del día, devuelve "corteISO" y "limiteISO" como fechas YYYY-MM-DD completas.',
  'PAGOS: "pagoAPlazos" = pago a plazos / pago mínimo para estar al día. "pagoMinimo" = pago mínimo alterno si el extracto lo trae aparte. "intereses" = intereses corrientes del ciclo.',
  'DIFERIDOS: lista en "diferidos" cada compra financiada A CUOTAS que siga con saldo pendiente (filas con SALDO DIFERIDO > 0 o PLAZO mayor a 1). Por cada una: descripcion, compte, fecha (YYYY-MM-DD con el año del corte), plazo, cuotasPendientes, saldoCapital (el SALDO DIFERIDO de esa fila) y tasa si aparece. NO incluyas pagos, abonos, "GRACIAS POR SU PAGO" ni compras de una sola cuota.',
  'MOVIMIENTOS: lista en "movimientos" TODOS los consumos del ciclo, incluidos los de una sola cuota que no van en "diferidos". Por cada uno: descripcion, fecha y monto. Una compra diferida puede aparecer en las dos listas: en "diferidos" con su saldo pendiente y aquí con lo que se consumió. NO incluyas pagos ni abonos: reducen la deuda, no son gasto.',
  'No inventes datos que no estén en el documento: lo que no encuentres va como null (o cadena vacía en "banco"); "diferidos" y "movimientos" vacíos [] si no hay.',
  'Pon encontrado=true si es un estado de cuenta de un crédito (tarjeta o préstamo) y pudiste leer al menos el saldo, la cuota, o una fecha. Solo encontrado=false si NO es un extracto de crédito.',
].join('\n');

const TEXTO_INSTRUCCION = 'Extrae el ciclo de esta tarjeta con la herramienta.';

/* ============================================================
   RECIBO de servicios públicos (energía, agua, gas, internet, telefonía)

   Es una lectura DISTINTA, no un extracto con menos campos: lo que hay que
   sacar de un recibo son otras tres cosas —cuánto, hasta cuándo y con qué
   referencia se paga— y el prompt del extracto empieza diciendo "eres un lector
   de extractos de CRÉDITOS", así que a una factura de la luz le pondría
   encontrado=false. Herramienta y sistema propios; la red se comparte.
   ============================================================ */
export const TOOL_RECIBO = Object.freeze({
  name: 'registrar_recibo',
  description:
    'Registra los datos de un recibo/factura de servicios públicos (energía, agua, gas, aseo, internet, telefonía o televisión).',
  input_schema: {
    type: 'object',
    properties: {
      proveedor: {
        type: 'string',
        description: 'Empresa que presta el servicio, tal como aparece en el recibo (ej. Air-e, Triple A, Gases del Caribe, Movistar). Cadena vacía si no se ve.',
      },
      /* STRING y no integer a propósito: las referencias colombianas llegan a
         20+ dígitos y como número JSON perderían precisión —el banco rechaza un
         dígito cambiado—. Además pueden empezar por cero. */
      referenciaPago: {
        type: ['string', 'null'],
        description: 'REFERENCIA DE PAGO: el número largo que se teclea en el banco o la app. Devuélvelo como TEXTO con solo dígitos, sin espacios ni guiones (el recibo lo imprime separado para leerlo mejor). null si no aparece.',
      },
      valor: {
        type: ['integer', 'null'],
        description: 'TOTAL A PAGAR del recibo pagando a tiempo, en pesos COP enteros (sin puntos ni símbolos). NO el valor con recargo por mora ni el consumo del período. null si no aparece.',
      },
      limite: {
        type: ['integer', 'null'],
        description: 'Día del mes (1 a 31) de la FECHA LÍMITE / oportuna de pago. null si no aparece.',
      },
      limiteISO: {
        type: ['string', 'null'],
        description: 'FECHA LÍMITE DE PAGO completa en formato YYYY-MM-DD. null si no aparece.',
      },
      encontrado: {
        type: 'boolean',
        description: 'true si el documento es un recibo/factura de servicios y pudiste leer al menos el valor, la referencia o la fecha límite.',
      },
    },
    required: ['encontrado'],
  },
});

export const SISTEMA_RECIBO = [
  'Eres un lector de RECIBOS (facturas) de servicios públicos de Colombia: energía, acueducto y',
  'alcantarillado, gas, aseo, internet, telefonía y televisión.',
  'Lee el documento y llama SIEMPRE a la herramienta registrar_recibo con lo que encuentres.',
  'PROVEEDOR: la empresa que presta el servicio (ej. Air-e, Triple A, Gases del Caribe, EPM, Claro, Movistar).',
  'REFERENCIA DE PAGO: el número largo que se teclea en el banco. Suele ir rotulado "referencia de pago",',
  '"referencia 1" o junto al código de barras. Devuélvelo como TEXTO con solo dígitos: quítale espacios y guiones.',
  'Si el recibo trae varias referencias, usa la rotulada como "referencia de pago" o, si no hay rótulo, la más larga.',
  'VALOR: el TOTAL A PAGAR pagando a tiempo, entero en pesos COP. Los recibos suelen traer también un valor',
  'con recargo por pago extemporáneo y el consumo del período: esos NO son. Si hay "pago oportuno" y',
  '"pago con mora", devuelve el OPORTUNO.',
  'FECHA LÍMITE: la fecha de pago oportuno ("pague hasta", "fecha límite de pago", "pago oportuno hasta").',
  'Devuelve el DÍA del mes en "limite" y la fecha completa YYYY-MM-DD en "limiteISO".',
  'No inventes datos que no estén en el documento: lo que no encuentres va como null (o cadena vacía en "proveedor").',
  'Pon encontrado=true si es un recibo de servicios y pudiste leer al menos el valor, la referencia o la fecha límite.',
  'Solo encontrado=false si NO es un recibo de servicios.',
].join('\n');

const TEXTO_INSTRUCCION_RECIBO = 'Extrae los datos de pago de este recibo con la herramienta.';

function cuerpoBase(modelo, content, { sistema = SISTEMA_EXTRACTO, tool = TOOL_EXTRACTO } = {}) {
  return {
    model: modelo || MODELO_EXTRACTO_DEFAULT,
    max_tokens: 500,
    system: sistema,
    tools: [tool],
    tool_choice: { type: 'tool', name: tool.name },
    messages: [{ role: 'user', content }],
  };
}

/** Bloques `image` de las páginas ya rendidas por pdf.js (o de una foto). PURA. */
function bloquesImagen(imagenes = []) {
  return imagenes.map((im) => ({
    type: 'image',
    source: { type: 'base64', media_type: (im && im.mediaType) || 'image/jpeg', data: im && im.base64 },
  }));
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
  const content = bloquesImagen(imagenes);
  content.push({ type: 'text', text: TEXTO_INSTRUCCION });
  return cuerpoBase(modelo, content);
}

/**
 * Cuerpo para leer un RECIBO de servicios a partir de imágenes (páginas del PDF
 * rendidas, o la foto del recibo). PURA.
 * @param {{imagenes:Array<{base64:string, mediaType?:string}>, modelo?:string}} p
 */
export function construirPeticionReciboImagenes({ imagenes = [], modelo }) {
  const content = bloquesImagen(imagenes);
  content.push({ type: 'text', text: TEXTO_INSTRUCCION_RECIBO });
  return cuerpoBase(modelo, content, { sistema: SISTEMA_RECIBO, tool: TOOL_RECIBO });
}

/** Día del mes válido (1..31) o null. PURA. */
function diaValido(v) {
  const n = typeof v === 'number' ? v : (typeof v === 'string' ? parseInt(v, 10) : NaN);
  return Number.isInteger(n) && n >= 1 && n <= 31 ? n : null;
}

/** Entero de pesos COP (número o texto), > 0, o null. PURA. */
function enteroCOP(v) {
  let n = null;
  if (typeof v === 'number' && Number.isFinite(v)) n = Math.round(v);
  else if (typeof v === 'string') { const p = parseCOP(v); if (Number.isInteger(p)) n = p; }
  return n != null && n > 0 ? n : null;
}

/** Fecha ISO YYYY-MM-DD válida, o null. PURA. */
function fechaISOValida(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) ? v : null;
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

  // Saldo = deuda total. Mismo parseo que total; nunca negativo.
  let saldo = null;
  if (typeof obj.saldo === 'number' && Number.isFinite(obj.saldo)) saldo = Math.round(obj.saldo);
  else if (typeof obj.saldo === 'string') { const p = parseCOP(obj.saldo); if (Number.isInteger(p)) saldo = p; }
  if (saldo != null && saldo <= 0) saldo = null;

  // Tasa ANUAL cruda: solo cuando el extracto la reporta E.A. (para créditos, que
  // guardan tasaEA). Si viene mensual, no adivinamos la anual: null.
  const tasaAnual = (Number.isFinite(tRaw) && tRaw > 0 && tRaw < 100 && obj.esAnual === true)
    ? Math.round(tRaw * 100) / 100 : null;

  const banco = typeof obj.banco === 'string' ? obj.banco.trim().slice(0, 40) : '';
  const encontrado = obj.encontrado === true;

  // Fechas completas (para el snapshot del corte) y desglose de pagos.
  const corteISO = fechaISOValida(obj.corteISO);
  const limiteISO = fechaISOValida(obj.limiteISO);
  const pagoAPlazos = enteroCOP(obj.pagoAPlazos);
  const pagoMinimo = enteroCOP(obj.pagoMinimo);
  const intereses = enteroCOP(obj.intereses);

  // Diferidos: solo las líneas con descripción; se normalizan con la lógica pura.
  const diferidos = (Array.isArray(obj.diferidos) ? obj.diferidos : [])
    .filter((d) => d && typeof d === 'object' && typeof d.descripcion === 'string' && d.descripcion.trim() !== '')
    .map(normalizarDiferido);

  // CONSUMOS del ciclo. Se llaman así —y no "movimientos"— a propósito: los
  // movimientos de la app entran al cálculo del mes y al semáforo, y estos NO.
  // Son solo lectura, para saber en qué se fue la plata de esa tarjeta. El
  // nombre distinto hace difícil meterlos por error en el store equivocado.
  const consumos = (Array.isArray(obj.movimientos) ? obj.movimientos : [])
    .map(normalizarConsumo)
    .filter(Boolean);

  return {
    corte, limite, tasa, tasaAnual, total, saldo, banco, encontrado,
    corteISO, limiteISO, pagoAPlazos, pagoMinimo, intereses, diferidos, consumos,
  };
}

/** Día del mes de una fecha ISO ya validada, o null. PURA. */
function diaDeISO(iso) {
  return iso ? diaValido(parseInt(iso.slice(8, 10), 10)) : null;
}

/**
 * Normaliza el `input` del recibo a { proveedor, referenciaPago, valor, limite,
 * limiteISO, encontrado }. PURA y tolerante: nunca lanza.
 *
 * La referencia pasa por el MISMO limpiador que usa el modelo al guardar, para
 * que un recibo leído por la IA y uno tecleado a mano queden idénticos.
 */
export function normalizarRecibo(input) {
  const obj = input && typeof input === 'object' ? input : {};

  const proveedor = typeof obj.proveedor === 'string' ? obj.proveedor.trim().slice(0, MAX_PROVEEDOR) : '';
  const referenciaPago = limpiarReferenciaPago(
    typeof obj.referenciaPago === 'string' || typeof obj.referenciaPago === 'number' ? obj.referenciaPago : null,
  );
  const valor = enteroCOP(obj.valor);
  const limiteISO = fechaISOValida(obj.limiteISO);
  /* El recibo casi siempre imprime la fecha completa ("Pague hasta 12/09/2026")
     y no un día suelto, así que cuando el modelo solo devuelve la ISO el día se
     saca de ahí: es el que el formulario necesita para `diaPago`. */
  const limite = diaValido(obj.limite) ?? diaDeISO(limiteISO);
  const encontrado = obj.encontrado === true;

  return { proveedor, referenciaPago, valor, limite, limiteISO, encontrado };
}

/** Un consumo del ciclo, saneado. PURA. Devuelve null si no es utilizable. */
function normalizarConsumo(m) {
  if (!m || typeof m !== 'object') return null;
  const descripcion = typeof m.descripcion === 'string' ? m.descripcion.trim().slice(0, 80) : '';
  if (!descripcion) return null;
  const monto = enteroCOP(m.monto);
  return Object.freeze({
    descripcion,
    fecha: fechaISOValida(m.fecha),
    monto,   // null si el extracto no lo trae legible
  });
}

/**
 * Cuota del mes según el extracto. PURA.
 *
 * Es lo que hay que pagar para estar al día, y por tanto lo que debe quedar en
 * `cuotaMensual` de la ficha: ese campo pesa en los fijos del mes y en el
 * semáforo, así que una cuota escrita a mano y desactualizada distorsiona toda
 * la app hasta que llega el extracto a corregirla.
 *
 * Prioriza `pagoAPlazos` —el "pago a plazos" del banco, lo mínimo para no
 * entrar en mora— y cae en `pagoMinimo` si el extracto solo trae ese.
 * @returns {number|null} entero COP, o null si el extracto no lo trae
 */
export function cuotaDesdeExtracto(extracto = {}) {
  const o = extracto && typeof extracto === 'object' ? extracto : {};
  for (const v of [o.pagoAPlazos, o.pagoMinimo]) {
    if (Number.isInteger(v) && v > 0) return v;
  }
  return null;
}

/* Qué cambia entre leer un extracto y leer un recibo, una vez armado el cuerpo:
   cómo se normaliza la salida, qué cuenta como "sí traía datos" y cómo se le
   llama a la cosa en los mensajes de error. Todo lo demás —cabeceras, estados,
   la clave que solo viaja en x-api-key— es idéntico y no se duplica. */
const LECTOR_EXTRACTO = Object.freeze({
  cosa: 'el extracto',
  normalizar: normalizarExtracto,
  hayDatos: (d) => d.encontrado || d.corte != null || d.limite != null,
  sinDatos: 'No parece un extracto de tarjeta. Ingresa el ciclo a mano.',
});

const LECTOR_RECIBO = Object.freeze({
  cosa: 'el recibo',
  normalizar: normalizarRecibo,
  hayDatos: (d) => d.encontrado || d.valor != null || d.referenciaPago != null,
  sinDatos: 'No parece un recibo de servicios. Ingrésalo a mano.',
});

/**
 * Envía un cuerpo ya armado a /v1/messages y normaliza la respuesta a los
 * estados públicos. IMPURA (red). PRIVADA: la comparten los caminos documento,
 * imágenes y recibo. La clave viaja SOLO en x-api-key.
 */
async function enviarLectura(body, key, doFetch, lector) {
  const { cosa, normalizar, hayDatos, sinDatos } = lector;
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
    return { estado: 'red', mensaje: `No se pudo leer ${cosa}: revisa tu conexión e intenta de nuevo.` };
  }

  if (res.status === 401 || res.status === 403) {
    return { estado: 'invalida', mensaje: 'Clave inválida. Revísala en Perfil.' };
  }
  if (!res.ok) {
    return { estado: 'error', mensaje: `No se pudo leer ${cosa} (HTTP ${res.status}).` };
  }

  let cuerpo;
  try { cuerpo = await res.json(); } catch { return { estado: 'error', mensaje: 'La respuesta no se pudo leer.' }; }

  const input = extraerToolUse(cuerpo);
  if (!input) return { estado: 'error', mensaje: `No entendí ${cosa}. Ingrésalo a mano.` };

  const datos = normalizar(input);
  if (!hayDatos(datos)) return { estado: 'sin-datos', mensaje: sinDatos };
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

  return enviarLectura(construirPeticionExtracto({ base64, mediaType, modelo }), key, doFetch, LECTOR_EXTRACTO);
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

  return enviarLectura(construirPeticionExtractoImagenes({ imagenes, modelo }), key, doFetch, LECTOR_EXTRACTO);
}

/**
 * Lee un RECIBO de servicios públicos a partir de IMÁGENES (páginas del PDF
 * rendidas por pdf.js, o la foto del recibo). IMPURA (red). `fetchImpl`
 * inyectable. Espeja a analizarExtractoImagenes en estados y errores.
 *
 * @param {{imagenes:Array<{base64:string, mediaType?:string}>, apiKey:string, modelo?:string}} p
 * @param {{fetchImpl?: typeof fetch}} [opts]
 * @returns {Promise<{estado:'ok'|'sin-clave'|'sin-datos'|'invalida'|'red'|'error', mensaje?:string, proveedor?, referenciaPago?, valor?, limite?, limiteISO?, encontrado?}>}
 */
export async function analizarReciboImagenes({ imagenes, apiKey, modelo }, { fetchImpl } = {}) {
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (key === '') {
    return { estado: 'sin-clave', mensaje: 'Configura tu clave de Anthropic en Perfil → Clave de Anthropic.' };
  }
  if (!Array.isArray(imagenes) || imagenes.length === 0) {
    return { estado: 'error', mensaje: 'No se pudo leer el recibo.' };
  }
  const doFetch = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!doFetch) return { estado: 'error', mensaje: 'Este entorno no puede hacer peticiones de red.' };

  return enviarLectura(construirPeticionReciboImagenes({ imagenes, modelo }), key, doFetch, LECTOR_RECIBO);
}
