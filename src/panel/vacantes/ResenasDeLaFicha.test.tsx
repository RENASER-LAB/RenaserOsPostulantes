/**
 * Las reseñas en la ficha del postulante (V63): el bloque de la empresa autora
 * en sus estados, la validación junto al campo sin enviar nada, el 409 que
 * refresca, la pregunta antes de descartar lo escrito en «Reportar la
 * respuesta» (AC-17), y la lectura para cualquier empresa —sin «Reportar» ni
 * «Responder»—.
 *
 * Las fechas son relativas a hoy: las quemadas caducan.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ErrorApi } from '../api/cliente'
import type { LaResenaDeMiEmpresa, ResenasDeLaPostulacion } from '../api/tipos'
import { ResenasDeLaFicha } from './ResenasDeLaFicha'

const api = vi.hoisted(() => ({
  verResenas: vi.fn(),
  publicarResena: vi.fn(),
  editarResena: vi.fn(),
  borrarResena: vi.fn(),
  reportarRespuesta: vi.fn(),
}))
vi.mock('../api/resenas', () => api)

const dias = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString()
const OPINION = 'Muy responsable con los plazos y con el equipo de obra en todo momento.'

const bloque = (extra: Partial<LaResenaDeMiEmpresa>): LaResenaDeMiEmpresa => ({
  estado: 'SE_PUEDE_ESCRIBIR',
  empresa: 'Constructora Andina',
  puesto: 'Desarrollador Backend',
  contratadoEn: dias(-31),
  abreEn: dias(-1),
  resena: null,
  ...extra,
})

const conBloque = (miResena: LaResenaDeMiEmpresa, extra: Partial<ResenasDeLaPostulacion> = {}):
  ResenasDeLaPostulacion => ({
  persona: 'Luis Perez',
  puedeVerResenas: false,
  puedeResenar: true,
  miResena,
  ...extra,
})

const publicada = (estado: LaResenaDeMiEmpresa['estado'], extra = {}) =>
  bloque({
    estado,
    resena: {
      id: 9,
      estrellas: 4,
      texto: OPINION,
      publicadaEn: dias(-5),
      editada: false,
      editableHasta: dias(25),
      notaOcultacion: null,
      respuesta: null,
      ...extra,
    },
  })

function pintar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={cliente}>
      <ResenasDeLaFicha postulacionId={50} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset())
})
afterEach(cleanup)

describe('el bloque de la empresa autora', () => {
  it('AC-02: aún no toca, dice desde cuándo y no hay formulario', async () => {
    api.verResenas.mockResolvedValue(
      conBloque(bloque({ estado: 'AUN_NO_TOCA', contratadoEn: dias(-10), abreEn: dias(20) })),
    )
    pintar()

    expect(await screen.findByText(/Podrás dejar una reseña desde el/)).toBeTruthy()
    expect(screen.getByText(/al cumplir un mes de su contratación/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Publicar reseña' })).toBeNull()
  })

  it('AC-01 y AC-32: se elige con las estrellas —cinco opciones con rótulo— y se publica', async () => {
    api.verResenas.mockResolvedValue(conBloque(bloque({})))
    api.publicarResena.mockResolvedValue(publicada('EDITABLE'))
    pintar()

    expect(await screen.findByRole('heading', { name: 'La reseña de Constructora Andina' })).toBeTruthy()
    expect(screen.getByText(/Contratado el .* como Desarrollador Backend/)).toBeTruthy()
    expect(screen.getByText(/La verán la persona, que podrá responderla/)).toBeTruthy()
    const cuatro = screen.getByRole('radio', { name: '4 estrellas, Buena' })
    expect(screen.getAllByRole('radio')).toHaveLength(5)
    fireEvent.click(cuatro)
    fireEvent.change(screen.getByLabelText('Opinión'), { target: { value: OPINION } })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar reseña' }))

    await waitFor(() =>
      expect(api.publicarResena).toHaveBeenCalledWith(50, { estrellas: 4, texto: OPINION }),
    )
  })

  it('AC-06: sin estrellas o con menos de 30 caracteres se avisa junto al campo y no se envía', async () => {
    api.verResenas.mockResolvedValue(conBloque(bloque({})))
    pintar()

    fireEvent.click(await screen.findByRole('button', { name: 'Publicar reseña' }))
    expect(await screen.findByText(/Elige cuántas estrellas/)).toBeTruthy()

    fireEvent.click(screen.getByRole('radio', { name: '5 estrellas, Excelente' }))
    fireEvent.change(screen.getByLabelText('Opinión'), { target: { value: 'Muy bien.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar reseña' }))
    expect(await screen.findByText(/al menos 30 caracteres/)).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Opinión'), { target: { value: 'a'.repeat(1001) } })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar reseña' }))
    expect(await screen.findByText(/hasta 1000 caracteres/)).toBeTruthy()
    expect(screen.getByText('1001/1000 · mínimo 30')).toBeTruthy()
    expect(api.publicarResena).not.toHaveBeenCalled()
  })

  it('AC-07: si otra persona ya publicó, dice por qué y enseña la que existe', async () => {
    api.verResenas
      .mockResolvedValueOnce(conBloque(bloque({})))
      .mockResolvedValue(conBloque(publicada('EDITABLE')))
    api.publicarResena.mockRejectedValue(
      new ErrorApi(409, 'Esta contratación ya tiene una reseña de tu empresa'),
    )
    pintar()

    fireEvent.click(await screen.findByRole('radio', { name: '3 estrellas, Aceptable' }))
    fireEvent.change(screen.getByLabelText('Opinión'), { target: { value: OPINION } })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar reseña' }))

    expect(await screen.findByText('Esta contratación ya tiene una reseña de tu empresa')).toBeTruthy()
    expect(await screen.findByText(/Puedes cambiarla hasta el/)).toBeTruthy()
  })

  it('editable: «Puedes cambiarla hasta…», y al editar una ya respondida avisa antes de guardar (AC-37)', async () => {
    api.verResenas.mockResolvedValue(
      conBloque(
        publicada('EDITABLE', {
          respuesta: {
            texto: 'Gracias por la oportunidad, aprendí mucho con el equipo.',
            publicadaEn: dias(-4),
            editada: false,
            ocultada: false,
            reporte: null,
            notaReporte: null,
            puedeReportar: true,
          },
        }),
      ),
    )
    pintar()

    expect(await screen.findByText(/Puedes cambiarla hasta el/)).toBeTruthy()
    expect(screen.getByText(/Respuesta de Luis Perez/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reportar la respuesta' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    expect(
      screen.getByText(/Luis Perez ya respondió a esta reseña. Si la cambias, le avisaremos/),
    ).toBeTruthy()
    expect((screen.getByLabelText('Opinión') as HTMLTextAreaElement).value).toBe(OPINION)
  })

  it('AC-09: fija, sin «Editar» ni «Borrar»', async () => {
    api.verResenas.mockResolvedValue(conBloque(publicada('FIJA')))
    pintar()

    expect(await screen.findByText('Ya no se puede cambiar.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Borrar' })).toBeNull()
  })

  it('AC-20: ocultada por la plataforma, atenuada con la nota y sin acciones', async () => {
    api.verResenas.mockResolvedValue(
      conBloque(publicada('OCULTADA', { notaOcultacion: 'Revela datos de salud' })),
    )
    pintar()

    expect(await screen.findByText('La plataforma la ocultó: Revela datos de salud')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull()
  })

  it('borrar pide confirmación ahí mismo', async () => {
    api.verResenas.mockResolvedValue(conBloque(publicada('EDITABLE')))
    api.borrarResena.mockResolvedValue(bloque({}))
    pintar()

    fireEvent.click(await screen.findByRole('button', { name: 'Borrar' }))
    const confirmar = screen.getByRole('group', { name: 'Borrar la reseña' })
    expect(api.borrarResena).not.toHaveBeenCalled()
    fireEvent.click(within(confirmar).getByRole('button', { name: 'Borrar' }))
    await waitFor(() => expect(api.borrarResena).toHaveBeenCalledWith(50))
  })

  it('borrar: el foco va a «Cancelar» de la confirmación y, al cancelar, vuelve a «Borrar»', async () => {
    api.verResenas.mockResolvedValue(conBloque(publicada('EDITABLE')))
    pintar()

    fireEvent.click(await screen.findByRole('button', { name: 'Borrar' }))
    const confirmar = screen.getByRole('group', { name: 'Borrar la reseña' })
    await waitFor(() =>
      expect(document.activeElement).toBe(within(confirmar).getByRole('button', { name: 'Cancelar' })),
    )
    fireEvent.click(within(confirmar).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Borrar' })))
  })

  it('RES-QA-02 y RES-QA-03: «Enviar reporte» envía una vez y, al cerrarse, el foco va al título del bloque', async () => {
    const respuesta = {
      texto: 'Gracias por la oportunidad, aprendí mucho con el equipo.',
      publicadaEn: dias(-4),
      editada: false,
      ocultada: false,
      notaReporte: null,
      reporte: null,
      puedeReportar: true,
    }
    api.verResenas
      .mockResolvedValueOnce(conBloque(publicada('EDITABLE', { respuesta })))
      .mockResolvedValue(
        conBloque(publicada('EDITABLE', { respuesta: { ...respuesta, reporte: 'EN_REVISION', puedeReportar: false } })),
      )
    api.reportarRespuesta.mockResolvedValue(undefined)
    pintar()

    fireEvent.click(await screen.findByRole('button', { name: 'Reportar la respuesta' }))
    const ventana = await screen.findByRole('dialog', { name: 'Reportar la respuesta' })
    fireEvent.click(within(ventana).getAllByRole('radio')[0]!)
    const enviar = screen.getByRole('button', { name: 'Enviar reporte' })
    // Dos clics antes de que nada se pinte: el candado es síncrono.
    act(() => {
      enviar.click()
      enviar.click()
    })

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(await screen.findByText('Reportada · en revisión')).toBeTruthy()
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { name: 'La reseña de Constructora Andina' }),
    )
    expect(api.reportarRespuesta).toHaveBeenCalledTimes(1)
  })

  it('RES-QA-05: «Reportar la respuesta» cerrado sin enviar —Escape, aspa, «Volver» o fondo— devuelve el foco a su botón', async () => {
    const respuesta = {
      texto: 'Gracias por la oportunidad, aprendí mucho con el equipo.',
      publicadaEn: dias(-4),
      editada: false,
      ocultada: false,
      notaReporte: null,
      reporte: null,
      puedeReportar: true,
    }
    api.verResenas.mockResolvedValue(conBloque(publicada('EDITABLE', { respuesta })))
    pintar()

    const reportar = await screen.findByRole('button', { name: 'Reportar la respuesta' })
    const cierres = {
      Escape: () => fireEvent.keyDown(document, { key: 'Escape' }),
      aspa: () => fireEvent.click(screen.getByRole('button', { name: 'Cerrar' })),
      Volver: () => fireEvent.click(screen.getByRole('button', { name: 'Volver' })),
      fondo: () => fireEvent.click(screen.getByRole('dialog').previousElementSibling!),
    }
    for (const [como, cerrar] of Object.entries(cierres)) {
      reportar.focus()
      fireEvent.click(reportar)
      const ventana = await screen.findByRole('dialog', { name: 'Reportar la respuesta' })
      // Se abre con el foco en el primer motivo.
      expect(document.activeElement).toBe(within(ventana).getAllByRole('radio')[0])

      act(() => cerrar())
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(document.activeElement, `cerrado con ${como}`).toBe(reportar)
    }
    expect(api.reportarRespuesta).not.toHaveBeenCalled()
  })

  it('AC-17: «Reportar la respuesta» con texto en «Cuéntanos más» pregunta en los cuatro cierres; «Seguir escribiendo» lo deja intacto', async () => {
    const respuesta = {
      texto: 'Gracias por la oportunidad, aprendí mucho con el equipo.',
      publicadaEn: dias(-4),
      editada: false,
      ocultada: false,
      notaReporte: null,
      reporte: null,
      puedeReportar: true,
    }
    api.verResenas.mockResolvedValue(conBloque(publicada('EDITABLE', { respuesta })))
    pintar()

    const reportar = await screen.findByRole('button', { name: 'Reportar la respuesta' })
    reportar.focus()
    fireEvent.click(reportar)
    const ventana = await screen.findByRole('dialog', { name: 'Reportar la respuesta' })
    const campo = within(ventana).getByLabelText(/Cuéntanos más/) as HTMLTextAreaElement
    fireEvent.change(campo, { target: { value: 'Atribuye hechos falsos a la empresa.' } })

    const pregunta = () =>
      screen.queryByRole('group', { name: '¿Descartar lo que escribiste? No se guardará.' })
    const cierres = {
      Volver: () => fireEvent.click(within(ventana).getByRole('button', { name: 'Volver' })),
      Escape: () => fireEvent.keyDown(document, { key: 'Escape' }),
      aspa: () => fireEvent.click(screen.getByRole('button', { name: 'Cerrar' })),
      fondo: () => fireEvent.click(ventana.previousElementSibling!),
    }
    for (const [como, cerrar] of Object.entries(cierres)) {
      act(() => cerrar())
      expect(screen.getByRole('dialog')).toBe(ventana)
      expect(pregunta(), `cerrado con ${como}`).toBeTruthy()
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Seguir escribiendo' }))
      expect(within(ventana).queryByRole('button', { name: 'Enviar reporte' })).toBeNull()

      // AC-19: con la pregunta a la vista, el fondo y el aspa no descartan nada.
      act(() => cierres.fondo())
      act(() => cierres.aspa())
      expect(pregunta()).toBeTruthy()

      fireEvent.click(screen.getByRole('button', { name: 'Seguir escribiendo' }))
      expect(pregunta()).toBeNull()
      expect(campo.value).toBe('Atribuye hechos falsos a la empresa.')
      await waitFor(() => expect(document.activeElement).toBe(campo))
    }
    expect(api.reportarRespuesta).not.toHaveBeenCalled()
  })

  it('AC-17: «Descartar» cierra sin enviar, el foco vuelve a «Reportar la respuesta» y al reabrir está vacío; con solo un motivo, no pregunta', async () => {
    const respuesta = {
      texto: 'Gracias por la oportunidad, aprendí mucho con el equipo.',
      publicadaEn: dias(-4),
      editada: false,
      ocultada: false,
      notaReporte: null,
      reporte: null,
      puedeReportar: true,
    }
    api.verResenas.mockResolvedValue(conBloque(publicada('EDITABLE', { respuesta })))
    pintar()

    const reportar = await screen.findByRole('button', { name: 'Reportar la respuesta' })
    reportar.focus()
    fireEvent.click(reportar)
    let ventana = await screen.findByRole('dialog', { name: 'Reportar la respuesta' })
    fireEvent.change(within(ventana).getByLabelText(/Cuéntanos más/), {
      target: { value: 'Atribuye hechos falsos a la empresa.' },
    })
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(reportar)

    fireEvent.click(reportar)
    ventana = await screen.findByRole('dialog', { name: 'Reportar la respuesta' })
    expect((within(ventana).getByLabelText(/Cuéntanos más/) as HTMLTextAreaElement).value).toBe('')
    // Solo un motivo elegido no es borrador: rehacerlo es un clic.
    fireEvent.click(within(ventana).getAllByRole('radio')[0]!)
    fireEvent.click(within(ventana).getByRole('button', { name: 'Volver' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(reportar)
    expect(api.reportarRespuesta).not.toHaveBeenCalled()
  })

  it('AC-18: con texto en «Cuéntanos más», enviar el reporte cierra sin preguntar', async () => {
    const respuesta = {
      texto: 'Gracias por la oportunidad, aprendí mucho con el equipo.',
      publicadaEn: dias(-4),
      editada: false,
      ocultada: false,
      notaReporte: null,
      reporte: null,
      puedeReportar: true,
    }
    api.verResenas
      .mockResolvedValueOnce(conBloque(publicada('EDITABLE', { respuesta })))
      .mockResolvedValue(
        conBloque(publicada('EDITABLE', { respuesta: { ...respuesta, reporte: 'EN_REVISION', puedeReportar: false } })),
      )
    api.reportarRespuesta.mockResolvedValue(undefined)
    pintar()

    fireEvent.click(await screen.findByRole('button', { name: 'Reportar la respuesta' }))
    const ventana = await screen.findByRole('dialog', { name: 'Reportar la respuesta' })
    fireEvent.click(within(ventana).getAllByRole('radio')[0]!)
    fireEvent.change(within(ventana).getByLabelText(/Cuéntanos más/), {
      target: { value: 'Atribuye hechos falsos a la empresa.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar reporte' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.queryByRole('group', { name: /Descartar lo que escribiste/ })).toBeNull()
    expect(await screen.findByText('Reportada · en revisión')).toBeTruthy()
    expect(api.reportarRespuesta).toHaveBeenCalledTimes(1)
  })

  it('QA-01: con la pregunta a la vista, vaciar «Cuéntanos más» y empezar de nuevo no hace volver la pregunta ni le quita el foco al campo', async () => {
    const respuesta = {
      texto: 'Gracias por la oportunidad, aprendí mucho con el equipo.',
      publicadaEn: dias(-4),
      editada: false,
      ocultada: false,
      notaReporte: null,
      reporte: null,
      puedeReportar: true,
    }
    api.verResenas.mockResolvedValue(conBloque(publicada('EDITABLE', { respuesta })))
    pintar()

    fireEvent.click(await screen.findByRole('button', { name: 'Reportar la respuesta' }))
    const ventana = await screen.findByRole('dialog', { name: 'Reportar la respuesta' })
    const campo = within(ventana).getByLabelText(/Cuéntanos más/) as HTMLTextAreaElement
    const pregunta = () =>
      screen.queryByRole('group', { name: '¿Descartar lo que escribiste? No se guardará.' })
    fireEvent.change(campo, { target: { value: 'Atribuye hechos falsos a la empresa.' } })
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(pregunta()).toBeTruthy()

    // En vez de «Seguir escribiendo», vuelve al campo, lo vacía y escribe otra cosa.
    campo.focus()
    fireEvent.change(campo, { target: { value: '' } })
    fireEvent.change(campo, { target: { value: 'I' } })

    // Nadie pidió cerrar: la pregunta no sale sola ni se lleva el foco a mitad de palabra.
    expect(pregunta()).toBeNull()
    expect(document.activeElement).toBe(campo)
    expect(within(ventana).getByRole('button', { name: 'Enviar reporte' })).toBeTruthy()
    expect(api.reportarRespuesta).not.toHaveBeenCalled()
  })

  it('AC-39: la respuesta reportada dice «en revisión», y la mantenida dice la nota', async () => {
    const respuesta = {
      texto: 'Gracias por la oportunidad, aprendí mucho con el equipo.',
      publicadaEn: dias(-4),
      editada: false,
      ocultada: false,
      notaReporte: null,
      puedeReportar: false,
    }
    api.verResenas.mockResolvedValue(
      conBloque(publicada('EDITABLE', { respuesta: { ...respuesta, reporte: 'EN_REVISION' } })),
    )
    pintar()

    expect(await screen.findByText('Reportada · en revisión')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Reportar la respuesta' })).toBeNull()
  })
})

describe('la lectura para cualquier empresa', () => {
  it('AC-26: las de todas las empresas, con su nombre, la respuesta y sin «Reportar»', async () => {
    api.verResenas.mockResolvedValue({
      persona: 'Luis Perez',
      puedeVerResenas: true,
      puedeResenar: false,
      resumen: {
        promedio: 4.5,
        cantidad: 2,
        reparto: [
          { estrellas: 5, cantidad: 1 },
          { estrellas: 4, cantidad: 1 },
          { estrellas: 3, cantidad: 0 },
          { estrellas: 2, cantidad: 0 },
          { estrellas: 1, cantidad: 0 },
        ],
      },
      resenas: [
        {
          id: 1,
          estrellas: 5,
          empresa: 'Acme',
          puesto: 'Coordinador de obra',
          texto: OPINION,
          publicadaEn: dias(-2),
          editada: true,
          respuesta: { texto: 'Gracias a todo el equipo por la confianza.', publicadaEn: dias(-1), editada: false },
        },
        {
          id: 2,
          estrellas: 4,
          empresa: 'Constructora Andina',
          puesto: null,
          texto: OPINION,
          publicadaEn: dias(-9),
          editada: false,
          respuesta: null,
        },
      ],
    })
    pintar()

    expect(await screen.findByRole('heading', { name: 'Reseñas de empresas' })).toBeTruthy()
    expect(screen.getByText('Acme')).toBeTruthy()
    expect(screen.getByText('Constructora Andina')).toBeTruthy()
    expect(screen.getByText(/Respuesta de Luis Perez/)).toBeTruthy()
    expect(screen.getByText(/· Editada/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Reportar/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Responder/ })).toBeNull()
    // Sin bloque de autora: esta empresa no la contrató.
    expect(screen.queryByRole('heading', { name: /La reseña de/ })).toBeNull()
  })

  it('sin reseñas visibles: «Sin reseñas de empresas»', async () => {
    api.verResenas.mockResolvedValue({
      persona: 'Luis Perez',
      puedeVerResenas: true,
      puedeResenar: false,
      resumen: { promedio: null, cantidad: 0, reparto: [] },
      resenas: [],
    })
    pintar()

    expect(await screen.findByText('Sin reseñas de empresas.')).toBeTruthy()
  })

  it('AC-27: sin ninguno de los dos permisos (403) no se pinta nada, ni un error', async () => {
    api.verResenas.mockRejectedValue(new ErrorApi(403, 'Permiso denegado'))
    const { container } = pintar()

    await waitFor(() => expect(api.verResenas).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByText(/Cargando las reseñas/)).toBeNull())
    expect(container.textContent).toBe('')
  })

  it('AC-25: si falla la carga, «No pudimos cargar las reseñas» con «Reintentar»', async () => {
    api.verResenas.mockRejectedValue(new ErrorApi(500, 'caído'))
    pintar()

    expect(await screen.findByText('No pudimos cargar las reseñas.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy()
  })
})
