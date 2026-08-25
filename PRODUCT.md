# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Quien postula a un empleo.** Cualquier persona que busca trabajo, sin segmentar: el portal
funciona como un Indeed, abierto a quien quiera aplicar. Los puestos van de operativo a
directivo —el banco de evaluación tiene tres niveles— pero **el contenido y el recorrido son
los mismos para todos**: nada cambia según el puesto al que se postule.

Su situación: está buscando trabajo y acaba de encontrar una vacante. Lo que necesita del
portal es entender qué le piden, hacerlo sin perderse, y saber en qué punto está su proceso
sin tener que preguntar.

**El equipo de Talento también es usuario, desde el 25/08**, aunque de otra cara: su panel
vive en `/admin`, dentro de este mismo repositorio. Debería estar integrado en RENASER OS y
ese sigue siendo el plan; está aquí mientras se termina lo que permitirá a otras empresas
crear sus propias vacantes. Lo que ve el equipo no lo ve el candidato, y al revés: son dos
sesiones con dos tokens distintos.

## Product Purpose

Es la cara pública del proceso de selección de Renaser: la persona elige una vacante, postula
con su currículum, responde una evaluación escrita, rinde una prueba del puesto cronometrada,
asiste a una sesión de trabajo, trabaja un periodo corto de validación, y al final una persona
decide.

El proceso dura semanas y tiene cinco etapas. **Éxito** es que quien postula llegue al final
sin haber tenido que escribir a nadie para preguntar qué pasa con su candidatura, y sin haber
perdido una sola respuesta por el camino.

## Positioning

**Aquí no se decide por el currículum.** El proceso mira cómo trabaja la persona: una prueba
del puesto con reloj, una sesión de trabajo observada y un periodo trabajando de verdad. El
currículum entra, pero por diseño **no descarta a nadie**.

Eso es lo que un portal de empleo convencional no puede copiar: no publica vacantes y recoge
CVs, sostiene un proceso largo de evidencia. Y tiene una consecuencia directa sobre la
interfaz — quien postula invierte semanas y varias horas de trabajo real, así que el portal
le debe una explicación honesta de en qué punto está y qué falta.

El proceso **ya existe y Renaser lo lleva a mano**. No se está inventando un método; se está
digitalizando uno que usan.

## Operating Context

**El recorrido son cinco etapas** —Perfil Integral, Prueba del puesto, Simulación, Validación,
Decisión— y dieciocho estados con nombre. Cada estado responde a una sola pregunta: de quién
se espera algo.

**Trece de los dieciocho estados no piden nada al candidato.** Solo cinco le dan trabajo. La
experiencia real del portal es, en su mayor parte, esperar — y saber que se está esperando
bien.

**Hay dos recorridos distintos**, según la vacante:

- Con evaluación: postular → evaluación escrita → espera → prueba con entregables.
- Sin evaluación: postular → **espera sin ninguna acción** → prueba en forma de cuestionario.
  En este camino, la primera pantalla que ve alguien tras postular no tiene nada que hacer.

**Hay dos formas de entrar, y las dos son normales:**

- Con correo y contraseña, para quien se registró en el portal.
- **Con un enlace del correo, sin contraseña**, para quien llegó por una carpeta de currículums
  y no tiene cuenta. Es la vía de toda una tanda de candidatos.

**Los tiempos y los plazos son reales y los manda el servidor.** La evaluación tiene 14 días
por defecto. La prueba del puesto lleva un cronómetro que arranca al abrirla y no se detiene
al cerrar el navegador.

**Está previsto** hacer más adelante una aplicación móvil para Play Store. Mientras tanto, el
portal web tiene que funcionar bien en teléfono y en computadora: la gente entra por los dos.

## Capabilities and Constraints

**Lo que el candidato puede hacer sin cuenta:** ver las vacantes abiertas, leer una ficha
completa y leer los textos legales. Todo lo demás exige entrar.

**La evaluación** son entre 50 y 85 preguntas según el nivel del puesto, en orden fijo, con
**ocho formatos de respuesta** distintos: elegir una opción, escribir, marcar la que más y la
que menos se parece, calificar cada opción del 1 al 5, ordenar cinco pasos, marcar varias, y
rellenar los campos de un caso. Se responde en varias sesiones y se puede volver atrás a
corregir.

**La prueba del puesto tiene dos formas** que llegan por el mismo sitio: un reto con
entregables (archivo o enlace, obligatorios y opcionales) más un cambio inesperado a mitad, o
un cuestionario de veinte preguntas sin entregables.

**Confirmar los requisitos indispensables al postular es el único descarte automático de todo
el sistema.** Un requisito activo sin confirmar cierra la postulación en el acto.

**Lo que nunca puede llegar a la pantalla:** el grupo de prioridad —clasificación interna del
equipo, aunque viaje en la respuesta—, las claves y puntajes de las preguntas, y la matriz de
información crítica de la simulación, que es justamente lo que se espera que el candidato
descubra o pregunte por su cuenta.

**Reglas técnicas que ya costaron un fallo real y que el código nuevo hereda:**

- Una sola fuente traduce los dieciocho estados a lo que ve el candidato.
- La hora la manda el servidor; el cronómetro descuenta el desfase entre relojes.
- Lo escrito no sale de la cola hasta que el servidor lo confirma, y no se deja entregar
  mientras quede algo sin guardar.
- Ningún indicador de «guardado» puede ser texto fijo: sale de comparar con el servidor. Una
  pregunta en blanco está **sin responder**, que no es lo mismo.
- Una respuesta de texto no puede pasar de 20 000 caracteres: el backend la rechaza.

**Hechos que todavía no están decididos o resueltos, y que no hay que inventar:**

- **Decisión ámbar** y **Validación** están maquetadas completas, pero el backend **no tiene
  ninguna ruta** para ellas: ni para leer qué evidencia se pide, ni para enviarla, ni para
  consultar días, responsable o métricas.
- **El backend no dice cómo se llama el candidato.** Al entrar devuelve solo un identificador.
  Quien entre desde otro navegador verá el portal sin su nombre.
- **El correo hoy no sale.** El backend lo tiene en modo registro por defecto, así que cada
  «te avisaremos por correo» es una promesa que el sistema desplegado puede no cumplir.
- **Los textos de consentimiento van a crecer**: todavía no nombran a las empresas que
  procesan los datos, y tienen que hacerlo antes del primer candidato real.
- La figura contractual de la validación y el responsable del periodo son datos que Renaser
  aún no ha definido.

## Brand Commitments

- **El nombre es EX**, y su logotipo —la palabra con la hormiga dentro de la X— se conserva
  tal cual. Es lo único que sobrevive del portal anterior.
- **Solo tema claro**, por petición del cliente.
- **Fondo blanco y acento índigo `#4338CA`**, ya aprobado. El acento significa una sola cosa:
  «te toca a ti».
- **Todo en español**, incluidos los nombres del código.
- Al cliente le gusta la estética de Apple, pero pidió expresamente que no fuera su azul.

## Evidence on Hand

- **El maquetado aprobado**, 17 pantallas: `maquetado/` (ver `maquetado/LEEME.md`). Define qué
  información va en cada pantalla y con qué palabras. Es la especificación de contenido.
- **Qué ve el candidato pantalla por pantalla**, sacado de los contratos del backend:
  `docs/02-QUE-VE-EL-CANDIDATO.md`.
- **Estado del rediseño y decisiones tomadas**: `docs/03-ESTADO-DEL-REDISENO.md`.
- **Vacantes reales** servidas por el backend desplegado.
- **Cinco pruebas del puesto reales** en el repositorio del backend, tal como se enviaron a
  candidatos: valen como modelo de contenido y de tono.

**Lo que no existe y no se puede inventar:** testimonios de candidatos, número de personas
contratadas por el sistema, tiempos medios del proceso, logos de clientes, y cualquier métrica
de resultados. El sistema todavía no ha pasado por su primer candidato real.

## Product Principles

1. **El estado dice de quién se espera algo, y la pantalla tiene que decirlo primero.** Antes
   que cualquier otra cosa, quien entra debe saber si le toca a él o no. Trece de dieciocho
   estados son esperas: si se pintan igual que las acciones, el portal miente.

2. **Nada se da por guardado hasta que el servidor lo confirma.** Vale para la respuesta de una
   pregunta y para cualquier indicador que diga que algo está a salvo. Se perdieron respuestas
   por no cumplir esto.

3. **Lo mismo para todos.** El contenido y el recorrido no cambian según el puesto ni el nivel
   de quien postula. Un texto que solo entiende un perfil concreto está mal escrito.

4. **No prometer lo que el sistema no cumple.** Si el correo puede no salir, la pantalla no
   puede tratarlo como la única vía. Si una evidencia no se puede enviar todavía, no se finge
   un formulario.

5. **Lo interno se queda dentro.** El grupo de prioridad, las claves de las preguntas y la
   matriz de la simulación no llegan al navegador. No es un filtro al pintar: es que no deben
   estar ahí.

## Accessibility & Inclusion

No hay una norma exigida por contrato, pero **nadie debe quedarse fuera por la interfaz**: es
un portal de empleo, y una barrera aquí impide postular a un trabajo, que es distinto de una
web incómoda.

Se trabaja con teclado, contraste y lector de pantalla como cosa normal, no como una fase
posterior. Dos sitios lo exigen de forma concreta: **ordenar los cinco pasos** de una pregunta
tiene que poder hacerse sin ratón, y **el cronómetro de la prueba** no puede ser la única
señal de que queda poco tiempo.

Sin auditoría formal contra un estándar mientras no lo pida nadie.
