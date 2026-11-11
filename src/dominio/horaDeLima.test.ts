/**
 * La fecha límite en hora de Lima, sea cual sea la zona del navegador (V68).
 */

import { describe, expect, it } from 'vitest'
import {
  deInstanteALima,
  deLimaAInstante,
  diaDeLima,
  fechaCortaDeLima,
  fechaLargaDeLima,
  finDelDiaEnLima,
} from './horaDeLima'

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

describe('el día en que se cierra la vacante (V78)', () => {
  it('un día del selector es su 23:59:59 de Lima: el 31/10 cierra a las 04:59:59 UTC del 01/11', () => {
    expect(finDelDiaEnLima('2026-10-31')).toBe('2026-11-01T04:59:59.000Z')
    expect(fechaCortaDeLima(finDelDiaEnLima('2026-10-30')!)).toBe('vie 30/10, 23:59')
  })

  it('el día 1 y el 31/12 no se corren de mes ni de año', () => {
    expect(finDelDiaEnLima('2026-12-01')).toBe('2026-12-02T04:59:59.000Z')
    expect(finDelDiaEnLima('2026-12-31')).toBe('2027-01-01T04:59:59.000Z')
    expect(diaDeLima('2027-01-01T04:59:59Z')).toBe('2026-12-31')
  })

  it('de vuelta, el selector enseña el día de Lima y no el que sale de recortar en UTC', () => {
    expect(diaDeLima('2026-11-01T04:59:59Z')).toBe('2026-10-31')
    expect(diaDeLima('2026-11-01T05:00:00Z')).toBe('2026-11-01')
  })

  it('lo vacío o un día que no existe no dan instante', () => {
    expect(finDelDiaEnLima('')).toBeNull()
    expect(finDelDiaEnLima('2026-02-31')).toBeNull()
    expect(finDelDiaEnLima('31/10/2026')).toBeNull()
  })
})
