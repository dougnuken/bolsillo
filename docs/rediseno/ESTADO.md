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
| F3 | Hoy | ídem (QA Opus si el bento falla 2 veces) | — | |
| F4 | Registrar + keypad | ídem | — | |
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
