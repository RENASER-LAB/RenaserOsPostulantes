/**
 * El logotipo de EX.
 *
 * Una «E» maciza y una «X» de trazos huecos, cruzada por una hormiga de perfil.
 * Llego el 28/09/2026 como PNG (`logotipo.png`, el archivo que entrego el
 * usuario, sin retocar) y sustituyo a la palabra «EX» con la hormiga vista desde
 * arriba posada sobre la X. No se vectorizo: redibujarlo cambiaria la forma que
 * se entrego, y a los tamaños de uso —hasta 56 px, 168 en una pantalla 3×— los
 * 714 px del archivo sobran.
 *
 * ⚠️ **Este es el unico sitio que conoce el archivo.** Ninguna pantalla importa
 * el PNG: se pone `<Marca />`. Se importa desde aqui para que Vite le ponga
 * huella al nombre y un logotipo nuevo no deje a nadie con el viejo en cache.
 *
 * Se pinta como **mascara** sobre un fondo `currentColor` (ver `.marca` en
 * `mundo.css`): asi sale en la tinta del texto y no en el negro del archivo, y
 * donde hace de marca de agua quien la usa le cambia el color y sale gris. Va
 * monocromo siempre: se probo pintar la hormiga vieja del acento donde salia
 * sola y no puede ser, el indigo significa «te toca a ti» y ahi no toca nada.
 * Tampoco se anima.
 *
 * Si el PNG no llega, la mascara no deja ver nada pero la caja se queda con su
 * medida: no salta nada, no sale la imagen rota del navegador y el enlace que
 * la envuelve conserva su nombre.
 */

import type { CSSProperties } from 'react'
import logotipo from './logotipo.png'

/** Ancho entre alto del archivo, 808 × 714. */
const PROPORCION = 808 / 714

interface Props {
  /**
   * El alto total del dibujo, en pixeles. El ancho sale de la proporcion del
   * archivo. A 24 px o menos la «E» —unos 3/5 del alto— deja de leerse bien, y
   * ningun sitio de la web baja de ahi.
   */
  tamano?: number
}

export function Marca({ tamano = 28 }: Props) {
  const imagen = `url("${logotipo}")`
  const estilo: CSSProperties = {
    width: `${Math.round(tamano * PROPORCION * 100) / 100}px`,
    height: `${tamano}px`,
    // Las dos: la WebView de un Android sin actualizar solo entiende la de prefijo.
    WebkitMaskImage: imagen,
    maskImage: imagen,
  }

  // `role="img"` con su nombre: donde el enlace que la envuelve lleva su propia
  // etiqueta —«EX, inicio»— manda la del enlace, y donde el envoltorio va con
  // `aria-hidden` sigue oculta.
  return <span className="marca" role="img" aria-label="EX" style={estilo} />
}
