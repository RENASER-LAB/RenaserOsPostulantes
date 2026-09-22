/**
 * Eliminar una vacante desde la lista y desde Archivadas.
 *
 * Lo que se protege aquí es lo que se rompe sin que nada falle:
 *
 *   0. **La papelera donde no toca.** Sin `eliminar_vacante` no sale; con él,
 *      sale en cualquier estado —y eso la distingue del archivo, que solo se
 *      ofrece en una cerrada—.
 *   1. **Eliminar sin confirmar.** Pulsar el icono no elimina nada: abre el
 *      modal. Es lo único del panel que no se deshace.
 *   2. **Confirmar sin motivo.** El botón no se enciende hasta que hay un
 *      motivo que no sea solo espacios, que es la misma regla del backend.
 *   3. **Decir que se avisó a todos cuando no.** Cerradas y avisadas son dos
 *      números, y el panel dice los dos cuando no coinciden.
 *   4. **Perder lo escrito al fallar.** Ante un error el modal se queda, con su
 *      motivo dentro, para poder reintentar.
 */

import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { VacantesPanel } from './Vacantes'
import { VacantesArchivadas } from './VacantesArchivadas'
import type { Catalogos, VacantePanel as Vacante } from '../api/tipos'

const listarVacantes = vi.fn()
const contarVacantesArchivadas = vi.fn()
const eliminarVacante = vi.fn()

vi.mock('../api/panel', () => ({
  listarVacantes: (archivadas?: boolean) => listarVacantes(archivadas),
  contarVacantesArchivadas: () => contarVacantesArchivadas(),
  eliminarVacante: (id: number, motivo: string) => eliminarVacante(id, motivo),
  archivarVacante: () => Promise.resolve(undefined),
  desarchivarVacante: () => Promise.resolve(undefined),
  editarVacante: () => Promise.resolve({ huboCambios: false, postulantesAvisados: 0 }),
  listarSolicitudes: () => Promise.resolve([]),
  listarPuestos: () => Promise.resolve([]),
  listarUsuarios: () => Promise.resolve([]),
  listarAreas: () => Promise.resolve([]),
  verCatalogos: () => Promise.resolve(CATALOGOS),
  crearVacante: () => Promise.resolve({}),
  crearSolicitud: () => Promise.resolve(1),
  crearPuesto: () => Promise.resolve(1),
  aprobarSolicitud: () => Promise.resolve({}),
}))

const CATALOGOS: Catalogos = {
  nivelesPuesto: [],
  familias: [],
  etapas: [],
  urgencias: [],
  tiposCierre: [{ codigo: 'PERMANENTE', nombre: 'Permanente' }],
  motivosCierre: [],
  estados: [],
}

function vacante(cambios: Partial<Vacante> = {}): Vacante {
  return {
    id: 10,
    titulo: 'Coordinador de sede',
    estado: 'PUBLICADA',
    tipoCierre: 'PERMANENTE',
    puestoId: 5,
    solicitudTalentoId: 30,
    responsableUsuarioId: 3,
    publicadaEn: '2026-09-01T10:00:00Z',
    cerradaEn: null,
    aplicaEvaluacion: false,
    plantillaEvaluacionId: null,
    versionPlantillaPruebaId: null,
    versionPesosId: 9,
    instrumentoEtapaTecnica: 'PLANTILLA',
    minutosEtapaTecnica: null,
    calificacionAutomatica: false,
    remuneracion: { tipo: 'OCULTA', min: null, max: null, moneda: null },
    remuneracionActualizadaEn: null,
    descripcion: 'Lleva la operación de la sede',
    proposito: null,
    responsabilidades: null,
    requisitos: null,
    modalidad: null,
    horario: null,
    ubicacion: null,
    plazas: null,
    abreEn: null,
    cierraEn: null,
    postulantesEnCarrera: 0,
    archivadaEn: null,
    puedeEditar: true,
    puedeArchivar: false,
    puedeDesarchivar: false,
    puedeEliminar: true,
    ...cambios,
  }
}

function pintar(Pantalla: () => ReactElement, ruta = '/admin') {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={[ruta]}>
        <Pantalla />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** Abre el modal de eliminación de la vacante sembrada. */
async function abrirLaEliminacion(titulo = 'Coordinador de sede') {
  pintar(VacantesPanel)
  fireEvent.click(await screen.findByRole('button', { name: `Eliminar la vacante ${titulo}` }))
  return screen.findByRole('dialog', { name: 'Eliminar vacante' })
}

/** Escribe el motivo dentro del modal ya abierto. */
function escribirMotivo(texto: string) {
  fireEvent.change(screen.getByLabelText('Por qué se elimina'), { target: { value: texto } })
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

beforeEach(() => {
  listarVacantes.mockResolvedValue([vacante()])
  contarVacantesArchivadas.mockResolvedValue({ archivadas: 0 })
  eliminarVacante.mockResolvedValue({ postulacionesCerradas: 0, postulantesAvisados: 0 })
})

describe('La papelera de cada fila', () => {
  it('lleva el título en su nombre, como el lápiz y la caja', async () => {
    pintar(VacantesPanel)

    expect(
      await screen.findByRole('button', { name: 'Eliminar la vacante Coordinador de sede' }),
    ).toBeTruthy()
  })

  it('sale también en un borrador, que es donde el archivo no se ofrece', async () => {
    listarVacantes.mockResolvedValue([
      vacante({ estado: 'BORRADOR', puedeArchivar: false, puedeEliminar: true }),
    ])
    pintar(VacantesPanel)

    expect(
      await screen.findByRole('button', { name: /Eliminar la vacante/ }),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Archivar la vacante/ })).toBeNull()
  })

  it('no aparece sin el permiso: el backend lo dice en la fila', async () => {
    listarVacantes.mockResolvedValue([vacante({ puedeEliminar: false })])
    pintar(VacantesPanel)

    await screen.findByText('Coordinador de sede')
    expect(screen.queryByRole('button', { name: /Eliminar la vacante/ })).toBeNull()
  })

  /**
   * El orden es editar, archivar y eliminar, y no es estética: una acción que
   * no se deshace en medio de la fila se pulsa por inercia, apuntando al icono
   * de al lado.
   */
  it('va la última de la fila, detrás del lápiz', async () => {
    listarVacantes.mockResolvedValue([vacante({ puedeEditar: true, puedeEliminar: true })])
    pintar(VacantesPanel)

    await screen.findByRole('button', { name: /Eliminar la vacante/ })
    const nombres = screen
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'))
      .filter((n): n is string => n !== null && /vacante Coordinador/.test(n))

    expect(nombres).toEqual([
      'Editar la vacante Coordinador de sede',
      'Eliminar la vacante Coordinador de sede',
    ])
  })
})

describe('El modal de eliminación', () => {
  it('identifica la vacante y cuenta las consecuencias', async () => {
    const dialogo = await abrirLaEliminacion()

    expect(dialogo.textContent).toContain('Coordinador de sede')
    expect(dialogo.textContent).toContain('Dejará de verse en el panel y en el portal')
    expect(dialogo.textContent).toContain('No se podrá deshacer desde el panel')
  })

  it('dice cuántas postulaciones se van a cerrar cuando hay gente dentro', async () => {
    listarVacantes.mockResolvedValue([vacante({ postulantesEnCarrera: 3 })])
    const dialogo = await abrirLaEliminacion()

    expect(dialogo.textContent).toContain('Se cerrarán sus 3 postulaciones')
    expect(dialogo.textContent).toContain('se les avisará en su portal')
  })

  it('no habla de postulaciones cuando no hay nadie en carrera', async () => {
    const dialogo = await abrirLaEliminacion()

    expect(dialogo.textContent).not.toContain('Se cerrarán')
  })

  it('abrirlo no elimina nada, y cancelarlo tampoco', async () => {
    await abrirLaEliminacion()
    expect(eliminarVacante).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Eliminar vacante' })).toBeNull(),
    )
    expect(eliminarVacante).not.toHaveBeenCalled()
  })

  it('cerrarlo con Escape tampoco elimina', async () => {
    await abrirLaEliminacion()
    escribirMotivo('Duplicada')

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Eliminar vacante' })).toBeNull(),
    )
    expect(eliminarVacante).not.toHaveBeenCalled()
  })
})

describe('El motivo obligatorio', () => {
  it('el botón nace apagado', async () => {
    await abrirLaEliminacion()

    expect(
      screen.getByRole('button', { name: 'Eliminar vacante' }).hasAttribute('disabled'),
    ).toBe(true)
  })

  it('un motivo de solo espacios no lo enciende', async () => {
    await abrirLaEliminacion()

    escribirMotivo('    ')

    expect(
      screen.getByRole('button', { name: 'Eliminar vacante' }).hasAttribute('disabled'),
    ).toBe(true)
  })

  it('con un motivo escrito se enciende, y viaja recortado', async () => {
    await abrirLaEliminacion()

    escribirMotivo('  Se creó con el puesto equivocado  ')
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar vacante' }))

    await waitFor(() =>
      expect(eliminarVacante).toHaveBeenCalledWith(10, 'Se creó con el puesto equivocado'),
    )
  })
})

describe('Lo que se dice después', () => {
  it('sin nadie en carrera, solo que se eliminó', async () => {
    await abrirLaEliminacion()
    escribirMotivo('Duplicada por error')

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar vacante' }))

    expect(await screen.findByRole('status')).toHaveProperty(
      'textContent',
      'Vacante eliminada',
    )
  })

  it('con todos avisados, lo dice con su número', async () => {
    listarVacantes.mockResolvedValue([vacante({ postulantesEnCarrera: 2 })])
    eliminarVacante.mockResolvedValue({ postulacionesCerradas: 2, postulantesAvisados: 2 })
    await abrirLaEliminacion()
    escribirMotivo('Duplicada por error')

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar vacante' }))

    expect(await screen.findByRole('status')).toHaveProperty(
      'textContent',
      'Vacante eliminada. Se cerraron 2 postulaciones y se les avisó en su portal',
    )
  })

  /**
   * El caso que no se puede redondear: afirmar que a los tres se les avisó
   * cuando llegaron dos es mentir sobre lo único que el candidato comprueba, y
   * el equipo necesita saberlo para escribirle a mano a quien falte.
   */
  it('si algún aviso no salió, informa los dos números por separado', async () => {
    listarVacantes.mockResolvedValue([vacante({ postulantesEnCarrera: 3 })])
    eliminarVacante.mockResolvedValue({ postulacionesCerradas: 3, postulantesAvisados: 2 })
    await abrirLaEliminacion()
    escribirMotivo('Duplicada por error')

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar vacante' }))

    const dicho = await screen.findByRole('status')
    expect(dicho.textContent).toContain('Se cerraron 3 postulaciones y se avisó a 2')
    expect(dicho.textContent).toContain('los avisos que faltan no salieron')
  })
})

describe('Cuando el servidor rechaza', () => {
  it('el modal se queda, con el motivo dentro, y lo dice', async () => {
    eliminarVacante.mockRejectedValue(new Error('Esta vacante ya no existe'))
    await abrirLaEliminacion()
    escribirMotivo('Duplicada por error')

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar vacante' }))

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Esta vacante ya no existe',
    )
    expect(screen.getByRole('dialog', { name: 'Eliminar vacante' })).toBeTruthy()
    expect(screen.getByLabelText('Por qué se elimina')).toHaveProperty(
      'value',
      'Duplicada por error',
    )
  })

  it('y se puede reintentar: la guarda del doble clic se suelta al fallar', async () => {
    eliminarVacante.mockRejectedValueOnce(new Error('Se cayó la red'))
    await abrirLaEliminacion()
    escribirMotivo('Duplicada por error')

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar vacante' }))
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar vacante' }))

    await waitFor(() => expect(eliminarVacante).toHaveBeenCalledTimes(2))
  })
})

describe('Desde Archivadas', () => {
  it('una archivada también ofrece la papelera, sin tener que desarchivarla antes', async () => {
    listarVacantes.mockResolvedValue([
      vacante({
        estado: 'CERRADA',
        archivadaEn: '2026-09-15T10:00:00Z',
        puedeEditar: false,
        puedeDesarchivar: true,
        puedeEliminar: true,
      }),
    ])
    pintar(VacantesArchivadas, '/admin/vacantes-archivadas')

    fireEvent.click(
      await screen.findByRole('button', { name: 'Eliminar la vacante Coordinador de sede' }),
    )
    const dialogo = await screen.findByRole('dialog', { name: 'Eliminar vacante' })

    escribirMotivo('Se archivó por error: no debió existir')
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar vacante' }))

    await waitFor(() =>
      expect(eliminarVacante).toHaveBeenCalledWith(10, 'Se archivó por error: no debió existir'),
    )
    expect(dialogo).toBeTruthy()
    expect((await screen.findByRole('status')).textContent).toContain('Vacante eliminada')
  })
})
