/**
 * Las fechas de la ficha del colaborador: días del calendario de Lima.
 *
 * ⚠️ **Un `Dia` (`'2026-09-29'`) nunca pasa por `new Date(dia)`.** Eso lo lee
 * como medianoche UTC, que en Lima es todavía el día anterior: la fecha de
 * ingreso saldría un día antes y un contrato «vencería» un día tarde. Aquí se
 * parte el texto y se cuenta con `Date.UTC`, que no tiene zona.
 *
 * Y «hoy» es el de Lima según la hora del servidor, no el del reloj del equipo:
 * los estados los calcula el backend con ese mismo día.
 */

import { ahora } from '@/dominio/reloj'
import type { Dia, EstadoLaboral } from '../api/tiposPersonas'

const DIA_EN_MS = 86_400_000

/** Hoy en Lima, como `'2026-09-29'`. */
export function hoyEnLima(instante: number = ahora()): Dia {
  // `en-CA` escribe las fechas como AAAA-MM-DD: justo el formato del backend.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(instante))
}

function partes(dia: Dia): [number, number, number] {
  const [a, m, d] = dia.split('-').map(Number)
  return [a ?? 0, m ?? 1, d ?? 1]
}

/** `29/09/2026`. */
export function formatearDia(dia: Dia | null | undefined): string {
  if (!dia) return '—'
  const [a, m, d] = partes(dia)
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${a}`
}

/** Cuántos días van de uno a otro. Negativo si `hasta` ya pasó. */
export function diasEntre(desde: Dia, hasta: Dia): number {
  const [a1, m1, d1] = partes(desde)
  const [a2, m2, d2] = partes(hasta)
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / DIA_EN_MS)
}

/** El día antes o después de otro. */
export function sumarDias(dia: Dia, dias: number): Dia {
  const [a, m, d] = partes(dia)
  const fecha = new Date(Date.UTC(a, m - 1, d) + dias * DIA_EN_MS)
  return fecha.toISOString().slice(0, 10)
}

export const NOMBRE_DEL_ESTADO: Record<EstadoLaboral, string> = {
  POR_INGRESAR: 'Por ingresar',
  ACTIVO: 'Activo',
  CESADO: 'Cesado',
}

export interface AvisoDelContrato {
  texto: string
  /** `vence`: faltan 30 días o menos. `vencido`: ya pasó y la persona sigue dentro. */
  tono: 'vence' | 'vencido'
  explicacion?: string
}

/**
 * La etiqueta del fin de contrato: «vence en N días» cuando faltan 30 o menos,
 * y «vencido» cuando ya pasó y la persona sigue activa.
 */
export function avisoDelContrato(
  fin: Dia | null,
  estado: EstadoLaboral,
  hoy: Dia = hoyEnLima(),
): AvisoDelContrato | null {
  if (!fin || estado === 'CESADO') return null
  const faltan = diasEntre(hoy, fin)
  if (faltan < 0) {
    return {
      texto: 'vencido',
      tono: 'vencido',
      explicacion:
        'El contrato ya venció y la persona sigue en la empresa: si sigue trabajando, su contrato pasa a ser indefinido.',
    }
  }
  if (faltan === 0) return { texto: 'vence hoy', tono: 'vence' }
  if (faltan <= 30) return { texto: faltan === 1 ? 'vence mañana' : `vence en ${faltan} días`, tono: 'vence' }
  return null
}
