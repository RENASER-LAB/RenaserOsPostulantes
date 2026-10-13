/**
 * La nota mínima del Perfil Integral para pasar sola a la prueba, en la tuerca (V72).
 *
 * Lo que se sostiene aquí es el comportamiento del campo: que se guarde al salir y solo si
 * cambió, que rechace lo que no es un entero de 0 a 100 sin mandarlo, que se vea desactivado
 * —en gris, con su ayuda— cuando no aplica o no hay permiso del pase, que al dejar de poder
 * editarse enseñe la guardada y no lo escrito, y que un fallo se diga con el aviso de siempre.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { VacantePanel } from '../api/tipos'
import {
  AYUDA_APAGADA,
  AYUDA_NOTA_MINIMA,
  FUERA_DE_RANGO,
  NO_SE_GUARDO,
  NotaMinimaDelPase,
  notaMinimaValida,
} from './NotaMinimaDelPase'

const fijarNotaMinima = vi.fn((_vacanteId: number, _nota: number) => Promise.resolve(undefined))

vi.mock('../api/panel', () => ({
  fijarNotaMinima: (vacanteId: number, nota: number) => fijarNotaMinima(vacanteId, nota),
}))

const VACANTE = {
  id: 4,
  estado: 'PUBLICADA',
  calificacionAutomatica: true,
  notaMinima: 60,
  puedeEditar: true,
  puedeConfigurarElPase: true,
} as unknown as VacantePanel

const alGuardar = vi.fn()
const alFallar = vi.fn()

function montar(cambios: Partial<VacantePanel> = {}) {
  return montarYCambiar(cambios).campo
}

/** Lo mismo, y una forma de que llegue otra vacante —la que deja el refresco— al mismo campo. */
function montarYCambiar(cambios: Partial<VacantePanel> = {}) {
  const datos = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const con = (vacante: VacantePanel) => (
    <QueryClientProvider client={datos}>
      <NotaMinimaDelPase vacante={vacante} alGuardar={alGuardar} alFallar={alFallar} />
    </QueryClientProvider>
  )
  const { rerender } = render(con({ ...VACANTE, ...cambios }))
  return {
    campo: screen.getByLabelText('Nota mínima para pasar el perfil integral') as HTMLInputElement,
    llega: (otros: Partial<VacantePanel>) => rerender(con({ ...VACANTE, ...cambios, ...otros })),
  }
}

beforeEach(() => {
  fijarNotaMinima.mockReset()
  fijarNotaMinima.mockResolvedValue(undefined)
  alGuardar.mockReset()
  alFallar.mockReset()
})
afterEach(cleanup)

describe('la nota mínima del pase', () => {
  it('trae la de la vacante, sobre 100, con su ayuda (AC-09)', () => {
    const campo = montar()

    expect(campo.value).toBe('60')
    expect(campo.disabled).toBe(false)
    expect(screen.getByText('/ 100')).toBeTruthy()
    expect(screen.getByText(AYUDA_NOTA_MINIMA)).toBeTruthy()
  })

  it('se guarda al salir del campo, y solo entonces', async () => {
    const campo = montar()

    fireEvent.change(campo, { target: { value: '75' } })
    expect(fijarNotaMinima).not.toHaveBeenCalled()
    fireEvent.blur(campo)

    await waitFor(() => expect(fijarNotaMinima).toHaveBeenCalledWith(4, 75))
    await waitFor(() => expect(alGuardar).toHaveBeenCalled())
  })

  it('los extremos 0 y 100 valen', async () => {
    const campo = montar()

    fireEvent.change(campo, { target: { value: '0' } })
    fireEvent.blur(campo)
    await waitFor(() => expect(fijarNotaMinima).toHaveBeenCalledWith(4, 0))
  })

  it('sin cambios no manda nada al salir', () => {
    const campo = montar()

    fireEvent.blur(campo)

    expect(fijarNotaMinima).not.toHaveBeenCalled()
  })

  it('fuera de rango o con decimales lo dice y no lo manda (AC-09)', () => {
    for (const malo of ['101', '-1', '70.5', '']) {
      cleanup()
      const campo = montar()
      fireEvent.change(campo, { target: { value: malo } })
      fireEvent.blur(campo)

      expect(screen.getByRole('alert').textContent).toBe(FUERA_DE_RANGO)
      expect(campo.getAttribute('aria-invalid')).toBe('true')
    }
    expect(fijarNotaMinima).not.toHaveBeenCalled()
  })

  it('encendida y abierta no lleva el gris de apagada', () => {
    const campo = montar()

    expect(campo.closest('div')!.className).not.toContain('notaMinimaApagada')
  })

  it('con el interruptor apagado se ve desactivado, en gris, y la ayuda dice por qué (QA-F01)', () => {
    const campo = montar({ calificacionAutomatica: false })

    expect(campo.disabled).toBe(true)
    expect(campo.value).toBe('60')
    expect(campo.closest('div')!.className).toContain('notaMinimaApagada')
    expect(screen.getByText(AYUDA_APAGADA)).toBeTruthy()
    expect(screen.queryByText(AYUDA_NOTA_MINIMA)).toBeNull()
    expect(campo.getAttribute('aria-invalid')).toBe('false')
  })

  it('con la vacante cerrada también, en gris, con la ayuda de siempre (QA-F01)', () => {
    const campo = montar({ estado: 'CERRADA' })

    expect(campo.disabled).toBe(true)
    expect(campo.closest('div')!.className).toContain('notaMinimaApagada')
    expect(screen.getByText(AYUDA_NOTA_MINIMA)).toBeTruthy()
  })

  it('cerrada y apagada, manda la ayuda de apagada', () => {
    montar({ estado: 'CERRADA', calificacionAutomatica: false })

    expect(screen.getByText(AYUDA_APAGADA)).toBeTruthy()
  })

  it('se habilita con el permiso del pase, no con el de editar la vacante', async () => {
    // RESPONSABLE_AREA: sin `editar_vacante` pero con el permiso del interruptor, que la API
    // hace cumplir en los dos. El campo no puede ser más estricto que la API.
    const campo = montar({ puedeEditar: false, puedeConfigurarElPase: true })

    expect(campo.disabled).toBe(false)
    expect(campo.closest('div')!.className).not.toContain('notaMinimaApagada')
    fireEvent.change(campo, { target: { value: '72' } })
    fireEvent.blur(campo)
    await waitFor(() => expect(fijarNotaMinima).toHaveBeenCalledWith(4, 72))
  })

  it('sin el permiso del pase se ve desactivado y en gris, con la guardada y la ayuda de siempre (QA-F03)', () => {
    // Casos límite de la spec: «sin permiso, el campo se ve desactivado». Aunque pueda editar
    // la vacante: el permiso que cuenta es el del interruptor.
    const campo = montar({ puedeEditar: true, puedeConfigurarElPase: false })

    expect(campo.disabled).toBe(true)
    expect(campo.value).toBe('60')
    expect(campo.closest('div')!.className).toContain('notaMinimaApagada')
    expect(screen.getByText(AYUDA_NOTA_MINIMA)).toBeTruthy()
    expect(campo.getAttribute('aria-invalid')).toBe('false')
    fireEvent.blur(campo)
    expect(fijarNotaMinima).not.toHaveBeenCalled()
  })

  it('sin el permiso del pase y con el interruptor apagado, manda la ayuda de apagada', () => {
    montar({ puedeConfigurarElPase: false, calificacionAutomatica: false })

    expect(screen.getByText(AYUDA_APAGADA)).toBeTruthy()
  })

  it('un permiso que no llega —un backend anterior— se lee como «no puede»', () => {
    const campo = montar({ puedeConfigurarElPase: undefined as unknown as boolean })

    expect(campo.disabled).toBe(true)
  })

  // QA-F02: lo que se escribió y no se guardó no sobrevive a que el campo deje de editarse.
  const alDejarDeEditarse: [string, Partial<VacantePanel>][] = [
    ['al apagar el interruptor', { calificacionAutomatica: false }],
    ['al cerrar la vacante', { estado: 'CERRADA' }],
    ['al perder el permiso del pase', { puedeConfigurarElPase: false }],
  ]
  for (const [cuando, cambio] of alDejarDeEditarse) {
    for (const malo of ['101', '']) {
      it(`${cuando}, enseña la guardada y no «${malo}» sin guardar, y el aviso se va (QA-F02)`, () => {
        const { campo, llega } = montarYCambiar({ notaMinima: 61 })
        fireEvent.change(campo, { target: { value: malo } })
        fireEvent.blur(campo)
        expect(screen.getByRole('alert').textContent).toBe(FUERA_DE_RANGO)

        llega(cambio)

        expect(campo.disabled).toBe(true)
        expect(campo.value).toBe('61')
        expect(screen.queryByRole('alert')).toBeNull()
        expect(campo.getAttribute('aria-invalid')).toBe('false')
        expect(fijarNotaMinima).not.toHaveBeenCalled()
      })
    }
  }

  it('al volver a poder editarse, sigue la guardada: lo descartado no vuelve (QA-F02)', () => {
    const { campo, llega } = montarYCambiar({ notaMinima: 61 })
    fireEvent.change(campo, { target: { value: '101' } })
    fireEvent.blur(campo)

    llega({ calificacionAutomatica: false })
    llega({ calificacionAutomatica: true })

    expect(campo.disabled).toBe(false)
    expect(campo.value).toBe('61')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('un valor válido escrito y sin salir del campo tampoco sobrevive al apagado, ni se manda (QA-F02)', () => {
    const { campo, llega } = montarYCambiar({ notaMinima: 61 })
    fireEvent.change(campo, { target: { value: '75' } })

    llega({ calificacionAutomatica: false })

    expect(campo.value).toBe('61')
    expect(fijarNotaMinima).not.toHaveBeenCalled()
  })

  it('cuando la guardada cambia —el refresco tras guardar—, enseña la nueva', () => {
    const { campo, llega } = montarYCambiar({ notaMinima: 61 })

    llega({ notaMinima: 75 })

    expect(campo.value).toBe('75')
  })

  it('mientras guarda se desactiva, pero sin el gris de apagada', async () => {
    let soltar: () => void = () => {}
    fijarNotaMinima.mockImplementationOnce(
      () => new Promise<undefined>((resolver) => (soltar = () => resolver(undefined))),
    )
    const campo = montar()

    fireEvent.change(campo, { target: { value: '80' } })
    fireEvent.blur(campo)

    await waitFor(() => expect(campo.disabled).toBe(true))
    expect(campo.closest('div')!.className).not.toContain('notaMinimaApagada')
    soltar()
    await waitFor(() => expect(campo.disabled).toBe(false))
  })

  it('si el servidor no la guarda, lo dice con el aviso de la configuración', async () => {
    fijarNotaMinima.mockRejectedValueOnce(new Error('Una vacante cerrada no se edita'))
    const campo = montar()

    fireEvent.change(campo, { target: { value: '65' } })
    fireEvent.blur(campo)

    await waitFor(() =>
      expect(alFallar).toHaveBeenCalledWith(`${NO_SE_GUARDO}: Una vacante cerrada no se edita`),
    )
    expect(alGuardar).not.toHaveBeenCalled()
  })

  it('sin la nota en la vacante —un backend anterior—, la de por defecto', () => {
    const campo = montar({ notaMinima: undefined as unknown as number })

    expect(campo.value).toBe('60')
  })
})

describe('qué cuenta como nota mínima', () => {
  it('un entero de 0 a 100, y nada más', () => {
    expect(notaMinimaValida('60')).toBe(60)
    expect(notaMinimaValida(' 0 ')).toBe(0)
    expect(notaMinimaValida('100')).toBe(100)
    expect(notaMinimaValida('100.5')).toBeNull()
    expect(notaMinimaValida('59.99')).toBeNull()
    expect(notaMinimaValida('-1')).toBeNull()
    expect(notaMinimaValida('')).toBeNull()
    expect(notaMinimaValida('sesenta')).toBeNull()
  })
})
