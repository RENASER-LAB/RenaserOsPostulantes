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
          <h1>No pudimos cargar esta postulación.</h1>
          <p className={estilos.marcoTexto}>
            {causa} Tu postulación está a salvo: esto es un problema para mostrarla, no
            para conservarla.
          </p>
          <button
            type="button"
            className={estilos.reintentar}
            onClick={() => void consulta.refetch()}
          >
            Intentar de nuevo
          </button>
        </div>
      </div>
    )
  }

  const { resumen, historial } = consulta.data
  const final = esFinal(resumen.estado)
  const termino = COMO_TERMINO[resumen.estado]

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
        <h1>{resumen.vacante}</h1>
        <span className={estilos.desde}>
          Postulaste el{' '}
          <time dateTime={resumen.creadoEn}>{formatearFechaCorta(resumen.creadoEn)}</time>
        </span>
      </div>

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
