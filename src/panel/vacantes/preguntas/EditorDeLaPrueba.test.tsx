/**
 * El editor en modo prueba (V67): el mismo de las preguntas propias, con el
 * caso, el tiempo, los entregables y la parte calificada.
 *
 *   - Habla con `/prueba-propia`, no con `/preguntas-propias`.
 *   - Vacío: «Todavía no hay prueba» con sus tres entradas.
 *   - Un criterio mixto dice «30 pts · sistema 10 + IA 20» y qué mira (AC-05).
 *   - Una abierta no lleva puntos ni se le piden (AC-05).
 *   - Sin entregables es un cuestionario (AC-06).
 *   - El 400 de publicar es la lista entera (AC-04).
 *   - Sin permiso de editar, en lectura y sin botones (AC-28).
 *   - Quitar un entregable que miran los criterios pide confirmarlo.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ErrorApi } from '../../api/cliente'
import type {
  EditorDePreguntas as Editor,
  EntregableDeLaVersion,
  VersionDePreguntas,
} from '../../api/preguntasPropias'
import { EditorDeLaPrueba } from './EditorDeLaPrueba'

const ver = vi.fn()
const publicar = vi.fn()
const agregarPregunta = vi.fn()
const verRecomendacion = vi.fn()
const listarCopiables = vi.fn()
const quitarEntregable = vi.fn()
const agregarEntregable = vi.fn()

vi.mock('../../api/preguntasPropias', async (original) => ({
  ...(await original<typeof import('../../api/preguntasPropias')>()),
  verPreguntasPropias: (id: number, ruta?: string) => ver(id, ruta),
  publicarPreguntas: (id: number, ruta?: string) => publicar(id, ruta),
  agregarPregunta: (id: number, datos: unknown, ruta?: string) => agregarPregunta(id, datos, ruta),
  verRecomendacion: (id: number, ruta?: string) => verRecomendacion(id, ruta),
  listarCopiables: () => listarCopiables(),
}))

vi.mock('../../api/pruebaPropia', async (original) => ({
  ...(await original<typeof import('../../api/pruebaPropia')>()),
  quitarEntregable: (id: number, entregableId: number) => quitarEntregable(id, entregableId),
  agregarEntregable: (id: number, datos: unknown) => agregarEntregable(id, datos),
}))

const tablero: EntregableDeLaVersion = {
  id: 301,
  nombre: 'Tablero.xlsx',
  detalle: 'La conciliación de marzo',
  formato: 'ARCHIVO',
  obligatorio: true,
  queDebeTener: 'El descuadre ubicado',
  orden: 1,
  criterios: [5],
}

const version = (parte: Partial<VersionDePreguntas> = {}): VersionDePreguntas => ({
  id: 70,
  estado: 'BORRADOR',
  guiaCalificacion: null,
  minutosObjetivo: null,
  versionGuia: 1,
  total: 30,
  cuantosCriterios: 1,
  cuantasPreguntas: 2,
  criterios: [
    {
      id: 5,
      nombre: 'Conocimiento contable',
      queEvalua: 'El cierre mensual',
      orden: 1,
      puntos: 30,
      puntosSistema: 10,
      puntosIa: 0,
      puntosCalificados: 20,
      calificador: 'IA',
      entregables: [301],
      preguntas: [
        {
          id: 10,
          tipo: 'OPCION_UNICA',
          enunciado: '¿Qué libro registra primero una venta al crédito?',
          puntos: 10,
          criterioId: 5,
          orden: 1,
          queDebeTener: null,
          opciones: [
            { id: 1, texto: 'Libro diario', puntos: 10, orden: 1 },
            { id: 2, texto: 'Caja', puntos: 0, orden: 2 },
          ],
        },
        {
          id: 11,
          tipo: 'ABIERTA',
          enunciado: '¿Cómo hallaste el descuadre?',
          puntos: 0,
          criterioId: 5,
          orden: 2,
          queDebeTener: 'La cuenta y el monto',
          opciones: [],
        },
      ],
    },
  ],
  sinCriterio: [],
  avisos: ['Los puntos suman 30 de 100: faltan 70.'],
  prueba: {
    enunciado: 'La empresa cerró marzo con un descuadre.',
    consigna: null,
    materiales: null,
    herramientasPermitidas: 'Excel',
    modalidad: 'CRONOMETRADA',
    duracionMinutos: 90,
    plazoDias: null,
    cuestionario: false,
    entregables: [tablero],
  },
  ...parte,
})

const editor = (parte: Partial<Editor> = {}): Editor => ({
  vacanteId: 40,
  titulo: 'Asistente contable',
  nivel: 'EJECUCION',
  origen: 'PRUEBA_PROPIA',
  aplicaEvaluacion: true,
  puedeEditar: true,
  hayPostulantes: false,
  borrador: version(),
  publicada: null,
  resumen: { estado: 'BORRADOR', puntos: 30, criterios: 1, preguntas: 2, entregables: 1 },
  recalificacion: null,
  proposito: 'PRUEBA_PUESTO',
  ...parte,
})

function pintar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={['/admin/vacantes/40/prueba']}>
        <Routes>
          <Route path="/admin/vacantes/:id/prueba" element={<EditorDeLaPrueba />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  listarCopiables.mockResolvedValue([])
  verRecomendacion.mockResolvedValue({
    estado: 'SIN_PEDIR',
    motivo: null,
    propuestaId: null,
    puntosQueFaltan: null,
    indicacion: null,
    propuesta: [],
  })
})
afterEach(cleanup)

describe('el editor en modo prueba', () => {
  it('habla con la prueba de la vacante, no con sus preguntas propias', async () => {
    ver.mockResolvedValue(editor())
    pintar()
    expect(await screen.findByRole('heading', { level: 1, name: /Asistente contable · Prueba técnica/ })).toBeTruthy()
    expect(ver).toHaveBeenCalledWith(40, 'prueba-propia')
  })

  it('vacío: «Todavía no hay prueba» con agregar, recomendar y copiar', async () => {
    ver.mockResolvedValue(
      editor({
        borrador: null,
        resumen: { estado: 'SIN_PRUEBA', puntos: null, criterios: null, preguntas: null },
      }),
    )
    pintar()
    expect(await screen.findByText('Todavía no hay prueba')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Agregar criterio' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Recomendaciones por IA' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Copiar de otra vacante' })).toBeTruthy()
  })

  it('un criterio mixto dice su reparto y qué mira; la abierta no lleva puntos (AC-05)', async () => {
    ver.mockResolvedValue(editor())
    pintar()
    expect(await screen.findByText('30 pts · sistema 10 + IA 20')).toBeTruthy()
    const bloque = screen.getByRole('region', { name: 'Criterio Conocimiento contable' })
    expect(within(bloque).getByText(/Parte calificada:/).closest('p')!.textContent).toMatch(
      /20 pts · la califica la IA · Mira: Tablero\.xlsx/,
    )
    // La cerrada lleva su chip de puntos; la abierta, no.
    expect(within(bloque).getAllByText(/^\d+ pts$/)).toHaveLength(1)
    // El entregable, con qué criterio lo mira.
    const entregables = screen.getByRole('region', { name: 'Los entregables' })
    expect(within(entregables).getByText('Tablero.xlsx')).toBeTruthy()
    expect(within(entregables).getByText('Lo mira: Conocimiento contable.')).toBeTruthy()
    // El caso y el tiempo.
    expect((screen.getByLabelText(/^Enunciado/) as HTMLTextAreaElement).value).toBe(
      'La empresa cerró marzo con un descuadre.',
    )
    expect((screen.getByLabelText('Minutos') as HTMLInputElement).value).toBe('90')
  })

  it('al agregar una abierta no se piden puntos, y va a la prueba', async () => {
    ver.mockResolvedValue(editor())
    agregarPregunta.mockResolvedValue(editor())
    pintar()
    const bloque = await screen.findByRole('region', { name: 'Criterio Conocimiento contable' })
    fireEvent.click(within(bloque).getByRole('button', { name: 'Agregar pregunta' }))
    expect(screen.queryByLabelText('Puntos')).toBeNull()
    fireEvent.change(screen.getByLabelText('Enunciado'), { target: { value: 'Explica tu cierre' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar la pregunta' }))
    await waitFor(() => expect(agregarPregunta).toHaveBeenCalled())
    expect(agregarPregunta.mock.calls[0]![1]).toMatchObject({ tipo: 'ABIERTA', puntos: 0, criterioId: 5 })
    expect(agregarPregunta.mock.calls[0]![2]).toBe('prueba-propia')
  })

  it('sin entregables es un cuestionario (AC-06)', async () => {
    ver.mockResolvedValue(
      editor({
        borrador: version({ prueba: { ...version().prueba!, cuestionario: true, entregables: [] } }),
      }),
    )
    pintar()
    expect(await screen.findByRole('heading', { level: 1, name: /· Cuestionario/ })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Publicar el cuestionario' }).length).toBeGreaterThan(0)
    expect(screen.getByText('(opcional en un cuestionario)')).toBeTruthy()
    // El balance se anuncia con su artículo: «del cuestionario», no «de la cuestionario»
    expect(screen.getByRole('region', { name: 'Balance del cuestionario' })).toBeTruthy()
  })

  it('con entregables, el balance es el de la prueba', async () => {
    ver.mockResolvedValue(editor({ borrador: version() }))
    pintar()
    expect(await screen.findByRole('region', { name: 'Balance de la prueba' })).toBeTruthy()
  })

  it('el 400 de publicar se pinta entero (AC-04)', async () => {
    ver.mockResolvedValue(editor())
    publicar.mockRejectedValue(
      new ErrorApi(400, 'La prueba no se puede publicar todavía: faltan 4 cosas', {
        faltas: [
          'Los puntos suman 90 de 100: faltan 10.',
          'El entregable «Video» no está en ningún criterio.',
          'El criterio «Comunicación» es de la IA y solo mira enlaces.',
          'Falta el enunciado del caso: hay entregables.',
        ],
      }),
    )
    pintar()
    const [boton] = await screen.findAllByRole('button', { name: 'Publicar la prueba' })
    fireEvent.click(boton!)
    await waitFor(() => expect(publicar).toHaveBeenCalledWith(40, 'prueba-propia'))
    const alertas = await screen.findAllByRole('alert')
    const lista = alertas.find((a) => a.textContent?.includes('Faltan 4 cosas'))
    expect(lista).toBeTruthy()
    expect(within(lista!).getAllByRole('listitem')).toHaveLength(4)
  })

  it('sin permiso de editar, en lectura y sin botones que acaben en 403 (AC-28)', async () => {
    ver.mockResolvedValue(editor({ puedeEditar: false }))
    pintar()
    expect(await screen.findByText(/cambiarla pide el permiso de editar esta vacante/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Publicar la prueba' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Agregar criterio' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Agregar entregable' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Agregar pregunta' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Quitar el entregable/ })).toBeNull()
    expect(screen.queryByText('Subir PDF o Word')).toBeNull()
    expect((screen.getByLabelText(/^Enunciado/) as HTMLTextAreaElement).readOnly).toBe(true)
  })

  it('quitar un entregable que mira un criterio pide confirmarlo', async () => {
    ver.mockResolvedValue(editor())
    quitarEntregable.mockResolvedValue(editor())
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: 'Quitar el entregable Tablero.xlsx' }))
    expect(quitarEntregable).not.toHaveBeenCalled()
    const confirmar = screen.getByRole('alertdialog', { name: 'Quitar el entregable' })
    expect(confirmar.textContent).toMatch(/Lo mira «Conocimiento contable»/)
    fireEvent.click(within(confirmar).getByRole('button', { name: 'Quitar el entregable' }))
    await waitFor(() => expect(quitarEntregable).toHaveBeenCalledWith(40, 301))
  })

  it('agregar un entregable manda su formato, si es obligatorio y qué debe tener', async () => {
    ver.mockResolvedValue(editor())
    agregarEntregable.mockResolvedValue(editor())
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar entregable' }))
    const form = screen.getByRole('form', { name: 'Entregable nuevo' })
    fireEvent.change(within(form).getByLabelText('Nombre'), { target: { value: 'Video de 2 min' } })
    fireEvent.change(within(form).getByLabelText('Formato'), { target: { value: 'ENLACE' } })
    fireEvent.click(within(form).getByLabelText(/Obligatorio/))
    fireEvent.click(within(form).getByRole('button', { name: 'Agregar el entregable' }))
    await waitFor(() => expect(agregarEntregable).toHaveBeenCalled())
    expect(agregarEntregable.mock.calls[0]![1]).toMatchObject({
      nombre: 'Video de 2 min',
      formato: 'ENLACE',
      obligatorio: false,
    })
  })
})
