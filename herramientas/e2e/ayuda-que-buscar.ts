/**
 * El terreno de la QA de «Qué buscar en el CV» (V80, specs/que-buscar-en-el-cv).
 *
 * La búsqueda la hace la IA, y en el preview la IA está apagada: lo que habría dejado se
 * siembra con SQL sobre la vacante llena del escenario («Desarrollador web»), tal como lo
 * guarda el backend —las líneas, la búsqueda de cada persona y una fila por línea—:
 *
 *   - la primera persona lo tiene todo (4 de 4), con la frase de cada línea;
 *   - la segunda tiene 1, menciona 1 y no aparecen 2, con sus preguntas;
 *   - la tercera tiene el CV sin texto;
 *   - las demás quedan pendientes (sin nada guardado).
 *
 * `quitarLoBuscado` lo retira todo al terminar: la vacante vuelve a no buscar nada.
 */

import { sql } from './base-de-datos'

export const LINEAS = [
  'QA-QB-80 Experiencia en cocina saludable',
  'QA-QB-80 Ha dirigido un equipo de cocina',
  'QA-QB-80 Controla costos y mermas',
  'QA-QB-80 Certificado de manipulación de alimentos',
] as const

type Fila = Record<string, string | number | null>

// En un CTE y no en una subconsulta: Postgres no admite un INSERT … RETURNING dentro de FROM.
const consultar = (consulta: string): Fila[] =>
  JSON.parse(sql(`with f as (${consulta}) select coalesce(json_agg(f), '[]') from f;`)) as Fila[]

const comillas = (texto: string) => `'${texto.replace(/'/g, "''")}'`

export interface Sembrado {
  /** El nombre como lo pinta el ranking, de quien lo tiene todo, de quien tiene 1 y del CV sin texto. */
  todo: string
  uno: string
  sinTexto: string
}

/** Siembra las líneas y lo encontrado en las tres primeras postulaciones de la vacante. */
export function sembrarLoBuscado(vacante: number): Sembrado {
  quitarLoBuscado(vacante)
  const version = Number(
    consultar(`select coalesce(max(version_lineas), 0) + 1 as v from linea_busqueda_cv where vacante_id = ${vacante}`)[0]!.v,
  )
  const lineas = LINEAS.map((texto, i) =>
    Number(
      consultar(`insert into linea_busqueda_cv (vacante_id, version_lineas, orden, texto)
                 values (${vacante}, ${version}, ${i + 1}, ${comillas(texto)}) returning id`)[0]!.id,
    ),
  )
  const personas = consultar(`
      select p.id, trim(coalesce(pe.nombre, '') || ' ' || coalesce(pe.apellidos, '')) as nombre
        from postulacion p join usuario u on u.id = p.usuario_id join persona pe on pe.id = u.persona_id
       where p.vacante_id = ${vacante} and pe.anonimizado_en is null
       order by p.id limit 3`)
  if (personas.length < 3) throw new Error(`La vacante ${vacante} no tiene tres postulaciones que sembrar`)

  const busqueda = (postulacion: number, estado: string, motivo: string | null) =>
    Number(
      consultar(`insert into busqueda_cv (postulacion_id, version_lineas, estado, motivo)
                 values (${postulacion}, ${version}, '${estado}', ${motivo === null ? 'null' : comillas(motivo)})
                 returning id`)[0]!.id,
    )
  const resultado = (b: number, postulacion: number, linea: number, estado: string, i: number) =>
    sql(`insert into resultado_busqueda_cv (busqueda_cv_id, postulacion_id, linea_busqueda_cv_id,
                                            version_lineas, estado, frase_cv, nota, pregunta)
         values (${b}, ${postulacion}, ${linea}, ${version}, '${estado}',
                 ${estado === 'TIENE' ? comillas(`Frase del CV ${i + 1}`) : 'null'},
                 ${comillas(`Nota de la línea ${i + 1}`)},
                 ${estado === 'TIENE' ? 'null' : comillas(`¿Pregunta de la línea ${i + 1}?`)});`)

  const [todo, uno, sinTexto] = personas as [Fila, Fila, Fila]
  const bTodo = busqueda(Number(todo.id), 'TERMINADA', null)
  lineas.forEach((l, i) => resultado(bTodo, Number(todo.id), l, 'TIENE', i))
  const bUno = busqueda(Number(uno.id), 'TERMINADA', null)
  const estados = ['TIENE', 'MENCIONA', 'NO_APARECE', 'NO_APARECE']
  lineas.forEach((l, i) => resultado(bUno, Number(uno.id), l, estados[i]!, i))
  busqueda(Number(sinTexto.id), 'SIN_TEXTO', 'El PDF no tiene texto: puede ser una foto escaneada')

  return { todo: String(todo.nombre), uno: String(uno.nombre), sinTexto: String(sinTexto.nombre) }
}

/** Retira todo lo sembrado: la vacante vuelve a no buscar nada en el CV. */
export function quitarLoBuscado(vacante: number): void {
  sql(`delete from resultado_busqueda_cv where postulacion_id in
         (select id from postulacion where vacante_id = ${vacante});
       delete from busqueda_cv where postulacion_id in
         (select id from postulacion where vacante_id = ${vacante});
       delete from linea_busqueda_cv where vacante_id = ${vacante};`)
}

/** Las líneas vivas de la vacante, tal como están guardadas. */
export const lineasVivas = (vacante: number): string[] =>
  consultar(`select texto from linea_busqueda_cv where vacante_id = ${vacante} and archivada_en is null
             order by orden`).map((f) => String(f.texto))
