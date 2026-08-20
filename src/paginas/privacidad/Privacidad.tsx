/**
 * Privacidad y control.
 *
 * Tres cosas que se parecen y son distintas, y por eso van separadas y con su
 * explicacion:
 *
 *   1. **Retirar una postulacion** — dejas esa vacante. Tus datos siguen.
 *   2. **Retirar el consentimiento de futuros contactos** — sales del Radar de
 *      Talento. Tus postulaciones en curso no se tocan.
 *   3. **Pedir el borrado de datos** — se eliminan tus datos personales y tus
 *      respuestas. La auditoria se conserva sin identificarte.
 *
 * El mockup las metia las tres en un solo modal y era facil confundirlas.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  misPostulaciones,
  pedirBorrado,
  retirarConsentimientoFuturos,
  retirarPostulacion,
} from '@/api/portal'
import { useSesion } from '@/app/Sesion'
import { esFinal } from '@/dominio/estados'
import { rutas } from '@/rutas'
import { useAviso } from '@/ui/Avisos'
import { Modal } from '@/ui/Modal'
import { Cargando, Fallo } from '@/ui/Mensajes'

export function Privacidad() {
  const avisar = useAviso()
  const cache = useQueryClient()
  const { salir, nombre } = useSesion()
  const [confirmarBorrado, setConfirmarBorrado] = useState(false)
  const [motivo, setMotivo] = useState('')

  const consulta = useQuery({ queryKey: ['postulaciones'], queryFn: misPostulaciones })

  const retiro = useMutation({
    mutationFn: retirarPostulacion,
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ['postulaciones'] })
      avisar('Postulación retirada.')
    },
  })

  const futuros = useMutation({
    mutationFn: retirarConsentimientoFuturos,
    onSuccess: () => avisar('Ya no te contactaremos para futuras convocatorias.'),
  })

  const borrado = useMutation({
    mutationFn: () => pedirBorrado({ motivo: motivo.trim() || undefined }),
    onSuccess: () => {
      setConfirmarBorrado(false)
      setMotivo('')
      avisar('Solicitud registrada. Te confirmaremos por correo.')
    },
  })

  const activas = consulta.data?.filter((p) => !esFinal(p.estado)) ?? []

  return (
    <div className="medida-lectura">
      <Link className="back" to={rutas.procesos()}>
        ← Volver a mis procesos
      </Link>

      <div className="pagehead">
        <div>
          {nombre && <span className="greeting">{nombre}</span>}
          <h1>Privacidad y control</h1>
          <p>
            Tres cosas distintas, y conviene no confundirlas: retirar una postulación,
            salir de futuras convocatorias, y borrar tus datos.
          </p>
        </div>
        <button className="btn" onClick={salir}>
          Cerrar sesión
        </button>
      </div>

      {/* 1 · Retirar una postulacion */}
      <div className="sectionhead" style={{ marginTop: 0 }}>
        <div>
          <h2>Retirar una postulación</h2>
          <p>Dejarás de recibir avisos de esa vacante. Tus datos no se eliminan.</p>
        </div>
      </div>

      {consulta.isPending && <Cargando que="Cargando tus postulaciones…" />}
      {consulta.isError && (
        <Fallo error={consulta.error} reintentar={() => void consulta.refetch()} />
      )}

      <div className="card">
        {activas.length === 0 ? (
          <p className="small">No tienes postulaciones activas.</p>
        ) : (
          <div className="stack">
            {activas.map((p) => (
              <div className="row" key={p.uuid}>
                <div>
                  <b>{p.vacante}</b>
                  <p className="small" style={{ margin: '4px 0 0' }}>
                    {p.estadoNombre}
                  </p>
                </div>
                <button
                  className="btn danger"
                  onClick={() => retiro.mutate(p.uuid)}
                  disabled={retiro.isPending}
                >
                  Retirar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2 · Futuras convocatorias */}
      <div className="sectionhead">
        <div>
          <h2>Futuras convocatorias</h2>
          <p>Salir del Radar de Talento. No afecta a tus postulaciones en curso.</p>
        </div>
      </div>
      <div className="card">
        <div className="row">
          <div>
            <b>Retirar el consentimiento de futuros contactos</b>
            <p className="small" style={{ margin: '5px 0 0' }}>
              Si lo retiras, tu perfil deja de considerarse para otras vacantes. Los
              procesos que tengas abiertos continúan igual.
            </p>
          </div>
          <button
            className="btn"
            onClick={() => futuros.mutate()}
            disabled={futuros.isPending}
          >
            {futuros.isPending ? 'Retirando…' : 'Retirar'}
          </button>
        </div>
      </div>

      {/* 3 · Borrado */}
      <div className="sectionhead">
        <div>
          <h2>Eliminación de datos</h2>
          <p>Lo ejecuta el equipo de Renaser, no es inmediato.</p>
        </div>
      </div>
      <div className="card">
        <div className="row">
          <div>
            <b>Solicitar la eliminación de mis datos</b>
            <p className="small" style={{ margin: '5px 0 0' }}>
              Se eliminarán tus datos personales y tus respuestas de texto libre. El
              registro de auditoría se conserva sin datos que te identifiquen, porque la
              ley obliga a poder reconstruir las decisiones que ya se tomaron.
            </p>
          </div>
          <button className="btn danger" onClick={() => setConfirmarBorrado(true)}>
            Solicitar
          </button>
        </div>
      </div>

      <Modal
        abierto={confirmarBorrado}
        titulo="Solicitar eliminación de datos"
        onCerrar={() => setConfirmarBorrado(false)}
        pie={
          <>
            <button className="btn" onClick={() => setConfirmarBorrado(false)}>
              Cancelar
            </button>
            <button
              className="btn danger"
              onClick={() => borrado.mutate()}
              disabled={borrado.isPending}
            >
              {borrado.isPending ? 'Enviando…' : 'Solicitar eliminación'}
            </button>
          </>
        }
      >
        <div className="callout warn">
          <b>Tus postulaciones en curso se cerrarán</b>
          <p>
            Pedir el borrado cierra las postulaciones que tengas abiertas. No se puede
            deshacer.
          </p>
        </div>
        <div className="field" style={{ marginTop: 14 }}>
          <label htmlFor="motivo">Motivo (opcional)</label>
          <textarea
            id="motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Si quieres, cuéntanos por qué. No es obligatorio."
          />
        </div>
        {borrado.isError && (
          <div className="error">
            {borrado.error instanceof Error
              ? borrado.error.message
              : 'No pudimos registrar la solicitud.'}
          </div>
        )}
      </Modal>
    </div>
  )
}
