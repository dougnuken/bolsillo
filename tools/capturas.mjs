// Capturas de olbo con datos de demo neutros (sin nombres ni montos reales).
// Uso: node tools/capturas.mjs <dir-salida> [--scale 3] [--puerto 4151]
// Sirve el repo con un servidor estático propio, siembra IndexedDB y captura
// cada vista a 393×852 (iPhone con isla). Para mockups usa --scale 3.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const out = resolve(args[0] || 'capturas');
const scale = Number(args[args.indexOf('--scale') + 1]) || 2;
const puerto = Number(args[args.indexOf('--puerto') + 1]) || 4151;
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

const hoy = new Date();
const ym = hoy.toISOString().slice(0, 7);
const d = (n) => `${ym}-${String(Math.min(n, hoy.getDate())).padStart(2, '0')}`;
const GASTOS = [
  [1, 1850000, 'vivienda', 'Arriendo', true], [2, 245000, 'servicios', 'Energía', true],
  [3, 186400, 'mercado', 'Supermercado'], [4, 38000, 'restaurantes', 'Almuerzo'], [5, 95000, 'transporte', 'Gasolina'],
  [6, 12500, 'restaurantes', 'Café'], [7, 64900, 'ocio', 'Cine'], [8, 142300, 'mercado', 'Mercado de la semana'],
  [9, 8900, 'restaurantes', 'Panadería'], [10, 120000, 'salud', 'Droguería'], [11, 54000, 'transporte', 'Parqueadero'],
  [12, 230000, 'ocio', 'Concierto'], [13, 15800, 'restaurantes', 'Café'], [14, 98700, 'mercado', 'Frutas y verduras'],
];

async function sembrar(page) {
  await page.evaluate(async ({ GASTOS, fechas, ym }) => {
    const db = await import('/js/db.js');
    const model = await import('/js/model.js');
    await db.openDB();
    await db.saveConfig({ onboardingCompletado: true, nombre: 'Ana' });
    const ing = model.crearIngreso({ fuente: 'empleo', nombre: 'Sueldo', diaDelMes: 1, monto: 6800000 });
    await db.bulkPut('ingresos', [ing]);
    const movs = GASTOS.map(([dia, monto, categoria, comercio, esFijo], i) =>
      model.crearMovimiento({ fecha: fechas[i], monto, categoria, comercio, esFijo: !!esFijo, cuenta: 'Débito' }));
    movs.push(model.crearMovimiento({ fecha: `${ym}-01`, monto: 6800000, tipo: 'ingreso', comercio: 'Sueldo', ingresoId: ing.id, cuenta: 'Débito' }));
    await db.bulkPut('movimientos', movs);
  }, { GASTOS, fechas: GASTOS.map((g) => d(g[0])), ym });
}

const VISTAS = [['hoy', '#/hoy'], ['movimientos', '#/movimientos'], ['personas', '#/personas'],
  ['perfil', '#/perfil'], ['asesor', '#/asesor'], ['productos', '#/productos']];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: scale,
  isMobile: true, hasTouch: true, serviceWorkers: 'block' });
const page = await ctx.newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
await mkdir(out, { recursive: true });
await page.goto(`http://localhost:${puerto}/`);
await sembrar(page);
await page.reload();
await page.waitForTimeout(1500);
for (const [nombre, hash] of VISTAS) {
  await page.goto(`http://localhost:${puerto}/${hash}`);
  await page.reload();
  await page.waitForTimeout(3000); // splash + entrada
  await page.screenshot({ path: join(out, `${nombre}.png`) });
}
// Registrar: el FAB abre el sheet
await page.goto(`http://localhost:${puerto}/#/hoy`);
await page.waitForTimeout(2200);
const fab = page.locator('.fab, [data-fab], #fab').first();
if (await fab.count()) { await fab.click(); await page.waitForTimeout(900); await page.screenshot({ path: join(out, 'fab.png') }); }
// Onboarding (base vacía)
await page.evaluate(async () => { const db = await import('/js/db.js'); await db.borrarTodo(); indexedDB.deleteDatabase('bolsillo'); });
await page.goto(`http://localhost:${puerto}/`);
await page.waitForTimeout(3000);
await page.screenshot({ path: join(out, 'onboarding.png') });
console.log(errores.length ? 'ERRORES:\n' + errores.join('\n') : 'sin errores de consola', '→', out);
await browser.close();
server.close();
