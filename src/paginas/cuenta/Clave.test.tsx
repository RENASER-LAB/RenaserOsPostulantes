/**
 * `/clave`: pedir el enlace de contraseña nueva, del lado del candidato.
 *
 * Lo que esta prueba fija, y que se rompe sin que nada más lo note:
 *
 *   - **El mensaje de enviado es el mismo siempre** (AC-01, AC-02): la pantalla
 *     no sabe si la cuenta existe y no puede enseñar nada que lo sugiera.
 *   - **Un correo mal escrito no llega al servidor.**
 *   - **Reenviar espera un minuto con su cuenta atrás**, y el doble clic manda
 *     una sola vez.
 *   - **La línea de talento sigue ahí**, antes y después de enviar.
 *   - **El foco pasa al mensaje al enviar** (AC-20).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ErrorApi } from '@/api/puerta'
import { Clave } from './Clave'

const pedir = vi.fn()

vi.mock('@/api/portal', () => ({
  pedirRecuperacion: (correo: string) => pedir(correo),
}))

const MENSAJE =
  'Si ese correo tiene una cuenta, te enviamos un enlace. Revisa también tu carpeta de spam. Vale por 60 minutos.'

function montar() {
  return render(
    <MemoryRouter initialEntries={['/clave']}>
      <Clave />
    </MemoryRouter>,
  )
}

async function enviar(correo: string) {
  fireEvent.change(screen.getByLabelText('Correo'), { target: { value: correo } })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }))
  })
}

beforeEach(() => {
  pedir.mockReset()
  pedir.mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('pedir el enlace en el portal', () => {
  it('la pantalla ya no dice que no se puede restablecer', () => {
    montar()
    expect(screen.queryByText(/todavía no podemos restablecer/i)).toBeNull()
    expect(screen.getByRole('button', { name: 'Enviar enlace' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /volver a entrar/i }).getAttribute('href')).toBe(
      '/ingresar',
    )
  })

  it('un correo vacío o mal escrito se para en la pantalla, sin llamar al servidor', async () => {
    montar()
    await enviar('')
    expect(screen.getByText('Escribe tu correo.')).toBeTruthy()
    await enviar('ana')
    expect(screen.getByText(/esto no parece un correo/i)).toBeTruthy()
    expect(screen.getByLabelText('Correo').getAttribute('aria-invalid')).toBe('true')
    expect(pedir).not.toHaveBeenCalled()
  })

  it('AC-01 · AC-20 · al enviar se ve el mensaje neutro, y el foco pasa a él', async () => {
    montar()
    await enviar('  ana@correo.pe ')

    expect(pedir).toHaveBeenCalledWith('ana@correo.pe')
    const mensaje = screen.getByText(MENSAJE)
    expect(mensaje.getAttribute('role')).toBe('status')
    expect(document.activeElement).toBe(mensaje)
    expect(screen.getByRole('heading', { name: 'Revisa tu correo.' })).toBeTruthy()
  })

  it('la línea de talento está antes y después de enviar', async () => {
    montar()
    expect(screen.getByRole('link', { name: 'talento@renaser.pe' })).toBeTruthy()
    expect(screen.getByText(/¿no te llega\? escríbenos a/i)).toBeTruthy()
    await enviar('ana@correo.pe')
    expect(screen.getByRole('link', { name: 'talento@renaser.pe' })).toBeTruthy()
  })

  it('reenviar queda apagado un minuto con su cuenta atrás, y después reenvía al mismo correo', async () => {
    vi.useFakeTimers()
    montar()
    await enviar('ana@correo.pe')

    const reenviar = () => screen.getByRole('button', { name: /reenviar enlace/i }) as HTMLButtonElement
    expect(reenviar().disabled).toBe(true)
    expect(reenviar().textContent).toBe('Reenviar enlace (en 60 s)')

    act(() => {
      vi.advanceTimersByTime(15_000)
    })
    expect(reenviar().textContent).toBe('Reenviar enlace (en 45 s)')

    act(() => {
      vi.advanceTimersByTime(45_000)
    })
    expect(reenviar().disabled).toBe(false)
    expect(reenviar().textContent).toBe('Reenviar enlace')

    await act(async () => {
      fireEvent.click(reenviar())
    })
    expect(pedir).toHaveBeenCalledTimes(2)
    expect(pedir).toHaveBeenLastCalledWith('ana@correo.pe')
    expect(reenviar().disabled).toBe(true)
    // El mismo mensaje, y el foco otra vez en él
    expect(document.activeElement).toBe(screen.getByText(MENSAJE))
  })

  it('el doble clic en «Enviar enlace» manda una sola vez', async () => {
    let soltar: () => void = () => {}
    pedir.mockReturnValue(new Promise<void>((r) => (soltar = r)))
    montar()
    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'ana@correo.pe' } })
    const boton = screen.getByRole('button', { name: 'Enviar enlace' })
    fireEvent.click(boton)
    fireEvent.click(boton)
    expect(pedir).toHaveBeenCalledTimes(1)
    await act(async () => {
      soltar()
    })
  })

  it('«Usar otro correo» vuelve al formulario vacío', async () => {
    montar()
    await enviar('ana@correo.pe')
    fireEvent.click(screen.getByRole('button', { name: 'Usar otro correo' }))
    expect((screen.getByLabelText('Correo') as HTMLInputElement).value).toBe('')
    expect(screen.getByRole('button', { name: 'Enviar enlace' })).toBeTruthy()
  })

  it('un fallo de red se dice sin salir del formulario, y no enseña el mensaje de enviado', async () => {
    pedir.mockRejectedValue(new ErrorApi(0, 'No pudimos conectar. Revisa tu conexión.'))
    montar()
    await enviar('ana@correo.pe')

    expect(screen.getByRole('alert').textContent).toMatch(/no pudimos enviar tu solicitud/i)
    expect(screen.queryByText(MENSAJE)).toBeNull()
    expect((screen.getByLabelText('Correo') as HTMLInputElement).value).toBe('ana@correo.pe')
  })
})
