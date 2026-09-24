/**
 * El terreno de «Filtros, fecha de postulación y selección en lote».
 *
 * ⚠️ **No toca las vacantes sembradas de la base.** La siembra de siempre trae
 * cuatro postulaciones del mismo día y ninguna calificación con IA: con eso el
 * filtro de fecha y el de la IA no se pueden probar de verdad (un día o un rango
 * dan siempre todo o nada). La spec pide una vacante con al menos 30
 * postulaciones en 5 o más días y estados de IA variados, incluida una fallida:
 * es lo que se siembra aquí, reconocible por su marca, y se retira al terminar.
 *
 * Lo que se siembra:
 *
 *   · `tanda`: una vacante PUBLICADA con **32 postulaciones en 9 días** del
 *     calendario de Lima, con la IA en los cuatro estados, tres ciudades y
 *     algunas sin ciudad, y postulaciones en Perfil integral, Prueba del puesto,
 *     Simulación y cerradas. Dos de ellas caen a ambos lados de una medianoche
 *     de Lima (23:30 y 00:30), para el borde de la zona horaria.
 *   · `otra`: una segunda vacante con tres postulaciones, para comprobar que los
 *     filtros se reinician al cambiar de vacante.
 *   · una cuenta de panel **sin permiso de mover postulaciones** (ni
 *     `mover_postulacion`, ni `confirmar_avance`), que sí ve el ranking.
 *
 * ⚠️ **Las fechas son relativas a hoy** —el día de Lima en que corre la prueba—
 * y no están escritas a mano: una fecha quemada caduca y la prueba empieza a
 * fallar sola un día cualquiera.
 *
 * ⚠️ **Lo que se avanza no se puede borrar.** Avanzar escribe en
 * `transicion_estado`, inmutable (V6): esas postulaciones y sus cuentas se
 * quedan retiradas del camino —ver `borrarCuentasDePrueba`— y la vacante que
 * las tiene se marca eliminada, que la saca de todas las pantallas.
 */

import { correoDePrueba, literal, sql } from './base-de-datos'
import { API } from './ayuda'
import { borrarCuentasDePrueba } from './limpieza-cuentas'

/** La marca que reconoce lo sembrado por estas pruebas, y solo lo suyo. */
export const MARCA = 'QA-FILTROS-43CA'

export const TITULO_TANDA = `${MARCA} Tanda de treinta y dos`
export const TITULO_OTRA = `${MARCA} Otra vacante`

/** El id de RENASER OS de la cuenta de panel que no puede mover postulaciones. */
export const PANEL_SIN_MOVER = 'qa-filtros-43ca-sin-mover'
const ROL_SIN_MOVER = `${MARCA}_SIN_MOVER`

const TEXTO_SEMBRADO = 'Sembrada por las pruebas de filtros y selección en lote'
const PREFIJO_CORREO = 'e2e.filtros43ca'

/** La zona en la que se siembran los días y en la que corre el navegador de la prueba. */
export const ZONA = 'America/Lima'

export type EstadoIa = 'TERMINADA' | 'EN_CURSO' | 'FALLIDA' | 'SIN_EMPEZAR'

export const CIUDADES = {
  '1501': 'Lima — Lima',
  '0801': 'Cusco — Cusco',
  '0401': 'Arequipa — Arequipa',
} as const
export type CodigoCiudad = keyof typeof CIUDADES

export interface Sembrada {
  nombre: string
  correo: string
  postulacionId: number
  /** `AAAA-MM-DD` del calendario de Lima. */
  dia: string
  /** Desplazamiento en días respecto a hoy (0 = hoy). */
  desfase: number
  instante: string
  ia: EstadoIa
  ciudad: CodigoCiudad | null
  estado: string
}

export interface Terreno {
  tanda: number
  otra: number
  hoy: string
  filas: Sembrada[]
  /** Las dos del borde de medianoche: 23:30 del día −12 y 00:30 del día −11, en Lima. */
  medianoche: { antes: Sembrada; despues: Sembrada }
  correos: string[]
}

type Fila = Record<string, string | number | null>

function consultar(consulta: string): Fila[] {
  return JSON.parse(sql(`select coalesce(json_agg(f), '[]') from (${consulta}) f;`)) as Fila[]
}

function uno(consulta: string): Fila {
  const filas = consultar(consulta)
  if (filas.length !== 1) throw new Error(`Se esperaba una sola fila y llegaron ${filas.length}: ${consulta}`)
  return filas[0]!
}

function insertar(consulta: string): Fila {
  const filas = JSON.parse(sql(`with f as (${consulta}) select coalesce(json_agg(f), '[]') from f;`)) as Fila[]
  if (filas.length !== 1) throw new Error(`La inserción devolvió ${filas.length} filas: ${consulta}`)
  return filas[0]!
}

// ---------- los días, en el calendario de Lima ----------

/** `AAAA-MM-DD` de un instante en una zona. `en-CA` escribe justo así. */
export const diaEnZona = (instante: Date | string | number, zona = ZONA): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(instante))

/** Un día movido `n` días del calendario. */
export function sumarDias(dia: string, n: number): string {
  const [a, m, d] = dia.split('-').map(Number)
  return new Date(Date.UTC(a!, m! - 1, d! + n)).toISOString().slice(0, 10)
}

/** Un día de Lima a una hora de Lima, como instante UTC. Lima no cambia de hora: UTC−5 fijo. */
export function instanteEnLima(dia: string, hora: number, minuto: number): string {
  const [a, m, d] = dia.split('-').map(Number)
  return new Date(Date.UTC(a!, m! - 1, d!, hora + 5, minuto)).toISOString()
}

/**
 * La tanda, fila a fila: [desfase en días, hora, minuto, IA, ciudad, estado].
 *
 * Reparto: 9 días distintos; IA 16 calificadas, 3 en curso, 5 fallidas y 8 sin
 * empezar; 14 de Lima, 8 de Cusco, 6 de Arequipa y 4 sin ciudad. Ninguna de las
 * que esperan en Prueba del puesto está fallida: así, conservar «Fallida» al
 * pasar a esa etapa con el corte «Pendiente» deja la tabla vacía a propósito.
 */
const TANDA: [number, number, number, EstadoIa, CodigoCiudad | null, string][] = [
  [-35, 12, 0, 'TERMINADA', '1501', 'PERFIL_POR_CONFIRMAR'],
  [-35, 12, 10, 'SIN_EMPEZAR', '0801', 'NO_CONTINUA'],
  [-35, 12, 20, 'TERMINADA', '0401', 'PRUEBA_POR_CONFIRMAR'],
  [-15, 12, 0, 'FALLIDA', '1501', 'PERFIL_POR_CONFIRMAR'],
  [-15, 12, 10, 'TERMINADA', '0801', 'PERFIL_POR_CONFIRMAR'],
  [-15, 12, 20, 'TERMINADA', null, 'PRUEBA_POR_CONFIRMAR'],
  [-15, 12, 30, 'SIN_EMPEZAR', '1501', 'PERFIL_POR_CONFIRMAR'],
  // El borde de medianoche: 23:30 del −12 y 00:30 del −11, en Lima.
  [-12, 23, 30, 'TERMINADA', '1501', 'PERFIL_POR_CONFIRMAR'],
  [-11, 0, 30, 'TERMINADA', '0801', 'PERFIL_POR_CONFIRMAR'],
  [-9, 12, 0, 'TERMINADA', '1501', 'PERFIL_POR_CONFIRMAR'],
  [-9, 12, 10, 'FALLIDA', '0801', 'PERFIL_POR_CONFIRMAR'],
  [-9, 12, 20, 'EN_CURSO', '0401', 'PERFIL_POR_CONFIRMAR'],
  [-9, 12, 30, 'TERMINADA', '1501', 'PRUEBA_POR_CONFIRMAR'],
  [-9, 12, 40, 'SIN_EMPEZAR', null, 'PERFIL_POR_CONFIRMAR'],
  [-5, 12, 0, 'TERMINADA', '1501', 'PERFIL_POR_CONFIRMAR'],
  [-5, 12, 10, 'TERMINADA', '0801', 'PERFIL_POR_CONFIRMAR'],
  [-5, 12, 20, 'FALLIDA', '1501', 'PERFIL_POR_CONFIRMAR'],
  [-5, 12, 30, 'SIN_EMPEZAR', '0401', 'PRUEBA_POR_CONFIRMAR'],
  [-5, 12, 40, 'TERMINADA', '1501', 'SIMULACION_POR_HABILITAR'],
  [-2, 12, 0, 'EN_CURSO', '1501', 'PERFIL_POR_CONFIRMAR'],
  [-2, 12, 10, 'TERMINADA', '0801', 'PERFIL_POR_CONFIRMAR'],
  [-2, 12, 20, 'SIN_EMPEZAR', '0401', 'PRUEBA_POR_CONFIRMAR'],
  [-2, 12, 30, 'TERMINADA', null, 'NO_CONTINUA'],
  [-1, 12, 0, 'FALLIDA', '1501', 'PERFIL_POR_CONFIRMAR'],
  [-1, 12, 10, 'TERMINADA', '0801', 'PERFIL_POR_CONFIRMAR'],
  [-1, 12, 20, 'SIN_EMPEZAR', '1501', 'PRUEBA_POR_CONFIRMAR'],
  [-1, 12, 30, 'TERMINADA', '0401', 'PERFIL_POR_CONFIRMAR'],
  [-1, 12, 40, 'EN_CURSO', '0801', 'SIMULACION_POR_HABILITAR'],
  // Hoy, pasada la medianoche de Lima: son del día aunque la prueba corra a las 00:10.
  [0, 0, 1, 'FALLIDA', '1501', 'PERFIL_POR_CONFIRMAR'],
  [0, 0, 2, 'TERMINADA', '1501', 'PERFIL_POR_CONFIRMAR'],
  [0, 0, 3, 'SIN_EMPEZAR', '0401', 'PRUEBA_POR_CONFIRMAR'],
  [0, 0, 4, 'SIN_EMPEZAR', null, 'PERFIL_POR_CONFIRMAR'],
]

/** El agente y el estado del trabajo que deja a la fila en ese estado de la IA. */
const TRABAJO_DE: Record<Exclude<EstadoIa, 'SIN_EMPEZAR'>, { agente: string; estado: string }> = {
  // TERMINADA: el que cierra el retrato (POTENCIAL_RIESGO) terminó.
  TERMINADA: { agente: 'POTENCIAL_RIESGO', estado: 'TERMINADO' },
  EN_CURSO: { agente: 'DATOS_CV', estado: 'EN_CURSO' },
  FALLIDA: { agente: 'DATOS_CV', estado: 'FALLIDO' },
}

// ---------- sembrar ----------

/**
 * Deja el terreno como lo pide la spec, borrando antes lo que quedara de un
 * intento anterior: una prueba que solo pasa la primera vez no sirve de nada.
 */
export function sembrarTerreno(ahora: number = Date.now()): Terreno {
  retirarLoSembrado()

  const responsable = Number(uno("select id from usuario where usuario_renaser_os_id = 'dev-equipo'").id)
  // Con la plantilla de prueba de la vacante sembrada de siempre: sin ella el
  // backend no deja avanzar a nadie del perfil a la prueba (409), y el avance
  // real de la barra no se podría comprobar.
  const plantilla = uno(`select solicitud_talento_id, puesto_id, version_pesos_id, organizacion_id,
                                version_plantilla_prueba_id
                           from vacante where eliminada_en is null order by id limit 1`)
  const organizacion = Number(plantilla.organizacion_id)
  const hoy = diaEnZona(ahora)

  const tanda = crearVacante(plantilla, responsable, TITULO_TANDA, crearSolicitud(plantilla, responsable))
  const otra = crearVacante(plantilla, responsable, TITULO_OTRA, crearSolicitud(plantilla, responsable))

  const filas: Sembrada[] = []
  TANDA.forEach(([desfase, hora, minuto, ia, ciudad, estado], i) => {
    const dia = sumarDias(hoy, desfase)
    const nombre = `Postulante ${String(i + 1).padStart(2, '0')}`
    filas.push(sembrarPostulacion(organizacion, tanda, {
      nombre, apellidos: 'Tanda QA', dia, desfase, instante: instanteEnLima(dia, hora, minuto), ia, ciudad, estado,
    }))
  })
  const deLaOtra = [0, 1, 2].map((i) =>
    sembrarPostulacion(organizacion, otra, {
      nombre: `Otra ${i + 1}`, apellidos: 'Vacante QA', dia: sumarDias(hoy, -3), desfase: -3,
      instante: instanteEnLima(sumarDias(hoy, -3), 12, i), ia: 'SIN_EMPEZAR', ciudad: '1501',
      estado: 'PERFIL_POR_CONFIRMAR',
    }))

  sembrarCuentaSinMover(organizacion)

  const antes = filas.find((f) => f.desfase === -12)!
  const despues = filas.find((f) => f.desfase === -11)!
  return {
    tanda,
    otra,
    hoy,
    filas,
    medianoche: { antes, despues },
    correos: [...filas, ...deLaOtra].map((f) => f.correo),
  }
}

function sembrarPostulacion(
  organizacion: number,
  vacante: number,
  f: Omit<Sembrada, 'correo' | 'postulacionId'> & { apellidos: string },
): Sembrada {
  const correo = correoDePrueba(PREFIJO_CORREO)
  const personaId = Number(insertar(`
    insert into persona (nombre, apellidos, ciudad_ubigeo)
    values (${literal(f.nombre)}, ${literal(f.apellidos)}, ${f.ciudad === null ? 'null' : literal(f.ciudad)})
    returning id`).id)
  const usuarioId = Number(insertar(`
    insert into usuario (organizacion_id, persona_id, correo, es_equipo, es_activo)
    values (${organizacion}, ${personaId}, ${literal(correo)}, false, true)
    returning id`).id)
  const postulacionId = Number(insertar(`
    insert into postulacion (organizacion_id, usuario_id, vacante_id, estado_codigo, motivo_cierre,
                             creado_en, movido_en)
    values (${organizacion}, ${usuarioId}, ${vacante}, ${literal(f.estado)},
            ${f.estado === 'NO_CONTINUA' ? literal('DECISION_PERSONA') : 'null'},
            ${literal(f.instante)}::timestamptz, ${literal(f.instante)}::timestamptz)
    returning id`).id)
  if (f.ia !== 'SIN_EMPEZAR') {
    const { agente, estado } = TRABAJO_DE[f.ia]
    sql(`insert into trabajo_ia (organizacion_id, agente_codigo, postulacion_id, estado, modo,
                                 terminado_en, tomado_en)
         values (${organizacion}, ${literal(agente)}, ${postulacionId}, ${literal(estado)}, 'FINA',
                 ${estado === 'EN_CURSO' ? 'null' : 'now()'}, now());`)
  }
  return { ...f, nombre: `${f.nombre} ${f.apellidos}`, correo, postulacionId }
}

function crearSolicitud(plantilla: Fila, responsable: number): number {
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

function crearVacante(plantilla: Fila, responsable: number, titulo: string, solicitud: number): number {
  return Number(insertar(`
    insert into vacante (organizacion_id, solicitud_talento_id, puesto_id, titulo, descripcion,
                         tipo_cierre, estado, version_pesos_id, responsable_usuario_id,
                         aplica_evaluacion, instrumento_etapa_tecnica, remuneracion_tipo, publicada_en,
                         version_plantilla_prueba_id)
    values (${plantilla.organizacion_id}, ${solicitud}, ${plantilla.puesto_id},
            ${literal(titulo)}, ${literal(TEXTO_SEMBRADO)}, 'PERMANENTE', 'PUBLICADA',
            ${plantilla.version_pesos_id}, ${responsable}, false, 'PLANTILLA', 'OCULTA', now(),
            ${plantilla.version_plantilla_prueba_id ?? 'null'})
    returning id`).id)
}

/**
 * La cuenta de panel que VE el ranking y no puede mover a nadie: un rol propio
 * con los permisos de mirar y ninguno de mover ni de confirmar avances.
 */
function sembrarCuentaSinMover(organizacionId: number): void {
  const rol = Number(insertar(`
    insert into rol (organizacion_id, codigo, nombre, descripcion)
    values (${organizacionId}, ${literal(ROL_SIN_MOVER)}, 'QA · mira sin mover',
            ${literal(TEXTO_SEMBRADO)})
    returning id`).id)
  sql(`
    insert into rol_permiso (rol_id, permiso_id, alcance)
    select ${rol}, id, 'TODO' from permiso
     where codigo in ('ver_vacantes', 'ver_embudo', 'ver_perfil_integral', 'ver_candidatos',
                      'abrir_ficha_candidato', 'ver_cv_completo');`)
  const personaId = Number(insertar(`
    insert into persona (nombre, apellidos) values ('QA', ${literal(PANEL_SIN_MOVER)}) returning id`).id)
  const usuarioId = Number(insertar(`
    insert into usuario (organizacion_id, persona_id, usuario_renaser_os_id, es_equipo, es_activo)
    values (${organizacionId}, ${personaId}, ${literal(PANEL_SIN_MOVER)}, true, true)
    returning id`).id)
  sql(`insert into usuario_rol (usuario_id, rol_id) values (${usuarioId}, ${rol});`)
}

// ---------- mirar la base ----------

export const estadoDeLaPostulacion = (postulacionId: number): string =>
  String(uno(`select estado_codigo from postulacion where id = ${postulacionId}`).estado_codigo)

/** Cuántas transiciones tiene esa postulación: descartar o avanzar deja una. */
export const transicionesDe = (postulacionId: number): number =>
  Number(uno(`select count(*) as n from transicion_estado where postulacion_id = ${postulacionId}`).n)

/** El token de panel de una cuenta sembrada. */
export async function tokenDePanelDe(renaserOsId: string): Promise<string> {
  const r = await fetch(`${API}/panel/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuarioRenaserOsId: renaserOsId }),
  })
  if (!r.ok) throw new Error(`dev-login de ${renaserOsId} falló: ${r.status}`)
  return (await r.json()).token as string
}

// ---------- retirar ----------

/**
 * Quita lo sembrado y nada más: las cuentas por su prefijo de correo exacto, las
 * vacantes y sus solicitudes por la marca, y la cuenta de panel por su id.
 *
 * Se llama también ANTES de sembrar: si una ejecución murió a mitad, la
 * siguiente no puede encontrarse el terreno a medio poner.
 */
export function retirarLoSembrado(correos: readonly string[] = []): void {
  const huerfanos = consultar(
    `select correo from usuario where correo like ${literal(`${PREFIJO_CORREO}.%@example.com`)}`,
  ).map((f) => String(f.correo))
  const todos = [...new Set([...correos, ...huerfanos])]
  if (todos.length) borrarCuentasDePrueba(todos)

  const sembradas = consultar(`select id from vacante where titulo like ${literal(`${MARCA}%`)}`)
  if (sembradas.length) {
    const ids = sembradas.map((f) => Number(f.id)).join(',')
    sql(`
      begin;
      delete from aviso_portal where vacante_id in (${ids});
      delete from requisito_objetivo where vacante_id in (${ids});
      delete from plantilla_correo_vacante where vacante_id in (${ids});
      delete from ficha_vacante where vacante_id in (${ids});
      delete from sesion_vacante where vacante_id in (${ids});
      delete from vacante
        where id in (${ids})
          and not exists (select 1 from postulacion p where p.vacante_id = vacante.id);
      -- La que conserva postulaciones con historial (avanzadas o descartadas por
      -- la prueba) no se puede borrar: se marca eliminada y sale de todas partes.
      update vacante set eliminada_en = now() where id in (${ids}) and eliminada_en is null;
      commit;`)
  }

  sql(`delete from solicitud_talento
        where motivo = ${literal(TEXTO_SEMBRADO)}
          and not exists (select 1 from vacante v where v.solicitud_talento_id = solicitud_talento.id);`)
  sql(`update solicitud_talento set estado = 'ARCHIVADA'
        where motivo = ${literal(TEXTO_SEMBRADO)} and estado <> 'ARCHIVADA';`)

  sql(`
    begin;
    delete from usuario_rol where usuario_id in (
      select id from usuario where usuario_renaser_os_id = ${literal(PANEL_SIN_MOVER)});
    delete from usuario where usuario_renaser_os_id = ${literal(PANEL_SIN_MOVER)};
    delete from persona where apellidos = ${literal(PANEL_SIN_MOVER)};
    delete from rol_permiso where rol_id in (select id from rol where codigo = ${literal(ROL_SIN_MOVER)});
    delete from rol where codigo = ${literal(ROL_SIN_MOVER)};
    commit;`)
}
