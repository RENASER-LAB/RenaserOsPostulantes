/**
 * El guion de la ficha: lo que viaja al servidor y lo que falta.
 *
 * Lo que compila perfectamente estando mal:
 *   1. **Mandar 22 campos.** El PUT es un reemplazo completo: el que falte se
 *      borra en el servidor sin que nadie lo vea. Se cuentan.
 *   2. **Mandar «» donde el backend espera nulo.** Un texto vacio no es una
 *      respuesta, y «0 personas» no es lo mismo que no haber dicho cuantas.
 *   3. **Las familias fuera de orden.** El backend valida `F[1-7](,F[1-7])*` y
 *      guarda la cadena tal cual; `F4,F1` y `F1,F4` serian dos fichas distintas
 *      para la misma respuesta.
 */

import { describe, expect, it } from 'vitest'
import type { FichaDelPuesto } from '../../api/tipos'
import { BORRADOR_VACIO, CAMPOS, aCuerpo, conFamilia, deFicha, queLeFalta, tieneFamilia } from './guion'

describe('lo que viaja en el PUT', () => {
  it('lleva los 22 campos del record, siempre', () => {
    const cuerpo = aCuerpo(BORRADOR_VACIO)
    expect(Object.keys(cuerpo)).toHaveLength(22)
    expect(CAMPOS).toHaveLength(22)
    for (const campo of CAMPOS) expect(cuerpo).toHaveProperty(campo)
  })

  it('un texto vacío viaja como nulo, y uno con espacios también', () => {
    const cuerpo = aCuerpo({ ...BORRADOR_VACIO, q1Resultado: '   ', riesgo1: ' caja ' })
    expect(cuerpo.q1Resultado).toBeNull()
    expect(cuerpo.riesgo1).toBe('caja')
  })

  it('las cifras van como número, y sin cifra es nulo, no cero', () => {
    expect(aCuerpo({ ...BORRADOR_VACIO, genteEnEmpresa: '120' }).genteEnEmpresa).toBe(120)
    expect(aCuerpo({ ...BORRADOR_VACIO, genteEnEmpresa: '' }).genteEnEmpresa).toBeNull()
    expect(aCuerpo({ ...BORRADOR_VACIO, genteACargo: 'tres' }).genteACargo).toBeNull()
  })
})

describe('las familias', () => {
  it('se marcan y se quitan dejando la cadena en el orden F1..F7', () => {
    let familias = conFamilia('', 'F4', true)
    expect(familias).toBe('F4')
    familias = conFamilia(familias, 'F1', true)
    expect(familias).toBe('F1,F4')
    familias = conFamilia(familias, 'F7', true)
    expect(familias).toBe('F1,F4,F7')
    familias = conFamilia(familias, 'F4', false)
    expect(familias).toBe('F1,F7')
    expect(tieneFamilia(familias, 'F1')).toBe(true)
    expect(tieneFamilia(familias, 'F4')).toBe(false)
  })
})

describe('qué le falta para quedar completa', () => {
  const completa = {
    ...BORRADOR_VACIO,
    q1Resultado: 'a',
    q2Riesgo: 'b',
    q3DiaReal: 'c',
    q4EpocaDorada: 'd',
    q5Estructura: 'e',
    q6Autonomia: 'f',
    q7JefeDirecto: 'g',
    q8LoIncomodo: 'h',
    q9Requerimientos: 'i',
    genteEnEmpresa: '40',
    genteACargo: '3',
    riesgo1: 'r1',
    riesgo2: 'r2',
    riesgo3: 'r3',
    riesgo4: 'r4',
    eliminatoria1: 'e1',
    familias: 'F4',
  }

  it('con todo lo obligatorio no falta nada, y Q10 no cuenta', () => {
    expect(queLeFalta(completa)).toEqual([])
    expect(completa.q10Espejo).toBe('')
  })

  it('dice qué falta como se lee', () => {
    const faltan = queLeFalta({ ...completa, q3DiaReal: '', genteACargo: '', riesgo4: '', familias: '' })
    expect(faltan).toEqual([
      'la pregunta 3',
      'cuántas personas tendrá a cargo',
      '1 de los cuatro riesgos',
      'al menos una familia',
    ])
  })
})

describe('de la ficha al borrador y vuelta', () => {
  it('los nulos se vuelven texto vacío y las cifras texto, sin perder nada', () => {
    const ficha = {
      id: 1,
      vacanteId: 7,
      ...aCuerpo(BORRADOR_VACIO),
      q1Resultado: 'Que la caja cuadre',
      genteEnEmpresa: 45,
      familias: 'F4',
      tamano: 'MEDIA',
      estado: 'BORRADOR',
      actualizadoEn: null,
      pesosSugeridos: null,
    } as FichaDelPuesto
    const borrador = deFicha(ficha)
    expect(borrador.q1Resultado).toBe('Que la caja cuadre')
    expect(borrador.genteEnEmpresa).toBe('45')
    expect(borrador.genteACargo).toBe('')
    expect(borrador.familias).toBe('F4')
    expect(aCuerpo(borrador)).toEqual(aCuerpo(deFicha(ficha)))
    expect(deFicha(null)).toEqual(BORRADOR_VACIO)
  })
})

describe('los arreglos del QA', () => {
  it('lo que va después de un hueco no viaja, aunque la casilla apagada conserve texto', () => {
    const cuerpo = aCuerpo({ ...BORRADOR_VACIO, riesgo1: '', riesgo2: 'caja', riesgo3: 'gente' })
    expect(cuerpo.riesgo2).toBeNull()
    expect(cuerpo.riesgo3).toBeNull()
    const sinPrimera = aCuerpo({ ...BORRADOR_VACIO, eliminatoria2: 'x', requerimiento1: 'a', requerimiento3: 'c' })
    expect(sinPrimera.eliminatoria2).toBeNull()
    expect(sinPrimera.requerimiento1).toBe('a')
    expect(sinPrimera.requerimiento3).toBeNull()
  })

  it('una cifra con decimales o negativa no se recorta: no viaja', () => {
    expect(aCuerpo({ ...BORRADOR_VACIO, genteEnEmpresa: '12.7' }).genteEnEmpresa).toBeNull()
    expect(aCuerpo({ ...BORRADOR_VACIO, genteEnEmpresa: '-5' }).genteEnEmpresa).toBeNull()
    expect(aCuerpo({ ...BORRADOR_VACIO, genteEnEmpresa: '0' }).genteEnEmpresa).toBe(0)
  })
})
