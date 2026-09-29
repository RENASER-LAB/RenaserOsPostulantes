/**
 * La ficha del colaborador (V64): pestañas, sueldo que no llega, 404 dicho como
 * tal, y las consecuencias del cese antes de confirmar.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ErrorApi } from '../api/cliente'
import type {
  EntradaHistorial,
  FichaColaborador,
  OpcionesColaborador,
  RegistrarCese,
  Situacion,
} from '../api/tiposPersonas'
import { FichaDelColaborador } from './FichaColaborador'
import { hoyEnLima, sumarDias } from './fechas'

const ver = vi.fn<(id: number) => Promise<FichaColaborador>>()
const historial = vi.fn<(id: number) => Promise<EntradaHistorial[]>>()
const cese = vi.fn<(id: number, datos: RegistrarCese) => Promise<void>>()

vi.mock('../api/colaboradores', () => ({
  verColaborador: (id: number) => ver(id),
  historialDelColaborador: (id: number) => historial(id),
  opcionesDeColaborador: () => Promise.resolve(OPCIONES),
  registrarCese: (id: number, datos: RegistrarCese) => cese(id, datos),
  registrarCambio: vi.fn(),
  anularCambio: vi.fn(),
  anularCese: vi.fn(),
  reingresar: vi.fn(),
  editarPerfil: vi.fn(),
  listarColaboradores: vi.fn(),
}))

vi.mock('@/api/portal', () => ({ catalogoUbigeo: () => Promise.resolve([]) }))

const OPCIONES: OpcionesColaborador = {
  tiposDocumento: [{ codigo: '01', nombre: 'DNI' }],
  sexos: [{ codigo: 'F', nombre: 'Femenino' }],
  estadosCiviles: [],
  nivelesEducativos: [],
  sedes: [{ id: 1, nombre: 'Sede Lima' }],
  areas: [{ id: 2, nombre: 'Finanzas' }],
  cargos: [{ id: 3, nombre: 'Jefe de finanzas' }],
  tiposContrato: [{ codigo: '01', nombre: 'A plazo indeterminado' }],
  contratosConFin: ['03'],
  contratoIndeterminado: '01',
  regimenes: [{ codigo: '01', nombre: 'General' }],
  monedas: [{ codigo: 'PEN', nombre: 'Soles (S/)' }],
  motivosCambio: [{ codigo: 'PROMOCION', nombre: 'Promoción' }],
  motivosCese: [{ codigo: '01', nombre: 'Renuncia' }],
  puedeEditar: true,
  puedeVerSueldos: false,
}

const HOY = hoyEnLima()

const SITUACION: Situacion = {
  id: 100,
  vigenteDesde: '2024-03-02',
  vigenteHasta: null,
  sedeId: 1,
  sede: 'Sede Lima',
  sedeActiva: true,
  areaId: 2,
  area: 'Finanzas',
  areaActiva: true,
  cargoId: 3,
  cargo: 'Jefe de finanzas',
  cargoActivo: false,
  jefeId: 8,
  jefe: 'Paredes, Elena',
  jefeCesado: true,
  tipoContrato: '01',
  tipoContratoNombre: 'A plazo indeterminado',
  finContrato: null,
  finPeriodoPrueba: null,
  regimenLaboral: '01',
  regimenNombre: 'General',
  tipoMotivo: 'INGRESO',
  tipoMotivoNombre: 'Ingreso',
  detalleMotivo: null,
  registradoPor: null,
  registradoEn: null,
}

const FICHA: FichaColaborador = {
  id: 7,
  nombreCompleto: 'Torres, Luis',
  estado: 'ACTIVO',
  perfil: {
    tipoDocumento: '01',
    tipoDocumentoNombre: 'DNI',
    numeroDocumento: '40111222',
    nombres: 'Luis',
    apellidoPaterno: 'Torres',
    apellidoMaterno: null,
    fechaNacimiento: '1990-05-04',
    sexo: 'M',
    sexoNombre: 'Masculino',
    estadoCivil: null,
    estadoCivilNombre: null,
    nacionalidad: 'Peruana',
    celular: '999888777',
    correoPersonal: null,
    correoCorporativo: null,
    direccion: null,
    provinciaUbigeo: null,
    provinciaNombre: null,
    nivelEducativoCodigo: null,
    nivelEducativoNombre: null,
  },
  vacanteId: null,
  vacante: 'Jefe contable',
  situacion: SITUACION,
  periodo: { id: 5, fechaIngreso: '2024-03-02', fechaCese: null, motivoCese: null, motivoCeseNombre: null, observacionCese: null },
  programados: [{ ...SITUACION, id: 101, vigenteDesde: sumarDias(HOY, 10), tipoMotivo: 'PROMOCION', tipoMotivoNombre: 'Promoción' }],
  base: SITUACION,
  reportes: [
    { id: 11, nombre: 'Rivas Sánchez, Ana' },
    { id: 12, nombre: 'Quispe, Carlos' },
  ],
  puedeEditar: true,
  puedeVerSueldos: false,
  puedeAnularCese: false,
}

function montar(ruta = '/admin/colaboradores/7') {
  const datos = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={datos}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/admin/colaboradores/:id" element={<FichaDelColaborador />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  ver.mockResolvedValue(FICHA)
  historial.mockResolvedValue([])
  cese.mockResolvedValue(undefined)
})

afterEach(cleanup)

describe('la cabecera y las pestañas', () => {
  it('enseña nombre, documento, estado y la vacante sin enlace si ya no existe', async () => {
    montar()
    expect(await screen.findByRole('heading', { level: 1, name: 'Torres, Luis' })).toBeTruthy()
    const cabecera = document.querySelector('header')!
    expect(within(cabecera).getByText('DNI 40111222')).toBeTruthy()
    expect(screen.getByText('Activo')).toBeTruthy()
    expect(screen.getByText(/Contratado por la vacante «Jefe contable»/)).toBeTruthy()
    expect(screen.queryByRole('link', { name: '«Jefe contable»' })).toBeNull()
  })

  it('tres pestañas, con Perfil abierta y flechas para moverse', async () => {
    montar()
    const perfil = await screen.findByRole('tab', { name: 'Perfil' })
    expect(perfil.getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(perfil, { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: 'Puesto y contrato' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tabpanel')).toBeTruthy()
  })

  it('una ficha de otra empresa responde 404 y se dice «Este colaborador no existe»', async () => {
    ver.mockRejectedValue(new ErrorApi(404, 'No encontramos eso, o no es tuyo.'))
    montar()
    expect(await screen.findByRole('heading', { name: 'Este colaborador no existe.' })).toBeTruthy()
  })
})

describe('Puesto y contrato', () => {
  it('marca lo inactivo y al jefe cesado, y sin ver_sueldos no hay fila de sueldo', async () => {
    montar()
    fireEvent.click(await screen.findByRole('tab', { name: 'Puesto y contrato' }))
    const panel = screen.getByRole('tabpanel')
    expect(within(panel).getByText(/Jefe de finanzas/).textContent).toContain('(inactivo)')
    expect(screen.getByText('(cesado)', { exact: false })).toBeTruthy()
    expect(screen.queryByText('Sueldo base')).toBeNull()
    expect(screen.getByRole('button', { name: 'Registrar un cambio' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Anular' })).toBeTruthy()
  })

  it('con ver_sueldos el sueldo se pinta con su moneda', async () => {
    ver.mockResolvedValue({ ...FICHA, puedeVerSueldos: true, situacion: { ...SITUACION, sueldoBase: 4500, moneda: 'PEN' } })
    montar()
    fireEvent.click(await screen.findByRole('tab', { name: 'Puesto y contrato' }))
    expect(screen.getByText('Sueldo base')).toBeTruthy()
    expect(screen.getByText(/S\/ 4,500\.00|S\/ 4 500,00|S\/ 4\.500,00/)).toBeTruthy()
  })

  it('el cese nombra a quienes le reportan y los programados que se anulan antes de confirmar (AC-21)', async () => {
    montar()
    fireEvent.click(await screen.findByRole('tab', { name: 'Puesto y contrato' }))
    fireEvent.click(screen.getByRole('button', { name: 'Registrar el cese' }))
    const modal = await screen.findByRole('dialog')
    expect(within(modal).getByText(/2 personas la tienen como jefe/)).toBeTruthy()
    expect(within(modal).getByText('Rivas Sánchez, Ana; Quispe, Carlos')).toBeTruthy()
    expect(within(modal).getByText(/Se anularán estos cambios programados/)).toBeTruthy()
    expect(within(modal).getByText(/no se borra nunca/)).toBeTruthy()

    fireEvent.change(within(modal).getByLabelText(/^Motivo/), { target: { value: '01' } })
    fireEvent.click(within(modal).getByRole('button', { name: 'Registrar el cese' }))
    await waitFor(() => expect(cese).toHaveBeenCalledWith(7, { fechaCese: HOY, motivoCodigo: '01', observacion: null }))
  })

  it('una ficha cesada ofrece reingresar en vez de cambios', async () => {
    ver.mockResolvedValue({
      ...FICHA,
      estado: 'CESADO',
      puedeAnularCese: true,
      periodo: { ...FICHA.periodo, fechaCese: '2026-01-10', motivoCese: '01', motivoCeseNombre: 'Renuncia' },
    })
    montar()
    fireEvent.click(await screen.findByRole('tab', { name: 'Puesto y contrato' }))
    expect(screen.getByRole('button', { name: 'Reingresar' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Anular el cese' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Registrar un cambio' })).toBeNull()
  })
})

describe('el historial', () => {
  it('pinta antes → después, quién y los anulados tachados', async () => {
    historial.mockResolvedValue([
      {
        tipo: 'CAMBIO',
        fecha: '2026-09-29',
        titulo: 'Cambio: Promoción',
        cambios: [{ campo: 'Cargo', antes: 'Analista', despues: 'Jefe de finanzas' }],
        motivo: 'Promoción',
        detalle: null,
        registradoPor: 'Tania Rojas',
        registradoEn: '2026-09-29T15:00:00Z',
        programado: false,
        anulado: true,
        anuladoPor: 'Diego Díaz',
        anuladoEn: '2026-09-29T16:00:00Z',
        motivoAnulacion: 'Error de dedo',
      },
    ])
    montar()
    fireEvent.click(await screen.findByRole('tab', { name: 'Historial' }))
    expect(await screen.findByText(/Analista → Jefe de finanzas/)).toBeTruthy()
    expect(screen.getByText(/Registrado por Tania Rojas/)).toBeTruthy()
    expect(screen.getByText(/Anulado por Diego Díaz/)).toBeTruthy()
    expect(screen.getByText('Anulado')).toBeTruthy()
  })
})
