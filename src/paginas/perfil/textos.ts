/** Lo que comparten la cabecera de identidad y las secciones del perfil. */

/** 96 meses son ocho años, y así es como lo dice una persona. */
export function aniosYMeses(meses: number): string {
  const anios = Math.floor(meses / 12)
  const resto = meses % 12
  if (anios === 0) return resto === 1 ? '1 mes de experiencia' : `${resto} meses de experiencia`
  const parteAnios = anios === 1 ? '1 año' : `${anios} años`
  if (resto === 0) return `${parteAnios} de experiencia`
  return `${parteAnios} y ${resto === 1 ? '1 mes' : `${resto} meses`} de experiencia`
}

/**
 * Cuántos meses duró un tramo. `hasta: null` es «sigo aquí», así que cuenta hasta hoy.
 *
 * Devuelve `null` cuando no se puede saber —sin fecha de inicio, o con un fin
 * anterior al principio—, y quien lo llama tiene que pintar la fila sin
 * duración en vez de inventarse una: un dato leído de un currículum puede traer
 * cualquier cosa.
 */
export function mesesDelTramo(desde: string | null, hasta: string | null): number | null {
  if (!desde) return null
  const inicio = mesContado(desde)
  const fin = hasta ? mesContado(hasta) : mesDeHoy()
  if (inicio === null || fin === null) return null
  const meses = fin - inicio
  return meses < 0 ? null : meses + 1
}

/**
 * El mes de una fecha como un número que se puede restar (`año * 12 + mes`), o
 * `null` si no es una fecha.
 *
 * ⚠️ **Una fecha `YYYY-MM-DD` se lee de la propia cadena.** `new Date('2024-10-01')`
 * es la medianoche UTC, que en Lima (UTC-5) todavía es el 30 de septiembre:
 * `getMonth()` daba un mes menos que el que pinta `mesYAno`, y un tramo abierto
 * contaba uno de más.
 */
function mesContado(fecha: string): number | null {
  const instante = new Date(fecha)
  if (Number.isNaN(instante.getTime())) return null
  const iso = /^(\d{4})-(\d{2})/.exec(fecha)
  if (iso) return Number(iso[1]) * 12 + Number(iso[2]) - 1
  return instante.getFullYear() * 12 + instante.getMonth()
}

/** El «hoy» de un tramo abierto es el de quien mira la pantalla: hora local. */
function mesDeHoy(): number {
  const hoy = new Date()
  return hoy.getFullYear() * 12 + hoy.getMonth()
}

/**
 * El hueco entre dos tramos consecutivos, en meses, o `null` si no lo hay.
 *
 * ⚠️ **Solo cuando el par está en orden.** Las filas se pueden reordenar a mano,
 * así que dos que no van seguidas en el tiempo darían un «hueco» inventado. Si
 * las fechas no encajan —o falta alguna— no se dibuja nada, que es la respuesta
 * honesta.
 *
 * `anterior` es la fila de ABAJO (más antigua) y `siguiente` la de arriba: la
 * lista va de lo más reciente a lo más viejo.
 */
export function huecoEntre(
  masAntiguoHasta: string | null,
  masRecienteDesde: string | null,
): number | null {
  if (!masAntiguoHasta || !masRecienteDesde) return null
  const fin = mesContado(masAntiguoHasta)
  const inicio = mesContado(masRecienteDesde)
  if (fin === null || inicio === null) return null
  const meses = inicio - fin
  // Menos de tres meses no es un hueco: es cambiar de trabajo.
  return meses >= 3 ? meses : null
}

/** «3 años y 2 meses», o `null` si las fechas no dan para decirlo. */
export function duracion(desde: string | null, hasta: string | null): string | null {
  const meses = mesesDelTramo(desde, hasta)
  if (meses === null) return null
  const anios = Math.floor(meses / 12)
  const resto = meses % 12
  const enAnios = anios === 1 ? '1 año' : `${anios} años`
  const enMeses = resto === 1 ? '1 mes' : `${resto} meses`
  if (anios === 0) return enMeses
  if (resto === 0) return enAnios
  return `${enAnios} y ${enMeses}`
}
