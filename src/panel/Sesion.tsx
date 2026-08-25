/**
 * La sesion del equipo, aparte de la del candidato.
 *
 * Son dos personas distintas con dos tokens distintos: quien revisa candidatos
 * puede tener a la vez una pestaña del portal abierta, y cerrar una sesion no
 * puede tirar la otra. Por eso el panel tiene su puerta y su proveedor propios.
 */

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { alCaerLaSesion, borrarToken, guardarToken, leerToken } from './api/cliente'
import { entrarComoEquipo } from './api/panel'

interface Sesion {
  hayEquipo: boolean
  entrar: (usuarioRenaserOsId: string) => Promise<void>
  salir: () => void
}

const Contexto = createContext<Sesion | null>(null)

export function ProveedorSesionPanel({ children }: { children: ReactNode }) {
  const [hayEquipo, setHayEquipo] = useState(() => leerToken() !== null)

  // Un 401 en cualquier llamada borra el token en la puerta; aqui solo hay que
  // enterarse para volver a enseñar la pantalla de entrar.
  useEffect(() => alCaerLaSesion(() => setHayEquipo(false)), [])

  const entrar = useCallback(async (usuarioRenaserOsId: string) => {
    const sesion = await entrarComoEquipo(usuarioRenaserOsId)
    guardarToken(sesion.token)
    setHayEquipo(true)
  }, [])

  const salir = useCallback(() => {
    borrarToken()
    setHayEquipo(false)
  }, [])

  const valor = useMemo(() => ({ hayEquipo, entrar, salir }), [hayEquipo, entrar, salir])

  return <Contexto value={valor}>{children}</Contexto>
}

export function useSesionPanel(): Sesion {
  const sesion = use(Contexto)
  if (!sesion) throw new Error('useSesionPanel necesita estar dentro de <ProveedorSesionPanel>')
  return sesion
}
