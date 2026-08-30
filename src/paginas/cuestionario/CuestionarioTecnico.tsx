/**
 * La prueba técnica de la vacante, desde el lado del candidato.
 *
 * Es la otra forma de cumplir la etapa de la prueba: en vez de un problema que resolver y
 * un entregable que subir, unas cuantas preguntas escritas para este puesto y esta empresa
 * concretos. Se contestan escribiendo, y **aquí no se sube ningún archivo**.
 *
 * <p>Pantalla propia y no una rama dentro de la evaluación del banco: aquella lleva los
 * ocho formatos del banco v3 —opciones, casos, listas ordenadas— y meterle un segundo
 * camino por dentro sería tocar la pantalla por la que hoy pasan candidatos reales para
 * añadirle un caso que no usa nada de eso. Lo que sí se comparte es lo que no puede
 * divergir: la cola de guardado, en `useColaDeRespuestas`.
 *
 * Tres reglas de la casa que aquí se cumplen igual:
 *
 * - **Lo escrito no sale de la cola hasta que el servidor lo confirma**, se reintenta solo,
 *   se dice cuántas quedan sin guardar y no se deja entregar mientras quede alguna.
 * - **Una pregunta en blanco no está «guardada»: está sin responder**, que es otra cosa.
 * - **La hora la manda el servidor**: el cronómetro cuenta hasta la fecha de vencimiento
 *   que él dice, no desde un número.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  entregarCuestionarioTecnico,
  iniciarCuestionarioTecnico,
  responderCuestionarioTecnico,
  verCuestionarioTecnico,
} from '@/api/cuestionarioTecnico'
import type { PreguntaEvaluacion } from '@/api/tipos'
import { rutas } from '@/rutas'
import { useAviso } from '@/ui/Avisos'
import { Cronometro } from '@/ui/Cronometro'
import { Cargando, Fallo } from '@/ui/Mensajes'
import { Modal } from '@/ui/Modal'
import { useColaDeRespuestas } from '../evaluacion/useColaDeRespuestas'
import estilos from './CuestionarioTecnico.module.css'

/** Lo que el backend acepta por respuesta aquí: texto y nada más. */
interface Pendiente {
  texto: string
}

export function CuestionarioTecnico() {
  const { uuid = '' } = useParams()
  const navegar = useNavigate()
  const avisar = useAviso()
  const cache = useQueryClient()

  const [indice, setIndice] = useState(0)
  // El borrador va atado a su pregunta: al pasar de una a otra hay un instante en que React
  // ya pinta la nueva y el borrador sigue siendo el de la anterior, y sin el id ese texto
  // entraría en la cola a nombre de la pregunta equivocada.
  const [borrador, setBorrador] = useState<{ preguntaId: number; texto: string }>({
    preguntaId: 0,
    texto: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [confirmarEntrega, setConfirmarEntrega] = useState(false)
  const abiertaEn = useRef<number>(Date.now())

  const consulta = useQuery({
    queryKey: ['cuestionario-tecnico', uuid],
    queryFn: () => verCuestionarioTecnico(uuid),
    enabled: uuid !== '',
  })

  const preguntas = useMemo(() => consulta.data?.preguntas ?? [], [consulta.data])
  const pregunta: PreguntaEvaluacion | undefined = preguntas[indice]

  const guardar = useMutation({
    mutationFn: (datos: { preguntaId: number; texto: string }) =>
      responderCuestionarioTecnico(uuid, datos.preguntaId, {
        texto: datos.texto,
        segundos: Math.round((Date.now() - abiertaEn.current) / 1000),
      }),
    onSuccess: async (_resultado, datos) => {
      cola.confirmar(datos.preguntaId, { texto: datos.texto })
      setError(null)
      await cache.invalidateQueries({ queryKey: ['cuestionario-tecnico', uuid] })
    },
    onError: (causa) => {
      // No se toca la cola: si no llegó, se vuelve a intentar.
      setError(causa instanceof Error ? causa.message : 'No pudimos guardar tu respuesta.')
    },
  })

  const mandar = useCallback(
    (preguntaId: number, valor: Pendiente) => guardar.mutate({ preguntaId, texto: valor.texto }),
    [guardar.mutate],
  )
  const loMismo = useCallback(
    (enCola: Pendiente, confirmado: Pendiente) => enCola.texto === confirmado.texto,
    [],
  )
  const cola = useColaDeRespuestas<Pendiente>(mandar, loMismo)

  const inicio = useMutation({
    mutationFn: () => iniciarCuestionarioTecnico(uuid),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ['cuestionario-tecnico', uuid] })
    },
    onError: (causa) =>
      setError(causa instanceof Error ? causa.message : 'No pudimos abrir tu cuestionario.'),
  })

  const entrega = useMutation({
    mutationFn: () => entregarCuestionarioTecnico(uuid),
    onSuccess: async () => {
      setConfirmarEntrega(false)
      await cache.invalidateQueries({ queryKey: ['postulaciones'] })
      await cache.invalidateQueries({ queryKey: ['postulacion', uuid] })
      avisar('Prueba técnica entregada. Te avisaremos cuando avance.')
      navegar(rutas.proceso(uuid), { replace: true })
    },
    onError: (causa) => {
      setConfirmarEntrega(false)
      setError(causa instanceof Error ? causa.message : 'No pudimos entregar tu prueba.')
    },
  })

  // Al cambiar de pregunta se recarga el borrador. Depende solo del id: si dependiera del
  // texto guardado, una recarga en segundo plano pisaría lo que se está escribiendo.
  //
  // Si esa pregunta tiene algo sin confirmar, manda lo del candidato y no lo que el
  // servidor cree: lo suyo es más reciente.
  useEffect(() => {
    if (!pregunta) return
    setBorrador({
      preguntaId: pregunta.id,
      texto: cola.pendienteDe(pregunta.id)?.texto ?? pregunta.respuestaTexto ?? '',
    })
    abiertaEn.current = Date.now()
  }, [pregunta?.id, cola.pendienteDe])

  // Se guarda cuando deja de escribir, no en cada tecla. Y lo que quedó igual que en el
  // servidor sale de la cola: no hay nada que mandar.
  useEffect(() => {
    if (!pregunta || borrador.preguntaId !== pregunta.id) return
    if (borrador.texto === (pregunta.respuestaTexto ?? '')) {
      cola.olvidar(pregunta.id)
      return
    }
    cola.encolar(pregunta.id, { texto: borrador.texto })
  }, [borrador, pregunta, cola.encolar, cola.olvidar])

  if (consulta.isPending) return <Cargando que="Abriendo tu prueba técnica…" />
  if (consulta.isError) {
    return <Fallo error={consulta.error} reintentar={() => consulta.refetch()} />
  }

  const cuestionario = consulta.data
  const sinEmpezar = cuestionario.iniciadaEn === null
  const entregado = cuestionario.estado === 'TERMINADA'
  const sinGuardar = cola.sinConfirmar.length
  // ⚠️ Se cuenta desde el servidor, no desde lo que hay en pantalla: un indicador que
  // saliera del borrador diría «respondidas» de cosas que no llegaron.
  const respondidas = cuestionario.respondidas
  const faltan = cuestionario.total - respondidas

  if (entregado) {
    return (
      <div className={estilos.pagina}>
        <h1 className={estilos.titulo}>Ya entregaste tu prueba técnica</h1>
        <p className={estilos.texto}>
          La está revisando el equipo. Te avisamos en cuanto haya novedades.
        </p>
      </div>
    )
  }

  if (sinEmpezar) {
    return (
      <div className={estilos.pagina}>
        <h1 className={estilos.titulo}>Tu prueba técnica</h1>
        <p className={estilos.texto}>
          Son {cuestionario.total} preguntas sobre este puesto y esta empresa. Se responden
          escribiendo: no hay que subir ningún archivo. Cuéntalo con casos que hayas vivido,
          con las cifras y los nombres que recuerdes — eso es lo que se lee.
        </p>
        {cuestionario.minutosObjetivo !== null && (
          <p className={estilos.aviso} role="status">
            Tendrás <b>{cuestionario.minutosObjetivo} minutos</b> desde que empieces. El reloj
            no se detiene al cerrar la página, así que empieza cuando tengas ese rato.
          </p>
        )}
        <p className={estilos.texto}>
          Lo que escribas se guarda solo, y puedes volver atrás y corregir hasta que entregues.
        </p>
        {error && (
          <p className={estilos.error} role="alert">
            {error}
          </p>
        )}
        <button
          className={estilos.empezar}
          type="button"
          onClick={() => inicio.mutate()}
          disabled={inicio.isPending}
        >
          {inicio.isPending ? 'Abriendo…' : 'Empezar la prueba'}
        </button>
      </div>
    )
  }

  return (
    <div className={estilos.pagina}>
      <header className={estilos.cabecera}>
        <div>
          <h1 className={estilos.titulo}>Tu prueba técnica</h1>
          <p className={estilos.avance} role="status">
            Pregunta {indice + 1} de {cuestionario.total} · {respondidas} respondidas
          </p>
        </div>
        {cuestionario.venceEn !== null && (
          <Cronometro
            venceEn={cuestionario.venceEn}
            className={estilos.reloj}
            classNamePoco={estilos.relojPoco}
            alAgotarse={() => {
              cola.mandarYa()
              void cache.invalidateQueries({ queryKey: ['cuestionario-tecnico', uuid] })
            }}
          />
        )}
      </header>

      {pregunta && (
        <section className={estilos.pregunta}>
          <p className={estilos.enunciado}>{pregunta.enunciado}</p>
          <label className={estilos.campo}>
            <span className={estilos.etiqueta}>Tu respuesta</span>
            <textarea
              className={estilos.area}
              value={borrador.preguntaId === pregunta.id ? borrador.texto : ''}
              onChange={(e) =>
                setBorrador({ preguntaId: pregunta.id, texto: e.target.value })
              }
              rows={10}
              maxLength={20_000}
              placeholder="Cuenta un caso concreto: qué pasó, qué hiciste tú, con qué cifras."
            />
          </label>
          <p className={estilos.pista}>
            {cola.sinConfirmar.some((p) => p.id === pregunta.id)
              ? 'Guardando lo que escribiste…'
              : pregunta.respuestaTexto
                ? 'Guardada. Puedes seguir corrigiéndola hasta que entregues.'
                : 'Todavía sin responder.'}
          </p>
        </section>
      )}

      <nav className={estilos.pasos}>
        <button
          className={estilos.secundario}
          type="button"
          onClick={() => setIndice((i) => Math.max(0, i - 1))}
          disabled={indice === 0}
        >
          ← Anterior
        </button>
        <button
          className={estilos.secundario}
          type="button"
          onClick={() => setIndice((i) => Math.min(preguntas.length - 1, i + 1))}
          disabled={indice >= preguntas.length - 1}
        >
          Siguiente →
        </button>
      </nav>

      {error && (
        <p className={estilos.error} role="alert">
          {error}
        </p>
      )}

      {sinGuardar > 0 && (
        <p className={estilos.aviso} role="status">
          {sinGuardar === 1
            ? 'Queda 1 respuesta sin guardar. Lo seguimos intentando.'
            : `Quedan ${sinGuardar} respuestas sin guardar. Lo seguimos intentando.`}
        </p>
      )}

      <div className={estilos.entrega}>
        <button
          className={estilos.entregar}
          type="button"
          onClick={() => setConfirmarEntrega(true)}
          disabled={faltan > 0 || sinGuardar > 0 || entrega.isPending}
        >
          Entregar
        </button>
        {faltan > 0 && (
          <span className={estilos.pista}>
            {faltan === 1
              ? 'Falta 1 pregunta por responder.'
              : `Faltan ${faltan} preguntas por responder.`}
          </span>
        )}
      </div>

      <Modal
        abierto={confirmarEntrega}
        titulo="¿Entregar tu prueba técnica?"
        onCerrar={() => setConfirmarEntrega(false)}
        pie={
          <>
            <button
              className={estilos.entregar}
              type="button"
              onClick={() => entrega.mutate()}
              disabled={entrega.isPending}
            >
              {entrega.isPending ? 'Entregando…' : 'Sí, entregar'}
            </button>
            <button
              className={estilos.secundario}
              type="button"
              onClick={() => setConfirmarEntrega(false)}
            >
              Mejor no
            </button>
          </>
        }
      >
        <p>
          Después de entregar ya no se puede cambiar nada. Tus {cuestionario.total} respuestas
          pasan a revisión.
        </p>
      </Modal>
    </div>
  )
}
