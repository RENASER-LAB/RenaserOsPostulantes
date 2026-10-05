/**
 * El modal compartido: cabecera con titulo, cuerpo y pie con botones.
 *
 * Se cierra con Escape, tocando el fondo o con la aspa. Mientras esta abierto
 * el fondo no hace scroll y el foco no se escapa fuera.
 *
 * `onCerrar` recibe por donde se cerro. Casi nadie lo mira; lo necesita quien
 * pregunta antes de descartar un borrador, porque con la pregunta a la vista
 * Escape la quita y el aspa y el fondo no hacen nada.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import estilos from './Modal.module.css'

/** El elemento con el foco ahora mismo, si es uno al que se puede volver. */
const conElFoco = (): HTMLElement | null =>
  document.activeElement instanceof HTMLElement && document.activeElement !== document.body
    ? document.activeElement
    : null

/** Por donde se pidio cerrar: la tecla, el aspa, el fondo o el «Cerrar» del pie por defecto. */
export type ComoSeCierra = 'escape' | 'aspa' | 'fondo' | 'pie'

interface Props {
  abierto: boolean
  titulo: string
  onCerrar: (como: ComoSeCierra) => void
  children: ReactNode
  /** Los botones del pie. Sin esto se pone uno de «Cerrar». */
  pie?: ReactNode
  /**
   * En el teléfono ocupa la pantalla entera. Para ventanas que se leen largo
   * —las reseñas, con sus filtros— y no para un aviso de dos líneas.
   */
  pantallaCompleta?: boolean
}

const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

export function Modal({ abierto, titulo, onCerrar, children, pie, pantallaCompleta }: Props) {
  const caja = useRef<HTMLElement>(null)

  /*
    ⚠️ **`onCerrar` va por ref, y NO en las dependencias del efecto.**

    Quien usa este modal le pasa casi siempre una funcion declarada dentro de su
    propio componente, asi que es **una funcion distinta en cada render**. Con
    ella en las dependencias, el efecto se limpiaba y se volvia a montar en cada
    render del padre — y el efecto **mueve el foco**: su limpieza lo devuelve a
    donde estaba antes de abrir y su cuerpo lo lleva al primer enfocable del
    modal, que es el aspa de la cabecera.

    El sintoma era escribir una letra en un campo del modal y ver el foco saltar
    al aspa: cada tecla cambia el estado del padre, cada cambio re-renderiza,
    cada render reenfocaba. El campo no dejaba escribir mas de un caracter.

    Con el ref, el efecto corre solo al abrir y al cerrar —que es cuando el foco
    tiene algo que hacer— y `alPulsar` sigue llamando siempre a la version mas
    reciente, que es lo unico que necesitaba de `onCerrar`.
  */
  const alCerrar = useRef(onCerrar)
  alCerrar.current = onCerrar

  /*
    ⚠️ **Adónde vuelve el foco se apunta AL PINTAR la apertura, no en el efecto.**

    Los efectos corren de dentro hacia fuera: los del contenido antes que el de
    este modal. Un formulario que enfoca su primer campo al montarse —el paso de
    reportar lo hace en un `useLayoutEffect`, el de responder en un `useEffect`—
    ya se había llevado el foco cuando el efecto de aquí leía «el que lo tenía
    antes». Guardaba ese campo, y al cerrar devolvía el foco a un control que ya
    no existía: caía en `<body>` y el siguiente Tab empezaba por arriba de la
    página. Al pintar, nada de dentro existe todavía y el foco sigue en el botón
    que abrió el modal.

    Es estado, y no un ref, para que un pintado descartado no deje nada a medias:
    es el patrón de React para ajustar estado cuando cambia una prop.
  */
  const [apertura, setApertura] = useState<{ abierto: boolean; volverA: HTMLElement | null }>({
    abierto: false,
    volverA: null,
  })
  if (apertura.abierto !== abierto) {
    setApertura({ abierto, volverA: abierto ? conElFoco() : null })
  }
  const volverA = apertura.volverA

  useEffect(() => {
    if (!abierto) return

    document.body.style.overflow = 'hidden'
    // Si el contenido ya puso el foco dentro —su primer campo—, se respeta: el
    // aspa es solo para cuando nada de dentro lo pidió.
    if (!caja.current?.contains(document.activeElement)) {
      caja.current?.querySelector<HTMLElement>(ENFOCABLES)?.focus()
    }

    function alPulsar(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        alCerrar.current('escape')
        return
      }
      if (e.key !== 'Tab' || !caja.current) return

      // El foco da la vuelta dentro del modal en vez de irse a la pagina.
      const dentro = [...caja.current.querySelectorAll<HTMLElement>(ENFOCABLES)]
      if (dentro.length === 0) return
      const primero = dentro[0]!
      const ultimo = dentro[dentro.length - 1]!
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault()
        primero.focus()
      }
    }

    document.addEventListener('keydown', alPulsar)
    return () => {
      document.removeEventListener('keydown', alPulsar)
      document.body.style.overflow = ''
      if (volverA?.isConnected) volverA.focus()
    }
    // `volverA` cambia solo a la vez que `abierto`: el efecto no se rehace aparte.
  }, [abierto])

  if (!abierto) return null

  return (
    <>
      <div className={estilos.fondo} onClick={() => onCerrar('fondo')} />
      <section
        className={pantallaCompleta ? `${estilos.caja} ${estilos.cajaCompleta}` : estilos.caja}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal"
        ref={caja}
      >
        <div className={estilos.cabecera}>
          <h2 className={estilos.titulo} id="titulo-modal">{titulo}</h2>
          <button className={estilos.cerrar} type="button" onClick={() => onCerrar('aspa')} aria-label="Cerrar">
            ×
          </button>
        </div>
        <div className={estilos.cuerpo}>{children}</div>
        <div className={estilos.pie}>
          {pie ?? (
            <button
              className={estilos.cerrarPie}
              type="button"
              onClick={() => onCerrar('pie')}
              data-rotulo="Cerrar"
            >
              Cerrar
            </button>
          )}
        </div>
      </section>
    </>
  )
}
