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
import { cleanup, render, screen, within } from '@testing-library/react'
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

  it('los enlaces se tabulan salvo que se pida lo contrario, y siguen siendo enlaces', () => {
    const { rerender } = render(<TextoPlano texto="Mira https://ejemplo.com/a y https://ejemplo.com/b" />)
    expect(screen.getAllByRole('link').map((a) => a.hasAttribute('tabindex'))).toEqual([false, false])
    rerender(<TextoPlano texto="Mira https://ejemplo.com/a y https://ejemplo.com/b" enlacesTabulables={false} />)
    const enlaces = screen.getAllByRole('link')
    expect(enlaces.map((a) => a.getAttribute('tabindex'))).toEqual(['-1', '-1'])
    expect(enlaces.map((a) => a.getAttribute('href'))).toEqual(['https://ejemplo.com/a', 'https://ejemplo.com/b'])
  })

  describe('las listas', () => {
    const CON_LISTA = 'Lo que tienes:\n- el mayor de marzo\n• el extracto del banco\n* las notas del contador'

    it('sin pedirlas, los guiones siguen siendo texto dentro del párrafo, como siempre', () => {
      const { container } = render(<TextoPlano texto={CON_LISTA} />)
      expect(container.querySelectorAll('ul, ol')).toHaveLength(0)
      expect(container.querySelector('p')?.textContent).toBe(CON_LISTA)
    })

    it('con «- », «• » o «* » es una lista de verdad, y la frase de antes, su párrafo', () => {
      const { container } = render(<TextoPlano texto={CON_LISTA} listas className="lectura" />)
      expect([...container.children].map((e) => e.tagName)).toEqual(['P', 'UL'])
      expect(container.querySelector('p')?.textContent).toBe('Lo que tienes:')
      const lista = screen.getByRole('list')
      expect(within(lista).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
        'el mayor de marzo',
        'el extracto del banco',
        'las notas del contador',
      ])
      // Con la letra del párrafo: la clase de la pantalla va también en la lista.
      expect(lista.className).toContain('lectura')
    })

    it('«1. », «2. »… es una lista numerada que empieza en su número', () => {
      const { container } = render(<TextoPlano texto={'Pasos:\n3. concilia\n4. ajusta'} listas />)
      const lista = container.querySelector('ol')!
      expect(lista.getAttribute('start')).toBe('3')
      expect([...lista.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['concilia', 'ajusta'])
      expect(container.querySelectorAll('ul')).toHaveLength(0)
    })

    it('una lista que empieza en 1 no repite su inicio, y un año seguido de punto no es lista', () => {
      const { container } = render(<TextoPlano texto={'1. uno\n2. dos\n\n2026. Fue un buen año.'} listas />)
      expect(container.querySelector('ol')!.hasAttribute('start')).toBe(false)
      expect(container.querySelectorAll('p')[0]?.textContent).toBe('2026. Fue un buen año.')
    })

    it('la prosa de después cierra la lista; una línea sangrada continúa su elemento', () => {
      const { container } = render(
        <TextoPlano texto={'- primero\n  sigue el primero\n- segundo\nY ahora prosa.\n1. otra'} listas />,
      )
      expect([...container.children].map((e) => e.tagName)).toEqual(['UL', 'P', 'OL'])
      expect([...container.querySelectorAll('ul li')].map((li) => li.textContent)).toEqual([
        'primero\nsigue el primero',
        'segundo',
      ])
      expect(container.querySelector('p')?.textContent).toBe('Y ahora prosa.')
    })

    it('un guion sin espacio no es lista, y el enlace de un elemento sigue siendo enlace', () => {
      render(<TextoPlano texto={'-5 °C en la cámara\n- el plan: https://ejemplo.com/plan.pdf'} listas />)
      expect(screen.getByText('-5 °C en la cámara').tagName).toBe('P')
      const enlace = within(screen.getByRole('listitem')).getByRole('link', { name: 'Abrir el documento (PDF)' })
      expect(enlace.getAttribute('href')).toBe('https://ejemplo.com/plan.pdf')
    })
  })

  it('el punto final de la frase no se lleva dentro del enlace', () => {
    render(<TextoPlano texto="Mira https://ejemplo.com/a." />)
    expect(screen.getByRole('link').getAttribute('href')).toBe('https://ejemplo.com/a')
  })
})
