/**
 * Corregir una vacante desde la lista.
 *
 * Lo que se protege aquí es lo que el panel **dice** alrededor del guardado, que
 * es donde esto se rompe sin que nada falle:
 *
 *   0. **El lápiz donde no se puede editar.** Un botón que siempre contesta 409
 *      —o 404, con el permiso acotado— es una promesa rota, y el backend ya
 *      manda la respuesta dicha en la fila.
 *   1. **«Guardado» cuando no se guardó nada.** El formulario se manda entero, y
 *      quien entra a mirar y pulsa guardar sin tocar nada llega ahí.
 *   2. **Callar a cuánta gente le va a llegar.** Cambiar el horario de una
 *      vacante publicada le cambia las condiciones a quien está dentro del
 *      proceso; decirlo después es decirlo tarde.
 *   3. **Perder lo escrito al fallar.** Tres párrafos redactados no se tiran
 *      porque el sueldo llevara un cero de más.
 *   4. **Dos formularios abiertos.** Son dos borradores distintos de lo mismo, y
 *      el que se guarda no siempre es el que se estaba mirando.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { VacantesPanel } from './Vacantes'
import { ErrorApi } from '@/api/puerta'
import type { Catalogos, VacantePanel as Vacante } from '../api/tipos'

const listarVacantes = vi.fn()
const editarVacante = vi.fn()

vi.mock('../api/panel', () => ({
  listarVacantes: () => listarVacantes(),
  contarVacantesArchivadas: () => Promise.resolve({ archivadas: 0 }),
  editarVacante: (id: number, datos: unknown) => editarVacante(id, datos),
  listarSolicitudes: () => Promise.resolve([]),
  listarPuestos: () =>
    Promise.resolve([
      {
        id: 5,
        codigo: 'DEV',
        nombre: 'Desarrollador web',
        nivelPuestoCodigo: 'EJECUCION',
        familiaCodigo: 'TECNOLOGIA',
      },
    ]),
  listarUsuarios: () => Promise.resolve([{ id: 3, correo: 'ana@renaser.pe' }]),
  listarAreas: () => Promise.resolve([]),
  verCatalogos: () => Promise.resolve(CATALOGOS),
  crearVacante: () => Promise.resolve({}),
  crearSolicitud: () => Promise.resolve(1),
  crearPuesto: () => Promise.resolve(1),
  aprobarSolicitud: () => Promise.resolve({}),
}))

const CATALOGOS: Catalogos = {
  nivelesPuesto: [{ codigo: 'EJECUCION', nombre: 'Ejecución' }],
  familias: [{ codigo: 'TECNOLOGIA', nombre: 'Tecnología' }],
  etapas: [],
  urgencias: [{ codigo: 'NORMAL', nombre: 'Normal' }],
  tiposCierre: [
    { codigo: 'PERMANENTE', nombre: 'Permanente' },
    { codigo: 'PLAZAS', nombre: 'Por plazas' },
  ],
  motivosCierre: [],
  estados: [],
}

function vacante(cambios: Partial<Vacante> = {}): Vacante {
  return {
    id: 10,
    titulo: 'Desarrollador web',
    estado: 'PUBLICADA',
    tipoCierre: 'PERMANENTE',
    puestoId: 5,
    solicitudTalentoId: 30,
    responsableUsuarioId: 3,
    publicadaEn: '2026-09-01T10:00:00Z',
    cerradaEn: null,
    aplicaEvaluacion: true,
    plantillaEvaluacionId: null,
    versionPlantillaPruebaId: null,
    versionPesosId: null,
    instrumentoEtapaTecnica: 'PLANTILLA',
    minutosEtapaTecnica: null,
    calificacionAutomatica: false,
    remuneracion: { tipo: 'FIJA', min: 3000, max: null, moneda: 'PEN' },
    remuneracionActualizadaEn: null,
    descripcion: 'Sostiene el portal de talento',
    proposito: null,
    responsabilidades: null,
    requisitos: null,
    modalidad: 'Híbrido',
    horario: 'L-V de 9 a 6',
    ubicacion: 'Lima',
    plazas: null,
    abreEn: null,
    cierraEn: null,
    postulantesEnCarrera: 2,
    archivadaEn: null,
    puedeEditar: true,
    puedeArchivar: false,
    puedeDesarchivar: false,
    puedeEliminar: false,
    ...cambios,
  }
}

function pintar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={['/admin']}>
        <VacantesPanel />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** Abre la edición de la primera vacante y espera a que el formulario esté. */
async function abrirLaEdicion(titulo = 'Desarrollador web') {
  pintar()
  fireEvent.click(await screen.findByRole('button', { name: `Editar la vacante ${titulo}` }))
  await screen.findByRole('heading', { name: 'Editar vacante' })
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

beforeEach(() => {
  listarVacantes.mockResolvedValue([vacante()])
  editarVacante.mockResolvedValue({ huboCambios: true, postulantesAvisados: 2 })
})

describe('El lápiz de cada fila', () => {
  it('lleva el título en su nombre, para distinguirlo entre veinte filas iguales', async () => {
    pintar()

    expect(
      await screen.findByRole('button', { name: 'Editar la vacante Desarrollador web' }),
    ).toBeTruthy()
  })

  it('no aparece donde el backend dice que no se puede editar', async () => {
    // Una cerrada no se edita, y con el permiso acotado a «sus vacantes» la de
    // otro responsable responde 404. Las dos llegan como `puedeEditar: false`.
    listarVacantes.mockResolvedValue([
      vacante({ id: 11, titulo: 'Analista', estado: 'CERRADA', puedeEditar: false }),
    ])
    pintar()

    await screen.findByText('Analista')
    expect(screen.queryByRole('button', { name: /Editar la vacante/ })).toBeNull()
  })
})

describe('El modal de edición', () => {
  it('es un diálogo con título, cierre con nombre y los dos botones del pie', async () => {
    await abrirLaEdicion()

    const dialogo = screen.getByRole('dialog')
    expect(dialogo.getAttribute('aria-modal')).toBe('true')
    // El aspa lleva nombre accesible: un «×» a secas no se puede pulsar a ciegas.
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeTruthy()
  })

  it('sin cambios, cancelar cierra sin preguntar y sin guardar nada', async () => {
    await abrirLaEdicion()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(editarVacante).not.toHaveBeenCalled()
  })

  it('con cambios, cancelar pregunta y «Seguir editando» los conserva', async () => {
    await abrirLaEdicion()
    fireEvent.change(screen.getByLabelText('Horario'), { target: { value: 'Turnos' } })

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    // No se ha ido nada: el modal sigue y la pregunta está dentro.
    expect(await screen.findByRole('alertdialog', { name: 'Cambios sin guardar' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Seguir editando' }))

    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect((screen.getByLabelText('Horario') as HTMLInputElement).value).toBe('Turnos')
    expect(editarVacante).not.toHaveBeenCalled()
  })

  it('«Descartar cambios» cierra sin guardar ni avisar', async () => {
    await abrirLaEdicion()
    fireEvent.change(screen.getByLabelText('Horario'), { target: { value: 'Turnos' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    fireEvent.click(await screen.findByRole('button', { name: 'Descartar cambios' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(editarVacante).not.toHaveBeenCalled()
    // Y lo descartado se descartó de verdad: al reabrir está lo guardado.
    fireEvent.click(screen.getByRole('button', { name: 'Editar la vacante Desarrollador web' }))
    expect((await screen.findByLabelText('Horario') as HTMLInputElement).value)
      .toBe('L-V de 9 a 6')
  })

  it('Escape con cambios tampoco tira lo escrito: pregunta igual que Cancelar', async () => {
    await abrirLaEdicion()
    fireEvent.change(screen.getByLabelText('Horario'), { target: { value: 'Turnos' } })

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(await screen.findByRole('alertdialog', { name: 'Cambios sin guardar' })).toBeTruthy()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('Escape sin cambios cierra, como cancelar', async () => {
    await abrirLaEdicion()

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('la tabla sigue entera detrás del modal: no se desplaza ni desaparece', async () => {
    await abrirLaEdicion()

    // La fila que se está editando sigue visible: el modal no empuja la lista.
    expect(screen.getAllByText('Desarrollador web').length).toBeGreaterThan(0)
    expect(screen.getByRole('table')).toBeTruthy()
  })

  it('mientras guarda no se puede cerrar con Escape: la petición ya salió', async () => {
    let soltar!: (valor: unknown) => void
    editarVacante.mockReturnValue(new Promise((resolver) => {
      soltar = resolver
    }))
    await abrirLaEdicion()
    fireEvent.change(screen.getByLabelText('Horario'), { target: { value: 'Turnos' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await screen.findByRole('button', { name: 'Guardando…' })

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.queryByRole('alertdialog')).toBeNull()

    soltar({ huboCambios: true, postulantesAvisados: 0 })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})

describe('El formulario de edición', () => {
  it('se abre con los datos de ahora y con la solicitud y el puesto como texto fijo', async () => {
    await abrirLaEdicion()

    expect((screen.getByLabelText('Título que ve quien postula') as HTMLInputElement).value)
      .toBe('Desarrollador web')
    expect((screen.getByLabelText('Descripción') as HTMLTextAreaElement).value)
      .toBe('Sostiene el portal de talento')
    expect((screen.getByLabelText('Horario') as HTMLInputElement).value).toBe('L-V de 9 a 6')
    // El sueldo también viene puesto: el cuerpo es el formulario entero y lo que
    // no viaja se borra.
    // Con regex: la etiqueta comparte caja con el símbolo de la moneda, así que
    // su texto es «Monto mensual» seguido de «S/».
    expect((screen.getByLabelText(/Monto mensual/) as HTMLInputElement).value).toBe('3000')

    expect(screen.getByText(/El puesto decide el nivel y la familia/)).toBeTruthy()
    expect(screen.getByText(/Solicitud #30/)).toBeTruthy()
    // Y no hay desplegable para cambiarlos.
    expect(screen.queryByLabelText('Solicitud aprobada que la respalda')).toBeNull()
  })

  it('abrirlo cierra el alta: un solo formulario a la vez', async () => {
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: 'Crear vacante' }))
    await screen.findByRole('heading', { name: /Vacante nueva|Buscando las solicitudes/ })

    fireEvent.click(
      screen.getByRole('button', { name: 'Editar la vacante Desarrollador web' }),
    )

    await screen.findByRole('heading', { name: 'Editar vacante' })
    expect(screen.queryByRole('heading', { name: 'Vacante nueva' })).toBeNull()
  })

  it('dice a cuánta gente le va a llegar, sin pedir confirmación', async () => {
    await abrirLaEdicion()

    expect(
      screen.getByText(
        'Al guardar, avisaremos en su portal a 2 postulantes en carrera de lo que cambies',
      ),
    ).toBeTruthy()
  })

  it('en borrador no promete ningún aviso: no hay a quién', async () => {
    listarVacantes.mockResolvedValue([
      vacante({ estado: 'BORRADOR', postulantesEnCarrera: 0 }),
    ])
    await abrirLaEdicion()

    expect(screen.queryByText(/avisaremos en su portal/)).toBeNull()
  })
})

describe('Al guardar', () => {
  it('manda el formulario entero, con el sueldo dentro', async () => {
    await abrirLaEdicion()
    fireEvent.change(screen.getByLabelText('Horario'), {
      target: { value: 'Turnos rotativos' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(editarVacante).toHaveBeenCalled())
    const [id, cuerpo] = editarVacante.mock.calls[0] ?? []
    expect(id).toBe(10)
    expect(cuerpo).toMatchObject({
      solicitudTalentoId: 30,
      titulo: 'Desarrollador web',
      horario: 'Turnos rotativos',
      remuneracion: { tipo: 'FIJA', min: 3000, moneda: 'PEN' },
    })
  })

  it('dice a cuánta gente se avisó de verdad', async () => {
    await abrirLaEdicion()
    fireEvent.change(screen.getByLabelText('Horario'), {
      target: { value: 'Turnos rotativos' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(
      await screen.findByText('Cambios guardados. Avisamos a 2 postulantes en su portal'),
    ).toBeTruthy()
    // Y el formulario se cierra: lo que se quería corregir ya está corregido.
    expect(screen.queryByRole('heading', { name: 'Editar vacante' })).toBeNull()
  })

  it('sin nadie a quien avisar, se limita a decir que se guardó', async () => {
    editarVacante.mockResolvedValue({ huboCambios: true, postulantesAvisados: 0 })
    await abrirLaEdicion()
    fireEvent.change(screen.getByLabelText('Horario'), { target: { value: 'Mañanas' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('Cambios guardados')).toBeTruthy()
  })

  it('si no había nada que cambiar, lo dice con esas palabras', async () => {
    // Es el camino más normal del mundo: entrar a mirar y pulsar guardar. Un
    // «guardado» ahí afirma algo que no pasó.
    editarVacante.mockResolvedValue({ huboCambios: false, postulantesAvisados: 0 })
    await abrirLaEdicion()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('No había cambios que guardar')).toBeTruthy()
  })

  it('si la vacante desapareció de la lista, el fallo se dice fuera del modal', async () => {
    /*
     * El caso que trajo la eliminación: alguien retira la vacante mientras otra
     * persona la está corrigiendo. El backend contesta 404 y no guarda nada —eso
     * ya funcionaba—, pero el error se escribía DENTRO del modal y el mismo
     * fallo refresca la lista: la fila se va, el modal se desmonta con ella y el
     * mensaje se va con el modal. Lo que se veía era un formulario cerrándose
     * solo, idéntico a un guardado correcto.
     */
    listarVacantes
      .mockResolvedValueOnce([vacante()])
      // El refresco de después del fallo: la vacante ya no existe para el panel.
      .mockResolvedValue([])
    editarVacante.mockRejectedValue(new ErrorApi(404, 'Vacante no encontrada con id: 10'))
    await abrirLaEdicion()
    fireEvent.change(screen.getByLabelText('Descripción'), {
      target: { value: 'Un texto largo que costó escribir' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    // El modal se va con su fila, y el aviso se queda en la pantalla.
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Editar vacante' })).toBeNull(),
    )
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'No se guardó nada en «Desarrollador web»: Vacante no encontrada con id: 10',
    )
    // Y no se dice lo contrario por otro lado: nada de «Cambios guardados».
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('mientras el modal sigue abierto el fallo no se repite fuera', async () => {
    // Dicho dos veces se lee dos veces, y un lector de pantalla lo anuncia dos
    // veces. Fuera solo cuando dentro ya no hay dónde decirlo.
    editarVacante.mockRejectedValue(new Error('Una vacante cerrada no se edita'))
    await abrirLaEdicion()
    fireEvent.change(screen.getByLabelText('Horario'), { target: { value: 'Turnos' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('el error se enseña junto al formulario y lo escrito se queda', async () => {
    editarVacante.mockRejectedValue(new Error('Una vacante cerrada no se edita'))
    await abrirLaEdicion()
    fireEvent.change(screen.getByLabelText('Descripción'), {
      target: { value: 'Un texto largo que costó escribir' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Una vacante cerrada no se edita',
    )
    expect((screen.getByLabelText('Descripción') as HTMLTextAreaElement).value)
      .toBe('Un texto largo que costó escribir')
  })

  it('el botón se apaga mientras la petición está en vuelo: dos clics no son dos guardados', async () => {
    let soltar!: (valor: unknown) => void
    editarVacante.mockReturnValue(new Promise((resolver) => {
      soltar = resolver
    }))
    await abrirLaEdicion()
    fireEvent.change(screen.getByLabelText('Horario'), { target: { value: 'Mañanas' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    const boton = await screen.findByRole('button', { name: 'Guardando…' })
    expect((boton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(boton)
    expect(editarVacante).toHaveBeenCalledTimes(1)

    soltar({ huboCambios: true, postulantesAvisados: 0 })
  })

  it('la forma de cierre por plazas no se manda sin un número entero', async () => {
    // `Number('5,5')` es NaN, y un NaN viaja como `null`: sin esta comprobación la
    // vacante se guardaría «por plazas» sin ninguna plaza y sin decir nada.
    await abrirLaEdicion()
    // El desplegable espera a su catálogo: hasta que llega no tiene esa opción.
    await screen.findByRole('option', { name: 'Por plazas' })
    fireEvent.change(screen.getByLabelText('Cómo se cierra'), { target: { value: 'PLAZAS' } })
    fireEvent.change(await screen.findByLabelText('Cuántas plazas'), {
      target: { value: '5,5' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Escribe cuántas plazas hay, en un número entero.',
    )
    expect(editarVacante).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Cuántas plazas'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(editarVacante).toHaveBeenCalled())
    expect(editarVacante.mock.calls[0]?.[1]).toMatchObject({ tipoCierre: 'PLAZAS', plazas: 3 })
  })

  it('cambiar el sueldo de una publicada no se manda sin decir por qué', async () => {
    await abrirLaEdicion()
    fireEvent.change(screen.getByLabelText(/Monto mensual/), { target: { value: '3500' } })

    // El campo del motivo aparece solo cuando el sueldo cambia de verdad: pedirlo
    // siempre sería pedir una justificación por no haber tocado nada.
    const motivo = await screen.findByLabelText('Por qué cambia el sueldo')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(editarVacante).not.toHaveBeenCalled()
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Escribe por qué cambia el sueldo: queda en la auditoría de la vacante.',
    )

    fireEvent.change(motivo, { target: { value: 'Subió el presupuesto' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(editarVacante).toHaveBeenCalled())
    expect(editarVacante.mock.calls[0]?.[1]).toMatchObject({
      motivoRemuneracion: 'Subió el presupuesto',
      remuneracion: { tipo: 'FIJA', min: 3500 },
    })
  })
})
