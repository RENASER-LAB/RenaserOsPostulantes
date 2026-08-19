/**
 * La prueba del puesto.
 *
 * Tres cosas que la separan del mockup:
 *
 *   - **El cronometro es del servidor.** Sale de `venceEn`, no de la hora del
 *     navegador. Cambiar la hora del equipo no lo mueve.
 *   - **Los entregables son una lista.** Cada uno con su nombre, si es
 *     obligatorio y si ya se subio. El mockup tenia un archivo y un enlace
 *     sueltos.
 *   - **Tambien hay preguntas.** El backend las manda y el mockup las ignoraba.
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
import type { EntregableRequerido, MiPrueba } from '@/api/tipos'
import { rutas } from '@/rutas'
import { useAviso } from '@/ui/Avisos'
import { Cronometro } from '@/ui/Cronometro'
import { Modal } from '@/ui/Modal'
import { Cargando, Fallo } from '@/ui/Mensajes'

const ESPERA_ANTES_DE_GUARDAR = 1000
const CADA_20_SEGUNDOS = 20_000

// ---------- Un entregable ----------

function Entregable({
  uuid,
  entregable,
  alSubir,
}: {
  uuid: string
  entregable: EntregableRequerido
  alSubir: () => void
}) {
  const campoArchivo = useRef<HTMLInputElement>(null)
  const [enlace, setEnlace] = useState('')
  const [error, setError] = useState<string | null>(null)

  const archivo = useMutation({
    mutationFn: (f: File) => subirArchivo(uuid, entregable.id, f),
    onSuccess: alSubir,
    onError: (c) => setError(c instanceof Error ? c.message : 'No se pudo subir.'),
  })

  const url = useMutation({
    mutationFn: () => subirEnlace(uuid, entregable.id, enlace.trim()),
    onSuccess: () => {
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

      <div className="formgrid" style={{ marginTop: 14 }}>
        <div className="field">
          <label htmlFor={`enlace-${entregable.id}`}>Enlace</label>
          <input
            id={`enlace-${entregable.id}`}
            placeholder="https://"
            value={enlace}
            onChange={(e) => setEnlace(e.target.value)}
          />
        </div>
        <div className="field">
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
            disabled={archivo.isPending}
          >
            {archivo.isPending ? 'Subiendo…' : 'Seleccionar archivo'}
          </button>
        </div>
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        {entregable.formato && <span className="small">Formato: {entregable.formato}</span>}
        <button
          className="btn"
          type="button"
          onClick={() => url.mutate()}
          disabled={!enlace.trim() || url.isPending}
        >
          {url.isPending ? 'Guardando…' : 'Guardar enlace'}
        </button>
      </div>

      {error && <div className="error">{error}</div>}
    </div>
  )
}

// ---------- Una pregunta de la prueba ----------

function PreguntaPrueba({
  uuid,
  pregunta,
}: {
  uuid: string
  pregunta: { id: number; enunciado: string; respuestaTexto: string | null }
}) {
  const [texto, setTexto] = useState(pregunta.respuestaTexto ?? '')
  const [guardado, setGuardado] = useState(true)

  const guardar = useMutation({
    mutationFn: (valor: string) => responderPrueba(uuid, pregunta.id, valor),
    onSuccess: () => setGuardado(true),
  })

  const guardarTexto = guardar.mutate
  useEffect(() => {
    if (texto === (pregunta.respuestaTexto ?? '')) return
    setGuardado(false)
    const id = window.setTimeout(() => guardarTexto(texto), ESPERA_ANTES_DE_GUARDAR)
    return () => window.clearTimeout(id)
  }, [texto, pregunta.respuestaTexto, guardarTexto])

  return (
    <div className="field full">
      <label htmlFor={`pregunta-${pregunta.id}`}>{pregunta.enunciado}</label>
      <textarea
        id={`pregunta-${pregunta.id}`}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      <div className="hint">{guardado ? 'Guardado.' : 'Guardando…'}</div>
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

  const consulta = useQuery({
    queryKey: ['prueba', uuid],
    queryFn: () => verPrueba(uuid),
    enabled: uuid !== '',
    // Mientras corre, se vuelve a preguntar: el cambio inesperado llega por aqui.
    refetchInterval: (q) =>
      q.state.data?.estadoIntento === 'EN_CURSO' ? CADA_20_SEGUNDOS : false,
  })

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
          <div className="eyebrow">Prueba del puesto</div>
          <h1>{prueba.modalidad ?? 'Demuestra cómo trabajas'}</h1>
          <p>
            {prueba.estadoIntento === 'EN_CURSO'
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
        <div className="card center-card">
          <div className="status-icon">✓</div>
          <div className="eyebrow">Prueba entregada</div>
          <h1>Ya está en revisión.</h1>
          <p>
            Estamos calificando tu entregable y la explicación de tus decisiones. Te
            avisaremos cuando haya novedades.
          </p>
          <Link className="btn primary" to={rutas.proceso(uuid)} style={{ marginTop: 20 }}>
            Volver a mi proceso
          </Link>
        </div>
      )}

      {prueba.estadoIntento === 'PENDIENTE' && (
        <div className="detail-layout">
          <article className="card detail">
            <h2 style={{ marginTop: 0 }}>El reto</h2>
            <p>{prueba.enunciado ?? 'Recibirás el enunciado al empezar.'}</p>

            {prueba.materiales && (
              <>
                <h2>Materiales</h2>
                <p>{prueba.materiales}</p>
              </>
            )}

            {prueba.herramientasPermitidas && (
              <>
                <h2>Herramientas permitidas</h2>
                <p>{prueba.herramientasPermitidas}</p>
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
            <div className="card detail">
              <div className="label">Instrucciones</div>
              <h2 style={{ marginTop: 12 }}>{prueba.enunciado}</h2>

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
                      <p>Se guardan solas mientras escribes.</p>
                    </div>
                  </div>
                  <div className="formgrid">
                    {prueba.preguntas.map((p) => (
                      <PreguntaPrueba key={p.id} uuid={uuid} pregunta={p} />
                    ))}
                  </div>
                </>
              )}

              {prueba.entregables.length > 0 && (
                <>
                  <div className="sectionhead">
                    <div>
                      <h2>Entregables</h2>
                      <p>Puedes subir archivos o pegar enlaces.</p>
                    </div>
                  </div>
                  <div className="stack">
                    {prueba.entregables.map((e) => (
                      <Entregable key={e.id} uuid={uuid} entregable={e} alSubir={refrescar} />
                    ))}
                  </div>
                </>
              )}

              <div className="row" style={{ marginTop: 18 }}>
                <span className="small">
                  Usar IA está permitido. Evaluamos si entiendes y verificas tu trabajo.
                </span>
                <button className="btn primary" onClick={() => setConfirmarEntrega(true)}>
                  Entregar prueba
                </button>
              </div>
            </div>
          </article>

          <aside>
            <div className="timer-card">
              <div className="timer-label">Tiempo real restante</div>
              <Cronometro venceEn={prueba.venceEn} alAgotarse={refrescar} />
              <p>
                Este cronómetro lo lleva el servidor: sigue corriendo aunque cierres la
                página.
              </p>
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
              disabled={entrega.isPending}
            >
              {entrega.isPending ? 'Entregando…' : 'Entregar'}
            </button>
          </>
        }
      >
        <p className="small">
          Después de entregar no podrás modificar archivos, enlaces ni respuestas.
        </p>
        {entrega.isError && (
          <div className="error">
            {entrega.error instanceof Error ? entrega.error.message : 'No pudimos entregar.'}
          </div>
        )}
      </Modal>
    </>
  )
}
