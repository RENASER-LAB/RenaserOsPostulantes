/**
 * Los cargos en Configuración (V64): renombrar avisa ANTES de guardar de que el
 * nombre nuevo sale en todas partes, y sin editar_estructura no hay acciones.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ListaDeCargos } from '../api/tiposPersonas'
import { Cargos } from './Cargos'

const listar = vi.fn<() => Promise<ListaDeCargos>>()
const renombrar = vi.fn<(id: number, nombre: string) => Promise<void>>()

vi.mock('../api/estructura', () => ({
  listarCargos: () => listar(),
  renombrarCargo: (id: number, nombre: string) => renombrar(id, nombre),
  crearCargo: vi.fn(),
  desactivarCargo: vi.fn(),
  reactivarCargo: vi.fn(),
}))
vi.mock('../api/panel', () => ({
  verCatalogos: () => Promise.resolve({ nivelesPuesto: [], familias: [] }),
}))

const CARGO = {
  id: 3,
  nombre: 'Asistente',
  nivelPuestoCodigo: 'EJECUCION',
  nivelNombre: 'Ejecución',
  familiaCodigo: 'OPERACIONES',
  familiaNombre: 'Operaciones',
  esActivo: true,
  vacantes: 2,
  colaboradores: 5,
}

function montar() {
  const datos = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={datos}>
      <Cargos />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  listar.mockResolvedValue({ puedeEditar: true, cargos: [CARGO] })
  renombrar.mockResolvedValue(undefined)
})

afterEach(cleanup)

describe('los cargos', () => {
  it('renombrar avisa antes de guardar de cuántas vacantes y personas lo usan (AC-06)', async () => {
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Renombrar' }))
    expect(screen.getByRole('note').textContent).toContain('sale en todas partes')
    expect(screen.getByRole('note').textContent).toContain('2 vacantes y 5 personas')
    fireEvent.change(screen.getByLabelText('Nombre nuevo de «Asistente»'), { target: { value: 'Asistente contable' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(renombrar).toHaveBeenCalledWith(3, 'Asistente contable'))
  })

  it('sin editar_estructura se ven sin acciones', async () => {
    listar.mockResolvedValue({ puedeEditar: false, cargos: [CARGO] })
    montar()
    expect(await screen.findByText('Asistente')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Renombrar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Añadir' })).toBeNull()
  })
})
