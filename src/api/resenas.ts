/**
 * `ResenasPortalController`: las reseñas que las empresas que la contrataron le
 * dejaron a la persona (V63).
 *
 * Todo es suyo: el backend busca cada reseña con la persona de la sesion, y una
 * ajena —o una que la empresa borro o la plataforma oculto— responde 404. El
 * portal lo dice con «Esta reseña ya no está disponible».
 *
 * ⚠️ **Las reseñas no puntuan.** No entran en ninguna nota ni en el orden de
 * ningun ranking: solo se leen.
 */

import { pedir } from './cliente'
import type { MisResenas, ReportarResena } from './tipos'

/** Las visibles, las mas recientes arriba, con el resumen. */
export const misResenas = () => pedir<MisResenas>('/resenas')

/** Sigue visible y contando mientras se revisa. 409 si ya esta reportada. */
export const reportarResena = (id: number, datos: ReportarResena) =>
  pedir<void>(`/resenas/${id}/reporte`, { metodo: 'POST', cuerpo: datos })

/** De 30 a 500 caracteres; una por reseña. */
export const responderResena = (id: number, texto: string) =>
  pedir<void>(`/resenas/${id}/respuesta`, { metodo: 'POST', cuerpo: { texto } })

/** Dentro de su plazo; 409 si ya vencio. */
export const editarRespuesta = (id: number, texto: string) =>
  pedir<void>(`/resenas/${id}/respuesta`, { metodo: 'PUT', cuerpo: { texto } })

/** Dentro de su plazo: despues puede volver a responder. */
export const borrarRespuesta = (id: number) =>
  pedir<void>(`/resenas/${id}/respuesta`, { metodo: 'DELETE' })
