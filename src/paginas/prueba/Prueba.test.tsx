/**
 * La prueba del puesto, en los dos momentos que costaban dinero al candidato.
 *
 *   1. **Cada entregable acepta una cosa.** La pantalla enseñaba siempre los dos
 *      campos —subir archivo y pegar enlace— e imprimia el enum crudo. Quien
 *      pegaba un enlace donde solo cabe un archivo se comia un 400 con el reloj
 *      corriendo.
 *   2. **El plazo se acaba y nadie lo dice.** El backend sigue devolviendo
 *      `EN_CURSO` hasta que su barrido de cada minuto cierra el intento, asi que
 *      durante ese minuto se podia seguir escribiendo contra un servidor que ya
 *      contestaba que no.
 *
 * Las dos veces el codigo compilaba: lo que fallaba era lo que se veia.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ErrorApi } from '@/api/cliente'
import { verPostulacion } from '@/api/portal'
import { entregarPrueba, iniciarPrueba, responderPrueba, subirEnlace, verPrueba } from '@/api/prueba'
import type { MiPostulacionDetalle, MiPrueba } from '@/api/tipos'
import { ProveedorAvisos } from '@/ui/Avisos'
import { Prueba } from './Prueba'

// ---------- El servidor de mentira ----------

/** Lo que devuelve `verPrueba` en la prueba que corre en cada momento. */
let respuesta: MiPrueba

function pruebaEnCurso(vence: string, formato: string | null): MiPrueba {
  return {
    id: 1,
    estadoIntento: 'EN_CURSO',
    modalidad: 'CRONOMETRADA',
    iniciadoEn: '2026-08-20T10:00:00Z',
    venceEn: vence,
    duracionMinutos: 90,
    enunciado: 'Primer parrafo.\n\nEl enunciado esta en https://sb.co/prueba.pdf',
    materiales: null,
    herramientasPermitidas: null,
    cambioTexto: null,
    preguntas: [{ id: 7, tipo: 'ABIERTA', enunciado: 'Por qué lo hiciste así', respuestaTexto: null }],
    entregables: [
      { id: 3, nombre: 'El informe', detalle: null, formato, esObligatorio: true, entregado: false },
    ],
  }
}

vi.mock('@/api/prueba', () => ({
  verPrueba: vi.fn(async () => respuesta),
  iniciarPrueba: vi.fn(async () => respuesta),
  responderPrueba: vi.fn(async () => undefined),
  subirArchivo: vi.fn(async () => undefined),
  subirEnlace: vi.fn(async () => undefined),
  entregarPrueba: vi.fn(async () => ({ estado: 'ENTREGADA', completa: true, faltantes: 0 })),
}))

// Su proceso: solo se le pregunta cuando la prueba contesta 404.
vi.mock('@/api/portal', () => ({ verPostulacion: vi.fn() }))

/** El 404 con el que el backend contesta a una postulación que ya no existe. */
const yaNoExiste = () =>
  new ErrorApi(404, "Postulación not found with código: 'x1'", { status: 404 })

// ---------- Montaje ----------

function montar() {
  const datos = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={datos}>
      <ProveedorAvisos>
        <MemoryRouter initialEntries={['/procesos/x1/prueba']}>
          <Routes>
            <Route path="/procesos/:uuid/prueba" element={<Prueba />} />
          </Routes>
        </MemoryRouter>
      </ProveedorAvisos>
    </QueryClientProvider>,
  )
}

const enUnaHora = () => new Date(Date.now() + 3_600_000).toISOString()
const haceUnRato = () => new Date(Date.now() - 60_000).toISOString()

afterEach(cleanup)

// ---------- Las pruebas ----------

describe('cada entregable enseña solo lo que acepta', () => {
  it('el que pide archivo no ofrece pegar un enlace', async () => {
    respuesta = pruebaEnCurso(enUnaHora(), 'ARCHIVO')
    montar()

    expect(await screen.findByText('Se entrega como archivo')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Seleccionar archivo' })).toBeTruthy()
    expect(screen.queryByLabelText('Enlace')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Guardar enlace' })).toBeNull()
    // El enum crudo no se le enseña a nadie.
    expect(screen.queryByText(/ARCHIVO/)).toBeNull()
  })

  it('el que pide enlace no ofrece subir un archivo', async () => {
    respuesta = pruebaEnCurso(enUnaHora(), 'ENLACE')
    montar()

    expect(await screen.findByText('Se entrega como enlace')).toBeTruthy()
    expect(screen.getByLabelText('Enlace')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Seleccionar archivo' })).toBeNull()
  })

  it('sin formato conocido se ofrecen los dos, que es lo que no cierra ninguna puerta', async () => {
    respuesta = pruebaEnCurso(enUnaHora(), null)
    montar()

    expect(await screen.findByText('Archivo o enlace, lo que prefieras')).toBeTruthy()
    expect(screen.getByLabelText('Enlace')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Seleccionar archivo' })).toBeTruthy()
  })
})

describe('cuando se acaba el tiempo', () => {
  it('lo dice, bloquea los campos y quita el boton de entregar', async () => {
    respuesta = pruebaEnCurso(haceUnRato(), 'CUALQUIERA')
    montar()

    expect(await screen.findByText('Terminó el plazo de esta prueba')).toBeTruthy()

    // Lo escrito se sigue leyendo, pero ya no se toca.
    const campo = screen.getByLabelText('Por qué lo hiciste así') as HTMLTextAreaElement
    expect(campo.readOnly).toBe(true)

    expect((screen.getByLabelText('Enlace') as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Seleccionar archivo' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Entregar prueba' })).toBeNull()
  })

  it('mientras queda tiempo no bloquea nada', async () => {
    respuesta = pruebaEnCurso(enUnaHora(), 'CUALQUIERA')
    montar()

    expect(await screen.findByRole('button', { name: 'Entregar prueba' })).toBeTruthy()
    expect(screen.queryByText('Terminó el plazo de esta prueba')).toBeNull()
    expect((screen.getByLabelText('Por qué lo hiciste así') as HTMLTextAreaElement).readOnly).toBe(false)
  })
})

describe('la consigna', () => {
  it('convierte la direccion del PDF en un enlace de verdad', async () => {
    respuesta = pruebaEnCurso(enUnaHora(), 'CUALQUIERA')
    montar()

    const enlace = await screen.findByRole('link', { name: 'Abrir el enunciado de la prueba (PDF)' })
    expect(enlace.getAttribute('href')).toBe('https://sb.co/prueba.pdf')
    expect(enlace.getAttribute('target')).toBe('_blank')
  })

  it('con reloj y fecha de cierre, dice los dos y cuál acorta a cuál', async () => {
    /*
     * El defecto que esto fija: el lateral era un if/else y con las dos cosas escribía
     * «90 minutos desde que empieces» y CALLABA la fecha. Quien abriera a las 17:40 con
     * cierre a las 18:00 leía noventa minutos y tenía veinte. Manda el más cercano, que
     * lo decide el servidor, así que la pantalla tiene que decir los dos.
     */
    respuesta = { ...pruebaEnCurso('2026-08-20T18:00:00Z', 'ARCHIVO'), estadoIntento: 'PENDIENTE' }
    montar()

    expect(await screen.findByText(/90 minutos desde que empieces/)).toBeTruthy()
    expect(screen.getByText(/la convocatoria cierra el/i)).toBeTruthy()
    expect(screen.getByText(/tendrás el tiempo que quede/i)).toBeTruthy()
  })

  it('sin fecha de cierre no inventa ninguna', async () => {
    respuesta = {
      ...pruebaEnCurso('2026-08-20T18:00:00Z', 'ARCHIVO'),
      estadoIntento: 'PENDIENTE',
      venceEn: null,
    }
    montar()

    expect(await screen.findByText(/90 minutos desde que empieces/)).toBeTruthy()
    expect(screen.queryByText(/la convocatoria cierra el/i)).toBeNull()
  })
})

/**
 * Entregar con preguntas en blanco.
 *
 * ⚠️ Esto hace falta **desde que vaciar el recuadro borra de verdad la respuesta**. El servidor
 * deja entregar esta prueba aunque falten preguntas —lo que exige son los entregables
 * obligatorios—, asi que si la pantalla no lo dice, quien borra una respuesta sin querer la
 * entrega sin ella y no se entera nadie.
 *
 * Avisa y no impide, a proposito: en una prueba cuyo peso esta en el entregable, dejar una
 * pregunta sin responder puede ser una decision.
 */
describe('entregar con preguntas en blanco', () => {
  it('lo dice antes de confirmar, y deja entregar igual', async () => {
    respuesta = pruebaEnCurso(enUnaHora(), 'ARCHIVO')
    montar()

    await screen.findByRole('button', { name: 'Entregar prueba' })
    fireEvent.click(screen.getByRole('button', { name: 'Entregar prueba' }))

    const dialogo = await screen.findByRole('dialog')
    expect(dialogo.textContent).toMatch(/Hay 1 pregunta sin responder/)
    // Avisa, no bloquea: el boton sigue vivo.
    const entregar = screen.getByRole('button', { name: 'Entregar' })
    expect((entregar as HTMLButtonElement).disabled).toBe(false)
  })

  it('no lo dice cuando estan todas respondidas', async () => {
    respuesta = pruebaEnCurso(enUnaHora(), 'ARCHIVO')
    montar()

    const area = await screen.findByLabelText('Por qué lo hiciste así')
    fireEvent.change(area, { target: { value: 'Porque el cuadre diario lo exigia.' } })
    await waitFor(() => expect(area).toHaveProperty('value', 'Porque el cuadre diario lo exigia.'))

    fireEvent.click(screen.getByRole('button', { name: 'Entregar prueba' }))

    const dialogo = await screen.findByRole('dialog')
    expect(dialogo.textContent).not.toMatch(/sin responder/)
  })
})

describe('cuando la empresa retiró la vacante', () => {
  it('el enlace viejo dice que la vacante ya no está, sin reloj ni botón de entregar', async () => {
    vi.mocked(verPrueba).mockRejectedValueOnce(yaNoExiste())
    vi.mocked(verPostulacion).mockRejectedValueOnce(yaNoExiste())
    montar()

    expect(
      await screen.findByRole('heading', { name: /Esta vacante ya no está disponible/ }),
    ).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ver mis procesos' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Entregar prueba' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Intentar de nuevo' })).toBeNull()
    // El texto crudo del servidor no se le enseña.
    expect(screen.queryByText(/not found/)).toBeNull()
  })

  it('si su proceso sigue ahí, un 404 de la prueba no se hace pasar por una vacante retirada', async () => {
    vi.mocked(verPrueba).mockRejectedValueOnce(
      new ErrorApi(404, 'Todavía no tienes una prueba abierta', { status: 404 }),
    )
    vi.mocked(verPostulacion).mockResolvedValueOnce({} as MiPostulacionDetalle)
    montar()

    expect(await screen.findByRole('heading', { name: 'No pudimos abrir la prueba.' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /Esta vacante ya no está disponible/ })).toBeNull()
  })

  it('con la prueba abierta desde antes, un 404 al entregar lo dice fuera del diálogo', async () => {
    respuesta = pruebaEnCurso(enUnaHora(), 'CUALQUIERA')
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Entregar prueba' }))
    await screen.findByRole('dialog')

    vi.mocked(entregarPrueba).mockRejectedValueOnce(yaNoExiste())
    vi.mocked(verPrueba).mockRejectedValueOnce(yaNoExiste())
    vi.mocked(verPostulacion).mockRejectedValueOnce(yaNoExiste())
    fireEvent.click(screen.getByRole('button', { name: 'Entregar' }))

    expect(
      await screen.findByRole('heading', { name: /Esta vacante ya no está disponible/ }),
    ).toBeTruthy()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.queryByText(/not found/)).toBeNull()
  })

  /** La siguiente lectura de la prueba y la de su proceso contestan que ya no existe. */
  function laRetiran() {
    vi.mocked(verPrueba).mockRejectedValueOnce(yaNoExiste())
    vi.mocked(verPostulacion).mockRejectedValueOnce(yaNoExiste())
  }

  const elAviso = () =>
    screen.findByRole('heading', { name: /Esta vacante ya no está disponible/ }, { timeout: 4000 })

  it('abierta sin empezar, «Sí, empezar» con 404 dice que la vacante ya no está', async () => {
    respuesta = { ...pruebaEnCurso(enUnaHora(), 'CUALQUIERA'), estadoIntento: 'PENDIENTE', iniciadoEn: null }
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Empezar prueba' }))
    await screen.findByRole('dialog')

    vi.mocked(iniciarPrueba).mockRejectedValueOnce(yaNoExiste())
    laRetiran()
    fireEvent.click(screen.getByRole('button', { name: 'Sí, empezar' }))

    expect(await elAviso()).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText(/not found/)).toBeNull()
  })

  it('en curso, una respuesta con 404 dice que la vacante ya no está, sin esperar a la recarga', async () => {
    respuesta = pruebaEnCurso(enUnaHora(), 'CUALQUIERA')
    montar()
    const recuadro = await screen.findByLabelText('Por qué lo hiciste así')

    vi.mocked(responderPrueba).mockRejectedValueOnce(yaNoExiste())
    laRetiran()
    fireEvent.change(recuadro, { target: { value: 'Porque sí' } })

    expect(await elAviso()).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Entregar prueba' })).toBeNull()
  })

  it('en curso, un enlace con 404 dice que la vacante ya no está, no el texto del servidor', async () => {
    respuesta = pruebaEnCurso(enUnaHora(), 'ENLACE')
    montar()
    fireEvent.change(await screen.findByLabelText('Enlace'), {
      target: { value: 'https://drive.example/informe' },
    })

    vi.mocked(subirEnlace).mockRejectedValueOnce(yaNoExiste())
    laRetiran()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar enlace' }))

    expect(await elAviso()).toBeTruthy()
    expect(screen.queryByText(/not found/)).toBeNull()
  })

  it('si la prueba sigue ahí, un 404 al entregar se dice dentro del diálogo', async () => {
    respuesta = pruebaEnCurso(enUnaHora(), 'CUALQUIERA')
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Entregar prueba' }))
    await screen.findByRole('dialog')

    vi.mocked(entregarPrueba).mockRejectedValueOnce(
      new ErrorApi(404, 'Intento not found with id: 1', { status: 404 }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Entregar' }))

    // Se volvió a leer la prueba, contestó, y el 404 era otra cosa: se dice, y el diálogo sigue.
    await waitFor(() =>
      expect(screen.getByRole('dialog').textContent).toMatch(/Intento not found/),
    )
    expect(screen.queryByRole('heading', { name: /Esta vacante ya no está disponible/ })).toBeNull()
    expect(verPostulacion).not.toHaveBeenCalled()
  })
})
