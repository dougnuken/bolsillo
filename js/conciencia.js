/* ============================================================
   Bolsillo · conciencia.js
   El "agente de conciencia financiera": arma la realidad económica
   del usuario en un contexto compacto y le habla a Claude con voz
   CRUDA (tough-love, sin cortesía de relleno). Cerebro compartido por
   las dos superficies:
     · susurro por movimiento  (comenta cada gasto al registrarlo)
     · chat a demanda           (le preguntas, le adjuntas documentos)

   POR QUÉ ESTE ARCHIVO ES TAN CUIDADOSO CON LA RESPUESTA:
   /v1/messages puede devolver 200 con el `content` SIN ningún bloque
   `text` — pasa cuando el modelo razona antes de responder y el techo de
   `max_tokens` se agota pensando (`stop_reason: "max_tokens"`, bloques
   `thinking`). Antes eso se traducía a un seco "La respuesta llegó vacía"
   sin forma de saber qué pasó. Ahora:
     1) los techos son GENEROSOS (nadie se queda sin espacio para escribir),
     2) si aun así llega sin texto se REINTENTA una vez con más margen y el
        razonamiento apagado,
     3) si falla de verdad, el mensaje dice el motivo REAL (el del API).

   SEGURIDAD (igual que foto-gasto.js / anthropic.js):
   - La clave viaja SOLO en el header `x-api-key`. Nunca en URL ni cuerpo.
   - Los mensajes que salen a pantalla pasan por `ocultarClave`: aunque el
     API devolviera la clave en su texto, nunca llegaría a la UI.
   - construirContexto / construirPeticion / extraerTexto / diagnosticar /
     mensajeApiError son PURAS (testeables en Node). aconsejar() recibe
     `fetchImpl` y `esperar` por inyección.
   ============================================================ */

export const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
export const ANTHROPIC_VERSION = '2023-06-01';

/* Modelo por defecto del agente. Es el MISMO que ya lee extractos en
   cfg-creditos (camino probado en esta app), así que si la clave sirve para
   eso, sirve para el chat. Se puede cambiar en Perfil → Clave de Anthropic
   → Modelos (config.modelos.conciencia). */
export const MODELO_CONCIENCIA_DEFAULT = 'claude-sonnet-4-5';

/* Techos de salida. Van holgados A PROPÓSITO: un techo corto es la causa #1
   de respuestas vacías (el modelo gasta el presupuesto razonando y no le
   queda espacio para escribir). Un chat cuesta centavos; una respuesta vacía
   cuesta la confianza en la app. */
export const MAX_TOKENS = Object.freeze({
  susurro: 400,
  chat: 1600,
  documento: 2400,
  reintento: 4000,
});

/* Cuántas páginas de un PDF se le mandan al agente en el chat. */
export const MAX_PAGINAS_CHAT = 6;

/* La persona. Cruda pero con propósito: que reaccione, no humillarlo. */
export const SISTEMA =
  'Eres la conciencia financiera de {NOMBRE}, un colombiano. Le hablas de tú, ' +
  'directo y sin rodeos, con la verdad CRUDA de sus números: nada de cortesía ' +
  'de relleno ni "¡vas bien!" de cajón. Señalas lo que duele —la deuda que lo ' +
  'ahoga, el gasto que no cabía— para que REACCIONE, no para humillarlo. Usa ' +
  'SIEMPRE sus cifras reales del contexto, en pesos colombianos. Sé breve y ' +
  'punzante. Español coloquial colombiano, sin groserías. No inventes datos: ' +
  'cíñete a lo que esté en el contexto y en lo que él te adjunte.';

const fmt = (n) => {
  const x = Math.round(Number(n) || 0);
  return '$' + x.toLocaleString('es-CO');
};
const linea = (etq, val) => `- ${etq}: ${val}`;

/** Quita la clave de cualquier texto que vaya a pantalla. PURA. */
function ocultarClave(texto, clave) {
  if (typeof texto !== 'string') return '';
  if (typeof clave !== 'string' || clave.length < 8) return texto;
  return texto.split(clave).join('…');
}

/**
 * Arma el brief factual con la realidad económica del usuario. PURO.
 * Recibe hechos YA derivados (de calcularEstado, historialAhorro, créditos…)
 * para no acoplarse al motor ni a la DB.
 * @param {object} f
 * @returns {string} contexto en texto plano
 */
export function construirContexto(f = {}) {
  const d = f && typeof f === 'object' ? f : {};
  const L = [];
  L.push('DATOS ECONÓMICOS (pesos COP, mes actual):');
  if (Number.isFinite(d.salario)) L.push(linea('Sueldo base mensual', fmt(d.salario)));
  if (Number.isFinite(d.plataDelMes)) L.push(linea('Entró este mes (sueldo + ingresos)', fmt(d.plataDelMes)));
  if (Number.isFinite(d.saldoDisponible)) L.push(linea('Tu dinero disponible ahora', fmt(d.saldoDisponible)));
  if (Number.isFinite(d.gastadoTotal)) L.push(linea('Gastado este mes', fmt(d.gastadoTotal)));
  if (Number.isFinite(d.fijosDelMes)) L.push(linea('De eso, fijos', fmt(d.fijosDelMes)));
  if (Number.isFinite(d.cuotasCredito) && d.cuotasCredito > 0) L.push(linea('Cuotas de crédito al mes (aparte)', fmt(d.cuotasCredito)));
  if (Number.isFinite(d.netoMes)) L.push(linea('Flujo REAL del mes (entró − gastos − cuotas)', fmt(d.netoMes)));
  if (typeof d.etiquetaSemaforo === 'string' && d.etiquetaSemaforo) L.push(linea('Semáforo del gasto', d.etiquetaSemaforo));

  const cats = Array.isArray(d.topCategorias) ? d.topCategorias.filter(Boolean).slice(0, 5) : [];
  if (cats.length) {
    L.push('En qué se va (top):');
    for (const c of cats) L.push(`  · ${c.label || c.categoriaId}: ${fmt(c.total)}`);
  }

  const creds = Array.isArray(d.creditos) ? d.creditos.filter(Boolean) : [];
  if (creds.length) {
    L.push('Créditos (deuda):');
    for (const c of creds) {
      const partes = [c.entidad || c.producto || 'Crédito'];
      if (Number.isFinite(c.cuotaMensual)) partes.push(`cuota ${fmt(c.cuotaMensual)}/mes`);
      if (Number.isFinite(c.saldo)) partes.push(`saldo ${fmt(c.saldo)}`);
      if (Number.isFinite(c.tasaEA)) partes.push(`tasa ${c.tasaEA}% EA`);
      L.push(`  · ${partes.join(' · ')}`);
    }
  }

  // Deuda diferida leída de los extractos (compras a cuotas, avances…): el brief
  // ya viene armado (cascada + cambios mes-a-mes) desde diferidos.js. Es lo que
  // permite responder "¿cómo va esa deuda?" sin re-adjuntar el PDF.
  if (typeof d.deudaDiferidos === 'string' && d.deudaDiferidos.trim()) {
    L.push('');
    L.push(d.deudaDiferidos.trim());
  }
  return L.join('\n');
}

/** Ficha de un crédito tal como está GUARDADO en Bolsillo. PURA. */
export function describirCredito(c = {}) {
  const nombre = [c.entidad, c.producto || c.tipo].filter((s) => typeof s === 'string' && s.trim()).join(' · ') || 'Crédito';
  const partes = [nombre];
  partes.push(Number.isFinite(c.cuotaMensual) ? `cuota registrada ${fmt(c.cuotaMensual)}/mes` : 'cuota SIN registrar');
  partes.push(Number.isFinite(c.saldo) ? `saldo registrado ${fmt(c.saldo)}` : 'saldo SIN registrar en Bolsillo');
  partes.push(Number.isFinite(c.tasaEA) ? `tasa ${c.tasaEA}% EA` : 'tasa SIN registrar en Bolsillo');
  partes.push(Number.isInteger(c.diaPago) ? `paga el día ${c.diaPago}` : 'día de pago SIN registrar en Bolsillo');
  return partes.join(' · ');
}

/* Instrucciones extra que solo aplican cuando hay un documento en juego.
   Sin esto la persona ("usa SIEMPRE tus cifras del contexto", "no inventes")
   empuja al modelo a IGNORAR el adjunto y responder solo con el brief. */
function bloqueDocumento(nPaginas, credito, sinCredito) {
  const L = [];
  L.push(`DOCUMENTO ADJUNTO (${nPaginas} ${nPaginas === 1 ? 'página' : 'páginas'}):`);
  L.push(
    'Te llegaron las páginas de un documento del usuario como IMÁGENES (normalmente ' +
    'un extracto o estado de cuenta). LÉELAS de verdad antes de responder: fechas de ' +
    'corte y de pago, saldo/deuda total, cuota, pago mínimo, tasa y movimientos. Las ' +
    'cifras del documento SÍ son datos válidos, úsalas junto con el contexto de arriba.',
  );
  L.push(
    'Empieza diciendo en una línea QUÉ es el documento y de qué entidad, para que el ' +
    'usuario sepa que lo leíste. Si una página no se alcanza a leer, dilo claro en vez ' +
    'de suponer.',
  );
  if (credito) {
    L.push(`ESTE DOCUMENTO ES DEL CRÉDITO: ${describirCredito(credito)}.`);
    L.push(
      'Compara lo que dice el extracto contra lo que Bolsillo tiene guardado de ese ' +
      'crédito y CANTA las diferencias (saldo distinto, tasa distinta, día distinto). ' +
      'Si el extracto trae un dato que en Bolsillo está SIN registrar, dilo explícito y ' +
      'dile que lo registre.',
    );
  } else if (sinCredito) {
    L.push(
      'El usuario confirmó que este documento NO corresponde a ninguno de sus créditos ' +
      'registrados. No lo cuelgues de ninguna deuda existente.',
    );
  } else {
    L.push(
      'No sabes si este documento corresponde a alguno de sus créditos registrados. Si ' +
      'parece un extracto de crédito, PREGÚNTALE al final de cuál de sus créditos es ' +
      '(nómbralos) para poder cuadrar sus números.',
    );
  }
  return L.join('\n');
}

const TEXTO_DOC_DEFAULT =
  'Te adjunto un documento (extracto). Léelo y dime cruda mi realidad a la luz de esto y de mis números.';

/** Bloques `image` del API a partir de páginas ya rendidas. PURA. */
function bloquesImagen(imagenes) {
  return (Array.isArray(imagenes) ? imagenes : [])
    .filter((im) => im && im.base64)
    .map((im) => ({
      type: 'image',
      source: { type: 'base64', media_type: im.mediaType || 'image/jpeg', data: im.base64 },
    }));
}

/**
 * Cuerpo de /v1/messages. PURO.
 * @param {object} p
 * @param {string} p.contexto        brief de construirContexto
 * @param {string} [p.nombre]        para personalizar la persona
 * @param {'susurro'|'chat'} [p.modo]
 * @param {object} [p.movimiento]    (modo susurro) el gasto recién registrado
 * @param {string} [p.pregunta]      (modo chat) lo que preguntó el usuario
 * @param {Array<{rol:'user'|'assistant', texto:string, imagenes?:Array}>} [p.historialChat]
 * @param {Array<{base64:string, mediaType?:string}>} [p.imagenes]  páginas del adjunto de ESTE turno
 * @param {object} [p.creditoVinculado]  crédito al que el usuario asoció el documento
 * @param {boolean} [p.sinCredito]       el usuario dijo que NO es de ningún crédito
 * @param {string} [p.modelo]
 * @param {number} [p.maxTokens]         override del techo (reintento)
 * @param {boolean} [p.sinPensar]        apaga el razonamiento extendido (reintento)
 */
export function construirPeticion({
  contexto, nombre, modo = 'chat', movimiento, pregunta, historialChat, imagenes,
  creditoVinculado, sinCredito, modelo, maxTokens, sinPensar,
} = {}) {
  const messages = [];
  const imgs = bloquesImagen(imagenes);

  /* Historial: se conserva el TEXTO de todos los turnos, pero solo se re-envían
     las páginas del documento MÁS RECIENTE (y solo si este turno no trae uno
     propio). Así el adjunto sigue "a la vista" en las repreguntas —antes se
     perdía y el agente respondía a ciegas— sin duplicar imágenes cada turno. */
  const hist = (Array.isArray(historialChat) ? historialChat : [])
    .filter((t) => t && (t.texto || (Array.isArray(t.imagenes) && t.imagenes.length)));
  let idxDoc = -1;
  if (!imgs.length) {
    for (let i = 0; i < hist.length; i++) {
      const t = hist[i];
      if (t.rol !== 'assistant' && Array.isArray(t.imagenes) && t.imagenes.length) idxDoc = i;
    }
  }

  if (modo === 'susurro') {
    const m = movimiento || {};
    const desc = [m.comercio, m.categoriaLabel || m.categoria].filter(Boolean).join(' · ');
    messages.push({
      role: 'user',
      content:
        `Acabo de registrar este gasto: ${fmt(m.monto)}${desc ? ' en ' + desc : ''}. ` +
        'Suéltame UNA sola frase cruda de conciencia sobre este gasto a la luz de mis números. ' +
        'Máximo 20 palabras. Sin saludos.',
    });
  } else {
    for (let i = 0; i < hist.length; i++) {
      const t = hist[i];
      const role = t.rol === 'assistant' ? 'assistant' : 'user';
      const texto = String(t.texto || '').trim();
      if (i === idxDoc) {
        messages.push({
          role,
          content: [...bloquesImagen(t.imagenes), { type: 'text', text: texto || TEXTO_DOC_DEFAULT }],
        });
      } else {
        // El API rechaza contenido vacío: siempre va algo.
        messages.push({ role, content: texto || '(sin texto)' });
      }
    }
    const txt = String(pregunta || '').trim();
    if (imgs.length) {
      messages.push({ role: 'user', content: [...imgs, { type: 'text', text: txt || TEXTO_DOC_DEFAULT }] });
    } else {
      messages.push({ role: 'user', content: txt || '¿Cómo voy con mi plata?' });
    }
  }

  /* Páginas del documento realmente presentes en esta petición (de este turno
     o rescatadas del historial): manda el techo y las instrucciones de lectura. */
  const nPaginas = imgs.length || (idxDoc >= 0 ? bloquesImagen(hist[idxDoc].imagenes).length : 0);
  const credito = creditoVinculado || (idxDoc >= 0 ? hist[idxDoc].credito : null) || null;
  const marcadoSinCredito = sinCredito === true || (idxDoc >= 0 && hist[idxDoc].sinCredito === true);

  const partesSistema = [SISTEMA.replace('{NOMBRE}', (nombre || '').trim() || 'esta persona')];
  if (contexto) partesSistema.push(contexto);
  if (nPaginas > 0) partesSistema.push(bloqueDocumento(nPaginas, credito, marcadoSinCredito));

  const techo = Number.isInteger(maxTokens) && maxTokens > 0
    ? maxTokens
    : (modo === 'susurro' ? MAX_TOKENS.susurro : (nPaginas > 0 ? MAX_TOKENS.documento : MAX_TOKENS.chat));

  const body = {
    model: (typeof modelo === 'string' && modelo.trim()) || MODELO_CONCIENCIA_DEFAULT,
    max_tokens: techo,
    system: partesSistema.join('\n\n'),
    messages,
  };
  // Solo en el reintento: si el modelo se gastó el techo razonando, se le apaga.
  if (sinPensar) body.thinking = { type: 'disabled' };
  return body;
}

/** Junta los bloques de texto de la respuesta. PURA. */
export function extraerTexto(cuerpo) {
  const content = cuerpo && Array.isArray(cuerpo.content) ? cuerpo.content : [];
  return content
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

/**
 * Radiografía de una respuesta 200: qué trajo y por qué paró. PURA.
 * Es lo que convierte "llegó vacía" en un motivo accionable.
 * @returns {{texto:string, stopReason:string, pensando:boolean, tipos:string[]}}
 */
export function diagnosticar(cuerpo) {
  const content = cuerpo && Array.isArray(cuerpo.content) ? cuerpo.content : [];
  const tipos = content.filter(Boolean).map((b) => String(b.type || ''));
  return Object.freeze({
    texto: extraerTexto(cuerpo),
    stopReason: cuerpo && typeof cuerpo.stop_reason === 'string' ? cuerpo.stop_reason : '',
    pensando: tipos.includes('thinking') || tipos.includes('redacted_thinking'),
    tipos: Object.freeze(tipos),
  });
}

/** Por qué una respuesta 200 no trajo texto, en cristiano. PURA. */
export function motivoVacio(d = {}) {
  if (d.stopReason === 'max_tokens' || d.pensando) {
    return 'El modelo se quedó sin espacio: gastó todo el presupuesto razonando y no alcanzó a escribir. '
      + 'Prueba con otro modelo en Perfil → Clave de Anthropic → Modelos.';
  }
  if (d.stopReason === 'refusal') return 'El modelo se negó a responder eso. Reformula la pregunta.';
  if (d.stopReason === 'pause_turn') return 'La respuesta quedó a medias. Vuelve a intentar.';
  return 'La respuesta llegó sin texto. Vuelve a intentar; si sigue igual, cambia de modelo en Perfil.';
}

/** Mensaje de error del API (nunca contiene la clave: viaja en el header). PURA. */
export function mensajeApiError(cuerpo, status) {
  const e = cuerpo && typeof cuerpo === 'object' && cuerpo.error && typeof cuerpo.error === 'object' ? cuerpo.error : null;
  const m = e && typeof e.message === 'string' ? e.message.trim() : '';
  if (m) return m;
  return `No se pudo responder (HTTP ${status}).`;
}

/* Estados HTTP que valen un segundo intento tal cual (saturación / hipo). */
const REINTENTABLES = new Set([408, 429, 500, 502, 503, 504, 529]);

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Un intento contra /v1/messages. Devuelve el resultado público + cómo
 * reintentar si tiene sentido (`reintento`), o null si no lo tiene.
 */
async function intentar(base, extra, key, doFetch) {
  const body = construirPeticion({ ...base, ...extra });

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
    return { estado: 'red', mensaje: 'No se pudo conectar. Revisa tu internet e intenta de nuevo.', reintento: null };
  }

  if (res.status === 401 || res.status === 403) {
    return { estado: 'invalida', mensaje: 'Clave inválida. Revísala en Perfil → Clave de Anthropic.', reintento: null };
  }

  if (!res.ok) {
    let err = null;
    try { err = await res.json(); } catch { err = null; }
    if (res.status === 404) {
      return {
        estado: 'error',
        mensaje: `El modelo «${body.model}» no está disponible en tu cuenta. Elige otro en Perfil → Clave de Anthropic → Modelos.`,
        reintento: null,
      };
    }
    const detalle = ocultarClave(mensajeApiError(err, res.status), key);
    return {
      estado: 'error',
      mensaje: `No se pudo responder (HTTP ${res.status}): ${detalle}`,
      reintento: REINTENTABLES.has(res.status) ? { esperarMs: 1500 } : null,
    };
  }

  let cuerpo;
  try { cuerpo = await res.json(); } catch { return { estado: 'error', mensaje: 'La respuesta no se pudo leer.', reintento: null }; }

  const d = diagnosticar(cuerpo);
  if (d.texto) return { estado: 'ok', texto: ocultarClave(d.texto, key), reintento: null };

  // 200 sin texto: casi siempre el techo se fue en razonamiento → un intento
  // más con margen de sobra y el razonamiento apagado.
  return {
    estado: 'error',
    mensaje: motivoVacio(d),
    reintento: extra.sinPensar ? null : { maxTokens: MAX_TOKENS.reintento, sinPensar: true },
  };
}

/**
 * Llama a Claude con la voz de conciencia. IMPURA (red). `fetchImpl` y
 * `esperar` inyectables. Reintenta UNA vez cuando tiene sentido.
 * @returns {Promise<{estado:'ok'|'sin-clave'|'invalida'|'red'|'error', mensaje?:string, texto?:string}>}
 */
export async function aconsejar(
  {
    contexto, nombre, modo, movimiento, pregunta, historialChat, imagenes,
    creditoVinculado, sinCredito, apiKey, modelo,
  },
  { fetchImpl, esperar } = {},
) {
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (key === '') {
    return { estado: 'sin-clave', mensaje: 'Configura tu clave de Anthropic en Perfil → Clave de Anthropic.' };
  }
  const doFetch = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!doFetch) return { estado: 'error', mensaje: 'Este entorno no puede hacer peticiones de red.' };
  const dormirImpl = typeof esperar === 'function' ? esperar : dormir;

  const base = { contexto, nombre, modo, movimiento, pregunta, historialChat, imagenes, creditoVinculado, sinCredito, modelo };

  const primero = await intentar(base, {}, key, doFetch);
  if (primero.estado === 'ok') return { estado: 'ok', texto: primero.texto };
  if (!primero.reintento) return { estado: primero.estado, mensaje: primero.mensaje };

  const { esperarMs, ...opciones } = primero.reintento;
  if (esperarMs) await dormirImpl(esperarMs);
  const segundo = await intentar(base, opciones, key, doFetch);
  if (segundo.estado === 'ok') return { estado: 'ok', texto: segundo.texto };

  // El primer motivo suele ser el más informativo: es el que se conserva.
  return { estado: primero.estado, mensaje: primero.mensaje };
}
