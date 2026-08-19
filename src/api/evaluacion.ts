/** `EvaluacionPortalController`: la evaluacion del Perfil Integral. */

import { pedir } from './cliente'
import type { EntregaEvaluacion, EvaluacionCandidato, ResponderEvaluacion } from './tipos'

/** Trae la evaluacion entera: todas las preguntas de golpe, con lo ya respondido. */
export const verEvaluacion = (uuid: string) =>
  pedir<EvaluacionCandidato>(`/evaluacion/${uuid}`)

/** Arranca el intento. A partir de aqui corre el plazo. */
export const iniciarEvaluacion = (uuid: string) =>
  pedir<EvaluacionCandidato>(`/evaluacion/${uuid}/inicio`, { metodo: 'POST' })

/**
 * Guarda una respuesta. Acepta cualquier pregunta en cualquier orden, asi que
 * el candidato puede volver atras y corregir.
 */
export const responderEvaluacion = (
  uuid: string,
  preguntaId: number,
  respuesta: ResponderEvaluacion,
) =>
  pedir<void>(`/evaluacion/${uuid}/respuestas/${preguntaId}`, {
    metodo: 'PUT',
    cuerpo: respuesta,
  })

/** Entrega definitiva. Despues de esto ya no se puede tocar nada. */
export const entregarEvaluacion = (uuid: string) =>
  pedir<EntregaEvaluacion>(`/evaluacion/${uuid}/entrega`, { metodo: 'POST' })
