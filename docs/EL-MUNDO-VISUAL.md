# El mundo visual y dónde está el código

Las decisiones de diseño que gobiernan el portal entero, y el mapa de carpetas de `src/`. **El
sistema completo —paleta, escala tipográfica, reglas con nombre, componentes— está en
[DESIGN.md](../DESIGN.md)**; los tokens con su porqué, en
[`src/estilos/mundo.css`](../src/estilos/mundo.css), que es la verdad cuando algo no cuadre.
Este documento no repite ninguno de los dos: cuenta de dónde sale el mundo y dónde vive el
código.

---

## El mundo visual: «El cielo despejado» (desde el 25/09/2026)

Gris muy claro y frío de fondo, superficies blancas que se apoyan en él por tono, tinta casi
negra con un matiz azul, y **un solo color con intención**: el índigo `#615FFF`, que marca lo
que se pulsa, dónde estás y lo que te toca. Tipografía **Geist**. Esquina de 8 px en los
controles. La portada es la única pantalla con atmósfera —un cielo azul con nubes y el
recorrido dentro de una ventana de cristal—; dentro del portal, el cielo se queda en su gris.

La metáfora es la de un cielo despejado porque quien postula pasa semanas esperando: la mayor
parte de los dieciocho estados no le piden nada. El portal es el sitio al que vuelve a mirar, y
tiene que estar despejado — nada compitiendo con la única pregunta que importa, en qué punto
está su candidatura.

### De dónde sale

De una referencia que trajo el cliente: la plantilla SaaS
[saasly.demos.tailgrids.com](https://saasly.demos.tailgrids.com/). Se replicó **midiendo su
página**, no mirando capturas: los `oklch` de su hoja convertidos a hex pintándolos en un
canvas, sus radios, sus pesos y el marco de su captura de producto capa por capa. Es la escala
gris de Tailwind v4 con índigo, Geist, el radio de 8 px y la cabecera en píldora blanca.

**Lo que no se copió, y por qué:**

| De la referencia | Aquí | Motivo |
|---|---|---|
| El cielo es una foto de su servidor | Degradados, y nubes generadas con ruido fractal y pintadas de antemano en `public/cielo-nubes.webp` (40 KB) | Es un recurso de una plantilla comercial. Las nubes salen de `herramientas/cielo/`, y el script que las pinta explica por qué no se calculan en el navegador |
| El borde de sus botones da 1,24:1 contra blanco | El borde de un campo usa el gris de texto, 4,83:1 | WCAG 1.4.11 pide 3:1 al límite visible de un control |
| Su verde de acierto da 3,22:1 | Los colores de estado se quedaron como estaban | Texto pide 4,5:1 |
| Precios, integraciones, testimonios | No existen | Los dos primeros no aplican a un portal de empleo gratuito; los testimonios la portada se niega a inventarlos |

### Las reglas de forma

- **Plano por tono.** Una superficie se separa de la página porque es más clara que ella, no
  porque flote. En reposo casi nada lleva sombra, ni siquiera la cabecera.
- **Una sola voz.** Si algo es índigo, se pulsa, es donde estás, o te toca. Nada decorativo va
  en índigo.
- **El estado se lee en la forma antes que en el color** —franja maciza, borde de 2 px,
  filete—, porque quien no distingue colores lee el mismo recorrido. **Es la regla que sostiene
  el sistema** desde que el turno perdió su color propio (ver abajo).
- **Verde, ámbar y rojo significan hecho, duda y error**, y nunca jerarquía ni categoría. Esto
  viene del 23/08 y es lo único de la paleta que ha sobrevivido a todos los mundos.
- **La tipografía hace la jerarquía.** Una sola familia; un titular de portada por pantalla.
- **El movimiento sirve a la continuidad y al cambio de estado**, respeta
  `prefers-reduced-motion`, y **con el reloj corriendo —evaluación, prueba, cuestionario— no se
  mueve nada**.

### Lo que se perdió al cambiar de mundo

**«Te toca a ti» ya no tiene color propio.** En el mundo anterior era el coral, y era un
discriminador: servía para encontrar tu turno entre cosas que no lo son. La referencia no tiene
un segundo acento, así que el turno se pinta del mismo índigo que la acción, y lo distingue la
forma —el borde de 2 px del panel que reclama—. **Se decidió dejarlo así** el 25/09/2026. El
token `--activo-regla` conserva su nombre para que, si algún día vuelve un color propio, se
separe en un solo sitio.

### La tipografía

**Geist**, fuente variable 400–700, **servida por el propio sitio** desde
`public/tipografia/`: una aplicación instalada no puede quedarse sin titulares por falta de
cobertura. Se precarga el subconjunto latino desde `index.html`. Los archivos de Figtree siguen
en la misma carpeta por si hay que volver.

⚠️ **El detector de `impeccable` marca Geist como «fuente sobreexpuesta»**, igual que Inter o
Roboto. Es una decisión del cliente, y la excepción está registrada en
`.impeccable/config.json` con su motivo: **no la cambies para callar el aviso**.

### Los mundos anteriores

Este portal ha tenido cuatro mundos visuales. Si encuentras alguno de estos nombrado como
vigente en `docs/`, está viejo:

| Mundo | Cuándo | Qué era |
|---|---|---|
| «El seguimiento» | agosto | Hitos impresos, cero radios, Libre Franklin |
| «El canto» | hasta el 10/09 | Nube difractando luz, espectro irisado, violeta `#5638d6`, Mulish |
| «El escaparate» | 10/09 – 25/09 | Pastel cálido `#FBF1E9`, acción negra `#0A0A0A` con radio 4, coral `#FF7C61` para el turno, Figtree |
| **«El cielo despejado»** | **desde el 25/09** | El de este documento |

La historia de cada cambio está en las bitácoras de [agosto](BITACORA-2026-08.md) y
[septiembre](BITACORA-2026-09.md).

---

## Lo que sigue vigente de las decisiones del 23/08/2026

| Pantalla | Cómo queda |
|---|---|
| Mis procesos | Cada postulación con su camino de cinco etapas dibujado y un punto donde estás. La acción vive dentro de la etapa |
| Evaluación | Una pregunta por pantalla, con **mapa lateral** de todas y su estado. Resuelve el problema conocido: saltarse una y no poder volver sin pulsar cuarenta veces |
| Cuando no hay nada que hacer | Se dice claro que no hay nada pendiente y se ofrece algo útil mientras tanto. **Trece de los dieciocho estados son esto** |

**Solo tema claro.** Es petición del cliente: no hay bloque `html[data-theme="dark"]` ni
proveedor de tema.

El maquetado de las pantallas —[maquetado/LEEME.md](../maquetado/LEEME.md), las 17 en HTML
plano— sigue siendo lo que se lee para saber **qué va en cada pantalla**. Lo que no dice es
cómo se ve: eso es DESIGN.md.

---

## Dónde está el código

| Pieza | Qué es |
|---|---|
| `src/estilos/mundo.css` | **La única hoja global.** Los tokens, las fuentes y los estilos base. Todo lo demás son CSS Modules |
| `src/estilos/piezas.module.css` | **La única especificación de botón del portal**, más los tres paneles (`.turno`, `.panelDeEspera`, `.indispensable`), la cabecera de sección y el plegable. Se trae con `composes` desde la hoja de cada pantalla. Si hace falta una forma que no está ahí, se añade ahí — ninguna pantalla se dibuja la suya |
| `src/estilos/pagina.module.css` | **El esqueleto de una pantalla**: el carril, el encabezado, el reparto en columnas, el bloque y el hueco declarado |
| `src/app/Armazon.tsx` | La cabecera en píldora, los dos pies —en columnas y corto—, y **el cielo de la portada**, que vive aquí porque tiene que pasar por detrás de la cabecera. También decide qué pantallas son una tarjeta centrada en la ventana (`CENTRADAS`: `/ingresar`, `/clave`, `/restablecer` y sus tres del panel), cuáles llevan el pie corto y cómo sube «Inicio» |
| `src/paginas/vacantes/` | La portada —cielo, ventana de cristal, cinta, las tres vacantes más recientes, «Por qué este proceso es distinto», preguntas—, **`/vacantes`**, la búsqueda con sus filtros (`BuscarVacantes`, llegó de main el 25/09/2026 y se pasó a este mundo al juntarla), la tarjeta de vacante que comparten las dos (`Tarjeta`, de pie y a lo ancho) y la ficha. **Públicas** |
| `src/paginas/cuenta/` | Entrar, crear cuenta, canjear el enlace del correo y la contraseña olvidada. Comparten `Cuenta.module.css` |
| `src/paginas/postular/` | Postular. **Aquí vive el único descarte automático del sistema** |
| `src/paginas/procesos/` | «Mis procesos», el detalle de una postulación y la línea de hitos |
| `src/paginas/evaluacion/` | La evaluación y los ocho formatos del banco v3 |
| `src/paginas/prueba/` | La prueba del puesto, en sus dos formas |
| `src/paginas/simulacion/` | Elegir fecha, y la sesión ya reservada con su agenda |
| `src/paginas/validacion/` | El periodo trabajando. Ver más abajo por qué no se enlaza |
| `src/paginas/decision/` | El caso ámbar. El formulario va entero y **apagado** |
| `src/paginas/privacidad/` | La política pública y las tres acciones sobre los datos |
| `src/panel/entrar/` | Las tres puertas del panel —entrar, pedir el enlace y elegir contraseña—, **dentro del armazón del portal** y con su aspecto. El resto de `/admin` va con su propia disposición |
| `src/ui/recuperacion/` | La contraseña olvidada —pedir el enlace y elegir la nueva—, **la misma pieza en el portal y en el panel**. Se pinta para ir dentro de una tarjeta, que pone cada pantalla |
| `src/ui/Estados.module.css` | Cargando, fallo, acceso necesario, vacío y el salvavidas, sobre nube. Comparten hoja porque comparten forma |
| `src/ui/movimiento.tsx` | Las piezas de movimiento, documentadas en DESIGN.md |
| `src/ui/Modal.tsx` | El aviso compartido: entregas y confirmaciones |
| `src/ui/campos/` | Campo, Seleccion, AreaTexto y Consentimiento: etiqueta y error atados al campo. La marca de obligatorio está en [REGLAS-DEL-CODIGO.md](REGLAS-DEL-CODIGO.md) |
| `public/tipografia/` | Geist (y Figtree, por si se vuelve) |

`src/dominio/estados.ts` lleva cuatro funciones que usa el recorrido:

| Función | Para qué |
|---|---|
| `recorridoDe()` | En qué punto está cada una de las cinco etapas |
| `fechasDelRecorrido()` | Cuándo se alcanzó cada etapa, leído del historial |
| `etapaDeCorteDe()` | Dónde se detuvo una postulación terminada. Los tres estados finales no lo dicen; el historial sí |
| `comoOcurrio()` | El nombre de un cambio **en pasado**. Los títulos de `MOMENTOS` están en presente y en un registro de hace tres semanas suenan a que sigue pendiente |

⚠️ **La lista de postulaciones no trae historial y el detalle sí.** De ahí sale que «Mis
procesos» pinte el recorrido sin fechas y el detalle con ellas, y que una postulación
terminada solo pueda enseñar dónde se detuvo en el detalle. No es un descuido: inventar una
fecha sería peor que no ponerla.

### Cómo se resolvió el descarte automático

Los requisitos indispensables **no son casillas, son preguntas de sí o no**. Una casilla se
marca sin leer; una pregunta hay que contestarla, y no se puede enviar dejando alguna en
blanco.

Responder «no» **no bloquea el envío**: lo explica. Impedirlo sería decidir por el candidato.
La pantalla nombra los requisitos que dijo no cumplir, dice que la postulación se cerrará de
inmediato y que no podrá volver a postular, y le deja elegir. La opción por defecto del aviso
es volver y revisar.

### La evaluación: los tests son la especificación

`Evaluacion.test.tsx` y `Formatos.test.tsx` prueban exactamente los fallos que ya costaron
respuestas perdidas: que lo escrito se mande al cambiar de pregunta, que lo rechazado no se dé
por guardado, que el aviso sobreviva al cambio de pregunta, que no se pueda entregar con algo
pendiente, y las ocho formas de responder. Si uno se pone rojo, la pregunta no es cómo callarlo.

Tres avisos por si se retoca:

- **No partir textos con elementos dentro.** Poner `<b>` alrededor de los números de «Pregunta 2
  de 4» rompió cuatro tests, y por la misma razón que rompe a un lector de pantalla: la frase
  deja de leerse de una pieza.
- **El SEC se ordena solo con flechas, no arrastrando.** Arrastrar va mal en un teléfono, y
  desde el teléfono responde casi todo el mundo. `Formatos.module.css` conserva `.asa` y
  `.arrastrando` de ese intento: es CSS muerto.
- **`.letra` también es CSS muerto, y a propósito.** Separar la letra de una opción en su
  propio `<span>` deja el nombre accesible como «a.Aviso antes de mover nada», sin espacio.

### Dos pantallas completas y no conectadas

Ninguna finge tener datos que no tiene.

**Decisión ámbar** (`/procesos/:uuid/decision`). El formulario está entero y
**deshabilitado**, con un `fieldset disabled`, y se dice por qué antes de que nadie escriba. La
acción que sí funciona —escribirle al equipo— es la que lleva el índigo. Los endpoints que
hacen falta están en la cabecera de `Decision.tsx`.

**Validación** (`/procesos/:uuid/validacion`). La ruta existe pero **no se enlaza desde ningún
sitio**: `VALIDACION_TURNO_CANDIDATO` sigue llevando al detalle del proceso. El maquetado tiene
«Día 6 de 15» y un responsable, y el backend no expone nada de eso; enseñarlo inventado a quien
está trabajando esos días es peor que no enseñarlo. **Conectarla es una línea en
`dominio/estados.ts`** cuando el backend abra su ruta.

---

## `impeccable` en este proyecto

La skill de diseño lee cuatro cosas de aquí, y las cuatro tienen que decir la verdad:

| Archivo | Qué lleva |
|---|---|
| [PRODUCT.md](../PRODUCT.md) | Quién usa el portal y para qué. No es visual |
| [DESIGN.md](../DESIGN.md) | El sistema visual, con su cabecera de tokens |
| `.impeccable/design.json` | Lo que el formato de DESIGN.md no admite: rampas tonales, sombras, movimiento, cortes y diez piezas en HTML y CSS que su panel puede pintar |
| `.impeccable/config.json` | La configuración del detector, con la excepción de Geist |

**DESIGN.md y `design.json` se regeneran juntos, nunca uno solo.** La última vez fue el
25/09/2026, con `/impeccable document`, al cambiar de mundo: `DESIGN.md` se reescribió de cero y
la narrativa del sidecar se copia literal de él.

⚠️ **Si cambias los tokens de `mundo.css`, DESIGN.md miente hasta que lo regeneres.** Y si un
valor nuevo —un radio, un tamaño— no está en la escala, **se nombra como token**, no se silencia:
el 25/09 el detector marcó los radios de la cabecera y del marco de cristal, y se convirtieron en
`--radio-pildora`, `--radio-cristal` y `--radio-ventana`.

**El hook del detector está activo**: corre tras cada edición de UI y avisa. Las excepciones que
hay son tres, todas con su motivo escrito: Geist en `config.json`, y dos marcas en línea en
`Vacantes.module.css` —la máscara del fundido, que solo lee el alfa, y el rótulo en miniatura de
una maqueta decorativa—.

`/impeccable doctor` no encuentra desfases. **La plataforma de `PRODUCT.md` es `adaptive`**
desde el 25/09/2026 —era `web`—, porque el portal también se empaqueta como aplicación de
Android: con `web`, `impeccable` nunca cargaba sus guías de Android al diseñar.

Lo que se corrió sobre el portal y cuándo:

| Comando | Cuándo |
|---|---|
| `extract`, `document`, `audit` (17/20), `critique` (27/40), `polish` | 24/08, sobre el mundo de entonces. El registro, en la [bitácora de agosto](BITACORA-2026-08.md) |
| `document` | 25/09, al pasar a «El cielo despejado» |

**No usar `craft`**: está deprecado.

---

## Dependencias

Instaladas y en uso: `motion` (**solo fuera del examen**) y `zod`. Estilos con **CSS
Modules**, no Tailwind — aunque la paleta salga de la escala de Tailwind, aquí son tokens
propios.

⚠️ **`react-hook-form` y `@hookform/resolvers` están instalados y NO los usa nadie.** Los
formularios son `useState` + `zod.safeParse` a mano, y el bloque que se copia está en
`Registro.tsx`: `safeParse` → primer error por campo (`nuevos[campo] ??= mensaje`) →
`requestAnimationFrame` que enfoca el primer `[aria-invalid="true"]`. Ese
`requestAnimationFrame` no sobra: sin él el atributo todavía no está en el DOM cuando se busca.

**`@dnd-kit` está instalado y no se usa**: el `SEC` se resolvió con flechas. **Radix no se
instaló y no hace falta**: el aviso de postular usa `dialog` nativo, el recorrido plegable
`details`, y apagar el formulario de la decisión es un `fieldset disabled`. Antes de traer una
librería, mira si el HTML ya lo resuelve.

Nada de librería de fechas —`reloj.ts` es crítico—, nada de gestor de estado —TanStack Query
ya cubre lo que hay— y ningún kit de componentes encima de los primitivos.

⚠️ **Instálalas dentro del worktree.** `node_modules` no se comparte entre worktrees.
