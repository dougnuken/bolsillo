/* ============================================================
   Bolsillo · backup.js
   Export / import del respaldo local. serializar/deserializar son
   PURAS (testeables en Node). exportar/importar reciben el módulo
   `db` por inyección: este archivo NO importa db.js.
   REGLA DURA: config.apiKey NUNCA sale del dispositivo.
   ============================================================ */

export const FORMATO = 'bolsillo-backup';
export const VERSION_BACKUP = 1;

/** Quita apiKey por completo (ni la clave ni el valor deben salir). */
function sinApiKey(config) {
  if (!config || typeof config !== 'object') return config;
  const { apiKey, ...resto } = config; // apiKey descartada intencionalmente
  return resto;
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
    config: config ? sinApiKey(config) : null,
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

  const backup = serializar(
    { movimientos, recurrentes, creditos, ingresos, config },
    { incluirAdjuntos, now },
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
 * @param {object} db módulo db.js (bulkPut, saveConfig)
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
    await db.saveConfig(d.config); // apiKey local se preserva (el backup no la trae)
    importados.config = 1;
  } else {
    importados.config = 0;
  }

  return { importados };
}
