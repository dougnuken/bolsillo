/* ============================================================
   Bolsillo · reconciliacion.js
   Sugiere el GASTO FIJO pendiente que corresponde a un gasto manual
   recién registrado, para poder VINCULARLO (recurrenteId) y que el
   recordatorio se apague sin contarse doble.
   PURO y testeable: sin db ni DOM. El "hoy" es inyectable.
   ============================================================ */

/** Normaliza texto para comparar: minúsculas, sin acentos, espacios colapsados. */
function norm(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita diacríticos
    .replace(/\s+/g, ' ');
}

const pad2 = (n) => String(n).padStart(2, '0');

/** Prefijo 'YYYY-MM' del mes LOCAL de `hoy` (nunca UTC — misma regla que fechas.js). */
function prefijoLocal(hoy) {
  const d = hoy instanceof Date ? hoy : new Date(hoy);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/** ¿El fijo ya tiene un movimiento vinculado este mes? (ya pagado/materializado) */
function yaVinculado(movimientos, recId, prefijo) {
  return movimientos.some((m) => m && m.recurrenteId === recId
    && typeof m.fecha === 'string' && m.fecha.slice(0, 7) === prefijo);
}

/**
 * Nombres "parecidos": iguales, uno contiene al otro (palabra de 3+ letras),
 * o buen solape de tokens (Jaccard ≥ 0.5 sobre palabras de 3+ letras).
 * Ej: "Sura madre" ~ "Sura madre" · "Sura" ~ "Sura madre" · "Netflix" ≁ "Spotify".
 */
export function nombreParecido(a, b) {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const corto = na.length <= nb.length ? na : nb;
  const largo = corto === na ? nb : na;
  if (corto.length >= 3 && largo.includes(corto)) return true;
  const ta = new Set(na.split(' ').filter((t) => t.length >= 3));
  const tb = new Set(nb.split(' ').filter((t) => t.length >= 3));
  if (!ta.size || !tb.size) return false;
  let comunes = 0;
  ta.forEach((t) => { if (tb.has(t)) comunes += 1; });
  const union = new Set([...ta, ...tb]).size;
  return comunes / union >= 0.5;
}

/** Monto "cercano" (±20%) para fijos de VALOR EXACTO. Los variables no aplican. */
export function montoCercano(gasto, rec) {
  if (!rec || rec.esVariable === true || !(rec.monto > 0)) return false;
  if (!gasto || !(gasto.monto > 0)) return false;
  return Math.abs(gasto.monto - rec.monto) / rec.monto <= 0.2;
}

/**
 * Sugiere el fijo pendiente que corresponde a un gasto manual, o null.
 *
 * Candidato = recurrente ACTIVO y NO vinculado aún este mes (pendiente).
 * Se sugiere si el NOMBRE se parece, o si (misma CATEGORÍA Y MONTO cercano en
 * los fijos exactos). Entre varios, gana el de mayor puntaje. NUNCA sugiere para
 * un gasto que ya está vinculado (recurrenteId) ni para ingresos.
 *
 * @param {{gasto:object, recurrentes?:object[], movimientos?:object[], hoy?:Date}} args
 * @returns {object|null} el recurrente sugerido
 */
export function sugerirFijo({ gasto, recurrentes = [], movimientos = [], hoy = new Date() } = {}) {
  if (!gasto || gasto.tipo !== 'gasto' || gasto.recurrenteId) return null;
  const prefijo = prefijoLocal(hoy);
  let mejor = null;
  let mejorPunta = 0;
  for (const rec of recurrentes) {
    if (!rec || rec.activo !== true) continue;
    if (yaVinculado(movimientos, rec.id, prefijo)) continue; // ya pagado este mes
    const nombre = nombreParecido(gasto.comercio, rec.nombre);
    const cat = !!gasto.categoria && gasto.categoria === rec.categoria;
    const monto = montoCercano(gasto, rec);
    const sugerible = nombre || (cat && monto);
    if (!sugerible) continue;
    const punta = (nombre ? 3 : 0) + (cat ? 2 : 0) + (monto ? 2 : 0);
    if (punta > mejorPunta) { mejorPunta = punta; mejor = rec; }
  }
  return mejor;
}
