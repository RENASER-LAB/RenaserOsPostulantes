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
  registro: '/registro',
  procesos: '/procesos',
  proceso: '/procesos/:uuid',
  evaluacion: '/procesos/:uuid/evaluacion',
  prueba: '/procesos/:uuid/prueba',
  simulacion: '/procesos/:uuid/simulacion',
  decision: '/procesos/:uuid/decision',
  privacidad: '/privacidad',
} as const

export const rutas = {
  vacantes: () => '/',
  vacante: (vacanteId: number | string) => `/vacantes/${vacanteId}`,
  postular: (vacanteId: number | string) => `/vacantes/${vacanteId}/postular`,
  ingresar: () => '/ingresar',
  /** El registro recuerda a que vacante se estaba postulando, para volver despues. */
  registro: (vacanteId?: number | string) =>
    vacanteId === undefined ? '/registro' : `/registro?vacante=${vacanteId}`,
  procesos: () => '/procesos',
  proceso: (uuid: string) => `/procesos/${uuid}`,
  evaluacion: (uuid: string) => `/procesos/${uuid}/evaluacion`,
  prueba: (uuid: string) => `/procesos/${uuid}/prueba`,
  simulacion: (uuid: string) => `/procesos/${uuid}/simulacion`,
  decision: (uuid: string) => `/procesos/${uuid}/decision`,
  privacidad: () => '/privacidad',
} as const
