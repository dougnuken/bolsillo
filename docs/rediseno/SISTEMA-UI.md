# olbo 2.0 · Sistema UI

> UI lead, 26 oct 2026. Aplica `MARCA.md` (ley de color, tipo y logo) a componentes. Referencia visual:
> `mockups/tablero.html` + `tablero.css` (código trasladable) y `mockups/pantalla-*.png`. No cambia IA ni flujos:
> cada vista conserva contenido y acciones; cambia piel y composición.

## 1. Principios

1. **Losas contiguas.** Bento a 6 px, gutter lateral 12 px, radio 30. El texto respira dentro de la losa (padding 16–20), no entre losas.
2. **Tres pesos de superficie por pantalla:** vidrio claro (casi todo), **una** losa negra, **como máximo una** aparición lila.
3. **Cifras finas y enormes.** Urbanist 300 con `$` al 45 % en tinta-2; lo demás, Manrope.
4. **Sin sombras.** La profundidad la dan el canto blanco de 1 px y el contraste de bloques. Solo lo que flota (dock, FAB, sheet) lleva sombra.
5. **Blur solo donde hay contenido debajo** (header fijo, dock, FAB, sheets, composer) **y en las dos losas de contraste** (negra y lila).
   Las losas de vidrio claro no llevan `backdrop-filter`: sobre un degradado tan liso el blur no se ve y en iOS cuesta caro.
6. **Material con grano** (ronda 2, Doug): toda superficie lleva ruido fino. El vidrio claro usa `grano-fino.svg` (motas de tinta
   con 0–9 % de alfa) en capa normal; las losas negra y lila y el dock usan `grano.svg` (ruido gris) con `background-blend-mode: soft-light`.
   Los dos son SVG externos con `feTurbulence` en atributos, sin `<style>` (CSP ok); se usan como `background-image` en mosaico de 160 px.
7. **Las líneas finas respiran.** Un único lenguaje de movimiento ambiente, lento y sutil (§5).
8. **La esfera FAB es la única pieza multicolor** del sistema y conserva el ADN de `--grad-cta`.

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
| ★`--lila-leche` `--lila-lavanda` `--lila-hondo` `--grafito` | `#F7F3FF` `#D8CBFF` `#9677FF` `#3A3A42` | variaciones del lila y del negro para los radiales (no son colores nuevos de marca); tinta sobre `--lila-hondo` = 5,3:1 |
| ★`--losa-lila` | radial `--lila-hondo` desde abajo-der. (58 %) + radial `--lila-leche` desde arriba-izq. (55 %) + lineal `--lila-lavanda`→`--lila` 150° | estilo «Account Insights» |
| ★`--losa-negra` | radial lila 34 % abajo-der. + radial `--grafito` arriba-izq. + halo frío `rgba(140,170,255,.14)` abajo + lineal `#26262B`→`#1D1D1F`→`#141416` | |
| ★`--aurora-lila` `--aurora-lavanda` `--aurora-menta` `--aurora-frio` | `#B49CFF` `#D8CBFF` `#B5E3CD` `#B8C8DA` | familia de la aurora (sin naranja: ese es solo del FAB) |
| ★`--aurora` | 6 radiales: lila 36%/46% en 88% 12% · lavanda 46%/44% en 50% 30% · menta 58%/64% en 6% 96% · menta 75 % 40%/46% en 36% 74% · frío 50%/56% en 96% 92% · frío 80 % 34% en 70% 62% (todos hasta su transparente en 72–76 %) | va en `::before` (inset −18 %), `filter: blur(var(--aurora-blur))` estático |
| ★`--aurora-blur` | `26px` | |
| ★`--aurora-velo` | `radial-gradient(70% 38% at 30% 54%, rgba(255,255,255,.42), transparent 78%)` | velo lechoso detrás de la cifra |
| ★`--aurora-vidrio` | `linear-gradient(180deg, rgba(255,255,255,.34), rgba(255,255,255,.06) 46%, rgba(255,255,255,.14))` | el vidrio por encima de la aurora |
| ★`--aurora-tinta-2` | `#3E3E45` | texto secundario, `$` y ejes sobre la aurora: 4,62:1 en el pico (`#B49CFF` puro); tinta = 7,33:1 |
| ★`--aurora-tenue` | `0.62` | opacidad de la aurora en el onboarding |
| ~~`--vidrio-tinte`~~ | reemplazado por `--aurora` | |
| ★`--brillo-vidrio` | `linear-gradient(180deg, rgba(255,255,255,.38), transparent 42%)` | brillo superior de las losas de contraste y héroe |
| ★`--grano` `--grano-fino` | `url(../img/grano.svg)` `url(../img/grano-fino.svg)` | en el mockup, junto al HTML |
| ★`--canto-oscuro` `--canto-color` | `rgba(255,255,255,.12)` `rgba(255,255,255,.55)` | canto de la losa negra / lila |
| ★`--glass-tinta` | `rgba(29,29,31,.80)` | dock oscuro translúcido |
| ★`--sobre-tinta-icono` | `rgba(255,255,255,.86)` | íconos inactivos del dock |
| ★`--fab-naranja/rojo/morado/azul/violeta/crema/leche/hielo` | `#FF7A38 #FF5A4E #C060D8 #4F7BFF #8A7CF0 #FFE3CC #FDF8F4 #DCE4FF` | los de `--grad-cta`, más el rojo |
| ★`--fab-esfera` | especular blanco 32 %/26 % + radial naranja izq. + radial azul der. + radial violeta abajo + lineal crema→leche→hielo | fondo de la esfera |
| ★`--fab-blobs` | 3 radiales (rojo, morado y azul) que derivan en `::before` | |
| ★`--sh-fab-color` | `-10px 14px 26px -12px` naranja 70 %, `10px 16px 28px -12px` azul 70 % y ancla tinta 25 % | la única sombra de color |
| ★`--dur-respira` | `4.2s` | |
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
`--accent-light` → `--lila-tinta`/`--lila`; `--accent-soft`, `--accent-glow`, `--accent-grad`, `--grad-cta-border`, `--grad-edge`, `--fab-grad` y `--fab-glow-*` → `var(--tinta)`
o `transparent` (**`--grad-cta` no se borra: es la base de `--fab-esfera`**);
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
| Losa negra | `--grano` soft-light + brillo + `--losa-negra` | 24 | inset 1 px `--canto-oscuro` + inset superior blanco 16 % | no | 1 por pantalla |
| Losa lila | `--grano` soft-light + `--brillo-vidrio` + `--losa-lila` | 24 | inset 1 px `--canto-color` + inset superior blanco 85 % | no | máx. 1 por pantalla; nunca con otra aparición lila |
| Dock | `--grano` soft-light + `--glass-tinta` | 24 + saturate 170 % | 1 px `--canto-oscuro` + inset superior | `--sh-md` | vidrio grafito tipo «Ask anything» |

Todas las capas de vidrio claro llevan `--grano-fino` como primera capa del fondo. El orden de las capas de una losa es
grano → brillo → gradiente (y blend `soft-light, normal, normal`).

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
- **Losa héroe con aurora** (`.bcard`; `.ob2__art` más tenue): versión en clave olbo del «Credit Factors». Usa `position: relative; overflow: hidden;
  isolation: isolate`. Las capas del fondo, en orden: `--grano-fino` (mosaico de 160), `--aurora-vidrio`, `--aurora-velo` y `--perla`. El canto es
  `inset 0 0 0 1px --canto` más el gloss superior. La aurora va en `::before` (`inset: -18%; z-index: -1; background: --aurora; filter: blur(26px)`) y deriva
  con `transform` en 26 s, `alternate` (translate ±4 %, rotate ±8°, scale ≤1,06). La cifra y el texto principal van en tinta; la etiqueta, el delta, el `$` y los
  ejes, en `--aurora-tinta-2` (nunca tinta-2: da 2,55:1 sobre lila). Trazos del avance: los futuros en tinta al 22 % y los pasados en tinta al 60 %. El botón ↗
  es blanco al 50 %. Con reduced-motion no hay deriva; con reduced-transparency, aurora al 35 % sin blur. Es la única losa de vidrio con color, y la
  aurora se lee como multitono (lila arriba a la derecha y menta/frío abajo), así que no compite con la losa lila de Disponible.
- **Losa negra** (`.stat` Gastado en Hoy, CTA del onboarding, gráfica de flujo en Análisis): padding 16–18, con gradiente radial y grano (§3). Etiqueta y subtexto en sobre-negro-2,
  cifra en blanco, círculo de ícono `--sobre-negro-3` y minibarras de 1,5 px en `--sobre-negro-3` con la última en papel.
- **Losa lila** (`.stat` Disponible en Hoy): gradiente de blanco lechoso (arriba a la izquierda) a lila hondo (abajo a la derecha), con vidrio y grano. Todo el contenido va en tinta, con el círculo de ícono en `--sobre-lila-1`. Mide 170 px de alto en la grilla 2×.
- **Segmentado** (`.seg`, `.seg--dock`): alto 44, padding 4, fondo `--glass-1` con canto. La pastilla es negra (`--seg-solido`) y su texto
  va en papel 600 14; la opción inactiva va en tinta-2. La pastilla se desliza con transform (`--dur`, `--ease`).
- **Chips** (`.cat-chip`, `.mfilter`, `.acct-chip`, `.chat-chip`): alto 36–40, pill, Manrope 600 14 e ícono de 18. Sobre el fondo usan `--glass-1` con canto
  y dentro de un sheet, hundido. El seleccionado va en lila con tinta encima (es la aparición lila de esa pantalla). El chip de estado
  es el tinte del semáforo con un punto de 7 px.
- **Botón circular** (`.icon-btn`): 44 px (34 el pequeño), con ícono de 20 px y trazo de 1,6. Variantes: vidrio, hundido, negro (enviar) y papel.
- **FAB = esfera de IA** (`.fab`): círculo de 60 px con fondo `--fab-esfera` y canto de 1 px blanco al 80 %. Las inset dan la refracción: blanco arriba,
  azul abajo y naranja a la izquierda. La sombra de color es `--sh-fab-color`. `::before` (inset −30 %, `--fab-blobs`, `blur(6px)` estático) rota y escala
  en 14 s lineal; `::after` es el especular superior más el reflejo inferior y deriva 2 px en 7 s. El + va en tinta, de 26 px con trazo 2, y está por encima de todo.
  Es la **única pieza multicolor**. Va **fuera del dock**, a la derecha, en la misma línea.
  Abierto, muestra dos **burbujas** papel (`.fab-bubble`) de 48 px con un ícono ↑ (Gasto) o ↓ (Ingreso) en un círculo hundido y su etiqueta.
  Se elimina el verde y el rojo.
- **Dock** (`.tabbar`): pill de vidrio grafito (`--glass-tinta` con blur y grano), 60 px de alto, padding 5 y `left/right: 12px`. Contraste invertido:
  los inactivos son íconos en `--sobre-tinta-icono` sin fondo (círculos de 48 de área táctil, `aria-label`), y el activo es una **pill papel** con ícono
  y etiqueta en tinta (Manrope 600 14, `aria-current`). El ícono es de línea siempre; se elimina el
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
- **Gráficas finas** (`.catbar`, flujo, categorías del mes; se animan según §5): las barras son de 1,5–2 px en trazo, con la activa en tinta y el promedio en una línea
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
**Motion ambiente (ronda 2):** solo con `transform`/`opacity` y en bucles lentos.
- *Entrada en cascada* de las barras y trazos: `scaleY(0→1)` en 900 ms con `--ease`, con 16 ms de retraso por barra (`transform-origin: bottom`).
- *Respiración en ola*: `scaleY(1 ↔ .72)` en `--dur-respira` (4,2 s) en bucle, con 110 ms de desfase por barra; la ola recorre la serie.
- *Barrido de brillo*: banda blanca del 18 % de ancho que cruza `.barras`/`.chart__barras` con `translateX` cada 5,5 s. Dentro de la losa negra es lila al 35 %.
- *Pulso* del punto activo (`.chart__punto` con una onda `::after` que escala de 1 a 2,4 y se desvanece), del trazo de hoy y de la punta del gauge, en 2,4 s.
- *Esfera FAB*: deriva de los blobs en 14 s y especular en 7 s.
- En la app, los retrasos por índice se escriben con `el.style.setProperty('--i', n)` y `animation-delay: calc(var(--i) * 16ms), calc(900ms + var(--i) * 110ms)`
  (en el mockup van como reglas `nth-of-type` en `tablero-alturas.css`). Se pausan con `animation-play-state: paused` cuando la vista no es visible
  (`visibilitychange` o cambio de ruta).

`prefers-reduced-motion`: todo lo ambiente se apaga (`animation: none`) y queda el estado final. Las transiciones de estado pasan a fundidos de 200 ms.
`prefers-reduced-transparency`: vidrio → `--glass-solido`, dock → tinta sólida.

## 6. Plan de implementación (ejecutores Sonnet, una fase por sesión)

Todas las fases cumplen lo mismo: `node --test` en verde, version bump (`sw.js` CACHE y los 7 `?v=N`), cero hex fuera de
`tokens.css`, cero estilo inline, captura a 393 px de las vistas tocadas comparada con `mockups/pantalla-*.png`, y `ESTADO.md` al día.

| Fase | Archivos | Selectores | Aceptación |
|---|---|---|---|
| **F1** Tokens, fuentes y fondo | `css/tokens.css`, `css/base.css`, `index.html` (preload de fuentes), `img/grano.svg`, `img/grano-fino.svg` (copiados de `docs/rediseno/mockups/`) | `:root` completo (§2), `@font-face` de Urbanist y Manrope, `body`, `body::before` (`--bg-app`), `html` (`--bg-root`), `.num`, `::selection`, `:focus-visible` | La app entera se ve clara y legible aunque los componentes aún no estén ajustados; tinta sobre perla; nada de morado oscuro; obsoletos reasignados; contraste AA en texto base |
| **F2** Shell | `css/components.css`, `index.html` (markup del dock y del FAB), `img/grano*.svg` | `.tabbar` (vidrio grafito), `.tab*` (un solo ícono, activo en pill papel), `.fab` (esfera con `::before`/`::after` animados), `.fab-bubble*`, `.fab-veil`, `.sheet*`, `.scrim`, `.ov-*`, `.icon-btn*`, `.btn*`, `.toast*`, `.seg*`, `.switch` | Dock grafito con el activo en pill papel y la esfera FAB aparte, girando lento y quieta con reduced-motion; sheet flotante de radio 38; burbujas papel; blur solo en dock y sheet; la navegación y los `aria-*` no cambian |
| **F3** Hoy | `css/views.css`, `js/views/dashboard.js` (solo markup de presentación) | `.hoy-greet*`, `.bcard*`, `.hoy-productos*`, `.wcard`, `.stat-row`, `.stat*` (Disponible = lila radial, Gastado = negra radial, ambas con grano y vidrio), `.fijos-card*`, `.catbar*`, `.gauge*`, `.legend`, `.pill*`, `.mesnav`, `.catmes*`, `.negocio*`, `.hormiga-note*` | Igual a `pantalla-hoy.png`; una losa lila y una negra; gauge punteado con los tres estados; los trazos del avance y las minibarras entran en cascada y respiran; «Tu dinero» con la aurora (`--aurora-*`, §4) visible y en deriva lenta, con el texto AA medido en el pico lila; el monto con `$` atenuado; las animaciones del anillo y el saldo siguen funcionando |
| **F4** Registrar y keypad | `css/components.css`, `css/views.css`, `js/views/registrar.js` (solo clases) | `.amt*`, `.keypad*`, `.cat-grid`, `.cat-chip*`, `.acct-chip*`, `.capture-opt*`, `.date-trigger*`, `.field*`, `.detalles*`, `.draft-bar*`, `.voz-*`, `.foto-loading*` | Igual a `pantalla-registrar.png`; keypad hundido con respuesta en `pointerdown`; categoría seleccionada en lila; el botón Guardar siempre visible; el flujo de foto y voz sin cambios |
| **F5** Movimientos, Personas y Perfil/cfg | `css/views.css`, `css/components.css` | `.mov-*`, `.mfilter`, `.list-row`, `.persona-card*`, `.prestamo-card*`, `.perfil-head*`, `.settings-*`, `.cfg-*`, `.wallet-*`, `.pcard*`, `.cc*`, `.tj-res*`, `.notif-*` | Filas agrupadas en una losa por día con íconos monocromos; montos tnum alineados; ningún texto en tinta-3; Perfil sin multicolor |
| **F6** Asesor, onboarding y splash | `css/views.css`, `css/splash.css`, `js/views/asesor.js`, `js/views/onboarding.js` (markup), `index.html` (splash) | `.asesor-top`, `.chat-*`, `.composer*`, `.ob*`, `.ob2*` (sin renders 3D; losa vidrio con el gauge y CTA en losa negra), `#splash` | Igual a `pantalla-asesor.png` y `pantalla-onboarding.png`; arte del onboarding con la aurora a `--aurora-tenue`; el orbe es el símbolo; el splash en perla dura ~900 ms y se reduce a un fundido de 200 ms |
| **F7** Íconos, manifest y limpieza | `icons/*`, `manifest.webmanifest`, `index.html`, `fonts/`, `img/`, `css/tokens.css` | PNG desde `docs/rediseno/marca/olbo-icono-app-1024.svg` (192, 512, maskable, apple-touch, favicon); `theme_color` y `background_color` en `#F0EFF2`; se borran Plus Jakarta, Space Grotesk, Inter, `img/brand-3d` y `img/empty-states` naranjas, y los tokens obsoletos | `grep` sin referencias a las fuentes ni tokens viejos; Lighthouse PWA en verde; el ícono instalado se ve bien en iOS y Android |

## 7. Riesgos y notas

- **CSP:** las posiciones calculadas (chip del día, valor activo de una gráfica) se escriben con `el.style.setProperty('--x', …)` (CSSOM, que
  la CSP permite) y nunca con `style="…"` en el HTML generado. Los SVG del logo no traen `<style>`.
- **Rendimiento en iOS:** como mucho cinco capas con `backdrop-filter` visibles a la vez (header, dock, sheet y las dos losas de contraste). El vidrio claro
  va sin blur. Los blobs del FAB llevan `filter: blur` **estático** (se rota la capa ya desenfocada, no se anima el blur). Las animaciones ambiente
  (~60 elementos con `scaleY`) se pausan fuera de vista; si en un iPhone viejo cae de 60 fps, se apaga la respiración y se deja solo la entrada y el pulso.
- **Grano:** el `feTurbulence` se rasteriza una vez por mosaico (160 px). Si pesa en el primer pintado, se cambia por un PNG de 160×160 (~6 KB).
- **Contraste:** tinta-3 solo en ejes y divisores; los placeholders van en tinta-2. El lila nunca es texto sobre claro. Hay que revisar la barra de estado
  de iOS sobre perla (MARCA §QA).
- **Nota para branding 1:** el degradado de `--bg-app` es tan sutil que el vidrio a 62 % se lee casi blanco; se sostiene gracias al canto y al gris
  azulado de abajo. Si en el dispositivo se ve plano, se puede subir la lavanda a `#E1DBF2` y la menta a `#D6EBE1`.
- **Nota para branding 2:** MARCA no define qué pasa con los `--cat-*`. Aquí los íconos de categoría quedan en tinta sobre papel (sin color), pero hay que
  confirmar que no se pierde reconocimiento en Movimientos.
- **Nota para branding 3:** el nombre `--canto` convive con los `--canto-1…6` viejos hasta F7, y el dock lleva dos negros (el activo y el FAB). Si en uso
  real se confunden, la alternativa es el activo en pill papel sólida.
- **Nota para MARCA (ronda 2):** la esfera FAB reintroduce el multicolor de `--grad-cta` (naranja/rojo → blanco → azul-violeta) como **única** pieza
  multicolor del sistema, por decisión de Doug. MARCA §«Se elimina» debe exceptuar el FAB (y nada más: ni el CTA ni el orbe del asesor).
- **Copy:** el saludo deja de usar «¡Bienvenido!» y emoji (MARCA: sin exclamaciones). En el mockup, «Dashboard/Analytics» se lee «Resumen/Análisis»,
  y es la única etiqueta que cambia.

## 8. Correcciones obligatorias de QA (mandan sobre §2 y §6) — ver `QA-diseno.md`

1. **F1 · color-scheme y theme-color:** `color-scheme: dark` → `light` (`css/tokens.css` y meta en `index.html`) y
   `theme-color` `#0A0519` → `#F0EFF2`. NO tocar `apple-mobile-web-app-status-bar-style`. Doug prueba la franja de iOS en
   su iPhone antes de cerrar F2.
2. **F1 · espaciado:** NO renumerar `--sp-*` (tienen ~400 usos y mueven `--dock-gap`/`--dock-x`). Añadir tokens nuevos
   `--gap-bento: 6px` y `--gutter: 12px` y usarlos solo donde el sistema lo pide.
3. **F1 · `--text-inverse`:** auditar cada uso al invertirlo; ningún texto blanco puede quedar sobre superficie clara.
4. **F2 · geometría real del dock y FAB:** incluir `js/viewport.js`, `--nav-h` (52→60), `nav-min` (`js/app.js` ~l.173),
   `--fab-asoma`, `--view-b`, y los 5 `translateX(-50%)` del FAB centrado en `css/components.css` (pasa a la derecha).
   Dock: `role=tab` + `aria-selected` (no `aria-current`), label accesible en cada ícono.
5. **Contraste:** etiquetas de eje en tinta-2 (no tinta-3); foco sobre negro en blanco/lila claro (≥3:1);
   `--sobre-negro-2` sube a ≥4,5:1 en el punto más claro del grafito.
6. **Tap targets ≥44 px** (área táctil, aunque el dibujo sea menor): `.seg__opt`, `.cat-chip`, `.mfilter`, `.chat-chip`,
   `.toast__act`, `.mov-row__more`, `.icon-btn--s`, `.btn--sm`.
7. **Blur:** las losas `.vidrio` van SIN `backdrop-filter` en la app (el tablero lo usa: no copiar). Máximo 3–5 capas con
   blur visibles (header, dock, sheet, FAB).
8. **Nombres reales:** `.view-head` es `.section-head`; `.composer` es `.chat-bar`.
9. Línea base de tests: **647/647** (CLAUDE.md dice 423; actualizarlo en F7).
