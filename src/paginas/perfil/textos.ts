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
  const inicio = new Date(desde)
  const fin = hasta ? new Date(hasta) : new Date()
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return null
  const meses =
    (fin.getFullYear() - inicio.getFullYear()) * 12 + (fin.getMonth() - inicio.getMonth())
  return meses < 0 ? null : meses + 1
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
  const fin = new Date(masAntiguoHasta)
  const inicio = new Date(masRecienteDesde)
  if (Number.isNaN(fin.getTime()) || Number.isNaN(inicio.getTime())) return null
  const meses = (inicio.getFullYear() - fin.getFullYear()) * 12 + (inicio.getMonth() - fin.getMonth())
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
