/**
 * La prueba técnica escrita en el editor (V67): lo que se calcula sin pintar.
 *
 *   - El estado de la prueba en el bloque de la vacante (AC-01, AC-06).
 *   - La cabecera de un criterio mixto: «30 pts · sistema 10 + IA 20» (AC-05).
 *   - Una abierta de la prueba no lleva puntos (AC-05).
 *   - Las columnas del ranking por id, «pendiente» y en blanco (AC-15, AC-22).
 *   - Publicar la vacante pide la prueba publicada (AC-03).
 *   - El portal dice qué preguntas faltan: «la 3 y la 7» (AC-10).
 */

import { describe, expect, it } from 'vitest'
import type { FilaRanking, NotaCriterio } from '../../api/tipos'
import type { CriterioDeLaVersion } from '../../api/preguntasPropias'
import { cualesFaltan } from '../../../paginas/prueba/Prueba'
import { loQueFaltaParaPublicar } from '../loQueFaltaParaPublicar'
import { columnasDelRanking, criteriosDeLaTanda, notaDelCriterio, notaEscrita } from '../ranking'
import { faltaEvidente, paraGuardar, puntosDelCriterio, textoDeLaPrueba, type PreguntaEnEdicion } from './formulario'

const criterio = (parte: Partial<CriterioDeLaVersion>): CriterioDeLaVersion => ({
  id: 1,
  nombre: 'Conocimiento contable',
  queEvalua: null,
  orden: 1,
  puntos: 30,
  puntosSistema: 10,
  puntosIa: 0,
  preguntas: [],
  puntosCalificados: 20,
  calificador: 'IA',
  entregables: [],
  ...parte,
})

describe('el estado de la prueba en la vacante', () => {
  it('sin prueba, en borrador, publicada y como cuestionario', () => {
    expect(textoDeLaPrueba(null)).toBe('Sin prueba')
    expect(
      textoDeLaPrueba({ estado: 'SIN_PRUEBA', puntos: null, criterios: null, preguntas: null }),
    ).toBe('Sin prueba')
    expect(
      textoDeLaPrueba({ estado: 'BORRADOR', puntos: 70, criterios: 3, preguntas: 8, entregables: 2 }),
    ).toBe('Borrador · 70 de 100 puntos · 2 entregables')
    expect(
      textoDeLaPrueba({
        estado: 'PUBLICADA',
        puntos: 100,
        criterios: 5,
        preguntas: 9,
        entregables: 2,
        minutos: 90,
        cuestionario: false,
      }),
    ).toBe('Publicada · 5 criterios · 2 entregables · 90 min')
    expect(
      textoDeLaPrueba({
        estado: 'PUBLICADA',
        puntos: 100,
        criterios: 3,
        preguntas: 12,
        entregables: 0,
        minutos: 30,
        cuestionario: true,
      }),
    ).toBe('Publicada · cuestionario · 12 preguntas · 30 min')
    expect(
      textoDeLaPrueba({
        estado: 'PUBLICADA',
        puntos: 100,
        criterios: 2,
        preguntas: 3,
        entregables: 1,
        dias: 3,
        cuestionario: false,
      }),
    ).toBe('Publicada · 2 criterios · 1 entregable · 3 días')
  })
})

describe('la parte calificada de un criterio (AC-05)', () => {
  it('la cabecera suma lo del sistema y lo calificado, y dice quién lo califica', () => {
    expect(puntosDelCriterio(criterio({}))).toBe('30 pts · sistema 10 + IA 20')
    expect(puntosDelCriterio(criterio({ calificador: 'PERSONA' }))).toBe('30 pts · sistema 10 + persona 20')
    expect(puntosDelCriterio(criterio({ puntos: 20, puntosSistema: 0, calificador: 'PERSONA' }))).toBe(
      '20 pts · persona 20',
    )
    expect(puntosDelCriterio(criterio({ puntos: 10, puntosCalificados: 0, calificador: null }))).toBe(
      '10 pts · sistema 10',
    )
  })

  it('una abierta de la prueba no lleva puntos: no se piden y se manda 0', () => {
    const p: PreguntaEnEdicion = {
      tipo: 'ABIERTA',
      enunciado: '¿Cómo hallaste el descuadre?',
      puntos: '',
      criterioId: 1,
      queDebeTener: 'La cuenta y el monto',
      opciones: [],
    }
    expect(faltaEvidente(p, true)).toBeNull()
    expect(paraGuardar(p, true).puntos).toBe(0)
    // En las preguntas propias del banco sigue pidiéndolos.
    expect(faltaEvidente(p)).toBe('Faltan los puntos.')
  })
})

const nota = (criterio: string, parte: Partial<NotaCriterio> = {}): NotaCriterio => ({
  criterio,
  codigo: null,
  puntaje: 8,
  maximo: 10,
  peso: 10,
  explicacion: null,
  origen: null,
  confianza: null,
  motivoAjuste: null,
  ...parte,
})

const fila = (notas: NotaCriterio[]): FilaRanking =>
  ({ postulacionId: Math.random(), notasCriterio: notas }) as unknown as FilaRanking

describe('las columnas del ranking por criterio (AC-22, AC-15)', () => {
  it('dos «Comunicación» con distinto id son dos columnas, y cada celda sale de la suya', () => {
    const a = fila([nota('Comunicación', { clave: 'prueba:11', puntaje: 15, maximo: 20 })])
    const b = fila([nota('Comunicación', { clave: 'prueba:12', puntaje: 4, maximo: 10 })])
    const criterios = criteriosDeLaTanda([a, b])
    expect(criterios.map((c) => c.clave)).toEqual(['prueba:11', 'prueba:12'])
    expect(notaDelCriterio(a, 'prueba:12')).toBeNull()
    expect(notaEscrita(notaDelCriterio(b, 'prueba:12'))).toBe('4/10')
    const claves = columnasDelRanking('PRUEBA_PUESTO', undefined, criterios).map((c) => c.clave)
    expect(claves).toContain('criterio:prueba:11')
    expect(claves).toContain('criterio:prueba:12')
  })

  it('sin clave —la rúbrica de antes y el currículum— la columna sigue siendo el nombre', () => {
    const criterios = criteriosDeLaTanda([fila([nota('Resultados')]), fila([nota('Resultados')])])
    expect(criterios).toHaveLength(1)
    expect(columnasDelRanking('PERFIL_INTEGRAL', undefined, criterios).map((c) => c.clave)).toContain(
      'criterio:Resultados',
    )
  })

  it('«pendiente» si le falta su parte calificada, y en blanco si no le toca', () => {
    expect(notaEscrita(nota('Excel', { puntaje: null, estado: 'PENDIENTE' }))).toBe('pendiente')
    expect(notaEscrita(nota('Excel', { puntaje: null, estado: 'EN_BLANCO' }))).toBe('')
    expect(notaEscrita(nota('Excel', { puntaje: null }))).toBe('—')
  })
})

describe('publicar la vacante pide su prueba publicada (AC-03)', () => {
  it('la prueba técnica sin publicar es lo que falta, y viaja solo cuando falta', () => {
    const base = {
      bancoDelNivel: false,
      preguntasPropias: false,
      cuestionarioTecnico: false,
      pruebaDelPuesto: false,
    }
    expect(loQueFaltaParaPublicar({ ...base, pruebaTecnica: true })).toEqual({
      aquiAbajo: null,
      preguntasPropias: false,
      pruebaTecnica: true,
      hayAlgo: true,
    })
    expect(loQueFaltaParaPublicar({ ...base, pruebaTecnica: false }).hayAlgo).toBe(false)
  })
})

describe('el portal dice qué preguntas faltan (AC-10)', () => {
  it('«la 3», «la 3 y la 7», «la 2, la 3 y la 7»', () => {
    expect(cualesFaltan([3])).toBe('la 3')
    expect(cualesFaltan([3, 7])).toBe('la 3 y la 7')
    expect(cualesFaltan([2, 3, 7])).toBe('la 2, la 3 y la 7')
  })
})
