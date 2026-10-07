/**
 * El terreno de la QA de las preguntas propias de la vacante (V66, fase 1).
 *
 * Todo lo que se siembra lleva la marca `QA-PP-0553`: vacantes, solicitudes,
 * áreas, puestos, la empresa B, las cuentas de panel de la plataforma y los
 * roles acotados. Las cuentas de candidato se identifican por su correo exacto.
 *
 * Casi todo va por la API, que es el camino que recorre el panel: crear la
 * vacante, elegir el origen, escribir y publicar las preguntas, postular y
 * responder. Solo se siembra con SQL lo que la API ya no deja crear —una
 * vacante de antes de la V66 que rinde el banco prestado, la empresa B tal
 * como la da de alta la plataforma— y lo que en el preview no puede producir
 * la IA, que está apagada: la nota de una abierta y una recalificación en curso.
 *
 * ⚠️ Una postulación con historial no se borra (V6): la limpieza retira las
 * cuentas —`borrarCuentasDePrueba`— y marca eliminadas las vacantes.
 */

import { expect, type Locator, type Page } from '@playwright/test'
import { API, EQUIPO } from './ayuda'
import { borrarCuentasDePrueba, CLAVE_DE_CANDIDATO, crearCuentaDeCandidato } from './ayuda-candidato'
import { correoDePrueba, literal, sql } from './base-de-datos'

export const MARCA = 'QA-PP-0553'
const TEXTO_SEMBRADO = `${MARCA} sembrado por la QA de preguntas propias`
const PREFIJO_CORREO = 'qa.pp.0553'
const PREFIJO_PANEL = 'qa-pp-0553-'
const PREFIJO_ROL = 'QA_PP_0553_'
const PREFIJO_EMPRESA = `${MARCA}-B-`
const PREFIJO_PUESTO = 'QA_PP_0553_'

type Fila = Record<string, string | number | null>

export function consultar(consulta: string): Fila[] {
  return JSON.parse(sql(`select coalesce(json_agg(f), '[]') from (${consulta}) f;`)) as Fila[]
}

export function uno(consulta: string): Fila {
  const filas = consultar(consulta)
  if (filas.length !== 1) throw new Error(`Se esperaba una fila y llegaron ${filas.length}: ${consulta}`)
  return filas[0]!
}

function insertar(consulta: string): Fila {
  const filas = JSON.parse(sql(`with f as (${consulta}) select coalesce(json_agg(f), '[]') from f;`)) as Fila[]
  if (filas.length !== 1) throw new Error(`La inserción devolvió ${filas.length} filas: ${consulta}`)
  return filas[0]!
}

// ---------------------------------------------------------------- La API

export interface Respuesta<T = any> {
  estado: number
  cuerpo: T
}

/** Una llamada a la API con el token que se diga: estado y cuerpo (JSON si lo hay). */
export async function pedir<T = any>(
  ruta: string,
  token: string,
  metodo = 'GET',
  cuerpo?: unknown,
): Promise<Respuesta<T>> {
  const r = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  })
  const texto = await r.text()
  let json: unknown = null
  try {
    json = texto ? JSON.parse(texto) : null
  } catch {
    json = texto
  }
  return { estado: r.status, cuerpo: json as T }
}

/** Igual que `pedir`, pero exige un 2xx: lo que falla aquí es el terreno, no la prueba. */
export async function exigir<T = any>(ruta: string, token: string, metodo = 'GET', cuerpo?: unknown): Promise<T> {
  const r = await pedir<T>(ruta, token, metodo, cuerpo)
  if (r.estado < 200 || r.estado > 299) {
    throw new Error(`${metodo} ${ruta} contestó ${r.estado}: ${JSON.stringify(r.cuerpo).slice(0, 600)}`)
  }
  return r.cuerpo
}

export async function tokenDePanel(renaserOsId: string = EQUIPO): Promise<string> {
  const r = await fetch(`${API}/panel/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuarioRenaserOsId: renaserOsId }),
  })
  if (!r.ok) throw new Error(`dev-login de ${renaserOsId} falló: ${r.status}`)
  return (await r.json()).token as string
}

export async function tokenConClave(correo: string, contrasena = CLAVE_DE_CANDIDATO): Promise<string> {
  const r = await fetch(`${API}/panel/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo, contrasena }),
  })
  if (!r.ok) throw new Error(`login de panel de ${correo} falló: ${r.status} ${await r.text()}`)
  return (await r.json()).token as string
}

/** Siembra el token del panel ANTES de que arranque la app. */
export async function entrarAlPanelCon(page: Page, token: string): Promise<void> {
  await page.addInitScript(
    ([clave, valor]) => window.localStorage.setItem(clave as string, valor as string),
    ['renaser_panel_token', token],
  )
}

export async function entrarAlPortalCon(page: Page, token: string): Promise<void> {
  await page.addInitScript(
    ([clave, valor]) => window.localStorage.setItem(clave as string, valor as string),
    ['renaser_portal_token', token],
  )
}

// ---------------------------------------------------------------- Vacantes

/**
 * Una vacante en BORRADOR por el camino del panel: solicitud, aprobación y
 * vacante. El origen de sus preguntas lo decide el servidor al crearla.
 */
export async function crearVacante(
  token: string,
  titulo: string,
  lugar: { areaId: number; puestoId: number },
  responsable?: number,
): Promise<number> {
  const responsableUsuarioId = responsable ?? (await exigir<{ id: number }[]>('/panel/usuarios', token))[0]!.id
  const { id: solicitud } = await exigir<{ id: number }>('/panel/solicitudes', token, 'POST', {
    areaId: lugar.areaId,
    puestoId: lugar.puestoId,
    urgencia: 'NORMAL',
    resultadoPrincipal: 'Que la caja cuadre todos los días',
    motivo: TEXTO_SEMBRADO,
    consecuenciaNoContratar: 'Seguimos perdiendo plata en caja sin saber dónde.',
    analisisCapacidad: 'Las dos personas de administración ya cierran a las nueve.',
    resultadosEsperados: [
      { descripcion: 'Arqueo diario sin faltantes', indicador: 'Faltantes por mes' },
      { descripcion: 'Cuadre contra sistema cada cierre', indicador: 'Cierres cuadrados por semana' },
      { descripcion: 'Un informe mensual de caja', indicador: 'Informe entregado cada mes' },
    ],
  })
  await exigir(`/panel/solicitudes/${solicitud}/aprobacion`, token, 'POST', { motivo: TEXTO_SEMBRADO })
  const { id } = await exigir<{ id: number }>('/panel/vacantes', token, 'POST', {
    solicitudTalentoId: solicitud,
    titulo: `${MARCA} ${titulo}`,
    descripcion: 'Llevas la caja y el personal de tres sedes.',
    tipoCierre: 'PERMANENTE',
    responsableUsuarioId,
  })
  return id
}

/** El área y el puesto de la plataforma que usa la siembra de siempre, por nivel. */
export async function lugarDeLaPlataforma(
  token: string,
  nivel: 'EJECUCION' | 'SUPERVISION',
): Promise<{ areaId: number; puestoId: number }> {
  const puestos = await exigir<{ id: number; nombre: string; nivelPuestoCodigo: string }[]>('/panel/puestos', token)
  const areas = await exigir<{ id: number; nombre: string; esActiva: boolean }[]>('/panel/areas', token)
  const puesto = puestos.find((p) => p.nivelPuestoCodigo === nivel)
  const area = areas.find((a) => a.esActiva)
  if (!puesto || !area) throw new Error(`La siembra no trae un puesto de nivel ${nivel} y un área activa`)
  return { areaId: area.id, puestoId: puesto.id }
}

export const vacanteDe = (token: string, id: number) => exigir<any>(`/panel/vacantes/${id}`, token)

export const titulo = (t: string) => `${MARCA} ${t}`

// ---------------------------------------------------------------- Preguntas

export const RUTA = (vacante: number) => `/panel/vacantes/${vacante}/preguntas-propias`

export interface OpcionNueva {
  texto: string
  puntos: number
}
export interface PreguntaNueva {
  tipo: 'ABIERTA' | 'OPCION_UNICA' | 'OPCION_MULTIPLE' | 'ESCALA'
  enunciado: string
  puntos: number
  queDebeTener?: string
  opciones?: OpcionNueva[]
}
export interface CriterioNuevo {
  nombre: string
  queEvalua?: string
  preguntas: PreguntaNueva[]
}

/** Escribe un borrador entero por la API: criterios y, dentro, sus preguntas. */
export async function escribirBorrador(
  token: string,
  vacante: number,
  criterios: CriterioNuevo[],
  guia?: string,
): Promise<any> {
  let editor: any = null
  for (const c of criterios) {
    editor = await exigir(`${RUTA(vacante)}/criterios`, token, 'POST', { nombre: c.nombre, queEvalua: c.queEvalua })
    const id = (editor.borrador.criterios as any[]).find((x) => x.nombre === c.nombre).id as number
    for (const p of c.preguntas) {
      editor = await exigir(`${RUTA(vacante)}/preguntas`, token, 'POST', { ...p, criterioId: id })
    }
  }
  if (guia !== undefined) {
    editor = await exigir(`${RUTA(vacante)}/borrador`, token, 'PUT', { guiaCalificacion: guia, minutosObjetivo: 25 })
  }
  return editor
}

export const publicarPreguntas = (token: string, vacante: number) =>
  exigir<any>(`${RUTA(vacante)}/publicacion`, token, 'POST')

export const editorDe = (token: string, vacante: number) => exigir<any>(RUTA(vacante), token)

/** Dejar lista para publicar la etapa técnica: la primera prueba del puesto publicada. */
export async function elegirLaPruebaDelPuesto(token: string, vacante: number): Promise<void> {
  const plantillas = await exigir<{ id: number }[]>('/panel/plantillas-prueba', token)
  for (const p of plantillas) {
    const versiones = await exigir<{ id: number; estado: string }[]>(`/panel/plantillas-prueba/${p.id}/versiones`, token)
    const publicada = versiones.find((v) => v.estado === 'PUBLICADA')
    if (publicada) {
      await exigir(`/panel/vacantes/${vacante}/plantilla-prueba`, token, 'POST', { versionPlantillaPruebaId: publicada.id })
      return
    }
  }
  throw new Error('La siembra no trae ninguna prueba del puesto publicada')
}

// ---------------------------------------------------------------- Candidatos

export interface Cuenta {
  correo: string
  usuario: number
  token: string
}

export async function cuentaDeCandidato(nombre: string, correos: string[]): Promise<Cuenta> {
  const correo = correoDePrueba(PREFIJO_CORREO)
  correos.push(correo)
  await crearCuentaDeCandidato({ nombre, apellidos: 'Preguntas QA', correo })
  const r = await fetch(`${API}/portal/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo, contrasena: CLAVE_DE_CANDIDATO }),
  })
  if (!r.ok) throw new Error(`login portal de ${correo} falló: ${r.status}`)
  const token = (await r.json()).token as string
  const usuario = Number(uno(`select id from usuario where correo = ${literal(correo)}`).id)
  return { correo, usuario, token }
}

/** Postular como lo hace el portal: multipart con el currículum. Devuelve el uuid de la postulación. */
export async function postular(token: string, vacante: number): Promise<string> {
  const formulario = new FormData()
  formulario.append('cv', new Blob(['curriculum de prueba'], { type: 'application/pdf' }), 'cv.pdf')
  formulario.append('vacanteId', String(vacante))
  formulario.append('resultadoOrgulloso', 'Cerré el mes con la caja cuadrada en tres sedes')
  formulario.append('aceptaTratamiento', 'true')
  const r = await fetch(`${API}/portal/postulaciones`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formulario,
  })
  const texto = await r.text()
  if (!r.ok) throw new Error(`postular a ${vacante} contestó ${r.status}: ${texto}`)
  return (JSON.parse(texto) as { codigo: string }).codigo
}

export const postulacionPorUuid = (uuid: string): number =>
  Number(uno(`select id from postulacion where uuid = ${literal(uuid)}`).id)

export const estadoDeLaPostulacion = (id: number): string =>
  String(uno(`select estado_codigo from postulacion where id = ${id}`).estado_codigo)

/** La evaluación del candidato tal como la ve el portal, ya empezada. */
export async function empezarEvaluacion(token: string, uuid: string): Promise<any> {
  const r = await fetch(`${API}/portal/evaluacion/${uuid}/inicio`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) throw new Error(`empezar la evaluación ${uuid} contestó ${r.status}: ${await r.text()}`)
  return r.json()
}

export async function responder(token: string, uuid: string, preguntaId: number, cuerpo: unknown): Promise<void> {
  const r = await fetch(`${API}/portal/evaluacion/${uuid}/respuestas/${preguntaId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  })
  if (!r.ok) throw new Error(`responder ${preguntaId} contestó ${r.status}: ${await r.text()}`)
}

export async function entregar(token: string, uuid: string): Promise<void> {
  const r = await fetch(`${API}/portal/evaluacion/${uuid}/entrega`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) throw new Error(`entregar ${uuid} contestó ${r.status}: ${await r.text()}`)
}

/** La respuesta de una postulación a la pregunta cuyo enunciado empieza así. */
export function respuestaA(postulacion: number, enunciado: string): number {
  return Number(
    uno(`select r.id from respuesta r
           join evaluacion e on e.id = r.evaluacion_id
           join postulacion p on p.evaluacion_id = e.id
           join pregunta q on q.id = r.pregunta_id
          where p.id = ${postulacion} and q.enunciado like ${literal(`${enunciado}%`)}`).id,
  )
}

/**
 * La nota que habría puesto la IA a una abierta. En el preview la IA está
 * apagada: se escribe como la escribe `guardarNotasAbiertas`, con la versión de
 * guía vigente, para probar lo que viene después (ajuste, recalificación,
 * cambio de puntos).
 */
export function sembrarNotaDeLaIa(respuesta: number, puntaje: number, versionGuia: number): void {
  sql(`insert into nota_respuesta (respuesta_id, puntaje, explicacion, evidencia_citada, version_guia)
       values (${respuesta}, ${puntaje}, ${literal(`${MARCA}: explica el caso pero no dice en cuántos días lo cerró.`)},
               ${literal('En marzo el mayor no cuadraba')}, ${versionGuia});`)
}

/** Una recalificación del evaluador en curso para esa postulación, como la deja la cola. */
export function sembrarRecalificacionEnCurso(postulacion: number): number {
  const org = Number(uno(`select organizacion_id from postulacion where id = ${postulacion}`).organizacion_id)
  return Number(
    insertar(`insert into trabajo_ia (organizacion_id, agente_codigo, postulacion_id, estado, modo)
              values (${org}, 'EVALUADOR', ${postulacion}, 'EN_CURSO', 'RECALIFICA') returning id`).id,
  )
}

/** Una recalificación que se detuvo (sin saldo o con fallos): la persona queda pendiente. */
export function sembrarRecalificacionFallida(postulacion: number): number {
  const org = Number(uno(`select organizacion_id from postulacion where id = ${postulacion}`).organizacion_id)
  return Number(
    insertar(`insert into trabajo_ia (organizacion_id, agente_codigo, postulacion_id, estado, modo, intentos, terminado_en)
              values (${org}, 'EVALUADOR', ${postulacion}, 'FALLIDO', 'RECALIFICA', 3, now()) returning id`).id,
  )
}

export function quitarTrabajo(id: number): void {
  sql(`begin;
       delete from ejecucion_ia where trabajo_ia_id = ${id};
       delete from trabajo_ia where id = ${id};
       commit;`)
}

export const trabajosDeIaDe = (postulaciones: number[]): number =>
  Number(uno(`select count(*) as n from trabajo_ia where postulacion_id in (${postulaciones.join(',')})`).n)

export const auditoriasDe = (accion: string, entidadId: number): Fila[] =>
  consultar(`select valor_anterior::text as antes, valor_nuevo::text as despues, usuario_id, ocurrida_en
               from auditoria where accion = ${literal(accion)} and entidad_id = ${entidadId} order by id`)

// ---------------------------------------------------------------- Empresa B y equipos acotados

export interface EmpresaB {
  id: number
  usuario: number
  correo: string
  areaId: number
  puestoId: number
}

/**
 * La empresa B como la da de alta la plataforma (`ServicioPlataformaImpl#sembrar`):
 * los roles de la plataforma y su matriz de permisos, sin `administrar_plataforma`,
 * sus parámetros, un usuario de Talento, Dirección y Administración (entra con correo y contraseña:
 * se le copia el hash de una cuenta ya creada por la API) y un área con un puesto
 * de nivel Ejecución. **Sin banco propio**: la bandera `banco_propio` nace apagada.
 */
export function sembrarEmpresaB(correoConClave: string): EmpresaB {
  const plataforma = Number(uno('select id from organizacion where es_plataforma').id)
  const id = Number(
    insertar(`insert into organizacion (codigo, nombre)
              values (${literal(`${PREFIJO_EMPRESA}${Date.now()}`)}, ${literal(`${MARCA} Constructora Andina S.A.C.`)})
              returning id`).id,
  )
  sql(`
    begin;
    insert into rol (organizacion_id, codigo, nombre, descripcion, es_sistema)
      select ${id}, codigo, nombre, descripcion, es_sistema from rol
       where organizacion_id = ${plataforma} and codigo not like ${literal(`${PREFIJO_ROL}%`)}
         and codigo not like 'QA\\_%';
    insert into rol_permiso (rol_id, permiso_id, alcance)
      select nuevo.id, rp.permiso_id, rp.alcance
        from rol_permiso rp
        join rol origen on origen.id = rp.rol_id and origen.organizacion_id = ${plataforma}
        join rol nuevo on nuevo.organizacion_id = ${id} and nuevo.codigo = origen.codigo
        join permiso p on p.id = rp.permiso_id and p.codigo not in ('administrar_plataforma');
    insert into parametro (organizacion_id, codigo, valor, tipo, descripcion)
      select ${id}, codigo, valor, tipo, descripcion from parametro where organizacion_id = ${plataforma}
      on conflict (organizacion_id, codigo) do nothing;
    commit;`)
  const correo = correoDePrueba(`${PREFIJO_CORREO}.b`)
  const persona = Number(insertar(`insert into persona (nombre, apellidos) values ('Tania', ${literal(`${MARCA} Talento B`)}) returning id`).id)
  const usuario = Number(
    insertar(`insert into usuario (organizacion_id, persona_id, correo, contrasena_hash, es_equipo, es_activo)
              select ${id}, ${persona}, ${literal(correo)}, u.contrasena_hash, true, true
                from usuario u where u.correo = ${literal(correoConClave)}
              returning id`).id,
  )
  sql(`insert into usuario_rol (usuario_id, rol_id)
       select ${usuario}, id from rol where organizacion_id = ${id} and codigo in ('TALENTO', 'DIRECCION', 'ADMINISTRADOR');`)
  const areaId = Number(insertar(`insert into area (organizacion_id, nombre) values (${id}, ${literal(`${MARCA} Administración`)}) returning id`).id)
  const puestoId = Number(
    insertar(`insert into puesto (organizacion_id, codigo, nombre, nivel_puesto_codigo, familia_codigo)
              values (${id}, ${literal(`${PREFIJO_PUESTO}${Date.now()}`)}, ${literal(`${MARCA} Asistente contable`)}, 'EJECUCION', 'OPERACIONES')
              returning id`).id,
  )
  return { id, usuario, correo, areaId, puestoId }
}

/**
 * Una vacante de la empresa B de ANTES de la V66: rinde el banco del nivel, que
 * para B es el de RENASER prestado. La API ya no deja crearla así; la migración
 * dejó así a las de entonces.
 */
export function sembrarVacanteDeAntes(b: EmpresaB, nombre: string, aplica: boolean): number {
  const solicitud = Number(
    insertar(`insert into solicitud_talento (organizacion_id, origen, urgencia, estado, area_id, puesto_id,
                                             resultado_principal, motivo, consecuencia_no_contratar,
                                             analisis_capacidad, responsable_usuario_id)
              values (${b.id}, 'DIRECTA', 'NORMAL', 'CON_VACANTE', ${b.areaId}, ${b.puestoId},
                      ${literal(TEXTO_SEMBRADO)}, ${literal(TEXTO_SEMBRADO)}, ${literal(TEXTO_SEMBRADO)},
                      ${literal(TEXTO_SEMBRADO)}, ${b.usuario})
              returning id`).id,
  )
  return Number(
    insertar(`insert into vacante (organizacion_id, solicitud_talento_id, puesto_id, titulo, descripcion,
                                   tipo_cierre, estado, version_pesos_id, responsable_usuario_id,
                                   aplica_evaluacion, origen_preguntas)
              values (${b.id}, ${solicitud}, ${b.puestoId}, ${literal(`${MARCA} ${nombre}`)},
                      ${literal(TEXTO_SEMBRADO)}, 'PERMANENTE', 'BORRADOR',
                      (select min(id) from version_pesos), ${b.usuario}, ${aplica}, 'NIVEL')
              returning id`).id,
  )
}

/**
 * Una cuenta de panel en la PLATAFORMA —entra por el `dev-login`— con el rol de
 * Talento menos los permisos que se digan.
 */
export function sembrarEquipoSin(sufijo: string, sin: readonly string[]): string {
  const plataforma = Number(uno('select id from organizacion where es_plataforma').id)
  const renaserOsId = `${PREFIJO_PANEL}${sufijo}`
  const codigo = `${PREFIJO_ROL}${sufijo.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`
  const rolId = Number(
    insertar(`insert into rol (organizacion_id, codigo, nombre, descripcion)
              values (${plataforma}, ${literal(codigo)}, ${literal(codigo)}, ${literal(TEXTO_SEMBRADO)}) returning id`).id,
  )
  sql(`insert into rol_permiso (rol_id, permiso_id, alcance)
       select ${rolId}, rp.permiso_id, rp.alcance from rol_permiso rp
         join rol t on t.id = rp.rol_id and t.organizacion_id = ${plataforma} and t.codigo = 'TALENTO'
         join permiso p on p.id = rp.permiso_id
        where p.codigo not in (${sin.map((c) => literal(c)).join(', ')});`)
  const persona = Number(insertar(`insert into persona (nombre, apellidos) values ('QA', ${literal(renaserOsId)}) returning id`).id)
  const usuario = Number(
    insertar(`insert into usuario (organizacion_id, persona_id, usuario_renaser_os_id, es_equipo, es_activo)
              values (${plataforma}, ${persona}, ${literal(renaserOsId)}, true, true) returning id`).id,
  )
  sql(`insert into usuario_rol (usuario_id, rol_id) values (${usuario}, ${rolId});`)
  return renaserOsId
}

// ---------------------------------------------------------------- La limpieza

/**
 * Quita lo sembrado: las cuentas de candidato por correo exacto, las vacantes
 * por la marca (se borran si nadie postuló; si no, se marcan eliminadas), las
 * solicitudes, las cuentas y roles de panel, y la empresa B (si algo la ata, se
 * desactiva). Las notas y trabajos sembrados se van con las cuentas.
 */
export function retirarLoSembrado(correos: readonly string[]): void {
  const vacantes = consultar(`select id from vacante where titulo like ${literal(`${MARCA}%`)}`).map((f) => Number(f.id))
  if (correos.length) borrarCuentasDePrueba(correos)
  if (vacantes.length) {
    // Una vacante cuelga de demasiadas cosas (postulaciones con historial, textos de
    // correo, ficha técnica, auditoría) para borrarla sin tocar datos ajenos: se
    // marca eliminada, y así sale de todas las pantallas y de «Copiar de otra vacante».
    sql(`update vacante set eliminada_en = now() where id in (${vacantes.join(',')}) and eliminada_en is null;`)
  }
  sql(`update solicitud_talento set estado = 'ARCHIVADA'
        where motivo = ${literal(TEXTO_SEMBRADO)} and estado <> 'ARCHIVADA';`)
  sql(`
    begin;
    create temporary table qa_pp_panel on commit drop as
      select id, persona_id from usuario where usuario_renaser_os_id like ${literal(`${PREFIJO_PANEL}%`)};
    delete from usuario_rol where usuario_id in (select id from qa_pp_panel);
    delete from usuario u where u.id in (select id from qa_pp_panel)
       and not exists (select 1 from auditoria a where a.usuario_id = u.id)
       and not exists (select 1 from vacante v where v.responsable_usuario_id = u.id)
       and not exists (select 1 from nota_respuesta n where n.ajustada_por_usuario_id = u.id);
    update usuario set es_activo = false, usuario_renaser_os_id = 'qa-retirada-' || gen_random_uuid()
     where id in (select id from qa_pp_panel);
    delete from persona where id in (select persona_id from qa_pp_panel)
       and not exists (select 1 from usuario u where u.persona_id = persona.id);
    delete from rol_permiso where rol_id in (select id from rol where codigo like ${literal(`${PREFIJO_ROL}%`)});
    delete from rol r where r.codigo like ${literal(`${PREFIJO_ROL}%`)}
       and not exists (select 1 from usuario_rol ur where ur.rol_id = r.id);
    commit;`)
  const empresas = consultar(`select id from organizacion where codigo like ${literal(`${PREFIJO_EMPRESA}%`)}`)
  for (const { id } of empresas) {
    sql(`
      begin;
      delete from usuario_rol where usuario_id in (select id from usuario where organizacion_id = ${id})
         and not exists (select 1 from auditoria a where a.usuario_id = usuario_rol.usuario_id);
      delete from usuario u where u.organizacion_id = ${id}
         and not exists (select 1 from auditoria a where a.usuario_id = u.id)
         and not exists (select 1 from vacante v where v.responsable_usuario_id = u.id)
         and not exists (select 1 from solicitud_talento s where s.responsable_usuario_id = u.id);
      update usuario set es_activo = false, correo = 'e2e.retirada.' || gen_random_uuid() || '@example.com'
       where organizacion_id = ${id};
      update organizacion set es_activa = false where id = ${id};
      commit;`)
  }
  sql(`delete from persona p where p.apellidos = ${literal(`${MARCA} Talento B`)}
         and not exists (select 1 from usuario u where u.persona_id = p.id);`)
}

/** El botón está a la vista y nada lo tapa: lo que hay en su centro es él mismo. */
export async function nadaLoTapa(page: Page, selectorAccesible: { role: 'button'; name: string }): Promise<boolean> {
  const boton = page.getByRole(selectorAccesible.role, { name: selectorAccesible.name })
  await expect(boton).toBeVisible()
  return boton.evaluate((el) => {
    const r = el.getBoundingClientRect()
    if (r.bottom <= 0 || r.top >= window.innerHeight) return false
    const enElCentro = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return enElCentro !== null && (enElCentro === el || el.contains(enElCentro))
  })
}

/**
 * Pulsa «⚠ N por arreglar →» (los dos editores) hasta que `destino` tiene el foco: la
 * pastilla lleva de falta en falta en el orden de la página. Si pasa por la configuración
 * de la prueba, la cierra con Escape y sigue. Falla si en `vueltas` clics no llega.
 */
export async function irConLaPastilla(page: Page, destino: Locator, vueltas = 6): Promise<void> {
  const pastilla = page.getByRole('button', { name: /^\d+ por arreglar$/ })
  const configuracion = page.getByRole('dialog', { name: 'Configuración de la prueba' })
  for (let i = 0; i < vueltas; i++) {
    await pastilla.click()
    const llego = await expect(destino).toBeFocused({ timeout: 2_000 }).then(() => true, () => false)
    if (llego) return
    if (await configuracion.isVisible()) {
      await page.keyboard.press('Escape')
      await expect(configuracion).toHaveCount(0)
    }
  }
  throw new Error(`«por arreglar» no llevó al destino en ${vueltas} clics`)
}
