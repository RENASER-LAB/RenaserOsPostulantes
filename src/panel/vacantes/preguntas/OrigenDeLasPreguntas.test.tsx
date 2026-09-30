/**
 * «Qué responderá quien postule» (V66): el banco del nivel solo se ofrece si es
 * propio, y el prestado de RENASER se llama por su nombre.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { VacantePanel } from '../../api/tipos'
import { OrigenDeLasPreguntas } from './OrigenDeLasPreguntas'

const elegir = vi.fn()
vi.mock('../../api/preguntasPropias', async (original) => ({
  ...(await original<typeof import('../../api/preguntasPropias')>()),
  elegirOrigenDePreguntas: (id: number, origen: string) => elegir(id, origen),
  verPreguntasPropias: () =>
    Promise.resolve({ resumen: { estado: 'BORRADOR', puntos: 68, criterios: 2, preguntas: 5 } }),
}))

const vacante = (parte: Partial<VacantePanel>) => ({ id: 40, aplicaEvaluacion: true, ...parte }) as VacantePanel

function pintar(v: VacantePanel) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <OrigenDeLasPreguntas vacante={v} alCambiar={vi.fn()} alFallar={vi.fn()} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

describe('las opciones', () => {
  it('sin banco propio: «Sin evaluación» y «Preguntas propias», y ningún banco (AC-01)', async () => {
    pintar(vacante({ origenPreguntas: 'VACANTE', bancoDelNivelPropio: false, bancoPrestado: false }))
    expect(screen.getByRole('radio', { name: 'Preguntas propias de esta vacante' })).toHaveProperty('checked', true)
    expect(screen.getByRole('radio', { name: 'Sin evaluación' })).toBeTruthy()
    expect(screen.queryByRole('radio', { name: /banco/ })).toBeNull()
    // Con preguntas propias, su estado y el enlace al editor
    expect(await screen.findByText(/Borrador · 68 de 100 puntos/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Escribir las preguntas →' }).getAttribute('href')).toBe(
      '/admin/vacantes/40/preguntas',
    )
  })

  it('con banco propio: se ofrecen las tres, y el banco dice que es de la empresa (AC-01b)', () => {
    pintar(vacante({ origenPreguntas: 'NIVEL', bancoDelNivelPropio: true, bancoPrestado: false }))
    expect(screen.getByRole('radio', { name: 'El banco de la empresa para su nivel' })).toHaveProperty('checked', true)
    expect(screen.getAllByRole('radio')).toHaveLength(3)
  })

  it('la que rinde el banco prestado lo llama por su nombre y avisa de que no vuelve (AC-01c)', () => {
    pintar(vacante({ origenPreguntas: 'NIVEL', bancoDelNivelPropio: false, bancoPrestado: true }))
    expect(screen.getByRole('radio', { name: 'El banco de RENASER para su nivel' })).toHaveProperty('checked', true)
    expect(screen.getByText(/no se puede volver a elegir/)).toBeTruthy()
  })

  it('elegir otra opción la manda al servidor', async () => {
    elegir.mockResolvedValue(undefined)
    pintar(vacante({ origenPreguntas: 'NIVEL', bancoDelNivelPropio: true }))
    fireEvent.click(screen.getByRole('radio', { name: 'Sin evaluación' }))
    await waitFor(() => expect(elegir).toHaveBeenCalledWith(40, 'SIN_EVALUACION'))
  })
})
