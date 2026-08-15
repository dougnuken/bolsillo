/* ============================================================
   olbo · agenda-pagos.js — "¿qué tengo que pagar y cuándo?"

   La lista de tarjetas responde "¿qué tengo?": enseña el plástico y ocupa media
   pantalla por producto. Esta vista responde la otra pregunta, la que se hace
   de verdad a mitad de mes, y para eso ordena por FECHA en vez de por nombre:
   lo que vence primero, primero.

   Reutiliza proximaFechaPago (alertas-pago.js), así que la fecha sale del mismo
   sitio que las notificaciones: del extracto si lo hay, del día de la ficha si
   no. Una sola fuente para las dos cosas.

   TODO PURO.
   ============================================================ */

import { proximaFechaPago, diasEntre } from './alertas-pago.js';

/** A partir de cuántos días se considera "lejos" y deja de tener color. */
export const DIAS_ATENCION = 7;

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Cómo se dice el plazo, en corto. PURA. */
export function cuandoTexto(dias, fechaISO = '') {
  if (!Number.isFinite(dias)) return '';
  if (dias < 0) return `vencido hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'día' : 'días'}`;
  if (dias === 0) return 'vence hoy';
  if (dias === 1) return 'vence mañana';
  if (dias <= DIAS_ATENCION) return `en ${dias} días`;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fechaISO || '');
  if (!m) return `en ${dias} días`;
  return `el ${Number(m[3])} ${MESES[Number(m[2]) - 1] || ''}`.trim();
}

/** Urgencia de una fila, para el color. PURA. */
function nivelDe(dias) {
  if (dias <= 0) return 'rojo';
  if (dias <= 2) return 'ambar';
  return 'neutro';
}

/**
 * Cuánto toca pagar de un producto. PURA.
 * Manda el pago mínimo del extracto —es lo que evita la mora— y si no hay,
 * la cuota de la ficha.
 */
function montoDe(credito = {}, ultimo = {}) {
  const r = (ultimo && ultimo.resumen) || {};
  const candidatos = [r.pagoAPlazos, r.pagoAPlazosUSD, credito.cuotaMensual];
  const n = candidatos.map(Number).find((v) => Number.isFinite(v) && v > 0);
  return n != null ? Math.round(n) : null;
}

/**
 * Agenda de pagos: una fila por producto, la más urgente primero. PURA.
 *
 * Los productos SIN fecha calculable no se descartan: van al final. Esconder un
 * producto porque le falta un dato es peor que mostrarlo incompleto — deja de
 * existir para quien mira la pantalla.
 *
 * @param {{productos:Array, hoy:string}} args
 * @returns {Array<{clave,titulo,subtitulo,monto,fecha,dias,cuando,nivel}>}
 */
export function agendaDePagos({ productos, hoy } = {}) {
  const lista = Array.isArray(productos) ? productos.filter(Boolean) : [];
  const filas = lista.map((p) => {
    const credito = p.credito || {};
    const ultimo = p.ultimo || {};
    const fecha = proximaFechaPago({
      fechaLimitePago: ultimo.fechaLimitePago,
      diaPago: credito.diaPago,
    }, hoy);
    const dias = fecha ? diasEntre(hoy, fecha) : null;
    return Object.freeze({
      clave: p.clave || '',
      id: credito.id || '',
      titulo: credito.entidad || ultimo.entidad || 'Producto',
      subtitulo: credito.producto || ultimo.producto || '',
      monto: montoDe(credito, ultimo),
      fecha: fecha || '',
      dias,
      cuando: dias != null ? cuandoTexto(dias, fecha) : 'sin fecha de pago',
      nivel: dias != null ? nivelDe(dias) : 'neutro',
    });
  });

  filas.sort((a, b) => {
    if (a.dias == null && b.dias == null) return 0;
    if (a.dias == null) return 1;      // los que no tienen fecha, al final
    if (b.dias == null) return -1;
    return a.dias - b.dias;
  });
  return Object.freeze(filas);
}

/** Lo que suman las cuotas de la agenda. PURA. */
export function totalAgenda(filas = []) {
  return (Array.isArray(filas) ? filas : [])
    .reduce((a, f) => a + (Number.isFinite(f && f.monto) ? f.monto : 0), 0);
}
