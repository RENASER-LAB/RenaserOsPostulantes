/**
 * La carga por Excel (V64): todo o nada. Si el backend contesta con errores, se
 * enseñan TODOS en la tabla —fila, columna, valor y qué pasa—; si no, el resumen.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ErrorApi } from '../api/cliente'
import { CargarExcel } from './CargarExcel'

const cargar = vi.fn<(archivo: File) => Promise<{ altas: number; actualizados: number }>>()
vi.mock('../api/colaboradores', () => ({
  cargarExcel: (archivo: File) => cargar(archivo),
  descargarPlantilla: vi.fn(),
}))

function montar() {
  const datos = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={datos}>
      <CargarExcel alCerrar={() => {}} />
    </QueryClientProvider>,
  )
}

const xlsx = (nombre = 'carga.xlsx') => new File(['x'], nombre)

afterEach(cleanup)

describe('la carga', () => {
  it('con errores, no se guarda nada y la tabla los enseña todos (AC-16)', async () => {
    cargar.mockRejectedValue(
      new ErrorApi(400, 'El archivo tiene 2 errores. No se guardó nada.', {
        errores: [
          { fila: 14, columna: 'Sede', valor: 'Arequipa', mensaje: 'No existe la sede «Arequipa»' },
          { fila: 20, columna: 'Número de documento', valor: '4512345', mensaje: 'El DNI tiene que tener 8 dígitos' },
        ],
      }),
    )
    montar()
    fireEvent.change(screen.getByLabelText('Archivo .xlsx'), { target: { files: [xlsx()] } })
    fireEvent.click(screen.getByRole('button', { name: 'Validar y cargar' }))
    expect(await screen.findByText('El archivo tiene 2 errores. No se guardó nada.')).toBeTruthy()
    const tabla = screen.getByRole('table', { name: 'Errores del archivo' })
    const filas = within(tabla).getAllByRole('row')
    expect(filas).toHaveLength(3)
    expect(within(filas[1]!).getByText('Arequipa')).toBeTruthy()
    expect(within(filas[2]!).getByText('El DNI tiene que tener 8 dígitos')).toBeTruthy()
  })

  it('sin errores dice cuántas altas y cuántas actualizaciones (AC-15)', async () => {
    cargar.mockResolvedValue({ altas: 20, actualizados: 0 })
    montar()
    fireEvent.change(screen.getByLabelText('Archivo .xlsx'), { target: { files: [xlsx()] } })
    fireEvent.click(screen.getByRole('button', { name: 'Validar y cargar' }))
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('Se dieron de alta 20 colaboradores y se actualizaron 0'),
    )
  })

  it('un .csv o un .xls se rechaza antes de subir nada', () => {
    montar()
    fireEvent.change(screen.getByLabelText('Archivo .xlsx'), { target: { files: [xlsx('carga.csv')] } })
    expect(screen.getByRole('alert').textContent).toContain('.xlsx')
    expect((screen.getByRole('button', { name: 'Validar y cargar' }) as HTMLButtonElement).disabled).toBe(true)
    expect(cargar).not.toHaveBeenCalled()
  })
})
