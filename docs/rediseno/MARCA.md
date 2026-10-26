# olbo 2.0 · Fundamentos de marca

> Decisión del director de branding (26 oct 2026). Es una sola recomendación, no un menú. La aplica el UI lead en
> `SISTEMA-UI.md` y los ejecutores la llevan a `css/tokens.css`. Contrastes calculados con la fórmula WCAG 2.x.

## Concepto

**Papel perla, tinta negra y un solo punto lila: la plata ordenada se ve en calma.**
olbo deja de ser una app oscura y luminosa para parecerse a un buen extracto impreso en vidrio: claro, silencioso y
exacto. El negro da firmeza (lo que pesa, lo que hay que hacer) y el lila marca una sola cosa por pantalla.

## Decisiones de fondo

- **Claro, no oscuro.** Las referencias son claras, y la calma se lee mejor sobre papel que sobre neón. Hay un solo tema.
  El modo oscuro queda fuera de 2.0 (si vuelve, se diseña aparte; no es invertir los tokens).
- **El acento pasa a lila luminoso `#B49CFF`, no a naranja ni a lima.** Hay tres razones:
  1. **Semáforo.** El verde, el ámbar y el rojo ya significan estado. Un acento lima se confunde con «vas bien» y uno
     naranja o amarillo con «cuidado». Las únicas familias de color que no chocan con el semáforo son la azul y la violeta.
     El azul es el color genérico de los bancos; el violeta es el que la marca ya tiene ganado.
  2. **Competencia en Colombia.** Nu tiene el morado profundo (`#820AD1`), Nequi el magenta sobre berenjena,
     Bancolombia el amarillo con negro, Lulo Bank el lima, y Davivienda y Daviplata el rojo. Ninguna usa un lila **claro
     con tinta negra encima**. Así olbo conserva su linaje morado sin parecerse a Nu.
  3. **Calma.** El lima y el naranja son colores de alerta y energía. Un lila claro tiene la misma función de «losa que
     rompe el campo» que el lima de RonDesignLab, con menos tensión. Y no es el degradado morado-rosa típico de las apps de IA.
- **El negro es el segundo protagonista**, no un gris oscuro: va en losas, en el botón principal, en el ítem activo del
  dock y en los chips con el valor activo.

## Paleta

| Token propuesto | Hex | Rol |
|---|---|---|
| `--perla` | `#F0EFF2` | Fondo base, `background_color` y `theme_color` del manifest, color del splash |
| `--papel` | `#FFFFFF` | Superficie sólida: tarjetas sin blur, inputs, sheets cuando se pide menos transparencia |
| `--vidrio` | `rgba(255,255,255,.62)` + `blur(24px) saturate(160%)` | Losas bento. Sobre el fondo da ≈ `#F5F4F9` |
| `--vidrio-fuerte` | `rgba(255,255,255,.82)` + `blur(32px)` | Dock, sheets, barra superior flotante |
| `--canto` | `rgba(255,255,255,.75)` | Borde de 1 px del vidrio (la luz en el canto). Sin sombra, o `0 1px 2px rgba(29,29,31,.04)` |
| `--tinta` | `#1D1D1F` | Texto principal, íconos y **negro de contraste** (losas, botón principal, dock activo) |
| `--tinta-2` | `#64646C` | Texto secundario, etiquetas y unidades (`$`) |
| `--tinta-3` | `#8E8E96` | Solo para lo que no es texto: ejes, divisores y placeholders grandes. Nunca para texto de lectura |
| `--trazo` | `#C9C9CF` | Barras de fondo de gráficas (1–2 px) y líneas punteadas |
| `--lila` | `#B49CFF` | **El acento.** Rellenos de losas, pills y puntos; siempre con contenido en tinta |
| `--lila-tinta` | `#5B3FE0` | El acento cuando tiene que ser texto o trazo sobre claro: enlaces, anillo de foco |
| `--sobre-negro-2` | `#A1A1A8` | Texto secundario dentro de una losa negra |

**Semáforo, re-tonado para fondo claro.** Mantiene su significado; la matemática de `js/budget.js` no se toca.

| Estado | Anillo y gráficas (≥ 3:1) | Texto (≥ 4.5:1) | Tinte de fondo (para chips) |
|---|---|---|---|
| Verde · vas bien | `#25935A` | `#1B7442` | `#D5F0DE` |
| Ámbar · ojo | `#B87206` | `#875806` | `#FBEBC4` |
| Rojo · te pasaste | `#D64545` | `#B83232` | `#F9D9D6` |

El semáforo solo aparece en el anillo, en el chip de estado y en la cifra del ritmo. Ingresos y gastos no van en verde
y rojo: se distinguen por el signo (`+` y `−`, con el menos tipográfico U+2212) y por el ícono, no por el color.

**Fondo de la app** (`--bg-app`, pintado fijo en `body::before`). De arriba hacia abajo:
```
radial-gradient(110% 70% at 12% 0%,   #FAF9FB 0%, rgba(250,249,251,0) 62%),   /* luz perla arriba-izq */
radial-gradient(80% 60%  at 100% 30%, #E7E3F3 0%, rgba(231,227,243,0) 64%),   /* lavanda leve derecha */
radial-gradient(90% 65%  at 0% 100%,  #DDEDE6 0%, rgba(221,237,230,0) 60%),   /* menta abajo-izq */
linear-gradient(180deg, #F0EFF2 0%, #E9EBEF 55%, #E2E7EC 100%)                 /* perla → gris azulado */
```
La franja del safe-area inferior (`--bg-root`, el color sólido de `<html>`) es `#E2E7EC`, el último stop: no hay costura.
El texto **nunca** va directo sobre el degradado; siempre va sobre vidrio, papel o negro.

**Losa negra:** `#1D1D1F` lisa, o con `radial-gradient(70% 60% at 85% 90%, #2C2C31 0%, #1D1D1F 70%)`, que es todo el
brillo que se permite. **Losa lila:** `#B49CFF` lisa, sin degradado.

## Contraste AA (calculado)

| Par | Ratio | Uso permitido |
|---|---|---|
| Tinta / perla · vidrio · papel | 14,69 · 15,38 · 16,83 | Todo |
| Tinta-2 / perla · vidrio · papel | 5,12 · 5,36 · 5,86 | Texto secundario (AA normal) |
| Tinta-3 / papel | 3,25 | Solo texto grande (≥ 24 px) o no-texto |
| Blanco / losa negra | 16,83 | Todo |
| Sobre-negro-2 / losa negra | 6,55 | Secundario dentro de losa negra |
| **Tinta / lila** (texto sobre el acento) | **7,33** | Todo: cifras, labels e íconos sobre losas y pills lila |
| **Lila / perla** (acento como color sobre fondo) | **2,01** | **No pasa**: el lila nunca es texto ni el único borde de un control sobre claro |
| Lila / losa negra | 7,33 | Sí: línea de gráfica, punto o cifra lila dentro de una losa negra |
| Lila-tinta / perla · vidrio | 5,67 · 5,94 | Enlaces y anillo de foco (2 px, separado 2 px) |
| Blanco / lila-tinta | 6,50 | Solo si hace falta un botón sólido lila oscuro (evitarlo) |
| Semáforo texto / perla | 5,06 · 5,35 · 5,18 | Cifra del ritmo y texto de estado |
| Semáforo anillo / perla | 3,40 · 3,37 · 3,82 | Componente gráfico (WCAG 1.4.11, ≥ 3:1) |
| Tinta / tintes del semáforo | 13,90 · 14,25 · 12,76 | Chips de estado |

## El acento, con avaricia

**Sí:** una sola aparición protagonista por pantalla. Puede ser la losa clave (en Hoy, «lo que te queda para gastar»),
el valor activo de una gráfica, el punto del logo, el indicador del paso en el onboarding o el pill del filtro activo
(tinta encima). Dentro de una losa negra el lila puede ser una línea o una cifra.
**No:** en texto sobre claro, en íconos sueltos, en bordes, en degradados ni en sombras de color. Tampoco en el botón
principal (es negro) ni en dos losas a la vez, y nunca para comunicar estado (eso es del semáforo).
Si una pantalla ya tiene una losa lila, todo lo demás se queda en tinta y vidrio.

## Tipografía

Dos familias variables OFL, self-hosted en `fonts/` (licencias al lado), que funcionan como el par Display/Text de Apple:

- **Urbanist** (`fonts/urbanist-latin-var.woff2`, wght 100–900, 27 KB): display, titulares, montos grandes y wordmark.
  Es geométrica pura (las «o» son círculos), la más cercana a Trip Sans y la más fina a 300. No trae `tnum`, así que se
  usa solo en cifras estáticas y grandes.
- **Manrope** (`fonts/manrope-latin-var.woff2`, wght 200–800, 25 KB): todo el texto de interfaz y todas las cifras que
  se alinean o cambian (listas, tablas, inputs, contadores animados), siempre con `font-variant-numeric: tabular-nums`.
  Tiene x-height alta y se lee mejor que Urbanist a 12–16 px.
- No hay una tercera familia ni monoespaciada. Plus Jakarta Sans, Space Grotesk e Inter salen del sistema.

| Estilo | Familia · peso | Tamaño / interlineado | Tracking |
|---|---|---|---|
| Monto héroe | Urbanist 300 | 56 / 1.0 | −0,035 em |
| Display | Urbanist 300 | 40 / 1.05 | −0,03 em |
| Título 1 | Urbanist 400 | 28 / 1.15 | −0,02 em |
| Título 2 | Urbanist 500 | 20 / 1.25 | −0,01 em |
| Cuerpo | Manrope 400 | 16 / 1.5 | 0 |
| Cuerpo S · meta | Manrope 500 | 14 / 1.45 | 0 |
| Etiqueta | Manrope 500 | 12 / 1.35 | +0,02 em, en minúscula y en tinta-2 (sin mayúsculas sostenidas) |
| Cifra en lista | Manrope 500 · tnum | 16 / 1.3 | 0 |
| Eje de gráfica | Manrope 500 · tnum | 11 / 1.2 | +0,02 em, tinta-3 (solo ejes) |

El énfasis se hace con peso, no con color. Se permite **un** cambio de peso dentro de un titular, en Urbanist 300 → 500
y solo en el saludo de Hoy, nunca en cada título. No se usan itálicas.

**Montos COP** (siempre con `formatCOP`, peso entero, puntos de miles):
- `$` atenuado: en tinta-2, al **45 %** del tamaño de la cifra, peso 300, alineado arriba (a la altura de la x), con un
  espacio fino (U+2009) antes del número. Ejemplo: <sup>$</sup> 2.450.000.
- Display en Urbanist 300 con tracking negativo. En listas, Manrope 500 con `tabular-nums` y alineado a la derecha.
- Negativos con `−` (U+2212), nunca con guion. El signo va en la misma tinta que la cifra; el color lo pone solo el semáforo.

## Voz y tono

- **Calmada y directa.** Frases cortas, verbo primero, en español de Colombia con tuteo: «Te quedan $ 412.000 para 9 días».
- **Asesora, no regañona.** Nombra el hecho y la siguiente acción, sin culpa ni signos de admiración. «Vas por encima
  del ritmo. Si bajas a $ 38.000 al día, cierras en verde».
- **Concreta.** Usa cifras y fechas en vez de adjetivos («faltan 3 pagos fijos», no «tienes varios pendientes») y nada de jerga financiera.
- **Discreta.** El lila y los mensajes de la IA hablan poco. Si no hay nada que decir, se queda callada.

## Logo

**El Anillo Partido evoluciona a «Anillo y centro».** Se conserva la geometría (dos arcos de 140°, radio 230,
deslizados ±16 y rotados −28°) para no perder lo ganado. Cambios:
- **Monocromo:** los arcos van en tinta sobre claro o en blanco sobre negro. Desaparecen las losas violetas y el halo del fondo.
- **Trazo más fino:** 96 en lugar de 108 sobre 1024, para conversar con la tipografía delgada.
- **Un punto lila en el centro** (r 62): los arcos son la plata que entra y sale, y el punto eres tú, quieto en el medio.
  Es el único color de la marca.
- **Ícono de app:** losa negra a sangre con los arcos en blanco y el punto lila. La marca ocupa el 56 % central, así que
  sirve como maskable sin cambios.
- **Por debajo de 24 px** (favicon y pestaña): se usa la versión sin punto, con trazo de 108 y radio 192 en un recorte más
  justo. A 16 px el punto se volvería una mancha.
- **Wordmark:** «olbo» en minúsculas, Urbanist 380 con tracking −0,01 em, **convertido a trazados** (no depende de la fuente).
  En el lockup, el símbolo mide el 82 % de la altura del wordmark y va a una distancia de 0,32 de esa altura.
- **Área de respeto:** el radio del anillo hacia todos los lados. Ni sombras, ni degradados, ni deformaciones.
  Sobre lila, la marca va en tinta y sin punto.

Archivos en `docs/rediseno/marca/`: `olbo-icono-app-1024.svg` (para generar los PNG del manifest),
`olbo-icono-app-redondeado.svg` (previews), `olbo-simbolo-tinta.svg`, `olbo-simbolo-blanco.svg`, `olbo-favicon.svg`,
`olbo-wordmark-tinta.svg`, `olbo-wordmark-blanco.svg` y `olbo-lockup-tinta.svg`. Ninguno usa `<style>`: todo va en
atributos, así que cumplen la CSP.

## Splash y onboarding (en claro)

- **Splash** sobre perla `#F0EFF2`, el mismo color del manifest, para que no haya salto de brillo. Los dos arcos en tinta
  entran deslizándose hasta cruzarse (solo `transform`) y al final aparece el punto lila (`opacity` + `scale`).
  Dura ~900 ms. Con `prefers-reduced-motion` es un fundido de 200 ms.
- **Onboarding** sobre `--bg-app`. Cada paso es un titular en Urbanist 300 de 40 px, una losa de vidrio con un ejemplo
  real de la app (el anillo del semáforo o un monto) y abajo una losa negra con el botón. Los puntos de progreso van en
  tinta y el paso actual en lila. Los renders 3D naranjas se retiran.

## Qué se elimina y qué se conserva

**Se elimina:** el fondo oscuro estilo Ontop (`#0A0519` con el radial `#2B2169`) y todos los washes y glows morados;
el gradiente firma multicolor `--grad-cta` (naranja → morado → azul) en el CTA, el FAB y el orbe del asesor, que ahora
son negros (el orbe es el punto lila); las burbujas verde/rojo del FAB (Ingreso y Gasto se distinguen por el ícono y el
signo); las losas violetas del ícono; los renders 3D naranjas de `img/brand-3d` y `img/empty-states`; los tres colores
morados `--accent*`; y las fuentes Plus Jakarta Sans, Space Grotesk e Inter (sus archivos se borran después de migrar).

**Se conserva:** la geometría del Anillo Partido y el wordmark en minúsculas; el linaje violeta (ahora lila claro); el
significado del semáforo y su matemática; el vidrio, ahora claro y sobre degradado suave; la CSP estricta (cero hex
fuera de `tokens.css`); y `apple-mobile-web-app-status-bar-style` sin cambios.

**Para QA:** con fondo claro hay que comprobar en el dispositivo que la barra de estado siga legible con el valor actual
de ese meta, que no se toca. Si no se lee, se escala a Doug antes de hacer cualquier otra cosa. Los cambios de manifest
son `background_color` y `theme_color` → `#F0EFF2`. La regla §5 de `CLAUDE.md` («se mantiene el multicolor») queda
reemplazada por este documento cuando Doug lo apruebe.
