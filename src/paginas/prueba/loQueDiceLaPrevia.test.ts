/**
 * Lo que dicen la entradilla, la condición y «¿Empezar ahora?» antes de empezar (QA del ciclo 11).
 *
 * El defecto que esto fija: los tres textos eran fijos y nombraban el caso, los materiales y «los
 * archivos obligatorios» en todas las pruebas, también en una sin archivos o sin caso. Ahora se
 * arman con lo que se sabe antes de empezar —cuántas preguntas, cuántos obligatorios, cómo corre el
 * tiempo— y, para el caso y los materiales, que ya no viajan, una fórmula neutra: «el contenido».
 */

import { describe, expect, it } from 'vitest'
import type { EntregableRequerido, MiPrueba } from '@/api/tipos'
import { avisoDeEmpezar, comoCorreElTiempo, condicionDe, entradillaDe } from './loQueDiceLaPrevia'

const archivo = (id: number, esObligatorio: boolean): EntregableRequerido => ({
  id,
  nombre: `Archivo ${id}`,
  detalle: null,
  formato: 'ARCHIVO',
  esObligatorio,
  entregado: false,
})

const EN_UNA_SEMANA = new Date(Date.now() + 7 * 24 * 3_600_000).toISOString()

/** La del editor sin empezar, con reloj y fecha: lo que manda el backend desde el 10/10/2026. */
function prueba(parte: Partial<MiPrueba> = {}): MiPrueba {
  return {
    id: 1,
    estadoIntento: 'PENDIENTE',
    modalidad: 'CRONOMETRADA',
    iniciadoEn: null,
    venceEn: null,
    duracionMinutos: 90,
    enunciado: null,
    materiales: null,
    herramientasPermitidas: null,
    cambioTexto: null,
    preguntas: [],
    totalPreguntas: 6,
    entregables: [archivo(1, true), archivo(2, true), archivo(3, true), archivo(4, false)],
    plazoDias: null,
    consigna: null,
    delEditor: true,
    fechaLimite: EN_UNA_SEMANA,
    ...parte,
  }
}

/** La entradilla como se pinta: «…, y <b>…</b>.» o «….». */
const entradilla = (p: MiPrueba) => {
  const { abre, tiempo } = entradillaDe(p)
  return tiempo ? `${abre}, y ${tiempo}.` : `${abre}.`
}
const dialogo = (p: MiPrueba) => {
  const { aviso, alTerminar } = avisoDeEmpezar(p)
  return [`${aviso.resaltado}${aviso.resto}`, alTerminar].filter(Boolean).join(' ')
}

describe('cómo corre el tiempo, con la precedencia de la celda «Tiempo»', () => {
  it('el reloj manda; sin él, la fecha; sin fecha, los días; sin nada, nada', () => {
    expect(comoCorreElTiempo(prueba())).toBe('reloj')
    expect(comoCorreElTiempo(prueba({ duracionMinutos: null }))).toBe('fecha')
    expect(comoCorreElTiempo(prueba({ duracionMinutos: null, fechaLimite: null, plazoDias: 3 }))).toBe('dias')
    expect(comoCorreElTiempo(prueba({ duracionMinutos: null, fechaLimite: null }))).toBeNull()
    // La de plantilla toma su fecha de `venceEn`, no de `fechaLimite`.
    expect(comoCorreElTiempo(prueba({ delEditor: false, duracionMinutos: null, fechaLimite: null, venceEn: EN_UNA_SEMANA }))).toBe('fecha')
  })
})

describe('la prueba del editor', () => {
  it('con reloj, preguntas y obligatorios: los nombra con su número, y nada del caso ni de los materiales', () => {
    const p = prueba()
    expect(entradilla(p)).toBe('El contenido y las preguntas se abren al empezar, y desde ahí corre el tiempo.')
    expect(condicionDe(p)).toBe(
      'Una vez empezada no se puede pausar, ni para leer. Para entregar hay que responder las 6 preguntas y subir los 3 archivos obligatorios; si el tiempo termina con algo pendiente, queda sin completar.',
    )
    expect(dialogo(p)).toBe(
      'Al confirmar se abren el contenido de la prueba y sus 6 preguntas, y empieza a correr el tiempo, también mientras lees. No se detiene: si cierras el navegador, el cronómetro sigue corriendo. Al terminar, la prueba se entrega sola si está completa: si falta responder alguna pregunta o subir un archivo obligatorio, queda sin completar y no se califica.',
    )
    for (const texto of [entradilla(p), condicionDe(p), dialogo(p)]) expect(texto).not.toMatch(/caso|materiales/)
  })

  it('sin archivos: no habla de archivos en ninguno de los tres', () => {
    const p = prueba({ entregables: [] })
    expect(condicionDe(p)).toBe(
      'Una vez empezada no se puede pausar, ni para leer. Para entregar hay que responder las 6 preguntas; si el tiempo termina con algo pendiente, queda sin completar.',
    )
    expect(dialogo(p)).toContain('si falta responder alguna pregunta, queda sin completar y no se califica.')
    for (const texto of [entradilla(p), condicionDe(p), dialogo(p)]) expect(texto).not.toMatch(/archivo|entregable/)
  })

  it('con archivos pero ninguno obligatorio: tampoco exige subirlos', () => {
    const p = prueba({ entregables: [archivo(1, false), archivo(2, false)] })
    expect(condicionDe(p)).not.toMatch(/archivo/)
    expect(dialogo(p)).not.toMatch(/archivo/)
  })

  it('en singular: una pregunta y un obligatorio', () => {
    const p = prueba({ totalPreguntas: 1, entregables: [archivo(1, true)] })
    expect(entradilla(p)).toBe('El contenido y la pregunta se abren al empezar, y desde ahí corre el tiempo.')
    expect(condicionDe(p)).toContain('Para entregar hay que responder la pregunta y subir el archivo obligatorio;')
    expect(dialogo(p)).toContain('Al confirmar se abren el contenido de la prueba y su pregunta, y empieza a correr el tiempo')
  })

  it('sin preguntas, solo archivos: el contenido, en singular, y lo que exige es subirlos', () => {
    const p = prueba({ totalPreguntas: 0, entregables: [archivo(1, true), archivo(2, true)] })
    expect(entradilla(p)).toBe('El contenido de la prueba se abre al empezar, y desde ahí corre el tiempo.')
    expect(condicionDe(p)).toContain('Para entregar hay que subir los 2 archivos obligatorios;')
    expect(dialogo(p)).toContain('Al confirmar se abre el contenido de la prueba, y empieza a correr el tiempo')
    expect(dialogo(p)).toContain('si falta subir algún archivo obligatorio, queda sin completar')
  })

  it('sin reloj y con fecha: «hasta la fecha límite», sin cronómetro', () => {
    const p = prueba({ duracionMinutos: null, modalidad: 'PLAZO_ABIERTO' })
    expect(entradilla(p)).toBe('El contenido y las preguntas se abren al empezar, y desde ahí tienes hasta la fecha límite.')
    expect(condicionDe(p)).toContain('si llega la fecha límite con algo pendiente, queda sin completar.')
    expect(dialogo(p)).toContain('Al confirmar se abren el contenido de la prueba y sus 6 preguntas. Desde ese momento tienes hasta la fecha límite')
    expect(dialogo(p)).not.toContain('cronómetro')
  })

  it('con días desde que se empieza: corre el plazo, no un cronómetro', () => {
    const p = prueba({ duracionMinutos: null, fechaLimite: null, plazoDias: 3 })
    expect(entradilla(p)).toBe('El contenido y las preguntas se abren al empezar, y desde ahí corre el tiempo.')
    expect(dialogo(p)).toContain('y empieza a correr el plazo, también mientras lees. No se detiene: si cierras el navegador, el plazo sigue corriendo.')
  })

  it('sin tiempo ninguno: ni corre, ni se pausa, ni termina; solo lo que hay que entregar', () => {
    const p = prueba({ duracionMinutos: null, fechaLimite: null, plazoDias: null })
    expect(entradilla(p)).toBe('El contenido y las preguntas se abren al empezar.')
    expect(condicionDe(p)).toBe('Para entregar hay que responder las 6 preguntas y subir los 3 archivos obligatorios.')
    expect(dialogo(p)).toBe(
      'Al confirmar se abren el contenido de la prueba y sus 6 preguntas. Para entregarla hay que responder las 6 preguntas y subir los 3 archivos obligatorios.',
    )
    for (const texto of [entradilla(p), condicionDe(p), dialogo(p)]) expect(texto).not.toMatch(/tiempo|pausar|cronómetro/)
  })

  it('con un backend anterior, sin `totalPreguntas`, cuenta las preguntas que llegan', () => {
    const p = prueba({ totalPreguntas: undefined, preguntas: [{ id: 1 }, { id: 2 }] as MiPrueba['preguntas'] })
    expect(condicionDe(p)).toContain('responder las 2 preguntas')
  })
})

describe('la prueba de plantilla', () => {
  it('con reloj: entrega lo guardado al terminar', () => {
    const p = prueba({ delEditor: false, fechaLimite: null, totalPreguntas: 11, entregables: [archivo(1, true)] })
    expect(entradilla(p)).toBe('El contenido y las preguntas se abren al empezar, y desde ahí corre el tiempo.')
    expect(condicionDe(p)).toBe('Una vez empezada no se puede pausar, ni para leer. Si el tiempo termina, se entrega lo que hayas guardado.')
    expect(dialogo(p)).toBe(
      'Al confirmar se abren el contenido de la prueba y sus 11 preguntas, y empieza a correr el tiempo, también mientras lees. No se detiene: si cierras el navegador, el cronómetro sigue corriendo. Al terminar se entrega lo que hayas guardado.',
    )
  })

  it('con la fecha de la convocatoria y sin reloj: «si llega la fecha límite»', () => {
    const p = prueba({ delEditor: false, duracionMinutos: null, fechaLimite: null, plazoDias: 5, venceEn: EN_UNA_SEMANA })
    expect(condicionDe(p)).toBe('Una vez empezada no se puede pausar, ni para leer. Si llega la fecha límite, se entrega lo que hayas guardado.')
  })
})
