/**
 * La ficha de una vacante y el proceso que le espera al candidato.
 *
 * Las cinco etapas salen de `dominio/estados.ts`. El mockup las tenia escritas
 * a mano y por eso enseñaba las de la version vieja.
 */

import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { verVacante } from '@/api/portal'
import { ETAPAS } from '@/dominio/estados'
import { rutas } from '@/rutas'
import { useSesion } from '@/app/Sesion'
import { Cargando, Fallo } from '@/ui/Mensajes'

/** Que hace el candidato en cada etapa. Es texto de producto, no datos. */
const QUE_PASA_EN: Record<string, string> = {
  PERFIL: 'Sube tu CV y responde la evaluación',
  PRUEBA: 'Demuestra el trabajo con tiempo medido',
  SIMULACION: 'Trabaja en una sesión grupal',
  VALIDACION: 'Evidencia durante el periodo acordado',
  DECISION: 'Una persona toma la decisión final',
}

/**
 * El backend manda estos campos como un texto con saltos de linea, uno por
 * punto. Pintarlo tal cual daba un parrafo largo donde deberia haber una lista.
 */
function Puntos({ texto }: { texto: string }) {
  const lineas = texto
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  if (lineas.length < 2) return <p>{texto}</p>

  return (
    <ul>
      {lineas.map((linea) => (
        <li key={linea}>{linea}</li>
      ))}
    </ul>
  )
}

export function Vacante() {
  const { vacanteId = '' } = useParams()
  const { hayCuenta } = useSesion()

  const consulta = useQuery({
    queryKey: ['vacante', vacanteId],
    queryFn: () => verVacante(vacanteId),
    enabled: vacanteId !== '',
  })

  if (consulta.isPending) return <Cargando que="Abriendo la vacante…" />
  if (consulta.isError) {
    return <Fallo error={consulta.error} reintentar={() => void consulta.refetch()} />
  }

  const v = consulta.data
  const destinoAlPostular = hayCuenta ? rutas.postular(v.id) : rutas.registro(v.id)

  return (
    <>
      <Link className="back" to={rutas.vacantes()}>
        ← Volver a vacantes
      </Link>

      <div className="pagehead">
        <div>
          <div className="eyebrow">
            {[v.modalidad, v.ubicacion].filter(Boolean).join(' · ')}
          </div>
          <h1>{v.titulo}</h1>
          <p>{v.proposito ?? v.descripcion}</p>
        </div>
      </div>

      <div className="detail-layout">
        <article className="detail">
          <div className="card">
            {v.descripcion && (
              <>
                <h2 style={{ marginTop: 0 }}>El resultado que esperamos</h2>
                <p>{v.descripcion}</p>
              </>
            )}

            {v.responsabilidades && (
              <>
                <h2>Lo que harás</h2>
                <Puntos texto={v.responsabilidades} />
              </>
            )}

            {v.requisitos && (
              <>
                <h2>Lo que necesitamos</h2>
                <Puntos texto={v.requisitos} />
              </>
            )}

            {v.requisitosObjetivos.length > 0 && (
              <>
                <h2>Requisitos indispensables</h2>
                <p>
                  Son las únicas condiciones que pueden detener una postulación de forma
                  automática. Te pediremos que las confirmes al postular.
                </p>
                <ul>
                  {v.requisitosObjetivos.map((r) => (
                    <li key={r.id}>{r.descripcion}</li>
                  ))}
                </ul>
              </>
            )}

            {(v.horario ?? v.compensacionPublica) && (
              <>
                <h2>Condiciones</h2>
                <ul>
                  {v.horario && <li>{v.horario}</li>}
                  {v.compensacionPublica && <li>{v.compensacionPublica}</li>}
                </ul>
              </>
            )}

            <h2>Cómo evaluamos</h2>
            <p>
              Una inteligencia artificial participa en algunas calificaciones y explica su
              criterio. Nadie queda fuera de forma automática salvo por un requisito
              indispensable, y las decisiones sensibles las revisa una persona.
            </p>
          </div>
        </article>

        <aside className="sticky">
          {/* Los datos duros primero: es lo que se mira antes de decidir. */}
          <div className="card ficha">
            <div className="row">
              <span>Modalidad</span>
              <b>{v.modalidad ?? 'Por definir'}</b>
            </div>
            <div className="divider" />
            <div className="row">
              <span>Ubicación</span>
              <b>{v.ubicacion ?? 'Por definir'}</b>
            </div>
            <div className="divider" />
            <div className="row">
              <span>Jornada</span>
              <b>{v.horario ?? 'Por definir'}</b>
            </div>
            <Link className="btn primary large" to={destinoAlPostular}>
              Postular
            </Link>
            <span className="small ficha-pie">
              {hayCuenta
                ? 'Confirmarás los requisitos indispensables antes de enviar.'
                : 'Necesitarás una cuenta. Se crea en un minuto.'}
            </span>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="label">Proceso de selección</div>
            <div className="stage-list" style={{ marginTop: 14 }}>
              {ETAPAS.map((etapa, i) => (
                <div className="stage" key={etapa.clave}>
                  <div className="stage-num">{i + 1}</div>
                  <div>
                    <b>{etapa.etiqueta}</b>
                    <span>{QUE_PASA_EN[etapa.clave]}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </>
  )
}
