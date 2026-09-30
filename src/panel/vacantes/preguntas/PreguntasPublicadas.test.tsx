/**
 * Las preguntas publicadas con gente dentro (AC-29): cambiar las instrucciones
 * de la IA sin saldo, o con la IA apagada, abre la ventana «sin saldo» y no da
 * nada por guardado; y «Reintentar» vuelve a pedir la recalificación.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ErrorApi } from '../../api/cliente'
import type { EditorDePreguntas as Editor, VersionDePreguntas } from '../../api/preguntasPropias'
import { PreguntasPublicadas } from './PreguntasPublicadas'

const corregir = vi.fn()
const reintentar = vi.fn()
vi.mock('../../api/preguntasPropias', async (original) => ({
  ...(await original<typeof import('../../api/preguntasPropias')>()),
  corregirInstrucciones: (id: number, datos: unknown) => corregir(id, datos),
  reintentarRecalificacion: (id: number) => reintentar(id),
}))

const publicada: VersionDePreguntas = {
  id: 70,
  estado: 'PUBLICADA',
  guiaCalificacion: 'Premia el dato concreto',
  minutosObjetivo: 25,
  versionGuia: 1,
  total: 100,
  cuantosCriterios: 1,
  cuantasPreguntas: 1,
  criterios: [
    {
      id: 5,
      nombre: 'Contabilidad',
      queEvalua: 'El cierre mensual',
      orden: 1,
      puntos: 100,
      puntosSistema: 0,
      puntosIa: 100,
      preguntas: [
        {
          id: 10,
          tipo: 'ABIERTA',
          enunciado: 'Cuéntanos un cierre con un descuadre',
          puntos: 100,
          criterioId: 5,
          orden: 1,
          queDebeTener: 'El monto y la cuenta',
          opciones: [],
        },
      ],
    },
  ],
  sinCriterio: [],
  avisos: [],
}

const editor = (parte: Partial<Editor> = {}): Editor => ({
  vacanteId: 40,
  titulo: 'Asistente contable',
  nivel: 'EJECUCION',
  origen: 'VACANTE',
  aplicaEvaluacion: true,
  puedeEditar: true,
  hayPostulantes: true,
  borrador: null,
  publicada,
  resumen: { estado: 'PUBLICADAS', puntos: 100, criterios: 1, preguntas: 1 },
  recalificacion: { rindieron: 3, conNota: 3, alDia: 3, recalificando: 0, pendientes: 0, motivos: [] },
  ...parte,
})

function pintar(datos: Editor) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <PreguntasPublicadas editor={datos} publicada={publicada} alCambiar={vi.fn()} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})
afterEach(cleanup)

describe('corregir las instrucciones sin IA (AC-29)', () => {
  const guardarSinSaldo = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Corregir las instrucciones de la IA' }))
    fireEvent.change(screen.getByLabelText(/Guía de calificación para la IA/), {
      target: { value: 'Premia el dato concreto y la fecha' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar las instrucciones' }))
    // Con gente calificada, primero se confirma que se va a recalificar
    expect(screen.getByRole('alertdialog', { name: 'Volver a calificar' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Sí, volver a calificar' }))
    return screen.findByRole('dialog')
  }
  const vecesQueDice = (texto: string | null, frase: RegExp) =>
    (texto ?? '').match(new RegExp(frase.source, 'gi'))?.length ?? 0

  it.each([
    ['en el tope de uso', 'La IA no tiene saldo: la empresa llegó a su tope mensual de IA.'],
    ['con la IA apagada', 'La IA está apagada en este sistema: ahora no se puede usar.'],
    ['con la empresa suspendida', 'La empresa está suspendida: la IA no se usa mientras tanto.'],
  ])('%s: se abre la ventana «sin saldo», dice una vez por qué y no se da nada por guardado', async (_caso, motivo) => {
    corregir.mockRejectedValue(
      new ErrorApi(409, `${motivo} No se guardó el cambio: guardarlo sin recalificar dejaría a unos candidatos medidos con una guía y a otros con otra.`),
    )
    pintar(editor())

    const ventana = await guardarSinSaldo()
    expect(within(ventana).getByText('La IA no tiene saldo')).toBeTruthy()
    expect(ventana.textContent).toContain(motivo)
    // QA-PP-09: el mensaje del servidor ya lo explica; la ventana no lo repite.
    expect(vecesQueDice(ventana.textContent, /no se guardó/)).toBe(1)
    expect(vecesQueDice(ventana.textContent, /guardarlo sin recalificar/)).toBe(1)
    expect(corregir).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/Instrucciones guardadas/)).toBeNull()
  })

  it('si el servidor solo da el motivo, la ventana explica ella que no se guardó, también una vez', async () => {
    const motivo = 'La IA está apagada en este sistema: ahora no se puede usar.'
    corregir.mockRejectedValue(new ErrorApi(409, motivo))
    pintar(editor())

    const ventana = await guardarSinSaldo()
    expect(ventana.textContent).toContain(motivo)
    expect(within(ventana).getByText(/el cambio no se guardó/)).toBeTruthy()
    expect(vecesQueDice(ventana.textContent, /guardarlo sin recalificar/)).toBe(1)
    expect(screen.queryByText(/Instrucciones guardadas/)).toBeNull()
  })
})

describe('la recalificación detenida', () => {
  it('dice quién quedó pendiente y por qué, y «Reintentar» la vuelve a pedir', async () => {
    reintentar.mockResolvedValue({ personas: 1 })
    pintar(
      editor({
        recalificacion: {
          rindieron: 3,
          conNota: 3,
          alDia: 2,
          recalificando: 0,
          pendientes: 1,
          motivos: ['El proveedor contestó 402: la cuenta no tiene saldo.'],
        },
      }),
    )

    expect(screen.getByText(/Pendiente de recalificar: 1 persona conserva/)).toBeTruthy()
    expect(screen.getByText(/contestó 402/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(reintentar).toHaveBeenCalledWith(40))
    expect(await screen.findByText('Se volvió a pedir la recalificación de 1 persona.')).toBeTruthy()
  })
})

describe('«Reintentar» dice qué pasó (QA-PP-05)', () => {
  const pendiente = editor({
    recalificacion: { rindieron: 3, conNota: 3, alDia: 2, recalificando: 0, pendientes: 1, motivos: ['El proveedor contestó 402.'] },
  })

  it.each([
    ['con la IA apagada', 'La IA está apagada en este sistema: ahora no se puede usar.'],
    ['en el tope de uso', 'La IA no tiene saldo: la empresa llegó a su tope mensual de IA.'],
  ])('%s no dice que no quedaba nadie: dice por qué no se encoló', async (_caso, motivo) => {
    const dicho = `${motivo} No se volvió a pedir la recalificación: 1 persona sigue con la nota de la guía anterior.`
    reintentar.mockResolvedValue({ personas: 0, motivo: dicho })
    pintar(pendiente)

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    const estado = await screen.findByText(dicho)
    expect(estado.getAttribute('role')).toBe('status')
    expect(screen.queryByText('No quedó nadie por volver a encolar.')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('sin motivo y sin nadie encolado, sí dice que no quedaba nadie', async () => {
    reintentar.mockResolvedValue({ personas: 0, motivo: null })
    pintar(pendiente)
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('No quedó nadie por volver a encolar.')).toBeTruthy()
  })
})

describe('los avisos con una sola persona (QA-PP-06)', () => {
  const una = editor({
    recalificacion: { rindieron: 1, conNota: 1, alDia: 1, recalificando: 0, pendientes: 0, motivos: [] },
  })

  it('cambiar la guía: «a la persona que ya tiene nota», no «a las 1 persona»', () => {
    pintar(una)
    fireEvent.click(screen.getByRole('button', { name: 'Corregir las instrucciones de la IA' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar las instrucciones' }))
    const aviso = screen.getByRole('alertdialog', { name: 'Volver a calificar' })
    expect(aviso.textContent).toContain('Se volverá a calificar a la persona que ya tiene nota.')
    expect(aviso.textContent).toContain('Las notas ajustadas a mano no cambian')
    expect(aviso.textContent).not.toMatch(/las 1 /)
  })

  it('cambiar los puntos: «la nota de la persona que ya rindió», no «las 1 persona»', () => {
    pintar(una)
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar los puntos' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar los puntos' }))
    const aviso = screen.getByRole('alertdialog', { name: 'Recalcular las notas' })
    expect(aviso.textContent).toBe('Se recalculará la nota de la persona que ya rindió. No se llama a la IA.')
  })

  it('con varias, el plural con su número', () => {
    pintar(editor())
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar los puntos' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar los puntos' }))
    expect(screen.getByRole('alertdialog', { name: 'Recalcular las notas' }).textContent).toBe(
      'Se recalcularán las notas de las 3 personas que ya rindieron. No se llama a la IA.',
    )
  })
})
