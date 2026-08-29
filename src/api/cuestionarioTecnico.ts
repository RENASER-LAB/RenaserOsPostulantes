/**
 * `CuestionarioTecnicoPortalController`: la prueba técnica de la vacante.
 *
 * Los mismos cuatro verbos que la evaluación del banco y la misma forma de respuesta —para
 * quien contesta es el mismo gesto: abrir, empezar, escribir, entregar—. Lo que cambia es
 * qué examen le tocó, y eso lo decide la vacante.
 *
 * ⚠️ Aquí **no se suben archivos**, y no es un olvido: la etapa técnica del método
 * CAZATALENTOS se contesta escribiendo. La única parte de «producir algo» va marcada como
 * presencial, jamás se envía y se resuelve en la entrevista con el dueño.
 */

import { pedir } from './cliente'
import type { EntregaEvaluacion, EvaluacionCandidato, ResponderEvaluacion } from './tipos'

/** Trae el cuestionario entero, sin la pregunta presencial ni la guía de calificación. */
export const verCuestionarioTecnico = (uuid: string) =>
  pedir<EvaluacionCandidato>(`/cuestionario-tecnico/${uuid}`)

/** Empieza. Aquí arranca el reloj, si la vacante fijó minutos. */
export const iniciarCuestionarioTecnico = (uuid: string) =>
  pedir<EvaluacionCandidato>(`/cuestionario-tecnico/${uuid}/inicio`, { metodo: 'POST' })

/** Guarda una respuesta. Solo texto: estas preguntas no tienen opciones. */
export const responderCuestionarioTecnico = (
  uuid: string,
  preguntaId: number,
  respuesta: ResponderEvaluacion,
) =>
  pedir<void>(`/cuestionario-tecnico/${uuid}/respuestas/${preguntaId}`, {
    metodo: 'PUT',
    cuerpo: respuesta,
  })

/** Entrega definitiva. Después de esto ya no se puede tocar nada. */
export const entregarCuestionarioTecnico = (uuid: string) =>
  pedir<EntregaEvaluacion>(`/cuestionario-tecnico/${uuid}/entrega`, { metodo: 'POST' })
