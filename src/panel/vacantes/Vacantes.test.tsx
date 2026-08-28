/**
 * El formulario de vacante nueva no se pinta antes de saber si puede existir.
 *
 * De donde viene: los cuatro desplegables «se abrian y se cerraban al
 * instante». No era del `<select>`. `listarSolicitudes` nace con el formulario
 * —su `useQuery` vive dentro del componente, que solo se monta al pulsar «Crear
 * vacante»— asi que en TODO primer clic esta en vuelo, no solo con una red
 * lenta. El formulario se pintaba en esa ventana y, si no venia ninguna
 * solicitud ABIERTA, lo sustituia el callejon de «no hay ninguna aprobada»:
 * los cuatro `<select>` se desmontaban bajo el raton y el desplegable abierto
 * moria con su elemento.
 *
 * Lo que compila perfectamente estando mal:
 *
 *   0. **Pintar el formulario con la lista en vuelo.** Es el fallo de arriba, y
 *      no se ve en una captura: la fixtura contesta al momento.
 *   1. **Un desplegable cuya unica linea es «Elige…».** Se abre, no hay nada
 *      que elegir y no se dice por que — el mismo sintoma sin desmontaje.
 *   2. **Decir «no hay ninguna solicitud aprobada» cuando la consulta fallo.**
 *      Manda a escribir una solicitud que quiza ya existe.
 *   3. **Colapsar «esta cargando» con «llego vacia».** Una manda a esperar y la
 *      otra a dar de alta un puesto; en gris son la misma linea apagada.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { VacantesPanel } from './Vacantes'
import type { Catalogos, SolicitudResumen } from '../api/tipos'

const listarSolicitudes = vi.fn()
const listarPuestos = vi.fn()
const listarUsuarios = vi.fn()
const verCatalogos = vi.fn()

vi.mock('../api/panel', () => ({
  listarVacantes: () => Promise.resolve([]),
  listarAreas: () => Promise.resolve([{ id: 1, nombre: 'Tecnología', esActiva: true }]),
  listarSolicitudes: () => listarSolicitudes(),
  listarPuestos: () => listarPuestos(),
  listarUsuarios: () => listarUsuarios(),
  verCatalogos: () => verCatalogos(),
  crearVacante: () => Promise.resolve({}),
  crearSolicitud: () => Promise.resolve({}),
  aprobarSolicitud: () => Promise.resolve({}),
}))

const CATALOGOS: Catalogos = {
  nivelesPuesto: [],
  familias: [],
  etapas: [],
  urgencias: [{ codigo: 'NORMAL', nombre: 'Normal' }],
  tiposCierre: [{ codigo: 'PERMANENTE', nombre: 'Permanente' }],
  motivosCierre: [],
  estados: [],
}

const abierta: SolicitudResumen = {
  id: 7,
  estado: 'ABIERTA',
  urgencia: 'ALTA',
  areaId: 1,
  resultadoPrincipal: 'Tablero de ventas al día',
  creadoEn: '2026-06-20T09:00:00Z',
}

/** Una promesa que se resuelve cuando la prueba quiera: es la ventana del fallo. */
function enVuelo<T>() {
  let soltar!: (valor: T) => void
  const promesa = new Promise<T>((resolver) => {
    soltar = resolver
  })
  return { promesa, soltar }
}

async function abrirElAlta() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={['/admin']}>
        <VacantesPanel />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Crear vacante' }))
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('el formulario de vacante nueva espera a saber si puede existir', () => {
  it('no pinta ni un desplegable mientras la lista de solicitudes viaja', async () => {
    const solicitudes = enVuelo<SolicitudResumen[]>()
    listarSolicitudes.mockReturnValue(solicitudes.promesa)
    listarPuestos.mockResolvedValue([])
    listarUsuarios.mockResolvedValue([])
    verCatalogos.mockResolvedValue(CATALOGOS)

    await abrirElAlta()

    expect(await screen.findByText('Buscando las solicitudes aprobadas…')).toBeTruthy()
    expect(document.querySelectorAll('select').length).toBe(0)

    solicitudes.soltar([abierta])
    await screen.findByLabelText('Solicitud aprobada que la respalda')
  })

  /*
   * ⚠️ Esta es la prueba del desmontaje, y lo que la hace valer es que mira
   * ANTES de soltar la respuesta. Afirmar solo el estado final pasa en verde
   * con el fallo dentro: al terminar tampoco hay `<select>`, porque los cuatro
   * ya se desmontaron. Lo que no puede pasar es que llegaran a existir.
   */
  it('ningún desplegable llega a existir para desaparecer después', async () => {
    const solicitudes = enVuelo<SolicitudResumen[]>()
    listarSolicitudes.mockReturnValue(solicitudes.promesa)
    listarPuestos.mockResolvedValue([])
    listarUsuarios.mockResolvedValue([])
    verCatalogos.mockResolvedValue(CATALOGOS)

    await abrirElAlta()
    await screen.findByText('Buscando las solicitudes aprobadas…')
    expect(document.querySelectorAll('select').length).toBe(0)

    // Sin ninguna ABIERTA, lo que sale es el callejon — nunca el formulario.
    solicitudes.soltar([])
    expect(await screen.findByText(/No hay ninguna solicitud aprobada/)).toBeTruthy()
    expect(document.querySelectorAll('select').length).toBe(0)
  })

  it('un desplegable cuya lista aún viaja lo dice y no se deja abrir', async () => {
    const puestos = enVuelo<{ id: number; nombre: string }[]>()
    listarSolicitudes.mockResolvedValue([abierta])
    listarPuestos.mockReturnValue(puestos.promesa)
    listarUsuarios.mockResolvedValue([])
    verCatalogos.mockResolvedValue(CATALOGOS)

    await abrirElAlta()

    const desplegable = (await screen.findByLabelText(
      'Puesto del catálogo',
    )) as HTMLSelectElement
    expect(desplegable.disabled).toBe(true)
    expect(desplegable.options[0]?.text).toBe('Cargando…')

    puestos.soltar([{ id: 1, nombre: 'Ingeniero de Infraestructura' }])
    await waitFor(() => expect(desplegable.disabled).toBe(false))
    expect(desplegable.options[0]?.text).toBe('Elige…')
  })

  it('una lista que llegó vacía no se confunde con una que está cargando', async () => {
    listarSolicitudes.mockResolvedValue([abierta])
    listarPuestos.mockResolvedValue([])
    listarUsuarios.mockResolvedValue([])
    verCatalogos.mockResolvedValue(CATALOGOS)

    await abrirElAlta()

    const desplegable = (await screen.findByLabelText(
      'Puesto del catálogo',
    )) as HTMLSelectElement
    await waitFor(() =>
      expect(desplegable.options[0]?.text).toBe('No hay ningún puesto en el catálogo'),
    )
    expect(desplegable.disabled).toBe(true)
  })

  /*
   * ⚠️ Este es el guardian del camino nuevo, y el unico que sobrevive a que la
   * base local cambie de estado. El backend admite varias solicitudes ABIERTA a
   * la vez, asi que escribir una no puede depender de que no haya ninguna:
   * antes la unica puerta vivia dentro del callejon de «no hay ninguna
   * aprobada» y con una sola abierta se cerraba.
   */
  it('se puede escribir otra solicitud aunque ya haya una abierta', async () => {
    listarSolicitudes.mockResolvedValue([abierta])
    listarPuestos.mockResolvedValue([])
    listarUsuarios.mockResolvedValue([])
    verCatalogos.mockResolvedValue(CATALOGOS)

    const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={cliente}>
        <MemoryRouter initialEntries={['/admin']}>
          <VacantesPanel />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Escribir una solicitud' }))
    expect(await screen.findByLabelText('El resultado principal que se busca')).toBeTruthy()
    // El callejon no se pinta: hay una abierta y decir lo contrario seria mentir.
    expect(screen.queryByText(/No hay ninguna solicitud aprobada/)).toBeNull()
  })

  /*
   * Un `<form>` dentro de otro lo descarta el navegador y su boton de enviar
   * acaba enviando el de fuera. Ya paso una vez en esta misma pantalla.
   */
  it('los dos formularios son hermanos, nunca uno dentro del otro', async () => {
    listarSolicitudes.mockResolvedValue([abierta])
    listarPuestos.mockResolvedValue([{ id: 1, nombre: 'Ingeniero' }])
    listarUsuarios.mockResolvedValue([])
    verCatalogos.mockResolvedValue(CATALOGOS)

    const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={cliente}>
        <MemoryRouter initialEntries={['/admin']}>
          <VacantesPanel />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Crear vacante' }))
    fireEvent.click(screen.getByRole('button', { name: 'Escribir una solicitud' }))
    await screen.findByLabelText('El resultado principal que se busca')

    // Y el alta sigue en pie: abrir uno no desmonta lo que hubiera escrito en el otro.
    expect(await screen.findByLabelText('Título que ve quien postula')).toBeTruthy()
    expect(document.querySelectorAll('form form').length).toBe(0)
  })

  it('si la lista de solicitudes falla, no dice que no hay ninguna aprobada', async () => {
    listarSolicitudes.mockRejectedValue(new Error('El servidor no contesta'))
    listarPuestos.mockResolvedValue([])
    listarUsuarios.mockResolvedValue([])
    verCatalogos.mockResolvedValue(CATALOGOS)

    await abrirElAlta()

    expect(await screen.findByText(/El servidor no contesta/)).toBeTruthy()
    expect(screen.queryByText(/No hay ninguna solicitud aprobada/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Volver a intentarlo' })).toBeTruthy()
  })
})
