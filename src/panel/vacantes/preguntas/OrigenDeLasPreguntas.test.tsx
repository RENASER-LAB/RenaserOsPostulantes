/**
 * «Qué responderá quien postule» (V66): las propias van primero y son con las
 * que nace toda vacante nueva; el banco del nivel solo se ofrece si es propio, y
 * el prestado de RENASER se llama por su nombre.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { VacantePanel } from '../../api/tipos'
import { OrigenDeLasPreguntas } from './OrigenDeLasPreguntas'

const elegir = vi.fn()
vi.mock('../../api/preguntasPropias', async (original) => ({
  ...(await original<typeof import('../../api/preguntasPropias')>()),
  elegirOrigenDePreguntas: (id: number, origen: string) => elegir(id, origen),
  verPreguntasPropias: () =>
    Promise.resolve({ resumen: { estado: 'BORRADOR', puntos: 68, criterios: 2, preguntas: 5 } }),
}))

const vacante = (parte: Partial<VacantePanel>) => ({ id: 40, aplicaEvaluacion: true, ...parte }) as VacantePanel

function pintar(v: VacantePanel, alFallar: (causa: unknown) => void = vi.fn()) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <OrigenDeLasPreguntas vacante={v} alCambiar={vi.fn()} alFallar={alFallar} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** Una respuesta del servidor que llega cuando la prueba quiera. */
function enVuelo() {
  let soltar!: () => void
  let fallar!: (causa: unknown) => void
  const promesa = new Promise<void>((resolver, rechazar) => {
    soltar = resolver
    fallar = rechazar
  })
  return { promesa, soltar, fallar }
}

/** Los nombres accesibles de los radios, en el orden en que se leen. */
const nombres = () => screen.getAllByRole('radio').map((r) => document.getElementById(r.getAttribute('aria-labelledby')!)!.textContent)

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

describe('las opciones', () => {
  it('sin banco propio: «Preguntas propias» (marcada) y «Sin evaluación», y ningún banco (AC-01)', async () => {
    const { container } = pintar(vacante({ origenPreguntas: 'VACANTE', bancoDelNivelPropio: false, bancoPrestado: false }))
    expect(screen.getByRole('radio', { name: 'Preguntas propias de esta vacante' })).toHaveProperty('checked', true)
    expect(screen.getByRole('radio', { name: 'Sin evaluación' })).toBeTruthy()
    expect(screen.queryByRole('radio', { name: /banco/ })).toBeNull()
    // Con preguntas propias, su estado y el enlace al editor
    expect(await screen.findByText(/Borrador · 68 de 100 puntos/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Escribir las preguntas →' }).getAttribute('href')).toBe(
      '/admin/vacantes/40/preguntas',
    )
    // Ni las ayudas nombran un banco que la empresa no tiene
    expect(container.textContent).not.toMatch(/banco/i)
  })

  it('con banco propio, la vacante nueva viene con las propias marcadas y ofrece las tres, propias primero (AC-01b)', () => {
    pintar(vacante({ origenPreguntas: 'VACANTE', bancoDelNivelPropio: true, bancoPrestado: false }))
    expect(nombres()).toEqual([
      'Preguntas propias de esta vacante',
      'El banco de la empresa para su nivel',
      'Sin evaluación',
    ])
    expect(screen.getByRole('radio', { name: 'Preguntas propias de esta vacante' })).toHaveProperty('checked', true)
    expect(screen.getByRole('radio', { name: 'El banco de la empresa para su nivel' })).toHaveProperty('checked', false)
  })

  it('con banco propio elegido, se ofrecen las tres y el banco dice que es de la empresa (AC-01b)', () => {
    pintar(vacante({ origenPreguntas: 'NIVEL', bancoDelNivelPropio: true, bancoPrestado: false }))
    expect(screen.getByRole('radio', { name: 'El banco de la empresa para su nivel' })).toHaveProperty('checked', true)
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    // Con el banco, el estado de las propias y su botón no se pintan
    expect(screen.queryByRole('link', { name: 'Escribir las preguntas →' })).toBeNull()
  })

  it('la que rinde el banco prestado lo llama por su nombre y avisa de que no vuelve (AC-01c)', () => {
    pintar(vacante({ origenPreguntas: 'NIVEL', bancoDelNivelPropio: false, bancoPrestado: true }))
    expect(nombres()).toEqual(['Preguntas propias de esta vacante', 'El banco de RENASER para su nivel', 'Sin evaluación'])
    expect(screen.getByRole('radio', { name: 'El banco de RENASER para su nivel' })).toHaveProperty('checked', true)
    expect(screen.getByText(/no se puede volver a elegir/)).toBeTruthy()
  })

  it('elegir otra opción la manda al servidor', async () => {
    elegir.mockResolvedValue(undefined)
    pintar(vacante({ origenPreguntas: 'NIVEL', bancoDelNivelPropio: true }))
    fireEvent.click(screen.getByRole('radio', { name: 'Sin evaluación' }))
    await waitFor(() => expect(elegir).toHaveBeenCalledWith(40, 'SIN_EVALUACION'))
  })

  it('pulsar la ayuda también elige: la pastilla entera es la opción', async () => {
    elegir.mockResolvedValue(undefined)
    pintar(vacante({ origenPreguntas: 'VACANTE', bancoDelNivelPropio: true }))
    fireEvent.click(screen.getByText(/Las mismas para todas las vacantes de este nivel/))
    await waitFor(() => expect(elegir).toHaveBeenCalledWith(40, 'NIVEL'))
  })
})

describe('cómo se lee', () => {
  it('el nombre del radio es solo su nombre, y la ayuda va como descripción', () => {
    pintar(vacante({ origenPreguntas: 'VACANTE', bancoDelNivelPropio: true }))
    const sin = screen.getByRole('radio', { name: 'Sin evaluación' })
    const ayuda = document.getElementById(sin.getAttribute('aria-describedby')!)
    expect(ayuda?.textContent).toMatch(/no responde preguntas/)
    // Cada opción con su ayuda, y ninguna vacía
    for (const radio of screen.getAllByRole('radio')) {
      expect(document.getElementById(radio.getAttribute('aria-describedby')!)?.textContent?.trim()).toBeTruthy()
    }
  })

  it('el estado de las propias y el botón al editor van separados, no en la misma línea', async () => {
    pintar(vacante({ origenPreguntas: 'VACANTE', bancoDelNivelPropio: false }))
    // Texto exacto: si el enlace cayera dentro del estado, este texto no existiría solo
    const estado = await screen.findByText('Borrador · 68 de 100 puntos')
    const enlace = screen.getByRole('link', { name: 'Escribir las preguntas →' })
    expect(estado.contains(enlace)).toBe(false)
    expect(screen.getByText('Sus preguntas propias')).toBeTruthy()
  })

  it('sin evaluación no enseña estado ni botón de las propias', () => {
    pintar(vacante({ aplicaEvaluacion: false, origenPreguntas: 'VACANTE', bancoDelNivelPropio: true }))
    expect(screen.getByRole('radio', { name: 'Sin evaluación' })).toHaveProperty('checked', true)
    expect(screen.queryByText('Sus preguntas propias')).toBeNull()
    expect(screen.queryByRole('link', { name: 'Escribir las preguntas →' })).toBeNull()
  })
})

/*
 * QA-PP-10: con el teclado, cada flecha marca la opción siguiente y la guarda. Un
 * radio enfocado que se deshabilita suelta el foco al <body> —jsdom no lo imita, por
 * eso se comprueba la causa: que ninguno se apague mientras el servidor confirma—.
 */
describe('mientras se guarda, el foco se queda en el grupo (QA-PP-10)', () => {
  it('ningún radio se deshabilita: se marcan ocupados y el que tiene el foco lo conserva', async () => {
    const respuesta = enVuelo()
    elegir.mockReturnValue(respuesta.promesa)
    pintar(vacante({ origenPreguntas: 'VACANTE', bancoDelNivelPropio: true }))
    const banco = screen.getByRole('radio', { name: 'El banco de la empresa para su nivel' })

    banco.focus()
    fireEvent.click(banco)

    await waitFor(() => expect(banco.getAttribute('aria-disabled')).toBe('true'))
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toHaveProperty('disabled', false)
      expect(radio.getAttribute('aria-disabled')).toBe('true')
    }
    expect(document.activeElement).toBe(banco)
    expect(banco).toHaveProperty('checked', true)

    respuesta.soltar()
    await waitFor(() => expect(banco.getAttribute('aria-disabled')).toBeNull())
    expect(document.activeElement).toBe(banco)
    expect(banco).toHaveProperty('disabled', false)
  })

  it('una segunda flecha mientras se guarda no manda otro cambio, ni en el mismo instante', async () => {
    const respuesta = enVuelo()
    elegir.mockReturnValue(respuesta.promesa)
    pintar(vacante({ origenPreguntas: 'VACANTE', bancoDelNivelPropio: true }))
    const banco = screen.getByRole('radio', { name: 'El banco de la empresa para su nivel' })
    const sin = screen.getByRole('radio', { name: 'Sin evaluación' })

    // Las dos seguidas, antes de que la mutación llegue a pintarse como pendiente
    fireEvent.click(banco)
    fireEvent.click(sin)
    await waitFor(() => expect(banco.getAttribute('aria-disabled')).toBe('true'))
    fireEvent.click(sin)

    expect(elegir).toHaveBeenCalledTimes(1)
    expect(elegir).toHaveBeenCalledWith(40, 'NIVEL')
    // La marca sigue en la que se está guardando
    expect(banco).toHaveProperty('checked', true)
    expect(sin).toHaveProperty('checked', false)

    // Confirmado, la siguiente flecha sí se guarda
    respuesta.soltar()
    await waitFor(() => expect(sin.getAttribute('aria-disabled')).toBeNull())
    elegir.mockResolvedValue(undefined)
    sin.focus()
    fireEvent.click(sin)
    await waitFor(() => expect(elegir).toHaveBeenLastCalledWith(40, 'SIN_EVALUACION'))
    expect(elegir).toHaveBeenCalledTimes(2)
    expect(document.activeElement).toBe(sin)
  })

  it('si el servidor lo rechaza (409 con postulantes), la marca vuelve a su sitio y el grupo sigue usable', async () => {
    const respuesta = enVuelo()
    elegir.mockReturnValue(respuesta.promesa)
    const alFallar = vi.fn()
    pintar(vacante({ origenPreguntas: 'VACANTE', bancoDelNivelPropio: true }), alFallar)
    const propias = screen.getByRole('radio', { name: 'Preguntas propias de esta vacante' })
    const banco = screen.getByRole('radio', { name: 'El banco de la empresa para su nivel' })

    banco.focus()
    fireEvent.click(banco)
    await waitFor(() => expect(banco.getAttribute('aria-disabled')).toBe('true'))
    respuesta.fallar(new Error('La vacante ya tiene postulantes'))

    await waitFor(() => expect(alFallar).toHaveBeenCalled())
    await waitFor(() => expect(propias).toHaveProperty('checked', true))
    expect(banco).toHaveProperty('checked', false)
    expect(banco.getAttribute('aria-disabled')).toBeNull()
    expect(document.activeElement).toBe(banco)

    // Y se puede volver a intentar: el rechazo no deja el grupo bloqueado
    elegir.mockResolvedValue(undefined)
    fireEvent.click(banco)
    await waitFor(() => expect(elegir).toHaveBeenCalledTimes(2))
  })
})
