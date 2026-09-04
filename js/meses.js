/* ============================================================
   olbo · meses.js
   Navegar por los meses que YA tienen movimientos, para poder mirar atrás y
   comparar cómo se ha ido gastando.

   La lista NO es un rango de calendario: son los meses en los que de verdad hay
   algo registrado. Ofrecer meses vacíos sería invitar a un callejón sin salida
   —abrir un mes en blanco no dice nada— y en una app que se llena poco a poco
   eso sería la mayoría de la lista.

   TODO PURO: sin DOM, sin base de datos, sin Date.now(). La fecha entra por
   parámetro para que los tests no dependan del reloj.
   ============================================================ */

const NOMBRES = Object.freeze([
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]);

/** 'YYYY-MM' bien formado. PURA. */
export function esClaveMes(v) {
  return typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

/**
 * Meses con movimientos, del más reciente al más viejo.
 *
 * Cuenta un mes por la FECHA del movimiento y no por las cuotas que reparte:
 * esta lista es "¿qué meses puedo abrir?", y un mes donde solo cae la cuota de
 * una compra vieja no tiene nada propio que mostrar.
 *
 * @returns {ReadonlyArray<string>} p.ej. ['2026-08', '2026-07']
 */
export function mesesConDatos({ movimientos = [] } = {}) {
  const set = new Set();
  for (const m of Array.isArray(movimientos) ? movimientos : []) {
    if (!m || typeof m.fecha !== 'string') continue;
    const clave = m.fecha.slice(0, 7);
    if (esClaveMes(clave)) set.add(clave);
  }
  return Object.freeze([...set].sort().reverse());
}

/** '2026-08' → 'Agosto 2026'. PURA. */
export function etiquetaMes(clave) {
  if (!esClaveMes(clave)) return '';
  const [anio, mes] = clave.split('-');
  return `${NOMBRES[Number(mes) - 1]} ${anio}`;
}

/** '2026-08' → 'ago' (para espacios estrechos). PURA. */
export function etiquetaMesCorta(clave) {
  if (!esClaveMes(clave)) return '';
  const mes = Number(clave.split('-')[1]);
  return NOMBRES[mes - 1].slice(0, 3).toLowerCase();
}

/**
 * Última fecha del mes, que es lo que se le pasa a los cálculos como "hoy".
 *
 * Tiene que ser el ÚLTIMO día y no el primero: budget.js reparte las cuotas
 * según el mes en curso, y parada en el día 1 la vista mostraría el mes recién
 * empezado en vez del mes completo que se quiere revisar.
 *
 * @returns {Date|null}
 */
export function finDeMes(clave) {
  if (!esClaveMes(clave)) return null;
  const [anio, mes] = clave.split('-').map(Number);
  // Día 0 del mes siguiente = último día de este. Evita la tabla de 28/30/31 y
  // acierta en bisiesto sin casos especiales.
  return new Date(anio, mes, 0, 12, 0, 0);
}

/**
 * El mes vecino DENTRO de los que tienen datos, o null si no hay.
 * Se salta los huecos a propósito: si no registraste nada en julio, "anterior"
 * desde agosto lleva a junio y no a un mes vacío.
 *
 * @param {number} paso -1 = más viejo, +1 = más reciente
 */
export function mesVecino(lista, actual, paso) {
  const meses = Array.isArray(lista) ? lista : [];
  const i = meses.indexOf(actual);
  if (i === -1) return null;
  // La lista va de reciente a viejo, así que "más viejo" avanza en el índice.
  const j = i - paso;
  return j >= 0 && j < meses.length ? meses[j] : null;
}

/** Mes por defecto: el más reciente con datos, o el de `hoy` si no hay nada. */
export function mesPorDefecto({ movimientos = [], hoy = new Date() } = {}) {
  const lista = mesesConDatos({ movimientos });
  if (lista.length) return lista[0];
  const d = hoy instanceof Date && Number.isFinite(hoy.getTime()) ? hoy : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
