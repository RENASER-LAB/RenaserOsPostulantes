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
 * - **Lo escrito no sale de la cola hasta que el servidor lo confirma**, se reintenta solo
 *   con espera creciente, y la entrega vacía la cola antes de mandar nada. Lo que no se hace
 *   es colgar un cartel de «quedan N sin guardar» en mitad de la prueba: es una avería
 *   nuestra contada a quien no puede hacer nada con ella, y lo que sí necesita saber cabe en
 *   la línea de debajo del recuadro.
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
import type { EvaluacionCandidato, PreguntaEvaluacion } from '@/api/tipos'
import { usePantallaAbierta } from '@/paginas/procesos/useVacanteRetirada'
import { rutas } from '@/rutas'
import { useAviso } from '@/ui/Avisos'
import { Cronometro } from '@/ui/Cronometro'
import { Cargando, Fallo, VacanteRetirada } from '@/ui/Mensajes'
import { Modal } from '@/ui/Modal'
import { useColaDeRespuestas } from '../evaluacion/useColaDeRespuestas'
import estilos from './CuestionarioTecnico.module.css'

/** Lo que el backend acepta por respuesta aquí: texto y nada más. */
interface Pendiente {
  texto: string
  /**
   * Cuánto tardó en responderla, medido al encolar y no al mandar: con reintentos que se van
   * separando, un corte de red de cuatro minutos se convertiría en «tardó cuatro minutos en
   * pensarla», y eso alguien lo lee después como si dijera algo del candidato.
   */
  segundos: number
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
  // Se guarda la causa y no solo el texto: un 404 no se enseña mientras se comprueba si es
  // la vacante retirada, que la pantalla entera dice mejor que el texto del servidor.
  const [fallo, setFallo] = useState<{ causa: unknown; texto: string } | null>(null)
  const [confirmarEntrega, setConfirmarEntrega] = useState(false)
  const abiertaEn = useRef<number>(Date.now())

  const consulta = useQuery({
    queryKey: ['cuestionario-tecnico', uuid],
    queryFn: () => verCuestionarioTecnico(uuid),
    enabled: uuid !== '',
    // Se recarga al volver a la pestaña, por lo mismo que la evaluación: sin ella, dos
    // pestañas del mismo examen se pisan en silencio. Lo que la hace segura es que `mandar`
    // cancela cualquier recarga en vuelo antes de escribir lo confirmado.
    refetchOnWindowFocus: true,
  })

  // Un 404 aquí puede ser que la empresa retiró la vacante: lo dice su proceso. Y si la
  // retira con la prueba abierta, quien se entera es el botón —empezar, cada respuesta,
  // entregar—: todos pasan su fallo por `siSeCerroLaPuerta`. Ver `usePantallaAbierta`.
  const { retirada, siSeCerroLaPuerta, seEnsena } = usePantallaAbierta(
    uuid,
    ['cuestionario-tecnico', uuid],
    consulta,
  )
  const error = fallo !== null && seEnsena(fallo.causa) ? fallo.texto : null

  const preguntas = useMemo(() => consulta.data?.preguntas ?? [], [consulta.data])
  const pregunta: PreguntaEvaluacion | undefined = preguntas[indice]

  /**
   * Manda una respuesta y **resuelve solo cuando el servidor la acepta**: que un rechazo sea
   * una promesa rota es lo que hace que la cola lo reintente en vez de darlo por guardado.
   */
  const guardar = useMutation({
    mutationFn: (datos: { preguntaId: number; texto: string; segundos: number }) =>
      responderCuestionarioTecnico(uuid, datos.preguntaId, {
        texto: datos.texto,
        segundos: datos.segundos,
      }),
    // La cola ya da por atascada una respuesta con 404; esto es para que la pantalla diga
    // por qué, si es que la vacante se retiró.
    onError: siSeCerroLaPuerta,
  })

  const mandar = useCallback(
    async (preguntaId: number, valor: Pendiente) => {
      await guardar.mutateAsync({ preguntaId, texto: valor.texto, segundos: valor.segundos })
      // Primero se cancela lo que esté viajando: una recarga que arrancó antes de este
      // guardado trae una foto sin esta respuesta, y si aterriza después pisa lo confirmado y
      // se queda así. Ver el comentario largo en `Evaluacion.tsx`.
      await cache.cancelQueries({ queryKey: ['cuestionario-tecnico', uuid] })
      // Lo confirmado se escribe en la copia local en vez de volver a pedir la prueba entera
      // en cada guardado. Con alguien escribiendo deprisa, aquello eran decenas de peticiones
      // compitiendo, y la pantalla se ponía a pensar justo cuando él se movía.
      cache.setQueryData<EvaluacionCandidato>(
        ['cuestionario-tecnico', uuid],
        (previo) => {
          if (previo === undefined) return previo
          const antes = previo.preguntas.find((p) => p.id === preguntaId)
          const eraRespuesta = (antes?.respuestaTexto ?? '').trim() !== ''
          // Vaciar el recuadro es dejarla sin responder, y el servidor borra la fila: la
          // cuenta de respondidas tiene que bajar igual que sube.
          const esRespuesta = valor.texto.trim() !== ''
          return {
            ...previo,
            respondidas:
              previo.respondidas + (esRespuesta ? 1 : 0) - (eraRespuesta ? 1 : 0),
            preguntas: previo.preguntas.map((p) =>
              p.id === preguntaId
                ? { ...p, respuestaTexto: esRespuesta ? valor.texto : null }
                : p,
            ),
          }
        },
      )
    },
    [guardar.mutateAsync, cache, uuid],
  )
  /**
   * ⚠️ `segundos` no entra en la comparación: es telemetría, no parte de la respuesta. Si
   * entrara, un reintento con otro cronómetro parecería una respuesta distinta y la cola no
   * se vaciaría nunca.
   */
  const loMismo = useCallback(
    (enCola: Pendiente, confirmado: Pendiente) => enCola.texto === confirmado.texto,
    [],
  )
  // La clave lleva el uuid: lo pendiente sobrevive a cerrar la pestaña, y dos procesos
  // abiertos en la misma máquina no se pisan.
  const cola = useColaDeRespuestas<Pendiente>(
    mandar,
    loMismo,
    uuid === '' ? undefined : `renaser_tecnica_pendiente_${uuid}`,
  )

  const inicio = useMutation({
    mutationFn: () => iniciarCuestionarioTecnico(uuid),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ['cuestionario-tecnico', uuid] })
    },
    onError: (causa) => {
      siSeCerroLaPuerta(causa)
      setFallo({
        causa,
        texto: causa instanceof Error ? causa.message : 'No pudimos abrir tu cuestionario.',
      })
    },
  })

  const entrega = useMutation({
    // Primero se vacía la cola: entregar con algo sin confirmar es entregar sin esa
    // respuesta, y el backend rechaza la entrega si falta alguna.
    mutationFn: async () => {
      // Si no se consigue, se para y se dice: una respuesta corregida que no llegó se
      // entregaría con el texto viejo y nadie se enteraría.
      if (!(await cola.vaciar())) {
        throw new Error(
          'No pudimos guardar todo lo que escribiste. Revisa tu conexión e inténtalo otra vez.',
        )
      }
      return entregarCuestionarioTecnico(uuid)
    },
    onSuccess: async () => {
      setConfirmarEntrega(false)
      await cache.invalidateQueries({ queryKey: ['postulaciones'] })
      await cache.invalidateQueries({ queryKey: ['postulacion', uuid] })
      avisar('Prueba técnica entregada. Te avisaremos cuando avance.')
      navegar(rutas.proceso(uuid), { replace: true })
    },
    onError: (causa) => {
      setConfirmarEntrega(false)
      siSeCerroLaPuerta(causa)
      setFallo({
        causa,
        texto: causa instanceof Error ? causa.message : 'No pudimos entregar tu prueba.',
      })
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo el id: si dependiera del
    // texto guardado, una recarga en segundo plano pisaría lo que se está escribiendo.
  }, [pregunta?.id])

  /**
   * Lo que el candidato escribe, puesto a salvo **en el mismo turno que la tecla**.
   *
   * ⚠️ **Esto no puede volver a ser un efecto.** React los agenda, así que entre la última
   * tecla y el efecto que la habría encolado cabe un clic en «Siguiente»; cuando por fin
   * corría, el borrador ya era de otra pregunta y se iba sin hacer nada. Ese texto no llegaba
   * a existir para nadie: ni se mandaba, ni se reintentaba, ni se contaba como pendiente.
   */
  const escribir = useCallback(
    (laPregunta: PreguntaEvaluacion, nuevo: string) => {
      setBorrador({ preguntaId: laPregunta.id, texto: nuevo })
      if (nuevo === (laPregunta.respuestaTexto ?? '')) {
        cola.olvidar(laPregunta.id)
        return
      }
      cola.encolar(laPregunta.id, {
        texto: nuevo,
        segundos: Math.round((Date.now() - abiertaEn.current) / 1000),
      })
    },
    [cola.encolar, cola.olvidar],
  )

  /** Cambiar de pregunta manda lo pendiente: no hay por qué esperar al temporizador. */
  const irA = useCallback(
    (siguiente: number) => {
      cola.mandarYa()
      setIndice(Math.max(0, Math.min(preguntas.length - 1, siguiente)))
    },
    [cola.mandarYa, preguntas.length],
  )

  if (consulta.isPending || (consulta.isError && retirada === 'comprobando')) {
    return <Cargando que="Abriendo tu prueba técnica…" />
  }
  if (consulta.isError && retirada === 'retirada') return <VacanteRetirada />
  if (consulta.isError) {
    return <Fallo error={consulta.error} reintentar={() => consulta.refetch()} />
  }

  const cuestionario = consulta.data
  const sinEmpezar = cuestionario.iniciadaEn === null
  const entregado = cuestionario.estado === 'TERMINADA'
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
            /* La frase del umbral se ve: el color solo no es una señal. */
            classNameAviso={estilos.avisoDelReloj}
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
              value={
                borrador.preguntaId === pregunta.id
                  ? borrador.texto
                  : (pregunta.respuestaTexto ?? '')
              }
              onChange={(e) => escribir(pregunta, e.target.value)}
              rows={10}
              maxLength={20_000}
              placeholder="Cuenta un caso concreto: qué pasó, qué hiciste tú, con qué cifras."
            />
          </label>
          <p className={estilos.pista}>
            {cola.atascadas.includes(pregunta.id)
              ? 'No se pudo guardar. Revisa tu conexión y vuelve a escribirla.'
              : cola.sinConfirmar.some((p) => p.id === pregunta.id)
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
          onClick={() => irA(indice - 1)}
          disabled={indice === 0}
          data-rotulo="← Anterior"
        >
          ← Anterior
        </button>
        <button
          className={estilos.secundario}
          type="button"
          onClick={() => irA(indice + 1)}
          disabled={indice >= preguntas.length - 1}
          data-rotulo="Siguiente →"
        >
          Siguiente →
        </button>
      </nav>

      {error && (
        <p className={estilos.error} role="alert">
          {error}
        </p>
      )}

      {/*
        ⚠️ **Aquí no va ningún cartel de «respuestas sin guardar», y es a propósito.** Le
        contaba una avería nuestra a quien está en mitad de su prueba y no puede hacer nada
        con ella. Lo que sí necesita saber está en la línea de debajo del recuadro
        —«Guardando lo que escribiste…», «Guardada»—, que no mueve nada de sitio. Del resto se
        ocupa la cola: reintenta sola, apunta lo pendiente por si se cierra la pestaña, y se
        vacía antes de entregar.
      */}
      <div className={estilos.entrega}>
        <button
          className={estilos.entregar}
          type="button"
          onClick={() => setConfirmarEntrega(true)}
          disabled={faltan > 0 || entrega.isPending}
          data-rotulo="Entregar"
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
              data-rotulo={entrega.isPending ? 'Entregando…' : 'Sí, entregar'}
            >
              {entrega.isPending ? 'Entregando…' : 'Sí, entregar'}
            </button>
            <button
              className={estilos.secundario}
              type="button"
              onClick={() => setConfirmarEntrega(false)}
              data-rotulo="Mejor no"
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
