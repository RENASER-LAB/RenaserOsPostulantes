/**
 * Un texto que escribio una persona en la base, pintado sin perder su forma y
 * con sus direcciones pinchables.
 *
 * Existe por la prueba del puesto. Su consigna llega en tres campos de texto
 * —`enunciado`, `materiales`, `herramientasPermitidas`— con varios parrafos y,
 * dentro, una direccion https al PDF de la prueba real: no hay adjuntos, el
 * enlace va escrito en el propio texto. Metido en un `<p>` normal, ese texto se
 * leia como un bloque corrido y la direccion quedaba muerta, para copiarla a
 * mano mientras el cronometro corre.
 *
 * **Aqui no entra HTML del backend.** Nada de `dangerouslySetInnerHTML`: el
 * texto se parte en trozos y cada trozo se convierte en un nodo de React. Un
 * `<script>` guardado en la base sale como letras en la pantalla, que es lo que
 * es; y al `href` solo puede llegar algo que empiece por `http` o `https`, asi
 * que un `javascript:` escrito a mano tampoco se vuelve enlace.
 */

import estilos from './TextoPlano.module.css'

/**
 * Las direcciones del texto. Solo `http` y `https`, y se cortan en el primer
 * espacio o en los caracteres que nunca forman parte de una direccion escrita
 * dentro de una frase.
 */
const DIRECCIONES = /https?:\/\/[^\s<>"'`]+/g

/**
 * Puntuacion del final que casi siempre es de la frase y no de la direccion:
 * «...mira https://x.com/prueba.pdf.» termina en punto, y ese punto no es parte
 * del enlace.
 */
const PUNTUACION_FINAL = /[.,;:!?)»\]]+$/

type Trozo = { enlace: false; valor: string } | { enlace: true; valor: string }

function partirPorDirecciones(texto: string): Trozo[] {
  const trozos: Trozo[] = []
  let desde = 0

  for (const encontrado of texto.matchAll(DIRECCIONES)) {
    const inicio = encontrado.index ?? 0
    const direccion = encontrado[0].replace(PUNTUACION_FINAL, '')
    if (direccion === '') continue

    if (inicio > desde) trozos.push({ enlace: false, valor: texto.slice(desde, inicio) })
    trozos.push({ enlace: true, valor: direccion })
    desde = inicio + direccion.length
  }

  if (desde < texto.length) trozos.push({ enlace: false, valor: texto.slice(desde) })
  return trozos
}

/**
 * Un enlace del texto.
 *
 * La direccion de un PDF firmado mide cientos de caracteres y no le dice nada a
 * nadie. Cuando se puede saber que hay al otro lado —termina en `.pdf`— se
 * nombra con palabras; cuando no, se enseña tal cual, pero con la forma de un
 * enlace del portal para que se vea que se puede pinchar.
 */
function Enlace({
  direccion,
  queEs,
  tabulable,
}: {
  direccion: string
  queEs: string
  tabulable: boolean
}) {
  const esPdf = /\.pdf(\?|#|$)/i.test(direccion)
  return (
    <a
      className={estilos.enlace}
      href={direccion}
      target="_blank"
      rel="noopener noreferrer"
      tabIndex={tabulable ? undefined : -1}
    >
      {esPdf ? `Abrir ${queEs} (PDF)` : direccion}
    </a>
  )
}

interface Props {
  texto: string
  /**
   * Como nombrar lo que hay al otro lado de un enlace a PDF. Se usa para armar
   * «Abrir {queEs} (PDF)», asi que va en minuscula y con articulo: «el enunciado
   * de la prueba».
   */
  queEs?: string
  /** La clase de cada parrafo, por si la pantalla los quiere de otro tamaño. */
  className?: string
  /**
   * Si los enlaces entran en el orden de Tab. Por defecto sí. Lo apaga quien
   * enseña el texto recortado: un enlace que cae bajo el recorte recibiría el
   * foco sin verse (el caso del lateral de la prueba). Siguen siendo enlaces
   * para el raton y el lector de pantalla.
   */
  enlacesTabulables?: boolean
  /**
   * Si las líneas que empiezan por «- », «• » o «* » se pintan como una lista
   * `ul` de verdad, y las que empiezan por «1. », «2. »… como una `ol`. Apagado
   * por defecto: solo lo encienden los textos de la prueba del editor (el caso,
   * los materiales y las herramientas), que es donde la empresa escribe listas.
   * Encendido, la lista lleva la clase del párrafo y además la suya, así que se
   * lee con la misma letra.
   */
  listas?: boolean
}

/** «- », «• » o «* » al principio de la línea, con su sangría si la tiene. */
const VINETA = /^[ \t]*[-•*][ \t]+(\S.*)$/
/** «1. », «2. »…: hasta dos cifras, para que «2026. El año…» no sea una lista. */
const NUMERO = /^[ \t]*(\d{1,2})\.[ \t]+(\S.*)$/

type Pieza =
  | { tipo: 'parrafo'; texto: string }
  | { tipo: 'lista'; numerada: boolean; inicio: number; elementos: string[] }

/**
 * Un párrafo partido en lo que es prosa y lo que es lista. Las líneas seguidas
 * con la misma marca forman una lista; una línea sangrada justo después de un
 * elemento lo continúa; cualquier otra línea la cierra y vuelve a ser prosa.
 */
function partirPorListas(parrafo: string): Pieza[] {
  const piezas: Pieza[] = []
  let prosa: string[] = []
  const cerrarProsa = () => {
    const junta = prosa.join('\n').trim()
    if (junta) piezas.push({ tipo: 'parrafo', texto: junta })
    prosa = []
  }

  for (const linea of parrafo.split('\n')) {
    const vineta = VINETA.exec(linea)
    const numero = vineta ? null : NUMERO.exec(linea)
    if (vineta || numero) {
      cerrarProsa()
      const numerada = numero !== null
      const elemento = (vineta ? vineta[1]! : numero![2]!).trim()
      const ultima = piezas.at(-1)
      if (ultima?.tipo === 'lista' && ultima.numerada === numerada) {
        ultima.elementos.push(elemento)
      } else {
        piezas.push({ tipo: 'lista', numerada, inicio: numero ? Number(numero[1]) : 1, elementos: [elemento] })
      }
      continue
    }
    const ultima = piezas.at(-1)
    if (prosa.length === 0 && ultima?.tipo === 'lista' && /^[ \t]+\S/.test(linea)) {
      // La continuación sangrada de un elemento largo, escrita en dos líneas.
      ultima.elementos[ultima.elementos.length - 1] += `\n${linea.trim()}`
    } else {
      prosa.push(linea)
    }
  }
  cerrarProsa()
  return piezas
}

export function TextoPlano({
  texto,
  queEs = 'el documento',
  className,
  enlacesTabulables = true,
  listas = false,
}: Props) {
  /*
   * Dos formas de respetar los saltos de linea, y aqui se usan las dos:
   *
   *   - Partir por linea en blanco, para que cada parrafo sea un `<p>` de
   *     verdad y herede el aire que el portal les da. Un solo bloque con
   *     `pre-wrap` tambien respeta los saltos, pero separa dos parrafos igual
   *     que dos lineas seguidas, y entonces no se ve donde acaba una idea.
   *   - `pre-wrap` dentro de cada parrafo (lo pone la hoja del componente), para que los
   *     saltos sueltos sigan ahi. Quien escribe una lista con guiones, uno por
   *     linea, no esta escribiendo un parrafo por guion.
   */
  const parrafos = texto
    .split(/\n[ \t]*\n+/)
    .map((p) => p.trim())
    .filter(Boolean)

  if (parrafos.length === 0) return null

  const clase = className ?? estilos.parrafo
  const conEnlaces = (valor: string) =>
    partirPorDirecciones(valor).map((trozo, j) =>
      trozo.enlace ? (
        <Enlace key={j} direccion={trozo.valor} queEs={queEs} tabulable={enlacesTabulables} />
      ) : (
        trozo.valor
      ),
    )

  const piezas: Pieza[] = listas
    ? parrafos.flatMap(partirPorListas)
    : parrafos.map((p) => ({ tipo: 'parrafo', texto: p }))

  return (
    <>
      {piezas.map((pieza, i) => {
        if (pieza.tipo === 'parrafo') {
          return (
            <p className={clase} key={i}>
              {conEnlaces(pieza.texto)}
            </p>
          )
        }
        const elementos = pieza.elementos.map((elemento, j) => <li key={j}>{conEnlaces(elemento)}</li>)
        return pieza.numerada ? (
          <ol
            className={`${clase} ${estilos.lista} ${estilos.listaNumerada}`}
            start={pieza.inicio === 1 ? undefined : pieza.inicio}
            key={i}
          >
            {elementos}
          </ol>
        ) : (
          <ul className={`${clase} ${estilos.lista}`} key={i}>
            {elementos}
          </ul>
        )
      })}
    </>
  )
}
