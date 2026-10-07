/**
 * El terreno de la QA de la prueba del puesto escrita en el editor (V67, fase 2).
 *
 * Todo lo sembrado lleva la marca `QA-PE-0067`: vacantes, solicitudes, cuentas
 * de panel acotadas y la empresa B. Las cuentas de candidato se identifican por
 * su correo exacto (`qa.pe.0067.<uuid>@example.com`).
 *
 * Casi todo va por la API, el camino del panel y del portal: crear la vacante,
 * escribir y publicar la prueba, postular, pasar a la etapa técnica, rendir y
 * entregar. Con SQL solo va lo que el preview no puede producir: la nota que la
 * IA (apagada, sin broker) habría puesto a un criterio, una recalificación en
 * curso tal como la deja la cola y el vencimiento del reloj, que se adelanta
 * para no esperar los minutos de la prueba.
 *
 * ⚠️ Una postulación con historial no se borra (V6): la limpieza retira las
 * cuentas (`borrarCuentasDePrueba`) y marca eliminadas las vacantes.
 */

import { API } from './ayuda'
import { borrarCuentasDePrueba, CLAVE_DE_CANDIDATO, crearCuentaDeCandidato } from './ayuda-candidato'
import { correoDePrueba, literal, sql } from './base-de-datos'
import { consultar, exigir, pedir, uno, type Respuesta } from './ayuda-preguntas-propias'

export const MARCA = 'QA-PE-0067'
const TEXTO_SEMBRADO = `${MARCA} sembrado por la QA de la prueba del editor`
const PREFIJO_CORREO = 'qa.pe.0067'
const PREFIJO_PANEL = 'qa-pe-0067-'
const PREFIJO_ROL = 'QA_PE_0067_'
const PREFIJO_EMPRESA = `${MARCA}-B-`

export const titulo = (t: string) => `${MARCA} ${t}`
export const RUTA = (vacante: number) => `/panel/vacantes/${vacante}/prueba-propia`

// ---------------------------------------------------------------- La vacante

/** Una vacante en BORRADOR por el camino del panel: solicitud, aprobación y vacante. */
export async function crearVacante(
  token: string,
  nombre: string,
  lugar: { areaId: number; puestoId: number },
  responsable?: number,
  marca: string = MARCA,
): Promise<number> {
  const sembrado = marca === MARCA ? TEXTO_SEMBRADO : `${marca} sembrado a mano para revisar`
  const responsableUsuarioId = responsable ?? (await exigir<{ id: number }[]>('/panel/usuarios', token))[0]!.id
  const { id: solicitud } = await exigir<{ id: number }>('/panel/solicitudes', token, 'POST', {
    areaId: lugar.areaId,
    puestoId: lugar.puestoId,
    urgencia: 'NORMAL',
    resultadoPrincipal: 'Que el cierre mensual cuadre a la primera',
    motivo: sembrado,
    consecuenciaNoContratar: 'El cierre sigue saliendo tarde y con descuadres.',
    analisisCapacidad: 'Contabilidad ya cierra con horas extra todos los meses.',
    resultadosEsperados: [
      { descripcion: 'Cierre mensual sin descuadres', indicador: 'Descuadres por cierre' },
      { descripcion: 'Conciliaciones al día', indicador: 'Cuentas conciliadas por semana' },
      { descripcion: 'Reporte de cierre a tiempo', indicador: 'Días de retraso del reporte' },
    ],
  })
  await exigir(`/panel/solicitudes/${solicitud}/aprobacion`, token, 'POST', { motivo: sembrado })
  const { id } = await exigir<{ id: number }>('/panel/vacantes', token, 'POST', {
    solicitudTalentoId: solicitud,
    titulo: `${marca} ${nombre}`,
    descripcion: 'Registras las operaciones y cierras el mes de dos sedes.',
    tipoCierre: 'PERMANENTE',
    responsableUsuarioId,
  })
  return id
}

/** Un área activa y un puesto del nivel pedido de la organización del token. */
export async function lugarDe(
  token: string,
  nivel: 'EJECUCION' | 'SUPERVISION' = 'EJECUCION',
): Promise<{ areaId: number; puestoId: number }> {
  const puestos = await exigir<{ id: number; nivelPuestoCodigo: string }[]>('/panel/puestos', token)
  const areas = await exigir<{ id: number; esActiva: boolean }[]>('/panel/areas', token)
  const puesto = puestos.find((p) => p.nivelPuestoCodigo === nivel)
  const area = areas.find((a) => a.esActiva)
  if (!puesto || !area) throw new Error(`La siembra no trae un puesto de nivel ${nivel} y un área activa`)
  return { areaId: area.id, puestoId: puesto.id }
}

// ---------------------------------------------------------------- La prueba

export interface OpcionNueva {
  texto: string | null
  puntos: number
}
export interface PreguntaNueva {
  tipo: 'ABIERTA' | 'OPCION_UNICA' | 'OPCION_MULTIPLE' | 'ESCALA'
  enunciado: string
  puntos?: number | null
  queDebeTener?: string
  opciones?: OpcionNueva[]
}
/**
 * Un archivo de la prueba (V68), pedido donde se usa: el de una pregunta (`de`, su
 * enunciado) o un general que cubre toda la prueba (`todaLaPrueba`) o unas preguntas
 * (`cubre`, sus enunciados). Sin nada de eso, cubre toda la prueba.
 */
export interface EntregableNuevo {
  nombre: string
  detalle?: string
  formato: 'ARCHIVO' | 'ENLACE' | 'CUALQUIERA'
  obligatorio: boolean
  queDebeTener?: string
  de?: string
  todaLaPrueba?: boolean
  cubre?: string[]
}
/**
 * Un criterio que se siembra. Desde la V69 la API pide lo que vale entero
 * (`puntos`); la siembra puede darlo así o, como antes, por su parte calificada
 * (`puntosCalificados`), y entonces vale sus cerradas más esa parte.
 */
export interface CriterioNuevo {
  nombre: string
  queEvalua?: string
  puntos?: number | null
  puntosCalificados?: number | null
  calificador?: 'IA' | 'PERSONA' | null
  preguntas: PreguntaNueva[]
}

/** Lo que suman las cerradas de unas preguntas (las abiertas no llevan puntos). */
const cerradasDe = (preguntas: { tipo: string; puntos?: number | null }[]) =>
  preguntas.filter((p) => p.tipo !== 'ABIERTA').reduce((s, p) => s + (p.puntos ?? 0), 0)

/** Lo que vale un criterio sembrado: lo dicho, o sus cerradas más su parte calificada. */
export const puntosDelCriterio = (c: CriterioNuevo): number =>
  c.puntos ?? cerradasDe(c.preguntas) + (c.puntosCalificados ?? 0)
export interface PruebaNueva {
  datos?: {
    enunciado?: string | null
    materiales?: string | null
    herramientasPermitidas?: string | null
    modalidad?: 'CRONOMETRADA' | 'PLAZO_ABIERTO' | null
    duracionMinutos?: number | null
    guiaCalificacion?: string | null
  }
  entregables?: EntregableNuevo[]
  criterios: CriterioNuevo[]
  /**
   * La fecha límite de la vacante (V68), obligatoria para publicar. Sin decir nada, dentro
   * de veinte días; `null` la deja sin poner.
   */
  fechaLimite?: string | null
}

export const editorDe = (token: string, vacante: number) => exigir<any>(RUTA(vacante), token)

/** El id de un entregable del borrador por su nombre. */
export const entregableDe = (editor: any, nombre: string): number =>
  (editor.borrador.prueba.entregables as any[]).find((e) => e.nombre === nombre).id

export const criterioDe = (version: any, nombre: string): any =>
  (version.criterios as any[]).find((c) => c.nombre === nombre)

/** El id de una pregunta de la versión por su enunciado. */
export const preguntaDe = (version: any, enunciado: string): number => {
  const todas = [...(version.criterios as any[]).flatMap((c) => c.preguntas), ...(version.sinCriterio as any[])]
  const encontrada = todas.find((p: any) => p.enunciado === enunciado)
  if (!encontrada) throw new Error(`No está la pregunta «${enunciado}»`)
  return encontrada.id
}

/** El cuerpo de un entregable con su alcance, con las preguntas ya por su id. */
export function cuerpoDelEntregable(version: any, e: EntregableNuevo) {
  const { de, todaLaPrueba, cubre, ...resto } = e
  return {
    ...resto,
    preguntaId: de ? preguntaDe(version, de) : null,
    todaLaPrueba: !de && (todaLaPrueba ?? !cubre?.length),
    cubre: de ? [] : (cubre ?? []).map((t) => preguntaDe(version, t)),
  }
}

export const enVeinteDias = () => new Date(Date.now() + 20 * 24 * 3_600_000).toISOString()

/** La fecha límite de la vacante, desde el editor de la prueba (V68). */
export const fijarFechaLimite = (token: string, vacante: number, cierraEn: string, motivo: string | null = null) =>
  pedir(`${RUTA(vacante)}/fecha-limite`, token, 'PUT', { cierraEn, motivo })

/**
 * Escribe un borrador entero por la API: criterios con su parte calificada y preguntas,
 * los archivos con su alcance, el caso y el tiempo, y la fecha límite.
 */
export async function escribirPrueba(token: string, vacante: number, prueba: PruebaNueva): Promise<any> {
  let editor: any = null
  for (const c of prueba.criterios) {
    // Nace sin cerradas: quién califica se dice si al final le queda parte calificada.
    const puntos = puntosDelCriterio(c)
    editor = await exigir(`${RUTA(vacante)}/criterios`, token, 'POST', {
      nombre: c.nombre,
      queEvalua: c.queEvalua,
      puntos,
      calificador: puntos > 0 ? (c.calificador ?? 'IA') : null,
    })
    const id = criterioDe(editor.borrador, c.nombre).id as number
    for (const p of c.preguntas) {
      editor = await exigir(`${RUTA(vacante)}/preguntas`, token, 'POST', { ...p, criterioId: id })
    }
  }
  for (const e of prueba.entregables ?? []) {
    editor = await exigir(`${RUTA(vacante)}/entregables`, token, 'POST', cuerpoDelEntregable(editor.borrador, e))
  }
  if (prueba.datos) {
    editor = await exigir(`${RUTA(vacante)}/borrador`, token, 'PUT', prueba.datos)
  }
  if (prueba.fechaLimite !== null) {
    const fijada = await fijarFechaLimite(token, vacante, prueba.fechaLimite ?? enVeinteDias())
    if (fijada.estado !== 200) throw new Error(`fijar la fecha límite falló: ${fijada.estado}`)
    editor = fijada.cuerpo
  }
  return editor
}

/**
 * Cambia la parte calificada de un criterio del borrador: pasa a valer sus
 * cerradas de hoy más esa parte (V69). Lo que mira no se escribe (V68).
 */
export async function cambiarCriterio(
  token: string,
  vacante: number,
  nombre: string,
  cambio: { puntosCalificados: number; calificador: 'IA' | 'PERSONA'; queEvalua?: string },
): Promise<any> {
  const editor = await editorDe(token, vacante)
  const c = criterioDe(editor.borrador, nombre)
  return exigir(`${RUTA(vacante)}/criterios/${c.id}`, token, 'PUT', {
    nombre,
    queEvalua: cambio.queEvalua ?? c.queEvalua,
    puntos: c.puntosSistema + cambio.puntosCalificados,
    calificador: cambio.calificador,
  })
}

export const publicarPrueba = (token: string, vacante: number): Promise<Respuesta> =>
  pedir(`${RUTA(vacante)}/publicacion`, token, 'POST')

// ---------------------------------------------------------------- Candidatos

export interface Candidata {
  correo: string
  usuario: number
  token: string
  uuid: string
  postulacion: number
}

/** Cuenta, postulación y paso a la etapa técnica, como lo hace el equipo desde el panel. */
export async function candidataEnLaPrueba(
  equipo: string,
  vacante: number,
  nombre: string,
  correos: string[],
  prefijo: string = PREFIJO_CORREO,
): Promise<Candidata> {
  const correo = correoDePrueba(prefijo)
  correos.push(correo)
  await crearCuentaDeCandidato({ nombre, apellidos: 'Prueba Editor QA', correo })
  const login = await fetch(`${API}/portal/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo, contrasena: CLAVE_DE_CANDIDATO }),
  })
  if (!login.ok) throw new Error(`login portal de ${correo} falló: ${login.status}`)
  const token = (await login.json()).token as string
  const usuario = Number(uno(`select id from usuario where correo = ${literal(correo)}`).id)

  const formulario = new FormData()
  formulario.append('cv', new Blob(['curriculum de prueba'], { type: 'application/pdf' }), 'cv.pdf')
  formulario.append('vacanteId', String(vacante))
  formulario.append('resultadoOrgulloso', 'Cerré tres años de mes sin descuadres')
  formulario.append('aceptaTratamiento', 'true')
  const r = await fetch(`${API}/portal/postulaciones`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formulario,
  })
  const texto = await r.text()
  if (!r.ok) throw new Error(`postular a ${vacante} contestó ${r.status}: ${texto}`)
  const uuid = (JSON.parse(texto) as { codigo: string }).codigo
  const postulacion = Number(uno(`select id from postulacion where uuid = ${literal(uuid)}`).id)
  await exigir(`/panel/postulaciones/${postulacion}/confirmacion-avance`, equipo, 'POST', {
    motivo: `${MARCA}: pasa a la prueba técnica`,
  })
  return { correo, usuario, token, uuid, postulacion }
}

export const estadoDe = (postulacion: number): string =>
  String(uno(`select estado_codigo from postulacion where id = ${postulacion}`).estado_codigo)

export const notaDeLaEtapa = (postulacion: number): number | null => {
  const filas = consultar(`select puntaje from nota_etapa where postulacion_id = ${postulacion}
                             and etapa_codigo = 'PRUEBA_PUESTO'`)
  return filas.length ? Number(filas[0]!.puntaje) : null
}

export const intentoDe = (postulacion: number): number =>
  Number(uno(`select id from intento_prueba where postulacion_id = ${postulacion}`).id)

// ---------------------------------------------------------------- El portal

const delPortal = (c: Candidata, ruta: string, metodo = 'GET', cuerpo?: unknown) =>
  pedir(`/portal/prueba/${c.uuid}${ruta}`, c.token, metodo, cuerpo)

export const verLaPrueba = (c: Candidata) => delPortal(c, '')
export const iniciarLaPrueba = (c: Candidata) => delPortal(c, '/inicio', 'POST')
export const responderLaPrueba = (c: Candidata, pregunta: number, cuerpo: unknown) =>
  delPortal(c, `/respuestas/${pregunta}`, 'PUT', cuerpo)
export const entregarLaPrueba = (c: Candidata) => delPortal(c, '/entrega', 'POST')
export const subirEnlace = (c: Candidata, entregable: number, enlace: string) =>
  delPortal(c, `/entregables/${entregable}/enlace`, 'POST', { enlace })

export async function subirArchivo(c: Candidata, entregable: number, nombre = 'tablero.pdf'): Promise<number> {
  const formulario = new FormData()
  formulario.append('archivo', new Blob(['%PDF-1.4 la conciliacion de marzo'], { type: 'application/pdf' }), nombre)
  const r = await fetch(`${API}/portal/prueba/${c.uuid}/entregables/${entregable}/archivo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${c.token}` },
    body: formulario,
  })
  return r.status
}

/** Adelanta el reloj: el intento ya venció. El barrido de 60 s hace el resto. */
export function vencer(postulacion: number): void {
  sql(`update intento_prueba set vence_en = now() - interval '1 minute' where postulacion_id = ${postulacion};`)
}

// ---------------------------------------------------------------- Lo que la IA no puede hacer aquí

/**
 * La nota que habría puesto el agente de la prueba a la parte calificada de un
 * criterio, escrita como la guarda la red de seguridad: origen IA, con la versión
 * de guía vigente. En el preview la IA está apagada.
 */
export function sembrarNotaDeLaIa(postulacion: number, criterio: number, puntaje: number, versionGuia = 1): void {
  sql(`insert into nota_criterio_prueba (intento_prueba_id, criterio_banco_id, puntaje, explicacion, evidencia,
                                         origen, version_guia)
       values (${intentoDe(postulacion)}, ${criterio}, ${puntaje},
               ${literal(`${MARCA}: halla el descuadre y lo explica, pero no dice el monto.`)},
               ${literal('La diferencia está en la cuenta 4011')}, 'IA', ${versionGuia});`)
}

/** Una recalificación del agente de la prueba en curso, como la deja la cola. */
export function sembrarRecalificacionEnCurso(postulacion: number): number {
  const org = Number(uno(`select organizacion_id from postulacion where id = ${postulacion}`).organizacion_id)
  const filas = JSON.parse(
    sql(`with f as (insert into trabajo_ia (organizacion_id, agente_codigo, postulacion_id, estado, modo)
                    values (${org}, 'PRUEBA_PUESTO', ${postulacion}, 'EN_CURSO', 'RECALIFICA') returning id)
         select json_agg(f) from f;`),
  ) as { id: number }[]
  return filas[0]!.id
}

export function quitarTrabajo(id: number): void {
  sql(`begin;
       delete from ejecucion_ia where trabajo_ia_id = ${id};
       delete from trabajo_ia where id = ${id};
       commit;`)
}

export const trabajosDeIaDe = (postulaciones: number[]): number =>
  Number(uno(`select count(*) as n from trabajo_ia where postulacion_id in (${postulaciones.join(',')})`).n)

// ---------------------------------------------------------------- Equipos acotados y empresa B

/** Una cuenta de panel en la plataforma (dev-login) con el rol de Talento menos esos permisos. */
export function sembrarEquipoSin(sufijo: string, sin: readonly string[]): string {
  const plataforma = Number(uno('select id from organizacion where es_plataforma').id)
  const renaserOsId = `${PREFIJO_PANEL}${sufijo}`
  const codigo = `${PREFIJO_ROL}${sufijo.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`
  const rol = JSON.parse(
    sql(`with f as (insert into rol (organizacion_id, codigo, nombre, descripcion)
                    values (${plataforma}, ${literal(codigo)}, ${literal(codigo)}, ${literal(TEXTO_SEMBRADO)}) returning id)
         select json_agg(f) from f;`),
  )[0].id as number
  sql(`insert into rol_permiso (rol_id, permiso_id, alcance)
       select ${rol}, rp.permiso_id, rp.alcance from rol_permiso rp
         join rol t on t.id = rp.rol_id and t.organizacion_id = ${plataforma} and t.codigo = 'TALENTO'
         join permiso p on p.id = rp.permiso_id
        where p.codigo not in (${sin.map((c) => literal(c)).join(', ')});`)
  const persona = JSON.parse(
    sql(`with f as (insert into persona (nombre, apellidos) values ('QA', ${literal(renaserOsId)}) returning id)
         select json_agg(f) from f;`),
  )[0].id as number
  const usuario = JSON.parse(
    sql(`with f as (insert into usuario (organizacion_id, persona_id, usuario_renaser_os_id, es_equipo, es_activo)
                    values (${plataforma}, ${persona}, ${literal(renaserOsId)}, true, true) returning id)
         select json_agg(f) from f;`),
  )[0].id as number
  sql(`insert into usuario_rol (usuario_id, rol_id) values (${usuario}, ${rol});`)
  return renaserOsId
}

/** La empresa B, sin vacantes: solo hace falta su sesión para comprobar que no ve lo de A. */
export async function empresaB(correos: string[]): Promise<{ id: number; token: string }> {
  const correoConClave = correoDePrueba(`${PREFIJO_CORREO}.clave`)
  correos.push(correoConClave)
  await crearCuentaDeCandidato({ nombre: 'Clave', apellidos: 'Prueba Editor QA', correo: correoConClave })
  const plataforma = Number(uno('select id from organizacion where es_plataforma').id)
  const id = JSON.parse(
    sql(`with f as (insert into organizacion (codigo, nombre)
                    values (${literal(`${PREFIJO_EMPRESA}${Date.now()}`)}, ${literal(`${MARCA} Constructora Andina`)})
                    returning id)
         select json_agg(f) from f;`),
  )[0].id as number
  sql(`begin;
       insert into rol (organizacion_id, codigo, nombre, descripcion, es_sistema)
         select ${id}, codigo, nombre, descripcion, es_sistema from rol
          where organizacion_id = ${plataforma} and codigo not like 'QA\\_%';
       insert into rol_permiso (rol_id, permiso_id, alcance)
         select nuevo.id, rp.permiso_id, rp.alcance from rol_permiso rp
           join rol origen on origen.id = rp.rol_id and origen.organizacion_id = ${plataforma}
           join rol nuevo on nuevo.organizacion_id = ${id} and nuevo.codigo = origen.codigo
           join permiso p on p.id = rp.permiso_id and p.codigo <> 'administrar_plataforma';
       insert into parametro (organizacion_id, codigo, valor, tipo, descripcion)
         select ${id}, codigo, valor, tipo, descripcion from parametro where organizacion_id = ${plataforma}
         on conflict (organizacion_id, codigo) do nothing;
       commit;`)
  const correo = correoDePrueba(`${PREFIJO_CORREO}.b`)
  const persona = JSON.parse(
    sql(`with f as (insert into persona (nombre, apellidos) values ('Tania', ${literal(`${MARCA} Talento B`)}) returning id)
         select json_agg(f) from f;`),
  )[0].id as number
  const usuario = JSON.parse(
    sql(`with f as (insert into usuario (organizacion_id, persona_id, correo, contrasena_hash, es_equipo, es_activo)
                    select ${id}, ${persona}, ${literal(correo)}, u.contrasena_hash, true, true
                      from usuario u where u.correo = ${literal(correoConClave)} returning id)
         select json_agg(f) from f;`),
  )[0].id as number
  sql(`insert into usuario_rol (usuario_id, rol_id)
       select ${usuario}, id from rol where organizacion_id = ${id} and codigo in ('TALENTO', 'DIRECCION', 'ADMINISTRADOR');`)
  const r = await fetch(`${API}/panel/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo, contrasena: CLAVE_DE_CANDIDATO }),
  })
  if (!r.ok) throw new Error(`login de panel de la empresa B falló: ${r.status} ${await r.text()}`)
  return { id, token: (await r.json()).token as string }
}

// ---------------------------------------------------------------- La limpieza

/**
 * Quita lo sembrado por esta QA: cuentas de candidato por correo exacto, vacantes
 * con la marca (marcadas eliminadas: cuelgan de demasiado para borrarlas sin tocar
 * datos ajenos), solicitudes, cuentas y roles de panel y la empresa B.
 */
export function retirarLoSembrado(correos: readonly string[]): void {
  const vacantes = consultar(`select id from vacante where titulo like ${literal(`${MARCA}%`)}`).map((f) => Number(f.id))
  const trabajos = vacantes.length
    ? consultar(`select t.id from trabajo_ia t join postulacion p on p.id = t.postulacion_id
                  where p.vacante_id in (${vacantes.join(',')}) and t.estado = 'EN_CURSO'`).map((f) => Number(f.id))
    : []
  for (const t of trabajos) quitarTrabajo(t)
  if (correos.length) borrarCuentasDePrueba(correos)
  if (vacantes.length) {
    sql(`update vacante set eliminada_en = now() where id in (${vacantes.join(',')}) and eliminada_en is null;`)
  }
  sql(`update solicitud_talento set estado = 'ARCHIVADA'
        where motivo = ${literal(TEXTO_SEMBRADO)} and estado <> 'ARCHIVADA';`)
  sql(`
    begin;
    create temporary table qa_pe_panel on commit drop as
      select id, persona_id from usuario where usuario_renaser_os_id like ${literal(`${PREFIJO_PANEL}%`)};
    delete from usuario_rol where usuario_id in (select id from qa_pe_panel);
    delete from usuario u where u.id in (select id from qa_pe_panel)
       and not exists (select 1 from auditoria a where a.usuario_id = u.id)
       and not exists (select 1 from vacante v where v.responsable_usuario_id = u.id)
       and not exists (select 1 from nota_criterio_prueba n
                        where n.ajustada_por_usuario_id = u.id or n.calificada_por_usuario_id = u.id);
    update usuario set es_activo = false, usuario_renaser_os_id = 'qa-retirada-' || gen_random_uuid()
     where id in (select id from qa_pe_panel);
    delete from persona where id in (select persona_id from qa_pe_panel)
       and not exists (select 1 from usuario u where u.persona_id = persona.id);
    delete from rol_permiso where rol_id in (select id from rol where codigo like ${literal(`${PREFIJO_ROL}%`)});
    delete from rol r where r.codigo like ${literal(`${PREFIJO_ROL}%`)}
       and not exists (select 1 from usuario_rol ur where ur.rol_id = r.id);
    commit;`)
  for (const { id } of consultar(`select id from organizacion where codigo like ${literal(`${PREFIJO_EMPRESA}%`)}`)) {
    sql(`
      begin;
      delete from usuario_rol where usuario_id in (select id from usuario where organizacion_id = ${id})
         and not exists (select 1 from auditoria a where a.usuario_id = usuario_rol.usuario_id);
      delete from usuario u where u.organizacion_id = ${id}
         and not exists (select 1 from auditoria a where a.usuario_id = u.id);
      update usuario set es_activo = false, correo = 'e2e.retirada.' || gen_random_uuid() || '@example.com'
       where organizacion_id = ${id};
      update organizacion set es_activa = false where id = ${id};
      commit;`)
  }
  sql(`delete from persona p where p.apellidos = ${literal(`${MARCA} Talento B`)}
         and not exists (select 1 from usuario u where u.persona_id = p.id);`)
}
