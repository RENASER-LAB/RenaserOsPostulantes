/**
 * Lo que compila perfectamente estando mal en lo que escribio en la prueba.
 *
 *   1. **Colapsar `null` con `''`.** Son dos hechos distintos —no llego
 *      ninguna respuesta, o llego una y esta vacia— y quien califica no los
 *      juzga igual. Pintar «—» en los dos casos es de la familia de los
 *      indicadores que mienten, que aqui ya costo respuestas perdidas.
 *   2. **Desmontar el bloque con `isError` a secas.** TanStack Query pone
 *      `status: 'error'` tambien cuando falla un refresco de fondo con los
 *      datos ya puestos: quien estaba leyendo una respuesta larga para ponerle
 *      nota se queda mirando «no pudimos cargar».
 *   3. **Enseñar una lista vacia como un fallo.** Que no haya respuestas
 *      significa que no rindio, y ofrecer «volver a intentarlo» promete que
 *      reintentando aparecerian.
 *   4. **Partir la respuesta en trozos al pintarla.** Un `.split('\n')` con un
 *      `<br>` o un `<p>` por linea deja de ser un solo texto: se pierde al
 *      copiarlo y el lector de pantalla lo lee a saltos. El texto va entero en
 *      un nodo y los saltos los conserva el `pre-wrap` de la hoja.
 *   5. **Pintar el 403 como un error.** Que un rol no abra la ficha es el
 *      reparto de permisos funcionando, no algo que se arregle reintentando.
 *
 * ⚠️ **Lo que estas pruebas NO pueden comprobar es el `white-space: pre-wrap`.**
 * jsdom no aplica los CSS Modules, asi que la regla vive sin guardia en
 * `RespuestasDePrueba.module.css`. Lo que si se comprueba —y es la mitad que se
 * rompe al retocar el JSX— es que el texto llega al DOM de una pieza, con sus
 * saltos dentro.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ErrorApi } from '../api/cliente'
import { RespuestasDePrueba } from './RespuestasDePrueba'

const LARGA = 'Primero el que bloquea los cobros.\n\nDespués el del informe, que espera.'

const TRES = [
  {
    preguntaId: 1,
    codigo: 'PP-01',
    orden: 1,
    tipo: 'ABIERTA',
    enunciado: 'Cómo priorizarías los tres incidentes',
    respuesta: LARGA,
    respondidaEn: '2026-08-22T14:05:00Z',
  },
  {
    preguntaId: 2,
    codigo: 'PP-02',
    orden: 2,
    tipo: 'ABIERTA',
    enunciado: 'Qué harías si el proveedor no responde',
    // Nunca llego respuesta: ni siquiera hay fecha.
    respuesta: null,
    respondidaEn: null,
  },
  {
    preguntaId: 3,
    codigo: 'PP-03',
    orden: 3,
    tipo: 'ABIERTA',
    enunciado: 'Qué métricas mirarías la primera semana',
    // Llego, se guardo, y esta vacia. Es otra cosa que la de arriba.
    respuesta: '',
    respondidaEn: '2026-08-22T14:40:00Z',
  },
]

const pedirRespuestas = vi.fn()

vi.mock('../api/panel', () => ({
  verRespuestasDePrueba: (postulacionId: number) => pedirRespuestas(postulacionId),
}))

function montar(postulacionId = 9) {
  const datos = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={datos}>
      <RespuestasDePrueba postulacionId={postulacionId} />
    </QueryClientProvider>,
  )
  return datos
}

beforeEach(() => {
  pedirRespuestas.mockReset()
})

afterEach(cleanup)

describe('lo que escribió en la prueba', () => {
  it('«sin responder» y «respondió en blanco» se leen distinto', async () => {
    pedirRespuestas.mockResolvedValue(TRES)
    montar()

    await screen.findByText('Cómo priorizarías los tres incidentes')

    // Cada uno con su frase. Si se colapsaran habria dos iguales, o un «—» que
    // no dice cual de las dos cosas paso.
    expect(screen.getByText(/sin responder: no llegó ninguna respuesta/i)).toBeTruthy()
    expect(screen.getByText(/respondió en blanco/i)).toBeTruthy()

    // Y ni una sola vez el mismo texto para las dos.
    expect(screen.queryAllByText(/sin responder/i).length).toBe(1)
    expect(screen.queryAllByText(/en blanco/i).length).toBe(1)

    // El recuento tampoco cuenta la vacia como escrita.
    expect(screen.getByText('1 de 3 con algo escrito')).toBeTruthy()
  })

  it('los saltos de línea de una respuesta larga llegan enteros al DOM', async () => {
    pedirRespuestas.mockResolvedValue(TRES)
    montar()

    // El buscador normaliza los espacios, asi que el `\n` se comprueba sobre el
    // texto crudo del elemento: si alguien parte la respuesta en un elemento por
    // linea, esto se cae aunque la pantalla siga pareciendo correcta.
    const texto = await screen.findByText(/Primero el que bloquea los cobros/)
    expect(texto.textContent).toBe(LARGA)
    expect(texto.textContent).toContain('\n\n')
  })

  it('sin respuestas dice que no rindió, y no finge un fallo', async () => {
    pedirRespuestas.mockResolvedValue([])
    montar()

    expect(await screen.findByText(/todavía no rindió la prueba/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /volver a intentarlo/i })).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('un fallo del refresco no se lleva por delante lo que se está leyendo', async () => {
    pedirRespuestas.mockResolvedValueOnce(TRES).mockRejectedValue(new Error('Se cayó la red.'))
    const datos = montar()

    await screen.findByText('Cómo priorizarías los tres incidentes')

    // Un hipo del servidor mientras la ficha esta abierta.
    await act(async () => {
      await datos.refetchQueries({ queryKey: ['panel-respuestas-prueba', 9] })
    })

    // Se dice que esta desactualizado y las respuestas siguen en pie.
    expect(await screen.findByText(/no pudimos refrescar/i)).toBeTruthy()
    expect(screen.getByText('Cómo priorizarías los tres incidentes')).toBeTruthy()
    expect(screen.getByText(/Primero el que bloquea los cobros/)).toBeTruthy()

    // Y la pantalla de fallo NO sale: es solo para cuando no hay nada que
    // enseñar. Sin esto, un `isError` sin condicion pasa la prueba igual —
    // pintaria el aviso rojo encima de las respuestas y nadie se enteraria.
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText(/se cayó la red/i)).toBeNull()
  })

  it('un 403 explica el permiso en vez de ofrecer reintentar', async () => {
    pedirRespuestas.mockRejectedValue(new ErrorApi(403, 'Forbidden', null))
    montar()

    expect(await screen.findByText(/ve el ranking, no la ficha/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /volver a intentarlo/i })).toBeNull()
  })

  it('un 404 se cuenta como que no rindió, y un 500 como el fallo que es', async () => {
    // Solo el 404 significa «todavia no hay»: un 500 disfrazado de «no rindio»
    // haria creer que la persona no entrego nada.
    pedirRespuestas.mockRejectedValue(new ErrorApi(404, 'No encontrado', null))
    const { unmount } = render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <RespuestasDePrueba postulacionId={1} />
      </QueryClientProvider>,
    )
    expect(await screen.findByText(/todavía no rindió la prueba/i)).toBeTruthy()
    unmount()

    pedirRespuestas.mockRejectedValue(new ErrorApi(500, 'Se rompió algo al leer la prueba.', null))
    montar(2)
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText(/se rompió algo al leer la prueba/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /volver a intentarlo/i })).toBeTruthy()
  })
})
