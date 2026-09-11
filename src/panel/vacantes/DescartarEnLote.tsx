/**
 * Descartar de golpe a la tanda marcada, desde la mesa de avance.
 *
 * El botón de la ficha sirve para «estoy leyendo a esta persona y decido que
 * no». Este es el otro trabajo: se ha repasado la tabla, se sabe quiénes no
 * siguen, y hacerlo de uno en uno son N fichas abiertas y N ventanas.
 *
 * Comparte con «Avanzar» las casillas de la tabla y el motivo de la mesa: quien
 * marca a cinco personas elige después qué hacer con ellas, y el motivo escrito
 * vale para las cinco —igual que en el avance—.
 *
 * ⚠️ **Aquí un clic manda N cartas de rechazo.** Por eso este botón NO actúa al
 * pulsarlo, al revés que el de avanzar: abre una ventana con **los nombres,
 * escritos**. Es donde se atrapa haber dejado marcada a una persona de una
 * pestaña anterior, que es el error que de verdad ocurre; una cifra sola
 * —«descartar a 6»— no lo atrapa, porque el 6 parece correcto hasta que se leen
 * los seis nombres.
 *
 * ⚠️ **Se va uno a uno y no en paralelo**, igual que el avance: si el backend
 * rechaza a alguien —ya cerrado, fuera del alcance del rol— el resultado dice a
 * quién, y los demás no se pierden por ello.
 *
 * ⚠️ **A los ya cerrados no se les filtra antes.** Se les deja fallar y salir
 * nombrados en «No se descartaron», que es lo que hace el avance. Filtrarlos en
 * silencio haría que la cuenta del botón y la del resultado no cuadraran sin
 * explicación. Por eso la ventana promete **«hasta N»** y no «N».
 */

import { useState } from 'react'
import { transicionar } from '../api/panel'
import { Modal } from '@/ui/Modal'
import estilos from './DescartarPostulacion.module.css'

const NO_CONTINUA = 'NO_CONTINUA'

/** Lo mínimo que hace falta de cada fila marcada. */
export interface AQuienDescartar {
  postulacionId: number
  candidato: string
}

interface Props {
  /** Los marcados que se están viendo, en el orden de la tabla. */
  marcados: AQuienDescartar[]
  /** El motivo de la mesa, el mismo que usa «Avanzar». */
  motivo: string
  /** Refrescar el ranking y soltar las casillas. */
  alTerminar: () => void
}

export function DescartarEnLote({ marcados, motivo, alTerminar }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [avisar, setAvisar] = useState(true)
  const [yendo, setYendo] = useState(false)
  const [resultado, setResultado] = useState<string | null>(null)

  const cuantos = marcados.length
  const faltaMotivo = motivo.trim() === ''

  function abrir() {
    setResultado(null)
    // Encendido en cada apertura: haberlo apagado para una tanda no puede
    // arrastrarse a la siguiente sin que nadie lo mire.
    setAvisar(true)
    setAbierto(true)
  }

  /*
    Cerrar, salvo mientras la tanda va. Es lo mismo que guarda el descarte de
    uno, y aquí importa más: una tanda de doce tarda doce llamadas, y cerrar a
    la mitad deja sin leer a quiénes les llegó a salir el correo y a quiénes no.
  */
  function cerrarSiSePuede() {
    if (yendo) return
    setAbierto(false)
  }

  async function descartarMarcados() {
    setYendo(true)
    const fueron: string[] = []
    const fallaron: string[] = []
    for (const fila of marcados) {
      try {
        await transicionar(fila.postulacionId, NO_CONTINUA, motivo.trim(), avisar)
        fueron.push(fila.candidato)
      } catch (causa) {
        fallaron.push(`${fila.candidato} (${causa instanceof Error ? causa.message : 'falló'})`)
      }
    }
    setYendo(false)
    setAbierto(false)
    setResultado(
      [
        fueron.length > 0
          ? `Se descartó a ${fueron.join(', ')}${avisar ? ', y les salió el correo' : ', sin avisarles'}.`
          : null,
        fallaron.length > 0 ? `No se descartaron: ${fallaron.join('; ')}.` : null,
      ]
        .filter(Boolean)
        .join(' '),
    )
    alTerminar()
  }

  return (
    <>
      {/*
        El nombre del botón lleva la cifra, como el de avanzar: «Descartar» a
        secas al lado de «Avanzar a 6 personas» no dice a cuántos alcanza, y son
        dos botones pegados que hacen cosas opuestas.
      */}
      <button
        type="button"
        className={estilos.descartarLote}
        onClick={abrir}
        disabled={cuantos === 0 || faltaMotivo}
      >
        {cuantos === 0
          ? 'Marca a quienes no siguen'
          : `Descartar a ${cuantos} ${cuantos === 1 ? 'persona' : 'personas'}`}
      </button>

      {resultado && (
        <p className={estilos.resultadoLote} role="status">
          {resultado}
        </p>
      )}

      <Modal
        abierto={abierto}
        titulo={`Descartar a ${cuantos} ${cuantos === 1 ? 'persona' : 'personas'}`}
        onCerrar={cerrarSiSePuede}
        pie={
          <>
            <button
              type="button"
              className={estilos.cancelar}
              onClick={cerrarSiSePuede}
              disabled={yendo}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={estilos.confirmar}
              onClick={() => void descartarMarcados()}
              disabled={yendo}
              aria-busy={yendo}
            >
              {yendo
                ? 'Descartando…'
                : avisar
                  ? `Descartar y avisar a ${cuantos}`
                  : `Descartar a ${cuantos} sin avisar`}
            </button>
          </>
        }
      >
        <p className={estilos.consecuencia}>
          {avisar ? (
            <>
              A cada una <b>le llega un correo</b> diciéndole que su postulación no continúa.
              Salen al momento y no se pueden recoger: <b>hasta {cuantos}</b> —quien ya esté
              cerrado se salta y sale nombrado abajo—.
            </>
          ) : (
            <>
              <b>No le va a llegar nada a nadie.</b> Queda anotado en el historial de cada uno
              que se descartó sin avisarle, para que quien lo lea después no dé por hecho que se
              le dijo.
            </>
          )}{' '}
          Las postulaciones quedan cerradas: de un estado final no se vuelve.
        </p>

        {/*
          ⚠️ **Los nombres, escritos y enteros.** Es el motivo de que esta
          ventana exista: el error real no es equivocarse de botón, es llegar
          aquí con alguien marcado de una pestaña anterior. Una cifra sola no lo
          enseña —el número parece correcto— y una lista recortada con «y 4 más»
          esconde justo las que nadie repasó.
        */}
        <p className={estilos.tituloLista}>A quiénes:</p>
        <ul className={estilos.lista}>
          {marcados.map((f) => (
            <li key={f.postulacionId}>{f.candidato}</li>
          ))}
        </ul>

        <p className={estilos.motivoLote}>
          <b>Motivo, el mismo para todas:</b> «{motivo.trim()}». Lo lee el equipo en el historial
          de cada postulación, no el candidato.
        </p>

        <label className={estilos.avisar}>
          <input type="checkbox" checked={avisar} onChange={(e) => setAvisar(e.target.checked)} />
          <span>
            Avisarles por correo
            <span className={estilos.ayudaAvisar}>
              Quítalo solo si ya se lo dijisteis por otro lado: un correo automático llegaría
              después de esa conversación diciendo lo mismo peor.
            </span>
          </span>
        </label>
      </Modal>
    </>
  )
}
