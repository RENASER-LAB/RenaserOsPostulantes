/**
 * Adónde lleva cada falta y qué criterios salen desplegados (V68).
 *
 * Los dos editores —la prueba técnica y las preguntas propias— llevan desde
 * cada falta a donde se arregla. **Los avisos los escribe el servidor** y aquí
 * solo se leen: «Los puntos suman…» lleva a los criterios,
 * «El criterio «X»…» y «Las cerradas de «X»…» a ese criterio abierto (si falta
 * quién califica, a su lápiz con el cursor en «Quién califica»), «La pregunta 3…» a su criterio y a
 * esa pregunta, un entregable a su pregunta o a los generales, y el tiempo y la
 * fecha a la configuración con el cursor en el campo. Lo que no se reconoce
 * lleva a los criterios: nunca a ninguna parte.
 *
 * La numeración de «La pregunta 3» es la del servidor: los criterios en su
 * orden, cada uno con sus preguntas, y al final las que no tienen criterio.
 *
 * La cabecera no enseña la lista: cada falta se escribe en su sitio (la
 * tarjeta, la línea del criterio, el entregable, la configuración o el total) y
 * la pastilla «⚠ N por arreglar →» lleva de una en una, en el orden de la
 * página (`useIrALasFaltas`). «Publicar» con faltas lleva a la primera.
 */

import { useState } from 'react'
import type { EntregableDeLaVersion, PreguntaDeLaVersion, VersionDePreguntas } from '../../api/preguntasPropias'

export type CampoDeLaConfiguracion = 'tiempo' | 'fecha'

export type Destino =
  | { tipo: 'CRITERIOS' }
  /** Con `campo`, abre su lápiz con el cursor en «Quién califica» (QA-10). */
  | { tipo: 'CRITERIO'; criterioId: number; campo?: 'calificador' }
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
// «Las cerradas de «X» suman 40 y el criterio vale 30» (V69) también es de un criterio, y
// «El criterio «X» vale 20 y sus cerradas suman 5: nadie puede calificar…» lleva a ese
// criterio: empieza por «El criterio», así que nunca se toma por un entregable «X».
const EL_CRITERIO = /^(?:El criterio|Las cerradas de) «(.+?)»/
const UN_ENTREGABLE = /^«(.+?)»/
// «El criterio «X»: falta decir quién califica su parte calificada…» se arregla en su lápiz.
const SIN_CALIFICADOR = /^El criterio «.+?»: falta decir quién califica/
// «Los puntos suman 85 de 100: faltan 15.»: la del total, que se dice con el balance.
const LOS_PUNTOS = /^Los puntos suman /

/** El campo de la configuración que arregla una falta: el tiempo, la fecha o ninguno. */
export function campoDeLaFalta(aviso: string): CampoDeLaConfiguracion | null {
  if (/^(Falta la fecha límite|La fecha límite)/.test(aviso)) return 'fecha'
  if (/^(Falta el tiempo|Faltan los minutos)/.test(aviso)) return 'tiempo'
  return null
}

/** El entregable que nombra una falta que empieza por «Su nombre». */
function entregableDelAviso(aviso: string, v: VersionDePreguntas): EntregableDeLaVersion | null {
  const nombre = UN_ENTREGABLE.exec(aviso)?.[1]
  if (nombre === undefined) return null
  return (v.prueba?.entregables ?? []).find((e) => e.nombre === nombre) ?? null
}

/** Adónde lleva un aviso del servidor. */
export function destinoDelAviso(aviso: string, v: VersionDePreguntas): Destino {
  const campo = campoDeLaFalta(aviso)
  if (campo) return { tipo: 'CONFIGURACION', campo }
  const pregunta = LA_PREGUNTA.exec(aviso)
  if (pregunta) {
    const encontrada = preguntasEnOrden(v)[Number(pregunta[1]) - 1]
    if (encontrada) return { tipo: 'PREGUNTA', preguntaId: encontrada.id, criterioId: encontrada.criterioId }
  }
  const criterio = EL_CRITERIO.exec(aviso)
  if (criterio) {
    const encontrado = v.criterios.find((c) => c.nombre === criterio[1])
    if (encontrado) {
      return SIN_CALIFICADOR.test(aviso)
        ? { tipo: 'CRITERIO', criterioId: encontrado.id, campo: 'calificador' }
        : { tipo: 'CRITERIO', criterioId: encontrado.id }
    }
  }
  const entregable = entregableDelAviso(aviso, v)
  if (entregable) return destinoDelEntregable(entregable, v)
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

/** Los avisos de la versión agrupados por el id que diga `clave`, en el orden en que llegan. */
function agrupar(v: VersionDePreguntas | null, clave: (aviso: string, v: VersionDePreguntas) => number | null) {
  const salida = new Map<number, string[]>()
  for (const aviso of v?.avisos ?? []) {
    const id = clave(aviso, v!)
    if (id !== null) salida.set(id, [...(salida.get(id) ?? []), aviso])
  }
  return salida
}

/** Las faltas de cada criterio, también las de sus preguntas: para su punto ámbar y su línea plegada. */
export function faltasPorCriterio(v: VersionDePreguntas | null): Map<number, string[]> {
  return agrupar(v, (aviso, version) => criterioDeLaFalta(destinoDelAviso(aviso, version)))
}

/**
 * Las faltas del propio criterio —sus puntos, quién califica, que tenga algo que
 * calificar—, sin las de sus preguntas: se escriben bajo su línea desplegada.
 */
export function faltasPropiasPorCriterio(v: VersionDePreguntas | null): Map<number, string[]> {
  return agrupar(v, (aviso, version) => {
    const d = destinoDelAviso(aviso, version)
    return d.tipo === 'CRITERIO' ? d.criterioId : null
  })
}

/** Las faltas de cada entregable, por su id: «Informe final» no cubre…, «Flujo.xlsx»: nadie lo califica… */
export function faltasPorEntregable(v: VersionDePreguntas | null): Map<number, string[]> {
  return agrupar(v, (aviso, version) => entregableDelAviso(aviso, version)?.id ?? null)
}

/**
 * Las faltas sin un sitio propio —ni criterio, ni pregunta, ni archivo, ni
 * configuración—: «Todavía no hay ningún criterio…». Se escriben arriba de
 * «Criterios y preguntas», adonde llevan. La del total no: va con el balance.
 */
export function faltasSinSitio(avisos: string[], v: VersionDePreguntas): string[] {
  return avisos.filter((a) => !LOS_PUNTOS.test(a) && destinoDelAviso(a, v).tipo === 'CRITERIOS')
}

/**
 * La falta del total, para decirla con el balance en ámbar: la del servidor o,
 * si no la da (nada escrito todavía), la misma cuenta. Sin faltas, o en 100, ninguna.
 */
export function faltaDelTotal(avisos: string[], total: number): string | null {
  if (avisos.length === 0 || total === 100) return null
  const delServidor = avisos.find((a) => LOS_PUNTOS.test(a))
  if (delServidor) return delServidor
  return total < 100
    ? `Los puntos suman ${total} de 100: faltan ${100 - total}.`
    : `Los puntos suman ${total} de 100: sobran ${total - 100}.`
}

/**
 * Cómo nombra el servidor a una pregunta en sus faltas (`ReglasDePuntos.nombreDe`):
 * «La pregunta 3», o con el principio del enunciado, «La pregunta 3 («¿Qué libro…»)».
 */
function nombreDeLaPregunta(numero: number, enunciado: string): string {
  const texto = enunciado.trim()
  if (texto === '') return `La pregunta ${numero}`
  const corto = texto.length <= 40 ? texto : `${texto.slice(0, 39)}…`
  return `La pregunta ${numero} («${corto}»)`
}

// Por si el enunciado cambió desde que el servidor escribió la falta.
const NOMBRE_DE_LA_PREGUNTA = /^La pregunta \d+(?: \(«[^»]*»\))?: /

/**
 * Una falta del servidor sin «La pregunta N («…»): » y con mayúscula, como se
 * escribe bajo la tarjeta de su pregunta: «Ninguna opción puede pasar de los 5
 * puntos de la pregunta.».
 */
export function sinElNombreDeLaPregunta(falta: string, numero: number, enunciado: string): string {
  const nombre = `${nombreDeLaPregunta(numero, enunciado)}: `
  const resto = falta.startsWith(nombre) ? falta.slice(nombre.length) : falta.replace(NOMBRE_DE_LA_PREGUNTA, '')
  return resto.charAt(0).toUpperCase() + resto.slice(1)
}

/**
 * Las faltas de cada pregunta, por su id y en el orden del servidor: las que
 * empiezan por «La pregunta N» (sus puntos, su forma, «no está en ningún
 * criterio»), sin ese nombre. Las de un entregable no: van en el entregable.
 */
export function faltasPorPregunta(v: VersionDePreguntas | null): Map<number, string[]> {
  const salida = new Map<number, string[]>()
  if (!v) return salida
  const enOrden = preguntasEnOrden(v)
  for (const aviso of v.avisos ?? []) {
    const numero = Number(LA_PREGUNTA.exec(aviso)?.[1])
    const pregunta = enOrden[numero - 1]
    if (!pregunta) continue
    const falta = sinElNombreDeLaPregunta(aviso, numero, pregunta.enunciado)
    salida.set(pregunta.id, [...(salida.get(pregunta.id) ?? []), falta])
  }
  return salida
}

/** El id del selector «Quién califica…» del lápiz de un criterio, adonde lleva su falta. */
export const idDelCalificador = (criterioId: number) => `calificador-${criterioId}`

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

/** Lo que dura en ámbar el sitio al que se llega desde una falta. */
export const RESALTE_MS = 1600

/**
 * Baja hasta el destino, le pone el foco y lo resalta un momento, cuando ya
 * está pintado: con el ratón el foco no se ve, y hay que saber adónde se llegó.
 * Dos `requestAnimationFrame`: el primero deja que React despliegue el
 * criterio, el segundo que el navegador lo coloque. Con `campo`, el foco va al
 * selector de su lápiz abierto; si no está (en lectura), al criterio.
 */
export function bajarHasta(d: Destino): void {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const destino = document.getElementById(idDelDestino(d))
      if (!destino) return
      destino.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
      const campo = d.tipo === 'CRITERIO' && d.campo ? document.getElementById(idDelCalificador(d.criterioId)) : null
      const foco = campo ?? destino
      foco.focus({ preventScroll: true })
      destino.setAttribute('data-resaltado', '')
      window.setTimeout(() => destino.removeAttribute('data-resaltado'), RESALTE_MS)
    }),
  )
}

// ---------- «⚠ N por arreglar →» ----------

/** Un sitio con faltas: adónde lleva, cómo se reconoce y su lugar en la página. */
export interface Parada {
  destino: Destino
  clave: string
  posicion: number
}

/** Dos faltas con la misma clave se arreglan en el mismo sitio: una sola parada. */
function claveDelDestino(d: Destino): string {
  return d.tipo === 'CONFIGURACION' ? `configuracion-${d.campo}` : idDelDestino(d)
}

/**
 * Los sitios de la página de arriba abajo: la cabecera —el total, que lleva a los
 * criterios, y la configuración, el tiempo antes que la fecha como en su panel—,
 * cada criterio seguido de sus preguntas, las que no tienen criterio y los
 * entregables generales.
 */
function sitiosEnOrden(v: VersionDePreguntas): string[] {
  return [
    idDelDestino({ tipo: 'CRITERIOS' }),
    'configuracion-tiempo',
    'configuracion-fecha',
    ...v.criterios.flatMap((c) => [`criterio-${c.id}`, ...c.preguntas.map((p) => `pregunta-${p.id}`)]),
    ...v.sinCriterio.map((p) => `pregunta-${p.id}`),
    ...(v.prueba?.entregables ?? []).map((e) => `entregable-${e.id}`),
  ]
}

/** Los sitios con faltas, sin repetir y en el orden de la página; uno que no está en ella, al final. */
export function paradasDeLasFaltas(avisos: string[], v: VersionDePreguntas): Parada[] {
  const orden = sitiosEnOrden(v)
  const paradas = new Map<string, Parada>()
  for (const aviso of avisos) {
    const destino = destinoDelAviso(aviso, v)
    const clave = claveDelDestino(destino)
    const posicion = orden.indexOf(clave)
    if (!paradas.has(clave)) paradas.set(clave, { destino, clave, posicion: posicion === -1 ? orden.length : posicion })
  }
  return [...paradas.values()].sort((a, b) => a.posicion - b.posicion)
}

/**
 * La parada que sigue a la última visitada, en el orden de la página; tras la
 * última, la primera. Si la visitada ya no está (se arregló), sigue por la que
 * venía después de su sitio; si su sitio desapareció, vuelve a empezar.
 */
export function siguienteParada(paradas: Parada[], ultima: string | null, v: VersionDePreguntas): Parada | undefined {
  const desde = ultima === null ? -1 : sitiosEnOrden(v).indexOf(ultima)
  return paradas.find((p) => p.posicion > desde) ?? paradas[0]
}

/**
 * La pastilla «⚠ N por arreglar →» y «Publicar» con faltas, los mismos en los dos
 * editores: `siguiente` lleva, en cada clic, a la siguiente falta en el orden de la
 * página (cicla al final); `primera`, a la primera.
 */
export function useIrALasFaltas(avisos: string[], v: VersionDePreguntas, alIr: (d: Destino) => void) {
  const [ultima, setUltima] = useState<string | null>(null)
  const paradas = paradasDeLasFaltas(avisos, v)
  const ir = (p: Parada | undefined) => {
    if (!p) return
    setUltima(p.clave)
    alIr(p.destino)
  }
  return {
    cuantas: avisos.length,
    siguiente: () => ir(siguienteParada(paradas, ultima, v)),
    primera: () => ir(paradas[0]),
  }
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

  // El criterio cuyo lápiz pidió abrir una falta, hasta que el bloque lo abre.
  const [aEditar, setAEditar] = useState<number | null>(null)

  const cambiar = (abiertos: Set<number>) => setEstado((e) => ({ ...e, abiertos }))
  return {
    aEditar,
    /** Despliega el criterio y pide abrir su lápiz. */
    editar: (id: number) => {
      if (!estado.abiertos.has(id)) cambiar(new Set([...estado.abiertos, id]))
      setAEditar(id)
    },
    /** El bloque ya abrió el lápiz pedido. */
    lapizAbierto: () => setAEditar(null),
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
 * Qué criterios están desplegados en una versión que se lee: la publicada, la vista
 * previa de «Copiar de otra vacante» y «Cambiar los puntos». Al entrar, **todos
 * plegados** —ya está publicada: no hay faltas ni criterios recién creados que
 * enseñar—; si llega otra versión, es como volver a entrar. Plegar es solo leer:
 * vale también sin `editar_vacante` (AC-23).
 *
 * Con `desplegadosAlEntrar` salen todos desplegados: «Cambiar los puntos» del
 * banco, cuyos únicos campos son los puntos de sus preguntas (QA-13).
 */
export function useCriteriosPlegados(
  version: Pick<VersionDePreguntas, 'id' | 'criterios'>,
  desplegadosAlEntrar = false,
) {
  const alEntrar = () => new Set<number>(desplegadosAlEntrar ? version.criterios.map((c) => c.id) : [])
  const [estado, setEstado] = useState(() => ({ versionId: version.id, abiertos: alEntrar() }))
  if (estado.versionId !== version.id) setEstado({ versionId: version.id, abiertos: alEntrar() })

  const cambiar = (abiertos: Set<number>) => setEstado((e) => ({ ...e, abiertos }))
  return {
    abierto: (id: number) => estado.abiertos.has(id),
    alternar: (id: number) =>
      setEstado((e) => {
        const abiertos = new Set(e.abiertos)
        if (abiertos.has(id)) abiertos.delete(id)
        else abiertos.add(id)
        return { ...e, abiertos }
      }),
    /** Despliega estos, sin plegar ninguno. */
    abrir: (ids: number[]) => setEstado((e) => ({ ...e, abiertos: new Set([...e.abiertos, ...ids]) })),
    desplegarTodo: () => cambiar(new Set(version.criterios.map((c) => c.id))),
    plegarTodo: () => cambiar(new Set()),
  }
}

/**
 * Ir a donde se arregla una falta: despliega su criterio y baja hasta él; el tiempo y
 * la fecha abren la configuración (solo la prueba la tiene). La de quién califica abre
 * además el lápiz del criterio.
 */
export function irAlDestino(
  d: Destino,
  plegado: { abrir: (criterioId: number) => void; editar?: (criterioId: number) => void },
  alConfigurar?: (campo: CampoDeLaConfiguracion) => void,
): void {
  if (d.tipo === 'CONFIGURACION') {
    alConfigurar?.(d.campo)
    return
  }
  if (d.tipo === 'CRITERIO' && d.campo && plegado.editar) plegado.editar(d.criterioId)
  else if (d.tipo === 'CRITERIO') plegado.abrir(d.criterioId)
  if (d.tipo === 'PREGUNTA' && d.criterioId !== null) plegado.abrir(d.criterioId)
  bajarHasta(d)
}
