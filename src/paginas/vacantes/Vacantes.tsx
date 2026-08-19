/** La portada: que es el proceso y que vacantes hay abiertas. */

import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { listarVacantes } from '@/api/portal'
import type { VacantePublica } from '@/api/tipos'
import { TOTAL_ETAPAS } from '@/dominio/estados'
import { rutas } from '@/rutas'
import { Cargando, Fallo } from '@/ui/Mensajes'

const QUE_ESPERAR = [
  'Postulas con tu CV y evidencia de trabajo.',
  'Respondes una evaluación y una prueba del puesto.',
  'Siempre ves tu etapa y tu siguiente acción.',
]

function TarjetaVacante({ vacante }: { vacante: VacantePublica }) {
  return (
    <Link className="card job action" to={rutas.vacante(vacante.id)}>
      <div className="row">
        {vacante.modalidad && <span className="tag info">{vacante.modalidad}</span>}
        {vacante.ubicacion && <span className="small">{vacante.ubicacion}</span>}
      </div>
      <h2>{vacante.titulo}</h2>
      <p>{vacante.proposito ?? vacante.descripcion}</p>
      <div className="job-footer">
        <span className="small">Proceso de {TOTAL_ETAPAS} etapas</span>
        <span className="link">Ver vacante</span>
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
          <h1>Encuentra tu próxima oportunidad en Renaser.</h1>
          <p>
            Buscamos personas que conviertan problemas en resultados. Aquí podrás conocer
            cada vacante y demostrar cómo trabajas, más allá de tu CV.
          </p>
        </div>
        <aside className="hero-card">
          <b>Qué puedes esperar del proceso</b>
          <ol>
            {QUE_ESPERAR.map((paso) => (
              <li key={paso}>
                <span>{paso}</span>
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
        {consulta.data && (
          <span className="tag info">
            {consulta.data.length}{' '}
            {consulta.data.length === 1 ? 'oportunidad' : 'oportunidades'}
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
