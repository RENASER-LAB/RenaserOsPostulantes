/**
 * Las fechas de la prueba en hora de Lima (V89).
 *
 * ⚠️ **Lo que compila estando mal es leer el campo como UTC o como la zona del
 * equipo.** «Hasta 20/11 18:00» es hora de Lima aunque quien lo escriba esté en
 * Madrid: el instante guardado tiene que ser las 23:00 UTC. Por eso aquí la zona
 * del proceso se fuerza a otra y las conversiones se comprueban con literales.
 */
const ZONA_ANTES = process.env.TZ
process.env.TZ = 'Europe/Madrid'

import { afterAll, describe, expect, it } from 'vitest'
import { conDiaDeLaSemanaEnLima, deCampoDeLima, diaCortoEnLima, diaYHoraEnLima } from './horaDeLima'

afterAll(() => {
  process.env.TZ = ZONA_ANTES
})

/** Un «ahora» de ese año: el año solo se dice si no es el de hoy. */
const EN_2026 = Date.parse('2026-06-01T12:00:00Z')

describe('las fechas de la prueba, en hora de Lima', () => {
  it('el campo «Hasta» se lee en Lima, no en la zona del equipo', () => {
    expect(deCampoDeLima('2026-11-20T18:00')).toBe('2026-11-20T23:00:00.000Z')
    // A las 23:59 de Lima ya es el día siguiente en UTC.
    expect(deCampoDeLima('2026-11-20T23:59')).toBe('2026-11-21T04:59:00.000Z')
  })

  it('un texto que no es fecha y hora no se convierte', () => {
    expect(deCampoDeLima('')).toBeNull()
    expect(deCampoDeLima('2026-11-20')).toBeNull()
    expect(deCampoDeLima('2026-13-40T25:00')).toBeNull()
  })

  it('se dicen como en la ficha y en los avisos', () => {
    expect(diaCortoEnLima('2026-11-18T21:40:00Z', EN_2026)).toBe('18 nov')
    expect(diaYHoraEnLima('2026-11-18T21:40:00Z', EN_2026)).toBe('18 nov, 16:40')
    expect(conDiaDeLaSemanaEnLima('2026-11-20T23:00:00Z', EN_2026)).toBe('vie 20 nov, 18:00')
  })

  it('una madrugada en UTC es todavía el día anterior en Lima', () => {
    expect(diaYHoraEnLima('2026-12-01T03:00:00Z', EN_2026)).toBe('30 nov, 22:00')
  })

  it('con el año cuando no es el de ahora', () => {
    expect(diaCortoEnLima('2027-01-05T15:00:00Z', EN_2026)).toBe('5 ene 2027')
  })
})
