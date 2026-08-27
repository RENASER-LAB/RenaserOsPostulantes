/**
 * La matriz de permisos, y las cuatro formas de romperla sin que nada avise.
 *
 *   1. **Reordenar el catálogo.** Llega ordenado por grupo y por el orden del
 *      proceso; un `.sort()` alfabético lo convierte en una lista donde nada
 *      está donde se busca.
 *   2. **Mandar `PUT` para quitar un permiso.** `QUITAR` no es un alcance: se
 *      revoca con su propia ruta. Un `PUT` con alcance vacío lo rechaza el
 *      `@Pattern` del backend.
 *   3. **Guardar sin motivo.** El backend responde 400 y el motivo es lo único
 *      que queda escrito de por qué un equipo empezó a ver algo.
 *   4. **Tragarse el 409 del último «administrar_permisos».** Ese mensaje dice
 *      exactamente por qué no se puede, y sustituirlo por uno genérico deja a
 *      quien administra sin saber que casi se queda fuera.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ErrorApi } from '../api/cliente'
import { Permisos } from './Permisos'

const ROLES = [
  { id: 2, codigo: 'TALENTO', nombre: 'Equipo de Talento' },
  { id: 3, codigo: 'RESPONSABLE_AREA', nombre: 'Responsable del área' },
]

/** Como llega del backend: por grupo, y dentro del grupo por el orden dado. */
const CATALOGO = [
  { codigo: 'ver_vacantes', etiqueta: 'Ver las vacantes', grupo: 'VACANTES', orden: 1, alcance: 'TODO' },
  { codigo: 'crear_vacante', etiqueta: 'Crear una vacante', grupo: 'VACANTES', orden: 2, alcance: null },
  {
    codigo: 'crear_sesiones_simulacion',
    etiqueta: 'Crear sesiones de simulación con fecha y cupo',
    grupo: 'SESIONES',
    orden: 1,
    alcance: null,
  },
  {
    codigo: 'ver_inscritos_simulacion',
    etiqueta: 'Ver quién eligió cada sesión de simulación',
    grupo: 'SESIONES',
    orden: 9,
    alcance: 'SUS_VACANTES',
  },
]

const roles = vi.fn()
const matriz = vi.fn()
const conceder = vi.fn()
const revocar = vi.fn()

vi.mock('../api/panel', () => ({
  listarRoles: () => roles(),
  permisosDelRol: (id: number) => matriz(id),
  concederPermiso: (rolId: number, codigo: string, alcance: string, motivo: string) =>
    conceder(rolId, codigo, alcance, motivo),
  revocarPermiso: (rolId: number, codigo: string, motivo: string) => revocar(rolId, codigo, motivo),
}))

function montar() {
  const datos = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={datos}>
      <Permisos />
    </QueryClientProvider>,
  )
}

/** Elige el rol y abre el editor de una fila por su etiqueta. */
async function abrir(etiqueta: string) {
  fireEvent.click(await screen.findByRole('button', { name: 'Equipo de Talento' }))
  const fila = (await screen.findByText(etiqueta)).closest('li')!
  fireEvent.click(fila.querySelector<HTMLButtonElement>('button')!)
  return fila
}

beforeEach(() => {
  roles.mockReset()
  matriz.mockReset()
  conceder.mockReset()
  revocar.mockReset()
  roles.mockResolvedValue(ROLES)
  matriz.mockResolvedValue(CATALOGO)
  conceder.mockResolvedValue(undefined)
  revocar.mockResolvedValue(undefined)
})

afterEach(cleanup)

describe('qué puede cada rol', () => {
  it('no pide nada hasta que se elige un rol', async () => {
    montar()
    await screen.findByRole('button', { name: 'Equipo de Talento' })
    expect(matriz).not.toHaveBeenCalled()
  })

  it('respeta el orden del backend en vez de ordenar alfabéticamente', async () => {
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Equipo de Talento' }))
    await screen.findByText('Ver las vacantes')

    const grupos = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(grupos).toEqual(['Vacantes', 'Simulación'])

    const permisos = screen.getAllByRole('listitem').map((li) => li.textContent ?? '')
    expect(permisos[0]).toContain('ver_vacantes')
    expect(permisos[1]).toContain('crear_vacante')
    // Dentro del grupo manda `orden`, no el alfabeto: crear (1) antes que ver (9).
    expect(permisos[2]).toContain('crear_sesiones_simulacion')
    expect(permisos[3]).toContain('ver_inscritos_simulacion')
  })

  it('los cuatro alcances se distinguen por su palabra', async () => {
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Equipo de Talento' }))
    await screen.findByText('Ver las vacantes')

    expect(screen.getByText('Todo')).toBeTruthy()
    expect(screen.getByText('Sus vacantes')).toBeTruthy()
    expect(screen.getAllByText('No lo tiene')).toHaveLength(2)
  })

  it('no deja guardar sin motivo', async () => {
    montar()
    const fila = await abrir('Crear una vacante')

    fireEvent.change(fila.querySelector('select')!, { target: { value: 'TODO' } })
    const guardar = screen.getByRole('button', { name: 'Guardar' }) as HTMLButtonElement
    expect(guardar.disabled).toBe(true)

    fireEvent.change(fila.querySelector('input')!, { target: { value: 'Ahora también crea.' } })
    expect((screen.getByRole('button', { name: 'Guardar' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('conceder manda el alcance elegido y el motivo', async () => {
    montar()
    const fila = await abrir('Crear una vacante')

    fireEvent.change(fila.querySelector('select')!, { target: { value: 'SUS_VACANTES' } })
    fireEvent.change(fila.querySelector('input')!, { target: { value: 'Acuerdo del 27/08.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(conceder).toHaveBeenCalledTimes(1))
    expect(conceder).toHaveBeenCalledWith(2, 'crear_vacante', 'SUS_VACANTES', 'Acuerdo del 27/08.')
    expect(revocar).not.toHaveBeenCalled()
  })

  it('quitar un permiso va por la ruta de revocación, no por un PUT vacío', async () => {
    montar()
    const fila = await abrir('Ver las vacantes')

    fireEvent.change(fila.querySelector('select')!, { target: { value: 'QUITAR' } })
    fireEvent.change(fila.querySelector('input')!, { target: { value: 'Ya no lo necesita.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(revocar).toHaveBeenCalledTimes(1))
    expect(revocar).toHaveBeenCalledWith(2, 'ver_vacantes', 'Ya no lo necesita.')
    expect(conceder).not.toHaveBeenCalled()
  })

  it('el 409 del último administrador se enseña tal cual', async () => {
    const dice = 'No se puede revocar el último «administrar_permisos»: nadie podría volver a cambiar los permisos'
    revocar.mockRejectedValue(new ErrorApi(409, dice, null))
    montar()
    const fila = await abrir('Ver las vacantes')

    fireEvent.change(fila.querySelector('select')!, { target: { value: 'QUITAR' } })
    fireEvent.change(fila.querySelector('input')!, { target: { value: 'Limpieza.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText(dice)).toBeTruthy()
  })

  it('sin permiso para listar roles se nombran los dos que hacen falta', async () => {
    roles.mockRejectedValue(new ErrorApi(403, 'Forbidden', null))
    montar()

    expect(await screen.findByText(/hacen falta/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /volver a intentarlo/i })).toBeNull()
  })
})
