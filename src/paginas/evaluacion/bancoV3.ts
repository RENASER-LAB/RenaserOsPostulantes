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
 * Cuatro escalones, de lo mejor a lo peor, y ninguno deja la pantalla en
 * blanco: sin campos que enseñar, el candidato no tendria donde escribir y el
 * item seria imposible de responder.
 *
 *   1. Las etiquetas de verdad, si el backend las manda.
 *   2. `casosPedidos`, que si manda: dice cuantos son, aunque no como se llaman.
 *   3. El «(N campos)» que el propio enunciado lleva escrito.
 *   4. Lo que ya estuviera respondido.
 *
 * El escalon 3 existe porque los dos primeros dependen del servidor y este no:
 * el numero esta en el texto que el candidato ya esta leyendo.
 */
export function camposDeCaso(pregunta: PreguntaEvaluacion): CampoDeCaso[] {
  const dados = pregunta.campos ?? []
  if (dados.length > 0) {
    return dados
      .slice()
      .sort((a, b) => a.orden - b.orden)
      .map((c) => ({ clave: String(c.orden), etiqueta: c.etiqueta }))
  }

  // Sin etiquetas, pero sabiendo cuantos son: se numeran. «Campo 1 de 6» y no
  // «Dato 1» porque asi el candidato sabe cuantos le quedan sin ir a contarlos.
  const cuantos = pregunta.casosPedidos ?? camposQueDiceElEnunciado(pregunta.enunciado)
  if (cuantos > 0) {
    return Array.from({ length: cuantos }, (_, i) => ({
      clave: String(i + 1),
      etiqueta: `Campo ${i + 1} de ${cuantos}`,
    }))
  }

  // Ni etiquetas ni cuenta: se reconstruye de lo ya respondido, y si tampoco hay
  // nada se deja un campo. Uno solo es poco, pero es responder; cero es un muro.
  const guardados = Object.keys(normalizarDetalle(pregunta.respuestaDetalle)?.campos ?? {})
  if (guardados.length > 0) {
    return guardados
      .slice()
      .sort((a, b) => Number(a) - Number(b))
      .map((clave) => ({ clave, etiqueta: `Campo ${clave}` }))
  }
  return [{ clave: '1', etiqueta: 'Tu respuesta' }]
}

/** El «(6 campos)» que el enunciado de un CD lleva escrito. Cero si no lo dice. */
export function camposQueDiceElEnunciado(enunciado: string | null | undefined): number {
  const dicho = /\(\s*(\d+)\s*campos?\b/i.exec(enunciado ?? '')
  return dicho ? Number(dicho[1]) : 0
}

// ---------- Los items V · varios datos en un mismo enunciado ----------

/**
 * Que se le pide a un subcampo de un item `V`.
 *
 * `NUMERO` es el motivo de todo esto. Un `V` no es una pregunta suelta: su
 * enunciado trae varios datos separados por «·», y antes se pintaban todos
 * dentro de un mismo cuadro de texto. Ahi cabia cualquier cosa, asi que
 * «Años haciendo este trabajo» aceptaba un nombre y nadie avisaba.
 */
export type ClaseDeDato = 'NUMERO' | 'LISTA' | 'TEXTO'

export interface SubcampoV {
  /** Su posicion, 1..n. Es la clave con la que se guarda y se vuelve a leer. */
  clave: string
  /** Lo que se pinta encima del campo, sacado del propio enunciado. */
  etiqueta: string
  clase: ClaseDeDato
  /** Solo en `LISTA`: las opciones que ofrecia el enunciado, en su orden. */
  opciones: string[]
  /** Solo en `TEXTO`, si el enunciado pone tope: «(texto ≤ 40 car.)». */
  maximo: number | null
  /**
   * Si el enunciado lo marca como hueco que hay que llenar: un `___`, una lista
   * para elegir o un «(texto ≤ N car.)».
   *
   * Un trozo sin ninguna de esas marcas queda opcional **a proposito**. En la
   * base hay enunciados cortados a media frase —«Nombre exacto de»— y bloquear
   * la entrega por un fragmento que nadie puede contestar seria peor que el
   * problema que se esta arreglando.
   */
  obligatorio: boolean
}

/** El enunciado de un `V` separa sus subcampos con este punto. */
const SEPARADOR_V = '·'

/** Como se junta lo respondido para mandarlo: el mismo separador, con espacios. */
const UNION_V = ' · '

/** El hueco que hay que llenar, tal como lo escribe el documento: «___». */
const HUECO = /_{2,}/g

/**
 * Una lista para elegir: «(nunca / esporadica / diaria)».
 *
 * Se exige **espacio a los dos lados** de la barra. Sin eso, «< S/ 100K» —soles,
 * en el item del presupuesto— se partiria en «< S» y «100K», y el candidato
 * veria dos opciones que no existen.
 */
const LISTA = /\(([^()]*?\s\/\s[^()]*?)\)/

/** «(texto ≤ 40 car.)»: es texto libre aunque su etiqueta hable de años. */
const TOPE_TEXTO = /\([^)]*\btexto\b[^)]*?(\d+)\s*car/i

/**
 * Palabras que delatan que se pide una cantidad.
 *
 * Van sin tildes porque la etiqueta se compara sin ellas: asi «Años» y «Anos»
 * caen en el mismo sitio y no hace falta duplicar la lista.
 */
const PIDEN_NUMERO = [
  'ano', 'anos', 'mes', 'meses', 'semana', 'semanas', 'dia', 'dias',
  'hora', 'horas', 'minuto', 'minutos', 'edad', 'cuanto', 'cuanta',
  'cuantos', 'cuantas', 'numero', 'cantidad', 'veces', 'tardanza',
  'tardanzas', 'falta', 'faltas', 'persona', 'personas', 'turno', 'turnos',
  'frente', 'frentes', 'cese', 'ceses', 'dotacion', 'porcentaje',
]

function sinTildes(texto: string): string {
  // ̀-ͯ son las tildes sueltas que deja NFD al separarlas de su letra.
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Deja la etiqueta legible: sin espacios de mas y sin la puntuacion del final. */
function limpiarEtiqueta(bruto: string): string {
  return bruto.replace(/\s+/g, ' ').replace(/[\s:;.,]+$/, '').trim()
}

/**
 * Si esa etiqueta pide una cantidad.
 *
 * Lo que va entre parentesis no cuenta: en «Certificados... (nombre +
 * institucion + año)» la palabra «año» dice que escribir, no pide un numero.
 * Sin quitarlos, ese campo se volveria numerico y no dejaria escribir el
 * nombre del certificado.
 */
function pideNumero(etiqueta: string): boolean {
  const limpio = sinTildes(etiqueta.replace(/\([^)]*\)/g, ' '))
  if (limpio.includes('%')) return true
  return PIDEN_NUMERO.some((palabra) => new RegExp(`\\b${palabra}\\b`).test(limpio))
}

/** Un trozo del enunciado ya clasificado: que se pide y como se pinta. */
function construirSubcampo(bruto: string, conHueco: boolean, clave: string): SubcampoV {
  const base = { clave, opciones: [] as string[], maximo: null as number | null }

  const lista = LISTA.exec(bruto)
  if (lista) {
    const opciones = (lista[1] ?? '').split(/\s+\/\s+/).map((o) => o.trim()).filter((o) => o !== '')
    return {
      ...base,
      etiqueta: limpiarEtiqueta(bruto.replace(lista[0], '')) || `Dato ${clave}`,
      clase: 'LISTA',
      opciones,
      obligatorio: true,
    }
  }

  const tope = TOPE_TEXTO.exec(bruto)
  if (tope) {
    return {
      ...base,
      etiqueta: limpiarEtiqueta(bruto.replace(/\([^)]*\)/g, ' ')) || `Dato ${clave}`,
      clase: 'TEXTO',
      maximo: Number(tope[1]),
      obligatorio: true,
    }
  }

  const etiqueta = limpiarEtiqueta(bruto) || `Dato ${clave}`
  return {
    ...base,
    etiqueta,
    clase: pideNumero(etiqueta) ? 'NUMERO' : 'TEXTO',
    obligatorio: conHueco,
  }
}

/**
 * Las etiquetas que salen de un trozo, una por hueco.
 *
 * Casi siempre el nombre del dato va **delante** del hueco —«Años haciendo este
 * trabajo: ___»—, pero cuando lo de delante es solo la entrada de la frase y
 * acaba en dos puntos, el nombre esta **detras**: «De tu ultima semana tipica:
 * ___% dirigiendo personas». Por eso se miran los dos lados.
 */
function etiquetasDelTrozo(trozo: string): { bruto: string; conHueco: boolean }[] {
  const huecos = [...trozo.matchAll(HUECO)]
  if (huecos.length === 0) return [{ bruto: trozo, conHueco: false }]

  const salida: { bruto: string; conHueco: boolean }[] = []
  let desde = 0
  for (let i = 0; i < huecos.length; i++) {
    const hueco = huecos[i]
    if (!hueco) continue
    const inicio = hueco.index ?? 0
    const largo = hueco[0]?.length ?? 0
    const antes = trozo.slice(desde, inicio).trim()
    const finSiguiente = huecos[i + 1]?.index ?? trozo.length
    const despues = trozo.slice(inicio + largo, finSiguiente).trim()

    const entrada = antes === '' || /:$/.test(antes)
    let bruto = entrada ? despues || antes : antes
    // Dos huecos seguidos pueden caer en la misma etiqueta —«___ ceses sobre
    // una dotacion de ___ personas»—: al segundo se le da lo que va detras,
    // que es justo lo que lo distingue del primero.
    if (bruto !== '' && bruto === salida[salida.length - 1]?.bruto) bruto = despues || antes

    salida.push({ bruto, conHueco: true })
    desde = inicio + largo
  }
  return salida
}

/**
 * Los subcampos de un item `V`, sacados de su enunciado.
 *
 * El backend no los manda —en la base no hay ninguna columna con ellos— asi que
 * la unica fuente es el texto que el candidato ya esta leyendo. No se inventa
 * nada: cada etiqueta es un trozo literal del enunciado.
 */
export function subcamposDeV(pregunta: PreguntaEvaluacion): SubcampoV[] {
  const trozos = (pregunta.enunciado ?? '')
    .split(SEPARADOR_V)
    .map((t) => t.trim())
    .filter((t) => t !== '')

  const salida: SubcampoV[] = []
  for (const trozo of trozos) {
    for (const { bruto, conHueco } of etiquetasDelTrozo(trozo)) {
      salida.push(construirSubcampo(bruto, conHueco, String(salida.length + 1)))
    }
  }

  // Un enunciado vacio dejaria la pregunta sin donde escribir, que es un muro.
  if (salida.length === 0) {
    return [{
      clave: '1', etiqueta: 'Tu respuesta', clase: 'TEXTO',
      opciones: [], maximo: null, obligatorio: false,
    }]
  }
  return salida
}

/** Deja solo digitos: un campo que pide una cantidad no acepta letras. */
export function soloCantidad(bruto: string): string {
  return bruto.replace(/\D+/g, '')
}

/**
 * Junta los subcampos en la unica cadena que espera el backend.
 *
 * Cada dato va con su etiqueta delante para que quien lo lea despues —una
 * persona del panel, o el agente que califica— sepa que contesto a que. El
 * contrato no cambia: un `V` se sigue mandando en `texto`.
 */
export function armarTextoV(
  subcampos: SubcampoV[],
  valores: Record<string, string>,
): string {
  return subcampos
    .map((sub) => ({ sub, valor: (valores[sub.clave] ?? '').trim() }))
    .filter(({ valor }) => valor !== '')
    .map(({ sub, valor }) => {
      if (!sub.etiqueta) return valor
      // Si el valor ya trae la etiqueta pegada —puede pasar al releer algo
      // guardado con otro enunciado— no se le pone dos veces.
      return valor.toLowerCase().startsWith(sub.etiqueta.toLowerCase())
        ? valor
        : `${sub.etiqueta}: ${valor}`
    })
    .join(UNION_V)
}

/**
 * Lo contrario: reparte en sus subcampos lo que ya estaba guardado.
 *
 * Primero por etiqueta, que es lo que aguanta si el orden cambia; lo que quede
 * sin pareja se reparte por posicion, que es lo unico que se puede hacer con lo
 * que se guardo antes de que esta pantalla partiera los `V`.
 */
export function leerValoresV(
  subcampos: SubcampoV[],
  texto: string | null | undefined,
): Record<string, string> {
  const valores: Record<string, string> = {}
  const partes = (texto ?? '').split(SEPARADOR_V).map((p) => p.trim()).filter((p) => p !== '')
  const usadas = new Set<number>()

  // De etiqueta mas larga a mas corta: si no, «Años» se quedaria con lo que era
  // de «Años sosteniendola».
  const porLargo = [...subcampos].sort((a, b) => b.etiqueta.length - a.etiqueta.length)
  for (const sub of porLargo) {
    if (!sub.etiqueta) continue
    const cabeza = sub.etiqueta.toLowerCase()
    const i = partes.findIndex(
      (p, idx) => !usadas.has(idx) && p.toLowerCase().startsWith(cabeza),
    )
    const parte = i >= 0 ? partes[i] : undefined
    if (parte !== undefined) {
      usadas.add(i)
      valores[sub.clave] = parte.slice(sub.etiqueta.length).replace(/^\s*:\s*/, '').trim()
    }
  }

  const sobran = partes.filter((_, i) => !usadas.has(i))
  const vacios = subcampos.filter((s) => valores[s.clave] === undefined)
  for (let k = 0; k < Math.min(sobran.length, vacios.length); k++) {
    const destino = vacios[k]
    const suelto = sobran[k]
    if (destino && suelto !== undefined) valores[destino.clave] = suelto
  }
  return valores
}

// ---------- Que falta para poder mandarlo ----------

function idsDe(opciones: OpcionCandidato[] | null): number[] {
  return (opciones ?? []).map((o) => o.id)
}

/**
 * Lo que le falta al candidato para dar la pregunta por respondida, dicho para
 * el. Devuelve `null` cuando ya esta completa y se puede mandar.
 *
 * `texto` solo lo miran los `V`, que son los unicos que se completan
 * escribiendo. Los demas formatos lo ignoran, asi que se puede llamar igual
 * para cualquier pregunta y por eso la pantalla no tiene que preguntar antes
 * de que tipo es.
 */
export function queFalta(
  pregunta: PreguntaEvaluacion,
  valor: DetalleRespuesta | undefined,
  texto?: string | null,
): string | null {
  const ids = idsDe(pregunta.opciones)

  switch (pregunta.tipo) {
    case 'V': {
      const subcampos = subcamposDeV(pregunta)
      const valores = leerValoresV(subcampos, texto)
      const faltan = subcampos.filter(
        (sub) => sub.obligatorio && (valores[sub.clave] ?? '').trim() === '',
      ).length
      if (faltan === 0) return null
      return faltan === 1
        ? 'Te falta un dato por llenar.'
        : `Te faltan ${faltan} datos por llenar.`
    }

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

/**
 * Atajo de `queFalta`: se manda solo cuando el formato esta entero.
 *
 * Un `V` no lleva detalle —se responde escribiendo—, asi que para el la unica
 * pregunta es si su texto ya trae todos los datos.
 */
export function estaCompleto(
  pregunta: PreguntaEvaluacion,
  valor: DetalleRespuesta | undefined,
  texto?: string | null,
): boolean {
  if (esDatoCorto(pregunta.tipo)) return queFalta(pregunta, undefined, texto) === null
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

// ---------- El mapa de preguntas ----------

/**
 * Los tres estados en los que puede estar una pregunta del examen.
 *
 *   - `lista`: respondida y entera. Se puede entregar asi.
 *   - `a-medias`: hay algo puesto, pero al formato le falta una parte. **No
 *     esta guardada**: lo incompleto no se manda (ver `queFalta`), asi que
 *     contarla como respondida seria mentir.
 *   - `vacia`: no se ha tocado.
 *
 * Distinguir «a medias» de «vacia» es justo lo que le faltaba al candidato: sin
 * eso, una pregunta que creyo haber contestado se ve igual que una que ni
 * abrio, y solo se entera al final, cuando el contador no cuadra.
 */
export type EstadoDePregunta = 'lista' | 'a-medias' | 'vacia'

/**
 * Lo que hay puesto en una pregunta ahora mismo.
 *
 * Va aparte de la pregunta porque lo del candidato puede ir por delante de lo
 * que sabe el servidor: un detalle a medio armar, un texto sin guardar todavia,
 * una opcion recien marcada que aun viaja. Todo eso cuenta para el mapa.
 */
export interface LoPuesto {
  detalle?: DetalleRespuesta
  texto?: string | null
  opcionId?: number | null
}

/**
 * En que estado esta una pregunta.
 *
 * Sirve para las tres cosas a la vez: el numero del mapa, el contador de «te
 * faltan N» y el indicador de la pregunta abierta. Que salga de un solo sitio
 * es lo que evita que el mapa diga una cosa y el contador otra.
 */
export function estadoDePregunta(
  pregunta: PreguntaEvaluacion,
  puesto: LoPuesto = {},
): EstadoDePregunta {
  if (modoDeRespuesta(pregunta) === 'DETALLE') {
    const detalle = puesto.detalle ?? normalizarDetalle(pregunta.respuestaDetalle)
    if (estaCompleto(pregunta, detalle)) return 'lista'
    return detalle === undefined ? 'vacia' : 'a-medias'
  }

  // Una opcion marcada no puede quedarse a medias: o esta o no esta.
  const opcion = puesto.opcionId ?? pregunta.respuestaOpcionId
  if (opcion !== null && opcion !== undefined) return 'lista'

  const escrito = (puesto.texto ?? pregunta.respuestaTexto ?? '').trim()
  if (escrito === '') return 'vacia'
  // Los `V` son los unicos que se pueden escribir a medias: su enunciado pide
  // varios datos y `queFalta` dice cuantos quedan.
  return queFalta(pregunta, undefined, escrito) === null ? 'lista' : 'a-medias'
}

/**
 * La siguiente pregunta que no esta lista, contando **a partir** de la que se
 * mira y dando la vuelta al llegar al final. `-1` si no queda ninguna otra.
 *
 * La vuelta importa: quien se salto la 10 y esta en la 50 espera que «siguiente
 * sin responder» lo lleve a la 10, no que le diga que ya no hay nada.
 *
 * Nunca devuelve la propia `desde`: un boton que lleva a donde ya estas no
 * sirve de nada, y ademas haria creer que quedan huecos cuando el unico es el
 * que se tiene delante.
 */
export function siguienteIncompleta(estados: EstadoDePregunta[], desde: number): number {
  for (let salto = 1; salto < estados.length; salto++) {
    const i = (desde + salto + estados.length) % estados.length
    if (estados[i] !== 'lista') return i
  }
  return -1
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
