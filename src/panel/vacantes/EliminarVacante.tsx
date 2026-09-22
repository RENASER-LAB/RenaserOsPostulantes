/**
 * Retirar una vacante que no debio existir.
 *
 * ## Por que este modal pide mas que el de archivar
 *
 * Archivar guarda lo que termino bien y se deshace con una pulsacion, asi que
 * su modal solo cuenta lo que va a pasar. Esto cierra las postulaciones de otras
 * personas, les deja un aviso en su portal, retira la convocatoria de todas las
 * pantallas y **no se deshace desde el panel**. Por eso pide una cosa mas: un
 * motivo escrito. No es burocracia — es lo unico que podra contestar, dentro de
 * un año, por que desaparecio esta convocatoria y por que se cerraron sus
 * catorce procesos.
 *
 * ## Lo que se dice antes de confirmar
 *
 * Las consecuencias, no un «¿estas seguro?». Y la que mas pesa va con su numero
 * delante: **cuantas personas se van a quedar sin proceso**. Ese numero es el de
 * la fila, que puede tener un minuto; el servidor vuelve a mirarlo al confirmar
 * y lo que contesta es lo que se dice despues.
 *
 * ## El boton no se enciende solo
 *
 * Se enciende cuando hay un motivo que no sea solo espacios, que es la misma
 * regla que aplica el backend (400 si llega vacio). Las dos hacen falta: el
 * panel es un cliente mas del API, y el formulario que alguien deje abierto
 * sigue sabiendo la URL.
 */

import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { eliminarVacante } from '../api/panel'
import type { VacantePanel } from '../api/tipos'
import { Modal } from '@/ui/Modal'
import estilos from './Vacantes.module.css'

export function ModalDeEliminacion({
  vacante,
  alCerrar,
  alEliminar,
}: {
  vacante: VacantePanel
  alCerrar: () => void
  /**
   * La vacante ya no existe: el panel decide que decir y donde dejar el foco.
   *
   * Recibe la frase ya armada porque solo aqui se sabe como acabo: si los
   * avisos salieron todos, si no habia nadie dentro, o si alguno se quedo por
   * el camino.
   */
  alEliminar: (mensaje: string) => void
}) {
  const cache = useQueryClient()
  const [motivo, setMotivo] = useState('')
  const enCarrera = vacante.postulantesEnCarrera
  /*
   * «Que no sea solo espacios», y no «que no este vacio».
   *
   * Un motivo de tres espacios pasa cualquier `required` del navegador y no
   * contesta nada a quien pregunte mañana. El backend lo recorta igual y
   * contesta 400; aqui se apaga el boton para no llegar a ese viaje.
   */
  const hayMotivo = motivo.trim().length > 0

  /*
   * ⚠️ **La guarda de verdad contra el doble clic, y `disabled` no lo es.**
   *
   * `disabled={...isPending}` solo llega al boton cuando React vuelve a pintar,
   * y las dos pulsaciones de un doble clic caben antes de ese render. El ref se
   * escribe en el mismo turno del evento, asi que la segunda pulsacion ya lo
   * encuentra puesto y no manda nada.
   *
   * El backend tiene su propia defensa —el UPDATE condicional de
   * `eliminarSiSeguiaViva`— y las dos hacen falta: esta evita el segundo viaje,
   * aquella evita que dos viajes de verdad simultaneos cierren dos veces a la
   * misma gente y le manden dos campanas por el mismo hecho.
   */
  const yaSeEnvio = useRef(false)

  const eliminacion = useMutation({
    mutationFn: () => eliminarVacante(vacante.id, motivo.trim()),
    onSuccess: async (resultado) => {
      await cache.invalidateQueries({ queryKey: ['panel-vacantes'] })
      await cache.invalidateQueries({ queryKey: ['panel-vacantes-archivadas'] })
      // Y el contador de la cabecera: eliminar una archivada la saca tambien de
      // esa lista, y sin esto seguiria contandola hasta recargar.
      await cache.invalidateQueries({ queryKey: ['panel-vacantes-archivadas-conteo'] })
      alEliminar(comoAcabo(resultado.postulacionesCerradas, resultado.postulantesAvisados))
    },
    // Si falla se puede reintentar, y el motivo escrito sigue en el campo: lo
    // que no se puede es mandar dos veces la misma confirmacion.
    onError: () => {
      yaSeEnvio.current = false
    },
  })

  /*
   * Mientras la peticion esta en vuelo no se cierra: la primera ya salio, y
   * cerrar aqui dejaria al equipo sin saber como acabo algo que no se deshace.
   */
  const cerrarSiSePuede = () => {
    if (!eliminacion.isPending) alCerrar()
  }

  const confirmar = () => {
    // Sincrono, antes de cualquier render: ver `yaSeEnvio`.
    if (yaSeEnvio.current || !hayMotivo) return
    yaSeEnvio.current = true
    eliminacion.mutate()
  }

  return (
    <Modal
      abierto
      titulo="Eliminar vacante"
      onCerrar={cerrarSiSePuede}
      pie={
        <>
          <button
            className={estilos.secundarioModal}
            type="button"
            onClick={cerrarSiSePuede}
            disabled={eliminacion.isPending}
          >
            Cancelar
          </button>
          <button
            className={estilos.eliminarConfirmar}
            type="button"
            onClick={confirmar}
            disabled={!hayMotivo || eliminacion.isPending}
          >
            {eliminacion.isPending ? 'Eliminando…' : 'Eliminar vacante'}
          </button>
        </>
      }
    >
      <p className={estilos.descartarTexto}>
        Vas a eliminar <strong>{vacante.titulo}</strong>.
      </p>
      <ul className={estilos.loQuePasa}>
        <li>
          Dejará de verse en el panel y en el portal: tablón, detalle público y «Mis
          procesos».
        </li>
        {enCarrera > 0 && (
          <li>
            Se cerrarán sus {enCarrera} {enCarrera === 1 ? 'postulación' : 'postulaciones'} y
            se les avisará en su portal.
          </li>
        )}
        <li>No se podrá deshacer desde el panel.</li>
      </ul>

      <label className={estilos.motivoEtiqueta} htmlFor="motivo-de-la-eliminacion">
        Por qué se elimina
      </label>
      <textarea
        id="motivo-de-la-eliminacion"
        className={estilos.motivoCampo}
        rows={3}
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        disabled={eliminacion.isPending}
        placeholder="Se creó con el puesto equivocado"
      />

      {eliminacion.isError && (
        <p className={`${estilos.aviso} ${estilos.malo}`} role="alert">
          {eliminacion.error instanceof Error
            ? eliminacion.error.message
            : 'No se pudo eliminar la vacante.'}
        </p>
      )}
    </Modal>
  )
}

/**
 * Lo que se dice despues, con los numeros que contesto el servidor.
 *
 * Tres frases y no una, porque los tres casos son distintos para quien lee:
 * nadie estaba dentro, todos se enteraron, o alguno no. **El tercero no se
 * redondea al segundo**: afirmar que a los catorce se les aviso cuando llegaron
 * doce es mentir sobre lo unico que el candidato puede comprobar, y el equipo
 * necesita saberlo para poder escribirle a mano a quien falte.
 */
export function comoAcabo(cerradas: number, avisadas: number): string {
  if (cerradas === 0) return 'Vacante eliminada'
  if (avisadas === cerradas) {
    return `Vacante eliminada. Se cerraron ${cerradas} postulaciones y se les avisó en su portal`
  }
  return (
    `Vacante eliminada. Se cerraron ${cerradas} postulaciones y se avisó a ${avisadas}: ` +
    'los avisos que faltan no salieron'
  )
}
