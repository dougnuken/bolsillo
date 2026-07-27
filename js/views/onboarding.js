/* ============================================================
   Bolsillo · views/onboarding.js
   Primer arranque: bienvenida → sueldo → cuentas → gastos fijos → listo.

   Se muestra solo si no hay sueldo de empleado y el usuario no lo ha
   completado/saltado antes (config.onboardingCompletado). Es saltable
   en todo momento y relanzable desde Ajustes.
   ============================================================ */

import { getAll, put, getConfig, saveConfig } from '../db.js';
import { crearIngreso, crearRecurrente, actualizar } from '../model.js';
import { parseCOP, formatCOP } from '../money.js';
import { bindMontosVivos } from '../money-input.js';
import { catalogoVisible } from '../categories.js';
import { toast } from '../toast.js';
import { esc } from '../html.js';

const CUENTAS_SUGERIDAS = ['Efectivo', 'Nequi', 'Bancolombia'];
const INTRO_TOTAL = 4;      // 4 slides de venta (split: hero 3D a sangre + copy)
const TOTAL_PASOS = 5;      // nombre → sueldo → cuentas → fijos → listo

// Confeti del cierre (paso "listo"): 22 piezas cuya posición/color/tiempo viven
// en clases .ob__conf--N de views.css (CSP style-src 'self' bloquea style="").
// Respeta prefers-reduced-motion (allí se ocultan sin animación).
const CONFETI = Array.from({ length: 22 }, (_, i) => `<i class="ob__conf ob__conf--${i + 1}"></i>`).join('');

const IC = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18 9 12l6-6"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  flecha: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
};

/** ¿Debe mostrarse el onboarding? PURA. */
export function debeMostrarse(config, ingresos = []) {
  if (config && config.onboardingCompletado === true) return false;
  const tieneSueldo = Array.isArray(ingresos) && ingresos.some((i) => i && i.fuente === 'empleo');
  return !tieneSueldo;
}

/**
 * Abre el onboarding a pantalla completa.
 * @param {{onDone?: () => void, forzado?: boolean}} [opts]
 */
export async function abrirOnboarding({ onDone, forzado = false } = {}) {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let config, ingresos, recurrentes;
  try {
    [config, ingresos, recurrentes] = await Promise.all([getConfig(), getAll('ingresos'), getAll('recurrentes')]);
  } catch (err) {
    console.warn('[Bolsillo] no se pudo abrir la guía de inicio:', err);
    return;
  }
  if (!forzado && !debeMostrarse(config, ingresos)) return;

  // Estado local del flujo (se persiste paso a paso, no al final).
  const st = {
    fase: 'intro',   // 'intro' (3 slides split) | 'config' (nombre/sueldo/cuentas/fijos/listo)
    introPaso: 0,    // 0=control 1=registro 2=claridad 3=semáforo
    paso: 0,         // índice en PASOS (config)
    nombre: typeof config.nombre === 'string' ? config.nombre : '',
    empleo: ingresos.find((i) => i && i.fuente === 'empleo') || null,
    cuentas: Array.isArray(config.cuentas) && config.cuentas.length ? config.cuentas.slice() : CUENTAS_SUGERIDAS.slice(),
    fijos: recurrentes.slice(),
    agregandoCuenta: false,
    agregandoFijo: false,
    fijoEsVar: false, // segmented del alta de fijo: false=exacto, true=valor variable
  };

  /* ---- montaje ---- */
  const raiz = document.createElement('div');
  raiz.className = 'ob';
  raiz.setAttribute('role', 'dialog');
  raiz.setAttribute('aria-modal', 'true');
  raiz.setAttribute('aria-label', 'Guía de inicio de Bolsillo');
  document.body.appendChild(raiz);
  document.body.dataset.ob = 'open';
  void raiz.offsetWidth;
  raiz.classList.add('is-open');

  // Navegación por teclado en la intro (accesibilidad: alternativa al swipe).
  raiz.addEventListener('keydown', (e) => {
    if (st.fase !== 'intro') return;
    if (e.key === 'ArrowRight') { e.preventDefault(); irIntro(st.introPaso + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); irIntro(st.introPaso - 1); }
  });

  function cerrar() {
    raiz.classList.remove('is-open');
    delete document.body.dataset.ob;
    const quitar = () => raiz.remove();
    if (prefersReduced) quitar();
    else { raiz.addEventListener('transitionend', quitar, { once: true }); setTimeout(quitar, 400); }
  }

  async function terminar() {
    try {
      await saveConfig({ cuentas: st.cuentas, onboardingCompletado: true });
    } catch (err) {
      console.warn('[Bolsillo] no se pudo marcar la guía como completada:', err);
    }
    cerrar();
    if (typeof onDone === 'function') onDone();
  }

  const ir = (n) => { st.paso = n; pintar(); };

  /* ============================================================
     INTRO — 3 slides de bienvenida (layout split): arriba un hero naranja
     sólido con un ícono 3D grande de la funcionalidad; abajo, en el sheet,
     dots + título + texto + CTA. Se avanza con la CTA o deslizando
     (swipe izq/der); "Saltar" salta directo a la configuración. Al terminar
     ("Empezar") continúa a la configuración real (pasoNombre).
     ============================================================ */

  // Slides de venta: hero 3D a sangre completa + copy (título con <b> de énfasis).
  // Cada imagen calza con su funcionalidad; el arco vende control en tiempo real y
  // "que no se te escape ni un peso": cerdo (control) → captura → claridad → semáforo.
  // Renders v3 (set oscuro, alto contraste, barridos de luz) en img/brand-3d/.
  const SLIDES = [
    { img: '10-piggy', title: 'Que no se te <b>escape</b> ni un peso.',
      text: 'Bolsillo te da el control de tu plata en tiempo real. Cada gasto queda registrado antes de que se te olvide.' },
    { img: '15-coins', title: '<b>Captura</b> el gasto en 3 segundos.',
      text: 'Háblale o tómale una foto al recibo y Bolsillo lo anota por ti. Ni una compra se te vuelve a escapar.' },
    { img: '16-coin-spiral', title: 'Mira <b>en qué se va</b> tu mes.',
      text: 'Cada gasto ordenado por categoría y cuenta. En segundos ves a dónde se va tu plata de verdad.' },
    { img: '13-gauge', title: 'Tu ritmo del mes, <b>en vivo.</b>',
      text: 'Un semáforo en tiempo real —verde, ámbar o rojo— te dice al instante cuánto puedes gastar sin tocar lo que viene.' },
  ];

  // Precarga los renders del hero: al deslizar no se ve el fondo un instante.
  SLIDES.forEach((s) => { const im = new Image(); im.src = `./img/brand-3d/${s.img}.jpg`; });

  // Arte 3D a sangre completa del hero (render con su propio fondo de estudio,
  // object-fit: cover). Imagen decorativa → alt="" (el título + texto comunican el
  // significado). draggable=false: el swipe no debe iniciar un arrastre nativo.
  function artHTML(slide) {
    return `<img class="ob2__img" src="./img/brand-3d/${slide.img}.jpg" alt="" draggable="false" />`;
  }

  // Cambia de slide dentro de [0, INTRO_TOTAL-1]; re-pinta (con anim de entrada).
  function irIntro(n) {
    const next = Math.max(0, Math.min(INTRO_TOTAL - 1, n));
    if (next === st.introPaso) return;
    st.introPaso = next;
    pintar();
  }

  // Swipe horizontal (pointer = mouse + touch). Umbral por distancia/dirección
  // para no confundir con scroll ni con un tap en botones. Sin drag-follow, así
  // que no necesita estilos inline (CSP style-src 'self').
  function habilitarSwipe(el) {
    if (!el) return;
    let x0 = null, y0 = null;
    el.addEventListener('pointerdown', (e) => { x0 = e.clientX; y0 = e.clientY; });
    el.addEventListener('pointerup', (e) => {
      if (x0 == null) return;
      const dx = e.clientX - x0, dy = e.clientY - y0;
      x0 = null;
      // Gesto horizontal claro (distancia + dirección); un tap en un botón queda por debajo.
      if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      irIntro(st.introPaso + (dx < 0 ? 1 : -1)); // izquierda→siguiente, derecha→anterior
    });
    el.addEventListener('pointercancel', () => { x0 = null; });
  }

  function entrarConfig() { st.fase = 'config'; st.paso = 0; pintar(); }

  function pintarIntro() {
    const idx = st.introPaso;
    const slide = SLIDES[idx];
    const esUltima = idx === INTRO_TOTAL - 1;
    const teniaFoco = raiz.contains(document.activeElement) && document.activeElement !== raiz && document.activeElement !== document.body;

    const dots = Array.from({ length: INTRO_TOTAL }, (_, i) =>
      `<span class="ob2__dot${i === idx ? ' is-on' : ''}"></span>`).join('');

    raiz.innerHTML = `
      <div class="ob2">
        <div class="ob2__hero">
          <button type="button" class="ob2__skip" data-act="saltar">Saltar</button>
          <div class="ob2__art">${artHTML(slide)}</div>
        </div>
        <div class="ob2__sheet">
          <div class="ob2__dots" role="progressbar" aria-valuenow="${idx + 1}" aria-valuemin="1"
            aria-valuemax="${INTRO_TOTAL}" aria-label="Paso ${idx + 1} de ${INTRO_TOTAL}">${dots}</div>
          <h2 class="ob2__title">${slide.title}</h2>
          <p class="ob2__text">${slide.text}</p>
          <button type="button" class="ob2__cta" data-act="${esUltima ? 'intro-empezar' : 'intro-next'}">
            <span>${esUltima ? 'Empezar' : 'Continuar'}</span>${IC.flecha}
          </button>
        </div>
      </div>`;

    raiz.querySelectorAll('[data-act="saltar"]').forEach((b) => b.addEventListener('click', terminar));
    const next = raiz.querySelector('[data-act="intro-next"]');
    if (next) next.addEventListener('click', () => irIntro(st.introPaso + 1));
    const emp = raiz.querySelector('[data-act="intro-empezar"]');
    if (emp) emp.addEventListener('click', entrarConfig);
    habilitarSwipe(raiz.querySelector('.ob2'));
    // Restaura el foco al CTA tras re-pintar (teclado: Enter/flechas siguen operando).
    if (teniaFoco) { const cta = raiz.querySelector('.ob2__cta'); if (cta) cta.focus(); }
  }

  /* ---- pasos de configuración ---- */
  function pasoNombre() {
    return {
      html: `
        <h1 class="ob__title">¿Cómo te llamas?</h1>
        <p class="ob__text">Para personalizar tu Bolsillo. Solo tu nombre, nada más.</p>
        <label class="field">
          <span class="field__label">Tu nombre</span>
          <input class="field__input" id="ob-nombre" type="text" autocomplete="given-name"
            autocapitalize="words" spellcheck="false" maxlength="40" placeholder="Doug" value="${esc(st.nombre || '')}" />
        </label>`,
      foot: `
        <div class="ob__actions">
          <button type="button" class="btn btn--primary btn--block" data-act="siguiente">Continuar</button>
          <button type="button" class="ob__skip" data-act="saltar">Configurar después</button>
        </div>`,
      bind(cont) {
        const input = cont.querySelector('#ob-nombre');
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); avanzar(); } });
        requestAnimationFrame(() => input.focus());
      },
    };
  }

  function pasoSueldo() {
    const valor = st.empleo ? formatCOP(st.empleo.monto).replace('$', '') : '';
    const dia = st.empleo && st.empleo.diaDelMes ? st.empleo.diaDelMes : '';
    return {
      html: `
        <h1 class="ob__title">¿Cuánto te entra al mes?</h1>
        <p class="ob__text">Tu sueldo de empleado es la base del semáforo. Es el único dato imprescindible.</p>
        <label class="field">
          <span class="field__label">Sueldo mensual</span>
          <input class="field__input ob__input" id="ob-sueldo" type="text" data-monto inputmode="numeric"
            autocomplete="off" placeholder="3.000.000" value="${esc(valor)}" />
        </label>
        <label class="field">
          <span class="field__label">Día de pago</span>
          <input class="field__input" id="ob-dia" type="number" min="1" max="31" inputmode="numeric"
            placeholder="30" value="${esc(dia)}" />
        </label>`,
      foot: `
        <div class="ob__actions">
          <button type="button" class="btn btn--primary btn--block" data-act="siguiente">Continuar</button>
          <button type="button" class="ob__skip" data-act="saltar">Configurar después</button>
        </div>`,
      bind(cont) {
        const input = cont.querySelector('#ob-sueldo');
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); avanzar(); } });
        requestAnimationFrame(() => input.focus());
      },
    };
  }

  function pasoCuentas() {
    const chips = st.cuentas.map((c) => `
      <span class="ob__chip">
        <span>${esc(c)}</span>
        <button type="button" class="ob__chip-x" data-quitar="${esc(c)}" aria-label="Quitar ${esc(c)}">${IC.x}</button>
      </span>`).join('');

    const alta = st.agregandoCuenta
      ? `<div class="cfg-inline">
           <input type="text" class="field__input" id="ob-cuenta" placeholder="Nombre de la cuenta" autocomplete="off" />
           <button type="button" class="btn btn--primary btn--sm" data-act="add-cuenta">Agregar</button>
         </div>`
      : `<button type="button" class="ob__add" data-act="nueva-cuenta">${IC.plus}<span>Agregar otra</span></button>`;

    return {
      html: `
        <h1 class="ob__title">¿Dónde tienes tu plata?</h1>
        <p class="ob__text">Estas son las cuentas que usarás al registrar un gasto. Quita las que no uses.</p>
        <div class="ob__chips">${chips || '<p class="cfg-empty">Sin cuentas: agrega al menos una.</p>'}</div>
        ${alta}`,
      foot: `
        <div class="ob__actions">
          <button type="button" class="btn btn--primary btn--block" data-act="siguiente">Continuar</button>
        </div>`,
      bind(cont) {
        cont.querySelectorAll('[data-quitar]').forEach((b) => {
          b.addEventListener('click', () => {
            st.cuentas = st.cuentas.filter((c) => c !== b.dataset.quitar);
            pintar();
          });
        });
        const nueva = cont.querySelector('[data-act="nueva-cuenta"]');
        if (nueva) nueva.addEventListener('click', () => { st.agregandoCuenta = true; pintar(); });

        const add = cont.querySelector('[data-act="add-cuenta"]');
        const input = cont.querySelector('#ob-cuenta');
        if (add) add.addEventListener('click', agregarCuenta);
        if (input) {
          input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); agregarCuenta(); } });
          requestAnimationFrame(() => input.focus());
        }

        function agregarCuenta() {
          const nombre = (input.value || '').trim();
          if (!nombre) { st.agregandoCuenta = false; pintar(); return; }
          if (st.cuentas.some((c) => c.toLowerCase() === nombre.toLowerCase())) { toast('Esa cuenta ya está'); return; }
          st.cuentas = [...st.cuentas, nombre];
          st.agregandoCuenta = false;
          pintar();
        }
      },
    };
  }

  function pasoFijos() {
    const lista = st.fijos.length
      ? `<div class="ob__chips">${st.fijos.map((f) => {
        const val = f.esVariable
          ? (Number.isInteger(f.montoEstimado) ? '≈ ' + formatCOP(f.montoEstimado) : 'variable')
          : formatCOP(f.monto);
        return `<span class="ob__chip ob__chip--dato">${esc(f.nombre)} · <span class="num">${esc(val)}</span></span>`;
      }).join('')}</div>`
      : '';

    const cats = catalogoVisible().map((c) => `<option value="${esc(c.id)}"${c.id === 'vivienda' ? ' selected' : ''}>${esc(c.label)}</option>`).join('');
    const esVar = st.fijoEsVar;

    const form = st.agregandoFijo
      ? `<div class="ob__form">
           <label class="field">
             <span class="field__label">Nombre</span>
             <input class="field__input" id="ob-fijo-nombre" type="text" placeholder="${esVar ? 'Luz' : 'Arriendo'}" autocomplete="off" />
           </label>
           <div class="field">
             <span class="field__label">¿Su valor es siempre igual o cambia?</span>
             <div class="seg" role="tablist" id="ob-fijo-seg" aria-label="Tipo de valor del gasto fijo">
               <button type="button" class="seg__opt${esVar ? '' : ' is-on'}" role="tab" aria-selected="${!esVar}" data-var="0">Fijo exacto</button>
               <button type="button" class="seg__opt${esVar ? ' is-on' : ''}" role="tab" aria-selected="${esVar}" data-var="1">Valor variable</button>
             </div>
           </div>
           <div class="field field--split">
             <label class="field__col">
               <span class="field__label" id="ob-fijo-monto-label">${esVar ? '¿Cuánto suele ser? (opcional)' : 'Monto'}</span>
               <input class="field__input" id="ob-fijo-monto" type="text" data-monto inputmode="numeric" placeholder="${esVar ? 'Opcional' : '1.800.000'}" autocomplete="off" />
             </label>
             <label class="field__col">
               <span class="field__label">Día</span>
               <input class="field__input" id="ob-fijo-dia" type="number" min="1" max="31" inputmode="numeric" placeholder="5" />
             </label>
           </div>
           <label class="field">
             <span class="field__label">Categoría</span>
             <select class="field__input field__select" id="ob-fijo-cat">${cats}</select>
           </label>
           <button type="button" class="btn btn--ghost btn--block cfg-cta" data-act="add-fijo">Agregar gasto fijo</button>
         </div>`
      : `<button type="button" class="ob__add" data-act="nuevo-fijo">${IC.plus}<span>Agregar un gasto fijo</span></button>`;

    return {
      html: `
        <h1 class="ob__title">¿Qué pagas <em>sí o sí</em> cada mes?</h1>
        <p class="ob__text">Tu checklist de gastos fijos: arriendo, colegio, seguros, suscripciones… y también los que cambian de valor (luz, agua, gasolina, celular). Bolsillo los tiene en cuenta al calcular lo que te queda.</p>
        <p class="ob__text ob__text--sm">Si el monto es siempre igual, ponlo. Si cambia cada mes, márcalo como <strong>valor variable</strong> y Bolsillo te preguntará el valor real cada mes. Este paso es opcional, puedes saltarlo.</p>
        ${lista}
        ${form}`,
      foot: `
        <div class="ob__actions">
          <button type="button" class="btn btn--primary btn--block" data-act="siguiente">
            ${st.fijos.length ? 'Continuar' : 'Lo hago después'}
          </button>
        </div>`,
      bind(cont) {
        const nuevo = cont.querySelector('[data-act="nuevo-fijo"]');
        if (nuevo) nuevo.addEventListener('click', () => { st.agregandoFijo = true; st.fijoEsVar = false; pintar(); });

        // segmented Fijo exacto / Valor variable (muta el DOM sin re-pintar para no
        // perder lo tecleado en nombre/día).
        const seg = cont.querySelector('#ob-fijo-seg');
        if (seg) seg.querySelectorAll('.seg__opt').forEach((opt) => {
          opt.addEventListener('click', () => {
            const quiereVar = opt.dataset.var === '1';
            if (quiereVar === st.fijoEsVar) return;
            st.fijoEsVar = quiereVar;
            seg.querySelectorAll('.seg__opt').forEach((o) => {
              const on = o === opt;
              o.classList.toggle('is-on', on);
              o.setAttribute('aria-selected', String(on));
            });
            cont.querySelector('#ob-fijo-monto-label').textContent = quiereVar ? '¿Cuánto suele ser? (opcional)' : 'Monto';
            cont.querySelector('#ob-fijo-monto').placeholder = quiereVar ? 'Opcional' : '1.800.000';
          });
        });

        const add = cont.querySelector('[data-act="add-fijo"]');
        if (add) add.addEventListener('click', async () => {
          const nombre = (cont.querySelector('#ob-fijo-nombre').value || '').trim();
          const montoCampo = parseCOP(cont.querySelector('#ob-fijo-monto').value);
          const dia = parseInt(cont.querySelector('#ob-fijo-dia').value, 10);
          const esVariable = st.fijoEsVar;
          if (!nombre) { toast('Escribe un nombre'); return; }
          // Exacto: monto obligatorio. Variable: opcional (solo referencia).
          if (!esVariable && (!Number.isInteger(montoCampo) || montoCampo <= 0)) { toast('Escribe un monto válido'); return; }
          if (!Number.isInteger(dia) || dia < 1 || dia > 31) { toast('El día debe estar entre 1 y 31'); return; }
          const cuenta = st.cuentas[0];
          if (!cuenta) { toast('Necesitas al menos una cuenta'); return; }

          try {
            const rec = crearRecurrente({
              nombre, diaDelMes: dia,
              esVariable,
              monto: esVariable ? null : montoCampo,
              montoEstimado: esVariable ? montoCampo : null,
              categoria: cont.querySelector('#ob-fijo-cat').value,
              cuenta, modo: 'confirmar', activo: true,
            });
            await put('recurrentes', rec);
            st.fijos = [...st.fijos, rec];
            st.agregandoFijo = false;
            st.fijoEsVar = false;
            toast('Gasto fijo agregado');
            pintar();
          } catch (err) {
            toast('No se pudo agregar: ' + err.message, { icono: false, ms: 3200 });
          }
        });

        const primero = cont.querySelector('#ob-fijo-nombre');
        if (primero) requestAnimationFrame(() => primero.focus());
      },
    };
  }

  function pasoListo() {
    const sueldo = st.empleo ? formatCOP(st.empleo.monto) : '—';
    const fijos = st.fijos.filter((f) => f.activo).reduce((s, f) => s + (f.monto || 0), 0);
    return {
      html: `
        <div class="ob__celebra">
          <span class="ob__confeti" aria-hidden="true">${CONFETI}</span>
          <span class="ob__celebra-ring" aria-hidden="true"></span>
          <img class="ob__celebra-coin" src="./img/empty-states/coin-check.png" alt="" aria-hidden="true" />
        </div>
        <h1 class="ob__title">¡Listo${st.nombre ? ', ' + esc(st.nombre) : ''}! Ya puedes empezar</h1>
        <p class="ob__text">Con esto el semáforo ya sabe calcular tu ritmo del mes.</p>
        <div class="ob__resumen">
          <div class="ob__resumen-row"><span>Sueldo</span><strong class="num">${esc(sueldo)}</strong></div>
          <div class="ob__resumen-row"><span>Cuentas</span><strong>${esc(String(st.cuentas.length))}</strong></div>
          <div class="ob__resumen-row"><span>Gastos fijos</span><strong class="num">${esc(fijos ? formatCOP(fijos) : 'Ninguno')}</strong></div>
        </div>
        <p class="ob__text ob__text--sm">Toca el botón <strong>+</strong> para registrar tu primer gasto. Todo lo demás lo cambias en Ajustes.</p>`,
      foot: `
        <div class="ob__actions">
          <button type="button" class="btn btn--primary btn--block" data-act="terminar">Ir a mi bolsillo</button>
        </div>`,
      bind() {},
    };
  }

  const PASOS = [pasoNombre, pasoSueldo, pasoCuentas, pasoFijos, pasoListo];

  /* ---- avanzar (con persistencia del paso actual) ---- */
  async function avanzar() {
    if (st.paso === 0) {
      const cont = raiz.querySelector('.ob__step');
      const nombre = (cont.querySelector('#ob-nombre').value || '').trim();
      if (!nombre) {
        toast('Escribe tu nombre para continuar');
        cont.querySelector('#ob-nombre').focus();
        return;
      }
      st.nombre = nombre;
      try {
        await saveConfig({ nombre });
      } catch (err) {
        toast('No se pudo guardar tu nombre: ' + err.message, { icono: false, ms: 3200 });
        return;
      }
    }

    if (st.paso === 1) {
      const cont = raiz.querySelector('.ob__step');
      const monto = parseCOP(cont.querySelector('#ob-sueldo').value);
      if (!Number.isInteger(monto) || monto <= 0) {
        toast('Escribe tu sueldo para continuar');
        cont.querySelector('#ob-sueldo').focus();
        return;
      }
      let dia = parseInt(cont.querySelector('#ob-dia').value, 10);
      if (!Number.isInteger(dia) || dia < 1 || dia > 31) dia = (st.empleo && st.empleo.diaDelMes) || 30;
      try {
        const ingreso = st.empleo
          ? actualizar(st.empleo, { monto, diaDelMes: dia })
          : crearIngreso({ fuente: 'empleo', monto, diaDelMes: dia });
        await put('ingresos', ingreso);
        st.empleo = ingreso;
      } catch (err) {
        toast('No se pudo guardar el sueldo: ' + err.message, { icono: false, ms: 3200 });
        return;
      }
    }

    if (st.paso === 2) {
      if (!st.cuentas.length) { toast('Agrega al menos una cuenta'); return; }
      try {
        await saveConfig({ cuentas: st.cuentas });
      } catch (err) {
        toast('No se pudieron guardar las cuentas: ' + err.message, { icono: false });
        return;
      }
    }

    ir(Math.min(st.paso + 1, TOTAL_PASOS - 1));
  }

  /* ---- pintado ---- */
  function pintar() {
    if (st.fase === 'intro') { pintarIntro(); return; }

    const { html, foot, bind } = PASOS[st.paso]();

    // Back visible en todos los pasos menos el resumen final. En el primer paso
    // (nombre) retrocede a la intro; en los demás, al paso anterior.
    const mostrarBack = st.paso < TOTAL_PASOS - 1;

    // Armazón persistente: se construye una sola vez al entrar a la config. Mantener
    // vivos los dots (no recrearlos) deja que animen el pill↔círculo entre pasos.
    let shell = raiz.querySelector('.ob__shell');
    if (!shell) {
      raiz.innerHTML = `
        <div class="ob__shell">
          <div class="ob__bar"></div>
          <div class="ob__scroll"></div>
          <div class="ob__foot">
            <div class="ob__steps" role="progressbar" aria-valuemin="1" aria-valuemax="${TOTAL_PASOS}">${
  Array.from({ length: TOTAL_PASOS }, () => '<span class="ob__dot"></span>').join('')}</div>
            <div class="ob__foot-actions"></div>
          </div>
        </div>`;
      shell = raiz.querySelector('.ob__shell');
    }

    // Barra superior: solo el back (o vacía en el resumen final).
    shell.querySelector('.ob__bar').innerHTML = mostrarBack
      ? `<button type="button" class="icon-btn ob__back" data-act="atras" aria-label="Volver">${IC.back}</button>`
      : '';

    // Dots: solo togglear clases → la transición CSS anima el pill↔círculo.
    const steps = shell.querySelector('.ob__steps');
    steps.setAttribute('aria-valuenow', String(st.paso + 1));
    steps.setAttribute('aria-label', `Paso ${st.paso + 1} de ${TOTAL_PASOS}`);
    steps.querySelectorAll('.ob__dot').forEach((d, i) => {
      d.classList.toggle('is-on', i === st.paso);
      d.classList.toggle('is-done', i < st.paso);
    });

    // Contenido del paso: elemento nuevo cada vez → entra limpio (fade + rise).
    shell.querySelector('.ob__scroll').innerHTML = `<div class="ob__step">${html}</div>`;
    const cont = shell.querySelector('.ob__step');
    if (!prefersReduced) {
      requestAnimationFrame(() => cont.classList.add('is-in'));
    } else {
      cont.classList.add('is-in');
    }

    // Acciones del footer (CTA + saltar).
    shell.querySelector('.ob__foot-actions').innerHTML = foot || '';

    const atras = raiz.querySelector('[data-act="atras"]');
    if (atras) atras.addEventListener('click', () => {
      if (st.paso === 0) { st.fase = 'intro'; st.introPaso = INTRO_TOTAL - 1; pintar(); }
      else ir(Math.max(0, st.paso - 1));
    });

    const sig = raiz.querySelector('[data-act="siguiente"]');
    if (sig) sig.addEventListener('click', avanzar);

    const fin = raiz.querySelector('[data-act="terminar"]');
    if (fin) fin.addEventListener('click', terminar);

    raiz.querySelectorAll('[data-act="saltar"]').forEach((b) => b.addEventListener('click', terminar));

    // Máscara de miles: cubre el sueldo (paso 1) y el gasto fijo (paso 3).
    bindMontosVivos(cont);
    if (typeof bind === 'function') bind(cont);
  }

  pintar();
}
