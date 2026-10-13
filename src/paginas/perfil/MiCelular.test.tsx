/**
 * «Mi cuenta» enseña el celular y deja cambiarlo con la misma regla que el registro (V73,
 * punto 2 y AC-02).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ANCLA_CELULAR, MiCelular } from './MiCelular'

const api = vi.hoisted(() => ({
  quienSoy: vi.fn(),
  cambiarCelular: vi.fn(),
}))

vi.mock('@/api/portal', () => api)

function montar(direccion = '/perfil') {
  const datos = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={datos}>
      <MemoryRouter initialEntries={[direccion]}>
        <MiCelular />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  cleanup()
  api.quienSoy.mockReset()
  api.cambiarCelular.mockReset()
})

describe('el celular en «Mi cuenta»', () => {
  it('lo enseña agrupado, con «Cambiar»', async () => {
    api.quienSoy.mockResolvedValue({ usuarioId: 1, nombre: 'Ana', apellidos: 'Pérez', telefono: '+51987654321' })
    montar()

    expect(await screen.findByText('+51 987 654 321')).toBeTruthy()
    expect(screen.getByText(/Celular:/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cambiar' })).toBeTruthy()
  })

  it('una cuenta anterior sin celular puede añadirlo, sin que se le obligue', async () => {
    api.quienSoy.mockResolvedValue({ usuarioId: 1, nombre: 'Ana', apellidos: 'Pérez', telefono: null })
    montar()

    expect(await screen.findByText('todavía no lo has dado')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Añadir' })).toBeTruthy()
  })

  it('«Cambiar» abre el campo con la misma regla y guarda el nuevo', async () => {
    api.quienSoy.mockResolvedValue({ usuarioId: 1, nombre: 'Ana', apellidos: 'Pérez', telefono: '+51987654321' })
    api.cambiarCelular.mockResolvedValue({ telefono: '+51912345678', paraMostrar: '+51 912 345 678' })
    montar()

    fireEvent.click(await screen.findByRole('button', { name: 'Cambiar' }))
    const campo = screen.getByLabelText(/^Celular \(WhatsApp\)/) as HTMLInputElement
    // Se edita sin el +51, que el campo ya dibuja delante.
    expect(campo.value).toBe('987 654 321')

    fireEvent.change(campo, { target: { value: '812 345 678' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(
      await screen.findByText(
        'Escribe un celular de 9 cifras que empiece por 9, o el número completo con su prefijo',
      ),
    ).toBeTruthy()
    expect(api.cambiarCelular).not.toHaveBeenCalled()

    fireEvent.change(campo, { target: { value: '912 345 678' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(api.cambiarCelular).toHaveBeenCalledWith('912 345 678'))
    expect(await screen.findByText('+51 912 345 678')).toBeTruthy()
  })

  it('el número va en una sola pieza, que no se parte entre «+51» y el resto', async () => {
    api.quienSoy.mockResolvedValue({ usuarioId: 1, nombre: 'Ana', apellidos: 'Pérez', telefono: '+51987654321' })
    montar()

    expect((await screen.findByText('+51 987 654 321')).tagName).toBe('B')
  })

  describe('al llegar desde «Cámbialo en Mi cuenta» (/perfil#celular)', () => {
    const scrollIntoView = Element.prototype.scrollIntoView
    const bajar = vi.fn()
    beforeEach(() => {
      Element.prototype.scrollIntoView = bajar
    })
    afterEach(() => {
      Element.prototype.scrollIntoView = scrollIntoView
      bajar.mockReset()
    })

    it('abre el campo con su número, baja hasta el bloque y pone el foco dentro', async () => {
      api.quienSoy.mockResolvedValue({ usuarioId: 1, nombre: 'Ana', apellidos: 'Pérez', telefono: '+51987654321' })
      const { container } = montar(`/perfil#${ANCLA_CELULAR}`)

      const campo = (await screen.findByLabelText(/^Celular \(WhatsApp\)/)) as HTMLInputElement
      expect(campo.value).toBe('987 654 321')
      await waitFor(() => expect(document.activeElement).toBe(campo))
      // Se baja hasta el bloque entero —el título a la vista—, no solo hasta el campo.
      const bloque = container.querySelector(`#${ANCLA_CELULAR}`)
      expect(bloque?.tagName).toBe('SECTION')
      expect(bajar.mock.contexts).toContain(bloque)
    })

    it('«Cancelar» lo cierra y no se vuelve a abrir solo', async () => {
      api.quienSoy.mockResolvedValue({ usuarioId: 1, nombre: 'Ana', apellidos: 'Pérez', telefono: '+51987654321' })
      montar(`/perfil#${ANCLA_CELULAR}`)

      await screen.findByLabelText(/^Celular \(WhatsApp\)/)
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

      expect(await screen.findByRole('button', { name: 'Cambiar' })).toBeTruthy()
      expect(screen.queryByLabelText(/^Celular \(WhatsApp\)/)).toBeNull()
    })

    it('sin el ancla, el perfil se abre con el número a la vista y el campo cerrado', async () => {
      api.quienSoy.mockResolvedValue({ usuarioId: 1, nombre: 'Ana', apellidos: 'Pérez', telefono: '+51987654321' })
      montar('/perfil')

      expect(await screen.findByRole('button', { name: 'Cambiar' })).toBeTruthy()
      expect(screen.queryByLabelText(/^Celular \(WhatsApp\)/)).toBeNull()
      expect(bajar).not.toHaveBeenCalled()
    })
  })
})
