/**
 * La campana del portal.
 *
 * Tres formas de romperla sin que nada se queje:
 *
 *   1. **Pedir los avisos sin sesion.** El tablon se sirve sin cuenta, y una
 *      consulta con token vacio serian 401 en cada visita anonima.
 *   2. **Apagar los avisos por abrir la campana.** Es lo que hacia antes, y el
 *      punto de cada fila de «Mis procesos» se apagaba con ellos sin que nadie
 *      hubiera leido nada. Ahora lo decide la persona: el que pulsa, o todos con
 *      el boton de la cabecera.
 *   3. **Marcar leido lo que ya lo estaba**: trafico por un clic que no apaga nada.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { Campana } from './Campana'

let hayCuenta = true
let avisos: { sinLeer: number; avisos: unknown[] } = { sinLeer: 0, avisos: [] }
let vecesQueSeMarco = 0
let vecesQueSePidio = 0

vi.mock('@/app/Sesion', () => ({
  useSesion: () => ({ hayCuenta }),
}))

const marcadosUnoAUno: number[] = []

vi.mock('@/api/portal', () => ({
  misAvisos: () => {
    vecesQueSePidio += 1
    return Promise.resolve(avisos)
  },
  marcarAvisosLeidos: () => {
    vecesQueSeMarco += 1
    return Promise.resolve({ marcados: 1 })
  },
  marcarAvisoLeido: (id: number) => {
    marcadosUnoAUno.push(id)
    return Promise.resolve()
  },
}))

const UN_AVISO = {
  id: 10,
  tipo: 'REMUNERACION_ACTUALIZADA',
  titulo: 'Cambió la remuneración de «Analista»',
  cuerpo: 'Antes: S/ 3 000 · Ahora: S/ 3 500.',
  postulacionUuid: 'uuid-1',
  vacanteId: 7,
  leidoEn: null,
  creadoEn: new Date().toISOString(),
}

function montar() {
  const datos = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={datos}>
      <MemoryRouter>
        <Campana />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  hayCuenta = true
  avisos = { sinLeer: 0, avisos: [] }
  vecesQueSeMarco = 0
  vecesQueSePidio = 0
  marcadosUnoAUno.length = 0
})
afterEach(cleanup)

describe('la campana', () => {
  it('sin sesión no se pinta ni pide nada', async () => {
    hayCuenta = false
    montar()

    expect(screen.queryByRole('button')).toBeNull()
    await waitFor(() => expect(vecesQueSePidio).toBe(0))
  })

  it('la píldora lleva la cuenta, y el lector de pantalla también la oye', async () => {
    avisos = { sinLeer: 3, avisos: [UN_AVISO] }
    montar()

    // El nombre accesible dice el numero: quien no ve el punto necesita que el
    // boton se lo diga, y un circulo de CSS no dice nada.
    await screen.findByRole('button', { name: /3 sin leer/i })
  })

  it('abrir la campana NO apaga nada: lo decide la persona', async () => {
    // Antes se marcaban todos al abrir, y con ellos se apagaba el punto de cada
    // fila de «Mis procesos» — sin que nadie hubiera leido nada.
    avisos = { sinLeer: 2, avisos: [UN_AVISO] }
    montar()
    await screen.findByRole('button', { name: /2 sin leer/i })

    fireEvent.click(screen.getByRole('button'))
    await screen.findByRole('dialog')

    expect(vecesQueSeMarco).toBe(0)
    expect(marcadosUnoAUno).toHaveLength(0)
  })

  it('pulsar un aviso apaga ESE, no todos', async () => {
    avisos = { sinLeer: 2, avisos: [UN_AVISO] }
    montar()
    await screen.findByRole('button', { name: /2 sin leer/i })
    fireEvent.click(screen.getByRole('button'))

    fireEvent.click(await screen.findByRole('link', { name: /cambió la remuneración/i }))

    await waitFor(() => expect(marcadosUnoAUno).toEqual([10]))
    expect(vecesQueSeMarco).toBe(0)
  })

  it('«marcar todos» solo sale si hay algo sin leer, y los apaga de una vez', async () => {
    avisos = { sinLeer: 2, avisos: [UN_AVISO] }
    montar()
    await screen.findByRole('button', { name: /2 sin leer/i })
    fireEvent.click(screen.getByRole('button'))

    fireEvent.click(await screen.findByRole('button', { name: /marcar todos como leídos/i }))

    await waitFor(() => expect(vecesQueSeMarco).toBe(1))
  })

  it('con la campana vacía no se ofrece marcar nada', async () => {
    montar()
    await screen.findByRole('button', { name: 'Avisos' })

    fireEvent.click(screen.getByRole('button'))

    await screen.findByText(/nada nuevo por ahora/i)
    expect(screen.queryByRole('button', { name: /marcar todos/i })).toBeNull()
    expect(vecesQueSeMarco).toBe(0)
  })

  it('un aviso ya leído no se vuelve a marcar al pulsarlo', async () => {
    avisos = {
      sinLeer: 0,
      avisos: [{ ...UN_AVISO, leidoEn: '2026-09-14T10:00:00Z' }],
    }
    montar()
    await screen.findByRole('button', { name: 'Avisos' })
    fireEvent.click(screen.getByRole('button'))

    fireEvent.click(await screen.findByRole('link', { name: /cambió la remuneración/i }))

    await waitFor(() => expect(marcadosUnoAUno).toHaveLength(0))
  })

  it('cada aviso enseña lo que pasó y lleva a su proceso', async () => {
    avisos = { sinLeer: 1, avisos: [UN_AVISO] }
    montar()
    await screen.findByRole('button', { name: /1 sin leer/i })

    fireEvent.click(screen.getByRole('button'))

    const enlace = await screen.findByRole('link', { name: /cambió la remuneración/i })
    expect(enlace.getAttribute('href')).toBe('/procesos/uuid-1')
    expect(screen.getByText(/antes: s\/ 3 000/i)).toBeTruthy()
    // «Sin leer» va DENTRO del nombre del enlace, no suelto al lado: asi quien
    // navega por la lista de enlaces oye que ese aviso es nuevo sin tener que
    // encontrar un punto de 5px que para el no existe. `name` de `getByRole` es
    // el nombre accesible calculado, que es exactamente lo que se quiere probar.
    expect(screen.getByRole('link', { name: /sin leer/i })).toBe(enlace)
  })

  it('un aviso ya leído no anuncia «sin leer»', async () => {
    avisos = {
      sinLeer: 0,
      avisos: [{ ...UN_AVISO, leidoEn: '2026-09-14T10:00:00Z' }],
    }
    montar()
    await screen.findByRole('button', { name: 'Avisos' })
    fireEvent.click(screen.getByRole('button'))

    await screen.findByRole('link', { name: /cambió la remuneración/i })
    expect(screen.queryByRole('link', { name: /sin leer/i })).toBeNull()
  })

  it('un aviso sin proceso detrás no se pinta como enlace', async () => {
    // Un enlace que no lleva a ninguna parte es peor que no tenerlo: se pulsa,
    // no pasa nada, y la proxima vez ya no se pulsa ninguno. Sigue siendo
    // pulsable —es un boton— para poder apagarlo.
    avisos = { sinLeer: 1, avisos: [{ ...UN_AVISO, postulacionUuid: null }] }
    montar()
    await screen.findByRole('button', { name: /1 sin leer/i })

    fireEvent.click(screen.getByRole('button'))

    await screen.findByText(/cambió la remuneración/i)
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('se cierra con Escape', async () => {
    avisos = { sinLeer: 1, avisos: [UN_AVISO] }
    montar()
    await screen.findByRole('button', { name: /1 sin leer/i })
    fireEvent.click(screen.getByRole('button'))
    await screen.findByRole('dialog')

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})
