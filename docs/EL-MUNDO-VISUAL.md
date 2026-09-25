# El mundo visual y dónde está el código

Las decisiones de diseño que gobiernan el portal entero, y el mapa de carpetas de `src/`.
El brief de la pantalla piloto está en [04-BRIEF-MIS-PROCESOS.md](04-BRIEF-MIS-PROCESOS.md) y
los tokens con su porqué en [`src/estilos/mundo.css`](../src/estilos/mundo.css).

---

> ⚠️ **La paleta cambió el 25/09/2026 y este documento todavía no.** Lo de abajo describe
> «El escaparate»: fondo pastel cálido `#FBF1E9`, acción negra `#0A0A0A` con radio 4 px, y el
> coral `#FF7C61` como único color, para «te toca a ti». Desde ese día la paleta es la de una
> referencia que trajo el cliente —gris frío de Tailwind v4, página `#F9FAFB`, acción índigo
> `#615FFF` con radio 8 px— y **el coral ya no existe**: el turno se pinta del mismo índigo que
> la acción. Lo que sigue siendo cierto es la estructura —nube sobre página, estado en la forma,
> los componentes y su porqué—; los **valores**, en [`mundo.css`](../src/estilos/mundo.css), que es la fuente de verdad.
> Reescribir este documento está pendiente.

## Estamos en un rediseño, no en un retoque

El portal que hay en `src/` **se va a reemplazar entero**. Lo único que sobrevive es el
nombre **EX** y su logotipo: la palabra con la hormiga dentro de la X.

| Pieza | Dónde |
|---|---|
| **El maquetado, en el repositorio** | [maquetado/LEEME.md](../maquetado/LEEME.md) — las 17 pantallas en HTML plano. **Esto es lo que se lee para construir** |
| El mismo maquetado, para verlo | https://claude.ai/code/artifact/7239da41-c745-472c-9b90-19df9d4ef666 |
| Qué ve el candidato, pantalla por pantalla | [02-QUE-VE-EL-CANDIDATO.md](02-QUE-VE-EL-CANDIDATO.md) |
| La auditoría técnica y sus ocho pendientes | [05-AUDITORIA.md](05-AUDITORIA.md) |
| Estado del rediseño y qué sigue | [03-ESTADO-DEL-REDISENO.md](03-ESTADO-DEL-REDISENO.md) |

### Lo que se decidió (23/08/2026)

| Pantalla | Cómo queda |
|---|---|
| Mis procesos | Cada postulación con su camino de cinco etapas dibujado y un punto donde estás. La acción vive dentro de la etapa |
| Evaluación | Una pregunta por pantalla, con **mapa lateral** de todas y su estado. Resuelve el problema conocido: saltarse una y no poder volver sin pulsar cuarenta veces |
| Cuando no hay nada que hacer | Se dice claro que no hay nada pendiente y se ofrece algo útil mientras tanto. **Trece de los dieciocho estados son esto** |

**Solo tema claro.** Es petición del cliente. Desaparecen el bloque `html[data-theme="dark"]`
y el proveedor de tema; el `index.html` deja de abrir en oscuro.

~~**Fondo blanco puro y acento índigo `#4338CA`**~~ — decidido el 23/08/2026 y **sustituido
el 10/09/2026** por la acción en negro. El fondo pasó por tres valores antes de asentarse:
gris `#F5F5F5` ese día, blanco puro el 11/09, y **el pastel cálido `#FBF1E9` desde el 15/09**,
que es el que está vigente. Lo que sigue vigente de
aquella decisión es el porqué: verde, ámbar y rojo ya tienen significado fijo en el sistema
—aprobado, en duda, error—, así que ni el acento ni la acción podían ser ninguno de esos.

**El color significa una sola cosa: «te toca a ti».** Marca el panel de la acción pendiente y
el tramo del recorrido donde está el candidato. Si empieza a aparecer en botones sueltos,
titulares o iconos, deja de leerse — y por eso la acción va en negro y no en color.

### El mundo visual: «El escaparate» (desde el 10/09/2026)

⚠️ **Este documento tuvo dos mundos anteriores.** Primero «El seguimiento» —hitos impresos,
cero radios, Libre Franklin—, después «El canto» —nube difractando luz, espectro, violeta
`#5638d6`, Mulish—. Los dos se fueron. Si encuentras alguno nombrado en `docs/`, está viejo.

Un cuarto de luz cálida con una sola pieza iluminada. El fondo es un pastel anaranjado y las
superficies de encima son nube blanca, así que se leen como objetos puestos sobre una mesa. En
medio hay una vitrina —tarjeta de borde grueso y sombra— y dentro está el producto: el
recorrido del candidato y lo que le toca ahora.

⚠️ **El fondo pasó por tres valores en una semana**: gris `#F5F5F5` hasta el 11/09/2026,
blanco puro ese mismo día, y `#FBF1E9` desde el 15/09. La separación entre página y superficie
es de **1,113:1**, un punto mejor que la del gris con el que empezó.

Las reglas de forma que vienen de ahí:

- **La acción es negra** (`#0A0A0A`), no de color. Un botón de color compite con lo único que
  tiene permiso para llamar la atención, que es el turno del candidato.
- **El color aparece una vez por pantalla**: el coral `#FF7C61` y su bruma rosa, y significan
  «te toca a ti». Dos ya es ninguno.
- **El estado se lee en la forma antes que en el color.** Quien no distingue colores lee el
  mismo recorrido.
- **Esquina corta**: los controles llevan 4 px. ⚠️ **Ya no son píldoras**; `--radio-control`
  valía `999px` y ahora vale `4px`.
- **La tipografía hace la jerarquía.** Ningún recuadro ni sombra crea un nivel que el tamaño
  ya crea.
- **El movimiento sirve a la continuidad y al cambio de estado**, nunca a la decoración, y
  respeta `prefers-reduced-motion`. ⚠️ Con el reloj corriendo —evaluación, prueba,
  cuestionario— **no se mueve nada**, y eso lo aplica el armazón: la única pieza que una
  pantalla no puede rechazar es la que le pone su contenedor.

Tipografía **Figtree**, variable y **servida por el propio sitio** desde
`public/tipografia/` — una app instalada no puede quedarse sin titulares por falta de
cobertura. Rango 400–700: **el peso 200 ya no existe** y los titulares van en 600. No usar
Inter, Roboto, Geist, Instrument Sans ni Space Grotesk: el detector de `impeccable` las marca
como sobreexpuestas.

El sistema entero, con sus reglas nombradas y sus componentes, está en
[DESIGN.md](../DESIGN.md); los tokens con su porqué en
[src/estilos/mundo.css](../src/estilos/mundo.css), que es la verdad cuando algo no cuadre.

**Va migrada la portada, y desde el 10/09/2026 también el suelo que comparten las
diecisiete**: la especificación única de botón, los tres paneles, el velo de los modales y la
cabecera. En el código del candidato **ya no queda ningún color del mundo anterior escrito a
mano** —la pizarra `#232b36` y el violeta `#5638d6` desaparecieron de las trece hojas que los
tenían—.

**«El canto» ya no se ve en ninguna parte.** `src/ui/Canto.tsx` se borró el 10/09/2026, el
recorrido de «Mis procesos» dice el estado con la forma de cada franja —grosor y relleno— en
vez de con el espectro irisado, y la galería de portadas de «Mi perfil» se repintó con neutros.
Los tokens `--canto-*` siguen declarados porque son los códigos que el backend tiene guardados
en cada perfil; sus valores ya no se usan.

**La migración está completa: las dieciocho pantallas del candidato están compuestas.** Eran
diecisiete hasta el 23/09/2026, cuando llegaron de main `/clave` reescrita y `/restablecer`
nueva. Lo que queda son decisiones de producto anotadas en [PENDIENTES](PENDIENTES.md), no
trabajo de diseño.

### Dónde está el código nuevo

| Pieza | Estado |
|---|---|
| `src/estilos/mundo.css` | **La única hoja global que queda.** Todo lo demás son CSS Modules, uno por pantalla |
| `src/estilos/piezas.module.css` | **La única especificación de botón del portal**, más los tres paneles (`.turno`, `.panelDeEspera`, `.indispensable`), la cabecera de sección y el plegable. **No se escribe en el JSX**, se trae con `composes` desde la hoja de cada pantalla. Si hace falta una forma que no está ahí, se añade ahí — ninguna pantalla se dibuja la suya |
| `src/estilos/pagina.module.css` | **El esqueleto de una pantalla**: el carril, el encabezado, el reparto en columnas, el bloque y el hueco declarado. Se separa de `piezas.module.css` porque son dos preguntas: una pantalla puede componerse entera sin usar ni un botón |
| `src/paginas/vacantes/` | La portada y la ficha de vacante. **Públicas**, se ven sin cuenta |
| `src/paginas/cuenta/` | Entrar —un solo formulario desde el 28/08— y crear cuenta. Comparten `Cuenta.module.css` |
| `src/paginas/postular/` | Postular. **Aquí vive el único descarte automático del sistema** |
| `src/paginas/procesos/` | «Mis procesos», el detalle de una postulación y la línea de hitos |
| `src/paginas/evaluacion/` | La evaluación y los ocho formatos del banco v3. **Solo se migró el estilo: la lógica no se tocó** |
| `src/paginas/prueba/` | La prueba, en sus dos formas. Igual: estilo migrado, lógica intacta |
| `src/paginas/simulacion/` | Elegir fecha, y la sesión ya reservada con su agenda. Dos momentos en una ruta |
| `src/paginas/validacion/` | **Nueva.** El periodo trabajando. Ver más abajo por qué no se enlaza |
| `src/paginas/decision/` | El caso ámbar. El formulario va entero y **apagado**, ver más abajo |
| `src/paginas/privacidad/` | Las tres acciones que se confunden. Las dos que no se deshacen ahora preguntan antes |
| `src/ui/Estados.module.css` | Cargando, fallo, acceso necesario, vacío y el salvavidas. Comparten hoja porque comparten forma |
| `src/ui/Modal.tsx` | El aviso compartido: entrega de la evaluación, de la prueba, y las dos confirmaciones de privacidad |
| `src/ui/TextoPlano.tsx` | El texto del backend con sus enlaces. Ya no usa `--acento` |
| `src/ui/campos/` | Campo, Seleccion, AreaTexto y Consentimiento: etiqueta atada al campo, error atado al campo, y el error dicho en palabras. La marca de obligatorio —asterisco para quien mira, «obligatorio» para quien escucha— sale de aquí y está en [REGLAS-DEL-CODIGO.md](REGLAS-DEL-CODIGO.md) |
| `src/app/Armazon.tsx` | Cabecera y pie nuevos, ya globales |

`src/estilos/base.css` y `src/estilos/variables.css` **están borradas**, y con ellas su import
en `main.tsx` y el `BarraPasos.tsx` que ya no usaba nadie. Si algo se ve sin estilo, es que
quedó una clase suelta del portal viejo: se busca con `grep -rn 'className="' src`, y lo único
que debe salir son las tres de `Marca.tsx`, que viven en `mundo.css`.

`src/dominio/estados.ts` creció con cuatro funciones y no se quitó nada de lo que ya había:

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
Lo que hace la pantalla es nombrar los requisitos que dijo no cumplir, decir que la postulación
se cerrará de inmediato y que no podrá volver a postular, y dejarle elegir. La opción por
defecto del aviso es volver y revisar.

### La evaluación: los 35 tests son la especificación

`Evaluacion.test.tsx` y `Formatos.test.tsx` prueban exactamente los fallos que ya costaron
respuestas perdidas: que lo escrito se mande al cambiar de pregunta, que lo rechazado no se dé
por guardado, que el aviso sobreviva al cambio de pregunta, que no se pueda entregar con algo
pendiente, y las ocho formas de responder.

**Al rehacer esta pantalla se migró el estilo y no se tocó la lógica**, y los 49 tests siguieron
en verde en cada paso. Si en el futuro hay que cambiar el comportamiento, esos tests son el
contrato: si uno se pone rojo, la pregunta no es cómo callarlo.

Dos avisos por si se retoca:

- **No partir textos con elementos dentro.** Poner `<b>` alrededor de los números de «Pregunta 2
  de 4» rompió cuatro tests, y por la misma razón que rompe a un lector de pantalla: la frase
  deja de leerse de una pieza.
- **El SEC se ordena solo con flechas, no arrastrando.** Arrastrar va mal en un teléfono, y
  desde el teléfono responde casi todo el mundo. `@dnd-kit` está instalado pero **no lo importa
  nadie**, y `Formatos.module.css` conserva `.asa` y `.arrastrando` de ese intento: es CSS
  muerto. Si algún día se cablea el arrastre, las flechas se quedan igual — son lo probado.
- **`.letra` también es CSS muerto, y a propósito.** La letra de una opción va pegada a su texto
  con `conLetra()`. Separarla en su propio `<span>` deja el nombre accesible como
  «a.Aviso antes de mover nada», sin espacio, y rompe la prueba de `INV`. Es la misma trampa que
  «Pregunta 2 de 4».

### Dos pantallas que están completas y no están conectadas

Las dos se maquetaron enteras a propósito, para poder juzgarlas y para dejar escrito qué hay
que pedirle al backend. Ninguna finge tener datos que no tiene.

**Decisión ámbar** (`/procesos/:uuid/decision`). El formulario está entero y **deshabilitado**,
con un `fieldset disabled`, y se dice por qué antes de que nadie escriba. La acción que sí
funciona —escribirle al equipo— es la que lleva el acento. Dejarlo escribible para fallar al
pulsar sería la versión peor: se pierde lo escrito, y lo que se aprende es que la pantalla
miente. Los endpoints que hacen falta están en la cabecera de `Decision.tsx`.

**Validación** (`/procesos/:uuid/validacion`). La ruta existe y funciona, pero **no se enlaza
desde ningún sitio**: `VALIDACION_TURNO_CANDIDATO` sigue llevando al detalle del proceso.
El maquetado tiene «Día 6 de 15», una barra al 40 % y un nombre de responsable, y de todo eso
el backend no expone nada. Enseñárselo inventado a quien de verdad está trabajando esos días
es peor que no enseñarlo — la misma regla por la que «Mis procesos» pinta el recorrido sin
fechas. Lo que sí sale es real: la vacante, y la fecha de inicio leída del historial.
**Conectarla es una línea en `dominio/estados.ts`** cuando el backend abra su ruta.

### Lo que sigue

Ahora tocan **los comandos de `impeccable`**, sobre el portal completo, que es donde rinden.
Correrlos pantalla a pantalla es caro y no ve lo que importa: la consistencia entre ellas.

| Orden | Comando | Qué hace |
|---|---|---|
| 1 | ~~`extract`~~ | **Hecho el 24/08.** Ver abajo |
| 2 | ~~`document`~~ | **Hecho el 24/08.** `DESIGN.md` en la raíz y `.impeccable/design.json` al lado |
| 3 | ~~`audit`~~ | **Hecho el 24/08: 17/20.** El informe, en [05-AUDITORIA.md](05-AUDITORIA.md) |
| 4 | ~~`critique`~~ | **Hecho el 24/08: 27/40.** En `.impeccable/critique/`. Dos P0: el cronómetro y la contraseña |
| 5 | ~~`polish`~~ | **Hecho el 24/08**, junto con `typeset`, `harden` y `distill` |

El registro de qué dejó cada comando de `impeccable` ese día —`extract`, `audit`, `critique`,
`layout`— está en la [bitácora de agosto](BITACORA-2026-08.md), en «Las corridas de
`impeccable`». Lo que sigue son las reglas que salieron de ahí y siguen vigentes.

---

**Dónde vive el mundo visual ahora.** En [DESIGN.md](../DESIGN.md), en la raíz: la paleta con el
porqué de cada color, la escala tipográfica, las ocho **reglas con nombre** —«la regla de una
sola voz», «la regla de la forma primero»…— y los do's y don'ts. Al lado va
`.impeccable/design.json`, que lleva lo que el formato de `DESIGN.md` no admite: las rampas
tonales, las tres sombras, el movimiento y ocho componentes en HTML y CSS que el panel puede
pintar. **Los dos se regeneran juntos**, nunca uno solo.

⚠️ **Si cambias los tokens de `mundo.css`, `DESIGN.md` miente hasta que lo regeneres.** Es el
mismo riesgo que tiene este archivo, y se arregla igual: `/impeccable document`.

⚠️ **`document` estuvo prohibido y ya no lo está.** La razón era que generaba `DESIGN.md` a
partir del código, y el código era el portal viejo. Ese código ya no está.

**No usar `craft`**: está deprecado.

**Cómo se construyó cada pantalla**, por si hace falta repetirlo: escribir su `.module.css`
con los tokens de `mundo.css`, migrar las clases del `.tsx` sin tocar la lógica, correr
`npm test` (los 49 son el contrato), y mirarla de verdad con un script de
`herramientas/capturar-*.mjs` en escritorio y en móvil.

Dependencias acordadas. Instaladas y en uso: `motion` (**solo fuera del examen**) y `zod`.

⚠️ **`react-hook-form` y `@hookform/resolvers` están instalados y NO los usa nadie** (corregido
el 26/08: este archivo decía que sí). Ni un `useForm` ni un `zodResolver` en todo `src`. **Los
formularios de aquí son `useState` + `zod.safeParse` a mano**, y el bloque exacto que se copia
está en `Registro.tsx`: `safeParse` → primer error por campo (`nuevos[campo] ??= mensaje`) →
`requestAnimationFrame` que enfoca el primer `[aria-invalid="true"]`. Ese `requestAnimationFrame`
no sobra: sin él el atributo todavía no está en el DOM cuando se busca.

**`@dnd-kit` está instalado y no se usa**: el `SEC` se resolvió con flechas, que es lo que
funciona en un teléfono — y el reordenar del perfil, igual. **Radix no se instaló y no hace
falta**: los tres sitios que lo pedían los resuelve el HTML. Estilos con **CSS Modules**, no
Tailwind.

⚠️ **Instálalas dentro del worktree.** `node_modules` no se comparte entre worktrees, así que
un `npm install` en el repositorio principal no llega aquí — ya pasó dos veces.

**Antes de traer Radix, mira si el HTML ya lo resuelve.** El aviso de postular usa `dialog`
nativo, el recorrido plegable usa `details`, y apagar el formulario de la decisión entero es un
`fieldset disabled`: foco atrapado, tecla de escape y teclado vienen gratis. Radix es para lo
que la plataforma no cubre.

Nada de librería de fechas —`reloj.ts` es crítico—, nada de gestor de estado —TanStack Query
ya cubre lo que hay— y ningún kit de componentes encima de los primitivos.

