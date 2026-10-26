# Rediseño olbo 2.0 — Brief del orquestador

> Fuente de verdad para TODOS los agentes y sesiones del rediseño. Léelo entero (es corto).
> Estado vivo y siguiente paso: `docs/rediseno/ESTADO.md`. No leas nada más del repo salvo lo que tu tarea pida.

## Qué pidió Doug (dueño)

Rediseño **de marca y UI de alto nivel**, no de UX ni de features. El diseño actual (dark morado, mesh multicolor,
mucho glow) quedó **pesado**. La meta es el lenguaje del estudio **RonDesignLab** (Dribbble: "Salesforce CRM Sales
Analytics", "Ledgerix", "Finora", "Payment Details"). Abierto a un rediseño total, incluso de color base
(propuso naranja como posibilidad, no obligación).

## ADN visual de las referencias (destilado; las imágenes no se versionan)

1. **Bento casi sin espacios**: losas contiguas, gaps 4–8 px, radios grandes (28–40 px exterior), radio hijo = padre − gap.
2. **Minimalismo radical de color**: base neutra clara (`#F0EFF2`, blancos lechosos, grises perla) + **negro casi puro**
   (`#222222`/`#111`) como contraste fuerte + **UN acento saturado** usado con avaricia (lima `#D9F24A`, amarillo `#FBD545`).
   Un verde suave (`#7BD597`) como semántico. Nada de multicolor.
3. **Tipografía delgada y elegante**: grotesk geométrica (tipo *Trip Sans*/Urbanist), pesos 300–400 en cifras display
   enormes (`$1,6m`, `5.99%`), tracking negativo; labels en mayúsculas pequeñas espaciadas o en minúscula gris.
   Una palabra en itálica o en bold dentro de un titular ("Hi Mike, *here's* what's…", "boosted **requests and sales**").
4. **Glassmorphism real**: tarjetas blanco translúcido con blur fuerte sobre **fondos con gradiente suave** (perla→lavanda→
   menta→gris azulado) para que el vidrio se lea. Hairlines blancos, sombras casi inexistentes.
5. **Gráficas finas**: barras verticales de 1–2 px en gris, líneas punteadas, una serie en el acento, chips/pills
   negros con el valor activo, puntos.
6. **Controles pill/circulares**: botones circulares con ícono (↗, ⚙, ×), segmentados minimalistas (Week · **Month** · Quarter
   subrayado o pill negra), dock inferior de círculos con el activo en negro.
7. **Contraste por bloques**: una losa negra o una losa del acento rompe el campo claro (Net Profit negro, Gross Profit lima).

## Restricciones duras del proyecto (de CLAUDE.md, no negociables)

- CSP estricta: cero estilo/script inline (ni `<style>` en SVG). Fuentes **self-hosted** en `fonts/` (woff2, licencia OFL).
- Cero hex fuera de `css/tokens.css`. Animar solo transform/opacity/filter; honrar `prefers-reduced-motion`.
- No tocar la matemática del semáforo (`js/budget.js`). Los 3 colores del semáforo siguen significando estado
  (pueden re-tonarse para la nueva paleta, pero deben seguir siendo verde/ámbar/rojo legibles).
- Privacidad: nada de nombres/montos reales en el repo público. Datos de demo neutros.
- Version bump en cada cambio CSS/JS (`sw.js` CACHE + los `?v=N` de `index.html`). Tests verdes (`node --test`).
- No cambiar `apple-mobile-web-app-status-bar-style`.
- Confirmar con Doug antes de push a `main`/deploy. Se trabaja en la rama `claude/beautiful-meitner-tb12nk`.

## Equipo (orquestador decide modelo y esfuerzo)

| Rol | Modelo · esfuerzo | Skills | Entrega |
|---|---|---|---|
| Orquestador / auditor | Opus · medio | todas (solo lee para auditar) | `ESTADO.md`, aprobaciones, arranque de la siguiente sesión |
| Branding | Opus · alto | `frontend-design`, `ui-ux-pro-max`, `apple-design` | `MARCA.md` (fundamentos) |
| UI lead | Opus · alto | `apple-design`, `ui-ux-pro-max`, `frontend-design` | `SISTEMA-UI.md` + tablero `mockups/tablero.html` |
| Ejecutores (por fase) | Sonnet · medio | `frontend-design` | código en `css/`, `index.html`, `js/views/*` (solo markup de presentación) |
| QA review | Sonnet · medio (Opus si hay regresión) | `apple-design` (checklist) | `QA-<fase>.md`: tests, CSP, contraste AA, 390px, capturas |
| Mockups portafolio | Sonnet · medio | `portfolio-mockups` (Higgsfield) | imágenes + caso en `dougnuken/douguizard` |

## Ciclo por sesión (ahorro de contexto)

Cada sesión hace UNA fase, deja `ESTADO.md` actualizado (qué se hizo, commit, qué sigue, decisiones), hace commit+push a la
rama, y el orquestador arranca la siguiente sesión con un prompt corto que solo apunta a `BRIEF.md` + `ESTADO.md`.
Nadie relee el historial: lo necesario vive en esos dos archivos y en `MARCA.md`/`SISTEMA-UI.md`.
