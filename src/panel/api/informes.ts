import { pedir, pedirArchivo } from './cliente'
import type { Archivo } from '@/api/puerta'

/**
 * Los informes por etapa de un candidato (spec informe-pdf-por-etapa): el del CV, el de la
 * evaluación y el de la prueba del puesto.
 *
 * El backend los arma en el momento con lo guardado y los devuelve de dos formas, con los
 * mismos datos: como JSON para el visor y como PDF para descargar. Cada etapa pide su
 * permiso (el CV, ver el perfil integral; la evaluación, ver sus respuestas; la prueba, abrir
 * la ficha): sin él la etapa no sale en `verInformesDelPostulante` y pedirla da 403.
 */

/** La ruta de cada informe en el backend. */
export type EtapaDelInforme = 'cv' | 'evaluacion' | 'prueba'

/** El código que devuelve el backend en `etapa`. */
export type CodigoDeEtapa = 'CV' | 'EVALUACION' | 'PRUEBA'

export const RUTA_DE_LA_ETAPA: Record<CodigoDeEtapa, EtapaDelInforme> = {
  CV: 'cv',
  EVALUACION: 'evaluacion',
  PRUEBA: 'prueba',
}

export interface EstadoDeUnInforme {
  etapa: CodigoDeEtapa
  disponible: boolean
  /** «Todavía no tiene calificación», «La IA está calificando» o «La calificación falló». */
  motivo: string | null
  nota: number | null
}

export interface InformesDelPostulante {
  postulacionId: number
  candidato: string | null
  informes: EstadoDeUnInforme[]
}

export interface NotaDelInforme {
  valor: number | null
  texto: string
  sobre: string | null
  base: string | null
}

export interface DatoDelInforme {
  etiqueta: string
  valor: string
}

export interface RecuentoDelInforme {
  etiqueta: string
  cuantos: number
  tono: 'BIEN' | 'MAL' | 'PENDIENTE'
}

export interface ExperienciaDelInforme {
  total: string
  totalDetalle: string | null
  ultimoPuesto: string
  ultimoDetalle: string | null
  formacion: string
  habilidades: string[]
  perfil: string | null
}

export interface CriterioDelInforme {
  nombre: string
  nota: number | null
  maximo: number | null
  notaTexto: string
  maximoTexto: string | null
  porcentaje: number | null
  quien: string | null
  ajustada: boolean
  motivoAjuste: string | null
  /** La línea del redactor o, sin ella, la explicación completa de la IA. */
  texto: string | null
  explicacion: string | null
  preguntas: string | null
  pendiente: string | null
}

export interface PuntoDelInforme {
  texto: string
  detalle: string | null
  origen: string | null
  etiqueta: string | null
  grupo: string | null
}

export interface BloqueDelInforme {
  codigo: string
  titulo: string
  tono: 'BIEN' | 'NEUTRO' | 'MAL' | 'PENDIENTE' | 'CV'
  vacio: string
  puntos: PuntoDelInforme[]
}

export interface EnlaceDelInforme {
  rotulo: string
  url: string
  tipo: 'CV' | 'LINKEDIN' | 'GITHUB' | 'WEB'
}

export interface SenalDelInforme {
  nombre: string
  cumple: boolean
}

export interface DetalleDelInforme {
  numero: number | null
  titulo: string
  meta: string | null
  notaTexto: string | null
  ajustada: boolean
  motivoAjuste: string | null
  explicacion: string | null
  evidencia: string | null
  senales: SenalDelInforme[]
  pendiente: string | null
}

export interface PreguntaDelAnexo {
  numero: number
  enunciado: string
  meta: string | null
  /** Nula si la dejó en blanco: «Sin respuesta». */
  respuesta: string | null
  loQueDemostro: string | null
  explicacion: string | null
}

/**
 * Un entregable del anexo de la prueba: nombre, cuándo llegó y si se entregó.
 *
 * ⚠️ **Con qué se abre viaja solo con `descargar_entregables`** y solo si se entregó:
 * sin ese permiso los dos vienen nulos y se pinta como siempre, sin enlace.
 */
export interface EntregableDelAnexo {
  nombre: string
  detalle: string
  entregado: boolean
  /** El archivo subido: el visor pide con él el enlace firmado de siempre (`/archivos/{id}/enlace`). */
  archivoId?: number | null
  /** La dirección que pegó el candidato (o, en el PDF, el enlace firmado de 8 horas del archivo). */
  url?: string | null
}

export interface AnexoDelInforme {
  titulo: string
  subtitulo: string | null
  caso: string | null
  preguntas: PreguntaDelAnexo[]
  entregablesResumen: string | null
  entregables: EntregableDelAnexo[]
}

export interface Informe {
  etapa: CodigoDeEtapa
  titulo: string
  empresa: string | null
  vacante: string | null
  postulacionId: number
  candidato: string
  correo: string | null
  generadoEn: string
  nota: NotaDelInforme
  grupo: string | null
  datosClave: DatoDelInforme[]
  recuentos: RecuentoDelInforme[]
  experiencia: ExperienciaDelInforme | null
  resumen: { titulo: string; texto: string | null } | null
  evaluado: {
    titulo: string
    escala: string | null
    criterios: CriterioDelInforme[]
    pie: string | null
  } | null
  bloques: BloqueDelInforme[]
  enlaces: EnlaceDelInforme[]
  detalleTitulo: string | null
  detalle: DetalleDelInforme[]
  detallePie: string | null
  anexo: AnexoDelInforme | null
  aviso: string | null
  /** El redactor está escribiendo los textos: mientras, van las explicaciones de la IA. */
  textosEnCamino: boolean
  nombreArchivo: string
}

/**
 * El celular del candidato, ya listo para pintar: el de su cuenta o, si no tiene, el del CV.
 * Nunca va en los PDF.
 */
export interface CelularDelVisor {
  /** «987 654 321», o el número tal como está escrito si no es un celular peruano. */
  texto: string
  /** `tel:+51987654321` */
  llamar: string
  /** `https://wa.me/51987654321`; nulo si no es un celular peruano de 9 cifras que empiece por 9. */
  whatsapp: string | null
}

export interface PostulanteDelVisor {
  postulacionId: number
  /** Su lugar en esta lista (1, 2, 3…): arriba quienes tienen las tres notas, por su nota combinada. */
  puesto: number
  candidato: string
  grupo: string | null
  notaCv: number | null
  notaEvaluacion: number | null
  notaPrueba: number | null
  /** Nulo si no tiene ninguno o si la persona está anonimizada: entonces no sale nada. */
  celular?: CelularDelVisor | null
  /**
   * El ponderado que decide su lugar, sobre 100. Nulo si no tiene las tres notas o si quien
   * mira no puede ver alguna de ellas. Opcional: un backend anterior no lo manda.
   */
  ponderado?: number | null
}

export interface VisorDeLaVacante {
  vacanteId: number
  vacante: string | null
  puesto: string | null
  postulantes: PostulanteDelVisor[]
  /** Las etapas que quien pregunta puede ver. */
  etapas: CodigoDeEtapa[]
}

export const verInformesDelPostulante = (postulacionId: number) =>
  pedir<InformesDelPostulante>(`/postulaciones/${postulacionId}/informes`)

export const verInforme = (postulacionId: number, etapa: EtapaDelInforme) =>
  pedir<Informe>(`/postulaciones/${postulacionId}/informes/${etapa}`)

export const descargarInforme = (postulacionId: number, etapa: EtapaDelInforme): Promise<Archivo> =>
  pedirArchivo(`/postulaciones/${postulacionId}/informes/${etapa}/pdf`)

export const descargarInformesDelPostulante = (postulacionId: number): Promise<Archivo> =>
  pedirArchivo(`/postulaciones/${postulacionId}/informes/zip`)

export const verVisorDeLaVacante = (vacanteId: number) =>
  pedir<VisorDeLaVacante>(`/vacantes/${vacanteId}/informes`)

export const descargarInformesDeLaVacante = (vacanteId: number): Promise<Archivo> =>
  pedirArchivo(`/vacantes/${vacanteId}/informes/zip`)

/** Guarda un archivo que llegó del backend con el nombre que puso él (o el de reserva). */
export function guardarArchivo(archivo: Archivo, deReserva: string): void {
  const url = URL.createObjectURL(archivo.contenido)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = archivo.nombre ?? deReserva
  enlace.click()
  URL.revokeObjectURL(url)
}
