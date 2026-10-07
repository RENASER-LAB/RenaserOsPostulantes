/**
 * La prueba escrita en el editor de la vacante (V67), del lado del candidato.
 *
 *   - Las preguntas en los cuatro tipos, numeradas, sin puntos (AC-08).
 *   - Una cerrada se guarda al marcarla, con la opción o las marcadas.
 *   - «Entregar» con huecos no abre el diálogo: dice cuáles faltan y lleva a la
 *     primera (AC-10). Una abierta con solo espacios cuenta como sin responder.
 *   - Sin el entregable obligatorio, tampoco.
 *   - Vencida con huecos: «Tu tiempo terminó y la prueba quedó sin completar».
 *   - V68: sin «cuestionario». La pantalla previa dice la fecha límite y el
 *     tiempo; el caso sale solo si existe; el archivo de una pregunta se sube
 *     dentro de ella y «Entregar» lleva a lo primero que falta (AC-19, AC-20).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { entregarPrueba, responderPruebaCerrada } from '@/api/prueba'
import type { MiPrueba, PreguntaPrueba } from '@/api/tipos'
import { ProveedorAvisos } from '@/ui/Avisos'
import { Prueba } from './Prueba'

let respuesta: MiPrueba

vi.mock('@/api/prueba', () => ({
  verPrueba: vi.fn(async () => respuesta),
  iniciarPrueba: vi.fn(async () => respuesta),
  responderPrueba: vi.fn(async () => undefined),
  responderPruebaCerrada: vi.fn(async () => undefined),
  subirArchivo: vi.fn(async () => undefined),
  subirEnlace: vi.fn(async () => undefined),
  entregarPrueba: vi.fn(async () => ({ estado: 'ENTREGADA', completa: true, faltantes: 0 })),
}))
vi.mock('@/api/portal', () => ({ verPostulacion: vi.fn() }))

const enUnaHora = () => new Date(Date.now() + 3_600_000).toISOString()

const PREGUNTAS: PreguntaPrueba[] = [
  {
    id: 21,
    tipo: 'OPCION_UNICA',
    enunciado: '¿Qué libro registra primero una venta al crédito?',
    respuestaTexto: null,
    opciones: [
      { id: 1, texto: 'Libro diario', orden: 1 },
      { id: 2, texto: 'Caja', orden: 2 },
    ],
    respuestaOpcionId: 1,
    respuestaMarcadas: [],
    posicion: 1,
  },
  {
    id: 22,
    tipo: 'OPCION_MULTIPLE',
    enunciado: '¿Qué cuentas se concilian a fin de mes?',
    respuestaTexto: null,
    opciones: [
      { id: 3, texto: 'Bancos', orden: 1 },
      { id: 4, texto: 'Proveedores', orden: 2 },
    ],
    respuestaOpcionId: null,
    respuestaMarcadas: [3],
    posicion: 2,
  },
  {
    id: 23,
    tipo: 'ESCALA',
    enunciado: '¿Cuánto dominas Excel?',
    respuestaTexto: null,
    opciones: [
      { id: 5, texto: 'Nada', orden: 1 },
      { id: 6, texto: null, orden: 2 },
      { id: 7, texto: 'Experto', orden: 3 },
    ],
    respuestaOpcionId: null,
    respuestaMarcadas: [],
    posicion: 3,
  },
  {
    id: 24,
    tipo: 'ABIERTA',
    enunciado: '¿Cómo hallaste el descuadre?',
    respuestaTexto: '   ',
    opciones: [],
    respuestaOpcionId: null,
    respuestaMarcadas: [],
    posicion: 4,
  },
]

function delEditor(parte: Partial<MiPrueba> = {}): MiPrueba {
  return {
    id: 1,
    estadoIntento: 'EN_CURSO',
    modalidad: 'CRONOMETRADA',
    iniciadoEn: new Date().toISOString(),
    venceEn: enUnaHora(),
    duracionMinutos: 90,
    enunciado: 'La empresa cerró marzo con un descuadre.',
    materiales: null,
    herramientasPermitidas: null,
    cambioTexto: null,
    preguntas: PREGUNTAS,
    entregables: [
      { id: 301, nombre: 'Tablero.xlsx', detalle: null, formato: 'ARCHIVO', esObligatorio: true, entregado: true },
    ],
    plazoDias: null,
    cuestionario: false,
    consigna: null,
    delEditor: true,
    ...parte,
  }
}

function montar() {
  const datos = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
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

beforeEach(() => {
  vi.clearAllMocks()
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(cleanup)

describe('la prueba del editor en el portal', () => {
  it('enseña las preguntas en los cuatro tipos, numeradas y sin puntos (AC-08)', async () => {
    respuesta = delEditor()
    montar()
    expect(await screen.findByText('Pregunta 1')).toBeTruthy()
    expect(screen.getByText('Pregunta 4')).toBeTruthy()
    expect((screen.getByRole('radio', { name: /Libro diario/ }) as HTMLInputElement).checked).toBe(true)
    expect((screen.getByRole('checkbox', { name: /Bancos/ }) as HTMLInputElement).checked).toBe(true)
    expect(screen.getByRole('radiogroup', { name: 'Niveles, del menor al mayor' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: '1, Nada' })).toBeTruthy()
    expect(screen.getByLabelText(/¿Cómo hallaste el descuadre\?/)).toBeTruthy()
    expect(screen.queryByText(/pts|puntos/)).toBeNull()
  })

  it('una cerrada se guarda al marcarla', async () => {
    respuesta = delEditor()
    montar()
    fireEvent.click(await screen.findByRole('radio', { name: '3, Experto' }))
    await waitFor(() => expect(responderPruebaCerrada).toHaveBeenCalledWith('x1', 23, { opcionId: 7 }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Proveedores/ }))
    await waitFor(() =>
      expect(responderPruebaCerrada).toHaveBeenCalledWith('x1', 22, { marcadas: [3, 4] }),
    )
  })

  it('«Entregar» con huecos dice cuáles faltan y lleva a la primera; no abre el diálogo (AC-10)', async () => {
    respuesta = delEditor()
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Entregar prueba' }))
    const aviso = await screen.findByText(/Para entregar te falta responder/)
    // La escala sin marcar y la abierta con solo espacios.
    expect(aviso.textContent).toContain('2 preguntas (la 3 y la 4)')
    expect(screen.getByText(/Los entregables obligatorios están completos/)).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(entregarPrueba).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Ir a la pregunta 3' }))
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
  })

  it('sin el entregable obligatorio tampoco se entrega', async () => {
    respuesta = delEditor({
      preguntas: [PREGUNTAS[0]!],
      entregables: [
        { id: 301, nombre: 'Tablero.xlsx', detalle: null, formato: 'ARCHIVO', esObligatorio: true, entregado: false },
      ],
    })
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Entregar prueba' }))
    expect(await screen.findByText('Te falta subir «Tablero.xlsx».')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('con todo respondido, abre el diálogo de siempre y entrega', async () => {
    respuesta = delEditor({ preguntas: [PREGUNTAS[0]!, PREGUNTAS[1]!] })
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Entregar prueba' }))
    const dialogo = await screen.findByRole('dialog')
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Entregar' }))
    await waitFor(() => expect(entregarPrueba).toHaveBeenCalledWith('x1'))
  })

  it('vencida con huecos queda sin completar, y se le dice', async () => {
    respuesta = delEditor({ estadoIntento: 'NO_COMPLETADA' })
    montar()
    expect(
      await screen.findByRole('heading', { name: 'Tu tiempo terminó y la prueba quedó sin completar.' }),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Entregar/ })).toBeNull()
  })

  it('al empezar, el diálogo dice la regla de la prueba del editor, no «se entrega lo guardado» (AC-11)', async () => {
    respuesta = delEditor({ estadoIntento: 'PENDIENTE', iniciadoEn: null, venceEn: null })
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Empezar prueba' }))
    const dialogo = await screen.findByRole('dialog')
    expect(dialogo.textContent).toContain('la prueba se entrega sola si está completa')
    expect(dialogo.textContent).toContain('queda sin completar y no se califica')
    expect(dialogo.textContent).not.toContain('se entrega lo que hayas guardado')
  })

  it('la pantalla previa sin caso: fecha límite, tiempo, cuántas preguntas y archivos; ningún bloque de caso (AC-19)', async () => {
    respuesta = delEditor({
      estadoIntento: 'PENDIENTE',
      iniciadoEn: null,
      venceEn: null,
      enunciado: null,
      herramientasPermitidas: 'Excel',
      fechaLimite: '2026-10-10T04:59:00Z',
      entregables: [
        { id: 301, nombre: 'Flujo de caja.xlsx', detalle: null, formato: 'ARCHIVO', esObligatorio: true, entregado: false, preguntaId: 24 },
        { id: 302, nombre: 'Informe final', detalle: null, formato: 'ARCHIVO', esObligatorio: true, entregado: false },
      ],
    })
    montar()
    expect(await screen.findByText('viernes 09/10 a las 23:59')).toBeTruthy()
    expect(screen.getByText('Fecha límite')).toBeTruthy()
    expect(screen.getByText('Tendrás 90 minutos desde que pulses Empezar')).toBeTruthy()
    expect(screen.getByText('4 preguntas · 2 archivos que subir')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Herramientas permitidas' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /El caso|El encargo|De qué va/ })).toBeNull()
    expect(screen.getByText(/· en la pregunta 4/)).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/cuestionario/i)
  })

  it('sin cronómetro: «Puedes trabajar en ella hasta la fecha límite»; con caso, «El caso» y su PDF', async () => {
    respuesta = delEditor({
      estadoIntento: 'PENDIENTE',
      iniciadoEn: null,
      venceEn: null,
      modalidad: 'PLAZO_ABIERTO',
      duracionMinutos: null,
      fechaLimite: '2026-10-10T04:59:00Z',
      consigna: { nombre: 'caso.pdf', url: null },
    })
    montar()
    expect(await screen.findByText('Puedes trabajar en ella hasta la fecha límite')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'El caso' })).toBeTruthy()
    expect(screen.getByText('Enunciado adjunto: caso.pdf.')).toBeTruthy()
  })

  it('la plantilla conserva su aviso de siempre al empezar', async () => {
    respuesta = delEditor({ estadoIntento: 'PENDIENTE', iniciadoEn: null, venceEn: null, delEditor: false })
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Empezar prueba' }))
    const dialogo = await screen.findByRole('dialog')
    expect(dialogo.textContent).toContain('Al terminar se entrega lo que hayas guardado.')
    expect(dialogo.textContent).not.toContain('sin completar')
  })

  it('al llegar a cero, la prueba del editor dice que se entregará sola si está completa', async () => {
    respuesta = delEditor({ venceEn: new Date(Date.now() - 60_000).toISOString() })
    montar()
    const aviso = await screen.findByRole('alert')
    expect(aviso.textContent).toContain('Terminó el plazo de esta prueba')
    expect(aviso.textContent).toContain('se entregará sola si está completa; si falta algo, quedará sin completar.')
  })

  it('el archivo de una pregunta se sube dentro de ella; los generales van en «Entregables», al final', async () => {
    respuesta = delEditor({
      entregables: [
        { id: 301, nombre: 'Flujo de caja.xlsx', detalle: null, formato: 'ARCHIVO', esObligatorio: true, entregado: false, preguntaId: 24 },
        { id: 302, nombre: 'Informe final', detalle: null, formato: 'ARCHIVO', esObligatorio: true, entregado: true },
      ],
    })
    montar()
    expect(await screen.findByText('Archivo de esta pregunta:', { exact: false })).toBeTruthy()
    const archivo = document.getElementById('entregable-301')!
    expect(archivo.textContent).toMatch(/^Archivo de esta pregunta: Flujo de caja\.xlsx · obligatorio/)
    const entregables = screen.getByRole('heading', { name: 'Entregables' }).closest('section')!
    expect(within(entregables).queryByText('Flujo de caja.xlsx')).toBeNull()
    expect(within(entregables).getByText(/Informe final/)).toBeTruthy()
  })

  it('«Entregar» sin el archivo de una pregunta lo dice y lleva a esa pregunta (AC-20)', async () => {
    respuesta = delEditor({
      preguntas: [PREGUNTAS[0]!, PREGUNTAS[1]!],
      entregables: [
        { id: 301, nombre: 'Flujo de caja.xlsx', detalle: null, formato: 'ARCHIVO', esObligatorio: true, entregado: false, preguntaId: 22 },
        { id: 302, nombre: 'Informe final', detalle: null, formato: 'ARCHIVO', esObligatorio: true, entregado: false },
      ],
    })
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Entregar prueba' }))
    expect(await screen.findByText('Te falta subir «Flujo de caja.xlsx» (pregunta 2), «Informe final».')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Ir a la pregunta 2' }))
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
  })

  it('si solo falta un general, lleva a los entregables', async () => {
    respuesta = delEditor({
      preguntas: [PREGUNTAS[0]!],
      entregables: [
        { id: 302, nombre: 'Informe final', detalle: null, formato: 'ARCHIVO', esObligatorio: true, entregado: false },
      ],
    })
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Entregar prueba' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Ir a los entregables' }))
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
  })
})
