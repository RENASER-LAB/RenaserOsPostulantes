/**
 * La unica puerta al backend.
 *
 * Se encarga de tres cosas que si se dejan sueltas acaban mal:
 *   - poner el token en cada peticion,
 *   - convertir un error HTTP en algo que la pantalla pueda enseñar,
 *   - apuntar la hora del servidor en cada respuesta, para los cronometros.
 */

import { anotarHoraDelServidor } from '@/dominio/reloj'

const BASE = '/api/v1/portal'
const CLAVE_TOKEN = 'renaser_portal_token'

// ---------- El token ----------

export function leerToken(): string | null {
  try {
    return localStorage.getItem(CLAVE_TOKEN)
  } catch {
    return null
  }
}

export function guardarToken(token: string): void {
  try {
    localStorage.setItem(CLAVE_TOKEN, token)
  } catch {
    // Navegacion privada con el almacenamiento bloqueado: la sesion dura
    // lo que dure la pestaña y ya.
  }
}

export function borrarToken(): void {
  try {
    localStorage.removeItem(CLAVE_TOKEN)
  } catch {
    /* igual que arriba */
  }
}

// ---------- Los errores ----------

export class ErrorApi extends Error {
  readonly estado: number
  readonly cuerpo: unknown

  constructor(estado: number, mensaje: string, cuerpo?: unknown) {
    super(mensaje)
    this.name = 'ErrorApi'
    this.estado = estado
    this.cuerpo = cuerpo
  }

  /** El token no vale o caduco: hay que volver a entrar. */
  get esSesionCaida(): boolean {
    return this.estado === 401
  }

  /**
   * Un 404 del backend tambien significa «esto no es tuyo»: el alcance se
   * aplica dentro de la consulta. No distinguirlos es a proposito.
   */
  get esAjeno(): boolean {
    return this.estado === 403 || this.estado === 404
  }
}

/** Lo que Spring devuelve en un error de validacion, en la medida en que se pueda leer. */
interface CuerpoDeError {
  message?: string
  detail?: string
  errors?: { defaultMessage?: string }[]
}

function mensajeDe(estado: number, cuerpo: unknown): string {
  const c = cuerpo as CuerpoDeError | null
  const deValidacion = c?.errors?.find((e) => e.defaultMessage)?.defaultMessage
  if (deValidacion) return deValidacion
  if (c?.detail) return c.detail
  if (c?.message) return c.message

  if (estado === 401) return 'Tu sesión terminó. Vuelve a ingresar.'
  if (estado === 403 || estado === 404) return 'No encontramos eso, o no es tuyo.'
  if (estado === 413) return 'El archivo pesa demasiado.'
  if (estado >= 500) return 'El sistema tuvo un problema. Inténtalo de nuevo en un momento.'
  return 'No se pudo completar la operación.'
}

// ---------- La peticion ----------

interface Opciones {
  metodo?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  /** Se manda como JSON. */
  cuerpo?: unknown
  /** Se manda tal cual, sin cabecera de tipo: lo pone el navegador. */
  formulario?: FormData
  /** Para las rutas publicas: no adjunta el token aunque lo haya. */
  sinToken?: boolean
  senal?: AbortSignal
}

export async function pedir<T>(ruta: string, opciones: Opciones = {}): Promise<T> {
  const { metodo = 'GET', cuerpo, formulario, sinToken, senal } = opciones

  const cabeceras: Record<string, string> = {}
  if (cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json'

  const token = sinToken ? null : leerToken()
  if (token) cabeceras.Authorization = `Bearer ${token}`

  let respuesta: Response
  try {
    respuesta = await fetch(`${BASE}${ruta}`, {
      method: metodo,
      headers: cabeceras,
      body: formulario ?? (cuerpo === undefined ? undefined : JSON.stringify(cuerpo)),
      signal: senal,
    })
  } catch (causa) {
    // Sin red, o el backend apagado. No es un error HTTP: no hay estado.
    throw new ErrorApi(0, 'No pudimos conectar. Revisa tu conexión.', causa)
  }

  anotarHoraDelServidor(respuesta.headers.get('Date'))

  // Muchas rutas del portal devuelven 204 sin cuerpo, y un error tambien puede
  // venir vacio. El estado manda: primero se mira si fallo, y solo despues si
  // hay algo que leer. Al reves, un 500 sin cuerpo se colaba como exito.
  const sinCuerpo =
    respuesta.status === 204 || respuesta.headers.get('Content-Length') === '0'

  if (!respuesta.ok) {
    const leido = sinCuerpo ? null : await leerCuerpo(respuesta)
    throw new ErrorApi(respuesta.status, mensajeDe(respuesta.status, leido), leido)
  }

  if (sinCuerpo) return undefined as T
  return (await leerCuerpo(respuesta)) as T
}

async function leerCuerpo(respuesta: Response): Promise<unknown> {
  const esJson = respuesta.headers.get('Content-Type')?.includes('application/json') ?? false
  return esJson
    ? await respuesta.json().catch(() => null)
    : await respuesta.text().catch(() => null)
}
