/**
 * `PerfilPortalController` y `CatalogoPerfilController`: el perfil del
 * candidato, sus cinco listas y los dos catálogos.
 *
 * **El perfil es de la persona, no de la vacante ni de la empresa.** Uno solo,
 * que se llena una vez y sirve para postular a cualquier sitio.
 *
 * ⚠️ **Las cinco listas NO tienen las mismas operaciones**, y modelarlas como si
 * las tuvieran devuelve 404:
 *
 *   experiencia     crear · editar · borrar · confirmar · reordenar
 *   educacion       crear · editar · borrar · confirmar · reordenar
 *   idiomas         crear · editar · borrar · confirmar
 *   certificaciones crear · editar · borrar · confirmar
 *   enlaces         crear · borrar
 *
 * ⚠️ **`experiencia` y `educacion` van en SINGULAR en la ruta**, las otras tres
 * en plural. No existe `/experiencias`. El nombre de cada una coincide con su
 * clave en el JSON del GET, que es lo que permite recorrerlas con un componente
 * comun sin inventarse plurales.
 *
 * ⚠️ **Editar un elemento lo convierte en «escrito por mi»** (`origen: PERSONA`,
 * confirmado). Confirmar, en cambio, conserva `CURRICULUM`: se sabe que salio
 * del archivo y que la persona lo dio por bueno, que es informacion util.
 */

import { pedir } from './cliente'
import type {
  EditarCabeceraPerfil,
  EditarCertificacion,
  EditarEducacion,
  EditarEnlace,
  EditarExperiencia,
  EditarIdioma,
  OpcionCatalogo,
  PerfilCompleto,
} from './tipos'

// ---------- El perfil entero ----------

/** Sin perfil responde 200 con todo vacio, no 404: siempre hay algo que pintar. */
export const verPerfil = () => pedir<PerfilCompleto>('/perfil')

/**
 * ⚠️ **Reemplaza la cabecera entera.** Hay que mandar el objeto completo: lo que
 * falte se guarda vacio. Se parte de lo que devolvio `verPerfil`.
 */
export const guardarCabecera = (datos: EditarCabeceraPerfil) =>
  pedir<void>('/perfil', { metodo: 'PUT', cuerpo: datos })

/** Todo el perfil en un JSON, para el derecho de acceso de la ley 29733. */
export const descargarMisDatos = () => pedir<PerfilCompleto>('/perfil/descarga')

// ---------- Experiencia ----------

export const crearExperiencia = (datos: EditarExperiencia) =>
  pedir<{ id: number }>('/perfil/experiencia', { metodo: 'POST', cuerpo: datos })

export const editarExperiencia = (id: number, datos: EditarExperiencia) =>
  pedir<void>(`/perfil/experiencia/${id}`, { metodo: 'PUT', cuerpo: datos })

export const borrarExperiencia = (id: number) =>
  pedir<void>(`/perfil/experiencia/${id}`, { metodo: 'DELETE' })

export const confirmarExperiencia = (id: number) =>
  pedir<void>(`/perfil/experiencia/${id}/confirmacion`, { metodo: 'POST' })

export const ordenarExperiencia = (ids: number[]) =>
  pedir<void>('/perfil/experiencia/orden', { metodo: 'PUT', cuerpo: { ids } })

// ---------- Educacion ----------

export const crearEducacion = (datos: EditarEducacion) =>
  pedir<{ id: number }>('/perfil/educacion', { metodo: 'POST', cuerpo: datos })

export const editarEducacion = (id: number, datos: EditarEducacion) =>
  pedir<void>(`/perfil/educacion/${id}`, { metodo: 'PUT', cuerpo: datos })

export const borrarEducacion = (id: number) =>
  pedir<void>(`/perfil/educacion/${id}`, { metodo: 'DELETE' })

export const confirmarEducacion = (id: number) =>
  pedir<void>(`/perfil/educacion/${id}/confirmacion`, { metodo: 'POST' })

export const ordenarEducacion = (ids: number[]) =>
  pedir<void>('/perfil/educacion/orden', { metodo: 'PUT', cuerpo: { ids } })

// ---------- Idiomas ----------

export const crearIdioma = (datos: EditarIdioma) =>
  pedir<{ id: number }>('/perfil/idiomas', { metodo: 'POST', cuerpo: datos })

export const editarIdioma = (id: number, datos: EditarIdioma) =>
  pedir<void>(`/perfil/idiomas/${id}`, { metodo: 'PUT', cuerpo: datos })

export const borrarIdioma = (id: number) =>
  pedir<void>(`/perfil/idiomas/${id}`, { metodo: 'DELETE' })

export const confirmarIdioma = (id: number) =>
  pedir<void>(`/perfil/idiomas/${id}/confirmacion`, { metodo: 'POST' })

// ---------- Certificaciones ----------

export const crearCertificacion = (datos: EditarCertificacion) =>
  pedir<{ id: number }>('/perfil/certificaciones', { metodo: 'POST', cuerpo: datos })

export const editarCertificacion = (id: number, datos: EditarCertificacion) =>
  pedir<void>(`/perfil/certificaciones/${id}`, { metodo: 'PUT', cuerpo: datos })

export const borrarCertificacion = (id: number) =>
  pedir<void>(`/perfil/certificaciones/${id}`, { metodo: 'DELETE' })

export const confirmarCertificacion = (id: number) =>
  pedir<void>(`/perfil/certificaciones/${id}/confirmacion`, { metodo: 'POST' })

// ---------- Enlaces ----------

/**
 * Los seis tipos validos.
 *
 * ⚠️ **Es lo unico del perfil que se escribe a mano en el frontend**, y no por
 * descuido: no tiene endpoint de catalogo, es una lista fija en el servicio.
 * Cualquier otro valor da 400. Solo `LINKEDIN` y `GITHUB` comprueban ademas el
 * dominio; los demas aceptan cualquier http o https.
 */
export const TIPOS_DE_ENLACE = [
  { codigo: 'LINKEDIN', nombre: 'LinkedIn' },
  { codigo: 'GITHUB', nombre: 'GitHub' },
  { codigo: 'PORTAFOLIO', nombre: 'Portafolio' },
  { codigo: 'PUBLICACION', nombre: 'Publicación' },
  { codigo: 'PRODUCTO', nombre: 'Producto' },
  { codigo: 'OTRO', nombre: 'Otro' },
] as const

export const crearEnlace = (datos: EditarEnlace) =>
  pedir<{ id: number }>('/perfil/enlaces', { metodo: 'POST', cuerpo: datos })

export const borrarEnlace = (id: number) =>
  pedir<void>(`/perfil/enlaces/${id}`, { metodo: 'DELETE' })

// ---------- Catalogos ----------

/**
 * Los dos catalogos llegan **ya ordenados**: no hay campo `orden` que mirar, asi
 * que se respeta el array y no se reordena por cuenta propia.
 *
 * No se escriben a mano: es lo que ya se desincronizo una vez en este proyecto.
 */
export const nivelesEducativos = () =>
  pedir<OpcionCatalogo[]>('/catalogos/niveles-educativos')

export const nivelesIdioma = () => pedir<OpcionCatalogo[]>('/catalogos/niveles-idioma')
