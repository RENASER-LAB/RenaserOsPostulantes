/**
 * Lo que el backend va a comprobar al publicar, calculado mientras se compone.
 *
 * No es una copia de la validacion por gusto de duplicarla: es que
 * `publicarVersion` **para en la primera regla que falla** y devuelve un solo
 * mensaje. Con la rubrica en 140 y tres preguntas de menos, publicar dice lo de
 * la duracion, se arregla, dice lo de las preguntas, se arregla, y solo entonces
 * dice lo de la rubrica. Tres viajes para enterarse de tres cosas que ya se
 * sabian. Aqui se calculan las tres a la vez y se enseñan mientras se escribe.
 *
 * ⚠️ **La verdad sigue siendo del backend.** Esto orienta; publicar es quien
 * decide, y su mensaje se enseña tal cual venga. Si algun dia las reglas de
 * `ServicioPlantillaPruebaImpl` cambian y esto no, lo que pasa es que la pantalla
 * promete verde y el servidor dice que no — molesto, pero no rompe nada.
 *
 * Los numeros salen de ahi, uno a uno:
 *   - RF-83: 8 a 10 universales y 3 a 5 especificas, **solo si hay entregables**.
 *     Sin entregables la prueba es un cuestionario y sus preguntas SON la prueba:
 *     basta con una.
 *   - RF-86/89: la rubrica suma 100 exactos, con la misma tolerancia de 0,01 que
 *     usa el `BigDecimal` del backend.
 *   - Una prueba CRONOMETRADA dura de 60 a 120 minutos. Esta es la **primera**
 *     que el backend comprueba, antes que las preguntas y que la rubrica.
 */

import type {
  CriterioDeRubrica,
  EntregableDePrueba,
  PreguntaDePrueba,
  VersionPrueba,
} from '../api/tipos'

export const UNIVERSALES_MIN = 8
export const UNIVERSALES_MAX = 10
export const ESPECIFICAS_MIN = 3
export const ESPECIFICAS_MAX = 5
export const DURACION_MIN = 60
export const DURACION_MAX = 120
export const TOTAL_RUBRICA = 100

/*
  La misma tolerancia que el backend (`TOLERANCIA = 0.01`), y aqui hace ademas un
  segundo trabajo: en coma flotante `33.33 + 33.33 + 33.34` no da exactamente
  100, y sin margen la pantalla diria que falta lo que no falta.
*/
const TOLERANCIA = 0.01

/** Una cuenta frente a su cuota, en la forma en que la pantalla la pinta. */
export interface Cuenta {
  /** Lo que hay hoy. */
  hay: number
  /** Lo que hace falta, ya redactado: «8 a 10», «100», «al menos 1». */
  pide: string
  cumple: boolean
  /**
   * Que hacer si no cumple, dicho en concreto: «faltan 3», «sobran 12 puntos».
   * Nulo cuando cumple — un texto de ayuda sobre algo que ya esta bien es ruido.
   */
  falta: string | null
}

export interface Balance {
  rubrica: Cuenta
  universales: Cuenta | null
  especificas: Cuenta | null
  /** Solo cuando la prueba NO pide entregables: entonces basta una pregunta. */
  preguntasDelCuestionario: Cuenta | null
  /** Solo en las CRONOMETRADAS: la de plazo abierto no tiene duracion que medir. */
  duracion: Cuenta | null
  /** Si hay entregables, rige la cuota de RF-83; si no, la prueba es un cuestionario. */
  pideEntregables: boolean
  /** Todo verde: publicar deberia pasar. **Deberia** — decide el backend. */
  listaParaPublicar: boolean
}

export function balanceDeLaVersion(
  version: VersionPrueba,
  preguntas: PreguntaDePrueba[],
  entregables: EntregableDePrueba[],
  rubrica: CriterioDeRubrica[],
): Balance {
  const pideEntregables = entregables.length > 0

  const suma = rubrica.reduce((total, c) => total + (c.puntos ?? 0), 0)
  const cuentaRubrica = enRango(redondear(suma), TOTAL_RUBRICA, TOTAL_RUBRICA, {
    unidad: 'punto',
    pide: `${TOTAL_RUBRICA} exactos`,
    margen: TOLERANCIA,
  })

  const universales = preguntas.filter((p) => p.tipo === 'UNIVERSAL').length
  const especificas = preguntas.filter((p) => p.tipo === 'ESPECIFICA').length

  const duracion =
    version.modalidad === 'CRONOMETRADA'
      ? enRango(version.duracionMinutos ?? 0, DURACION_MIN, DURACION_MAX, {
          unidad: 'minuto',
          pide: `${DURACION_MIN} a ${DURACION_MAX} minutos`,
        })
      : null

  const balance: Balance = {
    rubrica: cuentaRubrica,
    universales: pideEntregables
      ? enRango(universales, UNIVERSALES_MIN, UNIVERSALES_MAX, { unidad: 'pregunta' })
      : null,
    especificas: pideEntregables
      ? enRango(especificas, ESPECIFICAS_MIN, ESPECIFICAS_MAX, { unidad: 'pregunta' })
      : null,
    /*
      Cuenta TODAS las preguntas, no solo las universales: en un cuestionario las
      preguntas son la prueba y el backend solo mira que haya al menos una, del
      tipo que sea. El cuestionario tecnico de Administrador tiene veinte y
      ninguna es universal.
    */
    preguntasDelCuestionario: pideEntregables
      ? null
      : enRango(preguntas.length, 1, Number.POSITIVE_INFINITY, {
          unidad: 'pregunta',
          pide: 'al menos 1',
        }),
    duracion,
    pideEntregables,
    listaParaPublicar: false,
  }

  balance.listaParaPublicar = [
    balance.duracion,
    balance.universales,
    balance.especificas,
    balance.preguntasDelCuestionario,
    balance.rubrica,
  ].every((c) => c === null || c.cumple)

  return balance
}

/*
  Dos decimales, que es hasta donde llega la columna `puntos` de la base. Sin
  esto, sumar 33,33 tres veces enseña «99.99000000000001» en la pantalla.
*/
const redondear = (n: number) => Math.round(n * 100) / 100

function enRango(
  hay: number,
  min: number,
  max: number,
  opciones: { unidad: string; pide?: string; margen?: number },
): Cuenta {
  const margen = opciones.margen ?? 0
  const cumple = hay >= min - margen && hay <= max + margen
  const pide = opciones.pide ?? (min === max ? `${min}` : `${min} a ${max}`)

  return {
    hay,
    pide,
    cumple,
    falta: cumple ? null : hay < min ? faltan(min - hay, opciones.unidad) : sobran(hay - max, opciones.unidad),
  }
}

/*
  «Faltan 3 preguntas» y no «3 < 8». La cuenta ya esta a la vista al lado; lo que
  esta linea añade es cuanto hay que moverse, que es lo unico que no se ve solo.
*/
const faltan = (cuantos: number, unidad: string) =>
  `faltan ${plural(redondear(cuantos), unidad)}`

const sobran = (cuantos: number, unidad: string) =>
  `sobran ${plural(redondear(cuantos), unidad)}`

/* Las tres unidades son regulares en español, asi que basta con la ese. */
const plural = (cuantos: number, unidad: string) =>
  `${cuantos} ${unidad}${cuantos === 1 ? '' : 's'}`
