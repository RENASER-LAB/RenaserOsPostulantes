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
 *
 * Y desde la version movil, dos costuras mas —`ORIGEN` y `Almacen`, las dos
 * documentadas abajo—. **En la web las dos valen lo de siempre**: origen vacio
 * y `localStorage`. Existen porque una aplicacion instalada no tiene ningun
 * servidor delante que reescriba `/api`, y porque el almacenamiento de una
 * WebView es de usar y tirar.
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

/**
 * El origen del backend, delante de la base de cada puerta.
 *
 * **Vacio en la web, y ahi esta el punto**: la ruta sigue siendo relativa y la
 * reescriben Vite en desarrollo y `vercel.json` en produccion, exactamente como
 * hasta hoy. Una aplicacion instalada no tiene ningun servidor delante que
 * reescriba nada, asi que su compilacion (`npm run build:movil`) lo rellena.
 *
 * ⚠️ **Apunta a Vercel, no al backend.** La direccion del backend es una IP
 * prestada de `nip.io` que este proyecto ya tiene marcada como provisional: si
 * viajara dentro del `.aab`, el dia que Renaser tenga dominio propio **todas
 * las apps instaladas dejarian de conectar a la vez**. Yendo por Vercel, ese
 * cambio sigue siendo una linea de `vercel.json` y nadie tiene que actualizar.
 */
const ORIGEN = import.meta.env.VITE_ORIGEN_API ?? ''

/**
 * Donde se guarda el token.
 *
 * En la web es `localStorage` y punto. Existe la costura porque el
 * almacenamiento nativo de Android **es asincrono**, y volver asincrono
 * `leerToken()` obligaria a tocar todas las pantallas: por eso la interfaz es
 * sincrona, y quien la implemente para la aplicacion guarda en memoria y
 * persiste por detras, sembrandose antes de montar React.
 *
 * ⚠️ En una WebView `localStorage` lo borra el sistema al limpiar la cache o al
 * quedarse sin espacio. Ahi eso echa a alguien de una evaluacion a medias, y
 * por eso la aplicacion no lo usa.
 */
export interface Almacen {
  leer: (clave: string) => string | null
  escribir: (clave: string, valor: string) => void
  borrar: (clave: string) => void
}

const delNavegador: Almacen = {
  leer(clave) {
    try {
      return localStorage.getItem(clave)
    } catch {
      return null
    }
  },
  escribir(clave, valor) {
    try {
      localStorage.setItem(clave, valor)
    } catch {
      // Navegacion privada con el almacenamiento bloqueado: la sesion dura
      // lo que dure la pestaña y ya.
    }
  },
  borrar(clave) {
    try {
      localStorage.removeItem(clave)
    } catch {
      /* igual que arriba */
    }
  },
}

let almacen: Almacen = delNavegador

/**
 * Cambia donde se guardan los tokens. Lo llama solo el arranque de la
 * aplicacion instalada, antes de montar React.
 */
export function usarAlmacen(otro: Almacen): void {
  almacen = otro
}

/**
 * Un archivo que devuelve el backend: el contenido y como se llama.
 *
 * El nombre sale de `Content-Disposition`, que es donde lo pone el servidor.
 * Puede faltar —una respuesta sin esa cabecera es legal— y por eso es nulable:
 * quien descarga pone entonces el suyo.
 */
export interface Archivo {
  contenido: Blob
  nombre: string | null
}

/**
 * Como se llama el archivo, segun `Content-Disposition`.
 *
 * ⚠️ **Hay dos formas y la buena es la segunda.** `filename="x.xlsx"` solo
 * admite ASCII; cuando el nombre lleva tildes —«Ingeniera de Producción»— los
 * servidores mandan ademas `filename*=UTF-8''...` percent-encoded, que es la que
 * manda segun la RFC 5987. Leyendo solo la primera, el archivo se guardaba con
 * el nombre degradado que el servidor dejo de reserva.
 */
function nombreDelArchivo(disposicion: string | null): string | null {
  if (!disposicion) return null
  const extendido = /filename\*\s*=\s*[^']*'[^']*'([^;]+)/i.exec(disposicion)
  if (extendido?.[1]) {
    try {
      return decodeURIComponent(extendido[1].trim())
    } catch {
      // Percent-encoding roto: mejor caer a la forma simple que reventar la
      // descarga por el nombre.
    }
  }
  const simple = /filename\s*=\s*"?([^";]+)"?/i.exec(disposicion)
  return simple?.[1]?.trim() ?? null
}

export interface Puerta {
  pedir: <T>(ruta: string, opciones?: Opciones) => Promise<T>
  /**
   * Lo mismo que `pedir`, pero la respuesta buena se lee como archivo.
   *
   * ⚠️ **Solo cambia el exito.** Un fallo sigue llegando como
   * `application/problem+json` aunque la ruta devuelva un `.xlsx`, asi que el
   * error se lee y se traduce por el mismo camino de siempre: leerlo como blob
   * dejaria «No se pudo completar la operación» donde el servidor explicaba que
   * esa etapa no exporta.
   */
  pedirArchivo: (ruta: string, opciones?: Opciones) => Promise<Archivo>
  leerToken: () => string | null
  guardarToken: (token: string) => void
  borrarToken: () => void
  /** Avisa cuando un 401 revela que el token ya no vale. Devuelve el desenganche. */
  alCaerLaSesion: (escucha: () => void) => () => void
}

export function crearPuerta(base: string, claveToken: string): Puerta {
  const escuchas = new Set<() => void>()

  function leerToken(): string | null {
    return almacen.leer(claveToken)
  }

  function guardarToken(token: string): void {
    almacen.escribir(claveToken, token)
  }

  function borrarToken(): void {
    almacen.borrar(claveToken)
  }

  /**
   * La peticion entera menos el ultimo paso: pedir, anotar la hora, y convertir
   * un fallo en un `ErrorApi` con lo que el servidor haya dicho.
   *
   * Existe porque leer JSON y leer un archivo comparten TODO menos esa ultima
   * linea. Duplicarla dejaria dos sitios donde tirar el token caducado, y el
   * segundo se olvidaria.
   */
  async function lanzar(
    ruta: string,
    opciones: Opciones,
  ): Promise<{ respuesta: Response; sinCuerpo: boolean }> {
    const { metodo = 'GET', cuerpo, formulario, sinToken, senal } = opciones

    const cabeceras: Record<string, string> = {}
    if (cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json'

    const token = sinToken ? null : leerToken()
    if (token) cabeceras.Authorization = `Bearer ${token}`

    let respuesta: Response
    try {
      respuesta = await fetch(`${ORIGEN}${base}${ruta}`, {
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

    return { respuesta, sinCuerpo }
  }

  async function pedir<T>(ruta: string, opciones: Opciones = {}): Promise<T> {
    const { respuesta, sinCuerpo } = await lanzar(ruta, opciones)
    if (sinCuerpo) return undefined as T
    return (await leerCuerpo(respuesta)) as T
  }

  async function pedirArchivo(ruta: string, opciones: Opciones = {}): Promise<Archivo> {
    const { respuesta, sinCuerpo } = await lanzar(ruta, opciones)
    /*
      Un 200 sin cuerpo aqui no es un archivo vacio que valga la pena guardar:
      es una descarga que no descargo nada. Se dice, en vez de dejar que el
      navegador guarde cero bytes con extension `.xlsx`.
    */
    if (sinCuerpo) {
      throw new ErrorApi(respuesta.status, 'El servidor no devolvió ningún archivo.')
    }
    return {
      contenido: await respuesta.blob(),
      nombre: nombreDelArchivo(respuesta.headers.get('Content-Disposition')),
    }
  }

  return {
    pedir,
    pedirArchivo,
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
