/**
 * Quien esta dentro.
 *
 * **El backend dice como se llama, y por dos caminos.** Entrar —con contrasena
 * o con el enlace del correo— devuelve `nombre` y `apellidos` junto al token.
 * Pero el portal solo entra una vez: a partir de la segunda visita arranca de
 * un token guardado, y entonces los pide con `quienSoy()`.
 *
 * ⚠️ **Los dos caminos hacen falta.** Con solo el primero, quien volvia al dia
 * siguiente —o abria el portal en otro navegador, o vaciaba el almacenamiento—
 * veia la cabecera de su perfil diciendo «Tu perfil» sobre un disco de
 * iniciales vacio: el token seguia valiendo y el nombre no estaba en ningun
 * sitio.
 *
 * Se sigue guardando en `localStorage`, pero ya solo como **respaldo**: es lo
 * que evita que el portal se quede sin saludo entre la recarga de la pagina y
 * la primera respuesta del servidor. Lo que manda es lo que dice el backend.
 *
 * Los dos pueden venir vacios: `persona` los admite en null.
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
import { useQueryClient } from '@tanstack/react-query'
import { alCaerLaSesion, borrarToken, guardarToken, leerToken } from '@/api/cliente'
import { accederConEnlace, crearCuenta, ingresar, quienSoy } from '@/api/portal'
import type { CrearCuenta, Login, Sesion as SesionApi } from '@/api/tipos'

const CLAVE_NOMBRE = 'renaser_portal_nombre'
const CLAVE_APELLIDOS = 'renaser_portal_apellidos'

interface Sesion {
  token: string | null
  nombre: string | null
  apellidos: string | null
  /** El nombre de pila, para saludar. */
  saludo: string | null
  hayCuenta: boolean
  entrar: (datos: Login) => Promise<void>
  /** Entrar con el enlace del correo, sin contrasena. */
  entrarConEnlace: (token: string) => Promise<void>
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

function leerApellidos(): string | null {
  try {
    return localStorage.getItem(CLAVE_APELLIDOS)
  } catch {
    return null
  }
}

function guardarNombre(nombre: string | null, apellidos: string | null): void {
  try {
    if (nombre) localStorage.setItem(CLAVE_NOMBRE, nombre)
    else localStorage.removeItem(CLAVE_NOMBRE)
    if (apellidos) localStorage.setItem(CLAVE_APELLIDOS, apellidos)
    else localStorage.removeItem(CLAVE_APELLIDOS)
  } catch {
    /* almacenamiento bloqueado */
  }
}

function olvidarNombre(): void {
  try {
    localStorage.removeItem(CLAVE_NOMBRE)
    localStorage.removeItem(CLAVE_APELLIDOS)
  } catch {
    /* almacenamiento bloqueado */
  }
}

export function ProveedorSesion({ children }: { children: ReactNode }) {
  /*
    ⚠️ **La cache se vacia al cerrar sesion, y no es limpieza de cortesia.** Lo
    que hay dentro es de la persona que estaba: su perfil, sus procesos y —lo
    que de verdad se ve— la url del blob de su foto, que sigue valiendo aunque
    el token no. Sin esto, la cuenta siguiente que entrara en la misma pestaña
    veia la foto de la anterior. `clear()` ademas dispara el `removed` de cada
    consulta, que es lo que suelta esas urls (`soltarUrlsDeArchivos`).

    Funciona porque `QueryClientProvider` envuelve a este proveedor en `App`.
  */
  const cache = useQueryClient()
  const [token, setToken] = useState<string | null>(() => leerToken())
  const [nombre, setNombre] = useState<string | null>(() => leerNombre())
  const [apellidos, setApellidos] = useState<string | null>(() => leerApellidos())

  /** Lo que dice el servidor manda, y se deja de respaldo para la proxima carga. */
  const asentar = useCallback((sesion: SesionApi) => {
    guardarToken(sesion.token)
    guardarNombre(sesion.nombre, sesion.apellidos)
    setToken(sesion.token)
    setNombre(sesion.nombre)
    setApellidos(sesion.apellidos)
  }, [])

  const entrar = useCallback(
    async (datos: Login) => asentar(await ingresar(datos)),
    [asentar],
  )

  // Quien entra por el enlace del correo tampoco se queda sin nombre: desde que
  // el backend lo devuelve, esta puerta trae lo mismo que la otra.
  const entrarConEnlace = useCallback(
    async (token: string) => asentar(await accederConEnlace(token)),
    [asentar],
  )

  const registrar = useCallback(
    async (datos: CrearCuenta) => {
      await crearCuenta(datos)
      // El backend no devuelve sesion al crear la cuenta: hay que entrar despues.
      asentar(await ingresar({ correo: datos.correo, contrasena: datos.contrasena }))
    },
    [asentar],
  )

  const salir = useCallback(() => {
    borrarToken()
    olvidarNombre()
    cache.clear()
    setToken(null)
    setNombre(null)
    setApellidos(null)
  }, [cache])

  // Con token guardado y sin nombre, se le pregunta al servidor.
  //
  // ⚠️ **Es el caso normal, no el raro.** Entrar trae el nombre una vez; a
  // partir de la segunda visita el portal arranca de un token guardado, y sin
  // esto no habia a quien preguntarselo: la cabecera del perfil decia «Tu
  // perfil» sobre un disco de iniciales vacio. Pasa igual en otro navegador y
  // tras vaciar el almacenamiento, que es lo que este respaldo no cubre.
  //
  // Si falla no se hace nada: quedarse sin saludo es peor que un portal que no
  // abre, y un token caido ya lo cierra `alCaerLaSesion` por su cuenta.
  useEffect(() => {
    if (token === null || nombre !== null) return
    let vigente = true
    quienSoy()
      .then((yo) => {
        if (!vigente || yo.nombre === null) return
        guardarNombre(yo.nombre, yo.apellidos)
        setNombre(yo.nombre)
        setApellidos(yo.apellidos)
      })
      .catch(() => {})
    return () => {
      vigente = false
    }
  }, [token, nombre])

  // Si el cliente descubre que el token ya no vale, la sesion se cierra sola y
  // el portal vuelve a enseñar «Ingresar».
  useEffect(() => {
    return alCaerLaSesion(() => {
      olvidarNombre()
      cache.clear()
      setToken(null)
      setNombre(null)
      setApellidos(null)
    })
  }, [cache])

  const valor = useMemo<Sesion>(
    () => ({
      token,
      nombre,
      apellidos,
      saludo: nombre?.trim().split(/\s+/)[0] ?? null,
      hayCuenta: token !== null,
      entrar,
      entrarConEnlace,
      registrar,
      salir,
    }),
    [token, nombre, apellidos, entrar, entrarConEnlace, registrar, salir],
  )

  return <Contexto value={valor}>{children}</Contexto>
}

export function useSesion(): Sesion {
  const sesion = use(Contexto)
  if (!sesion) throw new Error('useSesion necesita estar dentro de <ProveedorSesion>')
  return sesion
}
