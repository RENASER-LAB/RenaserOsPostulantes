/**
 * Contratar desde la ficha del postulante (V64): la decisión en verde, con
 * motivo, avisando de las etapas que se salta y sin correo. Y después, dar de
 * alta o ver la ficha de colaborador.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ErrorApi } from '../api/cliente'
import { ContratarDesdeLaFicha } from './ContratarDesdeLaFicha'

const contratar = vi.fn<(id: number, motivo: string) => Promise<void>>()
vi.mock('../api/colaboradores', () => ({ contratar: (id: number, motivo: string) => contratar(id, motivo) }))

const alContratar = vi.fn()

function montar(props: Partial<Parameters<typeof ContratarDesdeLaFicha>[0]> = {}) {
  const datos = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={datos}>
      <MemoryRouter>
        <ContratarDesdeLaFicha
          postulacionId={40}
          candidato="Carla De la Cruz"
          vacante="Asistente contable"
          etapa="Prueba del puesto"
          enDecision={false}
          puedeContratar
          contratado={false}
          colaboradorId={null}
          puedeDarDeAlta={false}
          puedeVerColaborador={false}
          alContratar={alContratar}
          {...props}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  contratar.mockResolvedValue(undefined)
})

afterEach(cleanup)

describe('el botón y el modal', () => {
  it('sin decidir_contratacion no hay botón (AC-12)', () => {
    montar({ puedeContratar: false })
    expect(screen.queryByRole('button', { name: 'Contratar' })).toBeNull()
  })

  it('avisa de la etapa que se salta, exige motivo y dice que no sale correo (AC-11)', async () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Contratar' }))
    const modal = await screen.findByRole('dialog', { name: 'Contratar a Carla De la Cruz' })
    expect(within(modal).getByText('Asistente contable')).toBeTruthy()
    expect(
      within(modal).getByText(
        'Todavía está en la etapa Prueba del puesto. Contratar cierra su proceso aquí, sin pasar por las etapas que faltan.',
      ),
    ).toBeTruthy()
    expect(within(modal).getByText('No se le envía ningún correo.')).toBeTruthy()

    fireEvent.click(within(modal).getByRole('button', { name: 'Contratar' }))
    expect(contratar).not.toHaveBeenCalled()
    expect(within(modal).getByText(/Escribe por qué se contrata/)).toBeTruthy()

    fireEvent.change(within(modal).getByLabelText('Motivo'), { target: { value: 'Resolvió el caso' } })
    fireEvent.click(within(modal).getByRole('button', { name: 'Contratar' }))
    await waitFor(() => expect(contratar).toHaveBeenCalledWith(40, 'Resolvió el caso'))
    await waitFor(() => expect(alContratar).toHaveBeenCalled())
    expect(await screen.findByText('Carla De la Cruz quedó contratado.')).toBeTruthy()
  })

  it('en la etapa Decisión no hay aviso de etapas saltadas', async () => {
    montar({ enDecision: true, etapa: 'Decisión' })
    fireEvent.click(screen.getByRole('button', { name: 'Contratar' }))
    const modal = await screen.findByRole('dialog')
    expect(within(modal).queryByText(/Todavía está en la etapa/)).toBeNull()
  })

  it('si falla, el modal conserva el motivo y lo explica; no admite un segundo clic mientras envía', async () => {
    let soltar: (v?: unknown) => void = () => {}
    contratar.mockImplementationOnce(() => new Promise((_, rechazar) => (soltar = () => rechazar(new ErrorApi(409, 'x')))))
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Contratar' }))
    const modal = await screen.findByRole('dialog')
    fireEvent.change(within(modal).getByLabelText('Motivo'), { target: { value: 'Entra en noviembre' } })
    fireEvent.click(within(modal).getByRole('button', { name: 'Contratar' }))
    const enviando = await within(modal).findByRole('button', { name: 'Contratando…' })
    expect((enviando as HTMLButtonElement).disabled).toBe(true)
    soltar()
    expect(await within(modal).findByText(/ya terminó su recorrido/)).toBeTruthy()
    expect((within(modal).getByLabelText('Motivo') as HTMLTextAreaElement).value).toBe('Entra en noviembre')
    expect(contratar).toHaveBeenCalledTimes(1)
  })
})

describe('una postulación Contratado (AC-13)', () => {
  it('sin ficha y con editar_colaboradores ofrece «Dar de alta como colaborador» precargado', () => {
    montar({ contratado: true, puedeDarDeAlta: true })
    expect(screen.getByRole('link', { name: 'Dar de alta como colaborador' }).getAttribute('href')).toBe(
      '/admin/colaboradores/nuevo?postulacion=40',
    )
  })

  it('con ficha y ver_colaboradores enlaza «Ver su ficha de colaborador»', () => {
    montar({ contratado: true, colaboradorId: 9, puedeVerColaborador: true })
    expect(screen.getByRole('link', { name: 'Ver su ficha de colaborador' }).getAttribute('href')).toBe(
      '/admin/colaboradores/9',
    )
  })

  it('sin ninguno de los dos permisos no pinta nada', () => {
    const { container } = montar({ contratado: true })
    expect(container.textContent).toBe('')
  })
})
