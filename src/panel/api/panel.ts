/**
 * Las llamadas del panel, agrupadas por pestaña.
 *
 * Cada funcion es una linea: la ruta y el tipo. La mecanica vive en la puerta.
 */

import { pedir, pedirArchivo } from './cliente'
import type { Archivo } from '@/api/puerta'
import type {
  AceptarInvitacionPanel,
  LoginPanel,
  CrearSolicitud,
  DesgloseEvaluacion,
  AreaPanel,
  ImpactoDeBorrarArea,
  ConteoEmbudo,
  CrearSesion,
  FichaPostulacion,
  InscritoEnSesion,
  GuardarVacante,
  GuardarPuesto,
  NotaCriterioEtapa,
  Parametro,
  PasoHistorialPanel,
  PerfilIntegral,
  PermisoDelRol,
  AlcancePermiso,
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
  NuevaVersionBanco,
  ResultadoDeImportacion,
  PreguntaDelBanco,
  VersionPesos,
  Catalogos,
  SolicitudResumen,
  ValidacionPanel,
  PlantillaPruebaPanel,
  VersionPrueba,
  VersionCompletaPrueba,
  GuardarVersionPrueba,
  ConsignaSubida,
  PreguntaDePrueba,
  GuardarPreguntaDePrueba,
  TipoDePreguntaDePrueba,
  GuardarEntregable,
  GuardarCriterioRubrica,
  RespuestaDePrueba,
  CalificacionEncolada,
  PasadaEncolada,
  CierrePruebaAplicado,
  ElegirInstrumentoTecnico,
  PlazoDePrueba,
  FichaDelPuesto,
  GuardarFichaDelPuesto,
  CuestionarioTecnico,
  GeneracionPedida,
  CorregirPreguntaTecnica,
  PedirExcelDelRanking,
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
/** El código interno lo genera el servidor cuando el panel no lo envía. */
export const crearPuesto = async (datos: GuardarPuesto) =>
  (await pedir<{ id: number }>('/puestos', { metodo: 'POST', cuerpo: datos })).id

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

/**
 * El ranking en Excel, con las filas EN EL ORDEN QUE SE MANDAN.
 *
 * ⚠️ **Es POST y no GET, y no por capricho**: lleva dentro la lista entera de
 * ids ordenada, que en una tanda de ochenta no cabe en una URL. Y por eso mismo
 * no vale un `<a href>`: el token va como `Bearer` en una cabecera, que un
 * enlace no puede poner. El archivo se abre con `createObjectURL`.
 *
 * Solo `PERFIL_INTEGRAL` y `PRUEBA_PUESTO`; cualquier otra etapa sale con 400 y
 * su mensaje, que es el que la pantalla enseña.
 */
export const descargarExcelDelRanking = (
  vacanteId: number,
  datos: PedirExcelDelRanking,
): Promise<Archivo> =>
  pedirArchivo(`/vacantes/${vacanteId}/ranking/excel`, { metodo: 'POST', cuerpo: datos })

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

/**
 * Quien eligio esta fecha.
 *
 * ⚠️ **Pide `ver_inscritos_simulacion`, que no es el permiso con el que se
 * llega a la pantalla.** Los dos GET de sesiones admiten tambien
 * `crear_sesiones_simulacion`, asi que quien organiza fechas puede estar
 * viendo la tabla y recibir un 403 aqui. No es un fallo: es que ver el aforo y
 * ver los nombres son dos preguntas distintas.
 *
 * ⚠️ **La longitud de esto NO es `SesionPanel.inscritos`.** Con alcance
 * acotado el backend recorta la lista, y el conteo de la sesion se recorta a
 * juego solo si tambien se tiene este permiso.
 */
export const listarInscritos = (sesionId: number) =>
  pedir<InscritoEnSesion[]>(`/sesiones-simulacion/${sesionId}/inscritos`)

/**
 * Pasar lista. Marcar que no asistio lo devuelve a la bandeja del equipo, que
 * decide entre darle otra fecha o cerrar — nunca es automatico.
 */
export const marcarAsistencia = (inscripcionId: number, asistio: boolean) =>
  pedir<void>(`/inscripciones/${inscripcionId}/asistencia`, {
    metodo: 'POST',
    cuerpo: { asistio },
  })

// ---------- Configuracion ----------

export const listarParametros = () => pedir<Parametro[]>('/parametros')
export const editarParametro = (codigo: string, valor: string, motivo: string) =>
  pedir<void>(`/parametros/${codigo}`, { metodo: 'PUT', cuerpo: { valor, motivo } })

export const listarUsuarios = () => pedir<UsuarioEquipo[]>('/usuarios')
export const listarRoles = () => pedir<RolPanel[]>('/roles')

// ---------- Que puede cada rol ----------
//
// Las tres piden `administrar_permisos`, que es un permiso aparte de
// `crear_usuarios_y_asignar_roles` a proposito: dar un rol a alguien es una
// cosa, redefinir lo que ese rol significa es otra bastante mayor.
//
// ⚠️ **Un cambio aqui vale desde la peticion siguiente de cada afectado.** El
// backend relee los permisos en cada llamada, asi que nadie tiene que volver a
// entrar — y nadie recibe aviso de que su alcance cambio.

export const permisosDelRol = (rolId: number) =>
  pedir<PermisoDelRol[]>(`/roles/${rolId}/permisos`)

/** Conceder, o cambiar el alcance si ya lo tenia. El motivo se audita. */
export const concederPermiso = (
  rolId: number,
  codigo: string,
  alcance: AlcancePermiso,
  motivo: string,
) =>
  pedir<void>(`/roles/${rolId}/permisos/${codigo}`, {
    metodo: 'PUT',
    cuerpo: { alcance, motivo },
  })

/**
 * Quitarle el permiso al rol.
 *
 * **POST y no DELETE porque el motivo va en el cuerpo** y hay proxies que
 * descartan el cuerpo de un DELETE. Misma forma que la cancelacion de una
 * sesion.
 *
 * ⚠️ El backend **rechaza con 409 quitar el ultimo `administrar_permisos`**:
 * dejaria el reparto sin nadie que pudiera volver a tocarlo. Ese mensaje se
 * enseña tal cual.
 */
export const revocarPermiso = (rolId: number, codigo: string, motivo: string) =>
  pedir<void>(`/roles/${rolId}/permisos/${codigo}/revocacion`, {
    metodo: 'POST',
    cuerpo: { motivo },
  })
// ---------- Las areas de la organizacion ----------
//
// El area es la estructura de la empresa, y **sin una no se puede registrar una
// solicitud de talento**: es la pieza mas pequeña del panel con las
// consecuencias mas grandes.
//
// ⚠️ **Dos listas, y no es una duplicidad.** `/areas` trae solo las activas y la
// abre `ver_solicitudes`, porque es la que llena el desplegable al registrar una
// solicitud —una area retirada ahi seria una solicitud nueva colgada de algo
// cerrado—. `/areas/todas` trae tambien las retiradas y pide
// `crear_usuarios_y_asignar_roles`. Solo la segunda permite volver a encender
// algo: quien use la primera para una pantalla de administracion vera
// desaparecer lo que acaba de desactivar, sin forma de recuperarlo.

/** Las activas. Es la que alimenta cualquier desplegable de eleccion de area. */
export const listarAreas = () => pedir<AreaPanel[]>('/areas')

/** Todas, vivas y retiradas. La unica que deja reactivar. */
export const listarTodasLasAreas = () => pedir<AreaPanel[]>('/areas/todas')

/** Devuelve solo el id: el backend responde `{ "id": 7 }`. */
export const crearArea = async (nombre: string) =>
  (await pedir<{ id: number }>('/areas', { metodo: 'POST', cuerpo: { nombre } })).id

/**
 * Cambiarle el nombre. Lo que cuelga del area no se toca.
 *
 * ⚠️ El backend responde **409 si ya existe otra area con ese nombre** en la
 * empresa (`UNIQUE (organizacion_id, nombre)`), y el mensaje viene escrito en
 * español: se enseña tal cual. Guardar el mismo nombre no es error, no hace nada.
 */
export const renombrarArea = (id: number, nombre: string) =>
  pedir<void>(`/areas/${id}`, { metodo: 'PUT', cuerpo: { nombre } })

/** Retirarla de la lista sin borrar nada. Se deshace con `reactivarArea`. */
export const desactivarArea = (id: number) =>
  pedir<void>(`/areas/${id}/desactivacion`, { metodo: 'POST' })

export const reactivarArea = (id: number) =>
  pedir<void>(`/areas/${id}/reactivacion`, { metodo: 'POST' })

/** Cuantas solicitudes y cuantas personas habria que mover. Se pide ANTES de borrar. */
export const impactoDeBorrarArea = (id: number) =>
  pedir<ImpactoDeBorrarArea>(`/areas/${id}/impacto`)

/**
 * Borrar el area de verdad, moviendo antes lo que colgaba de ella.
 *
 * ⚠️ **`areaDestinoId` no es opcional en la practica.** Las dos claves ajenas que
 * apuntan al area —la solicitud de talento y el usuario— no declaran `ON DELETE`,
 * asi que el borrado falla mientras quede una fila. Sin destino el backend
 * responde **409 con los dos recuentos dentro**, y ese mensaje se enseña tal cual
 * porque dice exactamente que hace falta.
 *
 * **POST y no DELETE**: el destino y el motivo van en el cuerpo, y hay proxies
 * que descartan el cuerpo de un DELETE. Misma forma que la revocacion de un
 * permiso.
 */
export const borrarArea = (id: number, areaDestinoId: number | null, motivo: string) =>
  pedir<void>(`/areas/${id}/borrado`, {
    metodo: 'POST',
    cuerpo: { areaDestinoId, motivo },
  })

/**
 * Las versiones que esta organizacion ve.
 *
 * ⚠️ **Ver no implica poder tocar.** Una empresa que no personalizo el banco ve
 * aqui las versiones de la plataforma, y publicar o archivar cualquiera de
 * ellas contesta **404** —el backend compara el `organizacionId` y a lo ajeno
 * lo trata como inexistente—. `VersionBancoResponse` no trae el dueño, asi que
 * desde aqui no hay forma de saberlo antes: se aprende del primer 404.
 */
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
  return pedir<ResultadoDeImportacion>('/banco-preguntas/importaciones', {
    metodo: 'POST',
    formulario,
  })
}

/** Una version vacia en borrador, para llenarla despues. */
export const crearVersionBanco = (datos: NuevaVersionBanco) =>
  pedir<{ id: number }>('/banco-preguntas/versiones', {
    metodo: 'POST',
    cuerpo: datos,
  })

/**
 * Publicar valida la coherencia de cada formato, cierra la version y **archiva
 * a todas las publicadas hermanas** —mismo tipo de banco y mismo nivel—, no
 * solo a la ultima.
 *
 * ⚠️ **La validacion para en la primera pregunta que falla.** El mensaje del
 * 409 nombra un solo codigo; si hay tres rotas, hacen falta tres intentos. Se
 * dice en pantalla para que nadie lea ese mensaje como la lista completa.
 */
export const publicarVersionBanco = (id: number) =>
  pedir<void>(`/banco-preguntas/versiones/${id}/publicacion`, { metodo: 'POST' })

/**
 * Archivar retira la version. Quien no empezo su evaluacion pasa al reemplazo;
 * quien ya empezo conserva la suya, porque su examen esta armado con esas
 * preguntas y un banco archivado guarda sus claves.
 *
 * ⚠️ **Sin reemplazo publicado, el backend contesta 409 y dice a cuanta gente
 * dejaria sin banco.** Ese numero no se calcula aqui: se enseña el suyo.
 */
export const archivarVersionBanco = (id: number) =>
  pedir<void>(`/banco-preguntas/versiones/${id}/archivado`, { metodo: 'POST' })

/**
 * Descartar borra el borrador entero: sus preguntas, opciones, tramos, campos
 * y pares. **No se deshace y no hay papelera.**
 */
export const descartarBorradorBanco = (id: number) =>
  pedir<void>(`/banco-preguntas/versiones/${id}`, { metodo: 'DELETE' })

/**
 * Renombrar es correccion editorial y **solo vale sobre una PUBLICADA**: un
 * borrador se edita entero y una archivada ya no se toca. Las dos contestan 409.
 */
export const renombrarVersionBanco = (id: number, etiqueta: string) =>
  pedir<void>(`/banco-preguntas/versiones/${id}/etiqueta`, {
    metodo: 'PATCH',
    cuerpo: { etiqueta },
  })

/** Lo que hay dentro de una version, para poder mirarla antes de publicarla. */
export const verPreguntasDeVersion = (id: number) =>
  pedir<PreguntaDelBanco[]>(`/banco-preguntas/versiones/${id}/preguntas`)

export const listarPlantillasEvaluacion = () =>
  pedir<PlantillaEvaluacionPanel[]>('/plantillas-evaluacion')
export const listarVersionesPesos = () => pedir<VersionPesos[]>('/pesos/versiones')

// ---------- Las pruebas del puesto ----------
// Una plantilla es «la prueba de Analista»; sus versiones son los intentos de
// escribirla. Se compone en BORRADOR y publicar la congela: desde ahi solo se
// corrige creando otra version, porque quien la este rindiendo queda atado a la
// suya. Todos los `actualizar*` y `quitar*` de aqui abajo contestan **409 sobre
// una PUBLICADA**, y ese 409 llega con su texto en español: se enseña tal cual.

export const listarPlantillasPrueba = () =>
  pedir<PlantillaPruebaPanel[]>('/plantillas-prueba')

/** Sin `puestoId` la plantilla es generica y sirve para cualquier vacante. */
export const crearPlantillaPrueba = (nombre: string, puestoId: number | null) =>
  pedir<{ id: number }>('/plantillas-prueba', {
    metodo: 'POST',
    cuerpo: { nombre, puestoId },
  })

/**
 * Las versiones de una plantilla, de la mas nueva a la mas vieja.
 *
 * Hasta el 31/08 esta ruta no existia y aqui habia un **tanteo de ids**: se
 * pedian de ocho en ocho hasta dar con un hueco, dejando 404 legitimos en la
 * consola y sin encontrar nada si las versiones de la empresa vivian altas.
 * Ya no. Si vuelve a aparecer codigo que adivina ids, es que alguien deshizo
 * esto.
 *
 * Vienen **todas**, borradores incluidos: quien compone necesita ver el suyo, y
 * quien elige para una vacante necesita distinguir «no hay ninguna» de «hay una
 * sin publicar». El `estado` dice cual se puede usar.
 */
export const listarVersionesPrueba = (plantillaId: number) =>
  pedir<VersionPrueba[]>(`/plantillas-prueba/${plantillaId}/versiones`)

/** La version entera: enunciado, variantes, preguntas, entregables y rubrica. */
export const verVersionDePrueba = (versionId: number) =>
  pedir<VersionCompletaPrueba>(`/plantillas-prueba/versiones/${versionId}`)

export const crearVersionDePrueba = (
  plantillaId: number,
  datos: GuardarVersionPrueba,
) =>
  pedir<{ id: number }>(`/plantillas-prueba/${plantillaId}/versiones`, {
    metodo: 'POST',
    cuerpo: datos,
  })

/** ⚠️ **Reemplaza la version entera.** Lo que no viaje en `datos` se borra. */
export const actualizarVersionDePrueba = (
  versionId: number,
  datos: GuardarVersionPrueba,
) =>
  pedir<void>(`/plantillas-prueba/versiones/${versionId}`, {
    metodo: 'PUT',
    cuerpo: datos,
  })

/**
 * Publicar congela la version y la deja elegible para una vacante.
 *
 * ⚠️ **La validacion para en la primera regla que falla**, como la del banco: el
 * 400 nombra un solo problema aunque haya tres. Por eso la pantalla lleva los
 * contadores en vivo —la suma de la rubrica y las cuotas de preguntas—: para no
 * descubrir lo que falta de uno en uno.
 */
export const publicarVersionDePrueba = (versionId: number) =>
  pedir<void>(`/plantillas-prueba/versiones/${versionId}/publicacion`, {
    metodo: 'POST',
  })

/**
 * Sube el ENUNCIADO como archivo (PDF o Word), y nada mas.
 *
 * ⚠️ **No es la prueba entera.** De un PDF no sale ninguna nota: subirlo no crea
 * preguntas, ni entregables, ni criterios, y publicar sigue exigiendo lo mismo.
 * Es el papel que lee el candidato y el que va enlazado en el correo.
 *
 * ⚠️ **El enlace caduca**: el bucket es privado y la firma dura 180 dias. Por eso
 * la respuesta trae `expira`.
 */
export const subirConsignaDePrueba = (versionId: number, archivo: File) => {
  const formulario = new FormData()
  formulario.append('archivo', archivo)
  return pedir<ConsignaSubida>(
    `/plantillas-prueba/versiones/${versionId}/consigna`,
    { metodo: 'POST', formulario },
  )
}

/** El catalogo de preguntas, que es **global**: lo comparten todas las versiones. */
export const listarPreguntasDePrueba = (tipo?: TipoDePreguntaDePrueba) =>
  pedir<PreguntaDePrueba[]>(
    tipo === undefined
      ? '/plantillas-prueba/preguntas'
      : `/plantillas-prueba/preguntas?tipo=${tipo}`,
  )

export const crearPreguntaDePrueba = (datos: GuardarPreguntaDePrueba) =>
  pedir<{ id: number }>('/plantillas-prueba/preguntas', {
    metodo: 'POST',
    cuerpo: datos,
  })

export const elegirPreguntaDePrueba = (versionId: number, preguntaPruebaId: number) =>
  pedir<void>(`/plantillas-prueba/versiones/${versionId}/preguntas`, {
    metodo: 'POST',
    cuerpo: { preguntaPruebaId },
  })

/** Quitarla de esta version. ⚠️ **Sigue en el catalogo**: otras versiones la usan. */
export const quitarPreguntaDePrueba = (versionId: number, preguntaId: number) =>
  pedir<void>(`/plantillas-prueba/versiones/${versionId}/preguntas/${preguntaId}`, {
    metodo: 'DELETE',
  })

export const agregarEntregableDePrueba = (versionId: number, datos: GuardarEntregable) =>
  pedir<{ id: number }>(`/plantillas-prueba/versiones/${versionId}/entregables`, {
    metodo: 'POST',
    cuerpo: datos,
  })

export const actualizarEntregableDePrueba = (
  entregableId: number,
  datos: GuardarEntregable,
) =>
  pedir<void>(`/plantillas-prueba/entregables/${entregableId}`, {
    metodo: 'PUT',
    cuerpo: datos,
  })

export const quitarEntregableDePrueba = (entregableId: number) =>
  pedir<void>(`/plantillas-prueba/entregables/${entregableId}`, { metodo: 'DELETE' })

export const agregarCriterioRubrica = (
  versionId: number,
  datos: GuardarCriterioRubrica,
) =>
  pedir<{ id: number }>(`/plantillas-prueba/versiones/${versionId}/rubrica`, {
    metodo: 'POST',
    cuerpo: datos,
  })

export const actualizarCriterioRubrica = (
  criterioId: number,
  datos: GuardarCriterioRubrica,
) =>
  pedir<void>(`/plantillas-prueba/rubrica/${criterioId}`, {
    metodo: 'PUT',
    cuerpo: datos,
  })

/** Es lo que deshace una rubrica que se paso de 100 puntos. */
export const quitarCriterioRubrica = (criterioId: number) =>
  pedir<void>(`/plantillas-prueba/rubrica/${criterioId}`, { metodo: 'DELETE' })

export const agregarVarianteDeCambio = (versionId: number, texto: string) =>
  pedir<{ id: number }>(`/plantillas-prueba/versiones/${versionId}/variantes`, {
    metodo: 'POST',
    cuerpo: { texto },
  })

export const actualizarVarianteDeCambio = (varianteId: number, texto: string) =>
  pedir<void>(`/plantillas-prueba/variantes/${varianteId}`, {
    metodo: 'PUT',
    cuerpo: { texto },
  })

export const quitarVarianteDeCambio = (varianteId: number) =>
  pedir<void>(`/plantillas-prueba/variantes/${varianteId}`, { metodo: 'DELETE' })

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

/**
 * Qué se rinde en la etapa técnica de esta vacante, y en cuántos minutos.
 *
 * ⚠️ Publicar exige tener listo el que se elija, y cambiarlo con candidatos dentro se
 * frena en el servidor (409): todos se miden con la misma vara. Los minutos cuentan
 * como parte de esa vara, así que bajarlos a mitad de tanda se frena igual.
 */
export const elegirInstrumentoTecnico = (
  vacanteId: number,
  datos: ElegirInstrumentoTecnico,
) =>
  pedir<void>(`/vacantes/${vacanteId}/instrumento-tecnico`, { metodo: 'POST', cuerpo: datos })

export const asignarVersionPesos = (vacanteId: number, versionPesosId: number) =>
  pedir<void>(`/vacantes/${vacanteId}/version-pesos`, {
    metodo: 'POST',
    cuerpo: { versionPesosId },
  })


// ---------- La prueba por dentro: lo escrito, la IA y el plazo ----------

/** Lo que contesto el candidato, pregunta a pregunta. */
export const verRespuestasDePrueba = (postulacionId: number) =>
  pedir<RespuestaDePrueba[]>(`/postulaciones/${postulacionId}/prueba/respuestas`)

/**
 * Pedirle al agente que califique la prueba de esta persona.
 *
 * ⚠️ **No pisa lo ajustado a mano** y **no devuelve la nota**: encola y
 * contesta al momento. Lo unico honesto que se puede decir despues es que se
 * pidio; la nota aparece cuando el agente termina y se vuelve a pedir.
 */
/**
 * Pondera las notas ya puestas y produce la nota de la etapa.
 *
 * ⚠️ **Sin esto, calificar con IA no deja nota en el ranking.** El agente pone
 * la nota de cada criterio; la de la etapa —la que sale en la columna y con la
 * que se ordena— nace SOLO aqui. En la base local hay una postulacion con sus
 * siete criterios calificados y la columna en blanco por esto exactamente.
 *
 * ⚠️ **Exige que esten TODOS los criterios de la rubrica.** Si falta alguno
 * contesta 409 nombrandolos uno a uno, en español, y ese mensaje se enseña tal
 * cual: es la lista de lo que hay que calificar antes.
 */
export const calcularNotaDePrueba = (postulacionId: number) =>
  pedir<{ nota: number }>(`/postulaciones/${postulacionId}/prueba/calificacion`, {
    metodo: 'POST',
  })

export const calificarPruebaConIa = (postulacionId: number) =>
  pedir<CalificacionEncolada>(`/postulaciones/${postulacionId}/prueba/calificacion-ia`, {
    metodo: 'POST',
  })

/** Lo mismo para el retrato: currículum y evaluación del banco juntos. */
export const calificarPerfilIntegralConIa = (postulacionId: number) =>
  pedir<CalificacionEncolada>(
    `/postulaciones/${postulacionId}/calificacion-perfil-integral`,
    { metodo: 'POST' },
  )

/**
 * La tanda entera de una vez.
 *
 * La rapida es el modelo que no razona, en paralelo: ordena, no decide, y sus
 * notas quedan marcadas como provisionales. La fina vuelve sobre la parte alta
 * —cuanta, lo dice el parametro `porcentaje_criba_fina`— y **pisa** aquellas.
 */
export const cribaRapida = (vacanteId: number) =>
  pedir<PasadaEncolada>(`/vacantes/${vacanteId}/criba-rapida`, { metodo: 'POST' })

export const cribaFina = (vacanteId: number) =>
  pedir<PasadaEncolada>(`/vacantes/${vacanteId}/criba-fina`, { metodo: 'POST' })

/**
 * Cuando cierra la prueba de esta vacante, para todos.
 *
 * Con `cierraEn` en nulo se quita, y cada intento vuelve a contar los dias de
 * su plantilla. El motivo es obligatorio y queda en la auditoria.
 */
export const definirCierreDePrueba = (
  vacanteId: number,
  cierraEn: string | null,
  motivo: string,
) =>
  pedir<CierrePruebaAplicado>(`/vacantes/${vacanteId}/cierre-prueba`, {
    metodo: 'POST',
    cuerpo: { cierraEn, motivo },
  })

/** La fecha de UNA persona, que manda sobre la de la vacante. */
export const definirPlazoDePrueba = (
  postulacionId: number,
  venceEn: string,
  motivo: string,
) =>
  pedir<PlazoDePrueba>(`/postulaciones/${postulacionId}/prueba/plazo`, {
    metodo: 'POST',
    cuerpo: { venceEn, motivo },
  })

// ---------- La prueba tecnica del puesto ----------
// La ficha que llena el dueño y el cuestionario que redacta el agente REDACTOR
// a partir de ella. Cinco rutas bajo la vacante. El 404 de la ficha significa
// «todavia no se ha empezado», no una averia.

export const verFichaDelPuesto = (vacanteId: number) =>
  pedir<FichaDelPuesto>(`/vacantes/${vacanteId}/ficha`)
/** ⚠️ Reemplazo completo: van los 22 campos siempre, o lo que falte se borra. */
export const guardarFichaDelPuesto = (vacanteId: number, datos: GuardarFichaDelPuesto) =>
  pedir<FichaDelPuesto>(`/vacantes/${vacanteId}/ficha`, { metodo: 'PUT', cuerpo: datos })

export const verCuestionarioTecnico = (vacanteId: number) =>
  pedir<CuestionarioTecnico>(`/vacantes/${vacanteId}/cuestionario-tecnico`)
/**
 * Pedirle el borrador al REDACTOR. Contesta 202 al momento: la IA tarda uno o
 * dos minutos. `encolada=false` = ya hay una generacion viva o la IA esta
 * apagada. Exige la ficha COMPLETA (409 si no). Cuenta contra el tope de IA.
 */
export const generarCuestionarioTecnico = (vacanteId: number) =>
  pedir<GeneracionPedida>(`/vacantes/${vacanteId}/cuestionario-tecnico/generacion`, {
    metodo: 'POST',
  })
export const corregirPreguntaTecnica = (
  vacanteId: number,
  preguntaId: number,
  datos: CorregirPreguntaTecnica,
) =>
  pedir<void>(`/vacantes/${vacanteId}/cuestionario-tecnico/preguntas/${preguntaId}`, {
    metodo: 'PUT',
    cuerpo: datos,
  })
/** El acto humano: vuelve a pasar la aduana entera y archiva la publicada anterior. */
export const publicarCuestionarioTecnico = (vacanteId: number) =>
  pedir<void>(`/vacantes/${vacanteId}/cuestionario-tecnico/publicacion`, { metodo: 'POST' })

/**
 * Pone o corrige la nota de UN criterio, a mano.
 *
 * ⚠️ **El endpoint existía desde siempre y nadie lo llamaba.** La rúbrica marca
 * criterio por criterio quién lo mira: los que dicen AGENTE se le mandan a la
 * IA y los que dicen PERSONA **jamás salen hacia el modelo**. Sin esta llamada,
 * una rúbrica con un solo criterio de persona —el video de sustentación de las
 * pruebas de marketing y de talento— no tenía forma de completarse desde
 * ninguna pantalla, y la nota de la etapa se quedaba sin poder calcularse para
 * siempre. Se veía como «le falta 1 de 6 criterios» y ningún botón.
 *
 * ⚠️ **Pisa lo que hubiera, y eso es lo que se quiere.** Si el criterio ya
 * tenía nota de la IA, el servidor la sustituye y además registra quién la
 * cambió y con qué motivo. La explicación es obligatoria justamente por eso.
 *
 * El puntaje va de 0 a los puntos de ESE criterio, no a 100: uno que vale 10 no
 * admite un 80. El servidor lo rechaza con un 400 que nombra el máximo.
 */
export const ponerNotaCriterioPrueba = (
  postulacionId: number,
  criterioId: number,
  puntaje: number,
  explicacion: string,
) =>
  pedir<void>(`/postulaciones/${postulacionId}/prueba/criterios/${criterioId}/nota`, {
    metodo: 'POST',
    cuerpo: { puntaje, explicacion },
  })

/**
 * Lo mismo para la simulación.
 *
 * Mismo cuerpo y misma forma, pero **otro permiso**: aquí manda
 * `calificar_simulacion` y en la prueba manda `ajustar_nota`. Quien traduzca el
 * 403 a palabras tiene que decir el que toca.
 */
export const ponerNotaCriterioSimulacion = (
  postulacionId: number,
  criterioId: number,
  puntaje: number,
  explicacion: string,
) =>
  pedir<void>(`/postulaciones/${postulacionId}/simulacion/criterios/${criterioId}/nota`, {
    metodo: 'POST',
    cuerpo: { puntaje, explicacion },
  })
