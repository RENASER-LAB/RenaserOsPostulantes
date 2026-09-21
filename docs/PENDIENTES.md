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
| **El correo no sale** | El backend tiene `renaser.correo.transporte` en `log` por defecto. Todo «te avisaremos por correo» es hoy una promesa que el sistema desplegado puede no cumplir |
| **Los consentimientos, sin firma de abogado** | Ya crecieron (14/09/2026): nombran a los cinco proveedores, dicen que los datos salen del Perú, declaran el plazo y enumeran lo que pasa sin que intervenga una persona. **Falta la firma, no la información**, y hasta que la haya no debería pasar por ahí el primer candidato real |
| **Quitar la casilla de postular necesita ese mismo visto bueno** | Desde el 15/09/2026 en `Postular` no hay casilla: se dice quién va a recibir la candidatura, se enlaza el texto y **enviar es el acto**. Es pasar de «consentimiento expreso por casilla» a «consentimiento por acto inequívoco»: las dos se defienden y no son lo mismo, así que es lo primero que hay que poner delante del abogado. La constancia no se tocó — la firma se sigue guardando con su texto, fecha e IP, y el backend sigue exigiendo el dato |
| **Todo el peso informativo del registro está en un enlace** | La explicación junto a la casilla obligatoria se acortó a una línea (15/09/2026, decisión de producto). Antes nombraba ahí la IA y los proveedores de fuera del Perú, que es la primera capa del aviso por capas. **Si el enlace a la política se rompe o el documento se recorta, el consentimiento deja de estar informado** aunque la casilla siga ahí |
| **Quien ya tenía cuenta nunca firmó el texto nuevo** | La migración que cargó los textos no toca las aceptaciones ya hechas y **no existe pantalla de re-aceptación**. Esa gente sigue amparada por un texto que no nombra a ningún proveedor ni dice que sus datos salen del país. Decidir si se les pide es de producto; construirlo sería pantalla nueva |
| **La dirección del backend es prestada** | `nip.io` es de terceros y la IP va escrita a mano en `vercel.json` |
| **Cuenta de prueba en la base real** | `prueba.portal.qa.20260819@example.com` quedó como candidata activa, postulada a Ingeniero/a de Infraestructura (`f7a53fcc-11eb-4369-be96-bee577bdea85`) |
| **Vercel escribe en producción** | El portal desplegado usa la misma base real |
| **Tres casos antiguos que el lápiz no guarda a la primera** | Conocidos y dejados fuera de la entrega del 19/09/2026. Un sueldo guardado **con céntimos** hace que guardar responda con error hasta escribir el monto sin ellos. Si el **responsable o la forma de cierre** guardados ya no están en su catálogo, el desplegable se ve vacío, aunque el valor guardado no se pierde. Y una vacante **«por plazas» sin número de plazas** no se guarda hasta escribir un entero |

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
