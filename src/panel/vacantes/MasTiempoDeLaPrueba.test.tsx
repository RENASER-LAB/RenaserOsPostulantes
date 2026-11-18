/**
 * «Darle más tiempo» en la ficha (V89).
 *
 * Lo que compila estando mal:
 *
 *   1. **Mandar la fecha en la zona del equipo.** «Hasta» es hora de Lima: el
 *      instante que viaja se calcula con esa zona (ver `horaDeLima.test.ts`).
 *   2. **Enseñar el botón a quien no puede usarlo**, o encendido con la vacante
 *      archivada.
 *   3. **Llamar sin motivo o con una fecha pasada.** No se envía nada y se dice
 *      junto al campo.
 *
 * Las fechas «futuras» se calculan desde ahora: una fecha escrita a mano caduca.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ErrorApi } from '../api/cliente'
import type { PlazoVigenteDePrueba } from '../api/tipos'
import { ElTiempoDeLaPrueba } from './MasTiempoDeLaPrueba'

const verPlazo = vi.fn()
const dar = vi.fn()

vi.mock('../api/panel', () => ({
  verPlazoDePrueba: (postulacionId: number) => verPlazo(postulacionId),
  darMasTiempoDePrueba: (postulacionId: number, venceEn: string, motivo: string, avisar: boolean) =>
    dar(postulacionId, venceEn, motivo, avisar),
}))

const SIN_COMPLETAR: PlazoVigenteDePrueba = {
  existeIntento: true,
  venceEn: '2026-11-18T21:40:00Z',
  origen: 'RELOJ',
  iniciadoEn: '2026-11-18T20:00:00Z',
  entregadoEn: '2026-11-18T21:41:00Z',
  instrumento: null,
  sinCompletar: {
    seAcaboEn: '2026-11-18T21:40:00Z',
    sinAbrir: false,
    queFalto: 'le faltaron 4 preguntas y «Tablero.xlsx»',
    puedeMover: true,
    bloqueo: null,
  },
  masTiempo: null,
}

/** El texto del campo «Hasta» en hora de Lima, dentro de `dias` días. */
function campoDeLimaDentroDe(dias: number): { campo: string; utc: string } {
  const instante = new Date(Date.now() + dias * 86_400_000)
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instante)
  const de = (t: string) => partes.find((p) => p.type === t)!.value
  const campo = `${de('year')}-${de('month')}-${de('day')}T${de('hour')}:${de('minute')}`
  return { campo, utc: new Date(`${campo}:00-05:00`).toISOString() }
}

function pintar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={cliente}>
      <ElTiempoDeLaPrueba postulacionId={7} candidato="Beto Gil" />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  verPlazo.mockReset()
  dar.mockReset()
})
afterEach(cleanup)

describe('quien no la completó, en su ficha', () => {
  it('dice cuándo se le acabó el tiempo y qué le faltó, y ofrece «Darle más tiempo» (AC-09)', async () => {
    verPlazo.mockResolvedValue(SIN_COMPLETAR)
    pintar()
    const linea = await screen.findByText(/^No la completó · se le acabó el tiempo el 18 nov, 16:40/)
    expect(linea.textContent).toContain('Le faltaron 4 preguntas y «Tablero.xlsx»')
    expect(screen.getByRole('button', { name: 'Darle más tiempo' })).toBeTruthy()
    expect(screen.queryByText(/No tiene nota ni sale en el ranking/)).toBeNull()
  })

  it('a quien no la abrió: «No la abrió»', async () => {
    verPlazo.mockResolvedValue({
      ...SIN_COMPLETAR,
      iniciadoEn: null,
      entregadoEn: null,
      sinCompletar: { ...SIN_COMPLETAR.sinCompletar!, sinAbrir: true, queFalto: null },
    })
    pintar()
    expect((await screen.findByText(/^No la completó/)).textContent).toContain('No la abrió')
  })

  it('sin el permiso el botón ni sale (AC-11)', async () => {
    verPlazo.mockResolvedValue({
      ...SIN_COMPLETAR,
      sinCompletar: { ...SIN_COMPLETAR.sinCompletar!, puedeMover: false },
    })
    pintar()
    await screen.findByText(/^No la completó/)
    expect(screen.queryByRole('button', { name: 'Darle más tiempo' })).toBeNull()
  })

  it('con la vacante archivada sale apagado, con el chip «Vacante archivada» (AC-11)', async () => {
    verPlazo.mockResolvedValue({
      ...SIN_COMPLETAR,
      sinCompletar: { ...SIN_COMPLETAR.sinCompletar!, bloqueo: 'Vacante archivada' },
    })
    pintar()
    const boton = (await screen.findByRole('button', { name: 'Darle más tiempo' })) as HTMLButtonElement
    expect(boton.disabled).toBe(true)
    expect(screen.getByText('Vacante archivada')).toBeTruthy()
  })

  it('no pinta nada si su prueba no está sin completar y nadie le dio más tiempo', async () => {
    verPlazo.mockResolvedValue({ ...SIN_COMPLETAR, entregadoEn: null, sinCompletar: null })
    const { container } = pintar()
    await waitFor(() => expect(verPlazo).toHaveBeenCalled())
    expect(container.textContent).toBe('')
  })
})

describe('la ventana «Darle más tiempo» (AC-07, AC-08, AC-11)', () => {
  async function abrir() {
    verPlazo.mockResolvedValue(SIN_COMPLETAR)
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: 'Darle más tiempo' }))
    return screen.getByRole('dialog', { name: 'Darle más tiempo a Beto Gil' })
  }

  it('se pinta al final de <body>, fuera de la ficha: en el teléfono la barra del panel no la tapa (F-2, AC-14)', async () => {
    const ventana = await abrir()
    expect(ventana.parentElement).toBe(document.body)
  })

  it('trae «Hasta» vacía, «Motivo», «Avisar a Beto» marcada y sus dos botones', async () => {
    const ventana = await abrir()
    expect((within(ventana).getByLabelText('Hasta') as HTMLInputElement).value).toBe('')
    expect(within(ventana).getByLabelText('Motivo')).toBeTruthy()
    expect((within(ventana).getByLabelText('Avisar a Beto') as HTMLInputElement).checked).toBe(true)
    expect(within(ventana).getByRole('button', { name: 'Cancelar' })).toBeTruthy()
    expect(within(ventana).getByRole('button', { name: 'Darle más tiempo' })).toBeTruthy()
  })

  it('sin fecha ni motivo no envía nada y lo dice junto a cada campo', async () => {
    const ventana = await abrir()
    fireEvent.click(within(ventana).getByRole('button', { name: 'Darle más tiempo' }))
    expect(await within(ventana).findByText('Elige hasta qué día y hora tiene.')).toBeTruthy()
    expect(within(ventana).getByText('Escribe por qué se le da más tiempo.')).toBeTruthy()
    expect(dar).not.toHaveBeenCalled()
  })

  it('con una fecha pasada no envía nada', async () => {
    const ventana = await abrir()
    fireEvent.change(within(ventana).getByLabelText('Hasta'), {
      target: { value: campoDeLimaDentroDe(-2).campo },
    })
    fireEvent.change(within(ventana).getByLabelText('Motivo'), { target: { value: 'Se cortó la luz' } })
    fireEvent.click(within(ventana).getByRole('button', { name: 'Darle más tiempo' }))
    expect(await within(ventana).findByText('Esa fecha ya pasó: elige una futura.')).toBeTruthy()
    expect(dar).not.toHaveBeenCalled()
  })

  it('guarda la fecha de Lima en UTC con el motivo, y dice por dónde se le avisó', async () => {
    const { campo, utc } = campoDeLimaDentroDe(3)
    dar.mockResolvedValue({
      postulacionId: 7,
      venceEn: utc,
      estadoPrueba: 'EN_CURSO',
      avisadoPor: ['correo', 'campana', 'WhatsApp'],
    })
    const ventana = await abrir()
    verPlazo.mockResolvedValue({
      ...SIN_COMPLETAR,
      venceEn: utc,
      entregadoEn: null,
      origen: 'PROPIO',
      sinCompletar: null,
      masTiempo: { dadoEn: new Date().toISOString(), dadoPor: 'Ana Ríos', motivo: 'Se cortó la luz' },
    })
    fireEvent.change(within(ventana).getByLabelText('Hasta'), { target: { value: campo } })
    fireEvent.change(within(ventana).getByLabelText('Motivo'), { target: { value: '  Se cortó la luz ' } })
    fireEvent.click(within(ventana).getByRole('button', { name: 'Darle más tiempo' }))

    await waitFor(() => expect(dar).toHaveBeenCalledWith(7, utc, 'Se cortó la luz', true))
    expect(await screen.findByText('Volvió a «Le toca al candidato».')).toBeTruthy()
    expect(screen.getByText('Avisado por correo, campana y WhatsApp')).toBeTruthy()
    const linea = await screen.findByText(/^En curso · le cierra el /)
    expect(linea.textContent).toContain('por Ana Ríos: Se cortó la luz')
  })

  it('con «Avisar» desmarcada lo manda sin aviso', async () => {
    const { campo, utc } = campoDeLimaDentroDe(2)
    dar.mockResolvedValue({ postulacionId: 7, venceEn: utc, estadoPrueba: 'EN_CURSO', avisadoPor: [] })
    const ventana = await abrir()
    fireEvent.change(within(ventana).getByLabelText('Hasta'), { target: { value: campo } })
    fireEvent.change(within(ventana).getByLabelText('Motivo'), { target: { value: 'Lo pidió' } })
    fireEvent.click(within(ventana).getByLabelText('Avisar a Beto'))
    fireEvent.click(within(ventana).getByRole('button', { name: 'Darle más tiempo' }))
    await waitFor(() => expect(dar).toHaveBeenCalledWith(7, utc, 'Lo pidió', false))
  })

  it('un 409 del servidor (proceso cerrado) se dice en la ventana y no cierra nada', async () => {
    const { campo } = campoDeLimaDentroDe(2)
    dar.mockRejectedValue(
      new ErrorApi(409, 'Su proceso ya está cerrado: un proceso cerrado no se reabre ni recibe más tiempo'),
    )
    const ventana = await abrir()
    fireEvent.change(within(ventana).getByLabelText('Hasta'), { target: { value: campo } })
    fireEvent.change(within(ventana).getByLabelText('Motivo'), { target: { value: 'Lo pidió' } })
    fireEvent.click(within(ventana).getByRole('button', { name: 'Darle más tiempo' }))
    expect(await within(ventana).findByRole('alert')).toBeTruthy()
    expect(within(ventana).getByRole('alert').textContent).toContain('ya está cerrado')
  })
})
