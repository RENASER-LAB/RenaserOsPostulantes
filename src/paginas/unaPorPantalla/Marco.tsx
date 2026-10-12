/**
 * El marco de una pregunta por pantalla: la barra fija, el mapa con su leyenda, la tarjeta de
 * la pregunta y el aviso de lo que falta para entregar.
 *
 * Lo usan la prueba técnica del editor y la evaluación del Perfil Integral, con el diseño de la
 * maqueta aprobada el 06/10/2026: el candidato se mueve igual en las dos. Cada pantalla pone lo
 * suyo —su reloj, su forma de responder, el caso de la prueba— dentro de estas piezas.
 *
 * ⚠️ **Nada se mueve aquí dentro** (la regla del reloj de DESIGN.md): ni los botones giran el
 * rótulo, ni la hoja del mapa entra deslizándose. Por eso estos botones no llevan `data-rotulo`
 * ni componen las piezas de `piezas.module.css`, que traen su transición.
 *
 * ⚠️ **El mapa se aparta a propósito de «la regla de la voz única»**: lista rellena de índigo,
 * a medias con media casilla en diagonal, sin responder con borde punteado y la actual anillada
 * en oscuro. Lo decidió el usuario el 07/10/2026, siguiendo la maqueta.
 */

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { FechaIso } from '@/api/tipos'
import { formatearTiempo, segundosHasta } from '@/dominio/reloj'
import { IconoCruz } from '@/ui/Iconos'
import type { DondeEnfocar, EstadoDePaso, Paso } from './useRecorrido'
import estilos from './Marco.module.css'

// ---------- El tiempo ----------

/**
 * Si quedan menos de `umbral` segundos hasta `venceEn`. Mira cada segundo, pero solo vuelve a
 * pintar al cruzar: la pantalla entera no tiene por qué repintarse sesenta veces por minuto.
 */
export function useQuedaMenosDe(venceEn: FechaIso | null | undefined, umbral: number): boolean {
  const mirar = () => {
    const quedan = segundosHasta(venceEn)
    return quedan !== null && quedan < umbral
  }
  const [poco, setPoco] = useState(mirar)
  useEffect(() => {
    const revisar = () => {
      const quedan = segundosHasta(venceEn)
      setPoco(quedan !== null && quedan < umbral)
    }
    revisar()
    if (!venceEn) return
    const reloj = window.setInterval(revisar, 1000)
    return () => window.clearInterval(reloj)
  }, [venceEn, umbral])
  return poco
}

/** «00:42:17», recalculado cada segundo contra la hora del servidor. */
export function CuentaAtras({ venceEn }: { venceEn: FechaIso | null }) {
  const [quedan, setQuedan] = useState(() => segundosHasta(venceEn))
  useEffect(() => {
    setQuedan(segundosHasta(venceEn))
    if (!venceEn) return
    const reloj = window.setInterval(() => setQuedan(segundosHasta(venceEn)), 1000)
    return () => window.clearInterval(reloj)
  }, [venceEn])
  return <>{quedan === null ? '--:--:--' : formatearTiempo(quedan)}</>
}

// ---------- La etiqueta de la pregunta ----------

/**
 * El nombre del tipo, nuevo en el portal (decisión del 07/10/2026): en la prueba del editor y
 * en las preguntas propias de la evaluación. Los formatos del banco del modelo no lo llevan.
 */
const NOMBRE_DEL_TIPO: Record<string, string> = {
  ABIERTA: 'Abierta',
  OPCION_UNICA: 'Opción única',
  OPCION_MULTIPLE: 'Opción múltiple',
  ESCALA: 'Escala',
}

/** «Pregunta 3 · Opción múltiple», o «Pregunta 3» a secas. */
export function etiquetaDePregunta(numero: number, tipo: string): string {
  const nombre = NOMBRE_DEL_TIPO[tipo]
  return nombre ? `Pregunta ${numero} · ${nombre}` : `Pregunta ${numero}`
}

// ---------- Lo que falta ----------

/** «Te faltan 7 por terminar», o «Todo listo para entregar». */
export function textoDeFaltan(faltan: number): string {
  if (faltan <= 0) return 'Todo listo para entregar'
  return faltan === 1 ? 'Te falta 1 por terminar' : `Te faltan ${faltan} por terminar`
}

/** «la 3», «la 3 y la 7», «la 3, la 5 y la 7». */
export function cualesFaltan(numeros: number[]): string {
  const con = numeros.map((n) => `la ${n}`)
  if (con.length <= 1) return con.join('')
  return `${con.slice(0, -1).join(', ')} y ${con[con.length - 1]}`
}

/**
 * Un botón que ignora la segunda pulsación de un doble clic: avanza una sola vez. Si la
 * segunda cae en otra cosa —la pregunta nueva es más alta—, la descarta `useUnaSolaPulsacion`.
 */
function unaVez(hacer: () => void) {
  return (e: React.MouseEvent) => {
    if (e.detail > 1) return
    hacer()
  }
}

// ---------- La barra fija ----------

export interface PropsBarra {
  refBarra: React.RefObject<HTMLDivElement | null>
  /** El reloj, la fecha límite o el plazo: lo pinta cada pantalla. */
  tiempo: ReactNode
  /** Se pone en rojo: queda poco. */
  tiempoPoco?: boolean
  /** «Pregunta 3 de 8», o el nombre del paso. */
  donde: string
  faltan: number
  /** La evaluación conserva su barra «N de M respondidas» (decisión del 07/10/2026). */
  progreso?: { respondidas: number; total: number } | null
  /** El botón del mapa: «Ver las N» u «Ocultar el mapa». */
  mapa: {
    abierto: boolean
    preguntas: number
    alPulsar: () => void
    refBoton: React.RefObject<HTMLButtonElement | null>
    controla: string
  }
  siguienteSinResponder?: (() => void) | null
  volverA?: { rotulo: string; alPulsar: () => void } | null
  /** «Entregar la prueba»: sin él no se pinta (el último paso ya lo lleva relleno). */
  entregar?: { texto: string; alPulsar: () => void; ocupado?: boolean } | null
  /** Lo propio de cada pantalla: «Ver el caso». */
  extra?: ReactNode
}

export function BarraDelMarco(props: PropsBarra) {
  const { refBarra, mapa } = props

  /*
    Lo que mide la barra, para que el mapa y el caso se peguen justo debajo y la hoja del
    móvil no la tape. Se mide en vivo y no se escribe a mano: cambia con el aviso del reloj,
    con «Volver a la N» y al partirse en dos líneas en el teléfono.
  */
  useEffect(() => {
    const barra = refBarra.current
    const marco = barra?.parentElement
    if (!barra || !marco || typeof ResizeObserver === 'undefined') return
    const medir = () => marco.style.setProperty('--alto-barra', `${barra.offsetHeight}px`)
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(barra)
    return () => observador.disconnect()
  }, [refBarra])

  const porcentaje =
    props.progreso && props.progreso.total > 0
      ? (props.progreso.respondidas / props.progreso.total) * 100
      : 0

  return (
    <div className={estilos.barra} ref={refBarra}>
      <div className={estilos.datos}>
        <div className={props.tiempoPoco ? `${estilos.tiempo} ${estilos.poco}` : estilos.tiempo}>
          {props.tiempo}
        </div>
        <span className={estilos.donde}>{props.donde}</span>
        <span className={props.faltan <= 0 ? `${estilos.faltan} ${estilos.listo}` : estilos.faltan}>
          {textoDeFaltan(props.faltan)}
        </span>
      </div>

      {props.progreso && (
        <div className={estilos.progreso}>
          <div className={estilos.riel} aria-hidden="true">
            <div className={estilos.recorrido} style={{ width: `${porcentaje}%` }} />
          </div>
          <span>
            {props.progreso.respondidas} de {props.progreso.total} respondidas
          </span>
        </div>
      )}

      <div className={estilos.mandos}>
        <button
          type="button"
          className={estilos.mando}
          ref={mapa.refBoton}
          aria-expanded={mapa.abierto}
          aria-controls={mapa.controla}
          onClick={mapa.alPulsar}
        >
          {mapa.abierto ? 'Ocultar el mapa' : `Ver las ${mapa.preguntas}`}
        </button>
        {props.siguienteSinResponder && (
          <button type="button" className={estilos.mando} onClick={unaVez(props.siguienteSinResponder)}>
            Siguiente sin responder
          </button>
        )}
        {props.volverA && (
          <button type="button" className={estilos.mando} onClick={unaVez(props.volverA.alPulsar)}>
            {props.volverA.rotulo}
          </button>
        )}
        {props.extra}
        {props.entregar && (
          <button
            type="button"
            className={`${estilos.mando} ${estilos.mandoEntregar}`}
            onClick={props.entregar.alPulsar}
            disabled={props.entregar.ocupado}
          >
            {props.entregar.ocupado ? 'Guardando…' : props.entregar.texto}
          </button>
        )}
      </div>
    </div>
  )
}

/** «Volver a la 6», o «Volver a los entregables». */
export function rotuloDeVolver(paso: Paso): string {
  return paso.clave === 'entregables' ? 'Volver a los entregables' : `Volver a la ${paso.rotulo}`
}

// ---------- El mapa ----------

const COMO_SE_DICE: Record<EstadoDePaso, string> = {
  lista: 'lista',
  'a-medias': 'a medias',
  vacia: 'sin responder',
}

const CLASE: Record<EstadoDePaso, string> = {
  lista: 'lista',
  'a-medias': 'aMedias',
  vacia: 'vacia',
}

/** Lo que dice de una casilla un lector de pantalla: «Pregunta 4, a medias, falta su archivo (estás aquí)». */
export function nombreDeCasilla(paso: Paso, actual: boolean): string {
  return (
    `${paso.nombre}, ${paso.estadoDicho ?? COMO_SE_DICE[paso.estado]}` +
    (paso.matiz ? `, ${paso.matiz}` : '') +
    (actual ? ' (estás aquí)' : '')
  )
}

function Casillas({
  pasos,
  indice,
  alElegir,
  grandes = false,
}: {
  pasos: Paso[]
  indice: number
  alElegir: (i: number) => void
  grandes?: boolean
}) {
  return (
    <ol className={grandes ? `${estilos.rejilla} ${estilos.rejillaGrande}` : estilos.rejilla} role="list">
      {pasos.map((paso, i) => (
        <li key={paso.clave} className={paso.clave === 'entregables' ? estilos.todoElAncho : undefined}>
          <button
            type="button"
            className={`${estilos.casilla} ${estilos[CLASE[paso.estado]]}${
              i === indice ? ` ${estilos.aqui}` : ''
            }${paso.clave === 'entregables' ? ` ${estilos.casillaAncha}` : ''}`}
            aria-current={i === indice ? 'step' : undefined}
            aria-label={nombreDeCasilla(paso, i === indice)}
            onClick={unaVez(() => alElegir(i))}
          >
            {paso.rotulo}
          </button>
        </li>
      ))}
    </ol>
  )
}

function Leyenda() {
  return (
    <ul className={estilos.leyenda} role="list" aria-label="Qué dice cada casilla">
      <li className={estilos.entradaLeyenda}>
        <i className={`${estilos.muestra} ${estilos.lista}`} aria-hidden="true" />
        Lista
      </li>
      <li className={estilos.entradaLeyenda}>
        <i className={`${estilos.muestra} ${estilos.aMedias}`} aria-hidden="true" />
        A medias
      </li>
      <li className={estilos.entradaLeyenda}>
        <i className={`${estilos.muestra} ${estilos.vacia}`} aria-hidden="true" />
        Sin responder
      </li>
    </ul>
  )
}

/** El mapa en escritorio: una columna a la izquierda, a la vista al entrar. */
export function MapaDePreguntas({
  id,
  titulo,
  pasos,
  indice,
  alElegir,
}: {
  id: string
  titulo: string
  pasos: Paso[]
  indice: number
  alElegir: (i: number) => void
}) {
  return (
    <nav className={estilos.mapa} id={id} aria-labelledby={`${id}-titulo`}>
      <h2 className={estilos.tituloMapa} id={`${id}-titulo`}>
        {titulo}
      </h2>
      <Casillas pasos={pasos} indice={indice} alElegir={alElegir} />
      <Leyenda />
    </nav>
  )
}

/**
 * El mapa en el teléfono: una hoja desde abajo, con casillas grandes.
 *
 * Sale **sin animación** —dentro de la prueba nada se mueve— y por debajo de la barra fija: la
 * hoja se desplaza por dentro y nunca tapa el reloj ni lo que falta. Elegir una casilla la
 * cierra y lleva a esa pregunta; Escape, el aspa y «Ocultar el mapa» la cierran y devuelven el
 * foco al botón.
 *
 * ⚠️ **Dónde empieza se mide con la barra ya pintada, y la sigue** (QA-UPP-02). Al abrirse, el
 * botón pasa de «Ver las N» a «Ocultar el mapa», que es más ancho: a 360 px empuja «Siguiente
 * sin responder» a otra fila y la barra crece. Medida antes, en el clic, la hoja tapaba esa
 * fila. Por eso se mide después de pintar y antes de enseñarse, y se vuelve a medir si la barra
 * cambia de alto o se mueve con el desplazamiento.
 */
export function HojaDelMapa({
  id,
  titulo,
  pasos,
  indice,
  faltan,
  refBarra,
  alElegir,
  alCerrar,
}: {
  id: string
  titulo: string
  pasos: Paso[]
  indice: number
  faltan: number
  /** La barra fija: la hoja empieza justo donde acaba. */
  refBarra: React.RefObject<HTMLDivElement | null>
  alElegir: (i: number) => void
  alCerrar: () => void
}) {
  const hoja = useRef<HTMLDivElement>(null)
  const alCerrarRef = useRef(alCerrar)
  alCerrarRef.current = alCerrar
  const [arriba, setArriba] = useState(0)

  useLayoutEffect(() => {
    const barra = refBarra.current
    if (!barra) return
    const medir = () => setArriba(Math.max(0, barra.getBoundingClientRect().bottom))
    medir()
    const observador = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(medir)
    observador?.observe(barra)
    window.addEventListener('resize', medir)
    window.addEventListener('scroll', medir, { passive: true })
    return () => {
      observador?.disconnect()
      window.removeEventListener('resize', medir)
      window.removeEventListener('scroll', medir)
    }
  }, [refBarra])

  useEffect(() => {
    hoja.current?.querySelector<HTMLElement>('button')?.focus()
    function alPulsar(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        alCerrarRef.current()
        return
      }
      // El foco no se escapa de la hoja mientras está abierta.
      if (e.key !== 'Tab' || !hoja.current) return
      const botones = [...hoja.current.querySelectorAll<HTMLElement>('button')]
      const primero = botones[0]
      const ultimo = botones[botones.length - 1]
      if (!primero || !ultimo) return
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault()
        primero.focus()
      }
    }
    document.addEventListener('keydown', alPulsar)
    return () => document.removeEventListener('keydown', alPulsar)
  }, [])

  return (
    <div
      className={estilos.velo}
      style={{ top: `${arriba}px` }}
      onClick={(e) => {
        if (e.target === e.currentTarget) alCerrar()
      }}
    >
      <div
        className={estilos.hoja}
        ref={hoja}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-titulo`}
      >
        <div className={estilos.cabezaHoja}>
          <h2 className={estilos.tituloMapa} id={`${id}-titulo`}>
            {titulo}
          </h2>
          <button type="button" className={estilos.cerrarHoja} onClick={alCerrar} aria-label="Cerrar el mapa">
            <IconoCruz tamano={20} />
          </button>
        </div>
        <p className={estilos.faltanHoja}>{textoDeFaltan(faltan)}.</p>
        <Casillas pasos={pasos} indice={indice} alElegir={alElegir} grandes />
        <Leyenda />
      </div>
    </div>
  )
}

// ---------- La tarjeta de la pregunta ----------

export interface Guardado {
  texto: string
  /** `duda`: le falta algo al candidato (ámbar). `fallo`: no llegó al servidor. */
  tono: 'neutro' | 'duda' | 'fallo'
}

export function TarjetaDePregunta({
  refTarjeta,
  refEnunciado,
  idEnunciado,
  etiqueta,
  guardado,
  antes,
  enunciado,
  children,
  anterior,
  siguiente,
}: {
  refTarjeta: React.RefObject<HTMLElement | null>
  refEnunciado: React.RefObject<HTMLHeadingElement | null>
  idEnunciado: string
  /** «Pregunta 3 · Opción múltiple». */
  etiqueta: string
  guardado?: Guardado | null
  /** Lo que va antes del enunciado: la situación de un ítem del banco. */
  antes?: ReactNode
  enunciado: ReactNode
  children: ReactNode
  /** Sin «Anterior» en el primer paso: se desactiva. */
  anterior: { alPulsar: () => void; desactivado: boolean }
  /**
   * «Siguiente», «Siguiente: entregables» o «Entregar la prueba», relleno. Nulo cuando no hay
   * a dónde ir: el último paso con el tiempo agotado.
   */
  siguiente?: { texto: string; alPulsar: () => void; ocupado?: boolean; desactivado?: boolean } | null
}) {
  return (
    <article className={estilos.tarjeta} ref={refTarjeta}>
      <div className={estilos.cabeza}>
        <span className={estilos.etiqueta}>{etiqueta}</span>
        {guardado && (
          <span
            className={`${estilos.guardado}${
              guardado.tono === 'duda' ? ` ${estilos.duda}` : guardado.tono === 'fallo' ? ` ${estilos.fallo}` : ''
            }`}
          >
            {guardado.texto}
          </span>
        )}
      </div>
      {antes}
      <h1 className={estilos.enunciado} id={idEnunciado} ref={refEnunciado} tabIndex={-1}>
        {enunciado}
      </h1>
      <div className={estilos.respuesta}>{children}</div>
      <div className={estilos.pie}>
        <button
          type="button"
          className={estilos.anterior}
          onClick={unaVez(anterior.alPulsar)}
          disabled={anterior.desactivado}
        >
          Anterior
        </button>
        {siguiente && (
          <button
            type="button"
            className={estilos.siguiente}
            onClick={unaVez(siguiente.alPulsar)}
            disabled={siguiente.ocupado || siguiente.desactivado}
          >
            {siguiente.ocupado ? 'Guardando…' : siguiente.texto}
          </button>
        )}
      </div>
    </article>
  )
}

// ---------- Lo que falta para entregar ----------

/**
 * Lo que falta para poder entregar, en vez del diálogo de confirmación: cuántas preguntas y
 * cuáles, los archivos obligatorios, y un botón que lleva a lo primero que falta —una pregunta,
 * el archivo de una pregunta o los entregables— moviendo el navegador de preguntas, no la
 * página. Es lo mismo que rechaza el servidor. Igual en la prueba y en la evaluación (decisión
 * del 07/10/2026); la evaluación solo tiene preguntas.
 */
export function LoQueFaltaParaEntregar({
  preguntas,
  sinNombrar = 0,
  archivos = [],
  entregables = [],
  hayEntregables = false,
  alIr,
  alIrAlEntregable = () => undefined,
}: {
  preguntas: { id: number; numero: number }[]
  /** Las que faltan y no llegaron a cargarse: se cuentan, pero no se pueden nombrar. */
  sinNombrar?: number
  /** Los archivos obligatorios de una pregunta que faltan, con el número de su pregunta. */
  archivos?: { id: number; nombre: string; numero: number }[]
  /** Los entregables generales obligatorios que faltan, por su nombre. */
  entregables?: string[]
  hayEntregables?: boolean
  alIr: (preguntaId: number) => void
  alIrAlEntregable?: (entregableId: number | null) => void
}) {
  const cuantas = preguntas.length + sinNombrar
  if (cuantas === 0 && entregables.length === 0 && archivos.length === 0) return null
  const subir = [
    ...archivos.map((a) => `«${a.nombre}» (pregunta ${a.numero})`),
    ...entregables.map((e) => `«${e}»`),
  ]
  // Lo primero que falta, en el orden de la prueba: las preguntas y sus archivos, y luego
  // los entregables del final.
  const primeraPregunta = preguntas[0]
  const primerArchivo = [...archivos].sort((x, y) => x.numero - y.numero)[0]
  const irAlArchivo =
    primerArchivo !== undefined && (!primeraPregunta || primerArchivo.numero < primeraPregunta.numero)
  return (
    <div className={estilos.loQueFalta} role="alert">
      <span>
        {cuantas > 0 && (
          <>
            <b>
              Para entregar te falta responder{' '}
              {cuantas === 1 ? '1 pregunta' : `${cuantas} preguntas`}
              {preguntas.length > 0 ? ` (${cualesFaltan(preguntas.map((p) => p.numero))})` : ''}.
            </b>{' '}
          </>
        )}
        {subir.length > 0
          ? `Te falta subir ${subir.join(', ')}.`
          : hayEntregables
            ? 'Los entregables obligatorios están completos.'
            : ''}
      </span>
      {irAlArchivo ? (
        <button type="button" className={estilos.irA} onClick={() => alIrAlEntregable(primerArchivo.id)}>
          Ir a la pregunta {primerArchivo.numero}
        </button>
      ) : primeraPregunta ? (
        <button type="button" className={estilos.irA} onClick={() => alIr(primeraPregunta.id)}>
          Ir a la pregunta {primeraPregunta.numero}
        </button>
      ) : (
        entregables.length > 0 && (
          <button type="button" className={estilos.irA} onClick={() => alIrAlEntregable(null)}>
            Ir a los entregables
          </button>
        )
      )}
    </div>
  )
}

/** Lo primero que se puede rellenar dentro de la tarjeta: a donde lleva «Ir a la pregunta N». */
export function primerCampo(tarjeta: React.RefObject<HTMLElement | null>): DondeEnfocar {
  return () =>
    tarjeta.current?.querySelector<HTMLElement>(
      'textarea, input:not([type="hidden"]):not([type="file"]):not([tabindex="-1"]), select, button:not([disabled])',
    ) ?? null
}
