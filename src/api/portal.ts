/** `PortalController`: vacantes, cuenta, postulaciones y privacidad. */

import { pedir } from './cliente'
import type {
  CrearCuenta,
  DatosPostulacion,
  Login,
  MiPostulacion,
  MiPostulacionDetalle,
  PedirBorrado,
  Sesion,
  TextoConsentimientoPublico,
  VacantePublica,
} from './tipos'

// ---------- Publico ----------

export const listarVacantes = () =>
  pedir<VacantePublica[]>('/vacantes', { sinToken: true })

export const verVacante = (id: number | string) =>
  pedir<VacantePublica>(`/vacantes/${id}`, { sinToken: true })

export const textosConsentimiento = () =>
  pedir<TextoConsentimientoPublico[]>('/consentimientos/textos', { sinToken: true })

export const crearCuenta = (datos: CrearCuenta) =>
  pedir<void>('/cuentas', { metodo: 'POST', cuerpo: datos, sinToken: true })

export const ingresar = (datos: Login) =>
  pedir<Sesion>('/auth/login', { metodo: 'POST', cuerpo: datos, sinToken: true })

/**
 * Canjea el token del enlace que llego por correo por una sesion.
 *
 * Va sin token propio porque quien lo llama todavia no tiene ninguno: el del
 * enlace ES la credencial.
 */
export const accederConEnlace = (token: string) =>
  pedir<Sesion>('/auth/acceso', { metodo: 'POST', cuerpo: { token }, sinToken: true })

// ---------- Postulaciones ----------

/** Va como multipart porque lleva el CV. El navegador pone la cabecera. */
export function postular(datos: DatosPostulacion) {
  const formulario = new FormData()
  formulario.append('vacanteId', String(datos.vacanteId))
  formulario.append('cv', datos.cv)
  formulario.append('resultadoOrgulloso', datos.resultadoOrgulloso)
  if (datos.portafolio) formulario.append('portafolio', datos.portafolio)
  if (datos.linkedin) formulario.append('linkedin', datos.linkedin)
  if (datos.github) formulario.append('github', datos.github)
  for (const id of datos.requisitosConfirmados ?? []) {
    formulario.append('requisitosConfirmados', String(id))
  }
  return pedir<{ codigo: string }>('/postulaciones', { metodo: 'POST', formulario })
}

export const misPostulaciones = () => pedir<MiPostulacion[]>('/postulaciones')

export const verPostulacion = (uuid: string) =>
  pedir<MiPostulacionDetalle>(`/postulaciones/${uuid}`)

/** Retirarse no borra los datos: eso se pide aparte. */
export const retirarPostulacion = (uuid: string) =>
  pedir<void>(`/postulaciones/${uuid}/retiro`, { metodo: 'POST' })

// ---------- Privacidad ----------

/** Salir del Radar de Talento. Distinto de retirar una postulacion. */
export const retirarConsentimientoFuturos = () =>
  pedir<void>('/consentimientos/futuros/retiro', { metodo: 'POST' })

/** Pedir el borrado. Lo ejecuta Direccion o Administracion, no es inmediato. */
export const pedirBorrado = (datos: PedirBorrado = {}) =>
  pedir<void>('/solicitudes-borrado', { metodo: 'POST', cuerpo: datos })
