/**
 * Las fechas de la ficha son días de Lima, no instantes.
 *
 * La trampa: `new Date('2026-09-29')` es medianoche UTC, que en Lima todavía es
 * el 28. Aquí se cuentan los días sin pasar por la zona.
 */

import { describe, expect, it } from 'vitest'
import { avisoDelContrato, diasEntre, formatearDia, hoyEnLima, sumarDias } from './fechas'

describe('los días del calendario', () => {
  it('se escriben dd/mm/aaaa sin moverse un día', () => {
    expect(formatearDia('2026-09-01')).toBe('01/09/2026')
    expect(formatearDia(null)).toBe('—')
  })

  it('se cuentan y se suman sin zona', () => {
    expect(diasEntre('2026-02-27', '2026-03-01')).toBe(2)
    expect(diasEntre('2026-03-01', '2026-02-27')).toBe(-2)
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('a las 20:00 de Lima todavía es hoy en Lima, aunque en UTC ya sea mañana', () => {
    // 01:00 UTC del 30 son las 20:00 del 29 en Lima.
    expect(hoyEnLima(Date.UTC(2026, 8, 30, 1, 0))).toBe('2026-09-29')
    expect(hoyEnLima(Date.UTC(2026, 8, 30, 5, 30))).toBe('2026-09-30')
  })
})

describe('el aviso del fin de contrato', () => {
  const hoy = '2026-09-29'

  it('«vence en N días» cuando faltan 30 o menos', () => {
    expect(avisoDelContrato('2026-10-11', 'ACTIVO', hoy)).toMatchObject({ texto: 'vence en 12 días', tono: 'vence' })
    expect(avisoDelContrato('2026-10-29', 'ACTIVO', hoy)).toMatchObject({ texto: 'vence en 30 días' })
    expect(avisoDelContrato('2026-10-30', 'ACTIVO', hoy)).toBeNull()
    expect(avisoDelContrato(hoy, 'ACTIVO', hoy)).toMatchObject({ texto: 'vence hoy' })
  })

  it('«vencido» cuando ya pasó y la persona sigue activa, explicando que pasa a indefinido', () => {
    const aviso = avisoDelContrato('2026-09-20', 'ACTIVO', hoy)
    expect(aviso).toMatchObject({ texto: 'vencido', tono: 'vencido' })
    expect(aviso?.explicacion).toContain('indefinido')
  })

  it('a un cesado no se le avisa de nada', () => {
    expect(avisoDelContrato('2026-09-20', 'CESADO', hoy)).toBeNull()
    expect(avisoDelContrato(null, 'ACTIVO', hoy)).toBeNull()
  })
})
