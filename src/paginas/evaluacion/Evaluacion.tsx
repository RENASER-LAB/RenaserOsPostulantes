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
import type { DetalleRespuesta, EvaluacionCandidato, PreguntaEvaluacion } from '@/api/tipos'
import { diasHasta, formatearTiempo, segundosHasta } from '@/dominio/reloj'
import { rutas } from '@/rutas'
import { useAviso } from '@/ui/Avisos'
import { Modal } from '@/ui/Modal'
import { RespuestaDeLaPregunta } from './Formatos'
import { useColaDeRespuestas } from './useColaDeRespuestas'
import estilos from './Evaluacion.module.css'
import {
  detalleParaEnviar,
  estaCompleto,
  estadoDePregunta,
  normalizarDetalle,
  queFalta,
  siguienteIncompleta,
  type EstadoDePregunta,
} from './bancoV3'

/**
 * La frontera entre «te queda plazo» y «se te acaba», en segundos.
 *
 * La cruza el candidato una sola vez y cambia las dos cosas a la vez: por encima se le
 * enseñan los dias que le quedan en la linea de servicio; por debajo, esos dias sobran y lo
 * que aparece es la cuenta atras del aviso. Es un solo numero porque es una sola decision:
 * dos constantes que se desincronicen dejarian un hueco sin reloj o los dos a la vez.
 */
const UNA_HORA = 3600
/**
 * Lo que el backend acepta como maximo en una respuesta escrita: el `@Size` del
 * record `Responder`. Si se pasa, el guardado rebota con un 400 y la respuesta
 * no llega, asi que aqui se corta antes y se avisa al acercarse.
 */
export const MAXIMO_DEL_TEXTO = 20_000

/**
 * Lo que falta por confirmar de una pregunta: el texto, la opcion, o el detalle
 * de los formatos del banco v3 —que llevan varias cosas a la vez—.
 */
interface Pendiente {
  texto?: string
  opcionId?: number
  detalle?: DetalleRespuesta
  /**
   * Cuanto tardo en responderla, medido al encolar y no al mandar.
   *
   * Con reintentos que se van separando, medirlo al mandar convertia un corte de red de
   * cuatro minutos en «tardo cuatro minutos en pensar esta pregunta», y de ahi sale un dato
   * que despues alguien lee como si dijera algo del candidato.
   */
  segundos?: number
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
  const [confirmarEntrega, setConfirmarEntrega] = useState(false)
  const [guardandoAntesDeEntregar, setGuardandoAntesDeEntregar] = useState(false)
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
    /*
      **Si se recarga al volver a la pestaña**, y es una decision entre dos males.

      Apagarlo evitaba un parpadeo: una recarga puede haber arrancado antes de un guardado y
      aterrizar despues, y entonces pisa lo confirmado con una foto anterior y la pregunta
      sale sin responder por un momento.

      Pero apagarlo abria algo peor. **Dos pestañas del mismo examen** —o el telefono y el
      portatil— dejaban de enterarse la una de la otra: la vieja seguia enseñando su version
      con el pie diciendo «Respuesta guardada», y en cuanto alguien tocaba ahi **pisaba en
      silencio lo que se habia escrito en la otra**. Eso es perder trabajo del candidato; el
      parpadeo solo es feo, no se pierde nada —lo que aun no ha llegado sigue en la cola, que
      manda sobre lo que el servidor cree— y se corrige en la siguiente recarga.

      Entre perder respuestas y parpadear, parpadea.
    */
    refetchOnWindowFocus: true,
  })

  const preguntas = useMemo(() => consulta.data?.preguntas ?? [], [consulta.data])
  const pregunta = preguntas[indice]

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
      texto: cola.pendienteDe(pregunta.id)?.texto ?? pregunta.respuestaTexto ?? '',
    })
    abiertaEn.current = Date.now()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo el id: si dependiera del
    // texto guardado, una recarga en segundo plano pisaria lo que se esta escribiendo.
  }, [pregunta?.id])

  /**
   * Manda una respuesta y **resuelve solo cuando el servidor la acepta**.
   *
   * Que un rechazo sea una promesa rota es lo que hace que la cola lo reintente en vez de
   * darlo por guardado. Por eso `mutateAsync` y no `mutate`.
   */
  const guardar = useMutation({
    mutationFn: (datos: { preguntaId: number } & Pendiente) =>
      responderEvaluacion(uuid, datos.preguntaId, {
        opcionId: datos.opcionId,
        texto: datos.texto,
        detalle: datos.detalle,
        segundos: datos.segundos,
      }),
  })

  const mandarAlServidor = useCallback(
    async (preguntaId: number, valor: Pendiente) => {
      await guardar.mutateAsync({ preguntaId, ...valor })
      // Lo confirmado se escribe en la copia local en vez de volver a pedir el examen
      // entero. Antes, cada guardado disparaba una recarga de las sesenta preguntas: con un
      // candidato escribiendo deprisa eso son decenas de peticiones compitiendo entre si, y
      // mientras llegaban la pantalla se ponia a pensar justo cuando el se movia.
      //
      // Lo que se escribe aqui es **exactamente lo que el servidor acaba de guardar**: el
      // backend sobreescribe los tres campos con lo que le mandaron, asi que dejar los otros
      // dos en nulo no es una simplificacion, es lo que hay en la base.
      cache.setQueryData<EvaluacionCandidato>(['evaluacion', uuid], (previo) => {
        if (previo === undefined) return previo
        const antes = previo.preguntas.find((p) => p.id === preguntaId)
        if (antes === undefined) return previo
        const ahora: PreguntaEvaluacion = {
          ...antes,
          // Un texto en blanco es una respuesta borrada, no un texto vacio guardado: el
          // servidor tampoco deja fila.
          respuestaTexto: valor.texto?.trim() ? valor.texto : null,
          respuestaOpcionId: valor.opcionId ?? null,
          respuestaDetalle: valor.detalle ?? null,
        }
        const eraRespuesta = estadoDePregunta(antes) === 'lista'
        const esRespuesta = estadoDePregunta(ahora) === 'lista'
        return {
          ...previo,
          preguntas: previo.preguntas.map((p) => (p.id === preguntaId ? ahora : p)),
          // La cabecera tambien cuenta. La pantalla saca su contador de `estados`, asi que
          // aqui no se nota, pero dejar `respondidas` congelado toda la sesion es un numero
          // que miente esperando a que alguien lo lea.
          respondidas: Math.max(
            0,
            previo.respondidas + (esRespuesta ? 1 : 0) - (eraRespuesta ? 1 : 0),
          ),
        }
      })
    },
    [guardar.mutateAsync, cache, uuid],
  )

  /**
   * Si lo confirmado sigue siendo lo que hay puesto.
   *
   * ⚠️ **`segundos` no cuenta.** Es un dato de telemetria, no parte de la respuesta: si
   * entrara en la comparacion, un reintento con otro cronometro parecería una respuesta
   * distinta y la cola no se vaciaria nunca.
   */
  const loMismo = useCallback(
    (enCola: Pendiente, confirmado: Pendiente) =>
      enCola.texto === confirmado.texto &&
      enCola.opcionId === confirmado.opcionId &&
      // El detalle se compara por identidad: cada cambio crea un objeto nuevo, asi que si el
      // candidato lo toco mientras la peticion viajaba, el de la cola ya no es este.
      enCola.detalle === confirmado.detalle,
    [],
  )

  // La clave lleva el uuid: dos procesos abiertos en la misma maquina no pueden pisarse lo
  // pendiente el uno al otro.
  const cola = useColaDeRespuestas<Pendiente>(
    mandarAlServidor,
    loMismo,
    uuid === '' ? undefined : `renaser_evaluacion_pendiente_${uuid}`,
  )
  const sinConfirmar = cola.sinConfirmar

  /** Cuanto lleva abierta la pregunta, para mandarlo junto a la respuesta. */
  const segundosAqui = useCallback(
    () => Math.round((Date.now() - abiertaEn.current) / 1000),
    [],
  )

  // Lo confirmado por el servidor se refleja en la pantalla, pero **sin recargar en cada
  // guardado**: pedir las sesenta preguntas otra vez por cada tecla llenaba la red de
  // peticiones y, mientras llegaban, la pagina se quedaba pensando. La pantalla ya sabe lo
  // que mando —lo tiene en la cola— y el servidor se vuelve a leer al entrar y al entregar.

  const inicio = useMutation({
    mutationFn: () => iniciarEvaluacion(uuid),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ['evaluacion', uuid] })
    },
  })

  const entrega = useMutation({
    // ⚠️ **Primero se vacia la cola.** Entregar con algo sin confirmar es entregar sin esa
    // respuesta, y el backend ademas rechaza la entrega si falta alguna. Antes esto se
    // resolvia con un cartel rojo que bloqueaba el boton y dejaba al candidato esperando a
    // que un aviso desapareciera solo; ahora simplemente se manda lo que queda y se espera.
    mutationFn: async () => {
      // Si no se consigue —servidor caido, red que no vuelve—, se para aqui y se dice. El
      // backend rechaza la entrega si falta alguna respuesta **nueva**, pero una respuesta
      // **corregida** que no llego se entregaria con el texto viejo y nadie se enteraria.
      // Este mensaje sale dentro del modal, despues de que el candidato pulse: no es un
      // cartel que aparezca solo ni que mueva nada de sitio.
      if (!(await cola.vaciar())) {
        throw new Error(
          'No pudimos guardar todo lo que escribiste. Revisa tu conexión e inténtalo otra vez: ' +
            'entregar ahora dejaría fuera lo último que corregiste.',
        )
      }
      return entregarEvaluacion(uuid)
    },
    onSuccess: async () => {
      setConfirmarEntrega(false)
      await cache.invalidateQueries({ queryKey: ['postulaciones'] })
      await cache.invalidateQueries({ queryKey: ['postulacion', uuid] })
      avisar('Evaluación entregada. Te avisaremos cuando avance.')
      navegar(rutas.proceso(uuid), { replace: true })
    },
  })

  /**
   * Lo que el candidato escribe, puesto a salvo **en el mismo turno que la tecla**.
   *
   * ⚠️ **Esto no puede volver a ser un efecto.** Ahi estaba la perdida que reportaban los
   * que iban rapido: React agenda los efectos, asi que entre la ultima tecla y el efecto que
   * la habria encolado cabe un clic en «Siguiente». Cuando por fin corria, el borrador ya era
   * de otra pregunta, el efecto se iba sin hacer nada y ese texto no llegaba a existir para
   * nadie: ni se mandaba, ni se reintentaba, ni aparecia en la cuenta de lo que faltaba.
   *
   * Encolando aqui, lo escrito esta guardado antes de que nada pueda navegar.
   */
  const escribir = useCallback(
    (laPregunta: PreguntaEvaluacion, nuevo: string) => {
      setBorrador({ preguntaId: laPregunta.id, texto: nuevo })

      // Ya es lo que el servidor tiene: no hay nada que mandar.
      //
      // ⚠️ Salvo que haya una peticion de esta pregunta **viajando**: esa lleva lo de en
      // medio, y borrarla de la cola dejaria ese valor intermedio guardado en el servidor
      // mientras la pantalla enseña el original. Encolando lo del servidor, el ultimo en
      // escribir vuelve a ser el que manda y las dos versiones acaban diciendo lo mismo.
      if (nuevo === (laPregunta.respuestaTexto ?? '')) {
        if (cola.estaViajando(laPregunta.id)) {
          cola.encolar(laPregunta.id, { texto: nuevo, segundos: segundosAqui() })
        } else {
          cola.olvidar(laPregunta.id)
        }
        return
      }

      // Un `V` a medias no se manda, igual que los formatos con detalle: son varios datos en
      // una sola cadena, y mandarla con la mitad dejaria guardada una respuesta incompleta
      // que despues nadie sabria distinguir de una entera. Se queda en la pantalla —se ve, no
      // se pierde— hasta que el candidato la termina.
      //
      // Vaciarlo del todo si es mandable: borrar lo escrito es dejar la pregunta sin
      // responder, y el servidor lo entiende asi. Lo que no vale es la mitad.
      if (nuevo.trim() !== '' && queFalta(laPregunta, undefined, nuevo) !== null) {
        cola.olvidar(laPregunta.id)
        return
      }

      cola.encolar(laPregunta.id, { texto: nuevo, segundos: segundosAqui() })
    },
    [cola.encolar, cola.olvidar, segundosAqui],
  )

  /** Manda ya todo lo que no ha confirmado el servidor, sin esperar. */
  const mandarPendientes = cola.mandarYa

  /**
   * Las opciones no esperan al temporizador: se manda al momento. Pero pasan por
   * la cola igual que el texto, para que un rechazo no se pierda y se reintente.
   */
  const elegirOpcion = useCallback(
    (preguntaId: number, opcionId: number) => {
      cola.encolar(preguntaId, { opcionId, segundos: segundosAqui() }, { yaMismo: true })
    },
    [cola.encolar, segundosAqui],
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
      // Los de escribir esperan a que pare la mano; los de marcar salen ya.
      cola.encolar(
        preguntaDelDetalle.id,
        { detalle: listo, segundos: segundosAqui() },
        { yaMismo: preguntaDelDetalle.tipo !== 'CD' },
      )
    },
    [cola.encolar, segundosAqui],
  )

  const irA = useCallback(
    (siguiente: number) => {
      mandarPendientes()
      setIndice(Math.max(0, Math.min(preguntas.length - 1, siguiente)))
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
            Son preguntas sobre cómo trabajas, no sobre lo que memorizaste. Van de una en
            una, no hay respuestas de manual, y nadie las responde de una sentada.
          </p>

          <div className={estilos.datos}>
            {/*
              ⚠️ **Antes de empezar, `total` es cero y no significa «cero».**

              El backend arma el orden de preguntas dentro de `iniciar()`, asi que
              hasta entonces no hay filas que contar y `pintar()` devuelve 0 con el
              comentario «Todavia no ha empezado: no hay preguntas que enseñar»
              (`ServicioEvaluacionImpl.java:377`). Y la portada es, por definicion,
              el estado de antes de empezar: **todo candidato leia «0 preguntas»**.

              Un cero que en realidad quiere decir «todavia no lo se» es la regla del
              indicador honesto rota. Los otros dos datos ya se guardaban de su nulo;
              este no. Cuando el backend sepa decir cuantas seran sin tener que
              armarlas, vuelve solo.
            */}
            {evaluacion.total > 0 && (
              <div className={estilos.dato}>
                <span className={estilos.cifra}>{evaluacion.total}</span>
                <span className={estilos.queEs}>preguntas, una por pantalla</span>
              </div>
            )}
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
  //
  // Es lo unico que dice como va el guardado, ahora que no hay cartel: por eso «Guardando…»
  // cubre tanto lo que esta viajando como lo que espera turno o se esta reintentando. Para
  // quien responde es el mismo estado —todavia no esta— y partirlo en dos solo serviria para
  // parpadear.
  const indicador = cola.atascadas.includes(pregunta.id)
    ? { texto: 'No se pudo guardar', pendiente: true }
    : esteSinConfirmar
    ? { texto: 'Guardando…', pendiente: true }
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

          {/*
            El plazo, mientras se responde.

            Estaba solo en la portada. Entre esa pantalla y el aviso de la ultima hora hay
            **dos semanas** de plazo por defecto, y en todo ese tramo el candidato no volvia
            a ver cuanto le quedaba: para saberlo tenia que salir de la evaluacion. Va en la
            linea de servicio y no en un aviso, por lo mismo que dice el comentario de abajo
            —esto se mira de reojo, no interrumpe—.

            ⚠️ **Desaparece por debajo de la hora**, que es justo cuando aparece el aviso de
            «Queda poco plazo» con su cuenta atras. Dos relojes a la vez, uno diciendo «hoy»
            y el otro `00:42:17`, se leen peor que el segundo solo. Y de paso, ese corte deja
            fuera los dos textos de `diasHasta` que aqui no encajan: «vencida» y «sin plazo».
          */}
          {restante !== null && restante >= UNA_HORA && (
            <time className={estilos.plazo} dateTime={evaluacion.venceEn ?? undefined}>
              {diasHasta(evaluacion.venceEn) === 'hoy'
                ? 'Se entrega hoy'
                : `${diasHasta(evaluacion.venceEn)} para entregarla`}
            </time>
          )}
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
      {/*
        El mapa y la pregunta, uno al lado del otro en escritorio.

        Abierto empujaba la pregunta fuera de la vista, que es justo lo
        contrario de para que sirve: ver donde estas sin perder donde estabas.
        Con la columna, se abre en el hueco que sobraba a la derecha y la
        pregunta no se mueve. Por debajo de 1100 px vuelve a ir encima, que en
        un telefono es lo unico que cabe.

        La columna es `auto`: con el mapa cerrado se encoge a cero y la
        pregunta ocupa el ancho entero.
      */}
      <div className={estilos.conMapa}>
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

        {/*
          ⚠️ **Aqui no va ningun aviso de «respuestas sin guardar», y es a proposito.**

          Hubo uno, rojo, y hacia dos daños. El de forma: estos hijos de `.conMapa` son
          casillas de una rejilla de dos columnas donde solo el mapa y la pregunta tienen
          `order`, asi que el cartel se colaba en la columna del mapa y descuadraba la
          pantalla entera al aparecer. Y el de fondo: le contaba al candidato una averia
          nuestra, en mitad de su examen, sin darle nada que hacer con ella salvo asustarse.

          Lo que el candidato necesita saber cabe en la linea del pie de la pregunta
          —«Guardando…», «Respuesta guardada»—, que no empuja nada. Lo demas es trabajo de la
          cola: reintentar sola con espera creciente, apuntar lo pendiente en el navegador por
          si se cierra la pestaña, y vaciarse antes de entregar.
        */}
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

        {restante !== null && restante < UNA_HORA && (
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
              onTexto={(nuevo) => escribir(pregunta, nuevo)}
            />
          </div>

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
                  disabled={guardandoAntesDeEntregar}
                  onClick={() => {
                    // Lo pendiente se manda **y se espera** antes de abrir el modal. Si no,
                    // la respuesta de la ultima pregunta se quedaba fuera y el modal abria
                    // contando mal lo que faltaba.
                    setGuardandoAntesDeEntregar(true)
                    void cola.vaciar().finally(() => {
                      setGuardandoAntesDeEntregar(false)
                      setConfirmarEntrega(true)
                    })
                  }}
                >
                  {guardandoAntesDeEntregar ? 'Guardando…' : 'Entregar evaluación'}
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
      </div>

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
              // Solo por preguntas sin responder. Lo que aun no ha llegado al servidor ya no
              // bloquea nada: la propia entrega vacia la cola antes de mandar nada.
              disabled={entrega.isPending || faltan > 0}
            >
              {entrega.isPending ? 'Entregando…' : 'Entregar'}
            </button>
          </>
        }
      >
        {faltan > 0 ? (
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
