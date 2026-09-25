/**
 * El terreno de «buscar vacantes en el portal» (spec `buscar-vacantes.md`).
 *
 * Siembra vacantes con la modalidad, la ciudad del catálogo, la zona y la fecha
 * de publicación que cada criterio pide, y las retira enteras al terminar. Lo
 * sembrado se reconoce por la MARCA al principio de la descripción —no del
 * título, porque el orden por relevancia mira si el título EMPIEZA por lo
 * buscado y un prefijo lo rompería—.
 *
 * ⚠️ **Las vacantes publicadas que ya había se esconden mientras corre la
 * suite, y se devuelven al final.** Los criterios cuentan («9 vacantes
 * abiertas», «Lima (2)», «Sin indicar (5)») y una publicada ajena cambia cada
 * cifra. Se esconden pasándolas a BORRADOR y dejando en su zona una marca con
 * el valor anterior, para que `devolverLasEscondidas` las restaure aunque una
 * corrida anterior haya muerto a mitad: la marca vive en la base, no en un
 * archivo que se pierda.
 *
 * ⚠️ **La auditoría no se borra**: la base impide el DELETE sobre `auditoria`
 * a propósito; no tiene clave ajena a la vacante, así que retirar la vacante
 * no la necesita.
 */

import { literal, sql } from './base-de-datos'
import { API, tokenDelPanel } from './ayuda'
import { borrarCuentasDePrueba, correoDePrueba, crearCuentaDeCandidato } from './ayuda-candidato'

/** La marca que reconoce lo sembrado por estas pruebas, y solo lo suyo. */
export const MARCA = 'QA-BUSCAR-FB5A'
const ESCONDIDA = `${MARCA}|`
const PREFIJO_DE_CORREO = 'e2e.buscar'

type Fila = Record<string, string | number | null>

function consultar(consulta: string): Fila[] {
  return JSON.parse(sql(`select coalesce(json_agg(f), '[]') from (${consulta}) f;`)) as Fila[]
}

function uno(consulta: string): Fila {
  const filas = consultar(consulta)
  if (filas.length !== 1) throw new Error(`Se esperaba una sola fila y llegaron ${filas.length}: ${consulta}`)
  return filas[0]!
}

/** Un `insert … returning` leído como fila (en CTE: Postgres no admite un INSERT como subconsulta). */
function insertar(consulta: string): Fila {
  const filas = JSON.parse(sql(`with f as (${consulta}) select coalesce(json_agg(f), '[]') from f;`)) as Fila[]
  if (filas.length !== 1) throw new Error(`La inserción devolvió ${filas.length} filas: ${consulta}`)
  return filas[0]!
}

export interface Semilla {
  clave: string
  titulo: string
  /** Tal cual se guarda: «Presencial», «PRESENCIAL», «Hibrido», «test»… */
  modalidad?: string | null
  /** El código del catálogo: `1501` Lima, `0401` Arequipa, `0801` Cusco. */
  ciudad?: string | null
  /** La zona o referencia (la columna `ubicacion`). */
  zona?: string | null
  horario?: string | null
  proposito?: string | null
  /**
   * Hace cuántos días se publicó: un número (2 o más), `'hoy'`, `'ayer'` o
   * `null` para dejarla sin fecha. Con la hora de la base, que es la que el
   * portal lee en la cabecera `Date`.
   */
  hace?: number | 'hoy' | 'ayer' | null
  estado?: 'PUBLICADA' | 'BORRADOR' | 'CERRADA'
  archivada?: boolean
  eliminada?: boolean
}

/**
 * Las nueve de producción del 24/09/2026, con la ciudad que la spec da por
 * puesta: Lima en las dos de Lima, Arequipa y zona «Selva Alegre» en las dos
 * de Selva Alegre, y las cinco sin ciudad. Las fechas se reparten para que el
 * orden por fecha sea inequívoco; «Infraestructura» va sin fecha (AC-14).
 */
export const COMO_PRODUCCION: Semilla[] = [
  { clave: 'administrador', titulo: 'Administrador', modalidad: 'PRESENCIAL', ciudad: '1501', zona: 'Lima', horario: 'Tiempo completo', hace: 'ayer' },
  { clave: 'talento', titulo: 'Especialista en Gestión del Talento', modalidad: 'Presencial', ciudad: '0401', zona: 'Selva Alegre', horario: '9am-6pm', hace: 2 },
  { clave: 'civil', titulo: 'Ingeniero Civil Builder Junior', hace: 3 },
  { clave: 'marketing', titulo: 'Especialista en Marketing Digital', modalidad: 'Presencial', ciudad: '0401', zona: 'Selva Alegre', horario: '9am-6pm', hace: 5 },
  { clave: 'web', titulo: 'Desarrollador web', hace: 9 },
  { clave: 'asistente', titulo: 'Asistente Administrativo', modalidad: 'PRESENCIAL', ciudad: '1501', horario: 'Tiempo completo', hace: 12 },
  { clave: 'arquitecto', titulo: 'Arquitecto Builder Junior', hace: 15 },
  { clave: 'lider', titulo: 'Líder de operaciones', hace: 20 },
  { clave: 'infra', titulo: 'Ingeniero/a de Infraestructura', hace: null },
]

/** El orden por fecha que sale de `COMO_PRODUCCION`: la sin fecha al final. */
export const ORDEN_POR_FECHA = [
  'Administrador',
  'Especialista en Gestión del Talento',
  'Ingeniero Civil Builder Junior',
  'Especialista en Marketing Digital',
  'Desarrollador web',
  'Asistente Administrativo',
  'Arquitecto Builder Junior',
  'Líder de operaciones',
  'Ingeniero/a de Infraestructura',
]

/**
 * El orden de «Relevantes» sin texto (decisión del usuario del 25/09/2026): las
 * más completas primero. Todas las sembradas traen propósito y ninguna publica
 * sueldo, así que las cuatro con modalidad, ciudad y horario suman 4 de 5 y las
 * otras cinco, 1. Entre iguales, por fecha; «Infraestructura», sin fecha, al final.
 */
export const ORDEN_POR_COMPLETITUD = [
  'Administrador',
  'Especialista en Gestión del Talento',
  'Especialista en Marketing Digital',
  'Asistente Administrativo',
  'Ingeniero Civil Builder Junior',
  'Desarrollador web',
  'Arquitecto Builder Junior',
  'Líder de operaciones',
  'Ingeniero/a de Infraestructura',
]

/** Cuarenta publicadas con ciudades, modalidades y fechas repartidas: el «muro». */
export function muro(cuantas = 40): Semilla[] {
  const ciudades = ['1501', '0401', '0801', null]
  const modalidades = ['Presencial', 'Híbrido', 'Remoto', null]
  return Array.from({ length: cuantas }, (_, i) => ({
    clave: `muro-${i + 1}`,
    titulo: `Puesto ${String(i + 1).padStart(2, '0')} del muro`,
    modalidad: modalidades[i % 4],
    ciudad: ciudades[i % 4],
    zona: i % 5 === 0 ? 'Zona de referencia larga para partir la línea' : null,
    horario: i % 3 === 0 ? 'Tiempo completo' : null,
    hace: i === 0 ? 'hoy' : i === 1 ? 'ayer' : i,
  }))
}

function fechaDe(hace: Semilla['hace']): string {
  if (hace === undefined || hace === null) return 'null'
  if (hace === 'hoy') return "now() - interval '10 minutes'"
  if (hace === 'ayer') return "now() - interval '1 day'"
  return `now() - interval '${hace} days'`
}

function plantilla(): Fila {
  return uno(`select solicitud_talento_id, puesto_id, version_pesos_id, organizacion_id
                from vacante order by id limit 1`)
}

function responsable(): number {
  return Number(uno("select id from usuario where usuario_renaser_os_id = 'dev-equipo'").id)
}

/** Siembra y devuelve los ids por clave. */
export function sembrar<K extends string>(semillas: (Semilla & { clave: K })[]): Record<K, number> {
  const base = plantilla()
  const quien = responsable()
  const ids = {} as Record<K, number>
  for (const s of semillas) {
    const estado = s.estado ?? 'PUBLICADA'
    const archivada = s.archivada ? 'now()' : 'null'
    const eliminada = s.eliminada ? 'now()' : 'null'
    ids[s.clave] = Number(insertar(`
      insert into vacante (organizacion_id, solicitud_talento_id, puesto_id, titulo, descripcion, proposito,
                           modalidad, horario, ubicacion, ciudad_ubigeo, tipo_cierre, estado, version_pesos_id,
                           responsable_usuario_id, aplica_evaluacion, instrumento_etapa_tecnica,
                           remuneracion_tipo, publicada_en, archivada_en, eliminada_en)
      values (${base.organizacion_id}, ${base.solicitud_talento_id}, ${base.puesto_id},
              ${literal(s.titulo)}, ${literal(`${MARCA} · ${s.titulo}`)},
              ${literal(s.proposito ?? `Lo que se espera de ${s.titulo}: sostener la operación y dejar el turno cubierto.`)},
              ${literal(s.modalidad ?? null)}, ${literal(s.horario ?? null)}, ${literal(s.zona ?? null)},
              ${literal(s.ciudad ?? null)}, 'PERMANENTE', ${literal(estado)}, ${base.version_pesos_id},
              ${quien}, false, 'PLANTILLA', 'OCULTA', ${fechaDe(s.hace)}, ${archivada}, ${eliminada})
      returning id`).id)
  }
  return ids
}

/** Cambia la ciudad guardada de una vacante sembrada (para «con las de Arequipa sin ciudad»). */
export function ponerCiudad(vacanteId: number, ciudad: string | null): void {
  sql(`update vacante set ciudad_ubigeo = ${literal(ciudad)}
        where id = ${vacanteId} and descripcion like ${literal(`${MARCA}%`)};`)
}

export const vacanteEnBase = (vacanteId: number): Fila =>
  uno(`select titulo, descripcion, modalidad, horario, ubicacion, ciudad_ubigeo, estado
         from vacante where id = ${vacanteId}`)

/** Los avisos de una vacante, los nuevos al final. */
export function avisosDe(vacanteId: number): Fila[] {
  return consultar(`
    select id, tipo, titulo, cuerpo, usuario_id, postulacion_id
      from aviso_portal where vacante_id = ${vacanteId} order by id`)
}

export interface Postulante {
  correo: string
  usuarioId: number
  postulacionId: number
}

/** Cuentas de candidato de verdad (las crea la API) con su postulación en carrera puesta a mano. */
export async function postulantesEnCarrera(vacanteId: number, cuantos: number): Promise<Postulante[]> {
  const organizacion = Number(uno(`select organizacion_id from vacante where id = ${vacanteId}`).organizacion_id)
  const salida: Postulante[] = []
  for (let i = 0; i < cuantos; i++) {
    const correo = correoDePrueba(`${PREFIJO_DE_CORREO}.carrera`)
    await crearCuentaDeCandidato({ nombre: 'Postulante', apellidos: `Buscar ${i + 1}`, correo })
    const usuarioId = Number(uno(`select id from usuario where correo = ${literal(correo)}`).id)
    const fila = insertar(`
      insert into postulacion (organizacion_id, usuario_id, vacante_id, estado_codigo)
      values (${organizacion}, ${usuarioId}, ${vacanteId}, 'PERFIL_POR_CONFIRMAR')
      returning id`)
    salida.push({ correo, usuarioId, postulacionId: Number(fila.id) })
  }
  return salida
}

// ---------- esconder y devolver lo que ya había ----------

/**
 * Pasa a BORRADOR las publicadas que no son de esta suite, marcando en su zona
 * el valor anterior. Devuelve cuántas escondió.
 */
export function esconderLasDemas(): number {
  devolverLasEscondidas()
  return Number(sql(`
    with e as (
      update vacante
         set estado = 'BORRADOR',
             ubicacion = ${literal(ESCONDIDA)} || coalesce(ubicacion, '')
       where estado = 'PUBLICADA' and eliminada_en is null and archivada_en is null
         and (descripcion is null or descripcion not like ${literal(`${MARCA}%`)})
      returning id)
    select count(*) from e;`))
}

/** Devuelve a PUBLICADA lo escondido y restaura su zona tal como estaba. */
export function devolverLasEscondidas(): void {
  sql(`
    update vacante
       set estado = 'PUBLICADA',
           ubicacion = nullif(substr(ubicacion, ${ESCONDIDA.length + 1}), '')
     where ubicacion like ${literal(`${ESCONDIDA}%`)};`)
}

// ---------- la solicitud que respalda un alta ----------

/**
 * Una solicitud aprobada y sin vacante, creada por la API como la crearía el
 * panel: es lo único que deja al alta ofrecer sus campos.
 */
export async function solicitudAbierta(): Promise<number> {
  const token = await tokenDelPanel()
  const area = Number(uno('select id from area where organizacion_id = 1 order by id limit 1').id)
  // El puesto manda su nivel y su familia: la solicitud tiene que decir los mismos.
  const puesto = uno('select id, nivel_puesto_codigo, familia_codigo from puesto where organizacion_id = 1 order by id limit 1')
  const quien = responsable()
  const pedir = async (camino: string, cuerpo: unknown) => {
    const r = await fetch(`${API}/panel${camino}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    })
    const texto = await r.text()
    if (!r.ok) throw new Error(`${camino} contestó ${r.status}: ${texto}`)
    return texto ? (JSON.parse(texto) as Record<string, unknown>) : {}
  }
  const creada = await pedir('/solicitudes', {
    areaId: area,
    puestoId: Number(puesto.id),
    urgencia: 'NORMAL',
    nivelPuestoCodigo: String(puesto.nivel_puesto_codigo),
    familiaCodigo: String(puesto.familia_codigo),
    resultadoPrincipal: `${MARCA} Sostener la operación de la sede`,
    motivo: 'El equipo actual no llega',
    consecuenciaNoContratar: 'Se retrasa la apertura',
    analisisCapacidad: 'Se evaluó redistribuir y no alcanza',
    responsableUsuarioId: quien,
    resultadosEsperados: [
      { descripcion: 'Abrir la sede', indicador: 'en marcha' },
      { descripcion: 'Formar al equipo', indicador: 'tres personas' },
      { descripcion: 'Dejar el turno cubierto', indicador: 'sin huecos' },
    ],
  })
  const id = Number(creada.id)
  await pedir(`/solicitudes/${id}/aprobacion`, { motivo: 'Aprobada para la prueba' })
  return id
}

// ---------- retirar ----------

/**
 * Quita lo sembrado y nada más: las cuentas por su correo exacto, las vacantes
 * por su marca y las solicitudes por la suya. Se llama también ANTES de
 * sembrar, por si una corrida anterior murió a mitad.
 */
export function retirarLoSembrado(correos: readonly string[] = []): void {
  const huerfanos = consultar(
    `select correo from usuario where correo like ${literal(`${PREFIJO_DE_CORREO}.%@example.com`)}`,
  ).map((f) => String(f.correo))
  const todos = [...new Set([...correos, ...huerfanos])]
  if (todos.length) borrarCuentasDePrueba(todos)

  const sembradas = consultar(
    `select id from vacante where descripcion like ${literal(`${MARCA}%`)}`,
  ).map((f) => Number(f.id))
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

  const solicitudes = consultar(
    `select id from solicitud_talento where resultado_principal like ${literal(`${MARCA}%`)}`,
  ).map((f) => Number(f.id))
  if (solicitudes.length) {
    const ids = solicitudes.join(',')
    sql(`
      begin;
      delete from resultado_esperado where solicitud_talento_id in (${ids});
      delete from evidencia_necesidad where solicitud_talento_id in (${ids});
      delete from solicitud_talento where id in (${ids});
      commit;`)
  }
}
