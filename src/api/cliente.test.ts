/**
 * Que los errores del backend lleguen enteros a la pantalla.
 *
 * Spring devuelve sus errores como `application/problem+json`, no como
 * `application/json`. El cliente buscaba la cadena entera, asi que TODO error
 * del backend se leia como texto plano y su explicacion se perdia por el
 * camino: daba igual que el servidor dijera «La respuesta es demasiado larga» o
 * «El plazo ya pasó», el candidato veia siempre «No se pudo completar la
 * operación» y nadie podia saber que estaba mal.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorApi, pedir } from './cliente'

function respuestaDeError(estado: number, cuerpo: unknown, tipo: string) {
  const texto = JSON.stringify(cuerpo)
  return new Response(texto, {
    status: estado,
    headers: { 'content-type': tipo, date: new Date().toUTCString() },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('el cliente lee lo que el backend explica', () => {
  it('entiende un problem+json y saca el motivo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        respuestaDeError(
          404,
          { detail: "Vacante not found with id: '99999999'", status: 404 },
          'application/problem+json',
        ),
      ),
    )

    await expect(pedir('/vacantes/99999999')).rejects.toThrow(
      "Vacante not found with id: '99999999'",
    )
  })

  it('saca el mensaje de validación aunque venga como objeto, no como lista', async () => {
    // `GlobalControllerAdvice` arma `errors` con un Map: campo → mensaje.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        respuestaDeError(
          400,
          {
            detail: 'La validación falló en uno o más campos',
            errors: { texto: 'La respuesta es demasiado larga' },
          },
          'application/problem+json',
        ),
      ),
    )

    await expect(pedir('/evaluacion/x/respuestas/1', { metodo: 'PUT', cuerpo: {} })).rejects.toThrow(
      'La respuesta es demasiado larga',
    )
  })

  it('cuando de verdad no hay explicación, dice el código', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 409, headers: { 'content-length': '0' } })),
    )

    try {
      await pedir('/algo', { metodo: 'POST', cuerpo: {} })
      expect.unreachable('tenía que fallar')
    } catch (causa) {
      expect(causa).toBeInstanceOf(ErrorApi)
      expect((causa as ErrorApi).message).toContain('409')
    }
  })
})
