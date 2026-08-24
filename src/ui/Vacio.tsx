/**
 * Lo que se enseña cuando no hay nada que enseñar.
 *
 * Se usa donde antes habia un recuadro de una linea: sin vacantes abiertas y
 * sin postulaciones. La hormiga en gris hace de marca de agua; es el unico
 * sitio donde sale sola, y por eso va del color de las lineas y nunca del
 * acento, que aqui significaria que hay algo que hacer.
 */

import type { ReactNode } from 'react'
import { Marca } from './Marca'
import estilos from './Estados.module.css'

interface Props {
  titulo: string
  children: ReactNode
  /** Un boton, cuando desde aqui se puede hacer algo. */
  accion?: ReactNode
}

export function Vacio({ titulo, children, accion }: Props) {
  return (
    <div className={estilos.marco}>
      <span className={estilos.hormiga} aria-hidden="true">
        <Marca tamano={30} />
      </span>
      <b className={estilos.tituloVacio}>{titulo}</b>
      <p className={estilos.texto}>{children}</p>
      {accion && <div className={estilos.botones}>{accion}</div>}
    </div>
  )
}
