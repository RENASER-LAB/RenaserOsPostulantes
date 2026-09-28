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
 *   2. **Apuntar el foco de vuelta en el efecto (RES-QA-05).** Los efectos del
 *      contenido corren antes que el del modal: un formulario que enfoca su
 *      primer campo al montarse ya se habia llevado el foco cuando el modal
 *      leia «quien lo tenia». Guardaba ese campo y, al cerrar, devolvia el foco
 *      a un control desmontado: `<body>`. Los casos de aqui abren desde un
 *      boton de verdad, con un contenido que se enfoca solo.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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

/**
 * Un disparador de verdad y un modal cuyo contenido se enfoca solo al montarse,
 * como los pasos de reportar (`useLayoutEffect`) y de responder (`useEffect`).
 */
function Contenido({ como }: { como: 'layout' | 'efecto' | 'nada' }) {
  const campo = useRef<HTMLInputElement>(null)
  useLayoutEffect(() => {
    if (como === 'layout') campo.current?.focus()
  }, [como])
  useEffect(() => {
    if (como === 'efecto') campo.current?.focus()
  }, [como])
  return (
    <label>
      Primer campo
      <input ref={campo} />
    </label>
  )
}

function ConDisparador({ como, montarAbierto = false }: { como: 'layout' | 'efecto' | 'nada'; montarAbierto?: boolean }) {
  const [abierto, setAbierto] = useState(false)
  const cerrar = () => setAbierto(false)
  const modal = (
    <Modal
      abierto={montarAbierto || abierto}
      titulo="Un paso"
      onCerrar={cerrar}
      pie={
        <button type="button" onClick={cerrar}>
          Volver
        </button>
      }
    >
      <Contenido como={como} />
    </Modal>
  )
  return (
    <>
      <button type="button" onClick={() => setAbierto(true)}>
        Abrir
      </button>
      <button type="button">Otro de la página</button>
      {/* Montado solo al abrir, como los modales que se pintan con `&&`. */}
      {montarAbierto ? abierto && modal : modal}
    </>
  )
}

function abrirDesdeElBoton() {
  const abrir = screen.getByRole('button', { name: 'Abrir' })
  abrir.focus()
  fireEvent.click(abrir)
  return abrir
}

const CIERRES = {
  Escape: () => fireEvent.keyDown(document, { key: 'Escape' }),
  aspa: () => fireEvent.click(screen.getByRole('button', { name: 'Cerrar' })),
  fondo: () => fireEvent.click(screen.getByRole('dialog').previousElementSibling!),
  Volver: () => fireEvent.click(screen.getByRole('button', { name: 'Volver' })),
} as const

describe('adónde vuelve el foco al cerrar (RES-QA-05)', () => {
  for (const como of ['layout', 'efecto'] as const) {
    for (const [cierre, cerrar] of Object.entries(CIERRES)) {
      it(`con un campo que se enfoca solo (${como}), ${cierre} devuelve el foco al botón que abrió`, () => {
        render(<ConDisparador como={como} />)
        const abrir = abrirDesdeElBoton()
        // Al abrir, el campo que se enfocó solo se queda el foco: el aspa no se lo quita.
        expect(document.activeElement).toBe(screen.getByLabelText('Primer campo'))

        act(() => cerrar())
        expect(screen.queryByRole('dialog')).toBeNull()
        expect(document.activeElement).toBe(abrir)
      })
    }
  }

  it('sin nada que se enfoque solo, el foco entra por el aspa y vuelve al botón', () => {
    render(<ConDisparador como="nada" />)
    const abrir = abrirDesdeElBoton()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cerrar' }))

    act(() => CIERRES.Escape())
    expect(document.activeElement).toBe(abrir)
  })

  it('un modal que se monta ya abierto también sabe a quién volver', () => {
    render(<ConDisparador como="layout" montarAbierto />)
    const abrir = abrirDesdeElBoton()
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true)

    act(() => CIERRES.aspa())
    expect(document.activeElement).toBe(abrir)
  })

  it('abrir dos veces seguidas vuelve cada vez al botón, no al campo de la vez anterior', () => {
    render(<ConDisparador como="layout" />)
    for (let vez = 0; vez < 2; vez++) {
      const abrir = abrirDesdeElBoton()
      act(() => CIERRES.fondo())
      expect(document.activeElement).toBe(abrir)
    }
  })
})
