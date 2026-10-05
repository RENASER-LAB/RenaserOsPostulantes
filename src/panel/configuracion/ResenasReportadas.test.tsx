/**
 * «Reseñas reportadas» (V63): solo para la plataforma, con las dos listas, la
 * reseña encima cuando lo que se juzga es la respuesta, y la nota obligatoria
 * para mantener u ocultar.
 *
 * Y la ventana de confirmación: «Mantener» y «Ocultar» no envían nada; abren
 * una ventana que dice qué se juzga, lo que pasa y que no se deshace, y solo su
 * botón envía (AC-01…AC-10 de confirmaciones-en-las-resenas).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ErrorApi } from '../api/cliente'
import type { ReporteParaModerar } from '../api/tipos'
import { ResenasReportadas } from './ResenasReportadas'

const api = vi.hoisted(() => ({
  reportesDeResenas: vi.fn(),
  resolverReporte: vi.fn(),
}))
vi.mock('../api/resenas', () => api)

const hace = (dias: number) => new Date(Date.now() - dias * 86_400_000).toISOString()

const reporte = (extra: Partial<ReporteParaModerar>): ReporteParaModerar => ({
  id: 1,
  objeto: 'RESENA',
  empresa: 'Constructora Andina',
  persona: 'Luis Perez',
  estrellas: 1,
  textoResena: 'Llegaba tarde y hablaba mal de sus compañeros de obra.',
  textoRespuesta: null,
  motivo: 'DATOS_PERSONALES',
  comentario: 'Habla de mi salud',
  reportadoEn: hace(2),
  estado: 'PENDIENTE',
  resueltoEn: null,
  notaRevision: null,
  ...extra,
})

function pintar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={cliente}>
      <ResenasReportadas />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset())
})
afterEach(cleanup)

describe('las reseñas reportadas', () => {
  it('AC-22: sin la doble llave (403) la sección no existe', async () => {
    api.reportesDeResenas.mockRejectedValue(new ErrorApi(403, 'Permiso denegado'))
    const { container } = pintar()

    await waitFor(() => expect(api.reportesDeResenas).toHaveBeenCalled())
    await waitFor(() => expect(container.textContent).toBe(''))
  })

  it('las pendientes dicen qué se reporta, de quién a quién, el motivo y el comentario', async () => {
    api.reportesDeResenas.mockResolvedValue([
      reporte({}),
      reporte({
        id: 2,
        objeto: 'RESPUESTA',
        textoRespuesta: 'No es cierto, cumplí cada turno que se me asignó.',
        motivo: 'FALSA',
        comentario: null,
      }),
    ])
    pintar()

    expect(await screen.findByRole('button', { name: 'Pendientes (2)' })).toBeTruthy()
    const [deLaResena, deLaRespuesta] = screen.getAllByRole('article')
    expect(within(deLaResena!).getByText('Constructora Andina → Luis Perez')).toBeTruthy()
    expect(within(deLaResena!).getByText('Revela datos personales o de salud')).toBeTruthy()
    expect(within(deLaResena!).getByText('«Habla de mi salud»')).toBeTruthy()
    // En la de la respuesta, la reseña va de contexto y la respuesta es lo juzgado,
    // con el motivo en las palabras de la empresa.
    expect(within(deLaRespuesta!).getByText('Respuesta')).toBeTruthy()
    expect(within(deLaRespuesta!).getByText(/No es cierto/)).toBeTruthy()
    expect(within(deLaRespuesta!).getByText('Es falsa: cuenta hechos que no pasaron')).toBeTruthy()
  })

  it('mantener u ocultar sin nota no se envía; con nota, sí', async () => {
    api.reportesDeResenas.mockResolvedValue([reporte({})])
    api.resolverReporte.mockResolvedValue(reporte({ estado: 'OCULTADA' }))
    pintar()

    fireEvent.click(await screen.findByRole('button', { name: 'Ocultar' }))
    expect(await screen.findByText(/Escribe la nota de la revisión/)).toBeTruthy()
    expect(api.resolverReporte).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Nota de la revisión'), {
      target: { value: 'Revela datos de salud' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar' }))
    // Con nota, «Ocultar» abre la ventana: todavía no se envía nada.
    const ventana = await screen.findByRole('dialog', { name: 'Ocultar la reseña' })
    expect(api.resolverReporte).not.toHaveBeenCalled()

    fireEvent.click(within(ventana).getByRole('button', { name: 'Ocultar la reseña' }))
    await waitFor(() =>
      expect(api.resolverReporte).toHaveBeenCalledWith(1, {
        decision: 'OCULTAR',
        nota: 'Revela datos de salud',
      }),
    )
  })

  it('RES-QA-03 y AC-07: un doble clic en «Ocultar la reseña» resuelve una sola vez, y el foco va al título', async () => {
    api.reportesDeResenas.mockResolvedValueOnce([reporte({})]).mockResolvedValue([])
    api.resolverReporte.mockResolvedValue(reporte({ estado: 'OCULTADA' }))
    pintar()

    fireEvent.change(await screen.findByLabelText('Nota de la revisión'), {
      target: { value: 'Revela datos de salud' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar' }))
    const confirmar = within(await screen.findByRole('dialog')).getByRole('button', {
      name: 'Ocultar la reseña',
    })
    act(() => {
      confirmar.click()
      confirmar.click()
    })

    expect(await screen.findByText('No hay nada pendiente de revisar.')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(api.resolverReporte).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Reseñas reportadas' }))
  })

  it('las resueltas dicen en qué quedó, y la retirada quién la retiró', async () => {
    api.reportesDeResenas.mockImplementation((resueltos: boolean) =>
      Promise.resolve(
        resueltos
          ? [
              reporte({ id: 3, estado: 'MANTENIDA', resueltoEn: hace(1), notaRevision: 'Cumple' }),
              reporte({ id: 4, estado: 'RETIRADA', resueltoEn: hace(1) }),
            ]
          : [],
      ),
    )
    pintar()

    expect(await screen.findByText('No hay nada pendiente de revisar.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Resueltas' }))
    expect(await screen.findByText('Se mantuvo')).toBeTruthy()
    expect(screen.getByText('Retirada por la empresa')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Ocultar' })).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// La ventana de confirmación (confirmaciones-en-las-resenas)
// ---------------------------------------------------------------------------

const NOTA = 'Menciona un diagnóstico médico de la persona.'
const deUnaRespuesta = (extra: Partial<ReporteParaModerar> = {}) =>
  reporte({
    id: 2,
    objeto: 'RESPUESTA',
    textoRespuesta: 'No es cierto, cumplí cada turno que se me asignó.',
    motivo: 'FALSA',
    comentario: null,
    ...extra,
  })

/** Escribe la nota en la única tarjeta pendiente y pulsa la decisión. */
async function pulsar(decision: 'Ocultar' | 'Mantener', nota = NOTA) {
  fireEvent.change(await screen.findByLabelText('Nota de la revisión'), { target: { value: nota } })
  const boton = screen.getByRole('button', { name: decision })
  boton.focus()
  fireEvent.click(boton)
  return boton
}

describe('la confirmación de la moderación', () => {
  it('AC-01: con la nota vacía o de solo espacios, sale el error y no se abre la ventana', async () => {
    api.reportesDeResenas.mockResolvedValue([reporte({})])
    pintar()

    for (const decision of ['Ocultar', 'Mantener'] as const) {
      for (const nota of ['', '    ']) {
        fireEvent.change(await screen.findByLabelText('Nota de la revisión'), { target: { value: nota } })
        fireEvent.click(screen.getByRole('button', { name: decision }))
        expect(screen.getByRole('alert').textContent).toMatch(/Escribe la nota de la revisión/)
        expect(screen.queryByRole('dialog')).toBeNull()
      }
    }
    expect(api.resolverReporte).not.toHaveBeenCalled()
  })

  it('la nota de 1000 caracteres abre la ventana y se lee entera; la de 1001 se queda en el error', async () => {
    api.reportesDeResenas.mockResolvedValue([reporte({})])
    pintar()

    await pulsar('Ocultar', 'n'.repeat(1001))
    expect(screen.getByRole('alert').textContent).toBe('La nota admite hasta 1000 caracteres.')
    expect(screen.queryByRole('dialog')).toBeNull()

    await pulsar('Ocultar', 'n'.repeat(1000))
    const ventana = await screen.findByRole('dialog', { name: 'Ocultar la reseña' })
    expect(within(ventana).getByText(`«${'n'.repeat(1000)}»`)).toBeTruthy()
    expect(api.resolverReporte).not.toHaveBeenCalled()
  })

  it('AC-02: «Ocultar» abre «Ocultar la reseña» con la empresa, la persona, lo que pasa, la nota y «No se podrá deshacer»', async () => {
    api.reportesDeResenas.mockResolvedValue([reporte({})])
    pintar()

    await pulsar('Ocultar', `  ${NOTA}  `)
    const ventana = await screen.findByRole('dialog', { name: 'Ocultar la reseña' })
    expect(within(ventana).getByText('Reseña de Constructora Andina a Luis Perez')).toBeTruthy()
    expect(within(ventana).getAllByRole('listitem')).toHaveLength(3)
    expect(within(ventana).getByText('Tu nota')).toBeTruthy()
    // La nota completa, entre comillas y sin los espacios de los extremos: lo que se enviará.
    expect(within(ventana).getByText(`«${NOTA}»`)).toBeTruthy()
    expect(within(ventana).getByText('No se podrá deshacer.')).toBeTruthy()
    expect(within(ventana).getByRole('button', { name: 'Volver' })).toBeTruthy()
    expect(api.resolverReporte).not.toHaveBeenCalled()
  })

  it.each([
    {
      caso: 'ocultar una reseña',
      decision: 'Ocultar' as const,
      objeto: reporte({}),
      titulo: 'Ocultar la reseña',
      juzgado: 'Reseña de Constructora Andina a Luis Perez',
      loQuePasa: [
        'Deja de verse en el perfil de la persona y en el panel de las demás empresas, y deja de contar en el promedio.',
        'La empresa autora la verá atenuada, con tu nota.',
        'A la persona le llega «Revisamos tu reporte: la ocultamos».',
      ],
    },
    {
      caso: 'mantener una reseña',
      decision: 'Mantener' as const,
      objeto: reporte({}),
      titulo: 'Mantener la reseña',
      juzgado: 'Reseña de Constructora Andina a Luis Perez',
      loQuePasa: [
        'Sigue visible y contando.',
        'A la persona le llega «Revisamos tu reporte: la mantuvimos».',
        'Solo se podrá volver a reportar si la empresa la edita.',
      ],
    },
    {
      caso: 'ocultar una respuesta (AC-06)',
      decision: 'Ocultar' as const,
      objeto: deUnaRespuesta(),
      titulo: 'Ocultar la respuesta',
      juzgado: 'Respuesta de Luis Perez a la reseña de Constructora Andina',
      loQuePasa: [
        'Deja de verse para todas las empresas.',
        'La persona la verá atenuada, con tu nota, y no podrá editarla, borrarla ni volver a responder a esa reseña.',
        'Le llega un aviso a la campana.',
      ],
    },
    {
      caso: 'mantener una respuesta (AC-06)',
      decision: 'Mantener' as const,
      objeto: deUnaRespuesta(),
      titulo: 'Mantener la respuesta',
      juzgado: 'Respuesta de Luis Perez a la reseña de Constructora Andina',
      loQuePasa: [
        'Nada cambia.',
        'La empresa autora verá «La plataforma la mantuvo» con tu nota.',
        'A la persona no se le avisa.',
        'Solo se podrá volver a reportar si la persona la edita.',
      ],
    },
  ])('el texto de $caso', async ({ decision, objeto, titulo, juzgado, loQuePasa }) => {
    api.reportesDeResenas.mockResolvedValue([objeto])
    pintar()

    await pulsar(decision)
    const ventana = await screen.findByRole('dialog', { name: titulo })
    expect(within(ventana).getByText(juzgado)).toBeTruthy()
    expect(within(ventana).getAllByRole('listitem').map((li) => li.textContent)).toEqual(loQuePasa)
    expect(within(ventana).getByRole('button', { name: titulo })).toBeTruthy()
    expect(within(ventana).getByText('No se podrá deshacer.')).toBeTruthy()
  })

  it('AC-03: «Volver», Escape, el aspa o el fondo cierran sin enviar; sigue pendiente, con la nota y el foco en el botón pulsado', async () => {
    api.reportesDeResenas.mockResolvedValue([reporte({})])
    pintar()

    const cierres = {
      Volver: () => fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Volver' })),
      Escape: () => fireEvent.keyDown(document, { key: 'Escape' }),
      aspa: () => fireEvent.click(screen.getByRole('button', { name: 'Cerrar' })),
      fondo: () => fireEvent.click(screen.getByRole('dialog').previousElementSibling!),
    }
    for (const decision of ['Ocultar', 'Mantener'] as const) {
      for (const [como, cerrar] of Object.entries(cierres)) {
        const boton = await pulsar(decision)
        await screen.findByRole('dialog')

        act(() => cerrar())
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
        expect(screen.getByRole('button', { name: 'Pendientes (1)' })).toBeTruthy()
        expect((screen.getByLabelText('Nota de la revisión') as HTMLTextAreaElement).value).toBe(NOTA)
        await waitFor(() => expect(document.activeElement, `«${decision}» cerrado con ${como}`).toBe(boton))
      }
    }
    expect(api.resolverReporte).not.toHaveBeenCalled()
  })

  it('AC-04: confirmar «Ocultar la reseña» envía OCULTAR, cierra, la deja en «Resueltas» como «Se ocultó» y el foco va al título', async () => {
    let resuelto = false
    api.reportesDeResenas.mockImplementation((resueltos: boolean) =>
      Promise.resolve(
        resueltos === resuelto
          ? [reporte(resuelto ? { estado: 'OCULTADA', resueltoEn: hace(0), notaRevision: NOTA } : {})]
          : [],
      ),
    )
    api.resolverReporte.mockImplementation(() => {
      resuelto = true
      return Promise.resolve(reporte({ estado: 'OCULTADA' }))
    })
    pintar()

    await pulsar('Ocultar')
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Ocultar la reseña' }))

    expect(await screen.findByText('No hay nada pendiente de revisar.')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(api.resolverReporte).toHaveBeenCalledWith(1, { decision: 'OCULTAR', nota: NOTA })
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Reseñas reportadas' }))
    fireEvent.click(screen.getByRole('button', { name: 'Resueltas' }))
    expect(await screen.findByText('Se ocultó')).toBeTruthy()
  })

  it('AC-05: «Mantener» y «Mantener la reseña» envían MANTENER, y queda en «Resueltas» como «Se mantuvo»', async () => {
    let resuelto = false
    api.reportesDeResenas.mockImplementation((resueltos: boolean) =>
      Promise.resolve(
        resueltos === resuelto
          ? [reporte(resuelto ? { estado: 'MANTENIDA', resueltoEn: hace(0), notaRevision: NOTA } : {})]
          : [],
      ),
    )
    api.resolverReporte.mockImplementation(() => {
      resuelto = true
      return Promise.resolve(reporte({ estado: 'MANTENIDA' }))
    })
    pintar()

    await pulsar('Mantener')
    const ventana = await screen.findByRole('dialog', { name: 'Mantener la reseña' })
    expect(api.resolverReporte).not.toHaveBeenCalled()
    fireEvent.click(within(ventana).getByRole('button', { name: 'Mantener la reseña' }))

    expect(await screen.findByText('No hay nada pendiente de revisar.')).toBeTruthy()
    expect(api.resolverReporte).toHaveBeenCalledWith(1, { decision: 'MANTENER', nota: NOTA })
    fireEvent.click(screen.getByRole('button', { name: 'Resueltas' }))
    expect(await screen.findByText('Se mantuvo')).toBeTruthy()
  })

  it('AC-08: el foco inicial no está en el botón de confirmar, y un Intro en seguida cierra sin resolver', async () => {
    api.reportesDeResenas.mockResolvedValue([reporte({})])
    pintar()

    const ocultar = await pulsar('Ocultar')
    const ventana = await screen.findByRole('dialog')
    const confirmar = within(ventana).getByRole('button', { name: 'Ocultar la reseña' })
    expect(ventana.contains(document.activeElement)).toBe(true)
    expect(document.activeElement).not.toBe(confirmar)

    // Intro sobre un botón es su clic: el que tiene el foco ahora.
    act(() => (document.activeElement as HTMLElement).click())
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(api.resolverReporte).not.toHaveBeenCalled()
    await waitFor(() => expect(document.activeElement).toBe(ocultar))
  })

  it('mientras se guarda: los dos botones apagados, «Guardando…», y la ventana no se cierra', async () => {
    let terminar: () => void = () => undefined
    api.reportesDeResenas.mockResolvedValueOnce([reporte({})]).mockResolvedValue([])
    api.resolverReporte.mockImplementation(
      () => new Promise((listo) => (terminar = () => listo(reporte({ estado: 'OCULTADA' })))),
    )
    pintar()

    await pulsar('Ocultar')
    const ventana = await screen.findByRole('dialog')
    fireEvent.click(within(ventana).getByRole('button', { name: 'Ocultar la reseña' }))

    const guardando = await within(ventana).findByRole('button', { name: 'Guardando…' })
    expect(guardando).toHaveProperty('disabled', true)
    expect(within(ventana).getByRole('button', { name: 'Volver' })).toHaveProperty('disabled', true)
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    fireEvent.click(ventana.previousElementSibling!)
    expect(screen.getByRole('dialog')).toBe(ventana)

    await act(async () => terminar())
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(api.resolverReporte).toHaveBeenCalledTimes(1)
  })

  it('AC-09: si otra persona ya lo resolvió (409), se cierra, sale de «Pendientes» y el porqué queda encima de la lista', async () => {
    api.reportesDeResenas
      .mockResolvedValueOnce([reporte({}), deUnaRespuesta()])
      .mockResolvedValue([deUnaRespuesta()])
    api.resolverReporte.mockRejectedValue(new ErrorApi(409, 'Este reporte ya se resolvió'))
    pintar()

    const [deLaResena] = await screen.findAllByRole('article')
    fireEvent.change(within(deLaResena!).getByLabelText('Nota de la revisión'), {
      target: { value: NOTA },
    })
    fireEvent.click(within(deLaResena!).getByRole('button', { name: 'Ocultar' }))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Ocultar la reseña' }))

    expect(await screen.findByRole('button', { name: 'Pendientes (1)' })).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    const aviso = screen.getByRole('alert')
    expect(aviso.textContent).toBe('Este reporte ya se resolvió')
    // Encima de la lista, y no dentro de una tarjeta.
    expect(aviso.closest('article')).toBeNull()
    expect(aviso.compareDocumentPosition(screen.getByRole('list')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getAllByRole('article')).toHaveLength(1)
    expect(api.resolverReporte).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Reseñas reportadas' }))
  })

  it.each([
    // Sin red, la puerta al backend lanza un ErrorApi sin estado (0).
    ['por red', new ErrorApi(0, 'No pudimos conectar. Revisa tu conexión.')],
    ['por un error del servidor', new ErrorApi(500, 'No pudimos guardar la revisión.')],
  ])('AC-10: si falla %s, la ventana sigue con el error, los botones vuelven y se reintenta con la misma nota', async (_, causa) => {
    api.reportesDeResenas.mockResolvedValueOnce([reporte({})]).mockResolvedValue([])
    api.resolverReporte.mockRejectedValueOnce(causa).mockResolvedValue(reporte({ estado: 'OCULTADA' }))
    pintar()

    await pulsar('Ocultar')
    const ventana = await screen.findByRole('dialog')
    fireEvent.click(within(ventana).getByRole('button', { name: 'Ocultar la reseña' }))

    expect((await within(ventana).findByRole('alert')).textContent).toBe(causa.message)
    const confirmar = within(ventana).getByRole('button', { name: 'Ocultar la reseña' })
    await waitFor(() => expect(confirmar).toHaveProperty('disabled', false))
    expect(within(ventana).getByRole('button', { name: 'Volver' })).toHaveProperty('disabled', false)
    await waitFor(() => expect(document.activeElement).toBe(confirmar))
    expect(screen.getByRole('dialog')).toBe(ventana)

    fireEvent.click(confirmar)
    expect(await screen.findByText('No hay nada pendiente de revisar.')).toBeTruthy()
    expect(api.resolverReporte).toHaveBeenCalledTimes(2)
    expect(api.resolverReporte).toHaveBeenLastCalledWith(1, { decision: 'OCULTAR', nota: NOTA })
  })

  it('QA-03: la lista de «lo que pasa» lleva role="list": mundo.css le quita las viñetas y, sin él, Safari y VoiceOver no la leen como lista', async () => {
    api.reportesDeResenas.mockResolvedValue([reporte({})])
    pintar()

    await pulsar('Ocultar')
    const ventana = await screen.findByRole('dialog', { name: 'Ocultar la reseña' })
    const lista = within(ventana).getByRole('list')
    expect(lista.getAttribute('role')).toBe('list')
    expect(within(lista).getAllByRole('listitem')).toHaveLength(3)
  })
})
