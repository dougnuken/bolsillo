/* ============================================================
   olbo · views/productos.js  (CARTERA)
   Vista full-screen (no-tab, se llega desde la card "Mis productos" de Hoy).
   Dos pantallas dentro de una: LISTA (tarjetas realistas de cada producto) y
   DETALLE (resumen + diferidos + verificación mes-a-mes del producto elegido).

   Los datos vienen del store `creditos` (identidad) + `cortes` (extractos).
   La lógica de deuda vive en diferidos.js; aquí solo se pinta. Maneja tanto
   tarjetas (con franquicia/últimos 4/skin) como créditos sin plástico
   (un préstamo, una libranza): esos se ven como tiles de color con su saldo.
   ============================================================ */

import { getAll } from '../db.js';
import { formatCOP } from '../money.js';
import { esc } from '../html.js';
import { abrirCreditos } from './cfg-creditos.js';
import { SKINS_TARJETA } from '../model.js';
import { porDireccion, saldoPendiente, totalAbonado, fraccionAbonada, totalPorCobrar } from '../prestamos.js';
import { abrirNuevoPrestamo, abrirAbono } from './prestamo-sheet.js';
import { ordenarPorCascada, compararCortes, totalDiferido, fmtMonto, slug } from '../diferidos.js';
import { segHTML, colocarThumb } from '../segmented.js';

const ICON_BACK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>';
const ICON_ORB =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2.5l1.7 4.6a4 4 0 0 0 2.4 2.4l4.6 1.7-4.6 1.7a4 4 0 0 0-2.4 2.4L13 20.5l-1.7-4.6a4 4 0 0 0-2.4-2.4L4.3 11.8l4.6-1.7a4 4 0 0 0 2.4-2.4L13 2.5Z"/></svg>';

/* ---- identidad visual de la tarjeta ---- */
/** Clase de skin (fondo del plástico) a partir del producto.
    La lista válida sale de SKINS_TARJETA (model.js) — antes estaba duplicada
    aquí y al agregar colores nuevos caían al fallback sin avisar. */
function skinClase(c) {
  const s = c && typeof c.skin === 'string' ? c.skin : '';
  if (SKINS_TARJETA.includes(s)) return 'skin-' + s;
  return c && c.franquicia ? 'skin-grafito' : 'skin-olbo'; // con plástico → negro; crédito → morado
}
function productoDe(c) {
  return (c && ((c.producto && c.producto.trim()) || (c.tipo && c.tipo.trim()))) || 'Producto';
}
/** Id corto y seguro (para clip-path de SVG) desde el id del crédito. */
function uidDe(c) {
  return String((c && c.id) || 'x').replace(/[^a-zA-Z0-9]/g, '').slice(-10) || 'x';
}
/** Marca de franquicia (SVG inline con clip-path único por tarjeta). */
function marcaHTML(fr, uid) {
  if (fr === 'mastercard') {
    const id = 'mcc-' + uid;
    return `<span class="cc__logo"><svg class="mc" viewBox="0 0 46 30" aria-label="Mastercard">`
      + `<defs><clipPath id="${id}"><circle cx="17" cy="15" r="13"/></clipPath></defs>`
      + `<circle cx="17" cy="15" r="13" fill="#EB001B"/><circle cx="29" cy="15" r="13" fill="#F79E1B"/>`
      + `<circle cx="29" cy="15" r="13" fill="#FF5F00" clip-path="url(#${id})"/></svg></span>`;
  }
  if (fr === 'visa') return '<span class="cc__logo"><span class="cc__visa">VISA</span></span>';
  if (fr === 'amex') return '<span class="cc__logo"><span class="cc__visa">AMEX</span></span>';
  return '';
}
/** Monto principal de la tarjeta: LO QUE TOCA PAGAR este mes (la cuota), no el saldo. */
function montoTarjeta(cred, cortes) {
  if (Number.isFinite(cred.cuotaMensual) && cred.cuotaMensual > 0) return { eyebrow: 'Cuota del mes', amount: cred.cuotaMensual };
  // Fallbacks si aún no hay cuota registrada: lo del extracto, o el saldo.
  const g = cortesDe(cred, cortes);
  const cop = g.COP && g.COP.ultimo;
  if (cop) { const r = cop.resumen || {}; return { eyebrow: 'A pagar este mes', amount: r.pagoAPlazos ?? r.pagoTotal ?? totalDiferido(cop.diferidos) }; }
  if (cred.saldo != null) return { eyebrow: 'Saldo', amount: cred.saldo };
  return { eyebrow: 'Cuota del mes', amount: 0 };
}

/* ---- cortes de un producto (por moneda), último y anterior ---- */
function cortesDe(cred, cortes) {
  const base = slug(`${cred.entidad}-${productoDe(cred)}`);
  const mios = (cortes || []).filter((c) => c && typeof c.cuentaClave === 'string' && c.cuentaClave.startsWith(base));
  const porMoneda = {};
  for (const c of mios) (porMoneda[c.moneda] = porMoneda[c.moneda] || []).push(c);
  const out = {};
  for (const [m, arr] of Object.entries(porMoneda)) {
    const desc = arr.slice().sort((a, b) => (a.corte < b.corte ? 1 : a.corte > b.corte ? -1 : 0));
    out[m] = { ultimo: desc[0], anterior: desc[1] || null };
  }
  return out;
}

/* ---- tarjeta de producto (Finpay: banda glass arriba + valor abajo) ---- */
function tarjetaHTML(cred, cortes) {
  const uid = uidDe(cred);
  const m = montoTarjeta(cred, cortes);
  const esCredito = !cred.franquicia && !cred.ultimosCuatro; // crédito sin plástico
  const logo = cred.franquicia ? marcaHTML(cred.franquicia, uid) : (esCredito ? '<span class="cc__tag">Crédito</span>' : '');
  const numero = formatCOP(m.amount).replace('$', '');
  const last4 = cred.ultimosCuatro ? `<span class="cc__last4">•••• ${esc(cred.ultimosCuatro)}</span>` : '';
  return `
    <button class="cc ${skinClase(cred)}${esCredito ? ' cc--credit' : ''}" type="button" data-cred="${esc(cred.id)}">
      <span class="cc__band">
        <span class="cc__bandtext">
          <span class="cc__entity">${esc(cred.entidad || 'Producto')}</span>
          <span class="cc__product">${esc(productoDe(cred))}</span>
        </span>
        ${logo}
      </span>
      <span class="cc__body">
        <span class="cc__left">
          <span class="cc__eyebrow">${esc(m.eyebrow)}</span>
          <span class="cc__amount"><span class="cc__cur">$</span>${esc(numero)}</span>
        </span>
        ${last4}
      </span>
    </button>`;
}

/* ---- tarjeta de préstamo (me deben / debo) ---- */
function prestamoHTML(p, debo) {
  const saldo = saldoPendiente(p);
  const pagado = totalAbonado(p);
  const pct = Math.round(fraccionAbonada(p) * 100);
  const liquidado = saldo <= 0;
  const meta = [p.concepto || (debo ? 'Deuda personal' : 'Préstamo')];
  if (p.tasaEA != null) meta.push(`${String(p.tasaEA).replace('.', ',')}% E.A.`);
  return `
    <article class="pcard${liquidado ? ' pcard--ok' : ''}">
      <div class="pcard__top">
        <div class="pcard__id">
          <p class="pcard__name">${esc(p.persona)}</p>
          <p class="pcard__sub">${esc(meta.join(' · '))}</p>
        </div>
        <div class="pcard__saldo">
          <p class="pcard__pend num">${esc(formatCOP(saldo))}</p>
          <p class="pcard__lbl">${liquidado ? (debo ? 'pagada' : 'saldado') : (debo ? 'le debes' : 'te debe')}</p>
        </div>
      </div>
      <div class="pcard__track"><span class="pcard__fill" data-fill="${pct}"></span></div>
      <div class="pcard__foot">
        <span class="pcard__abonado">${esc(formatCOP(pagado))} de ${esc(formatCOP(p.monto))}${pct ? ` · ${pct}%` : ''}</span>
        ${liquidado ? '' : `<button class="pcard__btn" type="button" data-abono="${esc(p.id)}">${debo ? 'Abonar' : 'Registrar abono'}</button>`}
      </div>
    </article>`;
}

/* ---- LISTA (cartera) con 3 tabs ---- */
const TABS = [['productos', 'Mis productos'], ['me-deben', 'Me deben'], ['debo', 'Debo']];
const TAB_ATTR = 'data-tab';
let tabActivo = 'productos';
/* Cambiar de segmento re-renderiza la lista entera, así que guardamos de dónde
   veníamos para que la pastilla se deslice en vez de saltar al destino. */
let tabPrevio = null;

/**
 * Abre la cartera directamente en un segmento. La usa Personas, cuyo acceso
 * dice "Te deben": mandarlo a la lista de productos obligaba a un toque extra
 * para llegar a donde el propio enlace prometía.
 * Se llama ANTES de cambiar el hash, para que la vista monte ya posicionada.
 */
export function abrirEn(tab) {
  tabActivo = TABS.some(([id]) => id === tab) ? tab : 'productos';
  tabPrevio = null;   // se entra ya en el segmento: nada que deslizar
}

function tabsHTML() {
  return segHTML(TABS, tabActivo, {
    attr: TAB_ATTR,
    label: 'Secciones de la cartera',
    clase: 'seg--dock',   // mismo vidrio que la barra inferior
  });
}

function listaHTML(creditos, cortes, prestamos) {
  const head = `
    <div class="wallet-back-row">
      <button class="btn btn--ghost btn--head btn--back" type="button" data-inicio aria-label="Volver a Hoy">${ICON_BACK}</button>
    </div>
    ${tabsHTML()}`;

  if (tabActivo === 'productos') {
    if (!creditos.length) {
      return `${head}
        <div class="empty">
          <h2 class="empty__title">Aún no tienes productos</h2>
          <p class="empty__text">Agrega tus tarjetas y créditos para verlos aquí y seguir tu deuda mes a mes.</p>
          <button class="btn btn--primary" id="wallet-add" type="button">+ Agregar producto</button>
        </div>`;
    }
    return `${head}
      <p class="wallet-sub">Toca una tarjeta para ver el detalle.</p>
      <div class="wallet-cards">${creditos.map((c) => tarjetaHTML(c, cortes)).join('')}</div>
      <button class="btn btn--ghost btn--block wallet-add-btn" id="wallet-add" type="button">+ Agregar producto</button>`;
  }

  // Tabs de préstamos: 'me-deben' (presté) y 'debo' (me prestaron).
  const debo = tabActivo === 'debo';
  const lista = porDireccion(prestamos, tabActivo);
  const activos = lista.filter((p) => saldoPendiente(p) > 0).sort((a, b) => saldoPendiente(b) - saldoPendiente(a));
  const saldados = lista.filter((p) => saldoPendiente(p) <= 0);
  const total = totalPorCobrar(activos);
  const cta = `<button class="btn btn--ghost btn--block wallet-add-btn" id="wallet-add-prestamo" type="button">+ ${debo ? 'Anotar una deuda' : 'Prestar dinero'}</button>`;

  if (!lista.length) {
    return `${head}
      <div class="empty">
        <h2 class="empty__title">${debo ? 'No debes nada a nadie' : 'Nadie te debe'}</h2>
        <p class="empty__text">${debo
    ? 'Anota el dinero que alguien te prestó (con o sin interés) y lleva el control de tus abonos.'
    : 'Anota el dinero que prestaste y ve cómo te lo van abonando.'}</p>
        <button class="btn btn--primary" id="wallet-add-prestamo" type="button">+ ${debo ? 'Anotar una deuda' : 'Prestar dinero'}</button>
      </div>`;
  }

  return `${head}
    <div class="wallet-total">
      <span class="wallet-total__lbl">${debo ? 'Debes en total' : 'Te deben en total'}</span>
      <span class="wallet-total__val num">${esc(formatCOP(total))}</span>
    </div>
    <div class="wallet-prestamos">${activos.map((p) => prestamoHTML(p, debo)).join('')}</div>
    ${saldados.length ? `<p class="wallet-sub wallet-sub--sec">${debo ? 'Pagadas' : 'Saldados'}</p><div class="wallet-prestamos">${saldados.map((p) => prestamoHTML(p, debo)).join('')}</div>` : ''}
    ${cta}`;
}

/* ---- fila de diferido ---- */
function filaDiferidoHTML(d, moneda, cabeza) {
  const meta = [];
  if (d.cuotasPendientes != null) meta.push(`${d.cuotasPendientes} cuotas`);
  if (d.tasaEA != null) meta.push(`${String(d.tasaEA).replace('.', ',')}% EA`);
  let estado;
  if (d.alerta) estado = `<span class="dif-note">⚠ ${esc(d.alerta)}</span>`;
  else if (d.aislable) estado = '<span class="dif-badge dif-badge--ok">Cabeza · se puede aislar</span>';
  else estado = `<span class="dif-badge dif-badge--muted">Detrás de ${esc(cabeza || 'otro con saldo')}</span>`;
  return `
    <div class="dif-row${d.aislable ? ' dif-row--head' : ''}">
      <span class="dif-ord">${d.orden}</span>
      <span class="dif-body">
        <span class="dif-top"><span class="dif-name">${esc(d.descripcion || d.clave)}</span><span class="dif-saldo">${esc(fmtMonto(d.saldoCapital, moneda))}</span></span>
        <span class="dif-meta">${esc(meta.join(' · '))}</span>
        ${estado}
      </span>
    </div>`;
}

/* ---- tarjeta de verificación mes-a-mes ---- */
function verificacionHTML(anterior, ultimo) {
  const cmp = compararCortes(anterior, ultimo);
  if (!cmp.items.length) return '';
  const icono = (est) => (est === 'cerrado' || est === 'abono' || est === 'abono-parcial')
    ? '<span class="vf-ic vf-ic--ok">✓</span>'
    : (est === 'crecio' ? '<span class="vf-ic vf-ic--warn">!</span>' : '<span class="vf-ic vf-ic--n">·</span>');
  const filas = cmp.items.map((it) => `
    <div class="vf-item">${icono(it.estado)}<span class="vf-tx">${esc(it.veredicto)}</span></div>`).join('');
  return `
    <div class="vf-card">
      <div class="vf-head">${ICON_ORB}<h3>Verificación · ${esc(anterior.corte)} → ${esc(ultimo.corte)}</h3></div>
      ${filas}
    </div>`;
}

/* ---- DETALLE ---- */
function detalleHTML(cred, cortes, monedaSel) {
  const grupos = cortesDe(cred, cortes);
  const monedas = Object.keys(grupos);
  const sel = (monedaSel && grupos[monedaSel]) ? monedaSel : (grupos.COP ? 'COP' : monedas[0]);
  const g = sel ? grupos[sel] : null;

  const uid = uidDe(cred);
  const esCred = !cred.franquicia && !cred.ultimosCuatro;
  const logoMini = cred.franquicia ? marcaHTML(cred.franquicia, uid) : (esCred ? '<span class="cc__tag">Crédito</span>' : '');
  const cardMini = `
    <div class="cc ${skinClase(cred)} cc--mini">
      <span class="cc__band">
        <span class="cc__entity">${esc(cred.entidad || '')}</span>
        ${logoMini}
      </span>
      <span class="cc__mini-num">${cred.ultimosCuatro ? '•••• ' + esc(cred.ultimosCuatro) + ' · ' : ''}${esc(productoDe(cred))}</span>
    </div>`;

  const back = `
    <div class="wallet-detalle-top">
      <button class="btn btn--ghost btn--head btn--back" type="button" data-back aria-label="Volver a Mis productos">${ICON_BACK}</button>
      <button class="btn btn--ghost btn--head" type="button" data-editar>Editar</button>
    </div>`;

  if (!g || !g.ultimo) {
    // Sin corte con diferidos: crédito de cuota fija o tarjeta sin diferidos este
    // mes → se muestra el estado del producto con lo que se sabe de la ficha.
    const fila = (et, v) => `<div class="cred-row"><span class="cred-k">${esc(et)}</span><span class="cred-v">${esc(v)}</span></div>`;
    const filas = [
      cred.saldo != null ? fila('Saldo', formatCOP(cred.saldo)) : '',
      Number.isFinite(cred.cuotaMensual) && cred.cuotaMensual > 0 ? fila('Cuota del mes', formatCOP(cred.cuotaMensual)) : '',
      cred.tasaEA != null ? fila('Tasa', `${String(cred.tasaEA).replace('.', ',')}% E.A.`) : '',
      cred.diaPago != null ? fila('Día de pago', String(cred.diaPago)) : '',
    ].filter(Boolean).join('');
    return `${back}${cardMini}
      <div class="dif-tot-label">Estado del producto</div>
      <div class="cred-summary">${filas || '<p class="cred-empty">Aún no registras el saldo ni la cuota.</p>'}</div>
      <p class="dif-hint">Súbele el extracto a <strong>Tu conciencia</strong> para ver diferidos y el seguimiento mes a mes (aplica a tarjetas con compras a cuotas).</p>
      <button class="btn btn--primary btn--block" type="button" data-ir-conciencia>Subir extracto en el chat</button>`;
  }

  const corte = g.ultimo;
  const casc = ordenarPorCascada(corte.diferidos);
  const cabeza = (casc.find((d) => d.saldoCapital > 0) || casc[0] || {}).descripcion || '';
  const filas = casc.map((d) => filaDiferidoHTML(d, sel, cabeza)).join('');

  const seg = monedas.length > 1 ? `
    <div class="dif-seg">${monedas.map((m) => `<button type="button" class="dif-seg__b${m === sel ? ' is-on' : ''}" data-moneda="${esc(m)}">${m === 'USD' ? 'Dólares' : 'Pesos'}</button>`).join('')}</div>` : '';

  const r = corte.resumen || {};
  const pagoTotal = r.pagoTotal ?? r.pagoTotalUSD;
  const pagoPlazos = r.pagoAPlazos ?? r.pagoAPlazosUSD;
  const chips = [];
  if (corte.fechaLimitePago) chips.push(`<span class="dif-chip">Límite <strong>${esc(corte.fechaLimitePago)}</strong></span>`);
  if (Number.isFinite(pagoPlazos)) chips.push(`<span class="dif-chip">Pago a plazos <strong>${esc(fmtMonto(pagoPlazos, sel))}</strong></span>`);
  if (Number.isFinite(pagoTotal)) chips.push(`<span class="dif-chip">Pago total <strong>${esc(fmtMonto(pagoTotal, sel))}</strong></span>`);

  return `${back}${cardMini}
    <div class="dif-tot-label">Total diferido · corte ${esc(corte.corte)}</div>
    <div class="dif-tot">${esc(fmtMonto(totalDiferido(corte.diferidos), sel))}</div>
    ${seg}
    ${chips.length ? `<div class="dif-chips">${chips.join('')}</div>` : ''}
    <h3 class="dif-sec">Cascada de pago <span>más antigua primero</span></h3>
    <div class="dif-flow">${filas}</div>
    ${g.anterior ? verificacionHTML(g.anterior, corte) : ''}`;
}

/* ---- montaje / estado ---- */
async function montar(root) {
  const wallet = root.querySelector('#wallet');
  if (!wallet) return;
  let creditos = [];
  let cortes = [];
  let prestamos = [];

  async function cargar() {
    try {
      [creditos, cortes, prestamos] = await Promise.all([
        getAll('creditos'), getAll('cortes').catch(() => []), getAll('prestamos').catch(() => []),
      ]);
    } catch (err) {
      console.warn('[olbo] no se pudo cargar la cartera:', err);
      wallet.innerHTML = '<p class="hoy-error">No se pudo cargar tu cartera. Reintenta.</p>';
      return false;
    }
    return true;
  }

  function pintarLista() {
    wallet.innerHTML = listaHTML(creditos, cortes, prestamos);
    colocarThumb(wallet, { animar: false, desde: tabPrevio, attr: TAB_ATTR });
    tabPrevio = null;
    const recargar = async () => { await cargar(); pintarLista(); };

    // Volver a Hoy: la cartera es full-screen (sin tab propio), así que necesita
    // su propia salida.
    const inicio = wallet.querySelector('[data-inicio]');
    if (inicio) inicio.addEventListener('click', () => { location.hash = '#/hoy'; });

    // tabs
    wallet.querySelectorAll('[data-tab]').forEach((b) => {
      b.addEventListener('click', () => {
        if (b.dataset.tab === tabActivo) return;
        tabPrevio = tabActivo;
        tabActivo = b.dataset.tab;
        pintarLista();
        const view = wallet.closest('.view');
        if (view) view.scrollTop = 0;
      });
    });

    const add = wallet.querySelector('#wallet-add');
    if (add) add.addEventListener('click', () => abrirCreditos({ onSaved: recargar }));

    const addPre = wallet.querySelector('#wallet-add-prestamo');
    if (addPre) addPre.addEventListener('click', () => abrirNuevoPrestamo({ direccion: tabActivo, onSaved: recargar }));

    wallet.querySelectorAll('[data-abono]').forEach((b) => {
      b.addEventListener('click', () => {
        const p = prestamos.find((x) => x.id === b.dataset.abono);
        if (p) abrirAbono(p, { onSaved: recargar });
      });
    });

    wallet.querySelectorAll('[data-cred]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const c = creditos.find((x) => x.id === btn.dataset.cred);
        if (c) pintarDetalle(c);
      });
    });

    // barras de progreso (se animan por ancho tras pintar)
    wallet.querySelectorAll('.pcard__fill').forEach((el) => {
      requestAnimationFrame(() => { el.style.width = (el.dataset.fill || 0) + '%'; });
    });
  }

  function pintarDetalle(cred, moneda) {
    wallet.innerHTML = detalleHTML(cred, cortes, moneda);
    const view = wallet.closest('.view');
    if (view) view.scrollTop = 0;
    const back = wallet.querySelector('[data-back]');
    if (back) back.addEventListener('click', pintarLista);
    // Editar el producto sin salir de la cartera (misma hoja que vive en Perfil).
    const editar = wallet.querySelector('[data-editar]');
    if (editar) editar.addEventListener('click', () => {
      abrirCreditos({
        creditoId: cred.id,   // entra DIRECTO al formulario de este producto
        onSaved: async () => {
          await cargar();
          const fresco = creditos.find((x) => x.id === cred.id);
          if (fresco) pintarDetalle(fresco, moneda); else pintarLista();
        },
      });
    });
    wallet.querySelectorAll('[data-moneda]').forEach((b) => {
      b.addEventListener('click', () => pintarDetalle(cred, b.dataset.moneda));
    });
    const ir = wallet.querySelector('[data-ir-conciencia]');
    if (ir) ir.addEventListener('click', () => { location.hash = '#/asesor'; });
  }

  if (await cargar()) pintarLista();
}

export default {
  label: 'Mis productos',
  render() {
    return '<div class="wallet" id="wallet"><div class="hoy-skeleton" aria-hidden="true"></div></div>';
  },
  mount(root) { montar(root); },
};
