---
target: mis procesos
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
timestamp: 2026-08-24T16-01-11Z
slug: src-paginas-procesos-procesos-tsx
---
Method: dual-agent (A: revisión de diseño · B: detector + evidencia de navegador)

## Design Health Score

| # | Heurística | Score | Problema clave |
|---|-----------|-------|----------------|
| 1 | Visibilidad del estado del sistema | 2 | La lista se reconsulta cada 15 s y el cambio de estado ocurre en silencio: sin `aria-live` y con el «momento focal» invertido |
| 2 | Correspondencia con el mundo real | 3 | Español llano y bien escrito. «Sin cambios» es métrica interna, no vocabulario del candidato |
| 3 | Control y libertad | 2 | Sin cerrar sesión en el armazón. Una postulación terminada no se puede archivar ni ocultar: se acumula con peso visual máximo |
| 4 | Consistencia y estándares | 2 | Dos fuentes de copy terminal (`COMO_TERMINO` vs `MOMENTOS`), el acento con dos significados, y los cuatro enlaces de detalle llevan al portal viejo |
| 5 | Prevención de errores | 1 | El sistema cierra a los 60 días de inactividad. La pantalla muestra el contador y esconde la consecuencia |
| 6 | Reconocer antes que recordar | 3 | Las cinco etapas nombradas y la acción donde estás. Falta cuánto dura la evaluación y cuánto plazo queda |
| 7 | Flexibilidad y eficiencia | 2 | El uso repetido no es más barato que el primero: nada se colapsa, nada se recuerda |
| 8 | Estética y diseño minimalista | 2 | La tinta está repartida al revés: el bloque más alto es el que menos dice. Tres textos a 90-91 ch sin medida |
| 9 | Recuperación de errores | 3 | El estado de fallo es genuinamente bueno. La causa es `error.message` crudo y no hay salida si el reintento falla |
| 10 | Ayuda y documentación | 1 | Ningún punto de ayuda. El éxito se define como «que se vaya sin escribir a nadie» y no hay dónde consultar nada |
| **Total** | | **21/40** | **Aceptable, borde inferior (52 %)** |

## Design Specificity Verdict

**Parcialmente específico, y lo específico está en las palabras, no en la forma.**

Autorizado por este producto: la acción vive dentro del hito abierto (traducción directa de que 13/18 estados son esperas), el copy («No tienes que hacer nada», «esto es un problema para mostrarlas, no para conservarlas»), y el estado codificado en forma antes que en color.

No autorizado: «lo cumplido no se apaga» —la disciplina que iba a distinguir esto de un rastreo cualquiera— se reduce a un cuadrado negro y «Superada» en gris de 14 px, y se invierte por completo en la postulación terminada. «Lo cumplido queda arriba con su fecha» no existe: el endpoint de la lista no trae historial, y una guía de encomienda sin fechas es un stepper.

Quita el texto en español y el logotipo, y esta composición sirve tal cual para el seguimiento de un trámite bancario o una solicitud de visa.

**Escaneo determinista.** El detector devuelve `[]`, pero con dos salvedades que lo vacían casi de contenido: corre en modo degradado (le faltan los módulos de parseo) y, aun reparado, solo `.html` pasa por el motor AST. Los `.tsx` y los `.module.css` van por regex, sin resolver `var(--acento)` ni la cascada. El único `.html` del proyecto es un cascarón de 18 líneas. Ese `[]` no es un certificado de la pantalla.

El detector corriendo **dentro de la página** sí encontró: `line-length` en `.esperaAyuda` (91 ch). Dos hallazgos más se desmintieron: `gradient-text` y `layout-transition` son falsos positivos (el segundo apunta a `base.css`, la hoja vieja que sigue embarcándose).

**Sin superposición visible.** El detector corrió en la página headless; no hay overlay que mirar en el navegador.

## Overall Impression

El caso frecuente está bien resuelto y los dos casos que la gente recuerda están mal. «No tienes nada pendiente» + «No tienes que hacer nada» es honesto y calmo, y es el 72 % de las visitas. Pero el día que a alguien le dicen que no, la pantalla le promete que su postulación sigue en marcha; y el día que lo contratan, se lo dice en la misma caja gris que un aviso de trámite.

La mayor oportunidad: la pantalla está diseñada para su caso excepcional. Trece de dieciocho estados no piden nada, y esas trece tarjetas dibujan igualmente el recorrido completo de cinco hitos.

## What's Working

**1 · La acción dentro del hito abierto.** El bloque de espera y el bloque abierto son formalmente distintos, no solo de color, así que un vistazo separa «me toca» de «no me toca» sin leer. Es lo que impide que el portal mienta.

**2 · El contraste y la forma están resueltos de verdad.** 62 nodos de texto medidos, cero fallos, mínimo 5,05:1. Sin desborde a 375 ni a 1280. Foco de teclado en las 12 paradas con orden lógico y anillo visible. Cero errores de consola.

**3 · El estado vacío se resiste al acento.** El botón es negro, no índigo, porque ahí no hay acción pendiente. Alguien sostuvo la regla donde era más tentador romperla.

## Priority Issues

### [P0] La pantalla le dice a quien fue rechazado que su postulación sigue en marcha

`entradaDe()` en `src/paginas/procesos/Procesos.tsx:184` solo mira `pendientes` y `total`; nunca consulta `esFinal`. Con una única postulación terminada devuelve: «Tu postulación sigue en marcha y ahora nos toca a nosotros. Te escribiremos en cuanto haya novedad.»

**Por qué importa:** rompe el principio de producto «no prometer lo que el sistema no cumple» en el momento de máximo riesgo emocional, y promete un correo que no llegará. Produce exactamente el fracaso que define el brief: esta persona va a escribir preguntando qué pasa. Además contradice el «Gracias por participar» que está 40 px más abajo.

**Arreglo:** pasar `procesos` a las funciones de copy y ramificar por `vivos = procesos.filter(p => !esFinal(p.estado))`.

**Comando:** `/impeccable clarify`

### [P1] El recorrido de una postulación terminada se pinta entero vacío

`recorridoDe()` devuelve las cinco etapas en `pendiente` sin `etapaDeCorte`, y la lista no trae historial. Consecuencia: `.cortada` —la marca tachada, la mejor pieza de codificación en forma del sistema— nunca se dibuja.

**Por qué importa:** invierte la única disciplina que definía la dirección. Quien hizo la evaluación, la prueba y la simulación ve, el día que le dicen que no, un expediente en blanco. Y es el peor cociente tinta/información: el bloque más alto es el que menos dice.

**Arreglo:** si `esFinal` y no se conoce la etapa de corte, no pintar el raíl; dejar el bloque de cierre solo. A medio plazo, pedir la etapa de corte al backend.

**Comando:** `/impeccable distill`

### [P1] El acento índigo significa dos cosas, y la segunda es «esto es un enlace»

`mundo.css` define `a { color: var(--acento) }`. En escritorio hay seis textos índigo compitiendo con un botón índigo, en el mismo `#4338CA`.

**Por qué importa:** es el anti-objetivo textual del brief y el compromiso de marca del PRODUCT.md. La regla era el mecanismo por el que «me toca a mí» se resuelve sin leer. Donde más se rompe: en la tarjeta rechazada, el único índigo es un enlace que no pide nada.

**Arreglo:** enlaces en `--tinta` con subrayado de `--regla2`; el subrayado ya los identifica.

**Comando:** `/impeccable colorize`

### [P1] El único movimiento del portal se dispara en la historia y calla en la noticia

`initial` solo se aplica al montar. En la primera carga se animan todas las marcas cerradas hace semanas. Cuando el refetch cambia un hito a `cumplida`, el `motion.span` no se remonta: no se anima nada.

**Por qué importa:** el brief llama a este gesto «momento focal» y lo justifica como lo único que se mueve. Hoy celebra lo viejo y calla en el instante que era su razón de existir. Sin `aria-live`, alguien con lector de pantalla nunca se entera de que ahora le toca algo.

**Arreglo:** guardar el paso anterior por hito y animar solo la transición real. Añadir una región `aria-live="polite"` que anuncie el cambio.

**Comando:** `/impeccable animate`

### [P2] La única cifra en pantalla es la que no sirve, y la que pone en riesgo no aparece

Se lee «2 días sin cambios» —métrica interna de frescura—. No están: cuántos días quedan de los 14 del plazo, cuántas preguntas son, ni que a los 60 días el sistema cierra la postulación.

**Por qué importa:** la decisión que se toma aquí es «¿lo hago ahora o después?» y no hay con qué tomarla. La pantalla exhibe el contador de un plazo mortal y oculta que es mortal. Es la única pérdida evitable del producto, sin ninguna prevención.

**Arreglo:** quitar «sin cambios» del panel de acción y poner el tamaño de la tarea. A partir de ~45 días, aviso con la consecuencia nombrada.

**Comando:** `/impeccable harden`

## Persona Red Flags

**Sam (lector de pantalla y teclado)** — la persona crítica en un portal de empleo:
- `list-style: none` sin `role="list"`: Safari/VoiceOver descarta la semántica y el raíl deja de anunciarse como lista de 5 elementos.
- Tres de cada cinco hitos no anuncian su estado: `pendiente` y `esperando` no dicen nada. `resumenDe()` ya existe en `estados.ts` y devuelve justo ese texto.
- Todos los títulos de estado son `<p>`: el estado no se alcanza navegando por encabezados.
- Cuatro enlaces con la cadena idéntica «Ver el detalle y el historial», sin `aria-labelledby` en los `<article>`.

**Quien recibió un «no»** (persona derivada del producto):
- Lee que su candidatura sigue en marcha (P0), ve su recorrido en blanco (P1), y el único enlace lo lleva a una pantalla del diseño viejo que para `NO_CONTINUA` no muestra ningún cierre.
- No puede archivar la tarjeta: la verá indefinidamente.

**Jordan (primera vez)**:
- «2 días sin cambios» junto al botón se lee como reproche o cuenta atrás sin destino.
- «Continuar evaluación» dice *continuar* aunque no haya empezado, y no dice cuánto durará. Con 50-85 preguntas sin pista, posponer es lo racional.
- Ningún punto de ayuda: ni qué es la simulación, ni cuánto dura, ni a quién escribir.

**Casey (móvil)**: funciona —columna única, botón de 44 px, raíl vertical en ambos anchos— pero con cuatro postulaciones hay 2666 px de alto, 3,3 pantallas.

## Minor Observations

- **Objetivos táctiles bajo mínimo:** la fila `.gestion` da enlaces de 21 px de alto («Ver más vacantes», «Privacidad y control de mis datos») y la navegación de cabecera 38 px. Son controles, no enlaces en prosa.
- **Tres textos a 90-91 ch:** `Seguimiento.module.css` no pone `max-width` en ninguna de sus siete reglas de texto, mientras `Procesos.module.css` lo pone en cuatro sitios.
- **El champagne sigue embarcado como código muerto con disparador:** `variables.css` aún declara `html[data-theme="dark"] { --acento: #d9b86c }`, que ganaría **por especificidad**. Hoy nada pone el atributo, pero cualquier cosa que lo ponga voltea la paleta entera en silencio.
- **`COMO_TERMINO` es una segunda fuente de copy** para tres de los dieciocho estados, con texto distinto al de `MOMENTOS`. Los textos nuevos son mejores: súbelos a `estados.ts`.
- **`<button>` sin `type`** en `Proceso.tsx:181, 197, 200`. Ninguno dentro de un `<form>`, así que hoy no rompe nada, pero CLAUDE.md lo nombra como trampa que ya costó un fallo.
- **`--bien`, `--duda`, `--mal` declarados y sin usar.** El aviso de los 60 días sería su primer uso legítimo.
- El estado de carga es un esqueleto dentro de una caja con borde, mientras el estado real no tiene caja: el esqueleto no se parece a lo que llega.

## Questions to Consider

1. Si trece de dieciocho estados no piden nada, ¿por qué esas trece tarjetas dibujan el recorrido completo? ¿Qué se pierde si una postulación sin acción se colapsa a dos líneas y despliega el raíl solo si se pide?
2. La dirección se llama «El seguimiento» y no hay una sola fecha en pantalla. ¿Sigue siendo una dirección, o es un stepper vertical con buen copy?
3. ¿Qué tendría que verse para que alguien, sin haber leído el brief, notara que aquí lo cumplido no se apaga? Si no es evidente, la disciplina no está construida.
4. El correo puede no salir y «Te escribiremos» es la única vía ofrecida. ¿Qué frase honesta ocupa ese sitio y además le da una razón para volver?
5. Si el éxito es «que se vaya sin escribir a nadie», ¿qué preguntas se le quedan sin responder? Cuánto dura, cuánto queda, qué pasa si no hace nada, qué es la simulación, y —tras un no— por qué. Cinco preguntas, cero puntos de ayuda.
6. El día que a alguien lo contratan se lo dices en la misma caja gris que «tu prueba está en revisión». ¿Es contención, o es que el sistema no distingue la mejor noticia de un aviso de trámite?
