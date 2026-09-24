/**
 * La barra de lo marcado, pegada al borde inferior de la ventana.
 *
 * Sustituye a la «mesa» que vivía debajo de la tabla: con cien filas había que
 * bajar hasta el final para llegar a «Avanzar» y «Descartar…». Ahora aparece en
 * cuanto hay alguien marcado y viaja con el scroll.
 *
 * ⚠️ **`position: sticky` y no `fixed`, a propósito.** Se pega abajo mientras
 * se recorre la tabla, pero ocupa su sitio al final de la sección: no tapa la
 * última fila, no se come el pie de la página y no hace falta medir nada ni
 * escuchar el scroll para dejarle hueco. Ver la hoja.
 *
 * ⚠️ **Lo que cuenta es lo que se VE.** Una marca que un filtro esconde se
 * conserva —se quitó el filtro y vuelve a estar—, pero no cuenta en los botones:
 * la barra lo dice y ofrece soltarla. Mandar una carta de rechazo a quien no se
 * ve es el error más caro de la pantalla.
 *
 * No cambia qué acciones hay ni sus permisos: «Avanzar» actúa al pulsarlo, uno a
 * uno; «Descartar…» abre su ventana con los nombres; y sin el permiso de mover
 * postulaciones, «Descartar…» no sale.
 */

import { DescartarEnLote, type AQuienDescartar } from './DescartarEnLote'
import estilos from './BarraDeLaSeleccion.module.css'

interface Props {
  /** Las marcadas QUE SE VEN, en el orden de la tabla. */
  marcadas: AQuienDescartar[]
  /** Cuántas marcas siguen puestas en filas que los filtros esconden. */
  fueraDeVista: number
  motivo: string
  alCambiarMotivo: (motivo: string) => void
  avanzando: boolean
  alAvanzar: () => void
  /** Si la sesión puede mover postulaciones: sin eso, «Descartar…» no sale. */
  puedeDescartar: boolean
  alTerminarDescarte: (resultado: string, conFallos: boolean) => void
  alSoltarOcultas: () => void
  alSoltarTodo: () => void
  /** Lo que pasó con la última tanda: quién avanzó o se descartó y quién no. */
  resultado: string | null
  /** Si en ese resultado hay alguien a quien el backend dijo que no. */
  conFallos: boolean
  /** Mientras se vuelve a pedir la tanda después de actuar. */
  actualizando: boolean
  alCerrarResultado: () => void
}

const personas = (n: number) => `${n} ${n === 1 ? 'persona' : 'personas'}`

export function BarraDeLaSeleccion({
  marcadas,
  fueraDeVista,
  motivo,
  alCambiarMotivo,
  avanzando,
  alAvanzar,
  puedeDescartar,
  alTerminarDescarte,
  alSoltarOcultas,
  alSoltarTodo,
  resultado,
  conFallos,
  actualizando,
  alCerrarResultado,
}: Props) {
  const cuantas = marcadas.length
  /*
    Sin marcadas la barra no existe —ni ocupa sitio—, salvo para contar lo que
    acaba de pasar: al terminar se sueltan las marcas, y el resultado no puede
    irse con ellas justo cuando hay que leerlo.
  */
  if (cuantas === 0 && resultado === null && !actualizando) return null

  return (
    <div className={estilos.barra}>
      {/*
        ⚠️ **La región viva se monta con la barra y solo se esconde.** Naciendo
        ya con el resultado dentro, el lector de pantalla no anuncia nada: para
        él no hubo cambio, apareció un párrafo. Montada vacía desde que alguien
        marca, al llenarse se oye quién pasó y quién no.
      */}
      <div
        className={
          resultado !== null || actualizando
            ? conFallos
              ? estilos.resultadoConFallos
              : estilos.resultado
            : 'solo-lectores'
        }
      >
        <p role="status">{resultado ?? ''}</p>
        {actualizando && <p className={estilos.actualizando}>Actualizando la tanda…</p>}
        {resultado !== null && (
          <button
            type="button"
            className={estilos.cerrarResultado}
            onClick={alCerrarResultado}
            aria-label="Cerrar el resultado"
          >
            ×
          </button>
        )}
      </div>

      {cuantas > 0 && (
        <div className={estilos.acciones} role="group" aria-label="Lo marcado">
          <div className={estilos.linea}>
            <p className={estilos.cuantas} data-cifra>
              {/* Una sola frase, sin partirla con elementos: se lee de una pieza. */}
              {fueraDeVista > 0
                ? `${personas(cuantas)} ${cuantas === 1 ? 'marcada' : 'marcadas'} · ${fueraDeVista} fuera de vista por los filtros`
                : `${personas(cuantas)} ${cuantas === 1 ? 'marcada' : 'marcadas'}`}
            </p>
            {fueraDeVista > 0 && (
              <button
                type="button"
                className={estilos.enlace}
                onClick={alSoltarOcultas}
                disabled={avanzando}
              >
                Soltar las ocultas
              </button>
            )}
          </div>

          <label className={estilos.motivo}>
            <span>Motivo (obligatorio)</span>
            <input
              className={estilos.entradaMotivo}
              type="text"
              placeholder="Queda en el historial de cada una"
              value={motivo}
              onChange={(e) => alCambiarMotivo(e.target.value)}
            />
          </label>

          <div className={estilos.botones}>
            <button
              className={estilos.avanzar}
              type="button"
              onClick={alAvanzar}
              disabled={avanzando || motivo.trim() === ''}
              aria-busy={avanzando}
            >
              {avanzando ? 'Avanzando…' : `Avanzar a ${personas(cuantas)}`}
            </button>
            {/*
              Al lado del de avanzar y no escondido, pero NO actúa al pulsarlo:
              abre la ventana con los nombres escritos. Solo para quien puede
              mover postulaciones, como antes.
            */}
            {puedeDescartar && (
              <DescartarEnLote
                marcados={marcadas}
                motivo={motivo}
                deshabilitado={avanzando}
                alTerminar={alTerminarDescarte}
              />
            )}
            <button
              type="button"
              className={estilos.soltar}
              onClick={alSoltarTodo}
              disabled={avanzando}
            >
              Soltar selección
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
