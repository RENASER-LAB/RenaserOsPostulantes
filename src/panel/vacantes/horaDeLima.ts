/**
 * Las fechas de la prueba del puesto dichas en hora de Lima (V89): «18 nov», «18 nov, 16:40»,
 * «vie 20 nov, 18:00», y el campo «Hasta» de «Darle más tiempo», que se escribe en hora de Lima
 * aunque quien lo use esté en otra zona.
 *
 * ⚠️ **Nunca `new Date('AAAA-MM-DD')`**: eso lo lee como medianoche UTC, que en Lima es el día
 * anterior. Aquí todo llega como instante (con su hora) o como texto del campo, que se completa
 * con la zona de Lima antes de leerlo.
 *
 * ⚠️ **Lima no cambia de hora** (UTC−5 todo el año desde 1994), así que el campo se completa con
 * `-05:00` fijo; para escribir, en cambio, se pregunta a `Intl` con la zona de Lima, que es lo
 * que no depende del reloj del equipo.
 */

import { ahora as ahoraDelServidor } from '@/dominio/reloj'

const ZONA = 'America/Lima'
const DESFASE_DE_LIMA = '-05:00'
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DIAS: Record<string, string> = {
  Mon: 'lun',
  Tue: 'mar',
  Wed: 'mié',
  Thu: 'jue',
  Fri: 'vie',
  Sat: 'sáb',
  Sun: 'dom',
}

interface Partes {
  anio: number
  mes: number
  dia: number
  hora: string
  minuto: string
  diaDeLaSemana: string
}

/*
  `en-US` y no `es-PE` a propósito: las piezas salen en números y el día de la semana en una
  abreviatura estable; los nombres en español van escritos a mano para que no cambien entre
  navegadores («sep» o «sept.»).
*/
function partesEnLima(iso: string): Partes | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const piezas = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  }).formatToParts(d)
  const de = (tipo: string) => piezas.find((p) => p.type === tipo)?.value ?? ''
  return {
    anio: Number(de('year')),
    mes: Number(de('month')),
    dia: Number(de('day')),
    hora: de('hour').padStart(2, '0'),
    minuto: de('minute').padStart(2, '0'),
    diaDeLaSemana: DIAS[de('weekday')] ?? '',
  }
}

/** «18 nov», con el año solo si no es el de `ahora`. */
export function diaCortoEnLima(iso: string, ahora: number = ahoraDelServidor()): string {
  const p = partesEnLima(iso)
  if (!p) return ''
  const esteAnio = partesEnLima(new Date(ahora).toISOString())?.anio
  return `${p.dia} ${MESES[p.mes - 1]}${p.anio === esteAnio ? '' : ` ${p.anio}`}`
}

/** «18 nov, 16:40». */
export function diaYHoraEnLima(iso: string, ahora: number = ahoraDelServidor()): string {
  const p = partesEnLima(iso)
  if (!p) return ''
  return `${diaCortoEnLima(iso, ahora)}, ${p.hora}:${p.minuto}`
}

/** «vie 20 nov, 18:00»: como lo dicen los avisos que recibe el candidato. */
export function conDiaDeLaSemanaEnLima(iso: string, ahora: number = ahoraDelServidor()): string {
  const p = partesEnLima(iso)
  if (!p) return ''
  return `${p.diaDeLaSemana} ${diaYHoraEnLima(iso, ahora)}`
}

/** El texto de un `datetime-local` («2026-11-20T18:00») si es una fecha y hora válidas. */
export const CAMPO_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

/**
 * Lo escrito en el campo «Hasta», leído como hora de Lima → el instante UTC que espera el
 * backend. `null` si el texto no es una fecha y hora válidas.
 */
export function deCampoDeLima(valor: string): string | null {
  if (!CAMPO_LOCAL.test(valor)) return null
  const d = new Date(`${valor}:00${DESFASE_DE_LIMA}`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
