import { describe, expect, it } from 'vitest'
import {
  caracteresDe,
  contarPorEstrellas,
  cuantasResenas,
  empresasDe,
  estrellasDichas,
  estrellasPartidas,
  faltaEnElReporte,
  faltaEnElTexto,
  filtrarYOrdenar,
  hayFiltros,
  motivosDelReporte,
  promedioEscrito,
  SIN_FILTROS,
  type ResenaParaPintar,
} from './modelo'

/** Días atrás, relativos a hoy: sin fechas quemadas, que caducan. */
const haceDias = (dias: number) => new Date(Date.now() - dias * 86_400_000).toISOString()

const resena = (id: number, estrellas: number, empresa: string, dias: number): ResenaParaPintar => ({
  id,
  estrellas,
  empresa,
  puesto: 'Desarrollador Backend',
  texto: 'Muy responsable con los plazos y con el equipo de obra.',
  publicadaEn: haceDias(dias),
  editada: false,
})

describe('cómo se dicen las reseñas', () => {
  it('el promedio lleva un decimal y coma, también cuando es redondo', () => {
    expect(promedioEscrito(4.7)).toBe('4,7')
    expect(promedioEscrito(5)).toBe('5,0')
    expect(cuantasResenas(1)).toBe('1 reseña')
    expect(cuantasResenas(3)).toBe('3 reseñas')
  })

  it('el lector de pantalla oye «4,5 de 5 estrellas», y una entera sin decimales', () => {
    expect(estrellasDichas(4.5)).toBe('4,5 de 5 estrellas')
    expect(estrellasDichas(3)).toBe('3 de 5 estrellas')
  })

  it('las estrellas se redondean a la media más cercana', () => {
    expect(estrellasPartidas(4.5)).toEqual(['llena', 'llena', 'llena', 'llena', 'media'])
    expect(estrellasPartidas(4.7)).toEqual(['llena', 'llena', 'llena', 'llena', 'media'])
    expect(estrellasPartidas(4.8)).toEqual(['llena', 'llena', 'llena', 'llena', 'llena'])
    expect(estrellasPartidas(2)).toEqual(['llena', 'llena', 'vacia', 'vacia', 'vacia'])
  })
})

describe('lo que se escribe', () => {
  it('se cuenta sin los espacios de los extremos, y un emoji como un carácter', () => {
    expect(caracteresDe('  👍a  ')).toBe(2)
  })

  it('vacía, solo espacios, corta o larga: el aviso va junto al campo (AC-06, AC-34)', () => {
    expect(faltaEnElTexto('      ', 30, 500, 'Tu respuesta')).toMatch(/obligatoria/)
    expect(faltaEnElTexto('a'.repeat(29), 30, 500, 'Tu respuesta')).toMatch(/al menos 30/)
    expect(faltaEnElTexto(` ${'a'.repeat(30)} `, 30, 500, 'Tu respuesta')).toBeNull()
    expect(faltaEnElTexto('a'.repeat(501), 30, 500, 'Tu respuesta')).toMatch(/hasta 500/)
    expect(faltaEnElTexto('a'.repeat(1001), 30, 1000, 'La opinión')).toMatch(/hasta 1000/)
  })

  it('«Otro motivo» sin comentario no se envía (AC-18)', () => {
    expect(faltaEnElReporte(null, '')).toMatch(/Elige/)
    expect(faltaEnElReporte('OTRO', '   ')).toMatch(/Otro motivo/)
    expect(faltaEnElReporte('OTRO', 'Nunca trabajé ahí')).toBeNull()
    expect(faltaEnElReporte('OFENSIVA', '')).toBeNull()
  })

  it('«Es falsa» cambia de palabras según quién reporta', () => {
    const falsa = (quien: 'persona' | 'empresa') =>
      motivosDelReporte(quien).find((m) => m.codigo === 'FALSA')!.nombre
    expect(falsa('persona')).toBe('Es falsa: no trabajé ahí, o cuenta hechos que no pasaron')
    expect(falsa('empresa')).toBe('Es falsa: cuenta hechos que no pasaron')
  })
})

describe('los filtros de «Ver todas»', () => {
  const tanda = [
    resena(1, 1, 'Constructora Andina', 30),
    resena(2, 4, 'Acme', 20),
    resena(3, 5, 'Constructora Andina', 10),
    resena(4, 5, 'Acme', 5),
  ]

  it('AC-15: 5★ y una empresa dejan solo las que cumplen las dos', () => {
    const quedan = filtrarYOrdenar(tanda, {
      ...SIN_FILTROS,
      estrellas: new Set([5]),
      empresa: 'Constructora Andina',
    })
    expect(quedan.map((r) => r.id)).toEqual([3])
  })

  it('se pueden marcar varias estrellas a la vez', () => {
    const quedan = filtrarYOrdenar(tanda, { ...SIN_FILTROS, estrellas: new Set([1, 4]) })
    expect(quedan.map((r) => r.id)).toEqual([2, 1])
  })

  it('AC-16: «Peor calificadas» va de menos a más estrellas y, a igualdad, de la más reciente', () => {
    const quedan = filtrarYOrdenar(tanda, { ...SIN_FILTROS, orden: 'peores' })
    expect(quedan.map((r) => r.id)).toEqual([1, 2, 4, 3])
  })

  it('los otros tres órdenes', () => {
    expect(filtrarYOrdenar(tanda, SIN_FILTROS).map((r) => r.id)).toEqual([4, 3, 2, 1])
    expect(filtrarYOrdenar(tanda, { ...SIN_FILTROS, orden: 'antiguas' }).map((r) => r.id)).toEqual([
      1, 2, 3, 4,
    ])
    expect(filtrarYOrdenar(tanda, { ...SIN_FILTROS, orden: 'mejores' }).map((r) => r.id)).toEqual([
      4, 3, 2, 1,
    ])
  })

  it('no reordena la lista que recibe: es la de la caché', () => {
    const copia = [...tanda]
    filtrarYOrdenar(tanda, { ...SIN_FILTROS, orden: 'peores' })
    expect(tanda).toEqual(copia)
  })

  it('AC-17: con una sola empresa, el filtro «Empresa» no tiene con qué filtrar', () => {
    expect(empresasDe([resena(1, 5, 'Acme', 1), resena(2, 4, 'Acme', 2)])).toEqual(['Acme'])
    expect(empresasDe(tanda)).toEqual(['Acme', 'Constructora Andina'])
  })

  it('cuenta por estrellas para los chips, con los ceros', () => {
    expect(contarPorEstrellas(tanda)).toEqual({ 1: 1, 2: 0, 3: 0, 4: 1, 5: 2 })
  })

  it('el orden no es un filtro: no pide «Quitar filtros»', () => {
    expect(hayFiltros({ ...SIN_FILTROS, orden: 'peores' })).toBe(false)
    expect(hayFiltros({ ...SIN_FILTROS, empresa: 'Acme' })).toBe(true)
    expect(hayFiltros({ ...SIN_FILTROS, estrellas: new Set([3]) })).toBe(true)
  })
})
