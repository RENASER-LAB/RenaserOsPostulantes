/**
 * Lo que se enseña cuando no hay nada que enseñar.
 *
 * Se usa donde antes habia un recuadro de una linea: sin vacantes abiertas y
 * sin postulaciones. La hormiga en gris hace de marca de agua; es el unico
 * sitio donde sale sola, y por eso va del color de las lineas y no en champagne.
 */

import type { ReactNode } from 'react'
import { Marca } from './Marca'

interface Props {
  titulo: string
  children: ReactNode
  /** Un boton, cuando desde aqui se puede hacer algo. */
  accion?: ReactNode
}

export function Vacio({ titulo, children, accion }: Props) {
  return (
    <div className="card vacio">
      <span className="vacio-marca" aria-hidden="true">
        <Marca tamano={30} />
      </span>
      <b>{titulo}</b>
      <p>{children}</p>
      {accion}
    </div>
  )
}
