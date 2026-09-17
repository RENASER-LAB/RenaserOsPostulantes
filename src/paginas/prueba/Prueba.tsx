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
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  entregarPrueba,
  iniciarPrueba,
  responderPrueba,
  subirArchivo,
  subirEnlace,
  verPrueba,
} from '@/api/prueba'
import type { EntregableRequerido, FechaIso, MiPrueba } from '@/api/tipos'
import { formatearFechaLarga, segundosHasta } from '@/dominio/reloj'
import { rutas } from '@/rutas'
import { useAviso } from '@/ui/Avisos'
import { Cronometro } from '@/ui/Cronometro'
import { Modal } from '@/ui/Modal'
import { TextoPlano } from '@/ui/TextoPlano'
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

// ---------- Un entregable ----------

/**
 * Que acepta este entregable, en palabras.
 *
 * `formato` llega como `ARCHIVO`, `ENLACE` o `CUALQUIERA`, y hasta ahora se
 * imprimia tal cual —«Formato: ARCHIVO»— mientras la pantalla enseñaba los dos
 * campos igualmente. El resultado real: alguien pega un enlace donde solo se
 * admite archivo, el servidor responde con un 400 y el reloj no se para.
 */
function comoSeEntrega(formato: string | null): string {
  if (formato === 'ARCHIVO') return 'Se entrega como archivo'
  if (formato === 'ENLACE') return 'Se entrega como enlace'
  return 'Archivo o enlace, lo que prefieras'
}

function Entregable({
  uuid,
  entregable,
  bloqueado,
  alSubir,
}: {
  uuid: string
  entregable: EntregableRequerido
  /** Con el tiempo agotado ya no se admite nada: el servidor lo rechaza. */
  bloqueado: boolean
  alSubir: () => void
}) {
  const campoArchivo = useRef<HTMLInputElement>(null)
  const [enlace, setEnlace] = useState('')
  const [error, setError] = useState<string | null>(null)

  /*
   * El backend solo dice `entregado: true`. No devuelve el nombre del archivo
   * ni la direccion que se guardo —su contrato de candidato no los lleva—, asi
   * que lo unico que se puede enseñar sin inventar nada es lo que se acaba de
   * mandar desde esta pantalla, y solo mientras siga abierta.
   */
  const [ultimoEnvio, setUltimoEnvio] = useState<string | null>(null)

  // Un formato que no conocemos (o nulo) se trata como «los dos». Enseñar de
  // mas se corrige con un aviso del servidor; esconder el campo bueno deja al
  // candidato sin ninguna forma de entregar.
  const aceptaArchivo = entregable.formato !== 'ENLACE'
  const aceptaEnlace = entregable.formato !== 'ARCHIVO'

  const archivo = useMutation({
    mutationFn: (f: File) => subirArchivo(uuid, entregable.id, f),
    onSuccess: (_resultado, f) => {
      setError(null)
      setUltimoEnvio(f.name)
      alSubir()
    },
    onError: (c) => setError(c instanceof Error ? c.message : 'No se pudo subir.'),
  })

  const url = useMutation({
    mutationFn: (valor: string) => subirEnlace(uuid, entregable.id, valor),
    onSuccess: (_resultado, valor) => {
      setError(null)
      setUltimoEnvio(valor)
      setEnlace('')
      alSubir()
    },
    onError: (c) => setError(c instanceof Error ? c.message : 'No se pudo guardar el enlace.'),
  })

  return (
    <div
      className={`${estilos.entregable}${
        entregable.entregado || ultimoEnvio !== null ? ` ${estilos.recibido}` : ''
      }`}
    >
      <div className={estilos.cabeceraEntregable}>
        <div>
          <p className={estilos.nombreEntregable}>
            {entregable.nombre}{' '}
            <span className={estilos.obligatorio}>
              {entregable.esObligatorio ? '· obligatorio' : '· opcional'}
            </span>
          </p>
          {entregable.detalle && (
            <p className={estilos.detalleEntregable}>{entregable.detalle}</p>
          )}
        </div>
        {(entregable.entregado || ultimoEnvio !== null) && (
          <span className={estilos.marcaRecibido}>Entregado</span>
        )}
      </div>

      {(ultimoEnvio !== null || entregable.entregado) && (
        <p className={estilos.detalleEntregable}>
          {ultimoEnvio ? (
            <>
              Recibimos <b>{ultimoEnvio}</b>.
            </>
          ) : (
            'Ya recibimos tu entrega.'
          )}
          {!bloqueado && ' Si envías otra cosa, reemplaza a esta.'}
        </p>
      )}

      <span className={estilos.comoSeEntrega}>{comoSeEntrega(entregable.formato)}</span>

      <div className={estilos.formasDeEntregar}>
        {aceptaEnlace && (
          <>
            <label className={estilos.oculto} htmlFor={`enlace-${entregable.id}`}>
              Enlace
            </label>
            <input
              id={`enlace-${entregable.id}`}
              className={estilos.campoEnlace}
              type="url"
              inputMode="url"
              placeholder="https://"
              value={enlace}
              disabled={bloqueado}
              onChange={(e) => setEnlace(e.target.value)}
            />
            <button
              className={estilos.subir}
              type="button"
              onClick={() => url.mutate(enlace.trim())}
              disabled={bloqueado || !enlace.trim() || url.isPending}
            >
              {url.isPending ? 'Guardando…' : 'Guardar enlace'}
            </button>
          </>
        )}
        {aceptaArchivo && (
          <>
            <input
              ref={campoArchivo}
              type="file"
              className={estilos.oculto}
              tabIndex={-1}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) archivo.mutate(f)
              }}
            />
            <button
              className={estilos.subir}
              type="button"
              onClick={() => campoArchivo.current?.click()}
              disabled={bloqueado || archivo.isPending}
            >
              {archivo.isPending ? 'Subiendo…' : 'Seleccionar archivo'}
            </button>
          </>
        )}
      </div>

      {error && (
        <p className={`${estilos.aviso} ${estilos.malo}`} role="alert">
          <span>{error}</span>
        </p>
      )}
    </div>
  )
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
    onError: () => setEstado('pendiente'),
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
      <span
        className={`${estilos.estadoRespuesta}${
          !bloqueado && estado === 'pendiente' ? ` ${estilos.pendiente}` : ''
        }`}
      >
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
    onSuccess: () => {
      setConfirmarInicio(false)
      refrescar()
    },
  })

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
  })

  if (consulta.isPending) {
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
          >
            Intentar de nuevo
          </button>
        </div>
      </div>
    )
  }

  const prueba: MiPrueba = consulta.data
  // Una prueba sin entregables es un cuestionario: lo que no tiene contenido no
  // se pinta, en vez de dejar secciones vacias esperando algo que no viene.
  const hayEntregables = prueba.entregables.length > 0
  const faltanObligatorios = prueba.entregables.filter(
    (e) => e.esObligatorio && !e.entregado,
  ).length
  // Lo que cada recuadro tiene puesto **ahora**, no lo que el servidor mandó al cargar: si
  // saliera de ahí, una respuesta recién borrada seguiría contando como respondida.
  const preguntasSinResponder = prueba.preguntas.filter((p) => conTexto[p.id] === false).length

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
          <Link className={estilos.volverAlProceso} to={rutas.proceso(uuid)}>
            Volver a mi proceso
          </Link>
        </div>
      )}

      {/* ---------- Antes de empezar ---------- */}
      {prueba.estadoIntento === 'PENDIENTE' && (
        <>
          <h1>{hayEntregables ? 'Demuestra cómo trabajas.' : 'Tu prueba del puesto.'}</h1>
          <p className={estilos.texto} style={{ marginTop: 'var(--e3)' }}>
            Lee todo antes de empezar. <b>El tiempo empieza a contar cuando confirmes</b>, no
            antes.
          </p>

          <div className={estilos.columnas} style={{ marginTop: 'var(--e6)' }}>
            <div>
              <section className={estilos.bloque}>
                <h2 className={estilos.tituloBloque}>
                  {hayEntregables ? 'El encargo' : 'De qué va'}
                </h2>
                {prueba.enunciado ? (
                  <TextoPlano texto={prueba.enunciado} queEs="el enunciado de la prueba" />
                ) : (
                  <p className={estilos.texto}>Recibirás el enunciado al empezar.</p>
                )}
              </section>

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

              {hayEntregables && (
                <section className={estilos.bloque}>
                  <h2 className={estilos.tituloBloque}>Lo que tendrás que entregar</h2>
                  {/* Saberlo antes de empezar evita descubrirlo con el reloj
                      corriendo. */}
                  <div className={estilos.entregables}>
                    {prueba.entregables.map((e) => (
                      <div className={estilos.entregable} key={e.id}>
                        <p className={estilos.nombreEntregable}>
                          {e.nombre}{' '}
                          <span className={estilos.obligatorio}>
                            {e.esObligatorio ? '· obligatorio' : '· opcional'}
                          </span>
                        </p>
                        {e.detalle && (
                          <p className={estilos.detalleEntregable}>{e.detalle}</p>
                        )}
                        <span className={estilos.comoSeEntrega}>
                          {comoSeEntrega(e.formato)}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <aside className={estilos.lateral}>
              {/* ⚠️ Los dos plazos pueden existir A LA VEZ, y antes solo se decia uno.
                  Una prueba da minutos desde que empiezas; la convocatoria puede ademas
                  cerrar un dia y una hora para todos. Cuando habia las dos cosas esta
                  rama escribia «90 minutos» y escondia la fecha, asi que quien abriera a
                  las 17:40 con cierre a las 18:00 leia noventa minutos y tenia veinte.
                  Manda el que caiga antes —lo decide el servidor al empezar— y por eso
                  aqui se dicen los dos y cual acorta a cual. */}
              <div className={estilos.datoLateral}>
                {prueba.duracionMinutos ? (
                  <>
                    <span className={estilos.etiquetaLateral}>Duración</span>
                    <span className={estilos.valorLateral}>
                      {prueba.duracionMinutos} minutos desde que empieces
                    </span>
                    {prueba.venceEn && (
                      <span className={estilos.matizLateral}>
                        Y la convocatoria cierra el {formatearFechaLarga(prueba.venceEn)}: si
                        empiezas más tarde de eso, tendrás el tiempo que quede hasta esa hora.
                      </span>
                    )}
                  </>
                ) : prueba.venceEn ? (
                  <>
                    <span className={estilos.etiquetaLateral}>Tienes hasta</span>
                    <span className={estilos.valorLateral}>
                      {formatearFechaLarga(prueba.venceEn)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className={estilos.etiquetaLateral}>Plazo</span>
                    <span className={estilos.valorLateral}>
                      Empieza a contar cuando la abras
                    </span>
                  </>
                )}
              </div>

              {prueba.modalidad && (
                <div className={estilos.datoLateral}>
                  <span className={estilos.etiquetaLateral}>Modalidad</span>
                  <span className={estilos.valorLateral}>{prueba.modalidad}</span>
                </div>
              )}

              <div className={estilos.datoLateral}>
                <span className={estilos.etiquetaLateral}>Qué hay que hacer</span>
                <span className={estilos.valorLateral}>
                  {prueba.preguntas.length > 0 &&
                    `${prueba.preguntas.length} ${prueba.preguntas.length === 1 ? 'pregunta' : 'preguntas'}`}
                  {prueba.preguntas.length > 0 && hayEntregables && ' · '}
                  {hayEntregables &&
                    `${prueba.entregables.length} ${prueba.entregables.length === 1 ? 'entregable' : 'entregables'}`}
                </span>
              </div>

              <p className={estilos.aviso} style={{ marginBottom: 0 }}>
                <span>
                  Una vez empezada no se puede pausar. Si el tiempo termina, se entrega lo
                  que hayas guardado.
                </span>
              </p>

              <button
                type="button"
                className={estilos.empezar}
                style={{ width: '100%', marginTop: 'var(--e4)' }}
                onClick={() => setConfirmarInicio(true)}
              >
                Empezar prueba
              </button>
            </aside>
          </div>
        </>
      )}

      {/* ---------- En curso ---------- */}
      {prueba.estadoIntento === 'EN_CURSO' && (
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
                <b>Terminó el plazo de esta prueba</b>. Ya no se puede escribir ni subir
                nada: el servidor no lo admitiría. Quedó guardado todo lo que llegó a
                tiempo, y en unos segundos se entregará sola con eso. No cierres la página.
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
                <h2 className={estilos.tituloBloque}>
                  {hayEntregables ? 'El encargo' : 'De qué va'}
                </h2>
                <TextoPlano texto={prueba.enunciado ?? ''} queEs="el enunciado de la prueba" />
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
                      />
                    ))}
                  </div>
                </section>
              )}

              {hayEntregables && (
                <section className={estilos.bloque}>
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
                >
                  Entregar prueba
                </button>
              </>
            )}
          </div>
        </>
      )}

      <Modal
        abierto={confirmarInicio}
        titulo="¿Empezar ahora?"
        onCerrar={() => setConfirmarInicio(false)}
        pie={
          <>
            <button type="button" className={estilos.cancelar} onClick={() => setConfirmarInicio(false)}>
              Aún no
            </button>
            <button
              type="button"
              className={estilos.confirmar}
              onClick={() => inicio.mutate()}
              disabled={inicio.isPending}
            >
              {inicio.isPending ? 'Abriendo…' : 'Sí, empezar'}
            </button>
          </>
        }
      >
        <p className={`${estilos.aviso} ${estilos.serio}`}>
          <span>
            <b>El tiempo no se detendrá</b>. Si cierras el navegador, el cronómetro sigue
            corriendo. Al terminar se entrega lo que hayas guardado.
          </span>
        </p>
        {inicio.isError && (
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
        pie={
          <>
            <button type="button" className={estilos.cancelar} onClick={() => setConfirmarEntrega(false)}>
              Seguir revisando
            </button>
            <button
              type="button"
              className={estilos.confirmar}
              onClick={() => entrega.mutate()}
              // Ya no depende de la cola: la propia entrega manda lo que quede antes de nada.
              disabled={entrega.isPending}
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
