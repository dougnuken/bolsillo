/* ============================================================
   Bolsillo · views/cfg-creditos.js
   CRUD de los productos de la cartera. Un producto es UNA COSA de una
   entidad, no "un banco": una misma entidad puede tener libre inversión +
   tarjeta + vehículo a la vez. Por eso la lista va AGRUPADA por entidad.

   Dos naturalezas sobre el mismo formulario (model.js · NATURALEZAS):

   · CRÉDITO — tarjeta o préstamo. Tiene tasa, franquicia y últimos 4.
   · SERVICIO — el recibo que llega y vence (luz, agua, gas, internet). NO
     tiene tasa ni franquicia: tiene PROVEEDOR y REFERENCIA DE PAGO, que es
     el número largo que se teclea en el banco.

   No son dos formularios porque son la misma pregunta —qué debo, cuánto y
   cuándo— con distinto vocabulario; y porque un producto puede cambiar de
   naturaleza al editarlo (el modelo se encarga de que la tasa vieja se vaya
   con él). Lo que cambia es qué campos se piden y cómo se llaman.

   Solo se piden 3 datos: entidad, producto y lo que se paga este mes.
   El saldo, la tasa E.A. y el día de pago son OPCIONALES: si no los
   tienes a la mano quedan como "dato pendiente" y los completa la AI
   cuando se le suba el extracto (o el recibo).

   La tasa se captura como EA (%) y se muestra la MV derivada con
   tasaEAaMV() en vivo, que es como la cobra el banco cada mes.
   La vista de estrategias de pago (avalancha / bola de nieve) es T8.
   ============================================================ */

import { getAll, put, del, getConfig } from '../db.js';
import { crearCredito, actualizar, validarCredito, tasaEAaMV, limpiarReferenciaPago } from '../model.js';
import { parseCOP, formatCOP } from '../money.js';
import { confirmar } from '../overlay.js';
import { toast } from '../toast.js';
import { esc } from '../html.js';
import { elegirArchivoPDF, abrirConClave, CANCELADO } from '../pdf-picker.js';
import { paginasAImagenes } from '../pdf-render.js';
import { analizarExtractoImagenes, analizarReciboImagenes } from '../extracto-pdf.js';
import {
  hojaNav, cabecera, bindCabecera, filaCfg, vacioCfg, notaCfg,
  botonAgregar, huecoError, limpiarErrores, pintarErrores, autoLimpiarErrores,
} from './cfg-sheet.js';

/** Alias frecuentes: son atajos para escribir, no una lista cerrada. */
const PRODUCTOS_SUGERIDOS = [
  'Libre inversión', 'Tarjeta de crédito', 'Vehículo', 'Hipotecario', 'Libranza',
];

/** Los servicios de una casa. Mismo papel: atajos, no un enum. */
const SERVICIOS_SUGERIDOS = [
  'Energía', 'Agua', 'Gas', 'Internet', 'Telefonía', 'Televisión',
];

/**
 * El vocabulario de cada naturaleza. Vive en una tabla y no repartido en
 * ternarios por todo el formulario porque son las MISMAS preguntas: cambiar la
 * palabra en un solo sitio es lo que evita que la mitad de la pantalla siga
 * hablando de créditos cuando el usuario ya dijo que es un recibo de la luz.
 */
const COPY = {
  credito: {
    nuevo: 'Nuevo crédito',
    editar: 'Editar crédito',
    natHint: 'Una tarjeta o un préstamo: tiene tasa de interés y un saldo que baja.',
    entidadPh: 'Ej. Bancolombia',
    productoPh: 'Libre inversión',
    productoHint: 'El nombre con el que TÚ lo reconoces. Si tienes varios en el mismo banco, esto los diferencia.',
    montoLabel: 'Cuota de este mes',
    diaLabel: 'Día de pago',
    skinHint: 'Para créditos sin tarjeta (un préstamo, una libranza), deja Franquicia en “—”: se ven como tile de color.',
    advLabel: 'Datos del extracto · opcional',
    advNota: 'Déjalos vacíos si no los tienes a la mano: quedan como dato pendiente y la AI los completa cuando le subas el extracto de este crédito.',
    leer: 'Leer del extracto (PDF)',
    leyendo: 'Leyendo extracto…',
    borrar: 'Eliminar crédito',
    guardado: 'Crédito agregado',
    actualizado: 'Crédito actualizado',
    eliminado: 'Crédito eliminado',
    confirmarBorrar: '¿Eliminar este crédito?',
  },
  servicio: {
    nuevo: 'Nuevo servicio',
    editar: 'Editar servicio',
    natHint: 'Un recibo que llega y vence: luz, agua, gas, internet. No tiene tasa; se paga con una referencia.',
    entidadPh: 'Ej. Air-e',
    productoPh: 'Energía',
    productoHint: 'Cómo lo llamas tú. Si tienes dos del mismo proveedor (internet y TV), esto los diferencia.',
    montoLabel: 'Valor de este mes',
    diaLabel: 'Día límite de pago',
    skinHint: 'Un recibo no tiene plástico: se ve como tile de color con su valor del mes.',
    advLabel: 'Datos del recibo · opcional',
    advNota: 'Déjalos vacíos si no los tienes a la mano: quedan como dato pendiente y la AI los completa cuando le subas el recibo de este servicio.',
    leer: 'Leer el recibo (PDF)',
    leyendo: 'Leyendo recibo…',
    borrar: 'Eliminar servicio',
    guardado: 'Servicio agregado',
    actualizado: 'Servicio actualizado',
    eliminado: 'Servicio eliminado',
    confirmarBorrar: '¿Eliminar este servicio?',
  },
};

/** Campos que viven dentro de la sección plegada de "datos del extracto". */
const CAMPOS_OPCIONALES = ['cre-saldo', 'cre-tasa', 'cre-dia'];

const IC_CHEV_ABAJO =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
const IC_PDF =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg>';

const PENDIENTE = '—';

/** ¿Este producto es un recibo de servicios? PURA. Sin el campo = crédito. */
function esServicio(c) {
  return !!c && c.naturaleza === 'servicio';
}

/** Formatea una tasa a 2 decimales con coma (es-CO). PURA. */
function fmtTasa(n) {
  return Number.isFinite(n) ? n.toFixed(2).replace('.', ',') : '0,00';
}

/** Nombre del producto. Retrocompat: los créditos viejos lo tenían en `tipo`. */
function productoDe(c, porDefecto) {
  if (c && typeof c.producto === 'string' && c.producto.trim()) return c.producto.trim();
  if (c && typeof c.tipo === 'string' && c.tipo.trim()) return c.tipo.trim();
  return porDefecto !== undefined ? porDefecto : (esServicio(c) ? 'Servicio' : 'Crédito');
}

/** Agrupa por entidad SIN mutar la lista original. PURA. */
function agruparPorEntidad(lista) {
  const mapa = new Map();
  lista.forEach((c) => {
    const clave = (c.entidad || 'Sin entidad').trim() || 'Sin entidad';
    mapa.set(clave, [...(mapa.get(clave) || []), c]);
  });
  return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'));
}

/** Línea secundaria de un producto: deja ver qué falta por completar. */
function metaCredito(c) {
  const servicio = esServicio(c);
  const partes = [`${servicio ? 'valor' : 'cuota'} ${formatCOP(c.cuotaMensual)}`];
  partes.push(c.diaPago != null ? `día ${c.diaPago}` : 'día pendiente');
  // Un recibo NO tiene tasa: anunciarla como "pendiente" sería prometer un dato
  // que nunca va a llegar. Lo que sí le falta es con qué número se paga.
  if (servicio) {
    if (c.referenciaPago == null) partes.push('referencia pendiente');
  } else if (c.tasaEA == null) {
    partes.push('tasa pendiente');
  }
  return partes.join(' · ');
}

/** ¿A este producto le falta algún dato del extracto / recibo? PURA. */
function tienePendientes(c) {
  if (esServicio(c)) return c.diaPago == null || c.referenciaPago == null;
  return c.saldo == null || c.tasaEA == null || c.diaPago == null;
}

/**
 * Abre la hoja de créditos y servicios.
 * @param {{onSaved?: () => void, creditoId?: string}} [opts]
 *   creditoId: abre DIRECTO el formulario de ese producto (entrada desde la
 *   cartera, donde el usuario ya eligió cuál). Sin él, abre la lista.
 */
export async function abrirCreditos({ onSaved, creditoId } = {}) {
  let creditos = [];
  // Clave + modelo en memoria: el picker de PDF debe abrir SÍNCRONO en el tap
  // (iOS Safari), sin await previo.
  let apiKey = '';
  let modeloExtractos = null;

  async function recargar() {
    creditos = await getAll('creditos');
  }

  try {
    await recargar();
    const cfg = await getConfig();
    apiKey = (cfg && cfg.apiKey) || '';
    modeloExtractos = cfg && cfg.modelos && cfg.modelos.extractos;
  } catch (err) {
    console.warn('[Bolsillo] no se pudieron leer los créditos:', err);
    toast('No se pudieron cargar tus productos');
    return;
  }

  const avisar = () => { if (typeof onSaved === 'function') onSaved(); };

  return hojaNav((api) => {
    /* ---- lista agrupada por entidad ---- */
    function pantallaLista() {
      const grupos = agruparPorEntidad(creditos);

      const bloques = grupos.map(([entidad, items]) => {
        const cuotaGrupo = items.reduce((s, c) => s + (c.cuotaMensual || 0), 0);
        const filas = items.map((c) => filaCfg({
          id: c.id,
          titulo: productoDe(c),
          meta: metaCredito(c),
          valor: c.saldo != null ? formatCOP(c.saldo) : PENDIENTE,
          accion: 'editar',
        })).join('');

        return `
          <section class="cfg-group">
            <header class="cfg-group__head">
              <h4 class="cfg-group__title">${esc(entidad)}</h4>
              <span class="cfg-group__meta">${items.length === 1 ? '1 producto' : `${items.length} productos`} · <span class="num">${esc(formatCOP(cuotaGrupo))}</span>/mes</span>
            </header>
            <div class="cfg-list">${filas}</div>
          </section>`;
      }).join('');

      const totalCuota = creditos.reduce((s, c) => s + (c.cuotaMensual || 0), 0);
      const conSaldo = creditos.filter((c) => c.saldo != null);
      const totalSaldo = conSaldo.reduce((s, c) => s + c.saldo, 0);

      const sub = creditos.length
        ? `Pagas <strong class="num">${esc(formatCOP(totalCuota))}</strong>/mes${
          conSaldo.length ? ` · saldo conocido <strong class="num">${esc(formatCOP(totalSaldo))}</strong>` : ''}`
        : 'Registra lo que pagas cada mes: créditos del banco y recibos de servicios.';

      const html = `
        ${cabecera('Créditos y servicios', { sub })}
        ${creditos.length ? bloques : `<div class="cfg-list">${vacioCfg('Aún no registras créditos ni servicios.')}</div>`}
        ${creditos.some(tienePendientes)
    ? notaCfg(`Lo que aparece como <strong>${PENDIENTE}</strong> o “pendiente” lo completará la AI cuando le subas el extracto o el recibo.`)
    : ''}
        ${botonAgregar('Agregar producto')}`;

      api.pintar(html, (panel) => {
        bindCabecera(panel, { cerrar: () => api.cerrar() });
        panel.querySelectorAll('[data-act="editar"]').forEach((b) => {
          b.addEventListener('click', () => {
            const c = creditos.find((x) => x.id === b.dataset.id);
            if (c) pantallaForm(c);
          });
        });
        panel.querySelector('[data-act="nuevo"]').addEventListener('click', () => pantallaForm(null));
      });
    }

    /* ---- formulario ---- */
    function pantallaForm(cre) {
      const esNuevo = !cre;
      // Naturaleza VIVA del formulario: manda sobre la guardada en cuanto el
      // usuario toca el segmentado, porque de ella dependen los campos válidos.
      let naturaleza = esServicio(cre) ? 'servicio' : 'credito';
      const t = () => COPY[naturaleza];
      const servicio0 = naturaleza === 'servicio';

      const chips = (lista, id, oculto) => `
        <div class="acct-row acct-row--sug" id="${id}"${oculto ? ' hidden' : ''}>${
  lista.map((p) => `<button type="button" class="acct-chip" data-sugerencia="${esc(p)}">${esc(p)}</button>`).join('')
}</div>`;

      // Si el producto ya trae algún dato del extracto/recibo, la sección
      // arranca abierta.
      const abreOpcionales = !!cre && (cre.saldo != null || cre.tasaEA != null || cre.diaPago != null);

      const html = `
        ${cabecera(esNuevo ? t().nuevo : t().editar, { atras: true })}
        <form class="sueldo-form" id="cre-form" novalidate>
          <div class="field">
            <span class="field__label">¿Qué es?</span>
            <div class="seg seg--dock seg--estatico" role="tablist" id="cre-nat-seg" aria-label="Naturaleza del producto">
              <button type="button" class="seg__opt${servicio0 ? '' : ' is-on'}" role="tab"
                aria-selected="${!servicio0}" data-nat="credito">Crédito</button>
              <button type="button" class="seg__opt${servicio0 ? ' is-on' : ''}" role="tab"
                aria-selected="${servicio0}" data-nat="servicio">Servicio</button>
            </div>
            <span class="sueldo-hint" id="cre-nat-hint">${esc(t().natHint)}</span>
          </div>

          <label class="field">
            <span class="field__label">Entidad</span>
            <input class="field__input" id="cre-entidad" type="text" autocomplete="off"
              placeholder="${esc(t().entidadPh)}" value="${esc(cre ? cre.entidad : '')}" />
            ${huecoError('cre-entidad')}
          </label>

          <label class="field">
            <span class="field__label">Producto</span>
            <input class="field__input" id="cre-producto" type="text" autocomplete="off"
              placeholder="${esc(t().productoPh)}" value="${esc(cre ? productoDe(cre, '') : '')}" />
            ${huecoError('cre-producto')}
            <span class="sueldo-hint" id="cre-producto-hint">${esc(t().productoHint)}</span>
          </label>
          ${chips(PRODUCTOS_SUGERIDOS, 'cre-sug-credito', servicio0)}
          ${chips(SERVICIOS_SUGERIDOS, 'cre-sug-servicio', !servicio0)}

          <label class="field">
            <span class="field__label" id="cre-cuota-label">${esc(t().montoLabel)}</span>
            <input class="field__input" id="cre-cuota" type="text" data-monto inputmode="numeric" autocomplete="off"
              placeholder="850.000" value="${esc(cre ? formatCOP(cre.cuotaMensual).replace('$', '') : '')}" />
            ${huecoError('cre-cuota')}
          </label>

          <div class="field field--split" id="cre-plastico"${servicio0 ? ' hidden' : ''}>
            <label class="field__col">
              <span class="field__label">Últimos 4</span>
              <input class="field__input" id="cre-ult4" type="text" inputmode="numeric" maxlength="4" autocomplete="off"
                placeholder="0832" value="${esc(cre && cre.ultimosCuatro ? cre.ultimosCuatro : '')}" />
            </label>
            <label class="field__col">
              <span class="field__label">Franquicia</span>
              <select class="field__input" id="cre-fr">
                <option value="">—</option>
                <option value="mastercard"${cre && cre.franquicia === 'mastercard' ? ' selected' : ''}>Mastercard</option>
                <option value="visa"${cre && cre.franquicia === 'visa' ? ' selected' : ''}>Visa</option>
                <option value="amex"${cre && cre.franquicia === 'amex' ? ' selected' : ''}>Amex</option>
                <option value="otra"${cre && cre.franquicia === 'otra' ? ' selected' : ''}>Otra</option>
              </select>
            </label>
          </div>

          <div id="cre-servicio-id"${servicio0 ? '' : ' hidden'}>
            <label class="field">
              <span class="field__label">Proveedor · opcional</span>
              <input class="field__input" id="cre-prov" type="text" maxlength="40" autocomplete="off"
                placeholder="Ej. Triple A" value="${esc(cre && cre.proveedor ? cre.proveedor : '')}" />
              ${huecoError('cre-prov')}
              <span class="sueldo-hint">La empresa que presta el servicio. Se ve en la tarjeta de la cartera, donde una tarjeta de crédito muestra su franquicia.</span>
            </label>
            <label class="field">
              <span class="field__label">Referencia de pago · opcional</span>
              <input class="field__input" id="cre-ref" type="text" inputmode="numeric" autocomplete="off"
                placeholder="4900 1234 5678" value="${esc(cre && cre.referenciaPago ? cre.referenciaPago : '')}" />
              ${huecoError('cre-ref')}
              <span class="sueldo-hint">El número largo que se teclea en el banco. Cópialo tal como venga: se guardan solo los dígitos.</span>
            </label>
          </div>

          <label class="field">
            <span class="field__label">Color de la tarjeta · opcional</span>
            <select class="field__input" id="cre-skin">
              <option value="">Automático</option>
              <option value="platino"${cre && cre.skin === 'platino' ? ' selected' : ''}>Plateado (platinum)</option>
              <option value="grafito"${cre && cre.skin === 'grafito' ? ' selected' : ''}>Negro / black</option>
              <option value="gris"${cre && cre.skin === 'gris' ? ' selected' : ''}>Gris grafito</option>
              <option value="azul"${cre && cre.skin === 'azul' ? ' selected' : ''}>Azul</option>
              <option value="teal"${cre && cre.skin === 'teal' ? ' selected' : ''}>Turquesa</option>
              <option value="verde"${cre && cre.skin === 'verde' ? ' selected' : ''}>Verde</option>
              <option value="dorado"${cre && cre.skin === 'dorado' ? ' selected' : ''}>Dorado (gold)</option>
              <option value="naranja"${cre && cre.skin === 'naranja' ? ' selected' : ''}>Naranja</option>
              <option value="rojo"${cre && cre.skin === 'rojo' ? ' selected' : ''}>Rojo</option>
              <option value="rosa"${cre && cre.skin === 'rosa' ? ' selected' : ''}>Rosa</option>
              <option value="olbo"${cre && cre.skin === 'olbo' ? ' selected' : ''}>Morado (olbo)</option>
            </select>
            <span class="sueldo-hint" id="cre-skin-hint">${esc(t().skinHint)}</span>
          </label>

          <button type="button" class="detalles-toggle${abreOpcionales ? ' is-open' : ''}"
            id="cre-adv-toggle" aria-expanded="${abreOpcionales}" aria-controls="cre-adv">
            <span id="cre-adv-label">${esc(t().advLabel)}</span>
            <span class="detalles-toggle__chev">${IC_CHEV_ABAJO}</span>
          </button>

          <div class="sueldo-adv" id="cre-adv"${abreOpcionales ? '' : ' hidden'}>
            ${notaCfg('<span id="cre-adv-nota"></span>')}
            <button type="button" class="btn btn--block cfg-extracto" data-act="subir-extracto">${IC_PDF}<span id="cre-leer-label">${esc(t().leer)}</span></button>
            <p class="cfg-hint" id="cre-extracto-nota"></p>
            <label class="field">
              <span class="field__label">Saldo actual</span>
              <input class="field__input" id="cre-saldo" type="text" data-monto inputmode="numeric" autocomplete="off"
                placeholder="Lo completa la AI" value="${esc(cre && cre.saldo != null ? formatCOP(cre.saldo).replace('$', '') : '')}" />
              ${huecoError('cre-saldo')}
            </label>
            <div class="field field--split${servicio0 ? ' field--solo' : ''}" id="cre-adv-split">
              <label class="field__col" id="cre-tasa-col"${servicio0 ? ' hidden' : ''}>
                <span class="field__label">Tasa E.A. (%)</span>
                <input class="field__input" id="cre-tasa" type="number" min="0" max="100" step="0.01"
                  inputmode="decimal" placeholder="26.5" value="${esc(cre && cre.tasaEA != null ? cre.tasaEA : '')}" />
                ${huecoError('cre-tasa')}
              </label>
              <label class="field__col">
                <span class="field__label" id="cre-dia-label">${esc(t().diaLabel)}</span>
                <input class="field__input" id="cre-dia" type="number" min="1" max="31" inputmode="numeric"
                  placeholder="15" value="${esc(cre && cre.diaPago != null ? cre.diaPago : '')}" />
                ${huecoError('cre-dia')}
              </label>
            </div>
            <p class="cfg-tasa" id="cre-mv-linea"${servicio0 ? ' hidden' : ''}>Mensual vencida equivalente: <strong class="num" id="cre-mv">${
  esc(cre && cre.tasaEA != null ? fmtTasa(tasaEAaMV(cre.tasaEA)) + '%' : PENDIENTE)
}</strong></p>
          </div>

          <button type="submit" class="btn btn--primary btn--block btn--save">Guardar</button>
          ${esNuevo ? '' : '<button type="button" class="btn btn--danger btn--block cfg-danger" data-act="borrar"></button>'}
        </form>`;

      api.pintar(html, (panel) => {
        bindCabecera(panel, { atras: pantallaLista, cerrar: () => api.cerrar() });
        autoLimpiarErrores(panel);

        const inputProducto = panel.querySelector('#cre-producto');
        const inputTasa = panel.querySelector('#cre-tasa');
        const salidaMV = panel.querySelector('#cre-mv');
        const avanzados = panel.querySelector('#cre-adv');
        const toggle = panel.querySelector('#cre-adv-toggle');
        const btnLeer = panel.querySelector('[data-act="subir-extracto"]');
        const btnBorrar = panel.querySelector('[data-act="borrar"]');

        function abrirAvanzados(abrir) {
          avanzados.hidden = !abrir;
          toggle.classList.toggle('is-open', abrir);
          toggle.setAttribute('aria-expanded', String(abrir));
        }
        toggle.addEventListener('click', () => abrirAvanzados(avanzados.hidden));

        const texto = (sel, v) => { const el = panel.querySelector(sel); if (el) el.textContent = v; };

        /* Repinta el formulario con el vocabulario y los campos de la naturaleza
           elegida. No re-renderiza: lo que el usuario ya escribió se queda. */
        function aplicarNaturaleza(nueva) {
          naturaleza = nueva;
          const serv = nueva === 'servicio';

          panel.querySelectorAll('#cre-nat-seg .seg__opt').forEach((o) => {
            const on = o.dataset.nat === nueva;
            o.classList.toggle('is-on', on);
            o.setAttribute('aria-selected', String(on));
          });

          panel.querySelector('#cre-sug-credito').hidden = serv;
          panel.querySelector('#cre-sug-servicio').hidden = !serv;
          panel.querySelector('#cre-plastico').hidden = serv;      // últimos 4 + franquicia
          panel.querySelector('#cre-servicio-id').hidden = !serv;  // proveedor + referencia
          panel.querySelector('#cre-tasa-col').hidden = serv;
          panel.querySelector('#cre-mv-linea').hidden = serv;
          // Con la tasa oculta, el día de pago se queda solo: que ocupe la fila.
          panel.querySelector('#cre-adv-split').classList.toggle('field--solo', serv);

          panel.querySelector('#cre-entidad').placeholder = t().entidadPh;
          inputProducto.placeholder = t().productoPh;
          texto('.cfg-title', esNuevo ? t().nuevo : t().editar);
          texto('#cre-nat-hint', t().natHint);
          texto('#cre-producto-hint', t().productoHint);
          texto('#cre-cuota-label', t().montoLabel);
          texto('#cre-dia-label', t().diaLabel);
          texto('#cre-adv-label', t().advLabel);
          texto('#cre-adv-nota', t().advNota);
          texto('#cre-leer-label', t().leer);
          texto('#cre-skin-hint', t().skinHint);
          if (btnBorrar) btnBorrar.textContent = t().borrar;
        }
        aplicarNaturaleza(naturaleza);

        panel.querySelectorAll('#cre-nat-seg .seg__opt').forEach((opt) => {
          opt.addEventListener('click', () => {
            if (opt.dataset.nat === naturaleza) return;
            limpiarErrores(panel);
            aplicarNaturaleza(opt.dataset.nat);
          });
        });

        // Atajos de producto: rellenan el campo, no lo encierran en una lista.
        panel.querySelectorAll('[data-sugerencia]').forEach((chip) => {
          chip.addEventListener('click', () => {
            inputProducto.value = chip.dataset.sugerencia;
            inputProducto.dispatchEvent(new Event('input', { bubbles: true }));
            inputProducto.focus();
          });
        });

        // MV derivada en vivo mientras se escribe la EA.
        inputTasa.addEventListener('input', () => {
          const ea = parseFloat(inputTasa.value);
          salidaMV.textContent = Number.isFinite(ea) ? fmtTasa(tasaEAaMV(ea)) + '%' : PENDIENTE;
        });

        // Leer extracto o recibo (PDF) con IA. Un crédito prellena saldo / día /
        // tasa; un servicio, proveedor / referencia / valor / fecha límite: son
        // los datos que cada documento sí tiene. Descifra PDFs protegidos
        // localmente (pdf.js).
        btnLeer?.addEventListener('click', async () => {
          // iOS Safari: el picker solo abre si input.click() corre SÍNCRONO en el
          // tap → nada de await antes (apiKey/modelo ya están en memoria).
          if (!apiKey || !apiKey.trim()) { toast('Configura tu clave de Anthropic en Perfil → Conexión con IA'); return; }
          const serv = naturaleza === 'servicio';
          const picked = await elegirArchivoPDF();
          if (!picked) return;
          if (picked.error) { toast(picked.error, { icono: false }); return; }

          const nota = panel.querySelector('#cre-extracto-nota');
          const setBusy = (t2) => { btnLeer.disabled = true; btnLeer.innerHTML = `<span>${esc(t2)}</span>`; };
          const setIdle = () => { btnLeer.disabled = false; btnLeer.innerHTML = `${IC_PDF}<span id="cre-leer-label">${esc(t().leer)}</span>`; };
          const setNota = (t2, err) => { if (nota) { nota.textContent = t2; nota.classList.toggle('cfg-hint--err', !!err); } };
          setNota(''); setBusy('Abriendo PDF…');

          let pdfDoc;
          try { pdfDoc = await abrirConClave(picked.bytes); }
          catch (e) { setIdle(); if (e === CANCELADO) return; setNota('No se pudo abrir el PDF. ¿El archivo es correcto?', true); return; }

          setBusy(t().leyendo);
          let imagenes = [];
          try { imagenes = await paginasAImagenes(pdfDoc); }
          catch { setIdle(); setNota('No se pudo procesar el PDF.', true); return; }
          if (!imagenes.length) { setIdle(); setNota('El PDF no tiene páginas legibles.', true); return; }

          const leer = serv ? analizarReciboImagenes : analizarExtractoImagenes;
          const r = await leer({ imagenes, apiKey, modelo: modeloExtractos });
          setIdle();
          if (r.estado !== 'ok') {
            setNota(r.mensaje || `No pude leer ${serv ? 'el recibo' : 'el extracto'}. Ingrésalo a mano.`, true);
            return;
          }
          if (!r.encontrado) {
            setNota(serv
              ? 'No parece un recibo de servicios. Revísalo o ingrésalo a mano.'
              : 'No parece un extracto de crédito. Revísalo o ingrésalo a mano.', true);
            return;
          }

          const setV = (sel, v) => {
            const el = panel.querySelector(sel);
            if (el && v != null && v !== '') { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }
          };
          const partes = [];

          if (serv) {
            // El valor del recibo ES lo que se paga este mes: va a la cuota, que
            // es el campo que pesa en los fijos del mes y en el semáforo.
            if (r.valor != null) setV('#cre-cuota', formatCOP(r.valor).replace('$', ''));
            if (r.limite != null) { abrirAvanzados(true); setV('#cre-dia', r.limite); }
            if (r.referenciaPago) setV('#cre-ref', r.referenciaPago);
            if (r.proveedor) {
              setV('#cre-prov', r.proveedor);
              // La entidad agrupa la lista y el recibo solo trae una empresa: si
              // el usuario aún no la escribió, esta es. Si ya escribió algo, se
              // respeta — puede haberle puesto otro nombre a propósito.
              const ent = panel.querySelector('#cre-entidad');
              if (ent && !ent.value.trim()) setV('#cre-entidad', r.proveedor);
            }
            if (r.proveedor) partes.push(r.proveedor);
            if (r.valor != null) partes.push(formatCOP(r.valor));
            if (r.limiteISO) partes.push(`paga hasta ${r.limiteISO}`);
            setNota(`Leído del recibo${partes.length ? ' · ' + partes.join(' · ') : ''}. Revisa y guarda.`, false);
            toast('Recibo leído — revisa los datos');
            return;
          }

          abrirAvanzados(true);
          if (r.saldo != null) setV('#cre-saldo', formatCOP(r.saldo).replace('$', ''));
          if (r.limite != null) setV('#cre-dia', r.limite);
          if (r.tasaAnual != null) setV('#cre-tasa', r.tasaAnual);
          if (r.banco) partes.push(r.banco);
          if (r.saldo != null) partes.push(`saldo ${formatCOP(r.saldo)}`);
          setNota(`Leído del extracto${partes.length ? ' · ' + partes.join(' · ') : ''}. Revisa y guarda.`, false);
          toast('Extracto leído — revisa los datos');
        });

        panel.querySelector('#cre-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          limpiarErrores(panel);
          const serv = naturaleza === 'servicio';

          /* --- obligatorios: lo que el usuario sí sabe de memoria --- */
          const errores = [];
          const entidad = panel.querySelector('#cre-entidad').value.trim();
          if (!entidad) errores.push(['cre-entidad', serv ? 'Escribe la empresa del servicio.' : 'Escribe el banco o la entidad.']);

          const producto = inputProducto.value.trim();
          if (!producto) {
            errores.push(['cre-producto', serv
              ? 'Ponle un nombre al servicio. Ej.: Energía.'
              : 'Ponle un nombre al producto. Ej.: Libre inversión.']);
          }

          const cuota = parseCOP(panel.querySelector('#cre-cuota').value);
          if (!Number.isInteger(cuota) || cuota <= 0) {
            errores.push(['cre-cuota', serv ? 'Escribe el valor de este recibo.' : 'Escribe cuánto vas a pagar este mes.']);
          }

          /* --- opcionales: vacío = pendiente; escrito pero ilegible = error --- */
          const brutoSaldo = panel.querySelector('#cre-saldo').value.trim();
          let saldo = null;
          if (brutoSaldo !== '') {
            saldo = parseCOP(brutoSaldo);
            if (!Number.isInteger(saldo) || saldo < 0) {
              errores.push(['cre-saldo', 'No entendí ese saldo. Puedes dejarlo vacío.']);
            }
          }

          // La tasa NO se lee en un servicio aunque el input siga en el DOM con
          // un valor viejo: en un recibo ese dato no existe.
          const brutoTasa = serv ? '' : inputTasa.value.trim();
          let ea = null;
          if (brutoTasa !== '') {
            ea = parseFloat(brutoTasa);
            if (!Number.isFinite(ea) || ea < 0) {
              errores.push(['cre-tasa', 'Esa tasa no se entiende. Puedes dejarla vacía.']);
            }
          }

          const brutoDia = panel.querySelector('#cre-dia').value.trim();
          let dia = null;
          if (brutoDia !== '') {
            dia = parseInt(brutoDia, 10);
            if (!Number.isInteger(dia) || dia < 1 || dia > 31) {
              errores.push(['cre-dia', 'El día debe estar entre 1 y 31.']);
            }
          }

          // La referencia se guarda solo con dígitos, pero si lo escrito no
          // tiene NINGUNO es un error del usuario, no un campo vacío: callarlo
          // guardaría null y el recibo quedaría sin con qué pagarse.
          const brutoRef = serv ? panel.querySelector('#cre-ref').value.trim() : '';
          const referenciaPago = limpiarReferenciaPago(brutoRef);
          if (brutoRef !== '' && referenciaPago == null) {
            errores.push(['cre-ref', 'La referencia son los dígitos del recibo. Puedes dejarla vacía.']);
          }

          if (errores.length) {
            // Si lo que falla está plegado, se abre: nadie corrige lo que no ve.
            if (errores.some(([id]) => CAMPOS_OPCIONALES.includes(id))) abrirAvanzados(true);
            pintarErrores(panel, errores);
            toast('Revisa los campos marcados', { icono: false });
            return;
          }

          const ult4 = panel.querySelector('#cre-ult4').value.trim();
          const franquicia = panel.querySelector('#cre-fr').value || null;
          const skin = panel.querySelector('#cre-skin').value || null;
          const proveedor = panel.querySelector('#cre-prov').value.trim();

          /* Los campos de la OTRA naturaleza se mandan explícitamente en null y
             no se omiten: editar no pasa por crearCredito —actualizar() mezcla
             los cambios sobre lo guardado—, así que omitirlos dejaría viva la
             tasa de un crédito que acaba de volverse recibo de la luz. */
          const campos = {
            entidad,
            producto,
            tipo: producto, // espejo del campo viejo, por compatibilidad
            naturaleza,
            saldo,
            cuotaMensual: cuota,
            tasaEA: serv ? null : ea,
            tasaMV: serv || ea == null ? null : tasaEAaMV(ea),
            diaPago: dia,
            ultimosCuatro: serv ? null : (ult4 || null),
            franquicia: serv ? null : franquicia,
            proveedor: serv ? (proveedor || null) : null,
            referenciaPago: serv ? referenciaPago : null,
            skin,
          };

          try {
            let guardado;
            if (esNuevo) {
              guardado = crearCredito(campos);
            } else {
              guardado = actualizar(cre, campos);
              const v = validarCredito(guardado);
              if (!v.ok) throw new Error(v.errores.join(' '));
            }
            await put('creditos', guardado);
            await recargar();
            toast(esNuevo ? t().guardado : t().actualizado);
            avisar();
            // Si se entró directo a este producto (desde la cartera), guardar
            // CIERRA: mandar a la lista ahí se lee como "no pasó nada".
            if (creditoId) api.cerrar();
            else pantallaLista();
          } catch (err) {
            toast('No se pudo guardar: ' + err.message, { icono: false, ms: 3200 });
          }
        });

        if (btnBorrar) btnBorrar.addEventListener('click', async () => {
          const ok = await confirmar({
            title: t().confirmarBorrar,
            text: `${cre.entidad} · ${productoDe(cre)} · ${formatCOP(cre.cuotaMensual)}.`,
            okText: 'Eliminar', danger: true,
          });
          if (!ok) return;
          try {
            await del('creditos', cre.id);
            await recargar();
            toast(t().eliminado);
            avisar();
            pantallaLista();
          } catch (err) {
            toast('No se pudo eliminar: ' + err.message, { icono: false });
          }
        });

        requestAnimationFrame(() => panel.querySelector('#cre-entidad').focus());
      });
    }

    // Con creditoId (viene de la cartera) se entra directo a editar ese
    // producto; si no existe, cae a la lista en vez de quedar en blanco.
    const directo = creditoId ? creditos.find((c) => c.id === creditoId) : null;
    if (directo) pantallaForm(directo);
    else pantallaLista();
  });
}
