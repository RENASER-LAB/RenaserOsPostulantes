/**
 * Las consultas que comparten la pagina de la prueba tecnica y la tarjeta de
 * estado de la vacante. Con las mismas claves, ir de una a otra encuentra la
 * cache caliente.
 */

import { ErrorApi } from '../../api/cliente'
import { verFichaDelPuesto } from '../../api/panel'
import type { FichaDelPuesto } from '../../api/tipos'

export const claveDeLaFicha = (vacanteId: number) => ['panel-ficha-del-puesto', vacanteId] as const
export const claveDelCuestionario = (vacanteId: number) =>
  ['panel-cuestionario-tecnico', vacanteId] as const

/**
 * La ficha, o nada si todavia no se ha empezado.
 *
 * Solo el 404 significa «no hay»: un 403 o un 500 disfrazados de ficha vacia
 * mentirian, asi que esos siguen subiendo como error.
 */
export const laFichaONada = (vacanteId: number): Promise<FichaDelPuesto | null> =>
  verFichaDelPuesto(vacanteId).catch((causa: unknown) => {
    if (causa instanceof ErrorApi && causa.estado === 404) return null
    throw causa
  })
