import { expect } from '@playwright/test'
import { borrarCuentasDePrueba } from './ayuda-candidato'
import { literal, sql } from './base-de-datos'
import { consultar, exigir, uno } from './ayuda-preguntas-propias'
import {
  candidataEnLaPrueba,
  crearVacante,
  escribirPrueba,
  lugarDe,
  publicarPrueba,
  quitarTrabajo,
  type Candidata,
} from './ayuda-prueba-propia'

/**
 * El terreno de la QA de «Las pruebas incompletas, dentro del ranking y con
 * «Darle más tiempo»» (V89): una vacante con la prueba del editor cronometrada,
 * solo con preguntas cerradas (se califica sola al entregar, sin IA), y una
 * cuenta de panel sin `mover_postulacion`.
 *
 * ⚠️ **ESCRIBE** en el clon del trabajo, con la marca `QA-MT-0089` en los
 * títulos, los correos `qa.mt.0089.<uuid>@example.com` y las cuentas de panel
 * `qa-mt-0089-*`. `retirarLoSembrado` quita solo eso.
 */

export const MARCA = 'QA-MT-0089'
const SEMBRADO = `${MARCA} sembrado a mano para revisar`
const PREFIJO_CORREO = 'qa.mt.0089'
const PREFIJO_PANEL = 'qa-mt-0089-'
const PREFIJO_ROL = 'QA_MT_0089_'

export const CASO = `${MARCA}: la caja de la sede norte cerró con S/ 480 de menos. Encuentra el descuadre.`
export const Q1 = '¿Qué documento cuadra primero la caja del día?'
export const Q2 = '¿Qué revisas antes de cerrar la caja?'
export const Q3 = '¿Qué función busca un valor en una tabla?'
export const MINUTOS = 30

/** La vacante, publicada, con su prueba del editor publicada y sin la evaluación del banco. */
export async function vacanteConPrueba(equipo: string, nombre: string, marca: string = MARCA): Promise<number> {
  const vacante = await crearVacante(equipo, nombre, await lugarDe(equipo), undefined, marca)
  await escribirPrueba(equipo, vacante, {
    criterios: [
      {
        nombre: 'Cuadre de caja',
        queEvalua: 'Cuadra la caja sin ayuda.',
        preguntas: [
          { tipo: 'OPCION_UNICA', enunciado: Q1, puntos: 30, opciones: [{ texto: 'El arqueo', puntos: 30 }, { texto: 'El kárdex', puntos: 0 }] },
          {
            tipo: 'OPCION_MULTIPLE', enunciado: Q2, puntos: 30,
            opciones: [{ texto: 'Los vouchers', puntos: 15 }, { texto: 'El fondo fijo', puntos: 15 }, { texto: 'El clima', puntos: 0 }],
          },
        ],
      },
      {
        nombre: 'Manejo de Excel',
        queEvalua: 'Usa Excel con soltura.',
        preguntas: [
          { tipo: 'OPCION_UNICA', enunciado: Q3, puntos: 40, opciones: [{ texto: 'BUSCARV', puntos: 40 }, { texto: 'SUMA', puntos: 0 }] },
        ],
      },
    ],
    datos: { enunciado: CASO, modalidad: 'CRONOMETRADA', duracionMinutos: MINUTOS, herramientasPermitidas: 'Excel' },
  })
  const publicada = await publicarPrueba(equipo, vacante)
  if (publicada.estado !== 200) {
    throw new Error(`publicar la prueba contestó ${publicada.estado}: ${JSON.stringify(publicada.cuerpo)}`)
  }
  // La evaluación del banco apagada: quien postula va directo a la bandeja y su única
  // evaluación es la prueba.
  await exigir(`/panel/vacantes/${vacante}/aplicacion-evaluacion`, equipo, 'POST', { aplica: false })
  await exigir(`/panel/vacantes/${vacante}/publicacion`, equipo, 'POST')
  return vacante
}

/** Cuenta, postulación y paso a la prueba, con los correos de esta QA. */
export const candidata = (equipo: string, vacante: number, nombre: string, correos: string[]): Promise<Candidata> =>
  candidataEnLaPrueba(equipo, vacante, nombre, correos, PREFIJO_CORREO)

/** Espera al barrido de vencimientos (cada 60 s): todas cerradas, entregadas o sin completar. */
export async function esperarAlBarrido(postulaciones: number[]): Promise<void> {
  await expect
    .poll(
      () =>
        Number(
          uno(`select count(*) as n from intento_prueba
                where postulacion_id in (${postulaciones.join(',')}) and entregado_en is not null`).n,
        ),
      { timeout: 150_000, intervals: [2_000] },
    )
    .toBe(postulaciones.length)
}

/** Una cuenta de panel (dev-login) con el rol de Talento menos esos permisos. */
export function equipoSin(sufijo: string, sin: readonly string[]): string {
  const plataforma = Number(uno('select id from organizacion where es_plataforma').id)
  const renaserOsId = `${PREFIJO_PANEL}${sufijo}`
  const codigo = `${PREFIJO_ROL}${sufijo.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`
  const rol = JSON.parse(
    sql(`with f as (insert into rol (organizacion_id, codigo, nombre, descripcion)
                    values (${plataforma}, ${literal(codigo)}, ${literal(codigo)}, ${literal(SEMBRADO)}) returning id)
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

/** El texto de un `datetime-local` en hora de Lima, a `horas` de ahora (negativas: en el pasado). */
export function enLimaDentroDeHoras(horas: number): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(Date.now() + horas * 3_600_000))
  const de = (t: string) => partes.find((p) => p.type === t)!.value
  return `${de('year')}-${de('month')}-${de('day')}T${de('hour')}:${de('minute')}`
}

/** Lo mismo, como instante UTC: Lima es UTC-5 todo el año. */
export const instanteDeLima = (campo: string): number => Date.parse(`${campo}:00-05:00`)

/**
 * Quita lo sembrado por esta QA: cuentas de candidato por correo exacto, las
 * vacantes con la marca (marcadas eliminadas: cuelgan de demasiado para borrarlas
 * sin tocar datos ajenos), sus solicitudes y la cuenta y el rol de panel.
 */
export function retirarLoSembrado(correos: readonly string[]): void {
  const vacantes = consultar(`select id from vacante where titulo like ${literal(`${MARCA}%`)}`).map((f) => Number(f.id))
  if (vacantes.length) {
    const trabajos = consultar(`select t.id from trabajo_ia t join postulacion p on p.id = t.postulacion_id
                                 where p.vacante_id in (${vacantes.join(',')}) and t.estado = 'EN_CURSO'`)
    for (const t of trabajos) quitarTrabajo(Number(t.id))
  }
  if (correos.length) borrarCuentasDePrueba(correos)
  if (vacantes.length) {
    sql(`update vacante set eliminada_en = now(), archivada_en = null
          where id in (${vacantes.join(',')}) and eliminada_en is null;`)
  }
  sql(`update solicitud_talento set estado = 'ARCHIVADA' where motivo = ${literal(SEMBRADO)} and estado <> 'ARCHIVADA';`)
  sql(`
    begin;
    create temporary table qa_mt_panel on commit drop as
      select id, persona_id from usuario where usuario_renaser_os_id like ${literal(`${PREFIJO_PANEL}%`)};
    delete from usuario_rol where usuario_id in (select id from qa_mt_panel);
    delete from usuario u where u.id in (select id from qa_mt_panel)
       and not exists (select 1 from auditoria a where a.usuario_id = u.id)
       and not exists (select 1 from vacante v where v.responsable_usuario_id = u.id);
    update usuario set es_activo = false, usuario_renaser_os_id = 'qa-retirada-' || gen_random_uuid()
     where id in (select id from qa_mt_panel);
    delete from persona where id in (select persona_id from qa_mt_panel)
       and not exists (select 1 from usuario u where u.persona_id = persona.id);
    delete from rol_permiso where rol_id in (select id from rol where codigo like ${literal(`${PREFIJO_ROL}%`)});
    delete from rol r where r.codigo like ${literal(`${PREFIJO_ROL}%`)}
       and not exists (select 1 from usuario_rol ur where ur.rol_id = r.id);
    commit;`)
}
