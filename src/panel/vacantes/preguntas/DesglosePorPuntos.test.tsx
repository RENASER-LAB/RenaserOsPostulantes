/**
 * El desglose de las preguntas propias en la ficha: cada criterio con de dónde
 * sale su nota, lo pendiente sin nota parcial, y el ajuste a mano solo para quien
 * tiene `ajustar_nota` (el dato viaja en el desglose).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { CriterioDelDesglose, DesglosePorPuntos as Desglose, PreguntaDelDesglose } from '../../api/tipos'
import { DesglosePorPuntos, deDondeSale } from './DesglosePorPuntos'

const ajustar = vi.fn()
vi.mock('../../api/preguntasPropias', async (original) => ({
  ...(await original<typeof import('../../api/preguntasPropias')>()),
  ajustarNotaDeAbierta: (p: number, r: number, d: { puntaje: number; motivo: string }) => ajustar(p, r, d),
}))

const pregunta = (parte: Partial<PreguntaDelDesglose>): PreguntaDelDesglose => ({
  preguntaId: 1,
  respuestaId: 101,
  tipo: 'ABIERTA',
  enunciado: 'Cuéntanos un cierre con un descuadre',
  maximo: 20,
  obtenido: 12,
  pendiente: false,
  respuesta: 'En marzo el mayor no cuadraba por 1.200 soles',
  opcionesElegidas: [],
  explicacion: 'Explica el caso pero no dice en cuántos días lo cerró',
  evidenciaCitada: '1.200 soles',
  puntajeIa: null,
  ajustada: false,
  ajustadaPor: null,
  ajustadaEn: null,
  motivoAjuste: null,
  sinPuntos: false,
  ...parte,
})

const criterio = (parte: Partial<CriterioDelDesglose>): CriterioDelDesglose => ({
  id: 5,
  nombre: 'Conocimiento contable',
  queEvalua: null,
  maximo: 30,
  nota: 20,
  sistema: 8,
  sistemaMaximo: 10,
  ia: 12,
  iaMaximo: 20,
  pendiente: false,
  preguntas: [
    pregunta({ preguntaId: 2, respuestaId: 102, tipo: 'OPCION_UNICA', enunciado: '¿Qué libro?', maximo: 10, obtenido: 8, respuesta: null, opcionesElegidas: ['Libro diario'], explicacion: null }),
    pregunta({}),
  ],
  ...parte,
})

const desglose = (parte: Partial<Desglose>): Desglose => ({
  total: 20,
  completo: true,
  puedeAjustar: true,
  recalificacion: null,
  motivoRecalificacion: null,
  criterios: [criterio({})],
  sinCriterio: [],
  ...parte,
})

function pintar(d: Desglose) {
  const cliente = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  render(
    <QueryClientProvider client={cliente}>
      <DesglosePorPuntos postulacionId={7} desglose={d} />
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

describe('de dónde sale cada punto', () => {
  it('«Sistema 8/10 + IA 12/20», y pendiente mientras falte la abierta (AC-19)', () => {
    expect(deDondeSale(criterio({}))).toBe('Sistema 8/10 + IA 12/20')
    expect(deDondeSale(criterio({ pendiente: true, nota: null }))).toBe('Sistema 8/10 + IA pendiente/20')
  })

  it('un criterio con una abierta sin calificar se ve pendiente, sin nota parcial', () => {
    pintar(desglose({ completo: false, criterios: [criterio({ pendiente: true, nota: null })] }))
    expect(screen.getByText(/pendiente\/30/)).toBeTruthy()
    expect(screen.getByText(/falta la nota de/)).toBeTruthy()
  })
})

describe('ajustar a mano una abierta', () => {
  it('solo la ve quien puede ajustar, y nunca en una cerrada (AC-26)', () => {
    pintar(desglose({ puedeAjustar: false }))
    expect(screen.queryByRole('button', { name: 'Ajustar nota' })).toBeNull()
    cleanup()
    pintar(desglose({}))
    // Una sola: la abierta. La única cerrada no se ajusta.
    expect(screen.getAllByRole('button', { name: 'Ajustar nota' })).toHaveLength(1)
  })

  it('pide nota dentro del máximo y motivo, y manda los dos', async () => {
    ajustar.mockResolvedValue(undefined)
    pintar(desglose({}))
    fireEvent.click(screen.getByRole('button', { name: 'Ajustar nota' }))
    const guardar = screen.getByRole('button', { name: 'Guardar la nota' }) as HTMLButtonElement
    fireEvent.change(screen.getByLabelText('Nota nueva (de 0 a 20)'), { target: { value: '21' } })
    expect(guardar.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Nota nueva (de 0 a 20)'), { target: { value: '16' } })
    expect(guardar.disabled).toBe(true) // sin motivo
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'Sí dio el dato' } })
    fireEvent.click(guardar)
    await waitFor(() => expect(ajustar).toHaveBeenCalledWith(7, 101, { puntaje: 16, motivo: 'Sí dio el dato' }))
  })

  it('la ajustada enseña las dos notas y quién, cuándo y por qué', () => {
    pintar(
      desglose({
        criterios: [
          criterio({
            preguntas: [
              pregunta({ obtenido: 16, puntajeIa: 12, ajustada: true, ajustadaPor: 'Ana Pérez', ajustadaEn: '2026-09-30T15:00:00Z', motivoAjuste: 'Sí dio el dato; la IA no leyó el anexo.' }),
            ],
          }),
        ],
      }),
    )
    expect(screen.getByText(/16\/20/)).toBeTruthy()
    expect(screen.getByText(/Ajustada por Ana Pérez el 30\/09: «Sí dio el dato; la IA no leyó el anexo.»/)).toBeTruthy()
    expect(screen.getByText(/IA 12\/20 · Explica el caso/)).toBeTruthy()
  })

  it('la pendiente se califica a mano', () => {
    pintar(desglose({ completo: false, criterios: [criterio({ pendiente: true, preguntas: [pregunta({ obtenido: null, pendiente: true, explicacion: null })] })] }))
    expect(screen.getByRole('button', { name: 'Calificar a mano' })).toBeTruthy()
    expect(screen.getByText('Pendiente de la IA.')).toBeTruthy()
  })
})
