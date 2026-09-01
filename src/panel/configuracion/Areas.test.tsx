/**
 * Las áreas, y las cinco formas de romper esta pantalla sin que nada avise.
 *
 *   1. **Listar solo las activas.** `GET /areas` filtra, así que un área retirada
 *      desaparecería de aquí y el botón de retirar sería un viaje sin retorno.
 *   2. **Ofrecer borrar sin decir qué se lleva por delante.** Los dos recuentos
 *      salen de `GET /areas/{id}/impacto` y se piden AL ABRIR, no al confirmar.
 *   3. **Mandar el borrado sin destino.** Las dos claves ajenas que apuntan al
 *      área no declaran `ON DELETE`: el backend responde 409 y no borra nada.
 *   4. **Tragarse ese 409.** Su mensaje trae los números y dice qué hacer.
 *   5. **Refrescar solo la lista de esta pantalla.** El desplegable de la vacante
 *      lee `['panel-areas']`, que es otra clave: sin invalidarla también, un área
 *      renombrada aquí sigue con el nombre viejo allí. Cada clave tiene UN solo
 *      productor —`listarAreas` la de activas, `listarTodasLasAreas` la de
 *      todas—; el día que una sirva las dos cosas, una retirada llegará al
 *      desplegable de la solicitud por la caché.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ErrorApi } from '../api/cliente'
import { Areas } from './Areas'

const AREAS = [
  { id: 1, nombre: 'Operaciones', esActiva: true },
  { id: 2, nombre: 'Logística', esActiva: false },
  { id: 3, nombre: 'Tecnología', esActiva: true },
]

const todas = vi.fn()
const crear = vi.fn()
const renombrar = vi.fn()
const desactivar = vi.fn()
const reactivar = vi.fn()
const impacto = vi.fn()
const borrar = vi.fn()

vi.mock('../api/panel', () => ({
  listarTodasLasAreas: () => todas(),
  crearArea: (nombre: string) => crear(nombre),
  renombrarArea: (id: number, nombre: string) => renombrar(id, nombre),
  desactivarArea: (id: number) => desactivar(id),
  reactivarArea: (id: number) => reactivar(id),
  impactoDeBorrarArea: (id: number) => impacto(id),
  borrarArea: (id: number, destino: number | null, motivo: string) => borrar(id, destino, motivo),
}))

function montar() {
  const datos = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={datos}>
      <Areas />
    </QueryClientProvider>,
  )
}

/** La fila de un área, por su nombre. */
async function fila(nombre: string) {
  return (await screen.findByText(nombre)).closest('li')!
}

/** Abre el bloque de borrado de un área y espera a que llegue el impacto. */
async function abrirBorrado(nombre: string) {
  const suya = await fila(nombre)
  fireEvent.click(within(suya, 'Borrar'))
  await screen.findByText(/Borrar «/)
  return suya
}

/** Un botón por su texto dentro de un elemento. */
function within(donde: HTMLElement, texto: string) {
  const boton = [...donde.querySelectorAll('button')].find((b) => b.textContent?.trim() === texto)
  if (!boton) throw new Error(`No hay ningún botón «${texto}» en esa fila`)
  return boton
}

beforeEach(() => {
  vi.clearAllMocks()
  todas.mockResolvedValue(AREAS)
  crear.mockResolvedValue(9)
  renombrar.mockResolvedValue(undefined)
  desactivar.mockResolvedValue(undefined)
  reactivar.mockResolvedValue(undefined)
  borrar.mockResolvedValue(undefined)
  impacto.mockResolvedValue({ areaId: 1, nombre: 'Operaciones', solicitudes: 0, usuarios: 0 })
})

afterEach(cleanup)

describe('La lista', () => {
  it('enseña también las retiradas, o desactivar no tendría vuelta atrás', async () => {
    montar()

    // Si esta pantalla leyera `GET /areas`, «Logística» no estaría y nadie
    // podría volver a encenderla desde el panel.
    expect(await screen.findByText('Logística')).toBeTruthy()
    expect((await fila('Logística')).textContent).toContain('Retirada')
    expect((await fila('Operaciones')).textContent).toContain('En uso')
  })

  it('a la retirada le ofrece reactivar, y a la viva retirar', async () => {
    montar()

    expect(within(await fila('Logística'), 'Reactivar')).toBeTruthy()
    expect(within(await fila('Operaciones'), 'Retirar')).toBeTruthy()
  })

  it('reactivar llama a su propia ruta, no a la de desactivar', async () => {
    montar()

    fireEvent.click(within(await fila('Logística'), 'Reactivar'))

    await waitFor(() => expect(reactivar).toHaveBeenCalledWith(2))
    expect(desactivar).not.toHaveBeenCalled()
  })

  it('sin ninguna área dice qué se rompe, no «no hay nada»', async () => {
    todas.mockResolvedValue([])
    montar()

    // El estado vacío de esta sección no es cosmético: sin área no se puede
    // registrar una solicitud, y sin solicitud no hay vacante.
    expect(await screen.findByText(/solicitud de talento/)).toBeTruthy()
  })

  it('un 403 se explica como el reparto de permisos, no como una avería', async () => {
    todas.mockRejectedValue(new ErrorApi(403, 'No tienes permiso'))
    montar()

    expect(await screen.findByText(/Crear usuarios y asignar roles/)).toBeTruthy()
  })
})

describe('Crear y renombrar', () => {
  it('crear manda el nombre', async () => {
    montar()
    await screen.findByText('Operaciones')

    fireEvent.change(screen.getByLabelText('Nombre del área nueva'), {
      target: { value: 'Comercial' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }))

    await waitFor(() => expect(crear).toHaveBeenCalledWith('Comercial'))
  })

  it('el choque de nombre del backend se enseña tal cual', async () => {
    crear.mockRejectedValue(new ErrorApi(409, 'Ya existe un área llamada «Operaciones»'))
    montar()
    await screen.findByText('Operaciones')

    fireEvent.change(screen.getByLabelText('Nombre del área nueva'), {
      target: { value: 'Operaciones' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }))

    // Un genérico —«no se pudo crear»— borraría la única pista de qué corregir.
    expect(await screen.findByText('Ya existe un área llamada «Operaciones»')).toBeTruthy()
  })

  it('renombrar al mismo nombre no se puede guardar', async () => {
    montar()
    fireEvent.click(within(await fila('Operaciones'), 'Renombrar'))

    const guardar = await screen.findByRole('button', { name: 'Guardar' })
    expect(guardar.hasAttribute('disabled')).toBe(true)

    fireEvent.change(screen.getByLabelText('Nombre nuevo de «Operaciones»'), {
      target: { value: 'Operaciones y Logística' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(renombrar).toHaveBeenCalledWith(1, 'Operaciones y Logística'))
  })
})

describe('Borrar', () => {
  it('pide el impacto AL ABRIR y escribe los dos recuentos antes de confirmar', async () => {
    impacto.mockResolvedValue({ areaId: 1, nombre: 'Operaciones', solicitudes: 3, usuarios: 2 })
    montar()
    await abrirBorrado('Operaciones')

    expect(impacto).toHaveBeenCalledWith(1)
    // Los números tienen que estar en pantalla ANTES de que haya nada que
    // confirmar: es la información por la que existe este bloque.
    const bloque = (await fila('Operaciones')).textContent ?? ''
    expect(bloque).toContain('3')
    expect(bloque).toContain('solicitudes de talento')
    expect(bloque).toContain('2')
    expect(bloque).toContain('personas del equipo')
    expect(borrar).not.toHaveBeenCalled()
  })

  it('con cosas colgando no deja borrar hasta elegir destino y motivo', async () => {
    impacto.mockResolvedValue({ areaId: 1, nombre: 'Operaciones', solicitudes: 3, usuarios: 2 })
    montar()
    await abrirBorrado('Operaciones')

    const confirmar = await screen.findByRole('button', { name: 'Mover todo y borrar' })
    expect(confirmar.hasAttribute('disabled')).toBe(true)

    fireEvent.change(screen.getByLabelText('Todo eso se mueve a'), { target: { value: '3' } })
    expect(
      screen.getByRole('button', { name: 'Mover todo y borrar' }).hasAttribute('disabled'),
    ).toBe(true)

    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'se fusionan' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mover todo y borrar' }))

    await waitFor(() => expect(borrar).toHaveBeenCalledWith(1, 3, 'se fusionan'))
  })

  it('el destino no ofrece ni la que se borra ni las retiradas', async () => {
    impacto.mockResolvedValue({ areaId: 1, nombre: 'Operaciones', solicitudes: 1, usuarios: 0 })
    montar()
    await abrirBorrado('Operaciones')

    const opciones = [...screen.getByLabelText('Todo eso se mueve a').querySelectorAll('option')]
      .map((o) => o.textContent)

    // Mover a la que se borra deja las filas donde estaban; mover a una retirada
    // esconde el trabajo dos veces.
    expect(opciones).toContain('Tecnología')
    expect(opciones).not.toContain('Operaciones')
    expect(opciones).not.toContain('Logística')
  })

  it('un área vacía se borra sin destino, pero sigue pidiendo motivo', async () => {
    montar()
    await abrirBorrado('Operaciones')

    expect(screen.queryByLabelText('Todo eso se mueve a')).toBeNull()
    expect(screen.getByRole('button', { name: 'Borrar el área' }).hasAttribute('disabled')).toBe(true)

    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'se creó dos veces' } })
    fireEvent.click(screen.getByRole('button', { name: 'Borrar el área' }))

    await waitFor(() => expect(borrar).toHaveBeenCalledWith(1, null, 'se creó dos veces'))
  })

  it('el 409 del backend se enseña tal cual: trae los números y dice qué hacer', async () => {
    impacto.mockResolvedValue({ areaId: 1, nombre: 'Operaciones', solicitudes: 3, usuarios: 2 })
    borrar.mockRejectedValue(new ErrorApi(
      409,
      'No se puede borrar «Operaciones»: 3 solicitud(es) de talento y 2 persona(s) del '
        + 'equipo siguen apuntando a ella.',
    ))
    montar()
    await abrirBorrado('Operaciones')

    fireEvent.change(screen.getByLabelText('Todo eso se mueve a'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'se fusionan' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mover todo y borrar' }))

    expect(await screen.findByText(/No se puede borrar «Operaciones»/)).toBeTruthy()
  })

  it('sin ninguna otra área activa lo dice, en vez de dejar un botón que solo puede fallar', async () => {
    todas.mockResolvedValue([{ id: 1, nombre: 'Operaciones', esActiva: true }])
    impacto.mockResolvedValue({ areaId: 1, nombre: 'Operaciones', solicitudes: 2, usuarios: 0 })
    montar()
    await abrirBorrado('Operaciones')

    expect(await screen.findByText(/No hay ninguna otra área activa/)).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Mover todo y borrar' }).hasAttribute('disabled'),
    ).toBe(true)
  })

  it('si el impacto no se puede traer, no se ofrece borrar', async () => {
    impacto.mockRejectedValue(new ErrorApi(500, 'Se cayó'))
    montar()
    fireEvent.click(within(await fila('Operaciones'), 'Borrar'))

    // Borrar a ciegas es exactamente lo que este bloque existe para impedir.
    expect(await screen.findByText(/no se ofrece borrarla/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Borrar el área' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Mover todo y borrar' })).toBeNull()
  })
})

/*
 * Revisión adversarial (31/08/2026). El bloque de borrado promete en su propio
 * comentario que «el precio del borrado se enseña ANTES de confirmar». Estos dos
 * casos montan la pantalla con la MISMA caché que la app de verdad —`App.tsx`
 * pone `staleTime: 30_000` para todas las lecturas— en vez de con la de por
 * defecto de las pruebas de arriba, que caduca al instante y por eso nunca ve
 * esto.
 */
describe('El impacto, con la caché de la app de verdad', () => {
  function montarComoLaApp() {
    const datos = new QueryClient({
      defaultOptions: {
        // Exactamente lo de App.tsx. Sin esta línea el impacto se vuelve a pedir
        // siempre y estas dos comprobaciones no comprueban nada.
        queries: { retry: false, staleTime: 30_000 },
        mutations: { retry: false },
      },
    })
    return render(
      <QueryClientProvider client={datos}>
        <Areas />
      </QueryClientProvider>,
    )
  }

  it('reabrir el borrado no puede enseñar los recuentos de hace medio minuto', async () => {
    impacto.mockResolvedValue({ areaId: 1, nombre: 'Operaciones', solicitudes: 0, usuarios: 0 })
    montarComoLaApp()

    await abrirBorrado('Operaciones')
    expect(await screen.findByText(/No cuelga nada de esta área/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Dejarlo' }))

    // Entre medias alguien registra cuatro solicitudes en esa área. Puede ser otra
    // persona, otra pestaña, o esta misma pantalla borrando otra área con destino
    // «Operaciones»: `refrescar()` invalida `panel-areas` y `panel-areas-todas`,
    // pero nunca `panel-area-impacto`.
    impacto.mockResolvedValue({ areaId: 1, nombre: 'Operaciones', solicitudes: 4, usuarios: 0 })

    fireEvent.click(within(await fila('Operaciones'), 'Borrar'))

    expect(await screen.findByText('4')).toBeTruthy()
    expect(screen.queryByText(/No cuelga nada de esta área/)).toBeNull()
  })

  it('y con los números viejos tampoco puede ofrecer el borrado sin destino', async () => {
    impacto.mockResolvedValue({ areaId: 1, nombre: 'Operaciones', solicitudes: 0, usuarios: 0 })
    montarComoLaApp()

    await abrirBorrado('Operaciones')
    fireEvent.click(screen.getByRole('button', { name: 'Dejarlo' }))

    impacto.mockResolvedValue({ areaId: 1, nombre: 'Operaciones', solicitudes: 4, usuarios: 0 })
    fireEvent.click(within(await fila('Operaciones'), 'Borrar'))
    await screen.findByText(/Borrar «/)

    // Con el impacto viejo la pantalla se cree vacía: no pinta el desplegable de
    // destino y el botón manda `areaDestinoId: null`. El backend contesta 409 y no
    // borra nada, pero quien administra ya había confirmado un borrado que creía
    // que no movía a nadie.
    expect(screen.queryByRole('button', { name: 'Borrar el área' })).toBeNull()
    expect(screen.getByLabelText('Todo eso se mueve a')).toBeTruthy()
  })
})
