/* ============================================================
   olbo · alertas-pago.js — avisar ANTES de que se venza un pago

   Olvidar la fecha límite de una tarjeta cuesta mora e intereses sobre todo el
   saldo, así que el aviso tiene que llegar con margen para hacer algo, no el
   mismo día.

   De dónde sale la fecha, por orden de confianza:
     1. `fechaLimitePago` del último extracto — es la que imprime el banco.
     2. `diaPago` de la ficha del producto — el día del mes que registró el
        usuario, para los productos sin extracto subido.

   TODO PURO. Las fechas se manejan como ISO 'YYYY-MM-DD' y la aritmética va en
   UTC a propósito: usar Date local haría que el aviso saltara un día según la
   zona horaria del teléfono.
   ============================================================ */

/** Días de antelación del aviso. */
export const DIAS_AVISO = 2;

const RE_ISO = /^(\d{4})-(\d{2})-(\d{2})/;

const partes = (iso) => {
  const m = RE_ISO.exec(typeof iso === 'string' ? iso : '');
  if (!m) return null;
  const y = +m[1]; const mes = +m[2]; const d = +m[3];
  if (mes < 1 || mes > 12 || d < 1 || d > 31) return null;
  return { y, m: mes, d };
};
const aISO = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const ultimoDia = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Días de `desde` a `hasta` (negativo si `hasta` ya pasó). PURA. */
export function diasEntre(desdeISO, hastaISO) {
  const a = partes(desdeISO); const b = partes(hastaISO);
  if (!a || !b) return null;
  const ms = Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d);
  return Math.round(ms / 86400000);
}

/**
 * Mismo día del mes siguiente, recortado al último día si no existe. PURA.
 * El 31 en un mes de 30 se paga el 30, no el 1 del siguiente.
 */
export function mesSiguiente(iso) {
  const p = partes(iso);
  if (!p) return '';
  const y = p.m === 12 ? p.y + 1 : p.y;
  const m = p.m === 12 ? 1 : p.m + 1;
  return aISO(y, m, Math.min(p.d, ultimoDia(y, m)));
}

/**
 * Próxima fecha de pago de un producto. PURA.
 * @param {{fechaLimitePago?:string, diaPago?:number}} datos
 * @param {string} hoyISO
 * @returns {string} ISO, o '' si no hay con qué calcularla
 */
export function proximaFechaPago(datos = {}, hoyISO = '') {
  const d = datos && typeof datos === 'object' ? datos : {};
  const hoy = partes(hoyISO);
  if (!hoy) return '';

  // 1) La del extracto. Si ya pasó, se proyecta al mes siguiente: los cortes
  //    son mensuales y el banco repite el mismo día.
  const limite = partes(d.fechaLimitePago);
  if (limite) {
    let iso = aISO(limite.y, limite.m, limite.d);
    let guardia = 0;
    while (diasEntre(hoyISO, iso) < 0 && guardia < 24) { iso = mesSiguiente(iso); guardia += 1; }
    return iso;
  }

  // 2) El día del mes de la ficha.
  const dia = Number(d.diaPago);
  if (!Number.isInteger(dia) || dia < 1 || dia > 31) return '';
  const esteMes = aISO(hoy.y, hoy.m, Math.min(dia, ultimoDia(hoy.y, hoy.m)));
  if (diasEntre(hoyISO, esteMes) >= 0) return esteMes;
  return mesSiguiente(aISO(hoy.y, hoy.m, dia));
}

/**
 * Alertas de pago próximas o vencidas. PURA.
 *
 * Solo devuelve lo accionable: lo que vence dentro de la ventana de aviso o lo
 * que ya se venció. Un pago dentro de tres semanas no es una notificación, es
 * ruido que enseña a ignorar la campana.
 *
 * @param {{productos:Array, hoy:string, diasAviso?:number}} args
 * @returns {Array<{clave:string, titulo:string, fecha:string, dias:number,
 *                  monto:number|null, nivel:'rojo'|'ambar'}>}
 */
export function alertasDePago({ productos, hoy, diasAviso = DIAS_AVISO } = {}) {
  const lista = Array.isArray(productos) ? productos.filter(Boolean) : [];
  const ventana = Number.isFinite(Number(diasAviso)) ? Number(diasAviso) : DIAS_AVISO;
  const out = [];

  for (const p of lista) {
    const credito = p.credito || {};
    const ultimo = p.ultimo || {};
    const fecha = proximaFechaPago({
      fechaLimitePago: ultimo.fechaLimitePago,
      diaPago: credito.diaPago,
    }, hoy);
    if (!fecha) continue;

    const dias = diasEntre(hoy, fecha);
    if (dias == null || dias > ventana) continue;

    const titulo = [credito.entidad || ultimo.entidad, credito.producto || ultimo.producto]
      .filter(Boolean).join(' · ') || p.clave || 'Producto';

    // El pago mínimo del extracto manda sobre la cuota de la ficha: es la cifra
    // que evita la mora.
    const r = ultimo.resumen || {};
    const minimo = [r.pagoAPlazos, r.pagoAPlazosUSD, credito.cuotaMensual]
      .map(Number).find((n) => Number.isFinite(n) && n > 0);

    out.push(Object.freeze({
      clave: p.clave || titulo,
      titulo,
      fecha,
      dias,
      monto: minimo != null ? Math.round(minimo) : null,
      nivel: dias <= 0 ? 'rojo' : 'ambar',
    }));
  }

  // Lo más urgente primero.
  out.sort((a, b) => a.dias - b.dias);
  return Object.freeze(out);
}

/** Frase de la alerta, en cristiano. PURA. */
export function textoAlerta(a) {
  if (!a || typeof a !== 'object') return '';
  if (a.dias < 0) return `se venció hace ${Math.abs(a.dias)} ${Math.abs(a.dias) === 1 ? 'día' : 'días'}`;
  if (a.dias === 0) return 'vence HOY';
  if (a.dias === 1) return 'vence mañana';
  return `vence en ${a.dias} días`;
}
