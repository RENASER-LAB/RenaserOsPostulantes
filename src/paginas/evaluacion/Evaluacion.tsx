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
/** Cada cuanto se vuelve a intentar lo que no llego al servidor. */
const ESPERA_ANTES_DE_REINTENTAR = 5000

function estaRespondida(p: PreguntaEvaluacion): boolean {
  return p.respuestaOpcionId !== null || (p.respuestaTexto ?? '').trim() !== ''
}

export function Evaluacion() {
  const { uuid = '' } = useParams()
  const navegar = useNavigate()
  const avisar = useAviso()
  const cache = useQueryClient()

  const [indice, setIndice] = useState(0)
  const [borrador, setBorrador] = useState('')
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
  const cola = useRef<Map<number, string>>(new Map())
  const [sinConfirmar, setSinConfirmar] = useState<number[]>([])
  const temporizador = useRef<number | undefined>(undefined)
  const enVuelo = useRef(0)

  const refrescarCola = useCallback(() => {
    setSinConfirmar([...cola.current.keys()])
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
    setBorrador(cola.current.get(pregunta.id) ?? pregunta.respuestaTexto ?? '')
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
      if (datos.texto !== undefined && cola.current.get(datos.preguntaId) === datos.texto) {
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
    for (const [preguntaId, texto] of cola.current) {
      guardarTexto({ preguntaId, texto })
    }
  }, [guardarTexto])

  // Las respuestas de texto se guardan solas cuando el candidato deja de
  // escribir, no en cada tecla.
  useEffect(() => {
    if (!pregunta || pregunta.opciones?.length) return

    if (borrador === (pregunta.respuestaTexto ?? '')) {
      if (cola.current.delete(pregunta.id)) refrescarCola()
      return
    }

    cola.current.set(pregunta.id, borrador)
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
        <div className="card form-card">
          <div className="callout">
            <b>Antes de empezar</b>
            <p>
              No hay respuestas correctas escritas de antemano. Nos interesa cómo trabajas
              y cómo explicas tus decisiones.
            </p>
          </div>
          {evaluacion.minutosObjetivo && (
            <div className="callout" style={{ marginTop: 12 }}>
              <b>Tiempo estimado: {evaluacion.minutosObjetivo} minutos</b>
              <p>Es una referencia, no un límite. Tómate el tiempo que necesites.</p>
            </div>
          )}
          <div className="row" style={{ marginTop: 20 }}>
            <span className="small">Podrás corregir cualquier respuesta antes de entregar.</span>
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

  const respondidas = preguntas.filter(estaRespondida).length
  const porcentaje = evaluacion.total === 0 ? 0 : (respondidas / evaluacion.total) * 100
  const faltan = evaluacion.total - respondidas
  const esUltima = indice === preguntas.length - 1
  const restante = segundosHasta(evaluacion.venceEn)

  const esteSinConfirmar = sinConfirmar.includes(pregunta.id)
  const estaVacia =
    !pregunta.opciones?.length && borrador.trim() === '' && !estaRespondida(pregunta)

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
                  checked={pregunta.respuestaOpcionId === opcion.id}
                  onChange={() => guardar.mutate({ preguntaId: pregunta.id, opcionId: opcion.id })}
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
                value={borrador}
                onChange={(e) => setBorrador(e.target.value)}
                placeholder="Describe el contexto, qué hiciste, qué resultado obtuviste y qué aprendiste."
              />
              <div className="hint">Se guarda sola cuando dejas de escribir.</div>
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
              // Entregar con algo sin guardar es entregar sin esa respuesta.
              disabled={entrega.isPending || sinConfirmar.length > 0}
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
          <div className="callout warn">
            <b>Te faltan {faltan} preguntas por responder</b>
            <p>
              Puedes entregar igualmente, pero lo que quede en blanco cuenta como sin
              responder.
            </p>
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
