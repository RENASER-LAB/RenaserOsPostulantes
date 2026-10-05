/**
 * El botón «!» de la configuración de la prueba (V68): la guía de un campo, que
 * no ocupa sitio hasta que se pide.
 *
 * Se enseña al pasar el cursor, al llegar con el teclado o al tocarlo, y
 * desaparece al salir. Con Escape se cierra sin cerrar el panel.
 *
 * Funciona también en lectura: leer una guía no cambia nada.
 */

import { useId, useState } from 'react'
import { IconoAviso } from '@/ui/Iconos'
import estilos from './EditorDePreguntas.module.css'

export function Guia({ de, texto }: { de: string; texto: string }) {
  const id = useId()
  const [porCursor, setPorCursor] = useState(false)
  const [porFoco, setPorFoco] = useState(false)
  const [tocada, setTocada] = useState(false)
  const abierta = porCursor || porFoco || tocada
  return (
    <>
      <button
        className={estilos.botonGuia}
        type="button"
        aria-label={`Guía: ${de}`}
        aria-describedby={abierta ? id : undefined}
        aria-expanded={abierta}
        onMouseEnter={() => setPorCursor(true)}
        onMouseLeave={() => setPorCursor(false)}
        onFocus={() => setPorFoco(true)}
        onBlur={() => {
          setPorFoco(false)
          setTocada(false)
        }}
        onClick={() => setTocada((t) => !t)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && abierta) {
            // Solo la guía: el panel que la contiene sigue abierto.
            e.stopPropagation()
            e.nativeEvent.stopImmediatePropagation()
            setPorCursor(false)
            setPorFoco(false)
            setTocada(false)
          }
        }}
      >
        <IconoAviso tamano={20} />
      </button>
      {abierta && (
        <span className={estilos.textoGuia} role="tooltip" id={id}>
          {texto}
        </span>
      )}
    </>
  )
}
