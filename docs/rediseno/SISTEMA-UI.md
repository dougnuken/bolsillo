# olbo 2.0 · Sistema UI

> UI lead, 26 oct 2026. Aplica `MARCA.md` (ley de color, tipo y logo) a componentes. Referencia visual:
> `mockups/tablero.html` + `tablero.css` (código trasladable) y `mockups/pantalla-*.png`. No cambia IA ni flujos:
> cada vista conserva contenido y acciones; cambia piel y composición.

## 1. Principios

1. **Losas contiguas.** Bento a 6 px, gutter lateral 12 px, radio 30. El texto respira dentro de la losa (padding 16–20), no entre losas.
2. **Tres pesos de superficie por pantalla:** vidrio claro (casi todo), **una** losa negra, **como máximo una** aparición lila.
3. **Cifras finas y enormes.** Urbanist 300 con `$` al 45 % en tinta-2; lo demás, Manrope.
4. **Sin sombras.** La profundidad la dan el canto blanco de 1 px y el contraste de bloques. Solo lo que flota (dock, FAB, sheet) lleva sombra.
5. **Blur solo donde hay contenido debajo** (header fijo, dock, FAB, sheets, composer). Las losas bento no llevan `backdrop-filter`: sobre un degradado tan liso el blur no se ve y en iOS cuesta caro.

## 2. Tokens (`css/tokens.css`)

Se conservan los nombres y se reescriben los valores. Nuevos marcados con ★.

| Token | Valor nuevo | Nota |
|---|---|---|
| ★`--perla` `--papel` `--tinta` `--tinta-2` `--tinta-3` `--trazo` `--lila` `--lila-tinta` `--sobre-negro-2` | según MARCA | primitivos de marca |
| `--bg-root` | `#E2E7EC` | último stop del fondo |
| `--bg-0` `--bg-1` | `var(--perla)` | |
| `--bg-2` | `var(--papel)` | superficie sólida |
| `--bg-3` | `rgba(29,29,31,.05)` | losa anidada = hundido |
| `--bg-app` | 4 capas de MARCA §Fondo | fijo en `body::before` |
| `--glass-hundido` | `rgba(29,29,31,.05)` | N0 |
| `--glass-1` | `rgba(255,255,255,.46)` | chips/botones sobre el fondo |
| `--glass-2` | `rgba(255,255,255,.62)` | N1 = vidrio (losas) |
| `--glass-3` `--glass-nav` | `rgba(255,255,255,.82)` | N2 = vidrio fuerte |
| `--glass-tag` | `var(--glass-1)` | |
| `--glass-header` / `-medio` | `rgba(240,239,242,.78)` / `.40` | caída del header |
| `--glass-gloss` | `rgba(255,255,255,.95)` | |
| `--glass-nav-line` | `rgba(255,255,255,.75)` | = ★`--canto` |
| ★`--glass-solido` | `#F5F4F9` | reduced-transparency |
| `--seg-solido` | `var(--tinta)` | pastilla del segmentado |
| `--blur` / `--blur-strong` / `--blur-nav` | `24px` / `32px` / `32px` | con `saturate(160%/180%)` |
| `--line-1/2/3` | `rgba(29,29,31,.06/.09/.16)` | divisores |
| `--line-accent` | `var(--lila-tinta)` | anillo de foco |
| `--text-1/2/3` | tinta / tinta-2 / tinta-3 | text-3 nunca en texto de lectura |
| `--text-inverse` | `var(--papel)` | **cambia de sentido**: ahora es el texto sobre negro |
| `--accent` | `var(--lila)` | relleno, nunca texto |
| `--accent-deep` | `var(--lila-tinta)` | texto/trazo lila sobre claro |
| ★`--losa-negra` | `radial-gradient(70% 60% at 85% 90%, #2C2C31 0%, #1D1D1F 70%)` | |
| ★`--losa-lila` | `var(--lila)` | |
| ★`--sobre-negro-3` | `rgba(255,255,255,.16)` | trazos y círculos en losa negra |
| ★`--sobre-lila-1` | `rgba(29,29,31,.08)` | círculo de ícono en losa lila |
| `--semaforo-{verde,ambar,rojo}` | `#25935A` `#B87206` `#D64545` | anillo y gráficas |
| `--semaforo-*-text` | `#1B7442` `#875806` `#B83232` | |
| `--semaforo-*-bg` | `#D5F0DE` `#FBEBC4` `#F9D9D6` | chips con tinta encima |
| `--semaforo-*-line` | el color de anillo al 35 % | |
| `--track` | `var(--trazo)` | |
| `--scrim` | `rgba(29,29,31,.26)` | |
| `--font-display` | `'Urbanist', -apple-system, 'SF Pro Display', system-ui, sans-serif` | |
| `--font-ui` `--font-num` | `'Manrope', -apple-system, 'SF Pro Text', system-ui, sans-serif` | num siempre con `tabular-nums` |
| ★`--fw-light` | `300` | `--fw-bold` pasa a `600` (no se usa 700) |
| ★`--fs-hero` | `3.5rem` (56) | monto héroe |
| `--fs-display` | `2.5rem` (40) | |
| `--fs-h1/h2/h3` | `1.75rem` / `1.25rem` / `1.0625rem` | |
| ★`--fs-axis` | `.6875rem` (11) | ejes |
| `--sp-1…10` | `4 6 8 12 16 20 24 32 40 56` | escala reducida |
| ★`--gap-bento` / ★`--gutter` | `6px` / `12px` | |
| `--r-xs/sm/md/lg` | `8 / 12 / 16 / 20` | |
| `--r-xl` = ★`--r-hija` | `24px` | losa dentro de losa (30 − 6) |
| `--r-2xl` = ★`--r-losa` | `30px` | losa exterior |
| ★`--r-sheet` | `38px` | sheet flotante y losa CTA |
| `--r-full` | `999px` | pill y círculos |
| `--sh-sm` `--sh-card` `--sh-cta` `--sh-chip-sel` `--sh-chip-sel-verde` | `none` | |
| `--sh-md` `--sh-nav` `--sh-sheet` | `0 12px 32px -16px rgba(29,29,31,.22)` | solo lo que flota |
| `--sh-fab` | `0 10px 24px -10px rgba(29,29,31,.5)` | |
| `--dur-fast/dur/dur-slow` | `120 / 220 / 380ms` | |
| `--ease` | `cubic-bezier(.32,.72,0,1)` | salida tipo iOS |
| `--ease-empuje` | `cubic-bezier(.34,1.3,.64,1)` | rebote leve, solo tras gesto |
| `--splash-bg` `--splash-marca` | `var(--perla)` / `var(--tinta)` | |

**Obsoletos.** En F1 se reasignan a un valor neutro para no romper nada y en F7 se borran: `--accent-strong` y
`--accent-light` → `--lila-tinta`/`--lila`; `--accent-soft`, `--accent-glow`, `--accent-grad`, `--grad-cta`,
`--grad-cta-border`, `--grad-edge`, `--fab-grad` y `--fab-glow-*` → `var(--tinta)` o `transparent`;
`--hero-mesh`, `--hoy-glow`, `--wash-*` → `none`; `--verde-*` y `--rojo-*` (burbujas del FAB) → papel;
`--losa-1…6`, `--canto-1…6` y `--halo-1…6` (logo viejo) → se borran con el logo; `--bar-coral` y `--bar-ink` → trazo/tinta;
`--ease-fan`; `--sh-ia`; `--grad-gauge` → color del semáforo.

## 3. Materiales

| Nivel | Fondo | Blur | Canto | Sombra | Uso |
|---|---|---|---|---|---|
| N0 hundido | `--glass-hundido` | no | no | no | teclas, inputs, ícono de acción dentro de vidrio o sheet |
| Papel | `--papel` | no | `--line-2` si va sobre papel | no | círculos de ícono de fila, inputs sueltos, notificación |
| N1 vidrio | `--glass-2` | **no** en losas; 24 si hay scroll debajo | 1 px `--canto` | no | losas bento, chips sobre el fondo |
| N2 vidrio fuerte | `--glass-3` (sheet `.95`) | 32 + saturate 180 % | 1 px `--canto` | `--sh-md` | dock, sheet, composer, header fijo |
| Losa negra | `--losa-negra` | no | no | no | 1 por pantalla |
| Losa lila | `--losa-lila` | no | no | no | máx. 1 por pantalla; nunca con otra aparición lila |

Regla Apple: no se apila vidrio sobre vidrio. Dentro de N1/N2 los hijos son hundido o papel.
`@media (prefers-reduced-transparency: reduce)`: N1/N2 → `--glass-solido` sin blur. `prefers-contrast: more`: canto → `--line-3`.

## 4. Componentes

- **Header de vista** (`.hoy-greet`, `.view-head`, `.asesor-top`). Padding `10px 20px 18px`. Título de vista en Urbanist 400 34/1.1,
  −0,025 em. Saludo de Hoy en Urbanist 28/1.08: primera línea en 500 («Hola, Ana.») y segunda en 300 («Así va tu octubre»).
  Las acciones son botones circulares de 44 px separados 6 px. El orbe del asesor pasa a ser el símbolo del logo a 22 px.
  En scroll, el header fijo toma N2 y una caída en `--glass-header-medio`, sin borde inferior.
- **Tarjeta héroe de monto** (`.bcard`): N1, radio 30, padding `18px 20px 16px`. Arriba la etiqueta y un botón de 34 px hundido con ↗.
  El monto en `--fs-hero`, Urbanist 300 y −0,03 em. Debajo, el delta (Manrope 500 14 en tinta-2, cifra en tinta 600).
  *Opcional, con datos existentes:* el avance del mes en 31 trazos de 1,5×14 px (los días pasados en tinta al 55 %, hoy en 2×26 tinta) con
  un chip negro «hoy, 26» que se posiciona por CSSOM.
- **$ atenuado** (`.cifra__cur`): `font-size:.45em; font-weight:300; color:tinta-2; vertical-align:top; position:relative; top:.3em`,
  más U+2009 antes del número. En losa negra va en sobre-negro-2 y en lila, en tinta al 62 %. El negativo es `−` (U+2212) antes del `$`.
- **Losa negra** (`.stat` Gastado en Hoy, CTA del onboarding, gráfica de flujo en Análisis): padding 16–18. Etiqueta y subtexto en sobre-negro-2,
  cifra en blanco, círculo de ícono `--sobre-negro-3` y minibarras de 1,5 px en `--sobre-negro-3` con la última en papel.
- **Losa lila** (`.stat` Disponible en Hoy): todo el contenido va en tinta, con el círculo de ícono en `--sobre-lila-1`. Mide 170 px de alto en la grilla 2×.
- **Segmentado** (`.seg`, `.seg--dock`): alto 44, padding 4, fondo `--glass-1` con canto. La pastilla es negra (`--seg-solido`) y su texto
  va en papel 600 14; la opción inactiva va en tinta-2. La pastilla se desliza con transform (`--dur`, `--ease`).
- **Chips** (`.cat-chip`, `.mfilter`, `.acct-chip`, `.chat-chip`): alto 36–40, pill, Manrope 600 14 e ícono de 18. Sobre el fondo usan `--glass-1` con canto
  y dentro de un sheet, hundido. El seleccionado va en lila con tinta encima (es la aparición lila de esa pantalla). El chip de estado
  es el tinte del semáforo con un punto de 7 px.
- **Botón circular** (`.icon-btn`): 44 px (34 el pequeño), con ícono de 20 px y trazo de 1,6. Variantes: vidrio, hundido, negro (enviar) y papel.
- **FAB** (`.fab`): círculo de 60 px en tinta con un + blanco de 26 px y trazo de 1,8, más `--sh-fab`. Va **fuera del dock**, a la derecha, en la misma línea.
  Abierto, muestra dos **burbujas** papel (`.fab-bubble`) de 48 px con un ícono ↑ (Gasto) o ↓ (Ingreso) en un círculo hundido y su etiqueta.
  Se elimina el verde y el rojo.
- **Dock** (`.tabbar`): pill N2 de 60 px de alto, padding 5 y `left/right: 12px`. Los ítems son círculos de 50×48 sin etiqueta visible
  (`aria-label` y `aria-current`). El activo es una pill negra con ícono y etiqueta (Manrope 600 14). El ícono es de línea siempre; se elimina el
  par line/fill. Por debajo va un borde de scroll: degradado de transparente a `--bg-root` al 86 %, 150 px.
- **Filas de lista** (`.mov-row`, `.rec-item`, `.settings-row`): van agrupadas por día dentro de **una** losa N1 (no una tarjeta por fila). Cada fila
  mide 66 px con padding `0 10px 0 12px`. El ícono va en un círculo papel de 42 px con trazo tinta y **sin color de categoría**. El nombre va en Manrope 600 16,
  el meta en 500 13 tinta-2 y el monto en 500 16 tnum a la derecha. El divisor es de 1 px `--line-2` desde 64 px. La cabecera de día va en 600 14, con el
  total en tinta-2 por fuera de la losa.
- **Keypad de registrar** (`.keypad`, `.amt`): el monto va centrado en Urbanist 300 68 con un caret tinta de 2 px. El meta (fecha · cuenta) va debajo
  en 13 tinta-2. Las teclas forman una grilla 3×4 con gap 6 y padding 0 12; cada tecla mide 50 de alto, con radio 20, fondo hundido y Urbanist 400 26 (`000` a 21).
  Al presionar: `scale(.97)` y fondo `rgba(29,29,31,.11)` en `pointerdown`.
- **Sheets/modales** (`.sheet`): flotan a 8 px de los bordes, con radio 38, N2 al 95 % y scrim `--scrim`. El grip es de 36×5 en trazo. La cabecera
  lleva atrás y cerrar en círculos hundidos de 44 y el título en Urbanist 500 20 centrado. El pie, fijo, lleva el botón primario.
- **Botones**: el primario es una pill negra de 56 (40 el `--sm`) con texto papel 600 16. El ghost es hundido. El peligro usa tinta sobre `--semaforo-rojo-bg`.
- **Gauge del semáforo** (`.gauge`): SVG de 100, rotado −90°. La pista va punteada (`stroke-width:5; stroke-dasharray:.9 3.5`, en trazo). El arco
  es de 2,6 con extremo redondo en el color del semáforo, y en la punta lleva un punto de r 3,2. En el centro va Urbanist 300 54 con un `%` al 45 % en tinta-2,
  y el caption en 13 tinta-2. Debajo, la pill de estado.
- **Gráficas finas** (`.catbar`, flujo, categorías del mes): las barras son de 1,5–2 px en trazo, con la activa en tinta y el promedio en una línea
  punteada de 1,5 px en tinta-3. El valor activo va en un **chip negro** de 24 px (Manrope 600 12) con una guía vertical de 1 px y un punto papel con borde tinta.
  Ejes en `--fs-axis` tinta-3. Las barras horizontales de categoría tienen pista de 2 px en trazo y relleno tinta. Dentro de una losa negra, la serie puede ir en lila.
- **Inputs** (`.field__input`): alto 52, radio 18. Sobre el fondo son papel con `--line-2`; dentro de un sheet, hundidos. El placeholder va en tinta-2 400
  y el valor en tinta 500. Foco: `outline: 2px solid --lila-tinta; outline-offset: 2px`. Error: borde `--semaforo-rojo` y mensaje 600 13 en `-text`.
- **Toasts** (`.toast`): pill negra de 52 con un ícono en un círculo `--sobre-negro-3` de 36. La acción va en una pill papel de 36 («Deshacer»).
  Entra desde abajo con translateY y opacity.

## 5. Motion

Solo `transform` y `opacity` (y `filter` en el splash). Las duraciones son 120 ms (presión), 220 ms (cambios de estado y segmentado)
y 380 ms (sheet y página). Curva base `--ease`; rebote (`--ease-empuje`) solo si antes hubo un gesto con impulso (soltar el sheet).
La respuesta va en `pointerdown`, no en `click`. El sheet entra con translateY desde abajo y sale por el mismo camino. Las cifras animadas
mantienen el rodillo actual (`animarSaldo`) con Manrope tnum mientras rueda y pasan a Urbanist 300 en reposo; si eso salta, se deja Manrope solo en las listas.
`prefers-reduced-motion`: fundidos de 200 ms, sin desplazamientos ni rebote.

## 6. Plan de implementación (ejecutores Sonnet, una fase por sesión)

Todas las fases cumplen lo mismo: `node --test` en verde, version bump (`sw.js` CACHE y los 7 `?v=N`), cero hex fuera de
`tokens.css`, cero estilo inline, captura a 393 px de las vistas tocadas comparada con `mockups/pantalla-*.png`, y `ESTADO.md` al día.

| Fase | Archivos | Selectores | Aceptación |
|---|---|---|---|
| **F1** Tokens, fuentes y fondo | `css/tokens.css`, `css/base.css`, `index.html` (preload de fuentes) | `:root` completo (§2), `@font-face` de Urbanist y Manrope, `body`, `body::before` (`--bg-app`), `html` (`--bg-root`), `.num`, `::selection`, `:focus-visible` | La app entera se ve clara y legible aunque los componentes aún no estén ajustados; tinta sobre perla; nada de morado oscuro; obsoletos reasignados; contraste AA en texto base |
| **F2** Shell | `css/components.css`, `index.html` (markup del dock y del FAB) | `.tabbar`, `.tab*` (un solo ícono), `.fab`, `.fab-bubble*`, `.fab-veil`, `.sheet*`, `.scrim`, `.ov-*`, `.icon-btn*`, `.btn*`, `.toast*`, `.seg*`, `.switch` | Dock pill con el activo negro y el FAB aparte a la derecha; sheet flotante de radio 38; burbujas papel; blur solo en dock y sheet; la navegación y los `aria-*` no cambian |
| **F3** Hoy | `css/views.css`, `js/views/dashboard.js` (solo markup de presentación) | `.hoy-greet*`, `.bcard*`, `.hoy-productos*`, `.wcard`, `.stat-row`, `.stat*` (Disponible = lila, Gastado = negra), `.fijos-card*`, `.catbar*`, `.gauge*`, `.legend`, `.pill*`, `.mesnav`, `.catmes*`, `.negocio*`, `.hormiga-note*` | Igual a `pantalla-hoy.png`; una losa lila y una negra; gauge punteado con los tres estados; el monto con `$` atenuado; las animaciones del anillo y el saldo siguen funcionando |
| **F4** Registrar y keypad | `css/components.css`, `css/views.css`, `js/views/registrar.js` (solo clases) | `.amt*`, `.keypad*`, `.cat-grid`, `.cat-chip*`, `.acct-chip*`, `.capture-opt*`, `.date-trigger*`, `.field*`, `.detalles*`, `.draft-bar*`, `.voz-*`, `.foto-loading*` | Igual a `pantalla-registrar.png`; keypad hundido con respuesta en `pointerdown`; categoría seleccionada en lila; el botón Guardar siempre visible; el flujo de foto y voz sin cambios |
| **F5** Movimientos, Personas y Perfil/cfg | `css/views.css`, `css/components.css` | `.mov-*`, `.mfilter`, `.list-row`, `.persona-card*`, `.prestamo-card*`, `.perfil-head*`, `.settings-*`, `.cfg-*`, `.wallet-*`, `.pcard*`, `.cc*`, `.tj-res*`, `.notif-*` | Filas agrupadas en una losa por día con íconos monocromos; montos tnum alineados; ningún texto en tinta-3; Perfil sin multicolor |
| **F6** Asesor, onboarding y splash | `css/views.css`, `css/splash.css`, `js/views/asesor.js`, `js/views/onboarding.js` (markup), `index.html` (splash) | `.asesor-top`, `.chat-*`, `.composer*`, `.ob*`, `.ob2*` (sin renders 3D; losa vidrio con el gauge y CTA en losa negra), `#splash` | Igual a `pantalla-asesor.png` y `pantalla-onboarding.png`; el orbe es el símbolo; el splash en perla dura ~900 ms y se reduce a un fundido de 200 ms |
| **F7** Íconos, manifest y limpieza | `icons/*`, `manifest.webmanifest`, `index.html`, `fonts/`, `img/`, `css/tokens.css` | PNG desde `docs/rediseno/marca/olbo-icono-app-1024.svg` (192, 512, maskable, apple-touch, favicon); `theme_color` y `background_color` en `#F0EFF2`; se borran Plus Jakarta, Space Grotesk, Inter, `img/brand-3d` y `img/empty-states` naranjas, y los tokens obsoletos | `grep` sin referencias a las fuentes ni tokens viejos; Lighthouse PWA en verde; el ícono instalado se ve bien en iOS y Android |

## 7. Riesgos y notas

- **CSP:** las posiciones calculadas (chip del día, valor activo de una gráfica) se escriben con `el.style.setProperty('--x', …)` (CSSOM, que
  la CSP permite) y nunca con `style="…"` en el HTML generado. Los SVG del logo no traen `<style>`.
- **Rendimiento en iOS:** como mucho tres capas con `backdrop-filter` visibles a la vez (header, dock y sheet o FAB abierto). Las losas van sin blur.
  No se anima el radio del blur en listas.
- **Contraste:** tinta-3 solo en ejes y divisores; los placeholders van en tinta-2. El lila nunca es texto sobre claro. Hay que revisar la barra de estado
  de iOS sobre perla (MARCA §QA).
- **Nota para branding 1:** el degradado de `--bg-app` es tan sutil que el vidrio a 62 % se lee casi blanco; se sostiene gracias al canto y al gris
  azulado de abajo. Si en el dispositivo se ve plano, se puede subir la lavanda a `#E1DBF2` y la menta a `#D6EBE1`.
- **Nota para branding 2:** MARCA no define qué pasa con los `--cat-*`. Aquí los íconos de categoría quedan en tinta sobre papel (sin color), pero hay que
  confirmar que no se pierde reconocimiento en Movimientos.
- **Nota para branding 3:** el nombre `--canto` convive con los `--canto-1…6` viejos hasta F7, y el dock lleva dos negros (el activo y el FAB). Si en uso
  real se confunden, la alternativa es el activo en pill papel sólida.
- **Copy:** el saludo deja de usar «¡Bienvenido!» y emoji (MARCA: sin exclamaciones). En el mockup, «Dashboard/Analytics» se lee «Resumen/Análisis»,
  y es la única etiqueta que cambia.
