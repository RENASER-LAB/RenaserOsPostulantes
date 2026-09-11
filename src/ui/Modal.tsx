/**
 * El modal compartido: cabecera con titulo, cuerpo y pie con botones.
 *
 * Se cierra con Escape, tocando el fondo o con la aspa. Mientras esta abierto
 * el fondo no hace scroll y el foco no se escapa fuera.
 */

import { useEffect, useRef, type ReactNode } from 'react'
import estilos from './Modal.module.css'

interface Props {
  abierto: boolean
  titulo: string
  onCerrar: () => void
  children: ReactNode
  /** Los botones del pie. Sin esto se pone uno de «Cerrar». */
  pie?: ReactNode
}

const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

export function Modal({ abierto, titulo, onCerrar, children, pie }: Props) {
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

  useEffect(() => {
    if (!abierto) return

    const anterior = document.activeElement as HTMLElement | null
    document.body.style.overflow = 'hidden'
    caja.current?.querySelector<HTMLElement>(ENFOCABLES)?.focus()

    function alPulsar(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        alCerrar.current()
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
      anterior?.focus()
    }
  }, [abierto])

  if (!abierto) return null

  return (
    <>
      <div className={estilos.fondo} onClick={onCerrar} />
      <section
        className={estilos.caja}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal"
        ref={caja}
      >
        <div className={estilos.cabecera}>
          <h2 className={estilos.titulo} id="titulo-modal">{titulo}</h2>
          <button className={estilos.cerrar} type="button" onClick={onCerrar} aria-label="Cerrar">
            ×
          </button>
        </div>
        <div className={estilos.cuerpo}>{children}</div>
        <div className={estilos.pie}>
          {pie ?? (
            <button className={estilos.cerrarPie} type="button" onClick={onCerrar}>
              Cerrar
            </button>
          )}
        </div>
      </section>
    </>
  )
}
