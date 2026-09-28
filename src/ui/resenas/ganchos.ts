/**
 * Dos ganchos que comparten las pantallas de reseñas: el candado de los botones
 * que envían y el foco que no se pierde.
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

/**
 * Un solo envío por clic, aunque el clic sea doble.
 *
 * ⚠️ **El `disabled` que sale de `isPending` llega tarde.** TanStack avisa del
 * cambio de estado en un `setTimeout`, y el segundo clic de un doble clic entra
 * antes: el botón sigue habilitado y salen dos POST (el segundo, un 409). El
 * candado se cierra en el mismo clic, de forma síncrona, y se abre cuando el
 * envío termina, salga bien o mal. `ocupado` es lo mismo pintado: deshabilita
 * el botón sin esperar a `isPending`.
 *
 * El trabajo es un `mutateAsync`: su rechazo ya lo cuenta el `onError` de la
 * mutación, así que aquí se traga.
 */
export function useUnSoloEnvio() {
  const cerrado = useRef(false)
  const [ocupado, setOcupado] = useState(false)

  const enviar = useCallback((trabajo: () => Promise<unknown>) => {
    if (cerrado.current) return
    cerrado.current = true
    setOcupado(true)
    trabajo()
      .catch(() => undefined)
      .finally(() => {
        cerrado.current = false
        setOcupado(false)
      })
  }, [])

  return { ocupado, enviar }
}

/** Un destino del foco: un selector que se busca en la zona, o un ref. */
export type DestinoDelFoco = string | RefObject<HTMLElement | null>

/**
 * Lleva el foco a un sitio que todavía no está pintado.
 *
 * El control que tenía el foco desaparece —un paso de la ventana que termina,
 * una confirmación que se abre o se cierra— o se deshabilita mientras trabaja,
 * y el navegador deja el foco en `<body>`: con una ventana abierta, Tab
 * recorrería la página de detrás.
 *
 * `pedirFoco` guarda los destinos, del mejor al peor, y después de pintar se
 * enfoca el primero que exista. Si ese está deshabilitado porque algo trabaja
 * (`ocupado`), se espera: el efecto vuelve a mirar en cada pintado y lo enfoca
 * en cuanto se habilita. Si no queda ninguno, va al `respaldo`.
 *
 * Va en un efecto y no en un `requestAnimationFrame`: los efectos de quien lo
 * usa corren después de que el `Modal` devuelva el foco al cerrarse, y así el
 * destino pedido gana.
 */
export function useFocoPendiente({
  zona,
  respaldo,
  ocupado,
}: {
  /** Dónde se buscan los selectores. */
  zona: () => ParentNode | null
  respaldo: () => HTMLElement | null | undefined
  ocupado: boolean
}) {
  const [destinos, setDestinos] = useState<readonly DestinoDelFoco[] | null>(null)

  // Sin dependencias a propósito: mientras haya un destino pendiente, se mira
  // en cada pintado. Sin él, sale en la primera línea.
  useEffect(() => {
    if (!destinos) return
    const donde = zona()
    for (const destino of destinos) {
      const elemento =
        typeof destino === 'string' ? donde?.querySelector<HTMLElement>(destino) : destino.current
      if (!elemento || !elemento.isConnected) continue
      if (elemento.matches(':disabled')) {
        if (ocupado) return
        continue
      }
      setDestinos(null)
      elemento.focus()
      return
    }
    setDestinos(null)
    respaldo()?.focus()
  })

  return setDestinos
}
