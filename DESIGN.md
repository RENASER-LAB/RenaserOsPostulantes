---
name: EX · Portal del candidato
description: Papel casi blanco, tinta casi negra y un azul profundo; letra Onest muy cerrada, celdas de filete y una portada con un campo de puntos que ondula — el estilo de Northstar llevado a un proceso de selección.
colors:
  cielo: "#fcfcfa"
  cielo-hundido: "#f5f7fb"
  nube: "#ffffff"
  nube-hundida: "#f5f7fb"
  nube-honda: "#e5e5e7"
  tinta: "#111312"
  tinta2: "#4a5251"
  tinta3: "#687170"
  tinta-invertida: "#ffffff"
  regla: "#e6e7e4"
  regla2: "#d4d6d3"
  borde-control: "#7b8382"
  activo: "#1e3a8a"
  activo-pulsado: "#172a66"
  activo-regla: "#1e3a8a"
  activo-bruma: "#e9edff"
  accion-fuerte: "#111312"
  accion-fuerte-pulsado: "#2b2f2d"
  noche: "#111312"
  noche-tarjeta: "#141416"
  noche-tinta: "#f0f0f2"
  frente-del-campo: "#527ada"
  bien: "#0b7a63"
  bien-bruma: "#e6f5f0"
  duda: "#1e3a8a"
  duda-bruma: "#e9edff"
  duda-tinta: "#172a66"
  duda-tinta2: "#3b4f8f"
  duda-punto: "#527ada"
  mal: "#c22a3f"
  mal-pulsado: "#9e2134"
  mal-bruma: "#fdedf0"
  mal-regla: "#f3c3cc"
typography:
  display:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "clamp(36px, 6.1vw, 88px)"
    fontWeight: 400
    lineHeight: 0.98
    letterSpacing: "-0.055em"
  pagina:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 4vw, 3.5rem)"
    fontWeight: 400
    lineHeight: 0.98
    letterSpacing: "-0.055em"
  encabezado:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "clamp(2rem, 3.2vw, 3rem)"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "-0.055em"
  title:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 550
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  entradilla:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  lead:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  body:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  boton:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  navegacion:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0.025em"
  ui:
    fontFamily: "Syne, Onest, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  pie:
    fontFamily: "Syne, Onest, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0.16em"
rounded:
  celda: "0px"
  marca: "4px"
  menor: "4px"
  control: "8px"
  superficie: "8px"
  tarjeta-oscura: "16px"
  ventana: "28px"
  barra: "999px"
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
  button-accion:
    backgroundColor: "{colors.activo}"
    textColor: "{colors.tinta-invertida}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
    height: "44px"
    typography: "{typography.boton}"
  button-accion-hover:
    backgroundColor: "{colors.activo-pulsado}"
    textColor: "{colors.tinta-invertida}"
  button-accion-disabled:
    backgroundColor: "{colors.nube-honda}"
    textColor: "{colors.tinta3}"
  button-secundario:
    backgroundColor: "{colors.cielo}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
    height: "44px"
    typography: "{typography.boton}"
  button-cabecera:
    backgroundColor: "{colors.activo}"
    textColor: "{colors.tinta-invertida}"
    rounded: "{rounded.celda}"
    padding: "10px 16px"
    height: "40px"
    typography: "{typography.ui}"
  button-peligroso:
    backgroundColor: "{colors.mal}"
    textColor: "{colors.tinta-invertida}"
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
  celda:
    backgroundColor: "{colors.cielo}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.celda}"
    padding: "18px 16px"
  superficie:
    backgroundColor: "{colors.nube}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.menor}"
    padding: "24px"
  panel-te-toca:
    backgroundColor: "{colors.nube}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.menor}"
    padding: "24px"
  panel-espera:
    backgroundColor: "{colors.cielo-hundido}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.menor}"
    padding: "24px"
  tarjeta-oscura:
    backgroundColor: "{colors.noche-tarjeta}"
    textColor: "{colors.noche-tinta}"
    rounded: "{rounded.tarjeta-oscura}"
    padding: "0 18px 18px"
  nav-enlace:
    textColor: "{colors.tinta}"
    padding: "0 16px 0 12px"
    height: "44px"
    typography: "{typography.navegacion}"
  nav-enlace-activo:
    textColor: "{colors.activo}"
---

# Design System: EX · Portal del candidato

> **Este documento describe el mundo que hay en el código desde el 13/11/2026: «Northstar».**
> Sustituye en el portal a «El cielo despejado» (índigo `#615FFF`, Geist, cabecera en
> píldora, cielo con nubes), que vivió del 25/09 al 13/11 y **sigue vivo en el panel del
> equipo** (ver «Lo que queda fuera»). La historia de los mundos anteriores está en las
> bitácoras, no aquí.
>
> **Los valores normativos son los de la cabecera de este archivo y los de
> [`src/estilos/mundo.css`](src/estilos/mundo.css)**, bloque «EL MUNDO NORTHSTAR». Si alguna
> vez no coinciden, manda `mundo.css` y este documento está desactualizado.
>
> Lo que se toca al componer una pantalla vive en tres sitios, y ninguno se escribe a mano en
> la hoja de la pantalla: los tokens en `mundo.css`, los botones y paneles en
> [`piezas.module.css`](src/estilos/piezas.module.css), y el carril y los bloques en
> [`pagina.module.css`](src/estilos/pagina.module.css).

## Overview

**Creative North Star: "Northstar"**

El estilo es una réplica, medida con Playwright en su propia página, de la plantilla
`northstar-template-demo.vercel.app`, elegida por el usuario el 13/11/2026: tipografía,
espaciado, botones, radios, filetes, el fondo de la portada, la cabecera, el pie y el
movimiento. **Se copió el estilo, no el contenido ni la marca**: los textos, el logotipo y la
estructura funcional del portal son los de siempre.

Lo que define el mundo, en una frase: **papel casi blanco, tinta casi negra, un solo azul
profundo, y letra que hace el trabajo**. El titular es enorme y ligero —Onest 400 con el
tracking muy cerrado—, las etiquetas van en mayúsculas pequeñas y espaciadas («01 /
VACANTES»), y las superficies son **celdas de filete** de esquinas casi rectas, sin sombra en
reposo. La portada se permite atmósfera —un campo de columnas punteadas que ondula, una
ventana del producto que se asienta al bajar, una banda oscura y un pie en noche— y dentro del
portal el trabajo vuelve a ser de la tipografía.

**Key Characteristics:**

- Papel `#FCFCFA`, tinta `#111312` y un único azul, `#1E3A8A`, para acción, ubicación y turno.
- Onest para todo y Syne para la voz de interfaz (el botón de la barra, el pie, los títulos de
  las tarjetas oscuras).
- Titulares en peso 400 con -0,055em; títulos de bloque en 550 con -0,03em.
- Celdas y paneles de filete negro al 10 %, esquina de 4 px (0 en las celdas de la portada y
  en la barra); controles de 8 px; las tarjetas oscuras de 16; la ventana de la portada de 28.
- Botones en MAYÚSCULAS, peso 400; al pasar solo cambia el color, al pulsar ceden a 0,97.
- El estado se sigue diciendo en la **forma** —franja maciza, filete azul con halo—, y el color
  lo acompaña.

## Colors

### Primary

- **Azul de acción** (`activo`, `#1E3A8A`): lo que se pulsa, el destino actual de la barra, la
  franja viva del recorrido y el borde de lo que te toca. Blanco encima da **10,4:1**.
- **Azul pulsado** (`activo-pulsado`, `#172A66`): el mismo botón bajo el ratón; se oscurece.
- **Halo azul** (`activo-bruma`, `#E9EDFF`): el anillo de 3–4 px de lo vivo —el campo enfocado,
  la métrica y el nodo en curso de la ventana, el panel que te toca—. Nunca un fondo grande.
- **Frente del campo** (`#527ADA`): el color de los puntos del fondo de la portada. Solo ahí,
  al 64 % y tras la máscara de rayas; no es un color de interfaz.

### Neutral

- **Cielo / papel** (`cielo`, `#FCFCFA`): el fondo de todas las pantallas y de los botones
  secundarios.
- **Cielo hundido** (`cielo-hundido`, `#F5F7FB`): los paneles de espera y lo que baja un
  escalón.
- **Nube** (`nube`, `#FFFFFF`): superficies de formulario y bloques; las celdas de la portada
  pasan a nube al pasar el ratón.
- **Tinta** (`#111312`, 18,2:1 sobre papel), **tinta de prosa** (`tinta2`, `#4A5251`, 7,8:1) y
  **tinta apagada** (`tinta3`, `#687170`, 4,9:1 sobre papel y 4,7 sobre cielo hundido): es el
  gris más claro que se usa para texto.
- **Filete**: negro al 10 % (`rgb(0 0 0 / 0.1)`) en celdas, paneles y la barra; `regla`
  (`#E6E7E4`) donde hace falta un color sólido.
- **Borde de control** (`#7B8382`, 3,9:1): el límite de un campo. **La referencia usa un negro
  al 18 % (1,5:1) y aquí no se copia**: WCAG pide 3:1 al límite visible de un control.
- **Noche** (`#111312`) y **tarjeta de noche** (`#141416`): la banda de «Por qué este proceso
  es distinto» y el pie. Encima, `noche-tinta` (`#F0F0F2`) y su versión al 56 % (5,7:1).
- **Casi negro** (`accion-fuerte`): el botón macizo (`.solido`) y «Filtros» de `/vacantes`.

### Estado

Verde hecho (`bien`), azul en duda (`duda`, con `duda-tinta`) y rojo error (`mal`).
Significan hecho, duda y error, y nunca jerarquía ni categoría. **En el portal no hay ámbar
desde el 13/11/2026**: `--duda` pasó a la familia azul (`#1E3A8A`, bruma `#E9EDFF`, punto
`#527ADA`) porque era la única mancha cálida y se leía como advertencia. Lo distingue la
forma (bruma, punto, etiqueta). Desde el 14/11/2026 el panel tampoco: su `--duda` es índigo
(`#4338CA`, bruma `#EEF0FF`, punto `#818CF8`).

### Named Rules

**La regla de la voz única.** El azul es el único color con intención. Si algo es azul, se
pulsa, es donde estás, o te toca.

**La regla del semáforo.** Verde, azul en bruma y rojo significan hecho, duda y error. Nada de ámbar, ni en el portal ni en el panel.

**La regla de la etiqueta tenue.** La etiqueta de sección de la portada («01 / VACANTES») va
en tinta al 42 %, como en la referencia: **2,75:1, y es a sabiendas** —repite lo que dice el
titular de debajo y no es la única forma de saberlo—. **En las demás pantallas la etiqueta va
en `tinta3` (4,9:1)**, porque allí sí puede ser lo único que nombra el bloque.

## Typography

**Onest** (cuerpo, titulares, botones, etiquetas) y **Syne** (voz de interfaz), las dos de
Google Fonts con licencia OFL, **servidas por el propio sitio** desde `public/tipografia/`
(variables, latin y latin-ext). Un teléfono sin cobertura abre la aplicación con su letra.

### Hierarchy

- **Display** (Onest 400, `clamp(36px, 6.1vw, 88px)`, 0,98, -0,055em): el titular de la
  portada, con la segunda mitad en azul. Medido en la referencia: 87,84 px a 1440 y 36 a 390.
- **Página** (`--t-pagina`, `clamp(2.25rem, 4vw, 3.5rem)`, mismo peso y tracking): el `h1` de
  todas las demás pantallas.
- **Encabezado** (`--t-encabezado`, `clamp(2rem, 3.2vw, 3rem)`, 1,05): el titular de una
  sección de la portada y de los estados (vacío, error, acceso necesario).
- **Título de bloque** (`h2`, 20 px, 550, -0,03em) y `h3` (16 px, 550, -0,02em).
- **Entradilla** (18 px / 1,5) bajo el titular de una pantalla; **lead** (20 px) en la portada.
- **Cuerpo** 16/24; prosa 15; apoyo 14; menor 13.
- **Botón** (14 px, 400, MAYÚSCULAS) y **navegación** (14 px, MAYÚSCULAS, 0,025em, con «/ »).
- **UI en Syne**: el botón «Iniciar sesión» (12 px, MAYÚSCULAS), los títulos de las tarjetas
  oscuras (15,84 px, 520, -0,025em), el pie (17 px, MAYÚSCULAS) y su saludo (48–72 px, 500).
- **Etiqueta** (11 px, 400, 0,16em, MAYÚSCULAS): «01 / VACANTES», «MIS PROCESOS / DETALLE».

### Named Rules

**La regla del peso ligero.** Onest es densa: nada pasa de 600. Titulares en 400; títulos de
bloque y énfasis en 550; las etiquetas en mayúsculas en 400–500. La jerarquía la hacen el
tamaño y el tracking, no el negro.

**La regla de la etiqueta de sección.** Una pantalla puede llevar encima de su titular la
etiqueta «Sección / Lo que es» con `data-seccion="…"` en el titular o el encabezado. La pinta
`[data-seccion]::before` en `mundo.css`, **como pseudoelemento con texto alternativo vacío**:
decora, y así ni el lector de pantalla ni las pruebas la leen junto al titular. Hoy la llevan
Mis procesos, el detalle de un proceso, la ficha de una vacante, postular, registro, entrar,
la contraseña (pedir y elegir), la evaluación, la prueba, la prueba técnica, la simulación,
la validación, privacidad y la política.

## Layout

- **Carril de la barra y el pie**: `min(95vw, 100% - 32px)` —el `page-container wide` de la
  referencia—; el pie y las secciones de la portada se topan en 1200–1308 px.
- **Carril de las pantallas**: `--ancho` (80rem) y `/vacantes` en `--ancho-vacantes` (96rem),
  como antes; formularios en 44rem y prosa en 48rem (`pagina.module.css`).
- **Ritmo de la portada**: 96–120 px entre secciones (64–96 en el teléfono), 32 px bajo cada
  encabezado de sección, 24 entre titular, entradilla y acciones del hero.
- **Rejillas de celdas**: las celdas comparten filete (`margin: 0 -1px -1px 0`) y no dejan
  hueco entre ellas, como la rejilla de «Projects» de la referencia.

## Elevation & Depth

**En reposo, plano.** Las superficies se separan por el filete negro al 10 %, no por sombra.

- `--sombra-nube` (`0 8px 24px rgb(15 23 42 / .08), 0 2px 8px rgb(15 23 42 / .04)`): la
  ventana de la portada, la tarjeta de «Entrar».
- `--sombra-aviso` (`0 24px 80px rgb(15 23 42 / .12), 0 2px 8px …`): modales y el panel de
  avisos.
- `--sombra-control` es ahora un filete (`0 0 0 1px rgb(17 19 18 / .12)`) y
  `--sombra-control-alta` no pinta nada: ningún botón se levanta.
- **El halo** (`0 0 0 3–4px var(--activo-bruma)`) marca lo vivo, y es lo único que «brilla».

## Shapes

- **0 px**: las celdas de la portada (cifras, vacantes), la barra y su botón, la campana.
- **4 px** (`--radio-menor`): paneles, bloques, campos, estados, el panel de avisos, las
  tarjetas de `/vacantes` (`rounded-xl`).
- **8 px** (`--radio`, `--radio-control`): botones y la tarjeta del modal.
- **16 px**: las tarjetas de la banda oscura. **28 px**: la ventana de la portada (20 en el
  teléfono). **999 px**: chips, sellos y las franjas del recorrido.

## Components

### Buttons (`piezas.module.css`)

- **Acción** (`.acentoGrande`, `.acentoMenor`): azul, texto blanco, 14 px MAYÚSCULAS peso 400,
  relleno 12 × 20 (12 × 16), 44 px de alto mínimo, radio 8, filete negro al 10 %.
- **Secundario** (`.secundarioGrande`, `.secundario`): papel con filete `#E5E7EB`; al pasar se
  oscurece un 3 %.
- **Macizo, peligroso y WhatsApp**: mismos pesos y mayúsculas; sus colores no cambian.
- **Volver** (`.volver`): «← VOLVER A …» en 12 px MAYÚSCULAS, 0,06em, sin subrayado.
- **Movimiento**: `color`, `background-color` y `border-color` en 150 ms
  (`cubic-bezier(0.4, 0, 0.2, 1)`), y `transform: scale(0.97)` al pulsar (160 ms, curva de
  salida). **Sin el rótulo que rodaba** al pasar: la referencia solo cambia el color.
  `data-rotulo` sigue en el marcado y no hace nada.
- **En `/vacantes`** el `Button` de shadcn lleva lo mismo (`uppercase font-normal`, filete
  negro al 10 %, `hover:bg-primary-hover`).

### Cards / Containers

- **Celda** (portada): papel, filete negro al 10 %, esquina 0, índice o etiqueta arriba a la
  izquierda y una flecha **↗** arriba a la derecha que se escapa 2 px en diagonal al pasar
  (250 ms, curva de salida); el fondo pasa a nube.
- **Bloque** (`.bloque` de `pagina.module.css`): nube, filete negro al 10 %, radio 4.
- **Te toca** (`.turno`): filete azul al 50 % y halo de 4 px. **Espera** (`.panelDeEspera`):
  cielo hundido y filete. **En duda** (`.enDuda`): bruma azul de `--duda`, radio 4.
- **Estados** (`ui/Estados.module.css`: cargando, vacío, error, «Acceso necesario»): una celda
  de filete con la etiqueta de 11 px, el titular a escala Encabezado y las barras de
  esqueleto con un barrido lineal de 1,4 s.
- **Tarjeta oscura** (la banda de la portada): `#141416`, filete blanco al 7 %, radio 16; al
  pasar sube 3 px en 550 ms y su maqueta 4 px más.

### Inputs / Fields (`ui/campos/Campo.module.css`)

Blancos, 48 px, radio 4, borde `borde-control` (3,9:1) que pasa a tinta al pasar; **al
enfocar, borde azul y halo de 3 px** en vez del contorno. La etiqueta en 500. La casilla de un
consentimiento marcado lleva el filete azul. El mismo halo se aplica a los `input` y
`textarea` sueltos de las pantallas (regla global en `mundo.css`).

### Navigation (`app/Armazon.tsx`)

Una banda a sangre, **pegada arriba**, del mismo papel que la página y con un filete negro al
10 % debajo. Mide **69 px** (12 + 44 de la campana + 12, y el filete): es `--alto-cabecera`. Si
cambia su relleno o el alto de la campana, se vuelve a medir.

- A la izquierda, los destinos: «/ INICIO», «/ VACANTES», «/ MIS PROCESOS» en 14 px
  MAYÚSCULAS, separados por rayas finas (negro al 6 %); al pasar bajan a opacidad 0,6
  (150 ms). El activo, en azul.
- **La marca, centrada de verdad** (en posición absoluta). Por debajo de 860 px va a la
  izquierda.
- A la derecha, «Mi cuenta» con su «/ », la campana y, sin cuenta, **«INICIAR SESIÓN»**: Syne
  12 px, azul, esquinas rectas, 40 px.
- **Teléfono** (≤ 620 px): los destinos se pliegan tras el «/» de la referencia; son dos barras
  encima y la segunda gira 90° al abrir para formar una equis (220 ms, solo `transform`). El
  menú es una hoja a todo el ancho bajo la barra, con los destinos en MAYÚSCULAS y «/ », que
  entra 8 px (300 ms) sobre un velo negro al 40 %.
- Al cargar, los destinos y las acciones entran en cascada (4 px y fundido, 420 ms, de 50 en
  50 ms).
- **La campana** (`ui/Campana`): sin fondo al pasar, baja a 0,6; el número en un cuadrado azul
  de 16 px; el panel de avisos es una celda de filete con «AVISOS» como etiqueta.

### El pie (`app/Armazon.tsx`)

La noche de la referencia (`#111312`), en Syne:

- **«VER VACANTES ———»** arriba a la derecha: 20 px, 500, con una raya de 2 px que llega hasta
  el borde y crece un 25 % al pasar.
- **El saludo que cambia de idioma** —Hola, Allillanchu, Kamisaraki, Olá, Hello— a 48–72 px:
  sale hacia arriba y entra desde abajo (60 %, 600 ms, curva de salida) cada 2,6 s.
  Decorativo (`aria-hidden`) y quieto en «Hola» con movimiento reducido.
- Tres columnas en MAYÚSCULAS (17 px): El portal, Tus datos, Empresas. Abajo, «Volver arriba»
  (en la portada) y «Renaser Consulting · EX · 2026».
- **Las puertas** (entrar, registro, contraseña) llevan el pie corto: una línea en la misma
  noche.

### La portada (`paginas/vacantes/Vacantes.tsx`)

- **Hero**: el titular display, la entradilla (20 px, `tinta3`, 44rem, equilibrada) y dos
  botones —el secundario se esconde en el teléfono, como en la referencia—.
- **El «container scroll» de la referencia, con sus valores medidos**: la sección mide 170 vh
  (160 en el teléfono) y su interior va pegado bajo la barra. Sobre el alto de la sección, el
  titular sube 48 px y se funde hasta el 32 %, y la ventana pasa de 1,08 a 1 y de 96 a -180 px
  hasta el 41 % (1,06 y 72 → -130 en el teléfono). La opacidad se calcula con una función y no
  con rangos: con rangos, motion la pasaba a un ScrollTimeline que en Chromium sin cabeza se
  quedaba en 1.
- **Entrada**: el titular sube 10 px (700 ms); la ventana entra desde 64 px y el 94 % (1,2 s,
  curva de salida, tras 100 ms).
- **Secciones**: la cinta de cifras en celdas; «01 / VACANTES» con las tres más recientes en
  celdas; «02 / POR QUÉ AQUÍ» en la banda oscura con tres tarjetas de noche; «03 /
  PREGUNTAS» en dos columnas con las preguntas numeradas; el cierre con el mismo campo de
  puntos.

### El fondo de la portada (`FondoDeLaPortada.tsx`)

**El mismo sombreador que la referencia**, sacado de su bundle: el «Dithering» de Paper
Shaders con forma simplex (dos octavas de ruido que suben y bajan), tramado Bayer 4×4 en
celdas de 4 px CSS, escala 1,2, frente `#527ADA`, velocidad 0,5; el lienzo un 10 % más grande
por cada lado; **una máscara de rayas verticales —1,92 px visibles cada 14,4 px—**, que es lo
que convierte las manchas tramadas en columnas punteadas; todo al 64 % sobre blanco y un
paralaje de ±8 px contra el ratón. Encima, dos degradados blancos (radial 68 % × 48 % y lineal
hasta el 96 %) y un grano `feTurbulence` al 7,3 %.

Aquí va portado a **WebGL2 sin la librería**, recortado a lo que se usa. Se para fuera de
pantalla y en otra pestaña; 60 cuadros con ratón fino y 30 en el resto; el lienzo no pasa de
3 Mpx; con movimiento reducido, un cuadro quieto y sin paralaje; sin WebGL2, un cuadro quieto
en canvas 2D con el mismo cálculo.

⚠️ **No llamar a `loseContext()` al desmontar**: StrictMode remonta el componente, el lienzo
pide otra vez su contexto y recibiría uno perdido —el fondo salía vacío—.

### La ventana de la portada

La captura de producto de la referencia (su vista «Agents»), traducida a una postulación de
ejemplo genérica («Analista de Datos», sin personas): barra con tres puntos, lateral con los
destinos y «Mis postulaciones», cuatro métricas (la primera viva, con halo), la franja «●
Perfil → Prueba del puesto», un **grafo** —«Tu postulación» arriba y Perfil → Prueba →
Simulación → Validación → Decisión, con su estado Hecho / En curso / Pendiente— unido por
líneas punteadas en codo que se trazan midiendo los nodos, y la actividad a la derecha con «Lo
siguiente». En el teléfono, el recorrido se apila en vertical con conectores punteados.

**Las cinco etapas son la `<ol>` accesible y la promesa de la portada**; todo lo demás es
`aria-hidden`. Animación, una vez: nodos en cascada (8 px y 94 %, 500 ms), líneas que se
funden, actividad que llega de una en una; siguen en marcha solo el trazo de la línea viva
(lineal, 1 s) y el pulso del estado en curso.

### La búsqueda de vacantes (`/vacantes`, shadcn/ui + Tailwind)

La estructura no cambió (filtros, lista, panel desde 1280 px; ver
[EL-MUNDO-VISUAL](docs/EL-MUNDO-VISUAL.md) y la bitácora de octubre). Lo que cambió es la piel:
las superficies llevan el filete como anillo (`SOMBRA_DE_SUPERFICIE` =
`shadow-[0_0_0_1px_rgb(0_0_0/0.1)]`), el anillo se oscurece al pasar, **la elegida lleva el
filete azul con el halo**, y `rounded-xl` es ya `--radio-menor` (4 px). Tailwind sigue **sin
preflight**, con `!important` y con `--font-sans` en `var(--fuente)`.

### Movimiento

Siguiendo a Emil Kowalski: solo `transform` y `opacity`, curvas fuertes de salida
(`--salida`: `cubic-bezier(0.16, 1, 0.3, 1)`) para lo que entra, `cubic-bezier(0.4, 0, 0.2,
1)` para cambios de color, lineal para lo que no acaba (el trazo de la línea viva, el barrido
del esqueleto), y nada por encima de 300 ms en la interfaz salvo las entradas de la portada,
que se ven una vez por visita.

- **Botones**: color en 150 ms y 0,97 al pulsar. **Celdas**: la flecha ↗ en 250 ms. **Modal**:
  entra desde el 96 % en 220 ms, centrado; el velo se funde en 200 ms.
- **Al asomarse** (`AlAsomarse variante="subir"`): 16 px y fundido en 700 ms con la curva de
  salida, solo en la portada.
- Siguen las piezas B (el título que viaja), C (la franja que se llena) y D (la tarjeta que
  responde) de `ui/movimiento.tsx`.

### Named Rules

**La regla del reloj.** Dentro de la prueba del puesto no se mueve nada.

**La regla de la barrera.** Todo respeta `prefers-reduced-motion`: el fondo se queda en un
cuadro, el saludo en «Hola», la ventana entra ya asentada y la portada deja de ir pegada.

## Lo que queda fuera: el panel conserva «El cielo despejado»

`mundo.css` y `piezas.module.css` son globales, así que **todo lo Northstar está escrito bajo
`html:not(.mundo-panel)`** (`:root:not(.mundo-panel)` en `mundo.css`,
`:global(html:not(.mundo-panel)) .pieza` en las hojas de módulo). La base de cada archivo
compartido —tokens, `h1`–`h3`, piezas, campos, modal, estados— es la del panel, sin tocar.

`usarMundoDelPanel()` ([`src/panel/mundoDelPanel.ts`](src/panel/mundoDelPanel.ts)) pone la
clase `mundo-panel` en `<html>` mientras el panel está montado (con `useLayoutEffect`, sin un
cuadro equivocado). La llaman `ArmazonPanel`, `InvitacionPanel` y el aviso de error
(`Salvavidas`) cuando lo que se rompió es una pantalla del panel. **Las tres puertas del
panel** (`/admin/entrar`, `/admin/clave`, `/admin/restablecer`) viven en el armazón del portal y
llevan Northstar.

Verificado el 13/11/2026 con capturas del panel servidas con datos interceptados
(`herramientas/capturar-panel.mjs`), comparadas con `main` píxel a píxel a 1280 y a 390: **0,000 %
de diferencia** en la lista de vacantes, una vacante con su ranking y simulación. Configuración
y la ficha de un postulante caen en el aviso de error con los datos de prueba de hoy —también
en `main`— y ese aviso coincide igual.

**Regla:** una pieza compartida nueva o cambiada para el portal se escribe bajo
`html:not(.mundo-panel)`; la base se queda como la ve el panel. Una hoja que solo usa el
portal (`src/paginas/**`, `app/Armazon`, `ui/Campana`) se cambia sin más.

## Do's and Don'ts

### Do:

- **Do** usar los tokens de `mundo.css` y las piezas de `piezas.module.css`; una variante
  nueva se declara con nombre en la hoja compartida.
- **Do** escribir lo del portal en una pieza compartida bajo `html:not(.mundo-panel)`.
- **Do** separar por filete negro al 10 %, no por sombra.
- **Do** poner la etiqueta «Sección / Lo que es» con `data-seccion`, no como texto.
- **Do** mantener 44 px de área táctil y 3:1 en el límite de los campos.
- **Do** medir en el navegador: el alto de la barra (69 px), los contrastes, dónde corta la
  ventana.
- **Do** reiniciar Vite si un cambio en `piezas.module.css` no se ve: las clases compuestas
  desde otra hoja se quedan en caché y siguen con la versión vieja.

### Don't:

- **Don't** pasar de 600 de peso ni escribir un titular en negrita.
- **Don't** usar el azul para decorar, ni verde, azul de duda o rojo para jerarquía; ni reintroducir ámbar en ninguna parte.
- **Don't** poner sombra a una celda en reposo ni levantar un botón al pasar.
- **Don't** usar el filete al 18 % de la referencia en un campo.
- **Don't** mover nada dentro de la prueba del puesto.
- **Don't** tocar la base de una pieza compartida para el portal: repintaría el panel.
- **Don't** pintar el logotipo de un color con intención, animarlo, ni importar su PNG fuera
  de `Marca`.
