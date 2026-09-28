/**
 * `ResenasPanelController` y `ModeracionResenasController` (V63).
 *
 * Todo entra por una postulación de la propia empresa: lo ajeno responde 404
 * sin confirmar que existe. La lectura de las reseñas que OTRAS empresas le
 * dejaron a la persona es la única excepción, y va por la persona de esa
 * postulación.
 *
 * ⚠️ **Las reseñas no puntúan.** No entran en notas, ni en el orden por defecto
 * del ranking, ni en el Excel, ni en la IA.
 */

import { pedir } from './cliente'
import type {
  EscribirResena,
  LaResenaDeMiEmpresa,
  ReportarRespuesta,
  ReporteParaModerar,
  ResenasDeLaPostulacion,
  ResolverReporte,
} from './tipos'

const base = (postulacionId: number) => `/postulaciones/${postulacionId}`

/**
 * Las reseñas de la persona y el bloque de mi empresa. Pide `ver_resenas_candidato`
 * o `resenar_contratado`: sin ninguno de los dos, 403.
 */
export const verResenas = (postulacionId: number) =>
  pedir<ResenasDeLaPostulacion>(`${base(postulacionId)}/resenas`)

/** Desde los 30 días de la contratación; 409 si ya hay una. */
export const publicarResena = (postulacionId: number, datos: EscribirResena) =>
  pedir<LaResenaDeMiEmpresa>(`${base(postulacionId)}/resena`, { metodo: 'POST', cuerpo: datos })

/** Durante los 30 días desde su primera publicación; 409 pasado el plazo. */
export const editarResena = (postulacionId: number, datos: EscribirResena) =>
  pedir<LaResenaDeMiEmpresa>(`${base(postulacionId)}/resena`, { metodo: 'PUT', cuerpo: datos })

/** Dentro de su plazo: la respuesta se va con ella y la contratación queda libre. */
export const borrarResena = (postulacionId: number) =>
  pedir<LaResenaDeMiEmpresa>(`${base(postulacionId)}/resena`, { metodo: 'DELETE' })

/** Solo la empresa autora, y solo quien tiene `resenar_contratado` en esa contratación. */
export const reportarRespuesta = (postulacionId: number, datos: ReportarRespuesta) =>
  pedir<LaResenaDeMiEmpresa>(`${base(postulacionId)}/resena/respuesta/reporte`, {
    metodo: 'POST',
    cuerpo: datos,
  })

/**
 * «Reseñas reportadas». Doble llave: `moderar_resenas` y ser la plataforma; sin
 * las dos, 403 y la sección no se pinta.
 */
export const reportesDeResenas = (resueltos: boolean) =>
  pedir<ReporteParaModerar[]>(`/resenas-reportadas?resueltos=${resueltos}`)

/** Mantener u ocultar, con la nota de la revisión. Ocultar es definitivo. */
export const resolverReporte = (id: number, datos: ResolverReporte) =>
  pedir<ReporteParaModerar>(`/resenas-reportadas/${id}/resolucion`, {
    metodo: 'POST',
    cuerpo: datos,
  })
