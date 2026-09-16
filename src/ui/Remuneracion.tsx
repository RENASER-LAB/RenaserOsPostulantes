/**
 * Lo que una vacante paga, dicho en voz alta.
 *
 * Vive aqui y no dentro de una pantalla porque lo pintan tres: la ficha de la
 * vacante, el formulario de postular y el detalle de un proceso. Que digan lo
 * mismo importa mas de lo normal — es la mitad de un trato, y dos redacciones
 * distintas del mismo sueldo se leen como dos sueldos.
 *
 * Tres decisiones:
 *
 *   - **`OCULTA` se nombra, no se esconde.** «La empresa no publica el sueldo»
 *     en lugar de un hueco. El hueco se lee como un fallo de carga, y ademas es
 *     el dato que explica por que al postular no le van a pedir el suyo.
 *   - **El «actualizado el …» es ambar, no coral.** En «El escaparate» el coral
 *     significa una sola cosa, «te toca a ti», y que le cambien el sueldo no es
 *     un turno suyo: no hay nada que hacer. Es `--duda`, que es exactamente «lo
 *     que cambia tu decision».
 *   - **El texto llega escrito del servidor.** `texto` ya dice «S/ 3 500 a
 *     4 200»; aqui no se formatea ningun numero. Asi el correo que le llega y la
 *     pantalla que abre despues dicen la misma frase, caracter a caracter.
 */

import type { RemuneracionPublica } from '@/api/tipos'
import estilos from './Remuneracion.module.css'

/** El dia en que cambio, para el pie del monto. */
function elDia(iso: string): string {
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return ''
  return fecha.toLocaleDateString('es-PE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function Remuneracion({
  remuneracion,
  /**
   * Si hay que llamar la atencion sobre el monto.
   *
   * Lo enciende quien sabe que ESTE candidato tiene un aviso sin leer de esta
   * vacante — no la fecha por si sola. Una vacante que cambio de sueldo hace un
   * año y a la que postulo ayer no tiene ninguna novedad que contarle, y
   * resaltarla le haria buscar un cambio que para el no existe.
   */
  resaltado = false,
}: {
  remuneracion: RemuneracionPublica | null | undefined
  resaltado?: boolean
}) {
  // Contra un backend anterior el campo no viaja. Se trata como oculta: es lo
  // que eran todas las vacantes antes de que esto existiera.
  if (!remuneracion || remuneracion.tipo === 'OCULTA') {
    return (
      <p className={estilos.oculta}>
        <span className={estilos.etiqueta}>Remuneración</span>
        <span className={estilos.sinPublicar}>La empresa no publica el sueldo</span>
      </p>
    )
  }

  return (
    <p className={`${estilos.bloque} ${resaltado ? estilos.resaltado : ''}`}>
      <span className={estilos.etiqueta}>Remuneración</span>
      <span className={estilos.monto}>{remuneracion.texto}</span>
      {remuneracion.tipo === 'RANGO' && (
        <span className={estilos.matiz}>según experiencia</span>
      )}
      {remuneracion.actualizadaEn && (
        <span className={estilos.actualizado}>
          Actualizado el {elDia(remuneracion.actualizadaEn)}
        </span>
      )}
    </p>
  )
}
