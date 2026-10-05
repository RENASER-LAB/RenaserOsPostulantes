/**
 * El editor de la prueba técnica, más simple (V68).
 *
 *   - Habla con `/prueba-propia`, no con `/preguntas-propias`.
 *   - El orden: cabecera fija, caso (plegado), criterios, guía y entregables
 *     generales; sin selector de tipo ni «cuestionario» (AC-01).
 *   - Los criterios salen plegados salvo los que tienen falta; la línea dice
 *     puntos, desglose, preguntas y archivos (AC-15).
 *   - El formulario del criterio no tiene «Mira»; «Mira» es automático (AC-04).
 *   - Un archivo se pide desde la pregunta; el enlace en un criterio de IA
 *     avisa en el momento (AC-07).
 *   - Las faltas llevan a donde se arreglan; la de la fecha abre la
 *     configuración con el cursor en el campo (AC-08, AC-16).
 *   - La configuración: tiempo sin días, fecha en hora de Lima, guías «!»
 *     (AC-09, AC-12, AC-18).
 *   - El caso: quitarlo pide confirmación (AC-03) y no promete el correo (AC-24).
 *   - Sin `editar_vacante`, en lectura (AC-23).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ErrorApi } from '../../api/cliente'
import type {
  EditorDePreguntas as Editor,
  EntregableDeLaVersion,
  VersionDePreguntas,
} from '../../api/preguntasPropias'
import { EditorDeLaPrueba, chipDelTiempo } from './EditorDeLaPrueba'
import { VistaDeVersion } from './VistaDeVersion'

const ver = vi.fn()
const publicar = vi.fn()
const agregarPregunta = vi.fn()
const verRecomendacion = vi.fn()
const listarCopiables = vi.fn()
const quitarEntregable = vi.fn()
const agregarEntregable = vi.fn()
const guardarDatos = vi.fn()
const fijarFecha = vi.fn()
const quitarConsigna = vi.fn()

vi.mock('../../api/preguntasPropias', async (original) => ({
  ...(await original<typeof import('../../api/preguntasPropias')>()),
  verPreguntasPropias: (id: number, ruta?: string) => ver(id, ruta),
  publicarPreguntas: (id: number, ruta?: string) => publicar(id, ruta),
  agregarPregunta: (id: number, datos: unknown, ruta?: string) => agregarPregunta(id, datos, ruta),
  verRecomendacion: (id: number, ruta?: string) => verRecomendacion(id, ruta),
  listarCopiables: () => listarCopiables(),
}))

vi.mock('../../api/pruebaPropia', async (original) => ({
  ...(await original<typeof import('../../api/pruebaPropia')>()),
  quitarEntregable: (id: number, entregableId: number) => quitarEntregable(id, entregableId),
  agregarEntregable: (id: number, datos: unknown) => agregarEntregable(id, datos),
  guardarDatosDeLaPrueba: (id: number, datos: unknown) => guardarDatos(id, datos),
  fijarFechaLimite: (id: number, datos: unknown) => fijarFecha(id, datos),
  quitarConsigna: (id: number) => quitarConsigna(id),
}))

const tablero: EntregableDeLaVersion = {
  id: 301,
  nombre: 'Tablero.xlsx',
  detalle: null,
  formato: 'ARCHIVO',
  obligatorio: true,
  queDebeTener: 'El descuadre ubicado',
  orden: 1,
  criterios: [5],
  alcance: 'PREGUNTA',
  preguntaId: 11,
  cubre: [],
}

const informe: EntregableDeLaVersion = {
  id: 302,
  nombre: 'Informe final',
  detalle: null,
  formato: 'ARCHIVO',
  obligatorio: true,
  queDebeTener: null,
  orden: 2,
  criterios: [5],
  alcance: 'TODA_LA_PRUEBA',
  preguntaId: null,
  cubre: [],
}

const version = (parte: Partial<VersionDePreguntas> = {}): VersionDePreguntas => ({
  id: 70,
  estado: 'BORRADOR',
  guiaCalificacion: null,
  minutosObjetivo: null,
  versionGuia: 1,
  total: 30,
  cuantosCriterios: 1,
  cuantasPreguntas: 2,
  criterios: [
    {
      id: 5,
      nombre: 'Conocimiento contable',
      queEvalua: 'El cierre mensual',
      orden: 1,
      puntos: 30,
      puntosSistema: 10,
      puntosIa: 20,
      puntosCalificados: 20,
      calificador: 'IA',
      entregables: [301, 302],
      preguntas: [
        {
          id: 10,
          tipo: 'OPCION_UNICA',
          enunciado: '¿Qué libro registra primero una venta al crédito?',
          puntos: 10,
          criterioId: 5,
          orden: 1,
          queDebeTener: null,
          opciones: [
            { id: 1, texto: 'Libro diario', puntos: 10, orden: 1 },
            { id: 2, texto: 'Caja', puntos: 0, orden: 2 },
          ],
        },
        {
          id: 11,
          tipo: 'ABIERTA',
          enunciado: '¿Cómo hallaste el descuadre?',
          puntos: 0,
          criterioId: 5,
          orden: 2,
          queDebeTener: 'La cuenta y el monto',
          opciones: [],
        },
      ],
    },
  ],
  sinCriterio: [],
  avisos: ['Los puntos suman 30 de 100: faltan 70.', 'Falta la fecha límite para dar la prueba.'],
  prueba: {
    enunciado: null,
    consigna: null,
    materiales: null,
    herramientasPermitidas: 'Excel',
    modalidad: 'CRONOMETRADA',
    duracionMinutos: 90,
    plazoDias: null,
    cuestionario: false,
    entregables: [tablero, informe],
  },
  ...parte,
})

const editor = (parte: Partial<Editor> = {}): Editor => ({
  vacanteId: 40,
  titulo: 'Asistente contable',
  nivel: 'EJECUCION',
  origen: 'PRUEBA_PROPIA',
  aplicaEvaluacion: true,
  puedeEditar: true,
  hayPostulantes: false,
  borrador: version(),
  publicada: null,
  resumen: { estado: 'BORRADOR', puntos: 30, criterios: 1, preguntas: 2, entregables: 2 },
  recalificacion: null,
  proposito: 'PRUEBA_PUESTO',
  fechaLimite: { cierraEn: null, pideMotivo: false },
  ...parte,
})

function pintar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={['/admin/vacantes/40/prueba']}>
        <Routes>
          <Route path="/admin/vacantes/:id/prueba" element={<EditorDeLaPrueba />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  listarCopiables.mockResolvedValue([])
  verRecomendacion.mockResolvedValue({
    estado: 'SIN_PEDIR',
    motivo: null,
    propuestaId: null,
    puntosQueFaltan: null,
    indicacion: null,
    propuesta: [],
  })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const bloque = () => screen.getByRole('region', { name: 'Criterio Conocimiento contable' })
const desplegar = () => fireEvent.click(within(bloque()).getByRole('button', { name: 'Conocimiento contable' }))

describe('el editor de la prueba', () => {
  it('habla con la prueba de la vacante, no con sus preguntas propias', async () => {
    ver.mockResolvedValue(editor())
    pintar()
    expect(await screen.findByRole('heading', { level: 1, name: /Asistente contable · Prueba técnica/ })).toBeTruthy()
    expect(ver).toHaveBeenCalledWith(40, 'prueba-propia')
  })

  it('el orden es caso, criterios, guía y generales; sin tipo ni «cuestionario» (AC-01)', async () => {
    ver.mockResolvedValue(editor({ borrador: version({ prueba: { ...version().prueba!, entregables: [] } }) }))
    pintar()
    await screen.findByRole('region', { name: 'Balance de la prueba' })
    const titulos = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(titulos).toEqual([
      'Escenario o caso práctico (opcional)',
      'Criterios y preguntas',
      expect.stringMatching(/^Guía de calificación para la IA/),
      'Entregables generales (opcional)',
    ])
    expect(document.body.textContent).not.toMatch(/cuestionario/i)
    expect(screen.getByText('Ninguno. Úsalo solo si un archivo reúne varias respuestas.')).toBeTruthy()
    expect(screen.getByText(/Vale para todo lo que califica la IA en esta prueba/)).toBeTruthy()
  })

  it('vacío: el caso plegado, «Agregar criterio» y las faltas de puntos y fecha', async () => {
    ver.mockResolvedValue(
      editor({ borrador: null, resumen: { estado: 'SIN_PRUEBA', puntos: null, criterios: null, preguntas: null } }),
    )
    pintar()
    const cabecera = await screen.findByRole('region', { name: 'Balance de la prueba' })
    expect(within(cabecera).getByText('0 de 100 pts')).toBeTruthy()
    const faltas = within(cabecera).getByRole('list', { name: 'Lo que frena la publicación' })
    expect(within(faltas).getAllByRole('button')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Agregar un caso' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Agregar criterio' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Recomendaciones por IA' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Copiar de otra vacante' })).toBeTruthy()
  })

  it('la cabecera: balance, resumen, barra por criterio y el chip del tiempo en ámbar sin fecha (AC-17)', async () => {
    ver.mockResolvedValue(editor())
    pintar()
    const cabecera = await screen.findByRole('region', { name: 'Balance de la prueba' })
    expect(within(cabecera).getByText('BORRADOR')).toBeTruthy()
    expect(within(cabecera).getByText('30 de 100 pts')).toBeTruthy()
    expect(cabecera.textContent).toContain('1 criterio · 2 preguntas · 2 entregables')
    expect(within(cabecera).getByRole('img').getAttribute('aria-label')).toBe(
      '30 de 100 puntos · Conocimiento contable: 30',
    )
    expect(within(cabecera).getByText('90 min · falta la fecha límite')).toBeTruthy()
    expect(within(cabecera).getByRole('button', { name: 'Configuración' })).toBeTruthy()
    expect(within(cabecera).getByRole('button', { name: 'Publicar la prueba' })).toBeTruthy()
    // Su alto queda medido para que lo que se baja a ver desde una falta no quede debajo (QA-03).
    expect(cabecera.parentElement!.style.getPropertyValue('--alto-cabecera-fija')).toMatch(/^\d+px$/)
  })

  it('el chip dice la fecha en hora de Lima: «90 min · hasta vie 09/10, 23:59», o «Sin cronómetro»', () => {
    const prueba = version().prueba!
    expect(chipDelTiempo(prueba, '2026-10-10T04:59:00Z')).toEqual({
      texto: '90 min · hasta vie 09/10, 23:59',
      falta: false,
    })
    expect(chipDelTiempo({ ...prueba, modalidad: 'PLAZO_ABIERTO', duracionMinutos: null }, '2026-10-10T04:59:00Z').texto).toBe(
      'Sin cronómetro · hasta vie 09/10, 23:59',
    )
    expect(chipDelTiempo({ ...prueba, duracionMinutos: null }, '2026-10-10T04:59:00Z').falta).toBe(true)
    expect(chipDelTiempo(null, null)).toEqual({ texto: 'Falta el tiempo · falta la fecha límite', falta: true })
  })

  it('un criterio sin falta sale plegado en una línea; desplegado dice su parte calificada y «Mira» automático (AC-15)', async () => {
    ver.mockResolvedValue(editor())
    pintar()
    await screen.findByRole('region', { name: 'Balance de la prueba' })
    expect(within(bloque()).getByText('30 pts (sistema 10 + IA 20)')).toBeTruthy()
    expect(within(bloque()).getByText('· 2 preguntas · 1 archivo')).toBeTruthy()
    expect(within(bloque()).queryByText('¿Cómo hallaste el descuadre?')).toBeNull()
    desplegar()
    expect(within(bloque()).getByText(/20 pts · la califica la IA/)).toBeTruthy()
    const mira = within(bloque()).getByText('automático').closest('p')!
    expect(mira.textContent).toBe('Miraautomático' + 'Tablero.xlsx (pregunta 2) · Informe final (general)')
    // El archivo, dentro de su pregunta; la cerrada, con «Pedir un archivo».
    const abierta = within(bloque()).getByRole('article', { name: 'Pregunta: ¿Cómo hallaste el descuadre?' })
    expect(within(abierta).getByText('Pregunta 2')).toBeTruthy()
    expect(within(abierta).getByText('Tablero.xlsx')).toBeTruthy()
    const cerrada = within(bloque()).getByRole('article', { name: /¿Qué libro registra/ })
    expect(within(cerrada).getByRole('button', { name: 'Pedir un archivo para esta pregunta' })).toBeTruthy()
  })

  it('«Desplegar todo» y «Plegar todo» (AC-15)', async () => {
    ver.mockResolvedValue(editor())
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: 'Desplegar todo' }))
    expect(screen.getByText('¿Cómo hallaste el descuadre?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Plegar todo' }))
    expect(screen.queryByText('¿Cómo hallaste el descuadre?')).toBeNull()
  })

  it('el formulario del criterio no tiene «Mira» (AC-04)', async () => {
    ver.mockResolvedValue(editor())
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: 'Editar el criterio Conocimiento contable' }))
    const form = screen.getByRole('form', { name: 'Editar el criterio Conocimiento contable' })
    expect(within(form).queryByRole('group', { name: 'Qué entregables mira' })).toBeNull()
    expect(within(form).queryByText('Mira')).toBeNull()
    expect(within(form).getByText('Parte calificada')).toBeTruthy()
  })

  it('pedir un archivo para una pregunta: con «Enlace» en un criterio de IA avisa en el momento (AC-07)', async () => {
    ver.mockResolvedValue(editor())
    agregarEntregable.mockResolvedValue(editor())
    pintar()
    await screen.findByRole('region', { name: 'Balance de la prueba' })
    desplegar()
    const cerrada = within(bloque()).getByRole('article', { name: /¿Qué libro registra/ })
    fireEvent.click(within(cerrada).getByRole('button', { name: 'Pedir un archivo para esta pregunta' }))
    const form = screen.getByRole('form', { name: 'Archivo de la pregunta 1' })
    expect(within(form).queryByRole('status')).toBeNull()
    fireEvent.change(within(form).getByLabelText('Nombre'), { target: { value: 'Asiento.pdf' } })
    fireEvent.change(within(form).getByLabelText('Formato'), { target: { value: 'ENLACE' } })
    expect(within(form).getByRole('status').textContent).toBe(
      'La IA no abre enlaces: este criterio lo califica la IA, así que solo leerá la respuesta escrita.',
    )
    fireEvent.click(within(form).getByRole('button', { name: 'Pedir el archivo' }))
    await waitFor(() => expect(agregarEntregable).toHaveBeenCalled())
    expect(agregarEntregable.mock.calls[0]![1]).toMatchObject({
      nombre: 'Asiento.pdf',
      formato: 'ENLACE',
      preguntaId: 10,
      todaLaPrueba: false,
      cubre: [],
    })
  })

  it('quitar el archivo de una pregunta es la aspa', async () => {
    ver.mockResolvedValue(editor())
    quitarEntregable.mockResolvedValue(editor())
    pintar()
    await screen.findByRole('region', { name: 'Balance de la prueba' })
    desplegar()
    fireEvent.click(screen.getByRole('button', { name: 'Quitar el archivo Tablero.xlsx' }))
    await waitFor(() => expect(quitarEntregable).toHaveBeenCalledWith(40, 301))
  })

  it('un entregable general dice lo que cubre, y uno nuevo puede cubrir unas preguntas (AC-05)', async () => {
    ver.mockResolvedValue(editor())
    agregarEntregable.mockResolvedValue(editor())
    pintar()
    const generales = await screen.findByRole('region', { name: /Entregables generales/ })
    expect(within(generales).getByText(/Cubre: toda la prueba/)).toBeTruthy()
    fireEvent.click(within(generales).getByRole('button', { name: 'Agregar entregable general' }))
    const form = screen.getByRole('form', { name: 'Entregable general nuevo' })
    fireEvent.change(within(form).getByLabelText('Nombre'), { target: { value: 'Informe de cierre' } })
    fireEvent.click(within(form).getByLabelText('Estas preguntas'))
    expect((within(form).getByRole('button', { name: 'Pedir el archivo' }) as HTMLButtonElement).disabled).toBe(true)
    const casillas = within(within(form).getByRole('group', { name: 'Las preguntas que cubre' })).getAllByRole('checkbox')
    fireEvent.click(casillas[1]!)
    fireEvent.click(within(form).getByRole('button', { name: 'Pedir el archivo' }))
    await waitFor(() => expect(agregarEntregable).toHaveBeenCalled())
    expect(agregarEntregable.mock.calls[0]![1]).toMatchObject({
      nombre: 'Informe de cierre',
      preguntaId: null,
      todaLaPrueba: false,
      cubre: [11],
    })
  })

  it('la falta de la fecha abre la configuración con el cursor en la fecha (AC-08, AC-16)', async () => {
    ver.mockResolvedValue(editor())
    pintar()
    const cabecera = await screen.findByRole('region', { name: 'Balance de la prueba' })
    fireEvent.click(within(cabecera).getByRole('button', { name: /Falta la fecha límite para dar la prueba/ }))
    const panel = await screen.findByRole('dialog', { name: 'Configuración de la prueba' })
    const fecha = within(panel).getByLabelText('Fecha límite para dar la prueba')
    expect(document.activeElement).toBe(fecha)
    expect(within(panel).getByText('Obligatoria para publicar la prueba')).toBeTruthy()
  })

  it('la configuración: sin días, guías «!» y la fecha se guarda en hora de Lima sin motivo (AC-09, AC-12, AC-18)', async () => {
    // La fecha que se escribe tiene que ser futura (el panel lo revisa antes de guardar):
    // se fija «hoy» para que el 09/10 no caduque.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-05T15:00:00Z'))
    ver.mockResolvedValue(editor())
    fijarFecha.mockResolvedValue(editor({ fechaLimite: { cierraEn: '2026-10-10T04:59:00Z', pideMotivo: false } }))
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: 'Configuración' }))
    const panel = await screen.findByRole('dialog', { name: 'Configuración de la prueba' })
    expect(within(panel).getByLabelText('Cronometrada')).toBeTruthy()
    expect(within(panel).getByLabelText('Sin cronómetro')).toBeTruthy()
    expect(within(panel).queryByLabelText(/Días/)).toBeNull()
    // La guía del tiempo: al pasar el cursor, al enfocar o al tocar.
    const guia = within(panel).getByRole('button', { name: 'Guía: Tiempo' })
    fireEvent.mouseEnter(guia)
    expect(within(panel).getByRole('tooltip').textContent).toMatch(/^Cronometrada: tiene esos minutos/)
    fireEvent.mouseLeave(guia)
    expect(within(panel).queryByRole('tooltip')).toBeNull()
    fireEvent.focus(within(panel).getByRole('button', { name: 'Guía: Fecha límite' }))
    expect(within(panel).getByRole('tooltip').textContent).toMatch(/no se copia con la prueba/)

    fireEvent.change(within(panel).getByLabelText('Fecha límite para dar la prueba'), {
      target: { value: '2026-10-09T23:59' },
    })
    expect(within(panel).queryByText(/Motivo del cambio/)).toBeNull()
    fireEvent.click(within(panel).getByRole('button', { name: 'Listo' }))
    await waitFor(() => expect(fijarFecha).toHaveBeenCalledWith(40, { cierraEn: '2026-10-10T04:59:00.000Z', motivo: null }))
    expect(guardarDatos).not.toHaveBeenCalled()
  })

  describe('«Listo» no guarda a medias (QA-02)', () => {
    const sinMinutos = () =>
      editor({ borrador: version({ prueba: { ...version().prueba!, duracionMinutos: null } }) })
    const abrir = async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Configuración' }))
      return screen.findByRole('dialog', { name: 'Configuración de la prueba' })
    }
    const escribir = (panel: HTMLElement, minutos: string, fecha: string) => {
      fireEvent.change(within(panel).getByRole('spinbutton', { name: 'Minutos' }), { target: { value: minutos } })
      fireEvent.change(within(panel).getByLabelText('Fecha límite para dar la prueba'), { target: { value: fecha } })
    }

    it('una fecha pasada frena todo: ni los minutos ni la fecha se guardan, y lo dice', async () => {
      ver.mockResolvedValue(sinMinutos())
      pintar()
      const panel = await abrir()
      escribir(panel, '45', '2026-01-05T10:00')
      fireEvent.click(within(panel).getByRole('button', { name: 'Listo' }))
      expect((await within(panel).findByRole('alert')).textContent).toContain('Esa fecha ya pasó')
      expect(guardarDatos).not.toHaveBeenCalled()
      expect(fijarFecha).not.toHaveBeenCalled()
      const cabecera = screen.getByRole('region', { name: 'Balance de la prueba' })
      expect(within(cabecera).getByRole('button', { name: /^Tiempo: Faltan los minutos/ })).toBeTruthy()
    })

    it('con gente dentro y sin motivo, tampoco se guarda nada', async () => {
      ver.mockResolvedValue(editor({ fechaLimite: { cierraEn: '2099-10-10T04:59:00Z', pideMotivo: true } }))
      pintar()
      const panel = await abrir()
      escribir(panel, '60', '2099-10-12T18:00')
      fireEvent.click(within(panel).getByRole('button', { name: 'Listo' }))
      expect((await within(panel).findByRole('alert')).textContent).toContain('pide un motivo')
      expect(guardarDatos).not.toHaveBeenCalled()
      expect(fijarFecha).not.toHaveBeenCalled()
    })

    it('si el servidor rechaza la fecha tras guardar los minutos, se ven los minutos y solo se reintenta la fecha', async () => {
      ver.mockResolvedValue(sinMinutos())
      guardarDatos.mockResolvedValue(editor())
      fijarFecha.mockRejectedValue(
        new ErrorApi(400, 'La fecha límite no se guardó', { faltas: ['Esa fecha ya pasó: la fecha límite tiene que ser futura.'] }),
      )
      pintar()
      const panel = await abrir()
      escribir(panel, '90', '2099-10-12T18:00')
      fireEvent.click(within(panel).getByRole('button', { name: 'Listo' }))
      expect((await within(panel).findByRole('alert')).textContent).toContain('Esa fecha ya pasó')
      expect(guardarDatos).toHaveBeenCalledTimes(1)
      const cabecera = screen.getByRole('region', { name: 'Balance de la prueba' })
      await waitFor(() => expect(within(cabecera).getByRole('button', { name: /^Tiempo: 90 min/ })).toBeTruthy())
      expect((within(panel).getByRole('spinbutton', { name: 'Minutos' }) as HTMLInputElement).value).toBe('90')

      fireEvent.click(within(panel).getByRole('button', { name: 'Listo' }))
      await waitFor(() => expect(fijarFecha).toHaveBeenCalledTimes(2))
      expect(guardarDatos).toHaveBeenCalledTimes(1)
    })
  })

  it('con gente en la etapa técnica, cambiar la fecha pide el motivo (AC-10)', async () => {
    ver.mockResolvedValue(editor({ fechaLimite: { cierraEn: '2026-10-10T04:59:00Z', pideMotivo: true } }))
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: 'Configuración' }))
    const panel = await screen.findByRole('dialog', { name: 'Configuración de la prueba' })
    const fecha = within(panel).getByLabelText('Fecha límite para dar la prueba') as HTMLInputElement
    expect(fecha.value).toBe('2026-10-09T23:59')
    fireEvent.change(fecha, { target: { value: '2026-10-12T18:00' } })
    expect(within(panel).getByText('Motivo del cambio · queda registrado')).toBeTruthy()
  })

  it('la versión en lectura sin caso no titula «El caso» a los materiales; con caso, sí (QA-04)', () => {
    const conMateriales = { ...version().prueba!, materiales: 'Los estados de marzo.' }
    render(<VistaDeVersion version={version({ estado: 'PUBLICADA', prueba: conMateriales })} />)
    expect(screen.queryByRole('heading', { name: 'El caso' })).toBeNull()
    const aparte = screen.getByRole('region', { name: 'Materiales y herramientas' })
    expect(aparte.textContent).toContain('Materiales: Los estados de marzo.')
    expect(aparte.textContent).toContain('Herramientas: Excel')
    cleanup()

    render(<VistaDeVersion version={version({ prueba: { ...conMateriales, enunciado: 'Marzo cerró con un descuadre.' } })} />)
    expect(screen.getByRole('region', { name: 'El caso' }).textContent).toContain('Marzo cerró con un descuadre.')
    expect(screen.getByRole('region', { name: 'El caso' }).textContent).not.toContain('Materiales')
  })

  it('el caso: quitarlo con texto pide confirmación y solo borra el enunciado y el PDF (AC-03, AC-24)', async () => {
    const conCaso = version({ prueba: { ...version().prueba!, enunciado: 'La empresa cerró marzo con un descuadre.' } })
    ver.mockResolvedValue(editor({ borrador: conCaso }))
    guardarDatos.mockResolvedValue(editor())
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: 'Ver el caso' }))
    expect(screen.getByText('Opcional: como la consigna de las pruebas de antes.')).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/Va también en el correo/)
    fireEvent.click(screen.getByRole('button', { name: 'Quitar el caso' }))
    const confirmar = screen.getByRole('alertdialog', { name: 'Quitar el caso' })
    expect(confirmar.textContent).toContain(
      'Se borran el enunciado y el PDF. Las preguntas y los entregables se quedan como están.',
    )
    fireEvent.click(within(confirmar).getByRole('button', { name: 'Quitar el caso' }))
    await waitFor(() => expect(guardarDatos).toHaveBeenCalled())
    expect(guardarDatos.mock.calls[0]![1]).toMatchObject({
      enunciado: null,
      herramientasPermitidas: 'Excel',
      modalidad: 'CRONOMETRADA',
      duracionMinutos: 90,
    })
    expect(quitarConsigna).not.toHaveBeenCalled()
  })

  it('el 400 de publicar se pinta entero', async () => {
    ver.mockResolvedValue(editor())
    publicar.mockRejectedValue(
      new ErrorApi(400, 'La prueba no se puede publicar todavía: faltan 2 cosas', {
        faltas: ['Los puntos suman 30 de 100: faltan 70.', 'Falta la fecha límite para dar la prueba.'],
      }),
    )
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: 'Publicar la prueba' }))
    await waitFor(() => expect(publicar).toHaveBeenCalledWith(40, 'prueba-propia'))
    const alertas = await screen.findAllByRole('alert')
    const lista = alertas.find((a) => a.textContent?.includes('Faltan 2 cosas'))
    expect(within(lista!).getAllByRole('listitem')).toHaveLength(2)
  })

  it('al agregar una abierta no se piden puntos, y va a la prueba', async () => {
    ver.mockResolvedValue(editor())
    agregarPregunta.mockResolvedValue(editor())
    pintar()
    await screen.findByRole('region', { name: 'Balance de la prueba' })
    desplegar()
    fireEvent.click(within(bloque()).getByRole('button', { name: 'Agregar pregunta' }))
    expect(screen.queryByLabelText('Puntos')).toBeNull()
    fireEvent.change(screen.getByLabelText('Enunciado'), { target: { value: 'Explica tu cierre' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar la pregunta' }))
    await waitFor(() => expect(agregarPregunta).toHaveBeenCalled())
    expect(agregarPregunta.mock.calls[0]![1]).toMatchObject({ tipo: 'ABIERTA', puntos: 0, criterioId: 5 })
    expect(agregarPregunta.mock.calls[0]![2]).toBe('prueba-propia')
  })

  it('sin permiso de editar: en lectura y sin botones que acaben en 403; plegar y las guías sí (AC-23)', async () => {
    ver.mockResolvedValue(editor({ puedeEditar: false }))
    pintar()
    expect(await screen.findByText(/cambiarla pide el permiso de editar esta vacante/)).toBeTruthy()
    for (const nombre of [
      'Publicar la prueba',
      'Agregar criterio',
      'Agregar un caso',
      'Agregar entregable general',
      'Recomendaciones por IA',
    ]) {
      expect(screen.queryByRole('button', { name: nombre })).toBeNull()
    }
    desplegar()
    expect(screen.queryByRole('button', { name: 'Pedir un archivo para esta pregunta' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Quitar el archivo/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Configuración' }))
    const panel = await screen.findByRole('dialog', { name: 'Configuración de la prueba' })
    expect((within(panel).getByLabelText('Fecha límite para dar la prueba') as HTMLInputElement).readOnly).toBe(true)
    expect((within(panel).getByLabelText('Cronometrada') as HTMLInputElement).disabled).toBe(true)
    fireEvent.click(within(panel).getByRole('button', { name: 'Guía: Tiempo' }))
    expect(within(panel).getByRole('tooltip')).toBeTruthy()
  })
})
