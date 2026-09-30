/**
 * Piezas pequeñas que comparten los bloques del editor: el fallo (con su lista
 * cuando la hay) y el boton de icono de 44 px.
 */

import type { ReactNode } from 'react'
import type { Fallo } from './consultas'
import estilos from './EditorDePreguntas.module.css'

/** Un 400 del editor se pinta como lista; el resto, en una linea. */
export function MostrarFallo({ fallo }: { fallo: Fallo | null }) {
  if (!fallo) return null
  if (fallo.faltas && fallo.faltas.length > 0) {
    return (
      <div className={estilos.faltas} role="alert">
        <p>
          {fallo.faltas.length === 1
            ? 'Falta una cosa:'
            : `Faltan ${fallo.faltas.length} cosas:`}
        </p>
        <ul>
          {fallo.faltas.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </div>
    )
  }
  return (
    <p className={estilos.error} role="alert">
      {fallo.mensaje}
    </p>
  )
}

/** Mover, editar y quitar: 44 px, con su nombre para el lector de pantalla. */
export function BotonIcono({
  etiqueta,
  onClick,
  disabled,
  children,
}: {
  etiqueta: string
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      className={estilos.icono}
      type="button"
      aria-label={etiqueta}
      title={etiqueta}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}
