# El panel del equipo (`/admin`)

Qué es, cómo se entra, qué enseña cada entrada del menú lateral, qué exige el backend antes de
publicar una vacante, cómo se eligen su modalidad y su ciudad, cómo se corrige después, las
reseñas de empresas —escribirlas, leerlas y moderarlas—, la gestión de personas: colaboradores,
sedes y cargos, y contratar desde la ficha; las preguntas propias de cada vacante: de dónde
salen, el editor y su nota en la ficha; y la prueba técnica de cada vacante nueva, escrita en ese
mismo editor. El recorrido de los dos lados —equipo y candidato— está en
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
- **Un menú lateral por familias** desde el 29/09/2026 (antes, pestañas arriba): en
  **Selección**, **Vacantes** (el CRUD, y dentro de cada una el embudo, el ranking con las notas
  de la IA, la ficha de cada postulante, avanzar de etapa y contratar), **Simulación** (las
  sesiones presenciales) y **Pruebas**; en **Personas**, **Colaboradores**; y al pie
  **Configuración** (parámetros, banco de preguntas por Excel, usuarios y roles, áreas, sedes,
  cargos y, solo para la plataforma, las reseñas reportadas). Cada uno ve solo lo que puede usar:
  ver «Gestión de personas: el menú lateral, los colaboradores y contratar».
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
| Prueba / Simulación | La rúbrica con nota, explicación y origen (IA o ajuste a mano). Comparten componente porque el backend les da la misma forma. **En una vacante nueva (01/10/2026), la pestaña Prueba enseña su prueba criterio a criterio**: ver «La prueba técnica de cada vacante nueva», al final |
| Validación | La cabecera del periodo y sus métricas. **El panel sí tiene ruta de validación**; la que falta es la del candidato |

Cada pestaña enseña **solo a quien está parado en esa etapa** — ver «La prueba por dentro, y la entrada de las
empresas» en la [bitácora de agosto](BITACORA-2026-08.md). Se deriva del prefijo del estado (`PRUEBA_*`, `SIMULACION_*`…).

**El Veredicto solo está en «Perfil integral» (29/09).** Es el grupo de prioridad
(`grupoPrioridad`), que se asigna una vez al calificar el currículum y nadie recalcula, así que en
las demás pestañas contradecía la nota de al lado —un 95 en la prueba junto a «No priorizado»—.
En «Prueba del puesto», «Simulación», «Validación» y «Decisión» no hay cabecera, celda, leyenda de
veredictos ni casilla «Veredicto» en «Columnas», aunque el backend siga mandando el dato en todas.
En «Prueba del puesto» la columna de resumen es **Ponderado**, tras «Nota» (ver «El ponderado de lo
ya rendido» en [06-FLUJO-COMPLETO](06-FLUJO-COMPLETO.md)). El riesgo crítico de alguien se consulta
abriéndolo en «Perfil integral».

⚠️ **La clave de DeepSeek del `application-secrets.yaml` local está muerta** (401 del
proveedor desde el 25/08; el 24/08 funcionaba). Sin ella la IA no califica: las abiertas
de la evaluación quedan «pendiente de calificar», que el panel enseña sin fingir. Hay una
evaluación entregada de verdad en la base local —sembrada con
`scripts/sembrar-evaluacion-local.py` del backend— esperando esa clave.

Verificarlo: `npx playwright test herramientas/e2e/13-etapas.spec.ts` (la entrada de desarrollo
y la ficha que cambia con la pestaña; solo lee), `18-ranking-contra-api.spec.ts` (las cinco
pestañas, los cortes y las cifras, contrastados con la API) y `44-veredicto-solo-en-el-perfil.spec.ts`
(el Veredicto y su casilla solo en «Perfil integral», el Ponderado tras «Nota» en la prueba, y el
menú «Columnas» a 360 px; solo lee).

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

**«Columnas»** oculta y devuelve columnas de la tabla, cabecera y celdas a la vez; «Candidato» y
la casilla de avanzar no se pueden ocultar. El botón dice «1 oculta» o «N ocultas», contando solo
las que la tabla tiene en ese momento, y ofrece «Ver todas», que también enciende «Reseñas». Lo
ocultado no se guarda: al recargar o al cambiar de pestaña la tabla vuelve a como se abrió, **con
todas encendidas menos «Reseñas»**, que arranca apagada a propósito (ver «Reseñas de empresas»,
abajo). Por eso quien puede ver reseñas encuentra el botón diciendo «1 oculta» nada más entrar.
Un criterio ocultado sí se recuerda al apagar y volver a encender «Ver los criterios en la tabla». La casilla del ponderado dice «Ponderado» a secas: su
explicación —qué mezcla y que no es la nota final— sale al pasar el cursor por su cabecera. En el
teléfono, dentro de «Más», la lista se abre hacia la derecha para caber en la pantalla.

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
incluidos. ⚠️ **En «Prueba del puesto» sus columnas de criterio no siempre son las de la tabla**
(26/09/2026): la hoja saca las de la prueba que la vacante tiene puesta hoy, y la tabla, al
marcar «Ver los criterios en la tabla», junta las de todas sus filas. En una vacante que cambió
de prueba con gente dentro —la 13— la tabla enseña además las de la prueba anterior y la hoja
no. Lo decide el backend; el panel no cambió. Ver [PENDIENTES.md](PENDIENTES.md).

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

### Avanzar a Validación a quien ya tuvo un periodo (05/10)

A quien se retrocedía —por la API: el panel no tiene cómo— después de abrirle su periodo de
validación, «Avanzar» en la pestaña Simulación le respondía «No avanzaron: … (ya existe un
registro con postulacion_id X)», y ahí se quedaba. Ahora avanza: su periodo se reutiliza tal cual
y aparece en la pestaña Validación en el paso que le toca —por habilitar, su turno o por
confirmar—. El historial de su ficha lo explica detrás del motivo: «· su periodo de validación ya
estaba en curso», «… ya había vencido» o «… ya estaba cerrado». **El panel no cambió**: lo decide
el backend, y «Avanzaron: …» no nombra el destino. Las reglas están en `docs/03-ESTADOS-POSTULACION.md`
del backend, «Vuelve a una etapa por la que ya pasó».

Comprobarlo: `npx playwright test herramientas/e2e/51-volver-a-validacion.spec.ts` (una persona
con el periodo en curso, retrocedida por la API y avanzada desde el panel) y
`51-volver-a-validacion-qa.spec.ts` (los cinco estados del periodo en lote, dos «Avanzar» a la
vez, los movimientos a mano y el 409 al mover a la prueba de una vacante sin prueba lista). ⚠️ **Escriben** en el clon: siembran su
propia vacante y, como lo avanzado no se borra, retiran las cuentas y dejan la vacante marcada
eliminada. Necesitan las variables de [TRABAJAR-EN-LOCAL.md](TRABAJAR-EN-LOCAL.md).

### Publicar una vacante exige tres cosas antes (25/08)

Era el atasco: el backend rechaza publicar y el panel no tenía dónde resolverlo. Ahora las
tres viven en el detalle de la vacante, bajo **«Qué responderá quien postule»**.

| Qué | Obligatorio |
|---|---|
| **Sus preguntas, según de dónde salgan** | Desde el 30/09 se elige en «De dónde salen sus preguntas» (ver «Las preguntas propias de cada vacante», al final). **Con «Preguntas propias de esta vacante» —con la que nace toda vacante nueva— hay que tenerlas publicadas**; con «El banco de la empresa para su nivel», que esté publicado en Configuración para el nivel del puesto (V44); con «Sin evaluación», nada |
| Su prueba técnica | **En una vacante nueva (desde el 01/10/2026), su prueba publicada** desde «Armar la prueba» — ver «La prueba técnica de cada vacante nueva», al final. En una de antes: la versión de plantilla de prueba si rinde la prueba del puesto, o el cuestionario técnico publicado si eligió ese — ver «La vacante elige qué prueba se rinde» en la [bitácora de agosto](BITACORA-2026-08.md) |
| Versión de pesos | No: sin elegir, rigen los generales |

⚠️ **La plantilla de evaluación ya NO se elige ni se exige** — ver «El tiempo viaja con el
banco» en la [bitácora de agosto](BITACORA-2026-08.md). La resuelve el nivel, cuando la vacante
rinde el banco.

Y antes que todo eso, la vacante misma exige **una solicitud de talento aprobada** que no haya
usado ninguna otra. **Escribir una solicitud se ofrece siempre, desde la cabecera** —puede haber
varias `ABIERTA` a la vez, ver «El desplegable se cerraba solo» en la [bitácora de agosto](BITACORA-2026-08.md)— y si no hay ninguna el panel ademas deja
aprobar un borrador ahi mismo; el backend le exige **entre 3 y 5 resultados esperados**, cada
uno con su indicador.

⚠️ **En una vacante de antes, la prueba del puesto sí se elige, y se filtra por el puesto de la
vacante.** A una nueva no se le ofrece ningún desplegable. La genérica
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

**En una vacante nueva (01/10/2026) el plazo es el de su prueba**: los minutos o los días salen de
la prueba publicada en «Armar la prueba», y la línea dice «la prueba de la vacante» donde las de
antes dicen «su plantilla». Mientras la prueba no está publicada, el servidor rechaza la fecha.

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
de nuevo, y la caja «Si el correo no llega» de `/admin/clave` lo dice.

⚠️ **En `/admin/entrar` había una caja «¿No puedes entrar?» y se fue el 25/09/2026**, junto con
la bajada bajo el titular. Se quitaron por petición al convertir esa pantalla en una tarjeta
centrada: lo que explicaban sigue donde hace falta, en `/admin/clave`, que es la pantalla a la
que se llega buscándolo. El titular pasó a decir **«Panel de Empresa.»**.

⚠️ **El enlace del correo de equipo cae siempre en `/admin/restablecer`**, lleve o no `/admin`
la dirección del panel configurada en el backend: `/restablecer` a secas es la pantalla del
candidato. Si el mismo correo tiene cuenta en dos empresas, llegan dos correos, uno por cuenta,
y cada enlace cambia solo la contraseña de la suya.

Comprobarlo: `npx playwright test herramientas/e2e/33-recuperar-contrasena.spec.ts`, y del 34 al
36 (móvil, bordes y regresiones). ⚠️ **El 33, el 35 y el 36 escriben**: crean sus cuentas en el
clon, leen el enlace del correo guardado en la base (`correo_enviado`: el backend local no
envía correo) y las retiran al terminar. El 34 no escribe nada. Necesitan las variables de
[TRABAJAR-EN-LOCAL.md](TRABAJAR-EN-LOCAL.md).

### Modalidad y ciudad, de una lista (25/09)

El portal ya deja buscar y filtrar vacantes por ciudad y modalidad, y con texto libre «Lima» y
«LIMA» eran dos ciudades. Por eso el formulario de la vacante —el mismo para crear y para
corregir— cambió tres campos:

| Campo | Cómo es ahora |
|---|---|
| **Modalidad** | Un desplegable con Presencial, Híbrido y Remoto. **Obligatorio al crear** |
| **Ciudad** | El mismo catálogo del registro del candidato, agrupado por departamento y con «Fuera del Perú» al final. **Obligatoria al crear si la modalidad es Presencial o Híbrido**; con Remoto es opcional |
| **Zona o referencia (opcional)** | Lo que antes se llamaba «Ubicación»: barrio, distrito o dirección. Se ve en la ficha y no se filtra |

**Las vacantes viejas se corrigen sin obligar a decidir nada.** Si no tienen modalidad o ciudad,
el desplegable dice «Sin indicar» y se puede guardar así; si la modalidad guardada no se parece a
ninguna de las tres, sale como «test (valor anterior)», marcada. La ciudad solo se vuelve a pedir
si alguien **elige** Presencial o Híbrido en una vacante que no la tiene.

⚠️ **Si nadie toca un desplegable, se guarda lo que había, letra por letra.** Una modalidad
guardada como «PRESENCIAL» sigue siendo «PRESENCIAL» al corregir el horario: si se guardara como
«Presencial», el backend lo contaría como un cambio y avisaría en falso a cada postulante en
carrera.

Cambiar la ciudad de una publicada sí avisa, como cualquier dato que ve el candidato: «Ciudad: —
→ Arequipa». La zona aparece en el aviso como «Zona o referencia: antes → ahora». Un código de
ciudad que el backend no reconoce responde «Esa ciudad no está en el catálogo».

Comprobarlo: `npx playwright test herramientas/e2e/39-buscar-vacantes-panel.spec.ts` ⚠️
**escribe**: siembra su propia solicitud, vacantes y postulantes, y lo retira al terminar.
Necesita las variables de [TRABAJAR-EN-LOCAL.md](TRABAJAR-EN-LOCAL.md).

### Reseñas de empresas: la columna, la ficha y la moderación (28/09)

La empresa que contrató a alguien por EX le deja, a partir del primer mes, de 1 a 5 estrellas y
una opinión. Las demás empresas donde esa persona postula las leen. **No puntúan**: ni la nota, ni
el orden por defecto de la tabla, ni el pase automático, ni el Excel cambian por ellas. Lo que ve
la persona está en [02-QUE-VE-EL-CANDIDATO.md](02-QUE-VE-EL-CANDIDATO.md), 2.15.

Desde el 29/09/2026 se contrata con **«Contratar»** en la ficha del postulante (ver «Gestión de
personas»), y también sigue valiendo la API. La persona contratada se encuentra en la vista
«Toda la tanda» de su vacante; no hay lista de «contratados pendientes de reseña».

**La columna «Reseñas»**, en las cinco pestañas y al final de la tabla:

| Qué | Cómo es |
|---|---|
| Al abrir la vacante | **Apagada.** Se enciende en «Columnas». Encendida por defecto se leería junto a la nota como si pesara en ella |
| Al recargar o cambiar de pestaña | **Vuelve apagada.** Como el resto de la elección de columnas, no se guarda: es la convención de la pantalla, no un fallo |
| La celda | «★ 4,5 (3)» —promedio con coma y cuántas—, o «—» sin reseñas visibles. Pulsarla abre la ficha de esa fila |
| Ordenar | Por promedio y, a igualdad, por cuántas; las «—» siempre al final. El tercer clic vuelve al orden del servidor |
| Quién la ve | Solo quien tiene `ver_resenas_candidato` con alcance en esa vacante: lo dice `puedeVerResenas` del ranking. Sin él la columna no existe y no cuenta como oculta |

**En la ficha del postulante**, al final y a lo ancho, en las cinco pestañas, hay dos bloques:

- **«La reseña de [Empresa]»**, el de la empresa autora. Sale solo si la postulación es
  `CONTRATADO` de la propia empresa y quien mira tiene `resenar_contratado` (`puedeResenar`).
  Tiene cinco estados: «Podrás dejar una reseña desde el [fecha]» (aún no toca); el formulario con
  estrellas —se eligen también con las flechas—, opinión de 30 a 1000 caracteres con su contador,
  el aviso de quién la verá y «Publicar reseña»; la reseña con «Editar» y «Borrar» y «Puedes
  cambiarla hasta el [fecha]»; «Ya no se puede cambiar»; y la reseña atenuada con «La plataforma
  la ocultó: [nota]». Si la persona ya respondió, editar avisa antes de guardar que se le
  avisará. Debajo de la respuesta, «Reportar la respuesta», con el estado del reporte cuando lo
  hay.
- **«Reseñas de empresas»**, el de lectura, para quien tiene `ver_resenas_candidato`: el resumen
  con el reparto, las dos más recientes y «Ver todas», con la misma ventana y los mismos filtros
  que el candidato, pero sin «Reportar» ni «Responder». Salen las de todas las empresas, la propia
  incluida, cada una con su autora y la respuesta de la persona debajo («Respuesta de [nombre]»).
  Sin ninguna, «Sin reseñas de empresas».

Si la carga falla, el bloque dice «No pudimos cargar las reseñas» con «Reintentar», y el resto de
la ficha sigue igual. Un 403 o un 404 aquí no pinta nada: es «no te toca verlo».

**Configuración › «Reseñas reportadas»** es de la plataforma y de nadie más: pide
`moderar_resenas` —solo el Administrador de la plataforma lo tiene, y el alta de empresas no lo
copia— **y** ser la plataforma. A cualquier otra empresa el backend le contesta 403 y la sección
ni se pinta. Tiene dos listas, «Pendientes (N)», de la más antigua a la más reciente, y
«Resueltas»; en las dos entran los reportes de reseñas —de la persona— y de respuestas —de la
empresa autora—. Cada tarjeta dice qué se reporta, empresa y persona, estrellas y textos —si se
juzga la respuesta, la reseña va encima de contexto—, motivo, comentario y fecha. «Mantener» y
«Ocultar» exigen las dos una «Nota de la revisión»; ocultar es definitivo. Lo retirado antes de
revisarse sale como «Retirada por la empresa» o «Retirada por la persona».

Dónde está: `ResenasDeLaFicha.tsx` y la columna en `ranking.ts` (`COLUMNAS_APAGADAS_AL_ABRIR`,
`comparadorDeResenas`), en `src/panel/vacantes/`; la moderación en
`src/panel/configuracion/ResenasReportadas.tsx`; y lo que comparten portal y panel —resumen,
tarjeta, ventana con filtros y selector de estrellas— en `src/ui/resenas/`.

Comprobarlo: `npx playwright test herramientas/e2e/41-resenas-de-empresas.spec.ts` (los
recorridos de punta a punta con una empresa), `42-resenas-entre-empresas.spec.ts` (la empresa B
leyendo, y el reporte de una respuesta) y `43-resenas-de-empresas-movil.spec.ts` (375 px, textos
de 1000 caracteres y nombres largos). ⚠️ **Los tres escriben**: siembran sus contrataciones
insertando la transición a `CONTRATADO` con fechas relativas a hoy, y lo retiran al terminar.
Necesitan las variables de [TRABAJAR-EN-LOCAL.md](TRABAJAR-EN-LOCAL.md). ⚠️ El 41 y el 42 repiten
número con `41-logotipo` y `42-selector-de-columnas`: ver [PENDIENTES.md](PENDIENTES.md).

### Gestión de personas: el menú lateral, los colaboradores y contratar (29/09)

El primer apartado de la ampliación de RR.HH.: la ficha de cada persona que trabaja en la
empresa, el mapa de la empresa (sedes, áreas, cargos y jefes) y contratar sin salir del panel.
El backend trae la `V64` y la `V65`; sus rutas, sus permisos y sus reglas están en `docs/` del
backend (`09-APIS.md`, «Gestión de personas», y `04-ROLES-Y-PERMISOS.md`, «Personas»).

**El armazón.** La barra de pestañas se fue: arriba queda una barra fina con la marca —sigue
siendo el enlace a `/admin` con nombre accesible «Panel del equipo, inicio»—, el nombre de la
empresa y el de la persona con «Salir». A la izquierda, el menú:

| Qué | Cómo es |
|---|---|
| Familias | **Selección** (Vacantes, Simulación, Pruebas), **Personas** (Colaboradores) y, al pie y separada, **Configuración**. Una familia sin entradas no sale, y no hay entradas de módulos futuros |
| Quién ve qué | Al entrar, el panel pide `GET /panel/sesion` (nombre, correo, empresa y permisos con su alcance) y pinta solo lo que cada uno puede usar, con los permisos que ya exigía cada pantalla. «Colaboradores» pide `ver_colaboradores` con alcance `TODO`. **El Administrador no ve «Vacantes»**, porque esas pantallas ya le daban 403. Si la sesión no carga, salen las cuatro entradas de siempre y el panel sigue funcionando. Es solo para pintar: quien decide sigue siendo el backend |
| Entrada activa | También en las rutas hijas: `/admin/vacantes/:id` y `/admin/archivadas` marcan «Vacantes»; `/admin/colaboradores/:id`, «Colaboradores» |
| Plegar | «Plegar menú» deja una columna de iconos; cada uno conserva su nombre accesible y lo enseña como tooltip. Se recuerda en ese navegador (`renaser_panel_menu_plegado`); sin almacenamiento, sale desplegado |
| Menos de 1024 px | El menú se oculta y «Menú», en la barra, lo abre como un cajón. Se cierra al elegir una entrada, con Escape o al tocar fuera; el foco no sale de él mientras está abierto y vuelve a «Menú» al cerrarlo |

Ninguna dirección de página cambió, y el nombre de la barra sale de la sesión: el de la
invitación queda de respaldo.

**Colaboradores** (`/admin/colaboradores`). Una tabla por apellidos, en páginas de 50 servidas por
el backend: nombre, documento, cargo, área y sede vigentes, jefe, ingreso, fin de contrato y
estado —«Por ingresar», «Activo» o «Cesado», calculados en hora de Lima—. El fin de contrato
lleva «vence en N días» a 30 días o menos, y «vencido» si ya pasó y la persona sigue activa,
explicando que entonces su contrato pasa a indefinido. Filtros: estado (por defecto Activos y Por
ingresar), sede, área, cargo, **«Contratos por vencer», que incluye los ya vencidos de personas
activas**, y la búsqueda por nombre o documento, con el contador «N colaboradores». Con
`editar_colaboradores`, «Nuevo colaborador» y «Cargar Excel». Arriba, si los hay, **«N personas
contratadas por selección esperan su alta»**: cada una con «Dar de alta» y «No dar de alta», que
pide un motivo.

**La ficha** (`/admin/colaboradores/:id`) tiene tres pestañas: **Perfil** (identidad, contacto,
domicilio y formación; «Editar» corrige sin historial), **Puesto y contrato** (la situación
vigente hoy, el periodo, los cambios programados con «Anular», y «Registrar un cambio» y
«Registrar el cese», o «Reingresar» y «Anular el cese» si está cesada) e **Historial** (cada
cambio como «antes → después», con motivo, quién y cuándo; los anulados, tachados). Si vino de
selección, la cabecera dice «Contratado por la vacante {título}», con enlace mientras la vacante
exista. **Sin `ver_sueldos` el sueldo no aparece en ninguna parte**, y un ajuste que solo toca el
sueldo no sale ni en «Cambios programados», ni en el historial, ni en el aviso del cese.

**El alta** (`/admin/colaboradores/nuevo`) es un formulario en tres bloques. Un documento que ya
tiene ficha se rechaza con un aviso que toma el foco y enlaza a esa ficha; si está cesada, lleva a
reingresarla. **La carga por Excel** es un panel en tres pasos —descargar la plantilla, subir el
archivo, ver el resultado—: es todo o nada, y si algo falla **la pantalla enseña todos los errores
en una tabla** (fila, columna, valor y qué pasa) sin haber guardado nada.

**Contratar, desde la ficha del postulante.** En la ficha que se despliega en el ranking sale
**«Contratar»** si el backend dice `puedeContratar`: la postulación no está terminada y quien
mira puede decidir la contratación sobre ella (Dirección y el responsable del área; Talento no),
en cualquier etapa. El modal «Contratar a {nombre}» dice la vacante y la etapa; fuera de Decisión
avisa de que cierra el proceso sin pasar por las etapas que faltan; pide un motivo y dice «No se
le envía ningún correo». Confirmar registra la decisión en verde y la postulación pasa a
Contratado; un error conserva el motivo. Después ofrece **«Dar de alta como colaborador»** con
`editar_colaboradores`, que abre el alta precargada con lo que ya se sabe (`?postulacion=`). Una
postulación ya contratada enseña «Dar de alta como colaborador» o «Ver su ficha de colaborador».

**Configuración › «Sedes» y «Cargos»**, junto a «Áreas» y con su mismo patrón. Las ve todo el
equipo; las acciones —añadir, editar o renombrar, desactivar y reactivar— solo con
`editar_estructura`. Los cargos son los puestos de siempre: renombrar uno avisa antes de que el
nombre cambia en todas partes, vacantes incluidas.

**Un formulario abierto no se pierde si la sesión caduca.** Los formularios de esta entrega
retienen la sesión (`useRetenerLaSesion`, en `src/panel/Sesion.tsx`): un 401 al guardar no salta a
«Entrar», sino que el formulario dice «Tu sesión caducó y esto no se guardó. Lo que escribiste
sigue aquí», con un enlace para entrar en otra pestaña y volver a guardar. Si se cierra sin
haber vuelto a entrar, entonces sí se va a «Entrar». Junto a eso, `src/panel/ui/Envio.tsx` da a
esos formularios un solo envío por clic (`useUnaVez`) y un aviso de fallo que toma el foco
(`AvisoDeFallo`), porque un botón desactivado al enviar suelta el foco fuera del modal.

Dónde está: `src/panel/Armazon.tsx` y `src/panel/menu.ts` (las reglas del menú, sin pintar
nada); `src/panel/colaboradores/`; `src/panel/configuracion/Sedes.tsx` y `Cargos.tsx`;
`src/panel/vacantes/ContratarDesdeLaFicha.tsx`; y `src/panel/ui/Envio.tsx`.

Comprobarlo: `npx playwright test herramientas/e2e/44-gestion-de-personas.spec.ts` (los siete
recorridos de la spec: el menú por rol, plegado y en cajón; el alta y el documento duplicado;
contratar y dar de alta; la carga con errores y la válida; cambios programados y su anulación; el
cese y el reingreso; y el sueldo oculto en pantalla y en la API) y
`45-gestion-de-personas-regresiones.spec.ts` (lo que encontró QA en el navegador). ⚠️ **Los dos
escriben**: siembran estructura, cuentas, vacantes, postulaciones y colaboradores con la marca `QA-PERSONAS-3E62`
o un DNI al azar y fechas relativas a hoy en Lima, y lo retiran al terminar. ⚠️ El 44 repite
número con `44-veredicto-solo-en-el-perfil`: ver [PENDIENTES.md](PENDIENTES.md).

### Las preguntas propias de cada vacante (30/09)

Hasta ahora, para que quien postula respondiera preguntas, alguien tenía que llenar un Excel con
los 15 formatos del método de RENASER. Desde el 30/09/2026 **cada empresa escribe, en el panel y
para cada vacante, las preguntas de su Perfil Integral**: cuatro tipos, agrupados en criterios con
nombre que suman 100 puntos. Es la **fase 1**; la fase 2 —la prueba técnica con el mismo
editor— llegó el 01/10/2026 y está en «La prueba técnica de cada vacante nueva», más abajo. El
backend trae la `V66`; sus rutas y reglas están
en `docs/` del backend (`09-APIS.md`, «Las preguntas propias de la vacante», y
`CALIFICACION-CON-IA.md`).

**De dónde salen las preguntas.** En el detalle de la vacante, dentro de «Qué responderá quien
postule», **«De dónde salen sus preguntas»** ofrece tres opciones:

| Opción | Cuándo sale |
|---|---|
| **Preguntas propias de esta vacante** | Siempre, y la primera. **Toda vacante nueva nace con ella marcada**, también en RENASER (decisión del usuario del 30/09/2026). Al lado, «Sus preguntas propias» dice cómo van —«Sin preguntas», «Borrador» o «Publicadas», con sus puntos— y «Escribir las preguntas →» lleva al editor |
| **El banco de la empresa para su nivel** | Solo si la empresa tiene uno **propio** publicado para ese nivel (`bancoDelNivelPropio`). A las demás no se les habla de un banco que no tienen |
| **El banco de RENASER para su nivel** | Solo en una vacante de antes que lo rinde prestado (`bancoPrestado`), con su nombre real. Si se elige otra opción, desaparece y no se puede volver a elegir |
| **Sin evaluación** | Siempre. Quien postule no responde preguntas: lo siguiente que rinde es la etapa técnica |

Cada elección se guarda al marcarla. **Desde la primera postulación no se puede cambiar**: el
servidor responde 409 con el motivo, y se enseña en el aviso común de la sección. Mientras se
guarda, las opciones no se apagan —con el teclado, cada flecha marca y guarda la siguiente, y un
radio desactivado soltaba el foco—: el cambio en vuelo simplemente se ignora. **Con preguntas
propias, la vacante no se publica hasta tenerlas publicadas**, y el cartel «Todo listo» y el botón
de publicar miran esa misma regla.

**El editor** (`/admin/vacantes/:id/preguntas`). Arriba, **el balance siempre a la vista**:
cuántos puntos van de 100, cuántos criterios y preguntas, y lo que frena la publicación. Queda
pegado justo debajo de la cabecera del panel al bajar (ver `--alto-cabecera-panel`, más abajo).
Debajo, un bloque por criterio —nombre, «qué evalúa» y sus puntos, que se suman solos— con sus
preguntas, cada una con su tipo y sus puntos:

- **Abierta**, con «Qué debe tener una buena respuesta», que solo lee la IA.
- **Opción única** y **opción múltiple**, con los puntos de cada opción; en la múltiple una opción
  puede restar.
- **Escala**, con sus niveles en orden, los puntos de cada uno y un rótulo opcional por nivel.

Quien no quiere pensar en criterios no está obligado: la primera pregunta sin criterio crea
«General». Se escriben además **la guía de calificación** para la IA y los **minutos estimados**, y
criterios y preguntas se ordenan con flechas. **El balance lo cuadra el servidor**: cada cambio
devuelve el editor entero y se pinta tal cual. **«Publicar las preguntas» con algo pendiente
enseña la lista entera de lo que falta** —la suma no da 100, una pregunta sin criterio…— para
arreglarlo de una pasada.

- **«Copiar de otra vacante»** abre las vacantes de la misma empresa con preguntas publicadas,
  con búsqueda por nombre y filtro por nivel, deja ver sus preguntas antes y, si ya hay un
  borrador, pide confirmar que lo reemplaza.
- **«Recomendaciones por IA»** completa lo que falta, no empieza de cero: antes de pedirla dice
  cuántos puntos va a proponer, y con el borrador en 100 no llama a nadie. La propuesta llega por
  sondeo; con la IA apagada o sin cupo se dice como un estado, no como un error. **Nada se agrega
  solo**: cada criterio y cada pregunta tiene «Agregar», y hay «Agregar todo».
- **Las publicadas se leen, salvo dos cosas que alcanzan a todos a la vez.** Los puntos: al
  guardarlos pide confirmar y **se recalcula a todos al instante, sin IA**. Y las instrucciones de
  la IA —la guía, el «qué evalúa» y el «qué debe tener»—: con «Sí, volver a calificar» **se vuelve
  a calificar a quien ya tenía nota**, y el editor cuenta cómo va, con «Reintentar» para quien se quedó con la guía anterior.
  Si la IA está apagada, la empresa suspendida o sin saldo, no se guarda nada y una ventana dice el
  motivo, **con el texto que manda el servidor**. Mientras nadie haya postulado, lo que se hace es
  abrir un borrador. Sin `editar_vacante` —o con la vacante cerrada o archivada— todo se ve en
  lectura: lo dice `puedeEditar` del propio editor.

**En la ficha del candidato**, dentro del Perfil Integral, cada criterio sale con su nota y de
dónde viene —«Conocimiento contable 24/30 · Sistema 8/10 + IA 16/20»—; al abrirlo, sus preguntas
con lo que respondió o marcó, lo que sacó y, en las abiertas, la explicación y la cita de la IA.
**Un criterio con una abierta sin calificar se ve pendiente, no con una nota parcial.** Quien tiene
`ajustar_nota` (lo dice `puedeAjustar` del desglose) ajusta una abierta —o la califica si la IA no
pudo— con motivo obligatorio; la nota de la IA se sigue viendo al lado, y **ajustar no mueve a nadie
de etapa**.

**En el listado de vacantes, la columna se llama «Evaluación»** y dice, en corto, lo que responde
quien postule: «Preguntas propias · Sin preguntas», «· Borrador» o «· Publicadas», «Banco de la
empresa por nivel», «Banco de RENASER por nivel» o «Sin evaluación». Antes decía «Evaluación del
banco · Encendida», también con preguntas propias, y como toda vacante nueva nace con ellas
engañaba en casi todas. El estado de las propias va en una pieza que no se parte: la celda es
estrecha y «Preguntas propias · Sin» / «preguntas» se leía como otra cosa.

**El armazón publica su alto.** La cabecera del panel es fija arriba, y lo que una pantalla quiera
pegar debajo —el balance del editor— necesita saber cuánto mide. `src/panel/altoDeLaCabecera.ts` la
**mide** y deja el resultado en `--alto-cabecera-panel`, en el padre de la cabecera, así que lo
heredan todas las pantallas del panel; se vuelve a medir al girar el teléfono o cambiar el ancho.
**Se mide, no se escribe**: un número fijo se queda viejo al cambiar la barra, que es lo que le
pasó a `--alto-cabecera` del portal.

⚠️ **La IA no se puede probar en el preview del harness**: corre sin cola de mensajes y con la
calificación apagada, así que las recomendaciones, la calificación de las abiertas y la
recalificación se prueban en el backend con el agente simulado, y en los e2e sembrando las notas
por SQL. Mirarlo de verdad pide un backend local con la cola y la IA encendidas.

Dónde está: `src/panel/vacantes/preguntas/` —`OrigenDeLasPreguntas.tsx`, `EditorDePreguntas.tsx`,
`PreguntasPublicadas.tsx`, `CopiarDeOtraVacante.tsx`, `Recomendaciones.tsx` y
`DesglosePorPuntos.tsx`—, `src/panel/api/preguntasPropias.ts`, la columna en
`src/panel/vacantes/Vacantes.tsx` y `src/panel/altoDeLaCabecera.ts`. El portal responde los cuatro
tipos en `src/paginas/evaluacion/Formatos.tsx` (ver
[02-QUE-VE-EL-CANDIDATO.md](02-QUE-VE-EL-CANDIDATO.md), «2.8 Evaluación»).

Comprobarlo: `npx playwright test herramientas/e2e/45-preguntas-propias.spec.ts
herramientas/e2e/46-preguntas-propias-qa.spec.ts
herramientas/e2e/47-preguntas-propias-calificacion.spec.ts`, junto con `14-vacante.spec.ts`. ⚠️
**Escriben**: siembran vacantes, cuentas y una segunda empresa con la marca `QA-PP-0553`, casi todo
por la API y por SQL solo lo que la API ya no deja crear —una vacante con el banco prestado— o lo
que la IA apagada no produce; al terminar retiran las cuentas y marcan eliminadas las vacantes.
Las unitarias, en `src/panel/vacantes/preguntas/*.test.*` y `Formatos.test.tsx`; en el backend,
`FlujoPreguntasPropiasIT`. ⚠️ El 45 repite número con `45-gestion-de-personas-regresiones`: ver
[PENDIENTES.md](PENDIENTES.md). Lo que QA dejó para decidir está en [PENDIENTES.md](PENDIENTES.md).

### La prueba técnica de cada vacante nueva (01/10)

Desde el 01/10/2026 **toda vacante nueva escribe su prueba técnica en el mismo editor** que sus
preguntas propias, también en RENASER. Las plantillas, el cuestionario CAZATALENTOS y la ficha ya
no se le ofrecen; **una vacante de antes sigue viendo lo de siempre**. Lo distingue
`instrumentoEtapaTecnica === 'PRUEBA_PROPIA'` (`rindeLaPruebaPropia`). El backend trae la `V67`; sus
rutas, en `docs/` del backend (`09-APIS.md`, «La prueba técnica escrita en el editor», y
`PRUEBA-DEL-PUESTO.md`).

**El bloque de la vacante.** En «Qué responderá quien postule», el bloque de la prueba **no tiene
nada que elegir**: ni «Qué rendirá en la etapa técnica», ni «Qué prueba del puesto rendirá», ni
«Cuánto tiempo tendrá», ni la tarjeta de la ficha. Enseña el estado —«Sin prueba», «Borrador · 70
de 100 puntos · 2 entregables», «Publicada · 5 criterios · 2 entregables · 90 min» o «Publicada ·
cuestionario · 12 preguntas · 30 min»— y «Armar la prueba →». «Pesos de la decisión» sigue igual.
**Publicar la vacante exige la prueba publicada**, y el cartel «Todo listo», el botón de publicar
y `loQueFaltaParaPublicar.ts` miran la misma regla (`usePruebaLista`).

**El editor** (`/admin/vacantes/:id/prueba`). Es el de las preguntas propias —bloques, balance,
publicadas, recomendaciones y copia— elegido con un modo (`preguntas/modo.tsx`: `MODO_PRUEBA`
cambia la ruta de la API, la clave de la consulta y los textos), más:

- **El caso**: enunciado (obligatorio si hay entregables), adjunto en PDF o Word, materiales y
  herramientas. **El tiempo**: cronometrada en minutos o plazo abierto en días, **sin cambio
  inesperado**.
- **Los entregables**: nombre, qué debe contener, formato, si es obligatorio y «Qué debe tener una
  buena entrega». Quitar uno que miran criterios pide confirmar y lo saca de sus «Mira».
- **En cada criterio, la parte calificada**: sus puntos, quién la califica (IA o persona) y «Mira»,
  una casilla por entregable. La cabecera dice «30 pts · sistema 10 + IA 20». **Las abiertas no
  llevan puntos**, solo su «Qué debe tener una buena respuesta».
- **Sin entregables es un cuestionario**: la cabecera y los textos lo dicen así, y el caso pasa a
  ser opcional.
- «Publicar la prueba» con algo pendiente enseña **la lista entera** del servidor. Hasta que
  alguien empiece a rendirla se puede abrir un borrador desde la publicada; desde entonces solo
  se cambian los puntos y las instrucciones de la IA, como en la fase 1. Sin `editar_vacante`, todo
  en lectura.

**La pestaña «Prueba» de la ficha** (`PruebaDelCandidato.tsx`, sobre
`GET /postulaciones/{id}/prueba-propia`): cada criterio con su nota y de dónde sale —«Sistema 8/10
+ IA 16/20» o «Sistema 8/10 + persona pendiente»—; al abrirlo, sus cerradas con la opción marcada,
sus abiertas y los entregables que mira; la explicación de la IA y quién ajustó, cuándo y por qué.
Arriba, la nota de la etapa o qué falta para tenerla. Quien tiene `ajustar_nota` (lo dice
`puedeAjustar`) ajusta o pone **solo la parte calificada**, de 0 a sus puntos y con motivo; si era
lo último que faltaba, la persona pasa a «por confirmar». No se mezcla con la rúbrica de las
plantillas (`CriteriosDeEtapa`).

**El ranking y el Excel.** Las columnas de criterio se agrupan por la **`clave`** que manda el
servidor (`prueba:<id>`, `banco:<id>`; `claveDeLaNota` en `ranking.ts`), no por el nombre: dos
«Comunicación» de dos vacantes no se juntan. Un criterio pendiente dice «pendiente» y uno de
persona sin nota queda en blanco. En «Perfil Integral», una vacante con preguntas propias suma una
columna por criterio de su banco junto a las del currículum. Mientras dure una recalificación, la
fila dice «Recalificando con la guía nueva», en las dos pestañas. «Las notas de la prueba, para la
tanda entera» (`LaTandaDeLaPrueba`) es solo de las plantillas y no sale en una vacante nueva.

**«No completaron la prueba (N)».** Quien dejó vencer el tiempo con algo sin responder o sin subir
no sale en el ranking ni en el Excel. Debajo del ranking de la prueba, una lista plegada
(`NoCompletaron.tsx`, por su propio endpoint) los nombra con lo que les faltó y el botón «Cerrar su
proceso», que es el descarte de siempre con su motivo. Si la lista falla —un permiso—, no sale y el
ranking sigue.

**La personalización de las pruebas ya no existe**: la pantalla de pruebas ya no le dice a una
empresa que «hay que personalizar las pruebas»; ahora le dice que las vacantes nuevas escriben la
suya en «Armar la prueba» (`src/panel/pruebas/borrador.ts`).

⚠️ **Lo visual lo comprueba el usuario**: el editor, la ficha y los rankings van detrás del inicio
de sesión del panel. Y la IA, como en la fase 1, se prueba con el agente simulado y sembrando sus
notas, no en el preview.

Dónde está: `src/panel/vacantes/preguntas/` —`PruebaDeLaVacante.tsx`, `EditorDeLaPrueba.tsx`,
`CriterioDePrueba.tsx`, `modo.tsx`—, `src/panel/vacantes/PruebaDelCandidato.tsx`,
`src/panel/vacantes/NoCompletaron.tsx`, `src/panel/api/pruebaPropia.ts` y la clave en
`src/panel/vacantes/ranking.ts`. El portal, en [02-QUE-VE-EL-CANDIDATO.md](02-QUE-VE-EL-CANDIDATO.md),
«2.9 Prueba del puesto».

Comprobarlo: `npx playwright test herramientas/e2e/48-prueba-del-puesto-con-el-editor.spec.ts
herramientas/e2e/49-prueba-del-puesto-con-el-editor-regresiones.spec.ts
herramientas/e2e/50-editores-de-la-vacante-rutas-comunes.spec.ts`. ⚠️ **Escriben** en el clon
y lo retiran al terminar (marca `QA-PE-0067`); el reloj se adelanta en la base y el barrido de 60 s
del backend cierra el intento, por eso «recorrido 6» de la 48 y «H-02» de la 49 se dan 3 minutos.
La 50 va solo por la API: recorre las rutas que comparten los dos editores —las preguntas propias y
la prueba— y las de la ficha con tres sesiones (quien edita, quien solo ve y otra empresa), para que
contesten igual en los dos. Las unitarias, en `src/panel/vacantes/preguntas/*.test.*`; en el
backend, `FlujoPruebaPropiaIT`.

---
