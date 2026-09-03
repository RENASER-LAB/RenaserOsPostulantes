/**
 * Lo que compila perfectamente estando mal en «lo que entregó».
 *
 *   1. **Decidir el camino del archivo por la excepción.** En local el enlace
 *      firmado contesta **200** con una url `memoria://` que ningún navegador
 *      abre, así que un `try/catch` no se entera y el botón no hace nada. Se
 *      decide por el esquema de la url, y eso es lo que fijan dos pruebas.
 *   2. **Creer que un `window.open` bloqueado lanza.** Devuelve `null`. Sin
 *      comprobarlo, la persona pulsa, no pasa nada y nadie se lo dice.
 *   3. **Afirmar que no entregó cuando el backend dice 404.** Ese 404 son dos
 *      cosas —no rindió, o la vacante queda fuera de tu alcance— y solo una es
 *      un hecho sobre la persona. Es el guion del ranking otra vez.
 *   4. **Esconder que falta un obligatorio detrás del color.** «La regla de la
 *      forma primero»: la palabra va dentro de la etiqueta.
 *   5. **Desmontar el bloque con `isError` a secas.** Un refresco de fondo que
 *      falla se lleva de la pantalla lo que se estaba mirando para calificar.
 *   6. **Repartir el contenido sin mirar el permiso.** Sin
 *      `descargar_entregables` no puede haber ni enlace ni botón.
 *
 * ⚠️ **Lo que estas pruebas NO comprueban** es que el enlace firmado del bucket
 * sirva bytes: en local no existe ese camino. Se comprueba que se elige bien
 * entre los dos, no que el de producción funcione.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ErrorApi } from '../api/cliente'
import { EntregablesDePrueba } from './EntregablesDePrueba'

/** Un enlace, un archivo, un obligatorio sin entregar y uno cuyo archivo se fue. */
const CUATRO = [
  {
    entregableRequeridoId: 1,
    nombre: 'La campaña en Meta Ads',
    detalle: 'El conjunto de anuncios, con su segmentación.',
    formato: 'CUALQUIERA',
    esObligatorio: true,
    loEntrego: true,
    enlace: 'https://drive.example.pe/campana',
    archivoId: null,
    archivoNombre: null,
    version: 1,
    subidoEn: '2026-08-30T15:12:00Z',
    porQueNoSeVe: null,
  },
  {
    entregableRequeridoId: 2,
    nombre: 'La pieza de conversión',
    detalle: 'La landing a la que lleva el anuncio.',
    formato: 'ARCHIVO',
    esObligatorio: true,
    loEntrego: true,
    enlace: null,
    archivoId: 77,
    archivoNombre: 'pieza.pdf',
    version: 2,
    subidoEn: '2026-08-30T16:40:00Z',
    porQueNoSeVe: null,
  },
  {
    entregableRequeridoId: 3,
    nombre: 'Video de sustentación',
    detalle: 'Explica tus decisiones a cámara.',
    formato: 'ENLACE',
    esObligatorio: true,
    loEntrego: false,
    enlace: null,
    archivoId: null,
    archivoNombre: null,
    version: null,
    subidoEn: null,
    porQueNoSeVe: 'No lo entregó, y era obligatorio',
  },
  {
    entregableRequeridoId: 4,
    nombre: 'El anexo de referencias',
    detalle: 'Opcional: de dónde salen los números.',
    formato: 'CUALQUIERA',
    esObligatorio: false,
    loEntrego: true,
    enlace: null,
    archivoId: null,
    archivoNombre: null,
    version: 1,
    subidoEn: '2026-08-30T16:41:00Z',
    porQueNoSeVe: 'El archivo ya no está guardado',
  },
]

/** Lo mismo, visto por quien no tiene `descargar_entregables`. */
const SIN_PERMISO_DE_CONTENIDO = [
  {
    ...CUATRO[1],
    enlace: null,
    archivoId: null,
    archivoNombre: null,
    porQueNoSeVe: 'Hace falta el permiso «descargar_entregables» para abrirlo',
  },
]

const pedirEntregables = vi.fn()
const pedirEnlace = vi.fn()
const pedirDescarga = vi.fn()

vi.mock('../api/panel', () => ({
  verEntregablesDePrueba: (postulacionId: number) => pedirEntregables(postulacionId),
  enlaceDeArchivo: (archivoId: number) => pedirEnlace(archivoId),
  descargarArchivo: (archivoId: number) => pedirDescarga(archivoId),
}))

function montar(postulacionId = 9) {
  const datos = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={datos}>
      <EntregablesDePrueba postulacionId={postulacionId} />
    </QueryClientProvider>,
  )
  return datos
}

beforeEach(() => {
  pedirEntregables.mockReset()
  pedirEnlace.mockReset()
  pedirDescarga.mockReset()
})

afterEach(cleanup)

describe('lo que entregó', () => {
  it('salen todos los pedidos, y el que falta lo dice con palabras', async () => {
    pedirEntregables.mockResolvedValue(CUATRO)
    montar()

    await screen.findByText('La campaña en Meta Ads')

    // Los cuatro, no solo los entregados: un hueco se leeria como lista completa.
    expect(screen.getByText('Video de sustentación')).toBeTruthy()
    expect(screen.getByText('3 de 4 entregados')).toBeTruthy()

    // La palabra dentro de la etiqueta, no solo el color.
    expect(screen.getByText('Falta, y era obligatorio')).toBeTruthy()
  })

  it('el enlace se abre en otra pestaña, con la dirección a la vista', async () => {
    pedirEntregables.mockResolvedValue(CUATRO)
    montar()

    const enlace = await screen.findByRole('link', {
      name: 'https://drive.example.pe/campana',
    })
    // El texto ES el destino: nadie pulsa a ciegas.
    expect(enlace.getAttribute('href')).toBe('https://drive.example.pe/campana')
    expect(enlace.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('un enlace que no es una dirección web no se hace pulsable', async () => {
    pedirEntregables.mockResolvedValue([
      { ...CUATRO[0], enlace: 'javascript:alert(1)' },
    ])
    montar()

    await screen.findByText('La campaña en Meta Ads')
    // Se lee y se copia, pero no hay `href` que pulsar.
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText(/no es una dirección web/i)).toBeTruthy()
  })

  it('sin permiso para el contenido no hay ni enlace ni botón, y se dice por qué', async () => {
    pedirEntregables.mockResolvedValue(SIN_PERMISO_DE_CONTENIDO)
    montar()

    await screen.findByText('La pieza de conversión')
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText(/descargar_entregables/)).toBeTruthy()
  })

  it('cada botón de archivo dice de qué entregable es', async () => {
    pedirEntregables.mockResolvedValue([
      { ...CUATRO[1], archivoNombre: null },
      { ...CUATRO[1], entregableRequeridoId: 9, nombre: 'El anexo', archivoId: 78, archivoNombre: null },
    ])
    montar()

    // Los dos se llaman «Abrir el archivo» en pantalla; en el árbol de
    // accesibilidad tienen que poder distinguirse.
    await screen.findByRole('button', { name: 'Abrir lo que entregó en La pieza de conversión' })
    expect(screen.getByRole('button', { name: 'Abrir lo que entregó en El anexo' })).toBeTruthy()
  })

  it('una url que el navegador no abre cae a la descarga', async () => {
    pedirEntregables.mockResolvedValue([CUATRO[1]])
    // ⚠️ Esto es lo que devuelve el almacén local: 200, y una url inservible.
    pedirEnlace.mockResolvedValue({ url: 'memoria://algo', expiraEn: '', nombre: 'pieza.pdf' })
    pedirDescarga.mockResolvedValue({ contenido: new Blob(['x']), nombre: 'pieza.pdf' })
    const abrir = vi.spyOn(window, 'open').mockReturnValue({ close: vi.fn(), location: { href: '' } } as never)
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    montar()

    fireEvent.click(await screen.findByRole('button', { name: /Abrir lo que entregó/ }))

    await waitFor(() => expect(pedirDescarga).toHaveBeenCalledWith(77))
    abrir.mockRestore()
  })

  it('si el navegador bloquea la pestaña, también cae a la descarga', async () => {
    pedirEntregables.mockResolvedValue([CUATRO[1]])
    pedirEnlace.mockResolvedValue({ url: 'https://bucket.example/x', expiraEn: '', nombre: 'pieza.pdf' })
    pedirDescarga.mockResolvedValue({ contenido: new Blob(['x']), nombre: 'pieza.pdf' })
    // ⚠️ Bloqueado devuelve `null`, no lanza.
    const abrir = vi.spyOn(window, 'open').mockReturnValue(null)
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    montar()

    fireEvent.click(await screen.findByRole('button', { name: /Abrir lo que entregó/ }))

    await waitFor(() => expect(pedirDescarga).toHaveBeenCalledWith(77))
    abrir.mockRestore()
  })

  it('un 404 no afirma que no entregó: dice también que puede ser el alcance', async () => {
    pedirEntregables.mockRejectedValue(new ErrorApi(404, 'No encontrado', null))
    montar()

    await screen.findByText(/fuera de tu alcance/i)
    // Y no se ofrece reintentar: reintentando no aparecería.
    expect(screen.queryByRole('button', { name: /volver a intentarlo/i })).toBeNull()
  })

  it('una lista vacía no es un fallo: es una prueba sin entregables', async () => {
    pedirEntregables.mockResolvedValue([])
    montar()

    await screen.findByText(/no pedía entregar nada/i)
    expect(screen.queryByRole('button', { name: /volver a intentarlo/i })).toBeNull()
  })

  it('el 403 nombra el permiso en vez de ofrecer un reintento', async () => {
    pedirEntregables.mockRejectedValue(new ErrorApi(403, 'Forbidden', null))
    montar()

    await screen.findByText(/ve el ranking, no la ficha/i)
    expect(screen.queryByRole('button', { name: /volver a intentarlo/i })).toBeNull()
  })

  it('un refresco que falla no se lleva de la pantalla lo que se estaba mirando', async () => {
    pedirEntregables.mockResolvedValueOnce(CUATRO).mockRejectedValue(new Error('Se cayó la red.'))
    const datos = montar()
    await screen.findByText('La campaña en Meta Ads')

    // Un hipo del servidor mientras la ficha está abierta.
    await act(async () => {
      await datos.refetchQueries({ queryKey: ['panel-entregables-prueba', 9] })
    })

    // Las filas siguen, y se dice que son las de antes.
    expect(screen.getByText('La campaña en Meta Ads')).toBeTruthy()
    // Se dice que está desactualizado y las filas siguen en pie.
    expect(await screen.findByText(/no pudimos refrescar/i)).toBeTruthy()
    expect(screen.getByText('La campaña en Meta Ads')).toBeTruthy()

    // Y la pantalla de fallo NO sale: es solo para cuando no hay nada que
    // enseñar. Sin esto, un `isError` sin condición pasaría igual, pintando el
    // aviso rojo encima de las filas.
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
