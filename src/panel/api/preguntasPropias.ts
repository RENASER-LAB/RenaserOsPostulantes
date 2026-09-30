/**
 * Las preguntas propias de una vacante (backend V66): el editor agrupado por
 * criterios, su publicacion, lo que se cambia con candidatos dentro, la copia
 * entre vacantes, las recomendaciones de la IA y el ajuste a mano de una
 * abierta.
 *
 * Archivo aparte, como las reseñas: son once rutas nuevas de una sola pantalla y
 * meterlas en `panel.ts` las perderia entre las ciento y pico que ya hay.
 *
 * ⚠️ **Los puntos viajan como numero y el servidor exige que sean enteros.** Un
 * 2,5 no se redondea aqui: lo rechaza el backend con su lista de faltas, que es
 * la misma que se pinta al publicar.
 */

import { pedir } from './cliente'

export type TipoDePreguntaPropia = 'ABIERTA' | 'OPCION_UNICA' | 'OPCION_MULTIPLE' | 'ESCALA'

export interface OpcionDeLaVersion {
  id: number
  texto: string
  puntos: number
  /** En la escala, el numero del nivel. */
  orden: number
}

export interface PreguntaDeLaVersion {
  id: number
  tipo: TipoDePreguntaPropia
  enunciado: string
  puntos: number
  criterioId: number | null
  orden: number
  queDebeTener: string | null
  opciones: OpcionDeLaVersion[]
}

export interface CriterioDeLaVersion {
  id: number
  nombre: string
  queEvalua: string | null
  orden: number
  /** La suma de sus preguntas: no se escribe. */
  puntos: number
  puntosSistema: number
  puntosIa: number
  preguntas: PreguntaDeLaVersion[]
}

export interface VersionDePreguntas {
  id: number
  estado: 'BORRADOR' | 'PUBLICADA' | 'ARCHIVADA'
  guiaCalificacion: string | null
  minutosObjetivo: number | null
  versionGuia: number
  /** El balance lo cuadra el servidor: el panel lo pinta tal cual. */
  total: number
  cuantosCriterios: number
  cuantasPreguntas: number
  criterios: CriterioDeLaVersion[]
  sinCriterio: PreguntaDeLaVersion[]
  /** Lo que frena la publicacion, dicho entero. Vacio = se puede publicar. */
  avisos: string[]
}

export interface ResumenDePreguntas {
  estado: 'SIN_PREGUNTAS' | 'BORRADOR' | 'PUBLICADAS'
  puntos: number | null
  criterios: number | null
  preguntas: number | null
}

export interface Recalificacion {
  /** Cuantas personas entregaron: a quienes recalcula un cambio de puntos. */
  rindieron: number
  /** Cuantas tienen abiertas calificadas por la IA: a quienes recalifica la guia nueva. */
  conNota: number
  alDia: number
  recalificando: number
  pendientes: number
  motivos: string[]
}

export interface EditorDePreguntas {
  vacanteId: number
  titulo: string
  nivel: string | null
  origen: 'NIVEL' | 'VACANTE'
  aplicaEvaluacion: boolean
  /** El panel no sabe sus permisos: viaja aqui. */
  puedeEditar: boolean
  hayPostulantes: boolean
  borrador: VersionDePreguntas | null
  publicada: VersionDePreguntas | null
  resumen: ResumenDePreguntas
  recalificacion: Recalificacion | null
}

export interface GuardarOpcion {
  texto: string | null
  puntos: number
}

export interface GuardarPregunta {
  tipo: TipoDePreguntaPropia
  enunciado: string
  puntos: number
  criterioId: number | null
  queDebeTener: string | null
  opciones: GuardarOpcion[]
}

export interface GuardarCriterio {
  nombre: string
  queEvalua: string | null
}

export interface VacanteCopiable {
  vacanteId: number
  titulo: string
  nivel: string | null
  publicadaEn: string | null
  estado: 'ACTIVA' | 'CERRADA' | 'ARCHIVADA'
  criterios: number
  preguntas: number
}

export interface OpcionPropuesta {
  texto: string | null
  puntos: number
}

export interface PreguntaPropuesta {
  tipo: TipoDePreguntaPropia
  enunciado: string
  puntos: number
  queDebeTener: string | null
  opciones: OpcionPropuesta[]
}

export interface CriterioPropuesto {
  /** Con valor, son preguntas para un criterio que ya esta en el borrador. */
  criterioExistenteId: number | null
  nombre: string | null
  queEvalua: string | null
  preguntas: PreguntaPropuesta[]
}

export interface EstadoDeLaRecomendacion {
  estado: 'SIN_PEDIR' | 'EN_CURSO' | 'LISTA' | 'FALLIDA' | 'DETENIDA'
  motivo: string | null
  propuestaId: number | null
  puntosQueFaltan: number | null
  indicacion: string | null
  propuesta: CriterioPropuesto[]
}

export interface RecomendacionPedida {
  encolada: boolean
  mensaje: string
}

export interface CambioAplicado {
  personas: number
  /** Por qué no alcanzó a quien quedaba (la IA apagada, sin cupo…); nulo si alcanzó. */
  motivo?: string | null
}

export interface CorregirInstrucciones {
  guiaCalificacion: string | null
  criterios: { id: number; texto: string | null }[]
  preguntas: { id: number; texto: string | null }[]
}

export interface CambiarPuntos {
  preguntas: { id: number; puntos: number; opciones: { id: number; puntos: number }[] }[]
}

const base = (vacanteId: number) => `/vacantes/${vacanteId}/preguntas-propias`

export const verPreguntasPropias = (vacanteId: number) =>
  pedir<EditorDePreguntas>(base(vacanteId))

export const abrirBorrador = (vacanteId: number) =>
  pedir<EditorDePreguntas>(`${base(vacanteId)}/borrador`, { metodo: 'POST' })

export const guardarDatosDelBorrador = (
  vacanteId: number,
  datos: { guiaCalificacion: string | null; minutosObjetivo: number | null },
) => pedir<EditorDePreguntas>(`${base(vacanteId)}/borrador`, { metodo: 'PUT', cuerpo: datos })

export const descartarBorrador = (vacanteId: number) =>
  pedir<EditorDePreguntas>(`${base(vacanteId)}/borrador`, { metodo: 'DELETE' })

export const agregarCriterio = (vacanteId: number, datos: GuardarCriterio) =>
  pedir<EditorDePreguntas>(`${base(vacanteId)}/criterios`, { metodo: 'POST', cuerpo: datos })

export const editarCriterio = (vacanteId: number, criterioId: number, datos: GuardarCriterio) =>
  pedir<EditorDePreguntas>(`${base(vacanteId)}/criterios/${criterioId}`, {
    metodo: 'PUT',
    cuerpo: datos,
  })

export const quitarCriterio = (vacanteId: number, criterioId: number) =>
  pedir<EditorDePreguntas>(`${base(vacanteId)}/criterios/${criterioId}`, { metodo: 'DELETE' })

export const moverCriterio = (vacanteId: number, criterioId: number, direccion: 'ARRIBA' | 'ABAJO') =>
  pedir<EditorDePreguntas>(`${base(vacanteId)}/criterios/${criterioId}/movimiento`, {
    metodo: 'POST',
    cuerpo: { direccion },
  })

export const agregarPregunta = (vacanteId: number, datos: GuardarPregunta) =>
  pedir<EditorDePreguntas>(`${base(vacanteId)}/preguntas`, { metodo: 'POST', cuerpo: datos })

export const editarPregunta = (vacanteId: number, preguntaId: number, datos: GuardarPregunta) =>
  pedir<EditorDePreguntas>(`${base(vacanteId)}/preguntas/${preguntaId}`, {
    metodo: 'PUT',
    cuerpo: datos,
  })

export const quitarPregunta = (vacanteId: number, preguntaId: number) =>
  pedir<EditorDePreguntas>(`${base(vacanteId)}/preguntas/${preguntaId}`, { metodo: 'DELETE' })

export const moverPregunta = (vacanteId: number, preguntaId: number, direccion: 'ARRIBA' | 'ABAJO') =>
  pedir<EditorDePreguntas>(`${base(vacanteId)}/preguntas/${preguntaId}/movimiento`, {
    metodo: 'POST',
    cuerpo: { direccion },
  })

/** 400 con `faltas` (la lista entera) si algo frena; 409 con postulantes. */
export const publicarPreguntas = (vacanteId: number) =>
  pedir<EditorDePreguntas>(`${base(vacanteId)}/publicacion`, { metodo: 'POST' })

export const corregirInstrucciones = (vacanteId: number, datos: CorregirInstrucciones) =>
  pedir<CambioAplicado>(`${base(vacanteId)}/publicada/instrucciones`, {
    metodo: 'PUT',
    cuerpo: datos,
  })

export const reintentarRecalificacion = (vacanteId: number) =>
  pedir<CambioAplicado>(`${base(vacanteId)}/publicada/recalificacion`, { metodo: 'POST' })

export const cambiarPuntos = (vacanteId: number, datos: CambiarPuntos) =>
  pedir<CambioAplicado>(`${base(vacanteId)}/publicada/puntos`, { metodo: 'PUT', cuerpo: datos })

export const listarCopiables = (vacanteId: number, buscar: string, nivel: string) => {
  const q = new URLSearchParams()
  if (buscar.trim()) q.set('buscar', buscar.trim())
  if (nivel) q.set('nivel', nivel)
  const consulta = q.toString()
  return pedir<VacanteCopiable[]>(`${base(vacanteId)}/copiables${consulta ? `?${consulta}` : ''}`)
}

export const verVistaPrevia = (vacanteId: number, vacanteOrigenId: number) =>
  pedir<VersionDePreguntas>(`${base(vacanteId)}/copiables/${vacanteOrigenId}`)

export const copiarDeOtraVacante = (vacanteId: number, vacanteOrigenId: number) =>
  pedir<EditorDePreguntas>(`${base(vacanteId)}/copia`, {
    metodo: 'POST',
    cuerpo: { vacanteOrigenId },
  })

export const pedirRecomendaciones = (vacanteId: number, indicacion: string | null) =>
  pedir<RecomendacionPedida>(`${base(vacanteId)}/recomendaciones`, {
    metodo: 'POST',
    cuerpo: { indicacion },
  })

export const verRecomendacion = (vacanteId: number) =>
  pedir<EstadoDeLaRecomendacion>(`${base(vacanteId)}/recomendaciones`)

export const agregarDeLaPropuesta = (
  vacanteId: number,
  propuestaId: number,
  datos: { criterios: number[]; preguntas: { criterio: number; pregunta: number }[] },
) =>
  pedir<EditorDePreguntas>(`${base(vacanteId)}/recomendaciones/${propuestaId}/agregados`, {
    metodo: 'POST',
    cuerpo: datos,
  })

/** Qué responderá quien postule: la opción de la sección de la vacante. */
export const elegirOrigenDePreguntas = (
  vacanteId: number,
  origen: 'SIN_EVALUACION' | 'NIVEL' | 'VACANTE',
) =>
  pedir<void>(`/vacantes/${vacanteId}/origen-preguntas`, { metodo: 'POST', cuerpo: { origen } })

/** Ajustar la nota de una abierta de las preguntas propias, o ponerla si la IA no pudo. */
export const ajustarNotaDeAbierta = (
  postulacionId: number,
  respuestaId: number,
  datos: { puntaje: number; motivo: string },
) =>
  pedir<void>(`/postulaciones/${postulacionId}/evaluacion/respuestas/${respuestaId}/nota`, {
    metodo: 'PUT',
    cuerpo: datos,
  })

/**
 * La lista de faltas de un 400 del editor, si la trae. El backend la manda en
 * `faltas` para que se pinte como lista y no en una sola linea.
 */
export function faltasDe(causa: unknown): string[] | null {
  const cuerpo = (causa as { cuerpo?: { faltas?: unknown } } | null)?.cuerpo
  const faltas = cuerpo?.faltas
  return Array.isArray(faltas) && faltas.every((f) => typeof f === 'string')
    ? (faltas as string[])
    : null
}
