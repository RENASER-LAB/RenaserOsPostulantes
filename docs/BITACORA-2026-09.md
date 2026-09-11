# Bitácora · septiembre 2026

Lo que se hizo cada día, en orden inverso. Es historial: **para saber cómo funciona algo hoy,
mira el documento temático que corresponda** (empieza por [README.md](README.md)); esto explica
por qué llegó a ser así y qué se probó por el camino.

Sigue en [BITACORA-2026-08.md](BITACORA-2026-08.md).

**Al 07/09/2026, el titular del mes:** el ranking se corta por de quién es la pelota; «Mi
perfil» tiene foto, portada, currículum propio y diplomas; empleos, estudios y
certificaciones comparten UNA cronología; la caja significa «esto te toca»; y al postular ya
no se vuelve a subir el currículum. Lo del 07/09 se documentó en
[06-FLUJO-COMPLETO.md](06-FLUJO-COMPLETO.md), no aquí.

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
