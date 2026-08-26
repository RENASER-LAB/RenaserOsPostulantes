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
  /**
   * De quien es la vacante. El tablon mezcla empresas a proposito —es lo que
   * hace de esto una plataforma— y sin este nombre el candidato no sabria a
   * quien le esta mandando su curriculum.
   */
  nombreEmpresa: string
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

/**
 * El texto de tratamiento de datos de LA EMPRESA de una vacante.
 *
 * Distinto de `TextoConsentimientoPublico`, que son los de la plataforma —los
 * que se aceptan al crear la cuenta—. Este se acepta al postular, y hay uno
 * por empresa: la ley 29733 pide que se sepa quien va a tratar los datos, y
 * quien los trata es la empresa de la vacante, no Renaser.
 *
 * La ruta es publica a proposito: hay que poder leer lo que se acepta antes de
 * decidir postular.
 */
export interface ConsentimientoDeVacante {
  nombreEmpresa: string
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
  /**
   * De que empresa es este proceso.
   *
   * ⚠️ Se llama `empresa` a secas y en la vacante `nombreEmpresa`: son dos
   * `record` distintos del backend y aqui se copian tal cual, sin igualarlos.
   *
   * La cuenta es una sola, de la plataforma; los procesos son de cada empresa,
   * asi que «Mis procesos» mezcla varias y cada fila tiene que decir de quien es.
   */
  empresa: string
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
  /**
   * Aceptar que la empresa de esta vacante trate los datos. **Obligatorio**:
   * sin el, el backend responde 400 y no hay postulacion.
   *
   * Se firma con la version del texto, la fecha, la IP y el navegador, a nombre
   * de esta postulacion. Por eso es por vacante y no una sola vez en la cuenta.
   */
  aceptaTratamiento: boolean
}

// ---------- Evaluacion (Perfil Integral) ----------

export interface OpcionCandidato {
  id: number
  letra: string
  texto: string
}

/**
 * El detalle de una respuesta del banco v3.
 *
 * Es un objeto suelto —en la base viaja como `jsonb`— y **cada formato usa solo
 * sus claves**: un `EF-4` manda `mas` y `menos`, un `SEC` manda `orden`, y
 * ninguno manda las del otro. Por eso estan todas opcionales aqui en vez de ser
 * seis tipos distintos: lo que decide cual toca es `pregunta.tipo`, y de armar
 * el envio se encarga `paginas/evaluacion/bancoV3.ts`.
 *
 * La forma exacta la comprueba el backend en `ValidadorDetalleV3`; si no
 * cuadra, responde 400.
 */
export interface DetalleRespuesta {
  /** EF-4: la opcion que mas se parece al candidato. */
  mas?: number
  /** EF-4: la que menos. Tiene que ser distinta de `mas`. */
  menos?: number
  /** SJT-R: id de opcion (como cadena) contra su nota, del 1 al 5. */
  calificaciones?: Record<string, number>
  /** SEC: los ids de todas las opciones, en el orden que eligio. */
  orden?: number[]
  /** INV y DE: los ids que marco. Vacio significa «ninguna», y es respuesta. */
  marcadas?: number[]
  /** CD: numero de campo (como cadena) contra lo que escribio. */
  campos?: Record<string, string>
}

/** CD: un campo del caso, con la etiqueta que ve el candidato. */
export interface CampoCasoCandidato {
  orden: number
  etiqueta: string
}

export interface PreguntaEvaluacion {
  id: number
  posicion: number
  /**
   * El formato del item. Los ocho del banco v3 —`EF-4`, `SJT-R`, `SEC`, `INV`,
   * `DE`, `CD`, `V`, `PC`— mas `OPCION_MULTIPLE` y las abiertas del banco viejo.
   */
  tipo: string
  enunciado: string
  /** El contexto del caso. Puede no haberlo. */
  situacion: string | null
  opciones: OpcionCandidato[] | null
  respuestaTexto: string | null
  respuestaOpcionId: number | null
  /**
   * Lo respondido en los formatos que necesitan detalle, para poder repintarlo
   * al volver. Un examen de 190 preguntas no se hace de una sentada.
   *
   * Opcional a proposito: el backend todavia no lo devuelve en todas partes, y
   * sin el la pantalla tiene que seguir funcionando —solo que sin recordar—.
   */
  respuestaDetalle?: DetalleRespuesta | null
  /** CD: los campos del caso. Opcional mientras el backend no los mande. */
  campos?: CampoCasoCandidato[] | null
  /** CD: cuantos campos pide el caso, cuando no vienen sus etiquetas. */
  casosPedidos?: number | null
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

/**
 * Una de las tres: `opcionId` para las de opcion unica (`PC`), `texto` para las
 * abiertas y los datos sueltos (`V`), y `detalle` para los seis formatos del
 * banco v3 que necesitan mandar mas de un valor.
 */
export interface ResponderEvaluacion {
  opcionId?: number
  texto?: string
  detalle?: DetalleRespuesta
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

// ---------- Perfil del candidato ----------

/**
 * Quien puso este dato.
 *
 * `PERSONA` lo escribio el candidato. `CURRICULUM` lo dedujo un modelo de
 * lenguaje leyendo su archivo, y **eso no es lo mismo que haberlo dicho**: puede
 * tener mal las fechas, el cargo o el nombre de la empresa.
 *
 * Va siempre junto a `confirmado`, y de la pareja salen tres estados reales
 * —no cuatro—, porque crear o editar cualquier fila la deja en `PERSONA` y
 * confirmada a la vez:
 *
 *   PERSONA + confirmado       lo escribio la persona
 *   CURRICULUM sin confirmar   lo dedujo la IA y **nadie lo ha verificado**
 *   CURRICULUM + confirmado    salio del archivo y la persona lo dio por bueno
 */
export type OrigenDelDato = 'PERSONA' | 'CURRICULUM'

/** Lo que comparten las cuatro listas que llevan origen. Los enlaces no. */
export interface ConOrigen {
  origen: OrigenDelDato
  confirmado: boolean
}

export interface Pretension {
  min: number
  max: number
  moneda: string
}

export interface ExperienciaPerfil extends ConOrigen {
  id: number
  puesto: string
  empresa: string
  desde: string
  /** `null` significa «sigo aqui», no que falte el dato. */
  hasta: string | null
  descripcion: string | null
}

export interface EducacionPerfil extends ConOrigen {
  id: number
  titulo: string
  institucion: string
  nivelCodigo: string | null
  desde: string | null
  hasta: string | null
  enCurso: boolean
}

export interface IdiomaPerfil extends ConOrigen {
  id: number
  idioma: string
  nivelCodigo: string
}

export interface CertificacionPerfil extends ConOrigen {
  id: number
  nombre: string
  entidad: string | null
  emitidaEn: string | null
  /** `null` significa que no caduca. */
  venceEn: string | null
}

/** Los enlaces no llevan origen: una direccion no es algo que un modelo deduzca. */
export interface EnlacePerfil {
  id: number
  tipo: string
  url: string
}

/** En que punto esta la lectura del ultimo curriculum. */
export type EstadoLecturaCv = 'SIN_CV' | 'EN_CURSO' | 'LISTA' | 'NO_LEGIBLE'

export interface LecturaCv {
  estado: EstadoLecturaCv
  actualizadoEn: FechaIso | null
}

export interface PerfilCompleto {
  titular: string | null
  resumen: string | null
  habilidades: string[]
  experienciaMeses: number | null
  ubicacion: string | null
  disponibilidad: string | null
  /**
   * ⚠️ En el panel, **sin el permiso `ver_pretension` este campo NO viaja, ni
   * como `null`**: el nombre del campo ya delataria que hay una pretension que
   * no puedes ver. Se pregunta con `'pretension' in perfil`, nunca comparando
   * contra `null`, o «sin permiso» se lee como «no puso pretension».
   */
  pretension?: Pretension | null
  experiencia: ExperienciaPerfil[]
  educacion: EducacionPerfil[]
  idiomas: IdiomaPerfil[]
  certificaciones: CertificacionPerfil[]
  enlaces: EnlacePerfil[]
  lecturaCv: LecturaCv
}

/**
 * ⚠️ **Es un PUT y reemplaza la cabecera entera.** Un campo que no se mande se
 * guarda vacio, no se conserva: se parte siempre de lo que devolvio el GET.
 *
 * La pretension es todo o nada: o van `min`, `max` y `moneda`, o va `null`.
 */
export interface EditarCabeceraPerfil {
  titular: string | null
  resumen: string | null
  habilidades: string[]
  /** Entre 0 y 720. Fuera de ahi, 400. */
  experienciaMeses: number | null
  ubicacion: string | null
  disponibilidad: string | null
  pretension: Pretension | null
}

export interface EditarExperiencia {
  puesto: string
  empresa: string
  desde: string
  hasta: string | null
  descripcion: string | null
}

export interface EditarEducacion {
  titulo: string
  institucion: string
  nivelCodigo: string | null
  desde: string | null
  hasta: string | null
  enCurso: boolean
}

export interface EditarIdioma {
  idioma: string
  nivelCodigo: string
}

export interface EditarCertificacion {
  nombre: string
  entidad: string | null
  emitidaEn: string | null
  venceEn: string | null
}

export interface EditarEnlace {
  tipo: string
  url: string
}

export interface OpcionCatalogo {
  codigo: string
  nombre: string
}
