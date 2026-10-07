/**
 * La prueba técnica de una vacante escrita en el editor (backend V67): lo que
 * solo tiene la prueba —el caso, el tiempo, los entregables y la parte
 * calificada de cada criterio— y, en la ficha, la prueba de un candidato
 * criterio por criterio y el ajuste a mano.
 *
 * Lo que comparte con las preguntas propias (preguntas, mover, publicar,
 * recomendaciones, copia, puntos, instrucciones) va por `preguntasPropias.ts`
 * con la ruta `prueba-propia`: es el mismo editor.
 *
 * ⚠️ **Nada de esto llega al portal.** El candidato tiene sus propios contratos,
 * sin puntos, claves, criterios ni calificadores (RF-53).
 */

import { pedir, pedirArchivo } from './cliente'
import type { EditorDePreguntas, FormatoDeEntregable, RutaDelEditor } from './preguntasPropias'

export const RUTA_DE_LA_PRUEBA: RutaDelEditor = 'prueba-propia'

const base = (vacanteId: number) => `/vacantes/${vacanteId}/prueba-propia`

export type Calificador = 'IA' | 'PERSONA'

export interface GuardarCriterioDePrueba {
  nombre: string
  queEvalua: string | null
  /**
   * Lo que vale el criterio entero (V69), cerradas incluidas. Su parte
   * calificada es esto menos sus cerradas, y se ajusta sola si cambian: el
   * total se mantiene.
   */
  puntos: number | null
  /** Quién califica lo que no suman sus cerradas; nulo si no queda nada. */
  calificador: Calificador | null
  // Lo que mira no se escribe (V68): lo deduce el servidor del alcance de los entregables.
}

export interface GuardarDatosDeLaPrueba {
  guiaCalificacion: string | null
  enunciado: string | null
  materiales: string | null
  herramientasPermitidas: string | null
  /** «Cronometrada» o «Sin cronómetro» (PLAZO_ABIERTO, sin días: hasta la fecha límite). */
  modalidad: 'CRONOMETRADA' | 'PLAZO_ABIERTO' | null
  duracionMinutos: number | null
}

export interface GuardarEntregable {
  nombre: string
  detalle: string | null
  formato: FormatoDeEntregable | null
  obligatorio: boolean
  queDebeTener: string | null
  /**
   * El alcance (V68): `preguntaId` para el archivo de una pregunta (como mucho
   * uno); si no, es general y cubre `todaLaPrueba` o las preguntas de `cubre`.
   */
  preguntaId: number | null
  todaLaPrueba: boolean
  cubre: number[]
}

export const verPrueba = (vacanteId: number) => pedir<EditorDePreguntas>(base(vacanteId))

export const guardarDatosDeLaPrueba = (vacanteId: number, datos: GuardarDatosDeLaPrueba) =>
  pedir<EditorDePreguntas>(`${base(vacanteId)}/borrador`, { metodo: 'PUT', cuerpo: datos })

export const subirConsigna = (vacanteId: number, archivo: File) => {
  const formulario = new FormData()
  formulario.append('archivo', archivo)
  return pedir<EditorDePreguntas>(`${base(vacanteId)}/borrador/consigna`, {
    metodo: 'POST',
    formulario,
  })
}

export const quitarConsigna = (vacanteId: number) =>
  pedir<EditorDePreguntas>(`${base(vacanteId)}/borrador/consigna`, { metodo: 'DELETE' })

export const agregarCriterioDePrueba = (vacanteId: number, datos: GuardarCriterioDePrueba) =>
  pedir<EditorDePreguntas>(`${base(vacanteId)}/criterios`, { metodo: 'POST', cuerpo: datos })

export const editarCriterioDePrueba = (
  vacanteId: number,
  criterioId: number,
  datos: GuardarCriterioDePrueba,
) =>
  pedir<EditorDePreguntas>(`${base(vacanteId)}/criterios/${criterioId}`, {
    metodo: 'PUT',
    cuerpo: datos,
  })

export const agregarEntregable = (vacanteId: number, datos: GuardarEntregable) =>
  pedir<EditorDePreguntas>(`${base(vacanteId)}/entregables`, { metodo: 'POST', cuerpo: datos })

export const editarEntregable = (vacanteId: number, entregableId: number, datos: GuardarEntregable) =>
  pedir<EditorDePreguntas>(`${base(vacanteId)}/entregables/${entregableId}`, {
    metodo: 'PUT',
    cuerpo: datos,
  })

/** Desaparece también de lo que miran los criterios: el panel pide confirmarlo antes. */
export const quitarEntregable = (vacanteId: number, entregableId: number) =>
  pedir<EditorDePreguntas>(`${base(vacanteId)}/entregables/${entregableId}`, { metodo: 'DELETE' })

export const moverEntregable = (vacanteId: number, entregableId: number, direccion: 'ARRIBA' | 'ABAJO') =>
  pedir<EditorDePreguntas>(`${base(vacanteId)}/entregables/${entregableId}/movimiento`, {
    metodo: 'POST',
    cuerpo: { direccion },
  })

/**
 * La fecha límite para dar la prueba (V68): la de la vacante. Con la prueba
 * publicada y gente en la etapa técnica pide un motivo, que queda en la
 * auditoría; antes no.
 */
export const fijarFechaLimite = (vacanteId: number, datos: { cierraEn: string; motivo: string | null }) =>
  pedir<EditorDePreguntas>(`${base(vacanteId)}/fecha-limite`, { metodo: 'PUT', cuerpo: datos })

// ---------- Quienes no la completaron ----------

/**
 * Quien dejó vencer el tiempo con algo sin responder: no sale en el ranking de
 * la prueba y su proceso espera a que alguien lo cierre.
 */
export interface NoCompleto {
  postulacionId: number
  candidato: string
  estado: string
  /** «le faltaron 3 preguntas», «le faltó «Tablero.xlsx»». */
  queFalto: string
  cerradaEn: string | null
  procesoCerrado: boolean
}

export const verQuienesNoCompletaron = (vacanteId: number) =>
  pedir<NoCompleto[]>(`${base(vacanteId)}/no-completaron`)

// ---------- La ficha: la prueba de un candidato ----------

export interface OpcionDelCandidato {
  id: number
  texto: string
  puntos: number
  marcada: boolean
}

export interface PreguntaDelCandidato {
  preguntaId: number
  tipo: string
  enunciado: string
  queDebeTener: string | null
  /** Nulo en las abiertas: no llevan puntos. */
  puntos: number | null
  obtenido: number | null
  respuesta: string | null
  respondida: boolean
  opciones: OpcionDelCandidato[]
}

export interface CriterioDelCandidato {
  criterioId: number
  nombre: string
  queEvalua: string | null
  maximo: number
  sistemaMaximo: number
  sistema: number
  calificadaMaximo: number
  calificador: Calificador | null
  /** La parte calificada que vale (puesta por la IA o ajustada). */
  calificada: number | null
  /** La que puso la IA, si una persona la ajustó después. */
  calificadaIa: number | null
  /** Nula mientras esté pendiente. */
  nota: number | null
  estado: 'CALIFICADO' | 'PENDIENTE' | 'SOLO_SISTEMA'
  explicacion: string | null
  evidencia: string | null
  origen: 'IA' | 'PERSONA' | null
  ajustadaPor: string | null
  ajustadaEn: string | null
  motivoAjuste: string | null
  preguntas: PreguntaDelCandidato[]
  entregables: number[]
}

export interface EntregaVista {
  entregableId: number
  nombre: string
  detalle: string | null
  formato: FormatoDeEntregable
  obligatorio: boolean
  queDebeTener: string | null
  loEntrego: boolean
  enlace: string | null
  archivoId: number | null
  archivoNombre: string | null
  subidoEn: string | null
  porQueNoSeVe: string | null
  /** V68: la pregunta de la que es el archivo; nulo en los generales. */
  preguntaId?: number | null
}

export interface PruebaDelCandidato {
  postulacionId: number
  estado: 'SIN_PRUEBA' | 'SIN_EMPEZAR' | 'EN_CURSO' | 'NO_COMPLETADA' | 'ENTREGADA'
  cuestionario: boolean
  iniciadoEn: string | null
  entregadoEn: string | null
  entregaAutomatica: boolean
  /** La nota de la etapa: nula mientras falte algún criterio. */
  nota: number | null
  loQueFalta: string[]
  puedeAjustar: boolean
  recalificando: boolean
  motivoPendiente: string | null
  criterios: CriterioDelCandidato[]
  entregables: EntregaVista[]
}

export const verPruebaDelCandidato = (postulacionId: number) =>
  pedir<PruebaDelCandidato>(`/postulaciones/${postulacionId}/prueba-propia`)

export const ajustarCriterio = (
  postulacionId: number,
  criterioId: number,
  datos: { puntaje: number; motivo: string },
) =>
  pedir<PruebaDelCandidato>(`/postulaciones/${postulacionId}/prueba-propia/criterios/${criterioId}/nota`, {
    metodo: 'PUT',
    cuerpo: datos,
  })

/** Volver a pedir la IA para los criterios de IA que siguen pendientes. */
export const pedirLaIaOtraVez = (postulacionId: number) =>
  pedir<{ estado: string; mensaje: string }>(`/postulaciones/${postulacionId}/prueba/calificacion-ia`, {
    metodo: 'POST',
  })

/** El enunciado adjunto, para abrirlo desde el editor. */
export const descargarConsigna = (archivoId: number) => pedirArchivo(`/archivos/${archivoId}/descarga`)
