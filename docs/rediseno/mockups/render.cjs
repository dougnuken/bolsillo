// Renderiza el tablero completo y una captura por pantalla (393×852 @2x)
const { chromium } = require('playwright');
const path = require('path');
const DIR = __dirname;
const URL = 'file://' + path.join(DIR, 'tablero.html');
const soloTablero = process.argv.includes('--tablero');

(async () => {
  const browser = await chromium.launch();
  const errs = [];
  const page = await browser.newPage({ viewport: { width: 1868, height: 1200 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('requestfailed', (r) => errs.push('FAIL ' + r.url()));
  await page.goto(URL);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(DIR, 'tablero.png'), fullPage: true });
  if (!soloTablero) {
    const ids = { hoy: 'p-hoy', registrar: 'p-registrar', movimientos: 'p-movimientos', asesor: 'p-asesor', onboarding: 'p-onboarding' };
    await page.evaluate(() => document.querySelectorAll('.pantalla').forEach((p) => p.classList.add('pantalla--captura')));
    await page.evaluate(() => document.querySelector('.panel').classList.add('panel--captura'));
    for (const [n, id] of Object.entries(ids)) {
      await page.locator('#' + id).screenshot({ path: path.join(DIR, `pantalla-${n}.png`) });
    }
    await page.locator('#p-componentes').screenshot({ path: path.join(DIR, 'pantalla-componentes.png') });
  }
  const fonts = await page.evaluate(() => [...document.fonts].map((f) => f.family + ':' + f.status));
  console.log('fonts', fonts.join(' '), 'errs', errs.join(' | ') || 'none');
  if (!process.argv.includes('--sin-video')) {
    // 6 s de movimiento real (sin reduced-motion): fila de pantallas y luego componentes
    const fs = require('fs');
    const vdir = path.join(DIR, '.video-tmp');
    const ctx = await browser.newContext({ viewport: { width: 1868, height: 1080 }, recordVideo: { dir: vdir, size: { width: 1868, height: 1080 } } });
    const vp = await ctx.newPage();
    await vp.goto(URL);
    await vp.evaluate(() => document.fonts.ready);
    await vp.waitForTimeout(3400);
    await vp.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
    await vp.waitForTimeout(2800);
    const video = vp.video();
    await ctx.close();
    fs.renameSync(await video.path(), path.join(DIR, 'tablero-motion.webm'));
    fs.rmSync(vdir, { recursive: true, force: true });
  }
  await browser.close();
})();
