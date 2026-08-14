# PLAN — Re-skin Bolsillo → Dark Fintech Premium

> **Planeado por:** Fable 5 · 2026-07-25
> **Ejecuta:** Opus 4.8 (este documento es la fuente de verdad de la ejecución)
> **Alcance:** re-skin visual completo. CERO cambios de funcionalidad, datos o flujos. Micro-cambios de markup solo donde el CSS no alcanza (señalados explícitamente).
> **Base:** Bolsillo 0.4 (post-onboarding 3D, commit `134f1de`), PWA vanilla en `/Users/dvargas/Desktop/bolsillo`, deploy GitHub Pages desde `main`. Dev server: `http://127.0.0.1:4150`.

---

## 1. Dirección de arte (destilada de las referencias)

Referencias analizadas: **Finora** (dark + gradiente IA), **Wavix** (wallet naranja, gauges degradados, keypad), **Velixa** (lila, bento analytics), **Nexia** (onboarding B&N). El ADN común:

### 1.1 Los 12 rasgos del look

1. **Canvas casi negro, nunca gris.** Fondo `≈#0B0B0D`. Las tarjetas son la capa que da luz, no el fondo.
2. **Bento apretado y muy redondeado.** Tarjetas edge-to-edge con gaps de **8–10px**, radios **24–28px** exteriores; radio hijo ≈ radio padre − gap. La pantalla se lee como losas contiguas, no como cards flotando en vacío.
3. **Superficies en 3 niveles**: card base `≈#131316`, elemento anidado `≈#1B1B1F`, y **glass translúcido** (`rgba(255,255,255,.05–.12)` + blur en capas fijas). Bordes hairline `1px rgba(255,255,255,.06–.10)` sustituyen a la sombra como definición de forma.
4. **Degradado firma**: horizontal, **naranja cálido → blanco → azul-violeta** (`#FFB088 → #FFE7D6 → #F4F7FF → #9DB4FF → #6E7BF2`, ~100°). **Texto OSCURO encima.** Se usa con avaricia: CTA primario y momento IA. Su escasez es lo que lo hace premium.
5. **Jerarquía numérica display**: cifras grandes en grotesk, símbolo/decimales atenuados (`$12,450`**`.75`**), `tabular-nums`, tracking negativo. Label muted pequeño arriba → cifra enorme → delta semántica con flecha.
6. **Semántica verde/rojo estricta**: verde brillante `≈#4ADE80` = ingreso/positivo (↗), rojo `≈#F87171` = gasto/negativo/fail (↘). Nunca decorativos.
7. **Pills por todas partes**: CTAs full-radius, chips de preset, segmented con **pill deslizante** sobre track oscuro, botón blanco sólido como CTA secundario fuerte.
8. **Iconos en losa**: icono pequeño dentro de rounded-square oscuro (`≈#1F1F23`, radio 12–14px) al inicio de cada fila. Motivo **✦ sparkle** reservado para IA.
9. **Nav flotante glass** con blur fuerte, iconos minimal, activo destacado (pill/glow).
10. **Teclado numérico in-app**: teclas grandes rounded-square oscuras, chips de montos rápidos, CTA pill de color encima.
11. **Gráficas del sistema**: barras redondeadas, período activo relleno de acento con value-chip, resto gris; gauges/progress con degradado **naranja→amarillo**; línea fina sobre barras.
12. **Onboarding editorial**: arte 3D/foto en duotono oscuro, display grande, dots, CTA circular con flecha.

### 1.2 Traducción a identidad Bolsillo (mapeo, no copia)

| Referencia | En Bolsillo se convierte en |
|---|---|
| AI Insights pill + gradiente firma | **Asesor** (orbe `.advisor-orb` + CTA/card de entrada): momento IA con `--grad-cta` |
| Verde/rojo semánticos | Semáforo financiero existente re-derivado brillante para dark |
| Naranja Wavix / marca | **Coral Bolsillo se conserva** como acento (estados activos, chips sel, segment Gasto) — es el extremo naranja del gradiente firma |
| Pill deslizante (segmented) | Tabs Dashboard/Analytics/Recurrentes y segment Ingreso/Gasto (ya existe `.seg__thumb`) |
| Keypad + preset chips | `.keypad` + `.amt` de registrar (ya existen; se visten de losas oscuras) |
| Gauge degradado naranja→amarillo | Barras NEUTRAS de cobertura (el semáforo sigue siendo solo estado) |
| Bento Velixa (acento + dark alternados) | Bento del sheet de Hoy: una tarjeta acento en `--accent-soft` para romper monotonía |

### 1.3 Tipografía

Las referencias usan grotesk neutra con tracking apretado. **Bolsillo ya carga (self-hosted, `base.css:7-20`) Inter var + Space Grotesk var** — la pareja correcta ya está instalada; cambia el **uso**:

- Dinero SIEMPRE `--font-num` (Space Grotesk), `font-variant-numeric: tabular-nums`, `letter-spacing: -0.02em` en display.
- COP es entero: el patrón "decimales atenuados" de Finora se adapta atenuando el **símbolo `$`** (y puntos de miles quedan normales). `.amt__cur` ya está separado en registrar; en el hero de Hoy requiere micro-markup (F3).
- Labels de sección 12–13px `--text-2` weight 500. Display h1 más grande y pesado de lo que pide el instinto: el contraste de escala ES el estilo.
- **No cambiar familias** (CSP bloquea CDNs; cero peso extra; cero riesgo).

---

## 2. Estrategia técnica

`tokens.css` declara "cero hex fuera de este archivo" y el inventario lo confirma: **~95% del color ya fluye por tokens**. La jugada: **conservar TODOS los nombres de tokens y reescribir sus valores a dark** (single-theme, reemplazo destructivo; rollback = git). El trabajo manual restante está listado quirúrgicamente en §5.

Restricciones no negociables del proyecto (verificadas):

- **CSP `style-src 'self'`** (`index.html:8-9`): todo el skin vive en los 4 CSS enlazados. Nada de `<style>` inline, nada de `style=""` inyectado, nada de fuentes/CDN externos.
- **No hay `prefers-color-scheme` ni theme switch**: no introducirlos. Es un flip de valores.
- **SW**: `sw.js:14` `const CACHE = 'bolsillo-shell-v2'` → bump a `v3` al cerrar (network-first revalida en dev, el bump protege el fallback offline).
- Solo `@media` de `prefers-reduced-motion` existen — todo glow/animación nueva debe respetarlas igual.

## 3. Spec de tokens dark (`css/tokens.css`)

> Valores de partida calibrados desde las referencias; se afinan por screenshot. **Mismos nombres**, más los NUEVOS marcados.

```css
/* Superficies */
--bg-0: #0B0B0D;   --bg-1: #0B0B0D;   --bg-2: #131316;
--bg-3: #1B1B1F;                       /* NUEVO: losa anidada (iconos de fila, teclas) */
--scrim: rgba(0, 0, 0, 0.62);          /* sube alpha: negro sobre negro necesita más */

/* Ambiente (mesh oscuro sutil — mismo patrón de --bg-app) */
--wash-coral: rgba(255, 106, 68, 0.10);
--wash-mint:  rgba(110, 123, 242, 0.07);   /* pasa a violeta: eco del gradiente firma */
--wash-top:   rgba(255, 106, 68, 0.06);

/* Glass (ahora translúcido de verdad) */
--glass-1: rgba(255, 255, 255, 0.05);
--glass-2: rgba(255, 255, 255, 0.08);
--glass-3: rgba(255, 255, 255, 0.12);
--glass-tag: rgba(255, 255, 255, 0.06);
--glass-nav: rgba(19, 19, 22, 0.72);
--glass-nav-line: rgba(255, 255, 255, 0.10);
--glass-header: rgba(11, 11, 13, 0.78);
--blur: 16px;  --blur-strong: 22px;  --blur-nav: 28px;
--glass-gloss: rgba(255, 255, 255, 0.08);  /* NUEVO: sustituye los inset blancos .55/.7 */

/* Hairlines */
--line-1: rgba(255, 255, 255, 0.06);
--line-2: rgba(255, 255, 255, 0.09);
--line-3: rgba(255, 255, 255, 0.14);
--line-accent: rgba(255, 106, 68, 0.55);

/* Texto */
--text-1: #F5F5F7;
--text-2: rgba(235, 235, 245, 0.64);
--text-3: rgba(235, 235, 245, 0.44);
--text-inverse: #17140F;   /* AHORA OSCURO: va sobre gradiente firma, pills claras y thumbs de color (AA real, ver §7-D4) */

/* Acento coral (lifted para dark) */
--accent: #FF6A44;  --accent-strong: #FF6A44;  --accent-deep: #E8481F;
--accent-light: #FF8A64;
--accent-soft: rgba(255, 106, 68, 0.14);
--accent-glow: rgba(255, 106, 68, 0.38);

/* NUEVO — Gradiente firma (CTA + IA). Escaso por regla. */
--grad-cta: linear-gradient(100deg, #FFB088 0%, #FFE7D6 26%, #F4F7FF 50%, #9DB4FF 74%, #6E7BF2 100%);
--grad-cta-border: linear-gradient(140deg, #FF9A6B, #6E7BF2);
--sh-ia: 0 12px 30px -10px rgba(110, 123, 242, 0.45), 0 8px 24px -12px rgba(255, 122, 82, 0.35);

/* --fab-grad SE QUEDA CORAL glossy (micro-controles seleccionados: chips, switch on, seg thumb, avatar perfil) */
--fab-grad: linear-gradient(150deg, var(--accent-light), var(--accent-deep));
--fab-rim: rgba(255, 160, 120, 0.45);
--fab-hi: inset 0 1px 0 var(--glass-gloss);

/* Verde glossy (segment Ingreso) re-derivado */
--verde-light: #4ADE80;  --verde-deep: #16A34A;
--verde-rim: rgba(134, 239, 172, 0.45);  --verde-glow: rgba(74, 222, 128, 0.35);

/* Semáforo dark (AA sobre --bg-2) */
--semaforo-verde: #4ADE80;  --semaforo-verde-text: #86EFAC;
--semaforo-verde-bg: rgba(74, 222, 128, 0.13);  --semaforo-verde-line: rgba(74, 222, 128, 0.35);
--semaforo-ambar: #FBBF24;  --semaforo-ambar-text: #FCD34D;
--semaforo-ambar-bg: rgba(251, 191, 36, 0.13);  --semaforo-ambar-line: rgba(251, 191, 36, 0.35);
--semaforo-rojo: #F87171;   --semaforo-rojo-text: #FCA5A5;
--semaforo-rojo-bg: rgba(248, 113, 113, 0.13);  --semaforo-rojo-line: rgba(248, 113, 113, 0.35);

/* Barras neutras */
--track: rgba(255, 255, 255, 0.08);
--bar-ink: #F5F5F7;
--bar-coral: color-mix(in srgb, var(--accent) 55%, #3A2A24);
--grad-gauge: linear-gradient(90deg, #FF6A44, #FFC444);  /* NUEVO opcional, ver D5 */

/* NUEVO — mesh del hero Hoy/onboarding, tokenizado (saca los 12 hex de views.css) */
--hero-mesh:
  radial-gradient(120% 90% at 85% -10%, rgba(255, 138, 100, 0.28), transparent 55%),
  radial-gradient(90% 70% at 0% 0%, rgba(255, 106, 68, 0.16), transparent 50%),
  radial-gradient(100% 80% at 50% 110%, rgba(110, 123, 242, 0.10), transparent 60%),
  linear-gradient(170deg, #141114, #0B0B0D 70%);

/* Tints de categoría: re-derivar cada uno +15–20% luminancia (consumidos vía color-mix).
   Puntos de partida: persona1 #F0808A · persona2 #6FA3E8 · persona3 #A87EEA · yo #4FC4A8 ·
   vivienda #7B97F0 · servicios #4FBBD6 · mercado #7FC55E · transporte #E8A03C · colegio #A87EEA ·
   seguros #4FC4A8 · salud #EE7AA8 · creditos #7B92DE · comisiones #9AA2B4 · ocio #A97CEA ·
   restaurantes #E29A62 · hormiga #D9AE2E · negocios #4FB8D6 · otros #9AA2B4 */

/* Radios (bump bento) */
--r-md: 16px;  --r-lg: 22px;  --r-xl: 28px;  --r-2xl: 34px;

/* Sombras → en dark la elevación es borde + glow, la sombra solo ancla */
--sh-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
--sh-card: 0 1px 3px rgba(0, 0, 0, 0.35);
--sh-sheet: 0 -12px 48px -12px rgba(0, 0, 0, 0.6);
--sh-fab: 0 8px 24px -4px rgba(232, 67, 31, 0.55), var(--fab-hi);
--sh-cta: 0 10px 26px -8px var(--accent-glow), 0 2px 6px -2px rgba(0, 0, 0, 0.5), var(--fab-hi);
--sh-chip-sel: 0 5px 12px -5px var(--accent-glow), var(--fab-hi);
--sh-chip-sel-verde: 0 5px 12px -5px var(--verde-glow), var(--fab-hi);
--sh-md: 0 8px 30px -8px rgba(0, 0, 0, 0.5);
--sh-nav: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 12px 32px -8px rgba(0, 0, 0, 0.55);

color-scheme: dark;   /* además del meta de index.html — pickers nativos iOS en oscuro */
```

## 4. Momentos firma (lo que hace que se sienta como las referencias)

1. **Hero "Hoy"**: el bloque naranja sólido → **canvas oscuro con mesh glow coral** (`--hero-mesh`). Saludo + avatar quedan; el balance pasa a display Finora: label muted 13px → cifra 40px+ Space Grotesk (símbolo `$` atenuado) → delta/estado en pill semáforo con flecha. La costura hero↔sheet (solape −34px) se vuelve sutil: dos oscuros con radio 28px.
2. **CTA con gradiente firma**: `.btn--primary`, `#fab` y `.ob2__cta` pasan a `background: var(--grad-cta)` + `--sh-ia` + texto `--text-inverse` (oscuro). Es EXACTAMENTE el pedido de Doug: naranja→blanco→azul-violeta.
3. **Asesor = momento IA**: `.advisor-orb` con `--grad-cta` + glow `--sh-ia`; card/chips de entrada con borde `--grad-cta-border` (patrón AI Insights).
4. **Bento del sheet**: cards de Hoy en `--bg-2` + hairline `--line-1`, gap 8–10px, radio `--r-xl`, sin sombra (la regla `box-shadow:none` de `views.css:135` ahora es correcta para el look). Una card acento `--accent-soft`.
5. **Tabs pill Finora**: Dashboard/Analytics/Recurrentes conservan su indicador deslizante (`dashboard.js:104-107` lo mide por JS — no cambiar caja del track sin verificar).
6. **Filas de movimientos**: `.mov-row__icon` como losa `--bg-3` radio 12px; monto derecha `--font-num`; `is-in` verde brillante.
7. **Registrar keypad premium**: `.keypad` teclas glass sobre oscuro (ya modelado por `glass-1→2→3`), `.amt` cifra protagonista, seg thumb Gasto coral glossy / Ingreso verde glossy (material existente re-derivado).
8. **Nav flotante glass**: `.tabbar` con `--glass-nav` oscuro + blur 28 + hairline; `.nav-blur` ya existe con blur+mask (compatible tal cual).
9. **Onboarding duotono**: `.ob2__hero` → `--hero-mesh`; drop-shadows marrones de los PNG → glow suave; auditar los 3 PNG sobre oscuro (D2).

## 5. Inventario quirúrgico (hallazgos verificados, por archivo:línea)

**El flip de tokens resuelve ~80%.** Lo que NO se arregla solo:

### 5.1 `index.html` / `manifest.webmanifest` / `sw.js`
| Dónde | Qué | Acción |
|---|---|---|
| `index.html:16` | `theme-color #FAF9F7` | → `#0B0B0D` |
| `index.html:17` | `color-scheme "light"` | → `"dark"` (form controls/teclado/scrollbars iOS) |
| `manifest.webmanifest:11-12` | `background_color`/`theme_color #FAF9F7` | → `#0B0B0D` (evita flash blanco del splash; requiere reinstalar PWA) |
| `sw.js:14` | `CACHE 'bolsillo-shell-v2'` | → `'bolsillo-shell-v3'` al cerrar |
| `index.html:22` | status-bar `black-translucent` | ya correcto, no tocar |

### 5.2 `css/components.css` (supuestos light fuera de tokens)
| Dónde | Qué | Acción |
|---|---|---|
| `731, 776` | inset gloss `rgba(255,255,255,.55)` (cat-chip/acct-chip) | → `var(--glass-gloss)` |
| `887` | inset gloss `.7` del `.switch` off | → `var(--glass-gloss)` |
| `899` | sombra dot switch `rgba(20,16,12,.22)` | dot → casi blanco sólido + sombra negra `rgba(0,0,0,.4)` |
| `316` | glow del `.notif-badge` `rgba(212,42,34,.45)` | → glow del nuevo `--semaforo-rojo` |
| `934-966` | `.toast` = vidrio oscuro sobre canvas claro (`color-mix(text-1 82%)`) | al flip queda **vidrio claro sobre oscuro** — MANTENER la inversión (pill blanca = look referencia); tokenizar los `rgba(255,255,255,.14)` de 953-954 y verificar check verde |
| `1234` | chevron `.field__select` data-URI `#6C7789` | regenerar data-URI con gris claro (o mask + currentColor) |
| `41-55, 230-251` | `.btn--primary` y `.fab` | → `var(--grad-cta)`; validar `brightness(1.06)` hover sobre gradiente por screenshot (regla: hover NO oscurece) |
| `505-513` | `.btn--danger` hover `brightness(1.1)` | sobre fondo translúcido oscuro no se nota → subir alpha en hover |
| `76` | `.card::before { content: none }` (gradient border desactivado) | reactivar SOLO para la card del Asesor (clase dedicada), resto sigue plano |
| `116-153 base` / `169-186` | `saturate(1.6/1.9/1.3)` en header/tabbar/toast | recalibrar (~1.2/1.4/1.1): sobre dark neoniza |
| `352-405, 971-1020` | `.sheet`/`.ov-panel` OPACOS (gradiente bg-2→bg-1) | mantener opacos (95dvh + blur = coste iOS); quedan bien como superficie elevada oscura |
| `1103-1155` | `color-mix(tint 12%, transparent)` iconos mov | subir a 16–20% y glifo hacia `text-1`; espejo en personas (`views.css:1642-1692`) |
| `571-648` | hover voz `color-mix(accent 16%, transparent)` | re-tunear % sobre oscuro |
| `820-824, base 91-95` | focus ring / `:focus-visible` | añadir glow (`0 0 0 3px` accent 22–25%) para no perderse sobre glass |
| `1160-1213` | `.seg__thumb` medido por JS (`colocarThumb`, `registrar.js:455-469`) | NO cambiar padding/border del track sin verificar el pill |

### 5.3 `css/views.css`
| Dónde | Qué | Acción |
|---|---|---|
| `38-46` | mesh naranja `.hoy-layout` (7 hex) | → `background: var(--hero-mesh)` |
| `1474-1477` | mesh naranja `.ob2__hero` (4 hex) | → `var(--hero-mesh)` (unifica los 2 meshes) |
| `55, 64, 71-72` | `#fff` y blancos translúcidos del hero | → tokens (`--text-1`, `--glass-2/3`) |
| `89-117` | `.hoy-sheet__head` sticky con `bg-0` sólido | opción glass: `--glass-header` + blur (única capa sticky con blur permitida) |
| `119-136` | radio `26px` hardcoded + solape −34px | radio → `var(--r-xl)` (28px); revisar costura tras oscurecer |
| `497-499` | `.gauge__tick` stroke `var(--bg-2)` | verificar tras flip (el tick separa segmentos usando el fondo) |
| `1509, 1516, 1524` | halo blanco + drop-shadows marrón `rgba(120,28,0,.34)` de PNGs 3D | → glow suave oscuro (`rgba(0,0,0,.45)` + opcional glow coral) |
| `1597-1621` | avatar perfil comparte `--fab-grad` | se queda CORAL (no gradiente firma) — ya resuelto por el split de tokens §3 |
| `1695-1726` | `.bonus-card` gradiente `accent-soft→transparent` | revisar sobre oscuro (puede ensuciar) |
| `733-738` | barras Negocios forzadas a coral neutro | decisión de producto existente — NO semantizar (ver D5) |
| `179-181` | washes gauge `color-mix` 10–13% | recalibrar % sobre oscuro |
| `647-681` | barchart Ahorro (fills por tokens) | + pulir: `rx` en barras y mes actual acento (micro-markup en `dashboard.js`, opcional F4) |

### 5.4 JS — confirmado limpio
- Único hex: `js/pdf-render.js:76` `#ffffff` — **funcional** (fondo canvas PDF→JPEG), NO tocar.
- Cero colores inline; todo `.style.` es layout/motion. Estados (`pill--${color}`, `is-in`, `notif-item--ambar`, gauge por estado) se resuelven en CSS. SVGs de `categories.js` usan `currentColor`.
- Micro-markup permitido (F3/F4): span para atenuar `$` en hero de Hoy; `rx` en rects del barchart. Nada más.

### 5.5 Assets
- `img/onboarding/{ahorro,registro,semaforo}.png` — 3D pastel/crema con alpha, renderizados para hero naranja claro. **Auditar sobre dark** (halos/lavado). Reemplazos → `img/brand-3d/` (vacía) usando `PACK-3D-PROMPTS.md` en variante dark. Mantener nombres o actualizar `onboarding.js:118,132`.
- `icons/icon.svg` + PNGs: ya indigo oscuro + naranja — compatibles, no tocar.

## 6. Fases de ejecución (para Opus 4.8)

**F0 · Preparación** — rama `reskin-dark`; server arriba (`preview_start` name bolsillo → 127.0.0.1:4150); screenshots "antes" 375×812 de las 11 pantallas de §8.2.

**F1 · El flip** — reescribir `tokens.css` con §3 completo; `index.html` meta ×2; manifest ×2; **verificar por screenshot Hoy + Registrar + un cfg-***. Resultado esperado: app ~80% dark.

**F2 · Depuración components/base** — tabla §5.2 completa, en orden. Screenshot por grupo tocado (chips sel, switch, toast, select, focus).

**F3 · Vistas + momentos firma** — tabla §5.3 + §4: meshes, hero display (micro-markup `$`), CTA/FAB/asesor con `--grad-cta`, bento del sheet, onboarding. Screenshot de cada vista tocada.

**F4 · Números y gráficas** — tabular-nums/tracking display; barchart pulido (opcional); gauge y catbars verificados sobre dark.

**F5 · Assets 3D** — auditoría de los 3 PNG sobre el hero oscuro; si fallan → regenerar (D2) o ajustar tratamiento (glow/escala) sin regenerar.

**F6 · Cierre** — pase de contraste (§8.4), reduced-motion, pickers nativos oscuros, `sw.js` → v3, `node --test` (319/319), screenshots "después" completos, commit `feat: re-skin dark fintech` + push (Pages).

Cada fase termina con su verificación ANTES de pasar a la siguiente. Si una fase revela una decisión no cubierta aquí, se anota en este archivo y se resuelve con el criterio de §1.

## 7. Decisiones (defaults elegidos; Doug puede vetar al ver screenshots)

- **D1 Hero Hoy oscuro** con glow coral (no bloque naranja). Alternativa descartada: naranja full-bleed sobre app dark rompe el canvas unificado de las referencias.
- **D2 PNGs 3D**: auditar primero; regenerar solo si hay halos (los prompts ya existen en `PACK-3D-PROMPTS.md`).
- **D3 Toast claro** (pill blanca sobre dark): la inversión automática coincide con el look de referencia — se mantiene y se pulen sus hardcodes.
- **D4 `--text-inverse` pasa a oscuro**: texto sobre gradiente firma, pill blanca y thumbs coral/verde. Mejora AA real (blanco sobre coral era ~2.6:1; oscuro sobre coral ≈6:1) y es literalmente el patrón Finora.
- **D5 Barras de cobertura Negocios** siguen neutras/coral (decisión de producto previa); el `--grad-gauge` naranja→amarillo queda disponible como opción de F4, no default.
- **D6 Blur budget**: `backdrop-filter` SOLO en `.tabbar`, `.nav-blur` (existente), `.app-header::before`, `.toast` y opcionalmente `.hoy-sheet__head`. Sheets/ov-panel/cards: opacos.

## 8. Reglas duras + verificación

### 8.1 Reglas para el ejecutor
1. Cero hex nuevo fuera de `tokens.css` (los fixes de §5 EXTRAEN hex, nunca añaden).
2. CSP: nada inline, nada de CDN. Todo por los 4 CSS.
3. `--grad-cta` solo en: `.btn--primary`, `#fab`, `.ob2__cta`, asesor (orb + borde de card). Nada más lo usa.
4. Semáforo = solo estado financiero. Verde = suma, rojo = resta, jamás decorativo.
5. Hover NO oscurece (regla de Doug); animar solo `transform`/`opacity`; nuevos efectos respetan `prefers-reduced-motion`.
6. No convertir `<select>`/`<input date>` nativos; verificar dropdowns/sheets por screenshot, nunca por eval.
7. No tocar lógica JS salvo los 2 micro-markups declarados (§5.4).
8. AA mínimo en todo par re-derivado (§8.4).

### 8.2 Screenshots obligatorios (375×812, dev server)
Onboarding (3 slides + paso nombre + cierre confeti), Hoy/Dashboard, Analytics, Recurrentes, Movimientos (con filtros), Registrar (keypad + seg en ambos estados), Perfil, Personas, Asesor, un cfg-* (cuentas), sheet abierto + toast visible.

### 8.3 Tests
`node --test` → 319/319. El re-skin no toca lógica: un test rojo = regresión indebida.

### 8.4 Pase de contraste (medir, no estimar)
`--text-2`/`--text-3` sobre `--bg-0`/`--bg-2`/glass · pills semáforo (text sobre bg tint) · `--text-inverse` sobre `--grad-cta` (tramo más claro Y más oscuro) y sobre thumbs coral/verde · cifras sobre cards · 18 `--cat-*` re-derivados vía color-mix · chevron select · focus ring sobre glass.

### 8.5 Deploy
Bump `sw.js` v3 → verificar hard-reload local → push a `main` (Pages) → probar PWA instalada (nota: el splash toma el manifest nuevo solo tras reinstalar).
