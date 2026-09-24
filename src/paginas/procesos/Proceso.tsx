/**
 * El detalle de una postulacion.
 *
 * Es la unica pantalla donde el recorrido lleva fechas: `GET /postulaciones`
 * devuelve solo el estado, y el historial completo llega nada mas aqui. De ahi
 * salen dos cosas que en «Mis procesos» no se pueden saber:
 *
 *   - **Cuando se alcanzo cada etapa**, que es lo que convierte el recorrido en
 *     un seguimiento de verdad y no en una lista de pasos.
 *   - **Donde se detuvo una postulacion terminada.** Los tres estados finales no
 *     dicen en que etapa se cayo la persona; el historial si. Sin eso, quien
 *     hizo la evaluacion y la prueba ve, el dia que le dicen que no, un
 *     recorrido en blanco.
 *
 * El historial es real, no una linea de tiempo de adorno: el backend guarda cada
 * cambio con su fecha y con si lo movio una persona o el sistema.
 */

import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ErrorApi } from '@/api/cliente'
import { retirarPostulacion, verPostulacion } from '@/api/portal'
import type { PasoHistorial } from '@/api/tipos'
import {
  comoOcurrio,
  esFinal,
  estaCalificando,
  etapaDeCorteDe,
  fechasDelRecorrido,
} from '@/dominio/estados'
import { formatearFechaCorta, formatearFechaLarga } from '@/dominio/reloj'
import { rutas } from '@/rutas'
import { Remuneracion } from '@/ui/Remuneracion'
import { Seguimiento } from './Seguimiento'
import estilos from './Proceso.module.css'

const CADA_15_SEGUNDOS = 15_000

/** Lo que se le dice a quien llega a una postulacion ya terminada. */
const COMO_TERMINO: Record<string, { titulo: string; texto: string }> = {
  CONTRATADO: {
    titulo: 'Te damos la bienvenida',
    texto: 'El proceso terminó y te contratamos. Nos pondremos en contacto contigo.',
  },
  NO_CONTINUA: {
    titulo: 'Gracias por participar',
    texto:
      'En esta oportunidad no continúas en el proceso. Agradecemos el tiempo y el trabajo que compartiste. Para participar en otra vacante tendrás que postular de nuevo.',
  },
  CERRADA: {
    titulo: 'Esta postulación está cerrada',
    texto:
      'Terminó sin llegar a una decisión y ya no recibirás avisos de esta vacante. Cerrarla no elimina tus datos: eso se pide por separado.',
  },
}

export function Proceso() {
  const { uuid = '' } = useParams()
  const cache = useQueryClient()

  const consulta = useQuery({
    queryKey: ['postulacion', uuid],
    queryFn: () => verPostulacion(uuid),
    enabled: uuid !== '',
    refetchInterval: (q) =>
      q.state.data?.resumen && estaCalificando(q.state.data.resumen.estado)
        ? CADA_15_SEGUNDOS
        : false,
  })

  const retiro = useMutation({
    mutationFn: () => retirarPostulacion(uuid),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ['postulacion', uuid] })
      await cache.invalidateQueries({ queryKey: ['postulaciones'] })
    },
  })

  if (consulta.isPending) {
    return (
      <div className={estilos.pagina}>
        <div className={estilos.marco} aria-busy="true">
          <h1>Cargando tu proceso…</h1>
          <div className={estilos.barra} />
          <div className={`${estilos.barra} ${estilos.barraMedia}`} />
          <div className={`${estilos.barra} ${estilos.barraCorta}`} />
        </div>
      </div>
    )
  }

  if (consulta.isError) {
    /*
     * Un 404 aquí no es una avería, y decirle que lo intente de nuevo sería
     * mandarlo a chocar contra la misma puerta.
     *
     * Pasa cuando la empresa retira la vacante: el proceso deja de verse junto
     * con ella, y el enlace sigue estando en el navegador, en el correo que se
     * le mandó y en los avisos viejos de su campana. Se le dice lo que pasó y
     * se le lleva a su lista, que es lo único que puede hacer.
     */
    const yaNoEsta = consulta.error instanceof ErrorApi && consulta.error.estado === 404
    const causa =
      consulta.error instanceof Error
        ? consulta.error.message
        : 'No pudimos conectar con el servidor.'
    return (
      <div className={estilos.pagina}>
        <Link className={estilos.volver} to={rutas.procesos()}>
          ← Volver a mis procesos
        </Link>
        <div className={estilos.marco}>
          <h1>
            {yaNoEsta
              ? 'Esta vacante ya no está disponible.'
              : 'No pudimos cargar esta postulación.'}
          </h1>
          <p className={estilos.marcoTexto}>
            {yaNoEsta ? (
              <>
                La empresa la retiró, así que su proceso dejó de verse aquí. No tienes que
                hacer nada.
              </>
            ) : (
              <>
                {causa} Tu postulación está a salvo: esto es un problema para mostrarla, no
                para conservarla.
              </>
            )}
          </p>
          {/*
            `data-rotulo` en los dos: es la accion que gira su rotulo al pasar
            por encima, y el gesto tiene que ser el mismo lleve donde lleve.
          */}
          {yaNoEsta ? (
            <Link
              className={estilos.reintentar}
              to={rutas.procesos()}
              data-rotulo="Ver mis procesos"
            >
              Ver mis procesos
            </Link>
          ) : (
            <button
              type="button"
              className={estilos.reintentar}
              onClick={() => void consulta.refetch()}
              data-rotulo="Intentar de nuevo"
            >
              Intentar de nuevo
            </button>
          )}
        </div>
      </div>
    )
  }

  const { resumen, historial } = consulta.data
  const final = esFinal(resumen.estado)
  const termino = COMO_TERMINO[resumen.estado]

  /**
   * Si el sueldo cambio DESPUES de que esta persona postulo.
   *
   * ⚠️ **No sale de los avisos sin leer, y la diferencia importa.** Se probo asi
   * y se auto-anulaba: pulsar el aviso de la campana lo marca leido y navega
   * aqui, asi que el resaltado se apagaba en el mismo gesto que traia a la
   * persona a verlo. El recorrido entero para el que se construyo terminaba en
   * una pantalla sin ninguna marca.
   *
   * Comparar las dos fechas es estable y ademas mas correcto: una vacante que se
   * movio hace un año y a la que postulo ayer NO tiene novedad para el —el
   * cambio es anterior a su candidatura—, y una que cambio anteayer la sigue
   * teniendo aunque ya leyera el aviso. Lo que se resalta es «esto no es lo que
   * habia cuando dijiste que si», que es verdad mientras dure el proceso.
   */
  const cambioEn = resumen.remuneracion?.actualizadaEn
  const hayNovedad =
    cambioEn != null && new Date(cambioEn) > new Date(resumen.creadoEn)

  const pasos = Array.isArray(historial) ? historial : []
  const fechas = fechasDelRecorrido(pasos)
  // Solo hace falta en las terminadas: en las vivas, el propio estado dice la
  // etapa.
  const etapaDeCorte = final ? etapaDeCorteDe(pasos) : undefined

  return (
    <div className={estilos.pagina}>
      <Link className={estilos.volver} to={rutas.procesos()}>
        ← Volver a mis procesos
      </Link>

      <div className={estilos.encabezado}>
        <h1 className={estilos.titular}>{resumen.vacante}</h1>
        <span className={estilos.desde}>
          Postulaste el{' '}
          <time dateTime={resumen.creadoEn}>{formatearFechaCorta(resumen.creadoEn)}</time>
        </span>
      </div>

      {/*
        El trato del sueldo, las dos mitades juntas.

        Va arriba y no al final: si llego aqui desde el aviso de que cambio la
        remuneracion, esto es LO que vino a ver, y hacerselo buscar debajo del
        recorrido convierte una noticia en una busqueda.

        `resaltado` se enciende con los avisos sin leer, no con la fecha del
        cambio: una vacante que se movio hace un año y a la que postulo ayer no
        tiene ninguna novedad que contarle, y marcarla le haria buscar un cambio
        que para el no existe.
      */}
      <section className={estilos.trato}>
        <Remuneracion remuneracion={resumen.remuneracion} resaltado={hayNovedad} />

        {resumen.miPretension ? (
          <p className={estilos.miPretension}>
            <span className={estilos.etiquetaPretension}>Lo que pediste</span>
            <span className={estilos.montoPretension}>{resumen.miPretension.texto}</span>
          </p>
        ) : (
          /*
            Y aqui se dice POR QUE no hay nada, en lugar de dejar un hueco.
            Un guion se leeria como que no quiso decirlo; la verdad es que no se
            le pidio, porque la empresa tampoco enseñaba lo suyo.

            ⚠️ **En pasado si la vacante la publica HOY.** El trato se juzga con
            las reglas del dia en que postulo, y la empresa puede haberlo
            encendido despues: sin este matiz, la pantalla decia «esta vacante no
            publicaba la suya» tres centimetros debajo del monto que si estaba
            pintando, y quien lo leia no sabia a cual de las dos creer.
          */
          <p className={estilos.sinPretension}>
            {resumen.remuneracion?.tipo && resumen.remuneracion.tipo !== 'OCULTA'
              ? 'No te pedimos tu pretensión: cuando postulaste, esta vacante todavía no publicaba la suya.'
              : 'No te pedimos tu pretensión: esta vacante no publica la suya.'}
          </p>
        )}
      </section>

      {/*
        Solo cuando el proceso termino.
        Mientras esta vivo, `Seguimiento` ya pinta el titulo, la ayuda y la
        accion dentro del hito abierto —que es la tesis de la direccion: la
        accion vive dentro del hito, no en un boton suelto—, asi que este panel
        los repetia. En escritorio salian dos paneles indigo identicos con dos
        botones «Abrir prueba»; en movil, a pantalla y media de distancia, el
        segundo se leia como si fuera otra cosa. Duplicar el arranque de una
        prueba cronometrada e irreversible es el peor sitio para hacerlo.

        Terminado no hay hito abierto que aloje el cierre, y por eso aqui si.
      */}
      {final && termino && (
        <section className={estilos.estadoActual}>
          <h2 className={estilos.estadoTitulo}>{termino.titulo}</h2>
          <p className={estilos.estadoAyuda}>{termino.texto}</p>
        </section>
      )}

      {/* Las dos lecturas del mismo viaje, una al lado de la otra en escritorio:
          el recorrido dice DONDE estas, el registro dice COMO llegaste. Era la
          unica pantalla del portal, con el hub, que no reflowaba nunca por
          encima de 640 px, y es de las dos mas visitadas. */}
      <div className={estilos.dosLecturas}>
        <section className={estilos.seccion}>
          <h2 className={estilos.tituloSeccion}>Tu recorrido</h2>
          <p className={estilos.entradilla}>
            Las cinco etapas del proceso, con la fecha en que llegaste a cada una.
          </p>
          <Seguimiento postulacion={resumen} fechas={fechas} etapaDeCorte={etapaDeCorte} />
        </section>

        <section className={estilos.seccion}>
          <h2 className={estilos.tituloSeccion}>Cómo llegaste hasta aquí</h2>
          <p className={estilos.entradilla}>
            Cada cambio de tu postulación, con su fecha. Sale del registro del sistema, no es una línea de tiempo de adorno.
          </p>
          {pasos.length === 0 ? (
            <p className={estilos.sinRegistro}>Todavía no hay movimientos que mostrar.</p>
          ) : (
            <ol className={estilos.registro} role="list">
              {pasos.map((paso, i) => (
                <Cambio key={`${paso.ocurridaEn}-${i}`} paso={paso} />
              ))}
            </ol>
          )}
        </section>
      </div>

      {!final && (
        <Retirada
          vacante={resumen.vacante}
          retirando={retiro.isPending}
          error={retiro.isError ? retiro.error : null}
          onRetirar={() => retiro.mutate()}
        />
      )}
    </div>
  )
}

function Cambio({ paso }: { paso: PasoHistorial }) {
  return (
    <li className={estilos.cambio}>
      <div className={estilos.punto} aria-hidden="true" />
      <div className={estilos.textoCambio}>
        <p className={estilos.queParso}>{comoOcurrio(paso.estadoNuevo)}</p>
        <p className={estilos.cuando}>
          <time dateTime={paso.ocurridaEn}>{formatearFechaLarga(paso.ocurridaEn)}</time> ·{' '}
          {paso.fueElSistema ? 'registrado por el sistema' : 'registrado por una persona'}
        </p>
      </div>
    </li>
  )
}

/**
 * Retirarse, con su confirmacion.
 *
 * Usa el `dialog` nativo: el foco atrapado dentro, la tecla de escape y el papel
 * de fondo ya vienen resueltos por el navegador. Un modal a mano habria que
 * volver a resolverlos, y es donde se rompe la accesibilidad.
 */
function Retirada({
  vacante,
  retirando,
  error,
  onRetirar,
}: {
  vacante: string
  retirando: boolean
  error: unknown
  onRetirar: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  const dialogo = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = dialogo.current
    if (!el) return
    if (abierto && !el.open) el.showModal()
    if (!abierto && el.open) el.close()
  }, [abierto])

  return (
    <>
      <section className={estilos.retirada}>
        <p className={estilos.retiradaTexto}>
          Si ya no te interesa este puesto puedes retirarte. Retirarte <b>no elimina tus
          datos</b>: eso se pide por separado desde Privacidad.
        </p>
        <button
          type="button"
          className={estilos.botonRetirar}
          onClick={() => setAbierto(true)}
        >
          Retirar mi postulación
        </button>
      </section>

      <dialog
        ref={dialogo}
        className={estilos.aviso}
        aria-labelledby="titulo-retiro"
        onClose={() => setAbierto(false)}
      >
        <h2 className={estilos.avisoTitulo} id="titulo-retiro">
          ¿Retirarte de {vacante}?
        </h2>
        <p className={estilos.avisoTexto}>
          Dejarás de recibir avisos de esta vacante y{' '}
          <b>no se puede deshacer</b>: para volver tendrías que postular de nuevo.
        </p>

        {error !== null && (
          <p className={estilos.fallo}>
            {error instanceof Error
              ? error.message
              : 'No pudimos retirar tu postulación. Vuelve a intentarlo.'}
          </p>
        )}

        <div className={estilos.avisoBotones}>
          <button
            type="button"
            className={estilos.seguir}
            onClick={() => setAbierto(false)}
          >
            Seguir en el proceso
          </button>
          <button
            type="button"
            className={estilos.confirmarRetiro}
            onClick={onRetirar}
            disabled={retirando}
          >
            {retirando ? 'Retirando…' : 'Sí, retirarme'}
          </button>
        </div>
      </dialog>
    </>
  )
}
