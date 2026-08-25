---
name: EX · Portal del candidato
description: El seguimiento de una candidatura, impreso en papel blanco y tinta negra, con un solo índigo que significa «te toca a ti».
colors:
  papel: "#ffffff"
  hundido: "#f5f5f7"
  hundido2: "#ebebef"
  tinta: "#1c1c1e"
  tinta2: "#48484d"
  tinta3: "#6e6e77"
  tinta-invertida: "#ffffff"
  tinta-pulsado: "#000000"
  regla: "#e3e3e8"
  regla2: "#c7c7d0"
  borde-control: "#8a8a99"
  acento: "#4338ca"
  acento-pulsado: "#312ba0"
  acento-papel: "#f1f0fe"
  acento-regla: "#c5c2f4"
  bien: "#0f7a3d"
  duda: "#8a5a00"
  duda-papel: "#fdf6e6"
  duda-tinta: "#6b4700"
  mal: "#b3261e"
  mal-pulsado: "#8e1e17"
  mal-papel: "#fdecea"
  mal-regla: "#f2c0bc"
typography:
  display:
    fontFamily: "Libre Franklin, system-ui, sans-serif"
    fontSize: "clamp(28px, 4.4vw, 40px)"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.028em"
  cifra:
    fontFamily: "Libre Franklin, system-ui, sans-serif"
    fontSize: "clamp(26px, 5vw, 30px)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Libre Franklin, system-ui, sans-serif"
    fontSize: "clamp(19px, 2vw, 22px)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Libre Franklin, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.018em"
  entradilla:
    fontFamily: "Libre Franklin, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  body:
    fontFamily: "Libre Franklin, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  prosa:
    fontFamily: "Libre Franklin, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  apoyo:
    fontFamily: "Libre Franklin, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  menor:
    fontFamily: "Libre Franklin, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  label:
    fontFamily: "Libre Franklin, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.09em"
rounded:
  none: "0"
measure:
  ancho: "68rem"
  medida: "47ch"
  medida-corta: "42ch"
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
    backgroundColor: "{colors.acento}"
    textColor: "{colors.tinta-invertida}"
    rounded: "{rounded.none}"
    padding: "0 32px"
    height: "48px"
    typography: "{typography.body}"
  button-acento-grande-hover:
    backgroundColor: "{colors.acento-pulsado}"
    textColor: "{colors.tinta-invertida}"
  button-acento-grande-disabled:
    backgroundColor: "{colors.hundido2}"
    textColor: "{colors.tinta3}"
  button-acento-menor:
    backgroundColor: "{colors.acento}"
    textColor: "{colors.tinta-invertida}"
    rounded: "{rounded.none}"
    padding: "0 24px"
    height: "44px"
  button-secundario:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.none}"
    padding: "0 24px"
    height: "44px"
  button-secundario-hover:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.tinta}"
  button-solido:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.papel}"
    rounded: "{rounded.none}"
    padding: "0 24px"
    height: "44px"
  button-peligroso:
    backgroundColor: "{colors.mal}"
    textColor: "{colors.tinta-invertida}"
    rounded: "{rounded.none}"
    padding: "0 24px"
    height: "48px"
  input:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.none}"
    padding: "0 12px"
    height: "48px"
  input-error:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.tinta}"
  panel-te-toca:
    backgroundColor: "{colors.acento-papel}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.none}"
    padding: "24px"
  panel-neutro:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.none}"
    padding: "24px"
---

# Design System: EX · Portal del candidato

## Overview

**Creative North Star: «El seguimiento»**

Tu postulación es algo que va en camino. El portal es la guía de esa encomienda: hitos
cumplidos y fechados, y un siguiente hito siempre nombrado. La persona que llega lleva días o
semanas esperando y no controla nada del proceso; lo único que le debemos es que en tres
segundos sepa si le toca algo a ella, y si le toca, pueda empezarlo sin buscar dónde.

Lo que separa esto de un rastreo de paquete cualquiera es una sola decisión, y de ella cuelga
el resto: **lo cumplido no se apaga**. Un rastreo normal enfoca el hito actual y desvanece los
anteriores. Aquí cada etapa cerrada deja una marca fechada que se sigue leyendo con el mismo
peso, porque el producto trata de acumular evidencia — lo que ya demostró es suyo. El
documento es del candidato, no del sistema.

El material es papel blanco y tinta negra, impresos. Cero radios, reglas a un píxel exacto,
sin sombras de cromo, y un solo índigo que aparece poco y siempre por el mismo motivo. Se
rechazaron explícitamente el champán del portal anterior —color de marca que no significaba
nada— y el azul de Apple, cuya estética le gusta al cliente pero cuyo azul pidió no usar. El
tema oscuro no existe y no va a existir: es petición del cliente.

**Key Characteristics:**

- Cero radios en toda la interfaz; cada regla a un píxel exacto.
- El estado se lee en la forma antes que en el color.
- La tipografía hace toda la jerarquía; ningún recuadro fabrica un nivel.
- Un solo acento, con un solo significado, y poco.
- Un solo momento con movimiento en todo el portal.
- Solo tema claro.

## Colors

Una paleta de imprenta: papel, tres tintas de gris, dos pesos de regla, un acento y un
semáforo. Nada es decorativo — cada color entra porque distingue algo que hay que distinguir.

### Primary

- **Índigo de turno** (`#4338ca`): el acento, y significa **una sola cosa**: «te toca a ti».
  Marca el panel de la acción pendiente, el tramo del recorrido donde está el candidato y el
  botón que empieza esa acción. No aparece en enlaces, ni en titulares, ni en iconos.
- **Índigo pulsado** (`#312ba0`): el mismo, al pasar por encima o al pulsar.
- **Papel de turno** (`#f1f0fe`): el fondo del panel que sí pide algo. Es lo que hace que la
  postulación abierta se distinga de las cerradas sin necesidad de leer.
- **Regla de turno** (`#c5c2f4`): el contorno de ese panel.

### Neutral

- **Papel** (`#ffffff`): el fondo de todo. Blanco puro, no crema.
- **Hundido** (`#f5f5f7`): bloques de apoyo —«qué llevar», «qué pasa después»— que acompañan
  sin competir. Es la única forma de agrupar que no usa un borde.
- **Hundido segundo** (`#ebebef`): barras de esqueleto de carga y fondo de lo deshabilitado.
- **Tinta** (`#1c1c1e`): titulares y todo lo que se lee primero. Casi negro, no negro.
- **Tinta segunda** (`#48484d`): la prosa explicativa. Es el color de la mayor parte del texto.
- **Tinta tercera** (`#6e6e77`): pies, unidades, antetítulos. **No bajar de aquí**: con
  `#77777d` el texto pequeño se queda en 4,45:1 sobre papel y no llega al mínimo de 4,5.
- **Regla** (`#e3e3e8`): la línea que divide dentro de un bloque.
- **Regla segunda** (`#c7c7d0`): la que cierra un bloque, y el color del subrayado de enlaces.
- **Borde de control** (`#8a8a99`): el contorno de cualquier cosa que se pueda tocar. Es más
  oscuro que una regla a propósito: un control pide 3:1 contra el fondo, una caja no.
- **Tinta invertida** (`#ffffff`) y **tinta pulsada** (`#000000`): el texto sobre un relleno y
  el relleno al pulsarlo. Se separan del papel aunque hoy coincidan, para que el día que el
  papel deje de ser blanco puro el texto de los botones no se mueva con él.

### Tertiary — el semáforo del sistema

Estos tres ya tenían significado fijo en el producto antes que en el diseño, y por eso el
acento no podía ser ninguno de ellos, ni un verde azulado que junto a una etiqueta verde real
se leyera como «aprobado».

- **Verde de hecho** (`#0f7a3d`): lo confirmado. Asistencia confirmada, etapa superada.
- **Ámbar de duda** (`#8a5a00`), sobre **papel de duda** (`#fdf6e6`) y con **tinta de duda**
  (`#6b4700`): lo que no es un error del candidato pero le cambia la decisión. El aviso de que
  no cumple un requisito indispensable, la última plaza libre, el «esto todavía no se puede
  enviar». Sobre el papel de duda, el propio ámbar se queda en 4,1:1; la tinta de duda llega a
  8,3:1 y se sigue leyendo como el mismo ámbar.
- **Rojo de fallo** (`#b3261e`), con **pulsado** (`#8e1e17`), **papel** (`#fdecea`) y **regla**
  (`#f2c0bc`): el error real y la acción destructiva. Nada más.

### Named Rules

**La regla de una sola voz.** El índigo significa «te toca a ti» y nada más. En cuanto aparece
en un botón secundario, en un enlace o en un titular, el candidato deja de poder fiarse del
color y tiene que leerlo todo. Los enlaces del portal van en tinta con subrayado gris por esta
razón, no por gusto.

**La regla del semáforo prestado.** Verde, ámbar y rojo ya significan algo en el producto. No
se usan para jerarquía, para categorizar ni para decorar.

## Typography

**Display / Body / Label:** Libre Franklin (con `system-ui, sans-serif`), servida desde Google
Fonts. Una sola familia para todo.

**Character:** una grotesca americana de finales del XIX, de las que se usaban para impresos
públicos: legible en cuerpos pequeños, con carácter suficiente en los grandes para no
necesitar ayuda. No se usan Inter, Roboto, Geist, Instrument Sans ni Space Grotesk — el
detector las marca como sobreexpuestas, y la primera versión de este portal cayó en una de
ellas.

### Hierarchy

Diez escalones, y cada uno tiene un trabajo, no un tamaño. Viven como tokens en
`mundo.css` —`--t-micro` … `--t-portada`— porque antes no existían y cada hoja se inventaba el
suyo: trece valores distintos repartidos por veinte hojas.

- **Display** `--t-portada` (600, `clamp(28px, 4.4vw, 40px)`, 1.12, `-0.028em`, balanceado): el
  titular de cada pantalla. Uno por pantalla y ninguno más.
- **Cifra** `--t-cifra` (600, `clamp(26px, 5vw, 30px)`): el cronómetro de la prueba y las cifras
  que hay que leer de un vistazo. Siempre con `tabular-nums`.
- **Headline** `--t-destacado` (600, `clamp(19px, 2vw, 22px)`, `-0.02em`): lo mayor dentro de una
  pantalla — el nombre de la vacante, el enunciado de una pregunta, la fecha reservada.
- **Title** `--t-titulo` (600, 19px, 1.25, `-0.018em`): el título de un bloque. Es el valor de
  `h2`, así que casi siempre llega por el elemento y no por una clase.
- **Entradilla** `--t-entradilla` (400, 17px, 1.6): la frase que presenta una pantalla, y el
  título del hito abierto.
- **Body** `--t-base` (400, 16px, 1.5): el cuerpo y los campos. **Nunca por debajo en un campo
  de texto**: a menos de 16 px iOS hace zoom al enfocarlo.
- **Prosa** `--t-prosa` (400, 15px, 1.55): la prosa que explica. Es el segundo tamaño más usado
  del portal.
- **Apoyo** `--t-apoyo` (400, 14px, 1.5): el texto secundario de la interfaz. El más usado.
- **Menor** `--t-menor` (400, 13px): pies, unidades, pistas bajo un campo.
- **Label** `--t-micro` (600, 12px, `0.09em`, versalitas): las dos etiquetas que sobrevivieron a
  `critique`. Ver el final de este documento.

Los dos `clamp` sustituyen a cuatro reglas de `@media` que solo bajaban un número en móvil.

Los datos —fechas, cuentas, plazos, el cronómetro— llevan `font-variant-numeric: tabular-nums`
para que no bailen al cambiar. Está aplicado globalmente a `<time>` y a `[data-cifra]`.

### Named Rules

**La regla de la jerarquía tipográfica.** El tamaño y el peso hacen los niveles. Ningún
recuadro, sombra ni fondo existe para crear un nivel que el tamaño ya crea.

**La regla de la frase entera.** No se parten frases con elementos dentro. Poner `<b>`
alrededor de los números de «Pregunta 2 de 4» rompió cuatro pruebas, y por la misma razón por
la que rompe a un lector de pantalla: la frase deja de leerse de una pieza.

## Layout

**El portal mide `--ancho` (68rem) en escritorio, y ese ancho es para componer, no para leer.**
La prosa de dentro sigue cortada por `--medida`, así que ensancharlo no alarga una sola línea:
lo que hace es dar sitio para poner cosas al lado de otras. Antes el portal ocupaba 760 px en
una pantalla de 1920 —dos tercios vacíos— y parecía hecho para el teléfono.

**No todas las pantallas lo usan.** Entrar, crear cuenta, la contraseña olvidada y postular se
quedan en 34–44rem: son formularios, y un formulario ancho se lee peor. Privacidad se queda en
48rem. Lo usan las que tienen algo que componer: la portada, la ficha, el hub, el detalle, el
examen, la prueba, la decisión y la validación.

**Lo que el ancho compra, pantalla por pantalla:**

- La portada pone las **cinco etapas en horizontal**. Son una secuencia, y leerlas de izquierda
  a derecha dice «esto va en camino» mejor que la misma lista apilada.
- Cada vacante usa las dos mitades: el puesto y para qué existe a la izquierda; dónde, en qué
  modalidad y la entrada al puesto a la derecha.
- La ficha pone «Lo que harás» y «Lo que buscamos» en paralelo, que es como se comparan.
- El examen abre su **mapa al lado**, no encima: la pregunta ya no se mueve al abrirlo.

- El **detalle** pone «Tu recorrido» y «Cómo llegaste hasta aquí» en paralelo: son dos lecturas
  del mismo viaje —dónde estás y cómo llegaste— y en vertical la segunda quedaba tan abajo que
  casi nadie la veía.
- La **prueba en curso** pone el encargo a la izquierda y **fijo**, y el trabajo a la derecha.
  Es la pantalla que se habita dos horas cronometradas, y era la única plana.

**El corte está en 900 px** para todas las composiciones. Por debajo, todo vuelve a una
columna: en un teléfono es lo único que funciona.

### Named Rules

**La regla del panel con dueño.** El tope de línea va en el panel, no en los párrafos de
dentro. Cuando el portal pasó de 760 a 1088 px, los paneles crecieron con el contenedor y su
texto no: quedaban con un 59 % de relleno vacío, y la densidad **empeoraba** cuanto más ancha
la pantalla. Con el tope en el panel, la medida tiene un solo dueño.

**La regla del desfase medido.** Un elemento pegajoso que se pega debajo de otro no adivina su
altura: la mide y la guarda en un token junto a la barra que la produce —`--alto-avance`,
`--alto-reloj`—. Los dos que había escritos a ojo estaban mal, uno por 44 px y otro por 90.

El ritmo sale de ocho escalones —4, 8, 12, 16, 24, 32, 48 y 72 px— y de una sola regla: se
agrupa apretando y se separa con holgura. Sobre un título va más aire que debajo.

**La medida de la línea son dos tokens y nada más:** `--medida` (47ch) para la prosa corriente
y `--medida-corta` (42ch) dentro de un bloque de apoyo. Los números parecen bajos y no lo son:
`ch` es el ancho del «0», que en Libre Franklin es ancho, así que 47ch compran **68–72
caracteres por línea** — medido en el navegador, no calculado. El valor anterior, 62ch, daba
91–96 y estaba muy por encima del suelo con el que se lee cómodo.

La cabecera es fija y mide **61 px**, guardados en `--alto-cabecera` porque la barra de avance
del examen se pega justo debajo y no puede adivinarlo.

**Puntos de corte:** el que manda es **640 px**, donde todo pasa a una columna, los botones
principales ocupan el ancho y el mapa de preguntas del examen se abre desde arriba en vez de
por el lado. Tres pantallas tienen además el suyo propio —900, 860 y 760 px— para partir su
columna lateral antes de llegar a móvil.

**Cualquier cosa que se pueda tocar mide 44 px de alto como mínimo**, aunque su texto mida
catorce. No es por el texto: es el área que hace falta para acertarle con el pulgar. Los
campos de texto suben a 48 px y **nunca bajan de 16 px de tamaño de letra**, porque por debajo
iOS hace zoom al enfocarlos.

## Elevation & Depth

**El sistema es plano.** No hay una escala de elevación y no debe crearse. La profundidad se
consigue con tres cosas, en este orden: una regla a un píxel, un fondo hundido, y el peso
tipográfico. Un bloque que necesita destacarse cambia de fondo o engorda su contorno; no se
levanta.

Existen exactamente tres sombras en todo el portal, y ninguna es decorativa: las tres son la
respuesta a un estado.

### Shadow Vocabulary

- **El paso levantado** (`box-shadow: 0 6px 16px rgb(28 28 30 / 0.14)`): solo mientras se
  arrastra uno de los pasos que hay que ordenar. Dice «esto lo tienes cogido».
- **El aviso** (`box-shadow: 0 18px 48px rgb(28 28 30 / 0.18)`): el modal, para que su regla
  no se confunda con las del fondo apagado.
- **El halo del hito abierto** (`box-shadow: 0 0 0 3px var(--acento-papel)`): un anillo sin
  desenfoque alrededor de la marca donde está el candidato. Es un ensanche, no una sombra.

### Named Rules

**La regla del plano por defecto.** Las superficies están planas en reposo. Una sombra solo
aparece como respuesta a un estado —arrastrar, interrumpir, señalar el turno—, nunca para
sugerir que una tarjeta flota.

## Shapes

**Cero radios. En todo.** No hay ni una sola declaración de `border-radius` en el portal, y no
debe aparecer ninguna. Los estados son marcas impresas, no cromo.

Todos los contornos son de **1 px**, salvo cuando el grosor está diciendo algo: 2 px marcan lo
elegido, lo erróneo y lo que borra de verdad. Ese es el vocabulario entero de la forma:

| Forma | Qué dice |
|---|---|
| Relleno macizo | Cumplido, elegido, entregado |
| Contorno grueso (2–3 px) | En curso, o error |
| Contorno fino (1 px) | Pendiente, disponible |
| Contorno discontinuo | Adjuntar aquí, o «lo escribe una persona» |
| Tachado | Aquí se detuvo |

### Named Rules

**La regla de la forma primero.** Todo estado tiene que leerse en la forma antes que en el
color. Quien no distingue colores lee el mismo recorrido. Si al quitarle el color a una
pantalla deja de saberse qué pasa, la pantalla está mal.

## Components

### Buttons

Cuatro piezas y ninguna más. Viven en `src/estilos/piezas.module.css` y **no se escriben en el
JSX**: cada pantalla las trae con `composes` desde su propia hoja, de modo que el botón
conserva el nombre de lo que hace —`.entregar` se llama entregar— y comparte la forma.

- **Shape:** rectángulo exacto (radio 0), contorno de 1 px del mismo color que el relleno.
- **Acento grande** (48 px de alto, `0 32px`, 16px/600): la acción principal de una pantalla.
  Postular, entregar, empezar la prueba, confirmar la fecha.
- **Acento menor** (44 px, `0 24px`, 15px/600): la misma acción cuando vive dentro de un hito
  o de un aviso y no puede pesar más que su contenedor.
- **Secundario** (44 px, `0 24px`, papel con borde de control): todo lo demás que se puede
  pulsar. Reintentar, cancelar, elegir archivo, navegar el examen.
- **Sólido** (44 px, tinta maciza sobre papel): cuando algo tiene que pesar más que un contorno
  y el acento estaría mintiendo — la salida segura de un aviso, o el botón de una pantalla
  vacía, donde no hay ningún proceso esperando.
- **Hover:** el acento va a `#312ba0`; el sólido, a negro; el secundario engorda su contorno a
  tinta. Siempre `140ms cubic-bezier(0.16, 1, 0.3, 1)` y siempre bajo `:not(:disabled)`.
- **Disabled:** fondo hundido, contorno de regla, tinta tercera, cursor normal. Un botón
  apagado nunca finge que se puede pulsar.
- **Peligroso** (rojo macizo, 48 px): solo borra datos. Su variante de contorno rojo sobre
  papel es para retirarse de una vacante.

### Inputs / Fields

- **Style:** 48 px de alto, papel, contorno de 1 px de borde de control, 16 px de letra, radio 0.
- **Focus:** el anillo global —2 px de acento con 2 px de separación— sobre `:focus-visible`.
  Es el único sitio del portal donde el acento no significa «te toca a ti», y se acepta porque
  es una convención del navegador que el usuario ya tiene aprendida.
- **Error:** el borde **engorda a 2 px** y se vuelve rojo, en ese orden de importancia. El
  mensaje va debajo, atado al campo con `aria-describedby`, con una barra roja de 3 px a su
  izquierda, y **dice el problema y cómo se arregla** — nunca «campo inválido».
- **Radios y casillas:** el control nativo se oculta y la etiqueta entera se vuelve el objetivo.
  Lo elegido se dice rellenando la marca y engordando el contorno de la fila; nunca solo con
  color.

### Cards / Containers

No hay tarjetas. Hay **bloques**: contorno de 1 px de regla, papel o fondo hundido, `24px` de
relleno interior que baja a `16px` en móvil, y su título en Headline dentro. **Nunca se anidan
bloques con contorno**; si algo tiene que ir dentro de un bloque, cambia de fondo, no de borde.

El bloque que pide algo al candidato es el único que cambia de piel: contorno de regla de
turno y fondo de papel de turno.

### Navigation

Cabecera fija de 61 px, papel, cerrada con una regla de 1 px. La marca EX a la izquierda; tres
enlaces a la derecha en 14 px de tinta segunda. **La página en la que estás se marca con una
regla bajo el texto y con el peso, no con el acento.**

### Aviso (modal)

Papel con contorno de 1 px de **tinta** —no de regla, para que se despegue del fondo apagado—,
`min(38rem, 100vw - 2rem)`, cabecera y pie separados por reglas. El fondo se apaga con
`rgb(28 28 30 / 0.4)`. Se cierra con Escape, con el aspa o tocando fuera, y el foco no se
escapa. Donde basta, se usa `<dialog>` nativo en vez de este componente.

### Signature Component — la línea de hitos

Es la pieza que sostiene el mundo entero. Cinco etapas en columna, cada una con una marca
cuadrada de 15 px y un riel de 1 px que baja hasta la siguiente.

- **Cumplida:** marca de tinta maciza, riel de tinta, con su fecha. **No se atenúa nunca.**
- **En curso y te toca:** marca de índigo con halo de papel de turno. Es la única marca del
  portal con acento, y dentro de su hito va la acción.
- **En curso esperando a otro:** contorno de 3 px de tinta, sin acento, sin botón.
- **Pendiente:** contorno de 1 px de regla segunda, nombrada en gris.
- **Cortada:** contorno fino y **tachada**. La forma dice «aquí se detuvo» sin depender del
  rojo.

### Motion

**Un solo momento con movimiento en todo el portal:** la marca de una etapa recién cumplida,
que entra desde `scale: 0.4, opacity: 0` y se asienta. Está apagada bajo
`prefers-reduced-motion`. Todo lo demás son transiciones de estado de 140 ms con
`cubic-bezier(0.16, 1, 0.3, 1)` —una salida exponencial desde algo que ya se ve—, y **dentro
del examen no hay movimiento de ningún tipo**.

### Named Rules

**La regla del indicador honesto.** Si algo dice que está guardado, tiene que salir de comparar
con el servidor. «Respuesta guardada» como texto fijo ya costó respuestas perdidas. Y una
pregunta en blanco no está guardada: está **sin responder**, que es otra cosa.

**La regla de la plataforma primero.** Antes de traer una librería de componentes, se mira si
el HTML ya lo resuelve. El aviso de postular usa `<dialog>`, el recorrido plegable usa
`<details>` y el formulario apagado de la decisión es un `<fieldset disabled>`: foco atrapado,
tecla de escape y teclado vienen gratis.

## Do's and Don'ts

### Do:

- **Do** reservar el índigo `#4338ca` para «te toca a ti»: el panel de la acción pendiente, el
  hito abierto y el botón que lo empieza.
- **Do** codificar cada estado en la forma —relleno, contorno grueso, contorno fino,
  discontinuo, tachado— antes que en el color.
- **Do** traer los botones con `composes` desde `piezas.module.css`, dejando en la hoja local
  solo lo que depende de dónde está el botón: márgenes, `align-self`, anchos.
- **Do** dar 44 px de alto mínimo a todo lo que se pueda tocar, y 48 px con 16 px de letra a
  los campos de texto.
- **Do** cortar la prosa en 62ch, y en 56ch dentro de un bloque de apoyo.
- **Do** decir en voz alta lo que el sistema todavía no puede hacer. Si una evidencia no se
  puede enviar, el formulario va apagado y se explica; no se finge.
- **Do** usar `tabular-nums` en fechas, cuentas y plazos.

### Don't:

- **Don't** escribir un solo `border-radius`. En ninguna parte.
- **Don't** poner el acento en enlaces, titulares, iconos, etiquetas de estado o botones
  secundarios. El subrayado ya identifica un enlace.
- **Don't** usar verde, ámbar o rojo para jerarquía o categoría: ya significan hecho, duda y
  error.
- **Don't** añadir una sombra que no sea respuesta a un estado, ni anidar bloques con contorno.
- **Don't** crear un nivel de jerarquía con un recuadro cuando el tamaño de letra ya lo crea.
- **Don't** añadir un segundo momento con movimiento, ni ningún movimiento dentro del examen.
- **Don't** volver a introducir el tema oscuro. Es petición expresa del cliente.
- **Don't** partir una frase con elementos dentro para enfatizar un número.

---

## Resuelto por `critique` (24/08/2026)

**El antetítulo en versalitas: se van cinco de siete.**

Se quitan `SIMULACIÓN DE TRABAJO` (dos pantallas), `PRIVACIDAD Y CONTROL`, `VALIDACIÓN
PRÁCTICA · EN CURSO` y `TU PERIODO`. Los cuatro son redundantes contra titulares que ya se
sostienen solos —«Elige tu fecha.», «Tus datos, tus decisiones.», «Estás trabajando con
nosotros.»— y es exactamente el caso que el suelo de calidad veta: *the heading carries its own
weight*.

**Se quedan dos, y no por excepción sino porque no son antetítulos:**

- `DECISIÓN · TE PEDIMOS UNA COSA MÁS` sitúa el momento del proceso. Sin él, «Queremos resolver
  una duda antes de decidir» se puede leer como un rechazo, que es justo lo contrario de lo que
  es.
- `CAMBIO EN EL ENCARGO` es el título propio de un bloque dentro de la prueba, no una etiqueta
  encima de un titular.

El rol *Label* de la rampa se mantiene documentado porque esos dos lo usan.
