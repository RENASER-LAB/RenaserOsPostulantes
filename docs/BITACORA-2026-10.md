# Bitácora · octubre 2026

Lo que se hizo cada día, en orden inverso. Es historial: **para saber cómo funciona algo hoy,
mira el documento temático que corresponda** (empieza por [README.md](README.md)); esto explica
por qué llegó a ser así y qué se probó por el camino.

Sigue en [BITACORA-2026-09.md](BITACORA-2026-09.md).

**Al 06/10/2026, el titular del mes:** `/vacantes` cambió de forma dos veces en dos días, y las
dos salieron de un prototipo con las opciones lado a lado en el navegador, no de una descripción.
Desde el 05/10 el diseño se trabaja con las skills de Emil Kowalski (`emil-design-eng`,
`prototype`); `impeccable` se dejó de usar a petición. Cómo es hoy la pantalla, en
[DESIGN.md](../DESIGN.md) › La búsqueda de vacantes.

---

## `/vacantes`: la columna de filtros y un ancho propio (06/10/2026)

Con la skill `prototype` se montó la **pantalla entera** en cuatro disposiciones, en una página
aparte con un selector abajo —sin tocar la de verdad— y los datos de ejemplo de siempre:

- **Actual**, la de producción, como referencia.
- **Protagonista**: una franja de cielo con «Encuentra tu próximo trabajo», un buscador de dos
  campos (qué y dónde) y la modalidad en pastillas que se pulsan.
- **Lateral**: los filtros siempre a la vista en una columna a la izquierda.
- **Aplicación**: una sola barra de herramientas y dos paneles de alto fijo, como un correo,
  con la lista recorrida con ↑ ↓.

**Ganó «Lateral»**, con dos correcciones del usuario sobre el prototipo:

- **«Quita la barra de scroll»**. La columna era pegajosa y con desplazamiento propio. Se miró
  cómo lo resuelven Computrabajo e Indeed: la columna **baja con la página**, cada grupo se
  pliega desde su título y los largos enseñan cinco opciones y «Ver N más». Las marcadas se ven
  siempre, aunque estén más abajo.
- **«Usa más el espacio horizontal»**. La pantalla pasó a **96rem**, y la columna de filtros
  de 15 a 17rem y la lista de 24 a 28rem. La pregunta fue si ensanchar todo el portal o solo
  esta pantalla: **solo esta**, con la cabecera y el pie ensanchándose con ella para que nada se
  descuadre, y **la píldora estirándose en 250 ms** al entrar (medido: de 1280 a 1536 px a 1920
  de ventana). Sin la transición saltaba 128 px por lado.

Lo que cambió al pasarla a producción:

- **Cuatro disposiciones en vez de tres**: la columna desde 1024 px, el panel desde 1280
  —antes desde 1024, pero con la columna al lado no cabía—, la barra con «Filtros» de 641 a
  1023, y el teléfono como estaba.
- **La banda de búsqueda va en una fila** desde 1024 px: el titular a 24 px a la izquierda y el
  buscador ocupando el resto.

### Lo que apareció al probarla

- ⚠️ **La lista bajaba 38–64 px al borrar la búsqueda.** Dos causas. La columna de filtros
  cruza la fila del contador y la de la lista, y con una lista corta repartía lo que le sobraba
  también en la del contador: `grid-rows-[auto_1fr]` hace que lo absorba entera la de la lista.
  Y el contador con texto («2 de 9 vacantes para «ingeniero»») y el orden no cabían juntos en
  28rem: con el panel, esa fila cruza también su columna. En local no se veía; lo cazó el AC-16.
- ⚠️ **La pastilla del recuento se colaba en el nombre de la casilla**: «Presencial (4)4». El
  número de la pastilla lo pinta ahora el CSS (`content: attr(data-cantidad)`) y el nombre sigue
  siendo «Presencial (4)», que es lo que leen las pruebas y el lector de pantalla.

### Decisiones que aprobó el usuario

1. La disposición «Lateral», sin barra de desplazamiento en los filtros.
2. Ensanchar solo `/vacantes`, con la transición de la cabecera.

### Cómo se comprueba

- 82 unitarias de `src/paginas/vacantes` y `src/app`, con una nueva para el tramo de 1024 a 1279.
- E2E sobre el clon de QA (`renaser-sintetico-20260917.dump`, con el paso 3b): **80 de 80** en
  `37-buscar-vacantes` y los del portal que la rozan —`07-movil`, `12-postular`, `14-vacante`,
  `23-movimiento`, `23-remuneracion`, `41-logotipo`—. El 37 se reescribió para la columna: el
  ayudante `grupo()` ya no abre «Filtros» si los grupos están a la vista, y la prueba del
  teclado de «Filtros» corre a 900 px, que es donde existe.
- A mano, a 1920, 1366, 1100, 800 y 390: sin desborde, la columna sin barra propia, y la
  primera tarjeta y el panel a la misma altura.

---

## La tarjeta «Expresiva» (06/10/2026)

El usuario pidió una comparación «antes y después con propuestas». La skill `prototype` armó la
**tarjeta** en cuatro versiones sobre la lista y el panel reales: **Actual**, **Densa** (filas
en una sola superficie, el doble a la vista), **Estructurada** (cada dato en su casilla
rotulada y el sueldo en su franja) y **Expresiva** (avatar con el color de la empresa, la
modalidad en pastilla de color, el sueldo publicado en verde, «Nueva», sin borde).

**Ganó «Expresiva»**, con dos correcciones:

- **«Al seleccionar, la tarjeta se enmarca con una luz morada»**: el contorno índigo con halo
  se leyó como neón. La elegida pasó a una sombra gris más honda y el título en índigo, **sin
  levantarse**: subirla 2 px la descuadraba del panel.
- **«Que estén al mismo nivel la tarjeta y el panel»**: el contador bajaba la lista. Pasó a su
  propia fila, y el panel empieza en la de la lista. El panel y la banda, además, sin borde y
  con la sombra de las tarjetas.

Al pasarla, **la fecha se fue a su propia línea** —detrás de «RENASER CONSULTING S.A.C.» se
partía en «hace 4 / semanas»— y se mantuvo «Publicada hace…», que es lo que comprueba el AC-14.
**El horario salió de la tarjeta**, como en el prototipo; sigue en el panel y en la ficha.
«Nueva» la decide `esNueva`, en días de Lima como `publicadaHace`, con su prueba.

⚠️ **El verde de la tarjeta no es «confirmado».** En el resto del portal `--bien` es lo que salió
bien; aquí pinta el sueldo publicado y «Remoto». Se aceptó con el prototipo delante; está escrito
en DESIGN.md.

---

## El pulido del movimiento, y «Filtros» vuelve en negro (05/10/2026)

Primera pasada con `emil-design-eng` sobre `/vacantes`. Las curvas del tema de Tailwind pasan a
las de Emil Kowalski (`ease-out` fuerte para lo que entra, `ease-in-out` para lo que se mueve),
el `Button` se hunde un 3 % al pulsar, los desplegables abren en 150 ms y cierran en 100, la
equis del buscador y las etiquetas entran desde el 90–95 % de su tamaño, y «Ordenar por» pasa de
dos botones con la elegida en índigo a **un carril gris con una pastilla blanca que se desliza**.

**«No sé qué cambió»**: los detalles eran demasiado finos para verse. Se añadió lo visible: la
lista entra en cascada al cargar —solo si se vio el esqueleto—, el panel tiene **una barra con
el título y «Postular» que se queda arriba** al bajar por una vacante larga, y el tinte de la
elegida se deslizaba de una tarjeta a otra. Este último se quitó al día siguiente con
«Expresiva»: la elegida ya no tiene tinte que mover.

**«Filtros» volvió, en negro**, a petición: el botón único que abre todos los grupos se había ido
con el «deshazlo todo» de ese mismo día, y se recuperó de la copia con sus pruebas. El negro de
`--accion-fuerte` era solo de «Iniciar sesión»; desde aquí también es de este botón. Desde el
06/10 solo existe de 641 a 1023 px: por encima, los filtros están en su columna.
