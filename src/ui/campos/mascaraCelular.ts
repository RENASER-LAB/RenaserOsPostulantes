/**
 * La máscara del celular: qué queda en el campo después de cada tecla, cada borrado
 * y cada pegado (spec «Celular con formato 999 999 999»).
 *
 * Son funciones puras, sin React: reciben lo que había, lo que el navegador dejó en
 * el campo y dónde quedó el cursor, y devuelven lo que tiene que quedar. `CampoCelular`
 * solo las aplica. La regla de qué celular vale no vive aquí: sigue en
 * `dominio/celular.ts`, y se comprueba al enviar. Esto solo impide escribirlo mal.
 *
 *   - **Peruano**, lo normal: solo cifras, de tres en tres («987 654 321»), y nunca
 *     una décima. Letras, guiones, puntos, paréntesis y espacios no se escriben.
 *   - **De otro país**: si empieza por «+» (o por «00», que se vuelve «+»), «+» y
 *     hasta 15 cifras con los espacios que ponga la persona.
 *   - **Pegado o autocompletado**: se lee entero. «51987654321» o «+51 987 654 321»
 *     quedan «987 654 321»; lo que no se puede leer deja el campo como estaba y pide
 *     el mensaje de la regla. Nunca se corta en silencio.
 */

const MAXIMO_PERUANO = 9
const MAXIMO_INTERNACIONAL = 15

/** Lo que pasó en el campo, tal como lo cuenta el evento `input`. */
export interface Cambio {
  /** Lo que había, ya con la máscara. */
  anterior: string
  /** Lo que el navegador dejó en el campo tras la tecla, el borrado o el pegado. */
  escrito: string
  /** Dónde quedó el cursor en `escrito`. */
  cursor: number
  /** `InputEvent.inputType`, cuando el navegador lo da. El autocompletado no siempre. */
  tipo?: string
}

export type Resultado =
  | { acepta: true; valor: string; cursor: number }
  /** El campo se queda como estaba; `aviso` dice si hay que enseñar el mensaje de la regla. */
  | { acepta: false; cursor: number; aviso: boolean }

/** Un número de otro país: el que empieza por «+». El «+51» de delante se esconde. */
export const esInternacional = (valor: string) => valor.startsWith('+')

const esCifra = (caracter: string) => caracter >= '0' && caracter <= '9'
const cifrasDe = (texto: string) => texto.replace(/[^0-9]/g, '')
const cifrasAntes = (texto: string, cursor: number) => cifrasDe(texto.slice(0, cursor)).length

/** «987654321» → «987 654 321»: de tres en tres, sin espacio al final. */
export function agrupar(cifras: string): string {
  return cifras.replace(/(\d{3})(?=\d)/g, '$1 ')
}

/** Dónde queda el cursor justo después de la cifra número `n` de `valor`. */
function trasLaCifra(valor: string, n: number): number {
  if (n <= 0) return 0
  let vistas = 0
  for (let i = 0; i < valor.length; i++) {
    if (esCifra(valor.charAt(i))) {
      vistas++
      if (vistas === n) return i + 1
    }
  }
  return valor.length
}

/** Adónde vuelve el cursor si lo escrito no entra: donde estaba antes de escribirlo. */
function retroceso({ anterior, escrito, cursor }: Cambio): number {
  const metido = Math.max(0, escrito.length - anterior.length)
  return Math.min(anterior.length, Math.max(0, cursor - metido))
}

function peruano(cifras: string, antesDelCursor: number): Aceptado {
  const valor = agrupar(cifras)
  return { acepta: true, valor, cursor: trasLaCifra(valor, antesDelCursor) }
}

type Aceptado = Extract<Resultado, { acepta: true }>

/** «+» y, detrás, solo cifras y espacios: lo demás no se escribe. El cursor no se mueve. */
function internacional(escrito: string, cursor: number): Aceptado {
  let valor = '+'
  let nuevoCursor = cursor > 0 ? 1 : 0
  for (let i = 1; i < escrito.length; i++) {
    const caracter = escrito.charAt(i)
    if (!esCifra(caracter) && caracter !== ' ') continue
    valor += caracter
    if (i < cursor) nuevoCursor = valor.length
  }
  return { acepta: true, valor, cursor: nuevoCursor }
}

/** Una tecla, o lo que el teclado del móvil escribe de una vez: cifras sí, lo demás no. */
function deTecla(cambio: Cambio): Resultado {
  let texto = cambio.escrito
  let cursor = cambio.cursor
  // «00» delante es como se marca fuera desde el Perú: se vuelve «+».
  if (texto.startsWith('00')) {
    texto = `+${texto.slice(2)}`
    cursor = cursor >= 2 ? cursor - 1 : Math.min(cursor, 1)
  }
  const anteriores = cifrasDe(cambio.anterior).length
  if (esInternacional(texto)) {
    if (texto.includes('+', 1)) return { acepta: false, cursor: retroceso(cambio), aviso: false }
    const resultado = internacional(texto, cursor)
    const cifras = cifrasDe(resultado.valor).length
    if (cifras > MAXIMO_INTERNACIONAL && cifras > anteriores) {
      return { acepta: false, cursor: retroceso(cambio), aviso: false }
    }
    return resultado
  }
  // Un «+» que no va delante no se escribe.
  if (texto.includes('+')) return { acepta: false, cursor: retroceso(cambio), aviso: false }
  const cifras = cifrasDe(texto)
  if (cifras.length > MAXIMO_PERUANO && cifras.length > anteriores) {
    return { acepta: false, cursor: retroceso(cambio), aviso: false }
  }
  return peruano(cifras, cifrasAntes(texto, cursor))
}

/**
 * Un borrado. Si lo único que se fue es un espacio de la máscara —retroceso justo
 * detrás de él—, se lleva la cifra de al lado, que es la que la persona quería borrar:
 * si no, la máscara lo volvería a poner y el retroceso no haría nada.
 */
function deBorrado(cambio: Cambio): Resultado {
  const { anterior, escrito, cursor, tipo } = cambio
  if (escrito.trim() === '') return { acepta: true, valor: '', cursor: 0 }
  if (esInternacional(escrito)) return internacional(escrito, cursor)
  // Sin el «+», vuelve el peruano con su «+51», aunque traiga más de nueve cifras: no se
  // corta nada, y al enviar se avisa.
  let cifras = cifrasDe(escrito)
  let antes = cifrasAntes(escrito, cursor)
  if (!esInternacional(anterior) && cifras === cifrasDe(anterior)) {
    if (tipo === 'deleteContentForward') {
      cifras = cifras.slice(0, antes) + cifras.slice(antes + 1)
    } else if (antes > 0) {
      cifras = cifras.slice(0, antes - 1) + cifras.slice(antes)
      antes -= 1
    }
  }
  return peruano(cifras, antes)
}

/**
 * Lo pegado, arrastrado o autocompletado, leído entero; `null` si no es un celular.
 *
 * Lee igual que la regla: los separadores no cuentan, «00» es «+», y un «51» o un
 * «+51» delante de un celular peruano se quita, porque el campo ya dibuja el «+51».
 * Lo que no encaja —letras, más de 9 cifras sin prefijo, más de 15 con él— no se
 * corta: no se lee.
 */
export function leerEntero(texto: string): string | null {
  const recortado = texto.trim()
  if (recortado === '') return ''
  if (/[^0-9+ \t \-.()]/.test(recortado)) return null
  let limpio = recortado.replace(/[ \t \-.()]/g, '')
  const conCeros = limpio.startsWith('00')
  if (conCeros) limpio = `+${limpio.slice(2)}`
  const conMas = esInternacional(limpio)
  const cifras = conMas ? limpio.slice(1) : limpio
  if (cifras.includes('+')) return null
  if (/^519\d{8}$/.test(cifras)) return agrupar(cifras.slice(2))
  if (conMas) return cifras.length > MAXIMO_INTERNACIONAL ? null : internacionalLegible(recortado, conCeros)
  return cifras.length > MAXIMO_PERUANO ? null : agrupar(cifras)
}

/**
 * «+1 (415) 555-2671» → «+1 415 555 2671»: el número de otro país con sus grupos,
 * separados por espacios, que es lo único que el campo deja poner entre cifras.
 */
function internacionalLegible(texto: string, conCeros: boolean): string {
  const grupos = texto
    .replace(/[()+]/g, ' ')
    .split(/[ \t \-.]/)
    .filter((grupo) => grupo !== '')
  // El «00» de delante ya es el «+»: se quita de los primeros grupos.
  let quedan = conCeros ? 2 : 0
  while (quedan > 0 && grupos.length > 0) {
    const primero = grupos[0] ?? ''
    const quita = Math.min(quedan, primero.length)
    quedan -= quita
    if (quita === primero.length) grupos.shift()
    else grupos[0] = primero.slice(quita)
  }
  return `+${grupos.join(' ')}`
}

function deBloque(cambio: Cambio): Resultado {
  const valor = leerEntero(cambio.escrito)
  if (valor === null) return { acepta: false, cursor: retroceso(cambio), aviso: true }
  return { acepta: true, valor, cursor: valor.length }
}

/**
 * Qué fue: una tecla, un borrado, o algo que llegó de una vez (pegar, arrastrar,
 * autocompletar). El autocompletado de algunos navegadores no dice `inputType`: se
 * deduce de cuánto cambió el campo.
 */
function queFue({ anterior, escrito, tipo }: Cambio): 'tecla' | 'borrado' | 'bloque' {
  const crece = escrito.length - anterior.length
  if (tipo?.startsWith('delete')) return 'borrado'
  if (tipo === 'insertText' || tipo === 'insertCompositionText') return crece <= 1 ? 'tecla' : 'bloque'
  if (tipo) return 'bloque'
  if (crece < 0) return 'borrado'
  return crece === 1 ? 'tecla' : 'bloque'
}

/** Lo que tiene que quedar en el campo después del cambio. */
export function enmascarar(cambio: Cambio): Resultado {
  switch (queFue(cambio)) {
    case 'tecla':
      return deTecla(cambio)
    case 'borrado':
      return deBorrado(cambio)
    default:
      return deBloque(cambio)
  }
}

/**
 * Un celular guardado antes de esta regla, que el campo enseña tal cual: en cuanto se
 * toca, se lee entero con la máscara. Vaciarlo siempre se puede.
 */
export function desdeAntiguo(cambio: Cambio): Resultado {
  if (cambio.escrito.trim() === '') return { acepta: true, valor: '', cursor: 0 }
  return deBloque(cambio)
}
