/**
 * El ranking enseña la etapa que dice su pestaña, y nada mas.
 *
 * Lo que compila perfectamente estando mal aqui:
 *
 *   -1. **Enseñar cifras de OTRA etapa junto a la columna de esta.** Las
 *      cuatro del backend —calificados, en curso, fallidos— salen de la cola
 *      que califica el CURRICULUM con IA y son identicas en las cinco
 *      pestañas. En la de la prueba decian «76 calificados» encima de setenta
 *      y ocho guiones, y la lectura natural era que la pantalla estaba rota.
 *   -0.5 **Dejar un guion sin explicar.** Significa cinco cosas distintas y la
 *      mas confusa es justo esa: el curriculum esta calificado y esta etapa no.
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

/**
 * Una fila con lo justo: lo que la tabla lee de verdad.
 *
 * ⚠️ **`notaEtapa` depende de la etapa que se pida**, y por eso `notasPorEtapa`
 * es un mapa: es el único campo del ranking que cambia con `?etapa=`. Un mock
 * que devolviera la misma nota en las cinco pestañas no puede probar una
 * pantalla que va justamente de eso — y dejaría pasar en verde el fallo que
 * este archivo viene a fijar.
 */
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
  /* ⚠️ Los cuatro de la cola son SIN_EMPEZAR, EN_CURSO, TERMINADA y FALLIDA:
     «CALIFICADA» no existe, y una fixtura con un valor inalcanzable tapa justo
     el fallo que se viene a probar. */
  estadoCalificacion: 'TERMINADA',
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
/*
 * El caso que provocó todo esto: el currículum calificado —tiene nota de
 * perfil— y ninguna nota de la prueba, que es donde está parada. En la pestaña
 * de la prueba su fila es un guion junto a un contador que dice «calificados».
 */
const EN_PRUEBA = fila(93, 'Camila Reyes', 'PRUEBA_TURNO_CANDIDATO', 75)
const TERMINADA = fila(94, 'Lucía Ferrer', 'NO_CONTINUA', 52)

const TANDA = [EN_PERFIL, EN_PRUEBA, RECIEN_POSTULADA, TERMINADA]

/**
 * Qué nota tiene cada quien en cada etapa, como en la base de verdad: las
 * cuatro se calificaron del currículum y ninguna llegó a rendir la prueba.
 */
const NOTAS_POR_ETAPA: Record<string, Record<number, number | null>> = {
  PERFIL_INTEGRAL: { 91: 84, 92: null, 93: 75, 94: 52 },
  PRUEBA_PUESTO: { 91: null, 92: null, 93: null, 94: null },
  SIMULACION: { 91: null, 92: null, 93: null, 94: null },
  VALIDACION: { 91: null, 92: null, 93: null, 94: null },
  DECISION: { 91: null, 92: null, 93: null, 94: null },
}

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
  verRanking.mockImplementation((_id: number, etapa = 'PERFIL_INTEGRAL') => {
    const notas = NOTAS_POR_ETAPA[etapa] ?? {}
    return Promise.resolve(
      tanda(
        filas.map((f) =>
          f.postulacionId in notas ? { ...f, notaEtapa: notas[f.postulacionId]! } : f,
        ),
      ),
    )
  })
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
  await waitFor(() => expect(losCortes()).toBeTruthy())
}

/** La del ranking es la primera de la pantalla; el `!` es de `noUncheckedIndexedAccess`. */
const laTabla = () => screen.getAllByRole('table')[0]!
const irA = (etapa: string) => fireEvent.click(screen.getByRole('tab', { name: etapa }))

/* Los tres cortes. El de «con nota» lleva el nombre de la etapa dentro, asi que
   se busca por lo que empieza, no por el texto entero. */
const losCortes = () => screen.getByRole('group', { name: 'Qué filas se ven' })
const elCorte = (empiezaPor: string) =>
  within(losCortes())
    .getAllByRole('button')
    .find((b) => (b.textContent ?? '').startsWith(empiezaPor))!
const verCorte = (empiezaPor: string) => fireEvent.click(elCorte(empiezaPor))
/** La cifra que lleva dentro cada corte. */
const cuantasEn = (empiezaPor: string) =>
  Number((elCorte(empiezaPor).textContent ?? '').match(/(\d+)$/)?.[1])

beforeEach(() => verRanking.mockReset())
afterEach(() => cleanup())

describe('el ranking filtra por la etapa de su pestaña', () => {
  it('abre por quien ya tiene nota de esa etapa, que es con lo que se decide', async () => {
    await pintar()
    const tabla = within(laTabla())
    expect(elCorte('Con nota del perfil')).toHaveProperty('ariaPressed', 'true')
    // Los tres con nota del perfil; Fátima acaba de postular y no tiene.
    expect(tabla.queryByText('Rodrigo Ayala')).toBeTruthy()
    expect(tabla.queryByText('Camila Reyes')).toBeTruthy()
    expect(tabla.queryByText('Fátima Quispe')).toBeNull()
  })

  it('«está aquí ahora» sigue enseñando a quien está parado en la etapa', async () => {
    await pintar()
    verCorte('Está aquí ahora')
    await waitFor(() => expect(within(laTabla()).queryByText('Fátima Quispe')).toBeTruthy())
    const tabla = within(laTabla())
    expect(tabla.queryByText('Rodrigo Ayala')).toBeTruthy() // POSTULADA es perfil integral
    expect(tabla.queryByText('Camila Reyes')).toBeNull()
  })

  /*
   * El motivo de que hagan falta los dos cortes, medido contra el backend
   * vivo: en la prueba, quien está ahí ahora es quien TODAVÍA no la ha
   * rendido, y quien tiene nota ya pasó de largo.
   */
  it('los dos primeros cortes eligen gente distinta fuera del perfil', async () => {
    await pintar()
    // En el perfil casi coinciden: los dos hablan de lo mismo.
    expect(cuantasEn('Con nota del perfil')).toBe(3)
    expect(cuantasEn('Está aquí ahora')).toBe(2)

    irA('Prueba del puesto')
    await waitFor(() => expect(elCorte('Con nota de la prueba')).toBeTruthy())
    // En la prueba se separan del todo: Camila está ahí y no tiene nota, y
    // nadie la tiene. Un solo control no puede servir para los dos trabajos.
    expect(cuantasEn('Con nota de la prueba')).toBe(0)
    expect(cuantasEn('Está aquí ahora')).toBe(1)
    verCorte('Está aquí ahora')
    await waitFor(() => expect(within(laTabla()).queryByText('Camila Reyes')).toBeTruthy())
    expect(within(laTabla()).queryByText('Rodrigo Ayala')).toBeNull()
  })

  it('cambia de gente al cambiar de pestaña', async () => {
    await pintar()
    verCorte('Está aquí ahora')
    await waitFor(() => expect(within(laTabla()).queryByText('Fátima Quispe')).toBeTruthy())
    irA('Prueba del puesto')
    await waitFor(() => expect(within(laTabla()).queryByText('Camila Reyes')).toBeTruthy())
    expect(within(laTabla()).queryByText('Rodrigo Ayala')).toBeNull()
  })

  it('cada corte lleva su cifra, contada de las filas y no de lo que se pinta', async () => {
    await pintar()
    expect(cuantasEn('Con nota del perfil')).toBe(3)
    expect(cuantasEn('Está aquí ahora')).toBe(2)
    expect(cuantasEn('Toda la tanda')).toBe(4)
    // Con el corte puesto, la cifra de los otros dos no se mueve: si saliera de
    // lo visible, «Con nota» diría siempre lo mismo que la tabla.
    verCorte('Toda la tanda')
    await waitFor(() => expect(cuantasEn('Con nota del perfil')).toBe(3))
  })

  /*
   * ⚠️ Lo que provocó todo esto: las cuatro cifras del backend son de la cola
   * que califica el CURRÍCULUM y no cambian con la pestaña. En la de la prueba
   * decían «calificados» junto a una columna de guiones.
   */
  it('la cifra de arriba es de la etapa, y la del currículum dice que lo es', async () => {
    await pintar()
    irA('Prueba del puesto')
    await waitFor(() => expect(screen.getByText(/con nota de la prueba/)).toBeTruthy())
    // Ninguna tiene nota de la prueba, y la cifra del currículum sigue en 4.
    expect(screen.getByText(/0 de 4 con nota de la prueba/)).toBeTruthy()
    expect(screen.getByText(/eso es del currículum, no de esta etapa/)).toBeTruthy()
  })

  it('cada guion dice por qué está vacío', async () => {
    await pintar()
    irA('Prueba del puesto')
    await waitFor(() => expect(elCorte('Toda la tanda')).toBeTruthy())
    verCorte('Toda la tanda')
    const tabla = within(laTabla())
    await waitFor(() => expect(tabla.queryByText('Fátima Quispe')).toBeTruthy())
    // Fátima y Rodrigo están en el perfil. Dice dónde están y no si ya pasaron
    // por la prueba: el estado retrocede, así que eso no se puede afirmar.
    expect(tabla.getAllByText('Su proceso está en Perfil integral')).toHaveLength(2)
    // Camila SÍ está parada en la prueba, y le toca a ella.
    expect(tabla.getByText('Le toca a la persona: aún no la ha hecho')).toBeTruthy()
    // Lucía terminó su proceso, que no es ninguna de las dos.
    expect(tabla.getByText('Terminó su proceso sin nota de esta etapa')).toBeTruthy()
  })

  it('«está aquí ahora» deja fuera de las cinco pestañas a quien ya terminó', async () => {
    await pintar()
    verCorte('Está aquí ahora')
    for (const etapa of [
      'Perfil integral',
      'Prueba del puesto',
      'Simulación',
      'Validación',
      'Decisión',
    ]) {
      irA(etapa)
      await waitFor(() => expect(losCortes()).toBeTruthy())
      expect(within(laTabla()).queryByText('Lucía Ferrer')).toBeNull()
    }
  })
})

describe('el escape a la tanda entera', () => {
  it('trae de vuelta a todos, incluida la terminada', async () => {
    await pintar()
    verCorte('Está aquí ahora')
    await waitFor(() => expect(within(laTabla()).queryByText('Lucía Ferrer')).toBeNull())
    verCorte('Toda la tanda')
    await waitFor(() => expect(within(laTabla()).queryByText('Lucía Ferrer')).toBeTruthy())
    expect(within(laTabla()).queryByText('Camila Reyes')).toBeTruthy()
  })

  /*
   * Sobrevive al cambio de pestaña, y por eso el filtro vive en el padre: la
   * tabla se remonta entera con `key={etapa}`. Un escape que se cierra solo al
   * mirar la etapa siguiente obliga a volver a pedirlo cinco veces.
   */
  it('el corte elegido sigue puesto al cambiar de pestaña', async () => {
    await pintar()
    verCorte('Toda la tanda')
    await waitFor(() => expect(within(laTabla()).queryByText('Lucía Ferrer')).toBeTruthy())
    irA('Decisión')
    await waitFor(() => expect(elCorte('Toda la tanda')).toHaveProperty('ariaPressed', 'true'))
    expect(within(laTabla()).queryByText('Lucía Ferrer')).toBeTruthy()
  })
})

describe('los tres vacíos no se confunden', () => {
  it('sin nadie en la etapa nombra el escape y no dice que no haya postulaciones', async () => {
    await pintar()
    verCorte('Está aquí ahora')
    irA('Validación')
    await waitFor(() => expect(screen.getByText(/Nadie está en Validación/)).toBeTruthy())
    // El escape, nombrado con las palabras que lleva escritas el botón.
    expect(within(laTabla()).getByText(/Toda la tanda/)).toBeTruthy()
    expect(screen.queryByText(/Todavía no hay postulaciones/)).toBeNull()
  })

  /*
   * El tercero es nuevo y es el más frecuente al abrir: nadie tiene nota
   * todavía. Mandar a «está aquí ahora» sería mandar al sitio equivocado, así
   * que se dice qué hace falta para que aparezca una nota.
   */
  it('sin ninguna nota dice qué falta, y no que nadie esté en la etapa', async () => {
    await pintar()
    irA('Simulación')
    await waitFor(() =>
      expect(screen.getByText(/Nadie tiene todavía nota de la simulación/)).toBeTruthy(),
    )
    expect(screen.getByText(/la sesión asistida y calificada/)).toBeTruthy()
    expect(screen.queryByText(/Nadie está en Simulación/)).toBeNull()
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
    verCorte('Toda la tanda')
    await waitFor(() => expect(within(laTabla()).queryByText('Fátima Quispe')).toBeTruthy())
    fireEvent.click(screen.getByRole('checkbox', { name: 'Avanza Fátima Quispe' }))
    expect(screen.getByRole('button', { name: /Avanzar a 1 persona/ })).toBeTruthy()
    // Fátima no tiene nota: al volver al corte por defecto desaparece de la tabla.
    verCorte('Con nota del perfil')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Marca a quienes avanzan' })).toBeTruthy(),
    )
  })
})
