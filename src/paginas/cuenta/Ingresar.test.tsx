/**
 * Entrar.
 *
 * Dos cosas, y la segunda es la que se pidió quitar.
 *
 *   - El formulario funciona y su contraseña se puede mirar.
 *   - **El bloque «Con el enlace que te enviamos» ya no está.** Se retiró por
 *     decisión del cliente. El mecanismo sigue vivo —`/acceso` canjea el token
 *     igual— así que lo que este test fija es que el texto no vuelva solo, no
 *     que la vía haya desaparecido.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ProveedorSesion } from '@/app/Sesion'
import { Ingresar } from './Ingresar'

afterEach(cleanup)

function montar() {
  return render(
    <ProveedorSesion>
      <MemoryRouter initialEntries={['/ingresar']}>
        <Ingresar />
      </MemoryRouter>
    </ProveedorSesion>,
  )
}

describe('la pantalla de entrar', () => {
  it('no habla del enlace del correo', () => {
    montar()

    expect(screen.queryByText(/con el enlace que te enviamos/i)).toBeNull()
    expect(screen.queryByText(/tu postulación avanza/i)).toBeNull()
    expect(screen.queryByText(/tu prueba está disponible/i)).toBeNull()
    // Y la frase que contaba los dos caminos: con uno solo, mentía.
    expect(screen.queryByText(/hay dos formas de entrar/i)).toBeNull()
  })

  it('deja el formulario y su salida intactos', () => {
    montar()

    expect(screen.getByLabelText('Correo')).toBeTruthy()
    expect(screen.getByLabelText('Contraseña')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /olvidaste tu contraseña/i })).toBeTruthy()
    expect(screen.getByRole('link', { name: /créala aquí/i })).toBeTruthy()
  })

  it('la contraseña se puede mirar desde aquí', () => {
    montar()

    const campo = screen.getByLabelText('Contraseña') as HTMLInputElement
    expect(campo.type).toBe('password')
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar la contraseña' }))
    expect((screen.getByLabelText('Contraseña') as HTMLInputElement).type).toBe('text')
  })
})
