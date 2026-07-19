/* ============================================================
   Bolsillo · backup.js
   Export / import del respaldo local. serializar/deserializar son
   PURAS (testeables en Node). exportar/importar reciben el módulo
   `db` por inyección: este archivo NO importa db.js.
   REGLA DURA: config.apiKey NUNCA sale del dispositivo.
   ============================================================ */

export const FORMATO = 'bolsillo-backup';
export const VERSION_BACKUP = 1;

/**
 * Campos que viven SOLO en este dispositivo: nunca salen en un export ni
 * entran desde un archivo importado. Una sola lista para las dos puertas,
 * así la simetría es imposible de olvidar al agregar un campo sensible.
 */
export const CAMPOS_SOLO_LOCALES = Object.freeze(['apiKey']);

/**
 * Copia de la config sin los campos solo-locales (hoy: apiKey). PURA.
 * Se usa en las DOS direcciones: al serializar (que no salga) y al importar
 * (que no entre y pise la clave del usuario).
 */
export function sinCamposLocales(config) {
  if (!config || typeof config !== 'object') return config;
  return Object.fromEntries(
    Object.entries(config).filter(([clave]) => !CAMPOS_SOLO_LOCALES.includes(clave)),
  );
}

/* ---- fusión de catálogos del usuario (solo para la ruta de IMPORTACIÓN) ----
   Al importar NO se puede reemplazar lo que el usuario tenga hoy: un respaldo
   viejo borraría cuentas y categorías propias creadas después, y los
   movimientos que las usan quedarían huérfanos ("Otros") para siempre.
   Ojo: el CRUD de Ajustes SÍ necesita la semántica de reemplazo de
   crearConfig/saveConfig (al borrar una cuenta pasa el arreglo completo);
   por eso la fusión vive aquí y no allá. */

/** Clave de comparación de cuentas: sin tildes, sin caso, sin espacios extra. */
function claveCuenta(nombre) {
  return String(nombre == null ? '' : nombre)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toLowerCase();
}

/** Unión de cuentas sin duplicados; las locales van primero. PURA. */
export function fusionarCuentas(locales, importadas) {
  const base = Array.isArray(locales) ? locales : [];
  const extra = Array.isArray(importadas) ? importadas : [];
  const vistas = new Set();
  const salida = [];
  for (const nombre of [...base, ...extra]) {
    if (typeof nombre !== 'string') continue;
    const limpio = nombre.trim();
    const clave = claveCuenta(limpio);
    if (clave === '' || vistas.has(clave)) continue;
    vistas.add(clave);
    salida.push(limpio);
  }
  return salida;
}

/** Unión de categorías propias por id; gana la definición local. PURA. */
export function fusionarCategorias(locales, importadas) {
  const base = Array.isArray(locales) ? locales : [];
  const extra = Array.isArray(importadas) ? importadas : [];
  const vistos = new Set();
  const salida = [];
  for (const cat of [...base, ...extra]) {
    if (!cat || typeof cat !== 'object') continue;
    const id = typeof cat.id === 'string' ? cat.id.trim() : '';
    if (id === '' || vistos.has(id)) continue;
    vistos.add(id);
    salida.push({ ...cat, id });
  }
  return salida;
}

/**
 * Config resultante de importar: parte de la LOCAL y le suma la del archivo.
 * Los catálogos y mapas del usuario se FUSIONAN (nunca se reemplazan) y los
 * campos solo-locales jamás cruzan. Los escalares (tema, umbrales, fechas) sí
 * se restauran desde el archivo: para eso se importa un respaldo. PURA.
 */
export function fusionarConfig(local, importada) {
  const base = local && typeof local === 'object' ? local : {};
  const entrante = sinCamposLocales(importada && typeof importada === 'object' ? importada : {});
  return {
    ...base,
    ...entrante,
    cuentas: fusionarCuentas(base.cuentas, entrante.cuentas),
    categoriasPersonalizadas: fusionarCategorias(base.categoriasPersonalizadas, entrante.categoriasPersonalizadas),
    // Mapas: se conserva lo local y el archivo agrega/actualiza sus llaves, así
    // un presupuesto de una categoría que solo existe local no se pierde.
    presupuestos: { ...(base.presupuestos || {}), ...(entrante.presupuestos || {}) },
    categoriasRenombradas: { ...(base.categoriasRenombradas || {}), ...(entrante.categoriasRenombradas || {}) },
    categoriasAprendidas: { ...(base.categoriasAprendidas || {}), ...(entrante.categoriasAprendidas || {}) },
  };
}

/**
 * Arma el objeto de respaldo. PURA.
 * Los adjuntos (fotos) se excluyen por defecto por peso; opts.incluirAdjuntos
 * queda como bandera para el futuro.
 * @param {object} datos {movimientos, recurrentes, creditos, ingresos, config, adjuntos?}
 * @param {{incluirAdjuntos?:boolean, now?:Date}} [opts]
 */
export function serializar(datos = {}, { incluirAdjuntos = false, now = new Date() } = {}) {
  const {
    movimientos = [],
    recurrentes = [],
    creditos = [],
    ingresos = [],
    config = null,
    adjuntos = [],
  } = datos;

  const payload = {
    movimientos,
    recurrentes,
    creditos,
    ingresos,
    config: config ? sinCamposLocales(config) : null,
  };
  if (incluirAdjuntos) payload.adjuntos = adjuntos;

  return {
    formato: FORMATO,
    version: VERSION_BACKUP,
    exportadoEn: (now instanceof Date ? now : new Date()).toISOString(),
    datos: payload,
  };
}

/**
 * Valida y desempaqueta un respaldo. PURA. Tolerante con el envoltorio
 * (acepta string JSON u objeto) pero estricta con el header.
 * @param {string|object} json
 * @returns {{ok:true, datos:object}|{ok:false, error:string}}
 */
export function deserializar(json) {
  let obj = json;
  if (typeof json === 'string') {
    try {
      obj = JSON.parse(json);
    } catch (e) {
      return { ok: false, error: 'JSON inválido: ' + e.message };
    }
  }
  if (!obj || typeof obj !== 'object') return { ok: false, error: 'Respaldo vacío o no es un objeto.' };
  if (obj.formato !== FORMATO) return { ok: false, error: `Formato desconocido: "${obj.formato}". Se esperaba "${FORMATO}".` };
  if (obj.version !== VERSION_BACKUP) return { ok: false, error: `Versión de respaldo no soportada: ${obj.version}.` };
  if (!obj.datos || typeof obj.datos !== 'object') return { ok: false, error: 'El respaldo no contiene datos.' };
  return { ok: true, datos: obj.datos };
}

/* ---- entrega al usuario (Web Share en iOS PWA, descarga en desktop) ---- */
async function entregar(json, nombre) {
  if (typeof document === 'undefined') return { via: 'ninguno' }; // fuera del navegador
  const blob = new Blob([json], { type: 'application/json' });

  // 1) Web Share con archivos (funciona en iOS PWA).
  if (typeof navigator !== 'undefined' && navigator.canShare) {
    const file = new File([blob], nombre, { type: 'application/json' });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: nombre });
        return { via: 'share' };
      } catch (e) {
        if (e && e.name === 'AbortError') return { via: 'cancelado' };
        // cualquier otro error: caemos a descarga
      }
    }
  }

  // 2) Descarga clásica (desktop y para pruebas en el navegador).
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { via: 'descarga' };
}

/**
 * Lee todos los stores vía `db`, arma el JSON y lo entrega al usuario.
 * Actualiza config.fechaUltimoBackup. Devuelve {json, nombre, backup, entrega}.
 * @param {object} db módulo db.js (getAll, getConfig, saveConfig)
 */
export async function exportar(db, { now = new Date(), incluirAdjuntos = false } = {}) {
  const [movimientos, recurrentes, creditos, ingresos] = await Promise.all([
    db.getAll('movimientos'),
    db.getAll('recurrentes'),
    db.getAll('creditos'),
    db.getAll('ingresos'),
  ]);
  const config = await db.getConfig();

  // La fecha de ESTE respaldo se sella DENTRO del archivo: si se sellara solo
  // en la config local, el JSON saldría con la fecha vieja y restaurarlo haría
  // que la app volviera a decir "nunca has respaldado".
  const momento = now instanceof Date ? now : new Date(now);
  const exportadoEn = momento.toISOString();

  const backup = serializar(
    {
      movimientos,
      recurrentes,
      creditos,
      ingresos,
      config: { ...config, fechaUltimoBackup: exportadoEn },
    },
    { incluirAdjuntos, now: momento },
  );
  const json = JSON.stringify(backup, null, 2);
  const nombre = `bolsillo-backup-${backup.exportadoEn.slice(0, 10)}.json`;

  const entrega = await entregar(json, nombre);
  await db.saveConfig({ fechaUltimoBackup: backup.exportadoEn });

  return { json, nombre, backup, entrega };
}

/**
 * Deserializa e inserta en cada store (merge por id vía bulkPut; no borra
 * lo existente salvo colisión de id). Devuelve resumen de importados.
 *
 * La config NO se pasa tal cual a saveConfig: se fusiona explícitamente con la
 * local (ver fusionarConfig) para que un respaldo viejo no borre cuentas ni
 * categorías propias creadas después, y para que la apiKey del archivo —venga
 * de donde venga— nunca pueda sustituir la del dispositivo.
 *
 * @param {object} db módulo db.js (bulkPut, getConfig, saveConfig)
 * @param {string|object} json
 */
export async function importar(db, json) {
  const res = deserializar(json);
  if (!res.ok) throw new Error('No se pudo importar el respaldo: ' + res.error);

  const d = res.datos;
  const stores = ['movimientos', 'recurrentes', 'creditos', 'ingresos'];
  const importados = {};

  for (const store of stores) {
    const arr = Array.isArray(d[store]) ? d[store] : [];
    if (arr.length) await db.bulkPut(store, arr);
    importados[store] = arr.length;
  }

  if (d.config && typeof d.config === 'object') {
    const local = await db.getConfig();
    await db.saveConfig(fusionarConfig(local, d.config));
    importados.config = 1;
  } else {
    importados.config = 0;
  }

  return { importados };
}
