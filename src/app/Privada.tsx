/**
 * El guardia de las pantallas privadas.
 *
 * Como en el mockup, no desvia: enseña la tarjeta de «ingresa para ver tu
 * proceso» en el sitio donde estaba la pagina. Asi la direccion no cambia y,
 * al entrar, se vuelve exactamente aqui.
 */

import type { ReactNode } from 'react'
import { useSesion } from './Sesion'
import { AccesoNecesario } from '@/ui/Mensajes'

export function Privada({ children }: { children: ReactNode }) {
  const { hayCuenta } = useSesion()
  return hayCuenta ? <>{children}</> : <AccesoNecesario />
}
