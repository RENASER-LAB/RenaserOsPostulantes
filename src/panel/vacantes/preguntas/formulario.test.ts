import { describe, expect, it } from 'vitest'
import {
  avisoAlQuitarCriterio,
  avisoAntesDeRecalcular,
  avisoAntesDeRecalificar,
  conOtroTipo,
  desdePregunta,
  nombreDelNivel,
  paraGuardar,
  preguntaNueva,
  puntosDelCriterio,
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
