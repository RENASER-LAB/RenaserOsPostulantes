/**
 * El texto de la consigna no se pierde ni se convierte en HTML.
 *
 * Dos cosas que compilan igual de bien estando mal y que solo se ven mirando lo
 * pintado:
 *
 *   1. Partir el texto para sacar los enlaces y comerse un trozo por el camino.
 *      El candidato leeria una consigna incompleta sin enterarse.
 *   2. Que algo guardado en la base acabe siendo etiquetas de verdad, o que una
 *      direccion `javascript:` acabe en un `href`.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { TextoPlano } from './TextoPlano'

afterEach(cleanup)

describe('TextoPlano', () => {
  it('conserva todo el texto alrededor de un enlace', () => {
    const { container } = render(
      <TextoPlano texto="Lee https://ejemplo.com/reto.pdf antes de empezar." />,
    )
    expect(container.textContent).toBe('Lee Abrir el documento (PDF) antes de empezar.')
  })

  it('separa los parrafos y respeta los saltos sueltos', () => {
    const { container } = render(<TextoPlano texto={'Uno\nsigue uno.\n\nDos.'} />)
    const parrafos = container.querySelectorAll('p')
    expect(parrafos).toHaveLength(2)
    expect(parrafos[0]?.textContent).toBe('Uno\nsigue uno.')
  })

  it('el PDF se abre en otra pestaña y con un nombre que se entiende', () => {
    render(
      <TextoPlano
        texto="El enunciado esta en https://sb.co/storage/v1/prueba.pdf?token=abc"
        queEs="el enunciado de la prueba"
      />,
    )
    const enlace = screen.getByRole('link', { name: 'Abrir el enunciado de la prueba (PDF)' })
    expect(enlace.getAttribute('href')).toBe('https://sb.co/storage/v1/prueba.pdf?token=abc')
    expect(enlace.getAttribute('target')).toBe('_blank')
    expect(enlace.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('no deja que el texto de la base se vuelva HTML ni un enlace raro', () => {
    const { container } = render(
      <TextoPlano texto={'<script>alert(1)</script> y javascript:alert(2)'} />,
    )
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelectorAll('a')).toHaveLength(0)
    expect(container.textContent).toContain('<script>alert(1)</script>')
  })

  it('el punto final de la frase no se lleva dentro del enlace', () => {
    render(<TextoPlano texto="Mira https://ejemplo.com/a." />)
    expect(screen.getByRole('link').getAttribute('href')).toBe('https://ejemplo.com/a')
  })
})
