import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Marca } from './Marca'
import logotipo from './logotipo.png'

/**
 * El logotipo es un PNG pintado como mascara: aqui se comprueba lo que no
 * depende de pintarlo —su nombre, su caja y de donde sale el dibujo—. El color
 * calculado, la nitidez y los colores forzados necesitan un navegador y viven
 * en `herramientas/e2e/41-logotipo.spec.ts`.
 */
describe('Marca', () => {
  afterEach(cleanup)

  it('se anuncia como una imagen llamada «EX»', () => {
    render(<Marca />)
    expect(screen.getByRole('img', { name: 'EX' })).toBeTruthy()
  })

  it('ya no es la palabra con la hormiga: ni texto ni SVG', () => {
    const { container } = render(<Marca />)
    expect(container.textContent).toBe('')
    expect(container.querySelector('svg')).toBeNull()
    expect(container.querySelector('.marca-letras, .marca-hormiga')).toBeNull()
  })

  it('`tamano` es el alto del dibujo y el ancho sale de la proporcion del archivo', () => {
    render(<Marca tamano={56} />)
    const marca = screen.getByRole('img', { name: 'EX' })
    expect(marca.style.height).toBe('56px')
    // 56 × 808 / 714 = 63,37…
    expect(marca.style.width).toBe('63.37px')
  })

  it('sin `tamano` mide 28 px de alto, lo de la cabecera y la invitacion', () => {
    render(<Marca />)
    const marca = screen.getByRole('img', { name: 'EX' })
    expect(marca.style.height).toBe('28px')
    expect(marca.style.width).toBe('31.69px')
  })

  it('pinta el archivo importado como mascara, con y sin prefijo', () => {
    render(<Marca />)
    const marca = screen.getByRole('img', { name: 'EX' })
    const esperado = `url("${logotipo}")`
    expect(marca.style.getPropertyValue('mask-image')).toBe(esperado)
    expect(marca.style.getPropertyValue('-webkit-mask-image')).toBe(esperado)
    // El color lo pone la hoja global —`currentColor`—, no el componente.
    expect(marca.className).toBe('marca')
    expect(marca.style.color).toBe('')
  })

  it('dentro de un enlace con su propia etiqueta, manda la del enlace', () => {
    render(
      <a href="/" aria-label="EX, inicio">
        <Marca />
      </a>,
    )
    expect(screen.getByRole('link', { name: 'EX, inicio' })).toBeTruthy()
  })

  it('dentro de un envoltorio `aria-hidden` sigue oculta', () => {
    render(
      <span aria-hidden="true">
        <Marca tamano={36} />
      </span>,
    )
    expect(screen.queryByRole('img', { name: 'EX' })).toBeNull()
  })

  it('ninguna otra pieza conoce el archivo: todas pasan por `Marca`', () => {
    // Vitest corre desde la raiz del portal, como `vitest.config.ts`.
    const src = resolve(process.cwd(), 'src')
    const propias = new Set(['ui/Marca.tsx', 'ui/Marca.test.tsx'])
    const conocen = readdirSync(src, { recursive: true, encoding: 'utf8' })
      .map((ruta) => ruta.replaceAll('\\', '/'))
      .filter((ruta) => /\.(ts|tsx|css)$/.test(ruta) && !propias.has(ruta))
      .filter((ruta) => readFileSync(`${src}/${ruta}`, 'utf8').includes('logotipo.png'))
    expect(conocen).toEqual([])
  })
})
