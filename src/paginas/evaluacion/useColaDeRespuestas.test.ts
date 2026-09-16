/**
 * La cola de guardado, por dentro.
 *
 * Las pantallas ya comprueban lo que se ve —que lo escrito llega, que no hay carteles rojos,
 * que entregar manda lo que quede—. Aqui se comprueban las cuatro reglas que **no se ven** y
 * que, cuando se rompieron, costaron respuestas de candidatos:
 *
 *   1. Un temporizador por pregunta: escribir en la 11 no puede aplazar el envio de la 10.
 *   2. Una peticion por pregunta a la vez: dos juntas chocan contra la clave unica del
 *      backend y el candidato ve un error por una respuesta que si estaba guardada.
 *   3. Los reintentos se van separando, en vez de martillear cada cinco segundos.
 *   4. Lo confirmado sale de la cola **solo si sigue siendo lo mismo**: lo que se escribio
 *      mientras la peticion viajaba no se da por guardado.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { ErrorApi } from '@/api/cliente'
import { useColaDeRespuestas } from './useColaDeRespuestas'

const loMismo = (a: { texto: string }, b: { texto: string }) => a.texto === b.texto

beforeEach(() => {
  vi.useFakeTimers()
  window.localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

/** Deja pasar el tiempo y los microtareas que suelta cada promesa resuelta. */
async function pasan(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

describe('la cola de respuestas', () => {
  it('espera a que pare la mano antes de mandar', async () => {
    const mandar = vi.fn(async () => {})
    const { result } = renderHook(() => useColaDeRespuestas(mandar, loMismo))

    act(() => result.current.encolar(1, { texto: 'ho' }))
    act(() => result.current.encolar(1, { texto: 'hola' }))
    await pasan(700)
    expect(mandar).not.toHaveBeenCalled()

    await pasan(200)
    expect(mandar).toHaveBeenCalledTimes(1)
    expect(mandar).toHaveBeenCalledWith(1, { texto: 'hola' })
  })

  it('lo que se marca de un toque no espera al temporizador', async () => {
    const mandar = vi.fn(async () => {})
    const { result } = renderHook(() => useColaDeRespuestas(mandar, loMismo))

    act(() => result.current.encolar(1, { texto: 'b' }, { yaMismo: true }))
    await pasan(0)

    expect(mandar).toHaveBeenCalledTimes(1)
  })

  it('⚠️ escribir en una pregunta no aplaza el envio de otra', async () => {
    // Con un solo temporizador compartido, cada tecla en la 2 reiniciaba la espera de la 1:
    // yendo rapido, la cola entera se quedaba esperando a la ultima tecla de la ultima
    // pregunta. Con uno por pregunta, cada una sale a su hora.
    const mandar = vi.fn(async () => {})
    const { result } = renderHook(() => useColaDeRespuestas(mandar, loMismo))

    act(() => result.current.encolar(1, { texto: 'de la uno' }))
    await pasan(600)
    act(() => result.current.encolar(2, { texto: 'de la dos' }))
    await pasan(300)

    // La 1 ya salio aunque la 2 se acabe de escribir.
    expect(mandar).toHaveBeenCalledWith(1, { texto: 'de la uno' })
    expect(mandar).toHaveBeenCalledTimes(1)

    await pasan(600)
    expect(mandar).toHaveBeenCalledWith(2, { texto: 'de la dos' })
  })

  it('⚠️ no manda dos veces la misma pregunta a la vez', async () => {
    // El backend documenta el choque contra la clave unica `(evaluacion_id, pregunta_id)`
    // cuando llegan dos guardados juntos: le paso a una candidata en la pregunta 49 de 50,
    // que vio un error por una respuesta que si estaba guardada.
    let soltar: () => void = () => {}
    const mandar = vi.fn(() => new Promise<void>((r) => { soltar = r }))
    const { result } = renderHook(() => useColaDeRespuestas(mandar, loMismo))

    act(() => result.current.encolar(1, { texto: 'uno' }, { yaMismo: true }))
    await pasan(0)
    expect(mandar).toHaveBeenCalledTimes(1)

    // Forzar el envio mientras la anterior viaja no lanza una segunda.
    act(() => result.current.mandarYa())
    await pasan(0)
    expect(mandar).toHaveBeenCalledTimes(1)

    await act(async () => { soltar() })
    await pasan(0)
    expect(result.current.sinConfirmar).toHaveLength(0)
  })

  it('lo escrito mientras viajaba la peticion no se da por guardado', async () => {
    let soltar: () => void = () => {}
    const mandar = vi.fn(() => new Promise<void>((r) => { soltar = r }))
    const { result } = renderHook(() => useColaDeRespuestas(mandar, loMismo))

    act(() => result.current.encolar(1, { texto: 'primera' }, { yaMismo: true }))
    await pasan(0)

    // Sigue escribiendo mientras la primera viaja.
    act(() => result.current.encolar(1, { texto: 'primera corregida' }))
    await act(async () => { soltar() })
    await pasan(0)

    // Lo confirmado era «primera», que ya no es lo que hay: sigue pendiente y se remanda.
    expect(mandar).toHaveBeenLastCalledWith(1, { texto: 'primera corregida' })
  })

  it('reintenta solo, y cada vez mas separado', async () => {
    const mandar = vi.fn(async () => { throw new Error('se cayó la red') })
    const { result } = renderHook(() => useColaDeRespuestas(mandar, loMismo))

    act(() => result.current.encolar(1, { texto: 'lo que sea' }, { yaMismo: true }))
    await pasan(0)
    expect(mandar).toHaveBeenCalledTimes(1)

    await pasan(1100) // el primer fallo espera un segundo
    expect(mandar).toHaveBeenCalledTimes(2)

    await pasan(1100) // el segundo espera dos: todavia no toca
    expect(mandar).toHaveBeenCalledTimes(2)
    await pasan(1000)
    expect(mandar).toHaveBeenCalledTimes(3)
  })

  it('corregir tras un fallo no arrastra el castigo del anterior', async () => {
    const mandar = vi.fn(async () => { throw new Error('se cayó la red') })
    const { result } = renderHook(() => useColaDeRespuestas(mandar, loMismo))

    act(() => result.current.encolar(1, { texto: 'malo' }, { yaMismo: true }))
    await pasan(0)
    await pasan(1100)
    await pasan(2100)
    const tras3Fallos = mandar.mock.calls.length

    // Lo que se acaba de escribir sale enseguida, no cuatro segundos despues.
    act(() => result.current.encolar(1, { texto: 'corregido' }))
    await pasan(900)
    expect(mandar.mock.calls.length).toBe(tras3Fallos + 1)
  })

  it('lo pendiente sobrevive a cerrar la pestaña', async () => {
    const CLAVE = 'renaser_prueba_pendiente'
    const seCae = vi.fn(async () => { throw new Error('se cayó la red') })
    const primera = renderHook(() => useColaDeRespuestas(seCae, loMismo, CLAVE))

    act(() => primera.result.current.encolar(7, { texto: 'lo que no llegó' }, { yaMismo: true }))
    await pasan(0)
    expect(window.localStorage.getItem(CLAVE)).toContain('lo que no llegó')

    primera.unmount()

    // Al volver a abrir, sale solo hacia el servidor sin que nadie escriba nada.
    const vaBien = vi.fn(async () => {})
    renderHook(() => useColaDeRespuestas(vaBien, loMismo, CLAVE))
    await pasan(0)

    expect(vaBien).toHaveBeenCalledWith(7, { texto: 'lo que no llegó' })
    await pasan(0)
    expect(window.localStorage.getItem(CLAVE)).toBeNull()
  })

  it('lo apuntado hace dos dias no se reenvia', async () => {
    const CLAVE = 'renaser_prueba_vieja'
    const haceDosDias = Date.now() - 48 * 60 * 60 * 1000
    window.localStorage.setItem(
      CLAVE,
      JSON.stringify([{ id: 7, valor: { texto: 'de anteayer' }, en: haceDosDias }]),
    )

    const mandar = vi.fn(async () => {})
    renderHook(() => useColaDeRespuestas(mandar, loMismo, CLAVE))
    await pasan(0)

    expect(mandar).not.toHaveBeenCalled()
  })

  it('vaciar manda lo que queda y dice si lo consiguio', async () => {
    const mandar = vi.fn(async () => {})
    const { result } = renderHook(() => useColaDeRespuestas(mandar, loMismo))

    act(() => result.current.encolar(1, { texto: 'una' }))
    act(() => result.current.encolar(2, { texto: 'otra' }))

    let quedoVacia = false
    await act(async () => {
      quedoVacia = await result.current.vaciar()
    })

    expect(quedoVacia).toBe(true)
    expect(mandar).toHaveBeenCalledTimes(2)
  })

  it('vaciar contra un servidor caido no se queda colgado', async () => {
    const mandar = vi.fn(async () => { throw new Error('se cayó la red') })
    const { result } = renderHook(() => useColaDeRespuestas(mandar, loMismo))

    act(() => result.current.encolar(1, { texto: 'una' }))

    let quedoVacia = true
    await act(async () => {
      quedoVacia = await result.current.vaciar()
    })

    // Dice la verdad —no llego— en vez de dejar al candidato mirando un boton muerto.
    expect(quedoVacia).toBe(false)
  })

  it('⚠️ lo que se confirma al salir de la pantalla deja de estar apuntado', async () => {
    // El fallo que encontró QA. Al desmontar se manda lo que queda, y esa confirmación llega
    // cuando ya no hay pantalla: el borrado de la nota iba colgado del repintado, así que no
    // se hacía. La respuesta quedaba apuntada como pendiente **aunque estuviera guardada**, y
    // al volver a abrir el examen se remandaba pisando cualquier corrección posterior.
    const CLAVE = 'renaser_prueba_al_salir'
    let soltar: () => void = () => {}
    const mandar = vi.fn(() => new Promise<void>((r) => { soltar = r }))
    const { result, unmount } = renderHook(() => useColaDeRespuestas(mandar, loMismo, CLAVE))

    act(() => result.current.encolar(3, { texto: 'lo último' }))
    unmount() // manda lo que queda y apaga los relojes
    await pasan(0)
    expect(mandar).toHaveBeenCalledWith(3, { texto: 'lo último' })

    // El servidor responde cuando la pantalla ya no está.
    await act(async () => { soltar() })
    await pasan(0)

    expect(window.localStorage.getItem(CLAVE)).toBeNull()
  })

  it('⚠️ tras salir de la pantalla no se programa ningún reintento', async () => {
    // Un rechazo que aterriza después de desmontar volvía a programar: montaba un reloj nuevo
    // que ya nadie iba a apagar, disparando contra el servidor desde una pantalla que ya no
    // existe. Lo pendiente no se pierde por no reprogramarlo: queda apuntado y sale al volver.
    const mandar = vi.fn(async () => { throw new Error('se cayó la red') })
    const { result, unmount } = renderHook(() => useColaDeRespuestas(mandar, loMismo))

    act(() => result.current.encolar(1, { texto: 'lo que sea' }))
    unmount()
    await pasan(0)
    const alSalir = mandar.mock.calls.length

    await pasan(30_000)
    expect(mandar.mock.calls.length).toBe(alSalir)
  })

  it('⚠️ un rechazo que no se arregla esperando deja de reintentarse', async () => {
    // Un 4xx es el servidor diciendo que esa respuesta nunca va a entrar. Reintentarlo cada
    // pocos segundos —y otra vez mañana, desde lo apuntado— no la acerca a guardarse: solo
    // hace ruido y deja al candidato mirando un «Guardando…» que no termina nunca.
    const CLAVE = 'renaser_prueba_atascada'
    const mandar = vi.fn(async () => {
      throw new ErrorApi(404, 'Esa pregunta no es de este examen')
    })
    const { result } = renderHook(() => useColaDeRespuestas(mandar, loMismo, CLAVE))

    act(() => result.current.encolar(9, { texto: 'a ninguna parte' }, { yaMismo: true }))
    await pasan(0)
    expect(mandar).toHaveBeenCalledTimes(1)

    await pasan(60_000)
    expect(mandar).toHaveBeenCalledTimes(1)
    // Y no queda apuntada: si no, volvería a intentarlo en cada visita durante un día.
    expect(window.localStorage.getItem(CLAVE)).toBeNull()
    // La pantalla puede decirlo en vez de prometer un guardado que no llega.
    expect(result.current.atascadas).toContain(9)
  })

  it('corregir una atascada le da otra oportunidad', async () => {
    let falla = true
    const mandar = vi.fn(async () => {
      if (falla) throw new ErrorApi(400, 'La respuesta es demasiado larga')
    })
    const { result } = renderHook(() => useColaDeRespuestas(mandar, loMismo))

    act(() => result.current.encolar(1, { texto: 'x'.repeat(50) }, { yaMismo: true }))
    await pasan(0)
    expect(result.current.atascadas).toContain(1)

    falla = false
    act(() => result.current.encolar(1, { texto: 'más corta' }, { yaMismo: true }))
    await pasan(0)

    expect(mandar).toHaveBeenLastCalledWith(1, { texto: 'más corta' })
    expect(result.current.atascadas).not.toContain(1)
  })

  it('un corte de red sí se reintenta: estado 0 no es un 4xx', async () => {
    const mandar = vi.fn(async () => {
      throw new ErrorApi(0, 'No pudimos conectar. Revisa tu conexión.')
    })
    const { result } = renderHook(() => useColaDeRespuestas(mandar, loMismo))

    act(() => result.current.encolar(1, { texto: 'sin red' }, { yaMismo: true }))
    await pasan(0)
    await pasan(1100)

    expect(mandar).toHaveBeenCalledTimes(2)
    expect(result.current.atascadas).toHaveLength(0)
  })

  it('vaciar no se queda colgado contra una petición que no vuelve', async () => {
    // Esto lo espera el botón de entregar: una petición colgada —no que falle— dejaría al
    // candidato mirando un botón muerto con el plazo corriendo.
    const mandar = vi.fn(() => new Promise<void>(() => {}))
    const { result } = renderHook(() => useColaDeRespuestas(mandar, loMismo))

    act(() => result.current.encolar(1, { texto: 'a ninguna parte' }))

    let quedoVacia = true
    const esperando = act(async () => {
      quedoVacia = await result.current.vaciar()
    })
    await pasan(9000)
    await esperando

    expect(quedoVacia).toBe(false)
  })

  it('olvidar quita lo pendiente y su temporizador', async () => {
    const mandar = vi.fn(async () => {})
    const { result } = renderHook(() => useColaDeRespuestas(mandar, loMismo))

    act(() => result.current.encolar(1, { texto: 'me arrepiento' }))
    act(() => result.current.olvidar(1))
    await pasan(1500)

    expect(mandar).not.toHaveBeenCalled()
    expect(result.current.sinConfirmar).toHaveLength(0)
  })
})
