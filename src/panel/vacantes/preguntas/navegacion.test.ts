/**
 * Adónde lleva cada falta (V68): los avisos del servidor, leídos tal cual.
 */

import { describe, expect, it } from 'vitest'
import type { VersionDePreguntas } from '../../api/preguntasPropias'
import { destinoDelAviso, faltasPorCriterio, numerosDePreguntas } from './navegacion'

const pregunta = (id: number, criterioId: number | null) => ({
  id,
  tipo: 'ABIERTA' as const,
  enunciado: `P${id}`,
  puntos: 0,
  criterioId,
  orden: id,
  queDebeTener: null,
  opciones: [],
})

const version: VersionDePreguntas = {
  id: 1,
  estado: 'BORRADOR',
  guiaCalificacion: null,
  minutosObjetivo: null,
  versionGuia: 1,
  total: 40,
  cuantosCriterios: 2,
  cuantasPreguntas: 3,
  criterios: [
    { id: 5, nombre: 'Excel', queEvalua: null, orden: 1, puntos: 20, puntosSistema: 0, puntosIa: 20, preguntas: [pregunta(10, 5)] },
    { id: 6, nombre: 'Comunicación', queEvalua: null, orden: 2, puntos: 20, puntosSistema: 0, puntosIa: 20, preguntas: [pregunta(11, 6)] },
  ],
  sinCriterio: [pregunta(12, null)],
  avisos: [],
  prueba: {
    enunciado: null,
    consigna: null,
    materiales: null,
    herramientasPermitidas: null,
    modalidad: null,
    duracionMinutos: null,
    plazoDias: null,
    cuestionario: false,
    entregables: [
      { id: 30, nombre: 'Flujo.xlsx', detalle: null, formato: 'ARCHIVO', obligatorio: true, queDebeTener: null, orden: 1, criterios: [6], alcance: 'PREGUNTA', preguntaId: 11, cubre: [] },
      { id: 31, nombre: 'Informe', detalle: null, formato: 'ARCHIVO', obligatorio: true, queDebeTener: null, orden: 2, criterios: [], alcance: 'PREGUNTAS', preguntaId: null, cubre: [] },
    ],
  },
}

describe('adónde lleva cada falta', () => {
  it('los puntos y lo que no se reconoce, a los criterios', () => {
    expect(destinoDelAviso('Los puntos suman 40 de 100: faltan 60.', version)).toEqual({ tipo: 'CRITERIOS' })
    expect(destinoDelAviso('Algo que nadie esperaba.', version)).toEqual({ tipo: 'CRITERIOS' })
  })

  it('el tiempo y la fecha, a la configuración con su campo', () => {
    expect(destinoDelAviso('Falta el tiempo: elige «Cronometrada», con sus minutos, o «Sin cronómetro».', version)).toEqual({
      tipo: 'CONFIGURACION',
      campo: 'tiempo',
    })
    expect(destinoDelAviso('Faltan los minutos: una prueba cronometrada dura al menos 5 minutos.', version)).toEqual({
      tipo: 'CONFIGURACION',
      campo: 'tiempo',
    })
    expect(destinoDelAviso('Falta la fecha límite para dar la prueba.', version)).toEqual({ tipo: 'CONFIGURACION', campo: 'fecha' })
    expect(destinoDelAviso('La fecha límite para dar la prueba ya pasó: pon una futura.', version)).toEqual({
      tipo: 'CONFIGURACION',
      campo: 'fecha',
    })
  })

  it('un criterio, a ese criterio; una pregunta, a su criterio y a ella (numeradas como el servidor)', () => {
    expect(destinoDelAviso('El criterio «Comunicación» está vacío: no tiene cerradas ni parte calificada.', version)).toEqual({
      tipo: 'CRITERIO',
      criterioId: 6,
    })
    // V69: las cerradas que pasan de lo que vale el criterio también son de él
    expect(destinoDelAviso('Las cerradas de «Excel» suman 40 y el criterio vale 30.', version)).toEqual({
      tipo: 'CRITERIO',
      criterioId: 5,
    })
    expect(destinoDelAviso('La pregunta 2 («P11»): falta el enunciado.', version)).toEqual({
      tipo: 'PREGUNTA',
      preguntaId: 11,
      criterioId: 6,
    })
    expect(destinoDelAviso('La pregunta 3: no está en ningún criterio.', version)).toEqual({
      tipo: 'PREGUNTA',
      preguntaId: 12,
      criterioId: null,
    })
    expect([...numerosDePreguntas(version).entries()]).toEqual([[10, 1], [11, 2], [12, 3]])
  })

  it('QA-10: la falta de quién califica lleva al lápiz de su criterio, con el cursor en «Quién califica»', () => {
    const falta = 'El criterio «Excel»: falta decir quién califica su parte calificada, la IA o una persona.'
    const destino = destinoDelAviso(falta, version)
    expect(destino).toEqual({ tipo: 'CRITERIO', criterioId: 5, campo: 'calificador' })
    // Sigue siendo una falta de ese criterio: su punto ámbar.
    expect([...faltasPorCriterio({ ...version, avisos: [falta] }).entries()]).toEqual([[5, [falta]]])
    // Las demás del criterio no abren el lápiz.
    expect(destinoDelAviso('El criterio «Excel»: su parte calificada no mira nada. Agrégale una abierta o pide un archivo en una de sus preguntas.', version)).toEqual({
      tipo: 'CRITERIO',
      criterioId: 5,
    })
  })

  it('el archivo de una pregunta, a su pregunta; un general, a los entregables', () => {
    expect(destinoDelAviso('«Flujo.xlsx»: nadie lo califica. El criterio de su pregunta no tiene parte calificada: dale puntos.', version)).toEqual({
      tipo: 'PREGUNTA',
      preguntaId: 11,
      criterioId: 6,
    })
    expect(destinoDelAviso('«Informe» no cubre ninguna pregunta: elige «Toda la prueba» o las preguntas que reúne.', version)).toEqual({
      tipo: 'ENTREGABLE',
      entregableId: 31,
    })
  })

  it('las faltas de cada criterio, para su punto ámbar', () => {
    const conAvisos = {
      ...version,
      avisos: [
        'Los puntos suman 40 de 100: faltan 60.',
        'El criterio «Excel» está vacío: no tiene cerradas ni parte calificada.',
        '«Flujo.xlsx»: nadie lo califica. El criterio de su pregunta no tiene parte calificada: dale puntos.',
      ],
    }
    const faltas = faltasPorCriterio(conAvisos)
    expect(faltas.get(5)).toHaveLength(1)
    expect(faltas.get(6)).toEqual([conAvisos.avisos[2]])
    expect(faltasPorCriterio(null).size).toBe(0)
  })
})
