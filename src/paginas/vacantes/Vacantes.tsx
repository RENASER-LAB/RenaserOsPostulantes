/** La portada: que es el proceso y que vacantes hay abiertas. */

import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { listarVacantes } from '@/api/portal'
import type { VacantePublica } from '@/api/tipos'
import { ETAPAS } from '@/dominio/estados'
import { rutas } from '@/rutas'
import { Cargando, Fallo } from '@/ui/Mensajes'

/**
 * Una linea por etapa, en el mismo orden que la barra de pasos. Los nombres no
 * se escriben aqui: salen de `dominio/estados.ts`, que es quien manda.
 */
const QUE_ESPERAR: Record<string, string> = {
  PERFIL: 'Tu currículum y una evaluación escrita.',
  PRUEBA: 'Un reto real del puesto, con tiempo medido.',
  SIMULACION: 'Una sesión grupal de dos horas.',
  VALIDACION: 'Un periodo corto trabajando de verdad.',
  DECISION: 'La conversación final.',
}

function Flecha() {
  return (
    <svg viewBox="0 0 24 24" className="flecha" aria-hidden="true">
      <path
        d="M9 5.5 15.5 12 9 18.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

function TarjetaVacante({ vacante }: { vacante: VacantePublica }) {
  const meta = [vacante.modalidad, vacante.ubicacion].filter(Boolean).join(' · ')

  return (
    <Link className="card job action" to={rutas.vacante(vacante.id)}>
      <span className="label">{meta || 'Convocatoria abierta'}</span>
      <h2>{vacante.titulo}</h2>
      <p>{vacante.proposito ?? vacante.descripcion}</p>
      <div className="job-footer">
        <span>Ver vacante</span>
        <Flecha />
      </div>
    </Link>
  )
}

export function Vacantes() {
  const consulta = useQuery({ queryKey: ['vacantes'], queryFn: listarVacantes })

  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">Excelencia que se reconoce</span>
          <h1>
            Tu talento.
            <br />
            Tu oportunidad.
          </h1>
          <span className="regla" />
          <p>
            Encuentra tu próxima oportunidad en Renaser. Cada etapa deja evidencia de lo
            que sabes hacer, no de lo que dice tu currículum.
          </p>
        </div>

        <aside className="hero-card">
          <b>Qué puedes esperar del proceso</b>
          <p>Cinco etapas. Siempre sabes en cuál estás.</p>
          <ol>
            {ETAPAS.map((etapa) => (
              <li key={etapa.clave}>
                <div>
                  <b>{etapa.etiqueta}</b>
                  <span>{QUE_ESPERAR[etapa.clave]}</span>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </section>

      <div className="sectionhead">
        <div>
          <h2>Vacantes abiertas</h2>
          <p>Elige una oportunidad para conocer el proceso y postular.</p>
        </div>
        {consulta.data && consulta.data.length > 0 && (
          <span className="small">
            {consulta.data.length} {consulta.data.length === 1 ? 'abierta' : 'abiertas'}
          </span>
        )}
      </div>

      {consulta.isPending && <Cargando que="Buscando vacantes…" />}
      {consulta.isError && (
        <Fallo error={consulta.error} reintentar={() => void consulta.refetch()} />
      )}

      {consulta.data &&
        (consulta.data.length === 0 ? (
          <div className="callout">
            <b>Ahora mismo no hay vacantes abiertas</b>
            <p>Vuelve más adelante: publicamos nuevas convocatorias con frecuencia.</p>
          </div>
        ) : (
          <div className="grid g3">
            {consulta.data.map((v) => (
              <TarjetaVacante key={v.id} vacante={v} />
            ))}
          </div>
        ))}
    </>
  )
}
