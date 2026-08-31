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
/**
 * Solo el panel descarga archivos: el Excel del ranking. El portal del
 * candidato no tiene ninguna ruta que devuelva un binario —su unica descarga,
 * la de sus datos, es un JSON que se arma en el navegador— asi que no se
 * reexporta alli.
 */
export const pedirArchivo = puerta.pedirArchivo
export const leerToken = puerta.leerToken
export const guardarToken = puerta.guardarToken
export const borrarToken = puerta.borrarToken
export const alCaerLaSesion = puerta.alCaerLaSesion
