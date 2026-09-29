/**
 * Contratar desde la ficha del postulante, y lo que viene después (V64).
 *
 * «Contratar» es **la decisión en verde**, por el mismo camino que la API de
 * siempre: el backend pide `decidir_contratacion` la primera vez y
 * `cambiar_decision` si ya hubo una. Da igual la etapa en que esté la persona,
 * y por eso el modal avisa de las etapas que se salta. No manda ningún correo.
 *
 * Contratar y dar de alta son dos pasos: la decisión y el primer día de trabajo
 * no suelen coincidir. Una postulación Contratado ofrece aquí «Dar de alta como
 * colaborador» o «Ver su ficha de colaborador», según quien mire y según si ya
 * la tiene.
 *
 * Todo lo que se pinta sale de los `puedeX` de la ficha: pistas del backend, no
 * la defensa.
 */

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { rutas } from '@/rutas'
import { AreaTexto } from '@/ui/campos/Campo'
import { Modal } from '@/ui/Modal'
import { ErrorApi } from '../api/cliente'
import { contratar } from '../api/colaboradores'
import estilos from './ContratarDesdeLaFicha.module.css'

interface Props {
  postulacionId: number
  candidato: string
  vacante: string
  /** El nombre de la etapa en que está, o el del estado si todavía no tiene etapa. */
  etapa: string
  /** Si ya está en la etapa Decisión: entonces no se salta ninguna. */
  enDecision: boolean
  puedeContratar: boolean
  contratado: boolean
  colaboradorId: number | null
  puedeDarDeAlta: boolean
  puedeVerColaborador: boolean
  /** Refrescar la ficha, el historial y el ranking: el estado cambia en los tres. */
  alContratar: () => void
}

function explicarFallo(causa: unknown): string {
  if (causa instanceof ErrorApi && causa.estado === 403) {
    return 'Tu rol no puede tomar esta decisión: hace falta el permiso de decidir la contratación.'
  }
  if (causa instanceof ErrorApi && causa.estado === 409) {
    return 'Esta postulación ya terminó su recorrido, así que no se puede contratar. Vuelve a cargar la ficha para ver en qué estado quedó.'
  }
  return causa instanceof Error ? causa.message : 'No se pudo contratar.'
}

export function ContratarDesdeLaFicha({
  postulacionId,
  candidato,
  vacante,
  etapa,
  enDecision,
  puedeContratar,
  contratado,
  colaboradorId,
  puedeDarDeAlta,
  puedeVerColaborador,
  alContratar,
}: Props) {
  const [abierto, setAbierto] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [fallo, setFallo] = useState<string | null>(null)
  const [recien, setRecien] = useState(false)

  const contratacion = useMutation({
    mutationFn: () => contratar(postulacionId, motivo.trim()),
    onMutate: () => setFallo(null),
    onSuccess: () => {
      setAbierto(false)
      setMotivo('')
      setRecien(true)
      alContratar()
    },
    // El motivo se conserva: un fallo no obliga a volver a escribirlo.
    onError: (causa) => setFallo(explicarFallo(causa)),
  })

  function cerrarSiSePuede() {
    if (contratacion.isPending) return
    setAbierto(false)
    setError(undefined)
    setFallo(null)
  }

  function intentar() {
    if (contratacion.isPending) return
    if (motivo.trim() === '') {
      setError('Escribe por qué se contrata: queda con la decisión.')
      return
    }
    setError(undefined)
    contratacion.mutate()
  }

  // Recién contratado, el mensaje sale ya, sin esperar a que la ficha vuelva con
  // el estado nuevo: mientras tanto el botón no puede reaparecer.
  if (contratado || recien) {
    const siguiente =
      colaboradorId != null && puedeVerColaborador ? (
        <Link className={estilos.enlace} to={rutas.adminColaborador(colaboradorId)}>
          Ver su ficha de colaborador
        </Link>
      ) : puedeDarDeAlta ? (
        <Link className={estilos.darDeAlta} to={rutas.adminNuevoColaborador(postulacionId)}>
          Dar de alta como colaborador
        </Link>
      ) : null
    if (!recien && !siguiente) return null
    return (
      <div className={estilos.bloque} role={recien ? 'status' : undefined}>
        {recien && <p className={estilos.hecho}>{candidato} quedó contratado.</p>}
        {siguiente}
      </div>
    )
  }

  if (!puedeContratar) return null

  return (
    <div className={estilos.bloque}>
      <button
        className={estilos.contratar}
        type="button"
        onClick={() => {
          setFallo(null)
          setError(undefined)
          setAbierto(true)
        }}
      >
        Contratar
      </button>

      <Modal
        abierto={abierto}
        titulo={`Contratar a ${candidato}`}
        onCerrar={cerrarSiSePuede}
        pie={
          <>
            <button className={estilos.cancelar} type="button" onClick={cerrarSiSePuede}>
              Cancelar
            </button>
            <button
              className={estilos.confirmar}
              type="button"
              disabled={contratacion.isPending}
              onClick={intentar}
            >
              {contratacion.isPending ? 'Contratando…' : 'Contratar'}
            </button>
          </>
        }
      >
        <dl className={estilos.datos}>
          <div>
            <dt>Vacante</dt>
            <dd>{vacante}</dd>
          </div>
          <div>
            <dt>Etapa</dt>
            <dd>{etapa}</dd>
          </div>
        </dl>
        {!enDecision && (
          <p className={estilos.aviso}>
            Todavía está en la etapa {etapa}. Contratar cierra su proceso aquí, sin pasar por las
            etapas que faltan.
          </p>
        )}
        <AreaTexto
          etiqueta="Motivo"
          aria-required
          rows={3}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          error={error}
        />
        <p className={estilos.nota}>No se le envía ningún correo.</p>
        {fallo && (
          <p className={estilos.fallo} role="alert">
            {fallo}
          </p>
        )}
      </Modal>
    </div>
  )
}
