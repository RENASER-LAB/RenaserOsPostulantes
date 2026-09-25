# Lo que falta, y no es diseño

Huecos conocidos del sistema: rutas que el backend no tiene, promesas que hoy no se cumplen y
rastros de pruebas que quedaron en la base real.

⚠️ **Extraído del CLAUDE.md del 07/09/2026, y ninguna línea se ha vuelto a comprobar desde
entonces.** Varias llevaban ya semanas escritas cuando se movieron aquí. Verificar contra el
código antes de darlas por ciertas.

---

## Lo que falta, y no es diseño

| Qué | Estado |
|---|---|
| **Decisión ámbar** | `DECISION_TURNO_CANDIDATO` existe, pero **no hay ruta** para leer qué evidencia se pide ni para enviarla. La pantalla está entera y el formulario, apagado |
| **Validación** | Tampoco hay ruta: ni días, ni responsable, ni métricas. La pantalla existe y **no se enlaza** hasta que las haya |
| **Si el consentimiento de futuras vacantes está activo** | Solo hay ruta para retirarlo, no para leerlo. Por eso privacidad no enseña ninguna etiqueta de «lo tienes activado» |
| **Saber cómo se llama el candidato** | El backend solo devuelve `{ token, usuarioId }` al entrar. Quien entre desde otro navegador verá el portal sin su nombre |
| **Cuántas preguntas tendrá la evaluación** | El backend arma el orden dentro de `iniciar()`, así que antes devuelve `total: 0`. La portada ya no lo pinta. Cuando `pintar()` sepa contarlas sin armarlas, la cifra vuelve sola |
| **El correo no sale** | El backend tiene `renaser.correo.transporte` en `log` por defecto. Todo «te avisaremos por correo» es hoy una promesa que el sistema desplegado puede no cumplir. **Desde el 22/09/2026 esto incluye «¿Olvidaste tu contraseña?»**, en el portal y en el panel: la pantalla dice que el enlace salió y, con `log`, nadie lo recibe. En producción `CORREO_TRANSPORTE` tiene que ser `smtp`, con remitente y credenciales, y **el envío real de ese enlace no se ha probado** |
| **Contraseñas largas al crear cuenta o aceptar la invitación** | La contraseña admite como mucho 72 bytes —una tilde o una «ñ» cuentan doble, un emoji cuádruple—. Las pantallas de contraseña nueva lo comprueban y lo explican en español; **crear cuenta y aceptar la invitación del panel no**, y quien se pasa ve el error de BCrypt en inglés. Anotado en los defectos conocidos del backend |
| **Un texto de consentimiento puede decir «S.A.C..»** | Donde el nombre de la empresa cierra la frase y la empresa es la plataforma, el punto sale repetido. Es texto del backend; anotado en sus defectos conocidos |
| **Los consentimientos, sin firma de abogado** | Ya crecieron (14/09/2026): nombran a los cinco proveedores, dicen que los datos salen del Perú, declaran el plazo y enumeran lo que pasa sin que intervenga una persona. **Falta la firma, no la información**, y hasta que la haya no debería pasar por ahí el primer candidato real |
| **Quitar la casilla de postular necesita ese mismo visto bueno** | Desde el 15/09/2026 en `Postular` no hay casilla: se dice quién va a recibir la candidatura, se enlaza el texto y **enviar es el acto**. Es pasar de «consentimiento expreso por casilla» a «consentimiento por acto inequívoco»: las dos se defienden y no son lo mismo, así que es lo primero que hay que poner delante del abogado. La constancia no se tocó — la firma se sigue guardando con su texto, fecha e IP, y el backend sigue exigiendo el dato |
| **Todo el peso informativo del registro está en un enlace** | La explicación junto a la casilla obligatoria se acortó a una línea (15/09/2026, decisión de producto). Antes nombraba ahí la IA y los proveedores de fuera del Perú, que es la primera capa del aviso por capas. **Si el enlace a la política se rompe o el documento se recorta, el consentimiento deja de estar informado** aunque la casilla siga ahí |
| **Quien ya tenía cuenta nunca firmó el texto nuevo** | La migración que cargó los textos no toca las aceptaciones ya hechas y **no existe pantalla de re-aceptación**. Esa gente sigue amparada por un texto que no nombra a ningún proveedor ni dice que sus datos salen del país. Decidir si se les pide es de producto; construirlo sería pantalla nueva |
| **La dirección del backend es prestada** | `nip.io` es de terceros y la IP va escrita a mano en `vercel.json` |
| **Cuenta de prueba en la base real** | `prueba.portal.qa.20260819@example.com` quedó como candidata activa, postulada a Ingeniero/a de Infraestructura (`f7a53fcc-11eb-4369-be96-bee577bdea85`) |
| **Vercel escribe en producción** | El portal desplegado usa la misma base real |
| **Tres casos antiguos que el lápiz no guarda a la primera** | Conocidos y dejados fuera de la entrega del 19/09/2026. Un sueldo guardado **con céntimos** hace que guardar responda con error hasta escribir el monto sin ellos. Si el **responsable o la forma de cierre** guardados ya no están en su catálogo, el desplegable se ve vacío, aunque el valor guardado no se pierde. Y una vacante **«por plazas» sin número de plazas** no se guarda hasta escribir un entero |
| **Dos fallos del examen que ya estaban antes** | Los vio QA el 22/09/2026 y se dejaron fuera de la entrega de eliminar vacantes. En la **evaluación**, una respuesta que el servidor rechaza de forma definitiva —un 4xx que no es 408 ni 429— sale de la cola de `useColaDeRespuestas`, así que al volver a esa pregunta **el recuadro aparece vacío** aunque diga «No se pudo guardar». En el **cuestionario técnico**, el error de un «Empezar la prueba» fallido **sigue en pantalla después de empezar bien**: el inicio que sale bien no limpia el fallo anterior |
| **La ficha del ranking culpa al rol de lo que es de la vacante** | A quien sí puede ver la pretensión (Dirección), en una vacante que no publica su sueldo, la ficha desplegada de una fila le dice «Tu rol no puede ver la pretensión salarial…». Viene de antes; lo vio QA el 23/09/2026. Es texto del backend; anotado en sus defectos conocidos. El panel «Filtros» sí dice lo correcto |
| **E2E con el número repetido** | Los de filtros y selección en lote (23/09/2026) son `33-`, `34-` y `35-`, y los de «¿Olvidaste tu contraseña?», que llegaron de main, van del `33-` al `36-`. Playwright los corre todos, pero «corre el 33» ya no dice cuál. Falta renumerar uno de los dos grupos y cambiar las referencias en [PANEL.md](PANEL.md) y en la bitácora |
| **16 E2E que ya fallaban antes** | En `04-filtros`, `05-excel`, `07-movil` y `08-teclado`, los mismos en cada corrida desde antes de los filtros. Esperan cifras que el sembrador no produce, y `05-excel` sigue leyendo las hojas «Resumen» y «Detalle», que el backend dejó de escribir el 16/09/2026 (ahora es una sola, «Datos»). Anotado en los defectos conocidos del backend |
| **Dos comentarios que ya no dicen la verdad** | El de encima de `describirFiltro` en `ranking.ts` y el de la prueba «la descripción de la hoja no explica columnas que el Excel ya no tiene» en `ranking.test.ts` dicen que las explicaciones de Ciudad y Pretensión las pinta la tabla. Desde el 23/09/2026 las pinta el panel «Filtros» |
| **Un tamaño fuera de la escala** | El título de la vacante (`.identidadVacante h1` en `Vacante.module.css`) llega a `2.75rem`, que no está en la escala de `DESIGN.md`. Viene de main |
| **Vacantes publicadas sin ciudad** | Tras desplegar la búsqueda (25/09/2026), la migración solo puso ciudad donde la ubicación era exactamente el nombre de una provincia. Las demás —como las dos de «Selva Alegre», probablemente Arequipa— salen como «Sin indicar» hasta que el equipo les elija ciudad en el panel, y **cada corrección avisa a quien siga en carrera**. «Desarrollador web», «Líder de operaciones» e «Ingeniero/a de Infraestructura» parecen de prueba: habría que archivarlas |
| **La app de Android no tiene todavía `/vacantes`** | Le llega con su próxima compilación |
| **Al retroceder con Shift+Tab, la cabecera fija tapa lo enfocado** | Al subir con el teclado, el control enfocado queda debajo de la cabecera y no se ve. Falta un `scroll-padding-top` con el alto de la cabecera. Visto el 25/09/2026, fuera de la entrega de la búsqueda |
| **Un propósito de solo espacios deja vacía «El resultado que esperamos»** | En la ficha (`Vacante.tsx`) la sección sale con el título y sin texto. La tarjeta ya trata ese caso como vacío; la ficha no. Visto el 25/09/2026, fuera de la entrega |
| **Al corregir, se puede dejar sin ciudad una vacante presencial** | A propósito: la ciudad solo se exige al crear, o al elegir Presencial o Híbrido en una que no la tiene. Así corregir una vacante vieja no obliga a decidir su ciudad |
| **El E2E `14-vacante` falla en «poner en automático»** | Se vio el 25/09/2026 y no se encontró la causa; la búsqueda no toca ese tramo. Ya estaba entre los fallos de fondo anotados en los defectos conocidos del backend |

Pendiente de comprobar: si hay evaluaciones ya entregadas con menos respuestas de las que
deberían. Las que se perdieron **no se recuperan**, nunca llegaron al servidor.



## Salidas y navegación durante el examen · 10/09/2026

Dos decisiones de producto que la migración visual dejó anotadas en vez de tomar, porque las
dos quitan una salida a mitad de una prueba cronometrada:

- **El «← Volver» de las tres pantallas de examen.** Hoy es un enlace de salida sin
  advertencia. Sustituirlo por «Salir de la prueba» con confirmación toca 3 de los 12 puntos
  que consumen `.volver` en `piezas.module.css`.
- **Los tres enlaces de la cabecera y el `<nav>` del pie** mientras corre el reloj. La cabecera
  podría quedarse solo con la marca.

Lo que sí se hizo, porque era accesibilidad y no producto: la frase del umbral del cronómetro
—«Quedan diez minutos»— pasó de oírse solo en el lector de pantalla a verse también, porque el
rojo del número era la única señal.

## El movimiento que debería significar «algo cambió» · 11/09/2026

La franja del recorrido se dibuja **en cada carga** de «Mis procesos». DESIGN.md afirmaba que
solo lo hacía cuando el estado había cambiado desde la última visita, y eso **nunca existió en
el código**: no hay nada que recuerde la visita anterior.

Para que el movimiento signifique lo que el documento prometía haría falta guardar por
postulación el último estado visto —en `localStorage`, porque el backend no lo expone— y animar
solo cuando no coincida. Es una decisión de producto, no de diseño: guardar estado del candidato
en su navegador tiene implicaciones que nadie ha decidido.

Mientras tanto el texto de DESIGN.md dice la verdad: la franja se llena al entrar, siempre.
