/* ============================================================
   Bolsillo · budget.js
   MOTOR PURO del semáforo financiero. Sin db ni window ni DOM
   en el top-level: importable y testeable en Node.
   El "hoy" es SIEMPRE inyectable (Date o ISO) — nunca Date.now()
   dentro de la matemática. Dinero en enteros de pesos.

   Idea central: el color NO mira cuánto llevas gastado en bruto,
   sino tu RITMO relativo al día del mes. Gastar 90% del bolsillo
   variable el día 28 va bien; gastar 80% el día 10 es alerta.
   ============================================================ */

/* Umbral de la banda ámbar→rojo (razón ritmo/avance). Configurable. */
export const UMBRAL_AMARILLO_DEFAULT = 1.25;

const CATEGORIA_FALLBACK = 'otros';

const ETIQUETAS = Object.freeze({
  verde: 'Vas bien',
  ambar: 'Cuidado',
  rojo: 'Alerta',
  'sin-config': 'Sin configurar',
});

const MENSAJES = Object.freeze({
  verde: 'Vas al ritmo del mes',
  ambar: 'Vas un poco rápido, ojo',
  rojo: 'Gastando más rápido que el mes',
  'sin-config': 'Configura tu sueldo para empezar',
  fijosSuperan: 'Tus gastos fijos ya se comen todo tu sueldo',
});

/* ---- helpers de fecha (puros) ---- */

/** Normaliza un Date o ISO a 'YYYY-MM-DD'. Falla fuerte si es inválido. */
function aFechaISO(fecha) {
  if (fecha instanceof Date) {
    if (Number.isNaN(fecha.getTime())) throw new Error('calcularEstado: "hoy" es una fecha inválida.');
    return fecha.toISOString().slice(0, 10);
  }
  if (typeof fecha === 'string' && fecha.trim() !== '') {
    if (/^\d{4}-\d{2}-\d{2}/.test(fecha)) return fecha.slice(0, 10);
    const d = new Date(fecha);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  throw new Error('calcularEstado: "hoy" debe ser un Date o una fecha ISO válida.');
}

/** Partes de una fecha (Date/ISO): año, mes 1-based, día y prefijo 'YYYY-MM'. */
function partes(fecha) {
  const iso = aFechaISO(fecha);
  return {
    anio: Number(iso.slice(0, 4)),
    mes: Number(iso.slice(5, 7)),
    dia: Number(iso.slice(8, 10)),
    prefijo: iso.slice(0, 7),
  };
}

/** Días del mes calendario de `fecha` (Date/ISO). Ej: febrero 2026 → 28. */
export function diasEnMes(fecha) {
  const { anio, mes } = partes(fecha);
  // new Date(anio, mes, 0) = último día del mes 1-based; getDate() es TZ-independiente.
  return new Date(anio, mes, 0).getDate();
}

/* ---- helpers de dominio (puros) ---- */

const esEntero = (n) => Number.isInteger(n);
const redondear = (n) => (Number.isFinite(n) ? Math.round(n) : 0);

/** ¿La fecha del movimiento cae en el mes `prefijo` ('YYYY-MM')? */
function enMes(mov, prefijo) {
  return mov && typeof mov.fecha === 'string' && mov.fecha.slice(0, 7) === prefijo;
}

/** Umbral amarillo desde config, con default seguro. */
function leerUmbralAmarillo(config) {
  const raw = config && config.umbralesSemaforo && config.umbralesSemaforo.amarillo;
  return Number.isFinite(raw) && raw > 0 ? raw : UMBRAL_AMARILLO_DEFAULT;
}

/** Color del presupuesto de una categoría según cuánto de él lleva gastado. */
function colorPresupuesto(total, presupuesto) {
  if (!(presupuesto > 0)) return null;
  const r = total / presupuesto;
  if (r > 1) return 'rojo';
  if (r > 0.85) return 'ambar';
  return 'verde';
}

/**
 * Gasto variable por categoría del mes (solo gasto no-fijo).
 * Devuelve [{categoriaId, total, pct, presupuesto?, color?}] ordenado desc.
 */
function desglosarCategorias(variables, variableGastado, config) {
  const presupuestos = (config && config.presupuestos) || {};
  const acum = new Map();
  for (const m of variables) {
    const id = typeof m.categoria === 'string' && m.categoria.trim() !== '' ? m.categoria : CATEGORIA_FALLBACK;
    acum.set(id, (acum.get(id) || 0) + m.monto);
  }
  const filas = [];
  for (const [categoriaId, total] of acum) {
    const fila = {
      categoriaId,
      total: redondear(total),
      pct: variableGastado > 0 ? total / variableGastado : 0,
    };
    const presupuesto = presupuestos[categoriaId];
    if (esEntero(presupuesto) && presupuesto > 0) {
      fila.presupuesto = presupuesto;
      fila.color = colorPresupuesto(total, presupuesto);
    }
    filas.push(Object.freeze(fila));
  }
  filas.sort((a, b) => b.total - a.total);
  return Object.freeze(filas);
}

/**
 * Fijos comprometidos del mes SIN doble conteo. Tres fuentes:
 *  (A) movimientos con esFijo===true del mes (materializados o a mano), MÁS
 *  (B) recurrentes EXACTOS activos aún NO materializados este mes (compromiso
 *      pendiente), respetando excepciones["YYYY-MM"] (saltar→no cuenta,
 *      monto→ese monto). Los de VALOR VARIABLE NO reservan (se excluyen), MÁS
 *  (C) cuotas de créditos activos: cada crédito aporta su cuota UNA vez. Si ya
 *      hay un movimiento ligado a ese crédito este mes (creditoId), su pago real
 *      manda: los esFijo ya están en (A) y los pago_credito/no-fijo se suman
 *      aquí; en ambos casos NO se agrega también la cuota abstracta.
 *
 * @returns {{fijos:number, creditos:number}} total de fijos y su porción de créditos
 */
function calcularFijos(movimientos, recurrentes, creditos, prefijo) {
  // (A) fijos ya registrados (materializados o capturados a mano) +
  //     índice de movimientos ligados a un crédito este mes.
  let fijosMaterializados = 0;
  const recIdsMaterializados = new Set();
  const movsPorCredito = new Map(); // creditoId → { hay:true, noFijo:number }
  for (const m of movimientos) {
    if (!enMes(m, prefijo)) continue;
    if (m.esFijo === true) {
      fijosMaterializados += m.monto;
      if (m.recurrenteId) recIdsMaterializados.add(m.recurrenteId);
    }
    if (m.creditoId) {
      const acc = movsPorCredito.get(m.creditoId) || { hay: true, noFijo: 0 };
      // Un esFijo con creditoId ya está en (A); solo acumulamos aquí lo NO-fijo
      // (p. ej. un pago_credito) para no perderlo ni duplicarlo.
      if (m.esFijo !== true) acc.noFijo += m.monto;
      movsPorCredito.set(m.creditoId, acc);
    }
  }

  // (B) recurrentes activos pendientes (sin movimiento propio este mes).
  let fijosPendientes = 0;
  for (const rec of recurrentes) {
    if (!rec || rec.activo !== true) continue;
    // Un fijo de VALOR VARIABLE (luz, agua, gasolina…) NO reserva su estimado:
    // solo pesa cuando el usuario registra su valor real del mes (ahí entra
    // como movimiento esFijo en la parte A). Los exactos siguen igual.
    if (rec.esVariable === true) continue;
    if (recIdsMaterializados.has(rec.id)) continue; // ya contado en (A): no duplicar
    const exc = rec.excepciones && rec.excepciones[prefijo];
    if (exc && exc.saltar === true) continue; // saltado este mes: no compromete
    const monto = exc && esEntero(exc.monto) ? exc.monto : rec.monto;
    if (esEntero(monto)) fijosPendientes += monto;
  }

  // (C) cuotas de créditos activos, sin doble conteo.
  let cuotasCredito = 0;
  for (const c of creditos) {
    if (!c || c.activo === false) continue; // inactivo (undefined = activo, retrocompat)
    if (!esEntero(c.cuotaMensual) || c.cuotaMensual <= 0) continue; // sin cuota → no rompe
    const mov = movsPorCredito.get(c.id);
    // Si ya hay movimiento(s) ligados: cuenta su pago real (solo la parte no-fija,
    // porque la esFija ya entró en (A)); si no, la cuota abstracta comprometida.
    cuotasCredito += mov ? mov.noFijo : c.cuotaMensual;
  }

  return {
    fijos: redondear(fijosMaterializados + fijosPendientes + cuotasCredito),
    creditos: redondear(cuotasCredito),
  };
}

/**
 * calcularEstado — corazón del semáforo. PURO y de solo lectura.
 *
 * @param {object} args
 * @param {number|null} args.ingresoEmpleo  sueldo mensual (entero de pesos)
 * @param {object[]}    args.movimientos    movimientos del usuario
 * @param {object[]}    args.recurrentes    gastos fijos definidos
 * @param {object[]}    args.creditos       créditos del usuario (sus cuotas pesan)
 * @param {Date|string} args.hoy            fecha de referencia (inyectable)
 * @param {object}      args.config         config (umbrales, presupuestos)
 * @returns {Readonly<object>} estado congelado con color + números del mes
 */
export function calcularEstado({ ingresoEmpleo, movimientos = [], recurrentes = [], creditos = [], hoy, config = {} } = {}) {
  const movs = Array.isArray(movimientos) ? movimientos.filter(Boolean) : [];
  const recs = Array.isArray(recurrentes) ? recurrentes.filter(Boolean) : [];
  const creds = Array.isArray(creditos) ? creditos.filter(Boolean) : [];

  const { dia, prefijo } = partes(hoy);
  const diasMes = diasEnMes(hoy);
  const diasRestantes = diasMes - dia + 1; // hoy cuenta
  const avance = dia / diasMes; // fracción de mes transcurrida (dia>=1 ⇒ >0)

  // Gasto VARIABLE del mes: gasto y NO fijo (excluye ingresos, pagos, transfers, fijos).
  const variables = movs.filter((m) => m.tipo === 'gasto' && m.esFijo === false && enMes(m, prefijo));
  const variableGastado = redondear(variables.reduce((s, m) => s + m.monto, 0));

  // Ingresos RECIBIDOS del mes: solo lo que el usuario registró que entró (los
  // negocios varían; el "esperado" es referencia, no entra al cálculo).
  const ingresosRecibidos = redondear(
    movs.filter((m) => m.tipo === 'ingreso' && enMes(m, prefijo)).reduce((s, m) => s + m.monto, 0),
  );

  const { fijos: fijosDelMes, creditos: fijosCreditos } = calcularFijos(movs, recs, creds, prefijo);
  const totalHormiga = redondear(
    movs.filter((m) => m.esHormiga === true && enMes(m, prefijo)).reduce((s, m) => s + m.monto, 0),
  );
  const porCategoria = desglosarCategorias(variables, variableGastado, config);

  const proyeccionVariable = redondear(variableGastado / avance);
  const proyeccionTotal = fijosDelMes + proyeccionVariable;

  const base = {
    diasMes,
    dia,
    diasRestantes,
    avance,
    variableGastado,
    ingresosRecibidos,
    fijosDelMes,
    fijosCreditos,
    totalHormiga,
    porCategoria,
    proyeccionVariable,
    proyeccionTotal,
  };

  // --- Sin sueldo configurado: nada de NaN ni divisiones por cero ---
  // La base del semáforo sigue siendo el SUELDO: sin él no hay ritmo que medir.
  const ingreso = esEntero(ingresoEmpleo) ? ingresoEmpleo : (Number.isFinite(ingresoEmpleo) ? Math.round(ingresoEmpleo) : 0);
  if (!(ingreso > 0)) {
    return Object.freeze({
      ...base,
      configurado: false,
      color: 'sin-config',
      etiqueta: ETIQUETAS['sin-config'],
      mensaje: MENSAJES['sin-config'],
      ingresoEmpleo: 0,
      plataDelMes: ingresosRecibidos,
      baseVariable: null,
      ritmo: null,
      razon: null,
      porcentajeIngreso: null,
      disponibleRestante: null,
      disponiblePorDia: null,
      fijosSuperanIngreso: false,
    });
  }

  // Plata del mes = sueldo (base fija) + lo que efectivamente entró de negocios.
  const plataDelMes = ingreso + ingresosRecibidos;
  const baseVariable = plataDelMes - fijosDelMes;
  const porcentajeIngreso = plataDelMes > 0 ? variableGastado / plataDelMes : 0;

  // --- Los fijos igualan o superan el sueldo: rojo, sin dividir por cero ---
  if (baseVariable <= 0) {
    const disponibleRestante = baseVariable - variableGastado;
    return Object.freeze({
      ...base,
      configurado: true,
      color: 'rojo',
      etiqueta: ETIQUETAS.rojo,
      mensaje: MENSAJES.fijosSuperan,
      ingresoEmpleo: ingreso,
      plataDelMes,
      baseVariable,
      ritmo: null,
      razon: null,
      porcentajeIngreso,
      disponibleRestante,
      disponiblePorDia: redondear(disponibleRestante / diasRestantes),
      fijosSuperanIngreso: true,
    });
  }

  // --- Caso normal ---
  const ritmo = variableGastado / baseVariable;
  const razon = ritmo / avance;
  const amarillo = leerUmbralAmarillo(config);

  let color;
  if (razon > amarillo || ritmo >= 1) color = 'rojo';
  else if (razon > 1) color = 'ambar';
  else color = 'verde';

  const disponibleRestante = baseVariable - variableGastado;

  return Object.freeze({
    ...base,
    configurado: true,
    color,
    etiqueta: ETIQUETAS[color],
    mensaje: MENSAJES[color],
    ingresoEmpleo: ingreso,
    plataDelMes,
    baseVariable,
    ritmo,
    razon,
    porcentajeIngreso,
    disponibleRestante,
    disponiblePorDia: redondear(disponibleRestante / diasRestantes),
    fijosSuperanIngreso: false,
  });
}

const esTextoNoVacio = (v) => typeof v === 'string' && v.trim() !== '';

/** Nombre legible de un crédito. PURA. (Retrocompat: producto o `tipo` viejo.) */
function etiquetaCredito(c) {
  const producto = esTextoNoVacio(c.producto) ? c.producto.trim()
    : (esTextoNoVacio(c.tipo) ? c.tipo.trim() : 'Crédito');
  const entidad = esTextoNoVacio(c.entidad) ? c.entidad.trim() : '';
  return entidad ? `${entidad} · ${producto}` : producto;
}

/**
 * Resumen por fuente de negocio para el dashboard: cuánto entró este mes vs.
 * la cuota del crédito que cubre. Responde de un vistazo si el negocio se
 * paga solo o si el sueldo está tapando el hueco. PURA y de solo lectura.
 *
 * @param {object} args
 * @param {object[]} args.fuentes      fuentes de ingreso (se ignora `empleo`)
 * @param {object[]} args.movimientos  movimientos (tipo:'ingreso' con ingresoId)
 * @param {object[]} args.creditos     créditos (para leer la cuota vinculada)
 * @param {Date|string} args.hoy       fecha de referencia (inyectable)
 * @returns {Readonly<object>[]} una fila por fuente de negocio
 */
export function resumenNegocios({ fuentes = [], movimientos = [], creditos = [], hoy } = {}) {
  const { prefijo } = partes(hoy);
  const negocios = (Array.isArray(fuentes) ? fuentes : []).filter((f) => f && f.fuente !== 'empleo');
  if (!negocios.length) return Object.freeze([]);

  // Recibido este mes por fuente (suma de ingresos con ese ingresoId).
  const recibidoPorFuente = new Map();
  for (const m of (Array.isArray(movimientos) ? movimientos : [])) {
    if (!m || m.tipo !== 'ingreso' || !enMes(m, prefijo) || !m.ingresoId) continue;
    recibidoPorFuente.set(m.ingresoId, (recibidoPorFuente.get(m.ingresoId) || 0) + m.monto);
  }
  const creditoPorId = new Map((Array.isArray(creditos) ? creditos : []).filter(Boolean).map((c) => [c.id, c]));

  const filas = negocios.map((f) => {
    const recibido = redondear(recibidoPorFuente.get(f.id) || 0);
    const credito = f.creditoId ? creditoPorId.get(f.creditoId) : null;
    const cuota = credito && esEntero(credito.cuotaMensual) && credito.cuotaMensual > 0 ? credito.cuotaMensual : null;
    const cobertura = cuota != null ? recibido / cuota : null;
    let color = null;
    if (cobertura != null) {
      if (cobertura >= 1) color = 'verde';
      else if (cobertura >= 0.6) color = 'ambar';
      else color = 'rojo';
    }
    return Object.freeze({
      id: f.id,
      nombre: esTextoNoVacio(f.nombre) ? f.nombre.trim() : 'Negocio',
      esperado: esEntero(f.montoEsperado) && f.montoEsperado > 0 ? f.montoEsperado : null,
      recibido,
      creditoId: f.creditoId || null,
      creditoLabel: credito ? etiquetaCredito(credito) : null,
      cuota,
      cobertura,
      color,
    });
  });
  return Object.freeze(filas);
}

/* ============================================================
   Personas — guardarraíl de gasto por persona/categoría vigilada
   ============================================================ */

/**
 * Topes por defecto como FRACCIÓN del ingreso neto del mes.
 * Guardarraíl estilo 50/30/20 (proteger ahorro; "gustos" acotados).
 * El id es la categoría; el tope es el punto ROJO (mala práctica).
 * Doug: persona1=Antonella(hija) · persona2=Marley(novia) · persona3=Madre.
 * Editable por el usuario en config.topesPersona (merge por id).
 */
export const TOPES_PERSONA_DEFAULT = Object.freeze({
  persona1: 0.15, // Antonella (hija)
  persona2: 0.10, // Marley (novia)
  persona3: 0.10, // Madre
  yo: 0.15,       // Yo (personal)
  ocio: 0.10,     // Ocio (categoría vigilada)
});

/** Banda ámbar: cuántos PUNTOS de fracción antes del tope avisa (2 pts). */
export const AVISO_PUNTOS_DEFAULT = 0.02;

/** Ids vigilados por defecto en el dashboard de Personas (orden de la barra). */
export const VIGILADOS_DEFAULT = Object.freeze(['persona1', 'persona2', 'persona3', 'yo', 'ocio']);

/**
 * Resumen de gasto por "vigilado" (persona o categoría) contra su tope,
 * medido como fracción del ingreso NETO del mes. PURA y de solo lectura.
 *
 * Cuenta TODO el gasto del mes con esa categoría (fijo + variable): es
 * "cuánto va en esta persona", no solo lo discrecional.
 *
 * @param {object} args
 * @param {object[]}    args.movimientos  movimientos del usuario
 * @param {object[]}    args.vigilados    [{id, label}] a vigilar (personas + ocio…)
 * @param {number}      args.netoDelMes   ingreso neto del mes (sueldo + negocios recibidos)
 * @param {object}      [args.topes]      {id: fracción} tope por id (rojo)
 * @param {number}      [args.avisoPuntos] banda ámbar en puntos (default 0.02)
 * @param {Date|string} args.hoy          fecha de referencia (inyectable)
 * @returns {Readonly<object>[]} una fila por vigilado, ordenada por gasto desc
 */
export function resumenPersonas({ movimientos = [], vigilados = [], netoDelMes = 0, topes = TOPES_PERSONA_DEFAULT, avisoPuntos = AVISO_PUNTOS_DEFAULT, hoy } = {}) {
  const { prefijo } = partes(hoy);
  const neto = esEntero(netoDelMes) ? netoDelMes : (Number.isFinite(netoDelMes) ? Math.round(netoDelMes) : 0);
  const aviso = Number.isFinite(avisoPuntos) && avisoPuntos >= 0 ? avisoPuntos : AVISO_PUNTOS_DEFAULT;

  // Gasto TOTAL del mes por categoría (fijo + variable).
  const gastoPorCat = new Map();
  for (const m of (Array.isArray(movimientos) ? movimientos : [])) {
    if (!m || m.tipo !== 'gasto' || !enMes(m, prefijo)) continue;
    const id = esTextoNoVacio(m.categoria) ? m.categoria : CATEGORIA_FALLBACK;
    gastoPorCat.set(id, (gastoPorCat.get(id) || 0) + m.monto);
  }

  const filas = (Array.isArray(vigilados) ? vigilados : []).map((v) => {
    const gastado = redondear(gastoPorCat.get(v.id) || 0);
    const topeFrac = Number.isFinite(topes[v.id]) && topes[v.id] > 0 ? topes[v.id] : 0;
    const pctIngreso = neto > 0 ? gastado / neto : 0;              // fracción del neto (0..1)
    const topeMonto = topeFrac > 0 ? redondear(neto * topeFrac) : null;
    const avanceTope = topeFrac > 0 ? pctIngreso / topeFrac : 0;   // 1 = justo en el tope
    const faltanPuntos = topeFrac > 0 ? topeFrac - pctIngreso : null; // >0 aún hay margen

    let color = 'verde';
    if (topeFrac > 0) {
      if (pctIngreso >= topeFrac) color = 'rojo';
      else if (pctIngreso >= topeFrac - aviso) color = 'ambar';
    }
    return Object.freeze({
      id: v.id,
      label: esTextoNoVacio(v.label) ? v.label : v.id,
      gastado,
      pctIngreso,     // fracción del neto
      topeFrac,       // fracción tope (rojo)
      topeMonto,      // pesos del tope
      avanceTope,     // gastado / tope (0..>1)
      faltanPuntos,   // puntos de fracción para el tope (negativo = ya pasó)
      color,
    });
  });
  filas.sort((a, b) => b.gastado - a.gastado);
  return Object.freeze(filas);
}
