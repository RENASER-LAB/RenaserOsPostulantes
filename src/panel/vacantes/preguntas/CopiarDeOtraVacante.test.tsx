/**
 * Copiar de otra vacante (AC-15b, AC-15c): la lista con su nombre, fecha, estado
 * y resumen; la vista previa no toca nada; y con un borrador se pide confirmar
 * que se reemplaza.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CopiarDeOtraVacante } from './CopiarDeOtraVacante'

const listar = vi.fn()
const previa = vi.fn()
const copiar = vi.fn()
vi.mock('../../api/preguntasPropias', async (original) => ({
  ...(await original<typeof import('../../api/preguntasPropias')>()),
  listarCopiables: (id: number, b: string, n: string) => listar(id, b, n),
  verVistaPrevia: (id: number, origen: number) => previa(id, origen),
  copiarDeOtraVacante: (id: number, origen: number) => copiar(id, origen),
}))

const alCopiar = vi.fn()

function pintar(hayBorrador: boolean) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <CopiarDeOtraVacante vacanteId={40} abierto hayBorrador={hayBorrador} alCerrar={vi.fn()} alCopiar={alCopiar} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  listar.mockResolvedValue([
    { vacanteId: 8, titulo: 'Asistente contable', nivel: 'EJECUCION', publicadaEn: '2026-03-10T00:00:00Z', estado: 'ARCHIVADA', criterios: 4, preguntas: 12 },
    { vacanteId: 9, titulo: 'Analista de datos', nivel: 'SUPERVISION', publicadaEn: '2026-08-01T00:00:00Z', estado: 'ACTIVA', criterios: 3, preguntas: 9 },
  ])
  previa.mockResolvedValue({
    id: 80, estado: 'PUBLICADA', guiaCalificacion: 'Premia el dato concreto', minutosObjetivo: 25, versionGuia: 1,
    total: 100, cuantosCriterios: 1, cuantasPreguntas: 1, sinCriterio: [], avisos: [],
    criterios: [{ id: 1, nombre: 'Conocimiento contable', queEvalua: null, orden: 1, puntos: 100, puntosSistema: 100, puntosIa: 0,
      preguntas: [{ id: 2, tipo: 'OPCION_UNICA', enunciado: '¿Qué libro registra primero una venta al crédito?', puntos: 100, criterioId: 1, orden: 1, queDebeTener: null,
        opciones: [{ id: 3, texto: 'Libro diario', puntos: 100, orden: 1 }, { id: 4, texto: 'Caja', puntos: 0, orden: 2 }] }] }],
  })
})
afterEach(cleanup)

describe('copiar de otra vacante', () => {
  it('cada vacante se reconoce por nombre, fecha, estado y resumen; sin elegir, la vista previa lo pide', async () => {
    pintar(false)
    expect(await screen.findByText('Asistente contable · 03/2026')).toBeTruthy()
    // QA-PP-06: el nivel se nombra como en el filtro, no en bruto
    expect(screen.getByText(/archivada · Ejecución · 4 crit · 12 preg/)).toBeTruthy()
    expect(screen.queryByText(/ejecucion/)).toBeNull()
    expect(screen.getAllByText('Elige una vacante para ver sus preguntas.').length).toBeGreaterThan(0)
  })

  it('tocar una vacante enseña su prueba y NO copia nada; copiar con borrador pide confirmar (AC-15c)', async () => {
    copiar.mockResolvedValue({ vacanteId: 40 })
    pintar(true)
    fireEvent.click(await screen.findByText('Asistente contable · 03/2026'))
    expect((await screen.findAllByText('¿Qué libro registra primero una venta al crédito?')).length).toBeGreaterThan(0)
    expect(copiar).not.toHaveBeenCalled()

    fireEvent.click(screen.getAllByRole('button', { name: 'Copiar esta prueba' })[0]!)
    expect(copiar).not.toHaveBeenCalled()
    fireEvent.click(screen.getAllByRole('button', { name: 'Reemplazar el borrador' })[0]!)
    await waitFor(() => expect(copiar).toHaveBeenCalledWith(40, 8))
    await waitFor(() => expect(alCopiar).toHaveBeenCalled())
  })

  it('el buscador y el filtro de nivel van al servidor', async () => {
    pintar(false)
    await screen.findByText('Asistente contable · 03/2026')
    fireEvent.change(screen.getByLabelText('Filtrar por nivel'), { target: { value: 'EJECUCION' } })
    await waitFor(() => expect(listar).toHaveBeenLastCalledWith(40, '', 'EJECUCION'))
  })
})
