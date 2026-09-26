---
name: EX · Portal del candidato
description: Un cielo despejado — gris frío, superficies blancas y un solo acento índigo — para un proceso de semanas que tiene que leerse sin dudas.
colors:
  cielo: "#f9fafb"
  cielo-hundido: "#f3f4f6"
  nube: "#ffffff"
  nube-hundida: "#f3f4f6"
  nube-honda: "#e5e7eb"
  tinta: "#101828"
  tinta2: "#364153"
  tinta3: "#6a7282"
  tinta-invertida: "#ffffff"
  regla: "#e5e7eb"
  regla2: "#d1d5dc"
  borde-control: "#6a7282"
  activo: "#615fff"
  activo-pulsado: "#4f46e5"
  activo-regla: "#615fff"
  activo-bruma: "rgb(97 95 255 / 0.2)"
  accion-fuerte: "#030712"
  accion-fuerte-pulsado: "#1e2939"
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
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "clamp(36px, 5.2vw, 60px)"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "normal"
  cifra:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "clamp(28px, 5vw, 34px)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "clamp(24px, 2.4vw, 30px)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  navegacion:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  entradilla:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "-0.014em"
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  prosa:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  apoyo:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  menor:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  marca: "4px"
  control: "8px"
  menor: "8px"
  superficie: "12px"
  ventana: "14px"
  pildora: "18px"
  escaparate: "20px"
  cristal: "26px"
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
    typography: "{typography.apoyo}"
  button-accion-hover:
    backgroundColor: "{colors.activo-pulsado}"
    textColor: "{colors.tinta-invertida}"
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
    rounded: "{rounded.control}"
    padding: "12px 20px"
    height: "44px"
    typography: "{typography.apoyo}"
  button-cabecera:
    backgroundColor: "{colors.accion-fuerte}"
    textColor: "{colors.tinta-invertida}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
    height: "44px"
    typography: "{typography.prosa}"
  button-peligroso:
    backgroundColor: "{colors.mal}"
    textColor: "{colors.tinta-invertida}"
    rounded: "{rounded.control}"
    padding: "0 32px"
    height: "48px"
  button-peligroso-hover:
    backgroundColor: "{colors.mal-pulsado}"
    textColor: "{colors.tinta-invertida}"
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
    rounded: "{rounded.superficie}"
    padding: "16px"
  nav-enlace:
    textColor: "{colors.tinta}"
    padding: "0 16px"
    height: "44px"
    typography: "{typography.navegacion}"
  nav-enlace-activo:
    textColor: "{colors.activo-regla}"
---

# Design System: EX · Portal del candidato

> **Este documento describe el mundo que hay en el código desde el 25/09/2026.** Sustituye
> entero a «El escaparate» —crema `#FBF1E9`, acción negra, un solo coral, Figtree—, que vivió
> del 10 al 25/09 y cuya historia está en [BITACORA-2026-09](docs/BITACORA-2026-09.md), no
> aquí. **Los valores normativos son los de la cabecera de este archivo y los de
> [`src/estilos/mundo.css`](src/estilos/mundo.css)**, que dicen lo mismo; si alguna vez no
> coinciden, manda `mundo.css` y este documento está desactualizado.
>
> Lo que se toca al componer una pantalla vive en tres sitios, y ninguno se escribe a mano en
> la hoja de la pantalla: los tokens en `mundo.css`, los botones y paneles en
> [`piezas.module.css`](src/estilos/piezas.module.css), y el carril y los bloques en
> [`pagina.module.css`](src/estilos/pagina.module.css).

## Overview

**Creative North Star: "El cielo despejado"**

Quien postula aquí entra en un proceso de semanas: postula, rinde una evaluación, una prueba
con reloj, una sesión con el equipo, un periodo de trabajo, y espera. La mayor parte de ese
tiempo no tiene nada que hacer. El portal es el sitio al que vuelve a mirar el cielo: tiene
que estar despejado. Fondo gris muy claro y frío, superficies blancas que se apoyan en él por
tono, tinta casi negra con un matiz azul, y **un solo color con intención —el índigo— que
aparece donde hay que pulsar, donde estás o donde te toca**. Nada más compite.

La densidad es de producto, no de revista: carriles de 68rem, prosa cortada a unos 65
caracteres, controles de 44 px como mínimo. La calma no viene de quitar información —el
producto se debe a decir con honestidad en qué punto está cada candidatura— sino de que cada
cosa tenga un solo sitio y un solo peso. La portada es la única pantalla que se permite
atmósfera: un cielo azul con nubes detrás del titular y una ventana de cristal que enseña el
recorrido. Dentro del portal, el cielo se queda en su gris y el trabajo es de la tipografía.

El mundo sale de una referencia que trajo el cliente —la plantilla SaaS
`saasly.demos.tailgrids.com`— medida en su propia página, no copiada a ojo: la escala gris de
Tailwind v4, el índigo `#615FFF`, Geist, el radio de 8 px y la cabecera en píldora blanca. **No
se copió todo**: su cielo es una foto de una plantilla comercial y aquí es una reconstrucción
propia —degradados y nubes generadas con ruido fractal—; y donde la referencia no llega a los
contrastes de WCAG, este sistema no la sigue (ver Colors y Components).

**Key Characteristics:**

- Gris frío de página y superficies blancas encima: la profundidad es tono, no sombra.
- Un único acento, índigo, para acción, ubicación y turno.
- El estado se dice en la **forma** —franja maciza, filete, borde de 2 px— y el color lo
  acompaña.
- Geist en todo, servida por el propio sitio; titulares de peso 600 sin apretar.
- Esquina de 8 px en los controles y 12 en las superficies; ninguna píldora en un botón.
- Movimiento corto y con propósito, apagado dentro de la prueba cronometrada.

## Colors

Una escala gris fría con matiz azul, blanco puro para las superficies y un índigo eléctrico
como única voz; verde, ámbar y rojo existen, pero significan estados del proceso y nada más.

### Primary

- **Índigo de acción** (`activo`): lo que se pulsa —el botón principal de cada pantalla—, la
  franja viva del recorrido, el anillo de foco de todo el portal. Blanco encima da **4,57:1**:
  pasa el 4,5 de WCAG por poco, y por eso **no se aclara**.
- **Índigo de acción, pulsado** (`activo-pulsado`): el mismo botón bajo el ratón. Se oscurece
  en vez de aclararse, para que el texto blanco gane contraste al interactuar, no lo pierda.
- **Índigo de ubicación y turno** (`activo-regla`): hoy vale lo mismo que el de acción. Marca
  el destino actual en la cabecera y el borde de lo que te toca hacer. Tiene nombre propio
  porque significa otra cosa, y el día que el turno recupere un color propio se separa aquí.
- **Bruma índigo** (`activo-bruma`): el índigo al 20 %, para halos y fondos de selección. Hoy
  solo lo usa el panel del equipo.
- **El canto** (`--canto`, un degradado de cuatro índigos): **legado**. Es lo último que queda de
  un mundo anterior y solo lo usa la barra del panel del equipo. No se usa en composiciones
  nuevas; como es un degradado y no un color, no va en la cabecera de este archivo sino en el
  sidecar.

### Neutral

- **Cielo** (`cielo`): el fondo de todas las pantallas. Casi blanco y frío; es lo que hace que
  el blanco de encima se lea como una cosa y no como más página.
- **Cielo hundido** (`cielo-hundido`): lo hundido que se apoya directamente en la página —la
  cinta de cifras de la portada, la banda de «Por qué este proceso es distinto»—. Hoy vale lo
  mismo que `nube-hundida`; nació para que lo hundido sobre una página cálida no se leyera
  sucio, y conserva el nombre porque su papel es distinto.
- **Nube** (`nube`): toda superficie: tarjetas, formularios, la cabecera, la ventana de la
  portada.
- **Nube hundida** (`nube-hundida`): lo que va DENTRO de una superficie blanca y baja un
  escalón —los paneles de espera, la mesa sobre la que se apoyan las maquetas—.
- **Nube honda** (`nube-honda`): barras de esqueleto y el fondo de un control deshabilitado.
- **Tinta** (`tinta`): titulares, enlaces de la cabecera y el texto de lectura principal.
  18,2:1 sobre nube.
- **Tinta de prosa** (`tinta2`): la prosa que explica. 10,3:1 sobre nube.
- **Tinta apagada** (`tinta3`): lo secundario —etiquetas, fechas, pistas—. Es **el gris más
  claro que se puede usar para texto**: 4,83:1 sobre nube, 4,67 sobre cielo y 4,56 sobre nube
  hundida. El siguiente escalón de la escala no pasa en ninguno de los tres.
- **Regla** (`regla`) y **regla marcada** (`regla2`): divisores y el contorno de las
  superficies; la segunda para lo que tiene que verse un poco más.
- **Borde de control** (`borde-control`): el límite de un campo de texto. Es el gris de la
  tinta apagada, 4,83:1, porque WCAG pide 3:1 al límite visible de un control y el gris de
  reglas no llega.
- **Casi negro de cabecera** (`accion-fuerte`): **solo** el botón «Iniciar sesión» de la
  barra. Existe para que ese botón y el destino actual en índigo, que están a un palmo, no
  compitan con el mismo color. 18,9:1 con texto blanco.

### Estado

El semáforo del proceso. Cada color significa algo fijo del producto antes que del diseño.

- **Verde hecho** (`bien`, sobre `bien-bruma`): lo confirmado. 5,3:1.
- **Ámbar en duda** (`duda`, sobre `duda-bruma`, con `duda-tinta` y `duda-tinta2` para el texto
  encima): lo que no es un error del candidato pero le cambia la decisión —un requisito que no
  cumple, la última plaza libre—.
- **Rojo error** (`mal`, `mal-pulsado`, sobre `mal-bruma` con `mal-regla`): el error real y lo
  que borra.

### Named Rules

**La regla de la voz única.** El índigo es el único color con intención en una pantalla. Si
algo es índigo, se pulsa, es donde estás, o te toca. Nada decorativo se pinta de índigo.

**La regla del semáforo.** Verde, ámbar y rojo significan hecho, duda y error, y **nunca**
jerarquía ni categoría. Un dato pendiente de mirar no es una duda sobre la candidatura: no
lleva ámbar.

**La regla de la luz, no del matiz.** Toda señal que se dé solo con color tiene que diferir en
luz al menos 3:1 de lo que tiene al lado, para que se lea sin distinguir tonos. El destino
actual de la cabecera, en índigo frente a la tinta de los otros, da 3,88:1: por eso puede ir
sin peso ni subrayado.

## Typography

**Display Font:** Geist (con system-ui y sans-serif de respaldo)
**Body Font:** Geist (con system-ui y sans-serif de respaldo)

**Character:** Una sola familia geométrica y de corte técnico, cerrada de serie, que habla
igual en el titular de la portada que en la hora de una sesión. La jerarquía la hacen el
tamaño y el peso, nunca una segunda fuente.

Se sirve **desde el propio sitio** —`public/tipografia/`, fuente variable 400-700, subconjuntos
latino y latino extendido—, no desde Google Fonts: la aplicación instalada no puede abrir con
los titulares en otra letra por falta de cobertura. No hay cursiva: no se usa en ninguna hoja,
y el navegador la fabricaría inclinando la recta.

### Hierarchy

- **Display** (600, `clamp(36px, 5.2vw, 60px)`, interlínea 1, espaciado normal): el titular de
  la pantalla. Llega a 60 px en escritorio. La interlínea 1 se comprobó contra los acentos con
  las cajas de tinta de Geist: en el peor caso entre «j», «p», «í» y «ó» quedan 6 px de aire a
  1440 de ancho y 3 a 390.
- **Cifra** (600, `clamp(28px, 5vw, 34px)`, 1,1, -0,02em): el cronómetro y las cifras que se
  leen de un vistazo.
- **Headline** (600, `clamp(24px, 2.4vw, 30px)`, 1,2, -0,02em): lo mayor por debajo del
  titular — los títulos de sección de la portada, el nombre de la vacante en «Mis procesos»,
  el enunciado de una pregunta de la evaluación, la fecha de la simulación, el sueldo.
- **Navegación** (400, 17 px): los destinos de la cabecera, y nada más. Está fuera de la
  progresión a propósito: se pidió un punto más que los 16 de la referencia, y 18 ya se probó y
  se bajó.
- **Title** (600, 20 px, 1,25, -0,015em): el título de un bloque; es el `h2` por defecto.
- **Entradilla** (600, 18 px, 1,5): la entradilla y el título del tramo abierto del recorrido.
- **Body** (400, 16 px, 1,5): el cuerpo y los campos. **Nunca por debajo de 16 en un campo**:
  iOS hace zoom al enfocar cualquier cosa más pequeña.
- **Prosa** (400, 15 px, 1,55): la prosa que explica, cortada a `--medida` (50ch). Con Geist
  eso son **65-69 caracteres por línea** en prosa real.
- **Apoyo** (400, 14 px, 1,55): el texto secundario de la interfaz y los botones del kit.
- **Menor** (400, 13 px, 1,5): pies, unidades, pistas.
- **Label** (600, 12 px): etiquetas de bloque. Su variante en mayúsculas va a 700 con 0,08em.

### Named Rules

**La regla del titular único.** Un titular a escala de portada por pantalla, y ninguno más.
Si una pantalla tiene dos, uno de los dos no es un titular.

**La regla de la fuente única.** Geist para todo. La jerarquía se hace con tamaño y peso; una
segunda familia, o una cursiva, pide traer otro archivo y rompe la voz.

**La regla de la medida en `ch`.** `--medida` y `--medida-corta` están en `ch`, que depende de
la fuente. **Cambiar la fuente obliga a volver a medir** en el navegador cuántos caracteres
compra cada una, con prosa real.

## Layout

Un carril centrado de **68rem** (`--ancho`) para el portal y **120rem** (`--ancho-panel`)
para las tablas del panel del equipo. Dentro, la prosa se corta a `--medida` (50ch) o
`--medida-corta` (44ch). El espaciado va en una escala de ocho pasos —4, 8, 12, 16, 24, 32,
48 y 72 px (`--e1` a `--e8`)— y las pantallas respiran en los dos escalones de arriba entre
secciones.

La cabecera es una píldora que flota a 16 px del borde y mide **84 px** con su aire
(`--alto-cabecera`). Todo lo que se pega debajo de ella —la barra de avance del examen, el
cronómetro— se engancha a ese token. **Se mide en el navegador, no se calcula**: si cambia el
relleno de la cabecera o el alto de su botón, hay que volver a medirlo.

Las pantallas que son **una tarjeta sola** se centran en el hueco que queda entre la cabecera
y el pie: `/ingresar`, `/clave`, `/restablecer` y sus tres del panel. Todas llevan la misma
composición —la tarjeta de nube, el titular dentro a 30 px y centrado, el botón a todo el
ancho, y dentro también la vuelta atrás y la salida de quien no puede—. Solo es seguro
mientras quepan: centrar lo que no cabe desborda por los dos lados, y a lo que se sale por
arriba el navegador no deja llegar.

La contraseña olvidada —pedir el enlace y elegir la nueva— es **la misma pieza en el portal y
en el panel** (`src/ui/recuperacion/`), y se pinta pensando que va dentro de una tarjeta: la
tarjeta la pone cada pantalla.

**Hay dos pies.** El **pie en columnas** (290 px: la marca, «El portal», «Tus datos»,
«Empresas» y el copyright) va en las páginas que se leen: la portada, la búsqueda de
vacantes, la ficha de una vacante y la política. El **pie corto** (una línea, ~60 px) va en las puertas —entrar, crear cuenta, el
enlace del correo, la contraseña olvidada y las tres del panel— y en cualquier pantalla privada
vista sin cuenta. Con el grande, esas pantallas de una sola tarea sacaban scroll en un
escritorio normal. Con el corto y la composición en tarjeta, **todas caben** a 1910×922,
1440×900, 1366×768 y en un teléfono de 390×844; la única que se desplaza es `/registro`, que
es un formulario largo.

La portada es la única que rompe el carril: su cielo y la banda de «Por qué este proceso es
distinto» van **a sangre**, a `100vw`. Eso solo es seguro porque su armazón recorta con
`overflow-x: clip` —y no con `hidden`, que rompería el `sticky` de la cabecera—.

El corte principal es **640 px**, el del teléfono. Además hay cortes propios de una pieza
—900, 860, 760, 700, 620, 480, 470 y 368 px— donde esa pieza lo necesita. A 900 la banda de
tres tarjetas pasa a una columna, la lista de vacantes a dos, los filtros de `/vacantes` se
apilan encima de la lista, y la ventana de la portada deja de cortarse; por debajo de 620 la
cabecera pierde su columna central; por debajo de 470 se aprieta; por debajo de 368 se cae el
destino «Vacantes».

**Y un umbral que no es de la ventana:** la tarjeta a lo ancho de `/vacantes` se apila cuando
**ella** mide menos de **36rem** (`@container`, en `Tarjeta.module.css`). La columna de
resultados mide 704 px a 1280, 517 a 901 —la de filtros se lleva 19rem— y 343 en un teléfono de
375: ningún corte de ventana acierta los tres.

**El esqueleto de una pantalla** vive en `src/estilos/pagina.module.css` —el carril, el
encabezado, el bloque, el hueco declarado y los repartos en columnas—. `.reparto` pone una
columna que manda y una de 19rem que acompaña a la derecha; **`.repartoConFiltros`** la pone a
la **izquierda**, porque acota lo de al lado: son los filtros de `/vacantes`. Las dos se apilan
a 900 px. Son variantes con nombre y no un `grid-template-columns` que la pantalla se escribe
encima: entre archivos gana el orden en que se juntan las hojas, no el que se escribe.

### Named Rules

**La regla del carril.** Nada de texto corre de borde a borde. Lo que va a sangre es fondo;
dentro, el carril vuelve.

## Elevation & Depth

**Plano por tono.** Las superficies se separan de la página porque son más claras que ella
—blanco sobre gris frío—, no porque floten. En reposo, casi nada lleva sombra: ni las
tarjetas, ni la cabecera, ni la ventana de la portada. La sombra se reserva a dos cosas: los
controles que se pulsan y lo que flota de verdad por encima de la página.

### Shadow Vocabulary

- **Control** (`--sombra-control`, cuatro capas neutras): sostiene los botones secundarios,
  que son blancos y sin contorno.
- **Control alzado** (`--sombra-control-alta`): el botón de acción bajo el ratón.
- **Nube** (`--sombra-nube`): superficies que se levantan por un estado — la tarjeta de lo que
  te toca, la tarjeta de «Entrar».
- **Aviso** (`--sombra-aviso`): lo que flota encima de todo — modales y avisos.

### Named Rules

**La regla del plano en reposo.** Una superficie en reposo no lleva sombra. Si hace falta
separar una cosa blanca de otra blanca, baja un escalón de tono (`nube-hundida`); no se
apilan sombras.

## Shapes

Esquina corta y constante. Los controles —botones y campos— llevan **8 px**; las superficies,
**12 px**; lo más pequeño que se redondea —una casilla, un avatar cuadrado— lleva 4. La única
forma completamente redonda son las barras del recorrido y los indicadores (999 px): **ningún
botón es una píldora**.

Tres piezas llevan su propio radio, medido en la referencia y con token propio aunque solo
lo use cada una: la **píldora de la cabecera** (`rounded.pildora`), el **marco de cristal** de
la portada (`rounded.cristal`) y la **ventana** de dentro (`rounded.ventana`). El marco y la
ventana se cortan por abajo —radio arriba y cero abajo—, porque la ventana no termina, se
desvanece. Un valor de radio fuera de esta escala no se escribe a mano: o se nombra aquí, o no
se usa.

## Components

### Buttons

Precisos y serenos: esquina de 8 px, 44 px de alto como mínimo, un solo color con intención.

- **Shape:** esquina de 8 px (`rounded.control`); 44 px de alto (48 en el peligroso).
- **Acción** (`button-accion`): índigo con texto blanco, 14 px peso 500, relleno 12 × 20. Es la
  acción principal de la pantalla, y hay una.
- **Hover / Focus:** al pasar por encima se oscurece a `activo-pulsado` y se levanta con la
  sombra de control alzado; el foco es un anillo índigo de 2 px a 3 px de distancia, el mismo
  en todo el portal.
- **Rótulo que gira:** los botones del kit y el de la cabecera llevan su texto dos veces en
  `data-rotulo`; al pasar por encima la copia de arriba sube y la de abajo entra. Es la única
  respuesta que tiene el secundario, así que **si algún día se quita el giro hay que darle
  otra**.
- **Secundario** (`button-secundario`): blanco, sin contorno, sostenido por la sombra de
  control. ⚠️ Su límite **no llega al 3:1 que WCAG pide al borde de un control**: blanco sobre
  el gris de la página casi no se distingue y la sombra no cuenta para el contraste. Es una
  decisión del cliente, tomada a sabiendas; volver atrás es una línea
  (`border: 1px solid var(--borde-control)`).
- **Cabecera** (`button-cabecera`): «Iniciar sesión», macizo en casi negro, 15 px peso 600.
  Se levanta 1 px al pasar por encima y se encoge un 2 % al pulsar.
- **Peligroso** (`button-peligroso`): rojo, solo para lo que borra.
- **Deshabilitado:** fondo `nube-honda` y texto `tinta3`, sin sombra.

### Cards / Containers

- **Corner Style:** 12 px (`rounded.superficie`).
- **Background:** nube blanca sobre el cielo; `nube-hundida` para lo que va dentro de otra
  superficie.
- **Shadow Strategy:** ninguna en reposo (ver Elevation & Depth).
- **Border:** 1 px de `regla`.
- **Internal Padding:** 24 px.
- **Te toca** (`panel-te-toca`): la superficie que reclama algo del candidato. Borde de **2 px
  índigo** además de su sombra de nube: el grosor es la forma que lo distingue, el color la
  acompaña.
- **Espera** (`panel-espera`): hundida en `nube-hundida`, sin nada que pulsar.
- **En duda** (`panel-en-duda`): ámbar, solo cuando algo le cambia la decisión.

### Inputs / Fields

- **Style:** blanco, 48 px de alto, esquina de 8 px, borde de 1 px en `borde-control`, texto a
  16 px.
- **Focus:** el anillo índigo de 2 px del sistema.
- **Error:** el mensaje en `mal` a 13 px debajo del campo, y al enviar el foco salta al primer
  campo con error.
- **Obligatorio:** un asterisco en tinta plena y peso 700 en la etiqueta, explicado una vez
  antes del primer campo.

### La tarjeta de vacante — de pie y a lo ancho

`src/paginas/vacantes/Tarjeta.tsx` tiene **dos formas y un solo enlace**: en las dos, la
tarjeta entera es un enlace cuyo nombre es el título, y el título es el mismo `TituloQueViaja`
que cruza hasta el titular de la ficha. Nube sobre el cielo, filete de `regla`, esquina de
12 px y, al pasar por encima, la sombra de nube y la pieza D.

- **De pie** (`forma="dePie"`): la portada, tres en fila. Modalidad · ciudad arriba, título,
  empresa, resumen de tres líneas y un pie con horario, sueldo y fecha.
- **A lo ancho** (`forma="aLoAncho"`): la lista de `/vacantes`, una por fila. A la izquierda
  «Publicada hace…», el título, la empresa y el resumen en **dos** líneas; a la derecha, tras
  una línea de 1 px en `regla` —separador neutro, no barra de acento—, una columna de 13rem con
  **dónde** (la ciudad o, sin ella, la zona), **modalidad**, **horario** y **sueldo**, cada uno
  con su icono de 16 px en `currentColor`. El dato que falta no se pinta; el sueldo siempre,
  porque `OCULTA` se nombra: «Sueldo sin publicar» en `tinta2`, el monto publicado en tinta
  plena y 600. Se apila cuando la tarjeta mide menos de 36rem.

**El resumen es el propósito o, si falta, la descripción, y un campo con solo espacios falta**:
lo decide `resumenDe` de `busqueda.ts`, la misma función con la que el orden cuenta si la
vacante trae resumen, para que la tarjeta y el orden no discrepen.

### La búsqueda de vacantes

`/vacantes` pone **los filtros en una columna de 19rem a la izquierda** (`.repartoConFiltros`),
sobre nube y con los grupos plegables. Encima de las dos columnas, a todo el ancho, el contador
y «Ordenar por». **Las etiquetas activas y «Quitar filtros» van siempre justo encima de la
lista**, en la columna de resultados: marcar una casilla mueve la lista, nunca los grupos bajo
el puntero, y lo que se ve sigue el orden de Tab. De 641 a 900 px los filtros se apilan
abiertos, y hasta 640 se pliegan tras «Filtrar (n)» —`.secundarioDelTelefono` de
`piezas.module.css`, que existe porque un `display: none` en la hoja de la pantalla perdía
contra el `inline-flex` del secundario—.

- **«Ordenar por»** son dos caras pegadas con la esquina de 8 px por fuera: la marcada, rellena
  en índigo con texto blanco (4,57:1); la otra, con el contorno de control.
- **El índigo es solo lo marcado** —el orden elegido, las casillas y los radios—, que es
  «dónde estás». Nadie tiene turno en una lista de vacantes, así que aquí no hay borde de 2 px
  en ninguna parte.

### Navigation

Una píldora blanca que flota a 16 px del borde, **sin filete ni sombra**, en reposo y al bajar
la página, con radio de 18 px. Tres columnas: la marca a la izquierda, los destinos en el
centro exacto y la acción a la derecha — las columnas de los lados valen lo mismo para que
«Iniciar sesión» y «Mi cuenta», que no miden igual, no descentren los destinos.

- **Destinos:** Geist 17 px peso 400 en tinta (15 px en teléfono), con 44 px de área táctil.
- **Hover:** se abre un filete gris de 2 px bajo el destino.
- **Activo:** índigo, **sin peso ni filete**. Se sostiene solo por la regla de la luz (3,88:1
  frente a los otros), y `aria-current="page"` lo dice a quien usa lector.
- **«Inicio» y «Vacantes» son dos pantallas.** «Inicio» es la portada; «Vacantes» es
  `/vacantes`, la búsqueda, y va sin `end` para encenderse también en la ficha de cualquier
  vacante.
- **Teléfono:** por debajo de 620 px las tres columnas pasan a un reparto simple. **Por debajo
  de 470 se aprieta**: los destinos bajan a 13 px y los rellenos al mínimo, sin bajar de los 44
  px táctiles — con la letra de 15, de 431 a 454 px la barra se salía hasta 24 px. **Por debajo
  de 368 se cae «Vacantes»**: a 320 no caben los cuatro ni apretados, y es el destino con más
  caminos alternativos (el botón grande de la portada y «← Volver a las vacantes» de cada
  ficha). Medido: a 375 sobran 11 px, a 369 sobran 5 y a 320, con tres destinos, 17.

⚠️ Sobre el gris claro de más abajo en la página la píldora casi no se distingue, y el
contenido pasa por detrás sin línea que lo corte. Es lo que hace la referencia, aceptado a
sabiendas.

### El cielo de la portada

Un cielo azul con nubes, **solo en la portada**, que pasa por detrás de la cabecera y se apaga
hacia abajo hasta el gris de la página. Tres capas, cada una copiada de una cosa de la foto de
la referencia:

- **La luz en el centro.** Un resplandor casi blanco justo detrás del titular que se vuelve
  azul hacia los bordes y las esquinas. Además de parecerse, es lo que mejor le va al texto: la
  tinta cae sobre lo más claro del cielo.
- **El azul con su horizonte:** azul desde arriba del todo, una franja más saturada cerca de
  abajo, y el fundido al gris de la página. **Arriba es azul a propósito**: una píldora blanca
  se lee mejor sobre azul que sobre blanco.
- **Las nubes, de ruido fractal**, en los bordes y nunca en el centro: jirones estirados en
  horizontal y un cúmulo abajo a la izquierda con una sombra azulada que le da volumen. Se
  **generan** a partir de `herramientas/cielo/cielo-nubes.svg` y se sirven ya pintadas como
  `public/cielo-nubes.webp` (40 KB): calcular el ruido en el navegador costaba ~100 ms de hilo
  principal en escritorio en cada carga. **Si se toca el SVG, hay que volver a correr
  `herramientas/cielo/pintar-nubes.mjs`.**

En un teléfono las nubes casi no asoman: la imagen se ajusta al alto y en 390 px solo se ve su
centro, que es el que queda limpio para el titular. Es a propósito.

### La ventana de cristal

La pieza grande de la portada: el recorrido de cinco etapas, presentado como una ventana del
portal dentro de un marco de vidrio.

- **El marco:** filete blanco de 1 px, 12 px de relleno con un blanco al 25 % que se desvanece
  hacia abajo, radio 26 solo arriba. Por el relleno se ve el cielo. Sin sombra ni resplandor.
- **La ventana:** una barra que retrata la cabecera, el recorrido, y una ficha que asoma y se
  corta contra el borde; todo se funde en los últimos 120 px.
- **Lo que se corta es solo decoración** (`aria-hidden`, sin texto ni enlaces). El recorrido
  queda entero por encima del fundido — **medido a seis anchos**, entre 15 y 40 px de margen.
- **Por debajo de 900 px la ventana termina de verdad:** se cierra entera y no se funde, porque
  apilado el recorrido crece y el recorte cortaría la última etapa.

### El recorrido

Cinco tramos —Perfil, Prueba, Simulación, Validación, Decisión— **dibujados igual en la
portada que dentro del portal**: lo que se ve antes de entrar es lo que se verá después.

- **El estado va en la forma:** el tramo en curso es una franja maciza en índigo; los que
  faltan, en `regla`. Con la pantalla en gris se distinguen igual, que es la comprobación.
- La franja **se dibuja de izquierda a derecha en cada carga**.

### Movimiento

Cuatro piezas independientes en [`src/ui/movimiento.tsx`](src/ui/movimiento.tsx), para poder
quedarse con unas y tirar otras sin desmontar el resto:

- **B · El título que viaja:** el título de una vacante pasa de su tarjeta a la ficha.
- **C · La franja que se llena:** la barra del recorrido se dibuja de izquierda a derecha.
- **D · La tarjeta que responde:** la tarjeta de vacante se levanta al pasar por encima.
  ⚠️ **Su superficie lleva `tabIndex={-1}`, y no es un descuido.** `motion` pone `tabindex="0"`
  a todo lo que tenga `whileTap` y no sea un control: cada tarjeta eran dos paradas de Tab, una
  caja sin nombre y después su enlace. Con `-1` la única parada es el enlace, y el toque sigue
  hundiendo la superficie porque el `pointerdown` del enlace sube hasta ella.
- **E · Al asomarse:** un bloque de la portada entra al asomar por el borde de la ventana, y sus
  hermanos en fila, de 200 en 200 ms. Solo en la portada.

La pieza A —cada pantalla entraba desplazándose— existe pero **no se usa** desde el 22/09: al
cambiar de pestaña el contenido llegaba tarde y se leía como un fallo. «Inicio» sube
deslizándose cuando no cambias de pantalla, y cambiar de pantalla salta: lo que llega es
contenido nuevo.

### Named Rules

**La regla del reloj.** Dentro de la prueba del puesto no se mueve nada. El reloj corre, y
cualquier cosa que se mueva compite con una tarea cronometrada.

**La regla de la barrera.** Todas las piezas respetan `prefers-reduced-motion` y se montan ya
en su estado final. Esto es un portal de empleo: una barrera aquí impide postular a un trabajo.

## Do's and Don'ts

### Do:

- **Do** separar una superficie de la página por tono —blanco sobre `cielo`— y bajar a
  `nube-hundida` lo que va dentro de otra superficie.
- **Do** pintar de índigo solo lo que se pulsa, dónde estás y lo que te toca.
- **Do** decir cada estado con una forma —franja maciza, borde de 2 px, filete— además del
  color.
- **Do** medir en el navegador, no calcular: el alto de la cabecera, los caracteres por línea,
  los contrastes y dónde corta un fundido.
- **Do** usar los tokens de `mundo.css` y las piezas de `piezas.module.css`; una variante
  nueva se declara con nombre en la hoja compartida.
- **Do** mantener 44 px de área táctil en todo lo que se pulsa.

### Don't:

- **Don't** usar verde, ámbar o rojo para jerarquía o categoría.
- **Don't** redondear un botón en píldora; la esquina de un control es de 8 px.
- **Don't** poner dos titulares a escala de portada en una misma pantalla.
- **Don't** aclarar el índigo de acción: blanco encima da 4,57:1 y un escalón más claro deja de
  pasar.
- **Don't** usar para texto un gris más claro que `tinta3`.
- **Don't** mover nada dentro de la prueba del puesto.
- **Don't** traer una segunda familia tipográfica ni una cursiva.
- **Don't** usar `overflow: hidden` para recortar un fondo a sangre: rompe la cabecera
  pegajosa. Es `clip`.
- **Don't** meter crema, negro pleno como acción, ni coral: son del mundo anterior.
