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
`ciudadUbigeo` (obligatorio desde el 01/09/2026), `aceptaPlataforma` (obligatorio),
`aceptaFuturosContactos` (opcional).

`aceptaPlataforma` se llamaba `aceptaProceso` hasta la V54 del backend. Cambió con el nombre
lo que se firma: antes era el texto de una vacante —que habla de «esta vacante» cuando en el
registro todavía no hay ninguna— y ahora es el de la **plataforma**, el permiso con Renaser
que cubre la cuenta, el perfil, la IA y los proveedores. El de cada empresa se firma al
postular, en su formulario.

**Dos casillas, y esta pantalla ya no pide ningún texto al backend** (15/09/2026). Cada casilla
lleva **un título corto y un enlace**: «Acepto el tratamiento de mis datos», con un enlace a
`/politica-de-privacidad#el-texto-que-aceptas`, y «Quiero que me avisen de futuras vacantes».
Antes cada una traía el texto legal entero plegado bajo un «Leer el texto completo», con su
propio scroll: **ese plegable se quitó**. Nadie lee un documento de miles de caracteres dentro de
una caja en un formulario, y lo que hace todo el mundo es casilla más hipervínculo. Con eso se
fue también la llamada a `GET /portal/consentimientos/textos` desde el registro — una petición
menos en el peor sitio para esperar.

⚠️ **Al acortar la explicación, todo el peso informativo pasó al enlace.** La versión anterior
nombraba ahí mismo la inteligencia artificial y los proveedores de fuera del Perú, que es la
primera capa del aviso por capas: lo que hace defendible que el resto viva detrás de un enlace.
Se acortó a una línea por decisión de producto. **Si ese enlace se rompe o la política se
recorta, el consentimiento deja de estar informado** aunque la casilla siga ahí. Es lo primero
que hay que mirar antes de tocar cualquiera de los dos.

**Otros retoques del mismo día**: se quitaron las ayudas de campo del correo y de la ubicación,
la bajada bajo el título solo sale cuando se llega desde una vacante —ahí dice algo, que la
postulación no se pierde—, y la etiqueta «Dónde vives» pasó a «Ubicación» (el 17/09 pasó a
**«Ciudad»**; ver más abajo). Las ayudas de campo siguen quitadas.

⚠️ **Los textos siguen sin revisión de un abogado.** Lo que cambió es que ya no falta
información; falta la firma. Y **quien creó su cuenta antes del 14/09 nunca firmó el texto
nuevo**: la migración no toca las aceptaciones ya hechas y no hay ninguna pantalla de
re-aceptación. Si algún día se decide pedírsela, es pantalla nueva y no existe.

**Ciudad (01/09/2026; «Dónde vives» hasta el 15/09, «Ubicación» hasta el 17/09).**
`ciudadUbigeo` es el ubigeo
de nivel 2 —la provincia— o `EXT` si
vive fuera del Perú, y el backend lo valida contra su catálogo: un código que no exista sale con
400. Las opciones llegan de `GET /portal/catalogos/ubigeo`, ya ordenadas por departamento y
nombre, con `departamento` en nulo únicamente en `EXT`.

⚠️ **Que es obligatorio se dice antes de pulsar, no al rebotar (17/09/2026).** La etiqueta lleva
un **asterisco** pegado al nombre del campo y el desplegable va con `aria-required`. Hacía falta
porque un `<select>` cuya primera opción es un texto de ayuda se lee como si ya hubiera algo
elegido: quien no lo tocaba se enteraba al enviar. Esa primera opción vale `''` y **no cuenta
como elección**; si falta, el formulario no se manda y el campo se marca con **«Selecciona tu
ciudad»** —la frase exacta que pidió el cliente, sin punto final— sin perder nada de lo ya
escrito. Al elegir una ciudad el aviso se retira, y «Fuera del Perú» es una elección válida como
cualquier provincia.

**La marca es de todo el formulario, no solo de Ciudad (17/09/2026).** Llevan asterisco los siete
controles que el esquema exige —nombre, apellidos, correo, contraseña, repetir contraseña, ciudad
y el permiso de tratamiento de datos—; el permiso de avisos de futuras vacantes se queda sin él y
sigue diciendo «· opcional» con todas sus letras, porque «no tiene asterisco» no es algo que
nadie note. Entre el resumen de errores y el primer campo va una línea que lo explica: «Los
campos con \* son obligatorios.» Ahí y no más arriba: cuando hay algo que corregir, lo primero
que hay que leer es cuántos datos faltan.

⚠️ **La lista de obligatorios se deduce del esquema `Datos` de zod, no se escribe a mano**: un
campo lleva asterisco si su valor vacío (`''`, o `false` en las casillas) no pasa su validación.
Si mañana una validación se afloja, la marca se va sola; una lista escrita aparte habría acabado
diciendo que algo es obligatorio cuando ya no lo es.

⚠️ **El asterisco no es la única señal, y no es para todo el mundo.** Va con `aria-hidden` —un
`*` a solas se oye como «asterisco» o no se oye— y detrás viaja la palabra «obligatorio»,
escondida a la vista y dentro de la etiqueta, para que entre en el nombre del campo. El estado de
verdad lo dice `aria-required` en el control. Lo que se anuncia al llegar al campo es, por
ejemplo, **«Ciudad obligatorio»** —el asterisco no entra, porque va oculto—, y así se comprobó
sobre el árbol de accesibilidad real, no solo leyendo el marcado. Consecuencia para las pruebas:
el texto de la etiqueta ya no es «Nombre» sino «Nombre * obligatorio», así que se busca por
expresión (`/^Nombre/`) y no por texto exacto.

En pantalla es **un solo desplegable nativo con las 196 provincias agrupadas por departamento**,
no dos encadenados: encadenar dos obliga a esperar una petición entre el primero y el segundo
para preguntar una sola cosa. «Fuera del Perú» va suelto al final, fuera de todo `optgroup`,
porque no cuelga de ningún sitio del Perú y es donde se busca.

⚠️ **El catálogo se pide sin token, y no es un descuido**: lo consulta justamente la pantalla
que todavía no tiene ninguno. Y si no carga, se dice con palabras: el campo es obligatorio, así
que un desplegable apagado y mudo deja a la persona pulsando «Crear cuenta» contra un error que
no explica nada. Desde el 17/09 hay además un botón **«Volver a cargar las ciudades»** debajo del
campo: antes el aviso decía «recarga la página», que con el formulario a medias es pedirle
escribirlo otra vez por un fallo que no es suyo. Sin lista no se crea la cuenta — el fallo del
catálogo no abre la puerta a un registro sin ciudad.

⚠️ **Se pregunta una vez y nunca más.** A quien ya tiene cuenta no se le pide jamás, ni al
postular ni después: esta pantalla es el único sitio del producto por donde entra el dato.
Consecuencia directa, y hay que contar con ella: **ninguna postulación anterior a esa fecha trae
ciudad**. Quien la use en el panel tiene que decir que no la hay, en vez de enseñar una columna
de guiones.

### 2.4 Entrar — dos caminos, no uno
| Camino | Ruta | Quién lo usa |
|---|---|---|
| Correo + contraseña | `POST /portal/auth/login` | Quien se registró en el portal |
| **Enlace del correo, sin contraseña** | `POST /portal/auth/acceso` | **Quien fue cargado desde una carpeta de CVs: no tiene contraseña** |

El segundo no es un caso raro: es la vía normal para toda una tanda de candidatos. Cualquier
diseño cuya historia de entrada sea solo "correo y contraseña" deja fuera a ese grupo.

Errores que la pantalla tiene que saber pintar: **401** (mismo texto si el correo no existe o si
la contraseña es otra) y **429** con `Retry-After` y `segundosDeEspera` tras 5 intentos.

El login devuelve `{ token, usuarioId, nombre, apellidos }` desde el 05/09/2026, y lo mismo el
acceso por enlace. Los dos nombres pueden venir vacíos —`persona` los admite en null—, así que
un «Hola, {nombre}» sigue necesitando su caso sin nombre.

⚠️ **Y hace falta el otro camino: `GET /portal/auth/sesion`.** El portal solo entra una vez; a
partir de la segunda visita arranca de un token guardado y nadie le ha dicho el nombre. Sin ese
endpoint, la cabecera del perfil decía «Tu perfil» sobre un disco de iniciales vacío a quien
volvía al día siguiente, cambiaba de navegador o vaciaba el almacenamiento.

#### Si olvidó la contraseña (22/09/2026)

«¿Olvidaste tu contraseña?», en `/ingresar`, lleva a **`/clave`**, que ya no es una pantalla que
solo explica: pide el correo y manda un enlace. El recorrido:

1. Escribe su correo y pulsa «Enviar enlace» (`POST /portal/auth/recuperacion`). Un correo mal
   escrito se marca en el campo y no se manda nada.
2. Ve **siempre lo mismo**, tenga cuenta o no: «Si ese correo tiene una cuenta, te enviamos un
   enlace. Revisa también tu carpeta de spam. Vale por 60 minutos.». Así la pantalla no sirve
   para averiguar qué correos están registrados. «Reenviar enlace» se enciende a los 60
   segundos, con la cuenta atrás en el botón, y «Usar otro correo» vuelve al formulario.
3. Debajo, en los dos estados, sigue «¿No te llega? Escríbenos a talento@renaser.pe».
4. El enlace del correo abre **`/restablecer?token=…`**. El token **sale de la barra al
   cargar** y no queda en el historial. Abrir la pantalla no gasta el enlace.
5. Elige la contraseña nueva y la repite: al menos 8 caracteres, sin espacios al principio ni
   al final (se avisa, no se recortan) y como mucho 72 bytes —una tilde o una «ñ» cuentan
   doble, un emoji cuádruple—. Si es igual a la de antes, el aviso sale en el campo y el enlace
   sigue sirviendo.
6. Al guardar (`POST /portal/auth/restablecer`) va a `/ingresar` con «✓ Contraseña cambiada
   exitosamente» encima. **No queda con la sesión abierta**: entra con la nueva.

Si el enlace venció, ya se usó o se pidió otro después, la pantalla dice una sola cosa, «Este
enlace ya no sirve.», con «Pedir un enlace nuevo». Si el token falta —enlace cortado al
pegarlo—, dice «El enlace está incompleto.». ⚠️ **Recargar `/restablecer` después de que el
token salió de la barra también muestra «El enlace está incompleto.»** Es una decisión aprobada:
el enlace del correo sigue sirviendo si se vuelve a abrir.

⚠️ **«Vale por 60 minutos» va escrito a mano** (`src/ui/recuperacion/reglas.ts`). La vida del
enlace es un parámetro del backend, `minutos_vida_recuperacion`, y la respuesta no trae el
número: si se cambia allí, se cambia aquí.

**Quien no puede usarlo:** quien fue cargado desde una carpeta de CVs tiene un correo inventado
y no le llega nada; por eso la línea de talento se queda. Y **sin el correo encendido en el
backend no le llega a nadie** (ver [PENDIENTES.md](PENDIENTES.md)).

### 2.5 Postular — con cuenta
`POST /portal/postulaciones` (multipart): `cv` (PDF o Word, máx. 10 MB), `resultadoOrgulloso`
(texto obligatorio), `portafolio`/`linkedin`/`github` (opcionales), y `requisitosConfirmados`.

⚠️ **La confirmación de requisitos es el único descarte automático del sistema.** Un requisito
activo sin confirmar cierra la postulación en el acto (`NO_CONTINUA`). Tiene que leerse como una
decisión seria, no como una casilla más del formulario. Desde el 14/09/2026 es también una de las
tres cosas que el texto legal enumera como «pasan sin que intervenga una persona», junto al
cierre por plazo vencido y el pase automático de las vacantes que avanzan solas.

**El permiso se firma con la empresa, no con Renaser**, y desde el 14/09/2026 su texto **ya no
repite lo técnico**: la inteligencia artificial y los proveedores se aceptaron al crear la
cuenta. Lo que queda es lo de esa empresa —que ella publica la vacante, que ella decide, y que el
permiso no alcanza a las demás del portal—, y es **el mismo texto para todas**, con el nombre de
la suya puesto dentro.

⚠️ **Aquí ya no hay casilla de consentimiento** (15/09/2026). Se retiró. Lo último antes del
botón es una frase que dice quién va a recibir la candidatura y enlaza el texto entero, en
`/politica-de-privacidad?vacante={id}#el-texto-que-aceptas` —con el `?vacante=` para que se lea
con el nombre de esa empresa y no con un genérico—. Enviar la candidatura a una empresa que se
eligió, después de leer quién la recibe, es el acto afirmativo; una casilla encima no añade
voluntad, añade fricción, y el candidato ya viene de marcar dos en el registro.

**Lo que no se retiró es la constancia**: al enviar se sigue guardando la firma a nombre de esa
empresa con el texto, la fecha y la dirección, y el backend **sigue exigiendo `aceptaTratamiento`
en `true`** para cortarle el paso a quien llame a la API por su cuenta. Lo que cambió es cómo se
da el permiso, no que se dé.

⚠️ **Y es la pieza que más necesita el visto bueno del abogado**: se pasa de «consentimiento
expreso por casilla» a «consentimiento por acto inequívoco». Las dos se defienden y no son lo
mismo.

Lo que la pantalla sí necesita es el nombre de la empresa, y **ese ya viene con la vacante**: la
llamada a `GET /portal/vacantes/{id}/consentimiento` se fue de aquí y vive ahora en la política
de privacidad, que es donde se lee el texto.

### 2.6 Mis procesos — el centro del portal
`GET /portal/postulaciones` → por postulación: `uuid`, `vacante`, `estado`, `estadoNombre`,
`grupoPrioridad`, `diasSinCambio`, `creadoEn`.

🚫 **`grupoPrioridad` llega en la respuesta y NUNCA debe pintarse aquí.** Es la clasificación
interna del equipo, y esta es la pantalla del candidato: nadie tiene que enterarse por su propio
portal de en qué casilla lo pusieron, ni con esa palabra ni con otra más suave. Sigue prohibido
después del rediseño.

⚠️ **La prohibición es de este lado, y conviene decirlo porque leída suelta ya bloqueó trabajo
legítimo.** El panel del equipo, en `/admin`, **sí enseña el grupo en cada fila del ranking**:
ahí quien mira es el dueño de esa clasificación, y saber que un 95 arrastra un riesgo crítico es
justo lo que hay que ver antes de llamar a alguien. Son dos sesiones con dos tokens distintos;
lo que no puede pasar es que el dato cruce de una a la otra.

Lo que hay que resolver aquí: separar visualmente **lo que le toca** de las esperas, y que el
candidato entienda `diasSinCambio` sin que parezca abandono.

### 2.7 Detalle de una postulación
`GET /portal/postulaciones/{uuid}` → el resumen anterior más `historial`: una lista de
`estadoAnterior`, `estadoNuevo`, `fueElSistema`, `ocurridaEn`.

Es historial **real**, no inventado. Se puede pintar como línea de tiempo.

**Acción:** retirarse (`POST .../retiro`). Retirarse ≠ borrar datos: son cosas distintas y hay
que decirlo.

⚠️ **Si la empresa eliminó la vacante (21/09/2026), el proceso deja de verse.** No llega en
«Mis procesos», y abrirlo desde un enlace viejo responde 404: la pantalla dice «Esta vacante ya
no está disponible.» y «La empresa la retiró, así que su proceso dejó de verse aquí. No tienes que
hacer nada», con la vuelta a la lista. El detalle público de esa vacante dice lo mismo en su
título. Quien seguía en carrera recibe en la campana un aviso **sin enlace**, y los avisos que ya
tenía de esa vacante se quedan, también sin enlace.

**Lo mismo en las pantallas de su proceso** (22/09/2026): la prueba del puesto, la evaluación, el
cuestionario técnico y las fechas de la simulación enseñan ese mismo aviso (`VacanteRetirada`, en
`src/ui/Mensajes.tsx`) en lugar de un error y sin ofrecer reintentar. Un 404 de esas pantallas no
basta —en la simulación también es «todavía no elegiste fecha»—, así que se le pregunta a su
proceso, y solo si también responde 404 se dice que la vacante ya no está. **Con la pantalla
abierta desde antes** quien se entera es el botón: un 404 al empezar, responder, subir, entregar o
confirmar fecha vuelve a pedir la pantalla, y si la vacante se eliminó la pantalla entera pasa al
aviso. Si la vacante sigue ahí, ese 404 era otra cosa y se enseña su error normal; en la prueba,
sin cerrar el diálogo. Lo hacen las cuatro con el mismo hook, `usePantallaAbierta`
(`src/paginas/procesos/useVacanteRetirada.ts`).

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

### 2.14 Política de privacidad — pública, y no es la misma pantalla que la de arriba
`/politica-de-privacidad` **solo cuenta**: quién responde por los datos con su RUC y su
domicilio, qué se recoge, para qué, quién más lo ve —los cinco proveedores en una tabla, con lo
que recibe cada uno—, que los datos salen del Perú, cuánto se conservan y cómo se pide el
borrado. La de 2.13 es el panel de acciones y vive dentro de la sesión; esta se lee sin cuenta,
que es lo que exige Google Play.

**El último bloque no lo escribe la pantalla**: son los **tres** textos publicados que sirve
`GET /portal/consentimientos/textos`, enseñados **palabra por palabra**. Un documento que los
resume a mano se desvía del que la gente firma de verdad, y el que vale es el firmado. Si esa
petición falla, lo de arriba se lee igual y abajo se dice que el texto no cargó, con la dirección
para pedirlo — y lo mismo si llega la lista a medias, que es el fallo silencioso: un 200 con un
texto de menos dejaría el bloque con su título y el vacío debajo.

Ese bloque lleva el ancla **`el-texto-que-aceptas`**, que es a donde apuntan los enlaces de las
casillas del registro y la frase de postular: quien pulsa desde ahí no quiere la política entera,
quiere el párrafo que está a punto de firmar.

⚠️ **Con `?vacante={id}` el texto de postular sale con el nombre de esa empresa.** Es lo que
enlaza la pantalla de postular. Sin ese parámetro el mismo texto se enseña con «la empresa que
publica la vacante», que sirve para leerlo en frío, y la pantalla lo dice: es el mismo para todas
y en cada vacante aparece el nombre de la suya.

⚠️ **El número de versión no se enseña, y el versionado sigue intacto.** Cada aceptación queda
amarrada en la base a la versión exacta que se firmó, con su huella — eso es lo que sostiene la
prueba. Pero a quien lee, un «versión 1.0» no le dice nada y lo único que sugiere es que hay
otras versiones que no puede ver. Lo que le importa es el texto, y el texto está entero.

La página también identifica al responsable con **razón social, RUC y domicilio**, y lista a los
encargados uno a uno —DeepSeek, Google, Supabase, Amazon Web Services y Vercel— con lo que recibe
cada uno. Y enumera **las tres cosas que pasan sin que intervenga una persona**, porque la
versión anterior prometía lo contrario y era falso.

---

## 3. Qué es público y qué no (frontera del backend)

`ConfiguracionSeguridad` deja abierto **sin token**: `GET /portal/vacantes/**`,
`GET /portal/consentimientos/textos`, `POST /portal/cuentas`, `POST /portal/auth/login`,
`POST /portal/auth/acceso`, y desde el 22/09/2026 `POST /portal/auth/recuperacion` y
`POST /portal/auth/restablecer`. A esa lista se suma `GET /portal/catalogos/ubigeo`, que se pide sin
token desde crear cuenta (01/09/2026) — los otros dos catálogos del portal, niveles educativos y
de idioma, sí van con token porque solo se usan dentro del perfil. **Todo lo demás exige token de
candidato.**

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
| 8 | Consentimientos con poco sitio | **Resuelto de otra manera** (15/09/2026): el texto ya no se pinta dentro del formulario. Las casillas llevan un título corto y un enlace a la política, que los enseña enteros. Lo que hay que vigilar ahora es el enlace: si se rompe, el consentimiento deja de estar informado |

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

**Modo claro, y ya no hay nada que limpiar.** ~~`src/app/Tema.tsx`~~, ~~`ProveedorTema`~~, el
bloque `html[data-theme="dark"]` y ~~`variables.css`~~ **se borraron**; `index.html` abre en
claro. El champagne `#816220` que aquí se citaba tampoco existe: el mundo visual se sustituyó
tres veces desde entonces y hoy es «El cielo despejado» —gris frío, superficies blancas y un solo
acento índigo para la acción y para «te toca a ti»—. Ver [EL-MUNDO-VISUAL.md](EL-MUNDO-VISUAL.md).

⚠️ **Lo que sigue vigente de este documento es el contrato de datos**: los dieciocho estados,
qué ve el candidato en cada uno y de quién se espera algo. Eso sale del backend y no ha
cambiado. Lo que dice de color o de archivos de tema está viejo y se deja tachado a propósito,
para que nadie lo reimplemente.

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
