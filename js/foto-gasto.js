/* ============================================================
   Bolsillo · foto-gasto.js
   Lee un recibo/factura desde una imagen con Claude (visión) y
   devuelve {monto, comercio, categoriaId} para prellenar Registrar.

   SEGURIDAD (igual que anthropic.js):
   - La clave viaja SOLO en el header `x-api-key`. Nunca en URL, query,
     cuerpo serializado ni logs.
   - Los mensajes de error son literales fijos: NO interpolan la clave.
   - `construirPeticion`, `extraerTexto` y `parsearRespuesta` son PURAS
     (testeables en Node). `analizarRecibo` recibe `fetchImpl` por inyección.
   ============================================================ */

export const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
export const ANTHROPIC_VERSION = '2023-06-01';
export const MODELO_FOTO_DEFAULT = 'claude-sonnet-5';

/**
 * Construye el cuerpo de /v1/messages para leer un recibo. PURA.
 * @param {{base64:string, mediaType:string, modelo?:string, categorias:Array<{id:string,label:string}>}} p
 */
export function construirPeticion({ base64, mediaType, modelo, categorias }) {
  const lista = (categorias || []).map((c) => `${c.id} (${c.label})`).join(', ');
  const prompt =
    'Eres un lector de recibos y facturas de Colombia. Mira la imagen y responde ' +
    'SOLO con un objeto JSON válido, sin markdown ni texto extra, con esta forma exacta:\n' +
    '{"monto": <entero en pesos COP sin puntos ni símbolos, el TOTAL pagado>, ' +
    '"comercio": "<nombre corto del comercio, máx 40 caracteres, o cadena vacía>", ' +
    '"categoria": "<uno de los id de la lista>"}\n' +
    `Categorías válidas (devuelve el id, no la etiqueta): ${lista}.\n` +
    'Reglas: "monto" es el TOTAL a pagar, entero (ej. 84000); si no hay un total claro, ' +
    'usa null. "categoria" debe ser exactamente uno de los id; si dudas, usa "otros". ' +
    'No inventes datos que no estén en la imagen.';
  return {
    model: modelo || MODELO_FOTO_DEFAULT,
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        { type: 'text', text: prompt },
      ],
    }],
  };
}

/** Junta los bloques de texto de una respuesta de /v1/messages. PURA. */
export function extraerTexto(cuerpo) {
  const content = cuerpo && Array.isArray(cuerpo.content) ? cuerpo.content : [];
  return content
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

/**
 * Interpreta el JSON del modelo → {monto, comercio, categoriaId}. PURA y
 * tolerante: cualquier forma inesperada devuelve vacíos, nunca lanza.
 * @param {string} texto  salida del modelo (puede venir envuelta en prosa)
 * @param {Set<string>|Array<string>} idsValidos  ids de categoría aceptados
 * @returns {{monto:(number|null), comercio:string, categoriaId:string}}
 */
export function parsearRespuesta(texto, idsValidos) {
  const validos = idsValidos instanceof Set ? idsValidos : new Set(idsValidos || []);
  let obj = null;
  try {
    const m = String(texto == null ? '' : texto).match(/\{[\s\S]*\}/);
    obj = m ? JSON.parse(m[0]) : null;
  } catch { obj = null; }
  if (!obj || typeof obj !== 'object') return { monto: null, comercio: '', categoriaId: '' };

  let monto = obj.monto;
  if (typeof monto === 'string') monto = parseInt(monto.replace(/[^\d]/g, ''), 10);
  if (!Number.isInteger(monto) || monto <= 0) monto = null;

  const comercio = typeof obj.comercio === 'string' ? obj.comercio.trim().slice(0, 60) : '';

  let categoriaId = typeof obj.categoria === 'string' ? obj.categoria.trim().toLowerCase() : '';
  if (!validos.has(categoriaId)) categoriaId = '';

  return { monto, comercio, categoriaId };
}

/**
 * Llama a Claude para leer el recibo. IMPURA (red). `fetchImpl` inyectable.
 * @returns {Promise<{estado:'ok'|'sin-clave'|'invalida'|'red'|'error', mensaje?:string, monto?:(number|null), comercio?:string, categoriaId?:string}>}
 */
export async function analizarRecibo(
  { base64, mediaType, apiKey, modelo, categorias },
  { fetchImpl } = {},
) {
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (key === '') {
    return { estado: 'sin-clave', mensaje: 'Configura tu clave de Anthropic en Ajustes → Conexión con IA.' };
  }
  const doFetch = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!doFetch) return { estado: 'error', mensaje: 'Este entorno no puede hacer peticiones de red.' };

  const body = construirPeticion({ base64, mediaType, modelo, categorias: categorias || [] });

  let res;
  try {
    res = await doFetch(ANTHROPIC_MESSAGES_URL, {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch {
    // Sin detalles del error: podrían arrastrar la petición (y la clave) a un log.
    return { estado: 'red', mensaje: 'No se pudo leer la foto: revisa tu conexión e intenta de nuevo.' };
  }

  if (res.status === 401 || res.status === 403) {
    return { estado: 'invalida', mensaje: 'Clave inválida. Revísala en Ajustes.' };
  }
  if (!res.ok) {
    return { estado: 'error', mensaje: `No se pudo leer la foto (HTTP ${res.status}).` };
  }

  let cuerpo;
  try { cuerpo = await res.json(); } catch { return { estado: 'error', mensaje: 'La respuesta no se pudo leer.' }; }

  const idsValidos = new Set((categorias || []).map((c) => c.id));
  const datos = parsearRespuesta(extraerTexto(cuerpo), idsValidos);
  return { estado: 'ok', ...datos };
}
