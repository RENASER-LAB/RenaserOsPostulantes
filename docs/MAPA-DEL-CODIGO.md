# El mapa del código

Dónde vive cada cosa en `src/`, cómo se usa `impeccable` aquí y qué dependencias hay. **Todo lo
visual —el mundo «Northstar», la paleta, la letra, las formas, los componentes, el movimiento,
el logotipo y la excepción verde de WhatsApp— está en [DESIGN.md](../DESIGN.md)**, y los tokens
con su porqué en [`src/estilos/mundo.css`](../src/estilos/mundo.css). Este documento no repite
nada de eso. Hasta el 14/11/2026 se llamaba `EL-MUNDO-VISUAL.md` y también contaba el mundo
visual; esa parte pasó a DESIGN.md.

---

## Lo que sigue vigente de las decisiones del 23/08/2026

| Pantalla | Cómo queda |
|---|---|
| Mis procesos | Cada postulación con su camino de cinco etapas dibujado y un punto donde estás. La acción vive dentro de la etapa |
| Evaluación | Una pregunta por pantalla, con **mapa lateral** de todas y su estado. Resuelve el problema conocido: saltarse una y no poder volver sin pulsar cuarenta veces. Desde el 09/10/2026 la prueba del editor va igual, con el mismo marco (`src/paginas/unaPorPantalla/`) |
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
| `src/estilos/mundo.css` | **La hoja global del mundo.** Los tokens, las fuentes y los estilos base: arriba la base del mundo anterior («El cielo despejado»), abajo el bloque «EL MUNDO NORTHSTAR» bajo `:root:not(.mundo-panel)` —casa siempre—, que es lo que manda en portal y panel. Todo lo demás son CSS Modules, salvo la prueba de shadcn de la fila siguiente |
| `src/estilos/tailwind.css` y `src/ui/shadcn/` | **La prueba piloto de shadcn/ui, solo en `/vacantes` (01/10/2026).** Tailwind v4 **sin preflight** y con las utilidades en `!important`, para no tocar las otras pantallas; su tema son los tokens de `mundo.css`. Los componentes de shadcn viven en `src/ui/shadcn/` (se añaden con `npx shadcn add`, y la CLI mete por error un paquete `cn`: quitarlo). Sin lucide: la casilla y el radio usan los iconos de la casa |
| `src/estilos/piezas.module.css` | **La única especificación de botón del portal**, más los tres paneles (`.turno`, `.panelDeEspera`, `.indispensable`), la cabecera de sección y el plegable. Desde el 13/10/2026, también `.ofrecimiento` (lo que se ofrece mientras se espera) y `.whatsapp` (el botón verde, misma silueta y altura que `.acentoMenor`). Se trae con `composes` desde la hoja de cada pantalla. Si hace falta una forma que no está ahí, se añade ahí — ninguna pantalla se dibuja la suya. **Lo que manda es el bloque Northstar del final, bajo `:global(html:not(.mundo-panel))`, que casa siempre**; la base de arriba es del mundo anterior |
| `src/estilos/pagina.module.css` | **El esqueleto de una pantalla**: el carril, el encabezado, el reparto en columnas, el bloque y el hueco declarado |
| `src/app/Armazon.tsx` | La barra pegada de 69 px, los dos pies en noche —en columnas, con el saludo que cambia de idioma, y corto—. También decide qué pantallas son una tarjeta centrada en la ventana (`CENTRADAS`: `/ingresar`, `/clave`, `/restablecer` y sus tres del panel), cuáles llevan el pie corto y cómo sube «Inicio» |
| `src/paginas/vacantes/` | La portada —el campo de puntos (`FondoDeLaPortada`, WebGL2), la ventana del producto, cinta, las tres vacantes más recientes, «Por qué este proceso es distinto», preguntas—, **`/vacantes`**, la búsqueda con sus filtros (`BuscarVacantes`, llegó de main el 25/09/2026 y se pasó a este mundo al juntarla), la tarjeta de pie de la portada (`Tarjeta`), la tarjeta «Expresiva» y el panel de `/vacantes` con shadcn (`FilaDeVacante`, `PanelDeVacante`; la columna de filtros vive en `BuscarVacantes`) y la ficha. **Públicas** |
| `src/paginas/cuenta/` | Entrar, crear cuenta, canjear el enlace del correo y la contraseña olvidada. Comparten `Cuenta.module.css` |
| `src/paginas/postular/` | Postular. **Aquí vive el único descarte automático del sistema** |
| `src/paginas/procesos/` | «Mis procesos», el detalle de una postulación y la línea de hitos. `TarjetaWhatsapp` (13/10/2026) es la tarjeta de WhatsApp del recuadro de espera, la misma en los dos sitios |
| `src/paginas/perfil/` | «Mi perfil», con sus secciones. `MiCelular` (13/10/2026) es el bloque «Tu cuenta» con el celular, encima del pie; su ancla `#celular` llega con el campo abierto |
| `src/paginas/evaluacion/` | La evaluación y los ocho formatos del banco v3, y `useColaDeRespuestas`, la cola de guardado que comparte con la prueba del editor |
| `src/paginas/unaPorPantalla/` | **El marco de una pregunta por pantalla** (09/10/2026), el mismo para la evaluación y la prueba del editor. `useRecorrido` lleva el paso, los saltos con «Volver a la N», la posición en `sessionStorage` y `useUnaSolaPulsacion`; `Marco` pinta la barra fija, el mapa con su leyenda (y su hoja en el teléfono), la tarjeta de la pregunta y el aviso de lo que falta para entregar. **Nada se mueve dentro** (la regla del reloj), y el mapa se aparta a propósito de la regla de la voz única |
| `src/paginas/prueba/` | La prueba del puesto, en sus dos formas. `Prueba.tsx` decide y pinta la de plantilla en curso; `PruebaDelEditor.tsx`, la del editor en curso, sobre el marco; `FichaPrevia.tsx` es la pantalla previa de las dos, con sus textos en `loQueDiceLaPrevia.ts`; `ElCaso.tsx`, el lateral del caso y su vista de lectura; `Entregable.tsx`, subir un archivo o un enlace |
| `src/paginas/simulacion/` | Elegir fecha, y la sesión ya reservada con su agenda |
| `src/paginas/validacion/` | El periodo trabajando. Ver más abajo por qué no se enlaza |
| `src/paginas/decision/` | El caso en duda (antes «ámbar»). El formulario va entero y **apagado** |
| `src/paginas/privacidad/` | La política pública y las tres acciones sobre los datos |
| `src/panel/entrar/` | Las tres puertas del panel —entrar, pedir el enlace y elegir contraseña—, **dentro del armazón del portal** y con su aspecto. El resto de `/admin` va con su propia disposición |
| `src/ui/recuperacion/` | La contraseña olvidada —pedir el enlace y elegir la nueva—, **la misma pieza en el portal y en el panel**. Se pinta para ir dentro de una tarjeta, que pone cada pantalla |
| `src/ui/Marca.tsx` y `logotipo.png` | El logotipo, el único sitio que conoce el archivo. Sus derivados —favicon, iconos y arranque de Android— los rehace `python3 herramientas/derivados-del-logotipo.py`. Ver DESIGN.md › El logotipo |
| `src/ui/Estados.module.css` | Cargando, fallo, acceso necesario, vacío y el salvavidas, sobre nube. Comparten hoja porque comparten forma |
| `src/ui/movimiento.tsx` | Las piezas de movimiento, documentadas en DESIGN.md |
| `src/ui/Modal.tsx` | El aviso compartido: entregas y confirmaciones. Con `aPruebaDeDobleClic` (10/10/2026) ignora el puntero que sigue a la pulsación que lo abrió; ver [REGLAS-DEL-CODIGO.md](REGLAS-DEL-CODIGO.md) |
| `src/ui/TextoPlano.tsx` | Texto libre con sus párrafos y sus direcciones convertidas en enlaces. `enlacesTabulables={false}` saca los enlaces del Tab (el extracto recortado del caso) y `listas` (09/10/2026, en el caso, los materiales y las herramientas de la prueba) pinta como `ul` las líneas que empiezan por «- », «• » o «* », y como `ol` las que empiezan por «1. », «2. »… |
| `src/ui/campos/` | Campo, Seleccion, AreaTexto y Consentimiento: etiqueta y error atados al campo. La marca de obligatorio está en [REGLAS-DEL-CODIGO.md](REGLAS-DEL-CODIGO.md). `Campo` admite **`prefijo`** (13/10/2026): un texto que no se escribe, como el «+51» del celular, dibujado dentro de la caja a la izquierda y en el gris de la ayuda; el lector de pantalla lo oye como parte de la descripción del campo («Con el prefijo +51 delante.»). **`prefijo=""` no es lo mismo que no darlo**: esconde el prefijo sin volver a montar el `<input>`, y es lo que usa el celular mientras el número empieza por «+»; quitarlo con `undefined` haría perder el foco y el cursor. `CampoCelular` y `mascaraCelular` (12/11/2026) son el campo del celular con su máscara: ver [REGLAS-DEL-CODIGO.md](REGLAS-DEL-CODIGO.md). `enfocarSinTapar` lleva el foco a un campo con error sin dejarlo bajo la cabecera: ver «Dependencias» |
| `public/tipografia/` | Onest y Syne (todo el sitio); Geist, Figtree y Mulish, de mundos anteriores, por si se vuelve |

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

**Decisión en duda** (`/procesos/:uuid/decision`, antes «decisión ámbar»). El formulario está entero y
**deshabilitado**, con un `fieldset disabled`, y se dice por qué antes de que nadie escriba. La
acción que sí funciona —escribirle al equipo— es la que lleva el azul. Los endpoints que
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
| `.impeccable/design.json` | Lo que el formato de DESIGN.md no admite: rampas tonales, sombras, movimiento, cortes y doce piezas en HTML y CSS que su panel puede pintar |
| `.impeccable/config.json` | La configuración del detector (sin excepciones desde el 14/11/2026) |

**DESIGN.md y `design.json` se regeneran juntos, nunca uno solo.** La última vez fue el
14/11/2026, al pasar el panel a «Northstar» (ver la tabla de abajo). La próxima vez que se corra
`/impeccable document`, que compare contra estos dos.

⚠️ **Si cambias los tokens de `mundo.css`, DESIGN.md miente hasta que lo regeneres.** Y si un
valor nuevo —un radio, un tamaño— no está en la escala, **se nombra como token**, no se silencia:
el 25/09 el detector marcó los radios de la cabecera y del marco de cristal, y se convirtieron en
`--radio-pildora`, `--radio-cristal` y `--radio-ventana`.

**El hook del detector está activo**: corre tras cada edición de UI y avisa. Las excepciones que
hay son dos, con su motivo escrito: dos marcas en línea en
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
| (a mano, sin el comando) | 13/11, al pasar a «Northstar» |
| `document` (siguiendo su guía a mano; la skill no cargaba en la sesión) | 14/11, al pasar el panel a Northstar: DESIGN.md refrescado, `design.json` con las reglas y los do/don't de DESIGN.md, el menú y las pestañas del panel, y el foco nuevo de los campos |

**No usar `craft`**: está deprecado.

---

## Dependencias

Instaladas y en uso: `motion` (**solo fuera del examen**; también mueve la portada al bajar y el saludo del pie) y `zod`. El fondo de la portada es WebGL2 propio, sin librería. Estilos con **CSS
Modules** — aunque la paleta salga de la escala de Tailwind, aquí son tokens propios —, salvo
**`/vacantes`, que desde el 01/10/2026 es la prueba piloto de shadcn/ui**: Tailwind v4,
`radix-ui`, `class-variance-authority`, `clsx` y `tailwind-merge`. Si la prueba convence, se
extiende pantalla a pantalla; si no, se quita sin haber tocado las demás.

⚠️ **`react-hook-form` y `@hookform/resolvers` están instalados y NO los usa nadie.** Los
formularios son `useState` + `zod.safeParse` a mano, y el bloque que se copia está en
`Registro.tsx`: `safeParse` → primer error por campo (`nuevos[campo] ??= mensaje`) →
`requestAnimationFrame` que enfoca el primer `[aria-invalid="true"]`. Ese
`requestAnimationFrame` no sobra: sin él el atributo todavía no está en el DOM cuando se busca.
**El foco se lleva con `enfocarPrimerCampoConError()` o `enfocarSinTapar(campo)`
(`src/ui/campos/enfocarSinTapar.ts`), nunca con `.focus()` a secas**: el salto del navegador
dejaba el campo y su etiqueta debajo de la cabecera fija. El ayudante mide lo que lleva
`data-pegada-arriba` (la cabecera del portal y la barra del panel) y deja etiqueta, campo y error
debajo; un campo sin etiqueta propia marca su bloque con `data-bloque-del-campo`.

**`@dnd-kit` está instalado y no se usa**: el `SEC` se resolvió con flechas. **Radix entró con
shadcn y solo lo usa `/vacantes`**: fuera de ella, el aviso de postular usa `dialog` nativo, el
recorrido plegable `details`, y apagar el formulario de la decisión es un `fieldset disabled`.
Antes de traer una librería, mira si el HTML ya lo resuelve.

Nada de librería de fechas —`reloj.ts` es crítico— ni de gestor de estado —TanStack Query ya
cubre lo que hay—.

⚠️ **Instálalas dentro del worktree.** `node_modules` no se comparte entre worktrees.
