/* ============================================================
   Bolsillo · views/prestamo-sheet.js
   Bottom-sheets para PRÉSTAMOS (dinero que te deben):
   · abrirNuevoPrestamo → registrar a quién le prestaste y cuánto.
   · abrirAbono → registrar un pago recibido. Baja el saldo del
     préstamo Y crea un movimiento tipo:'ingreso' para que "Tu dinero"
     suba (el desembolso original ya se registró como gasto aparte,
     así que aquí solo entra el dinero que te devuelven).
   Reusa overlay.js (hoja) y las mismas clases de campo que el sueldo.
   ============================================================ */

import { hoja } from '../overlay.js';
import { put, getConfig } from '../db.js';
import { crearMovimiento } from '../model.js';
import { crearPrestamo, agregarAbono, saldoPendiente } from '../prestamos.js';
import { parseCOP, formatCOP } from '../money.js';
import { bindMontosVivos } from '../money-input.js';
import { toast } from '../toast.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (m) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]
));

const ICON_HAND =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11V7a1.5 1.5 0 0 1 3 0v3"/><path d="M7 10V5.5a1.5 1.5 0 0 1 3 0V10"/><path d="M10 9.5a1.5 1.5 0 0 1 3 0V11"/><path d="M13 11V8.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6H9a5 5 0 0 1-3.6-1.5L2.5 15.6a1.5 1.5 0 0 1 2.2-2L7 16"/></svg>';

/** Cuenta por defecto para el ingreso del abono (config o la primera). */
function cuentaDefault(config) {
  const cuentas = Array.isArray(config && config.cuentas) ? config.cuentas : [];
  const d = config && config.cuentaDefault;
  return (d && cuentas.includes(d)) ? d : (cuentas[0] || 'Efectivo');
}

/* ---- alta de préstamo ---- */
function nuevoHTML() {
  return nuevoHTMLDir('me-deben');
}

/** Formulario según la dirección: 'me-deben' (presté) o 'debo' (me prestaron). */
function nuevoHTMLDir(direccion) {
  const debo = direccion === 'debo';
  return `
    <div class="ov-grip" aria-hidden="true"></div>
    <div class="sueldo-head">
      <span class="sueldo-head__ic">${ICON_HAND}</span>
      <div>
        <h3 class="ov-title">${debo ? 'Nueva deuda' : 'Nuevo préstamo'}</h3>
        <p class="sueldo-hint">${debo
    ? 'Dinero que alguien te prestó y tienes que devolver. Aquí llevas el saldo y tus abonos.'
    : 'Dinero que prestaste y te van a devolver. No descuenta tu dinero: el pago ya lo registras como gasto.'}</p>
      </div>
    </div>
    <form class="sueldo-form" id="pre-form" novalidate>
      <label class="field">
        <span class="field__label">${debo ? '¿Quién te prestó?' : '¿A quién le prestaste?'}</span>
        <input class="field__input" id="pre-persona" type="text" autocomplete="off"
          autocapitalize="words" maxlength="40" placeholder="Ej. un familiar" />
      </label>
      <label class="field">
        <span class="field__label">¿Por qué? (opcional)</span>
        <input class="field__input" id="pre-concepto" type="text" autocomplete="off"
          maxlength="80" placeholder="Ej. una emergencia" />
      </label>
      <label class="field">
        <span class="field__label">${debo ? 'Monto que te prestaron' : 'Monto prestado'}</span>
        <input class="field__input" id="pre-monto" type="text" data-monto inputmode="numeric"
          autocomplete="off" placeholder="400.000" />
      </label>
      <label class="field">
        <span class="field__label">Interés % E.A. · opcional</span>
        <input class="field__input" id="pre-tasa" type="number" min="0" max="100" step="0.01"
          inputmode="decimal" placeholder="Sin interés" />
        <span class="sueldo-hint">Si se pactó un interés, escríbelo. Déjalo vacío si es un favor sin intereses.</span>
      </label>
      <button type="submit" class="btn btn--primary btn--block btn--save" id="pre-guardar">${debo ? 'Guardar deuda' : 'Guardar préstamo'}</button>
    </form>`;
}

/**
 * Abre el sheet para crear un préstamo.
 * @param {{onSaved?: () => void}} [opts]
 */
export function abrirNuevoPrestamo({ onSaved, direccion = 'me-deben' } = {}) {
  const debo = direccion === 'debo';
  return hoja(nuevoHTMLDir(direccion), (panel, cerrar) => {
    const $ = (sel) => panel.querySelector(sel);
    bindMontosVivos(panel);
    $('#pre-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const persona = ($('#pre-persona').value || '').trim();
      const monto = parseCOP($('#pre-monto').value);
      if (!persona) { toast(debo ? '¿Quién te prestó?' : '¿A quién le prestaste?'); $('#pre-persona').focus(); return; }
      if (!Number.isInteger(monto) || monto <= 0) { toast('Escribe un monto válido'); $('#pre-monto').focus(); return; }
      try {
        const tasaCruda = ($('#pre-tasa') && $('#pre-tasa').value || '').trim();
        const prestamo = crearPrestamo({
          persona, concepto: ($('#pre-concepto').value || '').trim(), monto,
          direccion, tasaEA: tasaCruda === '' ? null : parseFloat(tasaCruda),
        });
        await put('prestamos', prestamo);
        cerrar(true);
        toast(debo ? `Anotado: le debes ${formatCOP(monto)} a ${esc(persona)}` : `Anotado: ${esc(persona)} te debe ${formatCOP(monto)}`);
        if (typeof onSaved === 'function') onSaved();
      } catch (err) {
        console.warn('[Bolsillo] guardar préstamo falló:', err);
        toast('No se pudo guardar el préstamo');
      }
    });
    requestAnimationFrame(() => $('#pre-persona').focus());
  });
}

/* ---- registrar abono ---- */
function abonoHTML(prestamo, saldo) {
  return `
    <div class="ov-grip" aria-hidden="true"></div>
    <div class="sueldo-head">
      <span class="sueldo-head__ic">${ICON_HAND}</span>
      <div>
        <h3 class="ov-title">Abono de ${esc(prestamo.persona)}</h3>
        <p class="sueldo-hint">Te deben <strong class="num">${esc(formatCOP(saldo))}</strong>${prestamo.concepto ? ' · ' + esc(prestamo.concepto) : ''}. El abono entra como ingreso.</p>
      </div>
    </div>
    <form class="sueldo-form" id="abo-form" novalidate>
      <label class="field">
        <span class="field__label">¿Cuánto te abonó?</span>
        <input class="field__input" id="abo-monto" type="text" data-monto inputmode="numeric"
          autocomplete="off" placeholder="${esc(formatCOP(saldo).replace('$', ''))}" />
      </label>
      <div class="abo-quick">
        <button type="button" class="abo-quick__btn" id="abo-todo">Pagó todo (${esc(formatCOP(saldo))})</button>
      </div>
      <button type="submit" class="btn btn--primary btn--block btn--save" id="abo-guardar">Registrar abono</button>
    </form>`;
}

/**
 * Abre el sheet para abonar a un préstamo. Guarda el abono, recorta al saldo,
 * y crea el ingreso correspondiente para que "Tu dinero" suba.
 * @param {object} prestamo
 * @param {{onSaved?: () => void}} [opts]
 */
export async function abrirAbono(prestamo, { onSaved } = {}) {
  const saldo = saldoPendiente(prestamo);
  if (saldo <= 0) { toast('Ese préstamo ya está saldado'); return; }
  let config = {};
  try { config = await getConfig(); } catch { config = {}; }

  return hoja(abonoHTML(prestamo, saldo), (panel, cerrar) => {
    const $ = (sel) => panel.querySelector(sel);
    bindMontosVivos(panel);
    $('#abo-todo').addEventListener('click', () => {
      $('#abo-monto').value = formatCOP(saldo).replace('$', '');
      $('#abo-monto').dispatchEvent(new Event('input', { bubbles: true }));
    });

    $('#abo-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const monto = parseCOP($('#abo-monto').value);
      if (!Number.isInteger(monto) || monto <= 0) { toast('Escribe un monto válido'); $('#abo-monto').focus(); return; }
      const aplicado = Math.min(monto, saldo); // el ingreso refleja lo que baja la deuda
      try {
        // 1) baja el saldo del préstamo (inmutable)
        const actualizado = agregarAbono(prestamo, { monto: aplicado });
        await put('prestamos', actualizado);
        // 2) el abono ENTRA como ingreso → "Tu dinero" sube
        const ingreso = crearMovimiento({
          tipo: 'ingreso',
          monto: aplicado,
          cuenta: cuentaDefault(config),
          fuente: 'manual',
          comercio: `Abono de ${prestamo.persona}`,
          notas: prestamo.concepto ? `Abono préstamo: ${prestamo.concepto}` : 'Abono de préstamo',
        });
        await put('movimientos', ingreso);
        cerrar(true);
        const resta = saldo - aplicado;
        toast(resta > 0 ? `Abono de ${formatCOP(aplicado)} · quedan ${formatCOP(resta)}` : `¡Saldado! ${esc(prestamo.persona)} te pagó todo`);
        if (typeof onSaved === 'function') onSaved();
      } catch (err) {
        console.warn('[Bolsillo] registrar abono falló:', err);
        toast('No se pudo registrar el abono');
      }
    });
    requestAnimationFrame(() => $('#abo-monto').focus());
  });
}
