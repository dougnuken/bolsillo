# Rediseño olbo 2.0 — Estado vivo

> Cada sesión lee `BRIEF.md` + este archivo y nada más del historial. Al terminar su fase: actualiza la tabla,
> anota decisiones/riesgos abajo, commit + push a `claude/beautiful-meitner-tb12nk`, y el orquestador arranca la siguiente.

## Fases

| # | Fase | Sesión · modelo | Estado | Commit / nota |
|---|---|---|---|---|
| 0a | Marca (`MARCA.md`, fuentes, logo SVG) | orquestador → agente Opus alto | ✅ hecho | fundamentos claro + lila `#B49CFF`, Urbanist + Manrope |
| 0b | Sistema UI + tablero (`SISTEMA-UI.md`, `mockups/`) | orquestador → agente Opus alto | ✅ hecho | plan F1–F7 en SISTEMA-UI §6 |
| 0c | QA de diseño (`QA-diseno.md`) | agente Sonnet medio | ✅ hecho | 3 bloqueantes del plan → SISTEMA-UI §8 (obligatorio) |
| 0d | Tablero ronda 2 (gradientes, grano, dock grafito, FAB esfera IA, motion) | agente Opus | ✅ hecho | `tablero.jpg`, `tablero-motion.webm` |
| ✅ | **Aprobación de Doug** (26 oct) | — | aprobado | dirección + textos «Resumen/Análisis», saludo sin «¡Bienvenido!»/emoji; pidió aurora más intensa en la card héroe |
| F1 | Tokens, fuentes, fondo | S1 · Sonnet + QA Sonnet | ✅ | `2497f37` — tokens §2 completos, Urbanist/Manrope, color-scheme light, theme-color perla, grano en `img/`, obsoletos neutros. SW v152 |
| F2 | Shell (dock, FAB, sheets, botones) | S1 · Sonnet + QA Sonnet | ✅ | `2497f37` — dock grafito (activo pill papel, `role=tab`+`aria-selected`), FAB esfera a la derecha, burbujas papel, sheet flotante r38, botones/seg/switch/toast. QA sin bloqueantes |
| F3 | Hoy | S2 · Sonnet + QA Sonnet | ✅ | aurora en «Tu dinero», regla del mes, losas lila/negra, orbe-símbolo, Resumen/Análisis, saludo sin emoji. SW v155 |
| F4 | Registrar + keypad | S2 · Sonnet + QA Sonnet | ✅ | monto Urbanist 300 + caret + meta fecha·cuenta, keypad hundido (pointerdown), pills de categoría (lila), Guardar sticky |
| F5 | Movimientos, Personas, Perfil/cfg | S3 · Sonnet + QA Sonnet | ✅ | losa de mes con trazos por día, una losa por día, íconos monocromos, Perfil/cfg en losas (cfg dentro de sheet = hundido), susurro/vínculo en grafito, `--text-3` fuera de todo texto. SW v157 |
| F6 | Asesor, onboarding, splash | S3 · Sonnet + QA Sonnet | ✅ | orbe = símbolo, burbujas tinta/vidrio, onboarding con gauge/captura/categorías/semáforo en losa aurora tenue + CTA negro (sin brand-3d), splash perla en dos tiempos ~900 ms |
| F7 | Íconos, manifest, limpieza | S4 · Sonnet | ✅ | `77b37af` — íconos Anillo y centro (PNG desde el SVG), manifest `#F0EFF2`, fuera Plus Jakarta/Space Grotesk/Inter, `img/brand-3d|empty-states|tex|onboarding`, `--nav-h-min` y tokens/reglas muertas; CLAUDE.md §2/§4/§5/§10 |
| QA | Verificación final (tests, CSP, AA, 390 px, capturas antes/después) | Sonnet medio | ✅ | `267401f` — sin desborde, consola ni CSP; AA en estados y tarjeta lila; Guardar opaco. Pendientes menores: `.cat-ord-btn` 44×34, toast del onboarding sobre Continuar, dock/FAB ~2 px |
| M1 | Capturas 3x con `tools/capturas.mjs --scale 3` + SHOTLIST | S4 · Sonnet | ✅ | `docs/rediseno/capturas-3x/` (14 JPG 1179×2556 con barra 9:41, 5,8 MB): hoy, análisis, movimientos, personas, perfil, asesor, productos, fab, registrar-metodos, registrar, onboarding-1…4 |
| M2 | Escenas Higgsfield (`gpt_image_2_5`, 3:4, 2k) + composición | S5 · Opus | ✅ | 10 escenas, 27,5 créditos, ninguna regenerada; + widgets glass, ícono, antes/después |
| M3 | Caso `/work/olbo` en `dougnuken/douguizard` (formato largo como MakeaPet: cover, film, story) | S5 · Opus + auditoría orquestador | ✅ | douguizard `f5cdbe3`, PR draft dougnuken/douguizard#9; vitest 145/145, Playwright 96/96, build ok |
| ⏸ | **Confirmación de Doug** antes de merge a `main` (deploy Pages) y del portafolio | — | — | |

## Herramientas

- `tools/capturas.mjs <dir> [--scale 3]` — siembra datos neutros y captura las vistas a 393×852 (sirve el repo él mismo).
- `docs/rediseno/mockups/gen.cjs` regenera `tablero.html`; `render.cjs` lo renderiza a PNG.

## Decisiones y riesgos abiertos

- Degradado de fondo muy sutil (vidrio casi blanco): opción de subir lavanda `#E1DBF2` / menta `#D6EBE1` (SISTEMA-UI §7).
- Copy APROBADO: «Dashboard/Analytics» → «Resumen/Análisis»; saludo sin «¡Bienvenido!» ni emoji.
- Aurora de la card héroe más intensa (APROBADO): tokens `--aurora-*` en SISTEMA-UI.
- Cadena de sesiones S1–S5: ver `CADENA.md`.
- Barra de estado iOS sobre perla: verificar en dispositivo (Doug).
- Íconos de categoría monocromos (se pierde el color por categoría).

## Notas de S1 (F1+F2)

- Splash conserva sus tokens oscuros (`--splash-*`, `--losa-*`) hasta F6.
- Quedan para S2/S3: orbe del header de Hoy y `.chat-msg--yo`/CTAs con `--grad-cta` (texto en tinta), `.hoy-greet` con emoji/«¡Bienvenido!», íconos grandes en `.stat`, «Dashboard/Analytics» sin renombrar.
- `--cat-*` se oscurecieron para leerse sobre claro; F5 decide el monocromo.
- `--nav-h-min` sin uso (borrar en F7); `.tabbar` ya no usa borde vivo.
- Pendiente de Doug: verificar franja de estado iOS sobre perla en dispositivo.

## Notas de S2 (F3+F4)

- `.field__input`, `.field__label` y `.acct-chip` cambiaron de forma GLOBAL (hundido, r18, 52 px, label en minúscula tinta-2): S3 debe revisarlos en Perfil/cfg y onboarding (el hundido al 5 % sobre perla es sutil).
- Minibarras de Gastado = gasto variable de los últimos 10 días (vacías si no hay). Anillo y «Flujo» (losa negra de Análisis) restilados.
- QA: sin bloqueantes. Corregidos: «Te pasaste» (Disponible negativo sin rojo, no da AA sobre lila), solape del chip «hoy» (ini ≤6, fin ≥ dias−4), cifra tile con clamp, `$` lila a .8, velo del botón Guardar.
- Pendiente menor: rodillo del saldo con rojo/verde-text sobre aurora (transitorio, 2,5:1); tokenizar rgba literales; `.susurro__spark` sigue con `--grad-cta` (S3).

## Notas de S3 (F5+F6)

- La «marca de agua olbo» de Perfil era el splash desvaneciéndose en las capturas (no existía como elemento); `tools/capturas.mjs` ahora espera 3 s.
- Copy del asesor alineado al mockup («sin pasarme», «¿Me alcanza para los créditos?»); «Bolsillo» → «olbo» en textos visibles de cfg/Perfil.
- `--grad-cta` ya solo vive en el FAB. Tokens del splash viejo (`--losa-1…6`, `--canto-1…6`, `--halo-1…6`) eliminados.
- Pendiente menor (F7): reglas muertas en views.css (`.hormiga-dot`, `.asesor-top__spark`…), `img/tex/dither.png`, `img/brand-3d`, `img/empty-states`; tokenizar `rgba(255,255,255,.55/.16)` en `.ob2a__via`/`.ob2__cta`.
- Movimientos: las barras usan raíz cuadrada del gasto diario (un arriendo no aplasta el resto).

## Notas de S4 (F7+QA+M1)

- `tools/capturas.mjs`: `--statusbar` (safe-area 59/34 por CDP + overlay 9:41 solo en la captura, con `bypassCSP` únicamente en ese modo) y `--formato jpg`. Datos de demo ampliados (nombre «Ana», 3 meses, créditos, personas placeholder).
- Gráfica del mes: escala raíz con tope en el percentil 85; el chip va sobre su barra salvo en los bordes (día 1 queda a 10 px del borde).
- `.sheet` ya respeta `safe-area-inset-top`. SW v161.

## Ajuste de motion (dock y vistas) · v163

- Etiqueta del dock: ya no es `display:none`. Se pliega a ancho 0 y se abre hasta su ancho natural (`--tab-label-w`, medido en `js/app.js` tras cargar fuentes) con `--ease-suave` (in-out) en `--dur-dock` 420 ms; el texto entra con fundido + escala + desenfoque y sale rápido antes de que el ancho lo recorte. Empuja a las otras pestañas igual al hacer scroll (nav-min) que al cambiar de pestaña. El papel de la pestaña saliente se va rápido y el de la entrante llega con 60 ms de retardo (sin dos píldoras grises cruzadas).
- Cambio de vista: entra con `translateY(14px) scale(.985)` → reposo en `--dur-vista`/`--dur-slow`; la saliente se aparta en `--dur-vista-sale`. Reduced motion: igual que antes (fundido lineal corto).
- Excepción consciente a «solo transform/opacity/filter»: `max-width`/`padding` de la pestaña (4 elementos, como los puntos del onboarding). Pendiente de ver en dispositivo: con «Movimientos» activo el dock queda muy cerca del FAB (ya pasaba antes).
