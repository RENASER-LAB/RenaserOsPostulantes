/**
 * Lo que compila perfectamente estando mal en la lista de inscritos.
 *
 *   0. **Marcar la ausencia de un solo golpe.** Comprobado contra el backend
 *      vivo: `marcarAsistencia(false)` pone `es_vigente = false` y la fila
 *      **desaparece de la lista**. Sin preguntar antes se pulsa, la persona se
 *      desvanece y no queda ni rastro de a quién le pasó ni de qué pasó.
 *
 *   1. **Tratar `asistio: null` como `false`.** Un `!asistio` en el JSX pinta
 *      «no vino» a quien nadie ha marcado todavía, y eso es una sesión sin
 *      pasar lista disfrazada de sesión a la que no fue nadie.
 *   2. **Desmontar la lista con `isError` a secas.** TanStack Query pone
 *      `status: 'error'` también cuando falla un refresco de fondo con los
 *      datos ya puestos: es la trampa que costó el formulario del perfil.
 *   3. **Pintar el 403 como un fallo.** Que este rol no vea los nombres es el
 *      reparto de permisos funcionando, no algo que se arregle reintentando.
 *   4. **Deducir el aforo de la longitud de la lista.** Con alcance acotado el
 *      backend recorta la lista y no el cupo: derivarlo enseñaría «0 plazas»
 *      en una sesión llena.
 */

/*
 * ⚠️ **`TRES` incluye una fila con `asistio: false` y el sistema real no puede
 * producirla.** Se comprobo contra el backend vivo: marcar la ausencia pone
 * `es_vigente = false` y `GET /inscritos` solo devuelve las vigentes, asi que
 * esa fila se va de la lista.
 *
 * Se queda aqui a proposito, y esto es lo que prueba: **el contrato del
 * componente**, no el del sistema. El tipo admite `boolean | null` y la rama
 * defensiva tiene que seguir pintando «No asistio» si el valor llegara alguna
 * vez, en vez de colapsarlo con «Sin pasar lista». Lo que prueba el sistema es
 * `herramientas/e2e-simulacion-permisos.mjs`, contra el backend de verdad.
 *
 * La fixtura de las capturas SI se corrigio: alli una fila inalcanzable tapaba
 * el fallo en lugar de documentarlo.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ErrorApi } from '../api/cliente'
import { Inscritos } from './Inscritos'

const TRES = [
  {
    inscripcionId: 11,
    postulacionId: 101,
    candidato: 'Ana Quispe',
    vacante: 'Analista de Datos',
    inscritaEn: '2026-08-20T14:00:00Z',
    asistio: null,
  },
  {
    inscripcionId: 12,
    postulacionId: 102,
    candidato: 'Bruno Salas',
    vacante: 'Analista de Datos',
    inscritaEn: '2026-08-20T15:00:00Z',
    asistio: true,
  },
  {
    inscripcionId: 13,
    postulacionId: 103,
    candidato: 'Carla Ruiz',
    vacante: 'Analista de Datos',
    inscritaEn: '2026-08-21T09:00:00Z',
    asistio: false,
  },
]

const listar = vi.fn()
const marcar = vi.fn()

vi.mock('../api/panel', () => ({
  listarInscritos: (id: number) => listar(id),
  marcarAsistencia: (inscripcionId: number, asistio: boolean) => marcar(inscripcionId, asistio),
}))

function montar(aforo = 6, inscritos = 3) {
  const datos = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={datos}>
      <Inscritos sesionId={4} aforo={aforo} inscritos={inscritos} />
    </QueryClientProvider>,
  )
}

/** El primer boton «Vino» de la lista. */
function primerVino() {
  return screen.getAllByRole('button', { name: 'Vino' })[0]!
}

beforeEach(() => {
  listar.mockReset()
  marcar.mockReset()
  marcar.mockResolvedValue(undefined)
})

afterEach(cleanup)

describe('quién eligió esta fecha', () => {
  it('distingue «sin pasar lista» de «no asistió»', async () => {
    listar.mockResolvedValue(TRES)
    montar()

    await screen.findByText('Ana Quispe')

    // Los tres estados, cada uno con su palabra. Si `null` se colapsara con
    // `false` habría dos «No asistió» y ningún «Sin pasar lista».
    expect(screen.getByText('Sin pasar lista')).toBeTruthy()
    expect(screen.getByText('Asistió')).toBeTruthy()
    expect(screen.getByText('No asistió')).toBeTruthy()
  })

  it('el aforo sale de la sesión, no de cuántos se ven', async () => {
    listar.mockResolvedValue(TRES)
    montar(6, 3)

    expect(await screen.findByText(/3 personas de 6 plazas/)).toBeTruthy()
  })

  it('cuando la lista trae menos gente que la sesión, dice por qué', async () => {
    // Alcance acotado: cinco plazas ocupadas y una sola fila visible. Sin esta
    // frase, «1 persona» debajo de una fila que dice «5 de 6» parece un fallo.
    listar.mockResolvedValue([TRES[0]])
    montar(6, 5)

    expect(await screen.findByText(/1 persona de las 5 inscritas/)).toBeTruthy()
    expect(screen.getByText(/tu alcance llega solo a tus vacantes/i)).toBeTruthy()
  })

  it('marcar la ausencia pregunta antes, porque saca a la persona de la lista', async () => {
    listar.mockResolvedValue(TRES)
    montar()

    await screen.findByText('Ana Quispe')
    fireEvent.click(screen.getAllByRole('button', { name: 'No vino' })[0]!)

    // Nada se ha mandado todavía: primero se dice lo que va a pasar.
    expect(marcar).not.toHaveBeenCalled()
    expect(screen.getByText(/sale de la lista/i)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Sí, no vino' }))
    await waitFor(() => expect(marcar).toHaveBeenCalledWith(11, false))
  })

  it('«mejor no» no manda nada', async () => {
    listar.mockResolvedValue(TRES)
    montar()

    await screen.findByText('Ana Quispe')
    fireEvent.click(screen.getAllByRole('button', { name: 'No vino' })[0]!)
    fireEvent.click(screen.getByRole('button', { name: 'Mejor no' }))

    expect(marcar).not.toHaveBeenCalled()
    expect(screen.getAllByRole('button', { name: 'No vino' }).length).toBeGreaterThan(0)
  })

  it('tras marcar la ausencia se dice quién se fue y a dónde', async () => {
    listar.mockResolvedValue(TRES)
    montar()

    await screen.findByText('Ana Quispe')
    fireEvent.click(screen.getAllByRole('button', { name: 'No vino' })[0]!)
    fireEvent.click(screen.getByRole('button', { name: 'Sí, no vino' }))

    // La fila se va sola en cuanto el servidor responde; sin esto, en silencio.
    expect(await screen.findByText(/Ana Quispe queda marcada como ausente/i)).toBeTruthy()
    expect(screen.getByText(/vuelve a la bandeja del equipo/i)).toBeTruthy()
  })

  it('marcar la asistencia manda el id de la inscripción, no el de la postulación', async () => {
    listar.mockResolvedValue(TRES)
    montar()

    await screen.findByText('Ana Quispe')
    fireEvent.click(primerVino())

    await waitFor(() => expect(marcar).toHaveBeenCalledTimes(1))
    expect(marcar).toHaveBeenCalledWith(11, true)
  })

  it('no deja volver a marcar lo que ya está marcado', async () => {
    listar.mockResolvedValue(TRES)
    montar()

    await screen.findByText('Bruno Salas')
    const yaVino = screen.getByRole('button', { name: 'Marcado: vino' }) as HTMLButtonElement
    expect(yaVino.disabled).toBe(true)
  })

  it('un 403 explica el permiso en vez de ofrecer reintentar', async () => {
    listar.mockRejectedValue(new ErrorApi(403, 'Forbidden', null))
    montar()

    expect(await screen.findByText(/ve el aforo de esta sesión/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /volver a intentarlo/i })).toBeNull()
  })

  it('un fallo del refresco no se lleva la lista por delante', async () => {
    // Primera llamada bien, la siguiente mal: es lo que pasa con un hipo del
    // servidor mientras la pantalla ya tiene datos en pantalla.
    listar.mockResolvedValueOnce(TRES).mockRejectedValue(new Error('Se cayó la red.'))
    montar()

    await screen.findByText('Ana Quispe')

    // Pasar lista invalida la consulta: ese refresco es el que falla.
    fireEvent.click(primerVino())
    await waitFor(() => expect(listar.mock.calls.length).toBeGreaterThan(1))

    // La lista sigue en pie y se dice que está desactualizada. La pantalla de
    // fallo es solo para cuando no hay absolutamente nada que enseñar.
    await screen.findByText(/no pudimos refrescar la lista/i)
    expect(screen.getByText('Ana Quispe')).toBeTruthy()
  })
})
