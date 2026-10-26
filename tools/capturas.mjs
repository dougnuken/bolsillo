// Capturas de olbo con datos de demo neutros (sin nombres ni montos reales: solo placeholders y
// cifras redondas plausibles; CLAUDE.md §6.1).
// Uso: node tools/capturas.mjs <dir-salida> [--scale 3] [--puerto 4151] [--statusbar] [--formato png|jpg]
//   --scale N      factor de pixel (3 → 1179×2556 para portafolio)
//   --statusbar    simula la safe-area del iPhone (59 pt arriba, 34 abajo) y dibuja una barra de estado
//                  9:41 como overlay SOLO en la captura (nunca toca la app)
//   --formato      png (default) o jpg (calidad 92, pesa ~5× menos)
// Sirve el repo con un servidor estático propio, siembra IndexedDB y captura cada vista a 393×852.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const out = resolve(args[0] && !args[0].startsWith('--') ? args[0] : 'capturas');
const scale = Number(opt('--scale')) || 2;
const puerto = Number(opt('--puerto')) || 4151;
const statusbar = args.includes('--statusbar');
const formato = opt('--formato') === 'jpg' ? 'jpg' : 'png';
const raiz = resolve(new URL('..', import.meta.url).pathname);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };

const server = createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try {
    const f = join(raiz, p.endsWith('/') ? p + 'index.html' : p);
    const buf = await readFile(f);
    res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' });
    res.end(buf);
  } catch { res.writeHead(404); res.end(); }
}).listen(puerto);

/* ---------- datos de demo ---------- */
const hoy = new Date();
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
/** Fecha del mes `atras` meses atrás, día `d` (si es el mes actual, no pasa de hoy). */
function fecha(atras, d) {
  const base = new Date(hoy.getFullYear(), hoy.getMonth() - atras, 1);
  const dias = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  const tope = atras === 0 ? hoy.getDate() : dias;
  return iso(base.getFullYear(), base.getMonth() + 1, Math.min(d, tope));
}
// [día, monto, categoría, comercio, esFijo]
const MES_ACTUAL = [
  [1, 1850000, 'vivienda', 'Arriendo', true], [2, 145000, 'servicios', 'Internet y celular', true],
  [3, 186400, 'mercado', 'Supermercado'], [4, 38000, 'restaurantes', 'Almuerzo'], [5, 95000, 'transporte', 'Gasolina'],
  [6, 12500, 'restaurantes', 'Café'], [7, 64900, 'ocio', 'Cine'], [8, 142300, 'mercado', 'Mercado de la semana'],
  [9, 8900, 'restaurantes', 'Panadería'], [10, 120000, 'salud', 'Droguería'], [11, 54000, 'transporte', 'Parqueadero'],
  [12, 230000, 'ocio', 'Concierto'], [13, 15800, 'restaurantes', 'Café'], [14, 98700, 'mercado', 'Frutas y verduras'],
  [15, 300000, 'persona1', 'Mesada'], [16, 85000, 'persona2', 'Regalo de cumpleaños'], [18, 17500, 'restaurantes', 'Café'],
  [19, 68000, 'transporte', 'Taxi y peajes'], [21, 112000, 'mercado', 'Mercado'], [22, 42000, 'restaurantes', 'Cena'],
  [23, 9800, 'restaurantes', 'Café'], [24, 150000, 'persona3', 'Uniformes'], [25, 36000, 'ocio', 'Streaming'],
  [26, 14500, 'restaurantes', 'Almuerzo'], [26, 23000, 'transporte', 'Gasolina'],
];
const MES_PREVIO = [
  [1, 1850000, 'vivienda', 'Arriendo', true], [2, 145000, 'servicios', 'Internet y celular', true], [4, 210000, 'mercado', 'Mercado'],
  [7, 380000, 'ocio', 'Salida de fin de semana'], [10, 120000, 'transporte', 'Gasolina'], [12, 95000, 'salud', 'Consulta'],
  [15, 300000, 'persona1', 'Mesada'], [17, 240000, 'mercado', 'Mercado'], [20, 160000, 'restaurantes', 'Restaurantes'],
  [24, 70000, 'ocio', 'Libros'], [27, 190000, 'mercado', 'Mercado'],
];
const MES_ANTE = [
  [1, 1850000, 'vivienda', 'Arriendo', true], [2, 140000, 'servicios', 'Internet y celular', true], [5, 230000, 'mercado', 'Mercado'],
  [9, 150000, 'transporte', 'Gasolina'], [13, 520000, 'ocio', 'Viaje corto'], [16, 300000, 'persona1', 'Mesada'],
  [19, 205000, 'mercado', 'Mercado'], [23, 130000, 'restaurantes', 'Restaurantes'], [28, 85000, 'salud', 'Droguería'],
];

async function sembrar(page) {
  const movs = [];
  [[0, MES_ACTUAL], [1, MES_PREVIO], [2, MES_ANTE]].forEach(([atras, lista]) => lista.forEach(([d, monto, categoria, comercio, esFijo]) =>
    movs.push({ fecha: fecha(atras, d), monto, categoria, comercio, esFijo: !!esFijo })));
  const ingresos = [0, 1, 2].map((a) => fecha(a, 1));
  await page.evaluate(async ({ movs, ingresos }) => {
    const db = await import('/js/db.js');
    const model = await import('/js/model.js');
    await db.openDB();
    await db.saveConfig({ onboardingCompletado: true, nombre: 'Ana', cuentas: ['Débito', 'Tarjeta Visa', 'Efectivo'] });
    const sueldo = model.crearIngreso({ fuente: 'empleo', nombre: 'Sueldo', diaDelMes: 1, monto: 6800000 });
    await db.bulkPut('ingresos', [sueldo]);
    await db.bulkPut('recurrentes', [
      model.crearRecurrente({ nombre: 'Arriendo', monto: 1850000, diaDelMes: 1, categoria: 'vivienda', cuenta: 'Débito', modo: 'confirmar' }),
      model.crearRecurrente({ nombre: 'Internet y celular', monto: 145000, diaDelMes: 2, categoria: 'servicios', cuenta: 'Débito', modo: 'confirmar' }),
    ]);
    await db.bulkPut('creditos', [
      model.crearCredito({ entidad: 'Banco Demo', producto: 'Tarjeta Visa', franquicia: 'visa', saldo: 1200000, cuotaMensual: 180000, tasaEA: 28, diaPago: 15 }),
      model.crearCredito({ entidad: 'Banco Demo', producto: 'Crédito de vehículo', saldo: 18000000, cuotaMensual: 650000, tasaEA: 14, diaPago: 20 }),
    ]);
    const todos = movs.map((m) => model.crearMovimiento({ ...m, cuenta: 'Débito' }));
    ingresos.forEach((f) => todos.push(model.crearMovimiento({ fecha: f, monto: 6800000, tipo: 'ingreso', comercio: 'Sueldo', ingresoId: sueldo.id, cuenta: 'Débito' })));
    await db.bulkPut('movimientos', todos);
  }, { movs, ingresos });
}

/* ---------- barra de estado 9:41 (solo overlay de captura) ---------- */
const BARRA = `
<div id="__sb" style="position:fixed;top:0;left:0;right:0;height:59px;z-index:2147483647;pointer-events:none;display:flex;align-items:flex-end;justify-content:space-between;padding:0 30px 14px 44px;box-sizing:border-box;font:600 17px/1 -apple-system,'SF Pro Text','Manrope',system-ui,sans-serif;color:#1D1D1F;letter-spacing:-0.02em">
  <span>9:41</span>
  <span style="display:flex;align-items:center;gap:6px">
    <svg width="18" height="12" viewBox="0 0 18 12" fill="#1D1D1F"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
    <svg width="17" height="12" viewBox="0 0 17 12" fill="none" stroke="#1D1D1F" stroke-width="1.8" stroke-linecap="round"><path d="M1.5 4.2a10 10 0 0 1 14 0M4 7a6.4 6.4 0 0 1 9 0"/><circle cx="8.5" cy="10" r="1.2" fill="#1D1D1F" stroke="none"/></svg>
    <svg width="27" height="13" viewBox="0 0 27 13" fill="none"><rect x="0.5" y="0.5" width="23" height="12" rx="3.6" stroke="#1D1D1F" stroke-opacity=".4"/><rect x="2" y="2" width="20" height="9" rx="2.4" fill="#1D1D1F"/><path d="M25 4.5v4c.8-.3 1.5-1.1 1.5-2s-.7-1.7-1.5-2z" fill="#1D1D1F" fill-opacity=".45"/></svg>
  </span>
</div>`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: scale,
  isMobile: true, hasTouch: true, serviceWorkers: 'block', bypassCSP: statusbar });
const page = await ctx.newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
if (statusbar) {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 59, bottom: 34, left: 0, right: 0 } });
}
await mkdir(out, { recursive: true });
const base = `http://localhost:${puerto}/`;

async function foto(nombre) {
  if (statusbar) await page.evaluate((h) => { document.getElementById('__sb')?.remove(); document.body.insertAdjacentHTML('beforeend', h); }, BARRA);
  const path = join(out, `${nombre}.${formato}`);
  await page.screenshot(formato === 'jpg' ? { path, type: 'jpeg', quality: 92 } : { path });
  if (statusbar) await page.evaluate(() => document.getElementById('__sb')?.remove());
}
async function ir(hash, espera = 3000) {
  await page.goto(`${base}${hash}`);
  await page.reload();
  await page.waitForTimeout(espera); // splash + entrada
}

await page.goto(base);
await page.waitForTimeout(2500); // que la app termine su arranque antes de sembrar
await sembrar(page);

await ir('#/hoy');
await foto('hoy');
// Análisis (segunda pestaña de Hoy)
const tabs = page.locator('[data-hoy-tab]');
if (await tabs.count() > 1) { await tabs.nth(1).click(); await page.waitForTimeout(1400); await foto('analisis'); }
for (const [nombre, hash] of [['movimientos', '#/movimientos'], ['personas', '#/personas'],
  ['perfil', '#/perfil'], ['asesor', '#/asesor'], ['productos', '#/productos']]) {
  await ir(hash);
  await foto(nombre);
}
// FAB abierto + Registrar con monto
await ir('#/hoy', 2600);
await page.locator('#fab').click();
await page.waitForTimeout(900);
await foto('fab');
await page.locator('#fab-gasto').click();
await page.waitForTimeout(1000);
const metodo = page.locator('[data-metodo="teclado"]');
if (await metodo.count()) { await foto('registrar-metodos'); await metodo.first().click(); await page.waitForTimeout(800); }
for (const k of ['1', '2', '8', '5', '0', '0']) { await page.locator(`[data-key="${k}"]`).first().click(); await page.waitForTimeout(90); }
await page.getByText('Supermercado', { exact: true }).last().click(); // categoría elegida → Guardar activo
await page.waitForTimeout(700);
await foto('registrar');

// Onboarding (base vacía): las 4 láminas
await page.evaluate(async () => { const db = await import('/js/db.js'); await db.borrarTodo(); indexedDB.deleteDatabase('bolsillo'); });
await page.goto(base);
await page.reload();
await page.waitForTimeout(3200);
for (let i = 1; i <= 4; i++) {
  await page.waitForTimeout(1200);
  await foto(`onboarding-${i}`);
  if (i < 4) { await page.locator('.ob2__cta').click(); await page.waitForTimeout(500); }
}
console.log(errores.length ? 'ERRORES:\n' + errores.join('\n') : 'sin errores de consola', '→', out);
await browser.close();
server.close();
