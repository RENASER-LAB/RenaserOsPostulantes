/**
 * Si el 404 de una pantalla de su proceso es que la empresa retiró la vacante.
 *
 * La prueba del puesto, la evaluación, el cuestionario técnico y la simulación
 * cuelgan del código de la postulación, y sus enlaces siguen en el correo de
 * «tu prueba está lista», en el historial del navegador y en los avisos viejos
 * de la campana. Cuando la vacante se elimina, el backend contesta 404 en todas
 * (V60). Antes, la de la prueba lo enseñaba como una avería —«No pudimos abrir
 * la prueba» con el texto crudo del servidor— y le ofrecía reintentar contra la
 * misma puerta.
 *
 * ⚠️ **Un 404 de esas pantallas no basta para decirlo.** En la simulación
 * significa también «todavía no elegiste fecha», y en la prueba, «todavía no te
 * toca». Por eso se le pregunta a su proceso, que es la respuesta del backend
 * que sí lo dice: si el proceso también contesta 404, la vacante ya no está.
 * Es la misma consulta —y la misma caché— que usa `Proceso`.
 */

import { useCallback, useRef } from 'react'
import { type QueryKey, useQuery, useQueryClient } from '@tanstack/react-query'
import { ErrorApi } from '@/api/cliente'
import { verPostulacion } from '@/api/portal'

/**
 * - `comprobando`: el fallo es un 404 y todavía se está preguntando al proceso.
 * - `retirada`: su proceso tampoco existe; hay que decir que la vacante ya no está.
 * - `no`: cualquier otro caso; la pantalla sigue con su propio mensaje.
 */
export type QueDiceSuProceso = 'comprobando' | 'retirada' | 'no'

const esUn404 = (causa: unknown): boolean => causa instanceof ErrorApi && causa.estado === 404

export function useVacanteRetirada(uuid: string, fallo: unknown): QueDiceSuProceso {
  const preguntar = uuid !== '' && esUn404(fallo)
  const proceso = useQuery({
    queryKey: ['postulacion', uuid],
    queryFn: () => verPostulacion(uuid),
    enabled: preguntar,
    // Siempre al servidor: un detalle guardado de hace un rato es justo el de
    // antes de que la retiraran, y diría que el proceso sigue ahí.
    staleTime: 0,
  })

  if (!preguntar) return 'no'
  if (proceso.isPending || proceso.isFetching) return 'comprobando'
  return proceso.isError && esUn404(proceso.error) ? 'retirada' : 'no'
}

/** Para las mutaciones: un 404 al escribir es la misma puerta que se cerró. */
export const esPuertaCerrada = esUn404

export interface PantallaAbierta {
  /** Lo que dice su proceso del fallo de la consulta de la pantalla: ver `useVacanteRetirada`. */
  retirada: QueDiceSuProceso
  /**
   * Para el `onError` de lo que escribe: empezar, guardar una respuesta, entregar. Un 404
   * vuelve a pedir la pantalla; si la vacante ya no está, esa lectura también contesta 404 y
   * la pantalla entera pasa a decirlo. Devuelve si era un 404.
   */
  siSeCerroLaPuerta: (causa: unknown) => boolean
  /**
   * Si el fallo de un botón se puede enseñar ya. Un 404 se calla mientras se comprueba —si es
   * la vacante retirada, lo que se ve es el aviso y no el texto del servidor dentro de un
   * modal— y se enseña si la pantalla sigue ahí: entonces era otra cosa y hay que decirlo.
   */
  seEnsena: (causa: unknown) => boolean
}

/**
 * Una pantalla que se queda abierta —la prueba, la evaluación, el cuestionario técnico, las
 * fechas de la simulación— mientras la empresa retira la vacante.
 *
 * Al recargar ya lo dice `useVacanteRetirada`. Pero con la pantalla abierta desde antes,
 * quien se entera es el botón: empezar, responder o entregar contestan 404. La evaluación
 * se lo tragaba —«Empezar» no hacía nada y cada respuesta quedaba en «No se pudo
 * guardar»— y el cuestionario técnico enseñaba el texto crudo del servidor. Aquí vive lo
 * que hacen las cuatro, para que no se arregle en una y se olvide en otra.
 *
 * @param clave la consulta de la pantalla, la que se vuelve a pedir tras un 404 al escribir.
 * @param consulta su estado: de su error sale `retirada`, y mientras vuelve a preguntar un
 *   404 de un botón no se enseña.
 */
export function usePantallaAbierta(
  uuid: string,
  clave: QueryKey,
  consulta: { error: unknown; isFetching: boolean },
): PantallaAbierta {
  const cache = useQueryClient()
  const retirada = useVacanteRetirada(uuid, consulta.error)
  // En una referencia: la clave llega como un arreglo nuevo en cada render, y el `onError`
  // que la usa tiene que ser estable.
  const laClave = useRef(clave)
  laClave.current = clave

  const siSeCerroLaPuerta = useCallback(
    (causa: unknown) => {
      if (!esUn404(causa)) return false
      void cache.invalidateQueries({ queryKey: laClave.current })
      return true
    },
    [cache],
  )

  const seEnsena = (causa: unknown) =>
    !esUn404(causa) || (!consulta.isFetching && retirada === 'no')

  return { retirada, siSeCerroLaPuerta, seEnsena }
}
