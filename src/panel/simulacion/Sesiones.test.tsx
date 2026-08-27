/**
 * Entrar a esta pantalla ya no implica poder gestionarla.
 *
 * El backend amplió los dos GET de sesiones a `ver_inscritos_simulacion`, pero
 * crear, ampliar el cupo y cancelar siguen pidiendo `crear_sesiones_simulacion`.
 * Un responsable de área llega aquí y esos botones le responden 403.
 *
 * Lo que compila estando mal es **dejarlos donde están**: quien no puede los
 * pulsa una y otra vez, y cada intento le contesta con un mensaje de error que
 * no dice nada sobre por qué. No hay forma de saberlo antes —`Sesion` es
 * `{token, usuarioId}`— así que la prueba fija que se aprenda del primer 403.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ErrorApi } from '../api/cliente'
import { SesionesPanel } from './Sesiones'

const SESION = {
  id: 4,
  fechaHora: '2026-09-02T14:00:00Z',
  duracionMinutos: 120,
  modalidad: 'GRUPAL',
  lugar: 'Sala 2',
  enlace: null,
  cupo: 6,
  inscritos: 6,
  estado: 'PUBLICADA',
  enunciado: null,
  vacanteIds: [7],
  responsableIds: [],
  tramos: [],
}

const ampliar = vi.fn()
const inscritos = vi.fn()

vi.mock('../api/panel', () => ({
  listarSesiones: () => Promise.resolve([SESION]),
  listarVacantes: () => Promise.resolve([{ id: 7, titulo: 'Analista de Datos', estado: 'PUBLICADA' }]),
  ampliarCupo: (id: number, cupo: number) => ampliar(id, cupo),
  cancelarSesion: () => Promise.resolve(),
  crearSesion: () => Promise.resolve(),
  listarInscritos: () => inscritos(),
  marcarAsistencia: () => Promise.resolve(),
}))

function montar() {
  const datos = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={datos}>
      <SesionesPanel />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  ampliar.mockReset()
  inscritos.mockReset()
  inscritos.mockResolvedValue([])
})

afterEach(cleanup)

describe('las sesiones de simulación', () => {
  it('el conteo de la sesión no sale de la lista de inscritos', async () => {
    // La lista viene vacía —alcance acotado— y la sesión dice seis de seis. Si
    // el conteo se derivara de la lista, aquí pondría «0 de 6» en una llena.
    montar()
    expect(await screen.findByText('6 de 6')).toBeTruthy()
  })

  it('un 403 al gestionar retira las acciones y explica por qué', async () => {
    ampliar.mockRejectedValue(new ErrorApi(403, 'Forbidden', null))
    montar()

    fireEvent.click(await screen.findByRole('button', { name: '+1 al cupo' }))

    await screen.findByText(/ve estas sesiones pero no las gestiona/i)

    // Los tres se van juntos: son el mismo permiso.
    expect(screen.queryByRole('button', { name: '+1 al cupo' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Crear sesión' })).toBeNull()
  })

  it('ver quién viene sobrevive al 403 de gestión', async () => {
    ampliar.mockRejectedValue(new ErrorApi(403, 'Forbidden', null))
    montar()

    fireEvent.click(await screen.findByRole('button', { name: '+1 al cupo' }))
    await screen.findByText(/ve estas sesiones pero no las gestiona/i)

    // Es justo lo que ese rol sí puede hacer: si se fuera con los demás, la
    // pantalla no le serviría para nada.
    expect(screen.getByRole('button', { name: 'Ver quién viene' })).toBeTruthy()
  })

  it('un fallo que no es de permisos se dice y deja los botones', async () => {
    ampliar.mockRejectedValue(new Error('La sesión ya está llena.'))
    montar()

    fireEvent.click(await screen.findByRole('button', { name: '+1 al cupo' }))

    await screen.findByText('La sesión ya está llena.')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '+1 al cupo' })).toBeTruthy(),
    )
  })

  it('abrir una fila pide los inscritos de esa sesión', async () => {
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Ver quién viene' }))

    await waitFor(() => expect(inscritos).toHaveBeenCalledTimes(1))
    expect(await screen.findByText(/todavía no se ha inscrito nadie/i)).toBeTruthy()
  })
})
