/**
 * El cronometro de la prueba.
 *
 * No cuenta hacia atras desde un numero: recalcula cada segundo cuanto falta
 * hasta la hora que dio el servidor. Asi da igual que la pestaña se duerma, que
 * el equipo se suspenda o que alguien cambie la hora del sistema.
 */

import { useEffect, useState } from 'react'
import type { FechaIso } from '@/api/tipos'
import { formatearTiempo, segundosHasta } from '@/dominio/reloj'

interface Props {
  /** La hora de vencimiento que manda el backend. */
  venceEn: FechaIso | null
  /** Se llama una vez cuando llega a cero. */
  alAgotarse?: () => void
  className?: string
}

export function Cronometro({ venceEn, alAgotarse, className = 'timer' }: Props) {
  const [restante, setRestante] = useState(() => segundosHasta(venceEn))

  useEffect(() => {
    setRestante(segundosHasta(venceEn))
    if (!venceEn) return

    const id = window.setInterval(() => setRestante(segundosHasta(venceEn)), 1000)
    return () => window.clearInterval(id)
  }, [venceEn])

  useEffect(() => {
    if (restante === 0) alAgotarse?.()
  }, [restante, alAgotarse])

  return (
    <div className={className} aria-live="off">
      {restante === null ? '--:--:--' : formatearTiempo(restante)}
    </div>
  )
}
