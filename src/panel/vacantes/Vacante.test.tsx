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
import { ErrorApi } from '../api/cliente'
import type { FilaRanking, VersionBanco } from '../api/tipos'

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

/*
  El banco publicado del nivel de la vacante: lo que de verdad va a responder
  quien postule. Se sirven tres para que el filtro tenga algo que hacer —el
  archivado y el de otro nivel no pueden salir— porque un unico banco pasa
  igual con el filtro roto.
*/
const BANCOS: VersionBanco[] = [
  {
    id: 15,
    tipoBanco: 'NIVEL' as const,
    nivelPuestoCodigo: 'MEDIO',
    etiqueta: 'Banco CAZATALENTOS · Medio',
    estado: 'PUBLICADA' as const,
    minutosObjetivo: 35,
    publicadaEn: '2026-08-28T18:38:57Z',
  },
  {
    id: 6,
    tipoBanco: 'NIVEL' as const,
    nivelPuestoCodigo: 'MEDIO',
    etiqueta: 'Banco RENASER v3 · Medio',
    estado: 'ARCHIVADA' as const,
    minutosObjetivo: null,
    publicadaEn: '2026-04-11T09:00:00Z',
  },
  {
    id: 13,
    tipoBanco: 'NIVEL' as const,
    nivelPuestoCodigo: 'DIRECCION',
    etiqueta: 'Banco CAZATALENTOS · Directivo',
    estado: 'PUBLICADA' as const,
    minutosObjetivo: 60,
    publicadaEn: '2026-08-28T18:38:10Z',
  },
]

const PUESTOS = [
  {
    id: 7,
    codigo: 'INFRA',
    nombre: 'Ingeniero de Infraestructura',
    nivelPuestoCodigo: 'MEDIO',
    familiaCodigo: 'TECNOLOGIA',
  },
]

/*
  Una vacante de verdad: con su puesto —de ahi sale el nivel, y del nivel el
  banco— y la evaluacion encendida.
*/
const VACANTE: {
  id: number
  titulo: string
  estado: string
  puestoId: number
  aplicaEvaluacion: boolean
  plantillaEvaluacionId: number | null
  versionPlantillaPruebaId: number | null
  versionPesosId: number | null
} = {
  id: 1,
  titulo: 'Ingeniera',
  estado: 'PUBLICADA',
  puestoId: 7,
  aplicaEvaluacion: true,
  plantillaEvaluacionId: null,
  versionPlantillaPruebaId: null,
  versionPesosId: null,
}

/* Una prueba generica —sin puesto— y otra escrita para OTRO puesto. */
const PLANTILLAS_PRUEBA = [
  { id: 1, nombre: 'Prueba de talento · convocatoria', puestoId: null, esActiva: true },
  { id: 2, nombre: 'Cuestionario técnico · Administrador General', puestoId: 99, esActiva: true },
]
const VERSIONES_PRUEBA = [
  { id: 1, plantillaPruebaId: 1, version: 1 },
  { id: 2, plantillaPruebaId: 2, version: 1 },
]

const listarVersionesBanco = vi.fn(() => Promise.resolve(BANCOS))
const asignarPlantillaPrueba = vi.fn((_vacanteId: number, _versionId: number) =>
  Promise.resolve({}),
)

const sinRuido = {
  verVacante: () => Promise.resolve(VACANTE),
  verEmbudo: () => Promise.resolve({ porEstado: {} }),
  verCatalogos: () => Promise.resolve({ areas: [], puestos: [], nivelesPuesto: [], estados: [] }),
}

vi.mock('../api/panel', () => ({
  verVacante: () => sinRuido.verVacante(),
  verEmbudo: () => sinRuido.verEmbudo(),
  verCatalogos: () => sinRuido.verCatalogos(),
  verRanking: (id: number, etapa?: string) => verRanking(id, etapa),
  listarRequisitos: () => Promise.resolve([]),
  listarPuestos: () => Promise.resolve(PUESTOS),
  listarVersionesBanco: () => listarVersionesBanco(),
  listarPlantillasPrueba: () => Promise.resolve(PLANTILLAS_PRUEBA),
  listarVersionesPesos: () => Promise.resolve([]),
  listarVersionesPrueba: () => Promise.resolve(VERSIONES_PRUEBA),
  aplicarEvaluacion: () => Promise.resolve({}),
  asignarPlantillaEvaluacion: () => Promise.resolve({}),
  asignarPlantillaPrueba: (vacanteId: number, versionId: number) =>
    asignarPlantillaPrueba(vacanteId, versionId),
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
  // La tarjeta de la prueba tecnica: sin ficha (404 = null) y sin cuestionario.
  verFichaDelPuesto: () => Promise.reject(new ErrorApi(404, 'No encontramos eso, o no es tuyo.')),
  verCuestionarioTecnico: () =>
    Promise.resolve({
      versionBancoId: null,
      estado: null,
      desactualizado: false,
      generacion: 'SIN_PEDIR',
      preguntas: [],
    }),
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

beforeEach(() => {
  verRanking.mockReset()
  // Los espias y la vacante vuelven a su estado feliz: dos de estas pruebas los
  // cambian para su caso, y sin esto se lo llevarian a la siguiente.
  listarVersionesBanco.mockReset()
  listarVersionesBanco.mockResolvedValue(BANCOS)
  asignarPlantillaPrueba.mockReset()
  sinRuido.verVacante = () => Promise.resolve(VACANTE)
})
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

/*
 * La prueba tecnica del puesto vive en su propia pagina; en la vacante queda
 * una tarjeta con el estado y el enlace. No entra en la puerta de publicar: el
 * servidor no lo exige, y el panel no inventa puertas.
 */
describe('la tarjeta de la prueba técnica', () => {
  it('dice en qué va la ficha y el cuestionario, y enlaza a prepararla', async () => {
    await pintar()
    await waitFor(() =>
      expect(screen.getByText(/Ficha: sin empezar · Cuestionario: sin pedir/)).toBeTruthy(),
    )
    const enlace = screen.getByRole('link', { name: 'Preparar la prueba técnica →' })
    expect(enlace.getAttribute('href')).toBe('/admin/vacantes/1/prueba-tecnica')
  })
})

/*
 * Que responde quien postule.
 *
 * Aqui habia un desplegable obligatorio —la plantilla de evaluacion— con una
 * sola respuesta legal: hay una publicada por nivel y el backend rechazaba las
 * de otro. Ahora la vacante no pregunta, y en su sitio dice lo que de verdad va
 * a pasar.
 */
describe('el banco que responderá quien postule', () => {
  it('lo nombra con su tiempo, y no lo pregunta', async () => {
    await pintar()

    expect(screen.getByText('Banco CAZATALENTOS · Medio')).toBeTruthy()
    expect(screen.getByText(/35 minutos/)).toBeTruthy()

    // La afirmacion que da sentido al cambio: ya no hay nada que elegir.
    expect(screen.queryByText('Elige la evaluación…')).toBeNull()
  })

  /*
   * El filtro tiene que hacer trabajo de verdad: se sirven un archivado del
   * mismo nivel y un publicado de otro, y ninguno de los dos puede salir.
   */
  it('no confunde el banco de otro nivel ni uno archivado', async () => {
    await pintar()
    expect(screen.queryByText('Banco CAZATALENTOS · Directivo')).toBeNull()
    expect(screen.queryByText('Banco RENASER v3 · Medio')).toBeNull()
  })

  /*
   * ⚠️ Un backend anterior a la V44 NO manda `minutosObjetivo`, asi que llega
   * `undefined`. Con un `!== null` eso pintaba «undefined minutos» en la cara
   * de quien publica la vacante. Lo encontro el e2e contra el backend viejo,
   * que es exactamente lo que pasa mientras el portal va por delante en un
   * despliegue.
   */
  it('sin minutos nombra el banco igual, y no escribe «undefined»', async () => {
    const { minutosObjetivo: _fuera, ...sinMinutos } = BANCOS[0]!
    listarVersionesBanco.mockResolvedValue([sinMinutos, ...BANCOS.slice(1)])
    await pintar()

    expect(screen.getByText('Banco CAZATALENTOS · Medio')).toBeTruthy()
    expect(screen.queryByText(/undefined/i)).toBeNull()
    expect(screen.queryByText(/minutos/)).toBeNull()
  })

  it('sin banco del nivel avisa, y dice dónde se arregla', async () => {
    // Es lo que impide publicar, asi que callarlo deja la vacante atascada sin
    // explicar en que.
    listarVersionesBanco.mockResolvedValue([])
    await pintar()

    expect(screen.getByText(/No hay ningún banco publicado para este nivel/)).toBeTruthy()
    expect(screen.getByText(/se publica uno en Configuración/i)).toBeTruthy()
  })

  it('con la evaluación apagada no habla de ningún banco', async () => {
    sinRuido.verVacante = () =>
      Promise.resolve({ ...VACANTE, aplicaEvaluacion: false })
    await pintar()
    expect(screen.queryByText('Banco CAZATALENTOS · Medio')).toBeNull()
  })
})

describe('los desplegables que siguen existiendo', () => {
  /*
   * ⚠️ `Number('')` es `0`. Volver a «Elige…» mandaba un id 0 y el backend
   * contestaba «not found with id: '0'» sobre una fila que nadie escogio.
   */
  it('volver a la línea vacía no manda ningún id, y elegir sí manda el suyo', async () => {
    /*
      Las dos mitades en una: sin la segunda, un `alElegir` que no llamara nunca
      pasaria en verde y habria roto el desplegable entero.

      ⚠️ Y la vacante llega CON una prueba puesta a proposito. Sobre un `select`
      que ya vale '' el navegador no dispara `change`: el test se quedaba en
      verde sin tocar el codigo que dice probar.
    */
    sinRuido.verVacante = () => Promise.resolve({ ...VACANTE, versionPlantillaPruebaId: 1 })
    await pintar()
    const cual = screen.getByRole('combobox', { name: /prueba del puesto/i })

    fireEvent.change(cual, { target: { value: '' } })
    fireEvent.change(cual, { target: { value: '1' } })

    /*
      ⚠️ Se cuentan las llamadas, no se afirma que no hubo ninguna. `mutate`
      encola: un `expect(...).not.toHaveBeenCalled()` justo despues del evento
      corre ANTES de que la mutacion salga, y pasa en verde tanto si el guardian
      esta como si no. Lo que no puede ocurrir es que salgan dos.
    */
    await waitFor(() => expect(asignarPlantillaPrueba).toHaveBeenCalledWith(1, 1))
    expect(asignarPlantillaPrueba).toHaveBeenCalledTimes(1)
  })

  /*
   * Una prueba escrita para otro puesto no se ofrece: elegirla es escoger la
   * prueba equivocada sin que nada avise.
   */
  it('no ofrece una prueba escrita para otro puesto', async () => {
    await pintar()
    expect(screen.queryByText(/Cuestionario técnico · Administrador/)).toBeNull()
    // La generica —sin puesto— si tiene que salir: filtrarla dejaria a casi
    // toda vacante sin ninguna opcion.
    expect(screen.getByText(/Prueba de talento · convocatoria · v1/)).toBeTruthy()
  })
})

/*
 * El botón de publicar, en BORRADOR, que es el único estado donde existe.
 *
 * ⚠️ Ningún test miraba este estado, y por eso el cambio llegó a dejar
 * «Publicar» deshabilitado para siempre: la condición seguía pidiendo la
 * plantilla de evaluación justo después de borrar el desplegable que era la
 * única forma de ponerla.
 */
describe('publicar una vacante en borrador', () => {
  const enBorrador = (extra: Record<string, unknown> = {}) => {
    sinRuido.verVacante = () =>
      Promise.resolve({
        ...VACANTE,
        estado: 'BORRADOR',
        versionPlantillaPruebaId: 1,
        ...extra,
      })
  }

  it('con banco del nivel se puede publicar, aunque no haya plantilla elegida', async () => {
    enBorrador()
    await pintar()

    const boton = screen.getByRole('button', { name: 'Publicar en el portal' })
    expect((boton as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByText('Todo listo: ya se puede publicar.')).toBeTruthy()
  })

  it('sin banco del nivel se frena, y nombra el banco y no la plantilla', async () => {
    listarVersionesBanco.mockResolvedValue([])
    enBorrador()
    await pintar()

    const boton = screen.getByRole('button', { name: 'Publicar en el portal' })
    expect((boton as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/banco de preguntas publicado de su nivel/)).toBeTruthy()
    expect(screen.queryByText(/Antes hay que elegir la evaluación/)).toBeNull()
  })

  /*
   * Si no se pudo leer el banco —un 403 de `ver_banco_preguntas`, que no viene
   * con `ver_vacantes`— el botón NO se bloquea: quien decide es el backend, y
   * frenar por no haber podido mirar deja la vacante atascada por un permiso
   * que no es el de publicar.
   */
  it('si no se pudo leer el banco, no se bloquea el botón', async () => {
    listarVersionesBanco.mockRejectedValue(new Error('403'))
    enBorrador()
    await pintar()

    const boton = screen.getByRole('button', { name: 'Publicar en el portal' })
    expect((boton as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByText(/No se pudo averiguar qué banco/)).toBeTruthy()
  })
})
