---
name: EX · Portal del candidato
description: Un escaparate en un cuarto de luz cálida; la acción es negra y el único color aparece una sola vez.
colors:
  cielo: "#fbf1e9"
  nube: "#ffffff"
  nube-hundida: "#f4f4f4"
  nube-honda: "#e6e6e6"
  tinta: "#333333"
  tinta2: "#5b5b5b"
  tinta3: "#6b6b6b"
  tinta-invertida: "#ffffff"
  tinta-pulsado: "#0a0a0a"
  regla: "#e6e6e6"
  regla2: "#cbcbcb"
  borde-control: "#8a8a8a"
  activo: "#0a0a0a"
  activo-pulsado: "#404040"
  activo-bruma: "rgba(255, 136, 150, 0.2)"
  activo-regla: "#ff7c61"
  bien: "#0b7a63"
  bien-bruma: "#e6f5f0"
  duda: "#8f5a0a"
  duda-bruma: "#fbf2e4"
  duda-tinta: "#6d4406"
  duda-tinta2: "#87632e"
  mal: "#c22a3f"
  mal-pulsado: "#9e2134"
  mal-bruma: "#fdedf0"
  mal-regla: "#f3c3cc"
typography:
  display:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "clamp(36px, 5.2vw, 60px)"
    fontWeight: 600
    lineHeight: 1.13
    letterSpacing: "-0.03em"
  cifra:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "clamp(28px, 5vw, 34px)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "clamp(24px, 2.4vw, 30px)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  entradilla:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  prosa:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  apoyo:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "normal"
  menor:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  label:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.04em"
rounded:
  superficie: "12px"
  menor: "8px"
  control: "4px"
  marca: "4px"
  barra: "999px"
  escaparate: "20px"
measure:
  ancho: "68rem"
  medida: "50ch"
  medida-corta: "44ch"
spacing:
  e1: "4px"
  e2: "8px"
  e3: "12px"
  e4: "16px"
  e5: "24px"
  e6: "32px"
  e7: "48px"
  e8: "72px"
shadows:
  nube: "0 1px 2px rgba(10,10,10,.05), 0 8px 24px rgba(10,10,10,.06)"
  aviso: "0 12px 24px rgba(10,10,10,.10), 0 32px 64px rgba(10,10,10,.14)"
  control: "0 3px 7px rgba(130,130,130,.15), 0 12px 12px rgba(130,130,130,.13), 0 27px 16px rgba(130,130,130,.08), 0 48px 19px rgba(130,130,130,.02)"
  control-alta: "0 10px 15px -3px rgba(10,10,10,.1), 0 4px 6px -4px rgba(10,10,10,.1)"
components:
  button-accion:
    backgroundColor: "{colors.activo}"
    textColor: "{colors.tinta-invertida}"
    borderColor: "{colors.activo}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
    height: "44px"
    typography: "{typography.apoyo}"
  button-accion-hover:
    backgroundColor: "{colors.activo-pulsado}"
    textColor: "{colors.tinta-invertida}"
    shadow: "{shadows.control-alta}"
  button-accion-disabled:
    backgroundColor: "{colors.nube-honda}"
    textColor: "{colors.tinta3}"
  button-accion-menor:
    backgroundColor: "{colors.activo}"
    textColor: "{colors.tinta-invertida}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
    height: "44px"
    typography: "{typography.apoyo}"
  button-secundario:
    backgroundColor: "{colors.nube}"
    textColor: "{colors.tinta}"
    shadow: "{shadows.control}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
    height: "44px"
    typography: "{typography.apoyo}"
  button-peligroso:
    backgroundColor: "{colors.mal}"
    textColor: "{colors.tinta-invertida}"
    borderColor: "{colors.mal}"
    rounded: "{rounded.control}"
    padding: "0 32px"
    height: "48px"
  input:
    backgroundColor: "{colors.nube}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.menor}"
    padding: "0 12px"
    height: "48px"
    typography: "{typography.body}"
  superficie:
    backgroundColor: "{colors.nube}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.superficie}"
    padding: "24px"
  panel-te-toca:
    backgroundColor: "{colors.nube}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.superficie}"
    padding: "24px"
  panel-espera:
    backgroundColor: "{colors.nube-hundida}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.superficie}"
    padding: "24px"
  panel-en-duda:
    backgroundColor: "{colors.duda-bruma}"
    textColor: "{colors.duda-tinta}"
    borderColor: "{colors.duda}"
    rounded: "{rounded.superficie}"
    padding: "16px"
  etiqueta-te-toca:
    backgroundColor: "{colors.activo-bruma}"
    textColor: "{colors.tinta-pulsado}"
    rounded: "{rounded.marca}"
    padding: "4px 10px"
    typography: "{typography.label}"
---

# Design System: EX · Portal del candidato

> **Estado de la migración (10/09/2026).** Los tokens de este documento son la verdad
> construida: viven en [`src/estilos/mundo.css`](src/estilos/mundo.css) y los consumen las 17
> pantallas, igual que el kit de [`piezas.module.css`](src/estilos/piezas.module.css) y el
> esqueleto de [`pagina.module.css`](src/estilos/pagina.module.css). **En el código del
> candidato ya no queda ningún color del mundo anterior escrito a mano**, y el `<Canto>` está
> borrado.
>
> **La migración terminó el 10/09/2026: las diecisiete pantallas del candidato están
> compuestas.** `/admin` queda fuera por decisión de alcance y conserva su composición
> anterior.
>
> **El detector encuentra dos cosas en el código del candidato, y las dos son deliberadas:**
> el `#ff5d6e` de `--canto` en `mundo.css` —el token vive solo para el panel sin migrar— y el
> degradado de la pieza coral de la portada, que es el componente firma y no se tokeniza hasta
> que un segundo sitio lo pida. Los otros ocho hallazgos están todos en `src/panel/` y son el
> mundo anterior intacto: la pizarra `rgb(35 43 54)` y el violeta `rgb(86 56 214)`.

## Overview

**Creative North Star: «El escaparate»**

Un cuarto gris con una sola pieza iluminada. El fondo no es blanco: es un gris claro y
neutro que hace que las superficies blancas de encima se lean como objetos puestos sobre
una mesa, no como más página. En medio de ese cuarto hay una vitrina —una tarjeta blanca de
borde grueso— y dentro está el producto: el recorrido del candidato, sus cinco etapas, lo
que le toca ahora. No hay una metáfora que explicar antes de entender la pantalla; hay una
cosa mirándote de frente.

De ahí sale la disciplina entera. **La acción es negra**, no de color, porque el negro pleno
sobre gris claro es el contraste más alto disponible y no compite con nada. **El color
aparece una sola vez**: el resplandor coral detrás del escaparate, y la bruma rosa que marca
lo que reclama tu turno. Y las superficies no flotan: se separan del fondo porque están un
punto más claras, no porque tengan sombra.

Se reemplazó a «El canto» —la nube difractando luz, con su espectro y su violeta— el
10/09/2026, después de once direcciones exploradas. El motivo no fue el concepto sino su
rendición: el fondo y las superficies quedaban a un 2 % de diferencia, el espectro salía
pastel, y el portal entero se leía apagado. El tema oscuro no existe y no va a existir: es
petición del cliente.

**Key Characteristics:**

- La acción es negra; el color no es nunca una acción.
- Un solo color en toda la pantalla, y significa «te toca a ti».
- El fondo es gris claro, no blanco: las superficies blancas son objetos encima.
- Los controles tienen esquina corta (4 px), no son píldoras.
- El estado se lee en la forma antes que en el color.
- Solo tema claro.

## Colors

Un gris de fondo, blancos de superficie, tres tintas neutras y un solo coral. La paleta se
divide en dos: los neutros hacen todo el trabajo de lectura, y el color solo marca turno.

### Primary

- **Tinta plena** (`#0a0a0a`): la acción. Todo botón que empieza algo va relleno de este
  negro con texto blanco encima —19,8:1— y esquina de 4 px. **No es un color de marca**: es
  el contraste máximo puesto donde hay que pulsar.
- **Tinta plena pulsada** (`#404040`): el mismo al pasar por encima o al pulsar.
- **Coral** (`#ff7c61`): el borde de 2 px del panel que reclama al candidato, y lo único que
  todavía significa «te toca a ti» en color. **Nunca como texto sobre claro**: da 2,3:1.
- **Bruma rosa** (`rgba(255, 136, 150, 0.2)`): el relleno de la etiqueta que dice que algo
  es tuyo, y el anillo que se abre alrededor de un control activo.

### Neutral

- **Cielo** (`#fbf1e9`): el fondo de la página. Pastel cálido, para que la nube blanca de encima
  se lea como un objeto puesto sobre una mesa. Pasó por `#f5f5f5`, `#fafafa` y blanco puro.
- **Nube** (`#ffffff`): la superficie donde se lee.
- **Nube hundida** (`#f4f4f4`): bloques de apoyo y esperas — lo que acompaña sin pedir nada.
- **Nube honda** (`#e6e6e6`): barras de esqueleto y fondo de lo deshabilitado.
- **Tinta** (`#333333`): titulares y datos. 12,6:1 sobre nube.
- **Tinta segunda** (`#5b5b5b`): la prosa que explica. 6,8:1. Es el color de la mayor parte
  del texto.
- **Tinta tercera** (`#6b6b6b`): pies, unidades, plazos. 5,3:1 sobre nube y 4,9:1 sobre
  cielo. **No bajar de aquí.**
- **Regla** (`#e6e6e6`) y **regla segunda** (`#cbcbcb`): la que divide dentro de un bloque y
  la que cierra uno.
- **Borde de control** (`#8a8a8a`): el contorno de cualquier cosa que se pueda tocar. 3,45:1
  sobre nube. ⚠️ La referencia usaba `#cbcbcb` aquí y da 1,6:1: un campo con ese contorno no
  se ve. Es más oscuro a propósito.

### Tertiary — el semáforo del sistema

Los tres significaban algo fijo en el producto antes que en el diseño, y **no cambiaron al
cambiar de mundo**. Por eso la acción no podía ser ninguno de ellos.

- **Verde de hecho** (`#0b7a63`), sobre **bruma verde** (`#e6f5f0`): lo confirmado.
- **Ámbar de duda** (`#8f5a0a`), sobre **bruma ámbar** (`#fbf2e4`) y con **tinta ámbar**
  (`#6d4406`): lo que no es un error del candidato pero le cambia la decisión.
- **Rojo de fallo** (`#c22a3f`), con **pulsado** (`#9e2134`), **bruma** (`#fdedf0`) y
  **regla** (`#f3c3cc`): el error real y la acción destructiva. Nada más.

### Named Rules

**La regla de la acción negra.** Lo que se pulsa para empezar algo va en `#0a0a0a`. Un botón
de color en esta pantalla compite con la única cosa que tiene permiso para llamar la
atención, que es el turno del candidato.

**La regla del color que aparece una vez.** Por pantalla hay **un** sitio con color: el
resplandor del escaparate, o la etiqueta que dice «te toca a ti». Dos ya es ninguno.

**La regla del semáforo prestado.** Verde, ámbar y rojo ya significan hecho, duda y error.
No se usan para jerarquía, para categorizar ni para decorar.

## Typography

**Display / Body / Label:** Figtree (con `system-ui, sans-serif`), **servida por el propio
sitio** desde `public/tipografia/`. Una sola familia para todo, variable, rango 400–700.

**Character:** una geométrica humanista de formas abiertas y terminales rectos, que a peso
600 y tamaño grande da un titular firme sin gritar. No se usan Inter, Roboto, Geist,
Instrument Sans ni Space Grotesk — el detector las marca como sobreexpuestas.

⚠️ **Es variable y no hay cursiva.** El rango es 400–700: por debajo de 400 el navegador no
tiene nada que interpolar, así que **el peso 200 del mundo anterior ya no existe**. Los
titulares van en 600.

### Hierarchy

Diez escalones, y cada uno tiene un trabajo, no un tamaño. Viven como tokens en `mundo.css`
—`--t-micro` … `--t-portada`—.

- **Display** `--t-portada` (600, `clamp(36px, 5.2vw, 60px)`, 1.13, `-0.03em`, balanceado):
  el titular de cada pantalla. Uno por pantalla y ninguno más.
- **Cifra** `--t-cifra` (600, `clamp(28px, 5vw, 34px)`): el cronómetro y las cifras que hay
  que leer de un vistazo. Siempre con `tabular-nums`.
- **Headline** `--t-destacado` (700, `clamp(24px, 2.4vw, 30px)`, `-0.03em`): el titular de
  una sección dentro de una pantalla.
- **Title** `--t-titulo` (600, 20px): el título de un bloque. Es el valor de `h2`.
- **Entradilla** `--t-entradilla` (600, 18px): el título de una pregunta plegable y el del
  tramo abierto.
- **Body** `--t-base` (400, 16px): el cuerpo y los campos. **Nunca por debajo en un campo de
  texto**: a menos de 16 px iOS hace zoom al enfocarlo.
- **Prosa** `--t-prosa` (400, 15px): la prosa que explica.
- **Apoyo** `--t-apoyo` (500, 14px): el texto de los controles y la interfaz secundaria.
- **Menor** `--t-menor` (400, 13px): pies, unidades, pistas bajo un campo.
- **Label** `--t-micro` (600, 12px, `0.04em`): etiquetas de bloque y píldoras de estado.

### Named Rules

**La regla de la jerarquía tipográfica.** El tamaño y el peso hacen los niveles. Ningún
recuadro, sombra ni fondo existe para crear un nivel que el tamaño ya crea.

**La regla de la frase entera.** No se parten frases con elementos dentro. Poner `<b>`
alrededor de los números de «Pregunta 2 de 4» rompió cuatro pruebas, y por la misma razón por
la que rompe a un lector de pantalla: la frase deja de leerse de una pieza.

## Layout

**El portal mide `--ancho` (68rem) en escritorio, y ese ancho es para componer, no para
leer.** La prosa sigue cortada por `--medida`, así que ensancharlo no alarga una sola línea.

**No todas las pantallas lo usan.** Entrar, crear cuenta, la contraseña olvidada y postular
se quedan en 34–44rem: son formularios, y un formulario ancho se lee peor.

**La medida de la línea son dos tokens:** `--medida` (50ch) para la prosa corriente y
`--medida-corta` (44ch) dentro de un bloque de apoyo.

El ritmo sale de ocho escalones —4, 8, 12, 16, 24, 32, 48 y 72 px— y de una sola regla: se
agrupa apretando y se separa con holgura. Sobre un título va más aire que debajo. Las
secciones de la portada respiran a 72 px y las rejillas se separan 12.

**Puntos de corte: dos del sistema y cuatro de una pantalla.** Los que mandan son **900 px**
—las rejillas de tres pasan a dos y el reparto en columnas se apila— y **640 px**, donde todo
cae a una columna y los carriles estrechan su relleno.

Los otros cuatro son locales, y cada uno vive en una sola hoja porque responde a una pieza y
no al sistema: **1066** (la rejilla de vacantes de la portada), **860** (el encargo y el
trabajo de la prueba dejan de ir en paralelo), **760** (el recorrido de cinco tramos se pone
de pie) y **700** (la portada de «Mi perfil» se sale a sangre). Añadir uno nuevo es una
decisión: si la pieza cabe en 900 o en 640, va ahí.

**Cualquier cosa que se pueda tocar mide 44 px de alto como mínimo**, aunque su texto mida
catorce. Los campos de texto suben a 48 px y nunca bajan de 16 px de letra.

### El esqueleto, en una hoja

El sitio donde se ponen las cosas vive en [`src/estilos/pagina.module.css`](src/estilos/pagina.module.css),
separado de `piezas.module.css` porque son dos preguntas distintas: una pantalla puede
componerse entera sin usar ni un botón. Se trae igual, con `composes`.

| Pieza | Qué es |
|---|---|
| `.hoja` | El carril de 68rem, centrado, con `--e7` de aire arriba |
| `.hojaProsa` · `.hojaFormulario` · `.hojaCorta` | Los otros tres anchos legales: 48, 44 y 34rem |
| `.bloqueHolgado` | El bloque con `--e6` dentro, para lo que llena una pantalla: un formulario |
| `.encabezado` · `.titular` · `.bajada` | El `h1` y la línea que lo sitúa |
| `.reparto` · `.columna` | Una columna que manda y una de 19rem que acompaña; a 900 px se apilan |
| `.bloque` · `.bloqueHundido` · `.tituloBloque` · `.texto` | La superficie de nube y su contenido |
| `.hueco` | **El hueco declarado**: lo que el portal no sabe todavía y dice en vez de rellenar |

⚠️ **Los cuatro anchos son variantes declaradas, no un `max-width` que la pantalla se
escribe encima.** Pisar el de `.hoja` desde la hoja de la pantalla funciona, pero funciona por
el orden en que se juntan las hojas, no porque nadie lo haya decidido. Gana la que se nombra.

⚠️ **Son clases sueltas, nunca selectores de descendiente.** `.encabezado h1` sería más
corto, pero un descendiente que llega por `composes` pesa (0,1,1) y le gana a la clase propia
del consumidor, que pesa (0,1,0): la pantalla que quisiera su bajada en tinta plena no
podría, y el fallo se ve en la pantalla y no en la hoja que lo causa.

⚠️ **`composes` solo admite un selector de clase simple.** No en un compuesto
(`.estadoActual.turno`), no en una lista (`.enviar, .enviar:hover`). PostCSS devuelve un 500
y **la aplicación entera deja de montar**, así que el fallo no es sutil — pero el mensaje
apunta a la hoja, no a lo que lo causó.

### Named Rules

**La regla del panel con dueño.** El tope de línea va en el panel, no en los párrafos de
dentro. Con el tope en el panel, la medida tiene un solo dueño y el bloque no se queda con
medio relleno vacío al ensanchar la ventana.

**La regla del desfase medido.** Un elemento pegajoso que se pega debajo de otro no adivina
su altura: la mide y la guarda en un token junto a la barra que la produce —`--alto-cabecera`,
61 px—.

## Elevation & Depth

**La profundidad es tono, no papel levantado.** Una superficie se separa del fondo porque
está un punto más clara —blanco sobre gris claro—, no porque tenga contorno grueso ni sombra.
Las sombras que hay son difusas, frías y de tinta plena con muy poca opacidad, y aparecen
como respuesta a un estado, nunca en reposo.

### Shadow Vocabulary

- **La nube** (`0 1px 2px rgb(10 10 10 / 0.05), 0 8px 24px rgb(10 10 10 / 0.06)`): el
  escaparate, el botón secundario y la tarjeta al pasar por encima.
- **El aviso** (`0 12px 24px rgb(10 10 10 / 0.10), 0 32px 64px rgb(10 10 10 / 0.14)`): el
  modal, para que se despegue del fondo apagado.
- **El halo del control activo** (`0 0 0 4px var(--activo-bruma)`): un anillo coral sin
  desenfoque. Es un ensanche, no una sombra.
- **El velo** (`--velo`, `rgb(10 10 10 / 0.4)`): lo que se apaga detrás de un modal. Es token
  y no pieza porque sus cuatro consumidores no pueden compartir clase — tres son el
  `::backdrop` de un `<dialog>` nativo, que no acepta `composes`.

### Named Rules

**La regla del plano por defecto.** Una sombra aparece como respuesta a un estado —pasar por
encima, interrumpir, reclamar—, nunca para sugerir que una tarjeta flota.

## Shapes

**Esquina corta, no píldora.** Cinco radios y ninguno más: `--radio` (12px) en superficies,
`--radio-menor` (8px) en campos, `--radio-control` (**4px**) en todos los controles,
`--radio-marca` (4px) en lo más pequeño que se redondea, y 20px en el escaparate, que es la
única pieza que se permite una curva mayor.

⚠️ **`--radio-control` valía 999px en el mundo anterior.** Los botones eran píldoras enteras
y ahora no lo son; cualquier hoja que dé por hecho una píldora está desactualizada.

Los contornos son de 1 px, salvo cuando el grosor está diciendo algo: 2 px marcan el panel
que reclama al candidato, lo elegido y lo erróneo.

El vocabulario de estado del recorrido está **en el grosor y el relleno de la franja**, no en
su color:

| Forma | Qué dice |
|---|---|
| Franja maciza en tinta plena | Formada: etapa superada |
| Franja maciza con la etiqueta de bruma rosa al lado | Viva: te toca a ti |
| Franja en regla | Ausente: todavía no se ha llegado aquí |
| Franja punteada | Dispersa: aquí se detuvo |

### Named Rules

**La regla de la forma primero.** Todo estado tiene que leerse en la forma antes que en el
color. Si al quitarle el color a una pantalla deja de saberse qué pasa, la pantalla está mal.

**La regla de la caja constante.** La caja de una franja mide siempre lo mismo aunque la
franja de dentro cambie. Sin eso, las cinco etapas dejan de leerse como una fila.

## Components

### Buttons

**Una sola especificación, y vive en `src/estilos/piezas.module.css`.** Los botones **no se
escriben en el JSX**: cada pantalla los trae con `composes` desde su propia hoja, de modo que
el botón conserva el nombre de lo que hace y comparte la forma. Ninguna pantalla se dibuja el
suyo.

**Desde el 15/09/2026 la cara del botón es la de `originx.demos.tailgrids.com`**, medida en el
navegador. Una sola altura, **44 px**, que además es el suelo táctil: 20 px de línea más 12 y 12
de relleno. Lo que distingue a la pieza grande de la menor es el relleno horizontal, 20 px contra
16, y nada más.

| | grande | menor |
|---|---|---|
| **Acción** — negro pleno, texto blanco | `.acentoGrande` | `.acentoMenor` |
| **Secundario** — nube con sombra, **sin contorno** | `.secundarioGrande` | `.secundario` |
| **Firme** — relleno de tinta | — | `.solido` |
| **Peligroso** — rojo | `.peligroso` | `.peligrosoMenor`, `.peligrosoContorno` |

- **Shape:** esquina de 4 px (`--radio-control`), sin contorno, letra de **14 px y peso 500** con
  línea fija de 20 px. Sin `letter-spacing` propio.
- **Hover:** el de acción aclara a `#404040` y levanta `--sombra-control-alta`; el secundario
  **no cambia nada**, igual que en la referencia: lo único que se mueve es el rótulo. Todo a
  `300ms` con `--curva-control`, y siempre bajo `:not(:disabled)`.
- **Peligroso:** relleno cuando es la acción destructiva principal de donde está —de la
  pantalla, o del aviso que la confirma—; de contorno cuando es una entre varias, como el
  «Retirarme» de cada fila. El contorno es `--mal` pleno y no `--mal-regla`, que da 1,56:1.
  **No gira el rótulo**: un rótulo que juega no es el gesto de algo que no se puede deshacer.
- **Disabled:** fondo de nube honda, sin contorno propio, tinta tercera, cursor normal.

⚠️ **El secundario PERDIÓ su contorno, y eso empeora el contraste.** `--borde-control` daba
3,45:1 contra el fondo, que es lo que WCAG 1.4.11 pide al límite visible de un control; lo que
lo sostiene ahora es `--sombra-control`, cuatro capas de gris de 3 a 48 px que ni se acercan a
medirse. Este documento decía, literalmente, que el contorno no era negociable. Se cambió el
15/09/2026 a petición expresa, con el número delante: la vuelta atrás es una línea,
`border: 1px solid var(--borde-control)`.

⚠️ **Se fue también el halo coral del hover**, que era un anillo de 4 px en `--activo-bruma`.
La referencia levanta la pieza con una sombra neutra, y de paso el coral deja de aparecer en
pantallas donde no hay ningún turno que marcar.

#### El rótulo que gira

Al pasar por encima, el rótulo sale por arriba y entra otro idéntico por abajo, en 300 ms. Es el
gesto de todos los botones de la referencia.

⚠️ **Hacen falta dos copias del rótulo, y ninguna es el texto real.** La referencia duplica la
etiqueta en el árbol, y eso deja el nombre accesible del botón como «Enviar Enviar» — que además
rompería las 620 pruebas, porque todas localizan por rol y nombre. Aquí las dos copias son
`::before` y `::after`: el texto real se queda, sigue dando el ancho y sigue siendo el nombre
accesible, pero se pinta transparente.

⚠️ **La barra de `content: attr(data-rotulo) / ''` no es un adorno:** le da al pseudoelemento un
texto alternativo **vacío**. Sin ella, las dos copias se sumarían al nombre accesible y
estaríamos donde la referencia. Comprobado leyendo el árbol de accesibilidad del navegador: el
enlace se anuncia una sola vez.

⚠️ **El texto real se apaga con `-webkit-text-fill-color`, no con `color`, y esto costó un
fallo.** Con `color: transparent` a secas el texto real **reaparecía al pasar por encima** y se
veían tres rótulos a la vez: el fijo más los dos que giran. El motivo es especificidad —
`.acentoGrande:hover:not(:disabled)` es (0,3,0) y declara `color`, por encima del (0,2,0) de
`.acentoGrande[data-rotulo]`—, y lo mismo haría cualquier pantalla que le ponga color a su botón
desde su propia hoja, donde además el orden entre archivos no es fiable. Con qué se pinta el
glifo lo decide `-webkit-text-fill-color`, que **nadie más declara en todo el proyecto**: no hay
pelea de cascada posible. `color` se queda también, porque es lo único que entiende un navegador
que no llegue al `@supports`.

⚠️ **Y por eso va todo dentro de un `@supports (content: 'a' / '')`.** Si el navegador no
entiende esa sintaxis la declaración entera es inválida, no habría pseudoelementos y el botón se
quedaría con su texto real transparente, o sea en blanco. Fuera del bloque no se toca nada.

**El giro se activa con `data-rotulo` en el elemento, y eso es deliberado.** Un botón cuyo
rótulo cambia solo —«Guardando…», «Entregando…»— recibe el atributo con la misma expresión, así
que las dos copias cambian a la vez; los cuatro que llevan un icono dentro del rótulo no lo
llevan y se quedan quietos, porque girar texto y dejar el icono parado se ve mal. De 88 botones,
82 giran.

**«Iniciar sesión» también gira, y su regla está escrita aparte.** Esa pieza son dos cajas —el marco
rosa y la cara con la rampa—, así que quien recorta y lleva las dos copias es la cara mientras
quien recibe el ratón es el marco: `.entrar:hover .entrarCara::before`. Es la misma técnica, no
la misma regla, y por eso vive en `Armazon.module.css` y no se compone de `piezas.module.css`.

**Si una pantalla necesita otro color de rótulo, lo pone en `--rotulo-tinta`, no en `color`.**
`color` ya no pinta nada en un botón que gira. Dos lo hacían —`.enviarIgual` y
`.volverAlProceso`— y ahora declaran las dos cosas: la variable para el giro, y `color` para el
navegador que se quede con el texto real.

### Inputs / Fields

- **Style:** 48 px de alto, nube, contorno de 1 px de borde de control, 16 px de letra,
  `--radio-menor`.
- **Focus:** el anillo global —2 px de tinta plena con 3 px de separación— sobre
  `:focus-visible`.
- **Error:** el borde **engorda a 2 px** y se vuelve rojo, en ese orden de importancia. El
  mensaje va debajo, atado al campo con `aria-describedby`, y **dice el problema y cómo se
  arregla** — nunca «campo inválido». El mensaje **no lleva filete lateral**: el borde ya es
  la señal de forma y el texto ya va en `--mal` a 5,68:1; tres señales para una cosa son dos
  de más.
- **Un formulario corto vive en una superficie de nube.** Flotando sobre el cielo se lee como
  página, no como cosa, y en este mundo lo blanco son objetos puestos encima. El titular y el
  pie se quedan fuera: sitúan la pantalla, no forman parte de lo que se rellena.
- **Pero una superficie envuelve una cosa, no un recorrido.** Entrar son tres campos y un
  botón: una cosa sobre la mesa. Postular son varias secciones separadas por reglas que se
  leen de arriba abajo: eso es un documento y va sobre el cielo. Un documento largo metido
  entero en una tarjeta blanca es una losa, no un objeto.

### Cards / Containers

Superficies de nube: fondo blanco sobre el cielo gris, contorno de 1 px de regla, `--radio`,
y 24 px de relleno. **Nunca se anidan superficies con sombra**; lo que va dentro de una
superficie cambia de fondo —a nube hundida— y no de elevación.

**Tres paneles, y cada uno dice algo distinto sobre de quién depende que el proceso siga.**
Viven en `piezas.module.css` junto a los botones, se distinguen por el borde —que es lo que
se ve de lejos— y ninguno lleva relleno propio: cuánto respiran por dentro es del sitio.

| Pieza | Qué dice | Piel |
|---|---|---|
| `.turno` | Te toca a ti | 2 px coral, nube, sombra de la nube |
| `.panelDeEspera` | Se espera a otro | 1 px regla, nube hundida, sin sombra |
| `.enDuda` | Esto te cambia la decisión | 1 px ámbar, bruma ámbar, tinta ámbar |
| `.indispensable` | …y además te descarta | el mismo ámbar, con el borde al doble |

**Una superficie en reposo va plana.** La sombra la lleva lo que reclama —el panel de
turno—, no la caja que lo contiene: si la tarjeta entera ya flota, lo que reclama deja de
distinguirse de lo que no. Las tarjetas de «Mis procesos» eran el caso: llevaban
`--sombra-nube` en reposo y ahora la lleva solo el panel coral de dentro.

⚠️ **Una pantalla pinta `.turno` como mucho una vez, y solo si hay algo contra lo que
discriminar.** El coral sirve para *encontrar* tu turno entre cosas que no lo son; en una
pantalla a la que llegaste porque te tocaba y donde solo hay una cosa que hacer no discrimina
nada, y ahí lo que separa es el titular. Eso deja tres pantallas con coral: «Mis procesos»
(n postulaciones, 0..n reclaman), el detalle de un proceso (cinco etapas, una viva) y «Mi
perfil» (n datos, m sin confirmar).

**El ámbar es la tercera cosa que puede decir un panel**: ni te toca a ti, ni esperas a otro
— mírate esto antes de seguir. Sus dos casos reales son los requisitos indispensables de una
vacante y el aviso de que el formulario de la decisión todavía no envía. El texto de apoyo
que vaya dentro necesita `--duda-tinta2`: `--tinta3` da 4,9:1 sobre el cielo y es el suelo,
sobre un fondo con tinte se cae.

### La pieza del titular

Dentro de la frase «Tu próximo trabajo ▣ puede empezar aquí» hay una loseta coral con un
maletín blanco y una flecha que sube dejando una estela. Es un PNG,
`public/pieza-trabajo.png`, 256×256 y 60 KB.

⚠️ **Hasta el 11/09/2026 era un cuadrado con degradado y su comentario presumía de que «no es
un icono ni significa nada».** Ya no: ahora significa trabajo que progresa, y es **la única
figura literal de todo el portal**. El resto del sistema dice las cosas con forma y color.

⚠️ **El ancho declarado no es el tamaño que se ve**, porque el dibujo no llena la imagen: la
loseta de delante ocupa el **78,5 % del lado** y el resto lo ocupan la loseta girada de detrás y
el aire. Con **1,08em** de imagen se ven 45 px de loseta, que es la medida con la que se compuso
el titular.

⚠️ **Esa fracción cambia con el archivo, y ya cambió una vez.** El PNG del 11/09/2026 traía un
halo rosa pintado dentro y la loseta era el 73 %, así que hacían falta 1,32em para los mismos
45 px. El del 15/09 va recortado al ras: con la anchura de antes la loseta salía a 55 px y se
metía dentro de la palabra «trabajo». **Si se cambia la imagen, se mide la fracción y se vuelve a
sacar el ancho**, no se hereda el número.

⚠️ **Y por lo mismo el margen horizontal pasó de negativo a positivo.** Con el PNG anterior había
que recuperar el aire que el halo transparente metía a los lados; con el de ahora hace falta justo
lo contrario, separarlo de la palabra que tiene al lado.

⚠️ **Se alinea con `vertical-align: middle` Y margen vertical negativo, las dos cosas.** Con un
descuelgue desde la línea base la imagen caía 20 px por debajo y la fuente solo desciende 13:
el titular pasaba de 106 a 111 px. Con `middle` a secas se iba a 115. Juntas, 106 —lo mismo que
sin imagen—.

### El fondo

El cielo es `#FBF1E9`, un pastel cálido, y las superficies de encima son nube blanca: la
separación es de **1,113:1** y vuelve a ser de tono, no solo de contorno. Los contornos de 1 px
se quedan y son los que sostienen lo que va DENTRO de otra superficie.

⚠️ **Está plano a propósito, y el grano procedural se probó y se fue.** Una capa de
`feTurbulence` mezclada con `background-blend-mode: overlay` funciona técnicamente —conserva el
tono cálido, tesela sin costura, pesa ~300 bytes— pero **a tamaño real, en este color tan claro
y sobre una página llena de superficies blancas, no se ve**. Se subió hasta donde se veía y ahí
ya se leía como pantalla sucia, no como papel. No vale la pena volver a intentarlo por CSS: si
el fondo tiene que tener materia, tiene que venir de una imagen con estructura, no de ruido por
píxel.

El 11/09/2026 se probaron además dos resplandores corales desenfocados por toda la página —primero solo arriba, luego repetidos de arriba abajo con una baldosa de 1100 px— y
se retiraron. Lo que dejaron escrito y conviene no volver a aprender:

- **Un degradado que todavía tiene color al llegar al borde de su baldosa se corta en seco
  ahí**, y la repetición convierte ese corte en una raya horizontal visible. La regla es que
  cada degradado se apague dentro de su baldosa: centro = radio, y los dos radios juntos = la
  baldosa.
- **Un tinte de fondo le pone techo al gris más claro del sistema.** Con el coral al 28 %,
  `--tinta3` caía a 3,99:1; el máximo que lo mantenía en 4,5:1 era 0,146.
- **`z-index: -1` no sirve para poner algo detrás**, porque `mundo.css` pinta el cielo en `html`
  **y** en `body`: la de `html` es el lienzo y la de `body` pasa a ser el fondo de una caja de
  bloque normal, que se pinta después de los descendientes de z negativo.

### Navigation

Cabecera fija de 70 px, pegajosa: una barra **insertada 8 px del borde**, con radio
`--radio-menor`, que **en reposo no se ve** —solo la marca y los enlaces sobre el cielo— y saca
su superficie de nube maciza, contorno de `--regla` y `--sombra-nube` **en cuanto la página se
mueve**. La marca a la izquierda; a la derecha, cuatro destinos.

El aire de arriba va de relleno y no de margen: así la barra guarda los mismos 8 px en reposo
y pegada, porque el relleno viaja con la caja pegajosa y un margen se quedaría arriba.

**Tres columnas: marca a la izquierda, destinos al centro, acción a la derecha.** La rejilla es
`1fr auto 1fr` y no `space-between`, porque los destinos tienen que quedar centrados respecto a
la barra y no repartidos: con `space-between` el centro se mueve cada vez que cambia el ancho de
la marca o el texto de la acción —«Iniciar sesión» y «Mi cuenta» no miden lo mismo—. Medido, la
desviación es de 0 px.

**Los enlaces son texto haciendo de botón**, a **16 px, peso 500 y 32 px de separación de texto
a texto** en **tinta plena** (12,63:1): sin contorno, sin relleno y sin pastilla; lo único que dibuja el área táctil de 44 px
es el `min-height`. **La página en la que estás se dice con el color del texto
—`--activo-regla`—, el peso 700 y un filete coral de 2 px que se abre desde el centro** en
300 ms; al pasar por encima de los demás, ese filete se abre en gris.

⚠️ **El peso es lo que los sostiene, no el tamaño.** A 14 px y peso normal los cuatro destinos
se perdían: son lo único que hay en medio de una barra muy ancha y blanca, sin nada debajo. Por
eso subieron a 18 px el 11/09/2026 y **pudieron volver a 16 px el 15/09** —la medida de la
referencia— sin perderse: lo que los sostiene es el 500. En teléfono bajan a 14 px pero **el 500
se queda**.

⚠️ **Los 32 px de separación salen del relleno, no de un `gap`.** `.navegacion` lleva `gap: 0` a
propósito: cada `.enlace` pone 16 px por lado, así que dos contiguos dejan exactamente los 32 px
de la referencia. Un hueco declarado aquí se sumaría al relleno y la barra dejaría de coincidir. Figtree es variable de 400 a 700, así que el
500 no cuesta una descarga más.

⚠️ **El filete anima `left` y `right`, no `transform: scaleX()`.** Un filete de 2 px escalado
en X sigue midiendo 2 px de alto, pero el navegador lo compone desde una caja de ancho completo
y en pantallas densas se ve un pelo más grueso al arrancar; así la caja es de 2 px reales en
todo momento.

WCAG 1.4.1 pide que el color no vaya solo, y no va: le acompañan el peso 700 y el filete.

«Iniciar sesión» es la excepción y la única acción de la barra, y desde el 15/09/2026 es **la pieza de
`originx.demos.tailgrids.com` copiada al valor**, medida en el navegador y no sacada a ojo de una
captura.

Son **dos cajas**, y por eso el enlace lleva un `<span>` dentro que no se puede quitar:

- **El marco** —el `<a>`— es rosa translúcido `rgba(255,136,150,.20)`, 4 px de relleno y esquina
  viva, con **cuatro cuadrados de 3×3 px en las esquinas** en rampa `#FF8268 → #FE7EB2`.
- **La cara** —el `<span>`— lleva la rampa `#FF7C61 → #FF68A5` a 270°, radio 4 px, texto blanco a
  14 px/600, y **dos luces interiores blancas al 20 %**, una arriba y otra abajo, que son las que
  la abomban. Sin ellas la rampa se ve plana y deja de parecerse.

⚠️ **Los cuatro puntos de las esquinas son parte del botón.** En la captura de referencia parecen
marcas de selección de una herramienta de diseño; no lo son. En el original son cuatro `<span>`
absolutos a −1 px. Aquí son cuatro capas de fondo, sin tocar el árbol: el elemento lleva un
**borde transparente de 1 px** para que puedan asomar por fuera del marco —un fondo no se sale de
su caja, pero la caja de borde va 1 px más allá— y `background-clip` mixto, porque **el color de
fondo usa siempre el último valor de esa lista**.

⚠️ **El texto blanco sobre esta rampa da entre 2,70:1 y 2,53:1**, donde WCAG 1.4.3 pide 4,5:1 a
14 px, y **tampoco cumple el 3:1 de 1.4.11** para el límite del control. Es **peor que la rampa
magenta que hubo antes** —`#E0218A → #FF3B5C`, que daba 4,42:1 y 3,48:1— y va así **por petición
expresa del cliente**, que quería la pieza de la referencia igual. El marco rosa se ve, pero al
20 % sobre nube da 1,18:1 y no lo salva. Si algún día hay que cumplirlo, el cambio es de dos
valores: la misma rampa con la luz bajada, `#D81B7E → #C4304B`, que da 4,80:1 y 5,42:1.

⚠️ **Se fue el destello que cruzaba el botón**, y con él lo único que se movía solo en todo el
portal. La pieza de la referencia no lo tiene, y sobre esta rampa un reflejo blanco al 45 %
bajaba todavía más un contraste que ya no llega.

⚠️ **El enlace activo en coral da 2,53:1 sobre la nube**, donde 1.4.3 pide 4,5. Se eligió así
**a sabiendas y mirando el número**: se probó también `#bf4526` —el mismo tono con la luz
bajada, 5,13:1— y se prefirió el coral de marca. El peso 700 acompaña al color, así que la
segunda señal que pide 1.4.1 está; lo que no se cumple es el contraste del texto.

**El coral en la cabecera ya no es solo un filete.** Era la única excepción a «el coral solo
marca te toca a ti» y era pequeña; ahora el coral es el texto activo y el relleno de la
acción. Dentro de las pantallas el coral sigue significando turno y solo turno.

**«Inicio» y «Vacantes» no son lo mismo.** `rutas.vacantes()` es `/`, así que los dos irían
al mismo sitio: «Inicio» es la portada y «Vacantes» es un ancla a `#vacantes-abiertas`, la
sección que ya existe ahí. Por eso «Vacantes» va de `Link` y no de `NavLink` —dos `NavLink`
con la misma ruta se encienden a la vez— y **por debajo de 400 px desaparece**: a 320 px los
cuatro piden 42 px más de los que hay, y es el único que no es una pantalla propia.

**El movimiento de la barra son dos cosas y ninguna más.** La cascada de entrada, 420 ms con
60 ms de desfase entre destinos, que corre **una vez por carga de página** porque `Armazon` se
queda montado mientras el candidato navega. Y el filete del enlace, que **se abre desde el centro
hacia los dos lados** en 300 ms —gris al pasar por encima, coral en el que está activo—.

⚠️ **Eran tres hasta el 15/09/2026.** La tercera era un reflejo blanco que cruzaba «Iniciar sesión»
cada 4,5 s, y se fue con la pieza nueva. Costó acertarle la curva —`--salida` lo hacía saltar en
vez de cruzar—, y esa nota se queda aquí porque el problema vuelve con cualquier destello: una
curva de entrada no sirve para algo que pasa por encima y sale por el otro lado.

El filete anima `left` y `right`, no `transform: scaleX()`: un filete de 2 px escalado en X se
compone desde una caja de ancho completo y en pantallas densas se ve un pelo más grueso al
arrancar.

Con `prefers-reduced-motion` se van la cascada y los desplazamientos; **se quedan el color del
activo y su filete**, que son los que dicen dónde estás.

⚠️ **`--alto-cabecera` se mide, no se calcula.** Son 70 px —8 de aire + 62 de barra—. El
11/09/2026 pasaron por 61 (barra a sangre) y 76 (vaina ovalada flotante), y el 15/09/2026 de 68
a 70, **porque cambió el botón**: «Iniciar sesión» copió la pieza de la referencia y pasó de 44 a
46 px. Seis reglas de cuatro hojas se pinchan debajo de ese número, así que la lista de lo que
obliga a volver a medir incluye el alto del botón, no solo los rellenos.

⚠️ **La barra es transparente mientras no se baja**, así que lo que se pincha bajo
`--alto-cabecera` aparece sobre el cielo hasta el primer scroll. No es un problema: en cuanto
hay scroll —que es cuando algo pasaría por debajo— la barra ya tiene su velo puesto. Medido:
el carril pegajoso se posa exactamente en 70, sin hueco ni solape.

⚠️ **El velo es nube MACIZA, y se probó traslúcida.** Nube al 85 % con `backdrop-filter:
blur(12px)` dejaba leer entero el botón negro de la portada al pasar por debajo: un 15 % de
transparencia no perdona una pieza de máximo contraste. Y el desenfoque detrás de un relleno
opaco no pinta nada, que es por lo que se quitó el vidrio empañado el 10/09/2026.

⚠️ **Aquí hubo un vidrio empañado y se fue el 10/09/2026.** Existía para que la cabecera
dejara ver el canto irisado por detrás; sin canto, desenfocaba un `--cielo` plano en las
diecisiete pantallas a cambio de una capa de compositor en cada una. Quitarlo arregló además
que las barras pegajosas del examen se transparentaran a través de ella al hacer scroll.

### Signature Component — el escaparate

La pieza grande de la portada: una tarjeta blanca de **borde de 12 px en blanco al 40 %** y
radio 20 px, con `background-clip: padding-box` —sin él, el blanco de dentro se cuela por
debajo del borde y lo anula—. Dentro va el recorrido del candidato.

**Detrás de la tarjeta, no dentro**, hay un neón de dos colores: cálido `#FF7C61` por la
izquierda y frío `#FF47B8` por la derecha. **Es un halo ceñido al pie, no un baño**: arranca al
58 % de la altura de la tarjeta, asoma 30 px por debajo y 2 % por los lados, con 24 px de
desenfoque. En teléfono arranca al 80 %, porque ahí la tarjeta mide el doble. La tarjeta no tiene fondo propio —lo pinta `.escaparateDentro`—, así que la luz
cabe entre las dos capas, y su borde translúcido de 12 px la deja intuir por el canto.

⚠️ **Estuvo dentro de la tarjeta hasta el 15/09/2026 y ahí tenía un problema de fondo**: la
tarjeta es lo único que hay que leer en la portada, y meterle luz bajo el texto obligaba a
pelear cada tono —las cuatro capas se suman, `--tinta3` caía a 3,85:1, hubo que subir el texto
de las etapas—. Fuera, el interior vuelve a ser blanco limpio y el problema no existe.

⚠️ **El rosa `#FF47B8` es el único tono del portal fuera de la familia coral.** No es un token
y no debe serlo: existe solo aquí, como luz, y no significa nada.

⚠️ **NO lleva `z-index: -1`, y se intentó.** Es la misma trampa que en el armazón: `mundo.css`
pinta el cielo en `html` **y** en `body`, y el fondo de `body` se pinta después de los
descendientes de z negativo, así que la luz quedaba enterrada —se comprobó poniéndola en rojo
plano y sin desenfoque: no aparecía—. Lo que la coloca bien es el orden natural: el `::before`
va antes que `.escaparateDentro` en el árbol, los dos están posicionados, y sin `z-index` gana
el último.

### El recorrido — cinco tramos, y el estado en la forma

La pieza que sostiene el portal: cinco franjas en fila, una por etapa, y **lo formado se queda
formado**. Vive en `src/paginas/procesos/Seguimiento.module.css`.

El estado se dice con el **grosor y el relleno**, nunca con el color:

| Tramo | Forma |
|---|---|
| Formada | 8 px, maciza en tinta |
| Viva | 12 px, maciza en tinta, con filete blanco alrededor |
| Formándose | 8 px que se desvanecen a la mitad |
| Ausente | filete de 2 px en regla segunda |
| Dispersa | 8 px punteados |

**Con la pantalla en gris se distinguen las cinco.** Es la comprobación de esa hoja y hay que
rehacerla si se toca.

⚠️ **La viva no lleva coral, aunque sea el tramo que te reclama.** El coral lo lleva el panel
`.turno` que cuelga justo debajo, que además lo dice con palabras: dos corales en la misma
postulación no marcan el doble.

### Resto del mundo anterior — el canto

**Ya no queda ninguno en pantalla.** `src/ui/Canto.tsx` y su hoja se borraron el 10/09/2026, y
`Seguimiento` —el último sitio que pintaba `--canto`— adoptó las cinco formas de arriba.

Los tokens `--canto-menta / aqua / rosa / violeta` siguen declarados en `mundo.css` con valores
de la familia coral, y **su único consumidor es la galería de portadas de «Mi perfil»**:
`PORTADAS_DE_LA_CASA` en `src/api/perfil.ts` guarda los códigos `CANTO_*` en el backend, así
que renombrarlos rompería la portada de cualquier perfil existente. Hoy las opciones que el
candidato ve se llaman «Menta», «Aqua», «Rosa» y «Violeta» y se pintan en coral: **eso hay que
resolverlo cuando se recomponga el perfil.** No se usan en composiciones nuevas.

### Motion

**El movimiento aquí sirve a la continuidad y al cambio de estado, no a la decoración.** La
curva es siempre `cubic-bezier(0.16, 1, 0.3, 1)` y la duración por defecto son 300 ms.

Tres registros, y cada uno tiene su trabajo:

**Las cuatro piezas se quedan.** Se implementaron para poder elegir entre ellas y el 10/09/2026
se confirmaron las cuatro: ninguna es gratuita —C dice hasta dónde llegaste, B sostiene la
continuidad al abrir una ficha, D es la respuesta al puntero y A liga las pantallas—. No se
vuelve a discutir sin un motivo nuevo.

La librería es **`motion`** (la antigua Framer Motion). ⚠️ Se probó antes con la View
Transitions API nativa y **se descartó el 10/09/2026 por criterio visual**; no reintentarla sin
que alguien lo pida. Las cuatro piezas viven separadas en
[`src/ui/movimiento.tsx`](src/ui/movimiento.tsx) para poder quitar una sin desmontar el resto:

- **A · La pantalla que entra.** Cada cambio de ruta funde la pantalla vieja y entra la nueva
  con un desplazamiento corto. `mode="wait"`, porque con el ancho fijo del portal dos capas a
  la vez dan un salto de altura.
- **B · El título que viaja.** `layoutId` con el número de la vacante: el título de la tarjeta
  interpola posición y tamaño hasta ser el titular de la ficha. El id lleva el número porque
  en la portada hay una tarjeta por puesto y dos `layoutId` iguales pelean.
- **C · La franja que se llena.** La barra de cada etapa se dibuja de izquierda a derecha,
  escalonada. Es la única cuyo movimiento **significa algo del producto**: dice hasta dónde
  llegaste.
- **D · La tarjeta que responde.** Se levanta al pasar por encima y se hunde al pulsarla. Con
  muelle y no con duración: al pulsar y soltar rápido, una duración fija se siente pegajosa.
  ⚠️ **El levantarse es solo de motion.** Hasta el 10/09/2026 la hoja de la portada subía la
  tarjeta 2 px y la pieza D la subía 4: dos animaciones peleando por el mismo `transform` con
  dos curvas distintas.

⚠️ **Con el reloj corriendo no se mueve nada, y eso se aplica en el armazón.** La regla la
tenían las piezas, pero `PantallaConEntrada` envuelve el `<Outlet>`, así que la evaluación, la
prueba y el cuestionario técnico entraban desplazándose igual que las demás: **la única pieza
que una pantalla no puede rechazar es la que le pone su contenedor**. El rechazo vive en
`movimiento.tsx`, que compara la ruta contra los tres patrones cronometrados.
- **La franja se llena al entrar**, de izquierda a derecha y escalonada por etapa. ⚠️ **Esto
  decía que solo corría «cuando el estado cambió desde la última visita», y era falso**: corre
  en cada montaje, y nunca hubo código que comparase con una visita anterior. Se corrigió el
  texto y no el código porque para comparar hace falta guardar el estado por postulación en el
  navegador, y esa es una decisión de producto que nadie ha tomado. Queda anotado en
  [PENDIENTES](docs/PENDIENTES.md).
- **La microinteracción.** Pasar por encima, pulsar, plegar y desplegar, y el paso de
  esqueleto a contenido con un fundido corto. Son transiciones de estado, no animaciones.

⚠️ **La única prohibición que queda: dentro de la prueba del puesto no se mueve nada.** El
reloj corre y cualquier cosa que se mueva compite con una tarea cronometrada.

### Las pantallas con el reloj corriendo

La evaluación, la prueba y el cuestionario técnico. Tres reglas propias, además de la de no
moverse:

- **El `h1` es la pregunta**, no el nombre de la pantalla, y baja a `--t-titulo`. Un titular de
  60 px sobre un enunciado de tres líneas es ilegible con el reloj corriendo. Lo único que
  sube a `--t-cifra` es el reloj.
- **El cronómetro dice «queda poco» con palabras, no solo con el rojo.** La frase del umbral
  —«Quedan diez minutos»— la emite `Cronometro` en un `role="status"` y vivía en
  `.solo-lectores`: llegaba al lector de pantalla y a nadie más, así que para quien ve y no
  distingue el rojo no había ninguna señal (WCAG 1.4.1). Se hace visible pasándole
  `classNameAviso`. **No es texto nuevo: es texto que ya se decía y no se veía.**
- **Cero superficies anidadas.** El mapa lateral es una lista con regla, no veinte tarjetas con
  sombra: veinte sombras son veinte cosas que llaman.

⚠️ **Al hacer visible la frase, la barra del reloj cambia de alto**, y debajo hay un elemento
pegajoso. `--alto-reloj` —que es local de `Prueba.module.css`, no un token global— guarda el **peor caso medido** —111 px con la frase, 77 sin
ella—, no el común: un hueco de más no molesta, pero tapar el encargo durante los últimos diez
minutos de una prueba cronometrada sí. Es la regla del desfase medido llevada a su caso
difícil: no se mide una vez, se mide en el estado en que el elemento es más alto.

**`prefers-reduced-motion` se respeta en todo lo anterior, sin excepciones.** Esto es un
portal de empleo: una barrera aquí impide postular a un trabajo.

### Named Rules

**La regla del indicador honesto.** Si algo dice que está guardado, tiene que salir de
comparar con el servidor. «Respuesta guardada» como texto fijo ya costó respuestas perdidas.
Y una pregunta en blanco no está guardada: está **sin responder**, que es otra cosa.

**La regla de la plataforma primero.** Antes de traer una librería de componentes, se mira si
el HTML ya lo resuelve. Las preguntas frecuentes usan `<details>`, el aviso de postular usa
`<dialog>` y el formulario apagado de la decisión es un `<fieldset disabled>`: foco atrapado,
tecla de escape y teclado vienen gratis.

## Do's and Don'ts

### Do:

- **Do** poner la acción en `#0a0a0a` con esquina de 4 px. Es la afordancia más importante
  del producto.
- **Do** reservar el coral `#ff7c61` y la bruma rosa para «te toca a ti»: el borde del panel
  que reclama y la etiqueta que lo dice.
- **Do** codificar cada estado en la forma —grosor, relleno, punteado— antes que en el color,
  y comprobarlo con la pantalla en gris.
- **Do** separar una superficie del fondo subiéndola de tono, no poniéndole contorno grueso.
- **Do** traer los botones con `composes` desde `piezas.module.css`, dejando en la hoja local
  solo lo que depende de dónde está el botón.
- **Do** dar 44 px de alto mínimo a todo lo que se pueda tocar, y 48 px con 16 px de letra a
  los campos de texto.
- **Do** usar `tabular-nums` en fechas, cuentas y plazos.
- **Do** decir en voz alta lo que el sistema todavía no puede hacer. Si una evidencia no se
  puede enviar, el formulario va apagado y se explica; no se finge.
- **Do** respetar `prefers-reduced-motion` en cada transición que escribas.
- **Do** adelantarle a la pantalla siguiente el dato que la actual ya tiene, para que abra con
  su contenido en vez de con su esqueleto. La ficha de una vacante lo hace desde la lista.

### Don't:

- **Don't** poner color en un botón. El color no es una acción en este mundo.
- **Don't** usar el coral como texto sobre fondo claro: da 2,3:1.
- **Don't** usar `#cbcbcb` como contorno de un control: da 1,6:1. Los controles piden 3:1 y
  para eso está `--borde-control`.
- **Don't** volver a hacer píldoras: `--radio-control` vale 4 px.
- **Don't** usar verde, ámbar o rojo para jerarquía o categoría: ya significan hecho, duda y
  error.
- **Don't** usar los tokens `--canto*` en nada nuevo. El componente `Canto` ya no existe.
- **Don't** marcar un aviso con un filete de acento a la izquierda. Es la barra lateral de
  siempre, está prohibida en este mundo, y el bloque ya se distingue por su fondo y su
  contorno enteros. **Quedan trece en pantallas sin migrar**; cada tanda se lleva las suyas.
- **Don't** escribir `composes` en un selector que no sea una clase simple. Ni compuesto
  (`.estadoActual.turno`) ni en lista (`.enviar, .enviar:hover`): PostCSS devuelve un 500 y la
  aplicación entera deja de montar.
- **Don't** apoyarse en el orden de las hojas para que un `composes` pierda contra tu regla.
  Si el kit trae `:hover:not(:disabled)` —(0,3,0)— tu `.algo:hover` —(0,2,0)— no gana: átalo a
  un atributo que el marcado ya tenga.
- **Don't** anidar superficies con sombra, ni crear un nivel de jerarquía con un recuadro
  cuando el tamaño de letra ya lo crea.
- **Don't** mover nada dentro de la prueba del puesto, salvo el aviso de que queda poco
  tiempo.
- **Don't** animar por decorar: si el movimiento no dice un cambio de estado ni sostiene la
  continuidad entre dos pantallas, sobra.
- **Don't** repetir en cada carga una animación que significa «algo cambió». Se dispara cuando
  cambió, y solo entonces.
- **Don't** volver a introducir el tema oscuro. Es petición expresa del cliente.
- **Don't** partir una frase con elementos dentro para enfatizar un número.
