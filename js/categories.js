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
  corazon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21C12 21 4 15.5 4 9.5 4 6.5 6.2 5 8.5 5.5 10 5.8 11.3 6.8 12 8 12.7 6.8 14 5.8 15.5 5.5 17.8 5 20 6.5 20 9.5 20 15.5 12 21 12 21Z"/></svg>',
  hogar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11.5 12 4l8 7.5"/><path d="M6 10.5V19a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-8.5"/><path d="M10 20v-5h4v5"/></svg>',
  servicios: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/></svg>',
  factura: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18l-3-1.6-3 1.6-3-1.6L6 21V3Z"/><path d="M9 8h6M9 12h6"/></svg>',
  mercado: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 6h15l-1.6 9a2 2 0 0 1-2 1.7H8.6a2 2 0 0 1-2-1.7L5 4H3"/><circle cx="9" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/></svg>',
  auto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17H4a1 1 0 0 1-1-1v-3.3a2 2 0 0 1 .2-.9l1.7-3.4A2 2 0 0 1 6.7 7h10.6a2 2 0 0 1 1.8 1.1l1.7 3.4a2 2 0 0 1 .2.9V16a1 1 0 0 1-1 1h-1"/><path d="M3.5 12h17"/><circle cx="7.5" cy="17" r="1.9"/><circle cx="16.5" cy="17" r="1.9"/><path d="M9.4 17h5.2"/></svg>',
  salidas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7Z"/><path d="M14 5v14"/></svg>',
  suscripciones: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 0 1 13.7-5.6L20 8"/><path d="M20 4v4h-4"/><path d="M20 12a8 8 0 0 1-13.7 5.6L4 16"/><path d="M4 20v-4h4"/></svg>',
  colegio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m3 8 9-4 9 4-9 4-9-4Z"/><path d="M7 10.5V15c0 1.2 2.2 2.5 5 2.5s5-1.3 5-2.5v-4.5"/><path d="M21 8v5"/></svg>',
  seguros: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 5 6v6c0 4 3 6.8 7 8 4-1.2 7-4 7-8V6l-7-3Z"/><path d="m9.2 12 2 2 3.6-4"/></svg>',
  salud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.49 4.04 3 5.5l7 7Z"/><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/></svg>',
  creditos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/><path d="M7 14.5h4"/></svg>',
  comisiones: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19 19 5"/><circle cx="7.5" cy="7.5" r="2"/><circle cx="16.5" cy="16.5" r="2"/></svg>',
  ocio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V8Z"/><path d="M14 5v14" stroke-dasharray="2 2"/></svg>',
  restaurantes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h13a3 3 0 0 1 0 6h-2"/><path d="M4 8v6a4 4 0 0 0 4 4h3a4 4 0 0 0 4-4V8Z"/><path d="M7 3v2M10 3v2M13 3v2"/></svg>',
  hormiga: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="6.5" r="2.2"/><circle cx="12" cy="12" r="2.6"/><circle cx="12" cy="18" r="2.4"/><path d="M9.6 11 5 9M14.4 11 19 9M9.4 17 5 19M14.6 17 19 19M11 5 9 3M13 5l2-2"/></svg>',
  negocios: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/></svg>',
  otros: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.2"/></svg>',
  cafe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9h11v4.5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9Z"/><path d="M16 10.5h2.5a2 2 0 0 1 0 4H16"/><path d="M8 3v2.2M11 3v2.2"/></svg>',
  gasolina: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v15"/><path d="M3 21h10"/><path d="M4.5 11h7"/><path d="M12 9h3.5a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V9.8a2 2 0 0 0-.6-1.4L17 6"/></svg>',
  viaje: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-6-5.3-6-10.2A6 6 0 0 1 18 10.8C18 15.7 12 21 12 21Z"/><circle cx="12" cy="10.8" r="2.3"/></svg>',
  avion: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 3 3.5 10.5l6 2 2 6L21.5 3Z"/><path d="M9.5 12.5 13 9"/></svg>',
  telefono: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="6.5" y="2.5" width="11" height="19" rx="2.6"/><path d="M10.5 18.5h3"/></svg>',
  dispositivo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="11" rx="1.6"/><path d="M2.5 19.5h19"/></svg>',
  libro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6.5C10.4 5.1 8 4.6 5 5.2v12.6c3-.6 5.4-.1 7 1.4 1.6-1.5 4-2 7-1.4V5.2c-3-.6-5.4-.1-7 1.3Z"/><path d="M12 6.5V19"/></svg>',
  gimnasio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8v8M7 6v12M17 6v12M20 8v8M7 12h10"/></svg>',
  belleza: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6.5" r="2.5"/><circle cx="6" cy="17.5" r="2.5"/><path d="M8.2 7.8 20 16M8.2 16.2 20 8"/></svg>',
  ropa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4 3.8 7.4l1.9 2.3L7 8.6V20h10V8.6l1.3 1.1 1.9-2.3L16 4c-.9 1.3-2.3 1.9-4 1.9S8.9 5.3 8 4Z"/></svg>',
  mascota: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="6.5" cy="12.5" r="1.7"/><circle cx="10" cy="8.5" r="1.7"/><circle cx="14" cy="8.5" r="1.7"/><circle cx="17.5" cy="12.5" r="1.7"/><path d="M12 13.5c-1.6 0-2.8 1.1-3.4 2.4-.6 1.3-.3 2.8 1.1 3.1.9.2 1.4-.3 2.3-.3s1.4.5 2.3.3c1.4-.3 1.7-1.8 1.1-3.1-.6-1.3-1.8-2.4-3.4-2.4Z"/></svg>',
  regalo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="9" width="16" height="4" rx="1"/><path d="M12 9v12"/><path d="M18 13v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 18.5V13"/><path d="M8.5 9a2.5 2.5 0 0 1 0-5C11 4 12 9 12 9s1-5 3.5-5a2.5 2.5 0 0 1 0 5"/></svg>',
  musica: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 17V5l10-2v12"/><circle cx="6" cy="17" r="3"/><circle cx="16" cy="15" r="3"/></svg>',
  ahorro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8.4A6.5 6.5 0 0 0 14 8h-4a6 6 0 0 0-6 6c0 1.8.9 3.4 2.2 4.6l.6 1.4c.1.3.4.5.7.5h1.3c.4 0 .7-.3.8-.6a8 8 0 0 0 3.8 0c.1.3.4.6.8.6h1.3c.3 0 .6-.2.7-.5l.6-1.3c.7-.6 1.2-1.4 1.5-2.3H21a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-1.4a6 6 0 0 0-1.6-2.6Z"/><path d="M10 8c-.5-1.4.2-3 1.6-3.6"/><circle cx="14.5" cy="12" r=".8"/></svg>',
};

const ICONO_FALLBACK = 'otros';
const TINT_FALLBACK = 'otros';

/** Íconos ofrecidos en el selector de categoría (orden curado). */
export const ICONOS_PICKER = Object.freeze([
  'persona', 'yo', 'corazon', 'hogar', 'mercado', 'restaurantes', 'cafe',
  'auto', 'gasolina', 'viaje', 'avion', 'servicios', 'factura',
  'telefono', 'dispositivo', 'colegio', 'libro', 'seguros', 'salud',
  'gimnasio', 'belleza', 'ropa', 'mascota', 'regalo', 'ocio', 'musica',
  'salidas', 'suscripciones', 'ahorro', 'creditos', 'negocios',
  'comisiones', 'hormiga', 'otros',
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
