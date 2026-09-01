# Análisis para el rediseño del portal del candidato (EX)

Fecha: 23/08/2026 · Fuente: código de `RENASER-RECLUTAMIENTO` (backend) y `RenaserOsPostulantes` (portal actual)

Este documento responde una sola pregunta: **qué información puede ver el candidato, qué puede
hacer, y qué avisos tiene que recibir** — para poder maquetar sin adivinar.

---

## 1. El recorrido, en una línea

`Postular → Perfil Integral → Prueba del puesto → Simulación → Validación → Decisión`

Cinco etapas, dieciocho estados. El nombre de cada estado es `ETAPA_MOMENTO`, y el momento dice
**de quién se espera algo**. Para el candidato eso se reduce a tres situaciones:

| Termina en | Qué ve el candidato |
|---|---|
| `TURNO_CANDIDATO` | **Le toca a él.** Hay botón y hay algo que hacer |
| `CALIFICANDO` | La IA está trabajando. Solo se informa, y la pantalla se refresca sola |
| `POR_HABILITAR` / `POR_CONFIRMAR` | Espera a una persona de Renaser. Solo se informa |

**Solo 5 de los 18 estados dan trabajo al candidato.** Los otros 13 son pantallas de espera. Ese
desequilibrio es el problema de diseño central: hoy las trece esperas se pintan igual que las
cinco acciones y el candidato no distingue "tengo que hacer algo" de "no tengo que hacer nada".

### Los 18 estados y lo que le toca al candidato

| Estado | Etapa | ¿Le toca? | Destino |
|---|---|---|---|
| `POSTULADA` | Perfil | No (sistema) | — |
| `PERFIL_TURNO_CANDIDATO` | Perfil | **Sí** | Evaluación |
| `PERFIL_CALIFICANDO` | Perfil | No (sistema) | — |
| `PERFIL_POR_CONFIRMAR` | Perfil | No (equipo) | — |
| `PRUEBA_TURNO_CANDIDATO` | Prueba | **Sí** | Prueba del puesto **o** cuestionario técnico — lo dice la vacante, ver 2.9b |
| `PRUEBA_CALIFICANDO` | Prueba | No (sistema) | — |
| `PRUEBA_POR_CONFIRMAR` | Prueba | No (equipo) | — |
| `SIMULACION_POR_HABILITAR` | Simulación | No (equipo) | — |
| `SIMULACION_TURNO_CANDIDATO` | Simulación | **Sí** | Elegir fecha / ver la sesión |
| `SIMULACION_POR_CONFIRMAR` | Simulación | No (equipo) | — |
| `VALIDACION_POR_HABILITAR` | Validación | No (equipo) | — |
| `VALIDACION_TURNO_CANDIDATO` | Validación | **Sí, pero sin pantalla** | ⚠️ hoy lleva al detalle del proceso |
| `VALIDACION_POR_CONFIRMAR` | Validación | No (responsable) | — |
| `DECISION_TURNO_CANDIDATO` | Decisión | **Sí, pero sin API** | ⚠️ pantalla informativa, sin formulario |
| `DECISION_POR_CONFIRMAR` | Decisión | No (responsable) | — |
| `CONTRATADO` | — final | No | Resultado |
| `NO_CONTINUA` | — final | No | Resultado |
| `CERRADA` | — final | No | Resultado |

### ⚠️ Hay dos caminos, no uno

Cada vacante decide si aplica la evaluación del banco (`vacante.aplica_evaluacion`). Eso parte el
recorrido en dos experiencias distintas desde el primer minuto:

| | Camino A · con evaluación | Camino B · sin evaluación (vacante Administrador) |
|---|---|---|
| Al postular cae en | `PERFIL_TURNO_CANDIDATO` | **`PERFIL_POR_CONFIRMAR`** |
| Lo primero que ve | Una evaluación que responder | **Una pantalla de espera, sin ninguna acción** |
| Quién mueve la ficha | Él mismo | El equipo, cribando currículums |
| Su única evaluación | Evaluación + prueba | Solo la prueba (que vale por las dos etapas) |
| Forma de la prueba | Reto con entregables | Cuestionario de 20 preguntas, sin entregables |

**El camino B es el peor caso del portal:** el candidato envía su postulación y la primera
pantalla que ve no tiene nada que hacer. Si el diseño no cuida ese momento, la primera impresión
es un callejón sin salida.

---

## 2. Pantalla por pantalla: qué datos existen de verdad

Todo sale de los `record` de Java (`DtosPortal`, `DtosEvaluacion`, `DtosPrueba`, `DtosSimulacion`).
Lo que no está aquí, **el backend no lo manda**.

### 2.1 Portada · vacantes abiertas — pública, sin cuenta
`GET /portal/vacantes`

Por vacante: `id`, `titulo`, `descripcion`, `proposito`, `responsabilidades`, `requisitos`,
`modalidad`, `horario`, `ubicacion`, `compensacionPublica`, y la lista de `requisitosObjetivos`
(`id` + `descripcion`).

Casi todos los campos son **texto libre con saltos de línea**, y varios pueden venir en nulo. El
maquetado tiene que aguantar tanto una vacante con tres campos llenos como una con diez.

### 2.2 Ficha de la vacante — pública
`GET /portal/vacantes/{id}` · los mismos campos, más las etapas del proceso (texto de producto,
no dato del backend).

**Acción única:** postular. Si no hay cuenta, lleva a crearla recordando a qué vacante.

### 2.3 Crear cuenta — pública
`POST /portal/cuentas` — `nombre`, `apellidos`, `correo`, `contrasena` (mín. 8),
`aceptaProceso` (obligatorio), `aceptaFuturosContactos` (opcional).

`GET /portal/consentimientos/textos` devuelve los textos vigentes (`tipo`, `version`, `texto`).

⚠️ **Los textos de consentimiento van a crecer.** Hoy no nombran a ningún tercero, y el backend
marca como urgente que nombren a DeepSeek y Google antes del primer candidato real. El bloque de
consentimientos necesita sitio para un texto bastante más largo que el actual: dos casillas, dos
textos, uno obligatorio y otro opcional.

### 2.4 Entrar — dos caminos, no uno
| Camino | Ruta | Quién lo usa |
|---|---|---|
| Correo + contraseña | `POST /portal/auth/login` | Quien se registró en el portal |
| **Enlace del correo, sin contraseña** | `POST /portal/auth/acceso` | **Quien fue cargado desde una carpeta de CVs: no tiene contraseña** |

El segundo no es un caso raro: es la vía normal para toda una tanda de candidatos. Cualquier
diseño cuya historia de entrada sea solo "correo y contraseña" deja fuera a ese grupo.

Errores que la pantalla tiene que saber pintar: **401** (mismo texto si el correo no existe o si
la contraseña es otra) y **429** con `Retry-After` y `segundosDeEspera` tras 5 intentos.

⚠️ **El backend no dice cómo se llama el candidato.** El login devuelve `{ token, usuarioId }` y
nada más. El nombre solo se conoce si se registró en ese mismo navegador. Un diseño construido
sobre "Hola, {nombre}" se degrada en silencio.

### 2.5 Postular — con cuenta
`POST /portal/postulaciones` (multipart): `cv` (PDF o Word, máx. 10 MB), `resultadoOrgulloso`
(texto obligatorio), `portafolio`/`linkedin`/`github` (opcionales), y `requisitosConfirmados`.

⚠️ **La confirmación de requisitos es el único descarte automático del sistema.** Un requisito
activo sin confirmar cierra la postulación en el acto (`NO_CONTINUA`). Tiene que leerse como una
decisión seria, no como una casilla más del formulario.

### 2.6 Mis procesos — el centro del portal
`GET /portal/postulaciones` → por postulación: `uuid`, `vacante`, `estado`, `estadoNombre`,
`grupoPrioridad`, `diasSinCambio`, `creadoEn`.

🚫 **`grupoPrioridad` llega en la respuesta y NUNCA debe pintarse.** Es la clasificación interna
del equipo. Debe seguir prohibido después del rediseño.

Lo que hay que resolver aquí: separar visualmente **lo que le toca** de las esperas, y que el
candidato entienda `diasSinCambio` sin que parezca abandono.

### 2.7 Detalle de una postulación
`GET /portal/postulaciones/{uuid}` → el resumen anterior más `historial`: una lista de
`estadoAnterior`, `estadoNuevo`, `fueElSistema`, `ocurridaEn`.

Es historial **real**, no inventado. Se puede pintar como línea de tiempo.

**Acción:** retirarse (`POST .../retiro`). Retirarse ≠ borrar datos: son cosas distintas y hay
que decirlo.

### 2.8 Evaluación (Perfil Integral) — la pantalla difícil
`GET /portal/evaluacion/{uuid}` → `estado`, `venceEn`, `iniciadaEn`, `terminadaEn`,
`minutosObjetivo`, `total`, `respondidas`, y **todas las preguntas de golpe**.

**Las cifras reales:** el banco v3 tiene 190 ítems en total, pero **cada candidato responde solo
los de su nivel: entre 50 y 85** (85 directivo, 55 coordinación, 50 operativo). No se muestrea y
**no se baraja**: se aplica el banco completo del nivel, en el orden del documento (ese orden
separa los pares de consistencia). El plazo por defecto son **14 días**.

⚠️ **El número lo manda el backend en `EvaluacionCandidato.total`.** Nunca una constante: un
examen de 50 y uno de 85 se recorren igual, pero el maquetado no puede dar por hecho ninguno.

**Ocho formatos de respuesta**, y solo dos son "marca una opción" o "escribe un texto":

| Formato | Cómo se responde | Qué se manda |
|---|---|---|
| `PC` | Una opción | `opcionId` |
| Abierta / `V` | Texto | `texto` |
| `EF-4` | Marca la que **más** y la que **menos** se le parece | `{mas, menos}` |
| `SJT-R` | Califica **cada** opción del 1 al 5 | `{calificaciones}` |
| `SEC` | **Ordena** cinco pasos | `{orden}` |
| `INV` / `DE` | Marca varias (ninguna también es respuesta) | `{marcadas}` |
| `CD` | Rellena N campos, cada uno con su etiqueta | `{campos}` |

Los `CD` traen `casosPedidos` (cuántas casillas) y `campos` (qué pide cada una).

Reglas duras que el maquetado no puede romper:
- **Se puede volver atrás y corregir.** El backend acepta guardar en cualquier orden.
- **Se retoma.** Nadie responde 190 ítems de una sentada: las respuestas vuelven al recargar.
- **Lo escrito no sale de la cola hasta que el servidor confirma**, se reintenta cada 5 s, se
  dice cuántas quedan sin guardar y **no se deja entregar mientras quede alguna**.
- **Una pregunta en blanco está "sin responder", no "guardada".** Ningún indicador fijo.
- Máximo 20 000 caracteres por respuesta (`@Size` del backend).
- El backend **rechaza entregar una evaluación incompleta**.
- 🚫 Nunca viaja al navegador: puntaje de cada opción, lógica interna, dimensión medida.

⚠️ **Los días que quedan tienen que verse mientras se responde, no solo antes de empezar**
(31/08/2026). El plazo son 14 días y esta pantalla se retoma muchas veces: si `venceEn` solo
se pinta en la portada, hay dos semanas en las que el candidato tiene que **salir del examen**
para saber cuánto le queda. Va en la línea de servicio, junto a «Pregunta 2 de 55», donde se
mira de reojo sin interrumpir.

⚠️ **Y se apaga en la última hora**, que es cuando entra el aviso de «Queda poco plazo» con su
cuenta atrás. Dos relojes a la vez —«hoy» y `00:42:17`— se leen peor que el segundo solo, y ese
mismo corte deja fuera los textos de plazo que ahí no encajan: «vencida» y «sin plazo».

**De aquí salen las quejas reales.** Una pregunta por pantalla dejó a un candidato saltando de la
50 a la 10 sin forma de volver, y por eso hoy existen el mapa de preguntas, "siguiente sin
responder" y "volver a la 50". Es el punto donde el candidato se pierde.

### 2.9 Prueba del puesto — **dos formas incompatibles en una sola pantalla**
`GET /portal/prueba/{uuid}` → `estadoIntento` (`PENDIENTE`|`EN_CURSO`|`ENTREGADA`), `modalidad`,
`iniciadoEn`, `venceEn`, `duracionMinutos`, `enunciado`, `materiales`, `herramientasPermitidas`,
`cambioTexto`, `preguntas[]`, `entregables[]`.

| Forma | Cómo se reconoce | Qué se ve |
|---|---|---|
| **Cuestionario** (vacante Administrador) | `entregables` llega **vacío** (lista, nunca nula) | 20 preguntas y nada más |
| **Reto con entregables** | `entregables` no vacío | Enunciado, materiales, herramientas, preguntas, entregables y el cambio inesperado |

El mismo layout tiene que servir para las dos. Hoy la pantalla pinta secciones que en el
cuestionario quedan vacías.

Reglas:
- **El cronómetro es del servidor.** Sale de `venceEn`, corregido por el desfase de reloj. Empieza
  al confirmar y **no se detiene al cerrar la página** — hay que avisarlo antes de arrancar.
- ⚠️ **`duracionMinutos` y `venceEn` NO son excluyentes** (31/08/2026). Esto es **otro eje**, sin
  relación con las dos formas de arriba: aquella partición es por `entregables`, y esta es por
  cómo se acaba el tiempo — cualquiera de las dos formas puede traer uno de los plazos o los dos.
  Los minutos los trae el instrumento y cuentan desde que se confirma; `venceEn` es el cierre de
  la convocatoria y es el mismo para todos. Cuando llegan los dos **rige el que caiga antes**, y
  lo resuelve el servidor al arrancar el intento. Antes de empezar hay que decir **los dos y
  cuál acorta a cuál**: enseñar solo los minutos deja a quien abre a las 17:40 con cierre a las
  18:00 leyendo noventa minutos cuando tiene veinte. Sin `venceEn` no se inventa ninguna fecha.
- **El cambio inesperado no lo dispara el navegador**: `cambioTexto` llega en nulo hasta que el
  backend decide mostrarlo. La pantalla consulta cada pocos segundos.
- **Los entregables son una lista**, cada uno con `nombre`, `detalle`, `formato`, `esObligatorio`,
  `entregado`. Se sube archivo **o** enlace, por rutas distintas.
- Entregar exige todos los obligatorios; la respuesta dice cuántos `faltantes`.
- Misma cola de guardado que la evaluación.
- Hay un minuto de gracia: el backend sigue diciendo `EN_CURSO` aunque `venceEn` ya pasó, porque
  quien cierra el intento es un barrido que corre cada minuto. La pantalla tiene que detectarlo.
- La consigna llega como texto libre con párrafos y direcciones dentro.


### 2.9b Cuestionario técnico — la OTRA forma de esa misma etapa (30/08/2026)

`GET /portal/cuestionario-tecnico/{uuid}` → `estado`, `iniciadaEn`, `terminadaEn`, `venceEn`,
`minutosObjetivo`, `total`, `respondidas`, `preguntas[]`.

**No es una variante de 2.9: es un instrumento distinto, y cada vacante rinde uno de los dos.**
La vacante lo dice en `instrumentoEtapaTecnica`, que viaja con la postulación
(`PLANTILLA` | `CUESTIONARIO_TECNICO`).

| | Prueba del puesto (2.9) | Cuestionario técnico |
|---|---|---|
| Qué se entrega | Archivos y enlaces | **Nada: se contesta escribiendo** |
| De dónde salen las preguntas | Una plantilla reutilizable | Escritas por la IA **para esa vacante** |
| Cuándo arranca el reloj | Al confirmar | **Al abrir la prueba** |
| Quién pone la nota de etapa | El equipo, ponderando la rúbrica | El método, sola |

⚠️ **Los dos comparten los mismos estados.** `PRUEBA_TURNO_CANDIDATO` no basta para saber a
qué pantalla llevar a nadie: hace falta el instrumento. Sin ese dato se trata como la prueba de
siempre, que es lo que hacían todas las vacantes.

⚠️ **La pregunta presencial no se le envía.** Para DIRECCION son doce escritas y once rendidas:
la muestra de trabajo se hace en persona.

Reglas:
- **El reloj lo fija la vacante** y arranca al abrir. Antes de empezar se le dice cuánto tendrá.
- **Lo escrito no se da por guardado hasta que el servidor lo confirma**, con la misma cola que
  la evaluación del banco. Una pregunta en blanco está *sin responder*, no «guardada».
- **No se entrega a medias**, y entregar pregunta antes: después ya no se toca.
- **Al entregar se sale de la pantalla** al detalle del proceso, que pasa a decir «Estamos
  calificando tu prueba».

### 2.10 Simulación
`GET /portal/simulacion/{uuid}/sesiones` → fechas con `fechaHora`, `duracionMinutos`, `modalidad`,
`lugar`, `enlace`, `plazasLibres`.
`POST .../sesiones/{sesionId}` para elegir.
`GET /portal/simulacion/{uuid}` → la sesión elegida, con sus `tramos` (código, nombre, minuto de
inicio y de fin) y el `enunciado`.

Son **dos pantallas en una ruta**: elegir fecha, y —ya inscrito— la agenda de la sesión.

🚫 No viaja la matriz de información crítica: es justo lo que se espera que el candidato descubra
o pregunte por su cuenta.

⚠️ Las plazas se agotan y las sesiones se cancelan **desde fuera**: la postulación puede volver
sola a `SIMULACION_POR_HABILITAR`. La pantalla tiene que aguantar quedarse sin fechas.

### 2.11 Validación — sin pantalla propia
`VALIDACION_TURNO_CANDIDATO` tiene botón ("Ver detalle") que **lleva al mismo sitio donde ya
está**. No hay endpoint de portal para la validación: ni métricas, ni días restantes, ni el
responsable. El rediseño tiene que decidir qué se enseña aquí en vez de heredar el placeholder.

### 2.12 Decisión ámbar — sin API
`DECISION_TURNO_CANDIDATO` existe en el backend, pero **no hay ninguna ruta en `/api/v1/portal`**
para leer qué evidencia se pide ni para enviarla. Hoy la pantalla explica la situación y remite a
un correo. Es una decisión de producto pendiente: o se pide la ruta al backend, o el diseño asume
que ese contacto se hace fuera del portal.

### 2.13 Privacidad — tres cosas distintas que se confunden
| Acción | Ruta | Qué hace |
|---|---|---|
| Retirar una postulación | `POST /postulaciones/{uuid}/retiro` | Sale de **esa** vacante. No borra datos |
| Retirar futuros contactos | `POST /consentimientos/futuros/retiro` | Sale del radar de talento |
| Pedir borrado de datos | `POST /solicitudes-borrado` | Borra todo |

Se parecen y no son lo mismo. Es un sitio donde el candidato se equivoca si el diseño no las
separa con claridad.

---

## 3. Qué es público y qué no (frontera del backend)

`ConfiguracionSeguridad` deja abierto **sin token**: `GET /portal/vacantes/**`,
`GET /portal/consentimientos/textos`, `POST /portal/cuentas`, `POST /portal/auth/login`,
`POST /portal/auth/acceso`. **Todo lo demás exige token de candidato.**

Traducido al layout: se puede navegar vacantes, leer una ficha completa y leer los textos legales
sin cuenta. Cualquier cosa del proceso propio exige entrar.

Y una regla de errores que afecta a lo que se pinta: **404 también significa "esto no es tuyo"**.
La evaluación y la prueba nunca responden 403 a propósito — decirlo ya confirmaría que existe.

Única excepción: las tres rutas de **simulación** sí exigen el permiso `elegir_sesion_simulacion`,
que la semilla `V18` da al rol `CANDIDATO` con alcance `PROPIO`. Con la base bien sembrada nunca
falla, pero el 403 es posible y las pantallas de simulación deberían saber pintarlo.

---

## 4. Lo que hay que arreglar en el rediseño

| # | Problema de hoy | Por qué importa |
|---|---|---|
| 1 | 13 estados de espera se pintan igual que las 5 acciones | El candidato no sabe si tiene algo que hacer. En el camino B, la **primera** pantalla tras postular ya es una espera |
| 2 | 50–85 ítems, una pregunta por pantalla, sin vista de conjunto natural | Es la queja real que ya llegó |
| 3 | La prueba tiene dos formas y un solo layout | En el cuestionario sobran secciones vacías |
| 4 | Validación y Decisión con botones que no llevan a nada | Prometen una acción que no existe |
| 5 | Tres acciones de privacidad que suenan iguales | Riesgo de borrar datos por error |
| 6 | "Te avisaremos por correo" | ⚠️ El correo sale con `transporte: log` **por defecto**: hoy no sale. Es una promesa que el sistema puede no cumplir |
| 7 | El saludo depende de un nombre que puede no existir | Se degrada en silencio en otro navegador |
| 8 | Consentimientos con poco sitio | Van a crecer al nombrar a DeepSeek y Google |

---

## 5. Estado del portal actual (qué se conserva y qué se tira)

**Lo único que sobrevive como archivo:** el nombre **EX** y el **logotipo**
(`src/ui/Marca.tsx`) — la palabra EX con la hormiga dentro de la X, incluida la variante en
champagne. Todo lo demás se puede borrar: CSS, páginas, armazón, capa de datos, componentes.

**Pero cinco comportamientos hay que reimplementar**, cada uno porque saltarlo ya costó un fallo
real. Los archivos pueden morir; estas reglas no:

| Regla que el rediseño hereda | Por qué |
|---|---|
| **Una sola fuente para los 18 estados** | Si cada pantalla decide qué enseñar, añadir un estado obliga a tocarlas todas |
| **La hora la manda el servidor** | El cronómetro sale de `venceEn` menos el desfase de reloj. Si cuenta el navegador, se falsea cambiando la hora del equipo |
| **Lo escrito no sale de la cola hasta que el servidor confirma** | Se validó con uno de cada cinco guardados cayendo: antes se perdían 4 de 20 respuestas, después llegaban las 20 |
| **Ningún indicador fijo de "guardado"** | Tiene que salir de comparar con el servidor. Y en blanco es "sin responder", no "guardada" |
| **Las 8 formas de respuesta del banco v3** | La forma exacta de lo que se envía la valida el backend (`ValidadorDetalleV3`) y responde 400 si no cuadra |

Dos trampas técnicas que también hay que respetar aunque se reescriba todo: los errores del
backend llegan como `application/problem+json` (comprobar con `includes('json')`, no
`'application/json'`, o se pierde el mensaje del servidor), y hay que mirar el **estado** de la
respuesta antes que el cuerpo.

**Modo claro:** ya está forzado en `src/app/Tema.tsx` (el interruptor se quitó porque el oscuro
tenía texto del color del fondo). Falta limpiar: `index.html` todavía abre con
`data-theme="dark"` y `color-scheme: dark light`, y `variables.css` conserva el bloque oscuro
entero. En el rediseño desaparecen el bloque `html[data-theme="dark"]` y `ProveedorTema`, y el
champagne queda en un solo valor (`#816220`, 5,1:1 sobre fondo hueso).

Nota: el `CLAUDE.md` del portal dice que el tema oscuro es el de la marca y que abre en oscuro —
está desactualizado, el código ya fuerza claro.

---

## 6. Propuesta: en qué deberían diferenciarse las 3 variaciones

El layout de la portada o del formulario de registro tiene poco margen. Donde de verdad se decide
si el candidato se pierde es en dos sitios, y ahí deberían separarse las variaciones:

1. **Cómo se recorren los 50–85 ítems** de la evaluación: una por pantalla con mapa · por bloques
   agrupados · lista con progreso fijo.
2. **Cómo el centro del portal separa "te toca a ti" de las 13 esperas**: panel destacado ·
   bandeja de tareas · línea de tiempo del proceso.
3. **Qué se le enseña a quien no tiene nada que hacer** (camino B, y las 13 esperas en general):
   una espera puede ser una pantalla vacía con un mensaje, o el sitio donde se le cuenta qué viene
   después y cómo prepararse.

Si las tres variaciones solo cambian dónde va la cabecera, no responden a la pregunta que
importa.
