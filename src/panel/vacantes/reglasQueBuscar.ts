/**
 * «Qué buscar en el CV» (V80): las reglas de la casilla y las cuentas del ranking.
 *
 * ⚠️ **La lista de lo que no se puede buscar vive aquí y en el backend**
 * (`ReglasQueBuscarEnElCv`), con las mismas palabras y las mismas pruebas de qué
 * pasa y qué no. El formulario la dice mientras se escribe; el servidor la vuelve
 * a aplicar porque la API se puede llamar sin el formulario. Si una cambia,
 * cambian las dos. La lista es cerrada: cubre las formas que se acordaron, no
 * todas las que existen.
 */

import type { BusquedaEnElCv, FilaRanking } from '../api/tipos'

/** Cuántas líneas se buscan como mucho. */
export const MAXIMO_LINEAS = 6

/** Cuántos caracteres admite una línea. */
export const MAXIMO_CARACTERES = 200

/** Lo que se dice de una línea que pide algo que no sirve para elegir a nadie. */
export const MOTIVO_PROHIBIDA =
  'No se puede buscar: la edad, el sexo, el estado civil, los hijos, la salud, la religión o el origen no sirven para elegir a nadie.'

/** Lo que se dice de una línea que pasa de seis. */
export const MOTIVO_SOBRA = 'No se buscará: el máximo es 6.'

/** Lo que se dice de una línea demasiado larga. */
export const MOTIVO_LARGA = `Cada línea admite hasta ${MAXIMO_CARACTERES} caracteres.`

const PALABRAS_PROHIBIDAS = new Set([
  // edad
  'edad', 'joven', 'jovenes', 'juvenil', 'anciano', 'anciana', 'ancianos', 'ancianas', 'nacido',
  'nacida', 'nacimiento', 'jovencito', 'jovencita', 'jovencitos', 'jovencitas', 'adolescente',
  'adolescentes',
  // sexo o género («chica» y «chico» van aparte)
  'sexo', 'genero', 'hombre', 'hombres', 'mujer', 'mujeres', 'varon', 'varones', 'masculino',
  'masculina', 'masculinos', 'masculinas', 'femenino', 'femenina', 'femeninos', 'femeninas',
  'femina', 'feminas', 'dama', 'damas', 'caballero', 'caballeros', 'senorita', 'senoritas', 'srta',
  'senora', 'senoras', 'sra', 'senor', 'senores', 'muchacho', 'muchacha', 'muchachos', 'muchachas',
  // estado civil
  'casado', 'casada', 'casados', 'casadas', 'soltero', 'soltera', 'solteros', 'solteras',
  'divorciado', 'divorciada', 'viudo', 'viuda', 'conviviente',
  // hijos o embarazo
  'hijo', 'hijos', 'hija', 'hijas', 'embarazo', 'embarazada', 'embarazadas', 'gestante',
  'gestantes', 'gestando', 'maternidad', 'paternidad',
  // salud o discapacidad («salud» va aparte)
  'discapacidad', 'discapacitado', 'discapacitada', 'discapacitados', 'discapacitadas',
  'minusvalido', 'minusvalida', 'minusvalidos', 'minusvalidas', 'enfermedad', 'enfermedades',
  'enfermo', 'enferma', 'sano', 'sana', 'sanos', 'sanas',
  // religión
  'religion', 'religiosa', 'religioso', 'catolico', 'catolica', 'cristiano', 'cristiana',
  'evangelico', 'evangelica', 'creyente', 'ateo', 'atea', 'adventista', 'adventistas',
  // raza o etnia
  'raza', 'racial', 'etnia', 'etnico', 'etnica', 'tez', 'mestizo', 'mestiza', 'indigena',
  'afroperuano', 'afroperuana', 'afrodescendiente', 'afrodescendientes',
  // nacionalidad u origen («origen» va aparte)
  'nacionalidad', 'peruano', 'peruana', 'peruanos', 'peruanas', 'extranjero', 'extranjera',
  'extranjeros', 'extranjeras', 'venezolano', 'venezolana', 'venezolanos', 'venezolanas',
  'colombiano', 'colombiana', 'colombianos', 'colombianas', 'boliviano', 'boliviana', 'bolivianos',
  'bolivianas', 'ecuatoriano', 'ecuatoriana', 'ecuatorianos', 'ecuatorianas', 'procedencia',
  'provinciano', 'provinciana', 'oriundo', 'oriunda', 'oriundos', 'oriundas',
])

const FRASES_PROHIBIDAS = [
  'estado civil', 'carga familiar', 'cargas familiares', 'madre de familia', 'padre de familia',
  'color de piel', 'piel blanca', 'piel clara', 'piel morena', 'piel oscura', 'piel negra',
  'piel triguena', 'natural de',
]

/** Con alguna de estas al lado, «salud» es un documento que pide la ley o un campo de trabajo. */
const SALUD_PERMITIDA_CON = new Set([
  'carne', 'carnet', 'certificado', 'certificacion', 'constancia', 'libreta', 'tarjeta',
  'experiencia', 'sector', 'ocupacional', 'seguridad', 'publica', 'conocimiento',
  'conocimientos', 'curso', 'cursos', 'gestion', 'programa', 'programas', 'area',
  'establecimiento', 'establecimientos',
])

/** Con alguna de estas al lado, «origen» habla de lo que se maneja, no de la persona. */
const ORIGEN_PERMITIDO_CON = new Set([
  'animal', 'vegetal', 'producto', 'productos', 'alimento', 'alimentos', 'insumo', 'insumos',
  'materia', 'materias', 'datos', 'fuente', 'fuentes',
])

/** Con alguna de estas al lado, el VIH es de quienes se atiende: «pacientes con VIH». */
const VIH_PERMITIDO_CON = new Set(['paciente', 'pacientes', 'prevencion', 'consejeria'])

/** Palabras prohibidas salvo que alguna de su lista diga que no hablan de la persona. */
const PROHIBIDAS_SALVO_CON = new Map([
  ['salud', SALUD_PERMITIDA_CON],
  ['origen', ORIGEN_PERMITIDO_CON],
  ['vih', VIH_PERMITIDO_CON],
  ['sida', VIH_PERMITIDO_CON],
])

/** Nombrar a la persona así es pedir su sexo: «Chica para atención al cliente». */
const CHICO_O_CHICA = new Set(['chico', 'chica', 'chicos', 'chicas'])

/** Detrás de estas, «chica» o «chico» es un tamaño: «Manejo de caja chica». */
const CHICO_COMO_TAMANO_TRAS = new Set([
  'caja', 'cajas', 'talla', 'tallas', 'tamano', 'formato', 'letra', 'porcion', 'porciones',
])

/** La palabra que convierte un número en tiempo. */
const ANOS = new Set(['anos', 'ano'])

/** Ninguna edad para trabajar baja de 14 («2 años» es un tiempo), ni pasa de 99. */
const EDAD_MINIMA_POSIBLE = 14
const EDAD_MAXIMA_POSIBLE = 99

/** Los números con letras que pueden ser una edad; «dieci…» y «veinti…» aparte. */
const EDADES_EN_LETRAS = new Set([
  'catorce', 'quince', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta',
  'ochenta', 'noventa',
])

/** Los que no llegan a una edad, para leer «treinta y cinco» entero. */
const NUMEROS_PEQUENOS_EN_LETRAS = new Set([
  'un', 'uno', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez',
  'once', 'doce', 'trece',
])

/** Lo que va entre los números de un rango y «años»: «25 a 35 años», «18 o más años». */
const DENTRO_DEL_RANGO = new Set(['a', 'y', 'e', 'o', 'al', 'mas', 'menos', 'hasta'])

/** «15 años de experiencia», «3 años de estudios»: detrás de «años de», los años son de algo. */
const ANOS_DE = new Set([
  'experiencia', 'trayectoria', 'antiguedad', 'servicio', 'servicios', 'trabajo', 'labor',
  'labores', 'estudio', 'estudios', 'carrera', 'ejercicio', 'practica', 'practicas', 'oficio',
  'permanencia', 'formacion',
])

/**
 * «Experiencia general no menor de 15 años», «haber trabajado 15 años», «durante 15 años»: antes
 * del número, en la misma parte, dicen que los años son de algo.
 */
const TIEMPO_ANTES = new Set([
  'experiencia', 'trayectoria', 'antiguedad', 'permanencia', 'trabajado', 'laborado', 'ejercido',
  'desempenado', 'dedicado', 'dedicada', 'hace', 'durante',
])

/** «Experiencia en cocina, al menos 15 años»: tras hablar de experiencia, un mínimo es un tiempo. */
const MINIMOS = [' al menos', ' lo menos', ' no menor de', ' no menos de']

/** «35 años como máximo» es un tope de edad; «2 años como cajero», un tiempo en algo. */
const TOPES = new Set(['maximo', 'minimo', 'tope', 'limite'])

/** Acaban en «-ando» o «-iendo» y no dicen en qué se pasaron los años. */
const NO_SON_GERUNDIO = new Set(['cuando', 'siendo', 'teniendo'])

/** «menor de 35», «mayor a 40»: la edad con un número, aunque falte «años». */
const COMPARAN_EDAD = new Set(['menor', 'menores', 'mayor', 'mayores'])
const ANTES_DEL_NUMERO = new Set(['de', 'a', 'al'])

/** Lo que puede seguir a una edad sin «años»; otra palabra dice qué se cuenta: «50 soles». */
const SIGUEN_A_UNA_EDAD = new Set([
  'y', 'e', 'o', 'u', 'a', 'con', 'sin', 'que', 'para', 'de', 'preferentemente', 'preferible',
  'cumplidos', 'inclusive',
])

/** Separan una parte de la línea de otra: «Experiencia en caja, menor de 35 años». */
const SEPARAN_PARTES = /[,;:.()[\]{}!?¿¡|·]/u

/** También separan partes, salvo entre dos números: «Experiencia y menor de 35 años». */
const Y = new Set(['y', 'e'])

function sinTildesNiMayusculas(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

function palabrasDe(normal: string): string[] {
  return normal.split(/[^\p{L}\p{N}]/u).filter((p) => p !== '')
}

const esNumero = (palabra: string) => /^\d+$/.test(palabra)

function puedeSerUnaEdad(palabra: string): boolean {
  if (esNumero(palabra)) {
    if (palabra.length > 3) return false
    const valor = Number(palabra)
    return valor >= EDAD_MINIMA_POSIBLE && valor <= EDAD_MAXIMA_POSIBLE
  }
  return (
    EDADES_EN_LETRAS.has(palabra) ||
    (palabra.length > 5 && (palabra.startsWith('dieci') || palabra.startsWith('veinti')))
  )
}

const esCantidad = (palabra: string) =>
  esNumero(palabra) || NUMEROS_PEQUENOS_EN_LETRAS.has(palabra) || puedeSerUnaEdad(palabra)

const esGerundio = (palabra: string) =>
  palabra.length >= 6 &&
  (palabra.endsWith('ando') || palabra.endsWith('iendo')) &&
  !NO_SON_GERUNDIO.has(palabra)

/**
 * «Experiencia general no menor de 15 años» sí; «Experiencia de 2 años, máximo 35 años», no: si
 * antes ya se dijeron unos años, esos eran el tiempo de la experiencia.
 */
function hayTiempoAntes(palabras: string[], numero: number): boolean {
  for (let j = numero - 1; j >= 0; j--) {
    if (ANOS.has(palabras[j]!)) return false
    if (TIEMPO_ANTES.has(palabras[j]!)) return true
  }
  return false
}

const vaTrasUnMinimo = (palabras: string[], numero: number) => {
  const antes = ` ${palabras.slice(Math.max(0, numero - 3), numero).join(' ')}`
  return MINIMOS.some((minimo) => antes.endsWith(minimo))
}

/**
 * Si el número que empieza en `numero` es un tiempo y no una edad: antes, en la misma parte, se
 * habló de experiencia —«Experiencia mayor a 15 años»— o, ya dicho en otra parte, va tras un
 * mínimo: «Experiencia en cocina, al menos 15 años».
 */
const esUnTiempo = (palabras: string[], numero: number, yaHabloDeTiempo: boolean) =>
  hayTiempoAntes(palabras, numero) || (yaHabloDeTiempo && vaTrasUnMinimo(palabras, numero))

/** Si lo que va detrás de «años» dice de qué son: «de experiencia», «en cocina», «como cajero»… */
function sonAnosDeAlgo(palabras: string[], anos: number): boolean {
  const detras = palabras[anos + 1]
  if (detras === undefined) return false
  const luego = palabras[anos + 2] ?? ''
  return (
    (detras === 'de' && ANOS_DE.has(luego)) ||
    (detras === 'en' && luego !== 'adelante') ||
    (detras === 'como' && !TOPES.has(luego)) ||
    esGerundio(detras)
  )
}

/** Dónde empieza la cantidad antes de «años» —«25 a 35», «treinta y cinco»— si puede ser una edad, o -1. */
function dondeEmpiezaLaEdad(palabras: string[], anos: number): number {
  let inicio = -1
  let puedeSerEdad = false
  for (let j = anos - 1; j >= 0 && j >= anos - 3; j--) {
    const palabra = palabras[j]!
    if (esCantidad(palabra)) {
      inicio = j
      puedeSerEdad = puedeSerEdad || puedeSerUnaEdad(palabra)
    } else if (!DENTRO_DEL_RANGO.has(palabra)) {
      break
    }
  }
  return puedeSerEdad ? inicio : -1
}

/** «Personas de 25 a 35 años», «Máximo 30 años», «18 años a más», «treinta y cinco años». */
function pideUnaEdadConAnos(palabras: string[], yaHabloDeTiempo: boolean): boolean {
  return palabras.some((palabra, k) => {
    const inicio = ANOS.has(palabra) ? dondeEmpiezaLaEdad(palabras, k) : -1
    return inicio >= 0 && !sonAnosDeAlgo(palabras, k) && !esUnTiempo(palabras, inicio, yaHabloDeTiempo)
  })
}

/** «Menor de 35», «Mayor a 40», «Hasta los 35»: la edad sin decir «años». */
function pideUnaEdadSinAnos(palabras: string[], yaHabloDeTiempo: boolean): boolean {
  for (let i = 0; i + 1 < palabras.length; i++) {
    let numero: number
    if (COMPARAN_EDAD.has(palabras[i]!) && i + 2 < palabras.length && ANTES_DEL_NUMERO.has(palabras[i + 1]!)) {
      numero = i + 2
    } else if (palabras[i] === 'los') {
      numero = i + 1
    } else {
      continue
    }
    if (!puedeSerUnaEdad(palabras[numero]!)) continue
    const detras = palabras[numero + 1]
    if ((detras === undefined || SIGUEN_A_UNA_EDAD.has(detras)) && !esUnTiempo(palabras, numero, yaHabloDeTiempo)) {
      return true
    }
  }
  return false
}

const uneDosNumeros = (palabras: string[], y: number) => {
  const siguiente = palabras[y + 1]
  return (
    y > 0 && siguiente !== undefined && esCantidad(palabras[y - 1]!) &&
    (esCantidad(siguiente) || siguiente === 'mas')
  )
}

/**
 * Las palabras de cada parte de la línea, separadas por comas, puntos, paréntesis… y por «y» o
 * «e» salvo entre dos números: «entre 25 y 35», «treinta y cinco», «18 y más».
 */
function partesDe(normal: string): string[][] {
  const partes: string[][] = []
  for (const trozo of normal.split(SEPARAN_PARTES)) {
    const palabras = palabrasDe(trozo)
    let desde = 0
    palabras.forEach((palabra, i) => {
      if (Y.has(palabra) && !uneDosNumeros(palabras, i)) {
        partes.push(palabras.slice(desde, i))
        desde = i + 1
      }
    })
    partes.push(palabras.slice(desde))
  }
  return partes
}

/**
 * La edad con números, parte por parte: «Experiencia en caja, menor de 35 años», «Experiencia y
 * menor de 35 años». Se recuerda si una parte anterior habló de experiencia.
 */
function pideUnaEdad(normal: string): boolean {
  let yaHabloDeTiempo = false
  for (const parte of partesDe(normal)) {
    if (pideUnaEdadConAnos(parte, yaHabloDeTiempo) || pideUnaEdadSinAnos(parte, yaHabloDeTiempo)) return true
    yaHabloDeTiempo = yaHabloDeTiempo || parte.some((p) => TIEMPO_ANTES.has(p))
  }
  return false
}

/** «Chica para atención al cliente» sí; «Manejo de caja chica», no. */
const nombraChicoOChica = (palabras: string[]) =>
  palabras.some((p, i) => CHICO_O_CHICA.has(p) && (i === 0 || !CHICO_COMO_TAMANO_TRAS.has(palabras[i - 1]!)))

/** Si la línea pide algo que no sirve para elegir a nadie. */
export function esProhibida(linea: string): boolean {
  const normal = sinTildesNiMayusculas(linea)
  const palabras = palabrasDe(normal)
  if (palabras.some((p) => PALABRAS_PROHIBIDAS.has(p))) return true
  const conEspacios = ` ${palabras.join(' ')} `
  if (FRASES_PROHIBIDAS.some((f) => conEspacios.includes(` ${f} `))) return true
  for (const [palabra, salvo] of PROHIBIDAS_SALVO_CON) {
    if (palabras.includes(palabra) && !palabras.some((p) => salvo.has(p))) return true
  }
  return nombraChicoOChica(palabras) || pideUnaEdad(normal)
}

/** La forma con que se comparan dos líneas: sin mayúsculas ni espacios de más. */
export const claveDeRepeticion = (linea: string) => linea.toLowerCase().trim().split(/\s+/).join(' ')

/**
 * Cómo queda cada línea escrita: `BUSCA` (se guardará), `SOBRA` (pasa de seis),
 * `PROHIBIDA` o `LARGA` (apagan el botón de guardar). Las vacías y las repetidas
 * no salen: no cuentan.
 */
export type ComoQuedaLaLinea = 'BUSCA' | 'SOBRA' | 'PROHIBIDA' | 'LARGA'

export interface LineaRevisada {
  texto: string
  como: ComoQuedaLaLinea
}

export interface Revision {
  lineas: LineaRevisada[]
  /** Las que se guardan, en su orden: como mucho seis. */
  seGuardan: string[]
  /** Si hay alguna prohibida o demasiado larga: entonces no se puede guardar. */
  hayErrores: boolean
}

/** Las líneas tal como las escribió quien crea la vacante, revisadas. */
export function revisarLineas(texto: string): Revision {
  const lineas: LineaRevisada[] = []
  const vistas = new Set<string>()
  let buenas = 0
  for (const cruda of texto.split(/\r?\n/)) {
    const linea = cruda.trim()
    if (linea === '') continue
    const clave = claveDeRepeticion(linea)
    if (vistas.has(clave)) continue
    vistas.add(clave)
    if (linea.length > MAXIMO_CARACTERES) {
      lineas.push({ texto: linea, como: 'LARGA' })
    } else if (esProhibida(linea)) {
      lineas.push({ texto: linea, como: 'PROHIBIDA' })
    } else if (buenas >= MAXIMO_LINEAS) {
      lineas.push({ texto: linea, como: 'SOBRA' })
    } else {
      buenas++
      lineas.push({ texto: linea, como: 'BUSCA' })
    }
  }
  return {
    lineas,
    seGuardan: lineas.filter((l) => l.como === 'BUSCA').map((l) => l.texto),
    hayErrores: lineas.some((l) => l.como === 'PROHIBIDA' || l.como === 'LARGA'),
  }
}

/** Si dos listas de líneas son las mismas, en el mismo orden. */
export const mismasLineas = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((linea, i) => linea === b[i])

// ---------- El ranking ----------

/** Si esta persona ya tiene resultado: solo la búsqueda terminada lo tiene. */
const conResultado = (busqueda: BusquedaEnElCv | null | undefined) =>
  busqueda?.estado === 'TERMINADA'

/**
 * «Por lo buscado»: más «Lo tiene» primero; si empatan, más «Lo menciona»; si
 * siguen empatados, el orden de siempre. Quien no tiene resultado —pendiente, sin
 * texto o fallida— va al final, en el orden de siempre. Se aplica sobre lo que ya
 * filtraron los filtros: el orden de entrada ES el de siempre.
 */
export function ordenarPorLoBuscado<T extends Pick<FilaRanking, 'busqueda'>>(filas: T[]): T[] {
  return filas
    .map((fila, indice) => ({ fila, indice }))
    .sort((a, b) => {
      const ra = conResultado(a.fila.busqueda)
      const rb = conResultado(b.fila.busqueda)
      if (ra !== rb) return ra ? -1 : 1
      if (ra && rb) {
        const tiene = (b.fila.busqueda!.tiene ?? 0) - (a.fila.busqueda!.tiene ?? 0)
        if (tiene !== 0) return tiene
        const menciona = (b.fila.busqueda!.menciona ?? 0) - (a.fila.busqueda!.menciona ?? 0)
        if (menciona !== 0) return menciona
      }
      return a.indice - b.indice
    })
    .map(({ fila }) => fila)
}

export interface RecuentosDeLaBusqueda {
  total: number
  listos: number
  buscando: number
  pendientes: number
  sinTexto: number
  fallidas: number
}

/** Los recuentos de la línea de estado, de la tanda entera. */
export function recuentosDeLaBusqueda(filas: Pick<FilaRanking, 'busqueda'>[]): RecuentosDeLaBusqueda {
  const cuenta: RecuentosDeLaBusqueda = {
    total: filas.length, listos: 0, buscando: 0, pendientes: 0, sinTexto: 0, fallidas: 0,
  }
  for (const { busqueda } of filas) {
    switch (busqueda?.estado) {
      case 'TERMINADA': cuenta.listos++; break
      case 'BUSCANDO': cuenta.buscando++; break
      case 'SIN_TEXTO': cuenta.sinTexto++; break
      case 'FALLIDA': cuenta.fallidas++; break
      default: cuenta.pendientes++
    }
  }
  return cuenta
}

/** «5 de 7 listos · 1 buscando · 1 CV sin texto»: solo los recuentos que hay. */
export function lineaDeEstado(c: RecuentosDeLaBusqueda): string {
  return [
    `${c.listos} de ${c.total} ${c.listos === 1 ? 'listo' : 'listos'}`,
    c.buscando > 0 ? `${c.buscando} buscando` : null,
    c.pendientes > 0 ? `${c.pendientes} ${c.pendientes === 1 ? 'pendiente' : 'pendientes'}` : null,
    c.sinTexto > 0 ? `${c.sinTexto} CV sin texto` : null,
    c.fallidas > 0 ? `${c.fallidas} no se pudo buscar` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Lo que oye un lector de pantalla en lugar de los puntos. */
export function puntosDichos(busqueda: BusquedaEnElCv): string {
  switch (busqueda.estado) {
    case 'TERMINADA':
      return `${busqueda.tiene} de ${busqueda.total} requisitos`
    case 'BUSCANDO':
      return 'Buscando requisitos'
    case 'SIN_TEXTO':
      return 'CV sin texto'
    case 'FALLIDA':
      return 'No se pudo buscar'
    default:
      return 'Requisitos pendientes'
  }
}
