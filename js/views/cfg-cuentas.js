/* ============================================================
   Bolsillo · views/cfg-cuentas.js
   CRUD de config.cuentas + ficha por cuenta: tipo (débito/crédito),
   cuenta por defecto y, para tarjetas de crédito, el ciclo
   (día de corte, día límite de pago, tasa %) con un resumen del ciclo.

   Al borrar una cuenta EN USO se advierte con el conteo real de
   movimientos: la cuenta desaparece de la lista pero los
   movimientos NUNCA se tocan (siguen mostrando su cuenta).
   ============================================================ */

import { getConfig, saveConfig, getAll } from '../db.js';
import { confirmar } from '../overlay.js';
import { toast } from '../toast.js';
import { esc } from '../html.js';
import { formatCOP } from '../money.js';
import { resumenTarjeta } from '../budget.js';
import { analizarExtracto } from '../extracto-pdf.js';
import {
  hojaNav, cabecera, bindCabecera, vacioCfg, botonAgregar, leerDia, IC,
} from './cfg-sheet.js';

const CHEV =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>';
const IC_PDF =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/><path d="M8.5 13h1a1.2 1.2 0 0 1 0 2.4h-1V13Zm0 4.5V13"/></svg>';

const MAX_PDF_BYTES = 15 * 1024 * 1024; // 15 MB

/** Abre el selector de archivos, lee un PDF y devuelve {base64, mediaType}
    o {error} o null (cancelado).

    iOS Safari solo abre el picker si `input.click()` corre de forma SÍNCRONA
    dentro del gesto del usuario: por eso quien llame NO debe hacer `await`
    antes de invocar esta función. El input se agrega al DOM (algunos WebKit no
    disparan `change` en inputs desprendidos) y se limpia al terminar. */
function elegirArchivoPDF() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
    input.style.display = 'none';
    const limpiar = () => { input.remove(); };
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) { limpiar(); resolve(null); return; }
      if (file.size > MAX_PDF_BYTES) { limpiar(); resolve({ error: 'El PDF es muy grande (máx 15 MB).' }); return; }
      const reader = new FileReader();
      reader.onload = () => {
        limpiar();
        const m = /^data:([^;]+);base64,(.*)$/.exec(reader.result || '');
        resolve(m ? { mediaType: m[1], base64: m[2] } : { error: 'No se pudo leer el PDF.' });
      };
      reader.onerror = () => { limpiar(); resolve({ error: 'No se pudo leer el PDF.' }); };
      reader.readAsDataURL(file);
    }, { once: true });
    document.body.appendChild(input);
    input.click();
  });
}

/** Formatea 'YYYY-MM-DD' como '5 ago'. */
function fmtFecha(iso) {
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' }).format(new Date(iso + 'T00:00:00'));
}

/** Tarjeta-resumen del ciclo (solo si hay día de corte). */
function resumenCicloHTML(r) {
  if (!r) return '';
  const pago = r.pagoISO
    ? `Se paga el ${fmtFecha(r.pagoISO)}${r.diasParaPago != null ? ` · en ${r.diasParaPago} día${r.diasParaPago !== 1 ? 's' : ''}` : ''}`
    : 'Agrega el día límite de pago';
  const cuotas = r.cuotasActivas > 0
    ? `<p class="tj-res__cuotas">${r.cuotasActivas} compra${r.cuotasActivas > 1 ? 's' : ''} a cuotas · ${esc(formatCOP(r.cuotasMensual))}/mes</p>`
    : '';
  return `
    <div class="tj-res">
      <p class="tj-res__lbl">Este ciclo llevas</p>
      <p class="tj-res__monto num">${esc(formatCOP(r.acumulado))}</p>
      <p class="tj-res__meta">Corta el ${fmtFecha(r.corteISO)} · en ${r.diasParaCorte} día${r.diasParaCorte !== 1 ? 's' : ''}<br/>${pago}</p>
      ${cuotas}
    </div>`;
}

/**
 * Abre la hoja de cuentas.
 * @param {{onSaved?: () => void}} [opts]
 */
export async function abrirCuentas({ onSaved } = {}) {
  let cuentas = [];
  let movimientos = [];
  let meta = {};
  let ctaDefault = null;
  // Se guardan en memoria para poder abrir el file picker del extracto SIN
  // ningún await previo (requisito de iOS Safari; ver elegirArchivoPDF).
  let apiKey = '';
  let modeloExtractos;

  async function recargar() {
    const [cfg, movs] = await Promise.all([getConfig(), getAll('movimientos')]);
    cuentas = Array.isArray(cfg.cuentas) ? cfg.cuentas.slice() : [];
    meta = (cfg.cuentasMeta && typeof cfg.cuentasMeta === 'object') ? cfg.cuentasMeta : {};
    ctaDefault = cfg.cuentaDefault || null;
    movimientos = movs;
    apiKey = typeof cfg.apiKey === 'string' ? cfg.apiKey : '';
    modeloExtractos = cfg.modelos && cfg.modelos.extractos;
  }

  try {
    await recargar();
  } catch (err) {
    console.warn('[Bolsillo] no se pudieron leer las cuentas:', err);
    toast('No se pudieron cargar tus cuentas');
    return;
  }

  const usos = (nombre) => movimientos.filter((m) => m && m.cuenta === nombre).length;
  const esCredito = (nombre) => !!(meta[nombre] && meta[nombre].tipo === 'credito');
  const metaDe = (nombre) => (meta[nombre] && typeof meta[nombre] === 'object' ? meta[nombre] : {});
  const avisar = () => { if (typeof onSaved === 'function') onSaved(); };

  return hojaNav((api) => {
    let agregando = false;

    /* ---- lista de cuentas ---- */
    function pantalla() {
      const filas = cuentas.length
        ? cuentas.map((c) => {
          const n = usos(c);
          const cred = esCredito(c);
          const def = c === ctaDefault;
          const usoTxt = n === 0 ? 'sin movimientos' : `${n} movimiento${n > 1 ? 's' : ''}`;
          const metaTxt = `${cred ? 'Crédito' : 'Débito'}${def ? ' · por defecto' : ''} · ${usoTxt}`;
          return `
            <button type="button" class="cfg-row cfg-row--tap" data-act="detalle" data-nombre="${esc(c)}">
              <span class="cfg-row__body">
                <span class="cfg-row__title">${esc(c)}${def ? ' <span class="cfg-tag">Default</span>' : ''}</span>
                <span class="cfg-row__meta">${metaTxt}</span>
              </span>
              <span class="cfg-row__chev" aria-hidden="true">${CHEV}</span>
            </button>`;
        }).join('')
        : vacioCfg('No tienes cuentas. Agrega al menos una para registrar gastos.');

      const alta = agregando
        ? `<div class="cfg-inline">
             <input type="text" class="field__input" id="cta-nueva" placeholder="Nombre de la cuenta" autocomplete="off" />
             <button type="button" class="btn btn--primary btn--sm" data-act="confirmar">Agregar</button>
           </div>`
        : botonAgregar('Agregar cuenta');

      const html = `
        ${cabecera('Cuentas', { sub: 'Dónde tienes tu plata: efectivo, billeteras y tarjetas.' })}
        <div class="cfg-list">${filas}</div>
        ${alta}`;

      api.pintar(html, (panel) => {
        bindCabecera(panel, { cerrar: () => api.cerrar() });

        const add = panel.querySelector('[data-act="nuevo"]');
        if (add) add.addEventListener('click', () => { agregando = true; pantalla(); });

        const confirmarAlta = panel.querySelector('[data-act="confirmar"]');
        if (confirmarAlta) confirmarAlta.addEventListener('click', agregar);

        const input = panel.querySelector('#cta-nueva');
        if (input) {
          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); agregar(); }
          });
          requestAnimationFrame(() => input.focus());
        }

        panel.querySelectorAll('[data-act="detalle"]').forEach((b) => {
          b.addEventListener('click', () => detalle(b.dataset.nombre));
        });

        async function agregar() {
          const nombre = (panel.querySelector('#cta-nueva').value || '').trim();
          if (!nombre) { agregando = false; pantalla(); return; }
          if (cuentas.some((c) => c.toLowerCase() === nombre.toLowerCase())) {
            toast('Esa cuenta ya existe');
            return;
          }
          try {
            await saveConfig({ cuentas: [...cuentas, nombre] });
            await recargar();
            agregando = false;
            toast('Cuenta agregada');
            avisar();
            pantalla();
          } catch (err) {
            toast('No se pudo agregar: ' + err.message, { icono: false });
          }
        }
      });
    }

    /* ---- ficha de una cuenta (tipo, default, ciclo de tarjeta) ---- */
    function detalle(nombre) {
      const cred = esCredito(nombre);
      const def = nombre === ctaDefault;
      const m = metaDe(nombre);
      const corte = Number.isInteger(m.corte) ? m.corte : '';
      const limite = Number.isInteger(m.limite) ? m.limite : '';
      const tasa = (m.tasa != null && m.tasa !== '') ? m.tasa : '';

      let resumen = '';
      if (cred && Number.isInteger(m.corte)) {
        resumen = resumenCicloHTML(resumenTarjeta({
          movimientos, cuenta: nombre, corteDia: m.corte,
          limiteDia: Number.isInteger(m.limite) ? m.limite : undefined, hoy: new Date(),
        }));
      }

      const ciclo = cred ? `
        <p class="cfg-subhead">Ciclo de la tarjeta</p>
        <button type="button" class="btn btn--ghost btn--block cfg-extracto" data-act="subir-extracto">${IC_PDF}<span>Leer del extracto (PDF)</span></button>
        <p class="cfg-hint" id="tj-extracto-nota"></p>
        <div class="cfg-form">
          <div class="field field--split cfg-field">
            <label class="field__col">
              <span class="field__label">Día de corte</span>
              <input class="field__input" id="tj-corte" type="number" min="1" max="31" inputmode="numeric" placeholder="Ej. 5" value="${esc(corte)}" />
            </label>
            <label class="field__col">
              <span class="field__label">Día límite de pago</span>
              <input class="field__input" id="tj-limite" type="number" min="1" max="31" inputmode="numeric" placeholder="Ej. 25" value="${esc(limite)}" />
            </label>
          </div>
          <label class="field cfg-field">
            <span class="field__label">Tasa mensual (%)</span>
            <input class="field__input" id="tj-tasa" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Ej. 2.1" value="${esc(tasa)}" />
          </label>
        </div>
        <button type="button" class="btn btn--primary btn--block cfg-cta" data-act="guardar-ciclo">Guardar ciclo</button>
        ${resumen}` : '';

      const html = `
        ${cabecera(nombre, { sub: 'Ficha de la cuenta', atras: true })}
        <div class="cfg-list">
          <div class="cfg-row cfg-row--static">
            <span class="cfg-row__body">
              <span class="cfg-row__title">Tarjeta de crédito</span>
              <span class="cfg-row__meta">${cred ? 'Pregunta cuotas y tiene ciclo de pago' : 'Débito / efectivo: sale al instante'}</span>
            </span>
            <span class="switch${cred ? ' is-on' : ''}" role="switch" aria-checked="${cred}" tabindex="0" data-act="toggle-tipo"><span class="switch__dot"></span></span>
          </div>
          <div class="cfg-row cfg-row--static">
            <span class="cfg-row__body">
              <span class="cfg-row__title">Cuenta por defecto</span>
              <span class="cfg-row__meta">${def ? 'Se elige sola al registrar' : 'Actívala para que salga por defecto'}</span>
            </span>
            <span class="switch${def ? ' is-on' : ''}" role="switch" aria-checked="${def}" tabindex="0" data-act="toggle-default"><span class="switch__dot"></span></span>
          </div>
        </div>
        ${ciclo}
        <button type="button" class="btn btn--danger btn--block cfg-danger" data-act="borrar">Eliminar cuenta</button>`;

      api.pintar(html, (panel) => {
        bindCabecera(panel, { atras: () => pantalla(), cerrar: () => api.cerrar() });

        const guardarMeta = async (parcial) => {
          await saveConfig({ cuentasMeta: { [nombre]: { ...metaDe(nombre), ...parcial } } });
          await recargar();
          avisar();
          detalle(nombre);
        };

        panel.querySelector('[data-act="toggle-tipo"]')?.addEventListener('click', () => {
          guardarMeta({ tipo: cred ? 'debito' : 'credito' });
        });

        panel.querySelector('[data-act="toggle-default"]')?.addEventListener('click', async () => {
          await saveConfig({ cuentaDefault: def ? null : nombre });
          await recargar();
          avisar();
          detalle(nombre);
        });

        // Leer el extracto (PDF) con IA → prellena corte/límite/tasa para revisar.
        panel.querySelector('[data-act="subir-extracto"]')?.addEventListener('click', async () => {
          // iOS Safari: el file picker solo abre si input.click() corre SÍNCRONO
          // dentro del gesto del tap, así que NO hacemos ningún await antes de
          // elegir el archivo (la clave y el modelo ya están cargados en memoria).
          if (!apiKey || !apiKey.trim()) {
            toast('Configura tu clave de Anthropic en Perfil → Clave de Anthropic');
            return;
          }
          const picked = await elegirArchivoPDF();
          if (!picked) return;                 // cancelado
          if (picked.error) { toast(picked.error, { icono: false }); return; }

          const btn = panel.querySelector('[data-act="subir-extracto"]');
          const nota = panel.querySelector('#tj-extracto-nota');
          if (btn) { btn.disabled = true; btn.innerHTML = '<span>Leyendo extracto…</span>'; }
          if (nota) { nota.textContent = ''; nota.classList.remove('cfg-hint--err'); }

          const r = await analizarExtracto({
            base64: picked.base64, mediaType: picked.mediaType, apiKey,
            modelo: modeloExtractos,
          });

          if (btn) { btn.disabled = false; btn.innerHTML = `${IC_PDF}<span>Leer del extracto (PDF)</span>`; }

          if (r.estado !== 'ok') {
            if (nota) { nota.textContent = r.mensaje || 'No pude leer el extracto. Ingrésalo a mano.'; nota.classList.add('cfg-hint--err'); }
            return;
          }
          const setV = (sel, v) => { const el = panel.querySelector(sel); if (el && v != null) el.value = v; };
          setV('#tj-corte', r.corte);
          setV('#tj-limite', r.limite);
          setV('#tj-tasa', r.tasa);
          const partes = [];
          if (r.banco) partes.push(r.banco);
          if (r.total != null) partes.push(`total ${formatCOP(r.total)}`);
          if (nota) nota.textContent = `Leído del extracto${partes.length ? ' · ' + partes.join(' · ') : ''}. Revisa y guarda.`;
          toast('Extracto leído — revisa los datos');
        });

        panel.querySelector('[data-act="guardar-ciclo"]')?.addEventListener('click', async () => {
          const corteV = leerDia(panel, '#tj-corte');
          const limiteV = leerDia(panel, '#tj-limite');
          const tasaEl = panel.querySelector('#tj-tasa');
          const tasaV = tasaEl && tasaEl.value.trim() !== '' ? Number(tasaEl.value) : null;
          const nuevo = { ...metaDe(nombre), tipo: 'credito' };
          if (corteV != null) nuevo.corte = corteV; else delete nuevo.corte;
          if (limiteV != null) nuevo.limite = limiteV; else delete nuevo.limite;
          if (tasaV != null && Number.isFinite(tasaV) && tasaV >= 0) nuevo.tasa = tasaV; else delete nuevo.tasa;
          try {
            await saveConfig({ cuentasMeta: { [nombre]: nuevo } });
            await recargar();
            avisar();
            toast('Ciclo guardado');
            detalle(nombre);
          } catch (err) {
            toast('No se pudo guardar: ' + err.message, { icono: false });
          }
        });

        panel.querySelector('[data-act="borrar"]')?.addEventListener('click', () => borrar(nombre));
      });
    }

    async function borrar(nombre) {
      const n = usos(nombre);
      const ok = await confirmar({
        title: `¿Eliminar "${nombre}"?`,
        text: n > 0
          ? `Hay ${n} movimiento${n > 1 ? 's' : ''} registrado${n > 1 ? 's' : ''} con esta cuenta. No se borrarán: solo dejará de aparecer al registrar.`
          : 'Dejará de aparecer al registrar gastos.',
        okText: 'Eliminar', danger: true,
      });
      if (!ok) return;
      try {
        const cambios = { cuentas: cuentas.filter((c) => c !== nombre) };
        if (nombre === ctaDefault) cambios.cuentaDefault = null;
        await saveConfig(cambios);
        await recargar();
        toast('Cuenta eliminada');
        avisar();
        pantalla();
      } catch (err) {
        toast('No se pudo eliminar: ' + err.message, { icono: false });
      }
    }

    pantalla();
  });
}
