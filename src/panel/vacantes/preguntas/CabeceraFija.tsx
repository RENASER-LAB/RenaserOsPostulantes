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
 *   - Las acciones: «Publicar» siempre; en la prueba, también el chip del
 *     tiempo y «Configuración», que van juntos.
 *
 * En el teléfono se compacta: estado, balance y «Publicar» en una línea; el
 * chip con «Configuración» y las faltas, debajo (QA-01).
 *
 * Su alto se mide y se deja en `--alto-cabecera-fija`: crece con las faltas, y
 * lo que se baja a ver desde una falta tiene que quedar DEBAJO de ella (QA-03).
 *
 * ⚠️ Las faltas son los avisos del servidor, tal cual: el panel no cuadra nada
 * por su cuenta.
 */

import type { ReactNode } from 'react'
import type { CriterioDeLaVersion, VersionDePreguntas } from '../../api/preguntasPropias'
import { useAltoEnUnaVariable } from '../../altoDeLaCabecera'
import { destinoDelAviso, type Destino } from './navegacion'
import estilos from './EditorDePreguntas.module.css'

export const VARIABLE_ALTO_CABECERA_FIJA = '--alto-cabecera-fija'

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
  return (
    <section
      ref={medir}
      className={conChip ? `${estilos.cabeceraFija} ${estilos.cabeceraConChip}` : estilos.cabeceraFija}
      aria-label={nombre}
    >
      <div className={estilos.lineaCabecera}>
        <span className={estilos.estadoVersion}>{estado}</span>
        <p className={estilos.balanceCabecera}>{balance}</p>
        <p className={estilos.cifras}>{cifras}</p>
      </div>
      {conChip && (
        <div className={estilos.herramientasCabecera}>
          {chip}
          {ajustes}
        </div>
      )}
      <div className={estilos.accionesCabecera}>{acciones}</div>
      <BarraDePuntos criterios={version.criterios} total={version.total} />
      {version.avisos.length > 0 && (
        <ul className={estilos.faltasCabecera} aria-label="Lo que frena la publicación">
          {version.avisos.map((aviso) => (
            <li key={aviso}>
              <button
                className={estilos.botonFalta}
                type="button"
                onClick={() => alIr(destinoDelAviso(aviso, version))}
              >
                <span>{aviso}</span>
                <span className={estilos.flechaFalta} aria-hidden="true">
                  →
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
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
