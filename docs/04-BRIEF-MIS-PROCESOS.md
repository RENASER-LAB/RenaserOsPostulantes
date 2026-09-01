# Brief · «Mis procesos», pantalla piloto

Fecha: 2026-08-24 · Estado: pendiente de tu confirmación · No se ha escrito código

Este brief cubre **una pantalla**, la que se construye primero para ver el mundo visual
aplicado a algo real. El mundo que aquí se fija gobierna después todo el portal.

---

## 1 · Quién llega y en qué estado

Cualquier persona que busca trabajo, de operario a directivo. Llega **entre otras cosas del
día**, casi siempre a lo mismo: comprobar si hay novedad. Lleva días o semanas esperando y no
controla nada del proceso.

**Modo: Operate.** Viene a completar una tarea o a confirmar que no la tiene. No hay nada que
persuadir — ya postuló. Lo que gana es escaneabilidad y que el estado sea inequívoco; la marca
vive en la precisión de los detalles, no en la expresión.

Puede llegar **sin que sepamos su nombre**: quien entra por el enlace del correo desde otro
navegador es anónimo para el portal. Nada puede depender de saludarle por su nombre.

## 2 · Qué tiene que conseguir, y con qué se demuestra

**La tarea primaria en una frase:** saber en menos de tres segundos si le toca algo a él, y si
le toca, empezarlo desde aquí sin buscar dónde.

**Éxito** es que se vaya sin escribir a nadie preguntando qué pasa con su candidatura. El
fracaso conocido es el contrario: trece de los dieciocho estados no piden nada, y si se pintan
igual que los cinco que sí, el portal miente sobre lo que hay que hacer.

**La evidencia es real y viene del backend:** el nombre de la vacante, el estado con nombre, los
días sin cambio, la fecha de postulación y el historial completo de cambios. Nada de esto se
inventa. **No existen** y no pueden aparecer: número de candidatos, tiempo medio del proceso,
posición en una lista, ni ninguna métrica de resultados.

## 3 · La dirección elegida: «El seguimiento»

**El mundo:** la guía de encomienda, el rastreo de un envío. Tu postulación es algo que va en
camino, con hitos cumplidos y fechados, y un siguiente hito siempre nombrado.

**Tesis estructural:** cada postulación es una línea de hitos, no una tarjeta con un chip de
estado. El recorrido se lee de arriba abajo; lo cumplido queda arriba con su fecha, lo abierto
está en el medio con la acción dentro, lo que falta está debajo, nombrado y en gris.

**La consecuencia que la distingue de un rastreo cualquiera** — y es la disciplina que le
donamos de la dirección que la tirada había asignado, «La cartilla»:

> **Lo cumplido no se apaga.** Un rastreo de paquete normal enfoca el hito actual y desvanece
> los anteriores. Aquí cada etapa cerrada deja una marca fechada que se sigue leyendo con el
> mismo peso, porque el producto trata de acumular evidencia: lo que ya demostró es suyo y no
> se atenúa. El documento es del candidato, no del sistema.

**Las seis disciplinas que hereda de las direcciones que perdieron**, cada una con su donante:

| De | Qué se toma |
|---|---|
| El riel de emisión | El estado se lee en la **forma** —relleno, contorno, discontinuo, tachado— nunca solo en el color. Quien no distingue colores lee el mismo recorrido |
| La edición de referencia | **Cero radios** en toda la interfaz y cada regla a un píxel exacto. Los estados son marcas impresas, no cromo con sombra |
| El terminal de fósforo | El estado se imprime **dentro del flujo**, no como etiqueta pegada en un margen |
| La grulla de origami | Lo cumplido sigue leyéndose después de cumplirse |
| Los tiles metro | **La tipografía hace la jerarquía.** Ningún recuadro ni sombra existe para crear un nivel que el tamaño ya crea |
| La tormenta de alfabeto | Compromiso total con una sola idea formal: el seguimiento llega hasta el examen y el historial, no se queda en esta pantalla |

**Primer viewport:** cabecera fina con la marca EX. Debajo, una línea que dice cuántas cosas
hay pendientes —o que no hay ninguna. Después, una columna de postulaciones; la que tiene algo
abierto va primera y es la única con tinta índigo.

**Momento focal:** la marca de la etapa recién cumplida, con su fecha. Es lo único del portal
que se mueve, y por eso significa.

**Riesgo honesto, ya asumido:** el rastreo de envío es exactamente donde aterrizaría cualquier
intento en este rubro. Se defiende con lo que un rastreo no hace — no apagar lo cumplido,
codificar el estado en la forma, y meter la acción dentro del hito en vez de en un botón
suelto.

## 4 · Alcance y fronteras

**Se construye:** «Mis procesos», completa y de producción, con sus estados reales.

**No se toca:** `src/api/`, `src/dominio/` y los ocho formatos del banco. Se conservan y se
adaptan; su lógica está probada contra el backend real y reescribirla de memoria es donde
vuelven los fallos conocidos.

**Anti-objetivos, explícitos:**

- Ningún chip de color como única señal de estado.
- Ninguna sombra ni radio para fabricar jerarquía.
- Ningún dato inventado para llenar un hueco visual.
- Ninguna animación fuera del momento focal.
- El acento índigo **solo** para «te toca a ti». Si aparece en un botón secundario, deja de
  leerse.

## 5 · Estados y rangos reales

| Situación | Qué hay que resolver |
|---|---|
| **Ninguna postulación** | Es la primera pantalla de mucha gente. No es un error: es una invitación a ver vacantes |
| **Una postulación, y le toca** | El caso central |
| **Una postulación, y no le toca** | Trece de dieciocho estados. Tiene que quedar claro que no hay nada que hacer, sin que parezca abandono |
| **Varias a la vez** | Entre dos y unas diez. Puede tener varias abiertas simultáneamente |
| **Ninguna pide nada, pero hay procesos vivos** | El caso más frecuente en la práctica |
| **Postulación cerrada o terminada** | Contratado, no continúa, o cerrada. Cada una con su mensaje distinto |
| **Cargando y fallo de red** | El backend tarda alrededor de un segundo; un fallo tiene que poder reintentarse |
| **Calificando** | La pantalla se refresca sola mientras la IA trabaja |

**Rangos de texto:** el nombre de una vacante puede ser corto («Administrador») o largo
(«Ingeniero/a de Infraestructura»). Los días sin cambio van de cero a sesenta, que es cuando
el sistema cierra por inactividad.

## 6 · Interacción y disposición

**Jerarquía, en orden de lectura:** ¿tengo algo que hacer? → ¿en qué postulación? → ¿qué es y
cuánto me llevará? → ¿dónde estoy en el recorrido? → todo lo demás.

**Topología:** una sola columna de postulaciones, ordenadas con las que piden algo primero. No
hay pestañas ni filtros: con diez elementos como máximo, filtrar es más trabajo que leer.

**La acción vive dentro del hito abierto**, no en un botón flotante ni en una barra fija. Es lo
que hace que «dónde estoy» y «qué hago» sean la misma mirada.

**Responsive, y esto es requisito, no adaptación:** entran por teléfono y por computadora por
igual. La línea de hitos es vertical en las dos, así que el mismo componente sirve; lo que
cambia es la densidad y dónde caen las fechas.

**Movimiento:** solo la marca al cerrar una etapa, y se respeta `prefers-reduced-motion`.

**Retroalimentación:** ningún indicador puede ser texto fijo. Si dice que algo está a salvo,
sale de comparar con el servidor.

## 7 · Restricciones y decisiones abiertas

**Vinculantes:** solo tema claro; blanco y acento índigo `#4338CA`; el nombre EX y su logotipo
—la palabra con la hormiga dentro de la X— tal cual; todo en español, incluidos los
identificadores del código; CSS Modules; Radix para primitivos.

**Accesibilidad:** teclado, contraste y lector de pantalla desde el principio. El estado
codificado en forma, no solo en color, ya viene resuelto por la dirección.

**Lo que un constructor no puede inventar aquí:**

- El grupo de prioridad llega en la respuesta y **no se pinta jamás en el portal**. Es la
  clasificación interna del equipo, y la mesa donde el equipo la usa es su panel, no esta
  pantalla.
- Si el candidato no tiene nombre, la pantalla no lo saluda; no se inventa uno ni se pone
  «Usuario».
- El correo hoy puede no salir, así que «te avisaremos por correo» no puede ser la única vía
  que se le ofrece.
- Ninguna cifra agregada sobre el proceso, porque no existe ninguna.

**Abierto y a decidir con datos, no ahora:** si con diez postulaciones la columna única
aguanta. Se mira cuando exista un candidato real con esa cantidad.
