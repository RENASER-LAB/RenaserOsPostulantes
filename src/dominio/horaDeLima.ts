/**
 * La fecha límite de la prueba, en hora de Lima, se lea donde se lea.
 *
 * La fecha límite es un instante (UTC en el servidor) que la empresa piensa en
 * hora de Lima: «el viernes a las 23:59». Si se convirtiera con la zona del
 * navegador, alguien que arma la prueba desde otro país la movería sin querer.
 * Lima no cambia de hora en el año (UTC−5), así que la cuenta es fija y no
 * depende de lo que traiga el navegador.
 *
 * ⚠️ Nunca `new Date('YYYY-MM-DD')`: eso es medianoche UTC, que en Lima es el día
 * anterior a las 19:00.
 */

import type { FechaIso } from '@/api/tipos'

const DESFASE_DE_LIMA_MS = 5 * 60 * 60 * 1000
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'] as const
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] as const
const CAMPO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?$/

const dos = (n: number) => String(n).padStart(2, '0')

/** El reloj de Lima de un instante, leído con los métodos UTC de un `Date` corrido. */
function enLima(instante: FechaIso): Date {
  return new Date(new Date(instante).getTime() - DESFASE_DE_LIMA_MS)
}

/**
 * Lo que se escribió en un campo `datetime-local` («2026-10-10T23:59»), leído
 * como hora de Lima → el instante que espera el servidor. Nulo si no es válido.
 */
export function deLimaAInstante(local: string): string | null {
  const m = CAMPO.exec(local.trim())
  if (!m) return null
  const [anio, mes, dia, hora, minuto] = m.slice(1).map(Number) as [number, number, number, number, number]
  const utc = Date.UTC(anio, mes - 1, dia, hora, minuto) + DESFASE_DE_LIMA_MS
  const d = new Date(utc)
  // «31/02» no existe: Date lo pasaría al 3 de marzo sin decir nada.
  if (Number.isNaN(utc) || enLima(d.toISOString()).getUTCDate() !== dia) return null
  return d.toISOString()
}

/** Un instante → lo que pinta un campo `datetime-local` en hora de Lima. */
export function deInstanteALima(instante: FechaIso): string {
  const d = enLima(instante)
  return (
    `${d.getUTCFullYear()}-${dos(d.getUTCMonth() + 1)}-${dos(d.getUTCDate())}` +
    `T${dos(d.getUTCHours())}:${dos(d.getUTCMinutes())}`
  )
}

/** «vie 10/10, 23:59»: el chip del tiempo en la cabecera del editor. */
export function fechaCortaDeLima(instante: FechaIso): string {
  const d = enLima(instante)
  return `${DIAS_CORTOS[d.getUTCDay()]} ${dos(d.getUTCDate())}/${dos(d.getUTCMonth() + 1)}, ${dos(
    d.getUTCHours(),
  )}:${dos(d.getUTCMinutes())}`
}

/** «viernes 10/10 a las 23:59»: la pantalla previa de la prueba en el portal. */
export function fechaLargaDeLima(instante: FechaIso): string {
  const d = enLima(instante)
  return `${DIAS[d.getUTCDay()]} ${dos(d.getUTCDate())}/${dos(d.getUTCMonth() + 1)} a las ${dos(
    d.getUTCHours(),
  )}:${dos(d.getUTCMinutes())}`
}
