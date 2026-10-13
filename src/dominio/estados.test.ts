/**
 * Qué le toca al candidato cuando su prueba del editor quedó sin completar (V67, AC-11).
 *
 * El estado es el mismo que cuando le toca rendirla —nadie cambia de etapa solo—, así que
 * lo que lo separa es el dato del resumen. Sin él, el portal le seguía ofreciendo «Abrir
 * prueba» y le contaba una cosa pendiente que ya no podía hacer.
 */

import { describe, expect, it } from 'vitest'
import {
  EVALUACION_ENTREGADA_A_LA_ESPERA,
  leTocaAlCandidato,
  leTocaAlCandidatoEn,
  momentoDeLaEtapa,
  quedoSinCompletar,
} from './estados'

describe('la prueba que quedó sin completar', () => {
  it('ya no le toca: sin botón, esperando al equipo, y con la frase de la prueba', () => {
    const momento = momentoDeLaEtapa('PRUEBA_TURNO_CANDIDATO', 'PRUEBA_PROPIA', true)

    expect(momento.titulo).toBe('Tu tiempo terminó y la prueba quedó sin completar')
    expect(momento.accion).toBeNull()
    expect(momento.esperaA).toBe('EQUIPO')
    expect(momento.etapa).toBe('PRUEBA')
    expect(leTocaAlCandidatoEn({ estado: 'PRUEBA_TURNO_CANDIDATO', pruebaSinCompletar: true })).toBe(false)
  })

  it('mientras la rinde, sigue siendo suya: «Abrir prueba»', () => {
    const momento = momentoDeLaEtapa('PRUEBA_TURNO_CANDIDATO', 'PRUEBA_PROPIA', false)

    expect(momento.titulo).toBe('Prueba del puesto habilitada')
    expect(momento.accion?.etiqueta).toBe('Abrir prueba')
    expect(leTocaAlCandidatoEn({ estado: 'PRUEBA_TURNO_CANDIDATO', pruebaSinCompletar: false })).toBe(true)
  })

  it('sin el dato (un backend anterior) se trata como hasta ahora', () => {
    expect(momentoDeLaEtapa('PRUEBA_TURNO_CANDIDATO', null).accion?.etiqueta).toBe('Abrir prueba')
    expect(leTocaAlCandidatoEn({ estado: 'PRUEBA_TURNO_CANDIDATO' })).toBe(true)
    expect(leTocaAlCandidatoEn({ estado: 'PRUEBA_TURNO_CANDIDATO', pruebaSinCompletar: null })).toBe(true)
  })

  it('fuera de la etapa de la prueba, el dato no cambia nada', () => {
    // El equipo ya cerró su proceso: lo dice el estado final, no la prueba.
    expect(quedoSinCompletar({ estado: 'NO_CONTINUA', pruebaSinCompletar: true })).toBe(false)
    expect(leTocaAlCandidatoEn({ estado: 'PERFIL_TURNO_CANDIDATO', pruebaSinCompletar: true })).toBe(
      leTocaAlCandidato('PERFIL_TURNO_CANDIDATO'),
    )
    expect(momentoDeLaEtapa('NO_CONTINUA', 'PRUEBA_PROPIA', true).titulo).not.toContain('sin completar')
  })
})

describe('al entregar el banco, sin prueba al instante (V72)', () => {
  it('promete avisar, no la prueba: el pase espera la nota y exige la mínima', () => {
    // La V70 decía «cuando te toque la prueba»; desde la V72 puede no tocarle sola —si no
    // llega a la mínima, decide una persona—, así que lo honesto es avisar de novedades.
    expect(EVALUACION_ENTREGADA_A_LA_ESPERA).toBe(
      'Evaluación entregada. Te avisaremos por correo y en la campana cuando haya novedades.',
    )
    expect(EVALUACION_ENTREGADA_A_LA_ESPERA).not.toMatch(/prueba/)
  })
})
