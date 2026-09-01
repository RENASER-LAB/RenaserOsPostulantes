# Analisis del portal del candidato

Punto de partida para construir el front en React
Version 1.0 · 2026-08-19

Este documento desarma el mockup `portal-candidato.html` del backend
(`ai-agents--spring-ai/docs/mockups/`) y lo compara con lo que el backend ya expone.
Sirve para saber que se copia tal cual, que se corrige y que falta inventar.

---

## Que es el mockup

Un solo archivo HTML de 52 KB: estilos, estructura y logica juntos. No usa ninguna
libreria. Funciona asi:

- **Ruta por hash.** `#jobs`, `#job/dev`, `#evaluation/app-dev`. Un `hashchange` vuelve a
  pintar todo el `<main>`.
- **Render por plantilla.** Cada vista es una funcion que devuelve un texto con HTML
  dentro. Se asigna a `innerHTML` y despues otra funcion engancha los eventos a mano.
- **Estado en localStorage.** Una sola clave. No hay servidor: las vacantes y las
  preguntas estan escritas dentro del archivo.

Es una demostracion para enseñar el recorrido, no un prototipo tecnico. La logica de
negocio si vale; la forma de programarla no se reaprovecha.

---

## Las nueve pantallas

| Ruta | Que hace | Necesita cuenta |
|---|---|:--:|
| `#jobs` | Portada con las vacantes abiertas | No |
| `#job/:id` | Ficha de la vacante y las etapas del proceso | No |
| `#register/:id` | Crear cuenta y aceptar el tratamiento de datos | No |
| `#apply/:id` | Subir CV, enlaces y el resultado del que se siente orgulloso | Si |
| `#dashboard` | Mis procesos, con la siguiente accion arriba | Si |
| `#evaluation/:app` | Evaluacion, una pregunta por pantalla | Si |
| `#challenge/:app` | Prueba del puesto cronometrada | Si |
| `#simulation/:app` | Elegir fecha, y luego la agenda de la sesion | Si |
| `#status/:app` | Estado o resultado de una postulacion | Si |

Fuera de la zona que cambia hay tres piezas fijas: la cabecera con marca, navegacion y
cambio de tema; un modal generico (titulo, cuerpo, pie) que se reutiliza para todo; y un
aviso flotante que dura 2,5 segundos.

**No hay pantalla de ingreso.** Entrar es un modal. Y el boton de cuenta cambia de
funcion: si no hay sesion abre ese modal, si la hay abre las opciones de privacidad.

---

## Como decide el portal que mostrar

Toda la inteligencia del panel esta en una funcion de siete lineas, `actionFor`. Recibe
la postulacion, mira su numero de etapa y devuelve tres cosas: el texto del boton, el
titulo de la accion y una linea de ayuda.

| Etapa | Titulo | Boton | Lleva a |
|:--:|---|---|---|
| 1 | Tienes una evaluacion pendiente | Continuar evaluacion | `#evaluation/:app` |
| 2 | Prueba del puesto habilitada | Abrir prueba | `#challenge/:app` |
| 3 | Confirma tu simulacion | Elegir fecha | `#simulation/:app` |
| 4 | Validacion en curso | Ver estado | `#status/:app` |
| 5 o mas | Proceso finalizado | Ver resultado | `#status/:app` |

Esta tabla es **el corazon del portal** y hay que rehacerla entera, porque el backend no
trabaja con numeros de etapa sino con dieciocho estados con nombre. Mas abajo.

El panel la usa dos veces: para el recuadro negro de arriba —la primera postulacion que
este entre la etapa 1 y la 4— y para el pie de cada tarjeta de proceso.

---

## Las reglas que si valen

Estas salieron del mockup y hay que conservarlas.

**Acceso.** Las cinco pantallas privadas comprueban la sesion y, si no hay, devuelven la
misma tarjeta de «Ingresa para ver tu proceso». Es un guardia unico, no un desvio.

**Postular.** El boton de la ficha lleva al formulario si hay cuenta y a crearla si no.
Registrarse y postular son dos pasos encadenados, no uno.

**Crear cuenta.** No deja seguir si falta el nombre, si el correo no tiene arroba, si la
contraseña baja de 8 caracteres, si las dos no coinciden o si no se marca el
consentimiento.

**Postulacion.** Exige CV y el texto del resultado del que se siente orgulloso. Los tres
enlaces (portafolio, LinkedIn, GitHub) son opcionales.

**Evaluacion.** Una pregunta por pantalla, se guarda sola al responder, y avisa en
negrita que **no se puede volver atras**. No deja continuar con la respuesta vacia. Al
acabar la ultima pregunta mueve la postulacion a la prueba.

**Prueba.** Pide confirmar en un modal antes de empezar, porque el cronometro no se
detiene ni cerrando el navegador. A mitad de camino aparece un **cambio inesperado** con
minutos extra. Para entregar obliga a escribir una autocritica: donde podria fallar tu
solucion. Y deja claro que usar IA esta permitido, pero pregunta que se verifico.

**Simulacion.** Elegir entre fechas con cupo. Ya confirmada, enseña los seis tramos de la
sesion con su duracion, que llevar y que va a pasar.

**Estado final.** Tres mensajes distintos a proposito: retirada, no continua, y
validacion en curso. Al que no continua se le agradece; al que se retiro se le explica
que retirarse no borra sus datos.

**Privacidad.** Un solo modal con tres cosas distintas: retirar una postulacion, pedir el
borrado de datos y (solo en la demo) restablecerla.

---

## Donde el mockup y el backend no coinciden

El backend ya tiene el portal montado en `/api/v1/portal`, con veinte rutas repartidas en
cuatro controladores. El mockup se escribio antes y arrastra un modelo viejo. Esto es lo
que cambia.

### 1. Las etapas no son las mismas

El mockup enseña cinco: **CV · Evaluacion · Prueba · Simulacion · Validacion**.

El backend junta el curriculum, el modulo psicometrico y la evaluacion en una sola etapa
—el **Perfil Integral**— y añade **Decision** al final:

**Perfil Integral · Prueba · Simulacion · Validacion · Decision**

La barra de progreso, las etiquetas y la ficha de la vacante estan mal. Hay que
reescribirlas.

### 2. Los estados son otros

| Mockup | Backend |
|---|---|
| un numero de etapa del 0 al 5 | 18 estados con nombre, `ETAPA_MOMENTO` |
| `CV_CALIFICANDO` | `POSTULADA` y `PERFIL_CALIFICANDO` |
| `EVALUACION_EN_CURSO` | `PERFIL_TURNO_CANDIDATO` |
| `PRUEBA_PENDIENTE` | `PRUEBA_TURNO_CANDIDATO` |
| `VALIDACION_EN_CURSO` | `VALIDACION_TURNO_CANDIDATO` |
| `NO_CONTINUA` y `CERRADA` sin motivo | los dos con motivo obligatorio |

Cada estado del backend dice **de quien se espera algo**. Para el candidato eso se
traduce en una regla simple:

- Acaba en `TURNO_CANDIDATO` → hay boton, le toca a el.
- Acaba en `CALIFICANDO`, `POR_HABILITAR` o `POR_CONFIRMAR` → solo se informa y se espera.

Esa regla sustituye a `actionFor` y aguanta mejor, porque no hay que tocarla cuando el
backend añada un estado.

### 3. Falta una pantalla entera

El estado `DECISION_TURNO_CANDIDATO` existe en el backend y **no tiene pantalla en el
mockup**. Es el caso ambar: la decision quedo en duda y se le pide al candidato una
evidencia adicional dirigida a esa duda concreta. Puede repetirse hasta dos veces.

Hay que diseñarla desde cero.

### 4. La evaluacion funciona distinto

| Mockup | Backend |
|---|---|
| 3 preguntas escritas en el archivo | devuelve **todas** de golpe, con su posicion |
| No se puede volver atras | acepta guardar cualquier pregunta, en cualquier orden |
| Avance falso: empieza en 47 y tope del 98 % | total y respondidas reales |
| Solo el enunciado | ademas la situacion del caso, y opciones con su identificador |
| Sin fecha limite | trae cuando vence |

Que el backend deje volver atras no obliga a permitirlo en pantalla. Es una decision de
producto.

### 5. El cronometro no puede ser del navegador

El mockup calcula el tiempo restando la hora local a la hora guardada. Se falsea
cambiando la hora del equipo.

El backend manda cuando empezo y cuando vence. El front tiene que medir una vez la
diferencia entre su reloj y el del servidor, y descontarla siempre. Cuando el tiempo
llega a cero, el servidor entrega solo lo que haya.

### 6. Los entregables son varios, no uno

El mockup tiene un enlace y un archivo sueltos. El backend define una lista de
entregables requeridos, cada uno con su nombre, formato, si es obligatorio y si ya se
entrego. Y son dos rutas distintas: una para archivo, otra para enlace.

Ademas la prueba del backend tambien trae **preguntas**, que el mockup ignora del todo.

### 7. Cosas sueltas del formulario

- Crear cuenta pide **nombre y apellidos por separado**.
- Son **dos consentimientos**, no uno: aceptar el proceso (obligatorio) y aceptar futuros
  contactos (opcional). Y se retiran por rutas distintas.
- La vacante trae **requisitos objetivos** que el candidato confirma al postular. En el
  mockup no existen.
- Las fechas de simulacion vienen del servidor con sus plazas libres, no escritas a mano.
- La validacion no dura siete dias fijos: se configura por vacante.

### 8. Lo que el mockup se inventa

- La duracion de la prueba y el minuto del cambio los guarda en la vacante. En el backend
  viven en la plantilla de la prueba.
  ⚠️ **Esto ya no es del todo cierto.** La vacante tiene sus propios minutos de etapa
  tecnica, y cuando estan escritos **mandan sobre los de la plantilla** —hasta convierten en
  cronometrada una prueba de plazo abierto—; el minimo son cinco. O sea que el mockup
  acertaba a medias. El minuto del cambio inesperado si sigue viviendo solo en la plantilla.
- La lista de postulaciones trae el **grupo de prioridad**. Es la clasificacion interna
  del equipo. **No deberia enseñarse al candidato.**
- El detalle de una postulacion trae su historial real. El mockup dibuja una linea de
  tiempo inventada; se puede pintar la de verdad.

---

## Lo que el backend ya ofrece

Todo bajo `/api/v1/portal`. Identidad con la cabecera `Authorization: Bearer`.

**Publico, sin token**

| Metodo | Ruta | Devuelve |
|---|---|---|
| GET | `/vacantes` | la lista de vacantes abiertas |
| GET | `/vacantes/{id}` | una vacante con sus requisitos objetivos |
| GET | `/consentimientos/textos` | los textos legales vigentes |
| POST | `/cuentas` | crea la cuenta y guarda los consentimientos |
| POST | `/auth/login` | el token y el identificador del usuario |

**Postulaciones**

| Metodo | Ruta | Nota |
|---|---|---|
| POST | `/postulaciones` | multipart: CV, enlaces, requisitos confirmados |
| GET | `/postulaciones` | estado y dias sin cambio de cada una |
| GET | `/postulaciones/{uuid}` | añade el historial |
| POST | `/postulaciones/{uuid}/retiro` | retirar |
| POST | `/consentimientos/futuros/retiro` | cosa distinta de retirar |
| POST | `/solicitudes-borrado` | tercera cosa distinta |

**Evaluacion, prueba y simulacion**

| Metodo | Ruta |
|---|---|
| GET · POST | `/evaluacion/{uuid}` · `/evaluacion/{uuid}/inicio` |
| PUT | `/evaluacion/{uuid}/respuestas/{preguntaId}` |
| POST | `/evaluacion/{uuid}/entrega` |
| GET · POST | `/prueba/{uuid}` · `/prueba/{uuid}/inicio` |
| PUT | `/prueba/{uuid}/respuestas/{preguntaId}` |
| POST | `/prueba/{uuid}/entregables/{id}/archivo` y `/enlace` |
| POST | `/prueba/{uuid}/entrega` |
| GET | `/simulacion/{uuid}/sesiones` · `/simulacion/{uuid}` |
| POST | `/simulacion/{uuid}/sesiones/{sesionId}` |

No falta ninguna ruta para las ocho pantallas que ya existen. La de decision ambar habria
que revisarla cuando toque.

---

## Lo que si se copia del mockup

El diseño visual esta terminado y es coherente. Se pasa tal cual:

- **Los colores como variables CSS.** El fondo, las superficies, la tinta, la linea, y el
  semaforo verde / ambar / rojo / informativo. El tema oscuro ya esta resuelto con un
  atributo en la etiqueta raiz: solo redefine las variables.
- **La escala de espacios**, de 4 a 32 pixeles.
- **Los dos cortes de pantalla**: 900 y 680 pixeles.
- **Los componentes**: tarjeta, etiqueta, boton, campo, aviso, barra de pasos, tarjeta de
  cronometro, opcion de fecha y el recuadro negro de siguiente accion.

No hay que rehacer el diseño. Hay que reorganizarlo en componentes.

---

## Como se traduce a React

**Carpetas por funcionalidad**, no por tipo de archivo. Cada una se lleva su pantalla,
sus llamadas y sus piezas.

```
src/
  app/            arranque, rutas, tema, sesion
  api/            un archivo por controlador del backend
  dominio/        los 18 estados y la tabla de que le toca al candidato
  ui/             tarjeta, boton, campo, modal, aviso, barra de pasos
  paginas/
    vacantes/     portada y ficha
    cuenta/       crear cuenta e ingresar
    postular/     el formulario con el CV
    procesos/     el panel
    evaluacion/
    prueba/
    simulacion/
    decision/     la pantalla que falta
    estado/
    privacidad/
  estilos/        las variables del mockup
```

**Tres decisiones que sostienen todo lo demas**

1. **Una sola tabla de estados.** Un archivo en `dominio/` que, dado el estado que manda
   el backend, devuelva cuatro cosas: en que etapa pintar la barra, que titulo poner, que
   boton mostrar y a donde lleva. Todo lo demas lee de ahi. Si el backend añade un
   estado, se toca un solo sitio.

2. **El servidor manda la hora.** El cronometro se calcula desde la fecha de vencimiento
   que da el backend, corrigiendo la diferencia con el reloj local.

3. **Los estados en `CALIFICANDO` se consultan solos.** Mientras la IA califica no hay
   nada que hacer, pero la pantalla tiene que enterarse cuando acabe. Eso pide una capa
   de datos con reintento y consulta periodica, no llamadas sueltas.

---

# Documentos relacionados

| Documento | Donde esta |
|---|---|
| Estados de la postulacion | `ai-agents--spring-ai/docs/03-ESTADOS-POSTULACION.md` |
| APIs | `ai-agents--spring-ai/docs/09-APIS.md` |
| Inventario de pantallas | `ai-agents--spring-ai/docs/06-INVENTARIO-DE-PANTALLAS-MOCKUPS.md` |
| El mockup | `ai-agents--spring-ai/docs/mockups/portal-candidato.html` |
