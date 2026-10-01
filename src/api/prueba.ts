/** `PruebaPortalController`: la prueba del puesto, con su cronometro. */

import { pedir } from './cliente'
import type { EntregaPrueba, MiPrueba } from './tipos'

export const verPrueba = (uuid: string) => pedir<MiPrueba>(`/prueba/${uuid}`)

/**
 * Arranca el cronometro. El servidor calcula cuando vence y lo devuelve en
 * `venceEn`: cerrar el navegador no lo detiene.
 */
export const iniciarPrueba = (uuid: string) =>
  pedir<MiPrueba>(`/prueba/${uuid}/inicio`, { metodo: 'POST' })

export const responderPrueba = (uuid: string, preguntaId: number, texto: string) =>
  pedir<void>(`/prueba/${uuid}/respuestas/${preguntaId}`, {
    metodo: 'PUT',
    cuerpo: { texto },
  })

/**
 * Una cerrada de la prueba del editor (V67): la opción elegida (opción única y
 * escala) o las marcadas (opción múltiple). Nula o vacía = sin responder.
 */
export const responderPruebaCerrada = (
  uuid: string,
  preguntaId: number,
  respuesta: { opcionId: number | null } | { marcadas: number[] },
) =>
  pedir<void>(`/prueba/${uuid}/respuestas/${preguntaId}`, {
    metodo: 'PUT',
    cuerpo: respuesta,
  })

export function subirArchivo(uuid: string, entregableId: number, archivo: File) {
  const formulario = new FormData()
  formulario.append('archivo', archivo)
  return pedir<void>(`/prueba/${uuid}/entregables/${entregableId}/archivo`, {
    metodo: 'POST',
    formulario,
  })
}

export const subirEnlace = (uuid: string, entregableId: number, enlace: string) =>
  pedir<void>(`/prueba/${uuid}/entregables/${entregableId}/enlace`, {
    metodo: 'POST',
    cuerpo: { enlace },
  })

/** Entrega. Si el tiempo se agota, el servidor entrega solo lo que haya. */
export const entregarPrueba = (uuid: string) =>
  pedir<EntregaPrueba>(`/prueba/${uuid}/entrega`, { metodo: 'POST' })
