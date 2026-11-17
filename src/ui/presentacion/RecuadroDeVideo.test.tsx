import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { RecuadroDeVideo } from './RecuadroDeVideo'

afterEach(cleanup)

describe('el recuadro del video', () => {
  it('AC-10: no carga nada de YouTube hasta pulsar; luego el reproductor sin cookies', () => {
    const { container } = render(
      <RecuadroDeVideo
        video={{ servicio: 'YOUTUBE', identificador: 'abc123DEF45', enlace: 'https://www.youtube.com/watch?v=abc123DEF45' }}
        empresa="Molinos del Sur"
        titulo="Conoce a Molinos del Sur"
      />,
    )
    expect(container.querySelector('iframe')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('Conoce a Molinos del Sur')).toBeTruthy()

    const fuera = screen.getByRole('link', { name: 'Ver en YouTube' })
    expect(fuera.getAttribute('href')).toBe('https://www.youtube.com/watch?v=abc123DEF45')
    expect(fuera.getAttribute('target')).toBe('_blank')
    expect(fuera.getAttribute('rel')).toBe('noopener noreferrer')

    fireEvent.click(screen.getByRole('button', { name: 'Reproducir el video de Molinos del Sur' }))
    const reproductor = container.querySelector('iframe')!
    expect(reproductor.getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/abc123DEF45?autoplay=1&rel=0')
    expect(reproductor.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin')
    expect(reproductor.getAttribute('allow')).toBe('autoplay; fullscreen; picture-in-picture; encrypted-media')
    // El enlace de fuera sigue debajo.
    expect(screen.getByRole('link', { name: 'Ver en YouTube' })).toBeTruthy()
  })

  it('AC-11 · QA-PROP-02: el video oculto de Vimeo se reproduce con su clave, dnt=1 y el permiso encrypted-media', () => {
    const { container } = render(
      <RecuadroDeVideo
        video={{ servicio: 'VIMEO', identificador: '123456789', clave: 'abcdef1234', enlace: 'x' }}
        empresa="Molinos del Sur"
      />,
    )
    expect(screen.getByRole('link', { name: 'Ver en Vimeo' }).getAttribute('href')).toBe('https://vimeo.com/123456789/abcdef1234')
    fireEvent.click(screen.getByRole('button', { name: /Reproducir/ }))
    const reproductor = container.querySelector('iframe')!
    expect(reproductor.getAttribute('src')).toBe('https://player.vimeo.com/video/123456789?autoplay=1&dnt=1&h=abcdef1234')
    // Sin encrypted-media el reproductor de Vimeo se queda en negro en 00:00.
    const permisos = reproductor.getAttribute('allow')!.split(';').map((p) => p.trim())
    expect(permisos).toEqual(['autoplay', 'fullscreen', 'picture-in-picture', 'encrypted-media'])
    expect(reproductor.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin')
  })

  it('con unas piezas que no valen no pinta nada', () => {
    const { container } = render(
      <RecuadroDeVideo video={{ servicio: 'YOUTUBE', identificador: '"><x', enlace: 'x' }} empresa="Acme" />,
    )
    expect(container.innerHTML).toBe('')
  })
})
