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
import { guiaDelTiempo } from './ConfiguracionDeLaPrueba'

const ver = vi.fn()
const publicar = vi.fn()
const agregarPregunta = vi.fn()
const editarPregunta = vi.fn()
const verRecomendacion = vi.fn()
const listarCopiables = vi.fn()
const quitarEntregable = vi.fn()
const agregarEntregable = vi.fn()
const guardarDatos = vi.fn()
const fijarFecha = vi.fn()
const quitarConsigna = vi.fn()
const editarCriterio = vi.fn()
const agregarCriterio = vi.fn()

vi.mock('../../api/preguntasPropias', async (original) => ({
  ...(await original<typeof import('../../api/preguntasPropias')>()),
  verPreguntasPropias: (id: number, ruta?: string) => ver(id, ruta),
  publicarPreguntas: (id: number, ruta?: string) => publicar(id, ruta),
  agregarPregunta: (id: number, datos: unknown, ruta?: string) => agregarPregunta(id, datos, ruta),
  editarPregunta: (id: number, preguntaId: number, datos: unknown, ruta?: string) =>
    editarPregunta(id, preguntaId, datos, ruta),
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
  editarCriterioDePrueba: (id: number, criterioId: number, datos: unknown) => editarCriterio(id, criterioId, datos),
  agregarCriterioDePrueba: (id: number, datos: unknown) => agregarCriterio(id, datos),
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
    // El total en ámbar, con su falta para el lector de pantalla; una pastilla y no la lista.
    const balance = within(cabecera).getByText('0 de 100 pts').closest('p')!
    expect(balance.className).toContain('balanceConFalta')
    expect(balance.textContent).toBe('0 de 100 pts. Los puntos suman 0 de 100: faltan 100.')
    expect(within(cabecera).getByRole('button', { name: '2 por arreglar' })).toBeTruthy()
    expect(within(cabecera).queryByRole('list')).toBeNull()
    // Cada falta en su sitio: la de nada que rendir, arriba de los criterios; la fecha, en el chip.
    const criterios = screen.getByRole('region', { name: 'Criterios y preguntas' })
    expect(within(criterios).getByRole('list', { name: 'Lo que falta para publicar' }).textContent).toBe(
      'Todavía no hay nada que rendir: agrega criterios y preguntas.',
    )
    expect(within(cabecera).getByRole('button', { name: /^Tiempo:/ }).className).toContain('chipTiempoFalta')
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

  it('«⚠ N por arreglar →» lleva en cada clic a la siguiente falta en el orden de la página, la resalta y vuelve a la primera', async () => {
    // El servidor las da en otro orden; dos son de la misma pregunta: un solo sitio.
    const avisos = [
      'Falta la fecha límite para dar la prueba.',
      '«Informe final» no cubre ninguna pregunta: elige «Toda la prueba» o las preguntas que reúne.',
      'La pregunta 1 («¿Qué libro registra primero una venta a…»): ninguna opción puede pasar de los 10 puntos de la pregunta.',
      'Los puntos suman 30 de 100: faltan 70.',
      'La pregunta 1 («¿Qué libro registra primero una venta a…»): alguna opción tiene que dar los 10 puntos de la pregunta.',
      'El criterio «Conocimiento contable» vale 30 y sus cerradas suman 10: nadie puede calificar los otros 20. Baja el total a 10, sube sus cerradas o agrégale una abierta o un archivo.',
    ]
    ver.mockResolvedValue(editor({ borrador: version({ avisos }) }))
    pintar()
    const cabecera = await screen.findByRole('region', { name: 'Balance de la prueba' })
    const pastilla = within(cabecera).getByRole('button', { name: '6 por arreglar' })
    expect(pastilla.textContent).toBe('6 por arreglar→')
    fireEvent.click(screen.getByRole('button', { name: 'Plegar todo' }))

    // 1: los puntos, a los criterios, resaltados un momento.
    fireEvent.click(pastilla)
    const criterios = screen.getByRole('region', { name: 'Criterios y preguntas' })
    await waitFor(() => expect(document.activeElement).toBe(criterios))
    expect(criterios.hasAttribute('data-resaltado')).toBe(true)
    // 2: la fecha, en la configuración con el cursor en su campo.
    fireEvent.click(pastilla)
    const panel = await screen.findByRole('dialog', { name: 'Configuración de la prueba' })
    expect(document.activeElement).toBe(within(panel).getByLabelText('Fecha límite para dar la prueba'))
    fireEvent.click(within(panel).getByRole('button', { name: 'Listo' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    // 3: el criterio, desplegado; 4: su pregunta, una sola vez por sus dos faltas.
    fireEvent.click(pastilla)
    await waitFor(() => expect(document.activeElement).toBe(bloque()))
    expect(within(bloque()).getByRole('button', { name: 'Conocimiento contable' }).getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(pastilla)
    await waitFor(() => expect(document.activeElement).toBe(within(bloque()).getByRole('article', { name: /¿Qué libro registra/ })))
    // 5: el entregable general; y al final, otra vez la primera.
    fireEvent.click(pastilla)
    await waitFor(() => expect(document.activeElement?.id).toBe('entregable-302'))
    fireEvent.click(pastilla)
    await waitFor(() => expect(document.activeElement).toBe(criterios))
  })

  it('sin faltas no hay pastilla y el total no va en ámbar; en la publicada, tampoco', async () => {
    const lista = version({ total: 100, avisos: [] })
    ver.mockResolvedValue(editor({ borrador: lista, fechaLimite: { cierraEn: '2026-12-10T04:59:00Z', pideMotivo: false } }))
    pintar()
    let cabecera = await screen.findByRole('region', { name: 'Balance de la prueba' })
    expect(within(cabecera).queryByRole('button', { name: /por arreglar/ })).toBeNull()
    expect(within(cabecera).getByText('100 de 100 pts').closest('p')!.className).not.toContain('balanceConFalta')
    cleanup()

    // Una publicada con un aviso de antes no tiene nada que arreglar en este editor.
    ver.mockResolvedValue(
      editor({ borrador: null, publicada: version({ estado: 'PUBLICADA', total: 90, avisos: ['Los puntos suman 90 de 100: faltan 10.'] }) }),
    )
    pintar()
    cabecera = await screen.findByRole('region', { name: 'Balance de la prueba' })
    expect(within(cabecera).queryByRole('button', { name: /por arreglar/ })).toBeNull()
    expect(within(cabecera).getByText('90 de 100 pts').closest('p')!.className).not.toContain('balanceConFalta')
  })

  it('la guía del tiempo dice los minutos escritos y, sin unos válidos, lo dice en general', () => {
    expect(guiaDelTiempo('45')).toBe(
      'Cronometrada: 45 minutos desde que la abre, nunca después de la fecha límite. Sin cronómetro: hasta la fecha límite.',
    )
    for (const minutos of ['', '3', '7.5']) {
      expect(guiaDelTiempo(minutos)).toMatch(/^Cronometrada: los minutos que indiques, desde que la abre, nunca después/)
    }
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

  it('un criterio sin falta sale plegado en una línea; desplegado no repite su reparto ni lo que mira (AC-15)', async () => {
    ver.mockResolvedValue(editor())
    pintar()
    await screen.findByRole('region', { name: 'Balance de la prueba' })
    // La cuenta sigue a los puntos, con su «·» en una caja aparte (QA-05).
    const puntos = within(bloque()).getByText('30 pts (sistema 10 + IA 20)')
    expect(puntos.nextElementSibling?.textContent).toBe('· 2 preguntas · 1 archivo')
    expect(within(bloque()).queryByText('¿Cómo hallaste el descuadre?')).toBeNull()
    desplegar()
    // La línea ya dice lo que vale y quién lo califica; lo que mira lo deduce el servidor.
    expect(bloque().textContent).not.toContain('Abiertas y archivos')
    expect(bloque().textContent).not.toContain('Mira')
    expect(bloque().textContent).not.toContain('automático')
    expect(within(bloque()).getByText('30 pts (sistema 10 + IA 20)')).toBeTruthy()
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
    expect(within(form).getByRole('spinbutton', { name: 'Puntos del criterio' })).toBeTruthy()
  })

  it('pide los puntos del criterio entero y dice en vivo cuánto suman sus cerradas y quién califica el resto (V69)', async () => {
    ver.mockResolvedValue(editor())
    editarCriterio.mockResolvedValue(editor())
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: 'Editar el criterio Conocimiento contable' }))
    const form = screen.getByRole('form', { name: 'Editar el criterio Conocimiento contable' })
    const puntos = within(form).getByRole('spinbutton', { name: 'Puntos del criterio' }) as HTMLInputElement
    // Lo que vale hoy: 30, con 10 de cerradas y 20 de la IA.
    expect(puntos.value).toBe('30')
    expect(form.textContent).toContain('Cerradas: 10 pts · Abiertas y archivos: 20 pts, los califica')
    expect(form.textContent).toContain(
      'Si luego cambian sus cerradas, el criterio sigue valiendo lo mismo: lo que se ajusta son los puntos de abiertas y archivos.',
    )
    expect(within(form).queryByText('Parte calificada')).toBeNull()

    // Que las cerradas lo sumen todo: no se pregunta quién califica.
    fireEvent.change(puntos, { target: { value: '10' } })
    expect(form.textContent).toContain('Cerradas: 10 pts · Todo lo puntúa el sistema')
    expect(within(form).queryByRole('combobox')).toBeNull()

    // Que lo pasen: la falta en ámbar, la misma del servidor.
    fireEvent.change(puntos, { target: { value: '5' } })
    expect(within(form).getByText('Las cerradas de «Conocimiento contable» suman 10 y el criterio vale 5.')).toBeTruthy()
    expect(within(form).queryByRole('combobox')).toBeNull()

    fireEvent.change(puntos, { target: { value: '40' } })
    expect(form.textContent).toContain('Cerradas: 10 pts · Abiertas y archivos: 30 pts, los califica')
    fireEvent.change(within(form).getByRole('combobox', { name: 'Quién califica los 30 puntos de abiertas y archivos' }), {
      target: { value: 'PERSONA' },
    })
    fireEvent.click(within(form).getByRole('button', { name: 'Guardar el criterio' }))
    await waitFor(() =>
      expect(editarCriterio).toHaveBeenCalledWith(40, 5, {
        nombre: 'Conocimiento contable',
        queEvalua: 'El cierre mensual',
        puntos: 40,
        calificador: 'PERSONA',
      }),
    )
  })

  it('con las cerradas por encima, o sumándolo todo, se guarda sin quién califica (V69)', async () => {
    ver.mockResolvedValue(editor())
    editarCriterio.mockResolvedValue(editor())
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: 'Editar el criterio Conocimiento contable' }))
    const form = screen.getByRole('form', { name: 'Editar el criterio Conocimiento contable' })
    fireEvent.change(within(form).getByRole('spinbutton', { name: 'Puntos del criterio' }), { target: { value: '5' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Guardar el criterio' }))
    await waitFor(() =>
      expect(editarCriterio).toHaveBeenCalledWith(40, 5, expect.objectContaining({ puntos: 5, calificador: null })),
    )
  })

  it('un criterio nuevo empieza sin puntos: sin cerradas, todo lo que valga lo califica alguien (V69)', async () => {
    ver.mockResolvedValue(editor())
    agregarCriterio.mockResolvedValue(editor())
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar criterio' }))
    const form = screen.getByRole('form', { name: 'Criterio nuevo' })
    const puntos = within(form).getByRole('spinbutton', { name: 'Puntos del criterio' }) as HTMLInputElement
    expect(puntos.value).toBe('')
    expect(form.textContent).toContain('Lo que vale el criterio entero, cerradas incluidas.')
    fireEvent.change(within(form).getByRole('textbox', { name: 'Nombre del criterio' }), { target: { value: 'Excel' } })
    fireEvent.change(puntos, { target: { value: '25' } })
    expect(within(form).getByRole('status').textContent).toBe('Cerradas: 0 pts · Abiertas y archivos: 25 pts, los califica')
    expect((within(form).getByRole('combobox') as HTMLSelectElement).value).toBe('IA')
    fireEvent.click(within(form).getByRole('button', { name: 'Agregar el criterio' }))
    await waitFor(() =>
      expect(agregarCriterio).toHaveBeenCalledWith(40, { nombre: 'Excel', queEvalua: null, puntos: 25, calificador: 'IA' }),
    )
  })

  it('QA-10: una parte calificada sin quién la califique no se atribuye a nadie, y su falta lleva al lápiz con «Quién califica» enfocado', async () => {
    // Era «todo del sistema» y bajó una cerrada: el total se mantiene y quedan 20 sin dueño.
    const falta = 'El criterio «Conocimiento contable»: falta decir quién califica su parte calificada, la IA o una persona.'
    const sinQuien = version({ criterios: [{ ...version().criterios[0]!, puntosIa: 0, calificador: null }], avisos: [falta] })
    ver.mockResolvedValue(editor({ borrador: sinQuien }))
    editarCriterio.mockResolvedValue(editor())
    pintar()
    const cabecera = await screen.findByRole('region', { name: 'Balance de la prueba' })
    // Con su falta sale desplegado y la dice: ni la línea ni el criterio dan la IA ni una persona.
    expect(within(bloque()).getByText('30 pts (sistema 10 + 20 sin asignar)')).toBeTruthy()
    expect(within(bloque()).getByRole('list', { name: 'Lo que le falta al criterio' }).textContent).toBe(falta)
    expect(bloque().textContent).not.toMatch(/los califica (la IA|una persona)/)

    // Plegado, la pastilla lo despliega y abre su lápiz con el cursor en «Quién califica».
    fireEvent.click(screen.getByRole('button', { name: 'Plegar todo' }))
    fireEvent.click(within(cabecera).getByRole('button', { name: '1 por arreglar' }))
    const form = await screen.findByRole('form', { name: 'Editar el criterio Conocimiento contable' })
    const quien = within(form).getByRole('combobox', { name: 'Quién califica los 20 puntos de abiertas y archivos' }) as HTMLSelectElement
    await waitFor(() => expect(document.activeElement).toBe(quien))
    // No elige por nadie: hay que decirlo.
    expect(quien.value).toBe('')
    expect(within(quien).getByRole('option', { name: 'Elige quién' })).toBeTruthy()
    fireEvent.change(quien, { target: { value: 'PERSONA' } })
    expect(within(quien).queryByRole('option', { name: 'Elige quién' })).toBeNull()
    fireEvent.click(within(form).getByRole('button', { name: 'Guardar el criterio' }))
    await waitFor(() =>
      expect(editarCriterio).toHaveBeenCalledWith(40, 5, {
        nombre: 'Conocimiento contable',
        queEvalua: 'El cierre mensual',
        puntos: 30,
        calificador: 'PERSONA',
      }),
    )
  })

  it('el reparto en vivo no reparte un total que no es un entero de 0 a 100: dice qué está mal', async () => {
    ver.mockResolvedValue(editor())
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: 'Editar el criterio Conocimiento contable' }))
    const form = screen.getByRole('form', { name: 'Editar el criterio Conocimiento contable' })
    const puntos = within(form).getByRole('spinbutton', { name: 'Puntos del criterio' })
    for (const [escrito, falta] of [
      ['25.5', 'Los puntos del criterio tienen que ser un número entero, sin decimales.'],
      ['-5', 'Los puntos del criterio van de 0 a 100.'],
      ['150', 'Los puntos del criterio van de 0 a 100.'],
    ]) {
      fireEvent.change(puntos, { target: { value: escrito } })
      expect(within(form).getByRole('status').textContent).toBe(falta)
      expect(form.textContent).not.toContain('Abiertas y archivos')
      expect(form.textContent).not.toContain('el criterio vale')
      expect(within(form).queryByRole('combobox')).toBeNull()
    }
    fireEvent.change(puntos, { target: { value: '30' } })
    expect(form.textContent).toContain('Cerradas: 10 pts · Abiertas y archivos: 20 pts, los califica')
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
    // Primero los puntos (el total, arriba); luego la fecha.
    const pastilla = within(cabecera).getByRole('button', { name: '2 por arreglar' })
    fireEvent.click(pastilla)
    fireEvent.click(pastilla)
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
    expect(within(panel).getByRole('tooltip').textContent).toBe(
      'Cronometrada: 90 minutos desde que la abre, nunca después de la fecha límite. Sin cronómetro: hasta la fecha límite.',
    )
    // Del «!» al texto no se cierra: se puede bajar a leerla.
    fireEvent.mouseLeave(guia)
    fireEvent.mouseEnter(within(panel).getByRole('tooltip'))
    await new Promise((r) => setTimeout(r, 200))
    expect(within(panel).getByRole('tooltip')).toBeTruthy()
    fireEvent.mouseLeave(within(panel).getByRole('tooltip'))
    await waitFor(() => expect(within(panel).queryByRole('tooltip')).toBeNull())
    fireEvent.focus(within(panel).getByRole('button', { name: 'Guía: Fecha límite' }))
    expect(within(panel).getByRole('tooltip').textContent).toBe(
      'Después de esta fecha nadie puede entregar. No se copia con la prueba. Para dar más plazo a una persona, hazlo desde su ficha.',
    )

    fireEvent.change(within(panel).getByLabelText('Fecha límite para dar la prueba'), {
      target: { value: '2026-10-09T23:59' },
    })
    expect(within(panel).queryByText(/Motivo del cambio/)).toBeNull()
    fireEvent.click(within(panel).getByRole('button', { name: 'Listo' }))
    await waitFor(() => expect(fijarFecha).toHaveBeenCalledWith(40, { cierraEn: '2026-10-10T04:59:00.000Z', motivo: null }))
    expect(guardarDatos).not.toHaveBeenCalled()
  })

  it('la guía «!» se cierra al volver a pulsar el «!», al pulsar fuera o sobre ella y con Escape, sin cerrar el panel; una a la vez (QA-07)', async () => {
    ver.mockResolvedValue(editor())
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: 'Configuración' }))
    const panel = await screen.findByRole('dialog', { name: 'Configuración de la prueba' })
    const tiempo = within(panel).getByRole('button', { name: 'Guía: Tiempo' })
    const fecha = within(panel).getByRole('button', { name: 'Guía: Fecha límite' })
    const guia = () => within(panel).queryByRole('tooltip')

    // Pulsar el «!» la deja fija; volver a pulsarlo la cierra.
    fireEvent.click(tiempo)
    expect(guia()).toBeTruthy()
    fireEvent.click(tiempo)
    expect(guia()).toBeNull()
    // Pulsar fuera, en el campo que tapaba antes, la cierra y el campo recibe la pulsación.
    fireEvent.click(tiempo)
    fireEvent.click(within(panel).getByLabelText('Sin cronómetro'))
    expect(guia()).toBeNull()
    expect((within(panel).getByLabelText('Sin cronómetro') as HTMLInputElement).checked).toBe(true)
    // Pulsar sobre ella la cierra.
    fireEvent.click(tiempo)
    fireEvent.click(guia()!)
    expect(guia()).toBeNull()
    // Abrir una cierra la otra: nunca hay dos.
    fireEvent.mouseEnter(tiempo)
    fireEvent.focus(fecha)
    expect(within(panel).getAllByRole('tooltip')).toHaveLength(1)
    expect(guia()!.textContent).toContain('No se copia con la prueba')
    // Escape cierra la guía, venga de donde venga el foco, y el panel sigue abierto.
    fireEvent.keyDown(within(panel).getByLabelText('Fecha límite para dar la prueba'), { key: 'Escape' })
    expect(guia()).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Configuración de la prueba' })).toBeTruthy()
    // Sin guía abierta, Escape sí cierra el panel.
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Configuración de la prueba' })).toBeNull()
  })

  it('con sitio a la izquierda del panel lateral, la guía sale fuera de él, a la altura de su etiqueta (QA-07)', async () => {
    const caja = (left: number, top: number, width: number, height: number) =>
      ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect
    const medir = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      // jsdom no mide: un panel de 480 px pegado a la derecha de 1024 y el «!» a 110 px de arriba.
      if (this.getAttribute('role') === 'dialog') return caja(544, 0, 480, 768)
      if (this.getAttribute('aria-label') === 'Guía: Tiempo') return caja(600, 88, 44, 44)
      return caja(0, 0, 0, 0)
    })
    try {
      ver.mockResolvedValue(editor())
      pintar()
      fireEvent.click(await screen.findByRole('button', { name: 'Configuración' }))
      const panel = await screen.findByRole('dialog', { name: 'Configuración de la prueba' })
      fireEvent.mouseEnter(within(panel).getByRole('button', { name: 'Guía: Tiempo' }))
      const guia = within(panel).getByRole('tooltip')
      // 26rem de ancho, 16 px antes del panel; su primera línea, a la altura del «!».
      expect(guia.style.left).toBe(`${544 - 16 - 416}px`)
      expect(guia.style.top).toBe(`${110 - 24}px`)
      expect(guia.style.getPropertyValue('--punta')).toBe('24px')
    } finally {
      medir.mockRestore()
    }
  })

  it('fijada fuera del panel, la guía se esconde mientras su etiqueta no se ve al bajar el panel y vuelve con ella (QA-09)', async () => {
    const caja = (left: number, top: number, width: number, height: number) =>
      ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect
    // jsdom no mide: el cuerpo del panel se ve de 64 a 704; el «!» sube con él al bajarlo.
    let arribaDelSigno = 88
    let cuerpo: HTMLElement | null = null
    const medir = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute('role') === 'dialog') return caja(544, 0, 480, 768)
      if (this === cuerpo) return caja(544, 64, 480, 640)
      if (this.getAttribute('aria-label') === 'Guía: Tiempo') return caja(600, arribaDelSigno, 44, 44)
      return caja(0, 0, 0, 0)
    })
    try {
      ver.mockResolvedValue(editor())
      pintar()
      fireEvent.click(await screen.findByRole('button', { name: 'Configuración' }))
      const panel = await screen.findByRole('dialog', { name: 'Configuración de la prueba' })
      const signo = within(panel).getByRole('button', { name: 'Guía: Tiempo' })
      // El cuerpo del panel es lo que se desplaza (jsdom no aplica las hojas de estilo).
      cuerpo = signo.closest<HTMLElement>('[role="dialog"] > div')!
      cuerpo.style.overflowY = 'auto'
      // Pulsarla la fija y el foco se queda en el «!».
      signo.focus()
      fireEvent.click(signo)
      const guia = within(panel).getByRole('tooltip')
      expect(guia.style.visibility).toBe('')
      // La etiqueta sube por encima del cuerpo: la guía se esconde, pero no se cierra.
      arribaDelSigno = 20
      fireEvent.scroll(cuerpo)
      expect(guia.style.visibility).toBe('hidden')
      expect(signo.getAttribute('aria-expanded')).toBe('true')
      expect(document.activeElement).toBe(signo)
      // La etiqueta vuelve a verse: la guía vuelve, a su altura.
      arribaDelSigno = 88
      fireEvent.scroll(cuerpo)
      expect(guia.style.visibility).toBe('')
      expect(guia.style.top).toBe(`${110 - 24}px`)
      expect(document.activeElement).toBe(signo)
    } finally {
      medir.mockRestore()
    }
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

  it('«Publicar» con faltas no publica: baja a la primera de la página, la resalta y le da el foco', async () => {
    const falta = 'El criterio «Conocimiento contable» vale 30 y sus cerradas suman 10: nadie puede calificar los otros 20. Baja el total a 10, sube sus cerradas o agrégale una abierta o un archivo.'
    ver.mockResolvedValue(editor({ borrador: version({ avisos: ['Falta la fecha límite para dar la prueba.', falta] }) }))
    pintar()
    await screen.findByRole('region', { name: 'Balance de la prueba' })
    fireEvent.click(screen.getByRole('button', { name: 'Plegar todo' }))
    const publicarLa = screen.getByRole('button', { name: 'Publicar la prueba' })
    expect((publicarLa as HTMLButtonElement).disabled).toBe(false)
    // La fecha va en la cabecera, antes que los criterios: abre su campo.
    fireEvent.click(publicarLa)
    const panel = await screen.findByRole('dialog', { name: 'Configuración de la prueba' })
    expect(document.activeElement).toBe(within(panel).getByLabelText('Fecha límite para dar la prueba'))
    expect(publicar).not.toHaveBeenCalled()
    cleanup()

    // Sin la fecha, la primera es el criterio: se despliega, se resalta y recibe el foco.
    ver.mockResolvedValue(editor({ borrador: version({ avisos: [falta] }) }))
    pintar()
    await screen.findByRole('region', { name: 'Balance de la prueba' })
    fireEvent.click(screen.getByRole('button', { name: 'Plegar todo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Publicar la prueba' }))
    await waitFor(() => expect(document.activeElement).toBe(bloque()))
    expect(bloque().hasAttribute('data-resaltado')).toBe(true)
    expect(within(bloque()).getByRole('list', { name: 'Lo que le falta al criterio' }).textContent).toBe(falta)
    expect(publicar).not.toHaveBeenCalled()
  })

  it('el 400 de publicar se pinta entero', async () => {
    // Sin faltas a la vista, «Publicar» publica; si el servidor ve otra cosa, su lista se pinta.
    ver.mockResolvedValue(editor({ borrador: version({ avisos: [] }) }))
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

  describe('los puntos explicados donde se escriben', () => {
    // La pregunta 1 vale 5 y su «Libro diario», 10: las dos faltas del servidor, en su orden.
    const NOMBRE = 'La pregunta 1 («¿Qué libro registra primero una venta a…»)'
    const FALTAS = [
      `${NOMBRE}: ninguna opción puede pasar de los 5 puntos de la pregunta.`,
      `${NOMBRE}: alguna opción tiene que dar los 5 puntos de la pregunta.`,
    ]
    const deCinco = (avisos: string[]) => {
      const criterio = version().criterios[0]!
      const [cerrada, abiertaDelCriterio] = criterio.preguntas
      return version({
        criterios: [{ ...criterio, preguntas: [{ ...cerrada!, puntos: 5 }, abiertaDelCriterio!] }],
        avisos,
      })
    }
    const tarjeta = () => within(bloque()).getByRole('article', { name: /¿Qué libro registra/ })

    it('una opción que pasa de su pregunta: tarjeta y criterio plegado en ámbar, con sus faltas sin el nombre; la pastilla lleva a la tarjeta (AC-05)', async () => {
      ver.mockResolvedValue(editor({ borrador: deCinco(FALTAS) }))
      pintar()
      const cabecera = await screen.findByRole('region', { name: 'Balance de la prueba' })
      // Con faltas de su pregunta, el criterio sale desplegado y la tarjeta las dice debajo.
      const faltas = within(tarjeta()).getByRole('list', { name: 'Lo que le falta para publicar' })
      expect(within(faltas).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
        'Ninguna opción puede pasar de los 5 puntos de la pregunta.',
        'Alguna opción tiene que dar los 5 puntos de la pregunta.',
      ])
      expect(tarjeta().className).toContain('preguntaConFalta')
      expect(tarjeta().querySelector('[aria-hidden="true"]')).toBeTruthy()
      // La otra pregunta del criterio, sin falta, no se pone en ámbar.
      const abiertaSinFalta = within(bloque()).getByRole('article', { name: 'Pregunta: ¿Cómo hallaste el descuadre?' })
      expect(abiertaSinFalta.className).not.toContain('preguntaConFalta')
      expect(within(abiertaSinFalta).queryByRole('list', { name: 'Lo que le falta para publicar' })).toBeNull()

      // Plegado, su criterio en ámbar con la falta al lado de la línea.
      fireEvent.click(screen.getByRole('button', { name: 'Plegar todo' }))
      expect(bloque().className).toContain('criterioConFalta')
      expect(bloque().textContent).toContain(`${FALTAS[0]} (y 1 más)`)

      // La pastilla despliega el criterio y lleva a la tarjeta: sus dos faltas, un solo sitio.
      fireEvent.click(within(cabecera).getByRole('button', { name: '2 por arreglar' }))
      await waitFor(() => expect(document.activeElement).toBe(tarjeta()))
    })

    it('el formulario avisa en vivo sin mover el foco ni frenar el guardado; corregida, la tarjeta deja el ámbar (AC-06)', async () => {
      ver.mockResolvedValue(editor())
      editarPregunta.mockResolvedValueOnce(editor({ borrador: deCinco(FALTAS) }))
      pintar()
      await screen.findByRole('region', { name: 'Balance de la prueba' })
      desplegar()
      fireEvent.click(within(tarjeta()).getByRole('button', { name: 'Editar la pregunta' }))
      let form = screen.getByRole('form', { name: 'Corregir la pregunta' })
      // Una pregunta de 10 con una opción de 10: nada que avisar.
      expect(within(form).queryByRole('status')).toBeNull()

      // Pregunta de 5 y su opción, mientras se escribe: 5, luego 1 y luego 10.
      fireEvent.change(within(form).getByLabelText('Puntos'), { target: { value: '5' } })
      const opcion = within(form).getByRole('spinbutton', { name: 'Puntos de la opción 1' })
      opcion.focus()
      fireEvent.change(opcion, { target: { value: '5' } })
      expect(within(form).queryByRole('status')).toBeNull()
      fireEvent.change(opcion, { target: { value: '1' } })
      expect(within(form).getByRole('status').textContent).toBe('Alguna opción tiene que dar los 5 puntos de la pregunta.')
      fireEvent.change(opcion, { target: { value: '10' } })
      expect(document.activeElement).toBe(opcion)
      expect(within(form).getByRole('status').textContent).toBe(
        'Ninguna opción puede pasar de los 5 puntos de la pregunta.' + 'Alguna opción tiene que dar los 5 puntos de la pregunta.',
      )

      // Se guarda igual: es un borrador; lo que frena es publicar.
      const guardar = within(form).getByRole('button', { name: 'Guardar la pregunta' }) as HTMLButtonElement
      expect(guardar.disabled).toBe(false)
      fireEvent.click(guardar)
      await waitFor(() => expect(editarPregunta).toHaveBeenCalled())
      expect(editarPregunta.mock.calls[0]![2]).toMatchObject({ puntos: 5, opciones: [{ puntos: 10 }, { puntos: 0 }] })
      await waitFor(() => expect(tarjeta().className).toContain('preguntaConFalta'))

      // Corregida a 5, el aviso se va y, al guardar, la tarjeta deja el ámbar.
      editarPregunta.mockResolvedValueOnce(editor({ borrador: deCinco([]) }))
      fireEvent.click(within(tarjeta()).getByRole('button', { name: 'Editar la pregunta' }))
      form = screen.getByRole('form', { name: 'Corregir la pregunta' })
      expect(within(form).getByRole('status')).toBeTruthy()
      fireEvent.change(within(form).getByRole('spinbutton', { name: 'Puntos de la opción 1' }), { target: { value: '5' } })
      expect(within(form).queryByRole('status')).toBeNull()
      fireEvent.click(within(form).getByRole('button', { name: 'Guardar la pregunta' }))
      await waitFor(() => expect(editarPregunta).toHaveBeenCalledTimes(2))
      await waitFor(() => expect(tarjeta().className).not.toContain('preguntaConFalta'))
      expect(within(tarjeta()).queryByRole('list', { name: 'Lo que le falta para publicar' })).toBeNull()
    })

    it('el aviso de un criterio sin nada que calificar va a su línea, a su criterio desplegado, y la pastilla lleva a él (AC-08)', async () => {
      const falta =
        'El criterio «Conocimiento contable» vale 20 y sus cerradas suman 5: nadie puede calificar los otros 15. Baja el total a 5, sube sus cerradas o agrégale una abierta o un archivo.'
      ver.mockResolvedValue(editor({ borrador: version({ avisos: [falta] }) }))
      pintar()
      const cabecera = await screen.findByRole('region', { name: 'Balance de la prueba' })
      // Desplegado, escrita bajo su línea; plegado, al lado.
      expect(within(bloque()).getByRole('list', { name: 'Lo que le falta al criterio' }).textContent).toBe(falta)
      fireEvent.click(screen.getByRole('button', { name: 'Plegar todo' }))
      expect(within(bloque()).queryByRole('list', { name: 'Lo que le falta al criterio' })).toBeNull()
      expect(bloque().textContent).toContain(falta)
      fireEvent.click(within(cabecera).getByRole('button', { name: '1 por arreglar' }))
      await waitFor(() => expect(document.activeElement).toBe(bloque()))
      expect(within(bloque()).getByRole('button', { name: 'Conocimiento contable' }).getAttribute('aria-expanded')).toBe('true')
    })

    it('desplegado, el criterio no repite el reparto ni lo que mira: lo dice su línea (AC-04)', () => {
      const criterio = version().criterios[0]!
      render(<VistaDeVersion version={version({ estado: 'PUBLICADA', criterios: [{ ...criterio, calificador: 'PERSONA' }] })} />)
      fireEvent.click(screen.getByRole('button', { name: 'Conocimiento contable' }))
      expect(screen.getByText('30 pts (sistema 10 + persona 20)')).toBeTruthy()
      expect(bloque().textContent).not.toContain('Abiertas y archivos')
      expect(bloque().textContent).not.toContain('Mira')
      expect(within(bloque()).getByText('¿Cómo hallaste el descuadre?')).toBeTruthy()
    })

    it('sin botones, la línea del criterio lleva sus puntos al borde derecho; con botones, no (AC-12)', async () => {
      ver.mockResolvedValue(editor())
      pintar()
      await screen.findByRole('region', { name: 'Balance de la prueba' })
      const conBotones = bloque().querySelector('header')!
      expect(conBotones.className).not.toContain('cabeceraSinBotones')
      cleanup()

      ver.mockResolvedValue(editor({ puedeEditar: false }))
      pintar()
      await screen.findByRole('region', { name: 'Balance de la prueba' })
      expect(bloque().querySelector('header')!.className).toContain('cabeceraSinBotones')
      cleanup()

      render(<VistaDeVersion version={version({ estado: 'PUBLICADA' })} />)
      expect(bloque().querySelector('header')!.className).toContain('cabeceraSinBotones')
    })
  })

  describe('sin la lista en la cabecera, cada falta se ve en su sitio', () => {
    it('la de un archivo, bajo el archivo y con su tarjeta en ámbar; la de un general, bajo su línea; la que no tiene sitio, arriba de los criterios', async () => {
      const delArchivo = '«Tablero.xlsx»: nadie lo califica. El criterio de su pregunta no tiene parte calificada: súbele los puntos.'
      const delGeneral = '«Informe final» no cubre ninguna pregunta: elige «Toda la prueba» o las preguntas que reúne.'
      const sinSitio = 'Todavía no hay ningún criterio: lo que se califica va dentro de un criterio.'
      ver.mockResolvedValue(editor({ borrador: version({ avisos: [sinSitio, delArchivo, delGeneral] }) }))
      pintar()
      await screen.findByRole('region', { name: 'Balance de la prueba' })
      const criterios = screen.getByRole('region', { name: 'Criterios y preguntas' })
      expect(within(criterios).getByRole('list', { name: 'Lo que falta para publicar' }).textContent).toBe(sinSitio)
      // El criterio sale desplegado por la falta de su pregunta.
      const abierta = within(bloque()).getByRole('article', { name: 'Pregunta: ¿Cómo hallaste el descuadre?' })
      expect(abierta.className).toContain('preguntaConFalta')
      expect(within(abierta).getByRole('list', { name: 'Lo que le falta al archivo' }).textContent).toBe(delArchivo)
      expect(within(abierta).queryByRole('list', { name: 'Lo que le falta para publicar' })).toBeNull()
      const general = document.getElementById('entregable-302')!
      expect(within(general).getByRole('list', { name: 'Lo que le falta al entregable' }).textContent).toBe(delGeneral)
      // La del archivo no es del criterio: no se repite bajo su línea.
      expect(within(bloque()).queryByRole('list', { name: 'Lo que le falta al criterio' })).toBeNull()
    })

    it('una fecha que ya pasó pone el chip en ámbar y se dice bajo la fecha, hasta que se cambia', async () => {
      const yaPaso = 'La fecha límite para dar la prueba ya pasó: pon una futura.'
      ver.mockResolvedValue(
        editor({
          borrador: version({ total: 100, avisos: [yaPaso] }),
          fechaLimite: { cierraEn: '2026-01-10T04:59:00Z', pideMotivo: false },
        }),
      )
      pintar()
      const cabecera = await screen.findByRole('region', { name: 'Balance de la prueba' })
      const chip = within(cabecera).getByRole('button', { name: /^Tiempo: 90 min · hasta / })
      expect(chip.className).toContain('chipTiempoFalta')
      expect(chip.getAttribute('aria-label')).toContain(yaPaso)
      expect(chip.getAttribute('title')).toBe(yaPaso)
      fireEvent.click(chip)
      const panel = await screen.findByRole('dialog', { name: 'Configuración de la prueba' })
      const fecha = within(panel).getByLabelText('Fecha límite para dar la prueba')
      expect(document.activeElement).toBe(fecha)
      expect(within(panel).getByText(yaPaso)).toBeTruthy()
      fireEvent.change(fecha, { target: { value: '2026-12-20T18:00' } })
      expect(within(panel).queryByText(yaPaso)).toBeNull()
    })

    it('los minutos que faltan se dicen bajo «Tiempo» hasta que se escriben', async () => {
      const sinMinutos = 'Faltan los minutos: una prueba cronometrada dura al menos 5 minutos.'
      ver.mockResolvedValue(
        editor({
          borrador: version({ avisos: [sinMinutos], prueba: { ...version().prueba!, duracionMinutos: null } }),
          fechaLimite: { cierraEn: '2026-12-10T04:59:00Z', pideMotivo: false },
        }),
      )
      pintar()
      const cabecera = await screen.findByRole('region', { name: 'Balance de la prueba' })
      // El chip ya lo dice: no lo repite para el lector de pantalla.
      const chip = within(cabecera).getByRole('button', { name: /^Tiempo: Faltan los minutos/ })
      expect(chip.getAttribute('aria-label')).not.toContain(sinMinutos)
      fireEvent.click(within(cabecera).getByRole('button', { name: '1 por arreglar' }))
      const panel = await screen.findByRole('dialog', { name: 'Configuración de la prueba' })
      expect(document.activeElement).toBe(within(panel).getByRole('spinbutton', { name: 'Minutos' }))
      expect(within(panel).getByText(sinMinutos)).toBeTruthy()
      fireEvent.change(within(panel).getByRole('spinbutton', { name: 'Minutos' }), { target: { value: '45' } })
      expect(within(panel).queryByText(sinMinutos)).toBeNull()
    })

    it('sin permiso de editar, la pastilla lleva igual y no hay «Publicar»', async () => {
      const falta = 'La pregunta 1 («¿Qué libro registra primero una venta a…»): ninguna opción puede pasar de los 10 puntos de la pregunta.'
      ver.mockResolvedValue(editor({ puedeEditar: false, borrador: version({ avisos: [falta] }) }))
      pintar()
      const cabecera = await screen.findByRole('region', { name: 'Balance de la prueba' })
      expect(within(cabecera).queryByRole('button', { name: /^Publicar/ })).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Plegar todo' }))
      fireEvent.click(within(cabecera).getByRole('button', { name: '1 por arreglar' }))
      await waitFor(() => expect(document.activeElement).toBe(within(bloque()).getByRole('article', { name: /¿Qué libro registra/ })))
    })
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
