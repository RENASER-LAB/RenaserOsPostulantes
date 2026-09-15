/**
 * Leer una cifra de dinero escrita a mano.
 *
 * Existe porque `Number('3,500')` devuelve **3.5**, y `Number('3.500')` también.
 * En el Perú las dos cadenas significan tres mil quinientos, y las dos formas se
 * escriben a diario. Un formulario que acepte eso en silencio publica una
 * vacante que promete tres soles con cincuenta, o registra a alguien pidiendo
 * S/ 3.50 — y los dos pasan las validaciones de «mayor que cero».
 *
 * La regla, y es deliberadamente estrecha:
 *
 *   - **Los sueldos van en cifras enteras.** Nadie negocia los céntimos de un
 *     sueldo mensual, y admitirlos es admitir la ambigüedad entera: con
 *     decimales no hay forma de saber si «3,50» son tres soles y medio o un
 *     error de tecleo por 3500.
 *   - **Los separadores de miles valen, coma o punto, si agrupan de tres en
 *     tres.** `3,500`, `3.500`, `3 500` y `3500` son la misma cifra. `3,50` no
 *     es ninguna de las dos cosas y se rechaza con un mensaje que dice cómo
 *     escribirla.
 *   - **Nada más pasa.** `1e5` valía 100 000 y `0x1f` valía 31 atravesando un
 *     error que decía «solo números».
 */

/**
 * La cifra, o `null` si lo escrito no es una.
 *
 * `null` cubre el vacío y lo ilegible a la vez: quien llame decide qué decir en
 * cada caso, porque «falta la cifra» y «esa cifra no se entiende» son dos
 * mensajes distintos.
 */
export function aCifra(texto: string): number | null {
  // El espacio duro entra pegado al copiar de una hoja de cálculo o de un PDF.
  const limpio = texto.replace(/[\s ]/g, '')
  if (limpio === '') return null

  // Dígitos sueltos, o grupos de tres separados de forma consistente. El
  // separador se captura y se exige el mismo en todos los grupos: `1,234.567`
  // es un error de quien lo escribió, no dos convenciones a la vez.
  const enteroPuro = /^\d+$/.test(limpio)
  const conSeparadores = /^\d{1,3}([.,])\d{3}(\1\d{3})*$/.test(limpio)
  if (!enteroPuro && !conSeparadores) return null

  const numero = Number(limpio.replace(/[.,]/g, ''))
  // `Number.isSafeInteger` y no `isFinite`: una cifra de veinte dígitos deja de
  // ser exacta en punto flotante, y un sueldo que pierde precisión al leerse es
  // peor que uno rechazado.
  return Number.isSafeInteger(numero) ? numero : null
}

/**
 * Qué decir cuando `aCifra` devuelve `null` habiendo texto.
 *
 * Una sola frase, con un ejemplo dentro: «solo números» no le dice a nadie qué
 * tiene mal «3,50», y menos aún qué escribir en su lugar.
 */
export const COMO_SE_ESCRIBE =
  'Escribe la cifra mensual en soles enteros, sin céntimos. Por ejemplo: 3500.'
