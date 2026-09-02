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
const elegirInstrumento = vi.fn()
const pedirExcel = vi.fn()
const ponerNotaPrueba = vi.fn()

/**
 * La rubrica de la prueba, con UN criterio sin nota.
 *
 * ⚠️ **Es el caso de verdad y no un extremo inventado.** La rubrica decide
 * criterio por criterio quien lo mira, y los que dice que los mira una persona
 * NUNCA se le mandan a la IA: en la prueba de marketing la sustentacion en
 * video son 10 de los 100 puntos. El agente califica cinco de seis, la nota de
 * la etapa exige los seis, y hasta hoy no habia en toda la pantalla un sitio
 * donde escribir el que falta.
 *
 * ⚠️ **Las filas SIN nota tambien llegan**: `verNotas` recorre la rubrica y le
 * pega encima la nota si la hay. Si un dia devolviera solo lo calificado, el
 * criterio que falta seria justo el unico invisible y el boton no se pintaria
 * nunca — por eso la fixtura trae el nulo.
 */
let NOTAS_PRUEBA = [
  {
    criterioId: 31,
    nombre: 'Objetivo: la campaña está bien planteada',
    puntosMaximos: 22,
    puntaje: 18,
    explicacion: 'Plantea el objetivo con una cifra.',
    origen: 'AGENTE',
  },
  {
    criterioId: 36,
    nombre: 'Sustentación en video',
    puntosMaximos: 10,
    puntaje: null,
    explicacion: null,
    origen: null,
  },
]

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
  /* Para las pruebas de orden, filtro y descarga: la ciudad, la pretensión y el
     grupo se escriben aquí y el resto de la fila no estorba. */
  extra: Partial<FilaRanking> = {},
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
  /* ⚠️ Nulas por defecto porque así llega HOY la base entera: la ciudad solo se
     le pide a quien crea cuenta desde ahora. Es el caso que obliga al filtro de
     ciudad a decir que todavía no hay ninguna en vez de abrir una lista vacía. */
  ciudad: null,
  ciudadCodigo: null,
  pretensionMin: null,
  pretensionMax: null,
  pretensionMoneda: null,
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
  ...extra,
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
  instrumentoEtapaTecnica: string
  minutosEtapaTecnica: number | null
} = {
  id: 1,
  titulo: 'Ingeniera',
  estado: 'PUBLICADA',
  puestoId: 7,
  aplicaEvaluacion: true,
  plantillaEvaluacionId: null,
  versionPlantillaPruebaId: null,
  versionPesosId: null,
  // Lo que trae toda vacante que ya existía: la prueba del puesto de siempre, con el
  // tiempo que diga su plantilla.
  instrumentoEtapaTecnica: 'PLANTILLA',
  minutosEtapaTecnica: null,
}

/* Una prueba generica —sin puesto— y otra escrita para OTRO puesto. */
const PLANTILLAS_PRUEBA = [
  { id: 1, nombre: 'Prueba de talento · convocatoria', puestoId: null, esActiva: true },
  { id: 2, nombre: 'Cuestionario técnico · Administrador General', puestoId: 99, esActiva: true },
]
/*
  Una version por plantilla, publicada, y un borrador que NO se puede elegir.

  ⚠️ Las fixturas llevan los campos de verdad —`estado` incluido— porque el
  desplegable ya los mira: con `{id, plantillaPruebaId, version}` a secas,
  `estado` seria `undefined` y el filtro de publicadas se comeria las tres.
*/
const VERSIONES_DE_SIEMPRE = [
  { id: 1, plantillaPruebaId: 1, version: 1, estado: 'PUBLICADA' },
  { id: 2, plantillaPruebaId: 2, version: 1, estado: 'PUBLICADA' },
  { id: 3, plantillaPruebaId: 1, version: 2, estado: 'BORRADOR' },
]
/* Mutable: una prueba lo cambia para el caso en que TODO sea borrador. */
let VERSIONES_PRUEBA = VERSIONES_DE_SIEMPRE

const listarVersionesBanco = vi.fn(() => Promise.resolve(BANCOS))
const asignarPlantillaPrueba = vi.fn((_vacanteId: number, _versionId: number) =>
  Promise.resolve({}),
)

const sinRuido = {
  verVacante: () => Promise.resolve(VACANTE),
  verEmbudo: () => Promise.resolve({ porEstado: {} }),
  verCatalogos: () => Promise.resolve({ areas: [], puestos: [], nivelesPuesto: [], estados: [] }),
  /*
    ⚠️ **Las tres listas van vacías, no ausentes.** El componente las recorre en
    cuanto `perfil.data` existe, y un `{}` pelado revienta con «no es iterable»
    al abrir la primera ficha. Estas son las primeras pruebas que abren una fila,
    así que el doble tiene que parecerse a la respuesta de verdad.
  */
  verPerfilIntegral: () =>
    Promise.resolve({
      estadoCalificacion: 'TERMINADA',
      resumen: null,
      hallazgos: [],
      notasCriterio: [],
      alertas: [],
    }),
}

vi.mock('../api/panel', () => ({
  verVacante: () => sinRuido.verVacante(),
  verEmbudo: () => sinRuido.verEmbudo(),
  verCatalogos: () => sinRuido.verCatalogos(),
  verRanking: (id: number, etapa?: string) => verRanking(id, etapa),
  descargarExcelDelRanking: (id: number, datos: unknown) => pedirExcel(id, datos),
  /*
    ⚠️ **Las tres del bloque de entregables tienen que estar.** `EntregablesDePrueba`
    se monta dentro de la ficha en la pestaña de la prueba, asi que sin ellas el
    doble no exporta lo que el componente importa y revientan los tests de esta
    ficha — que no van de entregables.
  */
  verEntregablesDePrueba: () => Promise.resolve([]),
  enlaceDeArchivo: () => Promise.reject(new Error('sin enlace en las pruebas')),
  descargarArchivo: () => Promise.reject(new Error('sin descarga en las pruebas')),
  listarRequisitos: () => Promise.resolve([]),
  listarPuestos: () => Promise.resolve(PUESTOS),
  listarVersionesBanco: () => listarVersionesBanco(),
  listarPlantillasPrueba: () => Promise.resolve(PLANTILLAS_PRUEBA),
  listarVersionesPesos: () => Promise.resolve([]),
  /*
    ⚠️ **Filtra por plantilla, como la ruta de verdad.** Devolviendo la lista
    entera a cada llamada, el desplegable salia con cada version repetida una
    vez por plantilla: el doble mentia sobre la forma del endpoint.
  */
  listarVersionesPrueba: (plantillaId: number) =>
    Promise.resolve(VERSIONES_PRUEBA.filter((v) => v.plantillaPruebaId === plantillaId)),
  verVersionDePrueba: (id: number) =>
    Promise.resolve({ version: VERSIONES_PRUEBA.find((v) => v.id === id) }),
  aplicarEvaluacion: () => Promise.resolve({}),
  asignarPlantillaEvaluacion: () => Promise.resolve({}),
  asignarPlantillaPrueba: (vacanteId: number, versionId: number) =>
    asignarPlantillaPrueba(vacanteId, versionId),
  asignarVersionPesos: () => Promise.resolve({}),
  elegirInstrumentoTecnico: (vacanteId: number, datos: unknown) =>
    elegirInstrumento(vacanteId, datos),
  cerrarVacante: () => Promise.resolve({}),
  confirmarAvance: () => Promise.resolve({}),
  crearRequisito: () => Promise.resolve({}),
  publicarVacante: () => Promise.resolve({}),
  quitarRequisito: () => Promise.resolve({}),
  /*
    ⚠️ **`enlaces` tiene que ser una lista, no faltar.** La ficha hace
    `ficha.data.enlaces.length` sin guarda, así que un `{}` la revienta entera
    —y con ella la columna donde vive la rúbrica—. Estuvo así todo este tiempo
    porque hasta ahora ningún test abría una ficha.
  */
  verFicha: () => Promise.resolve({ enlaces: [] }),
  verHistorial: () => Promise.resolve([]),
  verPerfilIntegral: () => sinRuido.verPerfilIntegral(),
  verDesgloseEvaluacion: () => Promise.resolve({}),
  verMetricasValidacion: () => Promise.resolve([]),
  verNotasPrueba: () => Promise.resolve(NOTAS_PRUEBA),
  verNotasSimulacion: () => Promise.resolve([]),
  ponerNotaCriterioPrueba: (
    postulacionId: number,
    criterioId: number,
    puntaje: number,
    explicacion: string,
  ) => ponerNotaPrueba(postulacionId, criterioId, puntaje, explicacion),
  ponerNotaCriterioSimulacion: () => Promise.resolve(),
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

const tanda = (filas: FilaRanking[], puedeVerPretension = true) => ({
  vacanteId: 1,
  vacante: 'Ingeniera',
  puesto: 'Ingeniera',
  nivelPuesto: 'MEDIO',
  total: filas.length,
  conPasadaFina: filas.length,
  calificados: filas.length,
  enCurso: 0,
  fallidos: 0,
  puedeVerPretension,
  filas,
})

async function pintar(filas: FilaRanking[] = TANDA, puedeVerPretension = true) {
  verRanking.mockImplementation((_id: number, etapa = 'PERFIL_INTEGRAL') => {
    const notas = NOTAS_POR_ETAPA[etapa] ?? {}
    return Promise.resolve(
      tanda(
        filas.map((f) =>
          f.postulacionId in notas ? { ...f, notaEtapa: notas[f.postulacionId]! } : f,
        ),
        puedeVerPretension,
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

/**
 * Los nombres de la columna «Candidato», en el orden en el que se pintan.
 *
 * El primer `<span>` y no la celda entera: debajo del nombre va el correo, y
 * `textContent` de la celda los pegaría los dos en una cadena. (El grupo de
 * prioridad vivía aquí y ya no: subió a su propia columna, «Veredicto».)
 */
const elOrdenDeLaTabla = () =>
  Array.from(laTabla().querySelectorAll('tbody tr')).map(
    (f) => f.querySelector('td:nth-child(3) span')?.textContent ?? '',
  )

/** La cabecera pulsable de una columna: el `<th>`, que es quien lleva `aria-sort`. */
const laCabecera = (nombre: string) =>
  within(laTabla()).getByRole('button', { name: new RegExp(nombre) }).closest('th')!
const ordenarPor = (nombre: string) =>
  fireEvent.click(within(laTabla()).getByRole('button', { name: new RegExp(nombre) }))

beforeEach(() => {
  verRanking.mockReset()
  pedirExcel.mockReset()
  pedirExcel.mockResolvedValue({ contenido: new Blob(['x']), nombre: 'ranking.xlsx' })
  /*
    jsdom no trae ninguna de las dos, y sin ellas la descarga revienta antes de
    que se pueda comprobar qué se mandó. Se sustituyen por espías: lo que este
    archivo prueba es la PETICIÓN —los ids y su orden—, no que el navegador sepa
    guardar un archivo.
  */
  URL.createObjectURL = vi.fn(() => 'blob:de-mentira')
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  // Los espias y la vacante vuelven a su estado feliz: dos de estas pruebas los
  // cambian para su caso, y sin esto se lo llevarian a la siguiente.
  listarVersionesBanco.mockReset()
  listarVersionesBanco.mockResolvedValue(BANCOS)
  asignarPlantillaPrueba.mockReset()
  ponerNotaPrueba.mockReset()
  ponerNotaPrueba.mockResolvedValue(undefined)
  VERSIONES_PRUEBA = VERSIONES_DE_SIEMPRE
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

describe('las cinco cifras de la tanda', () => {
  /** El recuadro cuyo rótulo empieza por lo que se le pasa, y su cifra. */
  const cifraDe = (rotulo: string | RegExp) =>
    Number(screen.getByText(rotulo).closest('div')?.querySelector('b')?.textContent)

  /*
    ⚠️ **Salen de las filas de ESTA etapa, no de los contadores del backend.**
    Los del backend son de la cola que califica el currículum y valen lo mismo en
    las cinco pestañas: la vacante manda `calificados: 4` y en la pestaña de la
    prueba nadie tiene nota. Si las cifras salieran de ahí, los recuadros dirían
    lo mismo en las dos pestañas.
  */
  it('cuentan lo de la pestaña, no lo que manda la cabecera del backend', async () => {
    await pintar()
    verCorte('Toda la tanda')
    // En el perfil: 84, 75 y 52 tienen nota; Fátima no.
    expect(cifraDe(/ya calificados/)).toBe(3)

    irA('Prueba del puesto')
    await waitFor(() => expect(elCorte('Con nota de la prueba')).toBeTruthy())
    verCorte('Toda la tanda')
    // En la prueba nadie la tiene, aunque el backend siga diciendo «4 calificados».
    await waitFor(() => expect(cifraDe(/ya calificados/)).toBe(0))
  })

  it('la mediana y la media son las de las notas con nota', async () => {
    await pintar()
    verCorte('Toda la tanda')
    // 52, 75, 84 → mediana 75, media 70,3.
    expect(cifraDe('nota mediana de la tanda /100')).toBe(75)
    expect(cifraDe('nota media de la tanda /100')).toBe(70.3)
  })

  /*
    ⚠️ **El rótulo dice el número.** Es 70 escrito a mano porque la nota mínima
    que la vacante sí declara no viaja por la API. «Con 70 o más» es comprobable;
    «llegan al mínimo» afirmaría conocer un mínimo que la pantalla no ha leído.
  */
  it('el corte se dice en el rótulo, y cuenta a quien lo alcanza', async () => {
    await pintar()
    verCorte('Toda la tanda')
    expect(screen.getByText('con 70 o más')).toBeTruthy()
    expect(cifraDe('con 70 o más')).toBe(2) // 84 y 75; el 52 no.
  })

  it('sin nadie calificado no inventa un cero: pone una raya', async () => {
    await pintar([fila(95, 'Sin nota', 'POSTULADA', null)])
    verCorte('Toda la tanda')
    expect(
      screen.getByText('nota mediana de la tanda /100').closest('div')?.querySelector('b')?.textContent,
    ).toBe('—')
  })
})

describe('los criterios como columnas de color', () => {
  /** Una tanda con los criterios del currículum ya calificados. */
  const CON_CRITERIOS = [
    fila(91, 'Rodrigo Ayala', 'PERFIL_POR_CONFIRMAR', 84, {
      notasCriterio: [
        {
          criterio: 'Resultados demostrables',
          codigo: 'CV_RESULTADOS',
          puntaje: 20,
          maximo: 25,
          peso: 25,
          explicacion: 'Cifras concretas en tres puestos.',
          origen: 'AGENTE',
          confianza: 88,
          motivoAjuste: null,
        },
        {
          criterio: 'Complejidad y alcance',
          codigo: 'CV_COMPLEJIDAD',
          puntaje: null,
          maximo: 20,
          peso: 20,
          explicacion: null,
          origen: null,
          confianza: null,
          motivoAjuste: null,
        },
      ],
    }),
  ]

  const encender = () =>
    fireEvent.click(screen.getByRole('checkbox', { name: /Ver los criterios/ }))

  it('arrancan apagados: la tabla no crece sin que nadie lo pida', async () => {
    await pintar(CON_CRITERIOS)
    expect(screen.getByRole('checkbox', { name: /Ver los criterios/ })).toHaveProperty(
      'checked',
      false,
    )
    expect(within(laTabla()).queryByText(/Resultados demostrables/)).toBeNull()
  })

  /*
    ⚠️ **La cabecera lleva el nombre CORTO, no el largo.** Ese ancho decide si la
    tabla entera cabe en la pantalla: debajo solo hay dos dígitos y encima cabía
    «Resultados demostrables». El largo no se pierde — va en el `title`, que es
    donde se consulta una vez y no una por fila.
  */
  /*
    ⚠️ **La cabecera es SOLO la letra.** El peso vivia aqui debajo y era quien
    decidia el ancho de la columna —«no pondera» la estiraba a 87 px— para un
    dato que se consulta al entender una nota, no al barrer una columna. Baja a
    la leyenda, donde ya se explica cada letra.
  */
  it('encendidos, la cabecera es SOLO una letra: el peso no esta ahi', async () => {
    await pintar(CON_CRITERIOS)
    encender()
    const cabecera = within(laTabla()).getByText('R').closest('th')!
    expect(cabecera.textContent).toBe('R')
    expect(cabecera.textContent).not.toContain('peso')
    expect(cabecera.title).toBe('Resultados demostrables')
    expect(within(laTabla()).queryByText('Resultados demostrables')).toBeNull()
    expect(within(laTabla()).getByText('20/25')).toBeTruthy()
  })

  it('el peso se lee en la leyenda, junto a su letra', async () => {
    await pintar(CON_CRITERIOS)
    encender()
    const leyenda = screen.getByText('Resultados').closest('span')!
    expect(leyenda.textContent).toContain('peso 25')
    // Y el que no pondera lo dice con palabras, no con un «peso 0».
    const sinPeso = screen.getByText('Complejidad').closest('span')!
    expect(sinPeso.textContent).toContain('peso 20')
  })

  /*
    ⚠️ **Una letra sola no se sostiene sin esto.** Una «R» encima de un 43 no
    dice nada, y dejar su significado solo detras del cursor no existe con
    teclado ni en una impresion. La leyenda va SIEMPRE debajo de la tabla.
  */
  it('la leyenda dice que es cada letra, sin pedir el cursor', async () => {
    await pintar(CON_CRITERIOS)
    encender()
    const leyenda = screen.getByText('Resultados').closest('p')!
    expect(leyenda.textContent).toContain('R')
    expect(leyenda.textContent).toContain('Resultados')
    expect(leyenda.textContent).toContain('Complejidad')
  })

  /*
    ⚠️ **Un hueco no es un cero ni un rojo.** Sin nota puede ser que la IA no
    haya llegado o que ese criterio lo puntúe una persona. El `title` lo dice, y
    la celda no lleva ninguno de los tres tonos.
  */
  it('un criterio sin nota sale como hueco, y el título lo explica', async () => {
    await pintar(CON_CRITERIOS)
    encender()
    const celda = within(laTabla()).getByTitle(/Complejidad y alcance: todavía sin nota/)
    expect(celda.textContent).toBe('—')
  })

  /*
    ⚠️ **Fuera del currículum no salen, y no es por el ancho.** `notasCriterio`
    viene SIEMPRE del currículum: en la pestaña de la prueba serían columnas del
    CV con pinta de ser de la prueba, que es el fallo que el ranking arrastraba.
  */
  it('el interruptor no existe fuera de las etapas del currículum', async () => {
    await pintar(CON_CRITERIOS)
    expect(screen.queryByRole('checkbox', { name: /Ver los criterios/ })).toBeTruthy()
    irA('Prueba del puesto')
    expect(screen.queryByRole('checkbox', { name: /Ver los criterios/ })).toBeNull()
  })

  it('la leyenda solo aparece cuando hay colores que leer', async () => {
    await pintar(CON_CRITERIOS)
    expect(screen.queryByText(/cubre 70 % o más/)).toBeNull()
    encender()
    expect(screen.getByText(/cubre 70 % o más/)).toBeTruthy()
    // El hueco va nombrado con sus dos causas: es lo que impide leerlo como un cero.
    expect(screen.getByText(/ese criterio lo\s+puntúa una persona/)).toBeTruthy()
  })
})

describe('elegir qué columnas se ven', () => {
  const abrirSelector = () =>
    fireEvent.click(screen.getByText('Columnas', { selector: 'summary' }))

  it('apagar una columna la quita de la cabecera y de todas las filas', async () => {
    await pintar()
    expect(within(laTabla()).queryByRole('columnheader', { name: 'Estado' })).toBeTruthy()
    abrirSelector()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Estado' }))
    await waitFor(() =>
      expect(within(laTabla()).queryByRole('columnheader', { name: 'Estado' })).toBeNull(),
    )
  })

  /*
    ⚠️ **El `colSpan` de la fila de detalle sale de la MISMA lista.** Si se
    filtrara solo la cabecera, la fila abierta mediría más que la tabla y el
    bloque de dentro saldría descuadrado — el fallo clásico de esta pantalla.
  */
  it('el ancho de la fila de detalle sigue a las columnas que quedan', async () => {
    await pintar()
    const columnasAntes = laTabla().querySelectorAll('thead th').length
    abrirSelector()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Estado' }))
    await waitFor(() =>
      expect(laTabla().querySelectorAll('thead th').length).toBe(columnasAntes - 1),
    )
    fireEvent.click(screen.getByText('Rodrigo Ayala'))
    await waitFor(() => {
      const detalle = laTabla().querySelector('td[colspan]')
      expect(detalle?.getAttribute('colspan')).toBe(String(columnasAntes - 1))
    })
  })

  it('«Ver todas» las devuelve de una vez', async () => {
    await pintar()
    const columnasAntes = laTabla().querySelectorAll('thead th').length
    abrirSelector()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Estado' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Veredicto' }))
    await waitFor(() =>
      expect(laTabla().querySelectorAll('thead th').length).toBe(columnasAntes - 2),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Ver todas' }))
    await waitFor(() =>
      expect(laTabla().querySelectorAll('thead th').length).toBe(columnasAntes),
    )
  })

  it('el candidato no está entre las que se pueden apagar', async () => {
    await pintar()
    abrirSelector()
    expect(screen.queryByRole('checkbox', { name: 'Candidato' })).toBeNull()
  })
})

describe('el veredicto es el grupo de prioridad', () => {
  it('sube a columna propia, y sin semáforo', async () => {
    await pintar([
      fila(91, 'Rodrigo Ayala', 'PERFIL_POR_CONFIRMAR', 84, { grupoPrioridad: 'ALTA' }),
    ])
    expect(within(laTabla()).getByRole('columnheader', { name: 'Veredicto' })).toBeTruthy()
    expect(within(laTabla()).getByText('Prioridad alta')).toBeTruthy()
  })

  /*
    El guion es «la IA todavía no ha calificado su currículum»: el grupo se
    asigna al terminar esa pasada, así que una fila recién postulada no lo trae.
  */
  it('sin grupo pone una raya, no una etiqueta inventada', async () => {
    await pintar([fila(92, 'Fátima Quispe', 'POSTULADA', null)])
    verCorte('Toda la tanda')
    const fila92 = laTabla().querySelectorAll('tbody tr td')
    expect(Array.from(fila92).some((c) => c.textContent === '—')).toBe(true)
  })
})

describe('la ficha, al abrir una fila', () => {
  /*
    ⚠️ **Los criterios se pintan de la FILA, no de la petición.** Ya viajan en
    `notasCriterio` del ranking y estaban llegando sin que nadie los leyera. Aquí
    el doble de `verPerfilIntegral` devuelve la lista VACÍA a propósito: si la
    ficha esperase a la petición, no habría nada que ver.
  */
  it('pinta los criterios sin esperar a la petición del perfil', async () => {
    await pintar([
      fila(91, 'Rodrigo Ayala', 'PERFIL_POR_CONFIRMAR', 84, {
        notasCriterio: [
          {
            criterio: 'Resultados demostrables',
            codigo: 'CV_RESULTADOS',
            puntaje: 20,
            maximo: 25,
            peso: 25,
            explicacion: 'Cifras concretas en tres puestos.',
            origen: 'AGENTE',
            confianza: 88,
            motivoAjuste: null,
          },
        ],
      }),
    ])
    fireEvent.click(screen.getByText('Rodrigo Ayala'))
    await waitFor(() => expect(screen.getByText('Criterio a criterio')).toBeTruthy())
    expect(screen.getByText('Cifras concretas en tres puestos.')).toBeTruthy()
    expect(screen.getByText(/peso 25/)).toBeTruthy()
    expect(screen.getByText(/confianza 88/)).toBeTruthy()
    expect(screen.getByText(/la puso la IA/)).toBeTruthy()
  })

  /*
    ⚠️ **`motivoAjuste` no nulo significa una sola cosa** —lo garantiza un CHECK
    en la base: sin motivo, la nota ajustada no entra—. Es lo primero que hay que
    ver antes de discutir un número, y hasta ahora no se pintaba en ninguna parte.
  */
  it('dice cuándo una persona corrigió la nota, y por qué', async () => {
    await pintar([
      fila(91, 'Rodrigo Ayala', 'PERFIL_POR_CONFIRMAR', 84, {
        notasCriterio: [
          {
            criterio: 'Resultados demostrables',
            codigo: 'CV_RESULTADOS',
            puntaje: 12,
            maximo: 25,
            peso: 25,
            explicacion: 'La IA vio cifras concretas.',
            origen: 'PERSONA',
            confianza: null,
            motivoAjuste: 'Las cifras no se pudieron verificar con la referencia.',
          },
        ],
      }),
    ])
    fireEvent.click(screen.getByText('Rodrigo Ayala'))
    await waitFor(() => expect(screen.getByText('Criterio a criterio')).toBeTruthy())
    expect(screen.getByText(/ajustada a mano/)).toBeTruthy()
    expect(
      screen.getByText(/Las cifras no se pudieron verificar con la referencia/),
    ).toBeTruthy()
    expect(screen.queryByText(/la puso la IA/)).toBeNull()
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
    // ⚠️ Acotado a la línea del banco. Desde el ciclo 2 hay otro control que habla de
    // minutos con todo derecho —los de la etapa técnica—, así que buscar la palabra en
    // la pantalla entera dejó de significar «el banco no los trae».
    expect(screen.getByText('Banco CAZATALENTOS · Medio').parentElement?.textContent)
      .not.toMatch(/minutos/)
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

  /*
   * Un borrador no se puede asignar: el backend contesta 409 («esa version
   * todavia esta en borrador»). Ofrecerlo era mandar a alguien contra un error
   * que se puede ver venir — y ahora se ve, porque el listado trae el estado.
   */
  it('no ofrece una versión en borrador', async () => {
    await pintar()
    expect(screen.getByText(/Prueba de talento · convocatoria · v1/)).toBeTruthy()
    expect(screen.queryByText(/Prueba de talento · convocatoria · v2/)).toBeNull()
  })

  /*
   * El estado que el filtro de borradores creo: hay plantillas escritas y hay
   * versiones, pero **ninguna publicada**. El desplegable se queda sin opciones
   * y el cartel tiene que decir el paso que falta —publicar— y no «ninguna es de
   * este puesto», que mandaria a escribir una prueba que ya existe.
   */
  it('con todas las versiones en borrador dice que falta publicar una', async () => {
    VERSIONES_PRUEBA = [
      { id: 3, plantillaPruebaId: 1, version: 2, estado: 'BORRADOR' },
      { id: 4, plantillaPruebaId: 2, version: 2, estado: 'BORRADOR' },
    ]
    await pintar()

    expect(screen.queryByText(/Prueba de talento · convocatoria · v2/)).toBeNull()
    expect(screen.getByText(/Falta terminar y publicar una versión/)).toBeTruthy()
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

/*
 * La palanca de la etapa técnica: uno de dos instrumentos, nunca los dos.
 *
 * Lo que compila perfectamente estando mal:
 *   1. **Dejar los dos configurados a la vez.** Si se ven el desplegable de la prueba y el
 *      cuestionario juntos, nadie sabe cuál va a rendir el candidato — y el backend solo
 *      mira uno.
 *   2. **Pedir la plantilla a una vacante que eligió el cuestionario.** Deja «Publicar»
 *      apagado para siempre sobre algo que el servidor sí dejaría publicar.
 *   3. **Guardar los minutos al escribir.** Cada tecla es un valor distinto y, con gente
 *      dentro, cada tecla es un 409 en la cara de quien escribe.
 */
describe('qué se rinde en la etapa técnica', () => {
  /** La misma vacante con algo cambiado. Se reasigna antes de pintar, como el resto. */
  const conLaVacante = (cambios: Record<string, unknown>) => {
    sinRuido.verVacante = () => Promise.resolve({ ...VACANTE, ...cambios })
  }

  it('con la prueba del puesto se ofrece su desplegable', async () => {
    await pintar()

    expect(screen.getByRole('combobox', { name: /qué rendirá en la etapa técnica/i }))
      .toHaveProperty('value', 'PLANTILLA')
    expect(screen.getByRole('combobox', { name: /prueba del puesto/i })).toBeTruthy()
  })

  it('con el cuestionario, el desplegable de la prueba desaparece', async () => {
    conLaVacante({ instrumentoEtapaTecnica: 'CUESTIONARIO_TECNICO' })
    await pintar()

    expect(screen.queryByRole('combobox', { name: /prueba del puesto/i })).toBeNull()
    // Y en su lugar queda lo que sí aplica: la tarjeta que lleva a prepararlo.
    expect(screen.getByRole('link', { name: /la prueba técnica →/ })).toBeTruthy()
  })

  it('elegir el otro instrumento lo manda con los minutos que ya tenía', async () => {
    conLaVacante({ minutosEtapaTecnica: 45 })
    await pintar()

    fireEvent.change(screen.getByRole('combobox', { name: /qué rendirá en la etapa técnica/i }), {
      target: { value: 'CUESTIONARIO_TECNICO' },
    })

    await waitFor(() =>
      expect(elegirInstrumento).toHaveBeenCalledWith(1, {
        instrumento: 'CUESTIONARIO_TECNICO',
        minutos: 45,
      }),
    )
  })

  it('los minutos se guardan con un botón, no al escribir', async () => {
    await pintar()
    const minutos = screen.getByRole('spinbutton', { name: /cuánto tiempo tendrá/i })

    fireEvent.change(minutos, { target: { value: '4' } })
    fireEvent.change(minutos, { target: { value: '45' } })
    // Ni una llamada por el camino: «4» y «45» son valores distintos y los dos se habrían
    // mandado.
    expect(elegirInstrumento).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() =>
      expect(elegirInstrumento).toHaveBeenCalledWith(1, {
        instrumento: 'PLANTILLA',
        minutos: 45,
      }),
    )
  })

  it('unos minutos que no son un número entero no se ofrecen guardar', async () => {
    await pintar()

    fireEvent.change(screen.getByRole('spinbutton', { name: /cuánto tiempo tendrá/i }), {
      target: { value: '0' },
    })

    expect(screen.queryByRole('button', { name: 'Guardar' })).toBeNull()
    expect(screen.getByText(/número entero de 5 o más/i)).toBeTruthy()
  })

  /*
   * El suelo son cinco minutos, y el campo lo dice antes de intentarlo.
   *
   * Estos minutos mandan sobre el reloj del instrumento, así que un uno es una prueba que
   * el servidor entrega sola sesenta segundos después de que el candidato la abra. El
   * backend lo rechaza igual; aquí se frena para no gastar un 400 en decirlo.
   */
  it('un minuto no se ofrece guardar: el suelo son cinco', async () => {
    await pintar()

    fireEvent.change(screen.getByRole('spinbutton', { name: /cuánto tiempo tendrá/i }), {
      target: { value: '1' },
    })

    expect(screen.queryByRole('button', { name: 'Guardar' })).toBeNull()
    expect(screen.getByText(/número entero de 5 o más/i)).toBeTruthy()
  })

  it('cinco justos sí se guardan: el suelo entra', async () => {
    await pintar()

    fireEvent.change(screen.getByRole('spinbutton', { name: /cuánto tiempo tendrá/i }), {
      target: { value: '5' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() =>
      expect(elegirInstrumento).toHaveBeenCalledWith(1, {
        instrumento: 'PLANTILLA',
        minutos: 5,
      }),
    )
  })

  it('vacío es un valor: el tiempo lo pone el instrumento', async () => {
    await pintar()

    expect(screen.getByRole('spinbutton', { name: /cuánto tiempo tendrá/i }))
      .toHaveProperty('value', '')
    expect(screen.getByText(/rige el tiempo que traiga el instrumento/i)).toBeTruthy()
  })

  /*
   * Con un número escrito, la ayuda dice lo que este campo hace AHORA: mandar sobre el
   * reloj del instrumento. Es el arreglo entero contado en una frase — antes el campo se
   * guardaba y no le pasaba nada a la prueba del puesto.
   */
  it('con un número escrito, la ayuda dice que manda sobre el instrumento', async () => {
    conLaVacante({ minutosEtapaTecnica: 90 })
    await pintar()

    expect(screen.getByText(/manda sobre el que traiga el instrumento/i)).toBeTruthy()
    expect(screen.queryByText(/rige el tiempo que traiga el instrumento/i)).toBeNull()
  })
})

// ---------- Ordenar, filtrar y descargar ----------

/*
 * Una tanda con ciudad y pretensión puestas: es la única forma de que esas dos
 * columnas existan. Sin ellas la tabla las esconde a propósito, que es lo que
 * prueba el último bloque de este archivo.
 */
const CON_DATOS = [
  fila(91, 'Rodrigo Ayala', 'PERFIL_POR_CONFIRMAR', 84, {
    ciudad: 'Lima — Lima',
    ciudadCodigo: '1501',
    pretensionMin: 4000,
    pretensionMoneda: 'PEN',
  }),
  fila(93, 'Camila Reyes', 'PERFIL_POR_CONFIRMAR', 75, {
    ciudad: 'Arequipa — Camaná',
    ciudadCodigo: '0402',
    pretensionMin: 2500,
    pretensionMax: 3000,
    pretensionMoneda: 'PEN',
  }),
  fila(94, 'Lucía Ferrer', 'PERFIL_POR_CONFIRMAR', 52, {}),
]

const conDatos = () =>
  pintar(CON_DATOS.map((f) => ({ ...f })))

describe('ordenar por una columna', () => {
  it('la tabla abre en el orden del backend, sin nada ordenado a mano', async () => {
    await conDatos()
    expect(elOrdenDeLaTabla()).toEqual(['Rodrigo Ayala', 'Camila Reyes', 'Lucía Ferrer'])
    expect(laCabecera('Candidato')).toHaveProperty('ariaSort', 'none')
  })

  it('pulsar «Candidato» ordena de la A a la Z y lo dice en `aria-sort`', async () => {
    await conDatos()
    ordenarPor('Candidato')
    await waitFor(() =>
      expect(elOrdenDeLaTabla()).toEqual(['Camila Reyes', 'Lucía Ferrer', 'Rodrigo Ayala']),
    )
    expect(laCabecera('Candidato')).toHaveProperty('ariaSort', 'ascending')
  })

  /*
    ⚠️ **La regla que se rompe sola.** Ordenar y dar la vuelta al array sube los
    huecos a la primera pantalla en cuanto se pulsa «descendente». Lucía no tiene
    pretensión y tiene que quedarse abajo en los dos sentidos.
  */
  it('quien no declaró pretensión se queda abajo suba o baje el orden', async () => {
    await conDatos()
    ordenarPor('Pretensión')
    await waitFor(() =>
      expect(elOrdenDeLaTabla()).toEqual(['Camila Reyes', 'Rodrigo Ayala', 'Lucía Ferrer']),
    )
    ordenarPor('Pretensión')
    await waitFor(() =>
      expect(elOrdenDeLaTabla()).toEqual(['Rodrigo Ayala', 'Camila Reyes', 'Lucía Ferrer']),
    )
  })

  it('el tercer clic devuelve el orden del ranking', async () => {
    await conDatos()
    ordenarPor('Candidato')
    await waitFor(() => expect(elOrdenDeLaTabla()[0]).toBe('Camila Reyes'))
    ordenarPor('Candidato')
    ordenarPor('Candidato')
    await waitFor(() => expect(elOrdenDeLaTabla()[0]).toBe('Rodrigo Ayala'))
    expect(laCabecera('Candidato')).toHaveProperty('ariaSort', 'none')
  })
})

describe('los filtros de la barra', () => {
  const elBuscador = () => screen.getByRole('searchbox', { name: /buscar por nombre/i })

  it('busca por nombre sin tildes: «lucia» encuentra a Lucía', async () => {
    await conDatos()
    fireEvent.change(elBuscador(), { target: { value: 'lucia' } })
    await waitFor(() => expect(elOrdenDeLaTabla()).toEqual(['Lucía Ferrer']))
  })

  /*
    ⚠️ **El tercer vacío.** Con el corte lleno y la tabla vacía por un filtro,
    decir «nadie tiene nota del perfil» sería falso —los hay— y mandaría a pulsar
    el corte de al lado, que tampoco es. Se nombra el filtro, que es lo que hay
    que quitar.
  */
  it('cuando el filtro lo deja todo fuera, la tabla dice que fue el filtro', async () => {
    await conDatos()
    fireEvent.change(elBuscador(), { target: { value: 'nadie se llama así' } })
    await waitFor(() =>
      expect(screen.getByText(/pasa los filtros que hay puestos/i)).toBeTruthy(),
    )
    expect(screen.queryByText(/Nadie tiene todavía nota del perfil/)).toBeNull()
  })

  it('«Ver a todos» los devuelve', async () => {
    await conDatos()
    fireEvent.change(elBuscador(), { target: { value: 'lucia' } })
    await waitFor(() => expect(elOrdenDeLaTabla()).toEqual(['Lucía Ferrer']))
    fireEvent.click(screen.getByRole('button', { name: 'Ver a todos' }))
    await waitFor(() => expect(elOrdenDeLaTabla()).toHaveLength(3))
  })

  it('mientras hay filtro puesto se dice cuántas se ven de cuántas', async () => {
    await conDatos()
    fireEvent.change(elBuscador(), { target: { value: 'lucia' } })
    await waitFor(() => expect(screen.getByText(/Se ven 1 de 3 de este corte/)).toBeTruthy())
  })
})

describe('la descarga del Excel', () => {
  const elBoton = () => screen.getByRole('button', { name: /Descargar Excel/ })

  /*
    ⚠️ **Lo que de verdad hay que probar.** El backend escribe las filas en el
    orden que se le manda y nada más: si aquí viajaran las filas sin ordenar, la
    hoja no se parecería a la pantalla desde la que se pidió.
  */
  it('manda los ids en el orden EXACTO de la pantalla, no el del backend', async () => {
    await conDatos()
    ordenarPor('Candidato')
    await waitFor(() => expect(elOrdenDeLaTabla()[0]).toBe('Camila Reyes'))

    fireEvent.click(elBoton())

    await waitFor(() => expect(pedirExcel).toHaveBeenCalledOnce())
    expect(pedirExcel.mock.calls[0]?.[1]).toMatchObject({
      etapa: 'PERFIL_INTEGRAL',
      postulacionIds: [93, 94, 91],
    })
  })

  it('manda solo lo que sobrevive al filtro, no la tanda entera', async () => {
    await conDatos()
    fireEvent.change(screen.getByRole('searchbox', { name: /buscar por nombre/i }), {
      target: { value: 'lucia' },
    })
    await waitFor(() => expect(elOrdenDeLaTabla()).toEqual(['Lucía Ferrer']))

    fireEvent.click(elBoton())

    await waitFor(() => expect(pedirExcel).toHaveBeenCalledOnce())
    expect(pedirExcel.mock.calls[0]?.[1]).toMatchObject({ postulacionIds: [94] })
  })

  it('la descripción dice el corte, el filtro y el orden: la hoja se abre lejos de aquí', async () => {
    await conDatos()
    fireEvent.click(elBoton())
    await waitFor(() => expect(pedirExcel).toHaveBeenCalledOnce())
    const descrito = (pedirExcel.mock.calls[0]?.[1] as { filtroDescrito: string }).filtroDescrito
    expect(descrito).toContain('Perfil integral')
    expect(descrito).toContain('Con nota del perfil')
    expect(descrito).toContain('Orden del ranking')
  })

  it('el botón dice que está trabajando, y no se puede pulsar dos veces', async () => {
    let soltar = () => {}
    pedirExcel.mockImplementation(
      () =>
        new Promise((cumplir) => {
          soltar = () => cumplir({ contenido: new Blob(['x']), nombre: 'r.xlsx' })
        }),
    )
    await conDatos()
    fireEvent.click(elBoton())

    await waitFor(() => expect(screen.getByRole('button', { name: /Preparando el Excel/ })).toBeTruthy())
    expect(screen.getByRole('button', { name: /Preparando el Excel/ })).toHaveProperty(
      'disabled',
      true,
    )
    soltar()
    await waitFor(() => expect(elBoton()).toBeTruthy())
  })

  /*
    El mensaje del servidor tal cual: es él quien sabe por qué —una etapa que no
    exporta, un permiso que falta— y traducirlo a «no se pudo» borraría justo lo
    que hay que arreglar.
  */
  it('un fallo se enseña con lo que dijo el servidor', async () => {
    pedirExcel.mockRejectedValue(new Error('Esa etapa no se exporta.'))
    await conDatos()
    fireEvent.click(elBoton())
    await waitFor(() => expect(screen.getByText('Esa etapa no se exporta.')).toBeTruthy())
  })

  /*
    ⚠️ En Simulación, Validación y Decisión el backend responde 400. El botón no
    existe, en vez de salir y fallar: ofrecer una descarga que el servidor va a
    rechazar es peor que no ofrecerla.
  */
  it('no hay botón en las tres etapas que el backend no exporta', async () => {
    await conDatos()
    expect(screen.queryByRole('button', { name: /Descargar Excel/ })).toBeTruthy()
    irA('Simulación')
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Descargar Excel/ })).toBeNull(),
    )
    irA('Prueba del puesto')
    await waitFor(() => expect(elCorte('Con nota de la prueba')).toBeTruthy())
    verCorte('Toda la tanda')
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Descargar Excel/ })).toBeTruthy(),
    )
  })
})

describe('una columna entera vacía no se pinta', () => {
  /*
    ⚠️ **La pretensión viaja bajo el permiso `ver_pretension`, que solo tiene
    DIRECCIÓN.** Para todo el rol de talento llega nula siempre, y una columna de
    guiones ahí se lee como «nadie pidió sueldo» — que puede ser falso. Cuál de
    los dos motivos es lo dice `puedeVerPretension`, que viaja en la respuesta
    justamente porque el nulo por sí solo no los separa.

    La ciudad falta por otra razón y también entera: solo se le pide a quien crea
    su cuenta desde ahora, así que ninguna postulación anterior la trae. `TANDA`,
    la tanda por defecto de este archivo, es exactamente ese caso.
  */
  it('sin ciudad ni pretensión en la tanda, ninguna de las dos cabeceras existe', async () => {
    await pintar()
    const cabeceras = within(laTabla())
      .getAllByRole('columnheader')
      .map((c) => c.textContent ?? '')
    expect(cabeceras.some((c) => c.includes('Ciudad'))).toBe(false)
    expect(cabeceras.some((c) => c.includes('Pretensión'))).toBe(false)
  })

  it('y se dice por qué: con permiso, que nadie la declaró', async () => {
    await pintar()
    fireEvent.click(screen.getByText(/Ciudad, nota y pretensión/))
    expect(screen.getByText(/Ninguno de estos candidatos declaró/)).toBeTruthy()
    expect(screen.getByText(/solo se le pide a quien crea su cuenta desde ahora/)).toBeTruthy()
  })

  /*
    El mismo blanco, el motivo opuesto. Sin `ver_pretension` el backend ni lanza
    la consulta, así que la columna estaría vacía aunque todos hubieran pedido
    sueldo: aquí la frase tiene que NEGAR expresamente esa lectura, no repetir
    la de arriba.
  */
  it('y sin el permiso, que el dato ni se consultó', async () => {
    await pintar(TANDA, false)
    fireEvent.click(screen.getByText(/Ciudad, nota y pretensión/))
    expect(screen.getByText(/Tu rol no puede ver la pretensión/)).toBeTruthy()
    expect(screen.getByText(/NO quiere decir/)).toBeTruthy()
  })

  it('con una sola fila que las traiga, las dos columnas vuelven', async () => {
    await conDatos()
    const cabeceras = within(laTabla())
      .getAllByRole('columnheader')
      .map((c) => c.textContent ?? '')
    expect(cabeceras.some((c) => c.includes('Ciudad'))).toBe(true)
    expect(cabeceras.some((c) => c.includes('Pretensión'))).toBe(true)
  })

  it('la pretensión se lee con su moneda y su rango', async () => {
    await conDatos()
    expect(within(laTabla()).getByText('S/ 2,500 – 3,000')).toBeTruthy()
    expect(within(laTabla()).getByText('desde S/ 4,000')).toBeTruthy()
  })
})

/**
 * Calificar a mano el criterio que la rúbrica le reserva a una persona.
 *
 * Lo que compila perfectamente estando mal aquí:
 *
 *   1. **No pintar el botón en el criterio SIN nota.** Es justo el que hay que
 *      calificar. Si la lista solo ofreciera corregir lo ya puesto, la prueba
 *      seguiría sin poder cerrarse y la pantalla se vería bien.
 *   2. **Dejar guardar sin explicación.** El servidor la exige y contesta 400;
 *      enterarse después de escribir el puntaje es la peor versión.
 *   3. **Admitir un puntaje por encima del máximo del criterio.** Uno que vale
 *      10 no puede recibir un 80: la escala es la del criterio, no 0 a 100.
 *   4. **Ponerle el botón a las métricas del periodo de validación**, que no
 *      tienen endpoint para esto y responderían 404.
 */
describe('calificar a mano un criterio de la prueba', () => {
  /** Abrir la ficha de quien está parado en la prueba. */
  const abrirLaFicha = async () => {
    await pintar()
    irA('Prueba del puesto')
    /*
      ⚠️ **Hay que cambiar de corte, y eso es el caso real.** La pestaña abre
      por «con nota de la prueba», y quien tiene la rúbrica a medias NO tiene
      nota de etapa todavía —es justo lo que falta calificar—, así que en el
      corte por defecto no sale. A quien hay que calificar se le encuentra en
      «está aquí ahora».
    */
    await waitFor(() => expect(elCorte('Con nota de la prueba')).toBeTruthy())
    verCorte('Está aquí ahora')
    const fila = await screen.findByText('Camila Reyes')
    fireEvent.click(fila.closest('tr')!)
    await screen.findByRole('heading', {
      name: 'La prueba del puesto, criterio a criterio',
    })
    // El título sale antes que las notas: son dos consultas distintas.
    return await screen.findByText('Sustentación en video')
  }

  /** La fila de un criterio, por su nombre. */
  const elCriterio = (nombre: string) => screen.getByText(nombre).closest('li')!

  it('ofrece calificar el criterio que la IA no puede tocar', async () => {
    await abrirLaFicha()
    // El que la rúbrica reserva a una persona: sin nota y con el botón.
    expect(
      within(elCriterio('Sustentación en video')).getByRole('button', {
        name: 'Calificar a mano Sustentación en video',
      }),
    ).toBeTruthy()
    // Y el que ya calificó la IA se puede corregir, que no es lo mismo.
    expect(
      within(elCriterio('Objetivo: la campaña está bien planteada')).getByRole('button', {
        name: 'Corregir la nota de Objetivo: la campaña está bien planteada',
      }),
    ).toBeTruthy()
  })

  it('manda el puntaje y el porqué a ese criterio y a esa postulación', async () => {
    await abrirLaFicha()
    fireEvent.click(
      within(elCriterio('Sustentación en video')).getByRole('button', {
        name: 'Calificar a mano Sustentación en video',
      }),
    )
    fireEvent.change(screen.getByLabelText(/Puntaje/), { target: { value: '8' } })
    fireEvent.change(screen.getByLabelText(/Por qué esa nota/), {
      target: { value: 'Defiende sus decisiones y responde a la objeción del presupuesto.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar la nota' }))

    await waitFor(() => expect(ponerNotaPrueba).toHaveBeenCalledTimes(1))
    expect(ponerNotaPrueba).toHaveBeenCalledWith(
      93,
      36,
      8,
      'Defiende sus decisiones y responde a la objeción del presupuesto.',
    )
  })

  it('no deja guardar sin explicación, ni con un puntaje por encima del máximo', async () => {
    await abrirLaFicha()
    fireEvent.click(
      within(elCriterio('Sustentación en video')).getByRole('button', {
        name: 'Calificar a mano Sustentación en video',
      }),
    )
    const guardar = screen.getByRole('button', { name: 'Guardar la nota' })

    // Con puntaje y sin porqué: apagado.
    fireEvent.change(screen.getByLabelText(/Puntaje/), { target: { value: '8' } })
    expect(guardar).toHaveProperty('disabled', true)

    // Con porqué y un puntaje de 80 sobre un criterio que vale 10: apagado.
    fireEvent.change(screen.getByLabelText(/Por qué esa nota/), {
      target: { value: 'Sustenta bien.' },
    })
    fireEvent.change(screen.getByLabelText(/Puntaje/), { target: { value: '80' } })
    expect(guardar).toHaveProperty('disabled', true)

    // Dentro de la escala del criterio: encendido.
    fireEvent.change(screen.getByLabelText(/Puntaje/), { target: { value: '8' } })
    expect(guardar).toHaveProperty('disabled', false)

    // Y un cero es una nota, no un hueco.
    fireEvent.change(screen.getByLabelText(/Puntaje/), { target: { value: '0' } })
    expect(guardar).toHaveProperty('disabled', false)
  })

  it('no ofrece el botón en las métricas del periodo de validación', async () => {
    await pintar()
    irA('Validación')
    // Nadie está parado en Validación: la ficha se abre desde la tanda entera.
    await waitFor(() => expect(elCorte('Toda la tanda')).toBeTruthy())
    verCorte('Toda la tanda')
    const fila = await screen.findByText('Rodrigo Ayala')
    fireEvent.click(fila.closest('tr')!)
    await screen.findByRole('heading', { name: 'El periodo de validación' })
    /*
      No hay `POST .../validacion/metricas/{id}/nota` en el backend: un botón
      aquí sería una llamada a una ruta que no existe.
    */
    expect(screen.queryByRole('button', { name: /Calificar a mano/ })).toBeNull()
  })
})
