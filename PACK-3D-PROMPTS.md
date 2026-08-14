# Bolsillo — Pack 3D "Molten Platinum" (brand art)

Análisis de referencias + prompts de generación. Destino de salida: `img/brand-3d/`.
Los prompts van en inglés (los modelos de imagen rinden mejor así). Formato 1:1.

---

## 1. ADN visual extraído de las referencias

**Materiales**
- Platino pulido / aluminio cepillado con reflejos espejo nítidos de estudio.
- Grafito gunmetal oscuro para cuerpos secundarios (cajero, monedas alternas).
- Vidrio ahumado azul-negro (discos del "+", capó del cajero) que difumina luz interna.
- Detalles maquinados: chaflanes, remaches cilíndricos diminutos, cantos estriados de moneda.

**El acento firma**
- UN solo acento: luz naranja fundida **emisiva desde dentro** del objeto (nunca pintura plana).
- Gradiente térmico: naranja quemado profundo `#C33B00` → naranja vivo `#FF7500` → ámbar caliente `#FFB25E`.
- El glow rebota sobre el metal cercano (bounce light cálido) — así se integra el naranja de Bolsillo.

**Luz y fondo**
- HDRI de estudio neutro; streaks largos de softbox rectangular sobre el metal; rim light suave.
- Fondo seamless gris claro `#D7D8DB` con caída vertical sutil (una pieza usa gradiente slate oscuro → gris pálido).
- Sombra de contacto suave; nada más en escena.

**Cámara y movimiento**
- Objeto héroe flotando, inclinado en diagonal dinámica; composición centrada.
- Motion blur fotográfico tipo larga exposición en los bordes/partes externas, **el emblema focal queda tack sharp**.
- Profundidad de campo corta, blur en esquinas.

**Iconografía finanzas**
- Monedas (estilo 1 euro con grabado de mapa), pila explotada de discos, botón "✕", caja fuerte con dial, cajero dispensando recibo, símbolo "+" en vidrio oscuro, espiral de monedas apiladas.

---

## 2. MASTER STYLE BLOCK — v2 GANADORA (anteponer a CADA prompt)

> Receta validada por Doug el 2026-07-25. La v1 (abajo, tachada) salía en modo "estudio
> claro y plano": metal plata brillante + naranja ámbar suave + bajo contraste — NO fiel a
> las referencias. La v2 clava las referencias: **metal oscuro gunmetal, naranja
> incandescente tipo lava muy saturado con bloom, alto contraste, bokeh naranja.**
> Modelo: `gemini-3-pro-image` (Nano Banana Pro) vía API key, aspect ratio 1:1.

```
Premium 3D fintech brand artwork, ultra-high-end CGI product render, Octane/Redshift, cinematic dramatic studio lighting, VERY HIGH CONTRAST.
MATERIALS: dark gunmetal graphite and near-black anthracite chrome with polished silver accents on rims/edges; smoked black glass; hard crisp mirror-like specular highlights (sharp white streaks); deep near-black shadows; machined chamfered edges and tiny cylindrical rivets.
SIGNATURE ACCENT — MOST IMPORTANT: intensely saturated MOLTEN INCANDESCENT ORANGE light glowing FROM WITHIN, like red-hot metal, glowing embers and lava. The core is almost white-hot amber (#FFE0A0) blooming outward through vivid highly-saturated orange (#FF6A00) into deep burnt red-orange (#B02800). Strong bloom and glowing halo that bleeds warmly into the surrounding darkness; warm orange bounce light and caustic reflections licking across the dark metal. The orange must read as pure hot EMITTED light, extremely saturated and high-intensity — never a flat pale wash.
LIGHTING: dramatic studio HDRI, one strong key softbox with long hard specular streaks, deep contrast between bright speculars and near-black metal, subtle cool rim light to separate the object from the background.
BACKGROUND: seamless studio backdrop with a soft vertical gradient (light gray at top fading into a slightly deeper neutral gray); soft contact shadow; nothing else in the scene.
CAMERA & MOTION: hero object floating, tilted at a dynamic diagonal angle; strong cinematic long-exposure motion blur on the outer edges with warm orange bokeh coming off the glowing parts, while the focal emblem stays tack sharp; shallow depth of field with creamy corner blur.
QUALITY: 4K detail, physically-based reflections, clean, crisp, no noise.
DO NOT INCLUDE: text, numbers, logos, people, hands, watermark, cartoon style, plastic toy look, flat washed-out low-contrast lighting, busy background.
FORMAT: square 1:1.
SCENE:
```

## 3. Prompts por pieza (pegar después del SCENE:)

### 01 — coin-ring (monedas en círculo + hub "+")
```
Eight oversized 1-euro-style coins arranged in a perfect circular ring, orbiting a small flat matte-gray disc at the center engraved with a thin plus symbol. Each coin is tilted on its own axis as if orbiting; finishes alternate around the ring: polished silver, black gunmetal chrome, and two coins with a molten-orange glowing enamel section. Coins show finely engraved map-like relief and ridged reeded edges. Subtle rotational motion blur on the outermost coins. For this scene only, the background is a vertical gradient from dark slate gray at the top to pale light gray at the bottom.
```

### 02 — coin-stack (pila explotada de discos)
```
A levitating exploded stack of four thick platinum discs — minimalist oversized coins — separating along a diagonal axis. The middle disc glows: a recessed coin slot and small plus-shaped cutouts on its face are lit from inside with molten orange light, spilling warm reflections onto the discs above and below. Strong diagonal motion blur streaks the top and bottom discs while the glowing middle disc stays sharp.
```

### 03 — keypad-x (matriz de botones con ✕)
```
Close-up three-quarter top view of a machined metal keypad: a diamond-grid matrix of round platinum push buttons, each seated inside a rounded-square brushed-aluminum tile with a soft chamfer. The centered button is tack sharp, engraved with a small dark multiply cross symbol; surrounding buttons fall into blur toward the corners. A single warm molten-orange light streak sweeps in from the upper right, grazing the metal edges.
```

### 04 — safe (caja fuerte incandescente)
```
A rounded-square steel bank safe floating and tilted diagonally, seen from the front. Its door has a circular porthole dial and a rotary spoke handle. The safe interior burns with molten orange-amber light leaking through the door seams and the porthole glass, as if the vault were full of liquid light. Radial spin motion blur around the safe silhouette; the dial and handle stay sharp. Chrome-framed edges catch thin white studio highlights.
```

### 05 — atm (cajero dispensando recibo)
```
A tall dark graphite cash-machine kiosk seen from a low three-quarter angle. Its top hood is a tilted-open panel of smoked glass revealing a molten orange glowing core; a crisp white paper receipt slides out of the front dispensing slot. Vertical long-exposure motion blur ghosts the hood upward; the slot and receipt stay tack sharp. The orange core light reflects down the brushed metal body.
```

### 06 — plus-hero (discos de vidrio oscuro con "+")
```
Extreme macro close-up of two overlapping round discs of dark navy smoked glass framed in black chrome with tiny cylindrical rivets. Inside each disc a bold rounded plus symbol glows hot amber-orange like heated metal, the light diffusing softly through the dark glass. The front plus symbol is tack sharp; everything else melts into heavy motion blur and macro depth of field.
```

### 07 — coin-coil (espiral/resorte de monedas)
```
A springy coiled arc made of dozens of thin graphite and silver coins stacked edge-to-edge, bending like a metallic ribbon spiral. The coins at one end of the coil catch a molten orange glow that fades along the arc into cool platinum. Soft motion blur along the curve; the apex coins stay sharp.
```

### 08 — plus-slab (cruz de aluminio en crop diagonal)
```
An oversized brushed-aluminum plus-shaped slab, viewed at a tight diagonal crop so its arms run off-frame. Molten orange light glows from the inner seams where the slab meets a dark smoked-glass panel behind it, rim-lighting the chamfered edges. Strong lateral motion blur on the far arm; the near corner stays sharp.
```

---

## 4. Ajustes en Google AI Studio

- Modelo preferido: **Imagen 4 / el modelo de imagen más reciente** (mejor foto-realismo CGI). Alternativa: **Nano Banana (Gemini 2.5 Flash Image)**.
- Aspect ratio: `1:1`. Una imagen por corrida; si sale off-style, re-rodar una vez.
- Criterio de aceptación por imagen: fondo gris seamless limpio, naranja como LUZ interna (no pintura), metal con reflejos realistas, motion blur en bordes + foco nítido en el emblema, sin texto ni watermark.

## 5. Nombres de archivo

Pack base v2 (`.jpg`, 1024²): `01-coin-ring` · `02-coin-stack` · `03-keypad-x` ·
`04-safe` · `05-atm` · `06-plus-hero` · `07-coin-coil` · `08-plus-slab`.

Assets v3 (`.jpg`, 1024²) — más contraste + barridos de luz: `10-piggy` · `11-tokens` ·
`12-spiral` · `13-gauge` · `14-wallet`.

Assets v4 (`.jpg`, 1024²) — monedas reales + ray-tracing: `15-coins` (monedas peso
colombiano, escudo con cóndor) · `16-coin-spiral` (espiral de puras monedas).

App icon (moneda con "+" incandescente): master `body4-icon.json` → `icons/icon-1024.png`,
`icon-512.png` (maskable+any), `icon-192.png`, `apple-touch-icon.png` (180²). Se quitó el
`icon.svg` viejo del manifest e index para dejar la moneda como icono único.

---

## 6. MASTER v3 (onboarding actual) — más contraste + barridos de luz

> Feedback de Doug sobre v2: (1) imagen debía calzar con el texto, (2) copy que venda
> funcionalidades con foco en "que no se te escape ni un peso" + control en tiempo real,
> (3) la 06 se veía lavada, faltaba contraste, (4) barridos naranjas más largos/dramáticos.
> v3 lo resuelve: fondo oscuro con viñeta (chiaroscuro), alto contraste, y largos barridos
> de luz naranja tipo light-painting con glow y chispas. Modelo: `gemini-3-pro-image`, 1:1.

```
Premium 3D fintech brand artwork, ultra-high-end CGI product render, Octane/Redshift, cinematic DRAMATIC studio lighting, VERY HIGH CONTRAST chiaroscuro.
MATERIALS: dark gunmetal graphite and near-black anthracite chrome with polished platinum-silver accents on the rims and edges; smoked black glass; hard crisp mirror-like specular highlights (sharp white streaks); deep near-black shadows; machined chamfered edges and tiny cylindrical rivets.
SIGNATURE ACCENT — MOST IMPORTANT: intense, extremely saturated MOLTEN INCANDESCENT ORANGE light, like red-hot metal and lava, PLUS long dramatic SWEEPING STREAKS of glowing orange light whipping across and around the object — fast light-painting / long-exposure light trails with heavy bloom, glowing halos and a few sparks trailing off into the dark. The core is white-hot amber (#FFE0A0) blooming through vivid orange (#FF6A00) into deep burnt red-orange (#B02800). The orange must read as pure hot EMITTED light and energy — never a flat, pale, washed-out wash.
LIGHTING: dark moody studio, one strong key light with long hard specular streaks, strong contrast between bright speculars and near-black metal; the sweeping orange light trails are a major light source casting warm bounce and caustics across the dark metal.
BACKGROUND: deep charcoal-to-black studio gradient backdrop, noticeably darker at the edges (vignette), so the object and the glowing orange pop with high contrast; soft contact shadow; nothing else in the scene.
CAMERA & MOTION: hero object floating, tilted at a dynamic diagonal angle; strong cinematic long-exposure motion blur and long sweeping orange light trails on the outer edges, while the focal subject stays tack sharp; shallow depth of field with creamy corner blur.
QUALITY: 4K detail, physically-based reflections, clean, crisp, no noise.
DO NOT INCLUDE: text, numbers, logos, people, hands, watermark, cartoon style, plastic toy look, flat washed-out low-contrast lighting, busy background.
FORMAT: square 1:1.
SCENE: <escena>
```

### Mapeo del onboarding (imagen ↔ funcionalidad)

| Slide | Asset | Funcionalidad que vende |
|-------|-------|-------------------------|
| 1 | `10-piggy`       | Control en tiempo real — "que no se te escape ni un peso" |
| 2 | `15-coins`       | Captura del gasto por voz/foto (monedas peso colombiano) |
| 3 | `16-coin-spiral` | Claridad — en qué se va tu mes (espiral de monedas) |
| 4 | `13-gauge`       | Semáforo en vivo — verde/ámbar/rojo, tu ritmo del mes |

Escenas v3 en `scratchpad/build-bodies-v3.mjs` (piggy, tokens, spiral, gauge, wallet).
