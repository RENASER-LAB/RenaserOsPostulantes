/**
 * La prueba del puesto.
 *
 * Cuatro cosas que la separan del mockup:
 *
 *   - **El cronometro es del servidor.** Sale de `venceEn`, no de la hora del
 *     navegador. Cambiar la hora del equipo no lo mueve.
 *   - **Los entregables son una lista.** Cada uno con su nombre, su formato, si
 *     es obligatorio y si ya se subio. El mockup tenia un archivo y un enlace
 *     sueltos, y los enseñaba siempre los dos.
 *   - **Tambien hay preguntas.** El backend las manda y el mockup las ignoraba.
 *   - **La consigna es texto libre.** Llega con sus parrafos y con la direccion
 *     del PDF de la prueba escrita dentro, asi que no se pinta a pelo: la pinta
 *     `ui/TextoPlano`.
 *
 * El cambio inesperado no lo dispara el navegador: llega en `cambioTexto`
 * cuando al backend le toca enseñarlo, y por eso se vuelve a consultar cada
 * poco mientras la prueba esta en curso.
 *
 * **La prueba escrita en el editor de la vacante (V67, `delEditor`)** trae
 * además cerradas —opción única, múltiple y escala— y no se entrega con
 * huecos: «Entregar» dice cuáles faltan y lleva a la primera, y el servidor lo
 * rechaza igual si alguien llama a la API. Si el tiempo vence con algo sin
 * responder, queda «sin completar». Desde la V68 es una sola prueba (sin
 * «cuestionario»). **En curso va de una pregunta por pantalla** desde el
 * 09/10/2026, con el mismo marco que la evaluación: eso vive en
 * `PruebaDelEditor.tsx`. Aquí quedan el diálogo de empezar, las cerradas y la prueba
 * de plantilla en curso, que sigue toda en vertical como siempre.
 *
 * **Antes de empezar, las dos van en la misma ficha corta** (`FichaPrevia.tsx`, 10/10/2026):
 * el tiempo, la fecha límite, cuántas preguntas son, qué archivos habrá que entregar y las
 * herramientas. El caso, los materiales y las preguntas no llegan del servidor hasta que se
 * empieza: se leen dentro del reloj.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { entregarPrueba, iniciarPrueba, responderPrueba, verPrueba } from '@/api/prueba'
import type { FechaIso, MiPrueba } from '@/api/tipos'
import { formatearFechaLarga, segundosHasta } from '@/dominio/reloj'
import { usePantallaAbierta } from '@/paginas/procesos/useVacanteRetirada'
import { rutas } from '@/rutas'
import { useAviso } from '@/ui/Avisos'
import { Cronometro } from '@/ui/Cronometro'
import { VacanteRetirada } from '@/ui/Mensajes'
import { Modal } from '@/ui/Modal'
import { TextoPlano } from '@/ui/TextoPlano'
import { Consigna, Entregable } from './Entregable'
import { FichaPrevia } from './FichaPrevia'
import { avisoDeEmpezar, entradillaDe } from './loQueDiceLaPrevia'
import { PruebaDelEditor } from './PruebaDelEditor'
import estilos from './Prueba.module.css'

const ESPERA_ANTES_DE_GUARDAR = 1000
/** El mismo `@Size` del backend que en la evaluacion. */
const MAXIMO_DEL_TEXTO = 20_000
/** Cada cuanto se vuelve a intentar lo que no llego al servidor. */
const ESPERA_ANTES_DE_REINTENTAR = 5000
const CADA_20_SEGUNDOS = 20_000
const CADA_5_SEGUNDOS = 5_000

// ---------- El tiempo agotado ----------

/**
 * Si el plazo del servidor ya paso.
 *
 * Hace falta preguntarlo aqui porque el backend no lo dice: mientras nadie
 * cierre el intento sigue devolviendo `EN_CURSO`, aunque `venceEn` sea de hace
 * un rato. Quien lo cierra es un barrido que corre cada minuto, asi que hay
 * hasta un minuto en el que la pantalla creeria que se puede seguir escribiendo
 * y cada guardado volveria con un error que nadie entiende.
 */
function useTiempoAgotado(venceEn: FechaIso | null, enCurso: boolean): boolean {
  // Se calcula ya en el primer pintado, no en el efecto: si no, quien abre la
  // pagina con el plazo cumplido ve un instante la prueba como si aun pudiera
  // escribir en ella.
  const [agotado, setAgotado] = useState(
    () => enCurso && venceEn !== null && segundosHasta(venceEn) === 0,
  )

  useEffect(() => {
    if (!enCurso || !venceEn) {
      setAgotado(false)
      return
    }
    const revisar = () => setAgotado(segundosHasta(venceEn) === 0)
    revisar()
    const reloj = window.setInterval(revisar, 1000)
    return () => window.clearInterval(reloj)
  }, [venceEn, enCurso])

  return agotado
}

// ---------- Una pregunta de la prueba ----------

/**
 * Una pregunta de la prueba, con el mismo trato que las de la evaluacion: lo
 * escrito no se da por guardado hasta que el servidor lo confirma.
 *
 * Antes este efecto cancelaba el envio en su limpieza. Al entregar la prueba el
 * componente se desmonta, asi que lo ultimo escrito se cancelaba justo cuando
 * mas falta hacia. Y si el guardado fallaba, nadie reintentaba ni lo decia.
 */
function PreguntaPrueba({
  uuid,
  pregunta,
  bloqueado,
  registrarEnvio,
  registrarSiTieneTexto,
  siSeCerroLaPuerta,
}: {
  uuid: string
  pregunta: { id: number; enunciado: string; respuestaTexto: string | null }
  /** Con el tiempo agotado ya no se escribe ni se reintenta nada. */
  bloqueado: boolean
  /**
   * Deja en manos del padre la forma de forzar el envio de esta pregunta y **esperarlo**.
   * Sin esto, entregar solo podia mirar si quedaba algo pendiente y negarse; ahora lo manda.
   */
  registrarEnvio: (preguntaId: number, mandar: (() => Promise<unknown>) | null) => void
  /**
   * Dice si esta pregunta tiene algo escrito ahora mismo.
   *
   * ⚠️ Hace falta desde que vaciar el recuadro **borra de verdad** la respuesta. El servidor
   * deja entregar esta prueba aunque falten preguntas —lo que exige son los entregables—, asi
   * que si nadie cuenta esto, quien borra una respuesta sin querer la entrega sin ella y no se
   * entera nadie. No bloquea: avisa antes de un gesto que no tiene vuelta atras.
   */
  registrarSiTieneTexto: (preguntaId: number, tiene: boolean | null) => void
  /** Un 404 al guardar: la vacante pudo retirarse con la prueba abierta. Ver `usePantallaAbierta`. */
  siSeCerroLaPuerta: (causa: unknown) => boolean
}) {
  const [texto, setTexto] = useState(pregunta.respuestaTexto ?? '')
  const [estado, setEstado] = useState<'limpio' | 'guardando' | 'pendiente'>('limpio')
  const pendiente = useRef<string | null>(null)
  const temporizador = useRef<number | undefined>(undefined)
  /**
   * Lo ultimo que el servidor confirmo de esta pregunta.
   *
   * ⚠️ **Antes esto se leia de `pregunta.respuestaTexto`, que no se refresca nunca**: guardar
   * una respuesta no invalida `['prueba', uuid]`. Con la pregunta llegando sin responder, el
   * candidato escribia algo y lo borraba en la misma sesion, y la comparacion decia
   * `'' === (null ?? '')` → no se mandaba nada: la pantalla en blanco y el texto guardado en
   * el servidor. Recordandolo aqui, la comparacion es contra lo que de verdad hay.
   */
  const cache = useQueryClient()
  const confirmado = useRef(pregunta.respuestaTexto ?? '')
  /** La peticion en curso, para no lanzar dos de la misma pregunta a la vez. */
  const enVuelo = useRef<Promise<unknown> | null>(null)

  // Los reintentos corren desde temporizadores, y un temporizador ve la prop
  // del momento en que se armo. Por eso lo mira por referencia: si no, seguiria
  // mandando durante un minuto contra un servidor que ya responde que no.
  const yaNoSeAdmite = useRef(bloqueado)
  useEffect(() => {
    yaNoSeAdmite.current = bloqueado
  }, [bloqueado])

  const guardar = useMutation({
    mutationFn: (valor: string) => responderPrueba(uuid, pregunta.id, valor),
    onMutate: () => setEstado('guardando'),
    onSuccess: async (_resultado, valor) => {
      // Una recarga de la prueba que arranco **antes** de este guardado trae una foto en la
      // que esta respuesta todavia no existe; si aterriza despues, devuelve el recuadro a lo
      // de antes delante del candidato. Cancelarla no pierde nada: la proxima recarga traera
      // los datos de verdad. Ver el comentario largo en `Evaluacion.tsx`.
      await cache.cancelQueries({ queryKey: ['prueba', uuid] })
      confirmado.current = valor
      // Si siguio escribiendo mientras viajaba, lo nuevo sigue pendiente.
      if (pendiente.current === valor) {
        pendiente.current = null
        setEstado('limpio')
      }
    },
    onError: (causa) => {
      setEstado('pendiente')
      siSeCerroLaPuerta(causa)
    },
  })

  const guardarTexto = guardar.mutateAsync

  const mandarPendiente = useCallback(async () => {
    window.clearTimeout(temporizador.current)
    if (pendiente.current === null || yaNoSeAdmite.current) return
    // ⚠️ Una sola peticion por pregunta a la vez. Dos juntas —al ocultar la pestaña mientras
    // una viaja, o al entregar— chocan contra la clave unica `(intento, pregunta)` que el
    // backend documenta, y el candidato ve un error por una respuesta que si estaba guardada.
    if (enVuelo.current) return enVuelo.current
    // Se traga el rechazo a proposito: quien llama solo quiere saber cuando termino el
    // intento, y de reintentar ya se ocupa el reloj de abajo.
    const viaje = guardarTexto(pendiente.current)
      .catch(() => {})
      .finally(() => {
        enVuelo.current = null
      })
    enVuelo.current = viaje
    return viaje
  }, [guardarTexto])

  /**
   * Lo escrito queda pendiente **en el mismo turno que la tecla**, no en un efecto.
   *
   * ⚠️ React agenda los efectos, asi que entre la ultima tecla y el efecto que la habria
   * anotado cabe un clic en «Entregar». Anotandolo aqui, lo escrito ya cuenta como pendiente
   * antes de que nada pueda pasar, y la entrega lo manda en vez de ignorarlo.
   */
  const escribir = useCallback(
    (nuevo: string) => {
      setTexto(nuevo)
      if (nuevo === confirmado.current) {
        pendiente.current = null
        setEstado('limpio')
        return
      }
      pendiente.current = nuevo
      setEstado('pendiente')
      window.clearTimeout(temporizador.current)
      temporizador.current = window.setTimeout(() => void mandarPendiente(), ESPERA_ANTES_DE_GUARDAR)
    },
    [mandarPendiente],
  )

  // Una recarga de la prueba trae lo que el servidor tiene: pasa a ser lo confirmado.
  useEffect(() => {
    confirmado.current = pregunta.respuestaTexto ?? ''
    if (pendiente.current === null) setTexto(pregunta.respuestaTexto ?? '')
  }, [pregunta.respuestaTexto])

  // Mientras quede algo sin confirmar se sigue intentando solo.
  useEffect(() => {
    if (estado !== 'pendiente' || bloqueado) return
    const reloj = window.setInterval(() => void mandarPendiente(), ESPERA_ANTES_DE_REINTENTAR)
    return () => window.clearInterval(reloj)
  }, [estado, bloqueado, mandarPendiente])

  // Al ocultar la pestaña —cambiar de aplicacion, bloquear el telefono, cerrar— se manda lo
  // que quede. En una prueba con cronometro, esos segundos son los que no se recuperan.
  useEffect(() => {
    const alOcultarse = () => {
      if (document.visibilityState === 'hidden') void mandarPendiente()
    }
    const alIrse = () => void mandarPendiente()
    document.addEventListener('visibilitychange', alOcultarse)
    window.addEventListener('pagehide', alIrse)
    return () => {
      document.removeEventListener('visibilitychange', alOcultarse)
      window.removeEventListener('pagehide', alIrse)
    }
  }, [mandarPendiente])

  // Al desmontarse se manda lo que quede, no se cancela.
  useEffect(() => {
    return () => {
      void mandarPendiente()
    }
  }, [mandarPendiente])

  // El padre necesita poder forzar el envio antes de entregar. Lo que ya no necesita es
  // llevar la cuenta de lo pendiente: eso servia para bloquear el boton de entregar con un
  // cartel, y ahora la entrega simplemente manda lo que quede.
  useEffect(() => {
    registrarEnvio(pregunta.id, mandarPendiente)
    // Sin esto, `envios` acumulaba cierres de preguntas ya desmontadas y entregar los
    // invocaba todos.
    return () => registrarEnvio(pregunta.id, null)
  }, [registrarEnvio, pregunta.id, mandarPendiente])

  useEffect(() => {
    registrarSiTieneTexto(pregunta.id, texto.trim() !== '')
    return () => registrarSiTieneTexto(pregunta.id, null)
  }, [registrarSiTieneTexto, pregunta.id, texto])

  // Con el tiempo agotado, «limpio» significa que no quedo nada en la cola —no
  // que hubiera algo que guardar—. Sin comprobar el texto, una pregunta que
  // nunca se contesto decia que se habia guardado, en el peor minuto posible y
  // rompiendo la regla del indicador honesto justo donde mas duele.
  const pista = bloqueado
    ? estado !== 'limpio'
      ? 'No llegó a guardarse antes de que terminara el tiempo.'
      : texto.trim() === ''
        ? 'Se quedó sin responder.'
        : 'Guardado antes de que terminara el tiempo.'
    : estado === 'guardando'
      ? 'Guardando…'
      : estado === 'pendiente'
        ? 'Guardando…'
        : texto.trim() === ''
          ? 'Sin responder.'
          : 'Guardado.'

  return (
    <div className={estilos.pregunta}>
      <label className={estilos.enunciado} htmlFor={`pregunta-${pregunta.id}`}>
        {pregunta.enunciado}
      </label>
      {/* `readOnly` y no `disabled`: un campo deshabilitado se pinta en gris y
          deja de poderse seleccionar, y lo que escribio sigue siendo suyo
          aunque ya no pueda cambiarlo. */}
      <textarea
        id={`pregunta-${pregunta.id}`}
        className={estilos.respuesta}
        value={texto}
        maxLength={MAXIMO_DEL_TEXTO}
        readOnly={bloqueado}
        aria-disabled={bloqueado}
        onChange={(e) => escribir(e.target.value)}
      />
      {/*
        Sin rojo. Este estado se pinta cuando el envio fallo y la cola va a
        reintentar, pero el texto que se ve dice «Guardando…»: en rojo alarmaba
        sin darle nada que hacer a quien esta en mitad de una prueba con reloj,
        que es el cartel que se quito. Lo que importa —si llego o no— ya lo dice
        la propia frase.
      */}
      <span className={estilos.estadoRespuesta}>
        {pista}
      </span>
    </div>
  )
}

// ---------- La pantalla ----------

export function Prueba() {
  const { uuid = '' } = useParams()
  const navegar = useNavigate()
  const avisar = useAviso()
  const cache = useQueryClient()

  const [confirmarInicio, setConfirmarInicio] = useState(false)
  const [confirmarEntrega, setConfirmarEntrega] = useState(false)
  // Como forzar el envio de cada pregunta. Se llena solo, segun se montan.
  const envios = useRef<Map<number, () => Promise<unknown>>>(new Map())
  const registrarEnvio = useCallback(
    (preguntaId: number, mandar: (() => Promise<unknown>) | null) => {
      if (mandar === null) envios.current.delete(preguntaId)
      else envios.current.set(preguntaId, mandar)
    },
    [],
  )

  /** Que preguntas tienen algo escrito. Se llena solo, segun se montan y se escriben. */
  const [conTexto, setConTexto] = useState<Record<number, boolean>>({})
  const registrarSiTieneTexto = useCallback((preguntaId: number, tiene: boolean | null) => {
    setConTexto((antes) => {
      if (tiene === null) {
        if (!(preguntaId in antes)) return antes
        const { [preguntaId]: _fuera, ...resto } = antes
        return resto
      }
      return antes[preguntaId] === tiene ? antes : { ...antes, [preguntaId]: tiene }
    })
  }, [])

  /** Manda lo que quede sin confirmar y espera a que llegue. */
  const vaciarLaCola = useCallback(
    () => Promise.allSettled([...envios.current.values()].map((mandar) => mandar())),
    [],
  )


  const consulta = useQuery({
    queryKey: ['prueba', uuid],
    queryFn: () => verPrueba(uuid),
    enabled: uuid !== '',
    // Mientras corre, se vuelve a preguntar: el cambio inesperado llega por aqui.
    refetchInterval: (q) => {
      const datos = q.state.data
      if (datos?.estadoIntento !== 'EN_CURSO') return false
      // Pasado el plazo se pregunta mas seguido: el barrido del servidor la
      // entrega sola en menos de un minuto y la pantalla tiene que enterarse.
      return segundosHasta(datos.venceEn) === 0 ? CADA_5_SEGUNDOS : CADA_20_SEGUNDOS
    },
  })

  // Un 404 aquí puede ser que la empresa retiró la vacante: lo dice su proceso. Y si la
  // retira con la prueba abierta, quien se entera es el botón: ver `usePantallaAbierta`.
  const { retirada, siSeCerroLaPuerta, seEnsena } = usePantallaAbierta(
    uuid,
    ['prueba', uuid],
    consulta,
  )

  const datos = consulta.data
  const tiempoAgotado = useTiempoAgotado(
    datos?.venceEn ?? null,
    datos?.estadoIntento === 'EN_CURSO',
  )

  // Si el tiempo se acaba con el dialogo de entrega abierto, entregar ya no es
  // una opcion: se cierra en vez de dejar un boton que solo puede fallar.
  useEffect(() => {
    if (tiempoAgotado) setConfirmarEntrega(false)
  }, [tiempoAgotado])

  const refrescar = useCallback(() => {
    void cache.invalidateQueries({ queryKey: ['prueba', uuid] })
  }, [cache, uuid])

  const inicio = useMutation({
    mutationFn: () => iniciarPrueba(uuid),
    // La respuesta de empezar ya trae la prueba entera —el caso, los materiales y las preguntas,
    // que antes de empezar no viajan—: se pinta con ella, sin esperar a la recarga.
    onSuccess: (empezada) => {
      cache.setQueryData(['prueba', uuid], empezada)
      setConfirmarInicio(false)
      refrescar()
    },
    onError: siSeCerroLaPuerta,
  })

  /*
    Un doble clic en «Sí, empezar» mandaba dos inicios: el botón se desactiva al pintarse
    «Abriendo…», y el segundo clic llega antes. El servidor deja un solo intento igualmente, pero se
    pide una vez.
  */
  const pidiendoInicio = useRef(false)
  const empezar = () => {
    if (pidiendoInicio.current) return
    pidiendoInicio.current = true
    inicio.mutate(undefined, {
      onSettled: () => {
        pidiendoInicio.current = false
      },
    })
  }

  const entrega = useMutation({
    // ⚠️ **Primero se manda lo que quede sin confirmar.** Antes esto era un cartel rojo que
    // bloqueaba el boton y dejaba al candidato esperando a que un aviso desapareciera solo,
    // en una prueba con cronometro corriendo. Ahora se manda y se espera.
    mutationFn: async () => {
      await vaciarLaCola()
      return entregarPrueba(uuid)
    },
    onSuccess: async () => {
      setConfirmarEntrega(false)
      await cache.invalidateQueries({ queryKey: ['postulaciones'] })
      await cache.invalidateQueries({ queryKey: ['postulacion', uuid] })
      avisar('Prueba entregada.')
      navegar(rutas.proceso(uuid), { replace: true })
    },
    onError: siSeCerroLaPuerta,
  })

  if (consulta.isPending || (consulta.isError && retirada === 'comprobando')) {
    return (
      <div className={estilos.pagina}>
        <div className={estilos.marco} aria-busy="true">
          <h1>Abriendo la prueba…</h1>
          <div className={estilos.barra} />
          <div className={`${estilos.barra} ${estilos.barraMedia}`} />
          <div className={`${estilos.barra} ${estilos.barraCorta}`} />
        </div>
      </div>
    )
  }

  if (consulta.isError && retirada === 'retirada') {
    // Ni reloj ni botón de entregar: la prueba es de un proceso que ya no existe.
    return (
      <div className={estilos.pagina}>
        <VacanteRetirada />
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
          <h1>No pudimos abrir la prueba.</h1>
          <p className={estilos.marcoTexto}>
            {consulta.error instanceof Error
              ? consulta.error.message
              : 'No pudimos conectar con el servidor.'}{' '}
            Lo que ya hayas guardado sigue ahí.
          </p>
          <button
            type="button"
            className={estilos.reintentar}
            onClick={() => void consulta.refetch()}
            data-rotulo="Intentar de nuevo"
          >
            Intentar de nuevo
          </button>
        </div>
      </div>
    )
  }

  const prueba: MiPrueba = consulta.data
  // Lo que no tiene contenido no se pinta, en vez de dejar secciones vacias
  // esperando algo que no viene.
  const hayEntregables = prueba.entregables.length > 0
  const faltanObligatorios = prueba.entregables.filter(
    (e) => e.esObligatorio && !e.entregado,
  ).length
  // Lo que cada recuadro tiene puesto **ahora**, no lo que el servidor mandó al cargar: si
  // saliera de ahí, una respuesta recién borrada seguiría contando como respondida.
  const preguntasSinResponder = prueba.preguntas.filter((p) => conTexto[p.id] === false).length
  // La prueba del editor (V67) no se entrega con huecos y, en curso, va de una pregunta por
  // pantalla (`PruebaDelEditor`). Las plantillas, en curso, siguen como siempre.
  const delEditor = prueba.delEditor === true
  const laPrueba = 'la prueba'
  // Antes de empezar se dice lo que la prueba tiene, y nada que no se sepa (`loQueDiceLaPrevia`).
  const entradilla = entradillaDe(prueba)
  const avisoAlEmpezar = avisoDeEmpezar(prueba)

  return (
    <div className={estilos.pagina}>
      <Link className={estilos.volver} to={rutas.proceso(uuid)}>
        ← Volver a mi proceso
      </Link>

      {/* ---------- Ya entregada ---------- */}
      {prueba.estadoIntento === 'ENTREGADA' && (
        <div className={estilos.cerrada}>
          <h1>Prueba entregada.</h1>
          <p className={estilos.cerradaTexto}>
            Estamos calificando tu trabajo y la explicación de tus decisiones. Te
            escribiremos cuando haya novedades.
            {hayEntregables &&
              ` Recibimos ${prueba.entregables.filter((e) => e.entregado).length} de ${prueba.entregables.length} entregables.`}
          </p>
          <Link
            className={estilos.volverAlProceso}
            to={rutas.proceso(uuid)}
            data-rotulo="Volver a mi proceso"
          >
            Volver a mi proceso
          </Link>
        </div>
      )}

      {/* ---------- Venció con huecos (V67) ---------- */}
      {prueba.estadoIntento === 'NO_COMPLETADA' && (
        <div className={estilos.cerrada}>
          <h1>Tu tiempo terminó y {laPrueba} quedó sin completar.</h1>
          <p className={estilos.cerradaTexto}>
            Cuando terminó el plazo faltaba responder alguna pregunta o subir algún entregable
            obligatorio, así que no se entregó ni se va a calificar. Quien lleva tu proceso lo ve
            y te escribirá.
          </p>
          <Link
            className={estilos.volverAlProceso}
            to={rutas.proceso(uuid)}
            data-rotulo="Volver a mi proceso"
          >
            Volver a mi proceso
          </Link>
        </div>
      )}

      {/* ---------- Antes de empezar ---------- */}
      {/* Las dos pruebas, en la misma ficha corta (10/10/2026): sin el caso ni las preguntas, que se
          abren al empezar. */}
      {prueba.estadoIntento === 'PENDIENTE' && (
        <>
          <h1>{hayEntregables ? 'Demuestra cómo trabajas.' : 'Tu prueba del puesto.'}</h1>
          {/* Sin nombrar el caso ni los materiales: antes de empezar no se sabe si los hay. */}
          <p className={estilos.entradillaDeLaPrevia}>
            {entradilla.abre}
            {entradilla.tiempo ? (
              <>
                , y <b>{entradilla.tiempo}</b>.
              </>
            ) : (
              '.'
            )}
          </p>
          <FichaPrevia prueba={prueba} alEmpezar={() => setConfirmarInicio(true)} />
        </>
      )}

      {/* ---------- En curso: la del editor, una pregunta por pantalla ---------- */}
      {prueba.estadoIntento === 'EN_CURSO' && delEditor && (
        <PruebaDelEditor
          uuid={uuid}
          prueba={prueba}
          tiempoAgotado={tiempoAgotado}
          refrescar={refrescar}
          siSeCerroLaPuerta={siSeCerroLaPuerta}
          seEnsena={seEnsena}
        />
      )}

      {/* ---------- En curso: la de plantilla, toda en vertical como siempre ---------- */}
      {prueba.estadoIntento === 'EN_CURSO' && !delEditor && (
        <>
          <div className={estilos.reloj}>
            <span className={estilos.queEs}>
              {tiempoAgotado ? 'Se acabó el tiempo' : 'Tiempo restante'}
            </span>
            {tiempoAgotado ? (
              <span className={`${estilos.tiempo} ${estilos.poco}`}>00:00:00</span>
            ) : (
              <div className={estilos.cuentaAtras}>
                <Cronometro
                  venceEn={prueba.venceEn}
                  alAgotarse={refrescar}
                  className={estilos.tiempo}
                  classNamePoco={estilos.poco}
                  /* La frase del umbral se ve: el rojo del numero es color, y
                     el color solo no es una señal. */
                  classNameAviso={estilos.avisoDelReloj}
                />
                {prueba.venceEn && (
                  <span className={estilos.hasta}>
                    hasta {formatearFechaLarga(prueba.venceEn)}
                  </span>
                )}
              </div>
            )}
          </div>

          {tiempoAgotado && (
            <p className={`${estilos.aviso} ${estilos.malo}`} role="alert">
              <span>
                <b>Terminó el plazo de esta prueba</b>. Ya no se
                puede escribir ni subir nada: el servidor no lo admitiría. Quedó guardado todo lo que
                llegó a tiempo, y en unos segundos se entregará sola con eso. No cierres la página.
              </span>
            </p>
          )}

          {/* El cambio no llega hasta que el servidor decide enseñarlo: si se
              supiera de antemano, se aprenderia el patron. */}
          {prueba.cambioTexto && (
            <div className={estilos.cambio} role="status">
              <div>
                <p className={estilos.tituloCambio}>Cambio en el encargo</p>
                <p className={estilos.textoCambio}>{prueba.cambioTexto}</p>
                <p className={estilos.detalleEntregable}>
                  Adapta tu propuesta sin perder lo que ya registraste, y explica qué
                  decidiste y por qué.
                </p>
              </div>
            </div>
          )}

          {/*
            El encargo a un lado y el trabajo al otro.

            Esta pantalla se habita dos horas cronometradas y era la unica plana:
            seis secciones a 32 px iguales entre el cronometro y el primer campo,
            que en un telefono quedaba en y=819. La composicion estaba escrita
            —`.columnas` y `.lateral`— pero solo se usaba en la portada, que se
            mira treinta segundos.

            Lo que se lee va a la izquierda y se queda fijo: el orden del DOM, el
            visual y el del foco siguen coincidiendo, y el encargo deja de
            perderse al hacer scroll hacia las respuestas.
          */}
          <div className={estilos.trabajando}>
            <aside className={estilos.loQueSeLee}>
              <section className={estilos.bloque}>
                <h2 className={estilos.tituloBloque}>{hayEntregables ? 'El encargo' : 'De qué va'}</h2>
                <TextoPlano texto={prueba.enunciado ?? ''} queEs="el enunciado de la prueba" />
                {prueba.consigna && <Consigna consigna={prueba.consigna} />}
              </section>

              {/* Durante la prueba tambien hacen falta: el enlace al PDF puede estar
                  en cualquiera de los tres campos, no solo en el reto. */}
              {prueba.materiales && (
                <section className={estilos.bloque}>
                  <h2 className={estilos.tituloBloque}>Materiales</h2>
                  <TextoPlano texto={prueba.materiales} queEs="el material de apoyo" />
                </section>
              )}

              {prueba.herramientasPermitidas && (
                <section className={estilos.bloque}>
                  <h2 className={estilos.tituloBloque}>Herramientas permitidas</h2>
                  <TextoPlano texto={prueba.herramientasPermitidas} queEs="el documento" />
                </section>
              )}
            </aside>

            <div className={estilos.loQueSeHace}>
              {prueba.preguntas.length > 0 && (
                <section className={estilos.bloque}>
                  <h2 className={estilos.tituloBloque}>
                    {hayEntregables ? 'Tus respuestas' : 'Las preguntas'}
                  </h2>
                  <p className={estilos.texto} style={{ marginBottom: 'var(--e4)' }}>
                    {tiempoAgotado
                      ? 'Así quedaron. Ya no se pueden cambiar.'
                      : 'Se guardan solas mientras escribes.'}
                  </p>
                  <div className={estilos.preguntas}>
                    {prueba.preguntas.map((p) => (
                      <PreguntaPrueba
                        key={p.id}
                        uuid={uuid}
                        pregunta={p}
                        bloqueado={tiempoAgotado}
                        registrarEnvio={registrarEnvio}
                        registrarSiTieneTexto={registrarSiTieneTexto}
                        siSeCerroLaPuerta={siSeCerroLaPuerta}
                      />
                    ))}
                  </div>
                </section>
              )}

              {hayEntregables && (
                <section className={estilos.bloque} id="entregables-de-la-prueba">
                  <h2 className={estilos.tituloBloque}>Entregables</h2>
                  <p className={estilos.texto} style={{ marginBottom: 'var(--e4)' }}>
                    {tiempoAgotado
                      ? 'Ya no se admiten envíos.'
                      : 'Cada uno indica si se entrega como archivo o como enlace.'}
                  </p>
                  <div className={estilos.entregables}>
                    {prueba.entregables.map((e) => (
                      <Entregable
                        key={e.id}
                        uuid={uuid}
                        entregable={e}
                        bloqueado={tiempoAgotado}
                        alSubir={refrescar}
                        siSeCerroLaPuerta={siSeCerroLaPuerta}
                        seEnsena={seEnsena}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>

          <div className={estilos.entrega}>
            {tiempoAgotado ? (
              <p className={estilos.queFalta}>
                No tienes que hacer nada más: la entrega se cierra sola con lo que ya estaba
                guardado.
              </p>
            ) : (
              <>
                <p className={estilos.queFalta}>
                  Usar IA está permitido. Lo que se mira es si entiendes y verificas tu
                  trabajo.
                  {faltanObligatorios > 0 &&
                    ` Te ${faltanObligatorios === 1 ? 'falta 1 entregable obligatorio' : `faltan ${faltanObligatorios} entregables obligatorios`}.`}
                </p>
                <button
                  type="button"
                  className={estilos.entregar}
                  onClick={() => setConfirmarEntrega(true)}
                  data-rotulo="Entregar prueba"
                >
                  Entregar prueba
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* El segundo clic de un doble clic en «Empezar prueba» caía en el fondo y lo cerraba
          (QA-UPP-13) y, en el teléfono, en «Aún no» o en «Sí, empezar» (QA-UPP-14): el modal entero
          ignora ese clic. */}
      <Modal
        abierto={confirmarInicio}
        titulo="¿Empezar ahora?"
        onCerrar={() => setConfirmarInicio(false)}
        aPruebaDeDobleClic
        pie={
          <>
            {/* El foco entra por la opción segura: arrancar el reloj no tiene vuelta atrás y
                exige ir a «Sí, empezar» a propósito, también con el teclado. */}
            <button
              type="button"
              className={estilos.cancelar}
              onClick={() => setConfirmarInicio(false)}
              data-rotulo="Aún no"
              autoFocus
            >
              Aún no
            </button>
            <button
              type="button"
              className={estilos.confirmar}
              onClick={empezar}
              disabled={inicio.isPending}
              data-rotulo={inicio.isPending ? 'Abriendo…' : 'Sí, empezar'}
            >
              {inicio.isPending ? 'Abriendo…' : 'Sí, empezar'}
            </button>
          </>
        }
      >
        <p className={`${estilos.aviso} ${estilos.serio}`}>
          <span>
            {/* El contenido se lee dentro del reloj (10/10/2026): hasta aquí no se ha visto, y no
                se sabe si hay caso o materiales. */}
            <b>{avisoAlEmpezar.aviso.resaltado}</b>
            {avisoAlEmpezar.aviso.resto}
            {/* La prueba del editor no se entrega con huecos (decisión 11): decirle aquí que
                se entrega «lo guardado» sería prometerle algo que no pasa. */}
            {avisoAlEmpezar.alTerminar && ` ${avisoAlEmpezar.alTerminar}`}
          </span>
        </p>
        {/* Un 404 no se enseña mientras se comprueba: si es la vacante retirada, la pantalla
            entera lo dice en vez de dejar el texto del servidor aquí con el reloj corriendo. */}
        {inicio.isError && seEnsena(inicio.error) && (
          <p className={`${estilos.aviso} ${estilos.malo}`} role="alert">
            <span>
              {inicio.error instanceof Error ? inicio.error.message : 'No pudimos abrirla.'}
            </span>
          </p>
        )}
      </Modal>

      <Modal
        abierto={confirmarEntrega}
        titulo="Entregar prueba"
        onCerrar={() => setConfirmarEntrega(false)}
        aPruebaDeDobleClic
        pie={
          <>
            <button
              type="button"
              className={estilos.cancelar}
              onClick={() => setConfirmarEntrega(false)}
              data-rotulo="Seguir revisando"
            >
              Seguir revisando
            </button>
            <button
              type="button"
              className={estilos.confirmar}
              onClick={() => entrega.mutate()}
              // Ya no depende de la cola: la propia entrega manda lo que quede antes de nada.
              disabled={entrega.isPending}
              data-rotulo={entrega.isPending ? 'Entregando…' : 'Entregar'}
            >
              {entrega.isPending ? 'Entregando…' : 'Entregar'}
            </button>
          </>
        }
      >
        {/*
          ⚠️ **Aqui no va ningun aviso de «respuestas sin guardar», y es a proposito.** Le
          contaba una averia nuestra a quien tiene el cronometro corriendo y no podia hacer
          nada con ella salvo esperar a que el cartel se fuera solo. Lo que hay que hacer con
          lo pendiente es mandarlo, y eso es justo lo que hace ahora `entrega`.
        */}
        {/*
          El servidor deja entregar esta prueba con preguntas en blanco: lo que exige son los
          entregables obligatorios. Se avisa y no se bloquea, porque puede ser a proposito
          —hay pruebas donde lo que de verdad se evalua es el entregable—, pero entregar no
          tiene vuelta atras y borrar una respuesta sin querer no puede salir gratis.
        */}
        {preguntasSinResponder > 0 && (
          <p className={estilos.confirmacionTexto}>
            <b>
              {preguntasSinResponder === 1
                ? 'Hay 1 pregunta sin responder.'
                : `Hay ${preguntasSinResponder} preguntas sin responder.`}
            </b>{' '}
            Se entregará así. Si la dejaste en blanco a propósito, adelante.
          </p>
        )}
        <p className={estilos.confirmacionTexto}>
          Después de entregar no podrás modificar archivos, enlaces ni respuestas.
        </p>
        {entrega.isError && seEnsena(entrega.error) && (
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
