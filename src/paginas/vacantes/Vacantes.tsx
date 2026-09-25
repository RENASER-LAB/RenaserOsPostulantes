/**
 * La portada: qué es este proceso y qué vacantes hay abiertas.
 *
 * Es la única pantalla en modo Persuade —quien llega todavía no ha postulado y
 * tiene que decidir si le merece la pena—, y desde el rediseño de 09/2026 la
 * compone el mundo nuevo: fondo blanco, titular centrado, acción en negro y dos
 * piezas de color —la loseta con el maletín incrustada en el titular y el
 * resplandor coral dentro del escaparate—.
 *
 * La pieza grande es el escaparate: una tarjeta blanca de borde grueso con el
 * recorrido dentro, que enseña el producto en vez de decorar la pantalla. En su
 * sitio hubo una banda irisada, que se fue con el mundo anterior.
 *
 * Lo que no cambia es la promesa: lo que ve antes de entrar es lo mismo que verá
 * después, porque el recorrido se dibuja igual aquí que dentro del portal.
 *
 * Se ve sin cuenta. `GET /vacantes` es público.
 *
 * Desde el 25/09/2026 la sección de vacantes enseña **las tres más recientes** y
 * manda a `/vacantes`, que es donde se busca, se filtra y se ordena. Los enlaces
 * viejos a `/#vacantes-abiertas` siguen cayendo en esa sección.
 */

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { listarVacantes } from '@/api/portal'
import { ETAPAS } from '@/dominio/estados'
import { ahora as ahoraDelServidor } from '@/dominio/reloj'
import { rutas } from '@/rutas'
import { AlAsomarse, FranjaQueSeLlena } from '@/ui/movimiento'
import { ciudadesDistintas, indexar, porFecha, publicadaHace } from './busqueda'
import { Tarjeta } from './Tarjeta'
import estilos from './Vacantes.module.css'

/** Cuántas enseña la portada; el resto vive en `/vacantes`. */
const RECIENTES = 3

/** Qué hace el candidato en cada etapa. Es texto de producto, no dato. */
const QUE_ES: Record<string, string> = {
  PERFIL: 'Currículum y preguntas para conocerte.',
  PRUEBA: 'Demuestra tus habilidades.',
  SIMULACION: 'Dos horas con el equipo, fecha que eliges.',
  VALIDACION: 'Un periodo corto trabajando de verdad. Pagado.',
  DECISION: 'Decide una persona, no un puntaje.',
}

/** Lo que casi todo el mundo pregunta antes de postular. */
const PREGUNTAS = [
  {
    q: '¿Necesito cuenta para mirar?',
    a: 'No. Puedes ver las vacantes abiertas, leer una ficha completa y leer los textos legales sin registrarte. La cuenta se crea recién cuando decides postular.',
  },
  {
    q: '¿Cuánto dura todo el proceso?',
    a: 'Depende de la vacante: cada empresa pone sus propios plazos, y los que todavía no están definidos no te los inventamos. No tienes que estar pendiente — cada vez que te toque algo te avisamos, y hasta entonces no hay nada que hacer de tu lado.',
  },
  {
    q: '¿Mi currículum me puede descartar?',
    a: 'No. Entra al proceso, pero por diseño no descarta a nadie. Lo único que cierra una postulación en el acto es no cumplir un requisito indispensable.',
  },
  {
    q: '¿Veo mi puntaje?',
    a: 'No. Verás en qué etapa estás y si tienes algo pendiente, nada más. La decisión final la toma una persona mirando todo el recorrido.',
  },
]

export function Vacantes() {
  const consulta = useQuery({ queryKey: ['vacantes'], queryFn: listarVacantes })
  // Lo que llegue por la red no puede dar por hecho que tiene la forma
  // prometida: un cuerpo que no sea lista reventaba la pantalla entera.
  const vacantes = useMemo(
    () => (Array.isArray(consulta.data) ? consulta.data : []),
    [consulta.data],
  )
  // Ciudades de verdad, del catálogo: «Selva Alegre» es un barrio y no cuenta, y
  // las que no dicen ciudad tampoco. Antes se contaban textos de ubicación distintos.
  const ciudades = ciudadesDistintas(vacantes)
  // Las tres más recientes, con las que no tienen fecha al final; y la hora del
  // servidor tomada al llegar los datos, para el «Publicada hace…» de cada una.
  const recientes = useMemo(() => [...indexar(vacantes)].sort(porFecha).slice(0, RECIENTES), [vacantes])
  const ahora = useMemo(() => ahoraDelServidor(), [consulta.dataUpdatedAt])

  return (
    <div className={estilos.pagina}>
      <section className={estilos.portada}>
        <AlAsomarse>
          <h1 className={estilos.entrada}>
            Tu próximo trabajo{' '}
            <img className={estilos.pieza} src="/pieza-trabajo.png" alt="" aria-hidden="true" />{' '}
            puede
            empezar aquí
          </h1>
          {/*
            La accion va en negro y no en color. En este mundo el negro es la
            accion y el coral solo marca «te toca a ti», que aqui todavia no
            existe: quien llega no tiene turno, tiene curiosidad.
          */}
          <div className={estilos.acciones}>
            <Link
              className={estilos.accionPrincipal}
              to={rutas.vacantes()}
              data-rotulo="Ver las vacantes abiertas"
            >
              Ver las vacantes abiertas
            </Link>
            <Link
              className={estilos.accionSecundaria}
              to={rutas.procesos()}
              data-rotulo="Ya postulé antes"
            >
              Ya postulé antes
            </Link>
          </div>
        </AlAsomarse>


        {/*
          El escaparate: la pieza grande del mundo. Dentro va el recorrido, que
          es el producto, no un adorno. El resplandor coral es lo unico de color
          en toda la pantalla.
        */}
        <AlAsomarse variante="scaleUp" retraso={0.2}>
          <div className={estilos.escaparate}>
            <div className={estilos.escaparateDentro}>
              <p className={estilos.pieEscaparate}>
                Cinco etapas para conocer cómo trabajas
              </p>
              <ol className={estilos.recorrido} role="list">
                {ETAPAS.map((etapa, indice) => (
                  <li className={estilos.tramo} key={etapa.clave}>
                    {/*
                      E · cada etapa asoma detras de la anterior. El retraso se
                      calcula aqui y no con `AsomanEnFila` porque el escalonado
                      del padre reparte sobre HIJOS DIRECTOS, y estos cuelgan de
                      un `<li>` cada uno: el contenedor escalonado no los ve.
                    */}
                    <AlAsomarse retraso={0.2 * indice}>
                      {/* C · la franja se dibuja, escalonada por etapa. */}
                      <FranjaQueSeLlena
                        orden={indice}
                        className={indice === 0 ? estilos.barraViva : estilos.barraTramo}
                      />
                      <p className={estilos.numeroEtapa}>Etapa {indice + 1}</p>
                      <p className={estilos.nombreEtapa}>{etapa.etiqueta}</p>
                      <p className={estilos.queEsEtapa}>{QUE_ES[etapa.clave]}</p>
                    </AlAsomarse>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </AlAsomarse>
      </section>

      {/*
        La cinta dice cifras verdaderas y solo verdaderas. No hay testimonios ni
        numero de contratados: el sistema todavia no ha pasado por su primer
        candidato real y inventarlos seria mentir en la portada.
      */}
      <AlAsomarse>
        <div className={estilos.cinta}>
          <span>
            <b>{vacantes.length}</b> {vacantes.length === 1 ? 'puesto abierto' : 'puestos abiertos'}
          </span>
          {ciudades > 0 && (
            <span>
              <b>{ciudades}</b> {ciudades === 1 ? 'ciudad' : 'ciudades'}
            </span>
          )}
          <span>
            <b>0</b> descartes por currículum
          </span>
          <span>Mirar no exige cuenta</span>
        </div>
      </AlAsomarse>

      <AlAsomarse>
        <section className={estilos.seccionVacantes} aria-labelledby="vacantes-abiertas">
          <div className={estilos.cabeceraSeccion}>
            <h2 id="vacantes-abiertas">Vacantes abiertas</h2>
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
                data-rotulo="Intentar de nuevo"
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
            <>
              <ul className={estilos.lista} role="list" aria-label="Vacantes más recientes">
                {recientes.map((v) => (
                  <li key={v.vacante.id}>
                    <Tarjeta vacante={v.vacante} publicada={publicadaHace(v.publicadaEn, ahora)} />
                  </li>
                ))}
              </ul>
              {/*
                Todas viven en `/vacantes`, donde se busca y se filtra. Aquí van las
                tres más recientes: la portada es para decidir si merece la pena, no
                para leer cuarenta tarjetas.
              */}
              <div className={estilos.verTodasLasVacantes}>
                <Link
                  className={estilos.verTodas}
                  to={rutas.vacantes()}
                  data-rotulo={`Ver las ${vacantes.length} vacantes`}
                >
                  Ver las {vacantes.length} vacantes
                </Link>
              </div>
            </>
          )}
        </section>
      </AlAsomarse>

      <AlAsomarse>
        <section className={estilos.seccion} aria-labelledby="preguntas-frecuentes">
          <div className={estilos.cabeceraSeccion}>
            <h2 id="preguntas-frecuentes">Preguntas frecuentes</h2>
            <p>Lo que casi todo el mundo pregunta antes de postular.</p>
          </div>

          {/*
            `<details>` nativo: el plegable, el teclado y el lector de pantalla
            vienen gratis, y la regla de la plataforma primero dice que se mire el
            HTML antes de traer una libreria.
          */}
          <div className={estilos.preguntas}>
            {/*
              Todas cerradas de entrada. La primera venia abierta para enseñar de
              que va el plegable, y a cambio dejaba la seccion empezando por una
              respuesta: lo que se ve primero tiene que ser la lista de preguntas,
              que es lo que permite buscar la propia de un vistazo.
            */}
            {PREGUNTAS.map((p) => (
              <details className={estilos.pregunta} key={p.q}>
                <summary>
                  {p.q}
                  <span className={estilos.mas} aria-hidden="true" />
                </summary>
                <p>{p.a}</p>
              </details>
            ))}
          </div>
        </section>
      </AlAsomarse>

      <AlAsomarse>
        <section className={estilos.cierre}>
          <div className={estilos.cajaCierre}>
            <span className={estilos.halo} aria-hidden="true" />
            <h2>¿Empezamos?</h2>
            <p>
              Elige un puesto, lee sus requisitos y postula. Lo demás te lo vamos contando en
              pantalla, paso a paso.
            </p>
            <div className={estilos.acciones}>
              <Link
                className={estilos.accionPrincipal}
                to={rutas.vacantes()}
                data-rotulo="Ver las vacantes abiertas"
              >
                Ver las vacantes abiertas
              </Link>
              <Link
                className={estilos.accionSecundaria}
                to={rutas.procesos()}
                data-rotulo="Entrar a mis procesos"
              >
                Entrar a mis procesos
              </Link>
            </div>
          </div>
        </section>
      </AlAsomarse>
    </div>
  )
}
