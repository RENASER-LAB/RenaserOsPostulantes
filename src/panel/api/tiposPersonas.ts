/**
 * Los tipos de la gestión de personas (V64): la sesión del menú, las sedes y
 * los cargos, y la ficha del colaborador.
 *
 * Copian los `record` de `DtosSeguridad`, `DtosEstructura` y `DtosColaborador`
 * del backend. Si cambian allá, cambian aquí.
 *
 * ⚠️ Las fechas de la ficha son `LocalDate` del backend: `'2026-09-29'`, un día
 * y no un instante. **Nunca pasan por `new Date()`**: a medianoche UTC ya es el
 * día anterior en Lima, y la fecha de ingreso saldría un día antes.
 */

import type { FechaIso } from './tipos'

/** `'2026-09-29'`: un día del calendario, sin hora ni zona. */
export type Dia = string

// ---------- La sesión del menú ----------

export interface PermisoDeLaSesion {
  codigo: string
  alcance: 'TODO' | 'SUS_VACANTES' | 'PROPIO'
}

export interface SesionDelPanel {
  usuarioId: number
  nombre: string | null
  correo: string | null
  organizacionId: number
  empresa: string | null
  permisos: PermisoDeLaSesion[]
}

// ---------- Sedes y cargos ----------

export interface SedePanel {
  id: number
  nombre: string
  direccion: string | null
  provinciaUbigeo: string | null
  provinciaNombre: string | null
  codigoSunat: string | null
  esActiva: boolean
}

export interface ListaDeSedes {
  puedeEditar: boolean
  sedes: SedePanel[]
}

export interface GuardarSede {
  nombre: string
  direccion: string | null
  provinciaUbigeo: string | null
  codigoSunat: string | null
}

export interface CargoPanel {
  id: number
  nombre: string
  nivelPuestoCodigo: string
  nivelNombre: string
  familiaCodigo: string
  familiaNombre: string
  esActivo: boolean
  /** Cuántas vacantes vivas lo usan: renombrar les cambia el nombre. */
  vacantes: number
  /** Cuántas personas lo tienen o lo tuvieron. */
  colaboradores: number
}

export interface ListaDeCargos {
  puedeEditar: boolean
  cargos: CargoPanel[]
}

export interface CrearCargo {
  nombre: string
  nivelPuestoCodigo: string
  familiaCodigo: string
}

// ---------- Los colaboradores ----------

export type EstadoLaboral = 'POR_INGRESAR' | 'ACTIVO' | 'CESADO'

export interface FilaColaborador {
  id: number
  nombreCompleto: string
  tipoDocumento: string
  tipoDocumentoNombre: string
  numeroDocumento: string
  cargo: string | null
  area: string | null
  sede: string | null
  jefeId: number | null
  jefe: string | null
  fechaIngreso: Dia
  finContrato: Dia | null
  fechaCese: Dia | null
  estado: EstadoLaboral
}

export interface PaginaColaboradores {
  filas: FilaColaborador[]
  total: number
  pagina: number
  tamano: number
  /** Si la empresa tiene alguno: separa «todavía no hay nadie» de «los filtros no dejan a nadie». */
  hayColaboradores: boolean
}

export interface FiltrosColaboradores {
  estados: EstadoLaboral[]
  sede: number | null
  area: number | null
  cargo: number | null
  porVencer: boolean
  q: string
  pagina: number
}

export interface Opcion {
  codigo: string
  nombre: string
}

export interface OpcionConId {
  id: number
  nombre: string
}

export interface OpcionesColaborador {
  tiposDocumento: Opcion[]
  sexos: Opcion[]
  estadosCiviles: Opcion[]
  nivelesEducativos: Opcion[]
  sedes: OpcionConId[]
  areas: OpcionConId[]
  cargos: OpcionConId[]
  tiposContrato: Opcion[]
  /** Los que exigen fecha de fin: a plazo y de temporada. */
  contratosConFin: string[]
  /** El que no la admite. */
  contratoIndeterminado: string
  regimenes: Opcion[]
  monedas: Opcion[]
  motivosCambio: Opcion[]
  motivosCese: Opcion[]
  puedeEditar: boolean
  puedeVerSueldos: boolean
}

export interface ContratadoPendiente {
  postulacionId: number
  nombre: string
  vacanteId: number
  vacante: string
  contratadoEn: FechaIso | null
}

export interface Precarga {
  postulacionId: number
  vacante: string
  nombres: string | null
  /** Los apellidos enteros: RR.HH. los separa a mano. */
  apellidoPaterno: string | null
  correoPersonal: string | null
  celular: string | null
  cargoId: number | null
  areaId: number | null
  /** Solo viaja con `ver_sueldos`. */
  sueldoBase?: number
  moneda?: string
  /** Si esa contratación ya tiene ficha. */
  colaboradorId: number | null
}

export interface DatosPersonales {
  tipoDocumento: string
  numeroDocumento: string
  nombres: string
  apellidoPaterno: string
  apellidoMaterno: string | null
  fechaNacimiento: Dia
  sexo: string
  estadoCivil: string | null
  nacionalidad: string | null
  celular: string | null
  correoPersonal: string | null
  correoCorporativo: string | null
  direccion: string | null
  provinciaUbigeo: string | null
  nivelEducativoCodigo: string | null
}

export interface DatosSituacion {
  sedeId: number
  areaId: number
  cargoId: number
  jefeId: number | null
  tipoContrato: string
  finContrato: Dia | null
  finPeriodoPrueba: Dia | null
  regimenLaboral: string
  /** Sin `ver_sueldos` no se manda: el backend lo ignora igual. */
  sueldoBase?: number | null
  moneda?: string | null
}

export interface AltaColaborador {
  persona: DatosPersonales
  fechaIngreso: Dia
  situacion: DatosSituacion
  postulacionId: number | null
}

export interface RegistrarCambio {
  vigenteDesde: Dia
  tipoMotivo: string
  detalle: string | null
  situacion: DatosSituacion
}

export interface RegistrarCese {
  fechaCese: Dia
  motivoCodigo: string
  observacion: string | null
}

export interface Reingreso {
  fechaIngreso: Dia
  situacion: DatosSituacion
  postulacionId: number | null
}

export interface Perfil {
  tipoDocumento: string
  tipoDocumentoNombre: string
  numeroDocumento: string
  nombres: string
  apellidoPaterno: string
  apellidoMaterno: string | null
  fechaNacimiento: Dia
  sexo: string
  sexoNombre: string
  estadoCivil: string | null
  estadoCivilNombre: string | null
  nacionalidad: string | null
  celular: string | null
  correoPersonal: string | null
  correoCorporativo: string | null
  direccion: string | null
  provinciaUbigeo: string | null
  provinciaNombre: string | null
  nivelEducativoCodigo: string | null
  nivelEducativoNombre: string | null
}

export interface Situacion {
  id: number
  vigenteDesde: Dia
  vigenteHasta: Dia | null
  sedeId: number
  sede: string | null
  sedeActiva: boolean
  areaId: number
  area: string | null
  areaActiva: boolean
  cargoId: number
  cargo: string | null
  cargoActivo: boolean
  jefeId: number | null
  jefe: string | null
  jefeCesado: boolean
  tipoContrato: string
  tipoContratoNombre: string
  finContrato: Dia | null
  finPeriodoPrueba: Dia | null
  regimenLaboral: string
  regimenNombre: string
  /** Solo viaja con `ver_sueldos`: sin él, la clave ni aparece. */
  sueldoBase?: number
  moneda?: string
  tipoMotivo: string
  tipoMotivoNombre: string
  detalleMotivo: string | null
  registradoPor: string | null
  registradoEn: FechaIso | null
}

export interface Periodo {
  id: number
  fechaIngreso: Dia
  fechaCese: Dia | null
  motivoCese: string | null
  motivoCeseNombre: string | null
  observacionCese: string | null
}

export interface Reporte {
  id: number
  nombre: string
}

export interface FichaColaborador {
  id: number
  nombreCompleto: string
  estado: EstadoLaboral
  perfil: Perfil
  /** La vacante de la que vino, si sigue existiendo; sin ella, solo el título. */
  vacanteId: number | null
  vacante: string | null
  situacion: Situacion | null
  periodo: Periodo
  programados: Situacion[]
  /** De dónde parte un cambio o un reingreso: la última del periodo. */
  base: Situacion | null
  /** Quién lo tiene hoy como jefe directo. */
  reportes: Reporte[]
  puedeEditar: boolean
  puedeVerSueldos: boolean
  puedeAnularCese: boolean
}

export interface CambioDeCampo {
  campo: string
  antes: string | null
  despues: string | null
}

export interface EntradaHistorial {
  tipo: 'INGRESO' | 'REINGRESO' | 'CAMBIO' | 'CESE' | 'CESE_ANULADO'
  fecha: Dia
  titulo: string
  cambios: CambioDeCampo[]
  motivo: string | null
  detalle: string | null
  registradoPor: string | null
  registradoEn: FechaIso | null
  programado: boolean
  anulado: boolean
  anuladoPor: string | null
  anuladoEn: FechaIso | null
  motivoAnulacion: string | null
}

export interface ErrorDeCarga {
  fila: number
  columna: string
  valor: string
  mensaje: string
}

export interface ResultadoCarga {
  altas: number
  actualizados: number
}
