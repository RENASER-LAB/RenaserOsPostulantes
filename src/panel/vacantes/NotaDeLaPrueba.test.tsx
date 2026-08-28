/**
 * El paso que faltaba, y las tres razones de un guion.
 *
 * Lo que compila perfectamente estando mal aqui:
 *
 *   1. **Ofrecer «calcular» cuando faltan criterios.** El backend contesta 409
 *      nombrandolos uno a uno; ofrecer el boton igual convierte una lista de lo
 *      que falta en un error rojo por pulsar.
 *   2. **Contar un cero como «sin nota».** `0` es una nota: la postulacion 16 de
 *      la base local tiene sus siete criterios en 0.0 y su nota de etapa es
 *      0.00. Un `!n.puntaje` la contaria como si faltara y esconderia el boton
 *      justo en la fila que lo necesita.
 *   3. **Resumir el 409.** Nombra los criterios que faltan: es la lista exacta
 *      de lo que hay que calificar, y es lo unico accionable del mensaje.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ErrorApi } from '../api/cliente'
import { NotaDeLaPrueba } from './NotaDeLaPrueba'
import type { NotaCriterioEtapa } from '../api/tipos'

const criterio = (criterioId: number, puntaje: number | null): NotaCriterioEtapa => ({
  criterioId,
  nombre: `Criterio ${criterioId}`,
  puntosMaximos: 15,
  puntaje,
  explicacion: null,
  /* ⚠️ Los dos valores del backend son AGENTE y PERSONA, nunca «IA». */
  origen: puntaje === null ? null : 'AGENTE',
})

const verNotas = vi.fn()
const calcular = vi.fn()

vi.mock('../api/panel', () => ({
  verNotasPrueba: (id: number) => verNotas(id),
  calcularNotaDePrueba: (id: number) => calcular(id),
}))

function montar(notaEnElRanking: number | null = null) {
  const datos = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={datos}>
      <NotaDeLaPrueba
        postulacionId={16}
        notaEnElRanking={notaEnElRanking}
        alCalcular={() => {}}
      />
    </QueryClientProvider>,
  )
}

const TODOS = [criterio(1, 3), criterio(2, 5), criterio(3, 1)]
const A_MEDIAS = [criterio(1, 3), criterio(2, null), criterio(3, null)]
const NINGUNO = [criterio(1, null), criterio(2, null), criterio(3, null)]

beforeEach(() => {
  verNotas.mockReset()
  calcular.mockReset()
  calcular.mockResolvedValue({ nota: 9 })
})

afterEach(cleanup)

describe('la rúbrica está entera y no hay nota', () => {
  /* El caso que provocó todo: «están calificados y no se ve su nota». */
  it('ofrece calcularla y explica por qué faltaba', async () => {
    verNotas.mockResolvedValue(TODOS)
    montar(null)
    expect(await screen.findByRole('button', { name: 'Calcular la nota de la prueba' })).toBeTruthy()
    expect(screen.getByText(/todavía no tiene nota de la prueba/)).toBeTruthy()
    expect(screen.getByText(/se calcula ponderándolas/)).toBeTruthy()
  })

  it('al calcularla dice la nota que salió', async () => {
    verNotas.mockResolvedValue(TODOS)
    montar(null)
    fireEvent.click(await screen.findByRole('button', { name: 'Calcular la nota de la prueba' }))
    expect(await screen.findByText(/Calculada: 9/)).toBeTruthy()
    expect(calcular).toHaveBeenCalledWith(16)
  })

  it('un cero en todos los criterios sigue siendo la rúbrica entera', async () => {
    // La postulación 16 de la base local: siete criterios en 0.0 y nota 0.00.
    // Un `!puntaje` los contaría como vacíos y escondería el botón.
    verNotas.mockResolvedValue([criterio(1, 0), criterio(2, 0), criterio(3, 0)])
    montar(null)
    expect(await screen.findByRole('button', { name: 'Calcular la nota de la prueba' })).toBeTruthy()
  })
})

describe('faltan criterios por calificar', () => {
  it('no ofrece calcular: el backend lo rechazaría', async () => {
    verNotas.mockResolvedValue(A_MEDIAS)
    montar(null)
    expect(await screen.findByText(/Le faltan 2 de 3 criterios/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Calcular la nota de la prueba' })).toBeNull()
  })

  it('sin ninguna nota manda a pedirle la calificación a la IA', async () => {
    verNotas.mockResolvedValue(NINGUNO)
    montar(null)
    expect(await screen.findByText(/Ninguno de sus criterios tiene nota/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Calcular la nota de la prueba' })).toBeNull()
  })
})

describe('ya tiene nota', () => {
  it('la enseña en vez de ofrecer calcularla otra vez como si faltara', async () => {
    verNotas.mockResolvedValue(TODOS)
    montar(14)
    expect(await screen.findByText(/Ya está calculada/)).toBeTruthy()
    expect(screen.getByText('14')).toBeTruthy()
  })

  it('un cero es una nota, no la ausencia de una', async () => {
    verNotas.mockResolvedValue(TODOS)
    montar(0)
    expect(await screen.findByText(/Ya está calculada/)).toBeTruthy()
    expect(screen.queryByText(/todavía no tiene nota/)).toBeNull()
  })
})

describe('lo que contesta el backend', () => {
  it('el 409 se enseña entero, con los criterios que nombra', async () => {
    calcular.mockRejectedValue(
      new ErrorApi(
        409,
        'Todavía faltan notas por poner: Manejo y control de caja, Gestión de personal',
        null,
      ),
    )
    verNotas.mockResolvedValue(TODOS)
    montar(null)
    fireEvent.click(await screen.findByRole('button', { name: 'Calcular la nota de la prueba' }))
    const dicho = await screen.findByRole('alert')
    expect(dicho.textContent).toContain('Manejo y control de caja')
    expect(dicho.textContent).toContain('Gestión de personal')
  })

  it('un 403 nombra el permiso en vez de enseñar «Forbidden»', async () => {
    calcular.mockRejectedValue(new ErrorApi(403, 'Forbidden', null))
    verNotas.mockResolvedValue(TODOS)
    montar(null)
    fireEvent.click(await screen.findByRole('button', { name: 'Calcular la nota de la prueba' }))
    await waitFor(() => expect(screen.getByText(/permiso «ajustar_nota»/)).toBeTruthy())
    expect(screen.queryByText(/Forbidden/)).toBeNull()
  })
})

describe('cuándo no se pinta nada', () => {
  it('sin rúbrica no hay nada que ponderar, y no es un fallo', async () => {
    verNotas.mockResolvedValue([])
    const { container } = montar(null)
    await waitFor(() => expect(verNotas).toHaveBeenCalled())
    expect(container.querySelector('section')).toBeNull()
  })
})
