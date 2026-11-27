/**
 * El terreno de la QA del seguimiento de pendientes entre etapas (V94,
 * specs/Ready/seguimiento-de-pendientes-entre-etapas).
 *
 * La IA del preview está apagada y el QA prueba el mecanismo, no el criterio de la IA (D-4). Así que
 * el seguimiento se siembra por el mismo camino que usa la plataforma, sin calcular la huella aquí:
 *
 *   1. un trabajo vivo del agente `SEGUIMIENTO_PENDIENTES` para esa etapa (lo que deja la cola);
 *   2. abrir el informe: el backend calcula la huella de los datos de hoy y la anota como pedida;
 *   3. «llega» el seguimiento: la huella guardada pasa a ser la pedida, con las dudas que habría
 *      devuelto la IA ya comprobadas, y el trabajo termina.
 *
 * Parte del escenario de `ayuda-informes-qa.ts` (María José, con evaluación y prueba calificadas) con
 * su propia marca. Todo lleva la marca `QA-SEG-94`; `retirarLoDelSeguimiento` lo quita sin tocar nada
 * ajeno. Para dejar un caso a la vista de la revisión humana se usa otra marca que no empiece por
 * `QA-SEG-94 ` y no se retira.
 */

import { literal, sql } from './base-de-datos'
import { consultar, exigir, uno } from './ayuda-preguntas-propias'
import { DECLARADAS, SIN_INFO, retirarLoDeLaQa, sembrarInformes, type Escenario } from './ayuda-informes-qa'

export const MARCA_SEG = 'QA-SEG-94'

export type Etapa = 'EVALUACION' | 'PRUEBA'

export interface Punto { texto: string; detalle: string | null; origen: string | null; etiqueta: string | null; grupo: string | null }
export interface Bloque { codigo: string; titulo: string; tono: string; puntos: Punto[] }
export interface PreguntaAnexo { numero: number; enunciado: string; respuesta: string | null }
export interface Informe {
  etapa: string
  nota: { valor: number | null; texto: string } | null
  grupo: string | null
  bloques: Bloque[]
  anexo: { preguntas: PreguntaAnexo[] } | null
  textosEnCamino: boolean
}

/** Una duda como la guarda el backend en `seguimiento_pendiente.dudas`. */
export interface DudaGuardada {
  codigo: string
  origen: 'CV' | 'EVALUACION'
  texto: string
  clasificacion: string
  preguntaDeValidacion: string | null
  estado: 'RESUELTA' | 'SIGUE_PENDIENTE' | 'EMPEORO'
  pregunta: number | null
  entregable: string | null
  cita: string | null
  explicacion: string | null
  citadaEn: Etapa | null
}

export const informe = (equipo: string, postulacion: number, etapa: 'evaluacion' | 'prueba'): Promise<Informe> =>
  exigir<Informe>(`/panel/postulaciones/${postulacion}/informes/${etapa}`, equipo)

export const bloque = (i: Informe, codigo: string): Bloque | undefined => i.bloques.find((b) => b.codigo === codigo)

/** El número de la pregunta en el anexo del informe. */
export function numeroDe(i: Informe, enunciado: string): number {
  const p = i.anexo?.preguntas.find((q) => q.enunciado === enunciado)
  if (!p) throw new Error(`La pregunta «${enunciado}» no está en el anexo del informe ${i.etapa}`)
  return p.numero
}

/** Un trabajo vivo de la cola para esa postulación, como lo deja al encolar. */
export function trabajoVivo(postulacion: number, agente: 'SEGUIMIENTO_PENDIENTES' | 'REDACTOR_INFORME', referencia: string): number {
  const id = Number(sql(`insert into trabajo_ia (organizacion_id, agente_codigo, postulacion_id, referencia_tabla, referencia_id, estado, modo)
                         select organizacion_id, ${literal(agente)}, id, ${literal(referencia)}, id, 'EN_CURSO', 'FINA'
                           from postulacion where id = ${postulacion} returning id;`))
  if (!Number.isInteger(id) || id <= 0) throw new Error(`No se pudo crear el trabajo ${agente} de la postulación ${postulacion}`)
  return id
}

export const seguimientoVivo = (postulacion: number, etapa: Etapa): number =>
  trabajoVivo(postulacion, 'SEGUIMIENTO_PENDIENTES', `seguimiento_${etapa.toLowerCase()}`)

export function terminarTrabajo(id: number, estado: 'TERMINADO' | 'FALLIDO' = 'TERMINADO'): void {
  sql(`update trabajo_ia set estado = ${literal(estado)}, terminado_en = now() where id = ${id};`)
}

export interface FilaSeguimiento { huella: string | null; huella_pedida: string | null; pedida_en: string | null; escrita_en: string | null; dudas: string | null }

export function filaSeguimiento(postulacion: number, etapa: Etapa): FilaSeguimiento | null {
  const filas = consultar(`select huella, huella_pedida, pedida_en, escrita_en, dudas from seguimiento_pendiente
                            where postulacion_id = ${postulacion} and etapa = ${literal(etapa)}`)
  return (filas[0] as unknown as FilaSeguimiento) ?? null
}

export interface FilaTextos { huella_pedida: string | null; pedida_en: string | null }

export function filaTextos(postulacion: number, etapa: Etapa): FilaTextos | null {
  const filas = consultar(`select huella_pedida, pedida_en from texto_informe
                            where postulacion_id = ${postulacion} and etapa = ${literal(etapa)}`)
  return (filas[0] as unknown as FilaTextos) ?? null
}

/** «Llega» el seguimiento pedido: se guarda con la huella que pidió el backend y el trabajo termina. */
export function llegaElSeguimiento(postulacion: number, etapa: Etapa, dudas: DudaGuardada[], trabajo: number): void {
  const n = Number(sql(`with s as (update seguimiento_pendiente set huella = huella_pedida, dudas = ${literal(JSON.stringify(dudas))},
                                   motivos = '[]', descartados = 0, escrita_en = now()
                             where postulacion_id = ${postulacion} and etapa = ${literal(etapa)} and huella_pedida is not null
                             returning id) select count(*) from s;`))
  if (n !== 1) throw new Error(`No había un seguimiento ${etapa} pedido para la postulación ${postulacion}`)
  terminarTrabajo(trabajo)
}

/** Lo que una persona juzgaría de la nota y el lugar: no puede cambiar con el seguimiento (AC-12). */
export function notasYEtapa(postulacion: number): string {
  return sql(`select json_build_object(
      'estado', (select json_build_array(estado_codigo, grupo_prioridad) from postulacion where id = ${postulacion}),
      'cv', (select coalesce(json_agg(json_build_array(criterio_id, puntaje) order by criterio_id), '[]') from nota_criterio where postulacion_id = ${postulacion}),
      'etapa', (select coalesce(json_agg(json_build_array(n.etapa_codigo, n.puntaje) order by n.etapa_codigo), '[]') from nota_etapa n where n.postulacion_id = ${postulacion}),
      'respuestas', (select coalesce(json_agg(json_build_array(r.id, nr.puntaje) order by r.id), '[]')
                       from respuesta r join postulacion p on p.evaluacion_id = r.evaluacion_id
                       join nota_respuesta nr on nr.respuesta_id = r.id where p.id = ${postulacion}),
      'prueba', (select coalesce(json_agg(json_build_array(n.criterio_banco_id, n.puntaje) order by n.criterio_banco_id), '[]')
                   from nota_criterio_prueba n join intento_prueba i on i.id = n.intento_prueba_id where i.postulacion_id = ${postulacion}),
      'transiciones', (select count(*) from transicion_estado where postulacion_id = ${postulacion}));`)
}

/** El texto de una afirmación del CV tal como lo copia el seguimiento (sin las comillas del informe). */
export const sinComillas = (texto: string): string => texto.replace(/^«|»$/g, '')

/**
 * Lo que habría devuelto la IA en la evaluación de María José, ya comprobado: con las cuatro dudas de
 * su CV (en el orden del informe), una resuelta, una que empeora y dos pendientes. Las citas son
 * literales de sus respuestas del anexo.
 */
export function dudasDeLaEvaluacion(eva: Informe, citas: { resuelta: { pregunta: number; cita: string }; empeoro: { pregunta: number; cita: string } }) {
  const delCv = bloque(eva, 'PIDIO_EL_CV')!.puntos
  if (delCv.length !== 4) throw new Error(`Se esperaban las cuatro dudas del CV y hay ${delCv.length}`)
  const clasificacion = (p: Punto): string => (consultarClasificacion(sinComillas(p.texto)))
  const base = (p: Punto, i: number) => ({
    codigo: `D${delCv.indexOf(p) + 1 || i + 1}`, origen: 'CV' as const, texto: sinComillas(p.texto), clasificacion: clasificacion(p),
    preguntaDeValidacion: p.detalle, entregable: null, citadaEn: null,
  })
  const de = (texto: string): Punto => {
    const p = delCv.find((q) => sinComillas(q.texto) === texto)
    if (!p) throw new Error(`La duda «${texto}» no está en «Lo que pidió el CV»`)
    return p
  }
  const [planillas, excel, ingles, sst] = [de(DECLARADAS[0]!.texto), de(DECLARADAS[1]!.texto), de(DECLARADAS[2]!.texto), de(SIN_INFO.texto)]
  return {
    planillas, excel, ingles, sst,
    // En el orden en que se mandan (D1, D2…), como las guarda el agente.
    dudas: ([
      { ...base(planillas, 0), estado: 'EMPEORO', pregunta: citas.empeoro.pregunta, cita: citas.empeoro.cita,
        explicacion: 'Habla del costo por contratación y no de la planilla que el CV daba por llevada.', citadaEn: 'EVALUACION' },
      { ...base(excel, 1), estado: 'SIGUE_PENDIENTE', pregunta: null, cita: null, explicacion: null },
      { ...base(ingles, 2), estado: 'SIGUE_PENDIENTE', pregunta: null, cita: null, explicacion: null },
      { ...base(sst, 3), estado: 'RESUELTA', pregunta: citas.resuelta.pregunta, cita: citas.resuelta.cita,
        explicacion: 'Cuenta que acordó con el comité un cronograma de equipos de protección.', citadaEn: 'EVALUACION' },
    ] as DudaGuardada[]).sort((a, b) => Number(a.codigo.slice(1)) - Number(b.codigo.slice(1))),
  }
}

function consultarClasificacion(texto: string): string {
  return String(uno(`select clasificacion from afirmacion_cv where texto = ${literal(texto)} limit 1`).clasificacion)
}

/** Lo que dejó la evaluación por verificar, como lo enseña el grupo «De la evaluación» de la prueba. */
export const deLaEvaluacion = (prueba: Informe): Punto[] =>
  bloque(prueba, 'PENDIENTE')!.puntos.filter((p) => p.grupo === 'De la evaluación')

/** Una cita literal de la prueba: la pregunta del anexo y un trozo seguido de su respuesta. */
export interface CitaDeLaPrueba { pregunta: number; cita: string; explicacion: string }

/**
 * Lo que habría devuelto la IA en la prueba, ya comprobado. Recibe solo lo que siguió abierto tras la
 * evaluación (en su orden, renumerado) y lo que la evaluación dejó por verificar (D-1):
 *   - lo que empeoró y la prueba no toca conserva su estado y su cita de la evaluación;
 *   - una duda del CV y la falta de evidencia quedan resueltas en la prueba;
 *   - el patrón «No se metió en lo incómodo», si lo hay, también (AC-17);
 *   - lo demás sigue pendiente.
 */
export function dudasDeLaPrueba(
  deLaEva: DudaGuardada[],
  pendientesDeLaEvaluacion: Punto[],
  resuelve: { delCv: string; cita: CitaDeLaPrueba; faltaEvidencia: CitaDeLaPrueba; patron: CitaDeLaPrueba },
): DudaGuardada[] {
  const abiertas = deLaEva.filter((d) => d.estado !== 'RESUELTA')
  const salida: DudaGuardada[] = abiertas.map((d, i) => {
    const codigo = `D${i + 1}`
    if (d.texto === resuelve.delCv) {
      return { ...d, codigo, estado: 'RESUELTA', pregunta: resuelve.cita.pregunta, entregable: null, cita: resuelve.cita.cita,
        explicacion: resuelve.cita.explicacion, citadaEn: 'PRUEBA' }
    }
    return { ...d, codigo }
  })
  for (const p of pendientesDeLaEvaluacion) {
    const codigo = `D${salida.length + 1}`
    const abierta: DudaGuardada = { codigo, origen: 'EVALUACION', texto: p.texto, clasificacion: p.etiqueta!, preguntaDeValidacion: p.detalle,
      estado: 'SIGUE_PENDIENTE', pregunta: null, entregable: null, cita: null, explicacion: null, citadaEn: null }
    const c = p.etiqueta === 'Falta evidencia' ? resuelve.faltaEvidencia
      : p.etiqueta === 'Patrón' && p.texto === 'No se metió en lo incómodo' ? resuelve.patron : null
    salida.push(c ? { ...abierta, estado: 'RESUELTA', pregunta: c.pregunta, cita: c.cita, explicacion: c.explicacion, citadaEn: 'PRUEBA' } : abierta)
  }
  return salida
}

/** Quita lo de la QA: los seguimientos (V94) y después todo lo del escenario de los informes. */
export function retirarLoDelSeguimiento(correos: readonly string[], marca: string = MARCA_SEG): void {
  const vacantes = consultar(`select id from vacante where titulo like ${literal(`${marca} %`)}`).map((f) => Number(f.id))
  if (vacantes.length) {
    sql(`delete from seguimiento_pendiente where postulacion_id in (
           select id from postulacion where vacante_id in (${vacantes.join(',')}));`)
  }
  retirarLoDeLaQa(correos, marca)
}

export const sembrarParaElSeguimiento = (equipo: string, correos: string[], marca: string = MARCA_SEG): Promise<Escenario> =>
  sembrarInformes(equipo, correos, marca)
