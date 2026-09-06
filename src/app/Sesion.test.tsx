/**
 * Al cerrar sesión no se queda nada de la persona que estaba.
 *
 * ⚠️ **El fallo que esto fija se ve, y con la cara de otro.** Nadie vaciaba la
 * caché de TanStack Query al salir: borrar el token deja fuera al servidor,
 * pero lo ya bajado sigue en memoria. La url del blob de la foto **sigue
 * valiendo aunque el token no**, así que la cuenta siguiente que entrara en la
 * misma pestaña y tuviera foto veía la de la anterior mientras se pedía la
 * suya.
 *
 * Se prueban las dos puertas de salida, que son dos caminos distintos del
 * proveedor: el botón de «Cerrar sesión» y el token que caduca solo.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearClienteDeDatos } from './datos'
import { ProveedorSesion, useSesion } from './Sesion'

/** El 401 que cierra la sesión sola: se guarda la escucha para dispararla aquí. */
const puerta = vi.hoisted(() => ({ caida: null as null | (() => void) }))

vi.mock('@/api/cliente', () => ({
  leerToken: () => 'un-token',
  guardarToken: () => {},
  borrarToken: () => {},
  alCaerLaSesion: (escucha: () => void) => {
    puerta.caida = escucha
    return () => {
      puerta.caida = null
    }
  },
}))

vi.mock('@/api/portal', () => ({
  quienSoy: () => Promise.resolve({ nombre: 'Ana', apellidos: 'Quispe' }),
  ingresar: () => Promise.resolve({ token: 't', nombre: 'Ana', apellidos: 'Quispe' }),
  accederConEnlace: () => Promise.resolve({ token: 't', nombre: 'Ana', apellidos: 'Quispe' }),
  crearCuenta: () => Promise.resolve(undefined),
}))

const revocadas: string[] = []

function Salida() {
  const { salir } = useSesion()
  return (
    <button type="button" onClick={salir}>
      Cerrar sesión
    </button>
  )
}

/** Una caché con lo que tendría alguien dentro: su perfil y la url de su foto. */
function conLaSesionAbierta() {
  const datos = crearClienteDeDatos()
  datos.setQueryData(['perfil'], { titular: 'Analista de procesos' })
  datos.setQueryData(['perfil-foto'], 'blob:la-foto-de-ana')
  render(
    <QueryClientProvider client={datos}>
      <ProveedorSesion>
        <Salida />
      </ProveedorSesion>
    </QueryClientProvider>,
  )
  return datos
}

beforeEach(() => {
  revocadas.length = 0
  puerta.caida = null
  URL.revokeObjectURL = vi.fn((url: string) => {
    revocadas.push(url)
  })
})
afterEach(cleanup)

describe('cerrar sesión vacía la caché', () => {
  it('el botón de salir no deja ni el perfil ni la url de la foto', () => {
    const datos = conLaSesionAbierta()
    expect(datos.getQueryCache().getAll()).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    expect(datos.getQueryCache().getAll()).toHaveLength(0)
    expect(revocadas).toContain('blob:la-foto-de-ana')
  })

  it('un token caducado hace lo mismo, sin que nadie pulse nada', () => {
    const datos = conLaSesionAbierta()
    expect(puerta.caida).not.toBeNull()

    // Lo que hace el cliente al ver un 401: avisar de que la sesión se cayó.
    act(() => puerta.caida!())

    expect(datos.getQueryCache().getAll()).toHaveLength(0)
    expect(revocadas).toContain('blob:la-foto-de-ana')
  })
})
