/**
 * Los formularios de la ficha del colaborador: su estado, sus reglas y cómo se
 * convierten en lo que pide la API.
 *
 * Las reglas son las mismas que valida el backend (`ReglasDelColaborador`), y
 * se repiten aquí solo para avisar antes de enviar: quien decide sigue siendo
 * el servidor. Qué campos llevan asterisco sale de estas mismas reglas
 * (`OBLIGATORIOS_*`), no de una lista escrita aparte en la pantalla.
 */

import type {
  DatosPersonales,
  DatosSituacion,
  Dia,
  OpcionesColaborador,
  Perfil,
  Precarga,
  Situacion,
} from '../api/tiposPersonas'
import { diasEntre, hoyEnLima } from './fechas'

export const DNI = '01'

// ---------- Lo personal ----------

export interface FormPersona {
  tipoDocumento: string
  numeroDocumento: string
  nombres: string
  apellidoPaterno: string
  apellidoMaterno: string
  fechaNacimiento: string
  sexo: string
  estadoCivil: string
  nacionalidad: string
  celular: string
  correoPersonal: string
  correoCorporativo: string
  direccion: string
  provinciaUbigeo: string
  nivelEducativoCodigo: string
}

export const OBLIGATORIOS_PERSONA: ReadonlySet<keyof FormPersona> = new Set([
  'tipoDocumento',
  'numeroDocumento',
  'nombres',
  'apellidoPaterno',
  'fechaNacimiento',
  'sexo',
])

export function personaVacia(): FormPersona {
  return {
    tipoDocumento: DNI,
    numeroDocumento: '',
    nombres: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    fechaNacimiento: '',
    sexo: '',
    estadoCivil: '',
    nacionalidad: 'Peruana',
    celular: '',
    correoPersonal: '',
    correoCorporativo: '',
    direccion: '',
    provinciaUbigeo: '',
    nivelEducativoCodigo: '',
  }
}

export function personaDesdePrecarga(precarga: Precarga): FormPersona {
  return {
    ...personaVacia(),
    nombres: precarga.nombres ?? '',
    apellidoPaterno: precarga.apellidoPaterno ?? '',
    correoPersonal: precarga.correoPersonal ?? '',
    celular: precarga.celular ?? '',
  }
}

export function personaDesdePerfil(p: Perfil): FormPersona {
  return {
    tipoDocumento: p.tipoDocumento,
    numeroDocumento: p.numeroDocumento,
    nombres: p.nombres,
    apellidoPaterno: p.apellidoPaterno,
    apellidoMaterno: p.apellidoMaterno ?? '',
    fechaNacimiento: p.fechaNacimiento,
    sexo: p.sexo,
    estadoCivil: p.estadoCivil ?? '',
    nacionalidad: p.nacionalidad ?? '',
    celular: p.celular ?? '',
    correoPersonal: p.correoPersonal ?? '',
    correoCorporativo: p.correoCorporativo ?? '',
    direccion: p.direccion ?? '',
    provinciaUbigeo: p.provinciaUbigeo ?? '',
    nivelEducativoCodigo: p.nivelEducativoCodigo ?? '',
  }
}

/** El número como lo guarda el backend: sin espacios, puntos ni guiones. */
export function limpiarDocumento(numero: string): string {
  return numero.replace(/[\s.-]/g, '').toUpperCase()
}

const nulo = (texto: string) => (texto.trim() === '' ? null : texto.trim())

export function personaParaLaApi(f: FormPersona): DatosPersonales {
  return {
    tipoDocumento: f.tipoDocumento,
    numeroDocumento: limpiarDocumento(f.numeroDocumento),
    nombres: f.nombres.trim(),
    apellidoPaterno: f.apellidoPaterno.trim(),
    apellidoMaterno: nulo(f.apellidoMaterno),
    fechaNacimiento: f.fechaNacimiento,
    sexo: f.sexo,
    estadoCivil: nulo(f.estadoCivil),
    nacionalidad: nulo(f.nacionalidad),
    celular: nulo(f.celular),
    correoPersonal: nulo(f.correoPersonal),
    correoCorporativo: nulo(f.correoCorporativo),
    direccion: nulo(f.direccion),
    provinciaUbigeo: nulo(f.provinciaUbigeo),
    nivelEducativoCodigo: nulo(f.nivelEducativoCodigo),
  }
}

export type Errores = Partial<Record<string, string>>

const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function erroresDePersona(f: FormPersona, hoy: Dia = hoyEnLima()): Errores {
  const e: Errores = {}
  const numero = limpiarDocumento(f.numeroDocumento)
  if (numero === '') e.numeroDocumento = 'Escribe el número de documento.'
  else if (f.tipoDocumento === DNI && !/^\d{8}$/.test(numero)) e.numeroDocumento = 'El DNI tiene que tener 8 dígitos.'
  else if (f.tipoDocumento !== DNI && !/^[A-Z0-9]{4,15}$/.test(numero)) {
    e.numeroDocumento = 'Este documento admite de 4 a 15 letras o dígitos.'
  }
  if (f.nombres.trim() === '') e.nombres = 'Escribe los nombres.'
  if (f.apellidoPaterno.trim() === '') e.apellidoPaterno = 'Escribe el apellido paterno.'
  if (f.fechaNacimiento === '') e.fechaNacimiento = 'Indica la fecha de nacimiento.'
  else if (diasEntre(hoy, f.fechaNacimiento) > 0) e.fechaNacimiento = 'La fecha de nacimiento no puede ser futura.'
  else if (!tieneAlMenos(f.fechaNacimiento, 14, hoy)) e.fechaNacimiento = 'Tiene que tener al menos 14 años.'
  if (f.sexo === '') e.sexo = 'Elige una opción.'
  if (f.correoPersonal.trim() !== '' && !CORREO.test(f.correoPersonal.trim())) {
    e.correoPersonal = 'Ese correo no parece válido.'
  }
  if (f.correoCorporativo.trim() !== '' && !CORREO.test(f.correoCorporativo.trim())) {
    e.correoCorporativo = 'Ese correo no parece válido.'
  }
  return e
}

function tieneAlMenos(nacimiento: Dia, anos: number, hoy: Dia): boolean {
  const [a, m, d] = nacimiento.split('-').map(Number)
  const cumple = `${String((a ?? 0) + anos).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  return diasEntre(cumple, hoy) >= 0
}

// ---------- Dónde y en qué condiciones ----------

export interface FormSituacion {
  sedeId: string
  areaId: string
  cargoId: string
  jefeId: number | null
  jefeNombre: string | null
  tipoContrato: string
  finContrato: string
  finPeriodoPrueba: string
  regimenLaboral: string
  sueldoBase: string
  moneda: string
}

export const OBLIGATORIOS_SITUACION: ReadonlySet<keyof FormSituacion> = new Set([
  'sedeId',
  'areaId',
  'cargoId',
  'tipoContrato',
  'regimenLaboral',
])

export function situacionVacia(): FormSituacion {
  return {
    sedeId: '',
    areaId: '',
    cargoId: '',
    jefeId: null,
    jefeNombre: null,
    tipoContrato: '',
    finContrato: '',
    finPeriodoPrueba: '',
    regimenLaboral: '01',
    sueldoBase: '',
    moneda: 'PEN',
  }
}

export function situacionDesde(s: Situacion): FormSituacion {
  return {
    sedeId: String(s.sedeId),
    areaId: String(s.areaId),
    cargoId: String(s.cargoId),
    jefeId: s.jefeId,
    jefeNombre: s.jefe,
    tipoContrato: s.tipoContrato,
    finContrato: s.finContrato ?? '',
    finPeriodoPrueba: s.finPeriodoPrueba ?? '',
    regimenLaboral: s.regimenLaboral,
    sueldoBase: s.sueldoBase == null ? '' : String(s.sueldoBase),
    moneda: s.moneda ?? 'PEN',
  }
}

export function situacionParaLaApi(f: FormSituacion, conSueldo: boolean): DatosSituacion {
  const datos: DatosSituacion = {
    sedeId: Number(f.sedeId),
    areaId: Number(f.areaId),
    cargoId: Number(f.cargoId),
    jefeId: f.jefeId,
    tipoContrato: f.tipoContrato,
    finContrato: f.finContrato === '' ? null : f.finContrato,
    finPeriodoPrueba: f.finPeriodoPrueba === '' ? null : f.finPeriodoPrueba,
    regimenLaboral: f.regimenLaboral,
  }
  // Sin ver_sueldos no se manda: el backend lo ignoraría igual, y así no viaja.
  if (conSueldo) {
    datos.sueldoBase = f.sueldoBase.trim() === '' ? null : Number(f.sueldoBase.replace(',', '.'))
    datos.moneda = f.sueldoBase.trim() === '' ? null : f.moneda
  }
  return datos
}

/** Las reglas del contrato contra la fecha de ingreso del periodo. */
export function erroresDeSituacion(
  f: FormSituacion,
  ingreso: Dia | '',
  opciones: Pick<OpcionesColaborador, 'contratosConFin' | 'contratoIndeterminado'>,
  conSueldo: boolean,
): Errores {
  const e: Errores = {}
  if (f.sedeId === '') e.sedeId = 'Elige la sede.'
  if (f.areaId === '') e.areaId = 'Elige el área.'
  if (f.cargoId === '') e.cargoId = 'Elige el cargo.'
  if (f.tipoContrato === '') e.tipoContrato = 'Elige el tipo de contrato.'
  if (f.regimenLaboral === '') e.regimenLaboral = 'Elige el régimen laboral.'
  if (opciones.contratosConFin.includes(f.tipoContrato) && f.finContrato === '') {
    e.finContrato = 'Este tipo de contrato necesita la fecha de fin.'
  }
  if (f.tipoContrato === opciones.contratoIndeterminado && f.finContrato !== '') {
    e.finContrato = 'Un contrato a plazo indeterminado no lleva fecha de fin.'
  }
  if (!e.finContrato && f.finContrato !== '' && ingreso !== '' && diasEntre(ingreso, f.finContrato) <= 0) {
    e.finContrato = 'El fin del contrato tiene que ser posterior a la fecha de ingreso.'
  }
  if (f.finPeriodoPrueba !== '' && ingreso !== '' && diasEntre(ingreso, f.finPeriodoPrueba) <= 0) {
    e.finPeriodoPrueba = 'El fin del periodo de prueba tiene que ser posterior a la fecha de ingreso.'
  }
  if (conSueldo && f.sueldoBase.trim() !== '') {
    const monto = Number(f.sueldoBase.replace(',', '.'))
    if (!Number.isFinite(monto)) e.sueldoBase = 'El sueldo tiene que ser un número.'
    else if (monto < 0) e.sueldoBase = 'El sueldo no puede ser negativo.'
  }
  return e
}

/** Lleva el foco al primer campo marcado con error, que es lo que se lee primero. */
export function enfocarElPrimerError(contenedor: HTMLElement | null): void {
  window.setTimeout(() => {
    contenedor?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, 0)
}
