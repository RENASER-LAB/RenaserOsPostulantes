/**
 * Donde guarda los tokens la aplicacion instalada.
 *
 * En una WebView `localStorage` es de usar y tirar: el sistema lo borra al
 * limpiar la cache o al quedarse sin espacio. En la web eso es una molestia;
 * en un telefono **echa a alguien de una evaluacion a medias**, que es
 * justamente el tipo de perdida que este proyecto ya pago dos veces. Los
 * tokens pasan a `Preferences`, que por debajo es `SharedPreferences` de
 * Android y sobrevive a la limpieza de cache.
 *
 * ⚠️ **La comprobacion de si estamos en la aplicacion NO importa Capacitor.**
 * Se mira el objeto global que la propia caparazon inyecta. Si en vez de eso se
 * hiciera `import('@capacitor/core')` para preguntarle, ese `import` **se
 * ejecutaria tambien en la web** —hay que cargar el modulo para poder
 * preguntarle— y el portal desplegado se traeria un trozo de Capacitor que no
 * usa. Asi, en la web no se carga nada: se devuelve `false` y se acabo.
 *
 * ⚠️ **Y por eso `Almacen` es sincrono.** `Preferences` no lo es, y volver
 * asincrono `leerToken()` obligaria a tocar todas las pantallas del portal y
 * del panel. Lo que se hace es leer los tokens **antes de montar React** y
 * tenerlos en memoria; las escrituras persisten por detras.
 */

import type { Almacen } from './puerta'
import { usarAlmacen } from './puerta'

/** Las dos sesiones, que son independientes a proposito. */
const CLAVES = ['renaser_portal_token', 'renaser_panel_token'] as const

interface CapacitorGlobal {
  isNativePlatform?: () => boolean
}

function esLaAplicacion(): boolean {
  const cap = (globalThis as { Capacitor?: CapacitorGlobal }).Capacitor
  return cap?.isNativePlatform?.() === true
}

/**
 * Lee los tokens nativos y deja la puerta apuntando a ellos.
 *
 * **En la web no hace nada y retorna de inmediato**: la puerta se queda con el
 * `localStorage` de siempre.
 */
export async function sembrarAlmacenNativo(): Promise<void> {
  if (!esLaAplicacion()) return

  const { Preferences } = await import('@capacitor/preferences')

  const memoria = new Map<string, string>()
  for (const clave of CLAVES) {
    const { value } = await Preferences.get({ key: clave })
    if (value !== null) memoria.set(clave, value)
  }

  const nativo: Almacen = {
    leer: (clave) => memoria.get(clave) ?? null,

    escribir(clave, valor) {
      memoria.set(clave, valor)
      // Sin `await`: quien llama es sincrono. Si la escritura en disco falla,
      // la sesion sigue viva en memoria mientras la aplicacion este abierta —
      // que es mejor que tirarla por no haber podido persistirla.
      void Preferences.set({ key: clave, value: valor }).catch(() => {})
    },

    borrar(clave) {
      memoria.delete(clave)
      void Preferences.remove({ key: clave }).catch(() => {})
    },
  }

  usarAlmacen(nativo)
}
