/**
 * La prueba escrita en el editor de la vacante (V67), del lado del candidato.
 *
 *   - Las preguntas en los cuatro tipos, numeradas, sin puntos (AC-08 de la V67).
 *   - Una cerrada se guarda al marcarla, con la opción o las marcadas.
 *   - «Entregar» con huecos no abre el diálogo: dice cuáles faltan y lleva a la
 *     primera. Una abierta con solo espacios cuenta como sin responder.
 *   - Vencida con huecos: «Tu tiempo terminó y la prueba quedó sin completar».
 *   - V68: la pantalla previa dice la fecha límite y el tiempo; el caso sale solo
 *     si existe; el archivo de una pregunta se sube dentro de ella.
 *
 * Y desde el 09/10/2026, **una pregunta por pantalla** con el marco de la evaluación
 * (`specs/prueba-una-pregunta-por-pantalla.md`): la barra fija, el mapa, la tarjeta, el
 * lateral del caso, el paso «Entregables» y el guardado por la cola compartida.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { entregarPrueba, iniciarPrueba, responderPrueba, responderPruebaCerrada, verPrueba } from '@/api/prueba'
import type { MiPrueba, PreguntaPrueba } from '@/api/tipos'
import { fechaLargaDeLima } from '@/dominio/horaDeLima'
import { ProveedorAvisos } from '@/ui/Avisos'
import { GRACIA_TRAS_ABRIR_MS } from '@/ui/Modal'
import { Prueba } from './Prueba'

let respuesta: MiPrueba

vi.mock('@/api/prueba', () => ({
  verPrueba: vi.fn(async () => respuesta),
  iniciarPrueba: vi.fn(async () => respuesta),
  responderPrueba: vi.fn(async () => undefined),
  responderPruebaCerrada: vi.fn(async () => undefined),
  subirArchivo: vi.fn(async () => undefined),
  subirEnlace: vi.fn(async () => undefined),
  entregarPrueba: vi.fn(async () => ({ estado: 'ENTREGADA', completa: true, faltantes: 0 })),
}))
vi.mock('@/api/portal', () => ({ verPostulacion: vi.fn() }))

const enUnaHora = () => new Date(Date.now() + 3_600_000).toISOString()

const PREGUNTAS: PreguntaPrueba[] = [
  {
    id: 21,
    tipo: 'OPCION_UNICA',
    enunciado: '¿Qué libro registra primero una venta al crédito?',
    respuestaTexto: null,
    opciones: [
      { id: 1, texto: 'Libro diario', orden: 1 },
      { id: 2, texto: 'Caja', orden: 2 },
    ],
    respuestaOpcionId: 1,
    respuestaMarcadas: [],
    posicion: 1,
  },
  {
    id: 22,
    tipo: 'OPCION_MULTIPLE',
    enunciado: '¿Qué cuentas se concilian a fin de mes?',
    respuestaTexto: null,
    opciones: [
      { id: 3, texto: 'Bancos', orden: 1 },
      { id: 4, texto: 'Proveedores', orden: 2 },
    ],
    respuestaOpcionId: null,
    respuestaMarcadas: [3],
    posicion: 2,
  },
  {
    id: 23,
    tipo: 'ESCALA',
    enunciado: '¿Cuánto dominas Excel?',
    respuestaTexto: null,
    opciones: [
      { id: 5, texto: 'Nada', orden: 1 },
      { id: 6, texto: null, orden: 2 },
      { id: 7, texto: 'Experto', orden: 3 },
    ],
    respuestaOpcionId: null,
    respuestaMarcadas: [],
    posicion: 3,
  },
  {
    id: 24,
    tipo: 'ABIERTA',
    enunciado: '¿Cómo hallaste el descuadre?',
    respuestaTexto: '   ',
    opciones: [],
    respuestaOpcionId: null,
    respuestaMarcadas: [],
    posicion: 4,
  },
]

/** Las mismas cuatro, sin nada respondido: la prueba recién empezada. */
const SIN_RESPONDER: PreguntaPrueba[] = PREGUNTAS.map((p) => ({
  ...p,
  respuestaTexto: null,
  respuestaOpcionId: null,
  respuestaMarcadas: [],
}))

/** Un caso largo: no cabe en las líneas del lateral. Párrafos, y una lista con sus saltos. */
const PRIMER_PARRAFO =
  'La tienda de Miraflores cerró marzo con un descuadre de S/ 1 250 entre el libro mayor y el ' +
  'extracto del banco. El contador anterior dejó notas sueltas y dos conciliaciones a medias, y la ' +
  'gerencia necesita saber antes del viernes de dónde sale la diferencia.'
const LISTA = 'Lo que tienes:\n- el mayor de marzo\n- el extracto del banco'
const PARRAFO_FINAL = 'Explica cada ajuste como se lo dirías a la gerencia, sin jerga contable.'
const CASO_LARGO = [PRIMER_PARRAFO, LISTA, PARRAFO_FINAL].join('\n\n')
/** El caso largo con un enlace en su último párrafo, muy por debajo del recorte del lateral. */
const ENLACE_DEL_CASO = 'https://ejemplo.com/plan-contable.pdf'
const CASO_LARGO_CON_ENLACE = [CASO_LARGO, `El plan contable, por si lo necesitas: ${ENLACE_DEL_CASO}`].join('\n\n')

/** Unas cuantas, numeradas en el orden en que se pasan. */
const enOrden = (...ps: PreguntaPrueba[]) => ps.map((p, i) => ({ ...p, posicion: i + 1 }))

function delEditor(parte: Partial<MiPrueba> = {}): MiPrueba {
  return {
    id: 1,
    estadoIntento: 'EN_CURSO',
    modalidad: 'CRONOMETRADA',
    iniciadoEn: new Date().toISOString(),
    venceEn: enUnaHora(),
    duracionMinutos: 90,
    enunciado: 'La empresa cerró marzo con un descuadre.',
    materiales: null,
    herramientasPermitidas: null,
    cambioTexto: null,
    preguntas: PREGUNTAS,
    entregables: [
      { id: 301, nombre: 'Tablero.xlsx', detalle: null, formato: 'ARCHIVO', esObligatorio: true, entregado: true },
    ],
    plazoDias: null,
    cuestionario: false,
    consigna: null,
    delEditor: true,
    ...parte,
  }
}

/**
 * La prueba del editor antes de empezar, como la manda el backend desde el 10/10/2026: sin
 * preguntas —solo cuántas son—, sin caso, sin materiales, sin consigna y sin el detalle de los
 * archivos.
 */
function sinEmpezar(parte: Partial<MiPrueba> = {}): MiPrueba {
  return delEditor({
    estadoIntento: 'PENDIENTE',
    iniciadoEn: null,
    venceEn: null,
    enunciado: null,
    materiales: null,
    consigna: null,
    preguntas: [],
    totalPreguntas: 4,
    entregables: [
      { id: 301, nombre: 'Tablero.xlsx', detalle: null, formato: 'ARCHIVO', esObligatorio: true, entregado: false },
    ],
    ...parte,
  })
}

function montar() {
  const datos = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={datos}>
      <ProveedorAvisos>
        <MemoryRouter initialEntries={['/procesos/x1/prueba']}>
          <Routes>
            <Route path="/procesos/:uuid/prueba" element={<Prueba />} />
            <Route path="/procesos/:uuid" element={<p>Su proceso</p>} />
          </Routes>
        </MemoryRouter>
      </ProveedorAvisos>
    </QueryClientProvider>,
  )
}

/** «Pregunta N de M» en la barra fija. */
const enLaBarra = (texto: string | RegExp) => screen.findByText(texto)
const casilla = (n: number | string) =>
  screen.getByRole('button', { name: new RegExp(`^${typeof n === 'number' ? `Pregunta ${n}` : n},`) })
const tarjeta = () => within(screen.getByRole('article'))
/** La franja de datos de la pantalla previa: cada celda con su etiqueta, su valor y sus matices. */
const laFranja = () =>
  [...(document.querySelector('dl')?.children ?? [])].map((celda) => {
    const [valor, ...matices] = [...celda.querySelectorAll('dd')].map((d) => d.textContent)
    return { etiqueta: celda.querySelector('dt')?.textContent, valor, matices }
  })

/**
 * `performance.now`, el reloj con el que el diálogo cuenta su primer medio segundo, adelantable sin
 * pararlo: lo demás (React, las consultas) sigue viendo pasar el tiempo.
 */
function relojQueSePuedeAdelantar() {
  const real = performance.now.bind(performance)
  let adelanto = 0
  vi.spyOn(performance, 'now').mockImplementation(() => real() + adelanto)
  return (ms: number) => {
    adelanto += ms
  }
}

/**
 * Que no salió la llamada: la mutación llama al servidor unas microtareas después del clic, así que
 * mirarlo en el acto daría por buena una que sale luego.
 */
async function sinPedirloAlServidor(llamada: (...args: never[]) => unknown) {
  await act(() => new Promise((seguir) => setTimeout(seguir, 20)))
  expect(llamada).not.toHaveBeenCalled()
}

/** Un toque o un clic entero, como lo da el navegador: apretar, soltar y el `click` (`detail` ≥ 1). */
function pulsar(el: Element, detail: number) {
  fireEvent.pointerDown(el)
  fireEvent.mouseDown(el, { detail })
  fireEvent.pointerUp(el)
  fireEvent.mouseUp(el, { detail })
  fireEvent.click(el, { detail })
}

/**
 * Una ventana de `ancho` px: `matchMedia` responde a los `min-width` como el navegador. Sin esto
 * jsdom no tiene `matchMedia` y la pantalla previa se pinta en una columna.
 */
function ventanaDe(ancho: number) {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: ancho >= Number(/min-width:\s*(\d+)px/.exec(consulta)?.[1] ?? Infinity),
    media: consulta,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

beforeEach(() => {
  vi.clearAllMocks()
  // La posición se apunta en la pestaña y lo pendiente en el navegador: cada prueba empieza
  // limpia.
  window.sessionStorage.clear()
  window.localStorage.clear()
})
afterEach(async () => {
  cleanup()
  await new Promise((seguir) => setTimeout(seguir, 0))
})

describe('la prueba del editor en el portal', () => {
  it('AC-01: al empezar se ve solo la pregunta 1, con la barra, el mapa, «Anterior» y «Siguiente»', async () => {
    respuesta = delEditor({ preguntas: SIN_RESPONDER })
    montar()
    expect(await enLaBarra('Pregunta 1 de 4')).toBeTruthy()
    expect(screen.getAllByRole('article')).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1, name: PREGUNTAS[0]!.enunciado })).toBeTruthy()
    expect(screen.queryByText(PREGUNTAS[1]!.enunciado)).toBeNull()
    expect(screen.getByRole('navigation', { name: 'Las 4 preguntas' })).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Anterior' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeTruthy()
    expect(screen.getByText('Tiempo restante')).toBeTruthy()
    // Las cuatro preguntas; los entregables generales ya estaban subidos.
    expect(screen.getByText('Te faltan 4 por terminar')).toBeTruthy()
  })

  it('enseña las preguntas en los cuatro tipos, con el nombre del tipo y sin puntos (AC-08)', async () => {
    respuesta = delEditor({ preguntas: SIN_RESPONDER.map((p, i) => (i < 2 ? PREGUNTAS[i]! : p)) })
    montar()
    // Entra en la primera sin responder: la 3.
    await enLaBarra('Pregunta 3 de 4')
    expect(tarjeta().getByText('Pregunta 3 · Escala')).toBeTruthy()
    expect(screen.getByRole('radiogroup', { name: 'Niveles, del menor al mayor' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: '1, Nada' })).toBeTruthy()

    fireEvent.click(casilla(1))
    await enLaBarra('Pregunta 1 de 4')
    expect(tarjeta().getByText('Pregunta 1 · Opción única')).toBeTruthy()
    expect((screen.getByRole('radio', { name: /Libro diario/ }) as HTMLInputElement).checked).toBe(true)
    expect(screen.getByRole('group', { name: PREGUNTAS[0]!.enunciado })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await enLaBarra('Pregunta 2 de 4')
    expect(tarjeta().getByText('Pregunta 2 · Opción múltiple')).toBeTruthy()
    expect((screen.getByRole('checkbox', { name: /Bancos/ }) as HTMLInputElement).checked).toBe(true)

    fireEvent.click(casilla(4))
    await enLaBarra('Pregunta 4 de 4')
    expect(tarjeta().getByText('Pregunta 4 · Abierta')).toBeTruthy()
    expect(screen.getByLabelText(/¿Cómo hallaste el descuadre\?/)).toBeTruthy()
    expect(screen.queryByText(/pts|puntos/)).toBeNull()
  })

  it('una cerrada se guarda al marcarla', async () => {
    respuesta = delEditor()
    montar()
    await enLaBarra('Pregunta 3 de 4')
    fireEvent.click(screen.getByRole('radio', { name: '3, Experto' }))
    await waitFor(() => expect(responderPruebaCerrada).toHaveBeenCalledWith('x1', 23, { opcionId: 7 }))
    await waitFor(() => expect(tarjeta().getByText('Guardado')).toBeTruthy())

    fireEvent.click(casilla(2))
    await enLaBarra('Pregunta 2 de 4')
    fireEvent.click(screen.getByRole('checkbox', { name: /Proveedores/ }))
    await waitFor(() =>
      expect(responderPruebaCerrada).toHaveBeenCalledWith('x1', 22, { marcadas: [3, 4] }),
    )
  })

  it('una abierta se guarda sola, y lo escrito justo antes de «Siguiente» no se pierde', async () => {
    respuesta = delEditor({ preguntas: enOrden(PREGUNTAS[3]!, PREGUNTAS[0]!), entregables: [] })
    montar()
    await enLaBarra('Pregunta 1 de 2')
    fireEvent.change(screen.getByLabelText(/¿Cómo hallaste el descuadre\?/), {
      target: { value: 'En la cuenta 1041.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await waitFor(() => expect(responderPrueba).toHaveBeenCalledWith('x1', 24, 'En la cuenta 1041.'))
  })

  it('«Entregar» con huecos dice cuáles faltan y lleva a la primera; no abre el diálogo (AC-10)', async () => {
    respuesta = delEditor()
    montar()
    await enLaBarra('Pregunta 3 de 4')
    fireEvent.click(casilla(1))
    await enLaBarra('Pregunta 1 de 4')

    fireEvent.click(screen.getByRole('button', { name: 'Entregar la prueba' }))
    const aviso = await screen.findByRole('alert')
    // La escala sin marcar y la abierta con solo espacios.
    expect(aviso.textContent).toContain('Para entregar te falta responder 2 preguntas (la 3 y la 4).')
    expect(aviso.textContent).toContain('Los entregables obligatorios están completos.')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(entregarPrueba).not.toHaveBeenCalled()

    // El botón mueve el navegador de preguntas y deja el foco en lo que hay que responder.
    fireEvent.click(within(aviso).getByRole('button', { name: 'Ir a la pregunta 3' }))
    await enLaBarra('Pregunta 3 de 4')
    await waitFor(() => expect(document.activeElement).toBe(screen.getAllByRole('radio')[0]))
  })

  it('AC-10: con la 3 y la 7 sin responder y un general sin subir, el aviso los nombra y lleva a la 3', async () => {
    const ocho: PreguntaPrueba[] = Array.from({ length: 8 }, (_, i) => ({
      id: 100 + i,
      tipo: 'ABIERTA',
      enunciado: `Pregunta abierta número ${i + 1}`,
      respuestaTexto: i === 2 || i === 6 ? null : 'Respondida.',
      opciones: [],
      respuestaOpcionId: null,
      respuestaMarcadas: [],
      posicion: i + 1,
    }))
    respuesta = delEditor({
      preguntas: ocho,
      entregables: [
        { id: 302, nombre: 'Informe final', detalle: null, formato: 'ARCHIVO', esObligatorio: true, entregado: false },
      ],
    })
    montar()
    await enLaBarra('Pregunta 3 de 8')
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Siguiente' }))
    await enLaBarra('Pregunta 5 de 8')
    fireEvent.click(screen.getByRole('button', { name: 'Entregar la prueba' }))
    const aviso = await screen.findByRole('alert')
    expect(aviso.textContent).toContain(
      'Para entregar te falta responder 2 preguntas (la 3 y la 7). Te falta subir «Informe final».',
    )
    fireEvent.click(within(aviso).getByRole('button', { name: 'Ir a la pregunta 3' }))
    await enLaBarra('Pregunta 3 de 8')
    expect(screen.getByRole('button', { name: 'Volver a la 5' })).toBeTruthy()
  })

  it('sin el entregable obligatorio tampoco se entrega', async () => {
    respuesta = delEditor({
      preguntas: [PREGUNTAS[0]!],
      entregables: [
        { id: 301, nombre: 'Tablero.xlsx', detalle: null, formato: 'ARCHIVO', esObligatorio: true, entregado: false },
      ],
    })
    montar()
    // Lo único que falta es el general: entra en el paso «Entregables», el último.
    await screen.findByRole('heading', { level: 1, name: 'Entregables' })
    fireEvent.click(tarjeta().getByRole('button', { name: 'Entregar la prueba' }))
    expect(await screen.findByText('Te falta subir «Tablero.xlsx».')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('con todo respondido, pide confirmación y entrega', async () => {
    respuesta = delEditor({ preguntas: [PREGUNTAS[0]!, PREGUNTAS[1]!] })
    montar()
    await enLaBarra('Pregunta 1 de 2')
    expect(screen.getByText('Todo listo para entregar')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Entregar la prueba' }))
    const dialogo = await screen.findByRole('dialog')
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Entregar' }))
    await waitFor(() => expect(entregarPrueba).toHaveBeenCalledWith('x1'))
    expect(await screen.findByText('Su proceso')).toBeTruthy()
  })

  it('QA-UPP-14: un doble clic en «Entregar la prueba» no entrega aunque el segundo caiga en «Entregar»; leído el diálogo, sí', async () => {
    const adelantar = relojQueSePuedeAdelantar()
    respuesta = delEditor({ preguntas: [PREGUNTAS[0]!, PREGUNTAS[1]!] })
    montar()
    await enLaBarra('Pregunta 1 de 2')
    pulsar(screen.getByRole('button', { name: 'Entregar la prueba' }), 1)
    const dialogo = await screen.findByRole('dialog', { name: 'Entregar la prueba' })
    const entregar = within(dialogo).getByRole('button', { name: 'Entregar' })
    pulsar(entregar, 2)
    adelantar(150)
    pulsar(entregar, 1)
    await sinPedirloAlServidor(entregarPrueba)
    expect(screen.getByRole('dialog', { name: 'Entregar la prueba' })).toBe(dialogo)

    adelantar(GRACIA_TRAS_ABRIR_MS)
    pulsar(entregar, 1)
    await waitFor(() => expect(entregarPrueba).toHaveBeenCalledTimes(1))
  })

  it('vencida con huecos queda sin completar, y se le dice', async () => {
    respuesta = delEditor({ estadoIntento: 'NO_COMPLETADA' })
    montar()
    expect(
      await screen.findByRole('heading', { name: 'Tu tiempo terminó y la prueba quedó sin completar.' }),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Entregar/ })).toBeNull()
    expect(screen.queryByRole('navigation')).toBeNull()
  })

  it('al empezar, el diálogo dice la regla de la prueba del editor, no «se entrega lo guardado» (AC-11)', async () => {
    respuesta = sinEmpezar()
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Empezar prueba' }))
    const dialogo = await screen.findByRole('dialog')
    expect(dialogo.textContent).toContain('la prueba se entrega sola si está completa')
    expect(dialogo.textContent).toContain('queda sin completar y no se califica')
    expect(dialogo.textContent).not.toContain('se entrega lo que hayas guardado')
    // El contenido se lee dentro del reloj (10/10/2026): el diálogo dice que se abre al confirmar,
    // con las preguntas que son, y sin nombrar un caso o unos materiales que no se sabe si hay.
    expect(dialogo.textContent).toContain('Al confirmar se abren el contenido de la prueba y sus 4 preguntas, y empieza a correr el tiempo')
    expect(dialogo.textContent).toContain('también mientras lees')
    expect(dialogo.textContent).not.toMatch(/el caso|los materiales/)
    // Con dos archivos obligatorios, lo que puede faltar es una pregunta o uno de ellos.
    expect(dialogo.textContent).toContain('si falta responder alguna pregunta o subir un archivo obligatorio')
  })

  describe('antes de empezar, una ficha corta: nada que dé ventaja (10/10/2026)', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
      vi.mocked(verPrueba).mockImplementation(async () => respuesta)
    })

    const siguen = (...els: Element[]) =>
      els.every((el, i) => i === 0 || Boolean(els[i - 1]!.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING))
    const laCondicion = () => screen.getByText(/^Una vez empezada no se puede pausar, ni para leer\./)

    it('la ficha dice el tiempo, la fecha límite, cuántas preguntas son (`totalPreguntas`) y los archivos, sin ninguna pregunta en la respuesta', async () => {
      respuesta = sinEmpezar({
        herramientasPermitidas: 'Excel',
        fechaLimite: '2026-10-10T04:59:00Z',
        entregables: [
          { id: 301, nombre: 'Flujo de caja.xlsx', detalle: null, formato: 'ARCHIVO', esObligatorio: true, entregado: false, preguntaId: 24, posicionDeLaPregunta: 4 },
          { id: 302, nombre: 'Informe final', detalle: null, formato: 'ARCHIVO', esObligatorio: true, entregado: false, preguntaId: null, posicionDeLaPregunta: null },
        ],
      })
      montar()
      await screen.findByRole('button', { name: 'Empezar prueba' })
      // La fecha, como hoy (`fechaLargaDeLima`), en dos líneas: el día y la hora.
      expect(laFranja()).toEqual([
        {
          etiqueta: 'Tiempo',
          valor: '90 min',
          matices: ['desde que pulses Empezar', 'o hasta la fecha límite, si llega antes'],
        },
        { etiqueta: 'Fecha límite', valor: 'viernes 09/10 a las 23:59', matices: [] },
        { etiqueta: 'Preguntas', valor: '4', matices: [] },
        { etiqueta: 'Archivos', valor: '2', matices: ['2 obligatorios'] },
      ])
      const fecha = [...document.querySelectorAll('dl > div')].find((c) => c.querySelector('dt')?.textContent === 'Fecha límite')!
      expect([...fecha.querySelectorAll('span')].map((s) => s.textContent)).toEqual(['viernes 09/10', 'a las 23:59'])
      // «En la pregunta 4» sale del número que viaja con el archivo: las preguntas no llegan.
      expect(screen.getByText(/· en la pregunta 4/)).toBeTruthy()
      expect(screen.getByRole('heading', { name: 'Herramientas permitidas' })).toBeTruthy()
      expect(screen.queryByRole('heading', { name: /El caso|El encargo|De qué va|Materiales/ })).toBeNull()
      expect(document.body.textContent).not.toMatch(/cuestionario/i)
      // El texto de arriba dice que el contenido y las preguntas se abren al empezar y que desde ahí
      // corre el tiempo, sin nombrar un caso o unos materiales que antes de empezar no se sabe si hay.
      expect(document.body.textContent).toContain('El contenido y las preguntas se abren al empezar, y desde ahí corre el tiempo.')
      expect(document.querySelector('b')?.textContent).toBe('desde ahí corre el tiempo')
      expect(document.body.textContent).not.toMatch(/El caso|los materiales/)
      // Que leer también cuenta lo dice la condición, con las preguntas y los obligatorios que son.
      expect(laCondicion().textContent).toBe(
        'Una vez empezada no se puede pausar, ni para leer. Para entregar hay que responder las 4 preguntas y subir los 2 archivos obligatorios; si el tiempo termina con algo pendiente, queda sin completar.',
      )
      expect(document.body.textContent).not.toContain('Lee todo antes de empezar')
    })

    it('aunque un backend anterior los mandara, la ficha no enseña el caso, los materiales, la consigna, las preguntas ni el detalle', async () => {
      respuesta = delEditor({
        estadoIntento: 'PENDIENTE',
        iniciadoEn: null,
        venceEn: null,
        enunciado: CASO_LARGO,
        materiales: 'En la carpeta:\n- el mayor de marzo',
        consigna: { nombre: 'caso.pdf', url: 'https://sb.co/storage/caso.pdf?token=abc' },
        entregables: [
          { id: 301, nombre: 'Conciliación.xlsx', detalle: 'La de marzo, con sus partidas.', formato: 'ARCHIVO', esObligatorio: true, entregado: false, preguntaId: 24 },
        ],
      })
      montar()
      await screen.findByRole('button', { name: 'Empezar prueba' })
      const texto = document.body.textContent ?? ''
      for (const visto of [PRIMER_PARRAFO, 'el mayor de marzo', 'caso.pdf', 'La de marzo, con sus partidas.', ...PREGUNTAS.map((p) => p.enunciado)]) {
        expect(texto).not.toContain(visto)
      }
      // Ningún enlace en la ficha: ni el del PDF ni uno escrito en el caso.
      expect(document.querySelector('dl')!.parentElement!.querySelector('a')).toBeNull()
      // Sin el número aparte, el de la pregunta sale de la lista que aún llega.
      expect(screen.getByText(/· en la pregunta 4/)).toBeTruthy()
      // Y las preguntas, contadas de esa lista.
      expect(laFranja().find((c) => c.etiqueta === 'Preguntas')?.valor).toBe('4')
    })

    it('si falta un dato, su celda no sale: sin fecha límite ni archivos, el tiempo y las preguntas', async () => {
      respuesta = sinEmpezar({ fechaLimite: null, entregables: [] })
      montar()
      await screen.findByRole('button', { name: 'Empezar prueba' })
      expect(laFranja()).toEqual([
        { etiqueta: 'Tiempo', valor: '90 min', matices: ['desde que pulses Empezar'] },
        { etiqueta: 'Preguntas', valor: '4', matices: [] },
      ])
      expect(screen.queryByRole('heading', { name: 'Lo que entregarás' })).toBeNull()
    })

    it('sin cronómetro, el tiempo es «Hasta la fecha límite»; sin fecha, sus días', async () => {
      respuesta = sinEmpezar({
        modalidad: 'PLAZO_ABIERTO',
        duracionMinutos: null,
        plazoDias: 3,
        fechaLimite: '2026-10-10T04:59:00Z',
        entregables: [
          { id: 301, nombre: 'Tablero.xlsx', detalle: null, formato: 'ARCHIVO', esObligatorio: false, entregado: false },
        ],
      })
      const { unmount } = montar()
      await screen.findByRole('button', { name: 'Empezar prueba' })
      expect(laFranja()).toEqual([
        { etiqueta: 'Tiempo', valor: 'Hasta la fecha límite', matices: [] },
        { etiqueta: 'Fecha límite', valor: 'viernes 09/10 a las 23:59', matices: [] },
        { etiqueta: 'Preguntas', valor: '4', matices: [] },
        // Ninguno obligatorio: el matiz no sale.
        { etiqueta: 'Archivos', valor: '1', matices: [] },
      ])
      unmount()

      respuesta = sinEmpezar({ modalidad: 'PLAZO_ABIERTO', duracionMinutos: null, plazoDias: 3, fechaLimite: null, entregables: [] })
      montar()
      await screen.findByRole('button', { name: 'Empezar prueba' })
      expect(laFranja()[0]).toEqual({ etiqueta: 'Tiempo', valor: '3 días', matices: ['desde que pulses Empezar'] })
    })

    it('las herramientas, con sus listas de verdad; con lo que entregarás, lado a lado y sin tarjetas dentro', async () => {
      respuesta = sinEmpezar({
        herramientasPermitidas: 'Puedes usar:\n- Excel\n- una calculadora',
        entregables: [
          { id: 301, nombre: 'Conciliación.xlsx', detalle: null, formato: 'ARCHIVO', esObligatorio: true, entregado: false, preguntaId: 24, posicionDeLaPregunta: 4 },
          { id: 302, nombre: 'Informe final', detalle: null, formato: 'ENLACE', esObligatorio: false, entregado: false },
        ],
      })
      montar()
      const herramientas = (await screen.findByRole('heading', { name: 'Herramientas permitidas' })).closest('section')!
      expect([...herramientas.querySelectorAll('ul li')].map((li) => li.textContent)).toEqual(['Excel', 'una calculadora'])
      const entregar = screen.getByRole('heading', { name: 'Lo que entregarás' }).closest('section')!
      expect(within(entregar).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
        'Conciliación.xlsxobligatorio · en la pregunta 4 · se entrega como archivo',
        'Informe finalopcional · se entrega como enlace',
      ])
      // Las dos, partes de la misma consulta, que va en dos
      expect(entregar.parentElement).toBe(herramientas.parentElement)
      expect(entregar.parentElement!.className).toMatch(/consultaEnDos/)
      expect(siguen(entregar, herramientas)).toBe(true)
    })

    for (const ancho of [1440, 390]) {
      it(`en ${ancho} px, el orden del DOM es el que se ve: los datos, la condición, «Empezar prueba» y lo que entregarás`, async () => {
        ventanaDe(ancho)
        respuesta = sinEmpezar({
          entregables: [
            { id: 301, nombre: 'Conciliación.xlsx', detalle: null, formato: 'ARCHIVO', esObligatorio: true, entregado: false, preguntaId: 24, posicionDeLaPregunta: 4 },
          ],
        })
        montar()
        const boton = await screen.findByRole('button', { name: 'Empezar prueba' })
        const franja = document.querySelector('dl')!
        const condicion = laCondicion()
        const titulo = screen.getByRole('heading', { name: 'Lo que entregarás' })
        expect(siguen(franja, condicion, boton, titulo)).toBe(true)
        // Una sola superficie con sus tres partes; la condición y el botón, juntos en la segunda
        const ficha = franja.parentElement!
        expect(ficha.className).toMatch(/ficha/)
        expect([...ficha.children]).toEqual([franja, boton.parentElement, titulo.closest('section')!.parentElement])
        expect([...boton.parentElement!.children]).toEqual([condicion, boton])
        // Nada de la columna fija ni del bloque pegado de antes
        expect(document.querySelector('[class*="columnaFija"], [class*="_accion_"], [class*="tarjetaDeEntregables"], [class*="_lectura_"]')).toBeNull()
        expect(boton.getAttribute('data-rotulo')).toBe('Empezar prueba')
        fireEvent.click(boton)
        expect(await screen.findByRole('dialog', { name: '¿Empezar ahora?' })).toBeTruthy()
      })
    }

    it('sin archivos ni herramientas, la ficha son los datos y la acción; sin nada debajo', async () => {
      respuesta = sinEmpezar({ entregables: [], herramientasPermitidas: null })
      montar()
      const boton = await screen.findByRole('button', { name: 'Empezar prueba' })
      const ficha = document.querySelector('dl')!.parentElement!
      expect(ficha.children).toHaveLength(2)
      expect(ficha.lastElementChild).toBe(boton.parentElement)
      expect(screen.queryByRole('heading', { name: 'Lo que entregarás' })).toBeNull()
      expect(screen.queryByRole('heading', { name: 'Herramientas permitidas' })).toBeNull()
    })

    it('al confirmar, la prueba se pinta con la respuesta de empezar, que trae el caso y las preguntas', async () => {
      vi.mocked(verPrueba).mockResolvedValueOnce(sinEmpezar())
      // La lectura que sigue no vuelve: lo que se ve sale de la respuesta de empezar.
      vi.mocked(verPrueba).mockImplementation(() => new Promise(() => {}))
      vi.mocked(iniciarPrueba).mockResolvedValueOnce(delEditor({ preguntas: SIN_RESPONDER, totalPreguntas: 4 }))
      montar()
      fireEvent.click(await screen.findByRole('button', { name: 'Empezar prueba' }))
      fireEvent.click(await screen.findByRole('button', { name: 'Sí, empezar' }))
      expect(await enLaBarra('Pregunta 1 de 4')).toBeTruthy()
      expect(tarjeta().getByText(PREGUNTAS[0]!.enunciado)).toBeTruthy()
      expect(screen.getByRole('complementary', { name: 'El caso' }).textContent).toContain('La empresa cerró marzo con un descuadre.')
    })

    it('QA-UPP-13: el segundo clic de un doble clic en «Empezar prueba» cae en el fondo y «¿Empezar ahora?» sigue abierto', async () => {
      respuesta = sinEmpezar()
      montar()
      fireEvent.click(await screen.findByRole('button', { name: 'Empezar prueba' }), { detail: 1 })
      const dialogo = await screen.findByRole('dialog', { name: '¿Empezar ahora?' })
      // El botón queda a la derecha de la ficha, fuera del panel: el segundo clic cae en el fondo.
      fireEvent.click(dialogo.previousElementSibling!, { detail: 2 })
      expect(screen.getByRole('dialog', { name: '¿Empezar ahora?' })).toBeTruthy()
      expect(iniciarPrueba).not.toHaveBeenCalled()
      // «Aún no» sigue cerrándolo.
      fireEvent.click(screen.getByRole('button', { name: 'Aún no' }))
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    for (const [como, segundo] of [
      ['un doble clic', 2],
      ['dos clics sueltos', 1],
    ] as const) {
      it(`${como} en «Sí, empezar», con el diálogo ya leído, pide empezar una sola vez`, async () => {
        const adelantar = relojQueSePuedeAdelantar()
        vi.mocked(verPrueba).mockResolvedValueOnce(sinEmpezar())
        vi.mocked(verPrueba).mockImplementation(() => new Promise(() => {}))
        vi.mocked(iniciarPrueba).mockResolvedValueOnce(delEditor({ preguntas: SIN_RESPONDER, totalPreguntas: 4 }))
        montar()
        fireEvent.click(await screen.findByRole('button', { name: 'Empezar prueba' }))
        const si = await screen.findByRole('button', { name: 'Sí, empezar' })
        // Pasado el primer medio segundo, que el diálogo reserva para el clic que lo abrió (QA-UPP-14).
        adelantar(GRACIA_TRAS_ABRIR_MS)
        // Los dos clics llegan antes de que se pinte «Abriendo…» con el botón desactivado. El
        // segundo de una serie ya lo descarta el diálogo; dos sueltos, solo la guarda de `empezar`.
        pulsar(si, 1)
        pulsar(si, segundo)
        expect(await enLaBarra('Pregunta 1 de 4')).toBeTruthy()
        expect(iniciarPrueba).toHaveBeenCalledTimes(1)
      })
    }

    /*
      QA-UPP-14: en el teléfono, con la ficha compacta, «Empezar prueba» queda bajo el pie de
      «¿Empezar ahora?», y el segundo toque de un doble toque caía en «Aún no» —lo cerraba— o en
      «Sí, empezar» —arrancaba el reloj sin haber leído nada—. En la del editor y en la de plantilla.
    */
    for (const [cual, prueba] of [
      ['la del editor', () => sinEmpezar()],
      ['la de plantilla', () => sinEmpezar({ delEditor: false, totalPreguntas: 2 })],
    ] as const) {
      it(`QA-UPP-14 (${cual}): el segundo clic o toque cae en «Sí, empezar», «Aún no» o el aspa y no hace nada; leído el diálogo, «Sí, empezar» empieza`, async () => {
        const adelantar = relojQueSePuedeAdelantar()
        respuesta = prueba()
        vi.mocked(iniciarPrueba).mockImplementationOnce(() => new Promise(() => {}))
        montar()
        pulsar(await screen.findByRole('button', { name: 'Empezar prueba' }), 1)
        const dialogo = await screen.findByRole('dialog', { name: '¿Empezar ahora?' })
        const boton = (nombre: string) => within(dialogo).getByRole('button', { name: nombre })

        // El foco entra por la opción segura
        expect(document.activeElement).toBe(boton('Aún no'))

        // El segundo de la serie, en cualquiera de los botones del diálogo
        pulsar(boton('Sí, empezar'), 2)
        pulsar(boton('Aún no'), 2)
        pulsar(boton('Cerrar'), 2)
        // Dos toques sueltos, el segundo a los 150 ms: tampoco
        adelantar(150)
        pulsar(boton('Sí, empezar'), 1)
        await sinPedirloAlServidor(iniciarPrueba)
        expect(screen.getByRole('dialog', { name: '¿Empezar ahora?' })).toBe(dialogo)
        // El foco no se ha movido de «Aún no»: los toques descartados no enfocan
        expect(document.activeElement).toBe(boton('Aún no'))

        // Leído el aviso, un toque normal en «Sí, empezar» la empieza
        adelantar(GRACIA_TRAS_ABRIR_MS)
        pulsar(boton('Sí, empezar'), 1)
        await waitFor(() => expect(iniciarPrueba).toHaveBeenCalledTimes(1))
      })

      it(`QA-UPP-14 (${cual}): con el teclado, «Sí, empezar» responde al instante`, async () => {
        respuesta = prueba()
        vi.mocked(iniciarPrueba).mockImplementationOnce(() => new Promise(() => {}))
        montar()
        fireEvent.click(await screen.findByRole('button', { name: 'Empezar prueba' }), { detail: 0 })
        const dialogo = await screen.findByRole('dialog', { name: '¿Empezar ahora?' })
        // Enter o Espacio sobre el botón: un `click` con `detail` 0, sin esperar a nada
        fireEvent.click(within(dialogo).getByRole('button', { name: 'Sí, empezar' }), { detail: 0 })
        await waitFor(() => expect(iniciarPrueba).toHaveBeenCalledTimes(1))
      })
    }

    it('QA-UPP-14: «Aún no», pasado el primer instante, cierra el diálogo con un toque normal', async () => {
      const adelantar = relojQueSePuedeAdelantar()
      respuesta = sinEmpezar()
      montar()
      pulsar(await screen.findByRole('button', { name: 'Empezar prueba' }), 1)
      await screen.findByRole('dialog', { name: '¿Empezar ahora?' })
      adelantar(GRACIA_TRAS_ABRIR_MS)
      pulsar(screen.getByRole('button', { name: 'Aún no' }), 1)
      expect(screen.queryByRole('dialog')).toBeNull()
      await sinPedirloAlServidor(iniciarPrueba)
    })
  })

  it('la plantilla, antes de empezar, va en la misma ficha: sin el encargo ni los materiales', async () => {
    respuesta = delEditor({
      estadoIntento: 'PENDIENTE',
      iniciadoEn: null,
      venceEn: '2026-10-10T04:59:00Z',
      enunciado: null,
      materiales: null,
      preguntas: [],
      totalPreguntas: 2,
      herramientasPermitidas: 'Excel',
      delEditor: false,
    })
    montar()
    await screen.findByRole('button', { name: 'Empezar prueba' })
    expect(screen.queryByRole('heading', { name: /El encargo|De qué va|Materiales/ })).toBeNull()
    expect(screen.queryByText('Qué hay que hacer')).toBeNull()
    // La fecha de la plantilla, antes de empezar, es la de cierre de la convocatoria (`venceEn`).
    expect(laFranja()).toEqual([
      {
        etiqueta: 'Tiempo',
        valor: '90 min',
        matices: ['desde que pulses Empezar', 'o hasta la fecha límite, si llega antes'],
      },
      { etiqueta: 'Fecha límite', valor: 'viernes 09/10 a las 23:59', matices: [] },
      { etiqueta: 'Preguntas', valor: '2', matices: [] },
      { etiqueta: 'Archivos', valor: '1', matices: ['1 obligatorio'] },
    ])
    expect(screen.getByRole('heading', { name: 'Lo que entregarás' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Herramientas permitidas' })).toBeTruthy()
    // Su condición es la suya: se entrega lo guardado.
    expect(screen.getByText(/Si el tiempo termina, se entrega lo que hayas guardado\.$/)).toBeTruthy()
  })

  it('la plantilla conserva su aviso de siempre al empezar', async () => {
    respuesta = delEditor({ estadoIntento: 'PENDIENTE', iniciadoEn: null, venceEn: null, delEditor: false })
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Empezar prueba' }))
    const dialogo = await screen.findByRole('dialog')
    expect(dialogo.textContent).toContain('Al terminar se entrega lo que hayas guardado.')
    expect(dialogo.textContent).not.toContain('sin completar')
  })

  it('al llegar a cero, la prueba del editor dice que se entregará sola si está completa (AC-11)', async () => {
    respuesta = delEditor({ venceEn: new Date(Date.now() - 60_000).toISOString() })
    montar()
    const aviso = await screen.findByRole('alert')
    expect(aviso.textContent).toContain('Terminó el plazo de esta prueba')
    expect(aviso.textContent).toContain('se entregará sola si está completa; si falta algo, quedará sin completar.')
    expect(screen.getByText('Se acabó el tiempo')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Entregar la prueba' })).toBeNull()
    // Se sigue pudiendo mirar lo respondido, sin tocarlo.
    expect(screen.getByRole('radio', { name: '3, Experto' }).closest('fieldset')?.disabled).toBe(true)
  })

  it('AC-11: el reloj de la barra va en rojo por debajo de diez minutos', async () => {
    respuesta = delEditor({ venceEn: new Date(Date.now() + 5 * 60_000).toISOString() })
    montar()
    await enLaBarra('Pregunta 3 de 4')
    const numero = screen.getByText(/^00:0[45]:\d\d$/)
    expect(numero.className).toMatch(/numeroPoco/)
  })

  it('sin cronómetro, la barra dice «Hasta el …» con la fecha de Lima, y no va en rojo con tiempo de sobra', async () => {
    const venceEn = new Date(Date.now() + 3 * 24 * 3_600_000).toISOString()
    respuesta = delEditor({ modalidad: 'PLAZO_ABIERTO', duracionMinutos: null, venceEn })
    montar()
    // El formato de la pantalla previa: «viernes 10/10 a las 23:59», en hora de Lima.
    const hasta = await screen.findByText(`Hasta el ${fechaLargaDeLima(venceEn)}`)
    expect(hasta.closest('div')?.className).not.toMatch(/poco/)
    expect(screen.queryByText('Tiempo restante')).toBeNull()
  })

  it('sin cronómetro y con menos de diez minutos, la fecha de la barra va en rojo', async () => {
    const venceEn = new Date(Date.now() + 5 * 60_000).toISOString()
    respuesta = delEditor({ modalidad: 'PLAZO_ABIERTO', duracionMinutos: null, venceEn })
    montar()
    const hasta = await screen.findByText(`Hasta el ${fechaLargaDeLima(venceEn)}`)
    expect(hasta.closest('div')?.className).toMatch(/poco/)
  })

  it('AC-04: el archivo de una pregunta va en su tarjeta; respondida sin él, a medias y neutro hasta intentar entregar', async () => {
    respuesta = delEditor({
      preguntas: [PREGUNTAS[0]!, PREGUNTAS[1]!],
      entregables: [
        { id: 301, nombre: 'Flujo de caja.xlsx', detalle: null, formato: 'ARCHIVO', esObligatorio: true, entregado: false, preguntaId: 22 },
      ],
    })
    montar()
    await enLaBarra('Pregunta 2 de 2')
    const archivo = () => document.getElementById('entregable-301')!
    expect(archivo().textContent).toMatch(/^Archivo de esta pregunta: Flujo de caja\.xlsx · obligatorio/)
    // Respondida y sin su archivo: a medias en el mapa, pero el recuadro neutro y sin la frase.
    expect(archivo().className).not.toMatch(/falta/)
    expect(screen.queryByText('Sin este archivo no se puede entregar la prueba.')).toBeNull()
    expect(casilla(2).getAttribute('aria-label')).toBe('Pregunta 2, a medias, falta su archivo (estás aquí)')
    expect(screen.getByText('Te falta 1 por terminar')).toBeTruthy()

    // Al pulsar «Entregar la prueba» con el hueco: el aviso y, a la vez, el ámbar con su frase.
    fireEvent.click(screen.getByRole('button', { name: 'Entregar la prueba' }))
    expect(await screen.findByText('Te falta subir «Flujo de caja.xlsx» (pregunta 2).')).toBeTruthy()
    expect(archivo().className).toMatch(/falta/)
    expect(within(archivo()).getByText('Sin este archivo no se puede entregar la prueba.')).toBeTruthy()
    // «· obligatorio» sigue, antes y después.
    expect(archivo().textContent).toMatch(/· obligatorio/)

    // Sigue en ámbar al irse y volver a la pregunta...
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }))
    await enLaBarra('Pregunta 1 de 2')
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await enLaBarra('Pregunta 2 de 2')
    expect(archivo().className).toMatch(/falta/)

    // ...hasta que se sube.
    const campo = archivo().querySelector<HTMLInputElement>('input[type="file"]')!
    fireEvent.change(campo, { target: { files: [new File(['flujo'], 'flujo.xlsx')] } })
    await waitFor(() => expect(within(archivo()).getByText('flujo.xlsx')).toBeTruthy())
    expect(archivo().className).not.toMatch(/falta/)
    expect(screen.queryByText('Sin este archivo no se puede entregar la prueba.')).toBeNull()
  })

  it('el archivo obligatorio de una pregunta sin responder también va neutro, y en ámbar tras intentar entregar', async () => {
    respuesta = delEditor({
      preguntas: enOrden(SIN_RESPONDER[0]!, SIN_RESPONDER[3]!),
      entregables: [
        { id: 301, nombre: 'Flujo de caja.xlsx', detalle: null, formato: 'ARCHIVO', esObligatorio: true, entregado: false, preguntaId: 24 },
      ],
    })
    montar()
    await enLaBarra('Pregunta 1 de 2')
    fireEvent.click(casilla(2))
    await enLaBarra('Pregunta 2 de 2')
    // Escribir no lo pone en ámbar.
    fireEvent.change(screen.getByLabelText(/¿Cómo hallaste el descuadre\?/), { target: { value: 'En la 1041.' } })
    expect(document.getElementById('entregable-301')!.className).not.toMatch(/falta/)
    expect(screen.queryByText('Sin este archivo no se puede entregar la prueba.')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Entregar la prueba' }))
    await screen.findByText(/Te falta subir «Flujo de caja\.xlsx» \(pregunta 2\)/)
    expect(document.getElementById('entregable-301')!.className).toMatch(/falta/)
  })

  it('un general obligatorio del paso «Entregables» va neutro hasta intentar entregar, y en ámbar hasta que se sube', async () => {
    respuesta = delEditor({
      preguntas: [PREGUNTAS[0]!],
      entregables: [
        { id: 302, nombre: 'Informe final', detalle: null, formato: 'ARCHIVO', esObligatorio: true, entregado: false },
        { id: 303, nombre: 'Anexo', detalle: null, formato: 'ARCHIVO', esObligatorio: false, entregado: false },
      ],
    })
    montar()
    await screen.findByRole('heading', { level: 1, name: 'Entregables' })
    const informe = () => document.getElementById('entregable-302')!
    expect(informe().className).not.toMatch(/falta/)
    expect(screen.queryByText('Sin este archivo no se puede entregar la prueba.')).toBeNull()

    fireEvent.click(tarjeta().getByRole('button', { name: 'Entregar la prueba' }))
    expect(await screen.findByText('Te falta subir «Informe final».')).toBeTruthy()
    expect(informe().className).toMatch(/falta/)
    expect(within(informe()).getByText('Sin este archivo no se puede entregar la prueba.')).toBeTruthy()
    // El opcional no frena la entrega: nunca va en ámbar.
    expect(document.getElementById('entregable-303')!.className).not.toMatch(/falta/)

    const campo = informe().querySelector<HTMLInputElement>('input[type="file"]')!
    fireEvent.change(campo, { target: { files: [new File(['informe'], 'informe.pdf')] } })
    await waitFor(() => expect(within(informe()).getByText('informe.pdf')).toBeTruthy())
    expect(informe().className).not.toMatch(/falta/)
  })

  it('el archivo de una pregunta se sube dentro de ella; los generales van en el paso «Entregables» (AC-07)', async () => {
    respuesta = delEditor({
      entregables: [
        { id: 301, nombre: 'Flujo de caja.xlsx', detalle: null, formato: 'ARCHIVO', esObligatorio: true, entregado: false, preguntaId: 24 },
        { id: 302, nombre: 'Informe final', detalle: null, formato: 'ARCHIVO', esObligatorio: true, entregado: true },
      ],
    })
    montar()
    await enLaBarra('Pregunta 3 de 4')
    fireEvent.click(casilla(4))
    await enLaBarra('Pregunta 4 de 4')
    const archivo = document.getElementById('entregable-301')!
    expect(archivo.textContent).toMatch(/^Archivo de esta pregunta: Flujo de caja\.xlsx · obligatorio/)
    // Sin responder, el archivo no va en ámbar todavía.
    expect(archivo.className).not.toMatch(/falta/)
    // La última pregunta lleva a los entregables.
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente: entregables' }))

    await screen.findByRole('heading', { level: 1, name: 'Entregables' })
    expect(screen.getByText('Entregables', { selector: 'span' })).toBeTruthy()
    expect(tarjeta().queryByText('Flujo de caja.xlsx')).toBeNull()
    expect(tarjeta().getByText(/Informe final/)).toBeTruthy()
    // En el paso final, «Entregar la prueba» sustituye a «Siguiente» y no se repite en la barra.
    expect(screen.queryByRole('button', { name: 'Siguiente' })).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Entregar la prueba' })).toHaveLength(1)
  })

  it('AC-07: sin generales no hay paso ni casilla de «Entregables», y la última entrega', async () => {
    respuesta = delEditor({ preguntas: [PREGUNTAS[0]!, PREGUNTAS[1]!], entregables: [] })
    montar()
    await enLaBarra('Pregunta 1 de 2')
    expect(screen.queryByRole('button', { name: /^Entregables,/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await enLaBarra('Pregunta 2 de 2')
    expect(screen.queryByRole('button', { name: 'Siguiente' })).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Entregar la prueba' })).toHaveLength(1)
  })

  it('una sola pregunta y sin generales: «Siguiente» es «Entregar la prueba», sin repetir el de la barra', async () => {
    respuesta = delEditor({ preguntas: [PREGUNTAS[0]!], entregables: [] })
    montar()
    await enLaBarra('Pregunta 1 de 1')
    expect(screen.getAllByRole('button', { name: 'Entregar la prueba' })).toHaveLength(1)
  })

  it('«Entregar» sin el archivo de una pregunta lo dice y lleva a esa pregunta (AC-20 de la V68)', async () => {
    respuesta = delEditor({
      preguntas: [PREGUNTAS[0]!, PREGUNTAS[1]!],
      entregables: [
        { id: 301, nombre: 'Flujo de caja.xlsx', detalle: null, formato: 'ARCHIVO', esObligatorio: true, entregado: false, preguntaId: 22 },
        { id: 302, nombre: 'Informe final', detalle: null, formato: 'ARCHIVO', esObligatorio: true, entregado: false },
      ],
    })
    montar()
    await enLaBarra('Pregunta 2 de 2')
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }))
    await enLaBarra('Pregunta 1 de 2')
    fireEvent.click(screen.getByRole('button', { name: 'Entregar la prueba' }))
    expect(await screen.findByText('Te falta subir «Flujo de caja.xlsx» (pregunta 2), «Informe final».')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Ir a la pregunta 2' }))
    await enLaBarra('Pregunta 2 de 2')
    await waitFor(() =>
      expect(document.activeElement?.closest('[id^="entregable-"]')?.id).toBe('entregable-301'),
    )
  })

  it('si solo falta un general, lleva a los entregables', async () => {
    respuesta = delEditor({
      preguntas: [PREGUNTAS[0]!],
      entregables: [
        { id: 302, nombre: 'Informe final', detalle: null, formato: 'ARCHIVO', esObligatorio: true, entregado: false },
      ],
    })
    montar()
    await screen.findByRole('heading', { level: 1, name: 'Entregables' })
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }))
    await enLaBarra('Pregunta 1 de 1')
    fireEvent.click(screen.getByRole('button', { name: 'Entregar la prueba' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Ir a los entregables' }))
    await screen.findByRole('heading', { level: 1, name: 'Entregables' })
    await waitFor(() =>
      expect(document.activeElement?.closest('[id^="entregable-"]')?.id).toBe('entregable-302'),
    )
  })

  it('AC-16: lo respondido en otra sesión cuenta en el mapa aunque no se haya visitado', async () => {
    respuesta = delEditor({ entregables: [] })
    montar()
    await enLaBarra('Pregunta 3 de 4')
    expect(casilla(1).getAttribute('aria-label')).toBe('Pregunta 1, lista')
    expect(casilla(2).getAttribute('aria-label')).toBe('Pregunta 2, lista')
    expect(casilla(4).getAttribute('aria-label')).toBe('Pregunta 4, sin responder')
    expect(screen.getByText('Te faltan 2 por terminar')).toBeTruthy()
  })

  it('AC-08: si el guardado falla al pasar de pregunta, no se pierde, se reintenta y el mapa la marca a medias', async () => {
    vi.mocked(responderPrueba).mockRejectedValueOnce(new Error('Sin conexión'))
    respuesta = delEditor({ preguntas: enOrden(PREGUNTAS[3]!, PREGUNTAS[0]!), entregables: [] })
    montar()
    await enLaBarra('Pregunta 1 de 2')
    fireEvent.change(screen.getByLabelText(/¿Cómo hallaste el descuadre\?/), {
      target: { value: 'En la cuenta 1041.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await enLaBarra('Pregunta 2 de 2')

    await waitFor(() =>
      expect(casilla(1).getAttribute('aria-label')).toBe('Pregunta 1, a medias, no se pudo guardar; se reintenta'),
    )
    // La cola la reintenta aunque ya no esté en pantalla.
    await waitFor(() => expect(responderPrueba).toHaveBeenCalledTimes(2), { timeout: 4000 })
    await waitFor(() => expect(casilla(1).getAttribute('aria-label')).toBe('Pregunta 1, lista'))
  })

  it('AC-09: al recargar vuelve a la pregunta en la que estaba', async () => {
    respuesta = delEditor({ preguntas: SIN_RESPONDER, entregables: [] })
    montar()
    await enLaBarra('Pregunta 1 de 4')
    fireEvent.click(casilla(3))
    await enLaBarra('Pregunta 3 de 4')
    cleanup()

    montar()
    expect(await enLaBarra('Pregunta 3 de 4')).toBeTruthy()
  })

  it('QA-UPP-01: un doble clic en «Siguiente» avanza una sola pregunta y no marca la opción que queda debajo', async () => {
    respuesta = delEditor({ preguntas: SIN_RESPONDER, entregables: [] })
    montar()
    await enLaBarra('Pregunta 1 de 4')
    fireEvent.click(screen.getByRole('radio', { name: /Libro diario/ }))
    await waitFor(() => expect(responderPruebaCerrada).toHaveBeenCalledWith('x1', 21, { opcionId: 1 }))

    const boton = screen.getByRole('button', { name: 'Siguiente' })
    fireEvent.mouseDown(boton, { detail: 1 })
    fireEvent.click(boton, { detail: 1 })
    await enLaBarra('Pregunta 2 de 4')
    // La 2 es más alta: la segunda pulsación cae sobre una de sus opciones, y no cuenta.
    const bancos = screen.getByRole('checkbox', { name: /Bancos/ }) as HTMLInputElement
    const opcion = bancos.closest('label')!
    expect(fireEvent.mouseDown(opcion, { detail: 2 })).toBe(false)
    expect(fireEvent.click(opcion, { detail: 2 })).toBe(false)
    expect(fireEvent.click(bancos, { detail: 2 })).toBe(false)
    fireEvent.dblClick(opcion, { detail: 2 })
    await new Promise((seguir) => setTimeout(seguir, 0))
    expect(bancos.checked).toBe(false)
    expect(responderPruebaCerrada).toHaveBeenCalledTimes(1)
    expect(casilla(2).getAttribute('aria-label')).toBe('Pregunta 2, sin responder (estás aquí)')
    expect(screen.getByText('Pregunta 2 de 4')).toBeTruthy()
  })
})

describe('el lateral de la prueba (AC-06, AC-15)', () => {
  it('con caso se titula «El caso», se oculta y vuelve con «Ver el caso» desde otra pregunta', async () => {
    respuesta = delEditor({ consigna: { nombre: 'consigna.pdf', url: null } })
    montar()
    await enLaBarra('Pregunta 3 de 4')
    const lateral = screen.getByRole('complementary', { name: 'El caso' })
    expect(within(lateral).getByText('La empresa cerró marzo con un descuadre.')).toBeTruthy()
    expect(within(lateral).getByText('Enunciado adjunto: consigna.pdf.')).toBeTruthy()

    fireEvent.click(within(lateral).getByRole('button', { name: 'Ocultar el caso' }))
    expect(screen.queryByRole('complementary')).toBeNull()

    fireEvent.click(casilla(1))
    await enLaBarra('Pregunta 1 de 4')
    fireEvent.click(screen.getByRole('button', { name: 'Ver el caso' }))
    expect(screen.getByRole('complementary', { name: 'El caso' })).toBeTruthy()
  })

  it('un caso corto va entero y sin «Leer el caso completo»; el adjunto, en el lateral', async () => {
    respuesta = delEditor({ consigna: { nombre: 'consigna.pdf', url: null } })
    montar()
    await enLaBarra('Pregunta 3 de 4')
    const lateral = screen.getByRole('complementary', { name: 'El caso' })
    const texto = within(lateral).getByText('La empresa cerró marzo con un descuadre.')
    expect(texto.closest('[class*="casoRecortado"]')).toBeNull()
    // La letra del cuerpo, no la de la prosa.
    expect(texto.className).toMatch(/parrafoLateral/)
    expect(within(lateral).queryByRole('button', { name: 'Leer el caso completo' })).toBeNull()
    expect(within(lateral).getByText('Enunciado adjunto: consigna.pdf.')).toBeTruthy()
  })

  it('un caso largo sale recortado y «Leer el caso completo» lo abre entero, con su adjunto; Escape y ✕ lo cierran', async () => {
    respuesta = delEditor({
      enunciado: CASO_LARGO,
      consigna: { nombre: 'caso.pdf', url: null },
      materiales: 'El mayor de marzo.',
      herramientasPermitidas: 'Excel',
    })
    montar()
    await enLaBarra('Pregunta 3 de 4')
    const lateral = screen.getByRole('complementary', { name: 'El caso' })
    // El comienzo, recortado a unas líneas; el adjunto, los materiales y las herramientas siguen ahí.
    const comienzo = within(lateral).getByText(PRIMER_PARRAFO)
    expect(comienzo.closest('[class*="casoRecortado"]')).toBeTruthy()
    expect(comienzo.className).toMatch(/parrafoLateral/)
    // Su lista también es una lista en el lateral, con la letra del lateral.
    const listaDelLateral = comienzo.parentElement!.querySelector('ul')!
    expect(listaDelLateral.className).toMatch(/parrafoLateral/)
    expect(listaDelLateral.querySelectorAll('li')).toHaveLength(2)
    expect(within(lateral).getByText('Enunciado adjunto: caso.pdf.')).toBeTruthy()
    expect(within(lateral).getByText('Materiales')).toBeTruthy()
    expect(within(lateral).getByText('Herramientas permitidas')).toBeTruthy()

    const leer = within(lateral).getByRole('button', { name: 'Leer el caso completo' })
    leer.focus()
    fireEvent.click(leer)
    const ventana = screen.getByRole('dialog', { name: 'El caso' })
    // Entero, con sus párrafos y sus saltos de línea, y el adjunto; sin materiales ni herramientas.
    const parrafos = [...ventana.querySelectorAll('p')].filter((p) => /parrafoDeLectura/.test(p.className))
    expect(parrafos.map((p) => p.textContent)).toEqual([PRIMER_PARRAFO, 'Lo que tienes:', PARRAFO_FINAL])
    // Su lista, una `ul` de verdad, con la misma letra
    const lista = within(ventana).getByRole('list')
    expect(within(lista).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'el mayor de marzo',
      'el extracto del banco',
    ])
    expect(lista.className).toMatch(/parrafoDeLectura/)
    expect(within(ventana).getByText('Enunciado adjunto: caso.pdf.')).toBeTruthy()
    expect(within(ventana).queryByText('Materiales')).toBeNull()
    // En el teléfono ocupa la pantalla entera.
    expect(ventana.className).toMatch(/cajaCompleta/)
    // El foco entra en la ventana, y Escape la cierra y lo devuelve al botón.
    expect(ventana.contains(document.activeElement)).toBe(true)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(leer)

    // La ✕ también.
    fireEvent.click(leer)
    fireEvent.click(within(screen.getByRole('dialog', { name: 'El caso' })).getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(leer)
  })

  it('QA-UPP-07: recortado, el enlace del caso no entra en el orden de Tab; en la ventana de lectura sí', async () => {
    respuesta = delEditor({ enunciado: CASO_LARGO_CON_ENLACE })
    montar()
    await enLaBarra('Pregunta 3 de 4')
    const lateral = screen.getByRole('complementary', { name: 'El caso' })
    const enElLateral = within(lateral).getByRole('link', { name: 'Abrir el enunciado de la prueba (PDF)' })
    expect(enElLateral.closest('[class*="casoRecortado"]')).toBeTruthy()
    // Sigue siendo un enlace, para el ratón y el lector de pantalla; Tab no se detiene en él.
    expect(enElLateral.getAttribute('href')).toBe(ENLACE_DEL_CASO)
    expect(enElLateral.getAttribute('tabindex')).toBe('-1')

    fireEvent.click(within(lateral).getByRole('button', { name: 'Leer el caso completo' }))
    const ventana = screen.getByRole('dialog', { name: 'El caso' })
    const enLaVentana = within(ventana).getByRole('link', { name: 'Abrir el enunciado de la prueba (PDF)' })
    expect(enLaVentana.getAttribute('href')).toBe(ENLACE_DEL_CASO)
    expect(enLaVentana.hasAttribute('tabindex')).toBe(false)
  })

  it('QA-UPP-07: un caso corto con enlace va entero, sin botón, y su enlace se tabula', async () => {
    respuesta = delEditor({ enunciado: `Lee el plan contable: ${ENLACE_DEL_CASO}` })
    montar()
    await enLaBarra('Pregunta 3 de 4')
    const lateral = screen.getByRole('complementary', { name: 'El caso' })
    const enlace = within(lateral).getByRole('link', { name: 'Abrir el enunciado de la prueba (PDF)' })
    expect(enlace.closest('[class*="casoRecortado"]')).toBeNull()
    expect(within(lateral).queryByRole('button', { name: 'Leer el caso completo' })).toBeNull()
    expect(enlace.hasAttribute('tabindex')).toBe(false)
  })

  it('el foco no sale de la ventana de lectura con Tab', async () => {
    respuesta = delEditor({ enunciado: CASO_LARGO, consigna: { nombre: 'caso.pdf', url: 'https://sb.co/caso.pdf' } })
    montar()
    await enLaBarra('Pregunta 3 de 4')
    fireEvent.click(screen.getByRole('button', { name: 'Leer el caso completo' }))
    const ventana = screen.getByRole('dialog', { name: 'El caso' })
    const cerrar = within(ventana).getByRole('button', { name: 'Cerrar' })
    const adjunto = within(ventana).getByRole('link', { name: 'Abrir el enunciado adjunto: caso.pdf' })
    expect(document.activeElement).toBe(cerrar)
    adjunto.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(cerrar)
  })

  it('sin caso, con herramientas o generales, se titula «Para esta prueba»', async () => {
    respuesta = delEditor({ enunciado: null, herramientasPermitidas: 'Excel y una calculadora' })
    montar()
    await enLaBarra('Pregunta 3 de 4')
    const lateral = screen.getByRole('complementary', { name: 'Para esta prueba' })
    expect(within(lateral).getByText('Herramientas permitidas')).toBeTruthy()
    fireEvent.click(within(lateral).getByRole('button', { name: 'Ocultar «Para esta prueba»' }))
    expect(screen.getByRole('button', { name: 'Para esta prueba' })).toBeTruthy()
  })

  describe('QA-UPP-12: ocultar o ver el lateral no deja el foco en el cuerpo de la página', () => {
    it.each([
      { variante: 'con caso', datos: {}, titulo: 'El caso', ocultar: 'Ocultar el caso', ver: 'Ver el caso' },
      {
        variante: 'sin caso, «Para esta prueba»',
        datos: { enunciado: null, herramientasPermitidas: 'Excel y una calculadora' },
        titulo: 'Para esta prueba',
        ocultar: 'Ocultar «Para esta prueba»',
        ver: 'Para esta prueba',
      },
    ])('ocultar deja el foco en el botón de la barra y volver a verlo lo lleva a «Ocultar» del lateral ($titulo)', async ({ datos, titulo, ocultar, ver }) => {
      respuesta = delEditor(datos)
      montar()
      await enLaBarra('Pregunta 3 de 4')
      const lateral = screen.getByRole('complementary', { name: titulo })
      // Al montar (o recargar) el foco no se mueve al lateral: solo tras la acción.
      expect(document.activeElement).not.toBe(within(lateral).getByRole('button', { name: ocultar }))

      fireEvent.click(within(lateral).getByRole('button', { name: ocultar }))
      expect(screen.queryByRole('complementary')).toBeNull()
      expect(document.activeElement).toBe(screen.getByRole('button', { name: ver }))

      fireEvent.click(screen.getByRole('button', { name: ver }))
      const deNuevo = screen.getByRole('complementary', { name: titulo })
      expect(document.activeElement).toBe(within(deNuevo).getByRole('button', { name: ocultar }))
    })

    it('al cambiar de pregunta con el lateral oculto, el foco no salta a «Ver el caso»', async () => {
      respuesta = delEditor()
      montar()
      await enLaBarra('Pregunta 3 de 4')
      fireEvent.click(screen.getByRole('button', { name: 'Ocultar el caso' }))
      fireEvent.click(casilla(1))
      await enLaBarra('Pregunta 1 de 4')
      expect(document.activeElement).not.toBe(screen.getByRole('button', { name: 'Ver el caso' }))
    })
  })

  it('sin caso ni nada que leer, no hay lateral: la pregunta va centrada', async () => {
    respuesta = delEditor({ enunciado: null, entregables: [] })
    montar()
    await enLaBarra('Pregunta 3 de 4')
    expect(screen.queryByRole('complementary')).toBeNull()
    expect(screen.queryByRole('button', { name: /Ver el caso|Para esta prueba/ })).toBeNull()
  })

  it('«Por entregar» dice si cada general está subido, «Ir →» lleva al paso y desde ahí no se sube nada', async () => {
    respuesta = delEditor({
      entregables: [
        { id: 302, nombre: 'Informe final', detalle: null, formato: 'ARCHIVO', esObligatorio: true, entregado: false },
        { id: 303, nombre: 'Video de 2 min', detalle: null, formato: 'ENLACE', esObligatorio: false, entregado: true },
      ],
    })
    montar()
    await enLaBarra('Pregunta 3 de 4')
    const lateral = screen.getByRole('complementary', { name: 'El caso' })
    expect(within(lateral).getByText('Por entregar')).toBeTruthy()
    expect(within(lateral).getByText('obligatorio, pendiente')).toBeTruthy()
    expect(within(lateral).getByText('subido')).toBeTruthy()
    expect(within(lateral).queryByRole('button', { name: /Seleccionar archivo|Guardar enlace/ })).toBeNull()
    expect(lateral.querySelector('input')).toBeNull()

    fireEvent.click(within(lateral).getByRole('button', { name: 'Ir a subir «Informe final»' }))
    await screen.findByRole('heading', { level: 1, name: 'Entregables' })
    await waitFor(() =>
      expect(document.activeElement?.closest('[id^="entregable-"]')?.id).toBe('entregable-302'),
    )
  })
})

/** En el teléfono: el mapa en una hoja desde abajo y el caso plegado encima de la pregunta. */
describe('en el teléfono (AC-12)', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (consulta: string) => ({
      matches: /max-width/.test(consulta),
      media: consulta,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('el mapa se abre como hoja y se cierra al elegir; el caso es una barra plegable', async () => {
    respuesta = delEditor()
    montar()
    await enLaBarra('Pregunta 3 de 4')
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(screen.queryByRole('complementary')).toBeNull()

    const plegado = screen.getByRole('button', { name: 'Ver el caso' })
    expect(plegado.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(plegado)
    expect(plegado.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('La empresa cerró marzo con un descuadre.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Ver las 4' }))
    const hoja = screen.getByRole('dialog', { name: 'Las 4 preguntas' })
    fireEvent.click(within(hoja).getByRole('button', { name: /^Pregunta 1,/ }))
    expect(screen.queryByRole('dialog')).toBeNull()
    await enLaBarra('Pregunta 1 de 4')
    // «Entregar la prueba» va debajo de la pregunta, una sola vez.
    expect(screen.getAllByRole('button', { name: 'Entregar la prueba' })).toHaveLength(1)
  })

  it('un caso largo, en la barra plegable, también se abre en la ventana de lectura', async () => {
    respuesta = delEditor({ enunciado: CASO_LARGO })
    montar()
    await enLaBarra('Pregunta 3 de 4')
    fireEvent.click(screen.getByRole('button', { name: 'Ver el caso' }))
    const leer = screen.getByRole('button', { name: 'Leer el caso completo' })
    expect(screen.getByText(PRIMER_PARRAFO).closest('[class*="casoRecortado"]')).toBeTruthy()
    leer.focus()
    fireEvent.click(leer)
    const ventana = screen.getByRole('dialog', { name: 'El caso' })
    expect(within(ventana).getByText(PARRAFO_FINAL)).toBeTruthy()
    expect(ventana.className).toMatch(/cajaCompleta/)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'El caso' })).toBeNull()
    expect(document.activeElement).toBe(leer)
  })

  it('QA-UPP-07: en la barra plegable, el enlace del caso recortado tampoco entra en el orden de Tab', async () => {
    respuesta = delEditor({ enunciado: CASO_LARGO_CON_ENLACE })
    montar()
    await enLaBarra('Pregunta 3 de 4')
    fireEvent.click(screen.getByRole('button', { name: 'Ver el caso' }))
    const enlace = screen.getByRole('link', { name: 'Abrir el enunciado de la prueba (PDF)' })
    expect(enlace.closest('[class*="casoRecortado"]')).toBeTruthy()
    expect(enlace.getAttribute('tabindex')).toBe('-1')
    fireEvent.click(screen.getByRole('button', { name: 'Leer el caso completo' }))
    const ventana = screen.getByRole('dialog', { name: 'El caso' })
    expect(within(ventana).getByRole('link', { name: 'Abrir el enunciado de la prueba (PDF)' }).hasAttribute('tabindex')).toBe(false)
  })

  it('QA-UPP-02 y 03: la hoja empieza donde acaba la barra ya con «Ocultar el mapa», la sigue, y ese botón la cierra', async () => {
    respuesta = delEditor()
    montar()
    await enLaBarra('Pregunta 3 de 4')
    const boton = screen.getByRole('button', { name: 'Ver las 4' })
    const barra = boton.parentElement!.parentElement!
    let crece = 0
    // Con «Ocultar el mapa», más ancho, «Siguiente sin responder» baja de fila: 221 → 273 px.
    const medida = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const bajo = this === barra ? (boton.textContent === 'Ocultar el mapa' ? 273 : 221) + crece : 0
      return { top: 0, left: 0, right: 0, x: 0, y: 0, width: 0, bottom: bajo, height: bajo, toJSON: () => ({}) }
    })
    try {
      fireEvent.click(boton)
      const hoja = screen.getByRole('dialog', { name: 'Las 4 preguntas' })
      expect(boton.textContent).toBe('Ocultar el mapa')
      expect(hoja.parentElement!.style.top).toBe('273px')

      // Al desplazar la página la barra se mueve hasta quedarse fija: la hoja la sigue.
      crece = -60
      fireEvent.scroll(window)
      expect(hoja.parentElement!.style.top).toBe('213px')

      fireEvent.click(boton)
      expect(screen.queryByRole('dialog', { name: 'Las 4 preguntas' })).toBeNull()
      expect(boton.textContent).toBe('Ver las 4')
      expect(boton.getAttribute('aria-expanded')).toBe('false')
      expect(document.activeElement).toBe(boton)
    } finally {
      medida.mockRestore()
    }
  })
})
