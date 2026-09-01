# Estado del rediseño del portal del candidato

Última actualización: 2026-08-25 · el rediseño está cerrado; lo que sigue es el panel

Este documento es el punto de arranque para retomar el rediseño. Cuenta qué se decidió,
qué queda por hacer y en qué orden.

---

## Dónde estamos

El maquetado está hecho y aprobado, **el portal entero está construido sobre él**, y los
comandos de cierre corrieron. No queda nada del `src/` viejo salvo el nombre EX y su
logotipo: `base.css` y `variables.css` se borraron el 24/08 con la última pantalla, y todo
el estilo son ya CSS Modules.

**Desde el 25/08 hay una segunda cara en el mismo repositorio**: el panel del equipo, en
`/admin`. Es provisional a sabiendas —debería estar en RENASER OS— y su estado vive en
[CLAUDE.md](../CLAUDE.md), no aquí: este documento es del rediseño del portal, que ya
terminó.

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

### 1 · Los comandos de cierre de `impeccable` · **hechos el 24/08**

Corrieron sobre el portal completo, que es donde rinden. Correrlos pantalla a pantalla es
caro y no ve lo que importa, que es la consistencia entre ellas.

| Comando | Resultado |
|---|---|
| `extract` | Cincuenta bloques con forma de botón repartidos por dieciséis hojas quedaron en **cuatro piezas** en `piezas.module.css`. El CSS pasó de 79,9 kB a 68,9 kB |
| `document` | `DESIGN.md` en la raíz y `.impeccable/design.json` al lado. **Se regeneran juntos, nunca uno solo** |
| `audit` | 17/20. El informe, en [05-AUDITORIA.md](05-AUDITORIA.md) |
| `critique` | 27/40. Dos P0: el cronómetro sin estilo ni aviso, y la contraseña sin recuperación. Los dos, arreglados |
| `polish`, `typeset`, `harden`, `distill` | En la misma tanda |
| `layout` | El portal compone en escritorio: el examen con el mapa al lado, la portada en horizontal, la prosa cortada por `--medida` |

⚠️ **`document` estuvo prohibido y ya no lo está.** La razón era que generaba `DESIGN.md` a
partir del código, y el código era el portal viejo. Ese código ya no está.

⚠️ **Si cambias los tokens de `mundo.css`, `DESIGN.md` miente hasta que lo regeneres.**

**No usar `craft`**: está deprecado, es un alias que no aporta nada.

### 2 · Las dependencias · en qué quedó cada una

Se acordaron cuatro. Al construir, dos sobraron:

| Paquete | En qué quedó |
|---|---|
| `motion` (import `motion/react`) | **En uso.** ~31 KB, ~15 KB con `LazyMotion`. **Solo fuera del examen**: esa ruta pinta 50-85 preguntas de golpe |
| `react-hook-form` + `zod` | **En uso.** Registro y postulación. `zod` deja escribir en un sitio los límites del backend (el `@Size(max = 20_000)`) |
| `@dnd-kit/core` + `@dnd-kit/sortable` | **Instalado y no lo importa nadie.** El `SEC` se resolvió con flechas: arrastrar va mal en un teléfono, y desde el teléfono responde casi todo el mundo. `Formatos.module.css` conserva `.asa` y `.arrastrando` de ese intento: es CSS muerto |
| `@radix-ui/react-*` | **No se instaló y no hace falta.** Los tres sitios que lo pedían los resuelve el HTML: el aviso de postular es un `dialog` nativo, el recorrido plegable un `details`, y apagar el formulario de la decisión un `fieldset disabled`. Foco atrapado, escape y teclado vienen gratis |

**Antes de traer nada nuevo, mira si el HTML ya lo resuelve.** Una librería es para lo que
la plataforma no cubre.

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
| `grupoPrioridad` nunca se pinta **en el portal** | Es la clasificación interna del equipo y el candidato no tiene que verla. El panel de `/admin` sí la enseña, que es la cara donde quien mira es su dueño |

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
- **El plazo acompaña al candidato dentro del examen** (31/08/2026). El maquetado ponía los
  días restantes en la portada de la evaluación y nada más; con catorce días de plazo y una
  pantalla que se retoma muchas veces, eso obligaba a salir del examen para saber cuánto
  quedaba. Los días van ahora en la línea de servicio, junto a «Pregunta 2 de 55», y **se
  apagan en la última hora** para no competir con la cuenta atrás del aviso.
- **Un plazo puede tener dos límites, y se dicen los dos** (31/08/2026). El maquetado daba por
  hecho que una prueba era cronometrada **o** de fecha de cierre. Pueden ser las dos cosas, y
  manda la que caiga antes. El segundo límite va **debajo del primero**, en el tamaño menor y
  la tinta clara: es la condición del dato de arriba, no un dato hermano, y al mismo peso se
  leerían como dos plazos en competencia.
