/**
 * La guía de los avisos: tres pasos con foco sobre la campana, la primera vez (25/11/2026).
 *
 * Los ajustes de avisos dejaron de ser un botón en «Mis procesos» y pasaron a una tuerca
 * dentro de la campana. Para que se sepa dónde están, la primera vez que alguien entra en
 * «Mis procesos» con alguna postulación sale esto, una sola vez por cuenta (el servidor lo
 * recuerda, V93):
 *
 *   1. «Aquí te avisamos de todo», con el foco en la campana.
 *   2. La campana se abre y el foco pasa a la tuerca: «Con la tuerca eliges por dónde».
 *   3. «Recibe tus avisos por WhatsApp», con el botón verde que abre los ajustes y lo enciende
 *      como el interruptor, con el mismo consentimiento debajo. Con WhatsApp esperando su
 *      mensaje, «Termina de activar WhatsApp»: el número al que le toca escribir (enmascarado), el botón
 *      verde «Abrir WhatsApp» —el mismo flujo que «Activar WhatsApp», que vuelve a dar el
 *      chat; si no hay chat que abrir, quedan los ajustes a la vista— y «Ahora no». Con
 *      WhatsApp ya activo, «Todo listo» y un solo «Entendido». Sin WhatsApp (la beta apagada)
 *      no hay paso 3, y el 2 termina en «Entendido».
 *
 * Quién la pinta y quién decide cuándo: la campana (dueña del botón, la tuerca y la
 * ventana) lleva el paso; esto solo dibuja el foco y la burbuja, y avisa.
 *
 * Es un `<dialog>` modal a pantalla completa y transparente: lo de debajo queda inerte, el
 * foco no sale de la burbuja y Esc la salta. El velo con el agujero es la sombra enorme de
 * `.foco`; la burbuja va encima. Sin movimiento, el foco cambia de sitio sin deslizarse.
 *
 * ⚠️ **El dialog no se cierra con `close()` al terminar: se desmonta.** Cerrarlo devolvería el
 * foco a lo que lo tenía antes de abrirse, y al activar WhatsApp eso se lo quitaría a la
 * ventana de ajustes, que se abre en el mismo clic. El foco lo devuelve la campana.
 */

import { useCallback, useId, useLayoutEffect, useRef, type KeyboardEvent, type RefObject } from 'react'
import type { Notificaciones } from '@/api/tipos'
import { enmascarado } from '@/dominio/celular'
import { IconoPantalla, IconoSobre, IconoWhatsapp } from '@/ui/Iconos'
import { useCorte } from '@/ui/useCorte'
import { CONSENTIMIENTO_WHATSAPP_CUENTA } from './Ajustes'
import estilos from './Guia.module.css'

export type PasoDeLaGuia = 1 | 2 | 3

interface PropsGuia {
  datos: Notificaciones
  paso: PasoDeLaGuia
  /** El botón de la campana: el foco del paso 1. */
  campana: RefObject<HTMLElement | null>
  /** La tuerca: el foco de los pasos 2 y 3. */
  tuerca: RefObject<HTMLElement | null>
  /** El panel abierto de la campana: la burbuja se pone a su lado (o encima, en el teléfono). */
  panel: RefObject<HTMLElement | null>
  alIrA: (paso: PasoDeLaGuia) => void
  /** «Saltar guía», «Ahora no», «Entendido» o Esc: queda vista. */
  alTerminar: () => void
  /** «Activar WhatsApp» o, esperando su mensaje, «Abrir WhatsApp»: queda vista y se abren los ajustes. */
  alActivar: () => void
}

// ---------- Dónde va cada cosa ----------

interface Caja {
  left: number
  top: number
  width: number
  height: number
}

export interface Colocacion {
  foco: Caja
  burbuja: { left: number; width: number; top?: number; bottom?: number }
  /** Hacia dónde apunta el pico y a cuántos píxeles del borde de la burbuja. */
  flecha: { lado: 'arriba' | 'abajo' | 'derecha'; a: number } | null
}

const MARGEN = 16
const ANCHO = 360
/** Lo que sobra el foco alrededor de lo que señala. */
const AURA = 6
/** De la campana a la burbuja, y de la burbuja al panel. */
const HUECO = 18
const PICO = 7

const entre = (minimo: number, valor: number, maximo: number) => Math.max(minimo, Math.min(valor, maximo))

/**
 * Pura, para poder probarla sin navegador: dónde va el foco, la burbuja y su pico.
 *
 *   - Escritorio, paso 1: bajo la campana, con el borde derecho casi en el suyo.
 *   - Escritorio, pasos 2 y 3: a la izquierda del panel abierto, a la altura de la tuerca y
 *     con el pico a la derecha. Si no cabe, debajo del panel y sin pico.
 *   - Teléfono, paso 1: a todo el ancho bajo la cabecera.
 *   - Teléfono, pasos 2 y 3: a todo el ancho encima de la hoja de la campana, con el pico
 *     abajo. Si la hoja no deja sitio, arriba del todo y sin pico.
 */
export function colocar({
  objetivo,
  panel,
  ancho,
  alto,
  altoBurbuja,
  estrecha,
  sobreElPanel,
}: {
  objetivo: Caja
  panel: Caja | null
  ancho: number
  alto: number
  altoBurbuja: number
  estrecha: boolean
  sobreElPanel: boolean
}): Colocacion {
  const foco = {
    left: objetivo.left - AURA,
    top: objetivo.top - AURA,
    width: objetivo.width + AURA * 2,
    height: objetivo.height + AURA * 2,
  }
  const centroX = objetivo.left + objetivo.width / 2
  const centroY = objetivo.top + objetivo.height / 2

  if (estrecha) {
    const width = Math.max(0, ancho - MARGEN * 2)
    const a = entre(MARGEN, centroX - MARGEN, width - MARGEN)
    if (!sobreElPanel || !panel) {
      return { foco, burbuja: { left: MARGEN, width, top: objetivo.top + objetivo.height + HUECO }, flecha: { lado: 'arriba', a } }
    }
    if (panel.top - MARGEN - altoBurbuja >= MARGEN) {
      return { foco, burbuja: { left: MARGEN, width, bottom: alto - panel.top + MARGEN }, flecha: { lado: 'abajo', a } }
    }
    return { foco, burbuja: { left: MARGEN, width, top: MARGEN }, flecha: null }
  }

  const width = Math.min(ANCHO, ancho - MARGEN * 2)
  if (!sobreElPanel || !panel) {
    const derecha = Math.min(ancho - MARGEN, objetivo.left + objetivo.width + 12)
    const left = Math.max(MARGEN, derecha - width)
    return {
      foco,
      burbuja: { left, width, top: objetivo.top + objetivo.height + HUECO },
      flecha: { lado: 'arriba', a: entre(MARGEN, centroX - left, width - MARGEN) },
    }
  }
  const derecha = panel.left - 20
  if (derecha - width >= MARGEN) {
    const top = entre(MARGEN, centroY - 34, Math.max(MARGEN, alto - altoBurbuja - MARGEN))
    return {
      foco,
      burbuja: { left: derecha - width, width, top },
      flecha: { lado: 'derecha', a: entre(MARGEN, centroY - top, Math.max(MARGEN, altoBurbuja - MARGEN)) },
    }
  }
  return {
    foco,
    burbuja: { left: Math.max(MARGEN, panel.left + panel.width - width), width, top: panel.top + panel.height + MARGEN },
    flecha: null,
  }
}

function caja(elemento: HTMLElement | null): Caja | null {
  if (!elemento) return null
  const r = elemento.getBoundingClientRect()
  return { left: r.left, top: r.top, width: r.width, height: r.height }
}

const px = (n: number) => `${Math.round(n)}px`

// ---------- La guía ----------

export function GuiaDeAvisos({ datos, paso, campana, tuerca, panel, alIrA, alTerminar, alActivar }: PropsGuia) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const foco = useRef<HTMLDivElement>(null)
  const burbuja = useRef<HTMLDivElement>(null)
  const pico = useRef<HTMLSpanElement>(null)
  const principal = useRef<HTMLButtonElement>(null)
  const idTitulo = useId()
  const estrecha = useCorte('(max-width: 30rem)')

  const conWhatsapp = datos.whatsapp.disponible
  const total = conWhatsapp ? 3 : 2
  const { estado, numero } = datos.whatsapp
  const sobreLaTuerca = paso >= 2

  /*
    Se abre al montarse, antes de medir nada: cerrado no ocupa sitio y la burbuja mediría 0.
    Al terminar se desmonta (ver arriba por qué no se cierra).
  */
  useLayoutEffect(() => {
    const d = dialogo.current
    if (d && !d.open) d.showModal()
  }, [])

  /*
    El foco, al botón principal de cada paso, pero solo con la burbuja ya a la vista.

    ⚠️ Hasta que se coloca por primera vez la burbuja está `visibility: hidden`, y ahí el
    navegador ignora `focus()`: el foco se quedaba en el propio `<dialog>` (lo que deja
    `showModal()`), Enter no avanzaba y el primer Tab iba a «Saltar guía». Así que cada paso
    deja el foco pendiente y se pone en cuanto se puede: enseguida si ya estaba colocada, o
    en el cuadro en que se coloca. Si no prende, se reintenta en el siguiente cuadro.
  */
  const focoPendiente = useRef(true)
  const enfocarSiToca = useCallback(() => {
    const d = dialogo.current
    const boton = principal.current
    if (!focoPendiente.current || !d?.open || d.dataset.colocada === undefined || !boton) return
    boton.focus()
    if (document.activeElement === boton) focoPendiente.current = false
  }, [])

  useLayoutEffect(() => {
    focoPendiente.current = true
    enfocarSiToca()
  }, [paso, enfocarSiToca])

  /*
    Se mide y se escribe directo en el estilo: sigue al panel mientras se abre (su entrada
    dura 200 ms) y a la ventana si cambia de tamaño, sin volver a pintar la guía en cada cuadro.
  */
  const recolocar = useCallback(() => {
    const objetivo = caja(sobreLaTuerca ? tuerca.current : campana.current)
    if (!objetivo || !foco.current || !burbuja.current) return
    const c = colocar({
      objetivo,
      panel: caja(panel.current),
      ancho: window.innerWidth,
      alto: window.innerHeight,
      altoBurbuja: burbuja.current.offsetHeight,
      estrecha,
      sobreElPanel: sobreLaTuerca,
    })
    const f = foco.current.style
    f.left = px(c.foco.left)
    f.top = px(c.foco.top)
    f.width = px(c.foco.width)
    f.height = px(c.foco.height)
    const b = burbuja.current.style
    b.left = px(c.burbuja.left)
    b.width = px(c.burbuja.width)
    b.top = c.burbuja.top === undefined ? 'auto' : px(c.burbuja.top)
    b.bottom = c.burbuja.bottom === undefined ? 'auto' : px(c.burbuja.bottom)
    if (pico.current) {
      pico.current.dataset.lado = c.flecha?.lado ?? ''
      pico.current.style.setProperty('--a', px((c.flecha?.a ?? 0) - PICO))
    }
    // Lo primero se coloca sin deslizarse desde la esquina; ya visible, el foco puede entrar.
    requestAnimationFrame(() => {
      if (dialogo.current) dialogo.current.dataset.colocada = ''
      enfocarSiToca()
    })
  }, [sobreLaTuerca, estrecha, campana, tuerca, panel, enfocarSiToca])

  useLayoutEffect(() => {
    recolocar()
    const hasta = performance.now() + 450
    let cuadro = requestAnimationFrame(function seguir() {
      recolocar()
      if (performance.now() < hasta) cuadro = requestAnimationFrame(seguir)
    })
    window.addEventListener('resize', recolocar)
    return () => {
      cancelAnimationFrame(cuadro)
      window.removeEventListener('resize', recolocar)
    }
  }, [recolocar, paso])

  /** Tab no sale de la burbuja: del último al primero y al revés. */
  function atraparElFoco(evento: KeyboardEvent) {
    if (evento.key !== 'Tab' || !burbuja.current) return
    const pulsables = Array.from(burbuja.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]'))
    if (pulsables.length === 0) return
    const primero = pulsables[0]!
    const ultimo = pulsables[pulsables.length - 1]!
    if (evento.shiftKey && document.activeElement === primero) {
      evento.preventDefault()
      ultimo.focus()
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault()
      primero.focus()
    }
  }

  let contenido
  if (paso === 1) {
    contenido = (
      <>
        <h2 id={idTitulo} className={estilos.titulo}>
          Aquí te avisamos de todo
        </h2>
        <p className={estilos.texto}>Cada vez que tu proceso avanza, la campana se marca con un número.</p>
        <div className={estilos.botones}>
          <button type="button" className={estilos.secundario} onClick={alTerminar}>
            Saltar guía
          </button>
          <button ref={principal} type="button" className={estilos.principal} onClick={() => alIrA(2)}>
            Siguiente
          </button>
        </div>
      </>
    )
  } else if (paso === 2) {
    const ultimo = !conWhatsapp
    contenido = (
      <>
        <h2 id={idTitulo} className={estilos.titulo}>
          Con la tuerca eliges por dónde
        </h2>
        <p className={estilos.texto}>Enciende o apaga cada canal cuando quieras.</p>
        <ul className={estilos.chips}>
          {conWhatsapp && (
            <li className={estilos.chip}>
              <span className={estilos.iconoWhatsapp}>
                <IconoWhatsapp tamano={15} />
              </span>
              WhatsApp
            </li>
          )}
          <li className={estilos.chip}>
            <span className={estilos.iconoCanal}>
              <IconoSobre tamano={15} />
            </span>
            Correo
          </li>
          <li className={estilos.chip}>
            <span className={estilos.iconoCanal}>
              <IconoPantalla tamano={15} />
            </span>
            En el portal
          </li>
        </ul>
        <div className={estilos.botones}>
          <button type="button" className={estilos.secundario} onClick={() => alIrA(1)}>
            Atrás
          </button>
          <button
            ref={principal}
            type="button"
            className={estilos.principal}
            onClick={ultimo ? alTerminar : () => alIrA(3)}
          >
            {ultimo ? 'Entendido' : 'Siguiente'}
          </button>
        </div>
      </>
    )
  } else if (estado === 'ACTIVO') {
    contenido = (
      <>
        <h2 id={idTitulo} className={estilos.titulo}>
          Todo listo
        </h2>
        <p className={estilos.texto}>Te avisamos de todos tus procesos y puedes escribirnos tus dudas.</p>
        <div className={`${estilos.botones} ${estilos.botonesAlFinal}`}>
          <button ref={principal} type="button" className={estilos.principal} onClick={alTerminar}>
            Entendido
          </button>
        </div>
      </>
    )
  } else if (estado === 'ESPERANDO') {
    /*
      Ya lo activó y falta su mensaje. «Abrir WhatsApp» es el mismo «Activar WhatsApp» (la
      campana abre los ajustes y lo enciende como el interruptor): el backend renueva la espera
      y vuelve a dar el chat, que se abre en la pestaña pedida en este clic. Si no hay chat que
      abrir —el navegador la bloqueó o el número ya estaba comprobado—, quedan a la vista los
      ajustes, con su «Ábrelo desde aquí» o lo que haya cambiado. El número va enmascarado como
      el de WhatsApp activo («+51 9•• ••• 434»): la burbuja sale sobre «Mis procesos», a la vista
      de quien mire por encima del hombro. La ventana de ajustes lo sigue enseñando entero.
    */
    const suNumero = enmascarado(numero)
    contenido = (
      <>
        <h2 id={idTitulo} className={estilos.titulo}>
          Termina de activar WhatsApp
        </h2>
        <p className={estilos.texto}>
          Envía el mensaje desde tu número
          {suNumero ? (
            <>
              {' '}
              <span className={estilos.numero}>{suNumero}</span>
            </>
          ) : null}
          .
        </p>
        <button ref={principal} type="button" className={estilos.activar} onClick={alActivar}>
          <IconoWhatsapp tamano={16} />
          Abrir WhatsApp
        </button>
        <div className={`${estilos.botones} ${estilos.botonesAlFinal}`}>
          <button type="button" className={estilos.secundario} onClick={alTerminar}>
            Ahora no
          </button>
        </div>
      </>
    )
  } else {
    contenido = (
      <>
        <h2 id={idTitulo} className={estilos.titulo}>
          Recibe tus avisos por WhatsApp
        </h2>
        <p className={estilos.texto}>Y pregúntanos tus dudas. Correo y portal ya están encendidos.</p>
        <button ref={principal} type="button" className={estilos.activar} onClick={alActivar}>
          <IconoWhatsapp tamano={16} />
          Activar WhatsApp
        </button>
        <p className={estilos.consentimiento}>{CONSENTIMIENTO_WHATSAPP_CUENTA}</p>
        <div className={estilos.botones}>
          <button type="button" className={estilos.secundario} onClick={() => alIrA(2)}>
            Atrás
          </button>
          <button type="button" className={estilos.secundario} onClick={alTerminar}>
            Ahora no
          </button>
        </div>
      </>
    )
  }

  return (
    <dialog
      ref={dialogo}
      className={estilos.guia}
      aria-modal="true"
      aria-labelledby={idTitulo}
      onCancel={(evento) => {
        // Esc salta la guía: queda vista, como «Saltar guía».
        evento.preventDefault()
        alTerminar()
      }}
      onKeyDown={atraparElFoco}
    >
      <div ref={foco} className={estilos.foco} aria-hidden="true" />
      <div ref={burbuja} className={estilos.burbuja}>
        <span ref={pico} className={estilos.pico} aria-hidden="true" />
        <div className={estilos.cabeza}>
          <span className={estilos.cuenta}>
            {paso} de {total}
          </span>
          <span className={estilos.barras} aria-hidden="true">
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className={estilos.barra} data-hecha={i < paso || undefined} />
            ))}
          </span>
        </div>
        {/* La clave por paso hace que cada uno entre de nuevo, sin arrastrar el anterior. */}
        <div key={paso} className={estilos.paso}>
          {contenido}
        </div>
      </div>
    </dialog>
  )
}
