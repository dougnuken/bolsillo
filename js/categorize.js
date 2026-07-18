/* ============================================================
   Bolsillo · categorize.js
   Categorización LOCAL de texto libre (base; T6 le añade IA encima).
   La lógica de matching es PURA (sin db/DOM → testeable en Node);
   la persistencia (aprender) se separa e inyecta la db.
   ============================================================ */

import { parseCOP } from './money.js';
import { CATEGORIA_OTROS } from './categories.js';

/* ---- diccionario keyword → categoríaId (comercios/servicios CO) ---- */
/* Las llaves ya vienen normalizadas (minúsculas, sin tildes). */
const DICCIONARIO = Object.freeze({
  // transporte
  taxi: 'transporte', uber: 'transporte', didi: 'transporte', indriver: 'transporte',
  cabify: 'transporte', bus: 'transporte', buseta: 'transporte', transmilenio: 'transporte',
  metro: 'transporte', sitp: 'transporte', pasaje: 'transporte', gasolina: 'transporte',
  terpel: 'transporte', biomax: 'transporte', primax: 'transporte', texaco: 'transporte',
  peaje: 'transporte', parqueadero: 'transporte', parqueo: 'transporte', tren: 'transporte',
  // mercado
  mercado: 'mercado', exito: 'mercado', d1: 'mercado', ara: 'mercado', carulla: 'mercado',
  jumbo: 'mercado', olimpica: 'mercado', metro_super: 'mercado', makro: 'mercado',
  euro: 'mercado', zapatoca: 'mercado', colsubsidio: 'mercado', supermercado: 'mercado',
  fruver: 'mercado', tienda: 'mercado', granero: 'mercado', surtimax: 'mercado',
  surtifruver: 'mercado', mercadopago_super: 'mercado',
  // restaurantes / café
  almuerzo: 'restaurantes', comida: 'restaurantes', cena: 'restaurantes', desayuno: 'restaurantes',
  cafe: 'restaurantes', tinto: 'restaurantes', restaurante: 'restaurantes',
  'juan valdez': 'restaurantes', juanvaldez: 'restaurantes', starbucks: 'restaurantes',
  tostao: 'restaurantes', mcdonalds: 'restaurantes', mcdonald: 'restaurantes', kfc: 'restaurantes',
  frisby: 'restaurantes', dominos: 'restaurantes', 'burger king': 'restaurantes',
  crepes: 'restaurantes', pizza: 'restaurantes', hamburguesa: 'restaurantes',
  rappi: 'restaurantes', domicilio: 'restaurantes', ifood: 'restaurantes', panaderia: 'restaurantes',
  heladeria: 'restaurantes', helado: 'restaurantes',
  // ocio
  netflix: 'ocio', spotify: 'ocio', disney: 'ocio', hbo: 'ocio', 'prime video': 'ocio',
  youtube: 'ocio', cine: 'ocio', cinecolombia: 'ocio', cinepolis: 'ocio', procinal: 'ocio',
  bar: 'ocio', cerveza: 'ocio', trago: 'ocio', discoteca: 'ocio', concierto: 'ocio',
  juego: 'ocio', videojuego: 'ocio', steam: 'ocio', gimnasio: 'ocio', gym: 'ocio',
  // servicios públicos / telco
  epm: 'servicios', codensa: 'servicios', enel: 'servicios', 'air-e': 'servicios',
  acueducto: 'servicios', gas: 'servicios', 'gas natural': 'servicios', vanti: 'servicios',
  luz: 'servicios', energia: 'servicios', agua: 'servicios', internet: 'servicios',
  claro: 'servicios', movistar: 'servicios', tigo: 'servicios', wom: 'servicios',
  etb: 'servicios', une: 'servicios', directv: 'servicios', recarga: 'servicios',
  factura: 'servicios', servicios: 'servicios',
  // salud
  drogueria: 'salud', farmacia: 'salud', 'cruz verde': 'salud', 'la rebaja': 'salud',
  farmatodo: 'salud', locatel: 'salud', eps: 'salud', medico: 'salud', doctor: 'salud',
  odontologo: 'salud', laboratorio: 'salud', examen: 'salud', medicina: 'salud',
  clinica: 'salud', hospital: 'salud', consulta: 'salud', sura: 'salud',
  // vivienda
  arriendo: 'vivienda', renta: 'vivienda', administracion: 'vivienda', hipoteca: 'vivienda',
  vivienda: 'vivienda', canon: 'vivienda',
  // colegio
  colegio: 'colegio', pension: 'colegio', matricula: 'colegio', utiles: 'colegio',
  uniforme: 'colegio', ruta: 'colegio', jardin: 'colegio', guarderia: 'colegio',
  // seguros
  seguro: 'seguros', poliza: 'seguros', soat: 'seguros', prevision: 'seguros',
  funeraria: 'seguros', exequial: 'seguros',
  // créditos
  cuota: 'creditos', credito: 'creditos', prestamo: 'creditos', tarjeta: 'creditos',
  // comisiones bancarias
  comision: 'comisiones', cuatroporm: 'comisiones', '4x1000': 'comisiones',
  cuota_manejo: 'comisiones', 'cuota de manejo': 'comisiones', retiro: 'comisiones',
  transferencia: 'comisiones', gmf: 'comisiones',
  // negocios
  negocio: 'negocios', proveedor: 'negocios', insumos: 'negocios', inventario: 'negocios',
  nomina: 'negocios',
});

/* Palabras que no aportan al nombre del comercio (para extraerlo). */
const RUIDO = new Set([
  'pague', 'pago', 'gaste', 'gasto', 'compre', 'compra', 'de', 'del', 'en', 'el', 'la',
  'los', 'las', 'un', 'una', 'por', 'para', 'con', 'a', 'al', 'y', 'me', 'mi', 'costo',
  'valor', 'me cobraron', 'cobraron', 'saque', 'retire', 'mil', 'millon', 'millones',
  'pesos', 'plata', 'e', 'lo',
]);

/** Normaliza: minúsculas, sin tildes, espacios colapsados. Puro. */
export function normalizar(texto) {
  return String(texto == null ? '' : texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/* Quita monto/sufijos/símbolos para quedarnos con palabras de comercio. */
function limpiarParaComercio(norm) {
  return norm
    .replace(/\$/g, ' ')
    // números con sufijo (15k, 1,5 millones, 50 mil) y números sueltos
    .replace(/\d[\d.,]*\s*(k|mil|millon(?:es)?|m)?\b/g, ' ')
    .replace(/[^\p{L}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Mejor esfuerzo por extraer el nombre del comercio de un texto normalizado.
 * Devuelve '' si no queda nada útil.
 */
export function extraerComercio(norm) {
  const limpio = limpiarParaComercio(norm);
  if (!limpio) return '';
  const palabras = limpio.split(' ').filter((w) => w && !RUIDO.has(w));
  return palabras.slice(0, 3).join(' ').trim();
}

/* Busca en el diccionario por coincidencia de palabra o subcadena. */
function matchDiccionario(norm) {
  // 1) coincidencia exacta de alguna llave multi-palabra dentro del texto
  for (const clave of Object.keys(DICCIONARIO)) {
    if (clave.includes(' ') && norm.includes(clave)) {
      return { categoriaId: DICCIONARIO[clave], termino: clave };
    }
  }
  // 2) por palabra individual
  const palabras = norm.split(/[^\p{L}\d]+/u).filter(Boolean);
  for (const w of palabras) {
    if (DICCIONARIO[w]) return { categoriaId: DICCIONARIO[w], termino: w };
  }
  return null;
}

/**
 * Adivina categoría y comercio de un texto libre. PURA.
 * Prioridad: overrides aprendidos (config.categoriasAprendidas) > diccionario.
 * @param {string} texto
 * @param {object} [config]  se lee config.categoriasAprendidas (mapa normalizado→id)
 * @returns {{categoriaId:string, comercio:string}}
 */
export function adivinarCategoria(texto, config = {}) {
  const norm = normalizar(texto);
  const comercio = extraerComercio(norm);
  const aprendidas = (config && config.categoriasAprendidas) || {};

  // 1) ¿el comercio completo ya fue enseñado?
  if (comercio && aprendidas[comercio]) {
    return { categoriaId: aprendidas[comercio], comercio };
  }
  // 2) ¿alguna palabra del texto fue enseñada?
  const palabras = norm.split(/[^\p{L}\d]+/u).filter(Boolean);
  for (const w of palabras) {
    if (aprendidas[w]) return { categoriaId: aprendidas[w], comercio: comercio || w };
  }
  // 3) diccionario base
  const m = matchDiccionario(norm);
  if (m) return { categoriaId: m.categoriaId, comercio: comercio || m.termino };

  // 4) sin match → Otros
  return { categoriaId: CATEGORIA_OTROS.id, comercio };
}

/* Token monetario embebido en frases: "taxi 15.000", "50k mercado",
   "1,5 millones arriendo". Devuelve el substring a pasar a parseCOP. */
const RE_MONTO = /\$?\s*\d[\d.,]*\s*(?:millones|millon|mil|k|m)?\b/i;

/** Extrae el monto (entero COP) de un texto libre. PURA. null si no hay. */
export function extraerMonto(texto) {
  const norm = normalizar(texto);
  const m = norm.match(RE_MONTO);
  if (!m) return null;
  return parseCOP(m[0]);
}

/**
 * Combina parseo de monto (money.parseCOP) + categoría/comercio.
 * Prellena el formulario de registro. PURA.
 * @returns {{monto:(number|null), categoriaId:string, comercio:string}}
 */
export function parseTextoLibre(texto, config = {}) {
  const monto = extraerMonto(texto);
  const { categoriaId, comercio } = adivinarCategoria(texto, config);
  return { monto, categoriaId, comercio };
  // Hook T6: si config.apiKey y no hubo match confiable, delegar en IA.
}

/**
 * Persiste una corrección: la app aprende que <comercio> = <categoriaId>.
 * Impura (usa db). Devuelve la config nueva.
 * @param {string} comercio
 * @param {string} categoriaId
 * @param {{getConfig:Function, saveConfig:Function}} db
 */
export async function aprender(comercio, categoriaId, db) {
  const clave = normalizar(comercio);
  if (!clave || !categoriaId) return db.getConfig();
  const cfg = await db.getConfig();
  const aprendidas = { ...(cfg.categoriasAprendidas || {}), [clave]: categoriaId };
  return db.saveConfig({ categoriasAprendidas: aprendidas });
}
