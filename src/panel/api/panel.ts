/**
 * Las llamadas del panel, agrupadas por pestaña.
 *
 * Cada funcion es una linea: la ruta y el tipo. La mecanica vive en la puerta.
 */

import { pedir } from './cliente'
import type {
  AceptarInvitacionPanel,
  LoginPanel,
  CrearSolicitud,
  DesgloseEvaluacion,
  AreaPanel,
  ConteoEmbudo,
  CrearSesion,
  FichaPostulacion,
  GuardarVacante,
  NotaCriterioEtapa,
  Parametro,
  PasoHistorialPanel,
  PerfilIntegral,
  PlantillaEvaluacionPanel,
  PuestoPanel,
  RankingVacante,
  RequisitoPanel,
  RolPanel,
  SesionEquipo,
  SesionPanel,
  UsuarioEquipo,
  VacantePanel,
  VersionBanco,
  VersionPesos,
  Catalogos,
  SolicitudResumen,
  ValidacionPanel,
  PlantillaPruebaPanel,
  VersionPrueba,
} from './tipos'

// ---------- Entrar ----------

/**
 * La entrada normal del panel: correo y contrasena.
 *
 * RENASER OS quedo dormido y ahora todo el equipo entra por aqui, Renaser
 * incluida. **El panel no tiene registro publico**: las cuentas nacen solo por
 * invitacion, asi que esta pantalla no ofrece crear ninguna.
 *
 * Tres respuestas que hay que distinguir, y las tres llegan como `ErrorApi`:
 *   401 a secas         — el correo o la contrasena no cuadran. El mensaje es
 *                         el mismo exista o no el correo, a proposito
 *   401 con explicacion — la empresa esta suspendida; ese `detail` si se enseña
 *   429                 — demasiados intentos; el cuerpo trae `segundosDeEspera`
 */
export const entrarAlPanel = (datos: LoginPanel) =>
  pedir<SesionEquipo>('/auth/login', { metodo: 'POST', cuerpo: datos, sinToken: true })

/**
 * Canjear la invitacion que llego por correo y quedarse dentro.
 *
 * El token va **en el cuerpo y nunca en la direccion de la API**: en la barra
 * acaba en el historial, en los registros del servidor y en el `Referer`. Es de
 * un solo uso, y vencida, usada o revocada dan el mismo error generico — decir
 * cual de las tres es contarle a quien prueba enlaces si acerto.
 */
export const aceptarInvitacion = (datos: AceptarInvitacionPanel) =>
  pedir<SesionEquipo>('/auth/invitacion', { metodo: 'POST', cuerpo: datos, sinToken: true })

/**
 * El login de desarrollo. El backend lo mantiene para local y lo apaga en
 * produccion con `app.seguridad.dev-login-activo=false`. El id es TEXTO
 * (`andy-dev`), no un numero.
 *
 * Se conserva porque en una base local recien levantada puede no haber ninguna
 * cuenta con contrasena, y entonces esta es la unica forma de entrar. Ningun
 * flujo del portal depende de el.
 */
export const entrarComoEquipo = (usuarioRenaserOsId: string) =>
  pedir<SesionEquipo>('/auth/dev-login', {
    metodo: 'POST',
    cuerpo: { usuarioRenaserOsId },
    sinToken: true,
  })

// ---------- Catalogos y solicitudes ----------

export const verCatalogos = () => pedir<Catalogos>('/catalogos')

export const listarSolicitudes = () => pedir<SolicitudResumen[]>('/solicitudes')

/** Devuelve solo el id: el backend responde `{ "id": 7 }`. */
export const crearSolicitud = async (datos: CrearSolicitud) =>
  (await pedir<{ id: number }>('/solicitudes', { metodo: 'POST', cuerpo: datos })).id
/** Direccion aprueba: la solicitud queda ABIERTA y admite vacante. */
export const aprobarSolicitud = (id: number, motivo: string) =>
  pedir<void>(`/solicitudes/${id}/aprobacion`, { metodo: 'POST', cuerpo: { motivo } })

// ---------- Vacantes ----------

export const listarVacantes = () => pedir<VacantePanel[]>('/vacantes')
export const verVacante = (id: number) => pedir<VacantePanel>(`/vacantes/${id}`)
export const crearVacante = (datos: GuardarVacante) =>
  pedir<VacantePanel>('/vacantes', { metodo: 'POST', cuerpo: datos })
export const editarVacante = (id: number, datos: GuardarVacante) =>
  pedir<VacantePanel>(`/vacantes/${id}`, { metodo: 'PUT', cuerpo: datos })
export const publicarVacante = (id: number) =>
  pedir<void>(`/vacantes/${id}/publicacion`, { metodo: 'POST' })
export const cerrarVacante = (id: number, motivo: string) =>
  pedir<void>(`/vacantes/${id}/cierre`, { metodo: 'POST', cuerpo: { motivo } })

export const listarPuestos = () => pedir<PuestoPanel[]>('/puestos')

export const listarRequisitos = (vacanteId: number) =>
  pedir<RequisitoPanel[]>(`/vacantes/${vacanteId}/requisitos`)
export const crearRequisito = (vacanteId: number, descripcion: string, regla: string) =>
  pedir<RequisitoPanel>(`/vacantes/${vacanteId}/requisitos`, {
    metodo: 'POST',
    cuerpo: { descripcion, regla },
  })
export const quitarRequisito = (vacanteId: number, requisitoId: number) =>
  pedir<void>(`/vacantes/${vacanteId}/requisitos/${requisitoId}`, { metodo: 'DELETE' })

// ---------- Postulaciones de una vacante ----------

export const verEmbudo = (vacanteId: number) =>
  pedir<ConteoEmbudo>(`/vacantes/${vacanteId}/embudo`)
/** Sin etapa es la preseleccion; con ella, la nota de la fila es la de esa etapa. */
export const verRanking = (vacanteId: number, etapa?: string) =>
  pedir<RankingVacante>(`/vacantes/${vacanteId}/ranking${etapa ? `?etapa=${etapa}` : ''}`)

export const verFicha = (postulacionId: number) =>
  pedir<FichaPostulacion>(`/postulaciones/${postulacionId}`)
export const verPerfilIntegral = (postulacionId: number) =>
  pedir<PerfilIntegral>(`/postulaciones/${postulacionId}/perfil-integral`)
export const verDesgloseEvaluacion = (postulacionId: number) =>
  pedir<DesgloseEvaluacion>(`/postulaciones/${postulacionId}/evaluacion`)
export const verNotasPrueba = (postulacionId: number) =>
  pedir<NotaCriterioEtapa[]>(`/postulaciones/${postulacionId}/prueba/notas`)
export const verNotasSimulacion = (postulacionId: number) =>
  pedir<NotaCriterioEtapa[]>(`/postulaciones/${postulacionId}/simulacion/notas`)
/** 404 mientras el equipo no la habilite: se traduce a «todavia no hay». */
export const verValidacion = (postulacionId: number) =>
  pedir<ValidacionPanel>(`/postulaciones/${postulacionId}/validacion`)
export const verMetricasValidacion = (postulacionId: number) =>
  pedir<NotaCriterioEtapa[]>(`/postulaciones/${postulacionId}/validacion/metricas`)
export const verHistorial = (postulacionId: number) =>
  pedir<PasoHistorialPanel[]>(`/postulaciones/${postulacionId}/historial`)

/** Confirma que avanza: aplica el estado siguiente que calcula la maquina. */
export const confirmarAvance = (postulacionId: number, motivo: string) =>
  pedir<void>(`/postulaciones/${postulacionId}/confirmacion-avance`, {
    metodo: 'POST',
    cuerpo: { motivo },
  })

// ---------- Simulacion ----------

export const listarSesiones = () => pedir<SesionPanel[]>('/sesiones-simulacion')
export const verSesion = (id: number) => pedir<SesionPanel>(`/sesiones-simulacion/${id}`)
export const crearSesion = (datos: CrearSesion) =>
  pedir<SesionPanel>('/sesiones-simulacion', { metodo: 'POST', cuerpo: datos })
export const ampliarCupo = (id: number, cupo: number) =>
  pedir<void>(`/sesiones-simulacion/${id}/cupo`, { metodo: 'POST', cuerpo: { cupo } })
export const cancelarSesion = (id: number, motivo: string) =>
  pedir<void>(`/sesiones-simulacion/${id}/cancelacion`, {
    metodo: 'POST',
    cuerpo: { motivo },
  })

// ---------- Configuracion ----------

export const listarParametros = () => pedir<Parametro[]>('/parametros')
export const editarParametro = (codigo: string, valor: string, motivo: string) =>
  pedir<void>(`/parametros/${codigo}`, { metodo: 'PUT', cuerpo: { valor, motivo } })

export const listarUsuarios = () => pedir<UsuarioEquipo[]>('/usuarios')
export const listarRoles = () => pedir<RolPanel[]>('/roles')
export const listarAreas = () => pedir<AreaPanel[]>('/areas')

export const listarVersionesBanco = () =>
  pedir<VersionBanco[]>('/banco-preguntas/versiones')
/**
 * La plantilla Excel entra tal cual: multipart, el navegador pone el tipo.
 * Si el archivo tiene problemas, el backend contesta 400 con la lista completa
 * y no importa nada: la version solo se crea si todo el Excel es coherente.
 */
export const importarBanco = (
  archivo: File,
  nivelPuestoCodigo: string,
  etiqueta: string,
) => {
  const formulario = new FormData()
  formulario.append('archivo', archivo)
  formulario.append('nivelPuestoCodigo', nivelPuestoCodigo)
  formulario.append('etiqueta', etiqueta)
  return pedir<VersionBanco>('/banco-preguntas/importaciones', {
    metodo: 'POST',
    formulario,
  })
}

export const listarPlantillasEvaluacion = () =>
  pedir<PlantillaEvaluacionPanel[]>('/plantillas-evaluacion')
export const listarVersionesPesos = () => pedir<VersionPesos[]>('/pesos/versiones')

export const listarPlantillasPrueba = () =>
  pedir<PlantillaPruebaPanel[]>('/plantillas-prueba')

/**
 * ⚠️ **Esto deberia ser una llamada y son varias.** El backend no expone
 * `GET /plantillas-prueba/{id}/versiones`: solo deja pedir una version suelta
 * por su id. Y la vacante necesita el id de la VERSION —no el de la
 * plantilla— para poder publicarse.
 *
 * Asi que se tantean los ids en orden y se para tras tres huecos seguidos.
 * Cada hueco deja un 404 en la consola: es feo, y es lo que hay hasta que el
 * backend abra la ruta. Ese dia esta funcion se borra entera.
 */
export async function listarVersionesPrueba(
  huecosSeguidos = 3,
): Promise<VersionPrueba[]> {
  const encontradas: VersionPrueba[] = []
  let huecos = 0
  for (let id = 1; huecos < huecosSeguidos; id++) {
    const version = await pedir<{ version: VersionPrueba }>(
      `/plantillas-prueba/versiones/${id}`,
    )
      .then((r) => r.version)
      .catch(() => null)
    if (version) {
      encontradas.push(version)
      huecos = 0
    } else {
      huecos++
    }
  }
  return encontradas
}

// ---------- La configuracion de una vacante ----------
// Sin estas cuatro no se puede publicar: el backend exige plantilla de
// evaluacion (si la evaluacion esta encendida) y version de prueba.

export const asignarPlantillaEvaluacion = (
  vacanteId: number,
  plantillaEvaluacionId: number,
) =>
  pedir<void>(`/vacantes/${vacanteId}/plantilla-evaluacion`, {
    metodo: 'POST',
    cuerpo: { plantillaEvaluacionId },
  })

export const asignarPlantillaPrueba = (
  vacanteId: number,
  versionPlantillaPruebaId: number,
) =>
  pedir<void>(`/vacantes/${vacanteId}/plantilla-prueba`, {
    metodo: 'POST',
    cuerpo: { versionPlantillaPruebaId },
  })

/** Apagada, quien postula no recibe cuestionario del banco. */
export const aplicarEvaluacion = (vacanteId: number, aplica: boolean) =>
  pedir<void>(`/vacantes/${vacanteId}/aplicacion-evaluacion`, {
    metodo: 'POST',
    cuerpo: { aplica },
  })

export const asignarVersionPesos = (vacanteId: number, versionPesosId: number) =>
  pedir<void>(`/vacantes/${vacanteId}/version-pesos`, {
    metodo: 'POST',
    cuerpo: { versionPesosId },
  })
