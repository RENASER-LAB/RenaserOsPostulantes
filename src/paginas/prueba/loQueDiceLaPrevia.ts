/**
 * Lo que dicen, antes de empezar, la entradilla, la condición junto a «Empezar prueba» y el
 * diálogo «¿Empezar ahora?». Se arma con lo que la prueba tiene, sin inventar nada.
 *
 * **Lo que se sabe y se dice con certeza:** cuántas preguntas son (`totalPreguntas`), cuántos
 * archivos hay y cuántos son obligatorios, y cómo corre el tiempo —reloj, días o fecha límite—.
 *
 * **Lo que no se sabe:** si hay caso o materiales. Desde el 10/10/2026 no viajan hasta empezar
 * (`MiPrueba`), así que se habla de «el contenido de la prueba»: ni promete un caso que quizá no
 * hay, ni niega uno que sí. Antes se decía «el caso, los materiales y las preguntas» en todas, y
 * «subir los archivos obligatorios» en una prueba sin archivos (QA del ciclo 11).
 *
 * Sin reloj, ni días, ni fecha no se habla del tiempo: ni «corre», ni «no se puede pausar», ni
 * «si el tiempo termina».
 */

import type { MiPrueba } from '@/api/tipos'

/** Cómo corre el tiempo, con la misma precedencia que la celda «Tiempo» de la ficha. */
export type ComoCorre = 'reloj' | 'dias' | 'fecha' | null

/**
 * La fecha límite que se enseña. La del editor la manda aparte (`fechaLimite`, V68); la de la
 * plantilla, antes de empezar, es `venceEn`: la fecha de cierre de la convocatoria o la que se le
 * dio a mano.
 */
export const fechaLimiteDe = (prueba: MiPrueba): string | null =>
  prueba.delEditor ? (prueba.fechaLimite ?? null) : prueba.venceEn

/** Cuántas preguntas son. Antes de empezar las preguntas no llegan: lo dice `totalPreguntas`. */
export const cuantasPreguntas = (prueba: MiPrueba): number => prueba.totalPreguntas ?? prueba.preguntas.length

/** Con reloj, el reloj (la fecha puede acortarlo); sin él, la fecha; sin fecha, los días. */
export function comoCorreElTiempo(prueba: MiPrueba): ComoCorre {
  if (prueba.duracionMinutos) return 'reloj'
  if (fechaLimiteDe(prueba)) return 'fecha'
  if (prueba.plazoDias) return 'dias'
  return null
}

/** Un trozo dicho en negrita y lo que le sigue, para pintarlo sin HTML. */
export interface Frase {
  resaltado: string
  resto: string
}

interface LoQueTiene {
  preguntas: number
  obligatorios: number
  tiempo: ComoCorre
  delEditor: boolean
}

const loQueTiene = (prueba: MiPrueba): LoQueTiene => ({
  preguntas: cuantasPreguntas(prueba),
  obligatorios: prueba.entregables.filter((e) => e.esObligatorio).length,
  tiempo: comoCorreElTiempo(prueba),
  delEditor: prueba.delEditor === true,
})

/**
 * «el contenido de la prueba y sus 6 preguntas», y si el verbo va en plural. Sin preguntas, solo
 * el contenido; con una, «su pregunta».
 */
function loQueSeAbre(preguntas: number): { que: string; plural: boolean } {
  const contenido = 'el contenido de la prueba'
  if (preguntas === 0) return { que: contenido, plural: false }
  if (preguntas === 1) return { que: `${contenido} y su pregunta`, plural: true }
  return { que: `${contenido} y sus ${preguntas} preguntas`, plural: true }
}

/** «responder las 6 preguntas y subir el archivo obligatorio»; vacío si no hay nada que exigir. */
function loQueSeExige({ preguntas, obligatorios }: LoQueTiene): string {
  const partes: string[] = []
  if (preguntas === 1) partes.push('responder la pregunta')
  else if (preguntas > 1) partes.push(`responder las ${preguntas} preguntas`)
  if (obligatorios === 1) partes.push('subir el archivo obligatorio')
  else if (obligatorios > 1) partes.push(`subir los ${obligatorios} archivos obligatorios`)
  return partes.join(' y ')
}

/** «responder alguna pregunta o subir un archivo obligatorio», según lo que haya. */
function loQuePuedeFaltar({ preguntas, obligatorios }: LoQueTiene): string {
  const partes: string[] = []
  if (preguntas > 0) partes.push('responder alguna pregunta')
  if (obligatorios > 0) partes.push(preguntas > 0 ? 'subir un archivo obligatorio' : 'subir algún archivo obligatorio')
  return partes.join(' o ')
}

const conMayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1)

const NO_SE_PAUSA = 'Una vez empezada no se puede pausar, ni para leer.'

/**
 * La entradilla de arriba, en una frase y corta: qué se abre al empezar y, si lo hay, que desde ahí
 * corre el tiempo (lo que va en negrita). Que leer también cuenta lo dice la condición, «ni para
 * leer», y el diálogo lo repite. Corta a propósito: en dos líneas a 360 px es lo que deja ver
 * «Empezar prueba» al abrir en un teléfono de 375×667 con reloj, fecha y archivos obligatorios.
 */
export function entradillaDe(prueba: MiPrueba): { abre: string; tiempo: string | null } {
  const t = loQueTiene(prueba)
  const abre =
    t.preguntas === 0
      ? 'El contenido de la prueba se abre al empezar'
      : `El contenido y ${t.preguntas === 1 ? 'la pregunta' : 'las preguntas'} se abren al empezar`
  if (t.tiempo === 'fecha') return { abre, tiempo: 'desde ahí tienes hasta la fecha límite' }
  if (t.tiempo) return { abre, tiempo: 'desde ahí corre el tiempo' }
  return { abre, tiempo: null }
}

/**
 * La condición junto a «Empezar prueba». La del editor no se entrega con huecos (decisión 11): dice
 * qué hay que completar; la de plantilla entrega lo guardado. Vacía si no hay nada que decir.
 */
export function condicionDe(prueba: MiPrueba): string {
  const t = loQueTiene(prueba)
  const frases: string[] = []
  if (t.tiempo) frases.push(NO_SE_PAUSA)
  const alTerminar = t.tiempo === 'fecha' ? 'si llega la fecha límite' : 'si el tiempo termina'
  if (t.delEditor) {
    const exige = loQueSeExige(t)
    if (exige) {
      frases.push(
        t.tiempo
          ? `Para entregar hay que ${exige}; ${alTerminar} con algo pendiente, queda sin completar.`
          : `Para entregar hay que ${exige}.`,
      )
    }
  } else if (t.tiempo) {
    frases.push(`${conMayuscula(alTerminar)}, se entrega lo que hayas guardado.`)
  }
  return frases.join(' ')
}

/** El diálogo «¿Empezar ahora?»: qué se abre, cómo corre el tiempo y qué pasa al terminar. */
export function avisoDeEmpezar(prueba: MiPrueba): { aviso: Frase; alTerminar: string } {
  const t = loQueTiene(prueba)
  const { que, plural } = loQueSeAbre(t.preguntas)
  const abre = `Al confirmar ${plural ? 'se abren' : 'se abre'} ${que}`

  let aviso: Frase
  if (t.tiempo === 'reloj') {
    aviso = {
      resaltado: `${abre}, y empieza a correr el tiempo`,
      resto: ', también mientras lees. No se detiene: si cierras el navegador, el cronómetro sigue corriendo.',
    }
  } else if (t.tiempo === 'dias') {
    aviso = {
      resaltado: `${abre}, y empieza a correr el plazo`,
      resto: ', también mientras lees. No se detiene: si cierras el navegador, el plazo sigue corriendo.',
    }
  } else if (t.tiempo === 'fecha') {
    aviso = {
      resaltado: `${abre}.`,
      resto: ' Desde ese momento tienes hasta la fecha límite, también para leer, y el tiempo sigue corriendo aunque cierres el navegador.',
    }
  } else {
    aviso = { resaltado: `${abre}.`, resto: '' }
  }

  let alTerminar = ''
  if (t.delEditor) {
    const falta = loQuePuedeFaltar(t)
    if (!t.tiempo) {
      const exige = loQueSeExige(t)
      alTerminar = exige ? `Para entregarla hay que ${exige}.` : ''
    } else {
      alTerminar = falta
        ? `Al terminar, la prueba se entrega sola si está completa: si falta ${falta}, queda sin completar y no se califica.`
        : 'Al terminar, la prueba se entrega sola.'
    }
  } else if (t.tiempo) {
    alTerminar = 'Al terminar se entrega lo que hayas guardado.'
  }
  return { aviso, alTerminar }
}
