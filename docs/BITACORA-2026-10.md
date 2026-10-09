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

## Los logros clave en la cabecera del perfil (09/10/2026)

La clienta quería que el perfil enseñara tres resultados concretos por los que contratar a la
persona. La cabecera decía quién es, pero nada de lo que ha conseguido, y «En pocas palabras» casi
nunca trae cifras. Nace un dato nuevo, **«Logros clave»**: hasta tres frases de hasta 100
caracteres que escribe el propio candidato.

- **Dónde se escriben**: «Acerca de ti» → «Editar lo tuyo», en el bloque «Tus logros clave»,
  debajo de «En pocas palabras»: tres cajas numeradas y opcionales.
- **Dónde se ven**: en la cabecera, entre las reseñas y los enlaces, cortados a dos líneas; y en
  «Acerca de ti», entre «En pocas palabras» y «Lo que sabes hacer», enteros. Es la misma pieza en
  los dos sitios (`paginas/perfil/Logros.tsx`), para que se lean como un solo dato. Sin logros no
  sale nada. Ver [02-QUE-VE-EL-CANDIDATO](02-QUE-VE-EL-CANDIDATO.md), 2.16.
- **`Campo` gana `maximo` y `etiquetaOculta`.** El tope y el contador que solo tenía `AreaTexto`
  —ahora los dos avisan con la misma cuenta—, y una etiqueta que existe para el lector de pantalla
  sin dibujarse, para las cajas en las que el número de delante ya dice qué son.
- **Backend** (`V71`): el guardado de «Acerca de ti» trata los logros distinto al resto —sin el
  campo no los toca, con la lista vacía los borra— para que la app de Android ya instalada no los
  borre en cada guardado. La lectura del CV no los toca. El detalle, en
  `APIS-PERFIL-DEL-CANDIDATO.md` del backend.

**Quedaron fuera**, anotados en [PENDIENTES](PENDIENTES.md): el lateral que tapa «Acerca de ti» a
900 px o menos, la vista que queda lejos de la sección tras guardar y el medidor «Tu perfil N %»,
que no cuenta los logros. Y en los defectos conocidos del backend, el 5: un tipo equivocado en el
cuerpo del guardado responde 500 en vez de 400.

**Cómo se comprueba:** `56-logros-clave` y `56-logros-clave-qa` en escritorio, y sus `-movil` a
375 px, sobre el clon de QA (crean sus cuentas y las borran al terminar); y las unitarias de
`Cabecera.test.tsx`, `Perfil.test.tsx` y `Campo.test.tsx`.

---

## La prueba al instante, la campana en cada etapa y los recordatorios (07/10/2026)

Muchos candidatos se perdían entre una etapa y la siguiente: entregaban el banco, leían «Te
avisaremos cuando avance», cerraban la página y no volvían. Y el pase automático nunca miró la
nota, así que esa espera no filtraba a nadie.

- **Portal.** Al entregar la evaluación o al postular, el portal vuelve a pedir la postulación y,
  si una vacante con pase automático ya le abrió la prueba, lo lleva a su portada con «Tu prueba
  del puesto ya está disponible»; si no, «Evaluación entregada. Te avisaremos por correo y en la
  campana cuando te toque la prueba.». Se pregunta en vez de suponer porque la respuesta de
  entregar no dice si hubo pase (`laPruebaAlInstante.ts`). La campana se vuelve a pedir al
  abrirla y tras entregar, postular o retirarse. Ver
  [02-QUE-VE-EL-CANDIDATO](02-QUE-VE-EL-CANDIDATO.md), 2.5, 2.6 y 2.8.
- **Panel.** La nota del Perfil Integral que la IA sigue calculando se lee «en camino», en la
  celda y en la ficha. Ver [PANEL](PANEL.md) › La nota del perfil «en camino».
- **Backend, sin pantalla aquí**: cada cambio de etapa que manda correo deja aviso en la campana;
  recordatorios del banco sin entregar y de la prueba sin empezar; y el plazo del correo de la
  prueba dice el tiempo y la fecha límite. Cómo funciona, en `03-ESTADOS-POSTULACION.md` del
  backend.

**Quedaron fuera**, anotados en [PENDIENTES](PENDIENTES.md): comprobar en producción que el correo
llega y qué dice el texto activo, «Prueba incompleta» a quien sigue en plazo (#49), el
desplegable de la campana a 375 px, «Respondiste las 1 preguntas» y el bot de WhatsApp.

**Cómo se comprueba:** `54-la-prueba-al-instante` y `55-la-prueba-al-instante-qa` sobre el clon
(escriben y lo retiran, marca `QA-PE-0067`; la IA apagada), y las unitarias de
`PostularAlInstante.test.tsx`, `Evaluacion.test.tsx`, `ranking.test.ts` y `Vacante.test.tsx`.
La llegada del correo la comprueba el usuario en producción.

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
