// Genera docs/rediseno/mockups/tablero.html (estático, sin style/script inline)
const fs = require('fs');
const OUT = require('path').join(__dirname, 'tablero.html');
const M = '../marca/';

const P = {
  arrowUR: '<path d="M7 17 17 7M8.5 7H17v8.5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  bell: '<path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4.6 1.8 6 1.8 6H4.7s1.8-1.4 1.8-6"/><path d="M10 19.5a2.1 2.1 0 0 0 4 0"/>',
  home: '<path d="M4 10.4 12 4l8 6.4V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z"/>',
  users: '<circle cx="9" cy="8.5" r="3.3"/><path d="M3.3 19.5c.6-3.2 2.9-5 5.7-5s5.1 1.8 5.7 5"/><circle cx="17" cy="9.3" r="2.5"/><path d="M16.3 14.4c2.3.1 4 1.6 4.4 4.3"/>',
  swap: '<path d="M7 7.5h12l-3.2-3.2M17 16.5H5l3.2 3.2"/>',
  user: '<circle cx="12" cy="8.5" r="3.6"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  down: '<path d="M12 5v13M6.5 12.5 12 18l5.5-5.5"/>',
  up: '<path d="M12 19V6M6.5 11.5 12 6l5.5 5.5"/>',
  back: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
  close: '<path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/>',
  dots: '<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>',
  cart: '<path d="M3.5 4.5h2l2.2 10.5h9.6L19.5 8H6.4"/><circle cx="9.5" cy="19" r="1.2"/><circle cx="16.5" cy="19" r="1.2"/>',
  cup: '<path d="M5 9.5h10.5V14a4.5 4.5 0 0 1-4.5 4.5h-1.5A4.5 4.5 0 0 1 5 14z"/><path d="M15.5 10.5h1.3a2.3 2.3 0 0 1 0 4.6h-1.3M8.5 3.8v2.5M12 3.8v2.5"/>',
  ticket: '<path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5v2a2.5 2.5 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5v-2a2.5 2.5 0 0 0 0-5z"/><path d="M14 6v12" stroke-dasharray="1.5 2"/>',
  car: '<path d="M5 16.5V12l1.8-4.2A1.5 1.5 0 0 1 8.2 7h7.6a1.5 1.5 0 0 1 1.4.8L19 12v4.5"/><path d="M4 12h16v4.5H4z"/><circle cx="8" cy="14.3" r=".6"/><circle cx="16" cy="14.3" r=".6"/><path d="M6 16.5V18.5M18 16.5V18.5"/>',
  food: '<path d="M7 3.5v7a2 2 0 0 0 4 0v-7M9 10.5v10M16 20.5v-17c-2 1-3 3.5-3 6.5v3h3"/>',
  bus: '<rect x="5" y="4" width="14" height="13" rx="2.5"/><path d="M5 11h14M8 17v2.5M16 17v2.5"/><circle cx="8.5" cy="14" r=".6"/><circle cx="15.5" cy="14" r=".6"/>',
  bolt: '<path d="M13 3.5 6 13.5h5.5L10.5 20.5l7-10H12z"/>',
  heart: '<path d="M12 19.5s-7-4.3-7-9.5a3.8 3.8 0 0 1 7-2.1A3.8 3.8 0 0 1 19 10c0 5.2-7 9.5-7 9.5"/>',
  ant: '<circle cx="12" cy="7" r="2"/><ellipse cx="12" cy="12.5" rx="2.2" ry="2.6"/><ellipse cx="12" cy="18" rx="2.6" ry="2.4"/><path d="M9.8 11 6.5 9.5M14.2 11l3.3-1.5M9.6 14l-3.6 1.5M14.4 14l3.6 1.5"/>',
  brief: '<rect x="4" y="7.5" width="16" height="11" rx="2"/><path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5M4 12.5h16"/>',
  del: '<path d="M9 6h10a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 18H9l-5.5-6z"/><path d="m11.5 9.5 5 5M16.5 9.5l-5 5"/>',
  cal: '<rect x="4" y="5.5" width="16" height="14" rx="2.5"/><path d="M4 10h16M8.5 3.5v3M15.5 3.5v3"/>',
  chev: '<path d="m7 10 5 5 5-5"/>',
  send: '<path d="M5 12h13.5M13 6.5l5.5 5.5-5.5 5.5"/>',
  clip: '<path d="m19 11.5-6.8 6.8a4.2 4.2 0 0 1-6-6l7.3-7.3a2.8 2.8 0 0 1 4 4l-7.2 7.2a1.4 1.4 0 0 1-2-2l6.6-6.6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6"/>',
  check: '<path d="m5.5 12.5 4 4 9-9"/>',
  wallet: '<path d="M4.5 7.5A2.5 2.5 0 0 1 7 5h10.5v3"/><rect x="4.5" y="8" width="15" height="11" rx="2.5"/><circle cx="15.5" cy="13.5" r="1"/>',
  grid: '<rect x="4.5" y="4.5" width="6" height="6" rx="1.8"/><rect x="13.5" y="4.5" width="6" height="6" rx="1.8"/><rect x="4.5" y="13.5" width="6" height="6" rx="1.8"/><rect x="13.5" y="13.5" width="6" height="6" rx="1.8"/>',
  chart: '<path d="M5 19.5h14M8 16V11M12 16V6.5M16 16v-3.5"/>',
  income: '<path d="M12 4v10M7.5 9.5 12 14l4.5-4.5M5 19.5h14"/>',
};
const ic = (n, c = '') => `<svg class="ico ${c}" viewBox="0 0 24 24" aria-hidden="true">${P[n]}</svg>`;
const T = ' '; // espacio fino
const MINUS = '−';
const cifra = (num, cls, sig = '') => `<span class="cifra ${cls}">${sig ? `<span class="cifra__sig">${sig}</span>` : ''}<span class="cifra__cur">$</span>${T}${num}</span>`;

const statusBar = `
  <div class="sb" aria-hidden="true"><span>9:41</span><span class="sb__ic">
    <svg viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
    <svg viewBox="0 0 16 12"><path d="M8 2.2c2.4 0 4.6.9 6.2 2.5l1.3-1.3A10.6 10.6 0 0 0 8 .3 10.6 10.6 0 0 0 .5 3.4l1.3 1.3A8.8 8.8 0 0 1 8 2.2m0 3.7c1.4 0 2.7.5 3.6 1.4l1.3-1.3A7 7 0 0 0 8 4a7 7 0 0 0-4.9 2l1.3 1.3c.9-.9 2.2-1.4 3.6-1.4m0 3.6c.5 0 1 .2 1.3.5L8 11.8 6.7 10c.3-.3.8-.5 1.3-.5"/></svg>
    <svg viewBox="0 0 27 12"><rect x=".5" y=".5" width="23" height="11" rx="3.5" fill="none" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="18" height="8" rx="2"/><rect x="24.7" y="4" width="1.6" height="4" rx=".8" opacity=".4"/></svg>
  </span></div>`;
const homeInd = '<div class="home-ind" aria-hidden="true"></div>';

function dock(active) {
  const tabs = [['hoy', 'home', 'Hoy'], ['personas', 'users', 'Personas'], ['movimientos', 'swap', 'Movimientos'], ['perfil', 'user', 'Perfil']];
  return `
  <div class="dock-zona">
    <nav class="tabbar vidrio-fuerte" aria-label="Navegación principal">
      ${tabs.map(([r, i, l]) => r === active
        ? `<button class="tab is-active" type="button" aria-current="page">${ic(i)}<span>${l}</span></button>`
        : `<button class="tab" type="button" aria-label="${l}">${ic(i)}</button>`).join('')}
    </nav>
    <button class="fab" type="button" aria-label="Registrar">${ic('plus')}</button>
  </div>`;
}

/* ---------------------------------------------------------------- HOY */
const avance = () => {
  let t = '';
  for (let d = 1; d <= 31; d++) t += `<i class="avance__t${d < 26 ? ' avance__t--ya' : d === 26 ? ' avance__t--hoy' : ''}"></i>`;
  return t;
};
const miniBarras = [10, 16, 12, 22, 8, 18, 26, 14, 20, 30].map((h, i, a) => `<i class="${i === a.length - 1 ? 'on' : ''}" data-h="${h}"></i>`).join('');

const greet = `
  <header class="hoy-greet">
    <div>
      <p class="hoy-greet__name"><b>Hola, Ana.</b><br>Así va tu octubre</p>
    </div>
    <div class="hoy-greet__actions">
      <button class="icon-btn" type="button" aria-label="Tu conciencia financiera"><img class="orbe" src="${M}olbo-simbolo-tinta.svg" alt=""></button>
      <button class="icon-btn" type="button" aria-label="Buscar movimientos">${ic('search')}</button>
      <button class="icon-btn" type="button" aria-label="Notificaciones">${ic('bell')}<span class="notif-badge"></span></button>
    </div>
  </header>`;

const hoyPila = `
  <div class="pila">
    <section class="bcard vidrio">
      <div class="bcard__top"><span class="lbl lbl--tinta">Tu dinero</span><span class="icon-btn icon-btn--s icon-btn--hundido">${ic('arrowUR', 'ico--s')}</span></div>
      <p class="bcard__amt">${cifra('6.248.300', 'cifra--hero')}</p>
      <p class="bcard__delta"><b class="num">${MINUS}$${T}48.500</b> hoy en 2 movimientos</p>
      <div class="avance" aria-label="Día 26 de 31">
        <div class="avance__trazos">${avance()}</div>
        <div class="avance__ejes"><span>1 oct</span><span class="chip-valor avance__hoy">hoy, 26</span><span>31</span></div>
      </div>
    </section>

    <button class="hoy-productos vidrio" type="button">
      <span><span class="hoy-productos__title">Mi cartera</span><span class="hoy-productos__go">Ver mis tarjetas ${ic('send', 'ico--s')}</span></span>
      <span class="hoy-productos__peek" aria-hidden="true"><span class="wcard wcard--1"></span><span class="wcard wcard--2"></span><span class="wcard wcard--3"></span></span>
    </button>

    <div class="seg" role="tablist" aria-label="Secciones de Hoy">
      <span class="seg__thumb" aria-hidden="true"></span>
      <button class="seg__opt is-on" role="tab" aria-selected="true">${ic('grid', 'ico--s')}Resumen</button>
      <button class="seg__opt" role="tab" aria-selected="false">${ic('chart', 'ico--s')}Análisis</button>
    </div>

    <div class="stat-row">
      <div class="stat losa-lila">
        <div class="stat__top"><span class="lbl">Disponible</span><span class="stat__ic">${ic('down', 'ico--s')}</span></div>
        <span class="stat__value">${cifra('1.038.500', 'cifra--tile')}</span>
        <span class="stat__sub num">$${T}173.083 por día</span>
      </div>
      <div class="stat losa-negra">
        <div class="stat__top"><span class="lbl">Gastado</span><span class="stat__ic">${ic('up', 'ico--s')}</span></div>
        <div class="mini-barras" aria-hidden="true">${miniBarras}</div>
        <span class="stat__value">${cifra('1.066.500', 'cifra--tile')}</span>
        <span class="stat__sub">variable este mes</span>
      </div>
    </div>

    <div class="fijos-card vidrio">
      <div><span class="fijos-card__label">Fijos del mes</span><span class="fijos-card__hint">Incluye <span class="num">$${T}620.000</span> de créditos</span></div>
      <span class="fijos-card__val num">$${T}2.095.000</span>
    </div>

    <section class="catcard vidrio">
      <h3 class="titulo-2">En qué se va</h3>
      <p class="catcard__proj">A este ritmo cierras el mes en <span class="num">$${T}3.381.000</span></p>
      <div class="catbar"><span>Mercado</span><span class="num">$${T}412.300</span><span class="catbar__track"><span class="catbar__fill catbar__fill--80"></span></span></div>
      <div class="catbar"><span>Restaurantes</span><span class="num">$${T}268.900</span><span class="catbar__track"><span class="catbar__fill catbar__fill--55"></span></span></div>
      <div class="catbar"><span>Transporte</span><span class="num">$${T}151.000</span><span class="catbar__track"><span class="catbar__fill catbar__fill--30"></span></span></div>
    </section>
  </div>`;

const pantallaHoy = `
  <div class="pantalla" id="p-hoy">
    ${statusBar}${greet}${hoyPila}
    <div class="borde-inf"></div>${dock('hoy')}${homeInd}
  </div>`;

/* ---------------------------------------------------------------- REGISTRAR */
const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'del'];
const cats = [['cart', 'Mercado', 1], ['food', 'Restaurantes'], ['bus', 'Transporte'], ['ant', 'Hormiga'], ['bolt', 'Servicios'], ['heart', 'Salud'], ['ticket', 'Ocio'], ['dots', 'Otros']];
const pantallaReg = `
  <div class="pantalla" id="p-registrar">
    <div class="detras" aria-hidden="true">${statusBar}${greet}${hoyPila}</div>
    <div class="scrim"></div>
    <section class="sheet vidrio-fuerte" role="dialog" aria-label="Nuevo gasto">
      <div class="sheet__grip"></div>
      <div class="sheet__head">
        <button class="icon-btn icon-btn--hundido" type="button" aria-label="Volver">${ic('back')}</button>
        <h2 class="sheet__title">Nuevo gasto</h2>
        <button class="icon-btn icon-btn--hundido" type="button" aria-label="Cerrar">${ic('close')}</button>
      </div>
      <button class="amt" type="button" aria-label="Monto">
        <span>${cifra('48.500', 'cifra--teclado')}<span class="amt__caret"></span></span>
        <span class="amt__meta">${ic('cal', 'ico--s')} Hoy, 26 de octubre · Débito</span>
      </button>
      <div class="keypad">
        ${teclas.map((t) => t === 'del'
          ? `<button class="keypad__key" type="button" aria-label="Borrar">${ic('del', 'ico--l')}</button>`
          : `<button class="keypad__key${t === '000' ? ' keypad__key--txt' : ''}${t === '5' ? ' is-press' : ''}" type="button">${t}</button>`).join('')}
      </div>
      <p class="sec-lbl">Categoría</p>
      <div class="cat-grid">
        ${cats.map(([i, l, s]) => `<button class="cat-chip${s ? ' is-sel' : ''}" type="button">${ic(i)}${l}</button>`).join('')}
      </div>
      <p class="sec-lbl">Detalle</p>
      <div class="field-in"><span class="ph">uniformes, gasolina, dieta…</span></div>
      <div class="detalles-toggle"><span>Detalles · cuenta, fecha…</span>${ic('chev', 'ico--s')}</div>
      <div class="sheet__foot"><button class="btn btn--primary" type="button">Guardar gasto</button></div>
    </section>
    ${homeInd}
  </div>`;

/* ---------------------------------------------------------------- MOVIMIENTOS */
const diario = [40, 22, 0, 64, 30, 18, 52, 12, 0, 34, 26, 44, 20, 48, 30, 0, 18, 26, 38, 60, 22, 14, 30, 8, 24, 36, 0, 0, 0, 0, 0];
const barrasMes = diario.map((h, i) => `<i class="${i === 11 ? 'on' : ''}" data-h="${Math.max(h, 3)}"></i>`).join('');
const row = (i, n, meta, amt, extra = '') => `
  <div class="mov-row">
    <span class="mov-row__icon">${ic(i)}</span>
    <span class="mov-row__bd"><span class="mov-row__name">${n}${extra}</span><span class="mov-row__meta">${meta}</span></span>
    <span class="mov-row__amount num">${amt}</span>
    <button class="mov-row__more" type="button" aria-label="Opciones">${ic('dots', 'ico--s')}</button>
  </div>`;
const pantallaMov = `
  <div class="pantalla" id="p-movimientos">
    ${statusBar}
    <header class="view-head"><h1 class="titulo-1">Movimientos</h1><button class="icon-btn" type="button" aria-label="Notificaciones">${ic('bell')}</button></header>
    <div class="mov-search vidrio">${ic('search')}<span>Buscar concepto, monto, categoría…</span></div>
    <div class="mov-filters">
      <span class="mfilter">${ic('ant', 'ico--s')}Hormiga</span><span class="mfilter__sep"></span>
      <span class="mfilter">Mercado</span><span class="mfilter">Restaurantes</span><span class="mfilter">Transporte</span><span class="mfilter">Ocio</span>
    </div>
    <section class="mes-losa vidrio">
      <div class="mes-losa__top">
        <div><p class="mes-losa__mes">Octubre <span>2026</span></p><p class="mes-losa__amt">${cifra('3.161.500', 'cifra--display')}</p></div>
        <span class="icon-btn icon-btn--s icon-btn--hundido">${ic('arrowUR', 'ico--s')}</span>
      </div>
      <div class="barras" aria-hidden="true"><span class="barras__prom"></span><span class="barras__chip barras__chip--d12 chip-valor num">$${T}230.000</span>${barrasMes}</div>
    </section>
    <div class="dia-head"><span class="dia-head__d">Miércoles, 14 de octubre</span><span class="num">$${T}130.700</span></div>
    <div class="mov-list vidrio">
      ${row('cart', 'Frutas y verduras', 'Mercado · Débito', `${MINUS}$${T}98.700`)}
      ${row('food', 'Almuerzo', 'Restaurantes · Débito', `${MINUS}$${T}32.000`)}
    </div>
    <div class="dia-head"><span>Martes, 13 de octubre</span><span class="num">$${T}15.800</span></div>
    <div class="mov-list vidrio">
      ${row('cup', 'Café', 'Restaurantes · Débito', `${MINUS}$${T}15.800`, '<span class="tag-hormiga">hormiga</span>')}
      ${row('income', 'Pago de un cliente', 'Negocio · Ahorros', `+$${T}850.000`)}
    </div>
    <div class="dia-head"><span>Lunes, 12 de octubre</span><span class="num">$${T}230.000</span></div>
    <div class="mov-list vidrio">${row('ticket', 'Concierto', 'Ocio · Crédito', `${MINUS}$${T}230.000`)}</div>
    <div class="borde-inf"></div>${dock('movimientos')}${homeInd}
  </div>`;

/* ---------------------------------------------------------------- ASESOR */
const ritmo = Array.from({ length: 31 }, (_, i) => `<i class="${i < 26 ? 'on' : ''}"></i>`).join('');
const pantallaAsesor = `
  <div class="pantalla" id="p-asesor">
    ${statusBar}
    <header class="asesor-top">
      <button class="icon-btn" type="button" aria-label="Volver">${ic('back')}</button>
      <h1 class="asesor-top__t">Tu conciencia</h1><span></span>
    </header>
    <div class="asesor-hero">
      <img src="${M}olbo-simbolo-tinta.svg" alt="">
      <p class="asesor-hero__txt">Sin filtro. Te digo la verdad de tus números para que reacciones.</p>
    </div>
    <div class="chat">
      <p class="chat-msg chat-msg--yo">¿Cuánto puedo gastar hoy sin pasarme?</p>
      <div class="chat-msg chat-msg--ia vidrio">
        <p>Hasta esta cifra y cierras octubre en verde. Te quedan 6 días y el mercado ya va en 80 % de lo normal.</p>
        <div class="chat-msg__dato">
          <div>${cifra('38.000', 'cifra--display')}<span class="lbl">para hoy</span></div>
          <span class="pill pill--verde"><span class="pill__dot"></span>Vas bien</span>
        </div>
        <div class="avance ritmo-asesor" aria-hidden="true"><div class="avance__trazos">${avance()}</div><div class="avance__ejes"><span>1 oct</span><span class="chip-valor avance__hoy">hoy, 26</span><span>31</span></div></div>
      </div>
    </div>
    <div class="chat-chips">
      <span class="chat-chip">¿Me alcanza para los créditos?</span>
      <span class="chat-chip">Dime la verdad de mi mes</span>
    </div>
    <div class="composer vidrio-fuerte">
      <button class="icon-btn icon-btn--hundido" type="button" aria-label="Adjuntar">${ic('clip')}</button>
      <span class="composer__ph">Escríbele a tu conciencia…</span>
      <button class="icon-btn icon-btn--negro" type="button" aria-label="Enviar">${ic('send')}</button>
    </div>
    ${homeInd}
  </div>`;

/* ---------------------------------------------------------------- ONBOARDING */
const gauge = (color, pct, valor, caption, cls = '') => {
  const r = 44, c = 2 * Math.PI * r, len = (c * pct).toFixed(1);
  const ang = 2 * Math.PI * pct;
  const tx = (50 + r * Math.cos(ang)).toFixed(2), ty = (50 + r * Math.sin(ang)).toFixed(2);
  return `
    <div class="gauge gauge--${color} ${cls}" role="img" aria-label="${valor} del sueldo. ${caption}">
      <svg class="gauge__svg" viewBox="0 0 100 100" aria-hidden="true">
        <circle class="gauge__track" cx="50" cy="50" r="${r}"/>
        <circle class="gauge__arc" cx="50" cy="50" r="${r}" stroke-dasharray="${len} ${c.toFixed(1)}"/>
        <circle class="gauge__tick" cx="${tx}" cy="${ty}" r="3.2"/>
      </svg>
      <div class="gauge__center"><span class="gauge__value">${valor}<small>%</small></span><span class="gauge__caption">${caption}</span></div>
    </div>`;
};
const pantallaOb = `
  <div class="pantalla pantalla--ob" id="p-onboarding">
    ${statusBar}
    <div class="ob2__top">
      <div class="ob2__dots" aria-label="Paso 1 de 4"><i class="ob2__dot is-on"></i><i class="ob2__dot"></i><i class="ob2__dot"></i><i class="ob2__dot"></i></div>
      <button class="ob2__skip" type="button">Saltar</button>
    </div>
    <h1 class="ob2__title">Que no se te escape ni un peso.</h1>
    <p class="ob2__text">olbo te muestra tu plata en tiempo real. Cada gasto queda anotado antes de que se te olvide.</p>
    <div class="ob2__art vidrio">
      ${gauge('verde', 0.62, '62', 'del sueldo')}
      <span class="pill pill--verde">Vas bien</span>
      <div class="ob2__noti">
        <span class="mov-row__icon">${ic('cup')}</span>
        <span class="mov-row__bd"><span class="mov-row__name">Café</span><span class="mov-row__meta">Anotado hace 2 min</span></span>
        <span class="mov-row__amount num">${MINUS}$${T}15.800</span>
      </div>
    </div>
    <button class="ob2__cta losa-negra" type="button">
      <span><span class="ob2__cta-t">Continuar</span><span class="ob2__cta-s">Paso 1 de 4 · toma 2 minutos</span></span>
      <span class="ob2__cta-go">${ic('send')}</span>
    </button>
    ${homeInd}
  </div>`;

/* ---------------------------------------------------------------- COMPONENTES */
const chartBars = (n, seed, opts = {}) => {
  let s = seed, out = '';
  for (let i = 0; i < n; i++) {
    s = (s * 9301 + 49297) % 233280;
    const h = Math.round(18 + (s / 233280) * 72 + Math.sin(i / 5) * 10);
    const cls = i === opts.on ? 'on' : (opts.lila && opts.lila.includes(i) ? 'lila' : '');
    out += `<i class="${cls}" data-h="${Math.min(100, Math.max(6, h))}"></i>`;
  }
  return out;
};
const panel = `
  <div class="panel" id="p-componentes">
    <div class="col">
      <section class="caja vidrio">
        <p class="caja__lbl">Materiales <span>de más hundido a más opaco</span></p>
        <div class="materiales">
          <div class="mat mat--hundido">Hundido<small>tinta 5 % · sin blur · teclas, inputs</small></div>
          <div class="mat mat--papel">Papel<small>#FFF sólido · íconos de fila, notas</small></div>
          <div class="mat mat--vidrio">Vidrio<small>blanco 62 % · canto 75 % · losas</small></div>
          <div class="mat mat--fuerte">Vidrio fuerte<small>82 % · blur 32 · dock, sheets</small></div>
          <div class="mat losa-negra">Losa negra<small>tinta + brillo radial · 1 por pantalla</small></div>
          <div class="mat losa-lila">Losa lila<small>acento · tinta encima · 1 por pantalla</small></div>
        </div>
      </section>
      <section class="caja vidrio">
        <p class="caja__lbl">Tipografía <span>Urbanist display · Manrope texto</span></p>
        <div class="tipos">
          <div class="tipo">${cifra('6.248.300', 'cifra--hero')}<small>Héroe 56/300</small></div>
          <div class="tipo"><span class="t-display">Display fino</span><small>40/300</small></div>
          <div class="tipo"><span class="t-h1">Título uno</span><small>28/400</small></div>
          <div class="tipo"><span class="t-h2">Título dos</span><small>20/500</small></div>
          <div class="tipo"><span class="t-body">Cuerpo de lectura en Manrope</span><small>16/400</small></div>
          <div class="tipo"><span class="lbl">etiqueta en minúscula, tinta-2</span><small>12/500</small></div>
        </div>
      </section>
    </div>

    <div class="col">
      <section class="caja vidrio">
        <p class="caja__lbl">Gráfica fina <span>barras 1,5 px · promedio punteado · chip negro</span></p>
        <div class="chart">
          <div class="chart__ejes"><span>300k</span><span>150k</span><span>0</span></div>
          <div class="chart__barras">${chartBars(62, 7, {})}</div>
          <span class="chart__prom"></span><span class="chart__guia"></span><span class="chart__punto"></span>
          <span class="chart__chip chip-valor num">$${T}284.000 · 18 oct</span>
          <div class="chart__x"><span>1 sep</span><span>15 sep</span><span>1 oct</span><span>15 oct</span><span>hoy</span></div>
        </div>
      </section>
      <section class="losa-chart losa-negra">
        <p class="caja__lbl"><span class="lbl">Dentro de losa negra, el lila puede ser serie</span><span class="lbl">Flujo neto</span></p>
        <div class="fila">${cifra('1.284.000', 'cifra--display')}<span class="pill pill--verde"><span class="pill__dot"></span>+12 %</span></div>
        <div class="chart">
          <div class="chart__barras">${chartBars(62, 3, { lila: [44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61] })}</div>
        </div>
      </section>
      <section class="caja vidrio">
        <p class="caja__lbl">Semáforo <span>anillo punteado 5 · arco 3 · solo aquí hay color de estado</span></p>
        <div class="gauges">
          ${gauge('verde', 0.48, '48', 'Vas bien', 'gauge--mini')}
          ${gauge('ambar', 0.71, '71', 'Ojo', 'gauge--mini')}
          ${gauge('rojo', 0.93, '93', 'Te pasaste', 'gauge--mini')}
        </div>
        <div class="fila"><span class="pill pill--verde"><span class="pill__dot"></span>Vas bien</span><span class="pill pill--ambar"><span class="pill__dot"></span>Ojo con el ritmo</span><span class="pill pill--rojo"><span class="pill__dot"></span>Te pasaste</span></div>
      </section>
    </div>

    <div class="col">
      <section class="caja vidrio">
        <p class="caja__lbl">Controles</p>
        <div class="seg" role="tablist"><span class="seg__thumb"></span><button class="seg__opt is-on">Gasto</button><button class="seg__opt">Ingreso</button></div>
        <div class="fila">
          <span class="mfilter">Todos</span><span class="cat-chip is-sel">${ic('cart')}Mercado</span><span class="mfilter">Ocio</span>
        </div>
        <div class="fila">
          <span class="icon-btn">${ic('arrowUR')}</span><span class="icon-btn">${ic('gear')}</span><span class="icon-btn icon-btn--hundido">${ic('close')}</span><span class="icon-btn icon-btn--negro">${ic('send')}</span>
          <span class="switch is-on"><span class="switch__dot"></span></span><span class="switch"><span class="switch__dot"></span></span>
        </div>
        <div class="fila"><button class="btn btn--primary btn--sm">Guardar gasto</button><button class="btn btn--ghost btn--sm">Descartar</button></div>
      </section>
      <section class="caja vidrio">
        <p class="caja__lbl">Inputs y avisos</p>
        <div class="field"><span class="field__label">Sueldo mensual</span><span class="field__input field__input--foco num">$${T}4.200.000</span></div>
        <div class="sep"></div>
        <div class="field"><span class="field__label">Detalle</span><span class="field__input field__input--error"><span class="ph">Ej. gasolina</span></span><span class="field__err">Escribe un monto mayor a $${T}0</span></div>
        <div class="sep"></div>
        <div class="toast" role="status"><span class="toast__ic">${ic('check', 'ico--s')}</span>Gasto guardado<span class="toast__act">Deshacer</span></div>
      </section>
      <section class="caja vidrio">
        <p class="caja__lbl">FAB abierto y dock</p>
        <div class="burbujas"><span class="fab-bubble"><span class="fab-bubble__ic">${ic('up', 'ico--s')}</span>Gasto</span><span class="fab-bubble"><span class="fab-bubble__ic">${ic('down', 'ico--s')}</span>Ingreso</span></div>
        <div class="sep"></div>
        <div class="dock-demo">
          <nav class="tabbar vidrio-fuerte"><button class="tab">${ic('home')}</button><button class="tab is-active">${ic('users')}<span>Personas</span></button><button class="tab">${ic('swap')}</button></nav>
          <button class="fab" type="button" aria-label="Cerrar">${ic('close')}</button>
        </div>
      </section>
    </div>
  </div>`;

const html = `<!doctype html>
<html lang="es-CO">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>olbo 2.0 · Tablero UI</title>
<link rel="stylesheet" href="tablero.css">
<link rel="stylesheet" href="tablero-alturas.css">
</head>
<body>
<main class="tablero">
  <header class="tablero__head">
    <div><img class="tablero__marca" src="${M}olbo-lockup-tinta.svg" alt="olbo"><h1 class="tablero__titulo">Sistema UI 2.0</h1></div>
    <p class="tablero__meta">Papel perla, tinta negra y un solo punto lila. Bento a 6 px, losas de 30 px, vidrio claro sobre degradado suave.
    Datos de demo neutros en COP. Fuente: docs/rediseno/SISTEMA-UI.md.</p>
  </header>
  <div class="tablero__fila">
    <div class="marco"><p class="marco__lbl">Hoy<span>resumen</span></p>${pantallaHoy}</div>
    <div class="marco"><p class="marco__lbl">Registrar<span>sheet con teclado</span></p>${pantallaReg}</div>
    <div class="marco"><p class="marco__lbl">Movimientos</p>${pantallaMov}</div>
    <div class="marco"><p class="marco__lbl">Asesor<span>tu conciencia</span></p>${pantallaAsesor}</div>
  </div>
  <div class="tablero__fila">
    <div class="marco"><p class="marco__lbl">Onboarding<span>paso 1</span></p>${pantallaOb}</div>
    <div class="marco"><p class="marco__lbl">Componentes</p>${panel}</div>
  </div>
</main>
</body>
</html>
`;

// Alturas de barras: van como clases utilitarias h-N en un CSS generado (sin style="")
const alturas = new Set();
const final = html.replace(/ data-h="(\d+)"/g, (_, h) => { alturas.add(+h); return ''; })
  .replace(/<i class="([^"]*)"><\/i>/g, (m) => m); // no-op
// segunda pasada: necesitamos asociar altura a cada <i>; reconstruimos con clases
let out = html.replace(/<i class="([^"]*)" data-h="(\d+)"><\/i>/g, (_, c, h) => { alturas.add(+h); return `<i class="${(c + ' h' + h).trim()}"></i>`; });
fs.writeFileSync(OUT, out);
let css = '/* Generado por el tablero: alturas de barras (h<N> = N px en minibarras/mes, N % en gráficas) */\n';
[...alturas].sort((a, b) => a - b).forEach((h) => {
  css += `.mini-barras .h${h}, .barras .h${h} { height: ${h}px; }\n.chart__barras .h${h} { height: ${h}%; }\n`;
});
css += '/* Cascada de entrada + ola de respiración: retraso escalonado por posición */\n';
for (let n = 1; n <= 62; n++) {
  css += `.avance__trazos > i:nth-of-type(${n}), .barras > i:nth-of-type(${n}), .chart__barras > i:nth-of-type(${n}), .mini-barras > i:nth-of-type(${n}) { animation-delay: ${n * 16}ms, ${900 + n * 110}ms; }\n`;
}
fs.writeFileSync(require('path').join(__dirname, 'tablero-alturas.css'), css);
console.log('ok', out.length, alturas.size);
