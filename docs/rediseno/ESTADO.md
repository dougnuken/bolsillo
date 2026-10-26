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
| F5 | Movimientos, Personas, Perfil/cfg | ídem | — | |
| F6 | Asesor, onboarding, splash | ídem | — | |
| F7 | Íconos, manifest, limpieza | ídem | — | |
| QA | Verificación final (tests, CSP, AA, 390 px, capturas antes/después) | Sonnet medio | — | |
| M1 | Capturas 3x con `tools/capturas.mjs --scale 3` + SHOTLIST | Sonnet medio, skill `portfolio-mockups` | — | |
| M2 | Escenas Higgsfield (`gpt_image_2_5`, 3:4, 2k) + composición | Sonnet medio | — | ~13 escenas ≈ 36 créditos |
| M3 | Caso `/work/olbo` en `dougnuken/douguizard` (formato largo como MakeaPet: cover, film, story) | Sonnet medio + revisión Opus | — | |
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
