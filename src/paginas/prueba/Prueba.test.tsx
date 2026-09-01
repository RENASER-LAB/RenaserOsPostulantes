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
import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { MiPrueba } from '@/api/tipos'
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
