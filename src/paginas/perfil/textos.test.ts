/**
 * Las cuentas de la línea de tiempo.
 *
 * Se prueban aparte porque son puras y porque **lo que importa es lo que
 * devuelven cuando el dato viene mal**: estas fechas salen de un currículum que
 * leyó un modelo, así que llegan invertidas, incompletas o vacías más a menudo
 * de lo que parece, y la pantalla tiene que pintar la fila igual.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { aniosYMeses, duracion, huecoEntre, mesesDelTramo } from './textos'

describe('mesesDelTramo', () => {
  it('cuenta los dos extremos: enero a marzo son tres meses', () => {
    expect(mesesDelTramo('2022-01-01', '2022-03-01')).toBe(3)
  })

  it('un tramo abierto llega hasta hoy', () => {
    // El día 1 del mes de hoy, hace dos años, escrito en hora local: con
    // `toISOString()` la fecha salía en UTC y la noche del último día del mes
    // en Lima ya era el mes siguiente.
    const hoy = new Date()
    const hace2anios = `${hoy.getFullYear() - 2}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`
    expect(mesesDelTramo(hace2anios, null)).toBe(25)
  })

  it('sin fecha de inicio no se inventa una duración', () => {
    expect(mesesDelTramo(null, '2022-03-01')).toBeNull()
  })

  it('un fin anterior al principio devuelve null, no un número negativo', () => {
    expect(mesesDelTramo('2022-03-01', '2020-01-01')).toBeNull()
  })

  it('una fecha que no es una fecha devuelve null', () => {
    expect(mesesDelTramo('no es una fecha', '2022-03-01')).toBeNull()
  })
})

describe('huecoEntre', () => {
  it('un año parado es un hueco', () => {
    expect(huecoEntre('2019-01-01', '2020-01-01')).toBe(12)
  })

  it('cambiar de trabajo en dos meses no es un hueco', () => {
    expect(huecoEntre('2020-01-01', '2020-03-01')).toBeNull()
  })

  it('sin una de las dos fechas no se dibuja nada', () => {
    expect(huecoEntre(null, '2020-01-01')).toBeNull()
    expect(huecoEntre('2020-01-01', null)).toBeNull()
  })

  it('un par en desorden no inventa un hueco', () => {
    // Las filas se reordenan a mano: dos que no van seguidas en el tiempo
    // darían un hueco negativo si no se comprobara.
    expect(huecoEntre('2022-01-01', '2019-01-01')).toBeNull()
  })
})

/*
 * ⚠️ **En Lima `new Date('2024-10-01')` todavía es el 30 de septiembre.** Es la
 * medianoche UTC, y Lima va cinco horas por detrás todo el año. Contar meses
 * con `getMonth()` sobre esa fecha daba un mes de más a cada tramo abierto. Se
 * fijan la zona y el reloj para que el caso no dependa de dónde ni de qué día
 * corra la suite.
 */
describe('las fechas de un currículum, vistas desde Lima', () => {
  beforeEach(() => {
    vi.stubEnv('TZ', 'America/Lima')
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it('un tramo abierto que empezó un día 1 no gana un mes', () => {
    // Mediodía del 1 de octubre: en UTC también es el día 1.
    vi.setSystemTime(new Date('2026-10-01T12:00:00-05:00'))
    expect(mesesDelTramo('2024-10-01', null)).toBe(25)
    expect(duracion('2024-10-01', null)).toBe('2 años y 1 mes')
  })

  it('el «hoy» de un tramo abierto es el de Lima, aunque en UTC ya sea otro mes', () => {
    // 23:30 del 30 de septiembre en Lima son las 04:30Z del 1 de octubre.
    vi.setSystemTime(new Date('2026-09-30T23:30:00-05:00'))
    expect(mesesDelTramo('2024-09-01', null)).toBe(25)
  })

  it('un tramo cerrado cuenta igual empiece o no en día 1', () => {
    expect(mesesDelTramo('2024-10-01', '2024-12-15')).toBe(3)
  })

  it('un hueco de tres meses que acaba un día 1 sigue siendo un hueco', () => {
    expect(huecoEntre('2020-01-15', '2020-04-01')).toBe(3)
  })
})

describe('aniosYMeses', () => {
  it('96 meses son ocho años', () => {
    expect(aniosYMeses(96)).toBe('8 años de experiencia')
  })
  it('el singular es singular', () => {
    expect(aniosYMeses(13)).toBe('1 año y 1 mes de experiencia')
  })
})
