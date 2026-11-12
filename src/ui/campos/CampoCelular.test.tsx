/**
 * El campo del celular con su máscara, como lo usa una persona: tecla a tecla, con
 * el retroceso, pegando y pasando a un número de otro país y vuelta. Lo heredan el
 * registro, «Mi cuenta», la tarjeta de WhatsApp y la ficha del colaborador.
 */

import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CampoCelular } from './CampoCelular'

afterEach(cleanup)

const MENSAJE = 'Escribe un celular de 9 cifras que empiece por 9, o el número completo con su prefijo'

function Probador({ inicial = '', antiguo, error }: { inicial?: string; antiguo?: string | null; error?: string }) {
  const [valor, setValor] = useState(inicial)
  return (
    <>
      <CampoCelular etiqueta="Celular" valor={valor} alCambiar={setValor} antiguo={antiguo} error={error} />
      <output data-testid="guardado">{valor}</output>
    </>
  )
}

const campo = () => screen.getByLabelText('Celular') as HTMLInputElement
const prefijo = () => campo().parentElement?.querySelector('[aria-hidden="true"]')?.textContent ?? null

describe('el campo del celular', () => {
  it('AC-01 · tecla a tecla queda «987 654 321», y la décima cifra no se escribe', async () => {
    const usuario = userEvent.setup()
    render(<Probador />)
    await usuario.type(campo(), '9876543210')
    expect(campo().value).toBe('987 654 321')
    expect(screen.getByTestId('guardado').textContent).toBe('987 654 321')
  })

  it('AC-02 · letras, guiones, puntos y paréntesis no se escriben', async () => {
    const usuario = userEvent.setup()
    render(<Probador />)
    await usuario.type(campo(), '9a8-7.6(5)4')
    expect(campo().value).toBe('987 654')
  })

  it('teclado de teléfono, «+51» delante y anunciado al lector de pantalla', () => {
    render(<Probador />)
    expect(campo().type).toBe('tel')
    expect(campo().inputMode).toBe('tel')
    expect(prefijo()).toBe('+51')
    const descripcion = (campo().getAttribute('aria-describedby') ?? '')
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent)
      .join(' ')
    expect(descripcion).toContain('+51')
  })

  it('el retroceso detrás de un espacio borra una sola cifra y el cursor no salta al final', async () => {
    const usuario = userEvent.setup()
    render(<Probador inicial="987 654 321" />)
    // «987 |654 321»
    await usuario.click(campo())
    campo().setSelectionRange(4, 4)
    await usuario.keyboard('{Backspace}')
    expect(campo().value).toBe('986 543 21')
    expect(campo().selectionStart).toBe(2)
  })

  it('una cifra escrita en medio no manda el cursor al final', async () => {
    const usuario = userEvent.setup()
    render(<Probador inicial="987 654 32" />)
    await usuario.click(campo())
    campo().setSelectionRange(5, 5)
    await usuario.keyboard('0')
    expect(campo().value).toBe('987 605 432')
    expect(campo().selectionStart).toBe(6)
  })

  it('AC-03 · lo pegado se limpia: «+51 987 654 321» queda «987 654 321»', async () => {
    const usuario = userEvent.setup()
    render(<Probador />)
    await usuario.click(campo())
    await usuario.paste('+51 987 654 321')
    expect(campo().value).toBe('987 654 321')
    expect(screen.queryByText(MENSAJE)).toBeNull()
  })

  it('AC-04 · lo que no es un celular no cambia el campo y dice el mensaje de la regla', async () => {
    const usuario = userEvent.setup()
    render(<Probador inicial="987" />)
    await usuario.click(campo())
    await usuario.paste('12345678901234567')
    expect(campo().value).toBe('987')
    expect(screen.getByText(MENSAJE)).toBeTruthy()
    expect(campo().getAttribute('aria-invalid')).toBe('true')

    // En cuanto escribe algo que sí entra, el mensaje se va.
    await usuario.type(campo(), '6')
    expect(campo().value).toBe('987 6')
    expect(screen.queryByText(MENSAJE)).toBeNull()
  })

  it('un error nuevo de quien usa el campo tapa el mensaje del pegado', async () => {
    const usuario = userEvent.setup()
    const { rerender } = render(<Probador />)
    await usuario.click(campo())
    await usuario.paste('hola')
    expect(screen.getByText(MENSAJE)).toBeTruthy()
    rerender(<Probador error="Escribe tu celular." />)
    expect(screen.getByText('Escribe tu celular.')).toBeTruthy()
    expect(screen.queryByText(MENSAJE)).toBeNull()
  })

  it('AC-05 · con «+» delante el «+51» desaparece sin perder el foco, y vuelve al borrar el «+»', async () => {
    const usuario = userEvent.setup()
    render(<Probador />)
    await usuario.type(campo(), '+34 612 345 678')
    expect(campo().value).toBe('+34 612 345 678')
    expect(prefijo()).toBeNull()
    expect(document.activeElement).toBe(campo())

    campo().setSelectionRange(1, 1)
    await usuario.keyboard('{Backspace}')
    expect(campo().value).toBe('346 123 456 78')
    expect(prefijo()).toBe('+51')
    expect(document.activeElement).toBe(campo())
  })

  it('«00» se convierte en «+»', async () => {
    const usuario = userEvent.setup()
    render(<Probador />)
    await usuario.type(campo(), '0034')
    expect(campo().value).toBe('+34')
    expect(prefijo()).toBeNull()
  })

  it('no lleva tope de caracteres: un pegado largo no lo corta el navegador antes de leerlo', () => {
    render(<Probador />)
    expect(campo().maxLength).toBe(-1)
  })

  describe('con un celular de antes de la regla', () => {
    it('lo enseña tal cual, sin «+51», y en cuanto se toca aplica la máscara', async () => {
      const usuario = userEvent.setup()
      render(<Probador inicial="01-4567890" antiguo="01-4567890" />)
      expect(campo().value).toBe('01-4567890')
      expect(prefijo()).toBeNull()

      await usuario.click(campo())
      await usuario.keyboard('{End}{Backspace}')
      expect(campo().value).toBe('014 567 89')
      expect(prefijo()).toBe('+51')
    })

    it('se puede vaciar', async () => {
      const usuario = userEvent.setup()
      render(<Probador inicial="01-4567890" antiguo="01-4567890" />)
      await usuario.clear(campo())
      expect(campo().value).toBe('')
      expect(screen.getByTestId('guardado').textContent).toBe('')
    })
  })
})
