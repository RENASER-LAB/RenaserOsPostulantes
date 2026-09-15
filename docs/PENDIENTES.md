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
| **Los consentimientos van a crecer** | Todavía no nombran a DeepSeek ni a Google, y tienen que hacerlo antes del primer candidato real. El bloque necesita sitio para un texto bastante más largo |
| **La dirección del backend es prestada** | `nip.io` es de terceros y la IP va escrita a mano en `vercel.json` |
| **Cuenta de prueba en la base real** | `prueba.portal.qa.20260819@example.com` quedó como candidata activa, postulada a Ingeniero/a de Infraestructura (`f7a53fcc-11eb-4369-be96-bee577bdea85`) |
| **Vercel escribe en producción** | El portal desplegado usa la misma base real |

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
