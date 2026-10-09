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
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { entregarPrueba, responderPrueba, responderPruebaCerrada } from '@/api/prueba'
import type { MiPrueba, PreguntaPrueba } from '@/api/tipos'
import { fechaLargaDeLima } from '@/dominio/horaDeLima'
import { ProveedorAvisos } from '@/ui/Avisos'
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
    respuesta = delEditor({ estadoIntento: 'PENDIENTE', iniciadoEn: null, venceEn: null })
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Empezar prueba' }))
    const dialogo = await screen.findByRole('dialog')
    expect(dialogo.textContent).toContain('la prueba se entrega sola si está completa')
    expect(dialogo.textContent).toContain('queda sin completar y no se califica')
    expect(dialogo.textContent).not.toContain('se entrega lo que hayas guardado')
  })

  it('la pantalla previa sin caso: fecha límite, tiempo, cuántas preguntas y archivos; ningún bloque de caso (AC-19)', async () => {
    respuesta = delEditor({
      estadoIntento: 'PENDIENTE',
      iniciadoEn: null,
      venceEn: null,
      enunciado: null,
      herramientasPermitidas: 'Excel',
      fechaLimite: '2026-10-10T04:59:00Z',
      entregables: [
        { id: 301, nombre: 'Flujo de caja.xlsx', detalle: null, formato: 'ARCHIVO', esObligatorio: true, entregado: false, preguntaId: 24 },
        { id: 302, nombre: 'Informe final', detalle: null, formato: 'ARCHIVO', esObligatorio: true, entregado: false },
      ],
    })
    montar()
    expect(await screen.findByText('viernes 09/10 a las 23:59')).toBeTruthy()
    expect(screen.getByText('Fecha límite')).toBeTruthy()
    expect(screen.getByText('Tendrás 90 minutos desde que pulses Empezar')).toBeTruthy()
    expect(screen.getByText('4 preguntas · 2 archivos que subir')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Herramientas permitidas' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /El caso|El encargo|De qué va/ })).toBeNull()
    expect(screen.getByText(/· en la pregunta 4/)).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/cuestionario/i)
  })

  it('sin cronómetro: «Puedes trabajar en ella hasta la fecha límite»; con caso, «El caso» y su PDF', async () => {
    respuesta = delEditor({
      estadoIntento: 'PENDIENTE',
      iniciadoEn: null,
      venceEn: null,
      modalidad: 'PLAZO_ABIERTO',
      duracionMinutos: null,
      fechaLimite: '2026-10-10T04:59:00Z',
      consigna: { nombre: 'caso.pdf', url: null },
    })
    montar()
    expect(await screen.findByText('Puedes trabajar en ella hasta la fecha límite')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'El caso' })).toBeTruthy()
    expect(screen.getByText('Enunciado adjunto: caso.pdf.')).toBeTruthy()
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

  it('AC-04: el archivo de una pregunta va en su tarjeta; respondida sin él, ámbar y a medias', async () => {
    respuesta = delEditor({
      preguntas: [PREGUNTAS[0]!, PREGUNTAS[1]!],
      entregables: [
        { id: 301, nombre: 'Flujo de caja.xlsx', detalle: null, formato: 'ARCHIVO', esObligatorio: true, entregado: false, preguntaId: 22 },
      ],
    })
    montar()
    await enLaBarra('Pregunta 2 de 2')
    const archivo = document.getElementById('entregable-301')!
    expect(archivo.textContent).toMatch(/^Archivo de esta pregunta: Flujo de caja\.xlsx · obligatorio/)
    expect(archivo.className).toMatch(/falta/)
    expect(casilla(2).getAttribute('aria-label')).toBe('Pregunta 2, a medias, falta su archivo (estás aquí)')
    expect(screen.getByText('Te falta 1 por terminar')).toBeTruthy()
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

  it('sin caso, con herramientas o generales, se titula «Para esta prueba»', async () => {
    respuesta = delEditor({ enunciado: null, herramientasPermitidas: 'Excel y una calculadora' })
    montar()
    await enLaBarra('Pregunta 3 de 4')
    const lateral = screen.getByRole('complementary', { name: 'Para esta prueba' })
    expect(within(lateral).getByText('Herramientas permitidas')).toBeTruthy()
    fireEvent.click(within(lateral).getByRole('button', { name: 'Ocultar «Para esta prueba»' }))
    expect(screen.getByRole('button', { name: 'Para esta prueba' })).toBeTruthy()
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
