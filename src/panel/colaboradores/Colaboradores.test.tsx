/**
 * La lista de colaboradores (V64): la tabla, el aviso de contratados
 * pendientes, los filtros y los dos estados vacíos, que no son el mismo.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type {
  ContratadoPendiente,
  FiltrosColaboradores,
  OpcionesColaborador,
  PaginaColaboradores,
} from '../api/tiposPersonas'
import { ColaboradoresPanel } from './Colaboradores'

const listar = vi.fn<(f: FiltrosColaboradores) => Promise<PaginaColaboradores>>()
const pendientes = vi.fn<() => Promise<ContratadoPendiente[]>>()
const descartar = vi.fn<(id: number, motivo: string) => Promise<void>>()
let opciones: OpcionesColaborador

vi.mock('../api/colaboradores', () => ({
  listarColaboradores: (f: FiltrosColaboradores) => listar(f),
  contratadosPendientes: () => pendientes(),
  noDarDeAlta: (id: number, motivo: string) => descartar(id, motivo),
  opcionesDeColaborador: () => Promise.resolve(opciones),
  descargarPlantilla: vi.fn(),
  cargarExcel: vi.fn(),
}))

const OPCIONES: OpcionesColaborador = {
  tiposDocumento: [{ codigo: '01', nombre: 'DNI' }],
  sexos: [],
  estadosCiviles: [],
  nivelesEducativos: [],
  sedes: [{ id: 1, nombre: 'Sede Lima' }],
  areas: [{ id: 2, nombre: 'Finanzas' }],
  cargos: [{ id: 3, nombre: 'Analista' }],
  tiposContrato: [],
  contratosConFin: ['03'],
  contratoIndeterminado: '01',
  regimenes: [],
  monedas: [],
  motivosCambio: [],
  motivosCese: [],
  puedeEditar: true,
  puedeVerSueldos: false,
}

const PAGINA: PaginaColaboradores = {
  filas: [
    {
      id: 11,
      nombreCompleto: 'Rivas Sánchez, Ana',
      tipoDocumento: '01',
      tipoDocumentoNombre: 'DNI',
      numeroDocumento: '45123456',
      cargo: 'Analista',
      area: 'Finanzas',
      sede: 'Sede Lima',
      jefeId: 12,
      jefe: 'Torres, Luis',
      fechaIngreso: '2026-03-02',
      finContrato: null,
      fechaCese: null,
      estado: 'ACTIVO',
    },
  ],
  total: 148,
  pagina: 0,
  tamano: 50,
  hayColaboradores: true,
}

function montar() {
  const datos = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={datos}>
      <MemoryRouter initialEntries={['/admin/colaboradores']}>
        <ColaboradoresPanel />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  opciones = OPCIONES
  listar.mockResolvedValue(PAGINA)
  pendientes.mockResolvedValue([])
  descartar.mockResolvedValue(undefined)
})

afterEach(cleanup)

describe('la tabla', () => {
  it('enseña cada columna, cuenta el total y enlaza la ficha', async () => {
    montar()
    const tabla = await screen.findByRole('table')
    expect(within(tabla).getByRole('link', { name: 'Rivas Sánchez, Ana' }).getAttribute('href')).toBe(
      '/admin/colaboradores/11',
    )
    expect(within(tabla).getByText('DNI 45123456')).toBeTruthy()
    expect(within(tabla).getByText('Torres, Luis')).toBeTruthy()
    expect(within(tabla).getByText('02/03/2026')).toBeTruthy()
    expect(within(tabla).getByText('Activo')).toBeTruthy()
    expect(screen.getByText('148 colaboradores')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Siguiente ›' })).toBeTruthy()
  })

  it('pide por defecto Activos y Por ingresar, y los filtros viajan al backend', async () => {
    montar()
    await screen.findByRole('table')
    expect(listar.mock.calls[0]![0]).toMatchObject({ estados: ['ACTIVO', 'POR_INGRESAR'], pagina: 0 })

    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'cesados' } })
    await waitFor(() => expect(listar.mock.lastCall![0]).toMatchObject({ estados: ['CESADO'] }))
    fireEvent.change(screen.getByLabelText('Sede'), { target: { value: '1' } })
    await waitFor(() => expect(listar.mock.lastCall![0]).toMatchObject({ sede: 1 }))
    fireEvent.click(screen.getByLabelText('Contratos por vencer'))
    await waitFor(() => expect(listar.mock.lastCall![0]).toMatchObject({ porVencer: true }))
    fireEvent.change(screen.getByLabelText('Buscar por nombre o documento'), { target: { value: 'rivas' } })
    await waitFor(() => expect(listar.mock.lastCall![0]).toMatchObject({ q: 'rivas' }))
  })

  it('con editar_colaboradores ofrece «Nuevo colaborador» y «Cargar Excel»; sin él, no', async () => {
    montar()
    expect(await screen.findByRole('link', { name: 'Nuevo colaborador' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cargar Excel' })).toBeTruthy()
    cleanup()

    opciones = { ...OPCIONES, puedeEditar: false }
    montar()
    await screen.findByRole('table')
    expect(screen.queryByRole('link', { name: 'Nuevo colaborador' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Cargar Excel' })).toBeNull()
  })
})

describe('los estados vacíos', () => {
  it('sin ningún colaborador: «Todavía no hay colaboradores», con el alta y la carga', async () => {
    listar.mockResolvedValue({ ...PAGINA, filas: [], total: 0, hayColaboradores: false })
    montar()
    expect(await screen.findByText('Todavía no hay colaboradores')).toBeTruthy()
    expect(screen.getAllByRole('link', { name: 'Nuevo colaborador' }).length).toBeGreaterThan(0)
  })

  it('con filtros sin resultados: «Ningún colaborador cumple estos filtros» y «Quitar filtros»', async () => {
    listar.mockResolvedValue({ ...PAGINA, filas: [], total: 0, hayColaboradores: true })
    montar()
    expect(await screen.findByText('Ningún colaborador cumple estos filtros')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'cesados' } })
    fireEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }))
    await waitFor(() => expect(listar.mock.lastCall![0]).toMatchObject({ estados: ['ACTIVO', 'POR_INGRESAR'] }))
  })
})

describe('el aviso de contratados pendientes (AC-14)', () => {
  const DOS: ContratadoPendiente[] = [
    { postulacionId: 50, nombre: 'Dante Salas', vacanteId: 9, vacante: 'Asistente contable', contratadoEn: '2026-09-20T15:00:00Z' },
    { postulacionId: 51, nombre: 'Ana Antes', vacanteId: 9, vacante: 'Asistente contable', contratadoEn: null },
  ]

  it('dice cuántas esperan su alta y, al abrirlo, ofrece dar o no dar de alta', async () => {
    pendientes.mockResolvedValue(DOS)
    montar()
    expect(await screen.findByText('2 personas contratadas por selección esperan su alta')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ver' }))
    const lista = screen.getByRole('list', { name: 'Contratados que esperan su alta' })
    expect(within(lista).getAllByRole('link', { name: 'Dar de alta' })[0]!.getAttribute('href')).toBe(
      '/admin/colaboradores/nuevo?postulacion=50',
    )
  })

  it('«No dar de alta» pide el motivo y lo manda', async () => {
    pendientes.mockResolvedValue(DOS)
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Ver' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'No dar de alta' })[0]!)
    const modal = await screen.findByRole('dialog')
    const confirmar = within(modal).getByRole('button', { name: 'No dar de alta' })
    expect((confirmar as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(within(modal).getByLabelText('Motivo'), { target: { value: 'Ya no trabaja aquí' } })
    fireEvent.click(confirmar)
    await waitFor(() => expect(descartar).toHaveBeenCalledWith(50, 'Ya no trabaja aquí'))
  })

  it('sin pendientes no hay aviso', async () => {
    montar()
    await screen.findByRole('table')
    expect(screen.queryByText(/esperan? su alta/)).toBeNull()
  })
})
