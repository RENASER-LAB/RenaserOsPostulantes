/**
 * El alto de la cabecera del panel (QA-PP-01): se mide y se deja en
 * `--alto-cabecera-panel`, para que el balance del editor se pegue DEBAJO de
 * ella y no detrás. Se rehace cuando la cabecera cambia de alto (en el teléfono
 * la navegación baja a una segunda línea).
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { useAltoDeLaCabecera, VARIABLE_ALTO_CABECERA } from './altoDeLaCabecera'

let avisar: (() => void) | null = null
const desconectar = vi.fn()

class ObservadorDePrueba {
  constructor(alCambiar: () => void) {
    avisar = alCambiar
  }
  observe() {}
  disconnect() {
    desconectar()
  }
}

function Armazon() {
  const medir = useAltoDeLaCabecera()
  return (
    <div data-testid="armazon">
      <header ref={medir}>Cabecera</header>
    </div>
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  avisar = null
})

describe('el alto de la cabecera del panel', () => {
  it('se deja medido en el armazón y se rehace al cambiar', () => {
    vi.stubGlobal('ResizeObserver', ObservadorDePrueba)
    let alto = 63
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      () => ({ height: alto }) as DOMRect,
    )
    const { getByTestId, unmount } = render(<Armazon />)
    const armazon = getByTestId('armazon')
    expect(armazon.style.getPropertyValue(VARIABLE_ALTO_CABECERA)).toBe('63px')

    // El teléfono: la navegación baja a una segunda línea.
    alto = 122.4
    avisar?.()
    expect(armazon.style.getPropertyValue(VARIABLE_ALTO_CABECERA)).toBe('123px')

    unmount()
    expect(desconectar).toHaveBeenCalled()
  })

  it('sin ResizeObserver, al menos la primera medida', () => {
    vi.stubGlobal('ResizeObserver', undefined)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      () => ({ height: 70 }) as DOMRect,
    )
    const { getByTestId } = render(<Armazon />)
    expect(getByTestId('armazon').style.getPropertyValue(VARIABLE_ALTO_CABECERA)).toBe('70px')
  })
})
