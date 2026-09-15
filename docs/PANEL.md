# El panel del equipo (`/admin`)

Qué es, cómo se entra, qué enseña cada pestaña y qué exige el backend antes de publicar una
vacante. El recorrido de los dos lados —equipo y candidato— está en
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
  id. Y `POST /vacantes/{id}/cierre-prueba` contesta 400 **en inglés** si la vacante no tiene
  versión elegida. Se enseña lo que existe, como hizo el portal con la decisión ámbar.
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

Verificarlo entero: `npx playwright test herramientas/e2e/13-etapas.spec.ts`
(Chrome visible, solo lee).

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

**Y a varios a la vez, desde la mesa de la tabla (11/09).** Junto a «Avanzar a N personas» hay
ahora «Descartar a N personas»: las mismas casillas, el mismo motivo. Por eso el campo dejó de
llamarse «motivo del avance» —con el descarte al lado, ese nombre haría escribir un motivo de
avance para acabar cerrando a seis personas con él—.

⚠️ **El botón del lote NO actúa al pulsarlo**, al revés que el de avanzar: abre una ventana con
los nombres escritos. El error real no es equivocarse de botón, es llegar con alguien marcado de
una pestaña anterior, y la cifra sola no lo enseña. Va uno a uno; quien falle sale nombrado y no
frena a los demás, así que la ventana promete «hasta N» correos.

**La casilla «avisar por correo»**, en los dos sitios y encendida de salida, permite descartar
sin que le llegue nada al candidato — para cuando ya se habló con esa persona por otro lado. Se
manda como `avisar: false`; el backend calla solo el correo y **deja escrito que no se avisó**,
en el motivo del historial y en la auditoría.

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

---
