# Portal del candidato · contexto de trabajo

Última actualización: 2026-08-24 · `layout` corrido y sus P1 arreglados; PR #3 abierto

Este archivo es para retomar el trabajo sin tener que reconstruir nada. Cuenta qué es este
proyecto, con qué habla, qué se decidió y por qué, y qué está a medias.

---

## Respuestas

Responde en el chat de manera breve, corta y directa. Si para implementar algo hace falta que
yo haga algo —ejecutar un script, tocar una configuración— dámelo en una sección **«Flujo de
Implementación»** con los pasos en orden. Si tengo que decidir algo, ponlo en una sección
**«Decisiones»** aparte, para que no se confunda con el texto normal.

## Cómo preguntar

No uses el vocabulario de los documentos del cliente al preguntar: sus términos son ambiguos
(«corte», «gate», «avanzar»). Interpreta el significado con el contexto y pregunta con
palabras propias y concretas, describiendo la situación real.

## Git

**No crees commits.** Los hago yo, y también los PR. Quiero poder ver los cambios antes.
Solo commitea si te lo pido explícitamente.

---

## Qué es esto

La cara que ve **quien postula** a una vacante de Renaser: elegir oportunidad, postular,
responder la evaluación, hacer la prueba del puesto, elegir fecha de simulación y seguir el
estado de su proceso.

**Qué NO es.** El panel del equipo de Talento no está aquí, y **tampoco en el repositorio del
backend**: el `frontend/` de demostración que había allí se borró a propósito. El panel de
verdad vive en RENASER OS (`~/Documentos/RenaserOs`). El panel de administración del rediseño
se hará aparte y más adelante.

---

## Estamos en un rediseño, no en un retoque

El portal que hay en `src/` **se va a reemplazar entero**. Lo único que sobrevive es el
nombre **EX** y su logotipo: la palabra con la hormiga dentro de la X.

| Pieza | Dónde |
|---|---|
| **El maquetado, en el repositorio** | [maquetado/LEEME.md](maquetado/LEEME.md) — las 17 pantallas en HTML plano. **Esto es lo que se lee para construir** |
| El mismo maquetado, para verlo | https://claude.ai/code/artifact/7239da41-c745-472c-9b90-19df9d4ef666 |
| Qué ve el candidato, pantalla por pantalla | [docs/02-QUE-VE-EL-CANDIDATO.md](docs/02-QUE-VE-EL-CANDIDATO.md) |
| La auditoría técnica y sus ocho pendientes | [docs/05-AUDITORIA.md](docs/05-AUDITORIA.md) |
| Estado del rediseño y qué sigue | [docs/03-ESTADO-DEL-REDISENO.md](docs/03-ESTADO-DEL-REDISENO.md) |

### Lo que se decidió (23/08/2026)

| Pantalla | Cómo queda |
|---|---|
| Mis procesos | Cada postulación con su camino de cinco etapas dibujado y un punto donde estás. La acción vive dentro de la etapa |
| Evaluación | Una pregunta por pantalla, con **mapa lateral** de todas y su estado. Resuelve el problema conocido: saltarse una y no poder volver sin pulsar cuarenta veces |
| Cuando no hay nada que hacer | Se dice claro que no hay nada pendiente y se ofrece algo útil mientras tanto. **Trece de los dieciocho estados son esto** |

**Solo tema claro.** Es petición del cliente. Desaparecen el bloque `html[data-theme="dark"]`
y el proveedor de tema; el `index.html` deja de abrir en oscuro.

**Fondo blanco puro y acento índigo `#4338CA`**, en lugar del champagne `#816220`. La razón
no es estética: verde, ámbar y rojo ya tienen significado fijo en el sistema —aprobado, en
duda, error— así que el acento no podía ser ninguno de esos, ni un verde azulado, que junto a
una etiqueta verde real se lee como «aprobado». Al cliente le gusta la estética de Apple pero
pidió que no fuera su azul.

**El acento significa una sola cosa: «te toca a ti».** Marca el panel de la acción pendiente
y el tramo del recorrido donde está el candidato. Si empieza a aparecer en botones sueltos,
titulares o iconos, deja de leerse.

### El mundo visual: «El seguimiento»

Tu postulación como algo que va en camino: hitos cumplidos y un siguiente hito siempre
nombrado. **La acción vive dentro del hito abierto**, no en un botón suelto al pie, para que
«dónde estoy» y «qué hago» sean la misma mirada.

Lo que lo separa de un rastreo de paquete cualquiera: **lo cumplido no se apaga**. Una etapa
cerrada se sigue leyendo con el mismo peso, porque el producto trata de acumular evidencia.

Cuatro reglas de forma que vienen de ahí y no se negocian por comodidad:

- **El estado se lee en la forma antes que en el color** —relleno, contorno grueso, contorno
  fino, tachado—. Quien no distingue colores lee el mismo recorrido.
- **Cero radios** y las reglas a un píxel. Los estados son marcas impresas, no cromo.
- **La tipografía hace la jerarquía.** Ningún recuadro ni sombra crea un nivel que el tamaño
  ya crea.
- **Un solo momento con movimiento**: la marca que se asienta al cerrarse una etapa.

Tipografía **Libre Franklin**, servida desde Google Fonts. No usar Inter, Roboto, Geist,
Instrument Sans ni Space Grotesk: el detector de `impeccable` las marca como sobreexpuestas.

El brief completo está en [docs/04-BRIEF-MIS-PROCESOS.md](docs/04-BRIEF-MIS-PROCESOS.md), y
los tokens con su porqué en [src/estilos/mundo.css](src/estilos/mundo.css).

### Dónde está el código nuevo

| Pieza | Estado |
|---|---|
| `src/estilos/mundo.css` | **La única hoja global que queda.** Todo lo demás son CSS Modules, uno por pantalla |
| `src/estilos/piezas.module.css` | Lo que se repite: los cuatro botones y el enlace de volver. **No se escribe en el JSX**, se trae con `composes` desde la hoja de cada pantalla |
| `src/paginas/vacantes/` | La portada y la ficha de vacante. **Públicas**, se ven sin cuenta |
| `src/paginas/cuenta/` | Entrar —con sus **dos** caminos— y crear cuenta. Comparten `Cuenta.module.css` |
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
| `src/ui/campos/` | Campo, AreaTexto y Consentimiento: etiqueta atada al campo, error atado al campo, y el error dicho en palabras |
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
| 3 | ~~`audit`~~ | **Hecho el 24/08: 17/20.** El informe, en [docs/05-AUDITORIA.md](docs/05-AUDITORIA.md) |
| 4 | ~~`critique`~~ | **Hecho el 24/08: 27/40.** En `.impeccable/critique/`. Dos P0: el cronómetro y la contraseña |
| 5 | ~~`polish`~~ | **Hecho el 24/08**, junto con `typeset`, `harden` y `distill` |

### Lo que dejó `extract` (24/08/2026)

Cincuenta bloques con forma de botón repartidos por dieciséis hojas se quedaron en **cuatro
piezas** en `src/estilos/piezas.module.css`, más el enlace de volver. El CSS del portal pasó de
79,9 kB a 68,9 kB.

Se traen con **`composes`, no con clases en el JSX**: el marcado no cambió ni una línea, y cada
pantalla conserva su nombre propio —`.entregar` se sigue llamando entregar— mientras comparte
la forma. Un botón que se llama por lo que hace se lee; uno que se llama `.botonSecundario`
obliga a ir al JSX para saber qué hace. Y como `composes` añade la clase al elemento, los
`:hover` y `:disabled` de la pieza se aplican solos.

⚠️ **En las piezas solo va la apariencia.** Los márgenes, el `align-self` y los anchos son del
sitio donde está el botón, no de la pieza. Meterlos allí la haría imposible de reusar.

Cinco tokens nuevos en `mundo.css`, todos por valores que estaban escritos a mano en dos sitios
o más: `--tinta-invertida`, `--tinta-pulsado`, `--duda-papel`, `--duda-tinta` y `--mal-pulsado`.
**No queda ni un hex crudo en las hojas de pantalla**, y se comprueba así:

```bash
grep -rno "#[0-9a-fA-F]\{3,8\}" src --include='*.module.css'
```

⚠️ **El antetítulo en versalitas no se extrajo, y `critique` ya decidió qué pasa con él:
se van cinco de los siete.** Se quedan `DECISIÓN · TE PEDIMOS UNA COSA MÁS` —sin él, «Queremos
resolver una duda antes de decidir» se lee como un rechazo— y `CAMBIO EN EL ENCARGO`, que es
título de bloque y no antetítulo. El razonamiento completo está en [DESIGN.md](DESIGN.md).

Después de cualquiera que toque código: `npm test` —los 49 son el contrato— y volver a pasar
los `herramientas/capturar-*.mjs`.

### Lo que se arregló el 24/08 (los P0 y P1 de `audit` y `critique`)

| Qué | Dónde |
|---|---|
| **El cronómetro no tenía estilo ni avisaba** | `Cronometro.tsx` salía con `className='timer'`, una clase que no existía en ninguna hoja. Ahora recibe `--t-cifra`, se pone rojo bajo los diez minutos y **avisa por voz en umbrales** —media hora, diez, cinco, un minuto—, nunca cada segundo |
| **No había recuperación de contraseña** | Ruta `/clave` nueva. **No restablece nada y lo dice**: no hay endpoint. Ofrece el enlace del correo y la dirección del equipo |
| **El título de la pestaña era el mismo en las 22 rutas** | `TituloDeLaPagina` en `Armazon.tsx`, con `matchPath` sobre `patrones` |
| **Una respuesta en blanco decía «guardada»** | Con el tiempo agotado, `Prueba.tsx` no comprobaba el texto vacío. La rama viva sí lo hacía |
| **Lo apagado parecía pulsable** | `.campoEnlace:disabled` no existía y `.secundario:disabled` no llevaba fondo |
| **El detalle pintaba dos veces la acción** | `Proceso.tsx` y `Seguimiento.tsx` renderizaban ambos el `<Link>`. El panel de arriba **solo sale ya si el proceso terminó**, que es cuando no hay hito abierto que aloje el cierre |
| **Un rechazo se veía igual que una espera** | La tarjeta cerrada del hub lleva ahora la **marca tachada** y fondo de papel |
| **Trece tamaños de letra** | Diez tokens `--t-*` en `mundo.css`. **El detector pasó de 168 hallazgos a 0** |
| **La prosa iba a 91-96 caracteres por línea** | `--medida: 47ch` y `--medida-corta: 42ch`. Medido en el navegador: **68-72** |
| **Seis `<button>` sin `type`** | En los pies de `Modal` de la evaluación y la prueba |
| **El aviso rojo del examen parpadeaba en cada pregunta** | Colgaba de la cola de guardado, que se llena al responder y se vacía un segundo después. Ahora cuelga de `error`, que solo tiene valor cuando un guardado **falló de verdad**. El candado de la entrega sigue mirando la cola |

### El portal compone en escritorio (24/08/2026)

Ocupaba 760 px en una pantalla de 1920 y parecía hecho para el teléfono. Ahora el ancho es
`--ancho` (68rem) y **se usa para componer, no para leer**: la prosa sigue cortada por
`--medida`, así que nada alarga sus líneas.

| Pantalla | Qué gana |
|---|---|
| Portada | Las cinco etapas **en horizontal** — son una secuencia. Y cada vacante usa las dos mitades: el puesto a la izquierda, dónde y la entrada a la derecha |
| Ficha | «Lo que harás» y «Lo que buscamos» en paralelo |
| Examen | **El mapa al lado, no encima.** La pregunta ya no se mueve al abrirlo |
| Armazón | La cabecera y el pie van con lo demás: si no, la marca queda metida respecto al contenido |

**Los formularios no se ensanchan** —entrar, crear cuenta, la clave y postular—: un formulario
ancho se lee peor. Privacidad se queda en 48rem.

Cortes en **900 px** para las composiciones y **1100 px** para el mapa del examen.

⚠️ **Las capturas ahora son de tres anchos**: 1920, 1280 y 375. Sin el ancho grande, la red no
ve justamente lo que se acaba de arreglar. `capturar.mjs` se quedó fuera del primer cambio
porque usa un `const TAMANOS` en vez del array en línea, así que **el hub estuvo sin mirarse a
1920**. Si añades un script, comprueba que tiene los tres.

### Lo que dejó `layout` (24/08/2026)

| Qué | Medido |
|---|---|
| **Los paneles crecieron con el contenedor y su texto no** | Relleno de 0,41 → **0,91**. El tope estaba en los párrafos; ahora está en el panel |
| **El mapa del examen volvía a abrirse por arriba entre 900 y 1099 px** | La pregunta saltaba 127 px. Ahora **0 px** en 900, 1000 y 1280 |
| **Dos desfases pegajosos estaban a ojo** | El mapa se pegaba 44 px demasiado arriba y se metía bajo la barra. Ahora son tokens medidos: `--alto-avance: 116px`, `--alto-reloj: 71px` |
| **La prueba componía la pantalla de 30 s y dejaba plana la de 2 h** | `.columnas` solo se usaba en la portada. Ahora el encargo va fijo a la izquierda: el alto pasó de 2220 a **1205 px** y el primer campo de y=718 a **y=352** |
| **La escala del SJT se estiraba a 908 px** | Son cinco dígitos. Tope de 22rem → **352 px** |
| **El aviso del tiempo agotado iba a 106 caracteres por línea** | El único párrafo sin medida, y el más urgente |
| **`space-between` separaba cada vacante de su propia fecha** | 644 px de nada entre dos cosas que son el mismo dato |

⚠️ **Un elemento pegajoso no adivina la altura del que tiene encima**: se mide y se guarda en
un token junto a la barra que la produce. Los dos que había escritos a mano estaban mal.

⚠️ **La medida se elige midiendo, no contando `ch`.** En Libre Franklin el cero es ancho: 62ch
compraban 91-96 caracteres. Si cambias el tope, mídelo en el navegador.

**Dónde vive el mundo visual ahora.** En [DESIGN.md](DESIGN.md), en la raíz: la paleta con el
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

Dependencias acordadas. Instaladas y en uso: `motion` (**solo fuera del examen**),
`react-hook-form` + `zod`. **`@dnd-kit` está instalado y no se usa**: el `SEC` se resolvió con
flechas, que es lo que funciona en un teléfono. **Radix no se instaló y no hace falta**: los tres
sitios que lo pedían los resuelve el HTML. Estilos con **CSS Modules**, no Tailwind.

⚠️ **Instálalas dentro del worktree.** `node_modules` no se comparte entre worktrees, así que
un `npm install` en el repositorio principal no llega aquí — ya pasó dos veces.

**Antes de traer Radix, mira si el HTML ya lo resuelve.** El aviso de postular usa `dialog`
nativo, el recorrido plegable usa `details`, y apagar el formulario de la decisión entero es un
`fieldset disabled`: foco atrapado, tecla de escape y teclado vienen gratis. Radix es para lo
que la plataforma no cubre.

Nada de librería de fechas —`reloj.ts` es crítico—, nada de gestor de estado —TanStack Query
ya cubre lo que hay— y ningún kit de componentes encima de los primitivos.

---

## Con qué habla

| Pieza | Dónde |
|---|---|
| Este portal | `github.com/RENASER-LAB/RenaserOsPostulantes` · desplegado en Vercel |
| Backend | `github.com/RENASER-LAB/ai-agents--spring-ai` · Spring Boot, Java 25 |
| Backend desplegado | `https://18-204-177-210.nip.io` · EC2 en AWS, con IP fija |

La dirección del backend es una IP con `nip.io`, que resuelve cualquier `IP.nip.io` a esa IP
y por eso permite sacar un certificado de Let's Encrypt sin dominio registrado. **Es
provisional**: cuando Renaser tenga dominio propio se cambia la línea de `vercel.json` y ya.

Render quedó atrás en el commit `089e8df`. No vuelvas a apuntar ahí: los endpoints nuevos
—entre ellos `POST /portal/auth/acceso`, el que canjea el enlace del correo— solo existen en
AWS.

⚠️ **A qué base escribes depende de a dónde apunte `.env.local`, y la diferencia importa.**

| `API_URL` | El portal habla con | Y eso escribe en |
|---|---|---|
| `https://18-204-177-210.nip.io` | El Spring de AWS | **La base de producción, junto a candidatos reales** |
| `http://localhost:8081` | Tu Spring local | `renaser-postgres`, un Postgres en Docker, solo tuyo |

Apuntando a AWS, **registrarse o postular escribe junto a candidatos reales aunque el portal
corra en tu máquina**. Apuntando al local, no toca nada de producción.

⚠️ **El backend local escucha en 8081, no en 8080.** En el 8080 vive `postgresql-adminer-1`, que
responde 200 y hace creer que el backend está arriba cuando no lo está.

Aun así, **los scripts de `herramientas/capturar-*.mjs` interceptan todas las respuestas** con
`contexto.route(...)` y no llegan a pedirle nada a ningún backend. Eso no se toca: es lo que
hace que mirar una pantalla sea gratis y seguro en cualquiera de las dos configuraciones.

---

## Levantarlo en un equipo nuevo

Hace falta Node **20.19 o superior**. Con 20.17 compila pero Vite avisa en cada arranque.

```bash
npm install
```

El portal llama a `/api`, y Vite lo reenvía al backend. El destino sale de `API_URL`, que se
pone en un `.env.local` — **no está en el repositorio, hay que recrearlo**. Contra tu Spring
local:

```bash
echo "API_URL=http://localhost:8081" > .env.local
```

Y para trabajar contra el backend desplegado sin levantar nada más:

```bash
echo "API_URL=https://18-204-177-210.nip.io" > .env.local
```

```bash
npm run dev
```

Queda en `http://localhost:5174`.

Al comprobar el backend a mano, la base es `/api/v1/portal`, **no** `/api`. Pedir
`/api/vacantes` devuelve 500 y parece que el backend esté caído cuando no lo está.

---

## Reglas que el código nuevo hereda

Los archivos se pueden reescribir enteros. Estos comportamientos no: cada uno costó un fallo
real. Hoy viven en `src/dominio/estados.ts`, `src/dominio/reloj.ts` y `src/api/cliente.ts`,
que conviene leer antes de tirarlos.

**Una sola fuente para los 18 estados.** El backend manda un estado con nombre
(`PRUEBA_TURNO_CANDIDATO`, `PERFIL_CALIFICANDO`…) y un solo archivo traduce cada uno a lo que
ve el candidato: etapa, título, ayuda y botón. Ninguna pantalla sabe qué estados existen. Si
el backend añade uno, se toca ahí y en ningún otro sitio. La regla que lo ordena: si acaba en
`TURNO_CANDIDATO` hay botón; si acaba en `CALIFICANDO`, `POR_HABILITAR` o `POR_CONFIRMAR`,
solo se informa y se espera.

**La hora la manda el servidor.** El cronómetro de la prueba no cuenta hacia atrás desde un
número: recalcula cuánto falta hasta la hora de vencimiento del backend, descontando el
desfase entre relojes (sale de la cabecera `Date` de cada respuesta). Cambiar la hora del
equipo no lo mueve.

**Una sola puerta al backend.** Un módulo pone el token, convierte los errores HTTP en algo
que la pantalla pueda enseñar, apunta la hora del servidor y cierra la sesión sola cuando un
401 revela que el token ya no vale.

**`grupoPrioridad` nunca se pinta.** Llega en la respuesta de las postulaciones, pero es la
clasificación interna del equipo.

**Las ocho formas de respuesta del banco v3.** `PC`, abierta/`V`, `EF-4`, `SJT-R`, `SEC`,
`INV`, `DE` y `CD`. La forma exacta de lo que se envía la valida el backend y responde 400 si
no cuadra.

---

## Trampas que ya costaron un fallo

No las reintroduzcas, aunque se reescriba todo.

**`useEffect` con cuerpo corto.** `useEffect(() => window.scrollTo(0, 0), [ruta])` devuelve lo
que devuelva `scrollTo`, y React se lo queda como función de limpieza. Al desmontar intenta
llamarlo y lanza `destroy is not a function`, que se lleva el árbol entero: página en negro.
Siempre cuerpo entre llaves salvo que devuelvas limpieza a propósito.

**Cancelar el guardado con retardo en la limpieza.** El efecto que guardaba el texto de la
evaluación cancelaba el envío al desmontarse, y como dependía de la pregunta, cambiar de
pregunta lo cancelaba. Quien escribía y pulsaba «Siguiente» rápido perdía la respuesta.

**Dar por guardado lo que solo se ha enviado.** Esa corrección no bastó: lo pendiente se
borraba al mandarlo, así que un guardado que fallaba —un 500, una red que parpadea— se perdía
igual. El candidato llegaba al final con «16 de 20 respondidas» sin saber cuáles faltaban.
**Lo escrito no sale de la cola hasta que el servidor lo confirma**, se reintenta solo cada
cinco segundos, se dice cuántas están sin guardar y no se deja entregar mientras quede
alguna. Vale para la evaluación y para la prueba.

**Indicadores que mienten.** Ese mismo sitio ponía «Respuesta guardada» siempre, porque era
texto fijo. Si un indicador dice que algo está a salvo, tiene que salir de comparar con lo
que hay en el servidor. Y una pregunta en blanco no está «guardada»: está **sin responder**,
que es otra cosa.

**Creer que el backend habla `application/json`.** No: Spring devuelve sus errores como
`application/problem+json`. Comprobar el tipo con `includes('application/json')` da falso
sobre ese, así que **todos** los errores se leían con `.text()` y su explicación se perdía.
Meses sin poder diagnosticar nada. Se comprueba con `includes('json')`.

**Límites del backend que el portal no conoce.** El texto de una respuesta tiene un
`@Size(max = 20_000)`. Si el portal deja escribir más, el guardado rebota y la respuesta no
llega.

**Mirar el cuerpo antes que el estado.** Un 500 vacío se colaba como éxito. Primero el
estado, después el cuerpo.

**`<button>` sin `type`.** Por defecto es de envío. Dentro de un formulario, lo envía.

---

## Cómo se escribe aquí

- **Todo en español**, incluidos los nombres del código, como en el backend. Sin eñes ni
  tildes en identificadores: el backend usa `contrasena`, no `contraseña`.
- Carpetas por funcionalidad, no por tipo de archivo.
- Los comentarios explican **por qué**, no qué. Si un comentario describe lo que ya se lee en
  la línea siguiente, sobra.
- Las rutas del portal viven todas en un solo archivo. No escribir direcciones sueltas.
- Los tipos de la API copian los `record` de Java uno a uno. Si cambia allá, cambia aquí.
- **No añadir CORS al backend.** Con la reescritura de Vercel no se necesita, y añadirlo
  abriría el backend a otros orígenes sin motivo.

---

## Lo que falta, y no es diseño

| Qué | Estado |
|---|---|
| **Decisión ámbar** | `DECISION_TURNO_CANDIDATO` existe, pero **no hay ruta** para leer qué evidencia se pide ni para enviarla. La pantalla está entera y el formulario, apagado |
| **Validación** | Tampoco hay ruta: ni días, ni responsable, ni métricas. La pantalla existe y **no se enlaza** hasta que las haya |
| **Si el consentimiento de futuras vacantes está activo** | Solo hay ruta para retirarlo, no para leerlo. Por eso privacidad no enseña ninguna etiqueta de «lo tienes activado» |
| **Saber cómo se llama el candidato** | El backend solo devuelve `{ token, usuarioId }` al entrar. Quien entre desde otro navegador verá el portal sin su nombre |
| **El correo no sale** | El backend tiene `renaser.correo.transporte` en `log` por defecto. Todo «te avisaremos por correo» es hoy una promesa que el sistema desplegado puede no cumplir |
| **Los consentimientos van a crecer** | Todavía no nombran a DeepSeek ni a Google, y tienen que hacerlo antes del primer candidato real. El bloque necesita sitio para un texto bastante más largo |
| **La dirección del backend es prestada** | `nip.io` es de terceros y la IP va escrita a mano en `vercel.json` |
| **Cuenta de prueba en la base real** | `prueba.portal.qa.20260819@example.com` quedó como candidata activa, postulada a Ingeniero/a de Infraestructura (`f7a53fcc-11eb-4369-be96-bee577bdea85`) |
| **Vercel escribe en producción** | El portal desplegado usa la misma base real |

Pendiente de comprobar: si hay evaluaciones ya entregadas con menos respuestas de las que
deberían. Las que se perdieron **no se recuperan**, nunca llegaron al servidor.

---

## Mantener este archivo al día

Es lo primero que lee una sesión nueva. **Si miente, la sesión trabaja sobre una idea falsa
del proyecto** — ya pasó: decía que el tema oscuro era el de la marca cuando el código ya
forzaba el claro.

- **Fechar** la sección que cambie.
- **Borrar lo que dejó de ser cierto**, no acumular. Este archivo se lee entero cada sesión:
  cuanto más largo, menos se sostiene.
- **Verificar antes de escribir.** Lo que dice el código, no lo que se recuerda.
- Es un mapa para orientarse, no un historial. Lo que se hizo un día concreto va a un
  documento en `docs/`; aquí queda solo el estado presente.
