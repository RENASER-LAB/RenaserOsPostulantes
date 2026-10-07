/**
 * El botón «!» de la configuración de la prueba (V68): la guía de un campo, que
 * no ocupa sitio hasta que se pide.
 *
 * Se enseña al pasar el cursor, al llegar con el teclado o al tocarlo. Se cierra
 * al salir, al pulsar fuera o sobre ella, al volver a pulsar el «!» y con Escape
 * (que cierra solo la guía, no el panel). Abrir una cierra la otra.
 *
 * ⚠️ **Nunca tapa los controles de su campo (QA-07).** Tapándolos se comía el
 * clic de quien la leía y bajaba a rellenar el campo. Va en uno de dos sitios:
 *   - fuera del panel lateral, a su izquierda y a la altura de la etiqueta, si
 *     ahí cabe con un ancho cómodo (el escritorio);
 *   - si no (el teléfono, donde el panel ocupa la pantalla), en la página, en su
 *     propia línea bajo la etiqueta: empuja el campo hacia abajo.
 *
 * El cursor puede ir del «!» a la guía sin que se cierre: sigue abierta mientras
 * está en su zona y, al salir, espera un respiro por si vuelve. Fuera del panel
 * la zona es la línea de la etiqueta (la guía cuelga de ella en el DOM); en la
 * página es el campo entero, porque si se cerrara al bajar a las opciones estas
 * subirían bajo el cursor.
 *
 * Fuera del panel la guía no se desplaza con él: si al bajarlo su etiqueta sale
 * de la vista, se esconde (QA-09), como la de la página, que se va con ella; sigue
 * abierta y vuelve cuando la etiqueta vuelve a verse.
 *
 * Funciona también en lectura: leer una guía no cambia nada.
 */

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { IconoAviso } from '@/ui/Iconos'
import estilos from './EditorDePreguntas.module.css'

/** Lo que espera la guía, al salir el cursor de su zona, por si vuelve. */
const RESPIRO_AL_SALIR = 300

/** El ancho cómodo fuera del panel (unas 45 letras) y el mínimo para sacarla, en rem. */
const ANCHO_COMODO = 26
const ANCHO_MINIMO = 18
/** Lo que deja libre entre la guía y el panel, y con los bordes de la ventana. */
const MARGEN = 16
/** Del borde de arriba de la guía al centro de su primera línea: 12 de relleno + 24 / 2. */
const HASTA_LA_PRIMERA_LINEA = 24

/** La guía abierta ahora mismo: al abrir otra, esta se cierra. */
let cerrarLaAbierta: (() => void) | null = null

interface AlLado {
  top: number
  left: number
  width: number
  /** El centro de la etiqueta, desde arriba de la guía: ahí va la punta. */
  punta: number
  /** Si la etiqueta se ve: con el panel bajado puede haber salido de la vista. */
  aLaVista: boolean
}

/** La parte del panel que se ve: su cuerpo, que es lo que se desplaza, dentro de la ventana. */
function franjaALaVista(boton: HTMLElement, panel: Element): { arriba: number; abajo: number } {
  let cuerpo: Element = panel
  for (let e = boton.parentElement; e && e !== panel; e = e.parentElement) {
    const desborde = getComputedStyle(e).overflowY
    if (desborde === 'auto' || desborde === 'scroll') {
      cuerpo = e
      break
    }
  }
  const caja = cuerpo.getBoundingClientRect()
  return { arriba: Math.max(caja.top, 0), abajo: Math.min(caja.bottom, window.innerHeight) }
}

/**
 * Fuera del panel, con su primera línea a la altura de la etiqueta; `null` si
 * ahí no cabe cómoda. La altura se toma del «!», que está centrado en la línea
 * de la etiqueta: la fila entera crece cuando la guía va en la página.
 */
function lugarAlLado(boton: HTMLElement, alto: number): AlLado | null {
  const panel = boton.closest('[role="dialog"]')
  if (!panel) return null
  const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  const borde = panel.getBoundingClientRect().left
  const width = Math.min(ANCHO_COMODO * rem, borde - 2 * MARGEN)
  if (width < ANCHO_MINIMO * rem) return null
  const caja = boton.getBoundingClientRect()
  const centro = caja.top + caja.height / 2
  const top = Math.max(MARGEN, Math.min(centro - HASTA_LA_PRIMERA_LINEA, window.innerHeight - MARGEN - alto))
  const { arriba, abajo } = franjaALaVista(boton, panel)
  return { top, left: borde - MARGEN - width, width, punta: centro - top, aLaVista: arriba <= centro && centro <= abajo }
}

const mismoLugar = (a: AlLado | null, b: AlLado | null) =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.top === b.top &&
    a.left === b.left &&
    a.width === b.width &&
    a.punta === b.punta &&
    a.aLaVista === b.aLaVista)

export function Guia({ de, texto }: { de: string; texto: string }) {
  const id = useId()
  const boton = useRef<HTMLButtonElement>(null)
  const guia = useRef<HTMLSpanElement>(null)
  const [porCursor, setPorCursor] = useState(false)
  const [porFoco, setPorFoco] = useState(false)
  const [tocada, setTocada] = useState(false)
  const [alLado, setAlLado] = useState<AlLado | null>(null)
  const salida = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abierta = porCursor || porFoco || tocada
  const fuera = abierta && alLado !== null

  const cancelarSalida = useCallback(() => {
    if (salida.current) clearTimeout(salida.current)
    salida.current = null
  }, [])
  const salir = useCallback(() => {
    cancelarSalida()
    salida.current = setTimeout(() => {
      salida.current = null
      setPorCursor(false)
    }, RESPIRO_AL_SALIR)
  }, [cancelarSalida])
  const cerrar = useCallback(() => {
    cancelarSalida()
    setPorCursor(false)
    setPorFoco(false)
    setTocada(false)
  }, [cancelarSalida])

  /** La zona en la que el cursor la mantiene abierta: la línea de la etiqueta o el campo. */
  const zona = useCallback((): HTMLElement | null => {
    const fila = boton.current?.parentElement ?? null
    return fuera ? fila : (fila?.parentElement ?? fila)
  }, [fuera])

  /** Si el cursor sale del «!» o de la guía hacia fuera de la zona, espera y se cierra. */
  const alSalirHacia = (destino: EventTarget | null) => {
    const dentro = destino instanceof Node && (zona()?.contains(destino) || guia.current?.contains(destino))
    if (!dentro) salir()
  }

  // Dónde va: se mide antes de pintar, y otra vez con la guía ya en su ancho.
  useLayoutEffect(() => {
    if (!abierta) return
    const colocar = () => {
      const nuevo = boton.current ? lugarAlLado(boton.current, guia.current?.offsetHeight ?? 0) : null
      setAlLado((viejo) => (mismoLugar(viejo, nuevo) ? viejo : nuevo))
    }
    colocar()
    const otraVez = requestAnimationFrame(colocar)
    window.addEventListener('resize', colocar)
    document.addEventListener('scroll', colocar, true)
    return () => {
      cancelAnimationFrame(otraVez)
      window.removeEventListener('resize', colocar)
      document.removeEventListener('scroll', colocar, true)
    }
  }, [abierta])

  // Abierta por el cursor: dentro de su zona se queda; al salir, el respiro.
  useEffect(() => {
    const z = porCursor ? zona() : null
    if (!z) return
    z.addEventListener('mouseenter', cancelarSalida)
    z.addEventListener('mouseleave', salir)
    return () => {
      z.removeEventListener('mouseenter', cancelarSalida)
      z.removeEventListener('mouseleave', salir)
    }
  }, [porCursor, zona, cancelarSalida, salir])

  // Abierta: una sola a la vez; pulsar fuera o sobre ella la cierra; Escape, solo a ella.
  useEffect(() => {
    if (!abierta) return
    cerrarLaAbierta?.()
    cerrarLaAbierta = cerrar
    const alPulsar = (e: MouseEvent) => {
      // El «!» decide por su cuenta: su pulsación la fija o la cierra.
      if (e.target instanceof Node && boton.current?.contains(e.target)) return
      cerrar()
    }
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Antes que el panel, que también escucha Escape: se cierra solo la guía.
      e.stopPropagation()
      cerrar()
    }
    document.addEventListener('click', alPulsar)
    document.addEventListener('keydown', alTeclear, true)
    return () => {
      if (cerrarLaAbierta === cerrar) cerrarLaAbierta = null
      document.removeEventListener('click', alPulsar)
      document.removeEventListener('keydown', alTeclear, true)
    }
  }, [abierta, cerrar])

  useEffect(() => cancelarSalida, [cancelarSalida])

  // Escondida y no cerrada: la etiqueta fuera de la vista no le quita el foco ni la deja de fijar.
  const estiloAlLado: CSSProperties | undefined =
    fuera && alLado
      ? {
          top: alLado.top,
          left: alLado.left,
          inlineSize: alLado.width,
          visibility: alLado.aLaVista ? undefined : 'hidden',
          ['--punta' as string]: `${alLado.punta}px`,
        }
      : undefined

  return (
    <>
      <button
        ref={boton}
        className={estilos.botonGuia}
        type="button"
        aria-label={`Guía: ${de}`}
        aria-describedby={abierta ? id : undefined}
        aria-expanded={abierta}
        onMouseEnter={() => {
          cancelarSalida()
          setPorCursor(true)
        }}
        onMouseLeave={(e) => alSalirHacia(e.relatedTarget)}
        onFocus={() => setPorFoco(true)}
        onBlur={() => {
          setPorFoco(false)
          setTocada(false)
        }}
        // La primera pulsación la deja fija aunque el cursor se vaya; la segunda la cierra.
        onClick={() => (tocada ? cerrar() : setTocada(true))}
      >
        <IconoAviso tamano={20} />
      </button>
      {abierta && (
        <span
          ref={guia}
          className={fuera ? `${estilos.textoGuia} ${estilos.textoGuiaAlLado}` : estilos.textoGuia}
          style={estiloAlLado}
          role="tooltip"
          id={id}
          onMouseEnter={cancelarSalida}
          onMouseLeave={(e) => alSalirHacia(e.relatedTarget)}
        >
          {texto}
        </span>
      )}
    </>
  )
}
