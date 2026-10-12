/**
 * Moverse por una prueba de una pregunta por pantalla: el paso en el que se está, los saltos y
 * su vuelta, y dónde se queda al recargar.
 *
 * Lo comparten la evaluación del Perfil Integral y la prueba técnica del editor, que hasta el
 * 09/10/2026 se movían de dos formas distintas: la evaluación de una en una con mapa, y la prueba
 * toda en vertical. **Una sola pieza y no dos copias**: la evaluación ya tenía bien resuelto lo
 * difícil —el «Volver a la N» que recuerda el primer salto, «Siguiente sin responder» que da la
 * vuelta— y aquí se reutiliza tal cual.
 *
 * Tres reglas, y por qué:
 *
 *   - **Se recuerda el primer salto, no el último.** Así se van tapando huecos uno tras otro
 *     —de la 10 a la 12, de la 12 a la 27— sin perder el camino de vuelta a la 50, que es de
 *     donde se salió de verdad (decisión del usuario del 07/10/2026).
 *   - **Moverse a mano olvida la vuelta.** Si alguien saltó a la 10 y siguió avanzando con
 *     «Siguiente», el «Volver a la 50» ya no dice nada cierto.
 *   - **El paso se apunta por pestaña.** `sessionStorage`, no `localStorage`: con dos pestañas
 *     abiertas cada una sigue en su sitio, y las respuestas son del servidor. Si el navegador no
 *     deja apuntar —modo privado, almacenamiento bloqueado—, al recargar se va a la primera sin
 *     responder, que es lo mismo que pasa la primera vez.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { siguienteIncompleta, type EstadoDePregunta } from '@/paginas/evaluacion/bancoV3'

export type EstadoDePaso = EstadoDePregunta

/** Un paso del recorrido: una pregunta, o el paso final de los entregables. */
export interface Paso {
  /** Lo que identifica al paso aunque cambie el orden: `p:21`, `entregables`. */
  clave: string
  /** Lo que se pinta dentro de la casilla del mapa: «3», «Entregables». */
  rotulo: string
  /** Cómo se nombra en la barra y para el lector: «Pregunta 3», «Entregables». */
  nombre: string
  estado: EstadoDePaso
  /** Por qué está a medias, para el lector: «falta su archivo». */
  matiz?: string | null
  /** Cómo se dice su estado si no es lo de siempre: «sin subir» en vez de «sin responder». */
  estadoDicho?: string | null
}

/** Busca, en lo que ya se pintó, dónde poner el foco al llegar. */
export type DondeEnfocar = () => HTMLElement | null

/** Lo apuntado en la pestaña, si el navegador deja leerlo. */
function leerApuntado(clave: string | null): string | null {
  if (!clave) return null
  try {
    return window.sessionStorage.getItem(clave)
  } catch {
    return null
  }
}

function apuntar(clave: string | null, paso: string) {
  if (!clave) return
  try {
    window.sessionStorage.setItem(clave, paso)
  } catch {
    // Sin almacenamiento la posición es solo una comodidad: al recargar se va a la primera
    // sin responder.
  }
}

/**
 * Lleva `el` a la vista, justo debajo de la barra fija, **sin animación** (la regla del reloj).
 * En jsdom no hay medidas: todo mide cero y no se toca nada.
 */
export function asomar(el: HTMLElement | null, barra: HTMLElement | null) {
  if (!el) return
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return
  const arriba = (barra?.getBoundingClientRect().bottom ?? 0) + 16
  if (r.top < arriba) window.scrollBy(0, r.top - arriba)
  else if (r.bottom > window.innerHeight) {
    window.scrollBy(0, Math.min(r.top - arriba, r.bottom - window.innerHeight + 16))
  }
}

/** Lo que recibe una pulsación además de las etiquetas: un botón, un campo, un enlace. */
const MANDOS =
  'button, a[href], input, select, textarea, summary, [role="button"], [role="radio"], [role="checkbox"], [role="option"]'

/**
 * Sobre qué actúa una pulsación. Una opción es su etiqueta entera —el texto, el círculo y su
 * `input`—: pulsar en dos sitios de la misma opción es pulsar la misma cosa.
 */
function mandoDe(objetivo: EventTarget | null): Element | null {
  if (!(objetivo instanceof Element)) return null
  return (
    objetivo.closest('label') ??
    (objetivo instanceof HTMLInputElement ? (objetivo.labels?.[0] ?? null) : null) ??
    objetivo.closest(MANDOS) ??
    objetivo
  )
}

/**
 * **Un doble clic actúa una sola vez, y solo donde empezó** (QA-UPP-01).
 *
 * «Siguiente» ya ignora su segunda pulsación, pero eso no basta: la primera cambia la pregunta,
 * la tarjeta nueva tiene otro alto y la segunda cae sobre lo que haya quedado debajo del
 * puntero —una opción de la pregunta nueva—, que la marcaba y la guardaba sin que el candidato
 * la hubiera visto. Lo mismo al elegir en la hoja del mapa, o con el aviso de lo que falta, que
 * empuja la tarjeta.
 *
 * Por eso se mira en toda la página, antes que React: la segunda pulsación de una serie
 * (`detail` > 1) que cae sobre otra cosa que la primera se descarta entera —ni enfoca, ni
 * marca, ni pulsa—. La que cae sobre lo mismo sigue igual: un doble clic dentro del texto
 * selecciona la palabra, y «Siguiente» se ocupa de la suya con `unaVez`.
 */
export function useUnaSolaPulsacion() {
  useEffect(() => {
    let primera: Element | null = null
    const vigilar = (e: MouseEvent) => {
      if (e.detail <= 1) {
        primera = mandoDe(e.target)
        return
      }
      // Sin la primera a la vista, la serie empezó antes de esta pantalla: tampoco cuenta aquí.
      if (primera !== null && mandoDe(e.target) === primera) return
      e.preventDefault()
      e.stopImmediatePropagation()
    }
    const tipos = ['mousedown', 'click', 'dblclick'] as const
    for (const tipo of tipos) document.addEventListener(tipo, vigilar, true)
    return () => {
      for (const tipo of tipos) document.removeEventListener(tipo, vigilar, true)
    }
  }, [])
}

export interface Recorrido {
  indice: number
  paso: Paso | undefined
  /** El paso del que se salió con el primer salto, si lo hay. */
  volverA: Paso | null
  /** La siguiente que no está lista, dando la vuelta; -1 si no hay otra. */
  proximaSinTerminar: number
  /** «Anterior» y «Siguiente»: moverse a mano olvida la vuelta. */
  navegarA: (indice: number) => void
  /** Un salto: el mapa, «Siguiente sin responder», el botón del aviso de entrega. */
  saltarA: (indice: number, enfocar?: DondeEnfocar) => void
  volver: () => void
  /** El enunciado: recibe el foco al cambiar de paso. */
  refEnunciado: React.RefObject<HTMLHeadingElement | null>
  /** La tarjeta, para traerla a la vista al cambiar de paso. */
  refTarjeta: React.RefObject<HTMLElement | null>
  /** La barra fija: lo que se trae a la vista se deja justo debajo de ella. */
  refBarra: React.RefObject<HTMLDivElement | null>
}

/**
 * @param pasos todos los pasos, con su estado de ahora. Vacío mientras no hay datos.
 * @param claveAlmacen dónde apuntar el paso en la pestaña, por intento o evaluación.
 * @param alMoverse lo que hay que hacer antes de cambiar de paso (mandar lo pendiente).
 */
export function useRecorrido(
  pasos: Paso[],
  claveAlmacen: string | null,
  alMoverse?: () => void,
): Recorrido {
  const [elegida, setElegida] = useState<string | null>(null)
  const [volverA, setVolverA] = useState<string | null>(null)
  const pedidoDeFoco = useRef<DondeEnfocar | null>(null)
  const refEnunciado = useRef<HTMLHeadingElement>(null)
  const refTarjeta = useRef<HTMLElement>(null)
  const refBarra = useRef<HTMLDivElement>(null)
  const alMoverseRef = useRef(alMoverse)
  alMoverseRef.current = alMoverse
  useUnaSolaPulsacion()

  /*
    El primer paso se decide **una sola vez**, cuando llegan los datos: lo apuntado en la
    pestaña, o la primera sin responder. Si se recalculara en cada pintado, responder la
    primera la volvería «lista» y la pantalla saltaría sola a la siguiente delante del
    candidato.
  */
  if (elegida === null && pasos.length > 0) {
    const apuntado = leerApuntado(claveAlmacen)
    const inicial =
      (apuntado !== null && pasos.some((p) => p.clave === apuntado) ? apuntado : null) ??
      pasos.find((p) => p.estado !== 'lista')?.clave ??
      pasos[0]!.clave
    setElegida(inicial)
  }

  const encontrado = elegida === null ? -1 : pasos.findIndex((p) => p.clave === elegida)
  const indice = Math.max(0, encontrado)
  const paso = pasos[indice]
  const claveDelPaso = paso?.clave ?? null

  useEffect(() => {
    if (claveDelPaso !== null) apuntar(claveAlmacen, claveDelPaso)
  }, [claveAlmacen, claveDelPaso])

  // Al cambiar de paso, el foco va al enunciado —o a lo que pidió el salto— y la tarjeta se
  // trae a la vista. La primera vez no: quien acaba de entrar no ha pedido moverse.
  const yaHabiaPaso = useRef(false)
  useEffect(() => {
    if (claveDelPaso === null) return
    if (!yaHabiaPaso.current) {
      yaHabiaPaso.current = true
      return
    }
    const pedido = pedidoDeFoco.current
    pedidoDeFoco.current = null
    const destino = pedido?.() ?? refEnunciado.current
    destino?.focus({ preventScroll: true })
    asomar(pedido ? destino : refTarjeta.current, refBarra.current)
  }, [claveDelPaso])

  const irA = useCallback(
    (siguiente: number, enfocar?: DondeEnfocar) => {
      const destino = pasos[Math.max(0, Math.min(pasos.length - 1, siguiente))]
      if (!destino) return
      alMoverseRef.current?.()
      pedidoDeFoco.current = enfocar ?? null
      setElegida(destino.clave)
    },
    [pasos],
  )

  const navegarA = useCallback(
    (siguiente: number) => {
      irA(siguiente)
      setVolverA(null)
    },
    [irA],
  )

  const saltarA = useCallback(
    (destino: number, enfocar?: DondeEnfocar) => {
      const alli = pasos[destino]
      if (!alli) return
      if (destino === indice) {
        // Ya está aquí: solo se lleva el foco a donde pide.
        const el = enfocar?.() ?? null
        el?.focus({ preventScroll: true })
        asomar(el, refBarra.current)
        return
      }
      const desde = paso?.clave ?? null
      // Volver al sitio del que se venía cierra el viaje: el botón ya sobra.
      setVolverA((deDonde) => (alli.clave === deDonde ? null : (deDonde ?? desde)))
      irA(destino, enfocar)
    },
    [pasos, indice, paso, irA],
  )

  const volver = useCallback(() => {
    if (volverA === null) return
    const destino = pasos.findIndex((p) => p.clave === volverA)
    setVolverA(null)
    if (destino >= 0) irA(destino)
  }, [pasos, volverA, irA])

  return {
    indice,
    paso,
    volverA: volverA === null ? null : (pasos.find((p) => p.clave === volverA) ?? null),
    proximaSinTerminar: siguienteIncompleta(
      pasos.map((p) => p.estado),
      indice,
    ),
    navegarA,
    saltarA,
    volver,
    refEnunciado,
    refTarjeta,
    refBarra,
  }
}

/**
 * Si la ventana cumple el corte, y se entera si cambia.
 *
 * La forma la decide el CSS; esto decide solo lo que el CSS no puede: si el mapa es una
 * columna o una hoja desde abajo, y si el caso va a un lado o plegado encima. Sin
 * `matchMedia` —jsdom, un WebView viejo— vale `siNoSeSabe`.
 */
export function useCorte(consulta: string, siNoSeSabe: boolean): boolean {
  const [cumple, setCumple] = useState(() =>
    typeof window.matchMedia === 'function' ? window.matchMedia(consulta).matches : siNoSeSabe,
  )
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const medida = window.matchMedia(consulta)
    const alCambiar = () => setCumple(medida.matches)
    alCambiar()
    medida.addEventListener?.('change', alCambiar)
    return () => medida.removeEventListener?.('change', alCambiar)
  }, [consulta])
  return cumple
}
