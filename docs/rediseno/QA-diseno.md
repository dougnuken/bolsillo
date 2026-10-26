# QA de diseño · olbo 2.0 (previo a F1)

> 26 oct 2026 · Sonnet. Solo lectura: no se tocó código. Contraste medido con Playwright sobre `tablero.html` (píxeles reales, animación en reposo)
> y con la fórmula WCAG. Scripts en el scratchpad de la sesión. Línea base: `node --test` = **647/647 en verde** (CLAUDE.md dice 423: desactualizado).

## Resumen

3 bloqueantes (decidir antes de F1/F2), 7 importantes, 6 menores. Los tests no dependen de CSS, clases, textos ni colores: solo importan
`js/model|budget|backup|viewport…` y 5 funciones puras de vistas. «Dashboard/Analytics/¡Bienvenido!» solo viven en `js/views/dashboard.js:56-64,161`.

## Bloqueantes

1. **`color-scheme: dark` y la barra de estado iOS no están en el plan.** `css/tokens.css:440` y `index.html:29` declaran `dark`; `theme-color` sigue en `#0A0519` (`index.html:28`).
   El comentario de `index.html:14-55` dice que la franja superior la pinta iOS desde `color-scheme: dark` + status-bar `default`. Con UI perla habría una franja negra
   encima y controles nativos, scrollbars y selector de fecha oscuros. **Corrección:** añadir a F1 `color-scheme: light` (CSS y meta) y `theme-color #F0EFF2`; no tocar `status-bar-style`.
   Doug debe verlo en el iPhone con la rama desplegada **antes de F2** (no verificable aquí). Mover `background_color`/`theme_color` del manifest de F7 a F1 (evita destello oscuro al abrir).
2. **La escala `--sp-*` se renumera.** Hoy `4 8 12 16 20 24 32 40 48 64` (`tokens.css:249-258`); SISTEMA §2 la cambia a `4 6 8 12 16 20 24 32 40 56`. Cada `var(--sp-N)` encoge un escalón:
   140 usos en `components.css`, 252 en `views.css`, 6 en `base.css`; además `--dock-gap` y `--dock-x` (`tokens.css:341,373`) bajan de 16 a 12 y mueven la geometría del dock probada en dispositivo.
   Contradice la aceptación de F1 («todo legible»). **Corrección:** no renumerar. Conservar la escala y añadir `--gap-bento` y `--gutter`; los valores 6/12 se usan solo en las reglas nuevas.
3. **F2 no cubre la geometría real del dock/FAB.** Hay un sistema acoplado a `js/viewport.js` y `app.js:173`: `--nav-h:52` y `--nav-h-min:46` (`tokens.css:292,299`), `--dock-b/--dock-x/--dock-x-min`, `--fab-asoma:52` (`:364`),
   `--view-b` (`:388`), `body.nav-min` (colapsa etiquetas), `.tabbar--4` (`components.css:409-446`) y el FAB **centrado** con `translateX(-50%)` en 5 sitios (`components.css:283,322,355,446,1190`) más `--dock-shift` del toast.
   El nuevo dock mide 60, no colapsa y el FAB va a la derecha. **Corrección:** añadir a F2 una tarea explícita: `--nav-h:60px`, retirar `nav-min` (CSS + `app.js:173`), recalcular `--view-b` y `--fab-asoma`,
   reubicar FAB y burbujas, y verificar con `?v` nuevo en iPhone (modo `data-vp-borde`). `viewport.test.js` solo cubre la función pura.

## Importantes

4. **Etiquetas de eje en tinta-3 no pasan AA.** `tablero.css:274,522,523` (11 px): «1 oct» 2,41; «31» 2,80; «hoy» 2,81; «300k» 2,88 (necesitan 4,5). MARCA da 3,25 sobre papel; sobre vidrio real es 2,7-3,2.
   **Corrección:** ejes en `--tinta-2` (4,9-5,8 en todo fondo) y `--tinta-3` solo para trazos/divisores.
5. **Foco sin contraste sobre negro.** `--lila-tinta #5B3FE0` sobre tinta = **2,59:1** (dock, losas negras, toast, botón primario): falla 3:1 (1.4.11). **Corrección:** `:focus-visible` con `outline-color: var(--lila)` (7,33) en `.losa-negra, .tabbar, .toast, .btn--primary`.
6. **`--sobre-negro-2 #A1A1A8` sobre la losa negra baja a 4,39 en el grafito y 3,29 en el halo lila.** MARCA anuncia 6,55 (solo vale sobre el negro liso). Medido en «Gastado»: mín 4,08, p5 4,62. **Corrección:** `--sobre-negro-2 → #B4B4BB` (≈5,7 sobre grafito) o bajar el stop `--grafito` a `#34343A`.
7. **Tap targets <44 px** (medidos): `.seg__opt` 34 (Resumen/Análisis, Gasto/Ingreso); `.cat-chip` 38; `.mfilter` 36; `.chat-chip` 40; `.toast__act` 36; `.mov-row__more` 32; `.icon-btn--s` 34;
   `.btn--sm` 40; `.ob2__skip` 40. OK: dock 48, `.icon-btn` 44, keypad 50, FAB 60, botón primario 56. **Corrección:** `::after{content:'';position:absolute;inset:-4px -2px}` (o `min-height:44px` con relleno visual interno) y gap ≥8 entre chips. En el segmentado, que la opción mida 44 y la píldora 36.
8. **Blur de más: el CSS del tablero contradice SISTEMA §1.5/§7.** `.vidrio` lleva `backdrop-filter` (`tablero.css:195-200`) y `.icon-btn` también (`:237`): en Hoy hay **10 capas** con blur (3 icon-btn, bcard, productos, lila, negra, fijos, catcard, dock);
   en Movimientos 7; el doc promete ≤5 y «las losas de vidrio claro no llevan blur». **Corrección:** quitar blur de `.vidrio` e `.icon-btn` (dejarlo en `.vidrio-fuerte`, `.losa-*`, header, dock, sheet); copiar a la app solo el CSS corregido.
9. **F1 deja texto blanco sobre claro.** `--text-inverse` hoy es `#17140F` y se usa en 16 sitios sobre `--grad-cta`/acento (`components.css:51,291,473,972,1342,1403`; `views.css:442,820,883,919,981,1974`). Al volverlo papel (SISTEMA §2) esos botones quedan blancos sobre naranja/lila (≈2:1) hasta F2-F6.
   **Corrección:** en F1 reasignar `--grad-cta`/`--fab-grad` consumidores a `--tinta` (o dejar `--text-inverse` y crear `--sobre-negro`), y crear la esfera con un token propio.
10. **Navegación solo con íconos.** El inactivo pierde `.tab__label` (`index.html:169-190`); «Personas» (dos siluetas) y «Perfil» (una) son casi iguales. SISTEMA pide `aria-current`, pero los botones son `role="tab"` (`index.html:168`): debe ser `aria-selected` (pendiente conocido de CLAUDE.md §9).
   **Corrección:** mantener la etiqueta como texto accesible (`visually-hidden`), `aria-selected`, y mostrar la etiqueta también en el activo tras un cambio de ruta; revisar con Marley/Doug si distinguen los dos íconos.

## Menores

11. `.cifra__cur` (`$`) en losa lila con opacity .7: 4,42 (13,9 px, peso 300) y `.losa-lila small` 3,4-4,0 (`tablero.css:222,501,643`). Quitar `opacity` y usar tinta al 100 % o tamaño ≥18 px.
12. Bordes de input/tecla/chip `--line-2` = 1,20:1 y `--trazo` 1,52 sobre vidrio: la frontera del control no llega a 3:1 (1.4.11). Aceptable porque el relleno y el rótulo lo delimitan; si se quiere cumplir, borde `rgba(29,29,31,.45)` en inputs.
13. El chip seleccionado es lila sobre perla (2,01:1): la selección se distingue solo por color. Añadir un tilde o `aria-pressed` visible; ya hay `is-sel`.
14. Animación ambiente: 43 infinitas en Hoy, 41 en Registrar, 34 en Movimientos, 31 en Asesor (40 son `respira` de 1,5 px). Solo `transform`/`opacity` (verificado en los 8 `@keyframes`, `tablero.css:702-709`); con `reduce` quedan 0 (`:711-713`).
    Sin `will-change` y con ~40 capas promovidas dentro de un padre con blur: medir en iPhone. WCAG 2.2.2 (>5 s sin pausa) mitigado por reduce-motion; pausar fuera de vista es obligatorio (SISTEMA §5). La pastilla activa del dock debe moverse con `transform`, no con `width` (`.tab.is-active{width:auto}`, `tablero.css:657`).
15. Grano: el SVG con `feTurbulence` va en cada `.vidrio` (hasta 10 capas) más `soft-light`. `grano*.svg` no traen `<style>` (CSP ok). Riesgo de repintado lento en iOS: entregar ya el PNG de 160×160 que SISTEMA §7 deja como plan B.
16. `.cifra--hero` mide 239 px con `6.248.300` y 315 px con `1.248.300.000` en `white-space:nowrap`: a 375 px (contenido 311) desborda desde mil millones. Añadir un escalón de tamaño por número de dígitos. Manrope no trae U+2009 (usar solo Urbanist para `$ 000`).

## Verificado sin hallazgos

- **CSP:** 0 `style=`, 0 `<style>`, 0 `<script>`, 0 handlers inline en `tablero.html`, `grano*.svg` y `marca/*.svg`; sin `@import` ni `url()` externos (solo fuentes y grano locales). `default-src 'self'; style-src 'self'; img-src 'self' data: blob:` (`index.html:9`) alcanza.
  Las alturas de barra son `h-N` en `tablero-alturas.css` (17 KB, solo del mockup): en la app van con `setProperty('--h', …)` (CSSOM, como `viewport.js:109`), nunca `setAttribute('style')`. El SW es network-first: no hay lista que ampliar.
- **Contraste que sí pasa (mín. en píxeles):** tinta/vidrio 15,5-16,5; tinta-2/vidrio 5,4-5,8 (lavanda 4,9); tinta/losa lila 5,5 (esquina hondo) a 16,5; blanco/negra 11,3-18,4; dock icono .86 sobre 7,05 (sobre blanco) y activo tinta/papel 16,8;
  semáforo anillo/vidrio 3,56-4,04, texto/vidrio 5,34-5,65, tinta/chip 12,8-14,3; placeholder tinta-2 5,26; error `#B83232` 5,93 y borde `#D64545` 4,38; foco lila-tinta sobre claro 5,67-6,50. Los 8 fallos de texto medidos están en los hallazgos 4, 6 y 11 (más 3 etiquetas de la lámina del tablero, no de la app).
- **Selectores y tokens de SISTEMA-UI:** los 43 tokens «conservados» existen en `tokens.css` y las 71 clases citadas existen, salvo las nuevas del mockup a crear en F3 (`.barras`, `.chart__barras`, `.chart__punto`, `.cifra__cur`) y dos nombres que no existen: **`.view-head`** (el real es `.section-head`, `dashboard.js`; `view-greet__eyebrow` en `personas.js`) y **`.composer`** (existe en `views.css:474` pero `asesor.js` usa `.chat-bar`/`.chat-input`: apuntar F6 a esos); `.list-row` existe en CSS pero ningún JS lo usa.
  Tokens reales sin dueño en SISTEMA: `--cat-*` (18, ver nota branding 2), `--dock-*`, `--nav-h*`, `--fab-asoma/-hi/-rim`, `--view-b`, `--switch-knob`, `--toast-empuje`, `--vp-*`. Fuentes: Urbanist y Manrope ya están en `fonts/` (OFL incluida), con `ñ ¿ ¡ −`; falta cambiar el `preload` y los `@font-face` (`index.html:64-65`, `base.css:12,21`).
- **Reduce motion/transparency:** `prefers-reduced-motion` apaga todo (`tablero.css:711`); `prefers-reduced-transparency` no pone `backdrop-filter:none` en `.losa-*` (no importa: sus fondos son opacos). Falta en la app el equivalente para transiciones (a fundidos de 200 ms, SISTEMA §5).
- **Privacidad:** datos de demo neutros («Ana», comercios genéricos, montos redondos); sin correos, teléfonos ni cuentas. `refs-local/` está en `.gitignore`. Nota: `tablero.png` (11,9 MB), `pantalla-componentes.png` (4,3 MB) y `tablero-motion.webm` (1,3 MB) están versionados y GitHub Pages los publica: añadirlos a `.gitignore` o comprimirlos antes de merge a `main`.
