/**
 * Retirar de la lista de todos los dias una vacante que ya termino.
 *
 * ## Por que esto SI pide confirmacion y la edicion no
 *
 * Corregir una vacante es lo normal y se deshace corrigiendo otra vez; archivar
 * la saca de la mesa de trabajo de todo el equipo. Quien la busque mañana no la
 * encontrara donde la dejo, y eso hay que decirlo antes, no despues. El modal no
 * pregunta «¿estas seguro?»: **cuenta lo que va a pasar** —sale de la lista,
 * queda en Archivadas, se puede traer de vuelta— y deja decidir con eso puesto.
 *
 * ## Cuando queda gente en carrera
 *
 * El icono aparece igual, y el modal es el que explica por que no se puede
 * confirmar. Esconderlo dejaria a quien mira la fila sin forma de saber que
 * faltan tres personas por decidir; asi, el mismo gesto que iba a archivar lleva
 * a la vacante a decidirlas.
 *
 * El conteo que se enseña es el de la fila, que puede tener un minuto. El
 * servidor vuelve a mirarlo al confirmar y contesta 409 si cambio: el modal es
 * una foto, la decision se toma sobre lo que hay.
 */

import { useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { archivarVacante } from '../api/panel'
import type { VacantePanel } from '../api/tipos'
import { rutas } from '@/rutas'
import { Modal } from '@/ui/Modal'
import estilos from './Vacantes.module.css'

export function ModalDeArchivo({
  vacante,
  alCerrar,
  alArchivar,
}: {
  vacante: VacantePanel
  alCerrar: () => void
  /** La vacante ya salio de la lista: el panel decide que decir y donde dejar el foco. */
  alArchivar: () => void
}) {
  const cache = useQueryClient()
  const enCarrera = vacante.postulantesEnCarrera
  const sePuede = enCarrera === 0
  /*
   * ⚠️ **La guarda de verdad contra el doble clic, y `disabled` no lo es.**
   *
   * `disabled={archivo.isPending}` solo llega al botón cuando React vuelve a
   * pintar, y las dos pulsaciones de un doble clic caben holgadamente antes de
   * ese render: salían dos POST, y el servidor las archivaba las dos. El ref se
   * escribe en el mismo turno del evento, así que la segunda pulsación ya lo
   * encuentra puesto y no llega a mandar nada.
   *
   * El backend tiene su propia defensa —el UPDATE condicional de
   * `archivarSiNoLoEstaba`—, y las dos hacen falta: esta evita el segundo viaje,
   * aquella evita que dos viajes de verdad simultáneos escriban dos veces.
   */
  const yaSeEnvio = useRef(false)

  const archivo = useMutation({
    mutationFn: () => archivarVacante(vacante.id),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ['panel-vacantes'] })
      await cache.invalidateQueries({ queryKey: ['panel-vacantes-archivadas'] })
      /*
       * Y el contador de la cabecera, que es la clave que faltaba: el botón
       * «Archivadas (N)» vive justo encima del aviso que dice que la vacante ya
       * está allí, y sin esto se quedaba diciendo (0) hasta recargar. Dos líneas
       * seguidas contradiciéndose, y la que miente es la que se pulsa.
       */
      await cache.invalidateQueries({ queryKey: ['panel-vacantes-archivadas-conteo'] })
      alArchivar()
    },
    // Si falla, se puede volver a intentar: lo que no se puede es mandar dos
    // veces la misma confirmación.
    onError: () => {
      yaSeEnvio.current = false
    },
  })

  /*
   * Mientras la peticion esta en vuelo no se cierra ni se reintenta: la primera
   * ya salio, y una segunda archivaria «otra vez» algo que el servidor rechaza
   * con un 409 que aqui se leeria como un fallo.
   */
  const cerrarSiSePuede = () => {
    if (!archivo.isPending) alCerrar()
  }

  return (
    <Modal
      abierto
      titulo="Archivar vacante"
      onCerrar={cerrarSiSePuede}
      pie={
        <>
          <button
            className={estilos.secundarioModal}
            type="button"
            onClick={cerrarSiSePuede}
            disabled={archivo.isPending}
          >
            Cancelar
          </button>
          <button
            className={estilos.guardar}
            type="button"
            onClick={() => {
              // Síncrono, antes de cualquier render: ver `yaSeEnvio`.
              if (yaSeEnvio.current || !sePuede) return
              yaSeEnvio.current = true
              archivo.mutate()
            }}
            disabled={!sePuede || archivo.isPending}
          >
            {archivo.isPending ? 'Archivando…' : 'Archivar vacante'}
          </button>
        </>
      }
    >
      <p className={estilos.descartarTexto}>
        Vas a archivar <strong>{vacante.titulo}</strong>.
      </p>
      <ul className={estilos.loQuePasa}>
        <li>Deja la lista habitual de vacantes.</li>
        <li>Se podrá consultar en «Vacantes archivadas», con todo su proceso.</li>
        <li>Se podrá desarchivar cuando haga falta, sin reabrirla.</li>
      </ul>

      {/*
        La única razón por la que esto no se puede hacer, dicha con el camino
        para resolverla. Un botón apagado sin explicación se lee como una avería.
      */}
      {!sePuede && (
        <p className={`${estilos.aviso} ${estilos.malo}`} role="alert">
          Quedan {enCarrera} postulantes en carrera. Decide cada uno, o descártalos en lote,
          desde la vacante antes de archivarla.{' '}
          <Link to={rutas.adminVacante(vacante.id)}>Ir a {vacante.titulo}</Link>
        </p>
      )}

      {archivo.isError && (
        <p className={`${estilos.aviso} ${estilos.malo}`} role="alert">
          {archivo.error instanceof Error
            ? archivo.error.message
            : 'No se pudo archivar la vacante.'}
        </p>
      )}
    </Modal>
  )
}
