/**
 * Las llamadas de la gestión de personas (V64), y la de contratar desde la
 * ficha del postulante.
 *
 * Cada función es una línea: la ruta y el tipo. La mecánica vive en la puerta.
 */

import type { Archivo } from '@/api/puerta'
import { pedir, pedirArchivo } from './cliente'
import type {
  AltaColaborador,
  ContratadoPendiente,
  DatosPersonales,
  EntradaHistorial,
  FichaColaborador,
  FiltrosColaboradores,
  OpcionesColaborador,
  PaginaColaboradores,
  Precarga,
  RegistrarCambio,
  RegistrarCese,
  Reingreso,
  ResultadoCarga,
} from './tiposPersonas'

const BASE = '/colaboradores'

/** Los filtros van en la query; los vacíos no se mandan. */
export function consultaDeLaLista(filtros: FiltrosColaboradores): string {
  const partes = new URLSearchParams()
  if (filtros.estados.length > 0) partes.set('estado', filtros.estados.join(','))
  if (filtros.sede != null) partes.set('sede', String(filtros.sede))
  if (filtros.area != null) partes.set('area', String(filtros.area))
  if (filtros.cargo != null) partes.set('cargo', String(filtros.cargo))
  if (filtros.porVencer) partes.set('porVencer', 'true')
  if (filtros.q.trim() !== '') partes.set('q', filtros.q.trim())
  if (filtros.pagina > 0) partes.set('pagina', String(filtros.pagina))
  const texto = partes.toString()
  return texto === '' ? '' : `?${texto}`
}

export const listarColaboradores = (filtros: FiltrosColaboradores) =>
  pedir<PaginaColaboradores>(`${BASE}${consultaDeLaLista(filtros)}`)
export const opcionesDeColaborador = () => pedir<OpcionesColaborador>(`${BASE}/opciones`)
export const contratadosPendientes = () => pedir<ContratadoPendiente[]>(`${BASE}/pendientes`)
export const noDarDeAlta = (postulacionId: number, motivo: string) =>
  pedir<void>(`${BASE}/pendientes/${postulacionId}/descarte`, { metodo: 'POST', cuerpo: { motivo } })
export const precargaDelContratado = (postulacionId: number) =>
  pedir<Precarga>(`${BASE}/precarga?postulacion=${postulacionId}`)
export const darDeAlta = (datos: AltaColaborador) =>
  pedir<{ id: number }>(BASE, { metodo: 'POST', cuerpo: datos })

export const verColaborador = (id: number) => pedir<FichaColaborador>(`${BASE}/${id}`)
export const historialDelColaborador = (id: number) =>
  pedir<EntradaHistorial[]>(`${BASE}/${id}/historial`)
export const editarPerfil = (id: number, datos: DatosPersonales) =>
  pedir<void>(`${BASE}/${id}/perfil`, { metodo: 'PUT', cuerpo: datos })
export const registrarCambio = (id: number, datos: RegistrarCambio) =>
  pedir<{ id: number }>(`${BASE}/${id}/cambios`, { metodo: 'POST', cuerpo: datos })
export const anularCambio = (id: number, situacionId: number, motivo: string) =>
  pedir<void>(`${BASE}/${id}/cambios/${situacionId}/anulacion`, { metodo: 'POST', cuerpo: { motivo } })
export const registrarCese = (id: number, datos: RegistrarCese) =>
  pedir<void>(`${BASE}/${id}/cese`, { metodo: 'POST', cuerpo: datos })
export const anularCese = (id: number, motivo: string) =>
  pedir<void>(`${BASE}/${id}/cese/anulacion`, { metodo: 'POST', cuerpo: { motivo } })
export const reingresar = (id: number, datos: Reingreso) =>
  pedir<void>(`${BASE}/${id}/reingreso`, { metodo: 'POST', cuerpo: datos })

export const descargarPlantilla = (): Promise<Archivo> => pedirArchivo(`${BASE}/plantilla`)
export function cargarExcel(archivo: File) {
  const formulario = new FormData()
  formulario.append('archivo', archivo)
  return pedir<ResultadoCarga>(`${BASE}/carga`, { metodo: 'POST', formulario })
}

/**
 * Contratar: la decisión en verde, por el mismo camino que la API de siempre.
 * El backend pide `decidir_contratacion` la primera vez y `cambiar_decision` si
 * ya hubo una.
 */
export const contratar = (postulacionId: number, motivo: string) =>
  pedir<void>(`/postulaciones/${postulacionId}/decision`, {
    metodo: 'POST',
    cuerpo: { semaforo: 'VERDE', motivo },
  })
