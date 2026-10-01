/**
 * «Mis procesos» con una prueba del editor que quedó sin completar (V67, AC-11).
 *
 * El intento ya se cerró y la postulación espera a que el equipo cierre su proceso:
 * ni «Abrir prueba», ni «te toca a ti», ni una cosa pendiente en el titular.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { MiPostulacion } from '@/api/tipos'
import { Procesos } from './Procesos'
import { Seguimiento } from './Seguimiento'

let lista: MiPostulacion[] = []
vi.mock('@/api/portal', () => ({ misPostulaciones: vi.fn(async () => lista) }))

const enLaPrueba = (pruebaSinCompletar?: boolean): MiPostulacion => ({
  uuid: 'p1',
  vacante: 'Analista contable',
  empresa: 'Acme S.A.C.',
  estado: 'PRUEBA_TURNO_CANDIDATO',
  estadoNombre: 'Prueba: turno del candidato',
  grupoPrioridad: null,
  diasSinCambio: 0,
  creadoEn: '2026-09-20T15:00:00Z',
  instrumentoEtapaTecnica: 'PRUEBA_PROPIA',
  avisosSinLeer: 0,
  remuneracion: { tipo: 'OCULTA', min: null, max: null, moneda: null, texto: 'No publicado', actualizadaEn: null },
  miPretension: null,
  ...(pruebaSinCompletar === undefined ? {} : { pruebaSinCompletar }),
}) as MiPostulacion

function montarLista() {
  const datos = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={datos}>
      <MemoryRouter>
        <Procesos />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(cleanup)

describe('la prueba del editor que quedó sin completar', () => {
  it('la lista no la cuenta como pendiente ni ofrece abrirla', async () => {
    lista = [enLaPrueba(true)]
    montarLista()

    expect(await screen.findByRole('heading', { level: 1, name: 'No tienes nada pendiente.' })).toBeTruthy()
    // La línea de espera y el recorrido plegado lo dicen igual.
    expect(screen.getAllByText('Tu tiempo terminó y la prueba quedó sin completar').length).toBeGreaterThan(0)
    expect(screen.getAllByText('No tienes que hacer nada.').length).toBeGreaterThan(0)
    expect(screen.queryByText(/Tienes una cosa pendiente/)).toBeNull()
    expect(screen.queryByRole('link', { name: 'Abrir prueba' })).toBeNull()
  })

  it('mientras la rinde, sigue siendo lo que le toca', async () => {
    lista = [enLaPrueba(false)]
    montarLista()

    expect(await screen.findByRole('heading', { level: 1, name: 'Tienes una cosa pendiente.' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Abrir prueba' })).toBeTruthy()
  })

  it('el recorrido del detalle dice que espera al equipo, sin botón', () => {
    render(
      <MemoryRouter>
        <Seguimiento postulacion={enLaPrueba(true)} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Tu tiempo terminó y la prueba quedó sin completar' })).toBeTruthy()
    expect(screen.getByText('No tienes que hacer nada.')).toBeTruthy()
    expect(screen.queryByText('Prueba del puesto habilitada')).toBeNull()
    expect(screen.queryByRole('link', { name: 'Abrir prueba' })).toBeNull()
    expect(screen.getByText('Etapa en curso: en revisión del equipo.')).toBeTruthy()
  })
})
