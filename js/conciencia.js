/* ============================================================
   Bolsillo · conciencia.js
   El "agente de conciencia financiera": arma la realidad económica
   del usuario en un contexto compacto y le habla a Claude con voz
   CRUDA (tough-love, sin cortesía de relleno). Cerebro compartido por
   las dos superficies:
     · susurro por movimiento  (comenta cada gasto al registrarlo)
     · chat a demanda           (le preguntas y responde con tus datos)

   SEGURIDAD (igual que foto-gasto.js / anthropic.js):
   - La clave viaja SOLO en el header `x-api-key`. Nunca en URL ni cuerpo.
   - Mensajes de error literales fijos: NO interpolan la clave.
   - construirContexto / construirPeticion / extraerTexto son PURAS
     (testeables en Node). aconsejar() recibe `fetchImpl` por inyección.
   ============================================================ */

export const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
export const ANTHROPIC_VERSION = '2023-06-01';
export const MODELO_CONCIENCIA_DEFAULT = 'claude-sonnet-5';

/* La persona. Cruda pero con propósito: que reaccione, no humillarlo. */
export const SISTEMA =
  'Eres la conciencia financiera de {NOMBRE}, un colombiano. Le hablas de tú, ' +
  'directo y sin rodeos, con la verdad CRUDA de sus números: nada de cortesía ' +
  'de relleno ni "¡vas bien!" de cajón. Señalas lo que duele —la deuda que lo ' +
  'ahoga, el gasto que no cabía— para que REACCIONE, no para humillarlo. Usa ' +
  'SIEMPRE sus cifras reales del contexto, en pesos colombianos. Sé breve y ' +
  'punzante. Español coloquial colombiano, sin groserías. No inventes datos que ' +
  'no estén en el contexto.';

const fmt = (n) => {
  const x = Math.round(Number(n) || 0);
  return '$' + x.toLocaleString('es-CO');
};
const linea = (etq, val) => `- ${etq}: ${val}`;

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
  return L.join('\n');
}

/**
 * Cuerpo de /v1/messages. PURO.
 * @param {object} p
 * @param {string} p.contexto        brief de construirContexto
 * @param {string} [p.nombre]        para personalizar la persona
 * @param {'susurro'|'chat'} [p.modo]
 * @param {object} [p.movimiento]    (modo susurro) el gasto recién registrado
 * @param {string} [p.pregunta]      (modo chat) lo que preguntó el usuario
 * @param {Array<{rol:'user'|'assistant',texto:string}>} [p.historialChat]
 * @param {Array<{base64:string, mediaType?:string}>} [p.imagenes]  (modo chat)
 *        páginas de un documento adjunto (ej. extracto en PDF ya rendido a imagen)
 */
export function construirPeticion({ contexto, nombre, modo = 'chat', movimiento, pregunta, historialChat, imagenes } = {}) {
  const system = SISTEMA.replace('{NOMBRE}', (nombre || '').trim() || 'esta persona') + '\n\n' + (contexto || '');
  const messages = [];
  const imgs = Array.isArray(imagenes) ? imagenes.filter((im) => im && im.base64) : [];

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
    for (const t of (Array.isArray(historialChat) ? historialChat : [])) {
      if (!t || !t.texto) continue;
      messages.push({ role: t.rol === 'assistant' ? 'assistant' : 'user', content: String(t.texto) });
    }
    const txt = String(pregunta || '').trim();
    if (imgs.length) {
      // Adjunto: las páginas del documento + la pregunta (o una por defecto).
      messages.push({
        role: 'user',
        content: [
          ...imgs.map((im) => ({ type: 'image', source: { type: 'base64', media_type: im.mediaType || 'image/jpeg', data: im.base64 } })),
          { type: 'text', text: txt || 'Te adjunto un documento (extracto). Léelo y dime cruda mi realidad a la luz de esto y de mis números.' },
        ],
      });
    } else {
      messages.push({ role: 'user', content: txt || '¿Cómo voy con mi plata?' });
    }
  }

  return {
    model: MODELO_CONCIENCIA_DEFAULT,
    max_tokens: modo === 'susurro' ? 80 : (imgs.length ? 700 : 500),
    system,
    messages,
  };
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
 * Llama a Claude con la voz de conciencia. IMPURA (red). `fetchImpl` inyectable.
 * @returns {Promise<{estado:'ok'|'sin-clave'|'invalida'|'red'|'error', mensaje?:string, texto?:string}>}
 */
export async function aconsejar(
  { contexto, nombre, modo, movimiento, pregunta, historialChat, imagenes, apiKey, modelo },
  { fetchImpl } = {},
) {
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (key === '') {
    return { estado: 'sin-clave', mensaje: 'Configura tu clave de Anthropic en Ajustes → Conexión con IA.' };
  }
  const doFetch = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!doFetch) return { estado: 'error', mensaje: 'Este entorno no puede hacer peticiones de red.' };

  const body = construirPeticion({ contexto, nombre, modo, movimiento, pregunta, historialChat, imagenes });
  if (modelo) body.model = modelo;

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
    return { estado: 'red', mensaje: 'No se pudo conectar. Revisa tu internet e intenta de nuevo.' };
  }

  if (res.status === 401 || res.status === 403) {
    return { estado: 'invalida', mensaje: 'Clave inválida. Revísala en Ajustes.' };
  }
  if (!res.ok) {
    return { estado: 'error', mensaje: `No se pudo responder (HTTP ${res.status}).` };
  }

  let cuerpo;
  try { cuerpo = await res.json(); } catch { return { estado: 'error', mensaje: 'La respuesta no se pudo leer.' }; }

  const texto = extraerTexto(cuerpo);
  if (!texto) return { estado: 'error', mensaje: 'La respuesta llegó vacía.' };
  return { estado: 'ok', texto };
}
