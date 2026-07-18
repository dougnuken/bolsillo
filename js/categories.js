/* ============================================================
   Bolsillo · categories.js
   Catálogo canónico de 14 categorías de gasto.
   Cada una: id, label, icon (SVG inline string), cls (clase de
   tint definida en components.css → .cat--<id>).
   Sin DOM ni IndexedDB: importable en Node para pruebas.
   El color/tint vive en tokens.css (var --cat-<id>); NUNCA hex aquí.
   ============================================================ */

/* Íconos stroke-based, viewBox 0 0 24 24, currentColor. */
const I = {
  vivienda: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11.5 12 4l8 7.5"/><path d="M6 10.5V19a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-8.5"/><path d="M10 20v-5h4v5"/></svg>',
  servicios: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/></svg>',
  mercado: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 6h15l-1.6 9a2 2 0 0 1-2 1.7H8.6a2 2 0 0 1-2-1.7L5 4H3"/><circle cx="9" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/></svg>',
  transporte: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 16v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5l2-5.5A2 2 0 0 1 6.9 6h10.2a2 2 0 0 1 1.9 1.5L21 13v5a1 1 0 0 1-1 1h0a1 1 0 0 1-1-1v-2"/><path d="M3 13h18"/><circle cx="7.5" cy="16" r="1.1"/><circle cx="16.5" cy="16" r="1.1"/></svg>',
  colegio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m3 8 9-4 9 4-9 4-9-4Z"/><path d="M7 10.5V15c0 1.2 2.2 2.5 5 2.5s5-1.3 5-2.5v-4.5"/><path d="M21 8v5"/></svg>',
  seguros: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 5 6v6c0 4 3 6.8 7 8 4-1.2 7-4 7-8V6l-7-3Z"/><path d="m9.2 12 2 2 3.6-4"/></svg>',
  salud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.3-7-9.4A3.7 3.7 0 0 1 12 8a3.7 3.7 0 0 1 7 2.6C19 15.7 12 20 12 20Z"/><path d="M9 11h2V9h2v2h2v2h-2v2h-2v-2H9v-2Z"/></svg>',
  creditos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/><path d="M7 14.5h4"/></svg>',
  comisiones: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19 19 5"/><circle cx="7.5" cy="7.5" r="2"/><circle cx="16.5" cy="16.5" r="2"/></svg>',
  ocio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7Z"/><path d="M14 5v14"/></svg>',
  restaurantes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h13a3 3 0 0 1 0 6h-2"/><path d="M4 8v6a4 4 0 0 0 4 4h3a4 4 0 0 0 4-4V8Z"/><path d="M7 3v2M10 3v2M13 3v2"/></svg>',
  hormiga: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="6.5" r="2.2"/><circle cx="12" cy="12" r="2.6"/><circle cx="12" cy="18" r="2.4"/><path d="M9.6 11 5 9M14.4 11 19 9M9.4 17 5 19M14.6 17 19 19M11 5 9 3M13 5l2-2"/></svg>',
  negocios: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/></svg>',
  otros: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.2"/></svg>',
};

/** Catálogo ordenado. `cls` es la clase de tint en components.css. */
export const CATEGORIAS = Object.freeze([
  { id: 'vivienda', label: 'Vivienda / Arriendo', icon: I.vivienda },
  { id: 'servicios', label: 'Servicios públicos', icon: I.servicios },
  { id: 'mercado', label: 'Mercado', icon: I.mercado },
  { id: 'transporte', label: 'Transporte', icon: I.transporte },
  { id: 'colegio', label: 'Colegio hija', icon: I.colegio },
  { id: 'seguros', label: 'Seguros madre', icon: I.seguros },
  { id: 'salud', label: 'Salud', icon: I.salud },
  { id: 'creditos', label: 'Créditos (cuotas)', icon: I.creditos },
  { id: 'comisiones', label: 'Comisiones bancarias', icon: I.comisiones },
  { id: 'ocio', label: 'Ocio', icon: I.ocio },
  { id: 'restaurantes', label: 'Restaurantes / Café', icon: I.restaurantes },
  { id: 'hormiga', label: 'Hormiga - otros', icon: I.hormiga },
  { id: 'negocios', label: 'Negocios (egresos)', icon: I.negocios },
  { id: 'otros', label: 'Otros', icon: I.otros },
].map((c) => Object.freeze({ ...c, cls: 'cat--' + c.id })));

function indexar(lista) {
  return Object.freeze(lista.reduce((acc, c) => { acc[c.id] = c; return acc; }, {}));
}

const POR_ID = indexar(CATEGORIAS);

/** El id "Otros", usado como fallback seguro. */
export const CATEGORIA_OTROS = POR_ID.otros;

const esTexto = (v) => typeof v === 'string' && v.trim() !== '';

/**
 * Catálogo EFECTIVO = canónicas (con los renombres del usuario aplicados)
 * + las categorías propias que haya creado. PURA: no toca estado ni DOM.
 *
 * Los ids canónicos nunca cambian (los movimientos guardan `categoriaId`);
 * un renombre solo afecta la etiqueta visible.
 *
 * @param {object} [config] config del usuario
 * @returns {ReadonlyArray<object>} catálogo congelado
 */
export function construirCatalogo(config = {}) {
  const renombradas = (config && typeof config.categoriasRenombradas === 'object' && config.categoriasRenombradas) || {};
  const propias = Array.isArray(config && config.categoriasPersonalizadas) ? config.categoriasPersonalizadas : [];

  const base = CATEGORIAS.map((c) => {
    const nuevo = renombradas[c.id];
    return esTexto(nuevo) ? Object.freeze({ ...c, label: nuevo.trim() }) : c;
  });

  const vistos = new Set(base.map((c) => c.id));
  const extra = [];
  for (const p of propias) {
    if (!p || typeof p !== 'object') continue;
    const id = esTexto(p.id) ? p.id.trim() : '';
    if (id === '' || vistos.has(id)) continue;      // ids duplicados: se ignoran
    if (!esTexto(p.label)) continue;                // sin nombre: se ignora
    vistos.add(id);
    extra.push(Object.freeze({
      id,
      label: p.label.trim(),
      icon: I.otros,        // las propias reusan el ícono e ícono-tint neutros
      cls: 'cat--otros',
      propia: true,
    }));
  }

  return Object.freeze([...base, ...extra]);
}

/**
 * Genera un id estable para una categoría propia a partir del nombre.
 * PURA. Prefijo `usr-` para no chocar jamás con los canónicos.
 * @param {string} nombre
 * @param {string[]} [existentes] ids ya usados
 */
export function idPersonalizada(nombre, existentes = []) {
  const slug = String(nombre == null ? '' : nombre)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  const base = 'usr-' + (slug || 'categoria');
  const usados = new Set(existentes);
  if (!usados.has(base)) return base;
  let n = 2;
  while (usados.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/* ---- catálogo activo (cache de solo lectura, se reemplaza entero) ----
   No es mutación de datos: cada aplicación construye un catálogo NUEVO
   y congelado, y se cambia la referencia. app.js lo ceba al arrancar. */
let CATALOGO_ACTIVO = CATEGORIAS;
let POR_ID_ACTIVO = POR_ID;

/**
 * Aplica la personalización del usuario a todo el catálogo de la app.
 * @param {object} config
 * @returns {ReadonlyArray<object>} el catálogo efectivo
 */
export function aplicarPersonalizacion(config) {
  CATALOGO_ACTIVO = construirCatalogo(config);
  POR_ID_ACTIVO = indexar(CATALOGO_ACTIVO);
  return CATALOGO_ACTIVO;
}

/** Catálogo efectivo actual (canónicas + personalización aplicada). */
export function catalogo() {
  return CATALOGO_ACTIVO;
}

/**
 * Devuelve la categoría por id respetando la personalización activa.
 * Si no existe, cae en "Otros" (evita null en el render). Nunca lanza.
 */
export function categoriaPorId(id) {
  return POR_ID_ACTIVO[id] || POR_ID_ACTIVO.otros || CATEGORIA_OTROS;
}
