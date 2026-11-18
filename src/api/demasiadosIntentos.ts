/**
 * El 429 de entrar, en palabras: cuánto falta para volver a probar.
 *
 * El backend frena tras cinco intentos fallidos —en el portal y en el panel— y devuelve
 * `segundosDeEspera` en el cuerpo (y en `Retry-After`). Decir cuánto falta es la diferencia
 * entre esperar y volver a probar cada dos segundos, que solo alarga el bloqueo.
 *
 * Nulo si el fallo no es un 429: quien llama pinta su propio mensaje.
 */

import { ErrorApi } from './puerta'

export function textoDeDemasiadosIntentos(causa: unknown): string | null {
  if (!(causa instanceof ErrorApi) || causa.estado !== 429) return null
  const segundos = (causa.cuerpo as { segundosDeEspera?: unknown } | null)?.segundosDeEspera
  if (typeof segundos === 'number' && segundos > 0) {
    const minutos = Math.ceil(segundos / 60)
    return minutos <= 1
      ? 'Demasiados intentos fallidos. Vuelve a probar en un minuto.'
      : `Demasiados intentos fallidos. Vuelve a probar en ${minutos} minutos.`
  }
  return 'Demasiados intentos fallidos. Espera un momento antes de volver a probar.'
}
