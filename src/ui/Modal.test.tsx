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
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { GRACIA_TRAS_ABRIR_MS, MARGEN_DEL_ESCUDO_MS, Modal } from './Modal'

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

/**
 * 3. **El doble clic que abre y cierra (QA-UPP-13) o que empieza sin confirmar (QA-UPP-14).** El
 *    segundo clic de un doble clic en el botón que abre el modal cae en lo que haya quedado debajo:
 *    el fondo lo cerraba; en el teléfono, un botón del pie —«Aún no» lo cerraba y «Sí, empezar»
 *    arrancaba el reloj sin leer nada—. Con `aPruebaDeDobleClic` **todo el modal** ignora, por
 *    puntero, la continuación de una serie (`detail` > 1) y toda pulsación que empiece en sus
 *    primeros `GRACIA_TRAS_ABRIR_MS`; el teclado (`detail` 0) y Escape van al instante. Sin la marca,
 *    nada cambia: hay modales del panel que se cierran por el fondo nada más abrirse.
 */
describe('aPruebaDeDobleClic: nada del modal responde al puntero que sigue al clic que lo abrió (QA-UPP-13 y 14)', () => {
  let ahora = 10_000
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  function ConBoton({ aPrueba, alEmpezar = () => {} }: { aPrueba: boolean; alEmpezar?: () => void }) {
    const [abierto, setAbierto] = useState(false)
    return (
      <>
        <button type="button" onClick={() => setAbierto(true)}>
          Abrir
        </button>
        <Modal
          abierto={abierto}
          titulo="¿Empezar ahora?"
          onCerrar={() => setAbierto(false)}
          aPruebaDeDobleClic={aPrueba}
          pie={
            <>
              <button type="button" onClick={() => setAbierto(false)}>
                Aún no
              </button>
              <button type="button" onClick={alEmpezar}>
                Sí, empezar
              </button>
            </>
          }
        >
          <p>Desde ese momento corre el tiempo.</p>
        </Modal>
      </>
    )
  }

  const reloj = () => vi.spyOn(performance, 'now').mockImplementation(() => ahora)
  const abrir = () => fireEvent.click(screen.getByRole('button', { name: 'Abrir' }), { detail: 1 })
  const fondo = (detail: number) => fireEvent.click(screen.getByRole('dialog').previousElementSibling!, { detail })
  const boton = (nombre: string) => screen.getByRole('button', { name: nombre })
  const aspa = () => within(screen.getByRole('dialog')).getAllByRole('button', { name: 'Cerrar' })[0]!
  const abierto = () => screen.queryByRole('dialog') !== null
  /** Un toque o un clic entero, como lo da el navegador: apretar, soltar y el `click`. */
  const pulsar = (el: Element, detail: number) => {
    fireEvent.pointerDown(el)
    fireEvent.mouseDown(el, { detail })
    fireEvent.pointerUp(el)
    fireEvent.mouseUp(el, { detail })
    fireEvent.click(el, { detail })
  }

  it('el segundo clic de un doble clic cae en el fondo y el modal sigue abierto, pase el tiempo que pase', () => {
    reloj()
    render(<ConBoton aPrueba />)
    abrir()
    ahora += 5 * GRACIA_TRAS_ABRIR_MS
    fondo(2)
    expect(abierto()).toBe(true)
  })

  it('QA-UPP-14: el segundo clic de la serie cae en «Sí, empezar», «Aún no» o el aspa y no hace nada, pase el tiempo que pase', () => {
    reloj()
    const alEmpezar = vi.fn()
    render(<ConBoton aPrueba alEmpezar={alEmpezar} />)
    abrir()
    for (const espera of [20, 200, 5 * GRACIA_TRAS_ABRIR_MS]) {
      ahora += espera
      pulsar(boton('Sí, empezar'), 2)
      pulsar(boton('Aún no'), 2)
      pulsar(aspa(), 2)
      expect(alEmpezar).not.toHaveBeenCalled()
      expect(abierto()).toBe(true)
    }
  })

  it('QA-UPP-14: dos toques sueltos —el segundo a los 150 ms, `detail` 1— tampoco pulsan nada del pie', () => {
    reloj()
    const alEmpezar = vi.fn()
    render(<ConBoton aPrueba alEmpezar={alEmpezar} />)
    abrir()
    ahora += 150
    pulsar(boton('Sí, empezar'), 1)
    ahora += 100
    pulsar(boton('Aún no'), 1)
    ahora += 100
    pulsar(aspa(), 1)
    expect(alEmpezar).not.toHaveBeenCalled()
    expect(abierto()).toBe(true)
  })

  it('dentro de la ventana, apretar no se lleva el foco ni llega a nadie: el `mousedown` se cancela', () => {
    reloj()
    const alApretar = vi.fn()
    render(<ConBoton aPrueba />)
    abrir()
    const si = boton('Sí, empezar')
    si.addEventListener('pointerdown', alApretar)
    ahora += 100
    expect(fireEvent.pointerDown(si)).toBe(true)
    expect(fireEvent.mouseDown(si, { detail: 1 })).toBe(false)
    expect(alApretar).not.toHaveBeenCalled()
  })

  it('un toque que empieza dentro de la ventana y se suelta ya fuera no pulsa: en el teléfono el `click` llega al levantar el dedo', () => {
    reloj()
    const alEmpezar = vi.fn()
    render(<ConBoton aPrueba alEmpezar={alEmpezar} />)
    abrir()
    const si = boton('Sí, empezar')
    ahora += GRACIA_TRAS_ABRIR_MS - 20
    fireEvent.pointerDown(si)
    ahora += 120
    fireEvent.pointerUp(si)
    // El `mousedown` de un toque es de compatibilidad y llega ahora, ya fuera: no borra la marca
    fireEvent.mouseDown(si, { detail: 1 })
    fireEvent.mouseUp(si, { detail: 1 })
    fireEvent.click(si, { detail: 1 })
    expect(alEmpezar).not.toHaveBeenCalled()
    expect(abierto()).toBe(true)

    // Y el siguiente toque, ya con el diálogo leído, sí pulsa
    ahora += 1_000
    pulsar(si, 1)
    expect(alEmpezar).toHaveBeenCalledTimes(1)
  })

  it('pasada la ventana, un toque normal pulsa: «Sí, empezar» actúa y «Aún no» cierra', () => {
    reloj()
    const alEmpezar = vi.fn()
    render(<ConBoton aPrueba alEmpezar={alEmpezar} />)
    abrir()
    ahora += GRACIA_TRAS_ABRIR_MS
    pulsar(boton('Sí, empezar'), 1)
    expect(alEmpezar).toHaveBeenCalledTimes(1)
    pulsar(boton('Aún no'), 1)
    expect(abierto()).toBe(false)
  })

  it('dos clics sueltos en el fondo: el que llega a los 150 ms no lo cierra; uno deliberado, pasado el primer instante, sí', () => {
    reloj()
    render(<ConBoton aPrueba />)
    abrir()
    ahora += 150
    fondo(1)
    expect(abierto()).toBe(true)

    ahora += GRACIA_TRAS_ABRIR_MS
    fondo(1)
    expect(abierto()).toBe(false)
  })

  it('el teclado no espera: Enter o Espacio en el pie (`detail` 0), el aspa con el teclado y Escape actúan desde el primer instante', () => {
    reloj()
    const alEmpezar = vi.fn()
    render(<ConBoton aPrueba alEmpezar={alEmpezar} />)
    abrir()
    // Sin mover el reloj: el `click` del teclado llega con `detail` 0
    fireEvent.click(boton('Sí, empezar'), { detail: 0 })
    expect(alEmpezar).toHaveBeenCalledTimes(1)
    fireEvent.click(boton('Aún no'), { detail: 0 })
    expect(abierto()).toBe(false)

    abrir()
    fireEvent.click(aspa(), { detail: 0 })
    expect(abierto()).toBe(false)

    abrir()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(abierto()).toBe(false)
  })

  it('el teclado pasa aunque quede marcada una pulsación descartada que no llegó a soltarse encima', () => {
    reloj()
    const alEmpezar = vi.fn()
    render(<ConBoton aPrueba alEmpezar={alEmpezar} />)
    abrir()
    ahora += 100
    // Apretó dentro de la ventana y se fue arrastrando: no hubo `click`
    fireEvent.pointerDown(boton('Sí, empezar'))
    ahora += 1_000
    fireEvent.click(boton('Sí, empezar'), { detail: 0 })
    expect(alEmpezar).toHaveBeenCalledTimes(1)
  })

  it('cada apertura cuenta su propio instante: al volver a abrir, el primer clic vuelve a no contar', () => {
    reloj()
    const alEmpezar = vi.fn()
    render(<ConBoton aPrueba alEmpezar={alEmpezar} />)
    abrir()
    ahora += GRACIA_TRAS_ABRIR_MS + 1
    fondo(1)
    expect(abierto()).toBe(false)

    ahora += 1_000
    abrir()
    ahora += 100
    fondo(1)
    pulsar(boton('Sí, empezar'), 1)
    expect(abierto()).toBe(true)
    expect(alEmpezar).not.toHaveBeenCalled()
  })

  it('el escudo: tapa la pantalla al abrir, sin leerse; lo que cae en él no sube a la página; se va pasada la ventana y vuelve en la siguiente apertura', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const enLaPagina = vi.fn()
    render(
      <div onClick={enLaPagina}>
        <ConBoton aPrueba />
      </div>,
    )
    abrir()
    enLaPagina.mockClear()
    const escudo = document.querySelector<HTMLElement>('[data-escudo-del-modal]')!
    expect(escudo).not.toBeNull()
    expect(escudo.getAttribute('aria-hidden')).toBe('true')
    expect(escudo.hidden).toBe(false)
    // Después del panel: el fondo sigue siendo el hermano anterior del diálogo
    expect(screen.getByRole('dialog').nextElementSibling).toBe(escudo)

    expect(fireEvent.mouseDown(escudo, { detail: 2 })).toBe(false)
    fireEvent.click(escudo, { detail: 2 })
    expect(enLaPagina).not.toHaveBeenCalled()
    expect(abierto()).toBe(true)

    act(() => vi.advanceTimersByTime(GRACIA_TRAS_ABRIR_MS + MARGEN_DEL_ESCUDO_MS - 1))
    expect(escudo.hidden).toBe(false)
    act(() => vi.advanceTimersByTime(1))
    expect(escudo.hidden).toBe(true)

    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    abrir()
    expect(document.querySelector<HTMLElement>('[data-escudo-del-modal]')!.hidden).toBe(false)
  })

  it('sin la marca, el fondo cierra al instante, también con la segunda pulsación; el pie pulsa al instante; y no hay escudo: lo de siempre', () => {
    reloj()
    const alEmpezar = vi.fn()
    render(<ConBoton aPrueba={false} alEmpezar={alEmpezar} />)
    abrir()
    expect(document.querySelector('[data-escudo-del-modal]')).toBeNull()
    pulsar(boton('Sí, empezar'), 2)
    expect(alEmpezar).toHaveBeenCalledTimes(1)
    fondo(2)
    expect(abierto()).toBe(false)
  })
})
