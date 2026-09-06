/**
 * El cliente que monta `App` trae puesto lo que suelta las urls de los blobs.
 *
 * ⚠️ **Esta prueba existe por un hueco, no por completismo.** Las pruebas de la
 * cabecera del perfil se hacían su propio `QueryClient` y le enganchaban
 * `soltarUrlsDeArchivos` a mano, así que quitar esa línea de la aplicación de
 * verdad no rompía ninguna: la caché real se quedaba sin nadie que revocara. Lo
 * que se comprueba aquí es que el cliente **que usa la aplicación** lo trae de
 * fábrica.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { crearClienteDeDatos } from './datos'

const revocadas: string[] = []

beforeEach(() => {
  revocadas.length = 0
  // jsdom no la trae.
  URL.revokeObjectURL = vi.fn((url: string) => {
    revocadas.push(url)
  })
})
afterEach(() => {
  revocadas.length = 0
})

describe('el cliente de datos del portal', () => {
  it('suelta las urls de blob al vaciar la caché', () => {
    const datos = crearClienteDeDatos()
    datos.setQueryData(['perfil-foto'], 'blob:x')

    datos.clear()

    expect(revocadas).toContain('blob:x')
  })

  it('no toca lo que no es una url de blob', () => {
    const datos = crearClienteDeDatos()
    datos.setQueryData(['perfil'], { titular: 'Analista' })
    datos.setQueryData(['una-ruta'], 'https://example.com/foto.jpg')

    datos.clear()

    expect(revocadas).toEqual([])
  })
})
