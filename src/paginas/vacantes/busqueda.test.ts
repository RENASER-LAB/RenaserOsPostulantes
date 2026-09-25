/**
 * La lógica de buscar, acotar y ordenar, sin pantalla.
 *
 * Lo que se protege, en orden de lo que más se rompe sin que nada falle:
 *
 *   1. **Que «gestion» encuentre «Gestión» y «ingenier» a «Ingeniero/a»**, y que
 *      con dos palabras hagan falta las dos. Un buscador que exige la tilde no
 *      encuentra nada en un teléfono.
 *   2. **Que la relevancia ponga primero lo que empieza por lo escrito**, que
 *      sin texto ponga primero las vacantes más completas, y que «Recientes»
 *      mande las que no tienen fecha al final: el servidor las pondría las
 *      primeras.
 *   3. **Que ciudad, modalidad y fecha salgan siempre** —empresa solo si hay
 *      más de una— y que las cantidades de cada opción se calculen con los
 *      DEMÁS filtros puestos, no con el suyo: marcar Lima no puede dejar a
 *      Arequipa en (0).
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
  completitudDe,
  contador,
  datosDeLaTarjeta,
  detalleDelContador,
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
  resumenDe,
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

  it('sin nada escrito y con «Relevantes» trae todas, primero las más completas; entre iguales la más reciente y las sin fecha al final', () => {
    // Las cuatro con modalidad, ciudad, horario y resumen (4 de 5) por fecha;
    // después las cinco que solo traen resumen (1 de 5), por fecha y la sin fecha al final.
    expect(titulos(resultados(indice, estado(), AHORA))).toEqual([
      'Especialista en Gestión del Talento',
      'Especialista en Marketing Digital',
      'Administrador',
      'Asistente Administrativo',
      'Ingeniero Civil Builder Junior',
      'Arquitecto Builder Junior',
      'Ingeniero/a de Infraestructura',
      'Líder de operaciones',
      'Desarrollador web',
    ])
  })

  it('sin nada escrito y con «Recientes» va por fecha, sin mirar lo completas que están', () => {
    const lista = titulos(resultados(indice, estado({ orden: 'recientes' }), AHORA))
    expect(lista).toEqual([
      'Especialista en Gestión del Talento',
      'Especialista en Marketing Digital',
      'Ingeniero Civil Builder Junior',
      'Arquitecto Builder Junior',
      'Ingeniero/a de Infraestructura',
      'Líder de operaciones',
      'Administrador',
      'Asistente Administrativo',
      'Desarrollador web',
    ])
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

  it('sin texto, «Relevantes» cuenta modalidad, ciudad, horario, resumen y sueldo publicado', () => {
    const FIJA = { tipo: 'FIJA' as const, min: 3500, max: null, moneda: 'PEN', texto: 'S/ 3 500', actualizadaEn: null }
    const completa = vacante({ modalidad: 'Remoto', ciudad: LIMA, horario: '9am-6pm', proposito: 'Algo', remuneracion: FIJA })
    expect(completitudDe(completa)).toBe(5)
    // El sueldo oculto no cuenta; el propósito o la descripción cuentan una sola vez.
    expect(completitudDe(vacante({ modalidad: 'Remoto', ciudad: LIMA, horario: '9am-6pm', proposito: 'Algo' }))).toBe(4)
    // Solo espacios es vacío, y sin propósito ni descripción no hay resumen.
    expect(completitudDe(vacante({ modalidad: '  ', horario: ' ', descripcion: '   ', proposito: null }))).toBe(0)
    // La zona no es la ciudad: «Selva Alegre» no dice en qué ciudad está.
    expect(completitudDe(vacante({ ubicacion: 'Selva Alegre', descripcion: null }))).toBe(0)
    expect(completitudDe(vacante({ ciudad: AREQUIPA, descripcion: null }))).toBe(1)
  })

  it('sin texto, «Relevantes» deja delante a la más completa aunque sea más vieja, y entre iguales la sin fecha va la última', () => {
    const FIJA = { tipo: 'FIJA' as const, min: 3500, max: null, moneda: 'PEN', texto: 'S/ 3 500', actualizadaEn: null }
    const indice = indexar([
      vacante({ titulo: 'Nueva y escueta', publicadaEn: hace(0) }),
      vacante({ titulo: 'Completa sin fecha', modalidad: 'Remoto', horario: '9am-6pm', publicadaEn: null }),
      vacante({ titulo: 'Vieja y completa', modalidad: 'Remoto', horario: '9am-6pm', publicadaEn: hace(40) }),
      vacante({ titulo: 'Con sueldo', modalidad: 'Remoto', horario: '9am-6pm', remuneracion: FIJA, publicadaEn: hace(20) }),
    ])
    expect(titulos(resultados(indice, estado(), AHORA))).toEqual([
      'Con sueldo',
      'Vieja y completa',
      'Completa sin fecha',
      'Nueva y escueta',
    ])
    // Los filtros acotan igual; el orden de lo que queda no cambia de regla.
    expect(titulos(resultados(indice, estado({ filtros: { ...SIN_FILTROS, publicada: '30d' } }), AHORA))).toEqual([
      'Con sueldo',
      'Nueva y escueta',
    ])
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

  it('a la misma fecha, al milisegundo, y con lo mismo completo, quedan en el orden en que llegan, en los tres órdenes', () => {
    // El backend ya las manda de la más reciente a la más antigua con microsegundos;
    // aquí solo se leen milisegundos, y un empate no reordena lo que él ya decidió.
    const mismoInstante = hace(40)
    const llegan = [
      vacante({ titulo: 'Analista que llega primero', publicadaEn: mismoInstante }),
      vacante({ titulo: 'Analista que llega segundo', publicadaEn: mismoInstante }),
      vacante({ titulo: 'Analista que llega tercero', publicadaEn: mismoInstante }),
    ]
    for (const orden of [llegan, [...llegan].reverse()]) {
      const esperado = orden.map((v) => v.titulo)
      const indice = indexar(orden)
      expect(titulos(resultados(indice, estado(), AHORA))).toEqual(esperado)
      expect(titulos(resultados(indice, estado({ orden: 'recientes' }), AHORA))).toEqual(esperado)
      expect(titulos(resultados(indice, estado({ q: 'analista' }), AHORA))).toEqual(esperado)
    }
  })
})

describe('Acotar', () => {
  it('la ciudad agrupa por código, la modalidad sin mayúsculas ni tildes, y las dos salen siempre con sus cantidades', () => {
    const indice = indexar(lasDeProduccion())
    const g = grupos(indice, estado(), AHORA)
    expect(g.map((x) => x.clave)).toEqual(['ciudades', 'modalidades'])
    expect(g[0]!.opciones).toEqual([
      { valor: '0401', nombre: 'Arequipa', cantidad: 2 },
      { valor: '1501', nombre: 'Lima', cantidad: 2 },
      { valor: SIN_INDICAR, nombre: 'Sin indicar', cantidad: 5 },
    ])
    // «Presencial» y «PRESENCIAL» son una opción, aunque sea la única modalidad escrita.
    expect(g[1]!.opciones).toEqual([
      { valor: 'presencial', nombre: 'Presencial', cantidad: 4 },
      { valor: SIN_INDICAR, nombre: 'Sin indicar', cantidad: 5 },
    ])
  })

  it('una sola ciudad, o ninguna, también sale; empresa solo con más de una', () => {
    const unaCiudad = indexar([vacante({ ciudad: LIMA }), vacante({ ciudad: LIMA }), vacante(), vacante()])
    const g = grupos(unaCiudad, estado(), AHORA)
    expect(g.map((x) => x.clave)).toEqual(['ciudades', 'modalidades'])
    expect(g[0]!.opciones.map((o) => [o.nombre, o.cantidad])).toEqual([['Lima', 2], ['Sin indicar', 2]])
    expect(g[1]!.opciones.map((o) => [o.nombre, o.cantidad])).toEqual([['Sin indicar', 4]])

    const todasConCiudad = grupos(indexar([vacante({ ciudad: LIMA })]), estado(), AHORA)
    expect(todasConCiudad[0]!.opciones.map((o) => o.nombre)).toEqual(['Lima'])

    const dosEmpresas = grupos(indexar([vacante(), vacante({ nombreEmpresa: 'Otra S.A.' })]), estado(), AHORA)
    expect(dosEmpresas.map((x) => x.clave)).toEqual(['ciudades', 'modalidades', 'empresas'])
    expect(grupos(indexar([]), estado(), AHORA)).toEqual([])
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

  it('con todas de hace más de 30 días, «Publicada» sale igual, con sus ceros; y las sin fecha solo entran en «Cualquier fecha»', () => {
    const viejas = indexar([vacante({ publicadaEn: hace(40) }), vacante({ publicadaEn: hace(60) })])
    expect(opcionesDeFecha(viejas, estado(), AHORA).map((o) => [o.nombre, o.cantidad])).toEqual([
      ['Cualquier fecha', 2],
      ['Últimas 24 horas', 0],
      ['Últimos 7 días', 0],
      ['Últimos 30 días', 0],
    ])
    const conUnaSinFecha = indexar([vacante({ publicadaEn: hace(0) }), vacante({ publicadaEn: null })])
    expect(opcionesDeFecha(conUnaSinFecha, estado(), AHORA).map((o) => o.cantidad)).toEqual([2, 1, 1, 1])
    expect(resultados(conUnaSinFecha, estado({ filtros: { ...SIN_FILTROS, publicada: '30d' } }), AHORA)).toHaveLength(1)
    expect(opcionesDeFecha(indexar([]), estado(), AHORA)).toEqual([])
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

  it('«recientes» viaja con o sin texto, y «relevantes» nunca', () => {
    expect(leerEstado(new URLSearchParams('orden=recientes')).orden).toBe('recientes')
    expect(leerEstado(new URLSearchParams('orden=relevantes')).orden).toBe('relevantes')
    expect(escribirEstado(estado({ q: 'x', orden: 'recientes' })).toString()).toBe('q=x&orden=recientes')
    expect(escribirEstado(estado({ q: 'x', orden: 'relevantes' })).toString()).toBe('q=x')
    expect(escribirEstado(estado({ q: '', orden: 'recientes' })).toString()).toBe('orden=recientes')
    expect(escribirEstado(estado({ q: '', orden: 'relevantes' })).toString()).toBe('')
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
    // El singular también en «de 1 vacante».
    expect(contador(1, 1, estado({ q: 'x' }), [])).toBe('1 de 1 vacante')
  })

  it('el contador se acompaña con lo buscado y, si es el único filtro, la ciudad', () => {
    const lima = { grupo: 'ciudades' as const, valor: '1501', nombre: 'Lima' }
    expect(detalleDelContador(estado(), [])).toBe('')
    expect(detalleDelContador(estado({ q: '  líder ' }), [])).toBe('para «líder»')
    expect(detalleDelContador(estado({ q: 'líder' }), [lima])).toBe('para «líder» en Lima')
    expect(detalleDelContador(estado(), [lima])).toBe('en Lima')
    // «en Sin indicar», «en Últimos 7 días» o «en Presencial» no se leen: no se dicen.
    expect(detalleDelContador(estado(), [{ grupo: 'ciudades', valor: SIN_INDICAR, nombre: 'Sin indicar' }])).toBe('')
    expect(detalleDelContador(estado(), [{ grupo: 'publicada', valor: '7d', nombre: 'Últimos 7 días' }])).toBe('')
    expect(detalleDelContador(estado({ q: 'x' }), [lima, { grupo: 'ciudades', valor: '0401', nombre: 'Arequipa' }])).toBe('para «x»')
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

  it('la tarjeta a lo ancho da cada dato por separado, sin pintar el que falta y nombrando siempre el sueldo', () => {
    expect(datosDeLaTarjeta(vacante({ modalidad: 'PRESENCIAL', ciudad: AREQUIPA, ubicacion: 'Selva Alegre', horario: ' 9am-6pm ' })))
      .toEqual({ donde: 'Arequipa', modalidad: 'Presencial', horario: '9am-6pm', sueldo: { texto: 'Sueldo sin publicar', publicado: false } })
    expect(datosDeLaTarjeta(vacante({ ubicacion: '  Selva Alegre  ' })).donde).toBe('Selva Alegre')
    expect(datosDeLaTarjeta(vacante({ modalidad: ' ', ubicacion: ' ', horario: '  ' })))
      .toEqual({ donde: null, modalidad: null, horario: null, sueldo: { texto: 'Sueldo sin publicar', publicado: false } })
    const RANGO = { tipo: 'RANGO' as const, min: 3500, max: 4200, moneda: 'PEN', texto: 'S/ 3 500 a 4 200', actualizadaEn: null }
    expect(datosDeLaTarjeta(vacante({ remuneracion: RANGO })).sueldo).toEqual({ texto: 'S/ 3 500 a 4 200', publicado: true })
  })

  it('el resumen es el propósito o, si falta, la descripción; solo espacios cuenta como vacío, igual que en la completitud', () => {
    expect(resumenDe({ proposito: 'Liderar el equipo', descripcion: 'Otra cosa' })).toBe('Liderar el equipo')
    expect(resumenDe({ proposito: null, descripcion: 'La descripción' })).toBe('La descripción')
    // C2-F-02: un propósito en blanco no tapa la descripción.
    expect(resumenDe({ proposito: '   ', descripcion: '  La descripción\n' })).toBe('La descripción')
    expect(resumenDe({ proposito: ' \n\t ', descripcion: '   ' })).toBeNull()
    expect(resumenDe({ proposito: null, descripcion: null })).toBeNull()
    // La tarjeta y el orden dicen lo mismo: hay resumen si y solo si la completitud lo cuenta.
    for (const [proposito, descripcion] of [['   ', 'Algo'], ['   ', '  '], [null, null], ['Algo', null]] as const) {
      const v = vacante({ proposito, descripcion })
      expect(completitudDe(v), `${JSON.stringify([proposito, descripcion])}`).toBe(resumenDe(v) === null ? 0 : 1)
    }
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
