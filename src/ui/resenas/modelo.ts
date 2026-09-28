/**
 * Las reseñas de empresas (V63), sin pantalla: cómo se cuentan, se filtran, se
 * ordenan y se dicen.
 *
 * Lo comparten el perfil del portal y la ficha del panel, y por eso vive aquí y
 * no en ninguno de los dos: «4,7 · 3 reseñas» y «Peor calificadas» tienen que
 * significar lo mismo en las dos caras, o la persona y la empresa verían
 * números distintos de la misma reseña.
 *
 * ⚠️ **Las reseñas no puntúan.** Nada de aquí entra en una nota ni en el orden
 * por defecto de ninguna tabla.
 */

/** Lo mínimo de una reseña para pintarla. Portal y panel traen más, y encajan. */
export interface ResenaParaPintar {
  id: number
  estrellas: number
  empresa: string
  puesto: string | null
  texto: string
  publicadaEn: string
  editada: boolean
}

export interface ResumenParaPintar {
  promedio: number | null
  cantidad: number
  reparto: { estrellas: number; cantidad: number }[]
}

/** El rótulo de cada estrella, al escribir y al leer. */
export const ROTULOS_DE_ESTRELLAS: Record<number, string> = {
  1: 'Muy mala',
  2: 'Mala',
  3: 'Aceptable',
  4: 'Buena',
  5: 'Excelente',
}

// ---------- Cómo se dice ----------

/**
 * El promedio con un decimal y coma: «4,7», «5,0». Con un decimal SIEMPRE,
 * también cuando es redondo, para que dos filas de la tabla se comparen de un
 * vistazo.
 */
export const promedioEscrito = (promedio: number): string =>
  promedio.toFixed(1).replace('.', ',')

export const cuantasResenas = (n: number): string => (n === 1 ? '1 reseña' : `${n} reseñas`)

/** Lo que oye un lector de pantalla en lugar de las estrellas dibujadas. */
export const estrellasDichas = (valor: number): string =>
  `${Number.isInteger(valor) ? valor : promedioEscrito(valor)} de 5 estrellas`

/**
 * Las cinco estrellas de un valor, con medias: se redondea a la media estrella
 * más cercana, así que 4,7 son cuatro y media y 4,8 son cinco.
 */
export function estrellasPartidas(valor: number): ('llena' | 'media' | 'vacia')[] {
  const redondeado = Math.round(valor * 2) / 2
  return [1, 2, 3, 4, 5].map((i) =>
    redondeado >= i ? 'llena' : redondeado >= i - 0.5 ? 'media' : 'vacia',
  )
}

/**
 * Cuántos caracteres cuenta el servidor: sin los espacios de los extremos, y un
 * emoji como uno. Con `.length` un emoji gastaría dos y la pantalla diría
 * «501» donde el servidor cuenta 500.
 */
export const caracteresDe = (texto: string): number => Array.from(texto.trim()).length

/**
 * Qué le falta a un texto obligatorio, dicho junto al campo; o `null` si vale.
 * Son las mismas reglas del backend: vacío, menos del mínimo, más del máximo.
 */
export function faltaEnElTexto(
  texto: string,
  minimo: number,
  maximo: number,
  que: string,
): string | null {
  const largo = caracteresDe(texto)
  if (largo === 0) return `${que} es obligatoria.`
  if (largo < minimo) return `${que} necesita al menos ${minimo} caracteres; lleva ${largo}.`
  if (largo > maximo) return `${que} admite hasta ${maximo} caracteres; lleva ${largo}.`
  return null
}

// ---------- Los filtros de «Ver todas» ----------

export type OrdenDeResenas = 'recientes' | 'antiguas' | 'mejores' | 'peores'

export const ORDENES: { codigo: OrdenDeResenas; nombre: string }[] = [
  { codigo: 'recientes', nombre: 'Más recientes' },
  { codigo: 'antiguas', nombre: 'Más antiguas' },
  { codigo: 'mejores', nombre: 'Mejor calificadas' },
  { codigo: 'peores', nombre: 'Peor calificadas' },
]

export interface FiltrosDeResenas {
  /** Vacío es «Todas». Se pueden marcar varias. */
  estrellas: ReadonlySet<number>
  /** `null` es «Todas». */
  empresa: string | null
  orden: OrdenDeResenas
}

export const SIN_FILTROS: FiltrosDeResenas = {
  estrellas: new Set(),
  empresa: null,
  orden: 'recientes',
}

/** El orden no es un filtro: no quita ninguna reseña, así que no pide «Quitar filtros». */
export const hayFiltros = (f: FiltrosDeResenas): boolean =>
  f.estrellas.size > 0 || f.empresa !== null

/** Cuántas hay de cada estrella, para los chips: «5★ (2)». */
export function contarPorEstrellas(resenas: ResenaParaPintar[]): Record<number, number> {
  const cuenta: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const r of resenas) cuenta[r.estrellas] = (cuenta[r.estrellas] ?? 0) + 1
  return cuenta
}

/**
 * Las empresas autoras, sin repetir y en orden alfabético. El filtro «Empresa»
 * solo sale con dos o más: con una, filtrar no cambia nada.
 */
export const empresasDe = (resenas: ResenaParaPintar[]): string[] =>
  [...new Set(resenas.map((r) => r.empresa))].sort((a, b) =>
    a.localeCompare(b, 'es', { sensitivity: 'base' }),
  )

const masReciente = (a: ResenaParaPintar, b: ResenaParaPintar): number =>
  b.publicadaEn.localeCompare(a.publicadaEn) || b.id - a.id

/**
 * Las reseñas que dejan pasar los filtros, en el orden pedido.
 *
 * Por estrellas, a igualdad manda la más reciente: dos reseñas de 2★ se leen de
 * la última a la primera, que es lo que se espera de una lista de opiniones.
 *
 * ⚠️ **Copia antes de ordenar**: lo que llega es el array de la caché de
 * react-query, y un `.sort()` encima lo reordenaría para todo el que lo lea.
 */
export function filtrarYOrdenar<T extends ResenaParaPintar>(
  resenas: T[],
  filtros: FiltrosDeResenas,
): T[] {
  const quedan = resenas.filter(
    (r) =>
      (filtros.estrellas.size === 0 || filtros.estrellas.has(r.estrellas)) &&
      (filtros.empresa === null || r.empresa === filtros.empresa),
  )
  const comparar: Record<OrdenDeResenas, (a: T, b: T) => number> = {
    recientes: masReciente,
    antiguas: (a, b) => -masReciente(a, b),
    mejores: (a, b) => b.estrellas - a.estrellas || masReciente(a, b),
    peores: (a, b) => a.estrellas - b.estrellas || masReciente(a, b),
  }
  return [...quedan].sort(comparar[filtros.orden])
}

// ---------- Reportar ----------

export type MotivoDeReporte = 'OFENSIVA' | 'DATOS_PERSONALES' | 'DISCRIMINATORIA' | 'FALSA' | 'OTRO'

/**
 * Los motivos, con las palabras de quien reporta. Solo cambia «Es falsa»: la
 * persona puede decir que no trabajó ahí; la empresa autora, que la respuesta
 * cuenta hechos que no pasaron.
 */
export function motivosDelReporte(
  quien: 'persona' | 'empresa',
): { codigo: MotivoDeReporte; nombre: string }[] {
  return [
    { codigo: 'OFENSIVA', nombre: 'Tiene insultos o lenguaje ofensivo' },
    { codigo: 'DATOS_PERSONALES', nombre: 'Revela datos personales o de salud' },
    { codigo: 'DISCRIMINATORIA', nombre: 'Es discriminatoria' },
    {
      codigo: 'FALSA',
      nombre:
        quien === 'persona'
          ? 'Es falsa: no trabajé ahí, o cuenta hechos que no pasaron'
          : 'Es falsa: cuenta hechos que no pasaron',
    },
    { codigo: 'OTRO', nombre: 'Otro motivo' },
  ]
}

export const MAX_COMENTARIO = 500

/** Lo que le falta a un reporte, o `null`. «Otro motivo» exige contarlo. */
export function faltaEnElReporte(motivo: MotivoDeReporte | null, comentario: string): string | null {
  if (motivo === null) return 'Elige qué problema tiene.'
  if (motivo === 'OTRO' && caracteresDe(comentario) === 0) {
    return 'Con «Otro motivo», cuéntanos qué problema tiene.'
  }
  if (caracteresDe(comentario) > MAX_COMENTARIO) {
    return `El comentario admite hasta ${MAX_COMENTARIO} caracteres.`
  }
  return null
}
