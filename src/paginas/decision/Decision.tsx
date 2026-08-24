/**
 * El caso ambar: se pide una evidencia mas antes de decidir.
 *
 * ⚠️ **El formulario esta completo y esta apagado, a proposito.**
 *
 * `DECISION_TURNO_CANDIDATO` existe en el backend, pero en `/api/v1/portal` no
 * hay ninguna ruta para esto: ni para leer que se esta pidiendo, ni para mandar
 * la respuesta, ni para saber por que ronda va. Se maqueto entero para poder
 * juzgarlo y para dejar escrito que hay que pedir:
 *
 *   GET  /decision/{uuid}          → { duda, ronda, maxRondas, escritoPor }
 *   POST /decision/{uuid}/respuesta → multipart: texto + adjunto opcional
 *
 * Mientras no existan, la pantalla NO finge. Los campos van deshabilitados, se
 * dice por que antes de que nadie escriba, y la accion que si funciona —el
 * correo del equipo— es la que se lleva el acento. Dejarlos escribibles para
 * fallar al pulsar seria la version peor: se pierde lo escrito, y lo que se
 * aprende es que la pantalla miente.
 */

import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { verPostulacion } from '@/api/portal'
import { rutas } from '@/rutas'
import { Cargando, Fallo } from '@/ui/Mensajes'
import estilos from './Decision.module.css'

const CORREO = 'talento@renaser.pe'

const QUE_PASA_DESPUES = [
  'El equipo lee lo que mandes.',
  'Si con eso basta, cierran la decisión.',
  'Si queda algo, te preguntan una vez más — y solo una.',
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

  const vacante = consulta.data.resumen.vacante
  const asunto = encodeURIComponent(`Evidencia adicional · ${vacante}`)

  return (
    <div className={estilos.pagina}>
      <Link className={estilos.volver} to={rutas.proceso(uuid)}>
        ← Volver a mi proceso
      </Link>

      {/* Acento: aqui la espera es del candidato, y este panel es su accion. */}
      <section className={estilos.cabeza}>
        <span className={estilos.eti}>Decisión · te pedimos una cosa más</span>
        <h1 className={estilos.titulo}>Queremos resolver una duda antes de decidir.</h1>
        <p className={estilos.explicacion}>
          Llegaste al final del proceso para <b>{vacante}</b>. Antes de cerrarlo hay un
          punto que queremos ver mejor. <b>No es un rechazo</b>: si no nos interesaras, no
          te lo pediríamos.
        </p>
        <a className={estilos.escribir} href={`mailto:${CORREO}?subject=${asunto}`}>
          Escribirle al equipo
        </a>
      </section>

      <div className={estilos.reparto}>
        <div className={estilos.columna}>
          <section className={estilos.bloque}>
            <h2 className={estilos.tituloBloque}>Lo que necesitamos ver</h2>
            <p className={estilos.texto}>
              La duda concreta te la escribe por correo el equipo que llevó tu proceso,
              con sus palabras y diciendo por qué. No la redacta un sistema.
            </p>
            <p className={estilos.texto}>
              Si no te ha llegado o no la encuentras, escríbenos y te la repetimos.
            </p>
            <a className={estilos.correo} href={`mailto:${CORREO}?subject=${asunto}`}>
              {CORREO}
            </a>
          </section>

          <section className={estilos.bloque}>
            <h2 className={estilos.tituloBloque}>Tu respuesta</h2>

            <p className={estilos.todaviaNo}>
              Todavía no puedes mandarla desde el portal: estamos terminando esta parte.
              Por ahora respóndenos por correo y queda igual de registrada.
            </p>

            {/*
              `fieldset` deshabilitado: apaga todo lo de dentro con un atributo,
              y el lector de pantalla lo anuncia como grupo inactivo en lugar de
              leer campos que no se pueden usar.
            */}
            <fieldset className={estilos.formulario} disabled>
              <div className={estilos.grupo}>
                <label className={estilos.etiqueta} htmlFor="respuesta">
                  Cuéntalo con tus palabras
                </label>
                <textarea
                  className={estilos.escrito}
                  id="respuesta"
                  placeholder="Qué hiciste, a quién acudiste y cómo terminó."
                />
                <span className={estilos.pista}>Sin límite de palabras.</span>
              </div>

              <div className={estilos.grupo}>
                <span className={estilos.etiqueta}>Adjunta algo, si ayuda (opcional)</span>
                <div className={estilos.adjuntar}>
                  <span className={estilos.adjuntarTexto}>
                    Un documento, una captura, un enlace.
                  </span>
                  <span className={estilos.botones}>
                    <button className={estilos.boton} type="button">
                      Subir archivo
                    </button>
                    <button className={estilos.boton} type="button">
                      Pegar enlace
                    </button>
                  </span>
                </div>
              </div>
            </fieldset>

            <div className={estilos.envio}>
              <span className={estilos.ronda}>
                Como mucho te pediremos una respuesta más después de esta.
              </span>
              <span className={estilos.enviar} aria-disabled="true">
                Enviar respuesta
              </span>
            </div>
          </section>
        </div>

        <aside className={estilos.columna}>
          <section className={`${estilos.bloque} ${estilos.hundido}`}>
            <h2 className={estilos.tituloBloque}>Qué pasa después</h2>
            <ol className={estilos.pasos}>
              {QUE_PASA_DESPUES.map((paso, i) => (
                <li className={estilos.paso} key={paso}>
                  <b className={estilos.numeroPaso}>{i + 1}.</b>
                  {paso}
                </li>
              ))}
            </ol>
          </section>

          <section className={estilos.bloque}>
            <h2 className={estilos.tituloBloque}>Sin prisa</h2>
            <p className={estilos.texto}>
              Esto no caduca en horas. Tómate el tiempo de prepararlo bien.
            </p>
          </section>
        </aside>
      </div>
    </div>
  )
}
