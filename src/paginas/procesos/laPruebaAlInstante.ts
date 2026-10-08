/**
 * La prueba al instante (V70), vista desde el portal.
 *
 * En las vacantes con pase automático, entregar el banco —o postular, si la vacante no lo
 * lleva— abre la prueba del puesto en la misma respuesta del servidor. El portal no lo
 * adivina: vuelve a pedir la postulación recién guardada y mira dónde quedó. Si quedó en la
 * prueba, lleva a su portada; si no, el camino de siempre.
 *
 * ⚠️ **Preguntar y no suponer.** La respuesta de entregar no dice si hubo pase: el pase corre
 * después de guardar la entrega, y puede no darse (la vacante sin prueba montada, o sin pase
 * automático). Lo único que dice la verdad es el estado de la postulación ya guardada.
 */

import type { QueryClient } from '@tanstack/react-query'
import { verPostulacion } from '@/api/portal'
import { portadaDeLaPrueba } from '@/dominio/estados'

/**
 * La portada de su prueba si ya puede rendirla, o `null` si le toca esperar.
 *
 * Si la consulta falla, `null`: un fallo aquí no puede dejar al candidato sin salida después
 * de haber entregado bien, y el camino de siempre —su proceso— le enseña lo mismo.
 */
export async function portadaSiYaTieneLaPrueba(
  cache: QueryClient,
  uuid: string,
): Promise<string | null> {
  try {
    const detalle = await cache.fetchQuery({
      queryKey: ['postulacion', uuid],
      queryFn: () => verPostulacion(uuid),
    })
    return detalle?.resumen ? portadaDeLaPrueba(detalle.resumen) : null
  } catch {
    return null
  }
}
