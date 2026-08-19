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

      <div className="card center-card">
        <div className="status-icon">?</div>
        <div className="eyebrow">Decisión · evidencia adicional</div>
        <h1>Queremos resolver una duda antes de decidir.</h1>
        <p>
          Tu candidatura para <b>{consulta.data.resumen.vacante}</b> llegó al final del
          proceso, pero hay un punto concreto que necesitamos aclarar antes de tomar una
          decisión. No es un rechazo: es lo contrario, significa que el proceso sigue
          abierto.
        </p>

        <div className="callout" style={{ marginTop: 22 }}>
          <b>Cómo sigue</b>
          <p>
            Nos pondremos en contacto contigo para pedirte esa evidencia. En cuanto la
            recibamos, la decisión vuelve a la persona responsable.
          </p>
        </div>

        <div className="row" style={{ marginTop: 22 }}>
          <Link className="link" to={rutas.procesos()}>
            Ver todos mis procesos
          </Link>
          <Link className="btn" to={rutas.proceso(uuid)}>
            Ver el detalle
          </Link>
        </div>
      </div>
    </>
  )
}
