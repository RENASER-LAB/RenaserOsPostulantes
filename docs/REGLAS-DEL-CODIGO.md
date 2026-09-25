# Reglas del código

Lo que se lee **antes de tocar código**: los comportamientos que no se reescriben, las trampas
que ya costaron un fallo y las convenciones de escritura.

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

**`grupoPrioridad` nunca se pinta en el portal.** Llega en la respuesta de las postulaciones del
candidato, pero es la clasificación interna del equipo y nadie tiene que enterarse por su propio
portal de en qué casilla lo pusieron. **En el panel sí se pinta**, en cada fila del ranking: ahí
quien mira es el dueño de esa clasificación. La regla se lee sobre la sesión del candidato, y lo
que no puede pasar es que el dato cruce de una cara a la otra.

**Una pantalla del candidato que se queda abierta pasa sus fallos de escritura por
`usePantallaAbierta`** (`src/paginas/procesos/useVacanteRetirada.ts`, 22/09/2026). Si la empresa
elimina la vacante con la pantalla abierta, quien se entera es el botón: empezar, responder, subir
o entregar reciben un 404. El `onError` de cada escritura llama a `siSeCerroLaPuerta`, que vuelve
a pedir la pantalla —la simulación ya la pedía de nuevo al fallar «Confirmar asistencia»—, y el
error se enseña solo si `seEnsena` lo deja: mientras se comprueba se calla, y si la vacante se
eliminó la pantalla entera pasa a `VacanteRetirada`. Hoy lo usan la
prueba, la evaluación, el cuestionario técnico y la simulación; la evaluación se tragaba ese 404 y
el cuestionario enseñaba el texto crudo del servidor, porque cada una lo resolvía a su manera.
Una pantalla nueva de ese tipo entra por aquí.

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

**Retocar una pieza compartida desde la misma clase no hace nada.** Si una clase trae un botón
de `piezas.module.css` con `composes`, una regla sobre esa misma clase que cambie `display`,
`padding` o `font-size` pierde: en la hoja construida la pieza se escribe **después**, y a igual
especificidad manda la última. Así el botón «Más» del ranking se veía en escritorio, donde no
abre nada. La salida es escribir el retoque con el contenedor delante (`.filaFiltros .mas`), que
pesa más, no `!important`. ⚠️ En el código hay hoy unas 23 reglas así que el navegador ignora;
no se han tocado.

**Si el retoque es esconder o enseñar la pieza según el ancho, va como variante con nombre en la
hoja compartida**, no como `composes` más `display` en la hoja de la pantalla. Es
`.secundarioDelTelefono` en `piezas.module.css`: compone `secundario`, lo esconde, y hasta 640 px
lo enseña; la pantalla compone esa variante y nada más. Ahí la regla de `display` y la pieza
están en la misma hoja, y gana la que va después. Pasó con «Filtrar (n)» de `/vacantes`
(25/09/2026): su `display: none` perdía contra `.secundario` y el botón salía en escritorio,
junto a los filtros ya abiertos.

**`whileTap` de `motion` convierte en parada de Tab lo que no es un control.** Le pone
`tabindex="0"` a todo elemento con gesto de pulsar que no sea botón, campo o enlace y no traiga
`tabindex` propio. Una tarjeta con `<motion.article whileTap>` y un enlace dentro eran **dos
paradas**: el `<article>`, sin nombre y donde Enter no hacía nada, y después su enlace. Por eso
`TarjetaQueResponde` (`src/ui/movimiento.tsx`) lleva `tabIndex={-1}`: la única parada es el
enlace, y el toque sigue hundiendo la tarjeta. Cualquier superficie nueva con `whileTap` necesita
lo mismo.

---

## La marca de obligatorio es una sola, y la decide el esquema

Vale para los tres campos compartidos que la aceptan —`Campo`, `Seleccion` y `Consentimiento`—,
y se escribió una vez para que ningún formulario la invente otra vez.

**Un asterisco pegado al nombre del campo.** Va con `aria-hidden`, porque un `*` a solas se oye
como «asterisco» o no se oye, y detrás viaja la palabra «obligatorio» escondida a la vista,
**dentro de la misma etiqueta**, para que entre en el nombre del campo: lo que se anuncia al
llegar es «Ciudad obligatorio». El estado de verdad lo dice `aria-required` en el control, que es
otra cosa que el nombre.

**Qué campos la llevan sale del esquema de `zod` que valida el formulario**, preguntando a cada
uno si su valor vacío pasa la validación —`''` en el texto, `false` en las casillas—. Una lista
escrita aparte envejece sola: el día que una validación se afloje, la pantalla seguiría marcando
lo de antes, y un asterisco que miente es peor que ninguno.

**Lo opcional se dice con todas sus letras** —«· opcional»—, no se deduce de la ausencia del
asterisco. Importa sobre todo en una casilla de consentimiento: la que parece obligatoria se
marca «por si acaso», y ese permiso no vale nada.

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
