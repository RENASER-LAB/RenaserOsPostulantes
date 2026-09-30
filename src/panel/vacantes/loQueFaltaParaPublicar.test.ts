/**
 * Lo que le falta a una vacante para publicarse (QA-PP-06): cada falta con su
 * verbo. Nada de «elegir publicar…».
 */

import { describe, expect, it } from 'vitest'
import { loQueFaltaParaPublicar, type FaltasDeLaVacante } from './loQueFaltaParaPublicar'

const nada: FaltasDeLaVacante = {
  bancoDelNivel: false,
  pruebaDelPuesto: false,
  cuestionarioTecnico: false,
  preguntasPropias: false,
}

describe('lo que falta para publicar', () => {
  it('sin faltas no hay nada que decir', () => {
    expect(loQueFaltaParaPublicar(nada)).toEqual({ aquiAbajo: null, preguntasPropias: false, hayAlgo: false })
  })

  it('lo que se elige, se elige', () => {
    expect(loQueFaltaParaPublicar({ ...nada, pruebaDelPuesto: true }).aquiAbajo).toBe('elegir la prueba del puesto')
    expect(loQueFaltaParaPublicar({ ...nada, bancoDelNivel: true, pruebaDelPuesto: true }).aquiAbajo).toBe(
      'elegir un banco de preguntas publicado de su nivel y la prueba del puesto',
    )
  })

  it('el cuestionario se publica, no se «elige publicar»', () => {
    const falta = loQueFaltaParaPublicar({ ...nada, bancoDelNivel: true, cuestionarioTecnico: true })
    expect(falta.aquiAbajo).toBe('elegir un banco de preguntas publicado de su nivel y publicar su cuestionario técnico')
    expect(falta.aquiAbajo).not.toMatch(/elegir publicar/)
  })

  it('las preguntas propias van aparte: se publican en su editor', () => {
    const solo = loQueFaltaParaPublicar({ ...nada, preguntasPropias: true })
    expect(solo).toEqual({ aquiAbajo: null, preguntasPropias: true, hayAlgo: true })
    const conPrueba = loQueFaltaParaPublicar({ ...nada, preguntasPropias: true, pruebaDelPuesto: true })
    expect(conPrueba.aquiAbajo).toBe('elegir la prueba del puesto')
    expect(conPrueba.preguntasPropias).toBe(true)
  })
})
