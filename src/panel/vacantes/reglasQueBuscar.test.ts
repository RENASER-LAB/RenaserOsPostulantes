import { describe, expect, it } from 'vitest'
import type { BusquedaEnElCv, EstadoDeLaBusqueda } from '../api/tipos'
import {
  esProhibida,
  lineaDeEstado,
  mismasLineas,
  ordenarPorLoBuscado,
  puntosDichos,
  recuentosDeLaBusqueda,
  revisarLineas,
} from './reglasQueBuscar'

/*
  Las mismas listas que `ReglasQueBuscarEnElCvTest` en el backend: si una cambia,
  cambian las dos.
*/
const PROHIBIDAS = [
  'Menor de 35 años', 'Que sea casado', 'Mayor de edad', 'Soltera, sin hijos', 'Sexo masculino',
  'Mujer joven', 'Que goce de buena salud', 'Sin discapacidad', 'Católico practicante',
  'De raza blanca', 'Nacionalidad peruana', 'Lugar de origen: Lima', 'Que no esté embarazada',
  'Estado civil: casado', 'Entre 25 y 35 años', 'Tez clara', 'Género femenino',
  // La edad con números, aunque no diga «edad» (QA-01)
  'Personas de 25 a 35 años', 'Máximo 30 años', 'Menos de 30 años', 'Mayor a 40 años',
  'Hasta 35 años', '18 años a más', 'De 18 a 30 años de preferencia', 'Que tenga 25 años',
  'Entre 25-35 años', 'Treinta y cinco años como máximo', 'Entre veinte y treinta años',
  'Menor de 35 años, con experiencia en caja', 'Menor de 30 años con experiencia en caja',
  'Experiencia en caja y menor de 35 años', 'No mayor de 40', 'Hasta los 35',
  'Mayores de 18 y con secundaria completa', 'Trabajo bajo presión hasta 35 años',
  // El sexo nombrando a la persona (QA-01)
  'Chica para atención al cliente', 'Chico para reparto', 'Señora para limpieza',
  'Muchacha para atención en tienda', 'Señorita para recepción', 'Varón para almacén',
]
const PERMITIDAS = [
  'Carné de salud vigente', 'Carné sanitario', 'Certificado de salud',
  'Experiencia en cocina saludable', 'Controla costos y mermas', 'Ha dirigido un equipo de cocina',
  'Experiencia mínima de 3 años en cocina', 'Más de 5 años de experiencia',
  'Certificado de manipulación de alimentos (BPM)', 'Experiencia en el sector salud',
  'Conocimientos de seguridad y salud en el trabajo', 'Manejo de productos de origen animal',
  'Inglés a nivel avanzado',
  // Números y años que no son una edad
  '3 años de experiencia en caja', 'Más de 3 años de experiencia en cocina', 'Inglés intermedio',
  'Mínimo 2 años en puestos similares', 'Más de 15 años en el rubro',
  'Experiencia de 15 a 20 años en el rubro', 'Experiencia laboral mínima de 15 años',
  '2 años como cajero', '20 años trabajando en restaurantes', 'Ticket promedio mayor a 50 soles',
  'Atiende más de 20 mesas por turno', 'Atender los 30 pedidos del turno',
  // «Chica» que habla de un tamaño
  'Manejo de caja chica', 'Arqueo de caja chica y fondo fijo',
]

describe('Qué buscar en el CV: lo que se puede escribir', () => {
  it.each(PROHIBIDAS)('«%s» no se puede buscar', (linea) => {
    expect(esProhibida(linea)).toBe(true)
  })

  it.each(PERMITIDAS)('«%s» sí, también los documentos que pide la ley', (linea) => {
    expect(esProhibida(linea)).toBe(false)
  })

  // Las mismas que `masFormasDeLoProhibidoSeRechazan` y `losAnosDeExperienciaNoSonUnaEdad`
  // del backend.
  it.each([
    // QA-04: la edad junto a la experiencia, sin coma, y el sexo con «señor»
    '2 años de experiencia y menor de 35 años', 'Experiencia y menor de 35 años',
    '1 año de experiencia y menor de 30', 'Con experiencia y mayor de 25 años',
    'Con 1 año de experiencia y hasta 30 años', 'Señor para vigilancia', 'Señores para seguridad',
    // QA-06: las demás categorías del Flujo 1.3 dichas como se suelen decir
    'Natural de Arequipa', 'Oriundo de Lima', 'No adventistas', 'Que no sea adventista',
    'Colombianos abstenerse', 'Bolivianos no', 'Madre de familia', 'Padre de familia',
    'Que no esté gestando', 'Que no tenga VIH', 'Piel blanca', 'Afrodescendiente', 'Minusválido',
  ])('QA-04 / QA-06: «%s» tampoco se puede buscar', (linea) => {
    expect(esProhibida(linea)).toBe(true)
    expect(revisarLineas(linea).hayErrores).toBe(true)
  })

  it.each([
    'Experiencia general no menor de 15 años', 'Experiencia en el cargo de 15 años',
    'Experiencia comprobada en el rubro de al menos 15 años',
    'Experiencia en cocina, al menos 15 años',
    'Trabajó en cadenas de comida rápida durante 15 años',
    'Experiencia en el sector durante más de 20 años',
  ])('QA-05: «%s» son años de experiencia, no una edad', (linea) => {
    expect(esProhibida(linea)).toBe(false)
    expect(revisarLineas(linea).seGuardan).toEqual([linea])
  })

  it('AC-01: tres líneas válidas son «3 de 6»; las vacías y repetidas no cuentan', () => {
    const r = revisarLineas(
      'Experiencia en cocina saludable\n\n  Ha dirigido un equipo de cocina \nha dirigido un   EQUIPO de cocina\nControla costos y mermas',
    )
    expect(r.seGuardan).toEqual([
      'Experiencia en cocina saludable',
      'Ha dirigido un equipo de cocina',
      'Controla costos y mermas',
    ])
    expect(r.hayErrores).toBe(false)
  })

  it('AC-03: con 8 líneas la 7 y la 8 salen como que sobran y se guardan las 6 primeras', () => {
    const r = revisarLineas('Uno\nDos\nTres\nCuatro\nCinco\nSeis\nSiete\nOcho')
    expect(r.seGuardan).toHaveLength(6)
    expect(r.lineas.slice(6).map((l) => l.como)).toEqual(['SOBRA', 'SOBRA'])
    expect(r.hayErrores).toBe(false)
  })

  it('AC-02: una prohibida apaga el guardado y sale marcada', () => {
    const r = revisarLineas('Experiencia en cocina saludable\nMenor de 35 años')
    expect(r.hayErrores).toBe(true)
    expect(r.lineas[1]).toEqual({ texto: 'Menor de 35 años', como: 'PROHIBIDA' })
    expect(r.seGuardan).toEqual(['Experiencia en cocina saludable'])
  })

  it('Más de 200 caracteres apaga el guardado', () => {
    expect(revisarLineas('a'.repeat(200)).hayErrores).toBe(false)
    expect(revisarLineas('a'.repeat(201)).hayErrores).toBe(true)
  })

  it('mismasLineas compara en orden', () => {
    expect(mismasLineas(['a', 'b'], ['a', 'b'])).toBe(true)
    expect(mismasLineas(['a', 'b'], ['b', 'a'])).toBe(false)
    expect(mismasLineas([], [])).toBe(true)
  })
})

const conBusqueda = (
  candidato: string,
  estado: EstadoDeLaBusqueda,
  tiene = 0,
  menciona = 0,
): { candidato: string; busqueda: BusquedaEnElCv } => ({
  candidato,
  busqueda: {
    estado, tiene, menciona, total: 4, notaLoBuscado: null, notaCriteriosGenerales: null, lineas: [],
  },
})

describe('Qué buscar en el CV: el ranking', () => {
  // El orden de siempre de la maqueta: el del servidor.
  const deSiempre = [
    conBusqueda('Lucía', 'TERMINADA', 3, 1),
    conBusqueda('Mariana', 'TERMINADA', 4, 0),
    conBusqueda('Diego', 'TERMINADA', 2, 1),
    conBusqueda('Renzo', 'BUSCANDO'),
    conBusqueda('Jorge', 'TERMINADA', 1, 1),
    conBusqueda('Ana', 'TERMINADA', 1, 1),
    conBusqueda('Carla', 'SIN_TEXTO'),
  ]

  it('AC-17: por lo buscado: Mariana, Lucía, Diego, Jorge, Ana, Renzo, Carla', () => {
    expect(ordenarPorLoBuscado(deSiempre).map((f) => f.candidato)).toEqual([
      'Mariana', 'Lucía', 'Diego', 'Jorge', 'Ana', 'Renzo', 'Carla',
    ])
  })

  it('no toca el orden de entrada', () => {
    ordenarPorLoBuscado(deSiempre)
    expect(deSiempre[0]!.candidato).toBe('Lucía')
  })

  it('AC-16: la línea de estado dice listos, buscando y sin texto', () => {
    expect(lineaDeEstado(recuentosDeLaBusqueda(deSiempre))).toBe(
      '5 de 7 listos · 1 buscando · 1 CV sin texto',
    )
    expect(
      lineaDeEstado(recuentosDeLaBusqueda([conBusqueda('A', 'FALLIDA'), conBusqueda('B', 'PENDIENTE')])),
    ).toBe('0 de 2 listos · 1 pendiente · 1 no se pudo buscar')
  })

  it('lo que oye un lector de pantalla', () => {
    expect(puntosDichos(conBusqueda('Lucía', 'TERMINADA', 3, 1).busqueda)).toBe('3 de 4 requisitos')
    expect(puntosDichos(conBusqueda('Renzo', 'BUSCANDO').busqueda)).toBe('Buscando requisitos')
  })
})
