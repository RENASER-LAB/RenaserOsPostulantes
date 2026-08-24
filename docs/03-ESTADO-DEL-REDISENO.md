# Estado del rediseño del portal del candidato

Última actualización: 2026-08-24 · las diecisiete pantallas construidas; quedan los comandos de cierre

Este documento es el punto de arranque para retomar el rediseño. Cuenta qué se decidió,
qué queda por hacer y en qué orden.

---

## Dónde estamos

El maquetado está hecho y aprobado, y **el portal entero está construido sobre él**. No queda
nada del `src/` viejo salvo el nombre EX y su logotipo: `base.css` y `variables.css` se
borraron el 24/08 con la última pantalla, y todo el estilo son ya CSS Modules.

| Pieza | Dónde |
|---|---|
| Maquetado publicado | https://claude.ai/code/artifact/7239da41-c745-472c-9b90-19df9d4ef666 |
| Fuentes del maquetado | `maquetado/*.body.html`, se reensamblan con `node armar.mjs` |
| Qué ve el candidato, pantalla por pantalla | [02-QUE-VE-EL-CANDIDATO.md](02-QUE-VE-EL-CANDIDATO.md) |
| Análisis del portal viejo | [01-ANALISIS-PORTAL.md](01-ANALISIS-PORTAL.md) |

El maquetado tiene 17 pantallas en dos páginas: las tres elegidas más el estudio de color,
y las doce del recorrido.

---

## Lo que se decidió

**Las tres pantallas que se votaron**, de tres variaciones cada una:

| Pantalla | Elegida | En qué consiste |
|---|---|---|
| Mis procesos | **B · El recorrido** | Cada postulación con su camino de cinco etapas dibujado y un punto donde estás. La acción vive dentro de la etapa |
| Evaluación | **A · Una pregunta por pantalla, con mapa** | Mapa lateral con todas las preguntas y su estado. Resuelve el problema conocido: saltarse una y no poder volver |
| Sin nada que hacer | **A · La espera no ocupa sitio** | Se dice claro que no hay nada pendiente y se ofrece algo útil mientras tanto |

**Color.** Fondo blanco puro. Acento **índigo `#4338CA`**, que sustituye al champagne
`#816220`. La razón no es estética: verde, ámbar y rojo ya tienen significado fijo en el
sistema —aprobado, en duda, error— así que el acento no podía ser ninguno de esos ni un
verde azulado, que junto a una etiqueta verde real se lee como «aprobado». Al cliente le
gusta la estética de Apple pero pidió que no fuera su azul.

**El acento significa una sola cosa: «te toca a ti».** Marca el panel de la acción
pendiente y el tramo del recorrido donde está el candidato. Si empieza a salir en botones
sueltos o titulares, deja de leerse.

**Solo hay tema claro.** Es petición del cliente. Desaparecen el bloque `data-theme="dark"`
y el proveedor de tema.

**Lo único que se conserva del portal viejo** es el nombre **EX** y su logotipo: la palabra
con la hormiga dentro de la X.

---

## Lo que queda por hacer

### 1 · Los comandos de cierre de `impeccable`

El mundo visual ya está decidido y construido: se llama **«El seguimiento»**, sus tokens viven
en `src/estilos/mundo.css` y su porqué en [04-BRIEF-MIS-PROCESOS.md](04-BRIEF-MIS-PROCESOS.md).
`init` y `shape` ya corrieron, y `critique` corrió sobre «Mis procesos».

Lo que queda va **sobre el portal completo**, que es donde rinde. Correrlo pantalla a pantalla
es caro y no ve lo que importa, que es la consistencia entre ellas.

| Orden | Comando | Para qué |
|---|---|---|
| 1 | `/impeccable extract` | Consolida en el sistema lo que se repite en las quince hojas |
| 2 | `/impeccable audit` | Accesibilidad, rendimiento y responsive, sobre todo |
| 3 | `/impeccable critique` | Apuntado a las tres pantallas donde se juega el proceso |
| 4 | `/impeccable polish` | Lee el resultado de `critique` como lista de pendientes |

Después, según haga falta: `harden`, `adapt`, `typeset`, `layout`, `animate`.

**Hay que invocarla con el directorio de trabajo en este worktree**: el repositorio del
backend tiene su propio `PRODUCT.md`, y describe al reclutador, no al candidato.

**No usar `document`**: genera `DESIGN.md` a partir del código existente, y el código
existente era justo el portal que se tiró. Consagraría el aspecto que se acaba de reemplazar.

**No usar `craft`**: está deprecado, es un alias que no aporta nada.

### 2 · Las dependencias acordadas

Cuatro, cada una atada a algo real de este portal:

| Paquete | Por qué |
|---|---|
| `@dnd-kit/core` + `@dnd-kit/sortable` | El formato `SEC` del banco v3 es «ordena estos cinco pasos». Trae arrastre por teclado y anuncios a lector de pantalla |
| `@radix-ui/react-*` | Modal, select, tooltip, pestañas — accesibles y sin estilos. La alternativa era React Aria, más estricto con WCAG pero mucho más código |
| `motion` (import `motion/react`) | ~31 KB, ~15 KB con `LazyMotion`. **Solo fuera del examen**: esa ruta pinta 50-85 preguntas de golpe |
| `react-hook-form` + `zod` | Registro y postulación. `zod` deja escribir en un sitio los límites del backend (el `@Size(max = 20_000)`) |

**Estilos: CSS Modules**, no Tailwind. Cero configuración en Vite, nombres de clase en
español, CSS normal que cualquiera lee.

**Lo que NO se añade**, y por qué: ninguna librería de fechas —`src/dominio/reloj.ts` hace
el cálculo contra el reloj del servidor y es crítico—, ningún gestor de estado —TanStack
Query ya cubre lo que hay— y ningún kit de componentes encima de los primitivos.

### 3 · Reglas que el código nuevo hereda

Cada una costó un fallo real. Los archivos pueden morir; estas no:

| Regla | Por qué |
|---|---|
| Una sola fuente para los 18 estados | Si cada pantalla decide qué enseñar, añadir un estado obliga a tocarlas todas |
| La hora la manda el servidor | El cronómetro sale de `venceEn` menos el desfase de reloj |
| Lo escrito no sale de la cola hasta que el servidor confirma | Se validó con uno de cada cinco guardados cayendo: antes se perdían 4 de 20 respuestas |
| Ningún indicador fijo de «guardado» | Tiene que salir de comparar con el servidor. Y en blanco es «sin responder» |
| Las 8 formas de respuesta del banco v3 | La forma exacta la valida el backend y responde 400 si no cuadra |
| Los errores llegan como `application/problem+json` | Comprobar con `includes('json')`, no `'application/json'` |
| `grupoPrioridad` nunca se pinta | Es clasificación interna del equipo |

### 4 · Decisiones pendientes que salieron de la crítica (24/08/2026)

**Las fechas por hito en la lista de postulaciones.** La dirección visual se llama «El
seguimiento», pero no hay una sola fecha por etapa en «Mis procesos»: `GET /portal/postulaciones`
solo trae `estado`, `diasSinCambio` y `creadoEn`. El historial fechado existe, pero únicamente
en el detalle. Sin fechas, la línea de hitos es un stepper vertical con buen texto.

Se decidió **no pedirlo al backend por ahora** y volver a ello cuando toque la pantalla de
detalle. Lo que haría falta el día que se retome, y es poco: añadir al `record` de la lista la
**etapa de corte** —para que una postulación terminada no pinte el recorrido vacío— y las
**fechas de los hitos cumplidos**.

**El recorrido deja de estar siempre visible.** El maquetado eligió «cada postulación con su
camino de cinco etapas dibujado». Tras ver la pantalla construida con cuatro postulaciones
—2666 px de alto en móvil, y trece de los dieciocho estados dibujando un recorrido que no pide
nada— se decidió **colapsar las postulaciones sin acción**: se reducen a la vacante y qué se
está esperando, y despliegan el recorrido a petición. La pantalla pasa a estar diseñada para su
caso frecuente.

### 5 · Dos pantallas construidas sin backend detrás (24/08/2026)

Están hechas completas a propósito, para poder juzgarlas y para saber qué pedir. Ninguna de
las dos finge tener datos que no tiene, y cada una lo resolvió distinto porque su situación
es distinta.

**Decisión ámbar** — `DECISION_TURNO_CANDIDATO` **sí lleva a su pantalla** desde «Mis
procesos», o sea que hay candidatos reales que pueden aterrizar aquí. Por eso el formulario
está entero pero **deshabilitado**, con un `fieldset disabled`, y se dice por qué antes de que
nadie escriba; la acción que sí funciona —escribirle al equipo— es la que lleva el acento.
Dejarlo escribible para fallar al pulsar habría sido peor: se pierde lo escrito y se aprende
que la pantalla miente. Los endpoints que hay que pedir están en la cabecera de `Decision.tsx`.

**Validación** — la ruta `/procesos/:uuid/validacion` se creó y funciona, pero **no se enlaza
desde ningún sitio**: `VALIDACION_TURNO_CANDIDATO` sigue llevando al detalle del proceso. El
maquetado tiene «Día 6 de 15», una barra al 40 % y un nombre de responsable, y de eso el
backend no expone nada. Enseñárselo inventado a quien de verdad está trabajando esos días es
peor que no enseñarlo — la misma regla por la que «Mis procesos» pinta el recorrido sin
fechas. Lo que sí sale es real: la vacante, y la fecha de inicio leída del historial.
Conectarla, el día que haya ruta, es **una línea en `dominio/estados.ts`**.

### 6 · Lo que se ajustó al construir, y no estaba en el maquetado

- **Elegir fecha de simulación es en dos pasos, no en uno.** El maquetado tenía un botón
  «Elegir» por fila. El backend contesta «ya elegiste una fecha, avísale al equipo»: no se
  deshace desde el portal, y un solo clic no puede cerrar algo irreversible. Se marca y se
  confirma aparte.
- **La fila «Sin plazas» de la simulación casi no existe.** El endpoint solo devuelve
  sesiones con cupo. Se dejó como caso defensivo, para si alguien recorta el cupo con gente
  ya inscrita. El caso real que sí pasa es otro: que se llene entre que se carga la lista y
  se pulsa el botón, y ahí la lista se vuelve a pedir sola.
- **Retirarse de una postulación ahora pregunta antes.** Estaba a un clic, y no se deshace.
- **Privacidad no dice «lo tienes activado».** Hay ruta para retirar el consentimiento de
  futuras vacantes, pero no para leerlo. Una etiqueta que no sale de comparar con nada es un
  indicador que miente.
- **Todas las horas van en reloj de 24.** `formatearFechaLarga` salía con el «09:00 a. m.»
  de fábrica de `es-PE`, que en móvil parte la línea entre la «a.» y la «m.» y además no
  cuadraba con las horas de la agenda de la simulación, que sí eran de 24.
