/**
 * Recomendaciones por IA: lo que no se ve compilando.
 *
 *   1. **La propuesta se enseña y el borrador no cambia** hasta que alguien
 *      pulsa un «Agregar» (AC-13).
 *   2. **Una propuesta fallida se dice**, con su motivo, y no ofrece nada que
 *      agregar (AC-14).
 *   3. **Con la IA apagada no se encola**, y se dice en tono de estado.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { EstadoDeLaRecomendacion } from '../../api/preguntasPropias'
import { Recomendaciones } from './Recomendaciones'
import { ConModoDelEditor, MODO_PRUEBA } from './modo'

const ver = vi.fn()
const pedir = vi.fn()
const agregar = vi.fn()
vi.mock('../../api/preguntasPropias', async (original) => ({
  ...(await original<typeof import('../../api/preguntasPropias')>()),
  verRecomendacion: (id: number) => ver(id),
  pedirRecomendaciones: (id: number, indicacion: string | null) => pedir(id, indicacion),
  agregarDeLaPropuesta: (id: number, propuestaId: number, datos: unknown) => agregar(id, propuestaId, datos),
}))

const alAgregar = vi.fn()

function pintar() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <Recomendaciones
        vacanteId={40}
        total={50}
        criterios={[
          { id: 8, nombre: 'Manejo de Excel', queEvalua: null, orden: 2, puntos: 0, puntosSistema: 0, puntosIa: 0, preguntas: [] },
        ]}
        alAgregar={alAgregar}
        alCerrar={vi.fn()}
      />
    </QueryClientProvider>,
  )
}

const lista: EstadoDeLaRecomendacion = {
  estado: 'LISTA',
  motivo: null,
  propuestaId: 77,
  puntosQueFaltan: 50,
  indicacion: 'énfasis en Excel',
  propuesta: [
    {
      criterioExistenteId: 8,
      nombre: null,
      queEvalua: null,
      preguntas: [
        {
          tipo: 'OPCION_UNICA',
          enunciado: '¿Qué función busca un valor en otra tabla?',
          puntos: 10,
          queDebeTener: null,
          opciones: [
            { texto: 'BUSCARV', puntos: 10 },
            { texto: 'SUMA', puntos: 0 },
          ],
        },
        { tipo: 'ABIERTA', enunciado: '¿Cómo armas una tabla dinámica?', puntos: 20, queDebeTener: 'Filas y filtro', opciones: [] },
      ],
    },
    {
      criterioExistenteId: null,
      nombre: 'Orden',
      queEvalua: 'Cómo organiza su trabajo',
      preguntas: [{ tipo: 'ABIERTA', enunciado: '¿Cómo priorizas los cierres?', puntos: 20, queDebeTener: null, opciones: [] }],
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
})
afterEach(cleanup)

describe('la propuesta (AC-13)', () => {
  it('se enseña entera y no toca el borrador hasta pulsar «Agregar»', async () => {
    ver.mockResolvedValue(lista)
    agregar.mockResolvedValue({ vacanteId: 40 })
    pintar()

    expect(await screen.findByText('Para «Manejo de Excel»')).toBeTruthy()
    expect(screen.getByText('Orden')).toBeTruthy()
    expect(screen.getByText('¿Qué función busca un valor en otra tabla?')).toBeTruthy()
    expect(screen.getByText('¿Cómo priorizas los cierres?')).toBeTruthy()
    expect(screen.getByText(/Propuesta para 50 puntos/)).toBeTruthy()
    expect(agregar).not.toHaveBeenCalled()
    expect(alAgregar).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Agregar todo' }))
    await waitFor(() => expect(alAgregar).toHaveBeenCalledWith({ vacanteId: 40 }))
    expect(agregar).toHaveBeenCalledWith(40, 77, { criterios: [0, 1], preguntas: [] })
  })

  it('una pregunta suelta se agrega sola, por su posición', async () => {
    ver.mockResolvedValue(lista)
    agregar.mockResolvedValue({ vacanteId: 40 })
    pintar()

    const [primera] = await screen.findAllByRole('button', { name: 'Agregar' })
    fireEvent.click(primera!)
    await waitFor(() => expect(agregar).toHaveBeenCalled())
    expect(agregar).toHaveBeenCalledWith(40, 77, { criterios: [], preguntas: [{ criterio: 0, pregunta: 0 }] })
  })
})

describe('cuando no hay propuesta', () => {
  it('si la IA falló dos veces se dice con su motivo, y no hay nada que agregar (AC-14)', async () => {
    ver.mockResolvedValue({
      estado: 'FALLIDA',
      motivo: 'La IA no devolvió una propuesta válida, ni al corregirla: las preguntas suman 30 y faltaban 50',
      propuestaId: 5,
      puntosQueFaltan: 50,
      indicacion: null,
      propuesta: [],
    } satisfies EstadoDeLaRecomendacion)
    pintar()

    const alerta = await screen.findByRole('alert')
    expect(alerta.textContent).toContain('La IA no pudo proponer nada esta vez.')
    expect(alerta.textContent).toContain('suman 30')
    expect(screen.queryByRole('button', { name: 'Agregar todo' })).toBeNull()
  })

  it('con la IA apagada no se encola y se dice como estado, no como error', async () => {
    ver.mockResolvedValue({
      estado: 'SIN_PEDIR',
      motivo: null,
      propuestaId: null,
      puntosQueFaltan: null,
      indicacion: null,
      propuesta: [],
    } satisfies EstadoDeLaRecomendacion)
    pedir.mockResolvedValue({
      encolada: false,
      mensaje: 'La IA está apagada en este sistema: ahora no se puede usar. No se pidieron recomendaciones.',
    })
    pintar()

    fireEvent.click(await screen.findByRole('button', { name: 'Pedir recomendaciones' }))
    const estado = await screen.findByRole('status')
    expect(estado.textContent).toContain('La IA está apagada')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(pedir).toHaveBeenCalledWith(40, null)
  })
})

describe('la propuesta de la prueba (V69)', () => {
  const cerrada = (puntos: number) => ({
    tipo: 'OPCION_UNICA' as const,
    enunciado: `¿Una cerrada de ${puntos}?`,
    puntos,
    queDebeTener: null,
    opciones: [{ texto: 'Sí', puntos }, { texto: 'No', puntos: 0 }],
  })
  const abierta = { tipo: 'ABIERTA' as const, enunciado: '¿Cómo cierras el mes?', puntos: 0, queDebeTener: 'Los pasos', opciones: [] }

  it('un criterio nuevo dice lo que vale y quién califica el resto; uno del borrador sigue valiendo lo mismo', async () => {
    ver.mockResolvedValue({
      ...lista,
      propuesta: [
        { criterioExistenteId: 8, nombre: null, queEvalua: null, preguntas: [cerrada(10)] },
        { criterioExistenteId: null, nombre: 'Cierre', queEvalua: null, puntos: 30, parteCalificada: 20, calificador: 'PERSONA', preguntas: [cerrada(10), abierta] },
        // Una propuesta de antes de la V69: solo la parte calificada; vale su cerrada más ella.
        { criterioExistenteId: null, nombre: 'Caja', queEvalua: null, parteCalificada: 15, calificador: 'IA', preguntas: [cerrada(5), abierta] },
        { criterioExistenteId: null, nombre: 'Solo cerradas', queEvalua: null, puntos: 20, preguntas: [cerrada(20)] },
        // QA-10: con parte calificada y sin quién la califique no se da por hecha la IA.
        { criterioExistenteId: null, nombre: 'Sin quién', queEvalua: null, puntos: 25, calificador: null, preguntas: [cerrada(5), abierta] },
      ],
    } satisfies EstadoDeLaRecomendacion)
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <ConModoDelEditor modo={MODO_PRUEBA}>
          <Recomendaciones
            vacanteId={40}
            total={50}
            criterios={[
              { id: 8, nombre: 'Manejo de Excel', queEvalua: null, orden: 2, puntos: 25, puntosSistema: 0, puntosIa: 25, puntosCalificados: 25, calificador: 'IA', preguntas: [] },
            ]}
            alAgregar={alAgregar}
            alCerrar={vi.fn()}
          />
        </ConModoDelEditor>
      </QueryClientProvider>,
    )
    const excel = (await screen.findByText('Para «Manejo de Excel»')).closest('article')!
    expect(excel.textContent).toContain('sigue valiendo 25 pts')
    expect(excel.textContent).toContain('Sus cerradas nuevas suman 10 y salen de lo que ya califican la IA o una persona.')
    const cierre = screen.getByText('Cierre').closest('article')!
    expect(cierre.textContent).toContain('30 pts')
    expect(cierre.textContent).toContain('Sus cerradas suman 10. Los otros 20 los califica una persona mirando sus abiertas y archivos.')
    const caja = screen.getByText('Caja').closest('article')!
    expect(caja.textContent).toContain('20 pts')
    expect(caja.textContent).toContain('Los otros 15 los califica la IA')
    expect(screen.getByText('Solo cerradas').closest('article')!.textContent).toContain(
      'Sus cerradas suman 20. Todo lo puntúa el sistema.',
    )
    const sinQuien = screen.getByText('Sin quién').closest('article')!.textContent
    expect(sinQuien).toContain('Sus cerradas suman 5. Los otros 20 no tienen quién los califique: falta decirlo.')
    expect(sinQuien).not.toMatch(/los califica (la IA|una persona)/)
  })
})
