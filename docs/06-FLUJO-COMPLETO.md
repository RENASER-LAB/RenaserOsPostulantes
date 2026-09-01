# De la solicitud a la decisión: el proceso entero

Última actualización: 2026-09-01

**Los pasos 1 a 5 están corridos** contra el backend local con
`herramientas/e2e/14-vacante.spec.ts`, y **la mitad del paso 0 que escribe una prueba**,
con `15-componer-prueba.spec.ts`. Del 6 en adelante —y de las áreas del paso 0—, lo
que hay aquí está leído del código y de los tests, no de una ejecución.

Los dos lados a la vez: qué hace el equipo en el panel y qué ve quien postula.
Cada paso dice **dónde** se hace y **qué lo desbloquea**, porque casi todos los
atascos del sistema son un requisito que el backend exige y nadie había dicho.

---

## Antes de que exista la vacante

### 0 · Dos cosas que ya tienen que existir

Ninguna de las dos es parte del proceso, y las dos lo paran en seco si faltan.
Hasta el 31/08 se creaban por fuera del panel y por eso no estaban aquí.

**Las áreas** · *Panel · Configuración → Áreas*

Un área es dónde trabaja alguien, y **el paso 1 la pide como obligatoria**: sin
ninguna no se registra una solicitud de talento, y sin solicitud no hay vacante.
Se crean, se renombran, se retiran y se reactivan desde ahí.

⚠️ **Retirar y borrar no son lo mismo.** Retirar deja todo donde está y se
deshace: el área sale de los desplegables y quien la tuviera asignada la
conserva. Borrar exige mover antes a otra área lo que colgaba de ella, y ese
movimiento no se deshace. Antes de confirmar, la pantalla enseña cuántas
solicitudes y cuántas personas cuelgan del área —los recuentos de verdad, no un
«¿seguro?»—, y si no puede traerlos no ofrece el botón.

**Las pruebas del puesto** · *Panel · Pruebas* (`/admin/pruebas`)

El paso 3 obliga a elegir una versión de prueba publicada, y hasta el 31/08 **no
había ninguna pantalla para escribirla**: las que existen entraron por scripts de
Python del backend. Ahora se compone entera desde el panel —datos y tiempos, el
enunciado subido como archivo, la guía de calificación para la IA, las preguntas
traídas del catálogo, los entregables, la rúbrica y las variantes del cambio
inesperado— y se publica.

La prueba vive en un **catálogo propio, independiente de las vacantes**: primero
existe la prueba, después alguna vacante la elige, y la misma puede servir a
varias. Una plantilla sin puesto es genérica y vale para cualquiera.

Mientras se compone, un balance arriba dice a la vez todo lo que falta. Existe
porque publicar **para en la primera regla que falla**: el backend valida en
cascada y devuelve un mensaje, así que con la rúbrica descuadrada y preguntas de
menos hacían falta tres intentos para enterarse de tres cosas.

⚠️ **Publicar congela la versión y no hay «despublicar».** Para cambiar algo se
abre una versión nueva sobre ella.

⚠️ **El archivo que se sube es el ENUNCIADO, no la prueba.** Subirlo no crea
preguntas, ni entregables, ni rúbrica: publicar sigue exigiendo lo mismo. Y su
enlace **caduca a los 180 días**.

⚠️ **La subida no se ha probado contra un almacén de verdad.** En local los
archivos viven en memoria y el enlace sale como `memoria://`, que ningún
navegador abre: está comprobado que el enunciado se guarda y que sobrevive a
volver a guardar la versión, **no que el archivo se pueda descargar**. Un fallo
en la firma del almacén real no lo vería nadie hasta el primer candidato.

### 1 · La solicitud de contratación

**Panel · Vacantes → Crear vacante**

El backend no deja abrir una vacante suelta: tiene que respaldarla una
solicitud aprobada que todavía no haya usado ninguna otra. Si no hay ninguna
`ABIERTA`, el panel lo dice y ofrece las dos salidas: aprobar una que esté en
borrador, o escribir una nueva.

Lo que pide, y todo es obligatorio: área, urgencia, el resultado principal, por
qué hace falta, qué pasa si no se contrata, por qué el equipo actual no puede
asumirlo, y **entre tres y cinco resultados esperados** con su indicador.
Menos de tres o más de cinco lo rechaza el backend.

Al crearla queda en `BORRADOR` y el mismo botón la aprueba: pasa a `ABIERTA`.

### 2 · La vacante, en borrador

**Panel · Vacantes → Crear vacante**

Se elige la solicitud que la respalda, el puesto del catálogo y el responsable.
El **puesto manda más de lo que parece**: su nivel decide qué evaluaciones
valen después.

Título y descripción son lo mínimo que ve quien postula. Modalidad, horario y
ubicación no son obligatorios, pero sin ellos la ficha de la vacante sale coja.

Queda en `BORRADOR`: **todavía no aparece en el portal**.

### 3 · Qué responderá quien postule

**Panel · la vacante → «Qué responderá quien postule»**

⚠️ **Este es el paso que bloquea la publicación**, y el que faltaba.

| Qué se elige | Es obligatorio |
|---|---|
| La evaluación del banco, encendida o apagada | — |
| Qué evaluación responderá | **Sí, si el banco está encendido** |
| Qué prueba del puesto rendirá | **Sí, salvo si la vacante rinde el cuestionario técnico** (paso 3a) |
| Qué pesos rigen la decisión | No: sin elegir, rigen los generales |

Solo se ofrecen las evaluaciones **publicadas y del nivel del puesto**. El
backend rechaza las de otro nivel, así que ofrecerlas sería dejar elegir algo
que va a fallar. Si la lista sale vacía, no hay ninguna publicada para ese
nivel y hay que crearla aparte.

Con las pruebas del puesto, la misma idea: **solo se ofrecen las versiones
publicadas**, porque asignar un borrador lo rechaza el backend. Si no hay
ninguna que valga, el cartel dice cuál de los tres motivos es —no se pudieron
cargar, no hay ninguna prueba escrita, o ninguna es de este puesto— y enlaza al
sitio donde se arregla, que desde el 31/08 existe (paso 0).

Mientras falte algo, el botón de publicar está apagado y dice qué falta.

Debajo de los desplegables hay una tarjeta más, **«La prueba técnica del
puesto»**, con el estado de su ficha y de su cuestionario y el enlace para
prepararla.

⚠️ **Desde el 30/08 esa tarjeta SÍ puede cerrar la puerta de publicar.** Si la
vacante eligió rendir el cuestionario técnico, publicar exige tenerlo publicado
—y entonces la versión de plantilla de prueba deja de exigirse—. Cuál de las
dos se pide lo decide el paso 3a.

### 3b · La prueba técnica del puesto

**Panel · la vacante → «Preparar la prueba técnica →»** (`/admin/vacantes/:id/prueba-tecnica`)

Es el método CAZATALENTOS: la prueba técnica no se escribe a mano, la escribe
la IA a partir de lo que cuenta el dueño del puesto, y el dueño la corrige y la
publica. Dos pasos en la misma página, en ese orden:

| Paso | Qué hace | Quién decide |
|---|---|---|
| **1 · La ficha del puesto** | Diez preguntas con las palabras del dueño (resultado, riesgo, día real, época dorada, estructura, autonomía, jefe directo, lo incómodo, requerimientos y —opcional— espejo), las dos cifras de gente, los **cuatro riesgos en orden de velocidad de daño**, hasta dos eliminatorias, hasta tres requerimientos y las familias F1–F7 | Se guarda con un botón, a medias las veces que haga falta. **COMPLETA lo decide el servidor**; el panel dice qué falta |
| **2 · El cuestionario técnico** | «Pedirle el cuestionario a la IA» (solo con la ficha completa). El servidor contesta 202 y el agente REDACTOR tarda uno o dos minutos: la página refresca sola unas cuantas veces y para. Llega un borrador por bloques —experiencia, riesgo 1, 2 y 3, requerimiento, dilema y, solo en DIR, la muestra de trabajo **presencial**— con la guía de calificación de cada pregunta | Se corrige pregunta a pregunta y se **publica**: hasta entonces ningún candidato lo ve. Publicar vuelve a pasar la aduana del servidor, y si no pasa se enseña la lista de lo que hay que corregir |

⚠️ **La pregunta presencial nunca se envía al candidato.** Se enseña marcada
para que el dueño la use en su entrevista.

⚠️ **Cada generación cuenta contra el tope de IA de la empresa.** Con una
generación ya en curso, o con la IA apagada, el servidor contesta
`encolada=false` y el panel lo dice sin pintarlo como avería.

La ficha, al guardarse con la cifra de gente, deriva el **tamaño** (MICRO ·
MEDIA · GRANDE) y sugiere la versión de pesos de la etapa 1 que le corresponde,
con un botón que la asigna a la vacante: es el mismo endpoint que el
desplegable de pesos del paso 3.

**Cuándo se hace:** el momento natural es con la vacante en borrador, antes de
publicarla. El backend no lo ata: se puede preparar con la vacante ya
publicada, porque nadie rinde el cuestionario hasta que se publique aquí.

### 3a · Qué se rinde en la etapa técnica, y en cuánto tiempo

**Panel · la vacante → «Qué responderá quien postule»**

La etapa **Prueba del puesto** se cumple de **dos formas, y cada vacante elige
una**. No conviven: lo decidió la clienta, y el cuestionario CAZATALENTOS no es
un añadido a la prueba de siempre sino su alternativa.

| Si elige… | El candidato rinde | Y para publicar hace falta |
|---|---|---|
| **La prueba del puesto** (por defecto) | El enunciado con sus entregables y su reloj | Una versión de plantilla de prueba elegida |
| **El cuestionario técnico** | Preguntas escritas para esa vacante, que se contestan escribiendo | El cuestionario publicado en el paso 3b |

Al elegir el cuestionario, **el desplegable de la prueba del puesto
desaparece**: dejarlo visible invita a configurar las dos y sugiere que
conviven. Y aparece la línea de **cuánto tiempo tendrá la etapa**, que se
guarda con su propio botón —solo sale cuando el número cambió—. En blanco rige
el tiempo que traiga el instrumento elegido.

⚠️ **Por defecto es la prueba del puesto, y no es una preferencia:** es lo que
hacían todas las vacantes que ya existían, y la migración se lo puso a todas
para que ninguna cambiara de comportamiento.

⚠️ **Se cambia mientras nadie haya rendido todavía, y ni un minuto más.** En
cuanto alguien está dentro, el instrumento y los minutos quedan quietos: el
backend lo frena y los minutos cuentan como parte de esa quietud. Mover el reloj
con gente contestando sería cambiarles el examen por debajo.

⚠️ **Escrito, ese número manda sobre el reloj del instrumento**, y hasta
convierte en cronometrada una prueba de plazo abierto. El mínimo son **cinco
minutos**: con uno, el servidor entregaría la prueba solo sesenta segundos
después de que el candidato la abra. Lo valida el backend y el panel lo dice
antes de intentarlo.

⚠️ **Con el cuestionario no se sube ningún archivo.** Es la diferencia que más
se nota para quien postula, y la pantalla se lo dice antes de empezar.

### 3c · El candidato rinde el cuestionario

**Portal · «Mis procesos» → «Abrir prueba técnica»**
(`/procesos/:uuid/prueba-tecnica`)

Cuando el equipo le avanza la etapa, quien postula ve **«Tu prueba técnica está
lista»** y, antes de abrirla, cuántas preguntas son, cuánto tiempo tiene y que
no hay nada que subir. **El reloj arranca al abrirla**, no al avanzarle la
etapa.

Una pregunta por pantalla, con «Anterior» y «Siguiente». Lo escrito se guarda
solo, y **no se da por guardado hasta que el servidor lo confirma**: hasta
entonces dice «Guardando lo que escribiste…». No deja entregar dejando alguna en
blanco, y entregar pregunta antes porque después ya no se toca.

Al entregar, el portal **lleva al detalle del proceso**, que pasa a decir
«Estamos calificando tu prueba · No tienes que hacer nada».

⚠️ **La pregunta presencial no está.** Para DIRECCION el REDACTOR escribe doce y
el candidato rinde once: la muestra de trabajo se hace en persona.

⚠️ **Los dos instrumentos comparten los mismos estados**, así que el estado por
sí solo no dice a qué pantalla llevarlo: hace falta saber qué rinde esa vacante.
Si ese dato no llega, se trata como la prueba de siempre.

### 3d · El equipo lo lee y le pone nota

**Panel · el ranking → pestaña «Prueba del puesto» → la fila de la persona**

Se abre su ficha y ahí está **«Lo que escribió en la prueba»**, pregunta por
pregunta, con la nota de cada respuesta y el porqué. Debajo, «Pedirle a la IA
que califique la prueba».

⚠️ **Aquí NO hay que ponderar, y con la prueba del puesto sí.** Con la prueba de
siempre alguien pulsa «Calcular la nota de la prueba» para que la nota de la
etapa nazca de la rúbrica. Con el cuestionario la calcula el propio método
—índice = puntos ÷ (4 × preguntas) × 100— y **llega hecha** a la columna del
ranking. Por eso ese botón no aparece: no hay rúbrica que ponderar.

⚠️ **Una respuesta sin un episodio concreto vale cero**, aunque cumpla los otros
criterios. Es la regla del método, no un fallo: si una nota baja sorprende, es lo
primero que hay que mirar.

⚠️ **El corte por índice sigue siendo manual.** Quién avanza lo decide el equipo,
como en las demás etapas.

### 4 · Requisitos indispensables

**Panel · la vacante → «Requisitos indispensables»**

Lo único que descarta sin que intervenga nadie. Se escriben como frases que se
responden con sí o no, no como casillas: una casilla se marca sin leer.

Quien postule y no confirme uno queda fuera en el acto, y no puede volver a
postular a esa vacante. Por eso conviene dejarlos en lo que de verdad es
indispensable.

### 5 · Publicar

**Panel · la vacante → «Publicar en el portal»**

Pasa a `PUBLICADA` y sale en la portada del portal el mismo instante.

---

## Lo que hace quien postula

### 6 · Encontrar la vacante y postular

**Portal · portada → ficha → postular**

Se ve sin cuenta. Postular sí la exige: entrar o crearla.

⚠️ **Crear la cuenta pide dónde vive, desde el 01/09/2026.** Un desplegable
obligatorio con las 196 provincias del Perú agrupadas por departamento, y «Fuera
del Perú» suelto al final. Se pregunta ahí y en ningún otro sitio: a quien ya
tenía cuenta no se le pide nunca, ni al postular ni después. Por eso las
postulaciones anteriores a esa fecha no traen ciudad, y el ranking cuenta con
ello en vez de fingir que la tiene.

En el formulario van los requisitos indispensables como preguntas de sí o no.
Responder «no» **no impide enviar**: la pantalla nombra los requisitos que dijo
no cumplir, avisa de que la postulación se cerrará de inmediato, y deja
elegir. La opción por defecto del aviso es volver y revisar.

Aquí vive **el único descarte automático de todo el sistema**.

### 7 · La evaluación

**Portal · Mis procesos → la postulación → «Responder la evaluación»**

Se abre cuando el estado es `EVALUACION_TURNO_CANDIDATO`. Una pregunta por
pantalla, con el mapa lateral de todas y su estado para poder saltarse una y
volver.

Ocho formas de responder: `PC`, abierta/`V`, `EF-4`, `SJT-R`, `SEC`, `INV`,
`DE` y `CD`.

Lo escrito **no sale de la cola hasta que el servidor lo confirma**, se
reintenta solo cada cinco segundos, y no se deja entregar mientras quede algo
sin guardar.

El plazo por defecto son **catorce días**, y desde el 31/08 los que quedan se
ven **también mientras se responde**, junto a «Pregunta 2 de 55». Antes estaban
solo en la portada: entre esa pantalla y el aviso de la última hora había dos
semanas en las que, para saber cuánto le quedaba, el candidato tenía que salir
del examen. Por debajo de la hora ese dato desaparece y lo sustituye la cuenta
atrás de «Queda poco plazo»: dos relojes a la vez, uno diciendo «hoy» y el otro
`00:42:17`, se leen peor que el segundo solo.

### 8 · La prueba del puesto

**Portal · Mis procesos → la postulación → «Hacer la prueba»**

**La hora la manda el servidor**: el cronómetro recalcula cuánto falta hasta la
hora de vencimiento del backend descontando el desfase entre relojes, así que
cambiar la hora del equipo no lo mueve.

⚠️ **Hay dos plazos y pueden regir A LA VEZ.** Los minutos los trae el
instrumento y empiezan a contar cuando el candidato abre la prueba; la fecha de
cierre la pone la convocatoria y es la misma para todos. Manda **el que caiga
antes**. Antes de empezar, la pantalla dice los dos y cuál acorta a cuál: decir
solo los minutos dejaba a quien abriera a las 17:40 con un cierre a las 18:00
leyendo noventa minutos cuando tenía veinte.

### 9 · La simulación

**Panel · Simulación** para crear las fechas · **Portal** para elegir una

El equipo crea sesiones con su fecha, duración, modalidad y cupo. Quien llega a
esa etapa elige la que le convenga.

⚠️ **El panel enseña cuántos se inscribieron, no quiénes.** El backend expone
solo el conteo; falta una ruta tipo
`GET /panel/sesiones-simulacion/{id}/inscripciones`. Inventar la lista sería
peor que no enseñarla.

### 10 · La validación

El periodo trabajando. La pantalla del portal existe y **no se enlaza desde
ningún sitio**: el backend no expone ni los días, ni el responsable, ni las
métricas, y enseñar «Día 6 de 15» inventado a quien de verdad está trabajando
esos días es peor que no enseñar nada.

### 11 · La decisión

Si sale ámbar —hay una duda que resolver antes de decidir—, el portal enseña el
formulario **entero y apagado**, y dice por qué antes de que nadie escriba: no
hay ruta para leer qué evidencia se pide ni para enviarla. Lo que sí funciona
es escribirle al equipo, y es lo que lleva el acento.

---

## Cómo el equipo mueve a la gente de etapa

**Panel · la vacante → «El ranking, etapa por etapa»**

El ranking **es la mesa donde se decide**, no un informe que se mira. Tiene
**cinco pestañas** —las cuatro etapas que puntúan y Decisión— y cada fila trae
la nota de la etapa elegida, adecuación, potencial, alertas y riesgos críticos.

A quién se mira lo eligen **tres cortes** con su cifra al lado: «Con nota del
perfil» —el rótulo lleva el nombre de la nota de cada etapa—, «Está aquí ahora»,
que deja la foto del presente, y «Toda la tanda». Fuera del perfil integral los
dos primeros casi no se solapan: quien está aquí ahora es quien **todavía no ha
rendido** —hay que perseguirlo— y quien tiene nota **ya pasó de largo** —con él
se decide—.

Al abrir una fila, la ficha es de la etapa: en Perfil integral (y en Decisión)
salen **las dos tablas** —el CV criterio a criterio y la evaluación del banco
con la nota, el porqué y la evidencia citada por la IA en cada respuesta
abierta—; en Prueba y Simulación, su rúbrica; en Validación, el periodo y sus
métricas.

1. Se marca la casilla de quienes avanzan.
2. Se escribe **un motivo**, obligatorio, que vale para toda la tanda.
3. «Marca a quienes avanzan» lo confirma uno por uno; si alguno falla, se
   cuenta y se dice.

Al pulsar una fila se abre su ficha **debajo de la propia fila**, no en otra
página: comparar es la razón de estar ahí, y perder la tabla para ver un
detalle rompe la comparación. Dentro va el perfil integral, con lo que la
calificación tuvo en cuenta y por qué.

### Ordenar la mesa (01/09/2026)

Cuatro cabeceras se pulsan: **Candidato**, **Ciudad**, la **nota** de la etapa y
**Pretensión**. Cada una tiene tres estados y se recorren pulsándola: primero el
sentido natural de la columna —la nota abre por la **mayor**, porque un ranking
es eso y recibir los ceros arriba obligaría a un segundo clic siempre; los
textos van de la A a la Z, y la pretensión de la más baja, que es la que cabe en
presupuesto—, luego el inverso, y al tercero **se vuelve al orden que mandó el
backend**, que es el que agrupa por prioridad y ordena la nota dentro de cada
grupo. Sin ese tercer estado habría que recargar la página para recuperarlo.

Todo esto pasa **en el navegador**: ordenar o filtrar no le vuelve a pedir nada
al servidor.

⚠️ **Cuando se ordena por una columna, manda esa columna y nada más.** El orden
es plano. Hubo una versión que ordenaba la nota **dentro** de cada grupo de
prioridad y se quitó: con cuatro filas saliendo 55, 74, 61, 95 la mesa se lee
como rota, y la etiqueta del grupo dentro de la celda del candidato no bastaba
para explicarlo. Un orden que hay que explicar no está ordenando. Y agrupar casi
nunca cambiaba nada, porque los grupos que la IA escribe cuelgan de la propia
nota.

**El grupo de prioridad se sigue pintando en cada fila.** Ya no mueve a nadie,
pero que alguien llegue a un 95 arrastrando un riesgo crítico es justo lo que hay
que ver antes de llamarlo, y el número solo no lo dice. Es del panel: **al
candidato no se le enseña nunca**, ni ahí ni en ningún sitio.

**Los vacíos van al final, suba o baje el orden.** La ausencia se decide antes de
aplicar el sentido; invertir la comparación entera llenaría la primera pantalla
de filas sin dato justo al pulsar «de mayor a menor».

### Filtrar sin perder el corte (01/09/2026)

Encima de la tabla, y conviviendo con los tres cortes de la botonera:

| Filtro | Qué hace |
|---|---|
| **Buscar por nombre** | Compara **sin tildes ni mayúsculas**: media tanda se llama Fátima, Lucía o Muñoz, y quien teclea `fatima` en un buscador que compara literales no encuentra a nadie y concluye que la caja está rota |
| **Ciudad** | Las que de verdad hay en la tanda, con cuántas trae cada una, y se marcan varias. **Salen de las filas, nunca del catálogo de ubigeo**: servirlo del catálogo ofrecería 196 filtros que no devuelven a nadie |
| **Nota** | Desde–hasta, sobre la nota de la etapa que se está mirando |
| **Pretensión** | Desde–hasta. Sale quien pida algo dentro de esa banda |

⚠️ **Un rango deja fuera a quien no declaró el dato, y es a propósito.** Una fila
sin nota no es «≥ 60», y una sin pretensión no cabe en ninguna banda; colarlas
por si acaso llenaría de huecos justo la lista que se pidió recortar. La pantalla
lo dice debajo de cada rango, y vuelven quitando el filtro, que es un clic: «Ver
a todos».

Con cualquier filtro puesto, la pantalla dice **cuántas se ven de cuántas** de
ese corte. Ocultar sin decirlo es el indicador que miente.

### Dos columnas nuevas, y cuándo no se pintan (01/09/2026)

**Ciudad** y **Pretensión** van pegadas al candidato, porque es lo que se lee
junto al decidir a quién llamar. La pretensión **no es un dato nuevo** —vive en
el perfil del candidato desde antes—: nueva es la columna que la trae a la mesa.

⚠️ **Si ninguna fila trae una de las dos, esa columna no se pinta y se explica
por qué** — y no es el mismo motivo en las dos:

- **Ciudad:** todavía no hay ninguna en la tanda, porque solo se le pide a quien
  crea su cuenta desde ahora y ninguna postulación anterior la trae.
- **Pretensión:** o ninguno de estos candidatos la declaró, **o quien mira no
  puede verla**. Viaja con el permiso `ver_pretension`, que solo tiene Dirección,
  para que el sueldo no pese al calificar. El nulo por sí solo no separa los dos
  casos, así que el backend manda además si se pudo consultar: sin esa señal la
  frase tendría que nombrar los dos motivos sin afirmar ninguno, y una pantalla
  que enumera hipótesis no está informando.

Una columna entera de guiones no es una columna: es una promesa incumplida que
además se lee al revés, «nadie pidió sueldo».

### La hoja de Excel (01/09/2026)

**Panel · el ranking → «Descargar Excel (n)»**

Solo en **Perfil integral** y **Prueba del puesto**: son las dos etapas con
rúbrica que sostienen una hoja de detalle, y en las otras tres el botón **no
existe**, en vez de salir y fallar con un 400. Ofrecer una descarga que el
servidor va a rechazar es peor que no ofrecerla.

La hoja lleva **exactamente las filas que se están viendo, y en el orden de la
pantalla**: el panel manda la lista de ids ya ordenada y el backend escribe en
ese orden y nada más. Por eso el botón dice cuántas van y la línea de debajo lo
repite mientras haya un filtro puesto.

⚠️ **Dentro va de qué recorte salió**: la etapa, el corte de la botonera, cada
filtro con su valor, el orden aplicado y —si la columna de pretensión salió
vacía— por qué. Es donde más falta hace: la hoja se descarga, se reenvía y se
abre lejos del panel, donde ya no hay ninguna pantalla que pueda explicar que un
blanco ahí puede ser un permiso y no un candidato que no pidió sueldo.

---

## Configuración

**Panel · Configuración**

| Bloque | Qué hace |
|---|---|
| Parámetros | Editar los del proceso. **Exige motivo**: queda auditado |
| Banco de preguntas | Subir un Excel con su nivel y su etiqueta |
| Áreas | La estructura de la empresa: crear, renombrar, retirar, reactivar y borrar (paso 0) |
| Equipo | Quién tiene acceso, y en qué área está cada quien |
| Permisos | El reparto de permisos por rol |
| Solo lectura | Las plantillas **de evaluación** y las versiones de pesos que existen |

Las áreas van justo antes del equipo, y no es cosmética: un área es dónde
trabaja alguien, así que la tabla del equipo no se entiende sin haber visto esa
lista.

⚠️ **Las pruebas del puesto NO están aquí**, aunque suenen a configuración:
tienen pestaña propia en el panel (`/admin/pruebas`, paso 0). Lo que sigue en
solo lectura son las plantillas de **evaluación**, que se editan por un flujo
propio que todavía no está en el panel.

---

## Los huecos del backend que se notan

| Qué falta | Dónde se nota |
|---|---|
| `GET /panel/sesiones-simulacion/{id}/inscripciones` | Simulación enseña el conteo, no los nombres |
| Las rutas de la decisión ámbar y de la validación | Las dos pantallas del portal están completas y no se pueden conectar |

Y uno más, que no es una ruta: `GET /panel/bandeja` devuelve 500 en el backend
local.

---

## Comprobarlo entero

```bash
npx playwright test herramientas/e2e/14-vacante.spec.ts
```

Abre un Chrome de verdad y recorre los pasos 1 a 5, comprueba que la vacante
sale en la portada del portal, y **la cierra al terminar**: una vacante
publicada la ve cualquiera que entre, y no hay forma de borrarla. Deja las
capturas en `capturas/`.

```bash
npx playwright test herramientas/e2e/17-prueba-tecnica.spec.ts
npx playwright test herramientas/e2e/17-prueba-tecnica.spec.ts
```

El paso 3b: una vacante en borrador, la tarjeta, la ficha rellenada hasta que
el servidor la declara COMPLETA y deriva el tamaño. **Sin `DE_VERDAD=1` no le
pide nada a la IA** —cuesta una llamada al modelo y cuenta contra el tope— y
lo dice; con él sigue hasta corregir una pregunta y publicar el cuestionario.

```bash
npx playwright test herramientas/e2e/16-cuestionario-tecnico.spec.ts
```

Los pasos **3a, 3c y 3d de una tirada**: la empresa elige el cuestionario y su
tiempo, la IA lo escribe, la vacante se publica, una candidata se registra,
postula, el equipo la avanza, ella contesta y entrega, y el panel lo lee con
nota. Es el recorrido que no existía en ningún sitio.

⚠️ **Gasta DOS llamadas al modelo**, el REDACTOR y el EVALUADOR_TECNICO.
`PARAR_EN=10` corta justo antes de la primera y deja ejercitado todo el panel
gratis; `CONTINUAR=1` y `DESDE_CALIFICAR=1` retoman una corrida a medias sin
volver a pagar lo ya escrito.

⚠️ **Necesita una vacante recién creada en BORRADOR** —afirma el estado de
salida, así que una segunda corrida sobre la misma falla— y **su propia base y
su propio vhost de RabbitMQ**: compartir el broker con otro backend le roba los
mensajes de la IA.

⚠️ **Escribe en la base local**, así que hace falta el Spring en `localhost:8081`
y `API_URL=http://localhost:8081` en `.env.local`. Nunca contra producción.

```bash
npx playwright test herramientas/e2e/15-componer-prueba.spec.ts
```

**Escribir una prueba del puesto desde cero**, que es lo que hasta el 31/08 no
se podía hacer desde ninguna pantalla. Crea la plantilla, compone su primera
versión entera —datos y tiempos, el enunciado escrito y subido como PDF, la
guía para la IA, once preguntas, dos entregables, la rúbrica y dos variantes
del cambio inesperado—, intenta publicarla hasta que el servidor deja, y
comprueba que la versión publicada aparece en el desplegable de una vacante y
que la que quedó en borrador **no**.

Es la única prueba que ejercita los quince endpoints de edición y borrado: las
pantallas se probaron contra `backend-simulado.mjs`, que contesta `{ok:true}` a
todo lo que no sea GET, así que ningún guardado real se había visto.

⚠️ **No le pide nada a la IA**: no hay coste ni cola de por medio.

⚠️ **Deja rastro que no se puede borrar**: una plantilla nueva por corrida (el
nombre lleva la hora), una versión suya **publicada** —y publicar congela: no
existe «despublicar»— y otra en borrador. No toca ninguna vacante: la del paso
final solo se mira.

⚠️ **Antes de abrir el navegador comprueba con quién habla.** El 8080 suele ser
Adminer y contesta 200 a todo: apuntar ahí da una e2e que «pasa» sin probar
nada. El paso 0 exige un 401 con JSON y se corta si no lo ve.

Variables: `PORTAL`, `PAUSA`, `DEV_ID`, `VACANTE` (el título de la vacante donde
se mira el desplegable; tiene que rendir la prueba del puesto) y `PUESTO` (en
blanco escribe una prueba genérica, que es lo que hace que la vacante la
ofrezca sea cual sea su puesto).

**Lo que hace falta levantado.** Lo normal es lo de siempre —el Spring en
`localhost:8081` y este portal en el 5174— y entonces `PORTAL` sobra. Los
números del ejemplo de arriba (8091 y 5199) son los de *un* worktree con el
8081 ya ocupado por el backend de otro; no son los del proyecto. Lo que no
cambia de un sitio a otro son tres reglas:

- **`API_URL` de `.env.local` tiene que apuntar a donde esté el backend de
  verdad**, sea el puerto que sea. El proxy de Vite se va al **8080** por
  defecto, y ahí suele estar **Adminer**, que contesta 200 a todo: apuntar mal
  no da un error, da una e2e que pasa sin probar nada. El paso 0 lo caza.
- **`PORTAL` tiene que ser el puerto de este portal**, no el del backend.
- **La base tiene que ser propia del worktree** cuando hay más de uno vivo.
  `renaser_db` la comparten todos, y dos ramas pueden traer migraciones con el
  mismo número: la primera que arranca deja a la otra sin poder migrar. Se clona
  con `docker exec renaser-postgres createdb -U postgres -T renaser_db <nombre>`
  y se apunta ahí con `spring.datasource.url`.

⚠️ **Al terminar, node no se cierra**: el navegador queda abierto a propósito
para poder mirar la prueba escrita, igual que en las demás e2e de esta familia.
