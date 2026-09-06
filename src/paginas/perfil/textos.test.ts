/**
 * Las cuentas de la línea de tiempo.
 *
 * Se prueban aparte porque son puras y porque **lo que importa es lo que
 * devuelven cuando el dato viene mal**: estas fechas salen de un currículum que
 * leyó un modelo, así que llegan invertidas, incompletas o vacías más a menudo
 * de lo que parece, y la pantalla tiene que pintar la fila igual.
 */

import { describe, expect, it } from 'vitest'
import { aniosYMeses, huecoEntre, mesesDelTramo } from './textos'

describe('mesesDelTramo', () => {
  it('cuenta los dos extremos: enero a marzo son tres meses', () => {
    expect(mesesDelTramo('2022-01-01', '2022-03-01')).toBe(3)
  })

  it('un tramo abierto llega hasta hoy', () => {
    const hace2anios = new Date()
    hace2anios.setFullYear(hace2anios.getFullYear() - 2)
    expect(mesesDelTramo(hace2anios.toISOString().slice(0, 10), null)).toBe(25)
  })

  it('sin fecha de inicio no se inventa una duración', () => {
    expect(mesesDelTramo(null, '2022-03-01')).toBeNull()
  })

  it('un fin anterior al principio devuelve null, no un número negativo', () => {
    expect(mesesDelTramo('2022-03-01', '2020-01-01')).toBeNull()
  })

  it('una fecha que no es una fecha devuelve null', () => {
    expect(mesesDelTramo('no es una fecha', '2022-03-01')).toBeNull()
  })
})

describe('huecoEntre', () => {
  it('un año parado es un hueco', () => {
    expect(huecoEntre('2019-01-01', '2020-01-01')).toBe(12)
  })

  it('cambiar de trabajo en dos meses no es un hueco', () => {
    expect(huecoEntre('2020-01-01', '2020-03-01')).toBeNull()
  })

  it('sin una de las dos fechas no se dibuja nada', () => {
    expect(huecoEntre(null, '2020-01-01')).toBeNull()
    expect(huecoEntre('2020-01-01', null)).toBeNull()
  })

  it('un par en desorden no inventa un hueco', () => {
    // Las filas se reordenan a mano: dos que no van seguidas en el tiempo
    // darían un hueco negativo si no se comprobara.
    expect(huecoEntre('2022-01-01', '2019-01-01')).toBeNull()
  })
})

describe('aniosYMeses', () => {
  it('96 meses son ocho años', () => {
    expect(aniosYMeses(96)).toBe('8 años de experiencia')
  })
  it('el singular es singular', () => {
    expect(aniosYMeses(13)).toBe('1 año y 1 mes de experiencia')
  })
})
