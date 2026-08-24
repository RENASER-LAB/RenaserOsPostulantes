/**
 * Las rutas del portal, en un solo sitio.
 *
 * Se escriben aqui y no sueltas por las pantallas para que cambiar una direccion
 * sea cambiar una linea. El enrutador usa los patrones; todo lo demas usa las
 * funciones.
 */

export const patrones = {
  vacantes: '/',
  vacante: '/vacantes/:vacanteId',
  postular: '/vacantes/:vacanteId/postular',
  ingresar: '/ingresar',
  acceso: '/acceso',
  registro: '/registro',
  clave: '/clave',
  procesos: '/procesos',
  proceso: '/procesos/:uuid',
  evaluacion: '/procesos/:uuid/evaluacion',
  prueba: '/procesos/:uuid/prueba',
  simulacion: '/procesos/:uuid/simulacion',
  validacion: '/procesos/:uuid/validacion',
  decision: '/procesos/:uuid/decision',
  privacidad: '/privacidad',
} as const

export const rutas = {
  vacantes: () => '/',
  vacante: (vacanteId: number | string) => `/vacantes/${vacanteId}`,
  postular: (vacanteId: number | string) => `/vacantes/${vacanteId}/postular`,
  /** Recuerda a que vacante se estaba postulando, para volver despues. */
  ingresar: (vacanteId?: number | string) =>
    vacanteId === undefined ? '/ingresar' : `/ingresar?vacante=${vacanteId}`,
  /** La entrada sin contrasena. El token va en la query, no en el camino. */
  acceso: (token: string) => `/acceso?token=${encodeURIComponent(token)}`,
  /** El registro recuerda a que vacante se estaba postulando, para volver despues. */
  registro: (vacanteId?: number | string) =>
    vacanteId === undefined ? '/registro' : `/registro?vacante=${vacanteId}`,
  /** La contrasena olvidada. No restablece: explica y da la salida que si existe. */
  clave: () => '/clave',
  procesos: () => '/procesos',
  proceso: (uuid: string) => `/procesos/${uuid}`,
  evaluacion: (uuid: string) => `/procesos/${uuid}/evaluacion`,
  prueba: (uuid: string) => `/procesos/${uuid}/prueba`,
  simulacion: (uuid: string) => `/procesos/${uuid}/simulacion`,
  validacion: (uuid: string) => `/procesos/${uuid}/validacion`,
  decision: (uuid: string) => `/procesos/${uuid}/decision`,
  privacidad: () => '/privacidad',
} as const
