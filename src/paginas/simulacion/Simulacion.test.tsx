/**
 * La simulación de una vacante que la empresa retiró.
 *
 * Aquí un 404 tiene dos lecturas y la pantalla no puede confundirlas: el de «mi
 * sesión» es lo normal mientras no se eligió fecha —y enseña las fechas—, y el
 * de las fechas es que su proceso ya no existe. Lo decide su proceso, que es la
 * respuesta del backend que sí lo dice.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ErrorApi } from '@/api/cliente'
import type { SesionDisponible } from '@/api/tipos'
import { Simulacion } from './Simulacion'

const verMiSesion = vi.fn()
const verFechas = vi.fn()
const verProceso = vi.fn()
const inscribir = vi.fn()

vi.mock('@/api/simulacion', () => ({
  miSesion: (uuid: string) => verMiSesion(uuid),
  sesionesDisponibles: (uuid: string) => verFechas(uuid),
  inscribirse: (uuid: string, sesionId: number) => inscribir(uuid, sesionId),
}))
vi.mock('@/api/portal', () => ({ verPostulacion: (uuid: string) => verProceso(uuid) }))
vi.mock('@/ui/Avisos', () => ({ useAviso: () => vi.fn() }))

const UUID = 'aa11bb22-cc33-dd44-ee55-ff6677889900'
const noEsta = (mensaje: string) => new ErrorApi(404, mensaje)

const unaFecha: SesionDisponible = {
  id: 9,
  fechaHora: '2026-10-05T15:00:00Z',
  duracionMinutos: 120,
  modalidad: 'PRESENCIAL',
  lugar: 'Oficina central',
  enlace: null,
  plazasLibres: 4,
}

function pintar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={[`/procesos/${UUID}/simulacion`]}>
        <Routes>
          <Route path="/procesos/:uuid/simulacion" element={<Simulacion />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  verMiSesion.mockReset()
  verFechas.mockReset()
  verProceso.mockReset()
  inscribir.mockReset()
  // Sin fecha elegida todavía: el 404 de «mi sesión» es el camino normal.
  verMiSesion.mockRejectedValue(noEsta('Inscripción not found'))
})

afterEach(cleanup)

describe('cuando la empresa retiró la vacante', () => {
  it('dice que la vacante ya no está, sin «Elige tu fecha» ni fechas que elegir', async () => {
    verFechas.mockRejectedValue(noEsta(`Postulación not found with código: '${UUID}'`))
    verProceso.mockRejectedValue(noEsta(`Postulación not found with código: '${UUID}'`))
    pintar()

    expect(
      await screen.findByRole('heading', { name: /Esta vacante ya no está disponible/ }),
    ).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Elige tu fecha.' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Confirmar asistencia' })).toBeNull()
  })

  it('con su vacante viva, el 404 de «mi sesión» sigue enseñando las fechas', async () => {
    verFechas.mockResolvedValue([])
    pintar()

    expect(await screen.findByRole('heading', { name: 'Elige tu fecha.' })).toBeTruthy()
    expect(await screen.findByText('Todavía no hay fechas con cupo')).toBeTruthy()
    // Ni se le preguntó a su proceso: el 404 de «mi sesión» no es una vacante retirada.
    expect(verProceso).not.toHaveBeenCalled()
  })

  /** Con la lista abierta, elige la única fecha y pulsa «Confirmar asistencia». */
  async function confirmarLaFecha() {
    fireEvent.click(await screen.findByRole('radio'))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar asistencia' }))
  }

  it('con la lista abierta, «Confirmar asistencia» con 404 dice que la vacante ya no está', async () => {
    const yaNoExiste = () => noEsta(`Postulación not found with código: '${UUID}'`)
    verFechas.mockResolvedValueOnce([unaFecha]).mockRejectedValue(yaNoExiste())
    // Su proceso tarda en contestar: es el rato en que antes se veía el texto del servidor
    // sobre una lista de fechas que ya no existe.
    let contestar: () => void = () => {}
    verProceso.mockImplementation(
      () => new Promise((_, romper) => { contestar = () => romper(yaNoExiste()) }),
    )
    inscribir.mockRejectedValueOnce(yaNoExiste())
    pintar()

    await confirmarLaFecha()

    await waitFor(() => expect(verProceso).toHaveBeenCalledWith(UUID))
    expect(screen.getByText('Buscando fechas disponibles…')).toBeTruthy()
    expect(screen.queryByText(/not found/)).toBeNull()
    expect(screen.queryByRole('radio')).toBeNull()

    contestar()
    expect(
      await screen.findByRole('heading', { name: /Esta vacante ya no está disponible/ }),
    ).toBeTruthy()
    expect(screen.queryByText(/not found/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Confirmar asistencia' })).toBeNull()
  })

  it('con su vacante viva, un 404 al confirmar se dice sobre la lista recargada', async () => {
    verFechas.mockResolvedValue([unaFecha])
    inscribir.mockRejectedValueOnce(noEsta('Sesión not found with id: 9'))
    pintar()

    await confirmarLaFecha()

    expect((await screen.findByRole('alert')).textContent).toMatch(/Sesión not found/)
    expect(screen.queryByRole('heading', { name: /Esta vacante ya no está disponible/ })).toBeNull()
    expect(verFechas).toHaveBeenCalledTimes(2)
    expect(verProceso).not.toHaveBeenCalled()
  })
})
