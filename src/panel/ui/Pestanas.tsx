/**
 * Las pestañas del panel (las de la ficha del colaborador): una lista de
 * botones con el papel de pestaña, y las flechas, Inicio y Fin para recorrerlas.
 *
 * No guardan cuál está elegida: lo decide quien las usa. La ficha del
 * colaborador la tiene en su estado; «Pruebas», en la dirección.
 */

import { useRef, type KeyboardEvent } from 'react'
import estilos from './Pestanas.module.css'

export interface Pestana<C extends string> {
  clave: C
  nombre: string
  /** Un recuento al lado del nombre, en gris. Sin él, nada. */
  cuenta?: number | string
}

interface Props<C extends string> {
  pestanas: Pestana<C>[]
  actual: C
  alCambiar: (clave: C) => void
  /** El nombre accesible de la lista. */
  etiqueta: string
  /** Lo que anteponen los id: `pestana-…` y el `panel-…` que cada una controla. */
  prefijo?: string
  /** En el teléfono, a partes iguales del ancho. */
  iguales?: boolean
}

export function Pestanas<C extends string>({
  pestanas,
  actual,
  alCambiar,
  etiqueta,
  prefijo = '',
  iguales = false,
}: Props<C>) {
  const lista = useRef<HTMLDivElement>(null)
  const idDe = (clave: C) => `${prefijo}pestana-${clave}`

  function alPulsar(e: KeyboardEvent<HTMLButtonElement>) {
    const i = pestanas.findIndex((p) => p.clave === actual)
    let siguiente = -1
    if (e.key === 'ArrowRight') siguiente = (i + 1) % pestanas.length
    else if (e.key === 'ArrowLeft') siguiente = (i - 1 + pestanas.length) % pestanas.length
    else if (e.key === 'Home') siguiente = 0
    else if (e.key === 'End') siguiente = pestanas.length - 1
    if (siguiente < 0) return
    e.preventDefault()
    const destino = pestanas[siguiente]!
    alCambiar(destino.clave)
    lista.current?.querySelector<HTMLButtonElement>(`#${idDe(destino.clave)}`)?.focus()
  }

  return (
    <div
      className={iguales ? `${estilos.pestanas} ${estilos.iguales}` : estilos.pestanas}
      role="tablist"
      aria-label={etiqueta}
      ref={lista}
    >
      {pestanas.map((p) => (
        <button
          key={p.clave}
          id={idDe(p.clave)}
          className={p.clave === actual ? `${estilos.pestana} ${estilos.pestanaActiva}` : estilos.pestana}
          type="button"
          role="tab"
          aria-selected={p.clave === actual}
          aria-controls={`${prefijo}panel-${p.clave}`}
          tabIndex={p.clave === actual ? 0 : -1}
          onClick={() => alCambiar(p.clave)}
          onKeyDown={alPulsar}
        >
          {p.nombre}
          {p.cuenta !== undefined && <span className={estilos.cuenta}>{p.cuenta}</span>}
        </button>
      ))}
    </div>
  )
}
