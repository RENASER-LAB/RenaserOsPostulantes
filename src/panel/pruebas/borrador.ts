/**
 * Las piezas sueltas que comparten la lista de pruebas y el compositor.
 *
 * Viven aparte porque las dos pantallas hablan con los mismos endpoints y fallan
 * de la misma forma: un 409 cuando la version ya esta publicada, un 404 cuando
 * la prueba es de la plataforma y esta empresa solo la usa.
 */

import { ErrorApi } from '../api/cliente'
import type { GuardarVersionPrueba, VersionPrueba } from '../api/tipos'

/**
 * Con lo que nace una version.
 *
 * El enunciado no puede ir vacio —`@NotBlank`— asi que lleva una frase que dice
 * que hay que cambiarla. Noventa minutos porque una CRONOMETRADA tiene que durar
 * entre 60 y 120 y el borrador no deberia nacer ya incumpliendo una regla.
 */
export const VERSION_NUEVA: GuardarVersionPrueba = {
  enunciado: 'Escribe aquí lo que tiene que resolver quien rinda esta prueba.',
  materiales: null,
  herramientasPermitidas: null,
  modalidad: 'CRONOMETRADA',
  duracionMinutos: 90,
  plazoDias: null,
  minutoCambioMin: null,
  minutoCambioMax: null,
  minutosExtra: null,
  guiaCalificacion: null,
}

/**
 * La version, tal como se manda de vuelta al guardar.
 *
 * ⚠️ **`actualizarVersion` es un PUT que reemplaza la version entera.** No hay
 * forma de mandar «solo el enunciado»: lo que no viaje se guarda en nulo. De ahi
 * que el formulario se cargue con esto y se mande completo siempre.
 */
export const comoFormulario = (v: VersionPrueba): GuardarVersionPrueba => ({
  enunciado: v.enunciado,
  materiales: v.materiales,
  herramientasPermitidas: v.herramientasPermitidas,
  modalidad: v.modalidad,
  duracionMinutos: v.duracionMinutos,
  plazoDias: v.plazoDias,
  minutoCambioMin: v.minutoCambioMin,
  minutoCambioMax: v.minutoCambioMax,
  minutosExtra: v.minutosExtra,
  guiaCalificacion: v.guiaCalificacion,
})

/**
 * Lo que se enseña cuando el backend rechaza algo.
 *
 * Sus mensajes vienen escritos en español y son concretos —«La rúbrica debe
 * sumar 100 puntos (hoy suma 140)», «Hacen falta entre 8 y 10 preguntas
 * universales; hay 5»—, asi que se enseñan tal cual y no se resumen. Los dos que
 * si hay que traducir son el 409, que llega diciendo «Solo se edita una versión
 * en borrador» sin explicar por que no hay vuelta atras, y el 404, que dice que
 * no existe algo que se esta viendo en la pantalla.
 */
export function explicarFallo(causa: unknown): string {
  if (causa instanceof ErrorApi && causa.estado === 404) {
    return 'Esta prueba no es de tu empresa: es de la plataforma, que tu empresa usa pero no administra. Para cambiarla hay que personalizar las pruebas.'
  }
  if (causa instanceof Error && causa.message) return causa.message
  return 'No se pudo completar la operación.'
}

/** Un número de un campo que puede quedarse vacío. Vacío es nulo, no cero. */
export const numeroDe = (valor: string): number | null =>
  valor.trim() === '' ? null : Number(valor)

/** Y al revés: un nulo no se pinta como «0» en la caja. */
export const textoDe = (valor: number | null): string =>
  valor === null || Number.isNaN(valor) ? '' : String(valor)
