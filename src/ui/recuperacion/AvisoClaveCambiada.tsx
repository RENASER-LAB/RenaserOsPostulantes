/**
 * «✓ Contraseña cambiada exitosamente», encima del formulario de entrar.
 *
 * Llega por el estado de la navegación y no por la dirección: un `?clave=ok` en
 * la barra se quedaría en marcadores y en el historial diciendo algo que ya no
 * es verdad. El foco va al aviso al llegar, para que el lector de pantalla lo
 * diga antes que los campos.
 */

import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { CLAVE_CAMBIADA } from './reglas'
import estilos from './Recuperacion.module.css'

/** Lo que se pasa como `state` al navegar a la pantalla de entrar. */
export const ESTADO_CLAVE_CAMBIADA = { claveCambiada: true } as const

export function AvisoClaveCambiada() {
  const { state } = useLocation()
  const aviso = useRef<HTMLParagraphElement>(null)
  const visible = (state as { claveCambiada?: unknown } | null)?.claveCambiada === true

  useEffect(() => {
    if (visible) aviso.current?.focus()
  }, [visible])

  if (!visible) return null
  return (
    <p ref={aviso} className={estilos.exito} role="status" tabIndex={-1}>
      <span aria-hidden="true">✓</span>
      {CLAVE_CAMBIADA}
    </p>
  )
}
