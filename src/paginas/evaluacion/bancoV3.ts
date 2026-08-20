/**
 * Los ocho formatos del banco v3, sin pintar nada.
 *
 * El examen dejo de ser «una opcion o un texto». Ahora hay ocho formas de
 * responder y seis de ellas necesitan mandar varias cosas a la vez: cual se
 * parece mas y cual menos, una nota por cada opcion, un orden, una lista de
 * marcadas, los campos de un caso. Todo eso viaja en un campo aparte, `detalle`,
 * y el backend comprueba su forma contra el tipo de la pregunta.
 *
 * **Por que importa acertar la forma.** Si el `detalle` no tiene la forma que
 * le toca a ese tipo, el backend contesta 400 y el candidato ve un error que
 * para el no significa nada: no puede corregirlo, porque el fallo no esta en lo
 * que respondio sino en como se lo mandamos. Por eso lo que se manda se arma
 * aqui, en un solo sitio, copiado del validador del backend
 * (`perfilintegral/service/ValidadorDetalleV3.java`).
 *
 * La otra mitad de la regla es que **no se manda nada a medias**: media
 * respuesta a un SJT-R tambien es un 400. De eso se encarga `queFalta`, que
 * ademas devuelve, en palabras del candidato, lo que le queda por hacer.
 *
 * Los componentes que dibujan cada formato estan en `Formatos.tsx`.
 */

import type { DetalleRespuesta, OpcionCandidato, PreguntaEvaluacion } from '@/api/tipos'

/** Como se responde una pregunta: con detalle, con una opcion o escribiendo. */
export type ModoRespuesta = 'DETALLE' | 'OPCION' | 'TEXTO'

/** Los seis formatos que no caben en «una opcion» ni en «un texto». */
const CON_DETALLE = ['EF-4', 'SJT-R', 'SEC', 'INV', 'DE', 'CD']

export function necesitaDetalle(tipo: string): boolean {
  return CON_DETALLE.includes(tipo)
}

export function modoDeRespuesta(pregunta: PreguntaEvaluacion): ModoRespuesta {
  // Primero el tipo: los formatos con detalle tambien traen opciones, asi que
  // mirar las opciones antes que el tipo los pintaria como si fueran radios.
  if (necesitaDetalle(pregunta.tipo)) return 'DETALLE'
  // `PC` es la opcion unica del banco v3 y `OPCION_MULTIPLE` la del banco
  // viejo. Se responden igual, asi que basta con que traiga opciones.
  if (pregunta.opciones?.length) return 'OPCION'
  return 'TEXTO'
}

/** Los ítems `V` piden un dato suelto —casi siempre un numero—, no un relato. */
export function esDatoCorto(tipo: string): boolean {
  return tipo === 'V'
}

// ---------- Leer lo que devuelve el servidor ----------

function comoNumero(valor: unknown): number | undefined {
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor
  if (typeof valor === 'string' && valor.trim() !== '') {
    const n = Number(valor)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

/**
 * Deja el detalle que llega del servidor en la forma que esta pantalla espera.
 *
 * Hace dos cosas, y las dos importan:
 *
 *   - **Solo sobreviven las claves conocidas.** Si algun dia la respuesta
 *     trajera puntajes o la clave de correccion, aqui se quedan fuera y no hay
 *     forma de pintarlos por descuido. El candidato nunca ve la nota.
 *   - Convierte lo que llegue como texto en numero. El detalle se guarda como
 *     `jsonb`, asi que un id puede volver como `"12"` o como `12`.
 */
export function normalizarDetalle(bruto: unknown): DetalleRespuesta | undefined {
  if (bruto === null || typeof bruto !== 'object') return undefined
  const fuente = bruto as Record<string, unknown>
  const limpio: DetalleRespuesta = {}

  const mas = comoNumero(fuente.mas)
  if (mas !== undefined) limpio.mas = mas
  const menos = comoNumero(fuente.menos)
  if (menos !== undefined) limpio.menos = menos

  if (fuente.calificaciones !== null && typeof fuente.calificaciones === 'object') {
    const notas: Record<string, number> = {}
    for (const [clave, valor] of Object.entries(fuente.calificaciones as object)) {
      const nota = comoNumero(valor)
      if (nota !== undefined && nota >= 1 && nota <= 5) notas[clave] = nota
    }
    if (Object.keys(notas).length > 0) limpio.calificaciones = notas
  }

  if (Array.isArray(fuente.orden)) {
    const orden = fuente.orden.map(comoNumero).filter((id): id is number => id !== undefined)
    if (orden.length > 0) limpio.orden = orden
  }

  // Una lista vacia si cuenta: en un INV significa «no reconozco ninguna», que
  // es una respuesta de verdad y no un hueco.
  if (Array.isArray(fuente.marcadas)) {
    limpio.marcadas = fuente.marcadas
      .map(comoNumero)
      .filter((id): id is number => id !== undefined)
  }

  if (fuente.campos !== null && typeof fuente.campos === 'object') {
    const campos: Record<string, string> = {}
    for (const [clave, valor] of Object.entries(fuente.campos as object)) {
      if (valor !== null && valor !== undefined) campos[clave] = String(valor)
    }
    if (Object.keys(campos).length > 0) limpio.campos = campos
  }

  return Object.keys(limpio).length > 0 ? limpio : undefined
}

// ---------- Los casos descompuestos (CD) ----------

export interface CampoDeCaso {
  /** La clave con la que viaja: el numero del campo, como cadena. */
  clave: string
  etiqueta: string
}

/**
 * Los campos que hay que llenar en un caso descompuesto.
 *
 * El backend todavia no manda ni las etiquetas ni cuantos son, asi que hay tres
 * escalones y ninguno deja la pantalla en blanco: sin campos que enseñar, el
 * candidato no tendria donde escribir y el item seria imposible de responder.
 */
export function camposDeCaso(pregunta: PreguntaEvaluacion): CampoDeCaso[] {
  const dados = pregunta.campos ?? []
  if (dados.length > 0) {
    return dados
      .slice()
      .sort((a, b) => a.orden - b.orden)
      .map((c) => ({ clave: String(c.orden), etiqueta: c.etiqueta }))
  }

  // Sin etiquetas, pero sabiendo cuantos son: se numeran.
  const cuantos = pregunta.casosPedidos ?? 0
  if (cuantos > 0) {
    return Array.from({ length: cuantos }, (_, i) => ({
      clave: String(i + 1),
      etiqueta: `Dato ${i + 1}`,
    }))
  }

  // Ni etiquetas ni cuenta: se reconstruye de lo ya respondido, y si tampoco hay
  // nada se deja un campo. Uno solo es poco, pero es responder; cero es un muro.
  const guardados = Object.keys(normalizarDetalle(pregunta.respuestaDetalle)?.campos ?? {})
  if (guardados.length > 0) {
    return guardados
      .slice()
      .sort((a, b) => Number(a) - Number(b))
      .map((clave) => ({ clave, etiqueta: `Dato ${clave}` }))
  }
  return [{ clave: '1', etiqueta: 'Tu respuesta' }]
}

// ---------- Que falta para poder mandarlo ----------

function idsDe(opciones: OpcionCandidato[] | null): number[] {
  return (opciones ?? []).map((o) => o.id)
}

/**
 * Lo que le falta al candidato para dar la pregunta por respondida, dicho para
 * el. Devuelve `null` cuando ya esta completa y se puede mandar.
 */
export function queFalta(
  pregunta: PreguntaEvaluacion,
  valor: DetalleRespuesta | undefined,
): string | null {
  const ids = idsDe(pregunta.opciones)

  switch (pregunta.tipo) {
    case 'EF-4': {
      const mas = valor?.mas
      const menos = valor?.menos
      if (mas === undefined && menos === undefined) {
        return 'Marca la que más se parece a ti y la que menos.'
      }
      if (mas === undefined) return 'Te falta marcar la que más se parece a ti.'
      if (menos === undefined) return 'Te falta marcar la que menos se parece a ti.'
      // El backend lo rechaza, asi que se avisa antes de mandarlo.
      if (mas === menos) return 'La que más y la que menos no pueden ser la misma.'
      return null
    }

    case 'SJT-R': {
      const notas = valor?.calificaciones ?? {}
      const faltan = ids.filter((id) => notas[String(id)] === undefined).length
      if (faltan === 0) return null
      return faltan === 1
        ? 'Te falta calificar una opción.'
        : `Te faltan ${faltan} opciones por calificar.`
    }

    case 'SEC': {
      const orden = valor?.orden ?? []
      const completo =
        orden.length === ids.length &&
        new Set(orden).size === ids.length &&
        orden.every((id) => ids.includes(id))
      return completo ? null : 'Deja los pasos en el orden que elijas y confírmalo.'
    }

    case 'INV': {
      if (valor?.marcadas !== undefined) return null
      return 'Marca las que reconozcas. Si no reconoces ninguna, dilo con la última casilla.'
    }

    case 'DE': {
      if (valor?.marcadas !== undefined) return null
      return 'Marca lo que esté mal. Si no encuentras nada, dilo con la última casilla.'
    }

    case 'CD': {
      const campos = valor?.campos ?? {}
      const faltan = camposDeCaso(pregunta).filter(
        (c) => (campos[c.clave] ?? '').trim() === '',
      ).length
      if (faltan === 0) return null
      return faltan === 1
        ? 'Te falta un campo por llenar.'
        : `Te faltan ${faltan} campos por llenar.`
    }

    default:
      return null
  }
}

/** Atajo de `queFalta`: se manda solo cuando el formato esta entero. */
export function estaCompleto(
  pregunta: PreguntaEvaluacion,
  valor: DetalleRespuesta | undefined,
): boolean {
  return valor !== undefined && queFalta(pregunta, valor) === null
}

/**
 * El `detalle` tal como lo espera el backend para ese tipo, y nada mas.
 *
 * Se recorta a proposito: el estado de la pantalla puede arrastrar restos de
 * otro formato —si alguien cambia el tipo de una pregunta, o al releer algo
 * viejo— y una clave de mas es un 400.
 */
export function detalleParaEnviar(
  pregunta: PreguntaEvaluacion,
  valor: DetalleRespuesta,
): DetalleRespuesta {
  switch (pregunta.tipo) {
    case 'EF-4':
      return { mas: valor.mas, menos: valor.menos }
    case 'SJT-R':
      return { calificaciones: valor.calificaciones ?? {} }
    case 'SEC':
      return { orden: valor.orden ?? [] }
    case 'INV':
    case 'DE':
      return { marcadas: valor.marcadas ?? [] }
    case 'CD': {
      const campos: Record<string, string> = {}
      for (const campo of camposDeCaso(pregunta)) {
        campos[campo.clave] = (valor.campos?.[campo.clave] ?? '').trim()
      }
      return { campos }
    }
    default:
      return {}
  }
}

// ---------- Utilidades de los componentes ----------

/**
 * El orden en el que se enseñan los pasos de un SEC: el que eligio el
 * candidato, y lo que falte detras.
 *
 * Nunca se cae a una lista vacia ni pierde un paso: si lo guardado viniera
 * incompleto, los que falten se añaden al final en el orden del servidor.
 */
export function ordenVisible(
  opciones: OpcionCandidato[] | null,
  valor: DetalleRespuesta | undefined,
): number[] {
  const ids = idsDe(opciones)
  const elegido = [...new Set(valor?.orden ?? [])].filter((id) => ids.includes(id))
  return [...elegido, ...ids.filter((id) => !elegido.includes(id))]
}

/** Mueve un paso una posicion arriba o abajo. Fuera de la lista no hace nada. */
export function moverPaso(orden: number[], desde: number, hacia: number): number[] {
  if (hacia < 0 || hacia >= orden.length) return orden
  const copia = [...orden]
  const paso = copia[desde]
  if (paso === undefined) return orden
  copia.splice(desde, 1)
  copia.splice(hacia, 0, paso)
  return copia
}
