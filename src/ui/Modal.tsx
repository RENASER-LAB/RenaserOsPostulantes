/**
 * El modal compartido: cabecera con titulo, cuerpo y pie con botones.
 *
 * Se cierra con Escape, tocando el fondo o con la aspa. Mientras esta abierto
 * el fondo no hace scroll y el foco no se escapa fuera.
 *
 * `onCerrar` recibe por donde se cerro. Casi nadie lo mira; lo necesita quien
 * pregunta antes de descartar un borrador, porque con la pregunta a la vista
 * Escape la quita y el aspa y el fondo no hacen nada.
 *
 * Con `aPruebaDeDobleClic`, nada del modal —fondo, aspa ni botones— responde al
 * puntero que sigue a la pulsacion que lo abrio: ver `GRACIA_TRAS_ABRIR_MS`.
 */

import { useEffect, useRef, useState, type MouseEvent, type ReactNode, type SyntheticEvent } from 'react'
import estilos from './Modal.module.css'

/** El elemento con el foco ahora mismo, si es uno al que se puede volver. */
const conElFoco = (): HTMLElement | null =>
  document.activeElement instanceof HTMLElement && document.activeElement !== document.body
    ? document.activeElement
    : null

/** Por donde se pidio cerrar: la tecla, el aspa, el fondo o el «Cerrar» del pie por defecto. */
export type ComoSeCierra = 'escape' | 'aspa' | 'fondo' | 'pie'

/**
 * **Lo que el modal ignora del puntero tras abrirse, con `aPruebaDeDobleClic` (QA-UPP-13 y 14).**
 *
 * Un doble clic —o dos toques seguidos— en el boton que abre el modal hace dos cosas: el primero lo
 * abre y el segundo cae en lo que haya quedado debajo, que ya es el modal. En escritorio era el
 * fondo, y lo cerraba (QA-UPP-13). En el telefono, con la ficha compacta, «Empezar prueba» queda
 * bajo el pie de «¿Empezar ahora?», y el segundo toque pulsaba «Aún no» —lo cerraba— o
 * «Sí, empezar» —arrancaba el reloj sin haber leido nada— (QA-UPP-14). Que caiga en un sitio u otro
 * depende del alto del aviso y de la pantalla, asi que **la guarda no mira donde cae: vale para
 * todo el modal**, fondo, aspa, cuerpo y pie.
 *
 * Se descarta, por puntero:
 *   - la continuacion de una serie (`detail` > 1): la segunda pulsacion de un doble clic, por
 *     lenta que sea, nunca es una decision tomada con el modal ya leido;
 *   - toda pulsacion que **empiece** en los primeros 500 ms. Cubre el segundo toque que no cuenta
 *     como serie (dos toques sueltos, un raton que no los junta) y el que empezo dentro y se suelta
 *     ya fuera de la ventana.
 *
 * **Por que 500 ms.** Es el tiempo de doble clic de Windows por omision y esta por encima del de
 * macOS, GNOME (400) y el doble toque de Android (300) e iOS: la segunda pulsacion de cualquier
 * doble clic con los ajustes de fabrica empieza antes de 500 ms desde la primera, y el modal se
 * abre despues de la primera (al soltar), asi que cae siempre dentro. Y es menos de lo que tarda
 * una persona en ver un dialogo nuevo, leer sus botones y llevar el dedo a uno (el tiempo de
 * reaccion con eleccion pasa de medio segundo), asi que no se pierde ningun toque deliberado. Mas
 * larga solo haria esperar a quien ya lo ha leido.
 *
 * **El teclado no espera.** Enter o Espacio sobre un boton dan un `click` con `detail` 0 y pasan
 * siempre, y Escape cierra desde el primer instante: con el teclado no hay segundo clic que caiga
 * donde no se apunto.
 *
 * Mientras dura la ventana, ademas, un escudo transparente tapa la pantalla: el puntero da en el y
 * no en los botones, que ni se marcan al pasar. Asi la ventana existe tambien para quien comprueba
 * que lo que va a pulsar esta debajo del puntero antes de pulsar —Playwright espera a que se vaya
 * en vez de pulsar un boton que no responderia—. El escudo se va un poco despues de la ventana, de
 * modo que cuando el puntero vuelve a llegar a los botones la guarda por tiempo ya les deja pasar.
 *
 * No es lo de siempre para no cambiar los modales que ya cierran rapido por el fondo; lo pide el
 * que se abre con un clic sobre algo que puede quedar debajo de su panel.
 */
export const GRACIA_TRAS_ABRIR_MS = 500

/** Lo que el escudo sobrevive a la ventana: ver `GRACIA_TRAS_ABRIR_MS`. */
export const MARGEN_DEL_ESCUDO_MS = 50

interface Props {
  abierto: boolean
  titulo: string
  onCerrar: (como: ComoSeCierra) => void
  children: ReactNode
  /** Los botones del pie. Sin esto se pone uno de «Cerrar». */
  pie?: ReactNode
  /**
   * En el teléfono ocupa la pantalla entera. Para ventanas que se leen largo
   * —las reseñas, con sus filtros— y no para un aviso de dos líneas.
   */
  pantallaCompleta?: boolean
  /**
   * Un panel lateral a la derecha, de arriba abajo, en vez de una ventana en el
   * centro: para lo que se ajusta al lado de lo que se está mirando (la
   * configuración de la prueba). En el teléfono ocupa la pantalla entera.
   */
  lateral?: boolean
  /** Sin pie: el contenido trae sus propios botones (un formulario con su «Listo»). */
  sinPie?: boolean
  /**
   * Nada del modal responde al puntero que sigue al clic que lo abrio, ni al de su primer medio
   * segundo; el teclado, si: ver `GRACIA_TRAS_ABRIR_MS`.
   */
  aPruebaDeDobleClic?: boolean
}

const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

export function Modal({
  abierto,
  titulo,
  onCerrar,
  children,
  pie,
  pantallaCompleta,
  lateral,
  sinPie,
  aPruebaDeDobleClic,
}: Props) {
  const caja = useRef<HTMLElement>(null)

  /*
    ⚠️ **`onCerrar` va por ref, y NO en las dependencias del efecto.**

    Quien usa este modal le pasa casi siempre una funcion declarada dentro de su
    propio componente, asi que es **una funcion distinta en cada render**. Con
    ella en las dependencias, el efecto se limpiaba y se volvia a montar en cada
    render del padre — y el efecto **mueve el foco**: su limpieza lo devuelve a
    donde estaba antes de abrir y su cuerpo lo lleva al primer enfocable del
    modal, que es el aspa de la cabecera.

    El sintoma era escribir una letra en un campo del modal y ver el foco saltar
    al aspa: cada tecla cambia el estado del padre, cada cambio re-renderiza,
    cada render reenfocaba. El campo no dejaba escribir mas de un caracter.

    Con el ref, el efecto corre solo al abrir y al cerrar —que es cuando el foco
    tiene algo que hacer— y `alPulsar` sigue llamando siempre a la version mas
    reciente, que es lo unico que necesitaba de `onCerrar`.
  */
  const alCerrar = useRef(onCerrar)
  alCerrar.current = onCerrar

  /*
    ⚠️ **Adónde vuelve el foco se apunta AL PINTAR la apertura, no en el efecto.**

    Los efectos corren de dentro hacia fuera: los del contenido antes que el de
    este modal. Un formulario que enfoca su primer campo al montarse —el paso de
    reportar lo hace en un `useLayoutEffect`, el de responder en un `useEffect`—
    ya se había llevado el foco cuando el efecto de aquí leía «el que lo tenía
    antes». Guardaba ese campo, y al cerrar devolvía el foco a un control que ya
    no existía: caía en `<body>` y el siguiente Tab empezaba por arriba de la
    página. Al pintar, nada de dentro existe todavía y el foco sigue en el botón
    que abrió el modal.

    Es estado, y no un ref, para que un pintado descartado no deje nada a medias:
    es el patrón de React para ajustar estado cuando cambia una prop.
  */
  const [apertura, setApertura] = useState<{ abierto: boolean; volverA: HTMLElement | null; desde: number }>({
    abierto: false,
    volverA: null,
    desde: 0,
  })
  if (apertura.abierto !== abierto) {
    // `desde` también se apunta al pintar: el segundo clic de un doble clic puede llegar antes que
    // el efecto, y con la hora del efecto el modal no sabría que acaba de abrirse.
    setApertura({ abierto, volverA: abierto ? conElFoco() : null, desde: performance.now() })
  }
  const volverA = apertura.volverA

  /*
    La guarda de `aPruebaDeDobleClic` (QA-UPP-13 y 14), en captura sobre el fondo, el panel y el
    escudo: se decide antes de que el `onClick` de ningún botón de dentro llegue a correr.

    Una pulsación que empieza dentro de la ventana se descarta entera, también su `click`, aunque
    llegue ya fuera: en el teléfono el `click` de un toque sale al levantar el dedo, y un toque que
    empezó sobre el escudo podría soltarse cuando ya se ha ido y caer en «Sí, empezar». La marca se
    pone con `pointerdown` —que también da el dedo— y con `mousedown` solo se añade: el `mousedown`
    de un toque es de compatibilidad, llega al levantar el dedo y no debe borrarla.
  */
  const pulsacionDescartada = useRef(false)
  const escudo = useRef<HTMLDivElement>(null)
  const enLaGracia = () => performance.now() - apertura.desde < GRACIA_TRAS_ABRIR_MS
  const descartar = (e: SyntheticEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }
  const guarda = aPruebaDeDobleClic
    ? {
        onPointerDownCapture: (e: SyntheticEvent) => {
          pulsacionDescartada.current = enLaGracia()
          // Sin `preventDefault`: cancelar el `pointerdown` se come el `mousedown`, y es ese el que
          // hay que cancelar para que el foco no salga del botón que lo tiene.
          if (pulsacionDescartada.current) e.stopPropagation()
        },
        onMouseDownCapture: (e: SyntheticEvent) => {
          if (enLaGracia()) pulsacionDescartada.current = true
          if (pulsacionDescartada.current) descartar(e)
        },
        onPointerUpCapture: (e: SyntheticEvent) => {
          if (pulsacionDescartada.current || enLaGracia()) e.stopPropagation()
        },
        onMouseUpCapture: (e: SyntheticEvent) => {
          if (pulsacionDescartada.current || enLaGracia()) descartar(e)
        },
        onClickCapture: (e: MouseEvent) => {
          const empezoEnLaGracia = pulsacionDescartada.current
          pulsacionDescartada.current = false
          // `detail` 0 es el teclado (Enter o Espacio sobre un botón): pasa siempre, al instante.
          if (e.detail === 0) return
          if (empezoEnLaGracia || e.detail > 1 || enLaGracia()) descartar(e)
        },
      }
    : {}

  useEffect(() => {
    if (!abierto) return

    // El escudo se va un poco después de la ventana: ver `GRACIA_TRAS_ABRIR_MS`. Se oculta a mano y
    // no con estado para no repintar el modal; al cerrar se desmonta y la siguiente vez nace visible.
    const fin = window.setTimeout(() => {
      if (escudo.current) escudo.current.hidden = true
    }, GRACIA_TRAS_ABRIR_MS + MARGEN_DEL_ESCUDO_MS)

    document.body.style.overflow = 'hidden'
    // Si el contenido ya puso el foco dentro —su primer campo—, se respeta: el
    // aspa es solo para cuando nada de dentro lo pidió.
    if (!caja.current?.contains(document.activeElement)) {
      caja.current?.querySelector<HTMLElement>(ENFOCABLES)?.focus()
    }

    function alPulsar(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        alCerrar.current('escape')
        return
      }
      if (e.key !== 'Tab' || !caja.current) return

      // El foco da la vuelta dentro del modal en vez de irse a la pagina.
      const dentro = [...caja.current.querySelectorAll<HTMLElement>(ENFOCABLES)]
      if (dentro.length === 0) return
      const primero = dentro[0]!
      const ultimo = dentro[dentro.length - 1]!
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault()
        primero.focus()
      }
    }

    document.addEventListener('keydown', alPulsar)
    return () => {
      window.clearTimeout(fin)
      document.removeEventListener('keydown', alPulsar)
      document.body.style.overflow = ''
      if (volverA?.isConnected) volverA.focus()
    }
    // `volverA` cambia solo a la vez que `abierto`: el efecto no se rehace aparte.
  }, [abierto])

  if (!abierto) return null

  return (
    <>
      <div className={estilos.fondo} onClick={() => onCerrar('fondo')} {...guarda} />
      <section
        {...guarda}
        className={[estilos.caja, pantallaCompleta && estilos.cajaCompleta, lateral && estilos.cajaLateral]
          .filter(Boolean)
          .join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal"
        ref={caja}
      >
        <div className={estilos.cabecera}>
          <h2 className={estilos.titulo} id="titulo-modal">{titulo}</h2>
          <button className={estilos.cerrar} type="button" onClick={() => onCerrar('aspa')} aria-label="Cerrar">
            ×
          </button>
        </div>
        <div className={estilos.cuerpo}>{children}</div>
        {!sinPie && (
          <div className={estilos.pie}>
            {pie ?? (
              <button
                className={estilos.cerrarPie}
                type="button"
                onClick={() => onCerrar('pie')}
                data-rotulo="Cerrar"
              >
                Cerrar
              </button>
            )}
          </div>
        )}
      </section>
      {/* Después del panel, para que el fondo siga siendo el hermano anterior del diálogo. */}
      {aPruebaDeDobleClic && (
        <div
          ref={escudo}
          className={estilos.escudo}
          aria-hidden="true"
          data-escudo-del-modal=""
          {...guarda}
          // Lo que cae aquí no llega a nada: ni enfoca (el foco no sale del botón que lo tiene), ni
          // pulsa lo de debajo, ni sube a la página.
          onMouseDown={descartar}
          onClick={descartar}
        />
      )}
    </>
  )
}
