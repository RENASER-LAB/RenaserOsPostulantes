/**
 * Como se responde cada uno de los ocho formatos del banco v3.
 *
 * Una pregunta por pantalla, y dentro de la pantalla lo que le toque a su
 * formato. Antes aqui solo habia dos cosas —un grupo de radios y un cuadro de
 * texto— y con eso solo se podian responder 28 de los 190 items: los otros seis
 * formatos no tenian donde marcarse.
 *
 * Tres decisiones que no son obvias:
 *
 *   - **Los pasos de un SEC se mueven con botones, no arrastrando.** Arrastrar
 *     va mal en un telefono, y desde el telefono responde casi todo el mundo.
 *   - **Nada se manda a medias.** Media respuesta la rechaza el backend, y el
 *     candidato veria un error que no puede arreglar. Mientras falte algo se
 *     dice en una linea, con letra ambar, y no sale nada hacia el servidor.
 *   - **En un INV o un DE se puede no marcar nada, pero hay que decirlo.** La
 *     ultima casilla existe para eso: sin ella, quien no reconoce ninguna
 *     herramienta tendria que marcar una para poder pasar, que es justo lo
 *     contrario de lo que el item quiere medir.
 *
 * La forma de lo que se manda esta en `bancoV3.ts`, no aqui.
 */

import type { ReactNode } from 'react'
import type { DetalleRespuesta, OpcionCandidato, PreguntaEvaluacion } from '@/api/tipos'
import { MAXIMO_DEL_TEXTO } from './Evaluacion'
import {
  armarTextoV,
  camposDeCaso,
  esDatoCorto,
  leerValoresV,
  modoDeRespuesta,
  moverPaso,
  ordenVisible,
  queFalta,
  soloCantidad,
  subcamposDeV,
} from './bancoV3'
import './formatos-v3.css'

interface Props {
  pregunta: PreguntaEvaluacion
  /** Lo que el candidato lleva puesto en esta pregunta, si el formato usa detalle. */
  detalle: DetalleRespuesta | undefined
  /** La opcion marcada en los formatos de opcion unica. */
  opcionElegida: number | null
  /** Lo escrito en los formatos de texto. */
  texto: string
  onDetalle: (valor: DetalleRespuesta) => void
  onOpcion: (opcionId: number) => void
  onTexto: (texto: string) => void
}

export function RespuestaDeLaPregunta(props: Props) {
  const { pregunta } = props
  const modo = modoDeRespuesta(pregunta)

  if (modo === 'OPCION') return <OpcionUnica {...props} />
  if (modo === 'TEXTO') {
    // Un `V` no es una pregunta suelta: son varios datos en un mismo enunciado,
    // y se pintan por separado. Los demas textos siguen siendo un cuadro.
    if (!esDatoCorto(pregunta.tipo)) return <Escrito {...props} />
    return <ConAviso {...props} falta={queFalta(pregunta, undefined, props.texto)}>
      <DatoPorPartes {...props} />
    </ConAviso>
  }

  return (
    <ConAviso {...props} falta={queFalta(pregunta, props.detalle)}>
      <PorFormato {...props} />
    </ConAviso>
  )
}

/**
 * El formato, y debajo lo que le falta para poder mandarse.
 *
 * Lo que falta se dice siempre, no solo al intentar entregar: si el candidato
 * se entera al final, ya no se acuerda de esta pregunta.
 */
function ConAviso({
  falta,
  children,
}: Props & { falta: string | null; children: ReactNode }) {
  return (
    <>
      {children}
      {falta ? (
        <div className="hint hint-pendiente">{falta}</div>
      ) : (
        <div className="hint">Se guarda sola en cuanto la completas.</div>
      )}
    </>
  )
}

function PorFormato(props: Props) {
  switch (props.pregunta.tipo) {
    case 'EF-4':
      return <EleccionForzada {...props} />
    case 'SJT-R':
      return <ConEscala {...props} />
    case 'SEC':
      return <Ordenar {...props} />
    case 'INV':
      return <MarcarVarias {...props} etiquetaNinguna="No reconozco ninguna de estas" />
    case 'DE':
      return <MarcarVarias {...props} etiquetaNinguna="No encuentro ningún error" />
    case 'CD':
      return <CasoDescompuesto {...props} />
    default:
      return null
  }
}

// ---------- Los formatos de siempre ----------

/** `PC` y el `OPCION_MULTIPLE` del banco viejo: una sola opcion. */
function OpcionUnica({ pregunta, opcionElegida, onOpcion }: Props) {
  return (
    <>
      {(pregunta.opciones ?? []).map((opcion) => (
        <label className="choice" key={opcion.id}>
          <input
            type="radio"
            name={`pregunta-${pregunta.id}`}
            checked={opcionElegida === opcion.id}
            onChange={() => onOpcion(opcion.id)}
          />
          <span>{conLetra(opcion)}</span>
        </label>
      ))}
    </>
  )
}

/** Las preguntas abiertas del banco viejo: un relato, en un cuadro grande. */
function Escrito({ texto, onTexto }: Props) {
  return (
    <div className="field">
      <label htmlFor="respuesta">Tu respuesta</label>
      <textarea
        id="respuesta"
        value={texto}
        maxLength={MAXIMO_DEL_TEXTO}
        onChange={(e) => onTexto(e.target.value)}
        placeholder="Describe el contexto, qué hiciste, qué resultado obtuviste y qué aprendiste."
      />
      <div className="hint">
        {texto.length > MAXIMO_DEL_TEXTO * 0.9
          ? `Se guarda sola cuando dejas de escribir. Llevas ${texto.length.toLocaleString('es-PE')} caracteres de ${MAXIMO_DEL_TEXTO.toLocaleString('es-PE')}: pasado ese punto el servidor no la acepta.`
          : 'Se guarda sola cuando dejas de escribir.'}
      </div>
    </div>
  )
}

// ---------- V · varios datos en un mismo enunciado ----------

/**
 * Un item `V`, partido en los datos que de verdad pide.
 *
 * Antes esto era **un solo cuadro de texto** para todo el enunciado, y de ahi
 * venia la queja: «pides numero pero puedes poner nombre». En «Años haciendo
 * este trabajo: ___ · En cuantas empresas: ___» cabia cualquier cosa, nadie
 * avisaba de nada, y la respuesta llegaba al puntaje como una frase suelta que
 * su tabla de tramos no podia leer.
 *
 * Ahora cada dato tiene su campo y su etiqueta, y **el campo solo acepta lo que
 * se le pide**: los que piden una cantidad no dejan escribir letras, y los que
 * ofrecen opciones son un desplegable —mas rapido en el telefono, y ahi no se
 * puede escribir nada raro—.
 *
 * Lo que se manda no cambia: sigue siendo el campo `texto` de siempre, con los
 * datos juntos y cada uno con su etiqueta delante.
 */
function DatoPorPartes({ pregunta, texto, onTexto }: Props) {
  const subcampos = subcamposDeV(pregunta)
  const valores = leerValoresV(subcampos, texto)

  const cambiar = (clave: string, valor: string) =>
    onTexto(armarTextoV(subcampos, { ...valores, [clave]: valor }))

  return (
    <div className="dato-partes">
      <p className="small ef4-guia">
        Llena cada dato en su casilla. Son datos sueltos: aquí no hay que explicar nada.
      </p>
      {subcampos.map((sub) => {
        const id = `dato-${pregunta.id}-${sub.clave}`
        const valor = valores[sub.clave] ?? ''
        return (
          <div className="field" key={sub.clave}>
            <label htmlFor={id}>{sub.etiqueta}</label>
            {sub.clase === 'LISTA' ? (
              <select id={id} value={valor} onChange={(e) => cambiar(sub.clave, e.target.value)}>
                <option value="">Elige una…</option>
                {sub.opciones.map((opcion) => (
                  <option value={opcion} key={opcion}>
                    {opcion}
                  </option>
                ))}
              </select>
            ) : sub.clase === 'NUMERO' ? (
              /* `inputMode` saca el teclado numerico en el telefono, pero no
                 impide teclear letras en un ordenador: por eso lo que llega se
                 filtra igual. Las dos cosas hacen falta. */
              <input
                id={id}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={valor}
                placeholder="Solo el número"
                onChange={(e) => cambiar(sub.clave, soloCantidad(e.target.value))}
              />
            ) : (
              <input
                id={id}
                type="text"
                autoComplete="off"
                maxLength={sub.maximo ?? undefined}
                value={valor}
                onChange={(e) => cambiar(sub.clave, e.target.value)}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------- EF-4 · eleccion forzada ----------

function EleccionForzada({ pregunta, detalle, onDetalle }: Props) {
  const mas = detalle?.mas
  const menos = detalle?.menos

  const marcarMas = (id: number) =>
    // Si esa misma estaba como «la que menos», se suelta: el backend rechaza
    // que sean la misma, y dejarlo pasar seria mandar algo que va a fallar.
    onDetalle({ ...detalle, mas: id, menos: menos === id ? undefined : menos })

  const marcarMenos = (id: number) =>
    onDetalle({ ...detalle, menos: id, mas: mas === id ? undefined : mas })

  return (
    <div className="ef4">
      <p className="small ef4-guia">
        De estas cuatro, marca la que <b>más</b> se parece a ti y la que <b>menos</b>. No hay
        una buena: todas describen formas de trabajar.
      </p>
      {(pregunta.opciones ?? []).map((opcion) => (
        <div className="ef4-fila" key={opcion.id}>
          <span className="ef4-texto">{conLetra(opcion)}</span>
          <div className="ef4-marcas">
            {/* El `aria-label` repite el texto de la opcion porque, si no,
                quien usa lector de pantalla oye cuatro veces «La que más» sin
                saber de cual. Empieza igual que lo que se ve, que es lo que
                pide la regla de accesibilidad. */}
            <label className="ef4-marca">
              <input
                type="radio"
                name={`mas-${pregunta.id}`}
                aria-label={`La que más: ${opcion.texto}`}
                checked={mas === opcion.id}
                onChange={() => marcarMas(opcion.id)}
              />
              <span>La que más</span>
            </label>
            <label className="ef4-marca">
              <input
                type="radio"
                name={`menos-${pregunta.id}`}
                aria-label={`La que menos: ${opcion.texto}`}
                checked={menos === opcion.id}
                onChange={() => marcarMenos(opcion.id)}
              />
              <span>La que menos</span>
            </label>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------- SJT-R · calificar cada opcion ----------

/** Los cinco puntos de la escala, con lo que significa cada uno. */
const ESCALA = [
  { valor: 1, que: 'Nada apropiada' },
  { valor: 2, que: 'Poco apropiada' },
  { valor: 3, que: 'Aceptable' },
  { valor: 4, que: 'Apropiada' },
  { valor: 5, que: 'Lo mejor que se puede hacer' },
]

function ConEscala({ pregunta, detalle, onDetalle }: Props) {
  const notas = detalle?.calificaciones ?? {}

  const calificar = (opcionId: number, nota: number) =>
    onDetalle({ ...detalle, calificaciones: { ...notas, [String(opcionId)]: nota } })

  return (
    <div className="escala-bloque">
      <p className="small ef4-guia">
        Califica <b>cada una</b> de las respuestas posibles, del 1 al 5. Varias pueden tener la
        misma nota.
      </p>
      {(pregunta.opciones ?? []).map((opcion) => (
        <div className="escala-fila" key={opcion.id}>
          <span className="escala-texto">{conLetra(opcion)}</span>
          <div className="escala" role="group" aria-label={`Calificación de ${opcion.texto}`}>
            {ESCALA.map((punto) => (
              <label className="escala-punto" key={punto.valor}>
                <input
                  type="radio"
                  name={`escala-${pregunta.id}-${opcion.id}`}
                  checked={notas[String(opcion.id)] === punto.valor}
                  onChange={() => calificar(opcion.id, punto.valor)}
                  aria-label={`${punto.valor}, ${punto.que}`}
                />
                <span>{punto.valor}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
      <p className="small escala-leyenda">
        1 · nada apropiada &nbsp;—&nbsp; 5 · lo mejor que se puede hacer
      </p>
    </div>
  )
}

// ---------- SEC · ordenar los pasos ----------

function Ordenar({ pregunta, detalle, onDetalle }: Props) {
  const orden = ordenVisible(pregunta.opciones, detalle)
  const porId = new Map((pregunta.opciones ?? []).map((o) => [o.id, o]))
  const sinTocar = detalle?.orden === undefined

  const mover = (desde: number, hacia: number) =>
    onDetalle({ ...detalle, orden: moverPaso(orden, desde, hacia) })

  return (
    <div className="pasos">
      <p className="small ef4-guia">
        Deja los pasos en el orden en que los harías: el primero arriba. Muévelos con las
        flechas.
      </p>
      <ol className="pasos-lista">
        {orden.map((id, i) => {
          const opcion = porId.get(id)
          if (!opcion) return null
          return (
            <li className="paso" key={id}>
              <span className="paso-orden">{i + 1}</span>
              <span className="paso-texto">{opcion.texto}</span>
              <span className="paso-botones">
                <button
                  type="button"
                  className="iconbtn"
                  aria-label={`Subir: ${opcion.texto}`}
                  disabled={i === 0}
                  onClick={() => mover(i, i - 1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="iconbtn"
                  aria-label={`Bajar: ${opcion.texto}`}
                  disabled={i === orden.length - 1}
                  onClick={() => mover(i, i + 1)}
                >
                  ↓
                </button>
              </span>
            </li>
          )
        })}
      </ol>

      {/* Sin este boton, quien crea que el orden de salida ya es el bueno no
          tendria forma de decirlo: la pregunta se quedaria sin responder por
          estar de acuerdo con ella. */}
      {sinTocar && (
        <button
          type="button"
          className="btn"
          onClick={() => onDetalle({ ...detalle, orden })}
        >
          Este orden es el mío
        </button>
      )}
    </div>
  )
}

// ---------- INV y DE · marcar varias ----------

function MarcarVarias({
  pregunta,
  detalle,
  onDetalle,
  etiquetaNinguna,
}: Props & { etiquetaNinguna: string }) {
  const marcadas = detalle?.marcadas
  const ninguna = marcadas !== undefined && marcadas.length === 0

  const alternar = (id: number) => {
    const actuales = marcadas ?? []
    // Quitar la ultima deja la lista vacia, que es exactamente «ninguna»: la
    // casilla de abajo se marca sola y la pregunta sigue respondida.
    const nuevas = actuales.includes(id)
      ? actuales.filter((x) => x !== id)
      : [...actuales, id]
    onDetalle({ ...detalle, marcadas: nuevas })
  }

  return (
    <div className="marcar">
      <p className="small ef4-guia">
        Marca todas las que correspondan. Puedes marcar varias, o ninguna.
      </p>
      {(pregunta.opciones ?? []).map((opcion) => (
        <label className="choice" key={opcion.id}>
          <input
            type="checkbox"
            checked={(marcadas ?? []).includes(opcion.id)}
            onChange={() => alternar(opcion.id)}
          />
          <span>{conLetra(opcion)}</span>
        </label>
      ))}
      <div className="divider" />
      <label className="choice">
        <input
          type="checkbox"
          checked={ninguna}
          onChange={() =>
            onDetalle({ ...detalle, marcadas: ninguna ? undefined : [] })
          }
        />
        <span>{etiquetaNinguna}</span>
      </label>
    </div>
  )
}

// ---------- CD · caso descompuesto ----------

function CasoDescompuesto({ pregunta, detalle, onDetalle }: Props) {
  const campos = camposDeCaso(pregunta)
  const puestos = detalle?.campos ?? {}

  const escribir = (clave: string, valor: string) =>
    onDetalle({ ...detalle, campos: { ...puestos, [clave]: valor } })

  return (
    <div className="campos-caso">
      <p className="small ef4-guia">
        Llena todos los campos. Van sueltos a propósito: aquí no se juzga cómo lo cuentas,
        sino los datos.
      </p>
      {campos.map((campo) => (
        <div className="field" key={campo.clave}>
          <label htmlFor={`campo-${pregunta.id}-${campo.clave}`}>{campo.etiqueta}</label>
          <input
            id={`campo-${pregunta.id}-${campo.clave}`}
            type="text"
            value={puestos[campo.clave] ?? ''}
            onChange={(e) => escribir(campo.clave, e.target.value)}
          />
        </div>
      ))}
    </div>
  )
}

// ---------- Comun ----------

function conLetra(opcion: OpcionCandidato): string {
  return opcion.letra ? `${opcion.letra}. ${opcion.texto}` : opcion.texto
}
