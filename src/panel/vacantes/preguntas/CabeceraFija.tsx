/**
 * La cabecera fija de los dos editores (V68): se queda arriba al bajar y dice,
 * de un vistazo, cuánto falta y si algo frena la publicación.
 *
 *   - El estado (BORRADOR o PUBLICADA) y el balance, en ámbar si no suma 100;
 *     el lector de pantalla oye también su falta («Los puntos suman…»).
 *   - **Una sola pastilla «⚠ N por arreglar →»**, N las faltas: cada clic lleva
 *     a la siguiente en el orden de la página —abre su criterio, baja hasta ella
 *     y la resalta— y al final vuelve a la primera. La lista no se repite aquí:
 *     cada falta está escrita en su sitio (ver `navegacion.ts`).
 *   - Una barra hasta 100 con un tramo por criterio, en índigos que se aclaran;
 *     lo que falta, en gris. Al pasar el cursor, cada tramo dice su criterio y
 *     sus puntos.
 *   - Las acciones: «Publicar» en el borrador de quien puede editar; con faltas
 *     no publica, lleva a la primera. En la prueba, también el chip del tiempo y
 *     «Configuración», que van juntos. Sin «Publicar» (publicada o en lectura)
 *     su columna no existe: lo último de la fila llega al borde derecho, como el
 *     resumen (QA-08).
 *
 * En el escritorio va en una fila —la pastilla junto al balance— y la barra
 * debajo, con el resumen al final de la barra; en el banco, que no tiene chip,
 * el resumen cabe en la fila y la barra va sola. Con la cabecera estrecha (1024
 * px con el menú abierto, y el teléfono) la pastilla baja a su propia línea y
 * el chip y «Configuración» a la siguiente. Lo decide el ancho de la cabecera y
 * no el de la ventana, porque el menú lateral se pliega.
 *
 * En el teléfono se compacta: estado, balance y «Publicar» en una línea; la
 * pastilla, el chip con «Configuración» y la barra, debajo (QA-01).
 *
 * Su alto se mide y se deja en `--alto-cabecera-fija`: lo que se baja a ver
 * desde una falta tiene que quedar DEBAJO de ella (QA-03).
 *
 * ⚠️ Las faltas son los avisos del servidor, tal cual: el panel no cuadra nada
 * por su cuenta.
 */

import type { ReactNode } from 'react'
import type { CriterioDeLaVersion, VersionDePreguntas } from '../../api/preguntasPropias'
import { useAltoEnUnaVariable } from '../../altoDeLaCabecera'
import { IconoAviso } from '@/ui/Iconos'
import { faltaDelTotal, useIrALasFaltas, type Destino } from './navegacion'
import estilos from './EditorDePreguntas.module.css'

export const VARIABLE_ALTO_CABECERA_FIJA = '--alto-cabecera-fija'

/** «Publicar», en el borrador de quien puede editar. */
export interface Publicacion {
  /** « la prueba» o « las preguntas»: lo que el teléfono deja solo al lector de pantalla. */
  complemento: string
  publicando: boolean
  alPublicar: () => void
}

interface Props {
  /** El nombre de la región: «Balance de la prueba» o «Balance de las preguntas». */
  nombre: string
  estado: string
  /** «80 de 100 pts» o «95 de 100 puntos»: lo que se ve también en el teléfono. */
  balance: string
  /** El resto de las cifras, que en el teléfono se esconden. */
  cifras: ReactNode
  /** La versión de la que salen la barra y los sitios de las faltas. */
  version: VersionDePreguntas
  /** Lo que frena publicar, tal como lo dice el servidor. Vacío en la publicada: no hay nada que arreglar. */
  faltas: string[]
  /** Solo en la prueba: el chip del tiempo. */
  chip?: ReactNode
  /** Solo en la prueba: «Configuración», que va con el chip. */
  ajustes?: ReactNode
  /** «Publicar»; sin él (publicada o en lectura), su columna no existe. */
  publicar?: Publicacion | null
  alIr: (destino: Destino) => void
}

export function CabeceraFija({ nombre, estado, balance, cifras, version, faltas, chip, ajustes, publicar, alIr }: Props) {
  const medir = useAltoEnUnaVariable(VARIABLE_ALTO_CABECERA_FIJA)
  const irA = useIrALasFaltas(faltas, version, alIr)
  const delTotal = faltaDelTotal(faltas, version.total)
  const conChip = Boolean(chip || ajustes)
  const clases = [estilos.cabeceraFija, conChip && estilos.cabeceraConChip, !publicar && estilos.sinAcciones]
    .filter(Boolean)
    .join(' ')
  return (
    <section ref={medir} className={clases} aria-label={nombre}>
      <div className={estilos.rejillaCabecera}>
        <div className={estilos.lineaCabecera}>
          <span className={estilos.estadoVersion}>{estado}</span>
          <p
            className={delTotal ? `${estilos.balanceCabecera} ${estilos.balanceConFalta}` : estilos.balanceCabecera}
            title={delTotal ?? undefined}
          >
            <span>{balance}</span>
            {delTotal && <span className={estilos.soloLectores}>. {delTotal}</span>}
          </p>
        </div>
        {irA.cuantas > 0 && (
          <div className={estilos.faltasCabecera}>
            <button className={estilos.porArreglar} type="button" title="Ir a la siguiente" onClick={irA.siguiente}>
              <IconoAviso tamano={16} />
              {irA.cuantas} por arreglar
              <span className={estilos.flechaFalta} aria-hidden="true">
                →
              </span>
            </button>
          </div>
        )}
        {conChip && (
          <div className={estilos.herramientasCabecera}>
            {chip}
            {ajustes}
          </div>
        )}
        {publicar && (
          <div className={estilos.accionesCabecera}>
            <button
              className={estilos.publicar}
              type="button"
              aria-label={publicar.publicando ? undefined : `Publicar${publicar.complemento}`}
              onClick={irA.cuantas > 0 ? irA.primera : publicar.alPublicar}
              disabled={publicar.publicando}
            >
              {publicar.publicando ? (
                'Publicando…'
              ) : (
                <span>
                  Publicar<span className={estilos.restoDelRotulo}>{publicar.complemento}</span>
                </span>
              )}
            </button>
          </div>
        )}
        <div className={estilos.pieDeLaBarra}>
          <BarraDePuntos criterios={version.criterios} total={version.total} />
          <p className={estilos.cifras}>{cifras}</p>
        </div>
      </div>
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
