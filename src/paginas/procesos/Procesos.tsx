/**
 * «Mis procesos».
 *
 * La pantalla a la que el candidato vuelve siempre, casi siempre a lo mismo:
 * comprobar si hay novedad. El titular responde esa pregunta antes que nada, y
 * la postulacion que pide algo va primera.
 *
 * Nada de aqui sabe que estados existen: se lo pregunta a `dominio/estados.ts`.
 * Si el backend añade uno, se toca alli y en ningun otro sitio.
 *
 * Mientras alguna este calificando la lista se consulta sola: no hay nada que
 * hacer, pero la pantalla tiene que enterarse cuando acabe.
 */

import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { misPostulaciones } from '@/api/portal'
import type { MiPostulacion } from '@/api/tipos'
import { esFinal, estaCalificando, leTocaAlCandidato, momentoDe } from '@/dominio/estados'
import { formatearFechaCorta } from '@/dominio/reloj'
import { rutas } from '@/rutas'
import { Canto } from '@/ui/Canto'
import { Seguimiento } from './Seguimiento'
import estilos from './Procesos.module.css'

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

export function Procesos() {
  const consulta = useQuery({
    queryKey: ['postulaciones'],
    queryFn: misPostulaciones,
    // Solo insiste mientras la IA este trabajando en alguna.
    //
    // `Array.isArray` no sobra: si el backend contesta algo que no es una lista
    // —un error mal formado, una respuesta de otro sitio— llamar a `.some`
    // lanza aqui dentro y se lleva el arbol entero, dejando la pantalla en
    // negro en vez de enseñar el fallo.
    refetchInterval: (q) =>
      Array.isArray(q.state.data) && q.state.data.some((p) => estaCalificando(p.estado))
        ? CADA_15_SEGUNDOS
        : false,
  })

  if (consulta.isPending) {
    return (
      <div className={estilos.pagina}>
        <Canto />
        <div className={estilos.estado} aria-busy="true">
          <h1>Cargando tus procesos…</h1>
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
        <Canto />
        <div className={estilos.estado}>
          <h1>No pudimos cargar tus procesos.</h1>
          <p className={estilos.estadoTexto}>
            {causa} Tus postulaciones están a salvo: esto es un problema para mostrarlas,
            no para conservarlas.
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

  // Misma defensa que arriba: lo que llegue por la red no puede dar por hecho
  // que tiene la forma prometida.
  const procesos = Array.isArray(consulta.data) ? consulta.data : []
  // Lo que de verdad depende del candidato va primero. Dentro de cada grupo se
  // respeta el orden del servidor.
  const ordenados = [...procesos].sort(
    (a, b) => Number(leTocaAlCandidato(b.estado)) - Number(leTocaAlCandidato(a.estado)),
  )
  const pendientes = procesos.filter((p) => leTocaAlCandidato(p.estado)).length
  const vivos = procesos.filter((p) => !esFinal(p.estado)).length

  return (
    <div className={estilos.pagina}>
      <Canto />

      {/*
        La lista se refresca sola cada 15 segundos y hasta ahora el estado
        cambiaba en silencio: quien no ve la pantalla no se enteraba de que
        ahora le tocaba algo. Esta region lo dice.

        No repite el titular —eso se leeria dos veces— sino que nombra la
        vacante y lo que se espera de ella, que es lo que el titular no puede
        decir cuando hay varias.
      */}
      <p aria-live="polite" className={estilos.soloLectores}>
        {resumenParaLectores(ordenados)}
      </p>

      <h1 className={estilos.titular}>{titularDe(pendientes, vivos, procesos.length)}</h1>
      <p className={estilos.entrada}>{entradaDe(pendientes, vivos, procesos.length)}</p>

      {procesos.length === 0 ? (
        // El titular y la entrada ya explican la situacion: repetirlo aqui era
        // decir lo mismo dos veces. Este bloque solo ofrece la salida.
        <div className={estilos.vacio}>
          <p className={estilos.vacioTexto}>
            Hoy hay vacantes abiertas en varias áreas. Postular te toma menos de diez
            minutos: tu currículum, un resultado del que te sientas orgulloso, y ya.
          </p>
          <Link className={estilos.vacioAccion} to={rutas.vacantes()}>
            Ver vacantes abiertas
          </Link>
        </div>
      ) : (
        <div className={estilos.procesos}>
          {ordenados.map((p) => (
            <Proceso key={p.uuid} postulacion={p} />
          ))}
        </div>
      )}

      <div className={estilos.gestion}>
        <Link to={rutas.vacantes()}>Ver más vacantes</Link>
        <Link to={rutas.privacidad()}>Privacidad y control de mis datos</Link>
      </div>
    </div>
  )
}

function Proceso({ postulacion }: { postulacion: MiPostulacion }) {
  const final = esFinal(postulacion.estado)
  const leToca = leTocaAlCandidato(postulacion.estado)
  const termino = COMO_TERMINO[postulacion.estado]
  const momento = momentoDe(postulacion.estado)
  const idTitulo = `vacante-${postulacion.uuid}`

  const cabecera = (
    <div className={estilos.cabeceraProceso}>
      <h2 className={estilos.vacante} id={idTitulo}>
        {postulacion.vacante}
      </h2>
      <span className={estilos.desde}>
        Postulaste el{' '}
        <time dateTime={postulacion.creadoEn}>
          {formatearFechaCorta(postulacion.creadoEn)}
        </time>
      </span>
    </div>
  )

  // El enlace nombra su vacante: cuatro enlaces con el mismo texto son cuatro
  // entradas indistinguibles en la lista de enlaces de un lector de pantalla.
  const enlaceDetalle = (
    <p className={estilos.pieProceso}>
      <Link to={rutas.proceso(postulacion.uuid)}>
        Ver el detalle de {postulacion.vacante}
      </Link>
    </p>
  )

  // Una postulacion terminada no pinta recorrido. Sin historial en esta
  // respuesta no se sabe donde se detuvo, y cinco casillas vacias le dicen a
  // quien hizo la evaluacion, la prueba y la simulacion que no queda nada de
  // eso. El recorrido de verdad esta en el detalle.
  if (final) {
    return (
      <article className={estilos.proceso} aria-labelledby={idTitulo}>
        {cabecera}
        {termino && (
          <div className={estilos.cierre}>
            <p className={estilos.tituloCerrado}>
              <span className={estilos.marcaCortada} aria-hidden="true" />
              <span className={estilos.cierreTitulo}>{termino.titulo}</span>
            </p>
            <p className={estilos.cierreTexto}>{termino.texto}</p>
          </div>
        )}
        {enlaceDetalle}
      </article>
    )
  }

  // Le toca algo: el recorrido va abierto, porque es donde vive la accion.
  if (leToca) {
    return (
      <article className={estilos.proceso} aria-labelledby={idTitulo}>
        {cabecera}
        <Seguimiento postulacion={postulacion} />
        {enlaceDetalle}
      </article>
    )
  }

  // No le toca nada: se resume en una linea y el recorrido se despliega a
  // peticion. Trece de los dieciocho estados caen aqui, y dibujarles el camino
  // entero llenaba la pantalla de un recorrido que nadie habia pedido ver.
  return (
    <article className={estilos.proceso} aria-labelledby={idTitulo}>
      {cabecera}
      <div className={estilos.espera}>
        <p className={estilos.esperaTitulo}>{momento.titulo}</p>
        <p className={estilos.esperaTexto}>
          {momento.ayuda} <b>No tienes que hacer nada.</b>
        </p>
      </div>
      <details className={estilos.plegable}>
        <summary className={estilos.resumen}>Ver el recorrido completo</summary>
        <div className={estilos.desplegado}>
          <Seguimiento postulacion={postulacion} />
        </div>
      </details>
      {enlaceDetalle}
    </article>
  )
}

/**
 * Lo que se le dice a un lector de pantalla cuando la lista cambia sola.
 *
 * Nombra la vacante y lo que se espera de ella: el titular no puede hacerlo
 * cuando hay varias postulaciones, y es justo el dato que hace falta para saber
 * si hay que hacer algo.
 */
function resumenParaLectores(procesos: MiPostulacion[]): string {
  const pendientes = procesos.filter((p) => leTocaAlCandidato(p.estado))
  if (pendientes.length === 0) return 'Ninguna de tus postulaciones necesita nada de ti.'
  return pendientes
    .map((p) => `${p.vacante}: ${momentoDe(p.estado).titulo}.`)
    .join(' ')
}

/**
 * El titular es la respuesta a la pregunta con la que el candidato llega, no el
 * nombre de la pantalla.
 *
 * Cuenta los procesos VIVOS, no el total. Mirar solo el total hacia que a quien
 * ya no continua se le dijera «no tienes nada pendiente» y, debajo, que su
 * postulacion seguia en marcha y le escribiriamos — encima de un bloque que le
 * agradecia la participacion. La pagina se desmentia a si misma en el peor
 * momento del producto.
 */
function titularDe(pendientes: number, vivos: number, total: number): string {
  if (total === 0) return 'Aquí seguirás tus postulaciones.'
  if (vivos === 0) {
    return total === 1 ? 'Esta postulación terminó.' : 'Tus postulaciones terminaron.'
  }
  if (pendientes === 0) return 'No tienes nada pendiente.'
  if (pendientes === 1) return 'Tienes una cosa pendiente.'
  return `Tienes ${pendientes} cosas pendientes.`
}

function entradaDe(pendientes: number, vivos: number, total: number): string {
  if (total === 0) {
    return 'Cuando postules a una vacante podrás ver aquí en qué punto está tu proceso, paso a paso.'
  }
  // Ni una promesa de aviso cuando no queda proceso vivo: no va a haber novedad
  // que comunicar, y el correo del sistema puede no salir.
  if (vivos === 0) {
    return 'Aquí queda su recorrido. Puedes postular a otra vacante cuando quieras.'
  }
  if (pendientes === 0) {
    return vivos === 1
      ? 'Tu postulación sigue en marcha y ahora nos toca a nosotros. Vuelve por aquí cuando quieras: esta página siempre está al día.'
      : 'Tus postulaciones siguen en marcha y ahora nos toca a nosotros. Vuelve por aquí cuando quieras: esta página siempre está al día.'
  }
  return 'Lo que necesita algo de ti va primero, dentro del recorrido de su postulación.'
}
