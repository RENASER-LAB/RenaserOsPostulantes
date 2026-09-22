/**
 * El terreno de «eliminar una vacante que no debió existir».
 *
 * ⚠️ **No toca las vacantes sembradas de la base, y aquí menos que nunca.**
 * Eliminar una de ellas la retiraría del panel y del portal para todas las
 * demás pruebas, y sin botón para traerla de vuelta. Se siembra un terreno
 * propio, reconocible por su marca, y se retira entero al terminar.
 *
 * Lo que se siembra es lo que pide la «Verificación específica» de la spec:
 *
 *   · una PUBLICADA con **2 postulaciones en carrera, 1 NO_CONTINUA y 1
 *     CONTRATADO**: la que se elimina, y la que demuestra a quién se cierra y a
 *     quién no;
 *   · una PUBLICADA que se queda viva: la que demuestra que lo que se retiró es
 *     una sola fila;
 *   · una ARCHIVADA: se elimina sin tener que desarchivarla antes;
 *   · un BORRADOR: el caso más común de vacante mal creada, y donde el archivo
 *     ni siquiera se ofrece;
 *   · una cuenta de panel **sin `eliminar_vacante`**, para mirar el permiso
 *     desde fuera, y otra **con el permiso acotado a sus vacantes**, que no
 *     dirige ninguna: lo que no alcanza contesta 404, no 403.
 *
 * ⚠️ **Lo inmutable no se borra**, y son dos cosas, no una:
 *
 *   · **La auditoría**: la base impide el DELETE sobre `auditoria` a propósito.
 *     Eliminar SÍ audita, así que la vacante marcada deja filas que se quedan —
 *     cuelgan de un `entidad_id` que ya no existe y ninguna pantalla las lee.
 *   · **Las transiciones de estado**, por lo mismo (V6). Eliminar la vacante
 *     cierra las postulaciones en carrera, y ese cierre queda escrito: esas dos
 *     postulaciones, la vacante de la que cuelgan y las cuentas que las hicieron
 *     ya no se pueden retirar. Se quedan retiradas del camino —ver
 *     `retirarLoSembrado` y `borrarCuentasDePrueba`— y no estorban: la vacante
 *     que las tiene es una eliminada, y una eliminada no sale ya de ninguna
 *     consulta. Las demás cuentas sí se retiran, y con ellas sus avisos.
 */

import { literal, sql } from './base-de-datos'
import { API, tokenDelPanel } from './ayuda'
import { borrarCuentasDePrueba, correoDePrueba, crearCuentaDeCandidato } from './ayuda-candidato'

/** La marca que reconoce lo sembrado por estas pruebas, y solo lo suyo. */
export const MARCA = 'QA-ELIMINA-830D'

export const TITULO_OBJETIVO = `${MARCA} Publicada con gente dentro`
export const TITULO_VIVA = `${MARCA} Publicada que se queda`
export const TITULO_ARCHIVADA = `${MARCA} Archivada que se elimina`
export const TITULO_BORRADOR = `${MARCA} Borrador mal creado`

/** El id de RENASER OS de la cuenta de panel que no puede eliminar vacantes. */
export const PANEL_SIN_ELIMINAR = 'qa-elimina-830d-sin-permiso'

/**
 * La cuenta que SÍ puede eliminar, pero solo las suyas.
 *
 * El alcance es la otra mitad del permiso y contesta distinto: lo que está
 * fuera de él no es «no puedes» sino «no existe» —404 y no 403—, porque un 403
 * confirmaría que esa vacante está ahí y de ahí se sondea qué ids hay al otro
 * lado. Lo sembrado es de otro responsable, así que para esta cuenta no existe
 * ninguna.
 */
export const PANEL_ACOTADO = 'qa-elimina-830d-sus-vacantes'

/** El rol propio de esa cuenta: se estrena aquí y se retira con lo demás. */
const ROL_ACOTADO = `${MARCA}_SUS_VACANTES`

/** El texto por el que se reconoce —y se retira— la solicitud sembrada. */
const TEXTO_SEMBRADO = 'Sembrada por las pruebas de eliminación de vacantes'

export interface Persona {
  correo: string
  usuarioId: number
  postulacionId: number
  uuid: string
}

export interface Escenario {
  objetivo: number
  viva: number
  archivada: number
  borrador: number
  /** La solicitud que respalda a `objetivo`: tiene que volver a ABIERTA. */
  solicitudDelObjetivo: number
  /** Las dos que siguen en carrera: se cierran y se les avisa. */
  enCarrera: [Persona, Persona]
  /** La descartada y la contratada: no se tocan ni reciben nada. */
  terminadas: [Persona, Persona]
  /** Quien todavía no ha postulado a nada: intenta postular cuando ya no existe. */
  tarde: { correo: string; usuarioId: number }
  correos: string[]
}

type Fila = Record<string, string | number | null>

function consultar(consulta: string): Fila[] {
  return JSON.parse(sql(`select coalesce(json_agg(f), '[]') from (${consulta}) f;`)) as Fila[]
}

function uno(consulta: string): Fila {
  const filas = consultar(consulta)
  if (filas.length !== 1) {
    throw new Error(`Se esperaba una sola fila y llegaron ${filas.length}: ${consulta}`)
  }
  return filas[0]!
}

/**
 * Un `insert … returning` leído como fila.
 *
 * Va en un CTE y no dentro de un `from (…)`: Postgres no admite una escritura
 * como subconsulta, y el error que da —«syntax error at or near INSERT»— no se
 * parece en nada a lo que pasa.
 */
function insertar(consulta: string): Fila {
  const filas = JSON.parse(
    sql(`with f as (${consulta}) select coalesce(json_agg(f), '[]') from f;`),
  ) as Fila[]
  if (filas.length !== 1) {
    throw new Error(`La inserción devolvió ${filas.length} filas: ${consulta}`)
  }
  return filas[0]!
}

// ---------- mirar la base ----------

/** Cuándo se eliminó esa vacante, o `null` si sigue existiendo. */
export const eliminadaEn = (vacanteId: number): string | null => {
  const valor = uno(`select eliminada_en from vacante where id = ${vacanteId}`).eliminada_en
  return valor === null ? null : String(valor)
}

/** El estado de la vacante. Eliminar NO lo cambia: sigue donde estaba. */
export const estadoDe = (vacanteId: number): string =>
  String(uno(`select estado from vacante where id = ${vacanteId}`).estado)

export const estadoDeLaPostulacion = (postulacionId: number): string =>
  String(uno(`select estado_codigo from postulacion where id = ${postulacionId}`).estado_codigo)

/** De qué clase fue el cierre, o `null` si la postulación sigue abierta. */
export const motivoDeCierreDe = (postulacionId: number): string | null => {
  const valor = uno(
    `select motivo_cierre from postulacion where id = ${postulacionId}`,
  ).motivo_cierre
  return valor === null ? null : String(valor)
}

/** En qué estado está la solicitud que respaldaba la vacante. */
export const estadoDeLaSolicitud = (solicitudId: number): string =>
  String(uno(`select estado from solicitud_talento where id = ${solicitudId}`).estado)

/** Cuántos avisos tiene esa persona, de cualquier tipo. */
export const avisosDe = (usuarioId: number): number =>
  Number(uno(`select count(*) as n from aviso_portal where usuario_id = ${usuarioId}`).n)

/** Cuántos avisos de eliminación tiene, y sin enlace: los dos a la vez. */
export const avisosDeEliminacionSinEnlaceDe = (usuarioId: number): number =>
  Number(uno(`select count(*) as n from aviso_portal
                where usuario_id = ${usuarioId} and tipo = 'VACANTE_ELIMINADA'
                  and postulacion_id is null and vacante_id is null`).n)

/**
 * Cuántas veces se ha anotado que esa vacante se eliminó.
 *
 * Una eliminación deja UNA fila. Dos filas diciendo lo mismo no son ruido: son
 * una traza que ya no se puede leer —¿se eliminó dos veces? ¿cuál fecha vale?—.
 * La auditoría no se borra a propósito, así que se cuenta antes y después en
 * vez de esperar un total.
 */
export const eliminacionesAnotadasDe = (vacanteId: number): number =>
  Number(uno(`select count(*) as n from auditoria
                where entidad = 'vacante' and entidad_id = ${vacanteId}
                  and accion = 'eliminar_vacante'`).n)

/** Cuántos correos se le han mandado a esa persona. Eliminar no manda ninguno. */
export const correosDe = (usuarioId: number): number =>
  Number(uno(`select count(*) as n from correo_enviado where usuario_id = ${usuarioId}`).n)

// ---------- sembrar ----------

/**
 * Deja el terreno como lo pide la spec, borrando antes lo que quedara de un
 * intento anterior: una prueba que solo pasa la primera vez no sirve de nada.
 */
export async function sembrarEscenario(): Promise<Escenario> {
  retirarLoSembrado()

  const responsable = Number(
    uno("select id from usuario where usuario_renaser_os_id = 'dev-equipo'").id,
  )
  const plantilla = uno(`select solicitud_talento_id, puesto_id, version_pesos_id, organizacion_id
                           from vacante order by id limit 1`)

  // Una solicitud propia para la vacante que se elimina: es la que tiene que
  // volver a ABIERTA, y usar la de otra vacante ensuciaría ese dato.
  const solicitudDelObjetivo = crearSolicitud(plantilla, responsable)
  const objetivo = crearVacante(plantilla, responsable, TITULO_OBJETIVO, 'PUBLICADA',
    solicitudDelObjetivo)
  const viva = crearVacante(plantilla, responsable, TITULO_VIVA, 'PUBLICADA')
  const archivada = crearVacante(plantilla, responsable, TITULO_ARCHIVADA, 'CERRADA')
  sql(`update vacante set archivada_en = now() where id = ${archivada};`)
  const borrador = crearVacante(plantilla, responsable, TITULO_BORRADOR, 'BORRADOR')

  const organizacion = Number(plantilla.organizacion_id)
  const enCarrera: Persona[] = []
  for (const [i, estado] of ['PERFIL_POR_CONFIRMAR', 'PRUEBA_TURNO_CANDIDATO'].entries()) {
    enCarrera.push(await sembrarPersona(organizacion, objetivo, `e2e.elimina.carrera${i}`,
      estado, null))
  }
  const terminadas: Persona[] = [
    await sembrarPersona(organizacion, objetivo, 'e2e.elimina.descartada', 'NO_CONTINUA',
      'DECISION_PERSONA'),
    await sembrarPersona(organizacion, objetivo, 'e2e.elimina.contratada', 'CONTRATADO', null),
  ]

  // Y quien no ha postulado a nada: es quien intenta hacerlo cuando la vacante
  // ya no existe, que es el caso del formulario abierto desde antes.
  const correoTarde = correoDePrueba('e2e.elimina.tarde')
  await crearCuentaDeCandidato({ nombre: 'Tarde', apellidos: 'De Prueba', correo: correoTarde })
  const tarde = {
    correo: correoTarde,
    usuarioId: Number(uno(`select id from usuario where correo = ${literal(correoTarde)}`).id),
  }

  sembrarCuentasDePanel(organizacion)

  return {
    objetivo,
    viva,
    archivada,
    borrador,
    solicitudDelObjetivo,
    enCarrera: [enCarrera[0]!, enCarrera[1]!],
    terminadas: [terminadas[0]!, terminadas[1]!],
    tarde,
    correos: [...enCarrera, ...terminadas].map((p) => p.correo).concat(correoTarde),
  }
}

async function sembrarPersona(organizacion: number, vacanteId: number, prefijo: string,
                              estado: string, motivoCierre: string | null): Promise<Persona> {
  const correo = correoDePrueba(prefijo)
  await crearCuentaDeCandidato({ nombre: 'Postulante', apellidos: 'De Prueba', correo })
  const usuarioId = Number(uno(`select id from usuario where correo = ${literal(correo)}`).id)
  const fila = insertar(`
    insert into postulacion (organizacion_id, usuario_id, vacante_id, estado_codigo, motivo_cierre)
    values (${organizacion}, ${usuarioId}, ${vacanteId}, ${literal(estado)},
            ${motivoCierre === null ? 'null' : literal(motivoCierre)})
    returning id, uuid`)
  return { correo, usuarioId, postulacionId: Number(fila.id), uuid: String(fila.uuid) }
}

/** Una solicitud APROBADA propia, para poder comprobar que se libera al eliminar. */
function crearSolicitud(plantilla: Fila, responsable: number): number {
  // Se copia de la que ya existe y solo se cambian el estado, los textos y el
  // responsable: la tabla tiene ocho columnas obligatorias más —área, origen,
  // análisis de capacidad— y escribirlas a mano aquí sería inventarse una
  // solicitud que no se parece a las de verdad.
  return Number(insertar(`
    insert into solicitud_talento (organizacion_id, origen, urgencia, estado, area_id,
                                   puesto_id, nivel_puesto_codigo, familia_codigo,
                                   resultado_principal, motivo, consecuencia_no_contratar,
                                   analisis_capacidad, responsable_usuario_id)
    select s.organizacion_id, s.origen, s.urgencia, 'CON_VACANTE', s.area_id,
           s.puesto_id, s.nivel_puesto_codigo, s.familia_codigo,
           ${literal(TEXTO_SEMBRADO)}, ${literal(TEXTO_SEMBRADO)}, ${literal(TEXTO_SEMBRADO)},
           ${literal(TEXTO_SEMBRADO)}, ${responsable}
    from solicitud_talento s where s.id = ${plantilla.solicitud_talento_id}
    returning id`).id)
}

function crearVacante(plantilla: Fila, responsable: number, titulo: string, estado: string,
                      solicitudId?: number): number {
  const solicitud = solicitudId ?? Number(plantilla.solicitud_talento_id)
  return Number(insertar(`
    insert into vacante (organizacion_id, solicitud_talento_id, puesto_id, titulo, descripcion,
                         tipo_cierre, estado, version_pesos_id, responsable_usuario_id,
                         aplica_evaluacion, instrumento_etapa_tecnica, remuneracion_tipo,
                         publicada_en, cerrada_en)
    values (${plantilla.organizacion_id}, ${solicitud}, ${plantilla.puesto_id},
            ${literal(titulo)}, 'Sembrada por las pruebas de eliminación de vacantes.',
            'PERMANENTE', ${literal(estado)}, ${plantilla.version_pesos_id},
            ${responsable}, false, 'PLANTILLA', 'OCULTA',
            ${estado === 'BORRADOR' ? 'null' : 'now()'},
            ${estado === 'CERRADA' ? 'now()' : 'null'})
    returning id`).id)
}

/**
 * Las dos cuentas con las que se mira el permiso desde fuera.
 *
 * Entran por el `dev-login`, que busca al usuario del equipo por su id de
 * RENASER OS: por eso se crean con uno fijo y reconocible. La primera lleva
 * `RESPONSABLE_AREA`, que ve las vacantes y no puede eliminarlas; la segunda
 * estrena un rol propio con `eliminar_vacante` acotado a SUS vacantes, y no
 * dirige ninguna.
 */
function sembrarCuentasDePanel(organizacionId: number): void {
  const rolSinEliminar = Number(
    uno(`select id from rol where organizacion_id = ${organizacionId} and codigo = 'RESPONSABLE_AREA'`).id,
  )
  const rolAcotado = Number(insertar(`
    insert into rol (organizacion_id, codigo, nombre, descripcion)
    values (${organizacionId}, ${literal(ROL_ACOTADO)}, 'QA · elimina solo las suyas',
            'Sembrado por las pruebas de eliminación de vacantes')
    returning id`).id)
  sql(`
    insert into rol_permiso (rol_id, permiso_id, alcance)
    select ${rolAcotado}, id, 'SUS_VACANTES' from permiso where codigo = 'eliminar_vacante';
    insert into rol_permiso (rol_id, permiso_id, alcance)
    select ${rolAcotado}, id, 'TODO' from permiso where codigo = 'ver_vacantes';`)

  for (const [renaserOsId, rolId] of [
    [PANEL_SIN_ELIMINAR, rolSinEliminar],
    [PANEL_ACOTADO, rolAcotado],
  ] as const) {
    const personaId = Number(insertar(`
      insert into persona (nombre, apellidos) values ('QA', ${literal(renaserOsId)}) returning id`).id)
    const usuarioId = Number(insertar(`
      insert into usuario (organizacion_id, persona_id, usuario_renaser_os_id, es_equipo, es_activo)
      values (${organizacionId}, ${personaId}, ${literal(renaserOsId)}, true, true)
      returning id`).id)
    sql(`insert into usuario_rol (usuario_id, rol_id) values (${usuarioId}, ${rolId});`)
  }
}

/** El token de panel de la cuenta sembrada, o de la que se le diga. */
export async function tokenDePanelDe(renaserOsId: string): Promise<string> {
  const r = await fetch(`${API}/panel/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuarioRenaserOsId: renaserOsId }),
  })
  if (!r.ok) throw new Error(`dev-login de ${renaserOsId} falló: ${r.status}`)
  return (await r.json()).token as string
}

/** Una llamada al panel con el token que se le diga. Devuelve estado y cuerpo. */
export async function pedirAlPanel(
  camino: string,
  opciones: { metodo?: string; cuerpo?: unknown; token?: string } = {},
): Promise<{ estado: number; cuerpo: unknown }> {
  const token = opciones.token ?? (await tokenDelPanel())
  return pedir(`${API}/panel${camino}`, token, opciones)
}

/** Lo mismo con el token de un candidato, para las puertas del portal. */
export async function pedirAlPortal(
  camino: string,
  token: string,
  opciones: { metodo?: string; cuerpo?: unknown } = {},
): Promise<{ estado: number; cuerpo: unknown }> {
  return pedir(`${API}/portal${camino}`, token, opciones)
}

/**
 * Postular de verdad, con su currículum: es el caso del formulario que alguien
 * dejó abierto antes de que el equipo eliminara la vacante.
 *
 * Se manda como `multipart`, que es lo que manda el portal, y no como JSON: lo
 * que hay que demostrar es que el POST de esa pantalla se rechaza, y un cuerpo
 * distinto podría rebotar por otra razón y parecer que la guarda funciona.
 */
export async function postularComo(
  token: string,
  vacanteId: number,
): Promise<{ estado: number; cuerpo: unknown }> {
  const formulario = new FormData()
  formulario.append('cv', new Blob(['curriculum de prueba'], { type: 'application/pdf' }),
    'cv.pdf')
  formulario.append('vacanteId', String(vacanteId))
  formulario.append('resultadoOrgulloso', 'Abrí dos sedes en un trimestre')
  formulario.append('aceptaTratamiento', 'true')
  const r = await fetch(`${API}/portal/postulaciones`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formulario,
  })
  const texto = await r.text()
  let cuerpo: unknown = null
  try {
    cuerpo = texto ? JSON.parse(texto) : null
  } catch {
    cuerpo = texto
  }
  return { estado: r.status, cuerpo }
}

/** Cuántas postulaciones tiene esa vacante: eliminarla no puede admitir ni una más. */
export const postulacionesDe = (vacanteId: number): number =>
  Number(uno(`select count(*) as n from postulacion where vacante_id = ${vacanteId}`).n)

async function pedir(
  url: string,
  token: string,
  opciones: { metodo?: string; cuerpo?: unknown },
): Promise<{ estado: number; cuerpo: unknown }> {
  const r = await fetch(url, {
    method: opciones.metodo ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(opciones.cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: opciones.cuerpo !== undefined ? JSON.stringify(opciones.cuerpo) : undefined,
  })
  const texto = await r.text()
  let cuerpo: unknown = null
  try {
    cuerpo = texto ? JSON.parse(texto) : null
  } catch {
    cuerpo = texto
  }
  return { estado: r.status, cuerpo }
}

// ---------- retirar ----------

/**
 * Quita lo sembrado y nada más: las vacantes y su solicitud por la marca, las
 * cuentas de candidato por su correo exacto y las de panel por su id de
 * RENASER OS.
 *
 * Se llama también ANTES de sembrar: si una ejecución murió a mitad, la
 * siguiente no puede encontrarse el terreno a medio poner.
 *
 * ⚠️ **Lo que la eliminación deja escrito no se puede quitar, y no se intenta.**
 * Cerrar una postulación escribe su transición, y `transicion_estado` es
 * inmutable en la base (V6): con historial, ni la postulación ni la vacante de
 * la que cuelga se pueden retirar. Esas dos filas se quedan —ver
 * `borrarCuentasDePrueba`, que hace lo mismo con sus cuentas— y no estorban a la
 * siguiente ejecución: la vacante que las tiene es justo la que las pruebas
 * acaban de eliminar, y una eliminada no sale ya de ninguna consulta, ni del
 * panel, ni del tablón, ni de «Mis procesos». Lo que sí se retira entero es todo
 * lo que sigue vivo y a la vista.
 */
export function retirarLoSembrado(correos: readonly string[] = []): void {
  const sembradas = consultar(
    `select id, solicitud_talento_id from vacante where titulo like ${literal(`${MARCA}%`)}`,
  )

  const huerfanos = consultar(
    `select correo from usuario where correo like 'e2e.elimina.%@example.com'`,
  ).map((f) => String(f.correo))
  const todos = [...new Set([...correos, ...huerfanos])]
  if (todos.length) borrarCuentasDePrueba(todos)

  if (sembradas.length) {
    const ids = sembradas.map((f) => Number(f.id)).join(',')
    sql(`
      begin;
      delete from aviso_portal where vacante_id in (${ids});
      -- Las postulaciones sin historial se van; las que ya tienen transición no
      -- se pueden borrar (V6), y con ellas se queda su vacante.
      delete from postulacion
        where vacante_id in (${ids})
          and not exists (select 1 from transicion_estado t
                           where t.postulacion_id = postulacion.id);
      delete from requisito_objetivo where vacante_id in (${ids});
      delete from plantilla_correo_vacante where vacante_id in (${ids});
      delete from ficha_vacante where vacante_id in (${ids});
      delete from sesion_vacante where vacante_id in (${ids});
      delete from vacante
        where id in (${ids})
          and not exists (select 1 from postulacion p where p.vacante_id = vacante.id);
      commit;`)
  }

  // La solicitud propia se retira después de sus vacantes, por la clave ajena.
  // Se reconoce por su texto y no por el id: lo sembrado tiene que poder
  // limpiarse aunque la ejecución anterior muriera sin devolver nada.
  sql(`delete from solicitud_talento
        where motivo = ${literal(TEXTO_SEMBRADO)}
          and not exists (select 1 from vacante v where v.solicitud_talento_id = solicitud_talento.id);`)

  // La que respalda a una vacante que no se pudo retirar se archiva. Eliminar la
  // vacante la devolvió a ABIERTA —es justo lo que comprueba AC-21—, y una
  // solicitud sembrada ofreciéndose en «Crear vacante» de la siguiente ejecución
  // sería terreno viejo pasando por nuevo.
  sql(`update solicitud_talento set estado = 'ARCHIVADA'
        where motivo = ${literal(TEXTO_SEMBRADO)} and estado <> 'ARCHIVADA';`)

  const cuentas = `(${literal(PANEL_SIN_ELIMINAR)}, ${literal(PANEL_ACOTADO)})`
  sql(`
    begin;
    delete from usuario_rol where usuario_id in (
      select id from usuario where usuario_renaser_os_id in ${cuentas});
    delete from usuario where usuario_renaser_os_id in ${cuentas};
    delete from persona where apellidos in ${cuentas};
    delete from rol_permiso where rol_id in (select id from rol where codigo = ${literal(ROL_ACOTADO)});
    delete from rol where codigo = ${literal(ROL_ACOTADO)};
    commit;`)
}
