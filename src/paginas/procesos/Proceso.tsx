/**
 * El detalle de una postulacion: donde esta, que le toca, y como llego hasta
 * aqui.
 *
 * El mockup dibujaba una linea de tiempo inventada. Esta es la de verdad: el
 * backend guarda cada cambio de estado con quien lo hizo y cuando, y lo manda
 * en `historial`.
 */

import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { retirarPostulacion, verPostulacion } from '@/api/portal'
import type { PasoHistorial } from '@/api/tipos'
import {
  esFinal,
  estaCalificando,
  indiceDeEtapa,
  leTocaAlCandidato,
  momentoDe,
  tramosCompletados,
} from '@/dominio/estados'
import { formatearFechaCorta } from '@/dominio/reloj'
import { rutas } from '@/rutas'
import { useAviso } from '@/ui/Avisos'
import { BarraPasos } from '@/ui/BarraPasos'
import { Modal } from '@/ui/Modal'
import { Cargando, Fallo } from '@/ui/Mensajes'

const CADA_15_SEGUNDOS = 15_000

function Historial({ pasos }: { pasos: PasoHistorial[] }) {
  if (pasos.length === 0) return null
  return (
    <div className="timeline">
      {pasos.map((paso, i) => (
        // El ultimo es donde esta ahora la postulacion, y por eso lleva el punto
        // champagne: es el mismo momento que marca la barra de pasos.
        <div
          className={`event${i === pasos.length - 1 ? ' actual' : ''}`}
          key={`${paso.ocurridaEn}-${i}`}
        >
          <b>{momentoDe(paso.estadoNuevo).titulo}</b>
          <p>
            {formatearFechaCorta(paso.ocurridaEn)} ·{' '}
            {paso.fueElSistema ? 'registrado por el sistema' : 'registrado por una persona'}
          </p>
        </div>
      ))}
    </div>
  )
}

export function Proceso() {
  const { uuid = '' } = useParams()
  const avisar = useAviso()
  const cache = useQueryClient()
  const [confirmarRetiro, setConfirmarRetiro] = useState(false)

  const consulta = useQuery({
    queryKey: ['postulacion', uuid],
    queryFn: () => verPostulacion(uuid),
    enabled: uuid !== '',
    refetchInterval: (q) =>
      q.state.data && estaCalificando(q.state.data.resumen.estado) ? CADA_15_SEGUNDOS : false,
  })

  const retiro = useMutation({
    mutationFn: () => retirarPostulacion(uuid),
    onSuccess: async () => {
      setConfirmarRetiro(false)
      await cache.invalidateQueries({ queryKey: ['postulacion', uuid] })
      await cache.invalidateQueries({ queryKey: ['postulaciones'] })
      avisar('Postulación retirada. Ya no recibirás avisos.')
    },
  })

  if (consulta.isPending) return <Cargando que="Cargando tu proceso…" />
  if (consulta.isError) {
    return <Fallo error={consulta.error} reintentar={() => void consulta.refetch()} />
  }

  const { resumen, historial } = consulta.data
  const momento = momentoDe(resumen.estado)
  const final = esFinal(resumen.estado)
  const puedeRetirarse = !final

  return (
    <>
      <Link className="back" to={rutas.procesos()}>
        ← Volver a mis procesos
      </Link>

      <div className="pagehead">
        <div>
          <div className="eyebrow">{resumen.estadoNombre}</div>
          <h1>{resumen.vacante}</h1>
        </div>
      </div>

      {leTocaAlCandidato(resumen.estado) && momento.accion ? (
        <section className="next-step-panel">
          <div>
            <span className="eyebrow">Te toca a ti</span>
            <h2>{momento.titulo}</h2>
            <p>{momento.ayuda}</p>
          </div>
          <Link className="btn primary large" to={momento.accion.destino(resumen.uuid)}>
            {momento.accion.etiqueta}
          </Link>
        </section>
      ) : (
        !final && (
          <section className="card waiting-panel">
            <span className="eyebrow">En curso</span>
            <h2>{momento.titulo}</h2>
            <p>{momento.ayuda}</p>
          </section>
        )
      )}

      <div className="card">
        <div className="label">Tu recorrido</div>
        <div style={{ marginTop: 16 }}>
          <BarraPasos
            completados={tramosCompletados(resumen.estado)}
            actual={momento.etapa && !final ? indiceDeEtapa(momento.etapa) : null}
          />
        </div>
      </div>

      {resumen.estado === 'CERRADA' && (
        <div className="cierre">
          <span className="tag info">Cerrada</span>
          <b>Esta postulación está cerrada</b>
          <p>
            Ya no recibirás avisos de esta vacante. Cerrar la postulación no elimina tus
            datos: eso se pide por separado.
          </p>
        </div>
      )}

      {resumen.estado === 'NO_CONTINUA' && (
        <div className="cierre">
          <span className="tag bad">No continúa</span>
          <b>Gracias por participar</b>
          <p>
            En esta oportunidad no continúas en el proceso. Agradecemos el tiempo y la
            dedicación que compartiste. Para participar en otra vacante tendrás que
            postular nuevamente.
          </p>
        </div>
      )}

      {resumen.estado === 'CONTRATADO' && (
        <div className="cierre">
          <span className="tag good">Contratado</span>
          <b>Te damos la bienvenida</b>
          <p>Nos pondremos en contacto contigo para los siguientes pasos.</p>
        </div>
      )}

      <div className="sectionhead">
        <div>
          <h2>Cómo llegaste hasta aquí</h2>
          <p>Cada cambio de tu postulación, con su fecha.</p>
        </div>
      </div>
      <div className="card">
        <Historial pasos={historial} />
        {historial.length === 0 && (
          <p className="small">Todavía no hay movimientos que mostrar.</p>
        )}
      </div>

      <div className="row" style={{ marginTop: 26 }}>
        <Link className="btn" to={rutas.vacantes()}>
          Ver otras vacantes
        </Link>
        {puedeRetirarse ? (
          <button className="btn danger" onClick={() => setConfirmarRetiro(true)}>
            Retirar postulación
          </button>
        ) : (
          <Link className="link" to={rutas.privacidad()}>
            Gestionar mis datos
          </Link>
        )}
      </div>

      <Modal
        abierto={confirmarRetiro}
        titulo="Retirar postulación"
        onCerrar={() => setConfirmarRetiro(false)}
        pie={
          <>
            <button className="btn" onClick={() => setConfirmarRetiro(false)}>
              Seguir en el proceso
            </button>
            <button
              className="btn danger"
              onClick={() => retiro.mutate()}
              disabled={retiro.isPending}
            >
              {retiro.isPending ? 'Retirando…' : 'Sí, retirarme'}
            </button>
          </>
        }
      >
        <div className="callout warn">
          <b>Dejarás de recibir avisos de esta vacante</b>
          <p>
            No se puede deshacer: para volver tendrías que postular de nuevo. Retirarte no
            elimina tus datos, eso se pide aparte desde Privacidad.
          </p>
        </div>
        {retiro.isError && (
          <div className="error">
            {retiro.error instanceof Error ? retiro.error.message : 'No pudimos retirarla.'}
          </div>
        )}
      </Modal>
    </>
  )
}
