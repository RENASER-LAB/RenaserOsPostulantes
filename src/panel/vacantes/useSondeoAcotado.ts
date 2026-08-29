/**
 * El sondeo acotado: refrescar unas cuantas veces, con los huecos creciendo, y parar.
 *
 * Nacio en `CalificarConIa.tsx` y de alli sale sin cambiar una linea de
 * comportamiento: la prueba tecnica del puesto espera al agente REDACTOR con
 * la misma regla —se mira unas cuantas veces y **se para**—, y dos copias del
 * mismo temporizador es la clase de duplicado que se arregla en una y no en la
 * otra.
 *
 * ⚠️ Lo que este hook no sabe, y no puede saber, es si llego lo que se espera:
 * eso lo tiene quien pide los datos. Devuelve cuantas vueltas lleva y si se
 * agotaron, que es lo unico honesto que se puede decir en pantalla.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

export function useSondeoAcotado(pasos: readonly number[], alRefrescar: () => void) {
  const [vueltas, setVueltas] = useState(0)
  const [mirando, setMirando] = useState(false)

  // En una referencia y no en las dependencias del efecto de abajo: `alTerminar`
  // llega nueva en cada render del padre, y meterla ahi reiniciaria el
  // temporizador en cada uno de ellos — un sondeo bastante mas rapido del
  // pactado, y sobre un backend que cobra por llamada al modelo.
  const refrescar = useRef(alRefrescar)
  useEffect(() => {
    refrescar.current = alRefrescar
  }, [alRefrescar])

  useEffect(() => {
    if (!mirando) {
      return
    }
    if (vueltas >= pasos.length) {
      setMirando(false)
      return
    }
    const temporizador = setTimeout(() => {
      refrescar.current()
      setVueltas((n) => n + 1)
    }, pasos[vueltas])
    // La limpieza es lo que corta el sondeo al cerrarse la ficha. Cuerpo entre
    // llaves en todo el efecto: un `useEffect(() => algo(), [])` le regala a
    // React lo que devuelva `algo` como funcion de limpieza, y al desmontar
    // revienta y se lleva la pagina entera.
    return () => {
      clearTimeout(temporizador)
    }
  }, [mirando, vueltas, pasos])

  // Estables entre renders: quien los mete en las dependencias de un efecto
  // (el cuestionario tecnico) no quiere que el efecto corra en cada pintado.
  const empezar = useCallback(() => {
    setVueltas(0)
    setMirando(true)
  }, [])
  /**
   * Cortar antes de agotar las vueltas y olvidar la cuenta. Lo usa quien SI
   * tiene endpoint de estado: cuando el servidor dice que termino, seguir
   * refrescando es tirar peticiones. Las vueltas vuelven a cero para que la
   * siguiente espera —otra generacion, mas tarde— arranque de nuevo y no
   * herede un «agotado» de la anterior.
   */
  const parar = useCallback(() => {
    setMirando(false)
    setVueltas(0)
  }, [])

  return {
    mirando,
    vueltas,
    total: pasos.length,
    agotado: !mirando && vueltas >= pasos.length,
    empezar,
    parar,
  }
}
