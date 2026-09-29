/**
 * El alta manual (V64): precargada desde una contratación, el documento que ya
 * tiene ficha dicho con su enlace, y lo escrito que sobrevive a una sesión caída.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ErrorApi } from '../api/cliente'
import type { AltaColaborador, OpcionesColaborador, Precarga } from '../api/tiposPersonas'
import { NuevoColaborador } from './NuevoColaborador'

const alta = vi.fn<(datos: AltaColaborador) => Promise<{ id: number }>>()
const precarga = vi.fn<(id: number) => Promise<Precarga>>()

vi.mock('../api/colaboradores', () => ({
  opcionesDeColaborador: () => Promise.resolve(OPCIONES),
  precargaDelContratado: (id: number) => precarga(id),
  darDeAlta: (datos: AltaColaborador) => alta(datos),
  listarColaboradores: vi.fn(),
}))
vi.mock('@/api/portal', () => ({ catalogoUbigeo: () => Promise.resolve([]) }))

const OPCIONES: OpcionesColaborador = {
  tiposDocumento: [
    { codigo: '01', nombre: 'DNI' },
    { codigo: '07', nombre: 'Pasaporte' },
  ],
  sexos: [
    { codigo: 'F', nombre: 'Femenino' },
    { codigo: 'M', nombre: 'Masculino' },
  ],
  estadosCiviles: [],
  nivelesEducativos: [],
  sedes: [{ id: 1, nombre: 'Sede Lima' }],
  areas: [{ id: 2, nombre: 'Finanzas' }],
  cargos: [{ id: 3, nombre: 'Analista' }],
  tiposContrato: [
    { codigo: '01', nombre: 'A plazo indeterminado' },
    { codigo: '03', nombre: 'Por inicio o incremento de actividad' },
  ],
  contratosConFin: ['03'],
  contratoIndeterminado: '01',
  regimenes: [{ codigo: '01', nombre: 'General' }],
  monedas: [{ codigo: 'PEN', nombre: 'Soles (S/)' }],
  motivosCambio: [],
  motivosCese: [],
  puedeEditar: true,
  puedeVerSueldos: false,
}

function montar(ruta = '/admin/colaboradores/nuevo') {
  const datos = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={datos}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/admin/colaboradores/nuevo" element={<NuevoColaborador />} />
          <Route path="/admin/colaboradores/:id" element={<p>La ficha nueva</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function rellenar() {
  fireEvent.change(await screen.findByLabelText(/^Número de documento/), { target: { value: '45123456' } })
  fireEvent.change(screen.getByLabelText(/^Nombres/), { target: { value: 'Ana' } })
  fireEvent.change(screen.getByLabelText(/^Apellido paterno/), { target: { value: 'Rivas' } })
  fireEvent.change(screen.getByLabelText(/^Fecha de nacimiento/), { target: { value: '1990-01-01' } })
  fireEvent.change(screen.getByLabelText(/^Sexo/), { target: { value: 'F' } })
  fireEvent.change(screen.getByLabelText(/^Fecha de ingreso/), { target: { value: '2026-10-01' } })
  fireEvent.change(screen.getByLabelText(/^Sede/), { target: { value: '1' } })
  fireEvent.change(screen.getByLabelText(/^Área/), { target: { value: '2' } })
  fireEvent.change(screen.getByLabelText(/^Cargo/), { target: { value: '3' } })
  fireEvent.change(screen.getByLabelText(/^Tipo de contrato/), { target: { value: '01' } })
}

beforeEach(() => {
  alta.mockResolvedValue({ id: 77 })
})

afterEach(() => {
  cleanup()
  sessionStorage.clear()
})

describe('el alta', () => {
  it('manda los tres bloques y abre la ficha nueva (AC-07)', async () => {
    montar()
    await rellenar()
    fireEvent.click(screen.getByRole('button', { name: 'Dar de alta' }))
    expect(await screen.findByText('La ficha nueva')).toBeTruthy()
    expect(alta.mock.calls[0]![0]).toMatchObject({
      persona: { tipoDocumento: '01', numeroDocumento: '45123456', nombres: 'Ana', sexo: 'F' },
      fechaIngreso: '2026-10-01',
      situacion: { sedeId: 1, areaId: 2, cargoId: 3, tipoContrato: '01', finContrato: null },
      postulacionId: null,
    })
    expect(alta.mock.calls[0]![0].situacion).not.toHaveProperty('sueldoBase')
  })

  it('sin los obligatorios no envía y marca los campos', async () => {
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Dar de alta' }))
    expect(alta).not.toHaveBeenCalled()
    expect(await screen.findByText('Indica la fecha de ingreso.')).toBeTruthy()
    expect(screen.getByText('Escribe el número de documento.')).toBeTruthy()
  })

  it('un documento con ficha activa: «Ya es colaborador» con el enlace a su ficha (AC-09)', async () => {
    alta.mockRejectedValue(new ErrorApi(409, 'Ya es colaborador', { colaboradorId: 12, cesado: false }))
    montar()
    await rellenar()
    fireEvent.click(screen.getByRole('button', { name: 'Dar de alta' }))
    const enlace = await screen.findByRole('link', { name: 'Ver su ficha' })
    expect(enlace.getAttribute('href')).toBe('/admin/colaboradores/12')
    expect(screen.getByRole('alert').textContent).toContain('Ya es colaborador')
  })

  it('con una ficha cesada ofrece reingresarla, enlazando la contratación', async () => {
    precarga.mockResolvedValue({
      postulacionId: 40,
      vacante: 'Asistente contable',
      nombres: 'Carla',
      apellidoPaterno: 'De la Cruz Pérez',
      correoPersonal: 'carla@correo.pe',
      celular: '987654321',
      cargoId: 3,
      areaId: 2,
      colaboradorId: null,
    })
    alta.mockRejectedValue(
      new ErrorApi(409, 'Ya trabajó aquí. Reingrésalo desde su ficha', { colaboradorId: 12, cesado: true }),
    )
    montar('/admin/colaboradores/nuevo?postulacion=40')
    await rellenar()
    fireEvent.click(screen.getByRole('button', { name: 'Dar de alta' }))
    const enlace = await screen.findByRole('link', { name: 'Reingresar desde su ficha' })
    expect(enlace.getAttribute('href')).toBe('/admin/colaboradores/12?reingreso=1&postulacion=40')
  })
})

describe('el alta de un contratado (AC-13)', () => {
  it('sale precargada, con los apellidos juntos en «apellido paterno» y sin fecha de ingreso', async () => {
    precarga.mockResolvedValue({
      postulacionId: 40,
      vacante: 'Asistente contable',
      nombres: 'Carla',
      apellidoPaterno: 'De la Cruz Pérez',
      correoPersonal: 'carla@correo.pe',
      celular: '987654321',
      cargoId: 3,
      areaId: 2,
      colaboradorId: null,
    })
    montar('/admin/colaboradores/nuevo?postulacion=40')
    expect(((await screen.findByLabelText(/^Nombres/)) as HTMLInputElement).value).toBe('Carla')
    expect((screen.getByLabelText(/^Apellido paterno/) as HTMLInputElement).value).toBe('De la Cruz Pérez')
    expect((screen.getByLabelText(/^Correo personal/) as HTMLInputElement).value).toBe('carla@correo.pe')
    expect((screen.getByLabelText(/^Celular/) as HTMLInputElement).value).toBe('987654321')
    expect((screen.getByLabelText(/^Cargo/) as HTMLSelectElement).value).toBe('3')
    expect((screen.getByLabelText(/^Área/) as HTMLSelectElement).value).toBe('2')
    expect((screen.getByLabelText(/^Fecha de ingreso/) as HTMLInputElement).value).toBe('')
    expect(screen.getByText(/Contratado por la vacante «Asistente contable»/)).toBeTruthy()
  })

  it('si la contratación ya tiene ficha, no ofrece un segundo alta', async () => {
    precarga.mockResolvedValue({
      postulacionId: 40,
      vacante: 'Asistente contable',
      nombres: 'Carla',
      apellidoPaterno: 'De la Cruz',
      correoPersonal: null,
      celular: null,
      cargoId: null,
      areaId: null,
      colaboradorId: 9,
    })
    montar('/admin/colaboradores/nuevo?postulacion=40')
    expect((await screen.findByRole('link', { name: 'Ver su ficha' })).getAttribute('href')).toBe('/admin/colaboradores/9')
    expect(screen.queryByRole('button', { name: 'Dar de alta' })).toBeNull()
  })
})

describe('lo escrito sobrevive a salir del panel', () => {
  it('se recupera al volver y se dice', async () => {
    const { unmount } = montar()
    fireEvent.change(await screen.findByLabelText(/^Nombres/), { target: { value: 'Ana' } })
    await waitFor(() => expect(sessionStorage.length).toBe(1))
    unmount()

    montar()
    expect(((await screen.findByLabelText(/^Nombres/)) as HTMLInputElement).value).toBe('Ana')
    expect(screen.getByRole('status').textContent).toContain('Recuperamos lo que estabas escribiendo')
  })
})
