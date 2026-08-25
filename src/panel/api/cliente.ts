/**
 * La puerta del panel del equipo.
 *
 * Base y token propios, aparte de los del candidato: un 401 del panel no puede
 * cerrarle la sesion a quien esta respondiendo una evaluacion en otra pestaña,
 * ni al reves.
 */

import { crearPuerta } from '@/api/puerta'

export { ErrorApi } from '@/api/puerta'

const puerta = crearPuerta('/api/v1/panel', 'renaser_panel_token')

export const pedir = puerta.pedir
export const leerToken = puerta.leerToken
export const guardarToken = puerta.guardarToken
export const borrarToken = puerta.borrarToken
export const alCaerLaSesion = puerta.alCaerLaSesion
