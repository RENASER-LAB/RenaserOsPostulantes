/**
 * El cuestionario tecnico: lo que compila perfectamente estando mal.
 *
 *   0. **Decir que ya esta.** El POST contesta 202 y la IA tarda minutos; lo
 *      unico cierto es que se pidio. Las preguntas que se pintan salen del GET.
 *   1. **Tratar `encolada=false` como averia.** Es «ya hay una en curso o la IA
 *      esta apagada»: nube hundida y `status`, sin sondeo.
 *   2. **Sondear sin fin, o seguir sondeando lo que ya termino.** Aqui SI hay
 *      endpoint de estado: se arranca solo con EN_CURSO y se corta al salir
 *      de EN_CURSO. Y al agotarse, «dejamos de mirar», nunca «fallo».
 *   3. **Pintar el 400 de publicar en una linea.** La aduana devuelve varios
 *      errores y quien corrige tiene que verlos uno a uno.
 *   4. **Ofrecer corregir lo publicado, o pintar la PRESENCIAL como una mas.**
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ErrorApi } from '../../api/cliente'
import type {
  CorregirPreguntaTecnica,
  CuestionarioTecnico as Cuestionario,
  PreguntaDelCuestionario,
} from '../../api/tipos'
import { CuestionarioTecnico } from './CuestionarioTecnico'

const ver = vi.fn()
const generar = vi.fn()
const corregir = vi.fn()
const publicar = vi.fn()

vi.mock('../../api/panel', () => ({
  verCuestionarioTecnico: (id: number) => ver(id),
  generarCuestionarioTecnico: (id: number) => generar(id),
  corregirPreguntaTecnica: (id: number, preguntaId: number, datos: CorregirPreguntaTecnica) =>
    corregir(id, preguntaId, datos),
  publicarCuestionarioTecnico: (id: number) => publicar(id),
}))

const pregunta = (parte: Partial<PreguntaDelCuestionario>): PreguntaDelCuestionario => ({
  id: 100,
  codigo: 'T01',
  bloque: 'EXPERIENCIA',
  enunciado: '¿Cuántas sedes has tenido a cargo y con cuánta gente?',
  c3Esperado: 'Número de sedes y de personas',
  c4Esperado: 'La sede que peor funcionó',
  senalDeCero: 'No da ninguna cifra',
  presencial: false,
  orden: 1,
  ...parte,
})

const SIN_NADA: Cuestionario = {
  versionBancoId: null,
  estado: null,
  desactualizado: false,
  generacion: 'SIN_PEDIR',
  preguntas: [],
}

const BORRADOR: Cuestionario = {
  versionBancoId: 40,
  estado: 'BORRADOR',
  desactualizado: false,
  generacion: 'LISTA',
  preguntas: [
    pregunta({ id: 100, codigo: 'T01', orden: 1 }),
    pregunta({ id: 101, codigo: 'T02', orden: 2, bloque: 'RIESGO_1', enunciado: 'Si falta plata en caja, ¿cuál es tu procedimiento exacto?' }),
    pregunta({ id: 112, codigo: 'T12', orden: 12, bloque: 'PRESENCIAL', presencial: true, enunciado: 'Revisa este arqueo y di qué está mal.' }),
  ],
}

/** Las palabras que este bloque no puede decir despues de un 202. */
const MENTIRAS = [/\blisto\b/i, /generad[oa]\b/i, /ya está\b/i]
const loQueSeLee = () => document.body.textContent ?? ''

function pintar(fichaCompleta = true): QueryClient {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={cliente}>
      <CuestionarioTecnico vacanteId={7} fichaCompleta={fichaCompleta} />
    </QueryClientProvider>,
  )
  return cliente
}

const avanzar = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })

beforeEach(() => {
  ver.mockReset()
  generar.mockReset()
  corregir.mockReset()
  publicar.mockReset()
  ver.mockResolvedValue(SIN_NADA)
  generar.mockResolvedValue({ encolada: true })
  corregir.mockResolvedValue(undefined)
  publicar.mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('pedirle el cuestionario a la IA', () => {
  it('sin ficha completa no hay botón, y se dice por qué', async () => {
    pintar(false)
    await screen.findByText('Todavía no hay cuestionario')
    expect(screen.queryByRole('button', { name: /pedirle el cuestionario/i })).toBeNull()
    expect(screen.getByText(/completa la ficha del puesto primero/i)).toBeTruthy()
  })

  it('tras el 202 dice que está redactando y en ningún sitio que ya está', async () => {
    vi.useFakeTimers()
    let generacion = 'SIN_PEDIR'
    ver.mockImplementation(() => Promise.resolve({ ...SIN_NADA, generacion }))
    generar.mockImplementation(() => {
      generacion = 'EN_CURSO'
      return Promise.resolve({ encolada: true })
    })
    pintar()
    await avanzar(0)

    fireEvent.click(screen.getByRole('button', { name: /pedirle el cuestionario/i }))
    await avanzar(0)

    expect(generar).toHaveBeenCalledWith(7)
    expect(screen.getByText(/la IA está redactando/i)).toBeTruthy()
    expect(screen.getByRole('status').textContent).toMatch(/0 de 6/)
    for (const mentira of MENTIRAS) expect(loQueSeLee()).not.toMatch(mentira)
  })

  it('«encolada=false» no es una avería: status, sin sondeo', async () => {
    vi.useFakeTimers()
    generar.mockResolvedValue({ encolada: false })
    pintar()
    await avanzar(0)

    fireEvent.click(screen.getByRole('button', { name: /pedirle el cuestionario/i }))
    await avanzar(0)
    const llamadasAntes = ver.mock.calls.length

    expect(screen.getByText(/no se encoló nada/i)).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText(/la IA está redactando/i)).toBeNull()

    await avanzar(300_000)
    expect(ver.mock.calls.length).toBe(llamadasAntes)
  })

  it('un 409 (la ficha a medias) se lee tal cual', async () => {
    generar.mockRejectedValue(new ErrorApi(409, 'La ficha está a medias: complétala antes de pedir el cuestionario'))
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: /pedirle el cuestionario/i }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/a medias/)
  })

  it('un 403 nombra el permiso y no se pinta como avería', async () => {
    generar.mockRejectedValue(new ErrorApi(403, 'No encontramos eso, o no es tuyo.'))
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: /pedirle el cuestionario/i }))
    expect((await screen.findByText(/editar_vacante/)).closest('[role="status"]')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('el sondeo mientras la IA trabaja', () => {
  it('arranca solo si al abrir ya está EN_CURSO, y se corta al llegar el borrador', async () => {
    vi.useFakeTimers()
    let respuesta: Cuestionario = { ...SIN_NADA, generacion: 'EN_CURSO' }
    ver.mockImplementation(() => Promise.resolve(respuesta))
    pintar()
    await avanzar(0)
    expect(screen.getByText(/la IA está redactando/i)).toBeTruthy()
    expect(ver).toHaveBeenCalledTimes(1)

    await avanzar(15_000)
    expect(ver).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('status').textContent).toMatch(/1 de 6/)

    respuesta = BORRADOR
    await avanzar(20_000)
    expect(ver).toHaveBeenCalledTimes(3)
    expect(screen.getByText(/cuántas sedes has tenido a cargo/i)).toBeTruthy()
    expect(screen.queryByText(/la IA está redactando/i)).toBeNull()

    // Ya llegó: seguir refrescando sería tirar peticiones.
    await avanzar(600_000)
    expect(ver).toHaveBeenCalledTimes(3)
  })

  it('se agota y al agotarse no dice que fallara', async () => {
    vi.useFakeTimers()
    ver.mockResolvedValue({ ...SIN_NADA, generacion: 'EN_CURSO' })
    pintar()
    await avanzar(0)

    for (let vuelta = 0; vuelta < 9; vuelta += 1) await avanzar(120_000)

    // Una de entrada y seis del sondeo.
    expect(ver).toHaveBeenCalledTimes(7)
    expect(loQueSeLee()).toMatch(/dejamos de refrescar después de 6 intentos/i)
    expect(loQueSeLee()).toMatch(/no quiere decir que fallara/i)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('una generación FALLIDA sí es un aviso, y se puede volver a pedir', async () => {
    ver.mockResolvedValue({ ...SIN_NADA, generacion: 'FALLIDA' })
    pintar()
    expect((await screen.findByRole('alert')).textContent).toMatch(/la última generación falló/i)
    expect(screen.getByRole('button', { name: /pedirle el cuestionario/i })).toBeTruthy()
  })
})

describe('revisar el borrador', () => {
  it('agrupa por bloque, marca la presencial y ofrece corregir y publicar', async () => {
    ver.mockResolvedValue(BORRADOR)
    pintar()
    await screen.findByText(/cuántas sedes has tenido a cargo/i)

    expect(screen.getByRole('heading', { name: 'Experiencia y escala' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /Riesgo 1/ })).toBeTruthy()
    const presencial = screen.getByRole('article', { name: 'Pregunta T12' })
    expect(within(presencial).getByText(/no se envía al candidato/i)).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Corregir' })).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Publicar el cuestionario' })).toBeTruthy()
    expect(screen.getByText('Borrador · sin publicar')).toBeTruthy()
  })

  it('corregir manda los cuatro campos aunque cambie uno', async () => {
    ver.mockResolvedValue(BORRADOR)
    pintar()
    await screen.findByText(/cuántas sedes has tenido a cargo/i)

    const tarjeta = screen.getByRole('article', { name: 'Pregunta T01' })
    fireEvent.click(within(tarjeta).getByRole('button', { name: 'Corregir' }))
    fireEvent.change(within(tarjeta).getByLabelText('Enunciado'), {
      target: { value: '¿Cuántas sedes has tenido a cargo, y con cuánta plata en caja cada una?' },
    })
    fireEvent.click(within(tarjeta).getByRole('button', { name: 'Guardar la corrección' }))

    await waitFor(() => expect(corregir).toHaveBeenCalledTimes(1))
    expect(corregir).toHaveBeenCalledWith(7, 100, {
      enunciado: '¿Cuántas sedes has tenido a cargo, y con cuánta plata en caja cada una?',
      c3Esperado: 'Número de sedes y de personas',
      c4Esperado: 'La sede que peor funcionó',
      senalDeCero: 'No da ninguna cifra',
    })
  })

  it('el 400 de publicar se pinta como la lista de la aduana', async () => {
    ver.mockResolvedValue(BORRADOR)
    publicar.mockRejectedValue(
      new ErrorApi(
        400,
        'El cuestionario no pasa la aduana: la pregunta T03 no tiene señal de 0 · el bloque RIESGO_2 tiene 1 pregunta y el nivel pide 2',
      ),
    )
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: 'Publicar el cuestionario' }))

    const aviso = await screen.findByRole('alert')
    const errores = within(aviso).getAllByRole('listitem').map((li) => li.textContent)
    expect(errores).toEqual([
      'la pregunta T03 no tiene señal de 0',
      'el bloque RIESGO_2 tiene 1 pregunta y el nivel pide 2',
    ])
  })

  it('publicado: sin corregir ni publicar, y se puede volver a generar', async () => {
    ver.mockResolvedValue({ ...BORRADOR, estado: 'PUBLICADA' })
    pintar()
    await screen.findByText(/cuántas sedes has tenido a cargo/i)

    expect(screen.getByText('Publicado')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Corregir' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Publicar el cuestionario' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Volver a generar' }))
    expect(screen.getByRole('dialog').textContent).toMatch(/sigue vigente/i)
  })

  it('si la ficha cambió después, lo dice sin pintarlo como error', async () => {
    ver.mockResolvedValue({ ...BORRADOR, desactualizado: true })
    pintar()
    expect((await screen.findByText(/la ficha cambió después/i)).closest('[role="status"]')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

/*
 * ⚠️ Lo que reprodujo el QA: entre el 202 y el GET que ya dice EN_CURSO,
 * `generacion` seguía en SIN_PEDIR; el sondeo se cortaba solo, no se veía
 * «está redactando» y un segundo clic mandaba un segundo POST.
 */
describe('entre el 202 y el GET', () => {
  it('el botón sigue apagado hasta que el servidor diga EN_CURSO, y no hay segundo POST', async () => {
    vi.useFakeTimers()
    let respuesta: Cuestionario = SIN_NADA
    let soltarElGet: () => void = () => {}
    let llamadas = 0
    ver.mockImplementation(() => {
      llamadas += 1
      // La primera carga contesta al momento; el GET tras el 202 se retiene.
      if (llamadas === 1) return Promise.resolve(respuesta)
      return new Promise<Cuestionario>((r) => {
        soltarElGet = () => r(respuesta)
      })
    })
    generar.mockImplementation(() => {
      respuesta = { ...SIN_NADA, generacion: 'EN_CURSO' }
      return Promise.resolve({ encolada: true })
    })
    pintar()
    await avanzar(0)

    const boton = screen.getByRole('button', { name: /pedirle el cuestionario/i })
    fireEvent.click(boton)
    await avanzar(0)

    // 202 recibido, GET en vuelo: el botón sigue apagado y un segundo clic no hace nada.
    expect((boton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(boton)
    await avanzar(0)
    expect(generar).toHaveBeenCalledTimes(1)

    soltarElGet()
    await avanzar(0)
    expect(screen.getByText(/la IA está redactando/i)).toBeTruthy()
    expect(generar).toHaveBeenCalledTimes(1)
  })

  it('un sondeo agotado no hereda el «agotado» para la siguiente generación', async () => {
    vi.useFakeTimers()
    let respuesta: Cuestionario = { ...SIN_NADA, generacion: 'EN_CURSO' }
    ver.mockImplementation(() => Promise.resolve(respuesta))
    const cliente = pintar()
    await avanzar(0)
    for (let vuelta = 0; vuelta < 9; vuelta += 1) await avanzar(120_000)
    expect(loQueSeLee()).toMatch(/dejamos de refrescar/i)

    // Terminó (LISTA): al verlo, el sondeo se olvida de sus vueltas.
    respuesta = BORRADOR
    fireEvent.click(screen.getByRole('button', { name: 'Mirar otra vez' }))
    await avanzar(0)
    expect(screen.queryByText(/dejamos de refrescar/i)).toBeNull()

    // Más tarde alguien vuelve a generar y un refresco externo trae EN_CURSO:
    // se vuelve a mirar desde cero, sin arrastrar el «agotado» anterior.
    respuesta = { ...BORRADOR, generacion: 'EN_CURSO' }
    await act(async () => {
      await cliente.invalidateQueries()
    })
    await avanzar(0)
    expect(screen.getByText(/la IA está redactando/i)).toBeTruthy()
    expect(screen.getByRole('status').textContent).toMatch(/0 de 6/)
  })
})
