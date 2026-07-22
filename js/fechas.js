/* ============================================================
   Bolsillo · fechas.js
   Helpers de fecha PUROS para la UI (sin DOM, sin db).

   Regla: la fecha de un gasto es la del CALENDARIO DEL USUARIO, no la
   del meridiano de Greenwich. `new Date().toISOString()` devuelve
   UTC: en Colombia (UTC-5), a las 7 de la noche del 19 ya dice 20.
   Por eso aquí se arma el 'YYYY-MM-DD' con los getters LOCALES.

   La aritmética de días, en cambio, se hace en UTC a propósito:
   sumar/restar días sobre un mediodía UTC nunca cae en el hueco de
   un cambio de horario.
   ============================================================ */

const RE_ISO = /^(\d{4})-(\d{2})-(\d{2})/;

const dosDigitos = (n) => String(n).padStart(2, '0');

/** Hoy en 'YYYY-MM-DD' según el reloj LOCAL del dispositivo. */
export function hoyISO(now = new Date()) {
  const d = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(d.getTime())) throw new Error('hoyISO: fecha inválida.');
  return `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`;
}

/** Partes numéricas de un ISO 'YYYY-MM-DD'. Falla fuerte si no lo es. */
function partesISO(iso) {
  const m = RE_ISO.exec(String(iso || ''));
  if (!m) throw new Error(`Fecha inválida: "${iso}". Se esperaba YYYY-MM-DD.`);
  return { anio: Number(m[1]), mes: Number(m[2]), dia: Number(m[3]) };
}

/** true si el texto es un 'YYYY-MM-DD' utilizable. Nunca lanza. */
export function esISOValida(iso) {
  try {
    partesISO(iso);
    return true;
  } catch {
    return false;
  }
}

/** Fecha ISO desplazada `dias` (puede ser negativo). Inmutable. */
export function sumarDiasISO(iso, dias = 0) {
  const { anio, mes, dia } = partesISO(iso);
  if (!Number.isInteger(dias)) throw new Error('sumarDiasISO: los días deben ser un entero.');
  const t = Date.UTC(anio, mes - 1, dia) + dias * 86_400_000;
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${dosDigitos(d.getUTCMonth() + 1)}-${dosDigitos(d.getUTCDate())}`;
}

/** Diferencia en días completos entre dos ISO (b − a). */
export function diferenciaDias(a, b) {
  const pa = partesISO(a);
  const pb = partesISO(b);
  return Math.round((Date.UTC(pb.anio, pb.mes - 1, pb.dia) - Date.UTC(pa.anio, pa.mes - 1, pa.dia)) / 86_400_000);
}

/* Formateo: siempre en UTC para que el día impreso sea el del ISO. */
function fmt(iso, opciones) {
  const { anio, mes, dia } = partesISO(iso);
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  return new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', ...opciones }).format(d);
}

/** '19 de julio' — para subtítulos de los atajos. */
export function fechaMedia(iso) {
  return fmt(iso, { day: 'numeric', month: 'long' });
}

/** 'domingo, 19 de julio de 2026' — para confirmar la elegida. */
export function fechaLarga(iso) {
  return fmt(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/** '19 jul' — compacta, para filas y botones estrechos. */
export function fechaCorta(iso) {
  return fmt(iso, { day: 'numeric', month: 'short' }).replace('.', '');
}

/**
 * Nombre humano de una fecha relativo a hoy: 'Hoy', 'Ayer', 'Antier'
 * y, más atrás (o adelante), la fecha corta.
 */
export function etiquetaFecha(iso, hoy = hoyISO()) {
  if (!esISOValida(iso)) return '—';
  const delta = diferenciaDias(hoy, iso);
  if (delta === 0) return 'Hoy';
  if (delta === -1) return 'Ayer';
  if (delta === -2) return 'Antier';
  return fechaCorta(iso);
}
