/**
 * Los bloques del cuestionario tecnico, dichos como se leen, y lo que contesta
 * el servidor sobre la generacion.
 *
 * La estructura es fija por nivel —DIR 12 · SUP 10 · OPE 8— y la decide el
 * backend (`RecetaCuestionarioTecnico`); aqui solo se traducen los codigos y se
 * agrupan las preguntas para pintarlas en el orden de la receta. El panel no
 * cuenta preguntas ni valida cantidades: eso es la aduana del servidor.
 */

import type { PreguntaDelCuestionario } from '../../api/tipos'

/** Los cuatro valores de `generacion`. Cualquier otro se trata como desconocido. */
export const GENERACION = {
  SIN_PEDIR: 'SIN_PEDIR',
  EN_CURSO: 'EN_CURSO',
  FALLIDA: 'FALLIDA',
  LISTA: 'LISTA',
} as const

interface Bloque {
  nombre: string
  explica: string
}

const BLOQUES: Record<string, Bloque> = {
  EXPERIENCIA: {
    nombre: 'Experiencia y escala',
    explica: 'Qué ha tenido a cargo de verdad y de qué tamaño.',
  },
  RIESGO_1: {
    nombre: 'Riesgo 1 · el que se nota primero',
    explica: 'Experiencia con magnitudes, el procedimiento exacto y cómo lo previene.',
  },
  RIESGO_2: {
    nombre: 'Riesgo 2',
    explica: 'Experiencia con magnitudes y el procedimiento exacto.',
  },
  RIESGO_3: {
    nombre: 'Riesgo 3',
    explica: 'Experiencia con magnitudes y el procedimiento exacto.',
  },
  REQUERIMIENTO: {
    nombre: 'Requerimiento específico',
    explica: 'Lo que tiene que saber o poder hacer sin lo cual no sirve.',
  },
  DILEMA: {
    nombre: 'Dilema del negocio',
    explica: 'Dos virtudes del negocio que chocan: se mira cómo decide, no qué decide.',
  },
  PRESENCIAL: {
    nombre: 'Muestra de trabajo · presencial',
    explica:
      'Nunca se envía al candidato: regalaría el diagnóstico del negocio a todo el que postule. Es para tu entrevista.',
  },
}

const ORDEN = Object.keys(BLOQUES)

export function nombreDelBloque(codigo: string): string {
  return BLOQUES[codigo]?.nombre ?? codigo.replaceAll('_', ' ').toLowerCase()
}

export function explicacionDelBloque(codigo: string): string {
  return BLOQUES[codigo]?.explica ?? ''
}

export interface Grupo {
  bloque: string
  nombre: string
  explica: string
  preguntas: PreguntaDelCuestionario[]
}

/**
 * Las preguntas por bloque, en el orden de la receta y dentro de cada uno por
 * su `orden`. Un bloque que el panel no conozca va al final con su codigo
 * crudo: no se pierde ninguna pregunta por no saber traducirla.
 */
export function agruparPorBloque(preguntas: PreguntaDelCuestionario[]): Grupo[] {
  const porBloque = new Map<string, PreguntaDelCuestionario[]>()
  for (const p of preguntas) {
    const lista = porBloque.get(p.bloque) ?? []
    lista.push(p)
    porBloque.set(p.bloque, lista)
  }
  const codigos = [...ORDEN.filter((c) => porBloque.has(c)), ...[...porBloque.keys()].filter((c) => !ORDEN.includes(c))]
  return codigos.map((bloque) => ({
    bloque,
    nombre: nombreDelBloque(bloque),
    explica: explicacionDelBloque(bloque),
    preguntas: [...(porBloque.get(bloque) ?? [])].sort(
      (a, b) => (a.orden ?? 0) - (b.orden ?? 0),
    ),
  }))
}

/**
 * La lista de la aduana, sacada del mensaje del 400.
 *
 * El backend junta los errores en una sola linea —«El cuestionario no pasa la
 * aduana: e1 · e2 · e3»— y aqui se vuelven a separar para pintarlos como lista.
 * Si el mensaje no tiene esa forma se devuelve entero: mejor una linea larga
 * que perder lo que dijo el servidor.
 */
export const PREFIJO_DE_LA_ADUANA = 'El cuestionario no pasa la aduana: '

export function erroresDeLaAduana(mensaje: string): string[] {
  // Solo se quita el prefijo conocido: los propios errores llevan «: » dentro
  // («T03: sin enunciado») y cortar por el primero se comeria la cabeza de un
  // mensaje que no fuera de la aduana.
  const lista = mensaje.startsWith(PREFIJO_DE_LA_ADUANA)
    ? mensaje.slice(PREFIJO_DE_LA_ADUANA.length)
    : mensaje
  return lista
    .split(' · ')
    .map((e) => e.trim())
    .filter(Boolean)
}
