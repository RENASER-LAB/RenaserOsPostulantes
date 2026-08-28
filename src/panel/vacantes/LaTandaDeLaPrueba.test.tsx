/**
 * Calificar y ponderar la prueba de la tanda entera.
 *
 * Lo que compila perfectamente estando mal aqui:
 *
 *   1. **Pedirle al agente lo que ya calificó.** Es la razon de que haya un
 *      paso de «revisar» antes de las acciones: el backend no dice quien esta
 *      calificado, hay que preguntarle la rubrica a cada uno. Meter a alguien
 *      con su rubrica entera en el grupo de «calificar» cuesta una llamada al
 *      modelo y puede pisar lo que ya habia.
 *   2. **Decir «calificado» sobre lo que solo se encolo.** Ponderar SI deja la
 *      nota —su respuesta la trae— y calificar NO: solo pide. Son dos frases
 *      distintas a proposito, y es la regla que este producto ya pago una vez.
 *   3. **Contar un cero como criterio sin calificar.** `0` es una nota: en la
 *      base local hay una postulacion con sus siete criterios en 0.0.
 *   4. **Alcanzar a quien no ha rendido.** A quien esta en TURNO_CANDIDATO no
 *      hay nada que calificarle, y encolarlo gasta una llamada al modelo sobre
 *      una prueba en blanco.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ErrorApi } from '../api/cliente'
import { LaTandaDeLaPrueba } from './LaTandaDeLaPrueba'
import type { FilaRanking, NotaCriterioEtapa } from '../api/tipos'

const fila = (postulacionId: number, candidato: string, estado: string): FilaRanking => ({
  puesto: postulacionId,
  postulacionId,
  uuid: `p${postulacionId}`,
  candidato,
  correo: `${candidato.toLowerCase()}@example.com`,
  estado,
  estadoNombre: estado,
  estadoCalificacion: 'TERMINADA',
  pasada: 'FINA',
  archivoNombre: null,
  grupoPrioridad: null,
  notaEtapa: null,
  notaCurriculum: null,
  adecuacion: null,
  potencial: null,
  altoRendimiento: null,
  confianzaEvidencia: null,
  resumen: null,
  riesgosCriticos: 0,
  fortalezas: 0,
  alertas: 0,
  actualizadoEn: null,
  notasCriterio: [],
})

const criterio = (id: number, puntaje: number | null): NotaCriterioEtapa => ({
  criterioId: id,
  nombre: `Criterio ${id}`,
  puntosMaximos: 10,
  puntaje,
  explicacion: null,
  origen: puntaje === null ? null : 'AGENTE',
})

const ENTERA = [criterio(1, 3), criterio(2, 5)]
const VACIA = [criterio(1, null), criterio(2, null)]
const A_MEDIAS = [criterio(1, 3), criterio(2, null)]

const verNotas = vi.fn()
const ponderar = vi.fn()
const calificar = vi.fn()

vi.mock('../api/panel', () => ({
  verNotasPrueba: (id: number) => verNotas(id),
  calcularNotaDePrueba: (id: number) => ponderar(id),
  calificarPruebaConIa: (id: number) => calificar(id),
}))

const montar = (filas: FilaRanking[], alTerminar = () => {}) =>
  render(<LaTandaDeLaPrueba filas={filas} alTerminar={alTerminar} />)

const revisar = async () =>
  fireEvent.click(await screen.findByRole('button', { name: /Ver qué le falta/ }))

beforeEach(() => {
  for (const espia of [verNotas, ponderar, calificar]) espia.mockReset()
  ponderar.mockResolvedValue({ nota: 7 })
  calificar.mockResolvedValue({ estado: 'ENCOLADA' })
})

afterEach(cleanup)

describe('a quién alcanza', () => {
  it('a quien rindió la prueba y sigue sin nota', () => {
    montar([
      fila(1, 'Ana', 'PRUEBA_CALIFICANDO'),
      fila(2, 'Beto', 'PRUEBA_POR_CONFIRMAR'),
    ])
    expect(screen.getByText(/2 personas rindieron la prueba/)).toBeTruthy()
  })

  /* Encolarle una prueba en blanco cuesta una llamada al modelo para nada. */
  it('NO a quien todavía no la ha rendido', () => {
    montar([fila(1, 'Ana', 'PRUEBA_TURNO_CANDIDATO')])
    expect(screen.queryByText(/rindieron la prueba/)).toBeNull()
  })

  it('NO a quien está en otra etapa', () => {
    montar([fila(1, 'Ana', 'PERFIL_CALIFICANDO'), fila(2, 'Beto', 'SIMULACION_POR_CONFIRMAR')])
    expect(screen.queryByText(/rindieron la prueba/)).toBeNull()
  })

  it('NO a quien ya tiene nota', () => {
    montar([{ ...fila(1, 'Ana', 'PRUEBA_CALIFICANDO'), notaEtapa: 12 }])
    expect(screen.queryByText(/rindió la prueba/)).toBeNull()
  })

  it('sin nadie a quien alcanzar no se pinta el bloque', () => {
    const { container } = montar([fila(1, 'Ana', 'PRUEBA_TURNO_CANDIDATO')])
    expect(container.querySelector('section')).toBeNull()
  })
})

describe('el reparto: quién está calificado y quién no', () => {
  it('separa a quien solo le falta ponderar de quien no tiene ninguna nota', async () => {
    verNotas.mockImplementation((id: number) =>
      Promise.resolve(id === 1 ? ENTERA : VACIA),
    )
    montar([fila(1, 'Ana', 'PRUEBA_CALIFICANDO'), fila(2, 'Beto', 'PRUEBA_CALIFICANDO')])
    await revisar()

    expect(await screen.findByText(/solo le falta el cálculo/)).toBeTruthy()
    expect(screen.getByText(/no tiene ninguna nota de criterio/)).toBeTruthy()
    expect(verNotas).toHaveBeenCalledTimes(2)
  })

  it('un cero es un criterio calificado, no uno vacío', async () => {
    // La postulación 16 de la base local tiene sus siete criterios en 0.0.
    verNotas.mockResolvedValue([criterio(1, 0), criterio(2, 0)])
    montar([fila(1, 'Ana', 'PRUEBA_CALIFICANDO')])
    await revisar()
    expect(await screen.findByText(/solo le falta el cálculo/)).toBeTruthy()
    expect(screen.queryByText(/no tiene ninguna nota de criterio/)).toBeNull()
  })

  it('la rúbrica a medias es un tercer grupo, sin acción en lote', async () => {
    verNotas.mockResolvedValue(A_MEDIAS)
    montar([fila(1, 'Ana', 'PRUEBA_CALIFICANDO')])
    await revisar()
    // Sale dos veces a propósito: en el reparto y en la pista de abajo, que
    // dice qué hacer con ella. Son dos frases distintas.
    expect((await screen.findAllByText(/la rúbrica a medias/)).length).toBe(2)
    expect(screen.getByText(/se le termina desde su ficha/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Calcular/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Pedirle a la IA/ })).toBeNull()
  })

  it('un grupo vacío no se pinta: «0 no tienen nota» ocupa sitio y no dice nada', async () => {
    verNotas.mockResolvedValue(ENTERA)
    montar([fila(1, 'Ana', 'PRUEBA_CALIFICANDO')])
    await revisar()
    await screen.findByText(/solo le falta el cálculo/)
    expect(screen.queryByText(/no tiene ninguna nota de criterio/)).toBeNull()
  })
})

describe('los dos verbos no dicen lo mismo', () => {
  it('ponderar SÍ puede decir que la nota está: su respuesta la trae', async () => {
    verNotas.mockResolvedValue(ENTERA)
    montar([fila(1, 'Ana', 'PRUEBA_CALIFICANDO'), fila(2, 'Beto', 'PRUEBA_CALIFICANDO')])
    await revisar()
    fireEvent.click(await screen.findByRole('button', { name: /Calcular las 2 notas/ }))

    expect(await screen.findByText(/2 notas calculadas: ya salen en la tabla/)).toBeTruthy()
    expect(ponderar).toHaveBeenCalledTimes(2)
  })

  /*
    ⚠️ La regla de los indicadores que mienten: tras encolar, lo único cierto es
    que se pidió. Aquí no puede aparecer la palabra «calculada».
  */
  it('calificar NO dice que haya nota: solo que se pidió', async () => {
    verNotas.mockResolvedValue(VACIA)
    montar([fila(1, 'Ana', 'PRUEBA_CALIFICANDO')])
    await revisar()
    fireEvent.click(await screen.findByRole('button', { name: /Pedirle a la IA/ }))

    const dicho = await screen.findByRole('status')
    expect(dicho.textContent).toMatch(/Se pidió la calificación/)
    expect(dicho.textContent).toMatch(/tarda decenas de segundos/)
    expect(dicho.textContent).not.toMatch(/calculada|calificada/)
  })

  it('refresca el ranking al terminar: las notas las trae la tabla, no este bloque', async () => {
    const alTerminar = vi.fn()
    verNotas.mockResolvedValue(ENTERA)
    montar([fila(1, 'Ana', 'PRUEBA_CALIFICANDO')], alTerminar)
    await revisar()
    fireEvent.click(await screen.findByRole('button', { name: /Calcular la nota/ }))
    await waitFor(() => expect(alTerminar).toHaveBeenCalled())
  })
})

describe('cuando alguna falla', () => {
  /* Una a una y no en paralelo: el mensaje dice a quién, y las demás siguen. */
  it('las demás siguen y se nombra a quien falló', async () => {
    verNotas.mockResolvedValue(ENTERA)
    ponderar.mockImplementation((id: number) =>
      id === 1
        ? Promise.reject(new ErrorApi(409, 'Todavía faltan notas por poner: Caja', null))
        : Promise.resolve({ nota: 7 }),
    )
    montar([fila(1, 'Ana', 'PRUEBA_CALIFICANDO'), fila(2, 'Beto', 'PRUEBA_CALIFICANDO')])
    await revisar()
    fireEvent.click(await screen.findByRole('button', { name: /Calcular las 2 notas/ }))

    const dicho = await screen.findByRole('status')
    expect(dicho.textContent).toMatch(/1 nota calculada/)
    expect(dicho.textContent).toMatch(/No se pudo con 1: Ana/)
    expect(dicho.textContent).toMatch(/faltan notas por poner: Caja/)
  })

  it('un 403 nombra el permiso en vez de enseñar «Forbidden»', async () => {
    verNotas.mockResolvedValue(ENTERA)
    ponderar.mockRejectedValue(new ErrorApi(403, 'Forbidden', null))
    montar([fila(1, 'Ana', 'PRUEBA_CALIFICANDO')])
    await revisar()
    fireEvent.click(await screen.findByRole('button', { name: /Calcular la nota/ }))

    const dicho = await screen.findByRole('status')
    expect(dicho.textContent).toMatch(/permiso «ajustar_nota»/)
    expect(dicho.textContent).not.toMatch(/Forbidden/)
  })

  it('a quien no tiene rúbrica se le cuenta aparte, sin darlo por fallo', async () => {
    verNotas.mockResolvedValue([])
    montar([fila(1, 'Ana', 'PRUEBA_CALIFICANDO')])
    await revisar()
    expect(await screen.findByText(/no tiene rúbrica de prueba/)).toBeTruthy()
  })
})
