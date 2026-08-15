/* ============================================================
   olbo · diferidos.js
   Diferidos de tarjeta de crédito: el snapshot de un CORTE (estado de
   cuenta de un mes) y la lógica PURA para entenderlo:
     · cascada de abonos (a qué diferido cae la plata que abonas de más),
     · si un diferido SE PUEDE AISLAR (pagar solo),
     · interés del mes de un diferido,
     · la COMPARACIÓN mes-a-mes (¿el banco aplicó el abono como esperábamos?
       ¿quedó cerrada la compra que pagamos? ¿siguen intactas las demás?).

   Sin DOM ni IndexedDB → testeable en Node. El "now" es inyectable.

   REGLAS DEL BANCO (confirmadas por teléfono; son lógica de
   negocio, no datos de un solo mes):
   - NO hay pagos dirigidos: el cliente no elige a qué diferido va su abono.
   - Todo abono POR ENCIMA del pago a plazos ataca capital EN CASCADA, de la
     compra MÁS ANTIGUA a la MÁS RECIENTE (por fecha de transacción).
   ============================================================ */

import { tasaEAaMV, nowISO } from './model.js';

export const SCHEMA_CORTE = 'olbo.corte.v1';

/* ---- utilidades internas (puras) ---- */
function esTextoNoVacio(v) {
  return typeof v === 'string' && v.trim() !== '';
}
function txt(v) {
  return typeof v === 'string' ? v.trim() : '';
}
function esFechaISO(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) && Number.isFinite(Date.parse(v));
}
/** Número finito o `def` (default 0). No fuerza a entero: los cortes pueden
    ser en USD con decimales, así que se respeta lo que venga. */
function num(v, def = 0) {
  const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
  return Number.isFinite(n) ? n : def;
}
function enteroNoNeg(v) {
  const n = Number.isInteger(v) ? v : parseInt(v, 10);
  return Number.isInteger(n) && n >= 0 ? n : null;
}
/** slug estable para claves/identidad (sin acentos, minúsculas, guiones). */
export function slug(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';
}

/** Formatea un monto según la moneda del corte. PURA. */
export function fmtMonto(n, moneda = 'COP') {
  const x = num(n, 0);
  if (moneda === 'USD') return 'US$' + x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return '$' + Math.round(x).toLocaleString('es-CO');
}

/* ============================================================
   DIFERIDO (una compra financiada dentro de un corte)
   ============================================================ */
/**
 * Normaliza una línea de diferido a una forma limpia y congelada. PURA y
 * tolerante: nunca lanza. `saldoCapital` nunca negativo.
 */
export function normalizarDiferido(d = {}) {
  const o = d && typeof d === 'object' ? d : {};
  const saldo = num(o.saldoCapital, 0);
  const tasaEA = num(o.tasaEA, NaN);
  return Object.freeze({
    clave: esTextoNoVacio(o.clave) ? o.clave.trim() : slug(o.descripcion || o.compte || 'diferido'),
    descripcion: txt(o.descripcion),
    compte: o.compte != null ? String(o.compte).trim() : '',
    fecha: esFechaISO(o.fecha) ? o.fecha.slice(0, 10) : '',
    saldoCapital: saldo < 0 ? 0 : saldo,
    plazo: enteroNoNeg(o.plazo),
    cuotasPendientes: enteroNoNeg(o.cuotasPendientes),
    tasaEA: Number.isFinite(tasaEA) && tasaEA >= 0 ? tasaEA : null,
    nota: txt(o.nota),
    alerta: txt(o.alerta),
  });
}

/**
 * Ordena los diferidos por la CASCADA (más antiguo → más reciente, por fecha;
 * desempata por compte) y anota `orden` (1-based) y `aislable`.
 * Un diferido es AISLABLE si todo lo que va antes en la cascada tiene saldo 0:
 * solo entonces un abono lo alcanza sin tener que consumir otra deuda primero.
 * PURA.
 */
export function ordenarPorCascada(diferidos = []) {
  const arr = (Array.isArray(diferidos) ? diferidos : []).map(normalizarDiferido);
  const ordenados = arr.slice().sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1;
    return a.compte.localeCompare(b.compte);
  });
  return ordenados.map((d, i) => Object.freeze({
    ...d,
    orden: i + 1,
    aislable: ordenados.slice(0, i).every((x) => x.saldoCapital <= 0),
  }));
}

/** Suma del saldo a capital de todos los diferidos. PURA. */
export function totalDiferido(diferidos = []) {
  return (Array.isArray(diferidos) ? diferidos : [])
    .reduce((s, d) => s + num(d && d.saldoCapital, 0), 0);
}

/**
 * Simula un abono `monto` cayendo en cascada sobre el capital, de la compra
 * más antigua a la más reciente. Devuelve qué recibe cada diferido, si queda
 * cerrado, y el sobrante que no encontró dónde caer. PURA.
 */
export function simularAbono(diferidos = [], monto = 0) {
  let resto = num(monto, 0);
  const cola = ordenarPorCascada(diferidos);
  const aplicaciones = cola.map((d) => {
    const aplicado = resto > 0 ? Math.min(resto, d.saldoCapital) : 0;
    resto -= aplicado;
    const saldoDespues = d.saldoCapital - aplicado;
    return Object.freeze({
      clave: d.clave,
      descripcion: d.descripcion,
      saldoAntes: d.saldoCapital,
      aplicado,
      saldoDespues,
      cerrado: d.saldoCapital > 0 && saldoDespues <= 0,
    });
  });
  return Object.freeze({ aplicaciones: Object.freeze(aplicaciones), sobrante: resto > 0 ? resto : 0 });
}

/** Interés aproximado de UN mes de un diferido: saldo × tasa mensual. PURA. */
export function interesMensual(saldoCapital, tasaEA) {
  const s = num(saldoCapital, 0);
  const ea = num(tasaEA, 0);
  if (s <= 0 || ea <= 0) return 0;
  return Math.round(s * (tasaEAaMV(ea) / 100));
}

/* ============================================================
   COMPARACIÓN MES-A-MES
   El corazón de "¿el banco aplicó mi abono como esperábamos?".
   ============================================================ */
function clasificarCambio(p, c) {
  if (!c) return 'cerrado';                                  // ya no aparece → saldado
  const dCuotas = (c.cuotasPendientes ?? 0) - (p.cuotasPendientes ?? 0);
  const dSaldo = c.saldoCapital - p.saldoCapital;
  if (dCuotas <= -2) return 'abono';                         // se comió 2+ cuotas → abono extra
  if (dCuotas === 0 && dSaldo < 0) return 'abono-parcial';   // bajó saldo sin bajar cuota
  if (dCuotas === -1) return 'normal';                       // avanzó una cuota, como debe
  if (dSaldo === 0 && dCuotas === 0) return 'intacto';       // sin movimiento
  if (dSaldo > 0 || dCuotas > 0) return 'crecio';            // raro: nuevo cargo al diferido
  return 'normal';
}

function veredictoDe(estado, p, c, moneda) {
  const nombre = p.descripcion || p.clave;
  const antes = fmtMonto(p.saldoCapital, moneda);
  switch (estado) {
    case 'cerrado': return `${nombre}: CERRADO ✓ (ya no aparece; antes debías ${antes}).`;
    case 'abono': return `${nombre}: le entró un ABONO EXTRA (bajó de ${antes} a ${fmtMonto(c.saldoCapital, moneda)} y saltó ${p.cuotasPendientes - c.cuotasPendientes} cuotas).`;
    case 'abono-parcial': return `${nombre}: abono parcial (saldo ${antes} → ${fmtMonto(c.saldoCapital, moneda)}, sin cambiar cuotas).`;
    case 'normal': return `${nombre}: avanzó su cuota normal (${p.cuotasPendientes} → ${c.cuotasPendientes} cuotas).`;
    case 'intacto': return `${nombre}: intacto (${fmtMonto(c.saldoCapital, moneda)}, ${c.cuotasPendientes} cuotas).`;
    case 'crecio': return `⚠ ${nombre}: creció o le cargaron algo nuevo (${antes} → ${fmtMonto(c.saldoCapital, moneda)}). Revísalo.`;
    default: return `${nombre}: sin clasificar.`;
  }
}

/**
 * Compara dos cortes del MISMO producto (anterior vs nuevo) diferido por
 * diferido, por `clave`. Dice qué se cerró, a qué le entró abono, qué solo
 * avanzó su cuota y qué apareció nuevo. Es lo que responde "¿el banco aplicó
 * mi abono a la cabeza de la cascada primero?". PURA.
 *
 * @returns {{items:Array, cerrados:Array, conAbono:Array, normales:Array,
 *   intactos:Array, nuevos:Array, anomalias:Array, resumenTexto:string}}
 */
export function compararCortes(anterior, nuevo) {
  const moneda = (nuevo && nuevo.moneda) || (anterior && anterior.moneda) || 'COP';
  const prev = (anterior && Array.isArray(anterior.diferidos) ? anterior.diferidos : []).map(normalizarDiferido);
  const curr = (nuevo && Array.isArray(nuevo.diferidos) ? nuevo.diferidos : []).map(normalizarDiferido);
  // Empareja por el No. de comprobante (compte): es único y persiste entre
  // cortes, aunque dos compras tengan la misma descripción. Cae a la clave si
  // no hay compte.
  const key = (d) => (d.compte && d.compte.trim()) ? d.compte.trim() : d.clave;
  const currPorKey = new Map(curr.map((d) => [key(d), d]));
  const keysPrev = new Set(prev.map((d) => key(d)));

  const items = prev.map((p) => {
    const c = currPorKey.get(key(p)) || null;
    const estado = clasificarCambio(p, c);
    return Object.freeze({
      clave: p.clave,
      descripcion: p.descripcion,
      estado,
      saldoAntes: p.saldoCapital,
      saldoDespues: c ? c.saldoCapital : 0,
      cuotasAntes: p.cuotasPendientes,
      cuotasDespues: c ? c.cuotasPendientes : 0,
      veredicto: veredictoDe(estado, p, c, moneda),
    });
  });

  const nuevos = curr
    .filter((c) => !keysPrev.has(key(c)))
    .map((c) => Object.freeze({
      clave: c.clave, descripcion: c.descripcion, estado: 'nuevo',
      saldoAntes: 0, saldoDespues: c.saldoCapital,
      cuotasAntes: 0, cuotasDespues: c.cuotasPendientes,
      veredicto: `${c.descripcion || c.clave}: diferido NUEVO este corte (${fmtMonto(c.saldoCapital, moneda)}, ${c.cuotasPendientes} cuotas).`,
    }));

  const por = (est) => items.filter((x) => x.estado === est);
  const cerrados = por('cerrado');
  const conAbono = items.filter((x) => x.estado === 'abono' || x.estado === 'abono-parcial');
  const normales = por('normal');
  const intactos = por('intacto');
  const anomalias = por('crecio');

  const partes = [];
  if (cerrados.length) partes.push(`Cerraste: ${cerrados.map((x) => x.descripcion || x.clave).join(', ')}.`);
  if (conAbono.length) partes.push(`Con abono extra: ${conAbono.map((x) => x.descripcion || x.clave).join(', ')}.`);
  if (normales.length || intactos.length) {
    const q = [...normales, ...intactos].map((x) => x.descripcion || x.clave);
    partes.push(`Solo avanzaron su cuota / sin cambio: ${q.join(', ')}.`);
  }
  if (nuevos.length) partes.push(`Nuevos: ${nuevos.map((x) => x.descripcion || x.clave).join(', ')}.`);
  if (anomalias.length) partes.push(`⚠ Revisar: ${anomalias.map((x) => x.descripcion || x.clave).join(', ')}.`);

  return {
    items: Object.freeze([...items, ...nuevos]),
    cerrados: Object.freeze(cerrados),
    conAbono: Object.freeze(conAbono),
    normales: Object.freeze(normales),
    intactos: Object.freeze(intactos),
    nuevos: Object.freeze(nuevos),
    anomalias: Object.freeze(anomalias),
    resumenTexto: partes.join(' '),
  };
}

/* ============================================================
   CORTE (snapshot de un estado de cuenta)
   ============================================================ */
function normalizarResumen(r) {
  return r && typeof r === 'object' ? Object.freeze({ ...r }) : Object.freeze({});
}

export function validarCorte(obj = {}) {
  const errores = [];
  if (!obj || typeof obj !== 'object') return { ok: false, errores: ['El corte no es un objeto.'] };
  if (!esTextoNoVacio(obj.entidad)) errores.push('La entidad es obligatoria.');
  if (!esTextoNoVacio(obj.producto)) errores.push('El producto es obligatorio.');
  if (!esFechaISO(obj.corte)) errores.push('La fecha de corte debe ser ISO (YYYY-MM-DD).');
  if (!esTextoNoVacio(obj.moneda)) errores.push('La moneda es obligatoria.');
  if (!Array.isArray(obj.diferidos)) errores.push('diferidos debe ser un arreglo.');
  return errores.length ? { ok: false, errores } : { ok: true, value: obj };
}

/**
 * Crea un CORTE congelado y validado (fail-fast). `cuentaClave` agrupa los
 * cortes del MISMO producto a través de los meses (para comparar mes-a-mes).
 * `id` = cuentaClave + mes, salvo que se pase uno explícito. PURA (salvo `now`).
 */
export function crearCorte(datos = {}, { now = new Date() } = {}) {
  const entidad = txt(datos.entidad);
  const producto = txt(datos.producto);
  const moneda = txt(datos.moneda) || 'COP';
  const corte = esFechaISO(datos.corte) ? datos.corte.slice(0, 10) : '';
  const cuentaClave = esTextoNoVacio(datos.cuentaClave)
    ? datos.cuentaClave.trim()
    : slug(`${entidad}-${producto}-${moneda}`);
  const diferidos = (Array.isArray(datos.diferidos) ? datos.diferidos : []).map(normalizarDiferido);

  const base = {
    schema: SCHEMA_CORTE,
    cuentaClave,
    entidad,
    producto,
    tarjetaMask: txt(datos.tarjetaMask),
    moneda,
    corte,
    fechaLimitePago: esFechaISO(datos.fechaLimitePago) ? datos.fechaLimitePago.slice(0, 10) : '',
    resumen: normalizarResumen(datos.resumen),
    diferidos,
    totalDiferido: Number.isFinite(datos.totalDiferido) ? datos.totalDiferido : totalDiferido(diferidos),
    notas: Array.isArray(datos.notas) ? datos.notas.filter((s) => typeof s === 'string') : [],
  };

  const v = validarCorte(base);
  if (!v.ok) throw new Error('Corte inválido: ' + v.errores.join(' '));

  const id = esTextoNoVacio(datos.id) ? datos.id.trim() : `${cuentaClave}-${corte.slice(0, 7)}`;
  const ts = nowISO(now);
  return Object.freeze({
    id,
    ...base,
    diferidos: Object.freeze(diferidos),
    notas: Object.freeze(base.notas),
    creadoEn: datos.creadoEn || ts,
    actualizadoEn: ts,
  });
}

/**
 * Brief de deuda en texto plano para alimentar el contexto del agente de
 * conciencia. Incluye la cascada, qué se puede aislar y las alertas. PURA.
 */
export function resumenDeudaTexto(corte) {
  if (!corte || !Array.isArray(corte.diferidos) || !corte.diferidos.length) return '';
  const moneda = corte.moneda || 'COP';
  const casc = ordenarPorCascada(corte.diferidos);
  const L = [];
  L.push(`DEUDA DIFERIDA — ${txt(corte.entidad)} ${txt(corte.producto)} (corte ${corte.corte || ''}, ${moneda}):`);
  L.push('Regla del banco: NO hay pagos dirigidos; todo abono por encima del pago a plazos ataca capital de la compra MÁS ANTIGUA a la MÁS RECIENTE (cascada).');
  for (const d of casc) {
    const partes = [`${d.orden}. ${d.descripcion || d.clave}`, `saldo ${fmtMonto(d.saldoCapital, moneda)}`];
    if (d.cuotasPendientes != null) partes.push(`${d.cuotasPendientes} cuotas pend.`);
    if (d.tasaEA != null) partes.push(`${d.tasaEA}% EA`);
    partes.push(d.aislable ? 'SE PUEDE AISLAR (cabeza de la cascada)' : 'NO se puede aislar (detrás de otro con saldo)');
    if (d.alerta) partes.push(`⚠ ${d.alerta}`);
    L.push('  · ' + partes.join(' · '));
  }
  L.push(`Total diferido: ${fmtMonto(totalDiferido(corte.diferidos), moneda)}.`);
  const r = corte.resumen || {};
  const pagoTotal = r.pagoTotal ?? r.pagoTotalUSD;
  const pagoPlazos = r.pagoAPlazos ?? r.pagoAPlazosUSD;
  if (Number.isFinite(pagoTotal)) L.push(`Pago total: ${fmtMonto(pagoTotal, moneda)}. Pago a plazos (mínimo al día): ${Number.isFinite(pagoPlazos) ? fmtMonto(pagoPlazos, moneda) : '—'}.`);
  if (corte.fechaLimitePago) L.push(`Fecha límite de pago: ${corte.fechaLimitePago}.`);
  return L.join('\n');
}

/**
 * Agrupa una lista de cortes por producto (`cuentaClave`) y, para cada uno,
 * devuelve su corte más reciente y el anterior (para comparar). PURA.
 * @returns {Map<string,{ultimo:object, anterior:object|null}>}
 */
export function agruparUltimosCortes(cortes = []) {
  const porCuenta = new Map();
  for (const c of (Array.isArray(cortes) ? cortes : [])) {
    if (!c || !esTextoNoVacio(c.cuentaClave)) continue;
    porCuenta.set(c.cuentaClave, [...(porCuenta.get(c.cuentaClave) || []), c]);
  }
  const out = new Map();
  for (const [clave, arr] of porCuenta) {
    const desc = arr.slice().sort((a, b) => (a.corte < b.corte ? 1 : a.corte > b.corte ? -1 : 0));
    out.set(clave, { ultimo: desc[0], anterior: desc[1] || null });
  }
  return out;
}

/**
 * Clave con la que un crédito GUARDADO se corresponde con sus cortes. PURA.
 * crearCorte deriva `cuentaClave` de slug(entidad-producto-moneda) cuando no
 * viene explícita, así que reconstruirla igual empareja sin heurísticas.
 */
export function claveDeCredito(credito = {}, moneda = 'COP') {
  const c = credito && typeof credito === 'object' ? credito : {};
  if (esTextoNoVacio(c.cuentaClave)) return c.cuentaClave.trim();
  return slug(`${txt(c.entidad)}-${txt(c.producto)}-${txt(moneda) || 'COP'}`);
}

/**
 * Une cada producto de la cartera con su último extracto. PURA.
 *
 * Sin esto la conciencia recibe dos listas sueltas —los créditos por un lado y
 * los cortes por otro— y no puede saber que tal extracto es tal tarjeta, que
 * es justo lo que hace falta para razonar "sobre ESTE producto".
 *
 * Los cortes que no casan con ningún crédito guardado NO se descartan: se
 * devuelven al final con `credito: null`. Un extracto subido antes de crear la
 * ficha del producto sigue siendo información valiosa.
 *
 * @returns {Array<{credito:object|null, clave:string, ultimo:object|null, anterior:object|null}>}
 */
export function emparejarProductos(creditos = [], cortes = []) {
  const porClave = agruparUltimosCortes(cortes);
  const usadas = new Set();

  const conFicha = (Array.isArray(creditos) ? creditos : [])
    .filter(Boolean)
    .map((credito) => {
      const clave = claveDeCredito(credito);
      const par = porClave.get(clave) || null;
      if (par) usadas.add(clave);
      return Object.freeze({
        credito,
        clave,
        ultimo: par ? par.ultimo : null,
        anterior: par ? par.anterior : null,
      });
    });

  const huerfanos = [];
  for (const [clave, par] of porClave) {
    if (usadas.has(clave)) continue;
    huerfanos.push(Object.freeze({ credito: null, clave, ultimo: par.ultimo, anterior: par.anterior }));
  }

  return Object.freeze([...conFicha, ...huerfanos]);
}

/**
 * Brief de deuda para el agente de conciencia: por cada producto, el estado
 * del último corte + los cambios frente al corte anterior (lo que responde
 * "¿cómo va mi deuda?" y "¿el banco aplicó el abono como esperábamos?"). PURA.
 */
export function construirBriefDeuda(cortes = []) {
  const bloques = [];
  for (const { ultimo, anterior } of agruparUltimosCortes(cortes).values()) {
    const bloque = briefProducto(ultimo, anterior);
    if (bloque) bloques.push(bloque);
  }
  return bloques.join('\n\n');
}

/**
 * Brief del extracto de UN solo producto. PURA.
 * Es la unidad que consume el contexto por producto; construirBriefDeuda la
 * repite para todos.
 */
export function briefProducto(ultimo, anterior) {
  if (!ultimo) return '';
  const L = [resumenDeudaTexto(ultimo)];
  if (anterior) {
    const cmp = compararCortes(anterior, ultimo);
    if (cmp.resumenTexto) L.push(`CAMBIOS vs el corte anterior (${anterior.corte} → ${ultimo.corte}): ${cmp.resumenTexto}`);
  }
  return L.filter(Boolean).join('\n');
}
