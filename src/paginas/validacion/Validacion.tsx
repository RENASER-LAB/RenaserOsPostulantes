/**
 * La validacion practica: el periodo en el que el candidato ya esta trabajando.
 *
 * ⚠️ **El backend no expone nada de esta etapa al portal.** No hay ruta que
 * diga cuantos dias dura el periodo, cuando termina, quien es el responsable,
 * bajo que figura contractual se trabaja, ni como van las metricas. Lo que hay
 * que pedirle:
 *
 *   GET /validacion/{uuid} → { inicio, fin, diasAcordados, responsable,
 *                              figuraContractual, metricas[] }
 *
 * Mientras tanto esta pantalla enseña **solo lo que sabe de verdad**: de que
 * vacante se trata y cuando empezo la validacion, que sale del historial de la
 * postulacion. Lo que no sabe lo dice; no lo rellena. Es la misma regla por la
 * que «Mis procesos» pinta el recorrido sin fechas: inventar una fecha es peor
 * que no ponerla, y aqui —donde la persona ya esta trabajando— mas todavia.
 *
 * ⚠️ **Por eso `VALIDACION_TURNO_CANDIDATO` sigue llevando al detalle del
 * proceso**, no aqui. Esta ruta existe y funciona, pero no se enlaza desde
 * ningun sitio hasta que haya datos que la justifiquen. Cambiarlo es una linea
 * en `dominio/estados.ts`.
 *
 * Los cuatro criterios de abajo no son datos medidos: son la descripcion de lo
 * que el sistema mira, la misma que se le da al candidato al empezar. Por eso
 * si pueden estar escritos aqui.
 */

import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { verPostulacion } from '@/api/portal'
import { fechasDelRecorrido } from '@/dominio/estados'
import { formatearFechaCorta } from '@/dominio/reloj'
import { rutas } from '@/rutas'
import { Cargando, Fallo } from '@/ui/Mensajes'
import estilos from './Validacion.module.css'

interface Medida {
  nombre: string
  como: string
  automatica: boolean
}

const QUE_SE_MIRA: Medida[] = [
  {
    nombre: 'Que lo comprometido se entregue',
    como: 'Se registra solo, desde las tareas del sistema interno.',
    automatica: true,
  },
  {
    nombre: 'Cuánto hay que rehacer',
    como: 'Se registra solo.',
    automatica: true,
  },
  {
    nombre: 'Si avisas de un bloqueo a tiempo',
    como: 'Se registra solo. Avisar pronto cuenta a favor, no en contra.',
    automatica: true,
  },
  {
    nombre: 'Cómo trabajas con el equipo',
    como: 'Lo escribe tu responsable al terminar el periodo.',
    automatica: false,
  },
]

export function Validacion() {
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

  const { resumen, historial } = consulta.data
  const empezo = fechasDelRecorrido(historial).VALIDACION

  return (
    <div className={estilos.pagina}>
      <Link className={estilos.volver} to={rutas.proceso(uuid)}>
        ← Volver a mi proceso
      </Link>

      <div className={estilos.encabezado}>
        <h1>Estás trabajando con nosotros.</h1>
        <p className={estilos.bajada}>
          Validación práctica · {resumen.vacante}
        </p>
      </div>

      <div className={estilos.reparto}>
        <div className={estilos.columna}>
          {/* Acento: durante el periodo, lo que se espera lo hace el candidato. */}
          <section className={estilos.periodo}>
            <span className={estilos.etiAcento}>Tu periodo</span>
            <p className={estilos.desde}>
              {empezo ? `Empezó el ${formatearFechaCorta(empezo)}` : 'Ya empezó'}
            </p>
            <p className={estilos.sinPlazo}>
              Cuánto dura y qué día termina te lo acordó tu responsable al empezar.
              Todavía no lo tenemos aquí para recordártelo.
            </p>
          </section>

          <section className={estilos.bloque}>
            <h2 className={estilos.tituloBloque}>Lo que estamos mirando</h2>
            <p className={estilos.texto}>
              No hay sorpresas: es lo mismo que se te dijo al empezar.
            </p>
            <div className={estilos.medidas}>
              {QUE_SE_MIRA.map((m) => (
                <div className={estilos.medida} key={m.nombre}>
                  <span className={estilos.queSeMira}>
                    <b className={estilos.nombreMedida}>{m.nombre}</b>
                    <span className={estilos.comoSeMide}>{m.como}</span>
                  </span>
                  <span
                    className={`${estilos.quien}${m.automatica ? '' : ` ${estilos.persona}`}`}
                  >
                    {m.automatica ? 'Automático' : 'Una persona'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className={estilos.columna}>
          <section className={estilos.bloque}>
            <h2 className={estilos.tituloBloque}>Si algo te bloquea</h2>
            <p className={estilos.texto}>
              Díselo a tu responsable en cuanto pase. Avisar pronto es una de las cosas
              que se miran, y cuenta a favor.
            </p>
          </section>

          <section className={`${estilos.bloque} ${estilos.hundido}`}>
            <h2 className={estilos.tituloBloque}>Después de esto</h2>
            <p className={estilos.texto}>
              Queda la decisión final. La toma una persona mirando todo el recorrido, no
              solo este periodo.
            </p>
          </section>

          <p className={estilos.falta}>
            Quién es tu responsable y bajo qué figura estás trabajando todavía no llegan
            al portal. Los tienes en el acuerdo que firmaste.
          </p>
        </aside>
      </div>
    </div>
  )
}
