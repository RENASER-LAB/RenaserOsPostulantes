/**
 * La barra fija del marco: el hueco del tiempo solo existe si hay tiempo que enseñar.
 *
 * La evaluación del Perfil Integral ya no lleva plazo (V78) y le pasa `tiempo={null}`. Si el
 * contenedor se dibujaba igual, vacío, ocupaba un sitio de la fila con su separación y
 * «Pregunta N de M» se corría a la derecha de la barra de progreso y de «Volver» (QA-03). La
 * prueba del puesto sí trae su reloj, y ahí la barra no cambia.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { createRef, type ReactNode } from 'react'
import { BarraDelMarco } from './Marco'

afterEach(cleanup)

function montarBarra(tiempo: ReactNode, tiempoPoco = false) {
  return render(
    <BarraDelMarco
      refBarra={createRef<HTMLDivElement>()}
      tiempo={tiempo}
      tiempoPoco={tiempoPoco}
      donde="Pregunta 1 de 5"
      faltan={5}
      mapa={{
        abierto: false,
        preguntas: 5,
        alPulsar: () => undefined,
        refBoton: createRef<HTMLButtonElement>(),
        controla: 'mapa',
      }}
    />,
  )
}

/** La fila de datos: el tiempo (si lo hay), «Pregunta N de M» y lo que falta. */
function filaDeDatos() {
  return screen.getByText('Pregunta 1 de 5').parentElement!
}

describe('BarraDelMarco · el tiempo', () => {
  it.each([
    ['nulo', null],
    ['omitido', undefined],
    ['falso', false],
  ])('sin tiempo (%s) no dibuja su contenedor: «Pregunta N de M» abre la fila', (_, tiempo) => {
    const { container } = montarBarra(tiempo)

    expect(container.querySelector('[class*="tiempo"]')).toBeNull()
    const fila = filaDeDatos()
    expect(fila.children).toHaveLength(2)
    expect(fila.firstElementChild?.textContent).toBe('Pregunta 1 de 5')
    expect(fila.lastElementChild?.textContent).toBe('Te faltan 5 por terminar')
  })

  it('con tiempo lo dibuja delante, como en la prueba del puesto', () => {
    const { container } = montarBarra(<span>00:42:17</span>)

    const tiempo = container.querySelector('[class*="tiempo"]')
    expect(tiempo).not.toBeNull()
    expect(tiempo?.textContent).toBe('00:42:17')
    expect(tiempo?.className).not.toMatch(/poco/)
    const fila = filaDeDatos()
    expect(fila.children).toHaveLength(3)
    expect(fila.firstElementChild).toBe(tiempo)
  })

  it('con poco tiempo lo pone en rojo', () => {
    const { container } = montarBarra('00:09:59', true)

    const tiempo = container.querySelector('[class*="tiempo"]')
    expect(tiempo?.textContent).toBe('00:09:59')
    expect(tiempo?.className).toMatch(/poco/)
  })
})
