/**
 * El terreno de la gestión de personas (V64): sedes, un área y cargos propios de
 * la prueba, cuentas de panel con un solo rol, una vacante con su postulación, y
 * colaboradores dados de alta por la API cuando lo que se prueba no es el alta.
 *
 * Todo lleva la marca `QA-PERSONAS-3E62` o un documento al azar, para que la
 * limpieza encuentre lo suyo y nada más. Las fichas de colaborador se borran
 * (no hay nada que las proteja); las vacantes se marcan eliminadas, porque una
 * postulación con historial no se borra; los cargos creados se quedan
 * desactivados, porque una vacante los sigue nombrando.
 */

import { API, EQUIPO } from './ayuda'
import { apiPanel } from './ayuda-configuracion'
import { literal, sql } from './base-de-datos'

export const MARCA = 'QA-PERSONAS-3E62'
const PREFIJO_PANEL = 'qa-personas-3e62-'

type Fila = Record<string, string | number | null>

function consultar(consulta: string): Fila[] {
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

export const contar = (consulta: string): number => Number(uno(`select count(*) as n from (${consulta}) c`).n)

/** Hoy en Lima, como `AAAA-MM-DD`: el día con el que el backend calcula los estados. */
export function hoyEnLima(desplazamiento = 0): string {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date())
  const [a, m, d] = hoy.split('-').map(Number)
  return new Date(Date.UTC(a!, m! - 1, d! + desplazamiento)).toISOString().slice(0, 10)
}

/** `AAAA-MM-DD` → `dd/mm/aaaa`, como lo pinta la ficha. */
export const comoSeVe = (dia: string): string => dia.split('-').reverse().join('/')

/** Un DNI al azar de esta corrida: ocho cifras que empiezan por 7. */
export const dniAlAzar = (): string => `7${String(Math.floor(Math.random() * 10_000_000)).padStart(7, '0')}`

export const organizacionDelEquipo = (): number =>
  Number(uno(`select organizacion_id from usuario where usuario_renaser_os_id = ${literal(EQUIPO)}`).organizacion_id)

export interface Estructura {
  organizacion: number
  sedeNorte: { id: number; nombre: string }
  sedeSur: { id: number; nombre: string }
  area: { id: number; nombre: string }
  cargoAnalista: { id: number; nombre: string }
  cargoJefe: { id: number; nombre: string }
}

/** Dos sedes, un área y dos cargos de la empresa del equipo, con la marca y un sufijo único. */
export function sembrarEstructura(sufijo: string): Estructura {
  const organizacion = organizacionDelEquipo()
  const nombre = (que: string) => `${MARCA} ${que} ${sufijo}`
  const sede = (que: string) => {
    const n = nombre(que)
    return { id: Number(insertar(`insert into sede (organizacion_id, nombre, provincia_ubigeo) values
      (${organizacion}, ${literal(n)}, '1501') returning id`).id), nombre: n }
  }
  const cargo = (que: string) => {
    const n = nombre(que)
    const codigo = `QA_PERSONAS_${que.toUpperCase().replace(/[^A-Z]/g, '_')}_${sufijo}`.toUpperCase()
    return { id: Number(insertar(`insert into puesto (organizacion_id, codigo, nombre, nivel_puesto_codigo,
      familia_codigo) values (${organizacion}, ${literal(codigo)}, ${literal(n)}, 'EJECUCION', 'OPERACIONES')
      returning id`).id), nombre: n }
  }
  const areaNombre = nombre('Finanzas')
  return {
    organizacion,
    sedeNorte: sede('Planta Norte'),
    sedeSur: sede('Planta Sur'),
    area: { id: Number(insertar(`insert into area (organizacion_id, nombre) values (${organizacion},
      ${literal(areaNombre)}) returning id`).id), nombre: areaNombre },
    cargoAnalista: cargo('Analista'),
    cargoJefe: cargo('Jefe de finanzas'),
  }
}

/** Una cuenta de panel de la empresa del equipo con UN rol de sistema, y su id de RENASER OS. */
export function sembrarCuentaDePanel(rol: 'TALENTO' | 'RESPONSABLE_AREA' | 'DIRECCION', sufijo: string): string {
  const organizacion = organizacionDelEquipo()
  const renaserOsId = `${PREFIJO_PANEL}${rol.toLowerCase()}-${sufijo}`
  const persona = Number(insertar(`insert into persona (nombre, apellidos) values ('QA',
    ${literal(`${rol} ${sufijo}`)}) returning id`).id)
  const usuario = Number(insertar(`insert into usuario (organizacion_id, persona_id, usuario_renaser_os_id,
    es_equipo, es_activo) values (${organizacion}, ${persona}, ${literal(renaserOsId)}, true, true)
    returning id`).id)
  sql(`insert into usuario_rol (usuario_id, rol_id) select ${usuario}, id from rol
       where organizacion_id = ${organizacion} and codigo = ${literal(rol)};`)
  return renaserOsId
}

export async function tokenDe(renaserOsId: string): Promise<string> {
  const r = await fetch(`${API}/panel/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuarioRenaserOsId: renaserOsId }),
  })
  if (!r.ok) throw new Error(`dev-login de ${renaserOsId} falló: ${r.status}`)
  return (await r.json()).token as string
}

/**
 * Una vacante publicada de la empresa del equipo con el cargo y el área de la
 * prueba —lo que el alta de un contratado precarga—, calcada de la primera que
 * haya para sus pesos.
 */
export function sembrarVacante(e: Estructura, titulo: string): number {
  const responsable = Number(uno(`select id from usuario where usuario_renaser_os_id = ${literal(EQUIPO)}`).id)
  const pesos = uno(`select id from version_pesos where organizacion_id = ${e.organizacion}
                      and estado = 'PUBLICADA' order by id limit 1`).id
  const solicitud = Number(insertar(`
    insert into solicitud_talento (organizacion_id, origen, urgencia, estado, area_id, puesto_id,
                                   nivel_puesto_codigo, familia_codigo, resultado_principal, motivo,
                                   consecuencia_no_contratar, analisis_capacidad, responsable_usuario_id)
    values (${e.organizacion}, 'DIRECTA', 'NORMAL', 'CON_VACANTE', ${e.area.id}, ${e.cargoAnalista.id},
            'EJECUCION', 'OPERACIONES', ${literal(MARCA)}, ${literal(MARCA)}, ${literal(MARCA)},
            ${literal(MARCA)}, ${responsable})
    returning id`).id)
  return Number(insertar(`
    insert into vacante (organizacion_id, solicitud_talento_id, puesto_id, titulo, descripcion, tipo_cierre,
                         estado, version_pesos_id, responsable_usuario_id, aplica_evaluacion,
                         instrumento_etapa_tecnica, remuneracion_tipo, publicada_en)
    values (${e.organizacion}, ${solicitud}, ${e.cargoAnalista.id}, ${literal(`${MARCA} ${titulo}`)},
            ${literal(MARCA)}, 'PERMANENTE', 'PUBLICADA', ${pesos}, ${responsable}, false, 'PLANTILLA',
            'OCULTA', now())
    returning id`).id)
}

/** La postulación de una cuenta de candidato en una vacante, en el estado que se diga. */
export function sembrarPostulacion(vacante: number, correo: string, estado: string, celular?: string): number {
  const usuario = Number(uno(`select id from usuario where correo = ${literal(correo)}`).id)
  const organizacion = Number(uno(`select organizacion_id from vacante where id = ${vacante}`).organizacion_id)
  const postulacion = Number(insertar(`
    insert into postulacion (organizacion_id, usuario_id, vacante_id, estado_codigo)
    values (${organizacion}, ${usuario}, ${vacante}, ${literal(estado)}) returning id`).id)
  if (celular) sql(`insert into dato_cv (postulacion_id, telefono) values (${postulacion}, ${literal(celular)});`)
  return postulacion
}

export interface DatosDeAlta {
  dni: string
  nombres: string
  paterno: string
  ingreso: string
  sede: number
  area: number
  cargo: number
  jefe?: number | null
  sueldo?: number
}

/** Un alta por la API del panel, con la cuenta del equipo (todos los permisos). */
export async function altaPorLaApi(d: DatosDeAlta): Promise<number> {
  const r = await apiPanel<{ id: number }>('/colaboradores', {
    method: 'POST',
    cuerpo: {
      persona: {
        tipoDocumento: '01',
        numeroDocumento: d.dni,
        nombres: d.nombres,
        apellidoPaterno: d.paterno,
        fechaNacimiento: '1990-05-04',
        sexo: 'F',
      },
      fechaIngreso: d.ingreso,
      situacion: {
        sedeId: d.sede,
        areaId: d.area,
        cargoId: d.cargo,
        jefeId: d.jefe ?? null,
        tipoContrato: '01',
        regimenLaboral: '01',
        ...(d.sueldo !== undefined ? { sueldoBase: d.sueldo, moneda: 'PEN' } : {}),
      },
    },
  })
  if (r.estado !== 201) throw new Error(`El alta de ${d.dni} falló: ${r.estado} ${JSON.stringify(r.cuerpo)}`)
  return r.cuerpo.id
}

/** Lo sembrado, fuera: fichas, sedes, el área si quedó libre, y los cargos desactivados. */
export function retirarLoSembrado(e: Estructura | null, vacantes: number[]): void {
  if (!e) return
  const sedes = `${e.sedeNorte.id}, ${e.sedeSur.id}`
  const deSusVacantes = `select id from postulacion where vacante_id in (${vacantes.length ? vacantes.join(', ') : 'null'})`
  // Las fichas se fijan UNA vez, antes de borrar nada: si el criterio se volviera
  // a evaluar en cada sentencia, borrar sus situaciones dejaría fuera a quien se
  // reconocía por su sede, y su ficha quedaría huérfana (sin situación).
  const deLaPrueba = 'select id from qa_personas_fichas'
  sql(`
    begin;
    create temp table qa_personas_fichas on commit drop as
      select c.id from colaborador c where c.organizacion_id = ${e.organizacion}
        and (c.apellido_paterno like ${literal(`%${MARCA}%`)}
             or c.postulacion_id in (${deSusVacantes})
             or exists (select 1 from periodo_laboral p where p.colaborador_id = c.id
                        and p.postulacion_id in (${deSusVacantes}))
             or c.numero_documento like '7%'
                and exists (select 1 from situacion_laboral s where s.colaborador_id = c.id
                            and s.sede_id in (${sedes})));
    update situacion_laboral set jefe_colaborador_id = null where jefe_colaborador_id in (${deLaPrueba});
    delete from situacion_laboral where colaborador_id in (${deLaPrueba});
    delete from cese_anulado where periodo_id in (select id from periodo_laboral where colaborador_id in (${deLaPrueba}));
    delete from periodo_laboral where colaborador_id in (${deLaPrueba});
    delete from colaborador where id in (${deLaPrueba});
    delete from contratado_sin_alta where postulacion_id in (select id from postulacion
      where vacante_id in (${vacantes.length ? vacantes.join(', ') : 'null'}));
    delete from sede where (id in (${sedes}) or (organizacion_id = ${e.organizacion}
        and nombre like ${literal(`${MARCA} %`)}))
      and not exists (select 1 from situacion_laboral s where s.sede_id = sede.id);
    update vacante set eliminada_en = now() where id in (${vacantes.length ? vacantes.join(', ') : 'null'});
    update puesto set es_activo = false where id in (${e.cargoAnalista.id}, ${e.cargoJefe.id});
    update area set es_activa = false where id = ${e.area.id};
    update usuario set es_activo = false where usuario_renaser_os_id like ${literal(`${PREFIJO_PANEL}%`)};
    commit;
  `)
}
