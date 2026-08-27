/**
 * El ranking enseña la etapa que dice su pestaña, y nada mas.
 *
 * Lo que compila perfectamente estando mal aqui:
 *
 *   0. **Traer a la tanda entera en las cinco pestañas.** Es de donde viene
 *      este archivo: la mesa de la prueba llevaba dentro a quien todavia no la
 *      ha rendido y a quien la paso hace dos semanas, con la nota de la prueba
 *      vacia o vieja al lado. Cinco listas iguales no son cinco mesas de
 *      decidir; son la misma lista cinco veces.
 *   1. **Ocultar sin decirlo.** Filtrar por defecto y dejar encima un resumen
 *      que habla de ocho personas sobre una tabla de tres es el indicador que
 *      miente, la regla que a este producto ya le costo respuestas perdidas.
 *      La cifra sale de contar las filas que se pintan.
 *   2. **Confundir los dos vacios.** «Todavia no hay postulaciones» y «nadie
 *      esta en esta etapa» mandan a buscar en sitios distintos, y el segundo es
 *      el estado NORMAL de Validacion y Decision en casi toda vacante.
 *   3. **Perder de vista a quien termino.** NO_CONTINUA, CONTRATADO y CERRADA
 *      no empiezan por el prefijo de ninguna etapa: con el filtro puesto no
 *      salen en ninguna de las cinco, y la unica forma de llegar a ellas es el
 *      escape. Si el escape no sobrevive a cambiar de pestaña, no sirve.
 *   4. **Avanzar a quien no se ve.** Una marca puesta sin filtro y escondida
 *      despues seguiria contando en el boton de avanzar en tanda.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { VacantePanelDetalle } from './Vacante'
import type { FilaRanking } from '../api/tipos'

const verRanking = vi.fn()

/** Una fila con lo justo: lo que la tabla lee de verdad. */
const fila = (
  postulacionId: number,
  candidato: string,
  estado: string,
  notaEtapa: number | null,
): FilaRanking => ({
  puesto: postulacionId - 90,
  postulacionId,
  uuid: `p${postulacionId}`,
  candidato,
  correo: `${candidato.toLowerCase().replaceAll(' ', '.')}@example.com`,
  estado,
  estadoNombre: estado,
  estadoCalificacion: 'CALIFICADA',
  pasada: 'FINA',
  archivoNombre: null,
  grupoPrioridad: null,
  notaEtapa,
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

const EN_PERFIL = fila(91, 'Rodrigo Ayala', 'PERFIL_POR_CONFIRMAR', 84)
const RECIEN_POSTULADA = fila(92, 'Fátima Quispe', 'POSTULADA', null)
const EN_PRUEBA = fila(93, 'Camila Reyes', 'PRUEBA_TURNO_CANDIDATO', 75)
const TERMINADA = fila(94, 'Lucía Ferrer', 'NO_CONTINUA', 52)

const TANDA = [EN_PERFIL, EN_PRUEBA, RECIEN_POSTULADA, TERMINADA]

const sinRuido = {
  verVacante: () => Promise.resolve({ id: 1, titulo: 'Ingeniera', estado: 'PUBLICADA' }),
  verEmbudo: () => Promise.resolve({ porEstado: {} }),
  verCatalogos: () => Promise.resolve({ areas: [], puestos: [], nivelesPuesto: [], estados: [] }),
}

vi.mock('../api/panel', () => ({
  verVacante: () => sinRuido.verVacante(),
  verEmbudo: () => sinRuido.verEmbudo(),
  verCatalogos: () => sinRuido.verCatalogos(),
  verRanking: (id: number, etapa?: string) => verRanking(id, etapa),
  listarRequisitos: () => Promise.resolve([]),
  listarPuestos: () => Promise.resolve([]),
  listarPlantillasEvaluacion: () => Promise.resolve([]),
  listarPlantillasPrueba: () => Promise.resolve([]),
  listarVersionesPesos: () => Promise.resolve([]),
  listarVersionesPrueba: () => Promise.resolve([]),
  aplicarEvaluacion: () => Promise.resolve({}),
  asignarPlantillaEvaluacion: () => Promise.resolve({}),
  asignarPlantillaPrueba: () => Promise.resolve({}),
  asignarVersionPesos: () => Promise.resolve({}),
  cerrarVacante: () => Promise.resolve({}),
  confirmarAvance: () => Promise.resolve({}),
  crearRequisito: () => Promise.resolve({}),
  publicarVacante: () => Promise.resolve({}),
  quitarRequisito: () => Promise.resolve({}),
  verFicha: () => Promise.resolve({}),
  verHistorial: () => Promise.resolve([]),
  verPerfilIntegral: () => Promise.resolve({}),
  verDesgloseEvaluacion: () => Promise.resolve({}),
  verMetricasValidacion: () => Promise.resolve([]),
  verNotasPrueba: () => Promise.resolve([]),
  verNotasSimulacion: () => Promise.resolve([]),
  verValidacion: () => Promise.resolve({}),
  calificarPruebaConIa: () => Promise.resolve({ estado: 'ENCOLADA' }),
  calificarPerfilIntegralConIa: () => Promise.resolve({ estado: 'ENCOLADA' }),
  cribaRapida: () => Promise.resolve({ estado: 'ENCOLADA' }),
  cribaFina: () => Promise.resolve({ estado: 'ENCOLADA' }),
  verCierrePrueba: () => Promise.resolve({}),
  fijarCierrePrueba: () => Promise.resolve({}),
  quitarCierrePrueba: () => Promise.resolve({}),
  fijarPlazoPropio: () => Promise.resolve({}),
  verRespuestasDePrueba: () => Promise.resolve([]),
}))

const tanda = (filas: FilaRanking[]) => ({
  vacanteId: 1,
  vacante: 'Ingeniera',
  puesto: 'Ingeniera',
  nivelPuesto: 'MEDIO',
  total: filas.length,
  conPasadaFina: filas.length,
  calificados: filas.length,
  enCurso: 0,
  fallidos: 0,
  filas,
})

async function pintar(filas: FilaRanking[] = TANDA) {
  verRanking.mockResolvedValue(tanda(filas))
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={['/admin/vacantes/1']}>
        <Routes>
          <Route path="/admin/vacantes/:id" element={<VacantePanelDetalle />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  await screen.findByRole('heading', { name: 'El ranking, etapa por etapa' })
  await waitFor(() => expect(screen.getByText(/Se ven/)).toBeTruthy())
}

/** La del ranking es la primera de la pantalla; el `!` es de `noUncheckedIndexedAccess`. */
const laTabla = () => screen.getAllByRole('table')[0]!
const irA = (etapa: string) => fireEvent.click(screen.getByRole('tab', { name: etapa }))
const laCasilla = () => screen.getByRole('checkbox', { name: 'Ver la tanda entera' })

beforeEach(() => verRanking.mockReset())
afterEach(() => cleanup())

describe('el ranking filtra por la etapa de su pestaña', () => {
  it('abre enseñando solo a quien está parado en esa etapa', async () => {
    await pintar()
    const tabla = within(laTabla())
    expect(tabla.queryByText('Rodrigo Ayala')).toBeTruthy()
    expect(tabla.queryByText('Fátima Quispe')).toBeTruthy() // POSTULADA es perfil integral
    expect(tabla.queryByText('Camila Reyes')).toBeNull()
    expect(laCasilla()).toHaveProperty('checked', false)
  })

  it('cambia de gente al cambiar de pestaña', async () => {
    await pintar()
    irA('Prueba del puesto')
    await waitFor(() => expect(within(laTabla()).queryByText('Camila Reyes')).toBeTruthy())
    expect(within(laTabla()).queryByText('Rodrigo Ayala')).toBeNull()
  })

  it('cuenta las filas que se ven, no las que llegaron', async () => {
    await pintar()
    expect(screen.getByText(/Se ven 2 de 4/)).toBeTruthy()
    irA('Simulación')
    await waitFor(() => expect(screen.getByText(/Se ven 0 de 4/)).toBeTruthy())
  })

  it('deja fuera de las cinco pestañas a quien ya terminó', async () => {
    await pintar()
    for (const etapa of [
      'Perfil integral',
      'Prueba del puesto',
      'Simulación',
      'Validación',
      'Decisión',
    ]) {
      irA(etapa)
      await waitFor(() => expect(screen.getByText(/Se ven/)).toBeTruthy())
      expect(within(laTabla()).queryByText('Lucía Ferrer')).toBeNull()
    }
  })
})

describe('el escape a la tanda entera', () => {
  it('trae de vuelta a todos, incluida la terminada', async () => {
    await pintar()
    fireEvent.click(laCasilla())
    await waitFor(() => expect(within(laTabla()).queryByText('Lucía Ferrer')).toBeTruthy())
    expect(within(laTabla()).queryByText('Camila Reyes')).toBeTruthy()
    expect(screen.getByText(/Se ven las 4 de la tanda/)).toBeTruthy()
  })

  /*
   * Sobrevive al cambio de pestaña, y por eso el filtro vive en el padre: la
   * tabla se remonta entera con `key={etapa}`. Un escape que se cierra solo al
   * mirar la etapa siguiente obliga a volver a pedirlo cinco veces.
   */
  it('sigue puesto al cambiar de pestaña', async () => {
    await pintar()
    fireEvent.click(laCasilla())
    await waitFor(() => expect(within(laTabla()).queryByText('Lucía Ferrer')).toBeTruthy())
    irA('Decisión')
    await waitFor(() => expect(laCasilla()).toHaveProperty('checked', true))
    expect(within(laTabla()).queryByText('Lucía Ferrer')).toBeTruthy()
  })
})

describe('los dos vacíos no se confunden', () => {
  it('sin nadie en la etapa nombra el escape y no dice que no haya postulaciones', async () => {
    await pintar()
    irA('Validación')
    await waitFor(() => expect(screen.getByText(/Nadie está en Validación/)).toBeTruthy())
    // El escape, nombrado con las palabras que lleva escritas la casilla.
    expect(within(laTabla()).getByText(/Ver la tanda entera/)).toBeTruthy()
    expect(screen.queryByText(/Todavía no hay postulaciones/)).toBeNull()
  })

  it('sin ninguna postulación lo dice, y no culpa al filtro', async () => {
    await pintar([])
    expect(screen.getByText(/Todavía no hay postulaciones/)).toBeTruthy()
    expect(screen.queryByText(/Nadie está en/)).toBeNull()
  })
})

describe('avanzar en tanda', () => {
  /*
   * Una marca escondida por el filtro no puede seguir contando: el boton diria
   * que avanza a alguien que no esta en la pantalla.
   */
  it('solo cuenta a los marcados que se ven', async () => {
    await pintar()
    fireEvent.click(laCasilla())
    await waitFor(() => expect(within(laTabla()).queryByText('Lucía Ferrer')).toBeTruthy())
    fireEvent.click(screen.getByRole('checkbox', { name: 'Avanza Lucía Ferrer' }))
    expect(screen.getByRole('button', { name: /Avanzar a 1 persona/ })).toBeTruthy()
    fireEvent.click(laCasilla())
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Marca a quienes avanzan' })).toBeTruthy(),
    )
  })
})
