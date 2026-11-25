/** `PortalController`: vacantes, cuenta, postulaciones y privacidad. */

import { pedir } from './cliente'
import type {
  ConsentimientoDeVacante,
  CrearCuenta,
  ActivacionWhatsapp,
  DatosPostulacion,
  Login,
  MiCelular,
  MiPostulacion,
  MiPostulacionDetalle,
  MisAvisos,
  Notificaciones,
  OpcionUbigeo,
  PedirBorrado,
  PedirRecuperacion,
  PerfilDeEmpresa,
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

/**
 * El perfil público de una empresa (V85). Sin token, como el tablón: se llega
 * desde una vacante o por su enlace. Un 404 es una empresa que no existe o que
 * está suspendida.
 */
export const verPerfilDeEmpresa = (codigo: string) =>
  pedir<PerfilDeEmpresa>(`/empresas/${encodeURIComponent(codigo.toLowerCase())}`, {
    sinToken: true,
  })

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

// ---------- El celular de la cuenta (V73) ----------

/**
 * Cambiar el celular de la cuenta. 400 con el mensaje de la regla si no vale; 409
 * con `codigo: 'TELEFONO_EN_USO'` si ya es de otra cuenta (V92); si cambia, lo
 * vinculado a WhatsApp con el anterior se cierra y WhatsApp queda apagado.
 */
export const cambiarCelular = (telefono: string) =>
  pedir<MiCelular>('/cuenta/telefono', { metodo: 'PUT', cuerpo: { telefono } })

// ---------- Notificaciones (V92) ----------

/** WhatsApp, correo y la campana de toda la cuenta, y si ya vio la guía de los avisos (V93). */
export const misNotificaciones = () => pedir<Notificaciones>('/notificaciones')

/** Encender o apagar el correo y la campana. Lo que no se manda se queda como estaba. */
export const cambiarNotificaciones = (cambios: { correo?: boolean; portal?: boolean }) =>
  pedir<Notificaciones>('/notificaciones', { metodo: 'PATCH', cuerpo: cambios })

/**
 * Encender WhatsApp para todos sus procesos. 409 `SIN_CELULAR` o `NO_DISPONIBLE`;
 * 503 `NO_SE_PUDO_ACTIVAR` si el bot falla (no cambió nada).
 */
export const activarWhatsapp = () =>
  pedir<ActivacionWhatsapp>('/notificaciones/whatsapp', { metodo: 'POST' })

/** Apagar WhatsApp: deja de recibir los avisos de todos sus procesos. */
export const apagarWhatsapp = () =>
  pedir<Notificaciones>('/notificaciones/whatsapp', { metodo: 'DELETE' })

/**
 * La guía de los avisos se dio por vista (V93): no vuelve a salir en esta cuenta, en ningún
 * dispositivo. Idempotente, 204.
 *
 * (`POST /notificaciones/mensaje-visto`, el del mensaje flotante, sigue en el backend pero el
 * portal ya no lo llama: el mensaje lo sustituyó el paso 3 de la guía, el 25/11/2026.)
 */
export const marcarGuiaVista = () =>
  pedir<void>('/notificaciones/guia-vista', { metodo: 'POST' })

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
