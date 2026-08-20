/**
 * Las respuestas de la evaluacion no se pierden.
 *
 * Esta pantalla ya costo dos fallos en produccion, los dos silenciosos:
 *
 *   1. Cambiar de pregunta cancelaba el guardado con retardo, asi que quien
 *      escribia y pulsaba «Siguiente» rapido perdia la respuesta.
 *   2. Lo pendiente se borraba al enviarlo, no al confirmarlo, asi que un
 *      guardado que fallaba se perdia igual —y el aviso desaparecia solo al
 *      pasar de pregunta. El candidato llegaba al final con «16 de 20».
 *
 * Las dos cosas se comprueban aqui, porque las dos veces el codigo compilaba
 * perfectamente.
 */

import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'
import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { EvaluacionCandidato } from '@/api/tipos'
import { ProveedorAvisos } from '@/ui/Avisos'
import { Evaluacion } from './Evaluacion'

// ---------- El servidor de mentira ----------

const TOTAL = 4

/** Lo que el servidor tiene guardado de verdad. */
let guardadas: Map<number, string>
/** Las opciones que el servidor tiene guardadas. */
let opcionesGuardadas: Map<number, number>
/** La pregunta 2 es de opcion multiple, como las que no se dejaban marcar. */
const CON_OPCIONES = 2
/** Preguntas cuyo primer intento de guardado se cae. */
let fallanUnaVez: Set<number>
/** Preguntas que no hay manera de guardar, como una red que no vuelve. */
let fallanSiempre: Set<number>

function evaluacionActual(iniciada: boolean): EvaluacionCandidato {
  return {
    id: 1,
    estado: iniciada ? 'EN_CURSO' : 'PENDIENTE',
    venceEn: null,
    iniciadaEn: iniciada ? '2026-08-20T10:00:00Z' : null,
    terminadaEn: null,
    minutosObjetivo: 45,
    total: TOTAL,
    respondidas: guardadas.size,
    preguntas: Array.from({ length: TOTAL }, (_, i) => ({
      id: i + 1,
      posicion: i + 1,
      tipo: 'ABIERTA',
      enunciado: `Pregunta ${i + 1}`,
      situacion: null,
      opciones:
        i + 1 === CON_OPCIONES
          ? [
              { id: 21, letra: 'a', texto: 'Preguntar antes de empezar' },
              { id: 22, letra: 'b', texto: 'Empezar por lo que sí entiendo' },
            ]
          : null,
      respuestaTexto: guardadas.get(i + 1) ?? null,
      respuestaOpcionId: opcionesGuardadas.get(i + 1) ?? null,
    })),
  }
}

let iniciada = false

vi.mock('@/api/evaluacion', () => ({
  verEvaluacion: vi.fn(async () => evaluacionActual(iniciada)),
  iniciarEvaluacion: vi.fn(async () => {
    iniciada = true
    return evaluacionActual(true)
  }),
  responderEvaluacion: vi.fn(async (_uuid: string, preguntaId: number, cuerpo: { texto?: string; opcionId?: number }) => {
    if (fallanSiempre.has(preguntaId) || fallanUnaVez.has(preguntaId)) {
      fallanUnaVez.delete(preguntaId)
      throw new Error('El sistema tuvo un problema. Inténtalo de nuevo en un momento.')
    }
    if (cuerpo.texto !== undefined) guardadas.set(preguntaId, cuerpo.texto)
    if (cuerpo.opcionId !== undefined) opcionesGuardadas.set(preguntaId, cuerpo.opcionId)
  }),
  entregarEvaluacion: vi.fn(async () => ({ estado: 'ENTREGADA', respondidas: guardadas.size, total: TOTAL })),
}))

// ---------- Montaje ----------

function montar() {
  const datos = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={datos}>
      <ProveedorAvisos>
        <MemoryRouter initialEntries={['/procesos/x1/evaluacion']}>
          <Routes>
            <Route path="/procesos/:uuid/evaluacion" element={<Evaluacion />} />
          </Routes>
        </MemoryRouter>
      </ProveedorAvisos>
    </QueryClientProvider>,
  )
}

async function empezar() {
  montar()
  fireEvent.click(await screen.findByRole('button', { name: /Empezar evaluación/ }))
  await screen.findByLabelText('Tu respuesta')
}

function responder(texto: string) {
  fireEvent.change(screen.getByLabelText('Tu respuesta'), { target: { value: texto } })
}

const siguiente = () => fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

// Sin `globals`, la libreria no limpia sola entre pruebas y los arboles se
// van apilando: la segunda prueba encontraria dos de cada cosa.
afterEach(cleanup)

beforeEach(() => {
  guardadas = new Map()
  opcionesGuardadas = new Map()
  fallanUnaVez = new Set()
  fallanSiempre = new Set()
  iniciada = false
  vi.clearAllMocks()
})

// ---------- Las pruebas ----------

describe('la evaluacion no pierde respuestas', () => {
  it('manda lo escrito al cambiar de pregunta, sin esperar al temporizador', async () => {
    await empezar()

    // Escribir y pulsar «Siguiente» de inmediato: el caso que fallaba.
    responder('Primera respuesta.')
    siguiente()

    await waitFor(() => expect(guardadas.get(1)).toBe('Primera respuesta.'))
  })

  it('no da por guardado lo que el servidor rechazo, y lo reintenta', async () => {
    fallanUnaVez.add(1)
    await empezar()

    responder('Primera respuesta.')
    siguiente()

    // El guardado se cayo: la pantalla lo dice en vez de seguir como si nada.
    expect(await screen.findByText(/Hay 1 respuesta sin guardar/)).toBeTruthy()
    expect(guardadas.has(1)).toBe(false)

    fireEvent.click(screen.getAllByRole('button', { name: /Reintentar ahora/ })[0]!)

    await waitFor(() => expect(guardadas.get(1)).toBe('Primera respuesta.'))
    await waitFor(() => expect(screen.queryByText(/sin guardar/)).toBeNull())
  })

  it('el aviso sobrevive al cambio de pregunta', async () => {
    // Que no llegue nunca: si solo fallara una vez, el reintento del cambio de
    // pregunta la salvaria y no habria aviso que comprobar.
    fallanSiempre.add(1)
    await empezar()

    responder('Primera respuesta.')
    siguiente()
    await screen.findByText(/Hay 1 respuesta sin guardar/)

    // Antes el error se limpiaba al pasar de pregunta y no quedaba ni rastro.
    siguiente() // la 2 es de opciones: se salta
    responder('Tercera respuesta.')
    siguiente()

    await waitFor(() => expect(guardadas.get(3)).toBe('Tercera respuesta.'))
    expect(screen.getByText(/sin guardar/)).toBeTruthy()
    expect(guardadas.has(1)).toBe(false)
  })

  it('no deja entregar mientras una respuesta no haya llegado', async () => {
    fallanSiempre.add(1)
    await empezar()

    responder('Primera respuesta.')
    siguiente()
    await screen.findByText(/Hay 1 respuesta sin guardar/)

    // Hasta la ultima pregunta, donde aparece el boton de entregar.
    siguiente()
    siguiente()
    fireEvent.click(screen.getByRole('button', { name: /Entregar evaluación/ }))

    const entregar = await screen.findByRole('button', { name: 'Entregar' })
    expect((entregar as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/aún no ha llegado al servidor/)).toBeTruthy()
  })

  it('la opción marcada se ve marcada aunque el servidor la rechace', async () => {
    fallanSiempre.add(CON_OPCIONES)
    await empezar()
    siguiente()

    const opcion = await screen.findByRole('radio', { name: /Preguntar antes de empezar/ })
    fireEvent.click(opcion)

    // Antes el radio salia del servidor: si el guardado se caia, no se marcaba
    // y parecia que la pregunta no dejaba elegir.
    await waitFor(() => expect((opcion as HTMLInputElement).checked).toBe(true))
    expect(await screen.findByText(/sin guardar/)).toBeTruthy()
  })

  it('el indicador no dice «guardada» en una pregunta en blanco', async () => {
    await empezar()
    expect(screen.getByText('Sin responder')).toBeTruthy()

    responder('Algo escrito.')
    await waitFor(() => expect(screen.getByText('Respuesta guardada')).toBeTruthy())
  })
})
