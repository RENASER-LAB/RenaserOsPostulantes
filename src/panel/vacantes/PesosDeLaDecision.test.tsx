/**
 * «Pesos de la decisión» con candidatos dentro (V74).
 *
 * Lo que se defiende:
 *   1. **Con alguien con nota, se pregunta antes de guardar**, y la pregunta dice
 *      a cuántas personas toca y qué pesos cambian, antes y después.
 *   2. **Sin nadie con nota se guarda sin preguntar**, como antes de la primera
 *      postulación; y elegir la misma no hace nada.
 *   3. **Si falla, lo dice dentro del diálogo**: la vacante sigue como estaba.
 *   4. **Cerrada, el desplegable es de solo lectura**, con el porqué.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { CambioDePesosPrevisto, VacantePanel } from '../api/tipos'
import { PesosDeLaDecision } from './PesosDeLaDecision'

const asignar = vi.fn()
const prever = vi.fn()

vi.mock('../api/panel', () => ({
  asignarVersionPesos: (vacanteId: number, version: number) => asignar(vacanteId, version),
  preverCambioDePesos: (vacanteId: number, version: number) => prever(vacanteId, version),
  listarVersionesPesos: () =>
    Promise.resolve([
      { id: 2, etiqueta: 'CAZATALENTOS · MICRO', estado: 'PUBLICADA', publicadaEn: null },
      { id: 9, etiqueta: 'CAZATALENTOS · PYME', estado: 'PUBLICADA', publicadaEn: null },
      { id: 11, etiqueta: 'Borrador sin terminar', estado: 'BORRADOR', publicadaEn: null },
    ]),
}))

const VACANTE = {
  id: 40,
  estado: 'PUBLICADA',
  versionPesosId: 2,
  archivadaEn: null,
} as unknown as VacantePanel

const previsto = (personas: number, parte: Partial<CambioDePesosPrevisto> = {}): CambioDePesosPrevisto => ({
  versionAnteriorId: 2,
  etiquetaAnterior: 'CAZATALENTOS · MICRO',
  versionNuevaId: 9,
  etiquetaNueva: 'CAZATALENTOS · PYME',
  personasConNota: personas,
  cambia: true,
  etapas: [
    { codigo: 'PERFIL_INTEGRAL', nombre: 'Perfil Integral', antes: 40, despues: 40 },
    { codigo: 'PRUEBA_PUESTO', nombre: 'Prueba del puesto', antes: 30, despues: 35 },
    { codigo: 'SIMULACION', nombre: 'Simulación', antes: 15, despues: 15 },
    { codigo: 'VALIDACION', nombre: 'Validación', antes: 15, despues: 10 },
  ],
  perfilIntegral: [
    { codigo: 'CV', nombre: 'Currículum', antes: 12, despues: 20 },
    { codigo: 'EVALUACION', nombre: 'Preguntas', antes: 28, despues: 20 },
  ],
  ...parte,
})

const alFallar = vi.fn()

function pintar(vacante: VacantePanel = VACANTE) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={cliente}>
      <PesosDeLaDecision vacante={vacante} alFallar={alFallar} />
    </QueryClientProvider>,
  )
}

const elDesplegable = () =>
  screen.getByRole('combobox', { name: /qué pesos rigen la decisión/i }) as HTMLSelectElement

async function elegir(valor: string) {
  await screen.findByRole('option', { name: 'CAZATALENTOS · PYME' })
  fireEvent.change(elDesplegable(), { target: { value: valor } })
}

beforeEach(() => {
  asignar.mockReset()
  prever.mockReset()
  alFallar.mockReset()
})

afterEach(() => cleanup())

describe('cambiar los pesos con candidatos dentro', () => {
  it('pregunta antes de guardar: a cuántas personas toca y qué pesos cambian, antes y después', async () => {
    prever.mockResolvedValue(previsto(23))
    asignar.mockResolvedValue({ versionPesosId: 9, personasRecalculadas: 23 })
    pintar()

    await elegir('9')

    const dialogo = await screen.findByRole('dialog')
    expect(prever).toHaveBeenCalledWith(40, 9)
    expect(asignar).not.toHaveBeenCalled()
    expect(within(dialogo).getByText(/¿Cambiar a «CAZATALENTOS · PYME»\?/)).toBeTruthy()
    expect(dialogo.textContent).toMatch(/Se recalcularán las notas de 23 personas con los pesos nuevos/)
    expect(dialogo.textContent).toMatch(/No se llama a la IA y nadie cambia de etapa/)
    expect(dialogo.textContent).toMatch(/Las decisiones ya tomadas se mantienen/)
    // Antes y después, etapa por etapa, con el reparto del Perfil Integral
    const prueba = within(dialogo).getByRole('row', { name: /Prueba del puesto/ })
    expect(within(prueba).getAllByRole('cell').map((c) => c.textContent)).toEqual(['30', '35'])
    expect(dialogo.textContent).toMatch(/Currículum 12 → 20 · Preguntas 28 → 20/)
    // En el teléfono cada cifra dice qué es: la tabla se apila
    expect(within(prueba).getAllByRole('cell').map((c) => c.getAttribute('data-rotulo'))).toEqual([
      'Antes',
      'Después',
    ])

    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cambiar y recalcular' }))

    await waitFor(() => expect(asignar).toHaveBeenCalledWith(40, 9))
    expect(asignar).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Pesos cambiados: se recalcularon 23 personas.')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('mientras recalcula lo dice en el botón, y no deja cancelar a medias', async () => {
    prever.mockResolvedValue(previsto(1))
    asignar.mockReturnValue(new Promise(() => {}))
    pintar()

    await elegir('9')
    const dialogo = await screen.findByRole('dialog')
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cambiar y recalcular' }))

    const ocupado = await within(dialogo).findByRole('button', { name: 'Recalculando 1 persona…' })
    expect((ocupado as HTMLButtonElement).disabled).toBe(true)
    expect((within(dialogo).getByRole('button', { name: 'Cancelar' }) as HTMLButtonElement).disabled)
      .toBe(true)
  })

  it('cancelar no cambia nada', async () => {
    prever.mockResolvedValue(previsto(3))
    pintar()

    await elegir('9')
    const dialogo = await screen.findByRole('dialog')
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(asignar).not.toHaveBeenCalled()
    expect(elDesplegable().value).toBe('2')
  })

  it('si falla, lo dice en el diálogo: la vacante sigue con sus pesos (AC-07)', async () => {
    prever.mockResolvedValue(previsto(3))
    asignar.mockRejectedValue(new Error('No se pudo recalcular la nota de SIMULACION de la postulación 11'))
    pintar()

    await elegir('9')
    const dialogo = await screen.findByRole('dialog')
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cambiar y recalcular' }))

    const aviso = await within(dialogo).findByRole('alert')
    expect(aviso.textContent).toMatch(/No se cambió nada: la vacante sigue con sus pesos y sus notas/)
    expect(aviso.textContent).toMatch(/SIMULACION/)
    expect(alFallar).not.toHaveBeenCalled()
    expect(screen.queryByText(/Pesos cambiados/)).toBeNull()
  })

  it('sin nadie con nota se guarda sin preguntar (AC-06)', async () => {
    prever.mockResolvedValue(previsto(0))
    asignar.mockResolvedValue({ versionPesosId: 9, personasRecalculadas: 0 })
    pintar()

    await elegir('9')

    await waitFor(() => expect(asignar).toHaveBeenCalledWith(40, 9))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText(/Pesos cambiados/)).toBeNull()
  })

  it('elegir la que ya tiene no pregunta ni guarda', async () => {
    prever.mockResolvedValue(previsto(5, { cambia: false, versionNuevaId: 2 }))
    pintar({ ...VACANTE, versionPesosId: 9 } as VacantePanel)

    await elegir('2')

    await waitFor(() => expect(prever).toHaveBeenCalled())
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(asignar).not.toHaveBeenCalled()
  })

  it('si no se puede ni preguntar (un 403), lo cuenta quien aloja el bloque', async () => {
    const causa = new Error('Sin permiso')
    prever.mockRejectedValue(causa)
    pintar()

    await elegir('9')

    await waitFor(() => expect(alFallar).toHaveBeenCalledWith(causa))
    expect(asignar).not.toHaveBeenCalled()
  })

  it('no ofrece una versión en borrador', async () => {
    pintar()
    await screen.findByRole('option', { name: 'CAZATALENTOS · PYME' })
    expect(screen.queryByRole('option', { name: 'Borrador sin terminar' })).toBeNull()
  })
})

describe('una vacante cerrada', () => {
  it('deja el desplegable en solo lectura y dice por qué', async () => {
    pintar({ ...VACANTE, estado: 'CERRADA' } as VacantePanel)

    await screen.findByRole('option', { name: 'CAZATALENTOS · PYME' })
    expect(elDesplegable().disabled).toBe(true)
    expect(screen.getByText(/La vacante está cerrada: sus pesos ya no se cambian/)).toBeTruthy()
  })
})
