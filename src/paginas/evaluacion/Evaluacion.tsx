/**
 * La evaluacion del Perfil Integral.
 *
 * Dos diferencias con el mockup, decididas a proposito:
 *
 *   - **Se puede volver atras.** El backend manda todas las preguntas de golpe
 *     y acepta guardar cualquiera en cualquier orden. Obligar a avanzar en un
 *     solo sentido era una limitacion del mockup, no del sistema.
 *   - **El avance es real.** El mockup empezaba en la pregunta 47 y topaba el
 *     porcentaje en 98. Aqui se cuenta lo que de verdad hay respondido.
 *
 * Se sigue enseñando una pregunta por pantalla: leer sesenta preguntas de
 * corrido cansa y empuja a responder por responder.
 *
 * Sobre las respuestas que se perdian: ya no basta con mandar lo pendiente al
 * cambiar de pregunta. Un guardado puede fallar —red, un 500 del backend— y
 * antes eso se perdia sin rastro: lo pendiente se borraba al mandarlo, el error
 * se limpiaba al pasar de pregunta y nadie reintentaba. El candidato llegaba al
 * final con «16 de 20 respondidas» y sin forma de saber cuales faltaban. Ahora
 * lo escrito no sale de la cola hasta que el servidor lo confirma.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  entregarEvaluacion,
  iniciarEvaluacion,
  responderEvaluacion,
  verEvaluacion,
} from '@/api/evaluacion'
import type { PreguntaEvaluacion } from '@/api/tipos'
import { formatearTiempo, segundosHasta } from '@/dominio/reloj'
import { rutas } from '@/rutas'
import { useAviso } from '@/ui/Avisos'
import { Modal } from '@/ui/Modal'
import { Cargando, Fallo } from '@/ui/Mensajes'

const ESPERA_ANTES_DE_GUARDAR = 800
/**
 * Lo que el backend acepta como maximo en una respuesta escrita: el `@Size` del
 * record `Responder`. Si se pasa, el guardado rebota con un 400 y la respuesta
 * no llega, asi que aqui se corta antes y se avisa al acercarse.
 */
const MAXIMO_DEL_TEXTO = 20_000
/** Cada cuanto se vuelve a intentar lo que no llego al servidor. */
const ESPERA_ANTES_DE_REINTENTAR = 5000

/** Lo que falta por confirmar de una pregunta: o el texto, o la opcion. */
interface Pendiente {
  texto?: string
  opcionId?: number
}

function estaRespondida(p: PreguntaEvaluacion): boolean {
  return p.respuestaOpcionId !== null || (p.respuestaTexto ?? '').trim() !== ''
}

export function Evaluacion() {
  const { uuid = '' } = useParams()
  const navegar = useNavigate()
  const avisar = useAviso()
  const cache = useQueryClient()

  const [indice, setIndice] = useState(0)
  // El borrador va atado a su pregunta. Al pasar de una a otra hay un instante
  // en que React ya pinta la pregunta nueva pero el borrador sigue siendo el de
  // la anterior; sin el id, ese texto entraba en la cola a nombre de la
  // pregunta equivocada y podia acabar guardado en ella.
  const [borrador, setBorrador] = useState<{ preguntaId: number; texto: string }>({
    preguntaId: 0,
    texto: '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmarEntrega, setConfirmarEntrega] = useState(false)
  const abiertaEn = useRef<number>(Date.now())

  const consulta = useQuery({
    queryKey: ['evaluacion', uuid],
    queryFn: () => verEvaluacion(uuid),
    enabled: uuid !== '',
  })

  const preguntas = useMemo(() => consulta.data?.preguntas ?? [], [consulta.data])
  const pregunta = preguntas[indice]

  // Lo escrito que todavia no ha confirmado el servidor, por pregunta. Es una
  // referencia para poder mandarlo al vuelo desde cualquier sitio, y ademas se
  // copia a estado para poder pintarlo: sin eso, el candidato no tiene forma de
  // saber que algo no llego.
  const cola = useRef<Map<number, Pendiente>>(new Map())
  // Espejo en estado de la cola, para poder pintarla. Guarda el valor y no solo
  // el id porque la opcion elegida se enseña desde aqui hasta que el servidor
  // la confirma: si no, marcar un radio no se veia hasta que la peticion volvia,
  // y si fallaba no se veia nunca.
  const [sinConfirmar, setSinConfirmar] = useState<{ id: number; valor: Pendiente }[]>([])
  const temporizador = useRef<number | undefined>(undefined)
  const enVuelo = useRef(0)

  const refrescarCola = useCallback(() => {
    setSinConfirmar([...cola.current].map(([id, valor]) => ({ id, valor })))
  }, [])

  // Al cambiar de pregunta se recarga el borrador y se reinicia el cronometro
  // que mide cuanto se tarda en responderla.
  //
  // Depende solo del id, no del texto guardado: si dependiera de las dos cosas,
  // una recarga en segundo plano pisaria lo que el candidato esta escribiendo.
  useEffect(() => {
    if (!pregunta) return
    // Si esa pregunta tiene algo sin confirmar, manda lo del candidato, no lo
    // que el servidor cree: lo suyo es mas reciente.
    setBorrador({
      preguntaId: pregunta.id,
      texto: cola.current.get(pregunta.id)?.texto ?? pregunta.respuestaTexto ?? '',
    })
    abiertaEn.current = Date.now()
  }, [pregunta?.id])

  const guardar = useMutation({
    mutationFn: (datos: { preguntaId: number; opcionId?: number; texto?: string }) =>
      responderEvaluacion(uuid, datos.preguntaId, {
        opcionId: datos.opcionId,
        texto: datos.texto,
        segundos: Math.round((Date.now() - abiertaEn.current) / 1000),
      }),
    onMutate: () => {
      enVuelo.current += 1
      setGuardando(true)
    },
    onSettled: () => {
      enVuelo.current -= 1
      if (enVuelo.current <= 0) setGuardando(false)
    },
    onSuccess: async (_resultado, datos) => {
      // Solo se da por guardado lo que de verdad se mando. Si el candidato
      // siguio escribiendo mientras la peticion viajaba, lo nuevo sigue en la
      // cola y se mandara despues.
      const enCola = cola.current.get(datos.preguntaId)
      const esLoMismo =
        enCola !== undefined &&
        enCola.texto === datos.texto &&
        enCola.opcionId === datos.opcionId
      if (esLoMismo) {
        cola.current.delete(datos.preguntaId)
        refrescarCola()
      }
      setError(null)
      await cache.invalidateQueries({ queryKey: ['evaluacion', uuid] })
    },
    onError: (causa) => {
      // No se toca la cola: si no llego, se vuelve a intentar.
      setError(causa instanceof Error ? causa.message : 'No pudimos guardar tu respuesta.')
    },
  })

  const inicio = useMutation({
    mutationFn: () => iniciarEvaluacion(uuid),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ['evaluacion', uuid] })
    },
  })

  const entrega = useMutation({
    mutationFn: () => entregarEvaluacion(uuid),
    onSuccess: async () => {
      setConfirmarEntrega(false)
      await cache.invalidateQueries({ queryKey: ['postulaciones'] })
      await cache.invalidateQueries({ queryKey: ['postulacion', uuid] })
      avisar('Evaluación entregada. Te avisaremos cuando avance.')
      navegar(rutas.proceso(uuid), { replace: true })
    },
  })

  const guardarTexto = guardar.mutate

  /** Manda ya todo lo que no ha confirmado el servidor, sin esperar. */
  const mandarPendientes = useCallback(() => {
    window.clearTimeout(temporizador.current)
    for (const [preguntaId, valor] of cola.current) {
      guardarTexto({ preguntaId, ...valor })
    }
  }, [guardarTexto])

  // Las respuestas de texto se guardan solas cuando el candidato deja de
  // escribir, no en cada tecla.
  useEffect(() => {
    if (!pregunta || pregunta.opciones?.length) return
    // Todavia no se ha recargado el borrador: lo que hay es de otra pregunta.
    if (borrador.preguntaId !== pregunta.id) return

    if (borrador.texto === (pregunta.respuestaTexto ?? '')) {
      if (cola.current.delete(pregunta.id)) refrescarCola()
      return
    }

    cola.current.set(pregunta.id, { texto: borrador.texto })
    refrescarCola()
    window.clearTimeout(temporizador.current)
    temporizador.current = window.setTimeout(mandarPendientes, ESPERA_ANTES_DE_GUARDAR)
  }, [borrador, pregunta, mandarPendientes, refrescarCola])

  // Mientras quede algo sin confirmar se sigue intentando solo. Un fallo de red
  // de un momento no deberia costarle una respuesta a nadie.
  useEffect(() => {
    if (sinConfirmar.length === 0) return
    const reloj = window.setInterval(mandarPendientes, ESPERA_ANTES_DE_REINTENTAR)
    return () => window.clearInterval(reloj)
  }, [sinConfirmar.length, mandarPendientes])

  // Al salir de la pantalla —volver al panel, cerrar la pestaña— lo que quede
  // sin mandar se manda.
  useEffect(() => {
    return () => {
      mandarPendientes()
    }
  }, [mandarPendientes])

  /**
   * Las opciones no esperan al temporizador: se manda al momento. Pero pasan por
   * la cola igual que el texto, para que un rechazo no se pierda y se reintente.
   */
  const elegirOpcion = useCallback(
    (preguntaId: number, opcionId: number) => {
      cola.current.set(preguntaId, { opcionId })
      refrescarCola()
      guardarTexto({ preguntaId, opcionId })
    },
    [guardarTexto, refrescarCola],
  )

  const irA = useCallback(
    (siguiente: number) => {
      mandarPendientes()
      setIndice(Math.max(0, Math.min(preguntas.length - 1, siguiente)))
      setError(null)
    },
    [preguntas.length, mandarPendientes],
  )

  if (consulta.isPending) return <Cargando que="Abriendo tu evaluación…" />
  if (consulta.isError) {
    return <Fallo error={consulta.error} reintentar={() => void consulta.refetch()} />
  }

  const evaluacion = consulta.data

  // Todavia no ha empezado: se enseña el aviso y el boton que arranca el plazo.
  if (evaluacion.iniciadaEn === null) {
    return (
      <>
        <Link className="back" to={rutas.proceso(uuid)}>
          ← Volver a mi proceso
        </Link>
        <div className="pagehead">
          <div>
            <div className="eyebrow">Perfil Integral</div>
            <h1>Tu evaluación está lista.</h1>
            <p>
              Son {evaluacion.total} preguntas. Puedes salir y volver: lo respondido se
              guarda solo.
            </p>
          </div>
        </div>
        <div className="medida-lectura">
          <div className="grid g3">
            <div className="callout">
              <b>No hay respuestas de manual</b>
              <p>Nos interesa cómo trabajas y cómo explicas tus decisiones.</p>
            </div>
            <div className="callout">
              <b>Puedes corregir antes de entregar</b>
              <p>Vuelve atrás las veces que quieras.</p>
            </div>
            <div className="callout">
              <b>Si se corta tu conexión</b>
              <p>Continúas desde la última respuesta guardada.</p>
            </div>
          </div>

          <div className="card resumen-evaluacion">
            <div className="resumen-cifras">
              {evaluacion.minutosObjetivo && (
                <div>
                  <span className="small">Duración de referencia</span>
                  <b>{evaluacion.minutosObjetivo} minutos</b>
                  <span className="small">Es una referencia, no un límite.</span>
                </div>
              )}
              <div>
                <span className="small">Preguntas</span>
                <b>{evaluacion.total}</b>
                <span className="small">Una por pantalla.</span>
              </div>
            </div>
            <button
              className="btn primary large"
              onClick={() => inicio.mutate()}
              disabled={inicio.isPending}
            >
              {inicio.isPending ? 'Abriendo…' : 'Empezar evaluación'}
            </button>
          </div>
        </div>
      </>
    )
  }

  if (!pregunta) {
    return (
      <div className="card center-card">
        <div className="status-icon">✓</div>
        <h1>No hay preguntas pendientes.</h1>
        <p>Tu evaluación no tiene preguntas que mostrar.</p>
        <Link className="btn primary" to={rutas.proceso(uuid)}>
          Volver a mi proceso
        </Link>
      </div>
    )
  }

  // El backend dice cuantas preguntas tiene la evaluacion y aparte manda la
  // lista. Si manda menos, el candidato se queda sin «Siguiente» a mitad y la
  // barra no llega nunca al final: parece que el portal se atasco cuando lo que
  // pasa es que faltan preguntas por venir.
  const faltanPreguntas = evaluacion.total > preguntas.length

  const respondidas = preguntas.filter(estaRespondida).length
  const primeraSinResponder = preguntas.findIndex((p) => !estaRespondida(p))
  const porcentaje = evaluacion.total === 0 ? 0 : (respondidas / evaluacion.total) * 100
  const faltan = evaluacion.total - respondidas
  const esUltima = indice === preguntas.length - 1
  const restante = segundosHasta(evaluacion.venceEn)

  const texto = borrador.preguntaId === pregunta.id ? borrador.texto : (pregunta.respuestaTexto ?? '')
  const pendienteDeEsta = sinConfirmar.find((p) => p.id === pregunta.id)?.valor
  const esteSinConfirmar = pendienteDeEsta !== undefined
  // Lo que el candidato eligio manda sobre lo que el servidor sepa: si no, un
  // guardado rechazado dejaba el radio sin marcar y parecia que no se podia
  // elegir nada.
  const opcionElegida = pendienteDeEsta?.opcionId ?? pregunta.respuestaOpcionId
  const estaVacia = !pregunta.opciones?.length && texto.trim() === '' && !estaRespondida(pregunta)

  // El indicador dice lo que hay, no lo que gustaria. «Respuesta guardada» solo
  // cuando lo escrito coincide con lo que el servidor confirmo.
  const indicador = guardando
    ? { texto: 'Guardando…', clase: ' pendiente' }
    : esteSinConfirmar
      ? { texto: 'Sin guardar', clase: ' pendiente' }
      : estaVacia
        ? { texto: 'Sin responder', clase: ' vacia' }
        : { texto: 'Respuesta guardada', clase: '' }

  return (
    <>
      <Link className="back" to={rutas.proceso(uuid)}>
        ← Volver a mi proceso
      </Link>

      <div className="exam-shell">
        <div className="exam-top">
          <div style={{ flex: 1 }}>
            <div className="row">
              <span className="progress-meta">
                Pregunta {indice + 1} de {preguntas.length}
              </span>
              <span className="progress-meta">
                {respondidas} de {evaluacion.total} respondidas
              </span>
            </div>
            <div className="progress">
              <i style={{ width: `${porcentaje}%` }} />
            </div>
          </div>
          <div className={`save-state${indicador.clase}`}>
            <i />
            <span>{indicador.texto}</span>
          </div>
        </div>

        {/* La red de seguridad: mientras algo no haya llegado, se dice, se sigue
            intentando y se puede forzar a mano. Antes esto se perdia callado. */}
        {sinConfirmar.length > 0 && (
          <div className="callout warn" style={{ marginBottom: 14 }}>
            <b>
              {sinConfirmar.length === 1
                ? 'Hay 1 respuesta sin guardar'
                : `Hay ${sinConfirmar.length} respuestas sin guardar`}
            </b>
            <p>
              Seguimos intentándolo solos. No cierres esta página hasta que lo consigamos:
              lo que no llegue al servidor no se entrega.
            </p>
            <button className="link" type="button" onClick={mandarPendientes}>
              Reintentar ahora
            </button>
          </div>
        )}

        {faltanPreguntas && (
          <div className="callout warn" style={{ marginBottom: 14 }}>
            <b>
              Faltan preguntas por cargar: llegaron {preguntas.length} de las{' '}
              {evaluacion.total}
            </b>
            <p>
              No es cosa tuya. Vuelve a cargar la evaluación; si sigue igual, avísanos
              antes de entregar: lo que no llega no se puede responder.
            </p>
            <button className="link" type="button" onClick={() => void consulta.refetch()}>
              Volver a cargar
            </button>
          </div>
        )}

        {restante !== null && restante < 3600 && (
          <div className="callout warn" style={{ marginBottom: 14 }}>
            <b>Queda poco plazo: {formatearTiempo(restante)}</b>
            <p>Cuando se acabe, se entregará lo que tengas respondido.</p>
          </div>
        )}

        <article className="card">
          <div className="label">Evaluación Integral</div>
          {pregunta.situacion && (
            <div className="callout" style={{ marginTop: 14 }}>
              <b>La situación</b>
              <p>{pregunta.situacion}</p>
            </div>
          )}

          <h1 className="question">{pregunta.enunciado}</h1>

          {pregunta.opciones?.length ? (
            pregunta.opciones.map((opcion) => (
              <label className="choice" key={opcion.id}>
                <input
                  type="radio"
                  name={`pregunta-${pregunta.id}`}
                  checked={opcionElegida === opcion.id}
                  onChange={() => elegirOpcion(pregunta.id, opcion.id)}
                />
                <span>
                  {opcion.letra ? `${opcion.letra}. ` : ''}
                  {opcion.texto}
                </span>
              </label>
            ))
          ) : (
            <div className="field">
              <label htmlFor="respuesta">Tu respuesta</label>
              <textarea
                id="respuesta"
                value={texto}
                maxLength={MAXIMO_DEL_TEXTO}
                onChange={(e) => setBorrador({ preguntaId: pregunta.id, texto: e.target.value })}
                placeholder="Describe el contexto, qué hiciste, qué resultado obtuviste y qué aprendiste."
              />
              <div className="hint">
                {texto.length > MAXIMO_DEL_TEXTO * 0.9
                  ? `Se guarda sola cuando dejas de escribir. Llevas ${texto.length.toLocaleString('es-PE')} caracteres de ${MAXIMO_DEL_TEXTO.toLocaleString('es-PE')}: pasado ese punto el servidor no la acepta.`
                  : 'Se guarda sola cuando dejas de escribir.'}
              </div>
            </div>
          )}

          {error && <div className="error">{error}</div>}

          <div className="exam-foot">
            <div className="small">
              <b>Puedes volver atrás y corregir.</b>
              <br />
              Cada respuesta se guarda sola. Nada se envía hasta que entregues.
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn" onClick={() => irA(indice - 1)} disabled={indice === 0}>
                Anterior
              </button>
              {esUltima ? (
                <button
                  className="btn primary large"
                  onClick={() => {
                    // Lo ultimo escrito se manda antes de abrir el modal: si no,
                    // la respuesta de la ultima pregunta se quedaba fuera.
                    mandarPendientes()
                    setConfirmarEntrega(true)
                  }}
                >
                  Entregar evaluación
                </button>
              ) : (
                <button className="btn primary large" onClick={() => irA(indice + 1)}>
                  Siguiente
                </button>
              )}
            </div>
          </div>
        </article>

        <div className="callout" style={{ marginTop: 14 }}>
          <b>Si se corta tu conexión</b>
          <p>Podrás volver a entrar y continuar desde la última respuesta guardada.</p>
        </div>
      </div>

      <Modal
        abierto={confirmarEntrega}
        titulo="Entregar evaluación"
        onCerrar={() => setConfirmarEntrega(false)}
        pie={
          <>
            <button className="btn" onClick={() => setConfirmarEntrega(false)}>
              Seguir revisando
            </button>
            <button
              className="btn primary"
              onClick={() => entrega.mutate()}
              // Entregar con algo sin guardar es entregar sin esa respuesta, y
              // el backend ademas rechaza la entrega si falta alguna.
              disabled={entrega.isPending || sinConfirmar.length > 0 || faltan > 0}
            >
              {entrega.isPending ? 'Entregando…' : 'Entregar'}
            </button>
          </>
        }
      >
        {sinConfirmar.length > 0 ? (
          <div className="callout bad">
            <b>
              Espera: {sinConfirmar.length === 1 ? 'una respuesta' : `${sinConfirmar.length} respuestas`} aún no
              {sinConfirmar.length === 1 ? ' ha llegado' : ' han llegado'} al servidor
            </b>
            <p>
              Estamos reintentándolo. Si entregas ahora se quedarían fuera. En cuanto se
              guarden, este aviso desaparece y podrás entregar.
            </p>
            <button className="link" type="button" onClick={mandarPendientes}>
              Reintentar ahora
            </button>
          </div>
        ) : faltan > 0 ? (
          <div className="callout bad">
            <b>
              {faltan === 1
                ? 'Falta 1 pregunta por responder'
                : `Faltan ${faltan} preguntas por responder`}
            </b>
            <p>
              No se puede entregar una evaluación incompleta: el servidor la rechaza
              hasta que estén todas. Si alguna no se deja guardar, escríbenos antes de
              que venza el plazo.
            </p>
            {primeraSinResponder >= 0 && (
              <button
                className="link"
                type="button"
                onClick={() => {
                  setConfirmarEntrega(false)
                  irA(primeraSinResponder)
                }}
              >
                Ir a la primera sin responder
              </button>
            )}
          </div>
        ) : (
          <div className="callout good">
            <b>Respondiste las {evaluacion.total} preguntas</b>
            <p>Después de entregar ya no podrás modificar tus respuestas.</p>
          </div>
        )}
        {entrega.isError && (
          <div className="error">
            {entrega.error instanceof Error ? entrega.error.message : 'No pudimos entregar.'}
          </div>
        )}
      </Modal>
    </>
  )
}
