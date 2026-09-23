/**
 * Una cuenta atrás en segundos, para el «Reenviar enlace (en 45 s)».
 *
 * Cuenta contra una hora de fin y no restando de uno en uno: si la pestaña se
 * queda en segundo plano el navegador espacia los intervalos, y un contador que
 * resta seguiría diciendo 40 s cuando ya pasó el minuto.
 */

import { useCallback, useEffect, useState } from 'react'

export function useCuentaAtras(): { quedan: number; empezar: (segundos: number) => void } {
  const [hasta, setHasta] = useState<number | null>(null)
  const [ahora, setAhora] = useState(() => Date.now())

  const empezar = useCallback((segundos: number) => {
    const inicio = Date.now()
    setAhora(inicio)
    setHasta(inicio + segundos * 1000)
  }, [])

  const quedan = hasta === null ? 0 : Math.max(0, Math.ceil((hasta - ahora) / 1000))

  // Cuerpo entre llaves y limpieza explícita: un efecto de una línea devolvería
  // lo que devuelva la llamada y React lo tomaría por la función de limpieza.
  const enMarcha = quedan > 0
  useEffect(() => {
    if (!enMarcha) return undefined
    const reloj = window.setInterval(() => {
      setAhora(Date.now())
    }, 1000)
    return () => {
      window.clearInterval(reloj)
    }
  }, [enMarcha])

  return { quedan, empezar }
}
