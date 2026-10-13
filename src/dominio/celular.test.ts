import { describe, expect, it } from 'vitest'
import { comoE164, MENSAJE_CELULAR, paraEditar, paraMostrar } from './celular'

/**
 * La misma tabla que `CelularTest` del backend: si una de las dos cambia y la otra
 * no, el formulario dejaría pasar lo que la API rechaza (o al revés).
 */
describe('el celular de la cuenta (V73)', () => {
  it.each([
    ['987654321', '+51987654321'],
    ['987 654 321', '+51987654321'],
    [' 987-654-321 ', '+51987654321'],
    ['(987) 654.321', '+51987654321'],
    ['51 987 654 321', '+51987654321'],
    ['+51 987 654 321', '+51987654321'],
    ['0051987654321', '+51987654321'],
    ['+34 612 345 678', '+34612345678'],
    ['0034612345678', '+34612345678'],
    ['+1 (415) 555-2671', '+14155552671'],
  ])('«%s» vale y se guarda como %s', (escrito, e164) => {
    expect(comoE164(escrito)).toBe(e164)
  })

  it.each([
    '',
    '   ',
    '87654321',
    '812345678',
    '9876543210',
    '98765432a',
    '34612345678',
    '+51 54 123456',
    '+51 812 345 678',
    '+0123456789',
    '+1234567',
    '+1234567890123456',
    'uno dos tres',
    '+51 987 654 321 ext 2',
  ])('«%s» no vale', (escrito) => {
    expect(comoE164(escrito)).toBeNull()
  })

  it('el mensaje es el del backend, palabra por palabra', () => {
    expect(MENSAJE_CELULAR).toBe(
      'Escribe un celular de 9 cifras que empiece por 9, o el número completo con su prefijo',
    )
  })

  it('se enseña agrupado, y se edita sin el +51 que el campo ya dibuja', () => {
    expect(paraMostrar('+51987654321')).toBe('+51 987 654 321')
    expect(paraMostrar('+34612345678')).toBe('+34612345678')
    expect(paraEditar('+51987654321')).toBe('987 654 321')
    expect(paraEditar('+34612345678')).toBe('+34612345678')
    expect(paraEditar(null)).toBe('')
  })
})
