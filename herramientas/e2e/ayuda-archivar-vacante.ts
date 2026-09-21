/**
 * El terreno de «archivar una vacante cerrada y traerla de vuelta».
 *
 * ⚠️ **No toca las vacantes sembradas de la base, y es a propósito.** Archivar
 * una de ellas la sacaría de `/admin` para todas las demás pruebas, que la
 * buscan por su título y no la encontrarían. Aquí se siembra un terreno propio,
 * reconocible por su marca, y se retira entero al terminar.
 *
 * Lo que se siembra es exactamente lo que pide la «Verificación específica» de
 * la spec:
 *
 *   · una CERRADA **sin nadie en carrera**: la que se archiva y se desarchiva;
 *   · una CERRADA **con una postulación en carrera**: la que no se puede
 *     archivar, y que además sirve para comprobar que el candidato no se entera
 *     de nada;
 *   · una PUBLICADA: la que no ofrece archivar y la que demuestra que la lista
 *     habitual sigue entera después;
 *   · una cuenta de panel **sin `cerrar_vacante`**, para mirar el permiso desde
 *     fuera.
 *
 * ⚠️ **La auditoría no se borra**: la base impide el DELETE sobre `auditoria` a
 * propósito. Archivar SÍ audita, así que la vacante marcada deja filas que se
 * quedan — es correcto y no estorba: cuelgan de un `entidad_id` que ya no
 * existe y ninguna pantalla las lee. Lo que no puede quedarse son las cuentas,
 * y por eso la del panel nunca archiva con éxito: se queda en el 403.
 */

import { literal, sql } from './base-de-datos'
import { API, tokenDelPanel } from './ayuda'
import { borrarCuentasDePrueba, correoDePrueba, crearCuentaDeCandidato } from './ayuda-candidato'

/** La marca que reconoce lo sembrado por estas pruebas, y solo lo suyo. */
export const MARCA = 'QA-ARCHIVO-B119'

export const TITULO_SOLA = `${MARCA} Cerrada sin nadie`
export const TITULO_CON_GENTE = `${MARCA} Cerrada con una en carrera`
export const TITULO_VIVA = `${MARCA} Publicada que sigue viva`

/** El id de RENASER OS de la cuenta de panel que no puede cerrar vacantes. */
export const PANEL_SIN_ARCHIVO = 'qa-archivo-b119-sin-permiso'

/**
 * La cuenta que SÍ puede archivar, pero solo las suyas.
 *
 * El alcance es la otra mitad del permiso, y contesta distinto: lo que está
 * fuera de él no es «no puedes» sino «no existe» —404 y no 403—, porque un 403
 * confirmaría que esa vacante está ahí. Lo sembrado es de otro responsable, así
 * que para esta cuenta no existe ninguna.
 */
export const PANEL_ACOTADO = 'qa-archivo-b119-sus-vacantes'

/** El rol propio de esa cuenta: se estrena aquí y se retira con lo demás. */
const ROL_ACOTADO = `${MARCA}_SUS_VACANTES`

export interface Escenario {
  sola: number
  conGente: number
  viva: number
  /** La persona que sigue en carrera en `conGente`: su proceso no puede moverse. */
  enCarrera: { correo: string; usuarioId: number; postulacionId: number; uuid: string }
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

/** Cuándo se archivó esa vacante, o `null` si está en la lista habitual. */
export const archivadaEn = (vacanteId: number): string | null => {
  const valor = uno(`select archivada_en from vacante where id = ${vacanteId}`).archivada_en
  return valor === null ? null : String(valor)
}

export const estadoDe = (vacanteId: number): string =>
  String(uno(`select estado from vacante where id = ${vacanteId}`).estado)

export const estadoDeLaPostulacion = (postulacionId: number): string =>
  String(uno(`select estado_codigo from postulacion where id = ${postulacionId}`).estado_codigo)

/**
 * Cuántas veces se ha anotado que esa vacante se archivó.
 *
 * Archivar deja UNA fila por archivo: dos filas diciendo «de no archivada a
 * archivada» para el mismo archivo no son ruido, son una trazabilidad que ya no
 * se puede leer —¿se archivó dos veces? ¿cuál de las dos fechas vale?—. La
 * auditoría no se borra a propósito, así que se cuenta antes y después en vez de
 * esperar un total.
 */
export const archivadosAnotadosDe = (vacanteId: number): number =>
  Number(uno(`select count(*) as n from auditoria
                where entidad = 'vacante' and entidad_id = ${vacanteId}
                  and accion = 'archivar_vacante'`).n)

/** Cuántos avisos tiene esa persona. Archivar no puede mover este número. */
export const avisosDe = (usuarioId: number): number =>
  Number(uno(`select count(*) as n from aviso_portal where usuario_id = ${usuarioId}`).n)

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

  const sola = crearVacante(plantilla, responsable, TITULO_SOLA, 'CERRADA')
  const conGente = crearVacante(plantilla, responsable, TITULO_CON_GENTE, 'CERRADA')
  const viva = crearVacante(plantilla, responsable, TITULO_VIVA, 'PUBLICADA')

  // Cerrar una vacante NO cierra sus postulaciones (RF-14): por eso una cerrada
  // puede tener a alguien esperando una decisión, y por eso archivarla sería
  // esconderlo de la mesa de trabajo.
  const correo = correoDePrueba('e2e.archivo.viva')
  await crearCuentaDeCandidato({ nombre: 'Postulante', apellidos: 'De Prueba', correo })
  const usuarioId = Number(uno(`select id from usuario where correo = ${literal(correo)}`).id)
  const postulacion = insertar(`
    insert into postulacion (organizacion_id, usuario_id, vacante_id, estado_codigo)
    values (${plantilla.organizacion_id}, ${usuarioId}, ${conGente}, 'PERFIL_POR_CONFIRMAR')
    returning id, uuid`)

  sembrarCuentaDePanel(Number(plantilla.organizacion_id))

  return {
    sola,
    conGente,
    viva,
    enCarrera: {
      correo,
      usuarioId,
      postulacionId: Number(postulacion.id),
      uuid: String(postulacion.uuid),
    },
    correos: [correo],
  }
}

function crearVacante(plantilla: Fila, responsable: number, titulo: string, estado: string): number {
  return Number(insertar(`
    insert into vacante (organizacion_id, solicitud_talento_id, puesto_id, titulo, descripcion,
                         tipo_cierre, estado, version_pesos_id, responsable_usuario_id,
                         aplica_evaluacion, instrumento_etapa_tecnica, remuneracion_tipo,
                         publicada_en, cerrada_en)
    values (${plantilla.organizacion_id}, ${plantilla.solicitud_talento_id}, ${plantilla.puesto_id},
            ${literal(titulo)}, 'Sembrada por las pruebas de archivo de vacantes.',
            'PERMANENTE', ${literal(estado)}, ${plantilla.version_pesos_id},
            ${responsable}, false, 'PLANTILLA', 'OCULTA',
            now(), ${estado === 'CERRADA' ? 'now()' : 'null'})
    returning id`).id)
}

/**
 * La cuenta de panel con la que se mira el permiso desde fuera.
 *
 * Entra por el `dev-login`, que busca al usuario del equipo por su id de
 * RENASER OS: por eso se crea con uno fijo y reconocible. Lleva
 * `RESPONSABLE_AREA`, que en las semillas ve las vacantes (`ver_vacantes` con
 * alcance TODO) y no puede cerrarlas — que es exactamente el caso que hay que
 * mirar: consultar Archivadas sí, archivar no.
 */
function sembrarCuentaDePanel(organizacionId: number): void {
  const rolSinArchivo = Number(
    uno(`select id from rol where organizacion_id = ${organizacionId} and codigo = 'RESPONSABLE_AREA'`).id,
  )
  /*
   * El rol acotado se estrena aquí en vez de tocar uno de las semillas: si la
   * prueba muere a mitad, lo que queda tocado es suyo y de nadie más.
   */
  const rolAcotado = Number(insertar(`
    insert into rol (organizacion_id, codigo, nombre, descripcion)
    values (${organizacionId}, ${literal(ROL_ACOTADO)}, 'QA · archiva solo las suyas',
            'Sembrado por las pruebas de archivo de vacantes')
    returning id`).id)
  sql(`
    insert into rol_permiso (rol_id, permiso_id, alcance)
    select ${rolAcotado}, id, 'SUS_VACANTES' from permiso where codigo = 'cerrar_vacante';
    insert into rol_permiso (rol_id, permiso_id, alcance)
    select ${rolAcotado}, id, 'TODO' from permiso where codigo = 'ver_vacantes';`)

  for (const [renaserOsId, rolId] of [
    [PANEL_SIN_ARCHIVO, rolSinArchivo],
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
  const r = await fetch(`${API}/panel${camino}`, {
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
 * Quita lo sembrado y nada más: las vacantes por su marca, las cuentas de
 * candidato por su correo exacto y la de panel por su id de RENASER OS.
 *
 * Se llama también ANTES de sembrar: si una ejecución murió a mitad, la
 * siguiente no puede encontrarse el terreno a medio poner.
 */
export function retirarLoSembrado(correos: readonly string[] = []): void {
  const sembradas = consultar(
    `select id from vacante where titulo like ${literal(`${MARCA}%`)}`,
  ).map((f) => Number(f.id))

  const huerfanos = consultar(
    `select correo from usuario where correo like 'e2e.archivo.%@example.com'`,
  ).map((f) => String(f.correo))
  const todos = [...new Set([...correos, ...huerfanos])]
  if (todos.length) borrarCuentasDePrueba(todos)

  if (sembradas.length) {
    const ids = sembradas.join(',')
    sql(`
      begin;
      delete from aviso_portal where vacante_id in (${ids});
      delete from postulacion where vacante_id in (${ids});
      delete from requisito_objetivo where vacante_id in (${ids});
      delete from plantilla_correo_vacante where vacante_id in (${ids});
      delete from ficha_vacante where vacante_id in (${ids});
      delete from vacante where id in (${ids});
      commit;`)
  }

  const cuentas = `(${literal(PANEL_SIN_ARCHIVO)}, ${literal(PANEL_ACOTADO)})`
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
