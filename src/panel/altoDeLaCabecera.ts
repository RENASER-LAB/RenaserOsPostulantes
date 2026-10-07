/**
 * El alto de la cabecera del panel, medido, en `--alto-cabecera-panel`.
 *
 * La cabecera es `sticky` con `z-index: 10`, y lo que una pantalla quiera pegar
 * arriba —el balance del editor de preguntas— tiene que pegarse DEBAJO de ella,
 * no a 12 px del borde, o se esconde detrás al bajar.
 *
 * ⚠️ **Se mide, no se escribe.** Mide 63 px en escritorio y 123 px en un
 * teléfono de 375, donde la navegación baja a una segunda línea; y el ancho en
 * que salta depende de cuántos enlaces haya. Un número fijo en la hoja se
 * quedaría viejo al añadir el próximo enlace, que es lo que ya le pasó a
 * `--alto-cabecera` del portal. El `ResizeObserver` lo rehace al girar el
 * teléfono o al cambiar el ancho de la ventana.
 *
 * La variable se deja en el padre de la cabecera (el armazón), así que la
 * heredan todas las pantallas del panel y desaparece con él.
 */

import { useCallback, useRef } from 'react'

export const VARIABLE_ALTO_CABECERA = '--alto-cabecera-panel'

export function useAltoDeLaCabecera(): (cabecera: HTMLElement | null) => void {
  return useAltoEnUnaVariable(VARIABLE_ALTO_CABECERA)
}

/**
 * Lo mismo para cualquier pieza pegada arriba: mide su alto y lo deja en
 * `variable`, en su padre. La usa también la cabecera fija de los editores
 * (`--alto-cabecera-fija`), que crece con las faltas.
 */
export function useAltoEnUnaVariable(variable: string): (pieza: HTMLElement | null) => void {
  const observador = useRef<ResizeObserver | null>(null)

  return useCallback(
    (pieza: HTMLElement | null) => {
      observador.current?.disconnect()
      observador.current = null
      const raiz = pieza?.parentElement
      if (!pieza || !raiz) return

      const medir = () =>
        raiz.style.setProperty(variable, `${Math.ceil(pieza.getBoundingClientRect().height)}px`)
      medir()
      if (typeof ResizeObserver === 'undefined') return
      observador.current = new ResizeObserver(medir)
      observador.current.observe(pieza)
    },
    [variable],
  )
}
