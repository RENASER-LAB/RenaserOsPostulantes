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
  cifrasDeLaEtapa,
  esDelCurriculum,
  filtrar,
  indiceDeLaEtapaDe,
  porQueNoHayNota,
  recuentos,
} from './ranking'
import type { FilaRanking } from '../api/tipos'

const fila = (estado: string, notaEtapa: number | null): FilaRanking => ({
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
    nota.
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
