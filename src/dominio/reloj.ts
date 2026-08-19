/**
 * La hora la manda el servidor, no el navegador.
 *
 * El mockup calculaba el tiempo restante restando la hora local a la hora
 * guardada. Eso se falsea cambiando la hora del equipo, y ademas el backend
 * dice que el cronometro lo controla el servidor.
 *
 * Aqui se guarda el desfase entre los dos relojes —lo dice la cabecera `Date`
 * de cualquier respuesta— y todo lo que mida tiempo lo descuenta.
 */

import type { FechaIso } from '@/api/tipos'

/** Milisegundos que el servidor va por delante del navegador. */
let desfase = 0

/**
 * Se llama con la cabecera `Date` de cada respuesta. Es una cabecera segura
 * para CORS, asi que llega aunque el portal y el backend esten en dominios
 * distintos.
 */
export function anotarHoraDelServidor(cabecera: string | null): void {
  if (!cabecera) return
  const servidor = Date.parse(cabecera)
  if (Number.isNaN(servidor)) return
  desfase = servidor - Date.now()
}

/** La hora del servidor, en milisegundos. */
export function ahora(): number {
  return Date.now() + desfase
}

/**
 * Segundos que faltan hasta una fecha. Nunca baja de cero: cuando se agota,
 * el servidor entrega solo lo que haya.
 */
export function segundosHasta(fecha: FechaIso | null | undefined): number | null {
  if (!fecha) return null
  const fin = Date.parse(fecha)
  if (Number.isNaN(fin)) return null
  return Math.max(0, Math.floor((fin - ahora()) / 1000))
}

/** `01:59:03`. Con dos puntos y siempre dos digitos, para que no baile. */
export function formatearTiempo(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos))
  const horas = Math.floor(s / 3600)
  const minutos = Math.floor((s % 3600) / 60)
  const resto = s % 60
  return [horas, minutos, resto].map((n) => String(n).padStart(2, '0')).join(':')
}

/** `viernes, 22 de agosto · 09:00` */
export function formatearFechaLarga(fecha: FechaIso): string {
  const d = new Date(fecha)
  const dia = d.toLocaleDateString('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const hora = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
  return `${dia} · ${hora}`
}

/** `19 de agosto de 2026` */
export function formatearFechaCorta(fecha: FechaIso): string {
  return new Date(fecha).toLocaleDateString('es-PE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** `actualizado hoy`, `3 días sin cambios` */
export function describirAntiguedad(dias: number): string {
  if (dias <= 0) return 'actualizado hoy'
  if (dias === 1) return '1 día sin cambios'
  return `${dias} días sin cambios`
}
