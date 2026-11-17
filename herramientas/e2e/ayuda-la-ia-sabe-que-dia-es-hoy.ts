/**
 * El terreno de la QA de la spec la-ia-sabe-que-dia-es-hoy (backend: specs/Ready/la-ia-sabe-que-dia-es-hoy.md).
 *
 * Parte de la vacante de los informes (`sembrarInformes`, con su propia marca) y le añade lo que
 * esta spec mira; con SQL solo va lo que la IA —apagada en el preview— habría dejado:
 *
 *   - siete postulantes con notas: tres con CV, Perfil Integral y prueba (la captura del
 *     16/11/2026: Robert 60·82·93, Mayra 58·73·88, Ruth 52·70·94), dos con la misma nota
 *     combinada y distinta prueba (Tania y Teo) y dos sin prueba en el grupo ALTA (Ximena y
 *     Alex), para que el ranking los ponga arriba y el visor los baje;
 *   - el celular: de la cuenta y otro en el CV, solo en el CV, ninguno, un fijo y uno corto;
 *   - un entregable de tipo enlace en la prueba de María (el archivo ya lo subió ella);
 *   - textos de la IA con la marca del anonimizador (una afirmación, una pregunta de
 *     validación, un hallazgo y una justificación);
 *   - los afectados del comando: por un hallazgo con fecha «futura», por una justificación,
 *     por los años tapados; y quienes no lo son (justificación ajustada a mano, postulación
 *     que ya no continúa, vacante cerrada).
 *
 * Todo lleva la marca dada; `retirarLoDeLaFecha` lo quita sin tocar nada ajeno.
 */

import { CLAVE_DE_CANDIDATO, crearCuentaDeCandidato } from './ayuda-candidato'
import { API } from './ayuda'
import { correoDePrueba, literal, sql } from './base-de-datos'
import { consultar, postular, postulacionPorUuid, uno } from './ayuda-preguntas-propias'
import { equipoSin, pesosDeRenaser, soloPostula, vacanteConPreguntasYPrueba } from './ayuda-pesos-con-candidatos'
import { ENTREGABLES, retirarLoDeLaQa, sembrarInformes, type Escenario as DeLosInformes } from './ayuda-informes-qa'

export const MARCA = 'QA-FECHA-87'
const PREFIJO_CORREO = 'qa.fecha.87'

export const TAPADO = '[DATO NO UTILIZABLE]'
export const AFIRMACION_TAPADA = `QAFECHA Tiene más de ${TAPADO} de experiencia en Recursos Humanos`
export const AFIRMACION_CON_PREGUNTA_TAPADA = 'QAFECHA declarada con la pregunta tapada'
export const HALLAZGO_TAPADO = `QAFECHA hallazgo: declara ${TAPADO} de experiencia sin respaldo`
export const JUSTIFICACION_TAPADA = `QAFECHA justificación: acredita ${TAPADO} de experiencia en selección`
export const ENLACE_ENTREGABLE = 'https://drive.example.com/qa-fecha-87/presupuesto'
export const HALLAZGO_FECHA = 'Fechas imposibles: dice que trabaja en Ripley desde febrero de 2026, una fecha futura'
export const JUSTIFICACION_FECHA = 'Resta puntos: la experiencia de julio de 2026 es una fecha futura que aún no ocurre'
export const TEXTO_CON_ANIOS = 'Tengo más de 5 años de experiencia en Recursos Humanos. Supervisora de planta, febrero 2026 – actualidad.'

export interface Sembrada {
  nombre: string
  correo: string
  token: string
  uuid: string
  postulacion: number
}

export interface EscenarioFecha {
  informes: DeLosInformes
  vacante: number
  robert: Sembrada
  mayra: Sembrada
  ruth: Sembrada
  tania: Sembrada
  teo: Sembrada
  ximena: Sembrada
  alex: Sembrada
  nora: Sembrada
  /** La de la vacante cerrada (con un hallazgo de fecha: no es afectada). */
  cesar: Sembrada
  vacanteCerrada: number
  /** Talento sin «ver_perfil_integral»: no ve la nota del CV. */
  sinCv: string
  /** Talento sin «descargar_entregables». */
  sinEntregables: string
}

async function persona(vacante: number, nombre: string, apellidos: string, correos: string[]): Promise<Sembrada> {
  const correo = correoDePrueba(PREFIJO_CORREO)
  correos.push(correo)
  await crearCuentaDeCandidato({ nombre, apellidos, correo })
  const r = await fetch(`${API}/portal/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo, contrasena: CLAVE_DE_CANDIDATO }),
  })
  if (!r.ok) throw new Error(`login portal de ${correo} falló: ${r.status}`)
  const token = (await r.json()).token as string
  const uuid = await postular(token, vacante)
  return { nombre: `${nombre} ${apellidos}`, correo, token, uuid, postulacion: postulacionPorUuid(uuid) }
}

const versionDe = (postulacion: number): number =>
  Number(uno(`select v.version_pesos_id from postulacion p join vacante v on v.id = p.vacante_id where p.id = ${postulacion}`)
    .version_pesos_id)

const criteriosDelCv = (): number[] =>
  consultar(`select id from criterio where etapa_codigo = 'PERFIL_INTEGRAL' and version_plantilla_prueba_id is null
              order by orden`).map((f) => Number(f.id))

/** Las tres notas (o dos) como las habrían dejado la IA y las personas: CV, Perfil Integral y prueba. */
function notas(p: number, n: { cv: number; pi: number; prueba: number | null; grupo: string }): void {
  const version = versionDe(p)
  const filas = criteriosDelCv().map((id, i) => `(${p}, ${id}, ${n.cv}, ${literal(`QAFECHA criterio ${i + 1}: con su ejemplo.`)}, 'AGENTE')`)
  sql(`begin;
       insert into nota_criterio (postulacion_id, criterio_id, puntaje, explicacion, origen) values ${filas.join(', ')};
       insert into nota_etapa (postulacion_id, etapa_codigo, puntaje, version_pesos_id) values (${p}, 'PERFIL_INTEGRAL', ${n.pi}, ${version});
       ${n.prueba === null ? '' : `insert into nota_etapa (postulacion_id, etapa_codigo, puntaje, version_pesos_id)
                                    values (${p}, 'PRUEBA_PUESTO', ${n.prueba}, ${version});`}
       update postulacion set grupo_prioridad = ${literal(n.grupo)} where id = ${p};
       commit;`)
}

/** El celular de la cuenta (E.164 o nulo) y el que la IA leyó del CV (tal cual, o nada). */
function celulares(p: number, deLaCuenta: string | null, delCv: string | null): void {
  sql(`update persona set telefono = ${literal(deLaCuenta)}
        where id = (select u.persona_id from usuario u join postulacion x on x.usuario_id = u.id where x.id = ${p});`)
  if (delCv !== null) {
    sql(`insert into dato_cv (postulacion_id, nombre, telefono) values (${p}, 'QAFECHA', ${literal(delCv)})
         on conflict (postulacion_id) do update set telefono = excluded.telefono;`)
  }
}

/** Un retrato hecho sin la fecha de hoy (sin ejecución anotada), con los hallazgos dados. */
function retratoViejo(p: number, hallazgos: [tipo: string, descripcion: string][] = []): void {
  const perfil = Number(sql(`insert into perfil_talento (postulacion_id, confianza_evidencia, resumen, version_pesos_id)
                             values (${p}, 60, 'QAFECHA retrato', ${versionDe(p)}) returning id;`))
  if (!Number.isInteger(perfil) || perfil <= 0) throw new Error(`El retrato de ${p} no devolvió su id`)
  if (hallazgos.length) {
    sql(`insert into hallazgo_perfil (perfil_talento_id, tipo, descripcion) values
         ${hallazgos.map(([t, d]) => `(${perfil}, ${literal(t)}, ${literal(d)})`).join(', ')};`)
  }
}

const textoDelCv = (p: number, texto: string): void => {
  sql(`update cv set texto_extraido = ${literal(texto)} where postulacion_id = ${p};`)
}

/** Siembra el escenario entero. `correos` recoge las cuentas para la limpieza. */
export async function sembrarLaFecha(equipo: string, correos: string[], marca: string = MARCA): Promise<EscenarioFecha> {
  const informes = await sembrarInformes(equipo, correos, marca)
  const vacante = informes.vacante

  const robert = await persona(vacante, 'Robert', 'Villegas QAFECHA', correos)
  const mayra = await persona(vacante, 'Mayra', 'Garcia-Godos QAFECHA', correos)
  const ruth = await persona(vacante, 'Ruth', 'Suri QAFECHA', correos)
  const tania = await persona(vacante, 'Tania', 'Empate QAFECHA', correos)
  const teo = await persona(vacante, 'Teo', 'Empate QAFECHA', correos)
  const ximena = await persona(vacante, 'Ximena', 'Aleman QAFECHA', correos)
  const alex = await persona(vacante, 'Alex', 'Aquise QAFECHA', correos)
  const nora = await persona(vacante, 'Nora', 'Ya No Continua QAFECHA', correos)

  // Las notas (AC-09): el ranking ordena por grupo y luego por el Perfil Integral; el visor no.
  notas(robert.postulacion, { cv: 60, pi: 82, prueba: 93, grupo: 'NO_PRIORIZADO' })
  notas(mayra.postulacion, { cv: 58, pi: 73, prueba: 88, grupo: 'NO_PRIORIZADO' })
  notas(ruth.postulacion, { cv: 52, pi: 70, prueba: 94, grupo: 'POTENCIAL_CON_RIESGO' })
  // Misma combinada con pesos 40/30: (4·70 + 3·80) / 7 = (4·73 + 3·76) / 7 = 74,29. Teo va antes en el ranking.
  notas(tania.postulacion, { cv: 50, pi: 70, prueba: 80, grupo: 'POTENCIAL_CON_RIESGO' })
  notas(teo.postulacion, { cv: 50, pi: 73, prueba: 76, grupo: 'ALTA' })
  notas(ximena.postulacion, { cv: 75, pi: 90, prueba: null, grupo: 'ALTA' })
  notas(alex.postulacion, { cv: 40, pi: 45, prueba: null, grupo: 'ALTA' })

  // El celular (AC-14 a AC-16)
  celulares(robert.postulacion, '+51987111222', '912 345 678')
  celulares(mayra.postulacion, null, '+51 923-456-789')
  celulares(ruth.postulacion, null, null)
  celulares(ximena.postulacion, '+5114567890', null)
  celulares(alex.postulacion, null, '98765432')

  // El entregable de tipo enlace de María (el archivo ya lo subió en sembrarInformes)
  const intento = Number(uno(`select id from intento_prueba where postulacion_id = ${informes.maria.postulacion}`).id)
  const requerido = Number(uno(`select er2.id from entregable e
                                  join entregable_requerido er on er.id = e.entregable_requerido_id
                                  join entregable_requerido er2 on er2.nombre = ${literal(ENTREGABLES[1])}
                                   and er2.version_banco_id is not distinct from er.version_banco_id
                                   and er2.version_plantilla_prueba_id is not distinct from er.version_plantilla_prueba_id
                                 where e.intento_prueba_id = ${intento} limit 1`).id)
  sql(`insert into entregable (intento_prueba_id, entregable_requerido_id, enlace, version)
       values (${intento}, ${requerido}, ${literal(ENLACE_ENTREGABLE)}, 1);`)

  // La marca del anonimizador en textos de la IA (AC-08)
  const cvMaria = Number(uno(`select id from cv where postulacion_id = ${informes.maria.postulacion}`).id)
  sql(`insert into afirmacion_cv (cv_id, texto, clasificacion, pregunta_validacion) values
         (${cvMaria}, ${literal(AFIRMACION_TAPADA)}, 'FALTA_INFO', '¿Cuántos años de experiencia tienes en RR. HH.?'),
         (${cvMaria}, ${literal(AFIRMACION_CON_PREGUNTA_TAPADA)}, 'DECLARADA', ${literal(`¿Dónde acumulaste ${TAPADO} en el rubro?`)});`)
  const perfilMaria = Number(uno(`select id from perfil_talento where postulacion_id = ${informes.maria.postulacion}`).id)
  sql(`insert into hallazgo_perfil (perfil_talento_id, tipo, descripcion, sugerencia)
       values (${perfilMaria}, 'RIESGO_DESARROLLABLE', ${literal(HALLAZGO_TAPADO)}, 'Preguntarle por sus años en selección.');`)
  const ultimoCriterio = criteriosDelCv().at(-1)!
  sql(`update nota_criterio set explicacion = ${literal(JUSTIFICACION_TAPADA)}
        where postulacion_id = ${informes.maria.postulacion} and criterio_id = ${ultimoCriterio};`)

  // Los afectados del comando (AC-17): por un hallazgo, por una justificación y por los años
  retratoViejo(robert.postulacion, [['RIESGO_CRITICO', HALLAZGO_FECHA]])
  retratoViejo(tania.postulacion)
  sql(`update nota_criterio set explicacion = ${literal(JUSTIFICACION_FECHA)}
        where postulacion_id = ${tania.postulacion} and criterio_id = ${criteriosDelCv()[0]};`)
  retratoViejo(mayra.postulacion)
  textoDelCv(mayra.postulacion, TEXTO_CON_ANIOS)
  // …y quienes no lo son: la justificación con la fecha la ajustó una persona
  retratoViejo(ruth.postulacion)
  const ajusta = Number(uno("select id from usuario where usuario_renaser_os_id = 'dev-equipo'").id)
  sql(`update nota_criterio set explicacion = ${literal(JUSTIFICACION_FECHA)}, ajustada_por_usuario_id = ${ajusta},
              motivo_ajuste = 'QAFECHA la ajustó una persona', ajustada_en = now()
        where postulacion_id = ${ruth.postulacion} and criterio_id = ${criteriosDelCv()[0]};`)
  // …una postulación que ya no continúa
  retratoViejo(nora.postulacion, [['RIESGO_CRITICO', HALLAZGO_FECHA]])
  textoDelCv(nora.postulacion, TEXTO_CON_ANIOS)
  sql(`update postulacion set estado_codigo = 'NO_CONTINUA', movido_en = now() where id = ${nora.postulacion};`)
  // …y una vacante cerrada
  const vacanteCerrada = await vacanteConPreguntasYPrueba(equipo, marca, 'Vacante cerrada de la fecha', pesosDeRenaser())
  const c = await soloPostula(marca, vacanteCerrada, 'Cesar', correos)
  retratoViejo(c.postulacion, [['RIESGO_CRITICO', HALLAZGO_FECHA]])
  textoDelCv(c.postulacion, TEXTO_CON_ANIOS)
  sql(`update vacante set estado = 'CERRADA' where id = ${vacanteCerrada};`)

  return {
    informes,
    vacante,
    robert,
    mayra,
    ruth,
    tania,
    teo,
    ximena,
    alex,
    nora,
    cesar: c,
    vacanteCerrada,
    sinCv: equipoSin(marca, 'sin-cv', ['ver_perfil_integral']),
    sinEntregables: equipoSin(marca, 'sin-entregables', ['descargar_entregables']),
  }
}

/** Quita lo de la QA: lo de los informes y lo de la fecha, por marca y por correos exactos. */
export function retirarLoDeLaFecha(correos: readonly string[], marca: string = MARCA): void {
  retirarLoDeLaQa(correos, marca)
}

/** La nota combinada del RF-155 con los pesos de la vacante, redondeada como el backend. */
export function combinada(vacante: number, pi: number, prueba: number): number {
  const pesos = consultar(`select pe.etapa_codigo, pe.peso from vacante v join peso_etapa pe on pe.version_pesos_id = v.version_pesos_id
                            where v.id = ${vacante} and pe.etapa_codigo in ('PERFIL_INTEGRAL', 'PRUEBA_PUESTO')`)
  const peso = (codigo: string) => Number(pesos.find((f) => f.etapa_codigo === codigo)!.peso)
  const wPi = peso('PERFIL_INTEGRAL')
  const wPr = peso('PRUEBA_PUESTO')
  return Math.round(((pi * wPi + prueba * wPr) / (wPi + wPr)) * 100) / 100
}
