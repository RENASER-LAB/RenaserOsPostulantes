/**
 * El turno que comparten los guardados de la configuración de una vacante (la tuerca): el
 * interruptor «Calificar y avanzar sola», su nota mínima, de dónde salen las preguntas, el
 * instrumento de la etapa técnica con sus minutos, la versión de pesos y la prueba. Salen de
 * uno en uno, en el orden en que se pidieron, aunque alguno falle. Es el `scope` de TanStack
 * Query: las mutaciones con el mismo `id` esperan a la anterior.
 *
 * ⚠️ **Por qué.** Cada trozo se guarda por su lado, pero en la tuerca salen juntos: la mínima
 * se guarda al salir del campo, y salir es pulsar lo siguiente —el interruptor de encima o
 * «Sin evaluación» justo debajo—. Las dos peticiones salían en el mismo milisegundo. El
 * backend ya no deja que una pise a la otra (bloquea la vacante y escribe solo las columnas
 * de cada guardado, QA-F04 y QA-F05), pero en turno el orden es el del gesto: si el apagado
 * llegaba antes que la mínima, ella volvía con un 409 y un aviso de error por algo que nadie
 * hizo mal. Cada guardado relee la vacante al terminar, así que lo que se ve al final es lo
 * que la base guarda, sin recargar.
 */
export const turnoDeLaVacante = (vacanteId: number) => ({
  id: `configuracion-de-la-vacante-${vacanteId}`,
})
