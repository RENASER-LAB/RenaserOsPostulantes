# Bitácora · septiembre 2026

Lo que se hizo cada día, en orden inverso. Es historial: **para saber cómo funciona algo hoy,
mira el documento temático que corresponda** (empieza por [README.md](README.md)); esto explica
por qué llegó a ser así y qué se probó por el camino.

Sigue en [BITACORA-2026-08.md](BITACORA-2026-08.md).

**Al 10/09/2026, el titular del mes:** el portal cambió de mundo visual —«El canto» se fue
y entró «El escaparate»: acción en negro, Figtree y esquina corta, sobre un fondo que acabó
siendo el pastel cálido `#FBF1E9` el 15/09—. Antes de eso: el ranking se corta por de quién es la pelota; «Mi
perfil» tiene foto, portada, currículum propio y diplomas; empleos, estudios y
certificaciones comparten UNA cronología; la caja significa «esto te toca»; y al postular ya
no se vuelve a subir el currículum. Lo del 07/09 se documentó en
[06-FLUJO-COMPLETO.md](06-FLUJO-COMPLETO.md), no aquí.

---

## Las pantallas de relleno se ponen encima, y las puertas del panel entran (24–25/09/2026)

Cuatro cosas, todas pedidas mirando la pantalla.

**Las cinco pantallas de relleno pasan a nube.** «Acceso necesario», «Proceso cerrado»,
cargando, el fallo y el vacío comparten `.marco` en `Estados.module.css`, y ese marco era un
recuadro del **mismo color que la página** separado solo por una línea de `--regla`: contra
`--cielo` eso da **1,1:1**, es decir, nada. En este mundo lo que separa una superficie es la
nube blanca encima del pastel, no su contorno. Son 14 archivos los que la usan, dos de ellos
del panel, así que el cambio se vio en todo el portal de una vez.

⚠️ **`.marco` sigue repitiendo a mano las medidas de `bloqueHolgado` y NO lo compone.**
Componerlo pondría las dos clases con la misma especificidad, y el `@media` de teléfono de esa
misma hoja baja el relleno a `--e5`: cuál gana lo decidiría el orden del bundle. Mientras ese
`@media` exista, se queda escrito.

**`/admin/entrar` pasa a ser una tarjeta centrada**, como `/ingresar`, y las tres puertas del
panel —con `/admin/clave` y `/admin/restablecer`— se meten **dentro del armazón del portal**.
Antes vivían fuera de los dos armazones, y al ir del pie del portal a `/admin/entrar` la
cabecera desaparecía de golpe. Se eligió la cabecera del candidato entera a sabiendas de que
deja dos «entrar» distintos en la misma pantalla; la alternativa descartada era una barra
propia con la marca y «Volver al portal». `ArmazonPanel` sigue fuera: ahí vive el candado que
manda a `/admin/entrar`, y meter esa pantalla dentro sería un bucle.

Al entrar en el armazón, las tres perdieron su `<Marca>` propia —salían dos EX seguidas— y las
dos de contraseña recibieron la superficie de nube por el mismo `claseFormulario` que ya usaba
el portal.

⚠️ **El centrado solo cupo al quitar el bloque «¿No puedes entrar?» y la bajada del titular**,
las dos por petición. Con ellos la pantalla medía más que la ventana, y centrar lo que no cabe
desborda por los dos lados: a lo que se sale por arriba el navegador no deja llegar. Medido en
producción: 252 arriba / 243 abajo a 900 px, los mismos 9 px de asimetría cabecera-pie que
tiene `/ingresar`. El titular pasó a **«Panel de Empresa.»**.

**La puerta de desarrollo deja de existir en producción.** Estaba visible en el Vercel, donde
el backend ya la rechaza pero cualquiera la veía y la probaba. Ahora va detrás de
`import.meta.env.DEV || import.meta.env.VITE_PUERTA_DESARROLLO === '1'`: constantes que Vite
sustituye al construir, así que el bloque entero se va en el sacudido de árbol —comprobado con
`npm run build` y `grep` en `dist/`—. No está escondida: no llega a compilarse.

⚠️ **`DEV` solo no bastaba.** Dos cosas la abren desde la interfaz —`verificar-panel.mjs:34` y
`13-etapas.spec.ts:100`— y la configuración de Playwright habla de levantar un **preview**, que
es un paquete construido donde `DEV` es falso. De ahí la bandera. Está en
[TRABAJAR-EN-LOCAL.md](TRABAJAR-EN-LOCAL.md) con la tabla de los cuatro casos.

**«Inicio» sube deslizándose.** Pulsarlo estando en la portada **no hacía absolutamente nada**:
el efecto dependía de `[pathname, hash]` y ninguno de los dos cambia. Ahora va contra `key`,
como `LlevarAlAncla`, y sube con el mismo deslizamiento con el que «Vacantes» baja. Medido
frame a frame, porque un salto y un deslizamiento acaban los dos en 0 y lo que los separa es
cuántas posiciones intermedias hay: **30** al bajar, **30** al subir, **2** al cambiar de
pantalla o con `prefers-reduced-motion`. Cambiar de pantalla sigue saltando a propósito —lo que
llega es contenido nuevo y no hay recorrido que seguir con la vista—.

**Se probó el fondo en morado y se revirtió.** Quedó anotado que no es un valor sino dos: el
`--cielo` y el `#f7ebe1` de la cinta hundida de la portada, que está en cálido a propósito
porque es el único sitio donde algo hundido se apoya directo en el fondo. Con el morado puesto
se vio además que el coral y el rosa del botón pasan de ser familia a ser complementarios.

---

## La contraseña olvidada entra al escaparate (23/09/2026)

Se trajo main a la rama del rediseño: cuatro commits (#52 a #55). Tres son del panel y quedan
fuera de alcance; el cuarto trae **dos pantallas del candidato** que había que componer,
`/clave` —que dejó de ser un cartel explicando que no se podía— y `/restablecer`, nueva.

**El formulario de las dos no es del portal.** Vive en `src/ui/recuperacion/`, compartido con
el panel, y estaba escrito contra la disposición del panel: formulario a pelo sobre el fondo,
sin superficie. En el portal eso deja `/clave` desnuda justo al lado de `/registro` y
`/acceso`, que sí van sobre nube — y la propia hoja de esas pantallas ya avisaba de por qué:
«un formulario sin superficie no se lee como una cosa: se lee como página».

Meter la superficie dentro de la pieza compartida habría arrastrado al panel a un mundo al que
no entró. Así que la superficie **entra desde fuera**, por un `claseFormulario` opcional: el
portal pasa la suya, el panel no pasa nada y queda igual que estaba.

⚠️ **Esa clase trae la superficie y nada más.** La dirección, el hueco y el aire ya los pone
la hoja compartida; repetirlos dejaría en manos del orden del bundle saber cuál gana.

Los titulares eran `<h1>` a secas y ahora llevan el `22ch` del portal, escrito a mano en la
hoja compartida en vez de compuesto, por la misma razón: componerlo desde ahí le exportaría el
carril del portal al panel.

**Los cinco conflictos de la fusión, y ninguno pedía elegir un bando salvo uno:**

  - `Clave.tsx`: gana main entero. Nuestra versión era el diseño del cartel viejo, y el cartel
    ya no existe — la pantalla ahora manda el enlace de verdad.
  - `Cuenta.module.css`: se van `.caminos`, `.camino`, `.tituloCamino` y `.queEs`, que
    vestían ese cartel. Se comprobó que no los usa nadie más.
  - `Ingresar.tsx`: se quedan las dos cosas. La tarjeta del rediseño y el
    `<AvisoClaveCambiada>` de main, que va **dentro** de la tarjeta y no encima: aquí la
    tarjeta es la pantalla entera, y un aviso flotando fuera se lee como de otro sitio.
  - `Proceso.tsx`: main añade el caso de la vacante eliminada («Ver mis procesos»), la rama
    añadía `data-rotulo`. Van los dos, y el rótulo en las dos ramas del condicional: es el
    mismo gesto lleve donde lleve.
  - La bitácora: las dos entradas, en orden inverso.

El detector no encuentra nada. 1043 pruebas en verde —191 más, que vienen de main— y typecheck
limpio.

## Filtrar la tanda por fecha y actuar sobre muchas sin bajar (22-23/09/2026)

La barra de encima del ranking mezclaba en una fila la búsqueda, un desplegable «Ciudad, nota y
pretensión», las columnas y «Ver a todos», y para avanzar o descartar había que bajar hasta el
final de la tabla. Ahora los filtros van en un botón «Filtros», se puede filtrar por fecha de
postulación y por la calificación con IA, y avanzar y descartar están en una barra pegada abajo.
Cómo funciona hoy está en [PANEL.md](PANEL.md), «Filtrar la tanda y actuar sobre muchas a la
vez»; aquí va el porqué.

- **El backend solo añade la fecha.** Cada fila del ranking trae `postuladoEn`, sin migración:
  la fecha ya estaba guardada. Filtrar sigue siendo cosa del navegador.
- **Los filtros suben por encima de las pestañas**, para conservarse al cambiar de etapa, y se
  reinician al cambiar de vacante.
- **En escritorio el panel no es un modal**: lo que se viene a ver al filtrar es cómo cambia la
  tabla, y un modal la taparía. En el teléfono sí lo es, porque no hay sitio para flotar.
- **La barra de abajo es `sticky`, no `fixed`**: no tapa la última fila ni el pie, y no hay que
  medir nada al hacer scroll.
- **Lo marcado que un filtro esconde no cuenta.** Es el error más caro: una carta de rechazo a
  quien no se ve.

### Decisiones que aprobó el usuario

- La búsqueda por nombre no cuenta en la insignia ni lleva etiqueta, pero «Borrar filtros» la
  limpia.
- Un rango de fechas al revés no cuenta como filtro puesto.
- Si un filtro esconde a todas las marcadas, la barra no sale, como dice la spec al pie de la
  letra.
- En «Pretensión», si la vacante no publica su remuneración, la ayuda dice «La vacante no publicó
  pretensión».

### Lo que encontró el QA, y se corrigió

- **«Más» salía en escritorio**, donde no abre nada: la regla que lo escondía perdía por
  especificidad frente a la pieza compartida del botón. La trampa quedó en
  [REGLAS-DEL-CODIGO.md](REGLAS-DEL-CODIGO.md).
- **Un clic fuera sobre un texto de la tabla**, o sobre el fondo apagado del teléfono, dejaba el
  foco en el contenedor del ranking en vez de devolverlo a «Filtros».
- **Cerrar el panel al bajar el dedo robaba el clic**: la página se recogía y la casilla no se
  marcaba, o el primer «Descargar Excel» no bajaba nada. Ahora cierra al soltar, y devolver el
  foco no mueve la página.
- **Con el panel abierto, Tab llevaba a controles tapados.** Ahora salir con Tab lo cierra.
- **En ventanas estrechas el panel se salía por la derecha** y creaba scroll horizontal. Ahora se
  corre a la izquierda.
- **«Borrar filtros» soltaba el foco a la nada** y quien iba con teclado salía del panel. Ahora
  va a «Filtros», y el del pie se apaga con `aria-disabled` sin soltar el foco.

QA vio además un fallo que viene de antes y no se tocó: la ficha desplegada le dice a Dirección
que su rol no puede ver la pretensión cuando es la vacante la que no publica sueldo. Está en
[PENDIENTES.md](PENDIENTES.md).

### Cómo se comprueba

1043 pruebas del frontend en verde, y en el backend 1077 unitarias y 202 de integración. E2E
nuevos: `33-filtros-y-seleccion-en-lote` (no escribe), `34-filtros-y-seleccion-qa` y
`35-filtros-y-seleccion-qa-movil`, que siembran su propio terreno de 32 postulaciones en 9 días
y lo retiran. La siembra de siempre trae cuatro postulaciones del mismo día y ninguna
calificación con IA, y con eso la fecha y la IA no se podían probar. Quedan en
[PENDIENTES.md](PENDIENTES.md): 16 E2E que ya fallaban antes (`04-filtros`, `05-excel`,
`07-movil`, `08-teclado`), los números 33 a 35 repetidos con los de la contraseña, dos
comentarios desactualizados y un tamaño fuera de escala que viene de main.

---

## «¿Olvidaste tu contraseña?» deja de ser un cartel (22-23/09/2026)

Hasta ahora `/clave` solo explicaba que se escribiera a talento, y el panel no ofrecía nada: el
backend no tenía la ruta. Ahora, en el portal y en el panel, se pide un enlace con el correo y
con él se elige una contraseña nueva. Cómo funciona hoy está en
[02-QUE-VE-EL-CANDIDATO.md](02-QUE-VE-EL-CANDIDATO.md), «Si olvidó la contraseña», y en
[PANEL.md](PANEL.md), «¿Olvidaste tu contraseña?»; aquí va el porqué.

- **Un solo juego de pantallas para las dos puertas** (`src/ui/recuperacion/`). Cada puerta
  pone su llamada, su mínimo (8 o 12) y su pie; el mensaje neutro, la cuenta atrás y el
  tratamiento del token son el mismo código, así que no pueden divergir.
- **La línea de talento se queda en el portal.** A una cuenta de carga masiva no le llega
  ningún enlace, y el mensaje de enviado no puede decírselo sin revelar qué correos tienen
  cuenta.
- **El aviso de éxito viaja en el estado de la navegación, no en la dirección**: un
  `?clave=ok` se quedaría en marcadores diciendo algo que ya no es verdad.

### Decisiones que aprobó el usuario

- **Sin señuelo de tiempo.** La spec pedía imitar el del login para que «no existe» no respondiera
  más rápido. En su lugar, el backend responde 202 al instante y hace el trabajo después: los
  tiempos son iguales exista o no la cuenta.
- **Topes de 3 enlaces por cuenta y hora y 30 solicitudes por IP y hora.** El de la IP se cuenta
  en la memoria del servidor y se reinicia cuando arranca.
- **«Vale por 60 minutos» va fijo en pantalla.** Si se cambia `minutos_vida_recuperacion` en el
  backend, hay que cambiar el texto a mano.
- **Recargar `/restablecer` después de que el token salió de la barra muestra «El enlace está
  incompleto».** El enlace del correo sigue sirviendo si se vuelve a abrir.
- **Tope de 72 bytes en la contraseña nueva**, el límite de BCrypt, con el mensaje «La contraseña
  es demasiado larga. Usa como máximo 72 caracteres; las letras con tilde, la ñ y los emojis
  cuentan por más de uno.». Crear cuenta y aceptar la invitación siguen sin él: está en
  [PENDIENTES.md](PENDIENTES.md).

### Cómo se comprueba

951 pruebas del frontend en verde. E2E nuevos: `33-recuperar-contrasena` (los dos recorridos
completos), `34-recuperar-contrasena-movil` (no escribe), `35-recuperar-contrasena-bordes` y
`36-recuperar-contrasena-regresiones`. Los que escriben leen el enlace de `correo_enviado`,
porque el backend local no envía correo. **Falta la prueba con SMTP real**: pedir el enlace al
correo propio, ver que llega, que abre la pantalla correcta y que después se entra con la nueva.
## La portada entra por bloques, y el fundido al navegar se va (22/09/2026)

El cliente preguntó por «esa animación al cambiar de pestaña» y pidió replicar la de
[OriginX](https://originx.demos.tailgrids.com/), la plantilla que inspiró el mundo. Los
valores no se sacaron mirando la pantalla sino de su propio bundle — que resultó ser
`motion`, la misma librería que ya usábamos:

    variantes  fadeInUp {opacity:0,y:50} · fadeInLeft {x:-50} · fadeInRight {x:50} ·
               scaleUp {scale:.8}
    viewport   {once:true, amount:0.2}
    transition {duration:.5, delay:0, ease:[.25,.1,.25,1]}
    escalonado staggerChildren: .2

**Lo primero que se aclaró es que no era lo que parecía.** En la referencia eso no es una
transición de ruta: es `whileInView`, y cada bloque se anima cuando asoma por el borde de la
ventana, una sola vez. Al cargar, todo lo que cae sobre el pliegue asoma a la vez y entra
junto — y ESO es lo que se lee como «la pantalla entró animada».

Se añadió como pieza E —`AlAsomarse` y `AsomanEnFila`— y se aplicó **solo a la portada**, en
cinco bloques con envoltorio propio y ninguno anidado, que es como lo hace la referencia. El
escaparate lleva `scaleUp` con 200 ms de retraso —la variante que ella reserva para tarjetas—
y las cinco etapas de dentro entran escalonadas.

⚠️ **El escalonado de las etapas va con `retraso={0.2 * indice}` y no con `AsomanEnFila`.** El
contenedor escalonado reparte sobre HIJOS DIRECTOS, y cada etapa cuelga de su propio `<li>`:
el padre no las ve.

**Y por qué no está en las otras dieciséis.** Se preguntó si extenderla. No por peso
—`IntersectionObserver` no toca el hilo principal y con `once:true` cada elemento se
desconecta al entrar—, sino porque **retrasa medio segundo lo que el usuario vino a ver**. En
«Mis procesos» eso es cobrarle una animación a quien entra a comprobar si hay novedad, y
además ahí ya se mueve la franja del recorrido, que sí significa algo: dos movimientos
compitiendo le quitan el significado al que lo tenía. La regla que quedó: **esta animación es
para pantallas que se leen, no para pantallas que se usan.**

**Se retiró la pieza A.** Ligaba una pantalla con la siguiente, pero envolvía al `<Outlet>`,
así que corría en CADA cambio de ruta y el contenido llegaba 280 ms tarde. El cliente lo
llamó «el bug»: se lee como un fallo, no como una transición. El código sigue en
`movimiento.tsx` por si se recupera; lo que ya no hace es envolver al `<Outlet>`.

Un efecto lateral: `design.json` justificaba que la franja se animara con `animate()`
imperativo «porque el `AnimatePresence initial={false}` del armazón suprime por contexto la
entrada de todos sus descendientes». Ese contenedor ya no existe. Se deja imperativa de todos
modos —así no depende de lo que decida ningún contenedor futuro— y se corrigió el porqué.

También se bajó el resplandor del escaparate al 60 %, con la intensidad en un solo mando
`--luz`: las tres capas se suman y están calibradas una contra otra —el rosa pesa más que el
coral a igual opacidad—, así que tocarlas por separado descuadra esa proporción.

---

## Corregir una vacante desde la lista, y el sueldo sin correo (19-20/09/2026)

El backend tenía el `PUT` de la vacante y la lista no ofrecía editar. Ahora cada fila en
borrador o publicada lleva un lápiz que abre **el mismo formulario del alta**. Cómo funciona hoy está en
[PANEL.md](PANEL.md), «Corregir una vacante con el lápiz»; aquí va el porqué.

- **Un formulario, no dos.** Los campos comunes salieron a `CamposDeLaVacante.tsx` y los usan el
  alta y la edición (`EditarVacante.tsx`): se corrige donde se escribió, con las mismas palabras
  y en el mismo orden.
- **El aviso previo va debajo del botón y no es un diálogo.** Corregir una vacante es lo normal,
  y un «¿estás seguro?» en cada guardado se aprende a despachar sin leerlo.
- **El sueldo entra en el mismo guardado.** Antes eran dos llamadas, y cambiar el sueldo y el
  horario a la vez mandaba dos avisos por un solo cambio. El formulario manda la remuneración
  entera y, si cambia, el motivo; el backend saca un único aviso con todo.
- **El sueldo deja de mandar correo, por sus dos puertas.** La tarjeta del detalle ya no promete
  «por correo y en su portal»: la campana espera a que la persona entre, y el correo se pierde.
- **La fila trae lo que el lápiz necesita**: el texto entero de la convocatoria,
  `postulantesEnCarrera` y `puedeEditar`. Sin el texto, el formulario se abriría a medias y
  guardar borraría lo que no viajó.

### Lo que encontró el QA, y se corrigió

- Guardar sin tocar nada **vaciaba la fecha de apertura**, que el formulario no enseña, y las
  plazas que no cuadraban con la forma de cierre; el panel decía «Cambios guardados». Ahora la
  apertura no se toca al editar, y plazas y fecha de cierre solo cambian si su forma de cierre las
  enseña o si esa forma cambió.
- Guardar sin tocar la fecha de cierre **le quitaba la hora**. Ahora se compara por día y, si el
  día es el mismo, se conserva la hora guardada.

### Cómo se comprueba

797 pruebas del frontend en verde, `EditarVacante.test.tsx` incluido. E2E nuevos, 12 casos:
`25-editar-vacante` (no escribe) y `26-editar-vacante-avisos` (siembra su terreno y lo retira).
Tres casos antiguos quedaron fuera a propósito y están en [PENDIENTES.md](PENDIENTES.md).

---

## El modal compartido solo dejaba escribir una letra (11/09/2026, tarde)

Lo encontró una persona probando el descarte a mano: escribía una letra en el campo del motivo y
**el foco saltaba al aspa**; la segunda letra ya no entraba en ningún sitio.

No era del componente nuevo. Era de `src/ui/Modal.tsx`, y afectaba **a los cinco modales del
proyecto con campos** desde siempre.

El efecto que pone el foco, atrapa el tabulador y bloquea el scroll del fondo llevaba `onCerrar`
en sus dependencias. Y `onCerrar` lo pasa cada pantalla como una función declarada dentro de su
propio componente, o sea **una función distinta en cada render**: el efecto se limpiaba y se
volvía a montar cada vez que el padre se renderizaba. Como ese efecto **mueve el foco** —su
limpieza lo devuelve a donde estaba antes de abrir, y su cuerpo lo lleva al primer enfocable del
modal, que es el aspa de la cabecera—, cada tecla lo mandaba fuera del campo.

Ahora `onCerrar` va por `useRef` y las dependencias son solo `[abierto]`: el efecto corre al
abrir y al cerrar, que es cuando el foco tiene algo que hacer, y el manejador de Escape sigue
llamando a la versión más reciente.

⚠️ **Un test con un `onCerrar` estable NO lo detecta.** Con `const cerrar = vi.fn()` declarado
fuera del render, la identidad no cambia, el efecto no se remonta y el fallo no aparece — el test
pasa con el bug puesto. Por eso `src/ui/Modal.test.tsx` monta un **padre de verdad**, con estado
propio y su `onCerrar` declarado dentro, que es como lo usa todo el proyecto. Comprobado además
al revés: devolviendo `onCerrar` a las dependencias, el test se pone en rojo.

---

## Descartar a una tanda, y poder no avisar (11/09/2026, tarde)

Con el botón de la ficha ya puesto, descartar a seis personas eran seis fichas abiertas y seis
ventanas. La mesa de la tabla ya tenía lo que hacía falta —las casillas y el motivo con que se
hace avanzar a una tanda—, así que al lado de «Avanzar a N personas» va ahora **«Descartar a N
personas»**: se marca a quien sea y **después** se elige qué hacer.

El campo de la mesa dejó de llamarse «motivo del avance». Con el descarte al lado, ese nombre
haría escribir un motivo de avance para acabar cerrando a seis personas con él.

⚠️ **Ese botón NO actúa al pulsarlo, y el de avanzar sí.** Son dos botones pegados que hacen
cosas opuestas, y aquí un clic manda N cartas de rechazo que no se recogen. Abre una ventana con
**los nombres escritos**, enteros y sin «y 4 más»: el error que de verdad ocurre no es
equivocarse de botón, es llegar ahí con alguien marcado de una pestaña anterior — y «descartar a
6» parece correcto hasta que se leen los seis nombres.

⚠️ **Va uno a uno y a los ya cerrados no se les filtra antes.** Se les deja fallar y salir
nombrados en «No se descartaron», que es lo que hace el avance; filtrarlos en silencio haría que
la cuenta del botón y la del resultado no cuadraran sin explicación. Por eso la ventana promete
**«hasta N»** correos y no «N».

### La casilla de no avisar

En los dos sitios —la ficha y la tanda— hay una casilla **«avisar por correo»**, encendida de
salida. Quitarla descarta sin que al candidato le llegue nada. Es para cuando el equipo ya habló
con esa persona por teléfono o en la entrevista: la carta automática llega después de esa
conversación y dice lo mismo peor.

⚠️ **La casilla dice lo que HACE, no lo que deja de hacer.** «Avisar» encendida es el estado
normal; una casilla «no avisar» que hay que marcar para lo de siempre invierte la lectura y se
marca por error. Y el aviso ámbar de arriba **cambia con ella**: un texto que sigue prometiendo
un correo mientras la casilla dice lo contrario es peor que no decir nada. El nombre del botón
también — «Descartar sin avisar».

⚠️ **Callar el correo no puede ser callarlo todo.** El backend lo deja escrito en los dos sitios
donde alguien lo va a buscar: al final del motivo guardado —que es lo único de la transición que
pinta el historial de la ficha— y en la auditoría, como `avisoAlCandidato: NO_ENVIADO`. Sin eso,
quien abra esa ficha dentro de seis meses ve «no continúa» con su motivo y da por hecho que se
le dijo; si el candidato llama preguntando, nadie en el equipo sabría que nunca se le avisó.

⚠️ **El «sin avisar» no se arrastra.** Vuelve a encenderse en cada apertura, en los dos sitios:
haberlo apagado para una persona no puede callar los correos de la siguiente sin que nadie lo
mire.

**Del backend, lo mínimo:** `MaquinaEstados.transicionar` gana una sobrecarga con `avisar`, y la
firma de siempre —la que usan los veintitantos sitios que mueven una postulación— delega con
`true`. Sin la sobrecarga habría que tocar 46 llamadores para un caso que usa uno. Y el ranking
gana `puedeMoverPostulacion`, igual que la ficha: la mesa vive fuera de cualquier ficha abierta y
pedir una solo para saber un permiso sería una consulta de más por una casilla.

---

## Ya se puede descartar a alguien desde la ficha (11/09/2026)

El panel podía calificar, mover fechas y confirmar avances, pero **no tenía forma de decir
«esta persona no sigue»**. El verbo estaba en el backend desde el principio
—`POST /postulaciones/{id}/transiciones`, con su motivo obligatorio— y ninguna pantalla lo
llamaba: para descartar a alguien había que pedírselo a quien supiera llamar al sistema por
debajo.

Ahora la ficha del ranking trae un botón **«Descartar»** y una ventana con **un solo campo**: el
motivo escrito. Al confirmar, la postulación pasa a `NO_CONTINUA` y el backend rellena solo su
`motivoCierre` (`DECISION_PERSONA`).

⚠️ **Esto manda un correo real a una persona real.** `NO_CONTINUA` dispara la plantilla
`POSTULACION_NO_CONTINUA` en la misma transacción, sin preguntar nada más: no es un cambio de
estado interno que alguien vaya a revisar después, es la carta de rechazo. Por eso la ventana lo
avisa **con su nombre y antes del campo**, y no como letra pequeña debajo del botón.

⚠️ **El motivo NO viaja en ese correo.** El texto que le llega al candidato es siempre el mismo;
lo que se escribe aquí lo lee el equipo en el historial. La ayuda del campo lo dice, porque la
suposición contraria es fácil y cara: alguien redactaría una devolución personal creyendo que la
lee quien la merece.

⚠️ **El botón se pinta con un dato del backend, no con una lista de roles en el navegador.** La
ficha gana `puedeMoverPostulacion`, calculado con el permiso de quien pregunta —igual que
`puedeVerPretension` en el ranking—. Hacía falta porque **el login solo devuelve token e id**: no
hay ningún endpoint que diga qué permisos trae la sesión, así que la única alternativa era
enseñar el botón a todo el mundo y que la mitad del equipo descubriera su rol chocando contra un
403. Es para decidir qué se pinta, nunca la defensa.

⚠️ **Y `tiene(permiso)` no dice hasta dónde llega.** El alcance se guarda POR permiso, así que un
rol puede abrir la ficha de cualquiera y mover solo las de sus vacantes. En esa franja el botón
sale y el backend contesta **404 y no 403** —un 403 confirmaría que esa postulación existe—, así
que ese 404 se traduce como límite del alcance del rol y no como «no encontramos eso».

**Sobre alguien ya cerrado el botón no sale**, y en su lugar va una línea que dice que esa
postulación ya terminó su recorrido: un control que solo puede fallar es peor que no ofrecerlo,
pero desaparecer sin explicación deja pensando si falta un permiso. Si es final o no lo dice
`esFinal` del catálogo, no una lista de estados escrita en el navegador.

### Lo que encontró el QA el mismo día, y se corrigió

⚠️ **Cerrar la ventana mientras la petición volaba se tragaba el error.** El modal se cierra con
Escape, con un clic en el fondo y con el aspa; la llamada tarda —el correo va dentro de la misma
transacción—, así que quien se impacientaba dejaba el modal desmontado y **el fallo que llegaba
después no se pintaba en ninguna parte**. Como al descartar bien tampoco salía nada, un descarte
que rebotó y uno que salió se veían exactamente igual: la persona seguía en el proceso y nadie se
enteraba. Ahora las tres salidas están bloqueadas mientras dura, y **al terminar se dice que
salió** —«Descartada. A Fulano ya le salió el correo»—, que es la señal que no había.

⚠️ **`esFinal` sin catálogo valía `false`, o sea «se puede descartar».** La ficha y el catálogo
son dos consultas en paralelo y el bloque se pinta en cuanto llega la de la ficha: en ese hueco
—y para siempre si el catálogo falla— el botón salía sobre alguien ya cerrado, prometía un correo
y el backend contestaba 409 con el motivo ya escrito. El `?? false` invertía el fallo seguro:
ante la duda ofrecía la acción. Ahora «todavía no se sabe» es su propio caso y no se pinta nada.

También: el fallo de un intento ya no aparece al abrir el siguiente, el error de validación se va
al empezar a escribir en vez de al volver a pulsar, y el foco del error se busca **dentro del
modal** y no en la página entera —esta ficha monta además los campos de nota y de plazo, que usan
la misma pieza, y un `aria-invalid` suyo se llevaba el foco fuera de un modal que atrapa el
tabulador; que hoy ganara el campo bueno era orden del DOM, no diseño—.

⚠️ **Queda abierto y no es de este cambio:** el correo de rechazo sale con un **enlace de entrada
sin contraseña** recién creado (lo genera `avisarAlCandidato` para todos los avisos por igual), y
el propio código se contradice sobre si el enlace nuevo invalida los anteriores. Es una credencial
viva pegada a un rechazo, sobre una postulación ya cerrada. Existía antes; lo que cambia es que
ahora se dispara desde un botón del panel.

---

## «El canto» se va: el portal cambia de mundo visual (10/09/2026)

**El motivo no fue el concepto, fue su rendición.** El encargo empezó con «lo siento muy
apagado», y al medirlo salió por qué: el fondo `#f6f8fb` y las superficies `#ffffff` estaban
a un **2 % de diferencia de luminancia**, así que ninguna superficie se despegaba y la
pantalla entera se leía como un solo plano; el espectro del canto salía pastel —exactamente
la rendición que el propio DESIGN.md había rechazado por escrito—; y la portada se quedaba
sin ningún foco cromático porque su acción iba en tinta, no en violeta.

**Se exploraron once direcciones antes de elegir.** Están en
`.impeccable/mocks/direcciones/` con su índice `00-indice.html`, cada una con mundo,
estructura y palabras propias: la hoja de laboratorio, la rotulación popular peruana, la piel
de cefalópodo, la página de avisos del diario, el fotocheck sin emitir, el álbum de láminas,
el telar, la parrilla de emisión y la libreta en primera persona. Ninguna se eligió. El
cliente trajo una referencia propia —la plantilla **OriginX de TailGrids**— y de ahí salió la
décima, que es la que se implementó. ⚠️ Es una plantilla comercial: hay que mirar su licencia
antes de lanzar.

**El mundo nuevo es «El escaparate».** Fondo gris claro `#F5F5F5` —la regla de negocio era
tema claro, «no necesariamente blanco»—, superficies blancas que ahora sí se despegan,
**la acción en negro pleno `#0A0A0A`** con esquina de 4 px, y el color apareciendo una sola
vez por pantalla: el coral `#FF7C61` y su bruma rosa, que siguen significando «te toca a ti».
El semáforo verde/ámbar/rojo no se tocó: significaba algo en el producto antes que en el
diseño.

**Los controles dejaron de ser píldoras.** `--radio-control` valía `999px` y vale `4px`.
Cualquier hoja que dé por hecho una píldora está desactualizada.

**Mulish salió, entró Figtree**, variable y servida por el propio sitio como lo estaba la
anterior — una app instalada no puede quedarse sin titulares por falta de cobertura. Su rango
es 400–700, así que **el peso 200 del mundo anterior ya no existe** y los titulares pasaron
a 600.

**Se re-vistieron las 17 pantallas de una vez** cambiando los valores de `src/estilos/mundo.css`,
porque todas consumen esos tokens. Lo que **no** cambió es la composición: solo la portada se
reescribió, y «Mis procesos» todavía pinta el `<Canto>`, que quedó como resto con su degradado
retargeteado a coral para que no desentone mientras siga en pantalla.

**Dos errores propios, corregidos en el sitio:**

- Copiar `#CBCBCB` de la referencia a `--borde-control` dejaba el contorno de los campos en
  **1,62:1**, cuando un control pide 3:1. Está en `#8A8A8A` (3,45:1). La referencia tiene ese
  fallo; no había por qué heredarlo.
- La primera versión de la portada llevaba tarjetas redondeadas y sin las marcas de esquina de
  5 px, que son la firma del mundo de referencia. Se midieron sus tokens en el sitio en vivo
  en vez de a ojo, y salió una segunda versión fiel — aunque el cliente prefirió la primera.

**La documentación se actualizó a la vez, no al final**, a petición del usuario y con razón:
con el `design.json` viejo el detector de impeccable daba doce falsos positivos justo cuando
hay dieciséis pantallas por migrar. Ahora da cero. Se tocaron `DESIGN.md`,
`.impeccable/design.json`, `PRODUCT.md`, [EL-MUNDO-VISUAL.md](EL-MUNDO-VISUAL.md) —que estaba
**dos mundos atrás**, todavía en «El seguimiento»— y `CLAUDE.md`.
---

## Cuatro cosas para que el perfil se sienta suyo (06/09/2026, noche)

**El nombre está a `--t-portada`** (32-56px, peso 200), la escala de titular del
sistema. Estaba a `--t-destacado`: 24px como máximo, **el mismo tamaño que la
palabra «Idiomas»**. En una pantalla cuyo asunto es quién eres, la persona pesaba
lo mismo que un rótulo de sección; y DESIGN.md pide «uno por pantalla y ninguno
más», aquí había cero.

**El disco de iniciales toma el tono de la portada elegida**, no de un hash del
nombre. Eran dos identidades sueltas en la misma cabecera: una banda decidida a
propósito y, al lado, un disco de 128px de un color sorteado. ⚠️ El violeta vuelve
a ser posible aquí y **no rompe la regla del acento**: lo que la rompía era
imponérselo a uno de cada cuatro. Elegir la portada violeta es deliberado. Sin
portada de galería decide el nombre, como antes.

**Confirmar tiene un momento.** `useLista().celebrar(id)` marca la fila 900ms y el
CSS disuelve la caja donde estaba mientras la fila sube a su sitio. ⚠️ **Es el
único movimiento de la pantalla, y por eso funciona**: confirmar es el trabajo que
este perfil pide, y hasta ahora la recompensa era que la fila cambiaba en
silencio. El temporizador se limpia al desmontar — la pantalla se sondea sola cada
cinco segundos.

**La portada puede salir de los colores de la foto.** Se muestrea en 16×16, se
cogen el píxel más oscuro y el más claro, y se arma un degradado de 1600×400.
⚠️ **Aclarados al 55% hacia `--cielo`**: los colores crudos de una fotografía dan
una banda dura que no se parece a nada del portal y compiten con el nombre que va
justo debajo. Se sube por la ruta de portada propia, así que no toca backend, y el
botón solo aparece si hay foto.

## Las certificaciones salen de la cronología (06/09/2026, noche)

⚠️ **Un empleo y unos estudios son TRAMOS; un certificado es un PUNTO.** Los tres
compartieron línea medio día y no funciona: los tramos duran, se solapan y dejan
huecos entre ellos, y un certificado se emite un día. Metidos en la misma línea
partían la trayectoria con algo que no es trayectoria — en la ficha de prueba
dejaban dos certificados entre el empleo actual y el anterior.

`Certificaciones` vuelve a ser su propia sección en `Listas.tsx`, montada sobre el
mismo gancho `useCertificados`. La cronología se queda con empleos y estudios, que
sí comparten forma. El índice cuenta cinco secciones.

## Una sola cronología, no tres listas (06/09/2026, tarde)

Rediseño de estructura elegido por el usuario sobre el reparto del dado
(`concept-seed`, clave c5d8200b). El mundo visual **no se toca** —los compromisos
de marca que aprobó la clienta sobreviven a un rediseño—; lo que cambia es la
composición. La pieza nueva está documentada en `DESIGN.md`.

**Empleos y estudios se pintan juntos**, ordenados por fecha, en
`Trayectoria.tsx` —las certificaciones salieron después, ver la sección de
arriba—. Las tres secciones de `Listas.tsx` dejaron de ser componentes y
pasaron a ser **ganchos** (`useEmpleos`, `useEstudios`, `useCertificados`) que
exponen sus mutaciones y su formulario; quien pinta las filas es la cronología,
porque interleaved por fecha no se puede hacer con tres listas independientes.

⚠️ **Ya no hay flechas de reordenar, y no es una pérdida.** Existían porque la
lectura del currículum añadía sus filas al final y alguien tenía que arreglarlo a
mano, de una en una y con un viaje al servidor por paso. La cronología hace ese
trabajo innecesario. El `orden` del backend se queda: no estorba.

⚠️ **Lo que sigue vivo va arriba.** Ordenar solo por fecha de inicio dejaba un
certificado de 2024 por encima de un empleo empezado en 2022 que la persona
todavía tiene. Un tramo abierto ordena como si terminara hoy.

⚠️ **Y el hueco de empleo solo se dibuja si de verdad no había nada.** Si en esos
meses hay estudios o un certificado, no se rotula: decirle «sin empleo
registrado» a quien estaba estudiando es afirmar algo falso sobre su vida, en la
pantalla que le pide validar lo que dedujo una máquina.

El índice de la lateral cuenta las tres juntas, porque juntas se pintan.

**Cada sección es una tarjeta** (`.seccion`), separadas por `--e6` y apretadas por
dentro. Iban con una regla de 1px y se leían como un bloque largo. ⚠️ **La tarjeta
separa SECCIONES, no filas**: dentro sigue sin haber cajas, la única de la
pantalla es la fila que espera algo. Anidar tarjetas es lo que convierte una
pantalla en un acordeón.

⚠️ **La lateral se pega ENTERA, y `.cuerpo` lleva `align-items: start`.** De esto
van cuatro intentos y el que faltaba entender es este: `position: sticky` con
`top` **no engancha en un elemento más alto que la ventana**, así que estirar la
lateral a toda la fila —lo que hacía falta para pegar solo el índice dentro de
ella— la deja desplazándose como si no tuviera `sticky`. O se pega la columna, o
se pega un hijo; las dos cosas a la vez no.

Que quepa dejó de ser un problema con la fusión: el índice bajó de seis entradas
a cuatro y el bloque del currículum de 347px a 250 —«Descargar» y «Cambiar»
comparten renglón—, así que las tres tarjetas suman **716px** y entran en una
ventana de 800. Medido. Al final del todo la columna se suelta, y eso es correcto:
`sticky` deja de pegar cuando su contenedor se acaba.

Este archivo es para retomar el trabajo sin tener que reconstruir nada. Cuenta qué es este
proyecto, con qué habla, qué se decidió y por qué, y qué está a medias.

---

## «Mi perfil» al estilo portal de empleo (05/09/2026)

La clienta pidió que el perfil «se parezca a LinkedIn». El inventario
—[docs/07-BRIEF-MI-PERFIL.md](07-BRIEF-MI-PERFIL.md)— dijo que el 80 % ya existía y se
veía mal, así que la rama es sobre todo forma, más cuatro capacidades nuevas: foto, portada,
currículum en el perfil y diplomas.

**El `h1` de `/perfil` es el NOMBRE del candidato**, no «Tu perfil.». Cualquier prueba que
espere ese título viejo se cuelga. Lo mismo con los botones: «Escribir quién eres» pasó a
«Escribir sobre ti» y «Editar quién eres» a «Editar lo tuyo».

**Y el nombre viene del backend por DOS caminos, no uno.** Entrar devuelve `nombre` y
`apellidos`; `GET /portal/auth/sesion` los devuelve cuando el portal arranca de un token ya
guardado. ⚠️ El segundo es el que se olvida y es el caso normal: el portal solo entra una vez,
y a partir de la segunda visita —u otro navegador, o el almacenamiento vaciado— no hay a quién
preguntarle. Sin él la cabecera decía «Tu perfil» sobre un disco de iniciales vacío.
`localStorage` se queda solo como respaldo entre recargas.

### Al postular ya no se sube el currículum dos veces

Con currículum en el perfil, la pantalla dice cuál va a mandar y ofrece «Usar otro solo para
esta vacante». ⚠️ **El que se suba ahí NO cambia el del perfil**, y eso se dice con esas
palabras en un aviso ámbar. El `input[type=file]` sigue en el DOM aunque no se pida nada: una
prueba que compruebe «no hay dónde subir» tiene que mirar la zona de arrastrar, no el input.

### Los `input[type=file]` ocultos llevan `aria-label`, y hace falta

Son cinco —foto, portada, currículum del perfil, diploma, currículum de la vacante—, están
escondidos con `clip-path` y **siguen siendo enfocables**. Sin nombre no se distinguen: dos de
ellos aceptan imágenes, así que un `input[type=file][accept*="image"]` cogía el de la portada
creyendo que era el de la foto. Se buscan por `input[aria-label="…"]`.

⚠️ **Y un `<input type=file>` sale como `button` en el árbol de accesibilidad**, así que
`getByRole('button', { name: 'Portada' })` casa también con el input de la portada. Va con
`exact: true`.

### Las aptitudes son etiquetas, y la coma cuenta en los tres sitios

Enter, coma y **Guardar** tienen que entender lo mismo. `leerTodas` parte por comas igual que
`anadir`: sin eso, pegar «Excel, Power BI, SQL» y darle a Guardar sin pulsar Enter guardaba
**una** aptitud con comas dentro, que no la encuentra ninguna búsqueda.

### El medidor no regaña, y no anima el ancho

Nada del perfil es obligatorio (RF-156): el medidor no tiene rojo, ni candado, ni la palabra
«incompleto». Verde solo al estar entero. Crece con `transform: scaleX()` y no con `width`,
que obliga a recalcular la maqueta en cada fotograma dentro de una columna pegajosa.

⚠️ **Y el párrafo que lo acompaña NO es un contenedor flex.** Es una frase con negrita dentro,
y el flex convertía cada trozo en un elemento suelto: el punto final se quedaba solo en la
línea de arriba. El que lleva icono es `.textoConIcono`.

### jsdom no trae `scrollIntoView`

Lo declara en el tipo y revienta al llamarlo, así que el efecto que trae el formulario a la
vista tumbaba cuatro pruebas y funcionaba en el navegador. Se rellena una vez en
`herramientas/arranque-de-pruebas.ts`, no con un `if` dentro del componente.

### La caja significa «esto te toca», y la experiencia es una línea de tiempo (06/09/2026)

La pantalla se veía plana, y la razón era estructural: **nueve secciones con la
misma forma**, una pila de rectángulos blancos con el mismo borde y el mismo
radio. Seis años en una clínica y una URL de LinkedIn pesaban lo mismo. Tres
cambios, ninguno fuera del sistema:

### La fila sin confirmar lleva el acento, no ámbar (06/09/2026)

Era ámbar y **estaba usando el token equivocado**. DESIGN.md define `--duda`
como «lo que no es un error del candidato pero le cambia la decisión» —un
requisito que no cumple, la última plaza libre— y en sus «Don't» prohíbe
expresamente usar verde, ámbar o rojo «para jerarquía o categoría». Una fila
leída del currículum no es una duda sobre la candidatura: es un dato pendiente de
que lo miren.

Ahora lleva `--activo`, que significa exactamente eso: «te toca a ti». El panel
de arriba lo dice con palabras y estas filas son lo que ese panel señala; hasta
ahora el aviso era violeta y lo señalado ámbar. También se alineó la píldora del
índice, que contaba lo mismo con el color de lo otro.

⚠️ **Pero el violeta va en el CANTO, no en el relleno.** Un currículum recién
leído puede dejar veinte filas sin confirmar de golpe: veinte rectángulos
violetas macizos no son énfasis, son un fondo. Con borde y píldora sobre blanco,
veinte filas siguen siendo veinte marcos. Es la estrella del sistema al pie de la
letra.

**El borde es `--activo-regla` a 2px, el mismo que el panel** — a propósito, para
que el aviso y lo avisado sean idénticos. Da 1,65:1 contra la página, por debajo
del 3:1 de WCAG 1.4.11, y **no se sube**: el estado va escrito en la píldora
«Sin confirmar» (8:1), en el botón «Está bien» y en el «N sin confirmar» del
título de sección, así que el borde es refuerzo y no el único portador. Subirlo
obligaría a cambiar `--activo-regla` en todo el portal para engordar un filo que
ya no hace falta que grite. La prueba en gris lo confirma.

**Y el ámbar queda libre para lo suyo:** desde este cambio, la pretensión es el
único `--duda` de la pantalla, que es lo que un token de estado debería ser.

⚠️ **Una fila normal ya NO es una caja.** Lo confirmado es texto sobre la página
con una regla fina entre hermanas; **la única caja que queda es la fila sin
confirmar**. Cuando todas eran cajas, ser caja no significaba nada. Ahora el
primer principio del producto —la pantalla dice de quién se espera algo— está
dibujado en la forma en vez de escrito en un panel, y aguanta la prueba en gris
mejor que antes: sin color, la fila con caja es la que te toca.

Los botones de fila se apagan hasta que la fila recibe el ratón o el foco. ⚠️ **Se
apagan con el TOKEN, nunca con `opacity`.** Un `opacity: 0.55` sobre `--tinta2`
los dejaba en **2,5:1** —veintinueve controles por debajo del mínimo, y en
Enlaces «Quitar» es el único control de la fila—: la transparencia no es un
color, es una composición, y se come el contraste. Con `--tinta3` en reposo y
`--tinta2` al hover dan 5,23:1 y se ven igual de discretos.

⚠️ **La experiencia se dibuja sobre un raíl y la duración se ESCRIBE.** Se
intentó codificarla en el alto de la fila (`--meses` + `min-height`) y **no
funciona**: el texto de la fila casi siempre supera el mínimo, así que once años
y cuatro medían lo mismo —190px y 186px, medido— y el alto acababa
correlacionando con la longitud de la descripción. Una codificación que no se
cumple es peor que ninguna. El raíl se queda con lo que sí sabe hacer —el orden y
los huecos— y la duración va en palabras junto al periodo, con `duracion()`.

⚠️ **El hueco va DEBAJO de su fila.** Describe el salto entre esa fila y la de
abajo (la más antigua), así que cae entre las dos; emitido antes quedaba un
puesto más arriba y dibujaba un vacío laboral entre dos empleos encadenados. Es
su **propia entrada de la lista**: metido dentro del `<li>` quedaba encerrado en
la caja ámbar de un empleo con el que no tiene nada que ver.

`mesesDelTramo` y `huecoEntre` viven en `textos.ts` con sus pruebas. **Devuelven
`null` en cuanto el dato no cuadra** —sin fecha de inicio, fin anterior al
principio, o un par de filas reordenado a mano que no va seguido en el tiempo— y
quien las llama pinta la fila sin duración. Estas fechas salen de un currículum
que leyó un modelo: llegan mal más a menudo de lo que parece.

**El índice de la lateral** llena el canalón que se moría a un tercio, y dice
cuántas cosas tiene cada sección y cuántas esperan revisión.

**Las filas reparten su ancho**: el «qué» a la izquierda y el «cuándo» pegado al
borde derecho, con `.conCuando`. La cabecera medía 664px y el texto paraba en
420, así que la mitad derecha de once filas estaba vacía mientras la fecha
ocupaba un renglón entero debajo. ⚠️ **`.conCuando` es una variante, no el
comportamiento de todas**: es una rejilla de dos columnas, y aplicada a una
cabecera de hijos sueltos cada píldora cae en su propia celda y se estira a lo
ancho. Quien la use tiene que agrupar el lado izquierdo en `.queYDonde` —lo usan
Experiencia, Estudios y Certificaciones; Idiomas y Enlaces no tienen un «cuándo»
que llevar a la derecha y se quedan con el flex de siempre.

La prosa de la descripción **no** se ensancha: sigue en `--medida`. Lo que se
reparte es el dato corto; una línea de texto larga se lee peor, no mejor.

⚠️ **Lo pegajoso es el índice, y la lateral se ESTIRA a toda la fila.** Esto se
hizo mal dos veces seguidas y las dos se veían razonables:

1. Pegando la columna entera medía ~885px; en una ventana de portátil su parte de
   abajo quedaba fuera del borde y no volvía a subir, así que las últimas
   entradas del índice no se alcanzaban nunca.
2. Acotándola con `max-height` + `overflow-y: auto` aparecía **una segunda barra
   de desplazamiento**: dos superficies que mover para leer una página. Peor que
   el problema.

Lo correcto: `position: sticky` viaja dentro de la caja de su padre, así que el
`aside` tiene que ser **tan alto como la fila** —por eso `.cuerpo` no lleva
`align-items: start`— y dentro de él se pega solo el `<nav>`. El medidor y el
currículum se leen una vez al llegar y se van con la página. No hace falta acotar
nada. Hay un e2e que exige que la lateral no tenga barra propia.

Y el ancla de «Acerca de ti» tiene que estar en las **dos** ramas de ese
componente: puesta solo en la de edición, en el estado normal el enlace del
índice no llevaba a ninguna parte.

⚠️ **`tonoDe()` no reparte violeta.** El disco de iniciales sale de un hash del
nombre, y con `--canto-violeta` en el sorteo **uno de cada cuatro candidatos**
abría su perfil con un disco violeta de 128px que no eligió, dejando al panel que
de verdad le reclama algo como el violeta más pálido de la pantalla. El acento no
puede salir de un sorteo. En la galería de portadas sí sigue: ahí lo elige la
persona. ⚠️ Su
`IntersectionObserver` **lleva la cuenta de todas las secciones, no solo de las
que cambiaron**: el observador solo avisa de las que cruzan el borde, así que
quedarse con la primera de esa tanda dejaba la marca en la que acababa de salir.

⚠️ **Y jsdom no tiene `IntersectionObserver`**, igual que no tiene
`scrollIntoView`. Sin el relleno de `herramientas/arranque-de-pruebas.ts` el
índice tumbaba **la pantalla entera** en los diez tests de `Perfil.test.tsx`.

### Lo que cambió el `polish` del 05/09, y toca a todo el portal

**`--tinta3` pasó de `#68727f` a `#5f6977`.** No es un retoque estético: a
`#68727f` daba 4,31:1 sobre `--nube-hundida` y 4,40:1 sobre `--duda-bruma`, así
que **pasaba la prueba de contraste en la página y la fallaba dentro de cualquier
caja hundida**. Ahora el token es el gris más claro que aguanta 4,5:1 sobre todos
los fondos claros del sistema (4,92 a 5,56:1). Cambia el gris de apoyo en todo el
portal y el panel; no puede empeorar nada, pero es un token compartido.

**Y hay `--duda-tinta2` (`#87632e`) para el texto de apoyo sobre el ámbar.** Sobre
un fondo con color el secundario se tiñe de ese mismo tono; un gris encima del
ámbar no llega al contraste y se lee como suciedad.

⚠️ **El medidor cuenta confirmación, no presencia.** Antes solo miraba si la lista
tenía filas, y un perfil rellenado entero por la lectura del CV marcaba **100 % en
verde** mientras el panel violeta de al lado decía «te quedan 6 datos por revisar».
`partes()` usa `comoVa()`, que devuelve `vacio | porRevisar | listo`, y el texto
distingue «puedes añadir» de «falta que revises»: a quien tiene la experiencia
sacada del currículum no se le pide que la escriba, se le pide que la mire.

⚠️ **Borrar dice qué se borró.** `useLista().anunciarBaja(queEra)` lo anuncia en la
región viva. **No lleva «Deshacer» a propósito**: recrear la fila le da un id nuevo
y la manda al final de la lista, así que el botón prometería devolverla a su sitio
y no lo haría. Un deshacer de verdad necesita que el backend sepa restaurar.

**Los dos menús de la cabecera son excluyentes y se cierran de tres formas.**
`useMenuFlotante(abierto, cerrar)` cubre Escape, el toque fuera y devolver el foco
al disparador; el estado vive en `CabeceraDelPerfil` como `'foto' | 'portada' | null`
para que no puedan taparse los dos sobre el nombre.

**La portada también pasa por el lienzo.** `recortarAlCentro(archivo, ancho, alto)`
sirve a las dos: la foto a 512×512 y la portada a 1600×400. El redibujado es lo que
tira los metadatos EXIF, y una portada —que suele ser la foto de un sitio— es el
archivo con más probabilidad de llevar coordenadas GPS.

### Los e2e apuntan a donde se les diga

`E2E_API` ya existía; ahora también `E2E_PORTAL` (el `baseURL`) y `E2E_PG` (el contenedor de
Postgres que limpia las cuentas). Los tres van juntos cuando se corre contra un worktree:

    E2E_PORTAL=http://localhost:5212 E2E_API=http://localhost:8088/api/v1 \
    E2E_PG=renaser-pg-perfil npx playwright test

⚠️ **`borrarCuentasDePrueba` hay que ampliarla con cada tabla nueva**, y lo dice su propio
comentario. La V51 añadió `lectura_cv_perfil` —que además arrastra sus `trabajo_ia` sin
postulación— y los archivos del perfil (foto, portada, currículum, diplomas). Sin eso la
cuenta no se puede borrar y la base desechable se llena de archivos huérfanos.

---

## La ficha dice QUÉ marcó la IA, y no solo cuántos (04/09/2026)

En el perfil integral la sección **«Hallazgos y alertas»** pintaba la etiqueta —`FORTALEZA`,
`RIESGO CRITICO`, `RIESGO DESARROLLABLE`, `FALTA EVIDENCIA`— y **a su lado nada**. Una columna de
rótulos sin una sola palabra de por qué. La tabla decía «1 riesgo crítico» y la única pantalla
que podía explicarlo enseñaba la palabra «riesgo crítico» otra vez.

⚠️ **La causa era un nombre de campo, y llevaba ahí desde el primer commit.** El backend manda
`HallazgoResponse(tipo, descripcion, evidencia, esCanalizable, sugerencia)`; la interfaz de
`tipos.ts` declaraba `{ tipo, texto }`, y `texto` no existe en ninguna versión de esa respuesta.
React recibía `undefined` y no dibuja `undefined`: ni un hueco, ni un error, ni un aviso en
consola. **Compilaba, pasaba el tipado y pasaba las pruebas** — porque el doble de
`verPerfilIntegral` mandaba `hallazgos: []`, así que ninguna prueba abrió nunca la lista. Es el
fallo que este archivo repite: un tipo que no es el del backend no lo dice TypeScript, lo dice la
pantalla en blanco tres meses después.

Ahora cada hallazgo sale con su **frase** y con **en qué se basa**, que es lo que permite no
creerse la afirmación a ciegas.

### Se enseñan cuatro de los cinco tipos, y agrupados

Fuera `PREFERENCIA`: «su motivación está en lo técnico» es contexto para la entrevista, no algo
que mueva una decisión. Dentro `FALTA_EVIDENCIA`, y conviene decir por qué no es un riesgo: **un
riesgo es algo que la persona hace mal; un hueco es algo que no sabemos** —la Regla 1 del
documento 03 prohíbe expresamente mezclarlos— y el hueco suele ser justo lo que decide qué
preguntar. «No hay evidencia de gestión de equipos» no descalifica a nadie.

El orden es por tipo y no el que devolvió el modelo: **primero lo que suma, luego lo que resta,
al final lo que falta por saber**. Con todo entremezclado había que leer los siete para saber si
había algo grave.

### La sugerencia llega y no se pinta

El agente propone qué hacer con cada hallazgo —«preguntarle por un cierre de caja que haya
firmado él»— y es texto útil, pero **triplicaba el alto**: siete hallazgos pasaban de siete
líneas a veintiuna en una ficha que se lee mientras se decide. El campo sigue viajando en la
respuesta para el día que tenga su sitio.

### ⚠️ Las alertas quedan fuera, y el contador se queda sin puerta

`CONTRADICCION` y `DEMASIADO_IDEAL` viajaban en la respuesta y **ni siquiera estaban declaradas
en el tipo**. Se declararon y se decidió no pintarlas: una alerta no descarta a nadie (RF-64), es
una pregunta para la conversación final, y el titular pasó de «Hallazgos y alertas» a
**«Hallazgos»** a secas para no prometer lo que no está.

**Consecuencia sabida, no olvido:** el ranking sigue contando alertas en su columna y en el «N
alerta(s)» de la ficha, y hoy ese número **no se puede abrir en ninguna pantalla**. Volver a
enseñarlas es una línea. El tipo se declara igual, porque un tipo que calla lo que el backend
manda es exactamente lo que produjo el fallo de arriba.

### ⚠️ Esto NO se enseña en la ficha de la prueba del puesto, y se probó

La columna de **Veredicto** puede decir «Con riesgo» en la pestaña de la prueba, y esa ficha no
tenía forma de explicarlo: el veredicto es `grupo_prioridad`, lo escribe la etapa 1 al cerrar el
perfil y **no se recalcula por etapa**. Parecía el sitio para responderlo. Se quitó.

El motivo es que en esa pantalla **«¿Por qué contratarlo?» y «Lectura de la prueba» salen ENTEROS
de la rúbrica de la prueba** —y están ahí justamente porque en el perfil integral la frase no
cuadraba con su número—. Una segunda lista de fortalezas sacada del currículum, pegada debajo, no
añade contexto: invita a confundir las dos fuentes. Quien vea «Con riesgo» lo mira en su pestaña.
Lo deja fijado un caso de prueba, para que no se vuelva a añadir sin saber que ya se decidió.

⚠️ **Y de paso, algo que el rótulo esconde: «Con riesgo» NO significa que haya un riesgo
crítico.** La regla del backend mete en ese grupo a dos poblaciones —quien llega a la nota alta
arrastrando un riesgo crítico, y quien se queda entre los dos cortes de nota sin arrastrar nada—.
Un 70 limpio, sin un solo hallazgo, sale «Con riesgo».

---

## Lo que entregó se ve desde la ficha (02/09/2026)

Los entregables de la prueba los leían **dos**: el propio candidato en su portal, y el agente al
armar su insumo. Quien tenía que poner a mano la nota de un criterio —los que la rúbrica reserva
a una persona, que son justo los que el modelo no puede leer: un vídeo, un enlace— **no tenía
dónde ver el vídeo**. Se le pedía un puntaje sobre algo que ninguna pantalla le enseñaba. Ahora
hay un bloque **«Lo que entregó»** en la ficha (`src/panel/vacantes/EntregablesDePrueba.tsx`),
entre la rúbrica y «Lo que escribió en la prueba»: cuánto vale, qué entregó, qué escribió — que
es el orden en que se revisa. Lo alimenta `GET /postulaciones/{id}/prueba/entregables`, nuevo.

### Salen todos los pedidos, entregados o no

⚠️ **Un hueco no se lee: se lee una lista más corta, que parece completa.** Que faltara el
tercero, y que fuera obligatorio, es justo lo que hay que ver antes de poner una nota. Por eso la
fila sale igual y **la palabra va dentro de la píldora** —«Falta, y era obligatorio»—: es la
regla de la forma primero, y en gris `--mal` y la prosa caen casi en la misma luminancia.

### El permiso tiene dos niveles, porque el enlace ES el entregable

Listar pide `abrir_ficha_candidato`; el **`enlace` y el `archivoId` viajan solo con
`descargar_entregables`**. Sin el segundo se sigue sabiendo qué entregó y cuándo —lo que necesita
quien solo lleva el seguimiento— y `porQueNoSeVe` explica el hueco con palabras.

⚠️ **No es una asimetría, es cerrar la puerta de al lado.** En la prueba de marketing la
sustentación en vídeo se entrega **pegando una dirección**, así que repartir el enlace con el
permiso flojo abriría por ahí justo lo que las dos rutas de `/archivos` cierran.

⚠️ **Y hasta la V48 abrir un entregable respondía 404 para cualquier empresa que no fuera la
plataforma.** No era del panel: el backend sellaba el archivo con la organización de quien lo
sube —el candidato, que es de la plataforma— y lo busca con la de la empresa de la vacante. El
porqué entero está en el `CLAUDE.MD` del backend. **Esta pantalla es la primera que lo habría
destapado**, y hoy no se nota porque RENASER es las dos cosas a la vez.

### ⚠️ El enlace firmado NO falla en local, y decidir por la excepción no habría caído nunca

`AlmacenArchivosEnMemoria.urlDeDescarga` devuelve `Optional.of("memoria://…")`: el endpoint
contesta **200** con una url que ningún navegador abre. Lo dice `application-local.yaml` en su
bloque de archivos. Así que el botón **no decide por la excepción —no hay ninguna— sino por el
esquema de la url**, y lo que no sea `http`/`https` cae a `/archivos/{id}/descarga`, que sirve
los bytes por el backend y funciona en los dos entornos. El `catch` sigue haciendo falta para el
403 y para la red caída; lo que nunca se dispara en local es él.


### ⚠️ `window.open` después de un `await` lo bloquea el navegador, y bloqueado devuelve `null`

**No lanza.** Un `try/catch` alrededor no se entera, así que la pantalla se quedaría diciendo
«Abriendo…» sobre una ventana que nunca existió. Por eso se pide **antes** del `await`, dentro
del gesto de la persona: se abre en blanco, se navega si la url sirve, y se cierra si toca
descargar. Es de la familia del `<button>` sin `type`: el navegador hace algo razonable, distinto
de lo que se quería, y sin error.

### El enlace del candidato es contenido de fuera

⚠️ **Solo se hace pulsable lo que parsea como `http` o `https`.** Es texto libre —la única
validación que tiene, ni en el DTO ni en la base, es que no venga en blanco—. React neutraliza
`javascript:` en un `href` pero no los demás esquemas, y lo que no pasa la guarda se pinta como
texto, que se lee y se copia, diciendo por qué no se abre.

⚠️ **El texto del enlace es la dirección entera, a propósito.** Un «Ver el vídeo» escondería a
dónde lleva, y quien va a pulsar sobre algo que escribió un desconocido tiene derecho a ver el
destino antes. Por lo mismo va con `noopener noreferrer`.

### ⚠️ Un 404 de ese endpoint son DOS cosas, y la pantalla no puede saber cuál

El backend contesta 404 cuando la persona no tiene intento de prueba —no la rindió— **y también
cuando la vacante queda fuera del alcance de quien mira**, porque `AlcanceSobreLaVacante` devuelve
404 y no 403 a propósito, para no confirmar que existe algo que no te toca. Por eso la frase **no
afirma** que no entregó: nombra las dos posibilidades. Decirlo era el fallo caro —quien califica
leería un hecho sobre la persona cuando lo que pasa es que no alcanza a verlo—, y es la misma
lección del guion del ranking, que significaba cinco cosas y no decía cuál.

**Una lista vacía sí se afirma**: una prueba sin entregables es un cuestionario y se contesta
escribiendo. El backend devuelve `[]`, no 404.

### La sexta fixtura que iba a mentir

`datos-panel.mjs` no traía la ruta, y el interceptor de `capturar-panel.mjs` acaba en `?? []`:
la captura habría escrito **«esta prueba no pedía entregar nada» sobre una postulación que sí
tenía entregables**. No es un hueco, es una afirmación falsa —y del lado que exculpa al sistema.
Ahora siembra los cuatro casos que hay que poder mirar: un enlace, un archivo, uno obligatorio
**sin** entregar, y uno cuyo archivo ya no está guardado.

### Lo que queda sin resolver

⚠️ **Con formato `CUALQUIERA` se puede perder una entrega de vista.** Quien pega un enlace y
luego sube un archivo deja **dos filas**, y de cada entregable se enseña la última versión: el
enlace anterior no se pinta en ningún sitio. Arreglarlo pide que el backend mande el historial.
Está dicho en el código y no resuelto.

### Cómo se comprueba

```bash
npm run typecheck && npm test
```

`npm test` son **528 pruebas en 30 archivos** (medido el 02/09/2026), y pasan enteras; `tsc` sale
limpio y el detector de impeccable no encuentra nada en el bloque nuevo.

⚠️ **Lo que NO se pudo comprobar: que el enlace firmado del bucket sirva bytes.** En local el
almacén es el doble en memoria y no hay bucket, así que se verificó **el camino de la descarga**
—el único que existe en los dos entornos— y el otro queda afirmado por construcción. Es el mismo
hueco que ya tiene el enunciado subido de una prueba.

---

## Los e2e viven en `herramientas/e2e/` y corren con `@playwright/test` (01/09/2026)

Había doce arneses sueltos en `herramientas/`, cada uno un `node` a pelo sobre la librería
`playwright`, con sus comprobaciones a mano y su `process.exit`. **Se migraron todos al
corredor** y la suite es una sola: 22 archivos numerados en `herramientas/e2e/`, con
`playwright.config.ts` en la raíz. Cada comprobación del script viejo es un `expect` del
nuevo; lo que se saltaba por falta de datos es un `test.skip` con el mismo motivo.

```bash
npm run test:e2e            # todo, con el Chromium clavado de la librería
npm run test:e2e:ui         # la ventana con la lista, el viaje en el tiempo y el «elegir locator»
npm run test:e2e:chrome     # el Chrome de la máquina, con ventana
npm run typecheck:e2e       # los specs NO entran en `npm run typecheck`: tienen su tsconfig
npx playwright test herramientas/e2e/15-componer-prueba.spec.ts   # uno solo
```

⚠️ **La suite no levanta nada**: espera Vite en 5174 y Spring en 8081 ya arrancados, con la base
sembrada (`scripts/sembrar-datos-de-prueba.py` del backend). **Un solo worker**: la base es
compartida y varios specs escriben. Y **17 tests se saltan** en local con motivo: los que
dependen de la IA (aquí la clave es ficticia y el trabajo acaba en `FALLIDA`), un nivel del
banco con dos versiones publicadas, una prueba entregada, una sesión con inscritos.

**Los apartados de fechas anteriores citan los scripts por su nombre de entonces.** Hoy son:

| Antes | Hoy |
|---|---|
| `e2e-panel-entrar.mjs` | `herramientas/e2e/10-panel-entrar.spec.ts` |
| `e2e-perfil.mjs` | `herramientas/e2e/11-perfil.spec.ts` |
| `e2e-postular.mjs` | `herramientas/e2e/12-postular.spec.ts` |
| `e2e-etapas.mjs` | `herramientas/e2e/13-etapas.spec.ts` |
| `e2e-vacante.mjs` | `herramientas/e2e/14-vacante.spec.ts` |
| `e2e-componer-prueba.mjs` | `herramientas/e2e/15-componer-prueba.spec.ts` |
| `e2e-cuestionario-tecnico.mjs` | `herramientas/e2e/16-cuestionario-tecnico.spec.ts` |
| `e2e-prueba-tecnica.mjs` | `herramientas/e2e/17-prueba-tecnica.spec.ts` |
| `e2e-ranking-etapa.mjs` | `herramientas/e2e/18-ranking-contra-api.spec.ts` |
| `e2e-banco.mjs` | `herramientas/e2e/19-banco.spec.ts` |
| `e2e-prueba-y-empresas.mjs` | `herramientas/e2e/20-prueba-y-empresas.spec.ts` |
| `e2e-simulacion-permisos.mjs` | `herramientas/e2e/21-simulacion-permisos.spec.ts` |

`e2e-android.mjs` se queda como script: conduce Maestro contra un APK, no un navegador.

---

## El ranking se ordena, se filtra y se descarga (01/09/2026)

La mesa donde se decide dejó de ser una lista que solo se mira. **Todo pasa en el navegador**:
ordenar o filtrar no le vuelve a pedir nada al servidor, y el corte de la botonera —«Por revisar»
(por defecto), «Le toca al candidato» y «Toda la tanda»— sigue mandando por encima de todo lo
demás. Las reglas viven en `src/panel/vacantes/ranking.ts`, con sus tests al lado, y el porqué de
esos tres cortes está en `docs/06-FLUJO-COMPLETO.md`.

### Cuatro cabeceras, tres estados cada una

Candidato, Ciudad, la nota de la etapa y Pretensión. Cada pulsación avanza: el sentido natural de
la columna —**la nota abre por la mayor**, los textos de la A a la Z, la pretensión de la más
baja—, el inverso, y al tercero **`alternarOrden` devuelve `null` y se vuelve al orden del
backend**, que es el que agrupa por prioridad y ordena la nota dentro. Sin ese tercer estado
habría que recargar para recuperarlo.

⚠️ **El orden del cliente es PLANO: manda la columna pedida y nada más.** Hubo una versión que
ordenaba la nota dentro de cada grupo de prioridad y se quitó. Dos motivos, y el segundo es el
que decide: agrupar casi nunca cambiaba el resultado —los tres grupos que la IA escribe (`ALTA`,
`POTENCIAL_CON_RIESGO`, `NO_PRIORIZADO`) cuelgan de la propia nota, y `INCOMPATIBLE` no lo
escribe nadie porque quien falla un requisito indispensable se cierra como `NO_CONTINUA` sin
llegar a tener grupo—; y cuando cambiaba algo, salía una tabla 55, 74, 61, 95 que se lee como
rota. Un orden que hay que explicar no está ordenando.

**El grupo se sigue pintando en cada fila**, dentro de la celda del candidato: ya no mueve a
nadie, pero un 95 con riesgo crítico es justo lo que hay que ver antes de llamar.

⚠️ **Los vacíos, al final, suba o baje el orden.** `elHuecoAlFinal` decide la ausencia **antes**
de aplicar el sentido. Con un `ordenar(...).reverse()` los huecos suben a la primera pantalla al
pulsar «descendente», que es como sale mal. Y los textos comparan con `localeCompare` en español,
o «Ávila» cae detrás de «Zurita».

⚠️ **`ordenar` copia antes de ordenar.** `filas` es el array de la caché de react-query; un
`.sort()` encima lo reordena para todo el que lo lea después, y el estropicio sobrevive a cambiar
de pestaña.

### Los cuatro filtros

Buscador por nombre **sin tildes ni mayúsculas** (`paraBuscar`: media tanda se llama Fátima o
Muñoz), ciudades marcables de varias en varias, y rangos de nota y de pretensión.

⚠️ **Las ciudades salen de las FILAS, nunca del catálogo de ubigeo**, y de las filas **sin
filtrar**: del catálogo serían 196 filtros que no devuelven a nadie, y de las visibles, marcar
una haría desaparecer a las demás y no habría forma de añadir la segunda.

⚠️ **Un rango deja fuera a quien no declaró el dato, y es a propósito.** Una fila sin nota no es
«≥ 60». Se dice debajo del control, y vuelven con «Ver a todos». La pretensión se cruza por
**solape**, y quien declaró un solo extremo cuenta como esa cifra a secas: «desde 5 000» entra en
«hasta 6 000» y no en «desde 6 000». Leerlo como una recta abierta sería ponerle en la boca al
candidato una cifra que no escribió.

### Ciudad y Pretensión: dos columnas que pueden no existir

⚠️ **Si ninguna fila trae una de las dos, la columna no se pinta y se dice por qué** — y los
motivos son distintos. Ciudad: solo se le pide a quien crea su cuenta desde ahora, así que hoy
casi ninguna postulación la trae. Pretensión: **hay dos causas opuestas y el nulo no las separa**
—el candidato no declaró sueldo, o quien mira no tiene `ver_pretension`, que solo tiene
Dirección—, y por eso `RankingVacante.puedeVerPretension` viaja: sin esa señal la frase tendría
que enumerar hipótesis. Una columna de guiones se lee al revés: «nadie pidió sueldo».

⚠️ **La ciudad se detecta por el código además de por el nombre** (`ciudad` o `ciudadCodigo`):
llegan de dos consultas distintas y tener código no implica tener nombre. Y
`columnasDelRanking` es **la única fuente del `colSpan`**, ahora que hay columnas que aparecen y
desaparecen con los datos.

**La pretensión no es un dato nuevo**: vive en el perfil del candidato desde antes. Nueva es la
columna.

### El Excel

`POST /vacantes/{id}/ranking/excel`, y solo en **Perfil integral** y **Prueba del puesto**: en
las otras tres el botón no existe en vez de salir y fallar con un 400.

⚠️ **Es POST y no GET porque lleva la lista entera de ids ordenada**, que en una tanda de ochenta
no cabe en una URL. Y por eso mismo no vale un `<a href>`: el token va en una cabecera, que un
enlace no puede poner. El archivo se abre con `createObjectURL`.

La hoja lleva **las filas que se ven, en el orden de la pantalla** —el backend escribe el orden
que se le manda y nada más— y dentro va `describirFiltro`: etapa, corte, filtros, orden aplicado
y, si la pretensión salió vacía, por qué. La hoja se reenvía y se abre lejos del panel, donde ya
no hay pantalla que explique que un blanco puede ser un permiso.

### Crear cuenta pide dónde vive

`POST /portal/cuentas` gana `ciudadUbigeo`, obligatorio: el ubigeo de nivel 2 —la provincia— o
`EXT`. Las opciones vienen de `GET /portal/catalogos/ubigeo`, **sin token**, porque quien está
creando la cuenta todavía no tiene ninguno. En pantalla, **un solo `<select>` nativo con
`<optgroup>` por departamento** y las 196 provincias, no dos encadenados; «Fuera del Perú» va
suelto al final, porque con `label={null}` el navegador pinta un grupo llamado «null» y colgarlo
de un departamento inventado diría que el extranjero está en algún sitio del Perú.

⚠️ **`z.string().min(1)` y no `z.string()` a secas.** La primera opción vale `''` —hace falta
para que se vea que no hay nada elegido— y una cadena vacía es una cadena válida: sin el mínimo
el formulario salía y el backend lo rebotaba con un 400 que la pantalla no supo prevenir.

⚠️ **Se pide UNA vez y a nadie más.** A quien ya tiene cuenta no se le pregunta nunca, así que el
panel tiene que contar con que **casi ninguna postulación trae ciudad**. De ahí que el filtro de
ciudad y su columna nazcan de las filas y no del catálogo.

⚠️ **Un fallo del catálogo se dice, no se disimula.** El campo es obligatorio: un desplegable
apagado y mudo deja a la persona pulsando «Crear cuenta» contra un error que no explica nada.

---

## 10/09 · El suelo compartido de «El escaparate» (tanda 0 de la migración)

La migración del mundo visual va por pantallas, pero antes de recomponer ninguna se arregló lo
que todas comparten. Once archivos, y mueven las diecisiete pantallas.

### Había dos especificaciones de botón, y ganó el kit

La portada escribía los suyos a mano —44 px, 14 px de letra en peso 500, secundario sin
contorno— mientras `piezas.module.css` decía otra cosa y lo consumían las otras dieciséis hojas
en 62 sitios. **Cada pantalla que se migrara heredaba la contradicción.**

Gana el kit, y el argumento es medible, no de gusto: el secundario de la portada se sostenía
con una sombra de 0,05 de alfa, que no da contraste en el límite del control. `--borde-control`
da 3,45:1, que es lo que WCAG 1.4.11 pide. La portada ahora compone del kit, así que sus dos
botones pasan a 48 px y 16/600, y el secundario gana contorno.

El kit gana además lo que le faltaba para ser una especificación completa: `.secundarioGrande`
—no había un secundario de 48 px con el que emparejar `.acentoGrande`— y la familia de peligro
`.peligroso` / `.peligrosoMenor` / `.peligrosoContorno`, que estaba copiada en cinco sitios de
tres pantallas.

⚠️ **Cinco de esos botones redondeaban a `--radio`,** que es 12 px y el radio de una caja, no el
de un control. El grep de píldoras no lo veía porque buscaba `999px`. Al componer del kit se
corrigió de paso.

### Las siete copias de un panel

`0 2px 6px rgb(35 43 54 / 0.05), 0 14px 40px rgb(86 56 214 / 0.14)` estaba escrito **literal en
siete hojas**: la pizarra y el violeta de «El canto», dos colores que ya no existen en ningún
token. No era una sombra repetida, era un componente copiado, así que subió como pieza y no
como token.

Y al mirarlas una a una, las siete no significaban lo mismo. Cinco dicen «te toca a ti» y dos
—los requisitos indispensables de la ficha de la vacante y de postular— dicen «esto te
descarta». Esas dos **pasan a ámbar**: donde aparecen todavía no hay ninguna postulación y por
tanto ningún turno, y lo que dicen es exactamente la definición del ámbar. El coral queda libre
para discriminar donde hace falta, que es «Mis procesos».

Quedan tres paneles en `piezas.module.css`: `.turno`, `.panelDeEspera` y `.indispensable`.

### El vidrio empañado de la cabecera

`backdrop-filter: blur(18px) saturate(1.4)` existía porque la cabecera se pegaba encima del
canto irisado. Sin canto, desenfocaba un `--cielo` plano en las diecisiete pantallas a cambio
de una capa de compositor en cada una. Se fue, y con él su bloque `@supports` y una segunda
declaración de `--alto-cabecera` que nadie leía —sus seis consumidores no son descendientes de
`.cabecera`, así que ya tomaban la de `:root`—.

Quitarlo arregló algo que no se veía venir: **las barras pegajosas del examen se pinchan bajo
`--alto-cabecera` y se transparentaban a través de la cabecera al hacer scroll.**

El enlace activo pasa de un relleno de bruma escrito con la pizarra vieja a peso 700 más un
filete coral, que es lo que DESIGN.md ya documentaba.

### Dos cosas que aparecieron al mirar

**`composes` no funciona en un selector compuesto.** `Proceso.module.css` tenía
`.estadoActual.turno`, y al componer ahí, PostCSS devuelve un 500 y **la aplicación entera deja
de montar**: «composition is only allowed when selector is single :local class name». Al ir a
arreglarlo resultó que `estilos.turno` no se aplica en ningún sitio de `Proceso.tsx`: la regla
era CSS muerto y lo único que hacía era arrastrar la sombra violeta. Se borró sin cambiar un
píxel. Cuando se recomponga la pantalla habrá que decidir de verdad si ahí va un panel coral.

**El examen sí se movía.** DESIGN.md prohíbe cualquier movimiento con el reloj corriendo y las
piezas lo respetaban, pero `PantallaConEntrada` envuelve el `<Outlet>` del armazón: la
evaluación, la prueba y el cuestionario entraban desplazándose igual que las demás. **La única
pieza que una pantalla no puede rechazar es la que le pone su contenedor.** El rechazo vive
ahora en `movimiento.tsx`, comparando la ruta contra los tres patrones cronometrados.

De paso, `cuestionarioTecnico` no estaba en `TITULOS` del armazón: esa pantalla no cambiaba el
`document.title`, que es WCAG 2.4.2.

### Lo que se puede comprobar y lo que no

620 unitarias en verde y typecheck limpio, pero **eso no valida nada de esta tanda**: ninguna
prueba del portal asserta sobre clase, estilo, sombra o color —todas localizan por rol y nombre
accesible—. Que pasen dice que no se rompió el marcado, no que se vea bien.

De ahí sale la regla de la migración: **se cambia la clase, nunca el elemento.** Poner
`.acentoGrande` en un `<a>` donde había un `<button>` cambia el rol y mata
`getByRole('button', …)`, que es como localizan las 620.

---

## 10/09 · El entierro del canto (tanda 1)

`src/ui/Canto.tsx` y su hoja **están borrados**. Eran 282 líneas con el degradado del mundo
anterior al anterior —teal, aqua, azul, púrpura, violeta— **hardcodeado dentro del SVG**, de
modo que ni siquiera leía `var(--canto)`. Su único consumidor era «Mis procesos», que lo
pintaba en sus tres estados.

**No lo sustituye nada.** El escaparate enseña el producto a quien no ha comprado; en «Mis
procesos» el candidato ya tiene procesos reales, y la pieza iluminada del cuarto gris es el
panel que reclama, no un adorno arriba.

Con él se fueron tres cosas que solo existían para hacerle sitio en `Procesos.module.css`: un
`padding-top` de `clamp(184px, 25vh, 272px)`, el `position: relative` de la página y la regla
que subía todo lo legible a `z-index: 1`. Y una cuarta en el armazón: `.principal` tenía
`position: relative` para atrapar el canto, que iba en `absolute`. **Se comprobó antes de
borrarla**: `Modal` y `Avisos` van en `fixed` —que un ancestro relativo no cambia— y los únicos
`absolute` sin ancestro posicionado del portal son los recortes de solo-lectores, que no
dependen del bloque contenedor. En pantalla, el modal sigue cubriendo el viewport.

### El recorrido dice el estado con la forma

`Seguimiento.module.css` era el último sitio del portal que pintaba `--canto`: cada tramo
enseñaba su rebanada del espectro con `background-position-x: calc(var(--i) * 25%)`, así que
avanzar cambiaba de color. Adoptó las formas que DESIGN.md ya tenía tabuladas:

| Tramo | Antes | Ahora |
|---|---|---|
| Formada | su rebanada del espectro | 8 px maciza en tinta |
| Viva | violeta pleno con resplandor | 12 px maciza en tinta, con filete blanco |
| Formándose | espectro desvanecido a la mitad | igual, sobre tinta |
| Ausente | filete de 2 px | igual |
| Dispersa | punteada | igual |

Medido en pantalla con cuatro postulaciones: 7 formadas, 4 vivas, 13 ausentes y 1 formándose,
todas sin `background-image`. Las cinco se distinguen en gris.

⚠️ **La viva no lleva coral aunque sea el tramo que te reclama.** El panel `.turno` cuelga
justo debajo y ya lo dice con palabras; dos corales en la misma postulación no marcan el doble.

El `--i` que llevaba cada `<li>` desapareció del TSX: solo servía para posicionar el espectro.

### Dos cosas que aparecieron al verlo

**El anillo de foco redondeaba el elemento.** `:focus-visible` en `mundo.css` declaraba
`border-radius: var(--radio-menor)`, y el contorno del navegador ya sigue el radio del
elemento: la declaración no cambiaba el anillo, cambiaba el botón. Un botón de 4 px saltaba a
8 al recibir foco, y en el aviso de retirarse se veían **dos esquinas distintas en dos botones
contiguos**. Se quitó; ahora cada cosa se anilla con la forma que tiene.

**El backend simulado no arrancaba.** `herramientas/backend-simulado.mjs` tenía el puerto fijo
en 8080, que es justo donde vive `postgresql-adminer-1`. Ahora lee `PUERTO` del entorno:
`PUERTO=8082 node herramientas/backend-simulado.mjs`. Eso desbloqueó ver las pantallas con
datos sin tocar ninguna base.

⚠️ **`02-regresion-portal` no vale contra el simulado.** Espera las vacantes sembradas del
backend real —«Desarrollador web»— y el simulado sirve otras tres. Sus fallos son de datos,
no de código: la pantalla renderiza entera. (Los siete que se contaron el 10/09 incluían el
hueco del catálogo de ubigeo, que ya está tapado.) Lo que sí vale es `23-movimiento`, que no
depende de datos concretos.

**Al simulado le faltaba el catálogo de provincias, y el registro lo decía bien.** El
desplegable de «Dónde vives» pide `/catalogos/ubigeo`, que se añadió al backend real después
de escribir el simulado; contra el simulado devolvía 404 y la pantalla mostraba «No pudimos
cargar la lista de provincias» en vez de dejar un desplegable muerto, que es el comportamiento
correcto. Se le añadió la constante `UBIGEO` con **quince provincias de muestra, no las 196**:
las suficientes para ver el desplegable agrupado por departamento y comprobar que «Fuera del
Perú» va suelto al final.

---

## 10/09 · El vocabulario de página (tanda 2)

«El caso ámbar» y «La validación práctica» son las dos pantallas más baratas del portal donde
equivocarse —sin backend detrás, sin una sola prueba, y a una no se llega desde ningún sitio—,
así que son donde se fija el vocabulario que van a consumir las trece hojas restantes.

Al ponerlas una al lado de otra resultó que **tenían el mismo CSS escrito dos veces**, palabra
por palabra, en once reglas: el carril, el reparto en columnas, el bloque, el título de bloque,
el texto y sus dos puntos de corte. Eso es lo que subió a **`src/estilos/pagina.module.css`**.

Va aparte de `piezas.module.css` porque son dos preguntas distintas: aquél tiene las cosas
—botones, paneles—, éste tiene el sitio donde se ponen. Una pantalla puede componerse entera
con esta hoja sin usar ni un botón.

### Tres trampas de `composes`, y las tres se ven en pantalla

**Un selector de descendiente que llega por `composes` le gana a la clase del consumidor.**
`.encabezado h1` pesa (0,1,1) y `.titulo` pesa (0,1,0), así que la primera versión de la hoja
dejaba a «El caso ámbar» sin poder pintar su explicación en tinta plena. **Se rehízo con clases
sueltas** —`.encabezado`, `.titular`, `.bajada`— antes de que la consumiera nadie más. Quien
compone decide.

**`composes` en una lista de selectores tumba la aplicación.** `.enviar, .enviar:hover { composes: … }`
devuelve un 500 de PostCSS y React no monta. Es el mismo fallo que `.estadoActual.turno` de la
tanda 0: **solo se admite una clase simple**.

**Y el `:hover` del kit pesa más que el tuyo.** `.acentoGrande:hover:not(:disabled)` es (0,3,0)
y `.enviar:hover` es (0,2,0). Importa porque «Enviar respuesta» es un `<span>` —no hay nada que
pulsar—, así que nunca casa `:disabled` y el hover del kit **sí** le aplicaba: el botón muerto
se ponía negro y sacaba su halo coral al pasar por encima. Se ató a
`[aria-disabled='true']`, que el marcado ya tenía, y así no depende del orden de las hojas.

### Las dos pierden el coral

Las dos lo tenían con un argumento razonable —en las dos la espera es del candidato—, y las dos
lo pierden por el mismo motivo: **el coral sirve para *encontrar* tu turno entre cosas que no lo
son**, y a estas pantallas se llega porque te tocaba y no hay más que una cosa. No hay nada
contra lo que discriminar. Lo que separa el panel de arriba es el titular, que es lo primero que
se lee.

En «El caso ámbar» hay además un conteo: la pantalla **ya pinta ámbar**, en el aviso de que el
formulario todavía no envía, y ese no es negociable porque es lo único que impide perder lo
escrito. Dos colores no marcan el doble.

Medido: cero corales en las dos.

### El ámbar es una pieza, no un caso

`.indispensable` se quedaba corto de nombre: lo que comparten los requisitos de una vacante y
el aviso del formulario apagado no es «esto te descarta», es **«esto te cambia la decisión»**,
que es la definición del ámbar. Ahora el kit tiene `.enDuda` (1 px) e `.indispensable`, que es
el mismo ámbar con el borde al doble para el único descarte automático del producto.

### La barra lateral prohibida

Los dos avisos —`.todaviaNo` y `.falta`— llevaban un filete de 3 px a la izquierda hecho con
`::before`. Es la barra de acento lateral, que está prohibida en este mundo y que ya costó dos
correcciones en los prototipos. Fuera; el bloque se distingue por su fondo y su contorno
enteros, y el hueco declarado subió a la hoja como `.hueco`.

⚠️ **Quedan trece en pantallas sin migrar** —cuenta, postular, evaluación, prueba,
cuestionario, simulación, privacidad, perfil y el `Campo` compartido—. Cada tanda se lleva las
suyas.

---

## 10/09 · Las dos pantallas públicas (tanda 3)

La ficha de una vacante y la política de privacidad: lo que se ve sin cuenta, y lo primero que
consume el vocabulario fijado en la tanda anterior.

### Los cuatro anchos pasan a ser variantes con nombre

La ficha quiere 68rem y la política 48. La forma obvia es que cada hoja se escriba su
`max-width` encima del de `.hoja` — y funciona, pero **funciona por el orden en que se juntan
las hojas**, no porque nadie lo haya decidido: las dos reglas pesan (0,1,0) y gana la última
del bundle. Ahora los cuatro anchos legales son variantes declaradas —`.hoja`, `.hojaProsa`,
`.hojaFormulario`, `.hojaCorta`— y gana la que se nombra.

### El ritmo de sección no sube al vocabulario

La ficha separa sus secciones a `--e7` y la política a `--e6`, y es a propósito: la política
tiene ocho seguidas, y con 48 px entre cada una el documento se convierte en un desfiladero.
Dos consumidores no bastan si lo quieren distinto. Se quedan locales.

### El bloque ámbar es una sola cosa

Los requisitos indispensables ya eran ámbar desde la tanda 0, pero por dentro seguían en
`--tinta` con viñetas negras: se leía como texto normal metido en una caja de color. Ahora el
titular, la prosa y las viñetas van en la tinta de la familia —`--duda-tinta` a 7,9:1 y
`--duda` a 5,2:1 para las viñetas, las dos medidas contra `--duda-bruma`—. El bloque se lee
como una unidad y no como una advertencia pegada encima de un párrafo.

### Lo que se comprobó

Cero corales en las dos pantallas. Carril de 1088 px en la ficha y 768 px en la política, las
dos con 48 px de aire arriba y la prosa cortada a 512 px por `--medida`. A 375 px ninguna
desborda y el botón de postular ocupa el ancho entero a 48 px de alto.

`23-movimiento` sigue en 6/6: el título que viaja de la tarjeta al titular de la ficha
—`layoutId`, pieza B— sobrevivió a que el `h1` reciba ahora una clase.

### DESIGN.md iba por detrás de su propio frontmatter

El bloque `components` seguía describiendo el botón viejo —44 px, `12px 24px`, 14 px— que se
sustituyó en la tanda 0, y la nota de estado decía que «Mis procesos» todavía pinta el
`<Canto>`, borrado en la tanda 1. **El frontmatter es lo que lee el detector**, así que un
frontmatter viejo no es una errata: es una regla falsa que el detector defiende. Corregido, y
con `button-accion-menor` y `panel-en-duda` añadidos.

---

## 10/09 · Los cuatro caminos de entrada (tanda 4)

Entrar, crear cuenta, canjear el enlace del correo y la salida de quien no puede: cuatro
pantallas sobre **una sola hoja de 206 líneas**, que es el mejor ratio de toda la migración.

### El formulario pasa a vivir en una superficie

Flotaba directamente sobre el cielo. En un mundo donde el fondo es gris y lo blanco son objetos
puestos encima, **un formulario sin superficie no se lee como una cosa: se lee como página**.
Ahora es un bloque de nube con 32 px dentro; el titular y el pie se quedan fuera, porque sitúan
la pantalla y no forman parte de lo que se rellena.

Lo mismo para el momento de canjear el enlace del correo, que es el mismo momento —una sola
cosa sobre la mesa— pero sin nada que rellenar, y para las dos salidas de `/clave`.

### El `composes` entre archivos no gana por escribirlo después

Aquí es donde se vio de verdad. `.formulario { composes: bloque; padding: var(--e6) }`
**daba 24 px, no 32**: las dos reglas pesan (0,1,0) y cuál gana lo decide el orden en que Vite
inyecta las hojas, que no es el orden en que se escriben. Dentro de una misma hoja el orden sí
está garantizado —por eso `.indispensable { composes: enDuda; border-width: 2px }` sí funciona—,
así que la respuesta es la misma que con los carriles: **una variante con nombre**,
`.bloqueHolgado`.

Con eso ya son tres sitios donde la regla se aplica: los cuatro anchos, los dos rellenos de
bloque, y `.paginaAncha` de crear cuenta, que era `.pagina` **más** `.paginaAncha` en el mismo
elemento —dos carriles peleando— y ahora es una clase entera.

### Tres barras laterales menos, una de ellas compartida con el panel

Se fueron las de `.falloEnvio` y `.resumenErrores`, y **la de `ui/campos/Campo`**, que es la
tercera excepción documentada al «nada del panel». El argumento es el mismo que con el velo del
modal: el filete rojo se ve en cinco pantallas del candidato, y dejarlo conserva el defecto.
Ahí además sobraba por triplicado — el campo ya engorda su borde a 2 px y lo pone rojo, y el
mensaje ya va en `--mal` a 5,68:1. Eran tres señales para una cosa.

**Quedan diez**, todas en pantallas sin migrar: postular, evaluación, prueba, cuestionario,
simulación, privacidad y perfil.

### Lo que se comprobó a mano, porque no hay pruebas

Acceso y Clave no tienen ni una prueba, y Acceso es el canje del enlace por correo: si se
rompe, nadie entra. Se recorrieron los cuatro caminos en el navegador contra el backend
simulado. **Entrar funciona de principio a fin**: se rellena, se envía, el token queda guardado
y se llega a «Mis procesos».

Carriles medidos: 544 px entrar, 704 px crear cuenta. A 375 px ninguna desborda, las parejas de
campos caen a una columna y los campos de texto siguen a 16 px, que es lo que evita que iOS
haga zoom al enfocar.

Y se vio algo que el simulado regaló: entonces **no tenía `/catalogos/ubigeo`**, así que el
desplegable de provincias falló de verdad. La pantalla lo dijo —«No pudimos cargar la lista de
provincias. Recarga la página e inténtalo otra vez»— en vez de dejar un desplegable apagado y
mudo, que es justo lo que pide el aviso escrito en la bitácora del 07/09. *El 11/09 se le
añadió el catálogo al simulado, con quince provincias de muestra.*

---

## 10/09 · El centro del portal (tanda 5)

«Mis procesos» y el detalle de una postulación: las dos pantallas más visitadas, y donde se
fija la regla del coral que hereda todo lo demás.

### Un fallo de la tanda 1 que solo se veía en el teléfono

Al borrar el `<Canto>` se quitó el relleno que le hacía sitio **en escritorio y no en móvil**.
La media query de 760 px conservaba `clamp(168px, 24vh, 220px)`: **195 px de gris vacío antes
del titular en un teléfono**, un tercio de la pantalla. Se vio mirándolo a 375 px, no leyendo
el CSS. Medido después del arreglo: el titular pasó de empezar a 256 px a empezar a 93.

Es el argumento de mirar cada tanda en las dos anchuras y no solo en una.

### Las tarjetas dejan de flotar

`.proceso`, `.vacio` y `.estado` repetían `nube + regla + radio + sombra + 32 px`, y la sombra
iba **en reposo**. Eso contradice la regla del plano por defecto —una sombra responde a un
estado— y además hacía daño: si la caja entera flota, el panel coral de dentro, que sí lleva
sombra porque sí reclama, deja de distinguirse. Ahora las tres son `.bloqueHolgado` planas y
la única cosa que flota en la pantalla es lo que te toca.

### La pregunta del coral en el detalle ya estaba contestada, y no por mí

Quedó anotada en la tanda 0: `Proceso.tsx` nunca aplicaba su panel de turno, así que había que
decidir si esa pantalla pinta coral. **La respuesta está en la condición de render**: ese panel
solo se dibuja cuando `final && termino`, o sea cuando el proceso ya acabó — y un proceso
terminado no es nunca «te toca a ti».

El porqué está escrito en el propio TSX desde antes: mientras el proceso vive, quien reclama es
el hito abierto del recorrido, que `Seguimiento` ya pinta con su panel coral, y repetirlo
arriba daba **dos paneles idénticos con dos botones «Abrir prueba»**, en móvil a pantalla y
media de distancia. Duplicar el arranque de una prueba cronometrada e irreversible es el peor
sitio donde hacerlo.

Así que el panel pasa a hundido, como el cierre de «Mis procesos»: es la misma cosa dicha en la
otra pantalla. **Cero corales en `/procesos/:uuid`.**

### Lo que se comprobó

Cuatro paneles coral en «Mis procesos» con cuatro postulaciones que reclaman: uno por cada una,
que es la regla. Cero en el detalle de una terminada. Tarjetas con `box-shadow: none`. Carril
de 1088 px y 48 px de aire en las dos. A 375 px ninguna desborda.

### Lo que decidí no hacer

**El vacío de «Mis procesos» no converge en `ui/Vacio`.** El plan lo pedía por deduplicación,
pero son tres reglas contra un cambio de DOM en una pantalla que cubre `02-regresion-portal`,
que hoy no se puede correr —espera los datos sembrados del backend real—. Deduplicar a ciegas
una pantalla de las dos más visitadas no sale a cuenta.

---

## 10/09 · Una columna, una acción (tanda 6)

Postular, la simulación y privacidad y control. Las tres son de una columna con una sola acción
negra, y las tres soltaron un coral que no era un turno.

### Dónde estaba el coral decorativo

| Sitio | Qué marcaba | Ahora |
|---|---|---|
| `Postular` → `.zona.encima` | El currículum arrastrándose encima de la zona | Nube honda; el borde macizo de 2 px ya lo dice |
| `Simulacion` → `.fecha.elegida` | La fecha que elegiste | Nube hundida con borde de 2 px |

Los dos son **estados de interfaz**, no turnos: uno responde al puntero y el otro a una
selección. El coral significa «te toca a ti» y sirve para *encontrar* tu turno entre cosas que
no lo son — gastarlo aquí lo deja sin significar nada donde sí hace falta. Y a las dos
pantallas se llega precisamente porque te tocaba, así que dentro no queda nada contra lo que
discriminar.

Medido: **cero corales en las tres pantallas**.

### Cuatro barras laterales menos

`.consecuencia` de postular y de privacidad pasan a la pieza `.enDuda`, y los `.fallo` y
`.resumenErrores` de las tres pierden su filete rojo. **Quedan cinco**, todas en el examen y en
«Mi perfil».

### La distinción que hacía falta escribir

En la tanda 4 el formulario de entrar pasó a vivir en una superficie de nube. Postular **no**,
y no es incoherencia: entrar es una cosa pequeña sobre la mesa —tres campos y un botón—,
mientras que postular son 610 líneas de secciones separadas por reglas. Un documento largo
metido entero en una tarjeta blanca es una losa, no un objeto.

La regla: **una superficie envuelve una cosa, no un recorrido.** Si el contenido se lee de
arriba abajo en varias secciones, es un documento y va sobre el cielo.

### Un rato perdido con la caché de Vite

Después de un 500 de PostCSS —de los de `composes` mal puesto—, Vite se quedó sirviendo un
`Simulacion.tsx` **vacío**: el módulo compilaba a nada y la ruta reventaba con «does not
provide an export named 'Simulacion'». El archivo en disco estaba entero, 259 líneas. Se
arregla con `rm -rf node_modules/.vite` y un servidor nuevo.

⚠️ **Si una pantalla desaparece sin motivo después de un error de CSS, mira el disco antes de
buscar el fallo en el código.** El grafo de módulos de Vite se envenena y no se recupera solo.

---

## 10/09 · El examen (tanda 7)

Evaluación, la prueba y el cuestionario técnico: las tres pantallas con el reloj corriendo, y
las tres con reglas propias.

### La frase del umbral se hace visible

`Prueba.module.css:63` marcaba «queda poco» **solo con `color: var(--mal)`**. El color solo no
es una señal —WCAG 1.4.1—: quien no distingue el rojo no tenía ninguna.

Lo que había que arreglar no era escribir un aviso: **la frase ya existía en el DOM**.
`Cronometro` la emite en un `<p role="status">` con cuatro umbrales —media hora, diez minutos,
cinco, uno— y estaba en `.solo-lectores`, o sea que llegaba al lector de pantalla y a nadie
más. Se le añadió al componente un `classNameAviso` opcional que por defecto sigue siendo
`solo-lectores`; la prueba y el cuestionario le pasan una clase visible. **No es texto nuevo,
es texto que ya se decía y no se veía.**

### El desfase medido, y por qué el número es el peor caso

Al hacer visible la frase, la barra del reloj cambia de alto. **Medido en el navegador con la
prueba arrancada: 77 px en reposo, 111 px con la frase puesta.** El token decía 71, de cuando
la barra no tenía frase.

Se pone **111, que es el máximo**, y no los 77 del caso común. El encargo se pega justo debajo
con `top: calc(--alto-cabecera + --alto-reloj)`: con 77 sobrarían 34 px en reposo, pero con la
frase puesta **el encargo quedaría tapado durante los últimos diez minutos de una prueba
cronometrada**, que es el peor momento posible para tapar algo. Un hueco de más no molesta.

`--alto-avance` de la evaluación se volvió a medir también: **116 px, exactamente lo que
decía**. Nada dentro de esa barra cambió.

### La última barra lateral que el barrido no cazó

`.cambio::before` de la prueba —el bloque «CAMBIO EN EL ENCARGO»— llevaba un filete de **4 px**,
no de 3, así que el grep de `width: 3px` pasó por encima cinco tandas seguidas. Se vio en la
captura, no en el código. Fuera, junto con los de `.aviso` (prueba y evaluación), `.pendiente`
(formatos) y `.error` (cuestionario).

**Queda una sola en todo el candidato**, en «Mi perfil».

### Lo que ya estaba bien

La jerarquía del examen no hubo que invertirla: el `h1` de la evaluación **ya es la pregunta**,
y mide 30 px, no los 60 de un titular de portada. Y el opt-out de movimiento de la tanda 0
sigue en pie — medido en la evaluación arrancada: **cero animaciones**.

### Lo que no se hizo, y va a PENDIENTES

**La cabecera no se queda solo con la marca durante el examen.** Los tres enlaces de navegación
siguen ahí. Quitarlos es la misma decisión de producto que quitar el «← Volver» —una salida
menos a mitad de una prueba cronometrada—, y esas se deciden, no se cuelan en una tanda de
diseño.

---

## 10/09 · Mi perfil (tanda 8) · la migración visual termina

Seis archivos, 6205 líneas, y la última pantalla del portal del candidato.

### La galería de portadas ofrecía cuatro corales

Las cinco opciones de fondo se guardan en el backend con códigos `CANTO_*`, bautizados por el
mundo visual anterior. Al retargetear los tokens el 10/09, **cuatro de las cinco se volvieron
tonos del mismo coral** —melocotón, salmón, coral, coral rojizo— y la quinta gris: la galería
dejó de ofrecer colores distintos. Y una era exactamente `#FF7C61`, **el coral que significa
«te toca a ti»**, así que un candidato podía ponerse de fondo el color del turno.

Se repintaron las cinco con neutros que se distinguen por **temperatura y profundidad**, no por
tono: arena, pizarra, humo, carbón y bruma. Los códigos del backend **no se tocaron** —
renombrarlos rompería la portada guardada de cualquier perfil existente—; lo que cambió es el
nombre visible.

⚠️ **Las bases son más oscuras de lo que parece la banda, y es obligatorio.** El disco de las
iniciales sale del mismo token y ahí el blanco tiene que aguantar 4,5:1. Medidos contra blanco:
arena 5,78:1, pizarra 5,85:1, humo 5,33:1, carbón 8,86:1. La banda es un lavado porque mezcla
la base hacia el cielo; el disco va al revés, hacia la tinta.

De paso, diez degradados de cinco líneas idénticos salvo el token quedaron en **dos degradados
y nueve líneas de `--tono-base`**.

⚠️ **Los selectores se escriben uno a uno, no con `[class*='portada-']`.** Ese atajo depende
de que el hash de CSS Modules conserve el nombre local, y en producción no está garantizado.

### Catorce marcas coral en una pantalla

Con seis datos sin confirmar, «Mi perfil» pintaba coral **catorce veces**: el panel del
resumen, el borde de cada fila, una píldora en cada fila, la cuenta de cada sección del índice
y el fantasma de la fila recién confirmada.

Queda **una por fila que reclama**, que es la misma regla que «Mis procesos» aplica a cada
postulación. Lo demás pasa a tinta:

- **El panel del resumen** es un recuento, no una de las cosas que reclaman. Lo dice con
  palabras, que para un recuento es lo que sirve.
- **La píldora de la fila** repetía sobre el mismo elemento lo que ya dice su borde.
- **La cuenta del índice** cuenta; no señala.
- **El fantasma de la recién confirmada** marcaba lo que **acaba de dejar** de reclamar:
  pintarlo del color del turno decía lo contrario de lo que pasaba.

### Un borrado por regex que se llevó seis reglas

Al quitar los diez degradados viejos con una expresión regular, se fueron también `.botonFoto`,
`.menuFoto`, `.accionFoto`, `.pistaFoto`, **`.entradaOculta`** y `.datos`, más dos bloques
`@media`. En pantalla se vio enseguida: **dos `Choose File` del navegador en crudo** encima de
la cabecera, porque `.entradaOculta` era lo que escondía los `input[type=file]`.

Se recuperaron del original y se comprobó con un diff de selectores: **cero perdidos, cero
nuevos**. La lección es la de siempre: una regex que borra bloques de CSS no sabe dónde
terminan, y el typecheck no la ve. Lo vio la captura.

### La única pantalla que no compone `hoja`

`Perfil.module.css` declara su relleno lateral como `--margen-de-la-pagina` porque **la portada
se sale a sangre restándolo**, y el archivo ya documenta el fallo que costó escribirlo en dos
sitios. Traerlo de `pagina.module.css` mete un tercer sitio y lo empeora. Se alinearon los
números —`--e7` arriba, `--e5` a los lados, `--e8` abajo— y se dejó escrito que si `hoja`
cambia, esto cambia con ella.

### Lo que se verificó

**25 pruebas e2e contra el backend local en verde**, antes y después: `11-perfil` (13) y
`22-perfil-con-foto-y-cv` (12), más las 620 unitarias. Y capturas de la pantalla real, que es
lo que encontró el borrado accidental.

⚠️ **Dos specs buscaban el botón «Aqua» por su nombre visible.** Al renombrarlo a «Pizarra»
fallaron, que es exactamente lo que tenían que hacer: son las que sostienen que **el nombre que
se ve y el código que se guarda son cosas distintas**. Se actualizó el nombre y se dejó intacta
la aserción sobre `CANTO_AQUA`.

### Lo que había que arreglar antes de poder verificar

El `<script src="http://localhost:8400/live.js">` que `/impeccable live` inyectó en
`index.html` seguía ahí, y **rompía el e2e**: inyecta un `<aside class="panel">` propio, así
que `locator('aside')` casaba con dos elementos y `11-perfil` fallaba por violación de modo
estricto. Fuera del `index.html` —no es algo que deba acabar en un commit—, y la spec pasó a
13/13.

⚠️ **Y una corrección a lo que dije en tandas anteriores:** el backend local **nunca estuvo
caído**. Su ruta base es `/api/v1/portal`, y yo estaba sondeando `/vacantes` y
`/actuator/health`, que no existen ahí — devuelve 500 en vez de 404 para lo que no conoce. El
backend simulado del 8082 sirvió igual para trabajar aislado, pero no hacía falta.

---

## 10/09 · Cierre · lo que la verificación encontró

### La pieza C no animaba, y la prueba que decía comprobarlo no comprobaba nada

Lo peor de la sesión, y mío por partida doble.

`23-movimiento` contaba `document.getAnimations()` para saber si algo se movía. **`motion` no
usa la API de animaciones del navegador** para estas piezas —las mueve escribiendo estilos
frame a frame—, así que esa lista devolvía cero incluso mientras la franja se dibujaba. Las
pruebas pasaban contando transiciones CSS de otras cosas, y las dos de movimiento reducido
pasaban por comprobar que una lista **siempre vacía** seguía vacía.

Debajo de eso había un fallo real: **la franja no se dibujaba en la primera carga**, que es
justo como casi todo el mundo ve la portada. `PantallaConEntrada` envuelve el `<Outlet>` en un
`AnimatePresence` con `initial={false}` —para que la primera pantalla no entre deslizándose— y
**esa bandera viaja por contexto a todos los `motion` que haya debajo**. Al navegar dentro del
portal sí animaba, así que solo se veía entrando de cero.

Se arregló animando la franja con `animate()` imperativo, que no lee el contexto de presencia.
Es la misma lección que las pantallas cronometradas: **una pieza no puede depender de lo que
decida su contenedor**.

Y la spec se reescribió entera para medir el `transform` del elemento. Siete pruebas, tres
pasadas seguidas en verde. ⚠️ **Tampoco vale muestrear desde fuera con `expect.poll`**: la
franja dura medio segundo y, si terminó antes de la primera lectura, ya no vuelve. El
observador se instala antes de cargar.

### El backend local nunca estuvo caído

Corrección a lo que dije en tres tandas. Su ruta base es `/api/v1/portal`; yo sondeaba
`/vacantes` y `/actuator/health`, que ahí no existen, y devuelve **500 en vez de 404** para lo
que no conoce. El backend simulado del 8082 sirvió para trabajar aislado, pero no hacía falta.

### `E2E_PG` casi nunca es su valor por defecto

La limpieza de cuentas de prueba busca un contenedor `renaser-verifica` —el Postgres desechable
del 5434— que en una máquina de desarrollo normal no existe. Las pruebas pasan igual y avisan
en una línea que se pierde, así que **cada pasada dejaba cuentas en la base**: había 40
acumuladas. El contenedor real se llama `renaser-postgres`. Documentado en
`playwright.config.ts`.

Con él puesto, el barrido dejó 40 en 22. Las 22 restantes tienen postulación, y
`transicion_estado` es inmutable por trigger: el propio limpiador ya avisa de que apagarlo es
decisión de quien administra la base, no de una prueba.

### El maquetado y el sistema, puestos al día

`maquetado/LEEME.md` seguía dando el índigo `#4338CA` por indiscutible. **No se borró**: lo que
dice sobre qué información y qué palabras van en cada pantalla sigue siendo cierto y es su
razón de ser. Se le puso un aviso arriba, se tachó el índigo con su fecha, y se anotó que «Mi
perfil» no está ahí.

`mundo.css` —el archivo que más se lee del sistema— **narraba «El canto» entero** en su
cabecera: la nube difractando luz, el color posicional, el violeta pleno, Mulish de peso 200 y
los controles en píldora. Reescrito. Con él se fueron cinco tokens muertos:
`--canto-vertical` y los cuatro tonos del espectro. `--canto` sobrevive por **un solo
consumidor**, `src/panel/Armazon.module.css`, que no se ha migrado.

El detector, sobre `src/`: **dos hallazgos en el candidato y los dos deliberados** —el
`#ff5d6e` de `--canto` y el degradado de la pieza firma de la portada—. Los otros ocho están
todos en `src/panel/` y son el mundo anterior intacto: la pizarra `rgb(35 43 54)` y el violeta
`rgb(86 56 214)`.

### Estado final

620 unitarias, typecheck limpio y **43 pruebas e2e del candidato en verde** contra el backend
de casa: `02-regresion-portal`, `07-movil`, `11-perfil`, `12-postular`,
`22-perfil-con-foto-y-cv` y `23-movimiento`.

`16-cuestionario-tecnico` no corre: su `dev-login` del panel devuelve 400 y hace falta
`app.seguridad.dev-login-activo=true` en el backend.

**Las cuatro piezas de movimiento se quedan.** Estaban puestas «para elegir» desde antes de la
migración y la decisión se cerró el 10/09/2026: las cuatro. Ninguna es decoración — C dice
hasta dónde llegaste, B sostiene la continuidad al abrir una ficha, D es la respuesta al
puntero y A liga las pantallas.

### El `dev-login` del panel nunca estuvo apagado

Corrección a lo que dije al cerrar la verificación. `16-cuestionario-tecnico` fallaba con **400**
y lo diagnostiqué como «falta `app.seguridad.dev-login-activo=true`» **sin leer el cuerpo de la
respuesta**. La propiedad ya estaba en `true` —`application-local.yaml`, y `local` es el perfil
por defecto—. Lo que decía el 400 era otra cosa: *«Ese id de RENASER OS no está registrado en
el sistema»*.

El `dev-login` exige que el id **ya exista** en la base. `herramientas/e2e/ayuda.ts` lo tenía
escrito a mano como `dev-equipo`, y los usuarios de equipo de esta base son
`5b71813c-…` y `andy-dev`. Ahora es `E2E_EQUIPO`, con el mismo argumento que ya tenían `E2E_API`
y `E2E_PG`: cada base local trae lo que trae.

Con él puesto, la spec corre: **7 pasan y 6 se saltan**, y el salto es deliberado — la prueba 7
necesita que la IA escriba el cuestionario y se salta con su motivo cuando el trabajo no se
encola; las 8 a 12 dependen de ella. Eso es del entorno, no del portal.

⚠️ **Un código de estado no es un diagnóstico.** Es la segunda vez en la misma sesión que leo
un número y no el mensaje: antes fueron los 500 del backend, que eran rutas inexistentes.

---

## 11/09 · La documentación auditada y una crítica de diseño con hallazgos

### Se comprobó la documentación contra el código, no leyéndola

Un barrido mecánico sobre los 19 documentos: cada ruta citada, cada enlace, cada token y cada
color presentado como vigente, contrastado con lo que hay en `src/`. Salieron 25 avisos, y la
mayoría eran correctos —una bitácora **debe** nombrar lo que ya se borró—. Tres eran mentiras
de verdad:

**El `README.md` de la raíz estaba dos mundos atrás.** Decía que el mundo visual se llama «El
seguimiento» —el anterior a «El canto», que es el anterior a «El escaparate»— y daba el índigo
`#4338CA` como el acento actual. Es lo primero que lee cualquiera. Reescrito, con los tres
archivos del sistema y un aviso de que los dos nombres viejos siguen apareciendo en documentos
antiguos.

**`docs/02-QUE-VE-EL-CANDIDATO.md` describía como pendiente algo hecho hace semanas**: «falta
limpiar `index.html`», «`variables.css` conserva el bloque oscuro», «en el rediseño desaparecen
`ProveedorTema` y el bloque `data-theme="dark"`». Todo eso ya pasó. Tachado, con una nota de
que lo vigente de ese documento es el contrato de datos y no el color.

**`docs/03-ESTADO-DEL-REDISENO.md`** decía «lo que sigue vigente es el porqué de aquel día:
fondo blanco puro y acento índigo», que mezclaba el razonamiento —que sí sigue— con los colores
—que no—.

### El `audit` de impeccable: cero violaciones, una afirmación falsa

Barrido medido sobre las 17 pantallas a 1280 y a 375: cero desbordamientos horizontales, cero
controles sin nombre accesible, cero saltos de jerarquía de encabezado, un solo `h1` por
pantalla, los cuatro *landmarks* en todas.

Los cuatro avisos de contraste a 4,27:1 son **botones deshabilitados**, que WCAG 1.4.3 exime
expresamente. Pero al medirlo salió que el comentario de `--tinta3` en `mundo.css` afirmaba ser
«el gris más claro que aguanta 4,5:1 sobre **TODOS** los fondos claros del sistema», y eso es
falso: pasa en seis de siete y falla justo en `--nube-honda`. El valor está bien; la afirmación
no. Corregida, con los siete números y con la única salida si algún día hace falta texto activo
sobre ese fondo (`#5a5a5a`, más oscuro que `--tinta2`).

### El `critique`: dos evaluaciones aisladas, y convergieron

Se corrió con sus dos agentes separados, como exige el comando. La revisión de diseño y la
evidencia medida llegaron por su cuenta al mismo hallazgo principal:

**El coral estaba gastado en «Híbrido · Lima».** Las etiquetas de modalidad de la portada
llevaban `--activo-bruma` —el token que el sistema define como «lo que reclama tu turno»— tres
veces en la primera pantalla que ve cualquiera, para decir una categoría. Todo el mundo visual
apuesta a que un solo color signifique una sola cosa, y la portada lo gastaba antes de que
llegara a significarla. Ahora van en nube hundida con tinta segunda: 6,04:1. **Medido después:
cero brumas corales en la portada.**

### Contratado y descartado eran la misma pantalla

El segundo hallazgo, y el más caro para el candidato. `CONTRATADO`, `NO_CONTINUA` y `CERRADA`
compartían clase, fondo y **el mismo glifo punteado**, que en el vocabulario del propio
recorrido significa «aquí se detuvo»: al contratado se le pintaba la forma de detenido. Son los
dos estados más distintos que el sistema puede producir y son el final de semanas de trabajo
real.

`--bien` estaba declarado y **no lo usaba nadie**. Ahora el cierre en positivo va en verde sobre
su bruma con el glifo macizo; el negativo se queda neutro y punteado. Se distinguen en color y
en forma, que es lo que pide la regla del gris.

Y el descarte **llevaba a ninguna parte**: daba la noticia y terminaba. Ahora ofrece «Ver las
vacantes abiertas» dentro del propio cierre, no en el pie.

### Dos fallos reales más

**`class="_tramo_xxx undefined"` llegaba al DOM.** `estilos['cumplida']` devuelve `undefined`
—y es correcto que no exista esa clase, porque la franja maciza es el estado por defecto—, pero
la plantilla lo escribía literal.

**El botón muerto de la decisión no existía para el teclado.** Era un `<span aria-disabled>`
fuera del `<fieldset disabled>`: quien tabula pasaba del correo al pie sin que nada explicara
por qué 630 px de formulario no hacen nada. Ahora es un `<button disabled>` atado con
`aria-describedby` al aviso ámbar, que además pasa a `role="status"`.

### Una mentira mía en DESIGN.md

Decía que la franja del recorrido se llena «cuando el estado cambió desde la última visita, no
en cada carga». **Eso nunca existió en el código**: no hay nada que recuerde la visita anterior.
Se corrigió el texto y no el código, porque comparar exige guardar el estado por postulación en
el navegador y eso es una decisión de producto. Anotado en PENDIENTES.

### Lo que se dejó decidir, no se decidió

**El recorrido escondido tras un `<details>` en la tarjeta de espera.** La revisión lo puso como
problema número uno —trece de dieciocho estados son esperas, y es justo ahí donde el mapa se
pide con un clic extra—, pero el código lleva escrito su contraargumento: con siete esperas,
siete recorridos completos llenan la pantalla de algo que nadie pidió ver. Las dos razones son
buenas y la decisión es de producto.

### La cabecera, en dos vueltas de `/impeccable live`

**Primera vuelta: una vaina ovalada flotante.** Se pidió «que sea flotante ovalada» y se
probaron tres formas —una vaina ancha, dos islas separadas, y una cápsula centrada que se ciñe
a su contenido—. Ganó la primera y se escribió entera: radio 999 px, `--sombra-nube`, 14 px de
aire por arriba puestos de **relleno y no de margen**, que es lo que hacía que guardara la misma
distancia al borde en reposo y pegado. `--alto-cabecera` pasó a 76 px, medido.

**Segunda vuelta, una hora después: vuelve la barra.** Se pidió devolverla a como estaba, más
cuatro cosas concretas. Así quedó, y así se queda:

- **Vuelve la barra a sangre**, nube maciza con filete de regla, pegajosa con `top: 0`.
  `--alto-cabecera` vuelve a 61 px, medido otra vez.
- **Un destino nuevo, «Inicio».** Y con él un problema: `rutas.vacantes()` es `/`, así que
  «Inicio» y «Vacantes» irían al mismo sitio. Se resolvió dejando «Inicio» en la portada y
  apuntando «Vacantes» al ancla `#vacantes-abiertas` que ya existe ahí, **de `Link` y no de
  `NavLink`**, porque dos `NavLink` con la misma ruta se encienden a la vez.
- **Los enlaces pierden la pastilla**: texto haciendo de botón, con los 44 px táctiles en un
  `min-height` invisible.
- **El activo se dice con el color del texto**, `--activo-regla`, más el peso 700.
- **«Ingresar» pasa a botón de relleno coral con el texto en `--activo`.**

⚠️ **Dos contrastes medidos, y uno no pasa.** El botón está bien: `--activo` sobre coral da
**7,83:1**. El enlace activo no: coral como **texto** sobre nube da **2,53:1** donde WCAG 1.4.3
pide 4,5:1. Se ofreció `#bf4526` —el mismo tono con la luz bajada, 5,13:1— en una de las tres
variantes y se eligió el coral de marca a sabiendas. El peso 700 cubre 1.4.1; el contraste del
texto no se cumple. El límite del botón contra la nube marca también 2,53:1 frente a los 3:1 de
1.4.11, y se arregla con 1 px de borde en `#bf4526` si algún día se quiere.

⚠️ **Cuatro destinos y un botón no caben en un teléfono.** Medido: a 362 px la barra pedía
justo 362, y a 320 px le faltaban 42. Se apretó el relleno y la tipografía por debajo de 620 px,
y **por debajo de 400 px se cae «Vacantes»**, que es el único de los cuatro que no es una
pantalla propia. Sin eso «Mis procesos» se partía en dos líneas y la barra pasaba de 61 a 85 px
— justo el número que `--alto-cabecera` promete fijo. De ahí el `white-space: nowrap`.

Comprobado a 320, 414 y 1280: 61 px de alto en las tres, sin desbordamiento horizontal, los
enlaces a 44 px, y el activo siguiendo la ruta (en `/procesos` se enciende «Mis procesos»).
620 pruebas en verde y typecheck limpio; los dos e2e que tocan la cabecera piden «Mis procesos»
y «Mi cuenta», que no cambiaron.

### Tercera vuelta: la barra se mueve

Se pidieron animaciones al seleccionar del menú, y sobre todo para «Ingresar», «de paso
modifica su fondo que es estático a algo más llamativo». Se probaron tres vocabularios
distintos —un barrido que pinta el coral sobre la palabra con `background-clip: text`; un
acercamiento con escala y bruma; y una cascada con un destello que cruza el botón—. Ganó la
tercera.

Lo que quedó: los cuatro destinos entran en cascada con 60 ms de desfase, **una vez por carga
de página**; el filete de cada enlace se abre desde el centro hacia fuera en 300 ms, gris en
hover y coral en el activo; y «Ingresar» cambia el coral plano por la rampa del mundo a 105°
con un reflejo blanco que lo cruza cada 4,5 s.

**El negro sobre la rampa entera se lee:** 13,02:1 en la parada más clara, 6,64:1 en la más
oscura. Ese era el riesgo de cambiar un color plano por un degradado y no lo es.

⚠️ **`--salida` no servía para el destello, y solo se vio midiendo el recorrido fotograma a
fotograma.** Esa curva es para lo que llega y se posa: con ella el reflejo hacía el 90 % del
camino en los primeros 400 ms de un tramo de 1,17 s, o sea daba un salto en vez de cruzar
—medido: a 1200 ms estaba en −121 %, a 1600 ms ya en +98 %—. Con `ease-in-out` el recorrido
queda −121, −107, −62, +5, +71, +121: un cruce de verdad. **El token del mundo no es la
respuesta por defecto; es la respuesta para las llegadas.**

Una trampa que costó entenderla: al medir con el panel del navegador oculto, los cuatro
enlaces daban opacidad 0 y las animaciones `playState: running` con `currentTime: 0`. No era un
fallo — **una pestaña que no se pinta tiene la línea de tiempo suspendida**, y con
`animation-fill-mode: both` el elemento se queda en su fotograma inicial hasta que alguien la
mira. Se comprobó forzando `finish()`: los cuatro terminan en opacidad 1 y sin desplazamiento.

Con `prefers-reduced-motion` se van la cascada, el destello y los desplazamientos, y se quedan
el color y el filete del activo. 620 pruebas en verde, typecheck limpio.

### Cuarta vuelta: el fondo se aclara y la cabecera aprende a desaparecer

Llegó una referencia —`next-elite-boilerplate.vercel.app`— con el encargo de copiarle el fondo
cambiando el morado por el coral, aclarar el gris, y replicar su cabecera sin los botones de
idioma ni de tema. Se midió la referencia antes de tocar nada: base blanca, dos discos de
480 px a `blur(133px)` en `rgba(118,99,255,0.28)`, y una cabecera pegajosa a `top: 8px` con
márgenes laterales, radio 8 px y un velo `opacity: 0` que aparece al bajar.

Lo que quedó aquí: `--cielo` de `#f5f5f5` a **`#fafafa`**, los dos resplandores en
`--activo-regla` al 28 %, y la cabecera insertada que en reposo no existe.

**El cambio de cielo era el punto de riesgo y no lo fue.** La separación página/superficie baja
de 1,090:1 a 1,044:1, pero en este mundo **una superficie se dibuja con su contorno de 1 px**,
no con su fondo: `.bloque` lleva `border: 1px solid var(--regla)` y todo hereda de ahí.
`--nube-hundida` ni se tocó, porque lo hundido vive dentro de una superficie de nube y su
pareja de contraste es `#ffffff`, no el cielo. Los tres grises de texto además ganan: tinta
12,10 (era 11,59), tinta2 6,51 (6,23), tinta3 5,11 (4,89).

⚠️ **Los resplandores no se veían, y el motivo tardó en aparecer.** Estaban en `z-index: -1`,
que es lo natural para un fondo. Pero `mundo.css` pinta el cielo en `html` **y** en `body`: con
las dos declaraciones, la de `html` se convierte en el lienzo y la de `body` pasa a ser el
fondo de una caja de bloque normal, que se pinta **después** de los descendientes de z
negativo. Se encontró subiéndolos al 90 % de opacidad y quitándoles el desenfoque: seguían sin
verse, lo que descartaba que fuera cuestión de sutileza. Ahora van en `z-index: 0` y son
`.principal` y `.pie` los que suben a 1.

⚠️ **Encoger un resplandor lo hace más fuerte.** En móvil se bajaron a 280 px con `blur(90px)`
por coste de pintado, y el mismo 28 % concentrado en 280 px sobre un ancho de 375 teñía la
pantalla entera de rosa. Se vio a 375 px.

### Y el resplandor pasa a cubrir la página entera

Cubría los primeros 620 px y abajo la página se quedaba en gris plano. Repetir discos hasta el
pie no vale: una página mide 900 px o 3200 según el contenido, así que un número fijo de piezas
sale espeso en una corta y ralo en una larga. Ahora son **dos degradados radiales repetidos en
vertical** con baldosa de 1100 px, uno a cada lado, sobre un único elemento vacío: cubren
cualquier alto y se pintan directos, sin la textura intermedia que un `blur(133px)` obliga a
crear por pieza.

⚠️ **Y eso le puso un techo de opacidad que antes no tenía.** Mientras el color vivía solo
arriba, el único texto encima era la bajada de la portada. Al bajarlo por toda la página se le
pusieron debajo diez sitios más —subtítulos de sección, respuestas del desplegable, el pie—, y
casi todos van en `--tinta3`, que es el gris más claro que el sistema permite para texto y por
tanto el primero en caer. Medido:

| opacidad | `--tinta3` encima | |
|---|---|---|
| 0,14 | **4,51:1** | ✓ |
| 0,16 | 4,45:1 | ✗ |
| 0,20 | 4,29:1 | ✗ |
| 0,28 (lo que usa la referencia) | 3,99:1 | ✗ |

El tope exacto es 0,146. Se tomó 0,14 y se ensancharon los degradados para compensar: presencia
sin concentrar color. **La referencia puede permitirse el 28 % porque su fondo no lleva texto de
apoyo encima.** Comprobado después sobre el peor punto posible del fondo, `#FBE8E5`: `--tinta3`
4,51 · `--tinta2` 5,75 · `--tinta` 10,69 · `--activo` 16,76. El único que no pasa es el coral
del destino activo, 2,14:1, que ya era una decisión tomada a sabiendas.

⚠️ **Y el mosaico dejaba una raya naranja, que es como se descubrió la regla que faltaba.** Los
degradados tenían el centro al 8 % y un radio del 52 %, así que el de arriba **todavía tenía
color al llegar al borde de su baldosa**: se cortaba en seco ahí, y la repetición convertía ese
corte en una línea horizontal visible cruzando la página. La regla es que cada degradado se
apague a cero dentro de su baldosa —**centro = radio, y los dos radios juntos = la baldosa**—:
radio vertical 25 %, centros al 25 % y al 75 %, de modo que uno ocupa de 0 a 550 y el otro de
550 a 1100, tocando los bordes justo en cero. En horizontal sí se salen, y eso es lo buscado:
el centro va fuera (108 % y −8 %) para que el color entre por los lados en vez de dibujar un
círculo dentro de la página.

⚠️ **La bajada de la portada subió de `--tinta3` a `--tinta2`.** Buscando qué texto cae
directamente sobre un resplandor sin superficie debajo, salió exactamente uno: ese. `--tinta3`
da 3,99:1 sobre el resplandor al 28 % y no llega a 4,5; `--tinta2` da 5,08:1.

⚠️ **El velo de la cabecera se probó traslúcido y no aguanta.** Nube al 85 % con
`backdrop-filter: blur(12px)` dejaba leer entero el botón negro de la portada por debajo. Es
nube maciza, como la referencia — y el desenfoque detrás de un relleno opaco no pinta nada, que
es justo por lo que este proyecto quitó el vidrio empañado el 10/09/2026.

Y otra vez la trampa del panel oculto: **un documento que no se pinta no despacha `scroll` ni
avanza las transiciones**. El oyente parecía muerto y el velo parecía no responder. Se
comprobó lanzando `new Event('scroll')` a mano —la clase `posada` entra y sale bien— y
anulando la transición para leer el valor al que apunta la regla, no el fotograma congelado.

`--alto-cabecera`: **68 px**, medidos. 620 pruebas en verde, typecheck limpio.

### Y al final el fondo se quedó en blanco

Los resplandores se miraron con la página entera delante y no gustaron: se retiraron, y el
cielo pasó de `#fafafa` a **blanco puro**. Con ellos se fueron el `position: relative` y el
`overflow-x: clip` del armazón y los `z-index` de `.principal` y `.pie`, que solo existían para
sostenerlos; y la bajada de la portada vuelve a `--tinta3`, que sobre blanco da 5,33:1.

⚠️ **Esto cambia la regla 4 del mundo, escrita en la cabecera de `mundo.css`.** Decía que la
profundidad es tono y que una superficie se separa del fondo «porque está un punto más clara».
Con página y superficie en el mismo blanco eso dejó de ser cierto: **lo que dibuja una
superficie es su contorno de 1 px**. Se comprobó buscando en el DOM superficies blancas sin
contorno ni sombra: sale una, `.escaparateDentro`, y vive dentro del escaparate, que sí tiene
sombra. El borde de 12 px translúcido del escaparate queda invisible y solo aporta aire; se
deja porque el aire es correcto.

Lo que las dos vueltas del fondo dejaron aprendido, y está escrito en DESIGN.md para no volver
a descubrirlo:

- Un degradado que **todavía tiene color al llegar al borde de su baldosa** se corta en seco
  ahí, y la repetición convierte ese corte en una raya horizontal. Regla: centro = radio, y los
  dos radios juntos = la baldosa.
- **Un tinte de fondo le pone techo al gris más claro del sistema.** Con el coral al 28 %,
  `--tinta3` caía a 3,99:1; el máximo que lo dejaba en 4,5:1 era 0,146.
- **`z-index: -1` no pone nada detrás** cuando `html` y `body` declaran los dos el fondo: la de
  `html` es el lienzo y la de `body` pasa a ser el fondo de una caja de bloque normal, que se
  pinta después de los descendientes de z negativo.

620 pruebas en verde, typecheck limpio.

### El cuadrado del titular pasa a ser el maletín

Primero intenté redibujar en SVG la imagen de referencia, y estuvo mal por dos motivos: quedó
feo, y sobre todo **presenté como decisión de diseño lo que era una limitación mía**. Las
imágenes que llegan adjuntas al chat no tocan el disco, así que no tenía el archivo. Lo correcto
era decirlo antes de ponerme a dibujar. Se revirtió, se pidió el PNG y se montó el de verdad.

El original venía a 1312×1199 y **692 KB** para una pieza que se ve a 45 px. Se preparó así:

- **Recortado por alfa.** La loseta opaca ocupaba de (359,316) a (952,894) dentro de un lienzo
  casi el doble de grande: casi todo era halo transparente. Se recortó dejando un 18 % de la
  loseta por lado, que es halo suficiente.
- **256×256**, que cubre pantallas de hasta 4× para un tamaño de 45 px.
- **Sin paleta.** El primer intento lo pasó a 200 colores y bajaba a 14 KB, pero el degradado
  salía con bandas visibles. En RGBA con `optimize` se queda en unas decenas de KB y limpio.

La imagen se actualizó una vez más el mismo día —la flecha ganó una estela de puntos y unas
líneas de destello—, y **la preparación no hubo que tocarla**: el recorte se calcula del canal
alfa, así que se adapta solo. La versión que está montada pesa **60 KB**.

⚠️ **La loseta ocupa el 73 % del lado de la imagen**, así que el tamaño declarado no es el que
se ve: hacen falta 1,32em de imagen para una loseta de 45 px, que es lo que medía el cuadrado
anterior.

⚠️ **Alinearla costó dos intentos y una medición.** Con `vertical-align: -0.34em` colgaba 20 px
por debajo de la línea base y la fuente solo desciende 13: el titular crecía de 106 a 111 px.
Los márgenes negativos no lo arreglaban, porque el problema no era la caja sino el descuelgue.
Con `middle` a secas se iba a 115. **Las dos cosas juntas —`middle` y margen vertical
negativo— dan 106, exactamente lo mismo que sin imagen.**

Y con esto se cae una afirmación que llevaba escrita desde el 10/09: `.pieza` decía que «no es
un icono ni significa nada». Ahora es un maletín con una flecha ascendente, la única figura
literal del portal.

620 pruebas en verde, typecheck limpio.

### El resplandor del escaparate pasa a tener dos colores

Con una referencia delante —una sección cuyo pie se ilumina con dos luces distintas— se pidió
lo mismo aquí: donde había un foco coral centrado, ahora hay una luz cálida `#FF7C61` a la
izquierda y una fría `#FF47B8` a la derecha, más un tercer foco bajo y ancho que une las dos
por el suelo. Sin ese tercero se veía la juntura entre una luz y otra.

⚠️ **El rosa es el único tono del portal fuera de la familia coral**, y queda anotado como tal
en DESIGN.md: existe solo ahí, como luz, y no es un token.

⚠️ **Y por poco se carga una regla que llevaba escrita desde el principio: «el resplandor nunca
va debajo de prosa».** La primera versión daba el alto en porcentaje, y en un teléfono —donde
las cinco etapas se apilan en dos columnas y la tarjeta mide el triple— la luz se estiraba
hasta quedar detrás de «Etapa 5». Ahí el texto no se lee: sobre el núcleo, `--tinta3` da
**3,0:1** y `--tinta2` **3,8:1**.

Se arregló con geometría, no bajando el color:

- **El alto en píxeles**, no en porcentaje, para que la franja sea la misma mida lo que mida la
  tarjeta.
- **Los focos centrados en el borde inferior o por debajo**, con radios cortos: lo intenso se
  queda pegado al suelo y lo que sube hasta el texto es solo la cola del degradado.
- **Más relleno inferior en la tarjeta**, pero **una talla más que el superior y solo una**:
  `--e8` contra `--e7`. El primer intento le puso 150 px y la caja se leía descompensada, con
  el contenido arrinconado arriba y un páramo debajo. Ese escalón de más es el sitio de la luz.
- **Los dos focos nacen cerca del centro**, al 36 % y al 64 %, y se abren hacia fuera. Puestos
  al 24 % y al 76 % se leían como dos luces en las esquinas en vez de una que se descompone.
- **Radio vertical corto (37 %) y centro justo EN el borde**, no muy por debajo: así entra en
  la tarjeta la mitad de cada foco en vez de una esquirla, y la luz se ve sin tener que subirla
  al texto.

La cuenta, para no volver a tantear: **el degradado se apaga al 74 % de su radio, así que lo
visible empieza en `centro − 0,74 × radio`**. Medido, ese punto cae 0 px por debajo del último
párrafo en escritorio y 1 px en teléfono.

620 pruebas en verde, typecheck limpio.

### La cabecera se centra, el botón copia la referencia y la luz gana cúpula

Tres cosas de una referencia que trajo el cliente.

**Los destinos al centro.** La barra pasa a rejilla de tres columnas `1fr auto 1fr`, con la
marca a la izquierda, los destinos en medio y la acción a la derecha —que sale del `<nav>`,
porque no es navegación—. No vale `space-between`: ahí el centro se mueve cada vez que cambia
el ancho de la marca o el texto de la acción, y «Ingresar» y «Mi cuenta» no miden lo mismo.
Medido, la desviación respecto al eje de la barra es de **0 px**. En teléfono vuelve a
`flex`: con la marca a un lado y el botón al otro no queda sitio para una columna central.

**Los enlaces en tinta plena**, no en `--tinta2`. Son cuatro destinos y nada más: no hay
jerarquía que establecer entre ellos, y apagarlos solo los hacía más difíciles de leer.

**El botón, igual que la referencia**: rampa magenta a rojo `#E0218A → #FF3B5C`, texto blanco,
radio `--radio-menor`, sombra con desplazamiento más halo del mismo tono.

⚠️ **Y ese blanco sobre esa rampa da entre 4,42:1 y 3,48:1**, por debajo de los 4,5 que pide
WCAG 1.4.3 a 14 px. Se midió antes de montarlo y se ofreció la alternativa: `#D81B7E → #C4304B`
es el mismo magenta-a-rojo un paso más oscuro y da 4,80 y 5,42. Se eligió el color de la
referencia a sabiendas. Si hay que cumplirlo algún día, son dos valores.

**La cúpula del escaparate.** El resplandor seguía sin leerse como que nace del centro. La
solución fue darle al foco central **más altura que a las laterales**: radio vertical 70 %
contra 34 %, lo que produce un perfil que sube 51 px por el medio y se aplana hacia los lados.
Con las tres iguales salía una franja; con 20 px de diferencia no se notaba.

⚠️ **Eso mete la cúpula por detrás de la última línea de texto**, así que su segunda parada
está topada en **0,18**: ahí `--tinta3` da 4,54:1, y a 0,20 ya cae a 4,45. La parada va al 40 %
del radio y el texto queda al 45 %, de modo que lo que le toca encima es siempre igual o más
flojo que ese tope.

620 pruebas en verde, typecheck limpio. Los dos e2e que tocan la cabecera piden «Mis procesos»
y «Mi cuenta» por su nombre accesible, que no cambió al moverlos de sitio en el árbol.

### Los destinos de la cabecera ganan peso, y aparecen tres media queries peleando

Los enlaces se perdían: eran 14 px con el peso normal de la fuente, y son lo único que hay en
medio de una barra muy ancha y blanca, sin contorno ni relleno que los sostenga. Pasan a
**16 px y peso 500**. En teléfono bajan a 14 px, pero **el 500 se queda**: era el peso y no el
tamaño lo que faltaba. Figtree es variable de 400 a 700, así que el 500 no cuesta una descarga.

⚠️ **Y al subirlos se rompió el ancho a 320 px**, que es lo que destapó el problema de verdad:
había **tres media queries distintas tocando la cabecera** —620, 560 y 640—, restos de las tres
formas que la barra tuvo hoy. La de 640 es la última del archivo y pisaba a las otras dos, así
que **el relleno que se escribía en la de 620 nunca llegaba a aplicarse**: se pedía `--e3` y se
computaba `--e4`. Se encontró midiendo el `padding-inline` real y viendo que no coincidía con
ninguno de los dos valores escritos.

Ahora la cabecera de teléfono vive en **una sola media query** a 620 px, con un escalón más a
360 px para los teléfonos estrechos; el bloque de 640 se queda solo con el pie, que es lo único
suyo que había ahí. Medido a 320, 360, 375, 414, 640 y 1280: el botón no se sale de su
contenedor en ninguno y la barra se queda en 68 px.

620 pruebas en verde, typecheck limpio.

### Los destinos a 18 px, sin filete, y fuera la sección de garantías

Tres retoques del cliente sobre la cabecera y la portada.

**18 px en los destinos**, un punto más que los 16 de hace un rato.

**El filete del activo se quitó y volvió el mismo día.** Se retiró a petición —el estado se
decía solo con color y peso— y al verlo así se echó de menos: sin él, pasar por encima no
respondía nada y el activo no tenía dónde apoyarse. Vuelve el que se abre desde el centro en
300 ms, coral en el activo y gris en el hover. Queda anotado en el CSS que ya se probó fuera,
para que no se vuelva a quitar por tercera vez.

**Fuera la sección «Pensado para que no tengas que preguntar»**, entera: título, párrafo y las
tres tarjetas de garantías. Con ella se van la constante `GARANTIAS`, las reglas `.garantias` y
`.garantia`, y sus dos entradas en las media queries. La portada pasa ahora de la cinta de
cifras directamente a «Vacantes abiertas».

⚠️ **Lo que contaban esas tarjetas sigue siendo cierto** —la hora la manda el servidor, nada se
da por guardado, un solo descarte automático— y sigue escrito en `docs/REGLAS-DEL-CODIGO.md`.
Lo que ya no está es la promesa en la portada. Queda anotado en la cabecera de `Vacantes.tsx`
para que nadie lo lea como un olvido.

620 pruebas en verde, typecheck limpio.

## 15/09 · La luz del escaparate llena la tarjeta

Con una referencia delante —una tarjeta cuya mitad inferior es un resplandor amplio y difuso—
se pidió lo mismo aquí. La luz del escaparate era una franja estrecha pegada al pie; ahora sube
hasta media tarjeta y entra por los dos lados.

**La solución fue partirla en dos alturas.** Un **velo** enorme y flojo —techo 0,16— que hace el
trabajo de llenar, y debajo el **núcleo y las dos luces de color** —0,60 y 0,48— pegados al
suelo, por debajo del último párrafo. Con una sola capa no se puede: o llega arriba y se come el
texto, o respeta el texto y se queda en una franja. Se probaron las dos.

⚠️ **Y aquí estuvo el error propio: medí las capas de una en una.** Cada una respetaba su techo,
así que di la legibilidad por buena. Pero **se suman**: el fondo compuesto bajo el último
párrafo salía `#FFCFDA`, donde `--tinta3` cae a **3,85:1**, por debajo de los 4,5 de WCAG 1.4.3.
Se vio al calcular la mezcla de las cuatro, no mirando la pantalla.

El arreglo no fue bajar la luz sino subir el texto: `.numeroEtapa` y `.queEsEtapa` pasan a
`--tinta2`. Es la regla que DESIGN.md ya tenía escrita para los bloques ámbar —sobre un fondo
con tinte, el gris más claro del sistema no vale— aplicada donde ahora hace falta.
`.pieEscaparate` se queda en `--tinta3`: vive por encima de donde empieza el velo, y su fondo
compuesto sale blanco puro.

Medido el compuesto bajo cada texto de la tarjeta: **el peor es 4,98:1 en escritorio y 4,61:1 en
teléfono**. 620 pruebas en verde, typecheck limpio.

### El fondo vuelve a tener tono, y esta vez cálido

Con `originx.demos.tailgrids.com` delante, el cliente pidió «el mismo color de fondo, tipo
anaranjado pastel, cosa que el header también se distingue porque es blanco puro».

⚠️ **Se midió esa página antes de copiarla, y su fondo NO es naranja: es `#F5F5F5`, gris
neutro.** Lo que se ve cálido ahí son sus resplandores corales sobre el gris, no el fondo. Se
dijo y se hizo lo que describía, no lo que medía: `--cielo` pasa a **`#FBF1E9`**, un pastel
anaranjado de verdad. Queda anotado en `mundo.css` que si algún día se quiere el gris literal,
es cambiar ese valor y nada más.

Lo que el cambio recupera es **la regla 4 del mundo**, que había caído el 11/09 cuando la página
se volvió blanca: una superficie se separa del fondo **por tono**, no solo por su contorno de
1 px. La separación página/superficie queda en **1,113:1** — un punto mejor que la del gris con
el que empezó todo. Y la cabecera, que es nube blanca, se distingue sola, que era justo lo que
se pedía.

⚠️ **Y aparece un sitio donde el gris frío se notaba: la cinta de cifras.** Es el único elemento
del portal que apoya algo hundido directamente en el cielo —todo lo demás que usa
`--nube-hundida` vive dentro de una superficie blanca, donde el gris frío es lo correcto—. Sobre
el cielo cálido se leía como una mancha sucia cruzando la página. Lleva ahora un hundido cálido
propio, `#F7EBE1`: 1,052:1 contra el cielo, donde el gris daba 1,012, o sea casi nada. No es un
token: existe solo ahí.

Los tres grises de texto sobre el cielo nuevo: tinta 11,35 · tinta2 6,10 · tinta3 4,79. Los tres
pasan. 620 pruebas en verde, typecheck limpio.

### El resplandor sale de la tarjeta y se pone detrás

Pedido del cliente: que el neón esté detrás de la tarjeta y ya no dentro. Es mejor decisión de
la que parece, porque resuelve de raíz lo que llevaba dos sesiones dando guerra: la tarjeta es
lo único que hay que leer en la portada, y meterle luz por debajo del texto obligaba a pelear
cada tono. Con la luz fuera, el interior vuelve a ser blanco limpio y **`.numeroEtapa` y
`.queEsEtapa` vuelven a `--tinta3`**, que es donde el diseño las quería.

Lo que hubo que mover: la tarjeta pierde su fondo propio —lo pinta `.escaparateDentro`, que
gana su propio radio— y pierde el `overflow: hidden`, que estaba ahí para recortar la luz de
dentro y ahora recortaría la de fuera.

⚠️ **Y volví a tropezar con `z-index: -1`.** Lo puse por reflejo y la luz no aparecía. Es la
misma trampa de la sesión del 11/09: `mundo.css` pinta el cielo en `html` **y** en `body`, y el
fondo de `body` se pinta DESPUÉS de los descendientes de z negativo. Lo confirmé poniendo la luz
en rojo plano y sin desenfoque — seguía sin verse, lo que descartaba que fuera cuestión de
sutileza. **La segunda vez que caigo en lo mismo**; queda escrito en los dos sitios.

La solución no necesita z: el `::before` va antes que `.escaparateDentro` en el árbol, los dos
están posicionados, y sin `z-index` gana el último. La luz cae detrás del blanco sin salirse del
apilamiento.

620 pruebas en verde, typecheck limpio. Comprobado a 390 y 800 px, sin desbordamiento.

⚠️ **Y salió demasiado grande a la primera.** El cliente lo dijo antes que yo: «está muy grande,
siempre usa el navegador para que veas en vivo, no solo código». Tenía razón en el diagnóstico
—lo había estado juzgando en capturas reducidas, donde un baño de color y un halo se parecen—.
Quedó ceñido al pie: arranca al 58 % de la altura de la tarjeta en escritorio y al 80 % en
teléfono, asoma 30 px por debajo y 2 % por los lados, con 24 px de desenfoque en vez de 40.

### Grano en el fondo: probado, medido y RETIRADO

El fondo cálido estaba plano, y lo plano en pantalla grande se lee como «sin terminar», no como
sobrio. Se probó una capa de grano y **se ha quitado**. Queda anotado porque el camino entero es
lo útil, no el resultado.

**No tiene sentido como archivo.** El ruido es incompresible por definición: una tesela PNG de
256 px pesaba **78 KB**. Va en `feTurbulence` dentro del propio CSS —unos 300 bytes, sin
petición al servidor— y `stitchTiles` hace que tesele sin costura. Un generador de imágenes
tampoco sirve para esto: devuelve algo que no tesela y con artefactos de compresión encima.

**Se superpuso y estaba mal.** `feTurbulence` devuelve gris medio; pintado encima con opacidad
baja hace dos cosas a la vez: verse poquísimo **y agrisar el color**. Al 22 % ya se veía, pero
el fondo había dejado de ser cálido. Se intentó fijar el valor midiendo la amplitud en un
canvas, y el número era correcto **de la operación equivocada** —medía la superposición, no la
mezcla—, así que dio un 9 % invisible.

Lo correcto es mezclar: `background-blend-mode: overlay`, donde el gris medio es el neutro de la
operación. Deja el color intacto y solo las desviaciones aclaran u oscurecen, lo que permite
subir el ruido al 85 % sin tocar el tono. Hacen falta dos capas de fondo en vez de color +
imagen, porque el blend mezcla capas entre sí.

⚠️ **Y con todo eso resuelto, seguía sin verse.** El cliente, dos veces: «¿pusiste un grano?
porque no se ve nada» y «no se ve tampoco». En un cielo tan claro y con la página llena de
superficies blancas encima, el grano por píxel no tiene dónde leerse — y donde sí se lee, ya es
suciedad de pantalla y no papel.

**La conclusión, para no repetirlo:** si el fondo tiene que tener materia, viene de una imagen
con estructura —fibra, veladura, grumo, algo con escala—, no de ruido sin correlación espacial.

Y la conclusión de la conclusión, que llegó después: para «minimalista y profesional» **no es una
imagen**. Se probaron en vivo cuatro fondos sobre la portada —rejilla, puntos, icono gigante de
marca de agua y líneas del carril— y los dos que funcionan son geometría en CSS. El icono gigante
se descartó midiéndolo: al 16 % desaparece y subiéndolo deja de ser una marca y se pelea con el
neón rosa de la tarjeta. Sin decidir todavía cuál entra.

### El botón «Ingresar» y la cabecera se copian de OriginX, al valor

El cliente pasó una captura del botón «Get Started» de `originx.demos.tailgrids.com` pidiendo
«los mismos colores, ese degradado, así como el contorno». Y luego, la tipografía de la cabecera
entera: mismo tamaño y misma separación.

⚠️ **No se sacó de la captura, se midió en el sitio.** Una miniatura no da un `#FF7C61` ni un
`inset 0 -4px 8px rgba(255,255,255,.20)`, y ya hubo un intento anterior este mes de reconstruir a
ojo una imagen del cliente que acabó en «no bro, está feo». Se abrió la referencia en el
navegador y se leyeron los estilos calculados del `<a>` y de sus hijos.

Lo que apareció al leerlos:

- **Los cuatro puntos rosas de las esquinas son parte del botón.** En la captura parecían las
  marcas de selección de una herramienta de diseño. Son cuatro `<span>` de 3×3 px a −1 px, en
  rampa `#FF8268 → #FE7EB2`. Aquí se hacen con cuatro capas de fondo y un **borde transparente de
  1 px**, que es lo que permite que un fondo asome por fuera de su propia caja.
- **El botón es dos cajas**, no una: marco rosa translúcido al 20 % con 4 px de relleno, y dentro
  la cara con la rampa `#FF7C61 → #FF68A5`, radio 4 px y dos luces interiores blancas al 20 %.
  Esas luces son lo que lo abomba; sin ellas la rampa se ve plana.
- **OriginX usa Figtree**, la misma fuente del portal, y su enlace activo es `#FF7C61`, que es
  exactamente `--coral`. No hubo nada que adaptar.
- La cabecera: **16 px, peso 500, 32 px de texto a texto**. Aquí los 32 px salen del relleno de
  cada enlace (16 por lado) con `gap: 0`, no de un hueco declarado, o se sumarían los dos.

⚠️ **El tamaño de la navegación BAJA de 18 a 16 px**, deshaciendo lo que se pidió el 11/09. Se
sostiene porque lo que evitaba que los destinos se perdieran era el peso 500, no el tamaño.

⚠️ **Y el contraste empeora, a sabiendas.** El blanco sobre la rampa nueva da **2,70:1 y 2,53:1**;
la rampa magenta que había daba 4,42:1 y 3,48:1. Ninguna llega a los 4,5:1 de 1.4.3, pero la
nueva tampoco llega al 3:1 de 1.4.11 para el límite del control. El marco rosa se ve, pero al
20 % sobre nube da 1,18:1 y no lo salva. Va así por petición expresa y con el número escrito al
lado; el arreglo, si hace falta, son dos valores: `#D81B7E → #C4304B`.

Se fue con el cambio **el destello que cruzaba el botón cada 4,5 s**, que era lo único que se
movía solo en todo el portal. La pieza de la referencia no lo tiene, y sobre esta rampa un
reflejo blanco al 45 % hundía todavía más un contraste que ya no llega.

⚠️ **`--alto-cabecera` pasa de 68 a 70 px, MEDIDO.** El botón creció de 44 a 46 px de alto —36 de
cara + 4 de marco + 1 de borde por lado— y arrastró la barra. Seis reglas de cuatro hojas se
pinchan debajo de ese número. A partir de ahora la lista de lo que obliga a volver a medirlo
incluye el alto del botón, no solo los rellenos.

620 pruebas en verde y typecheck limpio. Comprobado a 1:1 en 800 px y en 390, sin desborde
horizontal.

### Los botones del portal copian los de OriginX, y el rotulo gira

Segunda tanda del mismo encargo. El cliente: «los botones en general de la pagina tienen un
efecto o animacion al poner el cursor encima», y sobre la pareja de la portada, «el blanco no
tiene bordes y ademas tiene como una sombra».

Los dos son ciertos y los dos se midieron en el sitio, no en la captura.

**La cara.** Una sola altura, 44 px —20 de linea mas 12 y 12 de relleno—, esquina de 4 px, letra
de 14 px y peso 500, sin contorno. El negro aclara a `#404040` al pasar por encima y levanta una
sombra; el blanco **no hace nada**, porque en la referencia tampoco: lo unico que se mueve es el
rotulo. Dos casualidades buenas: `--radio-control` ya era 4 px y `--activo-pulsado` ya era
`#404040`, asi que no hubo nada que ajustar ahi.

⚠️ **El secundario pierde su contorno y eso empeora el contraste, a sabiendas.**
`--borde-control` daba 3,45:1, que es lo que WCAG 1.4.11 pide al limite de un control; lo que
queda es una sombra de cuatro capas que ni se acerca. `DESIGN.md` decia literalmente que ese
contorno «no es negociable». Se cambio a peticion expresa, con el numero escrito al lado y la
vuelta atras en una linea.

Se fue tambien el halo coral del hover del boton negro. La referencia levanta la pieza con una
sombra neutra, y de paso el coral deja de aparecer en pantallas donde no hay turno que marcar.

**El giro del rotulo, que es lo que costo.** La referencia duplica la etiqueta en el arbol: dos
`<span>` identicos, uno que sube y otro que entra por abajo. Copiar eso deja el nombre accesible
del boton como «Enviar Enviar» y **rompe las 620 pruebas**, que localizan por rol y nombre.

La solucion son dos pseudoelementos con `content: attr(data-rotulo) / ''`. La barra da al
pseudoelemento un texto alternativo **vacio**, asi que no entra en el nombre accesible; el texto
real se queda donde esta —sigue dando el ancho y sigue siendo el nombre— y se pinta transparente.
Comprobado en el arbol de accesibilidad del navegador: el enlace se anuncia una sola vez. Va todo
dentro de un `@supports`, porque si esa sintaxis no se entiende la declaracion es invalida y el
boton se quedaria con su texto real transparente, o sea en blanco.

El atributo se puso con un escaner, no a mano: **82 de 88 botones**. Los 6 que no son un rotulo
de texto fijo se quedan quietos —cuatro llevan un icono dentro y girar el texto dejando el icono
parado se ve mal—. Los que cambian solos, «Guardando…» y compañia, reciben la misma expresion en
el atributo, asi que las dos copias cambian a la vez.

⚠️ **Y a la primera se veian TRES rotulos, no dos.** El cliente lo vio antes: «las animaciones
no funcionan bien, se ven como duplicadas». El texto real, que iba en `color: transparent`,
**reaparecia al pasar por encima**: `.acentoGrande:hover:not(:disabled)` es (0,3,0) y declara
`color`, por encima del (0,2,0) de `.acentoGrande[data-rotulo]`. Medido a mitad del hover:
`rgba(255,255,255,0.694)`, o sea el texto fijo entrando en blanco mientras las dos copias
giraban.

Subir la especificidad no valia: cualquier pantalla que le ponga color a su boton desde su hoja
volveria a ganar, y entre archivos el orden no es fiable —eso ya esta escrito en `CLAUDE.md`
para `composes`—. La salida es cambiar de propiedad: `-webkit-text-fill-color`, que decide con
que se pinta el glifo y que **no declara nadie mas en todo el proyecto**. No hay pelea de
cascada posible. `color` se queda como respaldo.

Comprobado a camara lenta, alargando la transicion a 4 s y mirando el boton a 3 aumentos a mitad
de recorrido: un solo rotulo, subiendo.

⚠️ **Y un efecto colateral que hay que saber:** en un boton que gira, un `color` a nivel de
pantalla ya no pinta nada. Dos lo hacian —`.enviarIgual` y `.volverAlProceso`— y ahora declaran
tambien `--rotulo-tinta`.

⚠️ **Media hora perdida contra una hoja en cache.** El navegador servia
`_acentoGrande_1i5h0_42` mientras Vite servia `_acentoGrande_kpfqi_42`: recargar, recargar sin
cache y navegar de nuevo no lo arreglaron, porque las URL de los modulos no cambian. Lo que si
funciona es **tocar los archivos CSS** —`find src -name '*.module.css' -exec touch {} +`—: Vite
empuja el HMR con una URL nueva y el navegador no puede reusar nada. Si un cambio de estilo «no
se aplica» y el `curl` al servidor dice que si, es esto.

620 pruebas en verde y typecheck limpio. Comprobado en vivo a 800 y a 390 px, con el giro medido
a mitad de recorrido: `::before` de 0 a -44 px, `::after` de +44 a 0.

**Y «Ingresar» tambien gira**, con su regla propia en `Armazon.module.css`. No se compone de
`piezas.module.css` porque esa pieza son dos cajas: quien recorta y lleva las dos copias es la
cara con la rampa, y quien recibe el raton es el marco rosa de fuera. Misma tecnica, distinta
regla.

⚠️ **El arbol de accesibilidad del panel lo enseña raro y no es un fallo.** Como el rotulo va
dentro de un `<span>`, la herramienta atribuye el texto al hijo y pinta el enlace sin nombre. El
nombre esta: se comprobo montando el marcado con Testing Library, que usa la misma computacion
que el navegador, y `getByRole('link', { name: 'Ingresar' })` lo encuentra.

### La loseta del titular cambia de PNG

El cliente subio `public/iconoMaleta.png` para reemplazar la del titular: el mismo maletin, pero
sobre dos losetas magenta —una girada detras de otra— en vez del cuadrado con halo rosa.

⚠️ **`getbbox()` de Pillow devolvia una caja falsa.** El archivo trae pixeles de alfa casi cero
por todo el lienzo, restos del exportador, y `getbbox()` los cuenta: decia 1225x1198 cuando el
dibujo mide **1112x1097**. Se recorta con umbral, que ademas da la misma caja entre alfa>10 y
alfa>220. Luego se cuadra centrando y se baja a 256 px con LANCZOS. Sin cuantizar la paleta: la
version anterior se probo a 200 colores y la rampa rosa salia a bandas.

⚠️ **Y la anchura del CSS hubo que volver a sacarla.** El PNG anterior traia halo transparente y
su loseta ocupaba el 73 % del lado, de ahi el `1,32em`. El nuevo va al ras y su loseta es el
**78,5 %**: con la misma anchura la loseta pasaba de 45 a 55 px y se metia dentro de la palabra
«trabajo». Queda en **1,08em**, y el margen horizontal **pasa de negativo a positivo** —antes
recuperaba el aire del halo, ahora hace falta separar—.

Medido en el navegador, que es lo unico que vale aqui: el titular mide **120 px con la imagen y
120 sin ella**, y la loseta visible son los 45 px de siempre.

620 pruebas en verde y typecheck limpio.

**El boton de la cabecera pasa a decir «Iniciar sesión».** Decia «Ingresar». La clase se sigue
llamando `.entrar`: renombrarla tocaria la hoja, el JSX y tres comentarios sin añadir nada.

El rotulo es 31 px mas ancho —125 en escritorio, 109 en telefono— asi que se comprobo el rango
estrecho. A 390 y 360 sobra sitio; **a 320 quedan 12 px** entre «Mis procesos» y el boton, contra
los 35 de antes. Cabe, la cabecera sigue midiendo 70 px y no hay desborde horizontal, pero ese es
el limite: si algun dia el rotulo crece mas, lo que se cae es «Mis procesos».

El otro «Ingresar» del portal, el de la tarjeta de acceso necesario (`ui/Mensajes.tsx`), **no se
toca**: ahi el boton esta dentro de una frase que ya explica que hay que entrar, y es una pieza
distinta.
