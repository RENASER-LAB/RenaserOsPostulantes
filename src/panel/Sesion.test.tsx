/**
 * La sesión del panel cuando caduca a mitad de un formulario.
 *
 * Sin formulario abierto, un 401 lleva a «Entrar» como siempre. Con uno que
 * retiene la sesión, no: el formulario ya lo dice y lo escrito se queda. Al
 * cerrarlo, si nadie volvió a entrar, entonces sí; si entró en otra pestaña, se
 * sigue dentro.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { guardarToken, pedir } from './api/cliente'
import { ProveedorSesionPanel, useRetenerLaSesion, useSesionPanel } from './Sesion'

function Estado() {
  const { hayEquipo } = useSesionPanel()
  return <p>{hayEquipo ? 'dentro' : 'fuera'}</p>
}

let cerrarFormulario: () => void = () => {}

function Formulario() {
  useRetenerLaSesion(true)
  return <p>formulario abierto</p>
}

function Pantalla({ conFormulario }: { conFormulario: boolean }) {
  const [abierto, setAbierto] = useState(conFormulario)
  cerrarFormulario = () => setAbierto(false)
  return (
    <ProveedorSesionPanel>
      <Estado />
      {abierto && <Formulario />}
    </ProveedorSesionPanel>
  )
}

async function unCuatroCientosUno() {
  await act(async () => {
    await pedir('/colaboradores/7/reingreso', { metodo: 'POST', cuerpo: {} }).catch(() => undefined)
  })
}

beforeEach(() => {
  localStorage.clear()
  guardarToken('token-que-caduca')
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ detail: 'Token vencido' }), {
      status: 401,
      headers: { 'Content-Type': 'application/problem+json' },
    })),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('la sesión que caduca', () => {
  it('sin formulario abierto, un 401 saca a «Entrar» como siempre', async () => {
    render(<Pantalla conFormulario={false} />)
    expect(screen.getByText('dentro')).toBeTruthy()
    await unCuatroCientosUno()
    expect(screen.getByText('fuera')).toBeTruthy()
  })

  it('con un formulario abierto no sale, y al cerrarlo sin haber vuelto a entrar, sí', async () => {
    render(<Pantalla conFormulario />)
    await unCuatroCientosUno()
    expect(screen.getByText('dentro')).toBeTruthy()
    expect(screen.getByText('formulario abierto')).toBeTruthy()

    act(() => cerrarFormulario())
    expect(screen.getByText('fuera')).toBeTruthy()
  })

  it('si entró de nuevo en otra pestaña mientras tanto, al cerrar el formulario sigue dentro', async () => {
    render(<Pantalla conFormulario />)
    await unCuatroCientosUno()
    guardarToken('token-nuevo-de-la-otra-pestaña')

    act(() => cerrarFormulario())
    expect(screen.getByText('dentro')).toBeTruthy()
  })
})
