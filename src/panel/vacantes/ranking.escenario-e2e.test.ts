/**
 * Lo que bajó de la suite e2e a prueba unitaria (25/09/2026), sobre el mismo
 * escenario que las e2e daban por sabido en la vacante «Desarrollador web».
 *
 * Cada `it` lleva el nombre de la prueba de Playwright que reemplaza y el
 * archivo del que salió. Lo que aquí se fija es la REGLA —qué filas deja un
 * filtro, en qué orden quedan, qué columnas existen, qué dice una celda—; el
 * cableado de la pantalla que aún hace falta ver en el navegador se quedó en
 * `herramientas/e2e/03-orden` y `04-filtros`, ahora con este escenario
 * interceptado (`herramientas/e2e/escenario-desarrollador-web.ts`).
 *
 * ⚠️ **El escenario es el mismo que el del helper de e2e, copiado a mano**: las
 * pruebas de `src/` no pueden importar de `herramientas/`. Si cambia allí,
 * cambia aquí.
 *
 *   Lucía     (ALTA,           74, Arequipa — Camaná,      3100–3600)
 *   Camila    (ALTA,           55, Lima — Lima,            2500–3000)
 *   Sebastián (NO_PRIORIZADO,  61, Junín — Huancayo,       sin pretensión)
 *   Joaquín   (INCOMPATIBLE,   95, La Libertad — Trujillo, 4000–5200)
 *
 * Ese es «el orden del backend»: por grupo y, dentro, por nota. INCOMPATIBLE es
 * un grupo que el sistema real no produce; está porque el orden lo exige.
 */

import { describe, expect, it } from 'vitest'
import {
  alternarMarcarTodo,
  alternarOrden,
  atajoDeFecha,
  ciudadesDelRanking,
  columnasDelRanking,
  comoSeOrdena,
  estadoDeMarcarTodo,
  ETAPAS_PANEL,
  filtrar,
  filtrarFino,
  filtrosActivos,
  hayFiltroDeFecha,
  hayFiltroPuesto,
  marcasFueraDeVista,
  ordenar,
  porQueNoHayNotaCorto,
  porQueNoHayPretension,
  pretensionDicha,
  queTraeLaTanda,
  rangoDeFechaAlReves,
  seExportaAExcel,
  SIN_FILTROS,
  type Filtros,
  type Orden,
} from './ranking'
import type { FilaRanking } from '../api/tipos'

const fila = (extra: Partial<FilaRanking>): FilaRanking => ({
  puesto: 1,
  postulacionId: 1,
  uuid: 'p1',
  candidato: 'Quien sea',
  correo: 'quien@example.com',
  estado: 'PERFIL_POR_CONFIRMAR',
  estadoNombre: 'Perfil por confirmar',
  estadoCalificacion: 'SIN_EMPEZAR',
  pasada: null,
  archivoNombre: null,
  grupoPrioridad: null,
  ciudad: null,
  ciudadCodigo: null,
  pretensionMin: null,
  pretensionMax: null,
  pretensionMoneda: null,
  pretensionDeclarada: null,
  pretensionDeclaradaMoneda: null,
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
  ...extra,
})

const LUCIA = 'Lucía Chávez Paredes'
const CAMILA = 'Camila Torres Rivas'
const SEBASTIAN = 'Sebastián Cárdenas Rojo'
const JOAQUIN = 'Joaquín Vargas Ureta'

/** En el orden del backend, con los estados que traen en la base sembrada. */
const ESCENARIO: FilaRanking[] = [
  fila({
    puesto: 1, postulacionId: 7, uuid: 'lucia', candidato: LUCIA, estado: 'DECISION_POR_CONFIRMAR',
    grupoPrioridad: 'ALTA', notaEtapa: 74, ciudad: 'Arequipa — Camaná', ciudadCodigo: '0402',
    pretensionMin: 3100, pretensionMax: 3600, pretensionMoneda: 'PEN',
  }),
  fila({
    puesto: 2, postulacionId: 1, uuid: 'camila', candidato: CAMILA, estado: 'PERFIL_POR_CONFIRMAR',
    grupoPrioridad: 'ALTA', notaEtapa: 55, ciudad: 'Lima — Lima', ciudadCodigo: '1501',
    pretensionMin: 2500, pretensionMax: 3000, pretensionMoneda: 'PEN',
  }),
  fila({
    puesto: 3, postulacionId: 10, uuid: 'sebastian', candidato: SEBASTIAN, estado: 'CERRADA',
    grupoPrioridad: 'NO_PRIORIZADO', notaEtapa: 61, ciudad: 'Junín — Huancayo', ciudadCodigo: '1201',
  }),
  fila({
    puesto: 4, postulacionId: 4, uuid: 'joaquin', candidato: JOAQUIN, estado: 'PRUEBA_POR_CONFIRMAR',
    grupoPrioridad: 'INCOMPATIBLE', notaEtapa: 95, ciudad: 'La Libertad — Trujillo', ciudadCodigo: '1301',
    pretensionMin: 4000, pretensionMax: 5200, pretensionMoneda: 'PEN',
  }),
]
const DEL_BACKEND = [LUCIA, CAMILA, SEBASTIAN, JOAQUIN]

const nombres = (filas: FilaRanking[]) => filas.map((f) => f.candidato)
const ids = (filas: FilaRanking[]) => filas.map((f) => f.postulacionId)
const con = (extra: Partial<Filtros>): Filtros => ({ ...SIN_FILTROS, ...extra })
const CIUDADES = ciudadesDelRanking(ESCENARIO)

describe('03-orden · ordenar por las cuatro columnas', () => {
  it('sin orden puesto, la tanda es la del backend: por grupo y, dentro, por nota', () => {
    expect(ordenar(ESCENARIO, null)).toBe(ESCENARIO)
    expect(nombres(ordenar(ESCENARIO, null))).toEqual(DEL_BACKEND)
  })

  it('los tres estados de Candidato: de la A a la Z, la vuelta, y el orden del backend', () => {
    let orden: Orden | null = alternarOrden(null, 'nombre')
    expect(comoSeOrdena(orden, 'nombre')).toBe('ascending')
    expect(nombres(ordenar(ESCENARIO, orden))).toEqual([CAMILA, JOAQUIN, LUCIA, SEBASTIAN])

    orden = alternarOrden(orden, 'nombre')
    expect(comoSeOrdena(orden, 'nombre')).toBe('descending')
    expect(nombres(ordenar(ESCENARIO, orden))).toEqual([SEBASTIAN, LUCIA, JOAQUIN, CAMILA])

    // Tercer clic: vuelve al orden del backend.
    orden = alternarOrden(orden, 'nombre')
    expect(orden).toBeNull()
    expect(comoSeOrdena(orden, 'nombre')).toBe('none')
    expect(nombres(ordenar(ESCENARIO, orden))).toEqual(DEL_BACKEND)
  })

  it('Ciudad ordena alfabéticamente en los dos sentidos', () => {
    expect(nombres(ordenar(ESCENARIO, { columna: 'ciudad', sentido: 'asc' }))).toEqual([
      LUCIA, // Arequipa
      SEBASTIAN, // Junín
      JOAQUIN, // La Libertad
      CAMILA, // Lima
    ])
    expect(nombres(ordenar(ESCENARIO, { columna: 'ciudad', sentido: 'desc' }))).toEqual([
      CAMILA,
      JOAQUIN,
      SEBASTIAN,
      LUCIA,
    ])
  })

  it('Nota abre por la MAYOR y manda la nota, cruzando grupos', () => {
    const orden = alternarOrden(null, 'nota')
    // El primer clic de nota es descendente: el ranking ES eso.
    expect(comoSeOrdena(orden, 'nota')).toBe('descending')
    expect(nombres(ordenar(ESCENARIO, orden))).toEqual([
      JOAQUIN, // 95, aunque su grupo sea el último
      LUCIA, // 74
      SEBASTIAN, // 61
      CAMILA, // 55
    ])
    expect(nombres(ordenar(ESCENARIO, alternarOrden(orden, 'nota')))).toEqual([
      CAMILA,
      SEBASTIAN,
      LUCIA,
      JOAQUIN,
    ])
  })

  it('Pretensión: los vacíos al final SUBA O BAJE el orden', () => {
    expect(nombres(ordenar(ESCENARIO, { columna: 'pretension', sentido: 'asc' }))).toEqual([
      CAMILA, // 2500
      LUCIA, // 3100
      JOAQUIN, // 4000
      SEBASTIAN, // sin declarar -> al final
    ])
    expect(nombres(ordenar(ESCENARIO, { columna: 'pretension', sentido: 'desc' }))).toEqual([
      JOAQUIN, // 4000
      LUCIA, // 3100
      CAMILA, // 2500
      SEBASTIAN, // sin declarar -> SIGUE al final
    ])
  })

  it('solo una columna a la vez lleva aria-sort distinto de none', () => {
    const porCiudad = alternarOrden(null, 'ciudad')
    expect(comoSeOrdena(porCiudad, 'ciudad')).toBe('ascending')
    for (const otra of ['nombre', 'nota', 'pretension'] as const) {
      expect(comoSeOrdena(porCiudad, otra)).toBe('none')
    }
    // Cambiar de columna empieza de cero y apaga la anterior.
    const porPretension = alternarOrden(porCiudad, 'pretension')
    expect(comoSeOrdena(porPretension, 'pretension')).toBe('ascending')
    expect(comoSeOrdena(porPretension, 'ciudad')).toBe('none')
  })

  it('ordenar una columna ENTERA vacía no rompe nada', () => {
    // En «Prueba del puesto» nadie tiene nota: la columna es toda guiones.
    const enLaPrueba = ESCENARIO.map((f) => ({ ...f, notaEtapa: null }))
    const antes = nombres(enLaPrueba)
    // Todas empatan a vacío, así que manda el orden de origen, suba o baje.
    expect(nombres(ordenar(enLaPrueba, { columna: 'nota', sentido: 'desc' }))).toEqual(antes)
    expect(nombres(ordenar(enLaPrueba, { columna: 'nota', sentido: 'asc' }))).toEqual(antes)
  })
})

describe('04-filtros · los filtros del ranking', () => {
  it('el buscador encuentra CON y SIN tildes, en los dos sentidos', () => {
    // Escrito sin tilde, el dato la lleva.
    expect(nombres(filtrarFino(ESCENARIO, con({ texto: 'lucia' })))).toEqual([LUCIA])
    // Escrito CON tilde, también.
    expect(nombres(filtrarFino(ESCENARIO, con({ texto: 'Lucía' })))).toEqual([LUCIA])
    // Por apellido y sin tilde.
    expect(nombres(filtrarFino(ESCENARIO, con({ texto: 'chavez' })))).toEqual([LUCIA])
    // En mayúsculas.
    expect(nombres(filtrarFino(ESCENARIO, con({ texto: 'CAMILA' })))).toEqual([CAMILA])
    // Con espacios alrededor: se recortan.
    expect(filtrarFino(ESCENARIO, con({ texto: '   camila   ' }))).toHaveLength(1)
    // Solo espacios NO es un filtro puesto.
    expect(filtrarFino(ESCENARIO, con({ texto: '   ' }))).toHaveLength(4)
    expect(hayFiltroPuesto(con({ texto: '   ' }))).toBe(false)
  })

  it('multi-selección de ciudad: dos marcadas suman las dos', () => {
    expect(nombres(filtrarFino(ESCENARIO, con({ ciudades: ['1501'] })))).toEqual([CAMILA])
    expect(nombres(filtrarFino(ESCENARIO, con({ ciudades: ['1501', '0402'] }))).sort()).toEqual([
      CAMILA,
      LUCIA,
    ])
    // Desmarcar una la quita.
    expect(nombres(filtrarFino(ESCENARIO, con({ ciudades: ['0402'] })))).toEqual([LUCIA])
    // Los chips llevan su recuento y salen de las filas, no del catálogo (4 ciudades).
    expect(CIUDADES).toHaveLength(4)
    expect(CIUDADES.map((c) => c.codigo).sort()).toEqual(['0402', '1201', '1301', '1501'])
    expect(CIUDADES.every((c) => c.cuantas === 1)).toBe(true)
  })

  it('rango de nota: quien no tiene nota queda fuera, y se dice', () => {
    const conUnaSinNota = [...ESCENARIO, fila({ postulacionId: 99, candidato: 'Sin nota', notaEtapa: null })]
    expect(nombres(filtrarFino(conUnaSinNota, con({ notaMin: 60, notaMax: 80 }))).sort()).toEqual([
      LUCIA,
      SEBASTIAN,
    ])
    // Solo un extremo también filtra: 61, 74 y 95. Y quien no tiene nota no es «≥ 60».
    const desdeSesenta = filtrarFino(conUnaSinNota, con({ notaMin: 60 }))
    expect(desdeSesenta).toHaveLength(3)
    expect(nombres(desdeSesenta)).not.toContain('Sin nota')
  })

  it('rango de pretensión: solape, no contención; sin declarar queda fuera', () => {
    // Camila pide 2500–3000: solapa. Lucía empieza en 3100: no. Sebastián no declaró.
    expect(nombres(filtrarFino(ESCENARIO, con({ pretensionMin: 2000, pretensionMax: 3000 })))).toEqual([
      CAMILA,
    ])
    const hasta3200 = filtrarFino(ESCENARIO, con({ pretensionMin: 2000, pretensionMax: 3200 }))
    expect(nombres(hasta3200).sort()).toEqual([CAMILA, LUCIA])
    expect(nombres(hasta3200)).not.toContain(SEBASTIAN)
  })

  it('los filtros se combinan entre sí y con el corte', () => {
    const filtros = con({ notaMin: 50, ciudades: ['1501', '0402'], texto: 'lucia' })
    const finas = filtrarFino(ESCENARIO, filtros)
    expect(nombres(finas)).toEqual([LUCIA])

    // La insignia del botón cuenta los filtros del panel (ciudad + nota = 2); la
    // búsqueda por nombre está a la vista y no cuenta.
    expect(filtrosActivos(filtros, 'PERFIL_INTEGRAL', CIUDADES, 2026)).toHaveLength(2)

    // Y el corte recorta encima: a Lucía no le toca hacer nada, así que cae.
    expect(filtrar(finas, 'PERFIL_INTEGRAL', 'le-toca')).toEqual([])
  })

  it('rango invertido (80–20) deja la tabla vacía y lo explica como filtro', () => {
    const alReves = con({ notaMin: 80, notaMax: 20 })
    expect(filtrarFino(ESCENARIO, alReves)).toEqual([])
    // Es un filtro puesto: la tabla vacía nombra el filtro, no dice «nadie tiene nota».
    expect(hayFiltroPuesto(alReves)).toBe(true)
    expect(filtrosActivos(alReves, 'PERFIL_INTEGRAL', CIUDADES, 2026).map((a) => a.texto)).toEqual([
      'Nota del perfil 80–20',
    ])
  })

  it('el filtro sobrevive a ordenar, y el orden al filtrar', () => {
    const porNombre: Orden = { columna: 'nombre', sentido: 'asc' }
    // Las cuatro llevan «a».
    const conA = filtrarFino(ESCENARIO, con({ texto: 'a' }))
    expect(conA).toHaveLength(4)
    expect(nombres(ordenar(conA, porNombre))).toEqual([CAMILA, JOAQUIN, LUCIA, SEBASTIAN])

    // Cambiar el filtro con el orden puesto: lo que queda sigue alfabetizado.
    const tras = nombres(ordenar(filtrarFino(ESCENARIO, con({ texto: 'ar' })), porNombre))
    expect(tras).toEqual([...tras].sort((a, b) => a.localeCompare(b, 'es')))
    expect(tras.length).toBeGreaterThan(0)
    expect(tras.length).toBeLessThan(4)

    // Da igual en qué orden se apliquen: filtrar y ordenar conmutan.
    expect(nombres(ordenar(filtrarFino(ESCENARIO, con({ texto: 'ar' })), porNombre))).toEqual(
      nombres(filtrarFino(ordenar(ESCENARIO, porNombre), con({ texto: 'ar' }))),
    )
  })

  it('vacante 7: están Ciudad y Pretensión, y la pretensión se lee con su símbolo y su separador peruano', () => {
    const trae = queTraeLaTanda(ESCENARIO)
    expect(trae.hayCiudad).toBe(true)
    expect(trae.hayPretension).toBe(true)
    const claves = columnasDelRanking('PERFIL_INTEGRAL', trae).map((c) => c.clave)
    expect(claves).toContain('ciudad')
    expect(claves).toContain('pretension')
    expect(pretensionDicha(ESCENARIO[1]!)).toBe('S/ 2,500 – 3,000')
  })

  it('cada pretensión del escenario se escribe de una sola forma, y la no declarada es un guion', () => {
    expect(ESCENARIO.map(pretensionDicha)).toEqual([
      'S/ 3,100 – 3,600',
      'S/ 2,500 – 3,000',
      null,
      'S/ 4,000 – 5,200',
    ])
  })

  it('vacante 8: la Pretensión desaparece y se explica por qué', () => {
    const sinPretension = ESCENARIO.map((f) => ({
      ...f,
      pretensionMin: null,
      pretensionMax: null,
      pretensionMoneda: null,
    }))
    const trae = queTraeLaTanda(sinPretension)
    expect(trae.hayPretension).toBe(false)
    // La ciudad SÍ la traen, así que esa columna se queda.
    expect(trae.hayCiudad).toBe(true)
    const claves = columnasDelRanking('PERFIL_INTEGRAL', trae).map((c) => c.clave)
    expect(claves).not.toContain('pretension')
    expect(claves).toContain('ciudad')
    // Y se dice el motivo correcto: nadie la declaró, no que esté oculta.
    expect(porQueNoHayPretension(true)).toContain('Ninguno de estos candidatos declaró pretensión salarial')
  })
})

describe('01-regresion-panel · las tres etapas que no exportan no enseñan el botón de Excel', () => {
  it('solo Perfil integral y Prueba del puesto exportan', () => {
    const exportan = ETAPAS_PANEL.filter((e) => seExportaAExcel(e.codigo)).map((e) => e.nombre)
    expect(exportan).toEqual(['Perfil integral', 'Prueba del puesto'])
    for (const nombre of ['Simulación', 'Validación', 'Decisión']) {
      expect(exportan).not.toContain(nombre)
    }
  })
})

describe('13-etapas · en las cinco pestañas, la celda de la nota empieza por la cifra o por su guion', () => {
  it('quien no tiene nota de la etapa lleva un porqué corto, que nunca empieza por una cifra', () => {
    for (const etapa of ETAPAS_PANEL) {
      for (const f of ESCENARIO) {
        const sinNota = { ...f, notaEtapa: null }
        const porque = porQueNoHayNotaCorto(sinNota, etapa.codigo)
        expect(porque, `${f.candidato} en ${etapa.nombre}`).not.toBe('')
        expect(porque).not.toMatch(/^\d/)
      }
    }
  })
})

describe('20-prueba-y-empresas · el ranking, etapa por etapa', () => {
  it('la nota se llama por su etapa en el título, y las dimensiones del CV no son columnas', () => {
    const enPerfil = columnasDelRanking('PERFIL_INTEGRAL', queTraeLaTanda(ESCENARIO))
    const enPrueba = columnasDelRanking('PRUEBA_PUESTO', queTraeLaTanda(ESCENARIO))
    expect(enPerfil.find((c) => c.clave === 'nota')?.completo).toBe('Nota del perfil')
    expect(enPrueba.find((c) => c.clave === 'nota')?.completo).toBe('Nota de la prueba')
    // El retrato del currículum se lee en la ficha, no en la tabla, en ninguna etapa.
    for (const columnas of [enPerfil, enPrueba]) {
      const titulos = columnas.map((c) => c.titulo)
      expect(titulos).not.toContain('Adecuación')
      expect(titulos).not.toContain('Potencial')
    }
  })
})

describe('33-filtros-y-seleccion-en-lote · fecha y selección', () => {
  it('«Desde» después de «Hasta» no se aplica y se avisa junto a los campos', () => {
    const alReves = con({ fechaModo: 'rango', fechaDesde: '2026-09-15', fechaHasta: '2026-09-12' })
    expect(rangoDeFechaAlReves(alReves)).toBe(true)
    expect(hayFiltroDeFecha(alReves)).toBe(false)
    expect(filtrarFino(ESCENARIO, alReves)).toHaveLength(4)
    // Ni insignia ni etiqueta: el botón dice «Filtros» a secas.
    expect(filtrosActivos(alReves, 'PERFIL_INTEGRAL', CIUDADES, 2026)).toEqual([])
  })

  it('«Últimos 7 días» rellena de hoy − 6 a hoy', () => {
    expect(atajoDeFecha('ultimos-7', '2026-09-25')).toEqual({ desde: '2026-09-19', hasta: '2026-09-25' })
    // Cruzando el mes, contando días del calendario.
    expect(atajoDeFecha('ultimos-7', '2026-10-03')).toEqual({ desde: '2026-09-27', hasta: '2026-10-03' })
  })

  it('marcar todo con un filtro puesto y avanzar: solo avanzan las que se ven', () => {
    const visibles = ids(filtrarFino(ESCENARIO, con({ ciudades: ['1501'] })))
    expect(visibles).toEqual([1]) // Camila
    const marcadas = alternarMarcarTodo(new Set(), visibles)
    expect([...marcadas]).toEqual([1])

    // Quitando el filtro, las ocultas siguen sin marcar: marcar todo no las tocó.
    const todas = ids(ESCENARIO)
    expect(estadoDeMarcarTodo(marcadas, todas)).toBe('algunas')
    expect(marcasFueraDeVista(marcadas, todas, todas)).toEqual([])
    // Y lo que se manda a avanzar es exactamente lo marcado que se ve.
    expect(todas.filter((id) => marcadas.has(id))).toEqual([1])
  })

  it('marcar todo funciona igual en dos etapas distintas', () => {
    for (const etapa of ['PERFIL_INTEGRAL', 'PRUEBA_PUESTO'] as const) {
      const visibles = ids(filtrar(ESCENARIO, etapa, 'toda'))
      const todas = alternarMarcarTodo(new Set(), visibles)
      expect(todas.size).toBe(visibles.length)
      expect(estadoDeMarcarTodo(todas, visibles)).toBe('todas')
      // Con una suelta, la cabecera queda en intermedio.
      const menosUna = new Set(todas)
      menosUna.delete(visibles[0]!)
      expect(estadoDeMarcarTodo(menosUna, visibles)).toBe('algunas')
      // Y con todas marcadas, pulsarla las suelta.
      expect(alternarMarcarTodo(todas, visibles).size).toBe(0)
    }
  })
})

describe('34-filtros-y-seleccion-qa · una fila sin fecha de postulación (nula o ausente) queda fuera de un rango que abarca todo', () => {
  it('la nula y la ausente quedan fuera; las que tienen fecha, dentro', () => {
    const [conFechaA, conFechaB, nula, ausente] = ESCENARIO.map((f) => ({ ...f, postuladoEn: '2026-09-20T15:00:00Z' }))
    const tanda: FilaRanking[] = [
      conFechaA!,
      conFechaB!,
      { ...nula!, postuladoEn: null },
      (({ postuladoEn: _sinCampo, ...resto }) => resto)(ausente!),
    ]
    const quedan = nombres(filtrarFino(tanda, con({ fechaModo: 'rango', fechaDesde: '2000-01-01' })))
    expect(quedan).toEqual([conFechaA!.candidato, conFechaB!.candidato])
  })
})
