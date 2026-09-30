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
 * ⚠️ **El login no dice como se llama quien entro**: la respuesta es solo
 * `{ token, usuarioId }`. Desde la V64 el armazon pide `GET /panel/sesion`
 * —nombre, empresa y permisos, para pintar el menu— y es de ahi de donde sale
 * el nombre de la barra. El de aqui es el que la persona escribio al aceptar la
 * invitacion, y queda como respaldo si esa consulta no llega.
 */

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
  /** Ver `useRetenerLaSesion`. Devuelve cómo soltarla. */
  retener: () => () => void
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

  const cerrar = useCallback(() => {
    setHayEquipo(false)
    olvidarNombre()
    setNombre(null)
  }, [])

  /*
    Los formularios abiertos que retienen la sesion, y si cayo mientras tanto.
    Refs y no estado: cambian sin que nada tenga que volver a pintarse.
  */
  const retenidos = useRef(0)
  const caidaRetenida = useRef(false)

  // Un 401 en cualquier llamada borra el token en la puerta; aqui solo hay que
  // enterarse para volver a enseñar la pantalla de entrar. Salvo si hay un
  // formulario abierto: saltar a «Entrar» lo desmontaria con lo escrito dentro.
  // Ese formulario ya dice que la sesion caduco; aqui se espera a que se cierre.
  useEffect(
    () =>
      alCaerLaSesion(() => {
        if (retenidos.current > 0) {
          caidaRetenida.current = true
          return
        }
        cerrar()
      }),
    [cerrar],
  )

  const retener = useCallback(() => {
    retenidos.current += 1
    let suelta = false
    return () => {
      if (suelta) return
      suelta = true
      retenidos.current -= 1
      if (retenidos.current > 0 || !caidaRetenida.current) return
      caidaRetenida.current = false
      // Si entro de nuevo en otra pestaña, el token ya esta otra vez: se sigue.
      if (leerToken() === null) cerrar()
    }
  }, [cerrar])

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
    () => ({ hayEquipo, nombre, entrar, aceptar, entrarConIdDeDesarrollo, salir, retener }),
    [hayEquipo, nombre, entrar, aceptar, entrarConIdDeDesarrollo, salir, retener],
  )

  return <Contexto value={valor}>{children}</Contexto>
}

export function useSesionPanel(): Sesion {
  const sesion = use(Contexto)
  if (!sesion) throw new Error('useSesionPanel necesita estar dentro de <ProveedorSesionPanel>')
  return sesion
}

/**
 * Mientras `activo`, una sesión que caduca no saca de la pantalla.
 *
 * Es para los formularios con algo escrito: un 401 al guardar desmontaría el
 * formulario con el salto a «Entrar», y la spec pide avisar sin perder lo
 * escrito. El formulario dice que la sesión caducó (`explicarFallo`) y ofrece
 * entrar en otra pestaña; al volver, guardar funciona con el token nuevo. Si se
 * cierra sin haber vuelto a entrar, entonces sí se va a «Entrar».
 *
 * Fuera del proveedor —las pruebas de una pantalla suelta— no hace nada.
 */
export function useRetenerLaSesion(activo: boolean): void {
  const sesion = use(Contexto)
  const retener = sesion?.retener
  useEffect(() => {
    if (!activo || !retener) return
    return retener()
  }, [activo, retener])
}
