import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ConteoEmbudo, VacantePanel } from '../api/tipos'
import { ListaDeVacantes } from './ListaDeVacantes'

const vacante = (id: number, titulo: string, estado: string) =>
  ({ id, titulo, estado, publicadaEn: null, cierraEn: null, ciudad: null }) as VacantePanel

const VACANTES = [
  vacante(1, 'Analista de Remuneraciones', 'PUBLICADA'),
  vacante(2, 'Técnico de Soporte', 'BORRADOR'),
  vacante(3, 'Coordinador de Sede', 'CERRADA'),
]

const EMBUDOS: { data?: ConteoEmbudo; isPending: boolean }[] = [
  {
    isPending: false,
    data: { porEstado: { POSTULADA: 3, PERFIL_POR_CONFIRMAR: 2, PRUEBA_TURNO_CANDIDATO: 1 } },
  },
  { isPending: false, data: { porEstado: {} } },
  { isPending: false, data: { porEstado: { NO_CONTINUA: 4, DECISION_POR_CONFIRMAR: 1 } } },
]

function pintar(embudos = EMBUDOS) {
  render(
    <MemoryRouter>
      <ListaDeVacantes
        vacantes={VACANTES}
        embudos={embudos}
        evaluacionDe={() => 'Banco por nivel'}
        accionesDe={() => null}
      />
    </MemoryRouter>,
  )
}

const fila = (titulo: string) =>
  screen.getByRole('cell', { name: titulo }).closest('[role="row"]') as HTMLElement

// Con movimiento reducido las cifras salen ya contadas, sin la subida desde cero.
beforeEach(() => {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('ListaDeVacantes', () => {
  it('suma el resumen de todas las vacantes', () => {
    pintar()
    const resumen = screen.getByText('Postulantes', { selector: 'dt' }).parentElement!
    expect(resumen.querySelector('dd')!.textContent).toBe('7')
    const porRevisar = screen.getByText('Esperan tu decisión', { selector: 'dt' }).parentElement!
    expect(porRevisar.querySelector('dd')!.textContent).toBe('3')
  })

  it('cada fila dice cuántos hay por etapa y cuántos esperan al equipo', () => {
    pintar()
    const analista = within(fila('Analista de Remuneraciones'))
    expect(analista.getByLabelText('6 postulantes, 2 esperan tu decisión')).toBeTruthy()
    expect(analista.getByTitle('Perfil integral').textContent).toContain('5')
    expect(analista.getByText('2 esperan tu decisión')).toBeTruthy()
  })

  it('un borrador sin gente pide publicarse en vez de enseñar ceros', () => {
    pintar()
    expect(
      within(fila('Técnico de Soporte')).getByText('Publícala para empezar a recibir postulantes.'),
    ).toBeTruthy()
  })

  it('quien ya terminó no cuenta: el total es de quien sigue en proceso', () => {
    pintar()
    const coordinador = within(fila('Coordinador de Sede'))
    expect(coordinador.getByLabelText('1 postulante, 1 espera tu decisión')).toBeTruthy()
    expect(coordinador.queryByText(/terminaron/)).toBeNull()
  })

  it('filtra por estado y busca sin tildes', () => {
    pintar()
    fireEvent.click(screen.getByRole('button', { name: /Borradores/ }))
    expect(screen.queryByRole('cell', { name: 'Analista de Remuneraciones' })).toBeNull()
    expect(screen.getByRole('cell', { name: 'Técnico de Soporte' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Todas/ }))
    fireEvent.change(screen.getByLabelText('Buscar una vacante por su nombre'), {
      target: { value: 'tecnico' },
    })
    expect(screen.getAllByRole('row')).toHaveLength(2) // la cabecera y la que coincide
  })

  it('sin coincidencias lo dice y deja volver a verlas todas', () => {
    pintar()
    fireEvent.change(screen.getByLabelText('Buscar una vacante por su nombre'), {
      target: { value: 'piloto' },
    })
    expect(screen.getByText(/Ninguna vacante coincide/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ver todas' }))
    expect(screen.getByRole('cell', { name: 'Coordinador de Sede' })).toBeTruthy()
  })

  it('mientras cuenta no inventa cifras en el resumen', () => {
    pintar(EMBUDOS.map(() => ({ isPending: true })))
    const resumen = screen.getByText('Postulantes', { selector: 'dt' }).parentElement!
    expect(resumen.querySelector('dd')!.textContent).toBe('—')
  })
})
