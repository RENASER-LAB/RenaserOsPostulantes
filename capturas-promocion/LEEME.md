# Capturas de promoción

El sistema entero, en orden de recorrido, con datos inventados.

Se generan con `node herramientas/capturar-promocion.mjs` y el portal corriendo
en el 5174 (`npm run dev`). Cada imagen sale en dos anchos: **escritorio**
(1440 px) y **móvil** (390 px), las dos a densidad 2, así que se pueden ampliar
sin que el texto se vea blando.

⚠️ **Nada de esto es real y nada salió de una base de datos.** El script
contesta él mismo todas las peticiones del portal; no habla con ningún backend,
ni el desplegado ni el local ni ninguna copia en Docker. Los nombres, las
empresas, las notas y los correos son inventados. Se puede publicar sin revisar
si hay datos de alguien dentro, porque no los hay.

## El orden

La numeración es el recorrido, así que el orden del explorador de archivos es el
orden en el que se cuenta la historia: **Lucía Mendoza Ríos, analista de
procesos de Arequipa, postula a Analista de Datos en Clínica San Juan**, y el
equipo de esa empresa la mira desde el panel. Es la misma persona y la misma
vacante en las treinta y tres pantallas.

### Lo que ve quien busca trabajo

| | Pantalla | Qué enseña |
|---|---|---|
| 01 | Portada | Las vacantes abiertas de varias empresas |
| 02 | La vacante | Propósito, lo que hará y lo que se busca |
| 03 | Crear cuenta | El alta, con la provincia donde vive |
| 04 | Ingresar | La entrada, con la contraseña que se puede mirar |
| 05 | Postular | El currículum y los requisitos, que son preguntas |
| 06 | Mis procesos | Cuatro postulaciones, cada una con su recorrido |
| 07 | Un proceso | El detalle, con las fechas de cada etapa |
| 08 | Mi perfil | Identidad, trayectoria, currículum y diplomas |
| 09 | Evaluación · antes | Lo que hay que saber antes de empezar |
| 10 | Evaluación · pregunta | Una pregunta por pantalla |
| 11 | Evaluación · escala | Calificar de 1 a 5 una situación |
| 12 | Evaluación · ordenar | Poner cinco pasos en orden |
| 13 | Evaluación · mapa | Las dieciocho, con lo que falta |
| 14 | Prueba · antes | El encargo y el plazo |
| 15 | Prueba · en curso | Cronómetro, respuestas y entregables |
| 16 | Cuestionario técnico | La otra forma de la etapa técnica |
| 17 | Simulación · elegir | Las fechas disponibles |
| 18 | Simulación · reservada | La sesión, con su agenda minuto a minuto |
| 19 | Validación | El periodo trabajando de verdad |
| 20 | Decisión | La última conversación |
| 21 | Privacidad | Retirarse, salir del radar, pedir el borrado |
| 22 | Política de privacidad | La que se lee sin cuenta |

### Lo que ve el equipo que contrata

| | Pantalla | Qué enseña |
|---|---|---|
| 23 | Entrar al panel | La entrada del equipo |
| 24 | Vacantes | Las cuatro, con su estado |
| 25 | Una vacante | El embudo y el ranking, etapa por etapa |
| 26 | Ficha · perfil integral | Lo que la IA leyó del currículum, con su evidencia |
| 27 | Ficha · prueba | La rúbrica criterio a criterio, lo entregado y lo escrito |
| 28 | Simulación | Las sesiones con su cupo |
| 29 | Inscritos | Quién viene, y pasar lista |
| 30 | Pruebas | Las plantillas y sus versiones |
| 31 | Configuración | Parámetros, banco, equipo y áreas |
| 32 | Banco de preguntas | Una versión abierta, con lo que contiene |
| 33 | Permisos | El reparto de un rol, permiso a permiso |

## Recortar solo unas pocas

    node herramientas/capturar-promocion.mjs --solo candidato
    node herramientas/capturar-promocion.mjs --solo panel
    node herramientas/capturar-promocion.mjs --solo 06,08,25
    node herramientas/capturar-promocion.mjs --escritorio

## Si algo hay que cambiar

Los datos viven en `herramientas/datos-promocion.mjs`, todos juntos. Cambiar el
nombre de la candidata, las notas o las empresas es cambiar ese archivo y volver
a correr el script.
