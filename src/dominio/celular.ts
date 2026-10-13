/**
 * El celular de la cuenta: cómo se escribe y cómo se enseña (V73).
 *
 * Es la misma regla que el backend (`whatsapp/service/Celular.java`), y tiene que
 * seguir siéndolo: si el portal dejara pasar un número que la API rechaza, el
 * formulario rebotaría con un error que la pantalla no supo prevenir.
 *
 *   - Perú: nueve cifras que empiezan por 9 («987 654 321»), con o sin el 51.
 *   - Otro país: el número completo con su prefijo, empezando por «+» o «00».
 *
 * Los espacios, guiones, puntos y paréntesis no cuentan.
 */

/** El mensaje cuando no vale. Es literalmente el del backend. */
export const MENSAJE_CELULAR =
  'Escribe un celular de 9 cifras que empiece por 9, o el número completo con su prefijo'

const SEPARADORES = /[\s\-.()]/g

/**
 * Lo escrito en formato internacional («+51987654321»), o `null` si no vale.
 *
 * El portal manda lo que escribió la persona y es el backend quien guarda el
 * E.164; esto es para validar antes de enviar y para enseñar el número.
 */
export function comoE164(escrito: string): string | null {
  let limpio = escrito.trim().replace(SEPARADORES, '')
  if (limpio.startsWith('00')) limpio = `+${limpio.slice(2)}`
  if (limpio.startsWith('+')) {
    const cifras = limpio.slice(1)
    return esInternacional(cifras) ? `+${cifras}` : null
  }
  if (/^9\d{8}$/.test(limpio)) return `+51${limpio}`
  // «51 987 654 321»: el peruano con su prefijo pero sin el «+».
  if (/^519\d{8}$/.test(limpio)) return `+${limpio}`
  return null
}

function esInternacional(cifras: string): boolean {
  if (!/^[1-9]\d{7,14}$/.test(cifras)) return false
  // Un fijo peruano no recibe WhatsApp: con el 51, nueve cifras que empiezan por 9.
  if (cifras.startsWith('51')) return /^519\d{8}$/.test(cifras)
  return true
}

/** «+51 987 654 321» para Perú; los demás, tal cual se guardan. */
export function paraMostrar(e164: string): string {
  const peruano = /^\+51(\d{3})(\d{3})(\d{3})$/.exec(e164)
  return peruano ? `+51 ${peruano[1]} ${peruano[2]} ${peruano[3]}` : e164
}

/**
 * El valor que se pone en el campo al editar: sin el +51, que el campo ya dibuja
 * delante. Un número de otro país va entero, con su «+».
 */
export function paraEditar(e164: string | null | undefined): string {
  if (!e164) return ''
  const peruano = /^\+51(\d{3})(\d{3})(\d{3})$/.exec(e164)
  return peruano ? `${peruano[1]} ${peruano[2]} ${peruano[3]}` : e164
}
