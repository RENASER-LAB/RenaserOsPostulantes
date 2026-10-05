/**
 * Los ganchos que comparten las pantallas de reseñas: el candado de los botones
 * que envían, el foco que no se pierde y la pregunta antes de tirar un borrador.
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { ComoSeCierra } from '@/ui/Modal'

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

/** Cómo se pide cerrar un paso: lo que dice el `Modal`, o el «Volver» del pie. */
export type CierreDelPaso = ComoSeCierra | 'volver'

/**
 * Preguntar antes de tirar lo escrito al cerrar una ventana con formulario.
 *
 * El formulario guarda su texto dentro y, en cada cambio del campo, dice con
 * `avisar(hay)` si hay borrador —texto que no está guardado—. Quien tiene la
 * ventana pasa cada cierre por `intentar(como, cerrar)`:
 *
 * - sin borrador, o mientras se envía, cierra como siempre;
 * - con borrador, no cierra: `preguntando` se enciende y el pie cambia a la
 *   pregunta (`PreguntaDeDescartar`);
 * - con la pregunta a la vista, Escape la quita —igual que «Seguir
 *   escribiendo»— y el aspa y el fondo no hacen nada.
 *
 * «Descartar» hace lo que iba a hacer el cierre que se paró: `descartar(cerrar)`
 * le pasa por dónde se pidió, porque «Volver» no siempre cierra la ventana.
 *
 * ⚠️ **La pregunta va en el pie de la misma ventana**, no en otra: el `Modal`
 * lleva un `id` fijo en su título y no admite dos. Y así el formulario sigue
 * montado debajo, con lo escrito tal cual.
 *
 * ⚠️ **`intentar` lee el borrador de un ref, no del estado.** El `Modal` llama
 * al `onCerrar` del último pintado, y un Escape que llega antes de pintar la
 * tecla anterior —`fill` y Escape seguidos— lo encontraba sin borrador y
 * cerraba sin preguntar. El formulario avisa en su `onChange`
 * (`useAvisoDeBorrador`) y el ref cambia en ese mismo momento; el estado es
 * solo para pintar.
 *
 * ⚠️ **Sin borrador, la pregunta se olvida.** Con ella a la vista, quien vacía
 * el campo ya no tiene nada que descartar: si `pendiente` siguiera puesto, la
 * primera letra de lo que escribe después la hacía volver sola, se llevaba el
 * foco a «Seguir escribiendo» y las teclas siguientes iban al botón.
 */
export function useBorradorDeLaVentana(enviando: boolean) {
  const [hayBorrador, setHayBorrador] = useState(false)
  const hayAhora = useRef(false)
  const [pendiente, setPendiente] = useState<CierreDelPaso | null>(null)
  const [alCampo, setAlCampo] = useState(false)
  // Si el formulario ya no está —el paso pasó a «Reseña no disponible»—, no
  // queda nada que descartar y la pregunta no sale.
  const preguntando = pendiente !== null && hayBorrador

  // «Seguir escribiendo» desaparece al pulsarlo: el foco vuelve al campo, que
  // es el único texto largo de la ventana.
  useEffect(() => {
    if (!alCampo) return
    setAlCampo(false)
    document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"] textarea')?.focus()
  }, [alCampo])

  const avisar = useCallback((hay: boolean) => {
    hayAhora.current = hay
    setHayBorrador(hay)
    if (!hay) setPendiente(null)
  }, [])

  const seguir = useCallback(() => {
    setPendiente(null)
    setAlCampo(true)
  }, [])

  const intentar = (como: CierreDelPaso, cerrar: (como: CierreDelPaso) => void) => {
    if (preguntando && hayAhora.current) {
      if (como === 'escape') seguir()
      return
    }
    if (hayAhora.current && !enviando) {
      setPendiente(como)
      return
    }
    setPendiente(null)
    cerrar(como)
  }

  const descartar = (cerrar: (como: CierreDelPaso) => void) => {
    const como = pendiente ?? 'aspa'
    avisar(false)
    cerrar(como)
  }

  /** El paso se cerró o cambió por otro camino —enviado, abierto otro—: se empieza de cero. */
  const olvidar = useCallback(() => avisar(false), [avisar])

  return { preguntando, intentar, seguir, descartar, olvidar, avisar }
}

/**
 * El aviso de borrador de un formulario. Devuelve `notar(hay)`, que se llama
 * en el `onChange` del campo con lo que habrá tras la tecla, y se lo pasa a
 * `alCambiar`. Al desmontarse avisa con `false`: el paso se fue y su texto con él.
 *
 * Va en el `onChange` y no en un efecto: el efecto avisaba una tarea tarde, y
 * un cierre que entraba en medio no sabía que había texto
 * (`useBorradorDeLaVentana`). El formulario empieza siempre sin borrador —vacío,
 * o con el texto ya guardado—, así que no hay nada que avisar al montarse.
 */
export function useAvisoDeBorrador(alCambiar?: (hay: boolean) => void) {
  // Por ref: quien lo pasa suele declararlo en cada pintado.
  const aviso = useRef(alCambiar)
  aviso.current = alCambiar

  useEffect(() => () => aviso.current?.(false), [])

  return useCallback((hay: boolean) => aviso.current?.(hay), [])
}
