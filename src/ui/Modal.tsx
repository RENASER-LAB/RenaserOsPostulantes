/**
 * El modal del mockup: cabecera con titulo, cuerpo y pie con botones.
 *
 * Se cierra con Escape, tocando el fondo o con la aspa. Mientras esta abierto
 * el fondo no hace scroll y el foco no se escapa fuera.
 */

import { useEffect, useRef, type ReactNode } from 'react'

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

  useEffect(() => {
    if (!abierto) return

    const anterior = document.activeElement as HTMLElement | null
    document.body.style.overflow = 'hidden'
    caja.current?.querySelector<HTMLElement>(ENFOCABLES)?.focus()

    function alPulsar(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCerrar()
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
  }, [abierto, onCerrar])

  if (!abierto) return null

  return (
    <>
      <div className="overlay show" onClick={onCerrar} />
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal"
        ref={caja}
      >
        <div className="modal-head">
          <h2 id="titulo-modal">{titulo}</h2>
          <button className="iconbtn" onClick={onCerrar} aria-label="Cerrar">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-foot">
          {pie ?? (
            <button className="btn" onClick={onCerrar}>
              Cerrar
            </button>
          )}
        </div>
      </section>
    </>
  )
}
