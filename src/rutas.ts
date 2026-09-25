/**
 * Las rutas del portal, en un solo sitio.
 *
 * Se escriben aqui y no sueltas por las pantallas para que cambiar una direccion
 * sea cambiar una linea. El enrutador usa los patrones; todo lo demas usa las
 * funciones.
 */

export const patrones = {
  inicio: '/',
  /**
   * Buscar vacantes: la pantalla con el buscador, los filtros y el orden. Hasta el
   * 25/09/2026 «las vacantes» eran una sección de la portada, `/#vacantes-abiertas`,
   * que sigue existiendo con las tres más recientes.
   */
  vacantes: '/vacantes',
  vacante: '/vacantes/:vacanteId',
  postular: '/vacantes/:vacanteId/postular',
  ingresar: '/ingresar',
  acceso: '/acceso',
  registro: '/registro',
  clave: '/clave',
  /**
   * Elegir la contraseña nueva con el enlace del correo. El token llega en la
   * query y la pantalla lo quita de la barra al cargar (`replace`).
   */
  restablecer: '/restablecer',
  perfil: '/perfil',
  procesos: '/procesos',
  proceso: '/procesos/:uuid',
  evaluacion: '/procesos/:uuid/evaluacion',
  prueba: '/procesos/:uuid/prueba',
  /** La otra forma de la etapa de la prueba: el cuestionario técnico de la vacante. */
  cuestionarioTecnico: '/procesos/:uuid/prueba-tecnica',
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
  /** Pedir el enlace de contraseña nueva del panel. Sin la línea de talento. */
  adminClave: '/admin/clave',
  /**
   * Elegir la contraseña nueva del panel.
   *
   * ⚠️ **Aquí no hay ruta suelta como la de `/invitacion`, y no puede haberla.**
   * `/restablecer` a secas es la pantalla del candidato; por eso el backend arma
   * el enlace del equipo con `/admin/restablecer` siempre, lleve o no
   * `renaser.panel.url` el `/admin`. Un enlace de equipo nunca aterriza en el
   * portal.
   */
  adminRestablecer: '/admin/restablecer',
  adminVacantes: '/admin',
  /**
   * Las vacantes archivadas, en su propia direccion.
   *
   * Direccion y no un estado dentro de `/admin`: la vista tiene que sobrevivir a
   * la recarga y al boton Atras del navegador. Con un `useState` dentro de la
   * lista, recargar devolveria a la lista habitual sin decir nada y Atras
   * saldria del panel entero.
   */
  adminVacantesArchivadas: '/admin/archivadas',
  adminVacante: '/admin/vacantes/:id',
  /** La ficha del puesto y su cuestionario tecnico: la primera sub-ruta de una vacante. */
  adminPruebaTecnica: '/admin/vacantes/:id/prueba-tecnica',
  adminSesiones: '/admin/simulacion',
  /**
   * Las pruebas del puesto: las plantillas y sus versiones.
   *
   * Pestaña propia y no un bloque mas de Configuracion, que es donde vive el
   * banco de preguntas: componer una version es una tarea larga —enunciado,
   * preguntas, entregables, rubrica y variantes— con su propia pantalla, y
   * meterla dentro de una pagina que ya lleva cinco secciones dejaria el
   * trabajo de todos los dias tres pantallazos por debajo del pliegue.
   */
  adminPruebas: '/admin/pruebas',
  adminComponerPrueba: '/admin/pruebas/versiones/:versionId',
  adminConfiguracion: '/admin/configuracion',
} as const

export const rutas = {
  inicio: () => '/',
  /**
   * La búsqueda, los filtros y el orden viajan en la query (`?q=…&ciudad=1501`):
   * quien ya la tiene la pasa entera para volver a la lista tal como estaba.
   */
  vacantes: (busqueda?: string) =>
    busqueda === undefined || busqueda === '' || busqueda === '?' ? '/vacantes' : `/vacantes${busqueda.startsWith('?') ? '' : '?'}${busqueda}`,
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
  /** La contraseña olvidada: pedir el enlace para elegir una nueva. */
  clave: () => '/clave',
  /** Solo para pruebas y documentación: el enlace lo arma el backend. */
  restablecer: (token: string) => `/restablecer?token=${encodeURIComponent(token)}`,
  perfil: () => '/perfil',
  procesos: () => '/procesos',
  proceso: (uuid: string) => `/procesos/${uuid}`,
  evaluacion: (uuid: string) => `/procesos/${uuid}/evaluacion`,
  prueba: (uuid: string) => `/procesos/${uuid}/prueba`,
  cuestionarioTecnico: (uuid: string) => `/procesos/${uuid}/prueba-tecnica`,
  simulacion: (uuid: string) => `/procesos/${uuid}/simulacion`,
  validacion: (uuid: string) => `/procesos/${uuid}/validacion`,
  decision: (uuid: string) => `/procesos/${uuid}/decision`,
  privacidad: () => '/privacidad',
  /**
   * La politica que se lee sin cuenta. La que Play necesita enlazar.
   *
   * Con `ancla` lleva directo a un bloque. Las casillas de consentimiento la
   * enlazan con `'el-texto-que-aceptas'`: quien pulsa desde una casilla no quiere
   * la politica entera, quiere el parrafo que esta a punto de firmar.
   */
  politica: (ancla?: string, vacanteId?: number | string) => {
    const base = '/politica-de-privacidad'
    const query = vacanteId === undefined ? '' : `?vacante=${vacanteId}`
    return ancla === undefined ? base + query : `${base}${query}#${ancla}`
  },
  /** El bloque con los textos publicados, palabra por palabra. */
  anclaDeLosTextos: 'el-texto-que-aceptas',

  // ---------- El panel del equipo ----------
  adminEntrar: () => '/admin/entrar',
  adminInvitacion: (token: string) => `/admin/invitacion?token=${encodeURIComponent(token)}`,
  adminClave: () => '/admin/clave',
  /** Solo para pruebas y documentación: el enlace lo arma el backend. */
  adminRestablecer: (token: string) =>
    `/admin/restablecer?token=${encodeURIComponent(token)}`,
  adminVacantes: () => '/admin',
  adminVacantesArchivadas: () => '/admin/archivadas',
  adminVacante: (id: number | string) => `/admin/vacantes/${id}`,
  adminPruebaTecnica: (id: number | string) => `/admin/vacantes/${id}/prueba-tecnica`,
  adminSesiones: () => '/admin/simulacion',
  adminPruebas: () => '/admin/pruebas',
  adminComponerPrueba: (versionId: number | string) =>
    `/admin/pruebas/versiones/${versionId}`,
  adminConfiguracion: () => '/admin/configuracion',
} as const
