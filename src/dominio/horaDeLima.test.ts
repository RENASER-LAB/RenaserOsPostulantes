/**
 * La fecha límite en hora de Lima, sea cual sea la zona del navegador (V68).
 */

import { describe, expect, it } from 'vitest'
import { deInstanteALima, deLimaAInstante, fechaCortaDeLima, fechaLargaDeLima } from './horaDeLima'

describe('la fecha límite en hora de Lima', () => {
  it('lo escrito en el campo es hora de Lima: las 23:59 del 9 son las 04:59 UTC del 10', () => {
    expect(deLimaAInstante('2026-10-09T23:59')).toBe('2026-10-10T04:59:00.000Z')
    expect(deLimaAInstante('2026-10-09T23:59:30')).toBe('2026-10-10T04:59:00.000Z')
  })

  it('y de vuelta: un instante se pinta con el reloj de Lima, no el de UTC', () => {
    expect(deInstanteALima('2026-10-10T04:59:00Z')).toBe('2026-10-09T23:59')
    expect(deInstanteALima(deLimaAInstante('2026-01-01T00:00')!)).toBe('2026-01-01T00:00')
  })

  it('un día 1 no cae en el mes anterior', () => {
    expect(deInstanteALima('2026-11-01T05:00:00Z')).toBe('2026-11-01T00:00')
    expect(fechaCortaDeLima('2026-11-01T05:00:00Z')).toBe('dom 01/11, 00:00')
  })

  it('lo vacío, lo mal escrito y una fecha que no existe no dan instante', () => {
    expect(deLimaAInstante('')).toBeNull()
    expect(deLimaAInstante('mañana')).toBeNull()
    expect(deLimaAInstante('2026-02-31T10:00')).toBeNull()
  })

  it('el chip y la pantalla previa: «vie 09/10, 23:59» y «viernes 09/10 a las 23:59»', () => {
    expect(fechaCortaDeLima('2026-10-10T04:59:00Z')).toBe('vie 09/10, 23:59')
    expect(fechaLargaDeLima('2026-10-10T04:59:00Z')).toBe('viernes 09/10 a las 23:59')
  })
})
