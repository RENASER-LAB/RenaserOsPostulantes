/**
 * Los contadores en vivo de la prueba.
 *
 * Lo que se protege aqui es la regla que no es obvia y que un contador fijo
 * habria pintado mal: **la cuota de preguntas depende de si la prueba pide
 * entregables**. Con entregables rigen los 8-10 universales y 3-5 especificas;
 * sin ellos la prueba es un cuestionario, sus preguntas SON la prueba, y basta
 * con una. Añadir el primer entregable cambia lo que la pantalla exige.
 */

import { describe, expect, it } from 'vitest'
import { balanceDeLaVersion } from './cuotas'
import type {
  CriterioDeRubrica,
  EntregableDePrueba,
  PreguntaDePrueba,
  VersionPrueba,
} from '../api/tipos'

const VERSION: VersionPrueba = {
  id: 1,
  plantillaPruebaId: 1,
  version: 1,
  enunciado: 'Resuelve esto',
  materiales: null,
  herramientasPermitidas: null,
  minutosExtra: null,
  modalidad: 'CRONOMETRADA',
  duracionMinutos: 90,
  plazoDias: null,
  minutoCambioMin: 30,
  minutoCambioMax: 50,
  estado: 'BORRADOR',
  publicadaEn: null,
  guiaCalificacion: null,
  urlConsigna: null,
}

const preguntas = (universales: number, especificas: number): PreguntaDePrueba[] => [
  ...Array.from({ length: universales }, (_, i) => ({
    id: 100 + i, codigo: `U${i}`, enunciado: '…', tipo: 'UNIVERSAL' as const, puestoId: null,
  })),
  ...Array.from({ length: especificas }, (_, i) => ({
    id: 200 + i, codigo: `T${i}`, enunciado: '…', tipo: 'ESPECIFICA' as const, puestoId: 1,
  })),
]

const rubricaDe = (...puntos: number[]): CriterioDeRubrica[] =>
  puntos.map((p, i) => ({
    id: 300 + i, codigo: `C${i}`, nombre: '…', descripcion: null, puntos: p,
    metodoVerificacion: 'AGENTE' as const,
  }))

const UN_ENTREGABLE: EntregableDePrueba[] = [
  { id: 1, nombre: 'El documento', detalle: '…', formato: 'CUALQUIERA', esObligatorio: true },
]

describe('la rúbrica', () => {
  it('suma 100 exactos y no otra cosa', () => {
    const b = balanceDeLaVersion(VERSION, [], [], rubricaDe(40, 30, 20, 10))
    expect(b.rubrica.hay).toBe(100)
    expect(b.rubrica.cumple).toBe(true)
    expect(b.rubrica.falta).toBeNull()
  })

  it('dice cuántos puntos sobran cuando se pasa', () => {
    const b = balanceDeLaVersion(VERSION, [], [], rubricaDe(40, 40, 40, 20))
    expect(b.rubrica.hay).toBe(140)
    expect(b.rubrica.cumple).toBe(false)
    expect(b.rubrica.falta).toBe('sobran 40 puntos')
  })

  it('dice cuántos faltan cuando se queda corta', () => {
    const b = balanceDeLaVersion(VERSION, [], [], rubricaDe(40, 30))
    expect(b.rubrica.falta).toBe('faltan 30 puntos')
  })

  /*
    ⚠️ En coma flotante `33.33 * 3` no da 100 exacto. Sin la tolerancia de 0,01
    —la misma que el `BigDecimal` del backend— la pantalla diria que falta lo que
    el servidor va a aceptar sin rechistar.
  */
  it('acepta el redondeo de tres tercios, igual que el backend', () => {
    const b = balanceDeLaVersion(VERSION, [], [], rubricaDe(33.33, 33.33, 33.34))
    expect(b.rubrica.hay).toBe(100)
    expect(b.rubrica.cumple).toBe(true)
  })

  it('un criterio sin puntos cuenta como cero, no revienta', () => {
    const rubrica = rubricaDe(60)
    rubrica.push({
      id: 999, codigo: 'X', nombre: '…', descripcion: null, puntos: null,
      metodoVerificacion: 'PERSONA',
    })
    expect(balanceDeLaVersion(VERSION, [], [], rubrica).rubrica.hay).toBe(60)
  })
})

describe('la cuota de preguntas depende de los entregables', () => {
  it('sin entregables basta una pregunta, y no rige la cuota', () => {
    const b = balanceDeLaVersion(VERSION, preguntas(0, 1), [], rubricaDe(100))
    expect(b.pideEntregables).toBe(false)
    expect(b.universales).toBeNull()
    expect(b.especificas).toBeNull()
    expect(b.preguntasDelCuestionario?.cumple).toBe(true)
    expect(b.listaParaPublicar).toBe(true)
  })

  it('sin entregables y sin ninguna pregunta, no hay prueba', () => {
    const b = balanceDeLaVersion(VERSION, [], [], rubricaDe(100))
    expect(b.preguntasDelCuestionario?.cumple).toBe(false)
    expect(b.preguntasDelCuestionario?.falta).toBe('faltan 1 pregunta')
    expect(b.listaParaPublicar).toBe(false)
  })

  /*
    El caso que existe este archivo para fijar: la MISMA version, las mismas
    preguntas, y añadir un entregable cambia lo que se exige. Un cuestionario de
    veinte preguntas propias es publicable; en cuanto pide algo que entregar, se
    le exigen universales y especificas que no tiene.
  */
  it('añadir el primer entregable enciende la cuota de RF-83', () => {
    const veinte = preguntas(0, 20)
    const sin = balanceDeLaVersion(VERSION, veinte, [], rubricaDe(100))
    const con = balanceDeLaVersion(VERSION, veinte, UN_ENTREGABLE, rubricaDe(100))

    expect(sin.listaParaPublicar).toBe(true)
    expect(con.listaParaPublicar).toBe(false)
    expect(con.universales?.falta).toBe('faltan 8 preguntas')
    expect(con.especificas?.falta).toBe('sobran 15 preguntas')
  })

  it('con entregables y la cuota cumplida, todo verde', () => {
    const b = balanceDeLaVersion(
      VERSION, preguntas(8, 3), UN_ENTREGABLE, rubricaDe(50, 50),
    )
    expect(b.universales?.cumple).toBe(true)
    expect(b.especificas?.cumple).toBe(true)
    expect(b.listaParaPublicar).toBe(true)
  })
})

describe('la duración, que es lo primero que el backend mira', () => {
  it('una cronometrada de 45 minutos no pasa', () => {
    const b = balanceDeLaVersion(
      { ...VERSION, duracionMinutos: 45 }, preguntas(0, 1), [], rubricaDe(100),
    )
    expect(b.duracion?.cumple).toBe(false)
    expect(b.duracion?.falta).toBe('faltan 15 minutos')
    expect(b.listaParaPublicar).toBe(false)
  })

  it('una de plazo abierto no tiene duración que medir', () => {
    const b = balanceDeLaVersion(
      { ...VERSION, modalidad: 'PLAZO_ABIERTO', duracionMinutos: null, plazoDias: 3 },
      preguntas(0, 1), [], rubricaDe(100),
    )
    expect(b.duracion).toBeNull()
    expect(b.listaParaPublicar).toBe(true)
  })
})
