/**
 * Quien esta dentro.
 *
 * El backend devuelve solo `{ token, usuarioId }` al entrar: no hay ninguna
 * ruta que diga como se llama el candidato. Por eso el nombre se guarda al
 * crear la cuenta y, si no lo hay —por ejemplo si entra desde otro navegador—,
 * el portal saluda sin nombre en vez de inventarselo.
 */

import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react'
import { borrarToken, guardarToken, leerToken } from '@/api/cliente'
import { crearCuenta, ingresar } from '@/api/portal'
import type { CrearCuenta, Login } from '@/api/tipos'

const CLAVE_NOMBRE = 'renaser_portal_nombre'

interface Sesion {
  token: string | null
  nombre: string | null
  /** El nombre de pila, para saludar. */
  saludo: string | null
  hayCuenta: boolean
  entrar: (datos: Login) => Promise<void>
  registrar: (datos: CrearCuenta) => Promise<void>
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
    /* almacenamiento bloqueado */
  }
}

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => leerToken())
  const [nombre, setNombre] = useState<string | null>(() => leerNombre())

  const entrar = useCallback(async (datos: Login) => {
    const sesion = await ingresar(datos)
    guardarToken(sesion.token)
    setToken(sesion.token)
  }, [])

  const registrar = useCallback(async (datos: CrearCuenta) => {
    await crearCuenta(datos)
    // El backend no devuelve sesion al crear la cuenta: hay que entrar despues.
    const sesion = await ingresar({ correo: datos.correo, contrasena: datos.contrasena })
    const completo = `${datos.nombre} ${datos.apellidos}`.trim()
    guardarToken(sesion.token)
    guardarNombre(completo)
    setToken(sesion.token)
    setNombre(completo)
  }, [])

  const salir = useCallback(() => {
    borrarToken()
    try {
      localStorage.removeItem(CLAVE_NOMBRE)
    } catch {
      /* almacenamiento bloqueado */
    }
    setToken(null)
    setNombre(null)
  }, [])

  const valor = useMemo<Sesion>(
    () => ({
      token,
      nombre,
      saludo: nombre?.trim().split(/\s+/)[0] ?? null,
      hayCuenta: token !== null,
      entrar,
      registrar,
      salir,
    }),
    [token, nombre, entrar, registrar, salir],
  )

  return <Contexto value={valor}>{children}</Contexto>
}

export function useSesion(): Sesion {
  const sesion = use(Contexto)
  if (!sesion) throw new Error('useSesion necesita estar dentro de <ProveedorSesion>')
  return sesion
}
