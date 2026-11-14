/**
 * Las reglas de «Pruebas» sin pintar nada: lo que vive en la dirección, los
 * filtros y sus recuentos, las sugerencias de la línea de búsqueda y cómo se
 * escribe cada dato de una fila (spec pruebas-indice-de-la-empresa).
 *
 * El servidor ya corta por empresa y por alcance y entrega la pestaña entera en
 * orden; los filtros se aplican aquí, con la misma regla que el servidor
 * (`FiltrosDelIndice` en el backend), para tener los recuentos de cada casilla
 * sin otra petición: dentro de un grupo vale cualquiera de los valores y entre
 * grupos, todos. El buscador mira solo el título, sin tildes ni mayúsculas.
 */

import type { FilaDePrueba, SituacionDeLaVacante, TipoDePrueba } from '../api/pruebas'
import { NIVELES_DE_PUESTO, nombreDelNivel, tiempoDeLaPrueba } from '../vacantes/preguntas/formulario'

// ---------- La pestaña ----------

export type Pestana = 'preguntas' | 'prueba'

export const PESTANAS: { clave: Pestana; nombre: string; tipo: TipoDePrueba }[] = [
  { clave: 'preguntas', nombre: 'Preguntas del Perfil Integral', tipo: 'PERFIL_INTEGRAL' },
  { clave: 'prueba', nombre: 'Prueba del puesto', tipo: 'PRUEBA_PUESTO' },
]

export const tipoDe = (pestana: Pestana): TipoDePrueba => (pestana === 'prueba' ? 'PRUEBA_PUESTO' : 'PERFIL_INTEGRAL')

// ---------- Los filtros ----------

export type Grupo = 'nivel' | 'estado' | 'situacion'

export const GRUPOS: Grupo[] = ['nivel', 'estado', 'situacion']

/** El nombre corto (etiqueta y sugerencia) y el largo (título del grupo). */
export const NOMBRE_DEL_GRUPO: Record<Grupo, { corto: string; largo: string }> = {
  nivel: { corto: 'Nivel', largo: 'Nivel' },
  estado: { corto: 'Estado', largo: 'Estado de la prueba' },
  situacion: { corto: 'Situación', largo: 'Situación de la vacante' },
}

export interface Opcion {
  valor: string
  nombre: string
}

const ESTADOS: Opcion[] = [
  { valor: 'BORRADOR', nombre: 'Borrador' },
  { valor: 'PUBLICADA', nombre: 'Publicada' },
  { valor: 'EN_USO', nombre: 'La rinde alguien' },
]

const SITUACIONES: { valor: SituacionDeLaVacante; nombre: string }[] = [
  { valor: 'SIN_PUBLICAR', nombre: 'Sin publicar' },
  { valor: 'PUBLICADA', nombre: 'Publicada' },
  { valor: 'CERRADA', nombre: 'Cerrada' },
  { valor: 'ARCHIVADA', nombre: 'Archivada' },
]

export const nombreDeLaSituacion = (s: SituacionDeLaVacante): string =>
  SITUACIONES.find((o) => o.valor === s)?.nombre ?? s

/** El nivel para leer, o «—» sin puesto o sin nivel. */
export const nivelParaLeer = (nivel: string | null): string => (nivel ? nombreDelNivel(nivel) : '—')

/**
 * Las opciones de cada grupo. Los niveles son los del catálogo y, por si una
 * vacante trae uno que el catálogo no conoce, también ese.
 */
export function opcionesDe(grupo: Grupo, filas: readonly FilaDePrueba[] = []): Opcion[] {
  if (grupo === 'estado') return ESTADOS
  if (grupo === 'situacion') return SITUACIONES
  const conocidos = NIVELES_DE_PUESTO.map((n) => ({ valor: n.valor, nombre: n.nombre }))
  const otros = [...new Set(filas.map((f) => f.nivel?.toUpperCase()).filter((n): n is string => !!n))]
    .filter((n) => !conocidos.some((c) => c.valor === n))
    .map((n) => ({ valor: n, nombre: nombreDelNivel(n) }))
  return [...conocidos, ...otros]
}

export const nombreDeLaOpcion = (grupo: Grupo, valor: string): string =>
  grupo === 'nivel' ? nombreDelNivel(valor) : opcionesDe(grupo).find((o) => o.valor === valor)?.nombre ?? valor

export type Filtros = Record<Grupo, string[]>

export const SIN_FILTROS: Filtros = { nivel: [], estado: [], situacion: [] }

export const cuantosFiltros = (f: Filtros): number => f.nivel.length + f.estado.length + f.situacion.length

/** Si la fila cumple un valor de un grupo. */
export function cumple(fila: FilaDePrueba, grupo: Grupo, valor: string): boolean {
  if (grupo === 'nivel') return !!fila.nivel && fila.nivel.toUpperCase() === valor
  if (grupo === 'situacion') return fila.situacion === valor
  if (valor === 'EN_USO') return fila.laRindeAlguien
  return fila.estado === valor
}

/** Sin tildes, en minúsculas y sin espacios en los bordes. */
export const sinTildes = (texto: string): string =>
  texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

/** «nivel:», «estado: publi»…: lo que se escribe para elegir un filtro, no para buscar un título. */
const PREFIJO = /^(nivel|estado|situacion|vacante)\s*:\s*(.*)$/

/** El texto que se busca en los títulos: nada mientras se escribe un filtro. */
export const textoDelTitulo = (buscar: string): string => (PREFIJO.test(sinTildes(buscar)) ? '' : buscar)

export function admite(fila: FilaDePrueba, filtros: Filtros, buscar: string): boolean {
  const buscado = sinTildes(textoDelTitulo(buscar))
  if (buscado && !sinTildes(fila.titulo).includes(buscado)) return false
  return GRUPOS.every((g) => filtros[g].length === 0 || filtros[g].some((v) => cumple(fila, g, v)))
}

/** Cuántas filas de la pestaña cumplen ese valor, sin mirar los demás filtros. */
export const cuantasCumplen = (filas: readonly FilaDePrueba[], grupo: Grupo, valor: string): number =>
  filas.filter((f) => cumple(f, grupo, valor)).length

/** Las de arriba de la tabla y las de abajo: las que se publicaron y las que no. */
export function agrupar(filas: readonly FilaDePrueba[]): { publicadas: FilaDePrueba[]; borradores: FilaDePrueba[] } {
  return {
    publicadas: filas.filter((f) => f.estado === 'PUBLICADA'),
    borradores: filas.filter((f) => f.estado !== 'PUBLICADA'),
  }
}

// ---------- Las sugerencias de la línea ----------

export interface Sugerencia {
  grupo: Grupo
  valor: string
}

/**
 * Lo que se ofrece convertir en filtro mientras se escribe: «tác» ofrece el
 * nivel, «publi» el estado y la situación, «nivel:» todos los niveles. Desde
 * dos letras, sin repetir lo que ya está puesto, y cinco como mucho.
 */
export function sugerencias(buscar: string, filtros: Filtros, filas: readonly FilaDePrueba[] = []): Sugerencia[] {
  let q = sinTildes(buscar)
  if (q.length < 2) return []
  let solo: Grupo | null = null
  const prefijo = q.match(PREFIJO)
  if (prefijo) {
    solo = prefijo[1] === 'vacante' ? 'situacion' : (prefijo[1] as Grupo)
    q = prefijo[2] ?? ''
  }
  const salida: Sugerencia[] = []
  for (const grupo of GRUPOS) {
    if (solo && grupo !== solo) continue
    for (const o of opcionesDe(grupo, filas)) {
      if (filtros[grupo].includes(o.valor)) continue
      const nombre = sinTildes(o.nombre)
      const conGrupo = sinTildes(`${NOMBRE_DEL_GRUPO[grupo].corto} ${o.nombre}`)
      const casa = solo
        ? q === '' || nombre.includes(q)
        : nombre.startsWith(q) || nombre.split(' ').some((p) => p.startsWith(q)) || conGrupo.startsWith(q)
      if (casa) salida.push({ grupo, valor: o.valor })
    }
  }
  return salida.slice(0, 5)
}

/**
 * Las etiquetas de la línea: una por filtro y, si pasan de cinco, una por grupo
 * con sus valores juntos, para que la línea no se coma la pantalla.
 */
export function etiquetas(filtros: Filtros): { grupo: Grupo; valores: string[] }[] {
  const sueltas = GRUPOS.flatMap((g) => filtros[g].map((v) => ({ grupo: g, valores: [v] })))
  if (sueltas.length < 6) return sueltas
  return GRUPOS.filter((g) => filtros[g].length > 0).map((g) => ({ grupo: g, valores: [...filtros[g]] }))
}

// ---------- La dirección ----------

export interface EstadoDeLaPantalla {
  pestana: Pestana
  buscar: string
  filtros: Filtros
  /** La fila abierta en la vista previa, o nula. */
  vacante: number | null
}

const VALIDOS: Record<Exclude<Grupo, 'nivel'>, string[]> = {
  estado: ESTADOS.map((o) => o.valor),
  situacion: SITUACIONES.map((o) => o.valor),
}

/** `?tipo=prueba&buscar=caj&nivel=EJECUCION&estado=PUBLICADA,EN_USO&situacion=CERRADA&vacante=12`. */
export function leerEstado(q: URLSearchParams): EstadoDeLaPantalla {
  const lista = (clave: Grupo) => {
    const valores = (q.get(clave) ?? '')
      .split(',')
      .map((v) => v.trim().toUpperCase())
      .filter((v) => v !== '')
    const unicos = [...new Set(valores)]
    return clave === 'nivel' ? unicos : unicos.filter((v) => VALIDOS[clave].includes(v))
  }
  const vacante = Number(q.get('vacante'))
  return {
    pestana: q.get('tipo') === 'prueba' ? 'prueba' : 'preguntas',
    buscar: q.get('buscar') ?? '',
    filtros: { nivel: lista('nivel'), estado: lista('estado'), situacion: lista('situacion') },
    vacante: Number.isInteger(vacante) && vacante > 0 ? vacante : null,
  }
}

export function escribirEstado(e: EstadoDeLaPantalla): URLSearchParams {
  const q = new URLSearchParams()
  q.set('tipo', e.pestana)
  if (e.buscar) q.set('buscar', e.buscar)
  for (const g of GRUPOS) if (e.filtros[g].length > 0) q.set(g, e.filtros[g].join(','))
  if (e.vacante !== null) q.set('vacante', String(e.vacante))
  return q
}

// ---------- Cómo se escribe una fila ----------

const plural = (n: number, una: string, varias: string) => `${n} ${n === 1 ? una : varias}`

/**
 * «N criterios · N preguntas» y, en la prueba, «· N entregables · tiempo». Sin la
 * fecha límite: es de cada vacante, no se copia y en las cerradas ya pasó.
 */
export function partesDelResumen(fila: FilaDePrueba, pestana: Pestana): string[] {
  const partes = [plural(fila.criterios, 'criterio', 'criterios'), plural(fila.preguntas, 'pregunta', 'preguntas')]
  if (pestana === 'prueba') {
    partes.push(plural(fila.entregables ?? 0, 'entregable', 'entregables'))
    partes.push(tiempoDeLaPrueba(fila.modalidad, fila.minutos, fila.dias))
  }
  return partes
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/**
 * «18 sep 2026», en hora de Lima. La fecha llega con su hora (un instante), así
 * que no cae el día anterior como un `new Date('YYYY-MM-DD')`.
 */
export function fechaCorta(iso: string): string {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Lima',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).formatToParts(new Date(iso))
  const de = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value)
  return `${de('day')} ${MESES[de('month') - 1]} ${de('year')}`
}

/** «Versión del 18 sep 2026» o «Sin publicar». */
export const textoDeLaVersion = (fila: FilaDePrueba): string =>
  fila.publicadaEn ? `Versión del ${fechaCorta(fila.publicadaEn)}` : 'Sin publicar'

/** El título con su sede, para el nombre accesible de los botones de la fila. */
export const tituloConSede = (f: { titulo: string; sede: string | null }): string =>
  f.sede ? `${f.titulo} · ${f.sede}` : f.titulo
