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
import { segundosHasta } from '@/dominio/reloj'
import { rutas } from '@/rutas'
import { useAviso } from '@/ui/Avisos'
import { Cronometro } from '@/ui/Cronometro'
import { Modal } from '@/ui/Modal'
import { Cargando, Fallo } from '@/ui/Mensajes'
import { TextoPlano } from '@/ui/TextoPlano'

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
  const soloUno = aceptaArchivo !== aceptaEnlace

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
    <div className="card" style={{ padding: 18 }}>
      <div className="row">
        <div>
          <b style={{ fontSize: 12 }}>{entregable.nombre}</b>
          {entregable.detalle && (
            <p className="small" style={{ margin: '5px 0 0' }}>
              {entregable.detalle}
            </p>
          )}
        </div>
        <span className={`tag ${entregable.entregado ? 'good' : entregable.esObligatorio ? 'warn' : 'info'}`}>
          {entregable.entregado ? 'Entregado' : entregable.esObligatorio ? 'Obligatorio' : 'Opcional'}
        </span>
      </div>

      {(ultimoEnvio !== null || entregable.entregado) && (
        <p className="small entregable-recibido">
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

      <div className="formgrid" style={{ marginTop: 14 }}>
        {aceptaEnlace && (
          <div className={soloUno ? 'field full' : 'field'}>
            <label htmlFor={`enlace-${entregable.id}`}>Enlace</label>
            <input
              id={`enlace-${entregable.id}`}
              placeholder="https://"
              value={enlace}
              disabled={bloqueado}
              onChange={(e) => setEnlace(e.target.value)}
            />
          </div>
        )}
        {aceptaArchivo && (
          <div className={soloUno ? 'field full' : 'field'}>
            <label>Archivo</label>
            <input
              ref={campoArchivo}
              type="file"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) archivo.mutate(f)
              }}
            />
            <button
              className="btn"
              type="button"
              style={{ width: '100%' }}
              onClick={() => campoArchivo.current?.click()}
              disabled={bloqueado || archivo.isPending}
            >
              {archivo.isPending ? 'Subiendo…' : 'Seleccionar archivo'}
            </button>
          </div>
        )}
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <span className="small">{comoSeEntrega(entregable.formato)}</span>
        {aceptaEnlace && (
          <button
            className="btn"
            type="button"
            onClick={() => url.mutate(enlace.trim())}
            disabled={bloqueado || !enlace.trim() || url.isPending}
          >
            {url.isPending ? 'Guardando…' : 'Guardar enlace'}
          </button>
        )}
      </div>

      {error && <div className="error">{error}</div>}
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
  onPendiente,
}: {
  uuid: string
  pregunta: { id: number; enunciado: string; respuestaTexto: string | null }
  /** Con el tiempo agotado ya no se escribe ni se reintenta nada. */
  bloqueado: boolean
  onPendiente: (preguntaId: number, pendiente: boolean) => void
}) {
  const [texto, setTexto] = useState(pregunta.respuestaTexto ?? '')
  const [estado, setEstado] = useState<'limpio' | 'guardando' | 'pendiente'>('limpio')
  const pendiente = useRef<string | null>(null)
  const temporizador = useRef<number | undefined>(undefined)

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
    onSuccess: (_resultado, valor) => {
      // Si siguio escribiendo mientras viajaba, lo nuevo sigue pendiente.
      if (pendiente.current === valor) {
        pendiente.current = null
        setEstado('limpio')
      }
    },
    onError: () => setEstado('pendiente'),
  })

  const guardarTexto = guardar.mutate

  const mandarPendiente = useCallback(() => {
    window.clearTimeout(temporizador.current)
    if (pendiente.current === null || yaNoSeAdmite.current) return
    guardarTexto(pendiente.current)
  }, [guardarTexto])

  useEffect(() => {
    if (texto === (pregunta.respuestaTexto ?? '')) {
      pendiente.current = null
      setEstado('limpio')
      return
    }
    pendiente.current = texto
    setEstado('pendiente')
    window.clearTimeout(temporizador.current)
    temporizador.current = window.setTimeout(mandarPendiente, ESPERA_ANTES_DE_GUARDAR)
  }, [texto, pregunta.respuestaTexto, mandarPendiente])

  // Mientras quede algo sin confirmar se sigue intentando solo.
  useEffect(() => {
    if (estado !== 'pendiente' || bloqueado) return
    const reloj = window.setInterval(mandarPendiente, ESPERA_ANTES_DE_REINTENTAR)
    return () => window.clearInterval(reloj)
  }, [estado, bloqueado, mandarPendiente])

  // Al desmontarse se manda lo que quede, no se cancela.
  useEffect(() => {
    return () => {
      mandarPendiente()
    }
  }, [mandarPendiente])

  // El padre necesita saberlo para no dejar entregar sin esta respuesta.
  useEffect(() => {
    onPendiente(pregunta.id, estado !== 'limpio')
    return () => onPendiente(pregunta.id, false)
  }, [estado, pregunta.id, onPendiente])

  const pista = bloqueado
    ? estado === 'limpio'
      ? 'Guardado antes de que terminara el tiempo.'
      : 'No llegó a guardarse antes de que terminara el tiempo.'
    : estado === 'guardando'
      ? 'Guardando…'
      : estado === 'pendiente'
        ? 'Sin guardar. Seguimos intentándolo.'
        : texto.trim() === ''
          ? 'Sin responder.'
          : 'Guardado.'

  return (
    <div className="field full">
      <label htmlFor={`pregunta-${pregunta.id}`}>{pregunta.enunciado}</label>
      {/* `readOnly` y no `disabled`: un campo deshabilitado se pinta en gris y
          deja de poderse seleccionar, y lo que escribio sigue siendo suyo
          aunque ya no pueda cambiarlo. */}
      <textarea
        id={`pregunta-${pregunta.id}`}
        value={texto}
        maxLength={MAXIMO_DEL_TEXTO}
        readOnly={bloqueado}
        aria-disabled={bloqueado}
        onChange={(e) => setTexto(e.target.value)}
      />
      <div className={`hint${!bloqueado && estado === 'pendiente' ? ' hint-pendiente' : ''}`}>
        {pista}
      </div>
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
  // Que respuestas no ha confirmado el servidor. Entregar con alguna pendiente
  // es entregar sin ella.
  const [sinGuardar, setSinGuardar] = useState<number[]>([])

  const marcarPendiente = useCallback((preguntaId: number, pendiente: boolean) => {
    setSinGuardar((antes) => {
      const estaba = antes.includes(preguntaId)
      if (pendiente === estaba) return antes
      return pendiente ? [...antes, preguntaId] : antes.filter((id) => id !== preguntaId)
    })
  }, [])

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
    mutationFn: () => entregarPrueba(uuid),
    onSuccess: async () => {
      setConfirmarEntrega(false)
      await cache.invalidateQueries({ queryKey: ['postulaciones'] })
      await cache.invalidateQueries({ queryKey: ['postulacion', uuid] })
      avisar('Prueba entregada.')
      navegar(rutas.proceso(uuid), { replace: true })
    },
  })

  if (consulta.isPending) return <Cargando que="Abriendo la prueba…" />
  if (consulta.isError) {
    return <Fallo error={consulta.error} reintentar={() => void consulta.refetch()} />
  }

  const prueba: MiPrueba = consulta.data

  return (
    <>
      <Link className="back" to={rutas.proceso(uuid)}>
        ← Volver a mi proceso
      </Link>

      <div className="pagehead">
        <div>
          <div className="eyebrow">
            {['Prueba del puesto', prueba.modalidad].filter(Boolean).join(' · ')}
          </div>
          {/* La modalidad no es un titular: es un dato. El titular dice que se
              espera de la persona. */}
          <h1>{tiempoAgotado ? 'Se acabó el tiempo.' : 'Demuestra cómo trabajas.'}</h1>
          <p>
            {tiempoAgotado
              ? 'Guardamos todo lo que llegó dentro del plazo. Ya no se puede editar nada.'
              : prueba.estadoIntento === 'EN_CURSO'
                ? 'El cronómetro está corriendo y no se detiene al cerrar esta página.'
                : prueba.estadoIntento === 'ENTREGADA'
                  ? 'Ya entregaste esta prueba.'
                  : 'Lee todo antes de empezar. El tiempo comenzará únicamente cuando confirmes.'}
          </p>
        </div>
      </div>

      <div className="desktop-warning callout warn">
        <b>Recomendamos usar una computadora</b>
        <p>La prueba requiere consultar instrucciones y cargar entregables.</p>
      </div>

      {prueba.estadoIntento === 'ENTREGADA' && (
        <div className="medida-lectura">
          <div className="cierre">
            <span className="tag good">Entregada</span>
            <b>Prueba entregada</b>
            <p>
              Estamos calificando tu entregable y la explicación de tus decisiones. Te
              avisaremos cuando haya novedades.
            </p>
            <div className="row entregada-datos">
              <span className="small">
                Entregables: {prueba.entregables.filter((e) => e.entregado).length} de{' '}
                {prueba.entregables.length}
              </span>
              <Link className="btn" to={rutas.proceso(uuid)}>
                Volver a mi proceso
              </Link>
            </div>
          </div>
        </div>
      )}

      {prueba.estadoIntento === 'PENDIENTE' && (
        <div className="detail-layout">
          <article className="card detail">
            <h2 style={{ marginTop: 0 }}>El reto</h2>
            {prueba.enunciado ? (
              <TextoPlano texto={prueba.enunciado} queEs="el enunciado de la prueba" />
            ) : (
              <p>Recibirás el enunciado al empezar.</p>
            )}

            {prueba.materiales && (
              <>
                <h2>Materiales</h2>
                <TextoPlano texto={prueba.materiales} queEs="el material de apoyo" />
              </>
            )}

            {prueba.herramientasPermitidas && (
              <>
                <h2>Herramientas permitidas</h2>
                <TextoPlano texto={prueba.herramientasPermitidas} queEs="el documento" />
              </>
            )}

            {prueba.entregables.length > 0 && (
              <>
                <h2>Lo que tendrás que entregar</h2>
                <ul>
                  {prueba.entregables.map((e) => (
                    <li key={e.id}>
                      {e.nombre}
                      {e.esObligatorio ? '' : ' (opcional)'}
                      {/* Saberlo antes de empezar evita descubrirlo con el
                          reloj corriendo. */}
                      <span className="small"> · {comoSeEntrega(e.formato).toLowerCase()}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="callout warn">
              <b>Puede aparecer un cambio inesperado</b>
              <p>
                A mitad de la prueba puede cambiar una condición del problema. Tendrás
                tiempo adicional para adaptar tu solución.
              </p>
            </div>
          </article>

          <aside className="timer-card">
            <div className="timer-label">Duración total</div>
            <div className="timer">
              {prueba.duracionMinutos ? `${String(prueba.duracionMinutos).padStart(2, '0')}:00` : '--:--'}
            </div>
            <p>
              Una vez iniciada, la prueba no puede pausarse. Si el tiempo termina, se
              entregará lo que hayas guardado.
            </p>
            <button
              className="btn large"
              style={{ width: '100%', marginTop: 20 }}
              onClick={() => setConfirmarInicio(true)}
            >
              Empezar prueba
            </button>
          </aside>
        </div>
      )}

      {prueba.estadoIntento === 'EN_CURSO' && (
        <div className="challenge-layout">
          <article>
            {tiempoAgotado && (
              <div className="callout bad tiempo-agotado" role="alert">
                <b>Terminó el plazo de esta prueba</b>
                <p>
                  Ya no se puede escribir ni subir nada: el servidor no lo admitiría.
                  Quedó guardado todo lo que llegó a tiempo, y en unos segundos la prueba
                  se entregará sola con eso. No cierres la página: se actualizará aquí
                  mismo.
                </p>
              </div>
            )}

            <div className="card detail">
              <div className="label">Instrucciones</div>
              {/* El enunciado ya no va en un `h2`: son varios parrafos y suele
                  llevar dentro el enlace al PDF de la prueba. */}
              <div style={{ marginTop: 12 }}>
                <TextoPlano texto={prueba.enunciado ?? ''} queEs="el enunciado de la prueba" />
              </div>

              {/* Durante la prueba tambien hacen falta: el enlace al PDF puede
                  estar en cualquiera de los tres campos, no solo en el reto. */}
              {prueba.materiales && (
                <>
                  <h2>Materiales</h2>
                  <TextoPlano texto={prueba.materiales} queEs="el material de apoyo" />
                </>
              )}

              {prueba.herramientasPermitidas && (
                <>
                  <h2>Herramientas permitidas</h2>
                  <TextoPlano texto={prueba.herramientasPermitidas} queEs="el documento" />
                </>
              )}

              {prueba.cambioTexto && (
                <div className="unexpected">
                  <div className="label warn">Cambio inesperado</div>
                  <h3>{prueba.cambioTexto}</h3>
                  <p>
                    Adapta tu propuesta sin perder lo que ya registraste. Explica qué
                    decisión tomaste y por qué.
                  </p>
                </div>
              )}

              {prueba.preguntas.length > 0 && (
                <>
                  <div className="sectionhead">
                    <div>
                      <h2>Tus respuestas</h2>
                      <p>
                        {tiempoAgotado
                          ? 'Así quedaron. Ya no se pueden cambiar.'
                          : 'Se guardan solas mientras escribes.'}
                      </p>
                    </div>
                  </div>
                  <div className="formgrid">
                    {prueba.preguntas.map((p) => (
                      <PreguntaPrueba
                        key={p.id}
                        uuid={uuid}
                        pregunta={p}
                        bloqueado={tiempoAgotado}
                        onPendiente={marcarPendiente}
                      />
                    ))}
                  </div>
                </>
              )}

              {prueba.entregables.length > 0 && (
                <>
                  <div className="sectionhead">
                    <div>
                      <h2>Entregables</h2>
                      <p>
                        {tiempoAgotado
                          ? 'Ya no se admiten envíos.'
                          : 'Cada uno indica si se entrega como archivo o como enlace.'}
                      </p>
                    </div>
                  </div>
                  <div className="stack">
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
                </>
              )}

              <div className="row" style={{ marginTop: 18 }}>
                {tiempoAgotado ? (
                  <span className="small">
                    No tienes que hacer nada más: la entrega se cierra sola con lo que ya
                    estaba guardado.
                  </span>
                ) : (
                  <>
                    <span className="small">
                      Usar IA está permitido. Evaluamos si entiendes y verificas tu trabajo.
                    </span>
                    <button className="btn primary" onClick={() => setConfirmarEntrega(true)}>
                      Entregar prueba
                    </button>
                  </>
                )}
              </div>
            </div>
          </article>

          <aside>
            <div className="timer-card">
              {tiempoAgotado ? (
                <>
                  <div className="timer-label">Tiempo agotado</div>
                  <div className="timer">00:00:00</div>
                  <p>Estamos cerrando tu prueba con lo que guardaste dentro del plazo.</p>
                </>
              ) : (
                <>
                  <div className="timer-label">Tiempo real restante</div>
                  <Cronometro venceEn={prueba.venceEn} alAgotarse={refrescar} />
                  <p>
                    Este cronómetro lo lleva el servidor: sigue corriendo aunque cierres la
                    página.
                  </p>
                </>
              )}
            </div>
          </aside>
        </div>
      )}

      <Modal
        abierto={confirmarInicio}
        titulo="¿Empezar ahora?"
        onCerrar={() => setConfirmarInicio(false)}
        pie={
          <>
            <button className="btn" onClick={() => setConfirmarInicio(false)}>
              Aún no
            </button>
            <button
              className="btn primary"
              onClick={() => inicio.mutate()}
              disabled={inicio.isPending}
            >
              {inicio.isPending ? 'Abriendo…' : 'Sí, empezar'}
            </button>
          </>
        }
      >
        <div className="callout warn">
          <b>El tiempo no se detendrá</b>
          <p>
            Si cierras el navegador, el cronómetro seguirá corriendo. Al terminar, se
            entregará lo que hayas guardado.
          </p>
        </div>
        {inicio.isError && (
          <div className="error">
            {inicio.error instanceof Error ? inicio.error.message : 'No pudimos abrirla.'}
          </div>
        )}
      </Modal>

      <Modal
        abierto={confirmarEntrega}
        titulo="Entregar prueba"
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
              disabled={entrega.isPending || sinGuardar.length > 0}
            >
              {entrega.isPending ? 'Entregando…' : 'Entregar'}
            </button>
          </>
        }
      >
        {sinGuardar.length > 0 ? (
          <div className="callout bad">
            <b>
              {sinGuardar.length === 1
                ? 'Una respuesta aún no ha llegado al servidor'
                : `${sinGuardar.length} respuestas aún no han llegado al servidor`}
            </b>
            <p>
              Estamos reintentándolo. Si entregas ahora se quedarían fuera. En cuanto se
              guarden podrás entregar.
            </p>
          </div>
        ) : (
          <p className="small">
            Después de entregar no podrás modificar archivos, enlaces ni respuestas.
          </p>
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
