/**
 * La pestaña «Brochure» de «Perfil de la empresa» (V86): la plantilla, el color,
 * «Descargar brochure (PDF)» y, al lado, la primera hoja con lo elegido.
 *
 * **La plantilla y el color se guardan solos al elegirlos**, sin «Guardar» ni
 * «Dejarlo», con `PUT /presentacion/brochure`. Si falla, vuelve la elección
 * anterior y lo dice. Lo que se escribe en la pestaña «Perfil» sigue aparte: no
 * se guarda aquí y la descarga trae lo último guardado, lo que avisa el chip
 * «Usa lo último guardado».
 *
 * El estado vive en `useBrochure`, que llama el editor y no esta pestaña: así una
 * elección a medio guardar o un «Generando…» no se pierden al cambiar de pestaña.
 */

import { useCallback, useRef, useState } from 'react'
import { IconoDescargar } from '@/ui/Iconos'
import areas from '../configuracion/Areas.module.css'
import { guardarBrochure, type PresentacionPanel } from '../api/presentacion'
import {
  COLORES,
  MENSAJE_ELECCION_NO_GUARDADA,
  MENSAJE_FALLO_BROCHURE,
  MENSAJE_FALTA_QUIENES,
  MENSAJE_USA_LO_GUARDADO,
  PLANTILLAS,
  abrirBrochure,
  eleccionDe,
  hexDe,
  mismaEleccion,
  type Eleccion,
} from './brochure'
import { MiniaturaDelBrochure } from './MiniaturaDelBrochure'
import estilos from './PerfilDeLaEmpresa.module.css'

type EstadoDeLaDescarga = 'listo' | 'generando' | 'fallo'

export interface Brochure {
  /** La que se ve: la que se está guardando o, si no, la guardada. */
  elegida: Eleccion
  elegir: (eleccion: Eleccion) => void
  /** Si la última elección no se pudo guardar (y volvió la anterior). */
  noSeGuardo: boolean
  descarga: EstadoDeLaDescarga
  descargar: () => void
}

/**
 * Guarda la plantilla y el color al elegirlos, de uno en uno y en orden: si se
 * elige otra mientras se guarda la anterior, se guarda después la última, y la
 * descarga espera a que termine. Al guardar, `alGuardar` recibe lo que dijo el
 * backend.
 */
export function useBrochure({
  guardado,
  alGuardar,
}: {
  guardado: PresentacionPanel
  alGuardar: (respuesta: PresentacionPanel) => void
}): Brochure {
  const [enEspera, setEnEspera] = useState<Eleccion | null>(null)
  const [noSeGuardo, setNoSeGuardo] = useState(false)
  const [descarga, setDescarga] = useState<EstadoDeLaDescarga>('listo')
  const guardando = useRef<Promise<void> | null>(null)
  const enCurso = useRef(false)
  const siguiente = useRef<Eleccion | null>(null)
  const descargando = useRef(false)
  const elegida = enEspera ?? eleccionDe(guardado)

  const guardarEnOrden = useCallback(
    async (primera: Eleccion) => {
      enCurso.current = true
      let actual: Eleccion | null = primera
      try {
        while (actual) {
          const respuesta = await guardarBrochure({ plantillaBrochure: actual.plantilla, colorBrochure: actual.color })
          alGuardar(respuesta)
          const otra: Eleccion | null = siguiente.current
          siguiente.current = null
          actual = otra && !mismaEleccion(otra, eleccionDe(respuesta)) ? otra : null
        }
        setEnEspera(null)
      } catch {
        // Vuelve la anterior: la última que sí se guardó.
        siguiente.current = null
        setEnEspera(null)
        setNoSeGuardo(true)
      } finally {
        enCurso.current = false
      }
    },
    [alGuardar],
  )

  function elegir(eleccion: Eleccion) {
    if (mismaEleccion(eleccion, elegida)) return
    setNoSeGuardo(false)
    setEnEspera(eleccion)
    if (enCurso.current) {
      siguiente.current = eleccion
      return
    }
    guardando.current = guardarEnOrden(eleccion)
  }

  async function descargar() {
    if (descargando.current) return
    descargando.current = true
    setDescarga('generando')
    try {
      await abrirBrochure(guardado.nombre, guardado.codigo, guardando.current)
      setDescarga('listo')
    } catch {
      setDescarga('fallo')
    } finally {
      descargando.current = false
    }
  }

  return { elegida, elegir, noSeGuardo, descarga, descargar: () => void descargar() }
}

export function PestanaBrochure({
  brochure,
  portada,
  hayLoMinimo,
  cambiado,
}: {
  brochure: Brochure
  /** La foto de portada guardada, la que lleva el PDF. */
  portada: string | null
  hayLoMinimo: boolean
  /** Si la pestaña «Perfil» tiene cambios sin guardar. */
  cambiado: boolean
}) {
  const { elegida, elegir, noSeGuardo, descarga, descargar } = brochure
  const hex = hexDe(elegida.color)
  const nombrePlantilla = PLANTILLAS.find((p) => p.codigo === elegida.plantilla)?.nombre ?? ''
  const nombreColor = COLORES.find((c) => c.codigo === elegida.color)?.nombre ?? ''

  return (
    <>
      <section className={estilos.seccion}>
        <div>
          <span className={estilos.rotulo} id="rotulo-plantilla">
            Plantilla del brochure
          </span>
          <Opciones
            clase={estilos.plantillas}
            rotulo="rotulo-plantilla"
            opciones={PLANTILLAS}
            elegida={elegida.plantilla}
            alElegir={(plantilla) => elegir({ ...elegida, plantilla })}
            pintar={(p, marcada, props) => (
              <button className={estilos.plantilla} type="button" role="radio" aria-checked={marcada} {...props}>
                <span className={estilos.muestra}>
                  <MiniaturaDelBrochure plantilla={p.codigo} color={hex} portada={portada} />
                </span>
                <span className={estilos.nombrePlantilla}>{p.nombre}</span>
              </button>
            )}
          />
        </div>
        <div>
          <span className={estilos.rotulo} id="rotulo-color">
            Color
          </span>
          <Opciones
            clase={estilos.colores}
            rotulo="rotulo-color"
            opciones={COLORES}
            elegida={elegida.color}
            alElegir={(color) => elegir({ ...elegida, color })}
            pintar={(c, marcada, props) => (
              <button
                className={estilos.color}
                type="button"
                role="radio"
                aria-checked={marcada}
                aria-label={c.nombre}
                title={c.nombre}
                {...props}
              >
                <span style={{ background: c.hex }} />
              </button>
            )}
          />
        </div>
        {noSeGuardo && (
          <p className={estilos.errorImagen} role="alert">
            {MENSAJE_ELECCION_NO_GUARDADA}
          </p>
        )}
        <div className={estilos.filaPdf}>
          <button
            className={estilos.descargar}
            type="button"
            disabled={!hayLoMinimo || descarga === 'generando'}
            onClick={descargar}
          >
            <IconoDescargar tamano={16} />
            {descarga === 'generando' ? 'Generando…' : 'Descargar brochure (PDF)'}
          </button>
          {!hayLoMinimo && <span className={`${areas.marca} ${areas.retirada}`}>{MENSAJE_FALTA_QUIENES}</span>}
          {hayLoMinimo && cambiado && (
            <span className={`${areas.marca} ${areas.retirada}`}>{MENSAJE_USA_LO_GUARDADO}</span>
          )}
          {descarga === 'fallo' && (
            <span className={estilos.falloPdf} role="alert">
              {MENSAJE_FALLO_BROCHURE}
            </span>
          )}
        </div>
      </section>

      <div className={estilos.hoja} role="img" aria-label={`Primera hoja del brochure: ${nombrePlantilla}, ${nombreColor}`}>
        <MiniaturaDelBrochure plantilla={elegida.plantilla} color={hex} portada={portada} />
      </div>
    </>
  )
}

const PASOS: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }

/**
 * Un grupo de opciones de las que se elige una (`radiogroup`), con el teclado del
 * patrón de radios: las flechas cambian la elegida y solo ella está en el orden
 * del tabulador.
 */
function Opciones<T extends { codigo: C }, C extends string>({
  clase,
  rotulo,
  opciones,
  elegida,
  alElegir,
  pintar,
}: {
  clase: string | undefined
  rotulo: string
  opciones: ReadonlyArray<T>
  elegida: C
  alElegir: (codigo: C) => void
  pintar: (
    opcion: T,
    marcada: boolean,
    props: {
      tabIndex: number
      onClick: () => void
      onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void
      ref: (nodo: HTMLButtonElement | null) => void
    },
  ) => React.ReactNode
}) {
  const botones = useRef<Array<HTMLButtonElement | null>>([])
  const actual = Math.max(
    0,
    opciones.findIndex((o) => o.codigo === elegida),
  )

  function mover(e: React.KeyboardEvent<HTMLButtonElement>, desde: number) {
    const paso = PASOS[e.key]
    if (!paso) return
    e.preventDefault()
    const siguiente = (desde + paso + opciones.length) % opciones.length
    alElegir(opciones[siguiente]!.codigo)
    botones.current[siguiente]?.focus()
  }

  return (
    <ul className={clase} role="radiogroup" aria-labelledby={rotulo}>
      {opciones.map((opcion, i) => (
        <li key={opcion.codigo}>
          {pintar(opcion, i === actual && opcion.codigo === elegida, {
            tabIndex: i === actual ? 0 : -1,
            onClick: () => alElegir(opcion.codigo),
            onKeyDown: (e) => mover(e, i),
            ref: (nodo) => {
              botones.current[i] = nodo
            },
          })}
        </li>
      ))}
    </ul>
  )
}
