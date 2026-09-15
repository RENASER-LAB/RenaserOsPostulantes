/**
 * Lo que compila perfectamente estando mal en el modal compartido.
 *
 *   0. **Reenfocar en cada render.** Es el fallo que trajo este archivo, y no se
 *      ve leyendo el componente: el efecto que pone el foco, atrapa el tabulador
 *      y bloquea el scroll llevaba `onCerrar` en sus dependencias. Quien usa el
 *      modal le pasa casi siempre una funcion declarada dentro de su propio
 *      componente —una funcion **distinta en cada render**—, asi que el efecto
 *      se limpiaba y se volvia a montar cada vez que el padre se renderizaba.
 *
 *      Y ese efecto mueve el foco: su limpieza lo devuelve a donde estaba antes
 *      de abrir, y su cuerpo lo lleva al primer enfocable del modal, que es el
 *      aspa. En un modal con un campo de texto eso significa que **cada tecla
 *      mandaba el foco al aspa**: se escribia una letra y el campo se quedaba
 *      sin poder recibir la segunda. Lo encontro una persona probando a mano.
 *
 *      ⚠️ **Un test que pase `onCerrar` estable NO lo detecta.** Con
 *      `const cerrar = vi.fn()` fuera del render, la identidad no cambia, el
 *      efecto no se remonta y el fallo no aparece. Por eso los casos de aqui
 *      montan un padre **real** que declara su `onCerrar` dentro, que es como lo
 *      usa todo el proyecto.
 *   1. **Dejar de escuchar Escape.** Sacar `onCerrar` de las dependencias sin
 *      ponerlo en un ref congela la primera version: Escape seguiria llamando a
 *      la de hace veinte renders, que ya no ve el estado de ahora.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { Modal } from './Modal'

afterEach(cleanup)

/**
 * Un padre como los de verdad: con estado propio, y con el `onCerrar` declarado
 * DENTRO —que es lo que hace que su identidad cambie en cada render—.
 */
function PadreConCampo({ alCerrar = () => {} }: { alCerrar?: () => void }) {
  const [texto, setTexto] = useState('')
  return (
    <Modal
      abierto
      titulo="Un modal con campo"
      onCerrar={() => alCerrar()}
      pie={<button type="button">Confirmar</button>}
    >
      <label htmlFor="campo">Escribe algo</label>
      <textarea id="campo" value={texto} onChange={(e) => setTexto(e.target.value)} />
    </Modal>
  )
}

describe('escribir dentro de un modal', () => {
  it('el foco se queda en el campo tecla tras tecla, y no salta al aspa', () => {
    render(<PadreConCampo />)
    const campo = screen.getByLabelText('Escribe algo')
    campo.focus()

    // Tres teclas, una a una: cada `change` re-renderiza al padre, que es
    // exactamente lo que remontaba el efecto del modal.
    for (const valor of ['a', 'ab', 'abc']) {
      fireEvent.change(campo, { target: { value: valor } })
      expect(document.activeElement).toBe(campo)
    }

    expect((campo as HTMLTextAreaElement).value).toBe('abc')
    // Y el aspa, que es el primer enfocable del modal, no se quedó el foco.
    expect(document.activeElement).not.toBe(screen.getByRole('button', { name: 'Cerrar' }))
  })

  it('Escape sigue cerrando después de que el padre se haya renderizado de nuevo', () => {
    // La otra mitad del arreglo: con `onCerrar` fuera de las dependencias y sin
    // ref, el manejador se quedaría con la primera versión de la función.
    const alCerrar = vi.fn()
    render(<PadreConCampo alCerrar={alCerrar} />)
    fireEvent.change(screen.getByLabelText('Escribe algo'), { target: { value: 'algo' } })

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(alCerrar).toHaveBeenCalledTimes(1)
  })

  it('al abrir, el foco entra en el modal', () => {
    // Lo que el efecto sí tiene que hacer, y solo entonces: al abrir.
    render(<PadreConCampo />)
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true)
  })
})
