/**
 * Los contratos del backend, copiados uno a uno.
 *
 * Cada tipo de aqui es un `record` de Java al otro lado. Si cambia alla, cambia
 * aqui. Las fechas llegan como texto ISO —lo que Jackson hace con un `Instant`—
 * y se convierten donde se usan, no aqui.
 *
 * Origen:
 *   portal/dto/DtosPortal.java
 *   perfilintegral/dto/DtosEvaluacion.java
 *   prueba/dto/DtosPrueba.java
 *   simulacion/dto/DtosSimulacion.java
 */

/** Una fecha y hora del servidor, en texto ISO 8601. */
export type FechaIso = string

// ---------- Vacantes y consentimientos ----------

export interface RequisitoPublico {
  id: number
  descripcion: string
}

export interface VacantePublica {
  id: number
  titulo: string
  descripcion: string | null
  proposito: string | null
  responsabilidades: string | null
  requisitos: string | null
  modalidad: string | null
  horario: string | null
  ubicacion: string | null
  compensacionPublica: string | null
  requisitosObjetivos: RequisitoPublico[]
}

export interface TextoConsentimientoPublico {
  tipo: string
  version: string
  texto: string
}

// ---------- Cuenta ----------

export interface CrearCuenta {
  nombre: string
  apellidos: string
  correo: string
  contrasena: string
  /** Obligatorio: sin esto no se puede postular. */
  aceptaProceso: boolean
  /** Opcional y distinto del anterior: entrar al Radar de Talento. */
  aceptaFuturosContactos?: boolean
}

export interface Login {
  correo: string
  contrasena: string
}

export interface Sesion {
  token: string
  usuarioId: number
}

export interface PedirBorrado {
  motivo?: string
}

// ---------- Postulaciones ----------

export interface MiPostulacion {
  uuid: string
  vacante: string
  /** Uno de los 18. Ver `dominio/estados.ts`. */
  estado: string
  estadoNombre: string
  /**
   * La clasificacion interna del equipo. Llega en la respuesta pero
   * NO se enseña al candidato.
   */
  grupoPrioridad: string | null
  diasSinCambio: number
  creadoEn: FechaIso
}

export interface PasoHistorial {
  estadoAnterior: string | null
  estadoNuevo: string
  fueElSistema: boolean
  ocurridaEn: FechaIso
}

export interface MiPostulacionDetalle {
  resumen: MiPostulacion
  historial: PasoHistorial[]
}

/** Lo que se manda al postular. Va como multipart, no como JSON. */
export interface DatosPostulacion {
  vacanteId: number
  cv: File
  resultadoOrgulloso: string
  portafolio?: string
  linkedin?: string
  github?: string
  requisitosConfirmados?: number[]
}

// ---------- Evaluacion (Perfil Integral) ----------

export interface OpcionCandidato {
  id: number
  letra: string
  texto: string
}

export interface PreguntaEvaluacion {
  id: number
  posicion: number
  /** `OPCION_MULTIPLE` o abierta. El tipo exacto lo define la plantilla. */
  tipo: string
  enunciado: string
  /** El contexto del caso. Puede no haberlo. */
  situacion: string | null
  opciones: OpcionCandidato[] | null
  respuestaTexto: string | null
  respuestaOpcionId: number | null
}

export interface EvaluacionCandidato {
  id: number
  estado: string
  venceEn: FechaIso | null
  iniciadaEn: FechaIso | null
  terminadaEn: FechaIso | null
  minutosObjetivo: number | null
  total: number
  respondidas: number
  preguntas: PreguntaEvaluacion[]
}

/** Una de las dos: `opcionId` para las de opcion, `texto` para las abiertas. */
export interface ResponderEvaluacion {
  opcionId?: number
  texto?: string
  /** Cuanto tardo. Sirve para detectar prisas, no para penalizar. */
  segundos?: number
}

export interface EntregaEvaluacion {
  estado: string
  respondidas: number
  total: number
}

// ---------- Prueba del puesto ----------

export interface PreguntaPrueba {
  id: number
  tipo: string
  enunciado: string
  respuestaTexto: string | null
}

export interface EntregableRequerido {
  id: number
  nombre: string
  detalle: string | null
  formato: string | null
  esObligatorio: boolean
  entregado: boolean
}

export type EstadoIntento = 'PENDIENTE' | 'EN_CURSO' | 'ENTREGADA'

export interface MiPrueba {
  id: number
  estadoIntento: EstadoIntento
  modalidad: string | null
  iniciadoEn: FechaIso | null
  /** La hora en que se acaba, segun el servidor. El cronometro sale de aqui. */
  venceEn: FechaIso | null
  duracionMinutos: number | null
  enunciado: string | null
  materiales: string | null
  herramientasPermitidas: string | null
  /** El cambio inesperado. Llega en `null` hasta que toca enseñarlo. */
  cambioTexto: string | null
  preguntas: PreguntaPrueba[]
  entregables: EntregableRequerido[]
}

export interface EntregaPrueba {
  estado: string
  completa: boolean
  faltantes: number
}

// ---------- Simulacion ----------

export interface SesionDisponible {
  id: number
  fechaHora: FechaIso
  duracionMinutos: number
  modalidad: string
  lugar: string | null
  enlace: string | null
  plazasLibres: number
}

export interface TramoSesion {
  codigo: string
  nombre: string
  minutoInicio: number
  minutoFin: number
}

export interface MiSesion {
  inscripcionId: number
  sesionId: number
  fechaHora: FechaIso
  duracionMinutos: number
  modalidad: string
  lugar: string | null
  enlace: string | null
  enunciado: string | null
  asistio: boolean | null
  tramos: TramoSesion[]
}
