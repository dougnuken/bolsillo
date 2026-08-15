/* ============================================================
   olbo · test/formato-chat.test.js
   El markdown de la conciencia, convertido a HTML para la burbuja. Lo primero
   que se prueba aquí es que NO se pueda inyectar HTML: el texto viene de un
   modelo que a su vez lee extractos, o sea entrada no confiable dos veces.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { renderRespuesta, soloTexto } from '../js/formato-chat.js';

test('escapa el HTML: el modelo no puede inyectar marcado', () => {
  const html = renderRespuesta('<img src=x onerror=alert(1)> y <b>esto</b>');

  assert.equal(html.includes('<img'), false);
  assert.equal(html.includes('<b>'), false);
  assert.match(html, /&lt;img/);
});

test('tampoco desde dentro de una negrita', () => {
  const html = renderRespuesta('**<script>alert(1)</script>**');

  assert.equal(html.includes('<script'), false);
  assert.match(html, /<strong>&lt;script&gt;/);
});

test('la negrita se convierte', () => {
  assert.match(renderRespuesta('pagas **$213.369** al mes'), /pagas <strong>\$213\.369<\/strong> al mes/);
});

test('los encabezados se vuelven una línea en negrita, no un título', () => {
  const html = renderRespuesta('## Tu deuda\ntexto');

  assert.equal(html.includes('<h2'), false);
  assert.match(html, /^<strong>Tu deuda<\/strong>\ntexto$/);
});

test('las viñetas se unifican en · , la que ya usa la app', () => {
  const html = renderRespuesta('- uno\n* dos\n• tres');

  assert.equal(html, '· uno\n· dos\n· tres');
});

test('respeta la sangría de las viñetas anidadas', () => {
  assert.equal(renderRespuesta('  - anidada'), '  · anidada');
});

test('NO toca los asteriscos sueltos de los nombres de comercio', () => {
  // "TIENDA*DEMO" sale tal cual en los extractos; convertirlo rompería el dato.
  const html = renderRespuesta('el cargo de TIENDA*DEMO por $400.000');

  assert.match(html, /TIENDA\*DEMO/);
  assert.equal(html.includes('<em>'), false);
});

test('la cursiva con guion bajo funciona sin comerse los nombres con _', () => {
  assert.match(renderRespuesta('esto es _importante_'), /<em>importante<\/em>/);
  assert.equal(renderRespuesta('archivo_de_prueba').includes('<em>'), false);
});

test('los saltos de línea se conservan (la burbuja es pre-wrap)', () => {
  assert.equal(renderRespuesta('una\ndos\n\ntres'), 'una\ndos\n\ntres');
});

test('vacío y basura devuelven cadena vacía, sin lanzar', () => {
  for (const v of [undefined, null, '', '   ', 42, {}, []]) {
    assert.equal(renderRespuesta(v), '');
  }
});

test('soloTexto limpia el marcado sin dejar etiquetas', () => {
  const t = soloTexto('## Título\n- uno\npagas **$100** hoy');

  assert.equal(t.includes('<'), false);
  assert.equal(t.includes('**'), false);
  assert.match(t, /Título/);
  assert.match(t, /· uno/);
  assert.match(t, /pagas \$100 hoy/);
});
