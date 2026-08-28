/**
 * La ficha del puesto: lo que compila perfectamente estando mal.
 *
 *   1. **Mandar solo lo que cambio.** El PUT es un reemplazo completo: un campo
 *      que no viaje se borra en el servidor. Se cuentan los 22.
 *   2. **Decir «guardada» por decreto.** Solo se dice comparando con lo ultimo
 *      que el servidor confirmo; mientras difiera, «hay cambios sin guardar».
 *   3. **Dejar escribir el riesgo 2 sin el 1.** El orden es la velocidad de
 *      daño y el backend rechaza los huecos con un 400; mejor apagar la casilla.
 *   4. **Contar un 403 como averia.** Es el reparto de permisos funcionando: se
 *      retira el boton y se dice cual falta.
 *   5. **Calcular el tamaño aqui.** Lo deriva el servidor y llega en la
 *      respuesta; el panel solo lo enseña y ofrece los pesos que sugiere.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ErrorApi } from '../../api/cliente'
import type { FichaDelPuesto as Ficha, GuardarFichaDelPuesto } from '../../api/tipos'
import { FichaDelPuesto } from './FichaDelPuesto'

const guardar = vi.fn()
const asignarPesos = vi.fn()

vi.mock('../../api/panel', () => ({
  guardarFichaDelPuesto: (id: number, datos: GuardarFichaDelPuesto) => guardar(id, datos),
  asignarVersionPesos: (id: number, pesos: number) => asignarPesos(id, pesos),
}))

const NULOS: GuardarFichaDelPuesto = {
  q1Resultado: null,
  q2Riesgo: null,
  q3DiaReal: null,
  q4EpocaDorada: null,
  q5Estructura: null,
  q6Autonomia: null,
  q7JefeDirecto: null,
  q8LoIncomodo: null,
  q9Requerimientos: null,
  q10Espejo: null,
  genteEnEmpresa: null,
  genteACargo: null,
  riesgo1: null,
  riesgo2: null,
  riesgo3: null,
  riesgo4: null,
  eliminatoria1: null,
  eliminatoria2: null,
  requerimiento1: null,
  requerimiento2: null,
  requerimiento3: null,
  familias: null,
}

const ficha = (parte: Partial<Ficha> = {}): Ficha => ({
  id: 3,
  vacanteId: 7,
  ...NULOS,
  tamano: null,
  estado: 'BORRADOR',
  actualizadoEn: '2026-08-28T10:00:00Z',
  pesosSugeridos: null,
  ...parte,
})

function pintar(laFicha: Ficha | null = null) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={cliente}>
      <FichaDelPuesto vacanteId={7} ficha={laFicha} />
    </QueryClientProvider>,
  )
  return cliente
}

const escribir = (etiqueta: RegExp | string, texto: string) =>
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: texto } })
const guardarLaFicha = () => fireEvent.click(screen.getByRole('button', { name: 'Guardar la ficha' }))

beforeEach(() => {
  guardar.mockReset()
  asignarPesos.mockReset()
  guardar.mockImplementation((_id: number, datos: GuardarFichaDelPuesto) =>
    Promise.resolve(ficha({ ...datos, estado: 'BORRADOR' })),
  )
  asignarPesos.mockResolvedValue(undefined)
})

afterEach(() => cleanup())

describe('la ficha del puesto', () => {
  it('sin ficha se pinta vacía, dice que está sin empezar y qué le falta', () => {
    pintar(null)
    expect(screen.getByText('Sin empezar')).toBeTruthy()
    expect(screen.getByText(/para que quede completa falta:/i).textContent).toMatch(
      /la pregunta 1.*los cuatro riesgos.*al menos una familia/,
    )
    expect(screen.queryByText(/hay cambios sin guardar/i)).toBeNull()
  })

  it('al guardar viajan los 22 campos, aunque solo se haya escrito uno', async () => {
    pintar(null)
    escribir(/Q1 · Resultado/, 'Que la caja cuadre todos los días')
    guardarLaFicha()

    await waitFor(() => expect(guardar).toHaveBeenCalledTimes(1))
    const [id, datos] = guardar.mock.calls[0] as [number, GuardarFichaDelPuesto]
    expect(id).toBe(7)
    expect(Object.keys(datos)).toHaveLength(22)
    expect(datos.q1Resultado).toBe('Que la caja cuadre todos los días')
    expect(datos.q2Riesgo).toBeNull()
    expect(datos.genteEnEmpresa).toBeNull()
    expect(datos.familias).toBeNull()
  })

  it('las familias marcadas viajan como la cadena del backend, en orden', async () => {
    pintar(null)
    fireEvent.click(screen.getByLabelText(/F4 Administración/))
    fireEvent.click(screen.getByLabelText(/F1 Mando/))
    escribir('Cuánta gente hay en la empresa', '120')
    guardarLaFicha()

    await waitFor(() => expect(guardar).toHaveBeenCalledTimes(1))
    const datos = guardar.mock.calls[0]![1] as GuardarFichaDelPuesto
    expect(datos.familias).toBe('F1,F4')
    expect(datos.genteEnEmpresa).toBe(120)
  })

  it('el riesgo 2 está apagado hasta que el 1 tenga texto', () => {
    pintar(null)
    const riesgo2 = screen.getByLabelText('Riesgo 2') as HTMLInputElement
    expect(riesgo2.disabled).toBe(true)
    escribir(/Riesgo 1/, 'Faltantes de caja')
    expect(riesgo2.disabled).toBe(false)
    expect((screen.getByLabelText('Riesgo 3') as HTMLInputElement).disabled).toBe(true)
  })

  it('«sin guardar» sale de comparar con el servidor, y «guardada» también', async () => {
    pintar(ficha({ q1Resultado: 'Lo de antes' }))
    expect(screen.queryByText(/hay cambios sin guardar/i)).toBeNull()

    escribir(/Q1 · Resultado/, 'Lo de ahora')
    expect(screen.getByText(/hay cambios sin guardar/i)).toBeTruthy()

    guardarLaFicha()
    await screen.findByText('Guardada.')
    expect(screen.queryByText(/hay cambios sin guardar/i)).toBeNull()
  })

  it('el chip dice COMPLETA cuando lo dice el servidor, no el panel', async () => {
    guardar.mockResolvedValue(ficha({ estado: 'COMPLETA', tamano: 'MICRO' }))
    pintar(null)
    expect(screen.getByText('Sin empezar')).toBeTruthy()
    guardarLaFicha()
    expect(await screen.findByText('Completa')).toBeTruthy()
    expect(screen.getByText(/el puesto es/i).textContent).toMatch(/MICRO/)
  })

  it('un 400 se lee tal cual, en un aviso', async () => {
    guardar.mockRejectedValue(new ErrorApi(400, 'No puede haber riesgo 3 sin riesgo 2'))
    pintar(null)
    guardarLaFicha()
    const aviso = await screen.findByRole('alert')
    expect(aviso.textContent).toMatch(/riesgo 3 sin riesgo 2/)
    // El boton sigue: se corrige y se vuelve a guardar.
    expect(screen.getByRole('button', { name: 'Guardar la ficha' })).toBeTruthy()
  })

  it('un 403 retira guardar y nombra el permiso, sin pintarlo como avería', async () => {
    guardar.mockRejectedValue(new ErrorApi(403, 'No encontramos eso, o no es tuyo.'))
    pintar(null)
    guardarLaFicha()
    const aviso = await screen.findByRole('status', { name: '' })
    expect(aviso.textContent).toMatch(/editar_vacante/)
    expect(screen.queryByRole('button', { name: 'Guardar la ficha' })).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  describe('el tamaño y los pesos que sugiere el servidor', () => {
    it('ofrece usar los pesos sugeridos y llama al mismo endpoint que la vacante', async () => {
      pintar(
        ficha({
          genteEnEmpresa: 80,
          tamano: 'MEDIA',
          pesosSugeridos: { id: 15, etiqueta: 'CAZATALENTOS · MEDIA/GRANDE', yaAsignada: false },
        }),
      )
      expect(screen.getByText(/el puesto es/i).textContent).toMatch(/MEDIA/)
      fireEvent.click(screen.getByRole('button', { name: 'Usar estos pesos' }))
      await waitFor(() => expect(asignarPesos).toHaveBeenCalledWith(7, 15))
    })

    it('si ya están asignados lo dice y no ofrece el botón', () => {
      pintar(
        ficha({
          genteEnEmpresa: 20,
          tamano: 'MICRO',
          pesosSugeridos: { id: 14, etiqueta: 'CAZATALENTOS · MICRO', yaAsignada: true },
        }),
      )
      expect(screen.getByText(/ya rigen los pesos/i)).toBeTruthy()
      expect(screen.queryByRole('button', { name: 'Usar estos pesos' })).toBeNull()
    })

    it('sin cifra guardada no inventa un tamaño', () => {
      pintar(ficha())
      expect(screen.queryByText(/el puesto es/i)).toBeNull()
    })
  })
})

/*
 * ⚠️ Lo que reprodujo el QA: los campos no se apagan mientras el PUT viaja, y
 * alinear el borrador con la respuesta a ciegas borraba lo tecleado en ese
 * medio segundo sin decir nada.
 */
describe('mientras el PUT viaja', () => {
  it('lo que se teclea no se pisa con la respuesta, y queda como sin guardar', async () => {
    let resolver: (f: Ficha) => void = () => {}
    guardar.mockImplementation(
      (_id: number, datos: GuardarFichaDelPuesto) =>
        new Promise<Ficha>((r) => {
          resolver = (f) => r({ ...f, ...datos, estado: 'BORRADOR' })
        }),
    )
    pintar(null)
    escribir(/Q1 · Resultado/, 'Que la caja cuadre')
    guardarLaFicha()
    await waitFor(() => expect(guardar).toHaveBeenCalledTimes(1))

    // Sigue escribiendo con el PUT en vuelo.
    escribir(/Q1 · Resultado/, 'Que la caja cuadre todos los días')
    resolver(ficha())

    await screen.findByText(/hay cambios sin guardar/i)
    expect((screen.getByLabelText(/Q1 · Resultado/) as HTMLTextAreaElement).value).toBe(
      'Que la caja cuadre todos los días',
    )
    expect(screen.queryByText('Guardada.')).toBeNull()
  })

  it('si nadie escribió, el borrador se alinea con lo confirmado y dice guardada', async () => {
    pintar(null)
    escribir(/Q1 · Resultado/, '  Que la caja cuadre  ')
    guardarLaFicha()
    await screen.findByText('Guardada.')
    expect((screen.getByLabelText(/Q1 · Resultado/) as HTMLTextAreaElement).value).toBe(
      'Que la caja cuadre',
    )
  })
})
