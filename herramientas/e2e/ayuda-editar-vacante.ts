/**
 * El terreno de «editar una vacante y avisar a quien sigue en carrera».
 *
 * ⚠️ **No toca las vacantes sembradas, y es a propósito.** Editar de verdad la
 * vacante de `18-ranking` o de `23-remuneracion` le deja un aviso en la campana
 * a cada candidato sembrado —que no lleva correo `@example.com` y que
 * `borrarCuentasDePrueba` no alcanza— y mueve cifras que otras pruebas explican
 * de otra forma. Aquí se siembra un terreno propio, reconocible por su marca, y
 * se retira entero al terminar.
 *
 * Lo que se siembra es exactamente lo que pide la «Verificación específica» de
 * la spec: una publicada con sueldo en rango y cuatro postulaciones —dos en
 * carrera, una que no continúa y una contratada—, un borrador sin nadie, y dos
 * cuentas de panel para mirar los permisos desde fuera: una sin `editar_vacante`
 * y otra con el permiso acotado a «sus vacantes».
 *
 * ⚠️ **La auditoría no se borra**: la base impide el DELETE sobre `auditoria` a
 * propósito. Por eso las cuentas de panel de aquí no editan nunca con éxito —se
 * quedan en el 403 y el 404, que no auditan— y se pueden retirar al final.
 */

import { literal, sql } from './base-de-datos'
import { API, tokenDelPanel } from './ayuda'
import { borrarCuentasDePrueba, correoDePrueba, crearCuentaDeCandidato } from './ayuda-candidato'

/** La marca que reconoce lo sembrado por estas pruebas, y solo lo suyo. */
export const MARCA = 'QA-EDITAR-AF4D'

export const TITULO_PUBLICADA = `${MARCA} Analista de datos`
export const TITULO_BORRADOR = `${MARCA} Borrador sin postulantes`
const ROL_ACOTADO = `${MARCA}_SUS_VACANTES`

/** Los ids de RENASER OS de las dos cuentas de panel de estas pruebas. */
export const PANEL_SIN_PERMISO = 'qa-editar-af4d-sin-permiso'
export const PANEL_ACOTADO = 'qa-editar-af4d-sus-vacantes'

/** Lo que la vacante publicada dice que paga antes de que nadie la toque. */
export const SUELDO_SEMBRADO = { min: 3000, max: 4000, escrito: 'S/ 3 000 a 4 000' }
export const HORARIO_SEMBRADO = 'L-V de 9 a 6'
export const DESCRIPCION_SEMBRADA = 'Lee datos y los cuenta para que alguien decida.'

export interface Postulante {
  correo: string
  usuarioId: number
  postulacionId: number
  uuid: string
  estado: string
}

export interface Escenario {
  publicada: number
  borrador: number
  /** Las dos que siguen vivas: son las que tienen que enterarse de todo. */
  enCarrera: Postulante[]
  /** La que no continúa y la contratada: a estas no les llega nada. */
  terminadas: Postulante[]
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

export function contar(consulta: string): number {
  return Number(sql(`select count(*) from (${consulta}) c;`))
}

/** Los avisos de una vacante, los nuevos al final. */
export function avisosDe(vacanteId: number, tipo?: string): Fila[] {
  return consultar(`
    select id, tipo, titulo, cuerpo, usuario_id, postulacion_id
      from aviso_portal
     where vacante_id = ${vacanteId}
       ${tipo ? `and tipo = ${literal(tipo)}` : ''}
     order by id`)
}

/** Cuántos correos lleva mandados el sistema entero. Ninguna edición lo mueve. */
export const correosEnviados = (): number => contar('select 1 from correo_enviado')

/** Lo que la auditoría guardó de esta vacante, lo último al final. */
export function auditoriasDe(vacanteId: number): Fila[] {
  return consultar(`
    select id, accion, valor_anterior::text as anterior, valor_nuevo::text as nuevo, motivo
      from auditoria
     where entidad = 'vacante' and entidad_id = ${vacanteId}
     order by id`)
}

export const vacanteEnBase = (vacanteId: number): Fila =>
  uno(`select titulo, descripcion, horario, ubicacion, estado, plazas,
              remuneracion_tipo, remuneracion_min, remuneracion_max,
              responsable_usuario_id
         from vacante where id = ${vacanteId}`)

// ---------- sembrar ----------

/**
 * Deja el terreno como lo pide la spec, borrando antes lo que quedara de un
 * intento anterior: una prueba que solo pasa la primera vez no sirve de nada.
 */
export async function sembrarEscenario(): Promise<Escenario> {
  retirarLoSembrado()

  const responsable = Number(uno("select id from usuario where usuario_renaser_os_id = 'dev-equipo'").id)
  const plantilla = uno(`select solicitud_talento_id, puesto_id, version_pesos_id, organizacion_id
                           from vacante order by id limit 1`)

  const publicada = Number(insertar(`
    insert into vacante (organizacion_id, solicitud_talento_id, puesto_id, titulo, descripcion,
                         horario, tipo_cierre, estado, version_pesos_id, responsable_usuario_id,
                         aplica_evaluacion, instrumento_etapa_tecnica,
                         remuneracion_tipo, remuneracion_min, remuneracion_max, remuneracion_moneda,
                         publicada_en)
    values (${plantilla.organizacion_id}, ${plantilla.solicitud_talento_id}, ${plantilla.puesto_id},
            ${literal(TITULO_PUBLICADA)}, ${literal(DESCRIPCION_SEMBRADA)},
            ${literal(HORARIO_SEMBRADO)}, 'PERMANENTE', 'PUBLICADA', ${plantilla.version_pesos_id},
            ${responsable}, false, 'PLANTILLA',
            'RANGO', ${SUELDO_SEMBRADO.min}, ${SUELDO_SEMBRADO.max}, 'PEN', now())
    returning id`).id)

  const borrador = Number(insertar(`
    insert into vacante (organizacion_id, solicitud_talento_id, puesto_id, titulo, descripcion,
                         tipo_cierre, estado, version_pesos_id, responsable_usuario_id,
                         aplica_evaluacion, instrumento_etapa_tecnica, remuneracion_tipo)
    values (${plantilla.organizacion_id}, ${plantilla.solicitud_talento_id}, ${plantilla.puesto_id},
            ${literal(TITULO_BORRADOR)}, 'Todavía no la ve nadie.',
            'PERMANENTE', 'BORRADOR', ${plantilla.version_pesos_id},
            ${responsable}, false, 'PLANTILLA', 'OCULTA')
    returning id`).id)

  const enCarrera: Postulante[] = []
  const terminadas: Postulante[] = []
  for (const [prefijo, estado] of [
    ['e2e.editar.viva.uno', 'PERFIL_POR_CONFIRMAR'],
    ['e2e.editar.viva.dos', 'PRUEBA_TURNO_CANDIDATO'],
    ['e2e.editar.fuera', 'NO_CONTINUA'],
    ['e2e.editar.dentro', 'CONTRATADO'],
  ] as const) {
    const postulante = await postularA(publicada, prefijo, estado, Number(plantilla.organizacion_id))
    ;(estado === 'NO_CONTINUA' || estado === 'CONTRATADO' ? terminadas : enCarrera).push(postulante)
  }

  sembrarCuentasDePanel(Number(plantilla.organizacion_id))

  return {
    publicada,
    borrador,
    enCarrera,
    terminadas,
    correos: [...enCarrera, ...terminadas].map((p) => p.correo),
  }
}

/** Una cuenta de candidato de verdad —la crea la API— con su postulación puesta a mano. */
async function postularA(
  vacanteId: number,
  prefijo: string,
  estado: string,
  organizacionId: number,
): Promise<Postulante> {
  const correo = correoDePrueba(prefijo)
  await crearCuentaDeCandidato({ nombre: 'Postulante', apellidos: 'De Prueba', correo })
  const usuarioId = Number(uno(`select id from usuario where correo = ${literal(correo)}`).id)
  const fila = insertar(`
    insert into postulacion (organizacion_id, usuario_id, vacante_id, estado_codigo)
    values (${organizacionId}, ${usuarioId}, ${vacanteId}, ${literal(estado)})
    returning id, uuid`)
  return {
    correo,
    usuarioId,
    postulacionId: Number(fila.id),
    uuid: String(fila.uuid),
    estado,
  }
}

/**
 * Las dos cuentas de panel con las que se mira el permiso desde fuera.
 *
 * Entran por el `dev-login`, que busca al usuario del equipo por su id de
 * RENASER OS: por eso se crean con uno fijo y reconocible. La acotada estrena un
 * rol propio —`editar_vacante` con alcance `SUS_VACANTES`— en vez de tocar el de
 * Talento: si la prueba muere a mitad, lo que queda tocado es suyo y de nadie
 * más.
 */
function sembrarCuentasDePanel(organizacionId: number): void {
  const rolSinPermiso = Number(
    uno(`select id from rol where organizacion_id = ${organizacionId} and codigo = 'RESPONSABLE_AREA'`).id,
  )
  const rolAcotado = Number(insertar(`
    insert into rol (organizacion_id, codigo, nombre, descripcion)
    values (${organizacionId}, ${literal(ROL_ACOTADO)}, 'QA · solo sus vacantes',
            'Sembrado por las pruebas de edición de vacantes')
    returning id`).id)

  sql(`
    insert into rol_permiso (rol_id, permiso_id, alcance)
    select ${rolAcotado}, id, 'SUS_VACANTES' from permiso where codigo = 'editar_vacante';
    insert into rol_permiso (rol_id, permiso_id, alcance)
    select ${rolAcotado}, id, 'TODO' from permiso where codigo = 'ver_vacantes';`)

  for (const [renaserOsId, rolId] of [
    [PANEL_SIN_PERMISO, rolSinPermiso],
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

/** El token de panel de una de las cuentas sembradas. */
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

/**
 * El cuerpo del PUT tal y como lo manda el formulario del panel: entero.
 *
 * Se arma desde lo que hay guardado para que cambiar un campo sea cambiar UN
 * campo, y no borrar de paso todo lo que el llamador no repitió.
 */
export async function formularioDe(vacanteId: number): Promise<Record<string, unknown>> {
  const { cuerpo } = await pedirAlPanel(`/vacantes/${vacanteId}`)
  const v = cuerpo as Record<string, unknown> & { remuneracion: unknown }
  return {
    solicitudTalentoId: v.solicitudTalentoId,
    responsableUsuarioId: v.responsableUsuarioId,
    titulo: v.titulo,
    descripcion: v.descripcion,
    proposito: v.proposito ?? undefined,
    responsabilidades: v.responsabilidades ?? undefined,
    requisitos: v.requisitos ?? undefined,
    modalidad: v.modalidad ?? undefined,
    horario: v.horario ?? undefined,
    ubicacion: v.ubicacion ?? undefined,
    tipoCierre: v.tipoCierre,
    plazas: v.plazas ?? undefined,
    cierraEn: v.cierraEn ?? undefined,
    remuneracion: v.remuneracion,
  }
}

// ---------- retirar ----------

/**
 * Quita lo sembrado y nada más: las cuentas por su correo exacto, las vacantes
 * por su marca, y las cuentas de panel por su id de RENASER OS.
 *
 * Se llama también ANTES de sembrar: si una ejecución murió a mitad, la
 * siguiente no puede encontrarse el terreno a medio poner.
 */
export function retirarLoSembrado(correos: readonly string[] = []): void {
  const sembradas = consultar(
    `select id from vacante where titulo like ${literal(`${MARCA}%`)}`,
  ).map((f) => Number(f.id))

  const huerfanos = consultar(
    `select correo from usuario where correo like 'e2e.editar.%@example.com'`,
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

  // Las cuentas de panel y su rol. Nunca han editado con éxito —se quedan en el
  // 403 y el 404—, así que no hay auditoría suya que lo impida.
  sql(`
    begin;
    delete from usuario_rol where usuario_id in (
      select id from usuario where usuario_renaser_os_id in
        (${literal(PANEL_SIN_PERMISO)}, ${literal(PANEL_ACOTADO)}));
    delete from usuario where usuario_renaser_os_id in
      (${literal(PANEL_SIN_PERMISO)}, ${literal(PANEL_ACOTADO)});
    delete from persona where apellidos in
      (${literal(PANEL_SIN_PERMISO)}, ${literal(PANEL_ACOTADO)});
    delete from rol_permiso where rol_id in (select id from rol where codigo = ${literal(ROL_ACOTADO)});
    delete from rol where codigo = ${literal(ROL_ACOTADO)};
    commit;`)
}
