/**
 * «Pruebas»: el índice de las preguntas y pruebas que la empresa escribió en el
 * editor de sus vacantes (spec pruebas-indice-de-la-empresa).
 *
 * Tres lecturas, cortadas por empresa y por el alcance de `ver_vacantes` en el
 * servidor —lo ajeno responde 404—. La copia no es nueva: es el `POST …/copia`
 * del editor de la vacante destino (`copiarDeOtraVacante`), que ahora rechaza
 * una destino que no usa el editor para eso.
 *
 * El panel no sabe sus permisos: si una fila se puede usar en otra vacante lo
 * dice la propia fila (`puedeUsarEnOtra`).
 */

import { pedir } from './cliente'
import type { VersionDePreguntas } from './preguntasPropias'

/** La pestaña: las preguntas del Perfil Integral o la prueba del puesto. */
export type TipoDePrueba = 'PERFIL_INTEGRAL' | 'PRUEBA_PUESTO'

export type SituacionDeLaVacante = 'SIN_PUBLICAR' | 'PUBLICADA' | 'CERRADA' | 'ARCHIVADA'

export interface FilaDePrueba {
  vacanteId: number
  titulo: string
  /** «San Isidro, Lima», «Arequipa» o «Remoto»: se ve, pero no se busca. */
  sede: string | null
  /** El del puesto (EJECUCION…); nulo sin puesto o sin nivel. */
  nivel: string | null
  situacion: SituacionDeLaVacante
  /** PUBLICADA si tiene una publicada (es la que se enseña); si no, BORRADOR. */
  estado: 'PUBLICADA' | 'BORRADOR'
  /** La vara del editor ya no se mueve: postulantes, o alguien que abrió la prueba. */
  laRindeAlguien: boolean
  /** Una publicada y además un borrador abierto. */
  hayBorradorAbierto: boolean
  criterios: number
  preguntas: number
  /** Solo en la prueba: todos, los de pregunta y los generales. */
  entregables: number | null
  /** Solo en la prueba. */
  modalidad: 'CRONOMETRADA' | 'PLAZO_ABIERTO' | null
  minutos: number | null
  /** Solo las de plazo abierto de antes de la V68. */
  dias: number | null
  /** Cuándo se publicó la versión; nulo si nunca se publicó. */
  publicadaEn: string | null
  /** Con `editar_vacante` y una versión publicada. */
  puedeUsarEnOtra: boolean
}

export interface VacanteDestino {
  vacanteId: number
  titulo: string
  sede: string | null
  nivel: string | null
  situacion: SituacionDeLaVacante
  /** Ya hay un borrador: la copia lo reemplaza entero, y se pide confirmarlo. */
  tieneBorrador: boolean
  /** Falso si ya la rinde alguien: sale deshabilitada, con su motivo. */
  puedeRecibir: boolean
  motivo: string | null
}

/** La lista entera de la pestaña: los filtros se aplican aquí para tener sus recuentos. */
export const listarPruebas = (tipo: TipoDePrueba) => pedir<FilaDePrueba[]>(`/pruebas?tipo=${tipo}`)

/** La publicada o, si no la hay, el borrador, sin sus avisos. 404 si ya no existe. */
export const verPrueba = (vacanteId: number, tipo: TipoDePrueba) =>
  pedir<VersionDePreguntas>(`/pruebas/${vacanteId}?tipo=${tipo}`)

/** Las vacantes que pueden recibir la copia y, las que no, con su motivo. */
export const listarDestinos = (tipo: TipoDePrueba, excluir?: number) =>
  pedir<VacanteDestino[]>(`/pruebas/destinos?tipo=${tipo}${excluir === undefined ? '' : `&excluir=${excluir}`}`)
