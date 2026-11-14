/**
 * Las piezas que la fila y la vista previa pintan igual.
 *
 * Las marcas de estado de una prueba son las de Colaboradores. «Publicada» va
 * en relleno verde, «Borrador» en contorno y «La rinde alguien» en ámbar; «Hay
 * un borrador abierto» es un texto menor ámbar con su punto. Cada una se
 * distingue por la forma, no solo por el color.
 */

import { Fragment } from 'react'
import type { FilaDePrueba } from '../api/pruebas'
import estilos from './Pruebas.module.css'

/**
 * «1 criterio · 0 preguntas · 1 entregable · Sin cronómetro»: cada parte entera
 * y el « · » fuera de ellas, para que la línea parta entre una y otra en vez de
 * salirse de su celda.
 */
export function ResumenDeLaPrueba({ partes }: { partes: readonly string[] }) {
  return partes.map((p, i) => (
    <Fragment key={i}>
      {i > 0 && ' · '}
      <span className={estilos.parte}>{p}</span>
    </Fragment>
  ))
}

export function MarcasDeEstado({ fila }: { fila: FilaDePrueba }) {
  return (
    <span className={estilos.estadoDeLaFila}>
      <span className={estilos.marcas}>
        {fila.estado === 'PUBLICADA' ? (
          <span className={`${estilos.marca} ${estilos.marcaPublicada}`}>Publicada</span>
        ) : (
          <span className={`${estilos.marca} ${estilos.marcaBorrador}`}>Borrador</span>
        )}
        {fila.laRindeAlguien && <span className={`${estilos.marca} ${estilos.marcaEnUso}`}>La rinde alguien</span>}
      </span>
      {fila.hayBorradorAbierto && <span className={estilos.borradorAbierto}>Hay un borrador abierto</span>}
    </span>
  )
}
