/**
 * Las sedes y los cargos de Configuración (V64).
 *
 * En su propio módulo y no en `panel.ts`: las pruebas que doblan ese módulo
 * entero no tienen por qué saber que existen.
 */

import { pedir } from './cliente'
import type { CrearCargo, GuardarSede, ListaDeCargos, ListaDeSedes } from './tiposPersonas'

export const listarSedes = () => pedir<ListaDeSedes>('/sedes')
export const crearSede = (datos: GuardarSede) =>
  pedir<{ id: number }>('/sedes', { metodo: 'POST', cuerpo: datos })
export const editarSede = (id: number, datos: GuardarSede) =>
  pedir<void>(`/sedes/${id}`, { metodo: 'PUT', cuerpo: datos })
export const desactivarSede = (id: number) =>
  pedir<void>(`/sedes/${id}/desactivacion`, { metodo: 'POST' })
export const reactivarSede = (id: number) =>
  pedir<void>(`/sedes/${id}/reactivacion`, { metodo: 'POST' })

export const listarCargos = () => pedir<ListaDeCargos>('/cargos')
export const crearCargo = (datos: CrearCargo) =>
  pedir<{ id: number }>('/cargos', { metodo: 'POST', cuerpo: datos })
export const renombrarCargo = (id: number, nombre: string) =>
  pedir<void>(`/cargos/${id}`, { metodo: 'PUT', cuerpo: { nombre } })
export const desactivarCargo = (id: number) =>
  pedir<void>(`/cargos/${id}/desactivacion`, { metodo: 'POST' })
export const reactivarCargo = (id: number) =>
  pedir<void>(`/cargos/${id}/reactivacion`, { metodo: 'POST' })
