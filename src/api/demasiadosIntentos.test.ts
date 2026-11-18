import { describe, expect, it } from 'vitest'
import { ErrorApi } from './puerta'
import { textoDeDemasiadosIntentos } from './demasiadosIntentos'

describe('textoDeDemasiadosIntentos', () => {
  it('dice cuántos minutos faltan, redondeando hacia arriba', () => {
    expect(textoDeDemasiadosIntentos(new ErrorApi(429, 'x', { segundosDeEspera: 601 }))).toBe(
      'Demasiados intentos fallidos. Vuelve a probar en 11 minutos.',
    )
  })

  it('un minuto o menos se dice «en un minuto»', () => {
    expect(textoDeDemasiadosIntentos(new ErrorApi(429, 'x', { segundosDeEspera: 40 }))).toBe(
      'Demasiados intentos fallidos. Vuelve a probar en un minuto.',
    )
  })

  it('sin segundos en el cuerpo, pide esperar sin inventar una cifra', () => {
    expect(textoDeDemasiadosIntentos(new ErrorApi(429, 'x', null))).toBe(
      'Demasiados intentos fallidos. Espera un momento antes de volver a probar.',
    )
  })

  it('cualquier otro fallo no es suyo', () => {
    expect(textoDeDemasiadosIntentos(new ErrorApi(401, 'x'))).toBeNull()
    expect(textoDeDemasiadosIntentos(new Error('x'))).toBeNull()
  })
})
