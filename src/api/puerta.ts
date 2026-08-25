/**
 * La fabrica de puertas al backend.
 *
 * Existia una sola puerta —la del portal del candidato— y al llegar el panel
 * del equipo hicieron falta dos: otra base (`/api/v1/panel`), otro token, y
 * sobre todo **otra sesion**. Un 401 del panel no puede cerrarle la sesion al
 * candidato ni al reves, asi que cada puerta lleva sus propias escuchas.
 *
 * Lo que una puerta hace, y que suelto acababa mal:
 *   - poner su token en cada peticion,
 *   - convertir un error HTTP en algo que la pantalla pueda enseñar,
 *   - apuntar la hora del servidor en cada respuesta, para los cronometros,
 *   - avisar una sola vez cuando el token deja de valer.
 */

import { anotarHoraDelServidor } from '@/dominio/reloj'

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

/**
 * Lo que Spring devuelve en un error, en la medida en que se pueda leer.
 *
 * `errors` llega como un objeto —campo: mensaje—, no como una lista: el backend
 * lo arma con un `Map` en `GlobalControllerAdvice`. Leerlo como lista reventaba
 * al construir el mensaje y quien miraba acababa viendo un error del navegador
 * en vez de lo que el servidor le estaba diciendo.
 */
interface CuerpoDeError {
  message?: string
  detail?: string
  errors?: Record<string, string> | { defaultMessage?: string }[]
}

function mensajeDe(estado: number, cuerpo: unknown): string {
  const c = cuerpo as CuerpoDeError | null
  const errores = c?.errors
  const deValidacion = Array.isArray(errores)
    ? errores.find((e) => e.defaultMessage)?.defaultMessage
    : Object.values(errores ?? {}).find((m) => typeof m === 'string' && m.trim() !== '')
  if (deValidacion) return deValidacion
  if (c?.detail) return c.detail
  if (c?.message) return c.message

  if (estado === 401) return 'Tu sesión terminó. Vuelve a ingresar.'
  if (estado === 403 || estado === 404) return 'No encontramos eso, o no es tuyo.'
  if (estado === 413) return 'El archivo pesa demasiado.'
  if (estado >= 500) return 'El sistema tuvo un problema. Inténtalo de nuevo en un momento.'
  // El codigo va dentro a proposito: cuando el backend rechaza algo sin decir
  // por que —un 400 pelado—, sin el numero no hay manera de distinguir si el
  // problema es el dato que se manda, la sesion o el estado de la operacion.
  return `No se pudo completar la operación (error ${estado}).`
}

async function leerCuerpo(respuesta: Response): Promise<unknown> {
  // Ojo con el tipo: Spring manda los errores como `application/problem+json`,
  // no como `application/json`. Buscando la cadena entera, TODO error del
  // backend se leia como texto plano y su explicacion se perdia. Se busca
  // «json» a secas.
  const tipo = respuesta.headers.get('Content-Type') ?? ''
  return tipo.includes('json')
    ? await respuesta.json().catch(() => null)
    : await respuesta.text().catch(() => null)
}

export interface Opciones {
  metodo?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  /** Se manda como JSON. */
  cuerpo?: unknown
  /** Se manda tal cual, sin cabecera de tipo: lo pone el navegador. */
  formulario?: FormData
  /** Para las rutas publicas: no adjunta el token aunque lo haya. */
  sinToken?: boolean
  senal?: AbortSignal
}

export interface Puerta {
  pedir: <T>(ruta: string, opciones?: Opciones) => Promise<T>
  leerToken: () => string | null
  guardarToken: (token: string) => void
  borrarToken: () => void
  /** Avisa cuando un 401 revela que el token ya no vale. Devuelve el desenganche. */
  alCaerLaSesion: (escucha: () => void) => () => void
}

export function crearPuerta(base: string, claveToken: string): Puerta {
  const escuchas = new Set<() => void>()

  function leerToken(): string | null {
    try {
      return localStorage.getItem(claveToken)
    } catch {
      return null
    }
  }

  function guardarToken(token: string): void {
    try {
      localStorage.setItem(claveToken, token)
    } catch {
      // Navegacion privada con el almacenamiento bloqueado: la sesion dura
      // lo que dure la pestaña y ya.
    }
  }

  function borrarToken(): void {
    try {
      localStorage.removeItem(claveToken)
    } catch {
      /* igual que arriba */
    }
  }

  async function pedir<T>(ruta: string, opciones: Opciones = {}): Promise<T> {
    const { metodo = 'GET', cuerpo, formulario, sinToken, senal } = opciones

    const cabeceras: Record<string, string> = {}
    if (cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json'

    const token = sinToken ? null : leerToken()
    if (token) cabeceras.Authorization = `Bearer ${token}`

    let respuesta: Response
    try {
      respuesta = await fetch(`${base}${ruta}`, {
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

    // Muchas rutas devuelven 204 sin cuerpo, y un error tambien puede venir
    // vacio. El estado manda: primero se mira si fallo, y solo despues si hay
    // algo que leer. Al reves, un 500 sin cuerpo se colaba como exito.
    const sinCuerpo =
      respuesta.status === 204 || respuesta.headers.get('Content-Length') === '0'

    if (!respuesta.ok) {
      const leido = sinCuerpo ? null : await leerCuerpo(respuesta)

      // El token que teniamos no vale. Se tira aqui, en cuanto se sabe, para
      // que la pantalla vuelva a enseñar «Ingresar» en vez de dejar a la
      // persona dando vueltas contra un error.
      if (respuesta.status === 401 && token) {
        borrarToken()
        for (const escucha of escuchas) escucha()
      }

      throw new ErrorApi(respuesta.status, mensajeDe(respuesta.status, leido), leido)
    }

    if (sinCuerpo) return undefined as T
    return (await leerCuerpo(respuesta)) as T
  }

  return {
    pedir,
    leerToken,
    guardarToken,
    borrarToken,
    alCaerLaSesion(escucha) {
      escuchas.add(escucha)
      return () => {
        escuchas.delete(escucha)
      }
    },
  }
}
