/**
 * Las sedes en Configuración (V64): añadir y editar mandan un solo envío por
 * clic, aunque llegue un doble clic antes de que el botón se desactive.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { GuardarSede, ListaDeSedes } from '../api/tiposPersonas'
import { Sedes } from './Sedes'

const listar = vi.fn<() => Promise<ListaDeSedes>>()
const crear = vi.fn<(datos: GuardarSede) => Promise<void>>()
const editar = vi.fn<(id: number, datos: GuardarSede) => Promise<void>>()

vi.mock('../api/estructura', () => ({
  listarSedes: () => listar(),
  crearSede: (datos: GuardarSede) => crear(datos),
  editarSede: (id: number, datos: GuardarSede) => editar(id, datos),
  desactivarSede: vi.fn(),
  reactivarSede: vi.fn(),
}))
vi.mock('@/api/portal', () => ({ catalogoUbigeo: () => Promise.resolve([]) }))

const SEDE = {
  id: 4,
  nombre: 'Planta Ventanilla',
  direccion: null,
  provinciaUbigeo: null,
  provinciaNombre: null,
  codigoSunat: null,
  esActiva: true,
}

function montar() {
  const datos = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={datos}>
      <Sedes />
    </QueryClientProvider>,
  )
}

/** Una petición que no termina hasta que el test la suelta. */
function enVuelo(simulada: typeof crear | typeof editar) {
  let soltar: () => void = () => {}
  simulada.mockImplementation(() => new Promise<void>((resolver) => (soltar = resolver)))
  return () => soltar()
}

beforeEach(() => {
  listar.mockResolvedValue({ puedeEditar: true, sedes: [SEDE] })
})

afterEach(cleanup)

describe('un doble clic en las sedes', () => {
  it('«Añadir» manda una sola alta', async () => {
    const soltar = enVuelo(crear)
    montar()
    await screen.findByText('Planta Ventanilla')
    fireEvent.change(screen.getByLabelText('Nombre de la sede'), { target: { value: 'Oficina San Isidro' } })
    const anadir = screen.getByRole('button', { name: 'Añadir' })
    fireEvent.click(anadir)
    fireEvent.click(anadir)
    await waitFor(() => expect(crear).toHaveBeenCalled())
    soltar()
    await waitFor(() => expect((screen.getByLabelText('Nombre de la sede') as HTMLInputElement).value).toBe(''))
    expect(crear).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('«Guardar» al editar manda una sola edición', async () => {
    const soltar = enVuelo(editar)
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }))
    const nombres = screen.getAllByLabelText('Nombre de la sede') as HTMLInputElement[]
    const enEdicion = nombres.find((n) => n.value === 'Planta Ventanilla')!
    fireEvent.change(enEdicion, { target: { value: 'Planta Ventanilla Norte' } })
    const guardar = screen.getByRole('button', { name: 'Guardar' })
    fireEvent.click(guardar)
    fireEvent.click(guardar)
    await waitFor(() => expect(editar).toHaveBeenCalled())
    soltar()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Guardar' })).toBeNull())
    expect(editar).toHaveBeenCalledTimes(1)
    expect(editar.mock.calls[0]![0]).toBe(4)
  })
})
