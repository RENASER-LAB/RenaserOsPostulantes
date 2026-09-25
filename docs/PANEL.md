# El panel del equipo (`/admin`)

Qué es, cómo se entra, qué enseña cada pestaña, qué exige el backend antes de publicar una
vacante y cómo se corrige después. El recorrido de los dos lados —equipo y candidato— está en
[06-FLUJO-COMPLETO.md](06-FLUJO-COMPLETO.md).

---

## Qué es esto

La cara que ve **quien postula** a una vacante de Renaser: elegir oportunidad, postular,
responder la evaluación, hacer la prueba del puesto, elegir fecha de simulación y seguir el
estado de su proceso.

**Y desde el 25/08, también el panel del equipo — aquí mismo y a sabiendas de que es
provisional.** El plan sigue siendo que viva integrado en RENASER OS (`~/Documentos/RenaserOs`),
pero mientras un agente de backend trabaja en que otras empresas puedan crear sus propias
vacantes (modelo Indeed), el panel se construye en este repositorio, bajo `/admin`:

- **Se entra como usuario del equipo**, no como candidato. El backend tiene
  `POST /api/v1/panel/auth/dev-login` hecho justo para esto: emite un token de equipo sin
  RENASER OS, se apaga en producción con `app.seguridad.dev-login-activo=false`, y el primer
  id que entra se crea solo con los tres roles. En la base local ya existen `andy-dev` y un
  UUID; el id es **texto**, no número.
- **La base del panel es `/api/v1/panel`**, con token propio (`renaser_panel_token`), aparte
  del token del candidato. Un 401 del panel no puede cerrar la sesión del portal ni al revés.
- Tres pestañas: **Vacantes** (el CRUD, y dentro de cada una el embudo, el ranking con las
  notas de la IA, la ficha de cada postulante y avanzar de etapa), **Simulación** (crear y
  gestionar las sesiones presenciales) y **Configuración** (parámetros, banco de preguntas por
  Excel, usuarios y roles, áreas).
- ⚠️ **Huecos del backend, comprobados el 27/08**: `GET /panel/bandeja` devuelve 500; y **no hay
  forma de listar las versiones de una plantilla de prueba**, solo de pedir una suelta por su
  id. Se enseña lo que existe, como hizo el portal con la decisión ámbar.
  (Lo de `POST /vacantes/{id}/cierre-prueba` en inglés se cerró: hoy contesta en castellano
  que esa vacante no rinde una prueba del puesto, y el panel ni ofrece el control ahí — ver
  «El plazo de la prueba se ve antes de cambiarlo».)
  (El hueco de «quiénes se inscribieron» se cerró: ver «Los inscritos de una sesión, y quién puede qué» en la [bitácora de agosto](BITACORA-2026-08.md).)

### El ranking es por etapas (25/08)

Cinco pestañas sobre la misma tabla: las cuatro etapas que puntúan y Decisión. La tabla
sigue siendo la mesa de decidir —casillas, motivo, avance en lote—; lo que cambia con la
pestaña es **de qué etapa es la nota** (`GET /vacantes/{id}/ranking?etapa=…`, hecho a
juego en el backend) y **qué enseña la ficha** al abrir una fila:

| Pestaña | La ficha muestra |
|---|---|
| Perfil integral y Decisión | **Dos tablas**: el CV criterio a criterio, y la evaluación del banco —cada respuesta abierta con la nota, el porqué y la evidencia citada por la IA (`GET /postulaciones/{id}/evaluacion`, nuevo)— |
| Prueba / Simulación | La rúbrica con nota, explicación y origen (IA o ajuste a mano). Comparten componente porque el backend les da la misma forma |
| Validación | La cabecera del periodo y sus métricas. **El panel sí tiene ruta de validación**; la que falta es la del candidato |

Cada pestaña enseña **solo a quien está parado en esa etapa** — ver «La prueba por dentro, y la entrada de las
empresas» en la [bitácora de agosto](BITACORA-2026-08.md). Se deriva del prefijo del estado (`PRUEBA_*`, `SIMULACION_*`…).

⚠️ **La clave de DeepSeek del `application-secrets.yaml` local está muerta** (401 del
proveedor desde el 25/08; el 24/08 funcionaba). Sin ella la IA no califica: las abiertas
de la evaluación quedan «pendiente de calificar», que el panel enseña sin fingir. Hay una
evaluación entregada de verdad en la base local —sembrada con
`scripts/sembrar-evaluacion-local.py` del backend— esperando esa clave.

Verificarlo: `npx playwright test herramientas/e2e/13-etapas.spec.ts` (la entrada de desarrollo
y la ficha que cambia con la pestaña; solo lee) y `18-ranking-contra-api.spec.ts` (las cinco
pestañas, los cortes y las cifras, contrastados con la API).

### Descartar a un candidato, desde su ficha (11/09)

La ficha del ranking trae un botón **«Descartar»** con una ventana de un solo campo: el motivo
escrito, obligatorio. Manda `NO_CONTINUA` a `POST /postulaciones/{id}/transiciones`.

| Qué | Cómo se decide |
|---|---|
| Si el botón se ve | `puedeMoverPostulacion` de la ficha, no una lista de roles en el navegador. El login solo devuelve token e id: no hay endpoint de «mis permisos» |
| Si la postulación ya terminó | `esFinal` del estado en `GET /panel/catalogos`. El botón no sale y una línea lo explica |
| Qué se manda | Solo `estadoDestino` y `motivo`; el `motivoCierre` lo rellena el backend |

⚠️ **Al confirmar sale un correo de rechazo al candidato**, al momento y sin vuelta atrás. La
ventana lo avisa con su nombre antes de pedir el motivo. **El motivo no viaja en ese correo**: lo
lee el equipo en el historial.

⚠️ **Un 404 al pulsar no es que la ficha no exista.** El alcance se guarda por permiso: quien
pueda abrir fichas de todos y mover solo las suyas verá el botón y recibirá un 404. Está
traducido como lo que es, un límite del alcance del rol.

**Y a varios a la vez (11/09).** Junto a «Avanzar a N personas» está «Descartar…»: las mismas
casillas, el mismo motivo. Desde el 23/09 los dos viven en la barra que aparece abajo al marcar a
alguien (ver «Filtrar la tanda y actuar sobre muchas a la vez»). Por eso el campo dejó de
llamarse «motivo del avance» —con el descarte al lado, ese nombre haría escribir un motivo de
avance para acabar cerrando a seis personas con él—.

⚠️ **El botón del lote NO actúa al pulsarlo**, al revés que el de avanzar: abre la ventana
«Descartar a N personas» con los nombres escritos. El error real no es equivocarse de botón, es llegar con alguien marcado de
una pestaña anterior, y la cifra sola no lo enseña. Va uno a uno; quien falle sale nombrado y no
frena a los demás, así que la ventana promete «hasta N» correos.

**La casilla «avisar por correo»**, en los dos sitios y encendida de salida, permite descartar
sin que le llegue nada al candidato — para cuando ya se habló con esa persona por otro lado. Se
manda como `avisar: false`; el backend calla solo el correo y **deja escrito que no se avisó**,
en el motivo del historial y en la auditoría.

### Filtrar la tanda y actuar sobre muchas a la vez (23/09)

Las cinco pestañas del ranking comparten la misma barra y la misma forma de marcar. Todo pasa en
el navegador, sobre las filas que ya trajo el backend, y nada se guarda al recargar.

**La barra de encima**, de izquierda a derecha: buscar por nombre · **«Filtros»**, con una
insignia de cuántos hay puestos · «Columnas» · **«Borrar filtros»** (sustituye a «Ver a
todos») · calificar y «Descargar Excel». En el teléfono, «Columnas» y las acciones de la tanda
se recogen en «Más».

**El panel «Filtros»** flota sobre la tabla en escritorio, sin oscurecer ni mover nada, y la
tabla cambia detrás mientras se toca. En el teléfono es una hoja que sube desde abajo, con el
fondo apagado y el foco atrapado dentro. Los cambios se aplican al momento; el pie dice «Se ven X
de Y» y tiene «Borrar filtros» y «Listo».

| Sección | Qué hace |
|---|---|
| Fecha de postulación | Un día, o un rango con «Desde» y «Hasta» (los dos incluidos, cada uno opcional), y los atajos Hoy, Últimos 7 días y Últimos 30 días. El día es el del navegador de quien mira. Si «Desde» es posterior a «Hasta», avisa y no filtra. Quien no tiene fecha queda fuera, y la ayuda lo dice |
| Calificación con IA | Calificada, en curso o fallida, con cuántas hay de cada una. Es la de la cola del currículum, así que después de la primera etapa lo aclara: «Es la calificación del currículum» |
| Ciudad, Nota de la etapa, Pretensión | Como antes. Si la vacante no publica su remuneración, la ayuda de Pretensión dice «La vacante no publicó pretensión» |

Cada filtro puesto sale como una **etiqueta con «×»** debajo de la barra. Los filtros **se
conservan al cambiar de etapa** y se reinician al cambiar de vacante. La búsqueda por nombre no
cuenta en la insignia ni lleva etiqueta, pero «Borrar filtros» también la limpia, y basta con
ella escrita para que el botón aparezca. Un rango de fechas al revés no cuenta como filtro puesto.
Si no queda ninguna fila, la tabla dice cuántas hay sin filtrar y ofrece «Borrar filtros».

**Marcar todo lo que se ve.** La casilla de la cabecera marca solo las filas visibles, las suelta
si ya estaban todas y queda a medias si hay algunas. ⚠️ **Una marca que un filtro esconde se
conserva pero no cuenta** en los botones: la barra dice «N marcadas · M fuera de vista por los
filtros» y ofrece «Soltar las ocultas». Si el filtro esconde a todas las marcadas, la barra no
sale. Mandar una carta de rechazo a quien no se ve es el error más caro de la pantalla.

**La barra de lo marcado** sustituye a la mesa de debajo de la tabla y va pegada abajo mientras
se recorre la tabla: motivo (obligatorio), «Avanzar a N personas», «Descartar…» —sin permiso de
mover postulaciones no sale— y «Soltar selección». Es `position: sticky` y no `fixed`, así que no
tapa la última fila ni el pie. El resultado se queda en ella hasta cerrarlo con «×».

**El Excel** sigue bajando exactamente las filas que se ven, en su orden, filtros nuevos
incluidos.

**Foco y teclado.** Esc, «Listo» y un clic fuera sobre algo que no es un control devuelven el
foco a «Filtros». Un clic fuera sobre un control —una casilla, un botón— hace lo suyo y el foco
se queda ahí; uno sobre una fila cierra el panel y abre su ficha. Salir con Tab lo cierra. Los
«Borrar filtros» de la barra y de la tabla vacía llevan el foco a «Filtros»; el del pie se apaga
con `aria-disabled` y conserva el foco. En ventanas estrechas el panel se corre a la izquierda
para no desbordar.

Dónde está: `FiltrosDelRanking.tsx` (el botón, el panel y las etiquetas),
`BarraDeLaSeleccion.tsx` (la barra de abajo) y las reglas de filtrado en `ranking.ts`, todo en
`src/panel/vacantes/`. La fecha llega en `postuladoEn` de cada fila, nuevo en el backend.

Comprobarlo: `npx playwright test herramientas/e2e/34-filtros-y-seleccion-qa.spec.ts` es la
suite entera (fecha, IA, selección en lote, foco, Excel, permisos, avance real); el 33 quedó
reducido a dos pruebas que no escriben —el panel flota y los filtros se conservan al cambiar de
etapa— y las reglas de filtrado se prueban sin navegador en `ranking.test.ts` y
`ranking.escenario-e2e.test.ts` (ver [SUITE-E2E-CLASIFICACION-2026-09-25.md](SUITE-E2E-CLASIFICACION-2026-09-25.md)). El 34 y el 35
(`34-filtros-y-seleccion-qa`, `35-filtros-y-seleccion-qa-movil`) ⚠️ **escriben**: siembran su
propio terreno —32 postulaciones en 9 días, con la IA en sus cuatro estados— y lo retiran al
terminar. Lo que el 34 hace avanzar no se puede borrar, así que su vacante queda marcada
eliminada. Necesitan las variables de [TRABAJAR-EN-LOCAL.md](TRABAJAR-EN-LOCAL.md). ⚠️ Los
números 33 a 35 están repetidos con los de «¿Olvidaste tu contraseña?»: ver
[PENDIENTES.md](PENDIENTES.md).

### Publicar una vacante exige tres cosas antes (25/08)

Era el atasco: el backend rechaza publicar y el panel no tenía dónde resolverlo. Ahora las
tres viven en el detalle de la vacante, bajo **«Qué responderá quien postule»**.

| Qué | Obligatorio |
|---|---|
| **Banco publicado del nivel del puesto** | **Sí, si `aplicaEvaluacion` está encendido.** No se elige aquí: se publica en Configuración y la vacante lo hereda de su puesto (V44) |
| Versión de plantilla de prueba | **Solo si la vacante rinde la prueba del puesto.** Si eligió el cuestionario técnico, lo obligatorio es tenerlo publicado — ver «La vacante elige qué prueba se rinde» en la [bitácora de agosto](BITACORA-2026-08.md) |
| Versión de pesos | No: sin elegir, rigen los generales |

⚠️ **La plantilla de evaluación ya NO se elige ni se exige** — ver «El tiempo viaja con el
banco» en la [bitácora de agosto](BITACORA-2026-08.md). La resuelve el nivel.

Y antes que todo eso, la vacante misma exige **una solicitud de talento aprobada** que no haya
usado ninguna otra. **Escribir una solicitud se ofrece siempre, desde la cabecera** —puede haber
varias `ABIERTA` a la vez, ver «El desplegable se cerraba solo» en la [bitácora de agosto](BITACORA-2026-08.md)— y si no hay ninguna el panel ademas deja
aprobar un borrador ahi mismo; el backend le exige **entre 3 y 5 resultados esperados**, cada
uno con su indicador.

⚠️ **La prueba del puesto sí se elige, y se filtra por el puesto de la vacante.** La genérica
—`puestoId: null`— vale para cualquiera y sigue saliendo; la que la vacante ya tiene puesta no
se filtra nunca, porque el backend admite asignaciones cruzadas.

⚠️ **`listarVersionesPrueba` tantea ids y deja 404 en la consola.** No es un fallo: es el hueco
del backend. Va por tandas de ocho en paralelo, sembrado con la versión que la vacante ya tiene
—ver «La prueba por dentro, y la entrada de las empresas» en la [bitácora de agosto](BITACORA-2026-08.md)—, y el día que exista
`GET /plantillas-prueba/{id}/versiones` esa función se borra entera.

⚠️ **Un `<form>` dentro de otro `<form>` lo descarta el navegador**, y su botón de enviar acaba
enviando el de fuera. Pasó con el formulario de solicitud dentro del de alta: se veía bien y no
hacía nada. Va fuera, con un `return` temprano.

**El recorrido entero, los dos lados**, está en
[06-FLUJO-COMPLETO.md](06-FLUJO-COMPLETO.md), y se comprueba con
`npx playwright test herramientas/e2e/14-vacante.spec.ts`: abre un Chrome de verdad y va de la solicitud a la vacante
publicada en el portal. ⚠️ Escribe en la base local.

### Corregir una vacante con el lápiz (19/09)

Cada fila en **borrador o publicada** lleva un lápiz, con el nombre accesible «Editar la vacante
{título}»: con veinte filas, «Editar» a secas no dice cuál es cuál. En una cerrada no sale.
Tampoco sale si quien mira no tiene `editar_vacante` o su alcance no llega a esa vacante; lo
decide el backend fila a fila con `puedeEditar`, porque no hay endpoint de «mis permisos».

Al pulsarlo se abre **el mismo formulario del alta en un modal** (21/09), con el título «Editar
vacante» y los datos de ahora, sueldo incluido. Antes se insertaba encima de la tabla y empujaba
las filas: quien pulsaba el lápiz de la fila doce perdía de vista la fila doce. Ahora **la lista
se queda quieta detrás**. La solicitud y el puesto salen como texto fijo, con la frase «El puesto
decide el nivel y la familia de la evaluación; para cambiarlo, crea otra vacante». **Solo hay un
formulario abierto a la vez**: abrir la edición cierra el alta y la solicitud, y al revés.

Es el **modal compartido `src/ui/Modal.tsx`**, no una infraestructura propia: allí ya están el
Escape, el foco atrapado dentro, el fondo que no se opera y la vuelta del foco al botón que lo
abrió. En el pie, «Cancelar» y «Guardar cambios».

⚠️ **Cerrar con algo escrito no tira lo escrito.** Cancelar, el aspa, Escape y pulsar el fondo
hacen lo mismo: sin cambios cierran; con cambios preguntan, con «Descartar cambios» y «Seguir
editando». La pregunta se pinta **dentro del mismo modal** y no en otro encima, y eso no es
estética: el formulario sigue montado detrás, así que «Seguir editando» devuelve lo escrito tal
cual estaba. Cancelar nunca guarda, audita ni avisa. Mientras guarda no se puede cerrar ni
reenviar; al terminar o fallar, sí.

| Cuándo | Qué dice el panel |
|---|---|
| Antes de guardar, en una publicada con gente en carrera | Bajo el botón, sin pedir confirmación: «Al guardar, avisaremos en su portal a N postulantes en carrera de lo que cambies» |
| Guardó y avisó | «Cambios guardados. Avisamos a N postulantes en su portal». N son los avisos que de verdad se publicaron |
| Guardó y no había a quién avisar | «Cambios guardados» |
| No había nada distinto | «No había cambios que guardar». No se guarda, no se audita y no se avisa |
| Algo falla | El error, junto al formulario, y lo escrito se queda. Si la vacante se cerró mientras tanto, no se guarda nada y la lista se recarga |

En carrera es toda postulación que no esté contratada, cerrada ni en «no continúa». Lo interno
—responsable, forma de cierre, plazas y fecha de cierre— se guarda **sin avisar a nadie**.

**El sueldo también se corrige aquí.** En una publicada no se puede pasar de oculto a visible ni
al revés, y la opción bloqueada dice por qué; el monto sí, y entonces se pide «Por qué cambia el
sueldo». Si el mismo guardado cambia el sueldo y otra cosa, al candidato le llega **un solo
aviso** con todo. La tarjeta del sueldo del detalle sigue existiendo para cambiar solo eso.

⚠️ **Ni el formulario ni la tarjeta del sueldo mandan correo.** Lo que cambia en una vacante se
avisa solo en la campana del portal, y la tarjeta ya dice «Avisamos a N candidatos en su portal»
en vez de prometer un correo. El aviso del candidato dice «antes → ahora» en lo corto, nombra lo
largo («se actualizaron la descripción y los requisitos») y lo lleva a su proceso.

Comprobarlo: `npx playwright test herramientas/e2e/25-editar-vacante.spec.ts` **no escribe**
—guarda el formulario tal cual y el backend contesta que no había cambios—.
`herramientas/e2e/26-editar-vacante-avisos.spec.ts` ⚠️ **sí escribe**: siembra en el clon su
propia vacante, candidatos y cuentas de panel, y lo retira al terminar salvo la auditoría, que la
base no deja borrar. Necesita las variables de [TRABAJAR-EN-LOCAL.md](TRABAJAR-EN-LOCAL.md).

### Archivar una vacante cerrada, y dónde va a parar (21/09)

`/admin` enseñaba **todas** las vacantes de la empresa, y las cerradas se acumulan para siempre.
Ahora una **`CERRADA`** lleva en sus acciones un **icono de caja** —«Archivar la vacante
{título}»— si quien mira tiene `cerrar_vacante` y el alcance llega: lo dice `puedeArchivar` de la
fila. Se conserva la regla de estados: las cerradas no tienen lápiz, y las de borrador o
publicadas no tienen archivo. Es una caja y no una papelera a propósito: archivar **no borra
nada** y se puede deshacer.

Al pulsarlo se abre el modal «Archivar vacante», que **no pregunta «¿estás seguro?»: cuenta lo
que va a pasar** —deja la lista habitual, se podrá consultar en «Vacantes archivadas» con todo su
proceso, se podrá desarchivar sin reabrirla— y deja decidir con eso puesto. «Cancelar» y el
cierre no cambian nada.

| Cuándo | Qué hace el panel |
|---|---|
| Sin nadie en carrera | «Archivar vacante» confirma, la fila sale de la lista y el aviso dice dónde está: «… está en Archivadas. Puedes desarchivarla cuando quieras». El foco va a «Archivadas (N)» —el icono que abrió el modal ya no existe, y devolvérselo dejaría a quien usa teclado en el `body`— |
| Con N en carrera | El icono **sale igual** y es el modal el que explica por qué no se puede: «Quedan N postulantes en carrera. Decide cada uno, o descártalos en lote, desde la vacante antes de archivarla», con enlace a la vacante y el botón apagado. Esconder el icono dejaría la pregunta sin respuesta |
| Algo falla | El modal se queda con el error. La fila no se retira como si hubiera ido bien |

⚠️ **El conteo del modal es el de la fila y puede tener un minuto.** El servidor vuelve a mirar
estado y conteo al confirmar y contesta **409** si cambió: el modal es una foto, la decisión se
toma sobre lo que hay.

⚠️ **`disabled` no protege del doble clic.** Solo llega al botón cuando React vuelve a pintar, y
las dos pulsaciones caben antes de ese render: salían dos peticiones. La guarda es un `ref`
escrito en el mismo turno del evento, aquí y en «Desarchivar». El backend tiene la suya —un
`UPDATE` condicional—, y hacen falta las dos.

**La cabecera lleva «Archivadas (N)»**, junto a «Escribir una solicitud» y «Crear vacante»; el
número sale de `GET /vacantes/archivadas/conteo` y se refresca al archivar y al desarchivar, para
que no diga (0) justo encima del aviso de que la vacante ya está allí. No hay selector «Activas /
Archivadas»: **son dos pantallas, no dos modos de una**, porque un selector deja dudando si lo
que se mira son todas las vacantes o la mitad.

**`/admin/archivadas`** es esa segunda pantalla, con «← Volver a vacantes», la fecha de archivo
de cada fila, el paso a su detalle, «Desarchivar» cuando se puede y «No hay vacantes archivadas.»
si está vacía. Tener **dirección propia** es lo que hace que la recarga y el botón Atrás acierten
y que el enlace se pueda mandar por chat.

⚠️ **El corte lo hace el servidor, no el navegador.** La lista habitual pide las no archivadas y
esta pide las archivadas (`GET /vacantes?archivadas=true`): por eso una archivada no reaparece al
buscar, filtrar por estado ni paginar en `/admin`. Recortar en el navegador una lista que ya vino
entera las dejaría al alcance de cualquier búsqueda.

**El detalle de una archivada se lee entero y no se toca.** La cabecera dice «Cerrada el … ·
Archivada el …» —después del estado, no en su lugar: archivar no es una forma de terminar— y
«Esta vacante está archivada: se consulta, no se cambia», con «Desarchivar» al lado si el permiso
llega. Sus postulantes, etapas, ranking, fichas, historial y descargas siguen ahí con los
permisos de siempre. Desarchivar la devuelve a la lista **cerrada como estaba**, sin reabrir
ninguna postulación: **el candidato no ve ningún cambio en su portal**.

Comprobarlo: `npx playwright test herramientas/e2e/27-archivar-vacante.spec.ts` y
`28-archivar-vacante-regresiones.spec.ts` ⚠️ **escriben**: siembran en el clon sus propias
vacantes, un candidato en carrera y una cuenta de panel sin permiso de archivo —no tocan las
vacantes sembradas de la base, porque archivar una las escondería del resto de pruebas— y lo
retiran al terminar. Necesitan las variables de [TRABAJAR-EN-LOCAL.md](TRABAJAR-EN-LOCAL.md).

### Eliminar una vacante que no debió existir (21/09)

Archivar guarda lo que terminó bien; **eliminar es para la que se creó por error** —el puesto
equivocado, duplicada— y es excepcional. Si quien mira tiene `eliminar_vacante` y el alcance
llega —lo dice `puedeEliminar` de la fila—, cada fila lleva una **papelera**, «Eliminar la
vacante {título}», **esté en el estado que esté**, también en `/admin/archivadas`. Va en la misma
columna de acciones y **al final**: editar, archivar o desarchivar, eliminar. No hay botón de
eliminar en la cabecera, y no hace falta archivar antes.

La papelera no elimina: abre el modal «Eliminar vacante» (el modal compartido `src/ui/Modal.tsx`),
que nombra la vacante y cuenta lo que va a pasar: dejará de verse en el panel y en el portal
—tablón, detalle público y «Mis procesos»—; **«Se cerrarán sus N postulaciones y se les avisará
en su portal»**, solo si hay gente en carrera; y no se podrá deshacer desde el panel. Pide **«Por
qué se elimina»**, y el botón destructivo «Eliminar vacante» se enciende solo con un motivo que no
sea solo espacios —el backend aplica la misma regla y contesta 400—. «Cancelar», el aspa y Escape
no cambian nada. Mientras envía dice «Eliminando…» y no se cierra; si falla, se queda con el
error y **con el motivo escrito**, para reintentar.

| Cuándo | Qué dice el panel |
|---|---|
| No había nadie en carrera | «Vacante eliminada» |
| Se cerraron N y salieron los N avisos | «Vacante eliminada. Se cerraron N postulaciones y se les avisó en su portal» |
| Algún aviso no salió | «Vacante eliminada. Se cerraron N postulaciones y se avisó a M: los avisos que faltan no salieron». **No se redondea**: el equipo necesita saber a quién escribir a mano |
| Algo falla antes | El modal se queda con el error; la fila no se retira |

Los números son los que contesta el servidor (`postulacionesCerradas`, `postulantesAvisados`), no
los de la fila, que pueden tener un minuto. Al terminar se refrescan la lista, Archivadas y su
contador, y **el foco va al título de la página**, donde vive el aviso: la vacante no se fue a
Archivadas, se fue a ninguna parte. El doble clic lo frena el mismo `ref` que en archivar, y el
backend tiene su `UPDATE` condicional.

**Después, la vacante no existe para el panel**: su detalle responde 404 y no sale en ninguna
lista ni contador. Un formulario de edición que alguien tenía abierto no guarda: el modal se va
con la fila y queda, fuera de él, «No se guardó nada en «{título}»: …». En el portal, su detalle
público y los procesos de quienes postularon dicen **«Esta vacante ya no está disponible.»**
—también la prueba, la evaluación, el cuestionario técnico y las fechas de la simulación, y
también si el candidato las tenía abiertas al eliminarla: lo dice el primer botón que pulse (ver
[02-QUE-VE-EL-CANDIDATO.md](02-QUE-VE-EL-CANDIDATO.md), §2.7)—, y a quienes seguían en carrera
les llega un aviso en la campana, sin enlace. No hay botón de restaurar: solo soporte, en la base.

**Sus postulaciones se leen pero ya no se escriben.** Una ficha abierta desde antes sigue
cargando —la ficha, la prueba y su plazo responden 200, por decisión del producto—, pero todo lo
que escribe sobre ella —el plazo de esa persona, las notas, calificar con IA, el currículum, el
contacto, el enlace de acceso, la simulación, la validación y la decisión— recibe un **404** del
backend. La lista completa está en `09-APIS.md` del backend.

Comprobarlo: `npx playwright test herramientas/e2e/29-eliminar-vacante.spec.ts`,
`30-eliminar-vacante-regresiones.spec.ts`, `31-eliminar-vacante-y-su-prueba.spec.ts` —el enlace
de la prueba en el portal y el plazo de la persona en el panel— y
`32-eliminar-vacante-con-la-pantalla-abierta.spec.ts` —las cuatro pantallas del candidato abiertas
mientras se elimina, por la API y sin salir de la página— ⚠️ **escriben**: siembran en el clon su propio terreno
(`herramientas/e2e/ayuda-eliminar-vacante.ts`) —nunca las vacantes sembradas de la base, que no
tienen vuelta— y lo retiran al terminar, salvo la auditoría y las transiciones, que la base no
deja borrar. Necesitan las variables de [TRABAJAR-EN-LOCAL.md](TRABAJAR-EN-LOCAL.md).

### El plazo de la prueba se ve antes de cambiarlo (22/09)

Los dos controles —la fecha de toda la convocatoria y la de una sola persona, los dos en
`src/panel/vacantes/CierreDePrueba.tsx`— existían desde agosto. Lo que faltaba era **ver qué
plazo rige hoy**: los dos campos de fecha salían vacíos sobre vacantes que sí tenían fecha, y
quien entraba no sabía qué estaba cambiando.

**En la configuración de la vacante**, el desplegable «Plazos de la prueba» abre con una línea
que contesta «¿qué rige ahora mismo?». Son cuatro frases y no una con huecos, porque son cuatro
reglas distintas:

| La vacante | Qué dice la línea |
|---|---|
| Plazo abierto **con** fecha | «Cierra el domingo 21 sep 2026, 23:59 (hora de tu equipo, `America/Lima`)» |
| Plazo abierto **sin** fecha | «Sin fecha para todos: a cada persona le cierra N días después de que empieza» |
| Cronometrada **sin** fecha | «Cronometrada: N minutos desde que cada persona empieza, sin fecha límite para empezar» |
| Cronometrada **con** fecha | Los minutos **y** la fecha, y «Rige lo que caiga antes» |

Y tres casos en los que el control **no se ofrece**, con el motivo escrito en vez de un hueco
callado: la vacante **cerrada** («ya no admite una fecha nueva»), la que rinde el **cuestionario
técnico** —su tiempo son los minutos de la vacante, con el enlace «Ajustar los minutos →» al
ajuste que está unas líneas más arriba en la misma página— y la que **no ha elegido prueba**,
que manda a elegirla antes. El desplegable se abre igual: es donde quien busca la fecha mira.

⚠️ **Una prueba `CRONOMETRADA` sí admite fecha desde el 22/09/2026**, y la regla vieja del panel
la escondía junto a esos tres casos. El reloj y la fecha **conviven**: al empezar rige el que
caiga antes, así que la fecha es lo que impide abrir el examen después de que cierre la
convocatoria. Hasta esa fecha el backend lo rechazaba con un 400, «anularía el reloj».

El campo llega **precargado con la fecha vigente** —`pruebaCierraEn`, pasada a hora local con
`aCampoLocal`— y al escribir otra se dice a cuánta gente alcanza **antes** de guardar: «Se
moverá el cierre de 8 exámenes abiertos; 2 quedan como están porque tienen fecha propia». Las
dos cifras solo se conocían después, en la respuesta del `POST`, cuando a los ocho ya les había
llegado.

**En la ficha del candidato** (etapa Prueba del puesto), `GET /postulaciones/{id}/prueba/plazo`
dice en qué punto está esa persona y hasta cuándo tiene. Va con **`abrir_ficha_candidato`**, el
permiso de leer: quien no puede mover el plazo igualmente lo ve.

| Esa persona | Qué se ve, y si hay control |
|---|---|
| No llegó a la etapa | «Todavía no tiene prueba. El plazo se fija cuando llegue». Sin control |
| No ha abierto la prueba | Cuándo le cierra, o «su plazo empieza a contar cuando la abra» |
| En curso | «Le cierra el …» y **de dónde sale**: la de la vacante, la que calculó el reloj al abrirla, o una puesta a mano |
| Ya entregó | «Entregó el …. El plazo ya no cambia». Sin control: moverlo no cambiaría nada de lo que hizo |
| Su vacante rinde el cuestionario técnico | No hay fecha por persona; el tiempo son los minutos de la vacante |

Los tres casos sin control son los que el servidor rechazaba **después** de escribir el motivo,
con «Prueba del puesto no encontrada» o «ya se entregó». La fecha que se guarde aquí queda
**como suya**, y la pantalla lo dice antes de guardar: no se moverá aunque cambie la de la
vacante.

⚠️ **Los campos nuevos pueden faltar, y `undefined` no es «no hay fecha».** `modalidadPrueba`,
los minutos o días vigentes y las dos cifras de exámenes abiertos **solo viajan en el detalle**
(`GET /vacantes/{id}`), no en la lista, y un backend anterior no los manda: donde no se sabe se
dice «sin dato» en vez de afirmar que no hay plazo, que es lo contrario de lo que pasa.

Los errores del servidor se leen en castellano y pegados a lo que hay que corregir: lo que
rechaza la fecha —«Esa fecha ya pasó…»— va en el campo, y un 403 nombra el permiso que falta
(`elegir_plantilla_prueba` en la vacante, `mover_postulacion` en la persona). El motivo sigue
siendo obligatorio en las dos llamadas y queda en la auditoría.

Comprobarlo: `npx playwright test herramientas/e2e/29-plazo-de-la-prueba.spec.ts` ⚠️ **escribe**:
siembra en el clon sus propias vacantes, una plantilla de prueba, los candidatos de cada estado
y una cuenta de panel de solo lectura, y lo retira al terminar. Necesita las variables de
[TRABAJAR-EN-LOCAL.md](TRABAJAR-EN-LOCAL.md).

### ¿Olvidaste tu contraseña? (22/09)

Antes, quien olvidaba su contraseña del panel solo podía pedir que lo invitaran de nuevo. Ahora
`/admin/entrar` tiene **«¿Olvidaste tu contraseña?»** debajo del botón, y el recorrido es el
mismo que el del candidato (ver [02-QUE-VE-EL-CANDIDATO.md](02-QUE-VE-EL-CANDIDATO.md), «Si
olvidó la contraseña»), con sus propias pantallas y sus propias llamadas:

| Paso | Pantalla | Llamada |
|---|---|---|
| Pedir el enlace con el correo | `/admin/clave` (`ClavePanel.tsx`) | `POST /panel/auth/recuperacion` |
| Elegir la contraseña nueva, **mínimo 12** | `/admin/restablecer?token=…` (`RestablecerPanel.tsx`) | `POST /panel/auth/restablecer` |
| Volver a entrar, con «✓ Contraseña cambiada exitosamente» encima | `/admin/entrar` | — |

El formulario, los textos y las reglas son **los mismos del portal** y viven en
`src/ui/recuperacion/`: el mensaje de enviado es idéntico exista o no la cuenta, «Reenviar
enlace» espera 60 segundos, el token sale de la barra al cargar y no se abre sesión al terminar.
Lo que cambia es el mínimo (12, como la invitación) y que aquí no hay línea de talento: quien no
recibe el correo o tiene la cuenta desactivada sigue pidiendo a su administrador que lo invite
de nuevo, y la caja «¿No puedes entrar?» lo dice.

⚠️ **El enlace del correo de equipo cae siempre en `/admin/restablecer`**, lleve o no `/admin`
la dirección del panel configurada en el backend: `/restablecer` a secas es la pantalla del
candidato. Si el mismo correo tiene cuenta en dos empresas, llegan dos correos, uno por cuenta,
y cada enlace cambia solo la contraseña de la suya.

Comprobarlo: `npx playwright test herramientas/e2e/33-recuperar-contrasena.spec.ts`, y del 34 al
36 (móvil, bordes y regresiones). ⚠️ **El 33, el 35 y el 36 escriben**: crean sus cuentas en el
clon, leen el enlace del correo guardado en la base (`correo_enviado`: el backend local no
envía correo) y las retiran al terminar. El 34 no escribe nada. Necesitan las variables de
[TRABAJAR-EN-LOCAL.md](TRABAJAR-EN-LOCAL.md).

---
