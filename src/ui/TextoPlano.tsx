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
function Enlace({ direccion, queEs }: { direccion: string; queEs: string }) {
  const esPdf = /\.pdf(\?|#|$)/i.test(direccion)
  return (
    <a
      className="enlace-texto"
      href={direccion}
      target="_blank"
      rel="noopener noreferrer"
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
}

export function TextoPlano({ texto, queEs = 'el documento', className = 'texto-largo' }: Props) {
  /*
   * Dos formas de respetar los saltos de linea, y aqui se usan las dos:
   *
   *   - Partir por linea en blanco, para que cada parrafo sea un `<p>` de
   *     verdad y herede el aire que el portal les da. Un solo bloque con
   *     `pre-wrap` tambien respeta los saltos, pero separa dos parrafos igual
   *     que dos lineas seguidas, y entonces no se ve donde acaba una idea.
   *   - `pre-wrap` dentro de cada parrafo (lo pone `.texto-largo`), para que los
   *     saltos sueltos sigan ahi. Quien escribe una lista con guiones, uno por
   *     linea, no esta escribiendo un parrafo por guion.
   */
  const parrafos = texto
    .split(/\n[ \t]*\n+/)
    .map((p) => p.trim())
    .filter(Boolean)

  if (parrafos.length === 0) return null

  return (
    <>
      {parrafos.map((parrafo, i) => (
        <p className={className} key={i}>
          {partirPorDirecciones(parrafo).map((trozo, j) =>
            trozo.enlace ? (
              <Enlace key={j} direccion={trozo.valor} queEs={queEs} />
            ) : (
              trozo.valor
            ),
          )}
        </p>
      ))}
    </>
  )
}
