/**
 * Lo que comparten los formularios del panel al enviar: el fallo con el foco,
 * la sesión caducada dicha como tal y un solo envío por doble clic.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { ErrorApi } from '../api/cliente'
import { AvisoDeFallo, explicarFallo, useUnaVez } from './Envio'

afterEach(cleanup)

describe('AvisoDeFallo', () => {
  it('toma el foco al aparecer, aunque el botón que envió se haya desactivado', () => {
    function Formulario() {
      const [fallo, setFallo] = useState<string | null>(null)
      return (
        <>
          <button type="button" disabled={fallo !== null} onClick={() => setFallo('Ese jefe crearía un círculo')}>
            Guardar
          </button>
          {fallo && <AvisoDeFallo>{fallo}</AvisoDeFallo>}
        </>
      )
    }
    render(<Formulario />)
    const boton = screen.getByRole('button', { name: 'Guardar' })
    boton.focus()
    fireEvent.click(boton)
    const aviso = screen.getByRole('alert')
    expect(aviso.textContent).toContain('círculo')
    expect(document.activeElement).toBe(aviso)
  })
})

describe('explicarFallo', () => {
  it('un 401 dice que la sesión caducó, que lo escrito sigue y cómo volver a entrar sin salir', () => {
    render(<p>{explicarFallo(new ErrorApi(401, 'Tu sesión terminó. Vuelve a ingresar.'), 'No se pudo guardar.')}</p>)
    expect(screen.getByText(/Tu sesión caducó y esto no se guardó/)).toBeTruthy()
    expect(screen.getByText(/Lo que escribiste sigue aquí/)).toBeTruthy()
    const enlace = screen.getByRole('link', { name: 'entra de nuevo en otra pestaña' })
    expect(enlace.getAttribute('href')).toBe('/admin/entrar')
    expect(enlace.getAttribute('target')).toBe('_blank')
  })

  it('cualquier otro fallo dice lo que dijo el servidor, y si no hay nada, lo de por defecto', () => {
    expect(explicarFallo(new ErrorApi(400, 'Ese jefe crearía un círculo'), 'No se pudo guardar.')).toBe(
      'Ese jefe crearía un círculo',
    )
    expect(explicarFallo('raro', 'No se pudo guardar.')).toBe('No se pudo guardar.')
  })
})

describe('useUnaVez', () => {
  it('un doble clic manda una sola petición, y al terminar se puede volver a enviar', async () => {
    let terminar: () => void = () => {}
    const enviar = vi.fn(
      () =>
        new Promise<void>((resolver) => {
          terminar = resolver
        }),
    )
    function Boton() {
      const unaVez = useUnaVez()
      return (
        <button type="button" onClick={() => unaVez(enviar)}>
          No dar de alta
        </button>
      )
    }
    render(<Boton />)
    const boton = screen.getByRole('button')
    fireEvent.click(boton)
    fireEvent.click(boton)
    expect(enviar).toHaveBeenCalledTimes(1)

    terminar()
    await Promise.resolve()
    await Promise.resolve()
    fireEvent.click(boton)
    expect(enviar).toHaveBeenCalledTimes(2)
  })

  it('un envío que falla también suelta el cerrojo', async () => {
    const enviar = vi.fn(() => Promise.reject(new Error('no')))
    function Boton() {
      const unaVez = useUnaVez()
      return (
        <button type="button" onClick={() => unaVez(enviar)}>
          Guardar
        </button>
      )
    }
    render(<Boton />)
    fireEvent.click(screen.getByRole('button'))
    await vi.waitFor(() => {
      fireEvent.click(screen.getByRole('button'))
      expect(enviar).toHaveBeenCalledTimes(2)
    })
  })
})
