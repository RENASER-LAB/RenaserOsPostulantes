/**
 * La prueba técnica del candidato: lo que compila perfectamente estando mal.
 *
 *   1. **Decir «guardada» sobre algo que no llegó.** Es la regla que ya costó respuestas
 *      perdidas en la evaluación del banco: lo escrito no sale de la cola hasta que el
 *      servidor lo confirma, y mientras tanto se dice.
 *   2. **Una pregunta en blanco «guardada».** Está *sin responder*, que es otra cosa.
 *   3. **Dejar entregar a medias.** La nota se calcularía sobre un examen incompleto y el
 *      candidato no sabría que faltaba nada.
 *   4. **Pedirle un archivo.** Esta etapa se contesta escribiendo; no hay nada que subir.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { CuestionarioTecnico } from './CuestionarioTecnico'
import type { EvaluacionCandidato } from '@/api/tipos'

const ver = vi.fn()
const iniciar = vi.fn()
const responder = vi.fn()
const entregar = vi.fn()

vi.mock('@/api/cuestionarioTecnico', () => ({
  verCuestionarioTecnico: (uuid: string) => ver(uuid),
  iniciarCuestionarioTecnico: (uuid: string) => iniciar(uuid),
  responderCuestionarioTecnico: (uuid: string, preguntaId: number, datos: unknown) =>
    responder(uuid, preguntaId, datos),
  entregarCuestionarioTecnico: (uuid: string) => entregar(uuid),
}))

vi.mock('@/ui/Avisos', () => ({ useAviso: () => vi.fn() }))

const UUID = 'aa11bb22-cc33-dd44-ee55-ff6677889900'

const pregunta = (id: number, respuestaTexto: string | null = null) => ({
  id,
  posicion: id - 100,
  tipo: 'ABIERTA',
  enunciado: `¿Cuántas cajas has tenido a cargo? (${id})`,
  // Las del cuestionario técnico no tienen situación: son preguntas directas sobre lo que
  // esa persona ha hecho, no un caso planteado.
  situacion: null,
  respuestaTexto,
  respuestaOpcionId: null,
  respuestaDetalle: null,
  opciones: [],
})

const examen = (parte: Partial<EvaluacionCandidato> = {}): EvaluacionCandidato =>
  ({
    id: 5,
    estado: 'EN_CURSO',
    venceEn: null,
    iniciadaEn: '2026-08-29T10:00:00Z',
    terminadaEn: null,
    minutosObjetivo: 45,
    total: 2,
    respondidas: 0,
    preguntas: [pregunta(101), pregunta(102)],
    ...parte,
  }) as EvaluacionCandidato

function pintar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={[`/procesos/${UUID}/prueba-tecnica`]}>
        <Routes>
          <Route path="/procesos/:uuid/prueba-tecnica" element={<CuestionarioTecnico />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const loQueSeLee = () => document.body.textContent ?? ''

beforeEach(() => {
  // La cola apunta lo pendiente en `localStorage` con una clave sacada del uuid, que aqui es
  // el mismo siempre: sin limpiarlo, lo que una prueba deja a medias lo reenvia la siguiente.
  window.localStorage.clear()
  ver.mockReset()
  iniciar.mockReset()
  responder.mockReset()
  entregar.mockReset()
  ver.mockResolvedValue(examen())
  iniciar.mockResolvedValue(examen())
  responder.mockResolvedValue(undefined)
  entregar.mockResolvedValue({ estado: 'TERMINADA', respondidas: 2, total: 2 })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('antes de empezar', () => {
  it('dice cuántas preguntas son, el tiempo, y que no hay nada que subir', async () => {
    ver.mockResolvedValue(examen({ iniciadaEn: null, estado: 'PENDIENTE' }))
    pintar()

    expect(await screen.findByText(/Son 2 preguntas/)).toBeTruthy()
    expect(loQueSeLee()).toMatch(/no hay que subir ningún archivo/i)
    expect(loQueSeLee()).toMatch(/45 minutos/)
    // Y el reloj no corre todavía: empieza cuando abra.
    expect(loQueSeLee()).toMatch(/desde que empieces/i)
  })

  it('sin minutos fijados no promete un tiempo que no existe', async () => {
    ver.mockResolvedValue(examen({ iniciadaEn: null, estado: 'PENDIENTE', minutosObjetivo: null }))
    pintar()

    await screen.findByText(/Son 2 preguntas/)
    expect(loQueSeLee()).not.toMatch(/minutos/)
  })

  it('empezar abre el examen', async () => {
    ver.mockResolvedValue(examen({ iniciadaEn: null, estado: 'PENDIENTE' }))
    pintar()

    fireEvent.click(await screen.findByRole('button', { name: /empezar la prueba/i }))

    await waitFor(() => expect(iniciar).toHaveBeenCalledWith(UUID))
  })
})

describe('respondiendo', () => {
  it('lo escrito no se da por guardado hasta que el servidor lo confirma', async () => {
    vi.useFakeTimers()
    let soltar: () => void = () => {}
    responder.mockImplementation(
      () => new Promise<void>((r) => { soltar = r }),
    )
    pintar()
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })

    fireEvent.change(screen.getByRole('textbox', { name: /tu respuesta/i }), {
      target: { value: 'Tres cajas de 40 mil soles al día' },
    })
    // Se guarda cuando deja de escribir, no en cada tecla.
    expect(responder).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(900) })
    expect(responder).toHaveBeenCalledTimes(1)

    // Viajando: se dice bajo el recuadro, y no se afirma que esté guardada.
    expect(loQueSeLee()).toMatch(/guardando lo que escribiste/i)
    // ⚠️ Y **no** hay ningún cartel de «quedan N sin guardar»: es una avería nuestra contada
    // a quien está en mitad de su prueba y no puede hacer nada con ella.
    expect(loQueSeLee()).not.toMatch(/sin guardar/i)

    soltar()
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
  })

  it('una pregunta en blanco está sin responder, no guardada', async () => {
    pintar()

    await screen.findByRole('textbox', { name: /tu respuesta/i })
    expect(loQueSeLee()).toMatch(/todavía sin responder/i)
    expect(loQueSeLee()).not.toMatch(/guardada/i)
  })

  it('lo que el servidor ya tiene se dice guardado, y se puede corregir', async () => {
    ver.mockResolvedValue(
      examen({ respondidas: 1, preguntas: [pregunta(101, 'Tres cajas'), pregunta(102)] }),
    )
    pintar()

    await screen.findByDisplayValue('Tres cajas')
    expect(loQueSeLee()).toMatch(/guardada/i)
    expect(loQueSeLee()).toMatch(/hasta que entregues/i)
  })

  it('lo que no llegó se reintenta solo', async () => {
    vi.useFakeTimers()
    responder.mockRejectedValue(new Error('se cayó la red'))
    pintar()
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })

    fireEvent.change(screen.getByRole('textbox', { name: /tu respuesta/i }), {
      target: { value: 'lo que sea' },
    })
    await act(async () => { await vi.advanceTimersByTimeAsync(900) })
    expect(responder).toHaveBeenCalledTimes(1)
    // No se le enseña el fallo: no puede hacer nada con él y la cola ya se está ocupando.
    expect(screen.queryByRole('alert')).toBeNull()

    // Sigue intentándolo sin que nadie pulse nada: un fallo de un momento no puede
    // costarle una respuesta a nadie. La primera espera es de un segundo.
    await act(async () => { await vi.advanceTimersByTimeAsync(1100) })
    expect(responder).toHaveBeenCalledTimes(2)

    // Y las siguientes se van separando: al segundo no vuelve a intentarlo, a los dos sí.
    await act(async () => { await vi.advanceTimersByTimeAsync(1100) })
    expect(responder).toHaveBeenCalledTimes(2)
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(responder).toHaveBeenCalledTimes(3)
  })

  it('lo escrito justo antes de cambiar de pregunta no se pierde', async () => {
    // ⚠️ El fallo que motivó la reescritura: encolar desde un efecto dejaba un hueco entre
    // la última tecla y el envío, y en ese hueco cabía un clic en «Siguiente». Aquí no se
    // deja pasar ni un tick entre las dos cosas.
    pintar()
    await screen.findByRole('textbox', { name: /tu respuesta/i })

    fireEvent.change(screen.getByRole('textbox', { name: /tu respuesta/i }), {
      target: { value: 'Tres cajas de 40 mil soles al día' },
    })
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))

    await waitFor(() =>
      expect(responder).toHaveBeenCalledWith(
        UUID,
        101,
        expect.objectContaining({ texto: 'Tres cajas de 40 mil soles al día' }),
      ),
    )
  })

  it('lo que quedó sin mandar al cerrar la pestaña se manda al volver', async () => {
    // Cerrar el portátil con algo sin confirmar costaba esa respuesta. Ahora queda apuntado
    // en el navegador y sale hacia el servidor en cuanto se vuelve a abrir la prueba.
    responder.mockRejectedValueOnce(new Error('se cayó la red'))
    const { unmount } = pintar()
    await screen.findByRole('textbox', { name: /tu respuesta/i })

    fireEvent.change(screen.getByRole('textbox', { name: /tu respuesta/i }), {
      target: { value: 'Lo que escribí antes de que se cortara' },
    })
    await waitFor(() => expect(responder).toHaveBeenCalledTimes(1))
    unmount()

    responder.mockReset()
    responder.mockResolvedValue(undefined)
    pintar()

    await waitFor(() =>
      expect(responder).toHaveBeenCalledWith(
        UUID,
        101,
        expect.objectContaining({ texto: 'Lo que escribí antes de que se cortara' }),
      ),
    )
  })
})

describe('entregar', () => {
  it('no se entrega a medias, y se dice cuántas faltan', async () => {
    pintar()

    const boton = await screen.findByRole('button', { name: 'Entregar' })
    expect((boton as HTMLButtonElement).disabled).toBe(true)
    expect(loQueSeLee()).toMatch(/faltan 2 preguntas por responder/i)
  })

  it('con todo respondido se entrega, preguntando antes', async () => {
    ver.mockResolvedValue(
      examen({
        respondidas: 2,
        preguntas: [pregunta(101, 'una'), pregunta(102, 'otra')],
      }),
    )
    pintar()

    fireEvent.click(await screen.findByRole('button', { name: 'Entregar' }))
    expect(screen.getByRole('dialog').textContent).toMatch(/ya no se puede cambiar nada/i)

    fireEvent.click(screen.getByRole('button', { name: 'Sí, entregar' }))
    await waitFor(() => expect(entregar).toHaveBeenCalledWith(UUID))
  })

  it('ya entregado no se puede tocar', async () => {
    ver.mockResolvedValue(examen({ estado: 'TERMINADA', terminadaEn: '2026-08-29T11:00:00Z' }))
    pintar()

    expect(await screen.findByText(/ya entregaste tu prueba técnica/i)).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Entregar' })).toBeNull()
  })
})
