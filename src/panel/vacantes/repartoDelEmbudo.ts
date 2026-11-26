/**
 * Cuánta gente tiene una vacante y dónde está, sacado del embudo.
 *
 * Es lo que dibuja el anillo de la lista de vacantes: un tramo por cada etapa
 * del panel y, por fuera, un arco verde con quien espera que el equipo decida.
 * Quien ya terminó (contratado, no continúa, cerrada) no cuenta en el total:
 * el anillo es de la gente que sigue en proceso.
 *
 * ⚠️ **«Por revisar» no es «nuevo».** Nadie registra qué postulaciones abrió ya
 * el equipo, así que el número es el de los estados donde la pelota está en el
 * tejado de la empresa —`porRevisar` de `ETAPAS_PANEL`, el corte «Pendiente»
 * del ranking—. Si algún día el backend cuenta las no vistas, cambia aquí.
 */

import type { ConteoEmbudo } from '../api/tipos'
import { ETAPAS_PANEL, indiceDeLaEtapaDe } from './ranking'

export interface RepartoDelEmbudo {
  /** Las postulaciones que siguen en proceso: sin las terminadas. */
  total: number
  /** Cuántas hay ahora en cada etapa, en el orden de `ETAPAS_PANEL`. */
  porEtapa: number[]
  /** Las que ya no están en ninguna etapa: contratadas, no continúan, cerradas. */
  terminadas: number
  /** Las que esperan que alguien del equipo las mire y decida. */
  porRevisar: number
}

const POR_REVISAR = new Set<string>(ETAPAS_PANEL.flatMap((e) => e.porRevisar))

export function repartoDelEmbudo(conteo: ConteoEmbudo): RepartoDelEmbudo {
  const porEtapa = ETAPAS_PANEL.map(() => 0)
  let total = 0
  let terminadas = 0
  let porRevisar = 0
  for (const [estado, crudo] of Object.entries(conteo.porEstado ?? {})) {
    const n = Number.isFinite(crudo) && crudo > 0 ? crudo : 0
    if (!n) continue
    const i = indiceDeLaEtapaDe(estado)
    if (i === null) {
      terminadas += n
      continue
    }
    total += n
    porEtapa[i]! += n
    if (POR_REVISAR.has(estado)) porRevisar += n
  }
  return { total, porEtapa, terminadas, porRevisar }
}

/** Un tramo del anillo: dónde empieza y cuánto ocupa, en centésimas de vuelta. */
export interface Tramo {
  /** Índice en `ETAPAS_PANEL`. */
  etapa: number
  n: number
  desde: number
  largo: number
}

/**
 * Los tramos del anillo, sin los vacíos.
 *
 * Entre tramo y tramo queda una rendija de `hueco` centésimas para que se lean
 * por separado; con un solo tramo no hay rendija y el anillo se cierra entero.
 */
export function tramosDelAnillo(r: RepartoDelEmbudo, hueco = 1.2): Tramo[] {
  if (!r.total) return []
  const crudos = r.porEtapa.map((n, etapa) => ({ etapa, n })).filter((t) => t.n > 0)
  const rendija = crudos.length > 1 ? hueco : 0
  let desde = 0
  return crudos.map((t) => {
    const ocupa = (t.n / r.total) * 100
    const tramo = { ...t, desde: desde + rendija / 2, largo: Math.max(0.4, ocupa - rendija) }
    desde += ocupa
    return tramo
  })
}
