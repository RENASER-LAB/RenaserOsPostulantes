/**
 * Adónde lleva cada falta (V68): los avisos del servidor, leídos tal cual.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { VersionDePreguntas } from '../../api/preguntasPropias'
import {
  campoDeLaFalta,
  destinoDelAviso,
  faltaDelTotal,
  faltasPorCriterio,
  faltasPorEntregable,
  faltasPorPregunta,
  faltasPropiasPorCriterio,
  faltasSinSitio,
  numerosDePreguntas,
  bajarHasta,
  paradasDeLasFaltas,
  RESALTE_MS,
  siguienteParada,
  sinElNombreDeLaPregunta,
  useIrALasFaltas,
} from './navegacion'

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
    expect(destinoDelAviso('El criterio «Excel» vale 20 y sus cerradas suman 5: nadie puede calificar los otros 15. Baja el total a 5, sube sus cerradas o agrégale una abierta o un archivo.', version)).toEqual({
      tipo: 'CRITERIO',
      criterioId: 5,
    })
  })

  it('AC-08/AC-09: «nadie puede calificar…» lleva a su criterio, con o sin cerradas, y no se toma por un entregable', () => {
    // Un entregable que se llamara como el criterio no la captura: empieza por «El criterio».
    const conEntregableExcel = {
      ...version,
      prueba: {
        ...version.prueba!,
        entregables: [{ ...version.prueba!.entregables[1]!, nombre: 'Excel' }],
      },
    }
    for (const falta of [
      'El criterio «Excel» vale 20 y sus cerradas suman 5: nadie puede calificar los otros 15. Baja el total a 5, sube sus cerradas o agrégale una abierta o un archivo.',
      'El criterio «Excel» vale 20 y no tiene nada que calificar: agrégale una abierta, un archivo o cerradas que sumen 20.',
    ]) {
      expect(destinoDelAviso(falta, conEntregableExcel)).toEqual({ tipo: 'CRITERIO', criterioId: 5 })
      expect([...faltasPorCriterio({ ...version, avisos: [falta] }).entries()]).toEqual([[5, [falta]]])
      expect(faltasPorPregunta({ ...version, avisos: [falta] }).size).toBe(0)
    }
  })

  it('AC-05: las faltas de cada pregunta, sin «La pregunta N (…): », con mayúscula y en el orden del servidor', () => {
    const conFaltas = {
      ...version,
      avisos: [
        'Los puntos suman 40 de 100: faltan 60.',
        'La pregunta 1 («P10»): ninguna opción puede pasar de los 5 puntos de la pregunta.',
        'La pregunta 1 («P10»): alguna opción tiene que dar los 5 puntos de la pregunta.',
        'La pregunta 3 («P12»): no está en ningún criterio.',
        // El archivo de una pregunta es del entregable: no se escribe bajo la tarjeta.
        '«Flujo.xlsx»: nadie lo califica. El criterio de su pregunta no tiene parte calificada: dale puntos.',
        'La pregunta 9 («P99»): no existe.',
      ],
    }
    expect([...faltasPorPregunta(conFaltas).entries()]).toEqual([
      [10, ['Ninguna opción puede pasar de los 5 puntos de la pregunta.', 'Alguna opción tiene que dar los 5 puntos de la pregunta.']],
      [12, ['No está en ningún criterio.']],
    ])
    expect(faltasPorPregunta(null).size).toBe(0)
  })

  it('el nombre que se quita es el del servidor: sin enunciado, con él corto o cortado a 39 letras y «…»', () => {
    expect(sinElNombreDeLaPregunta('La pregunta 2: falta el enunciado.', 2, '  ')).toBe('Falta el enunciado.')
    expect(sinElNombreDeLaPregunta('La pregunta 2 («¿Qué?»): faltan sus puntos.', 2, ' ¿Qué? ')).toBe('Faltan sus puntos.')
    const largo = '¿Qué libro registra primero una venta al crédito?'
    expect(
      sinElNombreDeLaPregunta(
        'La pregunta 4 («¿Qué libro registra primero una venta a…»): los puntos de la opción 2 tienen que ser enteros.',
        4,
        largo,
      ),
    ).toBe('Los puntos de la opción 2 tienen que ser enteros.')
    // Si el enunciado cambió desde que se escribió la falta, se quita igual.
    expect(sinElNombreDeLaPregunta('La pregunta 4 («Otro texto»): no está en ningún criterio.', 4, largo)).toBe(
      'No está en ningún criterio.',
    )
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

describe('cada falta en su sitio, sin lista en la cabecera', () => {
  const DEL_CRITERIO = 'El criterio «Excel» está vacío: no tiene cerradas ni parte calificada.'
  const DEL_ARCHIVO = '«Flujo.xlsx»: nadie lo califica. El criterio de su pregunta no tiene parte calificada: dale puntos.'
  const DEL_GENERAL = '«Informe» no cubre ninguna pregunta: elige «Toda la prueba» o las preguntas que reúne.'
  const SIN_SITIO = 'Todavía no hay ningún criterio: lo que se califica va dentro de un criterio.'
  const TOTAL = 'Los puntos suman 40 de 100: faltan 60.'
  const conAvisos = (avisos: string[]): VersionDePreguntas => ({ ...version, avisos })

  it('las del propio criterio, sin las de sus preguntas; las de cada entregable, por su id', () => {
    const v = conAvisos([TOTAL, DEL_CRITERIO, 'La pregunta 1: falta el enunciado.', DEL_ARCHIVO, DEL_GENERAL])
    expect([...faltasPropiasPorCriterio(v)]).toEqual([[5, [DEL_CRITERIO]]])
    expect([...faltasPorEntregable(v)]).toEqual([
      [30, [DEL_ARCHIVO]],
      [31, [DEL_GENERAL]],
    ])
    expect(faltasPorEntregable(null).size).toBe(0)
  })

  it('las que no tienen sitio van arriba de los criterios; la del total, no: va con el balance', () => {
    expect(faltasSinSitio([TOTAL, SIN_SITIO, DEL_CRITERIO, 'Falta el tiempo: elige.', 'Algo que nadie esperaba.'], version)).toEqual([
      SIN_SITIO,
      'Algo que nadie esperaba.',
    ])
  })

  it('el campo de la configuración de cada falta', () => {
    expect(campoDeLaFalta('La fecha límite para dar la prueba ya pasó: pon una futura.')).toBe('fecha')
    expect(campoDeLaFalta('Faltan los minutos: una prueba cronometrada dura al menos 5 minutos.')).toBe('tiempo')
    expect(campoDeLaFalta(TOTAL)).toBeNull()
  })

  it('la falta del total: la del servidor; si no la da, la misma cuenta; en 100 o sin faltas, ninguna', () => {
    expect(faltaDelTotal([SIN_SITIO, TOTAL], 40)).toBe(TOTAL)
    expect(faltaDelTotal(['Todavía no hay nada que rendir.'], 0)).toBe('Los puntos suman 0 de 100: faltan 100.')
    expect(faltaDelTotal(['Todavía no hay nada que rendir.'], 185)).toBe('Los puntos suman 185 de 100: sobran 85.')
    expect(faltaDelTotal([DEL_CRITERIO], 100)).toBeNull()
    expect(faltaDelTotal([], 40)).toBeNull()
  })

  it('las paradas de la pastilla: una por sitio, en el orden de la página y no en el del servidor', () => {
    const v = conAvisos([
      DEL_GENERAL,
      'La pregunta 3 («P12»): no está en ningún criterio.',
      DEL_ARCHIVO,
      'Falta la fecha límite para dar la prueba.',
      'La pregunta 2 («P11»): falta el enunciado.',
      DEL_CRITERIO,
      TOTAL,
      SIN_SITIO,
      'Falta el tiempo: elige «Cronometrada», con sus minutos, o «Sin cronómetro».',
    ])
    expect(paradasDeLasFaltas(v.avisos, v).map((p) => p.clave)).toEqual([
      'criterios-y-preguntas',
      'configuracion-tiempo',
      'configuracion-fecha',
      'criterio-5',
      'pregunta-11',
      'pregunta-12',
      'entregable-31',
    ])
  })

  it('la siguiente parada sigue a la última visitada; tras la última, la primera; arreglada la visitada, la de después', () => {
    const v = conAvisos([DEL_GENERAL, DEL_CRITERIO, TOTAL])
    const paradas = paradasDeLasFaltas(v.avisos, v)
    const siguiente = (ultima: string | null) => siguienteParada(paradas, ultima, v)?.clave
    expect(siguiente(null)).toBe('criterios-y-preguntas')
    expect(siguiente('criterios-y-preguntas')).toBe('criterio-5')
    expect(siguiente('criterio-5')).toBe('entregable-31')
    expect(siguiente('entregable-31')).toBe('criterios-y-preguntas')
    // «Comunicación» ya no tiene falta: se sigue por lo que venía después de su sitio.
    expect(siguiente('criterio-6')).toBe('entregable-31')
    // Un sitio que ya no existe: se vuelve a empezar.
    expect(siguiente('pregunta-99')).toBe('criterios-y-preguntas')
    expect(siguienteParada([], null, v)).toBeUndefined()
  })

  it('un sitio que no está en la página va al final', () => {
    const huerfano = {
      ...version,
      prueba: {
        ...version.prueba!,
        entregables: [{ ...version.prueba!.entregables[0]!, preguntaId: 99 }],
      },
    }
    const paradas = paradasDeLasFaltas([DEL_ARCHIVO, DEL_CRITERIO], huerfano)
    expect(paradas.map((p) => p.clave)).toEqual(['criterio-5', 'pregunta-99'])
  })
})

describe('ir a una falta', () => {
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('baja hasta su sitio, le da el foco y lo resalta un momento', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'setTimeout'] })
    document.body.innerHTML = '<section id="criterio-5" tabindex="-1"></section>'
    const sitio = document.getElementById('criterio-5')!
    bajarHasta({ tipo: 'CRITERIO', criterioId: 5 })
    vi.advanceTimersToNextFrame()
    vi.advanceTimersToNextFrame()
    expect(document.activeElement).toBe(sitio)
    expect(sitio.hasAttribute('data-resaltado')).toBe(true)
    vi.advanceTimersByTime(RESALTE_MS)
    expect(sitio.hasAttribute('data-resaltado')).toBe(false)
  })

  it('sin faltas, la pastilla y «Publicar» no llevan a ninguna parte', () => {
    const alIr = vi.fn()
    const { result } = renderHook(() => useIrALasFaltas([], version, alIr))
    expect(result.current.cuantas).toBe(0)
    act(() => result.current.siguiente())
    act(() => result.current.primera())
    expect(alIr).not.toHaveBeenCalled()
  })

  it('con faltas, «Publicar» va siempre a la primera y la pastilla sigue desde la última visitada', () => {
    const alIr = vi.fn()
    const avisos = ['El criterio «Comunicación» está vacío: no tiene cerradas ni parte calificada.', 'Los puntos suman 40 de 100: faltan 60.']
    const { result } = renderHook(() => useIrALasFaltas(avisos, { ...version, avisos }, alIr))
    act(() => result.current.siguiente())
    act(() => result.current.siguiente())
    act(() => result.current.primera())
    act(() => result.current.siguiente())
    expect(alIr.mock.calls.map(([d]) => d)).toEqual([
      { tipo: 'CRITERIOS' },
      { tipo: 'CRITERIO', criterioId: 6 },
      { tipo: 'CRITERIOS' },
      { tipo: 'CRITERIO', criterioId: 6 },
    ])
  })
})
