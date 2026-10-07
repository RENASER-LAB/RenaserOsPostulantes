import { describe, expect, it } from 'vitest'
import type { TipoDePreguntaPropia } from '../../api/preguntasPropias'
import {
  abiertasYArchivos,
  avisosDeLosPuntos,
  cerradasDelReparto,
  quienLosCalifica,
  textoDelReparto,
  type PreguntaEnEdicion,
  avisoAlQuitarCriterio,
  avisoAntesDeRecalcular,
  avisoAntesDeRecalificar,
  cerradasPorEncima,
  conOtroTipo,
  desdePregunta,
  faltaEnLosPuntosDelCriterio,
  nombreDelNivel,
  paraGuardar,
  preguntaNueva,
  puntosDelCriterio,
  repartoDelCriterio,
  resultadoDelReintento,
  textoDelResumen,
} from './formulario'

describe('el formulario de una pregunta', () => {
  it('al pasar a escala trae cinco niveles; a abierta, ninguno', () => {
    const escala = conOtroTipo(preguntaNueva(null), 'ESCALA')
    expect(escala.opciones).toHaveLength(5)
    expect(escala.opciones.map((o) => o.puntos)).toEqual(['0', '1', '2', '3', '4'])
    expect(conOtroTipo(escala, 'ABIERTA').opciones).toEqual([])
  })

  it('los decimales no se redondean aquí: los rechaza el servidor con su lista', () => {
    const p = { ...preguntaNueva(3), enunciado: ' ¿A? ', puntos: '2.5' }
    expect(paraGuardar(p)).toMatchObject({ enunciado: '¿A?', puntos: 2.5, criterioId: 3 })
  })

  it('en la escala un rótulo vacío viaja nulo, y el número guardado no se enseña como si fuera rótulo', () => {
    const p = desdePregunta({
      id: 1, tipo: 'ESCALA', enunciado: '¿Cuánto?', puntos: 2, criterioId: 1, orden: 1, queDebeTener: null,
      opciones: [
        { id: 3, texto: '2', puntos: 1, orden: 2 },
        { id: 2, texto: 'Nada', puntos: 0, orden: 1 },
        { id: 4, texto: 'Mucho', puntos: 2, orden: 3 },
      ],
    })
    expect(p.opciones.map((o) => o.texto)).toEqual(['Nada', '', 'Mucho'])
    expect(paraGuardar(p).opciones.map((o) => o.texto)).toEqual(['Nada', null, 'Mucho'])
  })
})

describe('cómo se dice', () => {
  it('los puntos de un criterio: «30 pts · sistema 10 + IA 20»', () => {
    expect(puntosDelCriterio({ id: 1, nombre: 'x', queEvalua: null, orden: 1, puntos: 30, puntosSistema: 10, puntosIa: 20, preguntas: [] }))
      .toBe('30 pts · sistema 10 + IA 20')
    expect(puntosDelCriterio({ id: 1, nombre: 'x', queEvalua: null, orden: 1, puntos: 0, puntosSistema: 0, puntosIa: 0, preguntas: [] }))
      .toBe('0 pts')
  })

  it('el estado de las preguntas de la vacante', () => {
    expect(textoDelResumen({ estado: 'SIN_PREGUNTAS', puntos: null, criterios: null, preguntas: null })).toBe('Sin preguntas')
    expect(textoDelResumen({ estado: 'BORRADOR', puntos: 68, criterios: 2, preguntas: 5 })).toBe('Borrador · 68 de 100 puntos')
    expect(textoDelResumen({ estado: 'PUBLICADAS', puntos: 100, criterios: 4, preguntas: 12 })).toBe('Publicadas · 4 criterios · 12 preguntas')
  })
})

describe('los textos con número (QA-PP-06)', () => {
  it('el nivel se nombra para leer, como en el filtro', () => {
    expect(nombreDelNivel('EJECUCION')).toBe('Ejecución')
    expect(nombreDelNivel('supervision')).toBe('Supervisión')
    expect(nombreDelNivel('DIRECCION')).toBe('Dirección')
    expect(nombreDelNivel('OTRO')).toBe('OTRO')
  })

  it('quitar un criterio: una pregunta en singular y sin número; varias, con él', () => {
    expect(avisoAlQuitarCriterio(1)).toBe(
      'Su pregunta queda sin criterio hasta que la muevas, y mientras tanto no se publica.',
    )
    expect(avisoAlQuitarCriterio(3)).toBe(
      'Sus 3 preguntas quedan sin criterio hasta que las muevas, y mientras tanto no se publica.',
    )
  })

  it('recalcular y recalificar: «la persona» con una, «las N personas» con varias', () => {
    expect(avisoAntesDeRecalcular(1)).toBe('Se recalculará la nota de la persona que ya rindió. No se llama a la IA.')
    expect(avisoAntesDeRecalcular(23)).toBe(
      'Se recalcularán las notas de las 23 personas que ya rindieron. No se llama a la IA.',
    )
    expect(avisoAntesDeRecalificar(1)).toMatch(/^Se volverá a calificar a la persona que ya tiene nota\. /)
    expect(avisoAntesDeRecalificar(2)).toMatch(/^Se volverá a calificar a las 2 personas que ya tienen nota\. /)
  })
})

describe('lo que dice «Reintentar» (QA-PP-05)', () => {
  it('con motivo dice el motivo, no que no quedaba nadie', () => {
    expect(resultadoDelReintento({ personas: 0, motivo: 'La IA está apagada.' })).toBe('La IA está apagada.')
  })

  it('encolados y otros que no: las dos cosas', () => {
    expect(resultadoDelReintento({ personas: 2, motivo: '1 persona ya tenía una recalificación en marcha: no se pidió otra.' })).toBe(
      'Se volvió a pedir la recalificación de 2 personas. 1 persona ya tenía una recalificación en marcha: no se pidió otra.',
    )
    expect(resultadoDelReintento({ personas: 1 })).toBe('Se volvió a pedir la recalificación de 1 persona.')
  })

  it('solo sin nadie y sin motivo: no quedaba nadie', () => {
    expect(resultadoDelReintento({ personas: 0, motivo: null })).toBe('No quedó nadie por volver a encolar.')
  })
})

describe('lo que vale un criterio de la prueba (V69)', () => {
  it('se escribe el total: sus cerradas las puntúa el sistema y el resto lo califica alguien', () => {
    expect(repartoDelCriterio(30, 10)).toEqual({ tipo: 'CALIFICADA', cerradas: 10, otros: 20 })
    expect(repartoDelCriterio(25, 0)).toEqual({ tipo: 'CALIFICADA', cerradas: 0, otros: 25 })
  })

  it('si las cerradas lo suman todo no queda nada que calificar; si lo pasan, la falta del servidor', () => {
    expect(repartoDelCriterio(10, 10)).toEqual({ tipo: 'SISTEMA', cerradas: 10 })
    expect(repartoDelCriterio(0, 0)).toEqual({ tipo: 'SISTEMA', cerradas: 0 })
    expect(repartoDelCriterio(5, 10)).toEqual({ tipo: 'POR_ENCIMA', cerradas: 10, total: 5 })
    expect(cerradasPorEncima('Excel', 10, 5)).toBe('Las cerradas de «Excel» suman 10 y el criterio vale 5.')
  })

  it('QA-10: una parte calificada sin quién la califique no se atribuye a la IA ni a una persona', () => {
    // El total se mantiene: si bajan las cerradas de un criterio «todo del sistema», le
    // aparece parte calificada con el calificador vacío, y el servidor lo da como falta.
    const sinCalificador = {
      id: 1, nombre: 'Cálculo', queEvalua: null, orden: 1, puntos: 30, puntosSistema: 25, puntosIa: 0,
      preguntas: [], puntosCalificados: 5, calificador: null, entregables: [],
    }
    const dicho = puntosDelCriterio(sinCalificador)
    expect(dicho).toMatch(/^30 pts/)
    expect(dicho).not.toMatch(/\bIA\b/)
    expect(dicho).not.toMatch(/persona/)
  })

  it('QA-10: lo que no tiene quién la califique se dice «sin asignar»; con quién, como siempre', () => {
    const base = {
      id: 1, nombre: 'Cálculo', queEvalua: null, orden: 1, puntos: 30, puntosSistema: 25, puntosIa: 0,
      preguntas: [], puntosCalificados: 5, entregables: [],
    }
    expect(puntosDelCriterio({ ...base, calificador: null })).toBe('30 pts · sistema 25 + 5 sin asignar')
    expect(puntosDelCriterio({ ...base, calificador: undefined })).toBe('30 pts · sistema 25 + 5 sin asignar')
    expect(puntosDelCriterio({ ...base, calificador: 'IA' })).toBe('30 pts · sistema 25 + IA 5')
    expect(puntosDelCriterio({ ...base, calificador: 'PERSONA' })).toBe('30 pts · sistema 25 + persona 5')
    // Sin parte calificada no hay nada que asignar.
    expect(puntosDelCriterio({ ...base, puntos: 25, puntosCalificados: 0, calificador: null })).toBe('25 pts · sistema 25')
  })

  it('los puntos del criterio: un entero de 0 a 100, o se dice qué está mal con las palabras del servidor', () => {
    expect(faltaEnLosPuntosDelCriterio('30')).toBeNull()
    expect(faltaEnLosPuntosDelCriterio('0')).toBeNull()
    expect(faltaEnLosPuntosDelCriterio('100')).toBeNull()
    expect(faltaEnLosPuntosDelCriterio('25.5')).toBe('Los puntos del criterio tienen que ser un número entero, sin decimales.')
    expect(faltaEnLosPuntosDelCriterio('-5')).toBe('Los puntos del criterio van de 0 a 100.')
    expect(faltaEnLosPuntosDelCriterio('150')).toBe('Los puntos del criterio van de 0 a 100.')
    expect(faltaEnLosPuntosDelCriterio(' ')).toBe('Faltan los puntos del criterio: lo que vale entero, cerradas incluidas.')
  })

  it('el reparto se escribe como reparto, sin dar por hecha la IA (AC-01, AC-03, AC-04)', () => {
    expect(cerradasDelReparto(20)).toBe('Cerradas: 20 pts')
    expect(abiertasYArchivos(20)).toBe('Abiertas y archivos: 20 pts')
    expect(textoDelReparto(60, 40, 'IA')).toBe('Cerradas: 60 pts · Abiertas y archivos: 40 pts, los califica la IA')
    expect(textoDelReparto(60, 40, 'PERSONA')).toBe('Cerradas: 60 pts · Abiertas y archivos: 40 pts, los califica una persona')
    expect(textoDelReparto(0, 20, null)).toBe('Cerradas: 0 pts · Abiertas y archivos: 20 pts, falta decir quién los califica')
    expect(quienLosCalifica(undefined)).toBe('falta decir quién los califica')
  })
})

describe('los puntos de una cerrada, en vivo (AC-06, AC-07)', () => {
  const cerrada = (tipo: TipoDePreguntaPropia, puntos: string, opciones: string[]): PreguntaEnEdicion => ({
    ...preguntaNueva(5),
    tipo,
    enunciado: '¿Cuál?',
    puntos,
    opciones: opciones.map((p, i) => ({ texto: `Opción ${i + 1}`, puntos: p })),
  })

  it('opción única: negativos, por encima de la pregunta y ninguna que la dé entera, con las palabras del servidor', () => {
    expect(avisosDeLosPuntos(cerrada('OPCION_UNICA', '5', ['5', '0']))).toEqual([])
    expect(avisosDeLosPuntos(cerrada('OPCION_UNICA', '5', ['10', '0']))).toEqual([
      'Ninguna opción puede pasar de los 5 puntos de la pregunta.',
      'Alguna opción tiene que dar los 5 puntos de la pregunta.',
    ])
    expect(avisosDeLosPuntos(cerrada('OPCION_UNICA', '5', ['5', '-1']))).toEqual(['Ninguna opción puede tener puntos negativos.'])
  })

  it('escala: «ningún nivel» y «algún nivel»', () => {
    expect(avisosDeLosPuntos(cerrada('ESCALA', '4', ['-1', '2', '6']))).toEqual([
      'Ningún nivel puede tener puntos negativos.',
      'Ningún nivel puede pasar de los 4 puntos de la pregunta.',
      'Algún nivel tiene que dar los 4 puntos de la pregunta.',
    ])
  })

  it('opción múltiple: cada opción entre −N y N, y las buenas tienen que llegar a sus puntos', () => {
    expect(avisosDeLosPuntos(cerrada('OPCION_MULTIPLE', '10', ['6', '0']))).toEqual([
      'Marcando todas las opciones buenas no se llega a sus 10 puntos.',
    ])
    expect(avisosDeLosPuntos(cerrada('OPCION_MULTIPLE', '10', ['12', '-11']))).toEqual([
      'Cada opción tiene que valer entre −10 y 10.',
    ])
    expect(avisosDeLosPuntos(cerrada('OPCION_MULTIPLE', '10', ['6', '4', '-3']))).toEqual([])
  })

  it('con los puntos de la pregunta o de alguna opción sin escribir no avisa, como el servidor; ni en una abierta', () => {
    expect(avisosDeLosPuntos(cerrada('OPCION_UNICA', '', ['10', '0']))).toEqual([])
    expect(avisosDeLosPuntos(cerrada('OPCION_UNICA', '5', ['10', ' ']))).toEqual([])
    expect(avisosDeLosPuntos(cerrada('OPCION_UNICA', '5', ['10', 'x']))).toEqual([])
    expect(avisosDeLosPuntos(cerrada('OPCION_UNICA', '5', []))).toEqual([])
    expect(avisosDeLosPuntos({ ...preguntaNueva(5), puntos: '5' })).toEqual([])
  })
})
