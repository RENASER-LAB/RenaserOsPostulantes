---
name: EX · Portal del candidato
description: Un canto de nube difractando la luz; tu candidatura es la banda de color que se forma tramo a tramo.
colors:
  cielo: "#f6f8fb"
  nube: "#ffffff"
  nube-hundida: "#eef1f6"
  nube-honda: "#dfe4ec"
  tinta: "#232b36"
  tinta2: "#4a5563"
  tinta3: "#68727f"
  tinta-invertida: "#ffffff"
  tinta-pulsado: "#11161d"
  regla: "#e3e7ee"
  regla2: "#cbd2dc"
  borde-control: "#848e9c"
  activo: "#5638d6"
  activo-pulsado: "#4429b8"
  activo-bruma: "#efecfd"
  activo-regla: "#c6bcf7"
  bien: "#0b7a63"
  bien-bruma: "#e6f5f0"
  duda: "#8f5a0a"
  duda-bruma: "#fbf2e4"
  duda-tinta: "#6d4406"
  mal: "#c22a3f"
  mal-pulsado: "#9e2134"
  mal-bruma: "#fdedf0"
  mal-regla: "#f3c3cc"
  canto-menta: "#16a184"
  canto-aqua: "#4f8ac9"
  canto-rosa: "#d2497e"
  canto-violeta: "#6b4be0"
typography:
  display:
    fontFamily: "Mulish, system-ui, sans-serif"
    fontSize: "clamp(32px, 5.2vw, 56px)"
    fontWeight: 200
    lineHeight: 1.06
    letterSpacing: "-0.03em"
  cifra:
    fontFamily: "Mulish, system-ui, sans-serif"
    fontSize: "clamp(28px, 5vw, 34px)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Mulish, system-ui, sans-serif"
    fontSize: "clamp(20px, 2.1vw, 24px)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.022em"
  title:
    fontFamily: "Mulish, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  entradilla:
    fontFamily: "Mulish, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  body:
    fontFamily: "Mulish, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  prosa:
    fontFamily: "Mulish, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  apoyo:
    fontFamily: "Mulish, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  menor:
    fontFamily: "Mulish, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  label:
    fontFamily: "Mulish, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0.08em"
rounded:
  superficie: "14px"
  menor: "10px"
  marca: "4px"
  control: "999px"
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
components:
  button-acento-grande:
    backgroundColor: "{colors.activo}"
    textColor: "{colors.tinta-invertida}"
    rounded: "{rounded.control}"
    padding: "0 32px"
    height: "48px"
    typography: "{typography.body}"
  button-acento-grande-hover:
    backgroundColor: "{colors.activo-pulsado}"
    textColor: "{colors.tinta-invertida}"
  button-acento-grande-disabled:
    backgroundColor: "{colors.nube-honda}"
    textColor: "{colors.tinta3}"
  button-acento-menor:
    backgroundColor: "{colors.activo}"
    textColor: "{colors.tinta-invertida}"
    rounded: "{rounded.control}"
    padding: "0 24px"
    height: "44px"
    typography: "{typography.prosa}"
  button-secundario:
    backgroundColor: "{colors.nube}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.control}"
    padding: "0 24px"
    height: "44px"
    typography: "{typography.prosa}"
  button-secundario-disabled:
    backgroundColor: "{colors.nube-honda}"
    textColor: "{colors.tinta3}"
  button-solido:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.nube}"
    rounded: "{rounded.control}"
    padding: "0 24px"
    height: "44px"
    typography: "{typography.prosa}"
  button-peligroso:
    backgroundColor: "{colors.mal}"
    textColor: "{colors.tinta-invertida}"
    rounded: "{rounded.control}"
    padding: "0 24px"
    height: "48px"
  input:
    backgroundColor: "{colors.nube}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.menor}"
    padding: "0 12px"
    height: "48px"
    typography: "{typography.body}"
  superficie-nube:
    backgroundColor: "{colors.nube}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.superficie}"
    padding: "32px"
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
---

# Design System: EX · Portal del candidato

## Overview

**Creative North Star: «El canto»**

Una nube recién formada difracta la luz del sol cuando sus gotas son de tamaño parecido, y
aparece en su borde una banda estrecha de color. Tu candidatura es esa banda: se forma tramo a
tramo a lo largo de semanas, y el portal es el sitio donde la ves formarse. Del fenómeno viene
el vocabulario de estado entero —ausente, formándose, vívido, disperso— y también el material:
fondo de bruma fría, superficies de nube blanca encima, y el color viviendo en los cantos.

Hay **una inversión deliberada** respecto al fenómeno, y de ella cuelga el resto. En el cielo el
canto se deshace cuando las gotas engordan; aquí **lo que se formó se queda formado**, porque el
producto trata de acumular evidencia y lo que el candidato ya demostró es suyo. Un tramo cerrado
no se atenúa nunca.

Se rechazaron explícitamente el papel blanco con tinta negra del portal anterior —correcto pero
sin carácter, que fue el motivo del rediseño—, el azul de Apple, cuya estética le gusta al
cliente pero cuyo azul pidió no usar, y la rendición pastel y fina de este mismo mundo: pinta
exactamente el problema que se venía a resolver. El tema oscuro no existe y no va a existir: es
petición del cliente.

**Key Characteristics:**

- El color es posicional, no categórico: dice cuánto has avanzado, no qué etapa es.
- El violeta pleno significa una sola cosa, «te toca a ti», y aparece poco.
- El estado se lee en la forma —el grosor de la franja— antes que en el color.
- El color vive en el canto; el campo donde se lee se queda en nube.
- Superficies redondeadas y controles píldora: la nube no tiene esquinas.
- Solo tema claro.

## Colors

Bruma, nube, tres pizarras y un espectro. La paleta se divide en dos mitades que no se mezclan:
los grises azulados hacen todo el trabajo de lectura, y el color solo aparece en los cantos.

### Primary

- **Violeta de la banda viva** (`#5638d6`): el acento, y significa **una sola cosa**: «te toca a
  ti». Marca el tramo abierto del recorrido, el borde del panel que pide algo y el botón que
  empieza esa acción. No aparece en enlaces, ni en titulares, ni en iconos.
- **Violeta pulsado** (`#4429b8`): el mismo, al pasar por encima o al pulsar.
- **Bruma viva** (`#efecfd`): el halo que se abre alrededor de un control activo. Es la banda
  ensanchándose, que es lo que le pasa a la luz cuando te acercas al ángulo.
- **Regla viva** (`#c6bcf7`): el contorno de dos píxeles del panel que reclama al candidato.

### Secondary — el espectro del canto

No son colores de categoría: son **una sola tirada de luz** que corre de la primera etapa a la
quinta. Cada tramo del recorrido enseña la rebanada que le toca por su sitio, así que avanzar
cambia de color sin que ningún color signifique una etapa. Dicen «hasta aquí llegó la luz».

- **Menta** (`#16a184`) → **Aqua** (`#4f8ac9`) → **Rosa** (`#d2497e`) → **Violeta** (`#6b4be0`).

El mismo gradiente, con tres paradas intermedias añadidas para que no se escalone, dibuja la
banda atmosférica de la cabecera de «Mis procesos».

### Tertiary — el semáforo del sistema

Los tres ya significaban algo fijo en el producto antes que en el diseño, y por eso el violeta
no podía ser ninguno de ellos.

- **Verde de hecho** (`#0b7a63`), sobre **bruma verde** (`#e6f5f0`): lo confirmado. Asistencia
  confirmada, etapa superada. 5,3:1 sobre nube.
- **Ámbar de duda** (`#8f5a0a`), sobre **bruma ámbar** (`#fbf2e4`) y con **tinta ámbar**
  (`#6d4406`): lo que no es un error del candidato pero le cambia la decisión. El aviso de que
  no cumple un requisito indispensable, la última plaza libre, el «esto todavía no se puede
  enviar». Sobre su propia bruma el ámbar se queda corto; la tinta ámbar llega a 7,9:1.
- **Rojo de fallo** (`#c22a3f`), con **pulsado** (`#9e2134`), **bruma** (`#fdedf0`) y **regla**
  (`#f3c3cc`): el error real y la acción destructiva. Nada más.

### Neutral

- **Cielo** (`#f6f8fb`): el fondo de la página. Bruma fría, no blanco.
- **Nube** (`#ffffff`): la superficie donde se lee. Al revés que un portal corriente, donde la
  página es blanca y los bloques también y solo un contorno los separa.
- **Nube hundida** (`#eef1f6`): bloques de apoyo y esperas — lo que acompaña sin pedir nada.
- **Nube honda** (`#dfe4ec`): barras de esqueleto y fondo de lo deshabilitado. Se separa de la
  hundida a propósito: un control apagado dentro de un bloque de apoyo desaparecería.
- **Tinta** (`#232b36`): pizarra, gris azulado. 13,0:1 sobre nube.
- **Tinta segunda** (`#4a5563`): la prosa que explica. 7,5:1. Es el color de la mayor parte del
  texto.
- **Tinta tercera** (`#68727f`): pies, unidades, plazos. 4,81:1. **No bajar de aquí.**
- **Regla** (`#e3e7ee`) y **regla segunda** (`#cbd2dc`): la que divide dentro de un bloque y la
  que cierra uno.
- **Borde de control** (`#848e9c`): el contorno de cualquier cosa que se pueda tocar. Más oscuro
  que una regla a propósito: un control pide 3:1 contra el fondo, una caja no.
- **Tinta invertida** (`#ffffff`) y **tinta pulsada** (`#11161d`): el texto sobre un relleno y el
  relleno al pulsarlo. Se separan de la nube aunque hoy coincidan.

### Named Rules

**La regla de una sola voz.** El violeta significa «te toca a ti» y nada más. En cuanto aparece
en un botón secundario, en un enlace o en un titular, el candidato deja de poder fiarse del
color y tiene que leerlo todo. Los enlaces van en tinta con subrayado gris por esta razón.

**La regla del color en el canto.** El color vive en cantos, filetes, franjas y cabeceras. El
campo donde hay prosa se queda en nube. Es lo que hace el mundo y también lo que resuelve el
contraste: no hay texto leyéndose sobre color en ningún sitio.

**La regla del color posicional.** El espectro dice avance, no categoría. Si algún día un color
del canto empieza a significar «esto es la prueba», el recorrido deja de poder leerse.

**La regla del semáforo prestado.** Verde, ámbar y rojo ya significan algo. No se usan para
jerarquía, para categorizar ni para decorar.

## Typography

**Display / Body / Label:** Mulish (con `system-ui, sans-serif`), servida desde Google Fonts. Una
sola familia para todo.

**Character:** una humanista de cuencos casi circulares y aperturas anchas, que a peso 200 y
tamaño grande hace exactamente lo que hace el mundo: una banda estrecha de luz sobre mucho
cielo. No se usan Inter, Roboto, Geist, Instrument Sans ni Space Grotesk — el detector las marca
como sobreexpuestas.

### Hierarchy

Diez escalones, y cada uno tiene un trabajo, no un tamaño. Viven como tokens en `mundo.css`
—`--t-micro` … `--t-portada`—.

- **Display** `--t-portada` (200, `clamp(32px, 5.2vw, 56px)`, 1.06, `-0.03em`, balanceado): el
  titular de cada pantalla. Uno por pantalla y ninguno más.
- **Cifra** `--t-cifra` (600, `clamp(28px, 5vw, 34px)`): el cronómetro de la prueba y las cifras
  que hay que leer de un vistazo. Siempre con `tabular-nums`.
- **Headline** `--t-destacado` (700, `clamp(20px, 2.1vw, 24px)`, `-0.022em`): lo mayor dentro de
  una pantalla — el nombre de la vacante, el enunciado de una pregunta.
- **Title** `--t-titulo` (600, 20px, 1.25): el título de un bloque. Es el valor de `h2`.
- **Entradilla** `--t-entradilla` (400, 18px, 1.55): la frase que presenta una pantalla, y el
  título del tramo abierto.
- **Body** `--t-base` (400, 16px, 1.5): el cuerpo y los campos. **Nunca por debajo en un campo de
  texto**: a menos de 16 px iOS hace zoom al enfocarlo.
- **Prosa** `--t-prosa` (400, 15px, 1.55): la prosa que explica.
- **Apoyo** `--t-apoyo` (400, 14px, 1.5): el texto secundario de la interfaz. El más usado.
- **Menor** `--t-menor` (400, 13px): pies, unidades, pistas bajo un campo.
- **Label** `--t-micro` (700, 12px, `0.08em`, versalitas): títulos de bloque dentro de una
  pantalla densa, nunca antetítulos encima de un titular.

Los datos —fechas, cuentas, plazos, el cronómetro— llevan `font-variant-numeric: tabular-nums`,
aplicado globalmente a `<time>` y a `[data-cifra]`.

### Named Rules

**La regla del peso fino con suelo.** El 200 es el peso del mundo, y **solo se usa de 30 px para
arriba**. Por debajo una Mulish de 200 deja de leerse cómoda, y este es un portal de empleo
donde una barrera de lectura impide postular a un trabajo.

**La regla de la jerarquía tipográfica.** El tamaño y el peso hacen los niveles. Ningún recuadro,
sombra ni fondo existe para crear un nivel que el tamaño ya crea.

**La regla de la frase entera.** No se parten frases con elementos dentro. Poner `<b>` alrededor
de los números de «Pregunta 2 de 4» rompió cuatro pruebas, y por la misma razón por la que rompe
a un lector de pantalla: la frase deja de leerse de una pieza.

## Layout

**El portal mide `--ancho` (68rem) en escritorio, y ese ancho es para componer, no para leer.** La
prosa sigue cortada por `--medida`, así que ensancharlo no alarga una sola línea: lo que hace es
dar sitio para poner cosas al lado de otras.

**No todas las pantallas lo usan.** Entrar, crear cuenta, la contraseña olvidada y postular se
quedan en 34–44rem: son formularios, y un formulario ancho se lee peor. Privacidad, en 48rem.

**La medida de la línea son dos tokens:** `--medida` (50ch) para la prosa corriente y
`--medida-corta` (44ch) dentro de un bloque de apoyo. Compran 66–72 caracteres por línea, medido
en el navegador, no calculado — en Mulish el cero no mide lo que en otra familia.

El ritmo sale de ocho escalones —4, 8, 12, 16, 24, 32, 48 y 72 px— y de una sola regla: se agrupa
apretando y se separa con holgura. Sobre un título va más aire que debajo.

**Puntos de corte:** el que manda es **760 px**, donde el recorrido se pone de pie y todo pasa a
una columna. Hay además 640 px para los controles a ancho completo y 900/1100 px para
composiciones concretas.

**El relleno superior de una pantalla con canto no es aire: es el sitio de la banda.** En «Mis
procesos» vale `clamp(184px, 25vh, 272px)`. Si baja, el titular se mete dentro de la banda y
acaba habiendo prosa sobre color.

**Cualquier cosa que se pueda tocar mide 44 px de alto como mínimo**, aunque su texto mida
catorce. Los campos de texto suben a 48 px y nunca bajan de 16 px de letra.

### Named Rules

**La regla del panel con dueño.** El tope de línea va en el panel, no en los párrafos de dentro.
Con el tope en el panel, la medida tiene un solo dueño y el bloque no se queda con medio relleno
vacío al ensanchar la ventana.

**La regla del desfase medido.** Un elemento pegajoso que se pega debajo de otro no adivina su
altura: la mide y la guarda en un token junto a la barra que la produce —`--alto-cabecera`,
`--alto-avance`, `--alto-reloj`—.

## Elevation & Depth

**La profundidad es aire, no papel levantado.** Las sombras son difusas y frías: desplazamiento
corto, desenfoque largo, y el color de la tinta con muy poca opacidad. Una superficie de nube se
separa del cielo porque está un punto más clara, no porque tenga un contorno grueso.

### Shadow Vocabulary

- **La nube** (`0 1px 2px rgb(35 43 54 / 0.04), 0 8px 24px rgb(35 43 54 / 0.05)`): toda superficie
  de contenido sobre el cielo.
- **El aviso** (`0 12px 24px rgb(35 43 54 / 0.10), 0 32px 64px rgb(35 43 54 / 0.14)`): el modal,
  para que se despegue del fondo apagado.
- **La banda viva** (`0 4px 18px rgb(86 56 214 / 0.35)`): el resplandor bajo el tramo del
  recorrido donde está el candidato.
- **El halo del control activo** (`0 0 0 4px var(--activo-bruma)`): un anillo sin desenfoque al
  pasar por encima de la acción principal. Es un ensanche, no una sombra.

### Named Rules

**La regla del plano por defecto.** Una sombra aparece como respuesta a un estado —señalar el
turno, interrumpir, pasar por encima—, nunca para sugerir que una tarjeta flota.

## Shapes

**La nube no tiene esquinas.** Cuatro radios y ninguno más: `--radio` (14px) en superficies,
`--radio-menor` (10px) en campos y piezas pequeñas, `--radio-marca` (4px) en lo más pequeño que
se redondea —una casilla de 20 px, que con 10 se convierte en pastilla— y `--radio-control`
(999px) en **todos** los controles, que son píldoras enteras.

Los contornos son de 1 px, salvo cuando el grosor está diciendo algo: 2 px marcan el panel que
reclama al candidato, lo elegido y lo erróneo.

El vocabulario de estado del recorrido está **en el grosor de la franja**, no en su color:

| Forma | Qué dice |
|---|---|
| Franja gruesa, maciza, en su color del espectro | Formada: etapa superada |
| Franja más gruesa aún, violeta pleno, con resplandor | Viva: te toca a ti |
| Franja gruesa que se desvanece a la mitad | Formándose: esperando a otra persona |
| Filete de dos píxeles | Ausente: la luz no ha llegado aquí |
| Franja gruesa punteada | Dispersa: aquí se detuvo |

### Named Rules

**La regla de la forma primero.** Todo estado tiene que leerse en la forma antes que en el color.
Si al quitarle el color a una pantalla deja de saberse qué pasa, la pantalla está mal. Las cinco
formas de arriba se distinguen con la pantalla en gris; es la comprobación, y hay que repetirla
al tocar el recorrido.

**La regla de la caja constante.** La caja de una franja mide siempre lo mismo aunque la franja
de dentro cambie de grosor. Sin eso, un tramo con barra de 12 px y otro con filete de 2 px
empujan su nombre a alturas distintas y las cinco etapas dejan de leerse como una fila.

## Components

### Buttons

Cuatro piezas y ninguna más. Viven en `src/estilos/piezas.module.css` y **no se escriben en el
JSX**: cada pantalla las trae con `composes` desde su propia hoja, de modo que el botón conserva
el nombre de lo que hace —`.entregar` se llama entregar— y comparte la forma.

- **Shape:** píldora entera (`--radio-control`), contorno de 1 px del mismo color que el relleno.
- **Acento grande** (48 px, `0 32px`, 16px/600): la acción principal de una pantalla.
- **Acento menor** (44 px, `0 24px`, 15px/600): la misma acción cuando vive dentro de un panel y
  no puede pesar más que su contenedor.
- **Secundario** (44 px, nube con borde de control): todo lo demás que se puede pulsar.
- **Sólido** (44 px, tinta maciza): cuando algo tiene que pesar más que un contorno y el violeta
  estaría mintiendo — la salida segura de un aviso, o el botón de una pantalla vacía.
- **Hover:** el acento va a `#4429b8` y **abre su halo de bruma viva**; el sólido va a
  `#11161d`; el secundario engorda su contorno a tinta. Siempre `160ms` con
  `cubic-bezier(0.16, 1, 0.3, 1)` y siempre bajo `:not(:disabled)`.
- **Disabled:** fondo de nube honda, sin contorno propio, tinta tercera, cursor normal. Un botón
  apagado nunca finge que se puede pulsar.
- **Peligroso** (rojo macizo, 48 px): solo borra datos.

**Las dos piezas del acento van rellenas y no con filete espectral**, aunque el filete sea más
bonito: es la afordancia más importante del producto y un contorno pesa menos que un enlace
subrayado que tenga al lado.

### Inputs / Fields

- **Style:** 48 px de alto, nube, contorno de 1 px de borde de control, 16 px de letra,
  `--radio-menor`.
- **Focus:** el anillo global —2 px de violeta con 3 px de separación— sobre `:focus-visible`. Es
  el único sitio donde el violeta no significa «te toca a ti», y se acepta porque es una
  convención del navegador que el usuario ya tiene aprendida.
- **Error:** el borde **engorda a 2 px** y se vuelve rojo, en ese orden de importancia. El mensaje
  va debajo, atado al campo con `aria-describedby`, y **dice el problema y cómo se arregla** —
  nunca «campo inválido».

### Cards / Containers

No hay tarjetas de catálogo. Hay **superficies de nube**: fondo blanco sobre el cielo, contorno
de 1 px de regla, `--radio`, la sombra de la nube, y `32px` de relleno que baja a `16px` en
móvil. Cada una tiene su propio contenido y su propio alto.

**Nunca se anidan superficies con sombra**; lo que va dentro de una superficie cambia de fondo
—a nube hundida— y no de elevación.

El panel que pide algo al candidato es el único que cambia de piel: contorno de 2 px de regla
viva y el resplandor violeta. El que espera a otra persona va en nube hundida, sin violeta y sin
botón.

### Navigation

Cabecera fija de 61 px, **vidrio empañado** (`rgb(255 255 255 / 0.72)` con
`backdrop-filter: blur(18px) saturate(1.4)`), cerrada con una regla translúcida. Se pega encima
del canto irisado, y una barra blanca maciza partiría la nube en dos justo donde tiene que verse
entera. Donde el navegador no empaña, el fondo se cierra a nube opaca.

La marca EX a la izquierda; los enlaces a la derecha en píldoras de 14 px. **La página en la que
estás se marca con el peso y un fondo de bruma gris, no con el violeta.**

### Aviso (modal)

Nube con `--radio`, `min(38rem, 100vw - 2rem)`, cabecera y pie separados por reglas, y la sombra
del aviso. El fondo se apaga con `rgb(35 43 54 / 0.4)`. Se cierra con Escape, con el aspa o
tocando fuera, y el foco no se escapa. Donde basta, se usa `<dialog>` nativo.

### Signature Component — el canto irisado

La banda atmosférica que abre «Mis procesos»: una nube vista desde abajo, a sangre, con el
espectro asomando por su borde. Vive en `src/ui/Canto.tsx`.

⚠️ **No usa `feGaussianBlur` ni `feDisplacementMap`, y no es un descuido.** Chrome rasteriza un
filtro SVG a resolución CSS y después amplía el resultado a la del dispositivo, así que en una
pantalla de alta densidad la banda salía pixelada al lado de un texto nítido. Se comprobó
midiendo: la misma zona capturada a 1× y a 2× no ganaba un solo píxel de detalle.

La suavidad la hace **geometría**: la misma curva trazada 80 veces para el resplandor, 18 para el
núcleo y 24 para la pluma de la nube, de ancha y transparente a estrecha y opaca. El número de
capas es la resolución del degradado, no un gusto: el salto de ancho tiene que quedarse por
debajo de dos unidades o se ven estrías concéntricas. Cada capa se corre además en vertical
cuatro quintos del paso, repartido con el ángulo áureo, para que no haya dos bordes alineados.

Encima va un **grano** al 6 % en `mix-blend-mode: overlay`, dentro de un azulejo de 160 px que se
repite: rompe las franjas de valor constante que deja cualquier degradado grande sobre ocho bits
por canal.

**El canto tiene estado, y es lo que distingue una pantalla de otra.** Dos parámetros lo dicen:
`semilla` elige entre dos bordes autorizados —dos pantallas con la misma nube se leen como la
misma pantalla— e `intensidad` escala la luz de 0 a 1. No es un mando de gusto: en «Mis procesos»
la banda va al máximo porque hay un proceso **formado** y en marcha; en la portada va a 0,6 porque
todavía no ha empezado nada y la banda se está **formando**. Si una pantalla nueva pide el canto,
la pregunta que decide sus valores es en qué punto del fenómeno está lo que esa pantalla cuenta.

### Signature Component — el recorrido

Cinco tramos en fila: el canto es una tirada horizontal de luz, y leerlo de izquierda a derecha
es lo que dice «esto va avanzando». Por debajo de 760 px se pone de pie. El panel de la acción
cuelga debajo de la banda y no dentro de un tramo —un tramo mide una quinta parte del ancho y
ahí no cabe ni el título—; lo que lo ata a su tramo es el violeta.

### Motion

**Un solo momento con movimiento que se dispara solo:** la franja del tramo vivo formándose de
izquierda a derecha al entrar, 900 ms. Por eso significa algo cuando ocurre.

Aparte, el canto tiene una **deriva** de 52 segundos, y es material, no efecto: en el cielo la
banda se desplaza cuando cambia el reparto de tamaños de las gotas. Solo traslada, nunca escala
—un escalado estira el mapa de bits— y no lleva `will-change`, que en algunas máquinas baja la
precisión de color de la capa y eso, en un degradado así, son bandas.

Todo lo demás son transiciones de estado de 160 ms con `cubic-bezier(0.16, 1, 0.3, 1)`, y
**dentro del examen no hay movimiento de ningún tipo**.

### Named Rules

**La regla del indicador honesto.** Si algo dice que está guardado, tiene que salir de comparar
con el servidor. «Respuesta guardada» como texto fijo ya costó respuestas perdidas. Y una
pregunta en blanco no está guardada: está **sin responder**, que es otra cosa.

**La regla de la plataforma primero.** Antes de traer una librería de componentes, se mira si el
HTML ya lo resuelve. El aviso de postular usa `<dialog>`, el recorrido plegable usa `<details>` y
el formulario apagado de la decisión es un `<fieldset disabled>`: foco atrapado, tecla de escape
y teclado vienen gratis.

## Do's and Don'ts

### Do:

- **Do** reservar el violeta `#5638d6` para «te toca a ti»: el tramo vivo, el borde del panel que
  reclama y el botón que lo empieza.
- **Do** codificar cada estado en la forma —grosor, relleno, desvanecido, punteado— antes que en
  el color, y comprobarlo con la pantalla en gris.
- **Do** dejar el color en los cantos: filetes, franjas, cabeceras. El campo donde hay prosa se
  queda en nube.
- **Do** traer los botones con `composes` desde `piezas.module.css`, dejando en la hoja local solo
  lo que depende de dónde está el botón: márgenes, `align-self`, anchos.
- **Do** dar 44 px de alto mínimo a todo lo que se pueda tocar, y 48 px con 16 px de letra a los
  campos de texto.
- **Do** usar el peso 200 solo de 30 px para arriba.
- **Do** usar `tabular-nums` en fechas, cuentas y plazos.
- **Do** decir en voz alta lo que el sistema todavía no puede hacer. Si una evidencia no se puede
  enviar, el formulario va apagado y se explica; no se finge.

### Don't:

- **Don't** poner el violeta en enlaces, titulares, iconos, etiquetas de estado o botones
  secundarios. El subrayado ya identifica un enlace.
- **Don't** dar a un color del espectro el significado de una etapa concreta: el color es
  posicional.
- **Don't** usar verde, ámbar o rojo para jerarquía o categoría: ya significan hecho, duda y
  error.
- **Don't** meter un filtro SVG que cubra el ancho de la página. El pixelado vuelve.
- **Don't** anidar superficies con sombra, ni crear un nivel de jerarquía con un recuadro cuando
  el tamaño de letra ya lo crea.
- **Don't** añadir un segundo momento con movimiento que se dispare solo, ni ningún movimiento
  dentro del examen.
- **Don't** volver a introducir el tema oscuro. Es petición expresa del cliente.
- **Don't** partir una frase con elementos dentro para enfatizar un número.
