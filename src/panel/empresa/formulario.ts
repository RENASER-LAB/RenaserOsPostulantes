/**
 * El formulario de la pestaña «Perfil» de «Perfil de la empresa» (V85): lo que
 * hay en la mano, cómo se comprueba antes de enviar y qué se manda.
 *
 * La plantilla y el color del brochure no van aquí: la pestaña «Brochure» los
 * guarda solos al elegirlos, y ni cuentan como cambio sin guardar ni viajan con
 * «Guardar».
 *
 * Las reglas y las frases son las del backend (`ReglasDeLaPresentacion`), y las
 * claves de los errores también —`paginaWeb`, `videoPresentacion`, `INSTAGRAM`…—
 * para que un 400 del servidor se pinte en el mismo campo que el error de aquí.
 */

import type { CodigoDeRed } from '@/api/tipos'
import {
  ANIO_MINIMO,
  MAXIMO_BENEFICIO,
  MAXIMO_BENEFICIOS,
  MAXIMO_MISION,
  MAXIMO_SECTOR,
  MAXIMO_TEXTO_LARGO,
  MENSAJE_MISION,
  MENSAJE_PROPOSITO,
  MENSAJE_VISION,
  REDES,
  errorDeLaRed,
  errorDelEnlace,
  errorDelVideo,
  mensajeAnio,
  normalizarEnlace,
} from '@/dominio/presentacionEmpresa'
import type { GuardarPresentacion, PresentacionPanel } from '../api/presentacion'

export const MENSAJE_CORRIGE = 'No se guardó nada. Corrige los campos marcados.'
export const MENSAJE_GUARDADO = 'Guardado. Tu perfil y tus vacantes publicadas ya lo muestran.'
export const MENSAJE_SIN_RED = 'No se pudo guardar.'

export interface Formulario {
  sector: string
  tamano: string
  /** Tal como se escribe: solo cifras, hasta cuatro. */
  anioFundacion: string
  quienesSomos: string
  propositoEmpresa: string
  beneficios: string[]
  videoPresentacion: string
  paginaWeb: string
  redes: Record<CodigoDeRed, string>
  /** Misión y visión (V86): hasta 400 caracteres; vacías no salen en ningún sitio. */
  mision: string
  vision: string
}

const SIN_REDES: Record<CodigoDeRed, string> = {
  FACEBOOK: '',
  INSTAGRAM: '',
  LINKEDIN: '',
  TIKTOK: '',
  YOUTUBE: '',
}

/** Lo guardado, traído al formulario: los nulos como cadenas vacías. */
export function desdeLoGuardado(p: PresentacionPanel | null | undefined): Formulario {
  const redes = { ...SIN_REDES }
  for (const red of REDES) redes[red.codigo] = p?.redes?.[red.codigo] ?? ''
  return {
    sector: p?.sector ?? '',
    tamano: p?.tamano ?? '',
    anioFundacion: p?.anioFundacion ? String(p.anioFundacion) : '',
    quienesSomos: p?.quienesSomos ?? '',
    propositoEmpresa: p?.propositoEmpresa ?? '',
    beneficios: [...(p?.beneficios ?? [])],
    videoPresentacion: p?.videoPresentacion ?? '',
    paginaWeb: p?.paginaWeb ?? '',
    redes,
    mision: p?.mision ?? '',
    vision: p?.vision ?? '',
  }
}

/** Todos los errores a la vez, con las claves del backend. Vacío si todo vale. */
export function erroresDelFormulario(f: Formulario, anioActual: number): Record<string, string> {
  const errores: Record<string, string> = {}
  if (f.sector.trim().length > MAXIMO_SECTOR) errores.sector = 'El sector admite hasta 60 caracteres'
  const anio = f.anioFundacion.trim()
  if (anio !== '' && (!/^\d{4}$/.test(anio) || Number(anio) < ANIO_MINIMO || Number(anio) > anioActual)) {
    errores.anioFundacion = mensajeAnio(anioActual)
  }
  if (f.quienesSomos.trim().length > MAXIMO_TEXTO_LARGO) {
    errores.quienesSomos = '«Quiénes somos» admite hasta 1500 caracteres'
  }
  if (f.propositoEmpresa.trim().length > MAXIMO_TEXTO_LARGO) errores.propositoEmpresa = MENSAJE_PROPOSITO
  if (f.mision.trim().length > MAXIMO_MISION) errores.mision = MENSAJE_MISION
  if (f.vision.trim().length > MAXIMO_MISION) errores.vision = MENSAJE_VISION
  const beneficios = beneficiosLimpios(f.beneficios)
  if (beneficios.length > MAXIMO_BENEFICIOS) errores.beneficios = 'Puedes añadir hasta 12 beneficios'
  else if (beneficios.some((b) => b.length > MAXIMO_BENEFICIO)) {
    errores.beneficios = 'Cada beneficio admite hasta 40 caracteres'
  }
  const video = errorDelVideo(normalizarEnlace(f.videoPresentacion))
  if (video) errores.videoPresentacion = video
  const web = errorDelEnlace(normalizarEnlace(f.paginaWeb))
  if (web) errores.paginaWeb = web
  for (const red of REDES) {
    const error = errorDeLaRed(red.codigo, normalizarEnlace(f.redes[red.codigo]))
    if (error) errores[red.codigo] = error
  }
  return errores
}

/** Sin vacíos ni repetidos (sin mirar mayúsculas), en su orden. */
export function beneficiosLimpios(lista: string[]): string[] {
  const vistos = new Set<string>()
  const limpios: string[] = []
  for (const crudo of lista) {
    const b = crudo.trim()
    if (b === '' || vistos.has(b.toLowerCase())) continue
    vistos.add(b.toLowerCase())
    limpios.push(b)
  }
  return limpios
}

/** Añade un beneficio si cabe y no está ya. Devuelve la lista, igual si no cabe. */
export function anadirBeneficio(lista: string[], nuevo: string): string[] {
  const b = nuevo.trim().slice(0, MAXIMO_BENEFICIO)
  if (b === '' || lista.length >= MAXIMO_BENEFICIOS) return lista
  if (lista.some((x) => x.toLowerCase() === b.toLowerCase())) return lista
  return [...lista, b]
}

const oNulo = (texto: string) => (texto.trim() === '' ? null : texto.trim())

/**
 * Lo que manda «Guardar»: todo junto, con los bordes recortados, los vacíos como
 * «sin dato» y los enlaces con `https://` delante si no lo traían.
 */
export function comoCuerpo(f: Formulario): GuardarPresentacion {
  const redes: Record<string, string> = {}
  for (const red of REDES) {
    const enlace = normalizarEnlace(f.redes[red.codigo])
    if (enlace) redes[red.codigo] = enlace
  }
  return {
    sector: oNulo(f.sector),
    tamano: oNulo(f.tamano),
    anioFundacion: f.anioFundacion.trim() === '' ? null : Number(f.anioFundacion.trim()),
    quienesSomos: oNulo(f.quienesSomos),
    propositoEmpresa: oNulo(f.propositoEmpresa),
    beneficios: beneficiosLimpios(f.beneficios),
    videoPresentacion: normalizarEnlace(f.videoPresentacion) || null,
    paginaWeb: normalizarEnlace(f.paginaWeb) || null,
    redes,
    mision: oNulo(f.mision),
    vision: oNulo(f.vision),
  }
}

/** Si el formulario dice algo distinto de lo guardado. */
export function hayCambios(f: Formulario, guardado: Formulario): boolean {
  return JSON.stringify(f) !== JSON.stringify(guardado)
}
