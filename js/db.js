/* ============================================================
   Bolsillo · db.js
   Wrapper de IndexedDB SIN dependencias. API async basada en
   promesas. Sólo corre en el navegador (usa IndexedDB).
   Errores explícitos: nada se traga en silencio.
   ============================================================ */

import { configDefault, crearConfig, CONFIG_ID } from './model.js';

const DB_NAME = 'bolsillo';
const DB_VERSION = 1;

// Stores con keyPath "id". El de movimientos lleva índices de consulta.
const STORES_SIMPLES = ['recurrentes', 'creditos', 'ingresos', 'config', 'adjuntos'];
const INDICES_MOVIMIENTOS = ['fecha', 'categoria', 'cuenta', 'fuente', 'dedupKey'];

let dbPromise = null;

/** Abre (y cachea) la conexión a IndexedDB. */
export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no está disponible en este entorno.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('movimientos')) {
        const store = db.createObjectStore('movimientos', { keyPath: 'id' });
        for (const idx of INDICES_MOVIMIENTOS) store.createIndex(idx, idx, { unique: false });
      }
      for (const name of STORES_SIMPLES) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error('No se pudo abrir la base de datos: ' + errMsg(req.error)));
    req.onblocked = () => reject(new Error('Apertura de base de datos bloqueada por otra pestaña abierta.'));
  });
  return dbPromise;
}

/* ---- helpers de promesas ---- */
function errMsg(err) {
  return err && err.message ? err.message : 'error desconocido';
}
function promisifyRequest(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error('Operación IndexedDB falló: ' + errMsg(req.error)));
  });
}
function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error('Transacción falló: ' + errMsg(tx.error)));
    tx.onabort = () => reject(new Error('Transacción abortada: ' + errMsg(tx.error)));
  });
}

/* ---- CRUD ---- */
export async function put(store, obj) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  const key = await promisifyRequest(tx.objectStore(store).put(obj));
  await txDone(tx);
  return key;
}

export async function get(store, id) {
  const db = await openDB();
  const tx = db.transaction(store, 'readonly');
  const val = await promisifyRequest(tx.objectStore(store).get(id));
  await txDone(tx);
  return val;
}

export async function getAll(store) {
  const db = await openDB();
  const tx = db.transaction(store, 'readonly');
  const val = await promisifyRequest(tx.objectStore(store).getAll());
  await txDone(tx);
  return val;
}

export async function del(store, id) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  await promisifyRequest(tx.objectStore(store).delete(id));
  await txDone(tx);
}

export async function clear(store) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  await promisifyRequest(tx.objectStore(store).clear());
  await txDone(tx);
}

/** Inserta/actualiza un arreglo entero en UNA sola transacción. */
export async function bulkPut(store, arr) {
  if (!Array.isArray(arr)) throw new Error('bulkPut requiere un arreglo.');
  if (arr.length === 0) return 0;
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  const os = tx.objectStore(store);
  for (const item of arr) os.put(item);
  await txDone(tx);
  return arr.length;
}

/**
 * Consulta por índice (o por keyPath si indexName es null) usando un rango.
 * @param {string} store
 * @param {string|null} indexName
 * @param {IDBKeyRange|null} rango
 */
export async function query(store, indexName, rango = null) {
  const db = await openDB();
  const tx = db.transaction(store, 'readonly');
  const src = indexName ? tx.objectStore(store).index(indexName) : tx.objectStore(store);
  const val = await promisifyRequest(src.getAll(rango || undefined));
  await txDone(tx);
  return val;
}

/* ---- adjuntos (bytes como ArrayBuffer, no Blob: frágil en iOS Safari) ---- */
export async function putAdjunto(mime, arrayBuffer) {
  if (typeof mime !== 'string' || mime === '') throw new Error('El adjunto necesita un mime válido.');
  if (!(arrayBuffer instanceof ArrayBuffer)) throw new Error('El adjunto debe ser un ArrayBuffer.');
  const id = crypto.randomUUID();
  await put('adjuntos', { id, mime, bytes: arrayBuffer });
  return id;
}

export async function getAdjunto(id) {
  return get('adjuntos', id);
}

/* ---- config singleton ---- */
export async function getConfig() {
  const existente = await get('config', CONFIG_ID);
  return existente || configDefault();
}

/** Merge inmutable sobre la config actual y persiste. */
export async function saveConfig(partial = {}) {
  const actual = await getConfig();
  const merged = crearConfig({ ...actual, ...partial });
  await put('config', merged);
  return merged;
}

/* ---- utilidades ---- */
/** Borra todos los datos (para reset o importación limpia). */
export async function borrarTodo() {
  await Promise.all(['movimientos', ...STORES_SIMPLES].map((s) => clear(s)));
}
