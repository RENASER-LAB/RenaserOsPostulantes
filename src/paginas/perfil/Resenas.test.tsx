/**
 * «Reseñas de empresas» en el perfil (V63).
 *
 * Lo que se prueba: el resumen y las dos más recientes, «Ver todas» solo con
 * más de dos, el vacío y el fallo con «Reintentar»; los pasos de reportar y de
 * responder DENTRO de la misma ventana, con la validación junto al campo y sin
 * enviar nada; y lo que la tarjeta dice después —en revisión, ocultada—.
 *
 * Las fechas son relativas a hoy: las quemadas caducan.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { MisResenas, ResenaMia } from '@/api/tipos'
import { ResenasDelPerfil } from './Resenas'

const api = vi.hoisted(() => ({
  misResenas: vi.fn(),
  reportarResena: vi.fn(),
  responderResena: vi.fn(),
  editarRespuesta: vi.fn(),
  borrarRespuesta: vi.fn(),
}))
vi.mock('@/api/resenas', () => api)

const haceDias = (dias: number) => new Date(Date.now() - dias * 86_400_000).toISOString()
const OPINION = 'Muy responsable con los plazos y con el equipo de obra en todo momento.'
const RESPUESTA = 'Gracias por la oportunidad, aprendí mucho con todo el equipo de obra.'

const resena = (id: number, estrellas: number, empresa: string, dias: number,
  extra: Partial<ResenaMia> = {}): ResenaMia => ({
  id,
  estrellas,
  empresa,
  puesto: 'Desarrollador Backend',
  texto: OPINION,
  publicadaEn: haceDias(dias),
  editada: false,
  respuesta: null,
  puedeResponder: true,
  puedeReportar: true,
  reportadaEnRevision: false,
  ...extra,
})

const conTres: MisResenas = {
  resumen: {
    promedio: 4.7,
    cantidad: 3,
    reparto: [
      { estrellas: 5, cantidad: 2 },
      { estrellas: 4, cantidad: 1 },
      { estrellas: 3, cantidad: 0 },
      { estrellas: 2, cantidad: 0 },
      { estrellas: 1, cantidad: 0 },
    ],
  },
  resenas: [
    resena(1, 5, 'Constructora Andina', 3),
    resena(2, 5, 'Acme', 10),
    resena(3, 4, 'Constructora Andina', 20),
  ],
}

function pintar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={['/perfil']}>
        <ResenasDelPerfil />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset())
  api.reportarResena.mockResolvedValue(undefined)
  api.responderResena.mockResolvedValue(undefined)
})
afterEach(cleanup)

describe('la sección del perfil', () => {
  it('AC-12 y AC-14: el resumen, las dos más recientes y «Ver todas (3)»', async () => {
    api.misResenas.mockResolvedValue(conTres)
    pintar()

    expect(await screen.findByText('4,7')).toBeTruthy()
    expect(screen.getByText('3 reseñas')).toBeTruthy()
    expect(screen.getAllByRole('article')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Ver todas las reseñas (3)' })).toBeTruthy()
    expect(screen.getAllByText('Contratado como Desarrollador Backend')).toHaveLength(2)
  })

  it('AC-14: con dos o menos no hay «Ver todas»', async () => {
    api.misResenas.mockResolvedValue({ ...conTres, resenas: conTres.resenas.slice(0, 2) })
    pintar()

    await screen.findAllByRole('article')
    expect(screen.queryByRole('button', { name: /Ver todas/ })).toBeNull()
  })

  it('AC-13: sin reseñas, la sección sale igual con su explicación', async () => {
    api.misResenas.mockResolvedValue({
      resumen: { promedio: null, cantidad: 0, reparto: [] },
      resenas: [],
    })
    pintar()

    expect(await screen.findByText(/Todavía no tienes reseñas/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Reseñas de empresas' })).toBeTruthy()
    expect(screen.getByText(/Te las escriben las empresas que te contrataron por EX/)).toBeTruthy()
  })

  it('AC-25: si falla la carga lo dice con «Reintentar», y reintentar funciona', async () => {
    api.misResenas.mockRejectedValueOnce(new Error('caído')).mockResolvedValueOnce(conTres)
    pintar()

    expect(await screen.findByText('No pudimos cargar las reseñas.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('4,7')).toBeTruthy()
  })

  it('AC-19: reportada y pendiente, dice «en revisión» y no se puede reportar otra vez', async () => {
    api.misResenas.mockResolvedValue({
      ...conTres,
      resenas: [resena(1, 2, 'Acme', 3, { reportadaEnRevision: true, puedeReportar: false })],
    })
    pintar()

    expect(await screen.findByText('Reportada · en revisión')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Reportar' })).toBeNull()
  })

  it('AC-39: su respuesta ocultada se ve atenuada con la nota, sin editar, borrar ni responder', async () => {
    api.misResenas.mockResolvedValue({
      ...conTres,
      resenas: [
        resena(1, 2, 'Acme', 3, {
          puedeResponder: false,
          respuesta: {
            texto: RESPUESTA,
            publicadaEn: haceDias(2),
            editada: false,
            editableHasta: haceDias(-28),
            editable: false,
            ocultada: true,
            notaOcultacion: 'Insulta a la empresa',
          },
        }),
      ],
    })
    pintar()

    expect(
      await screen.findByText('La plataforma ocultó tu respuesta: Insulta a la empresa'),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Borrar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Responder' })).toBeNull()
  })
})

describe('los pasos dentro de la misma ventana', () => {
  it('AC-18: con «Otro motivo» y sin comentario no se envía; con él, sí', async () => {
    api.misResenas.mockResolvedValue(conTres)
    pintar()

    fireEvent.click((await screen.findAllByRole('button', { name: 'Reportar' }))[0]!)
    const ventana = await screen.findByRole('dialog', {
      name: 'Reportar la reseña de Constructora Andina',
    })
    expect(within(ventana).getByText('La reseña sigue visible mientras la revisamos.')).toBeTruthy()

    fireEvent.click(within(ventana).getByLabelText('Otro motivo'))
    fireEvent.click(screen.getByRole('button', { name: 'Enviar reporte' }))
    expect(await within(ventana).findByText(/Con «Otro motivo», cuéntanos/)).toBeTruthy()
    expect(api.reportarResena).not.toHaveBeenCalled()

    fireEvent.change(within(ventana).getByLabelText(/Cuéntanos más/), {
      target: { value: 'Nunca trabajé en esa obra' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar reporte' }))
    await waitFor(() =>
      expect(api.reportarResena).toHaveBeenCalledWith(1, {
        motivo: 'OTRO',
        comentario: 'Nunca trabajé en esa obra',
      }),
    )
  })

  it('AC-34: una respuesta corta no se envía; una de 30 a 500 sí, sin los espacios de los extremos', async () => {
    api.misResenas.mockResolvedValue(conTres)
    pintar()

    fireEvent.click((await screen.findAllByRole('button', { name: 'Responder' }))[0]!)
    const ventana = await screen.findByRole('dialog', {
      name: 'Responder a la reseña de Constructora Andina',
    })
    const campo = within(ventana).getByLabelText('Tu respuesta')
    expect(within(ventana).getByText('0/500 · mínimo 30')).toBeTruthy()

    fireEvent.change(campo, { target: { value: 'Gracias.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar respuesta' }))
    expect(await within(ventana).findByText(/al menos 30 caracteres/)).toBeTruthy()
    expect(api.responderResena).not.toHaveBeenCalled()

    fireEvent.change(campo, { target: { value: `  ${RESPUESTA}  ` } })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar respuesta' }))
    await waitFor(() => expect(api.responderResena).toHaveBeenCalledWith(1, RESPUESTA))
  })

  it('AC-26: si la reseña ya no está, lo dice y no se queda escribiendo', async () => {
    const { ErrorApi } = await import('@/api/puerta')
    api.misResenas.mockResolvedValueOnce(conTres).mockResolvedValue({
      ...conTres,
      resenas: conTres.resenas.slice(1),
    })
    api.responderResena.mockRejectedValue(new ErrorApi(404, 'Reseña not found'))
    pintar()

    fireEvent.click((await screen.findAllByRole('button', { name: 'Responder' }))[0]!)
    const ventana = await screen.findByRole('dialog')
    fireEvent.change(within(ventana).getByLabelText('Tu respuesta'), {
      target: { value: RESPUESTA },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar respuesta' }))

    expect(await screen.findByText('Esta reseña ya no está disponible.')).toBeTruthy()
  })

  it('AC-15 y AC-32: la barra «4★» filtra, y al cerrar el foco vuelve a «Ver todas»', async () => {
    api.misResenas.mockResolvedValue(conTres)
    pintar()

    const verTodas = await screen.findByRole('button', { name: 'Ver todas las reseñas (3)' })
    verTodas.focus()
    fireEvent.click(verTodas)
    const ventana = await screen.findByRole('dialog', { name: 'Reseñas de empresas' })
    expect(within(ventana).getByText('Se ven 3 de 3')).toBeTruthy()
    // Dos empresas: el filtro «Empresa» sale.
    expect(within(ventana).getByLabelText('Empresa')).toBeTruthy()

    fireEvent.click(within(ventana).getByRole('button', { name: 'Ver solo las de 4 estrellas (1)' }))
    expect(within(ventana).getByText('Se ven 1 de 3')).toBeTruthy()
    expect(within(ventana).getByRole('button', { name: '4 estrellas (1)' }).getAttribute('aria-pressed')).toBe('true')
    // Los chips en cero salen deshabilitados.
    expect(within(ventana).getByRole('button', { name: '3 estrellas (0)' })).toHaveProperty('disabled', true)

    fireEvent.click(within(ventana).getAllByRole('button', { name: 'Quitar filtros' })[0]!)
    expect(within(ventana).getByText('Se ven 3 de 3')).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(verTodas)
  })

  it('RES-QA-02: al volver de «Reportar» a la lista, el foco vuelve a su botón, dentro de la ventana', async () => {
    api.misResenas.mockResolvedValue(conTres)
    pintar()

    fireEvent.click(await screen.findByRole('button', { name: 'Ver todas las reseñas (3)' }))
    const lista = await screen.findByRole('dialog', { name: 'Reseñas de empresas' })
    const deAcme = within(lista).getAllByRole('article')[1]!
    fireEvent.click(within(deAcme).getByRole('button', { name: 'Reportar' }))
    await screen.findByRole('dialog', { name: 'Reportar la reseña de Acme' })

    fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
    const deVuelta = await screen.findByRole('dialog', { name: 'Reseñas de empresas' })
    await waitFor(() => expect(document.activeElement?.getAttribute('data-foco')).toBe('reportar-2'))
    expect(deVuelta.contains(document.activeElement)).toBe(true)
  })

  it('RES-QA-02: tras reportar desde la lista, sin su botón, el foco queda en su fila', async () => {
    api.misResenas.mockResolvedValueOnce(conTres).mockResolvedValue({
      ...conTres,
      resenas: conTres.resenas.map((r) =>
        r.id === 2 ? { ...r, puedeReportar: false, reportadaEnRevision: true } : r,
      ),
    })
    pintar()

    fireEvent.click(await screen.findByRole('button', { name: 'Ver todas las reseñas (3)' }))
    const lista = await screen.findByRole('dialog', { name: 'Reseñas de empresas' })
    fireEvent.click(within(within(lista).getAllByRole('article')[1]!).getByRole('button', { name: 'Reportar' }))
    const paso = await screen.findByRole('dialog', { name: 'Reportar la reseña de Acme' })
    fireEvent.click(within(paso).getAllByRole('radio')[0]!)
    fireEvent.click(screen.getByRole('button', { name: 'Enviar reporte' }))

    await waitFor(() => expect(document.activeElement?.getAttribute('data-resena')).toBe('2'))
    expect(screen.getByRole('dialog', { name: 'Reseñas de empresas' }).contains(document.activeElement)).toBe(true)
    expect(api.reportarResena).toHaveBeenCalledTimes(1)
  })

  it('RES-QA-03: dos envíos seguidos de «Publicar respuesta» mandan una sola; al terminar, el foco no se pierde', async () => {
    let terminar: () => void = () => undefined
    api.responderResena.mockImplementation(() => new Promise<void>((listo) => (terminar = listo)))
    api.misResenas.mockResolvedValue(conTres)
    pintar()

    fireEvent.click((await screen.findAllByRole('button', { name: 'Responder' }))[0]!)
    const ventana = await screen.findByRole('dialog')
    fireEvent.change(within(ventana).getByLabelText('Tu respuesta'), { target: { value: RESPUESTA } })
    // El envío del formulario, dos veces antes de que nada se pinte: el
    // candado es síncrono y no depende de que el botón ya esté deshabilitado.
    const formulario = ventana.querySelector('form')!
    act(() => {
      fireEvent.submit(formulario)
      fireEvent.submit(formulario)
    })
    expect(screen.getByRole('button', { name: 'Publicando…' })).toHaveProperty('disabled', true)
    await waitFor(() => expect(api.responderResena).toHaveBeenCalledTimes(1))

    terminar()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    // Se abrió desde la sección: el foco vuelve a su «Responder».
    await waitFor(() => expect(document.activeElement?.getAttribute('data-foco')).toBe('responder-1'))
    expect(api.responderResena).toHaveBeenCalledTimes(1)
  })

  it('borrar tu respuesta: el foco va a «Cancelar» de la confirmación y, al cancelar, vuelve a «Borrar»', async () => {
    api.misResenas.mockResolvedValue({
      ...conTres,
      resenas: [
        resena(1, 5, 'Acme', 3, {
          puedeResponder: false,
          respuesta: {
            texto: RESPUESTA,
            publicadaEn: haceDias(2),
            editada: false,
            editableHasta: haceDias(-28),
            editable: true,
            ocultada: false,
            notaOcultacion: null,
          },
        }),
      ],
    })
    pintar()

    fireEvent.click(await screen.findByRole('button', { name: 'Borrar' }))
    const confirmar = screen.getByRole('group', { name: 'Borrar tu respuesta' })
    await waitFor(() =>
      expect(document.activeElement).toBe(within(confirmar).getByRole('button', { name: 'Cancelar' })),
    )
    fireEvent.click(within(confirmar).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Borrar' })))
  })

  it('AC-17: con reseñas de una sola empresa, no hay filtro «Empresa»', async () => {
    api.misResenas.mockResolvedValue({
      ...conTres,
      resenas: conTres.resenas.map((r) => ({ ...r, empresa: 'Acme' })),
    })
    pintar()

    fireEvent.click(await screen.findByRole('button', { name: 'Ver todas las reseñas (3)' }))
    const ventana = await screen.findByRole('dialog')
    expect(within(ventana).queryByLabelText('Empresa')).toBeNull()
    expect(within(ventana).getByLabelText('Orden')).toBeTruthy()
  })
})
