import { describe, expect, it } from 'vitest'
import { repartoDelEmbudo, tramosDelAnillo } from './repartoDelEmbudo'

describe('repartoDelEmbudo', () => {
  it('reparte por etapa, deja fuera del total a quien terminó y cuenta lo que espera al equipo', () => {
    const r = repartoDelEmbudo({
      porEstado: {
        POSTULADA: 2,
        PERFIL_TURNO_CANDIDATO: 1,
        PERFIL_POR_CONFIRMAR: 3,
        PRUEBA_POR_CONFIRMAR: 1,
        SIMULACION_POR_HABILITAR: 1,
        DECISION_TURNO_CANDIDATO: 1,
        NO_CONTINUA: 4,
        CONTRATADO: 1,
      },
    })
    expect(r).toEqual({ total: 9, porEtapa: [6, 1, 1, 0, 1], terminadas: 5, porRevisar: 5 })
  })

  it('sin postulaciones, todo en cero', () => {
    expect(repartoDelEmbudo({ porEstado: {} })).toEqual({
      total: 0,
      porEtapa: [0, 0, 0, 0, 0],
      terminadas: 0,
      porRevisar: 0,
    })
  })

  it('ignora conteos negativos o que no son número', () => {
    const r = repartoDelEmbudo({ porEstado: { POSTULADA: -1, PRUEBA_X: Number.NaN, PRUEBA_Y: 2 } })
    expect(r.total).toBe(2)
  })
})

describe('tramosDelAnillo', () => {
  it('un tramo solo cierra la vuelta entera, sin rendija', () => {
    const t = tramosDelAnillo(repartoDelEmbudo({ porEstado: { POSTULADA: 3 } }))
    expect(t).toEqual([{ etapa: 0, n: 3, desde: 0, largo: 100 }])
  })

  it('los tramos siguen el orden de las etapas y las terminadas no dibujan tramo', () => {
    const t = tramosDelAnillo(
      repartoDelEmbudo({ porEstado: { NO_CONTINUA: 1, PRUEBA_TURNO_CANDIDATO: 1, POSTULADA: 2 } }),
      0,
    )
    expect(t.map((x) => [x.etapa, x.desde, x.largo])).toEqual([
      [0, 0, 66.66666666666666],
      [1, 66.66666666666666, 33.33333333333333],
    ])
  })

  it('sin gente no hay tramos', () => {
    expect(tramosDelAnillo(repartoDelEmbudo({ porEstado: {} }))).toEqual([])
  })
})
