/**
 * «Reseñas reportadas» (V63): solo para la plataforma, con las dos listas, la
 * reseña encima cuando lo que se juzga es la respuesta, y la nota obligatoria
 * para mantener u ocultar.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ErrorApi } from '../api/cliente'
import type { ReporteParaModerar } from '../api/tipos'
import { ResenasReportadas } from './ResenasReportadas'

const api = vi.hoisted(() => ({
  reportesDeResenas: vi.fn(),
  resolverReporte: vi.fn(),
}))
vi.mock('../api/resenas', () => api)

const hace = (dias: number) => new Date(Date.now() - dias * 86_400_000).toISOString()

const reporte = (extra: Partial<ReporteParaModerar>): ReporteParaModerar => ({
  id: 1,
  objeto: 'RESENA',
  empresa: 'Constructora Andina',
  persona: 'Luis Perez',
  estrellas: 1,
  textoResena: 'Llegaba tarde y hablaba mal de sus compañeros de obra.',
  textoRespuesta: null,
  motivo: 'DATOS_PERSONALES',
  comentario: 'Habla de mi salud',
  reportadoEn: hace(2),
  estado: 'PENDIENTE',
  resueltoEn: null,
  notaRevision: null,
  ...extra,
})

function pintar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={cliente}>
      <ResenasReportadas />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset())
})
afterEach(cleanup)

describe('las reseñas reportadas', () => {
  it('AC-22: sin la doble llave (403) la sección no existe', async () => {
    api.reportesDeResenas.mockRejectedValue(new ErrorApi(403, 'Permiso denegado'))
    const { container } = pintar()

    await waitFor(() => expect(api.reportesDeResenas).toHaveBeenCalled())
    await waitFor(() => expect(container.textContent).toBe(''))
  })

  it('las pendientes dicen qué se reporta, de quién a quién, el motivo y el comentario', async () => {
    api.reportesDeResenas.mockResolvedValue([
      reporte({}),
      reporte({
        id: 2,
        objeto: 'RESPUESTA',
        textoRespuesta: 'No es cierto, cumplí cada turno que se me asignó.',
        motivo: 'FALSA',
        comentario: null,
      }),
    ])
    pintar()

    expect(await screen.findByRole('button', { name: 'Pendientes (2)' })).toBeTruthy()
    const [deLaResena, deLaRespuesta] = screen.getAllByRole('article')
    expect(within(deLaResena!).getByText('Constructora Andina → Luis Perez')).toBeTruthy()
    expect(within(deLaResena!).getByText('Revela datos personales o de salud')).toBeTruthy()
    expect(within(deLaResena!).getByText('«Habla de mi salud»')).toBeTruthy()
    // En la de la respuesta, la reseña va de contexto y la respuesta es lo juzgado,
    // con el motivo en las palabras de la empresa.
    expect(within(deLaRespuesta!).getByText('Respuesta')).toBeTruthy()
    expect(within(deLaRespuesta!).getByText(/No es cierto/)).toBeTruthy()
    expect(within(deLaRespuesta!).getByText('Es falsa: cuenta hechos que no pasaron')).toBeTruthy()
  })

  it('mantener u ocultar sin nota no se envía; con nota, sí', async () => {
    api.reportesDeResenas.mockResolvedValue([reporte({})])
    api.resolverReporte.mockResolvedValue(reporte({ estado: 'OCULTADA' }))
    pintar()

    fireEvent.click(await screen.findByRole('button', { name: 'Ocultar' }))
    expect(await screen.findByText(/Escribe la nota de la revisión/)).toBeTruthy()
    expect(api.resolverReporte).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Nota de la revisión'), {
      target: { value: 'Revela datos de salud' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar' }))
    await waitFor(() =>
      expect(api.resolverReporte).toHaveBeenCalledWith(1, {
        decision: 'OCULTAR',
        nota: 'Revela datos de salud',
      }),
    )
  })

  it('RES-QA-03: un doble clic en «Ocultar» resuelve una sola vez, y el foco va al título', async () => {
    api.reportesDeResenas.mockResolvedValueOnce([reporte({})]).mockResolvedValue([])
    api.resolverReporte.mockResolvedValue(reporte({ estado: 'OCULTADA' }))
    pintar()

    fireEvent.change(await screen.findByLabelText('Nota de la revisión'), {
      target: { value: 'Revela datos de salud' },
    })
    const ocultar = screen.getByRole('button', { name: 'Ocultar' })
    act(() => {
      ocultar.click()
      ocultar.click()
    })

    expect(await screen.findByText('No hay nada pendiente de revisar.')).toBeTruthy()
    expect(api.resolverReporte).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Reseñas reportadas' }))
  })

  it('las resueltas dicen en qué quedó, y la retirada quién la retiró', async () => {
    api.reportesDeResenas.mockImplementation((resueltos: boolean) =>
      Promise.resolve(
        resueltos
          ? [
              reporte({ id: 3, estado: 'MANTENIDA', resueltoEn: hace(1), notaRevision: 'Cumple' }),
              reporte({ id: 4, estado: 'RETIRADA', resueltoEn: hace(1) }),
            ]
          : [],
      ),
    )
    pintar()

    expect(await screen.findByText('No hay nada pendiente de revisar.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Resueltas' }))
    expect(await screen.findByText('Se mantuvo')).toBeTruthy()
    expect(screen.getByText('Retirada por la empresa')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Ocultar' })).toBeNull()
  })
})
