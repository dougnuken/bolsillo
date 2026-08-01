/* ============================================================
   Bolsillo · sms-banco.js
   Lee los SMS de notificación de compra del Banco de Occidente y los
   convierte en un movimiento listo para registrar.

   POR QUÉ REGEX Y NO IA
   Estos mensajes los arma una plantilla del banco: son deterministas.
   Un parser exacto es instantáneo, gratis, funciona sin señal y no puede
   alucinar un monto. La IA (voz-gasto.js) sigue siendo el camino para el
   texto libre humano, que sí es ambiguo.

   OCCIDENTE MANDA DOS PLANTILLAS DISTINTAS, desde dos remitentes, y no
   coinciden ni en el orden ni en el formato del número:

   87810 · "Banco Occidente informa que realizo Compra por  65,450.00 en
            TAMA PLAZA 51Bcon la T Credencial #7938, a las 202536del
            20260730. Linea de servicio"
     · monto ANGLO: la coma es miles y el punto decimales (65,450.00),
     · el comercio va PEGADO a "con la T Credencial" (sin espacio),
     · hora sin ceros a la izquierda (90602 = 09:06:02) y fecha AAAAMMDD,
     · el SMS llega TRUNCADO ("Linea de se"), así que nada después de la
       tarjeta puede ser obligatorio.

   85722 · "Ud realizo una compra en SMART FIT LA HACIENDA  por $109.989.T.
            Credencial *7938, 2026/04/01, 18:12. Bco. Occidente Linea de
            Servicio (601)3902058"
     · monto COP: el punto es miles ($109.989 son ciento nueve mil),
     · el comercio va ANTES del monto, con espacios de sobra,
     · fecha AAAA/MM/DD y hora HH:MM.

   O sea: el MISMO banco escribe 65,450.00 y $109.989 para decir cosas del
   mismo tipo. Por eso cada plantilla trae su propio lector de número en vez
   de una heurística común — parseCOP() leería "65,450.00" como 65 pesos.

   Todo aquí es PURO: se prueba en Node contra los SMS reales.
   ============================================================ */

import { parseCOP } from './money.js';

export const BANCO_OCCIDENTE = 'Banco de Occidente';

/**
 * Monto en formato ANGLO: coma = miles, punto = decimales. PURA.
 * "65,450.00" → 65450 · "1,234,567.89" → 1234568
 * @returns {number|null} entero de pesos
 */
export function montoAnglo(txt) {
  if (typeof txt !== 'string') return null;
  const s = txt.trim().replace(/\$/g, '');
  // ESTRICTO con la agrupación: o no hay comas, o son grupos de 3 exactos.
  // Antes se quitaban las comas a ciegas y "1,2," se leía como 12 — un monto
  // mal formado tiene que RECHAZARSE, no reinterpretarse en silencio.
  if (!/^\d{1,3}(,\d{3})*(\.\d+)?$/.test(s) && !/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Math.round(parseFloat(s.replace(/,/g, '')));
  return Number.isFinite(n) ? n : null;
}

/** "20260730" → "2026-07-30". PURA. Devuelve null si no es una fecha real. */
export function fechaCompacta(txt) {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(String(txt || '').trim());
  if (!m) return null;
  return fechaValida(m[1], m[2], m[3]);
}

/** "2026/04/01" o "2026-04-01" → "2026-04-01". PURA. */
export function fechaBarras(txt) {
  const m = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(String(txt || '').trim());
  if (!m) return null;
  return fechaValida(m[1], m[2].padStart(2, '0'), m[3].padStart(2, '0'));
}

function fechaValida(a, me, d) {
  const anio = Number(a), mes = Number(me), dia = Number(d);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  if (anio < 2000 || anio > 2100) return null;
  return `${a}-${me}-${d}`;
}

/**
 * Hora pegada del banco → "HH:MM". PURA.
 * OJO: viene SIN ceros a la izquierda — "90602" son las 09:06:02, no las
 * 90:60:2. Se rellena a 6 dígitos por la izquierda antes de partirla.
 */
export function horaCompacta(txt) {
  const s = String(txt || '').trim();
  if (!/^\d{1,6}$/.test(s)) return null;
  const p = s.padStart(6, '0');
  const hh = Number(p.slice(0, 2));
  const mm = Number(p.slice(2, 4));
  if (hh > 23 || mm > 59) return null;
  return `${p.slice(0, 2)}:${p.slice(2, 4)}`;
}

/** "18:12" o "8:12" → "08:12". PURA. */
export function horaDosPuntos(txt) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(txt || '').trim());
  if (!m) return null;
  const hh = Number(m[1]), mm = Number(m[2]);
  if (hh > 23 || mm > 59) return null;
  return `${String(hh).padStart(2, '0')}:${m[2]}`;
}

/** Limpia el nombre del comercio: espacios de sobra y basura de los bordes. PURA. */
export function limpiarComercio(txt) {
  return String(txt || '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.,;:*#-]+|[\s.,;:*#-]+$/g, '')
    .trim()
    .slice(0, 60);
}

/* Las dos plantillas. Cada una sabe leer SU formato de número. El grupo de
   fecha/hora es OPCIONAL a propósito: el SMS llega cortado por el operador. */
export const PLANTILLAS = Object.freeze([
  Object.freeze({
    clave: 'occidente-87810',
    // "…realizo Compra por  65,450.00 en TAMA PLAZA 51Bcon la T Credencial #7938, a las 202536del 20260730…"
    re: /Banco\s+Occidente\s+informa\s+que\s+realiz[oó]\s+(?<tipo>[A-Za-zÁÉÍÓÚÑáéíóúñ]+(?:\s+[A-Za-zÁÉÍÓÚÑáéíóúñ]+)?)\s+por\s+(?<monto>[\d.,]*\d)\s+en\s+(?<comercio>.+?)con\s+la\s+T\s+Credencial\s*#?\s*(?<tarjeta>\d{3,4})(?:\s*,\s*a\s*las\s*(?<hora>\d{1,6})\s*del\s*(?<fecha>\d{8}))?/i,
    leer: (g) => ({
      monto: montoAnglo(g.monto),
      fecha: fechaCompacta(g.fecha),
      hora: horaCompacta(g.hora),
    }),
  }),
  Object.freeze({
    clave: 'occidente-85722',
    // "Ud realizo una compra en SMART FIT LA HACIENDA  por $109.989.T. Credencial *7938, 2026/04/01, 18:12…"
    re: /Ud\s+realiz[oó]\s+un[ao]\s+(?<tipo>[A-Za-zÁÉÍÓÚÑáéíóúñ]+)\s+en\s+(?<comercio>.+?)\s+por\s+\$?\s*(?<monto>[\d.,]*\d)\s*\.?\s*T\.?\s*Credencial\s*\*?\s*(?<tarjeta>\d{3,4})(?:\s*,\s*(?<fecha>\d{4}[/-]\d{1,2}[/-]\d{1,2})\s*,\s*(?<hora>\d{1,2}:\d{2}))?/i,
    leer: (g) => ({
      // Aquí SÍ vale parseCOP: el punto es miles, que es su convención.
      monto: parseCOP(g.monto),
      fecha: fechaBarras(g.fecha),
      hora: horaDosPuntos(g.hora),
    }),
  }),
]);

/* Qué tipos de mensaje representan plata que SALE. Todo lo demás (pagos,
   abonos, avisos, rechazos) no se registra: es mejor no meter nada que meter
   un movimiento inventado. */
const TIPOS_GASTO = new Set(['compra', 'consumo', 'avance', 'retiro', 'pago']);

/**
 * Clave de deduplicación. PURA.
 * Precisión de MINUTO a propósito: el 31/07 hubo dos cargos idénticos de
 * $319.000 en MEDICINA PREPAGADA, a las 14:05:45 y a las 14:14:23. Son dos
 * compras REALES; con precisión de día se habrían fusionado en una. Y el
 * minuto permite que las dos plantillas (una da segundos, la otra no)
 * produzcan la misma clave si algún día describen la misma compra.
 */
export function claveDedup({ tarjeta, fecha, hora, monto } = {}) {
  if (!fecha || !Number.isFinite(monto)) return null;
  return ['occ', tarjeta || '0000', fecha, hora || '00:00', monto].join('-');
}

/**
 * Convierte un SMS del banco en los datos de un movimiento. PURA.
 * Devuelve null si el texto no es una notificación de compra conocida:
 * no adivina.
 *
 * @param {string} texto  el SMS tal cual, completo o truncado
 * @returns {null | {banco:string, plantilla:string, tipo:string, monto:number,
 *   comercio:string, tarjeta:string, fecha:(string|null), hora:(string|null),
 *   dedupKey:(string|null)}}
 */
export function parseSMS(texto) {
  if (typeof texto !== 'string' || texto.trim() === '') return null;
  // Los SMS llegan con saltos de línea del cliente de mensajes: se aplanan
  // para que los patrones no dependan de dónde partió la burbuja.
  const plano = texto.replace(/\s+/g, ' ').trim();

  for (const p of PLANTILLAS) {
    const m = p.re.exec(plano);
    if (!m || !m.groups) continue;
    const g = m.groups;
    const { monto, fecha, hora } = p.leer(g);
    if (!Number.isFinite(monto) || monto <= 0) continue;

    const tipo = String(g.tipo || '').trim().toLowerCase();
    if (!TIPOS_GASTO.has(tipo)) continue;

    const comercio = limpiarComercio(g.comercio);
    if (!comercio) continue;

    const tarjeta = String(g.tarjeta || '').trim();
    return Object.freeze({
      banco: BANCO_OCCIDENTE,
      plantilla: p.clave,
      tipo,
      monto,
      comercio,
      tarjeta,
      fecha,
      hora,
      dedupKey: claveDedup({ tarjeta, fecha, hora, monto }),
    });
  }
  return null;
}

/**
 * Parsea un pegote con VARIOS SMS (copiar varias burbujas de una) y
 * descarta los repetidos por dedupKey. PURA.
 * @returns {Array<object>} en el orden en que aparecen
 */
export function parseVarios(texto) {
  if (typeof texto !== 'string') return [];
  const plano = texto.replace(/\s+/g, ' ').trim();
  // Corta ANTES de cada arranque de plantilla conocido, sin perder el trozo.
  const trozos = plano
    .split(/(?=Banco\s+Occidente\s+informa|Ud\s+realiz[oó]\s+un)/i)
    .map((t) => t.trim())
    .filter(Boolean);
  const vistos = new Set();
  const salida = [];
  for (const t of trozos) {
    const r = parseSMS(t);
    if (!r) continue;
    const k = r.dedupKey || `${r.comercio}-${r.monto}-${salida.length}`;
    if (vistos.has(k)) continue;
    vistos.add(k);
    salida.push(r);
  }
  return salida;
}

/**
 * Saca el SMS de un deep link "#/registrar?sms=…". PURA.
 * Es la puerta del Atajo de iOS: como ninguna web puede leer Mensajes, el
 * Atajo trae el texto por la URL. Devuelve '' ante cualquier cosa rara —un
 * Atajo mal armado no puede tumbar el arranque de la app.
 */
export function smsDelHash(hash) {
  const s = String(hash == null ? '' : hash);
  if (!/^#\/?registrar\b/i.test(s)) return '';
  const i = s.indexOf('?');
  if (i < 0) return '';
  try {
    const v = new URLSearchParams(s.slice(i + 1)).get('sms');
    return typeof v === 'string' ? v.trim() : '';
  } catch { return ''; }
}
