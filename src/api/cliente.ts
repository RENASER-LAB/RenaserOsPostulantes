/**
 * La puerta del portal del candidato.
 *
 * La mecanica —token, errores, hora del servidor, sesion caida— vive en
 * `puerta.ts`, compartida con la puerta del panel. Aqui solo se fija a que
 * base habla y donde guarda su token, y se conservan los nombres que ya usaba
 * todo el portal.
 */

import { crearPuerta } from './puerta'

export { ErrorApi } from './puerta'

const puerta = crearPuerta('/api/v1/portal', 'renaser_portal_token')

export const pedir = puerta.pedir
export const leerToken = puerta.leerToken
export const guardarToken = puerta.guardarToken
export const borrarToken = puerta.borrarToken
export const alCaerLaSesion = puerta.alCaerLaSesion
