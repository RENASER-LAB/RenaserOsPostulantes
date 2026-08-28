/**
 * Las dos costuras que trajo la version movil, vistas desde la web.
 *
 * Las dos existen para la aplicacion instalada, pero lo que se prueba aqui es
 * sobre todo **que en la web no cambio nada**: la misma URL relativa de
 * siempre y el mismo `localStorage`. Si algun dia una de las dos se cuela en el
 * portal desplegado, estas pruebas se ponen rojas antes que ningun candidato.
 *
 * Y una tercera cosa que no es costura sino guardia: que la cabecera `Date`
 * se siga anotando. En la aplicacion las peticiones salen por la capa nativa de
 * Android, y si esa capa se comiera la cabecera el cronometro de la prueba
 * volveria a depender del reloj del telefono — que es exactamente el fallo que
 * este proyecto ya arreglo una vez.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Almacen } from './puerta'
import { crearPuerta, usarAlmacen } from './puerta'

const CUANDO = 'Tue, 26 Aug 2036 10:00:00 GMT'

function respuestaVacia() {
  return new Response(null, { status: 204, headers: { date: CUANDO } })
}

/** Tipado como el `fetch` de verdad, para poder mirar con que se le llamo. */
function fetchDeMentira(responder: () => Response) {
  return vi.fn<typeof fetch>(async () => responder())
}

/** Un almacen de mentira que apunta lo que le piden, para poder mirarlo. */
function almacenDeMentira(inicial: Record<string, string> = {}) {
  const datos = new Map(Object.entries(inicial))
  return {
    datos,
    leer: vi.fn((clave: string) => datos.get(clave) ?? null),
    escribir: vi.fn((clave: string, valor: string) => void datos.set(clave, valor)),
    borrar: vi.fn((clave: string) => void datos.delete(clave)),
  } satisfies Almacen & { datos: Map<string, string> }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.resetModules()
  // La puerta guarda el almacen en un modulo: si una prueba lo cambia y no lo
  // devuelve, la siguiente hereda el de mentira sin enterarse.
  usarAlmacen({
    leer: (clave) => localStorage.getItem(clave),
    escribir: (clave, valor) => localStorage.setItem(clave, valor),
    borrar: (clave) => localStorage.removeItem(clave),
  })
  localStorage.clear()
})

describe('a donde pide la puerta', () => {
  it('en la web la ruta es relativa: la reescribe Vercel, como hasta ahora', async () => {
    const espia = fetchDeMentira(respuestaVacia)
    vi.stubGlobal('fetch', espia)

    await crearPuerta('/api/v1/portal', 'token_de_prueba').pedir('/vacantes')

    expect(espia).toHaveBeenCalledWith('/api/v1/portal/vacantes', expect.anything())
  })

  it('en la aplicacion instalada lleva delante el origen de Vercel', async () => {
    // Se lee al cargar el modulo, asi que hay que sembrarlo y volver a importar.
    vi.stubEnv('VITE_ORIGEN_API', 'https://renaser-os-postulantes.vercel.app')
    vi.resetModules()
    const { crearPuerta: crearConOrigen } = await import('./puerta')

    const espia = fetchDeMentira(respuestaVacia)
    vi.stubGlobal('fetch', espia)

    await crearConOrigen('/api/v1/panel', 'token_de_prueba').pedir('/vacantes')

    expect(espia).toHaveBeenCalledWith(
      'https://renaser-os-postulantes.vercel.app/api/v1/panel/vacantes',
      expect.anything(),
    )
  })
})

describe('donde guarda el token', () => {
  it('sin tocar nada, es el localStorage del navegador', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuestaVacia()))
    const puerta = crearPuerta('/api/v1/portal', 'renaser_portal_token')

    puerta.guardarToken('abc')

    expect(localStorage.getItem('renaser_portal_token')).toBe('abc')
    expect(puerta.leerToken()).toBe('abc')
  })

  it('sustituido, la puerta usa el almacen nuevo y deja el localStorage en paz', async () => {
    const almacen = almacenDeMentira()
    usarAlmacen(almacen)
    const espia = fetchDeMentira(respuestaVacia)
    vi.stubGlobal('fetch', espia)

    const puerta = crearPuerta('/api/v1/portal', 'renaser_portal_token')
    puerta.guardarToken('nativo')
    await puerta.pedir('/procesos')

    expect(almacen.escribir).toHaveBeenCalledWith('renaser_portal_token', 'nativo')
    expect(localStorage.getItem('renaser_portal_token')).toBeNull()
    expect(espia.mock.calls[0]?.[1]).toMatchObject({
      headers: { Authorization: 'Bearer nativo' },
    })
  })

  it('un 401 tira el token del almacen nuevo, no del localStorage', async () => {
    const almacen = almacenDeMentira({ renaser_panel_token: 'caducado' })
    usarAlmacen(almacen)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 401, headers: { 'content-length': '0' } })),
    )

    const puerta = crearPuerta('/api/v1/panel', 'renaser_panel_token')
    const aviso = vi.fn()
    puerta.alCaerLaSesion(aviso)

    await expect(puerta.pedir('/vacantes')).rejects.toThrow()

    expect(almacen.borrar).toHaveBeenCalledWith('renaser_panel_token')
    expect(aviso).toHaveBeenCalledOnce()
  })

  it('cada puerta tiene su clave: un 401 del panel no toca el token del candidato', async () => {
    const almacen = almacenDeMentira({
      renaser_portal_token: 'del candidato',
      renaser_panel_token: 'del equipo',
    })
    usarAlmacen(almacen)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 401, headers: { 'content-length': '0' } })),
    )

    await expect(crearPuerta('/api/v1/panel', 'renaser_panel_token').pedir('/x')).rejects.toThrow()

    expect(almacen.datos.get('renaser_portal_token')).toBe('del candidato')
    expect(almacen.datos.has('renaser_panel_token')).toBe(false)
  })
})

describe('la hora del servidor sobrevive', () => {
  it('se anota la cabecera Date de la respuesta', async () => {
    vi.resetModules()
    const reloj = await import('@/dominio/reloj')
    const anotar = vi.spyOn(reloj, 'anotarHoraDelServidor')
    const { crearPuerta: crearConEspia } = await import('./puerta')

    vi.stubGlobal('fetch', vi.fn(async () => respuestaVacia()))
    await crearConEspia('/api/v1/portal', 'token_de_prueba').pedir('/vacantes')

    expect(anotar).toHaveBeenCalledWith(CUANDO)
  })
})
