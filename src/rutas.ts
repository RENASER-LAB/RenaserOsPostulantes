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
  perfil: '/perfil',
  procesos: '/procesos',
  proceso: '/procesos/:uuid',
  evaluacion: '/procesos/:uuid/evaluacion',
  prueba: '/procesos/:uuid/prueba',
  simulacion: '/procesos/:uuid/simulacion',
  validacion: '/procesos/:uuid/validacion',
  decision: '/procesos/:uuid/decision',
  privacidad: '/privacidad',
  /**
   * La politica de privacidad **sin sesion**.
   *
   * No duplica a `/privacidad`: aquella es el panel de acciones y todas
   * necesitan saber quien las pide. Esta existe porque Google Play exige una
   * URL de politica que se pueda leer sin cuenta, y porque el borrado de datos
   * tiene que poder pedirse desde la web sin instalar la aplicacion.
   */
  politica: '/politica-de-privacidad',

  // ---------- El panel del equipo ----------
  adminEntrar: '/admin/entrar',
  /**
   * Canjear la invitacion del correo. El token va en la query, como el acceso
   * del candidato.
   *
   * ⚠️ **Hay dos**, y no es un descuido. El backend arma el enlace como
   * `{renaser.panel.url}/invitacion?token=…`, asi que si esa propiedad no
   * apunta a `…/admin` el correo manda a `/invitacion` a secas. La segunda ruta
   * recoge ese caso y redirige conservando el token; sin ella, el comodin de
   * abajo lo tragaria y el token desapareceria en silencio.
   */
  adminInvitacion: '/admin/invitacion',
  invitacionSuelta: '/invitacion',
  adminVacantes: '/admin',
  adminVacante: '/admin/vacantes/:id',
  /** La ficha del puesto y su cuestionario tecnico: la primera sub-ruta de una vacante. */
  adminPruebaTecnica: '/admin/vacantes/:id/prueba-tecnica',
  adminSesiones: '/admin/simulacion',
  adminConfiguracion: '/admin/configuracion',
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
  perfil: () => '/perfil',
  procesos: () => '/procesos',
  proceso: (uuid: string) => `/procesos/${uuid}`,
  evaluacion: (uuid: string) => `/procesos/${uuid}/evaluacion`,
  prueba: (uuid: string) => `/procesos/${uuid}/prueba`,
  simulacion: (uuid: string) => `/procesos/${uuid}/simulacion`,
  validacion: (uuid: string) => `/procesos/${uuid}/validacion`,
  decision: (uuid: string) => `/procesos/${uuid}/decision`,
  privacidad: () => '/privacidad',
  /** La politica que se lee sin cuenta. La que Play necesita enlazar. */
  politica: () => '/politica-de-privacidad',

  // ---------- El panel del equipo ----------
  adminEntrar: () => '/admin/entrar',
  adminInvitacion: (token: string) => `/admin/invitacion?token=${encodeURIComponent(token)}`,
  adminVacantes: () => '/admin',
  adminVacante: (id: number | string) => `/admin/vacantes/${id}`,
  adminPruebaTecnica: (id: number | string) => `/admin/vacantes/${id}/prueba-tecnica`,
  adminSesiones: () => '/admin/simulacion',
  adminConfiguracion: () => '/admin/configuracion',
} as const
