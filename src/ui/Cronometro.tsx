/**
 * El cronometro de la prueba.
 *
 * No cuenta hacia atras desde un numero: recalcula cada segundo cuanto falta
 * hasta la hora que dio el servidor. Asi da igual que la pestaña se duerma, que
 * el equipo se suspenda o que alguien cambie la hora del sistema.
 *
 * ⚠️ **Avisa en umbrales, no cada segundo.** Un `aria-live` sobre el numero que
 * corre lo lee sesenta veces por minuto y tapa todo lo demas, asi que quien usa
 * lector de pantalla acaba apagandolo y se queda sin ninguna señal. Aqui el
 * numero va callado y lo que se anuncia es una frase, cuatro veces en dos horas.
 *
 * El aviso importa: `PRODUCT.md` lo pone como uno de sus dos requisitos
 * concretos de accesibilidad —«el cronometro no puede ser la unica señal de que
 * queda poco tiempo»— y la prueba no se pausa, no se detiene al cerrar el
 * navegador y termina entregando sola lo que haya.
 */

import { useEffect, useRef, useState } from 'react'
import type { FechaIso } from '@/api/tipos'
import { formatearTiempo, segundosHasta } from '@/dominio/reloj'

/** Cuando queda poco, en segundos. Por debajo de esto el numero se pone rojo. */
export const QUEDA_POCO = 600

/** Los momentos en los que se dice en voz alta cuanto falta. */
const AVISOS = [
  { segundos: 1800, frase: 'Queda media hora.' },
  { segundos: 600, frase: 'Quedan diez minutos.' },
  { segundos: 300, frase: 'Quedan cinco minutos.' },
  { segundos: 60, frase: 'Queda un minuto. Lo que esté guardado se entrega solo.' },
]

interface Props {
  /** La hora de vencimiento que manda el backend. */
  venceEn: FechaIso | null
  /** Se llama una vez cuando llega a cero. */
  alAgotarse?: () => void
  /** La clase del numero. Sin esto se queda sin tamaño: no hay una por defecto. */
  className?: string
  /** La clase que se añade por debajo de `QUEDA_POCO`. */
  classNamePoco?: string
}

export function Cronometro({ venceEn, alAgotarse, className, classNamePoco }: Props) {
  const [restante, setRestante] = useState(() => segundosHasta(venceEn))
  const [aviso, setAviso] = useState('')

  // El umbral que ya se dijo. Sin esto, el mismo aviso se repetiria cada
  // segundo hasta cruzar el siguiente.
  const yaAvisado = useRef<number | null>(null)

  useEffect(() => {
    setRestante(segundosHasta(venceEn))
    yaAvisado.current = null
    if (!venceEn) return

    const id = window.setInterval(() => setRestante(segundosHasta(venceEn)), 1000)
    return () => window.clearInterval(id)
  }, [venceEn])

  useEffect(() => {
    if (restante === null) return
    if (restante === 0) alAgotarse?.()

    const cruzado = AVISOS.find((a) => restante <= a.segundos)
    if (!cruzado) return
    if (yaAvisado.current !== null && yaAvisado.current <= cruzado.segundos) return
    yaAvisado.current = cruzado.segundos
    setAviso(cruzado.frase)
  }, [restante, alAgotarse])

  const poco = restante !== null && restante <= QUEDA_POCO
  const clases = [className, poco ? classNamePoco : ''].filter(Boolean).join(' ')

  return (
    <>
      {/* El numero, callado: lo lee la vista, no el lector. */}
      <div className={clases || undefined} aria-hidden="true">
        {restante === null ? '--:--:--' : formatearTiempo(restante)}
      </div>
      {/*
        Y la frase, que es lo que se oye. Fuera de la vista pero no oculta al
        lector: `display: none` la haria invisible tambien para el.
      */}
      <p role="status" aria-live="polite" className="solo-lectores">
        {aviso}
      </p>
    </>
  )
}
