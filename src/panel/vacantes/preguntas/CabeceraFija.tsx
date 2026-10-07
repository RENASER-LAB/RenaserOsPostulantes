/**
 * La cabecera fija de los dos editores (V68): se queda arriba al bajar y dice,
 * de un vistazo, cuánto falta y qué frena la publicación.
 *
 *   - El estado (BORRADOR o PUBLICADA) y el balance.
 *   - Una barra hasta 100 con un tramo por criterio, en índigos que se aclaran;
 *     lo que falta, en gris. Al pasar el cursor, cada tramo dice su criterio y
 *     sus puntos.
 *   - Las faltas como botones ámbar con flecha: cada una lleva a donde se
 *     arregla (ver `navegacion.ts`).
 *   - Las acciones: «Publicar» en el borrador de quien puede editar; en la
 *     prueba, también el chip del tiempo y «Configuración», que van juntos.
 *     Sin «Publicar» (publicada o en lectura) su columna no existe: lo último
 *     de la fila llega al borde derecho, como el resumen (QA-08).
 *
 * En el escritorio va en una fila y la barra debajo, con el resumen al final de
 * la barra; en el banco, que no tiene chip, el resumen cabe en la fila y la
 * barra va sola. Con la cabecera estrecha (1024 px con el menú abierto), el chip
 * y «Configuración» bajan a su propia línea. Lo decide el ancho de la cabecera y
 * no el de la ventana, porque el menú lateral se pliega.
 *
 * En el teléfono se compacta: estado, balance y «Publicar» en una línea; el
 * chip con «Configuración» y las faltas, debajo (QA-01).
 *
 * Las faltas son botones bajos, en línea y varios por fila. En el escritorio se
 * enseñan las cuatro primeras y «Ver N más» despliega las demás, para que la
 * cabecera no crezca sin límite; en el teléfono van todas en una fila que se
 * desplaza.
 *
 * Su alto se mide y se deja en `--alto-cabecera-fija`: crece con las faltas, y
 * lo que se baja a ver desde una falta tiene que quedar DEBAJO de ella (QA-03).
 *
 * ⚠️ Las faltas son los avisos del servidor, tal cual: el panel no cuadra nada
 * por su cuenta.
 */

import { useId, useState, type ReactNode } from 'react'
import type { CriterioDeLaVersion, VersionDePreguntas } from '../../api/preguntasPropias'
import { useAltoEnUnaVariable } from '../../altoDeLaCabecera'
import { destinoDelAviso, type Destino } from './navegacion'
import estilos from './EditorDePreguntas.module.css'

export const VARIABLE_ALTO_CABECERA_FIJA = '--alto-cabecera-fija'

/** Las faltas que se ven en el escritorio antes de «Ver N más»: dos filas. */
export const FALTAS_A_LA_VISTA = 4

interface Props {
  /** El nombre de la región: «Balance de la prueba» o «Balance de las preguntas». */
  nombre: string
  estado: string
  /** «80 de 100 pts» o «95 de 100 puntos»: lo que se ve también en el teléfono. */
  balance: string
  /** El resto de las cifras, que en el teléfono se esconden. */
  cifras: ReactNode
  /** La versión de la que salen la barra y las faltas. */
  version: VersionDePreguntas
  /** Solo en la prueba: el chip del tiempo. */
  chip?: ReactNode
  /** Solo en la prueba: «Configuración», que va con el chip. */
  ajustes?: ReactNode
  /** «Publicar»: la que se queda en la línea del balance. */
  acciones: ReactNode
  alIr: (destino: Destino) => void
}

export function CabeceraFija({ nombre, estado, balance, cifras, version, chip, ajustes, acciones, alIr }: Props) {
  const medir = useAltoEnUnaVariable(VARIABLE_ALTO_CABECERA_FIJA)
  const conChip = Boolean(chip || ajustes)
  const conAcciones = Boolean(acciones)
  const clases = [estilos.cabeceraFija, conChip && estilos.cabeceraConChip, !conAcciones && estilos.sinAcciones]
    .filter(Boolean)
    .join(' ')
  return (
    <section ref={medir} className={clases} aria-label={nombre}>
      <div className={estilos.rejillaCabecera}>
        <div className={estilos.lineaCabecera}>
          <span className={estilos.estadoVersion}>{estado}</span>
          <p className={estilos.balanceCabecera}>{balance}</p>
        </div>
        {conChip && (
          <div className={estilos.herramientasCabecera}>
            {chip}
            {ajustes}
          </div>
        )}
        {conAcciones && <div className={estilos.accionesCabecera}>{acciones}</div>}
        <div className={estilos.pieDeLaBarra}>
          <BarraDePuntos criterios={version.criterios} total={version.total} />
          <p className={estilos.cifras}>{cifras}</p>
        </div>
        {version.avisos.length > 0 && <Faltas avisos={version.avisos} version={version} alIr={alIr} />}
      </div>
    </section>
  )
}

/**
 * Las faltas, bajas y en línea. Cada una lleva a donde se arregla; el texto
 * largo se corta con «…» a la vista, pero el botón lo dice entero (y al pasar
 * el cursor también). Las que pasan de `FALTAS_A_LA_VISTA` se esconden en el
 * escritorio hasta «Ver N más»; «Ver N más» queda fuera de la lista, que solo
 * tiene faltas.
 */
function Faltas({
  avisos,
  version,
  alIr,
}: {
  avisos: string[]
  version: VersionDePreguntas
  alIr: (destino: Destino) => void
}) {
  const id = useId()
  const [todas, setTodas] = useState(false)
  const escondidas = avisos.length - FALTAS_A_LA_VISTA
  return (
    <div className={estilos.faltasCabecera}>
      <ul
        id={id}
        className={escondidas > 0 ? `${estilos.listaFaltas} ${estilos.listaConVerMas}` : estilos.listaFaltas}
        aria-label="Lo que frena la publicación"
      >
        {avisos.map((aviso, i) => (
          <li key={aviso} className={!todas && i >= FALTAS_A_LA_VISTA ? estilos.faltaEscondida : undefined}>
            <button
              className={estilos.botonFalta}
              type="button"
              title={aviso}
              onClick={() => alIr(destinoDelAviso(aviso, version))}
            >
              <span className={estilos.textoFalta}>{aviso}</span>
              <span className={estilos.flechaFalta} aria-hidden="true">
                →
              </span>
            </button>
          </li>
        ))}
      </ul>
      {escondidas > 0 && (
        <button
          className={estilos.verMasFaltas}
          type="button"
          aria-expanded={todas}
          aria-controls={id}
          onClick={() => setTodas((t) => !t)}
        >
          {todas ? 'Ver menos' : `Ver ${escondidas} más`}
        </button>
      )}
    </div>
  )
}

/**
 * La barra hasta 100. Si la versión pasa de 100 se reparte sobre lo que suma,
 * para que ningún tramo se salga; la falta ya dice que sobran.
 */
export function BarraDePuntos({ criterios, total }: { criterios: CriterioDeLaVersion[]; total: number }) {
  const escala = Math.max(100, total)
  const conPuntos = criterios.filter((c) => c.puntos > 0)
  const descripcion = [
    `${total} de 100 puntos`,
    ...conPuntos.map((c) => `${c.nombre}: ${c.puntos}`),
  ].join(' · ')
  return (
    <div className={estilos.barra} role="img" aria-label={descripcion}>
      {conPuntos.map((c, i) => {
        const titulo = `${c.nombre} · ${c.puntos} pts`
        return (
          <span
            key={c.id}
            className={estilos.tramo}
            title={titulo}
            style={{ width: `${(c.puntos / escala) * 100}%`, ['--paso' as string]: i % 5 }}
          />
        )
      })}
    </div>
  )
}
