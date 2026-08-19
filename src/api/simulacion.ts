/** `SimulacionPortalController`: elegir fecha y ver la sesion propia. */

import { pedir } from './cliente'
import type { MiSesion, SesionDisponible } from './tipos'

/** Las sesiones con cupo para esta postulacion. Sin la matriz, a proposito. */
export const sesionesDisponibles = (uuid: string) =>
  pedir<SesionDisponible[]>(`/simulacion/${uuid}/sesiones`)

export const inscribirse = (uuid: string, sesionId: number) =>
  pedir<MiSesion>(`/simulacion/${uuid}/sesiones/${sesionId}`, { metodo: 'POST' })

/** La sesion en la que ya esta inscrito, con sus tramos. */
export const miSesion = (uuid: string) => pedir<MiSesion>(`/simulacion/${uuid}`)
