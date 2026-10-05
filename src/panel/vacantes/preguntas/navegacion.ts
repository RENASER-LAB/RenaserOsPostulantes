/**
 * Adónde lleva cada falta y qué criterios salen desplegados (V68).
 *
 * Los dos editores —la prueba técnica y las preguntas propias— pintan sus
 * avisos como botones que llevan a donde se arreglan. **Los avisos los escribe
 * el servidor** y aquí solo se leen: «Los puntos suman…» lleva a los criterios,
 * «El criterio «X»…» a ese criterio abierto, «La pregunta 3…» a su criterio y a
 * esa pregunta, un entregable a su pregunta o a los generales, y el tiempo y la
 * fecha a la configuración con el cursor en el campo. Lo que no se reconoce
 * lleva a los criterios: nunca a ninguna parte.
 *
 * La numeración de «La pregunta 3» es la del servidor: los criterios en su
 * orden, cada uno con sus preguntas, y al final las que no tienen criterio.
 */

import { useState } from 'react'
import type { EntregableDeLaVersion, PreguntaDeLaVersion, VersionDePreguntas } from '../../api/preguntasPropias'

export type CampoDeLaConfiguracion = 'tiempo' | 'fecha'

export type Destino =
  | { tipo: 'CRITERIOS' }
  | { tipo: 'CRITERIO'; criterioId: number }
  | { tipo: 'PREGUNTA'; preguntaId: number; criterioId: number | null }
  | { tipo: 'ENTREGABLE'; entregableId: number }
  | { tipo: 'CONFIGURACION'; campo: CampoDeLaConfiguracion }

/** Las preguntas en el orden en que las numera el servidor. */
export function preguntasEnOrden(v: Pick<VersionDePreguntas, 'criterios' | 'sinCriterio'>): PreguntaDeLaVersion[] {
  return [...v.criterios.flatMap((c) => c.preguntas), ...v.sinCriterio]
}

/** El número de cada pregunta en la prueba: «Pregunta 4». */
export function numerosDePreguntas(v: Pick<VersionDePreguntas, 'criterios' | 'sinCriterio'>): Map<number, number> {
  return new Map(preguntasEnOrden(v).map((p, i) => [p.id, i + 1]))
}

const LA_PREGUNTA = /^La pregunta (\d+)\b/
const EL_CRITERIO = /^El criterio «(.+?)»/
const UN_ENTREGABLE = /^«(.+?)»/

/** Adónde lleva un aviso del servidor. */
export function destinoDelAviso(aviso: string, v: VersionDePreguntas): Destino {
  if (/^(Falta la fecha límite|La fecha límite)/.test(aviso)) return { tipo: 'CONFIGURACION', campo: 'fecha' }
  if (/^(Falta el tiempo|Faltan los minutos)/.test(aviso)) return { tipo: 'CONFIGURACION', campo: 'tiempo' }
  const pregunta = LA_PREGUNTA.exec(aviso)
  if (pregunta) {
    const encontrada = preguntasEnOrden(v)[Number(pregunta[1]) - 1]
    if (encontrada) return { tipo: 'PREGUNTA', preguntaId: encontrada.id, criterioId: encontrada.criterioId }
  }
  const criterio = EL_CRITERIO.exec(aviso)
  if (criterio) {
    const encontrado = v.criterios.find((c) => c.nombre === criterio[1])
    if (encontrado) return { tipo: 'CRITERIO', criterioId: encontrado.id }
  }
  const entregable = UN_ENTREGABLE.exec(aviso)
  if (entregable) {
    const encontrado = (v.prueba?.entregables ?? []).find((e) => e.nombre === entregable[1])
    if (encontrado) return destinoDelEntregable(encontrado, v)
  }
  return { tipo: 'CRITERIOS' }
}

function destinoDelEntregable(e: EntregableDeLaVersion, v: VersionDePreguntas): Destino {
  if (e.alcance === 'PREGUNTA' && e.preguntaId != null) {
    const suya = preguntasEnOrden(v).find((p) => p.id === e.preguntaId)
    return { tipo: 'PREGUNTA', preguntaId: e.preguntaId, criterioId: suya?.criterioId ?? null }
  }
  return { tipo: 'ENTREGABLE', entregableId: e.id }
}

/** El criterio al que pertenece una falta, si es de uno: para el punto ámbar de su línea. */
export function criterioDeLaFalta(d: Destino): number | null {
  if (d.tipo === 'CRITERIO') return d.criterioId
  if (d.tipo === 'PREGUNTA') return d.criterioId
  return null
}

/** Las faltas de cada criterio, en el orden en que llegan. */
export function faltasPorCriterio(v: VersionDePreguntas | null): Map<number, string[]> {
  const salida = new Map<number, string[]>()
  for (const aviso of v?.avisos ?? []) {
    const id = criterioDeLaFalta(destinoDelAviso(aviso, v!))
    if (id !== null) salida.set(id, [...(salida.get(id) ?? []), aviso])
  }
  return salida
}

/** El id del elemento al que se baja para cada destino. */
export function idDelDestino(d: Destino): string {
  switch (d.tipo) {
    case 'CRITERIO':
      return `criterio-${d.criterioId}`
    case 'PREGUNTA':
      return `pregunta-${d.preguntaId}`
    case 'ENTREGABLE':
      return `entregable-${d.entregableId}`
    default:
      return 'criterios-y-preguntas'
  }
}

/**
 * Baja hasta el destino y le pone el foco, cuando ya está pintado. Dos
 * `requestAnimationFrame`: el primero deja que React despliegue el criterio, el
 * segundo que el navegador lo coloque.
 */
export function bajarHasta(d: Destino): void {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const destino = document.getElementById(idDelDestino(d))
      if (!destino) return
      destino.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
      destino.focus({ preventScroll: true })
    }),
  )
}

/**
 * Qué criterios están desplegados.
 *
 * Al entrar, todos plegados salvo los que tienen una falta. Un criterio que
 * aparece después —el recién creado, uno que trae la IA— sale desplegado. Si la
 * versión cambia entera (se copió otra encima, se abrió un borrador desde la
 * publicada) es como volver a entrar.
 */
export function useCriteriosAbiertos(version: VersionDePreguntas | null) {
  const ids = (version?.criterios ?? []).map((c) => c.id)
  const versionId = version?.id ?? null
  const [estado, setEstado] = useState(() => ({
    versionId,
    conocidos: ids,
    abiertos: new Set<number>(faltasPorCriterio(version).keys()),
  }))

  if (estado.versionId !== versionId) {
    // De nada a algo: lo que acaba de crearse sale desplegado.
    const abiertos = estado.versionId === null ? ids : [...faltasPorCriterio(version).keys()]
    setEstado({ versionId, conocidos: ids, abiertos: new Set(abiertos) })
  } else if (ids.some((id) => !estado.conocidos.includes(id))) {
    const nuevos = ids.filter((id) => !estado.conocidos.includes(id))
    setEstado({ versionId, conocidos: ids, abiertos: new Set([...estado.abiertos, ...nuevos]) })
  }

  const cambiar = (abiertos: Set<number>) => setEstado((e) => ({ ...e, abiertos }))
  return {
    abierto: (id: number) => estado.abiertos.has(id),
    alternar: (id: number) => {
      const abiertos = new Set(estado.abiertos)
      if (abiertos.has(id)) abiertos.delete(id)
      else abiertos.add(id)
      cambiar(abiertos)
    },
    abrir: (id: number) => {
      if (!estado.abiertos.has(id)) cambiar(new Set([...estado.abiertos, id]))
    },
    desplegarTodo: () => cambiar(new Set(ids)),
    plegarTodo: () => cambiar(new Set()),
  }
}

/**
 * Ir a donde se arregla una falta: despliega su criterio y baja hasta él; el tiempo y
 * la fecha abren la configuración (solo la prueba la tiene).
 */
export function irAlDestino(
  d: Destino,
  plegado: { abrir: (criterioId: number) => void },
  alConfigurar?: (campo: CampoDeLaConfiguracion) => void,
): void {
  if (d.tipo === 'CONFIGURACION') {
    alConfigurar?.(d.campo)
    return
  }
  if (d.tipo === 'CRITERIO') plegado.abrir(d.criterioId)
  if (d.tipo === 'PREGUNTA' && d.criterioId !== null) plegado.abrir(d.criterioId)
  bajarHasta(d)
}
