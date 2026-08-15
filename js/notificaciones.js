/* ============================================================
   olbo · notificaciones.js
   Une las cuatro fuentes de avisos en UNA lista, ordenada por lo que de verdad
   importa: qué tan pronto cuesta plata.

   Antes cada fuente tenía su bloque —Pagos, Presupuestos, Por registrar,
   Personas— y dentro de cada uno el orden era el suyo. El efecto era que un
   tope ya excedido quedaba debajo de un pago que vence en dos días, solo por
   ser de otra familia. La familia le importa a quien programó; a quien mira la
   pantalla le importa qué atender primero.

   TODO AQUÍ ES PURO: recibe lo ya leído de la base y devuelve estructuras
   congeladas. Sin DOM, sin IndexedDB, sin Date.now() — la fecha entra por
   parámetro para que los tests no dependan del reloj.
   ============================================================ */

/* Los dos tramos que se pintan como secciones. No hay un tercero "informativo":
   si algo no cuesta plata ni pide una acción, no es una notificación. */
export const AHORA = 'ahora';   // ya está costando: vencido, vence hoy, tope pasado
export const PRONTO = 'pronto'; // va a costar si nadie hace nada

/** Cuánto peso visual carga cada tramo, de más a menos. */
export const TRAMOS = Object.freeze([AHORA, PRONTO]);

const nivelDe = (urgencia) => (urgencia === AHORA ? 'rojo' : 'ambar');

/* Dentro de un tramo manda la plata en juego: entre dos cosas igual de urgentes,
   primero la que más cuesta. Es el único criterio comparable entre un pago y un
   tope; sin monto conocido va al final, porque no se puede afirmar que sea grave.
   El desempate por título mantiene el orden estable entre aperturas. */
const porPeso = (a, b) => {
  const pa = a.peso == null ? -1 : a.peso;
  const pb = b.peso == null ? -1 : b.peso;
  if (pa !== pb) return pb - pa;
  return String(a.titulo).localeCompare(String(b.titulo), 'es');
};

/**
 * Pagos próximos → notificaciones.
 * Vencido o venciendo hoy es AHORA; lo que queda dentro de la ventana, PRONTO.
 */
function dePagos(pagos) {
  return (Array.isArray(pagos) ? pagos : []).filter(Boolean).map((p) => {
    const urgencia = p.dias <= 0 ? AHORA : PRONTO;
    return {
      id: `pago:${p.clave}`,
      fuente: 'pago',
      urgencia,
      nivel: nivelDe(urgencia),
      titulo: String(p.titulo || 'Producto'),
      // El detalle lo arma la vista con textoAlerta(): aquí solo viajan los datos.
      dias: p.dias,
      fecha: p.fecha,
      monto: p.monto == null ? null : p.monto,
      peso: p.monto == null ? null : p.monto,
    };
  });
}

/**
 * Topes de categoría → notificaciones.
 * Pasarse es AHORA (el sobrecosto ya ocurrió); acercarse es PRONTO.
 * El peso es lo excedido, no el total gastado: eso es lo que está de más.
 */
function deTopes(topes) {
  return (Array.isArray(topes) ? topes : []).filter(Boolean).map((t) => {
    const excedido = Number(t.excedido) || 0;
    const urgencia = excedido > 0 ? AHORA : PRONTO;
    return {
      id: `tope:${t.categoriaId}`,
      fuente: 'tope',
      urgencia,
      nivel: nivelDe(urgencia),
      categoriaId: t.categoriaId,
      pctTope: t.pctTope,
      presupuesto: t.presupuesto,
      excedido,
      peso: excedido > 0 ? excedido : null,
      titulo: String(t.categoriaId || ''),
    };
  });
}

/**
 * Alertas de gasto por persona → notificaciones.
 * Son porcentajes del ingreso del mes, no cifras absolutas: no compiten por
 * peso con un pago vencido, así que van sin peso (al final de su tramo).
 */
function dePersonas(alertas) {
  return (Array.isArray(alertas) ? alertas : []).filter(Boolean).map((a) => {
    const urgencia = a.color === 'rojo' ? AHORA : PRONTO;
    return {
      id: `persona:${a.id}`,
      fuente: 'persona',
      urgencia,
      nivel: nivelDe(urgencia),
      titulo: String(a.label || a.id || ''),
      topeFrac: a.topeFrac,
      pctIngreso: a.pctIngreso,
      peso: null,
    };
  });
}

/**
 * Une todo y lo reparte en tramos.
 *
 * Los gastos fijos por registrar NO entran aquí: no son una alerta sino una
 * tarea, con su botón y su flujo. Mezclarlos obligaría a que cada tramo tuviera
 * acciones distintas y volveríamos al problema que esto arregla.
 *
 * @returns {{ahora: array, pronto: array, total: number, hayAlgo: boolean}}
 */
export function agruparNotificaciones({ pagos = [], topes = [], personas = [] } = {}) {
  const todas = [...dePagos(pagos), ...deTopes(topes), ...dePersonas(personas)];
  const ahora = todas.filter((n) => n.urgencia === AHORA).sort(porPeso);
  const pronto = todas.filter((n) => n.urgencia === PRONTO).sort(porPeso);
  return Object.freeze({
    ahora: Object.freeze(ahora.map(Object.freeze)),
    pronto: Object.freeze(pronto.map(Object.freeze)),
    total: todas.length,
    hayAlgo: todas.length > 0,
  });
}

/**
 * Frase de cabecera: lo primero que se lee al abrir. Dice cuántas cosas piden
 * atención y de qué tipo, para no tener que contar filas.
 * PURA.
 */
export function resumenNotificaciones({ ahora = [], pronto = [], pendientes = 0 } = {}) {
  const nAhora = ahora.length;
  const nPronto = pronto.length;
  const nPend = Number(pendientes) || 0;

  if (nAhora === 0 && nPronto === 0 && nPend === 0) return 'Todo al día.';

  if (nAhora > 0) {
    const q = nAhora === 1 ? '1 cosa necesita' : `${nAhora} cosas necesitan`;
    return `${q} tu atención hoy.`;
  }
  if (nPronto > 0) {
    const q = nPronto === 1 ? '1 cosa' : `${nPronto} cosas`;
    return `Nada urgente. ${q} por atender esta semana.`;
  }
  const q = nPend === 1 ? '1 gasto fijo' : `${nPend} gastos fijos`;
  return `Nada urgente. Te falta registrar ${q}.`;
}

/** Etiqueta visible de cada tramo. */
export function tituloTramo(tramo) {
  if (tramo === AHORA) return 'Necesita atención';
  if (tramo === PRONTO) return 'Esta semana';
  return '';
}
