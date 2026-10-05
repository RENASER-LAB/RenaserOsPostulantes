/**
 * La pestaña «Prueba» de la ficha con la prueba del editor (V67, AC-25):
 *
 *   - Cada criterio dice su nota y de dónde sale: «Sistema 8/10 + IA 16/20».
 *   - Sus cerradas con la opción marcada, sus abiertas y sus entregables.
 *   - Pendiente: «pendiente» y qué falta, sin nota de la etapa (AC-15).
 *   - Ajustar: de 0 al máximo de la parte calificada y con motivo (AC-16, AC-17).
 *   - Ajustada: quién, cuándo, por qué y lo que había puesto la IA.
 *   - Sin completar: lo que le faltó (AC-11).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { CriterioDelCandidato, PruebaDelCandidato as Prueba } from '../api/pruebaPropia'
import { PruebaDelCandidato, deDondeSale } from './PruebaDelCandidato'

const ver = vi.fn()
const ajustar = vi.fn()

vi.mock('../api/pruebaPropia', async (original) => ({
  ...(await original<typeof import('../api/pruebaPropia')>()),
  verPruebaDelCandidato: (id: number) => ver(id),
  ajustarCriterio: (id: number, criterioId: number, datos: unknown) => ajustar(id, criterioId, datos),
}))

const conocimiento = (parte: Partial<CriterioDelCandidato> = {}): CriterioDelCandidato => ({
  criterioId: 5,
  nombre: 'Conocimiento contable',
  queEvalua: null,
  maximo: 30,
  sistemaMaximo: 10,
  sistema: 8,
  calificadaMaximo: 20,
  calificador: 'IA',
  calificada: 16,
  calificadaIa: null,
  nota: 24,
  estado: 'CALIFICADO',
  explicacion: 'Ubicó el descuadre en la cuenta correcta.',
  evidencia: null,
  origen: 'IA',
  ajustadaPor: null,
  ajustadaEn: null,
  motivoAjuste: null,
  preguntas: [
    {
      preguntaId: 10,
      tipo: 'OPCION_UNICA',
      enunciado: '¿Qué libro registra primero una venta al crédito?',
      queDebeTener: null,
      puntos: 10,
      obtenido: 8,
      respuesta: 'Libro diario',
      respondida: true,
      opciones: [
        { id: 1, texto: 'Libro diario', puntos: 8, marcada: true },
        { id: 2, texto: 'Caja', puntos: 0, marcada: false },
      ],
    },
    {
      preguntaId: 11,
      tipo: 'ABIERTA',
      enunciado: '¿Cómo hallaste el descuadre?',
      queDebeTener: 'La cuenta y el monto',
      puntos: null,
      obtenido: null,
      respuesta: 'Conciliando el banco contra el mayor.',
      respondida: true,
      opciones: [],
    },
  ],
  entregables: [301],
  ...parte,
})

const comunicacion = (parte: Partial<CriterioDelCandidato> = {}): CriterioDelCandidato => ({
  ...conocimiento(),
  criterioId: 6,
  nombre: 'Comunicación',
  maximo: 20,
  sistemaMaximo: 0,
  sistema: 0,
  calificadaMaximo: 20,
  calificador: 'PERSONA',
  calificada: null,
  nota: null,
  estado: 'PENDIENTE',
  explicacion: null,
  origen: null,
  preguntas: [],
  entregables: [302],
  ...parte,
})

const prueba = (parte: Partial<Prueba> = {}): Prueba => ({
  postulacionId: 77,
  estado: 'ENTREGADA',
  cuestionario: false,
  iniciadoEn: '2026-09-30T14:00:00Z',
  entregadoEn: '2026-09-30T15:20:00Z',
  entregaAutomatica: false,
  nota: null,
  loQueFalta: ['«Comunicación»: la califica una persona'],
  puedeAjustar: true,
  recalificando: false,
  motivoPendiente: null,
  criterios: [conocimiento(), comunicacion()],
  entregables: [
    {
      entregableId: 301,
      nombre: 'Tablero.xlsx',
      detalle: null,
      formato: 'ARCHIVO',
      obligatorio: true,
      queDebeTener: null,
      loEntrego: true,
      enlace: null,
      archivoId: null,
      archivoNombre: null,
      subidoEn: '2026-09-30T15:10:00Z',
      porQueNoSeVe: 'El archivo ya no está guardado',
    },
    {
      entregableId: 302,
      nombre: 'Video de 2 min',
      detalle: null,
      formato: 'ENLACE',
      obligatorio: false,
      queDebeTener: null,
      loEntrego: true,
      enlace: 'https://video.example/abc',
      archivoId: null,
      archivoNombre: null,
      subidoEn: '2026-09-30T15:12:00Z',
      porQueNoSeVe: null,
    },
  ],
  ...parte,
})

function pintar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={cliente}>
      <PruebaDelCandidato postulacionId={77} />
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

describe('de dónde sale la nota de un criterio', () => {
  it('«Sistema 8/10 + IA 16/20», la persona pendiente y solo el sistema', () => {
    expect(deDondeSale(conocimiento())).toBe('Sistema 8/10 + IA 16/20')
    expect(deDondeSale(comunicacion())).toBe('Persona pendiente/20')
    expect(deDondeSale(conocimiento({ calificadaMaximo: 0, calificador: null, calificada: null }))).toBe(
      'Sistema 8/10',
    )
  })
})

describe('la prueba de un candidato, criterio a criterio (AC-25)', () => {
  it('cada criterio con su nota, sus cerradas marcadas, sus abiertas y lo que entregó', async () => {
    ver.mockResolvedValue(prueba({ nota: 81, loQueFalta: [], criterios: [conocimiento()] }))
    pintar()
    expect(await screen.findByText('24/30')).toBeTruthy()
    expect(screen.getByText(/Sistema 8\/10 \+ IA 16\/20/)).toBeTruthy()
    expect(screen.getByText(/Nota de la prueba:/).textContent).toContain('81 de 100')
    expect(screen.getByText('Ubicó el descuadre en la cuenta correcta.')).toBeTruthy()
    // La opción que marcó lo dice con palabras; la otra, no.
    const marcada = screen.getByText(/Libro diario/, { selector: 'li' })
    expect(marcada.textContent).toMatch(/la marcó$/)
    expect(screen.getByText(/Caja/, { selector: 'li' }).textContent).not.toMatch(/la marcó/)
    expect(screen.getByText('Conciliando el banco contra el mayor.')).toBeTruthy()
    expect(screen.getByText('Mira: Tablero.xlsx')).toBeTruthy()
    // Lo que entregó: el enlace se abre; el archivo perdido lo dice.
    expect(screen.getByRole('link', { name: 'https://video.example/abc' })).toBeTruthy()
    expect(screen.getByText('El archivo ya no está guardado')).toBeTruthy()
  })

  it('pendiente: «pendiente», sin nota de la etapa, y qué falta (AC-15)', async () => {
    ver.mockResolvedValue(prueba())
    pintar()
    expect(await screen.findByText('pendiente')).toBeTruthy()
    expect(screen.getByText(/Sin nota todavía/).textContent).toContain('«Comunicación»: la califica una persona')
    expect(screen.queryByText(/Nota de la prueba:/)).toBeNull()
  })

  it('ajustar exige de 0 al máximo de la parte calificada y un motivo (AC-16, AC-17)', async () => {
    ver.mockResolvedValue(prueba())
    ajustar.mockResolvedValue(prueba({ nota: 39, loQueFalta: [], criterios: [conocimiento(), comunicacion({ calificada: 15, nota: 15, estado: 'CALIFICADO' })] }))
    pintar()
    const calificar = await screen.findByRole('button', { name: /Calificar a mano Comunicación/ })
    fireEvent.click(calificar)
    const puntaje = screen.getByLabelText(/Parte calificada \(persona\) · de 0 a 20/)
    const guardar = screen.getByRole('button', { name: 'Guardar la nota' })

    fireEvent.change(puntaje, { target: { value: '21' } })
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'Explicó bien el cierre' } })
    expect(screen.getByText(/Un número de 0 a 20, con hasta dos decimales/)).toBeTruthy()
    expect((guardar as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(puntaje, { target: { value: '15.555' } })
    expect((guardar as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(puntaje, { target: { value: '15' } })
    expect((guardar as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(guardar)
    await waitFor(() =>
      expect(ajustar).toHaveBeenCalledWith(77, 6, { puntaje: 15, motivo: 'Explicó bien el cierre' }),
    )
    expect(await screen.findByText(/Nota de la prueba:/)).toBeTruthy()
  })

  it('la parte automática no se ajusta: un criterio sin parte calificada no tiene botón', async () => {
    ver.mockResolvedValue(
      prueba({
        criterios: [conocimiento({ calificadaMaximo: 0, calificador: null, calificada: null, estado: 'SOLO_SISTEMA', nota: 8, maximo: 10 })],
      }),
    )
    pintar()
    await screen.findByText('8/10')
    expect(screen.queryByRole('button', { name: /Ajustar la parte calificada|Calificar a mano/ })).toBeNull()
  })

  it('sin el permiso de ajustar, no hay botón', async () => {
    ver.mockResolvedValue(prueba({ puedeAjustar: false }))
    pintar()
    await screen.findByText('pendiente')
    expect(screen.queryByRole('button', { name: /Calificar a mano/ })).toBeNull()
  })

  it('ajustada: quién, por qué y lo que había puesto la IA', async () => {
    ver.mockResolvedValue(
      prueba({
        nota: 81,
        loQueFalta: [],
        criterios: [
          conocimiento({
            calificada: 18,
            calificadaIa: 12,
            nota: 26,
            origen: 'PERSONA',
            ajustadaPor: 'Lucía Torres',
            ajustadaEn: '2026-09-30T16:00:00Z',
            motivoAjuste: 'El tablero estaba completo',
          }),
        ],
      }),
    )
    pintar()
    const linea = await screen.findByText(/Ajustada por Lucía Torres/)
    expect(linea.textContent).toContain('(la IA había puesto 12)')
    expect(linea.textContent).toContain(': El tablero estaba completo')
  })

  it('sin completar: lo que le faltó, sin nota ni ajuste (AC-11)', async () => {
    ver.mockResolvedValue(
      prueba({
        estado: 'NO_COMPLETADA',
        entregadoEn: '2026-09-30T15:30:00Z',
        entregaAutomatica: true,
        loQueFalta: ['le faltaron 2 preguntas'],
        puedeAjustar: false,
      }),
    )
    pintar()
    const estado = await screen.findByText(/quedó sin completar/)
    expect(estado.textContent).toContain('le faltaron 2 preguntas')
    expect(screen.queryByText(/Nota de la prueba/)).toBeNull()
    const criterios = screen.getAllByRole('list')[0]!
    expect(within(criterios).getAllByText('—').length).toBeGreaterThan(0)
  })

  it('un cuestionario concuerda en masculino: «lo abrió», «Entregado, solo» (AC-06)', async () => {
    ver.mockResolvedValue(prueba({ cuestionario: true, estado: 'EN_CURSO', entregadoEn: null }))
    pintar()
    expect(await screen.findByText(/Está rindiendo el cuestionario: lo abrió el/)).toBeTruthy()
    cleanup()

    ver.mockResolvedValue(prueba({ cuestionario: true, entregaAutomatica: true }))
    pintar()
    expect(await screen.findByText(/^Entregado el .*, solo, al vencer el tiempo\.$/)).toBeTruthy()
  })

  it('la prueba sigue en femenino: «la abrió», «Entregada, sola»', async () => {
    ver.mockResolvedValue(prueba({ estado: 'EN_CURSO', entregadoEn: null }))
    pintar()
    expect(await screen.findByText(/Está rindiendo la prueba: la abrió el/)).toBeTruthy()
    cleanup()

    ver.mockResolvedValue(prueba({ entregaAutomatica: true }))
    pintar()
    expect(await screen.findByText(/^Entregada el .*, sola, al vencer el tiempo\.$/)).toBeTruthy()
  })
})
