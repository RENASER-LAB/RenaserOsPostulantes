/**
 * La campana del portal.
 *
 * Tres formas de romperla sin que nada se queje:
 *
 *   1. **Pedir los avisos sin sesion.** El tablon se sirve sin cuenta, y una
 *      consulta con token vacio serian 401 en cada visita anonima.
 *   2. **Marcar leido al cargar la pagina en vez de al abrirla.** El punto se
 *      apagaria solo, sin que nadie hubiera visto nada.
 *   3. **Llamar a marcar-leidos cada vez que se pulsa**, tambien con la campana
 *      vacia: trafico por una casilla que no apaga nada.
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

vi.mock('@/api/portal', () => ({
  misAvisos: () => {
    vecesQueSePidio += 1
    return Promise.resolve(avisos)
  },
  marcarAvisosLeidos: () => {
    vecesQueSeMarco += 1
    return Promise.resolve({ marcados: 1 })
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
})
afterEach(cleanup)

describe('la campana', () => {
  it('sin sesión no se pinta ni pide nada', async () => {
    hayCuenta = false
    montar()

    expect(screen.queryByRole('button')).toBeNull()
    await waitFor(() => expect(vecesQueSePidio).toBe(0))
  })

  it('el punto lleva la cuenta, y el lector de pantalla también la oye', async () => {
    avisos = { sinLeer: 3, avisos: [UN_AVISO] }
    montar()

    // El nombre accesible dice el numero: quien no ve el punto necesita que el
    // boton se lo diga, y un circulo de CSS no dice nada.
    await screen.findByRole('button', { name: /3 sin leer/i })
  })

  it('no marca nada leído hasta que se abre', async () => {
    avisos = { sinLeer: 2, avisos: [UN_AVISO] }
    montar()
    await screen.findByRole('button', { name: /2 sin leer/i })

    // Cargar la pagina no es haber visto nada.
    expect(vecesQueSeMarco).toBe(0)

    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(vecesQueSeMarco).toBe(1))
  })

  it('con la campana vacía, abrirla no llama a marcar nada', async () => {
    montar()
    await screen.findByRole('button', { name: 'Avisos' })

    fireEvent.click(screen.getByRole('button'))

    await screen.findByText(/nada nuevo por ahora/i)
    expect(vecesQueSeMarco).toBe(0)
  })

  it('cada aviso enseña lo que pasó y lleva a su proceso', async () => {
    avisos = { sinLeer: 1, avisos: [UN_AVISO] }
    montar()
    await screen.findByRole('button', { name: /1 sin leer/i })

    fireEvent.click(screen.getByRole('button'))

    const enlace = await screen.findByRole('link', { name: /cambió la remuneración/i })
    expect(enlace.getAttribute('href')).toBe('/procesos/uuid-1')
    expect(screen.getByText(/antes: s\/ 3 000/i)).toBeTruthy()
  })

  it('un aviso sin proceso detrás no se pinta como enlace', async () => {
    // Un enlace que no lleva a ninguna parte es peor que no tenerlo: se pulsa,
    // no pasa nada, y la proxima vez ya no se pulsa ninguno.
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
