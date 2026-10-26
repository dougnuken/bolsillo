# Cadena de sesiones — olbo 2.0

Orquestador: sesión `session_01E92tmu2bpitdqWHvLge2ex` (Opus). Lanza cada sesión, la audita cuando avisa y arranca la
siguiente. Las sesiones de fase NO lanzan otras sesiones (límite de profundidad): solo avisan.

| Sesión | Fases | Modelo | Repo(s) |
|---|---|---|---|
| S1 | F1 tokens/fuentes/fondo + F2 shell (dock, FAB esfera, sheets, botones) | Sonnet | bolsillo |
| S2 | F3 Hoy (aurora, bento, losas, líneas animadas) + F4 Registrar/keypad | Sonnet | bolsillo |
| S3 | F5 Movimientos/Personas/Perfil/cfg + F6 Asesor/onboarding/splash | Sonnet | bolsillo |
| S4 | F7 íconos/manifest/limpieza + QA final + capturas 3x para mockups | Sonnet | bolsillo |
| S5 | Mockups Higgsfield (skill `portfolio-mockups`) + caso `/work/olbo` en douguizard | Sonnet | bolsillo + douguizard |

## Protocolo de cada sesión de fase

1. Lee SOLO `docs/rediseno/BRIEF.md`, `docs/rediseno/ESTADO.md`, y de `SISTEMA-UI.md` las secciones de tu fase + §8
   (obligatorio). `MARCA.md` solo si dudas de color/tipo. Referencia visual: `docs/rediseno/mockups/pantalla-*.png`.
2. Reglas de ahorro: nunca leas `css/components.css` ni `css/views.css` enteros (usa `grep -n` + rangos). Capturas: solo las que necesites.
3. Implementa en la rama `claude/beautiful-meitner-tb12nk` (haz `git pull` primero). Version bump (`sw.js` CACHE + los 7 `?v=N`).
4. Verifica: `node --test 2>&1 | tail -5` (línea base 647/647) y capturas con
   `node tools/capturas.mjs /tmp/cap-<fase>` comparadas con `mockups/pantalla-*.png`.
5. QA: lanza un subagente (Agent, model sonnet) con rol QA: diff de la fase, contraste AA, tap targets ≥44, CSP (cero
   `style=`/`<style>`), animaciones solo transform/opacity + reduced-motion, sin desborde a 390 px. Corrige lo bloqueante.
   Si una corrección falla 2 veces, re-intenta con un subagente `model: opus`.
6. Commit(s) conventional en español, push a la rama. NUNCA a `main`.
7. Actualiza `ESTADO.md` (fila de la fase: ✅ + commit + notas/decisiones) y haz push.
8. Avisa al orquestador: `send_message` a `session_01E92tmu2bpitdqWHvLge2ex` con ≤8 líneas: fases hechas, commit,
   tests, riesgos, rutas de 2–3 capturas clave. Luego termina.
