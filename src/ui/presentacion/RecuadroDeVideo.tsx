/**
 * El video de una empresa o de un puesto (V85), sin cargar nada de YouTube ni
 * de Vimeo hasta que la persona lo pulsa.
 *
 * Antes de pulsar es un recuadro 16:9 en fondo noche con el nombre de la
 * empresa y un botón de reproducir: ni un `<iframe>`, ni una miniatura del
 * servicio. Al pulsarlo se cambia por el reproductor, sin cookies de
 * seguimiento (`youtube-nocookie.com`, `dnt=1`), y empieza solo. Debajo queda
 * siempre «Ver en YouTube» o «Ver en Vimeo», que abre el video fuera —es la
 * salida si el reproductor no se deja incrustar, también en la app—.
 *
 * ⚠️ **La dirección se reconstruye con el servicio y el identificador**, nunca
 * copiando el enlace guardado. Y el `<iframe>` lleva
 * `strict-origin-when-cross-origin`, no `no-referrer`: YouTube exige saber
 * desde qué página se reproduce y sin eso muestra un error.
 *
 * ⚠️ **Los permisos son los que necesita y ni uno más**: reproducción
 * automática, pantalla completa, imagen dentro de imagen y `encrypted-media`.
 * Sin este último el reproductor de Vimeo carga pero se queda en negro en
 * 00:00 («encrypted-media is not allowed»); el código de inserción oficial de
 * Vimeo lo lleva. YouTube no lo necesita, pero el iframe es el mismo.
 *
 * Se monta de nuevo al cambiar de vacante (la pantalla partida le pone `key`),
 * así que el video que sonaba se detiene al elegir otra.
 */

import { useState } from 'react'
import type { VideoPublico } from '@/api/tipos'
import {
  direccionDelReproductor,
  direccionParaVerFuera,
  nombreDelServicio,
  type VideoLeido,
} from '@/dominio/presentacionEmpresa'
import { IconoReproducir } from '@/ui/Iconos'
import estilos from './Presentacion.module.css'

export function RecuadroDeVideo({
  video,
  empresa,
  titulo,
  className,
}: {
  video: VideoPublico | VideoLeido
  /** El nombre que va dentro del recuadro y en el nombre del botón. */
  empresa: string
  /** «Conoce a Molinos del Sur» o «Conoce el puesto», encima del recuadro. */
  titulo?: string
  className?: string
}) {
  const [pulsado, setPulsado] = useState(false)
  const reproductor = direccionDelReproductor(video)
  const fuera = direccionParaVerFuera(video)
  if (!reproductor || !fuera) return null
  const servicio = nombreDelServicio(video)

  return (
    <figure className={`${estilos.video}${className ? ` ${className}` : ''}`}>
      {titulo && <figcaption className={estilos.tituloVideo}>{titulo}</figcaption>}
      {pulsado ? (
        <iframe
          className={estilos.reproductor}
          src={reproductor}
          title={`Video de ${empresa} en ${servicio}`}
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button
          type="button"
          className={estilos.recuadro}
          onClick={() => setPulsado(true)}
          aria-label={`Reproducir el video de ${empresa}`}
        >
          <span className={estilos.nombreEnElRecuadro}>{empresa}</span>
          <span className={estilos.circulo} aria-hidden="true">
            <IconoReproducir tamano={24} />
          </span>
        </button>
      )}
      <a className={estilos.verFuera} href={fuera} target="_blank" rel="noopener noreferrer">
        Ver en {servicio}
      </a>
    </figure>
  )
}
