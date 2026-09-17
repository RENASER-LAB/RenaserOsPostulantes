/**
 * Lo escrito no sale de la cola hasta que el servidor lo confirma.
 *
 * Es la unica cola de guardado del portal: la usan la evaluacion del Perfil Integral y el
 * cuestionario tecnico. **Dos copias de esto se arreglan en una y no en la otra**, y esa ya
 * fue la causa de respuestas de candidatos perdidas.
 *
 * ## Por que se reescribio
 *
 * La version anterior metia lo escrito en la cola **desde un efecto**, y ahi estaba la
 * perdida que reportaban los candidatos que iban rapido:
 *
 * 1. El candidato termina de escribir en la 10. React programa el efecto que encolaria ese
 *    texto, pero los efectos no corren a la vez que el teclazo: se agendan.
 * 2. El candidato pulsa «Siguiente» antes de que el efecto corra. La navegacion manda lo
 *    que hay en la cola —que todavia **no** incluye ese texto— y cambia de pregunta.
 * 3. Ahora si corre el efecto, ve que el borrador ya no es de la pregunta en pantalla y
 *    **se va sin hacer nada**. Ese texto no llego a la cola, no se mando y no se reintento.
 *    Desaparecio sin dejar rastro, y el contador decia «9 de 18» sin decir cual faltaba.
 *
 * Por eso ahora `encolar` se llama **desde el manejador del cambio**, en el mismo turno que
 * la tecla. Lo escrito esta en la cola antes de que nada pueda navegar.
 *
 * ## Las reglas, y lo que costo cada una
 *
 * - **Lo pendiente no se borra al mandarlo, solo al confirmarlo.** Un 500 o una red que
 *   parpadea se lo comian.
 * - **Solo se da por guardado lo que de verdad se mando.** Si siguio escribiendo mientras
 *   la peticion viajaba, lo nuevo sigue en la cola y se manda despues.
 * - **Un temporizador por pregunta.** Con uno solo y compartido, escribir en la 11 aplazaba
 *   el envio de la 10: yendo rapido, la cola entera se quedaba esperando a la ultima tecla.
 * - **Una peticion por pregunta a la vez.** El backend documenta el choque contra la clave
 *   unica `(evaluacion_id, pregunta_id)` cuando llegan dos guardados juntos; aqui no se
 *   lanza el segundo hasta que vuelve el primero.
 * - **Se reintenta con espera creciente.** El intervalo fijo de antes no se reiniciaba
 *   cuando la cola cambiaba de tamaño y podia tardar una eternidad en volver a intentarlo.
 * - **Lo pendiente sobrevive a cerrar la pestaña.** Se apunta en `localStorage` y se
 *   recupera al volver. Antes, cerrar el portatil con algo sin confirmar lo perdia.
 * - **Al ocultar la pestaña se manda lo que quede.** El navegador puede cortar esa peticion
 *   si la pestaña se cierra del todo, y por eso el seguro de verdad es lo apuntado: lo que no
 *   llego a salir sale sola la proxima vez que se abre el examen.
 *
 * Lo que NO hace: decidir que es una respuesta completa. Eso lo sabe cada pantalla —el
 * banco tiene ocho formatos y el cuestionario tecnico solo texto— y por eso `encolar` se
 * llama desde fuera, ya con la decision tomada.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { ErrorApi } from '@/api/cliente'

/** Cuanto se espera desde la ultima tecla antes de mandar. */
export const ESPERA_ANTES_DE_GUARDAR = 800
/** La primera espera tras un fallo. Se va doblando. */
export const ESPERA_TRAS_EL_PRIMER_FALLO = 1000
/** El techo de la espera entre reintentos: pasado esto no se separa mas. */
export const ESPERA_MAXIMA_ENTRE_REINTENTOS = 30_000
/** Lo apuntado en el navegador caduca: replicar una respuesta de anteayer seria peor. */
export const CADUCA_LO_APUNTADO = 24 * 60 * 60 * 1000
/** Lo que `vaciar` espera como mucho antes de rendirse y decir que no lo consiguio. */
export const TOPE_PARA_VACIAR = 8000
/**
 * Lo que se espera a una peticion antes de darla por perdida.
 *
 * ⚠️ **Una peticion que no vuelve no es lo mismo que una que falla.** Sin red, el navegador
 * rechaza al instante y la cola reintenta; pero contra un servidor o un proxy que acepta la
 * conexion y no contesta, la promesa se queda abierta para siempre. Como no se manda una
 * segunda peticion de la misma pregunta mientras hay una viajando, esa pregunta se quedaba
 * bloqueada: ni se guardaba, ni se reintentaba, y el pie decia «Guardando…» indefinidamente.
 *
 * Generoso a proposito: esto no es un plazo de respuesta razonable, es el punto a partir del
 * cual se asume que esa peticion ya no va a volver.
 */
export const TOPE_POR_PETICION = 20_000

/**
 * Si este rechazo no va a arreglarse esperando.
 *
 * Un 4xx que no sea «espera y reintenta» es el servidor diciendo que **esa respuesta nunca
 * va a entrar**: la pregunta no es suya, el texto pasa del maximo, la sesion ya no vale.
 * Reintentarlo cada pocos segundos hasta que cierre la pestaña —y otra vez mañana, desde lo
 * apuntado— no lo acerca a guardarse; solo hace ruido contra el servidor y deja al candidato
 * mirando un «Guardando…» que no termina nunca.
 *
 * Sin conexion, `ErrorApi` trae estado 0, que si se reintenta.
 */
function noVaARecuperarse(causa: unknown): boolean {
  if (!(causa instanceof ErrorApi)) return false
  const { estado } = causa
  return estado >= 400 && estado < 500 && estado !== 408 && estado !== 429
}

/** Una entrada de la cola: el valor y como le ha ido. */
interface Entrada<T> {
  valor: T
  /** Fallos seguidos. De aqui sale cuanto se espera antes del siguiente intento. */
  fallos: number
  /** Cuando se encolo, para poder caducar lo apuntado en el navegador. */
  en: number
}

export interface ColaDeRespuestas<T> {
  /** Lo que todavia no confirmo el servidor, para poder pintarlo. */
  sinConfirmar: { id: number; valor: T }[]
  /** Lo pendiente de una pregunta, si lo hay: lo suyo manda sobre lo que el servidor cree. */
  pendienteDe: (preguntaId: number) => T | undefined
  /** Si hay una peticion de esa pregunta viajando ahora mismo. */
  estaViajando: (preguntaId: number) => boolean
  /**
   * Deja algo pendiente y programa el envio.
   *
   * **Llamalo desde el manejador del cambio, nunca desde un efecto.** Es la unica forma de
   * que lo escrito este a salvo antes de que el candidato pueda pulsar «Siguiente».
   *
   * @param yaMismo sin esperar al temporizador: para lo que se marca de un toque —una
   *   opcion, una casilla—, donde no hay «dejar de escribir» al que esperar.
   */
  encolar: (preguntaId: number, valor: T, opciones?: { yaMismo?: boolean }) => void
  /** Quita lo pendiente de una pregunta: lo que hay ya es lo del servidor. */
  olvidar: (preguntaId: number) => void
  /** Manda ya todo lo pendiente, sin esperar. No espera respuesta. */
  mandarYa: () => void
  /**
   * Manda lo que quede y **espera** a que llegue. Devuelve si la cola quedo vacia.
   *
   * Es lo que se usa antes de entregar: entregar con algo sin confirmar es entregar sin esa
   * respuesta, asi que primero se vacia y despues se decide.
   */
  vaciar: () => Promise<boolean>
  /** Hay algo esperando a que el servidor lo confirme. */
  guardando: boolean
  /**
   * Las que el servidor rechazo de una forma que no se arregla esperando.
   *
   * Existe para que la pantalla no prometa un «Guardando…» eterno. No lleva cartel: se dice
   * en la misma linea del pie donde ya se dice todo lo demas, que no mueve nada de sitio.
   */
  atascadas: number[]
}

/**
 * @param mandar manda una respuesta y **resuelve cuando el servidor la acepta**. Un rechazo
 *   debe ser una promesa rota: de eso vive el reintento. Debe ser estable.
 * @param loMismo si lo que se acaba de confirmar sigue siendo lo que hay en la cola. Sin
 *   esto, una respuesta escrita mientras la anterior viajaba se daria por guardada.
 * @param clave donde apuntar lo pendiente en el navegador. Lleva el uuid del examen, asi que
 *   distingue **examenes**, no pestañas: dos pestañas del mismo examen comparten la nota y al
 *   montar se leen lo pendiente la una a la otra. Como lo apuntado se borra en cuanto el
 *   servidor confirma, ahi solo queda lo que de verdad no llego, y remandarlo es justo lo que
 *   se quiere. Sin clave no se apunta nada.
 */
export function useColaDeRespuestas<T>(
  mandar: (preguntaId: number, valor: T) => Promise<unknown>,
  loMismo: (enCola: T, confirmado: T) => boolean,
  clave?: string,
): ColaDeRespuestas<T> {
  // Referencia para poder mandarla al vuelo desde cualquier sitio, y ademas copiada a
  // estado para poder pintarla: sin eso, el candidato no tiene forma de saber que algo no
  // llego.
  const cola = useRef<Map<number, Entrada<T>>>(new Map())
  const [sinConfirmar, setSinConfirmar] = useState<{ id: number; valor: T }[]>([])
  /** Las que el servidor no va a aceptar por mucho que se insista. */
  const [atascadas, setAtascadas] = useState<number[]>([])
  /** Un temporizador por pregunta: el de la 11 no puede aplazar el de la 10. */
  const relojes = useRef<Map<number, number>>(new Map())
  /** La peticion en curso de cada pregunta, para no lanzar dos a la vez. */
  const enVuelo = useRef<Map<number, Promise<void>>>(new Map())
  const desmontado = useRef(false)

  // `mandar` y `loMismo` se guardan en una referencia para que reprogramar un reintento no
  // dependa de su identidad: una pantalla que los recree en cada render reiniciaria la cola
  // entera en cada tecla.
  const mandarRef = useRef(mandar)
  mandarRef.current = mandar
  const loMismoRef = useRef(loMismo)
  loMismoRef.current = loMismo

  const apuntar = useCallback(() => {
    if (!clave) return
    try {
      const vivas = [...cola.current].map(([id, e]) => ({ id, valor: e.valor, en: e.en }))
      if (vivas.length === 0) window.localStorage.removeItem(clave)
      else window.localStorage.setItem(clave, JSON.stringify(vivas))
    } catch {
      // Sin sitio, en incognito o con el almacenamiento capado. Que no se pueda apuntar no
      // puede costar el examen: la cola en memoria sigue funcionando igual.
    }
  }, [clave])

  /**
   * ⚠️ **Apuntar va siempre; repintar, solo si queda pantalla.**
   *
   * Separarlos no es un detalle. Al salir de la pantalla se manda lo que quede, y esa
   * peticion vuelve **despues** de desmontar: si el borrado de la nota viajara con el
   * repintado, un guardado que si llego se quedaba apuntado como pendiente. La siguiente vez
   * que el candidato abria el examen, lo apuntado se remandaba y **pisaba con la respuesta
   * vieja cualquier correccion posterior**. Perdia respuestas justo la pieza cuyo trabajo es
   * no perderlas.
   */
  const refrescar = useCallback(() => {
    apuntar()
    if (!desmontado.current) {
      setSinConfirmar([...cola.current].map(([id, e]) => ({ id, valor: e.valor })))
    }
  }, [apuntar])

  /** Cuanto se espera antes del siguiente intento, doblando y con techo. */
  const esperaTras = (fallos: number) =>
    Math.min(ESPERA_TRAS_EL_PRIMER_FALLO * 2 ** (fallos - 1), ESPERA_MAXIMA_ENTRE_REINTENTOS)

  // `mandarUna` se programa a si misma tras un fallo, asi que `programar` tiene que poder
  // llamarla antes de que exista. La referencia rompe ese circulo sin volver inestable a
  // ninguna de las dos.
  const mandarUnaRef = useRef<(preguntaId: number) => Promise<void>>(async () => {})

  const programar = useCallback((preguntaId: number, espera: number) => {
    // ⚠️ **Nada se programa despues de salir de la pantalla.** Al desmontar se manda lo que
    // queda y se apagan los relojes, pero esas peticiones **vuelven despues**: si una se caia,
    // su reintento montaba un reloj nuevo que ya nadie iba a apagar. Seguia disparando contra
    // el servidor desde una pantalla que ya no existe, y doblando la espera para siempre.
    // Lo pendiente no se pierde por no reprogramarlo: queda apuntado y sale al volver a abrir.
    if (desmontado.current) return
    window.clearTimeout(relojes.current.get(preguntaId))
    const reloj = window.setTimeout(() => {
      relojes.current.delete(preguntaId)
      void mandarUnaRef.current(preguntaId)
    }, espera)
    relojes.current.set(preguntaId, reloj)
  }, [])

  /**
   * Manda lo pendiente de una pregunta y decide que hacer con la respuesta.
   *
   * Si mientras viajaba el candidato escribio otra cosa, lo confirmado **no** es lo que hay
   * en la cola: no se borra, se vuelve a mandar. Es la regla que impide dar por guardada
   * una respuesta que el servidor nunca vio.
   */
  const mandarUna = useCallback(
    async (preguntaId: number): Promise<void> => {
      const entrada = cola.current.get(preguntaId)
      if (!entrada) return
      // Ya hay una peticion de esta pregunta en el aire. La cola guarda lo ultimo, y al
      // volver la que viaja se comprobara contra ello y se remandara si cambio.
      const yaVa = enVuelo.current.get(preguntaId)
      if (yaVa) return yaVa

      const mandado = entrada.valor
      const viaje = (async () => {
        let reloj: number | undefined
        try {
          await Promise.race([
            mandarRef.current(preguntaId, mandado),
            new Promise((_, romper) => {
              reloj = window.setTimeout(
                () => romper(new Error('La petición no volvió')),
                TOPE_POR_PETICION,
              )
            }),
          ])
          const ahora = cola.current.get(preguntaId)
          if (!ahora) return
          if (loMismoRef.current(ahora.valor, mandado)) {
            cola.current.delete(preguntaId)
            window.clearTimeout(relojes.current.get(preguntaId))
            relojes.current.delete(preguntaId)
          } else {
            // Cambio mientras viajaba: lo nuevo sale ya, sin castigo de espera.
            ahora.fallos = 0
            programar(preguntaId, 0)
          }
        } catch (causa) {
          const ahora = cola.current.get(preguntaId)
          if (!ahora) return
          if (noVaARecuperarse(causa)) {
            // Insistir no lo va a guardar. Sale de la cola y de lo apuntado —si no, volveria
            // a intentarlo en cada visita durante un dia— y se anota como atascada, para que
            // la pantalla pueda decirlo en vez de prometer un guardado que no llega.
            cola.current.delete(preguntaId)
            window.clearTimeout(relojes.current.get(preguntaId))
            relojes.current.delete(preguntaId)
            setAtascadas((antes) => (antes.includes(preguntaId) ? antes : [...antes, preguntaId]))
            return
          }
          // No se toca el valor: si no llego, se vuelve a intentar, cada vez mas separado.
          ahora.fallos += 1
          programar(preguntaId, esperaTras(ahora.fallos))
        } finally {
          window.clearTimeout(reloj)
          enVuelo.current.delete(preguntaId)
          refrescar()
        }
      })()

      enVuelo.current.set(preguntaId, viaje)
      return viaje
    },
    [programar, refrescar],
  )
  mandarUnaRef.current = mandarUna

  const mandarYa = useCallback(() => {
    for (const preguntaId of [...cola.current.keys()]) {
      window.clearTimeout(relojes.current.get(preguntaId))
      relojes.current.delete(preguntaId)
      void mandarUna(preguntaId)
    }
  }, [mandarUna])

  const encolar = useCallback(
    (preguntaId: number, valor: T, opciones?: { yaMismo?: boolean }) => {
      const previa = cola.current.get(preguntaId)
      cola.current.set(preguntaId, {
        valor,
        // Corregir despues de un fallo no arrastra el castigo del anterior: lo que se acaba
        // de escribir sale enseguida.
        fallos: 0,
        en: previa?.en ?? Date.now(),
      })
      // Corregirla le da otra oportunidad: lo que el servidor rechazo era lo de antes.
      setAtascadas((antes) => (antes.includes(preguntaId) ? antes.filter((id) => id !== preguntaId) : antes))
      refrescar()
      programar(preguntaId, opciones?.yaMismo ? 0 : ESPERA_ANTES_DE_GUARDAR)
    },
    [programar, refrescar],
  )

  const olvidar = useCallback(
    (preguntaId: number) => {
      // ⚠️ La marca se quita **aunque no hubiera nada en la cola**. Deshacer hasta volver a
      // lo que el servidor ya tiene es dejar de tener nada pendiente, y ahi no hay nada que
      // guardar: seguir diciendo «No se pudo guardar» sobre una respuesta que si esta
      // guardada es exactamente la clase de indicador que miente.
      setAtascadas((antes) =>
        antes.includes(preguntaId) ? antes.filter((id) => id !== preguntaId) : antes,
      )
      if (!cola.current.delete(preguntaId)) return
      window.clearTimeout(relojes.current.get(preguntaId))
      relojes.current.delete(preguntaId)
      refrescar()
    },
    [refrescar],
  )

  /**
   * Manda lo que quede y espera.
   *
   * Da varias vueltas porque una respuesta puede cambiar mientras viaja —y entonces vuelve
   * a la cola—, pero con tope: si el servidor esta caido, esto no puede dejar al candidato
   * mirando un boton que no responde.
   */
  const vaciar = useCallback(async (): Promise<boolean> => {
    const hastaCuando = Date.now() + TOPE_PARA_VACIAR
    for (let vuelta = 0; vuelta < 3 && cola.current.size > 0; vuelta += 1) {
      mandarYa()
      // ⚠️ **Con tope.** Esto lo espera el boton de entregar, y una peticion que se queda
      // colgada —no que falle— dejaria al candidato mirando un boton muerto con el plazo
      // corriendo. Pasado el tope se devuelve `false` y quien llama decide; lo pendiente
      // sigue en la cola y en lo apuntado, asi que no se pierde nada por rendirse aqui.
      await Promise.race([
        Promise.allSettled([...enVuelo.current.values()]),
        new Promise((seguir) => window.setTimeout(seguir, Math.max(0, hastaCuando - Date.now()))),
      ])
      if (Date.now() >= hastaCuando) break
    }
    return cola.current.size === 0
  }, [mandarYa])

  const pendienteDe = useCallback(
    (preguntaId: number) => cola.current.get(preguntaId)?.valor,
    [],
  )

  const estaViajando = useCallback((preguntaId: number) => enVuelo.current.has(preguntaId), [])

  // Lo que quedo apuntado de la vez anterior: cerrar la pestaña con algo sin confirmar ya no
  // lo pierde. Se recupera antes de nada y sale hacia el servidor en cuanto monta.
  useEffect(() => {
    if (!clave) return
    let apuntado: { id: number; valor: T; en: number }[] = []
    try {
      apuntado = JSON.parse(window.localStorage.getItem(clave) ?? '[]')
    } catch {
      apuntado = []
    }
    if (!Array.isArray(apuntado)) return
    const limite = Date.now() - CADUCA_LO_APUNTADO
    let recuperado = false
    for (const fila of apuntado) {
      if (typeof fila?.id !== 'number' || fila.valor === undefined) continue
      if (typeof fila.en !== 'number' || fila.en < limite) continue
      if (cola.current.has(fila.id)) continue
      cola.current.set(fila.id, { valor: fila.valor, fallos: 0, en: fila.en })
      recuperado = true
    }
    if (recuperado) {
      refrescar()
      mandarYa()
    }
  }, [clave, refrescar, mandarYa])

  // Al ocultar la pestaña —cambiar de aplicacion en el movil, bloquear la pantalla, cerrar—
  // se manda lo que quede. `visibilitychange` es el unico evento que el movil garantiza:
  // `beforeunload` no llega en iOS ni cuando el sistema mata la pestaña en segundo plano.
  useEffect(() => {
    const alOcultarse = () => {
      if (document.visibilityState === 'hidden') mandarYa()
    }
    document.addEventListener('visibilitychange', alOcultarse)
    window.addEventListener('pagehide', mandarYa)
    return () => {
      document.removeEventListener('visibilitychange', alOcultarse)
      window.removeEventListener('pagehide', mandarYa)
    }
  }, [mandarYa])

  // Al salir de la pantalla, lo que quede sin mandar se manda. Los temporizadores se apagan
  // despues: si no, el ultimo envio se iria con ellos.
  useEffect(() => {
    desmontado.current = false
    return () => {
      desmontado.current = true
      mandarYa()
      for (const reloj of relojes.current.values()) window.clearTimeout(reloj)
      relojes.current.clear()
    }
  }, [mandarYa])

  return {
    sinConfirmar,
    pendienteDe,
    estaViajando,
    encolar,
    olvidar,
    mandarYa,
    vaciar,
    // Mientras quede algo en la cola hay algo guardandose: o esta viajando, o le toca
    // enseguida. Para el candidato es lo mismo, y dos estados distintos aqui solo servirian
    // para parpadear.
    guardando: sinConfirmar.length > 0,
    atascadas,
  }
}
