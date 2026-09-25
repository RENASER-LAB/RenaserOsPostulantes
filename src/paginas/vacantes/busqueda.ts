/**
 * Buscar, acotar y ordenar las vacantes: la lógica sin pantalla.
 *
 * Todo pasa en el navegador sobre la lista que ya trajo el backend —hoy son nueve
 * vacantes y la pantalla tiene que sentirse instantánea con cuarenta—, y todo vive
 * aquí y no en el componente para poder probarlo sin montar nada.
 *
 * Tres reglas que no se ven en el código de un vistazo:
 *
 *   1. **La ciudad es la del catálogo, la modalidad se agrupa.** Una vacante en
 *      «Lima» y otra en «LIMA» son la misma ciudad porque las dos llevan el código
 *      `1501`; «Presencial» y «PRESENCIAL» son la misma modalidad porque aquí se
 *      agrupan sin mayúsculas ni tildes. Lo que el equipo escribió mal («test») sale
 *      tal cual: la pantalla no adivina ni oculta.
 *   2. **Un filtro solo aparece si separa algo**, y los recuentos de cada opción
 *      se calculan con la búsqueda y los DEMÁS filtros puestos: marcar Lima no deja
 *      a Arequipa en (0), porque dentro del mismo grupo las opciones suman.
 *   3. **Sin texto no hay relevancia que medir.** El orden por relevancia solo
 *      existe con algo escrito; sin nada, la lista va por fecha y punto.
 */

import type { VacantePublica } from '@/api/tipos'

// ---------- texto ----------

/** Sin mayúsculas, sin tildes, sin espacios de sobra: lo que se compara. */
export function normalizar(texto: string | null | undefined): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

/** Las palabras de lo escrito, ya normalizadas y sin vacías. */
export function palabrasDe(q: string): string[] {
  return normalizar(q).split(' ').filter(Boolean)
}

// ---------- modalidad ----------

/** Las tres del desplegable del panel, en el orden fijo del filtro. */
export const MODALIDADES = ['Presencial', 'Híbrido', 'Remoto'] as const

/**
 * Cómo se escribe una modalidad en la pantalla: «PRESENCIAL» y «Presencial» son
 * «Presencial»; «Hibrido» e «Híbrido», «Híbrido». Lo que no se parece a ninguna
 * de las tres sale tal cual, recortado. Vacío o solo espacios es `null`.
 */
export function modalidadCanonica(texto: string | null | undefined): string | null {
  const limpio = (texto ?? '').trim()
  if (limpio === '') return null
  const clave = normalizar(limpio)
  return MODALIDADES.find((m) => normalizar(m) === clave) ?? limpio
}

/** La clave con la que una modalidad viaja en la dirección: `remoto`, `test`. */
export function claveDeModalidad(canonica: string): string {
  return normalizar(canonica)
}

// ---------- lo que se puede filtrar ----------

/** El valor de «Sin indicar» dentro de un grupo, en el estado y en la dirección. */
export const SIN_INDICAR = 'sin-indicar'

export type Ventana = '24h' | '7d' | '30d'
export const VENTANAS: Ventana[] = ['24h', '7d', '30d']
export const NOMBRE_DE_VENTANA: Record<Ventana, string> = {
  '24h': 'Últimas 24 horas',
  '7d': 'Últimos 7 días',
  '30d': 'Últimos 30 días',
}

export interface Filtros {
  /** Códigos del catálogo (`1501`) o `SIN_INDICAR`. */
  ciudades: string[]
  /** Claves de modalidad (`presencial`, `test`) o `SIN_INDICAR`. */
  modalidades: string[]
  /** Nombres de empresa normalizados, o `SIN_INDICAR`. */
  empresas: string[]
  publicada: Ventana | null
}

export type Orden = 'relevantes' | 'recientes'

export interface Estado {
  q: string
  filtros: Filtros
  orden: Orden
}

export const SIN_FILTROS: Filtros = { ciudades: [], modalidades: [], empresas: [], publicada: null }

export function hayFiltros(f: Filtros): boolean {
  return (
    f.ciudades.length > 0 || f.modalidades.length > 0 || f.empresas.length > 0
    || f.publicada !== null
  )
}

// ---------- la dirección ----------

/** Un código del catálogo tiene esta forma; lo demás no es una ciudad y se ignora. */
const CODIGO_DE_CIUDAD = /^(\d{4}|EXT)$/

/**
 * Lee la búsqueda, los filtros y el orden de la dirección.
 *
 * Lo que no se entiende se ignora sin decir nada: un `ciudad=04` (un departamento,
 * no una ciudad), un `publicada=ayer`, un `orden=alfabetico`, un parámetro
 * desconocido. Lo que sí se entiende se conserva aunque hoy no tenga vacantes: la
 * etiqueta aparece igual y se puede quitar.
 *
 * `relevantes` no viaja: es lo que se muestra si no se dice nada. Y `recientes`
 * solo tiene sentido con texto; sin él la lista ya va por fecha.
 */
export function leerEstado(params: URLSearchParams): Estado {
  const q = params.get('q') ?? ''
  const unicos = (valores: string[]) => [...new Set(valores.filter(Boolean))]
  const ciudades = unicos(params.getAll('ciudad').map((c) => c.trim().toUpperCase()))
    .filter((c) => c === SIN_INDICAR.toUpperCase() || CODIGO_DE_CIUDAD.test(c))
    .map((c) => (c === SIN_INDICAR.toUpperCase() ? SIN_INDICAR : c))
  const modalidades = unicos(
    params.getAll('modalidad').map((m) => (m === SIN_INDICAR ? m : normalizar(m))),
  )
  const empresas = unicos(
    params.getAll('empresa').map((e) => (e === SIN_INDICAR ? e : normalizar(e))),
  )
  const ventana = params.get('publicada')
  const publicada = VENTANAS.find((v) => v === ventana) ?? null
  const orden: Orden = params.get('orden') === 'recientes' && q.trim() !== '' ? 'recientes' : 'relevantes'
  return { q, filtros: { ciudades, modalidades, empresas, publicada }, orden }
}

/** Lo contrario: el estado escrito en la dirección, sin lo que sea el valor por defecto. */
export function escribirEstado(estado: Estado): URLSearchParams {
  const params = new URLSearchParams()
  if (estado.q !== '') params.set('q', estado.q)
  for (const c of estado.filtros.ciudades) params.append('ciudad', c)
  for (const m of estado.filtros.modalidades) params.append('modalidad', m)
  for (const e of estado.filtros.empresas) params.append('empresa', e)
  if (estado.filtros.publicada) params.set('publicada', estado.filtros.publicada)
  if (estado.orden === 'recientes' && estado.q.trim() !== '') params.set('orden', 'recientes')
  return params
}

// ---------- cada vacante, ya masticada ----------

/** Lo que de cada vacante se compara, calculado una vez. */
export interface VacanteIndexada {
  vacante: VacantePublica
  titulo: string
  /** Empresa, modalidad, ciudad y zona normalizadas: donde se busca fuera del título. */
  resto: string[]
  ciudad: string
  ciudadNombre: string | null
  modalidad: string
  modalidadNombre: string | null
  empresa: string
  empresaNombre: string | null
  /** Milisegundos, o `null` sin fecha. */
  publicadaEn: number | null
}

export function indexar(vacantes: VacantePublica[]): VacanteIndexada[] {
  return vacantes.map((v) => {
    const modalidadNombre = modalidadCanonica(v.modalidad)
    const empresaNombre = (v.nombreEmpresa ?? '').trim() || null
    const zona = (v.ubicacion ?? '').trim()
    const fecha = v.publicadaEn ? Date.parse(v.publicadaEn) : NaN
    return {
      vacante: v,
      titulo: normalizar(v.titulo),
      resto: [empresaNombre, modalidadNombre, v.ciudad?.nombre ?? null, zona || null]
        .filter((x): x is string => x !== null)
        .map(normalizar),
      ciudad: v.ciudad?.codigo ?? SIN_INDICAR,
      ciudadNombre: v.ciudad?.nombre ?? null,
      modalidad: modalidadNombre === null ? SIN_INDICAR : claveDeModalidad(modalidadNombre),
      modalidadNombre,
      empresa: empresaNombre === null ? SIN_INDICAR : normalizar(empresaNombre),
      empresaNombre,
      publicadaEn: Number.isNaN(fecha) ? null : fecha,
    }
  })
}

// ---------- buscar ----------

/**
 * En qué grupo de relevancia cae una vacante para lo escrito, o `null` si no
 * coincide. Grupos, de mejor a peor: 0 el título empieza por lo buscado; 1 todas
 * las palabras en el título; 2 parte en el título y el resto fuera; 3 solo fuera.
 */
export function relevanciaDe(v: VacanteIndexada, palabras: string[], q: string): number | null {
  if (palabras.length === 0) return 3
  const enTitulo = palabras.map((p) => v.titulo.includes(p))
  const fuera = palabras.map((p) => v.resto.some((r) => r.includes(p)))
  if (!palabras.every((_, i) => enTitulo[i] || fuera[i])) return null
  if (enTitulo.every(Boolean)) {
    return v.titulo.startsWith(normalizar(q)) ? 0 : 1
  }
  return enTitulo.some(Boolean) ? 2 : 3
}

export function coincideConTexto(v: VacanteIndexada, q: string): boolean {
  return relevanciaDe(v, palabrasDe(q), q) !== null
}

// ---------- las ventanas de fecha ----------

const HORA = 60 * 60 * 1000
const DIA = 24 * HORA

export function dentroDeVentana(publicadaEn: number | null, ventana: Ventana | null, ahora: number): boolean {
  if (ventana === null) return true
  if (publicadaEn === null) return false
  const desde = ventana === '24h' ? ahora - 24 * HORA : ventana === '7d' ? ahora - 7 * DIA : ahora - 30 * DIA
  return publicadaEn >= desde
}

// ---------- acotar ----------

function pasaGrupo(valor: string, elegidos: string[]): boolean {
  return elegidos.length === 0 || elegidos.includes(valor)
}

/** Si la vacante pasa la búsqueda y los filtros, salvo el grupo que se excluya. */
export function pasa(
  v: VacanteIndexada,
  estado: Estado,
  ahora: number,
  sin?: keyof Filtros,
): boolean {
  const f = estado.filtros
  if (!coincideConTexto(v, estado.q)) return false
  if (sin !== 'ciudades' && !pasaGrupo(v.ciudad, f.ciudades)) return false
  if (sin !== 'modalidades' && !pasaGrupo(v.modalidad, f.modalidades)) return false
  if (sin !== 'empresas' && !pasaGrupo(v.empresa, f.empresas)) return false
  if (sin !== 'publicada' && !dentroDeVentana(v.publicadaEn, f.publicada, ahora)) return false
  return true
}

// ---------- ordenar ----------

/** De la más reciente a la más antigua; las que no tienen fecha, al final. */
export function porFecha(a: VacanteIndexada, b: VacanteIndexada): number {
  if (a.publicadaEn === null && b.publicadaEn === null) return 0
  if (a.publicadaEn === null) return 1
  if (b.publicadaEn === null) return -1
  return b.publicadaEn - a.publicadaEn
}

/** Lo que queda, en el orden pedido. */
export function resultados(indice: VacanteIndexada[], estado: Estado, ahora: number): VacanteIndexada[] {
  const palabras = palabrasDe(estado.q)
  const quedan = indice.filter((v) => pasa(v, estado, ahora))
  if (palabras.length === 0 || estado.orden === 'recientes') {
    return [...quedan].sort(porFecha)
  }
  return quedan
    .map((v) => ({ v, grupo: relevanciaDe(v, palabras, estado.q) ?? 3 }))
    .sort((a, b) => a.grupo - b.grupo || porFecha(a.v, b.v))
    .map((x) => x.v)
}

// ---------- los grupos de opciones ----------

export interface Opcion {
  valor: string
  nombre: string
  cantidad: number
}

export interface Grupo {
  clave: 'ciudades' | 'modalidades' | 'empresas'
  titulo: string
  opciones: Opcion[]
}

export interface OpcionDeFecha {
  valor: Ventana | null
  nombre: string
  cantidad: number
}

function distintos(valores: string[]): number {
  return new Set(valores.filter((v) => v !== SIN_INDICAR)).size
}

/**
 * El nombre de una ciudad para el filtro: como en el catálogo y, si dos se
 * llamaran igual, con el departamento al lado.
 */
function nombresDeCiudad(indice: VacanteIndexada[]): Map<string, string> {
  const porCodigo = new Map<string, { nombre: string; departamento: string | null }>()
  for (const v of indice) {
    const c = v.vacante.ciudad
    if (c && !porCodigo.has(c.codigo)) porCodigo.set(c.codigo, { nombre: c.nombre, departamento: c.departamento })
  }
  const repetidos = new Map<string, number>()
  for (const { nombre } of porCodigo.values()) repetidos.set(nombre, (repetidos.get(nombre) ?? 0) + 1)
  const nombres = new Map<string, string>()
  for (const [codigo, { nombre, departamento }] of porCodigo) {
    const repetido = (repetidos.get(nombre) ?? 0) > 1 && departamento
    nombres.set(codigo, repetido ? `${nombre} (${departamento})` : nombre)
  }
  return nombres
}

/**
 * Los tres grupos de casillas, con sus recuentos, y solo los que separan algo:
 * al menos dos valores distintos —sin contar «Sin indicar»— entre todas las
 * publicadas, no entre las que quedan tras buscar. Así un grupo no aparece y
 * desaparece mientras se escribe.
 *
 * Cada opción cuenta con la búsqueda y los demás grupos puestos, no con el suyo:
 * dentro de un grupo las opciones suman. Una opción que baja a (0) sigue en su
 * sitio para que el grupo no salte.
 */
export function grupos(indice: VacanteIndexada[], estado: Estado, ahora: number): Grupo[] {
  const salida: Grupo[] = []

  // Ciudad: como en el catálogo y en orden alfabético.
  if (distintos(indice.map((v) => v.ciudad)) >= 2) {
    const nombres = nombresDeCiudad(indice)
    const quedan = indice.filter((v) => pasa(v, estado, ahora, 'ciudades'))
    const opciones: Opcion[] = [...nombres.entries()]
      .map(([valor, nombre]) => ({ valor, nombre, cantidad: quedan.filter((v) => v.ciudad === valor).length }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    salida.push({ clave: 'ciudades', titulo: 'Ciudad', opciones: conSinIndicar(opciones, quedan, 'ciudad', indice) })
  }

  // Modalidad: Presencial, Híbrido, Remoto y después cualquier otra, tal cual.
  if (distintos(indice.map((v) => v.modalidad)) >= 2) {
    const quedan = indice.filter((v) => pasa(v, estado, ahora, 'modalidades'))
    const vistas = new Map<string, string>()
    for (const v of indice) if (v.modalidadNombre) vistas.set(v.modalidad, v.modalidadNombre)
    const fijas = MODALIDADES.map((m) => claveDeModalidad(m))
    const opciones: Opcion[] = [...vistas.entries()]
      .sort(([a, na], [b, nb]) => {
        const ia = fijas.indexOf(a)
        const ib = fijas.indexOf(b)
        if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
        return na.localeCompare(nb, 'es')
      })
      .map(([valor, nombre]) => ({ valor, nombre, cantidad: quedan.filter((v) => v.modalidad === valor).length }))
    salida.push({ clave: 'modalidades', titulo: 'Modalidad', opciones: conSinIndicar(opciones, quedan, 'modalidad', indice) })
  }

  // Empresa: por nombre, en orden alfabético.
  if (distintos(indice.map((v) => v.empresa)) >= 2) {
    const quedan = indice.filter((v) => pasa(v, estado, ahora, 'empresas'))
    const vistas = new Map<string, string>()
    for (const v of indice) if (v.empresaNombre) vistas.set(v.empresa, v.empresaNombre)
    const opciones: Opcion[] = [...vistas.entries()]
      .map(([valor, nombre]) => ({ valor, nombre, cantidad: quedan.filter((v) => v.empresa === valor).length }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    salida.push({ clave: 'empresas', titulo: 'Empresa', opciones: conSinIndicar(opciones, quedan, 'empresa', indice) })
  }

  return salida
}

/** «Sin indicar (n)» al final, solo si alguna publicada no lo dice. */
function conSinIndicar(
  opciones: Opcion[],
  quedan: VacanteIndexada[],
  campo: 'ciudad' | 'modalidad' | 'empresa',
  indice: VacanteIndexada[],
): Opcion[] {
  if (!indice.some((v) => v[campo] === SIN_INDICAR)) return opciones
  return [
    ...opciones,
    { valor: SIN_INDICAR, nombre: 'Sin indicar', cantidad: quedan.filter((v) => v[campo] === SIN_INDICAR).length },
  ]
}

/**
 * El filtro «Publicada», o `null` si no separa nada: aparece solo si alguna de
 * las tres ventanas deja dentro a unas y fuera a otras entre TODAS las publicadas.
 * Si todas se publicaron hace más de 30 días, o todas en las últimas 24 horas,
 * no se muestra.
 */
export function opcionesDeFecha(indice: VacanteIndexada[], estado: Estado, ahora: number): OpcionDeFecha[] | null {
  const total = indice.length
  const separa = VENTANAS.some((ventana) => {
    const dentro = indice.filter((v) => dentroDeVentana(v.publicadaEn, ventana, ahora)).length
    return dentro > 0 && dentro < total
  })
  if (!separa) return null
  const quedan = indice.filter((v) => pasa(v, estado, ahora, 'publicada'))
  return [
    { valor: null, nombre: 'Cualquier fecha', cantidad: quedan.length },
    ...VENTANAS.map((ventana) => ({
      valor: ventana,
      nombre: NOMBRE_DE_VENTANA[ventana],
      cantidad: quedan.filter((v) => dentroDeVentana(v.publicadaEn, ventana, ahora)).length,
    })),
  ]
}

// ---------- las etiquetas activas ----------

export interface Etiqueta {
  grupo: keyof Filtros
  valor: string
  nombre: string
}

/**
 * Los filtros puestos, con su nombre: «Lima», «Remoto», «Últimos 7 días». Un
 * valor que la dirección trajo y ninguna vacante tiene se nombra igual: la ciudad
 * por el catálogo si se pasa, la modalidad por su forma canónica, y si no hay
 * nada mejor, por lo que trae la dirección.
 */
export function etiquetas(
  estado: Estado,
  indice: VacanteIndexada[],
  nombresDelCatalogo: Map<string, string> = new Map(),
): Etiqueta[] {
  const salida: Etiqueta[] = []
  const ciudades = nombresDeCiudad(indice)
  for (const valor of estado.filtros.ciudades) {
    salida.push({
      grupo: 'ciudades',
      valor,
      nombre: valor === SIN_INDICAR ? 'Sin indicar' : ciudades.get(valor) ?? nombresDelCatalogo.get(valor) ?? valor,
    })
  }
  for (const valor of estado.filtros.modalidades) {
    const vista = indice.find((v) => v.modalidad === valor)?.modalidadNombre
    const fija = MODALIDADES.find((m) => claveDeModalidad(m) === valor)
    salida.push({
      grupo: 'modalidades',
      valor,
      nombre: valor === SIN_INDICAR ? 'Sin indicar' : vista ?? fija ?? valor,
    })
  }
  for (const valor of estado.filtros.empresas) {
    const vista = indice.find((v) => v.empresa === valor)?.empresaNombre
    salida.push({ grupo: 'empresas', valor, nombre: valor === SIN_INDICAR ? 'Sin indicar' : vista ?? valor })
  }
  if (estado.filtros.publicada) {
    salida.push({ grupo: 'publicada', valor: estado.filtros.publicada, nombre: NOMBRE_DE_VENTANA[estado.filtros.publicada] })
  }
  return salida
}

/** El estado sin esa etiqueta. */
export function sinEtiqueta(estado: Estado, etiqueta: Etiqueta): Estado {
  const f = { ...estado.filtros }
  if (etiqueta.grupo === 'publicada') f.publicada = null
  else f[etiqueta.grupo] = f[etiqueta.grupo].filter((v) => v !== etiqueta.valor)
  return { ...estado, filtros: f }
}

// ---------- lo que se dice ----------

export function vacantesEnPlural(n: number): string {
  return n === 1 ? '1 vacante abierta' : `${n} vacantes abiertas`
}

/** «9 vacantes abiertas», «2 de 9 vacantes», «Ninguna vacante coincide…». */
export function contador(quedan: number, total: number, estado: Estado, etiquetasActivas: Etiqueta[]): string {
  const acotando = estado.q.trim() !== '' || etiquetasActivas.length > 0
  if (!acotando) return vacantesEnPlural(total)
  if (quedan > 0) return `${quedan} de ${total} vacantes`
  const conTexto = estado.q.trim() !== '' ? ` con «${estado.q.trim()}»` : ''
  const conFiltros =
    etiquetasActivas.length === 1
      ? ` en ${etiquetasActivas[0]!.nombre}`
      : etiquetasActivas.length > 1
        ? ' con los filtros elegidos'
        : ''
  return `Ninguna vacante coincide${conTexto}${conFiltros}`
}

// ---------- «Publicada hace…» ----------

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** El día del calendario de Lima de un instante, como número de días desde la época. */
function diaEnLima(ms: number): { dia: number; d: number; m: number; a: number } {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(ms))
  const leer = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value ?? 0)
  const a = leer('year')
  const m = leer('month')
  const d = leer('day')
  return { dia: Math.floor(Date.UTC(a, m - 1, d) / DIA), d, m, a }
}

/**
 * «Publicada hoy», «ayer», «hace N días» (2 a 13), «hace N semanas» (2 a 8) y
 * después «el 12 de agosto» (con el año si no es el actual). Días del calendario
 * de Lima, no bloques de 24 horas: algo publicado anoche es de «ayer» aunque
 * hayan pasado ocho horas. Sin fecha, nada.
 */
export function publicadaHace(publicadaEn: number | null, ahora: number): string | null {
  if (publicadaEn === null) return null
  const hoy = diaEnLima(ahora)
  const entonces = diaEnLima(publicadaEn)
  const dias = hoy.dia - entonces.dia
  if (dias <= 0) return 'Publicada hoy'
  if (dias === 1) return 'Publicada ayer'
  if (dias <= 13) return `Publicada hace ${dias} días`
  const semanas = Math.floor(dias / 7)
  if (semanas <= 8) return `Publicada hace ${semanas} semanas`
  const fecha = `el ${entonces.d} de ${MESES[entonces.m - 1]}`
  return entonces.a === hoy.a ? `Publicada ${fecha}` : `Publicada ${fecha} de ${entonces.a}`
}

// ---------- la ficha ----------

/**
 * «Presencial · Arequipa · Selva Alegre · 9am-6pm», sin repetir la zona si es el
 * nombre de la ciudad (sin mirar mayúsculas ni tildes). Sin ciudad, solo la zona.
 */
export function lineaDeDonde(v: Pick<VacantePublica, 'modalidad' | 'ciudad' | 'ubicacion' | 'horario'>): string[] {
  const ciudad = v.ciudad?.nombre ?? null
  const zona = (v.ubicacion ?? '').trim() || null
  const zonaRepite = ciudad !== null && zona !== null && normalizar(zona) === normalizar(ciudad)
  return [modalidadCanonica(v.modalidad), ciudad, zonaRepite ? null : zona, (v.horario ?? '').trim() || null]
    .filter((x): x is string => x !== null && x !== '')
}

/** La primera línea de la tarjeta: modalidad · ciudad, o la zona si no hay ciudad. */
export function lineaDeLaTarjeta(v: Pick<VacantePublica, 'modalidad' | 'ciudad' | 'ubicacion'>): string {
  const donde = v.ciudad?.nombre ?? (v.ubicacion ?? '').trim() ?? ''
  return [modalidadCanonica(v.modalidad), donde || null].filter((x): x is string => x !== null).join(' · ')
}

/** Cuántas ciudades distintas del catálogo, sin «Fuera del Perú»: la cinta de la portada. */
export function ciudadesDistintas(vacantes: VacantePublica[]): number {
  return new Set(
    vacantes.map((v) => v.ciudad?.codigo ?? null).filter((c): c is string => c !== null && c !== 'EXT'),
  ).size
}
