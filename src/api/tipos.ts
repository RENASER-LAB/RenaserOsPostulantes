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

/**
 * La ciudad de una vacante, como la lee el portal: el código —lo que viaja en la
 * dirección al filtrar—, el nombre y el departamento, por si dos se llamaran igual.
 * `EXT` («Fuera del Perú») sale con el departamento vacío.
 */
export interface CiudadPublica {
  codigo: string
  nombre: string
  departamento: string | null
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
  /** La zona o referencia: barrio, distrito o dirección. Hasta la V62 era «la ubicación». */
  ubicacion: string | null
  /** La ciudad del catálogo, o `null` si la vacante no la dice (V62). */
  ciudad: CiudadPublica | null
  /** Cuándo se publicó. Puede faltar: se fija al publicar y las viejas no siempre la tienen. */
  publicadaEn: FechaIso | null
  remuneracion: RemuneracionPublica
  requisitosObjetivos: RequisitoPublico[]
}

/**
 * Lo que una vacante paga, tal como el candidato puede verlo.
 *
 * ⚠️ **`OCULTA` viaja igual, no llega como `null`.** El portal tiene que decir
 * en voz alta que la empresa no publica el sueldo: un hueco donde deberia estar
 * el numero se lee como un fallo de carga. Y ademas es el dato que explica por
 * que el formulario de postular no le va a exigir declarar el suyo.
 *
 * `texto` llega **ya escrito** desde el servidor —«S/ 3 500 a 4 200»— para que
 * la frase del dinero se arme una sola vez y el portal, el panel y el correo
 * digan exactamente lo mismo. Los montos sueltos siguen ahi para quien quiera
 * pintarlos de otra forma; la regla de la casa es preferir `texto`.
 */
export interface RemuneracionPublica {
  tipo: 'OCULTA' | 'FIJA' | 'RANGO'
  /** Con `FIJA`, este es EL monto. Con `RANGO`, el suelo. */
  min: number | null
  /** Solo con `RANGO`. */
  max: number | null
  moneda: string | null
  texto: string
  /**
   * Cuando cambio por ultima vez. `null` = nunca desde que se publico.
   *
   * Es lo que pinta el «actualizado el …» junto al monto. Quien postulo con
   * otro numero delante merece enterarse de que cambio, y no descubrirlo en la
   * negociacion.
   */
  actualizadaEn: FechaIso | null
}

/**
 * Uno de los dos textos legales **de la plataforma**: el `PLATAFORMA` que se
 * acepta al crear la cuenta y el `FUTUROS_CONTACTOS` opcional.
 *
 * Los usa la pantalla de registro y tambien la politica publica, que los enseña
 * enteros en vez de reescribirlos: un documento copiado a mano se desvia del que
 * la gente firma de verdad, y el que vale es el firmado.
 */
export interface TextoConsentimientoPublico {
  tipo: string
  version: string
  texto: string
}

/**
 * El texto de tratamiento de datos **compuesto para una vacante**.
 *
 * Es el mismo texto para todas las empresas —uno solo, de la plataforma— con el
 * nombre de la que publica esa vacante ya puesto dentro. La ley 29733 pide que se
 * sepa quien va a tratar los datos, y quien los trata es la empresa de la vacante,
 * no Renaser; lo que no hace falta es que cada una tenga su propio texto.
 *
 * La ruta es publica a proposito: hay que poder leer lo que se acepta antes de
 * decidir postular, y sin cuenta.
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
  /**
   * Donde vive: el ubigeo de nivel 2 —la provincia—, o `EXT` si es fuera del
   * pais. Obligatorio, y el backend lo valida contra su catalogo: un codigo que
   * no exista sale con 400.
   *
   * ⚠️ **Solo se pide al crear la cuenta.** A quien ya tiene cuenta no se le
   * pregunta nunca, asi que el panel tiene que contar con que casi ninguna
   * postulacion vieja trae ciudad.
   */
  ciudadUbigeo: string
  /**
   * Obligatorio: sin esto no hay cuenta.
   *
   * Es el permiso que se firma **con Renaser**, y cubre la cuenta, el perfil, la
   * inteligencia artificial, los proveedores de fuera del pais y el plazo de
   * conservacion. Se llamaba `aceptaProceso` y firmaba el texto de una vacante
   * que en el registro todavia no existe; el de la vacante se firma al postular.
   */
  aceptaPlataforma: boolean
  /** Opcional y distinto del anterior: que te avisen de futuras vacantes. */
  aceptaFuturosContactos?: boolean
}

/**
 * Una provincia del catalogo de ubigeo, para el desplegable del registro.
 *
 * ⚠️ **Un solo desplegable agrupado por departamento**, no dos encadenados: son
 * 196 provincias, caben en un `<select>` con `<optgroup>`, y encadenar dos
 * obliga a esperar una peticion entre el primero y el segundo.
 *
 * `departamento` viene nulo en el unico codigo que no es de ningun sitio del
 * Peru: `EXT`, el extranjero.
 */
export interface OpcionUbigeo {
  codigo: string
  nombre: string
  departamento: string | null
}

export interface Login {
  correo: string
  contrasena: string
}

/**
 * Pedir el enlace de contraseña nueva. `DtosPortal.PedirRecuperacion`.
 *
 * La respuesta es un 202 vacío siempre, exista o no la cuenta: no hay tipo de
 * vuelta porque no hay nada que leer.
 */
export interface PedirRecuperacion {
  correo: string
}

/**
 * Elegir la contraseña nueva con el token del enlace. `DtosPortal.RestablecerClave`.
 * 204 si cambió; 401 si el enlace no sirve, sin decir por qué; 400 si la
 * contraseña no cumple una regla o es la misma de antes.
 */
export interface RestablecerClave {
  token: string
  contrasena: string
}

/**
 * Como se llama quien ya tiene token. Sin token dentro: quien pregunta ya lo tiene.
 *
 * Lo pide el portal cuando arranca con una sesion guardada y sin nombre — la
 * segunda visita, otro navegador, o el almacenamiento vaciado.
 */
export interface QuienSoy {
  usuarioId: number
  nombre: string | null
  apellidos: string | null
}

export interface Sesion {
  token: string
  usuarioId: number
  /**
   * Como se llama quien entra. **Puede venir vacio**: `persona` los admite en
   * null, y una cuenta creada por un script puede no tenerlos.
   *
   * ⚠️ Antes esto no existia y el portal guardaba el nombre en `localStorage` al
   * registrarse: quien entraba desde otro navegador —o por el enlace del correo,
   * sin haberse registrado nunca— veia el portal sin su nombre.
   */
  nombre: string | null
  apellidos: string | null
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
  /**
   * Qué rendirá cuando le toque la etapa de la prueba: `PLANTILLA` (la prueba del puesto,
   * con su enunciado y lo que hay que entregar) o `CUESTIONARIO_TECNICO` (preguntas
   * escritas para esa vacante).
   *
   * ⚠️ Los dos comparten los MISMOS estados, así que sin este dato el portal no sabe a qué
   * pantalla llevarlo. Puede venir nulo contra un backend anterior: entonces se trata como
   * la prueba de siempre, que es lo que hacían todas las vacantes.
   */
  instrumentoEtapaTecnica: string | null
  /**
   * Cuantos avisos de ESTE proceso siguen sin ver. Cero = sin punto.
   *
   * Es lo que enciende el punto de la fila en «Mis procesos». Se apaga al abrir
   * la campana, no al abrir la postulacion: enterarse de que hay algo es lo que
   * lo apaga.
   */
  avisosSinLeer: number
  /** Lo que la vacante paga HOY, con la marca de cuando cambio. */
  remuneracion: RemuneracionPublica
  /**
   * Lo que EL dijo que queria ganar al postular aqui.
   *
   * ⚠️ **`null` no significa que no quisiera decirlo.** Significa que la vacante
   * tenia el sueldo oculto y no se le exigio —el trato cumpliendose— o que
   * postulo antes de que esto existiera. Quien lo pinte tiene que decirlo con
   * esas palabras, nunca con un guion a secas.
   *
   * Es SUYO, asi que en el portal viaja siempre. En el panel hace falta el
   * permiso `ver_pretension`.
   */
  miPretension: PretensionDeclarada | null
}

/** Un monto con su moneda, y la frase ya escrita para pintarla sin traducir. */
export interface PretensionDeclarada {
  monto: number
  moneda: string
  texto: string
}

/**
 * Un aviso de la campana.
 *
 * El texto va **ya armado** y no se reconstruye al leerlo: un aviso que dijera
 * el sueldo de hoy en vez del que cambio aquel dia dejaria de ser la noticia
 * para volverse un espejo del estado actual.
 */
export interface AvisoDelPortal {
  id: number
  /**
   * Que clase de noticia es.
   *
   * `REMUNERACION_ACTUALIZADA` es el cambio de sueldo hecho desde la tarjeta del
   * panel; `VACANTE_ACTUALIZADA` es el guardado del formulario de la vacante,
   * con todo lo que cambio —sueldo incluido— en un solo aviso.
   */
  tipo: string
  titulo: string
  cuerpo: string
  /** A donde lleva al pulsarlo. Puede faltar: no todo aviso cuelga de un proceso. */
  postulacionUuid: string | null
  vacanteId: number | null
  leidoEn: FechaIso | null
  creadoEn: FechaIso
}

export interface MisAvisos {
  /**
   * El numero del punto. Sale de la consulta y no de contar la lista: la lista
   * podria venir recortada algun dia, y entonces el punto diria de menos.
   */
  sinLeer: number
  avisos: AvisoDelPortal[]
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
  /**
   * El curriculum de ESTA postulacion.
   *
   * **Vacio significa «usa el de mi perfil»**, que es lo normal para quien ya lo
   * subio una vez. Adjuntar uno lo usa solo para esta vacante: **el del perfil
   * no cambia**. Sin ninguno de los dos, el backend responde 400.
   */
  cv: File | null
  resultadoOrgulloso: string
  portafolio?: string
  linkedin?: string
  github?: string
  requisitosConfirmados?: number[]
  /**
   * Cuanto quiere ganar en ESTA vacante.
   *
   * ⚠️ **Obligatorio si la vacante publica lo que paga**, ignorado si no. Es el
   * trato: la empresa ensena su presupuesto, el candidato ensena su precio, y
   * pedirselo a quien no ha recibido nada a cambio seria el desequilibrio que
   * esto vino a romper.
   */
  pretensionMonto?: number
  pretensionMoneda?: string
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
  /** Si adjunto el diploma. Se abre con `/perfil/certificaciones/{id}/archivo`. */
  tieneArchivo: boolean
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
  /**
   * Si tiene foto. La imagen se pide aparte, a `/perfil/foto`, porque un
   * `<img src>` no manda el token: se baja como blob.
   *
   * ⚠️ **Solo la ve el candidato.** No viaja al panel del equipo ni a la IA
   * (RF-41): decidido el 05/09/2026.
   */
  tieneFoto: boolean
  portada: PortadaDelPerfil
  /** Su curriculum guardado, el que se reutiliza al postular. Null si no tiene. */
  cv: CurriculumDelPerfil | null
}

/** O una del catalogo de la casa, o la suya, o ninguna. Nunca dos. */
export interface PortadaDelPerfil {
  tipo: 'GALERIA' | 'PROPIA' | 'NINGUNA'
  /** Solo con `GALERIA`. Los cinco codigos estan en `PORTADAS_DE_LA_CASA`. */
  codigo: string | null
}

export interface CurriculumDelPerfil {
  nombre: string
  tamano: number
  subidoEn: FechaIso
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
