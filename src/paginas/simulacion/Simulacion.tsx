/**
 * La simulacion de trabajo: elegir fecha y, ya inscrito, ver la agenda.
 *
 * Las fechas vienen del servidor con sus plazas libres. El mockup las tenia
 * escritas a mano, con dos opciones fijas.
 *
 * Los tramos de la sesion tambien son del servidor: el mockup enseñaba seis
 * fijos y en realidad los define cada sesion.
 */

import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { inscribirse, miSesion, sesionesDisponibles } from '@/api/simulacion'
import { ErrorApi } from '@/api/cliente'
import { formatearFechaLarga } from '@/dominio/reloj'
import { rutas } from '@/rutas'
import { useAviso } from '@/ui/Avisos'
import { Cargando, Fallo } from '@/ui/Mensajes'

export function Simulacion() {
  const { uuid = '' } = useParams()
  const avisar = useAviso()
  const cache = useQueryClient()
  const [elegida, setElegida] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Si ya esta inscrito, esta consulta trae la sesion. Si no, el backend
  // responde 404 y hay que enseñar las fechas disponibles.
  const inscripcion = useQuery({
    queryKey: ['mi-sesion', uuid],
    queryFn: () => miSesion(uuid),
    enabled: uuid !== '',
    retry: (intentos, causa) =>
      causa instanceof ErrorApi && causa.esAjeno ? false : intentos < 2,
  })

  const yaInscrito = inscripcion.isSuccess

  const disponibles = useQuery({
    queryKey: ['sesiones', uuid],
    queryFn: () => sesionesDisponibles(uuid),
    enabled: uuid !== '' && inscripcion.isError,
  })

  const inscripcionNueva = useMutation({
    mutationFn: (sesionId: number) => inscribirse(uuid, sesionId),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ['mi-sesion', uuid] })
      await cache.invalidateQueries({ queryKey: ['postulaciones'] })
      avisar('Asistencia confirmada.')
    },
    onError: (causa) => {
      setError(causa instanceof Error ? causa.message : 'No pudimos confirmar la fecha.')
    },
  })

  if (inscripcion.isPending) return <Cargando que="Revisando tu simulación…" />

  // ---------- Ya tiene fecha ----------

  if (yaInscrito) {
    const s = inscripcion.data
    return (
      <>
        <Link className="back" to={rutas.proceso(uuid)}>
          ← Volver a mi proceso
        </Link>

        <div className="pagehead">
          <div>
            <div className="eyebrow">Simulación confirmada</div>
            <h1>{formatearFechaLarga(s.fechaHora)}</h1>
            <p>
              {[s.lugar, s.modalidad].filter(Boolean).join(' · ')}. Llega 15 minutos antes.
            </p>
          </div>
          <span className="tag good">Asistencia confirmada</span>
        </div>

        {s.enlace && (
          <div className="callout" style={{ marginBottom: 18 }}>
            <b>Enlace de la sesión</b>
            <p>
              <a href={s.enlace} target="_blank" rel="noreferrer">
                {s.enlace}
              </a>
            </p>
          </div>
        )}

        {s.enunciado && (
          <div className="card" style={{ marginBottom: 18 }}>
            <div className="label">Sobre la sesión</div>
            <p className="small" style={{ marginTop: 10 }}>
              {s.enunciado}
            </p>
          </div>
        )}

        {s.tramos.length > 0 && (
          <>
            <div className="sectionhead">
              <div>
                <h2>Así se desarrollará la sesión</h2>
                <p>Cada momento tiene una duración definida.</p>
              </div>
            </div>
            <div className="phase-grid">
              {s.tramos.map((t, i) => (
                <div className={`phase${i === 0 ? ' current' : ''}`} key={t.codigo}>
                  <b>{t.nombre}</b>
                  <span>{t.minutoFin - t.minutoInicio} min</span>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="grid g2" style={{ marginTop: 18 }}>
          <div className="card">
            <div className="label">Qué debes llevar</div>
            <p className="small">
              Documento de identidad, computadora con cargador y acceso a tus herramientas
              habituales.
            </p>
          </div>
          <div className="card">
            <div className="label">Durante la sesión</div>
            <p className="small">
              Podrás preguntar, producir evidencia, adaptarte a un cambio y conversar con
              una persona al final.
            </p>
          </div>
        </div>
      </>
    )
  }

  // ---------- Todavia tiene que elegir ----------

  return (
    <>
      <Link className="back" to={rutas.proceso(uuid)}>
        ← Volver a mi proceso
      </Link>

      <div className="pagehead">
        <div>
          <div className="eyebrow">Simulación de trabajo</div>
          <h1>Elige una fecha.</h1>
          <p>
            La sesión es grupal. Trabajarás en tu propia pantalla dentro del sistema.
          </p>
        </div>
      </div>

      {disponibles.isPending && <Cargando que="Buscando fechas disponibles…" />}
      {disponibles.isError && (
        <Fallo error={disponibles.error} reintentar={() => void disponibles.refetch()} />
      )}

      {disponibles.data &&
        (disponibles.data.length === 0 ? (
          <div className="callout warn">
            <b>Todavía no hay fechas con cupo</b>
            <p>
              En cuanto se publique una sesión para tu vacante te avisaremos y aparecerá
              aquí.
            </p>
          </div>
        ) : (
          <div className="card form-card">
            <div className="stack">
              {disponibles.data.map((s) => (
                <label
                  className={`date-option${elegida === s.id ? ' selected' : ''}`}
                  key={s.id}
                >
                  <input
                    type="radio"
                    name="fecha"
                    checked={elegida === s.id}
                    onChange={() => {
                      setElegida(s.id)
                      setError(null)
                    }}
                  />
                  <b>{formatearFechaLarga(s.fechaHora)}</b>
                  <span>
                    {[s.lugar, s.modalidad].filter(Boolean).join(' · ')} · {s.duracionMinutos}{' '}
                    min · {s.plazasLibres}{' '}
                    {s.plazasLibres === 1 ? 'plaza libre' : 'plazas libres'}
                  </span>
                </label>
              ))}
            </div>

            {error && <div className="error">{error}</div>}

            <div className="row" style={{ marginTop: 20 }}>
              <span className="small">
                Recibirás un correo con la confirmación, no con las preguntas.
              </span>
              <button
                className="btn primary large"
                disabled={elegida === null || inscripcionNueva.isPending}
                onClick={() => {
                  if (elegida === null) {
                    setError('Selecciona una fecha para confirmar tu asistencia.')
                    return
                  }
                  inscripcionNueva.mutate(elegida)
                }}
              >
                {inscripcionNueva.isPending ? 'Confirmando…' : 'Confirmar asistencia'}
              </button>
            </div>
          </div>
        ))}
    </>
  )
}
