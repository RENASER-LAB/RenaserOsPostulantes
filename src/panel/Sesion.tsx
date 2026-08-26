/**
 * La sesion del equipo, aparte de la del candidato.
 *
 * Son dos personas distintas con dos tokens distintos: quien revisa candidatos
 * puede tener a la vez una pestaña del portal abierta, y cerrar una sesion no
 * puede tirar la otra. Por eso el panel tiene su puerta y su proveedor propios.
 *
 * **El mismo correo puede existir en los dos mundos sin chocar**, y eso es a
 * proposito: son cuentas y puertas distintas. No se unifican.
 *
 * ⚠️ **El backend no dice como se llama quien entro**: la sesion es solo
 * `{ token, usuarioId }`. La unica pantalla que conoce el nombre es la de
 * aceptar la invitacion, porque lo escribe la propia persona, asi que se guarda
 * ahi — igual que hace el portal del candidato al crear la cuenta. Quien entre
 * despues desde otro navegador vera el panel sin su nombre, que es la verdad.
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
import { aceptarInvitacion, entrarAlPanel, entrarComoEquipo } from './api/panel'
import type { AceptarInvitacionPanel, LoginPanel } from './api/tipos'

/** Tercera clave del almacenamiento, junto a los dos tokens. */
const CLAVE_NOMBRE = 'renaser_panel_nombre'

interface Sesion {
  hayEquipo: boolean
  /** Como se llama quien entro, si se llego a saber. */
  nombre: string | null
  entrar: (datos: LoginPanel) => Promise<void>
  aceptar: (datos: AceptarInvitacionPanel) => Promise<void>
  /** Solo para local. Ver `entrarComoEquipo`. */
  entrarConIdDeDesarrollo: (usuarioRenaserOsId: string) => Promise<void>
  salir: () => void
}

const Contexto = createContext<Sesion | null>(null)

function leerNombre(): string | null {
  try {
    return localStorage.getItem(CLAVE_NOMBRE)
  } catch {
    return null
  }
}

function guardarNombre(nombre: string): void {
  try {
    localStorage.setItem(CLAVE_NOMBRE, nombre)
  } catch {
    // Navegacion privada con el almacenamiento bloqueado: se pierde el nombre,
    // no la sesion.
  }
}

function olvidarNombre(): void {
  try {
    localStorage.removeItem(CLAVE_NOMBRE)
  } catch {
    /* igual que arriba */
  }
}

export function ProveedorSesionPanel({ children }: { children: ReactNode }) {
  const [hayEquipo, setHayEquipo] = useState(() => leerToken() !== null)
  const [nombre, setNombre] = useState(leerNombre)

  // Un 401 en cualquier llamada borra el token en la puerta; aqui solo hay que
  // enterarse para volver a enseñar la pantalla de entrar.
  useEffect(
    () =>
      alCaerLaSesion(() => {
        setHayEquipo(false)
        olvidarNombre()
        setNombre(null)
      }),
    [],
  )

  const entrar = useCallback(async (datos: LoginPanel) => {
    const sesion = await entrarAlPanel(datos)
    guardarToken(sesion.token)
    setHayEquipo(true)
  }, [])

  const aceptar = useCallback(async (datos: AceptarInvitacionPanel) => {
    const sesion = await aceptarInvitacion(datos)
    guardarToken(sesion.token)
    // El unico momento en que el panel sabe como se llama alguien: lo acaba de
    // escribir. Se guarda despues del token, no antes: si el canje falla, no
    // queda un nombre suelto de una sesion que nunca existio.
    const completo = `${datos.nombre.trim()} ${datos.apellidos.trim()}`.trim()
    if (completo !== '') {
      guardarNombre(completo)
      setNombre(completo)
    }
    setHayEquipo(true)
  }, [])

  const entrarConIdDeDesarrollo = useCallback(async (usuarioRenaserOsId: string) => {
    const sesion = await entrarComoEquipo(usuarioRenaserOsId)
    guardarToken(sesion.token)
    setHayEquipo(true)
  }, [])

  const salir = useCallback(() => {
    borrarToken()
    olvidarNombre()
    setNombre(null)
    setHayEquipo(false)
  }, [])

  const valor = useMemo(
    () => ({ hayEquipo, nombre, entrar, aceptar, entrarConIdDeDesarrollo, salir }),
    [hayEquipo, nombre, entrar, aceptar, entrarConIdDeDesarrollo, salir],
  )

  return <Contexto value={valor}>{children}</Contexto>
}

export function useSesionPanel(): Sesion {
  const sesion = use(Contexto)
  if (!sesion) throw new Error('useSesionPanel necesita estar dentro de <ProveedorSesionPanel>')
  return sesion
}
