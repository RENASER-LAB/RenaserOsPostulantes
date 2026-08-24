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
 * **Pero una por pantalla deja al candidato sin vista de conjunto**, y eso costo
 * una queja de alguien que ya habia hecho el examen entero: se salto una, el
 * aviso lo mando de la 50 a la 10, y para volver no habia mas remedio que pulsar
 * «Siguiente» cuarenta veces. De ahi salen las cuatro cosas de esta pantalla que
 * no responden preguntas: el mapa con todas las preguntas y su estado, la linea
 * que dice cuantas faltan, «Siguiente sin responder» —que va tapando huecos y da
 * la vuelta al llegar al final— y el «Volver a la 50», que aparece solo despues
 * de un salto y se olvida en cuanto se navega a mano.
 *
 * **Cada formato se responde a su manera.** El banco v3 trae ocho, y solo dos
 * caben en «marca una opción» o «escribe un texto»: los otros seis mandan
 * varias cosas a la vez en un campo `detalle`. Lo que dibuja cada uno esta en
 * `Formatos.tsx` y la forma de lo que se manda en `bancoV3.ts`. Esta pantalla
 * solo sabe que hay puesto y cuando se puede mandar.
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
import type { DetalleRespuesta, PreguntaEvaluacion } from '@/api/tipos'
import { diasHasta, formatearTiempo, segundosHasta } from '@/dominio/reloj'
import { rutas } from '@/rutas'
import { useAviso } from '@/ui/Avisos'
import { Modal } from '@/ui/Modal'
import { RespuestaDeLaPregunta } from './Formatos'
import estilos from './Evaluacion.module.css'
import {
  detalleParaEnviar,
  estaCompleto,
  estadoDePregunta,
  modoDeRespuesta,
  normalizarDetalle,
  queFalta,
  siguienteIncompleta,
  type EstadoDePregunta,
} from './bancoV3'

const ESPERA_ANTES_DE_GUARDAR = 800
/**
 * Lo que el backend acepta como maximo en una respuesta escrita: el `@Size` del
 * record `Responder`. Si se pasa, el guardado rebota con un 400 y la respuesta
 * no llega, asi que aqui se corta antes y se avisa al acercarse.
 */
export const MAXIMO_DEL_TEXTO = 20_000
/** Cada cuanto se vuelve a intentar lo que no llego al servidor. */
const ESPERA_ANTES_DE_REINTENTAR = 5000

/**
 * Lo que falta por confirmar de una pregunta: el texto, la opcion, o el detalle
 * de los formatos del banco v3 —que llevan varias cosas a la vez—.
 */
interface Pendiente {
  texto?: string
  opcionId?: number
  detalle?: DetalleRespuesta
}

/** Como se dice cada estado en el mapa, para quien lo oye en vez de verlo. */
const COMO_SE_DICE: Record<EstadoDePregunta, string> = {
  lista: 'respondida',
  'a-medias': 'sin terminar',
  vacia: 'sin responder',
}

/**
 * La marca de cada estado en el numero del mapa.
 *
 * Existe porque el color no basta: hay gente que no distingue el ambar del
 * gris. La forma del recuadro ya cambia (relleno, borde grueso, borde de
 * puntos) y encima va este simbolo, asi que se puede leer de tres maneras.
 */
/** La clase de la casilla en el mapa. La forma dice el estado, no un glifo. */
const CLASE_ESTADO: Record<EstadoDePregunta, 'lista' | 'aMedias' | 'casilla'> = {
  lista: 'lista',
  'a-medias': 'aMedias',
  vacia: 'casilla',
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
  // Lo que el candidato lleva construido en los formatos de detalle, por
  // pregunta. Vive aparte del borrador de texto porque no es una cadena: un
  // SJT-R son cinco notas y un SEC es una lista, y se van armando a pedazos.
  //
  // Empieza vacio y no se rellena al cargar: lo ya respondido se lee de la
  // propia pregunta (`respuestaDetalle`), asi que al recargar la pagina se
  // repinta solo y esto solo guarda lo que se toca en esta sesion.
  const [detalles, setDetalles] = useState<Record<number, DetalleRespuesta>>({})
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmarEntrega, setConfirmarEntrega] = useState(false)
  const [mapaAbierto, setMapaAbierto] = useState(false)
  // De donde se venia al dar un salto, para poder deshacerlo. Es la queja que
  // arranco todo esto: saltar de la 50 a la 10 y no tener forma de volver, mas
  // que pulsar «Siguiente» cuarenta veces.
  const [volverA, setVolverA] = useState<number | null>(null)
  const abiertaEn = useRef<number>(Date.now())
  const botonMapa = useRef<HTMLButtonElement>(null)

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
    mutationFn: (datos: {
      preguntaId: number
      opcionId?: number
      texto?: string
      detalle?: DetalleRespuesta
    }) =>
      responderEvaluacion(uuid, datos.preguntaId, {
        opcionId: datos.opcionId,
        texto: datos.texto,
        detalle: datos.detalle,
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
        enCola.opcionId === datos.opcionId &&
        // Comparar el detalle por identidad basta: cada cambio crea un objeto
        // nuevo, asi que si el candidato lo toco mientras la peticion viajaba,
        // el de la cola ya no es este y se vuelve a mandar.
        enCola.detalle === datos.detalle
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
    if (!pregunta || modoDeRespuesta(pregunta) !== 'TEXTO') return
    // Todavia no se ha recargado el borrador: lo que hay es de otra pregunta.
    if (borrador.preguntaId !== pregunta.id) return

    if (borrador.texto === (pregunta.respuestaTexto ?? '')) {
      if (cola.current.delete(pregunta.id)) refrescarCola()
      return
    }

    // Un `V` a medias no se manda, igual que los formatos con detalle: son
    // varios datos en una sola cadena, y mandarla con la mitad dejaria guardada
    // una respuesta incompleta que despues nadie sabria distinguir de una
    // entera. Se queda en la pantalla hasta que el candidato la termina.
    if (queFalta(pregunta, undefined, borrador.texto) !== null) {
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

  /**
   * Los formatos del banco v3, que se responden a pedazos.
   *
   * La regla es que **no se manda nada a medias**: el backend comprueba la
   * forma del detalle contra el tipo de la pregunta y rechaza lo incompleto con
   * un 400, que en pantalla seria un error sin explicacion y sin arreglo. Asi
   * que mientras falte algo, lo puesto se queda en la pantalla —se ve, no se
   * pierde— y solo entra en la cola cuando el formato esta entero.
   *
   * Si estaba completo y el candidato lo deja a medias otra vez, lo ya guardado
   * en el servidor se queda como estaba: no hay forma de «desguardar», y borrar
   * una respuesta buena porque alguien esta reordenando seria peor.
   */
  const cambiarDetalle = useCallback(
    (preguntaDelDetalle: PreguntaEvaluacion, valor: DetalleRespuesta) => {
      setDetalles((previos) => ({ ...previos, [preguntaDelDetalle.id]: valor }))
      if (!estaCompleto(preguntaDelDetalle, valor)) return

      const listo = detalleParaEnviar(preguntaDelDetalle, valor)
      cola.current.set(preguntaDelDetalle.id, { detalle: listo })
      refrescarCola()
      // Los de escribir esperan a que pare la mano; los de marcar salen ya.
      if (preguntaDelDetalle.tipo === 'CD') {
        window.clearTimeout(temporizador.current)
        temporizador.current = window.setTimeout(mandarPendientes, ESPERA_ANTES_DE_GUARDAR)
      } else {
        guardarTexto({ preguntaId: preguntaDelDetalle.id, detalle: listo })
      }
    },
    [guardarTexto, mandarPendientes, refrescarCola],
  )

  const irA = useCallback(
    (siguiente: number) => {
      mandarPendientes()
      setIndice(Math.max(0, Math.min(preguntas.length - 1, siguiente)))
      setError(null)
    },
    [preguntas.length, mandarPendientes],
  )

  /**
   * Anterior y Siguiente: moverse de una en una.
   *
   * Borra la vuelta a proposito. Si alguien salto a la 10 y desde ahi siguio
   * avanzando a mano, el «Volver a la 50» ya no dice nada cierto: dejo de ser
   * el sitio del que venia y se vuelve un boton fantasma.
   */
  const navegarA = useCallback(
    (siguiente: number) => {
      irA(siguiente)
      setVolverA(null)
    },
    [irA],
  )

  /**
   * Un salto: ir a una pregunta lejos y poder deshacerlo.
   *
   * Se recuerda **el primer** salto, no el ultimo. Asi se pueden ir tapando
   * huecos uno tras otro —de la 10 a la 12, de la 12 a la 27— sin perder el
   * camino de vuelta a la 50, que es de donde se salio de verdad.
   */
  const saltarA = useCallback(
    (destino: number) => {
      if (destino === indice) return
      // Volver al sitio del que se venia cierra el viaje: el boton ya sobra.
      setVolverA((deDonde) => (destino === deDonde ? null : (deDonde ?? indice)))
      irA(destino)
    },
    [irA, indice],
  )

  const volver = useCallback(() => {
    if (volverA === null) return
    irA(volverA)
    setVolverA(null)
  }, [irA, volverA])

  // El mapa se cierra con Escape, y el foco vuelve al boton que lo abrio: si se
  // quedara suelto, quien navega con el teclado tendria que recorrer la pagina
  // entera para volver a donde estaba.
  useEffect(() => {
    if (!mapaAbierto) return
    function alPulsar(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      setMapaAbierto(false)
      botonMapa.current?.focus()
    }
    document.addEventListener('keydown', alPulsar)
    return () => document.removeEventListener('keydown', alPulsar)
  }, [mapaAbierto])

  if (consulta.isPending) {
    return (
      <div className={estilos.pagina}>
        <div className={estilos.marco} aria-busy="true">
          <h1>Abriendo tu evaluación…</h1>
          <div className={estilos.barra} />
          <div className={`${estilos.barra} ${estilos.barraMedia}`} />
          <div className={`${estilos.barra} ${estilos.barraCorta}`} />
        </div>
      </div>
    )
  }

  if (consulta.isError) {
    return (
      <div className={estilos.pagina}>
        <Link className={estilos.volver} to={rutas.proceso(uuid)}>
          ← Volver a mi proceso
        </Link>
        <div className={estilos.marco}>
          <h1>No pudimos abrir tu evaluación.</h1>
          <p className={estilos.marcoTexto}>
            {consulta.error instanceof Error
              ? consulta.error.message
              : 'No pudimos conectar con el servidor.'}{' '}
            Lo que ya hayas respondido está guardado.
          </p>
          <button
            type="button"
            className={estilos.reintentar}
            onClick={() => void consulta.refetch()}
          >
            Intentar de nuevo
          </button>
        </div>
      </div>
    )
  }

  const evaluacion = consulta.data

  // Todavia no ha empezado: se enseña el aviso y el boton que arranca el plazo.
  if (evaluacion.iniciadaEn === null) {
    return (
      <div className={estilos.pagina}>
        <Link className={estilos.volver} to={rutas.proceso(uuid)}>
          ← Volver a mi proceso
        </Link>

        <div className={estilos.portada}>
          <h1>Tu evaluación está lista.</h1>
          <p className={estilos.presentacion}>
            Son preguntas sobre cómo trabajas, no sobre lo que memorizaste. No hay respuestas
            de manual, y nadie las responde de una sentada.
          </p>

          <div className={estilos.datos}>
            <div className={estilos.dato}>
              <span className={estilos.cifra}>{evaluacion.total}</span>
              <span className={estilos.queEs}>preguntas, una por pantalla</span>
            </div>
            {evaluacion.minutosObjetivo !== null && (
              <div className={estilos.dato}>
                <span className={estilos.cifra}>{evaluacion.minutosObjetivo} min</span>
                <span className={estilos.queEs}>de referencia, no es un límite</span>
              </div>
            )}
            {evaluacion.venceEn !== null && (
              <div className={estilos.dato}>
                <span className={estilos.cifra}>{diasHasta(evaluacion.venceEn)}</span>
                <span className={estilos.queEs}>para entregarla</span>
              </div>
            )}
          </div>

          <div className={estilos.saber}>
            <p className={estilos.presentacion}>
              <b>Puedes salir y volver las veces que quieras</b>. Cada respuesta se guarda
              sola, y puedes corregir cualquiera antes de entregar.
            </p>
            <p className={estilos.presentacion}>
              Si se corta tu conexión, continúas desde la última respuesta guardada.
            </p>
          </div>

          <button
            type="button"
            className={estilos.empezar}
            onClick={() => inicio.mutate()}
            disabled={inicio.isPending}
          >
            {inicio.isPending ? 'Abriendo…' : 'Empezar evaluación'}
          </button>
        </div>
      </div>
    )
  }

  if (!pregunta) {
    return (
      <div className={estilos.pagina}>
        <div className={estilos.marco}>
          <h1>No hay preguntas pendientes.</h1>
          <p className={estilos.marcoTexto}>Tu evaluación no tiene preguntas que mostrar.</p>
          <Link className={estilos.reintentar} to={rutas.proceso(uuid)}>
            Volver a mi proceso
          </Link>
        </div>
      </div>
    )
  }

  // El backend dice cuantas preguntas tiene la evaluacion y aparte manda la
  // lista. Si manda menos, el candidato se queda sin «Siguiente» a mitad y la
  // barra no llega nunca al final: parece que el portal se atasco cuando lo que
  // pasa es que faltan preguntas por venir.
  const faltanPreguntas = evaluacion.total > preguntas.length

  const texto = borrador.preguntaId === pregunta.id ? borrador.texto : (pregunta.respuestaTexto ?? '')
  const pendienteDeEsta = sinConfirmar.find((p) => p.id === pregunta.id)?.valor
  const esteSinConfirmar = pendienteDeEsta !== undefined
  // Lo que el candidato eligio manda sobre lo que el servidor sepa: si no, un
  // guardado rechazado dejaba el radio sin marcar y parecia que no se podia
  // elegir nada.
  const opcionElegida = pendienteDeEsta?.opcionId ?? pregunta.respuestaOpcionId

  // El estado de las preguntas, todas de una vez. De aqui salen el mapa, el
  // contador y el indicador de arriba: al venir del mismo sitio no pueden
  // contradecirse, que era la otra mitad de la queja —el contador decia que
  // faltaba una y no habia forma de saber cual—.
  const estados = preguntas.map((p) =>
    estadoDePregunta(p, {
      detalle: detalles[p.id],
      // De la pregunta abierta manda lo que se esta escribiendo ahora mismo;
      // de las demas, lo ultimo que se intento guardar.
      texto: p.id === pregunta.id ? texto : (sinConfirmar.find((s) => s.id === p.id)?.valor.texto ?? p.respuestaTexto),
      opcionId: sinConfirmar.find((s) => s.id === p.id)?.valor.opcionId ?? p.respuestaOpcionId,
    }),
  )

  const respondidas = estados.filter((e) => e === 'lista').length
  const primeraSinResponder = estados.findIndex((e) => e !== 'lista')
  const proximaIncompleta = siguienteIncompleta(estados, indice)
  const porcentaje = evaluacion.total === 0 ? 0 : (respondidas / evaluacion.total) * 100
  const faltan = evaluacion.total - respondidas
  const esUltima = indice === preguntas.length - 1
  const restante = segundosHasta(evaluacion.venceEn)
  // Manda lo que lleva puesto el candidato; si no ha tocado nada, lo que el
  // servidor tenga guardado. Esto es lo que hace que al recargar la pagina la
  // pregunta vuelva a salir respondida.
  const detalleDeEsta = detalles[pregunta.id] ?? normalizarDetalle(pregunta.respuestaDetalle)
  // Vale para cualquier formato: los que no llevan detalle ni son `V` devuelven
  // nulo, asi que no hace falta preguntar antes de que tipo es la pregunta.
  const falta = queFalta(pregunta, detalleDeEsta, texto)

  const estaVacia = estados[indice] === 'vacia'

  // El indicador dice lo que hay, no lo que gustaria. «Respuesta guardada» solo
  // cuando lo escrito coincide con lo que el servidor confirmo, y «sin
  // terminar» cuando hay algo puesto pero al formato le falta una parte: eso no
  // se manda, asi que decir «guardada» seria mentira.
  const indicador = guardando
    ? { texto: 'Guardando…', pendiente: true }
    : esteSinConfirmar
      ? { texto: 'Sin guardar', pendiente: true }
      : estaVacia
        ? { texto: 'Sin responder', pendiente: false }
        : falta !== null
          ? { texto: 'Sin terminar', pendiente: true }
          : { texto: 'Respuesta guardada', pendiente: false }

  return (
    <div className={estilos.pagina}>
      <Link className={estilos.volver} to={rutas.proceso(uuid)}>
        ← Volver a mi proceso
      </Link>

      <div className={estilos.avance}>
        <div className={estilos.cifras}>
          <span className={estilos.donde}>
            Pregunta {indice + 1} de {preguntas.length}
          </span>
          <span>
            {respondidas} de {evaluacion.total} respondidas
          </span>
        </div>
        <div className={estilos.riel}>
          <div className={estilos.recorrido} style={{ width: `${porcentaje}%` }} />
        </div>

        {/* La linea de servicio: cuantas faltan y como llegar a ellas.
            Es una linea y no un aviso a proposito. Esto se mira de reojo cada
            pocos minutos durante una hora larga; un cartel que empuje el
            enunciado hacia abajo cada vez acaba estorbando mas que ayudando. */}
        <div className={estilos.mandos}>
          <button
            className={estilos.mando}
            type="button"
            ref={botonMapa}
            aria-expanded={mapaAbierto}
            aria-controls="mapa-preguntas"
            onClick={() => setMapaAbierto((abierto) => !abierto)}
          >
            {mapaAbierto ? 'Cerrar el mapa' : `Ver las ${preguntas.length}`}
          </button>

          {proximaIncompleta >= 0 && (
            <button
              className={estilos.mando}
              type="button"
              onClick={() => saltarA(proximaIncompleta)}
            >
              Siguiente sin responder
            </button>
          )}

          {/* Solo cuando de verdad no falta ninguna: el boton lleva a la
              pantalla desde la que se entrega, y mandar ahi a alguien que aun
              tiene huecos es mandarlo a un boton que no le va a funcionar. */}
          {faltan <= 0 && !esUltima && (
            <button
              className={estilos.mando}
              type="button"
              onClick={() => saltarA(preguntas.length - 1)}
            >
              Ir al final
            </button>
          )}

          {volverA !== null && (
            <button className={estilos.mando} type="button" onClick={volver}>
              Volver a la {volverA + 1}
            </button>
          )}

          <span className={estilos.faltan}>
            {faltan <= 0
              ? `Ya están las ${evaluacion.total}.`
              : faltan === 1
                ? 'Te falta 1 por terminar.'
                : `Te faltan ${faltan} por terminar.`}
          </span>
        </div>
      </div>

      {/* El mapa. Todo el examen de un vistazo: que falta, que quedo a medias
          y un toque para ir a cualquiera de ellas. */}
      {mapaAbierto && (
        <div className={estilos.mapa} id="mapa-preguntas">
          <ol className={estilos.rejilla} role="list">
            {estados.map((estado, i) => (
              <li key={preguntas[i]?.id ?? i}>
                <button
                  type="button"
                  className={`${estilos.casilla} ${estilos[CLASE_ESTADO[estado]]}${
                    i === indice ? ` ${estilos.aqui}` : ''
                  }`}
                  aria-current={i === indice ? 'true' : undefined}
                  aria-label={
                    `Pregunta ${i + 1}, ${COMO_SE_DICE[estado]}` +
                    (i === indice ? ', es la que estás viendo' : '')
                  }
                  onClick={() => {
                    setMapaAbierto(false)
                    saltarA(i)
                  }}
                >
                  {i + 1}
                </button>
              </li>
            ))}
          </ol>

          <ul className={estilos.leyenda} role="list">
            <li className={estilos.entradaLeyenda}>
              <i className={`${estilos.muestra} ${estilos.lista}`} aria-hidden="true" />
              Respondida
            </li>
            <li className={estilos.entradaLeyenda}>
              <i className={`${estilos.muestra} ${estilos.aMedias}`} aria-hidden="true" />
              Sin terminar
            </li>
            <li className={estilos.entradaLeyenda}>
              <i className={estilos.muestra} aria-hidden="true" />
              Sin responder
            </li>
          </ul>
        </div>
      )}

      {/* La red de seguridad: mientras algo no haya llegado, se dice, se sigue
          intentando y se puede forzar a mano. Antes esto se perdia callado. */}
      {/*
        Con `error`, no solo con la cola llena.

        La cola se llena en cuanto el candidato termina de responder y se vacia
        un segundo despues, cuando el servidor confirma. Colgar el aviso de la
        cola lo hacia aparecer y desaparecer en **cada una de las 55 preguntas**,
        empujando la pagina hacia abajo cada vez, para avisar de algo que no
        estaba pasando: el guardado normal iba bien.

        `error` solo tiene valor cuando un guardado **fallo de verdad** y aun no
        se ha recuperado —`onSuccess` lo pone a nulo—, que es exactamente cuando
        este aviso tiene algo que decir. Lo que NO cambia es el candado de la
        entrega: ese sigue mirando la cola, porque entregar con algo sin
        confirmar es entregar sin esa respuesta.
      */}
      {sinConfirmar.length > 0 && error !== null && (
        <p className={`${estilos.aviso} ${estilos.malo}`} role="status">
          <span>
            <b>
              {sinConfirmar.length === 1
                ? 'Hay 1 respuesta sin guardar.'
                : `Hay ${sinConfirmar.length} respuestas sin guardar.`}
            </b>{' '}
            Seguimos intentándolo solos. No cierres esta página hasta que lo consigamos: lo
            que no llegue al servidor no se entrega.{' '}
            <button className={estilos.enlaceAviso} type="button" onClick={mandarPendientes}>
              Reintentar ahora
            </button>
          </span>
        </p>
      )}

      {faltanPreguntas && (
        <p className={`${estilos.aviso} ${estilos.malo}`} role="status">
          <span>
            <b>
              Faltan preguntas por cargar: llegaron {preguntas.length} de las{' '}
              {evaluacion.total}.
            </b>{' '}
            No es cosa tuya. Vuelve a cargar la evaluación; si sigue igual, avísanos antes de
            entregar: lo que no llega no se puede responder.{' '}
            <button
              className={estilos.enlaceAviso}
              type="button"
              onClick={() => void consulta.refetch()}
            >
              Volver a cargar
            </button>
          </span>
        </p>
      )}

      {restante !== null && restante < 3600 && (
        <p className={estilos.aviso}>
          <span>
            <b>Queda poco plazo: {formatearTiempo(restante)}</b>. Cuando se acabe, se
            entregará lo que tengas respondido.
          </span>
        </p>
      )}

      <article className={estilos.pregunta}>
        {pregunta.situacion && <p className={estilos.situacion}>{pregunta.situacion}</p>}

        <h1 className={estilos.enunciado}>{pregunta.enunciado}</h1>

        {/* Cada formato del banco v3 se responde de una manera distinta, y la
            suya vive en `Formatos.tsx`. Aqui solo se le dice que hay puesto y
            a donde avisar cuando cambie. */}
        <div className={estilos.respuesta}>
          <RespuestaDeLaPregunta
            pregunta={pregunta}
            detalle={detalleDeEsta}
            opcionElegida={opcionElegida ?? null}
            texto={texto}
            onDetalle={(valor) => cambiarDetalle(pregunta, valor)}
            onOpcion={(opcionId) => elegirOpcion(pregunta.id, opcionId)}
            onTexto={(nuevo) => setBorrador({ preguntaId: pregunta.id, texto: nuevo })}
          />
        </div>

        {error && (
          <p className={`${estilos.aviso} ${estilos.malo}`} role="alert">
            <span>{error}</span>
          </p>
        )}

        <div className={estilos.pie}>
          <span
            className={`${estilos.estadoRespuesta}${
              indicador.pendiente ? ` ${estilos.pendiente}` : ''
            }`}
          >
            {indicador.texto}
          </span>
          <div className={estilos.pasos}>
            <button
              type="button"
              className={estilos.anterior}
              onClick={() => navegarA(indice - 1)}
              disabled={indice === 0}
            >
              Anterior
            </button>
            {esUltima ? (
              <button
                type="button"
                className={estilos.siguiente}
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
              <button
                type="button"
                className={estilos.siguiente}
                onClick={() => navegarA(indice + 1)}
              >
                Siguiente
              </button>
            )}
          </div>
        </div>
      </article>

      <Modal
        abierto={confirmarEntrega}
        titulo="Entregar evaluación"
        onCerrar={() => setConfirmarEntrega(false)}
        pie={
          <>
            <button type="button" className={estilos.seguir} onClick={() => setConfirmarEntrega(false)}>
              Seguir revisando
            </button>
            <button
              type="button"
              className={estilos.confirmarEntrega}
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
          <p className={`${estilos.aviso} ${estilos.malo}`}>
            <span>
              <b>
                Espera: {sinConfirmar.length === 1 ? 'una respuesta' : `${sinConfirmar.length} respuestas`} aún no
                {sinConfirmar.length === 1 ? ' ha llegado' : ' han llegado'} al servidor.
              </b>{' '}
              Estamos reintentándolo. Si entregas ahora se quedarían fuera. En cuanto se
              guarden, este aviso desaparece y podrás entregar.{' '}
              <button className={estilos.enlaceAviso} type="button" onClick={mandarPendientes}>
                Reintentar ahora
              </button>
            </span>
          </p>
        ) : faltan > 0 ? (
          <p className={`${estilos.aviso} ${estilos.malo}`}>
            <span>
              <b>
                {faltan === 1
                  ? 'Falta 1 pregunta por responder.'
                  : `Faltan ${faltan} preguntas por responder.`}
              </b>{' '}
              No se puede entregar una evaluación incompleta: el servidor la rechaza hasta
              que estén todas. Si alguna no se deja guardar, escríbenos antes de que venza el
              plazo.{' '}
              {primeraSinResponder >= 0 && (
                <button
                  className={estilos.enlaceAviso}
                  type="button"
                  onClick={() => {
                    setConfirmarEntrega(false)
                    // Un salto, no una navegacion: desde ahi se puede volver.
                    saltarA(primeraSinResponder)
                  }}
                >
                  Ir a la primera sin responder
                </button>
              )}
            </span>
          </p>
        ) : (
          <p className={estilos.aviso}>
            <span>
              <b>Respondiste las {evaluacion.total} preguntas</b>. Después de entregar ya no
              podrás modificar tus respuestas.
            </span>
          </p>
        )}
        {entrega.isError && (
          <p className={`${estilos.aviso} ${estilos.malo}`} role="alert">
            <span>
              {entrega.error instanceof Error ? entrega.error.message : 'No pudimos entregar.'}
            </span>
          </p>
        )}
      </Modal>
    </div>
  )
}
