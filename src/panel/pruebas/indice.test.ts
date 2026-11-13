/**
 * Las reglas de «Pruebas» sin pintar nada (spec pruebas-indice-de-la-empresa):
 * lo que vive en la dirección (AC-06), los filtros que se combinan, las
 * sugerencias de la línea y cómo se escribe cada fila.
 */

import { describe, expect, it } from 'vitest'
import type { FilaDePrueba } from '../api/pruebas'
import {
  admite,
  agrupar,
  cuantasCumplen,
  escribirEstado,
  etiquetas,
  fechaCorta,
  leerEstado,
  nivelParaLeer,
  opcionesDe,
  partesDelResumen,
  sugerencias,
  SIN_FILTROS,
  textoDeLaVersion,
  textoDelTitulo,
} from './indice'

const fila = (cambios: Partial<FilaDePrueba>): FilaDePrueba => ({
  vacanteId: 1,
  titulo: 'Asistente Contable',
  sede: 'San Isidro, Lima',
  nivel: 'EJECUCION',
  situacion: 'PUBLICADA',
  estado: 'PUBLICADA',
  laRindeAlguien: false,
  hayBorradorAbierto: false,
  criterios: 4,
  preguntas: 12,
  entregables: null,
  modalidad: null,
  minutos: null,
  dias: null,
  publicadaEn: '2026-10-14T15:00:00Z',
  puedeUsarEnOtra: true,
  ...cambios,
})

const CONTADOR = fila({ vacanteId: 1, laRindeAlguien: true })
const CAJERO = fila({ vacanteId: 2, titulo: 'Cajero', estado: 'BORRADOR', situacion: 'SIN_PUBLICAR', publicadaEn: null })
const JEFE = fila({ vacanteId: 3, titulo: 'Jefe de Recursos Humanos', nivel: 'DIRECCION', situacion: 'CERRADA' })
const SIN_NIVEL = fila({ vacanteId: 4, titulo: 'Recepcionista bilingüe', nivel: null, situacion: 'ARCHIVADA' })
const TODAS = [CONTADOR, CAJERO, JEFE, SIN_NIVEL]

const ids = (filtros = SIN_FILTROS, buscar = '') => TODAS.filter((f) => admite(f, filtros, buscar)).map((f) => f.vacanteId)

describe('la pestaña y los filtros viven en la dirección (AC-06)', () => {
  it('se leen y se escriben igual: sobreviven a una recarga', () => {
    const q = new URLSearchParams('tipo=prueba&buscar=caj&nivel=EJECUCION,direccion&estado=PUBLICADA,EN_USO&situacion=CERRADA&vacante=12')
    const estado = leerEstado(q)
    expect(estado).toEqual({
      pestana: 'prueba',
      buscar: 'caj',
      filtros: { nivel: ['EJECUCION', 'DIRECCION'], estado: ['PUBLICADA', 'EN_USO'], situacion: ['CERRADA'] },
      vacante: 12,
    })
    expect(leerEstado(escribirEstado(estado))).toEqual(estado)
  })

  it('sin nada, la pestaña de las preguntas; lo que no existe se ignora', () => {
    expect(leerEstado(new URLSearchParams(''))).toEqual({ pestana: 'preguntas', buscar: '', filtros: SIN_FILTROS, vacante: null })
    const raro = leerEstado(new URLSearchParams('tipo=otra&estado=CUALQUIERA&situacion=,,&vacante=abc'))
    expect(raro.pestana).toBe('preguntas')
    expect(raro.filtros).toEqual(SIN_FILTROS)
    expect(raro.vacante).toBeNull()
    expect(escribirEstado({ pestana: 'preguntas', buscar: '', filtros: SIN_FILTROS, vacante: null }).toString()).toBe('tipo=preguntas')
  })
})

describe('los filtros se combinan (AC-06)', () => {
  it('el buscador mira solo el título, sin tildes ni mayúsculas', () => {
    expect(ids(SIN_FILTROS, 'CONTÁBLE')).toEqual([1])
    expect(ids(SIN_FILTROS, ' bilingue ')).toEqual([4])
    // La sede se ve, pero no se busca
    expect(ids(SIN_FILTROS, 'San Isidro')).toEqual([])
    // Mientras se escribe un filtro, no se busca en los títulos
    expect(textoDelTitulo('nivel: eje')).toBe('')
    expect(ids(SIN_FILTROS, 'nivel:')).toEqual([1, 2, 3, 4])
  })

  it('dentro de un grupo vale cualquiera; entre grupos, todos; sin nivel no coincide con ningún nivel', () => {
    expect(ids({ ...SIN_FILTROS, nivel: ['EJECUCION', 'DIRECCION'] })).toEqual([1, 2, 3])
    expect(ids({ ...SIN_FILTROS, estado: ['EN_USO'] })).toEqual([1])
    expect(ids({ ...SIN_FILTROS, estado: ['BORRADOR', 'EN_USO'] })).toEqual([1, 2])
    expect(ids({ nivel: ['DIRECCION'], estado: ['PUBLICADA'], situacion: ['CERRADA'] }, 'jefe')).toEqual([3])
    expect(ids({ nivel: ['EJECUCION'], estado: [], situacion: ['CERRADA'] })).toEqual([])
  })

  it('cada casilla dice cuántas filas la cumplen, y los niveles incluyen uno que el catálogo no conoce', () => {
    expect(cuantasCumplen(TODAS, 'nivel', 'EJECUCION')).toBe(2)
    expect(cuantasCumplen(TODAS, 'estado', 'EN_USO')).toBe(1)
    expect(cuantasCumplen(TODAS, 'situacion', 'ARCHIVADA')).toBe(1)
    expect(opcionesDe('nivel', [...TODAS, fila({ nivel: 'GERENCIA' })]).map((o) => o.valor)).toEqual([
      'EJECUCION',
      'SUPERVISION',
      'DIRECCION',
      'GERENCIA',
    ])
  })

  it('las publicadas arriba y los borradores que nunca se publicaron, abajo', () => {
    const { publicadas, borradores } = agrupar(TODAS)
    expect(publicadas.map((f) => f.vacanteId)).toEqual([1, 3, 4])
    expect(borradores.map((f) => f.vacanteId)).toEqual([2])
  })
})

describe('la línea de búsqueda ofrece convertir el texto en filtro', () => {
  it('«eje» ofrece el nivel, «publi» el estado y la situación, y «nivel:» todos los niveles', () => {
    expect(sugerencias('eje', SIN_FILTROS)).toEqual([{ grupo: 'nivel', valor: 'EJECUCION' }])
    expect(sugerencias('publi', SIN_FILTROS)).toEqual([
      { grupo: 'estado', valor: 'PUBLICADA' },
      { grupo: 'situacion', valor: 'SIN_PUBLICAR' },
      { grupo: 'situacion', valor: 'PUBLICADA' },
    ])
    expect(sugerencias('nivel:', SIN_FILTROS).map((s) => s.valor)).toEqual(['EJECUCION', 'SUPERVISION', 'DIRECCION'])
    expect(sugerencias('la rinde', SIN_FILTROS)).toEqual([{ grupo: 'estado', valor: 'EN_USO' }])
  })

  it('con una letra no ofrece nada, ni lo que ya está puesto', () => {
    expect(sugerencias('p', SIN_FILTROS)).toEqual([])
    expect(sugerencias('publi', { ...SIN_FILTROS, estado: ['PUBLICADA'], situacion: ['SIN_PUBLICAR'] })).toEqual([
      { grupo: 'situacion', valor: 'PUBLICADA' },
    ])
  })

  it('una etiqueta por filtro; desde seis, una por grupo', () => {
    expect(etiquetas({ nivel: ['EJECUCION'], estado: ['PUBLICADA'], situacion: [] })).toEqual([
      { grupo: 'nivel', valores: ['EJECUCION'] },
      { grupo: 'estado', valores: ['PUBLICADA'] },
    ])
    const muchas = etiquetas({ nivel: ['EJECUCION', 'DIRECCION', 'SUPERVISION'], estado: ['PUBLICADA', 'BORRADOR'], situacion: ['CERRADA'] })
    expect(muchas.map((e) => e.grupo)).toEqual(['nivel', 'estado', 'situacion'])
  })
})

describe('cómo se escribe una fila', () => {
  it('«N criterios · N preguntas» y, en la prueba, sus entregables y el tiempo del chip', () => {
    expect(partesDelResumen(CONTADOR, 'preguntas')).toEqual(['4 criterios', '12 preguntas'])
    const prueba = fila({ criterios: 1, preguntas: 0, entregables: 1, modalidad: 'CRONOMETRADA', minutos: 90 })
    // Se publica con solo entregables: «0 preguntas»
    expect(partesDelResumen(prueba, 'prueba')).toEqual(['1 criterio', '0 preguntas', '1 entregable', '90 min'])
    expect(partesDelResumen(fila({ entregables: 3, modalidad: 'PLAZO_ABIERTO' }), 'prueba').at(-1)).toBe('Sin cronómetro')
    expect(partesDelResumen(fila({ entregables: 0, modalidad: 'PLAZO_ABIERTO', dias: 5 }), 'prueba').slice(2)).toEqual([
      '0 entregables',
      '5 días',
    ])
  })

  it('la fecha de la versión va en hora de Lima: un día 1 a las 03:00 UTC es el 31 en Lima', () => {
    expect(fechaCorta('2026-09-18T15:00:00Z')).toBe('18 sep 2026')
    expect(fechaCorta('2026-09-01T03:00:00Z')).toBe('31 ago 2026')
    expect(textoDeLaVersion(CONTADOR)).toBe('Versión del 14 oct 2026')
    expect(textoDeLaVersion(CAJERO)).toBe('Sin publicar')
  })

  it('sin puesto o sin nivel, «—»', () => {
    expect(nivelParaLeer(null)).toBe('—')
    expect(nivelParaLeer('DIRECCION')).toBe('Dirección')
  })
})
