/**
 * Las reglas del ranking, sin pintar nada.
 *
 * Lo que compila perfectamente estando mal:
 *
 *   1. **Explicar un guion con `estadoCalificacion`.** Es el estado de la cola
 *      que califica el CURRICULUM con IA, asi que en la pestaña de la prueba un
 *      `TERMINADA` dice que el CV esta calificado y no dice nada de la prueba.
 *      Es literalmente el origen de la queja —«están calificados pero no se ve
 *      su nota»— y usarlo para explicarla seria repetir el fallo.
 *   2. **Contar de lo que se pinta.** El recuento de cada corte sale de las
 *      filas sin filtrar; derivarlo de lo visible haria que «Con nota» dijera
 *      siempre «12 de 12», la misma trampa del conteo de una sesion frente a la
 *      longitud de su lista de inscritos.
 *   3. **Dar por hecho que los dos primeros cortes se parecen.** No: fuera del
 *      perfil integral son casi disjuntos, y ese es el motivo de que hagan
 *      falta los dos.
 */

import { describe, expect, it } from 'vitest'
import {
  alternarOrden,
  ciudadesDelRanking,
  cifrasDeLaEtapa,
  columnasDelRanking,
  comoSeOrdena,
  CORTE_DE_LA_TANDA,
  criteriosDeLaTanda,
  criteriosQueSePintan,
  columnasVisibles,
  inicialesDeLaTanda,
  cuantoCubre,
  notaEscrita,
  noPondera,
  describirFiltro,
  esDelCurriculum,
  estadoEnDos,
  filtrar,
  filtrarFino,
  indiceDeLaEtapaDe,
  nombreDelGrupo,
  ordenar,
  porQueNoHayNota,
  POR_QUE_NO_HAY_CIUDAD,
  porQueNoHayPretension,
  pretensionDicha,
  pretensionParaOrdenar,
  queTraeLaTanda,
  recuentos,
  resumenDeLaTanda,
  rotuloCorto,
  seExportaAExcel,
  SIN_FILTROS,
  notaDelCriterio,
  tonoDelCriterio,
} from './ranking'
import type { FilaRanking, NotaCriterio } from '../api/tipos'

/** Una nota de criterio con lo justo: el nombre, lo que sacó y sobre cuánto. */
const nota = (
  criterio: string,
  puntaje: number | null,
  maximo: number | null = 100,
  extra: Partial<NotaCriterio> = {},
): NotaCriterio => ({
  criterio,
  codigo: `CV_${criterio.split(' ')[0]!.toLocaleUpperCase('es')}`,
  puntaje,
  maximo,
  peso: 10,
  explicacion: null,
  origen: 'AGENTE',
  confianza: null,
  motivoAjuste: null,
  ...extra,
})

/**
 * Una fila con lo justo.
 *
 * `extra` existe para las pruebas de orden y filtro: escribir ahí el nombre, la
 * ciudad o la pretensión evita repetir los veinticinco campos en cada caso, y
 * deja a la vista SOLO lo que ese caso está midiendo.
 */
const fila = (
  estado: string,
  notaEtapa: number | null,
  extra: Partial<FilaRanking> = {},
): FilaRanking => ({
  puesto: 1,
  postulacionId: 1,
  uuid: 'p1',
  candidato: 'Quien sea',
  correo: 'quien@example.com',
  estado,
  estadoNombre: estado,
  /* ⚠️ El de la cola del CURRÍCULUM, no de esta etapa: aquí está a propósito
     en TERMINADA para que ninguna regla pueda apoyarse en él. */
  estadoCalificacion: 'TERMINADA',
  pasada: 'FINA',
  archivoNombre: null,
  grupoPrioridad: null,
  /* ⚠️ Nulas por defecto, que es lo que trae HOY la base entera: la ciudad solo
     se le pide a quien crea cuenta desde ahora, y la pretensión es opcional en
     el perfil. Una fixtura que las diera siempre puestas probaría un producto
     que no existe. */
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

describe('en qué etapa está parada una postulación', () => {
  it('POSTULADA cuenta como perfil integral: todavía no ha hecho nada más', () => {
    expect(indiceDeLaEtapaDe('POSTULADA')).toBe(0)
  })

  it('los tres estados finales no están en ninguna etapa', () => {
    for (const estado of ['CONTRATADO', 'NO_CONTINUA', 'CERRADA']) {
      expect(indiceDeLaEtapaDe(estado)).toBeNull()
    }
  })

  it('cada prefijo cae en su etapa', () => {
    expect(indiceDeLaEtapaDe('PRUEBA_TURNO_CANDIDATO')).toBe(1)
    expect(indiceDeLaEtapaDe('SIMULACION_POR_HABILITAR')).toBe(2)
    expect(indiceDeLaEtapaDe('VALIDACION_POR_CONFIRMAR')).toBe(3)
    expect(indiceDeLaEtapaDe('DECISION_TURNO_CANDIDATO')).toBe(4)
  })
})

describe('por qué esa nota está vacía', () => {
  /*
    El caso que provocó todo esto: en la pestaña de la prueba, alguien con el
    currículum calificado y sin nota de la prueba. `estadoCalificacion` dice
    TERMINADA en las cinco filas de aquí abajo, así que si alguna respuesta se
    apoyara en él, todas dirían lo mismo.
  */
  it('quien está aquí ahora y le toca a él: aún no la ha hecho', () => {
    expect(porQueNoHayNota(fila('PRUEBA_TURNO_CANDIDATO', null), 'PRUEBA_PUESTO')).toMatch(
      /aún no la ha hecho/,
    )
  })

  /*
    ⚠️ Antes decía «Calificándose ahora mismo», y eso afirma que el sistema
    está trabajando. Puede que nadie haya pedido la calificación, o que esté
    calificada entera y solo falte ponderarla — el paso que produce la nota.
    Desde el ranking no se distinguen, así que el motivo manda a la ficha en
    vez de inventar quién trabaja.
  */
  it('quien ya la hizo no afirma que se esté calificando: manda a la ficha', () => {
    const dicho = porQueNoHayNota(fila('PRUEBA_CALIFICANDO', null), 'PRUEBA_PUESTO')
    expect(dicho).toMatch(/Ya la hizo/)
    expect(dicho).not.toMatch(/ahora mismo/)
  })

  it('quien la hizo y espera al equipo lo dice, y no es lo mismo', () => {
    expect(porQueNoHayNota(fila('PRUEBA_POR_CONFIRMAR', null), 'PRUEBA_PUESTO')).toMatch(
      /pendiente de que el equipo/,
    )
  })

  /*
    ⚠️ **No se puede decir «todavía no llega» ni «ya pasó»**: el estado
    retrocede. Comprobado contra el backend vivo — las postulaciones 16 y 18
    hicieron `PRUEBA_CALIFICANDO → PERFIL_CALIFICANDO`, o sea rindieron la
    prueba y volvieron al perfil. Sobre la 16, que tiene sus siete criterios de
    prueba calificados, «todavía no llega a la prueba» es falso.
  */
  it('quien está en otra etapa dice en cuál, sin afirmar si ya pasó por esta', () => {
    expect(porQueNoHayNota(fila('PERFIL_TURNO_CANDIDATO', null), 'SIMULACION')).toBe(
      'Su proceso está en Perfil integral',
    )
  })

  it('y da igual si su etapa va antes o después: el estado no es monótono', () => {
    const antes = porQueNoHayNota(fila('PERFIL_TURNO_CANDIDATO', null), 'PRUEBA_PUESTO')
    const despues = porQueNoHayNota(fila('SIMULACION_TURNO_CANDIDATO', null), 'PRUEBA_PUESTO')
    expect(antes).toBe('Su proceso está en Perfil integral')
    expect(despues).toBe('Su proceso está en Simulación')
    for (const dicho of [antes, despues]) {
      expect(dicho).not.toMatch(/todavía no llega|ya pasó|Pasó de/i)
    }
  })

  it('quien terminó su proceso lo dice, y no se confunde con las otras cuatro', () => {
    expect(porQueNoHayNota(fila('NO_CONTINUA', null), 'PRUEBA_PUESTO')).toMatch(/Terminó su proceso/)
  })

  it('las respuestas son distintas: un guion con seis nombres iguales no explica nada', () => {
    const dichas = [
      porQueNoHayNota(fila('PRUEBA_TURNO_CANDIDATO', null), 'PRUEBA_PUESTO'),
      porQueNoHayNota(fila('PRUEBA_CALIFICANDO', null), 'PRUEBA_PUESTO'),
      porQueNoHayNota(fila('PRUEBA_POR_CONFIRMAR', null), 'PRUEBA_PUESTO'),
      porQueNoHayNota(fila('PERFIL_TURNO_CANDIDATO', null), 'SIMULACION'),
      porQueNoHayNota(fila('SIMULACION_TURNO_CANDIDATO', null), 'PRUEBA_PUESTO'),
      porQueNoHayNota(fila('NO_CONTINUA', null), 'PRUEBA_PUESTO'),
    ]
    expect(new Set(dichas).size).toBe(6)
  })

  it('«por habilitar» es del equipo y no de la persona', () => {
    expect(porQueNoHayNota(fila('SIMULACION_POR_HABILITAR', null), 'SIMULACION')).toMatch(
      /El equipo no la ha habilitado/,
    )
  })
})

describe('los tres cortes', () => {
  /*
    El caso de verdad, medido en la vacante 3 contra el backend vivo: en la
    prueba, quien está ahí ahora es quien TODAVÍA no la ha rendido, y quien
    tiene nota ya pasó de largo. Sin una sola persona en común.
  */
  const TANDA = [
    fila('PRUEBA_TURNO_CANDIDATO', null), // aquí ahora, sin nota
    fila('SIMULACION_TURNO_CANDIDATO', 75), // con nota de la prueba, ya pasó
    fila('PERFIL_POR_CONFIRMAR', null), // ni una cosa ni la otra
    fila('NO_CONTINUA', 40), // terminada, con nota
  ]

  it('«con nota» y «está aquí ahora» no se solapan en la prueba', () => {
    const conNota = filtrar(TANDA, 'PRUEBA_PUESTO', 'con-nota')
    const aqui = filtrar(TANDA, 'PRUEBA_PUESTO', 'aqui-ahora')
    expect(conNota).toHaveLength(2)
    expect(aqui).toHaveLength(1)
    expect(conNota.some((f) => aqui.includes(f))).toBe(false)
  })

  it('«toda la tanda» no filtra nada, ni a quien terminó', () => {
    expect(filtrar(TANDA, 'PRUEBA_PUESTO', 'toda')).toHaveLength(4)
  })

  it('los recuentos salen de las filas, no de lo que se ve', () => {
    expect(recuentos(TANDA, 'PRUEBA_PUESTO')).toEqual({
      'con-nota': 2,
      'aqui-ahora': 1,
      toda: 4,
    })
  })

  it('el mismo listado da recuentos distintos según la pestaña', () => {
    expect(recuentos(TANDA, 'PERFIL_INTEGRAL')['aqui-ahora']).toBe(1)
    expect(recuentos(TANDA, 'SIMULACION')['aqui-ahora']).toBe(1)
    expect(recuentos(TANDA, 'VALIDACION')['aqui-ahora']).toBe(0)
  })
})

describe('las cifras de la etapa', () => {
  it('cuenta con y sin nota de la etapa, no la cola del currículum', () => {
    const cifras = cifrasDeLaEtapa(
      [
        fila('PRUEBA_TURNO_CANDIDATO', null),
        fila('PRUEBA_POR_CONFIRMAR', null),
        fila('SIMULACION_TURNO_CANDIDATO', 75),
      ],
      'PRUEBA_PUESTO',
    )
    expect(cifras).toEqual({
      conNota: 1,
      sinNota: 2,
      esperandoALaPersona: 1,
      hechasSinNota: 1,
      enOtraEtapa: 0,
    })
  })

  /*
    ⚠️ El caso que se perdía. En una vacante real de 78: 51 sin hacerla, 15 en
    `PRUEBA_CALIFICANDO` y 4 en `PRUEBA_POR_CONFIRMAR`. Con dos categorías la
    cabecera decía «51 esperando a la persona · 4 esperando al equipo» y **los
    15 no salían en ninguna**, que son justo los que rindieron y siguen sin
    nota — los mismos a los que alcanza el bloque de arriba de la tabla.
  */
  it('quien se está calificando cuenta: antes no salía en ninguna categoría', () => {
    const cifras = cifrasDeLaEtapa(
      [
        fila('PRUEBA_CALIFICANDO', null),
        fila('PRUEBA_POR_CONFIRMAR', null),
        fila('PRUEBA_TURNO_CANDIDATO', null),
      ],
      'PRUEBA_PUESTO',
    )
    expect(cifras.hechasSinNota).toBe(2)
    expect(cifras.esperandoALaPersona).toBe(1)
  })

  it('las tres categorías suman siempre las que no tienen nota', () => {
    const tanda = [
      fila('PRUEBA_TURNO_CANDIDATO', null),
      fila('PRUEBA_CALIFICANDO', null),
      fila('PRUEBA_POR_CONFIRMAR', null),
      fila('PERFIL_TURNO_CANDIDATO', null),
      fila('NO_CONTINUA', null),
      fila('SIMULACION_TURNO_CANDIDATO', 75),
    ]
    const c = cifrasDeLaEtapa(tanda, 'PRUEBA_PUESTO')
    expect(c.esperandoALaPersona + c.hechasSinNota + c.enOtraEtapa).toBe(c.sinNota)
    expect(c.conNota + c.sinNota).toBe(tanda.length)
  })

  it('quien no está en la etapa no cuenta como espera de nadie', () => {
    // Ya pasó de la prueba sin nota: no se le espera aquí, y decir que sí
    // mandaría al equipo a buscar una prueba que nadie va a rendir.
    const cifras = cifrasDeLaEtapa([fila('SIMULACION_TURNO_CANDIDATO', null)], 'PRUEBA_PUESTO')
    expect(cifras.sinNota).toBe(1)
    expect(cifras.esperandoALaPersona).toBe(0)
    expect(cifras.hechasSinNota).toBe(0)
    expect(cifras.enOtraEtapa).toBe(1)
  })
})

describe('qué columnas son del currículum', () => {
  it('solo perfil integral y decisión', () => {
    expect(esDelCurriculum('PERFIL_INTEGRAL')).toBe(true)
    expect(esDelCurriculum('DECISION')).toBe(true)
    for (const otra of ['PRUEBA_PUESTO', 'SIMULACION', 'VALIDACION'] as const) {
      expect(esDelCurriculum(otra)).toBe(false)
    }
  })
})

// ---------- Ordenar ----------

const nombres = (filas: FilaRanking[]) => filas.map((f) => f.candidato)

describe('los vacíos van al final, suba o baje el orden', () => {
  /*
    ⚠️ **Es la regla que se rompe sola.** Ordenar y luego dar la vuelta al array
    es lo que sale natural y es exactamente lo que no vale: al pulsar
    «descendente» los huecos suben a la primera pantalla y la mesa de decidir
    empieza con las filas que no tienen el dato. Por eso cada columna se prueba
    en los DOS sentidos.
  */
  const conNota = [
    fila('POSTULADA', 70, { candidato: 'Con setenta' }),
    fila('POSTULADA', null, { candidato: 'Sin nota' }),
    fila('POSTULADA', 90, { candidato: 'Con noventa' }),
  ]

  it('la nota vacía queda abajo con el orden de mayor a menor', () => {
    expect(nombres(ordenar(conNota, { columna: 'nota', sentido: 'desc' }))).toEqual([
      'Con noventa',
      'Con setenta',
      'Sin nota',
    ])
  })

  it('y también de menor a mayor, que es donde falla el `.reverse()`', () => {
    expect(nombres(ordenar(conNota, { columna: 'nota', sentido: 'asc' }))).toEqual([
      'Con setenta',
      'Con noventa',
      'Sin nota',
    ])
  })

  it('la ciudad sin declarar queda abajo en los dos sentidos', () => {
    const tanda = [
      fila('POSTULADA', null, { candidato: 'Sin ciudad' }),
      fila('POSTULADA', null, { candidato: 'De Lima', ciudad: 'Lima — Lima', ciudadCodigo: '1501' }),
      fila('POSTULADA', null, {
        candidato: 'De Camaná',
        ciudad: 'Arequipa — Camaná',
        ciudadCodigo: '0402',
      }),
    ]
    expect(nombres(ordenar(tanda, { columna: 'ciudad', sentido: 'asc' }))).toEqual([
      'De Camaná',
      'De Lima',
      'Sin ciudad',
    ])
    expect(nombres(ordenar(tanda, { columna: 'ciudad', sentido: 'desc' }))).toEqual([
      'De Lima',
      'De Camaná',
      'Sin ciudad',
    ])
  })

  it('la pretensión sin declarar queda abajo en los dos sentidos', () => {
    const tanda = [
      fila('POSTULADA', null, { candidato: 'Sin pedir' }),
      fila('POSTULADA', null, { candidato: 'Pide 4000', pretensionMin: 4000 }),
      fila('POSTULADA', null, { candidato: 'Pide 2000', pretensionMin: 2000 }),
    ]
    expect(nombres(ordenar(tanda, { columna: 'pretension', sentido: 'asc' }))).toEqual([
      'Pide 2000',
      'Pide 4000',
      'Sin pedir',
    ])
    expect(nombres(ordenar(tanda, { columna: 'pretension', sentido: 'desc' }))).toEqual([
      'Pide 4000',
      'Pide 2000',
      'Sin pedir',
    ])
  })
})

describe('ordenar por nota manda la nota, y nada más', () => {
  /*
    Esto ordenaba la nota DENTRO de cada grupo de prioridad, para que un 95 con
    riesgo crítico no mandara sobre un 60 limpio. Se quitó al ver quién escribe
    ese grupo: la IA solo pone ALTA (nota ≥ 80 y sin riesgo), POTENCIAL_CON_RIESGO
    (nota ≥ 65, o potencial ≥ 80) y NO_PRIORIZADO. Los tres cuelgan de la nota, así
    que grupo y nota casi siempre van en el mismo sentido. Y INCOMPATIBLE, el
    único que sí podía contradecirla, NO LO ESCRIBE NADIE: quien falla un
    requisito indispensable se cierra como NO_CONTINUA sin llegar a tener grupo.

    Lo que sí producía era una mesa ordenada 55, 74, 61, 95 que se lee como rota.
    Un orden que hay que explicar no está ordenando.
  */
  const MEZCLADOS = [
    fila('POSTULADA', 60, { candidato: 'Alta 60', grupoPrioridad: 'ALTA' }),
    fila('POSTULADA', 95, { candidato: 'Riesgo 95', grupoPrioridad: 'POTENCIAL_CON_RIESGO' }),
    fila('POSTULADA', 88, { candidato: 'Alta 88', grupoPrioridad: 'ALTA' }),
    fila('POSTULADA', 70, { candidato: 'Riesgo 70', grupoPrioridad: 'POTENCIAL_CON_RIESGO' }),
  ]

  it('de mayor a menor: manda la nota aunque cruce grupos', () => {
    expect(nombres(ordenar(MEZCLADOS, { columna: 'nota', sentido: 'desc' }))).toEqual([
      'Riesgo 95',
      'Alta 88',
      'Riesgo 70',
      'Alta 60',
    ])
  })

  it('de menor a mayor, lo mismo al revés', () => {
    expect(nombres(ordenar(MEZCLADOS, { columna: 'nota', sentido: 'asc' }))).toEqual([
      'Alta 60',
      'Riesgo 70',
      'Alta 88',
      'Riesgo 95',
    ])
  })

  /*
    El grupo deja de gobernar el orden, pero NO desaparece: se sigue pintando en
    cada fila. Quien mira sabe que ese 95 arrastra un riesgo; lo que ya no pasa es
    que su fila caiga en un sitio que nadie entiende.
  */
  it('el grupo ya no mueve a nadie de sitio', () => {
    const tanda = [
      fila('POSTULADA', 99, { candidato: 'Sin grupo', grupoPrioridad: null }),
      fila('POSTULADA', 41, { candidato: 'Alta', grupoPrioridad: 'ALTA' }),
    ]
    expect(nombres(ordenar(tanda, { columna: 'nota', sentido: 'desc' }))).toEqual([
      'Sin grupo',
      'Alta',
    ])
  })

  /*
    Y sin nota sigue yendo al final, que es la regla que NO cambia: una fila sin
    nota no es un cero, y ponerla arriba llena de huecos la mesa de decidir.
  */
  it('sin nota, al final, suba o baje el orden', () => {
    const tanda = [
      fila('POSTULADA', null, { candidato: 'Sin nota' }),
      fila('POSTULADA', 10, { candidato: 'Con 10' }),
      fila('POSTULADA', 90, { candidato: 'Con 90' }),
    ]
    expect(nombres(ordenar(tanda, { columna: 'nota', sentido: 'desc' }))).toEqual([
      'Con 90',
      'Con 10',
      'Sin nota',
    ])
    expect(nombres(ordenar(tanda, { columna: 'nota', sentido: 'asc' }))).toEqual([
      'Con 10',
      'Con 90',
      'Sin nota',
    ])
  })

  it('ordenar por nombre sigue siendo alfabético y nada más', () => {
    expect(nombres(ordenar(MEZCLADOS, { columna: 'nombre', sentido: 'asc' }))).toEqual([
      'Alta 60',
      'Alta 88',
      'Riesgo 70',
      'Riesgo 95',
    ])
  })
})

describe('ordenar no toca la lista que le dan', () => {
  /*
    ⚠️ `filas` es el array que guarda react-query en su caché. Un `.sort()`
    encima lo reordena para todo el que lo lea después —incluidas las cifras de
    la cabecera— y el estropicio sobrevive a cambiar de pestaña.
  */
  it('devuelve una copia y deja la original en su orden', () => {
    const original = [
      fila('POSTULADA', 10, { candidato: 'Primera' }),
      fila('POSTULADA', 90, { candidato: 'Segunda' }),
    ]
    const salida = ordenar(original, { columna: 'nota', sentido: 'desc' })
    expect(nombres(original)).toEqual(['Primera', 'Segunda'])
    expect(nombres(salida)).toEqual(['Segunda', 'Primera'])
    expect(salida).not.toBe(original)
  })

  it('sin orden puesto se devuelve el del backend, tal cual', () => {
    const original = [fila('POSTULADA', 10), fila('POSTULADA', 90)]
    expect(ordenar(original, null)).toBe(original)
  })
})

describe('el alfabeto es el español', () => {
  it('las tildes no mandan a nadie al final de la lista', () => {
    const tanda = [
      fila('POSTULADA', null, { candidato: 'Zurita' }),
      fila('POSTULADA', null, { candidato: 'Ávila' }),
      fila('POSTULADA', null, { candidato: 'Blanco' }),
    ]
    expect(nombres(ordenar(tanda, { columna: 'nombre', sentido: 'asc' }))).toEqual([
      'Ávila',
      'Blanco',
      'Zurita',
    ])
  })
})

describe('el clic en la cabecera', () => {
  it('la nota abre por la mayor: pedir el ranking y recibir los ceros es un clic de más', () => {
    expect(alternarOrden(null, 'nota')).toEqual({ columna: 'nota', sentido: 'desc' })
  })

  it('los textos abren de la A a la Z', () => {
    expect(alternarOrden(null, 'nombre')).toEqual({ columna: 'nombre', sentido: 'asc' })
    expect(alternarOrden(null, 'ciudad')).toEqual({ columna: 'ciudad', sentido: 'asc' })
  })

  it('el segundo clic da la vuelta y el tercero devuelve el orden del backend', () => {
    const uno = alternarOrden(null, 'nota')
    const dos = alternarOrden(uno, 'nota')
    expect(dos).toEqual({ columna: 'nota', sentido: 'asc' })
    expect(alternarOrden(dos, 'nota')).toBeNull()
  })

  it('cambiar de columna empieza de cero, no hereda el sentido de la anterior', () => {
    const porNota = alternarOrden(null, 'nota')
    expect(alternarOrden(porNota, 'nombre')).toEqual({ columna: 'nombre', sentido: 'asc' })
  })

  it('`aria-sort` dice lo que hay, y «none» en las demás', () => {
    const orden = { columna: 'nota', sentido: 'desc' } as const
    expect(comoSeOrdena(orden, 'nota')).toBe('descending')
    expect(comoSeOrdena({ columna: 'nota', sentido: 'asc' }, 'nota')).toBe('ascending')
    expect(comoSeOrdena(orden, 'ciudad')).toBe('none')
    expect(comoSeOrdena(null, 'nota')).toBe('none')
  })
})

// ---------- Filtrar ----------

describe('el buscador de nombre', () => {
  const TANDA = [
    fila('POSTULADA', null, { candidato: 'Fátima Quispe' }),
    fila('POSTULADA', null, { candidato: 'Lucía Ferrer' }),
    fila('POSTULADA', null, { candidato: 'Rodrigo Ayala' }),
  ]

  /*
    ⚠️ **Sin esto el buscador nace muerto.** Media tanda peruana se llama Fátima,
    Lucía o Muñoz; quien teclea `fatima` en una caja que compara literales no
    encuentra a nadie y concluye que el filtro está roto.
  */
  it('encuentra a Fátima escribiendo «fatima», sin tilde', () => {
    expect(nombres(filtrarFino(TANDA, { ...SIN_FILTROS, texto: 'fatima' }))).toEqual([
      'Fátima Quispe',
    ])
  })

  it('no distingue mayúsculas ni espacios de sobra', () => {
    expect(nombres(filtrarFino(TANDA, { ...SIN_FILTROS, texto: '  LUCIA  ' }))).toEqual([
      'Lucía Ferrer',
    ])
  })

  it('busca dentro del nombre, no solo por donde empieza', () => {
    expect(nombres(filtrarFino(TANDA, { ...SIN_FILTROS, texto: 'ayala' }))).toEqual([
      'Rodrigo Ayala',
    ])
  })

  it('sin texto no filtra a nadie', () => {
    expect(filtrarFino(TANDA, SIN_FILTROS)).toHaveLength(3)
  })
})

describe('los rangos', () => {
  const TANDA = [
    fila('POSTULADA', 45, { candidato: 'Cuarenta y cinco' }),
    fila('POSTULADA', 80, { candidato: 'Ochenta' }),
    fila('POSTULADA', null, { candidato: 'Sin nota' }),
  ]

  it('un mínimo de nota deja fuera a quien está por debajo', () => {
    expect(nombres(filtrarFino(TANDA, { ...SIN_FILTROS, notaMin: 60 }))).toEqual(['Ochenta'])
  })

  it('los dos extremos son inclusivos', () => {
    expect(nombres(filtrarFino(TANDA, { ...SIN_FILTROS, notaMin: 45, notaMax: 80 }))).toEqual([
      'Cuarenta y cinco',
      'Ochenta',
    ])
  })

  /*
    ⚠️ Quien no tiene nota NO es «≥ 60». Colarlo por si acaso llenaría de huecos
    justo la lista que se acaba de pedir recortar; y vuelve quitando el filtro,
    que es un clic.
  */
  it('quien no tiene nota queda fuera de cualquier rango de nota', () => {
    expect(nombres(filtrarFino(TANDA, { ...SIN_FILTROS, notaMax: 100 }))).not.toContain('Sin nota')
  })

  it('sin rango puesto, quien no tiene nota sigue estando', () => {
    expect(filtrarFino(TANDA, SIN_FILTROS)).toHaveLength(3)
  })
})

describe('el rango de pretensión se cruza por solape', () => {
  /*
    ⚠️ **Solape y no contención.** Quien solo dijo «desde 2,000» tiene que salir
    cuando se busca «hasta 2,500»: su suelo cabe en el presupuesto. Exigir que su
    rango entero quepa dentro del buscado dejaría fuera a todo el que declaró un
    solo extremo, que son la mayoría.
  */
  const TANDA = [
    fila('POSTULADA', null, {
      candidato: 'Pide 2000 a 3000',
      pretensionMin: 2000,
      pretensionMax: 3000,
    }),
    fila('POSTULADA', null, { candidato: 'Pide desde 5000', pretensionMin: 5000 }),
    fila('POSTULADA', null, { candidato: 'Pide hasta 1500', pretensionMax: 1500 }),
    fila('POSTULADA', null, { candidato: 'No lo dijo' }),
  ]

  it('una banda que toca su rango lo trae', () => {
    expect(nombres(filtrarFino(TANDA, { ...SIN_FILTROS, pretensionMin: 2800, pretensionMax: 4000 })))
      .toEqual(['Pide 2000 a 3000'])
  })

  it('quien pide muy por encima de la banda queda fuera', () => {
    expect(
      nombres(filtrarFino(TANDA, { ...SIN_FILTROS, pretensionMax: 3000 })),
    ).toEqual(['Pide 2000 a 3000', 'Pide hasta 1500'])
  })

  it('quien solo declaró un extremo entra si ese extremo cabe', () => {
    expect(nombres(filtrarFino(TANDA, { ...SIN_FILTROS, pretensionMin: 4500 }))).toEqual([
      'Pide desde 5000',
    ])
  })

  it('quien no la declaró queda fuera en cuanto hay banda', () => {
    expect(nombres(filtrarFino(TANDA, { ...SIN_FILTROS, pretensionMin: 0 }))).not.toContain(
      'No lo dijo',
    )
  })
})

describe('el filtro de ciudad', () => {
  const LIMA = { ciudad: 'Lima — Lima', ciudadCodigo: '1501' }
  const CAMANA = { ciudad: 'Arequipa — Camaná', ciudadCodigo: '0402' }
  const TANDA = [
    fila('POSTULADA', null, { candidato: 'De Lima', ...LIMA }),
    fila('POSTULADA', null, { candidato: 'De Camaná', ...CAMANA }),
    fila('POSTULADA', null, { candidato: 'Otra de Lima', ...LIMA }),
    fila('POSTULADA', null, { candidato: 'Sin ciudad' }),
  ]

  it('vacío significa todas, no ninguna', () => {
    expect(filtrarFino(TANDA, SIN_FILTROS)).toHaveLength(4)
  })

  it('se pueden marcar varias a la vez', () => {
    expect(nombres(filtrarFino(TANDA, { ...SIN_FILTROS, ciudades: ['1501', '0402'] }))).toEqual([
      'De Lima',
      'De Camaná',
      'Otra de Lima',
    ])
  })

  it('quien no declaró ciudad no se cuela en ningún filtro de ciudad', () => {
    expect(nombres(filtrarFino(TANDA, { ...SIN_FILTROS, ciudades: ['1501'] }))).not.toContain(
      'Sin ciudad',
    )
  })

  it('la lista de ciudades sale de las filas, con su cuenta y en orden', () => {
    expect(ciudadesDelRanking(TANDA)).toEqual([
      { codigo: '0402', nombre: 'Arequipa — Camaná', cuantas: 1 },
      { codigo: '1501', nombre: 'Lima — Lima', cuantas: 2 },
    ])
  })

  /*
    ⚠️ **El estado que hoy es el normal.** La ciudad solo se le pide a quien crea
    cuenta desde ahora, así que ninguna postulación anterior la tiene. Una lista
    vacía es la señal de que el filtro tiene que decirlo con palabras en vez de
    abrir un desplegable sin nada dentro: es «no prometer lo que el sistema no
    cumple», y servirla del catálogo de ubigeo daría 196 filtros que no
    devuelven a nadie.
  */
  it('sin una sola ciudad declarada, la lista viene vacía y no inventa nada', () => {
    expect(ciudadesDelRanking([fila('POSTULADA', 80), fila('POSTULADA', null)])).toEqual([])
  })
})

// ---------- La pretensión, dicha ----------

describe('la pretensión en una celda', () => {
  const con = (extra: Partial<FilaRanking>) => pretensionDicha(fila('POSTULADA', null, extra))

  it('los dos extremos, con la moneda una sola vez', () => {
    expect(
      con({ pretensionMin: 2500, pretensionMax: 3000, pretensionMoneda: 'PEN' }),
    ).toBe('S/ 2,500 – 3,000')
  })

  it('solo el mínimo dice «desde», y solo el máximo dice «hasta»', () => {
    expect(con({ pretensionMin: 2500, pretensionMoneda: 'PEN' })).toBe('desde S/ 2,500')
    expect(con({ pretensionMax: 3000, pretensionMoneda: 'PEN' })).toBe('hasta S/ 3,000')
  })

  it('en dólares es otro símbolo', () => {
    expect(con({ pretensionMin: 1200, pretensionMax: 1800, pretensionMoneda: 'USD' })).toBe(
      'US$ 1,200 – 1,800',
    )
  })

  /*
    ⚠️ **Sin moneda no se supone soles.** Un candidato que pide 3,000 dólares y
    aparece en la tabla con «S/ 3,000» al lado es una llamada perdida, y el
    error no se ve en ninguna parte porque la cifra es correcta.
  */
  it('con cifras y sin moneda van las cifras solas: no se supone nada', () => {
    expect(con({ pretensionMin: 3000, pretensionMax: 4000 })).toBe('3,000 – 4,000')
  })

  it('una moneda desconocida viaja con su código, no se traga', () => {
    expect(con({ pretensionMin: 3000, pretensionMoneda: 'EUR' })).toBe('desde EUR 3,000')
  })

  it('sin nada declarado es nulo, y la celda pone su guion', () => {
    expect(con({})).toBeNull()
  })

  it('los céntimos no se redondean en silencio', () => {
    expect(con({ pretensionMin: 2500.5, pretensionMoneda: 'PEN' })).toBe('desde S/ 2,500.5')
  })

  it('quien solo declaró el techo se ordena por ese techo, no se va al final', () => {
    expect(pretensionParaOrdenar(fila('POSTULADA', null, { pretensionMax: 3000 }))).toBe(3000)
    expect(pretensionParaOrdenar(fila('POSTULADA', null, {}))).toBeNull()
  })
})

// ---------- Las columnas ----------

describe('cuántas columnas tiene la tabla', () => {
  /*
    ⚠️ **De aquí sale el `colSpan`, y por eso se cuenta aquí.** Estaba escrito a
    mano —«8 : 6»— sobre nueve y siete columnas reales: la fila de detalle y la
    celda del «no hay» medían dos columnas menos que la tabla. Derivado de la
    lista, añadir una columna no puede volver a descuadrarlo.
  */
  /*
    Nueve en las cinco. Adecuación, Potencial y Riesgos dejaron de ser columnas
    —se leen en la ficha, con su explicación al lado— y con ellas se fue lo
    último que cambiaba con la etapa.
  */
  it('nueve en las cinco etapas: ya no hay columnas del retrato del currículum', () => {
    for (const etapa of ['PRUEBA_PUESTO', 'SIMULACION', 'PERFIL_INTEGRAL', 'DECISION'] as const) {
      expect(columnasDelRanking(etapa)).toHaveLength(9)
    }
  })

  /*
    ⚠️ **Veredicto está en las CINCO etapas, y eso es a propósito.** No sale del
    currículum como Adecuación y Potencial: es el grupo de prioridad, que es una
    lectura de la persona y no de la etapa. Meterlo en `esDelCurriculum` lo
    borraría de la mesa de la prueba, que es donde más se decide.
  */
  it('Veredicto está en las cinco, y no es del retrato del currículum', () => {
    for (const etapa of ['PERFIL_INTEGRAL', 'PRUEBA_PUESTO', 'VALIDACION'] as const) {
      expect(columnasDelRanking(etapa).map((c) => c.clave)).toContain('veredicto')
    }
  })

  /*
    ⚠️ **El `colSpan` sale de aquí, y las columnas de criterio lo mueven.** Es el
    fallo clásico de este archivo: se añade una columna y la fila de detalle mide
    menos que la tabla. Con ocho criterios encendidos la diferencia es de ocho, y
    a ojo no se ve —el bloque de dentro solo sale un poco estrecho—.
  */
  it('cada criterio encendido es una columna más, y el colSpan la cuenta', () => {
    const criterios = [
      { nombre: 'Resultados demostrables', rotulo: 'Resultados', inicial: 'R', peso: 25, maximo: 100 },
      { nombre: 'Complejidad y alcance', rotulo: 'Complejidad', inicial: 'C', peso: 20, maximo: 100 },
    ]
    const conCriterios = columnasDelRanking('PERFIL_INTEGRAL', undefined, criterios)
    expect(conCriterios).toHaveLength(9 + 2)
    expect(conCriterios.filter((c) => c.clave.startsWith('criterio:'))).toHaveLength(2)
    // El peso viaja en la columna: es lo que se pinta bajo el título, y sin él
    // un 90 que pesa 25 y uno que pesa 5 se leen igual.
    expect(conCriterios.find((c) => c.clave === 'criterio:Complejidad y alcance')?.peso).toBe(20)
  })

  it('apagado no añade ninguna: la tabla se queda como estaba', () => {
    expect(columnasDelRanking('PERFIL_INTEGRAL', undefined, [])).toHaveLength(9)
  })

  /*
    ⚠️ **De aqui sale el `colSpan`.** Filtrar donde se pinta la cabecera y
    olvidarlo en la fila de detalle es el fallo que este archivo lleva evitando
    desde que la lista existe.
  */
  it('apagar una columna la quita de la lista, y con ella del colSpan', () => {
    const todas = columnasDelRanking('PERFIL_INTEGRAL')
    const menos = columnasVisibles(todas, new Set(['ciudad', 'alertas']))
    expect(menos).toHaveLength(todas.length - 2)
    expect(menos.map((c) => c.clave)).not.toContain('ciudad')
    expect(menos.map((c) => c.clave)).not.toContain('alertas')
  })

  /*
    ⚠️ **Sin la marca de avance no se puede avanzar a nadie, y sin el candidato
    la fila deja de ser de alguien.** Una tabla de cifras sin nombre no se puede
    leer ni corregir, asi que ninguna de las dos se ofrece para apagar.
  */
  it('la marca de avance y el candidato no se pueden apagar', () => {
    const todas = columnasDelRanking('PERFIL_INTEGRAL')
    expect(todas.find((c) => c.clave === 'avance')?.ocultable).toBeFalsy()
    expect(todas.find((c) => c.clave === 'candidato')?.ocultable).toBeFalsy()
    // Aunque alguien las meta en el conjunto, siguen ahi.
    const menos = columnasVisibles(todas, new Set(['avance', 'candidato']))
    expect(menos.map((c) => c.clave)).toContain('candidato')
    expect(menos.map((c) => c.clave)).toContain('avance')
  })

  /*
    ⚠️ **Los tres se leen en la ficha, así que no se pierde nada.** Ocupaban
    248 px para números que no se comparan al barrer la tabla: se miran cuando ya
    elegiste a alguien, y allí van con su explicación.
  */
  it('Adecuación, Potencial y Riesgos ya no son columnas', () => {
    const claves = columnasDelRanking('PERFIL_INTEGRAL').map((c) => c.clave)
    expect(claves).not.toContain('adecuacion')
    expect(claves).not.toContain('potencial')
    expect(claves).not.toContain('riesgos')
    // Alertas se queda: avisa desde la lista de que hay algo que mirar.
    expect(claves).toContain('alertas')
  })

  it('Ciudad y Pretensión están en las cinco etapas: no son del currículum', () => {
    for (const etapa of ['PERFIL_INTEGRAL', 'PRUEBA_PUESTO', 'VALIDACION'] as const) {
      const claves = columnasDelRanking(etapa).map((c) => c.clave)
      expect(claves).toContain('ciudad')
      expect(claves).toContain('pretension')
    }
  })

  /*
    La ciudad se movio al final —separaba el nombre de sus cifras— asi que ahora
    es la ultima ordenable, no la segunda.
  */
  it('se ordena por cuatro, y la ciudad es la ultima', () => {
    const columnas = columnasDelRanking('PRUEBA_PUESTO')
    expect(columnas.filter((c) => c.ordenable).map((c) => c.ordenable)).toEqual([
      'nombre',
      'pretension',
      'nota',
      'ciudad',
    ])
    expect(columnas.at(-1)?.clave).toBe('ciudad')
  })

  /*
    ⚠️ **«Nota» a secas, y la etapa en el titulo emergente.** El rotulo largo
    existia para que cinco pestañas con la misma cabecera no obligaran a recordar
    en cual estas; la pestaña activa ya lo dice justo encima. Lo que NO puede
    pasar es que el dato se pierda: por eso `completo` lo sigue llevando.
  */
  it('la nota se llama «Nota», y su etapa viaja en el titulo', () => {
    const nota = columnasDelRanking('PRUEBA_PUESTO').find((c) => c.clave === 'nota')
    expect(nota?.titulo).toBe('Nota')
    expect(nota?.completo).toBe('Nota de la prueba')
    const enPerfil = columnasDelRanking('PERFIL_INTEGRAL').find((c) => c.clave === 'nota')
    expect(enPerfil?.completo).toBe('Nota del perfil')
  })
})

// ---------- Las cinco cifras de la tanda ----------

describe('las cinco cifras de la tanda', () => {
  /*
    ⚠️ **Ninguna sale de los contadores del backend, y ese es el punto.**
    `calificados` / `enCurso` / `fallidos` son de la cola que califica el
    CURRÍCULUM y salen idénticos en las cinco pestañas: en la de la prueba
    decían «76 calificados» encima de setenta y ocho guiones. Estas se cuentan
    de las filas, que es lo único que sabe de esta etapa.
  */
  it('cuenta solo a quien tiene nota de ESTA etapa', () => {
    const r = resumenDeLaTanda(
      [
        fila('PRUEBA_POR_CONFIRMAR', 80),
        fila('PRUEBA_CALIFICANDO', null),
        fila('POSTULADA', 60),
      ],
      'PRUEBA_PUESTO',
    )
    expect(r.conNota).toBe(2)
  })

  it('la mediana impar es el valor de en medio', () => {
    // Desordenadas a propósito: la mediana no puede depender del orden de llegada.
    const r = resumenDeLaTanda(
      [fila('POSTULADA', 90), fila('POSTULADA', 50), fila('POSTULADA', 70)],
      'PERFIL_INTEGRAL',
    )
    expect(r.mediana).toBe(70)
  })

  it('la mediana par es el promedio de las dos de en medio', () => {
    const r = resumenDeLaTanda(
      [
        fila('POSTULADA', 40),
        fila('POSTULADA', 60),
        fila('POSTULADA', 70),
        fila('POSTULADA', 90),
      ],
      'PERFIL_INTEGRAL',
    )
    expect(r.mediana).toBe(65)
  })

  /*
    ⚠️ **Los huecos no entran en la media.** Contarlos como cero hundiría el
    promedio de una tanda a medio calificar y lo pintaría como una tanda mala.
    Un cero es un juicio; un hueco es que nadie ha mirado todavía.
  */
  it('la media ignora a quien no tiene nota, no lo cuenta como cero', () => {
    const r = resumenDeLaTanda(
      [fila('POSTULADA', 80), fila('POSTULADA', 60), fila('POSTULADA', null)],
      'PERFIL_INTEGRAL',
    )
    expect(r.media).toBe(70)
  })

  it('la media va con un decimal, como el informe del que sale', () => {
    const r = resumenDeLaTanda(
      [fila('POSTULADA', 80), fila('POSTULADA', 61), fila('POSTULADA', 51)],
      'PERFIL_INTEGRAL',
    )
    expect(r.media).toBe(64)
    const otra = resumenDeLaTanda(
      [fila('POSTULADA', 66), fila('POSTULADA', 61)],
      'PERFIL_INTEGRAL',
    )
    expect(otra.media).toBe(63.5)
  })

  it('el corte es inclusivo: quien saca justo 70 llega', () => {
    const r = resumenDeLaTanda(
      [
        fila('POSTULADA', CORTE_DE_LA_TANDA),
        fila('POSTULADA', CORTE_DE_LA_TANDA - 1),
        fila('POSTULADA', 95),
      ],
      'PERFIL_INTEGRAL',
    )
    expect(r.lleganAlCorte).toBe(2)
  })

  /*
    ⚠️ **«Aún calificando» es quien YA la hizo y sigue sin nota**, no quien no la
    ha hecho ni quien está en otra etapa. Es la cifra accionable: de esas
    personas el equipo tiene trabajo pendiente.
  */
  it('«aún calificando» son los que ya la hicieron y siguen sin nota', () => {
    const r = resumenDeLaTanda(
      [
        fila('PRUEBA_CALIFICANDO', null),
        fila('PRUEBA_POR_CONFIRMAR', null),
        fila('PRUEBA_TURNO_CANDIDATO', null),
        fila('PERFIL_CALIFICANDO', null),
        fila('PRUEBA_POR_CONFIRMAR', 80),
      ],
      'PRUEBA_PUESTO',
    )
    expect(r.calificando).toBe(2)
  })

  it('sin nadie calificado no inventa un cero: la mediana y la media son nulas', () => {
    const r = resumenDeLaTanda([fila('POSTULADA', null)], 'PERFIL_INTEGRAL')
    expect(r.mediana).toBeNull()
    expect(r.media).toBeNull()
    expect(r.lleganAlCorte).toBe(0)
  })

  it('con la tanda vacía tampoco revienta', () => {
    expect(resumenDeLaTanda([], 'PERFIL_INTEGRAL')).toEqual({
      conNota: 0,
      mediana: null,
      media: null,
      lleganAlCorte: 0,
      calificando: 0,
    })
  })
})

// ---------- Los criterios como columnas de color ----------

describe('el mapa de calor de los criterios', () => {
  /*
    ⚠️ **El rótulo corto no es cosmética: es lo que decide el ancho de la
    columna, y el ancho decide si la tabla cabe en la pantalla.** Debajo solo hay
    dos dígitos y encima cabía «Resultados demostrables».
  */
  it('el rótulo sale del código, sin el prefijo que llevan los ocho', () => {
    expect(rotuloCorto('CV_RESULTADOS', 'Resultados demostrables')).toBe('Resultados')
    expect(rotuloCorto('CV_HABILIDADES', 'Habilidades del puesto')).toBe('Habilidades')
    // Los de una prueba del puesto no llevan prefijo: se quedan como están.
    expect(rotuloCorto('CAJA', 'Manejo y control de caja')).toBe('Caja')
    expect(rotuloCorto('DIVISAS', 'Conocimiento del negocio de divisas')).toBe('Divisas')
  })

  it('un código de varias palabras se lee como una frase, no como una constante', () => {
    expect(rotuloCorto('CV_ALTO_RENDIMIENTO', 'Evidencia de alto rendimiento')).toBe(
      'Alto rendimiento',
    )
  })

  /*
    ⚠️ **Sin código se cae al nombre largo, no a un hueco.** Una respuesta
    antigua del backend no trae el campo; una cabecera ancha es peor que una
    corta, pero las dos son mejores que una columna sin nombre.
  */
  it('sin código se cae al nombre largo', () => {
    expect(rotuloCorto(null, 'Resultados demostrables')).toBe('Resultados demostrables')
    expect(rotuloCorto('', 'Resultados demostrables')).toBe('Resultados demostrables')
  })

  it('la columna se rotula con el corto y guarda el largo como clave', () => {
    const criterios = criteriosDeLaTanda([
      fila('POSTULADA', 80, {
        notasCriterio: [
          nota('Resultados demostrables', 20, 25, { codigo: 'CV_RESULTADOS' }),
        ],
      }),
    ])
    expect(criterios[0]).toMatchObject({
      nombre: 'Resultados demostrables',
      rotulo: 'Resultados',
    })
  })

  /*
    ⚠️ **Dos columnas con la misma letra son dos columnas sin nombre.** En el
    curriculum las ocho salen distintas por suerte, pero una rubrica de prueba
    puede traer «Caja» y «Contable»: ahi la segunda tiene que crecer.
  */
  it('las iniciales son distintas entre si, aunque los nombres choquen', () => {
    expect(inicialesDeLaTanda(['Caja', 'Contable', 'Divisas'])).toEqual(['C', 'Co', 'D'])
    // Crece la SEGUNDA, no las dos: la primera ya era legible y cambiarla
    // moveria un rotulo que alguien ya aprendio.
    expect(inicialesDeLaTanda(['Caja', 'Contable'])[0]).toBe('C')
  })

  it('tres que chocan crecen hasta distinguirse', () => {
    expect(inicialesDeLaTanda(['Caja', 'Cartera', 'Contable'])).toEqual(['C', 'Ca', 'Co'])
  })

  it('los ocho del curriculum caen en ocho letras distintas', () => {
    const iniciales = inicialesDeLaTanda([
      'Resultados', 'Complejidad', 'Sistemas', 'Personas',
      'Aprendizaje', 'Iniciativa', 'Habilidades', 'Evidencia',
    ])
    expect(iniciales).toEqual(['R', 'C', 'S', 'P', 'A', 'I', 'H', 'E'])
    expect(new Set(iniciales).size).toBe(8)
  })

  it('un nombre vacio no revienta ni se come la letra de otro', () => {
    expect(inicialesDeLaTanda(['', 'Caja'])).toEqual(['?', 'C'])
  })

  it('la tanda reparte inicial ademas de palabra', () => {
    const criterios = criteriosDeLaTanda([
      fila('POSTULADA', 80, {
        notasCriterio: [
          nota('Resultados demostrables', 20, 25, { codigo: 'CV_RESULTADOS' }),
          nota('Complejidad y alcance', 15, 20, { codigo: 'CV_COMPLEJIDAD' }),
        ],
      }),
    ])
    expect(criterios.map((c) => c.inicial)).toEqual(['R', 'C'])
  })

  it('los tres tramos son los del informe: 70 y 40', () => {
    expect(tonoDelCriterio(nota('Caja', 14, 20))).toBe('bien') // 70 % justo
    expect(tonoDelCriterio(nota('Caja', 13, 20))).toBe('duda') // 65 %
    expect(tonoDelCriterio(nota('Caja', 8, 20))).toBe('duda') // 40 % justo
    expect(tonoDelCriterio(nota('Caja', 7, 20))).toBe('mal') // 35 %
  })

  /*
    ⚠️ **Un hueco NO es un rojo.** Sin nota puede ser que la IA no haya llegado o
    que ese criterio lo puntúe una persona —hay criterios de método PERSONA en la
    rúbrica—. Teñirlo de rojo diría que el candidato lo hizo mal, que es un
    juicio que nadie ha emitido.
  */
  it('sin nota es un hueco, nunca un rojo', () => {
    expect(tonoDelCriterio(nota('Caja', null, 20))).toBe('hueco')
    expect(cuantoCubre(nota('Caja', null, 20))).toBeNull()
    // Y sin nota NI máximo sigue siendo un hueco: lo que falta es la nota.
    expect(tonoDelCriterio(nota('Caja', null, null))).toBe('hueco')
  })

  it('un cero sí es un rojo: alguien lo miró y puso cero', () => {
    expect(tonoDelCriterio(nota('Caja', 0, 20))).toBe('mal')
  })

  /*
    ⚠️ **Un criterio que pesa cero no se tiñe, aunque tenga nota.** No es
    hipotético: en la vacante 3 de la base local «Desarrollo de personas» pesa 0
    y todo el mundo tiene nota en él. El backend suma `puntaje × peso` y divide
    por la suma de pesos, así que ese criterio NO puede mover la nota de nadie.
    Pintarlo en verde lo pone al lado de uno que pesa 25 como si valieran igual.
  */
  it('un criterio que no pondera no se tiñe, aunque tenga nota', () => {
    expect(tonoDelCriterio(nota('Desarrollo de personas', 90, null, { peso: 0 }))).toBe('hueco')
    expect(noPondera(nota('Desarrollo de personas', 90, null, { peso: 0 }))).toBe(true)
    // Con peso, el mismo 90 sí se tiñe: lo que cambia es la importancia.
    expect(tonoDelCriterio(nota('Habilidades', 90, null, { peso: 25 }))).toBe('bien')
    // Y la nota se sigue enseñando: lo que se quita es el color, no el dato.
    expect(notaEscrita(nota('Desarrollo de personas', 90, null, { peso: 0 }))).toBe('90')
  })

  /*
    ⚠️ **Sin máximo la escala es 100, no «ninguna».** Es como llegan los ocho
    criterios del currículum —comprobado contra el backend vivo: `maximo: null` y
    puntajes de 40, 50, 60—, porque lo que reparte ahí es el peso y no un máximo
    propio. Leerlo como «sin escala» pintaba las ocho columnas del perfil integral
    como huecos, encima de notas que sí estaban.
  */
  it('sin máximo la escala es cien, y la nota se escribe sola', () => {
    expect(cuantoCubre(nota('Resultados', 60, null))).toBeCloseTo(0.6)
    expect(tonoDelCriterio(nota('Resultados', 60, null))).toBe('duda')
    expect(tonoDelCriterio(nota('Resultados', 70, null))).toBe('bien')
    // «40/100» sería ruido: el 100 no añade nada.
    expect(notaEscrita(nota('Resultados', 40, null))).toBe('40')
    // Con máximo propio sí se escribe, que es lo que hace una prueba del puesto.
    expect(notaEscrita(nota('Caja', 18, 20))).toBe('18/20')
    expect(notaEscrita(null)).toBe('—')
    // Un máximo en cero no divide: se trata como el vacío.
    expect(cuantoCubre(nota('Caja', 50, 0))).toBeCloseTo(0.5)
  })

  /*
    ⚠️ **La cabecera se arma de TODAS las filas, no de la primera.** Una fila sin
    calificar trae la lista vacía o incompleta, y mirando solo la primera la
    tabla perdería columnas según a quién le tocara encabezar la tanda.
  */
  it('la cabecera se arma de todas las filas, no de la primera', () => {
    const criterios = criteriosDeLaTanda([
      fila('POSTULADA', null, { notasCriterio: [] }),
      fila('POSTULADA', 80, {
        notasCriterio: [nota('Resultados', 20, 25), nota('Complejidad', 15, 20)],
      }),
    ])
    expect(criterios.map((c) => c.nombre)).toEqual(['Resultados', 'Complejidad'])
  })

  it('un máximo nulo de una fila sin calificar no borra el que ya se sabía', () => {
    const criterios = criteriosDeLaTanda([
      fila('POSTULADA', 80, { notasCriterio: [nota('Resultados', 20, 25)] }),
      fila('POSTULADA', null, { notasCriterio: [nota('Resultados', null, null)] }),
    ])
    expect(criterios[0]?.maximo).toBe(25)
  })

  it('no repite un criterio que sale en todas las filas', () => {
    const criterios = criteriosDeLaTanda([
      fila('POSTULADA', 80, { notasCriterio: [nota('Resultados', 20, 25)] }),
      fila('POSTULADA', 60, { notasCriterio: [nota('Resultados', 10, 25)] }),
    ])
    expect(criterios).toHaveLength(1)
  })

  /*
    ⚠️ **Fuera del currículum no se pinta ninguna, y no es por el ancho.**
    `notasCriterio` viene SIEMPRE de los criterios del currículum, en las cinco
    pestañas. En «Prueba del puesto» serían ocho columnas del CV con pinta de ser
    de la prueba: exactamente el fallo que este archivo existe para no repetir.
  */
  it('fuera del currículum no se pinta ninguna, aunque el interruptor esté encendido', () => {
    const filas = [fila('POSTULADA', 80, { notasCriterio: [nota('Resultados', 20, 25)] })]
    expect(criteriosQueSePintan('PRUEBA_PUESTO', filas, true)).toEqual([])
    expect(criteriosQueSePintan('SIMULACION', filas, true)).toEqual([])
    expect(criteriosQueSePintan('PERFIL_INTEGRAL', filas, true)).toHaveLength(1)
    expect(criteriosQueSePintan('DECISION', filas, true)).toHaveLength(1)
  })

  it('apagado no pinta ninguna ni en el perfil integral', () => {
    const filas = [fila('POSTULADA', 80, { notasCriterio: [nota('Resultados', 20, 25)] })]
    expect(criteriosQueSePintan('PERFIL_INTEGRAL', filas, false)).toEqual([])
  })

  /*
    Los criterios se buscan por nombre porque es lo único que viaja: el backend
    no manda el código. Quien no tiene esa nota da `null`, y la celda pinta un
    hueco — que es distinto de un cero.
  */
  it('una fila sin ese criterio da null, y eso pinta un hueco', () => {
    const suya = fila('POSTULADA', 80, { notasCriterio: [nota('Resultados', 20, 25)] })
    expect(notaDelCriterio(suya, 'Resultados')?.puntaje).toBe(20)
    expect(notaDelCriterio(suya, 'Complejidad')).toBeNull()
  })
})

// ---------- El estado, partido donde toca ----------

describe('el estado, en sus dos mitades', () => {
  /*
    ⚠️ **Esto existe por una medida, no por gusto.** «Perfil Integral · por
    confirmar» se partía solo en cuatro líneas dentro de sus 111 px y estiraba la
    fila a 109, mientras la de al lado —«Cerrada»— medía 66. En una tabla que se
    lee por columnas es lo peor que puede pasar: el mismo puntaje ocupa un bloque
    de color de distinto tamaño según lo largo que sea el estado de esa persona.
  */
  it('parte por el punto medio: etapa arriba, momento abajo', () => {
    expect(estadoEnDos('Perfil Integral · por confirmar')).toEqual({
      etapa: 'Perfil Integral',
      momento: 'por confirmar',
    })
  })

  /*
    Cuatro de los dieciocho no tienen momento. No se les inventa una segunda
    línea: son una etapa y ya está.
  */
  it('los cuatro sin momento salen enteros y sin segunda línea', () => {
    for (const suelto of ['Postulada', 'Contratado', 'No continúa', 'Cerrada']) {
      expect(estadoEnDos(suelto)).toEqual({ etapa: suelto, momento: null })
    }
  })

  it('parte por el PRIMER punto medio, no por cualquiera', () => {
    expect(estadoEnDos('Simulación · turno del candidato').momento).toBe(
      'turno del candidato',
    )
    // Un estado con dos separadores conservaría el resto en el momento, entero.
    expect(estadoEnDos('A · b · c')).toEqual({ etapa: 'A', momento: 'b · c' })
  })

  it('los dieciocho estados de la base caen en una de las dos formas', () => {
    const todos = [
      'Postulada',
      'Perfil Integral · turno del candidato',
      'Perfil Integral · calificando',
      'Perfil Integral · por confirmar',
      'Prueba · turno del candidato',
      'Prueba · calificando',
      'Prueba · por confirmar',
      'Simulación · por habilitar',
      'Simulación · turno del candidato',
      'Simulación · por confirmar',
      'Validación · por habilitar',
      'Validación · turno del candidato',
      'Validación · por confirmar',
      'Decisión · por confirmar',
      'Decisión · turno del candidato',
      'Contratado',
      'No continúa',
      'Cerrada',
    ]
    // Ninguno pierde texto por el camino: las dos mitades reconstruyen el nombre.
    for (const nombre of todos) {
      const { etapa, momento } = estadoEnDos(nombre)
      expect(momento === null ? etapa : `${etapa} · ${momento}`).toBe(nombre)
    }
    expect(todos.filter((n) => estadoEnDos(n).momento === null)).toHaveLength(4)
  })
})

// ---------- El grupo de prioridad, dicho ----------

describe('el grupo de prioridad se puede pintar en el panel', () => {
  it('cada código tiene su nombre en palabras', () => {
    expect(nombreDelGrupo('ALTA')).toBe('Prioridad alta')
    expect(nombreDelGrupo('POTENCIAL_CON_RIESGO')).toBe('Potencial con riesgo')
    expect(nombreDelGrupo('INCOMPATIBLE')).toBe('Incompatible')
  })

  it('sin grupo no hay etiqueta que pintar', () => {
    expect(nombreDelGrupo(null)).toBeNull()
  })

  it('un código desconocido se enseña tal cual en vez de inventarle nombre', () => {
    expect(nombreDelGrupo('LO_QUE_SEA')).toBe('lo que sea')
  })
})

// ---------- Lo que se le manda al Excel ----------

describe('de qué recorte salió la hoja', () => {
  const CIUDADES = [{ codigo: '1501', nombre: 'Lima — Lima', cuantas: 3 }]

  /*
    ⚠️ **El corte de la botonera es lo que MÁS filas quita.** «Con nota del
    perfil» esconde a media tanda; una descripción que solo dijera «Ciudad: Lima»
    haría leer la hoja como si trajera a todos los de Lima.
  */
  it('nombra la etapa y el corte, siempre', () => {
    const dicho = describirFiltro('PERFIL_INTEGRAL', 'con-nota', SIN_FILTROS, null, [])
    expect(dicho).toContain('Perfil integral')
    expect(dicho).toContain('Con nota del perfil')
  })

  it('dice el orden, porque el backend escribe las filas como se las manden', () => {
    expect(
      describirFiltro('PERFIL_INTEGRAL', 'toda', SIN_FILTROS, { columna: 'nota', sentido: 'desc' }, []),
    ).toContain('Orden: Nota, de mayor a menor')
    expect(describirFiltro('PERFIL_INTEGRAL', 'toda', SIN_FILTROS, null, [])).toContain(
      'Orden del ranking',
    )
  })

  it('la ciudad va por su nombre y no por su código de ubigeo', () => {
    const dicho = describirFiltro(
      'PERFIL_INTEGRAL',
      'toda',
      { ...SIN_FILTROS, ciudades: ['1501'] },
      null,
      CIUDADES,
    )
    expect(dicho).toContain('Ciudad: Lima — Lima')
    expect(dicho).not.toContain('1501')
  })

  it('los rangos se dicen con su extremo cuando solo hay uno', () => {
    const dicho = describirFiltro(
      'PRUEBA_PUESTO',
      'toda',
      { ...SIN_FILTROS, notaMin: 60, pretensionMax: 4000 },
      null,
      [],
    )
    expect(dicho).toContain('Nota ≥ 60')
    expect(dicho).toContain('Pretensión ≤ 4000')
  })
})

describe('qué etapas exportan a Excel', () => {
  /*
    Son las dos que tienen rúbrica con criterios detrás. En las otras tres el
    botón no existe, en vez de salir y fallar con un 400 del backend.
  */
  it('solo perfil integral y prueba del puesto', () => {
    expect(seExportaAExcel('PERFIL_INTEGRAL')).toBe(true)
    expect(seExportaAExcel('PRUEBA_PUESTO')).toBe(true)
    for (const otra of ['SIMULACION', 'VALIDACION', 'DECISION'] as const) {
      expect(seExportaAExcel(otra)).toBe(false)
    }
  })
})

// ---------- Las columnas que pueden no existir ----------

describe('una columna entera vacía no se pinta: se dice por qué', () => {
  /*
    ⚠️ **Los dos motivos son distintos y ninguno se puede callar.**

    La ciudad falta porque solo se le pide a quien crea su cuenta desde ahora:
    ninguna postulación anterior la trae. Eso se sabe entero y se dice entero.

    La pretensión falta por DOS motivos que desde el navegador no se distinguen:
    o no la declararon, o quien mira no tiene el permiso `ver_pretension` —solo
    lo tiene Dirección, y sin él el backend ni lanza la consulta—. Una columna en
    blanco ahí se lee como «nadie pidió sueldo», que para todo el rol de talento
    es sencillamente falso.
  */
  const SIN_NADA = [fila('POSTULADA', 80), fila('POSTULADA', 60)]
  const CON_TODO = [
    fila('POSTULADA', 80, {
      ciudad: 'Lima — Lima',
      ciudadCodigo: '1501',
      pretensionMin: 3000,
      pretensionMoneda: 'PEN',
    }),
    fila('POSTULADA', 60),
  ]

  it('una tanda sin ciudad ni pretensión no las trae', () => {
    expect(queTraeLaTanda(SIN_NADA)).toEqual({
      hayCiudad: false,
      hayPretension: false,
      puedeVerPretension: true,
    })
  })

  it('basta con que UNA fila lo declare para que la columna exista', () => {
    expect(queTraeLaTanda(CON_TODO)).toEqual({
      hayCiudad: true,
      hayPretension: true,
      puedeVerPretension: true,
    })
  })

  /*
    Sin el permiso el backend manda las tres cifras en nulo aunque el candidato
    SÍ las hubiera declarado. La tanda de este test las trae, y aun así la
    columna no debe salir: lo que llega no es el dato, es su ausencia forzada.
  */
  it('sin permiso, la pretensión no existe aunque las filas la traigan', () => {
    const trae = queTraeLaTanda(CON_TODO, false)
    expect(trae.hayPretension).toBe(false)
    expect(trae.puedeVerPretension).toBe(false)
  })

  /*
    ⚠️ Confirmado por el backend: `ciudadCodigo != null` NO implica `ciudad !=
    null`. Son dos consultas y el nombre puede faltar. Con código y sin nombre la
    persona SÍ tiene ciudad, y su fila se puede filtrar por ella.
  */
  it('el código de ciudad sin nombre también cuenta como ciudad', () => {
    expect(queTraeLaTanda([fila('POSTULADA', null, { ciudadCodigo: '1501' })]).hayCiudad).toBe(
      true,
    )
  })

  it('solo el techo de la pretensión ya la hace existir', () => {
    expect(
      queTraeLaTanda([fila('POSTULADA', null, { pretensionMax: 4000 })]).hayPretension,
    ).toBe(true)
  })

  it('sin las dos, la tabla baja de nueve a siete columnas', () => {
    const nada = { hayCiudad: false, hayPretension: false, puedeVerPretension: true }
    expect(columnasDelRanking('PERFIL_INTEGRAL', nada)).toHaveLength(7)
    expect(columnasDelRanking('PRUEBA_PUESTO', nada)).toHaveLength(7)
  })

  it('con solo una de las dos, nueve menos una', () => {
    expect(
      columnasDelRanking('PERFIL_INTEGRAL', {
        hayCiudad: true,
        hayPretension: false,
        puedeVerPretension: true,
      }),
    ).toHaveLength(8)
    const claves = columnasDelRanking('PRUEBA_PUESTO', {
      hayCiudad: false,
      hayPretension: true,
      puedeVerPretension: true,
    }).map((c) => c.clave)
    expect(claves).not.toContain('ciudad')
    expect(claves).toContain('pretension')
  })

  it('lo que no está tampoco se puede ordenar: no queda una cabecera huérfana', () => {
    const ordenables = columnasDelRanking('PRUEBA_PUESTO', {
      hayCiudad: false,
      hayPretension: false,
      puedeVerPretension: true,
    })
      .filter((c) => c.ordenable)
      .map((c) => c.ordenable)
    expect(ordenables).toEqual(['nombre', 'nota'])
  })

  /*
    ⚠️ **Y va dentro del Excel.** La hoja se descarga, se reenvía y se abre fuera
    del panel, donde ya no hay pantalla que explique que un blanco en Pretensión
    puede ser un permiso y no un candidato que no pidió sueldo.
  */
  it('el motivo viaja en la descripción que lleva la hoja', () => {
    const sinPermiso = describirFiltro('PERFIL_INTEGRAL', 'toda', SIN_FILTROS, null, [], {
      hayCiudad: false,
      hayPretension: false,
      puedeVerPretension: false,
    })
    expect(sinPermiso).toContain(POR_QUE_NO_HAY_CIUDAD)
    expect(sinPermiso).toContain(porQueNoHayPretension(false))

    // Con permiso, la MISMA columna vacía lleva el otro motivo. Es el punto
    // entero de que `puedeVerPretension` viaje: la hoja afirma cuál es.
    const conPermiso = describirFiltro('PERFIL_INTEGRAL', 'toda', SIN_FILTROS, null, [], {
      hayCiudad: false,
      hayPretension: false,
      puedeVerPretension: true,
    })
    expect(conPermiso).toContain(porQueNoHayPretension(true))
    expect(conPermiso).not.toContain(porQueNoHayPretension(false))
  })

  it('y no aparece cuando las columnas sí traen algo', () => {
    const dicho = describirFiltro('PERFIL_INTEGRAL', 'toda', SIN_FILTROS, null, [], {
      hayCiudad: true,
      hayPretension: true,
      puedeVerPretension: true,
    })
    expect(dicho).not.toContain('no pudiera verla')
    expect(dicho).not.toContain('Todavía no hay ninguna ciudad')
  })

  it('la frase de la pretensión afirma UN motivo, y son distintos', () => {
    // Antes nombraba los dos sin comprometerse, porque el nulo no los separaba.
    // Con `puedeVerPretension` cada caso dice lo suyo, y sobre todo el de «sin
    // permiso» niega expresamente la lectura falsa que invita un blanco.
    expect(porQueNoHayPretension(false)).toContain('NO quiere decir')
    expect(porQueNoHayPretension(false)).toContain('Dirección')
    expect(porQueNoHayPretension(true)).toContain('Ninguno de estos candidatos declaró')
    expect(porQueNoHayPretension(true)).not.toContain('permiso')
  })
})
