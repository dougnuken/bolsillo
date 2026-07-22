/* ============================================================
   Bolsillo · categories.js
   Catálogo de categorías de gasto, centrado en las categorías que
   el usuario define (el usuario categoriza por persona/propósito).

   Los DEFAULTS que se envían aquí son NEUTROS y genéricos
   ("Persona 1", "Yo", "Hogar", "Supermercado"…): los nombres reales
   los pone cada quien EN SU dispositivo (config.categoriasRenombradas)
   y jamás viven en el código.

   REGLA DURA de retrocompat: los ids NUNCA cambian (los movimientos
   guardan `categoria` = id). Un renombre solo cambia la etiqueta
   visible; un id que ya no esté en el catálogo cae con gracia en
   "Otros" sin romper la vista.

   Sin DOM ni IndexedDB: importable en Node para pruebas.
   El color/tint vive en tokens.css (var --cat-<key>); NUNCA hex aquí.
   ============================================================ */

/* Íconos stroke-based, viewBox 0 0 24 24, currentColor.
   Se referencian por CLAVE (no por id de categoría), para que el
   usuario pueda elegir cualquier ícono para cualquier categoría. */
const ICONOS = {
  persona: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.4"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/></svg>',
  yo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="2.6"/><path d="M7.4 17.6a4.7 4.7 0 0 1 9.2 0"/></svg>',
  corazon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-6.6-4.4-9-8.6C1.4 8.3 3 5.4 6 5.4c2 0 3.2 1.2 4 2.5.8-1.3 2-2.5 4-2.5 3 0 4.6 2.9 3 6-2.4 4.2-9 8.6-9 8.6Z"/></svg>',
  hogar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11.5 12 4l8 7.5"/><path d="M6 10.5V19a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-8.5"/><path d="M10 20v-5h4v5"/></svg>',
  servicios: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/></svg>',
  factura: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18l-3-1.6-3 1.6-3-1.6L6 21V3Z"/><path d="M9 8h6M9 12h6"/></svg>',
  mercado: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 6h15l-1.6 9a2 2 0 0 1-2 1.7H8.6a2 2 0 0 1-2-1.7L5 4H3"/><circle cx="9" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/></svg>',
  auto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 16v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5l2-5.5A2 2 0 0 1 6.9 6h10.2a2 2 0 0 1 1.9 1.5L21 13v5a1 1 0 0 1-1 1h0a1 1 0 0 1-1-1v-2"/><path d="M3 13h18"/><circle cx="7.5" cy="16" r="1.1"/><circle cx="16.5" cy="16" r="1.1"/></svg>',
  salidas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7Z"/><path d="M14 5v14"/></svg>',
  suscripciones: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 0 1 13.7-5.6L20 8"/><path d="M20 4v4h-4"/><path d="M20 12a8 8 0 0 1-13.7 5.6L4 16"/><path d="M4 20v-4h4"/></svg>',
  colegio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m3 8 9-4 9 4-9 4-9-4Z"/><path d="M7 10.5V15c0 1.2 2.2 2.5 5 2.5s5-1.3 5-2.5v-4.5"/><path d="M21 8v5"/></svg>',
  seguros: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 5 6v6c0 4 3 6.8 7 8 4-1.2 7-4 7-8V6l-7-3Z"/><path d="m9.2 12 2 2 3.6-4"/></svg>',
  salud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.3-7-9.4A3.7 3.7 0 0 1 12 8a3.7 3.7 0 0 1 7 2.6C19 15.7 12 20 12 20Z"/><path d="M9 11h2V9h2v2h2v2h-2v2h-2v-2H9v-2Z"/></svg>',
  creditos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/><path d="M7 14.5h4"/></svg>',
  comisiones: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19 19 5"/><circle cx="7.5" cy="7.5" r="2"/><circle cx="16.5" cy="16.5" r="2"/></svg>',
  ocio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V8Z"/><path d="M14 5v14" stroke-dasharray="2 2"/></svg>',
  restaurantes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h13a3 3 0 0 1 0 6h-2"/><path d="M4 8v6a4 4 0 0 0 4 4h3a4 4 0 0 0 4-4V8Z"/><path d="M7 3v2M10 3v2M13 3v2"/></svg>',
  hormiga: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="6.5" r="2.2"/><circle cx="12" cy="12" r="2.6"/><circle cx="12" cy="18" r="2.4"/><path d="M9.6 11 5 9M14.4 11 19 9M9.4 17 5 19M14.6 17 19 19M11 5 9 3M13 5l2-2"/></svg>',
  negocios: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/></svg>',
  otros: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.2"/></svg>',
};

const ICONO_FALLBACK = 'otros';
const TINT_FALLBACK = 'otros';

/** Íconos ofrecidos en el selector de categoría (orden curado). */
export const ICONOS_PICKER = Object.freeze([
  'persona', 'yo', 'corazon', 'hogar', 'mercado', 'auto', 'servicios', 'factura',
  'colegio', 'seguros', 'salud', 'creditos', 'salidas', 'ocio', 'restaurantes',
  'suscripciones', 'hormiga', 'negocios', 'comisiones', 'otros',
].map((key) => Object.freeze({ key, svg: ICONOS[key] })));

/** Tints ofrecidos en el selector (cada uno con clase .cat--<key> en CSS). */
export const TINTS_PICKER = Object.freeze([
  'persona1', 'persona2', 'persona3', 'yo', 'vivienda', 'servicios', 'mercado',
  'transporte', 'colegio', 'seguros', 'salud', 'creditos', 'ocio', 'restaurantes',
  'negocios', 'otros',
]);

/** SVG del ícono de una clave, con fallback seguro. PURA. */
export function iconoDe(key) {
  return ICONOS[key] || ICONOS[ICONO_FALLBACK];
}

/* --- catálogo por defecto (NEUTRO, centrado en persona) ---
   Cada entrada: id (estable), label (neutro), icono (clave) y tint (clave).
   Los ids "vivienda/mercado/transporte/colegio/seguros/…" se conservan de la
   versión previa para que los movimientos ya registrados por el usuario SIGAN
   resolviendo; solo su etiqueta por defecto cambió a un genérico neutro. */
const DEFAULTS = [
  // Personas (el usuario clasifica por persona/propósito, no por tipo genérico).
  { id: 'persona1', label: 'Persona 1', icono: 'persona', tint: 'persona1' },
  { id: 'persona2', label: 'Persona 2', icono: 'persona', tint: 'persona2' },
  { id: 'persona3', label: 'Persona 3', icono: 'persona', tint: 'persona3' },
  { id: 'yo', label: 'Yo', icono: 'yo', tint: 'yo' },
  // Hogar y esenciales (ids preservados de la versión previa).
  { id: 'vivienda', label: 'Hogar', icono: 'hogar', tint: 'vivienda' },
  { id: 'servicios', label: 'Servicios', icono: 'servicios', tint: 'servicios' },
  { id: 'mercado', label: 'Supermercado', icono: 'mercado', tint: 'mercado' },
  { id: 'transporte', label: 'Auto', icono: 'auto', tint: 'transporte' },
  { id: 'colegio', label: 'Colegio', icono: 'colegio', tint: 'colegio' },
  { id: 'seguros', label: 'Seguros', icono: 'seguros', tint: 'seguros' },
  { id: 'salud', label: 'Salud', icono: 'salud', tint: 'salud' },
  { id: 'creditos', label: 'Créditos', icono: 'creditos', tint: 'creditos' },
  { id: 'comisiones', label: 'Comisiones', icono: 'comisiones', tint: 'comisiones' },
  { id: 'ocio', label: 'Ocio', icono: 'ocio', tint: 'ocio' },
  { id: 'restaurantes', label: 'Restaurantes', icono: 'restaurantes', tint: 'restaurantes' },
  { id: 'hormiga', label: 'Hormiga', icono: 'hormiga', tint: 'hormiga' },
  { id: 'negocios', label: 'Negocios', icono: 'negocios', tint: 'negocios' },
  { id: 'otros', label: 'Otros', icono: 'otros', tint: 'otros' },
];

/** Congela una categoría con su ícono e `cls` de tint ya resueltos. */
function congelar({ id, label, icono, tint, propia = false }) {
  return Object.freeze({
    id,
    label,
    icono,                         // clave del ícono (para el editor)
    icon: iconoDe(icono),          // SVG listo para pintar
    tint,                          // clave del tint (para el editor)
    cls: 'cat--' + (tint || TINT_FALLBACK),
    propia,
  });
}

/** Catálogo por defecto ordenado (14 ids preservados + 4 personas). */
export const CATEGORIAS = Object.freeze(DEFAULTS.map(congelar));

/** Ids de las categorías por defecto (no editables/eliminables como propias). */
export const IDS_DEFAULT = Object.freeze(new Set(CATEGORIAS.map((c) => c.id)));

function indexar(lista) {
  return Object.freeze(lista.reduce((acc, c) => { acc[c.id] = c; return acc; }, {}));
}

const POR_ID = indexar(CATEGORIAS);

/** El id "Otros", usado como fallback seguro. */
export const CATEGORIA_OTROS = POR_ID.otros;

const esTexto = (v) => typeof v === 'string' && v.trim() !== '';

/** Lee el estilo (icono/tint) que el usuario haya elegido para un id. PURA. */
function estiloDe(estilos, id) {
  const e = estilos && typeof estilos === 'object' ? estilos[id] : null;
  return e && typeof e === 'object' ? e : {};
}

/** Reordena `lista` según `orden` (array de ids). Estable: los ids que no
    aparecen en `orden` conservan su posición relativa al final. PURA. */
function aplicarOrden(lista, orden) {
  if (!Array.isArray(orden) || orden.length === 0) return lista;
  const rank = new Map(orden.map((id, i) => [id, i]));
  const grande = orden.length + lista.length;
  return lista
    .map((c, i) => ({ c, k: rank.has(c.id) ? rank.get(c.id) : grande + i }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.c);
}

/**
 * Catálogo EFECTIVO = defaults (con renombres + estilo del usuario) + las
 * categorías propias que haya creado, en el orden elegido. PURA.
 *
 * Config leída (todas opcionales y aditivas):
 *  · categoriasRenombradas  {id: 'Nombre'}         (solo cambia la etiqueta)
 *  · categoriasPersonalizadas [{id, label}]        (categorías propias)
 *  · categoriasEstilo       {id: {icono, tint}}    (ícono/tint por categoría)
 *  · categoriasOcultas      [id]                   (no aparecen al registrar)
 *  · categoriasOrden        [id]                   (orden personalizado)
 *
 * @param {object} [config]
 * @returns {ReadonlyArray<object>} catálogo congelado (incluye ocultas, con flag)
 */
export function construirCatalogo(config = {}) {
  const cfg = config && typeof config === 'object' ? config : {};
  const renombradas = (cfg.categoriasRenombradas && typeof cfg.categoriasRenombradas === 'object') ? cfg.categoriasRenombradas : {};
  const propias = Array.isArray(cfg.categoriasPersonalizadas) ? cfg.categoriasPersonalizadas : [];
  const estilos = (cfg.categoriasEstilo && typeof cfg.categoriasEstilo === 'object') ? cfg.categoriasEstilo : {};
  const ocultas = new Set(Array.isArray(cfg.categoriasOcultas) ? cfg.categoriasOcultas.filter(esTexto) : []);

  const base = CATEGORIAS.map((c) => {
    const est = estiloDe(estilos, c.id);
    const nuevo = renombradas[c.id];
    const label = esTexto(nuevo) ? nuevo.trim() : c.label;
    const icono = esTexto(est.icono) ? est.icono : c.icono;
    const tint = esTexto(est.tint) ? est.tint : c.tint;
    return congelar({ id: c.id, label, icono, tint, propia: false });
  });

  const vistos = new Set(base.map((c) => c.id));
  const extra = [];
  for (const p of propias) {
    if (!p || typeof p !== 'object') continue;
    const id = esTexto(p.id) ? p.id.trim() : '';
    if (id === '' || vistos.has(id)) continue;   // ids vacíos o duplicados: se ignoran
    if (!esTexto(p.label)) continue;             // sin nombre: se ignora
    vistos.add(id);
    const est = estiloDe(estilos, id);
    const icono = esTexto(est.icono) ? est.icono : (esTexto(p.icono) ? p.icono : ICONO_FALLBACK);
    const tint = esTexto(est.tint) ? est.tint : (esTexto(p.tint) ? p.tint : TINT_FALLBACK);
    extra.push(congelar({ id, label: p.label.trim(), icono, tint, propia: true }));
  }

  const ordenado = aplicarOrden([...base, ...extra], cfg.categoriasOrden);
  // Marca de oculta (sin quitar del catálogo: sigue resolviendo para display).
  const conFlags = ordenado.map((c) => Object.freeze({ ...c, oculta: ocultas.has(c.id) }));
  return Object.freeze(conFlags);
}

/**
 * Genera un id estable para una categoría propia a partir del nombre.
 * PURA. Prefijo `usr-` para no chocar jamás con los ids por defecto.
 * @param {string} nombre
 * @param {string[]} [existentes] ids ya usados
 */
export function idPersonalizada(nombre, existentes = []) {
  const slug = String(nombre == null ? '' : nombre)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
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
let CATALOGO_ACTIVO = CATEGORIAS.map((c) => Object.freeze({ ...c, oculta: false }));
let POR_ID_ACTIVO = indexar(CATALOGO_ACTIVO);

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

/** Catálogo efectivo COMPLETO (incluye ocultas). Úsalo para resolver y para
    la pantalla de gestión de categorías. */
export function catalogo() {
  return CATALOGO_ACTIVO;
}

/** Catálogo VISIBLE (sin las ocultas). Úsalo en los selectores de captura. */
export function catalogoVisible() {
  return CATALOGO_ACTIVO.filter((c) => !c.oculta);
}

/**
 * Devuelve la categoría por id respetando la personalización activa.
 * Si no existe, cae en "Otros" (evita null en el render). Nunca lanza.
 */
export function categoriaPorId(id) {
  return POR_ID_ACTIVO[id] || POR_ID_ACTIVO.otros || CATEGORIA_OTROS;
}
