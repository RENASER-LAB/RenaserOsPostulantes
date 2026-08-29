/**
 * Lo escrito no sale de la cola hasta que el servidor lo confirma.
 *
 * Nació dentro de `Evaluacion.tsx` y sale aquí sin cambiar de comportamiento, porque el
 * cuestionario técnico necesita exactamente la misma regla y **dos copias de esto se
 * arreglan en una y no en la otra**. Es la regla que ya costó respuestas de candidatos
 * perdidas, y la razón de cada línea está escrita:
 *
 * - **Lo pendiente no se borra al mandarlo, solo al confirmarlo.** Un 500 o una red que
 *   parpadea se lo comían: el candidato llegaba al final con «16 de 20 respondidas» sin
 *   saber cuáles faltaban.
 * - **Solo se da por guardado lo que de verdad se mandó.** Si siguió escribiendo mientras
 *   la petición viajaba, lo nuevo sigue en la cola y se manda después.
 * - **Se reintenta solo mientras quede algo.** Un fallo de un momento no debería costarle
 *   una respuesta a nadie.
 * - **Al salir de la pantalla se manda lo que quede.** Volver atrás o cerrar la pestaña no
 *   puede ser la forma de perder lo escrito.
 *
 * Lo que NO hace: decidir qué es una respuesta completa. Eso lo sabe cada pantalla —el
 * banco tiene ocho formatos y el cuestionario técnico solo texto— y por eso `encolar` se
 * llama desde fuera, ya con la decisión tomada.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

/** Cuánto se espera desde la última tecla antes de mandar. */
export const ESPERA_ANTES_DE_GUARDAR = 800
/** Cada cuánto se reintenta lo que no llegó. */
export const ESPERA_ANTES_DE_REINTENTAR = 5000

export interface ColaDeRespuestas<T> {
  /** Lo que todavía no confirmó el servidor, para poder pintarlo. */
  sinConfirmar: { id: number; valor: T }[]
  /** Lo pendiente de una pregunta, si lo hay: lo suyo manda sobre lo que el servidor cree. */
  pendienteDe: (preguntaId: number) => T | undefined
  /** Deja algo pendiente y programa el envío. */
  encolar: (preguntaId: number, valor: T) => void
  /** Quita lo pendiente de una pregunta: lo que hay ya es lo del servidor. */
  olvidar: (preguntaId: number) => void
  /** Manda ya todo lo pendiente, sin esperar. */
  mandarYa: () => void
}

/**
 * @param mandar qué hacer con cada pendiente. Debe ser estable (`useMutation.mutate` lo es).
 * @param loMismo si lo que se acaba de confirmar sigue siendo lo que hay en la cola. Sin
 *   esto, una respuesta escrita mientras la anterior viajaba se daría por guardada.
 */
export function useColaDeRespuestas<T>(
  mandar: (preguntaId: number, valor: T) => void,
  loMismo: (enCola: T, confirmado: T) => boolean,
): ColaDeRespuestas<T> & { confirmar: (preguntaId: number, valor: T) => void } {
  // Referencia para poder mandarlo al vuelo desde cualquier sitio, y además copiado a
  // estado para poder pintarlo: sin eso, el candidato no tiene forma de saber que algo no
  // llegó.
  const cola = useRef<Map<number, T>>(new Map())
  const [sinConfirmar, setSinConfirmar] = useState<{ id: number; valor: T }[]>([])
  const temporizador = useRef<number | undefined>(undefined)

  const refrescar = useCallback(() => {
    setSinConfirmar([...cola.current].map(([id, valor]) => ({ id, valor })))
  }, [])

  const mandarYa = useCallback(() => {
    window.clearTimeout(temporizador.current)
    for (const [preguntaId, valor] of cola.current) {
      mandar(preguntaId, valor)
    }
  }, [mandar])

  const encolar = useCallback(
    (preguntaId: number, valor: T) => {
      cola.current.set(preguntaId, valor)
      refrescar()
      window.clearTimeout(temporizador.current)
      temporizador.current = window.setTimeout(mandarYa, ESPERA_ANTES_DE_GUARDAR)
    },
    [mandarYa, refrescar],
  )

  const olvidar = useCallback(
    (preguntaId: number) => {
      if (cola.current.delete(preguntaId)) {
        refrescar()
      }
    },
    [refrescar],
  )

  /** Lo confirmó el servidor: sale de la cola **solo** si sigue siendo lo mismo. */
  const confirmar = useCallback(
    (preguntaId: number, valor: T) => {
      const enCola = cola.current.get(preguntaId)
      if (enCola !== undefined && loMismo(enCola, valor)) {
        cola.current.delete(preguntaId)
        refrescar()
      }
    },
    [loMismo, refrescar],
  )

  // Mientras quede algo sin confirmar se sigue intentando solo.
  useEffect(() => {
    if (sinConfirmar.length === 0) {
      return
    }
    const reloj = window.setInterval(mandarYa, ESPERA_ANTES_DE_REINTENTAR)
    return () => {
      window.clearInterval(reloj)
    }
  }, [sinConfirmar.length, mandarYa])

  // Al salir de la pantalla, lo que quede sin mandar se manda.
  useEffect(() => {
    return () => {
      mandarYa()
    }
  }, [mandarYa])

  const pendienteDe = useCallback((preguntaId: number) => cola.current.get(preguntaId), [])

  return { sinConfirmar, pendienteDe, encolar, olvidar, mandarYa, confirmar }
}
