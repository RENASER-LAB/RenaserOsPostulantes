/**
 * Lo que la persona escribio en la prueba, pregunta a pregunta.
 *
 * La ficha del postulante ya ensenaba la rubrica —criterio, nota, explicacion—
 * y no lo que se califico con ella. Quien pone la nota tenia el juicio de la IA
 * delante y el texto juzgado en ningun sitio, asi que la unica manera de
 * contrastarlos era creerse el juicio. Este bloque es esa segunda mitad: va
 * debajo de los criterios, en la misma columna, y solo en la pestana de Prueba.
 *
 * ⚠️ **`respuesta: null` y `respuesta: ''` no son lo mismo, y el backend los
 * separa a proposito.** Nulo es que no llego ninguna respuesta a esa pregunta;
 * cadena vacia es que hay una respuesta guardada y esta vacia. Quien califica
 * no juzga igual las dos cosas —una puede ser el tiempo que se acabo, la otra
 * es una decision— y colapsarlas en un «—» es de la familia de los indicadores
 * que mienten que ya costaron un fallo aqui. Se dicen con dos frases distintas,
 * no con dos tonos del mismo gris. Hay test.
 *
 * ⚠️ **El texto de una respuesta admite 20 000 caracteres** (`@Size` del
 * backend) y esta columna mide veinte y pocos rem. De ahi las dos reglas de
 * `.texto`: `pre-wrap` para que los parrafos de quien escribio sigan siendo
 * parrafos, y `overflow-wrap` para que una palabra sin espacios —una URL
 * pegada, un log— no empuje el ancho de la ficha entera y saque la pagina de
 * cuadro. Lo que **no** lleva es tope de alto: recortar una respuesta larga
 * detras de un scroll que en reposo no se ve es esconderle a quien califica
 * justo lo que vino a leer.
 *
 * ⚠️ **Este bloque no tiene accion, asi que no lleva violeta.** En el panel el
 * violeta es la accion principal; gastarlo en algo que solo se lee se lo quita
 * a los botones que si hacen algo.
 */

import { useQuery } from '@tanstack/react-query'
import { ErrorApi } from '../api/cliente'
import { verRespuestasDePrueba } from '../api/panel'
import type { RespuestaDePrueba } from '../api/tipos'
import { formatearFechaLarga } from '@/dominio/reloj'
import estilos from './RespuestasDePrueba.module.css'

/**
 * Lo que se dice cuando no hay respuestas que ensenar, tanto si la lista viene
 * vacia como si el backend responde 404. Las dos cosas significan lo mismo aqui
 * —no hay prueba rendida— y fingir que son distintas seria inventarse un
 * matiz que el backend no da.
 */
const NO_RINDIO =
  'No hay ninguna respuesta guardada: todavía no rindió la prueba del puesto.'

/**
 * El tipo llega como codigo y es texto abierto en el contrato. Se traduce lo
 * conocido y lo demas se imprime tal cual: inventarle un nombre bonito a un
 * codigo que no se ha visto es adivinar delante de quien decide.
 */
const TIPOS: Record<string, string> = {
  ABIERTA: 'Pregunta abierta',
}

const nombreDeTipo = (tipo: string) => TIPOS[tipo] ?? tipo

/**
 * El mismo criterio que `leerFallo` de `Vacante.tsx`, escrito aqui porque
 * importarlo de alli cerraria un ciclo —esta pieza vive dentro de esa ficha—:
 * solo un 404 significa «todavia no hay». Un 500 o una red caida disfrazados de
 * «no rindio» harian creer que la persona no entrego nada.
 */
const esVacio = (causa: unknown) => causa instanceof ErrorApi && causa.estado === 404

const esSinPermiso = (causa: unknown) => causa instanceof ErrorApi && causa.estado === 403

const mensajeDeFallo = (causa: unknown) =>
  causa instanceof Error ? causa.message : 'No pudimos traer lo que escribió.'

/** Una respuesta cuenta como escrita solo si tiene algo dentro: ver `LoQueEscribio`. */
const tieneAlgoEscrito = (fila: RespuestaDePrueba) =>
  fila.respuesta !== null && fila.respuesta.trim() !== ''

export function RespuestasDePrueba({ postulacionId }: { postulacionId: number }) {
  const consulta = useQuery({
    queryKey: ['panel-respuestas-prueba', postulacionId],
    queryFn: () => verRespuestasDePrueba(postulacionId),
    retry: false,
  })

  const filas = consulta.data
  // Todas las ramas de fallo miran ademas que no haya datos. `isError` a secas
  // se enciende tambien al fallar un refresco de fondo con la lista ya puesta,
  // y ahi quitarla de en medio deja a quien califica sin lo que estaba leyendo.
  const sinNada = !filas

  return (
    <section className={estilos.bloque}>
      <div className={estilos.cabecera}>
        <h3 className={estilos.titulo}>Lo que escribió en la prueba</h3>
        {filas && filas.length > 0 && (
          <p className={estilos.recuento}>
            {filas.filter(tieneAlgoEscrito).length} de {filas.length} con algo escrito
          </p>
        )}
      </div>

      {consulta.isPending && <p className={estilos.dato}>Buscando lo que escribió…</p>}

      {/*
        El 403 no es un fallo del que se salga reintentando: es el reparto de
        permisos funcionando. Se nombra que abre ese permiso y a quien pedirselo,
        que es lo unico accionable, en vez de «no pudimos cargar».
      */}
      {sinNada && esSinPermiso(consulta.error) && (
        <p className={estilos.sinPermiso}>
          <b>Tu rol ve el ranking, no la ficha de cada persona.</b> Lo que escribió en la
          prueba se abre con el permiso de ver la ficha de un candidato. Si lo necesitas
          para calificar, pídeselo a quien administra los permisos.
        </p>
      )}

      {sinNada && esVacio(consulta.error) && <p className={estilos.vacio}>{NO_RINDIO}</p>}

      {sinNada && consulta.isError && !esSinPermiso(consulta.error) && !esVacio(consulta.error) && (
        <p className={estilos.avisoMalo} role="alert">
          {mensajeDeFallo(consulta.error)}{' '}
          <button
            className={estilos.reintentar}
            type="button"
            onClick={() => consulta.refetch()}
          >
            Volver a intentarlo
          </button>
        </p>
      )}

      {/* Hay datos, pero son los de antes. Se dice sin quitarlos de en medio. */}
      {consulta.isError && filas && (
        <p className={estilos.desactualizado} role="status">
          No pudimos refrescar esto, así que es lo último que llegó.{' '}
          <button
            className={estilos.reintentar}
            type="button"
            onClick={() => consulta.refetch()}
          >
            Volver a intentarlo
          </button>
        </p>
      )}

      {filas &&
        (filas.length === 0 ? (
          <p className={estilos.vacio}>{NO_RINDIO}</p>
        ) : (
          <ol className={estilos.lista} role="list">
            {filas.map((fila) => (
              <Pregunta fila={fila} key={fila.preguntaId} />
            ))}
          </ol>
        ))}
    </section>
  )
}

/**
 * Una pregunta con lo que se contesto debajo.
 *
 * El numero va en la canal de la izquierda, como la nota en la lista de
 * criterios de al lado: asi el enunciado empieza donde empieza el de arriba y
 * la lista se recorre de un vistazo. El codigo y el tipo son datos del equipo,
 * y por eso van **debajo** del enunciado y en el tamano menor: encima serian un
 * antetitulo, y competirian con lo unico que hay que leer para juzgar.
 */
function Pregunta({ fila }: { fila: RespuestaDePrueba }) {
  const contexto = [
    fila.codigo,
    fila.tipo ? nombreDeTipo(fila.tipo) : null,
    // Sin fecha no se escribe «respondida el»: media frase es peor que ninguna.
    fila.respondidaEn ? `respondida el ${formatearFechaLarga(fila.respondidaEn)}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li className={estilos.pregunta}>
      <span className={estilos.orden}>{fila.orden}</span>
      <div className={estilos.cuerpo}>
        <p className={estilos.enunciado}>{fila.enunciado}</p>
        {contexto && <p className={estilos.contexto}>{contexto}</p>}
        <LoQueEscribio texto={fila.respuesta} />
      </div>
    </li>
  )
}

/**
 * Las tres cosas que puede haber donde va la respuesta.
 *
 * ⚠️ **Nulo y vacio se dicen con palabras distintas, no con la misma raya.**
 * Nulo es que no llego ninguna respuesta; vacio es que llego una y no trae
 * nada. Son dos hechos distintos sobre lo que hizo la persona y quien califica
 * los juzga distinto.
 *
 * ⚠️ **El blanco se compara con `trim()`.** Una respuesta de puros espacios
 * pintada con `pre-wrap` es un hueco en la pantalla, y un hueco se lee como que
 * el panel se rompio, no como que no escribio nada.
 *
 * Van en prosa y no en pildora a proposito: el panel ya tiene dos familias de
 * etiquetas —los tres estados de la asistencia y los cuatro alcances de un
 * permiso— y una tercera con la misma silueta las vuelve indistinguibles en
 * gris. Dos frases distintas se leen sin color por construccion.
 */
function LoQueEscribio({ texto }: { texto: string | null }) {
  if (texto === null) {
    return (
      <p className={estilos.sinRespuesta}>
        Sin responder: no llegó ninguna respuesta a esta pregunta.
      </p>
    )
  }

  if (texto.trim() === '') {
    return (
      <p className={estilos.sinRespuesta}>
        Respondió en blanco: la respuesta llegó guardada y vacía, sin una sola palabra.
      </p>
    )
  }

  return <p className={estilos.texto}>{texto}</p>
}
