/**
 * La portada: qué es este proceso y qué vacantes hay abiertas.
 *
 * Es la única pantalla en modo Persuade —quien llega todavía no ha postulado y
 * tiene que decidir si le merece la pena— pero el mundo no cambia: el proceso se
 * dibuja como recorrido, igual que dentro del portal. Lo que ve antes de entrar
 * es lo mismo que verá después.
 *
 * Se ve sin cuenta. `GET /vacantes` es público.
 */

import type { CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { listarVacantes } from '@/api/portal'
import type { VacantePublica } from '@/api/tipos'
import { ETAPAS } from '@/dominio/estados'
import { rutas } from '@/rutas'
import { Canto } from '@/ui/Canto'
import estilos from './Vacantes.module.css'

/** Qué hace el candidato en cada etapa. Es texto de producto, no dato. */
const QUE_ES: Record<string, string> = {
  PERFIL: 'Subes tu currículum y respondes una evaluación escrita sobre cómo trabajas.',
  PRUEBA: 'Un encargo real del puesto, con el tiempo medido.',
  SIMULACION: 'Una sesión de trabajo con el equipo, en una fecha que eliges tú.',
  VALIDACION: 'Un periodo corto trabajando de verdad, con acuerdo y responsable.',
  DECISION: 'Una persona decide, mirando todo el recorrido.',
}

export function Vacantes() {
  const consulta = useQuery({ queryKey: ['vacantes'], queryFn: listarVacantes })
  // Lo que llegue por la red no puede dar por hecho que tiene la forma
  // prometida: un cuerpo que no sea lista reventaba la pantalla entera.
  const vacantes = Array.isArray(consulta.data) ? consulta.data : []

  return (
    <div className={estilos.pagina}>
      {/*
        Otra semilla y menos luz que en «Mis procesos», y no por variar: alli la
        banda esta formada porque hay un proceso en marcha, y aqui todavia no ha
        empezado nada. Es la misma luz formandose.
      */}
      <Canto semilla={7} intensidad={0.6} />

      <h1 className={estilos.entrada}>Tu próximo trabajo puede empezar aquí.</h1>
      <p className={estilos.bajada}>
        El proceso son cinco etapas, y en todas se mira cómo trabajas. Tu currículum entra,
        pero por diseño no descarta a nadie.
      </p>

      <section className={estilos.proceso}>
        <h2 className={estilos.tituloProceso}>Lo que te espera</h2>
        <ol className={estilos.etapas} role="list">
          {ETAPAS.map((etapa, indice) => (
            <li
              className={estilos.etapa}
              key={etapa.clave}
              style={{ '--i': indice } as CSSProperties}
            >
              {/* La rebanada del espectro que le toca a esta etapa por su sitio. */}
              <div className={estilos.marca} aria-hidden="true" />
              <div className={estilos.textoEtapa}>
                <p className={estilos.nombreEtapa}>{etapa.etiqueta}</p>
                <p className={estilos.queEsEtapa}>{QUE_ES[etapa.clave]}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className={estilos.seccionVacantes}>
        <div className={estilos.cabeceraVacantes}>
          <h2>Vacantes abiertas</h2>
          {vacantes.length > 0 && (
            <span className={estilos.cuantas}>
              {vacantes.length} {vacantes.length === 1 ? 'puesto' : 'puestos'}
            </span>
          )}
        </div>

        {consulta.isPending && (
          <div className={estilos.marco} aria-busy="true">
            <h3>Buscando vacantes…</h3>
            <div className={estilos.barra} />
            <div className={`${estilos.barra} ${estilos.barraMedia}`} />
            <div className={`${estilos.barra} ${estilos.barraCorta}`} />
          </div>
        )}

        {consulta.isError && (
          <div className={estilos.marco}>
            <h3>No pudimos cargar las vacantes.</h3>
            <p className={estilos.marcoTexto}>
              {consulta.error instanceof Error
                ? consulta.error.message
                : 'No pudimos conectar con el servidor.'}
            </p>
            <button
              type="button"
              className={estilos.reintentar}
              onClick={() => void consulta.refetch()}
            >
              Intentar de nuevo
            </button>
          </div>
        )}

        {!consulta.isPending && !consulta.isError && vacantes.length === 0 && (
          <div className={estilos.marco}>
            <h3>Ahora mismo no hay vacantes abiertas.</h3>
            <p className={estilos.marcoTexto}>
              Publicamos convocatorias nuevas con frecuencia. Vuelve por aquí en unos días.
            </p>
          </div>
        )}

        {vacantes.length > 0 && (
          <div className={estilos.lista}>
            {vacantes.map((v) => (
              <Vacante key={v.id} vacante={v} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function Vacante({ vacante }: { vacante: VacantePublica }) {
  const donde = [vacante.modalidad, vacante.ubicacion, vacante.horario]
    .filter(Boolean)
    .join(' · ')
  // Casi todos los campos de la vacante pueden venir vacios, asi que se elige
  // el primero que traiga algo en vez de dar por hecho ninguno.
  const resumen = vacante.proposito ?? vacante.descripcion

  return (
    <article className={estilos.vacante}>
      <Link className={estilos.enlaceVacante} to={rutas.vacante(vacante.id)}>
        <h3 className={estilos.tituloVacante}>{vacante.titulo}</h3>
        {donde && <span className={estilos.donde}>{donde}</span>}
        {resumen && <p className={estilos.queSeHace}>{resumen}</p>}
        <span className={estilos.ver}>Ver el puesto y postular →</span>
      </Link>
    </article>
  )
}
