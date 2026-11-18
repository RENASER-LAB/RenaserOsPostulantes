# Bitácora · noviembre 2026

Lo que se hizo cada día, en orden inverso. Es historial: **para saber cómo funciona algo hoy,
mira el documento temático que corresponda** (empieza por [README.md](README.md)); esto explica
por qué llegó a ser así y qué se probó por el camino.

Sigue en [BITACORA-2026-10.md](BITACORA-2026-10.md).

**Al 13/11/2026, el titular del mes:** el portal del candidato cambió de mundo visual —de «El
cielo despejado» a «Northstar»— y el panel del equipo se quedó en el anterior. Cómo es hoy, en
[DESIGN.md](../DESIGN.md).

---

## 18/11/2026 · Las pruebas sin completar, dentro del ranking, y «Darle más tiempo»

- **Qué llegó.** En «Prueba del puesto» cada fila dice en qué va su prueba —la nota, «Pendiente de
  calificación», «No la completó», «En curso» o «Sin empezar»— y «Prueba incompleta» desaparece:
  se le decía también a quien seguía en plazo (#49). Quien no la completó vuelve a la tabla y al
  Excel, solo en «Toda la tanda», con un filtro «Prueba» y «· N no la completaron» en la línea de
  cifras; la lista «No completaron la prueba» se retiró. «Avanzar» no lo mueve. Desde su ficha se le
  da más tiempo con fecha, motivo y aviso. Es la V89 del backend. Cómo funciona hoy, en
  [PANEL.md](PANEL.md) › Las pruebas sin completar, en la tabla, y «Darle más tiempo», y en
  [02-QUE-VE-EL-CANDIDATO](02-QUE-VE-EL-CANDIDATO.md), 2.9.
- **Decisión del usuario tras la QA.** La pantalla previa a «Empezar» prometía «30 min desde que
  pulses Empezar» a quien tenía la fecha puesta a mano, y al empezar el reloj llegaba hasta esa
  fecha. Ahora le dice «Hasta la fecha límite» (hora de Lima) con «El plazo de esta persona»,
  también si se puso después de darle más tiempo; en los demás casos, y para quien recibió más
  tiempo sin haberla abierto, sigue «N min · desde que pulses Empezar · o hasta la fecha límite,
  si llega antes». Lo decide el backend en `fechaConcedidaAMano`.
- **Una trampa en el teléfono.** La ventana «Darle más tiempo», montada dentro de la ficha de la
  fila, quedaba bajo la barra del panel, que le tapaba el título y la «×»: tocar la «×» pulsaba
  «Salir». Se pinta ahora al final de `<body>` con la prop nueva `enElCuerpo` de `Modal`.
- **Fuera de la entrega**: el bot de WhatsApp del CRM tiene que aceptar el aviso nuevo y Meta
  aprobar su plantilla (ver [PENDIENTES.md](PENDIENTES.md)).

---

## 18/11/2026 · El brochure de la empresa, armado solo

- **Qué llegó.** La misión y la visión en «Perfil de la empresa», en su vista previa y en el perfil
  público; la pestaña «Brochure» del módulo, con tres plantillas, seis colores y «Descargar brochure
  (PDF)»; y el mismo botón, sin cuenta, en el perfil público `/empresas/<código>`. El PDF lo arma el
  backend con lo guardado y no lo guarda en ningún sitio: es la V86, con cuatro columnas en
  `organizacion` y sin permiso nuevo. Cómo funciona hoy, en [PANEL.md](PANEL.md) y en
  [02-QUE-VE-EL-CANDIDATO](02-QUE-VE-EL-CANDIDATO.md), 2.2b.
- **Decisión del usuario tras la QA, que cambia la spec.** La spec ponía el brochure como cuarta
  sección del formulario, con la plantilla y el color guardados por el «Guardar» de siempre. Quedó
  en dos pestañas, «Perfil» y «Brochure» (`?pestana=brochure`), sin la palabra «opcional», y la
  plantilla y el color **se guardan solos al elegirlos** con una ruta propia
  (`PUT …/presentacion/brochure`); si falla, vuelve la elección anterior.
- **Una trampa al descargar.** Abrir el PDF desde un `blob:` daba un nombre aleatorio al guardarlo
  y, al soltar la dirección, el visor ya no dejaba guardarlo ni volver tras pulsar un enlace. El
  botón pide el PDF al panel —permiso y «Quiénes somos»— y luego lleva la pestaña a la dirección
  pública del brochure, que el backend sirve del recuerdo con su nombre.
- **De paso**, a 390 px con barra de desplazamiento clásica «Añadir» de los beneficios se salía 9 px:
  el campo ahora encoge (`min-width: 0`) y un beneficio largo se parte.
- **Fuera de la entrega**, anotado en PANEL.md: el anillo de foco recortado de `Pestanas`, el 404 de
  `/favicon.ico` en la pestaña del PDF, y sin comprobar la app de Android y el diálogo de impresión.
  En el backend, un cuerpo que no es JSON en los dos PUT del módulo da 500 (su defecto conocido 5).

---

## 17/11/2026 · El visor de informes, por nota combinada; el celular y los entregables

- **Qué llegó al panel.** El visor de informes pone arriba a quien tiene las tres notas, por la
  nota combinada, y debajo al resto en el orden del ranking: «N postulantes, ordenados por nota
  combinada» y «Puesto N de M». La cabecera enseña el celular con «☎» y «WhatsApp», y en el
  informe de la prueba los entregables se abren desde su nombre con «Descargar entregables». Cómo
  funciona hoy, en [PANEL.md](PANEL.md) › Los informes por etapa.
- **En el backend, sin migración**, la IA recibe la fecha de hoy en cada llamada, el recorte del
  CV deja ver los años de experiencia y un comando de una vez recalifica a los afectados que
  siguen en curso. Todo eso, en `docs/` del backend: `CALIFICACION-CON-IA.md`.
- **Decisiones del 16/11:** sin columna nueva para la nota combinada; el orden es el mismo para
  todos, vea o no cada nota; el celular nunca va en un PDF ni sale de quien pidió borrar sus datos.
- **Una trampa al abrir el archivo**: la pestaña nueva se pide antes de esperar al backend; si se
  pide después, el navegador ya no la cuenta como parte del clic y la bloquea.

---

## 16/11/2026 · El perfil de la empresa, a la vista del candidato

- **Qué llegó.** El módulo «Perfil de la empresa» del panel, con vista previa; el bloque «Sobre
  {empresa}» y el video en la ficha de la vacante; el perfil público `/empresas/<código>`; y el
  «Video del puesto» en el formulario de la vacante. Cómo funciona hoy, en
  [PANEL.md](PANEL.md) y en [02-QUE-VE-EL-CANDIDATO](02-QUE-VE-EL-CANDIDATO.md). En el backend es
  la V85: su spec reservaba la V81, pero la V84 ya estaba aplicada en producción y Flyway no
  aplica migraciones fuera de orden.
- **Decisiones del 16/11, ya dentro de la spec:** el módulo va
  en el menú y no en Configuración; el bloque «Sobre…» va después de los requisitos; en PC el
  video sube a la tarjeta lateral fija, encima de «Remuneración»; cada vacante puede tener su
  video; hay perfil público; y lo editan Talento, Dirección y Administrador.
- **De paso**, la ficha de la vacante deja la etiqueta «Vacante / Ficha del puesto» (DESIGN.md ya
  lo dice).
- **Dos trampas que salieron al probar.** El reproductor de Vimeo cargaba y se quedaba en negro en
  00:00: le faltaba `encrypted-media` en `allow`. Y el botón «Vista previa» salía también desde
  1280 px, junto a la vista previa ya visible: su `display: none` perdía contra `.secundario`, y
  se resolvió con la variante `.secundarioSinLateral` en `piezas.module.css` (ver
  [REGLAS-DEL-CODIGO](REGLAS-DEL-CODIGO.md)).

## El portal adopta el estilo de Northstar (13/11/2026)

Rama `feat/estilo-northstar`. El usuario pidió una **réplica exacta del estilo** de
northstar-template-demo.vercel.app —tipografía, espaciado, resaltados, botones, radios, filetes,
fondo, cabecera, animaciones— **sin su contenido ni su marca**, ignorando la paleta y las reglas
de estilo del mundo anterior. Se hizo en tres tandas.

### 1 · La portada, la cabecera, el pie y los tokens

- **Cómo se midió.** Con Playwright sobre la página real, a 1440 y 390: estilos computados de
  cada elemento visible, las `@font-face`, los `@keyframes` y transiciones de su hoja, y las
  transformaciones de su portada muestreadas cada 100 px de scroll. De ahí salen los valores
  que están en DESIGN.md: el titular en Onest 400 a `clamp(36px, 6.1vw, 88px)` con -0,055em,
  la etiqueta de 11 px y 0,16em, la barra de 69 px, los botones de 14 px en mayúsculas, la
  ventana de 64rem × 38rem y radio 28, y el «container scroll» (1,08 → 1 y 96 → -180 px al 41 %
  de una sección de 170 vh; el titular -48 px y fundido al 32 %).
- **Fuentes.** Onest y Syne son de Google Fonts (OFL): se bajaron los woff2 latin y latin-ext
  y se sirven desde `public/tipografia/`. No se copió ningún archivo de su sitio.
- **El pie** replica la noche de la referencia con un saludo que cambia de idioma (Hola,
  Allillanchu, Kamisaraki, Olá, Hello) y la llamada «VER VACANTES ———».

### 2 · El fondo y la ventana

- **El fondo era una aproximación en canvas 2D y pasó a ser el sombreador de verdad.** Se sacó
  su código interceptando `shaderSource` y los uniformes con los que se llama: el «Dithering»
  de Paper Shaders (simplex, Bayer 4×4, 4 px, escala 1,2, `#527ADA`, velocidad 0,5), un lienzo
  un 10 % más grande, y —lo que no se veía a ojo— **una máscara CSS de rayas de 1,92 px cada
  14,4 px**, que es lo que hace columnas del tramado. Portado a WebGL2 sin la librería, con
  respaldo en 2D, pausa fuera de pantalla y 30 cuadros en teléfonos. En zoom ×2 no se
  distingue del original.
- **Un fallo que costó un rato:** el fondo salía vacío. La limpieza del efecto llamaba a
  `loseContext()`, StrictMode remonta, y el lienzo recibía su contexto ya perdido. Quitado, con
  una nota en el código.
- **La ventana** no convencía al usuario («vacía y poco creíble»: una tarjeta suelta sobre
  puntos). Se rehízo siguiendo la vista «Agents» del original: métricas arriba, un grafo de
  nodos unidos por líneas en codo —la postulación avanzando por sus cinco etapas, con su
  estado— y la actividad a la derecha. Las cinco etapas siguen siendo la lista accesible.

### 3 · Las dieciocho pantallas, el panel aparte y la documentación

- **El panel se había repintado.** `mundo.css` y `piezas.module.css` son globales, y las capturas
  del panel contra `main` daban entre un 9 % y un 29 % de píxeles distintos (botones en
  mayúsculas, la acción en azul, otra letra). Se resolvió **al revés de como se había hecho**:
  la base de cada archivo compartido volvió a ser exactamente la de `main`, y todo lo Northstar
  pasó a un bloque bajo `html:not(.mundo-panel)`. `usarMundoDelPanel()` pone la clase en
  `<html>` mientras el panel está montado (`ArmazonPanel`, `InvitacionPanel`, y el aviso de error
  cuando lo roto es una pantalla del panel). Resultado: **0,000 % de diferencia** contra `main`
  en la lista de vacantes, una vacante con su ranking y simulación, a 1280 y a 390.
  Configuración y la ficha de un postulante caen en el aviso de error con los datos de prueba
  de hoy (en `main` también) y ese aviso coincide.
- **Dos trampas al comparar.** El puerto 5176 que se eligió para servir `main` lo tenía otra
  sesión, y las primeras capturas «de main» eran de otra rama (crema y naranja). Y Vite deja en
  caché las clases que una hoja trae con `composes` desde otra: tras cambiar `piezas.module.css`,
  la ficha seguía enseñando los botones viejos hasta reiniciar el servidor.
- **Las pantallas del candidato.** Además de lo que heredan de los tokens:
  - una pasada sobre sus hojas (`src/paginas/**`): ningún peso por encima de 550, y las
    etiquetas en mayúsculas con 0,16em;
  - la etiqueta «Sección / Lo que es» encima del titular en quince pantallas, con
    `data-seccion` y pintada como pseudoelemento (no se lee dos veces);
  - campos con el halo azul al enfocar; estados (vacío, error, acceso necesario) como celdas de
    filete con esqueleto que barre; el modal entra desde el 96 %; la campana sin fondo y con el
    número en azul; los mandos de la evaluación en mayúsculas; las tarjetas de `/vacantes` con
    el filete como anillo y la elegida con halo.
- **Lo que no se copió a propósito:** el borde de los campos de la referencia (1,5:1) se quedó en
  el gris de control (3,9:1), y su etiqueta al 42 % solo en la portada.
- **Verificado** con los guiones de `herramientas/capturar-*.mjs` a 1440 y 390, más una red de
  seguridad que contesta cualquier petición no interceptada: **ninguna llegó a un backend**.
  Typecheck limpio y 2185 pruebas en verde.
- **Documentación.** DESIGN.md reescrito para Northstar; `.impeccable/design.json` rehecho a
  mano a juego (no se pudo correr `/impeccable document` desde la sesión);
  [EL-MUNDO-VISUAL](MAPA-DEL-CODIGO.md) y los avisos de `CLAUDE.md` puestos al día.

## 13–14/11/2026 · Fuera el ámbar

- **Portal (13/11).** `--duda` y su familia pasan al azul marino de Northstar (`#1E3A8A`, bruma
  `#E9EDFF`, punto `#527ADA`) bajo `:root:not(.mundo-panel)`. Era la única mancha cálida y se
  leía como advertencia; el primer sitio que lo hizo notar fue la pretensión del perfil.
- **Panel (14/11).** La base de `--duda` en `mundo.css` pasa al índigo del panel (`#4338CA`,
  bruma `#EEF0FF`, tinta `#312E81`, punto `#818CF8`). Ya no queda ámbar en ninguna parte; el
  estado «en duda» se distingue por la forma (bruma, punto, etiqueta).

## 14/11/2026 · El panel, también Northstar

- **Cómo.** Se borró `src/panel/mundoDelPanel.ts` y sus tres llamadas (`ArmazonPanel`,
  `InvitacionPanel`, `Salvavidas`): sin la clase `mundo-panel` en `<html>`, todo lo escrito bajo
  `html:not(.mundo-panel)` llega al panel. Los selectores se dejaron —casan siempre— para no mover
  la especificidad.
- **El armazón.** Barra y lateral en papel con filete negro al 10 %, fuera el filete de color de
  arriba, «/ SELECCIÓN» como etiqueta de sección y la entrada activa en azul bruma con filete azul.
- **Los botones propios del panel** (`.chico`, `.confirmar`, `.descartar`, `.peligro`, `.borrar`,
  `.fantasma`) pasan a MAYÚSCULAS con un bloque al final de cada hoja; «Columnas» igual, y la tuerca
  de ajustes de la vacante deja el glifo ⚙ por `IconoFiltros`.
- **Para probarlo** se dio correo y contraseña de prueba al usuario de Talento de la base clonada
  de QA (no a producción).
- **QA visual (14/11).** Sin índigo, ámbar ni Geist computados en ninguna pantalla del panel, sin
  scroll horizontal a 375 y el portal intacto. Se corrigió lo que trajo el cambio: el botón «Menú»
  del teléfono, los campos propios de Colaboradores y del banco de preguntas (radio 4, 16 px, 44
  de alto) y los grupos de pestañas —ranking, cortes, reseñas reportadas, roles—, que ahora son
  una sola silueta: filete al 10 % y la elegida en azul bruma. De paso, la celda de acciones de
  `/admin` dejó de ser `flex` (su filete se descolgaba y en el teléfono abría un hueco por fila).
- **Arreglados también, ya existían:** el foco de los campos (portal y panel) pasa a filete azul
  de 2 px con halo azul al 22 % —el bruma solo daba 1,1:1 sobre el papel—; el selector de archivo
  del banco de preguntas va dentro de un botón «Elegir Excel» con el nombre al lado, en vez del
  «Choose File» nativo; y la flecha de lista que tapaba el final de `datos_ocultos_cv` era el
  fondo de `.entrada` de Configuración, pensado para `<select>` y puesto también en los campos de
  texto: ahora solo va en `select.entrada`.
- **«No se puede abrir una prueba» no era del portal.** `/admin/pruebas` llama a
  `GET /api/v1/panel/pruebas`, que llegó al backend en su #136; el backend local iba un commit
  atrás y respondía 500 (`NoResourceFoundException`). Con el backend en `origin/main` la lista
  carga, y una prueba del puesto en borrador se abre y se lee entera. Ojo: el índice solo enseña
  vacantes que usan el editor (`PRUEBA_PROPIA` en la etapa técnica, o preguntas propias en el
  Perfil Integral); con las vacantes de antes, lo correcto es la lista vacía.

## 14/11/2026 · La documentación de diseño, en un solo sitio

- **`EL-MUNDO-VISUAL.md` repetía DESIGN.md** —reglas de forma, tipografía, el panel, el color de
  duda— y por eso se contradecían: se cambiaba uno y el otro se quedaba viejo. Lo visual que solo
  estaba allí pasó a DESIGN.md (lo que no se copió de la referencia, la excepción verde de
  WhatsApp, el punto de «Qué buscar en el CV») y se recuperó la sección del logotipo, que se perdió
  al reescribir DESIGN.md el 13/11 y a la que el mapa seguía enlazando.
- **Lo que no es diseño** —el mapa de `src/`, `impeccable` en este proyecto, las dependencias—
  queda en [MAPA-DEL-CODIGO.md](MAPA-DEL-CODIGO.md), el mismo archivo con otro nombre. Los enlaces
  de los demás documentos se movieron a DESIGN.md o al mapa según de qué hablaban.
- `README.md` deja una línea y el enlace en vez de describir el estilo, y en `PENDIENTES.md`
  salen las dos filas de «DESIGN.md no describe todavía…» (`--duda-punto` y el verde de
  WhatsApp), que ya están.
- De paso, incoherencias que quedaron al pasar el panel: el `--duda` del panel dicho índigo, el
  punto de CV en `#818CF8`, la base de las piezas dicha «del panel», el halo del foco, `--canto`
  sin consumidor y el encabezado de `mundo.css`, que aún presentaba «El escaparate».

## 17/11/2026 · La documentación, contrastada con el código

- **El backend de producción es `34-196-100-108.nip.io`** desde el 08/09/2026 (`0dfce4a`, la
  cuenta de AWS nueva), pero `CLAUDE.md`, `README.md` y `TRABAJAR-EN-LOCAL.md` seguían dando
  `18-204-177-210.nip.io`, que ya no responde. El aviso de «apuntando ahí escribes en
  producción» señalaba una máquina muerta. Manda `vercel.json`. El backend tenía lo mismo en
  cinco scripts y en `despliegue/RECUPERAR-CUENTA.md`, y se corrigió en su repositorio.
- **El proxy de Vite caía al 8080 sin `API_URL`**, que es donde vive Adminer: el error que los
  documentos avisaban de no cometer era el valor por defecto. Ahora cae al 8081.
- **Lo que decían los documentos y el código ya no hacía:** el tanteo de ids de
  `listarVersionesPrueba` (la ruta de versiones existe desde el 31/08), «no hay endpoint de mis
  permisos» (`GET /panel/sesion` los trae), «el panel no enseña quiénes se inscribieron», «una
  vacante publicada no se puede borrar», el nombre del candidato perdido en otro navegador,
  `react-hook-form` «en uso», radix y Tailwind «no se instalaron», las dos excepciones de
  `impeccable`, `.arrastrando`, la decisión ámbar «sin formulario» y «Perfil de la empresa»
  ausente del menú. `PENDIENTES.md` pierde las dos filas ya resueltas.
- **Quedan dudosos, sin tocar:** si las «dieciocho pantallas» del candidato siguen siendo
  dieciocho con el perfil público de la empresa, y si la entrada del portal debe pintar el 429
  con `segundosDeEspera` como ya hace la del panel.

## 18/11/2026 · El 429 en la entrada del portal, y las pantallas sin número

- **La entrada del portal no decía cuánto esperar.** Tras cinco intentos fallidos el backend
  responde 429 con `segundosDeEspera`; el panel lo convertía en «Vuelve a probar en N minutos»
  y el portal pintaba el texto genérico del backend. Los dos usan ahora
  `src/api/demasiadosIntentos.ts`.
- **«Las dieciocho pantallas» del candidato dejó de ser una cifra** en `CLAUDE.md`: con el perfil
  público de la empresa son 21 rutas, y una cuenta que hay que mantener a mano se queda vieja.
  Dice «todas», con el enlace a las rutas.
