/**
 * Lo que el editor de preguntas propias sabe sin preguntar al servidor: los
 * nombres de los tipos, como se arma el formulario de una pregunta y como se
 * dice el estado de una version.
 *
 * ⚠️ **El balance NO se calcula aqui.** Lo cuadra el servidor y viaja en cada
 * respuesta del editor: si el panel sumara por su cuenta, un fallo de red dejaria
 * dos numeros distintos en la misma pantalla. Aqui solo se leen y se dicen.
 */

import type {
  CriterioDeLaVersion,
  GuardarPregunta,
  PreguntaDeLaVersion,
  ResumenDePreguntas,
  TipoDePreguntaPropia,
} from '../../api/preguntasPropias'

export const TIPOS: { valor: TipoDePreguntaPropia; nombre: string }[] = [
  { valor: 'ABIERTA', nombre: 'Abierta' },
  { valor: 'OPCION_UNICA', nombre: 'Opción única' },
  { valor: 'OPCION_MULTIPLE', nombre: 'Opción múltiple' },
  { valor: 'ESCALA', nombre: 'Escala' },
]

export function nombreDelTipo(tipo: string): string {
  return TIPOS.find((t) => t.valor === tipo)?.nombre ?? tipo
}

export const esCerrada = (tipo: TipoDePreguntaPropia) => tipo !== 'ABIERTA'

/** Una opción o un nivel tal como se escribe: los puntos son texto hasta guardar. */
export interface OpcionEnEdicion {
  texto: string
  puntos: string
}

/** Lo que el formulario de una pregunta lleva puesto. */
export interface PreguntaEnEdicion {
  tipo: TipoDePreguntaPropia
  enunciado: string
  puntos: string
  criterioId: number | null
  queDebeTener: string
  opciones: OpcionEnEdicion[]
}

const vacias = (cuantas: number): OpcionEnEdicion[] =>
  Array.from({ length: cuantas }, () => ({ texto: '', puntos: '0' }))

/** Cuántas opciones trae cada tipo al nacer: lo mínimo que le vale. */
function opcionesIniciales(tipo: TipoDePreguntaPropia): OpcionEnEdicion[] {
  if (tipo === 'ABIERTA') return []
  if (tipo === 'ESCALA') {
    // Cinco niveles, del 1 al 5, con los extremos rotulados como ejemplo.
    return Array.from({ length: 5 }, (_, i) => ({
      texto: i === 0 ? 'Nada' : i === 4 ? 'Mucho' : '',
      puntos: String(i),
    }))
  }
  return vacias(2)
}

export function preguntaNueva(criterioId: number | null): PreguntaEnEdicion {
  return {
    tipo: 'ABIERTA',
    enunciado: '',
    puntos: '10',
    criterioId,
    queDebeTener: '',
    opciones: [],
  }
}

export function desdePregunta(p: PreguntaDeLaVersion): PreguntaEnEdicion {
  return {
    tipo: p.tipo,
    enunciado: p.enunciado,
    puntos: String(p.puntos),
    criterioId: p.criterioId,
    queDebeTener: p.queDebeTener ?? '',
    opciones: [...p.opciones]
      .sort((a, b) => a.orden - b.orden)
      // En la escala el servidor guarda el número cuando no hay rótulo: se
      // devuelve vacío para que no parezca que alguien lo escribió.
      .map((o) => ({
        texto: p.tipo === 'ESCALA' && o.texto === String(o.orden) ? '' : o.texto,
        puntos: String(o.puntos),
      })),
  }
}

/**
 * Cambiar el tipo conserva lo que sirve: el enunciado y los puntos siempre, las
 * opciones escritas si el tipo nuevo también las usa.
 */
export function conOtroTipo(p: PreguntaEnEdicion, tipo: TipoDePreguntaPropia): PreguntaEnEdicion {
  if (tipo === p.tipo) return p
  const opciones =
    !esCerrada(tipo)
      ? []
      : esCerrada(p.tipo) && p.opciones.length >= (tipo === 'ESCALA' ? 3 : 2)
        ? p.opciones.slice(0, 10)
        : opcionesIniciales(tipo)
  return { ...p, tipo, opciones, queDebeTener: tipo === 'ABIERTA' ? p.queDebeTener : '' }
}

/**
 * Lo que se manda. Los puntos van como número tal cual se escribieron —con
 * decimales si los hay—: rechazarlos es cosa del servidor, que devuelve la
 * lista entera de lo que falta.
 */
export function paraGuardar(p: PreguntaEnEdicion, abiertasSinPuntos = false): GuardarPregunta {
  const numero = (texto: string) => (texto.trim() === '' ? Number.NaN : Number(texto))
  return {
    tipo: p.tipo,
    enunciado: p.enunciado.trim(),
    // En la prueba (V67) la abierta no lleva puntos: la IA o una persona califican el
    // criterio entero. Se manda 0, que es lo que el servidor guarda.
    puntos: abiertasSinPuntos && p.tipo === 'ABIERTA' ? 0 : numero(p.puntos),
    criterioId: p.criterioId,
    queDebeTener: p.tipo === 'ABIERTA' && p.queDebeTener.trim() ? p.queDebeTener.trim() : null,
    opciones: esCerrada(p.tipo)
      ? p.opciones.map((o) => ({
          texto: o.texto.trim() === '' ? (p.tipo === 'ESCALA' ? null : '') : o.texto.trim(),
          puntos: numero(o.puntos),
        }))
      : [],
  }
}

/** Lo que falta a la vista, antes de mandar: lo evidente. El resto lo dice el servidor. */
export function faltaEvidente(p: PreguntaEnEdicion, abiertasSinPuntos = false): string | null {
  if (p.enunciado.trim() === '') return 'Falta el enunciado.'
  if (abiertasSinPuntos && p.tipo === 'ABIERTA') return null
  if (p.puntos.trim() === '' || Number.isNaN(Number(p.puntos))) return 'Faltan los puntos.'
  return null
}

/**
 * «30 pts · sistema 10 + IA 20», o solo lo que haya. En la prueba (V67) la
 * segunda parte es la parte calificada del criterio, y dice quién la califica:
 * «sistema 10 + persona 20».
 */
export function puntosDelCriterio(c: CriterioDeLaVersion): string {
  if (c.puntos === 0) return '0 pts'
  const partes: string[] = []
  if (c.puntosSistema > 0) partes.push(`sistema ${c.puntosSistema}`)
  if (c.puntosCalificados != null) {
    if (c.puntosCalificados > 0) {
      partes.push(`${c.calificador === 'PERSONA' ? 'persona' : 'IA'} ${c.puntosCalificados}`)
    }
  } else if (c.puntosIa > 0) {
    partes.push(`IA ${c.puntosIa}`)
  }
  return `${c.puntos} pts · ${partes.join(' + ')}`
}

/**
 * La línea de un criterio plegado (V68): «30 pts (sistema 10 + IA 20)», o solo
 * los puntos si no hay reparto que decir.
 */
export function puntosConDesglose(c: CriterioDeLaVersion): string {
  const conDesglose = puntosDelCriterio(c)
  const [puntos, desglose] = conDesglose.split(' · ')
  return desglose ? `${puntos} (${desglose})` : (puntos ?? conDesglose)
}

/** «· 2 preguntas · 1 archivo», lo que sigue a los puntos en la línea de un criterio. */
export function cuentaDelCriterio(preguntas: number, archivos: number): string {
  const partes = [`${preguntas} ${preguntas === 1 ? 'pregunta' : 'preguntas'}`]
  if (archivos > 0) partes.push(`${archivos} ${archivos === 1 ? 'archivo' : 'archivos'}`)
  return `· ${partes.join(' · ')}`
}

/**
 * El estado de la prueba técnica de una vacante (V67), para su bloque en la
 * vacante: «Sin prueba», «Borrador · 70 de 100 puntos · 2 entregables»,
 * «Publicada · 5 criterios · 2 entregables · 90 min» o, sin entregables,
 * «Publicada · 3 criterios · 12 preguntas · sin cronómetro». Desde la V68 no hay
 * «cuestionario»: una sola prueba, con o sin entregables.
 */
export function textoDeLaPrueba(r: ResumenDePreguntas | null | undefined): string {
  if (!r || r.estado === 'SIN_PRUEBA' || r.estado === 'SIN_PREGUNTAS') return 'Sin prueba'
  const entregables = r.entregables ?? 0
  const deEntregables = `${entregables} ${entregables === 1 ? 'entregable' : 'entregables'}`
  if (r.estado === 'BORRADOR') {
    return `Borrador · ${r.puntos ?? 0} de 100 puntos${entregables > 0 ? ` · ${deEntregables}` : ''}`
  }
  const tiempo =
    typeof r.minutos === 'number'
      ? ` · ${r.minutos} min`
      : typeof r.dias === 'number'
        ? ` · ${r.dias} ${r.dias === 1 ? 'día' : 'días'}`
        : ' · sin cronómetro'
  const criterios = r.criterios ?? 0
  const preguntas = r.preguntas ?? 0
  const deQue = entregables > 0 ? deEntregables : `${preguntas} ${preguntas === 1 ? 'pregunta' : 'preguntas'}`
  return `Publicada · ${criterios} ${criterios === 1 ? 'criterio' : 'criterios'} · ${deQue}${tiempo}`
}

/** Los formatos de un entregable, con su nombre para leer. */
export const FORMATOS: { valor: 'ARCHIVO' | 'ENLACE' | 'CUALQUIERA'; nombre: string }[] = [
  { valor: 'ARCHIVO', nombre: 'Archivo' },
  { valor: 'ENLACE', nombre: 'Enlace' },
  { valor: 'CUALQUIERA', nombre: 'Archivo o enlace' },
]

export function nombreDelFormato(formato: string): string {
  return FORMATOS.find((f) => f.valor === formato)?.nombre.toLowerCase() ?? formato
}

/** «Sin preguntas», «Borrador · 68 de 100 puntos», «Publicadas · 4 criterios · 12 preguntas». */
export function textoDelResumen(r: ResumenDePreguntas | null | undefined): string {
  if (!r || r.estado === 'SIN_PREGUNTAS') return 'Sin preguntas'
  if (r.estado === 'BORRADOR') return `Borrador · ${r.puntos ?? 0} de 100 puntos`
  const criterios = r.criterios ?? 0
  const preguntas = r.preguntas ?? 0
  return `Publicadas · ${criterios} ${criterios === 1 ? 'criterio' : 'criterios'} · ${preguntas} ${
    preguntas === 1 ? 'pregunta' : 'preguntas'
  }`
}

/** Los puntos que le faltan a la versión para llegar a 100 (nunca negativo). */
export const puntosQueFaltan = (total: number) => Math.max(0, 100 - total)

// ---------- Textos con número: plural y artículo que casan ----------

/** Los niveles de puesto, con su nombre para leer. */
export const NIVELES_DE_PUESTO: { valor: string; nombre: string }[] = [
  { valor: 'EJECUCION', nombre: 'Ejecución' },
  { valor: 'SUPERVISION', nombre: 'Supervisión' },
  { valor: 'DIRECCION', nombre: 'Dirección' },
]

/** «Ejecución» en vez de «ejecucion»; un código que no se conoce se deja como llega. */
export function nombreDelNivel(codigo: string): string {
  return NIVELES_DE_PUESTO.find((n) => n.valor === codigo.toUpperCase())?.nombre ?? codigo
}

/** Al quitar un criterio con preguntas: «Su pregunta queda…» o «Sus 3 preguntas quedan…». */
export function avisoAlQuitarCriterio(preguntas: number): string {
  return preguntas === 1
    ? 'Su pregunta queda sin criterio hasta que la muevas, y mientras tanto no se publica.'
    : `Sus ${preguntas} preguntas quedan sin criterio hasta que las muevas, y mientras tanto no se publica.`
}

/** Antes de cambiar los puntos con gente dentro: a quién se le recalcula. */
export function avisoAntesDeRecalcular(rindieron: number): string {
  return rindieron === 1
    ? 'Se recalculará la nota de la persona que ya rindió. No se llama a la IA.'
    : `Se recalcularán las notas de las ${rindieron} personas que ya rindieron. No se llama a la IA.`
}

/** Antes de cambiar las instrucciones de la IA: a quién se vuelve a calificar. */
export function avisoAntesDeRecalificar(conNota: number): string {
  const quienes =
    conNota === 1
      ? 'Se volverá a calificar a la persona que ya tiene nota.'
      : `Se volverá a calificar a las ${conNota} personas que ya tienen nota.`
  return `${quienes} Las notas ajustadas a mano no cambian. Cuenta contra el tope de IA.`
}

/**
 * Lo que dice «Reintentar». Si el servidor no pudo encolar a alguien, dice por qué
 * (la IA apagada, sin cupo…): «no quedó nadie» solo es verdad cuando no quedaba nadie.
 */
export function resultadoDelReintento(r: { personas: number; motivo?: string | null }): string {
  const pedida =
    r.personas > 0
      ? `Se volvió a pedir la recalificación de ${r.personas} ${r.personas === 1 ? 'persona' : 'personas'}.`
      : null
  const partes = [pedida, r.motivo ?? null].filter((p): p is string => Boolean(p))
  return partes.length > 0 ? partes.join(' ') : 'No quedó nadie por volver a encolar.'
}
