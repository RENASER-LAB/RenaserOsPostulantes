/**
 * Archivar desde la lista, y consultar lo archivado.
 *
 * Lo que se protege aquí es lo que se rompe sin que nada falle:
 *
 *   0. **El icono donde no se puede archivar.** Una publicada o una que ya está
 *      guardada no lo ofrecen: el backend lo dice en la fila y la pantalla no
 *      vuelve a decidirlo por su cuenta.
 *   1. **Archivar sin confirmar.** Retirar una vacante de la mesa de trabajo de
 *      todo el equipo no puede ser un clic sin vuelta atrás.
 *   2. **Un botón apagado sin explicación.** Con gente en carrera no se puede, y
 *      el modal dice cuántos son y adónde ir a decidirlos.
 *   3. **Retirar la fila como si hubiera ido bien.** Si el servidor rechaza, el
 *      modal se queda y lo dice.
 *   4. **Dos listas confundidas.** `/admin` no puede enseñar archivadas, y la
 *      vista de archivadas se pide al servidor, no se filtra aquí.
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
const archivarVacante = vi.fn()
const desarchivarVacante = vi.fn()

vi.mock('../api/panel', () => ({
  listarVacantes: (archivadas?: boolean) => listarVacantes(archivadas),
  contarVacantesArchivadas: () => contarVacantesArchivadas(),
  archivarVacante: (id: number) => archivarVacante(id),
  desarchivarVacante: (id: number) => desarchivarVacante(id),
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
    estado: 'CERRADA',
    tipoCierre: 'PERMANENTE',
    puestoId: 5,
    solicitudTalentoId: 30,
    responsableUsuarioId: 3,
    publicadaEn: '2026-09-01T10:00:00Z',
    cerradaEn: '2026-09-10T10:00:00Z',
    aplicaEvaluacion: true,
    plantillaEvaluacionId: null,
    versionPlantillaPruebaId: null,
    versionPesosId: null,
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
    ciudad: null,
    plazas: null,
    abreEn: null,
    cierraEn: null,
    postulantesEnCarrera: 0,
    archivadaEn: null,
    puedeEditar: false,
    puedeArchivar: true,
    puedeDesarchivar: false,
    puedeEliminar: false,
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

/** Abre el modal de archivo de la vacante sembrada. */
async function abrirElArchivo(titulo = 'Coordinador de sede') {
  pintar(VacantesPanel)
  fireEvent.click(await screen.findByRole('button', { name: `Archivar la vacante ${titulo}` }))
  return screen.findByRole('dialog', { name: 'Archivar vacante' })
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

beforeEach(() => {
  listarVacantes.mockResolvedValue([vacante()])
  contarVacantesArchivadas.mockResolvedValue({ archivadas: 3 })
  archivarVacante.mockResolvedValue(undefined)
  desarchivarVacante.mockResolvedValue(undefined)
})

describe('El icono de archivo de cada fila', () => {
  it('lleva el título en su nombre, como el lápiz', async () => {
    pintar(VacantesPanel)

    expect(
      await screen.findByRole('button', { name: 'Archivar la vacante Coordinador de sede' }),
    ).toBeTruthy()
  })

  it('no aparece donde el backend dice que no se puede archivar', async () => {
    // Una publicada no se archiva, y sin `cerrar_vacante` tampoco. Las dos
    // llegan como `puedeArchivar: false`.
    listarVacantes.mockResolvedValue([
      vacante({ estado: 'PUBLICADA', puedeArchivar: false, puedeEditar: true }),
    ])
    pintar(VacantesPanel)

    await screen.findByText('Coordinador de sede')
    expect(screen.queryByRole('button', { name: /Archivar la vacante/ })).toBeNull()
  })

  it('aparece aunque queden postulantes en carrera: su modal es el que lo explica', async () => {
    listarVacantes.mockResolvedValue([vacante({ postulantesEnCarrera: 3 })])
    pintar(VacantesPanel)

    expect(
      await screen.findByRole('button', { name: 'Archivar la vacante Coordinador de sede' }),
    ).toBeTruthy()
  })
})

describe('El modal de confirmación', () => {
  it('identifica la vacante y cuenta lo que va a pasar', async () => {
    const dialogo = await abrirElArchivo()

    expect(dialogo.textContent).toContain('Coordinador de sede')
    expect(dialogo.textContent).toContain('Deja la lista habitual')
    expect(dialogo.textContent).toContain('Vacantes archivadas')
    expect(dialogo.textContent).toContain('desarchivar')
  })

  it('abrirlo no archiva nada, y cancelarlo tampoco', async () => {
    await abrirElArchivo()
    expect(archivarVacante).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Archivar vacante' })).toBeNull(),
    )
    expect(archivarVacante).not.toHaveBeenCalled()
  })

  it('confirmar archiva y lo dice en voz alta', async () => {
    await abrirElArchivo()

    fireEvent.click(screen.getByRole('button', { name: 'Archivar vacante' }))

    await waitFor(() => expect(archivarVacante).toHaveBeenCalledWith(10))
    expect(await screen.findByRole('status')).toHaveProperty(
      'textContent',
      '«Coordinador de sede» está en Archivadas. Puedes desarchivarla cuando quieras.',
    )
  })

  it('con gente en carrera no deja confirmar, y dice cuántos son y adónde ir', async () => {
    listarVacantes.mockResolvedValue([vacante({ postulantesEnCarrera: 3 })])
    const dialogo = await abrirElArchivo()

    expect(dialogo.textContent).toContain('Quedan 3 postulantes en carrera')
    expect(dialogo.textContent).toContain('descártalos en lote')
    // Y el enlace a la vacante, que es donde se deciden.
    expect(screen.getByRole('link', { name: /Ir a Coordinador de sede/ })).toBeTruthy()

    const confirmar = screen.getByRole('button', { name: 'Archivar vacante' })
    expect((confirmar as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(confirmar)
    expect(archivarVacante).not.toHaveBeenCalled()
  })

  it('si el servidor rechaza, el modal se queda y explica: la fila no se retira', async () => {
    archivarVacante.mockRejectedValue(
      new Error('Quedan 1 postulantes en carrera. Decide cada uno…'),
    )
    await abrirElArchivo()

    fireEvent.click(screen.getByRole('button', { name: 'Archivar vacante' }))

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Quedan 1 postulantes en carrera. Decide cada uno…',
    )
    expect(screen.getByRole('dialog', { name: 'Archivar vacante' })).toBeTruthy()
  })

  /**
   * El doble clic, que es el gesto de verdad.
   *
   * `disabled={isPending}` no llega a aplicarse entre las dos pulsaciones de un
   * doble clic: React vuelve a pintar después, y para entonces las dos ya
   * salieron. La guarda que sostiene esto es un ref que se escribe en el mismo
   * turno del evento. (El backend tiene la suya —el UPDATE condicional—, y hace
   * falta igual: dos pestañas abiertas no comparten este ref.)
   */
  it('un doble clic manda una sola petición: el disabled llega tarde', async () => {
    let soltar!: (valor: unknown) => void
    archivarVacante.mockReturnValue(new Promise((resolver) => {
      soltar = resolver
    }))
    await abrirElArchivo()
    const confirmar = screen.getByRole('button', { name: 'Archivar vacante' })

    // Las dos pulsaciones en el mismo turno, sin dejar que React pinte en medio.
    fireEvent.click(confirmar)
    fireEvent.click(confirmar)

    // `mutate()` sale en una microtarea, así que se espera a la primera y se
    // exige que la segunda no haya llegado nunca.
    await waitFor(() => expect(archivarVacante).toHaveBeenCalled())
    expect(archivarVacante).toHaveBeenCalledTimes(1)
    soltar(undefined)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('tras un fallo se puede reintentar: lo que no se repite es la misma confirmación', async () => {
    archivarVacante.mockRejectedValueOnce(new Error('La red se cayó'))
    await abrirElArchivo()

    fireEvent.click(screen.getByRole('button', { name: 'Archivar vacante' }))
    await screen.findByRole('alert')

    archivarVacante.mockResolvedValue(undefined)
    fireEvent.click(screen.getByRole('button', { name: 'Archivar vacante' }))

    await waitFor(() => expect(archivarVacante).toHaveBeenCalledTimes(2))
  })

  it('el botón se apaga mientras la petición está en vuelo: dos clics no son dos archivos', async () => {
    let soltar!: (valor: unknown) => void
    archivarVacante.mockReturnValue(new Promise((resolver) => {
      soltar = resolver
    }))
    await abrirElArchivo()
    fireEvent.click(screen.getByRole('button', { name: 'Archivar vacante' }))

    const boton = await screen.findByRole('button', { name: 'Archivando…' })
    expect((boton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(boton)
    expect(archivarVacante).toHaveBeenCalledTimes(1)

    soltar(undefined)
  })
})

describe('La cabecera', () => {
  it('lleva a Archivadas con su cuenta, junto a las otras dos acciones', async () => {
    pintar(VacantesPanel)

    const boton = await screen.findByRole('link', { name: 'Archivadas (3)' })
    expect(boton.getAttribute('href')).toBe('/admin/archivadas')
    // Y no hay un selector redundante de «Activas / Archivadas».
    expect(screen.queryByLabelText(/Activas/)).toBeNull()
  })

  /**
   * El número cuenta lo que acaba de pasar.
   *
   * Vive en la misma cabecera que el aviso «… está en Archivadas»: sin refrescar
   * la clave del contador, la pantalla se contradice en dos líneas seguidas, y
   * la de arriba —la que se pulsa— es la que miente.
   */
  it('al archivar, el contador se vuelve a pedir: no se queda en el número viejo', async () => {
    contarVacantesArchivadas.mockResolvedValue({ archivadas: 0 })
    await abrirElArchivo()
    expect(await screen.findByRole('link', { name: 'Archivadas (0)' })).toBeTruthy()

    contarVacantesArchivadas.mockResolvedValue({ archivadas: 1 })
    fireEvent.click(screen.getByRole('button', { name: 'Archivar vacante' }))

    expect(await screen.findByRole('link', { name: 'Archivadas (1)' })).toBeTruthy()
  })

  it('con cero archivadas lo dice igual: entrar para descubrir que no hay nada es peor', async () => {
    contarVacantesArchivadas.mockResolvedValue({ archivadas: 0 })
    pintar(VacantesPanel)

    expect(await screen.findByRole('link', { name: 'Archivadas (0)' })).toBeTruthy()
  })

  it('la lista habitual se pide sin archivadas: el corte lo hace el servidor', async () => {
    pintar(VacantesPanel)

    await screen.findByText('Coordinador de sede')
    expect(listarVacantes).toHaveBeenCalledWith(undefined)
  })
})

describe('La vista de archivadas', () => {
  it('pide al servidor solo las archivadas y enseña su fecha', async () => {
    listarVacantes.mockResolvedValue([
      vacante({ archivadaEn: '2026-09-15T10:00:00Z', puedeArchivar: false, puedeDesarchivar: true }),
    ])
    pintar(VacantesArchivadas, '/admin/archivadas')

    await screen.findByText('Coordinador de sede')
    expect(listarVacantes).toHaveBeenCalledWith(true)
    // La fecha en la columna de archivo: es el dato que distingue esta vista.
    expect(screen.getByRole('columnheader', { name: 'Archivada' })).toBeTruthy()
    expect(screen.getByText('15 de setiembre de 2026')).toBeTruthy()
    // Y el estado se sigue diciendo: archivar no cambió cómo terminó.
    expect(screen.getByText('Cerrada')).toBeTruthy()
  })

  it('vacía lo dice con esas palabras', async () => {
    listarVacantes.mockResolvedValue([])
    pintar(VacantesArchivadas, '/admin/archivadas')

    expect(await screen.findByText('No hay vacantes archivadas.')).toBeTruthy()
  })

  it('tiene la vuelta a la lista habitual', async () => {
    listarVacantes.mockResolvedValue([])
    pintar(VacantesArchivadas, '/admin/archivadas')

    const volver = await screen.findByRole('link', { name: '← Volver a vacantes' })
    expect(volver.getAttribute('href')).toBe('/admin')
  })

  it('desarchivar la devuelve a la lista y lo dice, sin reabrirla', async () => {
    listarVacantes.mockResolvedValue([
      vacante({ archivadaEn: '2026-09-15T10:00:00Z', puedeArchivar: false, puedeDesarchivar: true }),
    ])
    pintar(VacantesArchivadas, '/admin/archivadas')

    fireEvent.click(
      await screen.findByRole('button', { name: 'Desarchivar la vacante Coordinador de sede' }),
    )

    await waitFor(() => expect(desarchivarVacante).toHaveBeenCalledWith(10))
    expect(await screen.findByRole('status')).toHaveProperty(
      'textContent',
      '«Coordinador de sede» vuelve a la lista de vacantes, cerrada como estaba.',
    )
  })

  /**
   * El doble clic en «Desarchivar», que es el mismo gesto que en archivar.
   *
   * Aquí el segundo DELETE llega cuando el primero ya desarchivó: el servidor
   * contesta 409 «Esta vacante no está archivada» —con razón— y la pantalla lo
   * pintaba en rojo encima del aviso de éxito. La operación había ido bien y el
   * panel decía que no.
   */
  it('un doble clic en desarchivar manda una sola petición, y no pinta un error falso', async () => {
    let soltar!: (valor: unknown) => void
    desarchivarVacante.mockReturnValue(new Promise((resolver) => {
      soltar = resolver
    }))
    listarVacantes.mockResolvedValue([
      vacante({ archivadaEn: '2026-09-15T10:00:00Z', puedeArchivar: false, puedeDesarchivar: true }),
    ])
    pintar(VacantesArchivadas, '/admin/archivadas')
    const boton = await screen.findByRole('button', {
      name: 'Desarchivar la vacante Coordinador de sede',
    })

    // Las dos pulsaciones en el mismo turno, sin dejar que React pinte en medio.
    fireEvent.click(boton)
    fireEvent.click(boton)

    await waitFor(() => expect(desarchivarVacante).toHaveBeenCalled())
    expect(desarchivarVacante).toHaveBeenCalledTimes(1)

    soltar(undefined)
    expect(await screen.findByRole('status')).toHaveProperty(
      'textContent',
      '«Coordinador de sede» vuelve a la lista de vacantes, cerrada como estaba.',
    )
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('tras un fallo se puede reintentar: la guarda se suelta', async () => {
    desarchivarVacante.mockRejectedValueOnce(new Error('La red se cayó'))
    listarVacantes.mockResolvedValue([
      vacante({ archivadaEn: '2026-09-15T10:00:00Z', puedeArchivar: false, puedeDesarchivar: true }),
    ])
    pintar(VacantesArchivadas, '/admin/archivadas')
    const boton = await screen.findByRole('button', {
      name: 'Desarchivar la vacante Coordinador de sede',
    })

    fireEvent.click(boton)
    await screen.findByRole('alert')

    fireEvent.click(boton)

    await waitFor(() => expect(desarchivarVacante).toHaveBeenCalledTimes(2))
  })

  it('sin el permiso no ofrece desarchivar, y la vista se consulta igual', async () => {
    listarVacantes.mockResolvedValue([
      vacante({ archivadaEn: '2026-09-15T10:00:00Z', puedeArchivar: false, puedeDesarchivar: false }),
    ])
    pintar(VacantesArchivadas, '/admin/archivadas')

    await screen.findByText('Coordinador de sede')
    expect(screen.queryByRole('button', { name: /Desarchivar/ })).toBeNull()
  })

  it('si desarchivar falla, lo dice y no promete nada', async () => {
    desarchivarVacante.mockRejectedValue(new Error('Esta vacante no está archivada'))
    listarVacantes.mockResolvedValue([
      vacante({ archivadaEn: '2026-09-15T10:00:00Z', puedeArchivar: false, puedeDesarchivar: true }),
    ])
    pintar(VacantesArchivadas, '/admin/archivadas')

    fireEvent.click(
      await screen.findByRole('button', { name: 'Desarchivar la vacante Coordinador de sede' }),
    )

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Esta vacante no está archivada',
    )
  })
})
