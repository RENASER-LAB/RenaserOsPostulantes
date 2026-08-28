/**
 * La lista de la aduana: solo se quita el prefijo conocido.
 *
 * Los propios errores llevan «: » dentro («T03: sin enunciado»); cortar por el
 * primer «: » se comia la cabeza de cualquier mensaje que no fuera de la aduana.
 */

import { describe, expect, it } from 'vitest'
import { PREFIJO_DE_LA_ADUANA, agruparPorBloque, erroresDeLaAduana } from './bloques'

describe('erroresDeLaAduana', () => {
  it('parte la lista del backend y deja cada error entero, con sus dos puntos', () => {
    expect(
      erroresDeLaAduana(`${PREFIJO_DE_LA_ADUANA}T03: sin señal de 0 · RIESGO_2: 1 pregunta y el nivel pide 2`),
    ).toEqual(['T03: sin señal de 0', 'RIESGO_2: 1 pregunta y el nivel pide 2'])
  })

  it('un mensaje sin el prefijo se devuelve entero, sin comerse la cabeza', () => {
    expect(erroresDeLaAduana('T01: el enunciado está vacío')).toEqual(['T01: el enunciado está vacío'])
  })
})

describe('agruparPorBloque', () => {
  it('sigue el orden de la receta y no pierde un bloque desconocido', () => {
    const pregunta = (id: number, bloque: string, orden: number) => ({
      id,
      codigo: `T${id}`,
      bloque,
      enunciado: '',
      c3Esperado: null,
      c4Esperado: null,
      senalDeCero: null,
      presencial: false,
      orden,
    })
    const grupos = agruparPorBloque([
      pregunta(3, 'DILEMA', 3),
      pregunta(9, 'RARO', 9),
      pregunta(2, 'EXPERIENCIA', 2),
      pregunta(1, 'EXPERIENCIA', 1),
    ])
    expect(grupos.map((g) => g.bloque)).toEqual(['EXPERIENCIA', 'DILEMA', 'RARO'])
    expect(grupos[0]!.preguntas.map((p) => p.id)).toEqual([1, 2])
    expect(grupos[2]!.nombre).toBe('raro')
  })
})
