/**
 * El caso ambar: se pide una evidencia adicional antes de decidir.
 *
 * ⚠️ Esta pantalla esta a medias, y a proposito.
 *
 * El estado `DECISION_TURNO_CANDIDATO` existe en el backend, pero **no hay
 * ninguna ruta en `/api/v1/portal` para mandar esa evidencia**: no existe ni
 * para leer que se esta pidiendo, ni para subir la respuesta. Ver el analisis
 * en `docs/01-ANALISIS-PORTAL.md`.
 *
 * Mientras no exista, esta pantalla explica la situacion en vez de fingir un
 * formulario que no llegaria a ninguna parte. En cuanto el backend abra la
 * ruta, aqui van: el texto de la duda concreta, el campo de evidencia y el
 * contador de rondas (el tope son 2).
 */

import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { verPostulacion } from '@/api/portal'
import { rutas } from '@/rutas'
import { Cargando, Fallo } from '@/ui/Mensajes'

const COMO_SIGUE = [
  {
    titulo: 'Te escribirá una persona del equipo',
    texto: 'Te dirá exactamente qué necesita y por qué. No hay nada que subir desde aquí.',
  },
  {
    titulo: 'Responde cuando puedas',
    texto: 'Tómate el tiempo de preparar lo que te pidan. Esto no caduca en horas.',
  },
  {
    titulo: 'Después viene la decisión',
    texto: 'Con esa evidencia, el responsable cierra el proceso en un sentido o en otro.',
  },
]

export function Decision() {
  const { uuid = '' } = useParams()

  const consulta = useQuery({
    queryKey: ['postulacion', uuid],
    queryFn: () => verPostulacion(uuid),
    enabled: uuid !== '',
  })

  if (consulta.isPending) return <Cargando que="Cargando tu proceso…" />
  if (consulta.isError) {
    return <Fallo error={consulta.error} reintentar={() => void consulta.refetch()} />
  }

  return (
    <>
      <Link className="back" to={rutas.proceso(uuid)}>
        ← Volver a mi proceso
      </Link>

      {/* Ambar, no rojo: el proceso sigue abierto y eso tiene que leerse antes
          que cualquier otra cosa. */}
      <section className="decision-panel">
        <span className="eyebrow">Decisión · evidencia adicional</span>
        <h1>Queremos resolver una duda antes de decidir.</h1>
        <p>
          Tu candidatura para <b>{consulta.data.resumen.vacante}</b> llegó al final del
          proceso. El equipo necesita ver una cosa más antes de la conversación final: no
          es un rechazo, es lo contrario.
        </p>
      </section>

      <div className="detail-layout">
        <div>
          <div className="sectionhead" style={{ marginTop: 0 }}>
            <div>
              <h2>Cómo sigue</h2>
            </div>
          </div>
          <div className="grid g3">
            {COMO_SIGUE.map((paso) => (
              <div className="callout" key={paso.titulo}>
                <b>{paso.titulo}</b>
                <p>{paso.texto}</p>
              </div>
            ))}
          </div>
        </div>

        <aside className="sticky">
          <div className="card">
            <div className="label">Si tienes dudas</div>
            <p className="small" style={{ margin: '8px 0 14px' }}>
              Escríbenos y te contamos en qué punto está tu proceso.
            </p>
            <a className="link" href="mailto:talento@renaser.pe">
              talento@renaser.pe
            </a>
            <div className="divider" />
            <Link className="btn" to={rutas.proceso(uuid)} style={{ width: '100%' }}>
              Ver el detalle de mi proceso
            </Link>
          </div>
        </aside>
      </div>
    </>
  )
}
