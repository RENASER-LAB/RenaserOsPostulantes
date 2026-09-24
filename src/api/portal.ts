/** `PortalController`: vacantes, cuenta, postulaciones y privacidad. */

import { pedir } from './cliente'
import type {
  ConsentimientoDeVacante,
  CrearCuenta,
  DatosPostulacion,
  Login,
  MiPostulacion,
  MiPostulacionDetalle,
  MisAvisos,
  OpcionUbigeo,
  PedirBorrado,
  PedirRecuperacion,
  QuienSoy,
  RestablecerClave,
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

/**
 * El texto que hay que aceptar para postular a ESTA vacante, con el nombre de
 * la empresa que va a tratar los datos.
 *
 * Sin token, igual que `verVacante`: hay que poder leer lo que se acepta antes
 * de decidir postular, y sin cuenta.
 */
export const consentimientoDeVacante = (id: number | string) =>
  pedir<ConsentimientoDeVacante>(`/vacantes/${id}/consentimiento`, { sinToken: true })

/**
 * Las provincias donde puede vivir un candidato, agrupadas por departamento.
 *
 * ⚠️ **Sin token, y eso no es un descuido**: lo pide la pantalla de crear cuenta,
 * que por definicion todavia no tiene ninguno. Los otros dos catalogos del
 * portal —niveles educativos y de idioma— si van con token porque solo se usan
 * dentro del perfil.
 *
 * Llega ya ordenado por departamento y nombre: se respeta el array.
 */
export const catalogoUbigeo = () =>
  pedir<OpcionUbigeo[]>('/catalogos/ubigeo', { sinToken: true })

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

/**
 * Pedir el enlace para elegir una contraseña nueva.
 *
 * El backend contesta 202 vacío **siempre**, exista o no la cuenta: la pantalla
 * enseña el mismo mensaje pase lo que pase, y solo un fallo de red o del
 * servidor es un error de verdad.
 */
export const pedirRecuperacion = (correo: string) =>
  pedir<void>('/auth/recuperacion', {
    metodo: 'POST',
    cuerpo: { correo } satisfies PedirRecuperacion,
    sinToken: true,
  })

/**
 * Elegir la contraseña nueva con el token del enlace. No abre sesión.
 *
 * El token va en el cuerpo, nunca en la dirección de la API. Sin token de
 * sesión a propósito: un 401 aquí es «el enlace no sirve», no «tu sesión cayó»,
 * y no debe cerrarle la sesión a nadie.
 */
export const restablecerClave = (datos: RestablecerClave) =>
  pedir<void>('/auth/restablecer', { metodo: 'POST', cuerpo: datos, sinToken: true })

/** Como se llama quien tiene el token guardado. Ver `QuienSoy`. */
export const quienSoy = () => pedir<QuienSoy>('/auth/sesion')

// ---------- Postulaciones ----------

/**
 * Va como multipart porque puede llevar el CV. El navegador pone la cabecera.
 *
 * ⚠️ **`cv` en null NO es un olvido: significa «usa el de mi perfil».** El campo
 * no se añade al formulario, y el backend busca entonces el curriculum guardado.
 * Mandar uno lo usa **solo para esta vacante**: el del perfil no cambia.
 */
export function postular(datos: DatosPostulacion) {
  const formulario = new FormData()
  formulario.append('vacanteId', String(datos.vacanteId))
  if (datos.cv) formulario.append('cv', datos.cv)
  formulario.append('resultadoOrgulloso', datos.resultadoOrgulloso)
  if (datos.portafolio) formulario.append('portafolio', datos.portafolio)
  if (datos.linkedin) formulario.append('linkedin', datos.linkedin)
  if (datos.github) formulario.append('github', datos.github)
  for (const id of datos.requisitosConfirmados ?? []) {
    formulario.append('requisitosConfirmados', String(id))
  }
  // Obligatorio: sin el, el backend responde 400. Va siempre, tambien en false,
  // porque omitirlo y mandar false son la misma cosa para el servidor pero no
  // para quien lea esto: el campo dice que la pantalla lo tuvo en cuenta.
  formulario.append('aceptaTratamiento', String(datos.aceptaTratamiento))
  // Solo si la vacante publica lo que paga. Si no, el backend los ignora, y
  // mandarlos igual escribiria en el registro un numero que nadie pidio.
  if (datos.pretensionMonto !== undefined) {
    formulario.append('pretensionMonto', String(datos.pretensionMonto))
    formulario.append('pretensionMoneda', datos.pretensionMoneda ?? 'PEN')
  }
  return pedir<{ codigo: string }>('/postulaciones', { metodo: 'POST', formulario })
}

export const misPostulaciones = () => pedir<MiPostulacion[]>('/postulaciones')

export const verPostulacion = (uuid: string) =>
  pedir<MiPostulacionDetalle>(`/postulaciones/${uuid}`)

/** Retirarse no borra los datos: eso se pide aparte. */
export const retirarPostulacion = (uuid: string) =>
  pedir<void>(`/postulaciones/${uuid}/retiro`, { metodo: 'POST' })

// ---------- La campana ----------

/** Mis avisos, los nuevos arriba, y cuantos me quedan sin ver. */
export const misAvisos = () => pedir<MisAvisos>('/avisos')

/**
 * Apaga el punto de todos.
 *
 * Se llama al ABRIR la campana, no al abrir cada proceso: enterarse de que hay
 * algo es lo que lo apaga. El aviso sigue ahi para releerlo, solo deja de contar.
 */
export const marcarAvisosLeidos = () =>
  pedir<{ marcados: number }>('/avisos/lectura', { metodo: 'POST' })

/** Apaga uno. Si no es suyo, el backend lo ignora en silencio. */
export const marcarAvisoLeido = (id: number) =>
  pedir<void>(`/avisos/${id}/lectura`, { metodo: 'POST' })

// ---------- Privacidad ----------

/** Salir del Radar de Talento. Distinto de retirar una postulacion. */
export const retirarConsentimientoFuturos = () =>
  pedir<void>('/consentimientos/futuros/retiro', { metodo: 'POST' })

/** Pedir el borrado. Lo ejecuta Direccion o Administracion, no es inmediato. */
export const pedirBorrado = (datos: PedirBorrado = {}) =>
  pedir<void>('/solicitudes-borrado', { metodo: 'POST', cuerpo: datos })
