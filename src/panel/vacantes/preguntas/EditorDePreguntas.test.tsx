/**
 * El editor de preguntas propias: lo que no se ve compilando.
 *
 *   0. **El balance es del servidor.** Se pinta tal cual llega, con sus avisos.
 *   1. **La primera pregunta sin criterio crea «General»** (lo crea el servidor;
 *      aquí se comprueba que se pinta lo que devuelve).
 *   2. **El 400 de publicar es una lista**, y se pinta entera.
 *   3. **Sin permiso de editar no hay botones que acaben en 403.**
 *   4. **Con 100 puntos no se llama a la IA.**
 *   5. **Lo que se ve es lo guardado** (QA-PP-02 y QA-PP-03): tras copiar encima,
 *      la guía es la copiada; tras corregir, la lista del último 400 se va.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ErrorApi } from '../../api/cliente'
import type {
  EditorDePreguntas as Editor,
  GuardarPregunta,
  PreguntaDeLaVersion,
  VersionDePreguntas,
} from '../../api/preguntasPropias'
import { EditorDePreguntas } from './EditorDePreguntas'

const ver = vi.fn()
const agregarPregunta = vi.fn()
const publicarPreguntas = vi.fn()
const verRecomendacion = vi.fn()
const guardarDatos = vi.fn()
const agregarCriterio = vi.fn()
const copiar = vi.fn()
const listarCopiables = vi.fn()
const verVistaPrevia = vi.fn()

vi.mock('../../api/preguntasPropias', async (original) => ({
  ...(await original<typeof import('../../api/preguntasPropias')>()),
  verPreguntasPropias: (id: number) => ver(id),
  agregarPregunta: (id: number, datos: GuardarPregunta) => agregarPregunta(id, datos),
  publicarPreguntas: (id: number) => publicarPreguntas(id),
  verRecomendacion: (id: number) => verRecomendacion(id),
  listarCopiables: () => listarCopiables(),
  guardarDatosDelBorrador: (id: number, datos: unknown) => guardarDatos(id, datos),
  agregarCriterio: (id: number, datos: unknown) => agregarCriterio(id, datos),
  copiarDeOtraVacante: (id: number, origen: number) => copiar(id, origen),
  verVistaPrevia: (id: number, origen: number) => verVistaPrevia(id, origen),
}))

const abierta = (parte: Partial<PreguntaDeLaVersion> = {}): PreguntaDeLaVersion => ({
  id: 10,
  tipo: 'ABIERTA',
  enunciado: 'Cuéntanos un cierre con un descuadre',
  puntos: 20,
  criterioId: 5,
  orden: 1,
  queDebeTener: 'El monto y la cuenta',
  opciones: [],
  ...parte,
})

const version = (parte: Partial<VersionDePreguntas> = {}): VersionDePreguntas => ({
  id: 70,
  estado: 'BORRADOR',
  guiaCalificacion: null,
  minutosObjetivo: 25,
  versionGuia: 1,
  total: 85,
  cuantosCriterios: 2,
  cuantasPreguntas: 1,
  criterios: [
    {
      id: 5,
      nombre: 'Conocimiento contable',
      queEvalua: 'El cierre mensual',
      orden: 1,
      puntos: 85,
      puntosSistema: 0,
      puntosIa: 85,
      preguntas: [abierta({ puntos: 85 })],
    },
    {
      id: 6,
      nombre: 'Manejo de Excel',
      queEvalua: null,
      orden: 2,
      puntos: 0,
      puntosSistema: 0,
      puntosIa: 0,
      preguntas: [],
    },
  ],
  sinCriterio: [],
  avisos: ['Los puntos suman 85 de 100: faltan 15.', 'El criterio «Manejo de Excel» no tiene preguntas.'],
  ...parte,
})

const editor = (parte: Partial<Editor> = {}): Editor => ({
  vacanteId: 40,
  titulo: 'Asistente contable',
  nivel: 'EJECUCION',
  origen: 'VACANTE',
  aplicaEvaluacion: true,
  puedeEditar: true,
  hayPostulantes: false,
  borrador: version(),
  publicada: null,
  resumen: { estado: 'BORRADOR', puntos: 85, criterios: 2, preguntas: 1 },
  recalificacion: null,
  ...parte,
})

function pintar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={['/admin/vacantes/40/preguntas']}>
        <Routes>
          <Route path="/admin/vacantes/:id/preguntas" element={<EditorDePreguntas />} />
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
afterEach(cleanup)

describe('el balance', () => {
  it('dice cuántos puntos van de 100, en ámbar con su falta, y cuántas cosas hay por arreglar', async () => {
    ver.mockResolvedValue(editor())
    pintar()
    const balance = await screen.findByRole('region', { name: 'Balance de las preguntas' })
    const total = within(balance).getByText('85 de 100 puntos').closest('p')!
    expect(total.className).toContain('balanceConFalta')
    expect(total.textContent).toBe('85 de 100 puntos. Los puntos suman 85 de 100: faltan 15.')
    expect(total.getAttribute('title')).toBe('Los puntos suman 85 de 100: faltan 15.')
    expect(within(balance).getByRole('button', { name: '2 por arreglar' })).toBeTruthy()
    // El criterio vacío lo dice en su propio bloque, en ámbar, con las palabras del servidor
    const excel = screen.getByRole('region', { name: 'Criterio Manejo de Excel' })
    expect(within(excel).getByRole('list', { name: 'Lo que le falta al criterio' }).textContent).toBe(
      'El criterio «Manejo de Excel» no tiene preguntas.',
    )
  })

  it('«Publicar» con faltas no publica: lleva a la primera; publicadas, sin pastilla', async () => {
    ver.mockResolvedValue(editor())
    pintar()
    const [boton] = await screen.findAllByRole('button', { name: 'Publicar las preguntas' })
    fireEvent.click(boton!)
    await waitFor(() => expect(document.activeElement?.id).toBe('criterios-y-preguntas'))
    expect(publicarPreguntas).not.toHaveBeenCalled()
    cleanup()

    ver.mockResolvedValue(editor({ borrador: null, publicada: version({ estado: 'PUBLICADA', total: 100, avisos: [] }) }))
    pintar()
    const balance = await screen.findByRole('region', { name: 'Balance de las preguntas' })
    expect(within(balance).queryByRole('button', { name: /por arreglar/ })).toBeNull()
    expect(within(balance).queryByRole('button', { name: /^Publicar/ })).toBeNull()
  })
})

describe('sin nada escrito', () => {
  it('la primera pregunta sin criterio aparece dentro de «General» (AC-03)', async () => {
    ver.mockResolvedValue(editor({ borrador: null, resumen: { estado: 'SIN_PREGUNTAS', puntos: null, criterios: null, preguntas: null } }))
    agregarPregunta.mockResolvedValue(
      editor({
        borrador: version({
          total: 20,
          cuantosCriterios: 1,
          criterios: [
            {
              id: 9,
              nombre: 'General',
              queEvalua: null,
              orden: 1,
              puntos: 20,
              puntosSistema: 0,
              puntosIa: 20,
              preguntas: [abierta({ criterioId: 9 })],
            },
          ],
          avisos: ['Los puntos suman 20 de 100: faltan 80.'],
        }),
      }),
    )
    pintar()
    expect(await screen.findByText('Todavía no hay preguntas')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Agregar pregunta' }))
    fireEvent.change(screen.getByLabelText('Enunciado'), {
      target: { value: 'Cuéntanos un cierre con un descuadre' },
    })
    fireEvent.change(screen.getByLabelText('Puntos'), { target: { value: '20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar la pregunta' }))

    await waitFor(() => expect(agregarPregunta).toHaveBeenCalled())
    expect(agregarPregunta.mock.calls[0]![1]).toMatchObject({
      tipo: 'ABIERTA',
      puntos: 20,
      criterioId: null,
    })
    expect(await screen.findByRole('heading', { name: 'General' })).toBeTruthy()
  })
})

describe('publicar', () => {
  it('el 400 se pinta como la lista entera de lo que falta (AC-05)', async () => {
    // Sin faltas a la vista publica; si el servidor ve otra cosa, su lista se pinta.
    ver.mockResolvedValue(editor({ borrador: version({ avisos: [] }) }))
    publicarPreguntas.mockRejectedValue(
      new ErrorApi(400, 'Las preguntas no se pueden publicar todavía: faltan 3 cosas', {
        faltas: [
          'Los puntos suman 95 de 100: faltan 5.',
          'El criterio «Manejo de Excel» no tiene preguntas.',
          'La pregunta 2 («¿Qué libro…»): alguna opción tiene que dar los 4 puntos de la pregunta.',
        ],
      }),
    )
    pintar()
    const [boton] = await screen.findAllByRole('button', { name: 'Publicar las preguntas' })
    fireEvent.click(boton!)

    const alertas = await screen.findAllByRole('alert')
    const lista = alertas.find((a) => a.textContent?.includes('Faltan 3 cosas'))
    expect(lista).toBeTruthy()
    expect(within(lista!).getAllByRole('listitem')).toHaveLength(3)
  })
})

describe('sin permiso de editar (AC-20)', () => {
  it('lo ve en lectura, sin botones que acaben en 403', async () => {
    ver.mockResolvedValue(editor({ puedeEditar: false }))
    pintar()
    // Plegar y desplegar sí funcionan en lectura (V68).
    fireEvent.click(await screen.findByRole('button', { name: 'Desplegar todo' }))
    expect(await screen.findByText('Cuéntanos un cierre con un descuadre')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Publicar las preguntas' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Agregar criterio' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Editar la pregunta' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Agregar pregunta' })).toBeNull()
    expect(screen.getByText(/cambiarlas pide el permiso de editar esta vacante/)).toBeTruthy()
  })
})

describe('recomendaciones por IA', () => {
  it('con el borrador en 100 no queda sitio y no se pide nada (AC-14b)', async () => {
    ver.mockResolvedValue(editor({ borrador: version({ total: 100, avisos: [] }) }))
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: 'Recomendaciones por IA' }))
    expect(await screen.findByText(/no queda sitio/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Pedir recomendaciones' })).toBeNull()
  })

  it('antes de pedirla dice cuántos puntos completará', async () => {
    ver.mockResolvedValue(editor({ borrador: version({ total: 50 }) }))
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: 'Recomendaciones por IA' }))
    expect(await screen.findByText(/La IA completará los 50 puntos que faltan/)).toBeTruthy()
  })
})

describe('publicadas y con gente dentro', () => {
  it('se leen, y solo se ofrecen los puntos y las instrucciones de la IA', async () => {
    ver.mockResolvedValue(
      editor({
        borrador: null,
        publicada: version({ estado: 'PUBLICADA', total: 100, avisos: [] }),
        hayPostulantes: true,
        resumen: { estado: 'PUBLICADAS', puntos: 100, criterios: 2, preguntas: 1 },
        recalificacion: { rindieron: 3, conNota: 3, alDia: 1, recalificando: 0, pendientes: 2, motivos: ['la cuenta del proveedor no tiene saldo (402).'] },
      }),
    )
    pintar()
    expect(await screen.findByText(/Desde la primera postulación solo se cambian los puntos/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cambiar los puntos' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Corregir las instrucciones de la IA' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Abrir un borrador para cambiarlas' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Agregar criterio' })).toBeNull()
    // La recalificación detenida dice por qué y deja reintentar
    expect(screen.getByText(/Pendiente de recalificar: 2 personas/)).toBeTruthy()
    expect(screen.getByText(/no tiene saldo \(402\)/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy()
  })
})

describe('lo que se ve es lo guardado', () => {
  const faltas = new ErrorApi(400, 'Las preguntas no se pueden publicar todavía: faltan 2 cosas', {
    faltas: ['Los puntos suman 85 de 100: faltan 15.', 'El criterio «Manejo de Excel» no tiene preguntas.'],
  })

  it('QA-PP-03 · tras corregir, la lista del último intento de publicar se va y no contradice al balance', async () => {
    ver.mockResolvedValue(editor({ borrador: version({ avisos: [] }) }))
    publicarPreguntas.mockRejectedValue(faltas)
    guardarDatos.mockResolvedValue(
      editor({ borrador: version({ total: 100, minutosObjetivo: 30, avisos: [] }) }),
    )
    pintar()
    const [boton] = await screen.findAllByRole('button', { name: 'Publicar las preguntas' })
    fireEvent.click(boton!)
    await waitFor(() =>
      expect(screen.getAllByRole('alert').some((a) => a.textContent?.includes('Faltan 2 cosas'))).toBe(true),
    )

    // Se corrige el borrador: el servidor devuelve otro, con 100 y sin avisos.
    fireEvent.change(screen.getByLabelText('Minutos estimados'), { target: { value: '30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar la guía y los minutos' }))
    await waitFor(() =>
      expect(screen.getAllByText('100 de 100 puntos').length).toBeGreaterThan(0),
    )
    expect(screen.queryAllByRole('alert').filter((a) => a.textContent?.includes('Faltan 2 cosas'))).toHaveLength(0)
  })

  it('QA-PP-03 · si nada cambió, la lista sigue a la vista', async () => {
    ver.mockResolvedValue(editor({ borrador: version({ avisos: [] }) }))
    publicarPreguntas.mockRejectedValue(faltas)
    pintar()
    const [boton] = await screen.findAllByRole('button', { name: 'Publicar las preguntas' })
    fireEvent.click(boton!)
    await waitFor(() =>
      expect(screen.getAllByRole('alert').some((a) => a.textContent?.includes('Faltan 2 cosas'))).toBe(true),
    )
  })

  it('QA-PP-02 · tras copiar encima de un borrador, la guía y los minutos son los copiados', async () => {
    ver.mockResolvedValue(editor({ borrador: version({ guiaCalificacion: 'Guía local del borrador', minutosObjetivo: 25 }) }))
    listarCopiables.mockResolvedValue([
      { vacanteId: 8, titulo: 'Copiable archivada', nivel: 'EJECUCION', publicadaEn: '2026-03-10T00:00:00Z', estado: 'ARCHIVADA', criterios: 1, preguntas: 1 },
    ])
    const copiada = version({ id: 71, guiaCalificacion: 'Guía de la archivada', minutosObjetivo: 40 })
    verVistaPrevia.mockResolvedValue(copiada)
    copiar.mockResolvedValue(editor({ borrador: copiada }))
    pintar()

    const guia = (await screen.findByLabelText(/Guía de calificación para la IA/)) as HTMLTextAreaElement
    expect(guia.value).toBe('Guía local del borrador')
    fireEvent.click(screen.getByRole('button', { name: 'Copiar de otra vacante' }))
    fireEvent.click(await screen.findByText('Copiable archivada · 03/2026'))
    fireEvent.click((await screen.findAllByRole('button', { name: 'Copiar esta prueba' }))[0]!)
    fireEvent.click(screen.getAllByRole('button', { name: 'Reemplazar el borrador' })[0]!)
    await waitFor(() => expect(copiar).toHaveBeenCalledWith(40, 8))

    await waitFor(() =>
      expect((screen.getByLabelText(/Guía de calificación para la IA/) as HTMLTextAreaElement).value).toBe(
        'Guía de la archivada',
      ),
    )
    expect((screen.getByLabelText('Minutos estimados') as HTMLInputElement).value).toBe('40')
    // Nada distinto de lo guardado: no se ofrece guardar, que borraría la copiada.
    expect(screen.queryByRole('button', { name: 'Guardar la guía y los minutos' })).toBeNull()
  })

  it('QA-PP-02 · lo que se está escribiendo en la guía no se pierde por otro cambio del borrador', async () => {
    ver.mockResolvedValue(editor())
    agregarCriterio.mockResolvedValue(
      editor({
        borrador: version({
          cuantosCriterios: 3,
          criterios: [
            ...version().criterios,
            { id: 7, nombre: 'Priorización', queEvalua: null, orden: 3, puntos: 0, puntosSistema: 0, puntosIa: 0, preguntas: [] },
          ],
        }),
      }),
    )
    pintar()
    const guia = (await screen.findByLabelText(/Guía de calificación para la IA/)) as HTMLTextAreaElement
    fireEvent.change(guia, { target: { value: 'Premia el dato concreto' } })

    fireEvent.click(screen.getByRole('button', { name: 'Agregar criterio' }))
    fireEvent.change(screen.getByLabelText('Nombre del criterio'), { target: { value: 'Priorización' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar el criterio' }))
    expect(await screen.findByRole('heading', { name: 'Priorización' })).toBeTruthy()

    expect((screen.getByLabelText(/Guía de calificación para la IA/) as HTMLTextAreaElement).value).toBe(
      'Premia el dato concreto',
    )
    expect(screen.getByRole('button', { name: 'Guardar la guía y los minutos' })).toBeTruthy()
  })
})

describe('la escala en el formulario', () => {
  it('QA-PP-06 · los puntos de cada nivel se nombran «Puntos del nivel N»', async () => {
    ver.mockResolvedValue(editor({ borrador: null, resumen: { estado: 'SIN_PREGUNTAS', puntos: null, criterios: null, preguntas: null } }))
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar pregunta' }))
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'ESCALA' } })
    expect(screen.getByRole('spinbutton', { name: 'Puntos del nivel 1' })).toBeTruthy()
    expect(screen.queryByRole('spinbutton', { name: /de el nivel/ })).toBeNull()
  })
})

describe('plegables y avisos que llevan a donde se arreglan (V68, AC-25)', () => {
  it('al entrar están plegados salvo el que tiene una falta, y cada línea dice puntos, desglose y preguntas', async () => {
    ver.mockResolvedValue(editor())
    pintar()
    const conocimiento = await screen.findByRole('region', { name: 'Criterio Conocimiento contable' })
    expect(within(conocimiento).getByRole('button', { name: 'Conocimiento contable' }).getAttribute('aria-expanded')).toBe('false')
    // La cuenta sigue a los puntos, con su «·» en una caja aparte (QA-05).
    expect(within(conocimiento).getByText('85 pts (IA 85)').nextElementSibling?.textContent).toBe('· 1 pregunta')
    expect(within(conocimiento).queryByText('Cuéntanos un cierre con un descuadre')).toBeNull()
    // «Manejo de Excel» tiene una falta: sale desplegado, con su aviso.
    const excel = screen.getByRole('region', { name: 'Criterio Manejo de Excel' })
    expect(within(excel).getByRole('button', { name: 'Manejo de Excel' }).getAttribute('aria-expanded')).toBe('true')
    expect(within(excel).getByText('El criterio «Manejo de Excel» no tiene preguntas.')).toBeTruthy()
  })

  it('desplegar todo, plegar todo y plegar uno a mano', async () => {
    ver.mockResolvedValue(editor())
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: 'Desplegar todo' }))
    expect(screen.getByText('Cuéntanos un cierre con un descuadre')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Plegar todo' }))
    expect(screen.queryByText('Cuéntanos un cierre con un descuadre')).toBeNull()
    // Plegado, el criterio con falta la dice al lado de su línea, no debajo.
    const excel = screen.getByRole('region', { name: 'Criterio Manejo de Excel' })
    expect(within(excel).queryByRole('list', { name: 'Lo que le falta al criterio' })).toBeNull()
    expect(within(excel).getByText('El criterio «Manejo de Excel» no tiene preguntas.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Conocimiento contable' }))
    expect(screen.getByText('Cuéntanos un cierre con un descuadre')).toBeTruthy()
  })

  it('la cabecera tiene la barra por criterio y la pastilla lleva a cada falta, desplegando su criterio', async () => {
    ver.mockResolvedValue(
      editor({
        borrador: version({
          avisos: [
            'Los puntos suman 85 de 100: faltan 15.',
            'La pregunta 1 («Cuéntanos un cierre con un descuadre»): falta el enunciado.',
          ],
        }),
      }),
    )
    pintar()
    const cabecera = await screen.findByRole('region', { name: 'Balance de las preguntas' })
    expect(within(cabecera).getByRole('img').getAttribute('aria-label')).toBe(
      '85 de 100 puntos · Conocimiento contable: 85',
    )
    const pastilla = within(cabecera).getByRole('button', { name: '2 por arreglar' })
    // «Conocimiento contable» sale desplegado porque una de sus preguntas tiene una falta.
    fireEvent.click(screen.getByRole('button', { name: 'Plegar todo' }))
    expect(screen.queryByText('Cuéntanos un cierre con un descuadre', { selector: 'p' })).toBeNull()
    // Primero los puntos, a los criterios; luego la pregunta, con su criterio desplegado.
    fireEvent.click(pastilla)
    await waitFor(() => expect(document.activeElement?.id).toBe('criterios-y-preguntas'))
    fireEvent.click(pastilla)
    expect(await screen.findByText('Cuéntanos un cierre con un descuadre', { selector: 'p' })).toBeTruthy()
  })
})

describe('una pregunta con falta, en el banco (AC-05, AC-06)', () => {
  // «Manejo de Excel» tiene una opción única de 5 con una opción de 10; otra se quedó sin criterio.
  const unica = abierta({
    id: 20,
    tipo: 'OPCION_UNICA',
    enunciado: '¿Cómo repartes los turnos?',
    puntos: 5,
    criterioId: 6,
    queDebeTener: null,
    opciones: [
      { id: 21, texto: 'Por antigüedad', puntos: 10, orden: 1 },
      { id: 22, texto: 'Al azar', puntos: 0, orden: 2 },
    ],
  })
  const suelta = abierta({ id: 30, enunciado: 'Una suelta', puntos: 10, criterioId: null })
  const conFaltas = version({
    criterios: [version().criterios[0]!, { ...version().criterios[1]!, puntos: 5, preguntas: [unica] }],
    sinCriterio: [suelta],
    avisos: [
      'Los puntos suman 100 de 100: faltan 0.',
      'La pregunta 2 («¿Cómo repartes los turnos?»): ninguna opción puede pasar de los 5 puntos de la pregunta.',
      'La pregunta 2 («¿Cómo repartes los turnos?»): alguna opción tiene que dar los 5 puntos de la pregunta.',
      'La pregunta 3 («Una suelta»): no está en ningún criterio.',
    ],
  })

  it('su tarjeta en ámbar con sus faltas, su criterio plegado en ámbar, y la de sin criterio dice «No está en ningún criterio.»', async () => {
    ver.mockResolvedValue(editor({ borrador: conFaltas }))
    pintar()
    const personal = await screen.findByRole('region', { name: 'Criterio Manejo de Excel' })
    const tarjeta = within(personal).getByRole('article', { name: 'Pregunta: ¿Cómo repartes los turnos?' })
    expect(tarjeta.className).toContain('preguntaConFalta')
    const susFaltas = within(tarjeta).getByRole('list', { name: 'Lo que le falta para publicar' })
    expect(within(susFaltas).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Ninguna opción puede pasar de los 5 puntos de la pregunta.',
      'Alguna opción tiene que dar los 5 puntos de la pregunta.',
    ])
    const sinCriterio = screen.getByRole('region', { name: 'Criterio Sin criterio' })
    const laSuelta = within(sinCriterio).getByRole('article', { name: 'Pregunta: Una suelta' })
    expect(laSuelta.className).toContain('preguntaConFalta')
    expect(within(laSuelta).getByRole('list', { name: 'Lo que le falta para publicar' }).textContent).toBe(
      'No está en ningún criterio.',
    )
    // La del criterio sin falta, ni ámbar ni lista.
    fireEvent.click(screen.getByRole('button', { name: 'Desplegar todo' }))
    const sinFalta = screen.getByRole('article', { name: 'Pregunta: Cuéntanos un cierre con un descuadre' })
    expect(sinFalta.className).not.toContain('preguntaConFalta')

    fireEvent.click(screen.getByRole('button', { name: 'Plegar todo' }))
    expect(personal.className).toContain('criterioConFalta')
    expect(screen.getByRole('region', { name: 'Criterio Conocimiento contable' }).className).not.toContain('criterioConFalta')
    // La pastilla: los puntos primero, luego la tarjeta (sus dos faltas, un solo sitio).
    const pastilla = within(screen.getByRole('region', { name: 'Balance de las preguntas' })).getByRole('button', { name: '4 por arreglar' })
    fireEvent.click(pastilla)
    fireEvent.click(pastilla)
    await waitFor(() =>
      expect(document.activeElement).toBe(within(personal).getByRole('article', { name: 'Pregunta: ¿Cómo repartes los turnos?' })),
    )
  })

  it('el formulario de una pregunta nueva avisa en vivo y guarda igual', async () => {
    ver.mockResolvedValue(editor())
    agregarPregunta.mockResolvedValue(editor({ borrador: conFaltas }))
    pintar()
    const conocimiento = await screen.findByRole('region', { name: 'Criterio Conocimiento contable' })
    fireEvent.click(within(conocimiento).getByRole('button', { name: 'Conocimiento contable' }))
    fireEvent.click(within(conocimiento).getByRole('button', { name: 'Agregar pregunta' }))
    const form = screen.getByRole('form', { name: 'Pregunta nueva' })
    fireEvent.change(within(form).getByLabelText('Tipo'), { target: { value: 'OPCION_MULTIPLE' } })
    fireEvent.change(within(form).getByLabelText('Puntos'), { target: { value: '10' } })
    fireEvent.change(within(form).getByRole('spinbutton', { name: 'Puntos de la opción 1' }), { target: { value: '6' } })
    expect(within(form).getByRole('status').textContent).toBe('Marcando todas las opciones buenas no se llega a sus 10 puntos.')
    fireEvent.change(within(form).getByLabelText('Enunciado'), { target: { value: '¿Qué marcas?' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Agregar la pregunta' }))
    await waitFor(() => expect(agregarPregunta).toHaveBeenCalled())
    expect(agregarPregunta.mock.calls[0]![1]).toMatchObject({ tipo: 'OPCION_MULTIPLE', puntos: 10 })
  })
})
