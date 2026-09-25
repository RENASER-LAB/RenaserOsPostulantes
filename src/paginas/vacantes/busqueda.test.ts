/**
 * La lógica de buscar, acotar y ordenar, sin pantalla.
 *
 * Lo que se protege, en orden de lo que más se rompe sin que nada falle:
 *
 *   1. **Que «gestion» encuentre «Gestión» y «ingenier» a «Ingeniero/a»**, y que
 *      con dos palabras hagan falta las dos. Un buscador que exige la tilde no
 *      encuentra nada en un teléfono.
 *   2. **Que la relevancia ponga primero lo que empieza por lo escrito** y que
 *      «Recientes» mande las que no tienen fecha al final: el servidor las pondría
 *      las primeras.
 *   3. **Que un filtro solo aparezca si separa algo**, y que las cantidades de
 *      cada opción se calculen con los DEMÁS filtros puestos, no con el suyo:
 *      marcar Lima no puede dejar a Arequipa en (0).
 *   4. **Que la dirección se lea con lo que se entiende y se ignore lo demás**:
 *      `ciudad=04` es un departamento y se descarta; `ciudad=0801` es una ciudad
 *      sin vacantes y se conserva.
 *   5. **Que «Publicada hace…» cuente días del calendario de Lima**, no bloques
 *      de 24 horas.
 */

import { describe, expect, it } from 'vitest'
import type { VacantePublica } from '@/api/tipos'
import {
  ciudadesDistintas,
  contador,
  escribirEstado,
  etiquetas,
  grupos,
  indexar,
  leerEstado,
  lineaDeDonde,
  lineaDeLaTarjeta,
  modalidadCanonica,
  opcionesDeFecha,
  publicadaHace,
  resultados,
  SIN_FILTROS,
  SIN_INDICAR,
  type Estado,
} from './busqueda'

const AHORA = Date.parse('2026-09-25T15:00:00Z')
const DIA = 24 * 60 * 60 * 1000

function hace(dias: number): string {
  return new Date(AHORA - dias * DIA).toISOString()
}

let siguienteId = 1

function vacante(cambios: Partial<VacantePublica> = {}): VacantePublica {
  return {
    id: siguienteId++,
    titulo: 'Puesto',
    nombreEmpresa: 'RENASER CONSULTING S.A.C.',
    descripcion: 'Descripción',
    proposito: null,
    responsabilidades: null,
    requisitos: 'Ingeniería o afines',
    modalidad: null,
    horario: null,
    ubicacion: null,
    ciudad: null,
    publicadaEn: hace(1),
    remuneracion: { tipo: 'OCULTA', min: null, max: null, moneda: null, texto: 'No la publica', actualizadaEn: null },
    requisitosObjetivos: [],
    ...cambios,
  }
}

const LIMA = { codigo: '1501', nombre: 'Lima', departamento: 'Lima' }
const AREQUIPA = { codigo: '0401', nombre: 'Arequipa', departamento: 'Arequipa' }

/** Las nueve de producción, como quedan tras la migración y con Arequipa puesta. */
function lasDeProduccion(): VacantePublica[] {
  return [
    vacante({ titulo: 'Especialista en Gestión del Talento', modalidad: 'Presencial', ciudad: AREQUIPA, ubicacion: 'Selva Alegre', horario: '9am-6pm', publicadaEn: hace(0) }),
    vacante({ titulo: 'Especialista en Marketing Digital', modalidad: 'Presencial', ciudad: AREQUIPA, ubicacion: 'Selva Alegre', horario: '9am-6pm', publicadaEn: hace(3) }),
    vacante({ titulo: 'Ingeniero Civil Builder Junior', publicadaEn: hace(3) }),
    vacante({ titulo: 'Arquitecto Builder Junior', publicadaEn: hace(10) }),
    vacante({ titulo: 'Ingeniero/a de Infraestructura', publicadaEn: hace(10) }),
    vacante({ titulo: 'Líder de operaciones', publicadaEn: hace(40) }),
    vacante({ titulo: 'Desarrollador web', publicadaEn: null }),
    vacante({ titulo: 'Administrador', modalidad: 'PRESENCIAL', ciudad: LIMA, horario: 'Tiempo completo', publicadaEn: hace(40) }),
    vacante({ titulo: 'Asistente Administrativo', modalidad: 'PRESENCIAL', ciudad: LIMA, horario: 'Tiempo completo', publicadaEn: hace(40) }),
  ]
}

function estado(cambios: Partial<Estado> = {}): Estado {
  return { q: '', filtros: SIN_FILTROS, orden: 'relevantes', ...cambios }
}

function titulos(lista: ReturnType<typeof resultados>): string[] {
  return lista.map((v) => v.vacante.titulo)
}

describe('Buscar', () => {
  const indice = indexar(lasDeProduccion())

  it('sin nada escrito trae todas, de la más reciente a la más antigua y las sin fecha al final', () => {
    const lista = titulos(resultados(indice, estado(), AHORA))
    expect(lista).toHaveLength(9)
    expect(lista[0]).toBe('Especialista en Gestión del Talento')
    expect(lista.at(-1)).toBe('Desarrollador web')
  })

  it('«GESTION» encuentra «Gestión»: ni mayúsculas ni tildes cuentan', () => {
    expect(titulos(resultados(indice, estado({ q: 'GESTION' }), AHORA))).toEqual([
      'Especialista en Gestión del Talento',
    ])
  })

  it('«ingeniero» encuentra las dos del título y no las que solo lo mencionan en los requisitos', () => {
    expect(titulos(resultados(indice, estado({ q: 'ingeniero' }), AHORA))).toEqual([
      'Ingeniero Civil Builder Junior',
      'Ingeniero/a de Infraestructura',
    ])
  })

  it('encuentra partes de palabra y, con varias, exige todas', () => {
    expect(titulos(resultados(indice, estado({ q: 'ingenier' }), AHORA))).toHaveLength(2)
    expect(titulos(resultados(indice, estado({ q: 'ingeniero civil' }), AHORA))).toEqual([
      'Ingeniero Civil Builder Junior',
    ])
    expect(titulos(resultados(indice, estado({ q: '  ingeniero civil  ' }), AHORA))).toHaveLength(1)
  })

  it('busca también en la empresa, la modalidad, la ciudad y la zona', () => {
    expect(titulos(resultados(indice, estado({ q: 'selva alegre' }), AHORA))).toHaveLength(2)
    expect(titulos(resultados(indice, estado({ q: 'lima' }), AHORA))).toHaveLength(2)
    expect(titulos(resultados(indice, estado({ q: 'presencial' }), AHORA))).toHaveLength(4)
    expect(titulos(resultados(indice, estado({ q: 'renaser' }), AHORA))).toHaveLength(9)
  })

  it('«analista» no encuentra nada y no revienta con signos raros', () => {
    expect(resultados(indice, estado({ q: 'analista' }), AHORA)).toHaveLength(0)
    expect(resultados(indice, estado({ q: '/?&%"' }), AHORA)).toHaveLength(0)
  })
})

describe('Ordenar', () => {
  it('relevantes: primero el título que empieza por lo escrito; recientes: por fecha', () => {
    const indice = indexar([
      vacante({ titulo: 'Analista de Datos', publicadaEn: hace(20) }),
      vacante({ titulo: 'Coordinador de Analistas', publicadaEn: hace(1) }),
    ])
    expect(titulos(resultados(indice, estado({ q: 'analista' }), AHORA))).toEqual([
      'Analista de Datos',
      'Coordinador de Analistas',
    ])
    expect(titulos(resultados(indice, estado({ q: 'analista', orden: 'recientes' }), AHORA))).toEqual([
      'Coordinador de Analistas',
      'Analista de Datos',
    ])
  })

  it('los cuatro grupos de relevancia, y dentro de cada uno la más reciente primero', () => {
    const indice = indexar([
      vacante({ titulo: 'Contador senior', ubicacion: 'Jefe', publicadaEn: hace(5) }),
      vacante({ titulo: 'Jefe de contadores', publicadaEn: hace(9) }),
      vacante({ titulo: 'Jefe de contadores', publicadaEn: hace(2) }),
      vacante({ titulo: 'Contador', nombreEmpresa: 'Jefe S.A.', publicadaEn: hace(1) }),
      vacante({ titulo: 'Asistente', nombreEmpresa: 'Jefe contador', publicadaEn: hace(0) }),
    ])
    const lista = resultados(indice, estado({ q: 'jefe contador' }), AHORA)
    expect(lista.map((v) => [v.vacante.titulo, v.vacante.nombreEmpresa])).toEqual([
      ['Jefe de contadores', 'RENASER CONSULTING S.A.C.'],
      ['Jefe de contadores', 'RENASER CONSULTING S.A.C.'],
      ['Contador', 'Jefe S.A.'],
      ['Contador senior', 'RENASER CONSULTING S.A.C.'],
      ['Asistente', 'Jefe contador'],
    ])
    expect(lista[0]!.publicadaEn).toBeGreaterThan(lista[1]!.publicadaEn!)
  })

  it('con «Recientes» la que no tiene fecha va la última', () => {
    const indice = indexar([
      vacante({ titulo: 'Analista sin fecha', publicadaEn: null }),
      vacante({ titulo: 'Analista de hace 3 días', publicadaEn: hace(3) }),
    ])
    expect(titulos(resultados(indice, estado({ q: 'analista', orden: 'recientes' }), AHORA))).toEqual([
      'Analista de hace 3 días',
      'Analista sin fecha',
    ])
  })
})

describe('Acotar', () => {
  it('la ciudad agrupa por código, la modalidad sin mayúsculas ni tildes, y el filtro solo aparece si separa algo', () => {
    const indice = indexar(lasDeProduccion())
    const g = grupos(indice, estado(), AHORA)
    expect(g.map((x) => x.clave)).toEqual(['ciudades'])
    expect(g[0]!.opciones).toEqual([
      { valor: '0401', nombre: 'Arequipa', cantidad: 2 },
      { valor: '1501', nombre: 'Lima', cantidad: 2 },
      { valor: SIN_INDICAR, nombre: 'Sin indicar', cantidad: 5 },
    ])
  })

  it('una sola ciudad no separa nada: ni con cinco sin indicar al lado', () => {
    const indice = indexar([
      vacante({ ciudad: LIMA }),
      vacante({ ciudad: LIMA }),
      vacante(),
      vacante(),
    ])
    expect(grupos(indice, estado(), AHORA)).toEqual([])
  })

  it('con «Remoto» publicada, la modalidad aparece con Presencial y Remoto en orden fijo, y las variantes son una', () => {
    const indice = indexar([
      vacante({ modalidad: 'Presencial' }),
      vacante({ modalidad: 'PRESENCIAL' }),
      vacante({ modalidad: 'Remoto' }),
      vacante({ modalidad: 'Hibrido' }),
      vacante({ modalidad: 'Híbrido' }),
      vacante({ modalidad: 'test' }),
      vacante(),
    ])
    const modalidad = grupos(indice, estado(), AHORA).find((g) => g.clave === 'modalidades')!
    expect(modalidad.opciones.map((o) => [o.nombre, o.cantidad])).toEqual([
      ['Presencial', 2],
      ['Híbrido', 2],
      ['Remoto', 1],
      ['test', 1],
      ['Sin indicar', 1],
    ])
  })

  it('las opciones suman dentro del grupo y los grupos se combinan; una opción a (0) sigue en su sitio', () => {
    const indice = indexar(lasDeProduccion())
    const conLima = estado({ filtros: { ...SIN_FILTROS, ciudades: ['1501'] } })
    expect(resultados(indice, conLima, AHORA)).toHaveLength(2)
    const ciudad = grupos(indice, conLima, AHORA)[0]!
    expect(ciudad.opciones.find((o) => o.nombre === 'Arequipa')!.cantidad).toBe(2)

    const limaYSinIndicar = estado({ filtros: { ...SIN_FILTROS, ciudades: ['1501', SIN_INDICAR] } })
    expect(resultados(indice, limaYSinIndicar, AHORA)).toHaveLength(7)

    const conTexto = estado({ q: 'ingeniero', filtros: { ...SIN_FILTROS, ciudades: ['0401'] } })
    expect(resultados(indice, conTexto, AHORA)).toHaveLength(0)
    const opciones = grupos(indice, conTexto, AHORA)[0]!.opciones
    expect(opciones.map((o) => [o.nombre, o.cantidad])).toEqual([
      ['Arequipa', 0],
      ['Lima', 0],
      ['Sin indicar', 2],
    ])
  })

  it('«Publicada» cuenta con la hora dada y solo aparece si alguna ventana separa', () => {
    const indice = indexar([
      vacante({ publicadaEn: hace(0) }),
      vacante({ publicadaEn: hace(3) }),
      vacante({ publicadaEn: hace(10) }),
      vacante({ publicadaEn: hace(40) }),
    ])
    expect(opcionesDeFecha(indice, estado(), AHORA)!.map((o) => [o.nombre, o.cantidad])).toEqual([
      ['Cualquier fecha', 4],
      ['Últimas 24 horas', 1],
      ['Últimos 7 días', 2],
      ['Últimos 30 días', 3],
    ])
    expect(resultados(indice, estado({ filtros: { ...SIN_FILTROS, publicada: '7d' } }), AHORA)).toHaveLength(2)
  })

  it('con todas de hace más de 30 días, o todas de hoy, «Publicada» no se muestra; y las sin fecha solo entran en «Cualquier fecha»', () => {
    expect(opcionesDeFecha(indexar([vacante({ publicadaEn: hace(40) }), vacante({ publicadaEn: hace(60) })]), estado(), AHORA)).toBeNull()
    expect(opcionesDeFecha(indexar([vacante({ publicadaEn: hace(0) }), vacante({ publicadaEn: hace(0) })]), estado(), AHORA)).toBeNull()
    const conUnaSinFecha = indexar([vacante({ publicadaEn: hace(0) }), vacante({ publicadaEn: null })])
    expect(opcionesDeFecha(conUnaSinFecha, estado(), AHORA)).not.toBeNull()
    expect(resultados(conUnaSinFecha, estado({ filtros: { ...SIN_FILTROS, publicada: '30d' } }), AHORA)).toHaveLength(1)
  })
})

describe('La dirección', () => {
  it('lee lo que entiende y conserva la ciudad aunque hoy no tenga vacantes', () => {
    const e = leerEstado(new URLSearchParams('q=analista&ciudad=1501&ciudad=0801&publicada=7d&orden=recientes'))
    expect(e).toEqual({
      q: 'analista',
      filtros: { ciudades: ['1501', '0801'], modalidades: [], empresas: [], publicada: '7d' },
      orden: 'recientes',
    })
  })

  it('ignora un departamento, una ventana desconocida, otro orden y parámetros que no existen', () => {
    const e = leerEstado(new URLSearchParams('ciudad=04&ciudad=sin-indicar&publicada=ayer&orden=alfabetico&color=rojo&modalidad=Remoto'))
    expect(e.filtros.ciudades).toEqual([SIN_INDICAR])
    expect(e.filtros.modalidades).toEqual(['remoto'])
    expect(e.filtros.publicada).toBeNull()
    expect(e.orden).toBe('relevantes')
  })

  it('«recientes» solo viaja con texto, y «relevantes» nunca', () => {
    expect(leerEstado(new URLSearchParams('orden=recientes')).orden).toBe('relevantes')
    expect(escribirEstado(estado({ q: 'x', orden: 'recientes' })).toString()).toBe('q=x&orden=recientes')
    expect(escribirEstado(estado({ q: 'x', orden: 'relevantes' })).toString()).toBe('q=x')
    expect(escribirEstado(estado({ q: '', orden: 'recientes' })).toString()).toBe('')
  })

  it('escribe y vuelve a leer lo mismo, con signos raros incluidos', () => {
    const original = estado({
      q: 'a/b?c&d%e"f',
      filtros: { ciudades: ['1501', SIN_INDICAR], modalidades: ['test'], empresas: ['renaser consulting s.a.c.'], publicada: '30d' },
      orden: 'recientes',
    })
    expect(leerEstado(escribirEstado(original))).toEqual(original)
  })
})

describe('Las etiquetas y el contador', () => {
  it('nombran la ciudad por la lista, por el catálogo o por su código; y la modalidad por su forma canónica', () => {
    const indice = indexar(lasDeProduccion())
    const e = estado({ filtros: { ciudades: ['1501', '0801', '0802'], modalidades: ['remoto', 'test'], empresas: [], publicada: '7d' } })
    expect(etiquetas(e, indice, new Map([['0801', 'Cusco']])).map((x) => x.nombre)).toEqual([
      'Lima', 'Cusco', '0802', 'Remoto', 'test', 'Últimos 7 días',
    ])
  })

  it('«9 vacantes abiertas», «2 de 9 vacantes», «Ninguna vacante coincide con «analista» en Lima»', () => {
    expect(contador(9, 9, estado(), [])).toBe('9 vacantes abiertas')
    expect(contador(1, 1, estado(), [])).toBe('1 vacante abierta')
    expect(contador(2, 9, estado({ q: 'ingeniero' }), [])).toBe('2 de 9 vacantes')
    expect(contador(0, 9, estado({ q: 'analista' }), [])).toBe('Ninguna vacante coincide con «analista»')
    expect(contador(0, 9, estado({ q: 'analista' }), [{ grupo: 'ciudades', valor: '1501', nombre: 'Lima' }]))
      .toBe('Ninguna vacante coincide con «analista» en Lima')
    expect(contador(0, 9, estado(), [{ grupo: 'ciudades', valor: '0801', nombre: 'Cusco' }]))
      .toBe('Ninguna vacante coincide en Cusco')
  })
})

describe('«Publicada hace…»', () => {
  it('cuenta días del calendario de Lima y después semanas y la fecha', () => {
    expect(publicadaHace(null, AHORA)).toBeNull()
    expect(publicadaHace(AHORA - 2 * 60 * 60 * 1000, AHORA)).toBe('Publicada hoy')
    expect(publicadaHace(AHORA - 1 * DIA, AHORA)).toBe('Publicada ayer')
    expect(publicadaHace(AHORA - 3 * DIA, AHORA)).toBe('Publicada hace 3 días')
    expect(publicadaHace(AHORA - 13 * DIA, AHORA)).toBe('Publicada hace 13 días')
    expect(publicadaHace(AHORA - 14 * DIA, AHORA)).toBe('Publicada hace 2 semanas')
    expect(publicadaHace(AHORA - 62 * DIA, AHORA)).toBe('Publicada hace 8 semanas')
    expect(publicadaHace(AHORA - 63 * DIA, AHORA)).toBe('Publicada el 24 de julio')
    expect(publicadaHace(Date.parse('2025-08-12T15:00:00Z'), AHORA)).toBe('Publicada el 12 de agosto de 2025')
  })

  it('algo publicado anoche en Lima es de «ayer» aunque hayan pasado pocas horas', () => {
    // Las 23:30 de Lima del 24 son las 04:30 UTC del 25; ahora son las 10:00 de Lima del 25.
    expect(publicadaHace(Date.parse('2026-09-25T04:30:00Z'), AHORA)).toBe('Publicada ayer')
  })
})

describe('La ficha, la tarjeta y la cinta', () => {
  it('la ficha no repite la zona si es la ciudad, y sin ciudad enseña solo la zona', () => {
    expect(lineaDeDonde({ modalidad: 'Presencial', ciudad: AREQUIPA, ubicacion: 'Selva Alegre', horario: '9am-6pm' }))
      .toEqual(['Presencial', 'Arequipa', 'Selva Alegre', '9am-6pm'])
    expect(lineaDeDonde({ modalidad: 'PRESENCIAL', ciudad: LIMA, ubicacion: ' LIMA ', horario: 'Tiempo completo' }))
      .toEqual(['Presencial', 'Lima', 'Tiempo completo'])
    expect(lineaDeDonde({ modalidad: null, ciudad: null, ubicacion: 'Selva Alegre', horario: null }))
      .toEqual(['Selva Alegre'])
  })

  it('la tarjeta dice modalidad · ciudad, o la zona si no hay ciudad, y escribe la modalidad como el filtro', () => {
    expect(lineaDeLaTarjeta({ modalidad: 'PRESENCIAL', ciudad: AREQUIPA, ubicacion: 'Selva Alegre' })).toBe('Presencial · Arequipa')
    expect(lineaDeLaTarjeta({ modalidad: 'Presencial', ciudad: null, ubicacion: 'Selva Alegre' })).toBe('Presencial · Selva Alegre')
    expect(lineaDeLaTarjeta({ modalidad: '  ', ciudad: null, ubicacion: '   ' })).toBe('')
    expect(modalidadCanonica('hibrido')).toBe('Híbrido')
    expect(modalidadCanonica('test')).toBe('test')
  })

  it('la cinta cuenta ciudades del catálogo, sin «Fuera del Perú» ni las que no tienen', () => {
    expect(ciudadesDistintas(lasDeProduccion())).toBe(2)
    expect(ciudadesDistintas([
      vacante({ ciudad: LIMA }),
      vacante({ ciudad: LIMA }),
      vacante({ ciudad: { codigo: 'EXT', nombre: 'Fuera del Perú', departamento: null } }),
      vacante({ ubicacion: 'Selva Alegre' }),
    ])).toBe(1)
    expect(ciudadesDistintas([])).toBe(0)
  })
})
