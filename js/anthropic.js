/* ============================================================
   Bolsillo · anthropic.js
   Verificación de la clave de Anthropic contra /v1/models.

   REGLAS DURAS DE SEGURIDAD:
   - La clave viaja SOLO en el header `x-api-key`. Nunca en la URL,
     nunca en query params, nunca en un cuerpo serializado.
   - NUNCA se escribe en consola (ni en errores: los mensajes que
     devolvemos son literales fijos, no interpolan la clave).
   - Vive solo en este dispositivo (config.apiKey) y backup.js la
     excluye del respaldo.

   `enmascararClave` y `extraerModelos` son PURAS (testeables en Node).
   `verificarClave` recibe `fetchImpl` por inyección para poder probarla.
   ============================================================ */

export const ANTHROPIC_MODELS_URL = 'https://api.anthropic.com/v1/models';
export const ANTHROPIC_VERSION = '2023-06-01';

/**
 * Enmascara una clave para mostrarla en pantalla: prefijo + últimos 4.
 * PURA. Nunca devuelve la clave completa.
 * @param {string} clave
 * @returns {string} p.ej. "sk-ant-…a1b2"
 */
export function enmascararClave(clave) {
  if (typeof clave !== 'string') return '';
  const s = clave.trim();
  if (s === '') return '';
  const ultimos = s.slice(-4);
  if (s.length <= 8) return '…' + ultimos;
  return s.slice(0, 7) + '…' + ultimos;
}

/**
 * Extrae la lista de modelos del cuerpo de /v1/models. PURA y tolerante:
 * cualquier forma inesperada devuelve [].
 * @param {object} cuerpo
 * @returns {Array<{id:string, nombre:string}>}
 */
export function extraerModelos(cuerpo) {
  const data = cuerpo && Array.isArray(cuerpo.data) ? cuerpo.data : [];
  return data
    .filter((m) => m && typeof m.id === 'string' && m.id.trim() !== '')
    .map((m) => Object.freeze({
      id: m.id,
      nombre: typeof m.display_name === 'string' && m.display_name.trim() !== '' ? m.display_name : m.id,
    }));
}

/**
 * Verifica la clave contra la API. NO persiste nada: solo informa.
 * Distingue explícitamente clave inválida (401/403) de fallo de red.
 *
 * @param {string} clave
 * @param {{fetchImpl?: typeof fetch}} [opts]
 * @returns {Promise<{estado:'ok'|'invalida'|'red'|'error'|'vacia', mensaje:string, modelos?:Array}>}
 */
export async function verificarClave(clave, { fetchImpl } = {}) {
  const s = typeof clave === 'string' ? clave.trim() : '';
  if (s === '') return { estado: 'vacia', mensaje: 'Pega tu clave de Anthropic.' };

  const doFetch = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!doFetch) return { estado: 'error', mensaje: 'Este entorno no puede hacer peticiones de red.' };

  let res;
  try {
    res = await doFetch(ANTHROPIC_MODELS_URL, {
      method: 'GET',
      headers: {
        'x-api-key': s,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
    });
  } catch {
    // Sin detalles del error: podrían arrastrar la petición (y la clave) a un log.
    return { estado: 'red', mensaje: 'No se pudo verificar: revisa tu conexión e intenta de nuevo.' };
  }

  if (res.status === 401 || res.status === 403) {
    return { estado: 'invalida', mensaje: 'Clave inválida. Revísala y vuelve a intentar.' };
  }
  if (!res.ok) {
    return { estado: 'error', mensaje: `No se pudo verificar (HTTP ${res.status}).` };
  }

  let cuerpo;
  try {
    cuerpo = await res.json();
  } catch {
    return { estado: 'error', mensaje: 'No se pudo verificar: la respuesta no se pudo leer.' };
  }

  return { estado: 'ok', mensaje: 'Clave verificada.', modelos: extraerModelos(cuerpo) };
}
