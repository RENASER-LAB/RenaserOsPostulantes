/**
 * Lo que le falta a una vacante en borrador para publicarse, dicho con su verbo.
 *
 * ⚠️ **No todo se «elige».** La frase se armaba con una sola plantilla,
 * «Antes hay que elegir …, aquí abajo», y salían cosas como «elegir publicar
 * sus preguntas propias» (QA-PP-06) o «elegir publicar su cuestionario
 * técnico». Cada falta lleva ahora su verbo: se ELIGE la prueba del puesto, se
 * PUBLICA el cuestionario, y las preguntas propias se publican en su editor,
 * que es otra página y por eso va aparte, con su enlace.
 */

export interface FaltasDeLaVacante {
  /** Rinde el banco del nivel y no hay ninguno publicado. */
  bancoDelNivel: boolean
  /** Rinde la prueba del puesto y no tiene ninguna elegida. */
  pruebaDelPuesto: boolean
  /** Rinde el cuestionario técnico y no está publicado. */
  cuestionarioTecnico: boolean
  /** Tiene preguntas propias y no están publicadas. */
  preguntasPropias: boolean
  /**
   * Rinde la prueba técnica escrita en el editor (V67) y no está publicada. Se
   * publica en su página, «Armar la prueba», y por eso va aparte con su enlace.
   */
  pruebaTecnica?: boolean
}

export interface LoQueFalta {
  /** Lo que se arregla en la configuración de más abajo, ya con su verbo; nulo si nada. */
  aquiAbajo: string | null
  /** Las preguntas propias, que se publican en su editor. */
  preguntasPropias: boolean
  /**
   * La prueba técnica escrita en el editor, que se publica en «Armar la prueba».
   * Solo viaja cuando falta: las vacantes de antes no la tienen.
   */
  pruebaTecnica?: true
  hayAlgo: boolean
}

const enumerar = (cosas: string[]) =>
  cosas.length <= 1 ? (cosas[0] ?? '') : `${cosas.slice(0, -1).join(', ')} y ${cosas[cosas.length - 1]}`

export function loQueFaltaParaPublicar(f: FaltasDeLaVacante): LoQueFalta {
  const aElegir = [
    f.bancoDelNivel ? 'un banco de preguntas publicado de su nivel' : null,
    f.pruebaDelPuesto ? 'la prueba del puesto' : null,
  ].filter((c): c is string => c !== null)
  const partes = [
    aElegir.length > 0 ? `elegir ${enumerar(aElegir)}` : null,
    f.cuestionarioTecnico ? 'publicar su cuestionario técnico' : null,
  ].filter((c): c is string => c !== null)
  const aquiAbajo = partes.length > 0 ? enumerar(partes) : null
  const pruebaTecnica = f.pruebaTecnica === true
  return {
    aquiAbajo,
    preguntasPropias: f.preguntasPropias,
    ...(pruebaTecnica ? { pruebaTecnica: true as const } : {}),
    hayAlgo: aquiAbajo !== null || f.preguntasPropias || pruebaTecnica,
  }
}
