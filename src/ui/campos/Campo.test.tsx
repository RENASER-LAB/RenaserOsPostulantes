/**
 * El ojo de una contraseña.
 *
 * Vive en `Campo`, así que lo heredan los cinco campos de contraseña del portal
 * y del panel: entrar, crear cuenta con su repetición, la entrada del equipo y
 * la invitación con la suya. Se prueba aquí una vez y no en cinco pantallas.
 *
 * Lo que se fija:
 *
 *   - Que el campo **nazca tapado**. Un campo que empieza en claro enseña la
 *     contraseña a quien esté al lado sin que nadie lo haya pedido.
 *   - Que el botón **no envíe el formulario**. Un `<button>` sin `type` es de
 *     envío: pulsar el ojo intentaría entrar. Este portal ya pagó ese fallo.
 *   - Que el nombre diga **lo que va a pasar** y cambie con el estado.
 *   - Que un campo que no es contraseña **no reciba ningún ojo**.
 */

import { describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach } from 'vitest'
import { Campo } from './Campo'

afterEach(cleanup)

function elCampo(): HTMLInputElement {
  return screen.getByLabelText('Contraseña') as HTMLInputElement
}

describe('el ojo de una contraseña', () => {
  it('nace tapada y se destapa al pulsar', () => {
    render(<Campo etiqueta="Contraseña" type="password" defaultValue="secreta" />)

    expect(elCampo().type).toBe('password')

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar la contraseña' }))
    expect(elCampo().type).toBe('text')

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar la contraseña' }))
    expect(elCampo().type).toBe('password')
  })

  it('no pierde lo escrito al destapar', () => {
    render(<Campo etiqueta="Contraseña" type="password" defaultValue="cuatro palabras" />)

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar la contraseña' }))
    expect(elCampo().value).toBe('cuatro palabras')
  })

  it('el botón no envía el formulario que lo contiene', () => {
    // La trampa: `<button>` sin `type` es de envío. Dentro del formulario de
    // entrar, mirar la contraseña sería intentar entrar con ella.
    const enviar = vi.fn((e: React.FormEvent) => e.preventDefault())
    render(
      <form onSubmit={enviar}>
        <Campo etiqueta="Contraseña" type="password" />
      </form>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar la contraseña' }))
    expect(enviar).not.toHaveBeenCalled()
  })

  it('el ojo apunta al campo que destapa', () => {
    render(<Campo etiqueta="Contraseña" type="password" />)

    const ojo = screen.getByRole('button', { name: 'Mostrar la contraseña' })
    expect(ojo.getAttribute('aria-controls')).toBe(elCampo().id)
  })

  it('un campo que no es contraseña no lleva ojo', () => {
    render(<Campo etiqueta="Correo" type="email" />)

    expect(screen.queryByRole('button')).toBeNull()
  })

  it('el error se sigue diciendo con el campo destapado', () => {
    // El ojo mete un elemento entre la etiqueta y el error; lo que los ata es
    // `aria-describedby`, y tiene que sobrevivir al cambio de tipo.
    render(<Campo etiqueta="Contraseña" type="password" error="Escribe tu contraseña." />)

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar la contraseña' }))

    const campo = elCampo()
    const descrito = campo.getAttribute('aria-describedby')!
    expect(document.getElementById(descrito)?.textContent).toBe('Escribe tu contraseña.')
    expect(campo.getAttribute('aria-invalid')).toBe('true')
  })
})
