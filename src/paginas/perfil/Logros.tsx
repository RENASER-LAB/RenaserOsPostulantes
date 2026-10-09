/**
 * Los logros clave del candidato (V71): hasta tres resultados concretos por los
 * que deberían contratarlo, escritos por él en «Acerca de ti».
 *
 * Se pintan en dos sitios —la cabecera de identidad, arriba, y la vista normal
 * de «Acerca de ti», más abajo— y **es la misma pieza en los dos a propósito**.
 * `Perfil.tsx` dejó de repetir el titular y las señas porque la segunda
 * aparición «parecía otro dato distinto»; para que esto se lea como el mismo
 * dato, los dos sitios llevan el mismo rótulo, la misma numeración y el mismo
 * orden. Lo único que cambia es el corte: en la cabecera cada logro ocupa como
 * mucho dos líneas; en «Acerca de ti» va siempre entero.
 *
 * ⚠️ **Nada en índigo**, ni el número: por la regla de la voz única el índigo
 * es lo que se pulsa, dónde estás o lo que te toca, y esto no es ninguna de las
 * tres. Sin logros no se pinta nada: ni rótulo ni hueco.
 */

import { useId } from 'react'
import estilos from './Logros.module.css'

/** El rótulo de los dos sitios, y lo que buscan las pruebas. */
export const ROTULO_LOGROS = 'Logros clave'

export function ListaDeLogros({
  logros,
  compacta = false,
}: {
  logros: readonly string[]
  /**
   * La versión de la cabecera: rótulo en párrafo y cada logro cortado a dos
   * líneas con «…». El texto completo sigue en el DOM, así que un lector de
   * pantalla lo lee entero; quien mira lo tiene en «Acerca de ti».
   */
  compacta?: boolean
}) {
  const idRotulo = useId()
  if (logros.length === 0) return null

  // En «Acerca de ti» es un subtítulo de la sección, como «Lo que sabes hacer».
  // En la cabecera no: un encabezado ahí metería «Logros clave» en el índice de
  // encabezados por delante de las secciones de la página.
  const Rotulo = compacta ? 'p' : 'h3'

  return (
    <div className={compacta ? estilos.enLaCabecera : estilos.enAcercaDe}>
      <Rotulo className={estilos.rotulo} id={idRotulo}>
        {ROTULO_LOGROS}
      </Rotulo>
      {/* `role="list"`: sin viñetas, Safari le quita a la lista su semántica. */}
      <ol className={estilos.lista} role="list" aria-labelledby={idRotulo}>
        {logros.map((logro, i) => (
          // La posición es la identidad: los repetidos se guardan tal cual.
          <li className={estilos.logro} key={i}>
            <span className={estilos.numero} aria-hidden="true">
              {i + 1}
            </span>
            <span className={compacta ? estilos.textoCortado : estilos.texto}>{logro}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
