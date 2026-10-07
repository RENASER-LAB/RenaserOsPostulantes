/**
 * Las piezas de las reseñas de empresas (V63) que comparten el perfil del
 * portal y la ficha del panel: las estrellas, el selector, el resumen con su
 * reparto, la reseña con su respuesta, el campo con su cuenta, el paso de
 * reportar, la pregunta de descartar un borrador y la ventana «Ver todas» con
 * sus filtros.
 *
 * ⚠️ **Las estrellas van en tinta, nunca en el índigo de acción.** El índigo es
 * lo que se pulsa y lo que te toca (DESIGN.md, «La regla de la voz única»), y
 * en el panel el violeta `--activo` significa «te toca a ti». Una estrella no
 * es ninguna de las dos cosas.
 *
 * ⚠️ **Una reseña es una fila, no una caja.** Viven dentro de una sección que ya
 * es tarjeta, y tarjetas dentro de tarjetas es lo que convierte una pantalla en
 * un acordeón. La respuesta baja un escalón —`nube-hundida`— y se sangra.
 */

import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { formatearFechaCorta } from '@/dominio/reloj'
import { Modal, type ComoSeCierra } from '@/ui/Modal'
import { IconoEstrella, IconoEstrellaMedia, IconoEstrellaVacia } from '@/ui/Iconos'
import {
  caracteresDe,
  contarPorEstrellas,
  cuantasResenas,
  empresasDe,
  estrellasDichas,
  estrellasPartidas,
  faltaEnElReporte,
  filtrarYOrdenar,
  hayFiltros,
  MAX_COMENTARIO,
  motivosDelReporte,
  ORDENES,
  promedioEscrito,
  ROTULOS_DE_ESTRELLAS,
  SIN_FILTROS,
  type FiltrosDeResenas,
  type MotivoDeReporte,
  type OrdenDeResenas,
  type ResenaParaPintar,
  type ResumenParaPintar,
} from './modelo'
import { useAvisoDeBorrador } from './ganchos'
import estilos from './Resenas.module.css'

// ---------- Las estrellas ----------

/**
 * Cinco estrellas dibujadas, con medias, y una sola frase para el lector de
 * pantalla: «4,5 de 5 estrellas». Las cinco figuras sueltas no se anuncian.
 */
export function Estrellas({ valor, tamano = 16 }: { valor: number; tamano?: number }) {
  return (
    <span className={estilos.estrellas} role="img" aria-label={estrellasDichas(valor)}>
      {estrellasPartidas(valor).map((parte, i) =>
        parte === 'llena' ? (
          <IconoEstrella key={i} tamano={tamano} />
        ) : parte === 'media' ? (
          <IconoEstrellaMedia key={i} tamano={tamano} />
        ) : (
          <IconoEstrellaVacia key={i} tamano={tamano} className={estilos.vacia} />
        ),
      )}
    </span>
  )
}

/**
 * Elegir de 1 a 5 estrellas: un grupo de opciones de verdad.
 *
 * Son cinco `radio` nativos, escondidos a la vista pero no al teclado: las
 * flechas los recorren sin una línea de JavaScript, y cada uno se anuncia con
 * su rótulo —«4 estrellas, Buena»—. El rótulo de la elegida va además al lado,
 * a la vista, y cambia con ella.
 */
export function SelectorDeEstrellas({
  valor,
  alCambiar,
  error,
  deshabilitado,
}: {
  valor: number | null
  alCambiar: (n: number) => void
  error?: string | null
  deshabilitado?: boolean
}) {
  const nombre = useId()
  const idError = `${nombre}-error`
  // Lo que se señala con el ratón se previsualiza; al salir vuelve lo elegido.
  const [encima, setEncima] = useState<number | null>(null)
  const pintado = encima ?? valor ?? 0

  return (
    <fieldset
      className={estilos.selector}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? idError : undefined}
      disabled={deshabilitado}
    >
      <legend className={estilos.leyenda}>Calificación</legend>
      <div className={estilos.opciones} onMouseLeave={() => setEncima(null)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className={estilos.opcion} onMouseEnter={() => setEncima(n)}>
            <input
              className="solo-lectores"
              type="radio"
              name={nombre}
              value={n}
              checked={valor === n}
              onChange={() => alCambiar(n)}
            />
            {pintado >= n ? (
              <IconoEstrella tamano={28} />
            ) : (
              <IconoEstrellaVacia tamano={28} className={estilos.vacia} />
            )}
            <span className="solo-lectores">
              {n} {n === 1 ? 'estrella' : 'estrellas'}, {ROTULOS_DE_ESTRELLAS[n]}
            </span>
          </label>
        ))}
        <span className={estilos.rotuloElegido} aria-hidden="true">
          {pintado > 0 ? ROTULOS_DE_ESTRELLAS[pintado] : 'Sin elegir'}
        </span>
      </div>
      {error && (
        <p className={estilos.error} id={idError}>
          {error}
        </p>
      )}
    </fieldset>
  )
}

// ---------- El resumen ----------

/**
 * El promedio en grande con sus estrellas y cuántas son, y a su lado las cinco
 * barras del reparto. En el teléfono se apila: el promedio arriba.
 *
 * Con `alElegirEstrellas` las barras se pulsan y filtran —así en la ventana
 * «Ver todas»—; sin él son solo lectura.
 */
export function ResumenDeResenas({
  resumen,
  alElegirEstrellas,
}: {
  resumen: ResumenParaPintar
  alElegirEstrellas?: (estrellas: number) => void
}) {
  if (resumen.promedio === null || resumen.cantidad === 0) return null
  const mayor = Math.max(1, ...resumen.reparto.map((b) => b.cantidad))

  return (
    <div className={estilos.resumen}>
      <div className={estilos.promedio}>
        <span className={estilos.cifraPromedio}>{promedioEscrito(resumen.promedio)}</span>
        <Estrellas valor={resumen.promedio} tamano={20} />
        <span className={estilos.cuantas}>{cuantasResenas(resumen.cantidad)}</span>
      </div>
      <ul className={estilos.reparto} role="list" aria-label="Reparto por estrellas">
        {resumen.reparto.map((barra) => {
          const contenido = (
            <>
              <span className={estilos.etiquetaBarra}>
                {barra.estrellas}
                <IconoEstrella tamano={12} />
              </span>
              <span className={estilos.pista} aria-hidden="true">
                <span
                  className={estilos.relleno}
                  style={{ width: `${(barra.cantidad / mayor) * 100}%` }}
                />
              </span>
              <span className={estilos.numeroBarra}>{barra.cantidad}</span>
            </>
          )
          return (
            <li key={barra.estrellas}>
              {alElegirEstrellas ? (
                <button
                  type="button"
                  className={estilos.barra}
                  disabled={barra.cantidad === 0}
                  onClick={() => alElegirEstrellas(barra.estrellas)}
                  aria-label={`Ver solo las de ${barra.estrellas} ${
                    barra.estrellas === 1 ? 'estrella' : 'estrellas'
                  } (${barra.cantidad})`}
                >
                  {contenido}
                </button>
              ) : (
                <span
                  className={estilos.barra}
                  role="img"
                  aria-label={`${barra.estrellas} ${
                    barra.estrellas === 1 ? 'estrella' : 'estrellas'
                  }: ${cuantasResenas(barra.cantidad)}`}
                >
                  {contenido}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ---------- La reseña y su respuesta ----------

/**
 * Un texto cortado a unas líneas con «Leer más», o entero.
 *
 * El botón sale solo si de verdad hay algo cortado —se mide, no se adivina por
 * el número de caracteres—: un «Leer más» que no despliega nada es un botón que
 * miente.
 */
function TextoRecortado({ texto, lineas }: { texto: string; lineas: number | null }) {
  const caja = useRef<HTMLParagraphElement>(null)
  const [abierto, setAbierto] = useState(false)
  const [cortado, setCortado] = useState(false)

  useLayoutEffect(() => {
    const p = caja.current
    if (!p || lineas === null) return
    const medir = () => setCortado(p.scrollHeight > p.clientHeight + 1)
    medir()
    window.addEventListener('resize', medir)
    return () => {
      window.removeEventListener('resize', medir)
    }
  }, [texto, lineas])

  if (lineas === null) {
    return <p className={estilos.texto}>{texto}</p>
  }
  return (
    <>
      <p
        ref={caja}
        className={abierto ? estilos.texto : estilos.textoRecortado}
        style={abierto ? undefined : { WebkitLineClamp: lineas }}
      >
        {texto}
      </p>
      {(cortado || abierto) && (
        <button
          type="button"
          className={estilos.enlaceDiscreto}
          aria-expanded={abierto}
          onClick={() => setAbierto((a) => !a)}
        >
          {abierto ? 'Leer menos' : 'Leer más'}
        </button>
      )}
    </>
  )
}

/**
 * Una reseña: sus estrellas, la empresa, el puesto, la fecha, el texto, y
 * debajo lo que cada cara le cuelgue —la respuesta, las acciones—.
 *
 * @param completa en la ventana «Ver todas» el texto va entero; en la sección y
 *                 en la ficha, cortado a cuatro líneas
 */
export function TarjetaDeResena({
  resena,
  completa = false,
  marca,
  respuesta,
  acciones,
}: {
  resena: ResenaParaPintar
  completa?: boolean
  /** Algo que decir junto a la fecha: «Reportada · en revisión». */
  marca?: ReactNode
  respuesta?: ReactNode
  acciones?: ReactNode
}) {
  return (
    <article className={estilos.resena} aria-label={`Reseña de ${resena.empresa}`}>
      <div className={estilos.cabezaResena}>
        <Estrellas valor={resena.estrellas} />
        <span className={estilos.empresa}>{resena.empresa}</span>
      </div>
      {resena.puesto && <p className={estilos.puesto}>Contratado como {resena.puesto}</p>}
      <p className={estilos.fecha}>
        {formatearFechaCorta(resena.publicadaEn)}
        {resena.editada && ' · Editada'}
        {marca && <span className={estilos.marca}>{marca}</span>}
      </p>
      <TextoRecortado texto={resena.texto} lineas={completa ? null : 4} />
      {respuesta}
      {acciones && <div className={estilos.acciones}>{acciones}</div>}
    </article>
  )
}

/**
 * La respuesta de la persona, sangrada debajo de su reseña.
 *
 * En el perfil se titula «Tu respuesta»; en el panel, «Respuesta de [nombre]».
 * Ocultada por la plataforma se ve atenuada con la nota —solo la ven su autora
 * y la empresa que la reportó—.
 */
export function BloqueDeRespuesta({
  titulo,
  texto,
  publicadaEn,
  editada,
  completa = false,
  ocultadaNota,
  detalle,
  acciones,
}: {
  titulo: string
  texto: string
  publicadaEn: string
  editada: boolean
  completa?: boolean
  /** La nota de la plataforma, si la ocultó: «La plataforma la ocultó: …». */
  ocultadaNota?: string | null
  /** Una línea de estado: «Puedes cambiarla hasta el…», «Reportada · en revisión». */
  detalle?: ReactNode
  acciones?: ReactNode
}) {
  return (
    <div className={ocultadaNota ? `${estilos.respuesta} ${estilos.atenuada}` : estilos.respuesta}>
      <p className={estilos.tituloRespuesta}>
        <b>{titulo}</b> · {formatearFechaCorta(publicadaEn)}
        {editada && ' · Editada'}
      </p>
      <TextoRecortado texto={texto} lineas={completa ? null : 3} />
      {ocultadaNota && <p className={estilos.nota}>{ocultadaNota}</p>}
      {detalle && <p className={estilos.detalle}>{detalle}</p>}
      {acciones && <div className={estilos.acciones}>{acciones}</div>}
    </div>
  )
}

// ---------- El campo con su cuenta ----------

/**
 * Un texto largo con la cuenta siempre a la vista: «0/1000 · mínimo 30».
 *
 * La cuenta no se esconde hasta el 80 % como en el resto de formularios: aquí
 * hay un MÍNIMO, y quien escribe «Muy bien» tiene que ver desde el principio
 * que no alcanza. No se corta al llegar al tope —un pegado largo se truncaría
 * sin avisar—: se dice que se pasó y no se envía.
 */
export function CampoContado({
  etiqueta,
  valor,
  alCambiar,
  minimo,
  maximo,
  error,
  filas = 5,
  deshabilitado,
  ayuda,
  referencia,
}: {
  etiqueta: string
  valor: string
  alCambiar: (v: string) => void
  minimo?: number
  maximo: number
  error?: string | null
  filas?: number
  deshabilitado?: boolean
  ayuda?: string
  referencia?: React.Ref<HTMLTextAreaElement>
}) {
  const id = useId()
  const escritos = caracteresDe(valor)
  const pasado = escritos > maximo
  return (
    <div className={estilos.campo}>
      <label className={estilos.etiqueta} htmlFor={id}>
        {etiqueta}
      </label>
      {ayuda && <span className={estilos.ayuda}>{ayuda}</span>}
      <textarea
        id={id}
        ref={referencia}
        className={estilos.area}
        rows={filas}
        value={valor}
        disabled={deshabilitado}
        onChange={(e) => alCambiar(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-cuenta${error ? ` ${id}-error` : ''}`}
      />
      <span id={`${id}-cuenta`} className={pasado ? `${estilos.cuenta} ${estilos.pasado}` : estilos.cuenta}>
        {escritos}/{maximo}
        {minimo !== undefined && ` · mínimo ${minimo}`}
      </span>
      {error && (
        <p className={estilos.error} id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  )
}

// ---------- Reportar ----------

/**
 * El paso «Reportar» de la ventana: la reseña (o la respuesta) de contexto, el
 * motivo, «Cuéntanos más» y el aviso de que sigue visible mientras se revisa.
 *
 * Es un `<form>` con id: sus botones van en el pie de la ventana, fuera de él, y
 * se atan con `form=`.
 *
 * Hay borrador cuando «Cuéntanos más» tiene algo más que espacios. Elegir solo
 * un motivo no cuenta: rehacerlo es un clic.
 */
export function FormularioDeReporte({
  id,
  quien,
  contexto,
  aviso,
  enviando,
  fallo,
  alEnviar,
  alCambiarBorrador,
}: {
  id: string
  quien: 'persona' | 'empresa'
  contexto: ReactNode
  aviso: string
  enviando: boolean
  fallo?: string | null
  alEnviar: (motivo: MotivoDeReporte, comentario: string | null) => void
  /** Si hay texto sin enviar: la ventana pregunta antes de cerrar (`useBorradorDeLaVentana`). */
  alCambiarBorrador?: (hay: boolean) => void
}) {
  const [motivo, setMotivo] = useState<MotivoDeReporte | null>(null)
  const [comentario, setComentario] = useState('')
  const [error, setError] = useState<string | null>(null)
  const primero = useRef<HTMLInputElement>(null)
  const nombre = useId()
  const notarBorrador = useAvisoDeBorrador(alCambiarBorrador)

  // Al entrar en el paso, el foco va al primer motivo: sin esto se quedaría en
  // el botón que abrió el paso, que ya no está en la pantalla.
  useLayoutEffect(() => {
    primero.current?.focus()
  }, [])

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    const falta = faltaEnElReporte(motivo, comentario)
    setError(falta)
    if (falta || motivo === null) return
    alEnviar(motivo, comentario.trim() === '' ? null : comentario.trim())
  }

  return (
    <form id={id} className={estilos.paso} onSubmit={enviar} noValidate>
      <div className={estilos.contexto}>{contexto}</div>
      <fieldset className={estilos.motivos} disabled={enviando}>
        <legend className={estilos.leyenda}>¿Qué problema tiene?</legend>
        {motivosDelReporte(quien).map((m, i) => (
          <label key={m.codigo} className={estilos.motivo}>
            <input
              ref={i === 0 ? primero : undefined}
              type="radio"
              name={nombre}
              value={m.codigo}
              checked={motivo === m.codigo}
              onChange={() => setMotivo(m.codigo)}
            />
            {m.nombre}
          </label>
        ))}
      </fieldset>
      <CampoContado
        etiqueta={motivo === 'OTRO' ? 'Cuéntanos más (obligatorio)' : 'Cuéntanos más · opcional'}
        valor={comentario}
        alCambiar={(nuevo) => {
          setComentario(nuevo)
          notarBorrador(nuevo.trim() !== '')
        }}
        maximo={MAX_COMENTARIO}
        filas={3}
        deshabilitado={enviando}
      />
      {error && (
        <p className={estilos.error} role="alert">
          {error}
        </p>
      )}
      <p className={estilos.aviso}>{aviso}</p>
      {fallo && (
        <p className={estilos.fallo} role="alert">
          {fallo}
        </p>
      )}
    </form>
  )
}

// ---------- Descartar un borrador ----------

/**
 * «¿Descartar lo que escribiste?»: el pie de la ventana mientras se pregunta.
 *
 * Sustituye a los botones del paso y no abre otra ventana —el `Modal` no admite
 * dos—, como las confirmaciones en línea de «Borrar». Al salir, el foco va a
 * «Seguir escribiendo»: la salida que no pierde nada. El grupo se nombra con la
 * pregunta, y es lo que anuncia el lector de pantalla al entrar el foco.
 */
export function PreguntaDeDescartar({
  alSeguir,
  alDescartar,
}: {
  alSeguir: () => void
  alDescartar: () => void
}) {
  const id = useId()
  const seguir = useRef<HTMLButtonElement>(null)

  useLayoutEffect(() => {
    seguir.current?.focus()
  }, [])

  return (
    <div className={estilos.preguntaDescartar} role="group" aria-labelledby={id}>
      <p id={id} className={estilos.textoDescartar}>
        ¿Descartar lo que escribiste? No se guardará.
      </p>
      <div className={estilos.botonesDescartar}>
        <button ref={seguir} type="button" className={estilos.botonSecundario} onClick={alSeguir}>
          Seguir escribiendo
        </button>
        <button type="button" className={estilos.descartar} onClick={alDescartar}>
          Descartar
        </button>
      </div>
    </div>
  )
}

// ---------- La ventana «Ver todas» ----------

/** Un paso dentro de la ventana: reportar, responder. Nunca dos ventanas a la vez. */
export interface PasoDeLaVentana {
  titulo: string
  cuerpo: ReactNode
  pie: ReactNode
}

/**
 * La ventana «Ver todas»: el resumen, los filtros y todas las reseñas con el
 * texto entero.
 *
 * ⚠️ **Los pasos «Reportar» y «Responder» van DENTRO de esta misma ventana**, y
 * no en otra: el `Modal` lleva un `id` fijo en su título y no admite dos
 * abiertos. Con `paso` la ventana cambia de contenido; los filtros viven aquí y
 * sobreviven a la ida y la vuelta.
 *
 * ⚠️ **Al cambiar de paso el `Modal` no se vuelve a montar**, así que no mueve
 * el foco: el botón pulsado desaparece y el foco caería en `<body>`. Lo lleva
 * quien abre los pasos (el perfil), a la fila `[data-resena]` o a su botón.
 */
export function VentanaDeResenas<T extends ResenaParaPintar>({
  abierto,
  onCerrar,
  resumen,
  resenas,
  pintar,
  paso,
}: {
  abierto: boolean
  /** Por dónde se pidió: quien abre los pasos lo necesita para preguntar si hay borrador. */
  onCerrar: (como: ComoSeCierra) => void
  resumen: ResumenParaPintar
  resenas: T[]
  /** La tarjeta entera, con lo que cada cara le cuelgue. */
  pintar: (resena: T) => ReactNode
  paso?: PasoDeLaVentana | null
}) {
  const [filtros, setFiltros] = useState<FiltrosDeResenas>(SIN_FILTROS)
  const visibles = filtrarYOrdenar(resenas, filtros)
  const porEstrellas = contarPorEstrellas(resenas)
  const empresas = empresasDe(resenas)
  const idEmpresa = useId()
  const idOrden = useId()

  const quitarFiltros = () => setFiltros((f) => ({ ...SIN_FILTROS, orden: f.orden }))
  const alternarEstrella = (n: number) =>
    setFiltros((f) => {
      const ahora = new Set(f.estrellas)
      if (ahora.has(n)) ahora.delete(n)
      else ahora.add(n)
      return { ...f, estrellas: ahora }
    })

  if (paso) {
    return (
      <Modal abierto={abierto} titulo={paso.titulo} onCerrar={onCerrar} pie={paso.pie} pantallaCompleta>
        {paso.cuerpo}
      </Modal>
    )
  }

  return (
    <Modal
      abierto={abierto}
      titulo="Reseñas de empresas"
      onCerrar={onCerrar}
      pantallaCompleta
      pie={
        <div className={estilos.pieVentana}>
          <span role="status">
            Se ven {visibles.length} de {resenas.length}
          </span>
          {hayFiltros(filtros) && (
            <button type="button" className={estilos.botonSecundario} onClick={quitarFiltros}>
              Quitar filtros
            </button>
          )}
        </div>
      }
    >
      <ResumenDeResenas
        resumen={resumen}
        alElegirEstrellas={(n) => setFiltros((f) => ({ ...f, estrellas: new Set([n]) }))}
      />

      <div className={estilos.filtros}>
        <div className={estilos.grupoChips} role="group" aria-label="Estrellas">
          <span className={estilos.etiquetaFiltro} aria-hidden="true">
            Estrellas
          </span>
          <div className={estilos.chips}>
            <button
              type="button"
              className={estilos.chip}
              aria-pressed={filtros.estrellas.size === 0}
              onClick={() => setFiltros((f) => ({ ...f, estrellas: new Set() }))}
            >
              Todas
            </button>
            {[5, 4, 3, 2, 1].map((n) => (
              <button
                key={n}
                type="button"
                className={estilos.chip}
                aria-pressed={filtros.estrellas.has(n)}
                disabled={porEstrellas[n] === 0}
                onClick={() => alternarEstrella(n)}
                aria-label={`${n} ${n === 1 ? 'estrella' : 'estrellas'} (${porEstrellas[n]})`}
              >
                {n}
                <IconoEstrella tamano={12} />
                <span className={estilos.cuentaChip}>{porEstrellas[n]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={estilos.desplegables}>
          {empresas.length >= 2 && (
            <label className={estilos.desplegable} htmlFor={idEmpresa}>
              <span className={estilos.etiquetaFiltro}>Empresa</span>
              <select
                id={idEmpresa}
                value={filtros.empresa ?? ''}
                onChange={(e) =>
                  setFiltros((f) => ({ ...f, empresa: e.target.value === '' ? null : e.target.value }))
                }
              >
                <option value="">Todas</option>
                {empresas.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className={estilos.desplegable} htmlFor={idOrden}>
            <span className={estilos.etiquetaFiltro}>Orden</span>
            <select
              id={idOrden}
              value={filtros.orden}
              onChange={(e) =>
                setFiltros((f) => ({ ...f, orden: e.target.value as OrdenDeResenas }))
              }
            >
              {ORDENES.map((o) => (
                <option key={o.codigo} value={o.codigo}>
                  {o.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {visibles.length === 0 ? (
        <div className={estilos.ningunaConFiltros}>
          <p>Ninguna reseña con estos filtros.</p>
          <button type="button" className={estilos.botonSecundario} onClick={quitarFiltros}>
            Quitar filtros
          </button>
        </div>
      ) : (
        <ul className={estilos.lista} role="list">
          {/* `data-resena` y `tabIndex={-1}`: al volver de un paso, si el botón
              que lo abrió ya no está —tras reportar o responder—, el foco se
              queda en su fila en vez de caer fuera de la ventana. */}
          {visibles.map((r) => (
            <li key={r.id} data-resena={r.id} tabIndex={-1}>
              {pintar(r)}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
