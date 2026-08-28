# De la solicitud a la decisión: el proceso entero

Última actualización: 2026-08-25

**Los pasos 1 a 5 están corridos** contra el backend local con
`herramientas/e2e-vacante.mjs`. Del 6 en adelante, lo que hay aquí está leído del
código y de los tests, no de una ejecución.

Los dos lados a la vez: qué hace el equipo en el panel y qué ve quien postula.
Cada paso dice **dónde** se hace y **qué lo desbloquea**, porque casi todos los
atascos del sistema son un requisito que el backend exige y nadie había dicho.

---

## Antes de que exista la vacante

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
| Qué prueba del puesto rendirá | **Sí, siempre** |
| Qué pesos rigen la decisión | No: sin elegir, rigen los generales |

Solo se ofrecen las evaluaciones **publicadas y del nivel del puesto**. El
backend rechaza las de otro nivel, así que ofrecerlas sería dejar elegir algo
que va a fallar. Si la lista sale vacía, no hay ninguna publicada para ese
nivel y hay que crearla aparte.

Mientras falte algo, el botón de publicar está apagado y dice qué falta.

Debajo de los desplegables hay una tarjeta más, **«La prueba técnica del
puesto»**, con el estado de su ficha y de su cuestionario y el enlace para
prepararla. No entra en la puerta de publicar: el backend no lo exige.

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
publicada, porque nadie rinde el cuestionario hasta que se publique aquí —y la
rendición es del ciclo siguiente.

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

### 8 · La prueba del puesto

**Portal · Mis procesos → la postulación → «Hacer la prueba»**

En sus dos formas: la corta con cronómetro y la larga con plazo de días. **La
hora la manda el servidor**: el cronómetro recalcula cuánto falta hasta la hora
de vencimiento del backend descontando el desfase entre relojes, así que
cambiar la hora del equipo no lo mueve.

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
El filtro «Solo quienes están aquí ahora» deja la foto del presente, y dice
cuántas filas oculta.

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

---

## Configuración

**Panel · Configuración**

| Bloque | Qué hace |
|---|---|
| Parámetros | Editar los del proceso. **Exige motivo**: queda auditado |
| Banco de preguntas | Subir un Excel con su nivel y su etiqueta |
| Equipo | Quién tiene acceso |
| Solo lectura | Las plantillas y las versiones de pesos que existen |

---

## Los tres huecos del backend que se notan

| Qué falta | Dónde se nota |
|---|---|
| `GET /plantillas-prueba/{id}/versiones` | El panel tantea los ids en orden y deja 404 en la consola. La función `listarVersionesPrueba` se borra el día que exista la ruta |
| `GET /panel/sesiones-simulacion/{id}/inscripciones` | Simulación enseña el conteo, no los nombres |
| Las rutas de la decisión ámbar y de la validación | Las dos pantallas del portal están completas y no se pueden conectar |

Y uno más, que no es una ruta: `GET /panel/bandeja` devuelve 500 en el backend
local.

---

## Comprobarlo entero

```bash
node herramientas/e2e-vacante.mjs
```

Abre un Chrome de verdad y recorre los pasos 1 a 5, comprueba que la vacante
sale en la portada del portal, y **la cierra al terminar**: una vacante
publicada la ve cualquiera que entre, y no hay forma de borrarla. Deja las
capturas en `capturas/`.

```bash
node herramientas/e2e-prueba-tecnica.mjs
DE_VERDAD=1 node herramientas/e2e-prueba-tecnica.mjs
```

El paso 3b: una vacante en borrador, la tarjeta, la ficha rellenada hasta que
el servidor la declara COMPLETA y deriva el tamaño. **Sin `DE_VERDAD=1` no le
pide nada a la IA** —cuesta una llamada al modelo y cuenta contra el tope— y
lo dice; con él sigue hasta corregir una pregunta y publicar el cuestionario.

⚠️ **Escribe en la base local**, así que hace falta el Spring en `localhost:8081`
y `API_URL=http://localhost:8081` en `.env.local`. Nunca contra producción.
